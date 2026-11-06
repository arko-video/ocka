// Éditeur de notes de l'autotune (façon Melodyne simplifié), en plein écran (panneau `editeurAutotune`) : la courbe de
// hauteur de la prise sur un piano roll, découpée en notes qu'on déplace (demi-ton par demi-ton, aimantées à la gamme
// ou libres), coupe, fusionne, avec justesse et vibrato. Barre de 48 px : retour, écouter, Gamme | Libre, Annuler.
// Chaque geste = une fonction pure de edition/autotune.ts dans UN modifier() ; le rendu repart en tâche de fond.

import { useEffect, useRef } from 'preact/hooks';
import type { Morceau, Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { annulerAction, historique, morceau, PANNEAUX, panneau, priseEditee } from '../../etat';
import { fermerPanneau } from '../../navigation';
import { IconeAnnuler, IconeLecture, IconeRetour, IconeStop } from '../Icones';
import '../pianoroll/pianoroll.css';
import '../pianoroll/pianoroll-grille.css';
import { analyses, chargerAnalyse, ecouteAB, ecouter, rendus } from './autotune-etat';
import { EditeurPret } from './EditeurPret';
import './autotune.css';
import { debutT, libre, secondesVues } from './vue-notes';

const E = () => T.autotuneAvance.editeur;

export function EditeurNotes() {
  const ouvert = panneau.value === PANNEAUX.editeurAutotune;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const avant = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerPanneau();
    };
    window.addEventListener('keydown', touche);
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', touche);
      document.body.style.overflow = debordement;
      avant?.focus?.();
    };
  }, [ouvert]);
  if (!ouvert) return null;
  const m = morceau.value;
  const prise = m?.prises.find((p) => p.id === priseEditee.value);
  const ecoute = prise && ecouteAB.value?.idPrise === prise.id;
  const rendu = prise ? rendus.value.get(prise.id) : undefined;

  return (
    <div class="pr an" ref={ref} role="dialog" aria-modal="true" aria-label={E().titre} data-testid="panneau-editeur-autotune">
      <header class="pr-barre">
        <button type="button" class="btn-icone" aria-label={T.retour} onClick={fermerPanneau} data-testid="an-retour">
          <IconeRetour taille={22} />
        </button>
        <button
          type="button"
          class="btn-icone pr-lecture"
          aria-label={ecoute ? T.autotuneAvance.stop : E().ecouter}
          disabled={!prise}
          onClick={() => {
            if (!prise) return;
            const pret = rendus.peek().get(prise.id)?.etat === 'pret';
            const t0 = debutT.peek();
            void ecouter(prise, pret ? 'apres' : 'avant', { debut: Math.max(0, t0), fin: t0 + secondesVues.peek() });
          }}
          data-testid="an-ecouter"
        >
          {ecoute ? <IconeStop taille={20} /> : <IconeLecture taille={20} />}
        </button>
        <div class="segments pr-modes" role="radiogroup" aria-label={E().aimant}>
          {([false, true] as const).map((x) => (
            <button
              key={String(x)}
              type="button"
              role="radio"
              aria-checked={libre.value === x}
              class="segment"
              onClick={() => (libre.value = x)}
              data-testid={x ? 'an-aimant-libre' : 'an-aimant-gamme'}
            >
              {x ? E().libre : E().gamme}
            </button>
          ))}
        </div>
        <button
          type="button"
          class="btn-icone"
          aria-label={T.annuler}
          disabled={!historique.value?.peutAnnuler}
          onClick={annulerAction}
          data-testid="an-annuler"
        >
          <IconeAnnuler taille={22} />
        </button>
      </header>
      {rendu?.etat === 'calcul' && (
        <p class="badge autotune-badge an-badge" role="status" data-testid="autotune-avance-preparation">
          {T.autotuneAvance.preparation}
        </p>
      )}
      {!m || !prise ? <p class="vide">{E().introuvable}</p> : <Contenu m={m} prise={prise} />}
    </div>
  );
}

function Contenu({ m, prise }: { m: Morceau; prise: Prise }) {
  useEffect(() => void chargerAnalyse(prise), [prise.fichier]);
  const etat = analyses.value.get(prise.fichier);
  if (!etat || etat.etat === 'calcul') {
    const part = etat?.etat === 'calcul' ? Math.round(etat.part * 100) : 0;
    return (
      <p class="vide" role="status" data-testid="an-analyse">
        {E().analyse} {part > 0 && <span class="chiffres">{part} %</span>}
      </p>
    );
  }
  if (etat.etat !== 'pret')
    return (
      <p class="vide" data-testid="an-bientot">
        {etat.etat === 'bientot' ? E().bientot : E().erreur}
      </p>
    );
  return <EditeurPret m={m} prise={prise} analyse={etat.analyse} />;
}
