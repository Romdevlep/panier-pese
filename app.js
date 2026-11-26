/* =====================================================================
   Panier Pesé — prototype (phase C) : HTML + CSS + JS, sans dépendance.
   Chaque bloc correspond à une section du cahier des charges ; en phase D
   (Vue 3 + Dexie), chaque bloc deviendra un module. Les données vivent
   dans le localStorage du navigateur, préfixées "pp_".
   ===================================================================== */

// Raccourci : renvoie l'élément du document par son id.
const $ = (id) => document.getElementById(id);

/* ---------- 1. CONSTANTES ---------- */

const CLE_DEPENSES       = 'pp_depenses';
const CLE_CATEGORIES     = 'pp_categories';
const CLE_DERNIER_EXPORT = 'pp_dernier_export';
const CLE_PREF_MOIS      = 'pp_pref_mois';

// Groupes de catégories (fixe dans le prototype — modifiable ici dans le code).
const GROUPES = ['Alimentation', 'Restaurants', 'Vices payés', 'Transport', 'Maison', 'Santé', 'Loisirs', 'Autre'];

// Une couleur par groupe : le point qui aidera à lire les listes d'un coup d'œil.
const COULEURS_GROUPES = {
  'Alimentation': '#43a047',
  'Restaurants':  '#fb8c00',
  'Vices payés':  '#e53935',
  'Transport':    '#1e88e5',
  'Maison':       '#8e24aa',
  'Santé':        '#00acc1',
  'Loisirs':      '#fdd835',
  'Autre':        '#9e9e9e',
};

// Catégories créées au premier lancement (section 3.2 du CDC).
const CATEGORIES_DEPART = [
  { nom: 'Produits bruts',       groupe: 'Alimentation' },
  { nom: 'Ultra-transformés',    groupe: 'Alimentation' },
  { nom: 'Épicerie',             groupe: 'Alimentation' },
  { nom: 'Restaurant',           groupe: 'Restaurants' },
  { nom: 'Fast-food',            groupe: 'Restaurants' },
  { nom: 'Café / bar',           groupe: 'Restaurants' },
  { nom: 'Alcool',               groupe: 'Vices payés' },
  { nom: 'Tabac',                groupe: 'Vices payés' },
  { nom: 'Carburant',            groupe: 'Transport' },
  { nom: 'Transports en commun', groupe: 'Transport' },
  { nom: 'Pharmacie',            groupe: 'Santé' },
  { nom: 'Divers',               groupe: 'Autre' },
];

// Préférence « mois calendaire / glissant ». Défaut : calendaire.
function prefMois() {
  return localStorage.getItem(CLE_PREF_MOIS) === 'glissant' ? 'glissant' : 'calendaire';
};

/* ---------- 2. ÉTAT (les "temp-tables" du prototype) ---------- */

// Convention importante : les montants sont stockés en CENTIMES (entiers),
// comme dans une vraie caisse — l'addition en entiers évite les erreurs
// d'arrondi des nombres à virgule flottante. On convertit à l'affichage.
let depenses   = [];  // { id, date 'AAAA-MM-JJ', montant, categorieId, note, source, creeLe }
let categories = [];  // { id, nom, groupe, archivee }
let categorieChoisie = null; // catégorie présélectionnée dans l'onglet Saisir
let editionEnCours  = null;  // id de la dépense en cours de modification (sinon null)

/* ---------- 3. OUTILS GÉNÉRAUX ---------- */

