// L'erreur d'OCKA pour l'utilisateur : `message` est DÉJÀ en français simple (l'interface l'affiche tel quel),
// `code` est stable (pour les tests et pour choisir une action). Fichier séparé de api.ts : un module du moteur
// peut l'importer sans boucle d'imports.

/**
 * Codes connus (on peut en ajouter : le dire dans son rapport).
 * - général : pas_encore (bouchon de la vague A), annule, disque_plein, stockage, inconnu
 * - morceaux : morceau_invalide, morceau_illisible, morceau_introuvable, duplication_impossible, trop_court
 * - micro et prises : micro_refuse, micro_absent, bluetooth, signal_faible, calibrage_instable, prise_introuvable,
 *   prise_vide, ancre_introuvable, deja_en_cours, pas_en_cours
 * - sorties : sortie_invalide, sortie_illisible, sortie_introuvable, titre_introuvable, trop_gros,
 *   pochette_trop_petite, image_illisible
 * - fichiers : projet_illisible, projet_trop_gros, format_recent, son_illisible, son_trop_long, son_trop_gros,
 *   trop_de_sons, partage_impossible, format_impossible (le téléphone ne sait pas fabriquer ce format, ex. M4A)
 */
export type CodeErreur =
  | 'pas_encore'
  | 'annule'
  | 'disque_plein'
  | 'stockage'
  | 'inconnu'
  | 'morceau_invalide'
  | 'morceau_illisible'
  | 'morceau_introuvable'
  | 'duplication_impossible'
  | 'trop_court'
  | 'micro_refuse'
  | 'micro_absent'
  | 'bluetooth'
  | 'signal_faible'
  | 'calibrage_instable'
  | 'prise_introuvable'
  | 'prise_vide'
  | 'ancre_introuvable'
  | 'deja_en_cours'
  | 'pas_en_cours'
  | 'sortie_invalide'
  | 'sortie_illisible'
  | 'sortie_introuvable'
  | 'titre_introuvable'
  | 'trop_gros'
  | 'pochette_trop_petite'
  | 'image_illisible'
  | 'projet_illisible'
  | 'projet_trop_gros'
  | 'format_recent'
  | 'son_illisible'
  | 'son_trop_long'
  | 'son_trop_gros'
  | 'trop_de_sons'
  | 'partage_impossible'
  | 'format_impossible';

export class ErreurOcka extends Error {
  constructor(
    message: string,
    public code: CodeErreur | (string & {}),
  ) {
    super(message);
    this.name = 'ErreurOcka';
  }
}

/** L'erreur des bouchons de la vague A : la fonction existe dans le contrat mais n'est pas encore faite. */
export function bientot(): ErreurOcka {
  return new ErreurOcka('Bientôt disponible', 'pas_encore');
}
