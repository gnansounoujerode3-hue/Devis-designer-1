/* ============================================================
   Système de monétisation — licences, quota d'EXPORTS et codes
   ------------------------------------------------------------
   Offres (v2) :
   - 20 EXPORTS PDF / envois signature GRATUITS par installation
   - Abonnement mensuel     : 2 000 F / mois
   - Abonnement 1 an        : 15 000 F / an
   - Design personnalisé    : 5 000 F (paiement unique)
   - TOUS les designs 1 an  : 50 000 F / an
   ------------------------------------------------------------
   SEULE récompense gratuite de l'application : le PARRAINAGE.
   1 parrainage valide = 1 MOIS GRATUIT POUR LE PARRAIN
   (le filleul, lui, ne reçoit rien) — plafond 12 mois offerts / an.
   Il n'y a aucun concours, aucun « mois gratuits » supplémentaire.
   ------------------------------------------------------------
   La CRÉATION de devis est libre. Le quota s'applique aux
   EXPORTS PDF et aux ENVOIS POUR SIGNATURE (compteur commun).
   ============================================================ */

export const FREE_EXPORT_LIMIT = 20;
export const PRICE_MONTHLY = 2000;
export const PRICE_ANNUAL = 15000;
export const PRICE_CUSTOM_DESIGN = 5000;
export const PRICE_ALL = 50000;

/* ---------------- Parrainage (unique politique de mois offerts) ---------------- */

/** Mois offerts au parrain pour chaque parrainage valide. */
export const REF_REWARD_MONTHS = 1;
/** Plafond de mois offerts cumulés par un parrain sur 12 mois glissants. */
export const REF_MAX_MONTHS_PER_YEAR = 12;
/** Clé localStorage du code parrain de CETTE installation. */
export const REF_CODE_KEY = 'dd_ref_mycode';

/** Code parrain de l'installation, s'il existe déjà (ne le génère pas). */
export function getLocalRefCode(): string | null {
  try { return localStorage.getItem(REF_CODE_KEY); } catch { return null; }
}

/**
 * Empreinte courte (7 caractères) d'un code parrain.
 * Sert à lier un code récompense à son destinataire : le mois offert
 * n'est activable QUE sur l'installation du parrain concerné.
 */