function nouvelId() {
  // Date.now() garantit l'ordre chronologique, le hasard évite les collisions.
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

// Ajoute un zéro devant si nécessaire : 7 → '07'. Les mois et jours
// doivent tenir sur 2 chiffres pour que les dates 'AAAA-MM-JJ' se
// comparent correctement comme du texte (octobre < novembre).
function pad2(n) { return String(n).padStart(2, '0'); }

// Date du jour au format AAAA-MM-JJ, en heure LOCALE.
function dateLocale(d = new Date()) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// '2026-11' → 'novembre 2026' (le T12:00 évite un décalage de fuseau).
function libelleMois(mois) {
  return new Date(mois + '-01T12:00:00')
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/* ----- Périodes : bornes en chaînes AAAA-MM-JJ, comparées comme du texte ----- */

// Bornes d'un mois calendaire 'AAAA-MM' (le jour 0 d'un mois = son dernier jour).
function bornesMoisCalendaire(mois) {
  const [annee, moisNum] = mois.split('-').map(Number);
  const dernierJour = new Date(annee, moisNum, 0).getDate();
  return { debut: mois + '-01', fin: mois + '-' + pad2(dernierJour) };
}

// Mois glissant : du même jour du mois précédent (inclus) à aujourd'hui.
// Si le mois précédent est plus court (31 → 28/30), on borne à son dernier jour.
function bornesMoisGlignant() {
  const auj = new Date();
  const debut = new Date(auj.getFullYear(), auj.getMonth() - 1, auj.getDate());
  if (debut.getDate() !== auj.getDate()) debut.setDate(0);
  return { debut: dateLocale(debut), fin: dateLocale(auj) };
}

// Bornes du « mois en cours », selon la préférence des Réglages.
function bornesMoisCourant() {
  return prefMois() === 'glissant'
    ? bornesMoisGlignant()
    : bornesMoisCalendaire(dateLocale().slice(0, 7));
}

// Somme des dépenses d'une période.
function totalSurPeriode(bornes) {
  return depenses
    .filter((d) => d.date >= bornes.debut && d.date <= bornes.fin)
    .reduce((somme, d) => somme + d.montant, 0);
}

// Tous les mois de la plus ancienne dépense au mois courant (celui-ci TOUJOURS inclus,
// même sans dépense — exigence du cahier des charges).
function listeMoisDisponibles() {
  const courant = dateLocale().slice(0, 7);
  let plusAncien = courant;
  for (const d of depenses) if (d.date.slice(0, 7) < plusAncien) plusAncien = d.date.slice(0, 7);
  const liste = [];
  let [y, m] = plusAncien.split('-').map(Number);
  const [cy, cm] = courant.split('-').map(Number);
  while (y < cy || (y === cy && m <= cm)) {
    liste.push(y + '-' + pad2(m));
    m++; if (m > 12) { m = 1; y++; }
  }
  return liste;
}

// '6 nov. 2026' — l'année n'apparaît que si différente de l'année courante.
function dateCourte(jour) {
  const d = new Date(jour + 'T12:00:00');
  const texte = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return d.getFullYear() === new Date().getFullYear() ? texte : texte + ' ' + d.getFullYear();
}

// Libellé lisible et transparent : 'du 26 oct. au 26 nov. — 32 j'.
function libellePeriode(b) {
  const nbJours = Math.round(
    (new Date(b.fin + 'T12:00:00') - new Date(b.debut + 'T12:00:00')) / 86400000
  ) + 1;
  return 'du ' + dateCourte(b.debut) + ' au ' + dateCourte(b.fin) + ' — ' + nbJours + ' j';
}

function formaterEuros(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

// '12,50' ou '12.50' → 1250 centimes. Renvoie null si invalide ou nul.
function parseMontant(brut) {
  const n = Number(String(brut).replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// Minuscules, sans accents : rend la recherche tolérante ('intermarche' trouve 'Intermarché').
function normaliser(texte) {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function categorieParId(id) {
  return categories.find((c) => c.id === id);
}

/* ---------- 4. PERSISTANCE (localStorage) ---------- */

function chargerDepuisStockage() {
  try { depenses = JSON.parse(localStorage.getItem(CLE_DEPENSES)) ?? []; }
  catch { depenses = []; }
  try { categories = JSON.parse(localStorage.getItem(CLE_CATEGORIES)) ?? []; }
  catch { categories = []; }

  // Premier lancement : on sème les catégories de départ.
  if (categories.length === 0) {
    categories = CATEGORIES_DEPART.map((c) => ({
      id: nouvelId(), nom: c.nom, groupe: c.groupe, archivee: false,
    }));
  }
}

function sauvegarder() {
  localStorage.setItem(CLE_DEPENSES, JSON.stringify(depenses));
  localStorage.setItem(CLE_CATEGORIES, JSON.stringify(categories));
}

/* ---------- 5. TOAST (message éphémère en bas d'écran) ---------- */

let minuterieToast = null;
function montrerToast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => t.classList.remove('visible'), 2200);
}

/* ---------- 6. NAVIGATION PAR ONGLETS ---------- */

function afficherOnglet(nom) {
  // Marque le bouton actif, montre la section correspondante.
  for (const bouton of document.querySelectorAll('nav button')) {
    bouton.classList.toggle('actif', bouton.dataset.onglet === nom);
  }
  for (const section of document.querySelectorAll('main > section')) {
    section.hidden = section.id !== 'onglet-' + nom;
  }
  // Chaque onglet recharge son contenu à l'entrée (donc toujours à jour).
  if (nom === 'historique') rendreHistorique();
  if (nom === 'bilan')      rendreBilan();
  if (nom === 'reglages')   rendreReglages();
}

/* ---------- 7. ONGLET SAISIR ---------- */

// Les catégories les plus utilisées ces 2 derniers mois → les chips express.
function categoriesTrieesUtilisation() {
  const borne = new Date();
  borne.setMonth(borne.getMonth() - 2);
  const borneStr = dateLocale(borne);
  const compteur = new Map();
  for (const d of depenses) {
    if (d.date >= borneStr) compteur.set(d.categorieId, (compteur.get(d.categorieId) ?? 0) + 1);
  }
  const actives = categories.filter((c) => !c.archivee);
  actives.sort((a, b) => (compteur.get(b.id) ?? 0) - (compteur.get(a.id) ?? 0));
  return actives;
}

function rendreChips() {
  const conteneur = $('chips-categories');
  conteneur.innerHTML = '';
  for (const cat of categoriesTrieesUtilisation().slice(0, 5)) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'chip' + (categorieChoisie === cat.id ? ' choisie' : '');
    bouton.textContent = cat.nom;
    bouton.addEventListener('click', () => {
      categorieChoisie = cat.id;
      $('champ-categorie').value = cat.id;
      rendreChips();
    });
    conteneur.appendChild(bouton);
  }
}

// Remplit le <select> : un <optgroup> par groupe de catégories.
function peuplerSelectCategories() {
  const select = $('champ-categorie');
  select.innerHTML = '';
  select.appendChild(new Option('— choisir une catégorie —', ''));
  const actives = categories.filter((c) => !c.archivee);
  for (const groupe of GROUPES) {
    const duGroupe = actives.filter((c) => c.groupe === groupe);
    if (duGroupe.length === 0) continue;
    const og = document.createElement('optgroup');
    og.label = groupe;
    for (const c of duGroupe) og.appendChild(new Option(c.nom, c.id));
    select.appendChild(og);
  }
  // Cas rare : on modifie une dépense pointant vers une catégorie archivée.
  if (categorieChoisie && !actives.some((c) => c.id === categorieChoisie)) {
    const c = categorieParId(categorieChoisie);
    if (c) select.appendChild(new Option(c.nom + ' (archivée)', c.id));
  }
  if (categorieChoisie) select.value = categorieChoisie;
}

// Remet le formulaire "neuf" (sans toucher à la catégorie choisie :
// on enchaîne souvent plusieurs achats de la même catégorie).
function terminerEdition(avecFocus) {
  editionEnCours = null;
  $('champ-id').value = '';
  $('champ-montant').value = '';
  $('champ-note').value = '';
  $('champ-date').value = dateLocale();
  $('bouton-valider').textContent = 'Ajouter la dépense';
  $('bouton-annuler').hidden = true;
  if (avecFocus) $('champ-montant').focus();
}

// Préremplit le formulaire pour modifier une dépense existante.
function modifierDepense(id) {
  const d = depenses.find((x) => x.id === id);
  if (!d) return;
  editionEnCours = id;
  categorieChoisie = d.categorieId;
  peuplerSelectCategories();
  $('champ-id').value = id;
  $('champ-montant').value = (d.montant / 100).toFixed(2);
  $('champ-date').value = d.date;
  $('champ-note').value = d.note || '';
  $('champ-categorie').value = d.categorieId;
  $('bouton-valider').textContent = 'Enregistrer la modification';
  $('bouton-annuler').hidden = false;
  afficherOnglet('saisir');
}

// Total affiché sous le titre : suit la préférence calendaire / glissant.
function afficherTotalMois() {
  let label;
  if (prefMois() === 'glissant') {
    label = 'Mois glissant';
  } else {
    const l = libelleMois(dateLocale().slice(0, 7));
    label = l.charAt(0).toUpperCase() + l.slice(1);
  }
  $('total-mois').textContent = label + ' : ' + formaterEuros(totalSurPeriode(bornesMoisCourant()));
}

/* ---------- 8. ONGLET HISTORIQUE ---------- */

// On assemble chaque ligne par createElement + textContent — jamais
// innerHTML avec des données utilisateur (règle de sécurité).
function construireLigneDepense(d) {
  const cat = categorieParId(d.categorieId);
  const nomCat = cat ? cat.nom : '(catégorie supprimée)';
  const couleur = cat ? (COULEURS_GROUPES[cat.groupe] || '#9e9e9e') : '#9e9e9e';

  const ligne = document.createElement('div');
  ligne.className = 'ligne-depense';

  const point = document.createElement('span');
  point.className = 'point';
  point.style.background = couleur;

  const quoi = document.createElement('div');
  quoi.className = 'quoi';
  const nom = document.createElement('span');
  nom.textContent = nomCat;
  const jour = new Date(d.date + 'T12:00:00')
    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  const info = document.createElement('small');
  info.textContent = jour + (d.note ? ' · ' + d.note : '');
  quoi.appendChild(nom);
  quoi.appendChild(info);

  const montant = document.createElement('span');
  montant.className = 'montant';
  montant.textContent = formaterEuros(d.montant);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const boutonModif = document.createElement('button');
  boutonModif.textContent = '✏️';
  boutonModif.title = 'Modifier';
  boutonModif.addEventListener('click', () => modifierDepense(d.id));
  const boutonSuppr = document.createElement('button');
  boutonSuppr.textContent = '🗑️';
  boutonSuppr.title = 'Supprimer';
  boutonSuppr.addEventListener('click', () => supprimerDepense(d.id));
  actions.appendChild(boutonModif);
  actions.appendChild(boutonSuppr);

  ligne.appendChild(point);
  ligne.appendChild(quoi);
  ligne.appendChild(montant);
  ligne.appendChild(actions);
  return ligne;
}

function rendreHistorique() {
  const recherche = normaliser($('champ-recherche').value);
  const conteneur = $('liste-depenses');
  conteneur.innerHTML = '';

  // Tri : date décroissante, puis heure de création décroissante.
  const trie = [...depenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe)
  );

  let moisCourant = null;
  let trouvees = 0;
  for (const d of trie) {
    const cat = categorieParId(d.categorieId);
    const nomCat = cat ? cat.nom : '';
    if (recherche && !normaliser(nomCat + ' ' + (d.note || '')).includes(recherche)) continue;
    trouvees++;
    // Un titre par mois, inséré au changement de mois.
    const mois = d.date.slice(0, 7);
    if (mois !== moisCourant) {
      moisCourant = mois;
      const titre = document.createElement('h3');
      titre.className = 'titre-mois';
      titre.textContent = libelleMois(mois);
      conteneur.appendChild(titre);
    }
    conteneur.appendChild(construireLigneDepense(d));
  }
  if (trouvees === 0) {
    conteneur.innerHTML = '<p class="vide">Aucune dépense' +
      (recherche ? ' pour cette recherche' : '') + '.</p>';
  }
}

function supprimerDepense(id) {
  if (!confirm('Supprimer cette dépense ?')) return;
  depenses = depenses.filter((d) => d.id !== id);
  sauvegarder();
  afficherTotalMois();
  rendreHistorique();
  montrerToast('Dépense supprimée');
}

/* ---------- 9. ONGLET BILAN ---------- */

// Une carte = titre + barres horizontales (CSS pur, pas de bibliothèque).
function construireCarteBarres(titre, lignes) {
  const carte = document.createElement('div');
  carte.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = titre;
  carte.appendChild(h2);

  const maxi = Math.max(...lignes.map((l) => l.cents), 1);
  for (const l of lignes) {
    const bloc = document.createElement('div');
    bloc.className = 'bilan-ligne';

    const li = document.createElement('div');
    li.className = 'bilan-libelle';
    const gauche = document.createElement('span');
    gauche.textContent = (l.point ? '● ' : '') + l.libelle;
    if (l.couleur) gauche.style.color = l.couleur;
    const droit = document.createElement('span');
    droit.textContent = l.complement || formaterEuros(l.cents);
    gauche.style.color = ''; // le libellé reprend la couleur par défaut du texte
    if (l.point && l.couleur) gauche.innerHTML = '<span style="color:' + l.couleur + '">●</span> ' + l.libelle;
    li.appendChild(gauche);
    li.appendChild(droit);

    const barre = document.createElement('div');
    barre.className = 'barre';
    const remplie = document.createElement('div');
    remplie.className = 'barre-remplie';
    remplie.style.width = Math.max(Math.round((l.cents / maxi) * 100), 2) + '%';
    if (l.couleur) remplie.style.background = l.couleur;
    barre.appendChild(remplie);

    bloc.appendChild(li);
    bloc.appendChild(barre);
    carte.appendChild(bloc);
  }
  return carte;
}

/* ----- État de la vue Bilan (non persisté : « Ce mois-ci » par défaut) ----- */
let bilanMode    = 'mois-courant';             // 'mois-courant' | 'un-mois' | 'plage' | 'tout'
let bilanMois    = dateLocale().slice(0, 7);   // sélecteur « un mois »
let bilanMoisDeb = dateLocale().slice(0, 7);   // sélecteur « plage » début
let bilanMoisFin = dateLocale().slice(0, 7);   // sélecteur « plage » fin

// Bornes effectivement utilisées selon le mode.
function bornesBilan() {
  switch (bilanMode) {
    case 'un-mois': return bornesMoisCalendaire(bilanMois); // un mois précis = TOUJOURS calendaire
    case 'plage':   return { debut: bilanMoisDeb + '-01', fin: bornesMoisCalendaire(bilanMoisFin).fin };
    case 'tout': {
      // Plus ancienne dépense → aujourd'hui (ou juste aujourd'hui si vide).
      let debut = dateLocale();
      for (const d of depenses) if (d.date < debut) debut = d.date;
      return { debut, fin: dateLocale() };
    }
    default:        return bornesMoisCourant(); // « Ce mois-ci » suit la préférence
  }
}

function titrePeriodeBilan() {
  switch (bilanMode) {
    case 'un-mois': {
      const l = libelleMois(bilanMois);
      return l.charAt(0).toUpperCase() + l.slice(1);
    }
    case 'plage':   return 'Période choisie';
    case 'tout':    return 'Depuis le début';
    default:        return prefMois() === 'glissant' ? 'Mois glissant' : 'Ce mois-ci';
  }
}

// Remplit les trois <select> de mois ; le mois courant y figure toujours.
function peuplerSelectsBilan() {
  const mois = listeMoisDisponibles();
  const remplir = (select, valeur) => {
    select.innerHTML = '';
    for (const m of mois) {
      const l = libelleMois(m);
      select.appendChild(new Option(l.charAt(0).toUpperCase() + l.slice(1), m));
    }
    select.value = valeur;
  };
  remplir($('select-bilan-mois'),  bilanMois);
  remplir($('select-bilan-debut'), bilanMoisDeb);
  remplir($('select-bilan-fin'),   bilanMoisFin);
}

function rendreBilan() {
  peuplerSelectsBilan(); // les mois disponibles peuvent avoir grandi (première dépense ancienne)

  // Affiche le sous-formulaire du mode actif seulement.
  $('choix-un-mois').hidden = bilanMode !== 'un-mois';
  $('choix-plage').hidden   = bilanMode !== 'plage';

  const b = bornesBilan();
  $('libelle-periode').textContent = libellePeriode(b);

  const conteneur = $('bilan-contenu');
  conteneur.innerHTML = '';
  const total = totalSurPeriode(b);

  // — Carte du total sur la période.
  const carteTotal = document.createElement('div');
  carteTotal.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = titrePeriodeBilan();
  const totalP = document.createElement('p');
  totalP.style.cssText = 'font-size:1.6rem;font-weight:700;margin:4px 0;color:var(--vert)';
  totalP.textContent = formaterEuros(total);
  carteTotal.appendChild(h2);
  carteTotal.appendChild(totalP);
  conteneur.appendChild(carteTotal);

  if (total === 0) {
    const vide = document.createElement('div');
    vide.className = 'carte';
    vide.innerHTML = '<p class="vide">Aucune dépense sur cette période.</p>';
    conteneur.appendChild(vide);
    return;
  }

  // — Répartition par catégorie sur la période choisie.
  const parCategorie = new Map();
  for (const d of depenses) {
    if (d.date >= b.debut && d.date <= b.fin) {
      parCategorie.set(d.categorieId, (parCategorie.get(d.categorieId) ?? 0) + d.montant);
    }
  }
  const lignes = [...parCategorie.entries()]
    .map(([id, cents]) => {
      const cat = categorieParId(id);
      return {
        libelle: cat ? cat.nom : '(catégorie supprimée)',
        couleur: cat ? (COULEURS_GROUPES[cat.groupe] || '#9e9e9e') : '#9e9e9e',
        cents,
        complement: formaterEuros(cents) + ' (' + Math.round((cents / total) * 100) + '%)',
      };
    })
    .sort((a, x) => x.cents - a.cents);
  conteneur.appendChild(construireCarteBarres('Répartition par catégorie', lignes));

  // — Évolution 6 mois : vue de tendance, toujours en MOIS CALENDARIRES,
  //   ancrée sur aujourd'hui (indépendante de la période sélectionnée).
  const moisCalendaire = dateLocale().slice(0, 7);
  const sixMois = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    sixMois.push(dateLocale(d).slice(0, 7));
  }
  const lignesMois = sixMois.map((m) => ({
    libelle: new Date(m + '-01T12:00:00')
      .toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    couleur: m === moisCalendaire ? '#2e7d32' : '#a5c8a7',
    cents: depenses
      .filter((d) => d.date.slice(0, 7) === m)
      .reduce((somme, d) => somme + d.montant, 0),
  }));
  conteneur.appendChild(construireCarteBarres('Évolution (6 mois)', lignesMois));
}

/* ---------- 10. ONGLET RÉGLAGES : CATÉGORIES ---------- */

function construireLigneCategorie(c) {
  const ligne = document.createElement('div');
  ligne.className = 'categorie-ligne' + (c.archivee ? ' archivee' : '');

  const point = document.createElement('span');
  point.className = 'point';
  point.style.background = COULEURS_GROUPES[c.groupe] || '#9e9e9e';

  const etiquette = document.createElement('span');
  etiquette.textContent = c.nom;

  ligne.appendChild(point);
  ligne.appendChild(etiquette);

  if (c.archivee) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'archivée';
    ligne.appendChild(tag);
  }

  const boutons = document.createElement('div');
  boutons.className = 'boutons';

  // Renommer (version prototype : prompt() ; on soignera l'écran en phase D).
  const boutonModif = document.createElement('button');
  boutonModif.textContent = '✏️';
  boutonModif.title = 'Renommer';
  boutonModif.addEventListener('click', () => {
    const nouveau = (prompt('Nouveau nom :', c.nom) || '').trim();
    if (!nouveau) return;
    const doublon = categories.some(
      (x) => x.id !== c.id && normaliser(x.nom) === normaliser(nouveau)
    );
    if (doublon) { alert('Une catégorie porte déjà ce nom.'); return; }
    c.nom = nouveau;
    sauvegarder();
    peuplerSelectCategories();
    rendreChips();
    rendreReglages();
  });
  boutons.appendChild(boutonModif);

  // Archiver plutôt que supprimer : l'historique reste cohérent.
  const boutonArchive = document.createElement('button');
  boutonArchive.textContent = c.archivee ? '↩️' : '📦';
  boutonArchive.title = c.archivee ? 'Désarchiver' : 'Archiver';
  boutonArchive.addEventListener('click', () => {
    c.archivee = !c.archivee;
    sauvegarder();
    peuplerSelectCategories();
    rendreChips();
    rendreReglages();
  });
  boutons.appendChild(boutonArchive);

  // Suppression réservée aux catégories jamais utilisées.
  const boutonSuppr = document.createElement('button');
  boutonSuppr.textContent = '🗑️';
  boutonSuppr.title = 'Supprimer définitivement';
  boutonSuppr.addEventListener('click', () => {
    const utilisee = depenses.filter((d) => d.categorieId === c.id).length;
    if (utilisee > 0) {
      alert('Cette catégorie est utilisée par ' + utilisee + ' dépense(s). Archive-la plutôt.');
      return;
    }
    if (!confirm('Supprimer définitivement « ' + c.nom + ' » ?')) return;
    categories = categories.filter((x) => x.id !== c.id);
    if (categorieChoisie === c.id) categorieChoisie = null;
    sauvegarder();
    peuplerSelectCategories();
    rendreChips();
    rendreReglages();
  });
  boutons.appendChild(boutonSuppr);

  ligne.appendChild(boutons);
  return ligne;
}

