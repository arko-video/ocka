// Reggae : 76 BPM, « one drop » (kick et rim ensemble sur le 3e temps seulement), skank de guitare claire sur
// les contretemps (2 et 4), orgue en « bubble », basse électrique ronde et chantante, mélodica (accordéon) au
// refrain. La batterie est le kit synthétisé (sec et aigu) ; la 808 et les accords sont coupés.

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne, plaquer } from '../styles-ecriture';

const reggae: DefinitionStyle = {
  id: 'reggae',
  famille: 'monde',
  textes: { nom: 'Reggae', phrase: 'One drop, guitare sur les contretemps, basse ronde, tempo posé.' },
  genre: 'Reggae',
  reglages: {
    tempo: 76,
    plage: [66, 90],
    swing: 0.12,
    tonique: 'A',
    mode: 'mineur',
    son: 'piano',
    preset: 'chaud',
    kit: 'reggae@1',
    volumes: { batterie: 0.55 },
    muettes: ['basse', 'accords'],
  },
  // One drop au couplet, « rockers » (kick sur 1 et 3) au refrain.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', rim: '........x.......' }),
    couplet: motifBatterie({
      kick: /*   */ '........X.......',
      rim: /*    */ '........X.......',
      charley: /**/ 'x.o.x.o.x.o.x.o. x.o.x.o.x.o.x.ox',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X.......X.......',
      snare: /*       */ '........X.......',
      charley: /*     */ 'x.x.x.x.x.x.x.x.',
      charleyOuvert: /**/ '..o.......o.....',
      perc: /*        */ '................ ..........x..x..',
    }),
    pont: motifBatterie({ kick: '........X.......', rim: '........x.......', charley: 'x...x...x...x...' }),
  }),
  basse: () => ({
    couplet: quatreMesures([n(0, 3, 0), n(4, 2, 2, { vel: 0.7 }), n(6, 4, 4, { vel: 0.8 }), n(12, 2, 0, { octave: 1, vel: 0.7 })]),
    refrain: quatreMesures([n(0, 3, 0), n(3, 1, 2, { vel: 0.6 }), n(4, 4, 4, { vel: 0.8 }), n(10, 2, 0, { vel: 0.75 }), n(14, 2, 6, { vel: 0.7 })]),
  }),
  suites: [
    { nom: 'Roots', degres: ['i', 'iv', 'i', 'v'] },
    { nom: 'Kingston', degres: ['i', 'VII', 'i', 'VII'] },
    { nom: 'Soleil', degres: ['i', 'iv', 'VII', 'III'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Mélodica', instrument: 'freepats-accordeon@1', role: 'melodie', volume: 1.0, pan: 0.2, notes: { ecrire: boucleDans('contrechant', 64, 81, 0.95), sections: ['refrain'], idMotif: 'reggae-melodica' } },
    {
      id: 'skank',
      nom: 'Guitare skank',
      instrument: 'freepats-guitare-claire@1',
      role: 'accords',
      volume: 0.9,
      pan: -0.3,
      notes: { ecrire: plaquer({ bas: 60, haut: 74, gratte: 0.04, rythme: [[[4, 0.9, 0.9], [12, 0.9, 0.85]]] }), sections: ['intro', 'couplet', 'refrain', 'outro'], idMotif: 'reggae-skank' },
    },
    {
      id: 'orgue',
      nom: 'Orgue bubble',
      instrument: 'freepats-orgue-electrique@1',
      role: 'nappe',
      volume: 0.62,
      pan: 0.3,
      notes: { ecrire: plaquer({ bas: 52, haut: 67, rythme: [[[2, 1, 0.5], [4, 1.5, 0.7], [6, 1, 0.5], [10, 1, 0.5], [12, 1.5, 0.7], [14, 1, 0.5]]] }), sections: ['couplet', 'refrain'], idMotif: 'reggae-orgue' },
    },
    {
      id: 'basse-electrique',
      nom: 'Basse',
      instrument: 'karoryfer-basse@1',
      role: 'basse',
      volume: 1.25,
      notes: { ecrire: ligne([[[0, 3, 'R', 0.95], [4, 2, 'T', 0.7], [6, 4, 'Q', 0.8], [12, 2, 'O', 0.7], [14, 2, 'A', 0.65]]], 28), sections: ['couplet', 'refrain'], idMotif: 'reggae-basse' },
    },
  ],
  boucles: [['contrechant', 'lead'], ['pince', 'epiano'], ['refrain', 'lead'], ['arpege', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick rond et grave, caisse et rim secs et aigus (accordés haut), charley fin.
      'reggae@1': {
        kick: { de: 130, a: 50, glisse: 0.04, tau: 0.13, duree: 0.42, clic: 0.3, force: 1.5 },
        snare: { corps: [320, 520], tauCorps: 0.03, tauBruit: 0.07, passeHaut: 2200, passeBas: 11000, force: 1.7 },
        charley: { passeHaut: 7500, tauFerme: 0.02, tauOuvert: 0.18, passeBas: 14000 },
        sourdine: 16000,
        perc: 700,
        cretes: { rim: 0.6 },
      },
    },
    basse808: { tau: 1.0, force: 1.2, passeBas: 800, glisse: 0.06 },
    fill: [{ pas: 11, vel: 0.5, roul: 0 }, { pas: 13, vel: 0.65, roul: 0 }, { pas: 14, vel: 0.75, roul: 0 }, { pas: 15, vel: 0.9, roul: 0 }],
  },
  onde: [30, 30, 75, 30, 30, 30, 80, 30],
};

export default reggae;
