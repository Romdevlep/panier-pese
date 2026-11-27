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
const CLE_PREF_ACCUEIL   = 'pp_pref_accueil';
const CLE_AIDE_TICKET    = 'pp_aide_ticket_vue';
const CLE_TICKETS        = 'pp_tickets';
const CLE_LABELS         = 'pp_labels';
const CLE_REVENUS        = 'pp_revenus';
const CLE_CATEGORIES_REVENUS = 'pp_categories_revenus';
const CLE_ABONNEMENTS    = 'pp_abonnements';
const CLE_SOLDE_INITIAL  = 'pp_solde_initial';
const CLE_DATE_SOLDE_INITIAL = 'pp_date_solde_initial';
const CLE_SOLDE_INITIAL_VERROUILLE = 'pp_solde_initial_verrouille';
const CLE_HORIZON_PROJECTION = 'pp_horizon_projection';
const CLE_REVENU_MOYEN_TEST = 'pp_revenu_moyen_test';
const HORIZON_PAR_DEFAUT = 3;
const REVENU_MOYEN_TEST_DEFAUT = 200000;

const COULEURS_CHOIX = [
  { nom: 'Vert', valeur: '#2e7d32' },
  { nom: 'Vert clair', valeur: '#7cb342' },
  { nom: 'Jaune', valeur: '#f9a825' },
  { nom: 'Orange', valeur: '#ef6c00' },
  { nom: 'Rouge', valeur: '#c62828' },
  { nom: 'Rose', valeur: '#ad1457' },
  { nom: 'Violet', valeur: '#6a1b9a' },
  { nom: 'Indigo', valeur: '#3949ab' },
  { nom: 'Bleu', valeur: '#1565c0' },
  { nom: 'Cyan', valeur: '#00838f' },
  { nom: 'Turquoise', valeur: '#00897b' },
  { nom: 'Brun', valeur: '#6d4c41' },
];
const PALETTE_LABELS = COULEURS_CHOIX.map((c) => c.valeur);
const PALETTE_CATEGORIES = COULEURS_CHOIX.map((c) => c.valeur);
const LABELS_DEPART = ['Évitable', 'BIO'];

// Couleurs historiques conservées pour les anciennes catégories sans couleur.
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
  { nom: 'Produits bruts' },
  { nom: 'Ultra-transformés' },
  { nom: 'Épicerie' },
  { nom: 'Restaurant' },
  { nom: 'Fast-food' },
  { nom: 'Café / bar' },
  { nom: 'Alcool' },
  { nom: 'Tabac' },
  { nom: 'Carburant' },
  { nom: 'Transports en commun' },
  { nom: 'Pharmacie' },
  { nom: 'Divers' },
];
const CATEGORIES_REVENUS_DEPART = ['Salaire', 'Prestations', 'Remboursements', 'Autres revenus'];

/* ---------- 2. ÉTAT (les "temp-tables" du prototype) ---------- */

// Convention importante : les montants sont stockés en CENTIMES (entiers),
// comme dans une vraie caisse — l'addition en entiers évite les erreurs
// d'arrondi des nombres à virgule flottante. On convertit à l'affichage.
let depenses   = [];  // { id, date 'AAAA-MM-JJ', montant, categorieId, note, source, creeLe }
let revenus = [];
let categories = [];  // { id, nom, couleur, archivee } ; groupe toléré dans les anciennes données
let categoriesRevenus = [];
let abonnements = [];
let soldeInitial = 0; // centimes
let dateSoldeInitial = dateLocale();
let soldeInitialVerrouille = false;
let horizonProjection = HORIZON_PAR_DEFAUT;
let categorieChoisie = null; // catégorie présélectionnée dans l'onglet Saisir
let editionEnCours  = null;  // id de l'opération en cours de modification (sinon null)
let editionType = 'depense';
let tickets = [];              // { id, magasin, date, lignes, source, creeLe }
let simuTicketEnEdition = null; // id du ticket affiché (null = nouveau)
let simuMode = 'creation';      // 'creation' | 'consultation' | 'edition'
let labels = [];       // { id, nom, couleur, archivee }
let simuLabels = [];   // labels posés sur le ticket EN COURS de création/édition
let bilanDimension = 'categorie';
let simuEtatInitial = '';
let simuAideVisible = false;
let fermerPaletteCouleurActive = null;
let ongletAvantReglages = null;

/* ---------- 3. OUTILS GÉNÉRAUX ---------- */

function nouvelId() {
  // Date.now() garantit l'ordre chronologique, le hasard évite les collisions.
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

// Préférence « mois calendaire / glissant ». Défaut : calendaire.
function prefMois() {
  return localStorage.getItem(CLE_PREF_MOIS) === 'glissant' ? 'glissant' : 'calendaire';
};

function prefAccueil() {
  const valeur = localStorage.getItem(CLE_PREF_ACCUEIL);
  return ['bilan', 'projection', 'historique'].includes(valeur) ? valeur : 'bilan';
}

// Ajoute un zéro devant si nécessaire : 7 → '07'. Les mois et jours
// doivent tenir sur 2 chiffres pour que les dates 'AAAA-MM-JJ' se
// comparent correctement comme du texte (octobre < novembre).
function pad2(n) { return String(n).padStart(2, '0'); }

// Date du jour au format AAAA-MM-JJ, en heure LOCALE.
function dateLocale(d = new Date()) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function dateValide(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T12:00:00');
  return !Number.isNaN(parsed.getTime()) && dateLocale(parsed) === date;
}

function dateDepuisAffichage(date) {
  const saisie = date.trim();
  const correspondance =
    /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(saisie) ||
    /^(\d{2})(\d{2})(\d{4})$/.exec(saisie);
  if (!correspondance) return null;
  const iso = correspondance[3] + '-' + correspondance[2] + '-' + correspondance[1];
  return dateValide(iso) ? iso : null;
}

function datePourAffichage(date) {
  if (!dateValide(date)) return '';
  return date.slice(8, 10) + '/' + date.slice(5, 7) + '/' + date.slice(0, 4);
}

function formaterDateEnCours(champ) {
  const position = champ.selectionStart === null ? champ.value.length : champ.selectionStart;
  const chiffresAvant = champ.value.slice(0, position).replace(/\D/g, '').length;
  const chiffres = champ.value.replace(/\D/g, '').slice(0, 8);
  let valeur = chiffres.slice(0, 2);
  if (chiffres.length >= 2) valeur += '/';
  if (chiffres.length > 2) valeur += chiffres.slice(2, 4);
  if (chiffres.length >= 4) valeur += '/';
  if (chiffres.length > 4) valeur += chiffres.slice(4);
  champ.value = valeur;
  const nouvellePosition = chiffresAvant +
    (chiffresAvant >= 2 ? 1 : 0) + (chiffresAvant >= 4 ? 1 : 0);
  champ.setSelectionRange(
    Math.min(nouvellePosition, valeur.length),
    Math.min(nouvellePosition, valeur.length)
  );
}

function fermerCalendriersDate() {
  for (const calendrier of document.querySelectorAll('.calendrier-personnalise')) {
    calendrier.hidden = true;
  }
  for (const bouton of document.querySelectorAll('.bouton-calendrier')) {
    bouton.setAttribute('aria-expanded', 'false');
  }
}

function ouvrirCalendrierDate(champ, calendrier, bouton, dateMin, dateMax) {
  fermerCalendriersDate();
  const dateChoisie = dateDepuisAffichage(champ.value) || dateLocale();
  const dateInitiale = new Date(dateChoisie + 'T12:00:00');
  let annee = dateInitiale.getFullYear();
  let mois = dateInitiale.getMonth();
  const minimum = dateMin();
  const maximum = dateMax();
  calendrier.hidden = false;
  bouton.setAttribute('aria-expanded', 'true');

  const afficher = () => {
    calendrier.replaceChildren();
    const entete = document.createElement('div');
    entete.className = 'calendrier-entete';
    const titre = document.createElement('span');
    titre.className = 'calendrier-mois';
    titre.textContent = new Date(annee, mois, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const precedent = document.createElement('button');
    precedent.type = 'button';
    precedent.className = 'calendrier-navigation';
    precedent.textContent = '‹';
    precedent.setAttribute('aria-label', 'Mois précédent');
    precedent.disabled = Boolean(minimum &&
      dateLocale(new Date(annee, mois, 0)) < minimum);
    precedent.addEventListener('click', () => {
      if (mois === 0) { annee--; mois = 11; } else mois--;
      afficher();
    });
    const suivant = document.createElement('button');
    suivant.type = 'button';
    suivant.className = 'calendrier-navigation';
    suivant.textContent = '›';
    suivant.setAttribute('aria-label', 'Mois suivant');
    suivant.disabled = Boolean(maximum &&
      dateLocale(new Date(annee, mois + 1, 1)) > maximum);
    suivant.addEventListener('click', () => {
      if (mois === 11) { annee++; mois = 0; } else mois++;
      afficher();
    });
    entete.append(precedent, titre, suivant);
    calendrier.appendChild(entete);

    const grille = document.createElement('div');
    grille.className = 'calendrier-grille';
    for (const jourSemaine of ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']) {
      const cellule = document.createElement('span');
      cellule.className = 'calendrier-semaine';
      cellule.textContent = jourSemaine;
      grille.appendChild(cellule);
    }
    const premierJour = new Date(annee, mois, 1);
    const decalage = (premierJour.getDay() + 6) % 7;
    for (let i = 0; i < decalage; i++) {
      const vide = document.createElement('span');
      vide.className = 'calendrier-vide';
      grille.appendChild(vide);
    }
    const nombreJours = new Date(annee, mois + 1, 0).getDate();
    const aujourdHui = dateLocale();
    for (let jour = 1; jour <= nombreJours; jour++) {
      const date = dateLocale(new Date(annee, mois, jour));
      const choix = document.createElement('button');
      choix.type = 'button';
      choix.className = 'calendrier-jour';
      choix.textContent = String(jour);
      choix.disabled = Boolean((minimum && date < minimum) ||
        (maximum && date > maximum));
      choix.classList.toggle('aujourdhui', date === aujourdHui);
      choix.classList.toggle('selectionne', date === dateChoisie);
      choix.addEventListener('click', () => {
        champ.value = datePourAffichage(date);
        fermerCalendriersDate();
        champ.focus();
      });
      grille.appendChild(choix);
    }
    calendrier.appendChild(grille);
  };
  afficher();
}

function abonnementValide(a) {
  return a && typeof a.id === 'string' && typeof a.nom === 'string' &&
    (a.type === 'depense' || a.type === 'revenu') &&
    Number.isSafeInteger(a.montant) && a.montant > 0 &&
    typeof a.categorieId === 'string' && dateValide(a.prochaineDate) &&
    ['hebdomadaire', 'mensuelle', 'annuelle'].includes(a.frequence);
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
    .filter((d) => d.date >= bornes.debut && d.date <= bornes.fin && d.date <= dateLocale())
    .reduce((somme, d) => somme + d.montant, 0);
}

function revenuSurPeriode(bornes) {
  return revenus
    .filter((r) => r.date >= bornes.debut && r.date <= bornes.fin && r.date <= dateLocale())
    .reduce((somme, r) => somme + r.montant, 0);
}

function formaterSolde(centimes) {
  return (centimes > 0 ? '+' : '') + formaterEuros(centimes);
}

function ajouterMois(date, nbMois) {
  const [annee, mois, jour] = date.split('-').map(Number);
  const indexMois = annee * 12 + mois - 1 + nbMois;
  const anneeCible = Math.floor(indexMois / 12);
  const moisCible = indexMois % 12;
  const dernierJour = new Date(anneeCible, moisCible + 1, 0).getDate();
  return dateLocale(new Date(anneeCible, moisCible, Math.min(jour, dernierJour)));
}

function dateMaxProjection() {
  return ajouterMois(dateLocale(), horizonProjection);
}

function soldeActuel() {
  const aujourdHui = dateLocale();
  let solde = soldeInitial;
  for (const depense of depenses) {
    if (depense.date > dateSoldeInitial && depense.date <= aujourdHui) {
      solde -= depense.montant;
    }
  }
  for (const revenu of revenus) {
    if (revenu.date > dateSoldeInitial && revenu.date <= aujourdHui) {
      solde += revenu.montant;
    }
  }
  return solde;
}

function normaliserHorizonProjection(valeur) {
  if (Number.isInteger(valeur) && valeur >= 1 && valeur <= 12) return valeur;
  return valeur === 0 ? 1 : HORIZON_PAR_DEFAUT;
}

function dateDefautAbonnement() {
  return ajouterMois(dateLocale(), 1);
}

function categorieOperation(type, id) {
  return (type === 'revenu' ? categoriesRevenus : categories).find((c) => c.id === id);
}

function categoriesActives(type) {
  return (type === 'revenu' ? categoriesRevenus : categories).filter((c) => !c.archivee);
}

// Tous les mois du solde de départ au mois courant (celui-ci toujours inclus).
function listeMoisDisponibles() {
  const courant = dateLocale().slice(0, 7);
  const liste = [];
  let [y, m] = dateSoldeInitial.slice(0, 7).split('-').map(Number);
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

function labelParId(id) { return labels.find((x) => x.id === id); }

function couleurCategorie(c) {
  return c && c.couleur ? c.couleur : (COULEURS_GROUPES[c && c.groupe] || '#9e9e9e');
}

function creerSelecteurCouleur(couleurInitiale, onChange, nom, compact = false) {
  let couleur = couleurInitiale || COULEURS_CHOIX[0].valeur;
  const selecteur = document.createElement('div');
  selecteur.className = 'selecteur-couleur' + (compact ? ' compact' : '');

  const choix = document.createElement('div');
  choix.className = 'palette-couleurs';
  choix.setAttribute('role', 'group');
  choix.setAttribute('aria-label', 'Couleurs pour ' + nom);
  choix.hidden = true;

  const boutonActuel = document.createElement('button');
  boutonActuel.type = 'button';
  boutonActuel.className = 'couleur-actuelle';
  boutonActuel.setAttribute('aria-label', 'Choisir une couleur pour ' + nom);
  boutonActuel.title = 'Changer la couleur';
  boutonActuel.style.backgroundColor = couleur;
  boutonActuel.setAttribute('aria-expanded', 'false');

  function actualiserSelection() {
    boutonActuel.style.backgroundColor = couleur;
    champAvance.value = couleur;
    for (const bouton of choix.querySelectorAll('button[data-couleur]')) {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.couleur === couleur));
    }
  }

  for (const option of COULEURS_CHOIX) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'pastille-couleur';
    bouton.dataset.couleur = option.valeur;
    bouton.style.backgroundColor = option.valeur;
    bouton.title = option.nom;
    bouton.setAttribute('aria-label', option.nom);
    bouton.setAttribute('aria-pressed', String(option.valeur === couleur));
    bouton.addEventListener('click', () => {
      couleur = option.valeur;
      actualiserSelection();
      fermerCettePalette();
      onChange(couleur);
    });
    choix.appendChild(bouton);
  }

  const avancee = document.createElement('div');
  avancee.className = 'couleur-avancee';
  const boutonAvance = document.createElement('button');
  boutonAvance.type = 'button';
  boutonAvance.className = 'bouton-avance';
  boutonAvance.textContent = 'Mode avancé';
  const champAvance = document.createElement('input');
  champAvance.type = 'color';
  champAvance.value = couleur;
  champAvance.setAttribute('aria-label', 'Couleur personnalisée pour ' + nom);
  champAvance.hidden = true;
  boutonAvance.addEventListener('click', () => {
    champAvance.hidden = !champAvance.hidden;
    boutonAvance.textContent = champAvance.hidden ? 'Mode avancé' : 'Masquer le mode avancé';
    if (!champAvance.hidden) champAvance.focus();
  });
  champAvance.addEventListener('change', () => {
    couleur = champAvance.value;
    actualiserSelection();
    boutonActuel.style.backgroundColor = couleur;
    fermerCettePalette();
    onChange(couleur);
  });
  avancee.appendChild(boutonAvance);
  avancee.appendChild(champAvance);
  choix.appendChild(avancee);

  let fermerCettePalette;
  fermerCettePalette = () => {
    choix.hidden = true;
    boutonActuel.setAttribute('aria-expanded', 'false');
    if (fermerPaletteCouleurActive === fermerCettePalette) fermerPaletteCouleurActive = null;
  };
  boutonActuel.addEventListener('click', () => {
    if (!choix.hidden) {
      fermerCettePalette();
      return;
    }
    if (fermerPaletteCouleurActive) fermerPaletteCouleurActive();
    choix.hidden = false;
    boutonActuel.setAttribute('aria-expanded', 'true');
    fermerPaletteCouleurActive = fermerCettePalette;
  });
  selecteur.appendChild(boutonActuel);
  selecteur.appendChild(choix);
  actualiserSelection();
  return selecteur;
}

