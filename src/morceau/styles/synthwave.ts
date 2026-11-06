// Synthwave : 104 BPM, années 80. Grosse caisse claire « gated » qui claque sur 2 et 4, basse synthé arpégée
// (fondamentale et octave en croches, puis en double-croches au refrain), nappes larges (accords), arpège de
// pluck OCKA et lead OCKA au refrain.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';

const synthwave: DefinitionStyle = {
  id: 'synthwave',
  famille: 'electro',
  textes: { nom: 'Synthwave', phrase: 'Synthés des années 80, basse arpégée, batterie qui claque.' },
  genre: 'Electronic',
  reglages: { tempo: 104, plage: [85, 118], swing: 0, tonique: 'A', mode: 'mineur', son: 'nappe', preset: 'chaud', kit: 'synthwave@1', volumes: { batterie: 0.7, accords: 0.5 } },
  batterie: () => ({
    intro: motifBatterie({ kick: 'X...............', charley: 'x.x.x.x.x.x.x.x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X.......X.......',
      snare: /*  */ '....X.......X...',
      charley: /**/ 'x.x.x.x.x.x.x.x.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      snare: /*       */ '....X.......X...',
      clap: /*        */ '....x.......x...',
      charley: /*     */ 'xxoxxxoxxxoxxxox',
      charleyOuvert: /**/ '................ ..............o.',
    }),
    pont: motifBatterie({ kick: 'X.......X.......', snare: '............X...', charley: 'x...x...x...x...' }),
  }),
  // Basse arpégée : fondamentale / octave en croches, puis en double-croches au refrain.
  basse: () => ({
    couplet: quatreMesures(Array.from({ length: 8 }, (_, i) => n(i * 2, 2, 0, { octave: i % 2, vel: i % 2 ? 0.7 : 0.9 }))),
    refrain: quatreMesures(Array.from({ length: 16 }, (_, i) => n(i, 1, 0, { octave: i % 2, vel: i % 4 === 0 ? 0.95 : 0.7 }))),
  }),
  suites: [
    { nom: 'Néons', degres: ['i', 'VI', 'III', 'VII'] },
    { nom: 'Autoroute', degres: ['i', 'VI', 'VII', 'VII'] },
    { nom: 'Coucher de soleil', degres: ['VI', 'VII', 'i', 'i'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Lead 80s', instrument: 'ocka-lead@1', role: 'lead', volume: 0.85, pan: 0.1, notes: { ecrire: 'contrechant', sections: ['refrain'], idMotif: 'synthwave-lead' } },
    { id: 'arpege', nom: 'Arpège', instrument: 'ocka-pluck@1', role: 'arpege', volume: 0.65, pan: -0.25, notes: { ecrire: 'arpege', sections: ['intro', 'couplet', 'refrain', 'outro'], idMotif: 'synthwave-arpege' } },
  ],
  boucles: [['contrechant', 'lead'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['refrain', 'lead'], ['pince', 'pluck'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Caisse claire énorme (bruit long puis coupé net : « gated »), kick ferme, charleys doux.
      'synthwave@1': {
        kick: { de: 170, a: 50, glisse: 0.03, tau: 0.1, duree: 0.36, clic: 0.6, force: 1.8 },
        snare: { corps: [170, 290], tauCorps: 0.06, tauBruit: 0.24, passeHaut: 900, passeBas: 10000, force: 2.0 },
        charley: { passeHaut: 7000, tauFerme: 0.03, tauOuvert: 0.3, passeBas: 13000 },
        sourdine: 16000,
      },
    },
    basse808: { tau: 0.22, force: 2.0, passeBas: 1600, glisse: 0.03 },
    fill: [{ pas: 8, vel: 0.5, roul: 0 }, { pas: 10, vel: 0.6, roul: 0 }, { pas: 12, vel: 0.7, roul: 0 }, { pas: 13, vel: 0.75, roul: 0 }, { pas: 14, vel: 0.85, roul: 0 }, { pas: 15, vel: 0.95, roul: 0 }],
  },
  onde: [70, 60, 80, 55, 90, 50, 75, 65],
};

export default synthwave;
