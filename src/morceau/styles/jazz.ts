// Jazz : 132 BPM swing (croches ternaires écrites dans les notes), contrebasse qui marche (walking bass),
// piano en voicings sans fondamentale sur le rythme « Charleston », batterie jazz enregistrée (ride « ding,
// ding-a-ding », charley au pied sur 2 et 4), saxophone ténor au refrain. Kit synthétisé discret, 808 coupée.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { Note } from '../types';
import type { DefinitionStyle, EcrireNotes } from './definition';
import { boucleDans, frappesNote, ligne, motif, plaquer, swinguer, FORMES, type Frappe } from '../styles-ecriture';

const T = 8 / 3; // la croche « et » swinguée (2/3 du temps)

/** Batterie jazz : 4 mesures, ride ternaire, charley au pied, caisse claire qui commente, petite relance à la fin. */
const batterieJazz: EcrireNotes = () => {
  const notes: Note[] = [];
  for (let k = 0; k < 4; k++) {
    const o = k * 16;
    const ride: Frappe[] = [[o, 4, 0.9], [o + 4, 4, 1], [o + 4 + T, 1, 0.75], [o + 8, 4, 0.9], [o + 12, 4, 1], [o + 12 + T, 1, 0.75]];
    notes.push(...frappesNote(51, ride));
    notes.push(...frappesNote(44, [[o + 4, 2, 0.85], [o + 12, 2, 0.85]]));
    notes.push(...frappesNote(36, [[o, 2, 0.45], [o + 8, 2, 0.4]]));
  }
  // La caisse claire commente (notes fantômes), puis relance en triolets à la 4e mesure.
  notes.push(...frappesNote(38, [[8 + T, 2, 0.3], [16 + 4 + T, 2, 0.25], [16 + 12, 2, 0.35], [32 + T, 2, 0.3], [32 + 8 + T, 2, 0.4]]));
  notes.push(...frappesNote(38, [[48 + 8, 2, 0.35], [48 + 8 + 4 / 3, 2, 0.45], [48 + 8 + T, 2, 0.55], [48 + 12 + T, 2, 0.7]]));
  notes.push(...frappesNote(49, [[0, 16, 0.5]]));
  return motif(64, notes);
};

const jazz: DefinitionStyle = {
  id: 'jazz',
  famille: 'poprockjazz',
  textes: { nom: 'Jazz', phrase: 'Contrebasse qui marche, ride qui swingue, accords riches.' },
  genre: 'Jazz',
  reglages: {
    tempo: 132,
    plage: [100, 200],
    swing: 0,
    tonique: 'A#',
    mode: 'majeur',
    son: 'piano',
    preset: 'clair',
    kit: 'jazz@1',
    volumes: { batterie: 0.12 },
    muettes: ['basse', 'accords'],
  },
  // Kit synthétisé (discret) : il marque les noires ; le swing est dans la piste « Batterie jazz ».
  batterie: () => ({
    intro: motifBatterie({ charley: '....x.......x...', kick: 'x...............' }),
    couplet: motifBatterie({ kick: /**/ 'x...x...x...x...', charley: '....o.......o...', rim: '................ ..........x.....' }),
    refrain: motifBatterie({ kick: 'o...x...o...x...', charley: '....X.......X...', snare: '..........x..... ......x.......x.' }),
    pont: motifBatterie({ charley: '....x.......x...', rim: '........x.......' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 4, 0), n(4, 4, 2, { vel: 0.7 }), n(8, 4, 4, { vel: 0.8 }), n(12, 4, 5, { vel: 0.7 })]),
    refrain: quatreMesures([n(0, 4, 0), n(4, 4, 4, { vel: 0.7 }), n(8, 4, 0, { octave: 1, vel: 0.75 }), n(12, 4, 6, { vel: 0.7 })]),
  }),
  suites: [
    { nom: 'Deux-cinq-un', degres: ['ii7', 'V7', 'Imaj7', 'VI7'] },
    { nom: 'Standard', degres: ['Imaj7', 'vi7', 'ii7', 'V7'] },
    { nom: 'Club', degres: ['iii7', 'VI7', 'ii7', 'V7'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Saxophone ténor', instrument: 'vcsl-saxophone@1', role: 'melodie', volume: 0.85, pan: 0.2, notes: { ecrire: swinguer(boucleDans('refrain', 58, 77, 0.85)), sections: ['refrain'], idMotif: 'jazz-sax' } },
    {
      id: 'piano',
      nom: 'Piano',
      instrument: 'vcsl-piano-queue@1',
      role: 'accords',
      volume: 0.65,
      pan: -0.2,
      notes: {
        ecrire: swinguer(plaquer({ bas: 50, haut: 70, forme: FORMES.sansFondamentale, rythme: [[[0, 2, 0.6], [6, 3, 0.55]], [[2, 2, 0.5], [8, 4, 0.55]]] })),
        sections: ['intro', 'couplet', 'refrain', 'outro'],
        idMotif: 'jazz-piano',
      },
    },
    {
      id: 'contrebasse',
      nom: 'Contrebasse',
      instrument: 'karoryfer-contrebasse@1',
      role: 'basse',
      volume: 0.7,
      notes: {
        ecrire: ligne([[[0, 4, 'R', 0.9], [4, 4, 'T', 0.75], [8, 4, 'Q', 0.8], [12, 4, 'A', 0.75]], [[0, 4, 'R', 0.9], [4, 4, 'Q', 0.75], [8, 4, 'O', 0.75], [12, 4, 'A', 0.75]]], 31),
        sections: ['couplet', 'refrain'],
        idMotif: 'jazz-contrebasse',
      },
    },
    { id: 'batterie-jazz', nom: 'Batterie jazz', instrument: 'virtuosity-batterie-jazz@1', role: 'percussions', volume: 1.5, notes: { ecrire: batterieJazz, sections: ['couplet', 'refrain'], idMotif: 'jazz-batterie' } },
  ],
  boucles: [['refrain', 'epiano'], ['contrechant', 'piano'], ['arpege', 'piano'], ['pince', 'epiano'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      'jazz@1': {
        kick: { de: 110, a: 52, glisse: 0.04, tau: 0.09, duree: 0.3, clic: 0.1, force: 1.0 },
        snare: { corps: [200, 340], tauCorps: 0.03, tauBruit: 0.16, passeHaut: 2000, passeBas: 8000, force: 1.0 },
        charley: { passeHaut: 6500, tauFerme: 0.03, tauOuvert: 0.25, passeBas: 11000 },
        sourdine: 9000,
        cretes: { charley: 0.28 },
      },
    },
    basse808: { tau: 0.5, force: 1.0, passeBas: 600, glisse: 0.05 },
    fill: [{ pas: 10, vel: 0.35, roul: 0 }, { pas: 12, vel: 0.45, roul: 0 }, { pas: 14, vel: 0.6, roul: 0 }],
  },
  onde: [50, 35, 60, 30, 55, 40, 45, 65],
};

export default jazz;
