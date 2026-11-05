import { describe, expect, it } from 'vitest';
import { dateParDefaut, lireDate, normaliserReglages, normaliserSortie } from './normaliser-sortie';
import { PLAFONDS } from './types';

const MAINTENANT = Date.UTC(2026, 10, 4, 12); // 4 novembre 2026

function sortie(plus: Record<string, unknown> = {}) {
  return {
    format: 'ocka.sortie/1', id: 'ma-sortie', titre: 'Nuit', artiste: 'Romain', dateSortie: '2026-12-20', genre: 'Hip-Hop/Rap',
    langue: 'fr', titres: ['m1', 'm2'], distributeur: 'routenote', niveau: 'standard', modifieLe: 1000, ...plus,
  };
}

describe('normaliserSortie', () => {
  it('une sortie propre ressort telle quelle, sans problème, et deux fois de suite pareil', () => {
    const r = normaliserSortie(sortie(), ['m1', 'm2'], MAINTENANT);
    expect(r.problemes).toEqual([]);
    expect(r.sortie).toEqual(sortie());
    expect(normaliserSortie(JSON.parse(JSON.stringify(r.sortie)), ['m1', 'm2'], MAINTENANT)).toEqual(r);
  });
  it('titres : ids morts, doublons, ids hostiles et plafond de 32', () => {
    const titres = ['m1', 'mort', 'm1', '__proto__', '../x', 42, 'm2'];
    const r = normaliserSortie(sortie({ titres }), ['m1', 'm2'], MAINTENANT);
    expect(r.sortie.titres).toEqual(['m1', 'm2']);
    expect(r.bloquant).toBe(false);
    const beaucoup = Array.from({ length: 40 }, (_, i) => `t${i}`);
    expect(normaliserSortie(sortie({ titres: beaucoup }), undefined, MAINTENANT).sortie.titres).toHaveLength(PLAFONDS.titresParSortie);
  });
  it('défauts : date = aujourd’hui + 6 semaines, langue fr, RouteNote, standard ; id neuf si illisible', () => {
    const r = normaliserSortie({ titre: 'Seul', id: 'pas valable !' }, [], MAINTENANT);
    expect(r.sortie.dateSortie).toBe('2026-12-16');
    expect(dateParDefaut(MAINTENANT)).toBe('2026-12-16');
    expect(r.sortie).toMatchObject({ format: 'ocka.sortie/1', langue: 'fr', distributeur: 'routenote', niveau: 'standard', titres: [], modifieLe: MAINTENANT });
    expect(r.sortie.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
    expect(r.sortie.id).not.toBe('pas valable !');
  });
  it('label « N/A » retiré, UPC et lien vérifiés, pochette avec une clé d’OCKA seulement', () => {
    const r = normaliserSortie(
      sortie({ label: 'N/A', upc: '123 456 789 012', lienProfil: 'javascript:alert(1)', pochette: '../../etc' }),
      undefined,
      MAINTENANT,
    );
    expect(r.sortie.label).toBeUndefined();
    expect(r.sortie.upc).toBe('123456789012');
    expect(r.sortie.lienProfil).toBeUndefined();
    expect(r.sortie.pochette).toBeUndefined();
    const ok = normaliserSortie(sortie({ label: 'Studio Nuit', lienProfil: 'https://open.spotify.com/artist/abc', pochette: 'pochette-x1' }), undefined, MAINTENANT);
    expect(ok.sortie).toMatchObject({ label: 'Studio Nuit', lienProfil: 'https://open.spotify.com/artist/abc', pochette: 'pochette-x1' });
  });
  it('format plus récent : bloquant ; date impossible corrigée', () => {
    expect(normaliserSortie(sortie({ format: 'ocka.sortie/2' }), undefined, MAINTENANT).bloquant).toBe(true);
    expect(lireDate('2026-02-30')).toBeNull();
    expect(lireDate('2026-02-28T10:00:00Z')).toBe('2026-02-28');
    expect(normaliserSortie(sortie({ dateSortie: '2026-02-30' }), undefined, MAINTENANT).sortie.dateSortie).toBe('2026-12-16');
  });
});

describe('normaliserReglages', () => {
  it('garde ce qui est lisible, retire le reste', () => {
    expect(normaliserReglages({ vraiNom: ' Romain Dupont ', artiste: 7, lienProfil: 'http://x', distributeur: 'amuse', autre: 1 })).toEqual({
      vraiNom: 'Romain Dupont',
      artiste: '7',
    });
    expect(normaliserReglages(null)).toEqual({});
  });
});
