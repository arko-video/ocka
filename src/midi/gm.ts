// General MIDI ↔ OCKA : programme GM → instrument proche du catalogue (et retour), notes de batterie GM (canal 10)
// ↔ pads de la batterie OCKA. Tables simples, sans réseau : un instrument pas encore téléchargé reste « bien écrit »
// (muet avec un conseil, comme le prévoit le format).

import type { InstrumentBatterie } from '../morceau/types';

/** Instrument OCKA de chaque famille GM (8 programmes), affiné ensuite par PRECIS. */
const FAMILLES = [
  'vcsl-piano-queue@1', // 0 pianos
  'vcsl-vibraphone@1', // 8 percussions chromatiques
  'freepats-orgue-electrique@1', // 16 orgues
  'freepats-guitare-claire@1', // 24 guitares
  'karoryfer-basse@1', // 32 basses
  'vsco-cordes@1', // 40 cordes
  'vsco-cordes@1', // 48 ensembles
  'vsco-trompette@1', // 56 cuivres
  'vcsl-saxophone@1', // 64 anches
  'vsco-flute@1', // 72 flûtes
  'ocka-lead@1', // 80 synthé lead
  'ocka-nappe@1', // 88 synthé nappe
  'ocka-nappe@1', // 96 effets synthé
  'freepats-ukulele@1', // 104 ethniques
  'freepats-percussions@1', // 112 percussions
  'ocka-pluck@1', // 120 bruitages
] as const;

const PRECIS: Record<number, string> = {
  1: 'vcsl-piano-queue@1', 2: 'vsco-piano-droit@1', 3: 'freepats-piano-bastringue@1', 4: 'freepats-piano-fm@1',
  5: 'freepats-piano-fm@1', 6: 'vcsl-clavecin@1', 7: 'vcsl-clavecin@1',
  8: 'vcsl-glockenspiel@1', 9: 'vcsl-glockenspiel@1', 10: 'freepats-kalimba@1', 12: 'vcsl-marimba@1',
  13: 'vcsl-xylophone@1', 14: 'vcsl-cloches@1', 15: 'freepats-kalimba@1',
  19: 'vcsl-orgue@1', 20: 'freepats-accordeon@1', 21: 'freepats-accordeon@1', 22: 'freepats-accordeon@1', 23: 'freepats-accordeon@1',
  24: 'freepats-guitare-nylon@1', 29: 'freepats-guitare-saturee@1', 30: 'freepats-guitare-saturee@1',
  32: 'karoryfer-contrebasse@1', 40: 'vsco-violon@1', 41: 'vsco-violon@1', 42: 'vsco-violoncelles@1',
  43: 'karoryfer-contrebasse@1', 45: 'vsco-pizzicato@1', 46: 'vcsl-harpe@1', 47: 'vsco-cordes-staccato@1',
  50: 'ocka-nappe@1', 51: 'ocka-nappe@1', 52: 'ocka-nappe@1', 53: 'ocka-nappe@1', 54: 'ocka-nappe@1', 55: 'vsco-cordes-staccato@1',
  57: 'vsco-trombone@1', 58: 'vsco-tuba@1', 60: 'vsco-cor@1', 62: 'ocka-lead@1', 63: 'ocka-lead@1',
  68: 'vsco-hautbois@1', 69: 'vsco-hautbois@1', 70: 'vsco-basson@1', 71: 'vsco-clarinette@1',
  104: 'freepats-guitare-nylon@1', 107: 'vcsl-harpe@1', 108: 'freepats-kalimba@1', 109: 'freepats-accordeon@1',
  110: 'vsco-violon@1', 111: 'vsco-hautbois@1', 112: 'vcsl-cloches@1', 113: 'vcsl-percussions-latines@1',
  114: 'vcsl-marimba@1', 115: 'vcsl-percussions-latines@1',
};

/** Instrument OCKA d'un programme GM (0 à 127). */
export function instrumentDuProgramme(programme: number): string {
  const p = Math.min(127, Math.max(0, Math.round(programme) || 0));
  return PRECIS[p] ?? FAMILLES[p >> 3]!;
}

/** Programme GM d'un instrument OCKA (le premier qui y mène) ; SoundFont : son preset ; inconnu : 0 (piano). */
export function programmeDe(instrument: string): number {
  const sf2 = /^sf2-.+-(\d{1,3})-(\d{1,3})@\d+$/.exec(instrument);
  if (sf2) return Math.min(127, Number(sf2[2]));
  const v1: Record<string, number> = {
    'ocka-piano@1': 0, 'ocka-epiano@1': 4, 'ocka-lead@1': 80, 'ocka-pluck@1': 84, 'ocka-nappe@1': 88, 'ocka-cloche@1': 14,
  };
  if (instrument in v1) return v1[instrument]!;
  if (instrument.startsWith('ocka-')) return 81; // synthés fabriqués (303, chiptune…) : « lead » GM
  for (let p = 0; p < 128; p++) if (instrumentDuProgramme(p) === instrument) return p;
  return 0;
}

/** Note GM jouée pour chaque pad à l'export ; les pads perso vont sur 27 à 30 (rares en GM), relus pareil. */
export const NOTE_PAD: Record<InstrumentBatterie, number> = {
  kick: 36, snare: 38, clap: 39, charley: 42, charleyOuvert: 46, rim: 37, cowbell: 56, perc: 75,
  perso1: 27, perso2: 28, perso3: 29, perso4: 30,
};

/** Pad OCKA d'une note de batterie GM (kick, snare, charley…) ; « perc » pour les autres percussions. */
export function padDeNote(note: number): InstrumentBatterie {
  for (const [pad, n] of Object.entries(NOTE_PAD)) if (n === note) return pad as InstrumentBatterie;
  if (note === 35) return 'kick';
  if (note === 40) return 'snare';
  if (note === 44 || note === 51 || note === 53 || note === 59 || note === 69 || note === 70) return 'charley';
  if (note === 49 || note === 52 || note === 55 || note === 57) return 'charleyOuvert';
  if (note === 31 || note === 33) return 'rim';
  return 'perc';
}

/** Canal MIDI de la batterie (canal 10, compté à partir de 0). */
export const CANAL_BATTERIE = 9;
