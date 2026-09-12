# Prospecter à 0 F — le plan, pas à pas

Ce document répond à une situation précise : **budget publicitaire nul**, un ordinateur, un
téléphone, une connexion internet. Ni régie payante, ni imprimeur de flyers, ni équipe.

La logique entière tient en une phrase : **sans argent, on n'achète pas de l'attention, on en
échange.** Ce qu'on échange, ici, c'est du travail fait pour le prospect avant toute demande —
son propre document, à son nom, en PDF, dans les dix minutes. C'est le seul levier gratuit qui
transforme un inconnu en client, parce que le prospect ne juge pas une promesse : il juge un
fichier qu'il a déjà sous les yeux.

Ordre des étapes : **0** (une fois), **1** (jour 1-2), **2** (tous les jours), **3** (les textes),
**4** (les 4 canaux gratuits), **5** (l'argent), **6** (30 jours), **7** (les chiffres),
**8** (les interdits). Les chiffres de rendement sont des **ordres de grandeur**, pas des mesures :
à remplacer dès la première semaine par les vôtres.

---

## Étape 0 — avant le premier message (une fois, 2 à 3 h)

Prospecter avec une caisse qui ne marche pas est le seul moyen sûr de perdre un client qu'on a
déjà conquis. Dans l'ordre :

1. **Publier l'app et figer une adresse.** `npm install && npm test && npx tsc --noEmit && npm run
   build && npm run deploy` (Cloudflare : session `wrangler login` ou variable `CLOUDFLARE_API_TOKEN`).
   Vérifier ensuite que `VENDOR.DOWNLOAD_LINK` dans `src/lib/config.ts` pointe **exactement** sur
   l'adresse en ligne : c'est elle qui part dans les partages WhatsApp et dans les liens de
   parrainage (`?ref=`).
2. **Tester le parcours complet sur un téléphone, avec la data mobile** (pas le wifi) : ouvrir le
   lien → créer un devis → exporter le PDF → le PDF arrive dans la conversation WhatsApp.
3. **Tester l'argent, vraiment.** Acheter une fois 2 000 F via Chariow, recevoir le code, le coller
   dans « Déjà abonné ? », vérifier que le compteur se débloque. Un lien de paiement qui échoue
   silencieusement est une vente perdue + une réputation perdue.
4. **Trois actifs gratuits, 15 minutes chacun :** WhatsApp Business (nom, photo, description en une
   ligne, horaires), page Facebook « Devis Designer », compte Instagram professionnel avec le **même**
   visuel. Bio sur les trois : la phrase d'accroche + le lien.
5. **La vidéo-maître, une seule, 90 secondes.** Poser le téléphone sur un appui et filmer l'écran du
   PC (format vertical). Rien d'autre : taper 3 lignes → le PDF s'affiche → le client signe → le PDF
   part dans WhatsApp. Ce fichier servira partout (statut, groupes, TikTok, Reels, réponses aux
   commentaires). Refaire un visuel par canal est le piège classique qui fait perdre la semaine.
6. **Le dossier de preuve :** trois PDF d'exemple déjà prêts (un devis, une facture, une proforma),
   sur trois métiers différents, noms faux. Dans une conversation WhatsApp, envoyer un fichier vaut
   mieux que dix lignes d'explication.

**Aucun message commercial ne part avant que les points 1, 2 et 3 soient verts.**

---

## Étape 1 — se fabriquer 200 cibles nommées (jour 1 et 2, ~2 h)

Le filtre vient de MARCHE.md : le mur de paiement ne se lève qu'au-delà de **20 documents par mois**,
soit environ 5 par semaine. Tout le reste est une perte de temps. On ne cherche donc pas « des gens
qui ont besoin d'un logiciel » — on cherche **des gens qui sortent 5 documents par semaine** et qui
les tapent encore à la main ou au carnet.

La plus grosse base de données gratuite et légale au Bénin, c'est **Google Maps** (noms, numéros,
adresses, photos). Recherche → on note dans le tableau. Exemples de recherches, à répéter sur chaque
ville :

| Ce qu'on tape dans Maps / dans la recherche des groupes | Pourquoi |
| --- | --- |
| `école privée Cotonou`, `crèche Cotonou`, `appui scolaire` | 200-1 500 documents à la rentrée, décisionnaire joignable au standard |
| `imprimerie Cotonou`, `reprographie`, `graphisme Abomey-Calavi` | client **et** canal de revente |
| `photographe mariage Cotonou`, `vidéaste événement` | devis + proforma + acompte, gros volumes de saison |
| `salle de sport`, `arts martiaux`, `école de danse` | cotisations récurrentes, un seul interlocuteur |
| `garage`, `pièces détachées`, `lavage auto` | bons de travail et factures multiples par jour |
| `menuiserie`, `carrelage`, `soudure`, `toiture` | devis chiffrés longs, le gain de temps se voit |
| `déménagement Cotonou`, `logistique`, `location engins` | 30-150 documents |
| `institut de beauté`, `maquis prestation`, `hôtel` | notes, devis de fête, prestations |
| `perruque`, `cosmétique`, `chaussures`, `téléphones` + `vente en ligne` (Facebook/Instagram) | 100-1 000 bons de commande, le Mobile Money est déjà leur caisse |
| `coopérative agricole`, `intrants`, `pisciculture`, `ferme` | bon de commande, livraisons, suivis |

Sur Instagram et Facebook, la recherche par mot-dièse (`#cotonou`, `#benin`, `#cotonoubusiness`,
`#madeinbenin`) et les **groupes** (`imprimerie & graphisme Cotonou`, `photographes du Bénin`,
`entrepreneurs béninois`, `import-export Bénin`, `business Cotonou`, `écoles privées du Bénin`)
doncent les mêmes gens, avec un avantage : ils publient déjà leurs commandes, donc on peut
personnaliser. Ne pas noter « un groupe » : **noter une personne, un numéro, un détail**.