function rendreReglages() {
  const conteneur = $('liste-categories');
  conteneur.innerHTML = '';
  // Un bloc par groupe, dans l'ordre défini par la constante GROUPES.
  for (const groupe of GROUPES) {
    const duGroupe = categories.filter((c) => c.groupe === groupe);
    if (duGroupe.length === 0) continue;
    const titre = document.createElement('h3');
    titre.textContent = groupe;
    conteneur.appendChild(titre);
    for (const c of duGroupe) conteneur.appendChild(construireLigneCategorie(c));
  }
  rendreInfoExport();
}

/* ---------- 11. SAUVEGARDE / RESTAURATION (export · import) ---------- */

// Crée un lien de téléchargement en mémoire, clique dessus,然后 le libère.
function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function rendreInfoExport() {
  const dernier = localStorage.getItem(CLE_DERNIER_EXPORT);
  $('info-export').textContent =
    (dernier ? 'Dernière sauvegarde : ' + dernier + '. ' : 'Aucune sauvegarde effectuée. ') +
    'Les données vivent uniquement dans CE navigateur : pense à exporter régulièrement.';
}

function exporterJSON() {
  const contenu = {
    application: 'Panier Pesé',
    version: 1,
    exporteLe: new Date().toISOString(),
    categories,
    depenses,
  };
  telecharger(
    new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' }),
    'panier-pese-' + dateLocale() + '.json'
  );
  localStorage.setItem(CLE_DERNIER_EXPORT, dateLocale());
  rendreInfoExport();
  montrerToast('Export JSON téléchargé ✔');
}

