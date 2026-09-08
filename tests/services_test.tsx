/* ============================================================
   SUITE « CARNET DE PRESTATIONS » — les lignes qui reviennent d'un devis à l'autre.
   ------------------------------------------------------------
   Ce qui est tenu ici : le carnet apprend (sans doublon, sans polluer avec les
   libellés par défaut, sans compter les sauvegardes automatiques), il se tait quand
   le stockage est saturé, il voyage dans la sauvegarde JSON, et l'écran montre
   exactement ce que le store contient. Les astérisques du mur de paiement sont joués
   dans la même suite : c'est la même obsession — ne pas laisser l'utilisateur
   deviner ce qu'on attend de lui.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createDefaultDoc, saveDoc, loadServices, rememberService, deleteService,
  learnServices, normServiceLabel, normalizeService, SERVICE_MAX, exportAllData, importAllData,
} from '../src/store';
import { QuoteItem } from '../src/types';
import { ServiceStar, ServicesPicker } from '../src/components/ServicesPicker';
import PaywallModal from '../src/components/PaywallModal';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra: unknown = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== '' ? '  << ' + String(extra).slice(0, 220) : '')); }
}
const src = (f: string) => readFileSync(process.cwd() + '/' + f, 'utf8');
const flat = (f: string) => src(f).replace(/\s+/g, ' ');
const line = (description: string, unitPrice = 0, id = Math.random().toString(36).slice(2, 9)): QuoteItem =>
  ({ id, description, quantity: 1, unitPrice });

localStorage.clear();

/* ---------- 1. Le carnet apprend, et il apprend bien ---------- */
const LOGO = 'Création de logo — 3 propositions';
const d1 = createDefaultDoc({ items: [line(LOGO, 120000, 'a'), line('Nouvelle prestation', 0, 'b'), line('   ', 5, 'c')] });
saveDoc(d1);
let svc = loadServices();
ok(svc.length === 1, 'une seule ligne mémorisée : le libellé par défaut et le vide sont ignorés', JSON.stringify(svc.map(s => s.label)));
ok(svc[0].label === LOGO && svc[0].unitPrice === 120000, 'intitulé et prix viennent du document', JSON.stringify(svc[0]));
ok(svc[0].uses === 1, 'et l’usage compte ce document', svc[0].uses);

const before = localStorage.getItem('devis_designer_services');
saveDoc(d1); saveDoc(d1); saveDoc(d1);   // l'autosave, trois fois
ok(localStorage.getItem('devis_designer_services') === before, 'réenregistrer le même devis n’écrit rien : l’apprentissage est idempotent');
ok(loadServices()[0].uses === 1, 'et ne compte pas trois usages pour un seul devis', loadServices()[0].uses);

const d2 = createDefaultDoc({ items: [line('  création   de logo — 3 propositions ', 80000, 'z')] });
saveDoc(d2);
svc = loadServices();
ok(svc.length === 1, 'la casse et les espaces ne créent pas de doublon', JSON.stringify(svc.map(s => s.label)));
ok(svc[0].uses === 2, 'le deuxième document est compté', svc[0].uses);
ok(svc[0].unitPrice === 80000, 'et le prix suit la dernière fois où la ligne a été posée', svc[0].unitPrice);
ok(svc[0].label === LOGO, 'l’affichage garde le premier texte saisi, pas la version normalisée', svc[0].label);
ok(normServiceLabel('  A   B ') === 'a b' && normServiceLabel(null) === '', 'la normalisation est celle annoncée');
ok(learnServices([], d2.id) === 0 && learnServices(undefined as never, d2.id) === 0, 'aucune ligne à apprendre : aucune écriture, aucune exception');

