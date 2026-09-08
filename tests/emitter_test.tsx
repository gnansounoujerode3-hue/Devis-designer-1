/* ============================================================
   SUITE « FICHE ÉMETTEUR » — comme pour les clients, l'en-tête du document
   s'enregistre et se réutilise : pré-remplissage des nouveaux documents,
   carnet (mise à jour sur place, fiche par défaut, suppression), repli de
   quota quand le logo est trop lourd, voyage dans la sauvegarde JSON, et les
   textes promis à l'écran. Lancée par tests/run.mjs (shim localStorage).
   ============================================================ */
import { readFileSync } from 'node:fs';
import {
  createDefaultDoc, defaultEmitter, deleteEmitter, exportAllData, getDefaultEmitterId,
  importAllData, loadEmitters, saveEmitter, setDefaultEmitter,
} from '../src/store';
import type { SavedEmitter } from '../src/types';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 190) : '')); }
}

const root = process.cwd();
const src = (f: string) => readFileSync(root + '/' + f, 'utf8');
const flat = (f: string) => src(f).replace(/\s+/g, ' ');

const fiche = (over: Partial<SavedEmitter> = {}): SavedEmitter => ({
  id: 'A1', label: 'Atelier Koffi', name: 'Atelier Koffi', title: 'Designer graphique',
  email: 'contact@koffi.cm', phone: '+237 6 99 00 00 01', address: 'Rue 1.802, Douala',
  siret: '123 456 789', logo: '', ...over,
});

/* ---------- 1. Sans carnet, rien ne change (pas de régression) ---------- */
localStorage.clear();
ok(loadEmitters().length === 0, 'premier lancement : le carnet est vide');
ok(defaultEmitter() === null, 'aucune fiche par défaut');
let d = createDefaultDoc();
ok(d.designerName === '' && d.designerLogo === '', 'en-tête laissé vide tant qu\'aucune fiche n\'est enregistrée');

/* ---------- 2. La fiche enregistrée pré-remplit les documents suivants ---------- */
const r1 = saveEmitter(fiche());
ok(r1.saved === true && r1.withLogo === true, 'enregistrement de la fiche émetteur');
ok(loadEmitters().length === 1, 'la fiche est au carnet');
ok(getDefaultEmitterId() === 'A1', 'à défaut, la fiche unique devient la fiche par défaut');
d = createDefaultDoc({ docType: 'facture' });
ok(d.designerName === 'Atelier Koffi' && d.designerTitle === 'Designer graphique', 'le nouveau document reprend le nom et la fonction');
ok(d.designerEmail === 'contact@koffi.cm' && d.designerPhone === '+237 6 99 00 00 01', 'il reprend aussi email et téléphone');
ok(d.designerAddress === 'Rue 1.802, Douala' && d.designerSiret === '123 456 789', 'il reprend l\'adresse et le SIRET');
d = createDefaultDoc({ designerName: 'Autre Studio' });
ok(d.designerName === 'Autre Studio' && d.designerEmail === 'contact@koffi.cm', 'un en-tête explicitement fourni passe devant la fiche par défaut');
/* Un document déjà enregistré reste autonome : le carnet ne se met pas à jour tout seul. */
ok(loadEmitters()[0].name === 'Atelier Koffi', 'le carnet n\'est jamais réécrit par les documents');

/* ---------- 3. Mise à jour sur place, pas de doublon ---------- */
saveEmitter(fiche({ name: 'Atelier Koffi & Fils', label: 'Atelier Koffi & Fils' }));
ok(loadEmitters().length === 1, 'le même id : la fiche est mise à jour, pas dupliquée');
ok(loadEmitters()[0].name === 'Atelier Koffi & Fils', 'les champs sont écrasés');
ok(/handleSaveEmitter[\s\S]{0,700}e\.name\.trim\(\)\.toLowerCase\(\) === name\.toLowerCase\(\)/.test(src('src/App.tsx')),
  'l\'appli retrouve la fiche existante par le nom avant d\'enregistrer');
ok(/setEmitterBook\(b => !b\)/.test(src('src/App.tsx')), 'le carnet s\'ouvre et se referme (état, pas de navigation)');

