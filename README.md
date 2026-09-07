# Devis Designer — Application Web

Générateur de devis et factures professionnels en SVG/PDF, **100 % web** :
aucune installation, accessible depuis n'importe quel navigateur (PC, téléphone, tablette),
mises à jour automatiques.

## Démarrage rapide

```bash
npm install        # installer les dépendances
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # build de production (fichier unique dist/index.html)
npm run preview    # prévisualiser le build
```

## Fonctionnalités

- **Application web, sans installation — mais avec connexion** : un seul fichier `dist/index.html`,
  servi par Netlify (pas de mode hors-ligne : sans réseau, la page ne se charge pas ; en revanche
  les documents sont enregistrés sur l'appareil au fil de l'eau)
  (`https://devisdesigner.netlify.app/`) ; ajoutable à l'écran d'accueil du téléphone
- **12 templates de devis/factures** personnalisables (couleurs, polices, logo, conditions)
- **Édition directe** : toucher/cliquer un texte sur l'aperçu pour le modifier (n'importe quel texte)
- **Signatures** manuscrites (émetteur + client), envoi pour signature
- **Export** : PDF (A4 multipages), SVG, présentation plein écran
- **Sauvegarde / restauration** JSON (export/import de tous les devis + clients)
- **Monétisation intégrée** : 20 exports gratuits par appareil sur 30 jours glissants (comptés par
  le Worker — voir plus bas), abonnements 2000 F/mois, 15 000 F/an, design personnalisé 5 000 F,
  tous les designs 50 000 F/an (activation automatique après paiement, code en secours)
- **Parrainage (seule récompense gratuite)** : 1 parrainage valide = **1 mois offert au parrain**
  (le filleul ne reçoit rien) — plafond 12 mois/an. Aucun concours, aucun autre bonus de mois gratuits
- **FAQ, CGU et politique de confidentialité** intégrés (conforme loi n°2017-20 Bénin)
- **Rappel d'expiration** d'abonnement, carnet de clients, filigrane de statut

## Structure

```
devis-designer/
├── index.html          # Point d'entrée
├── package.json        # Dépendances & scripts
├── vite.config.ts      # Configuration Vite (fichier unique)
├── tsconfig.json       # TypeScript strict
├── backend/
│   └── worker.js       # Serveur : codes d'activation, quota d'exports, parrainage (Cloudflare Worker)
└── src/
    ├── main.tsx        # Bootstrap React
    ├── App.tsx         # Composant racine
    ├── components/     # Paywall, Espace vendeur (VendorPage), FAQ, Legal, Onboarding...
    ├── templates/      # Les 12 templates SVG
    ├── lib/            # license (codes émis en local), quota (compteur serveur), referral
    │                   # (parrainage), adminKey (clé ADMIN_PASS), config, store...
    ├── store.ts        # Persistance localStorage + sauvegarde JSON
    ├── types.ts        # Types partagés
    └── assets/         # Logo
```

## 💰 Monétisation

