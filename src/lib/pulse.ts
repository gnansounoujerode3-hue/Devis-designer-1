/* ============================================================
   SONDE « PULSE » — l'état du webhook Chariow, vu depuis l'espace vendeur.
   ------------------------------------------------------------
   Le Pulse, c'est l'URL que Chariow rappelle quand une vente bouge. Cette URL
   porte le SOUS-DOMAINE DU COMPTE Cloudflare (`<worker>.<compte>.workers.dev`) :
   renommez ce sous-domaine, changez de Worker, et Chariow continue de taper à
   l'ancienne adresse. Plus aucune vente n'est confirmée en temps réel — sans que
   rien ne le dise à l'écran. Ce n'est pas mortel (`/check` re-vérifie la vente
   chez Chariow), mais ça rend l'activation lente et dépendante du client qui
   laisse sa fenêtre ouverte. D'où une carte, plutôt qu'un doute.
   ============================================================ */
import { isWorkerConfigured, workerBase } from './workerBase';

export type PulseVerdict = 'no-worker' | 'offline' | 'never' | 'rejected' | 'silent' | 'ok';

export interface PulseStatus {
  verdict: PulseVerdict;
  titre: string;
  detail: string;
  /** L'URL que Chariow doit rappeler (celle du Worker, pas celle de l'app). */
  url: string;
  count: number;
  lastAt: string;
  minutesSinceLast: number;
  pending: number;
  secretSet: boolean;
  /** false = le Worker déployé ne renvoie pas encore `debug.pulse` (sonde à redéployer). */
  probe: boolean;
  /** Le secret du Worker n'est plus celui qui a vérifié la dernière délivrance : il a été changé. */
  secretRotated: boolean;
}

// (l'adresse courante vient de workerBase(), résolveur partagé)

const minutes = (iso: string, now: number): number => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : -1;
};

/**
 * Analyse le champ `debug` renvoyé par le Worker. Fonction pure (aucun réseau,
 * aucune horloge imposée) : c'est elle que jouent les tests du dépôt.
 * Un `debug` absent ou vide veut dire « injoignable », pas « zéro Pulse ».
 */