function afficherSelecteurCouleurFormulaire(conteneurId, champId, couleurInitiale, nom) {
  const champ = $(champId);
  champ.value = couleurInitiale;
  const conteneur = $(conteneurId);
  conteneur.replaceChildren(creerSelecteurCouleur(
    couleurInitiale,
    (couleur) => { champ.value = couleur; },
    nom
  ));
}

// État des labels pour un ticket : plein (sur le ticket) ou partiel (≥ 1 ligne).
// On parcoure TOUS les labels (archivés compris) : une référence passée doit
// continuer à s'afficher.
function etatLabelsTicket(labelsTicket, lignes) {
  const resultats = [];
  for (const lb of labels) {
    const complet = (labelsTicket || []).includes(lb.id);
    const partiel = !complet && lignes.some((l) => (l.labels || []).includes(lb.id));
    if (!complet && !partiel) continue;
    resultats.push({ nom: lb.nom, couleur: lb.couleur || '#9e9e9e', complet });
  }
  return resultats;
}

// Fabrique un badge (span) dans l'etat voulu.
function creerBadge(texteCouleur, e) {
  const b = document.createElement('span');
  b.className = 'badge ' + (e.complet ? 'plein' : 'partiel');
  if (e.complet) { b.style.background = e.couleur; b.style.borderColor = e.couleur; }
  else { b.style.color = e.couleur; b.style.borderColor = e.couleur; }
  b.textContent = e.nom;
  return b;
}

/* ---------- 4. PERSISTANCE (localStorage) ---------- */

function chargerDepuisStockage() {
  try { depenses = JSON.parse(localStorage.getItem(CLE_DEPENSES)) ?? []; }
  catch { depenses = []; }
  try { revenus = JSON.parse(localStorage.getItem(CLE_REVENUS)) ?? []; }
  catch { revenus = []; }
  try { categories = JSON.parse(localStorage.getItem(CLE_CATEGORIES)) ?? []; }
  catch { categories = []; }
  try { categoriesRevenus = JSON.parse(localStorage.getItem(CLE_CATEGORIES_REVENUS)) ?? []; }
  catch { categoriesRevenus = []; }
  try { abonnements = (JSON.parse(localStorage.getItem(CLE_ABONNEMENTS)) ?? []).filter(abonnementValide); }
  catch { abonnements = []; }
  const soldeEnregistre = Number(localStorage.getItem(CLE_SOLDE_INITIAL));
  soldeInitial = Number.isSafeInteger(soldeEnregistre) ? soldeEnregistre : 0;
  const dateSoldeEnregistree = localStorage.getItem(CLE_DATE_SOLDE_INITIAL);
  dateSoldeInitial = dateValide(dateSoldeEnregistree) && dateSoldeEnregistree <= dateLocale()
    ? dateSoldeEnregistree : dateLocale();
  const verrouSoldeEnregistre = localStorage.getItem(CLE_SOLDE_INITIAL_VERROUILLE);
  soldeInitialVerrouille = verrouSoldeEnregistre === null
    ? localStorage.getItem(CLE_SOLDE_INITIAL) !== null
    : verrouSoldeEnregistre === 'true';
  const horizonValeur = localStorage.getItem(CLE_HORIZON_PROJECTION);
  const horizonEnregistre = horizonValeur === null ? NaN : Number(horizonValeur);
  horizonProjection = normaliserHorizonProjection(horizonEnregistre);
  try { tickets = JSON.parse(localStorage.getItem(CLE_TICKETS)) ?? []; }
  catch { tickets = []; }
  try { labels = JSON.parse(localStorage.getItem(CLE_LABELS)) ?? []; }
  catch { labels = []; }
  if (labels.length === 0) {
    labels = LABELS_DEPART.map((nom, i) => ({
      id: nouvelId(), nom, couleur: PALETTE_LABELS[i % PALETTE_LABELS.length], archivee: false,
    }));
  }

  // Premier lancement : on sème les catégories de départ.
  if (categories.length === 0) {
    categories = CATEGORIES_DEPART.map((c) => ({
      id: nouvelId(), nom: c.nom, archivee: false,
    }));
  }
  if (categoriesRevenus.length === 0) {
    categoriesRevenus = CATEGORIES_REVENUS_DEPART.map((nom) => ({
      id: nouvelId(), nom, archivee: false,
    }));
  }
  categories.forEach((c, i) => {
    if (!c.couleur) c.couleur = PALETTE_CATEGORIES[i % PALETTE_CATEGORIES.length];
  });
}

function sauvegarder() {
  localStorage.setItem(CLE_DEPENSES, JSON.stringify(depenses));
  localStorage.setItem(CLE_REVENUS, JSON.stringify(revenus));
  localStorage.setItem(CLE_CATEGORIES, JSON.stringify(categories));
  localStorage.setItem(CLE_CATEGORIES_REVENUS, JSON.stringify(categoriesRevenus));
  localStorage.setItem(CLE_ABONNEMENTS, JSON.stringify(abonnements));
  localStorage.setItem(CLE_SOLDE_INITIAL, String(soldeInitial));
  localStorage.setItem(CLE_DATE_SOLDE_INITIAL, dateSoldeInitial);
  localStorage.setItem(CLE_SOLDE_INITIAL_VERROUILLE, String(soldeInitialVerrouille));
  localStorage.setItem(CLE_HORIZON_PROJECTION, String(horizonProjection));
  localStorage.setItem(CLE_TICKETS, JSON.stringify(tickets));
  localStorage.setItem(CLE_LABELS, JSON.stringify(labels));
}

function mettreAJourFormulaireSoldeInitial() {
  $('champ-solde-initial').value = (soldeInitial / 100).toFixed(2);
  $('champ-date-solde-initial').value = datePourAffichage(dateSoldeInitial);
  $('champ-solde-initial').disabled = soldeInitialVerrouille;
  $('champ-date-solde-initial').disabled = soldeInitialVerrouille;
  $('bouton-calendrier-solde').disabled = soldeInitialVerrouille;
  $('bouton-enregistrer-solde').hidden = soldeInitialVerrouille;
  $('bouton-modifier-solde').hidden = !soldeInitialVerrouille;
  $('info-solde-initial').textContent = soldeInitialVerrouille
    ? 'Verrouillé : solde enregistré au ' + dateCourte(dateSoldeInitial) + ', en fin de journée.'
    : 'Le montant et la date seront verrouillés après enregistrement.';
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
  if (nom !== 'reglages') ongletAvantReglages = nom;
  const reglagesOuverts = nom === 'reglages';
  const boutonReglages = $('bouton-reglages');
  boutonReglages.setAttribute('aria-expanded', String(reglagesOuverts));
  boutonReglages.setAttribute('aria-label',
    reglagesOuverts ? 'Fermer les réglages' : 'Ouvrir les réglages');
  boutonReglages.title = reglagesOuverts ? 'Fermer les réglages' : 'Réglages';

  // Marque le bouton actif, montre la section correspondante.
  for (const bouton of document.querySelectorAll('nav button')) {
    bouton.classList.toggle('actif', bouton.dataset.onglet === nom);
  }
  $('bouton-saisir').hidden = !['bilan', 'projection', 'historique'].includes(nom);
  for (const section of document.querySelectorAll('main > section')) {
    section.hidden = section.id !== 'onglet-' + nom;
  }
  // Chaque onglet recharge son contenu à l'entrée (donc toujours à jour).
  if (nom === 'historique') rendreHistorique();
  if (nom === 'bilan')      rendreBilan();
  if (nom === 'projection') rendreProjection();
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
    if (d.date >= borneStr && d.date <= dateLocale()) {
      compteur.set(d.categorieId, (compteur.get(d.categorieId) ?? 0) + 1);
    }
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
    bouton.style.borderColor = couleurCategorie(cat);
    bouton.addEventListener('click', () => {
      categorieChoisie = cat.id;
      $('champ-categorie').value = cat.id;
      rendreChips();
    });
    conteneur.appendChild(bouton);
  }
}

// Remplit le sélecteur avec les catégories actives, sans groupes.
function peuplerSelectCategories() {
  const select = $('champ-categorie');
  select.innerHTML = '';
  select.appendChild(new Option('— choisir une catégorie —', ''));
  const actives = categories.filter((c) => !c.archivee);
  for (const c of actives) select.appendChild(new Option(c.nom, c.id));
  // Cas rare : on modifie une dépense pointant vers une catégorie archivée.
  if (categorieChoisie && !actives.some((c) => c.id === categorieChoisie)) {
    const c = categorieParId(categorieChoisie);
    if (c) select.appendChild(new Option(c.nom + ' (archivée)', c.id));
  }
  if (categorieChoisie) select.value = categorieChoisie;
}

function mettreAJourFormulaireType(type, categorieId) {
  const revenu = type === 'revenu';
  const select = $('champ-categorie');
  $('chips-categories').hidden = revenu;
  $('libelle-categorie-form').textContent = revenu ? 'Catégorie de revenu' : 'Catégorie de dépense';
  if (revenu) {
    select.innerHTML = '';
    select.appendChild(new Option('— choisir une catégorie —', ''));
    for (const cat of categoriesActives('revenu')) select.appendChild(new Option(cat.nom, cat.id));
    if (categorieId) {
      const cat = categorieOperation('revenu', categorieId);
      if (cat && cat.archivee) select.appendChild(new Option(cat.nom + ' (archivée)', cat.id));
      select.value = categorieId;
    }
    $('bouton-valider').textContent = editionEnCours ? 'Enregistrer la modification' : 'Ajouter la rentrée d’argent';
  } else {
    if (categorieId !== undefined) categorieChoisie = categorieId;
    peuplerSelectCategories();
    $('bouton-valider').textContent = editionEnCours ? 'Enregistrer la modification' : 'Ajouter la dépense';
  }
  $('bouton-simu-ticket').hidden = revenu || Boolean(editionEnCours);
}

