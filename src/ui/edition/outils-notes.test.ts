import { describe, expect, it } from 'vitest';
import { motifAccordsDe, motifNotesDe, pisteDe } from '../../morceau/acces';
import { notesAccord } from '../../morceau/theorie';
import { normaliserMorceau } from '../../morceau/normaliser';
import { BORNES_NOTE, GRILLE_PAS, type Morceau, type Note } from '../../morceau/types';
import { arpeger, gratter, humaniser, notesFantomes, poserAccord, quantifier, reglerGlisse, reglerSwingPiste, riffMachine } from './api-outils-notes';
import { exempleMorceau } from './exemple';
import { poserNotesAccord } from './notes';
import { ecartsGamme, STYLES } from './outils-notes-riff';
import { grouperAccords, ordreArpege } from './outils-notes';
import { ajouterPiste } from './pistes';

const base = (): { m: Morceau; p: string } => {
  const r = ajouterPiste(normaliserMorceau(exempleMorceau()).morceau, 'ocka-piano@1')!;
  return { m: r.m, p: r.id };
};
/** Accord de do majeur (4 pas) au pas 0 et de fa au pas 16. */
const avecAccords = () => {
  const { m, p } = base();
  const a = poserNotesAccord(m, p, 'intro', 0, 4, [60, 64, 67], 0.8);
  return { m: poserNotesAccord(a, p, 'intro', 16, 4, [65, 69, 72], 0.9), p };
};
const notes = (m: Morceau, p: string) => motifNotesDe(m, 'intro', p)!.notes;
const sain = (m: Morceau) => expect(normaliserMorceau(JSON.parse(JSON.stringify(m))).problemes).toEqual([]);
const surGrille = (ns: readonly Note[]) =>
  ns.every((n) => [n.pas, n.duree].every((x) => Math.abs(x * GRILLE_PAS - Math.round(x * GRILLE_PAS)) < 1e-9));
const valides = (ns: readonly Note[], longueur: number) => {
  expect(surGrille(ns)).toBe(true);
  for (const n of ns) {
    expect(n.pas).toBeGreaterThanOrEqual(0);
    expect(n.pas + n.duree).toBeLessThanOrEqual(longueur + 1e-9);
    expect(n.midi).toBeGreaterThanOrEqual(BORNES_NOTE.midiMin);
    expect(n.midi).toBeLessThanOrEqual(BORNES_NOTE.midiMax);
    expect(n.vel).toBeGreaterThanOrEqual(BORNES_NOTE.velMin);
    expect(n.vel).toBeLessThanOrEqual(BORNES_NOTE.velMax);
  }
};

describe('arpège', () => {
  it('haut, bas, haut-bas : ordre des hauteurs', () => {
    expect(ordreArpege([64, 60, 67], 'haut')).toEqual([60, 64, 67]);
    expect(ordreArpege([64, 60, 67], 'bas')).toEqual([67, 64, 60]);
    expect(ordreArpege([60, 64, 67, 72], 'haut-bas')).toEqual([60, 64, 67, 72, 67, 64]);
  });
  it('remplace chaque accord par son arpège, sur sa durée, notes valides, morceau sain', () => {
    const { m, p } = avecAccords();
    const r = arpeger(m, p, 'intro', null, { sens: 'haut', vitesse: 1, octaves: 1, tenue: 1, graine: 1 });
    const ns = notes(r, p);
    expect(ns.slice(0, 4).map((n) => [n.pas, n.midi])).toEqual([[0, 60], [1, 64], [2, 67], [3, 60]]);
    expect(ns.filter((n) => n.pas >= 16).map((n) => n.midi)).toEqual([65, 69, 72, 65]);
    valides(ns, 32);
    sain(r);
    expect(notes(m, p)).toHaveLength(6); // pas de mutation
  });
  it('octaves et vitesse (triolets) ; « hasard » : même graine → même résultat', () => {
    const { m, p } = avecAccords();
    const r2 = arpeger(m, p, 'intro', [0, 1, 2], { sens: 'haut', vitesse: 2 / 3, octaves: 2, tenue: 0.5, graine: 0 });
    const debut = notes(r2, p).filter((n) => n.pas < 4);
    expect(debut.map((n) => n.midi)).toEqual([60, 64, 67, 72, 76, 79]);
    valides(notes(r2, p), 32);
    const h = (g: number) => arpeger(m, p, 'intro', null, { sens: 'hasard', vitesse: 0.5, octaves: 3, tenue: 0.8, graine: g });
    expect(notes(h(42), p)).toEqual(notes(h(42), p));
    expect(notes(h(42), p)).not.toEqual(notes(h(43), p));
    sain(h(42));
  });
  it('sans note ou réglage illisible : même morceau', () => {
    const { m, p } = base();
    expect(arpeger(m, p, 'intro', null, { sens: 'haut', vitesse: 1, octaves: 1, tenue: 1, graine: 1 })).toBe(m);
    const a = avecAccords();
    expect(arpeger(a.m, a.p, 'intro', null, { sens: 'haut', vitesse: NaN, octaves: 1, tenue: 1, graine: 1 })).toBe(a.m);
    expect(arpeger(a.m, a.p, 'intro', [], { sens: 'haut', vitesse: 1, octaves: 1, tenue: 1, graine: 1 })).toBe(a.m);
  });
});

