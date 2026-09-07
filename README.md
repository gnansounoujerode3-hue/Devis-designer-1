# Devis Designer — Application Web

Générateur de devis et factures professionnels en SVG/PDF, **100 % web** :
aucune installation, accessible depuis n'importe quel navigateur (PC, téléphone, tablette),
mises à jour automatiques. Le site présente deux vues : une **page d'accueil publique**
(landing : offre, modèles, tarifs, parrainage, FAQ) puis **l'application** elle-même.

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
- **Sauvegarde / restauration** JSON (export/import de tous les devis + clients, designs
  importés compris)
- **Design personnalisé** : le vendeur livre un fichier `.dddesign.js`, le client l'importe ;
  jusqu'à 6 modèles importés coexistent chez lui. Voir plus bas « Design personnalisé
  (5 000 F) : fabriquer et livrer le fichier » et les suites `npm run test:ui`.
- **Monétisation intégrée** : 20 exports gratuits par appareil sur 30 jours glissants (comptés par
  le Worker — voir plus bas), abonnements 2000 F/mois, 15 000 F/an, design personnalisé 5 000 F,
  tous les designs 50 000 F/an (activation automatique après paiement, code en secours)
- **Parrainage (seule récompense gratuite)** : 1 parrainage valide = **1 mois offert au parrain**
  (le filleul ne reçoit rien) — plafond 12 mois/an. Aucun concours, aucun autre bonus de mois gratuits
- **FAQ, CGU et politique de confidentialité** intégrés (conforme loi n°2017-20 Bénin)
- **Rappel d'expiration** d'abonnement, carnet de clients, filigrane de statut

## Design personnalisé (5 000 F) : fabriquer et livrer le fichier

