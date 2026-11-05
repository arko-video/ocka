// Logique de l'étape Voix : calibrage de la latence, enregistrement (décompte, vumètre, arrêt auto), prises.

import { signal } from '@preact/signals';
import {
  ajustementLatence,
  calibrerLatence,
  creerEnregistreur,
  forceAutotune,
  preparerAutotuneMorceau,
  surAutotune,
  ecouterPrise,
  ErreurOcka,
  latenceMemorisee,
  reglerLatence,
  surChangementAppareil,
  type Enregistreur,
} from '../moteur/api';
import { positionAncre } from '../morceau/temps';
import type { Morceau, Piste, Prise } from '../morceau/types';
import { T } from '../textes-fr';
import { afficherToast, annulerAction, modifier, morceau } from './etat';
import { ajouterPrise, garderPrise, retirerPrise } from './edition/reglages';
import { dureeSection, sectionParId } from './edition/sections';
import { persisterApresGeste } from './exportation';
import { arreterLecture, lecteurPret, obtenirLecteur, reappliquerReglages } from './lecture';

export type PhaseEnr = 'repos' | 'preparation' | 'decompte' | 'enregistrement' | 'fin';
export const phaseEnr = signal<PhaseEnr>('repos');
export const decompte = signal(4);
/** Secondes écoulées depuis le début de la section (pour faire défiler le prompteur). */
export const ecoule = signal(0);
export const niveauMicro = signal(0);
export const erreurVoix = signal<{ code: string; message: string } | null>(null);
export const latence = signal<number | null>(lireLatence());
export const calibrage = signal<number | null>(null);
export const ecouteEnCours = signal<string | null>(null);
/** Réglage manuel en millisecondes (−100 à +100), lu dans le moteur. */
export const reglageFin = signal<number>(lireReglage());
/** Casque Bluetooth détecté au calibrage : conseil affiché (sans bloquer). */
export const conseilBluetooth = signal(false);
/** Réglages du micro que le téléphone n'a pas respectés (écho, bruit, volume auto). */
export const avertissementsMicro = signal<string[]>([]);

let enr: Enregistreur | null = null;
let boucleVue = 0;
let minuteurFin: ReturnType<typeof setTimeout> | undefined;
let arretEcoute: (() => void) | null = null;

function lireLatence(): number | null {
  try {
    return latenceMemorisee();
  } catch {
    return null;
  }
}
function lireReglage(): number {
  try {
    return Math.round(ajustementLatence() * 1000);
  } catch {
    return 0;
  }
}

/** Erreur montrée à l'utilisateur. Les ErreurOcka sont attendues (micro refusé, signal faible…) : pas de console. */
function erreur(e: unknown) {
  if (!(e instanceof ErreurOcka)) console.error(e);
  const code = e instanceof ErreurOcka ? e.code : 'inconnue';
  const message = T.voix.erreurs[code] ?? (e instanceof ErreurOcka ? e.message : T.voix.erreurInconnue);
  erreurVoix.value = { code, message };
}

export async function calibrer() {
  if (calibrage.peek() !== null) return;
  erreurVoix.value = null;
  calibrage.value = 0;
  const progression = (p: number) => (calibrage.value = p);
  try {
    try {
      latence.value = await calibrerLatence(progression);
    } catch (e) {
      // Casque Bluetooth : on prévient et on conseille un casque filaire, sans bloquer le calibrage.
      if (!(e instanceof ErreurOcka) || e.code !== 'bluetooth') throw e;
      conseilBluetooth.value = true;
      latence.value = await calibrerLatence(progression, { ignorerBluetooth: true });
    }
    afficherToast(T.voix.calibre);
  } catch (e) {
    erreur(e);
  }
  calibrage.value = null;
}

/** Réglage fin manuel, en millisecondes (−100 à +100). */
export function reglerFin(ms: number) {
  const v = Math.max(-100, Math.min(100, Math.round(ms)));
  reglageFin.value = v;
  try {
    reglerLatence(v / 1000);
    latence.value = latenceMemorisee();
  } catch (e) {
    console.error(e);
  }
}

/** Gros bouton rouge : décompte 4, 3, 2, 1 puis enregistrement de la section ; arrêt auto à sa fin. */
export async function enregistrer(ancre: { section: string; occurrence: number }) {
  const m = morceau.peek();
  const s = m && sectionParId(m, ancre.section);
  if (!m || !s || phaseEnr.peek() !== 'repos') return;
  erreurVoix.value = null;
  phaseEnr.value = 'preparation';
  try {
    enr ??= await creerEnregistreur();
    avertissementsMicro.value = enr.avertissements ?? [];
    const lecteur = obtenirLecteur();
    if (!lecteur) throw new Error('lecteur');
    await lecteurPret();
    const temps = 60 / m.tempo;
    const mesure = 4 * temps;
    const duree = dureeSection(m, s);
    const ta = positionAncre(m, { ...ancre, mesure: 0 }) ?? 0;
    const t0 = performance.now();
    phaseEnr.value = 'decompte';
    decompte.value = 4;
    // Position par rapport au début de la section (négative pendant le décompte), lue sur l'horloge du lecteur
    // dès qu'il joue (le décompte et le prompteur suivent le son), sinon sur l'horloge murale.
    const suivre = () => {
      const t = lecteur.enLecture ? lecteur.temps - ta : Math.min(-0.01, (performance.now() - t0) / 1000 - mesure);
      if (t < 0) decompte.value = Math.max(1, Math.min(4, Math.ceil(-t / temps)));
      else if (phaseEnr.peek() === 'decompte') phaseEnr.value = 'enregistrement';
      ecoule.value = Math.max(0, t);
      niveauMicro.value = enr?.niveau ?? 0;
      if (t > duree + 0.25 && phaseEnr.peek() === 'enregistrement') return void arreter();
      boucleVue = requestAnimationFrame(suivre);
    };
    boucleVue = requestAnimationFrame(suivre);
    // Filet de sécurité si le lecteur s'arrête : arrêt après décompte + section + marge.
    minuteurFin = setTimeout(() => void arreter(), (mesure + duree) * 1000 + 3000);
    await enr.demarrer(lecteur, m, { ...ancre, mesure: 0 });
  } catch (e) {
    nettoyer();
    erreur(e);
  }
}

