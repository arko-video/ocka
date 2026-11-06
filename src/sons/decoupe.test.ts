import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../morceau/normaliser';
import type { Morceau, SonImporte } from '../morceau/types';
import { exempleMorceau } from '../ui/edition/exemple';
import { attaques, decouperAttaques, decouperEgal, poserDecoupes, tranchesVersPads } from './decoupe';
import { boucleBatterie } from './signaux-test';

const son = (id: string, duree = 2): SonImporte => ({ id, nom: `Son ${id}`, fichier: `son-${id}.f32`, frequence: 44100, duree, canaux: 1 });
const avecSon = (duree = 2): Morceau => ({ ...exempleMorceau(), sons: [son('a', duree)] });

/** Clics (salves amorties de 440 Hz) aux instants donnés. */
function clics(instants: number[], duree: number, sr = 44100) {
  const x = new Float32Array(Math.round(duree * sr));
  for (const t of instants) {
    const d = Math.round(t * sr);
    for (let k = 0; k < sr * 0.3 && d + k < x.length; k++) x[d + k]! += 0.8 * Math.sin((2 * Math.PI * 440 * k) / sr) * Math.exp((-k / sr) * 30);
  }
  return { frequence: sr, canaux: [x] };
}

describe('découpe aux attaques', () => {
  it('trouve chaque attaque à 5 ms près', () => {
    const t = [0.25, 0.6, 1.0, 1.37, 1.8];
    const trouvees = attaques(clics(t, 2.2), 0.6);
    expect(trouvees).toHaveLength(t.length);
    trouvees.forEach((x, i) => expect(Math.abs(x - t[i]!)).toBeLessThan(0.005));
  });
  it('la sensibilité règle le nombre d’attaques ; les découpes couvrent tout le son, sans trou', () => {
    const pcm = boucleBatterie(92, 2);
    const peu = decouperAttaques(pcm, 0.1);
    const beaucoup = decouperAttaques(pcm, 1);
    expect(beaucoup.length).toBeGreaterThanOrEqual(peu.length);
    expect(beaucoup.length).toBeGreaterThanOrEqual(15); // 16 croches en 2 mesures
    const duree = pcm.canaux[0]!.length / pcm.frequence;
    for (const d of [peu, beaucoup]) {
      expect(d[0]!.debut).toBe(0);
      expect(d[d.length - 1]!.fin).toBeCloseTo(duree, 6);
      for (let i = 1; i < d.length; i++) expect(d[i]!.debut).toBe(d[i - 1]!.fin);
    }
  });
  it('un silence ou un son vide ne donne rien (jamais d’erreur)', () => {
    expect(decouperAttaques({ frequence: 44100, canaux: [new Float32Array(44100)] }, 1)).toEqual([{ debut: 0, fin: 1 }]);
    expect(decouperAttaques({ frequence: 44100, canaux: [new Float32Array(0)] }, 1)).toEqual([]);
  });
});

describe('découpe en parts égales et pads', () => {
  it('N parts égales, bornées de 2 à 64', () => {
    const d = decouperEgal(2, 8);
    expect(d).toHaveLength(8);
    expect(d[3]).toEqual({ debut: 0.75, fin: 1 });
    expect(decouperEgal(2, 1000)).toHaveLength(64);
    expect(decouperEgal(2, 0)).toHaveLength(2);
    expect(decouperEgal(0, 4)).toEqual([]);
  });
  it('poserDecoupes : pur, même objet si rien ne change, normaliseur sans problème', () => {
    const m = avecSon();
    const m1 = poserDecoupes(m, 'a', decouperEgal(2, 8));
    expect(m1).not.toBe(m);
    expect(m.sons![0]!.tranches).toBeUndefined();
    expect(m1.sons![0]!.tranches).toHaveLength(8);
    expect(poserDecoupes(m1, 'a', decouperEgal(2, 8))).toBe(m1);
    expect(poserDecoupes(m1, 'inconnu', [])).toBe(m1);
    expect(normaliserMorceau(m1).problemes).toEqual([]);
  });
  it('tranchesVersPads remplit les 4 pads perso (à partir de la découpe choisie) ; moins de découpes = pads gardés', () => {
    const m = poserDecoupes(avecSon(), 'a', decouperEgal(2, 8));
    const m1 = tranchesVersPads(m, 'a', 4);
    expect(m1.pads).toEqual({ perso1: 'a', perso2: 'a', perso3: 'a', perso4: 'a' });
    expect(m1.tranchesPads).toEqual({ perso1: 4, perso2: 5, perso3: 6, perso4: 7 });
    expect(tranchesVersPads(m1, 'a', 4)).toBe(m1);
    expect(tranchesVersPads(m, 'a', 6, ['perso3', 'perso4', 'perso1']).tranchesPads).toEqual({ perso3: 6, perso4: 7 });
    expect(tranchesVersPads(m, 'a', 99)).toBe(m);
    expect(normaliserMorceau(m1).problemes).toEqual([]);
    // Moins de découpes : les pads qui jouaient une découpe disparue jouent le son entier.
    const m2 = poserDecoupes(m1, 'a', decouperEgal(2, 6));
    expect(m2.tranchesPads).toEqual({ perso1: 4, perso2: 5 });
    expect(poserDecoupes(m2, 'a', []).tranchesPads).toBeUndefined();
    expect(normaliserMorceau(m2).problemes).toEqual([]);
  });
});
