import { describe, expect, it } from 'vitest';
import type { MotifAccords } from '../../morceau/types';
import { exempleMorceau, exemplePrise } from './exemple';
import {
  activerBasse,
  ajouterPrise,
  basseActive,
  choisirAccords,
  garderPrise,
  prisesDe,
  reglerFondu,
  reglerInfos,
  reglerMaster,
  reglerPiste,
  reglerSwing,
  reglerTempo,
  retirerPrise,
  suiteActive,
} from './reglages';

describe('tempo et swing', () => {
  it('borne et arrondit', () => {
    const m = exempleMorceau();
    expect(reglerTempo(m, 250).tempo).toBe(200);
    expect(reglerTempo(m, 87.6).tempo).toBe(88);
    expect(reglerTempo(m, 140)).toBe(m);
    expect(reglerTempo(m, NaN)).toBe(m);
    expect(reglerSwing(m, 0.9).swing).toBe(0.6);
  });
});

describe('accords et basse', () => {
  const suite: MotifAccords = { type: 'accords', pas: 32, accords: [{ pas: 0, duree: 32, degre: 'iv' }], son: 'nappe' };

  it('remplace la suite en gardant le son', () => {
    const m = choisirAccords(exempleMorceau(), suite);
    const a = m.motifs['accords-1'] as MotifAccords;
    expect(a.accords[0]!.degre).toBe('iv');
    expect(a.son).toBe('piano');
    expect(suiteActive(m, [{ motif: suite }])).toBe(0);
    expect(suiteActive(exempleMorceau(), [{ motif: suite }])).toBe(-1);
  });

  it('coupe puis remet la basse', () => {
    const m0 = exempleMorceau();
    expect(basseActive(m0)).toBe(true);
    const sans = activerBasse(m0, false);
    expect(basseActive(sans)).toBe(false);
    expect(sans.motifs['basse-1']).toBeDefined();
    expect(basseActive(activerBasse(sans, true))).toBe(true);
  });
});

describe('mélange, master, infos', () => {
  it('règle une piste en bornant', () => {
    const m = reglerPiste(exempleMorceau(), 'basse', { volume: 3, pan: -2, solo: true });
    const p = m.pistes.find((x) => x.id === 'basse')!;
    expect([p.volume, p.pan, p.solo]).toEqual([1.5, -1, true]);
  });

  it('master, fondu, titre et artiste', () => {
    const m0 = exempleMorceau();
    expect(reglerMaster(m0, { niveau: 'fort' }).master).toEqual({ preset: 'neutre', niveau: 'fort', chaine: 2 });
    expect(reglerMaster(m0, { niveau: 'standard' })).toBe(m0);
    expect(reglerFondu(m0, 12).fondu).toBe(8);
    const m = reglerInfos(m0, { titre: '  Nuit  ', artiste: 'Romain' });
    expect([m.titre, m.artiste]).toEqual(['Nuit', 'Romain']);
    expect(reglerInfos(m, { titre: '' }).titre).toBe('Nuit');
    expect(reglerInfos(m, { artiste: '' }).artiste).toBeUndefined();
  });
});

describe('prises', () => {
  it('une nouvelle prise est gardée, les autres de la section deviennent muettes', () => {
    let m = ajouterPrise(exempleMorceau(), exemplePrise('a', 'couplet', 0));
    m = ajouterPrise(m, exemplePrise('b', 'couplet', 0));
    m = ajouterPrise(m, exemplePrise('c', 'couplet', 1));
    expect(prisesDe(m, 'couplet', 0).map((p) => [p.id, p.choisie])).toEqual([
      ['a', false],
      ['b', true],
    ]);
    m = garderPrise(m, 'a');
    expect(prisesDe(m, 'couplet', 0).map((p) => p.choisie)).toEqual([true, false]);
    expect(prisesDe(m, 'couplet', 1)[0]!.choisie).toBe(true);
    expect(retirerPrise(m, 'a').prises).toHaveLength(2);
  });
});
