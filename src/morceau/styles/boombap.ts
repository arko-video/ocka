// Boom bap : 90 BPM, swing 0,2, kick et caisse poussiéreux, piano électrique, vinyle (vague B : son FIGÉ).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { MELODIE_PIANO, type DefinitionStyle } from './definition';

const boombap: DefinitionStyle = {
  id: 'boombap',
  famille: 'rap',
  textes: { nom: 'Boom bap', phrase: 'Kick et caisse poussiéreux, swing, piano et vinyle.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 90, plage: [84, 96], swing: 0.2, tonique: 'D', mode: 'mineur', son: 'piano', preset: 'chaud', kit: 'boombap@1' },
  // Caisse claire sur 2 et 4, charley ouvert / fermé, vinyle (pad perc) 2 fois par mesure.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', rim: '............x...', perc: 'x.......x.......' }),
    couplet: motifBatterie({
      kick: /*        */ 'X......X..X..... X.........X..x..',
      snare: /*       */ '....X.......X... ....X.......X..x',
      charley: /*     */ 'X.x.X.x.X.x.X.x. X.x.X.x.X.x.X...',
      charleyOuvert: /**/ '................ ..............o.',
      perc: /*        */ 'x.......x....... x.......x.......',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X......X..X..X.. X.X.......X.....',
      snare: /*       */ '....X.......X... ....X.......X.x.',
      charley: /*     */ 'X.xxX.x.X.xxX... X.xxX.x.X.xxX.x.',
      charleyOuvert: /**/ '..............o. ................',
      perc: /*        */ 'x.......x....... x.......x.......',
    }),
    pont: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', charley: 'x.x.x.x.x.x.x.x.', perc: 'x.......x.......' }),
  }),
  // Notes courtes et rondes, la quinte en dessous pour rebondir.
  basse: () => ({
    couplet: quatreMesures([n(0, 4, 0), n(7, 2, 0, { vel: 0.8 }), n(10, 4, 0, { vel: 0.9 })], [n(0, 4, 0), n(7, 3, 4, { octave: -1, vel: 0.8 }), n(10, 4, 0)]),
    refrain: quatreMesures([n(0, 4, 0), n(7, 2, 0, { vel: 0.8 }), n(10, 3, 2, { vel: 0.8 }), n(13, 3, 4, { vel: 0.7 })]),
  }),
  suites: [
    { nom: 'Vinyle', degres: ['i7', 'iv7', 'VImaj7', 'v7'] },
    { nom: 'Cave', degres: ['i7', 'i7', 'iv7', 'iv7'] },
    { nom: 'Soul', degres: ['VImaj7', 'v7', 'i7', 'i7'] },
  ],
  instrumentsParDefaut: [MELODIE_PIANO],
  boucles: [['refrain', 'epiano'], ['pince', 'epiano'], ['arpege', 'epiano'], ['contrechant', 'piano'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick et caisse claire « poussiéreux » (filtrés, saturation de bande), vinyle sur le pad perc.
      'boombap@1': {
        kick: { de: 150, a: 50, glisse: 0.045, tau: 0.12, duree: 0.38, clic: 0.4, force: 1.9 },
        snare: { corps: [185, 330], tauCorps: 0.055, tauBruit: 0.15, passeHaut: 900, passeBas: 8000, force: 2.0 },
        charley: { passeHaut: 6500, tauFerme: 0.028, tauOuvert: 0.32, passeBas: 10000 },
        sourdine: 8500,
        bande: 1.8,
        coupeBas: 45,
        vinyle: true,
        cretes: { perc: 0.3 },
      },
    },
    // Courte et sourde (comme une contrebasse).
    basse808: { tau: 0.55, force: 1.5, passeBas: 750, glisse: 0.08 },
    // 3 coups secs, comme un batteur.
    fill: [
      { pas: 11, vel: 0.45, roul: 0 },
      { pas: 14, vel: 0.65, roul: 0 },
      { pas: 15, vel: 0.85, roul: 0 },
    ],
  },
  onde: Array.from({ length: 24 }, (_, i) => [90, 20, 30, 15, 75, 20, 45, 15][i % 8]! - (i % 5) * 3),
};

export default boombap;