| Offre | Prix | Effet |
|---|---|---|
| Gratuit | 0 F | **20 exports PDF / envois signature** par appareil sur 30 jours glissants, comptés par le serveur (la création de devis reste libre) — voir [Quota anti navigation privée](#-quota-dexports-anti-navigation-privée) |
| Abonnement mensuel | 2 000 F / mois | Exports illimités pendant 1 mois (cumulable) |
| Abonnement 1 an | 15 000 F / an | Exports illimités pendant 1 an |
| Design personnalisé | 5 000 F | Un design sur mesure pour votre template (paiement unique) |
| TOUS les designs (1 an) | 50 000 F / an | N'importe quel design de template gratuit pendant 1 an + exports illimités |
| **Parrainage** | 0 F | **1 mois offert au parrain** par parrainage valide (max. 12 mois / 12 mois glissants) |

### Comment ça marche (sans serveur)

> ⚠️ « Sans serveur » veut dire : *la vérification des codes et le compteur peuvent
> fonctionner sans backend*. **L'application, elle, a besoin d'internet** pour s'ouvrir
> (c'est un site web servi par Netlify) — il n'y a pas de mode hors-ligne ni de PWA.
1. Le client crée ses devis librement. Chaque **export PDF** ou **envoi pour signature** consomme 1 des 20 gratuits.
2. Épuisé → le client paie via **Chariow** (Mobile Money : MTN MoMo, Orange Money, Wave, Moov — commission 15 %).
3. Vous générez un **code d'activation** depuis la page vendeur réservée (voir « Espace vendeur » ci-dessous).
4. Vous envoyez le code au client (1 clic WhatsApp depuis la page vendeur, ou SMS). Il le saisit dans « Déjà abonné ? » → licence activée immédiatement.

### Personnalisation (`src/lib/config.ts`)
- `VENDOR.PHONE` / `VENDOR.WHATSAPP` / `VENDOR.EMAIL` : vos coordonnées
- `VENDOR_PIN` : PIN de l'espace vendeur (**à changer avant lancement !**)
- `VENDOR.DOWNLOAD_LINK` : l'URL de votre application web (pour les messages de partage)
- `CHARIOW_LINKS` : liens de paiement Chariow par produit (MONTHLY 2000 F, ANNUAL 15000 F, CUSTOM_DESIGN 5000 F, ALL 50000 F)
- `CHARIOW_API.KEY` : clé API Chariow pour paiements automatiques (⚠️ CORS : via un mini serveur)

## ⚡ Paiement automatique (offre activée sans code)

Par défaut, le flux est manuel (le client paie, vous générez un code, il le saisit).
Il est possible d'activer un **flux 100 % automatique** : le client paie par Mobile
Money, et **l'application active l'offre toute seule**, sans aucune saisie.

```
Client                Worker Cloudflare              Chariow
  |  1. choisit l'offre  |                              |
  |  2. /checkout ──────>│ 3. crée la vente (API) ────>│
  |  4. page de paiement <│──────────────────────────────│
  |  5. paie (MoMo) ────────────────────────────────────>│
  |                     |  6. Pulse signé (webhook) <───│
  |                     |  7. vérifie la vente (API)    |
  |  8. /check (polling)│                              |
  |  9. code signé <────│ (généré 1 seule fois)         |
  10. offre activée automatiquement dans l'app
```

### Mise en place (une seule fois, ~20 min)

1. **Chariow** (https://chariow.com) :
   - Créez 4 produits et notez leurs IDs (`prd_...`) :
     Abonnement 1 mois (2 000 F) · Abonnement 1 an (15 000 F) ·
     Design personnalisé (5 000 F) · Tous les designs (50 000 F)
   - **Automations → Pulses** : créez un Pulse vers
     `https://VOTRE-WORKER.workers.dev/webhook` (événements de vente),
     puis copiez son **secret de signature** (`whsec_...`)
### Endpoints du Worker

| Route | Rôle |
|---|---|
| `POST /checkout`, `POST /check`, `POST /webhook` | Paiement automatique Chariow (création, suivi, Pulse) |
| `POST /validate` | Vérification / anti-rejeu d'un code |
| `POST /export` | Compteur d'exports par installation (`used:<deviceId>`) |
| `POST /referral/register` | Déclare une installation (+ son code parrain) : le 1ᵉʳ parrain enregistré gagne, jamais écrasé |
| `POST /referral/export` | Signale un export du filleul → valide le parrainage et **émet** le code récompense (1 par filleul, plafond 12 mois/an par parrain) |
| `POST /referral/status` | Relit l'état d'une installation (réinstall, stockage vidé) |
| `POST /referral/stats` | Compteurs de parrainage pour l'espace vendeur (`admin` = `ADMIN_PASS`) |
| `POST /quota/state` | Lecture du compteur d'exports d'un appareil (empreinte + code d'installation, max des deux) |
| `POST /quota/reserve` | **Réserve 1 export avant de le produire** : refus au-delà de `QUOTA_LIMIT` sur `QUOTA_WINDOW_DAYS` jours |
| `POST /quota/confirm` | Confirme l'export (le compteur est déjà engagé) et renvoie l'état à jour |
| `POST /quota/release` | Restitue la place si la génération du PDF a échoué |
| `POST /quota/request` | Le client demande un déblocage au vendeur (1 demande / 12 h par empreinte) |
| `POST /quota/pending` | File d'attente des demandes pour l'espace vendeur (`admin` = `ADMIN_PASS`) |
| `POST /quota/grant` / `POST /quota/revoke` | Accord / retrait d'un déblocage temporaire (en jours), lié à l'empreinte |
| `GET /debug` | Diagnostic (secrets, KV, dernier webhook) |

> ⚠️ Ces routes `/*referral*` sont **nouvelles** : redéployez `backend/worker.js`
> (bouton *Deploy* dans l'éditeur du Worker, ou `npx wrangler deploy`) pour que le
> parrainage soit piloté par le serveur. Tant que le Worker ne répond pas,
> l'application continue d'émettre les récompenses **en local** (aucun blocage).
> Le code généré par le Worker doit être signé avec le **même secret** que l'app :
> `SECRET_KEYS = {"v1":"<secret encodé de src/lib/license.ts>"}`.

2. **Cloudflare** (gratuit) : Workers & Pages → Create → Worker →
   collez le contenu de `backend/worker.js` → Deploy, puis :
   - Variables : `SECRET_KEYS` (JSON, ex `{"v1":"votre-secret"}`),
     `ADMIN_PASS` (n'importe quelle chaîne solide — c'est la clé des routes vendeur,
     pas le code de la page ; vous la collerez une fois dans `#/vendeur`),
     `REF_MIN_AGE_HOURS` (optionnel, anti-abus parrainage),
     `QUOTA_LIMIT` (exports gratuits par appareil, défaut 20),
     `QUOTA_WINDOW_DAYS` (fenêtre glissante en jours, défaut 30),
     `QUOTA_USE_IP` = `1` pour compter aussi par IP (attention : en Afrique de l'Ouest
     beaucoup de clients partagent la même IP opérateur — à ne activer qu'en cas d'abus massif),
     `CHARIOW_KEY` (clé API `sk_live_...`),
     `CHARIOW_PULSE_SECRET` (le `whsec_...`),
     `PRODUCT_IDS` = `{"MONTHLY":"prd_...","ANNUAL":"prd_...","DESIGN":"prd_...","ALL":"prd_..."}`
   - Storage → KV : créez un namespace `DD_KV` et liez-le au Worker
3. **L'application** : dans `src/lib/config.ts` →
   `AUTO_PAY_WORKER_URL = "https://VOTRE-WORKER.workers.dev"`

Sécurité : la clé API Chariow ne vit que dans le Worker (jamais dans l'app),
le webhook est vérifié par signature HMAC, chaque vente est reliée à
l'installation (code parrain) et le code d'activation n'est délivré qu'une seule fois.

Si `AUTO_PAY_WORKER_URL` est vide : le flux manuel actuel reste actif
(lien Chariow / Mobile Money + code depuis l'espace vendeur).

## 🔐 Espace vendeur (page propriétaire)

Page **réservée au vendeur** (vous), **invisible des utilisateurs** : aucune
liaison dans l'application, accès uniquement via l'URL :

```
https://devisdesigner.netlify.app/#/vendeur
```

1. Saisissez le **PIN** (`VENDOR_PIN` dans `src/lib/config.ts` — par défaut `2468`, **à changer**).
   La session reste ouverte tant que l'onglet est ouvert (déconnexion manuelle possible).
   Puis, une seule fois, collez la valeur de la variable `ADMIN_PASS` de votre Worker dans
   le bandeau **CLÉ SERVEUR (WORKER)** et cliquez **Tester la clé** : sans elle, le suivi
   parrainage et la file des déblocages restent vides (le PIN de la page ne suffit pas,
   et c'est voulu — il est public).
2. Depuis le tableau de bord :
   - **Statistiques** : total encaissé, ventes du mois, codes actifs/expirés, clients uniques,
     ventilation par offre
   - **Génération de codes** : choisir l'offre, saisir le nom + n° WhatsApp du client
     (optionnel) → le code est généré, copié, et envoyé en 1 clic sur WhatsApp.
     L'offre « Parrainage — 1 mois offert » (0 F) sert à créditer manuellement un parrain
     (nombre de filleuls récompensés réglable, borné à 12 mois)
   - **Panneau PARRAINAGE** : rappel de la politique + codes de récompense émis et mois crédités
   - **Panneau QUOTA D'EXPORTS & DÉBLOCAGES** : demandes de déblocage reçues (empreinte,
     note du client, IP/pays, compteur) et boutons 30 j / 7 j / 1 j — voir plus bas
   - **Historique des ventes** : date, client, offre, prix, code, statut (actif/expiré —
     un code reste activable 30 jours après sa génération), copier / WhatsApp / supprimer
   - **Export CSV** de l'historique pour archiver vos ventes

Les codes sont signés par HMAC : un code généré ici s'active sur n'importe quelle
installation de l'application. L'historique est conservé dans le navigateur où il est
généré (exportez régulièrement en CSV).

## 🌐 Déploiement web

Le build produit **un seul fichier** `dist/index.html` (tout inliné : JS, CSS, logo, favicon).
Il peut être hébergé **n'importe où** :

### Option 1 — Vercel (recommandé, gratuit)
```bash
npm run deploy
```
Ou via le tableau de bord vercel.com : importez le dépôt, framework = Vite, build = `npm run build`, output = `dist`.

### Option 2 — Netlify (gratuit) — votre cas : `devisdesigner.netlify.app`
Le dépôt ne contient **que les sources** (`dist/` n'est pas versionné) : il faut donc
publier le build à chaque changement.

**Méthode A — en local (≈ 1 minute)**
```bash
npm install
npm run build                              # -> dist/index.html (fichier unique, ~1,4 Mo)
npx netlify-cli deploy --prod --dir=dist    # 1re fois : demande une connexion Netlify
```
Si le CLI demande sur quel site pousser : `npx netlify-cli link` → choisissez **devisdesigner**.

**Méthode B — à la main** : glissez-déposez le **dossier `dist/`** sur
<https://app.netlify.com/drop>. Sur un site déjà connecté à Git, laissez Netlify builder
(build command `npm run build`, publish directory `dist`).

**Vérifier que c'est bien la nouvelle version qui tourne** : le pied de page affiche
`Devis Designer · Version X.Y.Z` (constante `APP_VERSION` de `src/lib/config.ts`) et
l'en-tête de `#/vendeur` ajoute la marque de build (`BUILD_TAG`). **Incrémentez
`APP_VERSION` à chaque publication** : après déploiement, rechargez en dur
(Ctrl+Maj+R) et lisez le numéro — s'il n'a pas bougé, c'est l'ancien bundle (cache
browser/Netlify, ou mauvais dossier envoyé).

### Option 3 — Hébergement classique (OVH, Hostinger, etc.)
- Téléversez `dist/index.html` (et le dossier `dist/` entier) sur votre espace web
- L'application est un fichier unique : pas de serveur, pas de configuration

### Option 4 — GitHub Pages
```bash
npm run build
npx gh-pages -d dist
```

## 🔐 Sécurité

### Couche 1 — Durcissement local (déjà actif)
- Secret encodé (base64) · codes valables 30 jours · anti-brute-force (5 échecs → 1h)
- Compteur d'exports à double emplacement (localStorage + IndexedDB)
- PIN de l'espace vendeur (`VENDOR_PIN` dans `src/lib/config.ts`, par défaut `2468` — à changer)

### Couche 2 — Serveur de validation (`backend/worker.js`, optionnel)
Cloudflare Worker **gratuit** (100k requêtes/jour) : validation des codes côté serveur,
anti-rejeu, quota par appareil. Voir le fichier pour les instructions de déploiement.

## 🎁 Parrainage — la seule récompense gratuite de l'app

**Politique unique : 1 parrainage = 1 mois gratuit pour le PARRAIN.** Le filleul ne reçoit
aucune contrepartie, et il n'existe aucun concours ni autre dispositif de mois gratuits
(l'ancien « concours 3 mois gratuits » et sa popup ont été supprimés de l'application).

| Mécanisme | Détail |
|---|---|
| **Code parrain** | Chaque installation a un code unique `DDREF-XXXXXXXX` (bouton « PRO » → encart PARRAINAGE) |
| **Partage WhatsApp 1 clic** | Bouton « Parrainer un ami sur WhatsApp » : message pré-écrit + lien + code parrain |
| **Lien `?ref=`** | `https://votre-app/?ref=DDREF-XXXXXXXX` enregistre automatiquement le code parrain à l'arrivée — le message de partage construit ce lien tout seul à partir de `VENDOR.DOWNLOAD_LINK` (voir `referralDownloadLink()`) |
| **Saisie manuelle** | Le filleul qui reçoit le code oralement le tape dans l'encart « Un ami vous a parrainé ? » |
| **Condition de validité** | Le filleul doit avoir **exporté au moins un document** (PDF ou envoi pour signature) |
| **Récompense** | +1 mois offert **au parrain** : code remerciement transmis sur WhatsApp puis collé dans « Déjà abonné ? » |
| **Émission par le Worker** | `POST /referral/export` : le serveur compte l'export du filleul, n'émet **qu'une** récompense par installation de filleul et applique le plafond de 12 mois / parrain (12 mois glissants). Repli local automatique si le Worker est injoignable |
| **Bascule** | `REFERRAL_VIA_WORKER` dans `src/lib/config.ts` (`false` = émission des récompenses uniquement en local, sans serveur) |
| **Anti-abus optionnel** | variable Worker `REF_MIN_AGE_HOURS` : âge minimal (heures) d'une installation avant que son export valide un parrainage (0 = désactivé) |
| **Code nominatif** | Le code récompense est lié à l'installation du parrain : refusé ailleurs. Activable 30 jours |
| **Plafond** | 12 mois offerts maximum sur 12 mois glissants, par parrain |
| **Bannière quota bas** | ≤ 5 exports gratuits → bandeau d'urgence avec le code parrain et le bouton « Parrainer » |
| **Suivi vendeur** | `#/vendeur` → panneau PARRAINAGE : codes émis, mois crédités + génération manuelle (offre 0 F) |

Fichiers concernés : `src/lib/referral.ts` (mécanique), `src/lib/license.ts`
(kind de code `REFERRAL`, empreinte du code parrain, plafond annuel),
`src/components/ReferralCard.tsx` (encart parrain/filleul), `src/components/ReferralToast.tsx`
(rappel « envoyer le code à mon parrain » après le 1er export du filleul).

## 🛡️ Quota d'exports anti navigation privée

**Problème réglé** : le compteur des 20 exports gratuits vivait uniquement dans le
navigateur. Une fenêtre de navigation privée, un autre navigateur, un autre appareil
— ou simplement « Effacer les données du site » — le remettait à zéro : on pouvait
exporter à l'infini gratuitement. Le compteur ne voyageait même pas dans la
sauvegarde JSON, donc « navigation privée + réimport » suffisait.

**Deux couches désormais** (`src/lib/quota.ts` + les routes `/quota/*` du Worker) :

| Couche | Ce qui se passe |
|---|---|
| **B — la sauvegarde transporte le compteur** | `exportAllData()` écrit `exportCount` dans le JSON (`version: 2`) ; `importAllData()` lui applique `setExportCountAtLeast()`, qui ne fait **qu'augmenter** le compteur. Réimporter une sauvegarde ne rend donc jamais de quota neuf. |
| **A — le serveur tient le compteur** | Avant chaque PDF / envoi signature, l'app appelle `POST /quota/reserve`. Le Worker compte sur **l'empreinte de l'appareil** (signaux non effacés par la navigation privée : userAgent, langue, plateforme, cœurs, écran, fuseau horaire…) **et** sur le code d'installation, en retenant le **max des deux seaux** sur une fenêtre glissante de 30 jours. Une nouvelle « installation » ne remet donc rien à zéro. |
| **Blocage dur** | Au-delà du plafond, l'export est refusé (paywall), **sauf** déblocage accordé par le vendeur. Un échec de génération restitue la place (`/quota/release`), le refus n'aggrave pas le compteur. |
| **Déblocage en 1 clic** | Le client bloque → bouton « Vous êtes un nouveau client ? » dans le paywall → `POST /quota/request`. Vous voyez la demande dans `#/vendeur` (panneau **QUOTA D'EXPORTS & DÉBLOCAGES** : empreinte, note du client, IP/pays, compteur) et vous cliquez sur *Débloquer 30 j / 7 j / 1 j*. Le client n'a rien à faire d'autre : le déblocage suit l'**empreinte**, pas l'installation. |
| **Hors-ligne** | Worker injoignable ⇒ l'app retombe sur son compteur local. Un client légitime sans réseau n'est **jamais** bloqué à cause du serveur. |
| **Abonnés** | Une licence active court directement : aucun appel `/quota/*` n'est émis pour elle. |

### Réglages

- Côté app : `QUOTA_SERVER_ENFORCEMENT = false` dans `src/lib/config.ts` revient à
  l'ancien fonctionnement (compteur purement local).
- Côté Worker : variables `QUOTA_LIMIT` (20), `QUOTA_WINDOW_DAYS` (30), `QUOTA_USE_IP` (0/1).
- **Deux codes différents, ne les confondez pas** :

  | | À quoi ça sert | Où c'est |
  |---|---|---|
  | `VENDOR_PIN` (`2468`) | ouvrir la page `#/vendeur` sur votre écran | `src/lib/config.ts` — donc **dans le bundle public** : ce n'est pas un secret, juste un filtre à curieux |
  | `ADMIN_PASS` du Worker | autoriser les appels sensibles `POST /referral/stats`, `/quota/pending`, `/quota/grant`, `/quota/revoke` | variable secrète du Worker **et** saisie une seule fois dans `#/vendeur` → bandeau « CLÉ SERVEUR » |

  La clé serveur n'est **jamais écrite dans `config.ts`** (elle se lirait dans le
  bundle) : vous la collez une fois dans le bandeau « CLÉ SERVEUR », elle reste dans le
  `localStorage` de *votre* appareil (`dd_worker_admin`, bouton **Oublier** pour l'effacer).
  Bouton **Tester la clé** = contrôle de déploiement (vert ⇒ stats parrainage et
  déblocages fonctionnent ; 401 ⇒ la clé saisie ≠ la variable `ADMIN_PASS` ; 404 ⇒
  `backend/worker.js` pas encore redéployé).
- N'oubliez pas de **redéployer** `backend/worker.js` et de reconstruire l'app :
  sans les routes `/quota/*`, le compteur reste local (aucun blocage du client).

### Ce que ça ne fait pas (honnêtement)

Ce n'est **pas de la DRM**. L'app tourne dans le navigateur : quelqu'un qui modifie le
bundle, auto-héberge une copie ou retire l'appel au Worker contourne la couche A — il
lui reste la couche locale (B). Le dispositif ferme les portes ouvertes à tout le monde
(fenêtre privée, changement de navigateur, effacement du stockage, réimport de
sauvegarde, multi-installs sur le même PC) ; il ne ferme pas la porte à un développeur
déterminé qui possède le code. Pour du blocage réellement infranchissable, il faut
que le PDF soit **généré côté serveur** (les données ne sortent jamais brutes) : c'est
un autre chantier.

Entre les deux, les leviers à faible effort restent : abaisser `QUOTA_LIMIT`, ou ajouter
un filigrane « Version d'essai » sur les PDF gratuits.

## 🔗 Lien public & lien de parrainage

Tout part d'une seule constante, `VENDOR.DOWNLOAD_LINK` dans `src/lib/config.ts`
(actuellement `https://devisdesigner.netlify.app/`) :

- les boutons « Parrainer un ami sur WhatsApp » partagent **`…/?ref=DDREF-VOTRECODE`** ;
- à l'arrivée, `App.tsx` lit `?ref=`, enregistre le code parrain du filleul et enlève
  le paramètre de l'URL propre (pas besoin pour lui de taper quoi que ce soit) ;
- la FAQ, les partages et l'aperçu WhatsApp (`index.html` → balises `og:`) utilisent la
  même adresse.

**Si vous changez de domaine, changez-la ici** puis recontruisez/publiez — sinon les liens
de parrainage pointent vers l'ancien site et les nouveaux filleuls ne comptent pas.

## Notes

- **Données** : stockées dans le navigateur (localStorage). Encourager la sauvegarde JSON
  (barre « SAUVEGARDE » sur la page d'accueil) — indispensable sur le web partagé.
- **Responsive** : interface optimisée PC et mobile (header compact, tap pour éditer, boutons visibles au toucher).
- **QR** : retiré de tous les templates (exigence utilisateur).
- **Aucun emoji** dans l'interface (exigence utilisateur).
