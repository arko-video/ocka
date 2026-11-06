// Rap mélodique : 128 BPM en demi-tempo, guitare nylon en arpège, piano doux en accords plaqués, 808 ronde et
// discrète, batterie légère : tout laisse la place au chant (vague C2, S1).
// Ce fichier porte aussi les outils PURS partagés par les styles rap qui écrivent leurs propres notes de départ
// (accords mesure par mesure, motif de notes propre) : jazz rap, afro trap, memphis, UK drill.

import { motifAccordsDe, sectionDe } from '../acces';
import { motifBatterie, n, quatreMesures } from '../styles-grilles';
import { notesAccord, voicingProche } from '../theorie';
import type { Morceau, MotifNotes, Note } from '../types';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import type { DefinitionStyle } from './definition';

/* ------------------------------------------------------------ outils partagés (purs) */

/** L'accord d'une mesure : fondamentale (classe 0 à 11), classes de ses notes, voicing proche du précédent. */
export interface AccordMesure {
  racine: number;
  classes: number[];
  voicing: number[];
}

/** Les accords d'une section, un par mesure (motif d'accords de 1 à 4 mesures), voicings entre `bas` et `haut`. */
export function accordsParMesure(m: Morceau, idSection: string, bas = 52, haut = 76): { pas: number; accords: AccordMesure[] } {
  const section = sectionDe(m, idSection) ?? m.sections[0];
  const motif = section ? motifAccordsDe(m, section) : undefined;
  const { tonique, mode } = m.tonalite;
  const repos = mode === 'majeur' ? 'I' : 'i';
  const pas = Math.max(16, Math.min(64, Math.floor((motif?.pas ?? 64) / 16) * 16));
  const accords: AccordMesure[] = [];
  let precedent: number[] | null = null;
  for (let k = 0; k * 16 < pas; k++) {
    const i = motif ? (k * 16) % motif.pas : 0;
    const degre = motif?.accords.find((a) => i >= a.pas && i < a.pas + a.duree)?.degre ?? repos;
    const lues = notesAccord(tonique, mode, degre);
    const notes = lues.length > 0 ? lues : notesAccord(tonique, mode, repos);
    const voicing = voicingProche(notes, precedent, bas, haut);
    precedent = voicing;
    accords.push({ racine: notes[0]! % 12, classes: notes.map((x) => x % 12), voicing });
  }
  return { pas, accords };
}

/** La note de classe `classe` (0 à 11) la plus grave à partir de `bas`. */
export function auDessus(classe: number, bas: number): number {
  return bas + ((((classe - bas) % 12) + 12) % 12);
}

/** Motif de notes propre : dans le motif, bornes respectées, sans doublon (même pas, même note), trié. */
export function motifDeNotes(pas: number, notes: Note[]): MotifNotes {
  const vues = new Set<string>();
  const propres: Note[] = [];
  for (const x of notes) {
    const cle = `${x.pas}|${x.midi}`;
    if (x.pas < 0 || x.pas >= pas || x.midi < 12 || x.midi > 120 || vues.has(cle)) continue;
    vues.add(cle);
    propres.push({ ...x, duree: Math.max(1, Math.min(x.duree, pas - x.pas)), vel: Math.min(1, Math.max(0.1, x.vel)) });
  }
  propres.sort((a, b) => a.pas - b.pas || a.midi - b.midi);
  return { type: 'notes', pas, notes: propres };
}

/* ------------------------------------------------------------ rap mélodique */

/** Piano doux : l'accord plaqué dans le médium-grave (sous la voix), sur 1, le « et » de 2 et le « et » de 3. */
function pianoPlaque(m: Morceau, idSection: string): MotifNotes {
  const { pas, accords } = accordsParMesure(m, idSection, 50, 67);
  const notes: Note[] = [];
  accords.forEach((a, k) => {
    for (const [p, duree, vel] of [[0, 6, 0.62], [6, 4, 0.48], [10, 6, 0.52]] as const) {
      for (const midi of a.voicing) notes.push({ pas: k * 16 + p, duree, midi, vel });
    }
  });
  return motifDeNotes(pas, notes);
}

const P = TEXTES_STYLES_RAP.stylesRap.pistes;