/* ---------- 4. Plusieurs fiches, un choix par défaut ---------- */
localStorage.clear();
saveEmitter(fiche());
saveEmitter(fiche({ id: 'B2', label: 'Agence Nord', name: 'Agence Nord', email: 'nord@atelier.cm' }));
ok(loadEmitters().length === 2 && loadEmitters()[0].id === 'B2', 'la dernière fiche enregistrée passe en tête du carnet');
ok(getDefaultEmitterId() === 'A1', 'la première fiche reste la fiche par défaut');
setDefaultEmitter('B2');
ok(getDefaultEmitterId() === 'B2' && defaultEmitter()?.id === 'B2', 'on peut choisir une autre fiche par défaut');
ok(createDefaultDoc().designerEmail === 'nord@atelier.cm', 'les nouveaux documents suivent le nouveau choix');
deleteEmitter('B2');
ok(getDefaultEmitterId() === 'A1', 'supprimer la fiche par défaut la remplace par une survivante');
ok(createDefaultDoc().designerName === 'Atelier Koffi', 'et le pré-remplissage continue avec celle-là');
deleteEmitter('A1');
ok(loadEmitters().length === 0 && createDefaultDoc().designerName === '', 'carnet vidé : retour à un en-tête vierge, aucun plantage');

/* ---------- 5. Logo : il passe s'il tient, sinon il saute, la fiche reste ---------- */
localStorage.clear();
const withLogo = saveEmitter(fiche({ logo: 'data:image/png;base64,' + 'A'.repeat(20000) }));
ok(withLogo.saved && withLogo.withLogo && loadEmitters()[0].logo.startsWith('data:image/png;base64,'), 'un logo léger est conservé avec la fiche');
ok(createDefaultDoc().designerLogo.startsWith('data:image/png'), 'le logo est repris par le nouveau document');
const realSet = localStorage.setItem;
localStorage.setItem = (k: string, v: string) => { if (v.length > 100000) throw new Error('QuotaExceededError'); realSet(k, v); };
const heavy = saveEmitter(fiche({ id: 'C3', label: 'Grosse image', name: 'Grosse image', logo: 'data:image/png;base64,' + 'B'.repeat(400000) }));
localStorage.setItem = realSet;
ok(heavy.saved === true && heavy.withLogo === false, 'stockage plein : repli, la fiche est sauvée sans les logos');
ok(loadEmitters()[0].logo === '' && loadEmitters()[0].name === 'Grosse image', 'les coordonnées passent, seul le logo saute');
localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
const dead = saveEmitter(fiche({ id: 'D4', label: 'Impossible', name: 'Impossible' }));
localStorage.setItem = realSet;
ok(dead.saved === false && dead.withLogo === false, 'échec total : signalé, pas masqué');
ok(/logo non conserv/.test(src('src/App.tsx')), 'l\'interface dit que le logo n\'a pas été conservé');
ok(/Enregistrement impossible : le stockage du navigateur est plein\./.test(src('src/App.tsx')), 'l\'interface a aussi le message d\'échec total');

