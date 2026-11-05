// Lecture des réponses de l'IA : JSON retrouvé → liste blanche → normaliseur → vérifications.
// Une réponse mal formée lève une ErreurOcka « reponse_ia_invalide » au message clair, et RIEN n'est changé.
// Les prises, les sons, les pads, le master, les pistes et les infos du morceau ouvert ne passent jamais par l'IA.

import { dictionnaire } from '../morceau/normaliser-outils';
import { normaliserMorceau } from '../morceau/normaliser';
import { pistesParDefaut } from '../morceau/styles';
import { FORMAT_MORCEAU, PLAFONDS, type Morceau, type Motif, type Section } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { extraireObjet } from './fournisseurs/extraire-json';
import { marquerIa } from './infos-ia';
import { estObjet, filtrerBeat, filtrerMotifs, filtrerSection, texte, type Filtre } from './liste-blanche';
import type { GenreSuite } from './requetes';
import { compterSyllabes } from './syllabes';

const PISTES = ['batterie', 'basse', 'accords', 'melodie'] as const;

function invalide(message: string): ErreurOcka {
  return new ErreurOcka(`${message} Rien n’a été changé.`, 'reponse_ia_invalide');
}

function objetDe(reponse: string): Record<string, unknown> {
  const o = extraireObjet(reponse);
  if (!o) throw invalide('La réponse de l’IA est illisible (pas de JSON). Réessaie.');
  return o;
}

/** true si le motif contient au moins une note ou une frappe. */
function sonne(mo: Motif | undefined): boolean {
  if (!mo) return false;
  if (mo.type === 'batterie') return Object.values(mo.pistes).some((l) => l?.some((v) => v > 0));
  if (mo.type === 'accords') return mo.accords.length > 0;
  return mo.notes.length > 0;
}

const sectionSonne = (m: Morceau, s: Section) => PISTES.some((p) => sonne(s.motifs[p] ? m.motifs[s.motifs[p]!] : undefined));

/* ------------------------------------------------------------ « Lance-moi un beat » */

export interface BeatLu {
  morceau: Morceau;
  /** Champs refusés par la liste blanche (pour la console). */
  ignores: string[];
}

/** Réponse de « Lance-moi un beat » → nouveau morceau complet, normalisé, écrit par l'IA : `infos.ia.musique` = « ia ». */
export function lireBeat(reponse: string): BeatLu {
  const f: Filtre = { ignores: [] };
  const compact = filtrerBeat(objetDe(reponse), f);
  const candidat = {
    ...compact,
    format: FORMAT_MORCEAU,
    fondu: 3,
    pistes: pistesParDefaut(),
    prises: [],
    master: { preset: compact.style === 'lofi' ? 'lofi' : 'neutre', niveau: 'standard', chaine: 2 },
  };
  const r = normaliserMorceau(candidat);
  if (r.bloquant) throw invalide('L’IA n’a pas écrit de morceau utilisable (aucune section).');
  const m = r.morceau;
  if (!m.ordre.some((id) => sectionSonne(m, m.sections.find((s) => s.id === id)!))) {
    throw invalide('L’IA n’a écrit aucune note.');
  }
  const paroles = m.sections.some((s) => !!s.paroles?.trim());
  return { morceau: marquerIa(m, { musique: 'ia', paroles: paroles ? 'ia' : false }), ignores: f.ignores };
}

/* ------------------------------------------------------------ « Continue mon idée » */

/** Un id libre à partir d'une base (« ia-pont », « ia-pont-2 »…). */
function idLibre(base: string, pris: (id: string) => boolean): string {
  const propre =
    `ia-${base}`
      .normalize('NFD')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+$/, '')
      .slice(0, 34) || 'ia';
  if (!pris(propre)) return propre;
  for (let n = 2; ; n++) if (!pris(`${propre}-${n}`)) return `${propre}-${n}`;
}

/**
 * Réponse de « Continue mon idée » → le morceau avec UNE section de plus, jouée juste après la section choisie
 * (à sa place `index` dans l'ordre si elle y est encore). À appliquer en une seule étape d'Annuler.
 */
