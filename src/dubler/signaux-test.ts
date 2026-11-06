// Signaux de SYNTHÈSE pour mesurer le détecteur (Vitest, et mesurerLatenceDetection dans l'appli) : une voix
// (source glottique en harmoniques, voyelle « a » à 3 formants, vibrato possible, bruit ajouté) et des sons de
// beatbox réalistes (kick « boum », caisse claire « ka », charley « ts », clic de langue). Pseudo-aléatoire fixe.

import type { SonBeatbox } from './api-dubler';

/** Générateur pseudo-aléatoire (Park-Miller) : même graine, même suite. Valeurs de −1 à 1. */
export function hasard(graine: number): () => number {
  let g = Math.max(1, Math.floor(graine) % 2147483647);
  return () => ((g = (g * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

export interface SegmentVoix {
  /** Hauteur (Hz) ; null = silence. */
  hz: number | null;
  duree: number;
  /** Vibrato : ± cents et fréquence (Hz). */
  vibrato?: number;
  vibratoHz?: number;
}

const FORMANTS: [number, number, number][] = [
  [700, 110, 1],
  [1220, 120, 0.5],
  [2600, 170, 0.25],
];

/** Gain d'un harmonique de fréquence f : pente de la source (−12 dB/octave) et formants. */
function enveloppeSpectrale(f: number): number {
  let g = 0.15;
  for (const [fc, bw, a] of FORMANTS) g += a / (1 + ((f - fc) / bw) ** 2);
  return g / (1 + f / 150);
}

/**
 * Voix de synthèse (crête −6 dBFS sur les parties chantées) ; `bruitDb` = bruit blanc à N dB SOUS l'efficace de
 * la voix (null = aucun). Attaque et relâche de 10 ms, légato entre deux segments chantés.
 */
export function voixSegments(
  segments: SegmentVoix[],
  fs = 48000,
  bruitDb: number | null = null,
  graine = 7,
): Float32Array {
  const total = Math.round(segments.reduce((s, x) => s + x.duree, 0) * fs);
  const pcm = new Float32Array(total);
  const phases = new Float64Array(64);
  let i0 = 0;
  for (let k = 0; k < segments.length; k++) {
    const s = segments[k]!;
    const n = Math.round(s.duree * fs);
    if (s.hz !== null) {
      const avantChante = k > 0 && segments[k - 1]!.hz !== null;
      const apresChante = k + 1 < segments.length && segments[k + 1]!.hz !== null;
      const nh = Math.min(64, Math.floor(5000 / s.hz));
      const gains = Array.from({ length: nh }, (_, h) => enveloppeSpectrale(s.hz! * (h + 1)));
      for (let i = 0; i < n; i++) {
        const t = i / fs;
        const vib = (s.vibrato ?? 0) * Math.sin(2 * Math.PI * (s.vibratoHz ?? 5.5) * t);
        const f0 = s.hz * Math.pow(2, vib / 1200);
        const env = Math.min(avantChante ? 1 : i / (0.01 * fs), apresChante ? 1 : (n - i) / (0.01 * fs), 1);
        let v = 0;
        for (let h = 0; h < nh; h++) {
          phases[h] = (phases[h]! + (f0 * (h + 1)) / fs) % 1;
          v += gains[h]! * Math.sin(2 * Math.PI * phases[h]!);
        }
        pcm[i0 + i] = v * env;
      }
    } else phases.fill(0);
    i0 += n;
  }
  let crete = 0;
  let somme = 0;
  let chantes = 0;
  for (let i = 0; i < total; i++) {
    crete = Math.max(crete, Math.abs(pcm[i]!));
    if (pcm[i] !== 0) {
      somme += pcm[i]! * pcm[i]!;
      chantes++;
    }
  }
  const g = crete > 0 ? 0.5 / crete : 1;
  for (let i = 0; i < total; i++) pcm[i] = pcm[i]! * g;
  if (bruitDb !== null && chantes > 0) {
    const efficace = Math.sqrt(somme / chantes) * g;
    const a = efficace * Math.pow(10, -bruitDb / 20) * Math.sqrt(3); // bruit uniforme : efficace = a / √3
    const h = hasard(graine);
    for (let i = 0; i < total; i++) pcm[i] = pcm[i]! + a * h();
  }
  return pcm;
}

/** Passe-bande à 2 pôles (fréquence, largeur) appliqué à x[i] ; renvoie la fonction de filtrage. */
function resonateur(f: number, bw: number, fs: number): (x: number) => number {
  const r = Math.exp((-Math.PI * bw) / fs);
  const a1 = 2 * r * Math.cos((2 * Math.PI * f) / fs);
  const a2 = -r * r;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = (1 - r) * x + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/**
 * Un son de beatbox de synthèse (≈ 250 ms, attaque à 10 ms), varié par `graine` (hauteur, durée, timbre, niveau) :
 * - boum : bruit filtré grave dont le filtre descend (400 → 80 Hz) et corps sinusoïdal qui descend (~170 → 55 Hz) ;
 * - ka : bruit médium court (≈ 1,5 à 3 kHz, 40 à 70 ms), avec un petit claquement ;
 * - ts : bruit aigu (au-dessus de 6 kHz) qui s'éteint en ≈ 60 à 120 ms ;
 * - perso : clic de langue (résonance vers 1,2 kHz, très bref).
 */
export function sonBeatbox(son: SonBeatbox, graine: number, fs = 48000): Float32Array {
  const h = hasard(graine * 7919 + son.length * 31);
  const v = (x: number, ecart: number) => x * (1 + ecart * h());
  const n = Math.round(0.25 * fs);
  const pcm = new Float32Array(n);
  const debut = Math.round(0.01 * fs);
  const bruit = hasard(graine * 104729 + 3);
  if (son === 'boum') {
    const f0 = v(170, 0.15);
    const f1 = v(55, 0.1);
    const tau = v(0.12, 0.25);
    let phase = 0;
    let lp = 0;
    for (let i = debut; i < n; i++) {
      const t = (i - debut) / fs;
      const f = f1 + (f0 - f1) * Math.exp(-t / 0.035);
      phase += f / fs;
      const coupure = 80 + 320 * Math.exp(-t / 0.03);
      const a = 1 - Math.exp((-2 * Math.PI * coupure) / fs);
      lp += a * (bruit() - lp);
      pcm[i] = Math.exp(-t / tau) * (0.8 * Math.sin(2 * Math.PI * phase) + 1.5 * lp);
    }
  } else if (son === 'ka') {
    const filtre = resonateur(v(2200, 0.2), v(1400, 0.2), fs);
    const tau = v(0.018, 0.25);
    const fin = debut + Math.round(v(0.055, 0.25) * fs);
    for (let i = debut; i < Math.min(n, fin); i++) {
      const t = (i - debut) / fs;
      const clic = t < 0.0015 ? bruit() * 0.6 : 0;
      pcm[i] = Math.exp(-t / tau) * filtre(bruit()) * 6 + clic;
    }
  } else if (son === 'ts') {
    const tau = v(0.05, 0.3);
    let avant = 0;
    let avant2 = 0;
    for (let i = debut; i < n; i++) {
      const t = (i - debut) / fs;
      const b = bruit();
      // Passe-haut (différences secondes) : énergie surtout au-dessus de 6 kHz.
      const hp = b - 2 * avant + avant2;
      avant2 = avant;
      avant = b;
      pcm[i] = Math.min(1, t / 0.003) * Math.exp(-t / tau) * hp * 0.4;
    }
  } else {
    const filtre = resonateur(v(1200, 0.15), 150, fs);
    for (let i = debut; i < n; i++) {
      const t = (i - debut) / fs;
      const ex = t < 0.0008 ? bruit() : 0;
      pcm[i] = filtre(ex) * Math.exp(-t / v(0.008, 0.2)) * 40;
    }
  }
  let crete = 0;
  for (let i = 0; i < n; i++) crete = Math.max(crete, Math.abs(pcm[i]!));
  const niveau = Math.pow(10, (-6 - 18 * (0.5 + 0.5 * h())) / 20);
  const fond = hasard(graine + 11);
  for (let i = 0; i < n; i++) pcm[i] = (crete > 0 ? (pcm[i]! * niveau) / crete : 0) + 0.0005 * fond();
  return pcm;
}

/** Une suite de sons de beatbox posés aux heures `debuts` (s, attaque à +10 ms), dans `duree` secondes. */
export function suiteBeatbox(
  sons: { son: SonBeatbox; t: number; graine: number }[],
  duree: number,
  fs = 48000,
): Float32Array {
  const pcm = new Float32Array(Math.round(duree * fs));
  const fond = hasard(99);
  for (let i = 0; i < pcm.length; i++) pcm[i] = 0.0005 * fond();
  for (const s of sons) {
    const x = sonBeatbox(s.son, s.graine, fs);
    const a = Math.round(s.t * fs);
    for (let i = 0; i < x.length && a + i < pcm.length; i++) pcm[a + i] = pcm[a + i]! + x[i]!;
  }
  return pcm;
}
