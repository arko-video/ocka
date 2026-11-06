// Enregistrement en notes, partie pure : des événements datés (heure du contexte) aux notes d'un motif (pas dans la
// section, latence retirée, tours de boucle repliés : le dernier tour l'emporte), quantification, et pose dans le
// motif de la piste (MotifNotes, ou frappes du MotifBatterie pour le beatbox) en un seul changement (un Annuler).

import {
  avecMotifSection,
  estPisteInstrument,
  idMotifDe,
  motifParId,
  pisteDe,
  sectionDe,
} from '../morceau/acces';
import { idValide } from '../morceau/normaliser-outils';
import { secondesVersPas } from '../morceau/temps';
import {
  BORNES_NOTE,
  PLAFONDS,
  type InstrumentBatterie,
  type Morceau,
  type MotifBatterie,
  type Note,
} from '../morceau/types';
import type { NotesChantees } from './api-dubler';

/** Notes plus courtes que ça : des accidents (consonnes, respiration), ignorées. */
export const DUREE_MIN_S = 0.07;
const UN_PAS = 1 / 24;

/** Pads de batterie ↔ notes (General MIDI) pour passer des frappes du beatbox par NotesChantees. */
export const NOTES_BATTERIE: Record<InstrumentBatterie, number> = {
  kick: 36,
  rim: 37,
  snare: 38,
  clap: 39,
  charley: 42,
  perc: 47,
  charleyOuvert: 46,
  cowbell: 56, // prettier-ignore
  perso1: 60,
  perso2: 61,
  perso3: 62,
  perso4: 63,
};
export const ID_BATTERIE = 'batterie';

/** Un changement entendu pendant l'enregistrement : heure (s, horloge du contexte), notes jouées ([] = silence). */
export interface EvenementDate {
  heure: number;
  jouees: number[];
  vel: number;
}

export interface CadreEnregistrement {
  tempo: number;
  swing: number;
  /** Heure du contexte où le début de la section sort du lecteur (1er tour), et latence aller-retour (s). */
  heureSection: number;
  latence: number;
  /** Longueur de la section et du motif (pas). */
  pasSection: number;
  pasMotif: number;
  /** Frappes (beatbox) : chaque événement est une frappe d'un pas, pas une note tenue. */
  frappes?: boolean;
}

const grille = (x: number) => Math.round(x * 24) / 24;
const borner = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Range, dédoublonne (même pas, même hauteur) et plafonne des notes valides. */
export function rangerNotes(notes: readonly Note[], pasMotif: number): Note[] {
  const vues = new Set<string>();
  const sortie: Note[] = [];
  for (const n of [...notes].sort((a, b) => a.pas - b.pas || a.midi - b.midi)) {
    const pas = borner(grille(n.pas), 0, pasMotif - UN_PAS);
    const midi = Math.round(borner(n.midi, BORNES_NOTE.midiMin, BORNES_NOTE.midiMax));
    const cle = `${pas}|${midi}`;
    if (vues.has(cle) || !Number.isFinite(pas)) continue;
    vues.add(cle);
    const duree = borner(grille(n.duree), UN_PAS, pasMotif - pas);
    const vel = Math.round(borner(n.vel, BORNES_NOTE.velMin, BORNES_NOTE.velMax) * 100) / 100;
    sortie.push({ pas, duree, midi, vel });
    if (sortie.length >= PLAFONDS.notesParMotifNotes) break;
  }
  return sortie;
}

/** Des événements datés aux notes du motif (pas dans le motif, replié sur sa longueur). */
export function notesDepuisEvenements(
  evenements: readonly EvenementDate[],
  fin: number,
  c: CadreEnregistrement,
): Note[] {
  const tempsPas = (rel: number) => secondesVersPas({ tempo: c.tempo, swing: c.swing }, rel);
  const evts = [...evenements].sort((a, b) => a.heure - b.heure);
  const dureePas = 60 / c.tempo / 4;
  const brutes: { tour: number; pas: number; duree: number; midi: number; vel: number }[] = [];
  for (let i = 0; i < evts.length; i++) {
    const e = evts[i]!;
    if (e.jouees.length === 0) continue;
    const debut = e.heure - c.latence - c.heureSection;
    const finNote = (evts[i + 1]?.heure ?? fin) - c.latence - c.heureSection;
    if (!c.frappes && finNote - debut < DUREE_MIN_S) continue;
    // Chanté juste avant la section (fin du décompte) : on le garde au début s'il est à moins d'une demi-double-croche.
    if (debut < -dureePas / 2) continue;
    const absolu = Math.max(0, tempsPas(Math.max(0, debut)));
    const tour = Math.floor(absolu / c.pasMotif + 1e-9);
    const pas = absolu - tour * c.pasMotif;
    const duree = c.frappes ? 1 : Math.max(UN_PAS, tempsPas(Math.max(0, finNote)) - absolu);
    for (const midi of e.jouees)
      brutes.push({ tour, pas, duree: Math.min(duree, c.pasMotif - pas), midi, vel: e.vel });
  }
  // Tours de boucle : une note d'un tour plus récent efface celles des tours d'avant qu'elle chevauche.
  const gardees: typeof brutes = [];
  for (const n of brutes.sort((a, b) => b.tour - a.tour)) {
    const cache = gardees.some((g) => g.tour > n.tour && g.pas < n.pas + n.duree && n.pas < g.pas + g.duree);
    if (!cache) gardees.push(n);
  }
  return rangerNotes(
    gardees.map(({ pas, duree, midi, vel }) => ({ pas, duree, midi, vel })),
    c.pasMotif,
  );
}

