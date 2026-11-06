// Planning multipiste (M1, C1) : N pistes instrument par les accesseurs, swing par piste, glissé, vélocité de note.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../morceau/normaliser';
import { nouveauMorceau } from '../morceau/styles';
import { pasVersSecondes } from '../morceau/temps';
import type { Morceau, PisteInstrument } from '../morceau/types';
import { calculerPlanning, evenementsEntre, type Evenement } from './planning';

type EvNote = Extract<Evenement, { type: 'note' }>;
const notes = (p: Evenement[]) => p.filter((e): e is EvNote => e.type === 'note');

function piste(id: string, instrument: string, swing?: number): PisteInstrument {
  return { id, genre: 'instrument', nom: id, instrument, volume: 0.8, pan: 0, muet: false, solo: false, ...(swing === undefined ? {} : { swing }) };
}

/** 16 pistes instrument (le plafond), chacune avec son motif dans la section. */
function seizePistes(): Morceau {
  const m = nouveauMorceau('trap');
  m.tempo = 120;
  m.swing = 0;
  const ids = Array.from({ length: 16 }, (_, i) => `p${i}`);
  const fixes = m.pistes.filter((p) => p.genre !== 'instrument');
  m.pistes = [...fixes.slice(0, 3), ...ids.map((id, i) => piste(id, i % 2 ? 'vcsl-marimba@1' : 'ocka-pluck@1')), ...fixes.slice(3)];
  const motifs = Object.create(null) as Record<string, string>;
  for (const [i, id] of ids.entries()) {
    m.motifs[`m-${id}`] = { type: 'notes', pas: 16, notes: [{ pas: i % 16, duree: 2, midi: 48 + i, vel: 0.5 + i / 40 }] };
    motifs[id] = `m-${id}`;
  }
  m.sections = [{ id: 's', nom: 'Couplet', mesures: 2, motifs }];
  m.ordre = ['s'];
  return m;
}

describe('planning de N pistes instrument', () => {
  it('16 pistes : chaque piste joue son motif, avec son instrument ; sons v1 et instruments échantillonnés', () => {
    const m = seizePistes();
    expect(normaliserMorceau(m).problemes.filter((p) => p.niveau === 'bloquant')).toEqual([]);
    const n = notes(calculerPlanning(m));
    expect(n).toHaveLength(32);
    for (let i = 0; i < 16; i++) {
      const de = n.filter((e) => e.piste === `p${i}`);
      expect(de.map((e) => e.t)).toEqual([pasVersSecondes(m, i), pasVersSecondes(m, 16 + i)]);
      expect(de[0]!.midi).toBe(48 + i);
      expect(de[0]!.velNote).toBeCloseTo(0.5 + i / 40, 12);
      expect(de[0]!.son).toBe(i % 2 ? null : 'pluck');
      expect(de[0]!.instrument).toBe(i % 2 ? 'vcsl-marimba@1' : 'ocka-pluck@1');
    }
    // Trié par temps, et la fenêtre de 200 ms de l'écoute les retrouve toutes.
    const p = calculerPlanning(m);
    for (let i = 1; i < p.length; i++) expect(p[i]!.t).toBeGreaterThanOrEqual(p[i - 1]!.t);
    let vues = 0;
    for (let t = 0; t < 4; t += 0.2) vues += notes(evenementsEntre(p, t, t + 0.2)).length;
    expect(vues).toBe(32);
  });

  it('swing propre à une piste ; les autres gardent celui du morceau', () => {
    const m = seizePistes();
    m.swing = 0.1;
    m.pistes = m.pistes.map((p) => (p.id === 'p1' ? { ...p, swing: 0.5 } : p));
    const n = notes(calculerPlanning(m));
    const p1 = n.find((e) => e.piste === 'p1')!; // pas 1 (impair)
    const p3 = n.find((e) => e.piste === 'p3')!;
    expect(p1.t).toBeCloseTo(pasVersSecondes({ tempo: 120, swing: 0.5 }, 1), 12);
    expect(p3.t).toBeCloseTo(pasVersSecondes(m, 3), 12);
  });

  it('glissé vers la note suivante de la piste (même au bouclage du motif) ; pas de glissé vers la même note', () => {
    const m = seizePistes();
    m.motifs['m-p0'] = {
      type: 'notes',
      pas: 16,
      notes: [{ pas: 0, duree: 4, midi: 60, vel: 1, glisse: true }, { pas: 4, duree: 4, midi: 67, vel: 1, glisse: true }, { pas: 8, duree: 4, midi: 67, vel: 1 }, { pas: 12, duree: 4, midi: 65, vel: 1, glisse: true }],
    };
    const n = notes(calculerPlanning(m)).filter((e) => e.piste === 'p0');
    expect(n.map((e) => e.glisse)).toEqual([67, undefined, undefined, 60, 67, undefined, undefined, undefined]);
  });

  it('les morceaux /2 (sans swing de piste, sans glissé) gardent exactement le même planning', () => {
    const m = nouveauMorceau('lofi');
    const p = notes(calculerPlanning(m));
    for (const e of p) {
      expect(e.glisse).toBeUndefined();
      expect(e.vel).toBeCloseTo(0.8 * e.velNote, 12);
    }
  });
});
