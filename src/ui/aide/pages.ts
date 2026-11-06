// Registre de l'aide : toutes les pages, l'ordre du guide, et la page qui correspond à chaque écran.
// Pur (aucun import de l'interface) : testé par aide.test.ts. Propriétaire : B3.

import { PAGE_FAQ, PAGE_SPOTIFY } from './pages-spotify';
import { ORDRE_ECRANS, PAGES_ECRANS } from './pages-ecrans';
import { PAGES_GUIDE } from './pages-guide';
import type { IdPage, PageAide } from './types';

/** Les pages du guide, dans l'ordre de lecture conseillé. */
export const ORDRE_GUIDE: IdPage[] = ['premier-morceau', 'voix-propre', 'spotify', 'droits', 'finir-pc', 'installer', 'faq', 'a-propos'];

export const PAGES: Record<IdPage, PageAide> = {
  ...PAGES_ECRANS,
  ...PAGES_GUIDE,
  spotify: PAGE_SPOTIFY,
  faq: PAGE_FAQ,
  // Remplie juste en dessous : elle cite les titres des autres pages.
  guide: { titre: 'Tout le guide', resume: 'Tout ce qu’il faut pour faire et sortir tes morceaux.', blocs: [] },
};
PAGES.guide.blocs = [
  ...ORDRE_GUIDE.map((page) => ({ t: 'voir' as const, texte: PAGES[page].titre, page })),
  { t: 'titre', texte: 'L’aide de chaque écran' },
  ...ORDRE_ECRANS.map((page) => ({ t: 'voir' as const, texte: PAGES[page].titre, page })),
];

export const IDS_PAGES = Object.keys(PAGES) as IdPage[];

export function estPage(x: unknown): x is IdPage {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(PAGES, x);
}

/**
 * La page d'aide de l'écran en cours. `vueBeat` distingue Batterie et Instruments (la mélodie) dans l'étape Beat.
 * Un écran inconnu (ajouté plus tard) ouvre le guide entier.
 */
export function pageDeLEcran(ecran: string, vueBeat: 'batterie' | 'instruments' = 'batterie'): IdPage {
  switch (ecran) {
    case 'accueil':
    case 'sorties':
      return 'accueil';
    case 'styles':
      return 'premier-morceau';
    case 'beat':
      return vueBeat === 'instruments' ? 'melodie' : 'beat';
    case 'structure':
    case 'voix':
    case 'son':
    case 'exporter':
      return ecran;
    case 'sortie-infos':
    case 'sortie-pochette':
    case 'sortie-verifier':
      return 'assistant';
    default:
      return 'guide';
  }
}

/** Espaces insécables dans les guillemets et avant « ? ! : ; » : « Release Radar » ne se coupe jamais en fin de ligne. */
export const insecables = (t: string) => t.replace(/« /g, '«\u00a0').replace(/ ([»?!:;])/g, '\u00a0$1');
