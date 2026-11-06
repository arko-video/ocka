// Notes FANTÔMES du piano roll « Complet » (mode Avancé, P) : les notes des autres pistes dans la même section, en
// gris, pour écrire « par-dessus » (affichage seulement : on ne peut ni les toucher ni les déplacer). Le motif d'une
// autre piste boucle sur la longueur de celui-ci (comme à l'écoute).

import type { Morceau, Note } from '../../../morceau/types';
import { notesFantomes } from '../../edition/api-outils-notes';

/** Les notes fantômes placées sur `longueur` pas (motifs plus courts répétés, notes coupées au bout). Pur. */
export function fantomesSurLongueur(m: Morceau, idPiste: string, idSection: string, longueur: number): Note[] {
  const gris: Note[] = [];
  for (const f of notesFantomes(m, idPiste, idSection))
    for (let debut = 0; debut < longueur && f.pas > 0; debut += f.pas)
      for (const n of f.notes)
        if (debut + n.pas < longueur) gris.push({ ...n, pas: debut + n.pas, duree: Math.min(n.duree, longueur - debut - n.pas) });
  return gris;
}
