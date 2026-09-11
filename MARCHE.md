# À qui vendre Devis Designer — étude des segments

Document de travail, pas du code. Il répond à une seule question : **qui est capable de payer
2 000 F par mois (ou 15 000 F par an) pour ne plus retaper ses devis**, et où les trouver au
Bénin. Les affirmations chiffrées portent leur source ; ce que je n'ai pas pu vérifier est écrit
comme non vérifié, pas comme une estimation.

Deux constantes de l'application commandent toute la liste :

- **`FREE_EXPORT_LIMIT = 20`** (`src/lib/license.ts:21`, plafonné côté serveur par `QUOTA_LIMIT`
  dans le Worker). Un client qui produit **moins de 20 documents par mois ne verra jamais le mur
  de paiement**. Il n'est pas « à convaincre » : il n'a rien à acheter, sauf le design. Cette
  frontière élimine la majorité silencieuse du commerce de détail, et elle concentre le marché
  réel sur les métiers à devis/factures répétés.
- **l'application ne génère pas le QR code d'e-MECeF**. Depuis le 1ᵉ juillet 2021, les entreprises
  assujetties à la TVA doivent délivrer une facture normalisée via la plateforme de la DGI
  (<https://e-mecef.impots.bj/>) ou un Système de Facturation d'Entreprise approuvé par la DGI.
  La sanction tourne autour de 10 × la TVA éludée avec un plancher d'**un million de F CFA par
  opération non facturée** (article 1096 du CGI, reprise dans la presse spécialisée). Tant que
  l'app ne parle pas à e-MECeF, **un segment assujetti n'est vendable qu'en amont** (devis,
  proforma, bon de commande, acompte) — pas comme « l'outil qui remplace la machine ».

