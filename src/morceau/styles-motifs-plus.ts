// Les styles de la vague B : phonk, pop et boom bap (batterie, ligne de 808, suites d'accords).
// Même écriture en grilles que styles-motifs.ts : 'X' fort, 'o' moyen, 'x' doux, '.' rien ; 16 pas = 1 mesure.

import { motifBatterie, n, quatreMesures, type QuatreMotifs } from './styles-grilles';
import type { MotifBasse } from './types';

type StylePlus = 'phonk' | 'pop' | 'boombap';

export const BATTERIES_PLUS: Record<StylePlus, () => QuatreMotifs> = {
  // Phonk : 135 BPM en demi-tempo (caisse claire sèche sur le 3e temps), charley en triolets (roulements de 3).
  // La cloche mélodique est une mélodie (voir styles.ts), accordée sur la tonalité.
  phonk: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', perc: '................ ...........x....' }, { charley: '......3.......3. ..3.......3...3.' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X.....X...X..... X.....X..X...o..',
        snare: /*  */ '........X....... ........X.......',
        charley: /**/ 'X.x.X.x.X.x.X.x. X.x.X.x.X.x.X.x.',
        perc: /*   */ '................ ...........x....',
      },
      { charley: '..3...3...3...3. ..3...3.....3.3.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X.....X...X..X.. X.....X..X..X...',
        snare: /*       */ '........X....... ........X.......',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'XxXxXxXxXxXxXxXx XxXxXxXxXxXxXx.x',
        charleyOuvert: /**/ '................ ..............o.',
      },
      { charley: '.....3.......3.. .....3.....3.3..' },
    ),
    pont: motifBatterie({ kick: 'X.........X.....', snare: '........o.......', charley: 'x..x..x..x..x.x.' }, { charley: '............3...' }),
  }),
  // Pop : 110 BPM, kick franc, clap sur 2 et 4 (doublé d'une caisse claire douce), charley en croches.
  pop: () => ({
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
  // Boom bap : 90 BPM, swing 0,2, caisse claire sur 2 et 4, charley ouvert / fermé, vinyle (pad perc) 2 fois par mesure.
  boombap: () => ({
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
};

export const BASSES_PLUS: Record<StylePlus, () => { couplet: MotifBasse; refrain: MotifBasse }> = {
  // Phonk : notes longues qui glissent vers l'octave et vers l'accord suivant.
  phonk: () => ({
    couplet: quatreMesures([n(0, 10, 0, { glisse: true }), n(10, 6, 0, { octave: 1, glisse: true })]),
    refrain: quatreMesures(
      [n(0, 6, 0), n(6, 4, 0, { octave: 1, glisse: true }), n(10, 6, 0, { glisse: true })],
      [n(0, 6, 0), n(6, 4, 0, { octave: 1 }), n(10, 3, 0), n(13, 3, 0, { octave: 1, glisse: true })],
    ),
  }),
  // Pop : calée sur le kick ; au refrain, des octaves qui sautent.
  pop: () => ({
    couplet: quatreMesures([n(0, 6, 0), n(6, 2, 0, { vel: 0.8 }), n(8, 8, 0)]),
    refrain: quatreMesures([n(0, 4), n(4, 2, 0, { octave: 1, vel: 0.7 }), n(6, 2), n(8, 4), n(12, 2, 0, { octave: 1, vel: 0.7 }), n(14, 2)]),
  }),
  // Boom bap : notes courtes et rondes, la quinte en dessous pour rebondir.
  boombap: () => ({
    couplet: quatreMesures([n(0, 4, 0), n(7, 2, 0, { vel: 0.8 }), n(10, 4, 0, { vel: 0.9 })], [n(0, 4, 0), n(7, 3, 4, { octave: -1, vel: 0.8 }), n(10, 4, 0)]),
    refrain: quatreMesures([n(0, 4, 0), n(7, 2, 0, { vel: 0.8 }), n(10, 3, 2, { vel: 0.8 }), n(13, 3, 4, { vel: 0.7 })]),
  }),
};

/** Les 3 suites d'accords de chaque style (degrés romains, 1 accord par mesure). */
export const SUITES_PLUS: Record<StylePlus, { nom: string; degres: string[] }[]> = {
  phonk: [
    { nom: 'Memphis', degres: ['i', 'iv', 'VI', 'V'] },
    { nom: 'Dérive', degres: ['i', 'bII', 'i', 'VII'] },
    { nom: 'Fumée', degres: ['i', 'VII', 'VI', 'v'] },
  ],
  pop: [
    { nom: 'Tube', degres: ['I', 'V', 'vi', 'IV'] },
    { nom: 'Émotion', degres: ['vi', 'IV', 'I', 'V'] },
    { nom: 'Soleil', degres: ['I', 'vi', 'IV', 'V'] },
  ],
  boombap: [
    { nom: 'Vinyle', degres: ['i7', 'iv7', 'VImaj7', 'v7'] },
    { nom: 'Cave', degres: ['i7', 'i7', 'iv7', 'iv7'] },
    { nom: 'Soul', degres: ['VImaj7', 'v7', 'i7', 'i7'] },
  ],
};
