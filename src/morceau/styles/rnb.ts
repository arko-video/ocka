// R&B : 88 BPM, groove lent et swingué. Piano électrique (FM, façon Rhodes) en voicings sans fondamentale
// avec neuvièmes, 808 ronde et douce qui glisse, rim et caisse claire fines, charleys en petits roulements,
// guitare claire qui répond à la voix au refrain. Fait pour chanter.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, plaquer, FORMES } from '../styles-ecriture';

const rnb: DefinitionStyle = {
  id: 'rnb',
  famille: 'poprockjazz',
  textes: { nom: 'R&B', phrase: 'Accords soyeux au Rhodes, groove lent, fait pour la voix.' },
  genre: 'R&B/Soul',
  reglages: { tempo: 88, plage: [70, 105], swing: 0.18, tonique: 'D#', mode: 'mineur', son: 'piano', preset: 'chaud', kit: 'rnb@1', volumes: { batterie: 0.7 }, muettes: ['accords'] },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X......X..X..... X.......X..X....',
        snare: /*  */ '....X.......X...',
        rim: /*    */ '....x.......x...',
        charley: /**/ 'x.x.x.xxx.x.x.x.',
      },
      { charley: '......2.......3. ..........2...3.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X......X..X..... X.......X..X..x.',
        snare: /*       */ '....X.......X...',
        clap: /*        */ '....x.......x...',
        charley: /*     */ 'x.xxx.x.x.xxx.x.',
        charleyOuvert: /**/ '................ ..............o.',
        perc: /*        */ '.........x...... ...x............',
      },
      { charley: '...2.......3.... ......2.....3.2.' },
    ),
    pont: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', charley: 'x...x...x...x...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 7, 0), n(7, 3, 0, { vel: 0.7 }), n(10, 6, 4, { vel: 0.8, glisse: true })]),
    refrain: quatreMesures([n(0, 6, 0), n(7, 2, 0, { octave: 1, vel: 0.65, glisse: true }), n(10, 4, 0, { vel: 0.8 }), n(14, 2, 6, { vel: 0.65 })]),
  }),
  suites: [
    { nom: 'Velours', degres: ['i7', 'iv7', 'VImaj7', 'v7'] },
    { nom: 'Minuit', degres: ['VImaj7', 'v7', 'i7', 'i7'] },
    { nom: 'Slow', degres: ['iv7', 'v7', 'i7', 'VImaj7'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Guitare', instrument: 'freepats-guitare-claire@1', role: 'contrechant', volume: 1.1, pan: 0.3, notes: { ecrire: boucleDans('contrechant', 62, 81, 0.95), sections: ['refrain'], idMotif: 'rnb-guitare' } },
    {
      id: 'rhodes',
      nom: 'Rhodes',
      instrument: 'ocka-rhodes@1',
      role: 'accords',
      volume: 0.85,
      pan: -0.15,
      notes: {
        ecrire: plaquer({ bas: 55, haut: 75, forme: FORMES.sansFondamentale, gratte: 0.05, rythme: [[[0, 7, 0.7], [7, 1, 0.45], [8, 6, 0.62], [14, 2, 0.5]]] }),
        sections: ['intro', 'couplet', 'refrain', 'outro'],
        idMotif: 'rnb-rhodes',
      },
    },
  ],
  boucles: [['contrechant', 'epiano'], ['refrain', 'epiano'], ['pince', 'epiano'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick profond et doux, caisse fine, charleys feutrés.
      'rnb@1': {
        kick: { de: 150, a: 46, glisse: 0.045, tau: 0.13, duree: 0.45, clic: 0.25, force: 1.5 },
        snare: { corps: [210, 370], tauCorps: 0.035, tauBruit: 0.1, passeHaut: 1600, passeBas: 10000, force: 1.5 },
        charley: { passeHaut: 7500, tauFerme: 0.02, tauOuvert: 0.25, passeBas: 13000 },
        sourdine: 15000,
        perc: 900,
      },
    },
    basse808: { tau: 1.4, force: 1.4, passeBas: 1200, glisse: 0.1 },
    fill: [{ pas: 12, vel: 0.4, roul: 2 }, { pas: 13, vel: 0.5, roul: 2 }, { pas: 14, vel: 0.6, roul: 3 }, { pas: 15, vel: 0.75, roul: 3 }],
  },
  onde: [60, 40, 70, 35, 55, 45, 65, 40],
};

export default rnb;
