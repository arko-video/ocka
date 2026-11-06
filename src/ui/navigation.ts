// Navigation par étapes. Chaque écran et chaque panneau ajoute une entrée dans l'historique du navigateur :
// le bouton Retour d'Android ferme le panneau, puis revient à l'étape précédente, puis à « Mes morceaux ».

import { T } from '../textes-fr';
// prettier-ignore
import { afficherToast, ecran, ECRANS_SORTIE, ETAPES, historique, modePianoRoll, ongletAccueil, PANNEAUX, panneau, pisteEditee, priseEditee, sectionCourante, sonEdite, sortieEditee, type Ecran } from './etat';
import { exportEnCours, oublierExport } from './exportation';
import { arreterLecture } from './lecture';
import { quitterMorceau } from './mes-morceaux';
import { arreter, detruireEnregistreur, phaseEnr } from './voix';

interface EtatNav {
  ocka: true;
  ecran: Ecran;
  panneau?: string;
}

function estEcran(x: unknown): x is Ecran {
  return x === 'accueil' || x === 'sorties' || x === 'styles' || (ETAPES as unknown[]).includes(x) || (ECRANS_SORTIE as unknown[]).includes(x);
}

const estAccueil = (e: Ecran) => e === 'accueil' || e === 'sorties';
const estSortie = (e: Ecran) => (ECRANS_SORTIE as Ecran[]).includes(e);

/**
 * Gardes de Retour : pendant une opération longue (dossier de sortie, pistes séparées…), le propriétaire de l'écran
 * enregistre ici une fonction qui renvoie un message (Retour refusé, message en toast) ou null (Retour permis).
 * Ex. : gardesRetour.set('sortie-verifier', () => (enCours ? T.sortie.enCoursRetour : null)).
 */
export const gardesRetour = new Map<Ecran, () => string | null>();

function afficher(e: Ecran) {
  const avant = ecran.peek();
  if (avant !== e && estAccueil(e) && !estAccueil(avant)) {
    arreterLecture();
    oublierExport();
    void quitterMorceau();
  }
  // L'assistant de sortie peut s'ouvrir depuis Exporter : le morceau reste ouvert, mais la lecture s'arrête.
  if (estSortie(e) && !estSortie(avant)) arreterLecture();
  if (e === 'sorties') ongletAccueil.value = 'sorties';
  if (avant === 'voix' && e !== 'voix') detruireEnregistreur();
  ecran.value = e;
  // Fermer un panneau (ou l'aide) garde la position : on ne remonte en haut que si l'écran change.
  if (avant !== e) window.scrollTo(0, 0);
}

/** Va à un écran en ajoutant une entrée d'historique. */
export function allerA(e: Ecran) {
  if (e === ecran.peek() && !panneau.peek()) return;
  panneau.value = null;
  profondeurAide = 0;
  history.pushState({ ocka: true, ecran: e } satisfies EtatNav, '');
  afficher(e);
}

/** Remplace l'écran courant (choix du style → Beat : Retour ramène ensuite à « Mes morceaux »). */
export function remplacerPar(e: Ecran) {
  panneau.value = null;
  profondeurAide = 0;
  history.replaceState({ ocka: true, ecran: e } satisfies EtatNav, '');
  afficher(e);
}

/** Bouton Retour de l'en-tête : même effet que le bouton Retour du téléphone. */
export function retour() {
  history.back();
}

/** Retour direct à « Mes morceaux » (en-tête du studio). */
export function allerAccueil() {
  panneau.value = null;
  profondeurAide = 0;
  history.pushState({ ocka: true, ecran: 'accueil' } satisfies EtatNav, '');
  afficher('accueil');
}

export function ouvrirPanneau(id: string) {
  if (panneau.peek() === id) return;
  history.pushState({ ocka: true, ecran: ecran.peek(), panneau: id } satisfies EtatNav, '');
  panneau.value = id;
}

/** Ferme le panneau ouvert (par l'historique, pour que Retour reste juste). */
export function fermerPanneau() {
  if (panneau.peek()) history.back();
}

