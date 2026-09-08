# Devis Designer — Application Web

Générateur de devis et factures professionnels en SVG/PDF, **100 % web** :
aucune installation, accessible depuis n'importe quel navigateur (PC, téléphone, tablette),
mises à jour automatiques. Le site présente deux vues : une **page d'accueil publique**
(landing : offre, modèles, tarifs, parrainage, FAQ) puis **l'application** elle-même.

## Démarrage rapide

```bash
npm install        # installer les dépendances
npm test           # 8 suites, 522 assertions, tout ce qui casse en silence
npm run build      # build de production (fichier unique dist/index.html)
npm run preview    # prévisualiser le build (localhost seulement)
npm run dev        # serveur de développement (http://localhost:5173)
```

`npm audit` doit répondre **0 vulnérabilité**. Ce n'était pas le cas avant 1.3.7 : `vite 7.3.2` et
`esbuild 0.27.x` traînaient deux trous qui ne s'ouvrent **que sous Windows et que sur le serveur de
développement** — `vite dev` exposait `launch-editor` à une fuite de hash NTLMv2 par chemin UNC, et
`server.fs.deny` se contournait par les chemins alternatifs de Windows (lecture de fichiers hors du
dossier du projet, et `esbuild` en faisait autant). Rien de tout cela n'entre dans `dist/index.html` :
un fichier livré à un client n'est pas concerné, c'est la machine qui développe qui l'était. Les
dépendances sont donc épinglées à `vite 7.3.6` et `esbuild ^0.28.2`, et `tests/deploy_test.tsx` refuse
désormais une version plus ancienne — une remontée de pin ne se perdra pas. Ne jouez pas
`npm audit fix --force` : il casse les pins et réécrit le lock pour des versions que rien n'a validées.

## Fonctionnalités

- **Application web, sans installation — mais avec connexion** : un seul fichier `dist/index.html`,
  servi par **Cloudflare Workers** en fichiers statiques — l'adresse publique est la constante
  `VENDOR.DOWNLOAD_LINK` (`https://devis-designer-app.jerode.workers.dev/`, voir « Option 5 ») ; l'adresse historique sur Netlify
  reste en ligne le temps que chacun fasse la bascule, puisque c'est le nom de domaine qui garde les documents
  d'un utilisateur. Pas de mode hors-ligne : sans réseau, la page ne se charge pas ; en revanche les
  documents sont enregistrés sur l'appareil au fil de l'eau ; ajoutable à l'écran d'accueil du téléphone
- **12 templates de devis/factures** personnalisables (couleurs, polices, logo, conditions)
- **Édition directe** : toucher/cliquer un texte sur l'aperçu pour le modifier (n'importe quel texte)
- **Signatures** manuscrites (émetteur + client), envoi pour signature
- **Export** : PDF (A4 multipages), SVG, présentation plein écran
- **Carnet de prestations** : chaque ligne que vous enregistrez (intitulé + dernier tarif) est
  retenue et repose d'un tap dans le devis suivant — voir « Carnet de prestations » plus bas
- **Sauvegarde / restauration** JSON (export/import de tous les devis + clients + fiches
  émetteurs + carnet de prestations, designs importés compris)
- **Design personnalisé** : le vendeur livre un fichier `.dddesign.js`, le client l'importe ;
  jusqu'à 6 modèles importés coexistent chez lui. Voir plus bas « Design personnalisé
  (5 000 F) : fabriquer et livrer le fichier » et les suites `npm run test:ui`.
- **Monétisation intégrée** : 20 exports gratuits par appareil sur 30 jours glissants (comptés par
  le Worker — voir plus bas), abonnements 2000 F/mois, 15 000 F/an, design personnalisé 5 000 F,
  tous les designs 50 000 F/an (activation automatique après paiement, code en secours)
- **Parrainage (seule récompense gratuite)** : 1 parrainage valide = **1 mois offert au parrain**
  (le filleul ne reçoit rien) — plafond 12 mois/an. Aucun concours, aucun autre bonus de mois gratuits
- **FAQ, CGU et politique de confidentialité** intégrés (conforme loi n°2017-20 Bénin)
- **Rappel d'expiration** d'abonnement, carnet de clients, carnet d'émetteurs, filigrane de statut

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

## Carnet d'émetteurs et fichier clients

Les deux carnets sont le même mécanisme appliqué aux deux bouts du document, et l'un sans l'autre
laisserait le client ressaisir quelque chose (un troisième, le carnet des **prestations**, est documenté
plus bas — même philosophie, pour les lignes du tableau) :

| | Clients | Émetteurs |
| --- | --- | --- |
| Type | `SavedClient` (`src/types.ts`) | `SavedEmitter` (`src/types.ts`) |
| Clés | `devis_designer_clients` | `devis_designer_emitters` + `devis_designer_emitter_default` |
| Fonctions | `loadClients` / `saveClient` / `deleteClient` | `loadEmitters` / `saveEmitter` / `deleteEmitter` / `setDefaultEmitter` / `getDefaultEmitterId` |
| Interface | onglet **Client**, bouton « CARNET » | onglet **Emetteur**, bouton « MON CARNET » |
| Effet | un tap remplit le bloc client | la fiche **par défaut** pré-remplit `designer*` de tout `createDefaultDoc` |

Quatre règles à connaître (suite `tests/emitter_test.tsx`) :

1. **Le pré-remplissage ne réécrit jamais un document existant.** Il a lieu à la *création* : un
   `partial` explicite (duplication d'un document, restauration d'une sauvegarde) passe donc avant la
   fiche par défaut. Les documents déjà enregistrés gardent l'en-tête avec lequel ils ont été faits.
2. **La fiche par défaut = la première enregistrée.** `setDefaultEmitter` en choisit une autre ;
   `deleteEmitter` reporte le choix sur la survivante, sinon les nouveaux documents partiraient vides.
3. **Un nom, une fiche.** L'application cherche la fiche portant le même nom (insensible à la casse et
   aux espaces de bordure) et réutilise son `id` : « + SAUVEGARDER CETTE FICHE » met à jour au lieu
   d'empiler les doublons.
