// Gestes de la vue Pistes (U1) : ouvrir le choix d'instrument (nouvelle piste ou changement), écouter, choisir,
// dupliquer, supprimer (avec Annuler), M/S et volume (reglerTranche de U2, par api-edition).

import { signal } from '@preact/signals';
import type { InfoInstrument } from '../../../moteur/api';
import { reglerTranche } from '../../edition/api-edition';
import { ID_MELODIE, pisteDe, pistesInstrument } from '../../../morceau/acces';
import type { Morceau, Tranche } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { ajouterPiste, changerInstrument, dupliquerPiste, supprimerPiste } from '../../edition/pistes';
import { afficherToast, annulerAction, modifier, morceau, PANNEAUX, panneau } from '../../etat';
import { entendreNote, toastErreur } from '../../lecture';
import { fermerPanneau, ouvrirPanneau, ouvrirPianoRoll } from '../../navigation';
import { assurerInstrument } from './catalogue';

/** Piste dont on change l'instrument ; null = « + Piste » (nouvelle piste). */
export const choixPour = signal<string | null>(null);

export function ouvrirChoix(pour: string | null) {
  if (pour === null && morceau.peek() && pistesInstrument(morceau.peek()!).length >= 16)
    return afficherToast(T.pistes.trop);
  choixPour.value = pour;
  ouvrirPanneau(PANNEAUX.choixInstrument);
}

/** Ferme le panneau ouvert, PUIS fait `suite` (après le retour dans l'historique : Retour reste juste). */
export function fermerPuis(suite: () => void) {
  if (!panneau.peek()) return suite();
  window.addEventListener('popstate', () => setTimeout(suite, 0), { once: true });
  fermerPanneau();
}

/** Piste sur laquelle on écoute un instrument avant de le choisir. */
function pisteEcoute(m: Morceau | null): string {
  return choixPour.peek() ?? (m ? pistesInstrument(m)[0]?.id : undefined) ?? ID_MELODIE;
}

/** ▶ : télécharge au besoin (progression), puis joue un do 4 avec l'instrument. */
export async function ecouterInstrument(info: InfoInstrument) {
  try {
    await assurerInstrument(info.id);
    entendreNote(pisteEcoute(morceau.peek()), 60, { instrument: info.id, duree: 1.2 });
  } catch (e) {
    toastErreur(e, T.banque.horsLigne);
  }
}

/** « Choisir » : télécharge au besoin, puis crée la piste (et ouvre son piano roll) ou change son instrument. */
export async function choisirInstrument(info: InfoInstrument) {
  try {
    await assurerInstrument(info.id);
  } catch (e) {
    return toastErreur(e, T.banque.horsLigne);
  }
  const pour = choixPour.peek();
  const m = morceau.peek();
  if (!m) return;
  if (pour) {
    if (modifier((x) => changerInstrument(x, pour, info.id))) afficherToast(info.nom, 2500);
    return fermerPanneau();
  }
  const r = ajouterPiste(m, info.id, info.nom);
  if (!r) return afficherToast(T.pistes.trop);
  modifier(() => r.m);
  const nom = pisteDe(r.m, r.id);
  afficherToast(T.pistes.ajoutee(nom?.genre === 'instrument' ? nom.nom : info.nom), 4000, {
    label: T.annuler,
    agir: annulerAction,
  });
  fermerPuis(() => ouvrirPianoRoll(r.id, 'complet'));
}

export function dupliquer(id: string) {
  const m = morceau.peek();
  const r = m && dupliquerPiste(m, id);
  if (!m) return;
  if (!r) return afficherToast(T.pistes.trop);
  modifier(() => r.m);
  const p = pisteDe(r.m, r.id);
  afficherToast(T.pistes.dupliquee(p?.genre === 'instrument' ? p.nom : ''), 4000, {
    label: T.annuler,
    agir: annulerAction,
  });
}

export function supprimer(id: string, nom: string) {
  if (modifier((x) => supprimerPiste(x, id)))
    afficherToast(T.pistes.supprimee(nom), 6000, { label: T.annuler, agir: annulerAction });
}

/** M/S et volume : reglerTranche de U2 (api-edition) ; une erreur inattendue donne un toast. */
export function regler(
  id: string,
  c: Partial<Pick<Tranche, 'volume' | 'pan' | 'muet' | 'solo'>>,
  cle?: string,
) {
  try {
    modifier((x) => reglerTranche(x, id, c), cle);
  } catch (e) {
    toastErreur(e);
  }
}
