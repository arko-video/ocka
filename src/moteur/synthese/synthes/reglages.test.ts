// Réglages d'une piste synthé (L) : édition pure (même objet si rien ne change, crans, millièmes, clés connues
// seulement), onde dessinée (rééchantillonnée à 64 points), acceptées par le normaliseur ; tables d'onde par octave.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../../../morceau/normaliser';
import { nouveauMorceau } from '../../../morceau/styles';
import type { Morceau, PisteInstrument } from '../../../morceau/types';
import { ajouterPiste } from '../../../ui/edition/api-edition';
import { dessinerOnde, reglerParamSynthe, tablesOnde } from './reglages';
import { fft } from '../../../enregistrement/calcul-calibrage';
import { NB_TABLES, plafondTable, TAILLE_TABLE } from './tables';

function avec(instrument: string): { m: Morceau; id: string } {
  return ajouterPiste(nouveauMorceau('trap'), instrument)!;
}
const piste = (m: Morceau, id: string) => m.pistes.find((p) => p.id === id) as PisteInstrument;

describe('reglerParamSynthe', () => {
  it('règle, arrondit au cran et au millième, garde le même objet si rien ne change', () => {
    const { m, id } = avec('ocka-303@1');
    const a = reglerParamSynthe(m, id, 'resonance', 0.91234);
    expect(piste(a, id).synthe?.params?.resonance).toBe(0.912);
    expect(reglerParamSynthe(a, id, 'resonance', 0.9121)).toBe(a);
    const b = reglerParamSynthe(a, id, 'onde', 0.7);
    expect(piste(b, id).synthe?.params?.onde).toBe(1);
    expect(reglerParamSynthe(b, id, 'inconnu', 0.5)).toBe(b);
    expect(reglerParamSynthe(b, id, 'coupure', Number.NaN)).toBe(b);
    expect(reglerParamSynthe(b, 'pas-une-piste', 'coupure', 0.2)).toBe(b);
    expect(normaliserMorceau(JSON.parse(JSON.stringify(b))).problemes).toEqual([]);
  }, 60_000);

  it('ne touche pas une piste qui n’est pas un synthé à réglages', () => {
    const { m, id } = avec('vcsl-marimba@1');
    expect(reglerParamSynthe(m, id, 'coupure', 0.5)).toBe(m);
  }, 60_000);
});

describe('dessinerOnde', () => {
  it('64 points bornés, rééchantillonnés ; même objet si rien ne change ; le normaliseur l’accepte', () => {
    const { m, id } = avec('ocka-onde@1');
    const a = dessinerOnde(m, id, [0, 2, 0, -2]);
    const o = piste(a, id).synthe!.onde!;
    expect(o).toHaveLength(64);
    expect(Math.max(...o)).toBe(1);
    expect(Math.min(...o)).toBe(-1);
    expect(dessinerOnde(a, id, o)).toBe(a);
    const b = reglerParamSynthe(a, id, 'tenue', 0.2);
    expect(piste(b, id).synthe!.onde).toEqual(o);
    expect(normaliserMorceau(JSON.parse(JSON.stringify(b))).problemes).toEqual([]);
    const { m: m2, id: id2 } = avec('ocka-303@1');
    expect(dessinerOnde(m2, id2, o)).toBe(m2);
  }, 60_000);
});

describe('tablesOnde', () => {
  it('une table par octave, de moins en moins d’harmoniques', () => {
    const t = tablesOnde(Array.from({ length: 64 }, (_, i) => (i < 32 ? 1 : -1)));
    expect(t).toHaveLength(NB_TABLES);
    for (const x of t) expect(x.length).toBe(TAILLE_TABLE + 1);
    // La table k n'a aucune harmonique au-dessus de 24 kHz / (40 Hz × 2^k) : rien ne se replie à 48 kHz.
    for (let k = 0; k < NB_TABLES; k++) {
      const re = Float64Array.from(t[k]!.subarray(0, TAILLE_TABLE));
      const im = new Float64Array(TAILLE_TABLE);
      fft(re, im);
      const hMax = Math.floor(24000 / plafondTable(k));
      let dedans = 0;
      let dehors = 0;
      for (let h = 1; h < TAILLE_TABLE / 2; h++)
        h <= hMax ? (dedans += re[h]! ** 2 + im[h]! ** 2) : (dehors += re[h]! ** 2 + im[h]! ** 2);
      expect(dehors / dedans, `table ${k}`).toBeLessThan(1e-12);
    }
  }, 60_000);
});
