// Historique Annuler / Rétablir immuable (repris d'Arko) : chaque action renvoie un nouvel historique.
// Au plus 60 états en arrière.

import type { Morceau } from '../../morceau/types';

export const TAILLE_HISTORIQUE = 60;

export interface Historique {
  readonly passe: readonly Morceau[];
  readonly present: Morceau;
  readonly futur: readonly Morceau[];
  readonly peutAnnuler: boolean;
  readonly peutRetablir: boolean;
}

function creer(passe: readonly Morceau[], present: Morceau, futur: readonly Morceau[]): Historique {
  return Object.freeze({ passe, present, futur, peutAnnuler: passe.length > 0, peutRetablir: futur.length > 0 });
}

export function nouvelHistorique(m: Morceau): Historique {
  return creer([], m, []);
}

/** Ajoute un état (efface ce qui pouvait être rétabli). Sans effet si le morceau est le même. */
export function pousser(h: Historique, m: Morceau): Historique {
  if (m === h.present) return h;
  return creer([...h.passe, h.present].slice(-TAILLE_HISTORIQUE), m, []);
}

/** Remplace l'état présent sans créer d'étape (glissé d'un curseur, frappe dans un champ). */
export function remplacer(h: Historique, m: Morceau): Historique {
  if (m === h.present) return h;
  return creer(h.passe, m, []);
}

export function annuler(h: Historique): Historique {
  if (h.passe.length === 0) return h;
  return creer(h.passe.slice(0, -1), h.passe[h.passe.length - 1]!, [h.present, ...h.futur]);
}

export function retablir(h: Historique): Historique {
  if (h.futur.length === 0) return h;
  return creer([...h.passe, h.present], h.futur[0]!, h.futur.slice(1));
}
