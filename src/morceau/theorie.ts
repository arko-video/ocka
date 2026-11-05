// Théorie musicale d'OCKA : gammes, accords écrits en degrés romains (« i », « VI », « V7 »),
// voicings proches (les notes bougent le moins possible d'un accord à l'autre) et fréquences.
// Les notes sont des numéros MIDI : 60 = do du milieu (C4), 69 = la 440 Hz.

import type { Mode, Tonique } from './types';

export const TONIQUES: Tonique[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Écart en demi-tons de chaque degré par rapport à la tonique. */
export const GAMMES: Record<Mode, number[]> = {
  majeur: [0, 2, 4, 5, 7, 9, 11],
  mineur: [0, 2, 3, 5, 7, 8, 10], // mineur naturel
};

/** Fréquence (Hz) d'une note MIDI : 69 = 440 Hz, +12 = une octave plus haut. */
export function frequenceMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Classe de hauteur (0 à 11) d'une tonique : C = 0, A = 9. */
export function hauteurTonique(t: Tonique): number {
  return TONIQUES.indexOf(t);
}

/**
 * Demi-tons d'un degré de la gamme (0 = tonique), qui peut dépasser l'octave ou être négatif :
 * degré 7 = tonique une octave plus haut, degré −1 = 7e degré une octave plus bas.
 */
export function demiTonsDegre(mode: Mode, degre: number): number {
  const g = GAMMES[mode];
  const octave = Math.floor(degre / 7);
  const reste = degre - octave * 7;
  return g[reste]! + 12 * octave;
}

/* ------------------------------------------------------------------ accords en degrés romains */

export type Qualite = 'majeur' | 'mineur' | 'diminue' | 'augmente' | 'sus2' | 'sus4';
export type Septieme = 'aucune' | 'mineure' | 'majeure' | 'diminuee';

export interface AccordLu {
  /** Index du degré (0 = I, 6 = VII). */
  degre: number;
  /** Altération en demi-tons (« bVII » = −1). */
  alteration: number;
  qualite: Qualite;
  septieme: Septieme;
}

const ROMAINS = ['VII', 'VI', 'IV', 'V', 'III', 'II', 'I']; // les plus longs d'abord pour bien découper
const INDEX_ROMAIN: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

/**
 * Lit un accord écrit en degré romain. Majuscule = accord majeur, minuscule = mineur.
 * Suffixes : « 7 » (7e de dominante en majuscule, 7e mineure en minuscule), « maj7 », « ° » ou « dim »,
 * « ø » (demi-diminué), « + » (augmenté), « sus2 », « sus4 ». Préfixes « b » ou « # ».
 * Renvoie null si le texte n'est pas un accord.
 */
export function lireDegre(texte: string): AccordLu | null {
  let s = texte.trim();
  let alteration = 0;
  if (s.startsWith('b') || s.startsWith('♭')) {
    alteration = -1;
    s = s.slice(1);
  } else if (s.startsWith('#') || s.startsWith('♯')) {
    alteration = 1;
    s = s.slice(1);
  }
  const romain = ROMAINS.find((r) => s.toUpperCase().startsWith(r));
  if (!romain) return null;
  const ecrit = s.slice(0, romain.length);
  const minuscule = ecrit === ecrit.toLowerCase();
  if (!minuscule && ecrit !== ecrit.toUpperCase()) return null; // « Vi » : mélange, illisible
  const suffixe = s.slice(romain.length);
  let qualite: Qualite = minuscule ? 'mineur' : 'majeur';
  let septieme: Septieme = 'aucune';
  switch (suffixe) {
    case '':
      break;
    case '7':
      septieme = 'mineure'; // V7 = 7e de dominante (7e mineure sur accord majeur), ii7 = 7e mineure
      break;
    case 'maj7':
    case 'M7':
      septieme = 'majeure';
      break;
    case '°':
    case 'dim':
    case 'o':
      qualite = 'diminue';
      break;
    case '°7':
    case 'dim7':
    case 'o7':
      qualite = 'diminue';
      septieme = 'diminuee';
      break;
    case 'ø':
    case 'ø7':
    case 'm7b5':
      qualite = 'diminue';
      septieme = 'mineure';
      break;
    case '+':
    case 'aug':
      qualite = 'augmente';
      break;
    case 'sus2':
      qualite = 'sus2';
      break;
    case 'sus4':
    case 'sus':
      qualite = 'sus4';
      break;
    default:
      return null;
  }
  return { degre: INDEX_ROMAIN[romain]!, alteration, qualite, septieme };
}

const INTERVALLES: Record<Qualite, number[]> = {
  majeur: [0, 4, 7],
  mineur: [0, 3, 7],
  diminue: [0, 3, 6],
  augmente: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};
const SEPTIEMES: Record<Septieme, number | null> = { aucune: null, mineure: 10, majeure: 11, diminuee: 9 };

/** Demi-tons de la fondamentale d'un accord par rapport à la tonique (0 à 11). */
export function fondamentale(mode: Mode, accord: AccordLu): number {
  return (((GAMMES[mode][accord.degre]! + accord.alteration) % 12) + 12) % 12;
}

/** Notes de l'accord (demi-tons depuis sa fondamentale) : triade, plus la 7e s'il y en a une. */
export function intervallesAccord(accord: AccordLu): number[] {
  const notes = [...INTERVALLES[accord.qualite]];
  const sept = SEPTIEMES[accord.septieme];
  if (sept !== null) notes.push(sept);
  return notes;
}

/**
 * Notes MIDI d'un accord en position fondamentale, dans l'octave qui commence à `base` (défaut : do 4 = 60).
 * Renvoie [] si le degré est illisible.
 */
export function notesAccord(tonique: Tonique, mode: Mode, degre: string, base = 60): number[] {
  const lu = lireDegre(degre);
  if (!lu) return [];
  const racine = base + ((hauteurTonique(tonique) + fondamentale(mode, lu)) % 12);
  return intervallesAccord(lu).map((i) => racine + i);
}

/** Toutes les façons de poser les mêmes notes (renversements) entre `bas` et `haut` (MIDI). */
function positionsPossibles(classes: number[], bas: number, haut: number): number[][] {
  const resultats: number[][] = [];
  for (let depart = bas; depart <= haut - 4; depart++) {
    // La note la plus grave doit être une note de l'accord, les autres sont empilées au-dessus.
    if (!classes.includes(((depart % 12) + 12) % 12)) continue;
    const notes = [depart];
    for (const c of classes) {
      if (((c - depart) % 12 + 12) % 12 === 0) continue;
      notes.push(depart + ((((c - depart) % 12) + 12) % 12));
    }
    notes.sort((a, b) => a - b);
    if (notes[notes.length - 1]! <= haut) resultats.push(notes);
  }
  return resultats;
}

/**
 * Voicing proche : choisit le renversement de l'accord qui bouge le moins depuis `precedent`
 * (somme des écarts entre notes), dans la zone [bas, haut]. Sans accord précédent : le plus proche du centre.
 */
export function voicingProche(notes: number[], precedent: number[] | null, bas = 52, haut = 76): number[] {
  if (notes.length === 0) return [];
  const classes = [...new Set(notes.map((n) => ((n % 12) + 12) % 12))];
  const choix = positionsPossibles(classes, bas, haut);
  if (choix.length === 0) return notes;
  const centre = (bas + haut) / 2;
  const cout = (v: number[]) => {
    if (!precedent || precedent.length === 0) return Math.abs(v.reduce((a, n) => a + n, 0) / v.length - centre);
    let c = 0;
    for (const n of v) c += Math.min(...precedent.map((p) => Math.abs(p - n)));
    return c;
  };
  let meilleur = choix[0]!;
  for (const v of choix) if (cout(v) < cout(meilleur)) meilleur = v;
  return meilleur;
}

/** Suite d'accords en voicings proches : chaque accord suit le précédent. */
export function voicingsSuite(tonique: Tonique, mode: Mode, degres: string[]): number[][] {
  let precedent: number[] | null = null;
  return degres.map((d) => {
    const v = voicingProche(notesAccord(tonique, mode, d), precedent);
    precedent = v;
    return v;
  });
}

/** Normalise une tonique écrite librement (« Bb », « sol », « f# ») ; null si illisible. */
export function lireTonique(texte: string): Tonique | null {
  const s = texte.trim();
  const latins: Record<string, number> = { do: 0, re: 2, ré: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
  const m = s.match(/^([A-Ga-g]|do|ré|re|mi|fa|sol|la|si)\s*([#♯b♭]?)$/i);
  if (!m) return null;
  const nom = m[1]!.toLowerCase();
  const lettres: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  let h = nom.length === 1 ? lettres[nom]! : latins[nom]!;
  if (m[2] === '#' || m[2] === '♯') h += 1;
  if (m[2] === 'b' || m[2] === '♭') h -= 1;
  return TONIQUES[((h % 12) + 12) % 12]!;
}
