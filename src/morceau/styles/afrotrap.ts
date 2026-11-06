// Afro trap : 104 BPM, léger swing, kick et 808 en 3-3-2, clap sur 2 et 4, shaker en double-croches, marimba
// qui chante et congas de la banque (vague C2, S1).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { MotifNotes, Note } from '../types';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';
import { motifDeNotes } from './rapmelodique';

/**
 * Percussions latines (VCSL) sur 2 mesures : conga ouverte (63) en écho du 3-3-2, conga étouffée (62), tumba (64)
 * et bongo aigu (60) dans les trous. Notes General MIDI : aucune hauteur, donc aucun lien avec les accords.
 */
function percussionsAfro(): MotifNotes {
  const mesures: [number, number, number][][] = [
    [[0, 64, 0.55], [2, 62, 0.45], [3, 63, 0.8], [6, 63, 0.75], [7, 60, 0.4], [10, 62, 0.5], [11, 63, 0.8], [14, 63, 0.7], [15, 60, 0.45]],
    [[0, 64, 0.55], [2, 62, 0.45], [3, 63, 0.8], [5, 62, 0.4], [6, 63, 0.75], [10, 62, 0.5], [11, 63, 0.8], [13, 64, 0.6], [14, 60, 0.5]],
  ];
  const notes: Note[] = [];
  mesures.forEach((m, k) => {
    for (const [p, midi, vel] of m) notes.push({ pas: k * 16 + p, duree: 2, midi, vel });
  });
  return motifDeNotes(32, notes);
}

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const afrotrap: DefinitionStyle = {
  id: 'afrotrap',
  famille: 'rap',
  textes: { nom: 'Afro trap', phrase: 'Percus africaines, marimba et 808 : la trap qui danse.' },
  genre: 'Hip-Hop/Rap',
  reglages: {
    tempo: 104,
    plage: [95, 115],
    swing: 0.12,
    tonique: 'C',
    mode: 'mineur',
    son: 'nappe',
    preset: 'neutre',
    kit: 'afrotrap@1',
    volumes: { accords: 0.3 },
  },
  // Kick en 3-3-2 (pas 0, 3, 6 puis 8, 11, 14), clap sur 2 et 4, shaker (charley) en double-croches accentuées.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.xxx.xxx.xxx.xx', perc: '...x..x....x..x.' }),
    couplet: motifBatterie({
      kick: /*   */ 'X..X..X.X..X..X. X..X..X.X..X..X.',
      clap: /*   */ '....X.......X... ....X.......X...',
      rim: /*    */ '..x.......x..... ..x.......x...x.',
      charley: /**/ 'xxXxxxXxxxXxxxXx xxXxxxXxxxXxxxXx',
      perc: /*   */ '......x.....x... ...x..x.....x...',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X..X..X.X..X..X. X..X..X.X..X.X..',
      clap: /*        */ '....X.......X... ....X.......X...',
      snare: /*       */ '....o.......o... ....o.......o..x',
      charley: /*     */ 'xxXxxxXxxxXxxx.x xxXxxxXxxxXxxx.x',
      charleyOuvert: /**/ '..............o. ..............o.',
      perc: /*        */ '......x.....x... ...x..x.....x...',
    }),
    pont: motifBatterie({ kick: 'X..X..X.........', clap: '....x.......x...', charley: 'x.x.x.x.x.x.x.x.', perc: '...x..x....x..x.' }),
  }),
  // La 808 suit le kick (3-3-2) et va chercher la quinte et l'octave.
  basse: () => ({
    couplet: quatreMesures([n(0, 3, 0), n(3, 3, 0, { vel: 0.85 }), n(6, 2, 4, { vel: 0.75 }), n(8, 3, 0), n(11, 3, 0, { vel: 0.85 }), n(14, 2, 0, { octave: 1, vel: 0.75 })]),
    refrain: quatreMesures(
      [n(0, 3, 0), n(3, 3, 0, { octave: 1, vel: 0.8 }), n(6, 2, 0, { vel: 0.8 }), n(8, 3, 4), n(11, 3, 0, { vel: 0.85 }), n(14, 2, 2, { vel: 0.75 })],
      [n(0, 3, 0), n(3, 3, 0, { octave: 1, vel: 0.8 }), n(6, 2, 0, { vel: 0.8 }), n(8, 3, 4), n(11, 5, 0, { glisse: true })],
    ),
  }),
  suites: [
    { nom: 'Danse', degres: ['i', 'iv', 'VII', 'III'] },
    { nom: 'Soleil', degres: ['III', 'VII', 'i', 'i'] },
    { nom: 'Quartier', degres: ['i', 'VI', 'iv', 'VII'] },
  ],
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.marimba,
      instrument: 'vcsl-marimba@1',
      role: 'melodie',
      volume: 0.6,
      pan: 0.15,
      notes: { ecrire: 'cloche', sections: ['intro', 'couplet', 'refrain'], idMotif: 'mel-marimba' },
    },
    {
      id: 'percussions',
      nom: P.percussions,
      instrument: 'vcsl-percussions-latines@1',
      role: 'percussions',
      volume: 1.0,
      pan: -0.25,
      notes: { ecrire: percussionsAfro, sections: ['couplet', 'refrain'], idMotif: 'percus-afro' },
    },
  ],
  boucles: [['cloche', 'pluck'], ['arpege', 'pluck'], ['pince', 'pluck'], ['refrain', 'cloche'], ['contrechant', 'lead'], ['nappe', 'nappe']],
  son: {
    kits: {
      // Kick qui claque, caisse claire courte et sèche, charley court et brillant (shaker), « tok » grave (tambour).
      'afrotrap@1': {
        kick: { de: 200, a: 54, glisse: 0.035, tau: 0.09, duree: 0.34, clic: 0.6, force: 2.0 },
        snare: { corps: [240, 430], tauCorps: 0.03, tauBruit: 0.07, passeHaut: 2200, passeBas: 12000, force: 1.8 },
        charley: { passeHaut: 9000, tauFerme: 0.03, tauOuvert: 0.18, passeBas: 15000 },
        sourdine: 20000,
        perc: 620,
        cretes: { charley: 0.26 },
      },
    },
    basse808: { tau: 0.7, force: 2.0, passeBas: 1800, glisse: 0.08 },
    // Le fill reprend le 3-3-2.
    fill: [
      { pas: 8, vel: 0.5, roul: 0 },
      { pas: 11, vel: 0.65, roul: 0 },
      { pas: 14, vel: 0.75, roul: 0 },
      { pas: 15, vel: 0.85, roul: 2 },
    ],
  },
  onde: [90, 30, 30, 75, 30, 30, 80, 25, 70, 30, 30, 75, 30, 30, 85, 25],
};

export default afrotrap;
