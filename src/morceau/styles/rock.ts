// Rock : 120 BPM, vraie batterie (batterie acoustique enregistrée : kick, caisse sur 2 et 4, charley en croches,
// crash, roulement de toms), guitare saturée en quintes à vide (croches), basse électrique, guitare claire en
// arpèges à l'intro et un solo au refrain. Kit synthétisé discret, 808 et accords coupés (les guitares jouent).

import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import type { DefinitionStyle } from './definition';
import { boucleDans, ligne, percus, plaquer, FORMES, type Frappe, type NoteLigne } from '../styles-ecriture';

const croches = (accents: number[]): Frappe[] => Array.from({ length: 8 }, (_, i) => [i * 2, 2, accents[i % accents.length]!] as Frappe);
const basseCroches: NoteLigne[] = Array.from({ length: 8 }, (_, i) => [i * 2, 2, 'R', i % 4 === 0 ? 0.95 : 0.75] as NoteLigne);

const rock: DefinitionStyle = {
  id: 'rock',
  famille: 'poprockjazz',
  textes: { nom: 'Rock', phrase: 'Guitares saturées, vraie batterie, énergie brute.' },
  genre: 'Rock',
  reglages: {
    tempo: 120,
    plage: [100, 150],
    swing: 0,
    tonique: 'E',
    mode: 'majeur',
    son: 'nappe',
    preset: 'clair',
    kit: 'rock@1',
    volumes: { batterie: 0.12 },
    muettes: ['basse', 'accords'],
  },
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', kick: 'X...............' }),
    couplet: motifBatterie({
      kick: /*   */ 'X.......X.o..... X.....o.X.o.....',
      snare: /*  */ '....X.......X...',
      charley: /**/ 'o.x.o.x.o.x.o.x.',
    }),
    refrain: motifBatterie({
      kick: /*        */ 'X.....o.X.o..... X.o...o.X.o.....',
      snare: /*       */ '....X.......X... ....X.......X.xx',
      charleyOuvert: /**/ 'o.o.o.o.o.o.o.o.',
    }),
    pont: motifBatterie({ kick: 'X.......X.......', snare: '....x.......x...', charley: 'x.x.x.x.x.x.x.x.' }),
  }),
  basse: () => ({
    couplet: quatreMesures(Array.from({ length: 8 }, (_, i) => n(i * 2, 2, 0, { vel: i % 4 === 0 ? 0.9 : 0.7 }))),
    refrain: quatreMesures([n(0, 2), n(2, 2), n(4, 2), n(6, 2, 0, { octave: 1, vel: 0.7 }), n(8, 2), n(10, 2), n(12, 2, 4), n(14, 2, 4)]),
  }),
  suites: [
    { nom: 'Classique', degres: ['I', 'bVII', 'IV', 'I'] },
    { nom: 'Hymne', degres: ['vi', 'IV', 'I', 'V'] },
    { nom: 'Garage', degres: ['I', 'IV', 'V', 'IV'] },
  ],
  instrumentsParDefaut: [
    { id: 'melodie', nom: 'Guitare solo', instrument: 'freepats-guitare-claire@1', role: 'lead', volume: 1.1, pan: 0.3, notes: { ecrire: boucleDans('contrechant', 64, 84, 1), sections: ['refrain'], idMotif: 'rock-solo' } },
    {
      id: 'guitare',
      nom: 'Guitare saturée',
      instrument: 'freepats-guitare-saturee@1',
      role: 'accords',
      volume: 0.7,
      pan: -0.3,
      notes: { ecrire: plaquer({ bas: 40, haut: 60, forme: FORMES.puissance, rythme: [croches([0.95, 0.7, 0.8, 0.7])] }), sections: ['couplet', 'refrain'], idMotif: 'rock-guitare' },
    },
    { id: 'arpeges', nom: 'Guitare claire', instrument: 'freepats-guitare-claire@1', role: 'arpege', volume: 1.0, pan: 0.25, notes: { ecrire: boucleDans('arpege', 52, 76, 0.8), sections: ['intro', 'outro'], idMotif: 'rock-arpeges' } },
    { id: 'basse-electrique', nom: 'Basse électrique', instrument: 'karoryfer-basse@1', role: 'basse', volume: 0.85, notes: { ecrire: ligne([basseCroches], 28), sections: ['couplet', 'refrain'], idMotif: 'rock-basse' } },
    {
      id: 'batterie-rock',
      nom: 'Batterie',
      instrument: 'karoryfer-batterie@1',
      role: 'percussions',
      volume: 0.6,
      notes: {
        ecrire: percus({
          36: 'X.......X.o..... X.....o.X.o..... X.......X.o..... X.....o.X.......',
          38: '....X.......X... ....X.......X... ....X.......X... ....X.......XoXX',
          42: 'o.x.o.x.o.x.o.x. o.x.o.x.o.x.o.x. o.x.o.x.o.x.o.x. o.x.o.x.o.x.....',
          49: 'X............... ................ ................ ................',
          50: '................ ................ ................ ..........o.....',
          43: '................ ................ ................ ...........o....',
        }),
        sections: ['couplet', 'refrain'],
        idMotif: 'rock-batterie',
      },
    },
  ],
  boucles: [['contrechant', 'lead'], ['refrain', 'lead'], ['arpege', 'pluck'], ['pince', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Discret, sous la vraie batterie : un kick qui pousse, une caisse ronde.
      'rock@1': {
        kick: { de: 150, a: 55, glisse: 0.03, tau: 0.09, duree: 0.32, clic: 0.6, force: 1.6 },
        snare: { corps: [180, 320], tauCorps: 0.05, tauBruit: 0.16, passeHaut: 1100, passeBas: 10000, force: 1.5 },
        charley: { passeHaut: 7000, tauFerme: 0.04, tauOuvert: 0.35, passeBas: 14000 },
        sourdine: 16000,
      },
    },
    basse808: { tau: 0.8, force: 1.6, passeBas: 1200, glisse: 0.05 },
    fill: [10, 11, 12, 13, 14, 15].map((pas, k) => ({ pas, vel: 0.5 + k * 0.08, roul: 0 })),
  },
  onde: [85, 70, 90, 65, 95, 75],
};

export default rock;
