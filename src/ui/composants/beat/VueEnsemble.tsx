// Vue d'ensemble du motif : une ligne de petites cases par instrument (tes sons compris), le pas courant
// allumé pendant la lecture. L'instrument se choisit avec les puces juste en dessous (zones de toucher de 44 px).

import type { InstrumentBatterie, MotifBatterie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { etatCase, ligne, ligneRoulements } from '../../edition/batterie';
import { pasDansMotif } from '../../lecture';

interface Props {
  motif: MotifBatterie;
  instruments: InstrumentBatterie[];
  noms: Record<InstrumentBatterie, string>;
  choisi: InstrumentBatterie;
}

export function VueEnsemble({ motif, instruments, noms, choisi }: Props) {
  const pas = pasDansMotif(motif.pas);
  return (
    <div class="ensemble" role="img" aria-label={T.beat.ensemble} data-testid="vue-ensemble">
      {instruments.map((inst) => {
        const vels = ligne(motif, inst);
        const rouls = ligneRoulements(motif, inst);
        return (
          <div key={inst} class="ensemble-ligne" data-choisi={inst === choisi ? '1' : '0'} data-testid={`ensemble-${inst}`}>
            <span class="ensemble-nom">{noms[inst]}</span>
            <span class="ensemble-cases" style={{ gridTemplateColumns: `repeat(${motif.pas}, minmax(0, 1fr))` }}>
              {vels.map((v, i) => (
                <i
                  key={i}
                  data-etat={etatCase(v)}
                  data-roul={rouls[i] ? '1' : '0'}
                  data-courant={i === pas ? '1' : '0'}
                  data-temps={i % 4 === 0 ? '1' : '0'}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
