// Rendu de l'autotune avancé (hors temps réel) : complet, ou PARTIEL quand seules des notes éditées ont changé.
//  - Complet : comme corrigerVoix, région voisée par région voisée (courbe-correction.ts, psola-avance.ts), avec
//    des fondus de 20 ms aux bords des régions ; les sons non voisés sont recopiés tels quels. Même longueur.
//  - Partiel : seule la zone [note − 100 ms, note + 100 ms] est recalculée. Hors de la zone, le rendu précédent est
//    gardé AU BIT PRÈS. Dans la zone, les marques de synthèse repartent d'une marque de l'ancien rendu et retombent
//    exactement sur une autre (l'écart de phase est réparti dans les marges, pas dans la note), et la nouvelle
//    courbe de correction entre et sort en fondu dans les marges : ni clic ni trou.
// Fichier pur : Worker et tests.

import type { AutotunePrise, Morceau } from '../morceau/types';
import { courbeRegion, FONDU_S, partVoisee, periodeAu, rapportAu, regionsVoisees, type Region } from './courbe-correction';
import { PART_VOISEE_MIN } from './correction';
import { marquesAnalyse, marquesRaccord, marquesSynthese, superposer, type Courbes } from './psola-avance';
import { classesGamme, memesReglages, notesChangees } from './reglages';
import type { Hauteurs } from './yin';

/** Marge recalculée de chaque côté d'une note changée (s). */
export const MARGE_S = 0.1;
/** Au-delà de cette part de la prise à recalculer, le rendu complet est aussi rapide. */
const PART_MAX_PARTIEL = 0.5;

export interface RegionRendue extends Region {
  /** Marques de synthèse du rendu (null : région trop courte, recopiée telle quelle). */
  syn: Float64Array | null;
  ana: Float64Array | null;
}

export interface Rendu {
  pcm: Float32Array;
  voisees: number;
  applique: boolean;
  reglages: AutotunePrise;
  tonalite: Morceau['tonalite'] | undefined;
  regions: RegionRendue[];
  /** Zones recalculées (secondes) d'un rendu partiel ; absent = rendu complet. */
  zones?: [number, number][];
}

const alphaFormants = (r: AutotunePrise) => Math.pow(2, Math.min(12, Math.max(-12, r.formants || 0)) / 12);

/** Mélange du rendu et de la voix brute aux bords d'une région (fondus de 20 ms), sur [t0, t1[. */
function poser(sortie: Float32Array, pcm: Float32Array, corrige: Float32Array, r: Region, t0: number, t1: number, fs: number): void {
  const fondu = Math.round(FONDU_S * fs);
  for (let i = t0; i < t1; i++) {
    const m = Math.min(1, (i - r.a) / fondu, (r.b - 1 - i) / fondu);
    sortie[i] = pcm[i]! + m * (corrige[i - t0]! - pcm[i]!);
  }
}

const tropCourte = (r: Region, fs: number) => r.b - r.a < 2 * Math.round(FONDU_S * fs) + 1;

function courbes(h: Hauteurs, r: Region, fs: number, classes: number[], reglages: AutotunePrise): Courbes {
  return { periode: periodeAu(h, r, fs), rapport: rapportAu(courbeRegion(h, r, classes, reglages), h, r, fs) };
}

/** true si les réglages corrigent quelque chose (force, ou notes éditées). */
const corrige = (r: AutotunePrise) => r.force > 0 || (r.notes?.length ?? 0) > 0;

/** Rendu complet d'une prise mono (`fs` Hz) dont l'analyse YIN est `h`. */
export function rendreComplet(pcm: Float32Array, fs: number, h: Hauteurs, reglages: AutotunePrise, tonalite: Morceau['tonalite'] | undefined): Rendu {
  const voisees = partVoisee(h);
  const base = { voisees, reglages, tonalite, regions: [] as RegionRendue[] };
  if (!corrige(reglages) || voisees < PART_VOISEE_MIN) return { ...base, pcm, applique: false };
  const classes = classesGamme(reglages.gamme, tonalite);
  const alpha = alphaFormants(reglages);
  const sortie = pcm.slice();
  for (const r of regionsVoisees(h, fs, pcm.length)) {
    if (tropCourte(r, fs)) {
      base.regions.push({ ...r, syn: null, ana: null });
      continue;
    }
    const c = courbes(h, r, fs, classes, reglages);
    const ana = marquesAnalyse(r.a, r.b, c);
    const syn = marquesSynthese(r.a, r.b, c);
    poser(sortie, pcm, superposer(pcm, ana, syn, c.periode, alpha, r.a, r.b), r, r.a, r.b, fs);
    base.regions.push({ ...r, syn, ana });
  }
  return { ...base, pcm: sortie, applique: true };
}

