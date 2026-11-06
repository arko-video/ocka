// Jersey club : 140 BPM, kick en rafales de 5 (1, 2, 3, 3 et, 4 — ou 3-3-2-2), clap sur 2 et 4, « lit qui grince »
// imité par une perc aiguë doublée, accords pincés, 808 courte qui suit le kick (vague C2, S1).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const jerseyclub: DefinitionStyle = {
  id: 'jerseyclub',
  famille: 'rap',
  textes: { nom: 'Jersey club', phrase: 'Kicks en rafales, lit qui grince, sautillant : fait pour danser.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 140, plage: [130, 150], swing: 0, tonique: 'B', mode: 'mineur', son: 'nappe', preset: 'clair', kit: 'jerseyclub@1', volumes: { accords: 0.3 } },
  // Rafales de 5 kicks ; le « grincement » (perc) tombe sur les contretemps, souvent doublé (roulement de 2).
  batterie: () => ({
    intro: motifBatterie({ clap: '....x.......x...', charley: 'x.x.x.x.x.x.x.x.', perc: '..x.....x..x....' }, { perc: '..2.....2.......' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X...X...X.X.X... X...X...X.X.X...',
        clap: /*   */ '....X.......X... ....X.......X...',
        charley: /**/ 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.',
        perc: /*   */ '..x.....x..x.... ..x.....x..x..x.',
      },
      { perc: '..2........2.... ..2........2....' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X..X..X.X.X..... X...X...X.X.X...',
        clap: /*        */ '....X.......X... ....X..X....X...',
        snare: /*       */ '....o.......o... ....o.......o...',
        charley: /*     */ 'x...x...x...x... x...x...x...x...',
        charleyOuvert: /**/ '..o...o...o...o. ..o...o...o...o.',
        perc: /*        */ '...x...x...x.x.. ...x...x...x.x.x',
      },
      { perc: '...2.......2.... ...2.......2...2' },
    ),
    pont: motifBatterie({ kick: 'X.......X.......', clap: '....x.......x...', perc: '..x.....x.......' }, { perc: '..2.............' }),
  }),
  // Courte et sèche, calée sur les rafales du kick.
  basse: () => ({
    couplet: quatreMesures([n(0, 4, 0), n(4, 4, 0, { vel: 0.85 }), n(8, 2, 0, { vel: 0.8 }), n(10, 2, 0, { vel: 0.8 }), n(12, 4, 0, { octave: 1, vel: 0.8 })]),
    refrain: quatreMesures(
      [n(0, 3, 0), n(3, 3, 0, { vel: 0.85 }), n(6, 2, 0, { vel: 0.8 }), n(8, 2, 4, { vel: 0.8 }), n(10, 6, 0, { octave: 1, vel: 0.8 })],
      [n(0, 4, 0), n(4, 4, 0, { vel: 0.85 }), n(8, 2, 0), n(10, 2, 0), n(12, 4, 4, { glisse: true })],
    ),
  }),
  suites: [
    { nom: 'Club', degres: ['i7', 'iv7', 'VI', 'v7'] },
    { nom: 'Rebond', degres: ['VI', 'VII', 'i', 'i'] },
    { nom: 'Néons', degres: ['i', 'III', 'iv', 'VI'] },
  ],
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.stabs,
      instrument: 'ocka-pluck@1',
      role: 'accords',
      volume: 0.55,
      pan: 0.1,
      notes: { ecrire: 'pince', sections: ['couplet', 'refrain'], idMotif: 'mel-pince' },
    },
  ],
  boucles: [['pince', 'pluck'], ['refrain', 'pluck'], ['arpege', 'epiano'], ['contrechant', 'lead'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick court qui cogne, clap net, charley clair, perc aiguë et brève (le « grincement »).
      'jerseyclub@1': {
        kick: { de: 240, a: 52, glisse: 0.028, tau: 0.065, duree: 0.26, clic: 0.7, force: 2.4 },
        snare: { corps: [210, 380], tauCorps: 0.03, tauBruit: 0.08, passeHaut: 1600, passeBas: 12000, force: 1.8 },
        charley: { passeHaut: 8000, tauFerme: 0.02, tauOuvert: 0.2, passeBas: 16000 },
        sourdine: 20000,
        perc: 1550,
        cretes: { perc: 0.22, clap: 0.5 },
      },
    },
    basse808: { tau: 0.45, force: 2.2, passeBas: 2000, glisse: 0.06 },
    fill: [
      { pas: 8, vel: 0.5, roul: 0 },
      { pas: 10, vel: 0.6, roul: 0 },
      { pas: 12, vel: 0.7, roul: 2 },
      { pas: 14, vel: 0.8, roul: 2 },
      { pas: 15, vel: 0.9, roul: 4 },
    ],
  },
  onde: [95, 20, 95, 20, 95, 60, 95, 60, 95, 20],
};

export default jerseyclub;
