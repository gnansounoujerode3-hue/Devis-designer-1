/* ============================================================
   DESIGNS PERSONNALISÉS IMPORTÉS — magasin local du client
   ------------------------------------------------------------
   Un client qui achète le « design sur mesure » reçoit un fichier
   .dddesign.js (voir src/lib/designSecret.ts). Il l'importe dans
   l'application : le code est vérifié (signature) puis gardé tel quel
   dans le localStorage de CET appareil, et le modèle apparaît dans le
   sélecteur à côté des 12 embarqués.

   Plusieurs designs coexistent (jusqu'à MAX_DESIGNS), numérotés par
   « emplacement » (slot) :
     slot 1 → identifiant 'custom'      (le premier, celui de toujours)
     slot n → identifiant 'custom-n'
   L'identifiant d'un emplacement NE CHANGE PAS quand on le remplace par
   une version corrigée : les documents déjà rédigés avec ce design
   continuent de s'afficher correctement.

   Pourquoi signé ET vérifié à l'import, puis évalué sans re-vérification :
   le blob stocké est celui qui a passé le contrôle ; recalculer un HMAC sur
   250 ko à chaque démarrage coûterait cher à tout le monde. Un fichier
   restauré depuis une sauvegarde JSON repasse par la vérification.
   ============================================================ */
import * as React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import type { QuoteData, TemplateId, TemplateInfo } from '../types';
import { DESIGN_MAGIC, packDesignFile, unpackDesignFile, type DesignMeta } from './designSecret';

/** Premier emplacement : id historique, conservé pour la compatibilité. */
export const CUSTOM_TEMPLATE_ID = 'custom' as const;
export const MAX_DESIGNS = 6;
const LS_LIST = 'dd_custom_designs';
const LS_LEGACY = 'dd_custom_design';          // version « un seul design »
const LS_LEGACY_AT = 'dd_custom_design_at';

export interface CustomTemplateProps {
  data: QuoteData;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export type TemplateComponent = (props: CustomTemplateProps) => React.ReactElement;

export interface InstalledDesign {
  /** 1..MAX_DESIGNS */
  slot: number;
  meta: DesignMeta;
  component: TemplateComponent;
  /** Signature du fichier installé (permet de repérer une version différente). */
  sig: string;
  installedAt: number;
}

type Entry = { slot: number; blob: string; at: number };

/* Cache d'évaluation : un design n'est compilé qu'au premier usage, pas au chargement. */
const cache = new Map<number, InstalledDesign | 'invalid'>();
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => { try { l(); } catch { /* ignore */ } }); }

/** S'abonne aux installations/retraits (le sélecteur de modèles se rafraîchit). */
export function onDesignChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function designIdForSlot(slot: number): TemplateId {
  return (slot <= 1 ? CUSTOM_TEMPLATE_ID : `${CUSTOM_TEMPLATE_ID}-${slot}`) as TemplateId;
}

export function slotOfDesignId(id: string): number | null {
  if (id === CUSTOM_TEMPLATE_ID) return 1;
  const m = /^custom-(\d+)$/.exec(id);
  return m ? Math.max(1, parseInt(m[1], 10)) : null;
}

