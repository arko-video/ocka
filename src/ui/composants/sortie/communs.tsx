// Petits composants de l'assistant de sortie : en-tête avec les 3 étapes, choix en segments, vignette de pochette,
// barre d'action du bas, et l'effet « Corriger » (va au champ visé). Propriétaire : A1.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { lirePochette } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { ecran, ECRANS_SORTIE, sortieEditee, type EcranSortie } from '../../etat';
import { allerA, retour } from '../../navigation';
import { vise, viderSauvegardes } from '../../sorties';
import { IconeRetour } from '../Icones';
import { BoutonAide } from '../../aide/BoutonAide';

const NOMS: Record<EcranSortie, string> = {
  'sortie-infos': T.sortie.ecrans.infos,
  'sortie-pochette': T.sortie.ecrans.pochette,
  'sortie-verifier': T.sortie.ecrans.verifier,
};

/** En-tête : Retour, « Sortir sur Spotify », nom de la sortie, et les 3 étapes (on peut sauter de l'une à l'autre). */
export function EnteteSortie() {
  const actuel = ecran.value as EcranSortie;
  const s = sortieEditee.value;
  // En quittant un écran de l'assistant (autre étape, Retour, accueil), ce qui attend est écrit tout de suite.
  useEffect(() => () => void viderSauvegardes(), []);
  return (
    <header class="sortie-entete">
      <div class="entete">
        <button type="button" class="btn-icone" aria-label={T.retour} onClick={retour} data-testid="retour">
          <IconeRetour />
        </button>
        <div class="entete-titres">
          <h1 class="entete-titre">{T.sortie.titreAssistant}</h1>
          <span class="sortie-sous">{s?.titre.trim() || T.sortie.sansTitre}</span>
        </div>
        <BoutonAide />
      </div>
      <nav class="sortie-etapes" aria-label={T.sortie.etapes}>
        {ECRANS_SORTIE.map((e, i) => (
          <button
            key={e}
            type="button"
            class="sortie-etape"
            aria-current={e === actuel ? 'step' : undefined}
            onClick={() => {
              void viderSauvegardes();
              allerA(e);
            }}
            data-testid={`etape-${e.slice(7)}`}
          >
            <span class="sortie-etape-num">{i + 1}</span>
            {NOMS[e]}
          </button>
        ))}
      </nav>
    </header>
  );
}

/** Barre du bas, au pouce : le bouton de l'étape suivante. */
export function PiedSortie({ children }: { children: ComponentChildren }) {
  return <div class="sortie-pied">{children}</div>;
}

export function BoutonSuivant({ vers, texte }: { vers: EcranSortie; texte: string }) {
  return (
    <PiedSortie>
      <button
        type="button"
        class="btn btn-principal"
        onClick={() => {
          void viderSauvegardes();
          allerA(vers);
        }}
        data-testid="sortie-suivant"
      >
        {texte}
      </button>
    </PiedSortie>
  );
}

export interface OptionChoix<V> {
  valeur: V;
  texte: string;
  /** Suffixe du data-testid (sinon la valeur). */
  id?: string;
}

/** Choix exclusif en segments (radiogroup), gros boutons de 44 px. */
export function Choix<V extends string | boolean>(p: { options: OptionChoix<V>[]; valeur: V | undefined; surChoix: (v: V) => void; etiquette: string; testid: string }) {
  return (
    <div class="segments" role="radiogroup" aria-label={p.etiquette}>
      {p.options.map((o) => (
        <button
          key={String(o.valeur)}
          type="button"
          role="radio"
          class="segment"
          aria-checked={p.valeur === o.valeur}
          onClick={() => p.surChoix(o.valeur)}
          data-testid={`${p.testid}-${o.id ?? String(o.valeur)}`}
        >
          {o.texte}
        </button>
      ))}
    </div>
  );
}

/** Image d'une pochette rangée (URL blob libérée au démontage), ou un carré dégradé s'il n'y en a pas. */
export function VignettePochette({ cle, classe, testid }: { cle?: string | undefined; classe: string; testid?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!cle) return;
    let fini = false;
    let u: string | null = null;
    lirePochette(cle)
      .then((b) => {
        if (fini || !b) return;
        u = URL.createObjectURL(b);
        setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      fini = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [cle]);
  if (!url) return <span class={`${classe} pochette-vide`} aria-hidden="true" data-testid={testid ? `${testid}-vide` : undefined} />;
  return <img class={classe} src={url} alt="" decoding="async" draggable={false} data-testid={testid} />;
}

/**
 * Effet « Corriger » : quand `vise` change, ouvre le titre concerné (`ouvrir`), fait défiler jusqu'au champ
 * (attribut data-champ="<titre ou sortie>:<champ>"), le met en avant 2 s et y place le curseur.
 */
export function useVise(ouvrir?: (titre: string) => void) {
  const v = vise.value;
  useEffect(() => {
    if (!v) return;
    if (v.titre) ouvrir?.(v.titre);
    const t = setTimeout(() => {
      const cle = `${v.titre ?? 'sortie'}:${v.champ ?? ''}`;
      const el =
        document.querySelector<HTMLElement>(`[data-champ="${CSS.escape(cle)}"]`) ??
        document.querySelector<HTMLElement>(`[data-champ="${CSS.escape(`${v.titre ?? 'sortie'}:`)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('vise');
      const champ = el.matches('input, select, textarea') ? el : el.querySelector<HTMLElement>('input:not([type=file]), select, textarea, [role=radio]');
      champ?.focus({ preventScroll: true });
      setTimeout(() => el.classList.remove('vise'), 2400);
    }, 120);
    return () => clearTimeout(t);
  }, [v?.n]);
}

/** Icônes propres à l'assistant (même trait que Icones.tsx). */
function Svg({ children }: { children: ComponentChildren }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
export const IconeImage = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </Svg>
);
export const IconePinceau = () => (
  <Svg>
    <path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8 8.2 13Z" />
    <path d="M7.1 14.1c-1.9 0-3.4 1.6-3.4 3.4 0 1.5-.8 2.6-1.7 3 1 .9 2.6 1.5 4.3 1.5 2.4 0 4.3-1.9 4.3-4.3" />
  </Svg>
);
