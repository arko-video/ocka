// Carte « Master » de l'étape Son : couleur (4 pastilles), Colle (chaîne 2) ou « Passer au nouveau son »
// (chaîne 1), bouton A/B, niveau d'export et fondu de fin.

import type { Master as MasterMorceau, Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { reglerChaine } from '../../edition/effets';
import { reglerFondu, reglerMaster } from '../../edition/reglages';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { BoutonAB } from './BoutonAB';

const PRESETS: MasterMorceau['preset'][] = ['neutre', 'chaud', 'clair', 'lofi'];
const NIVEAUX: MasterMorceau['niveau'][] = ['standard', 'fort'];

function Colle({ m }: { m: Morceau }) {
  if (m.master.chaine !== 2)
    return (
      <div class="ancien-son" data-testid="ancien-son">
        <span class="reglage-label">{T.son.colle}</span>
        <p class="aide">{T.son.ancienSon}</p>
        <button
          type="button"
          class="btn btn-contour"
          onClick={() => {
            if (modifier((x) => reglerChaine(x, 2))) afficherToast(T.son.passe, 5000, { label: T.annuler, agir: annulerAction });
          }}
          data-testid="passer-chaine-2"
        >
          {T.son.passer}
        </button>
      </div>
    );
  return (
    <label class="interrupteur">
      <span>
        <span class="reglage-label">{T.son.colle}</span>
        <span class="aide">{T.son.colleAide}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked
        onChange={(e) => modifier((x) => reglerChaine(x, e.currentTarget.checked ? 2 : 1))}
        data-testid="colle"
      />
    </label>
  );
}

export function Master({ m }: { m: Morceau }) {
  return (
    <section class="carte" aria-labelledby="titre-master">
      <h2 id="titre-master" class="carte-titre">
        {T.son.master}
      </h2>
      <span class="reglage-label" id="label-couleur">
        {T.son.couleur}
      </span>
      <div class="grille-choix grille-4" role="radiogroup" aria-labelledby="label-couleur">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={m.master.preset === p}
            class="choix"
            onClick={() => modifier((x) => reglerMaster(x, { preset: p }))}
            data-testid={`master-${p}`}
          >
            {T.son.presets[p]}
          </button>
        ))}
      </div>

      <Colle m={m} />
      <BoutonAB m={m} />

      <span class="reglage-label" id="label-niveau">
        {T.son.niveau}
      </span>
      <div class="niveaux" role="radiogroup" aria-labelledby="label-niveau">
        {NIVEAUX.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={m.master.niveau === n}
            class="carte-niveau"
            onClick={() => modifier((x) => reglerMaster(x, { niveau: n }))}
            data-testid={`niveau-${n}`}
          >
            <span class="carte-niveau-tete">
              <span class="carte-niveau-nom">{T.son.niveaux[n].nom}</span>
              <span class="chiffres doux">{T.son.niveaux[n].detail}</span>
            </span>
            <span class="aide">{T.son.niveaux[n].aide}</span>
          </button>
        ))}
      </div>

      <div class="reglage">
        <div class="reglage-tete">
          <label for="fondu">{T.son.fondu}</label>
          <span class="reglage-valeur chiffres">{T.son.secondes(m.fondu ?? 0)}</span>
        </div>
        <input
          id="fondu"
          type="range"
          class="curseur"
          min={0}
          max={8}
          step={0.5}
          value={m.fondu ?? 0}
          aria-valuetext={T.son.secondes(m.fondu ?? 0)}
          onInput={(e) => modifier((x) => reglerFondu(x, e.currentTarget.valueAsNumber), 'fondu')}
          data-testid="fondu"
        />
      </div>
    </section>
  );
}