function readBlob(blob: string): { meta: DesignMeta; code: string; sig: string } {
  const end = blob.indexOf('*/');
  let meta: DesignMeta = { name: 'Mon design' };
  try { meta = JSON.parse(blob.slice(DESIGN_MAGIC.length, end)) as DesignMeta; } catch { /* nom par défaut */ }
  const code = blob.slice(end + 2).replace(/\n\/\/# sig=[0-9a-f]{64}\s*$/, '').trim();
  const m = blob.match(/\/\/# sig=([0-9a-f]{64})\s*$/);
  return { meta, code, sig: m ? m[1] : '' };
}

/**
 * Évalue le code du modèle. Le fichier est en CommonJS avec react et
 * react/jsx-runtime en modules externes : on les fournit ici, ce qui garantit
 * que le design importé utilise BIEN le React de l'application (deux copies de
 * React cassent les hooks).
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

/* ---------------- magasin ---------------- */

/**
 * Les emplacements, dans l'ordre. La migration de l'ancien format (« un seul
 * design ») est ECRITE tout de suite : sinon la clé legacy disparaît avant
 * qu'un autre lecteur ait vu le design, et il semble perdu au rechargement.
 */
function loadEntries(): Entry[] {
  let list: Entry[] = [];
  let migrated = false;
  try {
    const raw = localStorage.getItem(LS_LIST);
    if (raw) list = (JSON.parse(raw) as Entry[]).filter(e => e && typeof e.blob === 'string' && Number.isFinite(e.slot));
    const legacy = localStorage.getItem(LS_LEGACY);
    if (legacy && !list.some(e => e.slot === 1)) {
      list = [{ slot: 1, blob: legacy, at: Number(localStorage.getItem(LS_LEGACY_AT) || 0) || 0 }, ...list];
      migrated = true;
    }
  } catch { return []; }
  list = list.filter(e => e.slot >= 1 && e.slot <= MAX_DESIGNS).sort((a, b) => a.slot - b.slot);
  if (migrated) {
    localStorage.removeItem(LS_LEGACY);
    localStorage.removeItem(LS_LEGACY_AT);
    saveEntries(list);
  }
  return list;
}

function saveEntries(list: Entry[]) {
  try {
    if (list.length) localStorage.setItem(LS_LIST, JSON.stringify(list));
    else localStorage.removeItem(LS_LIST);
  } catch { return false; }   // stockage privé / plein
  return true;
}

function entryFor(slot: number): Entry | null {
  return loadEntries().find(e => e.slot === slot) || null;
}

/** Le design d'un emplacement, ou null (aucun, ou fichier devenu illisible). */
export function getDesign(slot = 1): InstalledDesign | null {
  const hit = cache.get(slot);
  if (hit === 'invalid') return null;
  if (hit) return hit;
  const e = entryFor(slot);
  if (!e) return null;
  try {
    const { meta, code, sig } = readBlob(e.blob);
    const design: InstalledDesign = { slot, meta, sig, installedAt: e.at || 0, component: evaluate(code) };
    cache.set(slot, design);
    return design;
  } catch {
    cache.set(slot, 'invalid');   // falsifié à la main dans le stockage : on n'exploite pas
    return null;
  }
}

/** Compat avec l'appel d'avant le multi-emplacements. */
export function getInstalledDesign(slot = 1): InstalledDesign | null { return getDesign(slot); }

/** Tous les designs installés et lisibles, dans l'ordre des emplacements. */
export function listDesigns(): InstalledDesign[] {
  return loadEntries().map(e => getDesign(e.slot)).filter((d): d is InstalledDesign => !!d);
}

export type InstallResult =
  | { ok: true; meta: DesignMeta; slot: number; id: TemplateId }
  | { ok: false; error: string };

/**
 * Vérifie un fichier reçu du vendeur et l'installe.
 * `slot` fourni → on remplace cet emplacement (documents déjà rédigés préservés).
 * Sinon → premier emplacement libre.
 */
export async function installDesignFile(text: string, opts?: { slot?: number }): Promise<InstallResult> {
  const parsed = await unpackDesignFile(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const entries = loadEntries();
  const asked = opts && typeof opts.slot === 'number' ? Math.floor(opts.slot) : 0;
  if (asked > MAX_DESIGNS) {
    return { ok: false, error: `Emplacement inconnu (n° ${asked}) : l’application garde jusqu’à ${MAX_DESIGNS} designs.` };
  }
  let slot = Math.max(0, asked);
  if (!slot) {
    for (let i = 1; i <= MAX_DESIGNS; i++) {
      if (!entries.some(e => e.slot === i)) { slot = i; break; }
    }
  }
  if (!slot) {
    return { ok: false, error: `Vous avez déjà ${MAX_DESIGNS} designs installés. Retirez-en un pour importer celui-ci, ou remplacez-le depuis la liste.` };
  }
  try {
    evaluate(parsed.file.code);   // refus net si le code ne fournit pas de composant
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Le code du modèle ne s’exécute pas.' };
  }
  const list = entries.filter(e => e.slot !== slot);
  const next = [...list, { slot, blob: text.trim(), at: Date.now() }].sort((a, b) => a.slot - b.slot);
  if (!saveEntries(next)) {
    return { ok: false, error: 'Impossible d’enregistrer le design sur cet appareil (stockage du navigateur indisponible ou plein). Refermez les onglets inutiles et réessayez.' };
  }
  cache.delete(slot);
  notify();
  return { ok: true, meta: parsed.file.meta, slot, id: designIdForSlot(slot) };
}

/** Remplace un emplacement précis (correction envoyée par le vendeur). */
export function replaceDesignFile(text: string, slot: number): Promise<InstallResult> {
  return installDesignFile(text, { slot });
}

/** Retire un emplacement, ou tous si aucun numéro n'est donné. */
export function uninstallDesign(slot?: number) {
  const entries = loadEntries();
  const next = slot ? entries.filter(e => e.slot !== slot) : [];
  saveEntries(next);
  if (slot) cache.delete(slot); else cache.clear();
  notify();
}

/**
 * Restaurer depuis une sauvegarde JSON : chaque blob est revérifié (signature),
 * puis placé à SON emplacement — le tableau est positionnel, un trou est un
 * `null` — afin qu'un devis qui portait « custom-3 » retrouve bien le design 3.
 * mode « append » (import par fusion) : on ne touche à rien d'existant, on prend
 * les emplacements libres.
 */
export async function adoptDesignBlobs(blobs: unknown, mode: 'exact' | 'append' = 'exact'): Promise<number> {
  const list: unknown[] = Array.isArray(blobs) ? blobs : (typeof blobs === 'string' && blobs.trim() ? [blobs] : []);
  let done = 0;
  for (let i = 0; i < Math.min(list.length, MAX_DESIGNS); i++) {
    const b = list[i];
    if (typeof b !== 'string' || !b.trim()) continue;
    const r = await installDesignFile(b, mode === 'exact' ? { slot: i + 1 } : undefined);
    if (r.ok) done++;
    else console.warn('Design personnalisé non restauré : ' + r.error);
  }
  return done;
}

/** @deprecated ancien nom (un seul design) — conservé pour les tests et les appels directs. */
export function adoptDesignBlob(blob: unknown): Promise<boolean> {
  return adoptDesignBlobs(blob).then(n => n > 0);
}

/**
 * Les blobs signés pour la sauvegarde JSON, indexés par emplacement :
 * `[blob, null, blob]` = emplacements 1 et 3 occupés. Les `null` de fin sont
 * coupés. Un trou se traduirait sinon par un design qui change de numéro.
 */
export function designBlobsForBackup(): (string | null)[] | undefined {
  const entries = loadEntries();
  if (!entries.length) return undefined;
  const out: (string | null)[] = [];
  for (let i = 1; i <= MAX_DESIGNS; i++) {
    const e = entries.find(x => x.slot === i);
    out.push(e ? e.blob : null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** @deprecated nom de l'époque « un seul design ». */
export function designBlobForBackup(): string | undefined {
  return designBlobsForBackup()?.[0] ?? undefined;
}

/** Reconstruit un fichier signé (tests, outils du vendeur). */
export function buildDesignFile(meta: DesignMeta, code: string): Promise<string> {
  return packDesignFile(meta, code);
}

export function customTemplateInfos(): TemplateInfo[] {
  return listDesigns().map(d => ({
    id: designIdForSlot(d.slot),
    name: (d.meta.name || `Mon design ${d.slot}`).slice(0, 28),
    description: (d.meta.desc || `Design personnalisé n° ${d.slot} livré par le vendeur`).slice(0, 90),
  }));
}

/** Le design du premier emplacement (affichage « votre design » dans le paywall). */
export function customTemplateInfo(): TemplateInfo | null {
  return customTemplateInfos()[0] || null;
}

/** Composant d'un id « custom… », ou null si ce n'est pas un design importé / installé. */
export function resolveCustomTemplate(id: string): TemplateComponent | null {
  const slot = slotOfDesignId(id);
  if (!slot) return null;
  return getDesign(slot)?.component || null;
}
