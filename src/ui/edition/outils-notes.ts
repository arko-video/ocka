// Piano roll « malin » (P) : arpège, strum, humaniser, glide, swing par piste, riff machine, notes fantômes.
// Fonctions PURES et déterministes (graine), qui ÉCRIVENT des notes : un `modifier()` = un Annuler. Grille du 1/24,
// 1024 notes au plus, triées et dédoublonnées (notes-motif.ts : changerNotes, noteValide, ranger).
// Le riff machine est dans outils-notes-riff.ts.

import { estPisteInstrument, motifNotesDe, pisteDe, pistesInstrument } from '../../morceau/acces';
import { dureePas } from '../../morceau/temps';
import { BORNES_NOTE, type Morceau, type MotifNotes, type Note } from '../../morceau/types';
import type { ReglagesArpege, ReglagesHumaniser, ReglagesStrum } from './api-outils-notes';
import { borner, changerNotes, grille24, indicesValides, motifEdite, noteValide, UN_PAS } from './notes-motif';

export { riffMachine } from './outils-notes-riff';

type Indices = readonly number[] | null;

/* ------------------------------------------------------------ hasard fixé par une graine */

/** Générateur pseudo-aléatoire (mulberry32) : même graine → même suite, de 0 (compris) à 1 (exclu). */
export function hasardGraine(graine: number): () => number {
  let a = (Math.floor(Number.isFinite(graine) ? graine : 0) >>> 0) ^ 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nombre de 0 à 1 fixé par une graine et deux entiers (indépendant de l'ordre de calcul). */
export function hasardFixe(graine: number, a: number, b: number): number {
  let h = Math.imul((graine | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((a | 0) + 0x27d4eb2f, 0xc2b2ae35);
  h ^= Math.imul((b | 0) + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------ sélection et accords */

interface Selection {
  motif: MotifNotes;
  choisies: Note[];
  restent: Note[];
}

function selection(m: Morceau, piste: string, section: string, indices: Indices): Selection | null {
  const e = motifEdite(m, piste, section);
  if (!e || e.motif.notes.length === 0) return null;
  const sel = indices === null ? null : indicesValides(indices, e.motif.notes.length);
  if (sel && sel.size === 0) return null;
  const choisies = e.motif.notes.filter((_, i) => !sel || sel.has(i));
  const restent = sel ? e.motif.notes.filter((_, i) => !sel.has(i)) : [];
  return { motif: e.motif, choisies, restent };
}

/** Écart (pas) sous lequel des départs comptent pour un même accord (un accord déjà gratté reste un accord). */
const ECART_ACCORD = 0.5;

/** Groupes de notes qui commencent ensemble (à ECART_ACCORD près), dans l'ordre du temps. */
export function grouperAccords(notes: readonly Note[], ecart = ECART_ACCORD): Note[][] {
  const triees = [...notes].sort((a, b) => a.pas - b.pas || a.midi - b.midi);
  const groupes: Note[][] = [];
  for (const n of triees) {
    const g = groupes[groupes.length - 1];
    if (g && n.pas - g[0]!.pas < ecart) g.push(n);
    else groupes.push([n]);
  }
  return groupes;
}

/* ------------------------------------------------------------ arpège */

/** Ordre des hauteurs joué en boucle (« hasard » : tiré pas à pas, voir arpeger). */
export function ordreArpege(hauteurs: readonly number[], sens: ReglagesArpege['sens']): number[] {
  const haut = [...hauteurs].sort((a, b) => a - b);
  if (sens === 'bas') return haut.reverse();
  if (sens === 'haut-bas') return haut.length < 3 ? haut : [...haut, ...haut.slice(1, -1).reverse()];
  return haut;
}

/** Remplace chaque accord choisi par son arpège, de son départ à la fin de sa plus longue note (ou à l'accord suivant). */
export function arpeger(m: Morceau, piste: string, section: string, indices: Indices, r: ReglagesArpege): Morceau {
  const s = selection(m, piste, section, indices);
  if (!s || !r || !Number.isFinite(r.vitesse) || !Number.isFinite(r.tenue)) return m;
  const vitesse = borner(grille24(r.vitesse), 1 / 6, 16);
  const octaves = borner(Math.round(r.octaves), 1, 3);
  const tenue = borner(r.tenue, 0.1, 1);
  const hasard = hasardGraine(r.graine);
  const groupes = grouperAccords(s.choisies);
  const neuves: Note[] = [];
  groupes.forEach((g, k) => {
    const debut = g[0]!.pas;
    const suivant = groupes[k + 1]?.[0]?.pas ?? Infinity;
    const fin = Math.min(Math.max(...g.map((n) => n.pas + n.duree)), suivant, s.motif.pas);
    const base = [...new Set(g.map((n) => n.midi))];
    const pool: number[] = [];
    for (let o = 0; o < octaves; o++) for (const h of base) if (h + 12 * o <= BORNES_NOTE.midiMax) pool.push(h + 12 * o);
    const ordre = ordreArpege([...new Set(pool)], r.sens);
    const vel = Math.max(...g.map((n) => n.vel));
    let precedente = -1;
    for (let i = 0; ; i++) {
      const pas = grille24(debut + i * vitesse);
      if (pas >= fin - 1e-9) break;
      let midi: number;
      if (r.sens === 'hasard') {
        let j = Math.floor(hasard() * ordre.length);
        if (ordre.length > 1 && ordre[j] === precedente) j = (j + 1 + Math.floor(hasard() * (ordre.length - 1))) % ordre.length;
        midi = ordre[j]!;
      } else midi = ordre[i % ordre.length]!;
      precedente = midi;
      const duree = Math.max(UN_PAS, Math.min(grille24(vitesse * tenue), fin - pas));
      const n = noteValide({ pas, duree, midi, vel }, s.motif.pas);
      if (n) neuves.push(n);
    }
  });
  if (neuves.length === 0) return m;
  return changerNotes(m, piste, section, () => [...s.restent, ...neuves]);
}

/* ------------------------------------------------------------ strum */

/** Décale les notes de chaque accord (même départ) comme une guitare grattée ; la fin des notes ne bouge pas. */
export function gratter(m: Morceau, piste: string, section: string, indices: Indices, r: ReglagesStrum): Morceau {
  const s = selection(m, piste, section, indices);
  if (!s || !r || !Number.isFinite(r.etalement)) return m;
  const ms = borner(r.etalement, 0, 120);
  const ecart = grille24(ms / 1000 / dureePas(m.tempo));
  if (ecart <= 0) return m;
  const groupes = grouperAccords(s.choisies, UN_PAS / 2).filter((g) => g.length > 1);
  if (groupes.length === 0) return m;
  const dansGroupe = new Set(groupes.flat());
  const neuves = s.choisies.filter((n) => !dansGroupe.has(n));
  for (const g of groupes) {
    const ordre = r.sens === 'bas' ? [...g].sort((a, b) => b.midi - a.midi) : [...g].sort((a, b) => a.midi - b.midi);
    ordre.forEach((n, k) => {
      const pas = Math.min(grille24(n.pas + k * ecart), s.motif.pas - UN_PAS);
      const fin = n.pas + n.duree;
      const x = noteValide({ ...n, pas, duree: Math.max(UN_PAS, fin - pas) }, s.motif.pas);
      if (x) neuves.push(x);
    });
  }
  return changerNotes(m, piste, section, () => [...s.restent, ...neuves]);
}

/* ------------------------------------------------------------ humaniser */

/** Départs décalés (jusqu'à ±1/4 de pas) et vélocités variées (jusqu'à ±25 %), fixés par la graine et la note. */
export function humaniser(m: Morceau, piste: string, section: string, indices: Indices, r: ReglagesHumaniser): Morceau {
  const s = selection(m, piste, section, indices);
  if (!s || !r || !Number.isFinite(r.timing) || !Number.isFinite(r.velocite)) return m;
  const timing = borner(r.timing, 0, 1);
  const velocite = borner(r.velocite, 0, 1);
  if (timing === 0 && velocite === 0) return m;
  const neuves = s.choisies.map((n) => {
    const cle = Math.round(n.pas * 24);
    const dt = timing * 0.25 * (2 * hasardFixe(r.graine, cle, n.midi) - 1);
    const dv = velocite * 0.25 * (2 * hasardFixe(r.graine ^ 0x5bd1e995, cle, n.midi) - 1);
    const pas = borner(grille24(n.pas + dt), 0, s.motif.pas - UN_PAS);
    const fin = Math.min(n.pas + n.duree, s.motif.pas);
    const vel = Math.round(borner(n.vel * (1 + dv), BORNES_NOTE.velMin, BORNES_NOTE.velMax) * 1000) / 1000;
    return noteValide({ ...n, pas, duree: Math.max(UN_PAS, fin - pas), vel }, s.motif.pas) ?? n;
  });
  return changerNotes(m, piste, section, () => [...s.restent, ...neuves]);
}

/* ------------------------------------------------------------ glide, swing de la piste */

/** Glide : les notes choisies glissent (ou plus) vers la note suivante de la piste. */
export function reglerGlisse(m: Morceau, piste: string, section: string, indices: readonly number[], glisse: boolean): Morceau {
  const e = motifEdite(m, piste, section);
  if (!e || !Array.isArray(indices)) return m;
  const sel = indicesValides(indices, e.motif.notes.length);
  if (sel.size === 0) return m;
  return changerNotes(m, piste, section, (motif) =>
    motif.notes.map((n, i) => {
      if (!sel.has(i) || !!n.glisse === glisse) return n;
      const { glisse: _g, ...reste } = n;
      return glisse ? { ...reste, glisse: true } : reste;
    }),
  );
}

/** Swing propre à la piste (0 à 0,6, au centième) ; null = celui du morceau. */
export function reglerSwingPiste(m: Morceau, piste: string, swing: number | null): Morceau {
  const p = pisteDe(m, piste);
  if (!estPisteInstrument(p)) return m;
  if (swing !== null && !Number.isFinite(swing)) return m;
  const v = swing === null ? undefined : Math.round(borner(swing, 0, 0.6) * 100) / 100;
  if (p.swing === v) return m;
  const { swing: _s, ...reste } = p;
  const neuve = v === undefined ? reste : { ...reste, swing: v };
  return { ...m, pistes: m.pistes.map((x) => (x === p ? neuve : x)) };
}

/* ------------------------------------------------------------ notes fantômes */

/** Les notes des AUTRES pistes instrument dans cette section (affichage en gris). Pur. */
export function notesFantomes(m: Morceau, piste: string, section: string): { piste: string; pas: number; notes: Note[] }[] {
  return pistesInstrument(m)
    .filter((p) => p.id !== piste)
    .flatMap((p) => {
      const motif = motifNotesDe(m, section, p.id);
      return motif && motif.notes.length > 0 ? [{ piste: p.id, pas: motif.pas, notes: motif.notes }] : [];
    });
}
