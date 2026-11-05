import { describe, expect, it } from 'vitest';
import { basculerEffet, effetActif, effetsVoix, NIVEAU_DEFAUT, reglerChaine, reglerNiveauEffet } from './effets';
import { exempleMorceau } from './exemple';
import { idLibre, nettoyerId } from './ids';
import { nouvelId } from './sections';
import { REGLE_ID } from '../../morceau/types';

describe('effets de la voix', () => {
  it('allume et éteint les pastilles', () => {
    let m = basculerEffet(exempleMorceau(), 'echo');
    expect(effetsVoix(m)).toEqual({ echo: NIVEAU_DEFAUT.echo });
    m = basculerEffet(m, 'radio');
    expect(effetActif(effetsVoix(m), 'radio')).toBe(true);
    m = basculerEffet(basculerEffet(m, 'echo'), 'radio');
    expect('effets' in m.pistes.find((p) => p.id === 'voix')!).toBe(false);
  });

  it('curseurs de Réverbe et Écho : 0,05 à 1, au centième', () => {
    const m = reglerNiveauEffet(exempleMorceau(), 'reverbe', 0.456);
    expect(effetsVoix(m).reverbe).toBe(0.46);
    expect(effetsVoix(reglerNiveauEffet(m, 'reverbe', 0)).reverbe).toBe(0.05);
    expect(effetsVoix(reglerNiveauEffet(m, 'reverbe', 3)).reverbe).toBe(1);
    expect(reglerNiveauEffet(m, 'reverbe', 0.46)).toBe(m);
    expect(reglerNiveauEffet(m, 'reverbe', Number.NaN)).toBe(m);
  });

  it('garde les autres réglages de la voix (préréglage, autotune)', () => {
    const m0 = exempleMorceau();
    m0.pistes = m0.pistes.map((p) => (p.id === 'voix' ? { ...p, preset: 'rap', effets: { autotune: 0.5 } } : p));
    const v = basculerEffet(m0, 'doubler').pistes.find((p) => p.id === 'voix')!;
    expect(v.preset).toBe('rap');
    expect(v.effets).toEqual({ autotune: 0.5, doubler: true });
  });

  it('passer au nouveau son : chaîne 2', () => {
    const m = exempleMorceau();
    const ancien = { ...m, master: { ...m.master, chaine: 1 as const } };
    expect(reglerChaine(ancien, 2).master.chaine).toBe(2);
    expect(reglerChaine(m, 2)).toBe(m);
  });
});

describe('ids neufs', () => {
  it('conformes à REGLE_ID, 36 caractères au plus, jamais un nom réservé', () => {
    const long = 'Une section au nom vraiment très très long pour voir';
    const m = exempleMorceau();
    const id = nouvelId(m, long);
    expect(id).toMatch(REGLE_ID);
    expect(id.length).toBeLessThanOrEqual(36);
    const pris = [id];
    for (let i = 0; i < 12; i++) pris.push(idLibre(long, pris));
    expect(new Set(pris).size).toBe(13);
    for (const x of pris) expect(x.length).toBeLessThanOrEqual(36);
    expect(nouvelId(m, 'Constructor')).toBe('section');
    expect(nouvelId(m, '♫♫')).toBe('section');
    expect(nouvelId(m, 'Refrain')).toBe('refrain-2');
    expect(nettoyerId('Été — Pont')).toBe('ete-pont');
  });
});