/* ---------- 6. La fiche voyage dans la sauvegarde JSON ---------- */
localStorage.clear();
saveEmitter(fiche());
saveEmitter(fiche({ id: 'B2', label: 'Agence Nord', name: 'Agence Nord' }));
setDefaultEmitter('B2');
const backup = exportAllData();
ok(backup.version === 3 && Array.isArray(backup.emitters) && backup.emitters?.length === 2, 'version 3 : les fiches sont dans le fichier');
ok(backup.emitterDefault === 'B2', 'le choix par défaut voyage aussi');
localStorage.clear();
ok(loadEmitters().length === 0, 'changement d\'appareil : carnet vide');
const back = importAllData(JSON.stringify(backup), 'replace');
ok(back.ok === true, 'la copie se restaure');
ok(/2 fiche\(s\) émetteur\(s\) restaurée\(s\)/.test(back.message), 'le message annonce les fiches restaurées', back.message);
ok(loadEmitters().length === 2 && getDefaultEmitterId() === 'B2', 'carnet et choix reconstitués à l\'identique');
ok(createDefaultDoc().designerName === 'Agence Nord', 'et les nouveaux documents sont de nouveau pré-remplis');
/* fusion : une fiche du même nom ne crée pas de doublon, une autre s'ajoute */
const merged = importAllData(JSON.stringify({
  app: 'devis-designer', version: 3, docs: [], clients: [],
  emitters: [fiche({ id: 'ZZ', label: 'Atelier Koffi', name: 'Atelier Koffi' }), fiche({ id: 'E5', label: 'Autre atelier', name: 'Autre atelier', email: 'z@y.x' })],
}), 'merge');
ok(/1 fiche\(s\) émetteur\(s\) ajoutée\(s\)/.test(merged.message), 'en fusion, seule la fiche nouvelle est comptée', merged.message);
ok(loadEmitters().length === 3 && loadEmitters().some(e => e.email === 'z@y.x'), 'dédupliquée par nom, sans écraser la fiche locale');
/* une copie ancienne (v2, sans la clé) ne vide pas le carnet */
const old = importAllData(JSON.stringify({ app: 'devis-designer', version: 2, docs: [], clients: [] }), 'replace');
ok(old.ok === true && loadEmitters().length === 3, 'une copie d\'avant la fonction ne supprime aucune fiche');
ok(/Fiches émetteurs du carnet conservées/.test(old.message), 'et le dit dans le message', old.message);

/* ---------- 7. Ce qui est écrit à l'écran et dans la doc ---------- */
const app = flat('src/App.tsx');
ok(/MON CARNET/.test(app) && /FERMER/.test(app), 'onglet Emetteur : le carnet s\'ouvre et se referme');
ok(/\+ SAUVEGARDER CETTE FICHE/.test(app), 'bouton d\'enregistrement de la fiche');
ok(/Aucune fiche enregistr/.test(app), 'état vide du carnet');
ok(/PAR DÉFAUT/.test(app) && /handleDefaultEmitter\(e\.id\)/.test(app), 'la fiche par défaut se voit et se change');
ok(/SUPPR/.test(app) && /handleDeleteEmitter\(e\.id\)/.test(app), 'une fiche se retire du carnet');
ok(/handleLoadEmitter\(e\)/.test(app) && /« \$\{e\.label\} » appliqué au document en cours/.test(app), 'un tap applique la fiche au document en cours');
ok(/Renseignez d.abord votre nom ou votre société/.test(app), 'sauvegarde refusée sans nom : la raison est dite');

const landing = flat('src/components/LandingPage.tsx');
ok(/dupliquez le pr/.test(landing) === false, 'landing : le « dupliquez le précédent » n\'est plus la promesse');
ok(/SAUVEGARDER CETTE FICHE/.test(landing), 'landing : l\'étape 1 renvoie au bouton qui existe vraiment');
ok(/Votre en-t.te et les coordonn.es de vos clients reviennent d.un document . l.autre/.test(landing), 'landing : la fiche emetteur, elle aussi, est reuse et annoncee');

const faq = flat('src/components/FAQModal.tsx');
ok(/retaper mon nom et mon logo/.test(faq), 'FAQ : la question de l\'en-tête retapé a sa réponse');
ok(/fiches .metteurs/.test(faq) || /fiches .metteur/.test(faq), 'FAQ : la sauvegarde JSON est annoncée avec les fiches');

const readme = src('README.md');
ok(/## Carnet d'émetteurs et fichier clients/.test(readme), 'README : une section dédiée au carnet des fiches émetteurs');
ok(/devis_designer_emitters/.test(readme) && /devis_designer_emitter_default/.test(readme), 'README : les deux clés de stockage sont nommées');
ok(/version: 3/.test(readme), 'README : la version de la sauvegarde est documentée');
ok(/emitter_test\.tsx/.test(readme), 'README : la suite est citée là où elle protège');
const pkg = JSON.parse(src('package.json'));
ok(/emitter_test\.tsx/.test(pkg.scripts['test:ui'] || ''), 'package.json : la suite est jouée par npm run test:ui', pkg.scripts['test:ui']);

console.log(`\nFICHE ÉMETTEUR : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
