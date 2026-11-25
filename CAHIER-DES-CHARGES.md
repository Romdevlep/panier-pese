# Cahier des charges — Panier Pesé, version 1

_Dernière mise à jour : 2026-11-25_

## 1. Objectif

Saisir et catégoriser finement mes dépenses, avec un niveau de détail
que les applications bancaires ne fournissent pas : non pas « Supermarché X :
84 € », mais alcool / produits bruts / ultra-transformés / restaurants /
fast-foods / vices… Sur ce socle, des cumuls pour piloter le budget
et objectiver les habitudes.

## 2. Utilisateurs cibles (V1)

- Moi (budget).
- Margaux (saisie quotidienne de ses tickets, remplace aujourd'hui un suivi Excel manuel).

## 3. Périmètre V1

1. **Saisie express** : montant, catégorie, date (aujourd'hui par défaut),
   note optionnelle — en moins de 5 secondes.
2. **Catégories éditables** : créer/renommer/archiver ; regroupement
   « Alimentation », « Restaurants », « Vices payés » (alcool, tabac, jeux, sodas)…
   Les catégories de Maïlys1 servent de jeu de départ (à importer depuis son Excel).
3. **Liste chronologique** des dépenses, avec recherche et modification/suppression.
4. **Cumuls** : total du mois, total par catégorie, évolution sur les derniers mois.
5. **Export / import** de toutes les données (JSON), export CSV pour Excel.

## 4. Modèle de données V1

| Entité | Champs |
|---|---|
| Dépense | id, date, montant, catégories (une ou plusieurs), note, source (manuelle), créé le |
| Catégorie | id, nom, groupe (alimentation/restaurants/vices/…), couleur, ordre, archivée |

## 5. Non-objectifs V1 (écrits noir sur blanc)

- ❌ Photo de ticket et OCR (phase suivante, cœur de valeur ensuite)
- ❌ Scan de code-barres et catalogue produits
- ❌ Connexion bancaire ou import de relevés
- ❌ Comptes utilisateurs, synchronisation multi-appareils, serveur
- ❌ Budgets avec alertes

## 6. Feuille de route V2+

1. Photo du ticket + OCR ligne à ligne (Tesseract.js local, puis API spécialisée si besoin)
2. Scan de code-barres + Open Food Facts + classification NOVA,
   catalogue local appris des corrections
3. Import de relevés bancaires (CSV déposé volontairement) pour la vue « marchands »
4. Budgets par catégorie avec alertes, dépenses récurrentes
5. PWA installable, partage de photo depuis la galerie Android

## 7. Critères de succès V1

- Margaux tient 4 semaines de saisie sans abandonner le projet Excel.
- Une saisie complète en moins de 5 secondes.
- Export → import sur un autre navigateur sans perte d'aucune ligne.

---

_Notes de cadrage : application offline-first, aucune donnée transmise à un serveur ;
dépôt public sans secret. Le nom Panier Pesé couvre le budget comme les habitudes :
les « vices » sont un groupe de catégories, pas un produit séparé._