/* ---------- 2. À la main, ça marche aussi (et ça le dit) ---------- */
const r1 = rememberService('Charte graphique (PDF, 12 pages)', 180000);
ok(r1.ok === true && r1.added === true && /mémorisée/.test(r1.message), 'mémoriser à la main : le message confirme et nomme la ligne', r1.message);
const r2 = rememberService('charte graphique (pdf, 12 pages) ', 200000);
ok(r2.ok === true && r2.added === false && r2.priceChanged === true && /mis à jour/.test(r2.message), 're-mémoriser le même intitulé met le prix à jour au lieu de doubler', r2.message);
const r3 = rememberService('Charte graphique (PDF, 12 pages)', 200000);
ok(r3.priceChanged === false && /déjà mémorisée/.test(r3.message), 'et au troisième coup, c’est dit tel quel', r3.message);
ok(rememberService('   ', 100).ok === false && rememberService('Nouvelle prestation', 100).ok === false,
  'les deux cas qu’on refuse : vide et libellé par défaut');
const kept = loadServices().length;
deleteService(loadServices().find(s => normServiceLabel(s.label).includes('charte'))!.id);
ok(loadServices().length === kept - 1, 'une habitude se retire du carnet');

/* ---------- 3. Plafond et stockage hostile ---------- */
learnServices(Array.from({ length: SERVICE_MAX + 12 }, (_, i) => line('Prestation ' + (i + 1), i)), 'doc-plafond');
svc = loadServices();
ok(svc.length === SERVICE_MAX, 'le carnet est plafonné, il ne grossit pas à l’infini', svc.length);
ok(svc.every((x, i) => i === 0 || svc[i - 1].uses >= x.uses), 'et trié par usage décroissant (les habitudes d’abord)');
localStorage.setItem('devis_designer_services', '[{"label":42},{"label":"ok","unitPrice":"beaucoup"},{"nope":1},null,[]]');
svc = loadServices();
ok(svc.length === 1 && svc[0].label === 'ok' && svc[0].unitPrice === 0, 'un stockage n’importe quoi devient une liste propre, jamais une page blanche', JSON.stringify(svc));
localStorage.setItem('devis_designer_services', '{ ceci n’est pas du json');
ok(loadServices().length === 0, 'et une valeur illisible se lit « carnet vide »');
ok(normalizeService(undefined) === null && normalizeService({ label: 'Nouvelle prestation' }) === null && normalizeService({ label: 'x'.repeat(500) })!.label.length === 100,
  'normalizeService filtre, borne et ne tranche pas un intitulé en deux');
localStorage.clear();

/* ---------- 4. La sauvegarde JSON emporte le carnet ---------- */
saveDoc(createDefaultDoc({ items: [line(LOGO, 120000, 'k1'), line('Impression 500 cartes de visite', 75000, 'k2')] }));
const backup = exportAllData();
ok(backup.version === 4, 'version 4 : le carnet a sa place dans le fichier', backup.version);
ok(Array.isArray(backup.services) && backup.services!.length === 2, 'les deux lignes y sont', JSON.stringify(backup.services));
localStorage.clear();
const back = importAllData(JSON.stringify(backup), 'replace');
ok(back.ok === true && /2 prestation\(s\) mémorisée\(s\) restaurée\(s\)/.test(back.message), 'la restauration le dit dans le message', back.message);
ok(loadServices().length === 2 && loadServices().some(s => s.unitPrice === 75000), 'carnet reconstitué à l’identique (tarifs compris)');
localStorage.setItem('devis_designer_services', JSON.stringify([{ id: 'x', label: LOGO, unitPrice: 999000, docs: ['local'], uses: 7, lastAt: Date.now() }]));
const merged = importAllData(JSON.stringify({ app: 'devis-designer', version: 3, docs: [], clients: [], services: backup.services }), 'merge');
ok(/1 prestation\(s\) mémorisée\(s\) ajoutée\(s\) au carnet/.test(merged.message), 'en fusion, seule la ligne nouvelle est comptée', merged.message);
ok(loadServices().find(s => normServiceLabel(s.label) === normServiceLabel(LOGO))!.unitPrice === 999000,
  'un tarif local n’est JAMAIS écrasé par une copie plus ancienne', JSON.stringify(loadServices().map(s => s.unitPrice)));
const old = importAllData(JSON.stringify({ app: 'devis-designer', version: 2, docs: [], clients: [] }), 'replace');
ok(old.ok === true && loadServices().length === 2 && /Prestations du carnet conservées/.test(old.message),
  'une copie d’avant la fonction ne vide pas le carnet, et le dit', old.message);
