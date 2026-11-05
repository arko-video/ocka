// L'envoi d'une requête au fournisseur choisi, avec la clé de l'utilisateur.
// Aucun appel sans geste : l'interface l'appelle depuis un toucher, et on refuse si le navigateur dit qu'il n'y en a
// pas eu (navigator.userActivation). Les appels partent de la page, jamais d'un Worker.

import { ErreurOcka } from '../moteur/erreur';
import { trouverFournisseur, type FonctionFetch, type IdFournisseur } from './fournisseurs';
import { texte as texteBrut } from './liste-blanche';
import type { Requete } from './requetes';

export interface Reglages {
  fournisseur: IdFournisseur;
  cle: string;
  /** Modèle choisi ; vide = le modèle conseillé du fournisseur. */
  modele?: string;
  signal?: AbortSignal;
  /** Faux fetch pour les tests. */
  fetch?: FonctionFetch;
}

/** true si la page vient d'être touchée (ou si le navigateur ne sait pas le dire : Node, vieux navigateurs). */
export function gesteRecent(): boolean {
  const n = (globalThis as { navigator?: { userActivation?: { isActive?: boolean } } }).navigator;
  return n?.userActivation?.isActive !== false;
}

/**
 * Envoie la requête et renvoie le texte de la réponse (1 Mo au plus, déjà vérifié à la lecture).
 * À appeler TOUT DE SUITE dans le gestionnaire du toucher (la vérification du geste est faite avant tout await).
 */
export async function demander(r: Requete, reglages: Reglages): Promise<string> {
  if (!gesteRecent()) throw new ErreurOcka('Touche le bouton pour envoyer ta demande.', 'sans_geste');
  const cle = reglages.cle.replace(/\s+/g, '');
  if (!cle) throw new ErreurOcka('Règle d’abord ton IA : choisis un fournisseur et colle ta clé.', 'cle_vide');
  const f = trouverFournisseur(reglages.fournisseur);
  const rep = await f.appeler({
    cle,
    modele: reglages.modele?.trim() || f.modeleParDefaut,
    systeme: r.systeme,
    message: r.message,
    maxTokens: r.maxTokens,
    signal: reglages.signal,
    fetch: reglages.fetch,
  });
  if (rep.coupee && r.action !== 'paroles') {
    throw new ErreurOcka('La réponse de l’IA était coupée (trop longue). Réessaie avec une demande plus simple. Rien n’a été changé.', 'reponse_coupee');
  }
  return texteBrut(rep.texte, 1_000_000, true) ?? '';
}
