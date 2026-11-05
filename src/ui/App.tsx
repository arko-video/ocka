// Racine de l'interface : accueil (onglets Morceaux | Sorties), choix du style, studio (en-tête, onglets, étape,
// barre de lecture), assistant de sortie (Infos → Pochette → Vérifier), aide (« ? »), premier lancement, toast.

import { useEffect } from 'preact/hooks';
import { T } from '../textes-fr';
import { annulerAction, ecran, ECRANS_SORTIE, ETAPES, historique, panneau, retablirAction, toast, toastAction, type EcranSortie, type Etape } from './etat';
import { basculerLecture } from './lecture';
import { estPanneauAide } from './navigation';
import { Aide } from './aide/Aide';
import { PremierLancement } from './aide/PremierLancement';
import { BarreLecture } from './composants/BarreLecture';
import { EnteteStudio, Onglets } from './composants/Entete';
import { Beat } from './ecrans/Beat';
import { ChoixStyle } from './ecrans/ChoixStyle';
import { Exporter } from './ecrans/Exporter';
import { MesMorceaux } from './ecrans/MesMorceaux';
import { Son } from './ecrans/Son';
import { Structure } from './ecrans/Structure';
import { Voix } from './ecrans/Voix';
import { Infos } from './ecrans/sortie/Infos';
import { Pochette } from './ecrans/sortie/Pochette';
import { Verifier } from './ecrans/sortie/Verifier';

const ETAPE: Record<Etape, () => preact.JSX.Element | null> = {
  beat: Beat,
  structure: Structure,
  voix: Voix,
  son: Son,
  exporter: Exporter,
};

/** Écrans de l'assistant de sortie (A1 les remplit). */
const ECRAN_SORTIE: Record<EcranSortie, () => preact.JSX.Element | null> = {
  'sortie-infos': Infos,
  'sortie-pochette': Pochette,
  'sortie-verifier': Verifier,
};

/** Raccourcis : Ctrl+Z, Ctrl+Maj+Z / Ctrl+Y, Espace (hors champs de saisie). */
function raccourcis(e: KeyboardEvent) {
  if (!historique.peek() || estPanneauAide(panneau.peek())) return;
  const cible = e.target as HTMLElement | null;
  const saisie = cible?.closest('input, textarea, select, [contenteditable]');
  if ((e.ctrlKey || e.metaKey) && !saisie) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) (e.preventDefault(), annulerAction());
    else if (k === 'y' || (k === 'z' && e.shiftKey)) (e.preventDefault(), retablirAction());
    return;
  }
  if (e.key === ' ' && !saisie && !cible?.closest('button, [role="dialog"]')) {
    e.preventDefault();
    basculerLecture();
  }
}

export function App() {
  useEffect(() => {
    window.addEventListener('keydown', raccourcis);
    return () => window.removeEventListener('keydown', raccourcis);
  }, []);
  const e = ecran.value;
  const studio = (ETAPES as string[]).includes(e) && historique.value;
  const Corps = studio ? ETAPE[e as Etape] : null;
  const Sortie = (ECRANS_SORTIE as string[]).includes(e) ? ECRAN_SORTIE[e as EcranSortie] : null;
  const accueil = !studio && !Sortie && e !== 'styles';
  return (
    <>
      {accueil && <PremierLancement />}
      {e === 'styles' ? <ChoixStyle /> : Sortie ? <Sortie /> : !studio && <MesMorceaux />}
      {studio && Corps && (
        <div class="ecran studio" data-testid={`ecran-${e}`}>
          <EnteteStudio />
          <Onglets />
          <div id="panneau-etape" class="studio-corps" role="tabpanel" aria-labelledby={`onglet-${e}`}>
            <Corps />
          </div>
          <BarreLecture />
        </div>
      )}
      {estPanneauAide(panneau.value) && <Aide />}
      {toast.value && (
        <div class="toast" role="status" aria-live="polite" data-studio={studio ? '1' : '0'} data-testid="toast">
          <span>{toast.value}</span>
          {toastAction.value && (
            <button
              type="button"
              class="toast-action"
              onClick={() => {
                const a = toastAction.peek();
                toast.value = null;
                toastAction.value = null;
                a?.agir();
              }}
              data-testid="toast-action"
            >
              {toastAction.value.label}
            </button>
          )}
        </div>
      )}
      <span class="sr-only" aria-live="polite">
        {studio ? T.etapes[e as Etape] : ''}
      </span>
    </>
  );
}
