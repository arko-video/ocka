// Bossa nova : 128 BPM, guitare nylon en rythme bossa (pouce sur 1 et 3, accords syncopés sur 2 mesures),
// contrebasse fondamentale-quinte, batterie aux balais (cross-stick en clave bossa) et shaker.
// Kit synthétisé très discret (la vraie batterie est la piste « Balais »), 808 coupée (la contrebasse joue).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ensemble, ligne, percus, plaquer, FORMES } from '../styles-ecriture';

/** Guitare : 2 mesures. Le pouce (fondamentale grave) sur 1 et 3, les accords en syncope (« João Gilberto »). */
const guitare = ensemble(
  plaquer({
    bas: 52,
    haut: 67,
    forme: FORMES.sansFondamentale,
    rythme: [
      [[0, 2, 0.75], [4, 2, 0.55], [10, 2, 0.7], [14, 2, 0.6]],
      [[2, 2, 0.6], [8, 2, 0.7], [12, 3, 0.65]],
    ],
  }),
  ligne([[[0, 6, 'R', 0.7], [8, 6, 'Q', 0.6]]], 40),
);

const bossanova: DefinitionStyle = {
  id: 'bossanova',
  famille: 'monde',
  textes: { nom: 'Bossa nova', phrase: 'Guitare nylon, contrebasse et balais : la douceur de Rio.' },
  genre: 'Latin',
  reglages: {
    tempo: 128,
    plage: [110, 145],
    swing: 0.04,
    tonique: 'F',
    mode: 'majeur',
    son: 'piano',
    preset: 'clair',
    kit: 'bossanova@1',
    volumes: { batterie: 0.22, accords: 0.14 },
    muettes: ['basse'],
  },
  // Kit synthétisé (discret, sans kick : celui des balais suffit) : cross-stick en clave bossa, charley doux.
  batterie: () => ({
    intro: motifBatterie({ rim: 'x..x..x.....x..x ..x...x...x.....', charley: 'x.x.x.x.x.x.x.x.' }),
    couplet: motifBatterie({
      rim: /*    */ 'X..X..X.....X..X ..X...X...X.....',
      charley: /**/ 'xxoxxxoxxxoxxxox',
    }),
    refrain: motifBatterie({
      rim: /*    */ 'X..X..X.....X..X ..X...X...X.....',
      charley: /**/ 'xxoxxxoxxxoxxxox',
      perc: /*   */ '..........x..... ......x.......x.',
    }),
    pont: motifBatterie({ kick: 'X.......X.......', rim: '...X..X.....X...', charley: 'x.x.x.x.x.x.x.x.' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 6, 0, { vel: 0.8 }), n(6, 2, 4, { vel: 0.6 }), n(8, 6, 0, { vel: 0.75 }), n(14, 2, 4, { vel: 0.6 })]),
    refrain: quatreMesures([n(0, 6, 0, { vel: 0.8 }), n(6, 2, 4, { vel: 0.6 }), n(8, 6, 4, { vel: 0.75 }), n(14, 2, 0, { octave: 1, vel: 0.6 })]),
  }),
  suites: [
    { nom: 'Ipanema', degres: ['Imaj7', 'II7', 'ii7', 'bII7'] },
    { nom: 'Saudade', degres: ['ii7', 'V7', 'Imaj7', 'vi7'] },
    { nom: 'Copacabana', degres: ['Imaj7', 'vi7', 'ii7', 'V7'] },
  ],
  instrumentsParDefaut: [
    // La flûte chante un contre-chant au refrain (on la remplace par une Boucle OCKA si on veut).
    { id: 'melodie', nom: 'Flûte', instrument: 'vsco-flute@1', role: 'melodie', volume: 0.8, pan: 0.15, notes: { ecrire: boucleDans('contrechant', 67, 86, 0.8), sections: ['refrain'], idMotif: 'bossa-flute' } },
    { id: 'guitare', nom: 'Guitare nylon', instrument: 'freepats-guitare-nylon@1', role: 'accords', volume: 0.85, pan: -0.15, notes: { ecrire: guitare, sections: ['intro', 'couplet', 'refrain', 'outro'], idMotif: 'bossa-guitare' } },
    {
      id: 'contrebasse',
      nom: 'Contrebasse',
      instrument: 'karoryfer-contrebasse@1',
      role: 'basse',
      volume: 0.9,
      notes: { ecrire: ligne([[[0, 6, 'R', 0.85], [6, 2, 'Q', 0.65], [8, 6, 'Q', 0.75], [14, 2, 'A', 0.6]]], 33), sections: ['couplet', 'refrain'], idMotif: 'bossa-contrebasse' },
    },
    {
      id: 'balais',
      nom: 'Balais',
      instrument: 'karoryfer-batterie-balais@1',
      role: 'percussions',
      volume: 0.8,
      notes: {
        ecrire: percus({
          36: 'X.....o.X.....o. X.....o.X.....o. X.....o.X.....o. X.....o.X.....o.',
          40: 'o..o..o.....o..o ..o...o...o..... o..o..o.....o..o ..o...o...o.....',
          38: 'xxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx xxxxxxxxxxxx.x.x',
          44: '....o.......o... ....o.......o... ....o.......o... ....o.......o...',
        }),
        sections: ['couplet', 'refrain'],
        idMotif: 'bossa-balais',
      },
    },
    { id: 'shaker', nom: 'Shaker', instrument: 'vcsl-percussions-latines@1', role: 'percussions', volume: 1.5, pan: 0.35, notes: { ecrire: percus({ 70: 'XoXoXoXoXoXoXoXo', 75: '..........o.....' }), sections: ['refrain'], idMotif: 'bossa-shaker' } },
  ],
  boucles: [['contrechant', 'epiano'], ['pince', 'pluck'], ['refrain', 'epiano'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Doux et feutré : kick rond sans clic, caisse sourde, charley fin, tout adouci.
      'bossanova@1': {
        kick: { de: 120, a: 55, glisse: 0.04, tau: 0.1, duree: 0.35, clic: 0.1, force: 1.1 },
        snare: { corps: [190, 330], tauCorps: 0.04, tauBruit: 0.09, passeHaut: 1200, passeBas: 7000, force: 1.1 },
        charley: { passeHaut: 8000, tauFerme: 0.018, tauOuvert: 0.2, passeBas: 13000 },
        sourdine: 9000,
        perc: 1300,
        cretes: { charley: 0.2, rim: 0.36 },
      },
    },
    basse808: { tau: 0.6, force: 1.1, passeBas: 700, glisse: 0.06 },
    fill: [{ pas: 12, vel: 0.35, roul: 0 }, { pas: 14, vel: 0.45, roul: 0 }, { pas: 15, vel: 0.55, roul: 0 }],
  },
  onde: [40, 55, 35, 60, 45, 30, 55, 40],
};

export default bossanova;
