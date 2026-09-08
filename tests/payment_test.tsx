/* ============================================================
   SUITE « FIN DE PAIEMENT » — le Worker jouée pour de vrai, sous Node.
   Un client qui appuie sur « Annuler » sur son téléphone ne laisse AUCUNE trace
   exploitable côté Chariow dans l'immédiat : la vente reste `awaiting_payment`
   (Chariow ne la marque `abandoned` que plusieurs minutes plus tard, et n'émet pas
   d'événement « annulation »). L'app, elle, affichait « PAIEMENT EN COURS » pendant
   16 minutes. Le seul signal rapide est `payment.status = cancelled` — donc c'est
   lui que le Worker regarde, et c'est ce que cette suite vérifie en important
   `backend/worker.js` et en rejouant ses routes avec un faux Chariow.
   ============================================================ */
import worker from '../backend/worker.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra: unknown = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 220) : '')); }
}
const read = (f: string) => readFileSync(process.cwd() + '/' + f, 'utf8');

/* ---------- Le harnais : KV en mémoire, Chariow à la demande ---------- */
type Rec = Record<string, unknown> & { status?: string };
let kv = new Map<string, string>();
/* Le Worker exige une clé API (sinon il ne relit pas Chariow) et un secret de Pulse (sinon
   aucune signature n'est valable). Les deux sont posés ici, en clair : ce sont des valeurs de
   test, dans un processus qui ne parle à personne. */
const PULSE_SECRET = 'whsec_test_local';
const env = {
  CHARIOW_KEY: 'sk_test_local',
  CHARIOW_PULSE_SECRET: PULSE_SECRET,
  DD_KV: {
    get: async (k: string) => (kv.has(k) ? kv.get(k)! : null),
    put: async (k: string, v: string) => { kv.set(k, v); },
    delete: async (k: string) => { kv.delete(k); },
    list: async ({ prefix }: { prefix: string }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }),
  },
};

/** Le contrat exact de Chariow : HMAC-SHA256 du corps brut, en hexadécimal, préfixé « sha256= ». */
const hmacHex = async (body: string, secret: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
};

let saleFixture: unknown = null;
let saleCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any) => {
  const u = String(url);
  if (u.includes('/v1/sales/')) {
    saleCalls += 1;
    return { ok: true, status: 200, json: async () => ({ data: saleFixture }) } as unknown as Response;
  }
  if (u.includes('/v1/checkout')) {
    return {
      ok: true, status: 200,
      json: async () => ({ data: { step: 'payment', purchase: { id: 'SAL1', status: 'awaiting_payment' }, payment: { checkout_url: 'https://checkout.example/SAL1' } } }),
    } as unknown as Response;
  }
  throw new Error('appel inattendu vers ' + u);
}) as unknown as typeof fetch;

const post = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
  const raw = JSON.stringify(body);
  const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
  if (path === '/webhook' && !h['x-chariow-signature']) {
    h['x-chariow-signature'] = 'sha256=' + await hmacHex(raw, PULSE_SECRET);
  }
  const res = await worker.fetch(new Request('https://worker.dev' + path, {
    method: 'POST', body: raw, headers: h,
  }), env, {});
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* le webhook répond « OK » en texte */ }
  return { status: res.status, json, text };
};
const seed = (purchaseId: string, rec: Rec) => { kv.set('pay:' + purchaseId, JSON.stringify(rec)); };
const rec = (purchaseId: string): Rec => JSON.parse(kv.get('pay:' + purchaseId) || 'null');
const P = 'dd_testpay0001';

/* ---------- 1. Annulé sur le téléphone : la fin doit être dite tout de suite ---------- */
try {
  kv = new Map(); saleCalls = 0;
  seed(P, { offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false });
  saleFixture = { status: 'awaiting_payment', payment: { status: 'cancelled' } };
  const r = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(r.status === 200, '/check répond 200 même quand le paiement est mort (le client doit être prévenu, pas bloqué)', r.status);
  ok(r.json && r.json.status === 'cancelled', 'la vente est déclarée « cancelled », pas laissée en attente', JSON.stringify(r.json));
  ok(r.json && r.json.ok === false, 'et ok:false : le polling du front doit s’arrêter là', String(r.json && r.json.ok));
  ok(/annul/i.test(r.json.message) && /aucun montant/i.test(r.json.message),
    'le message dit ce qui s’est passé et que rien n’a été débité', r.json.message);
  ok(r.json.paymentStatus === 'cancelled', 'le statut du paiement est renvoyé tel quel (lisible à l’écran)', r.json.paymentStatus);
  ok(rec(P).status === 'failed' && rec(P).cancelled === true, 'l’enregistrement est verrouillé en état terminal dans le KV', JSON.stringify(rec(P)));

  // Deuxième appel : plus de relecture (cache de 15 s) — mais la réponse reste « annulé ».
  const again = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(again.json.status === 'cancelled', 'un deuxième appel ne remet pas la vente « en cours »', JSON.stringify(again.json));
  ok(saleCalls === 1, 'et n’appelle Chariow qu’une fois (le filet de 15 s est respecté)', String(saleCalls));
} catch (e) { ok(false, 'cas annulé : ne doit jamais jeter', String(e)); }

