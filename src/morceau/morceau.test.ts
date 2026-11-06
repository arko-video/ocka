import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from './normaliser';
import { nouveauMorceau, suitesAccords, varier } from './styles';
import { arrangement, dureeMorceau, pasVersSecondes, positionAncre, secondesVersPas } from './temps';
import { demiTonsDegre, frequenceMidi, lireDegre, lireTonique, notesAccord, voicingProche, voicingsSuite } from './theorie';
import type { MotifBatterie, Style } from './types';

describe('théorie', () => {
  it('fréquences MIDI', () => {
    expect(frequenceMidi(69)).toBeCloseTo(440, 6);
    expect(frequenceMidi(60)).toBeCloseTo(261.626, 2);
  });
  it('gammes majeure et mineure', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => demiTonsDegre('majeur', d))).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => demiTonsDegre('mineur', d))).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(demiTonsDegre('mineur', 7)).toBe(12);
    expect(demiTonsDegre('mineur', -1)).toBe(-2);
  });
  it('degrés romains : triades et 7e', () => {
    expect(notesAccord('C', 'majeur', 'I')).toEqual([60, 64, 67]);
    expect(notesAccord('A', 'mineur', 'i')).toEqual([69, 72, 76]);
    expect(notesAccord('A', 'mineur', 'VI')).toEqual([65, 69, 72]); // fa majeur
    expect(notesAccord('C', 'majeur', 'V7')).toEqual([67, 71, 74, 77]); // sol 7
    expect(notesAccord('C', 'majeur', 'Imaj7')).toEqual([60, 64, 67, 71]);
    expect(notesAccord('C', 'majeur', 'ii7')).toEqual([62, 65, 69, 72]);
    expect(notesAccord('C', 'majeur', 'vii°')).toEqual([71, 74, 77]);
    expect(notesAccord('C', 'mineur', 'bII')).toEqual([61, 65, 68]);
    expect(lireDegre('Vi')).toBeNull();
    expect(lireDegre('X')).toBeNull();
  });
  it('voicings proches : peu de mouvement', () => {
    const [a, b] = voicingsSuite('C', 'majeur', ['I', 'IV']);
    const ecart = a!.reduce((s, n, i) => s + Math.abs(n - b![i]!), 0);
    expect(ecart).toBeLessThanOrEqual(4);
    const v = voicingProche([60, 64, 67], null);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(52);
    expect(Math.max(...v)).toBeLessThanOrEqual(76);
  });
  it('toniques écrites librement', () => {
    expect(lireTonique('Bb')).toBe('A#');
    expect(lireTonique('sol')).toBe('G');
    expect(lireTonique('f#')).toBe('F#');
    expect(lireTonique('H')).toBeNull();
  });
});

describe('temps', () => {
  const m = nouveauMorceau('trap');
  it("durée de l'arrangement par défaut (40 mesures)", () => {
    expect(arrangement(m).map((o) => o.section.mesures)).toEqual([4, 8, 8, 8, 8, 4]);
    expect(dureeMorceau(m)).toBeCloseTo((40 * 4 * 60) / 140, 9);
  });
  it('swing : les pas impairs sont retardés, aller-retour exact', () => {
    const s = { tempo: 120, swing: 0.5 };
    const d = 60 / 120 / 4;
    expect(pasVersSecondes(s, 0)).toBe(0);
    expect(pasVersSecondes(s, 1)).toBeCloseTo(1.5 * d, 9);
    expect(pasVersSecondes(s, 2)).toBeCloseTo(2 * d, 9);
    for (const p of [0, 0.5, 1, 1.25, 3.7, 17]) expect(secondesVersPas(s, pasVersSecondes(s, p))).toBeCloseTo(p, 9);
  });
  it("position d'une ancre de prise", () => {
    const d = 60 / 140 / 4;
    expect(positionAncre(m, { section: 'couplet', occurrence: 1, mesure: 2 })).toBeCloseTo((4 + 8 + 8 + 2) * 16 * d, 9);
    expect(positionAncre(m, { section: 'couplet', occurrence: 5, mesure: 0 })).toBeNull();
  });
});

describe('styles', () => {
  for (const style of ['trap', 'drill', 'lofi'] as Style[]) {
    it(`${style} : morceau complet et déjà normalisé`, () => {
      const m = nouveauMorceau(style);
      const r = normaliserMorceau(m);
      expect(r.problemes).toEqual([]);
      expect(r.morceau).toEqual(m);
      expect(m.ordre).toEqual(['intro', 'couplet', 'refrain', 'couplet', 'refrain', 'outro']);
      expect(suitesAccords(style)).toHaveLength(3);
      expect(m.pistes.every((p) => p.volume > 0) && m.master.niveau).toBe('standard');
    });
  }
  it('roulements de charley en trap et en drill, pas en lo-fi', () => {
    const roul = (s: Style) => (nouveauMorceau(s).motifs['bat-refrain'] as MotifBatterie).roulements?.charley?.some((r) => r > 0) ?? false;
    expect(roul('trap')).toBe(true);
    expect(roul('drill')).toBe(true);
    expect(roul('lofi')).toBe(false);
  });
  it('glissés de 808 en drill', () => {
    const b = nouveauMorceau('drill').motifs['basse-couplet'];
    expect(b?.type === 'basse' && b.notes.some((n) => n.glisse)).toBe(true);
  });
  it('varier : déterministe, garde le kick du 1er pas et la caisse claire', () => {
    const motif = nouveauMorceau('trap').motifs['bat-couplet'] as MotifBatterie;
    const a = varier(motif, 7);
    expect(varier(motif, 7)).toEqual(a);
    expect(a).not.toEqual(motif);
    expect(a.pistes.kick![0]).toBe(1);
    expect(a.pistes.snare![8]).toBe(1);
    expect(motif.pistes.kick).toEqual((nouveauMorceau('trap').motifs['bat-couplet'] as MotifBatterie).pistes.kick); // original intact
  });
});

