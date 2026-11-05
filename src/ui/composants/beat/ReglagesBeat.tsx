// Réglages du beat : tempo (curseur + champ), swing, 3 suites d'accords, basse activée ou non.

import { suitesAccords } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { activerBasse, basseActive, choisirAccords, reglerSwing, reglerTempo, suiteActive } from '../../edition/reglages';
import { modifier, morceau } from '../../etat';

export function ReglagesBeat() {
  const m = morceau.value;
  if (!m) return null;
  let suites: ReturnType<typeof suitesAccords> = [];
  try {
    suites = suitesAccords(m.style);
  } catch (e) {
    console.error(e);
  }
  const active = suiteActive(m, suites);
  const basse = basseActive(m);
  return (
    <section class="carte" aria-labelledby="titre-reglages-beat">
      <h2 id="titre-reglages-beat" class="carte-titre">
        {T.beat.reglages}
      </h2>

      <div class="reglage">
        <div class="reglage-tete">
          <label for="tempo-curseur">{T.beat.tempo}</label>
          <span class="reglage-valeur">
            <input
              type="number"
              class="champ-nombre chiffres"
              min={60}
              max={200}
              value={m.tempo}
              aria-label={`${T.beat.tempo} (${T.beat.tempoUnite})`}
              onChange={(e) => modifier((x) => reglerTempo(x, e.currentTarget.valueAsNumber))}
              data-testid="tempo-champ"
            />
            {T.beat.tempoUnite}
          </span>
        </div>
        <input
          id="tempo-curseur"
          type="range"
          class="curseur"
          min={60}
          max={200}
          step={1}
          value={m.tempo}
          onInput={(e) => modifier((x) => reglerTempo(x, e.currentTarget.valueAsNumber), 'tempo')}
          data-testid="tempo"
        />
      </div>

      <div class="reglage">
        <div class="reglage-tete">
          <label for="swing">{T.beat.swing}</label>
          <span class="reglage-valeur chiffres">{Math.round(m.swing * 100)} %</span>
        </div>
        <input
          id="swing"
          type="range"
          class="curseur"
          min={0}
          max={0.6}
          step={0.01}
          value={m.swing}
          aria-describedby="aide-swing"
          aria-valuetext={`${Math.round(m.swing * 100)} %`}
          onInput={(e) => modifier((x) => reglerSwing(x, e.currentTarget.valueAsNumber), 'swing')}
          data-testid="swing"
        />
        <p id="aide-swing" class="aide">
          {T.beat.swingAide}
        </p>
      </div>

      {suites.length > 0 && (
        <div class="reglage">
          <span class="reglage-label" id="label-accords">
            {T.beat.accords}
          </span>
          <div class="puces puces-colonne" role="radiogroup" aria-labelledby="label-accords">
            {suites.map((s, i) => (
              <button
                key={s.nom}
                type="button"
                role="radio"
                aria-checked={i === active}
                class="puce puce-large"
                onClick={() => modifier((x) => choisirAccords(x, s.motif))}
                data-testid={`accords-${i}`}
              >
                <span class="puce-nom">{s.nom}</span>
                <span class="puce-detail">{s.motif.accords.map((a) => a.degre).join(' · ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label class="interrupteur">
        <span>
          <span class="reglage-label">{T.beat.basse}</span>
          <span class="aide">{T.beat.basseAide}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={basse}
          onChange={(e) => modifier((x) => activerBasse(x, e.currentTarget.checked))}
          data-testid="basse"
        />
      </label>
    </section>
  );
}
