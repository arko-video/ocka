// Lo-fi : 85 BPM, swing 0,25, accords jazzy au piano électrique lo-fi (phases 0 à 6 : son FIGÉ). Intégration C3 :
// la piste mélodie (vide au départ) joue le Rhodes d'OCKA (empreinte du morceau neuf mise à jour, volontairement).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { MELODIE_PIANO, type DefinitionStyle } from './definition';

const lofi: DefinitionStyle = {
  id: 'lofi',
  famille: 'rap',
  textes: { nom: 'Lo-fi', phrase: 'Doux, swingué, accords jazzy. Pour poser tranquille.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 85, plage: [72, 92], swing: 0.25, tonique: 'F', mode: 'majeur', son: 'piano', preset: 'lofi', kit: 'lofi@1' },
  // Caisse claire sur 2 et 4, charley doux et irréguliers (pas de roulements).
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }),
    couplet: motifBatterie({
      kick: /*   */ 'X......o..X..... X.....o...X..x..',
      snare: /*  */ '....X.......X... ....X.......X..x',
      charley: /**/ 'o.xxo.x.o.xxo.x. o.xxo.x.o.xxo.xx',
      rim: /*    */ '................ .......x........',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X......o..X..... X.....o...X..x..',
      snare: /*       */ '....X.......X... ....X.......X..x',
      charley: /*     */ 'oxxxoxxxoxxxoxxx oxxxoxxxoxxxoxx.',
      charleyOuvert: /**/ '................ ...............x',
      perc: /*        */ '......x......... ......x.....x...',
    }),
    pont: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', charley: 'x...x...x...x...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 8, 0, { vel: 0.85 }), n(10, 4, 4, { vel: 0.7 })]),
    refrain: quatreMesures([n(0, 6, 0, { vel: 0.85 }), n(7, 3, 2, { vel: 0.6 }), n(10, 6, 4, { vel: 0.7 })]),
  }),
  suites: [
    { nom: 'Café', degres: ['Imaj7', 'vi7', 'ii7', 'V7'] },
    { nom: 'Pluie', degres: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
    { nom: 'Nuit', degres: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
  ],
  instrumentsParDefaut: [{ ...MELODIE_PIANO, nom: 'Rhodes', instrument: 'ocka-rhodes@1' }],
  boucles: [['refrain', 'epiano'], ['arpege', 'epiano'], ['contrechant', 'piano'], ['pince', 'epiano'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      'lofi@1': {
        kick: { de: 160, a: 48, glisse: 0.05, tau: 0.14, duree: 0.45, clic: 0.2, force: 1.4 },
        snare: { corps: [175, 310], tauCorps: 0.06, tauBruit: 0.14, passeHaut: 900, passeBas: 6500, force: 1.3 },
        charley: { passeHaut: 6000, tauFerme: 0.03, tauOuvert: 0.3, passeBas: 9000 },
        sourdine: 7500,
        perc: 640,
      },
    },
    basse808: { tau: 0.7, force: 1.3, passeBas: 900, glisse: 0.08 },
    fill: [
      { pas: 13, vel: 0.4, roul: 0 },
      { pas: 14, vel: 0.6, roul: 0 },
      { pas: 15, vel: 0.8, roul: 0 },
    ],
    variantes: { epiano: 'lofi' },
  },
};

export default lofi;
