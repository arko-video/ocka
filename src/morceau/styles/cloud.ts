// Cloud : 132 BPM en demi-tempo, brumeux : nappe qui chante en glissant, vibraphone en arpège, accords en nappe,
// caisse claire à longue queue (comme dans une réverbe), 808 longue et douce, tout un peu étouffé (vague C2, S1).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const cloud: DefinitionStyle = {
  id: 'cloud',
  famille: 'rap',
  textes: { nom: 'Cloud', phrase: 'Nappes planantes, échos, rythme lent et brumeux.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 132, plage: [120, 145], swing: 0.06, tonique: 'A', mode: 'mineur', son: 'nappe', preset: 'chaud', kit: 'cloud@1', volumes: { accords: 0.4 } },
  // Peu de frappes : kick et caisse claire espacés, charley clairsemé, charley ouvert long.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x...x...x...x...', charleyOuvert: '................ ..........o.....' }),
    couplet: motifBatterie({
      kick: /*        */ 'X.........X..... X..........X....',
      snare: /*       */ '........X....... ........X.......',
      charley: /*     */ 'x...x.x.x...x.x. x...x.x.x...x...',
      charleyOuvert: /**/ '................ ..............o.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X.........X..... X.....X....X....',
      snare: /*       */ '........X....... ........X.......',
      clap: /*        */ '........x....... ........x.......',
      charley: /*     */ 'x.x.x.x.x.x.x... x.x.x.x.x.x.x...',
      charleyOuvert: /**/ '..............o. ..............o.',
    }),
    pont: motifBatterie({ kick: 'X...............', snare: '........x.......', charleyOuvert: 'o.......o.......' }),
  }),
  // Une note par mesure, longue ; au refrain, un glissé vers l'octave.
  basse: () => ({
    couplet: quatreMesures([n(0, 16, 0, { vel: 0.9 })]),
    refrain: quatreMesures([n(0, 10, 0), n(10, 6, 0, { octave: 1, glisse: true, vel: 0.8 })]),
  }),
  suites: [
    { nom: 'Brume', degres: ['i7', 'VImaj7', 'IIImaj7', 'VII'] },
    { nom: 'Apesanteur', degres: ['iv7', 'VImaj7', 'i7', 'VII'] },
    { nom: 'Nuit', degres: ['i7', 'iv7', 'VII', 'IIImaj7'] },
  ],
  // La nappe chante (2 notes longues par mesure qui glissent) ; le vibraphone scintille à l'intro et au refrain.
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.nappe,
      instrument: 'ocka-nappe@1',
      role: 'melodie',
      volume: 1.1,
      pan: -0.1,
      notes: { ecrire: 'contrechant', sections: ['intro', 'couplet', 'refrain'], idMotif: 'mel-nappe' },
      // Le cloud baigne dans la réverbe : un vrai envoi vers la réverbe partagée.
      tranche: { inserts: [{ id: 'reverbe', type: 'envoi-reverbe', actif: true, params: { niveau: 0.5 } }] },
    },
    {
      id: 'vibraphone',
      nom: P.vibraphone,
      instrument: 'vcsl-vibraphone@1',
      role: 'arpege',
      volume: 0.4,
      pan: 0.25,
      notes: { ecrire: 'arpege', sections: ['intro', 'refrain'], idMotif: 'vibraphone' },
      tranche: { inserts: [{ id: 'reverbe', type: 'envoi-reverbe', actif: true, params: { niveau: 0.4 } }] },
    },
  ],
  boucles: [['contrechant', 'nappe'], ['nappe', 'nappe'], ['arpege', 'cloche'], ['refrain', 'epiano'], ['cloche', 'cloche'], ['pince', 'pluck']],
  son: {
    kits: {
      // Kick grave et doux, caisse claire à longue queue (la « réverbe »), charley ouvert très long, tout étouffé.
      'cloud@1': {
        kick: { de: 140, a: 45, glisse: 0.06, tau: 0.16, duree: 0.5, clic: 0.15, force: 1.3 },
        snare: { corps: [180, 300], tauCorps: 0.07, tauBruit: 0.24, passeHaut: 900, passeBas: 8000, force: 1.3 },
        charley: { passeHaut: 7000, tauFerme: 0.03, tauOuvert: 0.45, passeBas: 11000 },
        sourdine: 10000,
        perc: 520,
        cretes: { snare: 0.7, charley: 0.26 },
      },
    },
    // Longue et douce, presque sans saturation.
    basse808: { tau: 2.2, force: 1.2, passeBas: 1100, glisse: 0.14 },
    fill: [
      { pas: 14, vel: 0.4, roul: 0 },
      { pas: 15, vel: 0.6, roul: 2 },
    ],
  },
  onde: [40, 55, 70, 80, 75, 60, 45, 35, 45, 60],
};

export default cloud;
