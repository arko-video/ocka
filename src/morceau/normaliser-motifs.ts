// Normalisation des motifs (batterie, basse, accords, notes). Corrige au lieu de rejeter. Un ancien motif
// « melodie » (format /2, écrit par une IA par exemple) est lu comme un motif « notes » (son ignoré : il est à la piste).
// Le dictionnaire des motifs est créé sans prototype (Object.create(null)) et les ids passent par `Ids` :
// un motif nommé « __proto__ » ou « constructor » est renommé, jamais branché sur Object.prototype.

import {
  apercu,
  arrondir,
  borner,
  dictionnaire,
  estObjet,
  Ids,
  Journal,
  lireBooleen,
  lireChoix,
  lireNombre,
  lireNombreBrut,
  lirePas24,
  verifierCles,
  type Objet,
} from './normaliser-outils';
import { lireDegre } from './theorie';
import {
  BORNES_NOTE,
  GRILLE_PAS,
  INSTRUMENTS_BATTERIE,
  PLAFONDS,
  type InstrumentBatterie,
  type Motif,
  type MotifAccords,
  type MotifBasse,
  type MotifBatterie,
  type MotifNotes,
  type Note,
  type NoteBasse,
} from './types';

/** Instruments de batterie connus (perso1 à perso4 compris). */
export const INSTRUMENTS: readonly InstrumentBatterie[] = INSTRUMENTS_BATTERIE;
const ROULEMENTS = [0, 2, 3, 4, 6];

/** Longueur d'un motif : un multiple de 16 pas, de 16 à `max` (256 = 16 mesures). */
function lirePas(v: unknown, chemin: string, journal: Journal, max = 256): number {
  const x = lireNombre(v, chemin, journal, { defaut: 16, min: 16, max, nom: 'la longueur du motif' });
  const multiple = Math.max(16, Math.round(x / 16) * 16);
  if (multiple !== x) journal.corrige(chemin, `La longueur du motif (${x} pas) doit être un multiple de 16 : ramenée à ${multiple}.`);
  return multiple;
}

/** Une liste du fichier, coupée au plafond (avec un message). */
function liste(v: unknown, max: number, chemin: string, journal: Journal): unknown[] {
  if (!Array.isArray(v)) return [];
  if (v.length > max) journal.corrige(chemin, `Trop d'éléments (${v.length}) : seuls les ${max} premiers sont gardés.`);
  return v.slice(0, max);
}

/** Ajuste un tableau à `pas` cases (complété par des 0 ou coupé). */
function ajusterLigne(v: unknown, pas: number, chemin: string, journal: Journal, lireCase: (x: number) => number): number[] {
  if (!Array.isArray(v)) {
    journal.corrige(chemin, `Cette ligne devait être une liste de ${pas} nombres : remplacée par du silence.`);
    return new Array<number>(pas).fill(0);
  }
  if (v.length !== pas) journal.corrige(chemin, `La ligne a ${v.length} cases au lieu de ${pas} : ajustée.`);
  let corrigees = 0;
  const ligne = Array.from({ length: pas }, (_, i) => {
    const x = lireNombreBrut(v[i] ?? 0);
    if (x === null) {
      corrigees++;
      return 0;
    }
    const c = lireCase(x);
    if (c !== x) corrigees++;
    return c;
  });
  if (corrigees > 0) journal.corrige(chemin, `${corrigees} case(s) hors limites corrigée(s).`);
  return ligne;
}

const estInstrument = (x: string): x is InstrumentBatterie => (INSTRUMENTS as readonly string[]).includes(x);