function exporterCSV() {
  // Sémicolons + virgule décimale + BOM UTF-8 : c'est la combinaison que
  // Excel FR ouvre proprement en double-cliquant le fichier.
  const lignes = ['Date;Montant (€);Groupe;Catégorie;Note'];
  const trie = [...depenses].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of trie) {
    const cat = categorieParId(d.categorieId);
    lignes.push([
      d.date,
      (d.montant / 100).toFixed(2).replace('.', ','),
      cat ? cat.groupe : '',
      cat ? cat.nom : '(supprimée)',
      (d.note || '').replaceAll(';', ','),
    ].join(';'));
  }
  telecharger(
    new Blob(['\ufeff' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    'panier-pese-' + dateLocale() + '.csv'
  );
  montrerToast('Export CSV téléchargé ✔');
}

async function importerJSON(fichier) {
  try {
    const donnees = JSON.parse(await fichier.text());
    if (!Array.isArray(donnees.categories) || !Array.isArray(donnees.depenses)) {
      throw new Error('format inattendu');
    }
    // Contrôle léger : chaque dépense doit avoir une date et un montant entier.
    const depensesValides = donnees.depenses.filter(
      (d) => d && typeof d.date === 'string' && typeof d.montant === 'number'
    );
    if (!confirm('Remplacer les données actuelles par celles du fichier ?\n(' +
        depensesValides.length + ' dépenses à importer)')) return;
    categories = donnees.categories;
    depenses = depensesValides;
    sauvegarder();
    rafraichirTout();
    montrerToast('Import réussi : ' + depenses.length + ' dépenses ✔');
  } catch {
    alert('Fichier illisible ou format inattendu.');
  }
}

/* =====================================================================
   11-bis. JEU DE DONNÉES DE TEST
   Outils de développement — À RETIRER en version finale (ne pas porter
   cette section en phase D). Marqués en base par source: 'test'.
   ===================================================================== */

// Générateur pseudo-aléatoire à graine : chaque installation produit
// EXACTEMENT le même jeu de données (utile pour comparer deux exports).
// Change 20261126 → tu obtiens un autre jeu, également reproductible.
function rngDepuisGraine(entier) {
  let etat = entier;
  return function () {
    etat |= 0;
    etat = (etat + 0x6D2B79F5) | 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Profils d'achat : poids (fréquence), fourchette de prix (€), notes
// plausibles — avec accents, pour tester la recherche insensible
// aux accents ('intermarche' doit trouver 'Intermarché').
const PROFILS_TEST = [
  { nom: 'Produits bruts',    poids: 26, min: 2,   max: 15, notes: ['Marché du samedi', 'Primeur', 'Boucherie du centre'] },
  { nom: 'Ultra-transformés', poids: 22, min: 1.5, max: 12, notes: ['Intermarché', 'Carrefour City', 'Lidl'] },
  { nom: 'Épicerie',          poids: 16, min: 5,   max: 40, notes: ['Courses du mois', 'Grand Frais', 'Super U'] },
  { nom: 'Restaurant',        poids: 7,  min: 15,  max: 60, notes: ['Le Comptoir', 'Pizzeria du coin', 'Brasserie du théâtre'] },
  { nom: 'Fast-food',         poids: 5,  min: 6,   max: 18, notes: ['McDonald’s', 'Burger King', 'O’Tacos'] },
  { nom: 'Café / bar',        poids: 4,  min: 2,   max: 9,  notes: ['Café de la place', 'Bar de la gare'] },
  { nom: 'Alcool',            poids: 4,  min: 3,   max: 25, notes: ['Caves du centre', 'Brasserie locale'] },
  { nom: 'Tabac',             poids: 7,  min: 7,   max: 12, notes: ['Bureau de tabac', 'Tabac presse de la mairie'] },
  { nom: 'Carburant',         poids: 4,  min: 30,  max: 90, notes: ['Total Énergies', 'Avia'] },
  { nom: 'Transports en commun', poids: 5, min: 2, max: 15, notes: ['Réseau urbain', 'SNCF'] },
  { nom: 'Pharmacie',         poids: 3,  min: 4,   max: 45, notes: ['Pharmacie Centrale'] },
  { nom: 'Loisirs',           poids: 3,  min: 5,   max: 30, notes: ['Cinéma Le Palace', 'Médiathèque'] },
  { nom: 'Maison',            poids: 2,  min: 8,   max: 70, notes: ['Bricolage', 'Jardinerie'] },
  { nom: 'Divers',            poids: 2,  min: 3,   max: 50, notes: [] },
];

function installerJeuDeTest() {
  if (!confirm('Installer le jeu de test ?\n\nEfface d’abord TOUTES les données actuelles (dépenses + catégories), puis installe ~150 dépenses fictives sur 6 mois.')) return;

  // 1. Table rase (mêmes clés que la réinitialisation complète).
  localStorage.removeItem(CLE_DEPENSES);
  localStorage.removeItem(CLE_CATEGORIES);
  localStorage.removeItem(CLE_DERNIER_EXPORT);
  chargerDepuisStockage();      // recrée les catégories de départ
  categorieChoisie = null;

  const rng = rngDepuisGraine(20261126);
  const totalPoids = PROFILS_TEST.reduce((s, p) => s + p.poids, 0);

  // Choix pondéré d'un profil : le tirage respecte les poids.
  const piocherProfil = () => {
    let r = rng() * totalPoids;
    for (const p of PROFILS_TEST) { r -= p.poids; if (r < 0) return p; }
    return PROFILS_TEST[0];
  };
  const profilParNom = (nom) => PROFILS_TEST.find((p) => p.nom === nom) || PROFILS_TEST[0];

  // Résolution : nom de profil → id de catégorie réelle.
  // (Si la catégorie a été renommée ou supprimée : repli sur une catégorie active.)
  const idCategorie = () => {
    const p = piocherProfil();
    const c = categories.find((x) => x.nom === p.nom && !x.archivee)
           || categories.find((x) => !x.archivee);
    return { profil: p, categorieId: c ? c.id : null };
  };

  // Une dépense fait au plus 4 chiffres : montants en centimes, comme en vrai.
  const centimes = (p) => Math.round((p.min + rng() * (p.max - p.min)) * 100);
  const creer = (quand, heure, minute) => {
    const { profil, categorieId } = idCategorie();
    const notes = profil.notes;
    return {
      id: nouvelId(),
      date: dateLocale(quand),
      montant: centimes(profil),
      categorieId,
      // 15 % sans note : ce cas doit exister dans les données aussi.
      note: (notes.length && rng() > 0.15) ? notes[Math.floor(rng() * notes.length)] : '',
      source: 'test',
      creeLe: new Date(quand.getFullYear(), quand.getMonth(), quand.getDate(), heure, minute).toISOString(),
    };
  };

  // 2. Six mois d'historique : plus dense à mesure qu'on approche d'aujourd'hui.
  const AUJOURDHUI = new Date();
  const COMPTES = [34, 30, 26, 22, 18, 14]; // mois courant → 5 mois en arrière
  for (let i = 0; i < COMPTES.length; i++) {
    const premier = new Date(AUJOURDHUI.getFullYear(), AUJOURDHUI.getMonth() - i, 1);
    const dernierJour = (i === 0)
      ? AUJOURDHUI.getDate()                                   // mois en cours : pas de futur
      : new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
    for (let n = 0; n < COMPTES[i]; n++) {
      const jour = 1 + Math.floor(rng() * dernierJour);
      depenses.push(creer(
        new Date(premier.getFullYear(), premier.getMonth(), jour),
        8 + Math.floor(rng() * 13), Math.floor(rng() * 60)      // entre 8h et 20h
      ));
    }
  }

  // 3. Un cas délibéré : deux achats le même jour, à 4 minutes d'écart —
  //    vérifie le tri intra-journée de l'historique (12:07 doit précéder 12:03).
  const hier = new Date(AUJOURDHUI); hier.setDate(hier.getDate() - 1);
  depenses.push(creer(hier, 12, 3));
  depenses.push(creer(hier, 12, 7));

  sauvegarder();
  rafraichirTout();
  afficherOnglet('historique');
  montrerToast(depenses.length + ' dépenses de test installées ✔');
}

// Retire UNIQUEMENT les enregistrements marqués source: 'test' :
// les vraies données éventuelles sont préservées.
function purgerDonneesTest() {
  const avant = depenses.length;
  depenses = depenses.filter((d) => d.source !== 'test');
  if (avant === depenses.length) { montrerToast('Aucune donnée de test à retirer'); return; }
  sauvegarder();
  afficherTotalMois();
  rendreHistorique();
  rendreBilan();
  montrerToast((avant - depenses.length) + ' dépenses de test retirées');
}

/* ====== fin outils de test — À RETIRER ====== */

/* =====================================================================
   11-ter. SIMULATION TICKET (V2) — À ADAPTER en V2, pas à retirer :
   l'écran de validation ci-dessous est celui qui recevra les lignes OCR.
   Le générateur de fausses lignes + le faux moteur disparaîtront alors,
   remplacés par l'OCR réel.
   ===================================================================== */

// Tickets fantômes : des libellés FORMAT TICKET (majuscules, troncatures,
// unités collées) pour se rapprocher de ce que_cracha l'OCR.
const TICKETS_SIMU = [
  { magasin: 'INTERMARCHE', lignes: [
    ['POMMES GALA 1,5KG', 320], ['RADIS X1 BOTTE', 115], ['CAROTTES 1KG', 140],
    ['RAVIOLIS BOL 400G', 245], ['CHOCOLAT NOIR 100G', 180], ['EAU 6X1,5L', 290],
    ['VIN ROUGE BORDEAUX', 560], ['SAC PLASTIQUE', 5],
  ]},
  { magasin: 'MARCHE DU SAMEDI', lignes: [
    ['TOMATES GRAPPE 1KG', 340], ['FROMAGE CHEVRE X1', 420],
    ['BOEUF BOURGUIGNON 2', 840], ['PAIN CAMPAGNE', 210],
  ]},
  { magasin: 'BUREAU DE TABAC', lignes: [
    ['CIGARETTES ROUGES X20', 1160], ['BRIQUET X1', 130], ['JOURNAL', 220],
  ]},
];

// Faux moteur : règles mot→catégorie (ce sera le vrai moteur par mots-clés
// en V2 — même structure). Deux pièges VOLONTAIRES pour tester le
// glisser-déposer et l'ajout de catégorie : VIN chez les ultra-transformés,
// CIGARETTES chez Divers, et SAC sans aucune règle.
const REGLES_SIMU = [
  { mot: 'POMMES|TOMATES|CAROTTES|RADIS|PAIN|BOEUF|CHEVRE', cat: 'Produits bruts' },
  { mot: 'RAVIOLIS|CHOCOLAT|EAU',                           cat: 'Ultra-transformés' },
  { mot: 'VIN',                                             cat: 'Ultra-transformés' }, // piège n°1
  { mot: 'CIGARETTES',                                      cat: 'Divers' },           // piège n°2
];

let simuLignes = [];   // { id, label, cents, catId | null }
let simuMagasin = '';

// Choisit un ticket au hasard et le "passe au moteur" : règles puis rien.
function genererTicketSimule() {
  const t = TICKETS_SIMU[Math.floor(Math.random() * TICKETS_SIMU.length)];
  simuMagasin = t.magasin;
  simuLignes = t.lignes.map(([label, cents]) => {
    let catId = null; // pas reconnu par défaut → bac « Non catégorisé »
    const regle = REGLES_SIMU.find((r) =>
      new RegExp(r.mot).test(label)
      && categories.some((c) => c.nom === r.cat)
    );
    if (regle) {
      const c = categories.find((x) => x.nom === regle.cat);
      if (c) catId = c.id;
    }
    return { id: nouvelId(), label, cents, catId };
  });
}

// Construit tous les groupes de dépôt (dont le bac « Non catégorisé »),
// puis rend leur contenu. Chaque zone porte data-cat-id ('' = le bac).
function rendreSimulation() {
  const conteneur = $('simu-groupes');
  conteneur.innerHTML = '';
  $('simu-titre').textContent = 'Ticket : ' + simuMagasin;

  const zones = [];
  zones.push({ id: '', nom: '❓ Non catégorisé' });
  for (const cat of categories.filter((c) => !c.archivee)) {
    zones.push({ id: cat.id, nom: cat.nom, couleur: COULEURS_GROUPES[cat.groupe] || '#9e9e9e' });
  }

  for (const zone of zones) {
    const lignesZone = simuLignes.filter((l) => (l.catId ?? '') === zone.id);
    // On affiche toujours le bac vide (utile pour y redéposer), mais on
    // masque les catégories vides pour garder l'écran lisible.
    if (zone.id !== '' && lignesZone.length === 0) continue;

    const groupe = document.createElement('div');
    groupe.className = 'simu-groupe';
    groupe.dataset.catId = zone.id;

    const titre = document.createElement('h3');
    titre.textContent = (zone.couleur ? '● ' : '') + zone.nom +
      (lignesZone.length ? ' — ' + formaterEuros(lignesZone.reduce((s, l) => s + l.cents, 0)) : '');
    if (zone.couleur) {
      const dot = document.createElement('span');
      dot.style.color = zone.couleur;
      dot.textContent = '● ';
      titre.prepend(dot);
    }
    groupe.appendChild(titre);

    for (const l of lignesZone) {
      const ligne = document.createElement('div');
      ligne.className = 'simu-ligne';
      const gauche = document.createElement('span');
      gauche.textContent = l.label;
      const prix = document.createElement('strong');
      prix.textContent = formaterEuros(l.cents);
      ligne.appendChild(gauche);
      ligne.appendChild(prix);
      rendreLigneDeplacable(l, ligne, ligne);
      groupe.appendChild(ligne);
    }
    conteneur.appendChild(groupe);
  }
}

// Glisser-déposer aux Pointer Events : marche à la souris COMPTE au doigt.
// On traîne la vraie ligne (pas un clone), et on relâche sur la zone
// trouvée sous le doigt via elementFromPoint.
function rendreLigneDeplacable(l, el) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const departX = e.clientX, departY = e.clientY;
    let dest = null;

    // Pendant le déplacement, la ligne ne doit pas "manger" le point :
    // sinon elementFromPoint la renvoie elle-même, jamais la zone.
    el.style.pointerEvents = 'none';
    el.classList.add('drag');
    el.setPointerCapture(e.pointerId);

    const bouger = (ev) => {
      el.style.transform =
        'translate(' + (ev.clientX - departX) + 'px,' + (ev.clientY - departY) + 'px)';
      const cible = document.elementFromPoint(ev.clientX, ev.clientY);
      dest = cible ? cible.closest('.simu-groupe') : null;
      document.querySelectorAll('.simu-groupe')
        .forEach((z) => z.classList.toggle('survol', z === dest));
    };
    const finir = (ev) => {
      el.removeEventListener('pointermove', bouger);
      el.removeEventListener('pointerup', finir);
      el.removeEventListener('pointercancel', finir);
      el.style.pointerEvents = '';
      el.classList.remove('drag');
      el.style.transform = '';
      document.querySelectorAll('.simu-groupe')
        .forEach((z) => z.classList.remove('survol'));
      if (dest && dest.dataset) {
        l.catId = dest.dataset.catId === '' ? null : dest.dataset.catId;
        rendreSimulation(); // recalcule les groupes (les vides s'effacent)
      }
    };
    el.addEventListener('pointermove', bouger);
    el.addEventListener('pointerup', finir);
    el.addEventListener('pointercancel', finir);
  });
}