// Remet le formulaire "neuf" (sans toucher à la catégorie choisie :
// on enchaîne souvent plusieurs achats de la même catégorie).
function terminerEdition(avecFocus) {
  editionEnCours = null;
  editionType = 'depense';
  $('champ-id').value = '';
  $('champ-montant').value = '';
  $('champ-note').value = '';
  $('champ-date').value = datePourAffichage(dateLocale());
  $('select-type-operation').disabled = false;
  $('select-type-operation').value = 'depense';
  mettreAJourFormulaireType('depense', categorieChoisie);
  $('bouton-annuler').hidden = true;
  if (avecFocus) $('champ-montant').focus();
}

function modifierOperation(id, type) {
  const collection = type === 'revenu' ? revenus : depenses;
  const operation = collection.find((x) => x.id === id);
  if (!operation) return;
  editionEnCours = id;
  editionType = type;
  $('select-type-operation').value = type;
  $('select-type-operation').disabled = true;
  mettreAJourFormulaireType(type, operation.categorieId);
  $('champ-id').value = id;
  $('champ-montant').value = (operation.montant / 100).toFixed(2);
  $('champ-date').value = datePourAffichage(operation.date);
  $('champ-note').value = operation.note || '';
  $('champ-categorie').value = operation.categorieId;
  $('bouton-annuler').hidden = false;
  afficherOnglet('saisir');
}

function modifierDepense(id) { modifierOperation(id, 'depense'); }

// Total affiché sous le titre : suit la préférence calendaire / glissant.
function afficherTotalMois() {
  let label = 'Ce mois-ci';
  if (prefMois() === 'glissant') {
    label += ' (' + libellePeriode(bornesMoisCourant()) + ')';
  } else {
    const l = libelleMois(dateLocale().slice(0, 7));
    label += ' — ' + l.charAt(0).toUpperCase() + l.slice(1);
  }
  const bornes = bornesMoisCourant();
  const depensesMois = totalSurPeriode(bornes);
  const revenusMois = revenuSurPeriode(bornes);
  $('total-mois').textContent = label + ' — Revenus ' + formaterEuros(revenusMois) +
    ' · Dépenses ' + formaterEuros(depensesMois) + ' · Solde ' +
    formaterSolde(revenusMois - depensesMois);
}

/* ---------- 8. ONGLET HISTORIQUE ---------- */

// On assemble chaque ligne par createElement + textContent — jamais
// innerHTML avec des données utilisateur (règle de sécurité).
function construireLigneOperation(d, type) {
  const cat = categorieOperation(type, d.categorieId);
  const nomCat = cat ? cat.nom : '(catégorie supprimée)';
  const couleur = type === 'revenu' ? '#00897b' : cat ? couleurCategorie(cat) : '#9e9e9e';

  const ligne = document.createElement('div');
  ligne.className = 'ligne-depense' + (d.date > dateLocale() ? ' operation-future' : '');

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
  info.textContent = jour + (d.date > dateLocale() ? ' · À venir' : '') +
    (d.note ? ' · ' + d.note : '');
  quoi.appendChild(nom);
  quoi.appendChild(info);

  const montant = document.createElement('span');
  montant.className = 'montant';
  montant.textContent = (type === 'revenu' ? '+' : '−') + formaterEuros(d.montant);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const boutonModif = document.createElement('button');
  boutonModif.textContent = '✏️';
  boutonModif.title = 'Modifier';
  boutonModif.addEventListener('click', () => modifierOperation(d.id, type));
  const boutonSuppr = document.createElement('button');
  boutonSuppr.textContent = '🗑️';
  boutonSuppr.title = 'Supprimer';
  boutonSuppr.addEventListener('click', () => supprimerOperation(d.id, type));
  actions.appendChild(boutonModif);
  actions.appendChild(boutonSuppr);

  ligne.appendChild(point);
  ligne.appendChild(quoi);
  ligne.appendChild(montant);
  ligne.appendChild(actions);
  return ligne;
}

function construireLigneDepense(d) { return construireLigneOperation(d, 'depense'); }

function rendreHistorique() {
  const recherche = normaliser($('champ-recherche').value);
  const conteneur = $('liste-depenses');
  conteneur.innerHTML = '';

  // Fusion des opérations manuelles, des tickets et des revenus.
  const entrees = [];
  for (const d of depenses) if (!d.ticketId) entrees.push({ type: 'depense', objet: d });
  for (const r of revenus) entrees.push({ type: 'revenu', objet: r });
  for (const t of tickets)     entrees.push({ type: 'ticket',  objet: t });
  entrees.sort((a, b) => {
    const da = a.objet.date, db = b.objet.date;
    const ca = a.objet.creeLe || '', cb = b.objet.creeLe || '';
    return db.localeCompare(da) || cb.localeCompare(ca);
  });

  let moisCourant = null;
  let trouvees = 0;
  for (const e of entrees) {
    if (e.type === 'depense' || e.type === 'revenu') {
      const cat = categorieOperation(e.type, e.objet.categorieId);
      const nomCat = cat ? cat.nom : '';
      if (recherche && !normaliser(nomCat + ' ' + (e.objet.note || '')).includes(recherche)) continue;
    } else {
      if (recherche && !normaliser(e.objet.magasin).includes(recherche)) continue;
    }
    trouvees++;
    const mois = e.objet.date.slice(0, 7);
    if (mois !== moisCourant) {
      moisCourant = mois;
      const titre = document.createElement('h3');
      titre.className = 'titre-mois';
      titre.textContent = libelleMois(mois);
      conteneur.appendChild(titre);
    }
    conteneur.appendChild(e.type === 'ticket'
      ? construireLigneTicket(e.objet)
      : construireLigneOperation(e.objet, e.type));
  }
  if (trouvees === 0) {
    conteneur.innerHTML = '<p class="vide">Aucune saisie' +
      (recherche ? ' pour cette recherche' : '') + '.</p>';
  }
}

// Une saisie ticket = UNE ligne récapitulative, cliquable vers la fiche.
function construireLigneTicket(t) {
  const total = t.lignes.reduce((s, l) => s + l.cents, 0);
  const ligne = document.createElement('div');
  ligne.className = 'ligne-depense';

  const nok = document.createElement('span');
  nok.className = 'point';
  nok.style.background = '#8d6e63';

  const quoi = document.createElement('div');
  quoi.className = 'quoi';
  for (const e of etatLabelsTicket(t.labels, t.lignes)) {
    quoi.appendChild(creerBadge(t.nom, e));
  }
  const nom = document.createElement('span');
  nom.textContent = '🧾 ' + t.magasin;
  const jour = new Date(t.date + 'T12:00:00')
    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  const info = document.createElement('small');
  info.textContent = jour + ' · ' + t.lignes.length + ' lignes · toucher pour le détail';
  quoi.appendChild(nom);
  quoi.appendChild(info);

  const montant = document.createElement('span');
  montant.className = 'montant';
  montant.textContent = formaterEuros(total);

  quoi.appendChild(montant); // réutilise l'alignement : ticket = une ligne large
  ligne.appendChild(nok);
  ligne.appendChild(quoi);
  ligne.addEventListener('click', () => ouvrirFicheTicket(t.id));
  return ligne;
}

function supprimerDepense(id) {
  supprimerOperation(id, 'depense');
}

function supprimerOperation(id, type) {
  const collection = type === 'revenu' ? revenus : depenses;
  const nom = type === 'revenu' ? 'rentrée d’argent' : 'dépense';
  if (!confirm('Supprimer cette ' + nom + ' ?')) return;
  if (type === 'revenu') revenus = collection.filter((d) => d.id !== id);
  else depenses = collection.filter((d) => d.id !== id);
  sauvegarder();
  afficherTotalMois();
  rendreHistorique();
  rendreBilan();
  montrerToast(type === 'revenu' ? 'Rentrée supprimée' : 'Dépense supprimée');
}

/* ---------- 9. ONGLET BILAN ---------- */

