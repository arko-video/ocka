// Racine de l'interface : accueil (onglets Morceaux | Sorties), choix du style, studio (en-tête, onglets, étape,
// barre de lecture, panneaux de la v2 : piano roll, choix et gestion des instruments, effets, réglages avancés ;
// C2 : éditeur de notes de l'autotune, Chanter, Beatbox ; C3 : panneaux de P, S, L, R, V),
// assistant de sortie (Infos → Pochette → Vérifier), aide (« ? »), premier lancement, toast.

import { useEffect } from 'preact/hooks';
import { T } from '../textes-fr';
import { annulerAction, ecran, ECRANS_SORTIE, ETAPES, historique, panneau, PANNEAUX, retablirAction, toast, toastAction, type EcranSortie, type Etape } from './etat';
import { basculerLecture } from './lecture';
import { estPanneauAide } from './navigation';
import { PremierLancement } from './aide/PremierLancement';
import { BarreLecture } from './composants/BarreLecture';
import { PianoRoll } from './composants/pianoroll/PianoRoll';
import { ChoixInstrument } from './composants/pistes/ChoixInstrument';
import { GererInstruments } from './composants/pistes/GererInstruments';
import { ReglagesAvance } from './composants/ReglagesAvance';
import { PanneauEffets } from './composants/son/PanneauEffets';
import { EnteteStudio, Onglets } from './composants/Entete';
import { PanneauConfort } from './looper/PanneauConfort';
import { raccourciC3 } from './looper/raccourcis';
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
import { paresseux } from './paresseux';

/** Panneaux lourds chargés à la première ouverture (bundle principal plus léger : paresseux.tsx). */
const ouvert = (id: string) => panneau.value === id;
const TOUJOURS = () => true;
const Aide = paresseux(TOUJOURS, () => import('./aide/Aide').then((x) => x.Aide));
const PanneauBeatbox = paresseux(() => ouvert(PANNEAUX.beatbox), () => import('./composants/dubler/PanneauBeatbox').then((x) => x.PanneauBeatbox));
const PanneauChanter = paresseux(() => ouvert(PANNEAUX.chanter), () => import('./composants/dubler/PanneauChanter').then((x) => x.PanneauChanter));
const EditeurNotes = paresseux(() => ouvert(PANNEAUX.editeurAutotune), () => import('./composants/voix/EditeurNotes').then((x) => x.EditeurNotes));
const PanneauMidi = paresseux(() => ouvert(PANNEAUX.midi), () => import('./composants/outils-notes/PanneauMidi').then((x) => x.PanneauMidi));
const PanneauOutilsNotes = paresseux(() => ouvert(PANNEAUX.outilsNotes), () => import('./composants/outils-notes/PanneauOutilsNotes').then((x) => x.PanneauOutilsNotes));
const PanneauEditeurSon = paresseux(() => ouvert(PANNEAUX.editeurSon), () => import('./composants/sons-avances/PanneauEditeurSon').then((x) => x.PanneauEditeurSon));
const PanneauSonsCourts = paresseux(() => ouvert(PANNEAUX.sonsCourts), () => import('./composants/synthe/PanneauSonsCourts').then((x) => x.PanneauSonsCourts));
const PanneauSynthe = paresseux(() => ouvert(PANNEAUX.synthe), () => import('./composants/synthe/PanneauSynthe').then((x) => x.PanneauSynthe));
const PanneauReference = paresseux(() => ouvert(PANNEAUX.reference), () => import('./composants/voix-avancee/PanneauReference').then((x) => x.PanneauReference));
const PanneauVoixAvancee = paresseux(() => ouvert(PANNEAUX.voixAvancee), () => import('./composants/voix-avancee/PanneauVoixAvancee').then((x) => x.PanneauVoixAvancee));
const PanneauLooper = paresseux(() => ouvert(PANNEAUX.looper), () => import('./looper/PanneauLooper').then((x) => x.PanneauLooper));
const PanneauPerformance = paresseux(() => ouvert(PANNEAUX.performance), () => import('./looper/PanneauPerformance').then((x) => x.PanneauPerformance));

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
  if (!saisie && raccourciC3(e)) return; // C3 (R) : raccourcis clavier sur PC
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
          {/* Panneaux de la v2 (chacun ne s'affiche que s'il est ouvert : etat.PANNEAUX, navigation.ts). */}
          <PianoRoll />
          <ChoixInstrument />
          <GererInstruments />
          <PanneauEffets />
          <ReglagesAvance />
          <EditeurNotes />
          <PanneauChanter />
          <PanneauBeatbox />
          {/* C3 : un panneau par développeur (P, S, L, R, V), branché vide au contrat. */}
          <PanneauOutilsNotes />
          <PanneauMidi />
          <PanneauEditeurSon />
          <PanneauSynthe />
          <PanneauSonsCourts />
          <PanneauLooper />
          <PanneauPerformance />
          <PanneauConfort />
          <PanneauVoixAvancee />
          <PanneauReference />
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
