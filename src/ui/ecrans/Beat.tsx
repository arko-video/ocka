// Étape 1 — Beat : bascule « Batterie | Instruments » (v2). Batterie : motif, « Varier », vue d'ensemble, instruments,
// « + Ton son », pads 4×4, réglages. Instruments : la vue Pistes (U1) ; en attendant, la mélodie (8 pads de la gamme,
// « Enregistrer au clavier », grille simple). L'ancien data-testid « vue-melodie » reste, en alias (dans le bouton).

import { T } from '../../textes-fr';
import { morceau, vueBeat } from '../etat';
import { VueBatterie } from '../composants/beat/VueBatterie';
import { VueInstruments } from '../composants/pistes/VueInstruments';

export function Beat() {
  const m = morceau.value;
  if (!m) return null;
  const vue = vueBeat.value;
  return (
    <div class="etape-beat">
      <div class="bascule-vue" role="group" aria-label={T.beat.vue}>
        {(['batterie', 'instruments'] as const).map((v) => (
          <button
            key={v}
            type="button"
            class="bascule-vue-bouton"
            aria-pressed={vue === v}
            onClick={() => (vueBeat.value = v)}
            data-testid={`vue-${v}`}
          >
            {v === 'batterie' ? T.beat.vueBatterie : <span data-testid="vue-melodie">{T.pistes.vueInstruments}</span>}
          </button>
        ))}
      </div>
      {vue === 'batterie' ? <VueBatterie m={m} /> : <VueInstruments m={m} />}
    </div>
  );
}
