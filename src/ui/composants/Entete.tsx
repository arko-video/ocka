// En-tête du studio : Retour vers « Mes morceaux », titre, « Enregistré », Annuler / Rétablir, « ? » (aide), puis les 5 onglets.

import { T } from '../../textes-fr';
import { annulerAction, ecran, ETAPES, etatSauvegarde, historique, morceau, retablirAction, type Etape } from '../etat';
import { BoutonAide } from '../aide/BoutonAide';
import { EntreeConfort } from './EntreesC3';
import { allerA, allerAccueil } from '../navigation';
import { IconeAnnuler, IconeCoche, IconeRetablir, IconeRetour } from './Icones';

export function EnteteStudio() {
  const h = historique.value;
  const s = etatSauvegarde.value;
  return (
    <header class="entete">
      <button type="button" class="btn-icone" aria-label={T.accueil.titre} onClick={allerAccueil} data-testid="retour">
        <IconeRetour />
      </button>
      <div class="entete-titres">
        <h1 class="entete-titre" data-testid="titre-morceau">
          {morceau.value?.titre}
        </h1>
        <span class="enregistre" data-etat={s} role="status" aria-live="polite" data-testid="enregistre">
          {s === 'enregistre' && (
            <>
              <IconeCoche taille={12} /> {T.enregistre}
            </>
          )}
          {s === 'erreur' && T.pasEnregistre}
        </span>
      </div>
      <button
        type="button"
        class="btn-icone"
        aria-label={T.annuler}
        title={T.annuler}
        disabled={!h?.peutAnnuler}
        onClick={annulerAction}
        data-testid="annuler"
      >
        <IconeAnnuler />
      </button>
      <button
        type="button"
        class="btn-icone"
        aria-label={T.retablir}
        title={T.retablir}
        disabled={!h?.peutRetablir}
        onClick={retablirAction}
        data-testid="retablir"
      >
        <IconeRetablir />
      </button>
      <EntreeConfort />
      <BoutonAide />
    </header>
  );
}

/** Onglets des étapes (tablist) : flèches gauche / droite au clavier. */
export function Onglets() {
  const actuel = ecran.value as Etape;
  const touche = (e: KeyboardEvent) => {
    const i = ETAPES.indexOf(actuel);
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
    if (j < 0 || j >= ETAPES.length) return;
    e.preventDefault();
    allerA(ETAPES[j]!);
    requestAnimationFrame(() => document.getElementById(`onglet-${ETAPES[j]}`)?.focus());
  };
  return (
    <nav class="onglets" aria-label={T.navigationEtapes}>
      <div role="tablist" class="onglets-liste" onKeyDown={touche}>
        {ETAPES.map((e, i) => (
          <button
            key={e}
            id={`onglet-${e}`}
            type="button"
            role="tab"
            class="onglet"
            aria-selected={actuel === e}
            aria-controls="panneau-etape"
            tabIndex={actuel === e ? 0 : -1}
            onClick={() => allerA(e)}
            data-testid={`onglet-${e}`}
          >
            <span class="onglet-num" aria-hidden="true">
              {i + 1}
            </span>
            {T.etapes[e]}
          </button>
        ))}
      </div>
    </nav>
  );
}
