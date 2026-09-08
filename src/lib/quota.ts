/* ============================================================
   QUOTA D'EXPORTS — le compteur qui ne s'efface pas
   ------------------------------------------------------------
   Le compteur local (localStorage + IndexedDB) est remis à zéro par une
   fenêtre de navigation privée, un autre navigateur ou un autre appareil :
   20 exports gratuits « par installation » deviennent 20 exports par session — et
   le compteur local ne résiste pas à la navigation privée.

   Avec QUOTA_SERVER_ENFORCEMENT, la vérité est sur le Worker :
   1. AVANT de produire le PDF, l'app RÉSERVE un export (POST /quota/reserve) ;
   2. le Worker compte sur deux seaux — empreinte de l'appareil (identique en
      navigation privée) et code d'installation — et retient le MAX des deux :
      créer une nouvelle « installation » ne remet donc pas le compteur à zéro ;
   3. l'export est confirmé (POST /quota/confirm) ou restitué en cas d'échec
      (POST /quota/release) ;
   4. au-delà du plafond, le client peut FORMULER une demande de déblocage
      (POST /quota/request) que le vendeur traite en 1 clic (#/vendeur).

   Si le serveur est injoignable (réseau instable, Worker non déployé), on retombe
   sur le compteur local : un client dont le serveur est injoignable n'est jamais
   bloqué à cause du réseau (l'application reste de toute façon un site web :
   sans connexion, elle ne s'ouvre pas).
   ============================================================ */

import { FREE_EXPORT_LIMIT, getExportCount, isLicensed, loadLicense } from './license';
import { QUOTA_SERVER_ENFORCEMENT } from './config';
import { workerBase } from './workerBase';
import { workerAdminKey } from './adminKey';
import { getMyRefCode } from './referral';


const LS_SERVER_STATE = 'dd_quota_server';

export interface QuotaState {
  /** Vrai si l'export est autorisé. */
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** Jours avant la fin de la fenêtre glissante (remise à zéro du compteur). */
  resetInDays: number;
  windowDays: number;
  /** Déblocage accordé par le vendeur. */
  unlocked: boolean;
  /** Jours restants du déblocage temporaire accordé par le vendeur. */
  unlockDays: number;
  /** 'server' = compté par le Worker, 'local' = compteur de l'appareil. */
  source: 'server' | 'local';
  at: number;
}

let cache: QuotaState | null = null;

/** Le quota est-il piloté par le serveur ? */
export function isServerQuotaEnabled(): boolean {
  return QUOTA_SERVER_ENFORCEMENT && /^https?:\/\//i.test(workerBase());
}

/** Dernier état connu du serveur de quota (pour l'affichage honnête dans l'UI). */
export function getQuotaCache(): QuotaState | null { return cache; }

function remember(state: QuotaState | null) {
  cache = state;
  try {
    if (state) localStorage.setItem(LS_SERVER_STATE, JSON.stringify({ ok: state.source === 'server', at: state.at }));
  } catch { /* ignore */ }
}

