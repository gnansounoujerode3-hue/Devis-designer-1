/* ============================================================
   SUITE « PAGE D'ACCUEIL » — ce qui est promis doit exister
   ------------------------------------------------------------
   Deux familles de contrôles :
     1. RENDU : la landing se rend hors du navigateur, sans planter, sans
        valeur cassée (undefined, NaN), avec les chiffres de l'application.
     2. SOURCES : les phrases interdites (fonctionnement hors-ligne,
        téléchargement, témoignages et étoiles inventés, ancien forfait de
        3 mois, avoir) n'apparaissent nulle part ; aucun emoji ; les prix,
        le quota et le nombre de modèles viennent des constantes du code,
        jamais recopiés à la main.
   La règle de fond : on ne promet que ce que le code fait.
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPage from '../src/components/LandingPage';
import { APP_VERSION } from '../src/lib/config';
import { FREE_EXPORT_LIMIT, PRICE_ALL, PRICE_ANNUAL, PRICE_CUSTOM_DESIGN, PRICE_MONTHLY } from '../src/lib/license';
import { TEMPLATES } from '../src/templates';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 170) : '')); }
}
const root = process.cwd();
const src = (f: string) => root + '/' + f;
const LANDING = readFileSync(src('src/components/LandingPage.tsx'), 'utf8');
/** Texte rendu, espaces normalisées pour que les regex tiennent compte du JSX. */
const html = renderToStaticMarkup(<LandingPage />);
const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

/* ---------- 1. Le rendu ---------- */
ok(html.length > 8000, 'la page se rend (' + Math.round(html.length / 1000) + ' ko de HTML)');
ok(!/undefined|NaN|\[object Object\]/.test(text), 'aucune valeur cassée dans le texte');
ok(/Devis Designer/.test(text) && /devis/i.test(text) && /facture/i.test(text), 'le produit et les deux documents');
ok(text.includes(APP_VERSION), 'le pied de page cite la version courante (' + APP_VERSION + ')');

/* ---------- 2. Les chiffres viennent du code ---------- */
const nb = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
for (const [label, n] of [['les exports offerts', FREE_EXPORT_LIMIT], ['le mensuel', PRICE_MONTHLY], ['l’annuel', PRICE_ANNUAL], ['le design', PRICE_CUSTOM_DESIGN]] as Array<[string, number]>) {
  ok(text.includes(nb(n)) || text.includes(String(n)), label + ' (' + nb(n) + ') est affiché');
}
ok(text.includes(String(TEMPLATES.length)) || text.includes(nb(TEMPLATES.length)), TEMPLATES.length + ' modèles annoncés');
ok(!/1 900|1900 F|12 000|3 000 F|2 500 F/.test(text), 'aucun prix périmé recopié à la main');
const types = readFileSync(src('src/types.ts'), 'utf8');
ok(/export type DocType = 'devis' \| 'facture';/.test(types), 'l’app ne fait que devis et facture (types.ts)');
ok(!/avoir/i.test(text), 'il n’est jamais question d’un avoir sur la page');

/* ---------- 3. Phrases interdites (dans la source, pas que le rendu) ---------- */
const noComments = LANDING.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
for (const forbidden of ['Télécharger', 'télécharger l’application', '3 mois offerts', 'mois gratuits', 'témoignage', '★', '★★★★★', 'avis vérifiés']) {
  ok(!noComments.includes(forbidden), 'absent : « ' + forbidden + ' »');
}
/* Le hors-ligne : interdit de le PROMETTRE, obligatoire de le SIGNALER. Donc chaque
   mention doit être dans une phrase négative (« il faut une connexion », « ne
   fonctionne pas hors connexion »). Une page qui dirait « marche hors-ligne » fait
   échouer la suite. */
