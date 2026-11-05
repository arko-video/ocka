// « Aide aux paroles », depuis une carte de section : un thème + les mesures → 3 propositions de lignes rimées,
// avec les syllabes de chaque mesure. On en choisit une : elle va dans section.paroles (une étape d'Annuler),
// puis on la modifie dans le champ de la carte. Tout s'affiche en TEXTE BRUT (jamais de HTML venu de l'IA).

import { useState } from 'preact/hooks';
import type { Morceau, Section } from '../../morceau/types';
import { appliquerParoles, LANGUES_PAROLES, lireParoles, MAX_PHRASE, requeteParoles, type LangueParoles, type Proposition } from '../../moteur/api';
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
}

export function PanneauParolesIA({ id, idReglages, m, s }: Props) {
  return (
    <Panneau id={id} titre={T.ia.parolesTitre(s.nom)} testid="panneau-ia-paroles">
      <FormulaireParoles idReglages={idReglages} m={m} s={s} />
    </Panneau>
  );
}

function FormulaireParoles({ idReglages, m, s }: Omit<Props, 'id'>) {
  const [theme, setTheme] = useState('');
  const [langue, setLangue] = useState<LangueParoles>('fr');
  const [props, setProps] = useState<Proposition[] | null>(null);
  const [choisie, setChoisie] = useState(0);

  function mettre() {
    const p = props?.[choisie];
    if (!p) return;
    if (!modifier((x) => appliquerParoles(x, s.id, p.lignes.map((l) => l.texte)))) return;
    fermerPanneau();
    afficherToast(T.ia.parolesMises, 5000, { label: T.annuler, agir: annulerAction });
  }

  if (props) {
    return (
      <div class="ia-panneau">
        <span class="reglage-label" id={`ia-props-${s.id}`}>
          {T.ia.propositions}
        </span>
        <div class="ia-propositions" role="radiogroup" aria-labelledby={`ia-props-${s.id}`} data-testid="ia-propositions">
          {props.map((p, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              class="ia-proposition"
              aria-checked={choisie === i}
              onClick={() => setChoisie(i)}
              data-testid={`ia-proposition-${i}`}
            >
              <span class="ia-proposition-tete">
                <span>{T.ia.proposition(i + 1)}</span>
                {p.rime && <span class="badge">{T.ia.rime(p.rime)}</span>}
              </span>
              {p.lignes.map((l, j) => (
                <span key={j} class="ia-ligne">
                  <span class="ia-ligne-texte">{l.texte}</span>
                  <span class="ia-syllabes chiffres">{T.ia.syllabes(l.syllabes)}</span>
                </span>
              ))}
            </button>
          ))}
        </div>
        <button type="button" class="btn btn-principal" onClick={mettre} data-testid="ia-choisir">
          {T.ia.choisir}
        </button>
        <button type="button" class="btn btn-discret" onClick={() => setProps(null)} data-testid="ia-autres">
          {T.ia.autres}
        </button>
      </div>
    );
  }

  return (
    <div class="ia-panneau">
      <p class="aide">{T.ia.parolesAide(s.mesures)}</p>
      <label class="champ">
        <span class="champ-label">{T.ia.theme}</span>
        <input
          class="champ-texte"
          maxLength={MAX_PHRASE}
          placeholder={T.ia.themeExemple}
          value={theme}
          onInput={(e) => setTheme(e.currentTarget.value)}
          data-testid="ia-theme"
        />
      </label>
      <div class="reglage">
        <span class="reglage-label" id={`ia-langue-${s.id}`}>
          {T.ia.langue}
        </span>
        <div class="segments" role="radiogroup" aria-labelledby={`ia-langue-${s.id}`}>
          {LANGUES_PAROLES.map((l) => (
            <button key={l} type="button" role="radio" class="segment" aria-checked={langue === l} onClick={() => setLangue(l)} data-testid={`ia-langue-${l}`}>
              {T.ia.langues[l]}
            </button>
          ))}
        </div>
      </div>
      <BlocEnvoi
        requete={theme.trim() ? requeteParoles(m, s, theme, langue) : null}
        idReglages={idReglages}
        surReponse={(texte) => {
          setChoisie(0);
          setProps(lireParoles(texte));
        }}
        libelle={T.ia.paroles}
      />
    </div>
  );
}
