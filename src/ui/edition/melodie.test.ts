import { describe, expect, it } from 'vitest';
import { idMotifDe } from '../../morceau/acces';
import { REGLE_ID, type MotifNotes } from '../../morceau/types';
import { exempleMorceau } from './exemple';
import {
  basculerNote,
  changerLongueur,
  choisirSon,
  creerMelodie,
  effacerMelodie,
  idMelodie,
  motifMelodie,
  notesGamme,
  notesHorsVue,
  notesPerdues,
  poserNotes,
  sonMelodie,
} from './melodie';

describe('gamme de la mélodie', () => {
  it('8 notes de la gamme sur une octave, tonique en bas et en haut', () => {
    // la mineur : la, si, do, ré, mi, fa, sol, la
    expect(notesGamme({ tonique: 'A', mode: 'mineur' }, 0)).toEqual([69, 71, 72, 74, 76, 77, 79, 81]);
    expect(notesGamme({ tonique: 'C', mode: 'majeur' }, 0)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });
  it('octave −1 et +1', () => {
    const milieu = notesGamme({ tonique: 'F', mode: 'mineur' }, 0);
    expect(notesGamme({ tonique: 'F', mode: 'mineur' }, -1)).toEqual(milieu.map((n) => n - 12));
    expect(notesGamme({ tonique: 'F', mode: 'mineur' }, 1)).toEqual(milieu.map((n) => n + 12));
  });
});

describe('motif de mélodie', () => {
  it('le premier geste crée le motif de la section seulement', () => {
    const m = exempleMorceau();
    expect(motifMelodie(m, 'refrain')).toBeNull();
    const m1 = creerMelodie(m, 'refrain');
    const id = idMelodie(m1, 'refrain')!;
    expect(id).toMatch(REGLE_ID);
    expect(id.length).toBeLessThanOrEqual(36);
    expect(motifMelodie(m1, 'refrain')).toEqual({ type: 'notes', pas: 32, notes: [] });
    // Format /3 : la piste instrument « melodie » (piano d'OCKA) est créée au premier geste.
    expect(m1.pistes.find((p) => p.id === 'melodie')).toMatchObject({ genre: 'instrument', instrument: 'ocka-piano@1' });
    expect(idMelodie(m1, 'couplet')).toBeNull();
    expect(idMotifDe(m.sections.find((s) => s.id === 'refrain'), 'melodie')).toBeUndefined();
    expect(creerMelodie(m1, 'refrain')).toBe(m1);
    expect(creerMelodie(m, 'inconnue')).toBe(m);
  });

  it('poser puis effacer une note dans la grille', () => {
    const m = exempleMorceau();
    const m1 = basculerNote(m, 'couplet', 4, 72, 2);
    expect(motifMelodie(m1, 'couplet')!.notes).toEqual([{ pas: 4, duree: 2, midi: 72, vel: 1 }]);
    // toucher la suite de la note l'efface aussi
    const m2 = basculerNote(m1, 'couplet', 5, 72, 2);
    expect(motifMelodie(m2, 'couplet')!.notes).toEqual([]);
  });

  it('une note ne dépasse ni la fin du motif ni la note suivante de même hauteur', () => {
    let m = basculerNote(exempleMorceau(), 'couplet', 30, 72, 8);
    expect(motifMelodie(m, 'couplet')!.notes[0]).toEqual({ pas: 30, duree: 2, midi: 72, vel: 1 });
    m = basculerNote(m, 'couplet', 26, 72, 8);
    expect(motifMelodie(m, 'couplet')!.notes.map((n) => [n.pas, n.duree])).toEqual([
      [26, 4],
      [30, 2],
    ]);
    // un accord (même pas, autre hauteur) est permis
    m = basculerNote(m, 'couplet', 26, 76, 1);
    expect(motifMelodie(m, 'couplet')!.notes).toHaveLength(3);
  });

  it('refuse les pas et hauteurs impossibles', () => {
    const m = exempleMorceau();
    expect(basculerNote(m, 'couplet', 32, 72, 1)).toBe(m);
    expect(basculerNote(m, 'couplet', -1, 72, 1)).toBe(m);
    expect(basculerNote(m, 'couplet', 0, 120, 1)).toBe(m);
  });

  it('longueur : les notes après la fin partent, les autres sont raccourcies', () => {
    let m = basculerNote(exempleMorceau(), 'couplet', 12, 72, 8);
    m = basculerNote(m, 'couplet', 20, 74, 1);
    expect(notesPerdues(motifMelodie(m, 'couplet'), 1)).toBe(1);
    const court = changerLongueur(m, 'couplet', 1);
    expect(motifMelodie(court, 'couplet')).toMatchObject({ pas: 16, notes: [{ pas: 12, duree: 4, midi: 72 }] });
    const long = changerLongueur(m, 'couplet', 4);
    expect(motifMelodie(long, 'couplet')!.pas).toBe(64);
    expect(changerLongueur(long, 'couplet', 4)).toBe(long);
    expect(changerLongueur(long, 'couplet', 3)).toBe(long);
  });

  it('son de la mélodie et « Effacer la mélodie »', () => {
    // Format /3 : le son est l'instrument « ocka-<son>@1 » de la piste mélodie (toutes les sections).
    let m = choisirSon(exempleMorceau(), 'intro', 'lead');
    expect(sonMelodie(m)).toBe('lead');
    expect(m.pistes.find((p) => p.id === 'melodie')).toMatchObject({ instrument: 'ocka-lead@1' });
    expect(choisirSon(m, 'intro', 'lead')).toBe(m);
    m = basculerNote(m, 'intro', 0, 69, 4);
    const vide = effacerMelodie(m, 'intro');
    expect(motifMelodie(vide, 'intro')).toMatchObject({ notes: [] });
    expect(sonMelodie(vide)).toBe('lead');
    expect(effacerMelodie(vide, 'intro')).toBe(vide);
  });

  it('poserNotes : une seule nouvelle version, doublons et recouvrements sautés', () => {
    const m = basculerNote(exempleMorceau(), 'refrain', 0, 69, 4);
    const m1 = poserNotes(m, 'refrain', [
      { pas: 2, duree: 1, midi: 69 }, // recouverte par la note du pas 0
      { pas: 8, duree: 2, midi: 72 },
      { pas: 8, duree: 2, midi: 72 },
      { pas: 40, duree: 2, midi: 72 }, // hors du motif de 2 mesures
      { pas: 6, duree: 4, midi: 74 },
    ]);
    expect(motifMelodie(m1, 'refrain')!.notes).toEqual([
      { pas: 0, duree: 4, midi: 69, vel: 1 },
      { pas: 6, duree: 4, midi: 74, vel: 1 },
      { pas: 8, duree: 2, midi: 72, vel: 1 },
    ]);
    expect(poserNotes(m1, 'refrain', [])).toBe(m1);
    // sans note gardée, le motif n'est même pas créé
    const m0 = exempleMorceau();
    expect(poserNotes(m0, 'outro', [{ pas: 99, duree: 1, midi: 60 }])).toBe(m0);
  });

  it('le dictionnaire des motifs reste sans prototype', () => {
    const m = creerMelodie(exempleMorceau(), 'refrain');
    expect(Object.getPrototypeOf(m.motifs)).toBeNull();
  });

  it('compte les notes hors des 8 lignes affichées', () => {
    const motif: MotifNotes = { type: 'notes', pas: 16, notes: [{ pas: 0, duree: 1, midi: 60, vel: 1 }, { pas: 1, duree: 1, midi: 84, vel: 1 }] };
    expect(notesHorsVue(motif, notesGamme({ tonique: 'C', mode: 'majeur' }, 0))).toBe(1);
  });
});

describe('textes de la mélodie', () => {
  it('accorde les pluriels', async () => {
    const { T } = await import('../../textes');
    expect(T.melodie.jouees(1)).toBe('1 note jouée');
    expect(T.melodie.jouees(4)).toBe('4 notes jouées');
    expect(T.melodie.posees(3)).toMatch(/^3 notes ajoutées\./);
  });
});
