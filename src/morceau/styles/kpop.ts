// K-pop : 122 BPM, pop dansante qui change de rythme : couplet sautillant avec 808, refrain « drop » en four
// on the floor avec clap, pont en demi-tempo à roulements. Suite « route royale » (IV–V–iii–vi), plucks au
// couplet, hook de lead OCKA et cuivres en section d'OCKA (C3, en accords) qui piquent au refrain.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle, InstrumentDefaut } from './definition';
import { plaquer, type Frappe } from '../styles-ecriture';

const stabs: Frappe[][] = [[[0, 1.5, 0.95], [3, 1.5, 0.85], [6, 2, 0.9]], [[0, 1.5, 0.95], [3, 1.5, 0.85], [6, 1, 0.8], [10, 1, 0.85], [12, 3, 0.95]]];

/** Cuivres en section (C3 : déjà empilés dans le son), en accords. */
const cuivres: InstrumentDefaut = { id: 'cuivres', nom: 'Cuivres', instrument: 'ocka-cuivres@1', role: 'contrechant', volume: 0.75, pan: 0.15, notes: { ecrire: plaquer({ bas: 55, haut: 79, rythme: stabs }), sections: ['refrain'], idMotif: 'kpop-cuivres' } };

const kpop: DefinitionStyle = {
  id: 'kpop',
  famille: 'poprockjazz',
  textes: { nom: 'K-pop', phrase: 'Pop coréenne : refrains brillants, cuivres, drops et danse.' },
  genre: 'Pop',
  reglages: { tempo: 122, plage: [100, 135], swing: 0, tonique: 'C#', mode: 'mineur', son: 'nappe', preset: 'clair', kit: 'kpop@1', volumes: { batterie: 0.7, accords: 0.34, basse: 0.6 } },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', clap: '................ ....X.......X.XX' }),
    couplet: motifBatterie({
      kick: /*   */ 'X.....X...X..... X.....X...X.X...',
      snare: /*  */ '....X.......X...',
      charley: /**/ 'x.x.x.xxx.x.x.xx',
      perc: /*   */ '...x.......x....',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      snare: /*       */ '....X.......X...',
      clap: /*        */ '....X.......X...',
      charley: /*     */ 'xxxxxxxxxxxxxxxx',
      charleyOuvert: /**/ '..o...o...o...o.',
    }),
    pont: motifBatterie(
      { kick: 'X.........X.....', snare: '........X.......', charley: 'x.x.x.x.x.x.x.x.' },
      { charley: '......3.......4. ..........6.....' },
    ),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 4, 0), n(6, 2, 0, { octave: 1, vel: 0.7 }), n(10, 4, 0, { vel: 0.85 })]),
    refrain: quatreMesures([n(0, 2, 0), n(2, 2, 0, { octave: 1, vel: 0.65 }), n(4, 2, 0), n(6, 2, 0, { octave: 1, vel: 0.65 }), n(8, 2, 0), n(10, 2, 0, { octave: 1, vel: 0.65 }), n(12, 2, 0), n(14, 2, 0, { octave: 1, vel: 0.65 })]),
  }),
  suites: [
    { nom: 'Route royale', degres: ['VI', 'VII', 'v', 'i'] },
    { nom: 'Scène', degres: ['i', 'iv', 'VII', 'III'] },
    { nom: 'Fan club', degres: ['iv', 'v', 'VI', 'VII'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Hook', instrument: 'ocka-lead@1', role: 'lead', volume: 0.8, pan: 0, notes: { ecrire: 'refrain', sections: ['refrain'], idMotif: 'kpop-hook' } },
    { id: 'pluck', nom: 'Pluck', instrument: 'ocka-pluck@1', role: 'arpege', volume: 0.8, pan: -0.25, notes: { ecrire: 'pince', sections: ['couplet'], idMotif: 'kpop-pluck' } },
    cuivres,
  ],
  boucles: [['refrain', 'lead'], ['pince', 'pluck'], ['arpege', 'pluck'], ['contrechant', 'lead'], ['cloche', 'cloche'], ['nappe', 'nappe']],
  son: {
    kits: {
      // Kick pop qui frappe, clap large, caisse claire brillante.
      'kpop@1': {
        kick: { de: 200, a: 52, glisse: 0.03, tau: 0.1, duree: 0.38, clic: 0.8, force: 2.2 },
        snare: { corps: [210, 380], tauCorps: 0.04, tauBruit: 0.12, passeHaut: 1500, passeBas: 14000, force: 2.0 },
        charley: { passeHaut: 8500, tauFerme: 0.022, tauOuvert: 0.22, passeBas: 17000 },
        sourdine: 20000,
        perc: 1000,
      },
    },
    basse808: { tau: 0.8, force: 2.4, passeBas: 2400, glisse: 0.07 },
    fill: [{ pas: 8, vel: 0.5, roul: 0 }, { pas: 10, vel: 0.6, roul: 0 }, { pas: 12, vel: 0.7, roul: 2 }, { pas: 13, vel: 0.75, roul: 2 }, { pas: 14, vel: 0.85, roul: 4 }, { pas: 15, vel: 0.95, roul: 4 }],
  },
  onde: [80, 45, 95, 40, 80, 60, 100, 35],
};

export default kpop;
