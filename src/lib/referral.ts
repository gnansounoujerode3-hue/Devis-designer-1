/* ============================================================
   PARRAINAGE — politique UNIQUE de l'application
   ------------------------------------------------------------
   « 1 parrainage valide = 1 MOIS GRATUIT POUR LE PARRAIN »
   Le filleul ne reçoit rien : toute récompense gratuite va au parrain.
   Il n'y a ni concours, ni « 3 mois gratuits », ni autre bonus :
   le parrainage est la seule source de mois offerts de l'app.

   Mécanique :
   1. Chaque installation possède un code parrain unique : DDREF-XXXXXXXX
   2. Le parrain partage l'app avec ce code (le lien porte déjà ?ref=…)
   3. Le filleul installe l'app et enregistre le code parrain
      (lien ?ref= ou saisie manuelle dans l'encart PARRAINAGE)
   4. Le parrainage devient VALIDE quand le filleul a exporté
      au moins un document (PDF ou envoi pour signature)
   5. Le code « remerciement » de +1 mois est alors émis, LIÉ au code du
      parrain (donc activable nulle part ailleurs) :
        • de préférence par le WORKER (backend/worker.js) : le serveur compte
          les exports, n'émet qu'une récompense par installation de filleul et
          applique le plafond de 12 mois par parrain sur 12 mois glissants ;
        • à défaut (Worker injoignable, app fermée, config REFERRAL_VIA_WORKER
          = false) : génération locale, même format de code.
   6. Le filleul transmet le code à son parrain sur WhatsApp ; le parrain le
      colle dans « Déjà abonné ? » → +1 mois offert.
   ============================================================ */

import {
  generateCode, getExportCount, getLocalRefCode, inspectCode, refFingerprint,
  REF_CODE_KEY, REF_REWARD_MONTHS, REF_MAX_MONTHS_PER_YEAR,
  referralMonthsReceivedThisYear, referralMonthsRemaining, getReferralRewards,
} from './license';
import { VENDOR, AUTO_PAY_WORKER_URL, REFERRAL_VIA_WORKER } from './config';
import { workerAdminKey } from './adminKey';

export { REF_REWARD_MONTHS, REF_MAX_MONTHS_PER_YEAR };
/** Empreinte d'un code parrain (identique côté Worker) — exposée pour les contrôles. */
export { refFingerprint };

const APP_DOWNLOAD_LINK = VENDOR.DOWNLOAD_LINK;

const LS_PARRAIN = 'dd_ref_parrain';
/** Code remerciement déjà généré pour NOTRE parrain (1 seule fois par installation). */
const LS_MY_REWARD = 'dd_ref_reward_code';
/** Le filleul a-t-il transmis le code à son parrain ? (simple aide-mémoire local) */
const LS_MY_REWARD_SENT = 'dd_ref_reward_sent';
/** Émetteur de la récompense : 'server' (Worker) ou 'local' (serveur non joint). */
const LS_REWARD_SOURCE = 'dd_ref_reward_source';
/** État du Worker : JSON { ok, at } */
const LS_WORKER_STATE = 'dd_ref_worker';
/** Le serveur a refusé d'émettre : le parrain a atteint son plafond annuel. */
const LS_PARRAIN_CAPPED = 'dd_ref_parrain_capped';

const getItem = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const setItem = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/* ---------------- Code parrain de cette installation ---------------- */

/** Code parrain unique de CETTE installation (généré au 1er appel). */
export function getMyRefCode(): string {
  try {
    let c = localStorage.getItem(REF_CODE_KEY);
    if (!c) {
      c = 'DDREF-' + Math.random().toString(36).slice(2, 6).toUpperCase()
        + Math.random().toString(36).slice(2, 6).toUpperCase();
      localStorage.setItem(REF_CODE_KEY, c);
    }
    return c;
  } catch { return 'DDREF-XXXX'; }
}

/** Enregistre le code du parrain saisi via un lien ?ref=DDREF-XXXX (ou à la main). */
export function saveParrainCode(input: string): boolean {
  const clean = (input || '').trim().toUpperCase();
  if (clean.startsWith('DDREF-') && clean.length >= 10) {
    setItem(LS_PARRAIN, clean);
    // un nouveau parrainage repart proprement
    try { localStorage.removeItem(LS_PARRAIN_CAPPED); } catch { /* ignore */ }
    return true;
  }
  return false;
}

export function getParrainCode(): string | null {
  return getItem(LS_PARRAIN);
}

