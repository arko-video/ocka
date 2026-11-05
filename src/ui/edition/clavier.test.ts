import { describe, expect, it } from 'vitest';
import { calerFrappes, DELAI_TOUCHER, type OptionsCalage } from './clavier';

// 120 BPM : une double-croche = 0,125 s ; section de 2 mesures (32 pas), motif d'une mesure (16 pas).
const base: OptionsCalage = { heureDebut: 10, retrait: 0, tempo: 120, swing: 0, pasSection: 32, pasMotif: 16, duree: 2 };
const a = (pas: number) => 10 + pas * 0.125;

describe('calage du clavier', () => {
  it('arrondit à la double-croche la plus proche', () => {
    const notes = calerFrappes(
      [
        { heure: a(4) + 0.05, midi: 60 },
        { heure: a(7) - 0.06, midi: 62 },
      ],
      base,
    );
    expect(notes).toEqual([
      { pas: 4, duree: 2, midi: 60 },
      { pas: 7, duree: 2, midi: 62 },
    ]);
  });

  it('retire la latence de sortie et le délai du toucher', () => {
    const latence = 0.04;
    const retrait = latence + DELAI_TOUCHER;
    // Joué pile sur le pas 8 tel qu'entendu : le toucher arrive latence + délai plus tard.
    const frappe = { heure: a(8) + latence + DELAI_TOUCHER + 0.01, midi: 64 };
    expect(calerFrappes([frappe], { ...base, retrait })[0]!.pas).toBe(8);
    // Sans le retrait, la note tomberait un pas trop tard.
    expect(calerFrappes([frappe], base)[0]!.pas).toBe(9);
  });

  it('ignore les frappes du décompte et hors du motif', () => {
    const notes = calerFrappes(
      [
        { heure: a(-4), midi: 60 }, // pendant le décompte
        { heure: a(0) - 0.03, midi: 62 }, // à peine en avance : 1er pas
        { heure: a(20), midi: 64 }, // 2e mesure de la section : hors du motif d'une mesure
        { heure: a(32 + 3), midi: 65 }, // 2e tour de la boucle : pas 3
      ],
      base,
    );
    expect(notes.map((n) => [n.pas, n.midi])).toEqual([
      [0, 62],
      [3, 65],
    ]);
  });

  it('une frappe juste avant la fin du tour compte pour le début du suivant', () => {
    const notes = calerFrappes([{ heure: a(32) - 0.02, midi: 60 }], { ...base, pasMotif: 32 });
    expect(notes[0]!.pas).toBe(0);
  });

  it('suit le swing', () => {
    // swing 0,5 : le pas 1 sonne à 1,5 × 0,125 s après le pas 0.
    const notes = calerFrappes([{ heure: 10 + 1.5 * 0.125, midi: 60 }], { ...base, swing: 0.5 });
    expect(notes[0]!.pas).toBe(1);
  });

  it('durée choisie, raccourcie à la fin du motif ; doublons et hauteurs impossibles retirés', () => {
    const notes = calerFrappes(
      [
        { heure: a(15), midi: 60 },
        { heure: a(15) + 0.01, midi: 60 },
        { heure: a(2), midi: 130 },
      ],
      { ...base, duree: 4 },
    );
    expect(notes).toEqual([{ pas: 15, duree: 1, midi: 60 }]);
  });
});