export function lireSuite(m: Morceau, sectionId: string, index: number, genre: GenreSuite, reponse: string): Morceau {
  const brut = objetDe(reponse);
  const f: Filtre = { ignores: [] };
  const nouveaux = filtrerMotifs(brut.motifs, f);
  const section = filtrerSection(brut.section, 'section', f, false);
  if (!section) throw invalide('L’IA n’a pas écrit de section.');
  const ids = Object.keys(nouveaux);
  const nbMotifs = Object.keys(m.motifs).length;
  if (m.sections.length >= PLAFONDS.sections || m.ordre.length >= PLAFONDS.ordre || nbMotifs + ids.length > PLAFONDS.motifs) {
    throw invalide('Ton morceau est plein (64 sections et 64 motifs au plus) : retire d’abord une section.');
  }

  // Nouveaux motifs : ids neufs (jamais ceux du morceau). La section peut aussi viser un motif existant.
  const motifs = dictionnaire<unknown>();
  for (const [id, mo] of Object.entries(m.motifs)) motifs[id] = mo;
  const carte = new Map<string, string>();
  for (const id of ids) {
    const neuf = idLibre(id, (x) => Object.hasOwn(motifs, x));
    motifs[neuf] = nouveaux[id];
    carte.set(id, neuf);
  }
  const refs = estObjet(section.motifs) ? section.motifs : {};
  const motifsSection: Record<string, string> = {};
  for (const p of PISTES) {
    const ref = refs[p];
    if (typeof ref !== 'string') continue;
    // Un nouveau motif du bon type d'abord, sinon un motif existant du bon type (l'IA peut réutiliser un id).
    const neuf = carte.get(ref);
    const typeNeuf = neuf && estObjet(nouveaux[ref]) ? nouveaux[ref].type : undefined;
    const cible = neuf && typeNeuf === p ? neuf : Object.hasOwn(m.motifs, ref) && m.motifs[ref]!.type === p ? ref : undefined;
    if (cible) motifsSection[p] = cible;
  }
  const idSection = idLibre(typeof section.nom === 'string' ? section.nom : genre, (x) => m.sections.some((s) => s.id === x));
  const position = m.ordre[index] === sectionId ? index : m.ordre.lastIndexOf(sectionId);
  const ordre = [...m.ordre];
  ordre.splice(position < 0 ? ordre.length : position + 1, 0, idSection);

  const r = normaliserMorceau({ ...m, motifs, sections: [...m.sections, { ...section, id: idSection, motifs: motifsSection }], ordre });
  const neuve = r.morceau.sections.find((s) => s.id === idSection);
  if (r.bloquant || !neuve) throw invalide('La section écrite par l’IA est inutilisable.');
  if (!sectionSonne(r.morceau, neuve)) throw invalide('L’IA n’a écrit aucune note pour cette section.');

  // Seuls les nouveaux motifs et la nouvelle section viennent du normaliseur : le reste est celui du morceau ouvert.
  const tous = dictionnaire<Motif>();
  for (const [id, mo] of Object.entries(m.motifs)) tous[id] = mo;
  let ecrits = 0;
  for (const id of carte.values()) {
    const mo = r.morceau.motifs[id];
    if (!mo) continue;
    tous[id] = mo;
    if (Object.values(neuve.motifs).includes(id)) ecrits++;
  }
  const suite: Morceau = { ...m, motifs: tous, sections: [...m.sections, neuve], ordre };
  return ecrits > 0 ? marquerIa(suite, { musique: true }) : suite;
}

/* ------------------------------------------------------------ « Aide aux paroles » */

export interface LigneProposee {
  texte: string;
  syllabes: number;
}
export interface Proposition {
  rime: string;
  lignes: LigneProposee[];
}

/** Réponse de « Aide aux paroles » → 3 propositions au plus, 16 lignes au plus, en texte brut. */
export function lireParoles(reponse: string): Proposition[] {
  const brut = objetDe(reponse);
  const liste = Array.isArray(brut.propositions) ? brut.propositions : [];
  const res: Proposition[] = [];
  for (const p of liste.slice(0, 3)) {
    if (!estObjet(p) || !Array.isArray(p.lignes)) continue;
    const lignes: LigneProposee[] = [];
    for (const l of p.lignes.slice(0, 16)) {
      const t = (texte(estObjet(l) ? l.texte : l, 120) ?? '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const donne = estObjet(l) ? l.syllabes : undefined;
      const ok = typeof donne === 'number' && Number.isInteger(donne) && donne >= 1 && donne <= 40;
      lignes.push({ texte: t, syllabes: ok ? donne : compterSyllabes(t) });
    }
    if (lignes.length) res.push({ rime: (texte(p.rime, 20) ?? '').trim(), lignes });
  }
  if (!res.length) throw invalide('L’IA n’a proposé aucune ligne lisible. Réessaie.');
  return res;
}
