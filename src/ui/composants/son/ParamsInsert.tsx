// Réglages d'un effet (réglage « Avancé ») : un curseur par réglage de PARAMS_EFFETS, en échelle log pour les
// fréquences ; le mode du filtre en 3 puces. Valeurs bornées par reglerInsert.

import { PARAMS_EFFETS, type Insert, type ReglageParam } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { reglerInsert, valeurParam } from '../../edition/mixage';
import { essayer } from './TrancheCompacte';

/** Position du curseur (0 à 1000) ↔ valeur, linéaire ou log. */
const PAS_CURSEUR = 1000;
function versCurseur(r: ReglageParam, v: number): number {
  const t = r.log && r.min > 0 ? Math.log(v / r.min) / Math.log(r.max / r.min) : (v - r.min) / (r.max - r.min);
  return Math.round(Math.max(0, Math.min(1, t)) * PAS_CURSEUR);
}
function depuisCurseur(r: ReglageParam, c: number): number {
  const t = c / PAS_CURSEUR;
  const v = r.log && r.min > 0 ? r.min * Math.pow(r.max / r.min, t) : r.min + t * (r.max - r.min);
  if (r.entier) return Math.round(v);
  const ordre = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return Math.round(v * 10 ** ordre) / 10 ** ordre;
}

function affichage(r: ReglageParam, v: number): string {
  if (r.unite === 'Hz') return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} k` : `${Math.round(v)}`;
  if (r.unite === '' && r.max <= 1 && r.min >= 0) return `${Math.round(v * 100)}`;
  const t = Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) >= 10 ? 0 : 1);
  return `${t.replace('.', ',')}${r.unite && r.unite !== 'x' ? '' : r.unite}`;
}

export function ParamsInsert({ idPiste, x }: { idPiste: string; x: Insert }) {
  const reglages = PARAMS_EFFETS[x.type];
  return (
    <div class="params-insert" data-testid={`params-${x.id}`}>
      {Object.entries(reglages).map(([cle, r]) => {
        const v = valeurParam(x, cle);
        const nom = T.melangeur.params[cle] ?? cle;
        const regler = (val: number) => essayer((m) => reglerInsert(m, idPiste, x.id, { params: { [cle]: val } }), `fx:${idPiste}:${x.id}:${cle}`);
        if (x.type === 'filtre' && cle === 'mode')
          return (
            <div key={cle} class="puces" role="radiogroup" aria-label={nom}>
              {T.melangeur.modesFiltre.map((t, i) => (
                <button key={i} type="button" role="radio" class="puce" aria-checked={v === i} onClick={() => regler(i)} data-testid={`param-${x.id}-mode-${i}`}>
                  {t}
                </button>
              ))}
            </div>
          );
        return (
          <label key={cle} class="tranche-ligne">
            <span class="tranche-label tranche-label-large">{nom}</span>
            <input
              type="range"
              class="curseur"
              min={0}
              max={PAS_CURSEUR}
              step={1}
              value={versCurseur(r, v)}
              aria-label={`${nom} (${r.unite || '%'})`}
              aria-valuetext={`${affichage(r, v)} ${r.unite}`}
              onInput={(e) => regler(depuisCurseur(r, e.currentTarget.valueAsNumber))}
              data-testid={`param-${x.id}-${cle}`}
            />
            <span class="tranche-valeur chiffres">{affichage(r, v)}</span>
          </label>
        );
      })}
    </div>
  );
}