Autrement dit, sur ce marché il y a trois familles de clients : ceux pour qui l'app **suffit**
(pas d'obligation de facture normalisée), ceux pour qui elle **manque une brique** (assujettis :
à servir sur le devis, en attendant l'intégration), et ceux qui ne **paieront jamais**
(informels à la pièce, gros avec comptable et ERP).

---

## 1. Les chiffres qui dimensionnent le marché

| Ce qu'on sait | Chiffre | Source |
|---|---|---|
| Entreprises créées au Bénin en 2025 | **55 345**, dont **50 005 entreprises individuelles** (90,4 %) | rapport APIEx relayé par banouto.bj |
| Répartition des entreprises individuelles 2025 | commerce **23 624** (47,2 %) ; télécommunications & numérique **15 608** (31,2 %) ; construction **2 303** | idem |
| Sociétés commerciales créées | le commerce pèse **63,2 %**, construction 7,2 %, prestations intellectuelles 6,4 % | idem |
| Entreprises recensées (tous secteurs) | **215 755** entreprises / 237 488 établissements en 2023 | 3ᵉ Recensement Général des Entreprises, INStaD |
| Part avec un IFU | **14,1 %** → informalité estimée à **85,9 %** | idem |
| Comptes mobile money actifs | **11 649 735** à fin 2025 ; **288,15 millions** de paiements marchands (+24,13 % en un an) ; MTN 51 % des comptes | rapport ARCEP 2025 relayé par lamarina.bj |
| Prix du voisin conforme | Faktoo (Bénin) : 30 factures/mois gratuites, **5 000 F/mois**, 15 000 F/mois (PME), 35 000 F/mois | faktoo.bj |
| Prix du voisin régional | FacturePro CI : **2 500 F/mois** (50 factures), 5 000 F/mois illimité + Mobile Money | App Store |
| Ce que paie l'incumbent papier | carnet de factures normalisées personnalisé ~**30 000 F**, liasse A4 ~1 100 F l'exemplaire par 100, papier en-tête 50 F par 500 (marché UEMOA voisin) | imprimeurs CI (best-imprimerie.ci, mon-imprimeur.ci) |

Le calcul de revenu qui en découle, à votre grille tarifaire actuelle (les montants nets
supposent un encaissement par Chariow, commission 15 % ; en Mobile Money direct sur votre numéro,
c'est le brut) :

| Clients payants | Mensuel 2 000 F | Annuel 15 000 F |
|---|---|---|
| 25 | 50 000 F brut / **42 500 F nets** par mois | 375 000 F / **318 750 F** par an |
| 100 | 200 000 F / **170 000 F** par mois | 1,5 M F / **1,275 M F** par an |
| 500 | 1 M F / **850 000 F** par mois | 7,5 M F / **6,4 M F** par an |

Et la question qui décide de tout, **pour laquelle il n'existe aucun chiffre public** : sur les
~50 005 créations individuelles de 2025, combien émettent au moins 20 documents par mois ?
Personne ne le mesure. Le seul proxy solide est le nombre de créations dans les secteurs qui
facturent sur devis (numérique + construction + sociétés de prestation intellectuelle), soit
**~18 000 structures par an**. C'est le dénominateur honnête à utiliser dans vos calculs, et la
première chose à transformer en chiffre maison (voir § 5).

---

## 2. Tier 1 — les segments où l'app suffit, et où l'on paie

Ceux-là n'ont pas d'obligation e-MECeF (hors champ TVA, exemption, ou document non fiscal),
produisent plus de 20 documents par mois, et achètent un gain de temps + une image.

| Métier | Documents / mois | Ce qu'il achète vraiment | Où le trouver | Objection à désamorcer |
|---|---|---|---|---|
| **Imprimeurs, reprographes, graphistes de quartier** | 60-300 (ils les font pour leurs clients) | le document que le client leur demande sans savoir le faire + **la revente du design** | ateliers des marchés et des zones d'activité, ZIGIB à Abomey-Calavi, groupes Facebook « imprimerie/graphisme Cotonou » | « je fais ça sur Word en 10 minutes » → le carnet de clients et la reprise des lignes lui font gagner les 10 minutes d'après |
| **Photographes & vidéastes (mariage, baptême, corporate)** | 20-80 devis, beaucoup de refus | devis d'acompte propre, « bon pour accord », forfait lisible | communautés de photographes du Bénin sur WhatsApp/Facebook, mariages du samedi | « mes clients paient sans papier » → l'acompte non payé, c'est exactement ce que le statut du document rattrape |
| **Traiteurs, décorateurs, loueurs (tentes, sono, vaisselle, voitures)** | 25-120 | devis + facture avec conditions de réservation, acompte, pénalité | associations de traiteurs, groupes « événementiel Cotonou », listes de loueurs sur Marketplace | « saisonnier » → l'abonnement annuel se vend à la sortie des fêtes |
| **Artisans BTP : menuisiers, carreleurs, soudeurs, électriciens, toiture, peinture** | 20-60 (chantiers) | décompte détaillé quantité × prix, validité du devis, conversion devis→facture | ateliers le long des axes, chantiers, GIE d'artisans, chambres des métiers | « le client veut juste un prix » → le devis chiffré poste par poste est ce qui empêche la renegotiation à la fin |
| **Garages, mécanique, vente de pièces, lavage auto** | 40-200 bons d'atelier | lignes pièces + main-d'œuvre, suivi payé/impayé | grappes de garages de Cotonou, distributeurs de pièces | « je note dans un cahier » → le cahier ne relance pas, et ne prouve rien au client qui conteste |
| **Freelances du numérique : community management, sites web, montage, design, rédaction** | 20-60 | proforma + facture d'acompte + design à ses couleurs | Sèmè City, coworking de Cotonou, groupes « tech Bénin », Twitter/X | « je facture par Wave » → la preuve de ce qui a été vendu, pas seulement reçu |
| **Écoles privées, crèches, garderies, centres d'appui scolaire** | **200-1 500** en période de rentrée (un parent = une facture) | quittances de scolarité numérotées, par trimestre, avec logo | directement les directions d'écoles, annuaires des établissements privés | « on a un secrétariat » → le secrétariat perd une semaine par rentrée ; là, c'est le carnet de clients qui fait le travail |
| **Salles de sport, arts martiaux, écoles de danse et de musique** | 60-300 abonnements | facturation mensuelle récurrente, statut payé | gérants de salles, fédérations sportives | idem : volume, répétition, aucune obligation fiscale lourde |
| **Hôtellerie légère, maquis/restaurants à prestation, salons & instituts** (forfaits, location d'espace, prestations sur devis) | 25-120 | devis d'événement, note de prestation | zones de sortie (Fidjrossè, Haie Vive, Cotonu-Plage), associations d'hôteliers | ce segment est mixte TVA : voir § 3 |
| **Immobilier : agences de location, gestionnaires, conciergerie, meublés** | 40-200 quittances et baux | quittances numérotées par mois et par locataire, en PDF propre | agences immobilières de Cotonou, groupes de gestionnaires | les loyers d'habitation ne sont pas le terrain de la facture normalisée : vente facile |
| **Transport, logistique, déménagement, manutention** | 30-150 | devis par mission, facturation à la course/au camion | coopératives de transport, déménageurs, loueurs d'engins | « mes clients sont des particuliers » → justement, un particulier exige un reçu propre |
| **Grossistes & e-commerçants (perruques, cosmétiques, chaussures, téléphones, pièces)** | **100-1 000** bons de commande | bon de commande + facture proforma + suivi acompte/paiement, envoyé sur WhatsApp | marché Dantokpa et ses allées (textile, électronique, quincaillerie), boutiques Instagram, grossistes | c'est le segment au plus fort volume par franc encaissé : s'il dépasse 20 documents, il paie |
| **Prestataires aux entreprises : nettoyage, gardiennage, sécurité privée, maintenance clim/ascenseur** | 20-80 (souvent des contrats mensuels) | facture récurrente + devis d'intervention | appels d'offres locaux, clients PME, syndics | leur client final demande du normalisé → voir § 3 |
| **Boutiques d'intrants agricoles, coopératives (anacarde, karité), fermes, pisciculture** | 25-150 bons de livraison/factures | bons de commande, factures aux grossistes, reçus aux producteurs | unions de producteurs, ZIGIB et agro-industrie, foires agricoles | paiement en cash, papier : c'est le segment qui bascule le plus vite quand on lui montre sa propre facture imprimée |
| **Associations, ONG locales, églises/mosquées (reçus, conventions, devis d'activités)** | 20-100 | reçus numérotés, devis de formation, rapports d'activités budgétaires | sièges d'associations, réseaux de bénévoles | non lucratif ≠ sans facture : ils en émettent pour les bailleurs |

## 3. Tier 2 — assujettis à la TVA : à servir sur le devis, pas sur la facture

Ces segments ont de l'argent et un besoin réel, mais **la facture finale doit passer par
e-MECeF ou un SFE approuvé**. Tant que ce n'est pas branché, la promesse honnête est :
*« vos devis, proforma, bons de commande et relances ici ; la facture normalisée, c'est la
plateforme des impôts »*. C'est déjà un métier (tout l'amont du cycle de vente), et ça évite
le client qui découvrira l'amende et vous le reprochera.

- **Sous-traitants et fournisseurs de marchés publics / projets financés** (BTP, mobilier,
  fournitures, informatique) : beaucoup d'amont (devis, offres techniques), exigences de
  mentions, IFU du client.
- **Prestataires aux entreprises** (conseil, formation, audit, recrutement, marketing, imprimerie
  de packaging) : ils facturent des sociétés qui exigent une facture conforme en retour.
- **Restauration commerciale, hôtels, brasseries, stations-service annexes** : secteurs
  historiquement contrôlés sur la facture normalisée (au Carnet/hologramme chez les voisins de
  l'UEMOA, à la machine ici).
- **Cliniques, cabinets médicaux et dentaires, laboratoires, opticiens, pharmacies** : forte
  volumétrie de notes d'honoraires, régimes d'exemption variables selon l'acte — à vérifier
  cas par cas, et c'est un segment qui achète une belle image (le design à 5 000 F se vend seul).
- **Cabinets d'avocats, notaires, huissiers, experts-comptables** : honoraires, exemptions,
  exigence de présentation ; ce sont aussi vos meilleurs apporteurs d'affaires croisés.

**Le levier de ce tier, c'est l'intégration** : un SFE déclaré/approuvé par la DGI, avec le
numéro d'agrément et la clé API (geCloud au Bénin fait exactement cela), et le QR code renvoyé
sur le document. C'est ce qui transforme 2 000 F/mois en 15 000 F/mois, et c'est un chantier
d'intégration + de démarches administratives, pas de CSS.

## 4. Tier 3 — ne pas aller les chercher

- **Le détail informel à la pièce** (85,9 % des entreprises sans IFU, et le maquis du coin) :
  moins de 20 documents par mois, aucun acheteur de logiciel. Ils ne sont pas votre marché, ils
  sont celui du carnet à 2 360 F.
- **Les sociétés avec comptable et ERP** (Odoo, Sage, Pennylane, etc.) : cycle de vente long,
  besoin multi-utilisateurs, stock, comptabilité — trois choses que l'app n'a pas.
- **Les acheteurs hors zone franc / hors Mobile Money** : la facturation par carte et l'euro ne
  sont pas vos rails, et les outils gratuits européens (Abby, Qonto, Tiime facturiers illimités à
  0 €) y gagnent le comparatif.
- **Ceux qui demandent explicitement la conformité comme argument d'achat** tant que le QR
  n'existe pas : vous perdrez du temps et votre réputation.

## 5. Trois mouvements concrets, dans l'ordre

1. **Le canal n°1 est le revendeur, pas l'utilisateur final.** Un imprimeur-graphiste qui fait
   300 documents par mois pour ses clients a intérêt à acheter l'app **et** le design sur mesure
   (il les refacture plus cher, et le livrable `.dddesign.js` est fait pour être installé chez son
   client). Attention : le dépôt ne connaît qu'un parrainage (1 filleul = 1 mois offert au
   parrain, plafond 12/12 mois, `src/lib/referral.ts`), pas de grille revendeur avec remise.
   C'est la première brique à poser — un tarif « 5 licences packagée » et un fichier de marque
   blanche, avant toute campagne.
2. **La démo qui convertit, c'est leur propre document.** Ouvrir l'app, taper leur nom, coller
   leur logo, choisir une mise en page, envoyer le PDF sur leur WhatsApp pendant qu'on parle :
   90 secondes. Aucun incumbent (carnet, Word, plateforme des impôts) ne peut faire ça. Toutes
   les actions de prospection doivent viser ce moment, pas une présentation de fonctionnalités.
3. **Vendre au rythme de la saison** : rentrée scolaire (septembre-octobre : écoles, crèches,
   centres d'appui, salles), mariages et fêtes de fin d'année (traiteurs, photographes,
   loueurs), hors-saison des pluies pour les chantiers, cycles de projets pour les ONG. Un
   abonnement annuel se signe dans ces fenêtres ; le mensuel se récupère en dehors.

## 6. Ce qui est à confirmer sur place, et que je n'ai pas

- **Combien de structures béninoises émettent ≥ 20 documents par mois** — le chiffre qui décide
  si le modèle est un marché de masse ou un marché de niche à 250-400 clients. Un seul échantillon
  de 20 entretiens bien faits (voir § 7) vaut tous les annuaires.
- **Le régime fiscal exact de chaque segment** (exemptions TVA selon l'acte, assujettissement réel
  des écoles/cliniques/agences immobilières) : à faire valider par un comptable local ou la DGI —
  je n'ai que ce que disent les textes, pas ce que l'administration tolère.
- **Le prix psychologique local** : 5 000 F/mois est le prix affiché par les conformes ; personne
  ne sait encore si l'illimité non conforme vaut 2 000 F ou 3 500 F. Testez les deux, un trimestre
  chacun, avant de vous y installer.
- **La charge de support** : une app sans compte = pas d'email de récupération, donc le client qui
  change de téléphone et n'a pas exporté son JSON perd ses documents. C'est l'objection n°1
  prévue, et elle se traite par un rituel d'onboarding, pas par une promesse.

## 7. Le test de validation (30 jours, sans code)

| Semaine | Quoi | Nombre visé | Ce qu'on note |
|---|---|---|---|
| 1 | entretiens ciblés sur 4 segments (écoles, grossistes Instagram, BTP, photographes) | 20 | documents émis par mois ; outil actuel ; ce qu'ils paient déjà (papier, graphiste, abonnement) |
| 2 | la démo de 90 secondes, chez eux ou en visio | 10 | combien demandent le PDF de démo pour eux-mêmes |
| 3 | prévente à 15 000 F/an, avec engagement moral | 5 | le prix ferme-t-il ? qui marchandent le mensuel ? |
| 4 | 2 offres de design sur mesure à 5 000 F via un imprimeur revendeur | 2 | le canal revendeur existe-t-il vraiment |

Critère de poursuite : si **au moins 8 des 20** interviewés sont au-dessus de 20 documents par
mois, le mur de paiement est bien placé et le segment est vendable en l'état. Sinon, le premier
chantier n'est pas commercial : c'est `FREE_EXPORT_LIMIT` (et le `QUOTA_LIMIT` du Worker) qui est
mal calibré pour ce marché, et il faut le baisser — une constante chacun, dix minutes.

---

### Sources

APIEx (via banouto.bj, juin 2026) : créations d'entreprises 2025. INStaD, 3ᵉ Recensement Général
des Entreprises (2024) : nombre d'entreprises et part avec IFU. ARCEP (via lamarina.bj, mai 2026) :
comptes et paiements marchands mobile money. faktoo.bj et App Store (FacturePro CI) : prix des
conformes. e-MECeF / DGI Bénin : obligation, plateforme, mentions, et sanctions rappelées
(art. 1096 CGI, communiqué DGI 2025). geCloud : le modèle SFE approuvé par clé API. Imprimeurs
UEMOA : prix du papier. Tout ce qui n'est pas dans cette liste est marqué « à confirmer » dans le
corps du texte.