export function refFingerprint(code: string): string {
  const s = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

export type LicenseType = 'free' | 'monthly' | 'annual' | 'all';
export type CodeKind = 'MONTHLY' | 'ANNUAL' | 'ALL' | 'DESIGN' | 'REFERRAL';

export interface LicenseState {
  type: LicenseType;
  /** timestamp ms d'expiration (monthly / annual / all) */
  expiresAt: number;
  /** design personnalisé acheté (5 000 F) */
  customDesign: boolean;
}

const LS_LICENSE = 'dd_license_v2';
const LS_COUNT = 'dd_export_count_v1';
const LS_FAIL = 'dd_license_fails';
const LS_LOCK = 'dd_license_lock';
const IDB_NAME = 'dd_storage', IDB_STORE = 'kv';

/* ------------------------------------------------------------------
   Clé secrète de signature des codes d'activation.
   Encodée (base64) pour ne pas apparaître en clair dans le bundle.
   Sécurité relative : un initié peut la retrouver. La protection
   réelle vient du serveur de validation (voir docs). Durcissement :
   - secret non lisible directement
   - codes valables 30 jours seulement (limitent les fuites)
   - verrouillage après 5 codes erronés (anti-brute-force)
   - compteur d'exports sauvegardé à double emplacement
   ------------------------------------------------------------------ */
const SECRET = [
  'ZDN2MXM=', 'ZDNzMWduM3I=', 'YjNuaW4=', 'Mm8yNA==',
  'eDlmMg==', 'azRtNw==', 'cTh6MQ==', 'dzVwMw==',
].map(s => atob(s)).join('-');

/** Durée de validité d'un code d'activation (depuis sa génération). */
const CODE_VALIDITY_MS = 30 * 86400000;
/** Verrouillage anti-brute-force : 5 échecs, 1 heure de blocage. */
const MAX_FAILS = 5;
const LOCK_MS = 60 * 60 * 1000;

const MONTH_MS = 30 * 86400000;
const YEAR_MS = 365 * 86400000;

/* ---------------- Utilitaires encodage (base32) ---------------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32encode(bytes: Uint8Array): string {
  let out = '';
  let bits = 0, value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function b32decode(s: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0, value = 0;
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v < 0) continue;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(bytes);
}

function utf8(str: string): Uint8Array { return new TextEncoder().encode(str); }
function fromUtf8(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- Lecture / écriture état ---------------- */

/** Migration depuis l'ancien schéma (v1 : 'lifetime'  'annual'). */
export function loadLicense(): LicenseState {
  try {
    const raw = localStorage.getItem(LS_LICENSE) || localStorage.getItem('dd_license_v1');
    if (!raw) return { type: 'free', expiresAt: 0, customDesign: false };
    const l = JSON.parse(raw) as { type: string; expiresAt?: number; customDesign?: boolean };
    // Migration : 'lifetime' (ancien)  'annual' 1 an
    const type: LicenseType = l.type === 'lifetime' ? 'annual'
      : (l.type === 'monthly' || l.type === 'annual' || l.type === 'all' ? l.type : 'free');
    const expiresAt = l.type === 'lifetime' ? Date.now() + YEAR_MS : (l.expiresAt || 0);
    if (type === 'monthly' || type === 'annual' || type === 'all') {
      if (expiresAt < Date.now()) return { type: 'free', expiresAt: 0, customDesign: !!l.customDesign };
    }
    return { type, expiresAt, customDesign: !!l.customDesign };
  } catch { return { type: 'free', expiresAt: 0, customDesign: false }; }
}

export function saveLicense(l: LicenseState) {
  localStorage.setItem(LS_LICENSE, JSON.stringify(l));
}

/** Nombre d'exports PDF / envois signature déjà consommés. */
export function getExportCount(): number {
  try { return parseInt(localStorage.getItem(LS_COUNT) || '0', 10) || 0; }
  catch { return 0; }
}

/* Sauvegarde de secours du compteur dans IndexedDB (survit au
   nettoyage du localStorage et rend le reset du quota plus difficile). */
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function idbPut(key: string, value: number) {
  try {
    const db = await idbOpen();
    return new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

async function idbGet(key: string): Promise<number | null> {
  try {
    const db = await idbOpen();
    return new Promise<number | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const rq = tx.objectStore(IDB_STORE).get(key);
      rq.onsuccess = () => resolve(typeof rq.result === 'number' ? rq.result : null);
      rq.onerror = () => resolve(null);
    });
  } catch { return null; }
}

/** À appeler à CHAQUE export PDF ou envoi pour signature réussi. */
export function incrementExportCount() {
  const n = getExportCount() + 1;
  localStorage.setItem(LS_COUNT, String(n));
  idbPut('export_count', n); // sauvegarde de secours (asynchrone)
}

/**
 * Restaure le compteur d'exports depuis IndexedDB si le localStorage
 * a été effacé ou trafiqué (à appeler au démarrage de l'app).
 */
export async function restoreExportCountFromBackup() {
  try {
    const backed = await idbGet('export_count');
    if (backed === null) {
      // première fois : sauvegarder la valeur locale
      idbPut('export_count', getExportCount());
      return;
    }
    if (backed > getExportCount()) {
      localStorage.setItem(LS_COUNT, String(backed));
    }
  } catch { /* ignore */ }
}

export function isLicensed(l: LicenseState): boolean {
  return l.type === 'monthly' || l.type === 'annual' || l.type === 'all';
}

/** Peut-on exporter / envoyer pour signature ? */
export function canExport(l: LicenseState): boolean {
  if (isLicensed(l)) return true;
  return getExportCount() < FREE_EXPORT_LIMIT;
}

export function remainingFree(l: LicenseState): number {
  if (isLicensed(l)) return Infinity;
  return Math.max(0, FREE_EXPORT_LIMIT - getExportCount());
}

/** Durée restante d'un abonnement (jours) — monthly / annual / all. */
export function daysLeft(l: LicenseState): number {
  if ((l.type !== 'monthly' && l.type !== 'annual' && l.type !== 'all') || !l.expiresAt) return 0;
  return Math.max(0, Math.ceil((l.expiresAt - Date.now()) / 86400000));
}

/* NOTE : il n'existe AUCUNE fonction « prolonger de N mois » accessible
   ailleurs que par l'activation d'un code. La seule source de mois
   gratuits de l'application est le parrainage (kind 'REFERRAL', ci-dessous). */

/* ---------------- Codes d'activation ---------------- */

export interface CodePayload {
  kind: CodeKind;
  months?: number;   // pour MONTHLY / REFERRAL
  iat: number;       // date d'émission
  /** Empreinte du code parrain destinataire (codes « parrainage » uniquement). */
  to?: string;
  /** Aléa d'émission : garantit deux codes générés à la même seconde différents. */
  n?: string;
}

/**
 * Génère un code d'activation (usages : espace vendeur, récompense de parrainage).
 * `bindTo` : code parrain destinataire — le code ne pourra alors être activé
 * que sur l'installation portant ce code parrain (un tiers ne peut pas s'en saisir).
 */
export async function generateCode(kind: CodeKind, months = 1, bindTo?: string): Promise<string> {
  const timed = kind === 'MONTHLY' || kind === 'REFERRAL';
  const payload: CodePayload = {
    kind,
    months: timed ? months : undefined,
    iat: Date.now(),
    to: bindTo ? refFingerprint(bindTo) : undefined,
    n: Math.random().toString(36).slice(2, 8),
  };
  const body = b32encode(utf8(JSON.stringify(payload)));
  const sig = b32encode(hexToBytes(await hmacHex(body, SECRET))).slice(0, 10);
  const raw = 'DD' + body + sig;
  return 'DD-' + raw.slice(2).match(/.{1,4}/g)!.join('-');
}

/**
 * Vérifie la signature d'un code SANS l'activer (et sans le compter dans
 * l'historique). Sert notamment à contrôler un code de récompense renvoyé par
 * le Worker avant de le proposer au parrain : un code non signé par le secret
 * de l'app, expiré ou destiné à un autre parrain est rejeté.
 */
export async function inspectCode(input: string): Promise<(CodePayload & { valid: boolean; expiresInDays: number }) | null> {
  const clean = (input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean.startsWith('DD') || clean.length < 14) return null;
  const raw = clean.slice(2);
  const body = raw.slice(0, -10);
  const sig = raw.slice(-10);
  const expected = b32encode(hexToBytes(await hmacHex(body, SECRET))).slice(0, 10);
  if (sig !== expected) return null;
  let payload: CodePayload;
  try { payload = JSON.parse(fromUtf8(b32decode(body))); } catch { return null; }
  if (!payload || typeof payload.kind !== 'string') return null;
  const age = Date.now() - (payload.iat || 0);
  return { ...payload, valid: age <= CODE_VALIDITY_MS, expiresInDays: Math.max(0, Math.ceil((CODE_VALIDITY_MS - age) / 86400000)) };
}

/** Empreinte du code parrain d'une installation (même algorithme que le Worker). */
export { refFingerprint as referralFingerprint };

/** Valide un code saisi par le client et active la licence correspondante. */
export async function applyCode(input: string): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean.startsWith('DD')) return { ok: false, message: 'Code invalide.' };

  /* --- Anti-brute-force : verrouillage après 5 codes erronés --- */
  const now0 = Date.now();
  try {
    const lockUntil = parseInt(localStorage.getItem(LS_LOCK) || '0', 10) || 0;
    if (lockUntil > now0) {
      const mins = Math.ceil((lockUntil - now0) / 60000);
      return { ok: false, message: `Trop de tentatives. Réessayez dans ${mins} minute(s).` };
    }
  } catch { /* ignore */ }

  const raw = clean.slice(2);
  const body = raw.slice(0, -10);
  const sig = raw.slice(-10);
  const expected = b32encode(hexToBytes(await hmacHex(body, SECRET))).slice(0, 10);
  if (sig !== expected) {
    registerFail();
    return { ok: false, message: 'Code invalide ou corrompu.' };
  }

  let payload: CodePayload;
  try { payload = JSON.parse(fromUtf8(b32decode(body))); }
  catch { registerFail(); return { ok: false, message: 'Code illisible.' }; }

  /* --- Durée de validité du code : 30 jours après génération --- */
  if (!payload.iat || now0 - payload.iat > CODE_VALIDITY_MS) {
    return { ok: false, message: 'Code expiré. Contactez le designer pour un nouveau code.' };
  }

  clearFails();
  const now = Date.now();
  const cur = loadLicense();

  switch (payload.kind) {
    case 'REFERRAL': {
      /* Récompense de parrainage : SEULE source de mois gratuits de l'app.
         1 parrainage valide = 1 mois offert, pour le PARRAIN uniquement. */
      const months = Math.max(1, payload.months || REF_REWARD_MONTHS);
      /* Code nominatif : vérifiable uniquement sur l'installation du parrain destinataire. */
      if (payload.to && payload.to !== refFingerprint(getLocalRefCode() || '')) {
        return { ok: false, message: 'Ce code récompense un parrain précis : il ne peut être activé que sur son installation (bouton « Code parrain » de son application).' };
      }
      /* Un code récompense ne s'active qu'une fois par installation
         (1 parrainage = 1 mois, pas 2). */
      const usedKey = refFingerprint(clean + ':' + (payload.iat || 0));
      const used = getUsedReferralCodes();
      if (used.includes(usedKey)) {
        return { ok: false, message: 'Ce code de parrainage a déjà été utilisé sur cette installation.' };
      }
      const already = referralMonthsReceivedThisYear();
      if (already + months > REF_MAX_MONTHS_PER_YEAR) {
        return {
          ok: false,
          message: `Plafond de parrainage atteint : ${REF_MAX_MONTHS_PER_YEAR} mois offerts maximum sur 12 mois (vous en avez déjà reçu ${already}).`,
        };
      }
      const licensed = cur.type === 'monthly' || cur.type === 'annual' || cur.type === 'all';
      const base = licensed && cur.expiresAt > now ? cur.expiresAt : now;
      const expiresAt = base + months * MONTH_MS;
      saveLicense({ type: licensed ? cur.type : 'monthly', expiresAt, customDesign: cur.customDesign });
      markReferralCodeUsed(usedKey);
      logReferralReward(months);
      return {
        ok: true,
        message: `Parrainage : ${months} mois offert${months > 1 ? 's' : ''} activé${months > 1 ? 's' : ''}. ${licensed ? 'Abonnement prolongé' : 'Accès Pro activé'} jusqu'au ${new Date(expiresAt).toLocaleDateString('fr-FR')}.`,
      };
    }
    case 'MONTHLY': {
      const months = Math.max(1, payload.months || 1);
      const base = cur.type === 'monthly' && cur.expiresAt > now ? cur.expiresAt : now;
      const expiresAt = base + months * MONTH_MS;
      saveLicense({ type: 'monthly', expiresAt, customDesign: cur.customDesign });
      return { ok: true, message: `Abonnement mensuel activé (${months} mois). Expire le ${new Date(expiresAt).toLocaleDateString('fr-FR')}.` };
    }
    case 'ANNUAL': {
      const base = (cur.type === 'annual' || cur.type === 'all') && cur.expiresAt > now ? cur.expiresAt : now;
      const expiresAt = base + YEAR_MS;
      saveLicense({ type: 'annual', expiresAt, customDesign: cur.customDesign });
      return { ok: true, message: `Abonnement 1 an activé. Expire le ${new Date(expiresAt).toLocaleDateString('fr-FR')}.` };
    }
    case 'ALL': {
      const base = cur.type === 'all' && cur.expiresAt > now ? cur.expiresAt : now;
      const expiresAt = base + YEAR_MS;
      saveLicense({ type: 'all', expiresAt, customDesign: true });
      return { ok: true, message: `Offre TOUS LES DESIGNS (1 an) activée. Expire le ${new Date(expiresAt).toLocaleDateString('fr-FR')}.` };
    }
    case 'DESIGN':
      saveLicense({ type: cur.type, expiresAt: cur.expiresAt, customDesign: true });
      return { ok: true, message: 'Design personnalisé débloqué. Contactez le designer pour décrire votre design.' };
    default:
      return { ok: false, message: 'Type de code inconnu.' };
  }
}

