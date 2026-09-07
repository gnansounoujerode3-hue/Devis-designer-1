/* ============================================================
   SUITE « DESIGN PERSONNALISÉ » — bout-en-bout
   pack du vendeur → fichier signé → import du client → rendu par le vrai
   QuoteSVG → multi-emplacements → sauvegarde JSON → offre qui débloque.
   Lancee par tests/run.mjs (shim DOM + react-dom/server).
   ============================================================ */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { packDesignFile, unpackDesignFile } from '../src/lib/designSecret';
import {
  MAX_DESIGNS, adoptDesignBlobs, customTemplateInfos, designIdForSlot,
  getDesign, installDesignFile, listDesigns, replaceDesignFile, resolveCustomTemplate,
  slotOfDesignId, uninstallDesign,
} from '../src/lib/customDesign';
import { allTemplates, resolveTemplate } from '../src/templates';
import QuoteSVG from '../src/components/QuoteSVG';
import { createDefaultDoc, exportAllData, importAllData } from '../src/store';
import { applyCode, codeKindLabel, daysLeft, generateCode, isLicensed, loadLicense, PRICE_CUSTOM_DESIGN } from '../src/lib/license';
import PaywallModal from '../src/components/PaywallModal';

let pass = 0, fail = 0;
function ok(cond: unknown, name: string, extra = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  << ' + String(extra).slice(0, 190) : '')); }
}
const root = process.cwd();
const dir = 'node_modules/.dd';
const packer = 'node ' + dir + '/design-pack.cjs';
/** Pack un gabarit comme le ferait le vendeur (le runner a déjà bâti le packager). */
function pack(fixture: string, name: string) {
  const out = `${dir}/${name}.dddesign.js`;
  execSync(`${packer} ${fixture} --name="${name}" --out=${out}`, { cwd: root, stdio: 'pipe' });
  return readFileSync(root + '/' + out, 'utf8');
}
const doc = (templateId: string) => createDefaultDoc({ templateId: templateId as never, clientName: 'Client Test', designerName: 'Atelier Test' });
const render = (id: string) => renderToStaticMarkup(<QuoteSVG data={doc(id)} />);

