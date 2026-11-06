// Boucles OCKA : des motifs de mélodie prêts (arpège, contre-chant, mélodie de refrain, nappe, motif de cloche,
// accords pincés), fabriqués par des RÈGLES à partir des accords de la section et de la gamme du morceau.
// Toutes les notes sont dans la gamme : jamais de fausse note. Aucune IA, aucun réseau.
// Même morceau + même graine → mêmes boucles (la graine 0 donne la bibliothèque ; les autres servent au hasard).

import { demiTonsDegre, hauteurTonique, notesAccord } from '../morceau/theorie';
import { motifAccordsDe } from '../morceau/acces';
import type { Morceau, MotifAccords, MotifNotes, Note, SonMelodie, Style } from '../morceau/types';
import { hasardGraine } from '../morceau/varier';
import { definitionStyle } from '../morceau/styles/index';

export const TYPES_BOUCLES = ['cloche', 'arpege', 'contrechant', 'refrain', 'nappe', 'pince'] as const;
export type TypeBoucle = (typeof TYPES_BOUCLES)[number];

export interface Boucle {
  type: TypeBoucle;
  motif: MotifNotes;
  /** Son conseillé (instrument « ocka-<son>@1 » de la piste mélodie). */
  son: SonMelodie;
}

/** Ordre et sons des boucles d'un style (la 1re est la plus typique) : dans le fichier du style (registre). */
const parStyle = (style: string): [TypeBoucle, SonMelodie][] => definitionStyle(style).boucles;

/** Ce qu'il faut savoir pour écrire une boucle : la gamme, les accords mesure par mesure, la longueur. */
interface Contexte {
  /** Classes de hauteur de la gamme (0 à 11). */
  gamme: Set<number>;
  /** Classes de hauteur de chaque accord (une par mesure), réduites aux notes de la gamme ; la 1re = fondamentale. */
  accords: number[][];
  /** Longueur du motif en pas (16 à 64). */
  pas: number;
  h: () => number;
}

const pc = (midi: number) => ((midi % 12) + 12) % 12;

/** Toutes les notes MIDI de la gamme entre `bas` et `haut`. */
function echelle(c: Contexte, bas: number, haut: number): number[] {
  const l: number[] = [];
  for (let x = bas; x <= haut; x++) if (c.gamme.has(pc(x))) l.push(x);
  return l;
}

/** La note de la gamme la plus proche de `cible` dont la classe est dans `classes` (sinon dans la gamme). */
function proche(c: Contexte, classes: number[], cible: number): number {
  let meilleure = -1;
  for (let x = cible - 12; x <= cible + 12; x++) {
    if (!c.gamme.has(pc(x)) || !classes.includes(pc(x))) continue;
    if (meilleure < 0 || Math.abs(x - cible) < Math.abs(meilleure - cible)) meilleure = x;
  }
  return meilleure >= 0 ? meilleure : proche(c, [...c.gamme], cible);
}

/** Monte (ou descend) de `pas` notes dans la gamme depuis `midi` (qui doit être dans la gamme). */
function marche(c: Contexte, midi: number, pas: number): number {
  const e = echelle(c, midi - 30, midi + 30);
  const i = e.indexOf(midi);
  return e[Math.min(e.length - 1, Math.max(0, i + pas))] ?? midi;
}

/** Notes de l'accord d'une mesure, empilées à partir de la fondamentale la plus proche de `base`. */
function empiler(c: Contexte, mesure: number, base: number, nombre: number): number[] {
  const cl = c.accords[mesure % c.accords.length]!;
  const r = proche(c, [cl[0]!], base);
  const notes = echelle(c, r, r + 30).filter((x) => cl.includes(pc(x)));
  return notes.slice(0, nombre);
}

const note = (pas: number, duree: number, midi: number, vel = 1): Note => ({ pas, duree, midi, vel });

