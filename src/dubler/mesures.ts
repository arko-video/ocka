// Mesures d'une attaque de beatbox (40 ms) : 12 bandes log, centroïde, ZCR, décroissance (15 valeurs de 0 à 1).
// Fichier pur, sans dépendance au contrat (les e2e l'importent dans Node pour fabriquer un entraînement).

import { Fft } from './fft';

export const DUREE_MESURE_S = 0.04;
export const NB_MESURES = 15;
const BANDES = 12;
const F_BAS = 60;
const F_HAUT = 16000;

const ffts = new Map<number, Fft>();

/**
 * Mesures d'une attaque (40 ms à partir de `debut`) : 12 bandes log (part de l'énergie, en dB ramenés de −60…0 à
 * 0…1), centroïde (log, 0 à 1), ZCR (0 à 1), décroissance (2e moitié face à la 1re, −30…0 dB → 0…1). Pure.
 */
export function mesuresAttaque(pcm: Float32Array, fs: number, debut: number): number[] {
  const l = Math.max(16, Math.round(DUREE_MESURE_S * fs));
  const n = Math.pow(2, Math.ceil(Math.log2(l)));
  let fft = ffts.get(n);
  if (!fft) ffts.set(n, (fft = new Fft(n)));
  const x = new Float64Array(n);
  const d = Math.max(0, Math.floor(debut));
  let croisements = 0;
  let avant = 0;
  let e1 = 0;
  let e2 = 0;
  for (let i = 0; i < l; i++) {
    const v = d + i < pcm.length ? pcm[d + i]! : 0;
    if (i < l / 2) e1 += v * v;
    else e2 += v * v;
    if (i > 0 && v >= 0 !== avant >= 0) croisements++;
    avant = v;
    // Fenêtre : on garde l'attaque intacte, seul le dernier quart s'efface (fuite spectrale).
    const q = i / l;
    x[i] = v * (q < 0.75 ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (q - 0.75)) / 0.25));
  }
  const p = new Float64Array(n / 2 + 1);
  fft.puissance(x, p);
  const haut = Math.min(F_HAUT, fs / 2);
  const bandes = new Float64Array(BANDES);
  let total = 0;
  let pondere = 0;
  for (let k = 1; k <= n / 2; k++) {
    const f = (k * fs) / n;
    if (f < F_BAS || f >= haut) continue;
    const b = Math.min(BANDES - 1, Math.floor((BANDES * Math.log(f / F_BAS)) / Math.log(haut / F_BAS)));
    bandes[b] = bandes[b]! + p[k]!;
    total += p[k]!;
    pondere += f * p[k]!;
  }
  const borne = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const mesures: number[] = [];
  for (let b = 0; b < BANDES; b++)
    mesures.push(borne((10 * Math.log10(bandes[b]! / Math.max(total, 1e-20) + 1e-6) + 60) / 60));
  const centroide = total > 0 ? pondere / total : F_BAS;
  mesures.push(borne(Math.log(centroide / F_BAS) / Math.log(haut / F_BAS)));
  mesures.push(borne((2 * croisements) / (l - 1)));
  mesures.push(borne((10 * Math.log10((e2 + 1e-20) / (e1 + 1e-20)) + 30) / 30));
  return mesures;
}