export function analyzePulse(debug: Record<string, unknown> | null | undefined, now = Date.now()): PulseStatus {
  const base = workerBase();
  const last = (debug && (debug.lastWebhook as Record<string, unknown>)) || null;
  const p = (debug && (debug.pulse as Record<string, unknown>)) || null;
  const probe = !!p;
  const url = String((p && p.url) || (debug && debug.webhookUrl) || '') || (base ? base + '/webhook' : '');
  const count = Number((p && p.count) ?? (debug && debug.webhookCount) ?? 0) || 0;
  const lastAt = String((p && p.lastAt) ?? (last && last.at) ?? '');
  const secretSet = p ? !!p.secretSet : !!(debug && (debug.pulseSecret as Record<string, unknown> | undefined)?.suffix);
  const pending = p ? Number(p.pending ?? 0) || 0 : Array.isArray(debug?.pendingPayments) ? debug!.pendingPayments.length : 0;
  const mins = minutes(lastAt, now);

  /* Piège réel, et silencieux : on tourne CHARIOW_PULSE_SECRET d'un côté sans le tourner de
     l'autre. La dernière délivrance a été vérifiée avec un secret dont on ne garde que les 4
     derniers caractères ; si ceux du Worker ont bougé depuis, la prochaine vente payée recevra
     un 401 et le client aura payé sans jamais être activé. */
  const cfgSuffix = String(((debug?.pulseSecret as Record<string, unknown> | undefined)?.suffix) || '');
  const lastSuffix = String((last && last.secretSuffix) || '');
  const secretRotated = !!cfgSuffix && !!lastSuffix && cfgSuffix !== lastSuffix;
  const rotated = secretRotated
    ? ' \u26a0 Le secret enregistr\u00e9 sur le Worker (…' + cfgSuffix + ') n\u2019est plus celui qui a v\u00e9rifi\u00e9 la derni\u00e8re d\u00e9livrance (…'
      + lastSuffix + ') : vous l\u2019avez chang\u00e9. C\u2019est normal dans la minute qui suit la rotation \u2014 ça ne passe qu\u2019au premier Pulse reçu '
      + 'avec le nouveau secret. Si un paiement confirm\u00e9 arrive et que cette ligne reste rouge, les deux c\u00f4t\u00e9s ne se correspondent pas : '
      + 'recopiez le whsec_... affich\u00e9 par Chariow dans CHARIOW_PULSE_SECRET (wrangler secret put, puis red\u00e9ploiement du Worker), '
      + 'jamais l\u2019inverse \u2014 sinon la prochaine vente pay\u00e9e re\u00e7oit un 401 (signature invalide) et le client aura pay\u00e9 sans \u00eatre activ\u00e9.'
    : '';

  const mk = (verdict: PulseVerdict, titre: string, detail: string): PulseStatus =>
    ({ verdict, titre, detail: detail + (verdict === 'no-worker' || verdict === 'offline' ? '' : rotated), url, count, lastAt, minutesSinceLast: mins, pending, secretSet, probe, secretRotated });

  if (!isWorkerConfigured()) {
    return mk('no-worker', 'Worker non configuré',
      'AUTO_PAY_WORKER_URL est vide dans src/lib/config.ts : aucune caisse automatique, donc aucun Pulse à attendre. Le paiement se fait au numéro du vendeur et vous générez le code vous-même.');
  }
  if (!debug) {
    return mk('offline', 'Serveur injoignable',
      "Impossible de lire /debug du Worker : aucune des adresses déclarées n'a répondu (AUTO_PAY_WORKER_URL et AUTO_PAY_WORKER_FALLBACKS dans src/lib/config.ts). Si vous venez de renommer le sous-domaine du compte Cloudflare, c'est normal : l'adresse a changé, et celle enregistrée chez Chariow doit changer avec elle.");
  }
  if (count === 0) {
    return mk('never', 'Aucun Pulse n’est jamais arrivé',
      `Chariow n'a encore rappelé aucune URL. Créez (ou corrigez) l'Automation « Pulse » vers l'adresse ci-dessous, avec l'événement de vente payée. Les ventes payées s'activent quand même à terme — le Worker re-vérifie chez Chariow à chaque relevé — mais seulement tant que le client garde la fenêtre ouverte : la vente expire au bout de 15 minutes.`);
  }
  if (last && last.signatureOk === false) {
    return mk('rejected', 'Le Pulse arrive, mais sa signature est refusée',
      `Dernière délivrance : « ${String(last.action || '?')} ». Le secret de signature lu par le Worker (CHARIOW_PULSE_SECRET) n'est pas celui du Pulse : recopiez le whsec_... affiché par Chariow, sans espace ni guillemet, puis redéployez le Worker.`);
  }
  if (pending > 0 && (mins < 0 || mins > 30)) {
    return mk('silent', `Silence depuis ${mins < 0 ? 'toujours' : mins + ' min'} avec ${pending} paiement(s) en attente`,
      'Le Pulse est déjà passé, mais plus rien alors que des ventes attendent : l’URL rappelée par Chariow est probablement périmée (déménagement de Worker ou de sous-domaine), ou le Pulse a été mis en pause côté Chariow. Ouvrez /debug, lisez l’URL annoncée et recopiez-la dans Chariow.');
  }
  return mk('ok', `Pulse vivant — ${count} délivrance(s)` + (mins >= 0 ? `, la dernière il y a ${mins} min` : ''),
    probe
      ? 'Les ventes sont confirmées par Chariow en temps réel. Rien à faire ici tant que ce voyant reste vert.'
      : 'Les ventes sont confirmées en temps réel. (Le Worker déployé ne renvoie pas encore la sonde détaillée : redéployez-le pour afficher le nombre de paiements en attente.)');
}

/** Lit /debug du Worker et en tire un verdict. Ne lève jamais : offline en cas d'échec. */
export async function loadPulseStatus(timeoutMs = 9000): Promise<PulseStatus> {
  const base = workerBase();
  if (!base) return analyzePulse(null);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl?.abort(); } catch { /* ignore */ } }, timeoutMs);
  try {
    const res = await fetch(base + '/debug', ctrl ? { signal: ctrl.signal } : undefined);
    const json = await res.json().catch(() => null);
    const debug = json && typeof json === 'object' ? (json.debug as Record<string, unknown>) ?? null : null;
    return analyzePulse(debug);
  } catch {
    return analyzePulse(null);
  } finally {
    clearTimeout(timer);
  }
}
