// Amapiano : 113 BPM, house d'Afrique du Sud. Le « log drum » (C3 : synthé d'OCKA, piste « Log drum ») roule en
// rythme syncopé avec des sauts d'octave et des glissés ; la 808 du style (réglée en log drum, coupée au départ)
// reste là pour qui la préfère. Kick feutré à chaque temps, shakers swingués, wood-block, piano à queue jazzy en
// accords syncopés, saxophone au refrain, nappe deep house des accords.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne, percus, plaquer, FORMES } from '../styles-ecriture';

const amapiano: DefinitionStyle = {
  id: 'amapiano',
  famille: 'monde',
  textes: { nom: 'Amapiano', phrase: 'Log drum qui roule, piano jazzy, house d’Afrique du Sud.' },
  genre: 'African',
  reglages: { tempo: 113, plage: [108, 118], swing: 0.2, tonique: 'F', mode: 'mineur', son: 'nappe', preset: 'chaud', kit: 'amapiano@1', volumes: { batterie: 0.75, basse: 0.85, accords: 0.3 }, muettes: ['basse'] },
  batterie: () => ({
    intro: motifBatterie({ charley: 'xxoxxxoxxxoxxxox', perc: '......x.......x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X...X...X...X...',
      rim: /*    */ '..x...x...x..x..',
      charley: /**/ 'xxoxxxoxxxoxxxox',
    }),
    refrain: motifBatterie({
      kick: /*   */ 'X...X...X...X...',
      clap: /*   */ '....x.......x...',
      rim: /*    */ '..x...x...x..x..',
      charley: /**/ 'xxoxxxoxxxoxxxox',
      perc: /*   */ '......x.......x. ...x..x.......x.',
    }),
    pont: motifBatterie({ charley: 'xxoxxxoxxxoxxxox', rim: '..x...x...x..x..' }),
  }),
  // Log drum : syncopes, sauts d'octave, glissés vers la note suivante.
  basse: () => ({
    couplet: quatreMesures([n(0, 2, 0), n(3, 2, 0, { octave: 1, vel: 0.75 }), n(6, 2, 0, { vel: 0.85 }), n(10, 2, 4, { vel: 0.8, glisse: true }), n(12, 2, 0, { octave: 1, vel: 0.7 })]),
    refrain: quatreMesures(
      [n(0, 2, 0), n(3, 1, 0, { octave: 1, vel: 0.7 }), n(4, 2, 0, { vel: 0.8, glisse: true }), n(7, 2, 4, { vel: 0.85 }), n(10, 2, 0, { octave: 1, vel: 0.75 }), n(13, 2, 2, { vel: 0.8, glisse: true })],
      [n(0, 2, 0), n(3, 1, 0, { octave: 1, vel: 0.7 }), n(6, 1, 0, { vel: 0.8 }), n(7, 1, 0, { vel: 0.7 }), n(8, 1, 0, { octave: 1, vel: 0.85 }), n(10, 1, 4, { vel: 0.8 }), n(11, 1, 4), n(12, 2, 0, { octave: 1, glisse: true })],
    ),
  }),
  suites: [
    { nom: 'Soweto', degres: ['i7', 'iv7', 'VImaj7', 'v7'] },
    { nom: 'Pretoria', degres: ['i7', 'VII', 'VImaj7', 'VII'] },
    { nom: 'Groove', degres: ['iv7', 'v7', 'i7', 'i7'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Saxophone', instrument: 'vcsl-saxophone@1', role: 'melodie', volume: 1.0, pan: 0.2, notes: { ecrire: boucleDans('contrechant', 60, 79, 0.95), sections: ['refrain'], idMotif: 'ama-sax' } },
    {
      id: 'piano',
      nom: 'Piano jazzy',
      instrument: 'vcsl-piano-queue@1',
      role: 'accords',
      volume: 0.55,
      pan: -0.15,
      notes: {
        ecrire: plaquer({ bas: 55, haut: 75, forme: FORMES.sansFondamentale, rythme: [[[0, 3, 0.7], [3, 1, 0.5], [6, 2, 0.65], [10, 3, 0.7], [14, 1, 0.5]], [[2, 2, 0.6], [6, 2, 0.65], [9, 2, 0.6], [12, 3, 0.7]]] }),
        sections: ['intro', 'couplet', 'refrain', 'outro'],
        idMotif: 'ama-piano',
      },
    },
    {
      id: 'logdrum',
      nom: 'Log drum',
      instrument: 'ocka-logdrum@1',
      role: 'basse',
      volume: 0.9,
      notes: {
        ecrire: ligne(
          [
            [[0, 2, 'R', 1], [3, 2, 'O', 0.75], [6, 2, 'R', 0.85], [10, 2, 'T', 0.8, true], [12, 2, 'O', 0.7]],
            [[0, 2, 'R', 1], [3, 1, 'O', 0.7], [4, 2, 'R', 0.8, true], [7, 2, 'Q', 0.85], [10, 2, 'O', 0.75], [13, 2, 'S', 0.8, true]],
          ],
          36,
        ),
        sections: ['couplet', 'refrain'],
        idMotif: 'ama-logdrum',
      },
    },
    {
      id: 'percussions',
      nom: 'Shakers et wood-block',
      instrument: 'vcsl-percussions-latines@1',
      role: 'percussions',
      volume: 1.5,
      pan: 0.3,
      notes: { ecrire: percus({ 70: 'oXoXoXoXoXoXoXoX', 76: '...o.....o....o. .......o..o.....', 69: '..X...X...X...X.' }), sections: ['couplet', 'refrain'], idMotif: 'ama-percus' },
    },
  ],
  boucles: [['contrechant', 'epiano'], ['pince', 'piano'], ['refrain', 'epiano'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick feutré (il laisse la place au log drum), shakers fins, « tok » de bois aigu.
      'amapiano@1': {
        kick: { de: 140, a: 50, glisse: 0.035, tau: 0.08, duree: 0.3, clic: 0.25, force: 1.3 },
        snare: { corps: [220, 380], tauCorps: 0.03, tauBruit: 0.09, passeHaut: 1700, passeBas: 11000, force: 1.4 },
        charley: { passeHaut: 9500, tauFerme: 0.028, tauOuvert: 0.2, passeBas: 16000 },
        sourdine: 18000,
        perc: 1150,
        cretes: { kick: 0.8, charley: 0.25 },
      },
    },
    // Log drum : très court, saturé (le « bois »), avec le « punch » de la 808 qui tombe.
    basse808: { tau: 0.2, force: 3.2, passeBas: 3000, glisse: 0.05 },
    fill: [{ pas: 12, vel: 0.45, roul: 0 }, { pas: 14, vel: 0.6, roul: 0 }, { pas: 15, vel: 0.75, roul: 0 }],
  },
  onde: [60, 85, 40, 90, 55, 80, 45, 70],
};

export default amapiano;
