// Édition pure de l'arrangement : ajouter, répéter, dupliquer, déplacer, supprimer, renommer, régler.
// Les prises de voix sont ancrées sur {section, occurrence} : on garde leurs occurrences justes.

import { avecMotifSection, idMotifDe, motifParId, sectionDe } from '../../morceau/acces';
import { PLAFONDS, type Morceau, type Motif, type NomSection, type Prise, type Section } from '../../morceau/types';
import { idLibre } from './ids';
import { rendreUniqueMotif } from './notes-motif';

export const NOMS_SECTIONS: NomSection[] = ['Intro', 'Couplet', 'Refrain', 'Pont', 'Outro'];
export type PisteInstrument = 'batterie' | 'basse' | 'accords';

/** Combien de fois la section de la position `index` apparaît avant elle (0 = 1re fois). */
export function occurrence(ordre: string[], index: number): number {
  const id = ordre[index];
  let n = 0;
  for (let i = 0; i < index; i++) if (ordre[i] === id) n++;
  return n;
}

/** Position dans l'ordre de la n-ième apparition d'une section (−1 si absente). */
export function positionDe(ordre: string[], section: string, occ: number): number {
  let n = 0;
  for (let i = 0; i < ordre.length; i++) {
    if (ordre[i] !== section) continue;
    if (n === occ) return i;
    n++;
  }
  return -1;
}

export function sectionParId(m: Morceau, id: string): Section | undefined {
  return m.sections.find((s) => s.id === id);
}

/** Id libre, lisible : « couplet-2 » (REGLE_ID, 36 caractères au plus, jamais un nom réservé). */
export function nouvelId(m: Morceau, nom: string): string {
  return idLibre(nom, [...m.sections.map((s) => s.id), ...Object.keys(m.motifs)], 'section');
}

/** Recalcule l'ancre des prises après un changement d'ordre (positions avant → après, −1 = supprimée). */
function reancrer(m: Morceau, ordreAvant: string[], ordreApres: string[], suivi: number[]): Prise[] {
  const res: Prise[] = [];
  for (const p of m.prises) {
    const avant = positionDe(ordreAvant, p.ancre.section, p.ancre.occurrence);
    if (avant < 0) continue;
    const apres = suivi[avant]!;
    if (apres < 0) continue;
    const occ = occurrence(ordreApres, apres);
    res.push(occ === p.ancre.occurrence ? p : { ...p, ancre: { ...p.ancre, occurrence: occ } });
  }
  return res;
}

/** Insère un id de section à la position `index` de l'ordre. */
function inserer(m: Morceau, sections: Section[], id: string, index: number): Morceau {
  const i = Math.max(0, Math.min(m.ordre.length, index));
  const ordre = [...m.ordre.slice(0, i), id, ...m.ordre.slice(i)];
  const suivi = m.ordre.map((_, k) => (k < i ? k : k + 1));
  return { ...m, sections, ordre, prises: reancrer(m, m.ordre, ordre, suivi) };
}

/** Nouvelle section d'un type (Couplet, Pont…) insérée après la position `apres` (à la fin par défaut). */
export function ajouterSection(m: Morceau, nom: NomSection, apres = m.ordre.length - 1): Morceau {
  const modele =
    [...m.sections].reverse().find((s) => s.nom === nom) ??
    sectionParId(m, m.ordre[Math.max(0, apres)] ?? '') ??
    m.sections[0];
  const section: Section = {
    id: nouvelId(m, nom),
    nom,
    mesures: modele?.mesures ?? 8,
    motifs: { ...modele?.motifs },
    fill: modele?.fill ?? false,
    coupure: 'aucune',
    paroles: '',
  };
  return inserer(m, [...m.sections, section], section.id, apres + 1);
}

/** Fait revenir une section existante (même motifs, mêmes paroles) après la position `apres`. */
export function repeterSection(m: Morceau, id: string, apres = m.ordre.length - 1): Morceau {
  if (!sectionParId(m, id)) return m;
  return inserer(m, m.sections, id, apres + 1);
}

