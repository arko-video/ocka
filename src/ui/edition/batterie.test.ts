import { describe, expect, it } from 'vitest';
import type { MotifBatterie } from '../../morceau/types';
import {
  basculerPas,
  etatCase,
  motifsBatterie,
  nomMotif,
  prochaineVelocite,
  reglerRoulement,
  varierMotif,
  VEL_DOUX,
  VEL_FORT,
} from './batterie';
import { exempleMorceau } from './exemple';
import { annuler, nouvelHistorique, pousser, remplacer, retablir } from './historique';

const motif = (m: ReturnType<typeof exempleMorceau>, id: string) => m.motifs[id] as MotifBatterie;

describe('cases de batterie', () => {
  it('fort → doux → vide → fort', () => {
    expect(prochaineVelocite(0)).toBe(VEL_FORT);
    expect(prochaineVelocite(1)).toBe(VEL_DOUX);
    expect(prochaineVelocite(0.8)).toBe(VEL_DOUX);
    expect(prochaineVelocite(0.5)).toBe(0);
    expect(etatCase(0.35)).toBe('doux');
  });

  it('bascule une case sans toucher au morceau de départ', () => {
    const m = exempleMorceau();
    const avant = JSON.stringify(m);
    const m1 = basculerPas(m, 'bat-couplet', 'kick', 4);
    expect(JSON.stringify(m)).toBe(avant);
    expect(motif(m1, 'bat-couplet').pistes.kick![4]).toBe(VEL_FORT);
    const m2 = basculerPas(m1, 'bat-couplet', 'kick', 4);
    expect(motif(m2, 'bat-couplet').pistes.kick![4]).toBe(VEL_DOUX);
    const m3 = basculerPas(m2, 'bat-couplet', 'kick', 4);
    expect(motif(m3, 'bat-couplet').pistes.kick![4]).toBe(0);
    expect(m3.motifs['bat-refrain']).toBe(m.motifs['bat-refrain']);
  });

  it('crée la ligne d’un instrument absent', () => {
    const m = basculerPas(exempleMorceau(), 'bat-intro', 'cowbell', 15);
    expect(motif(m, 'bat-intro').pistes.cowbell).toHaveLength(16);
    expect(motif(m, 'bat-intro').pistes.cowbell![15]).toBe(1);
  });

  it('ignore un pas hors du motif ou un motif inconnu', () => {
    const m = exempleMorceau();
    expect(basculerPas(m, 'bat-couplet', 'kick', 16)).toBe(m);
    expect(basculerPas(m, 'basse-1', 'kick', 0)).toBe(m);
  });

  it('vider une case retire son roulement', () => {
    let m = exempleMorceau();
    m = basculerPas(m, 'bat-couplet', 'charley', 6); // 0,8 → doux
    m = basculerPas(m, 'bat-couplet', 'charley', 6); // doux → vide
    expect(motif(m, 'bat-couplet').roulements!.charley![6]).toBe(0);
  });
});

describe('roulements', () => {
  it('règle ×2, ×3, ×4, ×6 et rend forte une case vide', () => {
    const m = reglerRoulement(exempleMorceau(), 'bat-couplet', 'charley', 1, 6);
    expect(motif(m, 'bat-couplet').roulements!.charley![1]).toBe(6);
    expect(motif(m, 'bat-couplet').pistes.charley![1]).toBe(1);
    const m2 = reglerRoulement(m, 'bat-couplet', 'charley', 1, 0);
    expect(motif(m2, 'bat-couplet').roulements!.charley![1]).toBe(0);
  });

  it('refuse une valeur interdite', () => {
    const m = exempleMorceau();
    expect(reglerRoulement(m, 'bat-couplet', 'charley', 1, 5 as never)).toBe(m);
  });
});

describe('Varier', () => {
  it('change le motif, de façon reproductible', () => {
    const m = exempleMorceau();
    const a = varierMotif(m, 'bat-refrain', 7);
    const b = varierMotif(m, 'bat-refrain', 7);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a.motifs['bat-refrain'])).not.toBe(JSON.stringify(m.motifs['bat-refrain']));
    expect(a.motifs['bat-couplet']).toBe(m.motifs['bat-couplet']);
    // Le premier temps du kick et la caisse claire principale restent.
    expect(motif(a, 'bat-refrain').pistes.kick![0]).toBeGreaterThan(0);
    expect(motif(a, 'bat-refrain').pistes.snare![8]).toBeGreaterThan(0);
    expect(varierMotif(m, 'basse-1', 7)).toBe(m);
  });
});

describe('motifs', () => {
  it('liste les motifs de batterie dans l’ordre de l’arrangement et les nomme', () => {
    const m = exempleMorceau();
    expect(motifsBatterie(m)).toEqual(['bat-intro', 'bat-couplet', 'bat-refrain', 'bat-pont']);
    expect(nomMotif(m, 'bat-couplet')).toBe('Couplet');
    expect(nomMotif(m, 'bat-pont')).toBe('Pont');
  });
});

describe('historique', () => {
  it('annule, rétablit et remplace sans créer d’étape', () => {
    const m0 = exempleMorceau();
    const m1 = { ...m0, tempo: 150 };
    const m2 = { ...m0, tempo: 151 };
    let h = pousser(nouvelHistorique(m0), m1);
    h = remplacer(h, m2);
    expect(h.passe).toHaveLength(1);
    h = annuler(h);
    expect(h.present).toBe(m0);
    expect(h.peutRetablir).toBe(true);
    expect(retablir(h).present).toBe(m2);
  });
});
