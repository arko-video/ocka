// Prises dérivées (punch-in, comping, nettoyeur, doublage) : lecture du PCM des sources, écriture du nouveau
// fichier OPFS (« prise-<id>.f32 » + description .json, comme l'enregistreur), repères d'une prise dans le morceau.

import { ErreurOcka } from '../moteur/erreur';
import { positionAncre } from '../morceau/temps';
import type { Morceau, Prise } from '../morceau/types';
import type { Reperes, Source } from './assemblage';
import { nouvelId } from './contexte';
import { ecrireTexte, nomDescription, ouvrirEcriture, supprimerFichier } from './fichiers-opfs';
import { lirePrise } from './prises';

/** Repères d'une prise dans ce morceau ; « ancre_introuvable » si sa section n'y est plus. */
export function reperesDe(m: Morceau, p: Prise): Reperes {
  const debutAncre = positionAncre(m, p.ancre);
  if (debutAncre === null) throw new ErreurOcka("Cette section n'existe plus dans le morceau.", 'ancre_introuvable');
  return { debutAncre, debutCoupe: p.debutCoupe, decalage: p.decalage, frequence: p.frequence };
}

/** Le PCM brut (fichier OPFS) d'une prise ; « prise_introuvable » s'il manque. */
export async function lirePcmBrut(p: Prise): Promise<Float32Array> {
  const lu = await lirePrise(p);
  if (!lu || lu.pcm.length === 0) throw new ErreurOcka('Le fichier de cette prise est introuvable sur le téléphone.', 'prise_introuvable');
  return lu.pcm;
}

/** Une source d'assemblage : PCM brut + repères. */
export async function sourceDe(m: Morceau, p: Prise): Promise<Source> {
  return { ...reperesDe(m, p), pcm: await lirePcmBrut(p) };
}

/** La prise `id` du morceau ; « prise_introuvable » sinon. */
export function trouverPrise(m: Morceau, id: string): Prise {
  const p = m.prises.find((x) => x.id === id);
  if (!p) throw new ErreurOcka('Cette prise n’existe plus dans le morceau.', 'prise_introuvable');
  return p;
}

/** Écrit un nouveau fichier de prise (mono f32) ; renvoie son nom. Erreur « stockage » si le disque refuse. */
export async function ecrirePrise(pcm: Float32Array, frequence: number, origine: string): Promise<string> {
  const fichier = `prise-${nouvelId()}.f32`;
  try {
    const e = await ouvrirEcriture(fichier);
    // Par morceaux de 1 s : le flux d'écriture ne copie jamais tout d'un coup.
    for (let i = 0; i < pcm.length; i += frequence) e.ecrire(pcm.slice(i, Math.min(pcm.length, i + frequence)));
    await e.fermer();
  } catch {
    await supprimerFichier(fichier);
    throw new ErreurOcka("La nouvelle prise n'a pas pu être enregistrée (stockage du téléphone plein ?).", 'stockage');
  }
  const description = { format: 'ocka.prise/1', encodage: 'f32le', canaux: 1, frequence, echantillons: pcm.length, origine };
  await ecrireTexte(nomDescription(fichier), JSON.stringify(description)).catch(() => {});
  return fichier;
}
