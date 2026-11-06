// Funk : 104 BPM, groove en double-croches. Batterie acoustique enregistrée (notes fantômes à la caisse),
// guitare claire en grattés serrés, basse électrique syncopée (octaves), cuivres en section d'OCKA (C3) en accords
// sur des « stabs » au refrain, Wurlitzer (C3) qui pique en contretemps. Kit discret, 808 coupée.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle, InstrumentDefaut } from './definition';
import { ligne, percus, plaquer, FORMES, type Frappe } from '../styles-ecriture';

/** Grattés : les 16 double-croches, accents sur les temps et le « a », le reste étouffé (très court, doux). */
const VEL_GRATTE = [1, 0.3, 0.55, 0.3, 0.85, 0.3, 0.6, 0.75, 0.95, 0.3, 0.55, 0.3, 0.85, 0.3, 0.6, 0.35];
const grattes: Frappe[] = VEL_GRATTE.map((v, p) => [p, v > 0.5 ? 0.6 : 0.25, v] as Frappe);
/** Stabs de cuivres : « ba-DAP ! » sur le « et » de 1 et de 3. */
const stabs: Frappe[][] = [[[2, 1, 0.8], [3, 2, 1], [10, 1, 0.8], [11, 3, 0.95]], [[2, 1, 0.8], [3, 2, 1], [12, 4, 0.9]]];

/** Cuivres en section (C3 : trompettes, saxos, trombones déjà empilés dans le son), en accords serrés. */
const cuivres: InstrumentDefaut = { id: 'melodie', nom: 'Cuivres', instrument: 'ocka-cuivres@1', role: 'contrechant', volume: 0.8, pan: 0.1, notes: { ecrire: plaquer({ bas: 58, haut: 79, rythme: stabs }), sections: ['refrain'], idMotif: 'funk-cuivres' } };
/** Wurlitzer (C3) : accords courts en contretemps (sans fondamentale : la basse la joue). */
const wurli: InstrumentDefaut = {
  id: 'wurlitzer',
  nom: 'Wurlitzer',
  instrument: 'ocka-wurlitzer@1',
  role: 'accords',
  volume: 0.55,
  pan: 0.3,
  notes: { ecrire: plaquer({ bas: 55, haut: 74, forme: FORMES.sansFondamentale, rythme: [[[2, 1, 0.75], [6, 1, 0.6], [10, 1, 0.75], [13, 2, 0.65]]] }), sections: ['couplet', 'refrain'], idMotif: 'funk-wurlitzer' },
};

const funk: DefinitionStyle = {
  id: 'funk',
  famille: 'poprockjazz',
  textes: { nom: 'Funk', phrase: 'Basse qui claque, guitare rythmique, cuivres qui piquent.' },
  genre: 'R&B/Soul',
  reglages: {
    tempo: 104,
    plage: [92, 116],
    swing: 0.08,
    tonique: 'E',
    mode: 'mineur',
    son: 'piano',
    preset: 'clair',
    kit: 'funk@1',
    volumes: { batterie: 0.12 },
    muettes: ['basse', 'accords'],
  },
  batterie: () => ({
    intro: motifBatterie({ charley: 'xoxoxoxoxoxoxoxo', kick: 'X...............' }),
    couplet: motifBatterie({ kick: 'X..X......X..X..', snare: '....X..x.x..X..x', charley: 'xoxoxoxoxoxoxox.', charleyOuvert: '..............o.' }),
    refrain: motifBatterie({ kick: 'X..X..X...X..X..', snare: '....X..x.x..X..x', charley: 'xoxoxoxoxoxoxox.', charleyOuvert: '..............o.', clap: '....x.......x...' }),
    pont: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', charley: 'x.x.x.x.x.x.x.x.' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 2, 0), n(3, 1, 0, { vel: 0.6 }), n(4, 1, 0, { octave: 1, vel: 0.8 }), n(6, 2, 0, { vel: 0.8 }), n(10, 1, 0, { octave: 1, vel: 0.7 }), n(12, 2, 0)]),
    refrain: quatreMesures([n(0, 2, 0), n(3, 1, 0, { vel: 0.6 }), n(4, 1, 0, { octave: 1 }), n(7, 1, 4, { vel: 0.7 }), n(10, 1, 0, { octave: 1 }), n(12, 2, 0), n(14, 1, 4, { vel: 0.7 })]),
  }),
  suites: [
    { nom: 'Vamp', degres: ['i7', 'i7', 'IV7', 'i7'] },
    { nom: 'Soirée', degres: ['i7', 'iv7', 'i7', 'v7'] },
    { nom: 'Descente', degres: ['i7', 'VII', 'VI', 'V7'] },
  ],
  instrumentsParDefaut: [
    cuivres,
    {
      id: 'guitare',
      nom: 'Guitare grattée',
      instrument: 'freepats-guitare-claire@1',
      role: 'accords',
      volume: 0.6,
      pan: -0.35,
      notes: { ecrire: plaquer({ bas: 58, haut: 76, forme: FORMES.sansFondamentale, gratte: 0.06, rythme: [grattes] }), sections: ['couplet', 'refrain'], idMotif: 'funk-guitare' },
    },
    {
      id: 'basse-electrique',
      nom: 'Basse électrique',
      instrument: 'karoryfer-basse@1',
      role: 'basse',
      volume: 0.9,
      notes: {
        ecrire: ligne([[[0, 2, 'R', 1], [3, 1, 'R', 0.6], [4, 1, 'O', 0.85], [6, 2, 'R', 0.8], [10, 1, 'S', 0.8], [11, 1, 'O', 0.75], [12, 2, 'R', 0.85], [14, 1, 'Q', 0.7], [15, 1, 'A', 0.7]]], 28),
        sections: ['couplet', 'refrain'],
        idMotif: 'funk-basse',
      },
    },
    {
      id: 'batterie-funk',
      nom: 'Batterie',
      instrument: 'karoryfer-batterie@1',
      role: 'percussions',
      volume: 0.6,
      notes: {
        ecrire: percus({
          36: 'X..X......X..X.. X..X......X.X... X..X......X..X.. X..X......X.....',
          38: '....X..x.x..X..x ....X..x.x..X..x ....X..x.x..X..x ....X..x.x..XoXX',
          42: 'xoxoxoxoxoxoxox. xoxoxoxoxoxoxox. xoxoxoxoxoxoxox. xoxoxoxoxoxo....',
          46: '..............o. ..............o. ..............o. ................',
        }),
        sections: ['couplet', 'refrain'],
        idMotif: 'funk-batterie',
      },
    },
    wurli,
  ],
  boucles: [['pince', 'epiano'], ['refrain', 'lead'], ['contrechant', 'lead'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      'funk@1': {
        kick: { de: 150, a: 55, glisse: 0.03, tau: 0.08, duree: 0.3, clic: 0.5, force: 1.5 },
        snare: { corps: [210, 370], tauCorps: 0.035, tauBruit: 0.09, passeHaut: 1500, passeBas: 12000, force: 1.6 },
        charley: { passeHaut: 8000, tauFerme: 0.025, tauOuvert: 0.22, passeBas: 15000 },
        sourdine: 18000,
      },
    },
    basse808: { tau: 0.5, force: 1.6, passeBas: 1400, glisse: 0.04 },
    fill: [{ pas: 12, vel: 0.5, roul: 0 }, { pas: 13, vel: 0.6, roul: 0 }, { pas: 14, vel: 0.75, roul: 0 }, { pas: 15, vel: 0.9, roul: 0 }],
  },
  onde: [80, 35, 60, 90, 30, 70, 45, 85],
};

export default funk;
