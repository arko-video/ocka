// Réglages de la vue Mélodie gardés d'un onglet à l'autre (pas dans le morceau) : octave des pads et durée des notes.

import { signal } from '@preact/signals';
import type { Octave } from '../../edition/melodie';

export const octaveMelodie = signal<Octave>(0);
/** Durée des notes posées (grille et clavier), en pas : 1 = 1/16, 2 = 1/8, 4 = 1/4, 8 = 1/2. */
export const dureeNote = signal(2);
