// Jazz rap : 90 BPM, swing 0,3, piano droit en accords de 7e, contrebasse, ride de la batterie jazz enregistrée,
// kit poussiéreux et vinyle (vague C2, S1). La 808 est muette au départ : la contrebasse tient le grave.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { Morceau, MotifNotes, Note } from '../types';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';
import { accordsParMesure, auDessus, motifDeNotes } from './rapmelodique';

/**
 * Piano droit : accords de 7e dans le médium (sous la voix), joués « autour » du temps comme un pianiste de jazz :
 * juste après le 1 (le kick et la contrebasse attaquent seuls), sur le « et » de 2, sur 3 et, puis l'accord suivant
 * anticipé sur le dernier quart de temps.
 */
function pianoJazz(m: Morceau, idSection: string): MotifNotes {
  const { pas, accords } = accordsParMesure(m, idSection, 53, 70);
  const notes: Note[] = [];
  accords.forEach((a, k) => {
    for (const [p, duree, vel] of [[2, 4, 0.6], [6, 2, 0.45], [10, 4, 0.52]] as const) {
      for (const midi of a.voicing) notes.push({ pas: k * 16 + p, duree, midi, vel });
    }
    for (const midi of accords[(k + 1) % accords.length]!.voicing) notes.push({ pas: k * 16 + 15, duree: 1, midi, vel: 0.5 });
  });
  return motifDeNotes(pas, notes);
}

/**
 * Contrebasse : la fondamentale (entre mi 1 et ré# 2, le grave de l'instrument), la quinte, l'octave, puis une note d'approche un demi-ton
 * sous la fondamentale de la mesure suivante (le walking du jazz, simplifié pour le rap).
 */
function contrebasse(m: Morceau, idSection: string): MotifNotes {
  const { pas, accords } = accordsParMesure(m, idSection);
  const notes: Note[] = [];
  accords.forEach((a, k) => {
    const r = auDessus(a.racine, 28);
    const suivante = auDessus(accords[(k + 1) % accords.length]!.racine, 28);
    const d = k * 16;
    notes.push({ pas: d, duree: 5, midi: r, vel: 0.92 });
    notes.push({ pas: d + 6, duree: 2, midi: r + 7, vel: 0.8 });
    notes.push({ pas: d + 8, duree: 3, midi: r + 12, vel: 0.72 });
    notes.push({ pas: d + 12, duree: 3, midi: suivante - 1 >= 26 ? suivante - 1 : suivante + 11, vel: 0.88 });
  });
  return motifDeNotes(pas, notes);
}

