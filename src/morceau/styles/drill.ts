// Drill : 142 BPM, charleys groupés par 3 (le rebond drill), 808 qui glissent (phases 0 à 6 : son FIGÉ).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { MELODIE_PIANO, type DefinitionStyle } from './definition';

const drill: DefinitionStyle = {
  id: 'drill',
  famille: 'rap',
  textes: { nom: 'Drill', phrase: '808 qui glissent, rythme sombre et sautillant.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 142, plage: [138, 146], swing: 0, tonique: 'C#', mode: 'mineur', son: 'nappe', preset: 'neutre', kit: 'drill@1' },
  // Caisse claire sur le 3e temps et en contretemps.
  batterie: () => ({
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
  basse: () => ({
    couplet: quatreMesures([n(0, 8, 0, { glisse: true }), n(8, 2, 0, { octave: 1 }), n(10, 6)]),
    refrain: quatreMesures(
      [n(0, 6, 0, { glisse: true }), n(6, 4, 0, { octave: 1, glisse: true }), n(10, 6, 4, { octave: -1 })],
      [n(0, 8, 0, { glisse: true }), n(8, 4, 0, { octave: 1, glisse: true }), n(12, 4)],
    ),
  }),
  suites: [
    { nom: 'Menace', degres: ['i', 'VI', 'iv', 'V'] },
    { nom: 'Froid', degres: ['i', 'iv', 'i', 'V7'] },
    { nom: 'Rue', degres: ['i', 'bII', 'VI', 'V'] },
  ],
  instrumentsParDefaut: [MELODIE_PIANO],
  boucles: [['contrechant', 'piano'], ['arpege', 'pluck'], ['refrain', 'lead'], ['cloche', 'cloche'], ['nappe', 'nappe'], ['pince', 'piano']],
  son: {
    kits: {
      'drill@1': {
        kick: { de: 260, a: 55, glisse: 0.03, tau: 0.08, duree: 0.32, clic: 0.65, force: 2.2 },
        snare: { corps: [230, 410], tauCorps: 0.035, tauBruit: 0.085, passeHaut: 2200, passeBas: 13000, force: 2.0 },
        charley: { passeHaut: 8500, tauFerme: 0.018, tauOuvert: 0.22, passeBas: 17000 },
        sourdine: 20000,
        perc: 1150,
      },
    },
    basse808: { tau: 1.4, force: 2.6, passeBas: 2600, glisse: 0.11 },
    // Fill : celui de la trap (roulements).
  },
  onde: [85, 15, 30, 70, 15, 55, 25, 40],
};

export default drill;
