// Memphis : le rap sombre des années 90 (Three 6 Mafia), 72 BPM, kick 808 qui gronde, caisse claire sale,
// charley rapide (doubles-croches et roulements), cowbell 808, son de cassette ; une cloche qui égrène et une nappe
// sombre (vague C2, S1).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { Morceau, MotifNotes, Note } from '../types';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';
import { accordsParMesure, auDessus, motifDeNotes } from './rapmelodique';

/** Nappe sombre : la fondamentale et la quinte de chaque accord, tenues, dans le médium grave (sous la voix). */
function nappeSombre(m: Morceau, idSection: string): MotifNotes {
  const { pas, accords } = accordsParMesure(m, idSection);
  const notes: Note[] = [];
  accords.forEach((a, k) => {
    const r = auDessus(a.racine, 50);
    notes.push({ pas: k * 16, duree: 16, midi: r, vel: 0.75 });
    notes.push({ pas: k * 16, duree: 16, midi: r + 7, vel: 0.6 });
  });
  return motifDeNotes(pas, notes);
}

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const memphis: DefinitionStyle = {
  id: 'memphis',
  famille: 'rap',
  textes: { nom: 'Memphis', phrase: 'Le rap sombre des années 90 : cowbell, kick lourd, son cassette.' },
  genre: 'Hip-Hop/Rap',
  reglages: {
    tempo: 72,
    plage: [64, 82],
    swing: 0,
    tonique: 'E',
    mode: 'mineur',
    son: 'nappe',
    preset: 'chaud',
    kit: 'memphis@1',
    // Kick 808 long et saturé, 808 longue : un peu plus bas pour garder le niveau de la trap.
    volumes: { batterie: 0.8, basse: 0.7, accords: 0.28 },
  },
  // Caisse claire sur 2 et 4 (on compte lentement), charley en double-croches avec des roulements, cowbell syncopée.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', cowbell: '...x......x.....' }, { charley: '..2...2...2...2.' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X......X..X..... X.....X.X.......',
        snare: /*  */ '....X.......X... ....X.......X...',
        charley: /**/ 'XxXxXxXxXxXxXxXx XxXxXxXxXxXxXxXx',
        cowbell: /**/ '...x..x....x..x. ...x..x....x....',
      },
      { charley: '...2...2...2.2.2 ...2...2...3...2' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X......X..X..X.. X.....X.X...X...',
        snare: /*       */ '....X.......X... ....X.......X...',
        clap: /*        */ '....o.......o... ....o.......o...',
        charley: /*     */ 'XxXxXxXxXxXxXx.x XxXxXxXxXxXxXx.x',
        charleyOuvert: /**/ '..............o. ..............o.',
        cowbell: /*     */ '...x..x....x..x. ...x..x....x.x..',
      },
      { charley: '.2.2...2.3...2.. .2.2...2.3.2.3..' },
    ),
    pont: motifBatterie({ kick: 'X.......X.......', snare: '....x.......x...', cowbell: '...x..x....x..x.' }),
  }),
  // Notes longues et graves (le kick 808 fait le reste).
  basse: () => ({
    couplet: quatreMesures([n(0, 7, 0), n(10, 6, 0, { vel: 0.85 })]),
    refrain: quatreMesures([n(0, 7, 0), n(7, 3, 0, { octave: 1, vel: 0.7 }), n(10, 6, 0)], [n(0, 7, 0), n(7, 3, 0, { octave: 1, vel: 0.7 }), n(10, 6, 1, { glisse: true })]),
  }),
  suites: [
    { nom: 'Horreur', degres: ['i', 'bII', 'i', 'V'] },
    { nom: 'Cassette', degres: ['i', 'iv', 'VI', 'V'] },
    { nom: 'Rituel', degres: ['i', 'i', 'bII', 'iv'] },
  ],
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.cloche,
      instrument: 'ocka-cloche@1',
      role: 'melodie',
      volume: 0.35,
      pan: 0.2,
      notes: { ecrire: 'arpege', sections: ['intro', 'refrain'], idMotif: 'mel-cloche' },
    },
    {
      id: 'nappe',
      nom: P.nappeSombre,
      instrument: 'ocka-nappe@1',
      role: 'nappe',
      volume: 0.7,
      pan: -0.15,
      notes: { ecrire: nappeSombre, sections: ['intro', 'couplet', 'refrain'], idMotif: 'nappe-sombre' },
    },
  ],
  boucles: [['arpege', 'cloche'], ['cloche', 'cloche'], ['nappe', 'nappe'], ['contrechant', 'piano'], ['refrain', 'piano'], ['pince', 'epiano']],
  son: {
    kits: {
      // Kick 808 long qui gronde, caisse claire sale (saturée), tout étouffé comme une cassette, cowbell 808 accordée.
      'memphis@1': {
        kick: { de: 170, a: 46, glisse: 0.05, tau: 0.22, duree: 0.7, clic: 0.3, force: 2.0 },
        snare: { corps: [200, 360], tauCorps: 0.045, tauBruit: 0.12, passeHaut: 1400, passeBas: 9000, force: 2.8 },
        charley: { passeHaut: 7000, tauFerme: 0.02, tauOuvert: 0.25, passeBas: 12000 },
        sourdine: 10000,
        bande: 2.0,
        coupeBas: 30,
        cowbell: { f1: 560, f2: 842, tau: 0.1, force: 1.8 },
        cretes: { cowbell: 0.34, charley: 0.3 },
      },
    },
    basse808: { tau: 1.0, force: 2.4, passeBas: 1400, glisse: 0.1 },
    fill: [
      { pas: 12, vel: 0.5, roul: 2 },
      { pas: 13, vel: 0.6, roul: 2 },
      { pas: 14, vel: 0.7, roul: 3 },
      { pas: 15, vel: 0.85, roul: 3 },
    ],
  },
  onde: [95, 20, 40, 30, 70, 25, 40, 85, 20, 45, 30, 65],
};

export default memphis;
