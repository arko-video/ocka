// Les motifs de départ de chaque style (batterie, ligne de 808, suites d'accords), écrits comme des grilles
// lisibles (voir styles-grilles.ts). Trap, drill et lo-fi sont ici ; phonk, pop et boom bap dans styles-motifs-plus.ts.

import { motifBatterie, n, quatreMesures, type QuatreMotifs } from './styles-grilles';
import { BASSES_PLUS, BATTERIES_PLUS, SUITES_PLUS } from './styles-motifs-plus';
import type { MotifBasse, Style } from './types';

export { frappes, motifBatterie, roulements, type QuatreMotifs } from './styles-grilles';

export const BATTERIES: Record<Style, () => QuatreMotifs> = {
  // Trap : 140 BPM en demi-tempo (caisse claire sur le 3e temps), charley en roulements.
  trap: () => ({
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
  // Drill : 142 BPM, charley groupés par 3 (le rebond drill), caisse claire sur le 3e temps et en contretemps.
  drill: () => ({
    intro: motifBatterie({ charley: 'x..x..x..x..x.x.' }, { charley: '.........3......' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X.........o..... ..o.......X.....',
        snare: /*  */ '........X....... ........X..x....',
        charley: /**/ 'X..o..X..o..X.o. X..o..X..o..X.o.',
        perc: /*   */ '.....x.......... .....x.....x....',
      },
      { charley: '...3........4... ......3.....6...' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X.........o..o.. ..o.......X.....',
        snare: /*       */ '........X......x ........X..x....',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'X.oo.oX.oo.oX.o. X.oo.oX.oo.oX.oo',
        charleyOuvert: /**/ '.......o........ ................',
        perc: /*        */ '.....x.......... .....x.....x....',
      },
      { charley: '..3..4......3... ..3.....4...6...' },
    ),
    pont: motifBatterie({ kick: 'X...............', snare: '........o.......', charley: 'x..x..x..x..x.x.' }),
  }),
  // Lo-fi : 85 BPM, swing 0,25, caisse claire sur 2 et 4, charley doux et irréguliers (pas de roulements).
  lofi: () => ({
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
  ...BATTERIES_PLUS,
};

/** La ligne de 808 de chaque style (couplet et refrain). */
export const BASSES: Record<Style, () => { couplet: MotifBasse; refrain: MotifBasse }> = {
  trap: () => ({
    couplet: quatreMesures([n(0, 7), n(10, 6)], [n(0, 7), n(10, 3), n(13, 3, 0, { octave: 1, vel: 0.8 })]),
    refrain: quatreMesures([n(0, 3), n(3, 4), n(10, 4), n(14, 2, 0, { octave: 1, vel: 0.8 })]),
  }),
  drill: () => ({
    couplet: quatreMesures([n(0, 8, 0, { glisse: true }), n(8, 2, 0, { octave: 1 }), n(10, 6)]),
    refrain: quatreMesures(
      [n(0, 6, 0, { glisse: true }), n(6, 4, 0, { octave: 1, glisse: true }), n(10, 6, 4, { octave: -1 })],
      [n(0, 8, 0, { glisse: true }), n(8, 4, 0, { octave: 1, glisse: true }), n(12, 4)],
    ),
  }),
  lofi: () => ({
    couplet: quatreMesures([n(0, 8, 0, { vel: 0.85 }), n(10, 4, 4, { vel: 0.7 })]),
    refrain: quatreMesures([n(0, 6, 0, { vel: 0.85 }), n(7, 3, 2, { vel: 0.6 }), n(10, 6, 4, { vel: 0.7 })]),
  }),
  ...BASSES_PLUS,
};


/** Les 3 suites d'accords de chaque style (degrés romains, 1 accord par mesure). */
export const SUITES: Record<Style, { nom: string; degres: string[] }[]> = {
  trap: [
    { nom: 'Sombre', degres: ['i', 'VI', 'III', 'VII'] },
    { nom: 'Tendu', degres: ['i', 'iv', 'VI', 'V'] },
    { nom: 'Planant', degres: ['i', 'VII', 'VI', 'VII'] },
  ],
  drill: [
    { nom: 'Menace', degres: ['i', 'VI', 'iv', 'V'] },
    { nom: 'Froid', degres: ['i', 'iv', 'i', 'V7'] },
    { nom: 'Rue', degres: ['i', 'bII', 'VI', 'V'] },
  ],
  lofi: [
    { nom: 'Café', degres: ['Imaj7', 'vi7', 'ii7', 'V7'] },
    { nom: 'Pluie', degres: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
    { nom: 'Nuit', degres: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
  ],
  ...SUITES_PLUS,
};
