// Entraînement guidé du beatbox : « Fais ton kick (boum) 5 fois », puis la caisse claire (« ka »), le charley (« ts »)
// et un 4e son au choix (qu'on peut passer). Chaque exemple = la prochaine attaque entendue ; l'entraînement est
// gardé sur l'appareil (base ocka-dubler) dès qu'un son a ses 5 exemples.

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  EXEMPLES_PAR_SON,
  enregistrerExemple,
  ErreurOcka,
  sauverEntrainement,
  SONS_BEATBOX,
  type EntrainementBeatbox,
  type SonBeatbox,
} from '../../../moteur/api';
import type { InstrumentBatterie } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { toastErreur } from '../../lecture';

/** Pads proposés pour le 4e son. */
const PADS_PERSO: InstrumentBatterie[] = ['clap', 'rim', 'charleyOuvert', 'cowbell', 'perc'];

export const entrainementVide = (): EntrainementBeatbox => ({
  version: 1,
  exemples: { boum: [], ka: [], ts: [], perso: [] },
  instruments: { boum: 'kick', ka: 'snare', ts: 'charley', perso: 'clap' },
});

/** Complet : boum, ka et ts ont 5 exemples ; perso en a 0 (passé) ou 5. */
export function entrainementComplet(e: EntrainementBeatbox | null): boolean {
  if (!e) return false;
  return SONS_BEATBOX.every(
    (s) => e.exemples[s].length >= EXEMPLES_PAR_SON || (s === 'perso' && e.exemples[s].length === 0),
  );
}

interface Props {
  entrainement: EntrainementBeatbox;
  changer: (e: EntrainementBeatbox) => void;
}

export function EntrainementBeatbox({ entrainement, changer }: Props) {
  const [enCours, setEnCours] = useState<SonBeatbox | null>(null);
  const arret = useRef<AbortController | null>(null);
  useEffect(() => () => arret.current?.abort(), []);

  async function entrainer(son: SonBeatbox) {
    arret.current?.abort();
    const a = new AbortController();
    arret.current = a;
    setEnCours(son);
    let e: EntrainementBeatbox = { ...entrainement, exemples: { ...entrainement.exemples, [son]: [] } };
    changer(e);
    try {
      for (let i = 0; i < EXEMPLES_PAR_SON; i++) {
        const v = await enregistrerExemple(son, { signal: a.signal });
        e = { ...e, exemples: { ...e.exemples, [son]: [...e.exemples[son], v] } };
        changer(e);
      }
      await sauverEntrainement(e).catch((x: unknown) => toastErreur(x));
    } catch (x) {
      if (!(x instanceof ErreurOcka && x.code === 'annule')) toastErreur(x, T.chanter.erreurs.echec);
    } finally {
      if (arret.current === a) {
        arret.current = null;
        setEnCours(null);
      }
    }
  }

  function passer() {
    arret.current?.abort();
    const e = { ...entrainement, exemples: { ...entrainement.exemples, perso: [] } };
    changer(e);
    if (entrainementComplet(e)) void sauverEntrainement(e).catch(() => undefined);
  }

  return (
    <ol class="beatbox-etapes" data-testid="beatbox-entrainement">
      {SONS_BEATBOX.map((son) => {
        const n = Math.min(EXEMPLES_PAR_SON, entrainement.exemples[son].length);
        const actif = enCours === son;
        return (
          <li
            key={son}
            class={`beatbox-etape${actif ? ' beatbox-etape-active' : ''}`}
            data-testid={`beatbox-son-${son}`}
            data-exemples={n}
          >
            <div class="beatbox-etape-tete">
              <span class="reglage-label">{T.beatbox.consignes[son]}</span>
              <span class="beatbox-points" aria-label={T.beatbox.entendu(n)}>
                {Array.from({ length: EXEMPLES_PAR_SON }, (_, i) => (
                  <span key={i} class={`beatbox-point${i < n ? ' beatbox-point-plein' : ''}`} />
                ))}
              </span>
            </div>
            {son === 'perso' && (
              <div class="puces puces-defile" role="radiogroup" aria-label={T.beatbox.padPerso}>
                {PADS_PERSO.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    class="puce"
                    aria-checked={entrainement.instruments.perso === p}
                    onClick={() =>
                      changer({ ...entrainement, instruments: { ...entrainement.instruments, perso: p } })
                    }
                  >
                    {T.instruments[p]}
                  </button>
                ))}
              </div>
            )}
            {actif ? (
              <p class="dubler-etat" aria-live="polite">
                {T.beatbox.ecoute} — {T.beatbox.entendu(n)}
              </p>
            ) : (
              <div class="beatbox-actions">
                <button
                  type="button"
                  class="btn btn-contour btn-petit"
                  disabled={enCours !== null}
                  onClick={() => void entrainer(son)}
                  data-testid={`beatbox-entrainer-${son}`}
                >
                  {n > 0 ? T.beatbox.refaire : T.beatbox.commencer}
                </button>
                {son === 'perso' && n === 0 && (
                  <button
                    type="button"
                    class="btn btn-discret btn-petit"
                    disabled={enCours !== null}
                    onClick={passer}
                    data-testid="beatbox-passer"
                  >
                    {T.beatbox.passer}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
