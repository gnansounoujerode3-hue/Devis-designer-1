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
ok(cfg.name !== apiLabel, 'le front ne porte pas le même nom que le Worker d’API', `${cfg.name} / ${apiLabel}`);

/* Vite doit bien écrire dans dist (sinon le Worker envoie un dossier vide). */
ok(!/outDir/.test(read('vite.config.ts')), 'vite.config.ts garde la sortie par défaut « dist » (celle du Worker)');

/* ---------- 2. Un seul domaine public dans tout le dépôt ---------- */
const appUrl = (configTs.match(/DOWNLOAD_LINK:\s*'([^']+)'/) || [])[1] || '';
const appHost = appUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
ok(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/.test(appUrl), 'VENDOR.DOWNLOAD_LINK est une URL absolue', appUrl);
ok(!appUrl.includes('workers.dev') || appHost !== apiHost, 'le domaine du front n’est pas celui de l’API');

/** Tous les hôtes « devisdesigner…` d'un fichier doivent être le domaine public ou celui de l'API. */
function staleHosts(f: string): string[] {
  const hosts = read(f).match(/(?:https?:\/\/)?[a-z0-9._-]*devisdesigner[a-z0-9._-]*/gi) || [];
  const wanted = new Set([appHost, apiHost, apiHost.replace(/\.[^.]+\.[^.]+$/, ''), 'devisdesigner']);
  return Array.from(new Set(hosts.map(h => h.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase())))
    .filter(h => !wanted.has(h));
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

/* ---------- 3. Les commandes annoncées existent ---------- */
const pkg = JSON.parse(read('package.json'));
ok(/wrangler deploy/.test(pkg.scripts['deploy:cf'] || ''), 'package.json : npm run deploy:cf déploie sur Cloudflare', pkg.scripts['deploy:cf']);
ok(/vite build/.test(pkg.scripts['deploy:cf'] || ''), 'deploy:cf construit d’abord dist (le Worker n’envoie que ça)');
ok(/deploy_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'npm run test:ui joue cette suite', pkg.scripts['test:ui']);
ok(read('wrangler.jsonc').includes('npm run deploy:cf'), 'wrangler.jsonc rappelle la commande');

/* ---------- 4. Le README dit la vérité sur l'option Cloudflare ---------- */
const readme = read('README.md');
ok(/### Option 5 — Cloudflare/.test(readme), 'README : l’option Cloudflare est écrite à côté des quatre autres');
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
ok(/Version 1\.3\.[0-9]/.test(readme) === false || readme.includes('Version ' + appVersion), 'README : aucun numéro de version périmé ne traîne');


/* ---------- 5. Une deployment reste petite et sans surprise ---------- */
ok(has('public/og-image.png'), 'la vignette de partage est dans public/ (Vite la recopie dans dist/)');
ok(!read('.gitignore').includes('wrangler.jsonc'), 'wrangler.jsonc est versionné (la CI en a besoin)');
ok(/dist/.test(read('.gitignore')), 'dist/ reste ignoré par git : c’est un artefact, on le régénère');

console.log(`\nHÉBERGEMENT : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
