// Assistant de sortie — écran 1 « Infos » : vrai nom (une fois), la sortie, puis ses titres. Propriétaire : A1.

import { T } from '../../../textes-fr';
import { sortieEditee } from '../../etat';
import { reglagesSortie } from '../../sorties';
import { CarteSortie, CarteVraiNom } from '../../composants/sortie/CarteSortie';
import { BoutonSuivant, EnteteSortie } from '../../composants/sortie/communs';
import { ListeTitres } from '../../composants/sortie/ListeTitres';

export function Infos() {
  const s = sortieEditee.value;
  return (
    <div class="ecran sortie" data-testid="ecran-sortie-infos">
      <EnteteSortie />
      {s && (
        <main class="ecran-corps">
          {!reglagesSortie.value.vraiNom && <CarteVraiNom />}
          <CarteSortie s={s} />
          <ListeTitres s={s} />
        </main>
      )}
      <BoutonSuivant vers="sortie-pochette" texte={T.sortie.suivantPochette} />
    </div>
  );
}