/* ------------------------------------------------------------ v2 : piano roll, choix d'instrument, effets */

/** Ouvre le piano roll en plein écran sur une piste instrument (Retour le ferme). */
export function ouvrirPianoRoll(idPiste: string, mode: 'simple' | 'complet' = modePianoRoll.peek()) {
  pisteEditee.value = idPiste;
  modePianoRoll.value = mode;
  ouvrirPanneau(PANNEAUX.pianoRoll);
}

/** Ouvre « Effets (n) » d'une piste (fixe ou instrument). */
export function ouvrirEffets(idPiste: string) {
  pisteEditee.value = idPiste;
  ouvrirPanneau(PANNEAUX.effetsPiste);
}

/* ------------------------------------------------------------ C2 : autotune, Chanter, Beatbox */

/** Ouvre l'éditeur de notes de l'autotune sur une prise (Voix, « Avancé » ; A2). */
export function ouvrirEditeurAutotune(idPrise: string) {
  priseEditee.value = idPrise;
  ouvrirPanneau(PANNEAUX.editeurAutotune);
}

/** Ouvre « Chanter » sur une piste instrument (depuis le piano roll ou la vue Pistes ; D). Retour y ramène. */
export function ouvrirChanter(idPiste: string) {
  pisteEditee.value = idPiste;
  ouvrirPanneau(PANNEAUX.chanter);
}

/** Ouvre « Beatbox » (depuis la vue Batterie ; D). */
export function ouvrirBeatbox() {
  ouvrirPanneau(PANNEAUX.beatbox);
}

/* ------------------------------------------------------------ C3 : panneaux des développeurs P, S, L, R, V */

/** Panneaux qui gardent `pisteEditee` (Retour y ramène sans perdre la piste). */
const GARDENT_PISTE: readonly string[] = [PANNEAUX.pianoRoll, PANNEAUX.effetsPiste, PANNEAUX.chanter, PANNEAUX.outilsNotes, PANNEAUX.midi, PANNEAUX.synthe];

/** Outils malins du piano roll sur une piste instrument (P). */
export function ouvrirOutilsNotes(idPiste: string) {
  pisteEditee.value = idPiste;
  ouvrirPanneau(PANNEAUX.outilsNotes);
}

/** MIDI (P) : fichiers .mid et clavier ; `idPiste` = la piste jouée au clavier (sinon la 1re piste instrument). */
export function ouvrirMidi(idPiste: string | null = null) {
  if (idPiste !== null) pisteEditee.value = idPiste;
  ouvrirPanneau(PANNEAUX.midi);
}

/** Découpe et éditeur d'un son importé (S). */
export function ouvrirEditeurSon(idSon: string | null) {
  sonEdite.value = idSon;
  ouvrirPanneau(PANNEAUX.editeurSon);
}

/** Réglages du synthé d'une piste instrument (L). */
export function ouvrirSynthe(idPiste: string) {
  pisteEditee.value = idPiste;
  ouvrirPanneau(PANNEAUX.synthe);
}

/** Sons courts fabriqués : kick, bruitages (L). */
export function ouvrirSonsCourts() {
  ouvrirPanneau(PANNEAUX.sonsCourts);
}

/** Looper, « Jouer en direct » (R). */
export function ouvrirLooper() {
  ouvrirPanneau(PANNEAUX.looper);
}

/** Effets de performance d'une section (R) : elle devient la section courante. */
export function ouvrirPerformance(idSection: string | null) {
  if (idSection !== null) sectionCourante.value = idSection;
  ouvrirPanneau(PANNEAUX.performance);
}

/** Confort : tap tempo, métronome, historique, modèles, marqueurs, raccourcis (R). */
export function ouvrirConfort() {
  ouvrirPanneau(PANNEAUX.confort);
}

/** Voix avancée (V) ; `idPrise` facultative (la prise choisie de la section sinon). */
export function ouvrirVoixAvancee(idPrise: string | null = null) {
  if (idPrise !== null) priseEditee.value = idPrise;
  ouvrirPanneau(PANNEAUX.voixAvancee);
}

