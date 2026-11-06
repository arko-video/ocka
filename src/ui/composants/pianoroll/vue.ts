// État du piano roll « Complet » gardé d'une ouverture à l'autre (pas dans le morceau) : zoom, défilement, gamme,
// quantification, durée des notes posées, accord en un toucher, notes choisies, presse-papiers, couloir de vélocité.
// Géométrie pure (lignes du clavier, bornes du zoom) : testable sans navigateur.

import { signal } from '@preact/signals';
import type { Morceau, Note } from '../../../morceau/types';
import { GAMMES, hauteurTonique } from '../../../morceau/theorie';
import type { TypeAccord } from '../../edition/accords';
import type { NotesCopiees } from '../../edition/notes';

/** Notes affichées par le clavier : do 1 à do 8. */
export const MIDI_BAS = 24;
export const MIDI_HAUT = 108;
export const ZOOM = { mesuresMin: 1, mesuresMax: 8, lignesMin: 7, lignesMax: 24 } as const;

/** Grilles de quantification (pas) : 1/4 à 1/32, puis les triolets. */
export const QUANTIFS: { v: number; nom: string }[] = [
  { v: 4, nom: '1/4' },
  { v: 2, nom: '1/8' },
  { v: 1, nom: '1/16' },
  { v: 0.5, nom: '1/32' },
  { v: 8 / 3, nom: '1/4 T' },
  { v: 4 / 3, nom: '1/8 T' },
  { v: 2 / 3, nom: '1/16 T' },
];

export const mesuresVues = signal(2);
export const lignesVues = signal(14);
/** Premier pas visible à gauche (nombre réel). */
export const debutPas = signal(0);
/** Ligne du clavier en haut de la grille (nombre réel ; 0 = la plus aiguë). */
export const hautLigne = signal(-1);
export const gammeSeule = signal(true);
export const quantif = signal(1);
/** Durée des notes posées (pas) : la dernière choisie avec la poignée. */
export const derniereDuree = signal(2);
export const typeAccord = signal<TypeAccord | null>(null);
/** Notes choisies, par clé « pas|midi » (survit au tri des notes après une modification). */
export const choisies = signal<ReadonlySet<string>>(new Set());
export const presse = signal<NotesCopiees | null>(null);
export const couloirOuvert = signal(false);

export const cleNote = (n: Pick<Note, 'pas' | 'midi'>) => `${n.pas}|${n.midi}`;
export const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Lignes du clavier, de la plus aiguë à la plus grave : toutes les notes, ou seulement celles de la gamme. */
export function lignesClavier(tonalite: Morceau['tonalite'], gamme: boolean): number[] {
  const t = hauteurTonique(tonalite.tonique);
  const dans = new Set(GAMMES[tonalite.mode].map((d) => (t + d) % 12));
  const out: number[] = [];
  for (let midi = MIDI_HAUT; midi >= MIDI_BAS; midi--) if (!gamme || dans.has(midi % 12)) out.push(midi);
  return out;
}

/** Ligne (réelle) d'une note : sa ligne, ou entre deux lignes si elle n'est pas dans la gamme affichée. */
export function ligneDe(midi: number, lignes: readonly number[]): number {
  const i = lignes.indexOf(midi);
  if (i >= 0) return i;
  const dessous = lignes.findIndex((x) => x < midi);
  return dessous < 0 ? lignes.length - 0.5 : dessous - 0.5;
}

/** Note de la gamme ? Tonique ? (couleurs du clavier). */
export function couleurNote(midi: number, tonalite: Morceau['tonalite']): 'tonique' | 'gamme' | 'hors' {
  const rel = (((midi - hauteurTonique(tonalite.tonique)) % 12) + 12) % 12;
  if (rel === 0) return 'tonique';
  return GAMMES[tonalite.mode].includes(rel) ? 'gamme' : 'hors';
}

/** Pas « aimanté » : arrondi à la grille de quantification la plus proche (vers le bas pour un toucher). */
export function aimanter(pas: number, q: number, versLeBas = false): number {
  const k = versLeBas ? Math.floor(pas / q + 1e-6) : Math.round(pas / q);
  return Math.round(k * q * 24) / 24;
}

/** Ligne du haut pour centrer la vue sur les notes (ou sur la tonique autour du do 4). */
export function hautCentre(
  notes: readonly Note[],
  lignes: readonly number[],
  nLignes: number,
  tonalite: Morceau['tonalite'],
): number {
  const midiCentre = notes.length
    ? notes.reduce((s, n) => s + n.midi, 0) / notes.length
    : 60 + hauteurTonique(tonalite.tonique) + 5;
  const centre = ligneDe(Math.round(midiCentre), lignes);
  return borne(Math.round(centre - nLignes / 2), 0, Math.max(0, lignes.length - nLignes));
}
