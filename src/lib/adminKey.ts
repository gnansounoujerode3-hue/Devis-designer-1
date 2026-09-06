/* ============================================================
   CLÉ ADMIN DU SERVEUR  (variable Cloudflare `ADMIN_PASS`)
   ------------------------------------------------------------
   À NE PAS CONFONDRE avec VENDOR_PIN :
   - VENDOR_PIN ('2468' par défaut) = le code que VOUS tapez pour OUVRIR la
     page #/vendeur. Il est dans le bundle, donc public : il écarte les
     curieux, c'est tout.
   - ADMIN_PASS = la clé que le Worker exige pour les appels sensibles
     (/referral/stats, /quota/pending|grant|revoke). Elle n'est JAMAIS écrite
     dans le code de l'app : vous la saisissez une fois dans #/vendeur et
     elle reste dans le stockage de VOTRE appareil (localStorage 'dd_worker_admin').

   Conséquence : vous pouvez garder un ADMIN_PASS costaud (ex : votre mot de
   passe) sans avoir à le retaper à chaque ouverture de page, et un client qui
   lit le bundle ne le trouve pas.
   ============================================================ */

import { AUTO_PAY_WORKER_URL } from './config';

const LS_KEY = 'dd_worker_admin';

/** La clé enregistrée sur cet appareil ('' = jamais saisie). */
export function workerAdminKey(): string {
  try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; }
}

/** Enregistre (ou efface si vide) la clé sur cet appareil. */
export function setWorkerAdminKey(key: string): string {
  const v = key.trim();
  try {
    if (v) localStorage.setItem(LS_KEY, v);
    else localStorage.removeItem(LS_KEY);
  } catch { /* stockage refusé : on garde en mémoire */ }
  return v;
}

export function hasWorkerAdminKey(): boolean {
  return workerAdminKey().length > 0;
}

export interface KeyTest {
  ok: boolean;
  /** 'missing' | 'unconfigured' | 'unreachable' | 'refused' | 'no-worker' */
  why?: string;
  message: string;
}

/**
 * Vérifie en 1 clic que la clé correspond bien à la variable `ADMIN_PASS` du
 * Worker (et accessiblement que le Worker est à jour). Sert de contrôle de
 * déploiement : « ok » = vous pouvez débloquer les clients depuis #/vendeur.
 */
export async function testWorkerAdminKey(key = workerAdminKey()): Promise<KeyTest> {
  const base = (AUTO_PAY_WORKER_URL || '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    return { ok: false, why: 'unconfigured', message: 'AUTO_PAY_WORKER_URL est vide dans src/lib/config.ts : l’app ne parle à aucun serveur.' };
  }
  if (!key) {
    return { ok: false, why: 'missing', message: 'Aucune clé enregistrée sur cet appareil : tapez la valeur de ADMIN_PASS ci-dessus.' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(base + '/quota/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin: key }),
      signal: ctrl.signal,
    });
    if (res.status === 404 || res.status === 405) {
      return { ok: false, why: 'no-worker', message: 'Le serveur répond mais sans la route /quota/pending : redéployez backend/worker.js.' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, why: 'refused', message: 'Clé refusée (401) : elle doit être exactement la valeur de la variable ADMIN_PASS du Worker.' };
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, why: 'refused', message: 'Réponse inattendue du serveur (HTTP ' + res.status + ').' };
    }
    const blocked = Number(data.blocked) || 0;
    return { ok: true, message: 'Clé acceptée par le serveur' + (blocked ? ` · ${blocked} demande(s) de déblocage en attente.` : ' · aucune demande en attente.') };
  } catch {
    return { ok: false, why: 'unreachable', message: 'Serveur injoignable : vérifiez AUTO_PAY_WORKER_URL et que le Worker est déployé.' };
  } finally {
    clearTimeout(timer);
  }
}
