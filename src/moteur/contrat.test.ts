import { describe, expect, it } from 'vitest';
import * as api from './api';
import { relier } from './relier';

/** Les fonctions publiques ajoutées par le contrat de la vague A (l'interface les importe depuis api.ts). */
const VAGUE_A = [
  // A1 — sorties
  'listerSorties', 'ouvrirSortie', 'sauverSortie', 'supprimerSortie', 'nouvelleSortie', 'retirerMorceauDesSorties',
  'lireReglages', 'ecrireReglages', 'typeSortie', 'verifierSortie', 'preparerPochette', 'fabriquerPochette',
  'lirePochette', 'parolesMusixmatch', 'ficheSortie', 'exporterDossierSortie', 'normaliserSortie', 'normaliserReglages',
  // A2 — fichiers
  'exporterAudio', 'tailleEstimee', 'exporterProjet', 'exporterSortieProjet', 'importerProjet', 'importerSon', 'lireSon',
  'demanderPersistance',
  // M2 — effets
  'exporterPistes', 'mesurerEcartAB', 'envoyerVersArko',
] as const;

describe('contrat de la vague A', () => {
  it('api.ts se charge et expose toutes les fonctions (aucune boucle d’imports cassée)', () => {
    const exportes = api as unknown as Record<string, unknown>;
    for (const nom of VAGUE_A) expect(typeof exportes[nom], nom).toBe('function');
    expect(typeof api.exporterWav).toBe('function');
    expect(new api.ErreurOcka('x', 'pas_encore')).toBeInstanceOf(Error);
  });
  it('relier lit l’implémentation à l’appel et passe les arguments', () => {
    let impl = (a: number, b: number) => a + b;
    const f = relier(() => impl);
    expect(f(2, 3)).toBe(5);
    impl = (a, b) => a * b;
    expect(f(2, 3)).toBe(6);
  });
});
