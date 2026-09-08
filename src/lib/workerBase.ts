/* ============================================================
   ADRESSE DU WORKER — une seule source, et tolérante au déménagement.
   ------------------------------------------------------------
   L'adresse du backend est `<worker>.<sous-domaine-du-compte>.workers.dev`.
   Le milieu appartient au COMPTE Cloudflare : le renommer (ou renommer le
   Worker, ou passer sur un domaine à vous) fait disparaître l'ancienne URL
   d'un coup — et une application déjà installée chez des clients continue
   d'appeler l'adresse morte. Symptôme côté client : `Failed to fetch` dans la
   fenêtre de paiement, c'est-à-dire un client qui ne peut plus payer du tout
   tant que le front n'est pas redéployé.

   Donc : la configuration déclare UNE adresse principale et des ADRESSES DE
   REPLI ; au démarrage on sonde (`GET /debug`, sans écriture) et on retient
   celle qui répond, en mémoire et dans localStorage. Un appel qui échoue au
   niveau réseau invalide le choix, la sonde repart. Si plus rien ne répond,
   on garde l'adresse déclarée : les messages d'erreur expliquent alors le
   réseau, pas le code.
   ============================================================ */
import { AUTO_PAY_WORKER_URL, AUTO_PAY_WORKER_FALLBACKS } from './config';

const CACHE_KEY = 'dd_worker_base';
const CACHE_TTL = 6 * 60 * 60 * 1000;   // 6 h : assez long pour ne pas sonder à chaque clic

const norm = (u: unknown): string => String(u || '').trim().replace(/\/+$/, '');
const isHttp = (u: string): boolean => /^https?:\/\//i.test(u);

/** Les adresses déclarées, dans l'ordre de préférence, sans doublon ni traîneau. */
export function workerCandidates(): string[] {
  const list = [AUTO_PAY_WORKER_URL, ...(AUTO_PAY_WORKER_FALLBACKS || [])].map(norm).filter(isHttp);
  return Array.from(new Set(list));
}

/** Y a-t-il un backend déclaré (et donc un paiement automatique possible) ? */
export function isWorkerConfigured(): boolean { return workerCandidates().length > 0; }

let chosen: string | null = null;

function readCache(): { url: string; at: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { url?: string; at?: number };
    if (!c || typeof c.url !== 'string' || typeof c.at !== 'number') return null;
    return { url: c.url, at: c.at };
  } catch { return null; }
}

function writeCache(url: string) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ url, at: Date.now() })); } catch { /* stockage privé */ }
}

/** L'adresse à utiliser tout de suite (synchrone) : validée, en cache, sinon déclarée. */
export function workerBase(): string {
  if (chosen) return chosen;
  const c = readCache();
  if (c && Date.now() - c.at < CACHE_TTL && workerCandidates().includes(c.url)) return c.url;
  return workerCandidates()[0] || '';
}

/** Marque une adresse comme morte : la prochaine sonde réessaiera les autres. */
export function invalidateWorkerBase(dead?: string): void {
  const d = norm(dead) || workerBase();
  if (chosen === d) chosen = null;
  const c = readCache();
  if (c && c.url === d) { try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } }
}

/**
 * Choisit l'adresse vivante : on garde l'actuelle si elle répond encore (cas
 * normal, une seule sonde), sinon on prend la première des déclarées qui
 * répond. Fonction pure — `isAlive` et `current` entrent en paramètre, donc
 * jouable sous test sans réseau ni configuration réelle.
 */
export async function chooseWorker(
  list: string[], isAlive: (base: string) => Promise<boolean>, current = '',
): Promise<string> {
  const clean = Array.from(new Set((list || []).map(norm).filter(isHttp)));
  if (!clean.length) return '';
  if (current && clean.includes(current) && await isAlive(current)) return current;
  for (const b of clean) if (b !== current && await isAlive(b)) return b;
  return current && clean.includes(current) ? current : clean[0];
}

async function probe(base: string, timeoutMs: number): Promise<boolean> {
  if (!base) return false;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl?.abort(); } catch { /* ignore */ } }, timeoutMs);
  try {
    const res = await fetch(base + '/debug', ctrl ? { method: 'GET', signal: ctrl.signal } : { method: 'GET' });
    return res.ok;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

/** Sonde au démarrage (et n'importe quand) : ne lève jamais, renvoie l'adresse retenue. */
export async function warmWorkerBase(timeoutMs = 4000): Promise<string> {
  const winner = await chooseWorker(workerCandidates(), b => probe(b, timeoutMs), workerBase());
  if (winner) { chosen = winner; writeCache(winner); return winner; }
  return '';
}

/**
 * Traduit une panne d'appel en phrase pour un client, pas en exception.
 * `Failed to fetch` n'a jamais aidé personne : ce que ça veut dire ici, c'est
 * « le backend est injoignable », et ça se règle côté réseau ou côté adresse.
 */
export function explainWorkerFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Le serveur de paiement est injoignable depuis votre réseau (connexion coupée, ou adresse du serveur changée).';
  }
  if (/abort/i.test(msg)) return 'Le serveur de paiement a mis trop de temps à répondre.';
  if (/json/i.test(msg)) return 'Le serveur de paiement a répondu quelque chose d’illisible.';
  return 'Le serveur de paiement n’a pas répondu (' + msg.slice(0, 90) + ').';
}
