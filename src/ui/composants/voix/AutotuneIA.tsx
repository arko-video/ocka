// « Avec l'IA » pour l'autotune d'une prise : comme les autres actions de l'IA (coût avant l'envoi, « Voir ce qui est
// envoyé », Annuler pendant l'attente). Seule la liste des notes part, jamais la voix. Le conseil est appliqué en UNE
// étape d'Annuler (appliquerConseil). Sans clé : le bouton des réglages de l'IA (et « Corriger tout seul » à côté).

import { useEffect } from 'preact/hooks';
import { appliquerConseil, lireAutotune, marquerIa, requeteAutotune, type Requete } from '../../../moteur/api';
import type { Morceau, Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { BlocEnvoi } from '../../ia/BlocEnvoi';
import { PanneauReglagesIA } from '../../ia/PanneauReglagesIA';
import '../../ia/ia.css';
import { analyses, chargerAnalyse, estBientot } from './autotune-etat';

export const ID_REGLAGES_IA_AUTOTUNE = 'ia-reglages-autotune';

export function AutotuneIA({ m, prise }: { m: Morceau; prise: Prise }) {
  useEffect(() => void chargerAnalyse(prise), [prise.fichier]);
  const etat = analyses.value.get(prise.fichier);
  const analyse = etat?.etat === 'pret' ? etat.analyse : null;
  let requete: Requete | null = null;
  let bientot = etat?.etat === 'bientot';
  if (analyse) {
    try {
      requete = requeteAutotune(analyse.notes, { tonalite: m.tonalite, style: m.style, tempo: m.tempo });
    } catch (e) {
      if (!estBientot(e)) console.error(e);
      bientot = true;
    }
  }

  function appliquer(texte: string) {
    if (!analyse) return;
    // lireAutotune lève une ErreurOcka (« reponse_ia_invalide ») si la réponse est mauvaise : rien n'est changé.
    const conseil = lireAutotune(texte, analyse);
    // Une seule étape d'Annuler : le conseil ET la déclaration (infos.ia.voix passe à « aide »).
    if (modifier((x) => marquerIa(appliquerConseil(x, prise.id, conseil), { voix: true })))
      afficherToast(conseil.explication ?? T.autotuneAvance.iaApplique, 6000, { label: T.annuler, agir: annulerAction });
  }

  return (
    <div class="ia-panneau autotune-ia" data-testid="autotune-ia-bloc">
      <p class="aide">{T.autotuneAvance.iaAide}</p>
      {etat?.etat === 'calcul' && <p class="aide">{T.autotuneAvance.analyse}</p>}
      {bientot && <p class="aide" data-testid="autotune-ia-bientot">{T.autotuneAvance.bientot}</p>}
      <BlocEnvoi requete={requete} idReglages={ID_REGLAGES_IA_AUTOTUNE} surReponse={appliquer} libelle={T.autotuneAvance.iaEnvoyer} />
      <PanneauReglagesIA id={ID_REGLAGES_IA_AUTOTUNE} />
    </div>
  );
}
