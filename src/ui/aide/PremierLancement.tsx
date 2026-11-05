// Premier lancement : 3 conseils en haut de l'accueil, passés en un toucher, qui ne reviennent plus.
// C'est une carte dans la page (pas une fenêtre qui bloque) : on peut aussi l'ignorer et créer un morceau.
// Propriétaire : B3.

import { useState } from 'preact/hooks';
import { T } from '../../textes-fr';
import { insecables } from './pages';
import { bienvenueDejaVue, marquerBienvenueVue } from './premier-lancement';
import './aide.css';

export function PremierLancement() {
  const [visible, setVisible] = useState(() => !bienvenueDejaVue());
  if (!visible) return null;
  const passer = () => {
    marquerBienvenueVue();
    setVisible(false);
  };
  const b = T.bienvenue;
  return (
    <section class="bienvenue" aria-labelledby="bienvenue-titre" data-testid="bienvenue">
      {/* Toute la carte se passe en un toucher ; le bouton reste là pour le clavier et les lecteurs d'écran. */}
      <div class="bienvenue-carte" onClick={passer}>
        <h2 id="bienvenue-titre" class="bienvenue-titre">
          {b.titre}
        </h2>
        <p class="bienvenue-sous">{b.sousTitre}</p>
        <ol class="bienvenue-liste">
          {b.conseils.map((c, i) => (
            <li key={c.titre}>
              <span class="bienvenue-num" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{insecables(c.titre)}</strong>
                <span class="bienvenue-texte">{insecables(c.texte)}</span>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" class="btn btn-principal" onClick={passer} data-testid="bienvenue-passer">
          {b.cestParti}
        </button>
      </div>
    </section>
  );
}
