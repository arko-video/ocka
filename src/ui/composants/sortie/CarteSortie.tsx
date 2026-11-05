// Écran Infos : le vrai nom (demandé une seule fois) et les infos de la sortie. Propriétaire : A1.

import { useState } from 'preact/hooks';
import { DISTRIBUTEURS, type Distributeur, type Sortie } from '../../../moteur/api';
import { GENRES, LANGUES } from '../../../textes/sortie';
import { T } from '../../../textes-fr';
import { enregistrerVraiNom, modifierSortie } from '../../sorties';
import { Choix } from './communs';

const VRAI_NOM = /^\p{L}[\p{L}\p{M}'’.-]*(\s+\p{L}[\p{L}\p{M}'’.-]*)+$/u;

export function CarteVraiNom() {
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState(false);
  return (
    <section class="carte carte-vrai-nom" data-champ="sortie:vraiNom">
      <h2 class="carte-titre">{T.sortie.vraiNomTitre}</h2>
      <p class="aide">{T.sortie.vraiNomAide}</p>
      <form
        class="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (!VRAI_NOM.test(nom.trim())) return setErreur(true);
          void enregistrerVraiNom(nom);
        }}
      >
        <input
          class="champ-texte"
          value={nom}
          maxLength={100}
          autoComplete="name"
          aria-label={T.sortie.vraiNomTitre}
          placeholder={T.sortie.vraiNomExemple}
          onInput={(e) => {
            setNom(e.currentTarget.value);
            setErreur(false);
          }}
          data-testid="vrai-nom"
        />
        {erreur && (
          <p class="sortie-erreur" role="alert">
            {T.sortie.vraiNomInvalide}
          </p>
        )}
        <button type="submit" class="btn btn-contour" data-testid="vrai-nom-valider">
          {T.sortie.vraiNomValider}
        </button>
      </form>
    </section>
  );
}

/** Aujourd'hui, en « AAAA-MM-JJ » local (minimum du champ date). */
function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CarteSortie({ s }: { s: Sortie }) {
  const lienFaux = !!s.lienProfil && !/^https:\/\/\S+$/.test(s.lienProfil.trim());
  return (
    <section class="carte">
      <h2 class="carte-titre">{T.sortie.carteSortie}</h2>
      <label class="champ" data-champ="sortie:titre">
        <span class="champ-label">{T.sortie.titre}</span>
        <input class="champ-texte" value={s.titre} maxLength={100} onInput={(e) => modifierSortie({ titre: e.currentTarget.value })} data-testid="sortie-titre" />
        {s.titres.length <= 1 && <span class="aide">{T.sortie.titreAide}</span>}
      </label>
      <label class="champ" data-champ="sortie:artiste">
        <span class="champ-label">{T.sortie.artiste}</span>
        <input
          class="champ-texte"
          value={s.artiste}
          maxLength={100}
          autoComplete="nickname"
          placeholder={T.sortie.artisteExemple}
          onInput={(e) => modifierSortie({ artiste: e.currentTarget.value })}
          data-testid="sortie-artiste"
        />
      </label>
      <label class="champ" data-champ="sortie:dateSortie">
        <span class="champ-label">{T.sortie.date}</span>
        <input
          class="champ-texte"
          type="date"
          value={s.dateSortie}
          min={aujourdhui()}
          onInput={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.currentTarget.value) && modifierSortie({ dateSortie: e.currentTarget.value })}
          data-testid="sortie-date"
        />
        <span class="aide">{T.sortie.dateAide}</span>
      </label>
      <div class="sortie-deux">
        <label class="champ">
          <span class="champ-label">{T.sortie.genre}</span>
          <select class="champ-texte" value={s.genre} onChange={(e) => modifierSortie({ genre: e.currentTarget.value })} data-testid="sortie-genre">
            {!s.genre && <option value="">—</option>}
            {Object.entries(GENRES).map(([v, nom]) => (
              <option key={v} value={v}>
                {nom}
              </option>
            ))}
            {s.genre && !GENRES[s.genre] && <option value={s.genre}>{s.genre}</option>}
          </select>
        </label>
        <label class="champ">
          <span class="champ-label">{T.sortie.langue}</span>
          <select class="champ-texte" value={s.langue} onChange={(e) => modifierSortie({ langue: e.currentTarget.value })} data-testid="sortie-langue">
            {Object.entries(LANGUES).map(([c, nom]) => (
              <option key={c} value={c}>
                {nom}
              </option>
            ))}
            {!LANGUES[s.langue] && <option value={s.langue}>{s.langue}</option>}
          </select>
        </label>
      </div>
      <div class="champ" data-champ="sortie:distributeur">
        <span class="champ-label">{T.sortie.distributeur}</span>
        <Choix<Distributeur>
          etiquette={T.sortie.distributeur}
          options={DISTRIBUTEURS.map((d) => ({ valeur: d, texte: T.sortie.distributeurs[d] }))}
          valeur={s.distributeur}
          surChoix={(d) => modifierSortie({ distributeur: d })}
          testid="sortie-distributeur"
        />
        <span class="aide">{T.sortie.distributeurAide[s.distributeur]}</span>
      </div>
      <div class="champ">
        <span class="champ-label">{T.sortie.niveau}</span>
        <Choix<Sortie['niveau']>
          etiquette={T.sortie.niveau}
          options={[
            { valeur: 'standard', texte: T.sortie.niveaux.standard },
            { valeur: 'fort', texte: T.sortie.niveaux.fort },
          ]}
          valeur={s.niveau}
          surChoix={(niveau) => modifierSortie({ niveau })}
          testid="sortie-niveau"
        />
        <span class="aide">{T.sortie.niveauAide}</span>
      </div>
      <label class="champ" data-champ="sortie:lienProfil">
        <span class="champ-label">{T.sortie.lien}</span>
        <input
          class="champ-texte"
          type="url"
          inputMode="url"
          value={s.lienProfil ?? ''}
          maxLength={200}
          placeholder="https://open.spotify.com/artist/…"
          onInput={(e) => modifierSortie({ lienProfil: e.currentTarget.value.trim() || undefined })}
          data-testid="sortie-lien"
        />
        {lienFaux ? <span class="sortie-erreur">{T.sortie.lienInvalide}</span> : <span class="aide">{T.sortie.lienAide}</span>}
      </label>
    </section>
  );
}
