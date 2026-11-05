import { describe, expect, it } from 'vitest';
import type { SonImporte } from '../../morceau/types';
import { exempleMorceau } from './exemple';
import {
  affecterPad,
  ajouterSon,
  boucleProposee,
  dureeMesures,
  ecartDemiTons,
  instrumentsDuMorceau,
  mesuresProches,
  padLibre,
  reglerBoucle,
  sonDuPad,
} from './sons';

const son = (id: string, duree = 2): SonImporte => ({ id, nom: `Son ${id}`, fichier: `son-${id}.f32`, frequence: 48000, duree, canaux: 1 });

describe('tes sons', () => {
  it('ajoute un son puis le pose sur un pad : il apparaît dans les instruments', () => {
    const m = exempleMorceau();
    expect(instrumentsDuMorceau(m)).not.toContain('perso1');
    const m1 = ajouterSon(m, son('a'));
    expect(m1.sons).toHaveLength(1);
    expect(ajouterSon(m1, son('a'))).toBe(m1);
    expect(padLibre(m1)).toBe('perso1');
    const m2 = affecterPad(m1, 'perso2', 'a');
    expect(sonDuPad(m2, 'perso2')?.id).toBe('a');
    expect(instrumentsDuMorceau(m2).slice(-1)).toEqual(['perso2']);
    expect(padLibre(m2)).toBe('perso1');
    expect(affecterPad(m2, 'perso2', 'a')).toBe(m2);
    expect(affecterPad(m2, 'perso3', 'inconnu')).toBe(m2);
    const m3 = affecterPad(m2, 'perso2', null);
    expect(m3.pads).toEqual({});
    expect(instrumentsDuMorceau(m3)).not.toContain('perso2');
  });

  it('respecte les plafonds : 16 sons, 120 s au total', () => {
    let m = exempleMorceau();
    for (let i = 0; i < 20; i++) m = ajouterSon(m, son(`s${i}`, 1));
    expect(m.sons).toHaveLength(16);
    const long = ajouterSon(ajouterSon(exempleMorceau(), son('x', 100)), son('y', 30));
    expect(long.sons).toHaveLength(1);
  });
});

describe('boucles', () => {
  it('écart de hauteur quand on cale : 12·log2', () => {
    expect(ecartDemiTons(2, 2)).toBe(0);
    expect(ecartDemiTons(2, 4)).toBeCloseTo(-12); // étiré deux fois plus long : une octave plus grave
    expect(ecartDemiTons(2, 2 * 2 ** (1 / 12))).toBeCloseTo(-1);
    expect(ecartDemiTons(0, 2)).toBe(0);
  });

  it('propose la longueur la plus proche, calée si ça change peu la hauteur', () => {
    const m = exempleMorceau(); // 140 BPM : une mesure = 1,714 s
    expect(dureeMesures(140, 1)).toBeCloseTo(1.714, 3);
    expect(mesuresProches(3.5, 140)).toBe(2);
    expect(mesuresProches(50, 140)).toBe(8);
    expect(boucleProposee(m, son('a', 3.43))).toEqual({ son: 'a', mesures: 2, caler: true });
    expect(boucleProposee(m, son('b', 2.6))).toEqual({ son: 'b', mesures: 2, caler: false });
  });

  it('règle et retire la boucle d’une section', () => {
    const m = ajouterSon(exempleMorceau(), son('a'));
    const m1 = reglerBoucle(m, 'refrain', { son: 'a', mesures: 4, caler: true });
    expect(m1.sections.find((s) => s.id === 'refrain')!.boucle).toEqual({ son: 'a', mesures: 4, caler: true });
    expect(reglerBoucle(m1, 'refrain', { son: 'a', mesures: 4, caler: true })).toBe(m1);
    expect(reglerBoucle(m1, 'refrain', { son: 'zz', mesures: 4, caler: true })).toBe(m1);
    expect(reglerBoucle(m1, 'refrain', { son: 'a', mesures: 3 as 4, caler: true })).toBe(m1);
    const m2 = reglerBoucle(m1, 'refrain', null);
    expect('boucle' in m2.sections.find((s) => s.id === 'refrain')!).toBe(false);
    expect(reglerBoucle(m, 'inconnue', null)).toBe(m);
  });
});