// Une carte = titre + barres horizontales (CSS pur, pas de bibliothèque).
function construireCarteBarres(titre, lignes) {
  const carte = document.createElement('div');
  carte.className = 'carte';
  if (titre) {
    const h2 = document.createElement('h2');
    h2.textContent = titre;
    carte.appendChild(h2);
  }

  const maxi = Math.max(...lignes.map((l) => l.cents), 1);
  for (const l of lignes) {
    const bloc = document.createElement('div');
    bloc.className = 'bilan-ligne';

    const li = document.createElement('div');
    li.className = 'bilan-libelle';
    const gauche = document.createElement('span');
    if (l.point && l.couleur) {
      const point = document.createElement('span');
      point.textContent = '● ';
      point.style.color = l.couleur;
      gauche.appendChild(point);
    }
    gauche.appendChild(document.createTextNode(l.libelle));
    const droit = document.createElement('span');
    droit.textContent = l.complement || formaterEuros(l.cents);
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

function construireCarteEvolution(lignes) {
  const carte = document.createElement('div');
  carte.className = 'carte';
  const titre = document.createElement('h2');
  titre.textContent = 'Évolution (6 mois)';
  carte.appendChild(titre);

  const libellePerimetre = document.createElement('label');
  libellePerimetre.htmlFor = 'select-evolution-perimetre';
  libellePerimetre.textContent = 'Voir l’évolution pour';
  const selectPerimetre = document.createElement('select');
  selectPerimetre.id = 'select-evolution-perimetre';
  selectPerimetre.setAttribute('aria-label', 'Périmètre de l’évolution');
  selectPerimetre.appendChild(new Option('Toutes les dépenses', 'tout'));

  if (categories.length) {
    const groupeCategories = document.createElement('optgroup');
    groupeCategories.label = 'Catégories';
    for (const categorie of categories) {
      groupeCategories.appendChild(new Option(
        categorie.nom + (categorie.archivee ? ' (archivée)' : ''),
        'categorie:' + categorie.id
      ));
    }
    selectPerimetre.appendChild(groupeCategories);
  }
  if (labels.length) {
    const groupeLabels = document.createElement('optgroup');
    groupeLabels.label = 'Labels';
    for (const label of labels) {
      groupeLabels.appendChild(new Option(
        label.nom + (label.archivee ? ' (archivé)' : ''),
        'label:' + label.id
      ));
    }
    selectPerimetre.appendChild(groupeLabels);
  }
  selectPerimetre.value = bilanPerimetre;
  if (!selectPerimetre.value) {
    bilanPerimetre = 'tout';
    selectPerimetre.value = 'tout';
  }
  carte.appendChild(libellePerimetre);
  carte.appendChild(selectPerimetre);

  const largeur = 360, hauteur = 150, marge = 28;
  const maxi = Math.max(...lignes.map((l) => l.cents), 1);
  const points = lignes.map((l, i) => ({
    x: marge + i * (largeur - 2 * marge) / Math.max(lignes.length - 1, 1),
    y: hauteur - marge - (l.cents / maxi) * (hauteur - 2 * marge),
  }));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + largeur + ' ' + hauteur);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Évolution des dépenses par mois sur six mois');
  const [typePerimetre, idPerimetre] = bilanPerimetre.split(':');
  const categoriePerimetre = typePerimetre === 'categorie'
    ? categorieParId(idPerimetre) : null;
  const labelPerimetre = typePerimetre === 'label'
    ? labelParId(idPerimetre) : null;
  const couleurPerimetre = categoriePerimetre
    ? couleurCategorie(categoriePerimetre)
    : labelPerimetre ? labelPerimetre.couleur || '#9e9e9e' : '#2e7d32';
  const path = document.createElementNS(svg.namespaceURI, 'polyline');
  path.setAttribute('points', points.map((p) => p.x + ',' + p.y).join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', couleurPerimetre);
  path.setAttribute('stroke-width', '3');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  points.forEach((p, i) => {
    const cercle = document.createElementNS(svg.namespaceURI, 'circle');
    cercle.setAttribute('cx', p.x);
    cercle.setAttribute('cy', p.y);
    cercle.setAttribute('r', '4');
    cercle.setAttribute('fill', bilanPerimetre === 'tout'
      ? lignes[i].couleur || '#2e7d32' : couleurPerimetre);
    svg.appendChild(cercle);
  });
  carte.appendChild(svg);
  const labelsMois = document.createElement('div');
  labelsMois.className = 'evolution-mois';
  lignes.forEach((l) => {
    const item = document.createElement('span');
    item.textContent = l.libelle;
    labelsMois.appendChild(item);
  });
  carte.appendChild(labelsMois);
  const montants = document.createElement('div');
  montants.className = 'evolution-montants';
  lignes.forEach((l) => {
    const item = document.createElement('span');
    item.textContent = formaterEuros(l.cents);
    montants.appendChild(item);
  });
  carte.appendChild(montants);
  return carte;
}

/* ----- État de la vue Bilan (non persisté : « Ce mois-ci » par défaut) ----- */
let bilanMode    = 'mois-courant';             // 'mois-courant' | 'un-mois' | 'plage' | 'tout'
let bilanMois    = dateLocale().slice(0, 7);   // sélecteur « un mois »
let bilanMoisDeb = dateLocale().slice(0, 7);   // sélecteur « plage » début
let bilanMoisFin = dateLocale().slice(0, 7);   // sélecteur « plage » fin
let bilanPerimetre = 'tout';

// Bornes effectivement utilisées selon le mode.
function bornesBilan() {
  switch (bilanMode) {
    case 'un-mois': return bornesMoisCalendaire(bilanMois); // un mois précis = TOUJOURS calendaire
    case 'plage':   return { debut: bilanMoisDeb + '-01', fin: bornesMoisCalendaire(bilanMoisFin).fin };
    case 'tout':    return { debut: dateSoldeInitial, fin: dateLocale() };
    default:        return bornesMoisCourant(); // « Ce mois-ci » suit la préférence
  }
}

function totalMoisEvolution(mois) {
  if (bilanPerimetre === 'tout') {
    return depenses
      .filter((d) => d.date.slice(0, 7) === mois && d.date <= dateLocale())
      .reduce((somme, d) => somme + d.montant, 0);
  }

  const [type, id] = bilanPerimetre.split(':');
  if (type === 'categorie') {
    return depenses
      .filter((d) => d.categorieId === id && d.date.slice(0, 7) === mois && d.date <= dateLocale())
      .reduce((somme, d) => somme + d.montant, 0);
  }

  if (type === 'label') {
    let total = 0;
    for (const ticket of tickets) {
      if (ticket.date.slice(0, 7) !== mois || ticket.date > dateLocale()) continue;
      for (const ligne of ticket.lignes || []) {
        if ((ticket.labels || []).includes(id) || (ligne.labels || []).includes(id)) {
          total += ligne.cents;
        }
      }
    }
    return total;
  }

  return 0;
}

// Remplit les trois <select> de mois ; le mois courant y figure toujours.
function peuplerSelectsBilan() {
  const mois = listeMoisDisponibles();
  const normaliserMois = (valeur) => mois.includes(valeur) ? valeur : mois[0];
  bilanMois = normaliserMois(bilanMois);
  bilanMoisDeb = normaliserMois(bilanMoisDeb);
  bilanMoisFin = normaliserMois(bilanMoisFin);
  if (bilanMoisDeb > bilanMoisFin) bilanMoisFin = bilanMoisDeb;
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
  peuplerSelectsBilan();

  // Affiche le sous-formulaire du mode actif seulement.
  $('choix-un-mois').hidden = bilanMode !== 'un-mois';
  $('choix-plage').hidden   = bilanMode !== 'plage';

  const b = bornesBilan();
  $('libelle-periode').textContent = libellePeriode(b);

  const conteneur = $('bilan-contenu');
  conteneur.innerHTML = '';
  const resume = $('bilan-resume');
  resume.replaceChildren();
  $('select-bilan-dimension').value = bilanDimension;
  const total = totalSurPeriode(b);
  const totalRevenus = revenuSurPeriode(b);

  // — Totaux directement sous la période sélectionnée.
  for (const [libelle, montant] of [
    ['Revenus', formaterEuros(totalRevenus)],
    ['Dépenses', formaterEuros(total)],
    ['Solde', formaterSolde(totalRevenus - total)],
  ]) {
    const ligne = document.createElement('p');
    ligne.className = 'bilan-resume-ligne';
    const nom = document.createElement('span');
    nom.textContent = libelle;
    const valeur = document.createElement('strong');
    valeur.textContent = montant;
    ligne.append(nom, valeur);
    resume.appendChild(ligne);
  }

  if (total === 0 && totalRevenus === 0) {
    const vide = document.createElement('div');
    vide.className = 'carte';
    const message = document.createElement('p');
    message.className = 'vide';
    message.textContent = 'Aucune opération réelle sur cette période.';
    vide.appendChild(message);
    conteneur.appendChild(vide);
  }

  if (total > 0 && bilanDimension === 'label') {
    const parLabel = new Map();
    for (const t of tickets) {
      if (t.date < b.debut || t.date > b.fin || t.date > dateLocale()) continue;
      for (const ligne of t.lignes || []) {
        const ids = [...new Set([...(t.labels || []), ...(ligne.labels || [])])];
        for (const id of ids) {
          const label = labelParId(id);
          const nom = label ? label.nom : '(label supprimé)';
          const actuel = parLabel.get(nom) || { cents: 0, couleur: label ? label.couleur : '#9e9e9e' };
          actuel.cents += ligne.cents;
          parLabel.set(nom, actuel);
        }
      }
    }
    const lignesLabels = [...parLabel.entries()].map(([libelle, valeur]) => ({
      libelle, cents: valeur.cents, couleur: valeur.couleur,
      complement: formaterEuros(valeur.cents) + ' (' + Math.round((valeur.cents / total) * 100) + '%)',
    })).sort((a, x) => x.cents - a.cents);
    if (lignesLabels.length) {
      conteneur.appendChild(construireCarteBarres('', lignesLabels));
    } else {
      const vide = document.createElement('p');
      vide.className = 'vide';
      vide.textContent = 'Aucun label sur cette période.';
      conteneur.appendChild(vide);
    }
    const note = document.createElement('p');
    note.className = 'info';
    note.textContent = 'Un montant peut compter dans plusieurs labels lorsqu’ils sont cumulés.';
    conteneur.appendChild(note);
  } else if (total > 0 && bilanDimension === 'categorie') {
    // — Répartition par catégorie sur la période choisie.
    const parCategorie = new Map();
    for (const d of depenses) {
      if (d.date >= b.debut && d.date <= b.fin && d.date <= dateLocale()) {
        parCategorie.set(d.categorieId, (parCategorie.get(d.categorieId) ?? 0) + d.montant);
      }
    }
    const lignes = [...parCategorie.entries()]
      .map(([id, cents]) => {
        const cat = categorieParId(id);
        return {
          libelle: cat ? cat.nom : '(catégorie supprimée)',
          couleur: cat ? couleurCategorie(cat) : '#9e9e9e',
          cents,
          complement: formaterEuros(cents) + ' (' + Math.round((cents / total) * 100) + '%)',
        };
      })
      .sort((a, x) => x.cents - a.cents);
    conteneur.appendChild(construireCarteBarres('', lignes));
  }

  if (totalRevenus > 0) {
    const parCategorieRevenu = new Map();
    for (const r of revenus) {
      if (r.date >= b.debut && r.date <= b.fin && r.date <= dateLocale()) {
        parCategorieRevenu.set(r.categorieId,
          (parCategorieRevenu.get(r.categorieId) ?? 0) + r.montant);
      }
    }
    const lignesRevenus = [...parCategorieRevenu.entries()].map(([id, cents]) => {
      const cat = categorieOperation('revenu', id);
      return {
        libelle: cat ? cat.nom : '(catégorie supprimée)',
        couleur: '#00897b',
        cents,
        complement: formaterEuros(cents) + ' (' + Math.round((cents / totalRevenus) * 100) + '%)',
      };
    }).sort((a, x) => x.cents - a.cents);
    if (lignesRevenus.length) {
      conteneur.appendChild(construireCarteBarres('Répartition des revenus', lignesRevenus));
    }
  }

  // — Évolution 6 mois : vue de tendance, toujours en MOIS CALENDARIRES,
  //   ancrée sur aujourd'hui (indépendante de la période sélectionnée).
  const moisCalendaire = dateLocale().slice(0, 7);
  const sixMois = [];
  const aujourdhui = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
    sixMois.push(dateLocale(d).slice(0, 7));
  }
  const lignesMois = sixMois.map((m) => ({
    libelle: new Date(m + '-01T12:00:00')
      .toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    couleur: m === moisCalendaire ? '#2e7d32' : '#a5c8a7',
    cents: totalMoisEvolution(m),
  }));
  conteneur.appendChild(construireCarteEvolution(lignesMois));
}

function dateSuivanteAbonnement(abonnement, dateCourante) {
  if (abonnement.frequence === 'hebdomadaire') {
    const date = new Date(dateCourante + 'T12:00:00');
    date.setDate(date.getDate() + 7);
    return dateLocale(date);
  }
  const [annee, mois, jour] = dateCourante.split('-').map(Number);
  if (abonnement.frequence === 'annuelle') {
    const moisCible = Number.isInteger(abonnement.moisAnnee) ? abonnement.moisAnnee : mois - 1;
    const jourCible = Number.isInteger(abonnement.jourMois) ? abonnement.jourMois : jour;
    return dateLocale(new Date(annee + 1, moisCible,
      Math.min(jourCible, new Date(annee + 1, moisCible + 1, 0).getDate())));
  }
  const moisCible = mois;
  const jourCible = Number.isInteger(abonnement.jourMois) ? abonnement.jourMois : jour;
  return dateLocale(new Date(annee, moisCible,
    Math.min(jourCible, new Date(annee, moisCible + 1, 0).getDate())));
}

function evenementsProjection() {
  const aujourdHui = dateLocale();
  const fin = dateMaxProjection();
  const evenements = [];
  for (const operation of depenses.concat(revenus)) {
    if (operation.source !== 'manuelle' || operation.ticketId ||
        operation.date <= aujourdHui || operation.date > fin) continue;
    const type = revenus.includes(operation) ? 'revenu' : 'depense';
    const categorie = categorieOperation(type, operation.categorieId);
    evenements.push({
      date: operation.date, type, montant: operation.montant,
      nom: operation.note || (categorie ? categorie.nom : 'Opération prévue'),
      source: 'manuelle',
    });
  }
  for (const abonnement of abonnements) {
    if (abonnement.archivee || !abonnement.prochaineDate) continue;
    let date = abonnement.prochaineDate;
    if (date <= aujourdHui) {
      evenements.push({
        date, type: abonnement.type, montant: abonnement.montant,
        nom: abonnement.nom, abonnementId: abonnement.id, aConfirmer: true,
      });
      continue;
    }
    let garde = 0;
    while (date <= fin && garde < 60) {
      evenements.push({
        date, type: abonnement.type, montant: abonnement.montant,
        nom: abonnement.nom, abonnementId: abonnement.id, aConfirmer: false,
      });
      date = dateSuivanteAbonnement(abonnement, date);
      garde++;
    }
  }
  return evenements.sort((a, b) => a.date.localeCompare(b.date) || a.nom.localeCompare(b.nom));
}

function construireCarteProjection() {
  const carte = document.createElement('div');
  carte.className = 'carte';
  const titre = document.createElement('h2');
  titre.textContent = 'Projection du solde (' + horizonProjection + ' mois)';
  carte.appendChild(titre);
  const description = document.createElement('p');
  description.className = 'info';
  description.textContent = 'Solde de départ au ' + dateCourte(dateSoldeInitial) +
    ', en fin de journée. Les opérations postérieures actualisent le solde courant ; les opérations à venir restent prévisionnelles.';
  carte.appendChild(description);

  const evenements = evenementsProjection();
  const fluxFuturs = evenements.filter((e) => !e.aConfirmer);
  const soldeDuJour = soldeActuel();
  const points = [{ date: dateLocale(), label: 'Aujourd’hui', montant: soldeDuJour }];
  let solde = soldeDuJour;
  for (let i = 1; i <= horizonProjection; i++) {
    const date = ajouterMois(dateLocale(), i);
    for (const evenement of fluxFuturs) {
      if (!evenement.inclus && evenement.date <= date) {
        solde += evenement.type === 'revenu' ? evenement.montant : -evenement.montant;
        evenement.inclus = true;
      }
    }
    points.push({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short' }),
      montant: solde,
    });
  }
  const soldeFinal = points[points.length - 1].montant;
  const resume = document.createElement('p');
  resume.className = 'projection-solde';
  resume.textContent = 'Solde estimé à l’horizon : ' + formaterSolde(soldeFinal);
  carte.appendChild(resume);
  carte.appendChild(construireCourbeProjection(points));

  const recurrents = evenements.filter((e) => e.abonnementId && !e.aConfirmer);
  const operationsManuelles = evenements.filter((e) => e.source === 'manuelle');
  const echeancesAConfirmer = evenements.filter((e) => e.aConfirmer);
  let nombreLignes = 0;
  const ajouterLigne = (libelleTexte, type, montantCentimes, detail, evenement) => {
    const ligne = document.createElement('div');
    ligne.className = 'projection-evenement';
    const libelle = document.createElement('span');
    libelle.textContent = libelleTexte;
    const montant = document.createElement('strong');
    montant.textContent = (type === 'revenu' ? '+' : '−') + formaterEuros(montantCentimes);
    ligne.append(libelle, montant);
    if (detail) {
      const sousTitre = document.createElement('small');
      sousTitre.textContent = detail;
      ligne.appendChild(sousTitre);
    }
    if (evenement) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'bouton secondaire';
      bouton.textContent = 'Confirmer';
      bouton.addEventListener('click', () =>
        confirmerEcheance(evenement.abonnementId, evenement.date));
      ligne.appendChild(bouton);
    }
    carte.appendChild(ligne);
    nombreLignes++;
  };

  if (recurrents.length) {
    const titreRecurrents = document.createElement('h3');
    titreRecurrents.textContent = 'Récurrents sur la période';
    carte.appendChild(titreRecurrents);
  }
  const revenusRecurrents = recurrents.filter((e) => e.type === 'revenu');
  if (revenusRecurrents.length) {
    ajouterLigne(
      'Salaires et revenus récurrents',
      'revenu',
      revenusRecurrents.reduce((total, e) => total + e.montant, 0),
      revenusRecurrents.length + ' échéance(s) sur la période'
    );
  }
  const depensesRecurrentes = recurrents.filter((e) => e.type === 'depense');
  if (depensesRecurrentes.length) {
    ajouterLigne(
      'Abonnements',
      'depense',
      depensesRecurrentes.reduce((total, e) => total + e.montant, 0),
      depensesRecurrentes.length + ' échéance(s) sur la période'
    );
  }

  if (operationsManuelles.length) {
    const titreManuelles = document.createElement('h3');
    titreManuelles.textContent = 'Opérations futures saisies à la main';
    carte.appendChild(titreManuelles);
    for (const operation of operationsManuelles) {
      ajouterLigne(
        dateCourte(operation.date) + ' · ' + operation.nom,
        operation.type,
        operation.montant
      );
    }
  }

  if (echeancesAConfirmer.length) {
    const titreEcheances = document.createElement('h3');
    titreEcheances.textContent = 'Échéances à confirmer';
    carte.appendChild(titreEcheances);
    for (const evenement of echeancesAConfirmer) {
      ajouterLigne(
        dateCourte(evenement.date) + ' · ' + evenement.nom,
        evenement.type,
        evenement.montant,
        null,
        evenement
      );
    }
  }

  if (!nombreLignes) {
    const vide = document.createElement('p');
    vide.className = 'vide';
    vide.textContent = 'Aucune opération manuelle ou échéance prévue dans cette période.';
    carte.appendChild(vide);
  }
  return carte;
}

