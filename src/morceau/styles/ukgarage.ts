// UK garage : 132 BPM, « 2-step » (le kick saute des temps, caisse sur 2 et 4), double-croches très
// swinguées (shuffle), basse 808 ronde et sautillante, stabs d'orgue syncopés en septièmes et neuvièmes,
// pluck OCKA façon voix découpée au refrain.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { plaquer, FORMES } from '../styles-ecriture';

const ukgarage: DefinitionStyle = {
  id: 'ukgarage',
  famille: 'electro',
  textes: { nom: 'UK garage', phrase: 'Rythme 2-step sautillant et swingué, orgue et basse ronde.' },
  genre: 'Dance',
  reglages: { tempo: 132, plage: [128, 138], swing: 0.32, tonique: 'G', mode: 'mineur', son: 'nappe', preset: 'clair', kit: 'ukgarage@1', volumes: { accords: 0.26 } },
  batterie: () => ({
    intro: motifBatterie({ charley: '..x...x...x...x.', rim: '.......x......x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X......X..X..... X.........X..x..',
      snare: /*  */ '....X.......X...',
      charley: /**/ '..x..xx...x..xx.',
      rim: /*    */ '.......x........ ..x.............',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X......X..X..... X.........X..x..',
      snare: /*       */ '....X.......X...',
      clap: /*        */ '....X.......X...',
      charley: /*     */ 'x.xx.xx.x.xx.xx.',
      charleyOuvert: /**/ '..o.......o.....',
      perc: /*        */ '...x.......x.... .....x.....x....',
    }),
    pont: motifBatterie({ rim: '.......x..x.....', charley: '..x..xx...x..xx.', snare: '............X...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 3, 0), n(6, 2, 0, { octave: 1, vel: 0.7 }), n(10, 3, 0, { vel: 0.85 }), n(14, 2, 4, { vel: 0.7 })]),
    refrain: quatreMesures([n(0, 3, 0), n(3, 1, 0, { octave: 1, vel: 0.6 }), n(6, 2, 0, { vel: 0.8 }), n(10, 3, 0, { vel: 0.85 }), n(13, 2, 6, { vel: 0.7 })]),
  }),
  suites: [
    { nom: 'Londres', degres: ['i7', 'iv7', 'v7', 'VImaj7'] },
    { nom: 'Pirate', degres: ['i7', 'VImaj7', 'iv7', 'v7'] },
    { nom: 'Sunday', degres: ['iv7', 'v7', 'i7', 'i7'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Voix découpée', instrument: 'ocka-pluck@1', role: 'melodie', volume: 0.85, pan: 0.2, notes: { ecrire: 'pince', sections: ['refrain'], idMotif: 'ukg-chop' } },
    {
      id: 'orgue',
      nom: 'Orgue stabs',
      instrument: 'freepats-orgue-electrique@1',
      role: 'accords',
      volume: 0.6,
      pan: -0.2,
      notes: { ecrire: plaquer({ bas: 55, haut: 72, forme: FORMES.sansFondamentale, rythme: [[[3, 1, 0.8], [6, 1, 0.75], [10, 1.5, 0.85], [13, 1, 0.7]]] }), sections: ['couplet', 'refrain'], idMotif: 'ukg-orgue' },
    },
  ],
  boucles: [['pince', 'pluck'], ['refrain', 'lead'], ['arpege', 'pluck'], ['contrechant', 'epiano'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick rond, caisse claire nette et courte, charleys secs (le swing fait le reste).
      'ukgarage@1': {
        kick: { de: 165, a: 50, glisse: 0.03, tau: 0.12, duree: 0.38, clic: 0.5, force: 1.7 },
        snare: { corps: [220, 380], tauCorps: 0.03, tauBruit: 0.09, passeHaut: 1700, passeBas: 13000, force: 1.7 },
        charley: { passeHaut: 8500, tauFerme: 0.02, tauOuvert: 0.2, passeBas: 16000 },
        sourdine: 20000,
        perc: 950,
      },
    },
    basse808: { tau: 0.55, force: 1.8, passeBas: 1200, glisse: 0.05 },
    fill: [{ pas: 11, vel: 0.5, roul: 0 }, { pas: 13, vel: 0.65, roul: 0 }, { pas: 14, vel: 0.75, roul: 2 }, { pas: 15, vel: 0.9, roul: 2 }],
  },
  onde: [85, 30, 55, 30, 75, 30, 60, 35],
};

export default ukgarage;
