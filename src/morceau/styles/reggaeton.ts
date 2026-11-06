// Reggaeton : 95 BPM, le dembow (kick à chaque temps, caisse claire sur le « a » de 1, le « et » de 2, le « a »
// de 3 et le « et » de 4 : boum-tchk-boum-tchk), 808 qui suit le kick, guitare nylon en arpèges à l'intro et
// au refrain, pluck OCKA au couplet, bongos au refrain.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, percus } from '../styles-ecriture';

const reggaeton: DefinitionStyle = {
  id: 'reggaeton',
  famille: 'monde',
  textes: { nom: 'Reggaeton', phrase: 'Le dembow : boum-tchk-boum-tchk, impossible de rester assis.' },
  genre: 'Latin',
  reglages: { tempo: 95, plage: [88, 102], swing: 0, tonique: 'B', mode: 'mineur', son: 'nappe', preset: 'neutre', kit: 'reggaeton@1', volumes: { accords: 0.3 } },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', rim: '...x..x....x..x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X...X...X...X...',
      snare: /*  */ '...X..X....X..X.',
      charley: /**/ 'x.x.x.x.x.x.x.x.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      snare: /*       */ '...X..X....X..X.',
      clap: /*        */ '...x..x....x..x.',
      charley: /*     */ 'x.xxx.xxx.xxx.xx',
      charleyOuvert: /**/ '................ ..............o.',
      perc: /*        */ '.x.......x...... .x.....x........',
    }),
    pont: motifBatterie({ kick: 'X...............', snare: '...x..x....x..x.', charley: 'x...x...x...x...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 3, 0), n(4, 3, 0, { vel: 0.8 }), n(8, 3, 0), n(12, 3, 0, { vel: 0.8 })]),
    refrain: quatreMesures([n(0, 3, 0), n(3, 1, 0, { octave: 1, vel: 0.6 }), n(4, 3, 0, { vel: 0.8 }), n(8, 3, 0), n(11, 1, 0, { octave: 1, vel: 0.6 }), n(12, 3, 4, { vel: 0.8 })]),
  }),
  suites: [
    { nom: 'Perreo', degres: ['i', 'VI', 'III', 'VII'] },
    { nom: 'Noche', degres: ['i', 'iv', 'VII', 'III'] },
    { nom: 'Calle', degres: ['i', 'VII', 'VI', 'VII'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Guitare nylon', instrument: 'freepats-guitare-nylon@1', role: 'arpege', volume: 0.9, pan: 0.15, notes: { ecrire: boucleDans('arpege', 55, 79, 0.85), sections: ['intro', 'refrain'], idMotif: 'reggaeton-nylon' } },
    { id: 'pluck', nom: 'Pluck', instrument: 'ocka-pluck@1', role: 'contrechant', volume: 0.8, pan: -0.25, notes: { ecrire: 'pince', sections: ['couplet'], idMotif: 'reggaeton-pluck' } },
    {
      id: 'bongos',
      nom: 'Bongos',
      instrument: 'vcsl-percussions-latines@1',
      role: 'percussions',
      volume: 1.3,
      pan: 0.3,
      notes: { ecrire: percus({ 60: '..o...o...o..o.. ..o...o...o.o.o.', 61: '......X.......X. ......X.....X...' }), sections: ['refrain'], idMotif: 'reggaeton-bongos' },
    },
  ],
  boucles: [['pince', 'pluck'], ['arpege', 'pluck'], ['refrain', 'lead'], ['contrechant', 'lead'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick qui cogne, caisse claire sèche et claquante (le « tchk »), charley clair.
      'reggaeton@1': {
        kick: { de: 190, a: 50, glisse: 0.03, tau: 0.11, duree: 0.38, clic: 0.6, force: 2.1 },
        snare: { corps: [240, 420], tauCorps: 0.03, tauBruit: 0.08, passeHaut: 1800, passeBas: 13000, force: 2.2 },
        charley: { passeHaut: 8000, tauFerme: 0.025, tauOuvert: 0.24, passeBas: 16000 },
        sourdine: 20000,
        perc: 780,
      },
    },
    basse808: { tau: 0.6, force: 2.0, passeBas: 1800, glisse: 0.06 },
    fill: [{ pas: 11, vel: 0.55, roul: 0 }, { pas: 12, vel: 0.65, roul: 2 }, { pas: 14, vel: 0.8, roul: 2 }, { pas: 15, vel: 0.9, roul: 3 }],
  },
  onde: [90, 30, 30, 75, 30, 30, 80, 30],
};

export default reggaeton;
