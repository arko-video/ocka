// Réglages de « Chanter » : voix grave ou aiguë, calage (gamme du morceau ou toutes les notes), accords (triade ou
// septième), glissé, volume qui suit la voix. Gardés pour la séance (signal), appliqués en direct (reglerDirect).

import { signal } from '@preact/signals';
import type { ReglagesDirect } from '../../../moteur/api';
import { hauteurTonique } from '../../../morceau/theorie';
import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';

/** Glissé « allumé » : 120 ms. */
export const GLISSE_ON = 120;

export type ReglagesChant = Omit<ReglagesDirect, 'piste'>;
export const reglagesChant = signal<ReglagesChant>({
  calage: 'gamme',
  mode: 'grave',
  glisse: 0,
  accords: null,
  suivreVolume: true,
});

interface Props {
  tonalite: Morceau['tonalite'];
  changer: (r: Partial<ReglagesChant>) => void;
}

function Segments<V extends string>(props: {
  id: string;
  titre: string;
  valeur: V;
  choix: [V, string][];
  changer: (v: V) => void;
}) {
  return (
    <>
      <p class="dubler-etiquette" id={props.id}>
        {props.titre}
      </p>
      <div class="segments" role="radiogroup" aria-labelledby={props.id}>
        {props.choix.map(([v, nom]) => (
          <button
            key={v}
            type="button"
            role="radio"
            class="segment"
            aria-checked={props.valeur === v}
            onClick={() => props.changer(v)}
            data-testid={`${props.id}-${v}`}
          >
            {nom}
          </button>
        ))}
      </div>
    </>
  );
}

function Interrupteur(props: {
  titre: string;
  aide?: string;
  actif: boolean;
  changer: (v: boolean) => void;
  testid: string;
}) {
  return (
    <label class="interrupteur">
      <span>
        <span class="reglage-label">{props.titre}</span>
        {props.aide && <span class="aide">{props.aide}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.actif}
        onChange={(e) => props.changer(e.currentTarget.checked)}
        data-testid={props.testid}
      />
    </label>
  );
}

export function ReglagesChanter({ tonalite, changer }: Props) {
  const r = reglagesChant.value;
  const gamme = `${T.melodie.notes[hauteurTonique(tonalite.tonique)]} ${tonalite.mode}`;
  return (
    <div class="dubler-reglages">
      <Interrupteur
        titre={T.chanter.accords}
        aide={T.chanter.accordsAide}
        actif={r.accords !== null}
        changer={(v) => changer({ accords: v ? { type: 'triade' } : null })}
        testid="chanter-accords"
      />
      {r.accords && (
        <div class="segments" role="radiogroup" aria-label={T.chanter.accords}>
          {(['triade', 'septieme'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              class="segment"
              aria-checked={r.accords?.type === t}
              onClick={() => changer({ accords: { type: t } })}
              data-testid={`chanter-accord-${t}`}
            >
              {t === 'triade' ? T.chanter.triade : T.chanter.septieme}
            </button>
          ))}
        </div>
      )}
      <Interrupteur
        titre={T.chanter.glisse}
        aide={T.chanter.glisseAide}
        actif={r.glisse > 0}
        changer={(v) => changer({ glisse: v ? GLISSE_ON : 0 })}
        testid="chanter-glisse"
      />
      <Segments
        id="chanter-calage"
        titre={T.chanter.calage.titre}
        valeur={r.calage}
        choix={[
          ['gamme', T.chanter.calage.gamme(gamme)],
          ['chromatique', T.chanter.calage.chromatique],
        ]}
        changer={(calage) => changer({ calage })}
      />
      <Segments
        id="chanter-voix"
        titre={T.chanter.voix.titre}
        valeur={r.mode}
        choix={[
          ['grave', T.chanter.voix.grave],
          ['aigu', T.chanter.voix.aigu],
        ]}
        changer={(mode) => changer({ mode })}
      />
      <p class="aide">{T.chanter.voix.aide}</p>
      <Interrupteur
        titre={T.chanter.volume}
        actif={r.suivreVolume}
        changer={(suivreVolume) => changer({ suivreVolume })}
        testid="chanter-volume"
      />
    </div>
  );
}