const rapmelodique: DefinitionStyle = {
  id: 'rapmelodique',
  famille: 'rap',
  textes: { nom: 'Rap mélodique', phrase: 'Guitare et piano mélancoliques, 808 douce : place au chant.' },
  genre: 'Hip-Hop/Rap',
  reglages: {
    tempo: 128,
    plage: [116, 145],
    swing: 0,
    tonique: 'E',
    mode: 'mineur',
    son: 'nappe',
    preset: 'neutre',
    kit: 'rapmelodique@1',
    // La guitare et le piano portent l'harmonie : la nappe des accords reste en dessous, comme une colle.
    volumes: { accords: 0.22 },
  },
  // Caisse claire sur le 3e temps, charley léger en croches, quelques roulements doux.
  batterie: () => ({
    intro: motifBatterie({ charley: 'x.x.x.x.x.x.x.x.', rim: '................ ............x...' }),
    couplet: motifBatterie(
      {
        kick: /*   */ 'X........X...... X......X..X.....',
        snare: /*  */ '........X....... ........X.......',
        charley: /**/ 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.xxx.',
        rim: /*    */ '...............x ................',
      },
      { charley: '................ ............2...' },
    ),
    refrain: motifBatterie(
      {
        kick: /*        */ 'X........X...... X.....X...X..o..',
        snare: /*       */ '........X....... ........X.......',
        clap: /*        */ '........o....... ........o.......',
        charley: /*     */ 'X.x.X.x.X.x.X.x. X.x.X.x.X.x.X...',
        charleyOuvert: /**/ '................ ..............o.',
      },
      { charley: '......2.......3. ..........2.....' },
    ),
    pont: motifBatterie({ kick: 'X.......X.......', snare: '........x.......', charley: 'x...x...x...x...', rim: '...............x' }),
  }),
  // Ronde et tenue ; un glissé vers l'octave à la fin de la mesure.
  basse: () => ({
    couplet: quatreMesures([n(0, 9, 0), n(9, 3, 0, { vel: 0.8 }), n(12, 4, 0, { octave: 1, vel: 0.7 })]),
    refrain: quatreMesures([n(0, 6, 0, { glisse: true }), n(6, 4, 0, { octave: 1, vel: 0.8 }), n(10, 6, 0)]),
  }),
  suites: [
    { nom: 'Mélancolie', degres: ['i', 'VI', 'III', 'VII'] },
    { nom: 'Larmes', degres: ['VI', 'VII', 'i', 'v'] },
    { nom: 'Nostalgie', degres: ['iv', 'i', 'VI', 'VII'] },
  ],
  // Guitare en arpège partout ; le piano entre à l'intro et au refrain (le couplet reste léger pour le rap).
  instrumentsParDefaut: [
    {
      id: 'melodie',
      nom: P.guitare,
      instrument: 'freepats-guitare-nylon@1',
      role: 'melodie',
      volume: 0.62,
      pan: -0.2,
      notes: { ecrire: 'arpege', sections: ['intro', 'couplet', 'refrain'], idMotif: 'mel-guitare' },
    },
    {
      id: 'piano',
      nom: P.pianoDoux,
      instrument: 'karoryfer-piano-doux@1',
      role: 'accords',
      volume: 0.7,
      pan: 0.2,
      notes: { ecrire: pianoPlaque, sections: ['intro', 'refrain'], idMotif: 'piano-plaque' },
    },
  ],
  boucles: [['arpege', 'pluck'], ['refrain', 'piano'], ['contrechant', 'piano'], ['pince', 'pluck'], ['nappe', 'nappe'], ['cloche', 'cloche']],
  son: {
    kits: {
      // Kick rond, caisse claire douce, charley fin : une batterie qui ne prend pas la place de la voix.
      'rapmelodique@1': {
        kick: { de: 200, a: 48, glisse: 0.045, tau: 0.12, duree: 0.42, clic: 0.35, force: 1.6 },
        snare: { corps: [200, 350], tauCorps: 0.05, tauBruit: 0.13, passeHaut: 1300, passeBas: 10000, force: 1.5 },
        charley: { passeHaut: 7800, tauFerme: 0.02, tauOuvert: 0.25, passeBas: 14000 },
        sourdine: 16000,
        perc: 700,
      },
    },
    basse808: { tau: 1.5, force: 1.5, passeBas: 1600, glisse: 0.1 },
    fill: [
      { pas: 12, vel: 0.45, roul: 2 },
      { pas: 14, vel: 0.6, roul: 2 },
      { pas: 15, vel: 0.75, roul: 3 },
    ],
  },
  onde: [70, 40, 55, 75, 45, 60, 35, 50],
};

export default rapmelodique;
