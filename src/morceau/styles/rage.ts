// Rage : 155 BPM, synthé lead saturé en arpège, 808 énorme et très saturée, charleys en rafales de triolets,
// clap et caisse claire empilés sur le 3e temps (vague C2, S1).
// Pas encore de supersaw dans OCKA : le lead d'OCKA (2 scies désaccordées) le remplace (demandé pour C3).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const rage: DefinitionStyle = {
  id: 'rage',
  famille: 'rap',
  textes: { nom: 'Rage', phrase: 'Synthés saturés qui hurlent, 808 énormes : l’énergie à fond.' },
  genre: 'Hip-Hop/Rap',
  reglages: {
    tempo: 155,
    plage: [145, 170],
    swing: 0,
    tonique: 'G',
    mode: 'mineur',
    son: 'nappe',
    preset: 'neutre',
    kit: 'rage@1',
    // 808 très saturée et très longue : plus bas pour garder le niveau de la trap ; nappe des accords discrète.
    volumes: { basse: 0.7, accords: 0.3 },
  },
  // Caisse claire + clap sur le 3e temps, charley en rafales de 3 (triolets) presque à chaque temps.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', clap: '................ ............x...' }, { charley: '..3.....3.....3. ..3...3...3...3.' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X.........X..X.. ..X.......X.....',
        snare: /*  */ '........X....... ........X.......',
        clap: /*   */ '........X....... ........X.......',
        charley: /**/ 'X.X.X.X.X.X.X.X. X.X.X.X.X.X.X.X.',
      },
      { charley: '..3.....3...3... ..3...3.....4.3.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X..X......X..X.. X.....X...X..X..',
        snare: /*       */ '........X....... ........X.......',
        clap: /*        */ '........X....... ........X.......',
        charley: /*     */ 'XxXxXxXxXxXxXxXx XxXxXxXxXxXxXx.x',
        charleyOuvert: /**/ '................ ..............o.',
      },
      { charley: '3...3...3...3... 3...3...3.6.3...' },
    ),
    pont: motifBatterie({ kick: 'X...............', clap: '........X.......', charley: 'x.x.x.x.x.x.x.x.' }, { charley: '..3.......3...3.' }),
  }),
  // Longues notes qui glissent, et des rebonds sur l'octave au refrain.
  basse: () => ({
    couplet: quatreMesures([n(0, 10, 0, { glisse: true }), n(10, 6, 0, { octave: 1 })]),
    refrain: quatreMesures(
      [n(0, 3, 0), n(3, 7, 0, { glisse: true }), n(10, 3, 0, { octave: 1, vel: 0.85 }), n(13, 3, 0)],
      [n(0, 3, 0), n(3, 7, 0, { glisse: true }), n(10, 6, 0, { octave: 1, glisse: true })],
    ),
  }),
  suites: [
    { nom: 'Énergie', degres: ['i', 'VI', 'VII', 'i'] },
    { nom: 'Néon', degres: ['i', 'III', 'VII', 'VI'] },
    { nom: 'Chaos', degres: ['i', 'iv', 'bII', 'V'] },
  ],
  // Le lead joue son arpège partout (sauf l'outro) : c'est lui qui porte le beat. C3 : sur le supersaw (L).
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.supersaw,
      instrument: 'ocka-supersaw@1',
      role: 'lead',
      volume: 0.85,
      notes: { ecrire: 'arpege', sections: ['intro', 'couplet', 'refrain'], idMotif: 'mel-lead' },
    },
  ],
  boucles: [['arpege', 'lead'], ['contrechant', 'lead'], ['refrain', 'lead'], ['cloche', 'pluck'], ['nappe', 'nappe'], ['pince', 'pluck']],
  son: {
    kits: {
      // Kick court et dur (la 808 fait le grave), caisse claire brillante et forte, charley très sec.
      'rage@1': {
        kick: { de: 250, a: 50, glisse: 0.03, tau: 0.07, duree: 0.3, clic: 0.8, force: 2.6 },
        snare: { corps: [220, 400], tauCorps: 0.035, tauBruit: 0.09, passeHaut: 2000, passeBas: 14000, force: 2.4 },
        charley: { passeHaut: 8800, tauFerme: 0.016, tauOuvert: 0.2, passeBas: 17000 },
        sourdine: 20000,
      },
    },
    // Énorme : très longue et très saturée.
    basse808: { tau: 2.4, force: 4.0, passeBas: 2600, glisse: 0.07 },
    // Roulements de plus en plus serrés.
    fill: [
      { pas: 10, vel: 0.5, roul: 3 },
      { pas: 12, vel: 0.6, roul: 4 },
      { pas: 13, vel: 0.7, roul: 4 },
      { pas: 14, vel: 0.8, roul: 6 },
      { pas: 15, vel: 0.95, roul: 6 },
    ],
  },
  onde: [100, 60, 85, 40, 95, 55, 90, 35, 100, 70],
};

export default rage;
