import { DocType, QuoteData, QuoteItem, SavedClient, SavedEmitter, SavedService } from './types';
import { getExportCount, setExportCountAtLeast } from './lib/license';
import { adoptDesignBlobs, designBlobsForBackup } from './lib/customDesign';

const DOCS_KEY = 'devis_designer_docs';
const CLIENTS_KEY = 'devis_designer_clients';
const EMITTERS_KEY = 'devis_designer_emitters';
const EMITTER_DEFAULT_KEY = 'devis_designer_emitter_default';
const SERVICES_KEY = 'devis_designer_services';

const uid = () => Math.random().toString(36).slice(2, 9);
/** Une clé de stockage n'est jamais fiable : tout passe par là à la lecture. */
const toStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export function getNextNumber(docType: DocType): string {
  const year = new Date().getFullYear();
  const prefix = docType === 'devis' ? 'DEV' : 'FAC';
  const docs = loadAllDocs();
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const d of docs) {
    const m = d.quoteNumber.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

export function createDefaultDoc(partial?: Partial<QuoteData>): QuoteData {
  const now = Date.now();
  const docType = partial?.docType || 'devis';
  const autoNum = getNextNumber(docType);
  /* L'émetteur marqué « par défaut » dans le carnet pré-remplit l'en-tête : c'est la
     fin du « je retape mes coordonnées à chaque devis ». Un `partial` explicite gagne. */
  const mine = defaultEmitter();
  return {
    id: uid(),
    docType,
    status: 'brouillon',
    designerName: mine?.name || '',
    designerTitle: mine?.title || '',
    designerEmail: mine?.email || '',
    designerPhone: mine?.phone || '',
    designerAddress: mine?.address || '',
    designerSiret: mine?.siret || '',
    designerLogo: mine?.logo || '',
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    clientAddress: '',
    quoteNumber: autoNum,
    quoteDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    items: [
      { id: uid(), description: 'Nouvelle prestation', quantity: 1, unitPrice: 0 },
    ],
    notes: 'Acompte de 30% a la signature du devis. Solde a la livraison finale.',
    taxRate: 18,
    accentColor: '#0057FF',
    currency: 'XOF',
    fontFamily: 'Inter',
    templateId: 'modern',
    designerSignature: '',
    designerSignedAt: '',
    clientSignature: '',
    clientSignedAt: '',
    showWatermark: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function newItemRow(): QuoteItem {
  return { id: uid(), description: 'Nouvelle prestation', quantity: 1, unitPrice: 0 };
}

/* Normalise un document : garantit des types valides même si les données
   proviennent d'une ancienne version ou sont corrompues (anti-page blanche). */
function normalizeDoc(d: Partial<QuoteData> & Record<string, unknown> | null | undefined): QuoteData {
  if (!d || typeof d !== 'object') {
    // Document vide : retourne un document par défaut (ne plante jamais)
    const now = Date.now();
    return {
      id: Math.random().toString(36).slice(2),
      docType: 'devis', status: 'brouillon',
      designerName: '', designerTitle: '', designerEmail: '', designerPhone: '', designerAddress: '', designerSiret: '',
      designerLogo: '', clientName: '', clientCompany: '', clientEmail: '', clientAddress: '',
      quoteNumber: 'DEV-' + now.toString().slice(-4), quoteDate: '', validUntil: '',
      items: [], notes: '', taxRate: 0, accentColor: '#0057FF', currency: 'XOF',
      fontFamily: 'Inter', templateId: 'modern',
      designerSignature: '', designerSignedAt: '', clientSignature: '', clientSignedAt: '',
      showWatermark: true, createdAt: now, updatedAt: now,
    };
  }
  const items = Array.isArray(d.items)
    ? d.items.map(it => ({
        id: typeof it?.id === 'string' ? it.id : Math.random().toString(36).slice(2),
        description: typeof it?.description === 'string' ? it.description : '',
        quantity: typeof it?.quantity === 'number' && isFinite(it.quantity) && it.quantity > 0 ? it.quantity : 1,
        unitPrice: typeof it?.unitPrice === 'number' && isFinite(it.unitPrice) && it.unitPrice >= 0 ? it.unitPrice : 0,
      }))
    : [];
  const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && isFinite(v) ? v : fallback);
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
  const now = Date.now();

  return {
    id: str(d.id, Math.random().toString(36).slice(2)),
    docType: d.docType === 'facture' ? 'facture' : 'devis',
    status: d.status === 'envoye' || d.status === 'accepte' || d.status === 'refuse' || d.status === 'paye' ? d.status : 'brouillon',
    designerName: str(d.designerName),
    designerTitle: str(d.designerTitle),
    designerEmail: str(d.designerEmail),
    designerPhone: str(d.designerPhone),
    designerAddress: str(d.designerAddress),
    designerSiret: str(d.designerSiret),
    designerLogo: str(d.designerLogo),
    clientName: str(d.clientName),
    clientCompany: str(d.clientCompany),
    clientEmail: str(d.clientEmail),
    clientAddress: str(d.clientAddress),
    quoteNumber: str(d.quoteNumber, 'DEV-' + now.toString().slice(-4)),
    quoteDate: str(d.quoteDate),
    validUntil: str(d.validUntil),
    items,
    notes: str(d.notes),
    taxRate: num(d.taxRate, 0),
    accentColor: str(d.accentColor, '#0057FF'),
    currency: d.currency === 'EUR' || d.currency === 'USD' ? d.currency : 'XOF',
    fontFamily: str(d.fontFamily, 'Inter'),
    templateId: (d.templateId as QuoteData['templateId']) || 'modern',
    designerSignature: str(d.designerSignature),
    designerSignedAt: str(d.designerSignedAt),
    clientSignature: str(d.clientSignature),
    clientSignedAt: str(d.clientSignedAt),
    showWatermark: bool(d.showWatermark, true),
    textOverrides: d.textOverrides && typeof d.textOverrides === 'object' ? d.textOverrides as QuoteData['textOverrides'] : undefined,
    createdAt: num(d.createdAt, now),
    updatedAt: num(d.updatedAt, now),
  };
}

export function loadAllDocs(): QuoteData[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as (Partial<QuoteData> & Record<string, unknown>)[];
    return arr.map(normalizeDoc);
  } catch { return []; }
}

export function saveAllDocs(docs: QuoteData[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export function saveDoc(doc: QuoteData) {
  const docs = loadAllDocs();
  const idx = docs.findIndex(d => d.id === doc.id);
  const updated = { ...doc, updatedAt: Date.now() };
  if (idx >= 0) docs[idx] = updated; else docs.unshift(updated);
  saveAllDocs(docs);
  learnServices(updated.items, updated.id);   // le carnet de prestations suit le devis, tout seul
  return updated;
}

export function deleteDoc(id: string) {
  saveAllDocs(loadAllDocs().filter(d => d.id !== id));
}

export function duplicateDoc(doc: QuoteData): QuoteData {
  const now = Date.now();
  const dup: QuoteData = {
    ...doc,
    id: uid(),
    quoteNumber: getNextNumber(doc.docType),
    status: 'brouillon',
    designerSignature: '',
    designerSignedAt: '',
    clientSignature: '',
    clientSignedAt: '',
    createdAt: now,
    updatedAt: now,
    items: doc.items.map(i => ({ ...i, id: uid() })),
  };
  const docs = loadAllDocs();
  docs.unshift(dup);
  saveAllDocs(docs);
  return dup;
}

export function convertToInvoice(doc: QuoteData): QuoteData {
  const now = Date.now();
  const inv: QuoteData = {
    ...doc,
    id: uid(),
    docType: 'facture',
    status: 'envoye',
    quoteNumber: getNextNumber('facture'),
    createdAt: now,
    updatedAt: now,
    items: doc.items.map(i => ({ ...i, id: uid() })),
  };
  const docs = loadAllDocs();
  docs.unshift(inv);
  saveAllDocs(docs);
  return inv;
}

export function loadClients(): SavedClient[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as (Partial<SavedClient> & Record<string, unknown>)[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(c => c && typeof c === 'object').map(c => ({
      id: typeof c.id === 'string' ? c.id : Math.random().toString(36).slice(2),
      name: typeof c.name === 'string' ? c.name : '',
      company: typeof c.company === 'string' ? c.company : '',
      email: typeof c.email === 'string' ? c.email : '',
      address: typeof c.address === 'string' ? c.address : '',
    }));
  } catch { return []; }
}
export function saveClient(c: SavedClient) { const clients = loadClients(); const idx = clients.findIndex(x => x.id === c.id); if (idx >= 0) clients[idx] = c; else clients.unshift(c); localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients)); }
export function deleteClient(id: string) { localStorage.setItem(CLIENTS_KEY, JSON.stringify(loadClients().filter(c => c.id !== id))); }

/* ============================================================
   CARNET D'ÉMETTEURS — la fiche de VOTRE entreprise, réutilisée
   ------------------------------------------------------------
   Mêmes règles que le carnet de clients : stockage local, normalisation
   à la lecture (données anciennes ou bricolées à la main), upsert par id.
   L'émetteur marqué « par défaut » pré-remplit chaque nouveau document.
   ============================================================ */

export function loadEmitters(): SavedEmitter[] {
  try {
    const raw = localStorage.getItem(EMITTERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as (Partial<SavedEmitter> & Record<string, unknown>)[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(e => e && typeof e === 'object').map(e => ({
      id: typeof e.id === 'string' ? e.id : uid(),
      label: typeof e.label === 'string' && e.label.trim() ? e.label : (typeof e.name === 'string' ? e.name : 'Émetteur'),
      name: toStr(e.name), title: toStr(e.title), email: toStr(e.email), phone: toStr(e.phone),
      address: toStr(e.address), siret: toStr(e.siret), logo: toStr(e.logo),
    }));
  } catch { return []; }
}

/** Écrit le carnet. Un logo PNG en dataURL pèse lourd : si le stockage refuse,
    on garde les textes et on lâche les logos — la fiche reste utilisable. */
function persistEmitters(list: SavedEmitter[]): { saved: boolean; withLogo: boolean } {
  try { localStorage.setItem(EMITTERS_KEY, JSON.stringify(list)); return { saved: true, withLogo: true }; }
  catch {
    try {
      localStorage.setItem(EMITTERS_KEY, JSON.stringify(list.map(e => ({ ...e, logo: '' }))));
      return { saved: true, withLogo: false };
    } catch { return { saved: false, withLogo: false }; }
  }
}

export function saveEmitter(e: SavedEmitter): { saved: boolean; withLogo: boolean } {
  const list = loadEmitters();
  const idx = list.findIndex(x => x.id === e.id);
  if (idx >= 0) list[idx] = e; else list.unshift(e);
  const r = persistEmitters(list);
  if (!localStorage.getItem(EMITTER_DEFAULT_KEY)) localStorage.setItem(EMITTER_DEFAULT_KEY, e.id);
  return r;
}

export function deleteEmitter(id: string) {
  const rest = loadEmitters().filter(e => e.id !== id);
  persistEmitters(rest);
  if (localStorage.getItem(EMITTER_DEFAULT_KEY) === id) {
    if (rest[0]) localStorage.setItem(EMITTER_DEFAULT_KEY, rest[0].id);
    else localStorage.removeItem(EMITTER_DEFAULT_KEY);
  }
}

export function setDefaultEmitter(id: string) { localStorage.setItem(EMITTER_DEFAULT_KEY, id); }

export function getDefaultEmitterId(): string {
  try { return localStorage.getItem(EMITTER_DEFAULT_KEY) || defaultEmitter()?.id || ''; } catch { return ''; }
}

/** L'émetteur qui pré-remplit les nouveaux documents (sinon le premier du carnet). */
export function defaultEmitter(): SavedEmitter | null {
  const list = loadEmitters();
  if (!list.length) return null;
  const id = localStorage.getItem(EMITTER_DEFAULT_KEY);
  return list.find(e => e.id === id) || list[0];
}

/* ============================================================
   CARNET DE PRESTATIONS — vos lignes habituelles, réutilisées d'un devis à l'autre
   ------------------------------------------------------------
   Règles volontairement sobres, parce qu'un carnet qui se remplit tout seul doit
   surtout ne pas se salir :
     - une seule entrée par intitulé (comparaison normalisée : casse et espaces
       confondus, « 3 propositions » et « 3    propositions » sont la même ligne) ;
     - les intitulés vides ou par défaut (« Nouvelle prestation ») ne sont JAMAIS
       mémorisés : c'est le clavier qui les écrit, pas le métier ;
     - le prix suit la dernière fois où la ligne a été posée ;
     - `uses` compte des DOCUMENTS différents, pas des sauvegardes automatiques
       (l'autosave joue toutes les 3 s : sans ce garde-fou le carnet exploserait) ;
     - plafonné à SERVICE_MAX, les plus facturées remontent, le reste s'efface ;
     - tout reste dans le navigateur (clé `devis_designer_services`), et voyage dans
       la sauvegarde JSON comme le reste — sans ça, changer de poste remettrait le
       carnet à zéro et ferait retaper les tarifs.
   ============================================================ */

export const SERVICE_MAX = 80;
const PLACEHOLDER_LINE = /^nouvelle prestation$/i;

/** Ce qui sert à comparer deux intitulés (le texte affiché garde sa casse). */
export const normServiceLabel = (v: unknown): string => toStr(v, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Une entrée du carnet, lue n'importe comment : normalisée ou rejetée, jamais demi-valide. */
export function normalizeService(s: unknown): SavedService | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const label = toStr(o.label, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!label || PLACEHOLDER_LINE.test(label)) return null;
  const price = typeof o.unitPrice === 'number' && isFinite(o.unitPrice) && o.unitPrice >= 0 ? o.unitPrice : 0;
  const docs = (Array.isArray(o.docs) ? o.docs : []).filter(d => typeof d === 'string').slice(0, 40) as string[];
  const uses = typeof o.uses === 'number' && isFinite(o.uses) ? Math.max(docs.length, Math.floor(o.uses)) : docs.length;
  return { id: toStr(o.id) || uid(), label, unitPrice: price, docs, uses, lastAt: typeof o.lastAt === 'number' ? o.lastAt : 0 };
}

const byHabit = (a: SavedService, b: SavedService) => b.uses - a.uses || b.lastAt - a.lastAt;

export function loadServices(): SavedService[] {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeService).filter((x): x is SavedService => !!x).sort(byHabit);
  } catch { return []; }
}

function writeServices(list: SavedService[]) {
  try { localStorage.setItem(SERVICES_KEY, JSON.stringify(list.slice(0, SERVICE_MAX))); return true; }
  catch { return false; }   // stockage saturé : le carnet se réduit, les devis passent avant
}

/** Mémorise (ou met à jour) une ligne. `docId` vide = ajout à la main, sans compteur d'usage. */
export function rememberService(label: string, unitPrice: number, docId = ''):
  { ok: boolean; added: boolean; priceChanged: boolean; message: string } {
  const clean = toStr(label, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const norm = normServiceLabel(clean);
  if (!norm || PLACEHOLDER_LINE.test(norm)) {
    return { ok: false, added: false, priceChanged: false, message: 'Renseignez un intitulé de prestation pour le mémoriser.' };
  }
  const price = typeof unitPrice === 'number' && isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
  const list = loadServices();
  const i = list.findIndex(s => normServiceLabel(s.label) === norm);
  const now = Date.now();
  if (i < 0) {
    list.unshift({ id: uid(), label: clean, unitPrice: price, docs: docId ? [docId] : [], uses: docId ? 1 : 0, lastAt: now });
    list.sort(byHabit);
    writeServices(list);
    return { ok: true, added: true, priceChanged: false, message: `« ${clean} » mémorisée (${price}).` };
  }
  const e = list[i];
  const priceChanged = e.unitPrice !== price;
  if (priceChanged) e.unitPrice = price;
  if (docId && !e.docs.includes(docId)) { e.docs.push(docId); e.uses += 1; }
  if (priceChanged || docId) e.lastAt = now;
  list.sort(byHabit);
  writeServices(list);
  return { ok: true, added: false, priceChanged, message: priceChanged ? `Prix de « ${clean} » mis à jour : ${price}.` : `« ${clean} » était déjà mémorisée.` };
}

export function deleteService(id: string) {
  writeServices(loadServices().filter(s => s.id !== id));
}

/**
 * Appelé à chaque enregistrement de document : le carnet apprend les lignes.
 * Idempotent par construction (mêmes lignes, même doc, même prix = aucune écriture),
 * sinon l'autosave écrirait le stock toutes les trois secondes.
 */
export function learnServices(items: QuoteItem[], docId: string): number {
  if (!Array.isArray(items) || !items.length) return 0;
  const list = loadServices();
  const now = Date.now();
  let changed = 0;
  for (const it of items) {
    const norm = normServiceLabel(it && it.description);
    if (!norm || PLACEHOLDER_LINE.test(norm)) continue;
    const price = typeof it.unitPrice === 'number' && isFinite(it.unitPrice) && it.unitPrice >= 0 ? it.unitPrice : 0;
    const i = list.findIndex(s => normServiceLabel(s.label) === norm);
    if (i < 0) {
      list.unshift({ id: uid(), label: toStr(it.description, '').replace(/\s+/g, ' ').trim().slice(0, 100), unitPrice: price, docs: docId ? [docId] : [], uses: docId ? 1 : 0, lastAt: now });
      changed++;
      continue;
    }
    const e = list[i];
    const priceChanged = e.unitPrice !== price;
    const freshDoc = !!docId && !e.docs.includes(docId);
    if (priceChanged) e.unitPrice = price;
    if (freshDoc) { e.docs.push(docId); e.uses += 1; }
    if (priceChanged || freshDoc) { e.lastAt = now; changed++; }
  }
  if (changed) { list.sort(byHabit); writeServices(list); }
  return changed;
}

/* ============================================================
   Sauvegarde / restauration complète (export & import JSON)
   ============================================================ */

export interface BackupData {
  app: 'devis-designer';
  /** v2 : le compteur d'exports voyage avec la sauvegarde (anti « navigation privée »).
      v3 : le carnet d'émetteurs (et le choix par défaut) voyage aussi.
      v4 : le carnet de prestations (les lignes habituelles et leurs tarifs). */
  version: 4;
  exportedAt: string;
  docs: QuoteData[];
  clients: SavedClient[];
  /** Nombre d'exports déjà consommés sur l'appareil qui a exporté la sauvegarde. */
  exportCount?: number;
  /**
   * Designs personnalisés du client (fichiers signés, texte brut) : sans eux, un
   * changement de poste ferait perdre les modèles payés 5 000 F pièce. Chacun est
   * revérifié à la restauration, donc un fichier édité à la main est rejeté.
   */
  /** Carnet d'émetteurs : sans lui, changer de poste = retaper ses coordonnées. */
  emitters?: SavedEmitter[];
  emitterDefault?: string;
  /** Carnet de prestations : sans lui, changer de poste = retaper chaque tarif ligne par ligne. */
  services?: SavedService[];
  customDesigns?: (string | null)[];
  /** @deprecated avant l'époque « plusieurs designs » : un seul blob. */
  customDesign?: string;
}

/** Exporte toutes les données (devis + clients) en fichier JSON téléchargeable. */
export function exportAllData(): BackupData {
  return {
    app: 'devis-designer',
    version: 4,
    exportedAt: new Date().toISOString(),
    docs: loadAllDocs(),
    clients: loadClients(),
    emitters: loadEmitters(),
    services: loadServices(),
    emitterDefault: localStorage.getItem(EMITTER_DEFAULT_KEY) || undefined,
    exportCount: getExportCount(),
    customDesigns: designBlobsForBackup(),
  };
}

/** Téléchargement sécurisé : ne plante JAMAIS (contrairement à appendChild+removeChild). */
export function downloadBlob(blob: Blob, filename: string) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // remove() est sûr : ne lève pas d'erreur même si le nœud a déjà été retiré
    setTimeout(() => {
      if (a.isConnected) a.remove();
      URL.revokeObjectURL(a.href);
    }, 100);
  } catch (err) {
    console.error('Téléchargement échoué:', err);
  }
}

