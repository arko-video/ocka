// Les 3 fournisseurs d'IA d'OCKA (copiés d'Arko, licence MIT, même auteur), et le bouton « Tester ma clé ».

import { ErreurOcka } from '../../moteur/erreur';
import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { openai } from './openai';
import type { Fournisseur, IdFournisseur, OptionsReseau } from './types';

export type { AppelIA, FonctionFetch, Fournisseur, IdFournisseur, OptionsReseau, ReponseIA } from './types';

/** Dans l'ordre d'affichage. */
export const FOURNISSEURS: readonly Fournisseur[] = [anthropic, openai, gemini];

export function estFournisseur(v: unknown): v is IdFournisseur {
  return v === 'anthropic' || v === 'openai' || v === 'gemini';
}

export function trouverFournisseur(id: IdFournisseur): Fournisseur {
  const f = FOURNISSEURS.find((x) => x.id === id);
  if (!f) throw new ErreurOcka(`Fournisseur d’IA inconnu : « ${String(id).slice(0, 20)} ».`, 'fournisseur');
  return f;
}

/**
 * « Tester ma clé » : demande la liste des modèles. Ça ne coûte aucun token.
 * Renvoie les modèles (le modèle par défaut en premier) ; une clé refusée lève une ErreurOcka « cle_refusee ».
 */
export async function testerCle(id: IdFournisseur, cle: string, options: OptionsReseau = {}): Promise<string[]> {
  const propre = cle.replace(/\s+/g, '');
  if (!propre) throw new ErreurOcka('Colle d’abord ta clé API.', 'cle_vide');
  return trouverFournisseur(id).listerModeles(propre, options);
}
