import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Morceau } from '../morceau/types';
import { morceauPret, sortiePrete } from './aides-test';
import { estVide, typeSortie, verifierSortie } from './regles';
import { aUnNumero, contientArtiste, contientFeat, contientProd, estEnMajuscules, estVraiNom } from './regles-titre';
import type { Sortie } from './types';

const codes = (s: Sortie, m: ReadonlyMap<string, Morceau>, cote: number | null = 3000) => verifierSortie(s, m, cote).map((p) => p.code);
const une = (m: Morceau) => new Map([['m1', m]]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 4, 12)); // 4 novembre 2026, midi (heure locale)
});
afterEach(() => vi.useRealTimers());

describe('typeSortie (règle de Spotify)', () => {
  it('single : 1 à 3 titres et moins de 30 min', () => {
    expect(typeSortie([])).toBe('single');
    expect(typeSortie([180])).toBe('single');
    expect(typeSortie([180, 200, 210])).toBe('single');
  });
  it('EP : 4 à 6 titres et moins de 30 min', () => {
    expect(typeSortie([180, 180, 180, 180])).toBe('ep');
    expect(typeSortie(Array(6).fill(290))).toBe('ep');
  });
  it('album : 7 titres et plus, ou 30 min et plus', () => {
    expect(typeSortie(Array(7).fill(60))).toBe('album');
    expect(typeSortie([1000, 800])).toBe('album');
    expect(typeSortie(Array(5).fill(360))).toBe('album');
    expect(typeSortie([1799])).toBe('single');
  });
});

