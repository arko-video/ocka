// Outils communs des notes SANS durée (sons v1 et synthés de C3) : crête, sonie courte, fondu de fin, boucle sans
// clic. Sortis de instruments/notes.ts au contrat C3 (même code, mêmes échantillons : empreintes testées). Pur JS,
// à appeler dans avecFrequence (Worker de synthèse ou fil principal). Aucun import du registre : pas de boucle.

import { frequenceMidi } from '../../morceau/theorie';
import { filtreK } from '../sonie';
import type { NoteSynthe } from '../api-synthes';
import { epiano } from '../instruments/melodiques';
import { FREQ } from './briques';

/** Crête d'une note d'accord (phase 1) : 0,22. Les sons de la mélodie sont réglés à la même sonie. */
export const CRETE_ACCORD = 0.22;
/** Crête maximale d'une note de mélodie après le réglage de sonie. */
export const CRETE_MAX = 0.6;

export function crete(canaux: Float32Array[]): number {
  let max = 0;
  for (const c of canaux) for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]!));
  return max;
}

export function multiplier(canaux: Float32Array[], k: number) {
  for (const c of canaux) for (let i = 0; i < c.length; i++) c[i] *= k;
}

/** Sonie courte : RMS du son filtré K (BS.1770) sur ses 500 premières ms (l'attaque et le corps de la note). */
export function sonieCourte(c: Float32Array): number {
  const n = Math.min(c.length, Math.round(0.5 * FREQ));
  const [a, b] = filtreK(FREQ);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, e = 0; // prettier-ignore
  for (let i = 0; i < n; i++) {
    const x = c[i]!;
    const y = a.b0 * x + a.b1 * x1 + a.b2 * x2 - a.a1 * y1 - a.a2 * y2;
    x2 = x1; x1 = x; // prettier-ignore
    const z = b.b0 * y + b.b1 * y1 + b.b2 * y2 - b.a1 * z1 - b.a2 * z2;
    y2 = y1; y1 = y; // prettier-ignore
    z2 = z1; z1 = z; // prettier-ignore
    e += z * z;
  }
  return Math.sqrt(e / Math.max(1, n));
}

/** Sonie de référence (par fréquence) : le piano électrique, do central, à la crête des accords. */
const references = new Map<number, number>();
export function sonieReference(): number {
  let r = references.get(FREQ);
  if (r === undefined) {
    const ep = epiano(frequenceMidi(60), 0.6, false);
    multiplier([ep], CRETE_ACCORD / crete([ep]));
    r = sonieCourte(ep);
    references.set(FREQ, r);
  }
  return r;
}

/** Règle la sonie courte d'une note sur celle du piano électrique (± `ajustementDb`), crête bornée à CRETE_MAX. */
export function aLaSonie(canaux: Float32Array[], ajustementDb = 0) {
  const s = sonieCourte(canaux[0]!);
  if (s > 0) multiplier(canaux, (sonieReference() * Math.pow(10, ajustementDb / 20)) / s);
  const c = crete(canaux);
  if (c > CRETE_MAX) multiplier(canaux, CRETE_MAX / c);
}

/** Fondu linéaire vers 0 sur les `duree` dernières secondes (une note très longue s'éteint sans clic). */
export function fonduFin(canaux: Float32Array[], duree: number) {
  for (const c of canaux) {
    const n = Math.min(c.length, Math.round(duree * FREQ));
    for (let k = 0; k < n; k++) c[c.length - n + k] *= 1 - (k + 1) / n;
  }
}

/**
 * Boucle sans clic : la fin de la boucle [debut, fin[ est fondue (sur `fondu` s) avec ce qui précède son début,
 * donc le dernier échantillon enchaîne exactement sur le premier. Le tampon s'arrête à la fin de la boucle.
 */
export function preparerBoucle(canaux: Float32Array[], debut: number, fin: number, fondu: number): NoteSynthe {
  const S = Math.round(debut * FREQ);
  const E = Math.min(Math.round(fin * FREQ), canaux[0]!.length);
  const F = Math.min(Math.round(fondu * FREQ), S, E - S - 1);
  const L = E - S;
  const sortie = canaux.map((c) => {
    const s = c.slice(0, E);
    for (let k = 0; k < F; k++) {
      const i = E - F + k;
      const w = (k + 1) / (F + 1);
      s[i] = c[i]! * (1 - w) + c[i - L]! * w;
    }
    return s;
  });
  return { canaux: sortie, boucle: [S / FREQ, E / FREQ] };
}
