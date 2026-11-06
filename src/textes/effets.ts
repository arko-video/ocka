// Textes des effets par piste, de l'automation et du sidechain (noms affichés). Propriétaire : M2.

import type { TypeEffet } from '../morceau/types';

export const TEXTES_EFFETS = {
  effets: {
    titre: (n: number) => `Effets (${n})`,
    noms: {
      eq: 'Égaliseur',
      filtre: 'Filtre',
      compresseur: 'Compresseur',
      saturation: 'Saturation',
      bitcrusher: 'Bitcrusher',
      chorus: 'Chorus',
      flanger: 'Flanger',
      phaser: 'Phaser',
      'envoi-reverbe': 'Réverbe',
      'envoi-echo': 'Écho',
    } satisfies Record<TypeEffet, string>,
    pompe: 'Pompe',
    pompeAide: 'La piste baisse un peu à chaque kick : le « pompage » de la house et du rap.',
  },
};
