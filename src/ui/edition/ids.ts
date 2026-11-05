// Ids neufs, lisibles et sûrs pour les sections, motifs… : conformes à REGLE_ID, jamais un nom réservé
// (« constructor »…), au plus 36 caractères (le normaliseur peut encore ajouter « -2 » sans dépasser 40).

import { idValide } from '../../morceau/normaliser-outils';

export const LONGUEUR_ID = 36;
/** Place gardée pour le suffixe « -2 », « -15 »… */
const LONGUEUR_BASE = LONGUEUR_ID - 4;

/** « Couplet 2 » → « couplet-2 » (minuscules, chiffres et tirets). '' si rien ne reste. */
export function nettoyerId(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGUEUR_BASE)
    .replace(/-+$/, '');
}

/** Id libre tiré de `texte` (sinon de `secours`) : « refrain », puis « refrain-2 », « refrain-3 »… */
export function idLibre(texte: string, pris: Iterable<string>, secours = 'id'): string {
  const occupes = new Set(pris);
  let base = nettoyerId(texte);
  if (!idValide(base)) base = nettoyerId(secours) || 'id';
  if (!occupes.has(base)) return base;
  let i = 2;
  while (occupes.has(`${base}-${i}`)) i++;
  return `${base}-${i}`.slice(0, LONGUEUR_ID);
}
