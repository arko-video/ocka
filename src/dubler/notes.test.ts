// Enregistrement en notes : latence retirée, pas dans la section, tours repliés, notes trop courtes ignorées,
// quantification, pose dans le motif (un seul changement du morceau) et frappes du beatbox dans la batterie.
import { describe, expect, it } from 'vitest';
import { motifBatterieDe, motifNotesDe, pistesInstrument } from '../morceau/acces';
import { nouveauMorceau } from '../morceau/styles';
import {
  notesDepuisEvenements,
  NOTES_BATTERIE,
  poserNotesChantees,
  quantifierNotesChantees,
  type CadreEnregistrement,
} from './notes';

const cadre: CadreEnregistrement = {
  tempo: 120,
  swing: 0,
  heureSection: 10,
  latence: 0.1,
  pasSection: 32,
  pasMotif: 32,
};
const P = 0.125; // un pas à 120 BPM

describe('des événements aux notes', () => {
  it('latence retirée, pas dans la section, fin = événement suivant, notes trop courtes ignorées', () => {
    const e = [
      { heure: 10.1, jouees: [60], vel: 0.8 },
      { heure: 10.1 + 2 * P, jouees: [62], vel: 0.7 },
      { heure: 10.1 + 4 * P, jouees: [64], vel: 0.7 }, // 30 ms : un accident
      { heure: 10.1 + 4 * P + 0.03, jouees: [65], vel: 0.7 },
      { heure: 10.1 + 8 * P, jouees: [], vel: 0 },
    ];
    const n = notesDepuisEvenements(e, 20, cadre);
    expect(n.map((x) => [x.pas, x.duree, x.midi])).toEqual([
      [0, 2, 60],
      [2, 2, 62],
      [4.25, 3.75, 65],
    ]);
  });
  it('accords : toutes les notes ; tours de boucle repliés, le dernier tour gagne', () => {
    const tour = 32 * P;
    const e = [
      { heure: 10.1 + 4 * P, jouees: [57, 60, 64], vel: 0.9 },
      { heure: 10.1 + 6 * P, jouees: [], vel: 0 },
      { heure: 10.1 + tour + 5 * P, jouees: [59], vel: 0.9 },
      { heure: 10.1 + tour + 7 * P, jouees: [], vel: 0 },
      { heure: 10.1 + tour + 20 * P, jouees: [67], vel: 0.9 },
      { heure: 10.1 + tour + 22 * P, jouees: [], vel: 0 },
    ];
    const n = notesDepuisEvenements(e, 20, cadre);
    expect(n.map((x) => [x.pas, x.midi])).toEqual([
      [5, 59],
      [20, 67],
    ]);
  });
  it('frappes : un pas chacune, même très proches', () => {
    const e = [
      { heure: 10.1 + 0.01, jouees: [36], vel: 1 },
      { heure: 10.1 + 2 * P, jouees: [42], vel: 0.5 },
      { heure: 10.1 + 2 * P + 0.02, jouees: [38], vel: 0.9 },
    ];
    const n = notesDepuisEvenements(e, 20, { ...cadre, frappes: true });
    expect(n.map((x) => [Math.round(x.pas), x.midi])).toEqual([
      [0, 36],
      [2, 42],
      [2, 38],
    ]);
  });
});

describe('quantification', () => {
  const notes = [
    { pas: 0.3, duree: 1.6, midi: 60, vel: 0.8 },
    { pas: 3.8, duree: 0.5, midi: 62, vel: 0.8 },
  ];
  it('null : inchangées ; 1/16 et 1/8 ; force', () => {
    expect(quantifierNotesChantees(notes, null)).toEqual(notes);
    expect(quantifierNotesChantees(notes, 1).map((n) => [n.pas, n.duree])).toEqual([
      [0, 2],
      [4, 1],
    ]);
    expect(quantifierNotesChantees(notes, 2).map((n) => n.pas)).toEqual([0, 4]);
    expect(quantifierNotesChantees(notes, 1, 0.5)[0]!.pas).toBeCloseTo(4 / 24, 5);
  });
});

describe('pose dans le motif', () => {
  it('motif de notes créé, puis remplacé, en un seul changement', () => {
    const m = nouveauMorceau('trap');
    const piste = pistesInstrument(m)[0]!.id;
    const section = m.ordre[1] ?? m.ordre[0]!;
    const notes = [
      { pas: 0, duree: 2, midi: 60, vel: 0.8 },
      { pas: 4, duree: 1, midi: 64, vel: 0.6 },
    ];
    const m2 = poserNotesChantees(m, { piste, section, pas: 32, notes });
    expect(motifNotesDe(m2, section, piste)?.notes).toEqual(notes);
    expect(m.motifs).not.toBe(m2.motifs);
    const m3 = poserNotesChantees(m2, {
      piste,
      section,
      pas: 16,
      notes: [{ pas: 1, duree: 1, midi: 67, vel: 1 }],
    });
    expect(motifNotesDe(m3, section, piste)).toEqual({
      type: 'notes',
      pas: 16,
      notes: [{ pas: 1, duree: 1, midi: 67, vel: 1 }],
    });
    expect(poserNotesChantees(m, { piste, section, pas: 32, notes: [] })).toBe(m);
    expect(poserNotesChantees(m, { piste: 'inconnue', section, pas: 32, notes })).toBe(m);
  });
  it('frappes du beatbox : seuls les pads joués sont réécrits', () => {
    const m = nouveauMorceau('trap');
    const section = m.ordre[0]!;
    const avant = motifBatterieDe(m, section)!;
    const n = {
      piste: 'batterie',
      section,
      pas: 16,
      notes: [
        { pas: 0, duree: 1, midi: NOTES_BATTERIE.kick, vel: 1 },
        { pas: 8, duree: 1, midi: NOTES_BATTERIE.kick, vel: 0.6 },
        { pas: 4, duree: 1, midi: NOTES_BATTERIE.snare, vel: 0.9 },
      ],
    };
    const apres = motifBatterieDe(poserNotesChantees(m, n), section)!;
    expect(apres.pas).toBe(avant.pas);
    expect(apres.pistes.kick!.filter((v) => v > 0)).toEqual([1, 0.6]);
    expect(apres.pistes.kick![8]).toBe(0.6);
    expect(apres.pistes.snare![4]).toBe(0.9);
    expect(apres.pistes.charley).toEqual(avant.pistes.charley);
  });
});