/* ---------- 2. Aucun faux positif : en attente reste en attente ---------- */
try {
  kv = new Map();
  seed(P, { offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false });
  for (const payment of ['pending', 'initiated', undefined]) {
    saleFixture = { status: 'awaiting_payment', payment: payment ? { status: payment } : null };
    const r = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
    ok(r.json.ok === true && r.json.status === 'pending',
      'vente en attente + paiement ' + String(payment) + ' : on continue d’attendre, sans mentir', JSON.stringify(r.json));
    kv.set('salestatus:SAL1', '{}');   // on force la relecture au tour suivant
  }
  saleFixture = { status: 'abandoned', payment: null };
  const ab = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(ab.json.status === 'failed' && /abandon/i.test(ab.json.message), 'vente abandonnée chez Chariow = échec nommé', ab.json.message);
  saleFixture = { status: 'awaiting_payment', payment: { status: 'failed' } };
  kv.set('pay:' + P, JSON.stringify({ offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false }));
  kv.delete('salestatus:SAL1');
  const fl = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(fl.json.status === 'failed' && /op|rateur|solde/i.test(fl.json.message), 'paiement refusé par l’opérateur = échec, avec la cause', fl.json.message);
} catch (e) { ok(false, 'cas en attente / échoué : ne doit jamais jeter', String(e)); }

/* ---------- 2 bis. Annulé, puis le client se ravise et paie pour de vrai ---------- */
try {
  kv = new Map();
  seed(P, { offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false });
  saleFixture = { status: 'awaiting_payment', payment: { status: 'cancelled' } };
  const first = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(first.json.status === 'cancelled', 'annulation détectée d’abord', JSON.stringify(first.json));
  saleFixture = { status: 'completed', payment: { status: 'success' } };
  kv.delete('salestatus:SAL1');           // comme si la relecture de Chariow datait d'hier
  const back = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(back.json.ok === true && back.json.status === 'paid' && /^DD-/.test(String(back.json.code)),
    'le client qui annule puis paie sur la même page finit payé : une vente annulée n’est pas enterrée', JSON.stringify(back.json));
  ok(rec(P).delivered === true, 'et le code part une seule fois, même après ce détour', JSON.stringify(rec(P)));
} catch (e) { ok(false, 'cas annulation rétractée : ne doit jamais jeter', String(e)); }

/* ---------- 3. Payé : un seul code, même si le client rappelle dix fois ---------- */
let emitted = '';
try {
  kv = new Map();
  seed(P, { offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false });
  saleFixture = { status: 'completed', payment: { status: 'success' } };
  const r = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  emitted = String(r.json.code || '');
  ok(r.json.ok === true && r.json.status === 'paid', 'vente payée = paid', JSON.stringify(r.json));
  ok(/^DD-[A-Z0-9-]{4,}$/.test(emitted), 'le code est émis par le Worker (forme DD-…)', emitted);
  const twice = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(twice.json.code === emitted, 'et le même code est rendu : jamais deux activations pour un paiement', twice.json.code);
  const other = await post('/check', { purchaseId: P, deviceId: 'DDREF-AUTRE' });
  ok(other.json.status === 'forbidden' || other.status === 403, 'un autre appareil ne récupère pas le code', JSON.stringify(other.json));
  const logged = JSON.parse(kv.get('log:check') || 'null');
  ok(logged && logged.at && logged.status === 'paid', 'le relevé est journalisé (/debug → lastCheck)', JSON.stringify(logged));
} catch (e) { ok(false, 'cas payé : ne doit jamais jeter', String(e)); }