function rendreProjection() {
  $('select-horizon-projection').value = String(horizonProjection);
  const conteneur = $('projection-contenu');
  conteneur.replaceChildren(construireCarteProjection());
}

function construireCourbeProjection(points) {
  const hauteur = 150, largeur = 360, marge = 20;
  const valeurs = points.map((p) => p.montant);
  const mini = Math.min(0, ...valeurs);
  const maxi = Math.max(0, ...valeurs);
  const amplitude = maxi - mini || 1;
  const coordonnees = points.map((p, index) => ({
    x: marge + index * (largeur - 2 * marge) / Math.max(points.length - 1, 1),
    y: hauteur - marge - ((p.montant - mini) / amplitude) * (hauteur - 2 * marge),
  }));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + largeur + ' ' + hauteur);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Projection du solde sur ' + horizonProjection + ' mois');
  const zero = document.createElementNS(svg.namespaceURI, 'line');
  const zeroY = hauteur - marge - ((0 - mini) / amplitude) * (hauteur - 2 * marge);
  zero.setAttribute('x1', marge);
  zero.setAttribute('x2', largeur - marge);
  zero.setAttribute('y1', zeroY);
  zero.setAttribute('y2', zeroY);
  zero.setAttribute('stroke', '#b0b8b0');
  zero.setAttribute('stroke-dasharray', '4 4');
  svg.appendChild(zero);
  const ligne = document.createElementNS(svg.namespaceURI, 'polyline');
  ligne.setAttribute('points', coordonnees.map((p) => p.x + ',' + p.y).join(' '));
  ligne.setAttribute('fill', 'none');
  ligne.setAttribute('stroke', '#00897b');
  ligne.setAttribute('stroke-width', '3');
  ligne.setAttribute('stroke-linecap', 'round');
  ligne.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(ligne);
  coordonnees.forEach((p) => {
    const point = document.createElementNS(svg.namespaceURI, 'circle');
    point.setAttribute('cx', p.x);
    point.setAttribute('cy', p.y);
    point.setAttribute('r', '3');
    point.setAttribute('fill', '#00897b');
    svg.appendChild(point);
  });
  const labelsDates = document.createElement('div');
  labelsDates.className = 'projection-mois';
  labelsDates.style.gridTemplateColumns = 'repeat(' + points.length + ', minmax(0, 1fr))';
  points.forEach((p) => {
    const label = document.createElement('span');
    label.textContent = p.label;
    labelsDates.appendChild(label);
  });
  const conteneur = document.createElement('div');
  conteneur.appendChild(svg);
  conteneur.appendChild(labelsDates);
  return conteneur;
}

function confirmerEcheance(id, date) {
  const abonnement = abonnements.find((a) => a.id === id);
  if (!abonnement || abonnement.archivee || abonnement.prochaineDate !== date || date > dateLocale()) return;
  const entree = {
    id: nouvelId(), date, montant: abonnement.montant,
    categorieId: abonnement.categorieId, note: abonnement.nom,
    source: abonnement.source === 'test' ? 'test' : 'abonnement',
    abonnementId: abonnement.id, creeLe: new Date().toISOString(),
  };
  (abonnement.type === 'revenu' ? revenus : depenses).push(entree);
  abonnement.prochaineDate = dateSuivanteAbonnement(abonnement, date);
  sauvegarder();
  rafraichirTout();
  montrerToast('Échéance confirmée ✔');
}

/* ---------- 10. ONGLET RÉGLAGES : CATÉGORIES ---------- */