4. **Le logo est sacrificiel.** Un logo est une image en base64 dans la fiche ; si `localStorage`
   refuse l'écriture (quota), `persistEmitters` réécrit la liste sans les logos et renvoie
   `withLogo: false` — les coordonnées, elles, sont toujours sauvegardées, et l'interface dit
   précisément ce qui a été perdu plutôt que de promettre un enregistrement complet.

Côté sauvegarde JSON : `BackupData` est en `version: 4` (v3 pour les fiches émetteurs, v4 depuis le
carnet de prestations) avec `emitters`, `emitterDefault` et `services`. Une copie
plus ancienne (qui ne contient pas la clé `emitters`) se restaure normalement et **laisse le carnet en
place** : une clé absente se lit « rien à restaurer », jamais « zéro fiche » — sinon restaurer un vieux
fichier effacerait l'en-tête enregistré depuis. À la restauration en mode
« fusion », une fiche importée portant le nom d'une fiche déjà présente est ignorée (le poste local est
considéré plus à jour), les autres sont ajoutées — comme pour les clients. Le message affiché après
Restauration énonce le nombre de fiches, pour que personne ne croie avoir perdu son en-tête.

## Vérifier sans ouvrir le navigateur

```bash
npm run test:ui          # ou : npm test
```

## Carnet de prestations : les lignes qui reviennent

Un devis, c'est presque toujours les mêmes lignes. `src/store.ts` tient donc un troisième carnet,
`SavedService`, dans la clé `devis_designer_services` :

