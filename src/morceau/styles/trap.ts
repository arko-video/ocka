// Trap : 140 BPM en demi-tempo, gros 808, charleys qui roulent (phases 0 à 6 : son FIGÉ, test nul et empreintes).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { MELODIE_PIANO, type DefinitionStyle } from './definition';

const trap: DefinitionStyle = {
  id: 'trap',
  famille: 'rap',
  textes: { nom: 'Trap', phrase: 'Gros 808, charleys qui roulent. Le son du rap d’aujourd’hui.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 140, plage: [130, 150], swing: 0, tonique: 'F', mode: 'mineur', son: 'nappe', preset: 'neutre', kit: 'trap@1' },
  // Caisse claire sur le 3e temps, charley en roulements.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', perc: '..........x.....' }, { charley: '..............3.' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X......o..X..... X.........X..o..',
        snare: /*  */ '........X....... ........X.......',
        charley: /**/ 'X.o.X.o.X.o.X.o. X.o.X.o.X.o.X.ox',
        perc: /*   */ '................ ...........x....',
      },
      { charley: '......3.......4. ..........2...6.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X..o...o..X..... X......o..X..o..',
        snare: /*       */ '........X....... ........X.......',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'XxoxXxoxXxoxXxox XxoxXxoxXxoxXxo.',
        charleyOuvert: /**/ '................ ..............o.',
      },
      { charley: '...3.......4..6. .....2.....3.4..' },
    ),
    pont: motifBatterie({ kick: 'X.........o.....', rim: '........o.......', charley: 'x...x...x...x...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 7), n(10, 6)], [n(0, 7), n(10, 3), n(13, 3, 0, { octave: 1, vel: 0.8 })]),
    refrain: quatreMesures([n(0, 3), n(3, 4), n(10, 4), n(14, 2, 0, { octave: 1, vel: 0.8 })]),
  }),
  suites: [
    { nom: 'Sombre', degres: ['i', 'VI', 'III', 'VII'] },
    { nom: 'Tendu', degres: ['i', 'iv', 'VI', 'V'] },
    { nom: 'Planant', degres: ['i', 'VII', 'VI', 'VII'] },
  ],
  instrumentsParDefaut: [MELODIE_PIANO],
  boucles: [['arpege', 'pluck'], ['cloche', 'cloche'], ['contrechant', 'lead'], ['refrain', 'piano'], ['nappe', 'nappe'], ['pince', 'pluck']],
  son: {
    kits: {
      'trap@1': {
        kick: { de: 230, a: 52, glisse: 0.04, tau: 0.11, duree: 0.42, clic: 0.5, force: 1.8 },
        snare: { corps: [190, 340], tauCorps: 0.045, tauBruit: 0.11, passeHaut: 1500, passeBas: 11000, force: 1.6 },
        charley: { passeHaut: 7500, tauFerme: 0.022, tauOuvert: 0.28, passeBas: 16000 },
        sourdine: 20000,
      },
    },
    basse808: { tau: 1.6, force: 2.0, passeBas: 2200, glisse: 0.09 },
    fill: [
      { pas: 12, vel: 0.5, roul: 2 },
      { pas: 13, vel: 0.6, roul: 2 },
      { pas: 14, vel: 0.75, roul: 3 },
      { pas: 15, vel: 0.9, roul: 4 },
    ],
  },
  onde: [90, 20, 35, 20, 60, 20, 35, 80],
};

export default trap;
