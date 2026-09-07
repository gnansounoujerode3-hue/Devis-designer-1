/* ============================================================
   Configuration vendeur & intégration Chariow (Mobile Money)
   ------------------------------------------------------------
   À PERSONNALISER avec VOS informations :
   1. VENDOR_PHONE    : votre numéro Mobile Money (client contacté
                        pour recevoir son code après paiement)
   2. VENDOR_WHATSAPP : lien WhatsApp pour les designs personnalisés
   3. CHARIOW_LINKS   : liens de paiement créés dans votre espace
                        Chariow (boutique / lien de paiement).
                         https://chariow.com (gratuit, commission 15%)
   ============================================================ */

export const VENDOR = {
  /** Numéro affiché au client pour recevoir son code après paiement */
  PHONE: '+229 01 91 94 35 18',
  /** Lien WhatsApp pour commander un design personnalisé */
  WHATSAPP: 'https://wa.me/2290191943518?text=Bonjour%2C%20je%20viens%20de%20payer%20le%20design%20personnalis%C3%A9%20(5000%20F).%20Voici%20ma%20description%20%3A',
  EMAIL: 'gnansounoujerode3@gmail.com',
  /** Nom de votre app / marque */
  APP_NAME: 'Devis Designer',
  /**
   * Lien public de l'app — c'est LUI qui part dans les messages de partage
   * WhatsApp et dans les liens de parrainage (referralDownloadLink() y ajoute
   * ?ref=VOTRE_CODE). À changer si vous déménagez le site.
   */
  DOWNLOAD_LINK: 'https://devisdesigner.netlify.app/',
};

/**
 * Code d'OUVERTURE de la page #/vendeur (génération de codes, suivi). À changer !
 * Il est dans le bundle : il écarte les curieux, ce n'est pas un secret.
 * NE LE CONFONDEZ PAS avec la clé admin du Worker (variable ADMIN_PASS) : celle-ci
 * se saisit une seule fois dans #/vendeur et reste sur votre appareil
 * (localStorage 'dd_worker_admin', voir src/lib/adminKey.ts) — elle n'est jamais
 * écrite ici, sinon n'importe qui la lirait dans le bundle.
 */
export const VENDOR_PIN = '2468';

/* ------------------------------------------------------------------
   VERSION AFFICHÉE — votre repère de déploiement.
   Incrémentez-la à chaque publication : le pied de page de l'app et
   l'en-tête de l'espace vendeur l'affichent. Un navigateur (ou Netlify)
   qui affiche encore l'ancienne version = ancien bundle en cache ou
   dossier mal envoyé.
   ------------------------------------------------------------------ */
export const APP_VERSION = '1.0.8';
/** Marque de build, visible uniquement dans l'espace vendeur. */
export const BUILD_TAG = 'page d\'accueil publique (landing) + route #/app (2026-09-07)';

/* ------------------------------------------------------------------
   PAIEMENT AUTOMATIQUE (optionnel).
   Renseignez l'URL de votre Worker Cloudflare (deployé depuis
   backend/worker.js) pour activer le flux automatique :
   paiement Chariow confirmé → offre activée automatiquement dans
   l'app, sans code saisi par le client.
   Voir README → « Paiement automatique ».
   Si vide : le flux manuel actuel (lien Chariow / Mobile Money +
   code généré dans l'espace vendeur) reste actif.
   ------------------------------------------------------------------ */
export const AUTO_PAY_WORKER_URL = 'https://devisdesigner.gnansounoujerode3.workers.dev';

/* ------------------------------------------------------------------
   PARRAINAGE CÔTÉ SERVEUR (recommandé).
   true  : la récompense « 1 parrainage = 1 mois offert au parrain » est
           émises et plafonnée par votre Worker (backend/worker.js) :
           1 seule récompense par installation de filleul, plafond de 12 mois
           par parrain sur 12 mois glissants, codes signés côté serveur
           (impossibles à fabriquer dans le navigateur).
           Si le Worker est injoignable (réseau en panne, Worker arrêté), l'application
           retombe automatiquement sur la génération locale.
   false : émission uniquement locale, sans jamais interroger de serveur.
           Attention : l'application elle-même reste un site web et exige une
           connexion pour s'ouvrir — « local » ne concerne que l'émission des codes.
   ------------------------------------------------------------------ */
export const REFERRAL_VIA_WORKER = true;

/* ------------------------------------------------------------------
   QUOTA D'EXPORTS CÔTÉ SERVEUR (anti navigation privée / multi-appareils).
   true : avant chaque export PDF ou envoi pour signature, l'app réserve un
          export auprès du Worker (POST /quota/reserve). Le Worker compte sur
          l'empreinte de l'appareil + le code d'installation (max des deux),
          sur une fenêtre glissante de 30 jours : ouvrir une fenêtre privée,
          changer de navigateur ou effacer les données ne remet plus le
          compteur à zéro. Au-delà du plafond, le client peut demander un
          déblocage que vous accordez en 1 clic dans #/vendeur.
   false: compteur purement local (contournable en navigation privée).
   Si le Worker est injoignable, l'app retombe toujours sur le compteur local.
   Plafond et fenêtre se règlent côté Worker : QUOTA_LIMIT, QUOTA_WINDOW_DAYS.
   ------------------------------------------------------------------ */
export const QUOTA_SERVER_ENFORCEMENT = true;

/* ------------------------------------------------------------------
   Liens de paiement Chariow (facultatif depuis le paiement automatique).
   Tant que AUTO_PAY_WORKER_URL est renseigné, ces liens ne servent plus :
   le Worker crée la vente et ouvre la caisse. Gardez-les vides, ou collez un
   lien de paiement Chariow par produit pour le secours (si le Worker tombe,
   le bouton « Payer » affiche alors le numéro du vendeur = paiement manuel).
   ------------------------------------------------------------------ */
export const CHARIOW_LINKS = {
  /** 2 000 F — abonnement 1 mois */
  MONTHLY: '',
  /** 15 000 F — abonnement 1 an */
  ANNUAL: '',
  /** 5 000 F — design personnalisé (paiement unique) */
  CUSTOM_DESIGN: '',
  /** 50 000 F — tous les designs pendant 1 an */
  ALL: '',
};

/* ------------------------------------------------------------------
   API Chariow (optionnel — pour les paiements 100% automatiques).
   Renseignez votre clé API (Espace Chariow  API) et le endpoint.
    L'appel depuis le navigateur peut être bloqué (CORS) :
   en production, passez par un petit serveur (voir README).
   ------------------------------------------------------------------ */
export const CHARIOW_API = {
  KEY: '',                       // ex: 'sk_live_...'
  BASE_URL: 'https://api.chariow.com/v1',
  MERCHANT_PHONE: VENDOR.PHONE,
  CURRENCY: 'XOF',
};

/**
 * Crée une demande de paiement via l'API Chariow.
 * Retourne l'URL de paiement à ouvrir, ou null si non configuré.
 */
export async function createChariowPayment(amount: number, description: string): Promise<string | null> {
  if (!CHARIOW_API.KEY) return null;
  try {
    const res = await fetch(`${CHARIOW_API.BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CHARIOW_API.KEY}`,
      },
      body: JSON.stringify({
        amount,
        currency: CHARIOW_API.CURRENCY,
        description,
        callback_url: window.location.origin + '/#/paiement-confirme',
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.payment_url || json.url || null;
  } catch {
    return null;
  }
}
