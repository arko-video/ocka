import { describe, expect, it } from 'vitest';
import type { AutotunePrise, Morceau, NoteAutotune } from '../../morceau/types';
import {
  appliquerPreset,
  autotuneDe,
  choisirGamme,
  classesGamme,
  couperNote,
  deplacerNote,
  ecrireAutotunePrise,
  ecrireNotes,
  fusionnerNotes,
  midiCible,
  normaliserNotes,
  noteProche,
  notesChangees,
  notesDepuisDetection,
  reglerAutotune,
  reglerJustesse,
  reglerVibrato,
} from './autotune';
import { exempleMorceau, exemplePrise } from './exemple';

const POP: AutotunePrise = { gamme: 'morceau', vitesse: 60, force: 0.8, humaniser: 0.3, formants: 0, preset: 'pop' };
const ROBOT: AutotunePrise = { gamme: 'morceau', vitesse: 0, force: 1, humaniser: 0, formants: 0, preset: 'robot' };
const note = (debut: number, fin: number, midi: number, cents = 0, vibrato = 1): NoteAutotune => ({ debut, fin, midi, cents, vibrato });

function avecPrise(a?: AutotunePrise): Morceau {
  const m = exempleMorceau();
  const p = exemplePrise('p1', 'couplet', 0, true);
  return { ...m, prises: [a ? { ...p, autotune: a } : p] };
}

