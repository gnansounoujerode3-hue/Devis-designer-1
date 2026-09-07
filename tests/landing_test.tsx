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
import { readFileSync } from 'node:fs';
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

console.log(`\nPAGE D'ACCUEIL : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
