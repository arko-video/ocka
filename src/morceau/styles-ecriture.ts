// Outils communs d'écriture des styles (vague C2, écrits pour les 20 styles de S2) : les notes de départ des pistes
// instrument (accords plaqués, lignes de basse, percussions enregistrées, swing ternaire, boucles déplacées dans la
// tessiture d'un instrument). Voisins : styles-grilles.ts (batterie, 808), styles-motifs.ts.
// Tout part des accords de la section et de la tonalité du morceau. Fonctions PURES et déterministes.
// Les timbres qui manquent à la banque sont « fabriqués » ici par empilement de pistes (supersaw = 2 leads OCKA
// écartés + la nappe des accords ; cuivres en section = une piste par voix ; chœurs = nappe OCKA en voix serrées).

import { accordsDe, ecrireBoucle, type TypeBoucle } from '../aller-vite/boucles';
import { frappes } from './styles-grilles';
import { notesAccord, voicingProche } from './theorie';
import type { Morceau, MotifNotes, Note } from './types';
import type { EcrireNotes } from './styles/definition';

/** Une frappe d'accord ou de percussion : pas (fractionnaire permis, au 1/24), durée en pas, vélocité. */
export type Frappe = [pas: number, duree: number, vel: number];

const q24 = (x: number) => Math.round(x * 24) / 24;
const pc = (x: number) => ((x % 12) + 12) % 12;