Le tableau (à recopier dans Google Sheets ou un tableur — gratuit, synchronisé entre PC et
téléphone, consultable pendant qu'on parle au client) :

```
nom | metier | ou_trouve | whatsapp | docs_par_semaine | statut | prochaine_action | note_personnalisee
```

`statut` ne prend que cinq valeurs : `A_CONTACTER` → `CONTACTE` → `REPONSE` → `DEMO_FAITE` →
`PAYANT` (ou `REFUS`, avec la raison écrite). Un refus sans raison écrite est un rendez-vous manqué
avec la vérité du marché.

---

## Étape 2 — le rituel quotidien (1 h 30, six jours sur sept)

C'est la seule partie qui produit de l'argent. Le reste est accessoire.

| Bloc | Durée | Ce qu'on fait |
| --- | --- | --- |
| 1 | 45 min | **15 messages personnels**, tous les détails vérifiés (le « détail » de la ligne 1 du script). 15, pas 60 : au-delà, WhatsApp restreint le compte et le texte devient du bruit. |
| 2 | 10 min | **3 relances** (J+1 chez les « REPONSE », J+4 chez les « DEMO_FAITE » silencieuses). |
| 3 | 10 min | **1 post dans 1 seul groupe** (rotation des groupes, un passage par groupe par semaine), avec **l'image** du document, pas le lien. |
| 4 | 5 min | **1 story WhatsApp** (extrait de la vidéo-maître ou un PDF flouté). |
| 5 | 10 min | **Répondre à tous les commentaires** publiquement, puis ouvrir la conversation en privé. |
| 6 | 5 min | **Remplir le tableau.** Non négociable : sans lui, dans trois semaines on ne saura pas ce qui n'a pas marché. |

Un document à envoyer au prospect, quand il le demande, se produit en 5 minutes (on tape son nom,
deux lignes, on exporte, on envoie). **La fenêtre d'achat est ouverte les 20 minutes qui suivent
l'envoi du PDF** : à ce moment-là on propose l'abonnement, pas le lendemain.

Rendement attendu, à vérifier chez vous : 15 contacts/jour = 105/semaine ; à 15-25 % de réponse
= 15-25 conversations ; à 40 % de démos acceptées = 6-10 documents envoyés ; à 25-40 % de
conversion après démo = **2-4 abonnés par semaine**, plus les designs. À 2 000 F par mois, 10
abonnés nouveaux par mois = 20 000 F brut ; à 15 000 F par an, c'est 150 000 F brut. Ce n'est pas
une promesse, c'est une arithmétique : les taux sont la seule chose à mesurer.

---

## Étape 3 — les textes, prêts à copier

Tout est court, tout finit par **une seule question**, aucune ligne ne promet ce que l'app ne fait
pas. Adapte le ton (tutoiement/vouvoiement) selon le milieu, garde la structure.

**1. Premier contact** (WhatsApp ou message privé — 4 lignes, pas plus) :

```
Bonjour, je viens de voir [détail réel chez lui : « votre publication sur les devis de la rentrée » / « le chantier que vous avez posté »].
Je fais des devis et factures en PDF, au nom de l'entreprise, avec la signature du client sur son téléphone. Ça marche dans le navigateur, rien à installer.
Une question : par semaine, vous sortez à peu près combien de devis ou de factures ?
```

La question est le filtre. En dessous de 5 par semaine : remercier, et poser la question
d'entretien (bloc 7) — ce ne sera pas un client, ce sera une information.

**2. La démo dans la minute** (dès que la réponse est au-dessus du seuil) :

```
Parfait. Donnez-moi trois choses :
- le nom de votre entreprise (et votre numéro IFU si vous en avez un),
- votre logo — à défaut, une photo de votre devanture ou de votre carnet,
- la ligne que vous facturez le plus souvent.
Je vous renvoie le devis en PDF, à votre nom, gratuit, dans les 10 minutes.
```

Faire le document **maintenant**, pendant la conversation. C'est ce qui convertit : le prospect ne
se projette pas, il reçoit.

**3. L'envoi du PDF + la phrase qui vend** (dans le même message que le fichier) :

```
Voilà votre devis, en PDF, prêt à partir à votre client.
L'application est gratuite jusqu'à 20 documents par mois, sans compte à créer. Au-delà : 2 000 F par mois, ou 15 000 F par an. Et si vous voulez le document à votre image, je fais le design moi-même : 5 000 F, livré en 48 h.
Ouvrir : [lien]
```

**4. Les relances** — une ligne, jamais de reproche :

```
J+1 : Vous avez pu ouvrir le PDF sur votre téléphone ?
J+4 : Je ferme le dossier, pas la porte. Le jour où un devis vous ennuie, le lien est là.
J+20 : (une preuve — capture d'un client de son métier, sans nom) Il a fait 14 devis la semaine dernière en 40 secondes chacun.
```

**5. Les objections, et la réponse exacte**

| Il dit | On répond |
| --- | --- |
| « J'ai mon carnet, ça marche bien. » | Le carnet reste, il fait très bien la caisse. L'app sert le jour où le client veut un PDF propre ou une signature. Faisons un seul document sur votre prochain client compliqué, et vous comparez. |
| « C'est cher / je n'ai pas. » | Vous n'avez rien à payer aujourd'hui : 20 documents sont offerts. Utilisez-les sur un mois, et décidez avec votre nombre réel. Si vous sortez 8 documents par mois, l'abonnement ne vous sert à rien — je vous le dis maintenant. |
| « Je vais réfléchir. » | Réfléchissez avec un document : dites-moi votre client en cours, je vous le fais, c'est gratuit. |
| « Mon client exige une facture normalisée. » | C'est e-MECeF, aux impôts, et l'application ne le remplace pas. Elle fait tout ce que vous tapez avant et après : devis, proforma, bon de commande, acompte, relance. C'est là que vous passez votre soirée. |
| « Ça marche sans internet ? » | Ça s'ouvre dans le navigateur du téléphone, rien à installer. Pour générer le PDF, il faut être connecté — sinon on garde la capture d'écran du document. |
| « Mes données partent où ? » | Vos brouillons, vos listes de prestations et vos documents restent dans le navigateur de l'appareil. Le serveur ne voit que le compteur d'exports. Et vous pouvez exporter une copie et la restaurer sur un autre appareil. |
| « Je peux essayer 3 mois gratuits ? » | Il y a 20 documents offerts, ce qui fait un mois normal dans la plupart des métiers. Au-delà, ce serait offrir le produit à quelqu'un qui a déjà dit oui. |

**6. Clôture** (à dire dans les 20 minutes qui suivent le PDF, une fois) :

```
Si ça vous fait gagner du temps, l'abonnement se paie ici (MTN MoMo, Orange Money, Wave, Moov) : [lien Chariow de l'offre]. Dès que le paiement est confirmé, l'accès s'active seul — pas de prélèvement automatique, pas de reconduction.
```

Le numéro Mobile Money du vendeur n'est **pas** la voie normale : c'est le secours quand le lien de
caisse tombe, avec le code activé à la main. Ne jamais écrire « envoie-moi l'argent au numéro »
comme méthode par défaut.

**7. Les deux questions qui valent de l'or** (à tout le monde, y compris aux refus) :

```
Deux questions pour finir, ça prend 30 secondes : combien de temps vous prenez pour un devis aujourd'hui, et qu'est-ce qui vous ferait payer 2 000 F par mois — ou vous l'empêche ?
```

**8. Le parrainage, à demander à tout client satisfait** (coût : 0 F, c'est le produit qui paie) :

```
Un service : partagez l'app à deux confrères avec le bouton « Parrainer ». Dès qu'un de vos filleuls sort un document, vous recevez 1 mois offert (jusqu'à 12 mois par an). Le code est déjà dans le lien.
```

**9. Le message revendeur** — le canal au meilleur rendement, et le seul à 0 F qui grossit tout
seul (voir MARCHE.md, mouvement 1). Il s'envoie aux imprimeurs, reprographes et graphistes :

```
Bonjour. Vous vendez des carnets de factures et des cartes de visite à vos clients.
J'ai une application qui fait leurs devis et factures en PDF, avec signature sur téléphone. Le design à leur image est à 5 000 F — je le produis, vous le facturez 10 000 F, vous gardez la différence, votre travail est un fichier envoyé.
Pour que vous voyiez le rendu, je commence par faire le vôtre gratuitement, à votre nom, aujourd'hui.
```

Si l'un d'eux dit oui : tenir le compte dans le tableau, émettre le code d'accès depuis `#/vendeur`
(onglet vendeur, génération manuelle des offres — 1 mois, 1 an, design, tous les designs) et le
lui transmettre avec le nom de son client. Aucune grille de commissions n'existe dans le code : le
contrat revendeur est un accord écrit dans WhatsApp, dix lignes, avec le prix et le délai. C'est
suffisant pour démarrer et ça ne coûte rien.

---

## Étape 4 — les quatre canaux gratuits, dans l'ordre de rendement

1. **Le document du prospect** (étape 2). Le plus haut taux de conversion qui existe, et le seul
   qui prouve le produit sans le décrire. À faire en premier, tous les jours.
2. **WhatsApp : statut, listes de diffusion, groupes existants.** Votre carnet de contacts est
   l'audience la plus chaude et elle est déjà gratuite. Règle absolue : **un message = une URL**
   (le robot d'aperçu ne lit pas un bloc de six liens) et le lien tout seul dans le message ne
   suffit pas — joindre l'image du document. Une **liste de diffusion** n'accepte que des gens qui
   ont enregistré votre numéro : leur demander une fois, poliment, ne pas ajouter des inconnus.
3. **Groupes Facebook et communautés métiers.** Ne jamais arriver en vendant. La séquence qui
   marche dans un groupe de photographes ou de traiteurs : (a) répondre utilement à trois questions
   des autres pendant quelques jours, (b) publier un PDF d'exemple en image avec le texte « un client
   m'a demandé un devis avec acompte en 40 secondes, voilà le rendu », (c) laisser les gens
   commenter et écrire en privé à chaque personne qui réagit. Un lien collé dans quarante groupes en
   dix minutes produit un bannissement, pas un client.
4. **Vidéo verticale, 30-45 s, trois par semaine** : TikTok, Reels, YouTube Shorts, statut WhatsApp —
   un seul fichier pour quatre destinations. Les 12 titres à tourner, dans l'ordre, sans matériel :
   1. « Ton carnet raturé contre un PDF en 40 secondes »
   2. « Le client signe sur ton téléphone, tu repars payé »
   3. « Combien de temps pour un devis ? Je chronomètre. »
   4. « 5 lignes, un nom, un logo : voilà le devis »
   5. « Le acompte : comment le demander sans se fâcher »
   6. « Devis, proforma, facture : les trois ne sont pas le même papier »
   7. « L'école qui fait 900 quittances à la rentrée »
   8. « Le grossiste qui écrit 300 bons de commande par mois »
   9. « Mon client n'a pas de logo : j'ai fait avec une photo de sa devanture »
   10. « 20 documents gratuits, et après ? » (honnête : les prix, à l'écran)
   11. « Je n'ai pas installé d'application » (ouvrir le lien, montrer que ça tourne dans le navigateur)
   12. « Non, ça ne remplace pas e-MECeF » (et ce que ça fait à la place — la franchise fait plus de
       ventes que n'importe quelle promesse dans ce pays)

Gratuit aussi, mais lent — à faire **une fois**, puis oublier : une **fiche Google Business
Profile** (20 minutes, catégorie services, description avec « devis », « facture », « signature »,
« Cotonou », une publication par semaine), une **page LinkedIn** si vous visez les ONG et les
institutions. Le référencement prend des mois ; WhatsApp et le document, eux, paient la semaine.

---

## Étape 5 — l'argent (le maillon où l'on perd le plus de gens)

- L'encaissement passe par **Chariow** (commission 15 % prélevée par la caisse) : envoyer le lien de
  l'offre (2 000 F par mois, 15 000 F par an, 5 000 F le design, 50 000 F tous les designs pour un
  an), le client paie par MoMo, l'accès s'active à la confirmation du paiement.
- Un paiement qui échoue doit être **dit** au client, pas tu par un timeout : « le paiement n'est
  pas remonté, je vérifie de mon côté, je te rappelle dans l'heure » — et l'activer à la main depuis
  `#/vendeur` si l'argent est bien arrivé.
- Un client qui paie aujourd'hui doit recevoir dans la journée : le message de bienvenue, la demande
  de logo pour le design, et la question du parrainage (bloc 8 de l'étape 3).
- La promotion que vous pouvez tenir à 0 F : **le design à 5 000 F offert aux dix premiers
  abonnés annuels** — vous le fabriquez vous-même, donc le coût est votre temps, pas de l'argent.
  Ce qui n'est **pas** en votre pouvoir : offrir 3 mois d'abonnement, faire un concours, promettre
  un bonus — la seule récompense gratuite prévue par l'app est le parrainage (1 filleul avec un
  document exporté = 1 mois offert au parrain, plafond 12 mois par an).

---

## Étape 6 — le calendrier des 30 jours

Identique au test de validation de MARCHE.md § 7, mais découpé en actions : on ne « fait pas du
marketing », on remplit ces cases.

| Semaine | Cases à remplir | Ce que ça doit apprendre |
| --- | --- | --- |
| **S1** | 60 contacts · 20 entretiens sur 4 segments (écoles, grossistes en ligne, BTP, photographes) · 1 vidéo | Les 20 premiers ont-ils plus de 5 documents par semaine ? Leurs mots à eux pour décrire la douleur. |
| **S2** | 105 contacts · 10 démos de 90 secondes · 3 vidéos · 5 groupes touchés · 20 imprimeurs contactés (revendeur) | Le nombre de démos acceptées : le document gratuit est-il un appât qui attire les curieux ou les acheteurs ? |
| **S3** | 105 contacts · 5 préventes à 15 000 F (code émis à la main) · relances J+1/J+4 systématiques | Est-ce que du monde sort son portefeuille **avant** que le produit soit parfait. |
| **S4** | 105 contacts · 2 designs payés via un imprimeur · bilan chiffré | Le canal revendeur tient-il debout sans argent et sans vous ? |

**Les trois décisions, à la fin du mois :**
- **8 interviewés sur 20 au-dessus de 20 documents par mois** → continuer, le segment est bon,
  doubler la cadence sur les deux segments qui ont le mieux répondu.
- **Sinon** → le chantier n'est pas commercial : c'est le seuil du mur (`FREE_EXPORT_LIMIT` côté app,
  `QUOTA_LIMIT` côté Worker) qui est mal placé. Deux constantes à baisser, dix minutes.
- **200 contacts, 0 démo acceptée** → c'est l'accroche qui est morte, pas le produit : changer le bloc
  1, pas la cible. **20 démos, 0 payant** → le prix, la promesse ou la caisse : rejouer l'étape 0
  point 3 avec un tiers.

---

## Étape 7 — les six chiffres, une fois par semaine

| Semaine | Contacts envoyés | Réponses | Démos faites | Abonnements payants | Designs vendus | Revenu net (brut × 0,85) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |

Cible minimale de la semaine 2 : 105 contacts, 20 réponses, 8 démos, 2 abonnements. Sous 15 % de
taux de réponse pendant deux semaines, le problème est dans le premier message (bloc 1) : il est
trop long, trop général, ou envoyé à des gens sous le seuil. Ne corrigez jamais le prix avant d'avoir
corrigé le message.

---

## Étape 8 — ce qui ne marche pas à 0 F (à ne pas faire, c'est aussi une consigne)

- **Acheter des fichiers de numéros, ou envoyer à une liste de 500 inconnus.** Coût : un compte
  WhatsApp restreint au bout de deux jours, et des gens excédés. Le fichier de 500 numéros contient
  dix acheteurs, et on ne peut pas personnaliser 500 messages en une journée.
- **Promettre la conformité fiscale.** Ne jamais écrire « conforme à la réglementation », « remplace
  e-MECeF », « vos factures seront acceptées par les impôts ». L'app ne génère pas le QR e-MECeF.
  Cette phrase, si un client l'écrit dans un commentaire, devient votre problème.
- **Le « boost » gratuit, le giveaway, les 3 mois offerts** : en dessous du budget à 0 F, tout ce qui
  n'est pas un contact personnel produit du bruit, pas du revenu.
- **Repasser la semaine à refaire le site ou le design de l'app.** L'argument de vente est le PDF du
  prospect, pas votre vitrine. Une semaine de CSS est une semaine sans message envoyé.
- **Publier « 20 exports gratuits » comme promesse principale.** Ce n'est pas un produit gratuit :
  c'est un produit à 20 documents d'essai. Les gens venus pour le gratuit ne paieront jamais.
- **Répondre à J+2.** La fenêtre est de vingt minutes. Le téléphone doit être à portée quand on
  envoie un message, et l'envoi se fait aux heures où les gens répondent (7 h-9 h, 12 h-14 h,
  18 h-21 h — pas pendant qu'ils travaillent).
- **Publier sans avoir re-testé le lien depuis un autre téléphone**, en data, avec un compte neuf.

---

## Ce que je n'ai pas

- Aucune de vos conversions réelles : les taux annoncés à l'étape 2 (15-25 % de réponse, 25-40 %
  d'après-démo) sont des **ordres de grandeur** de prospection directe par message personnalisé, pas
  des mesures. Le premier tableau rempli (étape 7) les remplacera.
- Je ne connais pas votre audience existante (contacts WhatsApp, followers, clients de l'atelier
  d'imprimerie éventuel). Le rituel démarre plus vite si vous en avez une : commencer par les blocs 4
  et 8 de l'étape 3 : relancer ses propres contacts avant d'en chercher d'autres.
- Les noms de groupes et de comptes cités sont des **mots-clés de recherche**, pas des groupes vérifiés
  un par un. Idem pour l'audience TikTok/Reels au Bénin : non chiffrée nulle part.
- Aucune grille de commissions revendeurs n'existe dans le dépôt : il n'y a que le parrainage
  (`src/lib/referral.ts`). L'accord revendeur proposé à l'étape 3 (bloc 9) se tient à la main, avec
  les codes émis depuis `#/vendeur`. Le rendre automatique est un chantier de code, pas de texte.
- Aucune mesure publique du nombre de structures béninoises émettant au moins 20 documents par mois :
  MARCHE.md § 6 explique pourquoi, et le test de S1 est là pour produire le chiffre.
- Je n'ai pas pu vérifier le déploiement en ligne depuis ici : l'étape 0 reste à faire de votre côté,
  et le point 3 (payer 2 000 F une fois) est celui que l'on saute le plus souvent — à tort.

## Vérifié dans le code (pour que ce document ne puisse pas promettre faux)

| Ce que le plan avance | Où c'est écrit |
| --- | --- |
| Le seuil : 20 documents offerts par appareil sur 30 jours | `FREE_EXPORT_LIMIT` (`src/lib/license.ts`), doublon serveur `QUOTA_LIMIT` (`backend/worker.js`) |
| 2 000 F par mois, 15 000 F par an, 5 000 F le design, 50 000 F tous les designs | `PRICE_MONTHLY`, `PRICE_ANNUAL`, `PRICE_CUSTOM_DESIGN`, `PRICE_ALL` (`src/lib/license.ts`) |
| Paiement par la caisse Chariow, activation à la confirmation, sans reconduction | `PaywallModal.tsx`, `CHARIOW_LINKS` ; le numéro du vendeur (`VENDOR.PHONE`) n'est que le secours |
| Parrainage : 1 filleul avec un export = 1 mois offert au parrain, plafond 12 | en-tête de `src/lib/referral.ts` |
| Le lien partagé porte déjà le code parrain | `buildShareMessage()` + `referralDownloadLink()` → bouton « Parrainer » (`whatsappShareUrl()`) |
| Le contenu des documents ne sort pas de l'appareil ; le Worker ne voit que le comptage | `backend/worker.js` (routes `/export`, `/check`, `/validate`) |
| Codes émissibles à la main pour tenir une promo ou un accord revendeur | onglet `#/vendeur` (`src/components/VendorPage.tsx`, liste `OFFERS`) |
| Aucun mode hors-ligne installé (pas de manifest ni de service worker) | `index.html`, `vite.config.ts` |