describe('strum', () => {
  it('décale les cordes de l’étalement (ms → pas au tempo, 1/24), même fin, sens', () => {
    const { m, p } = avecAccords();
    const r = gratter(m, p, 'intro', null, { sens: 'haut', etalement: 30 });
    const ecart = Math.round((0.03 / (60 / m.tempo / 4)) * 24) / 24;
    const premier = notes(r, p).filter((n) => n.pas < 4);
    expect(premier.map((n) => [n.pas, n.midi])).toEqual([[0, 60], [ecart, 64], [2 * ecart, 67]]);
    expect(premier.every((n) => Math.abs(n.pas + n.duree - 4) < 1e-9)).toBe(true);
    const bas = notes(gratter(m, p, 'intro', null, { sens: 'bas', etalement: 30 }), p).filter((n) => n.pas < 4);
    expect(bas.find((n) => n.pas === 0)!.midi).toBe(67);
    valides(notes(r, p), 32);
    sain(r);
  });
  it('étalement nul, borné à 120 ms ; un accord déjà gratté reste un accord pour l’arpège', () => {
    const { m, p } = avecAccords();
    expect(gratter(m, p, 'intro', null, { sens: 'haut', etalement: 0 })).toBe(m);
    expect(notes(gratter(m, p, 'intro', null, { sens: 'haut', etalement: 999 }), p)).toEqual(notes(gratter(m, p, 'intro', null, { sens: 'haut', etalement: 120 }), p));
    const g = gratter(m, p, 'intro', null, { sens: 'haut', etalement: 20 });
    expect(grouperAccords(notes(g, p))).toHaveLength(2);
  });
});

describe('humaniser', () => {
  it('déterministe (graine), bornes ±1/4 de pas et ±25 %, notes valides', () => {
    const { m, p } = avecAccords();
    const r = (g: number) => humaniser(m, p, 'intro', null, { timing: 1, velocite: 1, graine: g });
    expect(notes(r(7), p)).toEqual(notes(r(7), p));
    expect(notes(r(7), p)).not.toEqual(notes(r(8), p));
    const avant = notes(m, p);
    for (const n of notes(r(7), p)) {
      const o = avant.find((x) => x.midi === n.midi && Math.abs(x.pas - n.pas) <= 0.25 + 1e-9);
      expect(o).toBeDefined();
      expect(Math.abs(n.vel / o!.vel - 1)).toBeLessThanOrEqual(0.25 + 0.01);
    }
    valides(notes(r(7), p), 32);
    sain(r(7));
    expect(humaniser(m, p, 'intro', null, { timing: 0, velocite: 0, graine: 1 })).toBe(m);
  });
});

describe('quantification avec force (C1, ré-exportée)', () => {
  it('50 % rapproche à mi-chemin', () => {
    const { m, p } = base();
    const a = poserNotesAccord(m, p, 'intro', 1 + 1 / 3, 1, [60]);
    expect(notes(quantifier(a, p, 'intro', null, 4, 0.5), p)[0]!.pas).toBeCloseTo(Math.round(((4 / 3 + 0) / 2) * 24) / 24);
  });
  it('poserAccord (ré-exporté) reste une étape', () => {
    const { m, p } = base();
    expect(notes(poserAccord(m, p, 'intro', 0, 4, 'I'), p)).toHaveLength(3);
  });
});