/** Ride (note 51 de la batterie jazz) : « ding, ding-ga » sur chaque temps, avec le swing du morceau. */
function rideJazz(): MotifNotes {
  const notes: Note[] = [];
  for (let k = 0; k < 2; k++) {
    for (const [p, vel] of [[0, 0.95], [4, 0.85], [7, 0.66], [8, 0.92], [12, 0.85], [15, 0.66]] as const) {
      notes.push({ pas: k * 16 + p, duree: 2, midi: 51, vel: k === 1 && p === 15 ? 0.75 : vel });
    }
  }
  return motifDeNotes(32, notes);
}

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const jazzrap: DefinitionStyle = {
  id: 'jazzrap',
  famille: 'rap',
  textes: { nom: 'Jazz rap', phrase: 'Contrebasse, piano jazz et batterie qui swingue.' },
  genre: 'Hip-Hop/Rap',
  reglages: {
    tempo: 90,
    plage: [82, 98],
    swing: 0.3,
    tonique: 'G',
    mode: 'mineur',
    son: 'piano',
    preset: 'chaud',
    kit: 'jazzrap@1',
    // Le piano droit joue les accords : le piano électrique des accords reste un simple fond.
    volumes: { accords: 0.4, batterie: 0.68 },
    // La contrebasse remplace la 808 (on peut la rallumer).
    muettes: ['basse'],
  },
  // Caisse claire sur 2 et 4, charley sur les contretemps (la ride joue les temps), vinyle 2 fois par mesure.
  batterie: () => ({
    intro: motifBatterie({ kick: 'X.........X.....', rim: '....x.......x...', perc: 'x.......x.......' }),
    couplet: motifBatterie({
      kick: /*   */ 'X.......X.X..... X......X..X.....',
      snare: /*  */ '....X.......X... ....X.......X...',
      charley: /**/ '..x...x...x...x. ..x...x...x...x.',
      perc: /*   */ 'x.......x....... x.......x.......',
    }),
    refrain: motifBatterie({
      kick: /*   */ 'X.......X.X...x. X......X..X..x..',
      snare: /*  */ '....X.......X... ....X.......X..x',
      charley: /**/ '..x...x...x...x. ..x...x...x.x.x.',
      rim: /*    */ '.......x........ ...........x....',
      perc: /*   */ 'x.......x....... x.......x.......',
    }),
    pont: motifBatterie({ kick: 'X.......X.......', rim: '....x.......x...', charley: '..x...x...x...x.', perc: 'x.......x.......' }),
  }),
  // 808 (muette au départ) : courte et sourde, comme une contrebasse.
  basse: () => ({
    couplet: quatreMesures([n(0, 4, 0), n(8, 3, 0, { vel: 0.8 }), n(11, 4, 4, { octave: -1, vel: 0.8 })]),
    refrain: quatreMesures([n(0, 3, 0), n(6, 2, 2, { vel: 0.7 }), n(8, 4, 0), n(12, 3, 4, { octave: -1, vel: 0.8 })]),
  }),
  suites: [
    { nom: 'Velours', degres: ['i7', 'iv7', 'VII7', 'IIImaj7'] },
    { nom: 'Club de jazz', degres: ['iiø7', 'V7', 'i7', 'i7'] },
    { nom: 'Dimanche', degres: ['i7', 'VImaj7', 'iv7', 'v7'] },
  ],
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.pianoDroit,
      instrument: 'vsco-piano-droit@1',
      role: 'accords',
      volume: 1.2,
      pan: 0.15,
      notes: { ecrire: pianoJazz, sections: ['intro', 'couplet', 'refrain'], idMotif: 'piano-jazz' },
    },
    {
      id: 'contrebasse',
      nom: P.contrebasse,
      instrument: 'karoryfer-contrebasse@1',
      role: 'basse',
      volume: 1.0,
      notes: { ecrire: contrebasse, sections: ['couplet', 'refrain'], idMotif: 'contrebasse' },
      // Compresseur doux : des notes égales sous la voix, sans écraser le jeu.
      tranche: { inserts: [{ id: 'compresseur', type: 'compresseur', actif: true, params: { seuil: -22, ratio: 3, attaque: 20, relache: 160, genou: 6, mix: 1 } }] },
    },
    {
      id: 'ride',
      nom: P.ride,
      instrument: 'virtuosity-batterie-jazz@1',
      role: 'percussions',
      volume: 1.2,
      pan: 0.3,
      notes: { ecrire: rideJazz, sections: ['couplet', 'refrain'], idMotif: 'ride-jazz' },
    },
  ],
  boucles: [['refrain', 'epiano'], ['pince', 'piano'], ['contrechant', 'epiano'], ['arpege', 'piano'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick rond (un peu plus bas : il tombe avec l'attaque de la contrebasse), caisse claire au long souffle
      // (presque des balais), tout un peu étouffé et saturé, vinyle.
      'jazzrap@1': {
        kick: { de: 140, a: 50, glisse: 0.05, tau: 0.13, duree: 0.4, clic: 0.3, force: 1.7 },
        snare: { corps: [190, 320], tauCorps: 0.05, tauBruit: 0.13, passeHaut: 1000, passeBas: 7000, force: 1.6 },
        charley: { passeHaut: 6800, tauFerme: 0.03, tauOuvert: 0.35, passeBas: 10000 },
        sourdine: 9500,
        bande: 1.3,
        coupeBas: 40,
        vinyle: true,
        cretes: { kick: 0.78, perc: 0.26, charley: 0.28 },
      },
    },
    basse808: { tau: 0.6, force: 1.3, passeBas: 800, glisse: 0.08 },
    // 4 coups secs qui montent, comme un batteur de jazz.
    fill: [
      { pas: 10, vel: 0.4, roul: 0 },
      { pas: 12, vel: 0.55, roul: 0 },
      { pas: 14, vel: 0.65, roul: 0 },
      { pas: 15, vel: 0.85, roul: 0 },
    ],
    variantes: { epiano: 'lofi' },
  },
  onde: Array.from({ length: 24 }, (_, i) => [80, 25, 45, 60, 20, 70, 30, 50][i % 8]! - (i % 3) * 4),
};

export default jazzrap;