Le client qui achète l'offre « Design Personnalisé » reçoit **1 mois d'exports illimités**
en plus du design (sinon il paierait sans pouvoir exporter, s'il est déjà à 20 exports).
Le design lui-même n'est pas un code dans l'application : c'est **un fichier que vous
fabriquez et qu'il importe**. Aucun redéploiement, aucun compte, aucun serveur impliqué.

| Étape | Qui | Quoi |
| --- | --- | --- |
| 1 | Client | Paie (caisse automatique Chariow, ou Mobile Money + votre numéro). L'offre s'active, un mois d'exports avec. |
| 2 | Client | Bouton **« PRO »** → carte **« Importer mon design »** → *pas encore de fichier* → il vous écrit sur WhatsApp (`VENDOR.WHATSAPP`) pour décrire ce qu'il veut. |
| 3 | **Vous** | `cp scripts/design-example.tsx src/templates/DesignDupont.tsx`, vous adaptez la mise en page. |
| 4 | **Vous** | `npm run design:pack -- src/templates/DesignDupont.tsx --name="Design Dupont" --desc="Bloc client en bandeau" --author="Atelier Kpodé"` → écrit `src/templates/DesignDupont.dddesign.js` (≈ 7 ko). |
| 5 | **Vous** | Envoyez ce fichier `.dddesign.js` au client (WhatsApp, email, clé USB : c'est un fichier comme un autre). |
| 6 | Client | Carte « Importer mon design » → *Choisir le fichier reçu* (ou il colle son contenu). Le modèle apparaît dans l'onglet **STYLE**, à lui seul. Jusqu'à **6 designs** importés peuvent coexister (« Ajouter un autre design »). |
| 7 | Vous (si correction) | Vous modifiez le `.tsx`, vous re-packez, vous renvoyez le fichier ; il clique **Remplacer** sur la ligne concernée. L'emplacement garde son numéro, donc tous les devis déjà rédigés avec ce design basculent sur la nouvelle version. |

**Plusieurs designs chez un même client** : chaque fichier occupe un *emplacement* numéroté
de 1 à 6. Le premier s'appelle `custom` (nom historique), les suivants `custom-2` …
`custom-6` — c'est ce numéro que porte `QuoteData.templateId`. D'où trois règles :
**remplacer** un emplacement ne change pas son identifiant (les documents existants suivent),
**ajouter** prend le premier emplacement libre, et au-delà de 6 l'import est refusé avec le
mode d'emploi (« retirez-en un »). Dans la sauvegarde JSON, `customDesigns` est un tableau
**positionnel** : `[blob, null, blob]` = emplacements 1 et 3 ; un trou se note `null` pour que
chaque design retrouve son numéro. Un devis dont l'emplacement est devenu vide se rend avec un
modèle embarqué, jamais avec un écran blanc.

**Côté commande** : le `--` après `design:pack` n'est pas décoratif. La forme
`npm run design:pack <fichier> --name "A B"` ne marche pas : npm garde `--name` pour lui et ne
rend que les mots d'après, ce qui étiquetterait le fichier avec le nom du fichier. Le packer s'en
aperçoit et refuse au lieu de livrer un design mal nommé. Bonne forme (les deux styles
`--name=valeur` et `--name valeur` sont alors acceptés) :
`npm run design:pack -- src/templates/DesignDupont.tsx --name="Design Dupont"`.

**Le fichier** : en-tête signé (JSON des métadonnées + HMAC-SHA256 en fin de fichier), puis le
code du modèle en CommonJS, `react` et `react/jsx-runtime` laissés **externes** — c'est
l'application qui les fournit à l'exécution, donc le design importé utilise bien le React de
l'app (deux copies de React casseraient les hooks). L'application **refuse** : un fichier sans
en-tête, un fichier modifié (ne serait-ce qu'un caractère), une signature qui ne vient pas
d'elle, plus de 250 ko, ou un fichier qui n'exporte pas de composant. Un design importé est
conservé dans le `localStorage` de l'appareil **et voyage dans la sauvegarde JSON**
(« Exporter une copie »), avec revérification de la signature à la restauration.

**Contrat du modèle** (`scripts/design-example.tsx` est le gabarit commenté) : un composant
exporté par défaut, props `{ data, svgRef }`, qui renvoie **un seul** `<svg>` en
`viewBox="0 0 794 <hauteur>"` (794 = A4 à 96 dpi, 1123 = une page), avec `svgRef` attaché au
`<svg>` (c'est par là que passe l'export PDF). Des `<text>` uniquement — le PDF ne rend pas le
HTML, donc pas de `foreignObject` ; la couleur vient de `data.accentColor`, la police de
`data.fontFamily`, le filigrane de statut de `WATERMARK_LABEL[data.status]`. Hooks acceptés,
rendu synchrone (pas de `fetch` : le composant est appelé à chaque rendu, y compris pour
l'export).

**Ce que ça ne fait pas** (à savoir avant de vendre) : le design est stocké sur l'appareil du
client, il n'est donc pas visible des autres utilisateurs — mais il n'est pas chiffré non plus
(qui ouvre le fichier le lit). Le secret de signature est dans le bundle public : la signature
écarte les fichiers qui traînent et les modifications accidentelles, ce n'est pas une
protection contre un attaquant déterminé. Le `#/vendeur` reste le seul endroit où vous
émettez les codes ; la liste des designs livrés, elle, vit dans le `localStorage` du client —
gardez une copie de vos `.tsx` (c'est votre archive).

## Vérifier sans ouvrir le navigateur

```bash
npm run test:ui          # ou : npm test
```

Deux suites de garde-fous vivent dans `tests/`, exécutées par `tests/run.mjs` (esbuild emballe
le TSX avec un shim DOM minimal — `tests/shim.js` — et laisse `react`/`react-dom` imports de
`node_modules`, donc le harness rend avec le même React que l'app) :

| Suite | Ce qu'elle tient |
| --- | --- |
| `tests/design_test.tsx` | Tout le trajet du design sur mesure : pack du vendeur → fichier signé → refus des fichiers modifiés, tronqués, trop gros → import → **rendu par le vrai `QuoteSVG`** → emplacements 1 à 6 (ajout, remplacement, plafond, retrait) → sauvegarde JSON et restauration (avec blob falsifié) → code d'activation `DESIGN` → carte d'import dans les deux états. Les gabarits testés sont dans `tests/fixtures/`. |
| `tests/landing_test.tsx` | La page d'accueil se rend ; ses chiffres viennent des constantes (`PRICE_*`, `FREE_EXPORT_LIMIT`, `TEMPLATES.length`) et non de nombres recopiés ; aucune promesse interdite (mode hors-ligne, téléchargement, témoignages et étoiles inventés, ancien forfait de 3 mois, avoir) ; aucun emoji ; chaque mention du réseau dit la vérité ; la vignette de partage existe, fait 1200×630 et est déclarée sur le bon domaine. |

Une suite sort en code 1 si elle échoue, donc `npm test` a sa place dans une CI. Le réflexe qui
les garde vivantes : changez un comportement, écrivez l'assertion **avant**, elle doit rougir
puis verdir.

## Vignette de partage (ce que voient WhatsApp et les autres)

Un lien partagé n'affiche **aucun visuel** si la page ne déclare pas d'`og:image`.
Trois règles, vérifiées par `npm run test:ui` :

- l'URL est **absolue** (`https://devisdesigner.netlify.app/og-image.png`) et sur le même
  domaine que `og:url` ;
- le fichier est un **PNG raster** de **1200×630** (pas de SVG : les robots d'aperçu ne le
  lisent pas), sous 400 ko, et vit dans `public/` pour que Vite le recopie dans `dist/` ;
- les dimensions déclarées (`og:image:width` / `:height`) sont les dimensions **réelles** du
  fichier.

Pour la refaire (copie, prix, couleurs) :

```bash
pip install pillow                                # seule dépendance
python3 scripts/make-og-image.py                  # écrit public/og-image.png
python3 scripts/make-og-image.py --title "…" --sub "…" --chips "a|b|c" --url mondomaine.app
```

Le visuel est **dessiné par le script** (aucune capture d'écran) : le texte et la
mise en page de la vignette se règlent donc comme du code, et le faux document de droite
suit les proportions A4 réelles (794×1123). `index.html` porte les balises ; le script
accepte `--size`, `--logo`, `--note` (et `--note ""` pour retirer la ligne discrète).

> **Après déploiement**, si WhatsApp affiche toujours l'ancien aperçu : il **met la vignette
> en cache**. Renvoyez le lien avec un paramètre différent (`https://devisdesigner.netlify.app/?v=2`)
> pour le forcer à re-scroller la page, ou attendez quelques heures.

## Page d'accueil publique (landing)

| URL | Vue |
| --- | --- |
| `/` (racine) | **Landing**, sauf si le visiteur a déjà ouvert l'app : dans ce cas il retombe directement sur l'application (préférence `dd_view` en `localStorage`) |
| `#/accueil` ou `#/home` | Landing, même pour un visiteur qui a choisi l'app |
| `#/app` | L'application (bouton « Ouvrir l'application », lien « Accueil » dans le pied de page de l'app pour revenir en arrière) |
| `#/vendeur` | Espace vendeur (jamais linked depuis le site) |

Décision prise dans `src/lib/route.ts` (`resolveRoute()` est une fonction pure : elle est testable sans DOM).

**Ce qu'il faut savoir quand on modifie `src/components/LandingPage.tsx` :**

- **Aucun texte inventé.** Les tarifs viennent de `src/lib/license.ts`
  (`FREE_EXPORT_LIMIT`, `PRICE_*`), les modèles de `src/templates/index.ts` : la page les
  lit, elle ne les recopie pas. Si vous changez un prix, la landing suit automatiquement.
- **Pas de promesse de fonctionnement hors connexion** : l'app est un site web, elle a
  besoin d'internet pour s'ouvrir (la landing le dit dans le hero et dans sa FAQ).
- **Pas de témoignages, notes ou chiffres d'usage** : uniquement des faits vérifiables.
- Les aperçus de documents sont **réels** : ce sont les composants des modèles
  (`QuoteSVG`) qui rendent un jeu de données de démonstration, étiqueté « document de
  démonstration ». N'y mettez pas de faux clients réels.
- Les liens de navigation font défiler la page **sans toucher au `hash`** (sinon ils
  seraient pris pour des routes) : gardez `scrollToId()`, ne remplacez pas par `href="#id"`.
- `?ref=DDREF-…` est capté **aussi sur la landing** : un filleul qui lit la page d'accueil
  sans entrer dans l'app garde déjà le parrainage enregistré.
- `index.html` : données structurées JSON-LD (`SoftwareApplication`) + `canonical` +
  squelette de chargement. Le `og:url`/`canonical` doivent suivre un changement de
  `VENDOR.DOWNLOAD_LINK`.

## Structure

```
devis-designer/
├── index.html          # Point d'entrée
├── package.json        # Dépendances & scripts
├── vite.config.ts      # Configuration Vite (fichier unique)
├── tsconfig.json       # TypeScript strict
├── public/
│   └── og-image.png  # vignette des partages (WhatsApp, LinkedIn…) — voir « Vignette de partage »
├── backend/
│   └── worker.js       # Serveur : codes d'activation, quota d'exports, parrainage (Cloudflare Worker)
├── scripts/
│   ├── make-og-image.py  # régénère public/og-image.png (nécessite Pillow)
│   ├── design-pack.ts  # Le packager du vendeur : npm run design:pack -- <mon.tsx> --name="…"
│   └── design-example.tsx  # Gabarit de modèle commenté (contrat du fichier livré)
├── tests/
│   ├── run.mjs         # Lanceur de suites (esbuild + shim DOM, sortie code 1 si échec)
│   ├── shim.js         # localStorage/document/window minimaux pour rendre du React sous Node
│   ├── design_test.tsx # Tout le trajet du design personnalisé (67 assertions)
│   ├── landing_test.tsx# Vérité des copies de la page d'accueil (40 assertions)
│   └── fixtures/       # Modèles de test (probe-a, probe-b, hooks) packés comme de vrais fichiers
└── src/                # (designs/*.dddesign.js : artefacts livrés aux clients, hors Git)
    ├── main.tsx        # Bootstrap React
    ├── App.tsx         # Composant racine
    ├── components/     # LandingPage (accueil public), Paywall, Espace vendeur (VendorPage),
    │                   # CustomDesignCard (import du fichier), FAQ, Legal, Onboarding...
    ├── templates/      # Les 12 templates SVG + index.ts (registre, + les designs importés)
    ├── lib/            # route (accueil ↔ app), license (codes émis en local),
    │                   # quota (compteur serveur), referral (parrainage),
    │                   # designSecret (format .dddesign.js + HMAC),
    │                   # customDesign (les 6 emplacements du client),
    │                   # adminKey (clé ADMIN_PASS), config, store...
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
| Design personnalisé | 5 000 F | Le vendeur crée une mise en page à vos couleurs et la livre **en fichier** (`.dddesign.js`) à importer dans l'app ; **1 mois d'exports illimités inclus** (paiement unique). Jusqu'à 6 designs importés à la fois. |
| TOUS les designs (1 an) | 50 000 F / an | N'importe quel design de template gratuit pendant 1 an + exports illimités |
| **Parrainage** | 0 F | **1 mois offert au parrain** par parrainage valide (max. 12 mois / 12 mois glissants) |

### Les deux chemins de paiement (à ne pas mélanger)

> ⚠️ « Sans serveur » veut dire : *la vérification des codes et le compteur peuvent
> fonctionner sans backend*. **L'application, elle, a besoin d'internet** pour s'ouvrir
> (c'est un site web servi par Netlify) — il n'y a pas de mode hors-ligne ni de PWA.

**1. Le chemin normal — caisse Chariow, activation automatique** (c'est l'état actuel :
`AUTO_PAY_WORKER_URL` pointe sur votre Worker, et `productIds.DESIGN` est activé) :

1. Le client crée ses devis librement. Chaque **export PDF** ou **envoi pour signature** consomme 1 des 20 gratuits.
2. Épuisé → bouton **« PRO »** → l'offre → **« Payer … activation auto »** : le Worker crée la vente
   (`POST /checkout` → `api.chariow.com/v1/checkout`) et ouvre la caisse Chariow
   (Mobile Money : MTN MoMo, Orange Money, Wave, Moov — commission 15 %).
3. Pulse (webhook) confirme la vente → le Worker émet le code, l'app le relève (`/check`) et
   l'applique **toute seule**. Le client n'a **aucun code à recopier**.

**2. Le secours — virement Mobile Money direct + code saisi** (caisse injoignable, client
sans compte MoMo, paiement en espèces, Worker hors service) :

1. Le client vous paie `VENDOR.PHONE` (MTN/Orange/Wave/Moov ou espèces), il vous envoie la référence.
2. Vous générez le **code d'activation** dans `#/vendeur` (voir « Espace vendeur »).
3. Vous lui transmettez le code (1 clic WhatsApp). Il le saisit dans « Déjà abonné ? » → licence activée.

> Ce deuxième chemin doit rester écrit comme **secours** partout où il apparaît (page
> d'accueil, FAQ, `PaywallModal`) : présenté comme la voie normale, il fait croire au client
> qu'il doit vous envoyer de l'argent et attendre — alors que la caisse active tout seule.
> `npm run test:ui` le vérifie (« le numéro est encadré par la mention secours »).

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

**Vérifier que c'est bien la nouvelle version qui tourne** — deux sondes, une par service :

| Quoi | Où lire | Valeur attendue aujourd'hui |
|---|---|---|
| Le front (Netlify) | pied de page `Devis Designer · Version X.Y.Z`, et `BUILD_TAG` dans l'en-tête de `#/vendeur` | `Version 1.2.0` |
| Le backend (Worker) | <https://devisdesigner.gnansounoujerode3.workers.dev/debug> → champ `version` | `2026-09-07 (quota + parrainage serveur + DESIGN = design + 1 mois d'exports)` |

**Incrémentez `APP_VERSION` à chaque publication** (et la `version` de
`backend/worker.js` quand vous changez le Worker) : après déploiement, rechargez en dur
(Ctrl+Maj+R) et lisez le numéro — s'il n'a pas bougé, c'est l'ancien bundle (cache
browser/Netlify, ou mauvais dossier envoyé). `npm test` est là aussi : 114 assertions
vertes avant de pousser, dont les textes de la page d'accueil, des CGU et du `index.html`.

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
| **Worker injoignable** | Si le service de quota ne répond pas, l'app retombe sur son compteur local : un client légitime n'est jamais bloqué à cause du réseau. (Ce n'est pas un mode hors-ligne : sans connexion, la page ne se charge déjà pas.) |
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
