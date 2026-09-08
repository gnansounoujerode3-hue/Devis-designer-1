/* ============================================================
   SUITE « ADRESSE DU WORKER » — le résolveur qui évite la panne de caisse.
   Un sous-domaine de compte Cloudflare renommé, un Worker renommé, un passage
   sur un domaine à vous : l'URL du backend meurt d'un coup pour TOUTES les apps
   déjà installées, et le client qui veut payer lit une erreur réseau en anglais.
   Ce qui est joué ici : le choix de l'adresse vivante, son cache, son
   invalidation, et la traduction de la panne en phrase utile.
   ============================================================ */
import { readFileSync } from 'node:fs';
import {
  chooseWorker, explainWorkerFailure, invalidateWorkerBase, isWorkerConfigured,
  warmWorkerBase, workerBase, workerCandidates,
} from '../src/lib/workerBase';
import { AUTO_PAY_WORKER_URL, AUTO_PAY_WORKER_FALLBACKS } from '../src/lib/config';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 200) : '')); }
}
const root = process.cwd();
const read = (f: string) => readFileSync(root + '/' + f, 'utf8');
const A = 'https://vif.workers.dev', B = 'https://mort.workers.dev', C = 'https://autre.workers.dev';

/* ---------- 1. La déclaration dans config.ts ---------- */
ok(/^https:\/\//.test(AUTO_PAY_WORKER_URL), 'AUTO_PAY_WORKER_URL est une URL absolue', AUTO_PAY_WORKER_URL);
ok(Array.isArray(AUTO_PAY_WORKER_FALLBACKS), 'des adresses de repli sont déclarées');
ok(workerCandidates()[0] === AUTO_PAY_WORKER_URL.replace(/\/+$/, ''), 'la première candidate est l’adresse principale');
ok(workerCandidates().length === new Set(workerCandidates()).size, 'aucun doublon dans la liste');
ok(workerCandidates().every(u => /^https:\/\//.test(u)), 'que du https (une page https ne peut pas appeler du http)');
ok(isWorkerConfigured() === true, 'le backend est considéré configuré');

/* ---------- 2. chooseWorker : la logique, sans réseau ---------- */
const alive = (set: string[]) => async (b: string) => set.includes(b);
try {
  ok(await chooseWorker([B, A], alive([A]), B) === A, 'l’adresse morte est abandonnée au profit de la vivante');
  ok(await chooseWorker([A, B], alive([A]), A) === A, 'l’adresse courante est gardée si elle répond (une seule sonde)');
  ok(await chooseWorker([A, B], alive([]), A) === A, 'plus rien ne répond : on garde l’actuelle, on n’invente pas');
  ok(await chooseWorker([A, B, C], alive([C]), A) === C, 'la première vivante de la liste gagne, dans l’ordre déclaré');
  ok(await chooseWorker([], alive([]), A) === '', 'liste vide = adresse vide (flux manuel, pas d’appel impossible)');
  ok(await chooseWorker([B], alive([]), '') === B, 'aucune adresse courante : la déclarée est rendue même morte');
  ok(await chooseWorker(['' , A + '/'], alive([A]), '') === A, 'traîneaux et lignes vides normalisés avant usage');
} catch (e) { ok(false, 'chooseWorker ne lève jamais', String(e)); }

// chooseWorker ne piège rien lui-même (c’est warmWorkerBase qui doit avaler la panne réseau) :
let threw = false;
try { await chooseWorker([A], async () => { throw new Error('réseau coupé'); }, ''); }
catch { threw = true; }
ok(threw, 'chooseWorker laisse remonter : la tolérance est dans warmWorkerBase, pas dans le choix');

/* ---------- 3. warmWorkerBase + cache ---------- */
const realFetch = globalThis.fetch;
let probed: string[] = [];
const first = workerCandidates()[0];   // l’adresse principale, telle que déclarée dans config.ts
globalThis.fetch = (async (url: any) => {
  const u = String(url); probed.push(u);
  return u === first + '/debug' ? { ok: true, json: async () => ({}) } : { ok: false, status: 530, json: async () => ({}) };
}) as unknown as typeof fetch;
try {
  localStorage.clear(); probed = [];
  const chosen = await warmWorkerBase(500);
  ok(chosen === first, 'l’adresse qui répond est retenue', chosen + ' vs ' + first);
  ok(workerCandidates().includes(chosen), 'et c’est bien une adresse déclarée, jamais une invention');

  // Une panne réseau totale ne doit pas faire tomber l’app : warmWorkerBase avale tout.
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
  const afterStorm = await warmWorkerBase(200);
  ok(typeof afterStorm === 'string' && afterStorm.length > 0, 'réseau coupé pendant la sonde : aucune exception, juste un choix');
  globalThis.fetch = (async (url: any) => String(url) === first + '/debug' ? { ok: true, json: async () => ({}) } : { ok: false }) as unknown as typeof fetch;
  ok(probed.every(u => /\/debug$/.test(u)), 'la sonde est un GET /debug (léger, sans écriture)', probed.join(' '));
  ok(probed.length <= workerCandidates().length, 'une sonde par adresse au plus, pas une par clic', String(probed.length));
  const cache = JSON.parse(localStorage.getItem('dd_worker_base') || 'null');
  ok(cache && cache.url === chosen && typeof cache.at === 'number', 'l’adresse validée est gardée en cache avec sa date');
  ok(workerBase() === chosen, 'workerBase() rend le choix, pas la configuration');
  invalidateWorkerBase(chosen);
  ok(JSON.parse(localStorage.getItem('dd_worker_base') || 'null') === null, 'invalidée = le cache est jeté (on re-sondera)');

  // Cache intact, aucune sonde nécessaire : workerBase() répond sans fetch.
  globalThis.fetch = (async () => { probed.push('NE DOIT PAS ETRE APPELE'); return { ok: true } as unknown as Response; }) as unknown as typeof fetch;
  localStorage.setItem('dd_worker_base', JSON.stringify({ url: first, at: Date.now() }));
  probed = [];
  ok(workerBase() === first, 'un cache frais est utilisé tel quel, sans nouvelle sonde', workerBase());
  ok(probed.length === 0, 'aucun fetch émis par workerBase() (la sonde ne joue qu\u2019au démarrage)');
  localStorage.setItem('dd_worker_base', JSON.stringify({ url: A, at: Date.now() - 7 * 3600 * 1000 }));
  ok(workerBase() === workerCandidates()[0], 'un cache de plus de 6 h est périmé : on revient à la déclarée');
  localStorage.setItem('dd_worker_base', JSON.stringify({ url: 'https://pirate.example.com', at: Date.now() }));
  ok(workerBase() === workerCandidates()[0], 'une adresse en cache qui n’est pas déclarée est ignorée');
  localStorage.setItem('dd_worker_base', 'pas du json');
  ok(workerBase() === workerCandidates()[0], 'un cache corrompu ne bloque pas l’app');
  localStorage.clear();
} finally { globalThis.fetch = realFetch; }

/* ---------- 4. Ce que lit le client ---------- */
ok(/réseau/.test(explainWorkerFailure(new TypeError('Failed to fetch'))), '« Failed to fetch » devient une phrase sur le réseau');
ok(!/Failed to fetch/i.test(explainWorkerFailure(new TypeError('Failed to fetch'))), 'et l’anglais de l’exception ne revient pas à l’écran');
ok(/illisible/.test(explainWorkerFailure(new Error('Unexpected token < in JSON'))), 'réponse non-JSON = « illisible »');
ok(/trop de temps/.test(explainWorkerFailure(new Error('The user aborted a request.'))), 'sonde annulée = « trop de temps »');
ok(/serveur de paiement/.test(explainWorkerFailure(new Error('HTTP 500'))), 'tout le reste reste poli et français', explainWorkerFailure(new Error('HTTP 500')));
ok(explainWorkerFailure(undefined).length > 10, 'undefined ne produit pas un message vide');

/* ---------- 5. Le branchage est réel, pas seulement possible ---------- */
const code = (f: string) => ({ test: (re: RegExp) => re.test(stripComments(f)) });
const stripComments = (f: string) => read(f)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')                  // blocs /* ... */
  .replace(/(^|[^:\w])\/\/[^\n]*/g, '$1 ');            // fins de ligne // (jamais les https://)

for (const f of ['src/lib/quota.ts', 'src/lib/referral.ts', 'src/lib/adminKey.ts', 'src/components/PaywallModal.tsx', 'src/lib/pulse.ts']) {
  ok(/from '\.\/workerBase'|from '\.\.\/lib\/workerBase'/.test(read(f)), f + ' passe par le résolveur');
  // Ce qui est interdit : que le module s'accroche à l'URL déclarée pour construire ses requêtes.
  // Le nom de la constante peut rester dans les messages de diagnostic — il est utile au vendeur.
  ok(!code(f).test(/import[^;\n]*AUTO_PAY_WORKER_URL/), f + ' n’importe plus l’URL brute');
  ok(!code(f).test(/AUTO_PAY_WORKER_URL\s*\+|\+\s*AUTO_PAY_WORKER_URL/), f + ' ne branche pas de fetch sur l’URL brute');
}
ok(!/WORKER_BASE/.test(read('src/lib/quota.ts')), 'quota.ts : l’ancienne constante de module a disparu');
ok(/if \(down\) \{\s*invalidateWorkerBase\(\);/.test(read('src/components/PaywallModal.tsx'))
  && /if \(netFails === 3/.test(read('src/components/PaywallModal.tsx')),
  'une panne réseau, au lancement comme en vérification, invalide le choix (le client réessaie sur l’autre adresse)');
ok(/void warmWorkerBase\(\);/.test(read('src/App.tsx')), 'la sonde joue au démarrage de l’app');
const paywall = read('src/components/PaywallModal.tsx');
ok(!/e\.message/.test(paywall), 'PaywallModal : plus aucune exception affichée nue au client');
ok(/setAutoMsg\(explainWorkerFailure\(e\)/.test(paywall), 'PaywallModal : c’est la traduction qui sort, pas l’exception');
ok(/if \(!res\.ok\) throw new Error\('HTTP '/.test(paywall), 'un code HTTP est traité comme tel, pas comme un JSON');
ok(/await res\.json\(\)\.catch\(\(\) => null\)/.test(paywall), 'un corps non-JSON devient « illisible », pas une plante');
ok(/String\(data\.message \|\|/.test(paywall), 'la réponse du Worker (en français, écrite pour le client) passe telle quelle');
ok((paywall.match(/void warmWorkerBase\(4000\);/g) || []).length === 2,
  'lancement ET vérification re-sondent la liste après une panne réseau', String((paywall.match(/void warmWorkerBase\(4000\);/g) || []).length));
ok(/let netFails = 0;/.test(paywall) && /netFails === 3/.test(paywall), 'le polling compte les échecs réseau (silence de 16 min = puni)');
ok(/votre paiement ne sera pas perdu/.test(paywall), 'et le client qui a déjà payé est rassuré par écrit');
ok(!/e\.message/.test(read('src/lib/quota.ts').split('\n').filter(l => /setMsg|setMessage|catch \(e\)/.test(l)).join('\n')),
  'quota.ts n’affiche pas non plus une exception brute');
const pkg = JSON.parse(read('package.json'));
ok(/workerbase_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'npm run test:ui joue cette suite', pkg.scripts['test:ui']);

/* ---------- 6. Ce qui est écrit, à l'écran comme dans la doc ---------- */
const readme = read('README.md');
ok(/AUTO_PAY_WORKER_FALLBACKS/.test(readme), 'README : les adresses de repli sont documentées');
ok(/Failed to fetch/.test(readme), 'README : le symptôme connu est nommé, avec sa cause');
const cfg = read('src/lib/config.ts');
ok(/SOUS-DOMAINE DU COMPTE/.test(cfg), 'config.ts : le commentaire explique pourquoi il y a une liste');
ok(/workerBase\.ts/.test(cfg), 'config.ts : le comment renvoie au résolveur');

console.log(`\nADRESSE DU WORKER : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
