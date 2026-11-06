// Calage des notes jouées « au clavier » (pads de la gamme) : fonction pure, testée.
// Chaque toucher est daté sur l'horloge audio. On retire la latence de sortie (le son arrive en retard
// dans le casque) + ~25 ms (délai du toucher), puis on arrondit à la double-croche la plus proche.

import { dureePas, secondesVersPas } from '../../morceau/temps';
import type { Note } from '../../morceau/types';

/** Note calée au clavier (sans vélocité : 1 quand elle est posée). */
export type NoteCalee = Omit<Note, 'vel'> & { vel?: number };

/** Délai moyen entre le doigt qui touche l'écran et l'évènement reçu (s). */
export const DELAI_TOUCHER = 0.025;

export interface Frappe {
  /** Heure du contexte audio (s) à laquelle le pad a été touché. */
  heure: number;
  midi: number;
}

export interface OptionsCalage {
  /** Heure du contexte où le 1er pas de la section part vers la sortie (lecteur.heureDe). */
  heureDebut: number;
  /** À retirer de chaque frappe : lecteur.latenceSortie + DELAI_TOUCHER. */
  retrait: number;
  tempo: number;
  swing: number;
  /** Longueur de la section en pas : elle tourne en boucle pendant l'enregistrement. */
  pasSection: number;
  /** Longueur du motif en pas : les frappes calées au-delà sont « hors motif » et ignorées. */
  pasMotif: number;
  /** Durée des notes posées, en pas (la durée choisie dans la grille). */
  duree: number;
}

/**
 * Transforme les frappes en notes du motif. Ignorées : les frappes avant le début (décompte), celles qui
 * tombent hors du motif (au-delà de sa longueur dans la section), les hauteurs impossibles, les doublons.
 * Une frappe juste avant la fin de la boucle compte pour le 1er pas du tour suivant.
 */
export function calerFrappes(frappes: readonly Frappe[], o: OptionsCalage): NoteCalee[] {
  const d = dureePas(o.tempo);
  const tour = o.pasSection * d; // une paire de pas dure toujours 2 d, swing ou pas
  const vues = new Set<string>();
  const notes: NoteCalee[] = [];
  if (!(tour > 0) || o.pasMotif <= 0) return notes;
  for (const f of frappes) {
    if (!Number.isInteger(f.midi) || f.midi < 24 || f.midi > 108 || !Number.isFinite(f.heure)) continue;
    const t = f.heure - o.retrait - o.heureDebut;
    if (t < -d / 2) continue; // pendant le décompte
    const dansTour = t <= 0 ? 0 : t % tour;
    let pas = Math.round(secondesVersPas(o, dansTour));
    if (pas >= o.pasSection) pas = 0;
    if (pas >= o.pasMotif) continue; // hors motif
    const cle = `${pas}|${f.midi}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    notes.push({ pas, midi: f.midi, duree: Math.max(1, Math.min(Math.round(o.duree), o.pasMotif - pas)) });
  }
  return notes.sort((a, b) => a.pas - b.pas || a.midi - b.midi);
}
