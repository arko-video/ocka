// Tranche compacte d'une piste (écran Son) : nom, « Effets (n) », M/S, fader, pan, et « Pompe » (sidechain sur le
// kick : interrupteur + force). Les data-testid de la phase 1 sont gardés (piste-, muet-, solo-, volume-, pan-).

import type { Morceau, Piste } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { nombreEffets, reglerSidechain, reglerTranche, SIDECHAIN_DEFAUT } from '../../edition/mixage';
import { modifier } from '../../etat';
import { toastErreur } from '../../lecture';
import { ouvrirEffets } from '../../navigation';
import { couleurPiste, nomPiste } from '../frise/apercu';

export function essayer(op: Parameters<typeof modifier>[0], cle?: string) {
  try {
    modifier(op, cle);
  } catch (e) {
    toastErreur(e);
  }
}

export function TrancheCompacte({ m, p }: { m: Morceau; p: Piste }) {
  const id = p.id;
  const nom = nomPiste(p);
  const n = nombreEffets(p);
  const pompe = p.sidechain;
  return (
    <div class="carte tranche" style={{ '--c': couleurPiste(m, p) }} data-muet={p.muet ? '1' : '0'} data-testid={`piste-${id}`}>
      <div class="tranche-tete">
        <h3 class="tranche-nom texte-coupe">{nom}</h3>
        <button type="button" class="btn-bascule tranche-effets" data-actif={n > 0 ? '1' : '0'} onClick={() => ouvrirEffets(id)} data-testid={`effets-${id}`}>
          {T.effets.titre(n)}
        </button>
        <button
          type="button"
          class="btn-bascule btn-ms"
          aria-pressed={p.muet}
          aria-label={`${T.son.muet} ${nom}`}
          onClick={() => essayer((x) => reglerTranche(x, id, { muet: !p.muet }))}
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
          onClick={() => essayer((x) => reglerTranche(x, id, { solo: !p.solo }))}
          data-testid={`solo-${id}`}
        >
          S
        </button>
      </div>
      <label class="tranche-ligne">
        <span class="tranche-label">{T.melangeur.vol}</span>
        <input
          type="range"
          class="curseur"
          min={0}
          max={1.5}
          step={0.01}
          value={p.volume}
          aria-label={`${T.son.volume} ${nom}`}
          aria-valuetext={`${Math.round(p.volume * 100)} %`}
          onInput={(e) => essayer((x) => reglerTranche(x, id, { volume: e.currentTarget.valueAsNumber }), `vol:${id}`)}
          data-testid={`volume-${id}`}
        />
        <span class="tranche-valeur chiffres">{Math.round(p.volume * 100)}</span>
      </label>
      <div class="tranche-ligne">
        <label class="tranche-pan">
          <span class="tranche-label">{T.melangeur.pan}</span>
          <input
            type="range"
            class="curseur curseur-centre"
            min={-1}
            max={1}
            step={0.05}
            value={p.pan}
            aria-label={`${T.son.pan} ${nom}`}
            aria-valuetext={p.pan === 0 ? 'centre' : `${Math.round(Math.abs(p.pan) * 100)} % ${p.pan < 0 ? 'gauche' : 'droite'}`}
            onInput={(e) => essayer((x) => reglerTranche(x, id, { pan: e.currentTarget.valueAsNumber }), `pan:${id}`)}
            onDblClick={() => essayer((x) => reglerTranche(x, id, { pan: 0 }))}
            data-testid={`pan-${id}`}
          />
          <span class="tranche-valeur chiffres">{p.pan === 0 ? 'C' : `${p.pan < 0 ? T.son.gauche : T.son.droite}${Math.round(Math.abs(p.pan) * 100)}`}</span>
        </label>
        {id !== 'batterie' && (
          <button
            type="button"
            class="btn-bascule tranche-pompe"
            aria-pressed={!!pompe}
            title={T.effets.pompeAide}
            onClick={() => essayer((x) => reglerSidechain(x, id, pompe ? null : SIDECHAIN_DEFAUT))}
            data-testid={`pompe-${id}`}
          >
            {T.effets.pompe}
          </button>
        )}
      </div>
      {pompe && (
        <label class="tranche-ligne">
          <span class="tranche-label">{T.melangeur.pompeForce}</span>
          <input
            type="range"
            class="curseur"
            min={0}
            max={1}
            step={0.01}
            value={pompe.force}
            aria-label={`${T.effets.pompe} ${nom}`}
            onInput={(e) => essayer((x) => reglerSidechain(x, id, { ...pompe, force: e.currentTarget.valueAsNumber }), `pompe:${id}`)}
            data-testid={`pompe-force-${id}`}
          />
          <span class="tranche-valeur chiffres">{Math.round(pompe.force * 100)}</span>
        </label>
      )}
    </div>
  );
}
