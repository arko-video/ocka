// Choix des zones d'un instrument échantillonné (SourceZones) : PUR, sans Web Audio (testé dans Vitest).
// Décisions v2 §2 : la couche se choisit avec vel × 127, le gain vaut 10^((gainDb instrument + zone)/20) × vel^1,6,
// la zone se joue avec `detune` (cents) depuis sa racine (zones espacées d'au plus 3 demi-tons : ±150 cents).

import type { SourceZones, ZoneSource } from '../types-moteur';

/** Fréquence des positions de instrument.json (échantillons de l'Opus décodé). */
export const FREQ_ZONES = 48000;
/** Exposant de la courbe de vélocité (gain = vel^1,6). */
export const EXPOSANT_VEL = 1.6;
/** Durée du glissé (s) à la fin d'une note `glisse`, au plus la moitié de la note (comme la 808). */
export const DUREE_GLISSE = 0.12;

/** Vélocité MIDI (1 à 127) d'une vélocité de note (0,1 à 1). */
export function velMidi(vel: number): number {
  const v = Math.round((Number.isFinite(vel) ? vel : 1) * 127);
  return Math.min(127, Math.max(1, v));
}

/** Gain linéaire d'une note : gains de l'instrument et de la zone, puis la courbe de vélocité. */
export function gainNote(source: Pick<SourceZones, 'gainDb'>, zone: Pick<ZoneSource, 'gainDb'>, vel: number): number {
  const v = Math.min(1, Math.max(0, Number.isFinite(vel) ? vel : 1));
  return Math.pow(10, (source.gainDb + zone.gainDb) / 20) * Math.pow(v, EXPOSANT_VEL);
}

/** Écart (en demi-tons) entre une note et la tessiture d'une zone (0 si elle la couvre). */
function horsZone(z: ZoneSource, midi: number): number {
  return midi < z.bas ? z.bas - midi : midi > z.haut ? midi - z.haut : 0;
}

/** Écart (en vélocités MIDI) entre une vélocité et la couche d'une zone (0 si elle la couvre). */
function horsCouche(z: ZoneSource, v: number): number {
  return v < z.velBas ? z.velBas - v : v > z.velHaut ? v - z.velHaut : 0;
}

export interface ChoixZone {
  zone: ZoneSource;
  /** Detune (cents) qui fait jouer `midi` à cette zone : 100 × (midi − racine) − cents. */
  detune: number;
}

/**
 * La zone qui joue `midi` à la vélocité `vel` (0,1 à 1) : celle qui couvre la note ET la couche ; sinon la plus proche
 * (d'abord en hauteur, puis en vélocité) : une note hors tessiture est jouée par la zone la plus proche, jamais muette.
 * null seulement si l'instrument n'a aucune zone.
 */
export function choisirZone(source: Pick<SourceZones, 'zones'>, midi: number, vel: number): ChoixZone | null {
  const v = velMidi(vel);
  const n = Math.round(midi);
  let meilleure: ZoneSource | null = null;
  let score = Infinity;
  for (const z of source.zones) {
    // La hauteur compte plus que la couche ; à égalité, la racine la plus proche (puis l'ordre du fichier).
    const s = horsZone(z, n) * 1e6 + horsCouche(z, v) * 1e3 + Math.abs(z.racine - n);
    if (s < score) {
      score = s;
      meilleure = z;
    }
  }
  return meilleure ? { zone: meilleure, detune: 100 * (midi - meilleure.racine) - meilleure.cents } : null;
}

/** Les fichiers à décoder pour jouer ces notes (vélocités 0,1 à 1) : seulement les zones jouées. */
export function fichiersPour(source: Pick<SourceZones, 'zones'>, notes: Iterable<{ midi: number; vel: number }>): Set<string> {
  const res = new Set<string>();
  const vus = new Set<number>();
  for (const n of notes) {
    const cle = Math.round(n.midi) * 128 + velMidi(n.vel);
    if (vus.has(cle)) continue;
    vus.add(cle);
    const c = choisirZone(source, n.midi, n.vel);
    if (c) res.add(c.zone.fichier);
  }
  return res;
}

/** Le groupe exclusif d'une note (indice dans `exclusif`), ou −1. */
export function groupeExclusif(source: Pick<SourceZones, 'exclusif'>, midi: number): number {
  const g = source.exclusif;
  if (!g) return -1;
  const n = Math.round(midi);
  return g.findIndex((x) => x.includes(n));
}

/**
 * Glissé de la fin d'une note vers `vers` (MIDI) : la rampe de detune commence à `debut` (s après le départ de la
 * note) et finit à la fin de la note (`duree`). Durée : DUREE_GLISSE, au plus la moitié de la note.
 */
export function rampeGlisse(duree: number): { debut: number; fin: number } {
  const d = Math.max(0, duree);
  return { debut: d - Math.min(DUREE_GLISSE, d * 0.5), fin: d };
}

/**
 * Position (s de TAMPON) atteinte après `ecoule` s de note : le tampon avance à 2^(detune/1200), et pendant un glissé
 * (detune linéaire de c0 à c1 entre `debut` et `fin`), à l'intégrale de cette vitesse. Sert à la reprise (saut, relais).
 */
export function positionTampon(ecoule: number, detune: number, glisse?: { debut: number; fin: number; cents: number }): number {
  const vitesse = (c: number) => Math.pow(2, c / 1200);
  if (!glisse || ecoule <= glisse.debut || glisse.cents === 0) return Math.max(0, ecoule) * vitesse(detune);
  const avant = glisse.debut * vitesse(detune);
  const duree = Math.max(1e-9, glisse.fin - glisse.debut);
  const t = Math.min(ecoule, glisse.fin) - glisse.debut;
  // detune(t) = c0 + k t : ∫ 2^(detune/1200) dt = (r(t) − r(0)) / (k ln2 / 1200).
  const k = glisse.cents / duree;
  const pendant = (vitesse(detune + k * t) - vitesse(detune)) / ((k * Math.LN2) / 1200);
  const apres = Math.max(0, ecoule - glisse.fin) * vitesse(detune + glisse.cents);
  return avant + pendant + apres;
}

/**
 * Comme positionTampon, mais comme Chrome le joue : `detune` est k-rate, sa valeur est prise au DÉBUT de chaque bloc
 * de rendu (`bloc` = 128 trames, grille calée sur le temps 0 du contexte). `depart` : heure du début de la note.
 * `bend(r)` : pitch bend de la piste (cents) à r s du début de la note, ajouté au detune. Sans glissé ni bend, la
 * vitesse est constante : même résultat que positionTampon.
 */
export function positionTamponBlocs(
  depart: number,
  ecoule: number,
  detune: number,
  glisse: { debut: number; fin: number; cents: number } | undefined,
  bloc: number,
  bend?: (r: number) => number,
): number {
  const g = glisse && ecoule > glisse.debut && glisse.cents !== 0 ? glisse : undefined;
  if (!g && !bend) return positionTampon(ecoule, detune);
  const propre = (r: number) => (!g || r <= g.debut ? detune : r >= g.fin ? detune + g.cents : detune + (g.cents * (r - g.debut)) / (g.fin - g.debut));
  let pos = 0;
  let t = 0;
  for (let b = Math.floor(depart / bloc) * bloc; t < ecoule - 1e-12; b += bloc) {
    const fin = Math.min(b + bloc - depart, ecoule);
    if (fin > t) pos += (fin - t) * Math.pow(2, (propre(b - depart) + (bend ? bend(Math.max(0, b - depart)) : 0)) / 1200);
    t = Math.max(t, fin);
  }
  return pos;
}