localStorage.clear();

/* ---------- 5. L'écran montre ce que le store contient ---------- */
const empty = renderToStaticMarkup(<ServicesPicker services={[]} curShort="F" onPick={() => { }} onChange={() => { }} dark={false} accent="#0057FF" />);
ok(/MES PRESTATIONS MÉMORISÉES · 0/.test(empty), 'carnet vide : le compteur est à zéro, pas caché');
ok(/Enregistrez un devis/.test(empty), 'et la première phrase dit comment il se remplit');
const two = [
  { id: '1', label: LOGO, unitPrice: 120000, docs: ['a', 'b'], uses: 2, lastAt: 1 },
  { id: '2', label: 'Charte graphique', unitPrice: 180000, docs: ['a'], uses: 1, lastAt: 2 },
];
const html = renderToStaticMarkup(<ServicesPicker services={two} curShort="F" onPick={() => { }} onChange={() => { }} dark={false} accent="#0057FF" />);
ok(html.includes(LOGO) && /120[\s\u202f ]000/.test(html), 'les libellés et les prix formatés sont bien affichés', html.slice(0, 120));
ok(/×2/.test(html), 'le compteur d’usage se voit (×2 = posée sur deux documents)');
ok(/aria-label="Retirer [\s\S]{0,80} du carnet"/.test(html), 'chaque pastille a son bouton de retrait nommé pour le lecteur d’écran');
ok(!/Filtrer/.test(html), 'pas de champ de filtre pour deux lignes : il n’apparaît qu’à partir de six');
const many = renderToStaticMarkup(<ServicesPicker services={Array.from({ length: 9 }, (_, i) => ({ id: 'i' + i, label: 'Prestation ' + i, unitPrice: i, docs: [], uses: 0, lastAt: i }))} curShort="F" onPick={() => { }} onChange={() => { }} dark accent="#0057FF" />);
ok(/VOIR LES 9/.test(many) && /Filtrer/.test(many), 'au-delà de huit pastilles, on peut tout voir et filtrer');
ok((many.match(/aria-label="Retirer/g) || []).length === 8, 'huit pastilles d’office : les suivantes attendent le clic « VOIR LES 9 »', (many.match(/aria-label="Retirer/g) || []).length);

const starOff = renderToStaticMarkup(<ServiceStar label="Ligne neuve" unitPrice={100} services={[]} dark={false} accent="#0057FF" onChange={() => { }} />);
ok(/MÉMORISER/.test(starOff), 'ligne inconnue du carnet : on propose de la mémoriser');
const starOn = renderToStaticMarkup(<ServiceStar label={LOGO} unitPrice={120000} services={two} dark={false} accent="#0057FF" onChange={() => { }} />);
ok(/✓ MÉMORISÉE/.test(starOn) && /sur 2 document/.test(starOn), 'ligne déjà au carnet au bon prix : c’est écrit, et l’usage apparaît dans l’info-bulle', starOn);
const starDiff = renderToStaticMarkup(<ServiceStar label={LOGO} unitPrice={90000} services={two} dark={false} accent="#0057FF" onChange={() => { }} />);
ok(/PRIX À 90[\s\u202f ]000/.test(starDiff), 'prix différent de celui du carnet : le bouton le dit et propose l’écart', starDiff);

