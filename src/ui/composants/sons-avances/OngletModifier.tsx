// Éditeur simple (façon Edison) : choisir un passage sur la forme d'onde, puis couper, fondu d'entrée ou de sortie,
// normaliser, inverser. On travaille sur une COPIE : le résultat est un nouveau son (Annuler le retire).

import { useState } from 'preact/hooks';
import { editerSon, type OperationSon } from '../../../moteur/api';
import type { SonImporte } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, annulerAction, modifier, morceau, sonEdite } from '../../etat';
import { toastErreur } from '../../lecture';
import { ecouterPassage, type PcmSon } from './ecoute';
import { FormeOnde } from './FormeOnde';
import { poserSonModifie } from './poser-son';

type Action = 'couper' | 'entree' | 'sortie' | 'normaliser' | 'inverser';

/** Lance un calcul qui rend un nouveau son, puis le pose (pads et boucles suivent) avec un Annuler. */
export async function remplacerPar(son: SonImporte, calcul: () => Promise<SonImporte>, setEnCours: (x: boolean) => void): Promise<void> {
  setEnCours(true);
  try {
    const nouveau = await calcul();
    if (modifier((m) => poserSonModifie(m, son.id, nouveau))) {
      sonEdite.value = nouveau.id;
      afficherToast(T.editeurSon.nouveau(nouveau.nom), 6000, {
        label: T.editeurSon.annuler,
        agir: () => {
          annulerAction();
          sonEdite.value = son.id;
        },
      });
    }
  } catch (e) {
    toastErreur(e, T.editeurSon.erreur);
  } finally {
    setEnCours(false);
  }
}

export function OngletModifier({ son, pcm }: { son: SonImporte; pcm: PcmSon }) {
  const [sel, setSel] = useState<{ de: number; a: number } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const de = sel?.de ?? 0;
  const a = sel?.a ?? son.duree;

  const operation = (x: Action): OperationSon => {
    switch (x) {
      case 'couper':
        return { type: 'couper', de, a };
      case 'entree':
        return { type: 'fondu', de, a: sel ? a : Math.min(son.duree, 0.5), sens: 'entree' };
      case 'sortie':
        return { type: 'fondu', de: sel ? de : Math.max(0, son.duree - 0.5), a, sens: 'sortie' };
      case 'normaliser':
        return { type: 'normaliser' };
      case 'inverser':
        return sel ? { type: 'inverser', de, a } : { type: 'inverser' };
    }
  };
  const agir = (x: Action) => {
    const m = morceau.peek();
    if (!m || enCours) return;
    void remplacerPar(son, () => editerSon(m, son.id, operation(x)), setEnCours);
  };
  const boutons: [Action, string][] = [
    ['couper', T.editeurSon.couper],
    ['entree', T.editeurSon.fonduEntree],
    ['sortie', T.editeurSon.fonduSortie],
    ['normaliser', T.editeurSon.normaliser],
    ['inverser', T.editeurSon.inverser],
  ];

  return (
    <div class="sa-onglet">
      <FormeOnde pcm={pcm} libelle={T.editeurSon.formeOnde(son.nom)} selection={sel} surSelection={setSel} surToucher={() => ecouterPassage(pcm, de, a)} />
      <p class="aide" data-testid="editeur-selection">
        {sel ? T.editeurSon.selection(de, a) : T.editeurSon.toutLeSon} · {T.editeurSon.aideSelection}
      </p>
      <div class="sa-actions">
        {boutons.map(([x, texte]) => (
          <button key={x} type="button" class="btn btn-contour btn-petit" disabled={enCours || (x === 'couper' && !sel)} onClick={() => agir(x)} data-testid={`editeur-${x}`}>
            {texte}
          </button>
        ))}
      </div>
      <p class="aide" aria-live="polite">
        {enCours ? T.editeurSon.enCours : T.editeurSon.copie}
      </p>
    </div>
  );
}