/** Compte les échecs et verrouille après MAX_FAILS tentatives. */
function registerFail() {
  try {
    const fails = parseInt(localStorage.getItem(LS_FAIL) || '0', 10) || 0;
    const n = fails + 1;
    if (n >= MAX_FAILS) {
      localStorage.setItem(LS_LOCK, String(Date.now() + LOCK_MS));
      localStorage.removeItem(LS_FAIL);
    } else {
      localStorage.setItem(LS_FAIL, String(n));
    }
  } catch { /* ignore */ }
}

function clearFails() {
  try { localStorage.removeItem(LS_FAIL); } catch { /* ignore */ }
}

/* ============================================================
   Historique des codes générés (espace vendeur — suivi des ventes)
   ============================================================ */

export interface VendorLogEntry {
  at: number;            // timestamp de génération
  kind: CodeKind;
  months?: number;
  code: string;          // code complet (pour vérification client)
  client?: string;       // nom du client (optionnel)
  phone?: string;        // numéro WhatsApp du client (optionnel)
  price: number;         // prix de l'offre en F (figé à la génération)
}

const LS_VENDOR_LOG = 'dd_vendor_log';
const CODE_TTL_MS = 30 * 86400000;

/** Prix (en F) d'un type de code. */
export function codePrice(kind: CodeKind, months?: number): number {
  switch (kind) {
    case 'MONTHLY': return Math.max(1, months || 1) * PRICE_MONTHLY;
    case 'ANNUAL': return PRICE_ANNUAL;
    case 'ALL': return PRICE_ALL;
    case 'DESIGN': return PRICE_CUSTOM_DESIGN;
    case 'REFERRAL': return 0;   // mois offert, jamais facturé
    default: return 0;
  }
}