function normaliserBatterie(o: Objet, chemin: string, journal: Journal): MotifBatterie {
  verifierCles(o, ['type', 'pas', 'pistes', 'roulements'], chemin, journal);
  const pas = lirePas(o.pas, `${chemin}.pas`, journal);
  const pistes: MotifBatterie['pistes'] = {};
  const brutes = estObjet(o.pistes) ? o.pistes : {};
  if (!estObjet(o.pistes)) journal.corrige(`${chemin}.pistes`, 'Le motif de batterie n’avait pas de lignes : motif vide.');
  for (const [inst, ligne] of Object.entries(brutes)) {
    if (!estInstrument(inst)) {
      journal.ignore(`${chemin}.pistes.${apercu(inst)}`, `L'instrument « ${apercu(inst)} » n'existe pas : ignoré (instruments : ${INSTRUMENTS.join(', ')}).`);
      continue;
    }
    pistes[inst] = ajusterLigne(ligne, pas, `${chemin}.pistes.${inst}`, journal, (x) => arrondir(borner(x, 0, 1)));
  }
  const motif: MotifBatterie = { type: 'batterie', pas, pistes };
  if (estObjet(o.roulements)) {
    motif.roulements = {};
    for (const [inst, ligne] of Object.entries(o.roulements)) {
      // Object.hasOwn : « __proto__ » ou « toString » ne passent jamais pour une ligne existante.
      if (!estInstrument(inst) || !Object.hasOwn(pistes, inst)) {
        journal.ignore(`${chemin}.roulements.${apercu(inst)}`, `Roulements pour « ${apercu(inst)} », qui n'a pas de ligne : ignorés.`);
        continue;
      }
      motif.roulements[inst] = ajusterLigne(ligne, pas, `${chemin}.roulements.${inst}`, journal, (x) =>
        ROULEMENTS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)),
      );
    }
  }
  return motif;
}

