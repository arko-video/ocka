// Éditeur de notes de l'autotune : état de la vue (zoom, défilement, aimant) gardé d'une ouverture à l'autre, et
// géométrie PURE (lignes chromatiques, couleurs de la gamme, courbe de hauteur dessinée, médianes des notes).
// Lignes : une par demi-ton, de MIDI_MAX (en haut, ligne 0) à MIDI_MIN. Temps : secondes DANS le fichier de la prise.

import { signal } from '@preact/signals';
import type { CourbeHauteur } from '../../../moteur/api';
import type { NoteAutotune } from '../../../morceau/types';
import { MIDI_MAX, MIDI_MIN } from '../../edition/autotune';

export const NB_LIGNES = MIDI_MAX - MIDI_MIN + 1;
export const ZOOM_NOTES = { secondesMin: 0.5, secondesMax: 30, lignesMin: 8, lignesMax: 30 } as const;

/** Secondes visibles en largeur, lignes visibles en hauteur. */
export const secondesVues = signal(5);
export const lignesVues = signal(14);
/** Temps visible à gauche (s) et ligne du haut (réelle). */
export const debutT = signal(0);
export const hautLigne = signal(0);
/** Aimant : glisser une note la pose sur la gamme (« Gamme ») ou sur n'importe quel demi-ton (« Libre »). */
export const libre = signal(false);

export const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
export const ligneDeMidi = (midi: number) => MIDI_MAX - midi;
export const midiDeLigne = (ligne: number) => MIDI_MAX - ligne;

export interface GeoNotes {
  /** Pixels par seconde, hauteur d'une ligne (px). */
  pxS: number;
  h: number;
  /** Temps à gauche (s), ligne du haut. */
  t0: number;
  haut: number;
  secondes: number;
  nLignes: number;
  largeur: number;
  hauteur: number;
  /** Partie gardée de la prise (s). */
  tMin: number;
  tMax: number;
}

export function couleurLigne(midi: number, classes: ReadonlySet<number> | null, tonique: number | null): 'tonique' | 'gamme' | 'hors' {
  if (tonique !== null && midi % 12 === tonique) return 'tonique';
  return !classes || classes.has(midi % 12) ? 'gamme' : 'hors';
}

/** Vue de départ : 3 s de la partie gardée, dès la 1re note, centrée sur la hauteur moyenne des notes. */
export function vueDepart(notes: readonly NoteAutotune[], tMin: number, tMax: number, nLignes: number): { debut: number; secondes: number; haut: number } {
  const secondes = borne(Math.min(3, tMax - tMin), ZOOM_NOTES.secondesMin, ZOOM_NOTES.secondesMax);
  const premiere = notes.find((n) => n.fin > tMin);
  const debut = premiere && premiere.debut > tMin + secondes / 2 ? premiere.debut - 0.3 : tMin;
  const moyenne = notes.length ? notes.reduce((s, n) => s + n.midi, 0) / notes.length : 62;
  const haut = borne(Math.round(ligneDeMidi(moyenne) - nLignes / 2), 0, NB_LIGNES - nLignes);
  return { debut, secondes, haut };
}

/** Hauteur médiane chantée (cents MIDI) de chaque note, d'après la courbe (repli : la note elle-même). */
export function medianes(courbe: CourbeHauteur | null, notes: readonly NoteAutotune[]): number[] {
  return notes.map((n) => {
    if (!courbe) return n.midi * 100;
    const a = Math.max(0, Math.ceil((n.debut - courbe.debut) / courbe.pas));
    const b = Math.min(courbe.cents.length - 1, Math.floor((n.fin - courbe.debut) / courbe.pas));
    const v: number[] = [];
    for (let i = a; i <= b; i++) if (Number.isFinite(courbe.cents[i]!)) v.push(courbe.cents[i]!);
    if (!v.length) return n.midi * 100;
    v.sort((x, y) => x - y);
    return v[Math.floor(v.length / 2)]!;
  });
}

/**
 * Chemins SVG de la courbe dans la fenêtre visible : `brute` (la voix chantée) et `corrigee` (chaque note ramenée sur
 * sa hauteur visée + justesse, son vibrato multiplié). Un point tous les 2 px au plus ; coupée aux trames non voisées.
 */
export function cheminsCourbe(
  courbe: CourbeHauteur,
  notes: readonly NoteAutotune[],
  meds: readonly number[],
  g: GeoNotes,
): { brute: string; corrigee: string } {
  const y = (cents: number) => ((ligneDeMidi(cents / 100) - g.haut + 0.5) * g.h).toFixed(1);
  const premier = Math.max(0, Math.floor((g.t0 - courbe.debut) / courbe.pas) - 1);
  const dernier = Math.min(courbe.cents.length - 1, Math.ceil((g.t0 + g.secondes - courbe.debut) / courbe.pas) + 1);
  const saut = Math.max(1, Math.ceil(2 / (courbe.pas * g.pxS)));
  let brute = '';
  let corrigee = '';
  let leve = true;
  let k = 0;
  for (let i = premier; i <= dernier; i += saut) {
    const c = courbe.cents[i]!;
    const t = courbe.debut + i * courbe.pas;
    if (!Number.isFinite(c) || t < g.tMin || t > g.tMax) {
      leve = true;
      continue;
    }
    while (k < notes.length && notes[k]!.fin <= t) k++;
    const n = notes[k];
    const dedans = n && n.debut <= t;
    const corr = dedans ? n.midi * 100 + n.cents + (c - meds[k]!) * n.vibrato : c;
    const x = ((t - g.t0) * g.pxS).toFixed(1);
    const l = leve ? 'M' : 'L';
    brute += `${l}${x} ${y(c)}`;
    corrigee += `${l}${x} ${y(corr)}`;
    leve = false;
  }
  return { brute, corrigee };
}
