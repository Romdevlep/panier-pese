# Panier Pesé

Application web locale pour suivre son budget global — dépenses, rentrées
d’argent et échéances récurrentes — tout en catégorisant les achats ligne par
ligne depuis les tickets de caisse.

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
- 💶 **Budget global** : saisie des dépenses et des revenus, avec des
  catégories distinctes
- 🔁 **Abonnements** : échéances hebdomadaires, mensuelles ou annuelles
  projetées à l’avance ; chaque échéance est confirmée à son arrivée avant
  d’être ajoutée à l’historique
- 📈 **Projection du solde** : solde actuel de départ et horizon réglable de
  0 à 12 mois ; les opérations futures manuelles et les échéances prévues
  restent distinctes des opérations réalisées
- 🏅 **Labels** : une dimension transversale aux catégories (BIO, Évitable…),
  posables sur tout le ticket ou sur une ligne — badge plein = label du ticket,
  badge contour = label présent sur au moins une ligne
- 🎨 **Catégories et labels personnalisables** : choix parmi 12 couleurs,
  avec un mode avancé pour choisir une couleur précise ; les catégories
  s'affichent sans groupes
- 📊 **Bilan** par période : revenus, dépenses et solde net réalisés ; mois
  courant (= mois calendaire ou mois glissant, au choix), mois précis, plage
  de mois, ou depuis le début ; répartition des dépenses par catégorie ou par
  label (sans ligne « Sans label »), revenus par catégorie, courbe d'évolution
  sur 6 mois et projection séparée du solde futur
- 🧭 **Navigation et préférences** : onglets Bilan, Projection et Historique ;
  bouton Saisir toujours accessible et Réglages via la roue dentée ; choix de
  la page d'accueil parmi ces trois onglets
- 🔒 **100 % local** : les données ne quittent jamais l'appareil
- 📥 Export / import JSON complet (opérations, catégories, abonnements et
  réglages budgétaires) et export CSV signé pour Excel

## État du projet

 🚧 Prototype en phase C — voir le [cahier des charges](CAHIER-DES-CHARGES.md)

| Phase | Contenu | Statut |
|---|---|---|
| A | Mise en place du dépôt + Pages | ✅ |
| B | Cahier des charges V1 | ✅ |
| C | Prototype (HTML/CSS/JS) : dépenses, revenus, tickets, abonnements, bilan et projection de solde | ✅ |
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
  reproductible (dépenses unitaires, tickets, revenus sur 6 mois et
  abonnements) est disponible dans **Réglages → Zone de danger** ; le revenu
  mensuel moyen du jeu est paramétrable sur place. Pour essayer la simulation
  d'un ticket, aller dans **Saisir** et cliquer sur **Simuler un ticket (V2)**.
  La simulation de ticket concerne les dépenses ; le bouton n’apparaît pas pour
  la saisie des revenus ni pendant la modification d’une opération.
  Pour essayer le budget global, saisir un revenu, régler le solde de départ
  et l’horizon dans **Réglages**, puis ajouter un abonnement avec une échéance
  comprise dans cet horizon. Ses prévisions apparaissent au **Bilan** ; elles
  ne deviennent des opérations réelles qu’après confirmation à l’échéance.
