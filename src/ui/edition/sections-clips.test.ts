import { describe, expect, it } from 'vitest';
import { idMotifDe, motifParId, sectionDe, sectionsAvecMotif } from '../../morceau/acces';
import { base, propre } from './exemple-u2';
import { copierMotifDepuis, rendreUnique, sourcesCopie, usagesMotif, viderClip } from './sections';

// Exemple : intro (bat-intro, accords-1), couplet (bat-couplet, basse-1, accords-1), refrain (bat-refrain, basse-1,
// accords-1), outro (accords-1) ; ordre intro, couplet, refrain, couplet, refrain, outro.
const motif = (m: ReturnType<typeof base>, s: string, p: string) => idMotifDe(sectionDe(m, s), p);

describe('clips de la frise', () => {
  it('rendre unique : une copie pour cette section, l’original ailleurs', () => {
    const m0 = base();
    expect(usagesMotif(m0, 'basse-1')).toBe(2);
    const m = rendreUnique(m0, 'refrain', 'basse');
    const id = motif(m, 'refrain', 'basse')!;
    expect(id).not.toBe('basse-1');
    expect(motif(m, 'couplet', 'basse')).toBe('basse-1');
    expect(motifParId(m, id)).toEqual(motifParId(m, 'basse-1'));
    expect(motifParId(m, id)).not.toBe(motifParId(m, 'basse-1'));
    expect(sectionsAvecMotif(m, 'basse-1')).toEqual(['couplet']);
    expect(rendreUnique(m, 'refrain', 'basse')).toBe(m);
    expect(rendreUnique(m, 'outro', 'basse')).toBe(m);
    expect(Object.getPrototypeOf(m.motifs)).toBeNull();
    propre(m);
  });

  it('vider : silence dans la section ; motif retiré s’il ne sert plus', () => {
    const m0 = base();
    const m = viderClip(m0, 'couplet', 'basse');
    expect(motif(m, 'couplet', 'basse')).toBeUndefined();
    expect(motifParId(m, 'basse-1')).toBeDefined();
    const r = viderClip(m, 'refrain', 'basse');
    expect(motifParId(r, 'basse-1')).toBeUndefined();
    expect(viderClip(r, 'refrain', 'basse')).toBe(r);
    propre(m);
    propre(r);
  });

  it('copier le motif depuis une autre section : une copie indépendante', () => {
    const m0 = base();
    expect(sourcesCopie(m0, 'intro', 'batterie')).toEqual(['couplet', 'refrain']);
    expect(sourcesCopie(m0, 'outro', 'basse')).toEqual(['couplet']);
    const m = copierMotifDepuis(m0, 'intro', 'batterie', 'refrain');
    const id = motif(m, 'intro', 'batterie')!;
    expect(motifParId(m, id)).toEqual(motifParId(m0, 'bat-refrain'));
    expect(id).not.toBe('bat-refrain');
    // bat-intro ne servait qu'à l'intro : retiré.
    expect(motifParId(m, 'bat-intro')).toBeUndefined();
    expect(copierMotifDepuis(m, 'intro', 'batterie', 'outro')).toBe(m);
    propre(m);
    const o = copierMotifDepuis(m0, 'outro', 'basse', 'couplet');
    expect(motifParId(o, motif(o, 'outro', 'basse'))?.type).toBe('basse');
    propre(o);
  });
});
