// « Continue mon idée », depuis une carte de section : l'IA ajoute un refrain, un pont ou une variation juste après
// cette section. Une seule étape d'Annuler ; le toast propose aussi « Annuler ».

import { useState } from 'preact/hooks';
import type { Morceau, Section } from '../../morceau/types';
import { GENRES_SUITE, lireSuite, MAX_PHRASE, requeteSuite, type GenreSuite } from '../../moteur/api';
import { T } from '../../textes-fr';
import { afficherToast, annulerAction, modifier } from '../etat';
import { fermerPanneau } from '../navigation';
import { Panneau } from '../composants/Panneau';
import { BlocEnvoi } from './BlocEnvoi';
import './ia.css';

interface Props {
  id: string;
  idReglages: string;
  m: Morceau;
  s: Section;
  /** Place de la section dans l'ordre (la nouvelle section se joue juste après). */
  index: number;
}

export function PanneauSuiteIA({ id, idReglages, m, s, index }: Props) {
  return (
    <Panneau id={id} titre={T.ia.suiteTitre(s.nom)} testid="panneau-ia-suite">
      <FormulaireSuite idReglages={idReglages} m={m} s={s} index={index} />
    </Panneau>
  );
}

function FormulaireSuite({ idReglages, m, s, index }: Omit<Props, 'id'>) {
  const [genre, setGenre] = useState<GenreSuite>('refrain');
  const [idee, setIdee] = useState('');

  function appliquer(texte: string) {
    let nom = '';
    // lireSuite lève une ErreurOcka si la réponse est mauvaise : modifier() n'a alors rien changé.
    const fait = modifier((x) => {
      const r = lireSuite(x, s.id, index, genre, texte);
      nom = r.sections.at(-1)!.nom;
      return r;
    });
    if (!fait) return;
    fermerPanneau();
    afficherToast(T.ia.suiteAjoutee(nom), 6000, { label: T.annuler, agir: annulerAction });
  }

  return (
    <div class="ia-panneau">
      <p class="aide">{T.ia.suiteAide}</p>
      <div class="reglage">
        <span class="reglage-label" id={`ia-genre-${index}`}>
          {T.ia.genre}
        </span>
        <div class="segments" role="radiogroup" aria-labelledby={`ia-genre-${index}`}>
          {GENRES_SUITE.map((g) => (
            <button key={g} type="button" role="radio" class="segment" aria-checked={genre === g} onClick={() => setGenre(g)} data-testid={`ia-genre-${g}`}>
              {T.ia.genres[g]}
            </button>
          ))}
        </div>
      </div>
      <label class="champ">
        <span class="champ-label">{T.ia.suiteChamp}</span>
        <input
          class="champ-texte"
          maxLength={MAX_PHRASE}
          placeholder={T.ia.suiteExemple}
          value={idee}
          onInput={(e) => setIdee(e.currentTarget.value)}
          data-testid="ia-suite-idee"
        />
      </label>
      <BlocEnvoi requete={requeteSuite(m, s.id, genre, idee)} idReglages={idReglages} surReponse={appliquer} libelle={T.ia.suite} />
    </div>
  );
}
