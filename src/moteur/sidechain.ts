// Sidechain « pompe » (propriétaire : M2, vague C1). Règle (décisions v2 §3) : une automation de GAIN calculée
// d'après les frappes de kick du planning (planning.ts) : aucun CPU en plus, identique à l'écoute et à l'export.
// Gain séparé du fader et de l'automation (tranche de la piste, effets/tranche.ts).
// Forme, pour chaque kick à tk : le gain descend en ATTAQUE_S (de sa valeur du moment) jusqu'à 1 − force, puis
// remonte jusqu'à 1 en `relache` secondes, en courbe douce (1 − force × (1 − x)², 8 segments). Un kick qui
// arrive pendant la remontée repart de la valeur du moment. Deux kicks à moins de ATTAQUE_S : un seul.

import { pisteDe } from '../morceau/acces';
import type { Morceau, Sidechain } from '../morceau/types';
import { sourcePoints, type Point, type SourceAuto } from './effets/programme';
import { calculerPlanning } from './planning';

/** Un point de la courbe de gain du sidechain : temps du morceau (s), gain 0 à 1 (1 = rien). */
export interface PointSidechain {
  t: number;
  gain: number;
}

/** Durée de la descente sur chaque kick (s) : assez courte pour la pompe, assez longue pour ne pas cliquer. */
export const ATTAQUE_S = 0.002;
const SEGMENTS = 8;

const kicksParMorceau = new WeakMap<Morceau, number[]>();

/** Temps (s) des frappes de kick du morceau (planning de M1), triés, sans doublons à moins de ATTAQUE_S. */
export function tempsKicks(m: Morceau): number[] {
  let k = kicksParMorceau.get(m);
  if (!k) {
    k = [];
    for (const ev of calculerPlanning(m)) {
      if (ev.type !== 'frappe' || ev.instrument !== 'kick') continue;
      if (k.length === 0 || ev.t - k[k.length - 1]! >= ATTAQUE_S) k.push(ev.t);
    }
    kicksParMorceau.set(m, k);
  }
  return k;
}

/** Valeur de la remontée d'un kick (temps `x` depuis la fin de sa descente), telle que programmée (segments). */
function remontee(s: Sidechain, x: number): number {
  if (x <= 0) return 1 - s.force;
  const u = (x / s.relache) * SEGMENTS;
  if (u >= SEGMENTS) return 1;
  const i = Math.floor(u);
  const v = (j: number) => 1 - s.force * (1 - j / SEGMENTS) ** 2;
  return v(i) + (v(i + 1) - v(i)) * (u - i);
}

/** Tous les points de la courbe de gain (temps du morceau), pour un réglage et une liste de kicks. */
export function pointsSidechain(s: Sidechain, kicks: readonly number[]): Point[] {
  const out: Point[] = [];
  const bas = 1 - s.force;
  for (let k = 0; k < kicks.length; k++) {
    const tk = kicks[k]!;
    const suivant = kicks[k + 1] ?? Infinity;
    const avant = k === 0 ? 1 : remontee(s, tk - kicks[k - 1]! - ATTAQUE_S);
    out.push({ t: tk, v: avant });
    // Descente : coupée par le kick suivant s'il arrive avant sa fin.
    if (tk + ATTAQUE_S >= suivant) continue;
    out.push({ t: tk + ATTAQUE_S, v: bas });
    for (let i = 1; i <= SEGMENTS; i++) {
      const t = tk + ATTAQUE_S + (s.relache * i) / SEGMENTS;
      if (t >= suivant) break;
      out.push({ t, v: 1 - s.force * (1 - i / SEGMENTS) ** 2 });
    }
  }
  return out;
}

const sources = new WeakMap<Morceau, Map<string, SourceAuto | null>>();

/** La source de programmation du gain de sidechain d'une piste (null : pas de sidechain). Gardée par morceau. */
export function sourceSidechain(m: Morceau, idPiste: string): SourceAuto | null {
  let parPiste = sources.get(m);
  if (!parPiste) sources.set(m, (parPiste = new Map()));
  if (parPiste.has(idPiste)) return parPiste.get(idPiste)!;
  const s = pisteDe(m, idPiste)?.sidechain;
  const source = s && s.force > 0 ? sourcePoints(pointsSidechain(s, tempsKicks(m)), 1) : null;
  parPiste.set(idPiste, source);
  return source;
}

/**
 * Courbe de gain du sidechain d'une piste entre `de` et `a` (s du morceau), d'après les frappes de kick du planning
 * (force et relâchement de Tranche.sidechain) : la valeur en `de`, chaque point de la courbe, la valeur en `a`.
 * [] si la piste n'a pas de sidechain. Pure.
 */
export function gainsSidechain(m: Morceau, idPiste: string, de: number, a: number): PointSidechain[] {
  const source = sourceSidechain(m, idPiste);
  if (!source || !(a >= de)) return [];
  const out: PointSidechain[] = [{ t: de, gain: source.valeur(de) }];
  for (const p of source.points(de, a)) {
    if (p.avant !== undefined) out.push({ t: p.t, gain: p.avant });
    out.push({ t: p.t, gain: p.v });
  }
  if (out[out.length - 1]!.t < a) out.push({ t: a, gain: source.valeur(a) });
  return out;
}
