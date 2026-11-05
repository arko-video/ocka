// Bouton A/B « Écouter sans le mastering » : maintenu, on entend sans couleur ni colle tant qu'on appuie ;
// touché (appui court), il reste enfoncé jusqu'au toucher suivant. Même volume perçu (écart mesuré par M2).

import { useEffect, useRef } from 'preact/hooks';
import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { comparerAB, preparerAB, sansMastering } from '../../lecture';

/** Au-delà de cet appui (ms), c'est un « maintien » : on revient au relâchement. */
const MAINTIEN_MS = 350;

export function BoutonAB({ m }: { m: Morceau }) {
  const debut = useRef(0);
  const etaitActif = useRef(false);
  // L'écart de volume est mesuré une fois, puis à chaque changement de couleur (ou de chaîne).
  useEffect(() => void preparerAB(m), [m.master.preset, m.master.chaine]);
  // En quittant l'étape Son, on revient toujours au son masterisé.
  useEffect(() => () => (sansMastering.peek() ? comparerAB(false) : undefined), []);
  const actif = sansMastering.value;

  const appui = (e: PointerEvent) => {
    if (e.button !== 0) return;
    debut.current = performance.now();
    etaitActif.current = sansMastering.peek();
    if (!etaitActif.current) comparerAB(true);
  };
  const relache = () => {
    if (!debut.current) return;
    const duree = performance.now() - debut.current;
    debut.current = 0;
    // Appui court sur un bouton déjà enfoncé : on le relâche. Maintien : on revient au relâchement.
    if (etaitActif.current || duree >= MAINTIEN_MS) comparerAB(false);
  };

  return (
    <div class="ab-bloc">
      <button
        type="button"
        class="btn btn-contour btn-ab"
        aria-pressed={actif}
        aria-describedby="aide-ab"
        onPointerDown={appui}
        onPointerUp={relache}
        onPointerCancel={relache}
        onPointerLeave={() => debut.current && relache()}
        onClick={(e) => {
          // Clavier (Entrée, Espace) : simple bascule.
          if (e.detail === 0) comparerAB(!sansMastering.peek());
        }}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="ab"
      >
        <span class="ab-lettres" aria-hidden="true">
          A/B
        </span>
        <span>{actif ? T.son.abActif : T.son.ab}</span>
      </button>
      <p id="aide-ab" class="aide">
        {T.son.abAide}
      </p>
    </div>
  );
}