// Validation : agrège les lignes par catégorie en dépenses réelles
// (une dépense par catégorie — cf. ta décision produit), ignore le bac.
function validerTicketSimule() {
  const restantes = simuLignes.filter((l) => l.catId === null).length;
  if (restantes > 0 &&
      !confirm(restantes + ' ligne(s) non catégorisée(s) seront ignorées. Continuer ?')) return;

  const totaux = new Map();
  for (const l of simuLignes) {
    if (l.catId) totaux.set(l.catId, (totaux.get(l.catId) ?? 0) + l.cents);
  }
  const aujourdhui = dateLocale();
  let nb = 0;
  for (const [categorieId, cents] of totaux) {
    depenses.push({
      id: nouvelId(), date: aujourdhui, montant: cents,
      categorieId, note: simuMagasin, source: 'test', creeLe: new Date().toISOString(),
    });
    nb++;
  }
  sauvegarder();
  simuLignes = [];
  rafraichirTout();
  montrerToast('Ticket enregistré : ' + nb + ' dépense(s) ✔');
  afficherOnglet('historique');
}

/* ====== fin simulation ticket ====== */

/* ---------- 12. DÉMARRAGE : câblage des événements + premier rendu ---------- */

function rafraichirTout() {
  peuplerSelectCategories();
  rendreChips();
  afficherTotalMois();
  rendreHistorique();
  rendreBilan();
  rendreReglages();
}

