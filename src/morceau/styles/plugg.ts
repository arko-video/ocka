// Plugg : 150 BPM en demi-tempo, majeur et rêveur : cloche en arpège, nappe qui flotte, piano électrique doux,
// charley léger, 808 qui rebondit et glisse vers l'octave (vague C2, S1).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const plugg: DefinitionStyle = {
  id: 'plugg',
  famille: 'rap',
  textes: { nom: 'Plugg', phrase: 'Cloche et nappe qui flottent, 808 qui rebondit : doux et rêveur.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 150, plage: [140, 165], swing: 0, tonique: 'A#', mode: 'majeur', son: 'piano', preset: 'neutre', kit: 'plugg@1', volumes: { accords: 0.32 } },
  // Caisse claire sur le 3e temps, charley léger en croches, « bloop » aigu (perc) qui répond.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x...x...x...x...', perc: '..........x..... ...x............' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X......X..X..... X.....X......X..',
        snare: /*  */ '........X....... ........X.......',
        charley: /**/ 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.',
        perc: /*   */ '...x............ ...x.......x....',
      },
      { charley: '................ ..............2.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X......X..X..X.. X.....X......X..',
        snare: /*       */ '........X....... ........X.......',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'x.xxx.x.x.xxx.x. x.xxx.x.x.xxx...',
        charleyOuvert: /**/ '................ ..............o.',
        perc: /*        */ '...x............ ...x.......x....',
      },
      { charley: '......2......... ......2.....2...' },
    ),
    pont: motifBatterie({ kick: 'X.........X.....', snare: '........x.......', charley: 'x...x...x...x...', perc: '...x............' }),
  }),
  // Rebonds : la fondamentale, un saut à l'octave qui glisse, puis retour.
  basse: () => ({
    couplet: quatreMesures([n(0, 6, 0), n(7, 3, 0, { octave: 1, glisse: true }), n(10, 6, 0)]),
    refrain: quatreMesures([n(0, 3, 0), n(3, 4, 0, { glisse: true }), n(7, 3, 0, { octave: 1, vel: 0.85 }), n(10, 4, 0, { glisse: true }), n(14, 2, 4, { vel: 0.8 })]),
  }),
  suites: [
    { nom: 'Rêve', degres: ['Imaj7', 'vi7', 'IVmaj7', 'V'] },
    { nom: 'Nuage rose', degres: ['IV', 'V', 'iii', 'vi'] },
    { nom: 'Flotte', degres: ['I', 'iii', 'IV', 'iv'] },
  ],
  // La cloche égrène l'accord partout ; la nappe flotte au-dessus à l'intro et au refrain.
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.cloche,
      instrument: 'ocka-cloche@1',
      role: 'melodie',
      volume: 0.3,
      pan: 0.15,
      notes: { ecrire: 'arpege', sections: ['intro', 'couplet', 'refrain'], idMotif: 'mel-cloche' },
    },
    {
      id: 'nappe',
      nom: P.nappe,
      instrument: 'ocka-nappe@1',
      role: 'nappe',
      volume: 0.8,
      pan: -0.15,
      notes: { ecrire: 'nappe', sections: ['intro', 'refrain'], idMotif: 'nappe' },
    },
  ],
  boucles: [['arpege', 'cloche'], ['nappe', 'nappe'], ['refrain', 'cloche'], ['pince', 'epiano'], ['contrechant', 'lead'], ['cloche', 'pluck']],
  son: {
    kits: {
      // Kick doux et rond, caisse claire claire et courte, charley fin et discret, « bloop » aigu.
      'plugg@1': {
        kick: { de: 180, a: 50, glisse: 0.05, tau: 0.1, duree: 0.36, clic: 0.25, force: 1.5 },
        snare: { corps: [240, 420], tauCorps: 0.03, tauBruit: 0.1, passeHaut: 1800, passeBas: 12000, force: 1.6 },
        charley: { passeHaut: 8200, tauFerme: 0.015, tauOuvert: 0.22, passeBas: 15000 },
        sourdine: 18000,
        perc: 1250,
        cretes: { charley: 0.26, perc: 0.3 },
      },
    },
    // Rebondissante : moyenne, glissés longs.
    basse808: { tau: 0.9, force: 1.6, passeBas: 1700, glisse: 0.12 },
    fill: [
      { pas: 13, vel: 0.4, roul: 0 },
      { pas: 14, vel: 0.55, roul: 2 },
      { pas: 15, vel: 0.7, roul: 2 },
    ],
  },
  onde: [60, 75, 50, 85, 55, 70, 45, 80],
};

export default plugg;