| Fonction | Rôle |
| --- | --- |
| `learnServices(items, docId)` | appelé par `saveDoc` à **chaque** enregistrement : ajoute les lignes nouvelles, met à jour le prix de celles déjà connues |
| `rememberService(label, price, docId?)` | le bouton « ＋ MÉMORISER » d'une ligne (et le compteur d'usage) |
| `loadServices()` / `deleteService(id)` | lecture triée (les plus facturées d'abord) et retrait d'une habitude |
| `normServiceLabel` / `normalizeService` | la comparaison des intitulés et la remise à plat d'un stockage lu n'importe comment |
| `ServicesPicker` / `ServiceStar` / `ServicesDatalist` | l'onglet **Prestations** : pastilles cliquables, étoile par ligne, autocomplétion `dd-services` des deux panneaux de saisie |

Quatre règles, et chacune est jouée par `tests/services_test.tsx` :

1. **Un intitulé = une entrée.** La comparaison ignore la casse et les espaces multiples
   («  Charte graphique » et « charte  graphique » sont la même ligne) ; l'affichage, lui, garde
   votre texte tel que saisi.
2. **« Nouvelle prestation » n'est jamais mémorisé.** C'est le clavier qui écrit ça quand on ajoute
   une ligne, pas votre métier ; un intitulé vide est traité de la même façon.
3. **`uses` compte des documents, pas des sauvegardes automatiques.** L'autosave joue toutes les
   3 secondes : sans le garde-fou `docs[]` (borné à 40 identifiants), la même ligne gagnerait un
   point à chaque battement et le tri du carnet ne voudrait plus rien dire. Effet utile :
   `learnServices` ne réécrit le stockage que si quelque chose a réellement changé.
4. **Plafonné à `SERVICE_MAX` = 80, et sacrificiel.** Au-delà, les moins utilisées s'effacent ; si
   `localStorage` refuse l'écriture (quota), le carnet échoue en silence — un tarif perdu vaut mieux
   qu'un devis perdu. `loadServices` ne renvoie de toute façon jamais une entrée invalide : le
   stockage du navigateur est un lieu public.

Une ligne posée depuis le carnet remplit d'abord **la ligne vide** que vous étiez en train d'écrire
(une description absente ou laissée à « Nouvelle prestation »), sinon elle ajoute une ligne en fin de
tableau. Le compteur d'usage est incrémenté tout de suite, sans attendre l'autosave.

**Prix et devise** : le carnet retient un *nombre*, pas une devise. Le tarif d'une pastille est donc
celui posé pour la dernière fois, dans la devise du document de cette fois-là ; un artisan qui facture
en XOF et en EUR ajuste le champ « PRIX UNIT. » du document, qui reste seul maître du montant imprimé.

Côté sauvegarde JSON : `version: 4` ajoute `services`. Une copie plus ancienne (sans la clé) se
restaure normalement et **laisse le carnet local en place** — et le dit : « Prestations du carnet
conservées (cette copie est plus ancienne). », même discipline que pour les fiches émetteurs. En mode
fusion, une ligne déjà connue garde son prix local (le poste où vous travaillez est considéré plus à
jour) et voit son compteur relevé ; en mode remplacement, le carnet repart de la copie. Enfin, comme
tout le reste, le carnet vit dans le `localStorage` de **l'origine exacte** : une nouvelle adresse
publique = un poste vide, la copie JSON est le seul pont.

Huit suites de garde-fous vivent dans `tests/`, exécutées par `tests/run.mjs` (esbuild emballe
le TSX avec un shim DOM minimal — `tests/shim.js` — et laisse `react`/`react-dom` imports de
`node_modules`, donc le harness rend avec le même React que l'app) :

| Suite | Ce qu'elle tient |
| --- | --- |
| `tests/services_test.tsx` | Le carnet de prestations : apprentissage à l'enregistrement (jamais de doublon, jamais le libellé par défaut), compteur d'usage par document et non par autosave, plafond `SERVICE_MAX`, écriture idempotente, robustesse à un stockage n'importe quoi, sauvegarde `version: 4` (fusion qui n'écrase pas un tarif local, copie d'avant qui ne vide rien), pose d'une ligne dans le premier emplacement vide, et les astérisques du mur de paiement. |
| `tests/emitter_test.tsx` | La fiche de l'émetteur : pré-remplissage de tout nouveau document par la fiche par défaut (et victoire d'un en-tête explicite), mise à jour sur place au lieu d'un doublon, choix et report de la fiche par défaut, carnet vidé, repli de quota logo (`{ saved, withLogo }`) jusqu'à l'échec total, sauvegarde JSON (remplacement à l'identique, fusion dédupliquée, copie d'avant qui ne vide rien), et les textes réellement écrits à l'écran, dans la FAQ, sur la landing et dans ce README. |
| `tests/pulse_test.tsx` | La sonde Pulse de l'espace vendeur : les cinq pannes du webhook Chariow se traduisent en cinq phrases distinctes (injoignable ≠ jamais-reçu ≠ signature refusée ≠ silence ≠ vivant), l'URL à coller chez Chariow est toujours celle annoncée par le Worker, `analyzePulse` ne plante sur aucun `debug` fabuleux (chaîne, date illisible, compteur non numérique), chaque verdict a sa couleur, et le Worker exporte bien `webhookUrl` + `pulse.*`. |
| `tests/deploy_test.tsx` | L'hébergement : `wrangler.jsonc` est un Worker d'assets valide (dist, fallback SPA, aucun script, nom distinct de celui du Worker d'API) ; **un seul domaine public** dans `index.html`, `config.ts`, la landing, la page vendeur, le shim de test, la vignette et ce README ; les commandes annoncées (`deploy:cf`) existent ; le README dit la vérité sur Cloudflare et sur le déménagement d'origine (`localStorage`). |
| `tests/design_test.tsx` | Tout le trajet du design sur mesure : pack du vendeur → fichier signé → refus des fichiers modifiés, tronqués, trop gros → import → **rendu par le vrai `QuoteSVG`** → emplacements 1 à 6 (ajout, remplacement, plafond, retrait) → sauvegarde JSON et restauration (avec blob falsifié) → code d'activation `DESIGN` → carte d'import dans les deux états. Les gabarits testés sont dans `tests/fixtures/`. |
| `tests/landing_test.tsx` | La page d'accueil se rend ; ses chiffres viennent des constantes (`PRICE_*`, `FREE_EXPORT_LIMIT`, `TEMPLATES.length`) et non de nombres recopiés ; aucune promesse interdite (mode hors-ligne, téléchargement, témoignages et étoiles inventés, ancien forfait de 3 mois, avoir) ; aucun emoji ; chaque mention du réseau dit la vérité ; la vignette de partage existe, fait 1200×630 et est déclarée sur le bon domaine. |

Une suite sort en code 1 si elle échoue, donc `npm test` a sa place dans une CI. Le réflexe qui
les garde vivantes : changez un comportement, écrivez l'assertion **avant**, elle doit rougir
puis verdir.

## Vignette de partage (ce que voient WhatsApp et les autres)

Un lien partagé n'affiche **aucun visuel** si la page ne déclare pas d'`og:image`.
Trois règles, vérifiées par `npm run test:ui` :

- l'URL est **absolue** (`https://devis-designer-app.jerode.workers.dev/og-image.png`) et sur le même
  domaine que `og:url` ;
- le fichier est un **PNG raster** de **1200×630** (pas de SVG : les robots d'aperçu ne le
  lisent pas), sous 400 ko, et vit dans `public/` pour que Vite le recopie dans `dist/` ;
- les dimensions déclarées (`og:image:width` / `:height`) sont les dimensions **réelles** du
  fichier ;
- le bloc `og:` est dans les **1 500 premiers octets** du `<head>`. Un favicon en `data:` base64
  pèse 12 500 octets : placé avant les balises, il les enterre à l'octet 13 700 — et les robots
  d'aperçu, eux, ne lisent pas tout. Le favicon est donc déclaré **après** le bloc `og:` ;
- `public/robots.txt` existe. Sans lui, `/robots.txt` retombe sur le fallback SPA et le crawler
  reçoit le HTML de l'application avec un code 200 : il croit lire des règles, n'y comprend rien,
  et l'aperçu peut être refusé sans que personne ne voie d'erreur.

Pour la refaire (copie, prix, couleurs) :

```bash
pip install pillow                                # seule dépendance
python3 scripts/make-og-image.py                  # écrit public/og-image.png
python3 scripts/make-og-image.py --title "…" --sub "…" --chips "a|b|c" --url mondomaine.app
```

Le visuel est **dessiné par le script** (aucune capture d'écran) : le texte et la
mise en page de la vignette se règlent donc comme du code, et le faux document de droite
suit les proportions A4 réelles (794×1123). `index.html` porte les balises ; le script
accepte `--size`, `--logo`, `--note` (et `--note ""` pour retirer la ligne discrète),
`--title`, `--sub`, `--chips` (séparés par `|`) et `--stamp` — le tampon d'état du faux
document, `ACCEPTÉ` par défaut : il doit rester cohérent avec la ligne « Signature du client »
datée juste à côté, et `--stamp ""` le retire. Le pied de
la vignette s'adapte tout seul : la pastille d'adresse garde sa taille tant qu'elle tient dans la
colonne, la note se réduit, puis descend sous la pastille si la ligne est pleine — **l'adresse n'est
jamais tronquée**, c'est le seul truc que le visiteur doit retenir. Un sous-domaine de compte à
répéter (58 caractères) a été testé : la vignette reste lisible.

> **Après déploiement**, si WhatsApp affiche toujours l'ancien aperçu : il **met la vignette
> en cache**. Renvoyez le lien avec un paramètre différent (`https://devis-designer-app.jerode.workers.dev/?v=2`)
> pour le forcer à re-scroller la page, ou attendez quelques heures.

### Le visuel n'apparaît pas : les quatre causes, dans l'ordre où les vérifier

Un aperçu qui ne vient pas n'est presque jamais un problème de balises manquantes — c'est
une de ces quatre choses, et elles ne se soignent pas pareil :

1. **Ce n'est pas cette adresse qu'on partage.** Chaque hôte a **son propre** `<head>`, et donc ses
   propres balises d'aperçu : le miroir Netlify — l'adresse historique, option 2 plus bas — sert
   encore un bundle d'avant, sans `og:image`. Un lien qui part de là n'aura jamais de visuel,
   même quand le domaine public est parfait. Vérifier l'adresse **réellement collée** dans la
   conversation, pas celle du README. `VENDOR.DOWNLOAD_LINK` (`src/lib/config.ts`) est ce que l'app
   écrit dans ses propres messages de partage : c'est lui qui doit porter la bonne URL.
2. **Le crawler est bloqué, pas le navigateur.** WhatsApp et Facebook demandent la page avec un
   user-agent de robot (`WhatsApp/2.x`, `facebookexternalhit/1.1`). Une protection anti-bot
   Cloudflare (*Security → Bots → Bot Fight Mode*, ou le niveau « I'm under attack ») répond
   alors un défi HTML au robot, et le navigateur ne verra jamais la différence. Diagnostic
   exact, à faire **d'abord** parce qu'il affiche la réponse du robot de Facebook :
   <https://developers.facebook.com/tools/debug/> — le « Sharing Debugger » de Facebook, qui
   rejoue la requête du robot d'aperçu de WhatsApp et affiche l'erreur exacte s'il y en a une. En ligne de commande :
   ```bash
   curl -sS -A "WhatsApp/2.23.22.70" https://devis-designer-app.jerode.workers.dev/ | head -c 900
   curl -sSI https://devis-designer-app.jerode.workers.dev/og-image.png | head -5
   # PowerShell : Invoke-WebRequest -UserAgent "WhatsApp/2.23.22.70" <url> | Select -Expand Content
   ```
   La première commande doit rendre du HTML commençant par `og:locale`/`og:type`/`og:image` ;
   s'il rend une page « Just a moment… » ou un code 403/503, c'est le WAF : autoriser les deux
   user-agents ci-dessus plutôt que de laisser un captcha devant un robot.
   La seconde doit rendre `Content-Type: image/png` **et un `Content-Length` d'environ 78 000**.
   Si c'est `text/html` : le fichier n'est pas dans le dossier publié — le fallback SPA a servi
   l'application au lieu d'un 404, et le robot a renoncé silencieusement. C'est ce qui arrive
   quand on publie `dist/index.html` **seul** au lieu du dossier `dist/` entier.
3. **Le cache de l'aperçu.** WhatsApp garde la vignette (et l'absence de vignette) plusieurs
   jours. Après une correction, on ne teste pas avec le lien d'avant : on envoie
   `https://devis-designer-app.jerode.workers.dev/?v=2` — le paramètre force un scraping neuf.
   Le Debugger Facebook a un bouton « Scrape Again » pour la même raison.
4. **Le lien est noyé dans le message.** Une vignette n'apparaît que si l'URL porte le message.
   Un texte de trois lignes avant le lien, ou deux liens dans la même bulle, et WhatsApp
   n'affiche plus rien — ce n'est pas un bug, c'est la règle. Un message = une URL, et la
   légende part dans le message suivant.

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
│   ├── pulse_test.tsx  # La sonde du Pulse Chariow, état par état (59 assertions)
│   ├── workerbase_test.tsx # L'adresse du Worker, ses replis et les messages de panne (69 assertions)
│   ├── deploy_test.tsx # Ce qui casse à la mise en ligne, y compris les commandes, les pins et ce que voit le robot d'aperçu (76 assertions)
│   ├── payment_test.tsx # Le Worker rejoué sous Node : annulation, code unique, Pulse (45 assertions)
│   ├── services_test.tsx # Le carnet de prestations et les astérisques du paiement (65 assertions)
│   ├── emitter_test.tsx # Le carnet d'émetteurs, la numérotation et le callback (61 assertions)
│   ├── landing_test.tsx# Vérité des copies de la page d'accueil (80 assertions)
│   └── fixtures/       # Modèles de test (probe-a, probe-b, hooks) packés comme de vrais fichiers
└── src/                # (designs/*.dddesign.js : artefacts livrés aux clients, hors Git)
    ├── main.tsx        # Bootstrap React
    ├── App.tsx         # Composant racine
    ├── components/     # LandingPage (accueil public), Paywall (mur de paiement), Espace vendeur
    │                   # (VendorPage), CustomDesignCard (import du fichier), ServicesPicker
    │                   # (carnet de prestations), FAQ, Legal, Onboarding...
    ├── templates/      # Les 12 templates SVG + index.ts (registre, + les designs importés)
    ├── lib/            # route (accueil ↔ app), license (codes émis en local),
    │                   # quota (compteur serveur), referral (parrainage),
    │                   # designSecret (format .dddesign.js + HMAC),
    │                   # customDesign (les 6 emplacements du client),
    │                   # adminKey (clé ADMIN_PASS), config, store,
    │                   # workerBase (les adresses du Worker et leur sonde),
    │                   # pulse (l'état du webhook Chariow, lu depuis /debug)...
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
2. Épuisé → bouton **« PRO »** → l'offre → le client renseigne **nom, numéro Mobile Money et email**
   (les trois champs marqués `*` du mur de paiement — Chariow en a besoin pour la vente) → **« Payer …
   activation auto »** : le Worker crée la vente (`POST /checkout` → `api.chariow.com/v1/checkout`) et
   ouvre la caisse Chariow (Mobile Money : MTN MoMo, Orange Money, Wave, Moov — commission 15 %).
3. Pulse (webhook) confirme la vente → le Worker émet le code, l'app le relève (`/check`) et
   l'applique **toute seule**. Le client n'a **aucun code à recopier**. Et s'il annule la demande sur
   son téléphone, l'attente s'arrête là : `/check` lit `payment.status` et rend « paiement annulé »
   au lieu de laisser tourner un bandeau d'attente (voir « Le client annule le paiement sur son
   téléphone »).

**2. Le secours — virement Mobile Money direct + code saisi** (caisse injoignable, client
sans compte MoMo, paiement en espèces, Worker hors service) :

1. Le client vous paie `VENDOR.PHONE` (MTN/Orange/Wave/Moov ou espèces), il vous envoie la référence.
2. Vous générez le **code d'activation** dans `#/vendeur` (voir « Espace vendeur »).
3. Vous lui transmettez le code (1 clic WhatsApp). Il le saisit dans « Déjà abonné ? » → licence activée.

> Ce deuxième chemin **ne s'écrit pas sur la page d'accueil** : un visiteur qui y lit
> « payez au numéro du vendeur, on vous enverra un code » cherche votre numéro au lieu de
> payer — alors que la caisse active tout seule. La page ne décrit donc que Chariow ; le
> secours reste là où le client l'utilise vraiment, c'est-à-dire dans l'app
> (`PaywallModal`, message d'erreur du Worker + FAQ). `npm run test:ui` tient la ligne :
> « la page ne détaille plus le paiement direct au vendeur ».

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
   - **Automations → Pulses** : créez un Pulse vers l'URL `/webhook` **du Worker d'API**
     (pas de l'application !) — aujourd'hui
     `https://devisdesigner.gnansounoujerode3.workers.dev/webhook`, événements de vente.
     Ne la recopiez d'aucun fichier : demandez-la au Worker, qui connaît sa propre adresse —
     `GET https://…workers.dev/debug` → champ `webhookUrl` (et `pulse.url`). C'est aussi ce
     qu'affiche la carte **Pulse Chariow** de l'espace `#/vendeur`, bouton « Copier l'URL ».
     Puis copiez son **secret de signature** (`whsec_...`).

2. **Worker** : enregistrez `CHARIOW_KEY`, `CHARIOW_PULSE_SECRET` (le `whsec_...` **brut** : le
   Worker tolère un espace ou un guillemet de collage, mais ne compte pas dessus), `PRODUCT_IDS`
   (JSON `{ MONTHLY, ANNUAL, DESIGN, ALL }`), puis redéployez.

3. **Vérifier le branchement** — espace `#/vendeur`, carte **Pulse Chariow** : voyant vert
   « Pulse vivant », sinon le texte dit quoi faire. Les trois pannes réellement possibles sont
   distinctes et libellées séparément : `Aucun Pulse n'est jamais arrivé` (le Pulse n'existe pas
   ou ne pointe pas ici), `Le Pulse arrive, mais sa signature est refusée` (secret différent des
   deux côtés), `Silence depuis X min avec N paiement(s) en attente` (l'URL a bougé sous vos pieds).
   Équivalent en ligne de commande : `/debug` → `webhookCount`, `lastWebhook.action`,
   `pulse.pending`, `pulse.minutesSinceLast`.
   La carte compare aussi les 4 derniers caractères du secret lu par le Worker (`pulseSecret.suffix`)
   à ceux du secret qui a réellement vérifié la dernière délivrance (`lastWebhook.secretSuffix`).
   Différents = vous avez tourné `CHARIOW_PULSE_SECRET` d'un seul côté : la prochaine vente payée
   sera refusée pour signature invalide, l'argent rentrera, personne ne sera activé. C'est le genre
   de panne qui ne laisse **aucune** trace à l'écran du client — d'où la comparaison.

4. **Après un déménagement du Worker** (nouveau nom de Worker, sous-domaine de compte renommé,
   passage sur un domaine à vous) : **le Pulse ne suit pas tout seul.** Chariow continue de rappeler
   l'ancienne URL, qui ne répond plus — et rien ne sonne chez vous. Le contrat n'est pas rompu pour
   autant : à chaque relevé, le Worker re-vérifie la vente **auprès de Chariow** (1 appel API maximum
   toutes les 15 s) et marque la vente payée. Mais ce filet ne joue que tant que le client garde la
   fenêtre de paiement ouverte — la vente `pending` expire au bout de 15 minutes. Donc : coller la
   nouvelle `webhookUrl` dans le Pulse Chariow **le jour même**, et vérifier le voyant.

### Si un paiement échoue sous les yeux du client

Le client, lui, ne voit jamais le Worker : il est déjà devant le guichet Mobile Money. Ce qu'il lit
dans la fenêtre de paiement, et ce que vous faites :

| Ce qui est écrit | Ce que ça veut dire | Ce que vous faites |
| --- | --- | --- |
| « Le serveur de paiement est injoignable depuis votre réseau » | aucune des adresses déclarées n'a répondu : Worker non déployé, sous-domaine renommé, ou connexion du client en rade | le client paie au numéro du vendeur et vous générez le code vous-même ; puis vous vérifiez `GET <url>/debug` de chez vous |
| « La réponse du serveur de paiement est illisible » | l'adresse répond, mais pas en JSON — page d'erreur, domaine expiré, proxy qui sert autre chose | l'URL est mauvaise ou sert un autre site : corrigez `AUTO_PAY_WORKER_URL` |
| carte Pulse « Aucun Pulse n'est jamais arrivé » alors que le client a payé | l'argent est entré chez Chariow, l'automation n'a pas suivi | voyez « Reprendre la main » ci-dessus ; si le client garde la fenêtre ouverte, `/check` finit par émettre le code |

**Un client a payé mais n'est pas activé ?** Pas besoin de le rembourser ni de lui fabriquer un
code à la main : la fenêtre de paiement relit la vente **à chaque réouverture**, quel que soit son
âge (`GET /check` → le Worker relit la vente chez Chariow, et lui rend le code une seule fois).
Dites-lui simplement de rouvrir l'application et d'accepter le mur de paiement qui s'affiche. Si la
vente a plus de 15 minutes et que Chariow l'a déjà marquée abandonnée, là oui : générez le code dans
`#/vendeur` et envoyez-le.

Aucun de ces messages n'est l'anglais technique de l'exception d'origine : une `fetch` qui échoue
produit un `TypeError: Failed to fetch` **inintelligible**, et c'est exactement ce que voyait le
client. `explainWorkerFailure()` (`src/lib/workerBase.ts`) traduit le symptôme en cause — réseau,
adresse changée, réponse illisible — et la caisse bascule sur l'autre adresse déclarée.

**Pourquoi l'app teste plusieurs adresses** (`src/lib/workerBase.ts`) : `AUTO_PAY_WORKER_URL` est
gravée dans le fichier que chaque client a déjà téléchargé, alors qu'un renommage de sous-domaine
Cloudflare est immédiat et silencieux. L'app sonde donc ses adresses une fois au démarrage
(`GET /debug`, aucun envoi d'identité, résultat gardé 6 h dans `dd_worker_base`), retient celle qui
répond, et bascule sur l'adresse de **repli** (`AUTO_PAY_WORKER_FALLBACKS`) si l'actuelle meurt — y
compris au milieu d'un paiement. Une panne de nom de domaine ne doit pas devenir une panne de caisse.
Quand l'adresse principale est la bonne depuis plusieurs semaines, supprimez le repli : deux adresses
qui tournent, c'est deux adresses à surveiller.

### Le client annule le paiement sur son téléphone

Symptôme qui a été remonté : le client refuse la demande Mobile Money (ou sort du PIN), et
l'application reste bloquée sur « EN ATTENTE DE CONFIRMATION DU PAIEMENT » pendant de longues
minutes. Ce n'était pas un caprice de l'interface : **Chariow ne prévient personne**. Son Pulse
n'envoie que trois événements de vente — `successful.sale`, `abandoned.sale`, `failed.sale` — et
l'abandon n'est poussé que plusieurs minutes après. Pendant ce temps, la vente reste
`awaiting_payment`.

Le seul signal immédiat est ailleurs : `data.payment.status` passe à **`cancelled`** sur-le-champ
(les valeurs possibles côté paiement sont `initiated`, `pending`, `cancelled`, `failed`, `success` ;
côté vente : `awaiting_payment`, `completed`, `failed`, `abandoned`, `settled`). Le Worker juge donc
les **deux** champs d'un seul coup (`saleOutcome()`, dans `backend/worker.js`) :

| Ce que dit Chariow | Ce que fait le Worker | Ce que voit le client |
| --- | --- | --- |
| vente `awaiting_payment`, paiement `cancelled` | vente verrouillée en terminal, réponse `status: "cancelled"` | « PAIEMENT ANNULÉ — aucun montant n'a été débité », bouton **RECOMMENCER LE PAIEMENT** |
| vente `awaiting_payment`, paiement `pending`/`initiated` | on attend (c'est l'état normal d'un PIN en cours de validation) | « en cours de validation chez votre opérateur », sans faux message d'échec |
| vente `failed` / `abandoned`, ou paiement `failed` | vente verrouillée, réponse `status: "failed"` avec la cause | échec nommé (solde, PIN, délai) + numéro du vendeur en secours |
| vente `completed`/`settled` ou paiement `success` | code émis **une seule fois**, journalisé | offre activée |

Trois choses accompagnent cette détection, parce que le seul diagnostic du serveur ne suffit pas :

- le client peut **l'annoncer lui-même** : bouton « J'AI ANNULÉ LE PAIEMENT » pendant l'attente, qui
  arrête la vérification et vide la référence de vente (`dd_last_purchase`) ;
- le **retour sur l'onglet** (le client sort de la page Chariow) relit le statut immédiatement, au
  lieu d'attendre le prochain cycle de 5 secondes ;
- une vente annulée ne **ressuscite pas** : la vérification suivante, celle du réveil de l'onglet
  comme celle de la réouverture de la fenêtre, répond « annulé » et non « en cours ».

Le garde-fou des 15 minutes (`pending` trop ancien → `expired`) reste en place pour les connexions
coupées en plein milieu : il n'est plus la seule sortie possible. Et une vente annoncée annulée
n'est pas enterrée : tant que son code n'a pas été livré, le Worker la relit une fois par minute, et
si le client est finalement repassé sur la page Chariow payer, la vente redevient `paid` et le code
sort — c'est le `payment.status` qui décide, jamais le souvenir de l'application. Tout ceci est joué par
`tests/payment_test.tsx`, qui **importe le Worker** et rejoue `/check`, `/webhook` (vraie signature
HMAC et fausse signature) et `/debug` contre un faux Chariow — l'annulation, l'absence de faux
positif en cours de validation, l'unicité du code et l'anti-rejeu du Pulse sont des assertions, pas
des intentions.

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
3. **L'application** : dans `src/lib/config.ts`, `AUTO_PAY_WORKER_URL` = l'adresse de **votre**
   Worker (`https://<nom>.<sous-domaine-du-compte>.workers.dev`), et éventuellement
   `AUTO_PAY_WORKER_FALLBACKS` = les adresses d'avant, gardées en secours. Ce dépôt contient déjà
   l'adresse du Worker déployé : lisez-la dans `src/lib/config.ts` au lieu de la reconstituer, et ne
   la recopiez nulle part d'après mémoire — `GET <worker>/debug` → `webhookUrl` est la source sûre.
   L'app ne fige pas l'URL dans le marbre : elle sonde la liste au démarrage et suit celle qui
   répond (voir « Si un paiement échoue sous les yeux du client »).

Sécurité : la clé API Chariow ne vit que dans le Worker (jamais dans l'app),
le webhook est vérifié par signature HMAC, chaque vente est reliée à
l'installation (code parrain) et le code d'activation n'est délivré qu'une seule fois.

Si `AUTO_PAY_WORKER_URL` est vide : le flux manuel actuel reste actif
(lien Chariow / Mobile Money + code depuis l'espace vendeur).

## 🔐 Espace vendeur (page propriétaire)

Page **réservée au vendeur** (vous), **invisible des utilisateurs** : aucune
liaison dans l'application, accès uniquement via l'URL :

```
https://devis-designer-app.jerode.workers.dev/#/vendeur
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
   - **Carte PULSE CHARIOW** : l'URL exacte que Chariow doit rappeler (lue sur le Worker, jamais
     recopiée du dépôt), le nombre de délivrances, l'âge de la dernière, les paiements encore en
     attente, l'état du secret de signature — et un voyant qui nomme la panne : « aucun Pulse
     n'est jamais arrivé », « le Pulse arrive mais sa signature est refusée », « silence depuis X min
     avec N paiement(s) en attente ». À regarder le jour où le Worker change d'adresse : c'est le
     seul maillon de la caisse que ce dépôt ne peut pas corriger tout seul
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

### Option 1 — Vercel (gratuit) — l'adresse historique, à ne pas supprimer pendant la transition
```bash
npm run deploy:vercel
```
Ou via le tableau de bord vercel.com : importez le dépôt, framework = **Vite**, build = `npm run build`,
output = `dist` — c'est exactement ce que déclare déjà `vercel.json` à la racine (avec une `rewrite` vers
`/index.html`, utile seulement si un jour vous quittez le routage en hash).

C'est **le mauvais bouton pour publier aujourd'hui** : le domaine que les liens de parrainage, les CGU et la
FAQ citent est l'option 5 (un Worker d'assets Cloudflare). Le piège était dans `package.json` — le script
nu `deploy` y pointait, si bien que la commande évidente publiait chez Vercel. Depuis 1.3.7, `deploy` et
`deploy:cf` font la même chose (l'option 5) et Vercel s'appelle `deploy:vercel`. Vercel reste utile comme
**miroir** : une URL qui ne bouge jamais sous la main, et un repli si Cloudflare tombe.

### Option 2 — Netlify (gratuit) — l'adresse historique, à ne pas supprimer pendant la transition
Le dépôt ne contient **que les sources** (`dist/` n'est pas versionné) : il faut donc
publier le build à chaque changement.

**Méthode A — en local (≈ 1 minute)**
```bash
npm install
npm run build                              # -> dist/index.html (fichier unique, ~1,4 Mo)
npx netlify-cli deploy --prod --dir=dist    # 1re fois : demande une connexion Netlify
```
Si le CLI demande sur quel site pousser : `npx netlify-cli link` → choisissez le site
Netlify historique. **Redéployez-le après chaque changement de `VENDOR.DOWNLOAD_LINK`** : tant que
l'ancienne adresse est en ligne, elle doit afficher le même message de transition que la nouvelle.

**Méthode B — à la main** : glissez-déposez le **dossier `dist/`** sur
<https://app.netlify.com/drop>. Sur un site déjà connecté à Git, laissez Netlify builder
(build command `npm run build`, publish directory `dist`).

**Vérifier que c'est bien la nouvelle version qui tourne** — deux sondes, une par service :

| Quoi | Où lire | Valeur attendue aujourd'hui |
|---|---|---|
| Le front (Netlify, puis Cloudflare) | pied de page `Devis Designer · Version X.Y.Z`, et `BUILD_TAG` dans l'en-tête de `#/vendeur` | `Version 1.3.8` |
| Le backend (Worker) | <https://devisdesigner.gnansounoujerode3.workers.dev/debug> → champ `version` | `2026-09-08 (quota + parrainage + DESIGN + sonde Pulse + annulation détectée dans /check)` |
| Le Pulse (Chariow → Worker) | même `/debug` → `webhookUrl`, `pulse.count`, `pulse.pending`, ou la carte `#/vendeur` | `webhookUrl` = l’adresse du Worker + `/webhook`, et `pulse.count > 0` |

**Incrémentez `APP_VERSION` à chaque publication** (et la `version` de
`backend/worker.js` quand vous changez le Worker) : après déploiement, rechargez en dur
(Ctrl+Maj+R) et lisez le numéro — s'il n'a pas bougé, c'est l'ancien bundle (cache
browser/Netlify, ou mauvais dossier envoyé). `npm test` est là aussi : 522 assertions
vertes avant de pousser, dont les textes de la page d'accueil, des CGU, du `index.html` et la
cohérence de l'hébergement (domaine public unique, `wrangler.jsonc`).

### Option 3 — Hébergement classique (OVH, Hostinger, etc.)
- Téléversez `dist/index.html` (et le dossier `dist/` entier) sur votre espace web
- L'application est un fichier unique : pas de serveur, pas de configuration

### Option 4 — GitHub Pages
```bash
npm run build
npx gh-pages -d dist
```

### Option 5 — Cloudflare Workers (assets statiques) — le choix cohérent ici

Votre API (quota, caisse Chariow, parrainage, espace vendeur) **vit déjà chez Cloudflare** : y
loger aussi le front supprime un fournisseur, et le CORS n'a jamais été un sujet (`cors()` du Worker
répond `Access-Control-Allow-Origin: *`, donc n'importe quelle origine peut l'appeler). En 2026,
Pages reste utilisable mais n'évolue plus — tout est investi dans Workers, qui sait désormais
servir des fichiers statiques **sans une ligne de code**. `wrangler.jsonc`, à la racine du dépôt,
fait exactement cela : `"assets": { "directory": "./dist", "not_found_handling":
"single-page-application" }`. Une requête servie par un fichier n'invoque aucun script, donc elle
n'est pas comptée ; le plan gratuit du Worker d'API (100 000 invocations/jour) reste dimensionné
pour votre quota de 20 exports par appareil.

**Publier (≈ 2 minutes, la première fois 5)**
```bash
npm install
npx wrangler login          # ouvre le navigateur ; compte Cloudflare gratuit, sans carte
npm run build               # -> dist/index.html (fichier unique, ~1,4 Mo) + og-image.png
npx wrangler deploy         # -> https://devis-designer-app.jerode.workers.dev
```
Les trois scripts de publication, pour qu'il n'y ait pas de surprise sur celui que le nom promet :

| Commande | Ce qu'elle fait |
|---|---|
| `npm run deploy` | `vite build` puis `npx wrangler deploy` — **le domaine public** (c'est celle qu'on doit taper) |
| `npm run deploy:cf` | strictement la même chose, gardée parce qu'elle est citée dans `wrangler.jsonc` et dans les tests |
| `npm run deploy:vercel` | `vite build` puis `npx vercel --prod` — l'adresse historique (option 1) |

Sur une machine sans navigateur (session distante), remplacez `wrangler login` par un jeton : tableau de
bord → *My Profile → API tokens → Create*, modèle **Edit Cloudflare Workers**. Sous bash :
`export CLOUDFLARE_API_TOKEN=…` ; sous **PowerShell** : `$env:CLOUDFLARE_API_TOKEN = "cfc7…"` (valable
pour la session courante — les variables d'environnement du registre sont lues par `wrangler` sans
réouverture de fenêtre s'il n'y a que `PATH` de changé, sinon relancez PowerShell).
Avec un seul compte, `wrangler` trouve l'identifiant tout seul ; sinon `npx wrangler whoami`
l'affiche.

**Ce que ce choix implique**
1. Rien d'autre à configurer côté Cloudflare : pas de `_redirects`, pas de Functions. Le routage de
   l'app est en **hash** (`#/app`, `#/vendeur`) ; le `not_found_handling` n'est qu'un filet.
2. L'URL publique change, donc **elle doit être corrigée dans le dépôt** (et `npm test` le vérifie) :
   `src/lib/config.ts` (`VENDOR.DOWNLOAD_LINK` : liens de parrainage, FAQ, CGU), `index.html`
   (`og:url`, `og:image`, `twitter:image`, `canonical`, `url` du JSON-LD),
   `scripts/make-og-image.py --url=<nouvel hôte>` **puis régénérer la vignette**
   (`python3 scripts/make-og-image.py`, sinon l'aperçu WhatsApp pointe l'ancienne adresse),
   `src/components/VendorPage.tsx` (le commentaire d'accès), `tests/shim.js`, `README.md`.
3. Aucune retouche du Worker d'API, sauf si vous changez son nom : `AUTO_PAY_WORKER_URL` dans
   `src/lib/config.ts` suffit (gardez l'ancienne adresse dans `AUTO_PAY_WORKER_FALLBACKS` pendant
   quelques semaines : les installations déjà téléchargées continuent de l'appeler en secours), et
   l'adresse de retour de paiement est calculée sur `window.location.origin`. Vérifiez en revanche
   dans l'espace Chariow qu'aucune URL de retour n'y est enregistrée en dur avec l'ancien domaine.
4. **Le point qui fâche : les données de vos utilisateurs.** Devis, clients, fiches émetteurs et
   signatures vivent dans le `localStorage` de **l'origine exacte**. Publier sous une nouvelle URL,
   c'est leur offrir un poste vide. Laissez donc l'ancienne adresse en ligne (ne pas supprimer le
   site Netlify) et annoncez le geste : « Exporter une copie » sur l'ancienne adresse, puis
   « Restaurer une copie » sur la nouvelle. Deux garde-fous jouent en votre faveur : le compteur
   d'exports ne se remet **pas** à zéro (il est tenu par l'empreinte de l'appareil, clé `qfp:` du
   Worker, et le serveur retient le maximum des compteurs), et le `BUILD_TAG` lu dans `#/vendeur`
   permet de vérifier qui sert quelle version. Ce qui repart à zéro, en revanche : le code de
   parrainage `DDREF-…` (localStorage lui aussi) et donc le compteur `refmonths:` associé —
   surveillez les clés `refdev:` pendant la transition.
5. Un domaine à vous (recommandé pour la clientèle) : *Workers & Pages → votre Worker → Custom
   domains → Add*, et Cloudflare signe le HTTPS tout seul. Le nom `*.workers.dev` reste atteignable.
   Testez-le d'abord depuis un réseau mobile local (MTN puis Orange) : les sous-domaines partagés
   sont parfois filtrés selon les opérateurs — un domaine à vous règle la question.

#### Le milieu de l'URL n'est pas un réglage de l'app : c'est votre sous-domaine de compte

`devis-designer-app.jerode.workers.dev` se lit ainsi : `<nom du Worker>.<sous-domaine du compte
Cloudflare>.workers.dev`. Le premier morceau vient de `wrangler.jsonc` (`"name"`), le second est
**unique à votre compte** et se change dans *Workers & Pages → Settings → Subdomains*
(**Sites & Workers subdomain**). Deux conséquences à ne pas rater :

1. **Le renommage déplace aussi l'API.** Votre Worker de quota s'appelle `devisdesigner`, il vit sur
   le même sous-domaine : le jour où vous passez de `gnansounoujerode3` à `jerode`, son adresse
   change en même temps. Il faut donc, **le jour même**, corriger `AUTO_PAY_WORKER_URL` (en gardant
   l'ancienne dans `AUTO_PAY_WORKER_FALLBACKS`), redéployer le front, et corriger l'URL du Pulse chez
   Chariow — l'app sait se rattraper sur une adresse de secours, Chariow non. Sinon plus personne ne
   peut payer ni vérifier son quota :
   ```bash
   ANCIEN=gnansounoujerode3        # le sous-domaine de compte d'avant
   NOUVEAU=jerode                 # celui que vous venez de choisir
   OLD=devisdesigner.$ANCIEN.workers.dev
   NEW=devisdesigner.$NOUVEAU.workers.dev
   sed -i "s|$OLD|$NEW|g" src/lib/config.ts README.md      # bash
   # PowerShell, sans regex (les points de l'URL ne mangent pas le motif) :
   foreach ($f in 'src/lib/config.ts','README.md') { (Get-Content $f -Raw).Replace($OLD,$NEW) | Set-Content $f -NoNewline -Encoding utf8 }
   npm test && npm run deploy
   # et redéployez le Worker d'API comme d'habitude : bouton *Deploy* dans l'éditeur
   # du Worker, ou `npx wrangler deploy` depuis le dossier qui contient son wrangler.toml
   ```
   (Adaptez la dernière ligne à la façon dont vous déployez le Worker d'API ; le KV suit le Worker,
   pas l'URL : aucun compteur n'est perdu.) Pensez aussi à l'URL du **webhook Chariow**, enregistrée
   dans votre espace marchand sur l'ancienne adresse — c'est le seul élément que ce dépôt ne peut pas
   corriger pour vous.
2. **Un sous-domaine, ça ne se préserve pas.** Une fois renommé, l'ancienne adresse ne répond plus :
   ni redirection, ni cohabitation. Tous les liens déjà partagés (parrainages envoyés par WhatsApp,
   captures d'écran, liens dans une conversation) deviennent morts. Le renommage se fait donc à un
   moment calme — ou, mieux, il devient inutile : une fois un **domaine à vous** branché sur le
   Worker, plus rien ne dépend du sous-domaine de compte.

Le nom doit aussi être **libre chez Cloudflare** (il est unique mondialement) : si le tableau de
bord refuse `jerode`, prenez-en un autre (`jerode-app`, `devisdesigner`, …) et refaites le
remplace-partout ci-dessus dans les six fichiers qui portent l'adresse du front (`index.html`,
`src/lib/config.ts`, `src/components/VendorPage.tsx`, `tests/shim.js`, `tests/landing_test.tsx`,
`scripts/make-og-image.py`) puis régénérez la vignette (`python3 scripts/make-og-image.py`).
`npm test` rougit si un seul de ces fichiers reste sur l'adresse d'avant : c'est voulu.

**Variante Pages (build Git automatique)** — *Workers & Pages → Create → Pages → Connect to Git* :
build command `npm run build`, build output directory `dist`, variable d'environnement
`NODE_VERSION=22`. Sans Git : `npx wrangler pages deploy dist --project-name=devisdesigner`.

**Contrôles** — `npx wrangler deployments list` (historique), `npx wrangler rollback` (rendre la
deployment précédente), `npx wrangler tail` (journaux du Worker d'API, si un jour vous mettez le
front et l'API dans le même Worker).

**Publier à chaque push (optionnel)** — `.github/workflows/deploy.yml` :
```yaml
name: Déployer sur Cloudflare
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm test && npm run build
      - uses: cloudflare/wrangler-action@v3
        with: { apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }} }
```
`npm test` avant `npm run build` : une suite rouge empêche la mise en ligne, et le job n'a aucun
secret en dur — le jeton vit dans les *secrets* du dépôt sous `CLOUDFLARE_API_TOKEN`.

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
(aujourd'hui `https://devis-designer-app.jerode.workers.dev/`) :

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
