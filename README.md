# Panier Pesé

Application web qui catégorise les dépenses **ligne par ligne** depuis les tickets
de caisse — pour suivre son budget ET ses habitudes (alimentation, boissons, tabac…).

## Le problème

Les applications bancaires catégorisent paiement par paiement : un passage au
supermarché devient « courses » sans détail. Impossible de savoir combien
représentent l'alcool, les produits bruts, les produits ultra-transformés, les
restaurants par opposition aux fast-foods… Et la seule alternative qui existe
aujourd'hui, c'est de tout ressaisir à la main ligne par ligne dans un tableur
— un travail long et fastidieux, fait chaque jour par ceux qui tiennent à ce
niveau de détail.

## La solution

- 📷 Photo du ticket de caisse, lecture **ligne à ligne** (V2)
- 🏷️ Catégorisation fine des articles : produits bruts, ultra-transformés,
  alcool, vices…
- 🧾 **Tickets** : chaque saisie est atomique — une ligne dans l'historique,
  un détail consultable (les lignes du ticket) derrière un simple tap
- 🏅 **Labels** : une dimension transversale aux catégories (BIO, Évitable…),
  posables sur tout le ticket ou sur une ligne — badge plein = label du ticket,
  badge contour = label présent sur au moins une ligne
- 🎨 **Catégories et labels personnalisables** : choix parmi 12 couleurs,
  avec un mode avancé pour choisir une couleur précise ; les catégories
  s'affichent sans groupes
- 📊 **Bilan** par période : mois courant (= mois calendaire ou mois glissant,
  au choix), mois précis, plage de mois, ou depuis le début ; répartition par
  catégorie ou par label (sans ligne « Sans label »), et courbe d'évolution
  sur 6 mois filtrable par catégorie ou label
- 🧭 **Navigation et préférences** : onglets Bilan, Saisir, Historique,
  Réglages ; choix de la page d'accueil (Bilan ou Saisir)
- 🔒 **100 % local** : les données ne quittent jamais l'appareil
- 📥 Export / import (JSON) et export CSV pour Excel

## État du projet

 🚧 Prototype en phase C — voir le [cahier des charges](CAHIER-DES-CHARGES.md)

| Phase | Contenu | Statut |
|---|---|---|
| A | Mise en place du dépôt + Pages | ✅ |
| B | Cahier des charges V1 | ✅ |
| C | Prototype (HTML/CSS/JS) : saisie manuelle, tickets, labels, bilan par période et par périmètre | ✅ |
| D | Application complète (Vue 3 + Dexie, champ `modifieLe`) | ⏳ |
| E | Version installable (PWA) + test terrain 4 semaines | ⏳ |
| V2 | Photo + OCR du ticket, moteur de catégorisation | ⏳ |

## Questions / décisions structurantes

- **Pourquoi 100 % local ?** Simplicité d'hébergement, vie privée, et un
  argument produit : *vos données ne quittent jamais votre appareil*. Une
  sauvegarde optionnelle vers un drive personnel (WebDAV/kDrive) est prévue
  en fin de feuille de route.
- **Pourquoi un prototype avant le framework ?** Valider le modèle de données
  et l'ergonomie (écran de validation de ticket, drag & drop, picker) avant
  d'écrire le gros œuvre. Presque tout le prototype survit en phase D.
- **Comment tester ?** Ouvrir `index.html` dans un navigateur. Un jeu de test
  reproductible (~150 dépenses sur 6 mois) est disponible dans
  **Réglages → Zone de danger**. Pour essayer la simulation d'un ticket,
  aller dans **Saisir** et cliquer sur **Simuler un ticket (V2)**.