/* ---------- 1. Le packager du vendeur ---------- */
const vendorFile = pack('scripts/design-example.tsx', 'vendor');
ok(vendorFile.startsWith('/*#DDDESIGN1'), 'en-tête signé en première ligne');
ok(/\/\/# sig=[0-9a-f]{64}/.test(vendorFile), 'signature HMAC en fin de fichier');
ok(vendorFile.length < 60_000, 'fichier léger (' + Math.round(vendorFile.length / 1000) + ' ko)');
ok(!/from ['"]react['"]/m.test(vendorFile), 'react reste externe (pas de double React embarqué)');
const parsed = await unpackDesignFile(vendorFile);
ok(parsed.ok === true, 'le fichier du vendeur est accepté', JSON.stringify(parsed).slice(0, 140));

/* ---------- 1 bis. La commande documentée doit être la commande qui marche ---------- */
const docs = [
  ['README.md', readFileSync(root + '/README.md', 'utf8')],
  ['VendorPage', readFileSync(root + '/src/components/VendorPage.tsx', 'utf8')],
  ['design-example', readFileSync(root + '/scripts/design-example.tsx', 'utf8')],
] as Array<[string, string]>;
for (const [f, body] of docs) {
  const lines = body.split('\n').filter(l => l.includes('npm run design:pack') && !l.includes('/*'));
  /* Une ligne qui écrit la commande doit la donner telle qu'il faut la taper ; n'est
     tolérée que si elle dit explicitement que cette forme-là ne marche pas. */
  const bad = lines.filter(l => !l.includes('design:pack --') && !/ne marche pas|refusée|jamais/.test(l));
  ok(bad.length === 0, f + ' : la commande passée à npm est de la bonne forme', bad.join(' / ').slice(0, 150));
}
let npmWorks = true;
try { execSync('npm --version', { cwd: root, stdio: 'pipe' }); } catch { npmWorks = false; }
if (npmWorks) {
  execSync('npm run design:pack -- tests/fixtures/probe-a.tsx --name="Via npm" --out=node_modules/.dd/vianpm.dddesign.js', { cwd: root, stdio: 'pipe' });
  const viaNpm = readFileSync(root + '/node_modules/.dd/vianpm.dddesign.js', 'utf8');
  ok(viaNpm.includes('"name":"Via npm"'), 'npm run design:pack -- … --name="…" transmet bien le nom');
  const before = listDesigns().length;
  ok(await installDesignFile(viaNpm).then(r => r.ok === true && r.meta.name === 'Via npm'), 'le fichier passé par npm s’importe');
  ok(listDesigns().length === before + 1, 'il occupe un nouvel emplacement');
  uninstallDesign();
  let refused = false;
  try { execSync('npm run design:pack -- tests/fixtures/probe-a.tsx --name Via npm', { cwd: root, stdio: 'pipe' }); }
  catch (e) { refused = /npm run design:pack --/.test(String((e as any).stdout || '') + String((e as any).stderr || '')); }
  ok(!npmWorks || refused, 'la forme sans « -- » est refusée avec la correction proposée');
} else {
  console.log('  skip npm (indisponible dans cet environnement)');
}

/* ---------- 2. Refus ---------- */
for (const [label, text] of [
  ['fichier sans en-tête', 'bonjour'],
  ['fichier modifié d’un caractère', vendorFile.replace('TVA', 'TVA ')],
  ['signature coupée', vendorFile.replace(/sig=[0-9a-f]{6}/, 'sig=000000')],
  ['signature recollée ailleurs', vendorFile.replace(/sig=[0-9a-f]{64}/, 'sig=' + '0'.repeat(64))],
  ['code trop volumineux', await packDesignFile({ name: 'Gros' }, '// ' + 'x'.repeat(300_000))],
  ['en-tête tronqué', '/*#DDDESIGN1{"pas":"de nom"}*/\nmodule.exports={}', ],
] as Array<[string, string]>) {
  const r = await installDesignFile(text);
  ok(!r.ok, 'refusé : ' + label, JSON.stringify(r).slice(0, 120));
}
ok(listDesigns().length === 0, 'rien n’est installé après les refus');

/* ---------- 3. Emplacements ---------- */
const first = await installDesignFile(vendorFile);
ok(first.ok === true && first.slot === 1 && first.id === 'custom', 'le 1er design occupe « custom »', JSON.stringify(first));
const a = pack('tests/fixtures/probe-a.tsx', 'probe-a');
const b = pack('tests/fixtures/probe-b.tsx', 'probe-b');
const r2 = await installDesignFile(a);
ok(r2.ok === true && (r2 as any).slot === 2 && (r2 as any).id === 'custom-2', 'le 2e va en « custom-2 »', JSON.stringify(r2));
const r3 = await installDesignFile(b);
ok(r3.ok === true && (r3 as any).slot === 3, 'le 3e en « custom-3 »');
ok(listDesigns().length === 3, 'trois designs installés');
ok(customTemplateInfos().length === 3, 'le sélecteur en voit trois');
ok(allTemplates().length === 15, '12 embarqués + 3 importés', String(allTemplates().length));
ok(designIdForSlot(4) === ('custom-4' as never) && slotOfDesignId('custom-4') === 4 && slotOfDesignId('custom') === 1, 'ids ⇄ emplacements');

/* rendu : chaque devis garde SON design */
ok(render('custom-2').includes('FIXTURE-A'), 'un document en custom-2 rend le gabarit A');
ok(render('custom-3').includes('FIXTURE-B'), 'un document en custom-3 rend le gabarit B');
ok(render('custom').includes('viewBox="0 0 794 1123"'), 'le design du vendeur rend une page A4');
ok(render('custom').includes('Client Test') && render('custom').includes('TOTAL'), 'le gabarit lit bien les données du client');

/* remplacement : l'emplacement garde son id (les devis existants suivent) */
const replaced = await replaceDesignFile(b, 2);
ok(replaced.ok === true && (replaced as any).slot === 2, '« Remplacer » écrit au même emplacement');
ok(render('custom-2').includes('FIXTURE-B'), 'les documents en custom-2 basculent sur la nouvelle version');
ok(listDesigns().length === 3, 'remplacer n’ajoute pas de design');
uninstallDesign(2);
ok(listDesigns().length === 2 && getDesign(2) === null, 'retirer un emplacement laisse les autres');
ok(render('custom-2').includes('<svg'), 'un id dont le fichier est parti retombe sur un modèle (pas d’écran blanc)');
ok(resolveCustomTemplate('custom-99') === null && resolveTemplate('inexistant' as never) === resolveTemplate('modern'), 'ids inconnus → Modern');

/* ---------- 4. Plafond ---------- */
for (let i = 0; i < MAX_DESIGNS; i++) await installDesignFile(a);
ok(listDesigns().length === MAX_DESIGNS, 'jusqu’à ' + MAX_DESIGNS + ' designs (' + listDesigns().length + ')');
const over = await installDesignFile(b);
ok(!over.ok && new RegExp(String(MAX_DESIGNS)).test((over as any).error || ''), 'au-delà du plafond : refus expliqué', JSON.stringify(over));
uninstallDesign();
ok(listDesigns().length === 0, '« Tout retirer » vide les emplacements');

/* ---------- 5. Hooks : React partagé ---------- */
const hooksFile = pack('tests/fixtures/hooks.tsx', 'hooks');
ok(await installDesignFile(hooksFile).then(r => r.ok === true), 'un modèle avec useState s’installe');
ok(render('custom').includes('-3'), 'useState fonctionne dans le design importé', render('custom').slice(0, 110));

/* ---------- 6. Migration depuis l'ancien format « un seul design » ---------- */
uninstallDesign();
localStorage.setItem('dd_custom_design', vendorFile.trim());
localStorage.setItem('dd_custom_design_at', '123');
ok(listDesigns().length === 1 && getDesign(1)?.meta.name.includes('vendor'), 'l’ancien stockage est repris en emplacement 1');
ok(localStorage.getItem('dd_custom_design') === null, 'les clés de l’ancien format sont nettoyées');

/* ---------- 7. La sauvegarde JSON emporte tous les designs ---------- */
uninstallDesign();
await installDesignFile(a); await installDesignFile(b);
const backup = exportAllData();
ok(Array.isArray(backup.customDesigns) && backup.customDesigns!.length === 2, 'exportAllData() liste les blobs signés');
uninstallDesign(1);   // seul l'emplacement 2 est pris
const gapped = exportAllData().customDesigns!;
ok(gapped.length === 2 && gapped[0] === null && typeof gapped[1] === 'string', 'un trou se note null, les fins vides sont coupées');
uninstallDesign();
await adoptDesignBlobs(gapped, 'exact');
ok(getDesign(1) === null && !!getDesign(2), 'la restauration remet chaque blob à SON emplacement');
ok(render('custom-2').includes('FIXTURE-B'), 'un devis en custom-2 retrouve son design après restauration');
ok(render('custom').includes('FIXTURE-B') === false, 'custom (libre) ne rend pas le design 2');
uninstallDesign();
const n = await adoptDesignBlobs(backup.customDesigns);
ok(n === 2, 'restauration : les deux designs reviennent', String(n));
const evil = { ...backup, customDesigns: [backup.customDesigns![0], (backup.customDesigns![1] as string).replace('FIXTURE-B', 'FIXTURE-X')] };
uninstallDesign();
await new Promise(r => setTimeout(r, 120));
const done = await adoptDesignBlobs(evil.customDesigns);
ok(done === 1, 'un blob falsifié dans la sauvegarde n’est pas installé (' + done + '/2)');
const imp = importAllData(JSON.stringify(backup), 'replace');
ok(imp.ok === true && /design\(s\) personnalisé\(s\) restauré/.test(imp.message), 'le message d’import le dit');
await new Promise(r => setTimeout(r, 250));   // la revérification des signatures est asynchrone
ok(listDesigns().length === 2, 'après import de la sauvegarde, les deux designs sont de retour');
uninstallDesign();

/* ---------- 8. L'offre DESIGN donne aussi le droit d'exporter ---------- */
const code = await generateCode('DESIGN');
ok((await applyCode(code)).ok === true, 'un code DESIGN s’active');
const lic = loadLicense();
ok(lic.customDesign === true && isLicensed(lic), 'design posé + exports débloqués');
ok(daysLeft(lic) === 30, '1 mois inclus (' + daysLeft(lic) + ' jours)');
ok(codeKindLabel('DESIGN').includes('1 mois'), 'libellé vendeur : ' + codeKindLabel('DESIGN'));
ok(PRICE_CUSTOM_DESIGN === 5000, 'prix toujours 5 000 F');

/* ---------- 9. L'UI, dans les deux états ---------- */
uninstallDesign();
let pw = renderToStaticMarkup(<PaywallModal open onClose={() => { }} />);
ok(/Importer mon design/.test(pw), 'paywall : la carte propose l’import quand rien n’est installé');
ok(/ÉTAPE 2/.test(pw) && /\.dddesign\.js/.test(pw), 'elle nomme le fichier attendu et l’ordre des étapes');
await installDesignFile(a); await installDesignFile(b);
pw = renderToStaticMarkup(<PaywallModal open onClose={() => { }} />);
ok(/MES DESIGNS PERSONNALISÉS · 2\/6/.test(pw), 'paywall : l’inventaire des emplacements occupés');
ok(/Remplacer/.test(pw) && /Retirer/.test(pw) && /Ajouter un autre design/.test(pw), 'les trois actions par emplacement');
ok(pw.includes('FIXTURE') === false, 'le contenu du fichier n’est pas affiché en clair');
uninstallDesign();
ok(existsSync(root + '/' + dir), 'le répertoire de build des outils existe');

/* ---------- 10. Ce qui est écrit, à l'écran comme dans la doc ---------- */
const faq = readFileSync(root + '/src/components/FAQModal.tsx', 'utf8').replace(/\s+/g, ' ');
ok(/jusqu'à 6 à la fois/.test(faq), 'FAQ : le nombre de designs est annoncé');
const vp = readFileSync(root + '/src/components/VendorPage.tsx', 'utf8');
ok(/npm run design:pack/.test(vp) && /design-example\.tsx/.test(vp), '#/vendeur : la commande et le gabarit rappelés');
const readme = readFileSync(root + '/README.md', 'utf8');
ok(/design:pack/.test(readme) && /Importer mon design/.test(readme), 'README : le trajet complet est documenté');
ok(readme.includes('npm run test:ui'), 'README : les suites de tests sont documentées');

console.log(`\nDESIGN PERSONNALISÉ : ${pass} réussis, ${fail} échoués`);
if (fail) process.exit(1);
