// Outils de calcul des sons avancés (S) : mono, FFT réelle (radix 2), fenêtre de Hann, flux spectral.
// Fonctions PURES, sans Web Audio : elles tournent dans Vitest, sur le fil principal et dans le Worker.

import type { PcmSon } from '../moteur/types-moteur';

/** Le son en mono (moyenne des canaux). Le même tableau si le son est déjà mono. */
export function mono(pcm: PcmSon): Float32Array {
  const c = pcm.canaux;
  if (c.length === 1) return c[0]!;
  const n = Math.min(...c.map((x) => x.length));
  const out = new Float32Array(n);
  for (const x of c) for (let i = 0; i < n; i++) out[i]! += x[i]! / c.length;
  return out;
}

/** Nombre de trames d'un son. */
export function longueur(pcm: PcmSon): number {
  return pcm.canaux.length ? Math.min(...pcm.canaux.map((x) => x.length)) : 0;
}

/** Plus petite puissance de 2 ≥ n. */
export function puissance2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

const fenetres = new Map<number, Float64Array>();
/** Fenêtre de Hann périodique (somme constante à 50 % de recouvrement). */
export function hann(n: number): Float64Array {
  let f = fenetres.get(n);
  if (!f) {
    f = new Float64Array(n);
    for (let i = 0; i < n; i++) f[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    fenetres.set(n, f);
  }
  return f;
}

/** FFT complexe en place (n puissance de 2). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i]!;
      re[i] = re[j]!;
      re[j] = r;
      const m = im[i]!;
      im[i] = im[j]!;
      im[j] = m;
    }
  }
  for (let taille = 2; taille <= n; taille *= 2) {
    const angle = (-2 * Math.PI) / taille;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    const moitie = taille / 2;
    for (let debut = 0; debut < n; debut += taille) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < moitie; k++) {
        const a = debut + k;
        const b = a + moitie;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/**
 * Spectres d'amplitude d'un signal, trame par trame (fenêtre de Hann de `n`, pas `pas`) : `rappel(i, amplitudes)`
 * reçoit n/2 + 1 amplitudes (le même tableau, réutilisé). Trames centrées sur i × pas.
 */
export function spectres(x: Float32Array, n: number, pas: number, rappel: (i: number, amp: Float64Array) => void): number {
  const w = hann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const amp = new Float64Array(n / 2 + 1);
  const trames = Math.max(1, Math.ceil(x.length / pas));
  for (let t = 0; t < trames; t++) {
    const centre = t * pas;
    for (let i = 0; i < n; i++) {
      const j = centre - n / 2 + i;
      re[i] = j >= 0 && j < x.length ? x[j]! * w[i]! : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k <= n / 2; k++) amp[k] = Math.sqrt(re[k]! * re[k]! + im[k]! * im[k]!);
    rappel(t, amp);
  }
  return trames;
}

/**
 * Flux spectral (force des attaques) : somme des hausses du log-spectre d'une trame à la suivante, normalisée
 * (maximum = 1). Une valeur par trame de `pas` échantillons.
 */
export function fluxSpectral(x: Float32Array, n: number, pas: number): Float64Array {
  let avant = new Float64Array(n / 2 + 1);
  let log = new Float64Array(n / 2 + 1);
  const valeurs: number[] = [];
  spectres(x, n, pas, (i, amp) => {
    for (let k = 0; k < amp.length; k++) log[k] = Math.log1p(100 * amp[k]!);
    let s = 0;
    if (i > 0) for (let k = 0; k < log.length; k++) s += Math.max(0, log[k]! - avant[k]!);
    valeurs.push(s);
    [avant, log] = [log, avant];
  });
  const out = Float64Array.from(valeurs);
  let max = 0;
  for (const v of out) max = Math.max(max, v);
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] = out[i]! / max;
  return out;
}

/** Crête absolue d'un son (tous canaux). */
export function crete(pcm: PcmSon): number {
  let c = 0;
  for (const x of pcm.canaux) for (let i = 0; i < x.length; i++) c = Math.max(c, Math.abs(x[i]!));
  return c;
}