/** Quantifie des notes (pas arrondis vers la grille `quantif`, dosés par `force`) ; null = inchangées. Pure. */
export function quantifierNotesChantees(notes: readonly Note[], quantif: number | null, force = 1): Note[] {
  if (quantif === null || !(quantif > 0) || !Number.isFinite(quantif)) return notes.map((n) => ({ ...n }));
  const f = borner(Number.isFinite(force) ? force : 1, 0, 1);
  const sortie = notes.map((n) => {
    const cible = Math.round(n.pas / quantif) * quantif;
    const pas = Math.max(0, grille(n.pas + (cible - n.pas) * f));
    // La fin suit la grille aussi (au moins une case), pour des notes propres dans le piano roll.
    const finCible = Math.max(cible + quantif, Math.round((n.pas + n.duree) / quantif) * quantif);
    const fin = n.pas + n.duree + (finCible - (n.pas + n.duree)) * f;
    return { ...n, pas, duree: Math.max(UN_PAS, grille(fin - pas)) };
  });
  const vues = new Set<string>();
  return sortie
    .sort((a, b) => a.pas - b.pas || a.midi - b.midi)
    .filter((n) => {
      const cle = `${n.pas}|${n.midi}`;
      if (vues.has(cle)) return false;
      vues.add(cle);
      return true;
    });
}

function idLibre(m: Morceau, base: string): string {
  const propre = base.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 32) || 'motif';
  const pris = (id: string) => Object.hasOwn(m.motifs, id) || !idValide(id);
  if (!pris(propre)) return propre;
  for (let i = 2; ; i++) if (!pris(`${propre}-${i}`)) return `${propre}-${i}`;
}

function avecMotif(m: Morceau, id: string, motif: Morceau['motifs'][string]): Morceau {
  const motifs = Object.create(null) as Morceau['motifs'];
  for (const [k, v] of Object.entries(m.motifs)) motifs[k] = v;
  motifs[id] = motif;
  return { ...m, motifs };
}

/** Frappes du beatbox posées dans le motif de batterie : seuls les pads joués sont réécrits. */
function poserFrappes(m: Morceau, n: NotesChantees): Morceau {
  const s = sectionDe(m, n.section);
  if (!s || n.notes.length === 0) return m;
  const idExistant = idMotifDe(s, ID_BATTERIE);
  const existant = motifParId(m, idExistant);
  const ancien = existant?.type === 'batterie' ? existant : null;
  const pas = ancien?.pas ?? n.pas;
  const parNote = new Map(Object.entries(NOTES_BATTERIE).map(([i, midi]) => [midi, i as InstrumentBatterie]));
  const pistes: MotifBatterie['pistes'] = { ...(ancien?.pistes ?? {}) };
  const roulements: NonNullable<MotifBatterie['roulements']> = { ...(ancien?.roulements ?? {}) };
  const rejoues = new Set<InstrumentBatterie>();
  for (const note of n.notes) {
    const inst = parNote.get(note.midi);
    if (!inst) continue;
    if (!rejoues.has(inst)) {
      rejoues.add(inst);
      pistes[inst] = new Array<number>(pas).fill(0);
      delete roulements[inst];
    }
    const i = ((Math.round(note.pas) % pas) + pas) % pas;
    pistes[inst]![i] = Math.max(pistes[inst]![i]!, Math.round(borner(note.vel, 0.1, 1) * 100) / 100);
  }
  if (rejoues.size === 0) return m;
  const motif: MotifBatterie = {
    type: 'batterie',
    pas,
    pistes,
    ...(Object.keys(roulements).length ? { roulements } : {}),
  };
  const id = ancien && idExistant ? idExistant : idLibre(m, `batterie-${n.section}`);
  return avecMotifSection(avecMotif(m, id, motif), n.section, ID_BATTERIE, id);
}

/** Pose les notes dans le motif de la piste pour la section (motif créé ou remplacé). Pure, un seul Annuler. */
export function poserNotesChantees(m: Morceau, n: NotesChantees): Morceau {
  if (n.piste === ID_BATTERIE) return poserFrappes(m, n);
  const s = sectionDe(m, n.section);
  if (!s || !estPisteInstrument(pisteDe(m, n.piste)) || n.notes.length === 0) return m;
  const pas = Math.min(128, Math.max(16, Math.round(n.pas / 16) * 16));
  const notes = rangerNotes(n.notes, pas);
  const idExistant = idMotifDe(s, n.piste);
  const existant = motifParId(m, idExistant);
  const id = existant?.type === 'notes' && idExistant ? idExistant : idLibre(m, `${n.piste}-${n.section}`);
  return avecMotifSection(avecMotif(m, id, { type: 'notes', pas, notes }), n.section, n.piste, id);
}