/** Cette installation a-t-elle été parrainée par quelqu'un ? */
export function isReferred(): boolean {
  const p = getParrainCode();
  return !!p && p !== getLocalRefCode();
}

/* ---------------- Worker (source de vérité du parrainage) ---------------- */

const WORKER_BASE = (AUTO_PAY_WORKER_URL || '').replace(/\/+$/, '');

/** Le parrainage est-il géré par le serveur ? */
export function isWorkerReferralEnabled(): boolean {
  return REFERRAL_VIA_WORKER && /^https?:\/\//i.test(WORKER_BASE);
}

export interface WorkerState { ok: boolean; at: number; }

/** Dernier état connu du Worker (servateur d'affichage dans l'UI). */
export function getWorkerState(): WorkerState | null {
  const raw = getItem(LS_WORKER_STATE);
  if (!raw) return null;
  try { return JSON.parse(raw) as WorkerState; } catch { return null; }
}

function rememberWorker(ok: boolean) { setItem(LS_WORKER_STATE, JSON.stringify({ ok, at: Date.now() })); }

/** Appel réseau tolérant : renvoie null si le Worker est injoignable ou répond mal. */
/** Dernier code HTTP reçu du Worker (sert à distinguer 401 « mauvaise clé » de « injoignable »). */
let lastWorkerStatus = 0;
export function getLastWorkerStatus(): number { return lastWorkerStatus; }

