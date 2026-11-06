// Mesures des tests des synthés (L), sans dépendance : hauteur par YIN (de Cheveigné et Kawahara, 2002) et
// repliement (énergie hors des partiels attendus, fenêtre de Blackman-Harris, FFT). Utilisé par Vitest seulement.
import { fft } from '../../../enregistrement/calcul-calibrage';

/** Hauteur (Hz) d'une trame par YIN (seuil 0,1, interpolation parabolique), ou 0 si elle n'est pas voisée. */
export function yinTrame(
  x: Float32Array,
  debut: number,
  fenetre: number,
  tauMax: number,
  fs: number,
): number {
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < fenetre; j++) {
      const e = x[debut + j]! - x[debut + j + tau]!;
      s += e * e;
    }
    d[tau] = s;
  }
  const cmnd = new Float64Array(tauMax + 1);
  cmnd[0] = 1;
  let somme = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    somme += d[tau]!;
    cmnd[tau] = somme > 0 ? (d[tau]! * tau) / somme : 1;
  }
  let t = -1;
  for (let tau = 2; tau < tauMax; tau++) {
    if (cmnd[tau]! < 0.1) {
      while (tau + 1 < tauMax && cmnd[tau + 1]! < cmnd[tau]!) tau++;
      t = tau;
      break;
    }
  }
  if (t < 0) {
    let min = Infinity;
    for (let tau = 2; tau < tauMax; tau++) if (cmnd[tau]! < min) ((min = cmnd[tau]!), (t = tau));
    if (min > 0.3) return 0;
  }
  const a = cmnd[t - 1]!;
  const b = cmnd[t]!;
  const c = cmnd[t + 1] ?? b;
  const den = a - 2 * b + c;
  const tf = den !== 0 ? t + (0.5 * (a - c)) / den : t;
  return fs / tf;
}

/** Hauteur médiane (Hz) de `de` à `a` secondes, une trame tous les 10 ms. */
export function hauteurMediane(x: Float32Array, fs: number, de: number, a: number, fMin = 30): number {
  const fenetre = Math.round(fs * 0.03);
  const tauMax = Math.ceil(fs / fMin);
  const hs: number[] = [];
  for (let t = de; t < a; t += 0.01) {
    const i = Math.round(t * fs);
    if (i + fenetre + tauMax + 1 >= x.length) break;
    const h = yinTrame(x, i, fenetre, tauMax, fs);
    if (h > 0) hs.push(h);
  }
  hs.sort((p, q) => p - q);
  return hs.length ? hs[hs.length >> 1]! : 0;
}

/** Écart en cents. */
export const cents = (f: number, ref: number): number => 1200 * Math.log2(f / ref);

/**
 * Repliement (dB sous la raie la plus forte) : FFT de 65 536 points (fenêtre de Blackman-Harris à 4 termes) à partir
 * de `debut` s ; tout ce qui n'est pas à ± `marge` cases d'un partiel attendu (h × f pour chaque f de `fondamentales`,
 * sous Nyquist) compte comme repliement. Renvoie le pire, en dB (négatif).
 */
export function repliementDb(
  x: Float32Array,
  fs: number,
  debut: number,
  fondamentales: readonly number[],
  marge = 8,
): number {
  const N = 65536;
  const i0 = Math.round(debut * fs);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    const w =
      0.35875 -
      0.48829 * Math.cos((2 * Math.PI * j) / N) +
      0.14128 * Math.cos((4 * Math.PI * j) / N) -
      0.01168 * Math.cos((6 * Math.PI * j) / N);
    re[j] = (x[i0 + j] ?? 0) * w;
  }
  fft(re, im);
  const p = new Float64Array(N / 2);
  let max = 0;
  for (let k = 1; k < N / 2; k++) max = Math.max(max, (p[k] = re[k]! * re[k]! + im[k]! * im[k]!));
  const permis = new Uint8Array(N / 2);
  for (const f of fondamentales) {
    for (let h = 1; h * f < fs / 2; h++) {
      const k = Math.round((h * f * N) / fs);
      for (let j = Math.max(0, k - marge); j <= Math.min(N / 2 - 1, k + marge); j++) permis[j] = 1;
    }
  }
  // Le très grave (< 20 Hz : enveloppe, continu) ne compte pas.
  const kMin = Math.ceil((20 * N) / fs);
  let pire = 0;
  for (let k = kMin; k < N / 2; k++) if (!permis[k]) pire = Math.max(pire, p[k]!);
  return 10 * Math.log10(Math.max(1e-30, pire / max));
}

/** Empreinte FNV-1a des échantillons (comme registre-synthes.test.ts). */
export function empreinte(canaux: readonly Float32Array[]): string {
  let x = 0x811c9dc5;
  for (const c of canaux) {
    const u = new Uint32Array(c.buffer, c.byteOffset, c.length);
    for (let i = 0; i < u.length; i++) x = Math.imul(x ^ u[i]!, 0x01000193) >>> 0;
  }
  return x.toString(16) + ':' + canaux.map((c) => c.length).join('/');
}