async function callWorker(path: string, body: Record<string, unknown>, timeoutMs = 6000): Promise<Record<string, unknown> | null> {
  if (!isServerQuotaEnabled()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(workerBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Comme callWorker, mais conserve le corps des réponses en erreur HTTP :
 * utile pour afficher au vendeur POURQUOI ça échoue (PIN erroné, Worker pas
 * à jour…) au lieu de conclure à tort à un réseau coupé.
 */
async function callWorkerRaw(path: string, body: Record<string, unknown>, timeoutMs = 10000): Promise<Record<string, unknown> | null> {
  if (!isServerQuotaEnabled()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(workerBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return res.ok ? {} : { ok: false, error: 'HTTP ' + res.status };
    return data as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Empreinte de l'appareil ---------------- */

function hashFallback(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (s.charCodeAt(i) + i), 0x85ebca6b) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).toUpperCase().padEnd(16, '0').slice(0, 16);
}

async function hash16(s: string): Promise<string> {
  try {
    const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
    if (!subtle) return hashFallback(s);
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(s));
    const bytes = Array.from(new Uint8Array(buf));
    let out = '';
    for (const b of bytes) out += b.toString(36).padStart(2, '0');
    return out.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  } catch { return hashFallback(s); }
}

let fpCache: string | null = null;

/**
 * Empreinte de l'appareil, calculée à partir de signaux qui NE SONT PAS
 * effacés par une fenêtre de navigation privée (ni localStorage, ni cookies).
 */
export async function deviceFingerprint(): Promise<string> {
  if (fpCache) return fpCache;
  const g = globalThis as Record<string, any>;
  const n = g.navigator || {};
  const sc = g.screen || {};
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { tz = ''; }
  let offset = 0;
  try { offset = new Date().getTimezoneOffset(); } catch { offset = 0; }
  const raw = [
    String(n.userAgent || ''), String(n.language || ''), (n.languages || []).join(','),
    String(n.platform || ''), String(n.hardwareConcurrency ?? ''), String(n.maxTouchPoints ?? ''),
    String(n.deviceMemory ?? ''), String(n.pdfViewerEnabled ?? ''),
    `${sc.width || 0}x${sc.height || 0}x${sc.colorDepth || 24}`,
    String(g.devicePixelRatio ?? ''), tz, String(offset),
  ].join('|');
  fpCache = await hash16(raw);
  return fpCache;
}

/* ---------------- État local (repli) ---------------- */

function localState(): QuotaState {
  const used = getExportCount();
  const limit = FREE_EXPORT_LIMIT;
  return {
    allowed: used < limit, used, limit, remaining: Math.max(0, limit - used),
    resetInDays: 0, windowDays: 0, unlocked: false, unlockDays: 0, source: 'local', at: Date.now(),
  };
}

function toState(data: Record<string, unknown>): QuotaState {
  return {
    allowed: data.allowed === true,
    used: Number(data.used) || 0,
    limit: Number(data.limit) || FREE_EXPORT_LIMIT,
    remaining: Number(data.remaining) || 0,
    resetInDays: Number(data.resetInDays) || 0,
    windowDays: Number(data.windowDays) || 30,
    unlocked: data.unlocked === true,
    unlockDays: Number(data.unlockDays) || 0,
    source: 'server',
    at: Date.now(),
  };
}

async function payload(): Promise<Record<string, string>> {
  return { fp: await deviceFingerprint(), deviceId: getMyRefCode() };
}

/* ---------------- API utilisée par l'application ---------------- */

/**
 * RÉSERVE un export avant de le produire. À appeler dans le garde-fou
 * d'export : licensed → on ne demande rien au serveur ; serveur muet →
 * état local. Renvoie l'état de quota courant.
 */
export async function quotaReserve(): Promise<QuotaState> {
  if (isLicensed(loadLicense())) {
    const s = { ...localState(), allowed: true, remaining: Infinity, source: 'local' as const };
    remember(s);
    return s;
  }
  if (!isServerQuotaEnabled()) {
    const s = localState();
    remember(s);
    return s;
  }
  const data = await callWorkerRaw('/quota/reserve', await payload(), 8000);
  if (!data || data.ok !== true) {
    const s = localState();          // serveur injoignable : on ne punit pas une panne réseau
    remember({ ...s, source: 'local' });
    return s;
  }
  const s = toState(data);
  // le compteur local sert de filet (double écriture) : on l'aligne s'il est plus bas
  remember(s);
  return s;
}

/**
 * L'export a bien été produit : on le confirme (traçabilité) et on repart du
 * serveur avec le compteur à jour, pour que l'en-tête affiche le bon reste.
 */
export async function quotaConfirm(): Promise<QuotaState | null> {
  if (!isServerQuotaEnabled() || isLicensed(loadLicense())) return null;
  const data = await callWorker('/quota/confirm', await payload(), 4000);
  if (!data) return getQuotaCache();
  const s = toState(data);
  remember(s);
  return s;
}

/** L'export a échoué : on rend la place réservée. */
export async function quotaRelease(): Promise<void> {
  if (!isServerQuotaEnabled() || isLicensed(loadLicense())) return;
  const data = await callWorker('/quota/release', await payload(), 4000);
  if (data) remember(toState(data));
}

/** Lecture simple de l'état (sans compter) — bannière, en-tête, paywall. */
export async function quotaRefresh(): Promise<QuotaState | null> {
  if (isLicensed(loadLicense())) return null;
  if (!isServerQuotaEnabled()) { const s = localState(); remember(s); return s; }
  const data = await callWorker('/quota/state', await payload());
  if (!data) { const s = localState(); remember(s); return s; }
  const s = toState(data);
  remember(s);
  return s;
}

/** Nombre d'exports gratuits réellement disponibles (local ∧ serveur). */
export function effectiveRemaining(localRemaining: number): number {
  if (cache && cache.source === 'server' && Date.now() - cache.at < 15 * 60000) {
    return Math.min(localRemaining, cache.remaining);
  }
  return localRemaining;
}

/** Le compteur vient-il du serveur (pour l'afficher honnêtement) ? */
export function quotaIsServerManaged(): boolean {
  return !!cache && cache.source === 'server';
}

/**
 * Le client estime être un nouvel utilisateur (nouvel appareil légitime,
 * IP partagée, etc.) : la demande part au vendeur, qui débloquera.
 */
export async function requestQuotaUnlock(note: string): Promise<{ ok: boolean; duplicate?: boolean; message: string }> {
  const data = await callWorkerRaw('/quota/request', { ...(await payload()), note: (note || '').slice(0, 300) }, 9000);
  if (!data) {
    return { ok: false, message: 'Serveur injoignable : votre demande n\'a pas pu partir. Réessayez plus tard ou écrivez au vendeur.' };
  }
  if (data.ok !== true) return { ok: false, message: String(data.message || data.error || 'Le serveur a refusé la demande.') };
  return {
    ok: true,
    duplicate: data.already === true,
    message: String(data.message || 'Demande transmise au vendeur.'),
  };
}

/* ---------------- Espace vendeur : file d'attente et déblocages ---------------- */

export interface QuotaRequest {
  fp: string;
  deviceId?: string;
  note?: string;
  at?: string;
  atMs?: number;
  ip?: string | null;
  country?: string | null;
  ua?: string | null;
  used?: number;
  limit?: number;
  remaining?: number;
  unlocked?: boolean;
  resetInDays?: number;
}

export interface QuotaPending {
  ok: boolean;
  requests?: QuotaRequest[];
  blocked?: number;
  truncated?: boolean;
  error?: string;
  message?: string;
}

/** `adminPass` = la clé serveur (ADMIN_PASS), saisie dans #/vendeur — jamais le PIN de page. */
export async function fetchQuotaRequests(adminPass: string = workerAdminKey()): Promise<QuotaPending> {
  if (!isServerQuotaEnabled()) return { ok: false, message: 'Worker non configuré (AUTO_PAY_WORKER_URL vide).' };
  if (!adminPass) return { ok: false, message: 'Clé serveur non renseignée sur cet appareil : saisissez la valeur de ADMIN_PASS dans le bandeau « Clé serveur ».' };
  const data = await callWorkerRaw('/quota/pending', { admin: adminPass }, 12000);
  if (!data) return { ok: false, message: 'Worker injoignable. Déployez la version récente de backend/worker.js.' };
  if (data.ok !== true) {
    const why = String(data.error || data.message || '');
    return { ok: false, error: why, message: /autoris|401/i.test(why) ? 'Clé serveur refusée par le Worker : elle doit être identique à sa variable ADMIN_PASS (bandeau « Clé serveur »).' : 'Le serveur a refusé : ' + (why || 'réponse invalide') + '.' };
  }
  return {
    ok: true,
    requests: Array.isArray(data.requests) ? (data.requests as QuotaRequest[]) : [],
    blocked: Number(data.blocked) || 0,
    truncated: data.truncated === true,
  };
}

/** Débloquent temporaire accordé par le vendeur (en jours). */
export async function grantQuotaUnlock(fp: string, days: number, adminPass: string = workerAdminKey()): Promise<{ ok: boolean; message: string }> {
  const data = await callWorkerRaw('/quota/grant', { admin: adminPass, fp, days }, 12000);
  if (!data) return { ok: false, message: 'Worker injoignable.' };
  if (data.ok !== true) return { ok: false, message: String(data.error || data.message || 'Déblocage refusé par le serveur.') };
  return { ok: true, message: String(data.message || 'Déblocage accordé.') };
}

export async function revokeQuotaUnlock(fp: string, adminPass: string = workerAdminKey()): Promise<{ ok: boolean; message: string }> {
  const data = await callWorkerRaw('/quota/revoke', { admin: adminPass, fp }, 12000);
  if (!data) return { ok: false, message: 'Worker injoignable.' };
  if (data.ok !== true) return { ok: false, message: String(data.error || data.message || 'Retrait refusé par le serveur.') };
  return { ok: true, message: 'Déblocage retiré.' };
}