async function callWorker(path: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<Record<string, unknown> | null> {
  if (!isWorkerReferralEnabled()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(WORKER_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    lastWorkerStatus = res.status;
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      // une réponse d'erreur (404 Worker non déployé, 403, …) = serveur inutilisable
      if (res.status === 404 || res.status === 405) rememberWorker(false);
      return null;
    }
    rememberWorker(true);
    return data as Record<string, unknown>;
  } catch {
    lastWorkerStatus = 0;
    rememberWorker(false);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Un code de récompense accepté par le serveur est-il activable ICI et valable ? */
async function isServerRewardUsable(code: string, parrain: string): Promise<boolean> {
  const payload = await inspectCode(code);
  if (!payload || !payload.valid) return false;
  if (payload.kind !== 'REFERRAL') return false;
  // le serveur doit avoir lié le code à NOTRE parrain, sinon on l'ignore
  if (payload.to && payload.to !== refFingerprint(parrain)) return false;
  return true;
}

/**
 * À l'ouverture de l'app : déclare l'installation (et son code parrain) auprès
 * du Worker et récupère une récompense déjà émise par le serveur — utile après
 * une réinstallation ou si le stockage local avait été vidé.
 */
export async function syncReferralFromWorker(): Promise<void> {
  if (!isWorkerReferralEnabled()) return;
  const me = getMyRefCode();
  const parrain = getParrainCode();
  const data = await callWorker('/referral/register', { deviceId: me, refCode: parrain || undefined });
  if (!data) return;
  if (data.referred === false && parrain) return;
  if (data.reward && !getMyRewardCode()) {
    const code = String(data.reward);
    if (parrain && await isServerRewardUsable(code, parrain)) {
      setItem(LS_MY_REWARD, code);
      setItem(LS_REWARD_SOURCE, 'server');
    }
  }
  if (data.reason === 'cap') setItem(LS_PARRAIN_CAPPED, '1');
}

/* ---------------- Message de recommandation (partage de l'app) ---------------- */

/** Lien de téléchargement portant déjà le code parrain (le filleul n'a rien à taper). */
export function referralDownloadLink(): string {
  const code = getMyRefCode();
  if (!/^https?:\/\//i.test(APP_DOWNLOAD_LINK)) return APP_DOWNLOAD_LINK;
  return APP_DOWNLOAD_LINK + (APP_DOWNLOAD_LINK.includes('?') ? '&' : '?') + 'ref=' + code;
}

export function buildShareMessage(): string {
  const c = getMyRefCode();
  return `Devis Designer — des devis et factures pros en 2 minutes, directement dans le navigateur (aucune installation, ça marche aussi sur téléphone).\n20 exports PDF offerts, puis 2 000 F/mois ou 15 000 F/an.\n\nOuvrir : ${referralDownloadLink()}\nMon code parrain : ${c}\n(Passez par mon lien : le code est repris tout seul. Dès que vous exportez un document, je gagne 1 mois offert.)`;
}

/** URL WhatsApp pré-remplie pour recommander l'app. */
export function whatsappShareUrl(): string {
  return 'https://wa.me/?text=' + encodeURIComponent(buildShareMessage());
}

/* ---------------- Récompense du parrain (+1 mois par parrainage valide) ---------------- */

/** Le filleul a-t-il rempli la condition : au moins un export (PDF ou signature) ? */
export function hasMinimumExport(): boolean {
  return getExportCount() > 0;
}

/** Code remerciement déjà généré pour notre parrain (ou null). */
export function getMyRewardCode(): string | null {
  return getItem(LS_MY_REWARD);
}

/** Qui a émis la récompense en cours : le serveur ou cette installation ? */
export function getRewardSource(): 'server' | 'local' | null {
  const v = getItem(LS_REWARD_SOURCE);
  return v === 'server' || v === 'local' ? v : null;
}

export function isMyRewardSent(): boolean {
  return getItem(LS_MY_REWARD_SENT) === '1';
}

export function markMyRewardSent() { setItem(LS_MY_REWARD_SENT, '1'); }

/** L'utilisateur a fermé le rappel : on ne le réaffiche plus. */
export function isRewardReminderDismissed(): boolean {
  return getItem('dd_ref_reward_dismissed') === '1';
}

export function dismissRewardReminder() { setItem('dd_ref_reward_dismissed', '1'); }

/** Le serveur a refusé d'émettre : le parrain a atteint ses 12 mois/an. */
export function isParrainCapped(): boolean {
  return getItem(LS_PARRAIN_CAPPED) === '1';
}

/** Récompense émise localement (serveur non joint) : signée par le secret de l'app, 1 seule fois. */
async function generateLocalReward(parrain: string): Promise<string | null> {
  try {
    const code = await generateCode('REFERRAL', REF_REWARD_MONTHS, parrain);
    setItem(LS_MY_REWARD, code);
    setItem(LS_REWARD_SOURCE, 'local');
    return code;
  } catch { return null; }
}

/**
 * À appeler après chaque export / envoi pour signature réussi, à l'ouverture de
 * l'app et juste après la saisie d'un code parrain (le filleul a pu exporter
 * avant d'enregistrer le code).
 *
 * Le Worker est interrogé en priorité : il compte l'export, ne délivre qu'une
 * récompense par installation de filleul et applique le plafond annuel du
 * parrain. En cas d'indisponibilité, on retombe sur une génération locale.
 * Renvoie le code remerciement de +1 mois destiné au PARRAIN, ou null.
 */
export async function settleReferralReward(): Promise<string | null> {
  const parrain = getParrainCode();
  if (!parrain || parrain === getLocalRefCode()) return null;

  const existing = getMyRewardCode();
  if (existing) {
    // récompense déjà en notre possession : on la laisse telle quelle
    return existing;
  }
  if (!hasMinimumExport()) return null;

  if (isWorkerReferralEnabled()) {
    const data = await callWorker('/referral/export', { deviceId: getMyRefCode(), refCode: parrain });
    if (data) {
      // Le serveur juge : plafonds, récompense déjà émise, mise en attente anti-abus.
      if (data.reason === 'cap') { setItem(LS_PARRAIN_CAPPED, '1'); return null; }
      if (data.hold === true) return null;                 // validation différée (anti-abus) : on n'émet rien
      if (data.validated === true && data.reward == null) return null; // parrainage validé mais rien à émettre
      const reward = typeof data.reward === 'string' && data.reward ? data.reward : null;
      if (reward) {
        if (await isServerRewardUsable(reward, parrain)) {
          setItem(LS_MY_REWARD, reward);
          setItem(LS_REWARD_SOURCE, 'server');
          try { localStorage.removeItem(LS_PARRAIN_CAPPED); } catch { /* ignore */ }
          return reward;
        }
        // code serveur non reconnu (secret du Worker différent de celui de l'app) :
        // on garde la main en local plutôt que de bloquer le parrain.
      }
    }
  }
  return generateLocalReward(parrain);
}

/** Message à envoyer au parrain pour le remercier de son mois offert. */
export function buildRewardMessage(code: string): string {
  const parrain = getParrainCode() || 'votre parrain';
  return `Bonjour ! J'ai installé Devis Designer avec ton code parrain (${parrain}) et j'ai exporté mon premier devis.\nVoici ton mois gratuit (${REF_REWARD_MONTHS} mois offert${REF_REWARD_MONTHS > 1 ? 's' : ''} par parrainage) : ${code}\nDans l'app : bouton « PRO » → « Déjà abonné ? » → colle le code → « Activer ».\n(À activer dans les 30 jours. Un seul mois par filleul, 12 mois max par an.)`;
}

/** Lien WhatsApp pré-rempli pour transmettre le code remerciement au parrain. */
export function rewardWhatsAppUrl(code: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(buildRewardMessage(code));
}

/* ---------------- Côté PARRAIN : suivi de ses mois offerts ---------------- */

export interface ReferralSummary {
  /** Mois offerts déjà reçus sur les 12 derniers mois. */
  receivedMonths: number;
  /** Mois encore disponibles sous le plafond annuel. */
  remainingMonths: number;
  /** Nombre de récompenses activées sur cette installation. */
  count: number;
  /** Dernier mois reçu (date), ou 0. */
  lastAt: number;
}

export function getParrainSummary(): ReferralSummary {
  const rewards = getReferralRewards();
  return {
    receivedMonths: referralMonthsReceivedThisYear(),
    remainingMonths: referralMonthsRemaining(),
    count: rewards.length,
    lastAt: rewards.length ? rewards[0].at : 0,
  };
}

/** Petit texte d'état pour l'encart parrainage. */
export function parrainStatusLabel(): string {
  const s = getParrainSummary();
  const base = !s.count
    ? `Aucun mois offert reçu pour l'instant — ${REF_MAX_MONTHS_PER_YEAR} mois offerts maximum par an.`
    : `${s.receivedMonths} mois offert${s.receivedMonths > 1 ? 's' : ''} reçu${s.receivedMonths > 1 ? 's' : ''} cette année (${s.count} parrainage${s.count > 1 ? 's' : ''}) · encore ${s.remainingMonths} mois disponibles.`;
  return base + ' ' + controlLabel();
}

/** D'où vient le contrôle des récompenses : serveur (Worker) ou local. */
export function controlLabel(): string {
  if (!isWorkerReferralEnabled()) return 'Contrôle local : Worker non configuré.';
  const st = getWorkerState();
  if (!st) return 'Serveur non interrogé pour l\'instant : le parrainage sera confirmé au premier échange.';
  if (!st.ok) return 'Worker injoignable : récompense générée localement (1 par filleul, 12 mois/an).';
  return 'Récompenses émises et plafonnées par votre serveur.';
}

/* ---------------- Espace vendeur : stats serveur ---------------- */

export interface WorkerReferralStats {
  ok: boolean;
  referred?: number;
  validated?: number;
  pending?: number;
  rewardsIssued?: number;
  monthsGranted?: number;
  capBlocked?: number;
  parrains?: number;
  truncated?: boolean;
  top?: { code: string; months: number }[];
  error?: string;
  message?: string;
}

/** Statistiques de parrainage côté serveur (espace vendeur). */
export async function fetchWorkerReferralStats(adminPass: string = workerAdminKey()): Promise<WorkerReferralStats> {
  if (!isWorkerReferralEnabled()) return { ok: false, message: 'Worker non configuré (AUTO_PAY_WORKER_URL vide).' };
  if (!adminPass) return { ok: false, message: 'Clé serveur non renseignée : saisissez la valeur de ADMIN_PASS dans le bandeau « Clé serveur » de cette page.' };
  const data = await callWorker('/referral/stats', { admin: adminPass }, 12000);
  if (!data) {
    if (lastWorkerStatus === 401 || lastWorkerStatus === 403) {
      return { ok: false, message: 'Clé serveur refusée par le Worker (401) : elle doit être identique à sa variable ADMIN_PASS.' };
    }
    if (lastWorkerStatus === 404 || lastWorkerStatus === 405) {
      return { ok: false, message: 'Le Worker répond mais ne connaît pas /referral/stats : redéployez backend/worker.js.' };
    }
    return { ok: false, message: getWorkerState() && !getWorkerState()!.ok
      ? 'Worker injoignable. Déployez la version récente de backend/worker.js.'
      : 'Worker injoignable.' };
  }
  return {
    ok: true,
    referred: Number(data.referred) || 0,
    validated: Number(data.validated) || 0,
    pending: Number(data.pending) || 0,
    rewardsIssued: Number(data.rewardsIssued) || 0,
    monthsGranted: Number(data.monthsGranted) || 0,
    capBlocked: Number(data.capBlocked) || 0,
    parrains: Number(data.parrains) || 0,
    truncated: data.truncated === true,
    top: Array.isArray(data.top) ? (data.top as { code: string; months: number }[]) : [],
    error: typeof data.error === 'string' ? data.error : undefined,
  };
}
