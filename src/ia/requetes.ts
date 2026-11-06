// Ce qui part chez le fournisseur pour chaque action : consignes + données délimitées, et le coût estimé.
// `texteEnvoye` donne le texte EXACT (bouton « Voir ce qui est envoyé »). Fonctions pures.

import type { Morceau, Motif, Section } from '../morceau/types';
import { CONSIGNES_BEAT, CONSIGNES_PAROLES, CONSIGNES_SUITE, donnees } from './consignes';
import { INSTRUMENTS_IA } from './liste-blanche';

export interface Requete {
  /** « autotune » : contrat C2 (A1, ia/autotune.ts). */
  action: 'beat' | 'suite' | 'paroles' | 'autotune';
  systeme: string;
  message: string;
  /** Tokens maximum de la réponse. */
  maxTokens: number;
}

export type GenreSuite = 'refrain' | 'pont' | 'variation';
export const GENRES_SUITE: readonly GenreSuite[] = ['refrain', 'pont', 'variation'];
export const LANGUES_PAROLES = ['fr', 'en', 'es'] as const;
export type LangueParoles = (typeof LANGUES_PAROLES)[number];

/** Longueur maximum de ce que l'utilisateur tape (phrase, idée, thème). */
export const MAX_PHRASE = 300;
const coupe = (t: string) => t.trim().slice(0, MAX_PHRASE);

export function requeteBeat(phrase: string): Requete {
  return { action: 'beat', systeme: CONSIGNES_BEAT, message: `Demande :\n${donnees({ demande: coupe(phrase) })}`, maxTokens: 4000 };
}

export function requeteSuite(m: Morceau, sectionId: string, genre: GenreSuite, idee: string): Requete {
  const d = { section_choisie: sectionId, a_ajouter: genre, idee: coupe(idee), morceau: compacter(m) };
  return { action: 'suite', systeme: CONSIGNES_SUITE, message: `Morceau et demande :\n${donnees(d)}`, maxTokens: 2500 };
}

export function requeteParoles(m: Morceau, s: Section, theme: string, langue: LangueParoles): Requete {
  const d = {
    theme: coupe(theme),
    langue,
    mesures: s.mesures,
    section: s.nom,
    style: m.style,
    tempo: m.tempo,
    titre: m.titre,
    paroles_deja_ecrites: (s.paroles ?? '').slice(0, 1500),
  };
  return { action: 'paroles', systeme: CONSIGNES_PAROLES, message: `Section :\n${donnees(d)}`, maxTokens: 1500 };
}

/** Le texte exact envoyé : consignes (partie système), puis le message. */
export function texteEnvoye(r: Requete): string {
  return `${r.systeme}\n\n${r.message}`;
}

/* ------------------------------------------------------------ morceau compact */

/** Ligne de batterie en écriture compacte (x = frappe, o = douce, - = rien). */
export function ligneCompacte(l: number[]): string {
  return l.map((v) => (v >= 0.75 ? 'x' : v > 0 ? 'o' : '-')).join('');
}

function motifCompact(mo: Motif): unknown {
  if (mo.type !== 'batterie') return mo;
  const pistes: Record<string, string> = {};
  for (const i of INSTRUMENTS_IA) {
    const l = mo.pistes[i];
    if (l?.some((v) => v > 0)) pistes[i] = ligneCompacte(l);
  }
  return { type: 'batterie', pas: mo.pas, pistes };
}

/**
 * Le morceau tel que l'IA le voit : style, tempo, tonalité, motifs, sections (sans paroles) et ordre.
 * Jamais de prises, de sons importés, d'infos, de master ni de pads.
 */
export function compacter(m: Morceau): unknown {
  const motifs: Record<string, unknown> = {};
  for (const [id, mo] of Object.entries(m.motifs)) motifs[id] = motifCompact(mo);
  return {
    titre: m.titre,
    style: m.style,
    tempo: m.tempo,
    tonalite: m.tonalite,
    motifs,
    sections: m.sections.map((s) => ({ id: s.id, nom: s.nom, mesures: s.mesures, motifs: s.motifs, fill: s.fill, coupure: s.coupure })),
    ordre: m.ordre,
  };
}

/* ------------------------------------------------------------ coût */

/** Nombre de tokens d'un texte, à peu près (environ 3,5 caractères par token, JSON et français). */
export function estimerTokens(texte: string): number {
  return Math.ceil(texte.length / 3.5);
}

export interface Cout {
  /** Tokens envoyés + tokens de la réponse (au plus). */
  tokens: number;
  /** « environ 4 000 tokens, soit quelques centimes au plus avec le modèle conseillé ». */
  phrase: string;
}

/** Estimation avant l'envoi : ce qui part, plus la réponse la plus longue permise. */
export function estimerCout(r: Requete): Cout {
  const tokens = estimerTokens(texteEnvoye(r)) + r.maxTokens;
  const pas = 10 ** Math.max(2, Math.floor(Math.log10(Math.max(tokens, 1))) - 1);
  const arrondi = Math.max(pas, Math.round(tokens / pas) * pas);
  const nombre = String(arrondi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cout = tokens <= 20_000 ? 'environ un centime ou moins' : tokens <= 80_000 ? 'quelques centimes' : 'quelques dizaines de centimes';
  return { tokens, phrase: `environ ${nombre} tokens, soit ${cout} avec le modèle conseillé` };
}