function demarrer() {

  // — Navigation
  for (const bouton of document.querySelectorAll('nav button')) {
    bouton.addEventListener('click', () => afficherOnglet(bouton.dataset.onglet));
  }

  // — Saisie
  $('form-depense').addEventListener('submit', (e) => {
    e.preventDefault(); // on gère nous-mêmes l'envoi (pas de reload de page)
    const centimes = parseMontant($('champ-montant').value);
    if (centimes === null) { alert('Saisis un montant valide (ex. 12,50).'); return; }
    const categorieId = $('champ-categorie').value;
    if (!categorieId) { alert('Choisis une catégorie.'); return; }
    const date = $('champ-date').value || dateLocale();
    const note = $('champ-note').value.trim();

    if (editionEnCours) {
      // --- Modification
      const d = depenses.find((x) => x.id === editionEnCours);
      if (d) { d.date = date; d.montant = centimes; d.categorieId = categorieId; d.note = note; }
      sauvegarder();
      afficherTotalMois();
      terminerEdition(false);
      montrerToast('Dépense modifiée ✔');
      afficherOnglet('historique');
    } else {
      // --- Création
      depenses.push({
        id: nouvelId(), date, montant: centimes,
        categorieId, note, source: 'manuelle', creeLe: new Date().toISOString(),
      });
      sauvegarder();
      categorieChoisie = categorieId; // conserve la catégorie pour la saisie suivante
      afficherTotalMois();
      terminerEdition(true);
      rendreChips();
      montrerToast(formaterEuros(centimes) + ' dans ' + categorieParId(categorieId).nom + ' ✔');
    }
  });
  $('bouton-annuler').addEventListener('click', () => terminerEdition(true));

  // — Historique : la recherche refiltre à chaque frappe.
  $('champ-recherche').addEventListener('input', rendreHistorique);

  // — Réglages : formulaire d'ajout de catégorie
  for (const groupe of GROUPES) $('champ-groupe-categorie').appendChild(new Option(groupe, groupe));
  $('form-categorie').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = $('champ-nom-categorie').value.trim();
    if (!nom) return;
    const doublon = categories.some((c) => normaliser(c.nom) === normaliser(nom));
    if (doublon) { alert('Une catégorie porte déjà ce nom.'); return; }
    categories.push({
      id: nouvelId(),
      nom,
      groupe: $('champ-groupe-categorie').value,
      archivee: false,
    });
    sauvegarder();
    $('champ-nom-categorie').value = '';
    peuplerSelectCategories();
    rendreChips();
    rendreReglages();
    montrerToast('Catégorie ajoutée ✔');
  });

  // — Sauvegarde / restauration
  $('bouton-export-json').addEventListener('click', exporterJSON);
  $('bouton-export-csv').addEventListener('click', exporterCSV);
  $('champ-import').addEventListener('change', function () {
    const fichier = this.files[0];
    if (fichier) importerJSON(fichier);
    this.value = ''; // permet de réimporter le même fichier ensuite
  });
  $('bouton-reinit').addEventListener('click', () => {
    if (!confirm('Effacer TOUTES les données de ce navigateur ?')) return;
    if (!confirm('Dernière confirmation : cette action est irréversible (sauf export préalable).')) return;
    localStorage.removeItem(CLE_DEPENSES);
    localStorage.removeItem(CLE_CATEGORIES);
    localStorage.removeItem(CLE_DERNIER_EXPORT);
    chargerDepuisStockage();
    categorieChoisie = null;
    rafraichirTout();
    terminerEdition(false);
    montrerToast('Données effacées — catégories de départ recréées');
  });

  // — Bilan : sélecteur de période
  for (const bouton of document.querySelectorAll('#segmente-periode button')) {
    bouton.addEventListener('click', () => {
      bilanMode = bouton.dataset.mode;
      for (const autre of document.querySelectorAll('#segmente-periode button')) {
        autre.classList.toggle('actif', autre === bouton);
      }
      rendreBilan();
    });
  }
  $('select-bilan-mois').addEventListener('change', function () {
    bilanMois = this.value; rendreBilan();
  });
  $('select-bilan-debut').addEventListener('change', function () {
    bilanMoisDeb = this.value;
    if (bilanMoisDeb > bilanMoisFin) bilanMoisFin = bilanMoisDeb; // jamais à l'envers
    rendreBilan();
  });
  $('select-bilan-fin').addEventListener('change', function () {
    bilanMoisFin = this.value;
    if (bilanMoisFin < bilanMoisDeb) bilanMoisDeb = bilanMoisFin;
    rendreBilan();
  });

  // — Préférences : mois calendaire / glissant
  $('select-pref-mois').value = prefMois();
  $('select-pref-mois').addEventListener('change', function () {
    localStorage.setItem(CLE_PREF_MOIS, this.value);
    afficherTotalMois();
    rendreBilan();
    montrerToast('Préférence enregistrée ✔');
  });

  // — Outils de test (À RETIRER en version finale)
  $('bouton-jeu-test').addEventListener('click', installerJeuDeTest);
  $('bouton-purge-test').addEventListener('click', purgerDonneesTest);

  // — Simulation ticket (V2)
  for (const g of GROUPES) $('simu-groupe-categorie').appendChild(new Option(g, g));
  $('bouton-simu-ticket').addEventListener('click', () => {
    genererTicketSimule();
    rendreSimulation();
    $('simu-nouvelle-categorie').open = false;
    afficherOnglet('simulation');
  });
  $('bouton-simu-abandonner').addEventListener('click', () => {
    simuLignes = [];
    afficherOnglet('saisir');
  });
  $('bouton-simu-valider').addEventListener('click', validerTicketSimule);
  $('form-simu-categorie').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = $('simu-nom-categorie').value.trim();
    if (!nom) return;
    if (categories.some((c) => normaliser(c.nom) === normaliser(nom))) {
      alert('Une catégorie porte déjà ce nom.'); return;
    }
    const c = { id: nouvelId(), nom, groupe: $('simu-groupe-categorie').value, archivee: false };
    categories.push(c);
    sauvegarder();
    peuplerSelectCategories();
    rendreChips();
    rendreReglages();
    $('simu-nom-categorie').value = '';
    $('simu-nouvelle-categorie').open = false;
    rendreSimulation();
    montrerToast('Catégorie « ' + nom + ' » créée — glisse maintenant tes lignes dessus ✔');
  });

  // — Premier remplissage de l'écran
  chargerDepuisStockage();
  peuplerSelectCategories();
  rendreChips();
  $('champ-date').value = dateLocale();
  afficherTotalMois();
  rendreHistorique();
  rendreBilan();
  rendreReglages();
  rendreInfoExport();
}

demarrer();
