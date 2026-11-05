// Forme des pages de l'aide (bouton « ? ») : des blocs simples, sans HTML. Pur, testé par aide.test.ts.
// Propriétaire : B3.

import type { CleLien } from './liens';

/** Toutes les pages : l'aide de chaque écran, puis le guide, la FAQ et « À propos ». */
export type IdPage =
  | 'accueil'
  | 'beat'
  | 'melodie'
  | 'structure'
  | 'voix'
  | 'son'
  | 'exporter'
  | 'assistant'
  | 'guide'
  | 'premier-morceau'
  | 'voix-propre'
  | 'spotify'
  | 'droits'
  | 'finir-pc'
  | 'installer'
  | 'faq'
  | 'a-propos';

/** Un morceau de page. Le texte est toujours affiché tel quel (jamais interprété comme du HTML). */
export type Bloc =
  /** Un paragraphe. */
  | { t: 'p'; texte: string }
  /** Un intertitre. */
  | { t: 'titre'; texte: string }
  /** Une liste à puces, ou numérotée (les étapes). */
  | { t: 'liste'; items: string[]; numerotee?: boolean }
  /** Un conseil mis en avant. */
  | { t: 'conseil'; texte: string }
  /** Une question de la FAQ et sa réponse. */
  | { t: 'question'; q: string; r: string }
  /** Un lien vers une page d'aide officielle (nouvel onglet). Seules les adresses de liens.ts sont permises. */
  | { t: 'lien'; texte: string; lien: CleLien }
  /** Un renvoi vers une autre page de l'aide. */
  | { t: 'voir'; texte: string; page: IdPage };

export interface PageAide {
  titre: string;
  /** Une phrase sous le titre. */
  resume: string;
  blocs: Bloc[];
}