/* ---------- 4. Le Pulse, quand il fonctionne, doit donner la même fin ---------- */
try {
  kv = new Map();
  seed(P, { offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false });
  saleFixture = { status: 'completed', payment: { status: 'success' } };
  const w = await post('/webhook', { event: 'successful.sale', sale: { id: 'SAL1', status: 'completed', custom_metadata: { purchaseId: P, deviceId: 'DDREF-TEST' } } });
  ok(w.status === 200, 'un Pulse correctement signé est accepté (HMAC du corps brut)', w.status);
  const bad = await post('/webhook', { event: 'successful.sale', sale: { id: 'SAL1', custom_metadata: { purchaseId: P } } }, { 'x-chariow-signature': 'sha256=' + '0'.repeat(64) });
  ok(bad.status === 401, 'et un Pulse à la signature fausse est rejeté (sinon n’importe qui activerait des offres)', bad.status);
  ok(rec(P).status === 'paid', 'la vente bascule en paid par le webhook aussi', JSON.stringify(rec(P)));
  const c = await post('/check', { purchaseId: P, deviceId: 'DDREF-TEST' });
  ok(c.json.code === rec(P).code, 'et le client reçoit par /check le code que le Pulse a déclenché', c.json.code);

  kv = new Map();
  seed(P, { offer: 'MONTHLY', deviceId: 'DDREF-TEST', saleId: 'SAL1', status: 'pending', createdAt: Date.now(), delivered: false });
  await post('/webhook', { event: 'failed.sale', sale: { id: 'SAL1', status: 'failed', custom_metadata: { purchaseId: P } } });
  ok(rec(P).status === 'failed', 'failed.sale marque la vente perdue (et non « payée »)', JSON.stringify(rec(P)));
  ok(Number(JSON.parse(kv.get('log:webhook:count') || '0')) === 1, 'compteur de délivrances incrémenté (la carte Pulse le lit)', kv.get('log:webhook:count'));

  // Un paymentId inconnu ne doit pas faire croire à une livraison.
  const orphan = await post('/webhook', { event: 'successful.sale', sale: { id: 'SAL999', custom_metadata: { purchaseId: 'dd_inconnu' } } });
  ok(orphan.status === 200 && /inconnu/.test(String(JSON.parse(kv.get('log:webhook:last') || '{}').action)),
    'une vente inconnue est journalisée, jamais activée', kv.get('log:webhook:last'));
} catch (e) { ok(false, 'cas webhook : ne doit jamais jeter', String(e)); }

/* ---------- 5. /debug doit montrer la fin, pas seulement le début ---------- */
try {
  const d = await worker.fetch(new Request('https://worker.dev/debug', { method: 'GET' }), env, {});
  const dj = await d.json() as any;
  ok(dj.ok === true, '/debug répond (la carte Pulse du #/vendeur en dépend)');
  ok(dj.debug.lastWebhook && typeof dj.debug.lastWebhook.at === 'string', '/debug expose la dernière délivrance', JSON.stringify(dj.debug.lastWebhook));
  ok(dj.debug.pendingPayments && dj.debug.pendingPayments.length === 1,
    'et la liste des ventes encore en attente (ce qui reste à surveiller)', JSON.stringify(dj.debug.pendingPayments));
} catch (e) { ok(false, 'cas /debug : ne doit jamais jeter', String(e)); }

/* ---------- 6. Côté application : l'écran doit suivre ---------- */
const paywall = read('src/components/PaywallModal.tsx');
ok(/data\.status === 'cancelled'/.test(paywall), 'le front reconnaît « cancelled » comme une fin de paiement');
ok(/setAutoState\('cancelled'\)/.test(paywall), 'et bascule sur un état « annulé » (ni erreur rouge, ni attente)');
ok(/J\\u2019AI ANNULÉ LE PAIEMENT/.test(paywall), 'le client peut l’annoncer lui-même : bouton pendant l’attente');
ok(/RECOMMENCER LE PAIEMENT/.test(paywall), 'et repartir d’ici, sans recharger la page');
ok(/removeItem\('dd_last_purchase'\)/.test(paywall), 'la référence annulée est oubliée (pas de reprise d’un paiement mort)');
ok(/setPayStatus\(data\.paymentStatus \|\| null\)/.test(paywall), 'le statut du paiement sur le téléphone est affiché, pas seulement celui de la vente');
ok(/document\.addEventListener\('visibilitychange'/.test(paywall), 'le retour sur l’onglet relit le statut tout de suite (pas 5 s plus tard)');
ok(!/setInterval[\s\S]{0,400}16 minutes/.test(paywall) || /pollTries\.current > 192/.test(paywall),
  'le garde-fou de 16 minutes existe toujours, mais n’est plus la seule sortie');
const flat = paywall.replace(/\s+/g, ' ');
ok(/typeof document === 'undefined'/.test(flat), 'et le listener est gardé : un rendu sans DOM ne plante pas');
const workerSrc = read('backend/worker.js');
ok(/payment\.status/.test(workerSrc) && /cancelled/.test(workerSrc), 'le Worker lit bien payment.status (la seule trace immédiate d’une annulation)');
ok(!/realStatus === 'completed' \|\| realStatus === 'settled'/.test(workerSrc),
  'plus de comparaison de statut éparpillée : un seul jugement, saleOutcome()');
const pkg = JSON.parse(read('package.json'));
ok(/payment_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'npm run test:ui joue cette suite', pkg.scripts['test:ui']);

/* ---------- 7. Ce qui est écrit, à l'écran comme dans la doc ---------- */
const readme = read('README.md');
ok(/annul/i.test(readme) && /16 minutes|en cours/i.test(readme), 'README : l’annulation côté téléphone est documentée avec son symptôme');
ok(/payment\.status|cancelled/.test(readme), 'README : la source du signal (payment.status) est nommée');

globalThis.fetch = realFetch;
console.log(`\nFIN DE PAIEMENT : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
