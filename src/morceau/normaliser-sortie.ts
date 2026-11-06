// Normaliseur des sorties (« ocka.sortie/1 ») et des réglages de l'utilisateur.
// Même règle que pour les morceaux : on corrige au lieu de rejeter ; seul un format plus récent est bloquant.
// `titres` : ids valides, sans doublon, 32 au plus, et (si on donne la liste) seulement des morceaux qui existent.

import { nouvelId } from '../enregistrement/contexte';
import { DISTRIBUTEURS, FORMAT_SORTIE, VERSION_SORTIE, type Reglages, type Sortie } from '../sortie/types';
import { lireLangue } from './normaliser-ajouts';
import { apercu, estObjet, idValide, Journal, lireChoix, lireNombre, lireTexte, verifierCles } from './normaliser-outils';
import { lireEntree, lireVersion } from './normaliser';
import { PLAFONDS, REGLE_CLE_POCHETTE, type Probleme } from './types';

export interface ResultatSortie {
  sortie: Sortie;
  problemes: Probleme[];
  bloquant: boolean;
}

const CLES = [
  'format', 'id', 'titre', 'artiste', 'lienProfil', 'dateSortie', 'genre', 'label', 'langue', 'upc',
  'titres', 'pochette', 'distributeur', 'niveau', 'modifieLe',
] as const;
const JOUR = 24 * 3600 * 1000;
/** Délai par défaut avant la sortie (6 semaines) : chez RouteNote, environ 3 à 5 semaines (21 à 23 jours ouvrés de vérification, puis la livraison), plus une marge. */
export const DELAI_SORTIE_JOURS = 42;
const SANS_LABEL = /^(n\/?a|none|aucun|sans|-+)$/i;

/** Date « AAAA-MM-JJ » qui existe vraiment, ou null. */
export function lireDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const iso = d.toISOString().slice(0, 10);
  return iso === m[0] ? iso : null;
}

/** Date par défaut : aujourd'hui + 6 semaines (UTC). */
export function dateParDefaut(maintenant: number): string {
  return new Date(maintenant + DELAI_SORTIE_JOURS * JOUR).toISOString().slice(0, 10);
}