/** Motif propre : pas et durées au 1/24, dans le motif, vélocités 0,1 à 1, notes 12 à 120, triées, sans doublon. */
export function motif(pas: number, notes: Note[]): MotifNotes {
  const vues = new Set<string>();
  const propres: Note[] = [];
  for (const n of notes) {
    const p = q24(n.pas);
    if (p < 0 || p >= pas || n.midi < 12 || n.midi > 120) continue;
    const cle = `${p}|${n.midi}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    // Durée comme le normaliseur (borner, arrondir au 1/24, borner) : sinon il la réécrit à la fin du motif.
    const fin = pas - p;
    const x: Note = { pas: p, duree: Math.max(1 / 24, Math.min(q24(Math.min(n.duree, fin)), fin)), midi: n.midi, vel: Math.min(1, Math.max(0.1, Math.round(n.vel * 1000) / 1000)) };
    if (n.glisse) x.glisse = true;
    propres.push(x);
  }
  propres.sort((a, b) => a.pas - b.pas || a.midi - b.midi);
  return { type: 'notes', pas, notes: propres.slice(0, 1024) };
}

/** Les accords de la section, mesure par mesure (notes MIDI en position fondamentale autour de do 4). */
export function accordsMesures(m: Morceau, idSection: string, mesures: number): number[][] {
  const acc = accordsDe(m, idSection);
  const { tonique, mode } = m.tonalite;
  const repli = notesAccord(tonique, mode, mode === 'majeur' ? 'I' : 'i');
  const out: number[][] = [];
  for (let k = 0; k < mesures; k++) {
    const i = acc ? (k * 16) % acc.pas : 0;
    const degre = acc?.accords.find((a) => i >= a.pas && i < a.pas + a.duree)?.degre;
    const notes = degre ? notesAccord(tonique, mode, degre) : [];
    out.push(notes.length > 0 ? notes : repli);
  }
  return out;
}

/** Nombre de mesures du cycle d'accords de la section (1 à 8 ; 4 sans accords). */
export function mesuresAccords(m: Morceau, idSection: string): number {
  const acc = accordsDe(m, idSection);
  return acc ? Math.max(1, Math.min(8, Math.round(acc.pas / 16))) : 4;
}

/** La note de classe `classe` la plus basse à partir de `bas`. */
export function depuis(classe: number, bas: number): number {
  return bas + pc(classe - bas);
}

/** Formes d'accord : ce qu'on joue des notes de l'accord (fondamentale en tête). */
export const FORMES = {
  /** L'accord tel quel. */
  plein: (n: number[]) => n,
  /** Quinte à vide (power chord) : fondamentale, quinte, octave. */
  puissance: (n: number[]) => [n[0]!, n[0]! + 7, n[0]! + 12],
  /** Sans fondamentale, avec la neuvième (jazz, R&B) : tierce, quinte, septième (ou sixte), neuvième. */
  sansFondamentale: (n: number[]) => [n[1]!, n[2]!, n[3] ?? n[0]! + 9, n[0]! + 14],
  /** Avec la neuvième ajoutée. */
  neuvieme: (n: number[]) => [...n, n[0]! + 14],
} as const;

/** Voicings proches (chaque accord bouge le moins possible) dans [bas, haut]. */
export function voicings(accords: number[][], bas: number, haut: number, forme: (n: number[]) => number[] = FORMES.plein): number[][] {
  let avant: number[] | null = null;
  return accords.map((a) => {
    const notes = forme(a);
    // Quinte à vide : on garde l'empilement (fondamentale en bas), on cale seulement l'octave.
    const v = forme === FORMES.puissance ? notes.map((x) => x - a[0]! + depuis(a[0]!, bas)) : voicingProche(notes, avant, bas, haut);
    avant = v;
    return v;
  });
}

export interface OptionsPlaquer {
  /** Rythme de chaque mesure (la mesure k joue rythme[k % longueur]). */
  rythme: Frappe[][];
  bas: number;
  haut: number;
  forme?: (n: number[]) => number[];
  /** Ne jouer qu'une voix du voicing (0 = la plus grave) : instruments monophoniques empilés (section de cuivres). */
  voix?: number;
  /** Notes en plus, une octave au-dessus de la plus haute (supersaw, chœurs). */
  doublerHaut?: boolean;
  /** Décalage d'arpège entre les notes d'un accord (pas) : un grattage de guitare. */
  gratte?: number;
  /** Nombre de mesures du motif (défaut : le cycle d'accords). */
  mesures?: number;
}

/** Accords plaqués (piano, guitare, orgue, cuivres…) sur un rythme, calés sur les accords de la section. */
export function plaquer(o: OptionsPlaquer): EcrireNotes {
  return (m, id) => {
    const mesures = o.mesures ?? mesuresAccords(m, id);
    const vs = voicings(accordsMesures(m, id, mesures), o.bas, o.haut, o.forme);
    const notes: Note[] = [];
    vs.forEach((v0, k) => {
      let v = o.voix === undefined ? v0 : [v0[Math.min(o.voix, v0.length - 1)]!];
      if (o.doublerHaut) v = [...v, v0[v0.length - 1]! + 12];
      for (const [p, d, vel] of o.rythme[k % o.rythme.length]!) {
        v.forEach((midi, j) => notes.push({ pas: k * 16 + p + (o.gratte ?? 0) * j, duree: d, midi, vel: vel * (1 - 0.04 * j) }));
      }
    });
    return motif(mesures * 16, notes);
  };
}

/**
 * Note d'une ligne de basse : R fondamentale, T tierce, Q quinte, S septième (sinon sixte), O octave,
 * A approche chromatique (un demi-ton sous la fondamentale de l'accord suivant), ou des demi-tons.
 */
export type NoteLigne = [pas: number, duree: number, quoi: 'R' | 'T' | 'Q' | 'S' | 'O' | 'A' | number, vel: number, glisse?: boolean];

/** Ligne de basse (contrebasse, basse électrique, violoncelles), fondamentale à partir de `bas`. */
export function ligne(rythme: NoteLigne[][], bas: number, mesures?: number): EcrireNotes {
  return (m, id) => {
    const n = mesures ?? mesuresAccords(m, id);
    const accords = accordsMesures(m, id, n);
    const notes: Note[] = [];
    accords.forEach((a, k) => {
      const r = depuis(a[0]!, bas);
      const suivante = depuis(accords[(k + 1) % n]![0]!, bas);
      for (const [p, d, quoi, vel, glisse] of rythme[k % rythme.length]!) {
        let midi: number;
        if (typeof quoi === 'number') midi = r + quoi;
        else if (quoi === 'A') midi = suivante - 1 < r - 6 ? suivante + 11 : suivante - 1;
        else midi = r + { R: 0, T: a[1]! - a[0]!, Q: a[2]! - a[0]!, S: (a[3] ?? a[0]! + 9) - a[0]!, O: 12 }[quoi];
        notes.push({ pas: k * 16 + p, duree: d, midi, vel, ...(glisse ? { glisse: true } : {}) });
      }
    });
    return motif(n * 16, notes);
  };
}

/** Durée par défaut d'une frappe de percussion selon la note GM (cymbales et charley ouvert : plus longues). */
const DUREES_PERCU: Record<number, number> = { 46: 6, 49: 16, 51: 6, 53: 6, 74: 6, 81: 10 };

/** Percussions enregistrées : une grille (« X.x. », 16 pas par mesure) par note MIDI de l'instrument. */
export function percus(grilles: Record<number, string>, rouls: Record<number, string> = {}): EcrireNotes {
  return () => {
    const notes: Note[] = [];
    let pas = 16;
    for (const [cle, g] of Object.entries(grilles)) {
      const midi = Number(cle);
      const f = frappes(g);
      const r = [...(rouls[midi] ?? '').replace(/\s/g, '')].map((c) => (['2', '3', '4'].includes(c) ? Number(c) : 1));
      pas = Math.max(pas, Math.ceil(f.length / 16) * 16);
      f.forEach((vel, p) => {
        if (vel <= 0) return;
        const k = r[p] ?? 1;
        for (let j = 0; j < k; j++) notes.push({ pas: p + j / k, duree: k > 1 ? 1 / k : DUREES_PERCU[midi] ?? 3, midi, vel: vel * (j === 0 ? 1 : 0.8) });
      });
    }
    return motif(pas, notes);
  };
}

/** Frappes explicites (positions fractionnaires : swing ternaire du jazz) pour une note MIDI. */
export function frappesNote(midi: number, liste: Frappe[]): Note[] {
  return liste.map(([pas, duree, vel]) => ({ pas, duree, midi, vel }));
}

/** Swing ternaire des croches : la croche du « et » tombe aux 2/3 du temps (jazz, gospel, shuffle). */
export function ternaire(x: number): number {
  const temps = Math.floor(x / 4);
  const r = x - temps * 4;
  return temps * 4 + (r < 2 ? (r * 4) / 3 : 8 / 3 + ((r - 2) * 2) / 3);
}

/** Applique le swing ternaire à un motif (début et fin de chaque note). */
export function swinguer(e: EcrireNotes): EcrireNotes {
  return (m, id) => {
    const x = e(m, id);
    return motif(x.pas, x.notes.map((n) => ({ ...n, pas: ternaire(n.pas), duree: Math.max(0.25, ternaire(n.pas + n.duree) - ternaire(n.pas)) })));
  };
}

/** Une Boucle OCKA déplacée par octaves dans la tessiture [bas, haut] d'un instrument (vélocité × `vel`). */
export function boucleDans(type: TypeBoucle, bas: number, haut: number, vel = 1, graine = 0): EcrireNotes {
  return (m, id) => {
    const x = ecrireBoucle(m, type, id, graine);
    return motif(x.pas, x.notes.map((n) => {
      let midi = n.midi;
      while (midi < bas) midi += 12;
      while (midi > haut) midi -= 12;
      return { ...n, midi, vel: n.vel * vel };
    }));
  };
}

/** Combine plusieurs écritures (même longueur de motif : la plus longue ; les autres sont répétées). */
export function ensemble(...es: EcrireNotes[]): EcrireNotes {
  return (m, id) => {
    const ms = es.map((e) => e(m, id));
    const pas = Math.min(128, Math.max(...ms.map((x) => x.pas)));
    const notes: Note[] = [];
    for (const x of ms) for (let d = 0; d < pas; d += x.pas) for (const n of x.notes) notes.push({ ...n, pas: n.pas + d });
    return motif(pas, notes);
  };
}