describe('verifierSortie', () => {
  it('une sortie complète est prête : aucun problème', () => {
    expect(verifierSortie(sortiePrete(['m1']), une(morceauPret()), 3000)).toEqual([]);
  });

  it('titre et artiste vides, sortie sans titre, pochette absente : bloquants avec le bon écran', () => {
    const p = verifierSortie(sortiePrete([], { titre: ' ', artiste: '', pochette: undefined }), new Map());
    expect(p.map((x) => x.code)).toEqual(['sortie_titre_vide', 'artiste_vide', 'sortie_vide', 'pochette_absente']);
    expect(p.every((x) => x.niveau === 'bloquant')).toBe(true);
    expect(p[0]!.corriger).toEqual({ ecran: 'infos', champ: 'titre' });
    expect(p[3]!.corriger).toEqual({ ecran: 'pochette' });
  });

  it('pochette : < 1425 px bloquant, < 3000 px conseil, côté inconnu = pas de remarque', () => {
    const s = sortiePrete(['m1']);
    expect(codes(s, une(morceauPret()), 1000)).toEqual(['pochette_trop_petite']);
    expect(codes(s, une(morceauPret()), 2000)).toEqual(['pochette_petite']);
    expect(verifierSortie(s, une(morceauPret()), 2000)[0]!.niveau).toBe('conseil');
    expect(codes(s, une(morceauPret()), null)).toEqual([]);
  });

  it('titre introuvable, titre vide, trop court, vide (sans son)', () => {
    expect(codes(sortiePrete(['m1']), new Map())).toEqual(['titre_introuvable']);
    const vide = morceauPret('');
    expect(codes(sortiePrete(['m1'], { titre: 'Nuit' }), une(vide))).toContain('titre_vide');
    const court = morceauPret();
    court.ordre = ['refrain']; // 8 mesures (≈ 15 s)
    const p = verifierSortie(sortiePrete(['m1']), une(court), 3000);
    expect(p[0]).toMatchObject({ code: 'titre_trop_court', niveau: 'bloquant', corriger: { ecran: 'infos', titre: 'm1', champ: 'duree' } });
    expect(p[0]!.message).toContain('0:13');
    const muet = morceauPret();
    muet.sections = muet.sections.map((s) => ({ ...s, motifs: {} }));
    expect(estVide(muet)).toBe(true);
    expect(codes(sortiePrete(['m1']), une(muet))).toContain('titre_muet');
  });

  it('explicite non répondu : bloquant sur le champ « explicite »', () => {
    const m = morceauPret();
    delete m.infos!.explicite;
    expect(verifierSortie(sortiePrete(['m1']), une(m), 3000)[0]).toMatchObject({ code: 'explicite_manquant', corriger: { titre: 'm1', champ: 'explicite' } });
  });

  it('crédits : auteur et compositeur exigés (compositeur seul si instrumental), vrais noms complets', () => {
    expect(codes(sortiePrete(['m1']), une(morceauPret('Nuit blanche', { credits: [] })))).toEqual(['credit_auteur_manquant', 'credit_compositeur_manquant']);
    const instru = morceauPret('Nuit blanche', { langue: 'instrumental', credits: [{ nom: 'Romain Dupont', role: 'compositeur' }] });
    expect(codes(sortiePrete(['m1']), une(instru))).toEqual([]);
    const pseudo = morceauPret('Nuit blanche', {
      credits: [
        { nom: 'Kalo', role: 'auteur' },
        { nom: 'Romain Dupont', role: 'compositeur' },
        { nom: 'DJ X', role: 'producteur' },
      ],
    });
    const p = verifierSortie(sortiePrete(['m1']), une(pseudo), 3000);
    expect(p.map((x) => x.code)).toEqual(['credits_vrai_nom']);
    expect(p[0]!.message).toContain('« Kalo »');
    expect(estVraiNom('Jean-Luc O’Neil')).toBe(true);
    expect(estVraiNom('J. Dupont')).toBe(true);
    expect(estVraiNom('Romain')).toBe(false);
    expect(estVraiNom('lil kalo92')).toBe(false);
    expect(estVraiNom('@kalo officiel')).toBe(false);
  });

  it('règles du titre : majuscules, numéro, nom de l’artiste, plus de 12 mots, prod.', () => {
    const essai = (titre: string) => codes(sortiePrete(['m1'], { titre }), une(morceauPret(titre)));
    expect(essai('NUIT BLANCHE')).toEqual(['titre_majuscules', 'titre_majuscules']);
    expect(essai('01 - Nuit')).toEqual(['titre_numero', 'titre_numero']);
    expect(essai('Nuit (Kalo remix)')).toEqual(['titre_artiste', 'titre_artiste']);
    expect(essai('un deux trois quatre cinq six sept huit neuf dix onze douze treize')).toEqual(['titre_trop_long', 'titre_trop_long']);
    expect(essai('Nuit prod. Mike')).toEqual(['titre_prod', 'titre_prod']);
    expect(verifierSortie(sortiePrete(['m1'], { titre: 'NUIT' }), une(morceauPret('NUIT')), 3000)[0]!.message).toContain('« Nuit »');
    expect(estEnMajuscules('DNA')).toBe(false);
    expect(aUnNumero('1. Nuit') && aUnNumero('Track 3') && aUnNumero('3) Nuit')).toBe(true);
    expect(aUnNumero('4:44') || aUnNumero('1999') || aUnNumero('21 nuits')).toBe(false);
    expect(contientArtiste('Kalorie', 'Kalo')).toBe(false);
    expect(contientArtiste('Nuit de KALÔ', 'Kalo')).toBe(true);
    expect(contientProd('Product') || contientProd('Prodige')).toBe(false);
  });

  it('feat. écrit dans le titre d’un morceau : conseil (l’invité va dans « featuring »)', () => {
    const m = morceauPret('Nuit (feat. Léa)');
    const p = verifierSortie(sortiePrete(['m1'], { titre: 'Nuit (feat. Léa)' }), une(m), 3000);
    expect(p.map((x) => [x.code, x.niveau])).toEqual([['titre_feat', 'conseil']]);
    expect(contientFeat('Left')).toBe(false);
  });

  it('doublons : le même titre (featuring compris) deux fois est interdit', () => {
    const m = new Map([
      ['m1', morceauPret('Nuit blanche')],
      ['m2', morceauPret('Nuit Blanche!')],
      ['m3', morceauPret('Nuit blanche', { featuring: 'Léa' })],
    ]);
    const p = verifierSortie(sortiePrete(['m1', 'm2', 'm3'], { titre: 'Mon EP' }), m, 3000);
    expect(p.filter((x) => x.code === 'titre_doublon').map((x) => x.corriger.titre)).toEqual(['m2']);
  });

  it('conseils : paroles absentes, IA non déclarée, lien vide, date proche ou passée, moyenne DistroKid', () => {
    const m = morceauPret('Nuit blanche', { ia: undefined });
    m.sections = m.sections.map((s) => ({ ...s, paroles: '' }));
    const p = verifierSortie(sortiePrete(['m1'], { lienProfil: undefined, dateSortie: '2026-11-20' }), une(m), 3000);
    expect(p.map((x) => x.code)).toEqual(['ia_non_declaree', 'paroles_absentes', 'date_proche', 'lien_profil_vide']);
    expect(p.every((x) => x.niveau === 'conseil')).toBe(true);
    expect(p[2]!.message).toContain('16 jours');
    expect(codes(sortiePrete(['m1'], { dateSortie: '2026-11-01' }), une(morceauPret()))).toEqual(['date_passee']);
    expect(codes(sortiePrete(['m1'], { dateSortie: '2026-12-02' }), une(morceauPret()))).toEqual([]);
    // DistroKid : moyenne < 60 s (2 titres de ~41 s).
    const court = () => {
      const x = morceauPret('A');
      x.ordre = ['couplet', 'couplet', 'refrain'];
      return x;
    };
    const deux = new Map([['m1', court()], ['m2', { ...court(), titre: 'B' }]]);
    expect(codes(sortiePrete(['m1', 'm2'], { titre: 'Duo', distributeur: 'distrokid' }), deux)).toEqual(['moyenne_distrokid']);
    expect(codes(sortiePrete(['m1', 'm2'], { titre: 'Duo' }), deux)).toEqual([]);
  });

  it('single d’un titre : le nom de la sortie doit être celui du morceau (conseil)', () => {
    expect(codes(sortiePrete(['m1'], { titre: 'Autre chose' }), une(morceauPret('Nuit blanche')))).toEqual(['titre_single']);
  });

  it('les bloquants passent avant les conseils', () => {
    const p = verifierSortie(sortiePrete(['m1'], { lienProfil: undefined, pochette: undefined }), une(morceauPret()), null);
    expect(p.map((x) => x.niveau)).toEqual(['bloquant', 'conseil']);
  });
});
