// Étape 4 — Son : une tranche compacte par piste (M/S, fader, pan, « Effets (n) », « Pompe »), le bouton des
// réglages avancés, puis le master (couleur, colle, A/B, niveau, fondu).

import { estPisteInstrument, pisteAUnMotif } from '../../morceau/acces';
import type { Morceau, Piste } from '../../morceau/types';
import { T } from '../../textes-fr';
import { modeAvance, morceau, PANNEAUX } from '../etat';
import { ouvrirPanneau } from '../navigation';
import { EntreesSon } from '../composants/EntreesC3';
import { Master } from '../composants/son/Master';
import { TrancheCompacte } from '../composants/son/TrancheCompacte';
import '../composants/son/melangeur.css';

/** Pistes affichées, dans l'ordre du morceau : les pistes instrument et tes sons seulement quand le morceau s'en sert. */
function pistesUtiles(m: Morceau): Piste[] {
  const sons = (m.sons?.length ?? 0) > 0;
  return m.pistes.filter((p) => (estPisteInstrument(p) ? pisteAUnMotif(m, p.id) || (p.inserts?.length ?? 0) > 0 : p.id !== 'sons' || sons));
}

export function Son() {
  const m = morceau.value;
  if (!m) return null;
  return (
    <div class="etape-son">
      <section aria-labelledby="titre-pistes">
        <div class="son-entete">
          <h2 id="titre-pistes" class="sous-titre">
            {T.son.pistes}
          </h2>
          <button type="button" class="btn-bascule" aria-pressed={modeAvance.value} onClick={() => ouvrirPanneau(PANNEAUX.avance)} data-testid="ouvrir-avance">
            {T.frise.ouvrirAvance}
          </button>
          <EntreesSon />
        </div>
        <div class="liste-pistes">
          {pistesUtiles(m).map((p) => (
            <TrancheCompacte key={p.id} m={m} p={p} />
          ))}
        </div>
      </section>

      <Master m={m} />
    </div>
  );
}
