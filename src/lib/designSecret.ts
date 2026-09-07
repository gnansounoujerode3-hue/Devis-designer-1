/* ============================================================
   FICHIERS DE DESIGN PERSONNALISÉ — format + signature
   ------------------------------------------------------------
   Le vendeur livre au client un fichier `.dddesign.js` : du JavaScript déjà
   compilé (via `npm run design:pack`), précédé d'un en-tête signé.
   L'application refuse tout fichier dont la signature ne correspond pas.

   Structure du fichier (dans cet ordre) :
     1. un commentaire  /​*#DDDESIGN1 + JSON des métadonnées + *​/
     2. le code compilé (format CJS ; react et react/jsx-runtime restent
        externes, c'est l'app qui les fournit à l'exécution)
     3. une ligne finale  //# sig=<hex>  (la signature HMAC-SHA256)

   Ce que la signature garantit : le fichier vient bien de cette application
   (même famille de secret que les codes d'activation) et n'a pas été modifié.
   Ce qu'elle ne garantit PAS : le secret est dans le bundle public, donc un
   initié déterminé peut le retrouver et fabriquer un fichier. C'est un
   garde-fou contre les fichiers qui traînent, pas une barrière cryptographique.
   ============================================================ */

export const DESIGN_MAGIC = '/*#DDDESIGN1';
export const DESIGN_MAX_CODE = 250_000;   // ~250 ko de code : largement assez pour un modèle

export interface DesignMeta {
  /** Nom affiché dans le sélecteur de modèles (ex. « Design Dupont »). */
  name: string;
  /** Description courte sous le nom. */
  desc?: string;
  /** Qui l'a fait (vendeur). */
  author?: string;
  /** ISO, horodaté au packing. */
  created?: string;
}

export interface DesignFile {
  meta: DesignMeta;
  /** Texte de l'en-tête JSON tel quel (sert à la vérification). */
  header: string;
  code: string;
  sig: string;
}

/* Secret encodé en morceaux, comme celui des codes d'activation : il n'apparaît
   pas en clair d'un coup d'œil dans le bundle. */
const SECRET_CHUNKS = [
  'ZDN2MXM=', 'ZHNnbl9kZXY=', 'azRtZGVz', 'ZzNjMG4=',
  'cDFnNHQ=', 'czNjMG4=', 'ZDNzM24=', 'bzJuM3M=',
];
function designSecret(): string {
  return SECRET_CHUNKS.map(s => atob(s)).join('-');
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 (hex) — WebCrypto, donc identique dans le navigateur et sous Node. */
export async function designHmac(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(designSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))));
}

/** Ce qui est signé : l'en-tête.can + le code, dans cet ordre. */
function signedPart(header: string, code: string): string {
  return header + '\n' + code;
}

/** Enveloppe complète : à écrire dans le fichier livré au client. */
export async function packDesignFile(meta: DesignMeta, rawCode: string): Promise<string> {
  const header = JSON.stringify(meta);
  const code = (rawCode || '').trim();
  const sig = await designHmac(signedPart(header, code));
  return `${DESIGN_MAGIC}${header}*/\n${code}\n//# sig=${sig}\n`;
}

export type UnpackResult = { ok: true; file: DesignFile } | { ok: false; error: string };

/** Lit, borne la taille et vérifie la signature d'un fichier de design. */
export async function unpackDesignFile(text: string): Promise<UnpackResult> {
  const raw = (text || '').replace(/^\uFEFF/, '').trim();
  if (!raw.startsWith(DESIGN_MAGIC)) {
    return { ok: false, error: 'Ce fichier n’est pas un fichier de design Devis Designer (en-tête absent). Relisez le fichier .dddesign.js reçu.' };
  }
  const end = raw.indexOf('*/');
  if (end < 0) return { ok: false, error: 'En-tête de design illisible.' };
  let meta: DesignMeta;
  try { meta = JSON.parse(raw.slice(DESIGN_MAGIC.length, end)); } catch { return { ok: false, error: 'En-tête de design invalide (JSON illisible).' }; }
  if (!meta || typeof meta.name !== 'string' || !meta.name.trim()) {
    return { ok: false, error: 'Le fichier ne nomme pas le design (champ « name » manquant).' };
  }
  const m = raw.match(/\/\/# sig=([0-9a-f]{64})\s*$/);
  if (!m) return { ok: false, error: 'Signature absente de la fin du fichier.' };
  const body = raw.slice(end + 2).replace(/\n\/\/# sig=[0-9a-f]{64}\s*$/, '').replace(/^\n/, '');
  const code = body.trim();
  if (!code) return { ok: false, error: 'Le fichier ne contient aucun code de modèle.' };
  if (code.length > DESIGN_MAX_CODE) {
    return { ok: false, error: `Fichier trop volumineux (${(code.length / 1000).toFixed(0)} ko, maximum ${DESIGN_MAX_CODE / 1000} ko).` };
  }
  const expected = await designHmac(signedPart(raw.slice(DESIGN_MAGIC.length, end), code));
  if (expected !== m[1]) {
    return { ok: false, error: 'Signature invalide : ce fichier n’a pas été livré par le vendeur, ou il a été modifié.' };
  }
  return { ok: true, file: { meta, header: raw.slice(DESIGN_MAGIC.length, end), code, sig: m[1] } };
}
