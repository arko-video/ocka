// Pads 4×4 de 76 px pour l'instrument choisi. Appui : fort → doux → vide (et on entend le son).
// Appui long (ou clic droit, ou touche R au clavier) : choix du roulement ×2, ×3, ×4, ×6.

import { useRef, useState } from 'preact/hooks';
import type { InstrumentBatterie, MotifBatterie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import {
  basculerPas,
  etatCase,
  ligne,
  ligneRoulements,
  reglerRoulement,
  ROULEMENTS,
  type Roulement,
} from '../../edition/batterie';
import { modifier } from '../../etat';
import { entendre, pasDansMotif } from '../../lecture';
import { fermerPanneau, ouvrirPanneau } from '../../navigation';
import { Panneau } from '../Panneau';

const APPUI_LONG_MS = 450;

interface Props {
  idMotif: string;
  motif: MotifBatterie;
  inst: InstrumentBatterie;
  /** Nom affiché de l'instrument (pour un pad perso : le nom de ton son). */
  nom: string;
}

export function Pads({ idMotif, motif, inst, nom }: Props) {
  const [page, setPage] = useState(0);
  const [pasRoulement, setPasRoulement] = useState<number | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const pages = Math.max(1, Math.ceil(motif.pas / 16));
  const p = Math.min(page, pages - 1);
  const vels = ligne(motif, inst);
  const rouls = ligneRoulements(motif, inst);
  const courant = pasDansMotif(motif.pas);

  const toucher = (pas: number) => {
    if (long.current) {
      long.current = false;
      return;
    }
    const avant = vels[pas]!;
    modifier((m) => basculerPas(m, idMotif, inst, pas));
    if (avant <= 0) entendre(inst);
  };
  const ouvrirRoulement = (pas: number) => {
    setPasRoulement(pas);
    ouvrirPanneau('roulement');
  };
  const debut = (pas: number) => {
    long.current = false;
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      long.current = true;
      navigator.vibrate?.(15);
      ouvrirRoulement(pas);
    }, APPUI_LONG_MS);
  };
  const fin = () => clearTimeout(minuteur.current);

  return (
    <div class="pads-bloc">
      {pages > 1 && (
        <div class="segments" role="radiogroup" aria-label={T.beat.pads(nom)}>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === p} class="segment" onClick={() => setPage(i)}>
              {T.beat.mesure(i + 1)}
            </button>
          ))}
        </div>
      )}
      <div class="pads" role="group" aria-label={T.beat.pads(nom)} aria-describedby="aide-pads" data-testid="pads">
        {Array.from({ length: 16 }, (_, k) => {
          const pas = p * 16 + k;
          if (pas >= motif.pas) return <span key={k} class="pad pad-absent" aria-hidden="true" />;
          const etat = etatCase(vels[pas]!);
          const r = rouls[pas] ?? 0;
          return (
            <button
              key={k}
              type="button"
              class="pad"
              data-etat={etat}
              data-temps={k % 4 === 0 ? '1' : '0'}
              data-courant={courant === pas ? '1' : '0'}
              aria-pressed={etat !== 'vide'}
              aria-label={T.beat.pad(pas + 1, T.beat[etat], r)}
              aria-keyshortcuts="R"
              onClick={() => toucher(pas)}
              onPointerDown={() => debut(pas)}
              onPointerUp={fin}
              onPointerLeave={fin}
              onPointerCancel={fin}
              onContextMenu={(e) => {
                e.preventDefault();
                fin();
                long.current = true;
                ouvrirRoulement(pas);
              }}
              onKeyDown={(e) => {
                if (e.key === 'r' || e.key === 'R') {
                  e.preventDefault();
                  ouvrirRoulement(pas);
                }
              }}
              data-testid={`pad-${pas}`}
            >
              <span class="pad-num">{pas + 1}</span>
              {r > 0 && <span class="pad-roul">×{r}</span>}
            </button>
          );
        })}
      </div>
      <p id="aide-pads" class="aide">
        {T.beat.aidePads}
      </p>

      {pasRoulement !== null && (
        <Panneau id="roulement" titre={T.beat.roulementTitre(pasRoulement + 1)}>
          <p class="aide">{T.beat.roulementAide}</p>
          <div class="choix-roulement" role="radiogroup" aria-label={T.beat.roulementTitre(pasRoulement + 1)}>
            {ROULEMENTS.map((n: Roulement) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={(rouls[pasRoulement] ?? 0) === n && vels[pasRoulement]! > 0}
                class="choix"
                onClick={() => {
                  modifier((m) => reglerRoulement(m, idMotif, inst, pasRoulement, n));
                  entendre(inst);
                  fermerPanneau();
                }}
                data-testid={`roulement-${n}`}
              >
                {n === 0 ? T.beat.simple : `×${n}`}
              </button>
            ))}
          </div>
        </Panneau>
      )}
    </div>
  );
}