describe('glissé et swing de la piste', () => {
  it('glissé mis et retiré, morceau sain, même objet si rien ne change', () => {
    const { m, p } = avecAccords();
    const r = reglerGlisse(m, p, 'intro', [0], true);
    expect(notes(r, p)[0]!.glisse).toBe(true);
    sain(r);
    expect(reglerGlisse(r, p, 'intro', [0], true)).toBe(r);
    const sans = reglerGlisse(r, p, 'intro', [0], false);
    expect('glisse' in notes(sans, p)[0]!).toBe(false);
    expect(reglerGlisse(m, p, 'intro', [99], true)).toBe(m);
  });
  it('swing propre à la piste : borné 0–0,6, null = celui du morceau', () => {
    const { m, p } = base();
    const r = reglerSwingPiste(m, p, 0.9);
    expect((pisteDe(r, p) as { swing?: number }).swing).toBe(0.6);
    sain(r);
    expect(reglerSwingPiste(r, p, 0.6)).toBe(r);
    const sans = reglerSwingPiste(r, p, null);
    expect('swing' in pisteDe(sans, p)!).toBe(false);
    expect(reglerSwingPiste(m, 'batterie', 0.2)).toBe(m);
    expect(reglerSwingPiste(m, p, NaN)).toBe(m);
  });
});

describe('riff machine', () => {
  const regl = { graine: 3, gamme: 'morceau' as const, style: 'rebondi' as const, densite: 0.6 };
  it('déterministe, dans la gamme, notes valides, morceau sain, pour chaque style et gamme', () => {
    const { m, p } = base();
    for (const style of Object.keys(STYLES) as (keyof typeof STYLES)[])
      for (const gamme of ['morceau', 'pentatonique', 'blues', 'harmonique'] as const) {
        const r = riffMachine(m, p, 'intro', { ...regl, style, gamme });
        const ns = notes(r, p);
        expect(ns.length).toBeGreaterThan(0);
        expect(notes(riffMachine(m, p, 'intro', { ...regl, style, gamme }), p)).toEqual(ns);
        const tonique = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(m.tonalite.tonique);
        const ecarts = ecartsGamme(gamme, m.tonalite.mode);
        expect(ns.every((n) => ecarts.includes((((n.midi - tonique) % 12) + 12) % 12))).toBe(true);
        expect(ns[0]!.pas).toBe(0);
        valides(ns, 32);
        sain(r);
      }
  });
  it('temps forts sur une note de l’accord ; mouvements surtout conjoints ; densité', () => {
    const { m, p } = base();
    const ns = notes(riffMachine(m, p, 'intro', { ...regl, style: 'rapide', densite: 1 }), p);
    // Temps forts (sauf la note finale, qui se pose sur la tonique) : une note de l'accord joué à ce moment.
    const accords = motifAccordsDe(m, 'intro')!;
    const accordAu = (pas: number) => {
      const i = pas % accords.pas;
      const a = accords.accords.find((x) => i >= x.pas && i < x.pas + x.duree)!;
      return notesAccord(m.tonalite.tonique, m.tonalite.mode, a.degre).map((x) => x % 12);
    };
    for (const n of ns.slice(0, -1)) if (n.pas % 4 === 0) expect(accordAu(n.pas)).toContain(n.midi % 12);
    const sauts = ns.slice(1).map((n, i) => Math.abs(n.midi - ns[i]!.midi));
    expect(sauts.filter((s) => s <= 5).length / sauts.length).toBeGreaterThan(0.7);
    const peu = notes(riffMachine(m, p, 'intro', { ...regl, densite: 0.1 }), p).length;
    const beaucoup = notes(riffMachine(m, p, 'intro', { ...regl, densite: 1 }), p).length;
    expect(peu).toBeLessThan(beaucoup);
    expect(riffMachine(m, p, 'intro', { ...regl, densite: NaN })).toBe(m);
  });
});

describe('notes fantômes', () => {
  it('les notes des autres pistes instrument de la section, pas celles de la piste', () => {
    const { m, p } = avecAccords();
    const r2 = ajouterPiste(m, 'ocka-lead@1')!;
    const a = poserNotesAccord(r2.m, r2.id, 'intro', 8, 2, [72]);
    expect(notesFantomes(a, p, 'intro')).toEqual([{ piste: r2.id, pas: 32, notes: [{ pas: 8, duree: 2, midi: 72, vel: 1 }] }]);
    expect(notesFantomes(a, r2.id, 'intro').map((f) => f.piste)).toEqual([p]);
    expect(notesFantomes(a, p, 'inconnue')).toEqual([]);
  });
});
