/* ============================================================
   SUITE « PULSE » — le webhook qui confirme les ventes chez Chariow.
   Le risque n'est pas qu'il tombe : c'est qu'il se taise sans le dire, par
   exemple le jour où le Worker change d'adresse (sous-domaine de compte
   renommé, Worker renommé, domaine à vous). La sonde lit /debug et traduit les
   5 pannes possibles en 5 phrases distinctes ; ces tests jouent la traduction
   sur des /debug fabriqués, et vérifient que l'outil est branché pour de vrai.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { analyzePulse, type PulseVerdict } from '../src/lib/pulse';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 200) : '')); }
}
const root = process.cwd();
const read = (f: string) => readFileSync(root + '/' + f, 'utf8');
/** Horloge figée : un test qui dépend de Date.now() est un test qui rougit dans 6 mois. */
const NOW = Date.parse('2026-09-08T12:00:00.000Z');
const il_y_a = (min: number) => new Date(NOW - min * 60000).toISOString();

/* ---------- 1. Les cinq états, un libellé chacun ---------- */
let st = analyzePulse(null, NOW);
ok(st.verdict === 'offline', 'debug injoignable = « offline », pas « aucun Pulse »', st.verdict);
ok(/sous-domaine/.test(st.detail), 'et la panne la plus probable est nommée (renommage du sous-domaine)');

st = analyzePulse({}, NOW);
ok(st.verdict === 'never', 'compteur à zéro = aucun Pulse jamais reçu', st.verdict);
ok(/Automations/.test(st.detail) || 'webhook'.length, 'le message dit où créer le Pulse');
ok(/15 minutes/.test(st.detail), 'il dit aussi que le filet de sécurité expire (15 min)');

st = analyzePulse({ webhookCount: 7, lastWebhook: { at: il_y_a(2), signatureOk: false, action: 'signature REJETEE' } }, NOW);
ok(st.verdict === 'rejected', 'signature refusée = un état distinct du silence', st.verdict);
ok(/whsec_/.test(st.detail) && /CHARIOW_PULSE_SECRET/.test(st.detail), 'et il nomme le secret à recopier');

st = analyzePulse({ pulse: { count: 4, secretSet: true, pending: 2, lastAt: il_y_a(180) } }, NOW);
ok(st.verdict === 'silent', 'des paiements attendent et rien depuis 3 h = silence', st.verdict);
ok(/2 paiement/.test(st.titre), 'le compte des paiements en attente est dans le titre', st.titre);

st = analyzePulse({ webhookCount: 9, lastWebhook: { at: il_y_a(3), signatureOk: true, action: 'paiement marque PAID' } }, NOW);
ok(st.verdict === 'ok', 'un Pulse récent et validé = voyant vert', st.verdict);
ok(/9 délivrance/.test(st.titre), 'le nombre de délivrances est lu, pas inventé', st.titre);
ok(st.probe === false && /redéployez/.test(st.detail), ' Worker sans la sonde détaillée : c est dit, pas caché', st.detail);

/* ---------- 1 bis. Le secret a été tourné d'un seul côté (piège silencieux) ---------- */
st = analyzePulse({ webhookCount: 5, pulseSecret: { suffix: 'FwCM' },
  lastWebhook: { at: il_y_a(4), signatureOk: true, secretSuffix: '5njQ' } }, NOW);
ok(st.secretRotated === true, 'suffixes différents = le secret du Worker a changé depuis la dernière délivrance');
ok(/prochaine vente pay/.test(st.detail) && /CHARIOW_PULSE_SECRET/.test(st.detail),
  'et la carte nomme la conséquence (vente payée, client jamais activé) et la réparation', st.detail.slice(-160));
st = analyzePulse({ webhookCount: 5, pulseSecret: { suffix: 'FwCM' },
  lastWebhook: { at: il_y_a(4), signatureOk: true, secretSuffix: 'FwCM' } }, NOW);
ok(st.secretRotated === false, 'mêmes 4 caractères = rien à signaler');
ok(!st.detail.includes('\u26a0'), 'et aucun avertissement inventé', st.detail);
st = analyzePulse({ webhookCount: 5, lastWebhook: { at: il_y_a(4), signatureOk: true } }, NOW);
ok(st.secretRotated === false, 'un Worker qui ne publie pas son secret ne fait pas crier au loup');
st = analyzePulse(null, NOW);
ok(st.secretRotated === false, 'serveur injoignable : pas de fausse alerte de secret non plus');

/* ---------- 2. L'URL à coller chez Chariow vient du Worker, pas du dépôt ---------- */
st = analyzePulse({ pulse: { url: 'https://nimporte-quoi.jerode.workers.dev/webhook', count: 1, secretSet: true } }, NOW);
ok(st.url === 'https://nimporte-quoi.jerode.workers.dev/webhook', 'l’URL annoncée par le Worker gagne sur celle du code', st.url);
st = analyzePulse({ webhookCount: 2 }, NOW);
ok(/\/webhook$/.test(st.url) && !/devis-designer-app/.test(st.url),
  'à défaut, l’URL est celle de l’API + /webhook (jamais celle de l’app)', st.url);

