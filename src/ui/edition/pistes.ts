// Édition pure des pistes instrument (vue Pistes, « + Piste ») — propriétaire : U1, vague C1.
// Signatures figées dans api-edition.ts. Règles : 16 pistes instrument au plus (null au-delà : l'interface dit
// T.pistes.trop) ; ids neufs par idPisteLibre (jamais un id fixe) ; supprimer une piste retire ses références dans
// les sections (ses motifs restent s'ils servent ailleurs) et dans les effets de performance ; jamais de mutation.

import {
  estPisteInstrument,
  idMotifDe,
  idPisteLibre,
  motifParId,
  pisteDe,
  pistesInstrument,
} from '../../morceau/acces';
import {
  PLAFONDS,
  REGLE_INSTRUMENT,
  type Morceau,
  type Motif,
  type PisteInstrument,
  type Section,
} from '../../morceau/types';
import { idLibre, nettoyerId } from './ids';
import { idsPris } from './notes-motif';

const LONGUEUR_NOM = 40;

/** Nom lisible tiré de l'id d'un instrument : « ocka-piano@1 » → « Piano », « vcsl-marimba@1 » → « Marimba ». */
export function nomDepuisInstrument(instrument: string): string {
  const sans = instrument.replace(/@\d+$/, '');
  const morceaux = sans.split('-');
  const utile = (morceaux.length > 1 ? morceaux.slice(1) : morceaux).join(' ').trim() || 'Piste';
  return utile.charAt(0).toUpperCase() + utile.slice(1);
}

/** Nom libre parmi les pistes instrument : « Piano », puis « Piano 2 », « Piano 3 »… (40 caractères au plus). */
export function nomLibre(m: Morceau, base: string, sauf?: string): string {
  const propre = base.replace(/\s+/g, ' ').trim().slice(0, LONGUEUR_NOM) || 'Piste';
  const pris = new Set(
    pistesInstrument(m)
      .filter((p) => p.id !== sauf)
      .map((p) => p.nom.toLowerCase()),
  );
  if (!pris.has(propre.toLowerCase())) return propre;
  for (let n = 2; ; n++) {
    const suffixe = ` ${n}`;
    const nom = propre.slice(0, LONGUEUR_NOM - suffixe.length).trimEnd() + suffixe;
    if (!pris.has(nom.toLowerCase())) return nom;
  }
}

/** Insère la piste après la dernière piste instrument (ou après `apres`), avant « sons » et « voix ». */
function inserer(m: Morceau, p: PisteInstrument, apres?: string): Morceau {
  const pistes = [...m.pistes];
  let i = apres ? pistes.findIndex((x) => x.id === apres) + 1 : -1;
  if (i <= 0) {
    const derniere = pistes.reduce((k, x, j) => (estPisteInstrument(x) ? j : k), -1);
    const fin = pistes.findIndex((x) => x.id === 'sons' || x.id === 'voix');
    i = derniere >= 0 ? derniere + 1 : fin >= 0 ? fin : pistes.length;
  }
  pistes.splice(i, 0, p);
  return { ...m, pistes };
}

/** « + Piste » : une piste instrument neuve (id libre, nom par défaut = nom de l'instrument) ; null au-delà de 16. */
export function ajouterPiste(
  m: Morceau,
  instrument: string,
  nom?: string,
): { m: Morceau; id: string } | null {
  if (pistesInstrument(m).length >= PLAFONDS.pistesInstrument || !REGLE_INSTRUMENT.test(instrument))
    return null;
  const nomFinal = nomLibre(m, nom?.trim() || nomDepuisInstrument(instrument));
  const id = idPisteLibre(m, nettoyerId(nomFinal) || 'piste');
  const p: PisteInstrument = {
    id,
    genre: 'instrument',
    nom: nomFinal,
    instrument,
    volume: 0.8,
    pan: 0,
    muet: false,
    solo: false,
  };
  return { m: inserer(m, p), id };
}

/** Copie profonde d'un motif (les notes, accords… sont des objets simples). */
const copieMotif = (x: Motif): Motif => JSON.parse(JSON.stringify(x)) as Motif;

/**
 * Duplique une piste juste après elle : mêmes réglages, nom « X 2 », et ses motifs COPIÉS (la copie s'édite seule ;
 * un motif partagé par plusieurs sections reste partagé dans la copie). null au-delà de 16 pistes.
 */
