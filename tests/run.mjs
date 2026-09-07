/* ============================================================
   tests/run.mjs — lance une suite de garde-fous sans dépendance externe.
   ------------------------------------------------------------
   Node ne sait pas exécuter du TSX : on emballe la suite avec esbuild
   (déjà là pour Vite) + le shim DOM minimal, puis on la joue.
   Usage :
     npm run test:ui                 (les deux suites)
     node tests/run.mjs tests/design_test.tsx
   Une suite qui échoue sort en code 1 (CI-ready).
   ============================================================ */
import { buildSync } from 'esbuild';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = 'node_modules/.dd';
const shim = readFileSync(path.join(root, 'tests/shim.js'), 'utf8');
const suites = process.argv.slice(2);
if (!suites.length) { console.error('Aucune suite demandée.'); process.exit(2); }

/* Le packager de design est un outil du dépôt : on le construit d'abord,
   la suite design l'appelle comme le ferait le vendeur. */
buildSync({
  entryPoints: ['scripts/design-pack.ts'], bundle: true, platform: 'node', format: 'cjs',
  external: ['esbuild'], outfile: path.join(out, 'design-pack.cjs'), absWorkingDir: root, logLevel: 'warning',
});

const opts = {
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', target: ['node18'],
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
  /* React et react-dom restent des imports Node : pas de copie embarquée (le
     harness utilise la MÊME instance que l'app), et react-dom/server (CJS) n'est
     pas recopié dans un contexte ESM où son require() interne échouerait. */
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'react-signature-canvas'],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: shim }, absWorkingDir: root, logLevel: 'error',
};

let failed = 0;
for (const suite of suites) {
  const name = path.basename(suite).replace(/\.tsx$/, '');
  const file = path.join(out, name + '.mjs');   // ESM : les suites peuvent utiliser await au premier niveau
  console.log('\n\u2500\u2500 ' + suite + ' ' + '\u2500'.repeat(Math.max(0, 60 - suite.length)));
  try {
    buildSync({ ...opts, entryPoints: [suite], outfile: file });
    execSync('node ' + JSON.stringify(file), { stdio: 'inherit', cwd: root });
  } catch (e) {
    failed++;
    console.log('\u2718 ' + name + ' : échoué (' + (e && e.message ? String(e.message).split('\n')[0] : 'erreur') + ')');
  }
}
console.log(failed ? `\n${failed} suite(s) en échec` : '\nToutes les suites sont vertes.');
process.exit(failed ? 1 : 0);
