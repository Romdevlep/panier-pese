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

// Date du jour au format AAAA-MM-JJ, en heure LOCALE.
// (toISOString() serait en UTC : faux le soir de 22h à minuit en hiver.)
function dateLocale(d = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate());
}

// '2026-11' → 'novembre 2026' (le T12:00 évite un décalage de fuseau).
function libelleMois(mois) {
  return new Date(mois + '-01T12:00:00')
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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

function nombreTotalMois() {
  const mois = dateLocale().slice(0, 7);
  let total = 0;
  for (const d of depenses) if (d.date.slice(0, 7) === mois) total += d.montant;
  return total;
}

// Le total du mois, affiché en permanence sous le titre.
function afficherTotalMois() {
  const mois = dateLocale().slice(0, 7);
  const label = libelleMois(mois);
  $('total-mois').textContent =
    label.charAt(0).toUpperCase() + label.slice(1) + ' : ' + formaterEuros(nombreTotalMois());
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

function rendreBilan() {
  const conteneur = $('bilan-contenu');
  conteneur.innerHTML = '';
  const mois = dateLocale().slice(0, 7);
  const totalMois = nombreTotalMois();

  // — Lecture 1 : le total du mois (les centimes s'additionnent exactement).
  const carteTotal = document.createElement('div');
  carteTotal.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Ce mois-ci';
  const total = document.createElement('p');
  total.style.cssText = 'font-size:1.6rem;font-weight:700;margin:4px 0;color:var(--vert)';
  total.textContent = formaterEuros(totalMois);
  carteTotal.appendChild(h2);
  carteTotal.appendChild(total);
  conteneur.appendChild(carteTotal);

  if (totalMois === 0) {
    const vide = document.createElement('div');
    vide.className = 'carte';
    vide.innerHTML = '<p class="vide">Aucune dépense ce mois-ci. Saisis-en depuis l’onglet Saisir !</p>';
    conteneur.appendChild(vide);
    return;
  }

  // — Lecture 2 : répartition par catégorie (mois en cours), la plus gourmande d'abord.
  const parCategorie = new Map();
  for (const d of depenses) {
    if (d.date.slice(0, 7) === mois) {
      parCategorie.set(d.categorieId, (parCategorie.get(d.categorieId) ?? 0) + d.montant);
    }
  }
  const lignesCategories = [...parCategorie.entries()]
    .map(([id, cents]) => {
      const cat = categorieParId(id);
      const pourcent = Math.round((cents / totalMois) * 100);
      return {
        libelle: cat ? cat.nom : '(supprimée)',
        couleur: cat ? (COULEURS_GROUPES[cat.groupe] || '#9e9e9e') : '#9e9e9e',
        cents,
        complement: formaterEuros(cents) + ' (' + pourcent + '%)',
      };
    })
    .sort((a, b) => b.cents - a.cents);
  conteneur.appendChild(construireCarteBarres('Répartition par catégorie', lignesCategories));

  // — Lecture 3 : évolution sur les 6 derniers mois (mois courant compris).
  const sixMois = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    sixMois.push(dateLocale(d).slice(0, 7));
  }
  const lignesMois = sixMois.map((m) => ({
    libelle: new Date(m + '-01T12:00:00')
      .toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    couleur: m === mois ? '#2e7d32' : '#a5c8a7',
    cents: depenses
      .filter((d) => d.date.slice(0, 7) === m)
      .reduce((somme, d) => somme + d.montant, 0),
  }));
  const carteMois = construireCarteBarres('Évolution (6 mois)', lignesMois);
  carteMois.querySelector('.bilan-libelle:last-of-type span, .bilan-libelle:last-child span');
  conteneur.appendChild(carteMois);
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
