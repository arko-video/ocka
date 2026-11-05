// Master HORS LIGNE (export, A/B) : le rendu de l'OfflineAudioContext s'arrête à l'entrée du master (aucun worklet :
// Chrome ne libère jamais un contexte hors ligne où un AudioWorklet a été chargé). On applique ensuite ici, en JS,
// EN PLACE et par blocs de 128 trames, exactement ce que fait le worklet : MasterFlux (colle + limiteur), réglé à
// chaque bloc comme par les AudioParam, puis le fondu de fin (le GainNode « fondu » du bus, même courbe).
// Écart avec le worklet : −∞ dB pour le master (même code, mêmes Float32) ; le fondu ne diffère que par l'arrondi
// de la rampe (≤ −120 dB, vérifié par tests/qa/master-js.qa.ts). Fichier pur : testé dans Node.

import { MasterFlux, type ReglagesFlux } from './master-flux';

/** Seuil du limiteur du master (−1 dBFS), le même que worklet.ts (sans importer le module du worklet). */
const SEUIL = Math.pow(10, -1 / 20);
const QUANTUM = 128;
/** Trames traitées entre deux pauses (≈ 1 s) : l'interface respire. */
const TRANCHE = QUANTUM * 344;

/** Fondu de fin (s, temps du contexte) : 1 jusqu'à `debut`, puis rampe linéaire jusqu'à 0 à `fin`. */
export interface Fondu {
  debut: number;
  fin: number;
}

/** Le fondu programmé par le graphe (origine = temps du contexte du début du morceau ; `fondu` = Morceau.fondu). */
export function fonduFin(origine: number, duree: number, fondu: number): Fondu {
  const fin = origine + duree;
  // Sans fondu demandé : toujours un mini-fondu de 10 ms, jamais de clic à la fin.
  return { debut: Math.max(0, fin - (fondu > 0 ? fondu : 0.01)), fin };
}

/** Gain du fondu à la trame `k` (comme l'AudioParam : rampe linéaire entre deux événements, en Float32). */
export function gainFondu(f: Fondu, k: number, fs: number): number {
  const t = k / fs;
  if (t < f.debut) return 1;
  if (t >= f.fin) return 0;
  return Math.fround(1 - (t - f.debut) / (f.fin - f.debut));
}

/**
 * Applique le master (et le fondu s'il est donné) EN PLACE sur les 2 canaux rendus (temps du contexte : la trame k
 * en sortie correspond à la trame k − retard en entrée, comme avec le worklet). `pause` est appelée toutes les ~1 s.
 */
export async function appliquerMaster(
  canaux: [Float32Array, Float32Array],
  reglages: ReglagesFlux,
  fs: number,
  fondu: Fondu | null,
  pause?: () => Promise<void>,
): Promise<void> {
  const [g, d] = canaux;
  const n = g.length;
  const flux = new MasterFlux(fs, SEUIL, reglages);
  const debutFondu = fondu ? Math.max(0, Math.floor(fondu.debut * fs)) : n;
  for (let i = 0; i < n; i += QUANTUM) {
    const m = Math.min(QUANTUM, n - i);
    flux.regler(reglages.chaine, reglages.seuilColle, reglages.colle); // comme le worklet, à chaque bloc
    const bg = g.subarray(i, i + m);
    const bd = d.subarray(i, i + m);
    flux.traiter(bg, bd, bg, bd, m); // en place : chaque trame est lue avant d'être écrite
    if (fondu && i + m > debutFondu) {
      for (let k = Math.max(i, debutFondu); k < i + m; k++) {
        const v = gainFondu(fondu, k, fs);
        g[k] = g[k]! * v;
        d[k] = d[k]! * v;
      }
    }
    if (pause && (i + QUANTUM) % TRANCHE === 0) await pause();
  }
}
