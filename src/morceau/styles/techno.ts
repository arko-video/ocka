// Techno : 130 BPM, kick lourd à chaque temps, charley ouvert sur les contretemps, rim qui tourne en boucle,
// basse 808 très courte qui roule en double-croches entre les kicks, séquence hypnotique de pluck OCKA, cloche
// FM au refrain, nappe sombre des accords. Une ou deux harmonies seulement : ça tourne.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne } from '../styles-ecriture';

const techno: DefinitionStyle = {
  id: 'techno',
  famille: 'electro',
  textes: { nom: 'Techno', phrase: 'Kick qui tape, sons qui tournent en boucle, hypnotique.' },
  genre: 'Electronic',
  reglages: { tempo: 130, plage: [124, 140], swing: 0, tonique: 'F', mode: 'mineur', son: 'nappe', preset: 'neutre', kit: 'techno@1', volumes: { batterie: 0.7, accords: 0.4, basse: 0.75 } },
  batterie: () => ({
    intro: motifBatterie({ kick: 'X...X...X...X...', charleyOuvert: '..o...o...o...o.' }),
    couplet: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      charley: /*     */ 'xxx.xxx.xxx.xxx.',
      charleyOuvert: /**/ '..o...o...o...o.',
      rim: /*         */ '...x..x....x..x. ...x..x.x.....x.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X...X...X...X...',
      clap: /*        */ '....X.......X...',
      charley: /*     */ 'xoxxxoxxxoxxxoxx',
      charleyOuvert: /**/ '..o...o...o...o.',
      rim: /*         */ '...x..x....x..x. ...x..x.x.....x.',
      perc: /*        */ '.x.......x...x.. .x.....x.....x..',
    }),
    pont: motifBatterie({ charley: 'xxx.xxx.xxx.xxx.', rim: '...x..x....x..x.', clap: '............X...' }),
  }),
  // Roulement de basse : les 3 double-croches entre deux kicks.
  basse: () => ({
    couplet: quatreMesures([1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((p) => n(p, 1, 0, { vel: p % 4 === 2 ? 0.9 : 0.65 }))),
    refrain: quatreMesures([1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((p) => n(p, 1, 0, { octave: p % 8 === 7 ? 1 : 0, vel: p % 4 === 2 ? 0.9 : 0.65 }))),
  }),
  suites: [
    { nom: 'Tunnel', degres: ['i', 'i', 'i', 'VI'] },
    { nom: 'Usine', degres: ['i', 'VII', 'i', 'VI'] },
    { nom: 'Nuit blanche', degres: ['i', 'iv', 'i', 'v'] },
  ],
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: 'Séquence',
      instrument: 'ocka-pluck@1',
      role: 'arpege',
      volume: 0.85,
      pan: 0.15,
      notes: { ecrire: ligne([[[0, 1, 'R', 0.9], [3, 1, 'O', 0.7], [6, 1, 'Q', 0.8], [8, 1, 'R', 0.85], [11, 1, 'O', 0.7], [14, 1, 'S', 0.75]]], 57), sections: ['couplet', 'refrain'], idMotif: 'techno-sequence' },
    },
    { id: 'cloche', nom: 'Cloche FM', instrument: 'ocka-cloche@1', role: 'contrechant', volume: 0.6, pan: -0.25, notes: { ecrire: boucleDans('cloche', 64, 82, 0.8), sections: ['refrain'], idMotif: 'techno-cloche' } },
  ],
  boucles: [['arpege', 'pluck'], ['cloche', 'cloche'], ['pince', 'pluck'], ['nappe', 'nappe'], ['contrechant', 'lead'], ['refrain', 'lead']],
  son: {
    kits: {
      // Kick lourd et long (le cœur de la techno), clap sec, charleys métalliques, rim aigu.
      'techno@1': {
        kick: { de: 165, a: 46, glisse: 0.035, tau: 0.2, duree: 0.55, clic: 0.45, force: 2.6 },
        snare: { corps: [200, 360], tauCorps: 0.03, tauBruit: 0.08, passeHaut: 1800, passeBas: 11000, force: 1.8 },
        charley: { passeHaut: 9000, tauFerme: 0.02, tauOuvert: 0.18, passeBas: 16000 },
        sourdine: 20000,
        perc: 1600,
      },
    },
    basse808: { tau: 0.11, force: 2.3, passeBas: 800, glisse: 0.03 },
    fill: [{ pas: 12, vel: 0.5, roul: 2 }, { pas: 13, vel: 0.6, roul: 2 }, { pas: 14, vel: 0.7, roul: 4 }, { pas: 15, vel: 0.85, roul: 4 }],
  },
  onde: [95, 30, 95, 30, 95, 30, 95, 30],
};

export default techno;