/** Copie indépendante de la section à la position `index` (« Couplet 2 »), placée juste après. */
export function dupliquerSection(m: Morceau, index: number): Morceau {
  const s = sectionParId(m, m.ordre[index] ?? '');
  if (!s) return m;
  const racine = s.nom.replace(/\s+\d+$/, '');
  let n = 2;
  while (m.sections.some((x) => x.nom === `${racine} ${n}`)) n++;
  const copie: Section = { ...s, motifs: { ...s.motifs }, id: nouvelId(m, `${racine} ${n}`), nom: `${racine} ${n}` };
  return inserer(m, [...m.sections, copie], copie.id, index + 1);
}

/** Monte (−1) ou descend (+1) la section de la position `index`. */
export function deplacerSection(m: Morceau, index: number, sens: -1 | 1): Morceau {
  const j = index + sens;
  if (index < 0 || index >= m.ordre.length || j < 0 || j >= m.ordre.length) return m;
  const ordre = [...m.ordre];
  [ordre[index], ordre[j]] = [ordre[j]!, ordre[index]!];
  const suivi = m.ordre.map((_, k) => (k === index ? j : k === j ? index : k));
  return { ...m, ordre, prises: reancrer(m, m.ordre, ordre, suivi) };
}

/** Retire la position `index` (au moins une section reste). Ses prises partent avec elle. */
export function supprimerSection(m: Morceau, index: number): Morceau {
  if (m.ordre.length <= 1 || index < 0 || index >= m.ordre.length) return m;
  const id = m.ordre[index]!;
  const ordre = m.ordre.filter((_, k) => k !== index);
  const suivi = m.ordre.map((_, k) => (k < index ? k : k === index ? -1 : k - 1));
  const sections = ordre.includes(id) ? m.sections : m.sections.filter((s) => s.id !== id);
  return { ...m, sections, ordre, prises: reancrer(m, m.ordre, ordre, suivi) };
}

/** Change une section (toutes ses apparitions). Nom vide ignoré, mesures de 1 à 16. */
export function reglerSection(
  m: Morceau,
  id: string,
  changes: Partial<Pick<Section, 'nom' | 'mesures' | 'fill' | 'coupure' | 'paroles'>>,
): Morceau {
  const s = sectionParId(m, id);
  if (!s) return m;
  const c = { ...changes };
  if (c.nom !== undefined) {
    const nom = c.nom.trim().slice(0, 30);
    if (nom) c.nom = nom;
    else delete c.nom;
  }
  if (c.mesures !== undefined) c.mesures = Math.max(1, Math.min(16, Math.round(c.mesures)));
  if (c.paroles !== undefined) c.paroles = c.paroles.slice(0, 4000);
  const nouvelle = { ...s, ...c };
  if (JSON.stringify(nouvelle) === JSON.stringify(s)) return m;
  return { ...m, sections: m.sections.map((x) => (x.id === id ? nouvelle : x)) };
}

/** Choisit le motif joué par une piste dans une section (null = silence). */
export function choisirMotifSection(m: Morceau, id: string, piste: PisteInstrument, idMotif: string | null): Morceau {
  const s = sectionParId(m, id);
  if (!s || (idMotif !== null && m.motifs[idMotif]?.type !== piste)) return m;
  if ((s.motifs[piste] ?? null) === idMotif) return m;
  const motifs = { ...s.motifs };
  if (idMotif) motifs[piste] = idMotif;
  else delete motifs[piste];
  return { ...m, sections: m.sections.map((x) => (x.id === id ? { ...s, motifs } : x)) };
}

/** Durée d'une section en secondes (4 temps par mesure). */
export function dureeSection(m: Morceau, s: Section): number {
  return (s.mesures * 4 * 60) / m.tempo;
}

/* ------------------------------------------------------------ frise : clips (U2, v2) */

/** Nombre d'endroits (section, piste) qui jouent ce motif. */
export function usagesMotif(m: Morceau, idMotif: string): number {
  let n = 0;
  for (const s of m.sections) for (const v of Object.values(s.motifs)) if (v === idMotif) n++;
  return n;
}

/** Copie profonde d'un motif (JSON : un motif n'a que des nombres, des textes, des listes et des booléens). */
function copieMotif(x: Motif): Motif {
  return JSON.parse(JSON.stringify(x)) as Motif;
}

