// Panneaux chargés À LA DEMANDE (import dynamique) : leur code n'est pas dans le bundle principal, il arrive la
// première fois que le panneau s'ouvre (quelques millisecondes : le service worker l'a déjà en cache, hors ligne
// compris). Une fois chargé, le panneau reste monté comme avant (il gère lui-même son ouverture et sa fermeture).

import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/**
 * Un composant qui ne charge `charger()` que lorsque `ouvert()` devient vrai, puis rend le composant chargé
 * (toujours, même fermé : ses effets de fermeture marchent comme avant). Un échec de chargement (réseau coupé avant
 * la mise en cache) est réessayé à la prochaine ouverture.
 */
export function paresseux(ouvert: () => boolean, charger: () => Promise<ComponentType>): () => preact.JSX.Element | null {
  let charge: ComponentType | null = null;
  let enCours: Promise<ComponentType> | null = null;
  return function Paresseux() {
    const [, rafraichir] = useState(0);
    const demande = ouvert(); // lu à chaque rendu : le signal du panneau abonne ce composant
    useEffect(() => {
      if (charge || !demande) return;
      let vivant = true;
      enCours ??= charger();
      enCours.then(
        (c) => {
          charge = c;
          if (vivant) rafraichir((n) => n + 1);
        },
        (e: unknown) => {
          enCours = null;
          console.error('OCKA : panneau impossible à charger', e);
        },
      );
      return () => void (vivant = false);
    }, [demande]);
    const C = charge;
    return C ? <C /> : null;
  };
}
