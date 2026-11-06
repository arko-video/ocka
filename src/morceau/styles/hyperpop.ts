// Hyperpop : 160 BPM, tout poussé à fond. Kick qui claque, caisse saturée, charleys en roulements rapides,
// 808 très distordue qui glisse, cloche FM qui chante, et le supersaw d'OCKA (C3 : 7 scies désaccordées, large)
// en accords plaqués au refrain, sur la nappe de scies des accords.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle, InstrumentDefaut } from './definition';
import { plaquer, type Frappe } from '../styles-ecriture';

/** Stabs en 3-3-2 (le rythme qui bondit), deux fois par mesure. */
const stabs: Frappe[] = [[0, 2.5, 0.95], [3, 2.5, 0.8], [6, 1.5, 0.85], [8, 2.5, 0.9], [11, 2.5, 0.8], [14, 1.5, 0.85]];

/** Le supersaw (C3) : accords plaqués en stabs au refrain, au centre (il est déjà large). */
const supersaw: InstrumentDefaut = { id: 'supersaw', nom: 'Supersaw', instrument: 'ocka-supersaw@1', role: 'accords', volume: 0.6, pan: 0, notes: { ecrire: plaquer({ bas: 60, haut: 79, rythme: [stabs] }), sections: ['refrain'], idMotif: 'hyperpop-supersaw' } };

const hyperpop: DefinitionStyle = {
  id: 'hyperpop',
  famille: 'electro',
  textes: { nom: 'Hyperpop', phrase: 'Supersaw énorme, 808 distordue, cloche qui brille : tout à fond.' },
  genre: 'Pop',
  reglages: { tempo: 160, plage: [140, 180], swing: 0, tonique: 'E', mode: 'majeur', son: 'nappe', preset: 'clair', kit: 'hyperpop@1', volumes: { batterie: 0.65, basse: 0.5, accords: 0.34 } },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', clap: '................ ............X...' }, { charley: '................ ..........3...6.' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X.....X...X..... X.....X...X...X.',
        snare: /*  */ '....X.......X...',
        charley: /**/ 'x.x.x.x.x.x.x.x.',
      },
      { charley: '......3.......4. ..........6...6.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X...X...X...X...',
        snare: /*       */ '....X.......X...',
        clap: /*        */ '....X.......X...',
        charley: /*     */ 'xxxxxxxxxxxxxxxx',
        charleyOuvert: /**/ '..o...o...o...o.',
      },
      { charley: '...3.......4..6. .....4.....6.6..' },
    ),
    pont: motifBatterie({ kick: 'X.........X.....', snare: '........X.......', charley: 'x.x.x.x.x.x.x.x.' }, { charley: '..............6.' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 6, 0), n(6, 4, 0, { glisse: true }), n(10, 6, 0, { octave: 1 })]),
    refrain: quatreMesures([n(0, 4, 0), n(4, 4, 0, { octave: 1, glisse: true }), n(8, 4, 0), n(12, 4, 0, { octave: 1, glisse: true })]),
  }),
  suites: [
    { nom: 'Bonbon', degres: ['I', 'V', 'vi', 'IV'] },
    { nom: 'Pixel', degres: ['IV', 'I', 'V', 'vi'] },
    { nom: 'Larmes', degres: ['vi', 'IV', 'I', 'V'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Cloche', instrument: 'ocka-cloche@1', role: 'melodie', volume: 0.6, pan: 0, notes: { ecrire: 'cloche', sections: ['intro', 'refrain'], idMotif: 'hyperpop-cloche' } },
    supersaw,
  ],
  boucles: [['cloche', 'cloche'], ['arpege', 'pluck'], ['refrain', 'lead'], ['contrechant', 'lead'], ['pince', 'pluck'], ['nappe', 'nappe']],
  son: {
    kits: {
      // Kick très « clic », caisse et clap saturés, charleys brillants.
      'hyperpop@1': {
        kick: { de: 260, a: 55, glisse: 0.03, tau: 0.09, duree: 0.34, clic: 1.0, force: 3.0 },
        snare: { corps: [230, 420], tauCorps: 0.035, tauBruit: 0.1, passeHaut: 1800, passeBas: 16000, force: 3.0 },
        charley: { passeHaut: 9000, tauFerme: 0.018, tauOuvert: 0.2, passeBas: 18000 },
        sourdine: 20000,
      },
    },
    // Très distordue (elle s'entend même sur un téléphone), longue, qui glisse vite.
    basse808: { tau: 1.3, force: 5.5, passeBas: 4500, glisse: 0.07 },
    fill: [{ pas: 12, vel: 0.55, roul: 3 }, { pas: 13, vel: 0.65, roul: 4 }, { pas: 14, vel: 0.8, roul: 6 }, { pas: 15, vel: 0.95, roul: 6 }],
  },
  onde: [100, 20, 85, 30, 100, 15, 90, 40, 70],
};

export default hyperpop;
