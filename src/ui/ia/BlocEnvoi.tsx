// Bas commun des 3 actions de l'IA : coût estimé AVANT l'envoi, « Voir ce qui est envoyé » (texte exact, en texte
// brut), bouton Envoyer (l'appel part dans le toucher), Annuler pendant l'attente, et l'erreur en clair.
// Sans clé : un bouton ouvre les réglages de l'IA (autre panneau ; Retour ramène ici).

import { useEffect, useRef, useState } from 'preact/hooks';
import { demander, ErreurOcka, estimerCout, texteEnvoye, type Requete } from '../../moteur/api';
import { T } from '../../textes-fr';
import { ouvrirPanneau } from '../navigation';
import { chargerIa, cleIa, fournisseurIa, iaChargee, nomCourt, reglagesIa } from './etat-ia';

interface Props {
  /** null tant que la demande est incomplète (Envoyer est alors grisé). */
  requete: Requete | null;
  /** Id du panneau des réglages à ouvrir. */
  idReglages: string;
  /** Reçoit le texte de l'IA ; une ErreurOcka levée ici s'affiche, et rien n'est changé. */
  surReponse(texte: string): void | Promise<void>;
  libelle?: string;
}

export function BlocEnvoi({ requete, idReglages, surReponse, libelle }: Props) {
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const annulation = useRef<AbortController | null>(null);
  useEffect(() => {
    void chargerIa();
    return () => annulation.current?.abort();
  }, []);
  const f = fournisseurIa.value;
  const aCle = !!cleIa.value;

  function envoyer() {
    const c = new AbortController();
    const reglages = requete && reglagesIa(c.signal);
    if (!requete || !reglages) return;
    annulation.current = c;
    setErreur(null);
    setEnvoi(true);
    // Appelé tout de suite, dans le toucher : demander() vérifie le geste avant tout await.
    const reponse = demander(requete, reglages);
    void (async () => {
      try {
        await surReponse(await reponse);
      } catch (e) {
        if (!c.signal.aborted) console.warn('IA :', e instanceof ErreurOcka ? e.code : e);
        setErreur(e instanceof ErreurOcka ? (e.code === 'annule' ? T.ia.annule : e.message) : T.ia.erreur);
      } finally {
        if (annulation.current === c) annulation.current = null;
        setEnvoi(false);
      }
    })();
  }

  const cout = requete ? estimerCout(requete).phrase : null;
  return (
    <div class="ia-envoi" data-testid="ia-envoi">
      {cout && (
        <p class="ia-cout" data-testid="ia-cout">
          {T.ia.cout(cout)} <span class="aide">{T.ia.prix}</span>
        </p>
      )}
      {requete && (
        <button type="button" class="btn btn-contour btn-petit" aria-expanded={voir} onClick={() => setVoir(!voir)} data-testid="ia-voir-envoi">
          {voir ? T.ia.cacherEnvoi : T.ia.voirEnvoi}
        </button>
      )}
      {voir && requete && (
        <div class="ia-texte-envoye">
          <p class="aide">{T.ia.envoiAide}</p>
          <pre tabIndex={0} data-testid="ia-texte-envoye">
            {texteEnvoye(requete)}
          </pre>
        </div>
      )}
      {iaChargee.value && !aCle ? (
        <>
          <p class="aide">{T.ia.sansCle}</p>
          <button type="button" class="btn btn-principal" onClick={() => ouvrirPanneau(idReglages)} data-testid="ia-ouvrir-reglages">
            {T.ia.reglagesCourt}
          </button>
        </>
      ) : envoi ? (
        <div class="ia-attente" role="status">
          <span class="ia-points" aria-hidden="true" />
          <span>{T.ia.envoi(nomCourt(f))}</span>
          <button type="button" class="btn btn-discret btn-petit" onClick={() => annulation.current?.abort()} data-testid="ia-annuler">
            {T.ia.annuler}
          </button>
        </div>
      ) : (
        <>
          <button type="button" class="btn btn-principal" disabled={!requete || !aCle} onClick={envoyer} data-testid="ia-envoyer">
            {libelle ?? T.ia.envoyer}
          </button>
          <button type="button" class="btn btn-discret btn-petit ia-lien-reglages" onClick={() => ouvrirPanneau(idReglages)} data-testid="ia-reglages">
            {T.ia.avecIa(nomCourt(f))} · {T.ia.reglagesCourt}
          </button>
        </>
      )}
      {erreur && (
        <p class="message message-erreur" role="alert" data-testid="ia-erreur">
          {erreur}
        </p>
      )}
    </div>
  );
}