/** Lien https (200 caractères au plus, sans espace), ou null. */
export function lireLien(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length <= 200 && /^https:\/\/[^\s<>"']+$/.test(t) ? t : null;
}

/**
 * Normalise une sortie. `idsMorceauxExistants` : si donné, les titres qui n'y sont pas sont retirés.
 * `maintenant` (ms) : pour la date par défaut (les tests le fixent).
 */
export function normaliserSortie(brut: unknown, idsMorceauxExistants?: Iterable<string>, maintenant = Date.now()): ResultatSortie {
  const journal = new Journal();
  const o = lireEntree(brut, journal, 'La sortie');
  lireVersion(o.format, 'ocka.sortie', VERSION_SORTIE, journal);
  verifierCles(o, CLES, '', journal);

  const id = idValide(o.id) ? o.id : nouvelId();
  if (id !== o.id && o.id !== undefined) journal.corrige('id', `L'identifiant « ${apercu(o.id)} » n'est pas valable : nouvel identifiant.`);
  const existants = idsMorceauxExistants ? new Set(idsMorceauxExistants) : null;
  const titres: string[] = [];
  const brutes = Array.isArray(o.titres) ? o.titres : [];
  if (o.titres !== undefined && !Array.isArray(o.titres)) journal.corrige('titres', 'Les titres devaient être une liste.');
  brutes.forEach((t, i) => {
    const c = `titres[${i}]`;
    if (!idValide(t)) return journal.ignore(c, `« ${apercu(t)} » n'est pas un identifiant de morceau : retiré.`);
    if (titres.includes(t)) return journal.corrige(c, 'Ce morceau était deux fois dans la sortie : le doublon est retiré.');
    if (existants && !existants.has(t)) return journal.corrige(c, 'Ce morceau n’existe plus : retiré de la sortie.');
    if (titres.length >= PLAFONDS.titresParSortie) {
      return journal.corrige(c, `Une sortie a ${PLAFONDS.titresParSortie} titres au plus : celui-ci est retiré.`);
    }
    titres.push(t);
  });

  let dateSortie = lireDate(o.dateSortie);
  if (!dateSortie) {
    dateSortie = dateParDefaut(maintenant);
    if (o.dateSortie !== undefined) journal.corrige('dateSortie', `La date « ${apercu(o.dateSortie)} » est illisible : ${dateSortie}.`);
  }
  const sortie: Sortie = {
    format: FORMAT_SORTIE,
    id,
    titre: lireTexte(o.titre, '', 'titre', journal, 100).trim(),
    artiste: lireTexte(o.artiste, '', 'artiste', journal, 100).trim(),
    dateSortie,
    genre: lireTexte(o.genre, '', 'genre', journal, 60).trim(),
    langue: o.langue === undefined ? 'fr' : (lireLangue(o.langue, 'langue', journal, false) ?? 'fr'),
    titres,
    distributeur: lireChoix(o.distributeur, DISTRIBUTEURS, 'routenote', 'distributeur', journal, 'le distributeur'),
    niveau: lireChoix(o.niveau, ['standard', 'fort'] as const, 'standard', 'niveau', journal, 'le niveau'),
    modifieLe: lireNombre(o.modifieLe, 'modifieLe', journal, { defaut: maintenant, min: 0, max: 8.64e15, nom: 'la date de modification', entier: true }),
  };
  if (o.lienProfil !== undefined && o.lienProfil !== null && o.lienProfil !== '') {
    const lien = lireLien(o.lienProfil);
    if (lien) sortie.lienProfil = lien;
    else journal.corrige('lienProfil', 'Le lien du profil doit commencer par https:// : retiré.');
  }
  if (o.label !== undefined && o.label !== null) {
    const label = lireTexte(o.label, '', 'label', journal, 100).trim();
    if (SANS_LABEL.test(label)) journal.corrige('label', `« ${label} » n'est pas un label : le nom de l'artiste sera utilisé.`);
    else if (label) sortie.label = label;
  }
  if (o.upc !== undefined && o.upc !== null && o.upc !== '') {
    const upc = typeof o.upc === 'string' || typeof o.upc === 'number' ? String(o.upc).replace(/\s/g, '') : '';
    if (/^\d{12,13}$/.test(upc)) sortie.upc = upc;
    else journal.corrige('upc', `L'UPC « ${apercu(o.upc)} » est illisible (12 ou 13 chiffres) : retiré.`);
  }
  if (o.pochette !== undefined && o.pochette !== null) {
    if (typeof o.pochette === 'string' && REGLE_CLE_POCHETTE.test(o.pochette)) sortie.pochette = o.pochette;
    else journal.corrige('pochette', 'La pochette n’est pas une pochette d’OCKA : retirée.');
  }
  return { sortie, problemes: journal.problemes, bloquant: journal.problemes.some((p) => p.niveau === 'bloquant') };
}

/** Réglages de l'utilisateur : chaque champ illisible est simplement retiré. */
export function normaliserReglages(brut: unknown): Reglages {
  const journal = new Journal();
  const o = estObjet(brut) ? brut : {};
  const r: Reglages = {};
  const texte = (k: 'vraiNom' | 'artiste') => {
    const t = lireTexte(o[k], '', k, journal, 100).trim();
    if (t) r[k] = t;
  };
  texte('vraiNom');
  texte('artiste');
  const lien = lireLien(o.lienProfil);
  if (lien) r.lienProfil = lien;
  if (typeof o.distributeur === 'string' && (DISTRIBUTEURS as readonly string[]).includes(o.distributeur)) {
    r.distributeur = o.distributeur as Reglages['distributeur'];
  }
  if (o.avance === true) r.avance = true; // false = absent
  return r;
}