/** Ajoute une copie du motif `idMotif` sous un id libre (« <id>-2 »…) ; null au-delà du plafond. */
function avecCopie(m: Morceau, idMotif: string): { m: Morceau; id: string } | null {
  const x = motifParId(m, idMotif);
  if (!x || Object.keys(m.motifs).length >= PLAFONDS.motifs) return null;
  const id = idLibre(idMotif, [...Object.keys(m.motifs), ...m.sections.map((s) => s.id)], 'motif');
  const motifs = Object.create(null) as Record<string, Motif>;
  Object.assign(motifs, m.motifs);
  motifs[id] = copieMotif(x);
  return { m: { ...m, motifs }, id };
}

/**
 * « Rendre unique » : la piste joue dans cette section une COPIE de son motif (nouvel id), les autres sections (et
 * les autres pistes) gardent l'original. Même morceau si le motif ne sert qu'ici, ou au-delà de 256 motifs.
 */
export function rendreUnique(m: Morceau, idSection: string, idPiste: string): Morceau {
  const id = idMotifDe(sectionDe(m, idSection), idPiste);
  if (id === undefined || usagesMotif(m, id) <= 1) return m;
  // Motif de notes : la même fonction que le piano roll (U1), sous le plafond de motifs.
  if (motifParId(m, id)?.type === 'notes') return Object.keys(m.motifs).length >= PLAFONDS.motifs ? m : rendreUniqueMotif(m, idSection, idPiste);
  const c = avecCopie(m, id);
  return c ? avecMotifSection(c.m, idSection, idPiste, c.id) : m;
}

/** « Vider » : la piste se tait dans cette section (le motif reste gardé s'il sert ailleurs ; sinon il est retiré). */
export function viderClip(m: Morceau, idSection: string, idPiste: string): Morceau {
  const id = idMotifDe(sectionDe(m, idSection), idPiste);
  if (id === undefined) return m;
  const n = avecMotifSection(m, idSection, idPiste, null);
  if (usagesMotif(n, id) > 0) return n;
  const motifs = Object.create(null) as Record<string, Motif>;
  for (const [k, v] of Object.entries(n.motifs)) if (k !== id) motifs[k] = v;
  return { ...n, motifs };
}

/**
 * « Copier le motif depuis… » : la piste joue dans `idSection` une copie du motif qu'elle joue dans `depuis`
 * (au-delà de 256 motifs : le même motif, partagé). Même morceau si la source n'a rien ou si c'est déjà ce motif.
 */
export function copierMotifDepuis(m: Morceau, idSection: string, idPiste: string, depuis: string): Morceau {
  const source = idMotifDe(sectionDe(m, depuis), idPiste);
  const cible = sectionDe(m, idSection);
  if (source === undefined || !cible || idMotifDe(cible, idPiste) === source) return m;
  const avant = idMotifDe(cible, idPiste);
  const c = avecCopie(m, source);
  const n = c ? avecMotifSection(c.m, idSection, idPiste, c.id) : avecMotifSection(m, idSection, idPiste, source);
  // L'ancien motif de la cellule, s'il ne sert plus nulle part, est retiré.
  if (avant === undefined || usagesMotif(n, avant) > 0) return n;
  const motifs = Object.create(null) as Record<string, Motif>;
  for (const [k, v] of Object.entries(n.motifs)) if (k !== avant) motifs[k] = v;
  return { ...n, motifs };
}

/** Sections (dans l'ordre de l'arrangement) où la piste joue un AUTRE motif que dans `idSection` (une par motif). */
export function sourcesCopie(m: Morceau, idSection: string, idPiste: string): string[] {
  const ici = idMotifDe(sectionDe(m, idSection), idPiste);
  const vues = new Set<string>();
  const motifs = new Set<string>();
  const res: string[] = [];
  for (const id of [...m.ordre, ...m.sections.map((s) => s.id)]) {
    if (vues.has(id) || id === idSection) continue;
    vues.add(id);
    const x = idMotifDe(sectionDe(m, id), idPiste);
    if (x === undefined || x === ici || motifs.has(x)) continue;
    motifs.add(x);
    res.push(id);
  }
  return res;
}
