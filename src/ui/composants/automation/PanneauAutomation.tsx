// Panneau d'automation d'une piste (frise, « Avancé ») : la cible dessinée dans le couloir (volume, pan, hauteur ou
// réglage d'un effet), effacer la courbe, et les 2 LFO (forme, période en pas, profondeur, cible).

import { pisteDe } from '../../../morceau/acces';
import { FORMES_LFO, type Cible, type Lfo, type Piste } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { ciblesPossibles, cleCible, effacerCourbe, memeCible, reglerLfo } from '../../edition/automation';
import { modifier, morceau } from '../../etat';
import { toastErreur } from '../../lecture';
import { Panneau } from '../Panneau';
import './automation.css';
import { nomPiste } from '../frise/apercu';
import { choisirCibleCouloir, couloirs, PANNEAUX_FRISE, pisteAutomation } from '../frise/etat-frise';

const PERIODES = [1, 2, 4, 8, 16, 32, 64] as const;

/** Nom affiché d'une cible (« Volume », « Saturation · Force »). */
export function nomCible(p: Piste, c: Cible): string {
  if (c.type !== 'insert') return T.automation[c.type];
  const x = p.inserts?.find((i) => i.id === c.insert);
  return `${x ? T.effets.noms[x.type] : c.insert} · ${T.melangeur.params[c.param] ?? c.param}`;
}

function essayer(op: Parameters<typeof modifier>[0], cle?: string) {
  try {
    modifier(op, cle);
  } catch (e) {
    toastErreur(e);
  }
}

function ReglageLfo({ p, indice, l, cibles }: { p: Piste; indice: 0 | 1; l: Lfo; cibles: Cible[] }) {
  const regler = (c: Partial<Lfo>, cle?: string) => essayer((x) => reglerLfo(x, p.id, indice, { ...l, ...c }), cle);
  return (
    <div class="carte lfo" data-testid={`lfo-${indice}`}>
      <div class="lfo-tete">
        <h4 class="reglage-label">{T.automation.lfoTitre(indice + 1)}</h4>
        <button type="button" class="btn btn-discret btn-petit" onClick={() => essayer((x) => reglerLfo(x, p.id, indice, null))} data-testid={`lfo-retirer-${indice}`}>
          {T.automation.lfoRetirer}
        </button>
      </div>
      <label class="curseur-ligne">
        <span class="curseur-label">{T.automation.cible}</span>
        <select
          class="champ-texte champ-lfo"
          value={cleCible(l.cible)}
          onChange={(e) => {
            const c = cibles.find((x) => cleCible(x) === e.currentTarget.value);
            if (c) regler({ cible: c });
          }}
          data-testid={`lfo-cible-${indice}`}
        >
          {cibles.map((c) => (
            <option key={cleCible(c)} value={cleCible(c)}>
              {nomCible(p, c)}
            </option>
          ))}
        </select>
      </label>
      <div class="puces puces-defile" role="radiogroup" aria-label={T.automation.forme}>
        {FORMES_LFO.map((f) => (
          <button key={f} type="button" role="radio" class="puce" aria-checked={l.forme === f} onClick={() => regler({ forme: f })} data-testid={`lfo-forme-${indice}-${f}`}>
            {T.automation.formes[f]}
          </button>
        ))}
      </div>
      <div class="puces puces-defile" role="radiogroup" aria-label={T.automation.periode}>
        {PERIODES.map((n) => (
          <button key={n} type="button" role="radio" class="puce" aria-checked={l.periode === n} onClick={() => regler({ periode: n })} data-testid={`lfo-periode-${indice}-${n}`}>
            {T.automation.periodePas(n)}
          </button>
        ))}
      </div>
      <label class="curseur-ligne">
        <span class="curseur-label">{T.automation.profondeur}</span>
        <input type="range" class="curseur" min={0} max={1} step={0.01} value={l.profondeur} onInput={(e) => regler({ profondeur: e.currentTarget.valueAsNumber }, `lfo-p:${p.id}:${indice}`)} data-testid={`lfo-profondeur-${indice}`} />
        <span class="curseur-valeur chiffres">{Math.round(l.profondeur * 100)}</span>
      </label>
      <label class="curseur-ligne">
        <span class="curseur-label">{T.automation.phase}</span>
        <input type="range" class="curseur" min={0} max={1} step={0.05} value={l.phase} onInput={(e) => regler({ phase: e.currentTarget.valueAsNumber }, `lfo-ph:${p.id}:${indice}`)} />
        <span class="curseur-valeur chiffres">{Math.round(l.phase * 360)}°</span>
      </label>
    </div>
  );
}

export function PanneauAutomation() {
  const m = morceau.value;
  const id = pisteAutomation.value;
  const p = m && id ? pisteDe(m, id) : undefined;
  if (!m || !p) return null;
  const cibles = ciblesPossibles(p);
  const cible = couloirs.value[p.id] ?? { type: 'volume' };
  const lfos = p.lfo ?? [];
  const aCourbe = (p.auto ?? []).some((c) => memeCible(c.cible, cible));
  return (
    <Panneau id={PANNEAUX_FRISE.automation} titre={T.frise.automationDe(nomPiste(p))} testid="panneau-automation">
      <h3 class="sous-titre">{T.automation.choisirCible}</h3>
      <div class="puces" role="radiogroup" aria-label={T.automation.cible}>
        {cibles.map((c) => (
          <button key={cleCible(c)} type="button" role="radio" class="puce" aria-checked={memeCible(c, cible)} onClick={() => choisirCibleCouloir(p.id, c)} data-testid={`cible-${cleCible(c)}`}>
            {nomCible(p, c)}
          </button>
        ))}
      </div>
      <p class="aide">{T.automation.aide}</p>
      <button type="button" class="btn btn-discret" disabled={!aCourbe} onClick={() => essayer((x) => effacerCourbe(x, p.id, cible, null))} data-testid="effacer-courbe">
        {T.automation.effacer}
      </button>

      <h3 class="sous-titre">{T.melangeur.lfo}</h3>
      {lfos.length === 0 && <p class="aide">{T.automation.lfoAucun}</p>}
      {lfos.map((l, i) => (
        <ReglageLfo key={i} p={p} indice={i as 0 | 1} l={l} cibles={cibles} />
      ))}
      {lfos.length < 2 && (
        <button
          type="button"
          class="btn btn-contour"
          onClick={() => essayer((x) => reglerLfo(x, p.id, lfos.length as 0 | 1, { cible, forme: 'sinus', periode: 16, profondeur: 0.5, phase: 0 }))}
          data-testid="lfo-ajouter"
        >
          {T.automation.lfoAjouter}
        </button>
      )}
    </Panneau>
  );
}
