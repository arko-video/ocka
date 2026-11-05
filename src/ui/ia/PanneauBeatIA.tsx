// « Lance-moi un beat », depuis l'accueil : une phrase → un nouveau morceau complet, ouvert dans le studio.
// Le morceau passe par la liste blanche puis le normaliseur ; écrit tout entier par l'IA : `infos.ia.musique` vaut « ia ».

import { useState } from 'preact/hooks';
import { lireBeat, MAX_PHRASE, requeteBeat } from '../../moteur/api';
import { T } from '../../textes-fr';
import { afficherToast } from '../etat';
import { creerMorceauDepuis } from '../mes-morceaux';
import { remplacerPar } from '../navigation';
import { Panneau } from '../composants/Panneau';
import { BlocEnvoi } from './BlocEnvoi';
import { PanneauReglagesIA } from './PanneauReglagesIA';
import './ia.css';

export const ID_BEAT = 'ia-beat';
const ID_REGLAGES = 'ia-reglages';

/** Ouvre le nouveau morceau dans le studio (Retour ramène à « Mes morceaux », comme après le choix du style). */
async function ouvrirBeat(texte: string) {
  const { morceau, ignores } = lireBeat(texte);
  if (ignores.length) console.info('IA : champs ignorés', ignores);
  if (!(await creerMorceauDepuis(morceau))) return;
  remplacerPar('beat');
  afficherToast(T.ia.beatPret, 5000);
}

function FormulaireBeat() {
  const [phrase, setPhrase] = useState('');
  const requete = phrase.trim() ? requeteBeat(phrase) : null;
  return (
    <div class="ia-panneau">
      <p class="aide">{T.ia.beatAide}</p>
      <label class="champ">
        <span class="champ-label">{T.ia.beatChamp}</span>
        <textarea
          class="champ-texte ia-phrase"
          rows={2}
          maxLength={MAX_PHRASE}
          placeholder={T.ia.beatExemple}
          value={phrase}
          onInput={(e) => setPhrase(e.currentTarget.value)}
          data-testid="ia-beat-phrase"
        />
      </label>
      <BlocEnvoi requete={requete} idReglages={ID_REGLAGES} surReponse={ouvrirBeat} libelle={T.ia.beat} />
    </div>
  );
}

/** Le bouton de l'accueil et ses deux panneaux (la demande, les réglages). */
export function LanceMoiUnBeat({ ouvrir }: { ouvrir: () => void }) {
  return (
    <>
      <button type="button" class="btn btn-contour ia-bouton-beat" aria-haspopup="dialog" onClick={ouvrir} data-testid="ia-beat">
        <span class="ia-etincelle" aria-hidden="true" />
        {T.ia.beat}
      </button>
      <Panneau id={ID_BEAT} titre={T.ia.beatTitre} testid="panneau-ia-beat">
        <FormulaireBeat />
      </Panneau>
      <PanneauReglagesIA id={ID_REGLAGES} />
    </>
  );
}
