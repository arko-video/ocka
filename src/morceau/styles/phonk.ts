// Phonk : 135 BPM en demi-tempo, cloche 808 qui chante (piste « melodie »), 808 saturée, charleys en triolets
// (vague B : son FIGÉ, test nul).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';

const phonk: DefinitionStyle = {
  id: 'phonk',
  famille: 'rap',
  textes: { nom: 'Phonk', phrase: 'Cloche qui chante, 808 saturée, charleys en triolets.' },
  genre: 'Hip-Hop/Rap',
  reglages: {
    tempo: 135,
    plage: [125, 145],
    swing: 0,
    tonique: 'F#',
    mode: 'mineur',
    son: 'nappe',
    preset: 'neutre',
    kit: 'phonk@1',
    // 808 très saturée et kick saturé, plus denses : un peu plus bas pour garder le niveau de la trap.
    volumes: { batterie: 0.75, basse: 0.68 },
  },
  // Caisse claire sèche sur le 3e temps, charley en triolets (roulements de 3).
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', perc: '................ ...........x....' }, { charley: '......3.......3. ..3.......3...3.' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X.....X...X..... X.....X..X...o..',
        snare: /*  */ '........X....... ........X.......',
        charley: /**/ 'X.x.X.x.X.x.X.x. X.x.X.x.X.x.X.x.',
        perc: /*   */ '................ ...........x....',
      },
      { charley: '..3...3...3...3. ..3...3.....3.3.' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X.....X...X..X.. X.....X..X..X...',
        snare: /*       */ '........X....... ........X.......',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'XxXxXxXxXxXxXxXx XxXxXxXxXxXxXx.x',
        charleyOuvert: /**/ '................ ..............o.',
      },
      { charley: '.....3.......3.. .....3.....3.3..' },
    ),
    pont: motifBatterie({ kick: 'X.........X.....', snare: '........o.......', charley: 'x..x..x..x..x.x.' }, { charley: '............3...' }),
  }),
  // Notes longues qui glissent vers l'octave et vers l'accord suivant.
  basse: () => ({
    couplet: quatreMesures([n(0, 10, 0, { glisse: true }), n(10, 6, 0, { octave: 1, glisse: true })]),
    refrain: quatreMesures(
      [n(0, 6, 0), n(6, 4, 0, { octave: 1, glisse: true }), n(10, 6, 0, { glisse: true })],
      [n(0, 6, 0), n(6, 4, 0, { octave: 1 }), n(10, 3, 0), n(13, 3, 0, { octave: 1, glisse: true })],
    ),
  }),
  suites: [
    { nom: 'Memphis', degres: ['i', 'iv', 'VI', 'V'] },
    { nom: 'Dérive', degres: ['i', 'bII', 'i', 'VII'] },
    { nom: 'Fumée', degres: ['i', 'VII', 'VI', 'v'] },
  ],
  // La cloche mélodique (accordée sur la tonalité) joue dans l'intro et le refrain.
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: 'Mélodie',
      instrument: 'ocka-cloche@1',
      role: 'melodie',
      notes: { ecrire: 'cloche', depuis: 'refrain', sections: ['intro', 'refrain'], idMotif: 'mel-cloche' },
    },
  ],
  boucles: [['cloche', 'cloche'], ['arpege', 'pluck'], ['contrechant', 'lead'], ['refrain', 'cloche'], ['nappe', 'nappe'], ['pince', 'pluck']],
  son: {
    kits: {
      // Kick saturé qui claque, caisse claire SÈCHE (courte), charley fin et court, cloche 808 dure.
      'phonk@1': {
        kick: { de: 210, a: 50, glisse: 0.035, tau: 0.1, duree: 0.4, clic: 0.7, force: 3.2 },
        snare: { corps: [210, 380], tauCorps: 0.028, tauBruit: 0.05, passeHaut: 1800, passeBas: 12000, force: 2.4 },
        charley: { passeHaut: 8000, tauFerme: 0.016, tauOuvert: 0.2, passeBas: 16000 },
        sourdine: 20000,
        cowbell: { f1: 562, f2: 845, tau: 0.09, force: 2.5 },
      },
    },
    // Très saturée et longue.
    basse808: { tau: 2.6, force: 4.5, passeBas: 3200, glisse: 0.1 },
    // Roulements en triolets.
    fill: [
      { pas: 12, vel: 0.5, roul: 3 },
      { pas: 13, vel: 0.6, roul: 3 },
      { pas: 14, vel: 0.75, roul: 3 },
      { pas: 15, vel: 0.9, roul: 3 },
    ],
    variantes: { cloche: 'cowbell' },
  },
  onde: [95, 25, 25, 70, 25, 25, 85, 30, 30, 60, 20, 45],
};

export default phonk;