function normaliserBasse(o: Objet, chemin: string, journal: Journal): MotifBasse {
  verifierCles(o, ['type', 'pas', 'notes', 'suitAccords'], chemin, journal);
  const pas = lirePas(o.pas, `${chemin}.pas`, journal);
  const notes: NoteBasse[] = [];
  liste(o.notes, PLAFONDS.notesParMotif, `${chemin}.notes`, journal).forEach((b, i) => {
    const c = `${chemin}.notes[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Cette note n’est pas un objet : ignorée.');
    verifierCles(b, ['pas', 'duree', 'degre', 'octave', 'glisse', 'vel'], c, journal);
    const debut = lireNombre(b.pas, `${c}.pas`, journal, { defaut: 0, min: 0, max: pas - 1, nom: 'le pas de départ', entier: true });
    const note: NoteBasse = {
      pas: debut,
      duree: lireNombre(b.duree, `${c}.duree`, journal, { defaut: 4, min: 1, max: pas - debut, nom: 'la durée', entier: true }),
      degre: lireNombre(b.degre, `${c}.degre`, journal, { defaut: 0, min: -14, max: 14, nom: 'le degré', entier: true }),
    };
    if (b.octave !== undefined) note.octave = lireNombre(b.octave, `${c}.octave`, journal, { defaut: 0, min: -2, max: 2, nom: "l'octave", entier: true });
    if (b.glisse !== undefined) note.glisse = lireBooleen(b.glisse, false, `${c}.glisse`, journal);
    if (b.vel !== undefined) note.vel = lireNombre(b.vel, `${c}.vel`, journal, { defaut: 1, min: 0.1, max: 1, nom: 'la vélocité' });
    notes.push(note);
  });
  notes.sort((a, b) => a.pas - b.pas);
  const motif: MotifBasse = { type: 'basse', pas, notes };
  if (o.suitAccords !== undefined) motif.suitAccords = lireBooleen(o.suitAccords, true, `${chemin}.suitAccords`, journal);
  return motif;
}

function normaliserAccords(o: Objet, chemin: string, journal: Journal, mineur: boolean): MotifAccords {
  verifierCles(o, ['type', 'pas', 'accords', 'son'], chemin, journal);
  const pas = lirePas(o.pas, `${chemin}.pas`, journal);
  const accords: MotifAccords['accords'] = [];
  liste(o.accords, PLAFONDS.notesParMotif, `${chemin}.accords`, journal).forEach((b, i) => {
    const c = `${chemin}.accords[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Cet accord n’est pas un objet : ignoré.');
    const debut = lireNombre(b.pas, `${c}.pas`, journal, { defaut: 0, min: 0, max: pas - 1, nom: 'le pas de départ', entier: true });
    const duree = lireNombre(b.duree, `${c}.duree`, journal, { defaut: 16, min: 1, max: pas - debut, nom: 'la durée', entier: true });
    let degre = typeof b.degre === 'string' ? b.degre.trim() : '';
    if (!lireDegre(degre)) {
      const remplace = mineur ? 'i' : 'I';
      journal.corrige(`${c}.degre`, `L'accord « ${apercu(b.degre)} » est illisible : remplacé par « ${remplace} » (exemples : i, VI, iv7, V, Imaj7).`);
      degre = remplace;
    }
    accords.push({ pas: debut, duree, degre });
  });
  accords.sort((a, b) => a.pas - b.pas);
  const motif: MotifAccords = { type: 'accords', pas, accords };
  if (o.son !== undefined) motif.son = lireChoix(o.son, ['piano', 'nappe', 'cloche'] as const, 'piano', `${chemin}.son`, journal, 'le son');
  return motif;
}

function normaliserNotes(o: Objet, chemin: string, journal: Journal): MotifNotes {
  verifierCles(o, ['type', 'pas', 'notes', ...(o.type === 'melodie' ? ['son'] : [])], chemin, journal);
  const pas = lirePas(o.pas, `${chemin}.pas`, journal, PLAFONDS.pasMotifNotes);
  const notes: Note[] = [];
  const vues = new Set<string>();
  const unPas = 1 / GRILLE_PAS;
  liste(o.notes, PLAFONDS.notesParMotifNotes, `${chemin}.notes`, journal).forEach((b, i) => {
    const c = `${chemin}.notes[${i}]`;
    if (!estObjet(b)) return journal.ignore(c, 'Cette note n’est pas un objet : ignorée.');
    verifierCles(b, ['pas', 'duree', 'midi', 'vel', 'glisse'], c, journal);
    const debut = lirePas24(b.pas, `${c}.pas`, journal, { defaut: 0, min: 0, max: pas - unPas, nom: 'le pas de départ' }, GRILLE_PAS);
    const note: Note = {
      pas: debut,
      duree: lirePas24(b.duree, `${c}.duree`, journal, { defaut: 1, min: unPas, max: pas - debut, nom: 'la durée' }, GRILLE_PAS),
      midi: lireNombre(b.midi, `${c}.midi`, journal, { defaut: 60, min: BORNES_NOTE.midiMin, max: BORNES_NOTE.midiMax, nom: 'la hauteur (MIDI)', entier: true }),
      vel: lireNombre(b.vel, `${c}.vel`, journal, { defaut: 1, min: BORNES_NOTE.velMin, max: BORNES_NOTE.velMax, nom: 'la vélocité' }),
    };
    if (b.glisse !== undefined && lireBooleen(b.glisse, false, `${c}.glisse`, journal)) note.glisse = true;
    const cle = `${note.pas}|${note.midi}`;
    if (vues.has(cle)) return journal.corrige(c, 'Deux notes au même pas et à la même hauteur : la seconde est retirée.');
    vues.add(cle);
    notes.push(note);
  });
  notes.sort((a, b) => a.pas - b.pas || a.midi - b.midi);
  return { type: 'notes', pas, notes };
}

/** Normalise tous les motifs (64 au plus). Ceux dont le type est inconnu sont retirés. */
export function normaliserMotifs(v: unknown, journal: Journal, mineur: boolean): { motifs: Record<string, Motif>; ids: Ids } {
  const motifs = dictionnaire<Motif>();
  const ids = new Ids('motif');
  if (!estObjet(v)) {
    if (v !== undefined) journal.corrige('motifs', 'Les motifs devaient être un objet { id: motif } : aucun motif gardé.');
    return { motifs, ids };
  }
  let i = 0;
  for (const [brut, m] of Object.entries(v)) {
    const chemin = `motifs.${apercu(brut)}`;
    if (i >= PLAFONDS.motifs) {
      journal.corrige('motifs', `Trop de motifs : seuls les ${PLAFONDS.motifs} premiers sont gardés.`);
      break;
    }
    if (!estObjet(m)) {
      journal.ignore(chemin, 'Ce motif n’est pas un objet : ignoré.');
      continue;
    }
    let motif: Motif;
    if (m.type === 'batterie') motif = normaliserBatterie(m, chemin, journal);
    else if (m.type === 'basse') motif = normaliserBasse(m, chemin, journal);
    else if (m.type === 'accords') motif = normaliserAccords(m, chemin, journal, mineur);
    else if (m.type === 'notes') motif = normaliserNotes(m, chemin, journal);
    else if (m.type === 'melodie') {
      journal.corrige(`${chemin}.type`, 'Ancien motif de mélodie : lu comme un motif de notes (le son se choisit sur la piste).');
      motif = normaliserNotes(m, chemin, journal);
    } else {
      journal.ignore(`${chemin}.type`, `Type de motif « ${apercu(m.type)} » inconnu (batterie, basse, accords ou notes) : motif ignoré.`);
      continue;
    }
    motifs[ids.donner(brut, i, chemin, journal)] = motif;
    i++;
  }
  return { motifs, ids };
}
