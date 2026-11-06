// Menu d'un clip de la frise (appui long) : Éditer, Rendre unique (« dans N sections »), Copier le motif depuis…,
// Vider. « Muet pour cette section » n'existe pas dans le format /3 : Vider (puis Annuler) en tient lieu.

import { useState } from 'preact/hooks';
import { estPisteInstrument, idMotifDe, pisteDe, sectionDe } from '../../../morceau/acces';
import { T } from '../../../textes-fr';
import { copierMotifDepuis, rendreUnique, sourcesCopie, usagesMotif, viderClip } from '../../edition/sections';
import { afficherToast, annulerAction, modifier, morceau } from '../../etat';
import { fermerPanneau } from '../../navigation';
import { toastErreur } from '../../lecture';
import { Panneau } from '../Panneau';
import { clipVise, PANNEAUX_FRISE } from './etat-frise';

interface Props {
  /** Ouvre l'éditeur du clip (piano roll, Beat, Voix…). */
  editer: (piste: string, section: string) => void;
  nomPiste: (id: string) => string;
}

/** Ferme le panneau puis agit (après le retour dans l'historique : un autre panneau peut alors s'ouvrir). */
function apresFermeture(fn: () => void) {
  window.addEventListener('popstate', () => setTimeout(fn, 0), { once: true });
  fermerPanneau();
}

export function MenuClip({ editer, nomPiste }: Props) {
  const [copie, setCopie] = useState(false);
  const m = morceau.value;
  const v = clipVise.value;
  const s = m && v ? sectionDe(m, v.section) : undefined;
  const p = m && v ? pisteDe(m, v.piste) : undefined;
  if (!m || !v || !s || !p) return null;
  const idMotif = idMotifDe(s, p.id);
  const n = idMotif ? usagesMotif(m, idMotif) : 0;
  const sources = sourcesCopie(m, s.id, p.id);
  const avecMotif = p.id !== 'voix' && p.id !== 'sons';

  const agir = (op: Parameters<typeof modifier>[0], message: string) => {
    try {
      if (modifier(op)) afficherToast(message, 4000, { label: T.annuler, agir: annulerAction });
      setCopie(false);
      fermerPanneau();
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <Panneau id={PANNEAUX_FRISE.clip} titre={T.frise.clipDe(nomPiste(p.id), s.nom)} testid="menu-clip">
      <div class="menu-clip">
        {(idMotif !== undefined || estPisteInstrument(p) || !avecMotif) && (
          <button
            type="button"
            class="btn btn-contour"
            onClick={() => apresFermeture(() => editer(p.id, s.id))}
            data-testid="clip-editer"
          >
            {idMotif === undefined && estPisteInstrument(p) ? T.frise.nouveauClip : T.frise.editer}
          </button>
        )}
        {n > 1 && (
          <div class="menu-clip-ligne">
            <p class="aide">
              <strong>{T.frise.dansSections(n)}</strong> · {T.frise.rendreUniqueAide}
            </p>
            <button type="button" class="btn" onClick={() => agir((x) => rendreUnique(x, s.id, p.id), T.frise.rendu)} data-testid="clip-rendre-unique">
              {T.frise.rendreUnique}
            </button>
          </div>
        )}
        {avecMotif && (
          <button type="button" class="btn" aria-expanded={copie} onClick={() => setCopie(!copie)} data-testid="clip-copier-depuis">
            {T.frise.copierDepuis}
          </button>
        )}
        {copie && (
          <div class="grille-choix" data-testid="clip-sources">
            {sources.length === 0 && <p class="aide">{T.frise.aucuneSource}</p>}
            {sources.map((id) => (
              <button
                key={id}
                type="button"
                class="choix choix-contour"
                onClick={() => agir((x) => copierMotifDepuis(x, s.id, p.id, id), T.frise.copie)}
                data-testid={`clip-source-${id}`}
              >
                {sectionDe(m, id)?.nom ?? id}
              </button>
            ))}
          </div>
        )}
        {avecMotif && idMotif !== undefined && (
          <button type="button" class="btn btn-danger" onClick={() => agir((x) => viderClip(x, s.id, p.id), T.frise.videOk)} data-testid="clip-vider">
            {T.frise.vider}
          </button>
        )}
      </div>
    </Panneau>
  );
}
