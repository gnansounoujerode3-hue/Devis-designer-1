/* ============================================================
   SUITE « HÉBERGEMENT » — ce qui casse quand on bouge l'app d'un
   hébergeur à l'autre. Un seul fichier à servir (dist/index.html), un
   routage en hash, une API chez Cloudflare : la config de déploiement doit
   rester vraie, et SURTOUT le domaine public doit être le même partout —
   c'est lui qui porte les liens de parrainage, la vignette partagée sur
   WhatsApp et l'adresse de l'espace vendeur.
   Lancée par tests/run.mjs.
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 190) : '')); }
}

const root = process.cwd();
const read = (f: string) => readFileSync(root + '/' + f, 'utf8');
const has = (f: string) => existsSync(root + '/' + f);

/* ---------- 1. La configuration du Worker d'assets ---------- */
ok(has('wrangler.jsonc'), 'wrangler.jsonc est à la racine du dépôt');
const rawJsonc = read('wrangler.jsonc');
const cfgSrc = rawJsonc.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
let cfg: Record<string, any> = {};
try { cfg = JSON.parse(cfgSrc); ok(true, 'wrangler.jsonc : JSON valide une fois les commentaires retirés'); }
catch (e) { ok(false, 'wrangler.jsonc : JSON valide', (e as Error).message); }
ok(cfg.assets?.directory === './dist', 'le Worker sert ./dist, la sortie de npm run build', cfg.assets?.directory);
ok(cfg.assets?.not_found_handling === 'single-page-application', 'fallback SPA déclaré (jamais de 404 brut)');
ok(/^[a-z][a-z0-9-]{0,62}$/.test(cfg.name || ''), 'le nom du Worker est un identifiant workers.dev valide', cfg.name);
ok(/^\d{4}-\d{2}-\d{2}$/.test(cfg.compatibility_date || ''), 'compatibility_date au format date', cfg.compatibility_date);
ok(!/"main"/.test(cfgSrc), 'aucun script : un Worker « assets only », donc non facturé à la requête');

/* Le front et l'API sont deux Workers distincts du même compte. */
const configTs = read('src/lib/config.ts');
const apiHost = (configTs.match(/AUTO_PAY_WORKER_URL\s*=\s*'https:\/\/([^/']+)'/) || [])[1] || '';
const apiLabel = apiHost.split('.')[0];
ok(!!apiHost, 'l’URL du Worker d’API est déclarée dans config.ts', apiHost);

/* Les adresses de SECOURS : tolérées là où elles sont déclarées (config.ts) et expliquées (README),
   jamais recopiées dans un composant — sinon le fichier a choisi un camp et le résolveur
   (src/lib/workerBase.ts) ne décide plus de rien. Une liste vide est un état normal : le repli a
   vocation à disparaître quand l'adresse principale est stable. */