export function downloadBackup() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  downloadBlob(blob, 'devis-designer-sauvegarde-' + stamp + '.json');
}

/**
 * Restaure les données depuis un fichier JSON de sauvegarde.
 * Mode 'merge' : ajoute les documents (en évitant les doublons par id).
 * Mode 'replace' : remplace tout.
 */
export function importAllData(json: string, mode: 'merge' | 'replace' = 'merge'): { ok: boolean; message: string } {
  try {
    const data = JSON.parse(json) as Partial<BackupData>;
    if (data.app !== 'devis-designer' || !Array.isArray(data.docs)) {
      return { ok: false, message: 'Fichier de sauvegarde invalide.' };
    }
    const incomingDocs = (data.docs || []).filter(d => d && typeof d.id === 'string' && d.quoteNumber);
    const incomingClients = (data.clients || []).filter(c => c && typeof c.id === 'string');

    // Le compteur d'exports suit les données : on ne reprend JAMAIS un quota
    // "neuf" en réimportant une sauvegarde sur un appareil vierge (max retenu).
    const restoredCount = typeof data.exportCount === 'number' ? setExportCountAtLeast(data.exportCount) : getExportCount();

    /* Le design personnalisé est revérifié (signature) puis réinstallé. C'est
       asynchrone : on n'attend pas le résultat pour valider l'import des documents
       (un blob falsifié ne s'installe simplement pas). En mode « remplacer », un
       design déjà présent sur l'appareil est conservé si la sauvegarde n'en
       contient pas : on n'efface pas un modèle payé à l'occasion d'un import. */
    function restoreDesign(blobs: unknown, legacy?: unknown): string {
      const list = Array.isArray(blobs) ? blobs : (typeof legacy === 'string' && legacy.trim() ? [legacy] : []);
      if (!list.length) return '';
      void adoptDesignBlobs(list, mode === 'replace' ? 'exact' : 'append')
        .then(n => { if (!n) console.warn('Aucun design personnalisé restauré (signatures invalides).'); });
      return ` ${list.length} design(s) personnalisé(s) restauré(s) aussi (vérification des signatures en cours).`;
    }
    const designNote = restoreDesign(data.customDesigns, data.customDesign);

    /* Le carnet d'émetteurs suit la même logique que les clients — à cette différence
       près qu'une copie ancienne (avant la clé `emitters`) ne doit SURTOUT pas vider le
       carnet de l'appareil : l'absence de clé se lit « rien à restaurer », pas « zéro fiche ». */
    function restoreEmitters(): string {
      const hasKey = Array.isArray(data.emitters);
      const incoming = hasKey ? (data.emitters as SavedEmitter[]).filter(e => e && typeof e === 'object') : [];
      if (data.emitterDefault && incoming.some(e => e.id === data.emitterDefault)) {
        localStorage.setItem(EMITTER_DEFAULT_KEY, data.emitterDefault);
      }
      if (!hasKey) return loadEmitters().length ? ' Fiches émetteurs du carnet conservées (cette copie est plus ancienne).' : '';
      if (mode === 'replace') {
        persistEmitters(incoming);
        return ` ${incoming.length} fiche(s) émetteur(s) restaurée(s).`;
      }
      const byKey = new Map(loadEmitters().map(e => [e.name.trim().toLowerCase() || e.id, e]));
      let added = 0;
      for (const e of incoming) {
        const k = e.name.trim().toLowerCase() || e.id;
        if (!byKey.has(k)) { byKey.set(k, e); added++; }
      }
      if (added) persistEmitters(Array.from(byKey.values()));
      return added ? ` ${added} fiche(s) émetteur(s) ajoutée(s).` : '';
    }
    const emitterNote = restoreEmitters();

    /* Le carnet de prestations, lui, ne se remplace pas à l'aveugle en fusion : une ligne
       déjà présente garde son ancienneté (le prix importé ne doit pas écraser un tarif que
       l'on est en train de changer sur cet appareil). En « remplacer », en revanche, on
       repart bien de la copie — c'est ce que le bouton annonce. */
    function restoreServices(): string {
      if (!Array.isArray(data.services)) return loadServices().length ? ' Prestations du carnet conservées (cette copie est plus ancienne).' : '';
      const incoming = (data.services as unknown[]).map(normalizeService).filter((x): x is SavedService => !!x);
      if (mode === 'replace') {
        writeServices(incoming.sort(byHabit));
        return ` ${incoming.length} prestation(s) mémorisée(s) restaurée(s).`;
      }
      const list = loadServices();
      let added = 0;
      for (const s of incoming) {
        const i = list.findIndex(x => normServiceLabel(x.label) === normServiceLabel(s.label));
        if (i < 0) { list.push(s); added++; }
        else { list[i].uses = Math.max(list[i].uses, s.uses); list[i].lastAt = Math.max(list[i].lastAt, s.lastAt); }
      }
      list.sort(byHabit);
      writeServices(list);
      return added ? ` ${added} prestation(s) mémorisée(s) ajoutée(s) au carnet.` : '';
    }
    const servicesNote = restoreServices();

    if (mode === 'replace') {
      saveAllDocs(incomingDocs);
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(incomingClients));
      return { ok: true, message: `${incomingDocs.length} document(s) et ${incomingClients.length} client(s) restaurés.${emitterNote}${servicesNote}${restoredCount ? ` Compteur d'exports : ${restoredCount} consommé(s).` : ''}${designNote}` };
    }

    // Merge : on garde les existants, on ajoute les nouveaux
    const existing = loadAllDocs();
    const byId = new Map(existing.map(d => [d.id, d]));
    for (const d of incomingDocs) if (!byId.has(d.id)) byId.set(d.id, d);
    const mergedDocs = Array.from(byId.values());

    const existingClients = loadClients();
    const cById = new Map(existingClients.map(c => [c.id, c]));
    for (const c of incomingClients) if (!cById.has(c.id)) cById.set(c.id, c);
    const mergedClients = Array.from(cById.values());

    saveAllDocs(mergedDocs);
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(mergedClients));
    return { ok: true, message: `${incomingDocs.length} document(s) importé(s) (${mergedDocs.length} au total).${emitterNote}${servicesNote}${restoredCount ? ` Compteur d'exports : ${restoredCount} consommé(s).` : ''}${designNote}` };
  } catch {
    return { ok: false, message: 'Impossible de lire ce fichier.' };
  }
}
