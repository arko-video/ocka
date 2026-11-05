// Clé API de l'utilisateur, gardée SUR L'APPAREIL seulement, dans IndexedDB « ocka-cles » (une par fournisseur).
// Copié d'Arko (licence MIT, même auteur). Jamais dans localStorage, jamais dans la console ni dans un message.
// Pas de chiffrement : sans mot de passe, ce serait du faux. L'interface dit « Ta clé reste sur ton téléphone ».

import { del, get, set } from 'idb-keyval';
import { ErreurOcka } from '../moteur/erreur';
import { magasin } from '../stockage/dossiers';
import { estFournisseur, type IdFournisseur } from './fournisseurs';

// Base ocka-cles (BASES_IDB.cles). Clés de rangement : « cle:anthropic », « cle:openai »… et « fournisseur ».
const base = () => magasin('cles');
const rangement = (fournisseur: IdFournisseur) => `cle:${fournisseur}`;

/** Garde la clé (espaces et retours à la ligne du copier-coller retirés). Une clé vide = oublier. */
export async function sauverCle(fournisseur: IdFournisseur, cle: string): Promise<void> {
  const propre = cle.replace(/\s+/g, '');
  if (!propre) return oublierCle(fournisseur);
  try {
    await set(rangement(fournisseur), propre, base());
  } catch {
    throw new ErreurOcka('Impossible de garder la clé sur cet appareil (navigation privée ?).', 'stockage');
  }
}

/** La clé gardée, ou null s'il n'y en a pas. */
export async function lireCle(fournisseur: IdFournisseur): Promise<string | null> {
  try {
    const cle = await get<unknown>(rangement(fournisseur), base());
    return typeof cle === 'string' && cle ? cle : null;
  } catch {
    return null;
  }
}

/** Bouton « Oublier ma clé ». */
export async function oublierCle(fournisseur: IdFournisseur): Promise<void> {
  try {
    await del(rangement(fournisseur), base());
  } catch {
    // Rien à oublier si la base est inaccessible.
  }
}

/** Le fournisseur choisi (Anthropic par défaut). Ce n'est pas un secret. */
export async function lireFournisseur(): Promise<IdFournisseur> {
  try {
    const f = await get<unknown>('fournisseur', base());
    return estFournisseur(f) ? f : 'anthropic';
  } catch {
    return 'anthropic';
  }
}

export async function sauverFournisseur(f: IdFournisseur): Promise<void> {
  try {
    await set('fournisseur', f, base());
  } catch {
    // Pas grave : on reprendra Anthropic.
  }
}

/**
 * Clé masquée pour l'affichage : « sk-…a1B2 » (le préfixe et les 4 derniers caractères).
 * Une clé trop courte est entièrement cachée.
 */
export function masquer(cle: string): string {
  const propre = cle.trim();
  if (propre.length < 12) return '••••';
  const prefixe = propre.match(/^[a-zA-Z]{2,4}-/)?.[0] ?? propre.slice(0, 3);
  return `${prefixe}…${propre.slice(-4)}`;
}
