// Bruitages façon sfxr (L) : un type (pièce, saut, laser, explosion, power-up, coup, bip) = un nouveau bruitage à
// chaque toucher ; « Au hasard » ; « Muter » le change un peu. Chaque bruitage est joué tout de suite.
import { CATEGORIES_SFXR, sfxrAuHasard } from '../../../moteur/api';
import type { RecetteSfxr } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { muterSfxr, nouvelleGraineSfxr, sfxrAleatoire } from './sfxr-mutation';

/** Ordre d'affichage : les bruitages les plus utiles d'abord (vidéos de jeux). */
const ORDRE = ['piece', 'saut', 'laser', 'explosion', 'bonus', 'coup', 'bip'] as const;

interface Props {
  recette: RecetteSfxr | null;
  choisir: (r: RecetteSfxr, nom?: string) => void;
}

export function ReglagesBruitages({ recette, choisir }: Props) {
  return (
    <>
      <p class="aide">{T.sonsCourts.aideBruitages}</p>
      <div class="puces">
        {ORDRE.filter((c) => (CATEGORIES_SFXR as readonly string[]).includes(c)).map((c) => (
          <button
            key={c}
            type="button"
            class="puce"
            onClick={() => choisir(sfxrAuHasard(c, nouvelleGraineSfxr()), T.sonsCourts.categories[c])}
            data-testid={`sfxr-${c}`}
          >
            {T.sonsCourts.categories[c]}
          </button>
        ))}
        <button
          type="button"
          class="puce"
          onClick={() => choisir(sfxrAleatoire(nouvelleGraineSfxr()), T.sonsCourts.hasard)}
          data-testid="sfxr-hasard"
        >
          {T.sonsCourts.hasard}
        </button>
      </div>
      {recette && (
        <div class="synthe-actions">
          <button
            type="button"
            class="btn btn-petit btn-contour"
            onClick={() => choisir(muterSfxr(recette, nouvelleGraineSfxr()))}
            data-testid="sfxr-muter"
          >
            {T.sonsCourts.muter}
          </button>
        </div>
      )}
    </>
  );
}
