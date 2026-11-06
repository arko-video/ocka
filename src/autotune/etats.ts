// États des fichiers rendus par l'autotune (simple et avancé) et lecture d'un rendu déjà fait dans OPFS.
// Un rendu = « auto-….f32 » (PCM, même format et même longueur que la prise) puis sa description « auto-….json »
// { voisees, applique }, écrite EN DERNIER (elle dit que le travail est fini). Repli : la description seule.

import { lireFichier, nomDescription } from '../enregistrement/fichiers-opfs';

/** PCM d'une prise pour le graphe ; `version` = fichier corrigé joué (absent = la prise brute). */
export interface PcmVoix {
  frequence: number;
  pcm: Float32Array;
  version?: string;
}

export type EtatAutotune = { etat: 'calcul' | 'pret' | 'repli' | 'erreur'; voisees: number };

const etats = new Map<string, EtatAutotune>();
const abonnes = new Set<(nom: string) => void>();

export const etatAutotune = (nom: string): EtatAutotune | undefined => etats.get(nom);

/** Prévient `fn` à chaque changement d'état d'un fichier corrigé ; renvoie de quoi se désabonner. */
export function surAutotune(fn: (nom: string) => void): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

export function noter(nom: string, e: EtatAutotune): void {
  etats.set(nom, e);
  for (const f of abonnes) f(nom);
}

/** Le travail déjà fait (description lue), ou null s'il n'existe pas encore. */
export async function lireFait(nom: string, frequence: number): Promise<PcmVoix | 'repli' | null> {
  const desc = await lireFichier(nomDescription(nom));
  if (!desc) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(desc)) as { voisees?: number; applique?: boolean };
    const voisees = Number(d.voisees) || 0;
    if (!d.applique) return (noter(nom, { etat: 'repli', voisees }), 'repli');
    const o = await lireFichier(nom);
    if (!o) return null;
    noter(nom, { etat: 'pret', voisees });
    return { frequence, pcm: new Float32Array(o, 0, Math.floor(o.byteLength / 4)), version: nom };
  } catch {
    return null;
  }
}
