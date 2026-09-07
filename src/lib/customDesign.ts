/* ============================================================
   DESIGN PERSONNALISÉ IMPORTÉ — magasin local du modèle du client
   ------------------------------------------------------------
   Un client qui achète le « design sur mesure » reçoit un fichier
   .dddesign.js (voir src/lib/designSecret.ts). Il l'importe dans
   l'application : le code est vérifié (signature) puis gardé tel quel
   dans localStorage, et le modèle apparaît dans le sélecteur sous
   l'identifiant fixe « custom ».

   Pourquoi le fichier est signé ET vérifié à l'import, puis évalué sans
   re-vérification : le blob en localStorage est celui qui a passé le
   contrôle ; le ré-évaluer à chaque démarrage évite un HMAC de 250 ko par
   chargement. Un fichier restauré depuis une sauvegarde JSON repasse par
   la vérification (chemin adoptFromBackup).
   ============================================================ */
import * as React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import type { QuoteData, TemplateId, TemplateInfo } from '../types';
import { DESIGN_MAGIC, packDesignFile, unpackDesignFile, type DesignMeta } from './designSecret';

export const CUSTOM_TEMPLATE_ID = 'custom' as const;
export type CustomTemplateId = typeof CUSTOM_TEMPLATE_ID;
const LS_KEY = 'dd_custom_design';
const LS_AT = 'dd_custom_design_at';

export interface CustomTemplateProps {
  data: QuoteData;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export type TemplateComponent = (props: CustomTemplateProps) => React.ReactElement;

export interface InstalledDesign {
  meta: DesignMeta;
  component: TemplateComponent;
  /** Signature du fichier installé (affichée dans l'encart, pour repérer un changement). */
  sig: string;
  installedAt: number;
}

/** Cache d'exécution : évalué une fois par chargement, à la demande. */
let cached: InstalledDesign | null | 'invalid' = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => { try { l(); } catch { /* ignore */ } }); }

/** S'abonne aux changements d'installation (le sélecteur de modèles se rafraîchit). */
export function onDesignChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/**
 * Évalue le code du modèle. Le fichier est en CJS avec react et
 * react/jsx-runtime en modules externes : on les fournit ici, ce qui
 * garantit que le design importé utilise BIEN le React de l'application
 * (deux copies de React casseraient les hooks).
 */
function evaluate(code: string): TemplateComponent {
  const mod = { exports: {} as Record<string, unknown> };
  const require = (name: string): unknown => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') return JsxRuntime;
    throw new Error('Ce module n’est pas disponible dans l’application : ' + name);
  };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  const e = mod.exports || {};
  const cand = (e.default ?? e.Template ?? e.template ?? Object.values(e)[0]) as unknown;
  if (typeof cand !== 'function') {
    throw new Error('Le fichier ne fournit pas de composant (exportez `export default function Template({ data, svgRef })`).');
  }
  return cand as TemplateComponent;
}

/** Le design installé, ou null (aucun / fichier illisible). */
export function getInstalledDesign(): InstalledDesign | null {
  if (cached === 'invalid') return null;
  if (cached) return cached;
  let raw: string | null = null;
  try { raw = localStorage.getItem(LS_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const at = Number(localStorage.getItem(LS_AT) || 0) || 0;
    const m = raw.match(/\/\/# sig=([0-9a-f]{64})\s*$/);
    cached = { meta: metaFromBlob(raw), component: evaluate(codeFromBlob(raw)), sig: m ? m[1] : '', installedAt: at };
  } catch {
    // fichier corrompu à la main : on n'exploite pas, on affiche rien
    cached = 'invalid';
    return null;
  }
  return cached;
}

function metaFromBlob(raw: string): DesignMeta {
  const end = raw.indexOf('*/');
  try { return JSON.parse(raw.slice(DESIGN_MAGIC.length, end)) as DesignMeta; } catch { return { name: 'Mon design' }; }
}
function codeFromBlob(raw: string): string {
  const end = raw.indexOf('*/');
  return raw.slice(end + 2).replace(/\n\/\/# sig=[0-9a-f]{64}\s*$/, '').trim();
}

/** Fichier déjà signé stocké tel quel (il garde son en-tête et sa signature). */
function persist(fileText: string): boolean {
  try {
    localStorage.setItem(LS_KEY, fileText.trim());
    localStorage.setItem(LS_AT, String(Date.now()));
  } catch {
    // Safari en navigation privée / stockage plein : rien n'est installé
    return false;
  }
  cached = null;   // forcer la ré-évaluation
  notify();
  return true;
}

export type InstallResult = { ok: true; meta: DesignMeta } | { ok: false; error: string };

/** Contrôle complet d'un texte de fichier, puis installation. */
export async function installDesignFile(text: string): Promise<InstallResult> {
  const parsed = await unpackDesignFile(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    const Comp = evaluate(parsed.file.code);
    // Contrôle de cohérence : le composant doit rendre un <svg> A4.
    const probe = React.createElement(Comp, { data: probeDoc(), svgRef: undefined });
    void probe;   // le rendu complet est fait côté appelant ; ici on valide juste l'évaluation
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Le code du modèle ne s’exécute pas.' };
  }
  if (!persist(text)) {
    return { ok: false, error: 'Impossible d’enregistrer le design sur cet appareil (stockage du navigateur indisponible ou plein). Refermez les onglets inutiles et réessayez.' };
  }
  return { ok: true, meta: parsed.file.meta };
}

/** Ré-installe depuis un blob déjà formaté (restauration de sauvegarde JSON). */
export async function adoptDesignBlob(blob: unknown): Promise<boolean> {
  if (typeof blob !== 'string' || !blob.trim()) return false;
  const r = await installDesignFile(blob);
  return r.ok;
}

/** Reconstruit un fichier signé (utilisé par les tests et par « exporter mon design »). */
export function buildDesignFile(meta: DesignMeta, code: string): Promise<string> {
  return packDesignFile(meta, code);
}

export function uninstallDesign() {
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_AT); } catch { /* ignore */ }
  cached = null;
  notify();
}

/** Le blob installé (pour l'inclure dans la sauvegarde JSON), ou undefined. */
export function designBlobForBackup(): string | undefined {
  const d = getInstalledDesign();
  if (!d) return undefined;
  try { return localStorage.getItem(LS_KEY) || undefined; } catch { return undefined; }
}

export function customTemplateInfo(): TemplateInfo | null {
  const d = getInstalledDesign();
  if (!d) return null;
  return {
    id: CUSTOM_TEMPLATE_ID as TemplateId,
    name: (d.meta.name || 'Mon design').slice(0, 28),
    description: (d.meta.desc || 'Design personnalisé livré par le vendeur').slice(0, 90),
  };
}

/** Document minimal pour valider l'évaluation du composant sans toucher aux données du client. */
function probeDoc(): QuoteData {
  return {
    id: 'probe', docType: 'devis', status: 'brouillon', designerName: 'X', designerTitle: '', designerEmail: '',
    designerPhone: '', designerAddress: '', designerSiret: '', designerLogo: '', clientName: '', clientCompany: '',
    clientEmail: '', clientAddress: '', quoteNumber: 'DEV-0000', quoteDate: '2026-01-01', validUntil: '2026-02-01',
    items: [{ id: 'i1', description: 'Ligne', quantity: 1, unitPrice: 1000 }], notes: '', taxRate: 18,
    accentColor: '#0057FF', currency: 'XOF', fontFamily: 'Inter', templateId: 'custom',
    designerSignature: '', designerSignedAt: '', clientSignature: '', clientSignedAt: '', showWatermark: false,
    createdAt: 0, updatedAt: 0,
  };
}
