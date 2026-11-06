// UK drill : 142 BPM, charley qui rebondit en 3-3-2 et caisse claire décalée en contretemps, 808 qui glisse
// longuement vers la quinte et l'octave, piano sombre et cordes tendues (vague C2, S1).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { Morceau, MotifNotes, Note } from '../types';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';
import { accordsParMesure, motifDeNotes } from './rapmelodique';

/** Cordes tenues : l'accord entier, une mesure par accord, dans le médium (sombre, sous la voix). */
function cordesTenues(m: Morceau, idSection: string): MotifNotes {
  const { pas, accords } = accordsParMesure(m, idSection, 55, 70);
  const notes: Note[] = [];
  accords.forEach((a, k) => {
    for (const midi of a.voicing) notes.push({ pas: k * 16, duree: 16, midi, vel: 0.75 });
  });
  return motifDeNotes(pas, notes);
}

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const ukdrill: DefinitionStyle = {
  id: 'ukdrill',
  famille: 'rap',
  textes: { nom: 'UK drill', phrase: 'Le drill de Londres : 808 qui glissent, charleys nerveux.' },
  genre: 'Hip-Hop/Rap',
  reglages: { tempo: 142, plage: [138, 146], swing: 0, tonique: 'A#', mode: 'mineur', son: 'nappe', preset: 'neutre', kit: 'ukdrill@1', volumes: { accords: 0.3 } },
  // Caisse claire sur le 3e temps, puis décalée (fantôme sur le « e » de 1, coup sur le « et » de 4) à la 2e mesure.
  batterie: () => ({
    intro: motifBatterie({ charley: '..x...x...x...x.', perc: '.....x..........' }, { charley: '..........3.....' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X.....X......... ..X.......X.....',
        snare: /*  */ '........X....... ...x....X.....x.',
        charley: /**/ 'X..X..X.X..X..X. ..X..X..X..X.X..',
        perc: /*   */ '.....x.......x.. .........x......',
      },
      { charley: '......3......... ...........3....' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X.....X...X..... ..X.......X..X..',
        snare: /*       */ '........X....... ...x....X.....X.',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'X..X..X.X..X..X. X..X..X.X..X.XX.',
        charleyOuvert: /**/ '..o............. ................',
        perc: /*        */ '.....x.......x.. .....x...x......',
      },
      { charley: '...3.......4.... ......3......4..' },
    ),
    pont: motifBatterie({ kick: 'X...........X...', snare: '........x.......', charley: '..x...x...x...x.' }),
  }),
  // Glissés longs : vers la quinte, puis vers l'octave.
  basse: () => ({
    couplet: quatreMesures([n(0, 6, 0, { glisse: true }), n(6, 4, 4, { glisse: true }), n(10, 6, 0, { octave: 1 })]),
    refrain: quatreMesures(
      [n(0, 3, 0, { glisse: true }), n(3, 5, 0, { octave: 1, glisse: true }), n(8, 4, 0), n(12, 4, 2, { glisse: true })],
      [n(0, 3, 0, { glisse: true }), n(3, 5, 0, { octave: 1, glisse: true }), n(8, 8, 4, { octave: -1 })],
    ),
  }),
  suites: [
    { nom: 'Brouillard', degres: ['i', 'iv', 'VI', 'v'] },
    { nom: 'Londres', degres: ['i', 'VI', 'v', 'i'] },
    { nom: 'Bloc', degres: ['i', 'bII', 'iv', 'v'] },
  ],
  // Piano sombre à l'intro et au refrain ; cordes tenues au couplet et au refrain.
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.piano,
      instrument: 'ocka-piano@1',
      role: 'melodie',
      volume: 0.8,
      pan: 0.1,
      notes: { ecrire: 'contrechant', sections: ['intro', 'refrain'], idMotif: 'mel-piano' },
    },
    {
      id: 'cordes',
      nom: P.cordes,
      instrument: 'vsco-cordes@1',
      role: 'nappe',
      volume: 0.45,
      pan: -0.2,
      notes: { ecrire: cordesTenues, sections: ['couplet', 'refrain'], idMotif: 'cordes' },
    },
  ],
  boucles: [['contrechant', 'piano'], ['refrain', 'piano'], ['nappe', 'nappe'], ['arpege', 'pluck'], ['cloche', 'cloche'], ['pince', 'piano']],
  son: {
    kits: {
      // Kick court au sub profond, caisse claire claquante et brève, charley sec, « tok » aigu.
      'ukdrill@1': {
        kick: { de: 270, a: 52, glisse: 0.028, tau: 0.07, duree: 0.3, clic: 0.7, force: 2.3 },
        snare: { corps: [250, 450], tauCorps: 0.03, tauBruit: 0.075, passeHaut: 2500, passeBas: 14000, force: 2.1 },
        charley: { passeHaut: 9000, tauFerme: 0.015, tauOuvert: 0.2, passeBas: 17000 },
        sourdine: 20000,
        perc: 1350,
      },
    },
    // Glissé bien plus long que la drill : on l'entend monter.
    basse808: { tau: 1.5, force: 2.8, passeBas: 2400, glisse: 0.16 },
    fill: [
      { pas: 8, vel: 0.5, roul: 3 },
      { pas: 11, vel: 0.6, roul: 3 },
      { pas: 13, vel: 0.75, roul: 2 },
      { pas: 14, vel: 0.85, roul: 3 },
      { pas: 15, vel: 0.9, roul: 6 },
    ],
  },
  onde: [85, 15, 15, 65, 15, 15, 75, 20, 60, 15, 15, 70, 20, 45, 15, 30],
};

export default ukdrill;