export function dupliquerPiste(m: Morceau, id: string): { m: Morceau; id: string } | null {
  const p = pisteDe(m, id);
  if (!estPisteInstrument(p) || pistesInstrument(m).length >= PLAFONDS.pistesInstrument) return null;
  const nom = nomLibre(m, p.nom);
  const idNeuf = idPisteLibre(m, nettoyerId(nom) || 'piste');
  const copie: PisteInstrument = {
    ...(JSON.parse(JSON.stringify(p)) as PisteInstrument),
    id: idNeuf,
    nom,
    solo: false,
  };
  const motifs = Object.assign(Object.create(null) as Morceau['motifs'], m.motifs);
  const pris = idsPris(m);
  const correspondance = new Map<string, string>();
  const sections = m.sections.map((s): Section => {
    const ancien = idMotifDe(s, id);
    const motif = motifParId(m, ancien);
    if (!ancien || !motif) return s;
    let neuf = correspondance.get(ancien);
    if (!neuf) {
      neuf = idLibre(`${idNeuf}-${s.id}`, pris, 'notes');
      pris.push(neuf);
      correspondance.set(ancien, neuf);
      motifs[neuf] = copieMotif(motif);
    }
    const d = Object.assign(Object.create(null) as Section['motifs'], s.motifs);
    d[idNeuf] = neuf;
    return { ...s, motifs: d };
  });
  if (Object.keys(motifs).length > PLAFONDS.motifs) return null;
  return { m: inserer({ ...m, motifs, sections }, copie, id), id: idNeuf };
}

/** Retire une piste instrument, ses références dans les sections, ses motifs devenus inutiles, et ses effets de perf. */
export function supprimerPiste(m: Morceau, id: string): Morceau {
  if (!estPisteInstrument(pisteDe(m, id))) return m;
  const sections = m.sections.map((s): Section => {
    let x = s;
    if (Object.hasOwn(s.motifs, id)) {
      const d = Object.create(null) as Section['motifs'];
      for (const [k, v] of Object.entries(s.motifs)) if (k !== id) d[k] = v;
      x = { ...x, motifs: d };
    }
    if (x.perf?.some((e) => e.pistes?.includes(id))) {
      const perf = x.perf.flatMap((e) => {
        if (!e.pistes?.includes(id)) return [e];
        const restent = e.pistes.filter((p) => p !== id);
        return restent.length ? [{ ...e, pistes: restent }] : [];
      });
      x = { ...x, perf };
    }
    return x;
  });
  const utilises = new Set(sections.flatMap((s) => Object.values(s.motifs)));
  const anciens = new Set(m.sections.flatMap((s) => (Object.hasOwn(s.motifs, id) ? [s.motifs[id]!] : [])));
  const motifs = Object.create(null) as Morceau['motifs'];
  for (const [k, v] of Object.entries(m.motifs)) if (!anciens.has(k) || utilises.has(k)) motifs[k] = v;
  return { ...m, motifs, sections, pistes: m.pistes.filter((p) => p.id !== id) };
}

export function renommerPiste(m: Morceau, id: string, nom: string): Morceau {
  const p = pisteDe(m, id);
  const propre = nom.replace(/\s+/g, ' ').trim().slice(0, LONGUEUR_NOM);
  if (!estPisteInstrument(p) || !propre || propre === p.nom) return m;
  return { ...m, pistes: m.pistes.map((x) => (x === p ? { ...p, nom: propre } : x)) };
}

/** Change l'instrument (REGLE_INSTRUMENT) ; les réglages de synthé de l'ancien instrument partent. */
export function changerInstrument(m: Morceau, id: string, instrument: string): Morceau {
  const p = pisteDe(m, id);
  if (!estPisteInstrument(p) || !REGLE_INSTRUMENT.test(instrument) || p.instrument === instrument) return m;
  const { synthe: _synthe, ...reste } = p;
  return { ...m, pistes: m.pistes.map((x) => (x === p ? { ...reste, instrument } : x)) };
}

/** Monte (−1) ou descend (+1) une piste instrument parmi les pistes instrument. */
export function deplacerPiste(m: Morceau, id: string, sens: -1 | 1): Morceau {
  const instr = pistesInstrument(m);
  const i = instr.findIndex((p) => p.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= instr.length) return m;
  const a = instr[i]!;
  const b = instr[j]!;
  return { ...m, pistes: m.pistes.map((x) => (x === a ? b : x === b ? a : x)) };
}