/** Motif de cloche (phonk) : la cloche 808 qui joue un riff syncopé de double-croches, dans l'aigu. */
function cloche(c: Contexte): Note[] {
  const riffs = [
    { pas: [0, 3, 6, 8, 11, 14], sauts: [0, 0, 7, 4, 2, 0], vel: [1, 0.7, 0.9, 0.8, 0.7, 0.85] },
    { pas: [0, 3, 6, 10, 12, 14], sauts: [0, 0, 2, 4, 2, 7], vel: [1, 0.75, 0.8, 0.9, 0.7, 0.8] },
  ];
  const riff = riffs[Math.floor(c.h() * riffs.length)]!;
  const notes: Note[] = [];
  for (let m = 0; m * 16 < c.pas; m++) {
    const r = proche(c, [c.accords[m % c.accords.length]![0]!], 70);
    riff.pas.forEach((p, k) => notes.push(note(m * 16 + p, 2, marche(c, r, riff.sauts[k]!), riff.vel[k])));
  }
  return notes;
}

/** Arpège : les notes de l'accord en croches, qui montent puis redescendent. */
function arpege(c: Contexte): Note[] {
  const formes = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 0, 2, 1, 3], [0, 1, 2, 3, 4, 3, 2, 1]];
  const forme = formes[Math.floor(c.h() * formes.length)]!;
  const notes: Note[] = [];
  for (let m = 0; m * 16 < c.pas; m++) {
    const acc = empiler(c, m, 64, 5);
    forme.forEach((k, i) => notes.push(note(m * 16 + i * 2, 2, acc[k % acc.length]!, i % 2 === 0 ? 0.9 : 0.7)));
  }
  return notes;
}

/** Contre-chant : deux notes longues par mesure, dans l'aigu, qui glissent d'une note de l'accord à la suivante. */
function contrechant(c: Contexte): Note[] {
  const notes: Note[] = [];
  let voix = proche(c, c.accords[0]!.slice(1), 74 + Math.floor(c.h() * 4));
  for (let m = 0; m * 16 < c.pas; m++) {
    const cl = c.accords[m % c.accords.length]!;
    voix = proche(c, cl.length > 1 ? cl.slice(1) : cl, voix);
    notes.push(note(m * 16, 10, voix, 0.85));
    const vers = proche(c, c.accords[(m + 1) % c.accords.length]!, voix);
    notes.push(note(m * 16 + 10, 6, vers === voix ? marche(c, voix, -1) : marche(c, voix, vers > voix ? 1 : -1), 0.7));
  }
  return notes;
}

/** Mélodie de refrain : une cellule rythmique d'une mesure, répétée sur chaque accord, qui finit sur la tonique. */
function refrain(c: Contexte): Note[] {
  const cellules = [
    { pas: [0, 3, 6, 8, 12], duree: [3, 3, 2, 4, 4], pente: [0, 1, 2, 0, -1] },
    { pas: [0, 2, 4, 7, 10], duree: [2, 2, 3, 3, 6], pente: [0, -1, 0, 1, 0] },
    { pas: [2, 4, 6, 8, 11, 14], duree: [2, 2, 2, 3, 3, 2], pente: [0, 1, 0, -1, 0, 1] },
  ];
  const cel = cellules[Math.floor(c.h() * cellules.length)]!;
  const notes: Note[] = [];
  const mesures = Math.ceil(c.pas / 16);
  for (let m = 0; m < mesures; m++) {
    const cl = c.accords[m % c.accords.length]!;
    // Les temps forts sur une note de l'accord, les autres par pas de gamme autour.
    const appui = proche(c, cl, 69 + Math.floor(c.h() * 3));
    cel.pas.forEach((p, k) => {
      const derniere = m === mesures - 1 && k === cel.pas.length - 1;
      const midi = derniere ? proche(c, [[...c.gamme][0]!], appui) : marche(c, appui, cel.pente[k]!);
      notes.push(note(m * 16 + p, cel.duree[k]!, midi, k === 0 ? 1 : 0.8));
    });
  }
  return notes;
}

/** Nappe : une longue note par accord (la tierce ou la quinte), qui bouge le moins possible. */
function nappe(c: Contexte): Note[] {
  const notes: Note[] = [];
  let voix = 76;
  for (let m = 0; m * 16 < c.pas; m++) {
    const cl = c.accords[m % c.accords.length]!;
    voix = proche(c, cl.length > 1 ? cl.slice(1) : cl, voix);
    notes.push(note(m * 16, 16, voix, 0.8));
  }
  return notes;
}

