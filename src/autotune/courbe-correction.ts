// Courbe de correction de l'autotune avancé (cents par trame YIN), région voisée par région voisée.
// Même calcul que corrigerVoix (correction.ts) quand il n'y a pas de note éditée et que humaniser = 1 :
//  - centre = moyenne glissante de 150 ms de la hauteur (bornée à la région) ; détail d = hauteur − centre (vibrato) ;
//  - note visée = la plus proche du centre dans la gamme (hystérésis ±20 cents) ;
//  - voulu = note + humaniser × d ; correction brute = (voulu − hauteur) × force.
// Note éditée (Prise.autotune.notes) : note visée = midi × 100 + cents, d mesuré DANS la note, multiplié par son
// `vibrato`, force 1 (la main de l'utilisateur l'emporte).
// Puis la vitesse : passe-bas aller-retour (sans retard) de constante `vitesse` ms (0 = aucun : robot).
// Fichier pur : Worker et tests.

import type { AutotunePrise, NoteAutotune } from '../morceau/types';
import { enHz, noteProche } from './gamme';
import type { Hauteurs } from './yin';

const CENTRE_S = 0.15;
const HYSTERESIS = 20;
export const FONDU_S = 0.02;

/** Région voisée : trames [i0, i1[ et échantillons [a, b[ (comme corrigerVoix). */
export interface Region {
  i0: number;
  i1: number;
  a: number;
  b: number;
}

/** Régions voisées d'une analyse, en trames et en échantillons d'un signal de `n` échantillons à `fs` Hz. */
export function regionsVoisees(h: Hauteurs, fs: number, n: number): Region[] {
  const out: Region[] = [];
  for (let i = 0; i < h.cents.length; ) {
    if (Number.isNaN(h.cents[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < h.cents.length && !Number.isNaN(h.cents[j]!)) j++;
    const a = Math.max(0, Math.round((i * h.pas + h.centre - h.pas / 2) * fs));
    const b = Math.min(n, Math.round(((j - 1) * h.pas + h.centre + h.pas / 2) * fs));
    out.push({ i0: i, i1: j, a, b });
    i = j;
  }
  return out;
}

/** Part des trames sonores qui sont voisées (0 à 1). */
export function partVoisee(h: Hauteurs): number {
  let sonores = 0;
  let voisees = 0;
  for (let i = 0; i < h.cents.length; i++) {
    sonores += h.sonore[i]!;
    if (!Number.isNaN(h.cents[i]!)) voisees++;
  }
  return sonores > 0 ? voisees / sonores : 0;
}

/** Moyenne de h.cents sur [i − k, i + k] bornée à [lo, hi[. */
function moyenne(h: Hauteurs, i: number, k: number, lo: number, hi: number): number {
  let s = 0;
  let n = 0;
  for (let j = Math.max(lo, i - k); j <= Math.min(hi - 1, i + k); j++) {
    s += h.cents[j]!;
    n++;
  }
  return s / n;
}

/** Correction (cents) de chaque trame de la région, déjà lissée par la vitesse. */
export function courbeRegion(h: Hauteurs, r: Region, classes: number[], reglages: AutotunePrise): Float32Array {
  const { i0, i1 } = r;
  const k = Math.max(1, Math.round(CENTRE_S / h.pas / 2));
  const notes = reglages.notes ?? [];
  const brute = new Float32Array(i1 - i0);
  const hum = Math.min(1, Math.max(0, reglages.humaniser));
  const force = Math.min(1, Math.max(0, reglages.force));
  let note = NaN;
  let q = 0; // première note éditée qui peut contenir la trame (les notes sont triées)
  let lo = 0;
  let hi = 0;
  let courante: NoteAutotune | undefined;
  for (let i = i0; i < i1; i++) {
    const p = h.cents[i]!;
    const centre = moyenne(h, i, k, i0, i1);
    const proche = noteProche(centre, classes);
    if (Number.isNaN(note) || Math.abs(centre - note) - Math.abs(centre - proche) > 2 * HYSTERESIS) note = proche;
    const t = i * h.pas + h.centre;
    while (q < notes.length && notes[q]!.fin <= t) q++;
    const n = q < notes.length && notes[q]!.debut <= t ? notes[q] : undefined;
    if (n) {
      if (n !== courante) {
        courante = n;
        lo = Math.max(i0, Math.ceil((n.debut - h.centre) / h.pas));
        hi = Math.min(i1, Math.floor((n.fin - h.centre) / h.pas) + 1);
      }
      const c = moyenne(h, i, k, Math.min(lo, i), Math.max(hi, i + 1));
      brute[i - i0] = n.midi * 100 + n.cents + Math.max(0, n.vibrato) * (p - c) - p;
    } else {
      brute[i - i0] = (note - centre - (1 - hum) * (p - centre)) * force;
    }
  }
  const tau = reglages.vitesse / 1000;
  const a = tau > 0 ? 1 - Math.exp(-h.pas / tau) : 1;
  if (a < 1) {
    for (let i = 1; i < brute.length; i++) brute[i] = brute[i - 1]! + a * (brute[i]! - brute[i - 1]!);
    for (let i = brute.length - 2; i >= 0; i--) brute[i] = brute[i + 1]! + a * (brute[i]! - brute[i + 1]!);
  }
  return brute;
}

/** Valeur d'une courbe par trame au temps `s` (échantillon), interpolée, bornée à la région (comme corrigerVoix). */
export function auTemps(v: (i: number) => number, s: number, fs: number, h: Hauteurs, r: Region): number {
  const t = Math.min(r.i1 - 1, Math.max(r.i0, (s / fs - h.centre) / h.pas));
  const i = Math.min(r.i1 - 2, Math.floor(t));
  if (i < r.i0) return v(r.i0);
  const f = t - i;
  return v(i) + f * (v(i + 1) - v(i));
}

/** Période de la voix (échantillons) au temps `s`. */
export function periodeAu(h: Hauteurs, r: Region, fs: number): (s: number) => number {
  return (s) => fs / enHz(auTemps((i) => h.cents[i]!, s, fs, h, r));
}

/** Rapport de hauteur au temps `s` pour une courbe de correction de la région. */
export function rapportAu(corr: Float32Array, h: Hauteurs, r: Region, fs: number): (s: number) => number {
  return (s) => Math.pow(2, auTemps((i) => corr[i - r.i0]!, s, fs, h, r) / 1200);
}