describe('normaliseur', () => {
  it('corrige au lieu de rejeter, en français', () => {
    const m = nouveauMorceau('trap') as unknown as Record<string, unknown>;
    const r = normaliserMorceau({
      ...m,
      tempo: 400,
      swing: '0,3',
      style: 'TRAP',
      tonalite: { tonique: 'Bb', mode: 'mineur' },
      kit: 'inconnu',
      inconnu: 1,
      pistes: [{ id: 'basse', volume: 9, pan: 0, muet: false, solo: false }],
      master: { preset: 'radio', niveau: 'fort' },
    });
    expect(r.bloquant).toBe(false);
    expect(r.morceau.tempo).toBe(200);
    expect(r.morceau.swing).toBe(0.3);
    expect(r.morceau.style).toBe('trap');
    expect(r.morceau.tonalite.tonique).toBe('A#');
    expect(r.morceau.kit).toBe('trap@1');
    // Format /3 : les 5 pistes fixes sont toujours là ; une piste instrument absente du fichier n'est pas recréée.
    expect(r.morceau.pistes.map((p) => p.id)).toEqual(['batterie', 'basse', 'accords', 'sons', 'voix']);
    expect(r.morceau.pistes[1]!.volume).toBe(1.5);
    expect(r.morceau.master).toEqual({ preset: 'neutre', niveau: 'fort', chaine: 2 });
    expect(r.problemes.find((p) => p.chemin === 'tempo')?.message).toContain('hors limites');
    expect(r.problemes.some((p) => p.chemin === 'inconnu' && p.niveau === 'ignore')).toBe(true);
  });
  it('motifs : longueurs, roulements, références et accords illisibles', () => {
    const r = normaliserMorceau({
      tonalite: { tonique: 'C', mode: 'mineur' },
      motifs: {
        b: { type: 'batterie', pas: 20, pistes: { kick: [1, 2, -1], gong: [1] }, roulements: { kick: [5] } },
        a: { type: 'accords', pas: 16, accords: [{ pas: 0, duree: 16, degre: 'Z9' }] },
      },
      sections: [{ id: 's', nom: 'Couplet', mesures: 40, motifs: { batterie: 'b', basse: 'absent', accords: 'a' } }],
      ordre: ['s', 'x'],
    });
    const b = r.morceau.motifs.b as MotifBatterie;
    expect(b.pas).toBe(16);
    expect(b.pistes.kick!.slice(0, 3)).toEqual([1, 1, 0]);
    expect(b.pistes.kick).toHaveLength(16);
    expect(b.roulements!.kick![0]).toBe(4);
    expect(r.morceau.motifs.a?.type === 'accords' && r.morceau.motifs.a.accords[0]!.degre).toBe('i');
    expect(r.morceau.sections[0]!.mesures).toBe(16);
    expect(r.morceau.sections[0]!.motifs).toEqual({ batterie: 'b', accords: 'a' });
    expect(r.morceau.ordre).toEqual(['s']);
  });
  it('bloquant : aucune section, ou format plus récent ; JSON en texte accepté', () => {
    expect(normaliserMorceau({}).bloquant).toBe(true);
    expect(normaliserMorceau({ ...nouveauMorceau('lofi'), format: 'ocka.morceau/4' }).bloquant).toBe(true);
    expect(normaliserMorceau({ ...nouveauMorceau('lofi'), format: 'ocka.morceau/3' }).bloquant).toBe(false);
    expect(normaliserMorceau({ ...nouveauMorceau('lofi'), format: 'ocka.morceau/1' }).bloquant).toBe(false);
    const texte = '```json\n' + JSON.stringify(nouveauMorceau('drill')) + '\n```';
    expect(normaliserMorceau(texte).problemes).toEqual([]);
  });
  it('prises : une seule choisie par section, ancre disparue ignorée', () => {
    const m = nouveauMorceau('trap');
    const prise = { id: 'p', ancre: { section: 'couplet', occurrence: 0, mesure: 0 }, tempo: 140, fichier: 'prise-f.f32', frequence: 48000, duree: 10, debutCoupe: 1, finCoupe: 9, decalage: 0.01, gain: 1, choisie: true };
    const r = normaliserMorceau({ ...m, prises: [prise, { ...prise, id: 'q' }, { ...prise, id: 'z', ancre: { section: 'nulle', occurrence: 0, mesure: 0 } }] });
    expect(r.morceau.prises.map((p) => [p.id, p.choisie])).toEqual([['p', false], ['q', true]]);
  });
});
