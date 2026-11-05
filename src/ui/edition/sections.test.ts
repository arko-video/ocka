import { describe, expect, it } from 'vitest';
import { exempleMorceau, exemplePrise } from './exemple';
import {
  ajouterSection,
  choisirMotifSection,
  deplacerSection,
  dupliquerSection,
  occurrence,
  positionDe,
  reglerSection,
  repeterSection,
  supprimerSection,
} from './sections';

// ordre de l'exemple : intro, couplet, refrain, couplet, refrain, outro
describe('occurrences', () => {
  it('compte les apparitions', () => {
    const { ordre } = exempleMorceau();
    expect(occurrence(ordre, 3)).toBe(1);
    expect(positionDe(ordre, 'refrain', 1)).toBe(4);
    expect(positionDe(ordre, 'pont', 0)).toBe(-1);
  });
});

describe('ajouter et répéter', () => {
  it('ajoute un Pont à la fin, avec un id libre', () => {
    const m = ajouterSection(exempleMorceau(), 'Pont');
    expect(m.ordre.at(-1)).toBe('pont');
    expect(m.sections.find((s) => s.id === 'pont')?.nom).toBe('Pont');
  });

  it('un nouveau Couplet reprend les motifs du couplet existant', () => {
    const m = ajouterSection(exempleMorceau(), 'Couplet', 0);
    expect(m.ordre[1]).toBe('couplet-2');
    expect(m.sections.find((s) => s.id === 'couplet-2')?.motifs.batterie).toBe('bat-couplet');
  });

  it('répéter une section avant une prise décale son occurrence', () => {
    const m0 = { ...exempleMorceau(), prises: [exemplePrise('p1', 'couplet', 1)] };
    const m = repeterSection(m0, 'couplet', 0); // couplet inséré en position 1
    expect(m.ordre.slice(0, 3)).toEqual(['intro', 'couplet', 'couplet']);
    expect(m.prises[0]!.ancre.occurrence).toBe(2);
  });
});

describe('dupliquer, déplacer, supprimer', () => {
  it('duplique en copie indépendante nommée « Refrain 2 »', () => {
    const m = dupliquerSection(exempleMorceau(), 2);
    expect(m.ordre[3]).toBe('refrain-2');
    const copie = m.sections.find((s) => s.id === 'refrain-2')!;
    expect(copie.nom).toBe('Refrain 2');
    expect(copie.paroles).toBe('Le refrain qui reste en tête');
  });

  it('déplace et garde les prises sur leur section', () => {
    const m0 = { ...exempleMorceau(), prises: [exemplePrise('p1', 'couplet', 0)] };
    const m = deplacerSection(m0, 1, -1);
    expect(m.ordre.slice(0, 2)).toEqual(['couplet', 'intro']);
    expect(m.prises[0]!.ancre).toEqual({ section: 'couplet', occurrence: 0, mesure: 0 });
    expect(deplacerSection(m0, 0, -1)).toBe(m0);
  });

  it('supprime une apparition, ses prises, et décale les suivantes', () => {
    const m0 = { ...exempleMorceau(), prises: [exemplePrise('a', 'couplet', 0), exemplePrise('b', 'couplet', 1)] };
    const m = supprimerSection(m0, 1);
    expect(m.ordre).toEqual(['intro', 'refrain', 'couplet', 'refrain', 'outro']);
    expect(m.prises.map((p) => [p.id, p.ancre.occurrence])).toEqual([['b', 0]]);
    expect(m.sections.some((s) => s.id === 'couplet')).toBe(true);
  });

  it('retire la section quand elle n’apparaît plus, et garde au moins une section', () => {
    const m = supprimerSection(exempleMorceau(), 5);
    expect(m.sections.some((s) => s.id === 'outro')).toBe(false);
    let seul = exempleMorceau();
    while (seul.ordre.length > 1) seul = supprimerSection(seul, 0);
    expect(supprimerSection(seul, 0)).toBe(seul);
  });
});

describe('régler une section', () => {
  it('renomme, borne les mesures, ignore un nom vide', () => {
    let m = reglerSection(exempleMorceau(), 'couplet', { nom: '  Couplet A ', mesures: 40 });
    const s = m.sections.find((x) => x.id === 'couplet')!;
    expect(s.nom).toBe('Couplet A');
    expect(s.mesures).toBe(16);
    m = reglerSection(m, 'couplet', { nom: '   ' });
    expect(m.sections.find((x) => x.id === 'couplet')!.nom).toBe('Couplet A');
  });

  it('change le motif d’une piste, refuse un motif d’un autre type', () => {
    const m0 = exempleMorceau();
    const m = choisirMotifSection(m0, 'intro', 'batterie', 'bat-pont');
    expect(m.sections[0]!.motifs.batterie).toBe('bat-pont');
    expect(choisirMotifSection(m0, 'intro', 'batterie', 'basse-1')).toBe(m0);
    expect(choisirMotifSection(m0, 'couplet', 'basse', null).sections[1]!.motifs.basse).toBeUndefined();
  });
});
