// État d'affichage de la frise (pas dans le morceau) : zoom, clip visé par le menu, couloirs d'automation ouverts
// (avec leur cible) et point sélectionné. Propriétaire : U2.

import { signal } from '@preact/signals';
import type { Cible } from '../../../morceau/types';

/** Panneaux de la frise (ouverts par ouvrirPanneau, fermés par Retour). */
export const PANNEAUX_FRISE = { clip: 'frise-clip', automation: 'frise-automation' } as const;

/** Pixels par pas (2 = 32 px par mesure). */
export const ZOOMS = [1, 1.5, 2, 3, 4] as const;
export const zoomFrise = signal<number>(2);

/** Clip visé par le menu (appui long). */
export const clipVise = signal<{ piste: string; section: string } | null>(null);

/** Couloirs d'automation ouverts : id de piste → cible dessinée. */
export const couloirs = signal<Record<string, Cible>>({});
/** Piste dont le panneau d'automation (cible, LFO) est ouvert. */
export const pisteAutomation = signal<string | null>(null);

/** Point sélectionné dans un couloir (pour « Enlever le point »). */
export const pointChoisi = signal<{ piste: string; section: string; indice: number } | null>(null);

export function basculerCouloir(idPiste: string) {
  const c = { ...couloirs.peek() };
  if (c[idPiste]) delete c[idPiste];
  else c[idPiste] = { type: 'volume' };
  couloirs.value = c;
  pointChoisi.value = null;
}

export function choisirCibleCouloir(idPiste: string, cible: Cible) {
  couloirs.value = { ...couloirs.peek(), [idPiste]: cible };
  pointChoisi.value = null;
}
