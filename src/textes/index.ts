// Tous les textes de l'interface d'OCKA, en français simple (tutoiement), assemblés en un seul objet `T`.
// Un fichier par domaine, pour que chaque développeur n'édite que le sien :
//   commun.ts (intégrateur) · accueil.ts et sortie.ts (A1) · studio.ts (U) · aide.ts et ia.ts (vague B) ·
//   v2 : bq.ts et ../instruments/textes.ts (BQ, TEXTES_BANQUE) · moteur.ts (M1) · effets.ts (M2) · pistes.ts (U1) · frise.ts (U2).
//   C2 : styles-rap.ts (S1) · styles-autres.ts (S2) · autotune.ts (A2) · dubler.ts (D).
//   C3 : outils-notes.ts (P) · sons-avances.ts (S) · synthes.ts (L) · performance.ts (R) · voix-avancee.ts (V) ; entrees.ts (intégrateur).
// Règle : on ajoute ses clés DANS ses groupes (ou de nouveaux groupes dans son fichier) ; un test refuse les doublons.

import { TEXTES_ACCUEIL } from './accueil';
import { TEXTES_AIDE } from './aide';
import { TEXTES_AUTOTUNE } from './autotune';
import { TEXTES_BQ } from './bq';
import { TEXTES_BQ as TEXTES_BANQUE } from '../instruments/textes';
import { TEXTES_COMMUN } from './commun';
import { TEXTES_DUBLER } from './dubler';
import { TEXTES_EFFETS } from './effets';
import { TEXTES_FRISE } from './frise';
import { TEXTES_IA } from './ia';
import { TEXTES_MOTEUR } from './moteur';
import { TEXTES_PISTES } from './pistes';
import { TEXTES_SORTIE } from './sortie';
import { TEXTES_STUDIO } from './studio';
import { TEXTES_STYLES_AUTRES } from './styles-autres';
import { TEXTES_STYLES_RAP } from './styles-rap';
import { TEXTES_ENTREES } from './entrees';
import { TEXTES_OUTILS_NOTES } from './outils-notes';
import { TEXTES_PERFORMANCE } from './performance';
import { TEXTES_SONS_AVANCES } from './sons-avances';
import { TEXTES_SYNTHES } from './synthes';
import { TEXTES_VOIX_AVANCEE } from './voix-avancee';

/** Les groupes, pour le test des doublons. */
export const GROUPES_TEXTES = { TEXTES_COMMUN, TEXTES_ACCUEIL, TEXTES_STUDIO, TEXTES_SORTIE, TEXTES_AIDE, TEXTES_IA, TEXTES_BQ, TEXTES_BANQUE, TEXTES_MOTEUR, TEXTES_EFFETS, TEXTES_PISTES, TEXTES_FRISE, TEXTES_STYLES_RAP, TEXTES_STYLES_AUTRES, TEXTES_AUTOTUNE, TEXTES_DUBLER,
  TEXTES_ENTREES, TEXTES_OUTILS_NOTES, TEXTES_SONS_AVANCES, TEXTES_SYNTHES, TEXTES_PERFORMANCE, TEXTES_VOIX_AVANCEE };

export const T = {
  ...TEXTES_COMMUN,
  ...TEXTES_ACCUEIL,
  ...TEXTES_STUDIO,
  ...TEXTES_SORTIE,
  ...TEXTES_AIDE,
  ...TEXTES_IA,
  ...TEXTES_BQ,
  ...TEXTES_BANQUE,
  ...TEXTES_MOTEUR,
  ...TEXTES_EFFETS,
  ...TEXTES_PISTES,
  ...TEXTES_FRISE,
  ...TEXTES_STYLES_RAP,
  ...TEXTES_STYLES_AUTRES,
  ...TEXTES_AUTOTUNE,
  ...TEXTES_DUBLER,
  ...TEXTES_ENTREES,
  ...TEXTES_OUTILS_NOTES,
  ...TEXTES_SONS_AVANCES,
  ...TEXTES_SYNTHES,
  ...TEXTES_PERFORMANCE,
  ...TEXTES_VOIX_AVANCEE,
};

export type Textes = typeof T;
