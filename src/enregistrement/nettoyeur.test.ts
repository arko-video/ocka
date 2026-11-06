// Nettoyeur de voix (Moyen) : voix de synthèse + bruit blanc à −30 dB → le bruit baisse d'au moins 12 dB et la voix
// (voyelles) change de moins de 1 dB ; les « s » (bruit de 5 à 9 kHz) baissent d'au moins 4 dB.
import { describe, expect, it } from 'vitest';
import { voixSynthese } from '../autotune/voix-synthese';
import { INTENSITES_NETTOYEUR, nettoyer } from './nettoyeur-calcul';

const FS = 48000;
const db = (x: number) => 10 * Math.log10(x + 1e-30);
function energie(x: Float32Array, a: number, b: number): number {
  let e = 0;
  for (let i = Math.round(a * FS); i < Math.round(b * FS); i++) e += x[i]! ** 2;
  return e / Math.max(1, Math.round(b * FS) - Math.round(a * FS));
}
function bruit(n: number, graine = 99): Float32Array {
  let g = graine;
  return Float32Array.from({ length: n }, () => ((g = (g * 16807) % 2147483647) / 2147483647 - 0.5) * Math.sqrt(12));
}

/** Phrases de 1,2 s (voyelles sans consonne) séparées de 0,8 s de silence ; zones de voyelles et de silence. */
function phrases() {
  const v = voixSynthese(1.4, FS).pcm;
  const n = Math.round(6 * FS);
  const voix = new Float32Array(n);
  const voyelles: [number, number][] = [];
  const silences: [number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const debut = 0.8 + k * 2;
    voix.set(v.subarray(Math.round(0.1 * FS), Math.round(1.3 * FS)), Math.round(debut * FS));
    voyelles.push([debut + 0.15, debut + 1.1]);
    silences.push([debut - 0.6, debut - 0.2]);
  }
  return { voix, voyelles, silences };
}

describe('nettoyeur de voix', () => {
  it('bruit à −30 dB : baisse ≥ 12 dB, voix changée de moins de 1 dB', () => {
    const { voix, voyelles, silences } = phrases();
    const eVoix = voyelles.reduce((s, [a, b]) => s + energie(voix, a, b), 0) / voyelles.length;
    const b = bruit(voix.length);
    const gainBruit = Math.sqrt(eVoix * 10 ** (-30 / 10));
    const sale = voix.map((x, i) => x + gainBruit * b[i]!);
    const propre = nettoyer(sale, FS, INTENSITES_NETTOYEUR.moyen);
    expect(propre.length).toBe(sale.length);
    const bruitAvant = silences.reduce((s, [a, c]) => s + energie(sale, a, c), 0);
    const bruitApres = silences.reduce((s, [a, c]) => s + energie(propre, a, c), 0);
    const baisse = db(bruitAvant) - db(bruitApres);
    const ecarts = voyelles.map(([a, c]) => db(energie(propre, a, c)) - db(energie(voix, a, c)));
    console.log(`nettoyeur : bruit −${baisse.toFixed(1)} dB, voix ${ecarts.map((e) => e.toFixed(2)).join(' / ')} dB`);
    expect(baisse).toBeGreaterThanOrEqual(12);
    for (const e of ecarts) expect(Math.abs(e)).toBeLessThan(1);
  }, 30_000);

  it('désesseur : les « s » (5–9 kHz) baissent de 4 dB ou plus, les voyelles restent', () => {
    const { voix, voyelles } = phrases();
    // Un « s » de 150 ms juste avant chaque phrase : bruit de bande 5–9 kHz (200 sinusoïdes de phases au hasard).
    let graine = 7;
    const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
    const raies = Array.from({ length: 200 }, () => ({ f: 5000 + 4000 * alea(), p: 2 * Math.PI * alea() }));
    // Seulement la première seconde (les « s » la reprennent) : le calcul reste court.
    const bande = Float32Array.from({ length: FS }, (_, i) => raies.reduce((t, r) => t + Math.sin((2 * Math.PI * r.f * i) / FS + r.p), 0));
    const s = voix.slice();
    const zones: [number, number][] = [];
    const eVoix = voyelles.reduce((t, [a, b]) => t + energie(voix, a, b), 0) / voyelles.length;
    const eS = energie(bande, 0, 1);
    const g = Math.sqrt(eVoix / eS) * 0.7;
    for (const [a] of voyelles) {
      const debut = a - 0.15 - 0.2;
      zones.push([debut + 0.02, debut + 0.13]);
      for (let i = Math.round(debut * FS); i < Math.round((debut + 0.15) * FS); i++) s[i]! += g * bande[i % FS]!;
    }
    const sortie = nettoyer(s, FS, { porte: 0, reduction: 0, desesseur: INTENSITES_NETTOYEUR.moyen.desesseur });
    const baisses = zones.map(([a, b]) => db(energie(s, a, b)) - db(energie(sortie, a, b)));
    const voyellesEcart = voyelles.map(([a, b]) => db(energie(sortie, a, b)) - db(energie(voix, a, b)));
    console.log(`désesseur : « s » −${baisses.map((x) => x.toFixed(1)).join(' / ')} dB ; voyelles ${voyellesEcart.map((x) => x.toFixed(2)).join(' / ')} dB`);
    for (const b of baisses) expect(b).toBeGreaterThanOrEqual(4);
    for (const e of voyellesEcart) expect(Math.abs(e)).toBeLessThan(1);
  }, 30_000);

  it('tout éteint : la prise ressort à l’identique ; silence numérique : pas de NaN', () => {
    const { voix } = phrases();
    const r = nettoyer(voix, FS, { porte: 0, reduction: 0, desesseur: 0 });
    expect(r).toBe(voix);
    const z = nettoyer(new Float32Array(FS), FS, INTENSITES_NETTOYEUR.fort);
    expect(z.every((x) => x === 0)).toBe(true);
  });
});
