// Pont entre l'interface et le lecteur du moteur : signals de lecture, boucle, métronome, notes de mélodie, A/B.
// Le lecteur est créé au premier geste (Lecture, toucher un pad) : l'audio du navigateur l'exige.

import { effect, signal } from '@preact/signals';
import { creerLecteur, ErreurOcka, mesurerEcartAB, surGels, type Lecteur, type OptionsNote } from '../moteur/api';
import { occurrenceAuPas, secondesVersPas } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { T } from '../textes-fr';
import { afficherToast, messageErreur, morceau, sectionCourante } from './etat';

export const enLecture = signal(false);
export const tempsLecture = signal(0);
export const pasCourant = signal(-1);
export const boucle = signal<'morceau' | 'section'>('morceau');
export const metronomeActif = signal(false);

let lecteur: Lecteur | null = null;
let prevenu = false;
let pret: Promise<void> = Promise.resolve();
let minuteurCharge: ReturnType<typeof setTimeout> | undefined;

/**
 * C3 : pendant le looper, c'est LUI qui charge le lecteur (ses propres morceaux de passage) : ni un gel prêt ni une
 * modification ne doivent y recharger le morceau. Le looper recharge le morceau en se fermant (PanneauLooper).
 */
let looperActif = false;
export function reserverLecteurAuLooper(actif: boolean): void {
  looperActif = actif;
  if (!actif) clearTimeout(minuteurCharge);
}

/** C3 : change à chaque gel prêt ou retiré (badges « gelée » des cartes). */
export const versionGels = signal(0);

// C3 : un gel (effet de performance, piste gelée) calculé en tâche de fond est prêt : le lecteur recharge.
surGels(() => {
  versionGels.value++;
  const m = morceau.peek();
  if (lecteur && m && !looperActif) void lecteur.charger(m).catch((e: unknown) => console.error(e));
});

/** Le lecteur (créé au besoin), ou null si le moteur n'est pas disponible. */
export function obtenirLecteur(): Lecteur | null {
  if (lecteur) return lecteur;
  const m = morceau.peek();
  if (!m) return null;
  try {
    lecteur = creerLecteur();
  } catch (e) {
    console.error(e);
    if (!prevenu) afficherToast(T.barre.pasPret);
    prevenu = true;
    return null;
  }
  const l = lecteur;
  l.surChangement(() => {
    enLecture.value = l.enLecture;
    tempsLecture.value = l.temps;
    pasCourant.value = l.enLecture ? l.pasCourant : -1;
  });
  pret = l.charger(m).then(() => {
    l.metronome(metronomeActif.peek());
    l.boucler(boucle.peek() === 'section' ? sectionCourante.peek() : null);
  });
  pret.catch((e: unknown) => console.error(e));
  return l;
}

/**
 * Pas joué dans un motif de `longueur` pas (0 à longueur − 1), mesure comprise, ou −1 à l'arrêt.
 * Compté depuis le début de la section en cours : sur un motif de 2 mesures, seule la bonne mesure s'allume.
 */
export function pasDansMotif(longueur: number): number {
  const m = morceau.value;
  const t = tempsLecture.value;
  const pas = pasCourant.value;
  if (!m || pas < 0 || longueur <= 0) return -1;
  const global = Math.floor(secondesVersPas(m, t) + 1e-6);
  const o = occurrenceAuPas(m, global);
  if (!o) return pas % longueur;
  const rel = (global - o.debutPas) % longueur;
  // Garde le pas du lecteur (le plus juste) et n'emprunte au temps que la mesure.
  return rel - (rel % 16) + (pas % 16);
}

/** Comme pasDansMotif, mais −1 quand c'est une autre section qui joue (grille de la mélodie). */
export function pasDansSection(idSection: string, longueur: number): number {
  const m = morceau.value;
  const t = tempsLecture.value;
  if (!m || pasCourant.value < 0 || longueur <= 0) return -1;
  const o = occurrenceAuPas(m, Math.floor(secondesVersPas(m, t) + 1e-6));
  return o?.section.id === idSection ? pasDansMotif(longueur) : -1;
}

/**
 * Erreur d'un geste montrée en toast : message d'une ErreurOcka (« Bientôt disponible » pour un bouchon
 * de la vague A), sinon le texte de secours. Les erreurs inattendues vont aussi dans la console.
 */
export function toastErreur(e: unknown, secours: string = T.bientot) {
  if (!(e instanceof ErreurOcka)) console.error(e);
  afficherToast(messageErreur(e, secours));
}

