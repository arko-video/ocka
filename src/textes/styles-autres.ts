// Textes de l'écran du choix du style par familles, avec la recherche (vague C2). Propriétaire : S2.
// Le nom et la phrase de chaque style sont dans SON fichier (morceau/styles/<id>.ts, `textes`).

import type { FamilleStyle } from '../morceau/styles/index';

export const TEXTES_STYLES_AUTRES = {
  choixStyle: {
    familles: {
      rap: 'Rap',
      electro: 'Électro',
      monde: 'Monde',
      poprockjazz: 'Pop, rock et jazz',
      cinema: 'Cinéma et ambiance',
    } satisfies Record<FamilleStyle, string>,
    /** Noms courts des puces de navigation (une ligne sur 360 px). */
    puces: { rap: 'Rap', electro: 'Électro', monde: 'Monde', poprockjazz: 'Pop/Rock/Jazz', cinema: 'Cinéma' } satisfies Record<FamilleStyle, string>,
    allerFamilles: 'Aller à une famille de styles',
    recherche: 'Chercher un style',
    rechercheAide: 'Un nom de style : trap, house, bossa…',
    aucun: (q: string) => `Aucun style ne s’appelle « ${q} ».`,
    nombre: (n: number) => (n > 1 ? `${n} styles` : `${n} style`),
    hasardFamille: 'Au hasard',
    hasardFamilleAide: (famille: string) => `Un style ${famille} tiré au hasard, à un tempo de son style`,
    ecouter: (nom: string) => `Écouter 4 mesures de ${nom}`,
    arreter: (nom: string) => `Arrêter l’écoute de ${nom}`,
    chargement: 'Préparation de l’écoute…',
    ecouteImpossible: 'L’écoute n’a pas pu démarrer. Tu peux choisir le style quand même.',
  },
};
