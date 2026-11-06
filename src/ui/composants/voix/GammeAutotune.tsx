// Gamme de l'autotune d'une prise : les 2 gammes détectées dans la voix (avec leur confiance), la gamme choisie si
// c'en est une autre, et « Changer » : celle du morceau, toutes les notes, ou une note de départ + Majeur / Mineur.

import { useState } from 'preact/hooks';
import { TONIQUES, hauteurTonique } from '../../../morceau/theorie';
import type { AutotunePrise, Mode, Morceau, Prise, Tonique } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { choisirGamme, memeGamme, type GammeAutotune as Gamme } from '../../edition/autotune';
import { modifier } from '../../etat';
import type { EtatAnalyse } from './autotune-etat';

const A = () => T.autotuneAvance;

export function nomTonalite(t: { tonique: Tonique; mode: Mode }): string {
  return A().nomGamme(T.melodie.notes[hauteurTonique(t.tonique)]!, t.mode);
}

export function nomGamme(g: Gamme, m: Morceau): string {
  if (g === 'chromatique') return A().chromatique;
  if (g === 'morceau') return A().gammeMorceau(nomTonalite(m.tonalite));
  return nomTonalite(g);
}

interface Props {
  m: Morceau;
  prise: Prise;
  a: AutotunePrise;
  analyse: EtatAnalyse | undefined;
}

export function GammeAutotune({ m, prise, a, analyse }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const choisir = (g: Gamme) => modifier((x) => choisirGamme(x, prise.id, g));
  const detectees = analyse?.etat === 'pret' ? analyse.gammes.slice(0, 2) : [];
  const dansDetectees = detectees.some((d) => memeGamme(d, a.gamme));
  const perso = typeof a.gamme === 'string' ? null : a.gamme;

  return (
    <div class="reglage" data-testid="autotune-gamme">
      <div class="reglage-tete">
        <span class="reglage-label" id="label-gamme-autotune">
          {A().gamme}
        </span>
        <button type="button" class="lien-gamme" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)} data-testid="autotune-gamme-changer">
          {ouvert ? A().fermerChoix : A().changer}
        </button>
      </div>
      <div class="puces puces-gamme" role="radiogroup" aria-labelledby="label-gamme-autotune">
        {detectees.map((d, k) => (
          <button
            key={`${d.tonique}${d.mode}`}
            type="button"
            role="radio"
            class="puce"
            aria-checked={memeGamme(d, a.gamme)}
            onClick={() => choisir({ tonique: d.tonique, mode: d.mode })}
            data-testid={`autotune-gamme-detectee-${k}`}
          >
            {nomTonalite(d)} <span class="puce-detail">{Math.round(d.confiance * 100)} %</span>
          </button>
        ))}
        {!dansDetectees && (
          <button type="button" role="radio" class="puce puce-gamme-choisie" aria-checked={true} data-testid="autotune-gamme-choisie">
            {nomGamme(a.gamme, m)}
          </button>
        )}
      </div>
      {analyse?.etat === 'calcul' && <p class="aide">{A().gammeCherche}</p>}
      {detectees.length > 0 && !ouvert && <p class="aide">{A().gammeAide}</p>}

      {ouvert && (
        <div class="choix-gamme" data-testid="autotune-choix-gamme">
          <div class="segments">
            {(['morceau', 'chromatique'] as const).map((g) => (
              <button key={g} type="button" class="segment" aria-pressed={a.gamme === g} onClick={() => choisir(g)} data-testid={`autotune-gamme-${g}`}>
                {g === 'morceau' ? A().gammeMorceau(nomTonalite(m.tonalite)) : A().chromatique}
              </button>
            ))}
          </div>
          <label class="champ">
            <span class="champ-label">{A().tonique}</span>
            <select
              class="champ-texte"
              value={perso?.tonique ?? m.tonalite.tonique}
              onChange={(e) => choisir({ tonique: e.currentTarget.value as Tonique, mode: perso?.mode ?? m.tonalite.mode })}
              data-testid="autotune-gamme-tonique"
            >
              {TONIQUES.map((t) => (
                <option key={t} value={t}>
                  {T.melodie.notes[hauteurTonique(t)]}
                </option>
              ))}
            </select>
          </label>
          <div class="segments" role="radiogroup" aria-label={A().mode}>
            {(['majeur', 'mineur'] as const).map((mo) => (
              <button
                key={mo}
                type="button"
                role="radio"
                class="segment"
                aria-checked={perso?.mode === mo}
                onClick={() => choisir({ tonique: perso?.tonique ?? m.tonalite.tonique, mode: mo })}
                data-testid={`autotune-gamme-${mo}`}
              >
                {A().modes[mo]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
