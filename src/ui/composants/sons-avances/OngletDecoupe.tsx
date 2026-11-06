// Découper un son (sample chop) : aux attaques (sensibilité) ou en parts égales ; coupes déplacées au doigt,
// écoute de chaque découpe, puis « Envoyer sur les pads » (4 pads perso, par groupe de 4 découpes).

import { useEffect, useRef, useState } from 'preact/hooks';
import { decouperAttaques, decouperEgal, poserDecoupes, tranchesVersPads } from '../../../moteur/api';
import { PADS_PERSO, type DecoupeSon, type SonImporte } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, modifier } from '../../etat';
import { toastErreur } from '../../lecture';
import { ecouterPassage, type PcmSon } from './ecoute';
import { FormeOnde } from './FormeOnde';

const PARTS = [2, 4, 8, 16, 32];

export function OngletDecoupe({ son, pcm }: { son: SonImporte; pcm: PcmSon }) {
  const [mode, setMode] = useState<'attaques' | 'egal'>('attaques');
  const [sensibilite, setSensibilite] = useState(0.5);
  const tranches = son.tranches ?? [];
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const poser = (t: readonly DecoupeSon[], cle: string) => {
    try {
      modifier((m) => poserDecoupes(m, son.id, t), cle);
    } catch (e) {
      toastErreur(e);
    }
  };
  const aux = (s: number) => {
    setSensibilite(s);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      try {
        poser(decouperAttaques(pcm, s), `decoupe:${son.id}`);
      } catch (e) {
        toastErreur(e);
      }
    }, 120);
  };
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const coupes = tranches.slice(1).map((t) => t.debut);
  const deplacer = (i: number, t: number) => {
    const bornes = [0, ...coupes.map((c, k) => (k === i ? t : c)), son.duree];
    poser(
      bornes.slice(0, -1).map((d, k) => ({ debut: d, fin: bornes[k + 1]! })),
      `decoupe:${son.id}`,
    );
  };
  const toucher = (t: number) => {
    const k = tranches.findIndex((x) => t >= x.debut && t < x.fin);
    if (k >= 0) ecouterPassage(pcm, tranches[k]!.debut, tranches[k]!.fin);
    else ecouterPassage(pcm, 0, son.duree);
  };
  const versPads = (premiere: number) => {
    modifier((m) => tranchesVersPads(m, son.id, premiere));
    const fin = Math.min(tranches.length, premiere + PADS_PERSO.length);
    afficherToast(T.editeurSon.surPads(premiere + 1, fin));
  };
  const groupes = Array.from({ length: Math.ceil(tranches.length / PADS_PERSO.length) }, (_, g) => g * PADS_PERSO.length);

  return (
    <div class="sa-onglet">
      <div class="segments" role="radiogroup" aria-label={T.editeurSon.onglets.decouper}>
        {(['attaques', 'egal'] as const).map((x) => (
          <button key={x} type="button" role="radio" class="segment" aria-checked={mode === x} onClick={() => setMode(x)} data-testid={`decoupe-mode-${x}`}>
            {x === 'attaques' ? T.editeurSon.aux : T.editeurSon.egal}
          </button>
        ))}
      </div>
      {mode === 'attaques' ? (
        <div class="reglage">
          <span class="reglage-label">{T.editeurSon.sensibilite}</span>
          <input type="range" class="curseur" aria-label={T.editeurSon.sensibilite} min={0} max={1} step={0.05} value={sensibilite} onInput={(e) => aux(e.currentTarget.valueAsNumber)} data-testid="decoupe-sensibilite" />
          <button type="button" class="btn btn-contour btn-petit" onClick={() => aux(sensibilite)} data-testid="decoupe-attaques">
            {T.editeurSon.aux}
          </button>
        </div>
      ) : (
        <div class="reglage">
          <span class="reglage-label">{T.editeurSon.parts}</span>
          <div class="puces">
            {PARTS.map((p) => (
              <button key={p} type="button" class="puce" aria-pressed={tranches.length === p} onClick={() => poser(decouperEgal(son.duree, p), `egal:${son.id}`)} data-testid={`decoupe-egal-${p}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
      <FormeOnde pcm={pcm} libelle={T.editeurSon.formeOnde(son.nom)} coupes={coupes} surCoupe={deplacer} surToucher={toucher} />
      <p class="aide">
        <span data-testid="decoupe-nombre">{T.editeurSon.tranches(tranches.length)}</span> · {T.editeurSon.aideMarqueurs}
      </p>
      {tranches.length > 0 && (
        <div class="sa-tranches" role="group" aria-label={T.editeurSon.tranches(tranches.length)}>
          {tranches.map((t, i) => (
            <button key={i} type="button" class="puce sa-tranche" aria-label={T.editeurSon.ecouter(i + 1)} onClick={() => ecouterPassage(pcm, t.debut, t.fin)} data-testid={`tranche-ecouter-${i + 1}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {tranches.length > 0 && (
        <div class="reglage">
          <span class="reglage-label">{T.editeurSon.versPads}</span>
          <div class="puces">
            {groupes.map((g) => (
              <button key={g} type="button" class="btn btn-contour btn-petit" onClick={() => versPads(g)} data-testid={`decoupe-vers-pads-${g + 1}`}>
                {T.editeurSon.groupe(g + 1, Math.min(tranches.length, g + PADS_PERSO.length))}
              </button>
            ))}
            <button type="button" class="btn btn-discret btn-petit" onClick={() => poser([], `decoupe:${son.id}`)} data-testid="decoupe-effacer">
              {T.editeurSon.effacer}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
