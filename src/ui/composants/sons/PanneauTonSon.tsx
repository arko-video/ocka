// « + Ton son » (Batterie) : importer un son (ou reprendre un de tes sons), puis le poser sur un pad perso.
// Le pad apparaît alors dans les instruments de la grille, comme le kick.

import { useState } from 'preact/hooks';
import { PADS_PERSO, type PadPerso } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { affecterPad, padLibre, sonDuPad, sonParId } from '../../edition/sons';
import { afficherToast, instrumentEdite, modifier, morceau } from '../../etat';
import { nombre } from '../../format';
import { entendre } from '../../lecture';
import { fermerPanneau } from '../../navigation';
import { Panneau } from '../Panneau';
import { ImporterSon } from './ImporterSon';

export function PanneauTonSon() {
  const m = morceau.value;
  const [choisi, setChoisi] = useState<string | null>(null);
  if (!m) return null;
  const sons = m.sons ?? [];
  const son = sonParId(m, choisi ?? undefined);
  const suggere = padLibre(m);

  const poser = (pad: PadPerso) => {
    if (!son) return;
    modifier((x) => affecterPad(x, pad, son.id));
    instrumentEdite.value = pad;
    fermerPanneau();
    afficherToast(T.tesSons.surPad(son.nom, PADS_PERSO.indexOf(pad) + 1));
    entendre(pad);
  };

  return (
    <Panneau id="ton-son" titre={T.tesSons.titre}>
      <ImporterSon surImport={(s) => setChoisi(s.id)} />

      {sons.length > 0 && (
        <div class="reglage">
          <span class="reglage-label" id="label-tes-sons">
            {T.tesSons.tesSons}
          </span>
          <div class="puces puces-colonne" role="radiogroup" aria-labelledby="label-tes-sons">
            {sons.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === choisi}
                class="puce puce-large"
                onClick={() => setChoisi(s.id)}
                data-testid={`ton-son-${s.id}`}
              >
                <span class="puce-nom texte-coupe">{s.nom}</span>
                <span class="puce-detail chiffres">{T.tesSons.secondes(nombre(s.duree))}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {son && (
        <div class="reglage">
          <span class="reglage-label" id="label-choix-pad">
            {T.tesSons.choisirPad}
          </span>
          <div class="choix-pads" role="group" aria-labelledby="label-choix-pad">
            {PADS_PERSO.map((pad, i) => {
              const actuel = sonDuPad(m, pad);
              return (
                <button
                  key={pad}
                  type="button"
                  class="choix choix-pad"
                  data-suggere={pad === suggere ? '1' : '0'}
                  aria-pressed={actuel?.id === son.id}
                  onClick={() => poser(pad)}
                  data-testid={`pad-perso-${i + 1}`}
                >
                  <span>{T.tesSons.pad(i + 1)}</span>
                  <span class="choix-detail texte-coupe">{actuel ? actuel.nom : T.tesSons.padVide}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Panneau>
  );
}
