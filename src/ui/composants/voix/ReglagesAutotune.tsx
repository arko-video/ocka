// Réglages fins de l'autotune d'une prise (« Avancé ») : vitesse (0–400 ms), force, humaniser, formants. Un curseur
// qui glisse = une seule étape d'Annuler (clé de fusion) ; le préréglage passe en « Perso ».

import type { AutotunePrise, Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { BORNES, reglerAutotune, type ReglageAutotune } from '../../edition/autotune';
import { modifier } from '../../etat';

const R = () => T.autotuneAvance.reglages;

const LIGNES: { champ: ReglageAutotune; nom: () => string; pas: number; aide?: () => string; valeur(v: number): string }[] = [
  { champ: 'vitesse', nom: () => R().vitesse, pas: 10, aide: () => R().vitesseAide, valeur: (v) => `${Math.round(v)} ms` },
  { champ: 'force', nom: () => R().force, pas: 0.05, valeur: (v) => `${Math.round(v * 100)} %` },
  { champ: 'humaniser', nom: () => R().humaniser, pas: 0.05, valeur: (v) => `${Math.round(v * 100)} %` },
  { champ: 'formants', nom: () => R().formants, pas: 0.5, aide: () => R().formantsAide, valeur: (v) => R().demiTons(v) },
];

export function ReglagesAutotune({ prise, a }: { prise: Prise; a: AutotunePrise }) {
  return (
    <div class="reglages-autotune" data-testid="autotune-reglages">
      {LIGNES.map((l) => {
        const v = a[l.champ];
        const id = `autotune-${l.champ}`;
        return (
          <div class="reglage" key={l.champ}>
            <div class="reglage-tete">
              <label for={id}>{l.nom()}</label>
              <span class="reglage-valeur chiffres">{l.valeur(v)}</span>
            </div>
            <input
              id={id}
              type="range"
              class="curseur"
              min={BORNES[l.champ].min}
              max={BORNES[l.champ].max}
              step={l.pas}
              value={v}
              aria-valuetext={l.valeur(v)}
              onInput={(e) => modifier((x) => reglerAutotune(x, prise.id, l.champ, e.currentTarget.valueAsNumber), `${id}:${prise.id}`)}
              data-testid={id}
            />
            {l.aide && <p class="aide">{l.aide()}</p>}
          </div>
        );
      })}
    </div>
  );
}