/** Écoute de référence (V). */
export function ouvrirReference() {
  ouvrirPanneau(PANNEAUX.reference);
}

/* ------------------------------------------------------------ aide (B3) */

/** Le panneau de l'aide s'appelle « aide:<page> ». Chaque page ouverte ajoute une entrée d'historique. */
const PREFIXE_AIDE = 'aide:';
/** Nombre de pages d'aide empilées dans l'historique (pour fermer l'aide d'un coup). */
let profondeurAide = 0;

export function estPanneauAide(p: string | null): p is string {
  return p !== null && p.startsWith(PREFIXE_AIDE);
}

/** La page d'aide ouverte, ou null. */
export function pageAideOuverte(): string | null {
  const p = panneau.value;
  return estPanneauAide(p) ? p.slice(PREFIXE_AIDE.length) : null;
}

/** Ouvre l'aide sur une page (bouton « ? »), ou va à une autre page si l'aide est déjà ouverte. */
export function ouvrirAide(page: string) {
  const id = PREFIXE_AIDE + page;
  const avant = panneau.peek();
  if (avant === id) return;
  history.pushState({ ocka: true, ecran: ecran.peek(), panneau: id } satisfies EtatNav, '');
  profondeurAide = estPanneauAide(avant) ? profondeurAide + 1 : 1;
  panneau.value = id;
}

/** Ferme toute l'aide (toutes ses pages) et revient à l'écran. */
export function fermerAide() {
  const n = profondeurAide;
  if (n > 0) history.go(-n);
}

/** À appeler une fois au démarrage. */
export function initialiserNavigation() {
  // En arrière-plan (hors enregistrement), le micro est éteint : il sera rouvert à la prochaine prise.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') detruireEnregistreur();
  });
  history.replaceState({ ocka: true, ecran: 'accueil' } satisfies EtatNav, '');
  window.addEventListener('popstate', (ev) => {
    const etat = ev.state as Partial<EtatNav> | null;
    let cible: Ecran = estEcran(etat?.ecran) ? etat.ecran : 'accueil';
    // Garde posée par le propriétaire de l'écran (opération longue en cours) : on reste.
    const avant = ecran.peek();
    const garde = cible !== avant ? gardesRetour.get(avant)?.() : null;
    if (garde) {
      history.pushState({ ocka: true, ecran: avant } satisfies EtatNav, '');
      afficherToast(garde);
      return;
    }
    // Pendant un export, on reste sur l'écran Exporter.
    if (ecran.peek() === 'exporter' && exportEnCours() && cible !== 'exporter') {
      history.pushState({ ocka: true, ecran: 'exporter' } satisfies EtatNav, '');
      afficherToast(T.exporter.enCoursRetour);
      return;
    }
    // Pendant un enregistrement, Retour arrête la prise (elle est gardée) et on reste sur Voix.
    if (phaseEnr.peek() !== 'repos') {
      history.pushState({ ocka: true, ecran: ecran.peek() } satisfies EtatNav, '');
      void arreter();
      return;
    }
    // Sans morceau ouvert, pas d'étape du studio ; sans sortie ouverte, pas d'écran de sortie.
    if (!historique.peek() && (ETAPES as Ecran[]).includes(cible)) cible = 'accueil';
    if (!sortieEditee.peek() && estSortie(cible)) cible = 'sorties';
    const nouveau = etat?.panneau ?? null;
    profondeurAide = estPanneauAide(nouveau) ? Math.max(1, profondeurAide - 1) : 0;
    // Le piano roll, les effets, « Chanter » (et les panneaux C3 d'une piste) fermés : plus de piste éditée ;
    // l'éditeur d'autotune et la voix avancée : plus de prise ; l'éditeur de son : plus de son.
    if (nouveau === null || !GARDENT_PISTE.includes(nouveau)) pisteEditee.value = null;
    if (nouveau !== PANNEAUX.editeurAutotune && nouveau !== PANNEAUX.voixAvancee) priseEditee.value = null;
    if (nouveau !== PANNEAUX.editeurSon) sonEdite.value = null;
    panneau.value = nouveau;
    afficher(cible);
  });
}
