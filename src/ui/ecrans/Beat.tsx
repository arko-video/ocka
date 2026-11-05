// Étape 1 — Beat : bascule « Batterie | Mélodie ». Batterie : motif, « Varier », vue d'ensemble, instruments,
// « + Ton son », pads 4×4, réglages. Mélodie : 8 pads de la gamme, « Enregistrer au clavier », grille simple.

import { T } from '../../textes-fr';
import { morceau, vueBeat } from '../etat';
import { VueBatterie } from '../composants/beat/VueBatterie';
import { VueMelodie } from '../composants/melodie/VueMelodie';

export function Beat() {
  const m = morceau.value;
  if (!m) return null;
  const vue = vueBeat.value;
  return (
    <div class="etape-beat">
      <div class="bascule-vue" role="group" aria-label={T.beat.vue}>
        {(['batterie', 'melodie'] as const).map((v) => (
          <button
            key={v}
            type="button"
            class="bascule-vue-bouton"
            aria-pressed={vue === v}
            onClick={() => (vueBeat.value = v)}
            data-testid={`vue-${v}`}
          >
            {v === 'batterie' ? T.beat.vueBatterie : T.beat.vueMelodie}
          </button>
        ))}
      </div>
      {vue === 'batterie' ? <VueBatterie m={m} /> : <VueMelodie m={m} />}
    </div>
  );
}
