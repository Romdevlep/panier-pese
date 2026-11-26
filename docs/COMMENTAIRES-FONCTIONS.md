# Commentaires de fonctions à ajouter dans `app.js`

Cette revue a repéré des fonctions sans commentaire descriptif immédiatement au-dessus de leur déclaration. Les blocs ci-dessous sont rédigés pour être insérés dans `app.js` au-dessus des fonctions concernées.

```js
// Formate un montant stocké en centimes selon les conventions monétaires françaises.
function formaterEuros(centimes) { /* ... */ }

// Recherche une catégorie par identifiant ; renvoie `undefined` si elle n'existe plus.
function categorieParId(id) { /* ... */ }

// Recherche un label par identifiant ; renvoie `undefined` si aucun label ne correspond.
function labelParId(id) { /* ... */ }

// Charge les données locales et initialise catégories et labels par défaut si nécessaire.
function chargerDepuisStockage() { /* ... */ }

// Sérialise les données courantes et les enregistre dans le stockage local du navigateur.
function sauvegarder() { /* ... */ }

// Affiche un message temporaire et remplace, le cas échéant, le toast précédent.
function montrerToast(message) { /* ... */ }

// Rend les boutons de sélection rapide des catégories les plus utilisées.
function rendreChips() { /* ... */ }

// Demande confirmation, supprime une dépense puis actualise les vues dépendantes.
function supprimerDepense(id) { /* ... */ }

// Détermine le titre à afficher pour le mode de période actif du bilan.
function titrePeriodeBilan() { /* ... */ }

// Reconstruit les cartes du bilan pour la période choisie et la tendance récente.
function rendreBilan() { /* ... */ }

// Construit la ligne de réglages d'une catégorie et câble ses actions de gestion.
function construireLigneCategorie(c) { /* ... */ }

// Reconstruit la liste des labels et leurs commandes de renommage et d'archivage.
function rendreListeLabels() { /* ... */ }

// Affiche les catégories, labels et informations de sauvegarde dans les réglages.
function rendreReglages() { /* ... */ }

// Met à jour le texte indiquant la date du dernier export et le rappel de sauvegarde.
function rendreInfoExport() { /* ... */ }

// Prépare et télécharge un export JSON des données prises en charge par l'export.
function exporterJSON() { /* ... */ }

// Prépare et télécharge les dépenses au format CSV compatible avec Excel français.
function exporterCSV() { /* ... */ }

// Lit, contrôle sommairement et importe un fichier JSON après confirmation.
async function importerJSON(fichier) { /* ... */ }

// Ferme le sélecteur de catégorie/labels et efface la ligne actuellement ciblée.
function fermerPicker() { /* ... */ }

// Actualise les composants principaux après une modification des données.
function rafraichirTout() { /* ... */ }

// Initialise les données, branche les événements de l'interface et effectue le rendu initial.
function demarrer() { /* ... */ }
```

## Point de vigilance relevé pendant la relecture

Dans `construireCarteBarres`, le libellé de catégorie est concaténé dans `innerHTML`. Comme les noms de catégories sont saisis par l'utilisateur, il vaut mieux construire ce contenu avec `createElement` et `textContent` (comme c'est déjà fait dans plusieurs autres rendus), afin de ne pas interpréter un nom comme du HTML.

Les commentaires déjà présents dans `app.js` ont été conservés ; ce document recense les fonctions qui gagneraient à recevoir un commentaire d'intention au niveau de leur déclaration.