/** Un code reste activable pendant 30 jours après sa génération. */
export function codeIsFresh(e: Pick<VendorLogEntry, 'at'>, now: number = Date.now()): boolean {
  return now - e.at <= CODE_TTL_MS;
}

export function getVendorLog(): VendorLogEntry[] {
  try {
    const log = JSON.parse(localStorage.getItem(LS_VENDOR_LOG) || '[]') as VendorLogEntry[];
    // Compatibilité avec les anciennes entrées (sans prix / client)
    return log.map(e => ({ ...e, price: typeof e.price === 'number' ? e.price : codePrice(e.kind, e.months) }));
  } catch { return []; }
}

/** Enregistre un code généré dans l'historique vendeur. */
export function logVendorCode(kind: CodeKind, months: number | undefined, code: string, client?: string, phone?: string) {
  try {
    const log = getVendorLog();
    log.unshift({
      at: Date.now(), kind, months, code,
      client: client?.trim() || undefined,
      phone: phone || undefined,
      price: codePrice(kind, months),
    });
    // On garde les 500 derniers codes
    localStorage.setItem(LS_VENDOR_LOG, JSON.stringify(log.slice(0, 500)));
  } catch { /* ignore */ }
}

/** Supprime une entrée de l'historique et renvoie la nouvelle liste. */
export function deleteVendorEntry(index: number): VendorLogEntry[] {
  try {
    const log = getVendorLog();
    log.splice(index, 1);
    localStorage.setItem(LS_VENDOR_LOG, JSON.stringify(log));
    return log;
  } catch { return getVendorLog(); }
}

