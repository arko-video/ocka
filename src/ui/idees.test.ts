// Fil des idées : oublié à chaque nouvelle séance, et jamais de « Cycle detected » (aucune écriture de signal
// dans un effet : le bug de la vague B venait d'un effet qui écrivait versionIdees en le lisant).
import { effect } from '@preact/signals';
import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import { fermerSession, ouvrirSession } from './etat';
import { nombreIdees, noterIdee, prochaineGraine, reprendreIdee, versionIdees } from './idees';

describe('fil des idées', () => {
  it('garde les idées pendant la séance, les oublie à la fermeture et à l’ouverture d’un autre morceau', () => {
    const m = nouveauMorceau('phonk', 'Test');
    const motif = m.motifs[Object.keys(m.motifs)[0]!]!;
    ouvrirSession(m, 'a');
    noterIdee('bat|x', motif, 10);
    noterIdee('bat|x', motif, 11);
    expect(nombreIdees('bat|x')).toBe(2);
    expect(prochaineGraine('bat|x')).toBe(12);
    expect(reprendreIdee('bat|x')).not.toBeNull();
    expect(nombreIdees('bat|x')).toBe(1);
    fermerSession();
    expect(nombreIdees('bat|x')).toBe(0);
    ouvrirSession(m, 'a');
    noterIdee('bat|x', motif, 3);
    ouvrirSession(m, 'b');
    expect(nombreIdees('bat|x')).toBe(0);
  });

  it('un effet qui lit le fil ne boucle pas (ouvrir, fermer, noter dans tous les sens)', () => {
    const m = nouveauMorceau('trap', 'Test');
    const motif = m.motifs[Object.keys(m.motifs)[0]!]!;
    let tours = 0;
    const stop = effect(() => {
      tours++;
      void nombreIdees('bat|y');
    });
    expect(() => {
      for (let i = 0; i < 20; i++) {
        ouvrirSession(m, null);
        noterIdee('bat|y', motif, i + 1);
        fermerSession();
      }
    }).not.toThrow();
    stop();
    expect(tours).toBeLessThanOrEqual(21);
    expect(versionIdees.value).toBeGreaterThan(0);
  });
});