function construireLigneCategorie(c) {
  const ligne = document.createElement('div');
  ligne.className = 'categorie-ligne' + (c.archivee ? ' archivee' : '');

  const point = document.createElement('span');
  point.className = 'point';
  point.style.background = couleurCategorie(c);

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

  const selecteurCouleur = creerSelecteurCouleur(
    couleurCategorie(c),
    (nouvelleCouleur) => {
      c.couleur = nouvelleCouleur;
      sauvegarder();
      rendreReglages();
    },
    'la catégorie ' + c.nom,
    true
  );
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
    const abonnementUtilise = abonnements.some((a) =>
      a.type === 'depense' && a.categorieId === c.id);
    if (utilisee > 0 || abonnementUtilise) {
      alert('Cette catégorie est utilisée. Archive-la plutôt.');
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

  boutons.appendChild(selecteurCouleur);
  ligne.appendChild(boutons);
  return ligne;
}

function rendreListeLabels() {
  const conteneur = $('liste-labels');
  conteneur.innerHTML = '';
  for (const lb of labels) {
    const ligne = document.createElement('div');
    ligne.className = 'categorie-ligne' + (lb.archivee ? ' archivee' : '');

    const point = document.createElement('span');
    point.className = 'point';
    point.style.background = lb.couleur || '#9e9e9e';

    const nom = document.createElement('span');
    nom.textContent = lb.nom;

    const boutons = document.createElement('div');
    boutons.className = 'boutons';

    const selecteurCouleur = creerSelecteurCouleur(
      lb.couleur || '#9e9e9e',
      (nouvelleCouleur) => {
        lb.couleur = nouvelleCouleur;
        sauvegarder();
        rendreListeLabels();
      },
      'le label ' + lb.nom,
      true
    );

    const renommer = document.createElement('button');
    renommer.textContent = '✏️';
    renommer.addEventListener('click', () => {
      const nouveau = (prompt('Nouveau nom :', lb.nom) || '').trim();
      if (!nouveau || categories.concat(labels).some(
        (x) => x.id !== lb.id && normaliser(x.nom) === normaliser(nouveau))) return;
      lb.nom = nouveau;
      sauvegarder();
      rendreListeLabels();
    });
    const archiver = document.createElement('button');
    archiver.textContent = lb.archivee ? '↩️' : '📦';
    archiver.addEventListener('click', () => {
      lb.archivee = !lb.archivee;
      sauvegarder();
      rendreListeLabels();
    });
    boutons.appendChild(selecteurCouleur);
    boutons.appendChild(renommer);
    boutons.appendChild(archiver);

    ligne.appendChild(point);
    ligne.appendChild(nom);
    ligne.appendChild(boutons);
    conteneur.appendChild(ligne);
  }
}

function rendreReglages() {
  const conteneur = $('liste-categories');
  conteneur.innerHTML = '';
  for (const c of categories) conteneur.appendChild(construireLigneCategorie(c));
  remplirCategoriesAbonnement($('select-type-abonnement').value || 'depense');
  rendreCategoriesRevenus();
  rendreAbonnements();
  rendreListeLabels();
  rendreInfoExport();
}

function rendreCategoriesRevenus() {
  const conteneur = $('liste-categories-revenus');
  conteneur.innerHTML = '';
  for (const categorie of categoriesRevenus) {
    const ligne = document.createElement('div');
    ligne.className = 'categorie-ligne' + (categorie.archivee ? ' archivee' : '');
    const point = document.createElement('span');
    point.className = 'point';
    point.style.background = '#00897b';
    const nom = document.createElement('span');
    nom.textContent = categorie.nom;
    ligne.appendChild(point);
    ligne.appendChild(nom);
    if (categorie.archivee) {
      const archive = document.createElement('span');
      archive.className = 'tag';
      archive.textContent = 'archivée';
      ligne.appendChild(archive);
    }
    const boutons = document.createElement('div');
    boutons.className = 'boutons';
    const renommer = document.createElement('button');
    renommer.type = 'button';
    renommer.textContent = '✏️';
    renommer.title = 'Renommer';
    renommer.addEventListener('click', () => {
      const nouveau = (prompt('Nouveau nom :', categorie.nom) || '').trim();
      if (!nouveau) return;
      if (categoriesRevenus.some((c) => c.id !== categorie.id &&
          normaliser(c.nom) === normaliser(nouveau))) {
        alert('Une catégorie de revenu porte déjà ce nom.');
        return;
      }
      categorie.nom = nouveau;
      sauvegarder();
      rafraichirTout();
    });
    const archiver = document.createElement('button');
    archiver.type = 'button';
    archiver.textContent = categorie.archivee ? '↩️' : '📦';
    archiver.title = categorie.archivee ? 'Désarchiver' : 'Archiver';
    archiver.addEventListener('click', () => {
      categorie.archivee = !categorie.archivee;
      sauvegarder();
      rafraichirTout();
    });
    const supprimer = document.createElement('button');
    supprimer.type = 'button';
    supprimer.textContent = '🗑️';
    supprimer.title = 'Supprimer définitivement';
    supprimer.addEventListener('click', () => {
      const utilisee = revenus.some((r) => r.categorieId === categorie.id) ||
        abonnements.some((a) => a.type === 'revenu' && a.categorieId === categorie.id);
      if (utilisee) {
        alert('Cette catégorie est utilisée. Archive-la plutôt.');
        return;
      }
      if (!confirm('Supprimer définitivement « ' + categorie.nom + ' » ?')) return;
      categoriesRevenus = categoriesRevenus.filter((c) => c.id !== categorie.id);
      sauvegarder();
      rafraichirTout();
    });
    boutons.append(renommer, archiver, supprimer);
    ligne.appendChild(boutons);
    conteneur.appendChild(ligne);
  }
}

function remplirCategoriesAbonnement(type) {
  const select = $('select-categorie-abonnement');
  select.innerHTML = '';
  select.appendChild(new Option('— choisir une catégorie —', ''));
  for (const categorie of categoriesActives(type)) {
    select.appendChild(new Option(categorie.nom, categorie.id));
  }
}

function rendreAbonnements() {
  const conteneur = $('liste-abonnements');
  conteneur.innerHTML = '';
  for (const abonnement of abonnements) {
    const ligne = document.createElement('div');
    ligne.className = 'abonnement-ligne' + (abonnement.archivee ? ' archivee' : '');
    const detail = document.createElement('div');
    detail.className = 'quoi';
    const nom = document.createElement('strong');
    nom.textContent = abonnement.nom + (abonnement.archivee ? ' · suspendu' : '');
    const info = document.createElement('small');
    const categorie = categorieOperation(abonnement.type, abonnement.categorieId);
    const frequence = abonnement.frequence === 'hebdomadaire' ? 'chaque semaine' :
      abonnement.frequence === 'annuelle' ? 'chaque année' : 'chaque mois';
    info.textContent = formaterEuros(abonnement.montant) + ' · ' + frequence +
      ' · ' + (categorie ? categorie.nom : 'catégorie supprimée') +
      ' · prochaine échéance ' + dateCourte(abonnement.prochaineDate);
    detail.append(nom, info);
    const boutons = document.createElement('div');
    boutons.className = 'boutons';
    const suspendre = document.createElement('button');
    suspendre.type = 'button';
    suspendre.textContent = abonnement.archivee ? '▶️' : '⏸️';
    suspendre.title = abonnement.archivee ? 'Reprendre' : 'Suspendre';
    suspendre.addEventListener('click', () => {
      abonnement.archivee = !abonnement.archivee;
      sauvegarder();
      rafraichirTout();
    });
    const supprimer = document.createElement('button');
    supprimer.type = 'button';
    supprimer.textContent = '🗑️';
    supprimer.title = 'Supprimer l’abonnement';
    supprimer.addEventListener('click', () => {
      if (!confirm('Supprimer l’abonnement « ' + abonnement.nom + ' » ?')) return;
      abonnements = abonnements.filter((a) => a.id !== abonnement.id);
      sauvegarder();
      rafraichirTout();
    });
    boutons.append(suspendre, supprimer);
    ligne.append(detail, boutons);
    conteneur.appendChild(ligne);
  }
  if (!abonnements.length) {
    const vide = document.createElement('p');
    vide.className = 'vide';
    vide.textContent = 'Aucun abonnement enregistré.';
    conteneur.appendChild(vide);
  }
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
    categoriesRevenus,
    revenus,
    abonnements,
    soldeInitialCentimes: soldeInitial,
    dateSoldeInitial,
    soldeInitialVerrouille,
    horizonProjection,
    tickets,
    labels,
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
  const lignes = ['Type;Date;Montant (€);Catégorie;Note'];
  const trie = [
    ...depenses.map((d) => ({ ...d, type: 'depense' })),
    ...revenus.map((r) => ({ ...r, type: 'revenu' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  for (const operation of trie) {
    const cat = categorieOperation(operation.type, operation.categorieId);
    lignes.push([
      operation.type === 'revenu' ? 'Revenu' : 'Dépense',
      operation.date,
      (operation.montant / 100 * (operation.type === 'revenu' ? 1 : -1)).toFixed(2).replace('.', ','),
      cat ? cat.nom : '(supprimée)',
      (operation.note || '').replaceAll(';', ','),
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
      (d) => d && dateValide(d.date) && Number.isSafeInteger(d.montant)
    );
    const revenusValides = Array.isArray(donnees.revenus) ? donnees.revenus.filter(
      (r) => r && dateValide(r.date) && Number.isSafeInteger(r.montant)
    ) : [];
    const abonnementsValides = Array.isArray(donnees.abonnements)
      ? donnees.abonnements.filter(abonnementValide) : [];
    if (!confirm('Remplacer les données actuelles par celles du fichier ?\n(' +
        depensesValides.length + ' dépenses, ' + revenusValides.length + ' revenus et ' +
        abonnementsValides.length + ' abonnements)')) return;
    categories = donnees.categories;
    depenses = depensesValides;
    categoriesRevenus = Array.isArray(donnees.categoriesRevenus)
      ? donnees.categoriesRevenus
      : CATEGORIES_REVENUS_DEPART.map((nom) => ({ id: nouvelId(), nom, archivee: false }));
    revenus = revenusValides;
    abonnements = abonnementsValides;
    const soldeImporteValide = Number.isSafeInteger(donnees.soldeInitialCentimes);
    soldeInitial = soldeImporteValide
      ? donnees.soldeInitialCentimes : 0;
    dateSoldeInitial = dateValide(donnees.dateSoldeInitial) && donnees.dateSoldeInitial <= dateLocale()
      ? donnees.dateSoldeInitial : dateLocale();
    soldeInitialVerrouille = typeof donnees.soldeInitialVerrouille === 'boolean'
      ? donnees.soldeInitialVerrouille : soldeImporteValide;
    horizonProjection = normaliserHorizonProjection(donnees.horizonProjection);
    tickets = Array.isArray(donnees.tickets) ? donnees.tickets : [];
    labels = Array.isArray(donnees.labels) ? donnees.labels : labels;
    sauvegarder();
    rafraichirTout();
    montrerToast('Import réussi : ' + depenses.length + ' dépenses, ' +
      revenus.length + ' revenus et ' + abonnements.length + ' abonnements ✔');
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

const MOIS_HISTORIQUE_TEST = 6;
const TICKETS_PAR_MOIS_TEST = 3;

function installerJeuDeTest() {
  const revenuMensuelMoyen = parseMontant($('champ-revenu-moyen-test').value);
  if (revenuMensuelMoyen === null) {
    alert('Saisis un revenu mensuel moyen valide.');
    return;
  }
  if (!confirm('Installer le jeu de test ?\n\nEfface toutes les données actuelles, puis crée deux dépenses unitaires, ' +
      (MOIS_HISTORIQUE_TEST * TICKETS_PAR_MOIS_TEST) + ' tickets (' + TICKETS_PAR_MOIS_TEST +
      ' par mois sur ' + MOIS_HISTORIQUE_TEST + ' mois), six revenus mensuels et des abonnements fictifs.\nRevenu mensuel moyen : ' +
      formaterEuros(revenuMensuelMoyen) + '.')) return;
  localStorage.setItem(CLE_REVENU_MOYEN_TEST, String(revenuMensuelMoyen));

  // 1. Efface les données budgétaires, en conservant le paramètre du générateur.
  localStorage.removeItem(CLE_DEPENSES);
  localStorage.removeItem(CLE_CATEGORIES);
  localStorage.removeItem(CLE_REVENUS);
  localStorage.removeItem(CLE_CATEGORIES_REVENUS);
  localStorage.removeItem(CLE_ABONNEMENTS);
  localStorage.removeItem(CLE_SOLDE_INITIAL);
  localStorage.removeItem(CLE_DATE_SOLDE_INITIAL);
  localStorage.removeItem(CLE_SOLDE_INITIAL_VERROUILLE);
  localStorage.removeItem(CLE_HORIZON_PROJECTION);
  localStorage.removeItem(CLE_TICKETS);
  localStorage.removeItem(CLE_LABELS);
  localStorage.removeItem(CLE_DERNIER_EXPORT);
   
  chargerDepuisStockage();      // recrée les catégories de départ
  categorieChoisie = null;

  const rng = rngDepuisGraine(20261126);
  const totalPoids = PROFILS_TEST.reduce((s, p) => s + p.poids, 0);

  const idCategorieParNom = (type, nom) => {
    const categorie = categoriesActives(type).find((c) => normaliser(c.nom) === normaliser(nom))
      || categoriesActives(type)[0];
    return categorie ? categorie.id : null;
  };

  // Choix pondéré d'un profil : le tirage respecte les poids.
  const piocherProfil = () => {
    let r = rng() * totalPoids;
    for (const p of PROFILS_TEST) { r -= p.poids; if (r < 0) return p; }
    return PROFILS_TEST[0];
  };
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

  // 2. Deux dépenses unitaires à 4 minutes d'écart pour vérifier le tri intra-journée.
  const AUJOURDHUI = new Date();
  const hier = new Date(AUJOURDHUI); hier.setDate(hier.getDate() - 1);
  depenses.push(creer(hier, 12, 3));
  depenses.push(creer(hier, 12, 7));

  // 3. Un revenu par mois, au montant moyen choisi dans les réglages de test.
  const categorieSalaire = idCategorieParNom('revenu', 'Salaire');
  for (let i = 0; i < MOIS_HISTORIQUE_TEST; i++) {
    const paiement = new Date(AUJOURDHUI.getFullYear(), AUJOURDHUI.getMonth() - i, 1);
    revenus.push({
      id: nouvelId(), date: dateLocale(paiement), montant: revenuMensuelMoyen,
      categorieId: categorieSalaire, note: 'Salaire mensuel', source: 'test',
      creeLe: new Date(paiement.getFullYear(), paiement.getMonth(), 1, 9).toISOString(),
    });
  }

  // 4. Des abonnements actifs pour alimenter la projection et ses échéances.
  const prochainMois = new Date(AUJOURDHUI.getFullYear(), AUJOURDHUI.getMonth() + 1, 1);
  const dateAbonnement = (jour) =>
    dateLocale(new Date(prochainMois.getFullYear(), prochainMois.getMonth(), jour));
  const creerAbonnementTest = (nom, type, montant, categorieId, frequence, prochaineDate) => {
    const [annee, mois, jourMois] = prochaineDate.split('-').map(Number);
    abonnements.push({
      id: nouvelId(), nom, type, montant, categorieId, frequence, prochaineDate,
      jourMois, moisAnnee: mois - 1, archivee: false, source: 'test',
      creeLe: new Date().toISOString(),
    });
  };
  const categorieDivers = idCategorieParNom('depense', 'Divers');
  creerAbonnementTest('Salaire', 'revenu', revenuMensuelMoyen, categorieSalaire,
    'mensuelle', dateAbonnement(1));
  creerAbonnementTest('Internet', 'depense', 3999, categorieDivers,
    'mensuelle', dateAbonnement(5));
  creerAbonnementTest('Forfait téléphonique', 'depense', 1999, categorieDivers,
    'mensuelle', dateAbonnement(10));
  creerAbonnementTest('Presse numérique', 'depense', 499, categorieDivers,
    'hebdomadaire', dateAbonnement(15));
  creerAbonnementTest('Assurance habitation', 'depense', 14500, categorieDivers,
    'annuelle', dateAbonnement(20));

  // 5. Trois tickets par mois, avec leurs dépenses agrégées liées.
  const labelBio = labels.find((label) => /bio/i.test(label.nom));
  const labelEvitable = labels.find((label) => /évitable/i.test(label.nom));
  for (let i = 0; i < MOIS_HISTORIQUE_TEST; i++) {
    const premier = new Date(AUJOURDHUI.getFullYear(), AUJOURDHUI.getMonth() - i, 1);
    const dernierJour = i === 0
      ? AUJOURDHUI.getDate()
      : new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
    for (let n = 0; n < TICKETS_PAR_MOIS_TEST; n++) {
      const jour = 1 + Math.floor(rng() * dernierJour);
      const dateTicket = new Date(premier.getFullYear(), premier.getMonth(), jour);
      const modele = TICKETS_SIMU[Math.floor(rng() * TICKETS_SIMU.length)];
      const lignes = modele.lignes.map(([libelle, cents]) => {
        const regle = REGLES_SIMU.find((r) =>
          new RegExp(r.mot).test(libelle) && categories.some((c) => c.nom === r.cat));
        const categorie = regle ? categories.find((c) => c.nom === regle.cat) : null;
        const ligneLabels = [];
        if (labelBio && /POMMES|TOMATES/.test(libelle) && rng() < 0.6) {
          ligneLabels.push(labelBio.id);
        }
        if (labelEvitable && /CIGARETTES|VIN/.test(libelle)) {
          ligneLabels.push(labelEvitable.id);
        }
        return { id: nouvelId(), label: libelle, cents, catId: categorie ? categorie.id : null, labels: ligneLabels };
      });
      const ticket = {
        id: nouvelId(), magasin: modele.magasin, date: dateLocale(dateTicket),
        lignes, labels: [], source: 'test',
        creeLe: new Date(dateTicket.getFullYear(), dateTicket.getMonth(), dateTicket.getDate(), 12).toISOString(),
      };
      tickets.push(ticket);
      const totaux = new Map();
      for (const ligne of lignes) {
        if (ligne.catId) totaux.set(ligne.catId, (totaux.get(ligne.catId) || 0) + ligne.cents);
      }
      for (const [categorieId, montant] of totaux) {
        depenses.push({
          id: nouvelId(), date: ticket.date, montant, categorieId,
          note: ticket.magasin, source: 'test', ticketId: ticket.id,
          creeLe: ticket.creeLe,
        });
      }
    }
  }

  sauvegarder();
  rafraichirTout();
  afficherOnglet('historique');
  const depensesUnitaires = depenses.filter((depense) => !depense.ticketId).length;
  montrerToast('Jeu installé : ' + depensesUnitaires + ' dépenses unitaires, ' +
    tickets.length + ' tickets, ' + revenus.length + ' revenus et ' +
    abonnements.length + ' abonnements ✔');
}

// Retire UNIQUEMENT les enregistrements marqués source: 'test' :
// les vraies données éventuelles sont préservées.
function purgerDonneesTest() {
  const avantDepenses = depenses.length;
  const avantRevenus = revenus.length;
  const avantTickets = tickets.length;
  const avantAbonnements = abonnements.length;
  depenses = depenses.filter((d) => d.source !== 'test');
  revenus = revenus.filter((r) => r.source !== 'test');
  tickets = tickets.filter((t) => t.source !== 'test');
  abonnements = abonnements.filter((a) => a.source !== 'test');
  const retirees = avantDepenses !== depenses.length || avantRevenus !== revenus.length ||
    avantTickets !== tickets.length || avantAbonnements !== abonnements.length;
  if (!retirees) { montrerToast('Aucune donnée de test à retirer'); return; }
  sauvegarder();
  rafraichirTout();
  montrerToast('Données de test retirées');
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
    let catId = null;
    const regle = REGLES_SIMU.find((r) =>
      new RegExp(r.mot).test(label) && categories.some((c) => c.nom === r.cat));
    if (regle) {
      const c = categories.find((x) => x.nom === regle.cat);
      if (c) catId = c.id;
    }
    const l = { id: nouvelId(), label, cents, catId, labels: [] };
    const bio = labels.find((x) => /bio/i.test(x.nom));
    if (bio && /\bBIO\b/i.test(label)) l.labels.push(bio.id);
    return l;
  });
  simuLabels = [];
}

// Construit tous les groupes de dépôt (dont le bac « Non catégorisé »),
// puis rend leur contenu. Chaque zone porte data-cat-id ('' = le bac).
function rendreSimulation() {
  const titre = simuMode === 'edition' ? 'Ticket : ' + simuMagasin + ' (modification)'
              : simuMode === 'consultation' ? 'Ticket : ' + simuMagasin
              : 'Nouveau ticket : ' + simuMagasin;
  $('simu-titre').textContent = titre;
  $('simu-info').textContent = '';
  $('simu-aide').hidden = !simuAideVisible;
  $('bouton-simu-valider').hidden = simuMode === 'consultation' ||
    (simuMode === 'edition' && JSON.stringify({ lignes: simuLignes, labels: simuLabels }) === simuEtatInitial);
  $('bouton-simu-valider').textContent = simuMode === 'edition'
    ? 'Enregistrer les modifications' : 'Valider le ticket';
  $('bouton-simu-modifier').hidden = (simuMode !== 'consultation');
  $('bouton-simu-supprimer').hidden = (simuMode !== 'consultation');
  $('bouton-simu-abandonner').hidden = (simuMode === 'consultation');
  $('bouton-simu-abandonner').textContent = 'Abandonner';

     // — Badges d'état dans le titre (visu permanente demandée)
  const badges = etatLabelsTicket(simuLabels, simuLignes);
  const zoneBadge = $('simu-badges');
  zoneBadge.innerHTML = '';
  zoneBadge.hidden = badges.length === 0;
  for (const e of badges) zoneBadge.appendChild(creerBadge(null, e));

  // — Rangée des labels du ticket (création/édition seulement)
  const rangée = $('simu-labels-ticket');
  rangée.innerHTML = '';
  const labelsActifs = labels.filter((x) => !x.archivee);
  rangée.hidden = simuMode === 'consultation' || labelsActifs.length === 0;
  $('simu-labels-info').hidden = rangée.hidden;
  if (!rangée.hidden) {
    for (const lb of labelsActifs) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (simuLabels.includes(lb.id) ? ' choisie' : '');
      chip.textContent = lb.nom;
      chip.style.borderColor = lb.couleur || '#9e9e9e';
      if (simuLabels.includes(lb.id)) chip.style.background = lb.couleur;
      chip.addEventListener('click', () => {
        simuLabels = simuLabels.includes(lb.id)
          ? simuLabels.filter((x) => x !== lb.id)
          : [...simuLabels, lb.id];
        rendreSimulation();
      });
      rangée.appendChild(chip);
    }
  }

  const conteneur = $('simu-groupes');
  conteneur.innerHTML = '';

  const zones = [];
  zones.push({ id: '', nom: '❓ Non catégorisé' });
  for (const cat of categories.filter((c) => !c.archivee)) {
    zones.push({ id: cat.id, nom: cat.nom, couleur: couleurCategorie(cat) });
  }

  for (const zone of zones) {
    const lignesZone = simuLignes.filter((l) => (l.catId ?? '') === zone.id);
    if (lignesZone.length === 0) continue;

    const groupe = document.createElement('div');
    groupe.className = 'simu-groupe';
    groupe.dataset.catId = zone.id;

    const titre = document.createElement('h3');
    titre.textContent = zone.nom +
      ' — ' + formaterEuros(lignesZone.reduce((s, l) => s + l.cents, 0));
    if (zone.couleur) {
      const dot = document.createElement('span');
      dot.style.color = zone.couleur;
      dot.textContent = '● ';
      titre.prepend(dot);
    }
    groupe.appendChild(titre);

    for (const l of lignesZone) {
      groupe.appendChild(construireLigneSimu(l));
    }
    conteneur.appendChild(groupe);
  }
}

let simuLigneChoisie = null; // la ligne en cours d'affectation via le picker

// Construit une ligne : poignée (drag) + libellé (tap → picker) + prix.
function construireLigneSimu(l) {
  const ligne = document.createElement('div');
  ligne.className = 'simu-ligne';
  if (simuMode === 'consultation') ligne.classList.add('lecture-seule');

  const poignee = document.createElement('span');
  poignee.className = 'simu-poignee';
  poignee.textContent = '⠿';
  poignee.title = simuMode === 'consultation' ? 'Lecture seule' : 'Glisser vers une catégorie';
  // Lecture seule (consultation) : ligne inerte — pas de drag, pas de picker.
  if (simuMode !== 'consultation') {
    brancherDeplacement(l, poignee);
    poignee.addEventListener('click', (e) => e.stopPropagation());
  }

  const label = document.createElement('span');
  label.textContent = l.label;

  const prix = document.createElement('span');
  prix.className = 'prix';
  prix.textContent = formaterEuros(l.cents);

  ligne.appendChild(poignee);

  // Mini-étiquettes à droite de la poignée, pour ne pas déplacer son alignement.
  for (const idLbl of (l.labels || [])) {
    const lb = labelParId(idLbl);
    if (!lb) continue;
    const mini = document.createElement('span');
    mini.className = 'mini-label';
    mini.style.background = lb.couleur || '#9e9e9e';
    mini.textContent = lb.nom;
    ligne.appendChild(mini);
  }

  ligne.appendChild(label);
  ligne.appendChild(prix);

  // Lecture seule (consultation) : ligne inerte — pas de drag, pas de picker.
  if (simuMode !== 'consultation') {
    ligne.addEventListener('click', () => ouvrirPicker(l));
  }

  return ligne;
}

// Glisser-déposer aux Pointer Events, démarré UNIQUEMENT depuis la poignée
// (le scroll du ticket n'est jamais intercepté ailleurs sur la ligne).
function brancherDeplacement(l, poignee) {
  poignee.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const departX = e.clientX, departY = e.clientY;
    let dest = null;
    const ligne = poignee.parentElement;

    // La ligne suivie ne doit pas « manger » le point :
    // sinon elementFromPoint la renvoie elle-même, jamais la zone.
    ligne.style.pointerEvents = 'none';
    ligne.classList.add('drag');
    poignee.setPointerCapture(e.pointerId);

    const bouger = (ev) => {
      ligne.style.transform =
        'translate(' + (ev.clientX - departX) + 'px,' + (ev.clientY - departY) + 'px)';
      const cible = document.elementFromPoint(ev.clientX, ev.clientY);
      dest = cible ? cible.closest('.simu-groupe') : null;
      document.querySelectorAll('.simu-groupe')
        .forEach((z) => z.classList.toggle('survol', z === dest));
    };
    const finir = () => {
      poignee.removeEventListener('pointermove', bouger);
      poignee.removeEventListener('pointerup', finir);
      poignee.removeEventListener('pointercancel', finir);
      ligne.style.pointerEvents = '';
      ligne.classList.remove('drag');
      ligne.style.transform = '';
      document.querySelectorAll('.simu-groupe').forEach((z) => z.classList.remove('survol'));
      if (dest && dest.dataset) {
        l.catId = dest.dataset.catId === '' ? null : dest.dataset.catId;
        rendreSimulation();
      }
    };
    poignee.addEventListener('pointermove', bouger);
    poignee.addEventListener('pointerup', finir);
    poignee.addEventListener('pointercancel', finir);
  });
}

// ---- Le picker : la liste des catégories EXISTANTES, en chips ----
function ouvrirPicker(l) {
  if (simuMode === 'consultation') return; // imperméable en lecture seule
  simuLigneChoisie = l;
  $('simu-picker-label').textContent = l.label;
  const liste = $('simu-picker-liste');
  liste.innerHTML = '';
  for (const c of categories.filter((x) => !x.archivee)) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'chip' + (l.catId === c.id ? ' choisie' : '');
    bouton.textContent = c.nom;
    bouton.style.borderColor = couleurCategorie(c);
    bouton.addEventListener('click', () => {
      l.catId = c.id;           // re-taper la chip choisie = retirer la ligne ? non :
      fermerPicker();
      rendreSimulation();
    });
    liste.appendChild(bouton);
  }
  // Une chip « retirer la catégorie » si la ligne en a déjà une.
  if (l.catId) {
    const retirer = document.createElement('button');
    retirer.type = 'button';
    retirer.className = 'chip';
    retirer.textContent = '✕ non catégorisée';
    retirer.addEventListener('click', () => { l.catId = null; fermerPicker(); rendreSimulation(); });
    liste.appendChild(retirer);
  }
  const rangéeLabels = $('simu-picker-labels');
  const infoLabels = $('simu-picker-labels-info');
  rangéeLabels.innerHTML = '';
  const labelsActifs = labels.filter((x) => !x.archivee);
  rangéeLabels.hidden = labelsActifs.length === 0;
  infoLabels.hidden = rangéeLabels.hidden;
  for (const lb of labelsActifs) {
    const chip = document.createElement('button');
    chip.type = 'button';
    // ^ opérateur : la ternaire s'applique au className — garde-le comme ci-dessous
    chip.className = 'chip' + ((l.labels || []).includes(lb.id) ? ' choisie' : '');
    chip.textContent = lb.nom;
    chip.style.borderColor = lb.couleur || '#9e9e9e';
    if ((l.labels || []).includes(lb.id)) chip.style.background = lb.couleur || '#9e9e9e';
    chip.addEventListener('click', () => {
      l.labels = (l.labels || []).includes(lb.id)
        ? l.labels.filter((x) => x !== lb.id)
        : [...(l.labels || []), lb.id];
      rendreSimulation();
      ouvrirPicker(l); // reste ouvert : plusieurs labels possibles
    });
    rangéeLabels.appendChild(chip);
  }
  $('simu-picker').hidden = false;
  $('simu-picker').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function fermerPicker() {
  simuLigneChoisie = null;
  $('simu-picker').hidden = true;
}

// Validation : stocke le ticket ENTIer, puis agrège ses lignes catégorisées
// en dépenses réelles (une par catégorie), marquées ticketId — ainsi
// l'historique montre UNE saisie, et la réédition peut remplacer proprement.
function validerTicketSimule() {
  const restantes = simuLignes.filter((l) => l.catId === null).length;
  if (restantes > 0 &&
      !confirm(restantes + ' ligne(s) non catégorisée(s) ne compteront pas dans le total. Continuer ?')) return;

  const totaux = new Map();
  for (const l of simuLignes) {
    if (l.catId) totaux.set(l.catId, (totaux.get(l.catId) ?? 0) + l.cents);
  }

  if (simuMode === 'edition') {
    // Réédition : on remplace lignes du ticket + dépenses agrégées.
    const t = tickets.find((x) => x.id === simuTicketEnEdition);
    depenses = depenses.filter((d) => d.ticketId !== simuTicketEnEdition);
    t.magasin = simuMagasin;
    t.lignes = simuLignes;
    t.labels = simuLabels;
  } else {
    const t = { id: nouvelId(), magasin: simuMagasin, date: dateLocale(),
                lignes: simuLignes, labels: simuLabels,
                source: 'test', creeLe: new Date().toISOString() };
    tickets.push(t);
    simuTicketEnEdition = t.id;
  }

  const dateTicket = dateLocale();
  for (const [categorieId, cents] of totaux) {
    depenses.push({
      id: nouvelId(), date: dateTicket, montant: cents, categorieId,
      note: simuMagasin, source: 'test', ticketId: simuTicketEnEdition,
      creeLe: new Date().toISOString(),
    });
  }
  sauvegarder();
  rafraichirTout();
  montrerToast('Ticket enregistré : ' + totaux.size + ' dépense(s) ✔');
  afficherOnglet('historique');
}

// Consultation (lecture seule) ou édition : prélève une COPIE des lignes —
// « Retour » depuis la consultation ou l'édition ne dégrade jamais le ticket.
function ouvrirFicheTicket(id, mode = 'consultation') {
  const t = tickets.find((x) => x.id === id);
  if (!t) return;
  simuTicketEnEdition = id;
  simuMode = mode;
  simuMagasin = t.magasin;
  simuLabels = (t.labels || []).slice();
  simuAideVisible = !localStorage.getItem(CLE_AIDE_TICKET);
  if (simuAideVisible) localStorage.setItem(CLE_AIDE_TICKET, '1');
  simuLignes = t.lignes.map((l) => ({
    id: l.id, label: l.label, cents: l.cents,
    catId: l.catId ?? null,
    labels: (l.labels || []).slice(),
  }));
  fermerPicker();
  rendreSimulation();
  afficherOnglet('simulation');
}

/* ====== fin simulation ticket ====== */

/* ---------- 12. DÉMARRAGE : câblage des événements + premier rendu ---------- */

function rafraichirTout() {
  mettreAJourFormulaireSoldeInitial();
  $('select-horizon-projection').value = String(horizonProjection);
  mettreAJourFormulaireType($('select-type-operation').value || 'depense',
    $('select-type-operation').value === 'revenu' ? $('champ-categorie').value : categorieChoisie);
  remplirCategoriesAbonnement($('select-type-abonnement').value || 'depense');
  rendreChips();
  afficherTotalMois();
  rendreHistorique();
  rendreBilan();
  rendreProjection();
  rendreReglages();
}

function demarrer() {
  const champsCalendrier = [
    {
      champ: 'champ-date', calendrier: 'calendrier-date',
      bouton: 'bouton-calendrier-date', dateMin: () => null, dateMax: dateMaxProjection,
    },
    {
      champ: 'champ-date-abonnement', calendrier: 'calendrier-abonnement',
      bouton: 'bouton-calendrier-abonnement', dateMin: dateLocale, dateMax: dateMaxProjection,
    },
    {
      champ: 'champ-date-solde-initial', calendrier: 'calendrier-solde',
      bouton: 'bouton-calendrier-solde', dateMin: () => null, dateMax: dateLocale,
    },
  ];
  for (const elements of champsCalendrier) {
    const champ = $(elements.champ);
    const calendrier = $(elements.calendrier);
    const bouton = $(elements.bouton);
    champ.addEventListener('input', () => formaterDateEnCours(champ));
    bouton.addEventListener('click', () => {
      if (!calendrier.hidden) {
        fermerCalendriersDate();
        return;
      }
      ouvrirCalendrierDate(champ, calendrier, bouton, elements.dateMin, elements.dateMax);
    });
  }
  document.addEventListener('click', (event) => {
    const calendrierOuvert = document.querySelector('.calendrier-personnalise:not([hidden])');
    if (!(event.target instanceof Element) || !calendrierOuvert ||
        !calendrierOuvert.closest('.date-saisie').contains(event.target)) {
      fermerCalendriersDate();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') fermerCalendriersDate();
  });

  // — Navigation
  for (const bouton of document.querySelectorAll('nav button')) {
    bouton.addEventListener('click', () => afficherOnglet(bouton.dataset.onglet));
  }
  $('bouton-saisir').addEventListener('click', () => afficherOnglet('saisir'));
  $('bouton-reglages').addEventListener('click', () => {
    const nom = $('onglet-reglages').hidden
      ? 'reglages'
      : (ongletAvantReglages || prefAccueil());
    afficherOnglet(nom);
  });

  // — Saisie
  $('form-depense').addEventListener('submit', (e) => {
    e.preventDefault(); // on gère nous-mêmes l'envoi (pas de reload de page)
    const centimes = parseMontant($('champ-montant').value);
    if (centimes === null) { alert('Saisis un montant valide (ex. 12,50).'); return; }
    const type = editionEnCours ? editionType : $('select-type-operation').value;
    const categorieId = $('champ-categorie').value;
    if (!categorieId) { alert('Choisis une catégorie.'); return; }
    const date = dateDepuisAffichage($('champ-date').value);
    if (!date) {
      alert('Saisis une date valide au format JJ/MM/AAAA.');
      return;
    }
    const note = $('champ-note').value.trim();
    if (date > dateMaxProjection()) {
      alert('La date dépasse l’horizon choisi dans la page Projection.');
      return;
    }
    const collection = type === 'revenu' ? revenus : depenses;

    if (editionEnCours) {
      const operation = collection.find((x) => x.id === editionEnCours);
      if (operation) {
        operation.date = date;
        operation.montant = centimes;
        operation.categorieId = categorieId;
        operation.note = note;
      }
      sauvegarder();
      afficherTotalMois();
      terminerEdition(false);
      montrerToast(type === 'revenu' ? 'Rentrée modifiée ✔' : 'Dépense modifiée ✔');
      afficherOnglet('historique');
    } else {
      collection.push({
        id: nouvelId(), date, montant: centimes,
        categorieId, note, source: 'manuelle', creeLe: new Date().toISOString(),
      });
      sauvegarder();
      if (type === 'depense') categorieChoisie = categorieId;
      afficherTotalMois();
      terminerEdition(true);
      rendreChips();
      const categorie = categorieOperation(type, categorieId);
      montrerToast(formaterEuros(centimes) + ' dans ' +
        (categorie ? categorie.nom : 'la catégorie') + ' ✔');
    }
  });
  $('select-type-operation').addEventListener('change', function () {
    mettreAJourFormulaireType(this.value);
  });
  $('bouton-annuler').addEventListener('click', () => terminerEdition(true));

  // — Historique : la recherche refiltre à chaque frappe.
  $('champ-recherche').addEventListener('input', rendreHistorique);

  // — Réglages : formulaire d'ajout de catégorie
  afficherSelecteurCouleurFormulaire(
    'selecteur-couleur-categorie',
    'champ-couleur-categorie',
    PALETTE_CATEGORIES[0],
    'la nouvelle catégorie'
  );
  afficherSelecteurCouleurFormulaire(
    'selecteur-couleur-label',
    'champ-couleur-label',
    PALETTE_LABELS[2],
    'le nouveau label'
  );
  $('select-pref-accueil').value = prefAccueil();
  $('select-pref-accueil').addEventListener('change', function () {
    localStorage.setItem(CLE_PREF_ACCUEIL, this.value);
    montrerToast('Page d’accueil enregistrée ✔');
  });
  $('select-horizon-projection').value = String(horizonProjection);
  $('select-horizon-projection').addEventListener('change', function () {
    const valeur = Number(this.value);
    if (!Number.isInteger(valeur) || valeur < 1 || valeur > 12) {
      alert('L’horizon doit être compris entre 1 et 12 mois.');
      this.value = String(horizonProjection);
      return;
    }
    horizonProjection = valeur;
    sauvegarder();
    rendreProjection();
  });
  $('bouton-enregistrer-solde').addEventListener('click', () => {
    if (soldeInitialVerrouille) return;
    const saisieMontant = $('champ-solde-initial').value.trim();
    const valeur = Number(saisieMontant.replace(',', '.'));
    const montantCentimes = Math.round(valeur * 100);
    if (!saisieMontant || !Number.isFinite(valeur) || !Number.isSafeInteger(montantCentimes)) {
      alert('Saisis un solde valide.');
      return;
    }
    const dateSaisie = dateDepuisAffichage($('champ-date-solde-initial').value);
    if (!dateSaisie || dateSaisie > dateLocale()) {
      alert('Saisis une date valide au format JJ/MM/AAAA, au plus tard aujourd’hui.');
      return;
    }
    soldeInitial = montantCentimes;
    dateSoldeInitial = dateSaisie;
    soldeInitialVerrouille = true;
    sauvegarder();
    mettreAJourFormulaireSoldeInitial();
    rendreProjection();
    montrerToast('Solde de départ enregistré et verrouillé ✔');
  });
  $('bouton-modifier-solde').addEventListener('click', () => {
    if (!soldeInitialVerrouille) return;
    if (!confirm('Le solde de départ est verrouillé. Veux-tu exceptionnellement le modifier ?')) return;
    soldeInitialVerrouille = false;
    sauvegarder();
    mettreAJourFormulaireSoldeInitial();
  });
  $('form-categorie').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = $('champ-nom-categorie').value.trim();
    if (!nom) return;
    const doublon = categories.some((c) => normaliser(c.nom) === normaliser(nom));
    if (doublon) { alert('Une catégorie porte déjà ce nom.'); return; }
    categories.push({
      id: nouvelId(),
      nom,
      couleur: $('champ-couleur-categorie').value || PALETTE_CATEGORIES[categories.length % PALETTE_CATEGORIES.length],
      archivee: false,
    });

    sauvegarder();
    $('champ-nom-categorie').value = '';
    afficherSelecteurCouleurFormulaire(
      'selecteur-couleur-categorie',
      'champ-couleur-categorie',
      PALETTE_CATEGORIES[categories.length % PALETTE_CATEGORIES.length],
      'la nouvelle catégorie'
    );
    peuplerSelectCategories();
    rendreChips();
    rendreReglages();
    montrerToast('Catégorie ajoutée ✔');
  });

  $('form-categorie-revenu').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = $('champ-nom-categorie-revenu').value.trim();
    if (!nom) return;
    if (categoriesRevenus.some((c) => normaliser(c.nom) === normaliser(nom))) {
      alert('Une catégorie de revenu porte déjà ce nom.');
      return;
    }
    categoriesRevenus.push({ id: nouvelId(), nom, archivee: false });
    $('champ-nom-categorie-revenu').value = '';
    sauvegarder();
    rafraichirTout();
    montrerToast('Catégorie de revenu ajoutée ✔');
  });

  $('select-type-abonnement').addEventListener('change', function () {
    remplirCategoriesAbonnement(this.value);
  });
  $('form-abonnement').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = $('champ-nom-abonnement').value.trim();
    const montant = parseMontant($('champ-montant-abonnement').value);
    const type = $('select-type-abonnement').value;
    const categorieId = $('select-categorie-abonnement').value;
    const prochaineDate = dateDepuisAffichage($('champ-date-abonnement').value);
    if (!nom || montant === null || !categorieId) {
      alert('Complète tous les champs de l’abonnement.');
      return;
    }
    if (!prochaineDate) {
      alert('Saisis une date valide au format JJ/MM/AAAA.');
      return;
    }
    if (prochaineDate < dateLocale() || prochaineDate > dateMaxProjection()) {
      alert('La prochaine échéance doit être comprise entre aujourd’hui et la fin de la projection.');
      return;
    }
    const [annee, mois, jour] = prochaineDate.split('-').map(Number);
    abonnements.push({
      id: nouvelId(), nom, montant, type, categorieId,
      frequence: $('select-frequence-abonnement').value,
      prochaineDate, jourMois: jour, moisAnnee: mois - 1,
      archivee: false, creeLe: new Date().toISOString(),
    });
    sauvegarder();
    this.reset();
    $('select-type-abonnement').value = 'depense';
    $('select-frequence-abonnement').value = 'mensuelle';
    $('champ-date-abonnement').value = datePourAffichage(dateDefautAbonnement());
    remplirCategoriesAbonnement('depense');
    rafraichirTout();
    montrerToast('Abonnement ajouté ✔');
  });

  // — Labels
  $('form-label').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = $('champ-nom-label').value.trim();
    if (!nom || labels.concat(categories).some((x) => normaliser(x.nom) === normaliser(nom))) return;
    labels.push({
      id: nouvelId(), nom,
      couleur: $('champ-couleur-label').value || PALETTE_LABELS[labels.length % PALETTE_LABELS.length],
      archivee: false,
    });
    sauvegarder();
    $('champ-nom-label').value = '';
    afficherSelecteurCouleurFormulaire(
      'selecteur-couleur-label',
      'champ-couleur-label',
      PALETTE_LABELS[labels.length % PALETTE_LABELS.length],
      'le nouveau label'
    );
    rendreListeLabels();
    montrerToast('Label ajouté ✔');
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
    localStorage.removeItem(CLE_REVENUS);
    localStorage.removeItem(CLE_CATEGORIES_REVENUS);
    localStorage.removeItem(CLE_ABONNEMENTS);
    localStorage.removeItem(CLE_SOLDE_INITIAL);
    localStorage.removeItem(CLE_DATE_SOLDE_INITIAL);
    localStorage.removeItem(CLE_SOLDE_INITIAL_VERROUILLE);
    localStorage.removeItem(CLE_HORIZON_PROJECTION);
    localStorage.removeItem(CLE_REVENU_MOYEN_TEST);
    localStorage.removeItem(CLE_TICKETS);
    localStorage.removeItem(CLE_LABELS);
    localStorage.removeItem(CLE_DERNIER_EXPORT);
    $('champ-revenu-moyen-test').value = (REVENU_MOYEN_TEST_DEFAUT / 100).toFixed(2);
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
  $('select-bilan-dimension').addEventListener('change', function () {
    bilanDimension = this.value;
    rendreBilan();
  });
  $('bilan-contenu').addEventListener('change', (e) => {
    if (e.target.id !== 'select-evolution-perimetre') return;
    bilanPerimetre = e.target.value;
    rendreBilan();
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
  const revenuMoyenTestEnregistre = localStorage.getItem(CLE_REVENU_MOYEN_TEST);
  const revenuMoyenTestCentimes = revenuMoyenTestEnregistre === null
    ? REVENU_MOYEN_TEST_DEFAUT : Number(revenuMoyenTestEnregistre);
  $('champ-revenu-moyen-test').value = (Number.isSafeInteger(revenuMoyenTestCentimes) &&
    revenuMoyenTestCentimes > 0 ? revenuMoyenTestCentimes : REVENU_MOYEN_TEST_DEFAUT) / 100;
  $('champ-revenu-moyen-test').addEventListener('change', function () {
    const montant = parseMontant(this.value);
    if (montant === null) {
      alert('Saisis un revenu mensuel moyen valide.');
      this.value = (REVENU_MOYEN_TEST_DEFAUT / 100).toFixed(2);
      localStorage.setItem(CLE_REVENU_MOYEN_TEST, String(REVENU_MOYEN_TEST_DEFAUT));
      return;
    }
    this.value = (montant / 100).toFixed(2);
    localStorage.setItem(CLE_REVENU_MOYEN_TEST, String(montant));
  });
  $('bouton-jeu-test').addEventListener('click', installerJeuDeTest);
  $('bouton-purge-test').addEventListener('click', purgerDonneesTest);

  // — Simulation ticket (V2) : création, consultation, édition
  $('bouton-simu-ticket').addEventListener('click', () => {
    genererTicketSimule();
    simuTicketEnEdition = null;
    simuMode = 'creation';
    simuAideVisible = !localStorage.getItem(CLE_AIDE_TICKET);
    if (simuAideVisible) localStorage.setItem(CLE_AIDE_TICKET, '1');
    fermerPicker();
    rendreSimulation();
    afficherOnglet('simulation');
  });
  $('bouton-simu-abandonner').addEventListener('click', () => {
    simuLignes = [];
    fermerPicker();
    afficherOnglet('saisir'); // depuis une fiche, l'historique est plus naturel :
  });                          // remplace par 'historique' si tu préfères
  $('simu-picker-fermer').addEventListener('click', fermerPicker);
  $('bouton-simu-valider').addEventListener('click', validerTicketSimule);
  $('bouton-simu-modifier').addEventListener('click', () => {
    simuMode = 'edition';
    simuEtatInitial = JSON.stringify({ lignes: simuLignes, labels: simuLabels });
    rendreSimulation();
  });
  $('simu-aide-fermer').addEventListener('click', () => {
    localStorage.setItem(CLE_AIDE_TICKET, '1');
    simuAideVisible = false;
    $('simu-aide').hidden = true;
  });
  $('bouton-simu-supprimer').addEventListener('click', () => {
    const t = tickets.find((x) => x.id === simuTicketEnEdition);
    if (!t || !confirm('Supprimer « ' + t.magasin + ' » et les dépenses qui en découlent ?')) return;
    tickets = tickets.filter((x) => x.id !== simuTicketEnEdition);
    depenses = depenses.filter((d) => d.ticketId !== simuTicketEnEdition);
    sauvegarder();
    rafraichirTout();
    montrerToast('Ticket supprimé');
    afficherOnglet('historique');
  });

  // — Premier remplissage de l'écran
  chargerDepuisStockage();
  mettreAJourFormulaireSoldeInitial();
  $('select-horizon-projection').value = String(horizonProjection);
  $('champ-date-abonnement').value = datePourAffichage(dateDefautAbonnement());
  remplirCategoriesAbonnement('depense');
  $('champ-couleur-categorie').value = PALETTE_CATEGORIES[categories.length % PALETTE_CATEGORIES.length];
  $('champ-couleur-label').value = PALETTE_LABELS[labels.length % PALETTE_LABELS.length];
  mettreAJourFormulaireType('depense', categorieChoisie);
  rendreChips();
  $('champ-date').value = datePourAffichage(dateLocale());
  afficherTotalMois();
  rendreHistorique();
  rendreBilan();
  rendreProjection();
  rendreReglages();
  rendreInfoExport();
  rendreListeLabels();
  afficherOnglet(prefAccueil());
}

demarrer();
