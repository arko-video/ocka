// Drum & bass : 174 BPM. Un vrai breakbeat (batterie acoustique enregistrée, façon « amen » : kicks doublés,
// caisse claire qui rebondit, notes fantômes) par-dessus le kit synthétisé qui tape le two-step (kick sur 1 et
// le « et » de 3, caisse sur 2 et 4). Basse 808 longue et saturée qui gronde (façon reese), piano liquide.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, percus } from '../styles-ecriture';

const dnb: DefinitionStyle = {
  id: 'dnb',
  famille: 'electro',
  textes: { nom: 'Drum & bass', phrase: 'Breakbeat à 174, grosse basse qui gronde.' },
  genre: 'Electronic',
  reglages: { tempo: 174, plage: [165, 178], swing: 0, tonique: 'F', mode: 'mineur', son: 'nappe', preset: 'neutre', kit: 'dnb@1', volumes: { batterie: 0.45, basse: 0.55, accords: 0.32 } },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', perc: '......x.......x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X.........X.....',
      snare: /*  */ '....X.......X...',
      charley: /**/ 'x.xxx.x.x.xxx.x.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X.........X..... X.X.......X.....',
      snare: /*       */ '....X.......X... ....X.......X..x',
      charley: /*     */ 'xxxxxxxxxxxxxxxx',
      charleyOuvert: /**/ '................ ..............o.',
    }),
    pont: motifBatterie({ kick: 'X...............', snare: '........X.......', charley: 'x.x.x.x.x.x.x.x.' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 10, 0, { glisse: true }), n(10, 6, 0)]),
    refrain: quatreMesures([n(0, 6, 0), n(6, 4, 0, { octave: 1, glisse: true }), n(10, 6, 0, { glisse: true })], [n(0, 6, 0), n(6, 4, 0, { octave: 1 }), n(10, 3, 0), n(13, 3, 2, { glisse: true })]),
  }),
  suites: [
    { nom: 'Liquide', degres: ['i7', 'VImaj7', 'III', 'VII'] },
    { nom: 'Rave', degres: ['i', 'i', 'VI', 'VII'] },
    { nom: 'Nuit', degres: ['i7', 'iv7', 'VImaj7', 'v7'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Piano liquide', instrument: 'vcsl-piano-queue@1', role: 'arpege', volume: 0.8, pan: 0.15, notes: { ecrire: boucleDans('arpege', 60, 86, 0.7), sections: ['intro', 'refrain'], idMotif: 'dnb-piano' } },
    {
      id: 'break',
      nom: 'Breakbeat',
      instrument: 'karoryfer-batterie@1',
      role: 'percussions',
      volume: 1.0,
      notes: {
        ecrire: percus({
          36: 'X.X.......XX.... X.X.......X..... X.X.......XX.... X.X.......X.....',
          38: '....X..x.x..X..x ....X..x.x....X. ....X..x.x..X..x ....X..x.xX.XxXX',
          42: 'o.x.o.x.o.x.o.x. o.x.o.x.o.x.o.x. o.x.o.x.o.x.o.x. o.x.o.x.o.......',
          49: 'X............... ................ ................ ................',
        }),
        sections: ['couplet', 'refrain'],
        idMotif: 'dnb-break',
      },
    },
  ],
  boucles: [['arpege', 'piano'], ['nappe', 'nappe'], ['contrechant', 'lead'], ['pince', 'pluck'], ['refrain', 'lead'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick court et sec, caisse claire qui claque fort, charleys serrés.
      'dnb@1': {
        kick: { de: 210, a: 54, glisse: 0.025, tau: 0.075, duree: 0.28, clic: 0.7, force: 2.0 },
        snare: { corps: [230, 420], tauCorps: 0.035, tauBruit: 0.12, passeHaut: 1600, passeBas: 13000, force: 2.2 },
        charley: { passeHaut: 9000, tauFerme: 0.018, tauOuvert: 0.2, passeBas: 17000 },
        sourdine: 20000,
        perc: 1200,
      },
    },
    // Longue, saturée, sombre : elle gronde.
    basse808: { tau: 2.2, force: 3.4, passeBas: 900, glisse: 0.12 },
    fill: [8, 9, 10, 11, 12, 13, 14, 15].map((pas, k) => ({ pas, vel: 0.45 + k * 0.07, roul: k >= 6 ? 2 : 0 })),
  },
  onde: [90, 25, 40, 85, 25, 90, 30, 80],
};

export default dnb;
