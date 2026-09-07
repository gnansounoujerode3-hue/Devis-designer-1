/* ============================================================
   ROUTEUR — trois vues, un seul fichier HTML (aucune dépendance externe)
   ------------------------------------------------------------
   #/vendeur  → espace réservé au vendeur (jamais linked depuis le site)
   #/app      → l'application (éditeur de devis)
   #/accueil  → la page d'accueil publique (landing)
   rien / #   → landing au premier visiteur, puis l'application si la
                personne a déjà cliqué sur « Ouvrir l'application »
                (préférence 'dd_view' en localStorage : on ne fait pas
                refaire la page vitrine à quelqu'un qui revient travailler).
   ============================================================ */

export type View = 'landing' | 'app' | 'vendor';

/** Clé localStorage — la même logique de persistance que le reste de l'app. */
export const VIEW_PREF_KEY = 'dd_view';

export function readViewPref(): 'landing' | 'app' | null {
  try {
    const v = localStorage.getItem(VIEW_PREF_KEY);
    return v === 'app' || v === 'landing' ? v : null;
  } catch { return null; }
}

export function writeViewPref(v: 'landing' | 'app'): void {
  try { localStorage.setItem(VIEW_PREF_KEY, v); } catch { /* stockage privé : on ignore */ }
}

/**
 * Décide quelle vue afficher. Fonction pure (tableau de hachage + préférence
 * en entrée) pour pouvoir être testée sans DOM.
 * Un hash explicite gagne toujours sur la préférence.
 */
export function resolveRoute(hash: string, pref: 'landing' | 'app' | null): View {
  // on normalise « #/app », « #app », « /#/vendeur »… : la casse et le slash initial ne comptent pas
  const h = (hash || '').toLowerCase().replace(/^#\/?/, '');
  if (h.startsWith('vendeur')) return 'vendor';
  if (h.startsWith('app')) return 'app';
  if (h.startsWith('accueil') || h.startsWith('home')) return 'landing';
  return pref === 'app' ? 'app' : 'landing';
}

export function currentView(): View {
  return resolveRoute(window.location.hash, readViewPref());
}

/** Aller dans l'application (mémorise le choix pour les visites suivantes). */
export function goApp(): void {
  writeViewPref('app');
  if (window.location.hash !== '#/app') window.location.hash = '#/app';
  window.scrollTo({ top: 0 });
}

/** Revenir à la page d'accueil publique. */
export function goLanding(): void {
  writeViewPref('landing');
  if (window.location.hash !== '#/accueil') window.location.hash = '#/accueil';
  window.scrollTo({ top: 0 });
}
