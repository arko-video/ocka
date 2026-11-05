// Étape 4 — Son : volume, panoramique, muet et solo par piste ; master (couleur, colle, A/B, niveau, fondu).

import type { IdPiste, Morceau } from '../../morceau/types';
import { T } from '../../textes-fr';
import { reglerPiste } from '../edition/reglages';
import { modifier, morceau } from '../etat';
import { Master } from '../composants/son/Master';

/** Pistes affichées : la mélodie et tes sons seulement quand le morceau s'en sert. */
function pistesUtiles(m: Morceau): IdPiste[] {
  const melodie = m.sections.some((s) => s.motifs.melodie && m.motifs[s.motifs.melodie]?.type === 'melodie');
  const sons = (m.sons?.length ?? 0) > 0;
  return (['batterie', 'basse', 'accords', 'melodie', 'sons', 'voix'] as const).filter(
    (id) => (id !== 'melodie' || melodie) && (id !== 'sons' || sons),
  );
}

export function Son() {
  const m = morceau.value;
  if (!m) return null;
  return (
    <div class="etape-son">
      <section aria-labelledby="titre-pistes">
        <h2 id="titre-pistes" class="sous-titre">
          {T.son.pistes}
        </h2>
        <div class="liste-pistes">
          {pistesUtiles(m).map((id) => {
            const p = m.pistes.find((x) => x.id === id) ?? { id, volume: 0.8, pan: 0, muet: false, solo: false };
            const nom = T.son.noms[id];
            return (
              <div class="carte piste" key={id} data-muet={p.muet ? '1' : '0'} data-testid={`piste-${id}`}>
                <div class="piste-tete">
                  <h3 class="piste-nom">{nom}</h3>
                  <button
                    type="button"
                    class="btn-bascule btn-ms"
                    aria-pressed={p.muet}
                    aria-label={`${T.son.muet} ${nom}`}
                    onClick={() => modifier((x) => reglerPiste(x, id, { muet: !p.muet }))}
                    data-testid={`muet-${id}`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    class="btn-bascule btn-ms"
                    data-solo="1"
                    aria-pressed={p.solo}
                    aria-label={`${T.son.solo} ${nom}`}
                    onClick={() => modifier((x) => reglerPiste(x, id, { solo: !p.solo }))}
                    data-testid={`solo-${id}`}
                  >
                    S
                  </button>
                </div>
                <label class="curseur-ligne">
                  <span class="curseur-label">{T.son.volume}</span>
                  <input
                    type="range"
                    class="curseur"
                    min={0}
                    max={1.5}
                    step={0.01}
                    value={p.volume}
                    aria-label={`${T.son.volume} ${nom}`}
                    aria-valuetext={`${Math.round(p.volume * 100)} %`}
                    onInput={(e) => modifier((x) => reglerPiste(x, id, { volume: e.currentTarget.valueAsNumber }), `vol:${id}`)}
                    data-testid={`volume-${id}`}
                  />
                  <span class="curseur-valeur chiffres">{Math.round(p.volume * 100)}</span>
                </label>
                <label class="curseur-ligne">
                  <span class="curseur-label">{T.son.pan}</span>
                  <input
                    type="range"
                    class="curseur curseur-centre"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={p.pan}
                    aria-label={`${T.son.pan} ${nom}`}
                    aria-valuetext={p.pan === 0 ? 'centre' : `${Math.round(Math.abs(p.pan) * 100)} % ${p.pan < 0 ? 'gauche' : 'droite'}`}
                    onInput={(e) => modifier((x) => reglerPiste(x, id, { pan: e.currentTarget.valueAsNumber }), `pan:${id}`)}
                    onDblClick={() => modifier((x) => reglerPiste(x, id, { pan: 0 }))}
                    data-testid={`pan-${id}`}
                  />
                  <span class="curseur-valeur chiffres">
                    {p.pan === 0 ? 'C' : `${p.pan < 0 ? T.son.gauche : T.son.droite}${Math.round(Math.abs(p.pan) * 100)}`}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <Master m={m} />
    </div>
  );
}
