// « Accord en un toucher » (U1) : les notes d'un accord posé sur une note racine (majeur, mineur, 7, sus, ou
// l'accord « dans la gamme » du degré), et le degré romain équivalent (pour poserAccord). Pur, déterministe.

import { BORNES_NOTE, type Morceau } from '../../morceau/types';
import { demiTonsDegre, GAMMES, hauteurTonique } from '../../morceau/theorie';

export const TYPES_ACCORD = ['gamme', 'majeur', 'mineur', '7', 'sus'] as const;
export type TypeAccord = (typeof TYPES_ACCORD)[number];

const INTERVALLES: Record<Exclude<TypeAccord, 'gamme'>, number[]> = {
  majeur: [0, 4, 7],
  mineur: [0, 3, 7],
  '7': [0, 4, 7, 10],
  sus: [0, 5, 7],
};

const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Place de la note dans la gamme du morceau (0 à 6), ou −1 si elle n'en fait pas partie. */
export function degreDansGamme(midi: number, tonalite: Morceau['tonalite']): number {
  const rel = (((midi - hauteurTonique(tonalite.tonique)) % 12) + 12) % 12;
  return GAMMES[tonalite.mode].findIndex((d) => d === rel);
}

/**
 * Notes MIDI de l'accord posé sur `racine`. « gamme » : les degrés 1, 3 et 5 de la gamme à partir de la racine
 * (jamais de fausse note) ; une racine hors de la gamme prend l'accord majeur. Notes hors BORNES_NOTE retirées.
 */
export function notesAccordSur(racine: number, type: TypeAccord, tonalite: Morceau['tonalite']): number[] {
  let intervalles: number[];
  if (type === 'gamme') {
    const d = degreDansGamme(racine, tonalite);
    if (d < 0) intervalles = INTERVALLES.majeur;
    else {
      const base = demiTonsDegre(tonalite.mode, d);
      intervalles = [0, 2, 4].map((k) => demiTonsDegre(tonalite.mode, d + k) - base);
    }
  } else intervalles = INTERVALLES[type];
  return intervalles
    .map((i) => racine + i)
    .filter((n) => n >= BORNES_NOTE.midiMin && n <= BORNES_NOTE.midiMax);
}

/**
 * Le degré romain de l'accord (« VI », « ii », « bVII7 », « IVsus4 »…) dans la tonalité, lu par theorie.lireDegre.
 * Une racine hors de la gamme prend un « b » (bémol) devant le degré du dessus.
 */
export function degreAccord(racine: number, type: TypeAccord, tonalite: Morceau['tonalite']): string {
  const rel = (((racine - hauteurTonique(tonalite.tonique)) % 12) + 12) % 12;
  const gamme = GAMMES[tonalite.mode];
  let d = gamme.findIndex((x) => x === rel);
  let alteration = '';
  if (d < 0) {
    d = gamme.findIndex((x) => x === (rel + 1) % 12);
    alteration = 'b';
    if (d < 0) d = 0;
  }
  const romain = ROMAINS[d]!;
  if (type === 'gamme') {
    const notes = notesAccordSur(racine, 'gamme', tonalite).map((n) => n - racine);
    if (notes[1] === 3 && notes[2] === 6) return `${alteration}${romain.toLowerCase()}°`;
    return notes[1] === 3 ? alteration + romain.toLowerCase() : alteration + romain;
  }
  if (type === 'mineur') return alteration + romain.toLowerCase();
  if (type === '7') return `${alteration}${romain}7`;
  if (type === 'sus') return `${alteration}${romain}sus4`;
  return alteration + romain;
}