/** Zones à recalculer (secondes), fusionnées, pour passer de `avant` à `apres` ; null = rendu complet nécessaire. */
export function zonesARecalculer(avant: Rendu, apres: AutotunePrise, tonalite: Morceau['tonalite'] | undefined, duree: number): [number, number][] | null {
  if (!avant.applique || !memesReglages(avant.reglages, apres)) return null;
  const ca = classesGamme(avant.reglages.gamme, avant.tonalite).join(',');
  if (ca !== classesGamme(apres.gamme, tonalite).join(',')) return null;
  if (!corrige(apres)) return null;
  const changees = notesChangees(avant.reglages.notes, apres.notes).sort((x, y) => x.debut - y.debut);
  const zones: [number, number][] = [];
  for (const n of changees) {
    const z: [number, number] = [Math.max(0, n.debut - MARGE_S), Math.min(duree, n.fin + MARGE_S)];
    const der = zones[zones.length - 1];
    if (der && z[0] <= der[1] + 0.05) der[1] = Math.max(der[1], z[1]);
    else zones.push(z);
  }
  const total = zones.reduce((s, [a, b]) => s + b - a, 0);
  return total > PART_MAX_PARTIEL * duree ? null : zones;
}

/**
 * Rendu partiel depuis `avant` (même prise, même analyse `h`) : null si les réglages globaux ont changé ou si la
 * part à recalculer est trop grande (on fait alors un rendu complet).
 */
export function rendrePartiel(pcm: Float32Array, fs: number, h: Hauteurs, avant: Rendu, reglages: AutotunePrise, tonalite: Morceau['tonalite'] | undefined): Rendu | null {
  const zones = zonesARecalculer(avant, reglages, tonalite, pcm.length / fs);
  if (!zones) return null;
  const classes = classesGamme(reglages.gamme, tonalite);
  const classesAvant = classesGamme(avant.reglages.gamme, avant.tonalite);
  const alpha = alphaFormants(reglages);
  const sortie = avant.pcm.slice();
  const regions = avant.regions.map((r) => ({ ...r }));
  const garde = Math.ceil((2 * fs) / 70); // un grain dure au plus 2 périodes de la voix la plus grave
  for (const [zs, ze] of zones) {
    const za = Math.round(zs * fs);
    const zb = Math.round(ze * fs);
    for (const r of regions) {
      if (r.b <= za || r.a >= zb || !r.syn || !r.ana) continue;
      const t0 = Math.max(r.a, za);
      const t1 = Math.min(r.b, zb);
      const ancien = courbes(h, r, fs, classesAvant, avant.reglages);
      const neuf = courbes(h, r, fs, classes, reglages);
      // Ancrages : une marque de l'ancien rendu au début et à la fin de la zone (sauf au bord de la région).
      const syn = r.syn;
      let i0 = 0;
      if (za > r.a) {
        while (i0 < syn.length && syn[i0]! < za + garde) i0++;
      }
      let i1: number | null = null;
      if (zb < r.b) {
        let j = syn.length - 1;
        while (j >= 0 && syn[j]! > zb - garde) j--;
        i1 = j;
      }
      if (i0 >= syn.length || (i1 !== null && i1 - i0 < 3)) continue; // zone trop courte dans cette région
      const A = syn[i0]!;
      const B = i1 === null ? r.b : syn[i1]!;
      const rampe = Math.max(1, Math.round(MARGE_S * fs) - garde);
      const poids = (s: number) => Math.min(1, za > r.a ? (s - A) / rampe : 1, i1 !== null ? (B - s) / rampe : 1);
      const melange: Courbes = {
        periode: neuf.periode,
        rapport: (s) => {
          const w = Math.max(0, poids(s));
          return w >= 1 ? neuf.rapport(s) : ancien.rapport(s) + w * (neuf.rapport(s) - ancien.rapport(s));
        },
      };
      const milieu = marquesRaccord(A, i1 === null ? null : B, r.b, melange, (s) => (poids(s) < 1 ? 1 : 0));
      const marques = [...syn.subarray(0, i0 + 1), ...milieu, ...(i1 === null ? [] : syn.subarray(i1))];
      r.syn = Float64Array.from(marques);
      poser(sortie, pcm, superposer(pcm, r.ana, r.syn, neuf.periode, alpha, t0, t1), r, t0, t1, fs);
    }
  }
  return { pcm: sortie, voisees: avant.voisees, applique: true, reglages, tonalite, regions, zones };
}