describe('réglages de l’autotune d’une prise', () => {
  it('pose et retire l’autotune ; même objet quand rien ne change ou prise introuvable', () => {
    const m = avecPrise();
    expect(ecrireAutotunePrise(m, 'p1', undefined)).toBe(m);
    expect(ecrireAutotunePrise(m, 'zzz', POP)).toBe(m);
    const avec = ecrireAutotunePrise(m, 'p1', POP);
    expect(autotuneDe(avec, 'p1')).toEqual(POP);
    const sans = ecrireAutotunePrise(avec, 'p1', undefined);
    expect('autotune' in sans.prises[0]!).toBe(false);
  });

  it('un préréglage garde la gamme choisie et les notes éditées', () => {
    const notes = [note(0, 0.5, 60)];
    const m = avecPrise({ ...POP, gamme: { tonique: 'D', mode: 'majeur' }, notes });
    const r = autotuneDe(appliquerPreset(m, 'p1', ROBOT), 'p1')!;
    expect(r.preset).toBe('robot');
    expect(r.vitesse).toBe(0);
    expect(r.gamme).toEqual({ tonique: 'D', mode: 'majeur' });
    expect(r.notes).toEqual(notes);
    expect(autotuneDe(appliquerPreset(avecPrise(), 'p1', ROBOT), 'p1')).toEqual(ROBOT);
  });

  it('un réglage à la main est borné, arrondi, et passe en « perso »', () => {
    const m = avecPrise(POP);
    expect(autotuneDe(reglerAutotune(m, 'p1', 'vitesse', 900), 'p1')).toMatchObject({ vitesse: 400, preset: 'perso' });
    expect(autotuneDe(reglerAutotune(m, 'p1', 'formants', -3.3), 'p1')!.formants).toBe(-3.5);
    expect(autotuneDe(reglerAutotune(m, 'p1', 'force', 0.123), 'p1')!.force).toBe(0.12);
    expect(reglerAutotune(m, 'p1', 'vitesse', 60)).toBe(m);
    expect(reglerAutotune(m, 'p1', 'vitesse', Number.NaN)).toBe(m);
    expect(reglerAutotune(avecPrise(), 'p1', 'force', 0.5).prises[0]!.autotune).toBeUndefined();
  });

  it('gamme : choisie, morceau ou chromatique', () => {
    const m = avecPrise(POP);
    expect(choisirGamme(m, 'p1', 'morceau')).toBe(m);
    expect(autotuneDe(choisirGamme(m, 'p1', { tonique: 'C', mode: 'majeur' }), 'p1')!.gamme).toEqual({ tonique: 'C', mode: 'majeur' });
    expect(classesGamme('chromatique', m.tonalite)).toBeNull();
    expect([...classesGamme('morceau', { tonique: 'A', mode: 'mineur' })!].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(classesGamme({ tonique: 'D', mode: 'majeur' }, m.tonalite)!.has(6)).toBe(true); // fa♯
  });
});

describe('notes de l’éditeur', () => {
  const doMajeur = classesGamme({ tonique: 'C', mode: 'majeur' }, { tonique: 'C', mode: 'majeur' });

  it('glisser : un demi-ton à la fois, aimanté à la gamme, ou libre', () => {
    expect(midiCible(60, 1, doMajeur)).toBe(62); // do → ré (do♯ hors gamme)
    expect(midiCible(64, 1, doMajeur)).toBe(65); // mi → fa
    expect(midiCible(60, -1, doMajeur)).toBe(59); // do → si
    expect(midiCible(62, -1, doMajeur)).toBe(60);
    expect(midiCible(60, 1, null)).toBe(61); // libre
    expect(midiCible(61, 0, doMajeur)).toBe(61); // pas de geste : inchangée
    expect(midiCible(95, 5, null)).toBe(96);
    expect(midiCible(25, -4, null)).toBe(24);
  });

  it('déplacer, justesse et vibrato : bornés, même liste si rien ne change', () => {
    const notes = [note(0, 0.5, 60), note(0.5, 1, 62)];
    expect(deplacerNote(notes, 1, 64)[1]!.midi).toBe(64);
    expect(deplacerNote(notes, 1, 62)).toBe(notes);
    expect(deplacerNote(notes, 5, 64)).toBe(notes);
    expect(reglerJustesse(notes, 0, 250)[0]!.cents).toBe(100);
    expect(reglerJustesse(notes, 0, -12.4)[0]!.cents).toBe(-12);
    expect(reglerJustesse(notes, 0, 0)).toBe(notes);
    expect(reglerVibrato(notes, 0, 3)[0]!.vibrato).toBe(2);
    expect(reglerVibrato(notes, 0, 0.53)[0]!.vibrato).toBe(0.55);
    expect(reglerVibrato(notes, 0, -1)[0]!.vibrato).toBe(0);
  });

  it('couper en deux (au milieu ou au temps donné), jamais sous 60 ms', () => {
    const notes = [note(0, 0.5, 60, 10, 0.5), note(0.5, 0.6, 62)];
    const c = couperNote(notes, 0);
    expect(c).toHaveLength(3);
    expect(c[0]).toEqual(note(0, 0.25, 60, 10, 0.5));
    expect(c[1]).toEqual(note(0.25, 0.5, 60, 10, 0.5));
    expect(couperNote(notes, 0, 0.1)[0]!.fin).toBe(0.1);
    expect(couperNote(notes, 0, 0.03)).toBe(notes);
    expect(couperNote(notes, 1)).toBe(notes); // 100 ms : trop courte
  });

  it('fusionner avec la suivante : la hauteur de la plus longue', () => {
    const notes = [note(0, 0.2, 60), note(0.3, 1, 64, 5), note(1, 1.5, 67)];
    const f = fusionnerNotes(notes, 0);
    expect(f).toEqual([note(0, 1, 64, 5), note(1, 1.5, 67)]);
    expect(fusionnerNotes(notes, 2)).toBe(notes);
  });

  it('normaliser : tri, bornes, sans chevauchement ni note vide, 1024 au plus', () => {
    const n = normaliserNotes([note(1, 2, 120, 300, 9), note(0, 1.5, 10), note(3, 3, 60), note(2.5, 2.6, 60.4)]);
    expect(n).toEqual([note(0, 1.5, 24), note(1.5, 2, 96, 100, 2), note(2.5, 2.6, 60)]);
    const beaucoup = Array.from({ length: 1100 }, (_, i) => note(i, i + 0.5, 60));
    expect(normaliserNotes(beaucoup)).toHaveLength(1024);
  });

  it('notes de départ depuis la détection ; écrire dans la prise en UNE étape (avec réglages de départ)', () => {
    const depart = notesDepuisDetection([{ debut: 0.5, fin: 1, midi: 62 }, { debut: 0, fin: 0.5, midi: 60 }]);
    expect(depart).toEqual([note(0, 0.5, 60), note(0.5, 1, 62)]);
    // Visées sur la gamme : do♯ chanté un peu bas → do (do majeur) ; un peu haut → ré.
    const doMaj = classesGamme({ tonique: 'C', mode: 'majeur' }, { tonique: 'C', mode: 'majeur' });
    const visees = notesDepuisDetection([{ debut: 0, fin: 1, midi: 61, justesse: -20 }, { debut: 1, fin: 2, midi: 61, justesse: 30 }], doMaj);
    expect(visees.map((n) => n.midi)).toEqual([60, 62]);
    expect(noteProche(6140, null)).toBe(61);
    const sans = avecPrise();
    expect(ecrireNotes(sans, 'p1', depart)).toBe(sans);
    const m = ecrireNotes(sans, 'p1', deplacerNote(depart, 1, 64), POP);
    expect(autotuneDe(m, 'p1')).toEqual({ ...POP, notes: [note(0, 0.5, 60), note(0.5, 1, 64)] });
    expect(ecrireNotes(m, 'p1', autotuneDe(m, 'p1')!.notes!)).toBe(m);
  });

  it('notes changées : seules celles à recalculer', () => {
    const avant = [note(0, 0.5, 60), note(0.5, 1, 62)];
    expect(notesChangees(avant, avant)).toEqual([]);
    expect(notesChangees(avant, deplacerNote(avant, 1, 64))).toEqual([1]);
    expect(notesChangees(avant, couperNote(avant, 0))).toEqual([0, 1]);
    expect(notesChangees(undefined, avant)).toEqual([0, 1]);
  });
});