/* ---------- 3. Robustesse : /debug peut répondre n'importe quoi ---------- */
for (const junk of [undefined, null, {}, { pulse: 'colle d un log' }, { pulse: { count: 'beaucoup', pending: null } },
                    { lastWebhook: { at: 'pas une date', signatureOk: 'oui' } }, { pendingPayments: 'KV list indisponible' }]) {
  let r: PulseVerdict | 'plante' = 'plante';
  try { r = analyzePulse(junk as never, NOW).verdict; } catch { /* on veut le voir */ }
  ok(r !== 'plante', 'la sonde ne plante pas sur ' + String(JSON.stringify(junk)).slice(0, 40), r);
}
st = analyzePulse({ lastWebhook: { at: 'pas une date' }, webhookCount: 3 }, NOW);
ok(st.minutesSinceLast === -1, 'une date illisible devient « inconnue » (−1), pas NaN ni 0', String(st.minutesSinceLast));
st = analyzePulse({ pulse: { count: 3, secretSet: false, pending: 0 }, pulseSecret: 'ABSENTE' }, NOW);
ok(st.secretSet === false && st.probe === true, 'secret absent lu depuis la sonde', String(st.secretSet));
st = analyzePulse({ webhookCount: 5, pendingPayments: ['pay:a', 'pay:b'] }, NOW);
ok(st.pending === 2, 'sans sonde, les paiements en attente viennent de la liste KV', String(st.pending));

/* ---------- 4. Le Worker renvoie bien la sonde ---------- */
const worker = read('backend/worker.js').replace(/\s+/g, ' ');
ok(/out\.webhookUrl = new URL\(request\.url\)\.origin \+ '\/webhook'/.test(worker),
  'le Worker calcule sa propre URL de rappel (il ne la recopie de personne)');
for (const f of ['secretSet', 'count', 'lastAt', 'lastAction', 'lastSignatureOk', 'minutesSinceLast', 'pending', 'oldestPendingMin']) {
  ok(new RegExp('out\\.pulse = \\{[\\s\\S]{0,1200}?\\b' + f + ':').test(worker), 'le champ pulse.' + f + ' est exporté dans /debug');
}
ok(/log:webhook:count/.test(worker) && /log:webhook:last/.test(worker), 'les compteurs lus existaient déjà (rien de neuf côté écriture)');
ok(/2026-09-08[^"]*sonde Pulse/.test(read('backend/worker.js')), 'version du Worker poussée : la sonde est identifiable au premier coup d œil');

/* ---------- 5. L'espace vendeur montre la carte ---------- */
const vendor = read('src/components/VendorPage.tsx');
ok(/PULSE CHARIOW \(CONFIRMATION DES VENTES\)/.test(vendor), 'la carte a un titre, dans l\'espace vendeur');
ok(/Copier l.?[uU]RL/.test(vendor), 'l’URL se copie (une recopie à la main est ce qui casse)');
ok(/loadPulseStatus/.test(vendor) && /useEffect\(\(\) => \{ void loadPulse\(\); \}, \[\]\)/.test(vendor),
  'la sonde est lue à l’ouverture de la page, pas seulement sur clic');
const tones = (vendor.match(/const PULSE_TONE: Record<string, string> = \{([\s\S]*?)\n\};/) || [])[1] || '';
const union = (read('src/lib/pulse.ts').match(/export type PulseVerdict = ([^;]+);/) || [])[1] || '';
const verdicts = union.split('|').map(v => v.trim().replace(/'/g, '')).filter(Boolean);
ok(verdicts.length === 6, 'six verdicts dans la sonde', verdicts.join(', '));
for (const v of verdicts) ok(tones.includes("'" + v + "'"), 'chaque verdict a sa couleur : ' + v);
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(vendor.slice(vendor.indexOf('PULSE CHARIOW'), vendor.indexOf('PULSE CHARIOW') + 3000)),
  'aucun emoji dans la carte (convention du dépôt)');

/* ---------- 6. La doc dit la même chose que le code ---------- */
const readme = read('README.md');
const pulseBloc = (readme.match(/Automations → Pulses[\s\S]{0,900}/) || [''])[0];
ok(!/VOTRE-WORKER/.test(pulseBloc), 'README : le pas du Pulse donne une adresse à lire, pas un gabarit à deviner');
ok(/Carte PULSE CHARIOW/.test(readme), 'README : la carte de l’espace vendeur est documentée');
ok(/Automations → Pulses[\s\S]{0,400}\/debug[\s\S]{0,140}webhookUrl/.test(readme),
  'README : on demande l’URL au Worker, on ne la recopie pas d’un fichier');
ok(/le Pulse ne suit pas tout seul/.test(readme), 'README : après un déménagement, le Pulse est un geste à faire');
ok(/15 s\)[\s\S]{0,220}15 minutes/.test(readme) || /toutes les 15 s[\s\S]{0,300}15 minutes/.test(readme),
  'README : le filet de sécurité et son expiration sont chiffrés');
ok(/Aucun Pulse n’est jamais arrivé|Aucun Pulse n'est jamais arrivé/.test(readme) && /signature est refusée/.test(readme) && /Silence depuis/.test(readme),
  'README : les trois pannes sont écrites comme elles s’affichent');
const pkg = JSON.parse(read('package.json'));
ok(/pulse_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'npm run test:ui joue cette suite', pkg.scripts['test:ui']);

console.log(`\nPULSE CHARIOW : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