export function clearVendorLog() {
  try { localStorage.removeItem(LS_VENDOR_LOG); } catch { /* ignore */ }
}

/** Libellé lisible d'un type de code. */
export function codeKindLabel(kind: CodeKind, months?: number): string {
  switch (kind) {
    case 'MONTHLY': return months ? `${months} mois` : '1 mois';
    case 'ANNUAL': return '1 an (15 000 F)';
    case 'ALL': return 'Tous designs 1 an (50 000 F)';
    case 'DESIGN': return 'Design (5 000 F)';
    case 'REFERRAL': return months && months > 1 ? `Parrainage — ${months} mois offerts` : 'Parrainage — 1 mois offert';
    default: return kind;
  }
}

/* ============================================================
   PARRAINAGE — suivi des mois offerts reçus sur CETTE installation
   (sert au plafond de 12 mois / an et au compteur affiché au parrain)
   ============================================================ */

export interface ReferralRewardEntry {
  at: number;        // date d'activation du code récompense
  months: number;    // mois offerts reçus
}

const LS_REF_REWARDS = 'dd_ref_rewards';
const LS_REF_USED = 'dd_ref_used_codes';
const YEAR_MS_ROLLING = 365 * 86400000;

/** Empreintes des codes de parrainage déjà activés sur cette installation. */
function getUsedReferralCodes(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_REF_USED) || '[]') as string[];
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function markReferralCodeUsed(key: string) {
  try {
    const list = getUsedReferralCodes();
    if (!list.includes(key)) {
      list.push(key);
      localStorage.setItem(LS_REF_USED, JSON.stringify(list.slice(-200)));
    }
  } catch { /* ignore */ }
}

/** Historique local des récompenses de parrainage activées. */
export function getReferralRewards(): ReferralRewardEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_REF_REWARDS) || '[]') as ReferralRewardEntry[];
    return Array.isArray(raw) ? raw.filter(e => e && typeof e.months === 'number') : [];
  } catch { return []; }
}

function logReferralReward(months: number) {
  try {
    const list = getReferralRewards();
    list.unshift({ at: Date.now(), months });
    localStorage.setItem(LS_REF_REWARDS, JSON.stringify(list.slice(0, 200)));
  } catch { /* ignore */ }
}

/** Mois offerts déjà reçus sur les 12 derniers mois (glissants). */
export function referralMonthsReceivedThisYear(now: number = Date.now()): number {
  return getReferralRewards()
    .filter(e => now - e.at <= YEAR_MS_ROLLING)
    .reduce((s, e) => s + Math.max(0, e.months || 0), 0);
}

/** Combien de mois offerts un parrain peut encore recevoir cette année. */
export function referralMonthsRemaining(): number {
  return Math.max(0, REF_MAX_MONTHS_PER_YEAR - referralMonthsReceivedThisYear());
}
