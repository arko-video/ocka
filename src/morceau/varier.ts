// Le bouton « Varier » : fabrique une variante d'un motif, toujours la même pour une graine donnée.
// On garde l'ossature (kick sur le 1er pas, caisse claire à sa place) et on change les détails :
// kicks fantômes, notes fantômes de caisse claire, roulements et accents du charley, charley ouvert.

import type { Motif, MotifBasse, MotifBatterie } from './types';

/** Petit générateur pseudo-aléatoire (mulberry32) : même graine → même suite de nombres entre 0 et 1. */
export function hasardGraine(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROULEMENTS = [2, 3, 4, 6];

function varierBatterie(m: MotifBatterie, h: () => number): MotifBatterie {
  const copie: MotifBatterie = structuredClone(m);
  const p = copie.pistes;
  const caisse = (i: number) => (p.snare?.[i] ?? 0) > 0.6 || (p.clap?.[i] ?? 0) > 0.6;
  // Kick : on ajoute ou retire 1 ou 2 kicks fantômes (jamais le 1er pas, jamais sur la caisse claire).
  if (p.kick) {
    const k = p.kick;
    for (let essai = 0; essai < 2; essai++) {
      const i = 1 + Math.floor(h() * (copie.pas - 1));
      if (caisse(i) || i % 16 === 0) continue;
      k[i] = k[i]! > 0 ? 0 : h() < 0.5 ? 0.75 : 0.5;
    }
  }
  // Caisse claire : une note fantôme (douce) juste avant ou après un temps fort.
  if (p.snare && h() < 0.7) {
    const i = Math.floor(h() * copie.pas);
    if (!caisse(i) && (p.snare[i] ?? 0) === 0) p.snare[i] = 0.35;
  }
  // Charley : nouveaux roulements (si le motif en a déjà) ou nouveaux accents.
  if (p.charley) {
    const c = p.charley;
    const r = copie.roulements?.charley;
    for (let i = 0; i < c.length; i++) {
      if (c[i] === 0) continue;
      if (r) {
        if (r[i]! > 0 && h() < 0.4) r[i] = 0;
        else if (h() < 0.12) r[i] = ROULEMENTS[Math.floor(h() * ROULEMENTS.length)]!;
      } else if (h() < 0.25) {
        c[i] = c[i]! >= 0.75 ? 0.5 : 0.75;
      }
    }
  }
  // Charley ouvert : déplacé sur un autre contretemps.
  if (p.charleyOuvert && p.charleyOuvert.some((v) => v > 0) && h() < 0.5) {
    const o = p.charleyOuvert;
    const vel = Math.max(...o);
    o.fill(0);
    o[2 + 4 * Math.floor(h() * (copie.pas / 4))] = vel;
  }
  return copie;
}

function varierBasse(m: MotifBasse, h: () => number): MotifBasse {
  const copie: MotifBasse = structuredClone(m);
  for (const n of copie.notes) {
    // Une note sur quatre change d'octave (jamais la toute première).
    if (n.pas > 0 && h() < 0.25) n.octave = (n.octave ?? 0) === 0 ? 1 : 0;
  }
  return copie;
}

/** Variante d'un motif (batterie ou basse ; les accords sont recopiés tels quels). */
export function varier<M extends Motif>(motif: M, graine: number): M {
  const h = hasardGraine(graine * 2654435761 + 12345);
  if (motif.type === 'batterie') return varierBatterie(motif, h) as M;
  if (motif.type === 'basse') return varierBasse(motif, h) as M;
  return structuredClone(motif);
}
