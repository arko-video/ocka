// « Gérer les instruments » : instruments téléchargés, place prise, suppression (API de BQ : instrumentsInstalles,
// tailleInstruments, supprimerInstrument). Tant que BQ n'est pas prêt (« pas_encore ») : un message, sans planter.

import { useEffect, useState } from 'preact/hooks';
import { instrumentsInstalles, supprimerInstrument, tailleInstruments } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { messageErreur, PANNEAUX, panneau } from '../../etat';
import { toastErreur } from '../../lecture';
import { IconePoubelle } from '../Icones';
import { Panneau } from '../Panneau';
import { catalogue, chargerCatalogue, nomInstrument, taille } from './catalogue';

type Etat =
  | { type: 'chargement' }
  | { type: 'pret'; liste: { id: string; octets: number }[]; total: number }
  | { type: 'erreur'; message: string };

export function GererInstruments() {
  const ouvert = panneau.value === PANNEAUX.gererInstruments;
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' });
  const lire = () =>
    Promise.all([instrumentsInstalles(), tailleInstruments()])
      .then(([liste, total]) => setEtat({ type: 'pret', liste, total }))
      .catch((e: unknown) => setEtat({ type: 'erreur', message: messageErreur(e, T.bientot) }));
  useEffect(() => {
    if (!ouvert) return;
    setEtat({ type: 'chargement' });
    void chargerCatalogue();
    void lire();
  }, [ouvert]);
  if (!ouvert) return null;
  const retirer = async (id: string) => {
    try {
      await supprimerInstrument(id);
      catalogue.value = catalogue.peek().map((x) => (x.id === id ? { ...x, installe: false } : x));
    } catch (e) {
      toastErreur(e);
    }
    void lire();
  };
  return (
    <Panneau id={PANNEAUX.gererInstruments} titre={T.banque.gerer} testid="panneau-gerer-instruments">
      <p class="aide">{T.banque.gererAide}</p>
      {etat.type === 'chargement' && <p class="aide">{T.pistes.chargement}</p>}
      {etat.type === 'erreur' && (
        <p class="vide" data-testid="gerer-erreur">
          {etat.message}
        </p>
      )}
      {etat.type === 'pret' && (
        <>
          <p class="aide chiffres" data-testid="place-instruments">
            {T.banque.place(taille(etat.total))}
          </p>
          <ul class="instr-liste">
            {etat.liste.map((x) => (
              <li key={x.id} class="instr">
                <span class="instr-texte">
                  <span class="instr-nom">{nomInstrument(x.id)}</span>
                  <span class="instr-etat chiffres">{taille(x.octets)}</span>
                </span>
                <button
                  type="button"
                  class="btn btn-petit btn-discret btn-danger"
                  onClick={() => void retirer(x.id)}
                  data-testid={`supprimer-instrument-${x.id}`}
                >
                  <IconePoubelle taille={16} /> {T.banque.supprimer}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panneau>
  );
}
