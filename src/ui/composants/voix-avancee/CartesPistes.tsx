// Chaînes de voix prêtes (un toucher = les inserts de la piste voix, une étape d'Annuler) et gel des pistes (V).

import { useState } from 'preact/hooks';
import { appliquerChaineVoix, chainesVoix, degelerPiste, gelerPiste, pistesGelees } from '../../../moteur/api';
import type { Morceau, Piste } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, modifier, morceau } from '../../etat';
import { toastErreur } from '../../lecture';

const nomPiste = (p: Piste) => (p.genre === 'instrument' ? p.nom : (T.voixAvancee.gel.noms[p.id] ?? p.id));

export function CarteChaines() {
  let liste: ReturnType<typeof chainesVoix> = [];
  try {
    liste = chainesVoix();
  } catch {
    return null;
  }
  return (
    <section class="carte va-carte" data-testid="va-chaines">
      <h3 class="carte-titre">{T.voixAvancee.chaines.titre}</h3>
      <p class="aide">{T.voixAvancee.chaines.aide}</p>
      <div class="puces">
        {liste.map((c) => (
          <button
            key={c.id}
            type="button"
            class="puce"
            onClick={() => {
              if (modifier((m) => appliquerChaineVoix(m, c.id))) afficherToast(T.voixAvancee.chaines.appliquee(c.nom));
            }}
            data-testid={`chaine-${c.id}`}
          >
            <span class="puce-nom">{c.nom}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function gelees(m: Morceau): string[] {
  try {
    return pistesGelees(m);
  } catch {
    return [];
  }
}

export function CarteGel({ m }: { m: Morceau }) {
  const [calcul, setCalcul] = useState<string | null>(null);
  const [, rafraichir] = useState(0);
  const g = gelees(m);
  const basculer = async (id: string) => {
    try {
      if (g.includes(id)) degelerPiste(id);
      else {
        setCalcul(id);
        await gelerPiste(morceau.peek() ?? m, id);
      }
    } catch (e) {
      toastErreur(e);
    } finally {
      setCalcul(null);
      rafraichir((n) => n + 1);
    }
  };
  return (
    <section class="carte va-carte" data-testid="va-gel">
      <h3 class="carte-titre">{T.voixAvancee.gel.titre}</h3>
      <p class="aide">{T.voixAvancee.gel.aide}</p>
      <ul class="va-pistes">
        {m.pistes.map((p) => (
          <li key={p.id} class="va-ligne">
            <span class="va-nom">{nomPiste(p)}</span>
            {g.includes(p.id) && <span class="badge badge-magenta" data-testid={`gel-badge-${p.id}`}>{T.voixAvancee.gel.gelee}</span>}
            <button type="button" class="btn btn-petit btn-contour" disabled={calcul !== null} onClick={() => void basculer(p.id)} data-testid={`gel-${p.id}`}>
              {calcul === p.id ? T.voixAvancee.gel.calcul : g.includes(p.id) ? T.voixAvancee.gel.degeler : T.voixAvancee.gel.geler}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
