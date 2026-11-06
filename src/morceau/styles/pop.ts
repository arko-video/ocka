// Pop : 110 BPM, kick franc, clap sur 2 et 4, charley en croches, accords au piano (vague B : son FIGÉ).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { MELODIE_PIANO, type DefinitionStyle } from './definition';

const pop: DefinitionStyle = {
  id: 'pop',
  famille: 'poprockjazz',
  textes: { nom: 'Pop', phrase: 'Batterie franche, clap sur 2 et 4, accords au piano.' },
  genre: 'Pop',
  reglages: { tempo: 110, plage: [98, 122], swing: 0, tonique: 'C', mode: 'majeur', son: 'piano', preset: 'clair', kit: 'pop@1' },
  batterie: () => ({
    intro: motifBatterie({ kick: 'X.......X.......', charley: 'x.x.x.x.x.x.x.x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X.....X.X....... X.....X.X.....x.',
      snare: /*  */ '....x.......x... ....x.......x...',
      clap: /*   */ '....X.......X... ....X.......X...',
      charley: /**/ 'X.x.X.x.X.x.X.x. X.x.X.x.X.x.X.x.',
    }),
    // Refrain : kick à chaque temps, charley ouvert sur les contretemps (pop dansante).
    refrain: motifBatterie({
      kick: /*        */ 'X...X...X...X... X...X...X...X...',
      snare: /*       */ '....o.......o... ....o.......o..x',
      clap: /*        */ '....X.......X... ....X.......X...',
      charley: /*     */ 'x...x...x...x... x...x...x...x...',
      charleyOuvert: /**/ '..o...o...o...o. ..o...o...o...o.',
    }),
    pont: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', charley: 'x.x.x.x.x.x.x.x.' }),
  }),
  // Calée sur le kick ; au refrain, des octaves qui sautent.
  basse: () => ({
    couplet: quatreMesures([n(0, 6, 0), n(6, 2, 0, { vel: 0.8 }), n(8, 8, 0)]),
    refrain: quatreMesures([n(0, 4), n(4, 2, 0, { octave: 1, vel: 0.7 }), n(6, 2), n(8, 4), n(12, 2, 0, { octave: 1, vel: 0.7 }), n(14, 2)]),
  }),
  suites: [
    { nom: 'Tube', degres: ['I', 'V', 'vi', 'IV'] },
    { nom: 'Émotion', degres: ['vi', 'IV', 'I', 'V'] },
    { nom: 'Soleil', degres: ['I', 'vi', 'IV', 'V'] },
  ],
  instrumentsParDefaut: [MELODIE_PIANO],
  boucles: [['refrain', 'piano'], ['arpege', 'pluck'], ['pince', 'piano'], ['contrechant', 'lead'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick franc et court, clap bien net, charley clair.
      'pop@1': {
        kick: { de: 190, a: 52, glisse: 0.03, tau: 0.085, duree: 0.34, clic: 0.8, force: 1.7 },
        snare: { corps: [200, 360], tauCorps: 0.04, tauBruit: 0.12, passeHaut: 1300, passeBas: 12000, force: 1.6 },
        charley: { passeHaut: 7000, tauFerme: 0.03, tauOuvert: 0.3, passeBas: 15000 },
        sourdine: 20000,
      },
    },
    // Ronde, propre.
    basse808: { tau: 1.0, force: 1.5, passeBas: 1500, glisse: 0.08 },
    // Croches puis double-croches.
    fill: [8, 10, 12, 13, 14, 15].map((pas, k) => ({ pas, vel: 0.45 + k * 0.1, roul: 0 })),
  },
  onde: [80, 30, 55, 30],
};

export default pop;
