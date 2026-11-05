// Comparaison de deux WAV au PCM près (reproductibilité, test nul contre la phase 1).
import { readFileSync } from 'node:fs';

/** Lit un WAV PCM 16/24 bits stéréo : les deux canaux en Float32 (en-tête parcouru chunk par chunk). */
export function lireStereo(chemin: string): { g: Float32Array; d: Float32Array; frequence: number } {
  const b = readFileSync(chemin);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const txt = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  const frequence = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  let o = 12;
  while (txt(o) !== 'data') o += 8 + v.getUint32(o + 4, true);
  const oct = bits / 8;
  const n = Math.floor(v.getUint32(o + 4, true) / (oct * 2));
  const debut = o + 8;
  const lire = (p: number) => (bits === 16 ? v.getInt16(p, true) / 32768 : (((b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16)) << 8) >> 8) / 8388608);
  const g = new Float32Array(n);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    g[i] = lire(debut + i * oct * 2);
    d[i] = lire(debut + i * oct * 2 + oct);
  }
  return { g, d, frequence };
}

export interface Ecart {
  /** Énergie de la différence sous celle de la référence (dB) : −∞ si identiques au bit près. */
  ecartDb: number;
  /** Plus grand écart d'un échantillon (dBFS). */
  creteDbfs: number;
  /** Échantillons différents (sur les deux canaux). */
  differents: number;
  /** Décalage (trames) qui minimise l'écart, cherché sur ±64 : 0 attendu. */
  decalage: number;
  trames: [number, number];
}

/** Compare deux WAV stéréo (même fréquence), échantillon par échantillon. */
export function comparerWav(reference: string, autre: string): Ecart {
  const a = lireStereo(reference);
  const b = lireStereo(autre);
  const n = Math.min(a.g.length, b.g.length);
  const energie = (lag: number, pas = 1) => {
    let e = 0;
    for (let i = Math.max(0, -lag); i < n - Math.max(0, lag); i += pas) {
      const x = a.g[i]! - b.g[i + lag]!;
      const y = a.d[i]! - b.d[i + lag]!;
      e += x * x + y * y;
    }
    return e;
  };
  let decalage = 0;
  let mieux = energie(0, 7);
  for (let lag = -64; lag <= 64; lag++) {
    const e = energie(lag, 7);
    if (e < mieux) [mieux, decalage] = [e, lag];
  }
  let ref = 0;
  let diff = 0;
  let crete = 0;
  let differents = 0;
  for (let i = 0; i < n; i++) {
    for (const [x, y] of [[a.g[i]!, b.g[i]!], [a.d[i]!, b.d[i]!]] as const) {
      ref += x * x;
      const e = x - y;
      diff += e * e;
      if (e !== 0) differents++;
      crete = Math.max(crete, Math.abs(e));
    }
  }
  const db = (x: number) => Math.round(x * 100) / 100;
  return {
    ecartDb: diff === 0 ? -Infinity : db(10 * Math.log10(diff / ref)),
    creteDbfs: crete === 0 ? -Infinity : db(20 * Math.log10(crete)),
    differents,
    decalage,
    trames: [a.g.length, b.g.length],
  };
}

