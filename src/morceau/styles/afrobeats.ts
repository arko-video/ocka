// Afrobeats : 106 BPM, groove qui chaloupe (léger swing). Rim en 3-3-2, kick souple, shaker en double-croches,
// percussions latines enregistrées (congas, shaker), guitare claire en arpèges picorés façon highlife, 808 qui
// rebondit, kalimba au refrain.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne, percus } from '../styles-ecriture';

const afrobeats: DefinitionStyle = {
  id: 'afrobeats',
  famille: 'monde',
  textes: { nom: 'Afrobeats', phrase: 'Percus qui chaloupent, guitare légère, soleil garanti.' },
  genre: 'African',
  reglages: { tempo: 106, plage: [98, 118], swing: 0.12, tonique: 'A', mode: 'majeur', son: 'piano', preset: 'chaud', kit: 'afrobeats@1', volumes: { batterie: 0.7, accords: 0.28, basse: 0.7 } },
  batterie: () => ({
    intro: motifBatterie({ charley: 'xxoxxxoxxxoxxxox', rim: '...x..x....x..x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X......X..X..... X......X..X...x.',
      rim: /*    */ '...x..x....x..x.',
      clap: /*   */ '....x.......x...',
      charley: /**/ 'xxoxxxoxxxoxxxox',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X......X..X..... X......X..X...x.',
      rim: /*         */ '...x..x....x..x.',
      clap: /*        */ '....X.......X...',
      charley: /*     */ 'xxoxxxoxxxoxxxox',
      charleyOuvert: /**/ '................ ......o.........',
      perc: /*        */ '..x.....x.x..... ..x...x...x..x..',
    }),
    pont: motifBatterie({ rim: '...x..x....x..x.', charley: 'x.o.x.o.x.o.x.o.', kick: 'X...............' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 3, 0), n(7, 2, 0, { vel: 0.75 }), n(10, 3, 4, { vel: 0.8 }), n(14, 2, 0, { octave: 1, vel: 0.6 })]),
    refrain: quatreMesures([n(0, 3, 0), n(3, 2, 0, { octave: 1, vel: 0.6 }), n(7, 2, 0, { vel: 0.75 }), n(10, 3, 4, { vel: 0.8 }), n(14, 2, 5, { vel: 0.65 })]),
  }),
  suites: [
    { nom: 'Lagos', degres: ['ii7', 'V', 'Imaj7', 'vi7'] },
    { nom: 'Plage', degres: ['vi', 'IV', 'I', 'V'] },
    { nom: 'Danse', degres: ['I', 'iii', 'IV', 'V'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Kalimba', instrument: 'freepats-kalimba@1', role: 'melodie', volume: 1.0, pan: 0.2, notes: { ecrire: boucleDans('pince', 60, 76, 1), sections: ['refrain'], idMotif: 'afro-kalimba' } },
    {
      id: 'guitare',
      nom: 'Guitare highlife',
      instrument: 'freepats-guitare-claire@1',
      role: 'arpege',
      volume: 1.2,
      pan: -0.3,
      notes: {
        ecrire: ligne([[[0, 1, 'O', 0.8], [2, 1, 'T', 0.6], [3, 1, 'Q', 0.7], [6, 1, 'O', 0.75], [8, 1, 'Q', 0.6], [10, 1, 'T', 0.7], [11, 1, 'O', 0.65], [14, 1, 'Q', 0.6]]], 52),
        sections: ['couplet', 'refrain'],
        idMotif: 'afro-guitare',
      },
    },
    {
      id: 'percussions',
      nom: 'Congas et shaker',
      instrument: 'vcsl-percussions-latines@1',
      role: 'percussions',
      volume: 1.3,
      pan: 0.25,
      notes: {
        ecrire: percus({
          70: 'oxXxoxXxoxXxoxXx',
          62: '..x.......x..x.. ..x.......x.....',
          63: '......X....X.... ......X....X..X.',
          64: '.............X.. ................',
        }),
        sections: ['couplet', 'refrain'],
        idMotif: 'afro-percus',
      },
    },
  ],
  boucles: [['pince', 'pluck'], ['arpege', 'pluck'], ['refrain', 'lead'], ['contrechant', 'epiano'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick rond, rim sec, charley fin comme un shaker, « tok » grave comme une conga.
      'afrobeats@1': {
        kick: { de: 150, a: 48, glisse: 0.04, tau: 0.11, duree: 0.4, clic: 0.3, force: 1.6 },
        snare: { corps: [210, 360], tauCorps: 0.035, tauBruit: 0.1, passeHaut: 1500, passeBas: 11000, force: 1.5 },
        charley: { passeHaut: 9000, tauFerme: 0.03, tauOuvert: 0.25, passeBas: 15000 },
        sourdine: 18000,
        perc: 520,
        cretes: { charley: 0.26 },
      },
    },
    basse808: { tau: 0.5, force: 1.6, passeBas: 900, glisse: 0.06 },
    fill: [{ pas: 11, vel: 0.5, roul: 0 }, { pas: 13, vel: 0.6, roul: 0 }, { pas: 14, vel: 0.7, roul: 0 }, { pas: 15, vel: 0.85, roul: 0 }],
  },
  onde: [70, 35, 55, 80, 35, 60, 45, 75],
};

export default afrobeats;
