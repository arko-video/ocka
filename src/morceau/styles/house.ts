// House : 124 BPM, kick à chaque temps (four on the floor), clap sur 2 et 4, charley ouvert sur les
// contretemps, basse synthé sur les contretemps (808 courte), accords de piano OCKA en « stabs » syncopés
// (septièmes et neuvièmes), nappe des accords et arpège de pluck au refrain : tout en synthés OCKA.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { plaquer, FORMES } from '../styles-ecriture';

const house: DefinitionStyle = {
  id: 'house',
  famille: 'electro',
  textes: { nom: 'House', phrase: 'Kick à chaque temps, charley ouvert, piano qui pompe.' },
  genre: 'Dance',
  reglages: { tempo: 124, plage: [118, 130], swing: 0.08, tonique: 'A', mode: 'mineur', son: 'nappe', preset: 'clair', kit: 'house@1', volumes: { accords: 0.32 } },
  batterie: () => ({
    intro: motifBatterie({ kick: 'X...X...X...X...', charley: '..x...x...x...x.' }),
    couplet: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      clap: /*        */ '....X.......X...',
      charley: /*     */ 'x.x.x.x.x.x.x.x.',
      charleyOuvert: /**/ '..o...o...o...o.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      clap: /*        */ '....X.......X...',
      snare: /*       */ '................ ............x..x',
      charley: /*     */ 'xxoxxxoxxxoxxxox',
      charleyOuvert: /**/ '..o...o...o...o.',
      perc: /*        */ '.......x......x. ...x......x.....',
    }),
    pont: motifBatterie({ clap: '....X.......X...', charleyOuvert: '..o...o...o...o.', perc: '.......x......x.' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(2, 2, 0), n(6, 2, 0, { vel: 0.85 }), n(10, 2, 0), n(14, 2, 0, { octave: 1, vel: 0.7 })]),
    refrain: quatreMesures([n(2, 2, 0), n(5, 1, 0, { octave: 1, vel: 0.6 }), n(6, 2, 0, { vel: 0.85 }), n(10, 2, 0), n(13, 1, 4, { vel: 0.6 }), n(14, 2, 0, { octave: 1, vel: 0.75 })]),
  }),
  suites: [
    { nom: 'Club', degres: ['i7', 'iv7', 'v7', 'VImaj7'] },
    { nom: 'Lever du jour', degres: ['i7', 'VII', 'VImaj7', 'VII'] },
    { nom: 'Deep', degres: ['i7', 'i7', 'iv7', 'iv7'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Arpège', instrument: 'ocka-pluck@1', role: 'arpege', volume: 0.8, pan: 0.2, notes: { ecrire: 'arpege', sections: ['refrain'], idMotif: 'house-arpege' } },
    {
      id: 'stabs',
      nom: 'Piano house',
      instrument: 'ocka-piano@1',
      role: 'accords',
      volume: 0.6,
      pan: -0.15,
      notes: {
        ecrire: plaquer({ bas: 57, haut: 76, forme: FORMES.neuvieme, rythme: [[[2, 1.5, 0.85], [6, 1.5, 0.8], [9, 1.5, 0.7], [12, 2, 0.85]], [[0, 1.5, 0.8], [3, 1.5, 0.75], [6, 2, 0.85], [10, 1.5, 0.8], [14, 1.5, 0.7]]] }),
        sections: ['couplet', 'refrain'],
        idMotif: 'house-stabs',
      },
    },
  ],
  boucles: [['arpege', 'pluck'], ['pince', 'piano'], ['refrain', 'lead'], ['nappe', 'nappe'], ['contrechant', 'lead'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Façon 909 : kick qui claque puis tient, clap net, charleys brillants (ouvert assez long).
      'house@1': {
        kick: { de: 185, a: 50, glisse: 0.028, tau: 0.13, duree: 0.42, clic: 0.6, force: 1.9 },
        snare: { corps: [190, 340], tauCorps: 0.04, tauBruit: 0.13, passeHaut: 1500, passeBas: 12000, force: 1.5 },
        charley: { passeHaut: 8500, tauFerme: 0.028, tauOuvert: 0.22, passeBas: 17000 },
        sourdine: 20000,
        perc: 1050,
      },
    },
    basse808: { tau: 0.28, force: 1.9, passeBas: 1100, glisse: 0.04 },
    fill: [{ pas: 12, vel: 0.5, roul: 0 }, { pas: 13, vel: 0.6, roul: 0 }, { pas: 14, vel: 0.7, roul: 2 }, { pas: 15, vel: 0.85, roul: 2 }],
  },
  onde: [90, 40, 90, 40, 90, 40, 90, 40],
};

export default house;
