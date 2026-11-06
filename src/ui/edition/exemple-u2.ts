// Outils des tests d'édition de U2 (mixage, automation, clips). Pas utilisé par l'appli.

import { expect } from 'vitest';
import { normaliserMorceau } from '../../morceau/normaliser';
import type { Morceau } from '../../morceau/types';
import { exempleMorceau } from './exemple';

/** Le morceau d'exemple passé au normaliseur (pistes au complet, dictionnaires sans prototype). */
export function base(): Morceau {
  return normaliserMorceau(exempleMorceau()).morceau;
}

/** Le normaliseur accepte le morceau tel quel. */
export function propre(m: Morceau) {
  expect(normaliserMorceau(m).problemes).toEqual([]);
}