/** Attend que le morceau soit chargé dans le lecteur. */
export function lecteurPret(): Promise<void> {
  return pret;
}

export function basculerLecture() {
  const l = obtenirLecteur();
  if (!l) return;
  if (l.enLecture) l.pause();
  else void pret.then(() => l.lire()).catch(() => afficherToast(T.barre.pasPret));
}

export function entendre(instrument: string) {
  try {
    obtenirLecteur()?.entendre(instrument);
  } catch (e) {
    console.error(e);
  }
}

let derniereErreurNote = 0;

/**
 * Joue une note tout de suite sur une piste instrument (pads de la gamme, grille, piano roll ; `options.instrument` :
 * écouter un autre instrument). Erreur : un toast toutes les 8 s au plus.
 */
export function entendreNote(piste: string, midi: number, options?: OptionsNote) {
  try {
    obtenirLecteur()?.entendreNote(piste, midi, options);
  } catch (e) {
    const maintenant = Date.now();
    if (maintenant - derniereErreurNote > 8000) toastErreur(e);
    derniereErreurNote = maintenant;
  }
}

/* ------------------------------------------------------------ A/B (étape Son) */

/** Vrai pendant « Écouter sans le mastering ». */
export const sansMastering = signal(false);
/** Écart de sonie avec − sans (LU) mesuré pour une couleur et une chaîne (`cle`), ou null pas encore mesuré. */
export const ecartAB = signal<{ cle: string; lu: number } | null>(null);
let mesureAB = 0;

const cleAB = (m: Morceau) => `${m.master.preset}|${m.master.chaine}`;

/** Mesure l'écart A/B une fois, puis à chaque changement de couleur (ou de chaîne). Silencieux en cas d'échec. */
export async function preparerAB(m: Morceau) {
  const cle = cleAB(m);
  if (ecartAB.peek()?.cle === cle) return;
  const n = ++mesureAB;
  let lu = 0;
  try {
    lu = (await mesurerEcartAB(m)).ecartLu;
    if (!Number.isFinite(lu)) lu = 0;
  } catch (e) {
    if (!(e instanceof ErreurOcka)) console.error(e);
  }
  if (n === mesureAB) ecartAB.value = { cle, lu };
}

/** A/B : `sans` = true fait entendre le master sans couleur ni colle, au même volume perçu. Lance la lecture si besoin. */
export function comparerAB(sans: boolean) {
  const l = obtenirLecteur();
  if (!l) return;
  const m = morceau.peek();
  const e = ecartAB.peek();
  const compensation = m && e?.cle === cleAB(m) ? e.lu : 0;
  try {
    l.comparer(sans, compensation);
    sansMastering.value = sans;
    if (sans && !l.enLecture) basculerLecture();
  } catch (err) {
    sansMastering.value = false;
    if (sans) toastErreur(err);
  }
}

export function allerAuTemps(t: number) {
  lecteur?.aller(t);
  tempsLecture.value = t;
}

/** Après un enregistrement (qui force métronome et lecture sans boucle) : on remet les réglages de la barre. */
export function reappliquerReglages() {
  lecteur?.metronome(metronomeActif.peek());
  lecteur?.boucler(boucle.peek() === 'section' ? sectionCourante.peek() : null);
}

export function arreterLecture() {
  if (lecteur?.enLecture) lecteur.pause();
}

/** Quand on ferme le morceau : le lecteur est détruit (un nouveau sera créé pour le suivant). */
export function detruireLecteur() {
  clearTimeout(minuteurCharge);
  lecteur?.detruire();
  lecteur = null;
  sansMastering.value = false;
  enLecture.value = false;
  tempsLecture.value = 0;
  pasCourant.value = -1;
}

/** Recharge le morceau dans le lecteur après chaque modification (regroupées), sans couper la lecture. */
export function suivreMorceau() {
  effect(() => {
    const m = morceau.value;
    if (!m || !lecteur || looperActif) return;
    const l = lecteur;
    clearTimeout(minuteurCharge);
    minuteurCharge = setTimeout(() => {
      if (looperActif) return;
      pret = l.charger(m);
      pret.catch((e: unknown) => console.error(e));
    }, 120);
  });
  effect(() => {
    const b = boucle.value;
    const s = sectionCourante.value;
    lecteur?.boucler(b === 'section' ? s : null);
  });
  effect(() => {
    lecteur?.metronome(metronomeActif.value);
  });
}
