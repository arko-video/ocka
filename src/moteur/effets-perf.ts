// Le REGISTRE des effets de performance (R), chargé DANS le Worker de synthèse (synthese/travaux.ts, travail
// « perf ») : aucun Web Audio, aucun import du graphe ici (fonctions pures sur des Float32Array).
// Chaque effet rend des canaux de MÊME longueur. Les bords sont fondus EN CROISÉ avec le passage d'origine (4 ms) :
// au début et à la fin, le son rejoint exactement celui de la piste, qui reprend juste après (aucun clic).

import type { EffetPerf, TypePerf } from '../morceau/types';

/**
 * Un effet : PUR et déterministe. `canaux` (stéréo) = le passage rendu, à `frequence` ; renvoie des canaux de MÊME
 * longueur (le passage garde sa place), qui commencent et finissent sans clic. `secondesParPas` : au tempo du morceau.
 */
export type FonctionPerf = (
  canaux: Float32Array[],
  frequence: number,
  effet: EffetPerf,
  secondesParPas: number,
) => Float32Array[];

/** Fondu croisé avec l'original aux deux bords (s). */
const BORD = 0.004;
/** Petit fondu de chaque tranche (stutter) ou de chaque ouverture (gate), en s. */
const RAMPE = 0.0015;

/** Lit `x` au temps fractionnaire `p` (échantillons), interpolation linéaire ; 0 hors du tampon. */
function lireA(x: Float32Array, p: number): number {
  const i = Math.floor(p);
  if (i < 0 || i >= x.length) return 0;
  const f = p - i;
  const a = x[i]!;
  const b = i + 1 < x.length ? x[i + 1]! : 0;
  return a + (b - a) * f;
}

/** Fondu croisé original → effet au début, effet → original à la fin. */
function bords(original: Float32Array, y: Float32Array, frequence: number): Float32Array {
  const n = y.length;
  const b = Math.min(Math.round(BORD * frequence), Math.floor(n / 2));
  for (let i = 0; i < b; i++) {
    const w = (i + 0.5) / b;
    y[i] = original[i]! * (1 - w) + y[i]! * w;
    const j = n - 1 - i;
    y[j] = original[j]! * (1 - w) + y[j]! * w;
  }
  return y;
}

/** Applique `fn` à chaque canal (même longueur), puis les bords. */
function parCanal(
  canaux: Float32Array[],
  frequence: number,
  fn: (x: Float32Array) => Float32Array,
): Float32Array[] {
  return canaux.map((x) => bords(x, fn(x), frequence));
}

/** Longueur d'une répétition (échantillons) : `division` par temps (4 pas), 1/16 par défaut. */
function periode(effet: EffetPerf, frequence: number, secondesParPas: number): number {
  const division = effet.division ?? 4;
  return Math.max(8, Math.round(((4 * secondesParPas) / division) * frequence));
}

/** Gain d'une fenêtre de `n` échantillons avec des rampes de `r` échantillons aux deux bouts. */
function rampe(i: number, n: number, r: number): number {
  if (r <= 0) return 1;
  if (i < r) return (i + 0.5) / r;
  if (i >= n - r) return (n - i - 0.5) / r;
  return 1;
}

/** Stutter : la 1re tranche (1/8, 1/16, 1/32… selon `division`) répétée en rafale sur tout le passage. */
const stutter: FonctionPerf = (canaux, frequence, effet, spp) => {
  const p = periode(effet, frequence, spp);
  const r = Math.min(Math.round(RAMPE * frequence), Math.floor(p / 4));
  return parCanal(canaux, frequence, (x) => {
    const y = new Float32Array(x.length);
    for (let i = 0; i < y.length; i++) {
      const k = i % p;
      // La 1re tranche commence telle quelle (elle continue le son d'avant) ; chaque répétition a ses rampes.
      const g = i < p && k < r ? 1 : rampe(k, p, r);
      y[i] = g * x[k]!;
    }
    return y;
  });
};

/** Demi-tempo : le passage joue deux fois moins vite (une octave plus bas), comme une bande ralentie. */
const demiTempo: FonctionPerf = (canaux, frequence) =>
  parCanal(canaux, frequence, (x) => {
    const y = new Float32Array(x.length);
    for (let i = 0; i < y.length; i++) y[i] = lireA(x, i / 2);
    return y;
  });

/** Tape stop : la vitesse descend de 1 à 0 sur le passage (la hauteur tombe), puis silence. */
const tapeStop: FonctionPerf = (canaux, frequence) =>
  parCanal(canaux, frequence, (x) => {
    const n = x.length;
    const y = new Float32Array(n);
    const fin = Math.max(1, Math.round(0.08 * n)); // les derniers 8 % s'éteignent (vitesse presque nulle)
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const position = n * (u - (u * u) / 2); // ∫ (1 − u) du : vitesse linéaire de 1 à 0
      const g = i >= n - fin ? (n - i) / fin : 1;
      y[i] = g * lireA(x, position);
    }
    return y;
  });

/** Gate : coupures rythmiques (`division` par temps), ouvert la 1re moitié de chaque période. */
const gate: FonctionPerf = (canaux, frequence, effet, spp) => {
  const p = periode(effet, frequence, spp);
  const ouvert = Math.max(2, Math.floor(p / 2));
  const r = Math.min(Math.round(RAMPE * frequence), Math.floor(ouvert / 4));
  return parCanal(canaux, frequence, (x) => {
    const y = new Float32Array(x.length);
    for (let i = 0; i < y.length; i++) {
      const k = i % p;
      y[i] = k < ouvert ? x[i]! * (i < ouvert && k < r ? 1 : rampe(k, ouvert, r)) : 0;
    }
    return y;
  });
};

/** Reverse : le passage à l'envers. */
const reverse: FonctionPerf = (canaux, frequence) =>
  parCanal(canaux, frequence, (x) => {
    const y = new Float32Array(x.length);
    for (let i = 0, n = x.length; i < n; i++) y[i] = x[n - 1 - i]!;
    return y;
  });

/** Le REGISTRE des effets (un par TypePerf). */
export const EFFETS_PERF: Record<TypePerf, FonctionPerf> = {
  stutter,
  'demi-tempo': demiTempo,
  'tape-stop': tapeStop,
  gate,
  reverse,
};

/** Appliqué dans le Worker de synthèse (synthese/travaux.ts, travail « perf »). */
export function appliquerEffetPerf(
  canaux: Float32Array[],
  frequence: number,
  effet: EffetPerf,
  secondesParPas: number,
): Float32Array[] {
  if (canaux.length === 0 || canaux[0]!.length === 0) return canaux.map((c) => new Float32Array(c.length));
  return EFFETS_PERF[effet.type](canaux, frequence, effet, secondesParPas);
}
