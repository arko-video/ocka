// Punch-in et comping (pur) : les passages sont copiés exactement, recalés par la latence de chaque prise, et les
// bords n'ont pas de clic (fondus enchaînés de 10 ms, somme des poids = 1).
import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import { normaliserMorceau } from '../morceau/normaliser';
import type { Prise } from '../morceau/types';
import { ajouterDerivee, assemblerPcm, echantillonA, longueurAssemblage, poids, tempsDe, type Source } from './assemblage';

const FS = 48000;
const sinus = (n: number, f: number, a = 0.5, phase = 0) => Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / FS + phase));
/** Plus grand saut entre deux échantillons voisins, de i0 à i1. */
function saut(x: Float32Array, i0: number, i1: number): number {
  let m = 0;
  for (let i = Math.max(1, i0); i < Math.min(x.length, i1); i++) m = Math.max(m, Math.abs(x[i]! - x[i - 1]!));
  return m;
}

describe('assemblage de prises', () => {
  it('poids : fondus de 10 ms centrés, somme 1 entre deux passages voisins', () => {
    for (const t of [0.995, 0.997, 1, 1.003, 1.005]) expect(poids({ de: 0, a: 1 }, t) + poids({ de: 1, a: 2 }, t)).toBeCloseTo(1, 12);
    expect(poids({ de: 0, a: 1 }, 0.5)).toBe(1);
    expect(poids({ de: 0, a: 1 }, 1.006)).toBe(0);
  });

  it('punch-in : zone remplacée, recalée par la latence de la prise de punch, aucun clic aux bords', () => {
    // Base : ancre à 2 s, décompte de 1 s dans le fichier, latence 120 ms. Punch : ancre à 4 s, latence 87,3 ms.
    const base: Source = { debutAncre: 2, debutCoupe: 1, decalage: 0.12, frequence: FS, pcm: sinus(8 * FS, 220, 0.5) };
    const punch: Source = { debutAncre: 4, debutCoupe: 0.5, decalage: 0.0873, frequence: FS, pcm: sinus(6 * FS, 330, 0.4, 1) };
    // Un repère (impulsion) chanté au temps 5,5 s du morceau dans la prise de punch : il doit sortir à 5,5 s.
    const marque = Math.round(echantillonA(punch, 5.5));
    punch.pcm[marque] = 1;
    const de = 4.75;
    const a = 6.25;
    const n = longueurAssemblage({ ...base, longueur: base.pcm.length }, [{ a }]);
    const out = assemblerPcm(base, [base, punch], [{ source: 0, de: -Infinity, a: de }, { source: 1, de, a }, { source: 0, de: a, a: Infinity }], n);
    expect(n).toBe(base.pcm.length);
    // Hors des fondus : copie exacte de la bonne source.
    const jDe = Math.round(echantillonA(base, de));
    const jA = Math.round(echantillonA(base, a));
    const m = 0.006 * FS;
    for (const j of [jDe - m - 1000, jDe - m, jA + m, jA + m + 5000]) expect(out[j]).toBe(base.pcm[j]);
    const decal = Math.round(echantillonA(punch, tempsDe(base, 0)));
    for (const j of [jDe + m, jDe + 10000, jA - m]) expect(out[j]).toBe(punch.pcm[j + decal]);
    // Le repère tombe au temps 5,5 s (à un échantillon près).
    const ou = out.findIndex((v) => v === 1);
    expect(Math.abs(tempsDe(base, ou) - 5.5)).toBeLessThanOrEqual(1 / FS);
    // Aucun clic : le plus grand saut aux bords ne dépasse pas celui des sinus eux-mêmes (+5 %).
    const normal = Math.max(saut(base.pcm, 0, FS), saut(punch.pcm, 0, FS));
    const bord = Math.max(saut(out, jDe - 2 * m, jDe + 2 * m), saut(out, jA - 2 * m, jA + 2 * m));
    console.log(`punch : saut aux bords ${bord.toFixed(4)} (sinus seuls : ${normal.toFixed(4)})`);
    expect(bord).toBeLessThanOrEqual(normal * 1.05);
  });

  it('comping : la nouvelle prise contient exactement les bons passages (et du silence ailleurs)', () => {
    // 3 prises de la même section, ancrées à des mesures différentes et de latences différentes.
    const p = [
      { debutAncre: 10, debutCoupe: 2, decalage: 0.1, frequence: FS, pcm: Float32Array.from({ length: 12 * FS }, (_, i) => 1 + (i % 1000) / 1e4) },
      { debutAncre: 10, debutCoupe: 1.7, decalage: 0.093, frequence: FS, pcm: Float32Array.from({ length: 12 * FS }, (_, i) => 2 + (i % 1000) / 1e4) },
      { debutAncre: 12, debutCoupe: 2.1, decalage: 0.071, frequence: FS, pcm: Float32Array.from({ length: 12 * FS }, (_, i) => 3 + (i % 1000) / 1e4) },
    ];
    const passages = [
      { source: 1, de: 10, a: 12 },
      { source: 0, de: 12, a: 13 },
      { source: 2, de: 13, a: 15.5 },
      { source: 0, de: 16, a: 18 },
    ];
    const n = longueurAssemblage({ ...p[0]!, longueur: p[0]!.pcm.length }, passages);
    const out = assemblerPcm(p[0]!, p, passages, n);
    const marge = 0.006;
    for (let t = 9; t < 19; t += 0.0371) {
      const j = Math.round(echantillonA(p[0]!, t));
      const tj = tempsDe(p[0]!, j);
      const dedans = passages.find((x) => tj > x.de + marge && tj < x.a - marge);
      const loin = passages.every((x) => tj < x.de - marge || tj > x.a + marge);
      if (dedans) {
        const s = p[dedans.source]!;
        expect(out[j]).toBe(s.pcm[j + Math.round(echantillonA(s, tempsDe(p[0]!, 0)))]);
      } else if (loin) expect(out[j]).toBe(0);
    }
  });

  it('prise dérivée : nouvelle prise choisie, l’ancienne gardée (non choisie), nom suffixé, morceau valide', () => {
    const m = nouveauMorceau('trap', 'Test');
    const section = m.ordre[0]!;
    const prise: Prise = { id: 'abc', ancre: { section, occurrence: 0, mesure: 0 }, tempo: m.tempo, fichier: 'prise-abc.f32', frequence: FS, duree: 10, debutCoupe: 1, finCoupe: 10, decalage: 0.1, gain: 1, choisie: true, nom: 'Couplet' };
    const autre: Prise = { ...prise, id: 'def', fichier: 'prise-def.f32', choisie: false, nom: undefined };
    const m1 = { ...m, prises: [prise, autre] };
    const m2 = ajouterDerivee(m1, autre, 'prise-xyz.f32', '(nettoyée)');
    expect(m2.prises.map((x) => [x.id, x.choisie, x.nom])).toEqual([
      ['abc', false, 'Couplet'],
      ['def', false, undefined],
      ['xyz', true, 'Prise 2 (nettoyée)'],
    ]);
    expect(m2.prises[2]!.decalage).toBe(0.1);
    expect(m1.prises[0]!.choisie).toBe(true); // pur
    expect(normaliserMorceau(m2).problemes).toEqual([]);
  });
});
