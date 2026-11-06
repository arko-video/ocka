import { describe, expect, it } from 'vitest';
import { estIdFixe, idMotifDe, motifNotesDe, pistesInstrument, sectionDe } from '../../morceau/acces';
import { normaliserMorceau } from '../../morceau/normaliser';
import { REGLE_ID, type Morceau } from '../../morceau/types';
import { exempleMorceau } from './exemple';
import { ajouterNote } from './notes';
import {
  ajouterPiste,
  changerInstrument,
  deplacerPiste,
  dupliquerPiste,
  nomDepuisInstrument,
  renommerPiste,
  supprimerPiste,
} from './pistes';

const neuf = () => normaliserMorceau(exempleMorceau()).morceau;
const sain = (m: Morceau) => expect(normaliserMorceau(JSON.parse(JSON.stringify(m))).problemes).toEqual([]);

describe('pistes instrument', () => {
  it('« + Piste » : id libre, nom par défaut, ordre écrit, morceau sain', () => {
    const m = neuf();
    const a = ajouterPiste(m, 'ocka-piano@1')!;
    expect(a.id).toMatch(REGLE_ID);
    expect(estIdFixe(a.id)).toBe(false);
    const b = ajouterPiste(a.m, 'ocka-piano@1')!;
    expect(pistesInstrument(b.m).map((p) => p.nom)).toEqual(['Piano', 'Piano 2']);
    expect(b.m.pistes.map((p) => p.id)).toEqual(['batterie', 'basse', 'accords', a.id, b.id, 'sons', 'voix']);
    expect(m.pistes).toHaveLength(5); // pas de mutation
    sain(b.m);
    expect(nomDepuisInstrument('vcsl-marimba@1')).toBe('Marimba');
    expect(ajouterPiste(m, 'pas un instrument')).toBeNull();
  });
  it('16 pistes au plus : null ensuite', () => {
    let m = neuf();
    for (let i = 0; i < 16; i++) m = ajouterPiste(m, 'ocka-lead@1')!.m;
    expect(ajouterPiste(m, 'ocka-lead@1')).toBeNull();
    expect(dupliquerPiste(m, pistesInstrument(m)[0]!.id)).toBeNull();
    sain(m);
  });
  it('dupliquer : motifs copiés, indépendants', () => {
    const a = ajouterPiste(neuf(), 'ocka-pluck@1', 'Pluck')!;
    const m = ajouterNote(a.m, a.id, 'intro', { pas: 0, duree: 2, midi: 60, vel: 1 });
    const d = dupliquerPiste(m, a.id)!;
    expect(pistesInstrument(d.m).map((p) => [p.id, p.nom])).toEqual([
      [a.id, 'Pluck'],
      [d.id, 'Pluck 2'],
    ]);
    expect(motifNotesDe(d.m, 'intro', d.id)).toEqual(motifNotesDe(m, 'intro', a.id));
    expect(idMotifDe(sectionDe(d.m, 'intro'), d.id)).not.toBe(idMotifDe(sectionDe(d.m, 'intro'), a.id));
    sain(d.m);
  });
  it('supprimer : références et motifs inutiles retirés ; pistes fixes intouchables', () => {
    const a = ajouterPiste(neuf(), 'ocka-piano@1')!;
    const m = ajouterNote(a.m, a.id, 'intro', { pas: 0, duree: 2, midi: 60, vel: 1 });
    const idMotif = idMotifDe(sectionDe(m, 'intro'), a.id)!;
    const s = supprimerPiste(m, a.id);
    expect(pistesInstrument(s)).toHaveLength(0);
    expect(Object.hasOwn(s.motifs, idMotif)).toBe(false);
    expect(Object.hasOwn(sectionDe(s, 'intro')!.motifs, a.id)).toBe(false);
    expect(supprimerPiste(m, 'batterie')).toBe(m);
    sain(s);
  });
  it('renommer, changer d’instrument, déplacer', () => {
    const a = ajouterPiste(neuf(), 'ocka-piano@1')!;
    const b = ajouterPiste(a.m, 'ocka-nappe@1')!;
    let m = renommerPiste(b.m, a.id, '  Mon   piano  ');
    expect(pistesInstrument(m)[0]!.nom).toBe('Mon piano');
    expect(renommerPiste(m, a.id, '   ')).toBe(m);
    m = changerInstrument(m, a.id, 'ocka-epiano@1');
    expect(pistesInstrument(m)[0]!.instrument).toBe('ocka-epiano@1');
    expect(changerInstrument(m, a.id, 'mal écrit')).toBe(m);
    m = deplacerPiste(m, a.id, 1);
    expect(pistesInstrument(m).map((p) => p.id)).toEqual([b.id, a.id]);
    expect(deplacerPiste(m, a.id, 1)).toBe(m);
    sain(m);
  });
});
