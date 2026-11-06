// Panneau « Réglages avancés » : l'interrupteur « Avancé » (désactivé par défaut). Contrat C0 (intégrateur).
// Le bouton qui l'ouvre (ouvrirPanneau(PANNEAUX.avance)) est posé en C1 par U2 (écran Son).

import { T } from '../../textes-fr';
import { modeAvance, PANNEAUX, reglerAvance } from '../etat';
import { Panneau } from './Panneau';

export function ReglagesAvance() {
  return (
    <Panneau id={PANNEAUX.avance} titre={T.avance.titre} testid="panneau-avance">
      <label class="case">
        <input type="checkbox" checked={modeAvance.value} onChange={(e) => reglerAvance(e.currentTarget.checked)} data-testid="mode-avance" />
        <span>{T.avance.interrupteur}</span>
      </label>
      <p class="aide">{T.avance.aide}</p>
    </Panneau>
  );
}
