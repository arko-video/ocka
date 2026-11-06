// Signaux fabriqués pour les tests des sons avancés (S) et mesure de hauteur YIN. Seuls les tests l'importent.

import type { PcmSon } from '../moteur/types-moteur';

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Son harmonique (fondamentale `f`, 4 harmoniques décroissantes), `duree` s. */
export function tonHarmonique(f: number, duree: number, sr = 44100, amplitude = 0.4): Float32Array {
  const n = Math.round(duree * sr);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let h = 1; h <= 4; h++) s += Math.sin((2 * Math.PI * f * h * i) / sr) / h;
    x[i] = amplitude * 0.5 * s;
  }
  return x;
}

/** Boucle de batterie à `bpm` (kick 1 et 3, caisse claire 2 et 4, charley aux croches), `mesures` mesures. */
export function boucleBatterie(bpm: number, mesures: number, sr = 44100): PcmSon {
  const temps = 60 / bpm;
  const n = Math.round(mesures * 4 * temps * sr);
  const x = new Float32Array(n);
  const r = hasard(7);
  const poser = (t: number, son: (k: number) => number, duree: number) => {
    const d = Math.round(t * sr);
    for (let k = 0; k < duree * sr && d + k < n; k++) x[d + k]! += son(k / sr);
  };
  for (let b = 0; b < mesures * 4; b++) {
    const t = b * temps;
    if (b % 2 === 0) poser(t, (s) => 0.9 * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-s * 30)) * s) * Math.exp(-s * 9), 0.35);
    else poser(t, (s) => 0.6 * (r() * 2 - 1) * Math.exp(-s * 22) + 0.3 * Math.sin(2 * Math.PI * 190 * s) * Math.exp(-s * 25), 0.2);
    for (const c of [0, 0.5]) poser(t + c * temps, (s) => 0.25 * (r() * 2 - 1) * Math.exp(-s * 70), 0.05);
  }
  return { frequence: sr, canaux: [x] };
}

const HZ = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Suite d'accords en la mineur (Am – Dm – E – Am, basse à l'octave), 1 s par accord, répétée 2 fois. */
export function accordsLaMineur(sr = 44100): PcmSon {
  const accords = [
    [45, 57, 60, 64], // la mineur
    [50, 62, 65, 69], // ré mineur
    [40, 56, 59, 64], // mi majeur (sol dièse : la sensible)
    [45, 57, 60, 64],
  ];
  const duree = 1;
  const n = Math.round(accords.length * 2 * duree * sr);
  const x = new Float32Array(n);
  accords.concat(accords).forEach((notes, j) => {
    for (const m of notes) {
      const t = tonHarmonique(HZ(m), duree, sr, 0.12);
      const d = Math.round(j * duree * sr);
      for (let i = 0; i < t.length && d + i < n; i++) x[d + i]! += t[i]! * Math.min(1, i / 200, (t.length - i) / 200);
    }
  });
  return { frequence: sr, canaux: [x] };
}

/** Hauteur (Hz) par YIN sur une fenêtre (milieu du signal par défaut), seuil 0,1, interpolation parabolique. */
export function yin(x: Float32Array, sr: number, fmin = 60, fmax = 1500, debut?: number): number {
  const W = Math.round(sr / fmin) * 2;
  const tauMax = Math.round(sr / fmin);
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const d0 = debut ?? Math.floor((x.length - W - tauMax) / 2);
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const e = x[d0 + i]! - x[d0 + i + tau]!;
      s += e * e;
    }
    d[tau] = s;
  }
  const cmnd = new Float64Array(tauMax + 1);
  cmnd[0] = 1;
  let somme = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    somme += d[tau]!;
    cmnd[tau] = (d[tau]! * tau) / (somme || 1);
  }
  let t = -1;
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (cmnd[tau]! < 0.1) {
      while (tau + 1 < tauMax && cmnd[tau + 1]! < cmnd[tau]!) tau++;
      t = tau;
      break;
    }
  }
  if (t < 0) {
    let mini = Infinity;
    for (let tau = tauMin; tau < tauMax; tau++) if (cmnd[tau]! < mini) (mini = cmnd[tau]!), (t = tau);
  }
  const [a, b, c] = [cmnd[t - 1]!, cmnd[t]!, cmnd[t + 1]!];
  const den = a - 2 * b + c;
  const fin = den !== 0 ? t + (0.5 * (a - c)) / den : t;
  return sr / fin;
}

/** Écart en cents entre deux fréquences. */
export const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);
