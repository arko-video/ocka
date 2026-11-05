// Bouton « ? » : ouvre l'aide de l'écran en cours (cible de 44 px au moins). Propriétaire : B3.
// Dans chaque en-tête : studio (Entete.tsx), accueil (MesMorceaux.tsx), choix du style, assistant de sortie (EnteteSortie).

import { T } from '../../textes-fr';
import { ecran, vueBeat } from '../etat';
import { ouvrirAide } from '../navigation';
import { pageDeLEcran } from './pages';
import './aide.css';

/** Point d'interrogation dans un rond (SVG décoratif : le bouton porte l'aria-label). */
export function IconeAide({ taille = 22 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 3.8" />
      <path d="M12 17.2h.01" stroke-width="2.6" />
    </svg>
  );
}

export function BoutonAide() {
  return (
    <button
      type="button"
      class="btn-icone guide-bouton"
      aria-label={T.aide.bouton}
      title={T.aide.bouton}
      aria-haspopup="dialog"
      onClick={() => ouvrirAide(pageDeLEcran(ecran.peek(), vueBeat.peek()))}
      data-testid="aide-ouvrir"
    >
      <IconeAide />
    </button>
  );
}
