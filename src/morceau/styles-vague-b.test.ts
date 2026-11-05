// Les 6 styles donnent un morceau valide après le normaliseur ; phonk, pop et boom bap sont finis (vague B) ;
// trap, drill et lo-fi n'ont pas bougé (même morceau, même planning qu'avant la vague B).
import { describe, expect, it } from 'vitest';
import { calculerPlanning } from '../moteur/planning';
import { normaliserMorceau } from './normaliser';
import { nouveauMorceau, REGLAGES_STYLE, suitesAccords } from './styles';
import { BASSES, BATTERIES, SUITES } from './styles-motifs';
import { lireDegre } from './theorie';
import { STYLES, type MotifBatterie, type Style } from './types';

function fnv(texte: string): string {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
}

/** Empreintes relevées avant la vague B (morceau JSON, planning arrondi au µs). */
const AVANT: Record<string, [string, string]> = {
  trap: ['5dc447', 'e8f8999f'],
  drill: ['beaa4017', '9bd6e8cc'],
  lofi: ['3babd72d', 'd6dd9420'],
};

const empreintes = (s: Style): [string, string] => {
  const m = nouveauMorceau(s);
  const p = calculerPlanning(m).map((e) => [e.type, Math.round(e.t * 1e6), 'vel' in e ? Math.round(e.vel * 1e6) : 0, 'midi' in e ? e.midi : 0]);
  return [fnv(JSON.stringify(m)), fnv(JSON.stringify(p))];
};

describe('chaque style', () => {
  for (const s of STYLES) {
    it(`${s} : morceau complet, déjà normalisé (aucun problème, idempotent)`, () => {
      const m = nouveauMorceau(s);
      const r = normaliserMorceau(m);
      expect(r.problemes).toEqual([]);
      expect(r.morceau).toEqual(m);
      expect(normaliserMorceau(r.morceau).morceau).toEqual(r.morceau);
      expect(m.kit).toBe(`${s}@1`);
      expect(m.tempo).toBe(REGLAGES_STYLE[s].tempo);
      expect(m.tempo).toBeGreaterThanOrEqual(REGLAGES_STYLE[s].plage[0]);
      expect(m.tempo).toBeLessThanOrEqual(REGLAGES_STYLE[s].plage[1]);
      expect(suitesAccords(s)).toHaveLength(3);
      for (const suite of SUITES[s]) for (const d of suite.degres) expect(lireDegre(d), `${s} ${d}`).not.toBeNull();
      expect(calculerPlanning(m).length).toBeGreaterThan(300);
    });
    it(`${s} : 4 motifs de batterie, roulements seulement sur des frappes, lignes de 808`, () => {
      const b = BATTERIES[s]();
      for (const motif of [b.intro, b.couplet, b.refrain, b.pont] as MotifBatterie[]) {
        expect(motif.pas % 16).toBe(0);
        for (const [inst, r] of Object.entries(motif.roulements ?? {})) r!.forEach((x, i) => x > 0 && expect(motif.pistes[inst as 'charley']![i], `${s} ${inst} ${i}`).toBeGreaterThan(0));
      }
      const basse = BASSES[s]();
      expect(basse.couplet.notes.length).toBeGreaterThan(0);
      expect(basse.refrain.notes.length).toBeGreaterThan(0);
    });
  }
});

describe('styles de la vague B', () => {
  it('phonk : 135 BPM, mineur, cloche mélodique sur l’intro et le refrain, charley en triolets', () => {
    const m = nouveauMorceau('phonk');
    expect([m.tempo, m.tonalite.mode]).toEqual([135, 'mineur']);
    const mel = m.motifs['mel-cloche'];
    expect(mel?.type === 'melodie' && mel.son).toBe('cloche');
    expect(m.sections.filter((s) => s.motifs.melodie === 'mel-cloche').map((s) => s.id)).toEqual(['intro', 'refrain']);
    expect((m.motifs['bat-couplet'] as MotifBatterie).roulements?.charley?.filter((x) => x === 3).length).toBeGreaterThan(4);
  });
  it('pop : 110 BPM, majeur, clap sur 2 et 4, charley en croches, accords au piano', () => {
    const m = nouveauMorceau('pop');
    expect([m.tempo, m.tonalite.mode]).toEqual([110, 'majeur']);
    const c = m.motifs['bat-couplet'] as MotifBatterie;
    expect(c.pistes.clap!.map((v, i) => (v > 0.6 ? i % 16 : -1)).filter((i) => i >= 0)).toEqual([4, 12, 4, 12]);
    expect(c.pistes.charley!.every((v, i) => (i % 2 === 0) === v > 0)).toBe(true);
    expect(m.motifs.accords?.type === 'accords' && m.motifs.accords.son).toBe('piano');
  });
  it('boom bap : 90 BPM, swing 0,2, piano électrique, vinyle 2 fois par mesure', () => {
    const m = nouveauMorceau('boombap');
    expect([m.tempo, m.swing]).toEqual([90, 0.2]);
    expect(m.motifs.accords?.type === 'accords' && m.motifs.accords.son).toBe('piano');
    expect((m.motifs['bat-couplet'] as MotifBatterie).pistes.perc!.filter((v) => v > 0)).toHaveLength(4);
  });
  it('chaque style a son fill (différent de celui de la trap)', () => {
    const fill = (s: Style) => {
      const m = nouveauMorceau(s);
      const sec = m.sections.find((x) => x.id === 'intro')!;
      return calculerPlanning({ ...m, ordre: ['intro'], sections: [{ ...sec, motifs: {} }] }).filter((e) => e.type === 'frappe').map((e) => Math.round(e.t * 1000) / 1000).join(',');
    };
    const trap = fill('trap').split(',').length;
    expect(fill('phonk').split(',').length).not.toBe(trap);
    expect(fill('pop').split(',').length).toBe(6);
    expect(fill('boombap').split(',').length).toBe(3);
  });
  it('trap, drill et lo-fi : même morceau et même planning qu’avant la vague B', () => {
    for (const s of ['trap', 'drill', 'lofi'] as const) expect(empreintes(s), s).toEqual(AVANT[s]);
  });
});