const fallbackBlock = (configTs.match(/AUTO_PAY_WORKER_FALLBACKS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
const fallbackHosts = (fallbackBlock.match(/https:\/\/[^'/\s]+/g) || [])
  .map(u => u.replace(/^https:\/\//, '').toLowerCase()).filter(h => h && h !== apiHost.toLowerCase());
ok(Array.isArray(fallbackHosts), 'la liste des adresses de repli est déclarée dans config.ts');
for (const f of ['index.html', 'src/components/VendorPage.tsx', 'tests/shim.js', 'src/lib/workerBase.ts',
                'src/lib/quota.ts', 'src/components/PaywallModal.tsx', 'scripts/make-og-image.py', 'backend/worker.js']) {
  const low = read(f).toLowerCase();
  ok(!fallbackHosts.some(h => low.includes(h)), `${f} ne recopie aucune adresse de repli`, fallbackHosts.join(', '));
}
ok(cfg.name !== apiLabel, 'le front ne porte pas le même nom que le Worker d’API', `${cfg.name} / ${apiLabel}`);

/* Vite doit bien écrire dans dist (sinon le Worker envoie un dossier vide). */
ok(!/outDir/.test(read('vite.config.ts')), 'vite.config.ts garde la sortie par défaut « dist » (celle du Worker)');

/* ---------- 2. Un seul domaine public dans tout le dépôt ---------- */
const appUrl = (configTs.match(/DOWNLOAD_LINK:\s*'([^']+)'/) || [])[1] || '';
const appHost = appUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
ok(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/.test(appUrl), 'VENDOR.DOWNLOAD_LINK est une URL absolue', appUrl);
ok(!appUrl.includes('workers.dev') || appHost !== apiHost, 'le domaine du front n’est pas celui de l’API');

/**
 * Tous les hôtes de l'application (et de son API) mentionnés dans un fichier doivent être
 * l'adresse publique courante ou celle du Worker d'API. Un hôte de partage WhatsApp périmé,
 * un lien de parrainage qui pointe encore chez l'ancien hébergeur : c'est exactement ce que
 * cette règle attrape. Les modèles d'hébergeurs connus sont les seuls reconnus, et une
 * variable shell (`devisdesigner.$NOUVEAU.workers.dev`) n'est pas un hôte — elle ne doit pas
 * faire rougir le test, sinon la procédure de renommage serait indésirable.
 */
function staleHosts(f: string): string[] {
  const hosts = read(f).match(/(?:[a-z0-9-]+\.)+(?:workers\.dev|netlify\.app|pages\.dev|vercel\.app)/gi) || [];
  const wanted = new Set([appHost.toLowerCase(), apiHost.toLowerCase(), 'devisdesigner']);
  if (/^src\/lib\/config\.ts$|^README\.md$/.test(f)) fallbackHosts.forEach(h => wanted.add(h));
  return Array.from(new Set(hosts.map(h => h.toLowerCase())))
    .filter(h => h.includes('devisdesigner') && !wanted.has(h));
}
for (const f of ['index.html', 'src/lib/config.ts', 'src/components/VendorPage.tsx', 'tests/shim.js',
                'scripts/make-og-image.py', 'tests/landing_test.tsx', 'README.md']) {
  ok(staleHosts(f).length === 0, `domaine cohérent dans ${f}`, staleHosts(f).join(', '));
}
ok(read('README.md').includes(appHost), 'README : le domaine public courant y est écrit (la sonde du pied de page le vérifie après déploiement)', appHost);
const html = read('index.html');
for (const m of ['og:url', 'og:image', 'twitter:image', 'canonical']) {
  const re = m === 'canonical'
    ? /<link rel="canonical" href="([^"]+)"/
    : new RegExp('(?:property|name)="' + m + '" content="([^"]+)"');
  const v = (html.match(re) || [])[1] || '';
  ok(v.startsWith('https://' + appHost + '/'), `index.html : « ${m} » pointe sur le domaine public`, v);
}
const ld = (read('index.html').match(/"@type":\s*"SoftwareApplication"[\s\S]{0,400}/) || [''])[0];
ok(ld.includes(`"url": "https://${appHost}/"`), 'index.html : le JSON-LD (SoftwareApplication) déclare la même adresse', ld.slice(0, 90));

/* ---------- 2 bis. Ce que VOIT le robot d'aperçu de WhatsApp ---------- */
/* Un <head> correct mais lu trop tard ne donne aucun visuel : les robots ne
   lisent pas un HTML de 1,5 Mo en entier. Le favicon en base64 pèse 12,5 ko ;
   déclaré avant les balises og:, il les rejetait à l'octet 13 700. */
const headBytes = (html.match(/^[\s\S]*?<\/head>/) || [''])[0];
const off = (tag: string) => Buffer.byteLength(headBytes.slice(0, headBytes.indexOf(tag)), 'utf8');
ok(headBytes.includes('og:image') && off('og:image') > 0 && off('og:image') < 1500,
   'og:image est dans les 1 500 premiers octets du <head>', 'octet ' + off('og:image'));
ok(headBytes.indexOf('og:image:alt') < headBytes.indexOf('<link rel="icon"'),
   'le favicon (data: base64) est déclaré APRÈS le bloc og:');
ok(/property="og:locale" content="fr_FR"/.test(headBytes), 'og:locale déclaré (les robots trient par langue)');
/* /robots.txt doit exister en tant que fichier : sinon le fallback SPA répond le
   HTML de l'app en 200 et le robot lit des règles là où il y a une page. */
ok(has('public/robots.txt'), 'public/robots.txt existe (sinon le fallback SPA répond du HTML aux robots)');
const robots = has('public/robots.txt') ? read('public/robots.txt') : '';
ok(/User-agent: facebookexternalhit\s*\nAllow: \//.test(robots), 'robots.txt autorise explicitement facebookexternalhit', robots.slice(0, 60));
ok(!/^Disallow:/m.test(robots), 'robots.txt ne bloque aucune page (le mur de paiement non plus)');
/* Le README doit donner de quoi diagnostiquer sans deviner : le bon outil, les
   quatre causes, et le fait que chaque hôte a son propre <head>. */
ok(read('README.md').includes('https://developers.facebook.com/tools/debug/'),
   'README : le Shared Debugger de Facebook est pointé par sa vraie URL');
for (const clue of ['Bot Fight Mode', '?v=2', 'Un message = une URL', 'text/html']) {
  ok(read('README.md').includes(clue), `README : la cause « ${clue} » est écrite noir sur blanc`);
}

/* ---------- 3. Les commandes annoncées existent ---------- */
const pkg = JSON.parse(read('package.json'));
ok(/wrangler deploy/.test(pkg.scripts['deploy:cf'] || ''), 'package.json : npm run deploy:cf déploie sur Cloudflare', pkg.scripts['deploy:cf']);
ok(/vite build/.test(pkg.scripts['deploy:cf'] || ''), 'deploy:cf construit d’abord dist (le Worker n’envoie que ça)');
// Le piège qui a mordu : `npm run deploy` tout court envoyait le front chez Vercel, l'hôte
// historique, alors que le domaine public est un Worker d'assets. La commande évidente doit
// être la bonne ; l'ancienne voie reste disponible, mais nommée.
ok(/wrangler deploy/.test(pkg.scripts['deploy'] || ''), 'package.json : npm run deploy = Cloudflare, le domaine public', pkg.scripts['deploy']);
ok(/vercel --prod/.test(pkg.scripts['deploy:vercel'] || ''), 'package.json : la voie Vercel existe sous son nom explicite', pkg.scripts['deploy:vercel']);
ok(!/vercel/.test(pkg.scripts['deploy'] || ''), 'package.json : plus aucun script « deploy » nu ne pointe ailleurs que sur le domaine public');
// vite 7.3.2 et esbuild 0.27.x avaient deux trous réservées au serveur de développement sous
// Windows (lecture de n'importe quel fichier, contournement de server.fs.deny, hash NTLMv2 par
// chemin UNC). Rien de tout cela n'entre dans dist/index.html, mais la machine qui développe, si.
const verNum = (raw: string) => (raw || '').replace(/[^0-9.]/g, ' ').trim().split(/[.\s]+/).map(Number);
const atLeast = (raw: string, min: number[]) => {
  const v = verNum(raw);
  for (let i = 0; i < min.length; i++) {
    const a = v[i] || 0;
    if (a > min[i]) return true;
    if (a < min[i]) return false;
  }
  return true;
};
ok(atLeast(pkg.devDependencies?.vite, [7, 3, 6]), 'package.json : vite à la version qui ferme les trous Windows du serveur de dev', pkg.devDependencies?.vite);
ok(atLeast(pkg.devDependencies?.esbuild, [0, 28, 2]), 'package.json : esbuild idem', pkg.devDependencies?.esbuild);
ok(/deploy_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'npm run test:ui joue cette suite', pkg.scripts['test:ui']);
// Une commande que la doc cite et qui n'existe pas = quelqu'un qui échoue en collant le texte.
// Le contrôle est mécanique : tout « npm run X » écrit dans le README doit être un script déclaré.
const cited = new Set<string>();
const reRun = /npm run ([a-zA-Z][a-zA-Z0-9:_-]*)/g;
let mm: RegExpExecArray | null;
while ((mm = reRun.exec(read('README.md')))) cited.add(mm[1]);
const inconnus = [...cited].filter((name) => !(pkg.scripts as Record<string, string>)[name]);
ok(inconnus.length === 0, 'README : chaque « npm run … » cité est un script qui existe', inconnus.join(', '));
ok(/NODE_VERSION = "22"/.test(read('netlify.toml')), 'netlify.toml : Node 22, comme la voie Cloudflare Pages (Vite 7 exige >=20.19)');
ok(read('wrangler.jsonc').includes('npm run deploy:cf'), 'wrangler.jsonc rappelle la commande');

/* ---------- 4. Le README dit la vérité sur l'option Cloudflare ---------- */
const readme = read('README.md');
ok(/### Option 5 — Cloudflare/.test(readme), 'README : l’option Cloudflare est écrite à côté des quatre autres');
ok(readme.includes('npm run deploy:vercel'), 'README : l’ancienne voie est montrée sous le nom de script qui la désigne');
ok(/server\.fs\.deny/.test(readme) && /Windows/.test(readme), 'README : les deux trous Windows du serveur de dev sont écrits avec leur correctif');
ok(/framework = \*\*Vite\*\*/.test(readme), 'README : l’option Vercel nomme le framework construit (Vite), pas l’hébergeur');
for (const s of ['npx wrangler login', 'npx wrangler deploy', 'not_found_handling', 'pages deploy', 'wrangler rollback']) {
  ok(readme.includes(s), `README : ${s}`);
}
ok(/localStorage/.test(readme) && /Restaurer une copie/.test(readme),
  'README : le déménagement d’origine est expliqué avec la sauvegarde à faire avant');
ok(/Access-Control-Allow-Origin/.test(readme),
  'README : il est dit que le Worker d’API n’a pas besoin d’être retouché');
const appVersion = (configTs.match(/APP_VERSION = '([^']+)'/) || [])[1] || '';
const pkgVersion = JSON.parse(read('package.json')).version;
ok(appVersion === pkgVersion, 'package.json et config.ts portent la même version', `${pkgVersion} / ${appVersion}`);
ok(readme.includes(`Version ${appVersion}`), 'README : la sonde de version annonce la version courante', appVersion);
ok(/tests\/deploy_test\.tsx/.test(readme), 'README : cette suite est listée avec les autres');
// L'adresse annoncée dans wrangler.jsonc et dans config.ts ne doivent pas pouvoir diverger :
// c'est exactement ce qui casse un partage WhatsApp ou un lien de parrainage après un renommage.
const advertised = (read('wrangler.jsonc').match(/https:\/\/([a-z0-9.-]+\.workers\.dev)/i) || [])[1] || '';
ok(advertised === appHost, 'wrangler.jsonc et config.ts annoncent la même adresse publique', `${advertised} / ${appHost}`);
ok(/Subdomains|sous-domaine/i.test(readme) && /webhook Chariow/.test(readme),
  'README : le sous-domaine de compte et le webhook Chariow sont signalés au moment du renommage');
ok(/Version 1\.3\.[0-9]/.test(readme) === false || readme.includes('Version ' + appVersion), 'README : aucun numéro de version périmé ne traîne');


/* ---------- 5. Une deployment reste petite et sans surprise ---------- */
ok(has('public/og-image.png'), 'la vignette de partage est dans public/ (Vite la recopie dans dist/)');
ok(!read('.gitignore').includes('wrangler.jsonc'), 'wrangler.jsonc est versionné (la CI en a besoin)');
ok(/dist/.test(read('.gitignore')), 'dist/ reste ignoré par git : c’est un artefact, on le régénère');

console.log(`\nHÉBERGEMENT : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
