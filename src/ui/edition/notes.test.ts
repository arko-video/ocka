import { describe, expect, it } from 'vitest';
import { idMotifDe, motifNotesDe, sectionDe } from '../../morceau/acces';
import { normaliserMorceau } from '../../morceau/normaliser';
import { REGLE_ID, type Morceau, type Note } from '../../morceau/types';
import { degreAccord, notesAccordSur } from './accords';
import { exempleMorceau } from './exemple';
import {
  ajouterNote,
  allongerNote,
  changerLongueurMotif,
  collerNotes,
  copierNotes,
  deplacerNotes,
  partageDe,
  poserAccord,
  poserNotesAccord,
  quantifier,
  reglerVelocite,
  rendreUniqueMotif,
  supprimerNotes,
} from './notes';
import { ajouterPiste } from './pistes';

const base = (): { m: Morceau; p: string } => {
  const r = ajouterPiste(normaliserMorceau(exempleMorceau()).morceau, 'ocka-piano@1')!;
  return { m: r.m, p: r.id };
};
const sain = (m: Morceau) => expect(normaliserMorceau(JSON.parse(JSON.stringify(m))).problemes).toEqual([]);
const n = (pas: number, midi: number, duree = 1, vel = 1): Note => ({ pas, duree, midi, vel });
const notes = (m: Morceau, p: string, s = 'intro') => motifNotesDe(m, s, p)!.notes;

