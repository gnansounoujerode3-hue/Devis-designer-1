/* ============================================================
   PARRAINAGE — politique UNIQUE de l'application
   ------------------------------------------------------------
   « 1 parrainage valide = 1 MOIS GRATUIT POUR LE PARRAIN »
   Le filleul ne reçoit rien : toute récompense gratuite va au parrain.
   Il n'y a ni concours, ni « 3 mois gratuits », ni autre bonus :
   le parrainage est la seule source de mois offerts de l'app.

   Mécanique (100 % hors-ligne, sans serveur de comptes) :
   1. Chaque installation possède un code parrain unique : DDREF-XXXX
   2. Le parrain partage l'app avec ce code (WhatsApp, SMS, bouche-à-oreille)
   3. Le filleul installe l'app et enregistre le code parrain
      (via le lien ?ref=DDREF-XXXX ou en le tapant dans l'app)
   4. Le parrainage devient VALIDE quand le filleul a exporté
      au moins un document (PDF ou envoi pour signature)
   5. L'app du filleul génère alors un « code remerciement » de
      +1 mois, lié au code du parrain : elle le lui envoie sur WhatsApp
   6. Le parrain colle le code dans « Déjà abonné ? » → +1 mois offert
      (Plafond : 12 mois offerts sur 12 mois glissants.)
   ============================================================ */

import {
  generateCode, getExportCount, getLocalRefCode,
  REF_CODE_KEY, REF_REWARD_MONTHS, REF_MAX_MONTHS_PER_YEAR,
  referralMonthsReceivedThisYear, referralMonthsRemaining, getReferralRewards,
} from './license';
import { VENDOR } from './config';

export { REF_REWARD_MONTHS, REF_MAX_MONTHS_PER_YEAR };

const APP_DOWNLOAD_LINK = VENDOR.DOWNLOAD_LINK;

const LS_PARRAIN = 'dd_ref_parrain';
/** Code remerciement déjà généré pour NOTRE parrain (1 seule fois par installation). */
const LS_MY_REWARD = 'dd_ref_reward_code';
/** Le filleul a-t-il transmis le code à son parrain ? (simple aide-mémoire local) */
const LS_MY_REWARD_SENT = 'dd_ref_reward_sent';

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
    try { localStorage.setItem(LS_PARRAIN, clean); } catch { /* ignore */ }
    return true;
  }
  return false;
}

export function getParrainCode(): string | null {
  try { return localStorage.getItem(LS_PARRAIN); } catch { return null; }
}

/** Cette installation a-t-elle été parrainée par quelqu'un ? */
export function isReferred(): boolean {
  const p = getParrainCode();
  return !!p && p !== getLocalRefCode();
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
  return `Devis Designer — créez vos devis et factures professionnels en un clin d'oeil.\n20 exports gratuits. Abonnement 2000 F/mois ou 15000 F/an.\nTélécharger : ${referralDownloadLink()}\nCode parrain : ${c}\n(Parrainage : 1 ami qui installe avec ce code et exporte un devis = 1 mois offert pour moi.)`;
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
  try { return localStorage.getItem(LS_MY_REWARD); } catch { return null; }
}

export function isMyRewardSent(): boolean {
  try { return localStorage.getItem(LS_MY_REWARD_SENT) === '1'; } catch { return false; }
}

export function markMyRewardSent() {
  try { localStorage.setItem(LS_MY_REWARD_SENT, '1'); } catch { /* ignore */ }
}

/** L'utilisateur a fermé le rappel : on ne le réaffiche plus. */
export function isRewardReminderDismissed(): boolean {
  try { return localStorage.getItem('dd_ref_reward_dismissed') === '1'; } catch { return false; }
}

export function dismissRewardReminder() {
  try { localStorage.setItem('dd_ref_reward_dismissed', '1'); } catch { /* ignore */ }
}

/**
 * À appeler après chaque export / envoi pour signature réussi, à l'ouverture
 * de l'app et juste après la saisie d'un code parrain (le filleul a pu
 * exporter avant d'enregistrer le code).
 * Si CETTE installation a été parrainée et que le parrainage est validé
 * (au moins un document exporté), génère — UNE SEULE FOIS — le code
 * remerciement de +1 mois destiné au PARRAIN, puis le renvoie. Sinon : null.
 */
export async function settleReferralReward(): Promise<string | null> {
  const parrain = getParrainCode();
  if (!parrain || parrain === getLocalRefCode()) return null;
  const existing = getMyRewardCode();
  if (existing) return existing;
  if (!hasMinimumExport()) return null;
  try {
    const code = await generateCode('REFERRAL', REF_REWARD_MONTHS, parrain);
    try { localStorage.setItem(LS_MY_REWARD, code); } catch { /* ignore */ }
    return code;
  } catch { return null; }
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

/* ---------------- Côté PARRAIN : suivi local de ses mois offerts ---------------- */

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
  if (!s.count) return `Aucun mois offert reçu pour l'instant — ${REF_MAX_MONTHS_PER_YEAR} mois/offerts maximum par an.`;
  return `${s.receivedMonths} mois offert${s.receivedMonths > 1 ? 's' : ''} reçu${s.receivedMonths > 1 ? 's' : ''} cette année (${s.count} parrainage${s.count > 1 ? 's' : ''}) · encore ${s.remainingMonths} mois disponibles.`;
}
