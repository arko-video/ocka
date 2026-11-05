// Navigation par étapes. Chaque écran et chaque panneau ajoute une entrée dans l'historique du navigateur :
// le bouton Retour d'Android ferme le panneau, puis revient à l'étape précédente, puis à « Mes morceaux ».

import { T } from '../textes-fr';
import { afficherToast, ecran, ECRANS_SORTIE, ETAPES, historique, ongletAccueil, panneau, sortieEditee, type Ecran } from './etat';
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
    panneau.value = nouveau;
    afficher(cible);
  });
}
