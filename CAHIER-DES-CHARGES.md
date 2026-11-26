# Cahier des charges — Panier Pesé

_Dernière mise à jour : 2026-11-26_

## 1. Objectif

Suivre le budget global (dépenses, revenus et solde prévisionnel) tout en
catégorisant finement les achats, avec un niveau de détail que les applications
bancaires ne fournissent pas : non pas « Supermarché X : 84 € », mais alcool /
produits bruts / ultra-transformés / restaurants / fast-foods / vices… Les
cumuls servent à piloter le budget et à objectiver les habitudes, y compris
les jugements a posteriori (dépenses « évitables »).

## 2. Utilisateurs cibles (V1)

- Moi (budget).
- Ma sœur (saisie quotidienne de ses tickets, remplace aujourd'hui un suivi
  Excel manuel).

## 3. Périmètre V1

### 3.1 Saisie des opérations
Une opération est une dépense ou une rentrée d’argent : montant positif,
catégorie du type correspondant, date (aujourd'hui par défaut), note
optionnelle. Une date future est autorisée jusqu'à la fin de l'horizon réglé.
Les opérations futures restent prévisionnelles et ne sont pas incluses dans
les totaux réalisés. La saisie de dépense conserve les chips des 5 catégories
les plus utilisées (fenêtre de 2 mois, tri par fréquence).

### 3.2 Catégories
Les catégories de dépenses et de revenus sont séparées. Elles peuvent être
créées, renommées, archivées et, si inutilisées, supprimées. Les catégories de
dépenses ont une couleur choisie parmi une palette de douze couleurs, ou
personnalisée via le mode avancé. Les groupes ne sont pas affichés. Une
opération possède une seule catégorie.

### 3.3 Abonnements et projection
Un abonnement définit un nom, un montant, un type (dépense ou revenu), une
catégorie, une fréquence (hebdomadaire, mensuelle ou annuelle) et sa prochaine
échéance. Ses occurrences dans l'horizon sont des prévisions, pas des
opérations réalisées. À l'échéance, l'utilisateur confirme l'opération ; elle
est alors ajoutée à l'historique et l'échéance suivante est générée. Un
abonnement peut être suspendu, repris ou supprimé.

L'horizon de projection est réglable de 0 à 12 mois. Il limite les dates
autorisées pour les opérations futures manuelles, la création des échéances
d'abonnement et la projection du solde. Le graphique part du solde actuel
saisi dans les réglages et ajoute les revenus prévus, puis retranche les
dépenses prévues. Les prévisions restent séparées du bilan des opérations
réalisées. Une échéance déjà arrivée mais non confirmée est présentée comme
à confirmer et n'est pas comptée dans le solde projeté.

### 3.4 Tickets (saisies atomiques)
Un ticket = une saisie complète : magasin, date, et la liste des lignes
{libellé, montant, catégorie, labels}. L'historique affiche UNE ligne par
ticket (total, nombre de lignes, badges) ; un tap ouvre la fiche en lecture
seule, avec bouton « Modifier » (l'édition ne doit pas être un accident) et
bouton « Supprimer » (le ticket ET ses dépenses dérivées partent ensemble).
La validation d'un ticket produit des dépenses agrégées par catégorie
(l'entréer comptable lue par le Bilan), liées au ticket par `ticketId`.

> En V2, ce ticket sera créé par la photo + OCR : l'écran de validation
> (poignée ⠿ pour glisser une ligne, tap pour le picker) est déjà validé en
> phase C.

### 3.5 Labels
Dimension transversale aux catégories : ils répondent à « comment c'est fait ?
» et se cumulent (BIO, Évitable…). Liste FERMÉE mais modifiable comme les
catégories (ajouter, renommer, archiver — pas de suppression : les tickets y
référencent), avec le même choix de palette et mode avancé. Pose :
- sur le TICKET entier (ça vaut pour tout), ou
- sur une LIGNE du ticket (ex. le ticket n'est pas évitable, la ligne
  « paquet de chips » l'est), ou
- sur une dépense manuelle (via « Modifier »).

Représentation : badge PLEIN (blanc sur fond couleur) = posé sur tout le
ticket ; badge CONTOUR (couleur sur fond blanc) = au moins une ligne. Les
labels ne touchent JAMAIS la saisie express : ils se posent au picker du
ticket ou via « Modifier ». La mention BIO d'un libellé est détectable
automatiquement (répétition générale faite en phase C sur les tickets simulés).

### 3.6 Historique
Fusion chronologique des dépenses, revenus et tickets, un titre par mois,
recherche insensible aux accents (catégorie, note, magasin), opérations
futures signalées comme « À venir », modification/suppression individuelles.

### 3.7 Bilan par période
Quatre modes : mois courant (défaut au_contact de l'écran), un mois précis,
plage de deux mois, depuis le début. Règles :
- un mois PRÉCIS est toujours un mois calendaire ;
- le sélecteur propose toujours le mois courant ;
- la préférence Réglages décide ce que désigne « ce mois-ci » : mois
  calendaire (défaut) ou mois glissant (même jour du mois dernier →
  aujourd'hui) ;
- cette préférence agit sur la LECTURE (total du titre + Bilan), jamais sur
  le stockage : les dépenses gardent leur date exacte ;
- l'état du sélecteur n'est pas mémorisé (retour « mois courant » à chaque
  ouverture) ;
- le libellé visible reste « Ce mois-ci » ; les dates exactes de la période
  sont affichées au-dessus du bilan ;
- répartition consultable par catégorie ou par label (les montants de labels
  peuvent se cumuler ; les dépenses sans label ne sont pas listées) ;
- total des revenus, dépenses et solde net réalisés sur la période ; les
  revenus sont répartis selon leurs catégories ;
- vue de tendance « évolution 6 mois » en courbe, toujours en mois
  calendaires et ancrée sur aujourd'hui ; filtre possible sur toutes les
  dépenses, une catégorie ou un label précis ;
- graphique distinct de projection du solde sur l'horizon sélectionné.

### 3.8 Sauvegarde
Export/import JSON complet (catégories, dépenses, revenus, abonnements,
tickets, labels, solde de départ et horizon), export CSV signé (sémicolons,
virgule décimale, BOM UTF-8 — Excel FR en un double-clic), rappel de la date
de dernière sauvegarde. Rotation conseillée : garder les 5 derniers exports
datés.

### 3.9 Réglages
Onglets : Bilan, Saisir, Historique, Réglages. Préférences : mois
calendaire/glissant, page d'accueil (Saisir ou Bilan), solde actuel de départ
et horizon de projection (0 à 12 mois). Zone de danger : effacement avec
double confirmation.

## 4. Modèle de données

Principe structurant : **le ticket est la saisie atomique ; les dépenses
agrégées en sont la projection comptable. Les échéances d'abonnement sont des
prévisions et ne deviennent des opérations qu'après confirmation.**

| Entité | Champs |
|---|---|
| Dépense / Revenu | id, date (AAAA-MM-JJ), montant positif (CENTIMES, entier), categorieId → catégorie du type correspondant, note, source, ticketId? → Ticket pour les dépenses de ticket, abonnementId? → Abonnement, creeLe |
| Catégorie de dépense | id, nom, couleur, archivée |
| Catégorie de revenu | id, nom, archivée |
| Ticket | id, magasin, date, lignes[] {id, libellé, montants (centimes), categorieId?, labels[]}, labels[], source, creeLe |
| Label | id, nom, couleur, archivé |
| Abonnement | id, nom, type, montant (centimes), categorieId, fréquence, prochaineDate, jourMois, moisAnnee, archivé |
| Préférences budgétaires | solde actuel de départ (centimes), horizon (0–12 mois) |

Invariants :
- montants positifs en centimes entiers (jamais de flottant en base) ; le
  signe est déterminé par le type d'opération ;
- dates en chaînes AAAA-MM-JJ (comparables comme du texte — c'est ce qui
  fait fonctionner tous les filtres de période) ;
- les opérations futures et échéances projetées n'entrent pas dans les totaux
  réalisés ;
- pas de clé étrangère bloquante : une référence orpheline s'affiche
  « (catégorie supprimée) », sans crash ;
- `source` distingue l'origine (`manuelle`, `abonnement` ou `test`),
  `ticketId` distingue l'entrée dans un ticket et `abonnementId` rattache une
  échéance confirmée à son abonnement.

Clés isolées : préférence de mois, page d'accueil, aide ticket déjà affichée,
revenus, catégories de revenus, abonnements, solde de départ, horizon de
projection et date du dernier export.

## 5. Non-objectifs V1 (écrits noir sur blanc)

- ❌ Photo de ticket et OCR — en V2, c'est le mode d'entrée PRINCIPAL ; la
  saisie manuelle devient l'écran de correction et le repli (ticket illisible,
  achat en ligne, médecin…). Les 4 semaines de test terrain se feront sur la
  version photo-first.
- ❌ Scan de code-barres, catalogue produits, Open Food Facts, classification NOVA
- ❌ Connexion bancaire ou import de relevés
- ❌ Comptes utilisateurs, synchronisation serveur, multi-appareil
- ❌ Budgets par catégorie avec alertes

## 6. Feuille de route V2+

1. **Photo du ticket + OCR ligne à ligne** (Tesseract.js local), branché sur
   l'écran de validation déjà construit ; détection auto du label BIO dans
   les libellés.
2. **Moteur de catégorisation** : catalogue local appris des corrections
   (libellé nettoyé → catégorie), règles de mots-clés FR pour le vrac,
   Open Food Facts + NOVA pour les produits avec EAN. Chaque correction
   manuelle devient une règle permanente.
3. **Cumuls par label** au Bilan (« combien d'Évitable ce mois ? », « part du
   BIO sur 6 mois »).
4. Import de relevés bancaires (CSV déposé volontairement) pour la vue
   « marchands » (restaurants vs fast-foods se joue sur le nom du commerçant).
5. Budgets par catégorie avec alertes.
6. PWA installable, partage de photo depuis la galerie Android.
7. **Sauvegarde vers un drive personnel** (indépendante du drive) : sur PC,
   écriture directe dans un dossier dédié surveillé par le client du drive
   (kDrive, Drive, Nextcloud…), mise à jour au démarrage et à chaque
   modification ; sur Android (source principale des données, le PC n'est
   qu'une console de lecture), écriture directe via WebDAV si le test
   CORS le permet, sinon partage manuel avec rappel. Prérequis déjà écrit :
   le champ `modifieLe` (phase D) pour la fusion « la plus récente gagne ».

## 7. Critères de succès V1

- Ma sœur tient 4 semaines de saisie photo-first sans abandonner son Excel.
- Une saisie complète en moins de 5 secondes.
- Export → effacement → réimport sans perte d'aucune ligne (dépenses,
  revenus, abonnements, tickets, labels et réglages budgétaires).

## 8. Journal des décisions (pour ne pas re-décider)

- 2026-11 : séparation ticket / dépenses agrégées (l'historique montre la
  saisie, le Bilan lit la comptabilité).
- 2026-11 : labels multi-valués à liste fermée, badge plein/contour selon
  l'implantation (ticket entier vs ≥ 1 ligne).
- 2026-11 : un mois précis = toujours calendaire ; « ce mois-ci » configurable
  calendaire/glissant, préférence de lecture uniquement.
- 2026-11 : une catégorie/label manquante se crée dans Réglages, pas à la
  volée sur l'écran de validation (geste rare, écran allégé).
- 2026-11 : les catégories n'ont plus de groupes visibles ; couleurs des
  catégories et labels réglables via une palette de douze couleurs et un mode
  avancé, et le bilan peut répartir par label.
- 2026-11 : montants en centimes, dates en AAAA-MM-JJ, export JSON comme
  format pivot de sauvegarde.
- 2026-11 : budget global avec catégories de revenus distinctes, solde de
  départ configurable et projection réglable de 0 à 12 mois.
- 2026-11 : abonnements hebdomadaires, mensuels ou annuels ; leurs échéances
  sont prévisionnelles et demandent confirmation avant d'être comptabilisées.
- 2026-11 : smartphone = source principale des données (la caméra y est) ;
  le PC = console de consultation.

---

_Cadrage : application offline-first, aucune donnée transmise à un serveur ;
dépôt public sans secret. Les outils de test intégrés au prototype (jeu de
données à graine fixe, tickets simulés, purge ciblée `source: 'test'`) sont
des instruments de développement, à retirer en version finale._