/** Accords pincés : deux notes de l'accord sur les contretemps (« and »), courts. */
function pince(c: Contexte): Note[] {
  const placements = [[2, 6, 10, 14], [3, 6, 10, 13], [2, 7, 10]];
  const pl = placements[Math.floor(c.h() * placements.length)]!;
  const notes: Note[] = [];
  for (let m = 0; m * 16 < c.pas; m++) {
    const acc = empiler(c, m, 67, 4).slice(1, 3);
    for (const p of pl) for (const x of acc) notes.push(note(m * 16 + p, 1, x, 0.75));
  }
  return notes;
}

const ECRIRE: Record<TypeBoucle, (c: Contexte) => Note[]> = { cloche, arpege, contrechant, refrain, nappe, pince };

/** Le motif d'accords d'une section (sinon le premier du morceau). */
export function accordsDe(m: Morceau, idSection?: string): MotifAccords | null {
  const s = m.sections.find((x) => x.id === idSection) ?? m.sections[0];
  const a = s ? motifAccordsDe(m, s) : undefined;
  if (a) return a;
  return (Object.values(m.motifs).find((x) => x.type === 'accords') as MotifAccords | undefined) ?? null;
}

/** Contexte d'écriture : gamme, accords mesure par mesure (réduits à la gamme), longueur du motif. */
function contexte(m: Morceau, idSection: string | undefined, graine: number): Contexte {
  const { tonique, mode } = m.tonalite;
  const t = hauteurTonique(tonique);
  const gamme = new Set(Array.from({ length: 7 }, (_, d) => (t + demiTonsDegre(mode, d)) % 12));
  const acc = accordsDe(m, idSection);
  const section = m.sections.find((x) => x.id === idSection);
  const longueur = Math.max(16, Math.min(64, acc ? acc.pas : 64, section ? section.mesures * 16 : 64));
  const pas = Math.floor(longueur / 16) * 16;
  const accords: number[][] = [];
  for (let mesure = 0; mesure * 16 < pas; mesure++) {
    const i = acc ? (mesure * 16) % acc.pas : 0;
    const degre = acc?.accords.find((a) => i >= a.pas && i < a.pas + a.duree)?.degre ?? (mode === 'majeur' ? 'I' : 'i');
    let classes = notesAccord(tonique, mode, degre).map(pc).filter((x) => gamme.has(x));
    if (classes.length === 0) classes = [t, (t + demiTonsDegre(mode, 2)) % 12, (t + 7) % 12];
    accords.push([...new Set(classes)]);
  }
  // La gamme commence par la tonique (la mélodie de refrain finit dessus).
  return { gamme, accords, pas, h: hasardGraine(graine * 7919 + 17) };
}

/** Écrit une boucle d'un type (motif de notes). Notes triées, sans doublon, dans la gamme. */
export function ecrireBoucle(m: Morceau, type: TypeBoucle, idSection?: string, graine = 0): MotifNotes {
  const c = contexte(m, idSection, graine);
  const vues = new Set<string>();
  const notes = ECRIRE[type](c)
    .filter((x) => x.pas < c.pas && x.midi >= 24 && x.midi <= 108)
    .map((x) => ({ ...x, duree: Math.max(1, Math.min(x.duree, c.pas - x.pas)) }))
    .filter((x) => !vues.has(`${x.pas}|${x.midi}`) && vues.add(`${x.pas}|${x.midi}`))
    .sort((a, b) => a.pas - b.pas || a.midi - b.midi);
  return { type: 'notes', pas: c.pas, notes };
}

/** La bibliothèque « Boucles OCKA » d'une section : 6 boucles, dans l'ordre du style. */
export function boucles(m: Morceau, idSection?: string, graine = 0): Boucle[] {
  const liste = parStyle(m.style);
  return liste.map(([type, son]) => ({ type, motif: ecrireBoucle(m, type, idSection, graine), son }));
}

/** Le son conseillé d'un type de boucle dans un style. */
export function sonConseille(style: Style, type: TypeBoucle): SonMelodie {
  return parStyle(style).find(([t]) => t === type)?.[1] ?? 'piano';
}