/* ---------- 6. Le branchage est réel dans l'éditeur ---------- */
const app = flat('src/App.tsx');
ok(/learnServices\(updated\.items, updated\.id\)/.test(src('src/store.ts').replace(/\s+/g, ' ')), 'store.ts : saveDoc apprend les lignes, tous les chemins d’enregistrement passent par là');
ok(/setServices\(\[\]\)|useState<SavedService\[\]>\(\(\) => loadServices\(\)\)/.test(app), 'App.tsx : le carnet est lu depuis le stockage, pas recopié d’un état voisin');
ok(/useEffect\(\(\) => \{ if \(page === 'editor' && tab === 3\) setServices\(loadServices\(\)\)/.test(app), 'et il se relit à l’ouverture de l’onglet Prestations (pas toutes les 3 s)');
ok(/onPick=\{applyService\}/.test(app) && /ServicesPicker services=\{services\}/.test(app), 'un tap sur une pastille pose la ligne dans le devis');
ok(/isFree\(it\.description\)/.test(app) && /items\[i\] = \{ \.\.\.items\[i\], description: s\.label, unitPrice: s\.unitPrice \}/.test(app),
  'la premiere ligne vide est remplie avant d’en ajouter une');
ok((app.match(/<ServicesDatalist/g) || []).length === 1, 'une seule liste d’autocomplétion dans le DOM (deux id égaux seraient invalides)');
ok((app.match(/list="dd-services"/g) || []).length === 2, 'les deux panneaux de saisie pointent dessus (onglet et tiroir mobile)');
ok(/<ServiceStar label=\{item\.description\} unitPrice=\{item\.unitPrice\}/.test(app), 'l’étoile est bien par ligne, branchée sur le prix saisi');

/* ---------- 7. Le mur de paiement marque ce qui est obligatoire ---------- */
const paywall = src('src/components/PaywallModal.tsx');
ok(/aria-required="true"/.test(paywall), 'les trois champs sont marqués requis pour le lecteur d’écran');
ok(/required aria-required="true" aria-invalid=/.test(paywall), 'et l’invalidité n’est annoncée qu’après un essai');
ok(/text-red-500">\*<\/b>/.test(paywall), 'l’astérisque est visible, rouge, collé à l’étiquette');
ok(/dd-pay-name|dd-pay-phone|dd-pay-email/.test(paywall) && /getElementById\(id\)/.test(paywall),
  'le curseur part dans le premier champ manquant (pas de message qui tombe à côté du problème)');
ok(/Il manque /.test(paywall) && /8 chiffres minimum/.test(paywall), 'et l’erreur nomme ce qui manque, avec la règle du numéro');
const form = renderToStaticMarkup(<PaywallModal open onClose={() => { }} />);
ok((form.match(/aria-required="true"/g) || []).length === 3, 'à l’écran : trois champs, trois astérisques', (form.match(/aria-required/g) || []).length);
ok(/Les trois champs marqués/.test(form) && /obligatoires/.test(form), 'la légende est lisible avant le premier clic');
ok((form.match(/text-red-500"> \*</g) || []).length === 3, 'à l’écran : trois étiquettes, trois astérisques rouges', (form.match(/text-red-500"> \*/g) || []).length);
ok(/>Nom<|>N° Mobile Money<|>Email</.test(form) || /Nom<\/b>|\bNom\b/.test(form), 'les étiquettes ne se contentent plus du seul placeholder');

/* ---------- 8. Ce qui est écrit autour (landing, FAQ, doc) ---------- */
const landing = src('src/components/LandingPage.tsx');
ok(!/Paiement Mobile Money en ligne/.test(landing), 'landing : la pastille retirée sur demande du propriétaire ne revient pas');
ok(!/tone="green"/.test(landing), 'et sa couleur n’est plus utilisée nulle part sur la page');
ok(/20 exports offerts|exports offerts/.test(landing) && /Aucune installation/.test(landing), 'les deux pastilles qui restent sont intactes');
ok(/vos prestations reviennent d’un document à l’autre/.test(landing), 'landing : le carnet est annoncé, comme il fonctionne');
const faq = flat('src/components/FAQModal.tsx');
ok(/Mes prestations habituelles sont-elles gardées quelque part/.test(faq), 'FAQ : la question a son entrée');
ok(/MÉMORISER/.test(faq) && /80 lignes/.test(faq) && /copie JSON/.test(faq),
  'FAQ : le bouton, le plafond et le voyage dans la sauvegarde sont écrits');
const readme = src('README.md');
ok(/## Carnet de prestations/.test(readme) && /devis_designer_services/.test(readme), 'README : une section dédiée et la clé de stockage nommée');
ok(/SERVICE_MAX` = 80/.test(readme), 'README : le plafond est documenté à la valeur du code');
const pkg = JSON.parse(src('package.json'));
ok(/services_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'npm run test:ui joue cette suite', pkg.scripts['test:ui']);

console.log(`\nCARNET DE PRESTATIONS : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
