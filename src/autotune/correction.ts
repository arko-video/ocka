// Autotune DOUX (décisions §7) : on ne corrige que le CENTRE de la hauteur, vers la note la plus proche de la gamme.
//  1. YIN sur le signal ramené à 16 kHz (yin.ts) : hauteur toutes les 10 ms, médiane sur 5 trames.
//  2. Repli : moins de 60 % des trames sonores sont voisées → rien n'est changé (et on le dit).
//  3. Centre = moyenne glissante de 150 ms de la hauteur (le vibrato et les petites inflexions restent).
//  4. Note visée = la plus proche du centre dans la gamme, avec une hystérésis de ±20 cents (pas de sautillement).
//  5. Correction = (note − centre), lissée (vitesse) puis dosée (force) : `force` de 0 à 1 règle les deux.
//  6. PSOLA sur chaque région voisée (psola.ts) ; les sons non voisés sont recopiés tels quels, avec des fondus de
//     20 ms aux bords des régions. Même longueur que la prise, au bit près. Fichier pur : Worker et tests.

import type { Mode, Tonique } from '../morceau/types';
import { reechantillonner } from '../moteur/reechantillonner';
import { enHz, gamme, noteProche } from './gamme';
import { psola } from './psola';
import { analyserHauteur, FREQ_ANALYSE, type Hauteurs } from './yin';

export const PART_VOISEE_MIN = 0.6;
const CENTRE_S = 0.15;
const HYSTERESIS = 20;
const FONDU_S = 0.02;

export interface ResultatAutotune {
  /** Le son corrigé (même longueur), ou la prise elle-même si rien n'est appliqué. */
  pcm: Float32Array;
  /** Part des trames sonores qui sont voisées (0 à 1). */
  voisees: number;
  /** false : repli (trop peu de trames voisées) ou force nulle ; `pcm` est alors l'entrée, intacte. */
  applique: boolean;
}

/** Dosage et vitesse selon la force : de « Naturel » (0,1 : 37 %, lent) à « Robot » (1 : 100 %, 5 ms). */
export function reglagesForce(force: number): { dose: number; vitesseS: number } {
  const f = Math.min(1, Math.max(0, force));
  return { dose: 0.3 + 0.7 * f, vitesseS: 0.005 + 0.12 * (1 - f) };
}

/** Régions voisées [i0, i1[ (en trames). */
function regions(cents: Float32Array): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < cents.length; ) {
    if (Number.isNaN(cents[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < cents.length && !Number.isNaN(cents[j]!)) j++;
    out.push([i, j]);
    i = j;
  }
  return out;
}

/** Correction (cents) de chaque trame d'une région : note visée − centre, lissée et dosée. */
function correctionRegion(h: Hauteurs, i0: number, i1: number, classes: number[], force: number): Float32Array {
  const k = Math.max(1, Math.round(CENTRE_S / h.pas / 2));
  const brute = new Float32Array(i1 - i0);
  let note = NaN;
  for (let i = i0; i < i1; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(i0, i - k); j <= Math.min(i1 - 1, i + k); j++) {
      s += h.cents[j]!;
      n++;
    }
    const centre = s / n;
    const proche = noteProche(centre, classes);
    if (Number.isNaN(note) || Math.abs(centre - note) - Math.abs(centre - proche) > 2 * HYSTERESIS) note = proche;
    brute[i - i0] = note - centre;
  }
  // Vitesse : passe-bas aller-retour (sans retard) ; puis la dose.
  const { dose, vitesseS } = reglagesForce(force);
  const a = 1 - Math.exp(-h.pas / vitesseS);
  for (let i = 1; i < brute.length; i++) brute[i] = brute[i - 1]! + a * (brute[i]! - brute[i - 1]!);
  for (let i = brute.length - 2; i >= 0; i--) brute[i] = brute[i + 1]! + a * (brute[i]! - brute[i + 1]!);
  for (let i = 0; i < brute.length; i++) brute[i] = brute[i]! * dose;
  return brute;
}

/** Corrige une prise mono (`fs` Hz) vers la gamme de `tonalite`. `force` de 0 à 1 (0 = rien). */
export function corrigerVoix(pcm: Float32Array, fs: number, force: number, tonalite: { tonique: Tonique; mode: Mode }): ResultatAutotune {
  const h = analyserHauteur(reechantillonner(pcm, fs, FREQ_ANALYSE));
  let sonores = 0;
  let voisees = 0;
  for (let i = 0; i < h.cents.length; i++) {
    sonores += h.sonore[i]!;
    if (!Number.isNaN(h.cents[i]!)) voisees++;
  }
  const part = sonores > 0 ? voisees / sonores : 0;
  if (force <= 0 || part < PART_VOISEE_MIN) return { pcm, voisees: part, applique: false };

  const classes = gamme(tonalite);
  const sortie = pcm.slice();
  const fondu = Math.round(FONDU_S * fs);
  for (const [i0, i1] of regions(h.cents)) {
    const a = Math.max(0, Math.round((i0 * h.pas + h.centre - h.pas / 2) * fs));
    const b = Math.min(pcm.length, Math.round(((i1 - 1) * h.pas + h.centre + h.pas / 2) * fs));
    if (b - a < 2 * fondu + 1) continue; // trop court pour les deux fondus : recopié tel quel
    const corr = correctionRegion(h, i0, i1, classes, force);
    // Valeur d'une courbe par trame au temps s (échantillon), interpolée linéairement, bornée à la région.
    const auTemps = (v: (i: number) => number, s: number) => {
      const t = Math.min(i1 - 1, Math.max(i0, (s / fs - h.centre) / h.pas));
      const i = Math.min(i1 - 2, Math.floor(t));
      if (i < i0) return v(i0);
      const f = t - i;
      return v(i) + f * (v(i + 1) - v(i));
    };
    const corrige = psola(pcm, a, b, {
      periode: (s) => fs / enHz(auTemps((i) => h.cents[i]!, s)),
      rapport: (s) => Math.pow(2, auTemps((i) => corr[i - i0]!, s) / 1200),
    });
    for (let i = a; i < b; i++) {
      const m = Math.min(1, (i - a) / fondu, (b - 1 - i) / fondu);
      sortie[i] = pcm[i]! + m * (corrige[i - a]! - pcm[i]!);
    }
  }
  return { pcm: sortie, voisees: part, applique: true };
}
