/* ============================================================
   npm run design:pack  src/templates/DesignDupont.tsx
   ------------------------------------------------------------
   Compile un modèle (TSX) en un fichier .dddesign.js signé, que vous
   envoyez au client. C'est LE fichier que le client importe ensuite dans
   l'application (bouton « Importer mon design »).

   Options :
     --name "Design Dupont"     nom affiché dans le sélecteur de modèles
     --desc "Version 2 colonnes" description sous le nom
     --author "Atelier Kpodé"   qui l'a fait
     --out /chemin/fichier.dddesign.js
   Sans --out : le fichier est écrit à côté du .tsx (.dddesign.js).

   Ce que le packager fait : bundle vos imports (../types, helpers…) dans
   le fichier, garde react et react/jsx-runtime EXTERNES (c'est
   l'application qui les fournit à l'exécution — sinon deux copies de React
   cassent les hooks), minifie, puis signe le résultat au secret de l'app.
   ============================================================ */
import { buildSync } from 'esbuild';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { packDesignFile } from '../src/lib/designSecret';

function arg(name: string): string | null {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

async function main() {
  const entry = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!entry) {
    console.error('Usage : npm run design:pack -- src/templates/MonDesign.tsx --name "Design Dupont"');
    process.exit(2);
  }
  const src = path.resolve(entry);
  if (!existsSync(src)) { console.error('Fichier introuvable : ' + src); process.exit(2); }
  if (!/\.(tsx|jsx|ts|js)$/.test(src)) { console.error('Extension attendue : .tsx (ou .jsx/.ts/.js)'); process.exit(2); }
  const source = readFileSync(src, 'utf8');
  if (!/export default/.test(source)) {
    console.error('Ce fichier n’a pas de « export default function … ». Un modèle doit exporter son composant par défaut :');
    console.error('  export default function Template({ data, svgRef }: Props) { return (<svg …>…</svg>); }');
    process.exit(2);
  }

  const root = path.resolve(__dirname, '..');
  const res = buildSync({
    entryPoints: [src],
    absWorkingDir: root,
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: ['es2019'],
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    write: false,
    external: ['react', 'react/jsx-runtime', 'react-dom'],
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl' },
    logLevel: 'warning',
  });
  const code = res.outputFiles?.[0]?.text ?? '';
  if (!code.trim()) { console.error('Compilation vide — vérifiez que le composant est bien exporté par défaut.'); process.exit(1); }
  if (/\bimport\s/.test(code) || /require\(["'](?!react|react\/jsx-runtime)/.test(code)) {
    console.warn('⚠ Le fichier contient encore des imports/require non résolus. Le client verra une erreur à l’import.');
  }

  const meta = {
    name: arg('name') || path.basename(src).replace(/\.(tsx|jsx|ts|js)$/, '').replace(/^Template/, ''),
    desc: arg('desc') || 'Design personnalisé',
    author: arg('author') || 'Vendeur Devis Designer',
    created: new Date().toISOString(),
  };
  const file = await packDesignFile(meta, code);
  const out = arg('out') || src.replace(/\.(tsx|jsx|ts|js)$/, '') + '.dddesign.js';
  writeFileSync(out, file, 'utf8');

  const kb = (n: number) => (n / 1000).toFixed(1) + ' ko';
  console.log('✔ Design packé : ' + path.relative(root, out) || out);
  console.log('  nom affiché   : ' + meta.name);
  console.log('  description   : ' + meta.desc + (meta.author ? '  ·  ' + meta.author : ''));
  console.log('  taille        : ' + kb(file.length) + ' (code ' + kb(code.length) + ')');
  const limit = 250_000;
  if (code.length > limit) {
    console.error('✖ Code trop volumineux (' + kb(code.length) + ') : l’application refuse au-delà de ' + kb(limit) + '.');
    process.exit(1);
  }
  console.log('  à envoyer au client, qui clique sur « Importer mon design » dans l’application.');
  console.log('  (gardez le .tsx : c’est lui que vous modifierez pour une correction)');
}

main().catch(e => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
