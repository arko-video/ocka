// Effets de la voix en pastilles (Réverbe, Écho, Radio, Doubler, Autotune), avec un curseur pour Réverbe, Écho et
// Autotune (« Naturel ↔ Robot »). Ils s'écrivent dans Piste.effets de la piste voix ; le moteur les fait entendre.
// Autotune : badge « en préparation » tant que la correction calcule ; message si elle ne s'applique pas (repli).

import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { basculerEffet, effetActif, EFFETS, effetsVoix, NIVEAU_MIN, reglerNiveauEffet, type EffetNiveau } from '../../edition/effets';
import { modifier } from '../../etat';
import { forceAutotune, resumeAutotune } from '../../../moteur/api';
import { basculerAutotune, reglerAutotune, versionAutotune } from '../../voix';

const AVEC_CURSEUR: EffetNiveau[] = ['reverbe', 'echo'];

export function EffetsVoix({ m }: { m: Morceau }) {
  const e = effetsVoix(m);
  return (
    <section class="carte" aria-labelledby="titre-effets-voix" data-testid="effets-voix">
      <h2 id="titre-effets-voix" class="carte-titre">
        {T.voix.effets}
      </h2>
      <div class="pastilles-effets" role="group" aria-labelledby="titre-effets-voix" aria-describedby="aide-effets-voix">
        {EFFETS.map((effet) => (
          <button
            key={effet}
            type="button"
            class="pastille-effet"
            aria-pressed={effetActif(e, effet)}
            onClick={() => modifier((x) => basculerEffet(x, effet))}
            data-testid={`effet-${effet}`}
          >
            {T.voix.effetsNoms[effet]}
          </button>
        ))}
        <button type="button" class="pastille-effet" aria-pressed={forceAutotune(m) > 0} onClick={basculerAutotune} data-testid="effet-autotune">
          {T.voix.autotune}
        </button>
      </div>
      {AVEC_CURSEUR.filter((effet) => effetActif(e, effet)).map((effet) => {
        const v = e[effet] ?? 0;
        const nom = T.voix.effetsNoms[effet];
        return (
          <div class="reglage" key={effet}>
            <div class="reglage-tete">
              <label for={`niveau-${effet}`}>{T.voix.niveauEffet(nom)}</label>
              <span class="reglage-valeur chiffres">{Math.round(v * 100)} %</span>
            </div>
            <input
              id={`niveau-${effet}`}
              type="range"
              class="curseur"
              min={NIVEAU_MIN}
              max={1}
              step={0.01}
              value={v}
              aria-valuetext={`${Math.round(v * 100)} %`}
              onInput={(ev) => modifier((x) => reglerNiveauEffet(x, effet, ev.currentTarget.valueAsNumber), `effet:${effet}`)}
              data-testid={`effet-${effet}-niveau`}
            />
          </div>
        );
      })}
      <Autotune m={m} />
      <p id="aide-effets-voix" class="aide">
        {T.voix.effetsAide}
      </p>
    </section>
  );
}

function Autotune({ m }: { m: Morceau }) {
  const force = forceAutotune(m);
  void versionAutotune.value; // relu à chaque changement d'état de la correction
  if (force <= 0) return null;
  const etat = resumeAutotune(m);
  return (
    <div class="reglage" data-testid="reglage-autotune">
      <div class="reglage-tete">
        <label for="niveau-autotune">{T.voix.autotuneForce}</label>
        <span class="reglage-valeur chiffres">{Math.round(force * 100)} %</span>
      </div>
      <input
        id="niveau-autotune"
        type="range"
        class="curseur"
        min={0.1}
        max={1}
        step={0.1}
        value={force}
        aria-valuetext={`${Math.round(force * 100)} %`}
        onInput={(ev) => reglerAutotune(ev.currentTarget.valueAsNumber)}
        data-testid="effet-autotune-niveau"
      />
      <div class="reglage-tete aide" aria-hidden="true">
        <span>{T.voix.autotuneNaturel}</span>
        <span>{T.voix.autotuneRobot}</span>
      </div>
      {etat?.etat === 'calcul' && (
        <p class="badge" role="status" data-testid="autotune-preparation">
          {T.voix.autotunePreparation}
        </p>
      )}
      {etat?.etat === 'repli' && (
        <p class="message message-alerte" role="status" data-testid="autotune-repli">
          {T.voix.autotuneRepli(Math.round(etat.voisees * 100))}
        </p>
      )}
      {etat?.etat === 'erreur' && (
        <p class="message message-alerte" role="status" data-testid="autotune-erreur">
          {T.voix.autotuneErreur}
        </p>
      )}
      <p class="aide">{T.voix.autotuneAide}</p>
    </div>
  );
}
