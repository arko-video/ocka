// Migration /1 et /2 → /3, SANS changer le son (décisions v2 §1). Elle travaille sur le fichier BRUT, avant le
// normaliseur /3 (un seul chemin de normalisation) :
// - chaque motif « melodie » devient un motif « notes » (mêmes notes ; le son passe à la piste) ;
// - la piste « melodie » devient une piste instrument « melodie » (même tranche, même pan par défaut, nom « Mélodie »,
//   donc même nom de piste séparée), instrument « ocka-<son>@1 » ;
// - si plusieurs sons sont utilisés, chaque autre son a sa piste : « melodie-2 » (« Mélodie 2 »), « melodie-3 »…,
//   avec la même tranche (et, en chaîne 2, le pan par défaut de la mélodie écrit dans son pan) ;
// - Section.motifs.melodie vise la piste du son de son motif.
// Ordre des sons : première apparition dans la liste des sections ; sans mélodie jouée, le son du 1er motif, ou piano.

import { instrumentOcka } from './acces';
import { borner, estObjet, lireNombreBrut, type Objet } from './normaliser-outils';
import { SONS_MELODIE, type SonMelodie } from './types';

/** Pan par défaut de la mélodie en chaîne 2 (instruments/pistes.ts l'applique à la piste « melodie » seulement). */
export const PAN_DEFAUT_MELODIE = 0.1;

const lireSon = (v: unknown): SonMelodie => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (SONS_MELODIE as readonly string[]).includes(s) ? (s as SonMelodie) : 'piano';
};

/** La clé du motif visé par une référence brute (telle quelle, sans espaces, ou nombre), ou undefined. */
function cleMotif(motifs: Objet, ref: unknown): string | undefined {
  const essais = typeof ref === 'number' && Number.isFinite(ref) ? [String(ref)] : typeof ref === 'string' ? [ref, ref.trim()] : [];
  return essais.find((k) => Object.hasOwn(motifs, k));
}

/** true si le fichier brut contient encore la mélodie du format /2 (motif « melodie »). */
export function aMelodieV2(obj: Objet): boolean {
  return estObjet(obj.motifs) && Object.values(obj.motifs).some((m) => estObjet(m) && m.type === 'melodie');
}

/**
 * Fichier brut /1 ou /2 → fichier brut /3 (le normaliseur /3 le lit ensuite). `chaine` : chaîne du master du
 * morceau (1 = phases 0 et 1 : pas de pan par défaut). Ne modifie pas `obj`.
 */
export function migrerVersV3(obj: Objet, chaine: 1 | 2): Objet {
  const sortie: Objet = { ...obj, format: 'ocka.morceau/3' };
  const motifsBruts = estObjet(obj.motifs) ? obj.motifs : {};
  const motifs = Object.create(null) as Objet;
  const sonDe = new Map<string, SonMelodie>();
  for (const [id, m] of Object.entries(motifsBruts)) {
    if (estObjet(m) && m.type === 'melodie') {
      sonDe.set(id, lireSon(m.son));
      const notes: Objet = { type: 'notes', pas: m.pas, notes: m.notes };
      motifs[id] = notes;
    } else motifs[id] = m;
  }
  if (estObjet(obj.motifs)) sortie.motifs = motifs;

  // Les sons joués, dans l'ordre des sections.
  const sons: SonMelodie[] = [];
  const sections = Array.isArray(obj.sections) ? obj.sections : [];
  const refMelodie = (s: unknown): string | undefined => {
    if (!estObjet(s) || !estObjet(s.motifs) || !Object.hasOwn(s.motifs, 'melodie')) return undefined;
    const cle = cleMotif(motifs, s.motifs.melodie);
    return cle !== undefined && sonDe.has(cle) ? cle : undefined;
  };
  for (const s of sections) {
    const cle = refMelodie(s);
    if (cle !== undefined && !sons.includes(sonDe.get(cle)!)) sons.push(sonDe.get(cle)!);
  }
  if (sons.length === 0) sons.push(sonDe.values().next().value ?? 'piano');
  const idDuSon = (son: SonMelodie) => (sons.indexOf(son) === 0 ? 'melodie' : `melodie-${sons.indexOf(son) + 1}`);

  if (Array.isArray(obj.sections)) {
    sortie.sections = sections.map((s) => {
      const cle = refMelodie(s);
      if (!estObjet(s) || !estObjet(s.motifs) || cle === undefined) return s;
      const refs = Object.create(null) as Objet;
      for (const [k, v] of Object.entries(s.motifs)) if (k !== 'melodie') refs[k] = v;
      refs[idDuSon(sonDe.get(cle)!)] = s.motifs.melodie;
      return { ...s, motifs: refs };
    });
  }

  // La piste mélodie (ou ses réglages par défaut) → une piste instrument par son.
  const pistes = Array.isArray(obj.pistes) ? obj.pistes : [];
  const brute = pistes.find((p) => estObjet(p) && p.id === 'melodie');
  const tranche: Objet = {};
  if (estObjet(brute)) for (const k of ['volume', 'pan', 'muet', 'solo']) if (brute[k] !== undefined) tranche[k] = brute[k];
  const pan = borner(lireNombreBrut(tranche.pan) ?? 0, -1, 1);
  const instruments = sons.map((son, i) => {
    const p: Objet = { ...tranche, id: i === 0 ? 'melodie' : `melodie-${i + 1}`, genre: 'instrument', nom: i === 0 ? 'Mélodie' : `Mélodie ${i + 1}`, instrument: instrumentOcka(son) };
    if (i > 0 && chaine === 2) p.pan = Math.round(borner(pan + PAN_DEFAUT_MELODIE, -1, 1) * 1000) / 1000;
    return p;
  });
  const autres = pistes.filter((p) => !(estObjet(p) && p.id === 'melodie'));
  const position = brute ? pistes.indexOf(brute) : autres.length;
  sortie.pistes = [...autres.slice(0, position), ...instruments, ...autres.slice(position)];
  return sortie;
}
