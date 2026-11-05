// Hauteurs en cents (100 cents = 1 demi-ton ; 6900 = la 440 Hz, comme le numéro MIDI × 100) et gamme du morceau.
// Fichier pur : utilisé dans le Worker de l'autotune et par les tests.

import type { Mode, Tonique } from '../morceau/types';

const TONIQUES: Tonique[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Degrés (demi-tons au-dessus de la tonique) : majeur, et mineur naturel. */
const DEGRES: Record<Mode, number[]> = { majeur: [0, 2, 4, 5, 7, 9, 11], mineur: [0, 2, 3, 5, 7, 8, 10] };

export const enCents = (hz: number): number => 6900 + 1200 * Math.log2(hz / 440);
export const enHz = (cents: number): number => 440 * Math.pow(2, (cents - 6900) / 1200);

/** Les 7 classes de hauteur (0 = do … 11 = si) de la gamme d'une tonalité. */
export function gamme(tonalite: { tonique: Tonique; mode: Mode }): number[] {
  const t = Math.max(0, TONIQUES.indexOf(tonalite.tonique));
  return DEGRES[tonalite.mode].map((d) => (t + d) % 12).sort((a, b) => a - b);
}

/** La note de la gamme (en cents, multiple de 100) la plus proche d'une hauteur (cents). */
export function noteProche(cents: number, classes: number[]): number {
  const base = Math.floor(cents / 1200) * 1200;
  let meilleure = base;
  let ecart = Infinity;
  for (const o of [-1200, 0, 1200]) {
    for (const c of classes) {
      const n = base + o + c * 100;
      const e = Math.abs(cents - n);
      if (e < ecart) {
        ecart = e;
        meilleure = n;
      }
    }
  }
  return meilleure;
}

/** Nom sûr d'une tonalité pour un nom de fichier (« C#-mineur » → « Cdiese-mineur »). */
export function nomTonalite(tonalite: { tonique: Tonique; mode: Mode }): string {
  return `${tonalite.tonique.replace('#', 'diese')}-${tonalite.mode}`;
}
