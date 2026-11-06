// Gospel : 72 BPM, double-croches swinguées (balancement ternaire), orgue électrique tenu, piano qui plaque
// avec la main gauche en octaves, chœurs fabriqués par le code (nappe OCKA en voix serrées, doublée à l'octave),
// basse électrique, grosse caisse claire + clap sur 2 et 4. 808 et accords coupés (piano et orgue jouent).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { ensemble, ligne, plaquer, FORMES } from '../styles-ecriture';

const gospel: DefinitionStyle = {
  id: 'gospel',
  famille: 'poprockjazz',
  textes: { nom: 'Gospel', phrase: 'Orgue, piano et chœurs : des accords qui montent au ciel.' },
  genre: 'R&B/Soul',
  reglages: {
    tempo: 72,
    plage: [62, 96],
    swing: 0.3,
    tonique: 'G#',
    mode: 'majeur',
    son: 'piano',
    preset: 'chaud',
    kit: 'gospel@1',
    volumes: { batterie: 0.5 },
    muettes: ['basse', 'accords'],
  },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', kick: 'X...............' }),
    couplet: motifBatterie({
      kick: /*   */ 'X......o..X..... X.....o...X..o..',
      snare: /*  */ '....X.......X...',
      charley: /**/ 'x.xxx.x.x.xxx.x.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X......o..X..... X.....o.X.X..o..',
      snare: /*       */ '....X.......X... ....X.......X.xx',
      clap: /*        */ '....X.......X...',
      charley: /*     */ 'xxxxxxxxxxxxxxx.',
      charleyOuvert: /**/ '...............o',
    }),
    pont: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', charley: 'x...x...x...x...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 6, 0), n(6, 2, 4, { vel: 0.7 }), n(8, 6, 0, { vel: 0.85 }), n(14, 2, 6, { vel: 0.65 })]),
    refrain: quatreMesures([n(0, 6, 0), n(7, 1, 4, { vel: 0.7 }), n(8, 4, 0, { octave: 1, vel: 0.8 }), n(12, 4, 4, { vel: 0.75 })]),
  }),
  suites: [
    { nom: 'Amen', degres: ['I', 'I7', 'IV', 'iv'] },
    { nom: 'Louange', degres: ['vi7', 'ii7', 'V7', 'Imaj7'] },
    { nom: 'Dimanche', degres: ['IVmaj7', 'iii7', 'ii7', 'V7'] },
  ],
  instrumentsParDefaut: [
    // Chœurs (fabriqués) : 3 voix serrées + la voix du haut doublée à l'octave, tenues, au refrain.
    {
      id: 'melodie',
      nom: 'Chœurs',
      instrument: 'ocka-choeurs@1',
      role: 'nappe',
      volume: 0.75,
      notes: { ecrire: plaquer({ bas: 57, haut: 72, doublerHaut: true, rythme: [[[0, 8, 0.85], [8, 7.5, 0.8]]] }), sections: ['refrain'], idMotif: 'gospel-choeurs' },
    },
    {
      id: 'piano',
      nom: 'Piano',
      instrument: 'vcsl-piano-queue@1',
      role: 'accords',
      volume: 0.6,
      pan: -0.2,
      notes: {
        ecrire: ensemble(
          plaquer({ bas: 60, haut: 79, forme: FORMES.neuvieme, rythme: [[[0, 3, 0.8], [3, 1, 0.45], [4, 3, 0.65], [8, 3, 0.75], [11, 1, 0.45], [12, 2, 0.6], [14, 2, 0.55]]] }),
          ligne([[[0, 6, 'R', 0.7], [0, 6, 'O', 0.6], [8, 6, 'R', 0.65], [8, 6, 'O', 0.55]]], 36),
        ),
        sections: ['intro', 'couplet', 'refrain', 'outro'],
        idMotif: 'gospel-piano',
      },
    },
    { id: 'orgue', nom: 'Orgue', instrument: 'freepats-orgue-electrique@1', role: 'nappe', volume: 0.6, pan: 0.25, notes: { ecrire: plaquer({ bas: 55, haut: 72, rythme: [[[0, 16, 0.6]]] }), sections: ['couplet', 'refrain', 'outro'], idMotif: 'gospel-orgue' } },
    {
      id: 'basse-electrique',
      nom: 'Basse',
      instrument: 'karoryfer-basse@1',
      role: 'basse',
      volume: 1.15,
      notes: { ecrire: ligne([[[0, 6, 'R', 0.9], [6, 2, 'Q', 0.7], [8, 6, 'R', 0.85], [14, 2, 'A', 0.7]]], 28), sections: ['couplet', 'refrain'], idMotif: 'gospel-basse' },
    },
  ],
  boucles: [['nappe', 'nappe'], ['refrain', 'piano'], ['contrechant', 'epiano'], ['pince', 'piano'], ['arpege', 'piano'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Grosse caisse claire claquante (accordée haut), clap large, kick rond.
      'gospel@1': {
        kick: { de: 150, a: 50, glisse: 0.035, tau: 0.11, duree: 0.4, clic: 0.4, force: 1.6 },
        snare: { corps: [230, 400], tauCorps: 0.05, tauBruit: 0.18, passeHaut: 1200, passeBas: 12000, force: 2.0 },
        charley: { passeHaut: 7500, tauFerme: 0.025, tauOuvert: 0.3, passeBas: 14000 },
        sourdine: 18000,
      },
    },
    basse808: { tau: 0.9, force: 1.4, passeBas: 1000, glisse: 0.06 },
    fill: [10, 11, 12, 13, 14, 15].map((pas, k) => ({ pas, vel: 0.45 + k * 0.1, roul: k >= 4 ? 2 : 0 })),
  },
  onde: [45, 60, 75, 85, 70, 55],
};

export default gospel;
