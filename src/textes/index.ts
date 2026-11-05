// Tous les textes de l'interface d'OCKA, en français simple (tutoiement), assemblés en un seul objet `T`.
// Un fichier par domaine, pour que chaque développeur n'édite que le sien :
//   commun.ts (intégrateur) · accueil.ts et sortie.ts (A1) · studio.ts (U) · aide.ts et ia.ts (vague B).
// Règle : on ajoute ses clés DANS ses groupes (ou de nouveaux groupes dans son fichier) ; un test refuse les doublons.

import { TEXTES_ACCUEIL } from './accueil';
import { TEXTES_AIDE } from './aide';
import { TEXTES_COMMUN } from './commun';
import { TEXTES_IA } from './ia';
import { TEXTES_SORTIE } from './sortie';
import { TEXTES_STUDIO } from './studio';

/** Les groupes, pour le test des doublons. */
export const GROUPES_TEXTES = { TEXTES_COMMUN, TEXTES_ACCUEIL, TEXTES_STUDIO, TEXTES_SORTIE, TEXTES_AIDE, TEXTES_IA };

export const T = {
  ...TEXTES_COMMUN,
  ...TEXTES_ACCUEIL,
  ...TEXTES_STUDIO,
  ...TEXTES_SORTIE,
  ...TEXTES_AIDE,
  ...TEXTES_IA,
};

export type Textes = typeof T;