describe('notes du piano roll', () => {
  it('le premier geste crée le motif (2 mesures), id conforme à REGLE_ID, morceau sain', () => {
    const { m, p } = base();
    expect(motifNotesDe(m, 'intro', p)).toBeNull();
    const m1 = ajouterNote(m, p, 'intro', n(4, 60, 2));
    const id = idMotifDe(sectionDe(m1, 'intro'), p)!;
    expect(id).toMatch(REGLE_ID);
    expect(motifNotesDe(m1, 'intro', p)).toEqual({ type: 'notes', pas: 32, notes: [n(4, 60, 2)] });
    expect(motifNotesDe(m, 'intro', p)).toBeNull(); // pas de mutation
    sain(m1);
  });
  it('grille du 1/24, bornes du motif, tri et doublons', () => {
    const { m, p } = base();
    let x = ajouterNote(m, p, 'intro', n(3.01, 64, 100));
    x = ajouterNote(x, p, 'intro', n(0, 60));
    x = ajouterNote(x, p, 'intro', { ...n(0, 60), vel: 0.5 });
    expect(notes(x, p)).toEqual([{ ...n(0, 60), vel: 0.5 }, n(3, 64, 29)]);
    expect(ajouterNote(x, p, 'intro', n(40, 60))).toBe(x); // hors du motif
    expect(ajouterNote(x, p, 'intro', n(0, 200))).toBe(x); // hors BORNES_NOTE
    expect(ajouterNote(m, 'batterie', 'intro', n(0, 60))).toBe(m); // pas une piste instrument
    sain(x);
  });
  it('supprimer, déplacer (en bloc, borné), allonger, vélocité', () => {
    const { m, p } = base();
    let x = poserNotesAccord(m, p, 'intro', 0, 2, [60, 64, 67]);
    expect(notes(x, p).map((k) => k.midi)).toEqual([60, 64, 67]);
    expect(supprimerNotes(x, p, 'intro', [9])).toBe(x);
    x = supprimerNotes(x, p, 'intro', [1]);
    expect(notes(x, p).map((k) => k.midi)).toEqual([60, 67]);
    x = deplacerNotes(x, p, 'intro', [0, 1], -5, 2);
    expect(notes(x, p).map((k) => [k.pas, k.midi])).toEqual([
      [0, 62],
      [0, 69],
    ]); // borné au début
    x = deplacerNotes(x, p, 'intro', [0], 31.5, 0);
    expect(notes(x, p).map((k) => [k.pas, k.duree, k.midi])).toEqual([
      [0, 2, 69],
      [31.5, 0.5, 62],
    ]);
    expect(deplacerNotes(x, p, 'intro', [0], 0, 0)).toBe(x);
    x = allongerNote(x, p, 'intro', 0, 7.99);
    expect(notes(x, p)[0]!.duree).toBe(8);
    expect(allongerNote(x, p, 'intro', 1, 99)).toBe(x); // déjà au bout du motif
    x = reglerVelocite(x, p, 'intro', [0, 1], 0.01);
    expect(notes(x, p).map((k) => k.vel)).toEqual([0.1, 0.1]);
    sain(x);
  });
  it('quantifier : croches, triolets, force', () => {
    const { m, p } = base();
    let x = ajouterNote(m, p, 'intro', n(1.25, 60));
    x = ajouterNote(x, p, 'intro', n(2.75, 62));
    expect(notes(quantifier(x, p, 'intro', null, 2, 1), p).map((k) => k.pas)).toEqual([2, 2]);
    expect(notes(quantifier(x, p, 'intro', [0], 2, 0.5), p).map((k) => k.pas)).toEqual([1.625, 2.75]);
    const t = notes(quantifier(x, p, 'intro', null, 4 / 3, 1), p).map((k) => k.pas);
    expect(t).toEqual([4 / 3, 8 / 3]);
    sain(quantifier(x, p, 'intro', null, 2 / 3, 1));
  });
  it('copier / coller, longueur du motif', () => {
    const { m, p } = base();
    let x = poserNotesAccord(m, p, 'intro', 4, 4, [60, 64]);
    const copie = copierNotes(motifNotesDe(x, 'intro', p)!, [0, 1]);
    expect(copie).toEqual({ notes: [n(0, 60, 4), n(0, 64, 4)], longueur: 4 });
    x = collerNotes(x, p, 'intro', copie, 30);
    expect(
      notes(x, p)
        .filter((k) => k.pas === 30)
        .map((k) => k.duree),
    ).toEqual([2, 2]);
    expect(collerNotes(x, p, 'intro', copie, 32)).toBe(x);
    const court = changerLongueurMotif(x, p, 'intro', 16);
    expect(motifNotesDe(court, 'intro', p)!.pas).toBe(16);
    expect(notes(court, p).every((k) => k.pas + k.duree <= 16)).toBe(true);
    expect(changerLongueurMotif(x, p, 'intro', 20)).toBe(x);
    sain(changerLongueurMotif(court, p, 'intro', 128));
  });
  it('accord en un toucher (degré de la tonalité, la mineur)', () => {
    const { m, p } = base();
    const x = poserAccord(m, p, 'intro', 0, 8, 'VI');
    expect(notes(x, p).map((k) => k.midi)).toEqual([65, 69, 72]); // fa la do
    sain(x);
  });
  it('« Rendre unique » un motif partagé', () => {
    const { m, p } = base();
    let x = ajouterNote(m, p, 'intro', n(0, 60));
    const id = idMotifDe(sectionDe(x, 'intro'), p)!;
    const d = Object.assign(Object.create(null) as Record<string, string>, sectionDe(x, 'outro')!.motifs, {
      [p]: id,
    });
    x = { ...x, sections: x.sections.map((s) => (s.id === 'outro' ? { ...s, motifs: d } : s)) };
    expect(partageDe(x, p, 'intro')).toBe(2);
    const u = rendreUniqueMotif(x, 'outro', p);
    expect(partageDe(u, p, 'outro')).toBe(1);
    expect(notes(u, p, 'outro')).toEqual(notes(x, p, 'intro'));
    expect(rendreUniqueMotif(u, 'outro', p)).toBe(u);
    sain(u);
  });
});

describe('accords sur une racine', () => {
  const t = { tonique: 'C', mode: 'majeur' } as const;
  it('types et « dans la gamme »', () => {
    expect(notesAccordSur(60, 'majeur', t)).toEqual([60, 64, 67]);
    expect(notesAccordSur(62, 'gamme', t)).toEqual([62, 65, 69]); // ré mineur
    expect(notesAccordSur(71, 'gamme', t)).toEqual([71, 74, 77]); // si diminué
    expect(notesAccordSur(67, '7', t)).toEqual([67, 71, 74, 77]);
    expect(notesAccordSur(60, 'sus', t)).toEqual([60, 65, 67]);
  });
  it('degré romain équivalent', () => {
    expect(degreAccord(62, 'gamme', t)).toBe('ii');
    expect(degreAccord(67, '7', t)).toBe('V7');
    expect(degreAccord(71, 'gamme', t)).toBe('vii°');
    expect(degreAccord(70, 'majeur', t)).toBe('bVII');
  });
});
