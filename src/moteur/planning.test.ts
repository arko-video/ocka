// Planning de la vague A (M1) : mélodie (temps exacts), relances des boucles, pads perso.
import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import { dureePas, pasVersSecondes } from '../morceau/temps';
import type { Morceau, MotifBatterie } from '../morceau/types';
import { calculerPlanning, GAIN_NOTE, type Evenement } from './planning';

function base(swing = 0): Morceau {
  const m = nouveauMorceau('trap');
  m.tempo = 120;
  m.swing = swing;
  return m;
}

const notes = (p: Evenement[]) => p.filter((e): e is Extract<Evenement, { type: 'note' }> => e.type === 'note');
const boucles = (p: Evenement[]) => p.filter((e): e is Extract<Evenement, { type: 'boucle' }> => e.type === 'boucle');

describe('planning de la mélodie', () => {
  it('temps et durées exacts (swing compris), motif répété sur la section, vélocité', () => {
    const m = base(0.25);
    m.motifs.mel = { type: 'melodie', pas: 16, son: 'pluck', notes: [{ pas: 0, duree: 3, midi: 60 }, { pas: 5, duree: 2, midi: 67, vel: 0.5 }, { pas: 15, duree: 1, midi: 72 }] };
    m.sections = [{ id: 'a', nom: 'Intro', mesures: 1, motifs: {} }, { id: 's', nom: 'Couplet', mesures: 2, motifs: { melodie: 'mel' } }];
    m.ordre = ['a', 's'];
    const n = notes(calculerPlanning(m));
    expect(n).toHaveLength(6);
    const attendu = [[16, 3, 60, 1], [21, 2, 67, 0.5], [31, 1, 72, 1], [32, 3, 60, 1], [37, 2, 67, 0.5], [47, 1, 72, 1]];
    attendu.forEach(([pas, duree, midi, vel], i) => {
      const e = n[i]!;
      expect(e.t).toBe(pasVersSecondes(m, pas!));
      expect(e.duree).toBeCloseTo(pasVersSecondes(m, pas! + duree!) - pasVersSecondes(m, pas!), 12);
      expect(e.midi).toBe(midi);
      expect(e.son).toBe('pluck');
      expect(e.vel).toBeCloseTo(GAIN_NOTE * vel!, 12);
    });
    // Swing : la note du pas 21 (impair) est retardée de 0,25 pas.
    expect(n[1]!.t).toBeCloseTo((21 + 0.25) * dureePas(120), 12);
  });

  it('motif plus long que la section : coupé à la fin de la section (note comprise)', () => {
    const m = base();
    m.motifs.mel = { type: 'melodie', pas: 32, son: 'piano', notes: [{ pas: 12, duree: 8, midi: 64 }, { pas: 20, duree: 4, midi: 65 }] };
    m.sections = [{ id: 's', nom: 'Couplet', mesures: 1, motifs: { melodie: 'mel' } }];
    m.ordre = ['s'];
    const n = notes(calculerPlanning(m));
    expect(n).toHaveLength(1);
    expect(n[0]!.duree).toBeCloseTo(4 * dureePas(120), 12);
  });

  it('un motif d’un autre type à la place de la mélodie est ignoré', () => {
    const m = base();
    m.sections = [{ id: 's', nom: 'Couplet', mesures: 1, motifs: { melodie: 'accords' } }];
    m.ordre = ['s'];
    expect(notes(calculerPlanning(m))).toHaveLength(0);
  });
});

describe('planning des boucles de sons importés', () => {
  it('relancée au début de la section puis toutes les N mesures ; la dernière s’arrête à la fin de la section', () => {
    const m = base(0.3);
    m.sections = [
      { id: 'i', nom: 'Intro', mesures: 2, motifs: {} },
      { id: 's', nom: 'Couplet', mesures: 5, motifs: {}, boucle: { son: 'x', mesures: 2, caler: true } },
    ];
    m.ordre = ['i', 's', 's'];
    const b = boucles(calculerPlanning(m));
    const mesure = 16 * dureePas(120);
    expect(b.map((e) => e.t / mesure)).toEqual([2, 4, 6, 7, 9, 11].map((x) => expect.closeTo(x, 9) as unknown as number));
    expect(b.map((e) => e.duree / mesure)).toEqual([2, 2, 1, 2, 2, 1].map((x) => expect.closeTo(x, 9) as unknown as number));
    expect(b.every((e) => e.son === 'x' && e.mesures === 2 && e.caler)).toBe(true);
  });
});

describe('pads perso dans la batterie', () => {
  it('perso1 à perso4 sont planifiés, sans changer l’humanisation des autres instruments', () => {
    const m = base();
    const avant = calculerPlanning(m).filter((e) => e.type === 'frappe');
    const bat = m.motifs['bat-couplet'] as MotifBatterie;
    bat.pistes.perso2 = new Array(bat.pas).fill(0).map((_, i) => (i % 8 === 4 ? 1 : 0));
    const apres = calculerPlanning(m).filter((e) => e.type === 'frappe');
    const perso = apres.filter((e) => e.type === 'frappe' && e.instrument === 'perso2');
    expect(perso.length).toBeGreaterThan(0);
    expect(apres.filter((e) => e.type === 'frappe' && e.instrument !== 'perso2')).toEqual(avant);
  });
});