const OFF = ['hors-ligne', 'hors ligne', 'hors connexion', 'sans connexion', 'sans internet', 'offline'];
for (const f of ['src/components/LandingPage.tsx', 'src/components/FAQModal.tsx', 'README.md']) {
  const body = readFileSync(src(f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const bad = OFF.flatMap(o => {
    const out: string[] = [];
    const low = body.toLowerCase();
    for (let i = low.indexOf(o); i >= 0; i = low.indexOf(o, i + 1)) {
      /* Autour de la mention : une phrase qui parle du hors-ligne pour dire qu'il
         n'existe PAS contient toujours une négation ou une condition. */
      const win = body.slice(Math.max(0, i - 160), i + 200).replace(/\s+/g, ' ');
      /* Négation ou condition toute proche = on le signale, on ne le promet pas. */
      if (!/\bpas\b|\baucun|\bjamais\b|\bil faut\b|\bexige\b|\bbesoin\b|\bni \b/i.test(win)) out.push(win.slice(0, 120));
    }
    return out;
  });
  ok(bad.length === 0, 'aucun faux argument hors-ligne dans ' + f, bad.join(' | ').slice(0, 150));
  ok(!/fonctionne (même )?(partout|sur tous les appareils)/.test(body), 'aucune promesse de marche partout dans ' + f);
}
ok(/connexion internet pour l’ouvrir|il faut une connexion/.test(noComments), 'la landing dit la vérité : une connexion est nécessaire');
/* Chaque lien interne doit tomber sur une section qui existe. */
const anchors = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
const internal = [...html.matchAll(/ href="#([^"]*)"/g)].map(m => m[1]);
ok(internal.every(a => anchors.has(a)), (internal.length ? 'les ' + internal.length + ' liens internes pointent une section existante' : 'aucun lien d’ancrage (donc aucun mort)'), JSON.stringify(internal.filter(a => !anchors.has(a))));
ok(!/href="#features"/.test(noComments), 'pas de href="#features" hérité d’un modèle de page');
const cfg = readFileSync(src('src/lib/config.ts'), 'utf8');
for (const k of ['WHATSAPP', 'PHONE']) ok(cfg.includes(k), 'config fournit ' + k);
ok(/VENDOR\.WHATSAPP|VENDOR\.PHONE/.test(noComments), 'le contact vient de la configuration');

/* ---------- 4. Pas d'emojis sur la page d'accueil ---------- */
const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
ok(!emoji.test(noComments), 'aucun emoji dans la source de la landing');
ok(!emoji.test(text), 'aucun emoji dans la page rendue');

/* ---------- 5. Le design sur mesure, décrit correctement ---------- */
ok(/importer/i.test(text) && /fichier/i.test(text), 'il est dit que le design s’importe en fichier');
ok(!/\.tsx\s*(à|a) importer|importez? le \.tsx/i.test(text), 'on ne promet pas d’importer du .tsx dans le navigateur');
ok(/Design personnalisé/.test(text), 'l’offre « Design personnalisé » figure dans la grille');
const card = readFileSync(src('src/components/CustomDesignCard.tsx'), 'utf8');
ok(/Importer mon design/.test(card), 'le bouton « Importer mon design » existe bien dans l’app');
ok(/\.dddesign\.js/.test(card), 'la carte client nomme le format reçu du vendeur');
ok(readFileSync(src('src/templates/index.ts'), 'utf8').includes('allTemplates'), 'les modèles affichés viennent du registre réel de l’app');

/* ---------- 6. Le HTML de la page (t\u00eate + JSON-LD) et les CGU ---------- */
const head = readFileSync(src('index.html'), 'utf8');
const ldRaw = /application\/ld\+json">([\s\S]*?)<\/script>/.exec(head);
ok(!!ldRaw, 'index.html porte un bloc JSON-LD');
if (ldRaw) {
  const ld = JSON.parse(ldRaw[1]) as { offers?: Array<{ name: string; price: string; priceCurrency: string }> };
  const prices = (ld.offers || []).map(o => Number(o.price)).sort((a, b) => a - b);
  const real = [0, PRICE_MONTHLY, PRICE_ANNUAL, PRICE_CUSTOM_DESIGN, PRICE_ALL].sort((a, b) => a - b);
  ok(JSON.stringify(prices) === JSON.stringify(real), 'les prix annonc\u00e9s aux moteurs sont les prix r\u00e9els', JSON.stringify(prices));
  ok((ld.offers || []).every(o => o.priceCurrency === 'XOF'), 'devise XOF partout');
}
ok(head.includes(TEMPLATES.length + ' mod\u00e8les'), 'la description m\u00e9ta cite le vrai nombre de mod\u00e8les');
const cgu = readFileSync(src('src/components/LegalModal.tsx'), 'utf8');
const designClause = cgu.slice(cgu.indexOf('Design personnalis'), cgu.indexOf('Design personnalis') + 700);
ok(/5 000 F CFA/.test(designClause) && /1 mois d'exports illimit\u00e9s/.test(designClause), 'les CGU disent ce que le design inclut');
ok(/importer|importe/.test(designClause) && /6 designs/.test(designClause), 'les CGU d\u00e9crivent la livraison par fichier et la limite');
ok(!/\.tsx/.test(designClause), 'les CGU ne promettent pas d\u2019ex\u00e9cuter du .tsx');

/* ---------- 7. La vignette de partage (WhatsApp & cie) ---------- */
/* Sans og:image à URL absolue, un lien partagé part SANS VISUEL. Autant le tenir
   sous verrou : l'URL, le fichier, ses dimensions réelles et la cohérence domaine. */
const meta = (prop: string) => new RegExp(`(?:property|name)="${prop}" content="([^"]*)"`).exec(head)?.[1] || '';
const og = meta('og:image');
ok(/^https:\/\/\S+\.png$/.test(og), 'og:image est une URL absolue en .png', og);
ok(!!og && new URL(og).origin === new URL(meta('og:url') || 'https://devisdesigner.netlify.app/').origin,
   'la vignette est servie sur le même domaine que le site', og + ' vs ' + meta('og:url'));
const ogFile = 'public/' + (og ? new URL(og).pathname.replace(/^\//, '') : 'og-image.png');
ok(existsSync(src(ogFile)), 'le fichier existe dans ' + ogFile + ' (Vite le recopie dans dist/)');
if (existsSync(src(ogFile))) {
  const buf = readFileSync(src(ogFile));
  ok(buf.slice(1, 4).toString('latin1') === 'PNG', 'c’est bien un PNG (les réseaux ne lisent pas le SVG)');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  ok(w === 1200 && h === 630, 'dimensions réelles 1200×630', w + '×' + h);
  ok(Number(meta('og:image:width')) === w && Number(meta('og:image:height')) === h, 'les dimensions déclarées sont les vraies');
  ok(/content="image\/png"/.test(head), 'og:image:type déclaré');
  ok(buf.length < 400_000, 'poids sous 400 ko (' + Math.round(buf.length / 1000) + ' ko)');
}
ok(meta('twitter:card') === 'summary_large_image', 'twitter:card en grand visuel');
/* la règle de vérité vaut aussi pour l'en-tête HTML */
for (const forbidden of ['hors-ligne', 'hors ligne', 'sans connexion', 'T\u00e9l\u00e9charger', '★', '★★★★★']) {
  ok(!head.includes(forbidden), 'head : absent « ' + forbidden + ' »');
}
ok(/connexion/.test(meta('og:description')) || /connexion/.test(meta('description')),
   'le texte partagé dit qu’une connexion est nécessaire');

/* ---------- 8. Le chemin de paiement, tel qu'il est vraiment codé ---------- */
/* Le client qui lit la page doit trouver la MÊME chose que dans l'app : caisse
   Chariow d'abord (activation automatique), numéro du vendeur ensuite, à titre
   de secours uniquement. Tout ce qui est affirmé ici est vérifié dans le code. */
ok(/Chariow/.test(text), 'la page nomme la caisse Chariow');
ok(!/Où acheter/.test(text) && /Comment payer/.test(text), 'la carte ne dit plus « Où acheter » mais « Comment payer »');
ok(/activation automatique|s'active toute seule|s’active toute seule/.test(text), 'il est dit que l\u2019offre s\u2019active toute seule');
ok(/aucun code \u00e0 recopier|aucun code \u00e0 taper/.test(text), 'et qu\u2019il n\u2019y a pas de code \u00e0 recopier dans le chemin normal');
const pw = readFileSync(src('src/components/PaywallModal.tsx'), 'utf8');
const app = readFileSync(src('src/App.tsx'), 'utf8');
ok(/activation auto/.test(pw), 'l’app appelle bien le bouton « Payer \u2026 activation auto »');
ok(/AUTO_PAY_WORKER_URL/.test(pw) && /\/checkout/.test(pw), 'l’app ouvre la vente via le Worker (/checkout)');
const worker = readFileSync(src('backend/worker.js'), 'utf8');
ok(/api\.chariow\.com\/v1\/checkout/.test(worker), 'le Worker cr\u00e9e bien la vente Chariow');
ok(/<OfferId|'DESIGN'/.test(worker) && /kind === 'DESIGN'/.test(worker), 'le Worker conna\u00eet l\u2019offre DESIGN promise par la page');
ok(/\u00ab PRO \u00bb|>PRO</.test(app), 'le bouton « PRO » cit\u00e9 par la page existe dans l’app');
/* le num\u00e9ro du vendeur ne doit JAMAIS \u00eatre pr\u00e9sent\u00e9 comme le moyen normal de payer */
const phoneIdx = noComments.indexOf('VENDOR.PHONE');
ok(phoneIdx >= 0, 'la page cite toujours le num\u00e9ro du vendeur (secours)');
if (phoneIdx >= 0) {
  const around = noComments.slice(Math.max(0, phoneIdx - 420), phoneIdx + 220).replace(/\s+/g, ' ');
  ok(/secours|ne r\u00e9pond pas|injoignable/.test(around), 'le num\u00e9ro est encadr\u00e9 par la mention « secours »', around.slice(0, 180));
}
/* entrée de FAQ sur le paiement : la caisse doit être décrite AVANT le numéro du vendeur */
const landingSrc = readFileSync(src('src/components/LandingPage.tsx'), 'utf8');
const payFaq = /Comment ça se passe pour payer[^\n]*/.exec(landingSrc)?.[0] || '';
ok(payFaq.length > 60, 'la page garde une entrée de FAQ sur le paiement');
ok(/Chariow/.test(payFaq) && payFaq.indexOf('Chariow') < payFaq.indexOf('vendeur'), 'la FAQ de la page met la caisse avant le paiement direct', payFaq.slice(0, 150));
ok(/FAQ s\u00e9curis\u00e9e Chariow|caisse s\u00e9curis\u00e9e Chariow/.test(readFileSync(src('src/components/FAQModal.tsx'), 'utf8')), 'la FAQ dans l’app dit la m\u00eame chose (caisse Chariow)');

console.log(`\nPAGE D'ACCUEIL : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