function nettoyer() {
  cancelAnimationFrame(boucleVue);
  clearTimeout(minuteurFin);
  phaseEnr.value = 'repos';
  niveauMicro.value = 0;
  ecoule.value = 0;
}

/** Arrête : la prise est ajoutée au morceau et gardée pour sa section. */
export async function arreter() {
  const phase = phaseEnr.peek();
  if (phase !== 'decompte' && phase !== 'enregistrement') return;
  cancelAnimationFrame(boucleVue);
  clearTimeout(minuteurFin);
  phaseEnr.value = 'fin';
  try {
    const p = await enr!.arreter();
    modifier((m) => ajouterPrise(m, p));
    afficherToast(T.voix.nouvellePrise);
    // 1re prise gardée : on demande au navigateur de ne pas effacer les données d'OCKA.
    void persisterApresGeste();
  } catch (e) {
    erreur(e);
  }
  arreterLecture();
  reappliquerReglages();
  nettoyer();
}

export async function basculerEcoute(p: Prise) {
  const enCours = ecouteEnCours.peek();
  arretEcoute?.();
  arretEcoute = null;
  ecouteEnCours.value = null;
  if (enCours === p.id) return;
  try {
    arretEcoute = await ecouterPrise(p);
    ecouteEnCours.value = p.id;
    const duree = Math.max(0.5, p.finCoupe - p.debutCoupe);
    setTimeout(() => {
      if (ecouteEnCours.peek() === p.id) ecouteEnCours.value = null;
    }, duree * 1000);
  } catch (e) {
    erreur(e);
  }
}

export function garder(p: Prise) {
  modifier((m) => garderPrise(m, p.id));
}

/**
 * Retire la prise du morceau. Son fichier n'est PAS effacé ici : nettoyerPrisesOrphelines (stockage) efface
 * les fichiers qu'aucun morceau n'utilise plus. « Annuler » ramène donc toujours la voix.
 */
export function supprimer(p: Prise) {
  if (ecouteEnCours.peek() === p.id) void basculerEcoute(p);
  if (!modifier((m) => retirerPrise(m, p.id))) return;
  afficherToast(T.voix.supprimee, 6000, { label: T.annuler, agir: annulerAction });
}

/** Casque branché ou débranché : on propose un nouveau calibrage. Renvoie de quoi arrêter d'écouter. */
export function suivreAppareil(): () => void {
  try {
    return surChangementAppareil((aCalibrer) => {
      latence.value = lireLatence();
      if (aCalibrer) afficherToast(T.voix.nouvelAppareil, 8000, { label: T.voix.calibrer, agir: () => void calibrer() });
    });
  } catch {
    return () => {};
  }
}

/** Éteint le micro (en quittant Voix ou le morceau, ou quand l'appli passe en arrière-plan sans enregistrer). */
export function detruireEnregistreur() {
  if (phaseEnr.peek() !== 'repos') return;
  enr?.detruire();
  enr = null;
  niveauMicro.value = 0;
}

/* ------------------------------------------------------------ autotune */

/** Change à chaque nouvel état de l'autotune (l'interface relit resumeAutotune). */
export const versionAutotune = signal(0);
surAutotune(() => {
  versionAutotune.value++;
  // Une correction prête pour le morceau ouvert : le lecteur recharge, et l'écoute passe à la voix corrigée.
  const m = morceau.peek();
  if (m && forceAutotune(m) > 0) void obtenirLecteur()?.charger(m).catch((e: unknown) => console.error(e));
});

/** Écrit la force de l'autotune sur la piste voix (undefined = éteint). */
function ecrireAutotune(m: Morceau, force: number | undefined): Morceau {
  const p = m.pistes.find((x) => x.id === 'voix');
  const base: Piste = p ?? { id: 'voix', volume: 1, pan: 0, muet: false, solo: false, preset: 'naturel' };
  const effets = { ...base.effets };
  if (force === undefined) delete effets.autotune;
  else effets.autotune = Math.round(Math.min(1, Math.max(0.1, force)) * 10) / 10;
  const n: Piste = { ...base, effets };
  if (Object.keys(effets).length === 0) delete n.effets;
  return { ...m, pistes: p ? m.pistes.map((x) => (x.id === 'voix' ? n : x)) : [...m.pistes, n] };
}

/** Pastille Autotune : allume (force 0,5) ou éteint ; la correction des prises part tout de suite. */
export function basculerAutotune() {
  modifier((m) => ecrireAutotune(m, forceAutotune(m) > 0 ? undefined : 0.5));
  const m = morceau.peek();
  if (m) preparerAutotuneMorceau(m);
}

/** Curseur « Naturel ↔ Robot » (0,1 à 1, au dixième). */
export function reglerAutotune(force: number) {
  if (!Number.isFinite(force)) return;
  modifier((m) => ecrireAutotune(m, force), 'effet:autotune');
  const m = morceau.peek();
  if (m) preparerAutotuneMorceau(m);
}
