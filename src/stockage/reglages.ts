// Réglages de l'utilisateur (base ocka-reglages, via magasin('reglages') de ./dossiers). Propriétaire : A1.
// Une seule entrée « reglages ». Lecture TOUJOURS par normaliserReglages : un champ illisible est retiré.
// Le vrai nom n'est demandé qu'une fois : il pré-remplit les crédits (auteur, compositeur) de chaque titre.

import { get, update } from 'idb-keyval';
import { normaliserReglages } from '../morceau/normaliser-sortie';
import type { Reglages } from '../sortie/types';
import { enErreurOcka, magasin } from './dossiers';

const CLE = 'reglages';

export async function lireReglages(): Promise<Reglages> {
  try {
    return normaliserReglages(await get(CLE, magasin('reglages')));
  } catch (e) {
    throw enErreurOcka(e, { message: 'Impossible de lire tes réglages.', code: 'stockage' });
  }
}

/** Fusionne `changements` (une valeur vide ou undefined efface le champ), sauve et renvoie le résultat normalisé. */
export async function ecrireReglages(changements: Partial<Reglages>): Promise<Reglages> {
  let resultat: Reglages = {};
  try {
    await update(
      CLE,
      (brut: unknown) => {
        const avant = normaliserReglages(brut) as Record<string, unknown>;
        for (const [k, v] of Object.entries(changements)) {
          if (v === undefined || v === '') delete avant[k];
          else avant[k] = v;
        }
        resultat = normaliserReglages(avant);
        return resultat;
      },
      magasin('reglages'),
    );
  } catch (e) {
    throw enErreurOcka(e, { message: 'Tes réglages n’ont pas pu être sauvés.', code: 'stockage' });
  }
  return resultat;
}
