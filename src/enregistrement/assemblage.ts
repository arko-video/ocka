// Assemblage de prises (pur) : punch-in et comping. Une nouvelle prise garde l'ANCRE et l'ALIGNEMENT d'une prise de
// base (debutCoupe, decalage) : son échantillon j tombe au même temps du morceau que l'échantillon j de la base.
// Chaque passage vient d'une prise source, recalée sur la base par ses propres repères (ancre, debutCoupe et
// decalage = latence mesurée) : le décalage entre deux prises est arrondi à l'échantillon (le passage est COPIÉ tel
// quel, sans interpolation, quand les fréquences sont égales). Aux bords, fondus enchaînés linéaires de 10 ms
// centrés sur la frontière (la somme des poids vaut 1 : aucun clic, aucun creux).
//
// Convention d'OCKA (alignement.ts) : le son du fichier au temps x tombe au temps du morceau
//   debutAncre + (x − debutCoupe) − decalage.

import type { Morceau, Prise } from '../morceau/types';

/** Durée des fondus enchaînés aux bords d'un passage (s). */
export const FONDU_ASSEMBLAGE = 0.01;

/** Repères d'une prise pour l'assemblage : début de son ancre dans le morceau (s), alignement et fréquence. */
export interface Reperes {
  debutAncre: number;
  debutCoupe: number;
  decalage: number;
  frequence: number;
}

/** Une source : un PCM mono avec ses repères. */
export interface Source extends Reperes {
  pcm: Float32Array;
}

/** Un passage, en secondes DU MORCEAU (de < a ; ±Infinity permis : « tout avant », « tout après »). */
export interface Morceau_Passage {
  source: number;
  de: number;
  a: number;
}

/** Temps du morceau (s) de l'échantillon `x` (fractionnaire permis) d'une prise. */
export function tempsDe(r: Reperes, x: number): number {
  return r.debutAncre + x / r.frequence - r.debutCoupe - r.decalage;
}

/** Échantillon (fractionnaire) d'une prise joué au temps `t` du morceau. */
export function echantillonA(r: Reperes, t: number): number {
  return (t - r.debutAncre + r.debutCoupe + r.decalage) * r.frequence;
}

/** Poids d'un passage au temps t : rampe de `fondu` centrée sur chaque bord. */
export function poids(p: Pick<Morceau_Passage, 'de' | 'a'>, t: number, fondu = FONDU_ASSEMBLAGE): number {
  const entree = Math.min(1, Math.max(0, (t - (p.de - fondu / 2)) / fondu));
  const sortie = Math.min(1, Math.max(0, (p.a + fondu / 2 - t) / fondu));
  return entree * sortie;
}

/** Lit une source à l'échantillon (fractionnaire) x : 0 hors du fichier, interpolation linéaire sinon. */
function lire(pcm: Float32Array, x: number): number {
  const i = Math.floor(x);
  if (i < 0 || i >= pcm.length) return 0;
  const f = x - i;
  if (f === 0 || i + 1 >= pcm.length) return pcm[i]!;
  return pcm[i]! * (1 - f) + pcm[i + 1]! * f;
}

/**
 * Assemble les passages dans un nouveau PCM aligné sur `base` (repères de la prise de base), de `longueur`
 * échantillons. Hors de tout passage : silence (fondu de 10 ms). Des passages qui se chevauchent sont normalisés.
 */
export function assemblerPcm(base: Reperes, sources: readonly Source[], passages: readonly Morceau_Passage[], longueur: number, fondu = FONDU_ASSEMBLAGE): Float32Array {
  const out = new Float32Array(longueur);
  const somme = new Float32Array(longueur);
  for (const p of passages) {
    const s = sources[p.source];
    if (!s || !(p.a > p.de)) continue;
    // Échantillons de la sortie touchés par ce passage (fondus compris).
    const j0 = Math.max(0, Math.floor(echantillonA(base, p.de - fondu / 2)));
    const j1 = Math.min(longueur, Math.ceil(echantillonA(base, p.a + fondu / 2)) + 1);
    const memeFreq = s.frequence === base.frequence;
    // Décalage (en échantillons de la source) entre la sortie et la source, arrondi si les fréquences sont égales.
    const decal = memeFreq ? Math.round(echantillonA(s, tempsDe(base, 0))) : 0;
    for (let j = Math.max(0, j0); j < j1; j++) {
      const t = tempsDe(base, j);
      const w = poids(p, t, fondu);
      if (w <= 0) continue;
      const v = memeFreq ? (j + decal >= 0 && j + decal < s.pcm.length ? s.pcm[j + decal]! : 0) : lire(s.pcm, echantillonA(s, t));
      out[j]! += w * v;
      somme[j]! += w;
    }
  }
  for (let j = 0; j < longueur; j++) if (somme[j]! > 1) out[j]! /= somme[j]!;
  return out;
}

/** Longueur (échantillons) nécessaire pour couvrir la base ET la fin du dernier passage fini. */
export function longueurAssemblage(base: Reperes & { longueur: number }, passages: readonly Pick<Morceau_Passage, 'a'>[], fondu = FONDU_ASSEMBLAGE): number {
  let n = base.longueur;
  for (const p of passages) if (Number.isFinite(p.a)) n = Math.max(n, Math.ceil(echantillonA(base, p.a + fondu)) + 1);
  return n;
}

/* ------------------------------------------------------------ le morceau (pur) */

/** Prises d'une apparition de section, dans l'ordre du morceau. */
export function prisesDeSection(m: Morceau, section: string, occurrence: number): Prise[] {
  return m.prises.filter((p) => p.ancre.section === section && p.ancre.occurrence === occurrence);
}

/** Le nom d'une prise dérivée : « <nom> (nettoyée) », 40 caractères au plus (le suffixe est gardé). */
export function nomDerive(source: Prise, index: number, suffixe: string): string {
  const nom = (source.nom ?? '').trim() || `Prise ${index + 1}`;
  const fin = ` ${suffixe}`;
  return nom.slice(0, Math.max(1, 40 - fin.length)).trim() + fin;
}

/**
 * Ajoute une prise dérivée de `source` (nouveau fichier, même ancre, même alignement sauf `champs`), CHOISIE à la
 * place des prises de la même apparition de section, qui restent (non choisies : Annuler les rechoisit). Pur.
 */
export function ajouterDerivee(m: Morceau, source: Prise, fichier: string, suffixe: string, champs: Partial<Prise> = {}): Morceau {
  const index = m.prises.indexOf(source);
  const id = fichier.replace(/^prise-|\.f32$/g, '');
  const nouvelle: Prise = { ...source, ancre: { ...source.ancre }, ...champs, id, fichier, nom: nomDerive(source, Math.max(0, index), suffixe), choisie: true };
  const memeSection = (p: Prise) => p.ancre.section === source.ancre.section && p.ancre.occurrence === source.ancre.occurrence;
  const prises = m.prises.map((p) => (memeSection(p) && p.choisie ? { ...p, choisie: false } : p));
  const ou = index < 0 ? prises.length : index + 1;
  return { ...m, prises: [...prises.slice(0, ou), nouvelle, ...prises.slice(ou)] };
}
