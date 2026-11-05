// Accueil, onglet « Sorties » : Nouvelle sortie, liste (pochette, titre, type, nombre de titres), actions. Propriétaire : A1.

import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { listerSorties, supprimerSortie, type ResumeSortie } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { afficherToast, messageErreur, panneau } from '../../etat';
import { mmss } from '../../format';
import { fermerPanneau, ouvrirPanneau } from '../../navigation';
import { creerSortieVide, ouvrirAssistant } from '../../sorties';
import { IconePlus, IconePlusDActions, IconePoubelle } from '../Icones';
import { Panneau } from '../Panneau';
import { VignettePochette } from './communs';

export const sorties = signal<ResumeSortie[] | null>(null);

export async function rafraichirSorties() {
  try {
    sorties.value = await listerSorties();
  } catch (e) {
    console.error(e);
    sorties.value = [];
    afficherToast(messageErreur(e, T.accueil.erreurSorties));
  }
}

export function ListeSorties() {
  useEffect(() => void rafraichirSorties(), []);
  const l = sorties.value;
  const [choisie, setChoisie] = useState<ResumeSortie | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const titre = (r: ResumeSortie) => r.titre.trim() || T.accueil.sansTitre;
  return (
    <>
      <button type="button" class="btn btn-principal" onClick={() => void creerSortieVide()} data-testid="nouvelle-sortie">
        <IconePlus /> {T.accueil.nouvelleSortie}
      </button>
      {l && l.length === 0 && <p class="vide">{T.accueil.sortiesVide}</p>}
      {l && l.length > 0 && (
        <ul class="liste-morceaux" data-testid="liste-sorties">
          {l.map((r) => (
            <li key={r.id} class="morceau-ligne">
              <button type="button" class="morceau-ouvrir" aria-label={T.accueil.ouvrirSortie(titre(r))} onClick={() => void ouvrirAssistant(r.id)} data-testid="ouvrir-sortie">
                <VignettePochette cle={r.pochette} classe="sortie-vignette" />
                <span class="morceau-textes">
                  <span class="morceau-titre">{titre(r)}</span>
                  <span class="morceau-infos">
                    {T.sortie.types[r.type]} · {T.sortie.nbTitres(r.nbTitres)} · <span class="chiffres">{mmss(r.duree)}</span>
                    {r.artiste && ` · ${r.artiste}`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="btn-icone"
                aria-label={T.accueil.actionsSortie(titre(r))}
                aria-haspopup="dialog"
                onClick={() => {
                  setChoisie(r);
                  setConfirmer(false);
                  ouvrirPanneau('actions-sortie');
                }}
                data-testid="actions-sortie"
              >
                <IconePlusDActions />
              </button>
            </li>
          ))}
        </ul>
      )}
      {choisie && panneau.value === 'actions-sortie' && (
        <Panneau id="actions-sortie" titre={titre(choisie)}>
          {!confirmer ? (
            <div class="liste-actions">
              <button type="button" class="btn btn-ligne btn-danger" onClick={() => setConfirmer(true)} data-testid="supprimer-sortie">
                <IconePoubelle /> {T.accueil.supprimerSortie}
              </button>
            </div>
          ) : (
            <div class="formulaire">
              <p>{T.accueil.confirmerSuppressionSortie(titre(choisie))}</p>
              <button
                type="button"
                class="btn btn-principal btn-rouge"
                onClick={async () => {
                  fermerPanneau();
                  try {
                    await supprimerSortie(choisie.id);
                    afficherToast(T.accueil.sortieSupprimee);
                  } catch (e) {
                    afficherToast(messageErreur(e, T.accueil.erreurSorties));
                  }
                  await rafraichirSorties();
                }}
                data-testid="confirmer-suppression-sortie"
              >
                <IconePoubelle /> {T.accueil.supprimerSortie}
              </button>
            </div>
          )}
        </Panneau>
      )}
    </>
  );
}
