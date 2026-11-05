// « Mes morceaux » : liste, création à partir d'un style, ouverture, renommage, duplication, suppression,
// import d'un projet (.ocka ou .ocka-sortie). Propriétaire : A1.

import { signal } from '@preact/signals';
import {
  dupliquerMorceau,
  ErreurOcka,
  importerProjet,
  listerMorceaux,
  nouveauMorceau,
  ouvrirMorceau,
  retirerMorceauDesSorties,
  sauverMorceau,
  supprimerMorceau,
  type ResumeMorceau,
  type ResultatImport,
} from '../moteur/api';
import type { Morceau, Style } from '../morceau/types';
import { T } from '../textes-fr';
import { afficherToast, fermerSession, historique, messageErreur, ouvrirSession } from './etat';
import { reglerInfos } from './edition/reglages';
import { detruireLecteur } from './lecture';
import { marquerEcrit, sauverEnAttente, sauverTout } from './sauvegarde';
import { detruireEnregistreur } from './voix';

export const liste = signal<ResumeMorceau[] | null>(null);

export async function rafraichirListe() {
  try {
    const l = await listerMorceaux();
    liste.value = [...l].sort((a, b) => b.modifieLe - a.modifieLe);
  } catch (e) {
    console.error(e);
    liste.value = [];
    afficherToast(T.accueil.erreurListe);
  }
}

/** Quitte le morceau ouvert : on attend la sauvegarde, puis on rafraîchit la liste. */
export async function quitterMorceau() {
  await sauverEnAttente();
  if (historique.peek()) {
    detruireEnregistreur();
    detruireLecteur();
    fermerSession();
  }
  await rafraichirListe();
}

/** Crée un morceau prêt à enregistrer. Renvoie false si le moteur refuse. */
export async function creerMorceau(style: Style): Promise<boolean> {
  try {
    return await creerMorceauDepuis(nouveauMorceau(style, T.styles.noms[style]));
  } catch (e) {
    console.error(e);
    afficherToast(messageErreur(e, T.styles.erreur));
    return false;
  }
}

/** Ouvre et enregistre un morceau déjà fait (« Au hasard », IA). Renvoie false (erreur affichée) en cas d'échec. */
export async function creerMorceauDepuis(m: Morceau): Promise<boolean> {
  try {
    detruireLecteur();
    ouvrirSession(m, null);
    await sauverTout(m);
    return true;
  } catch (e) {
    console.error(e);
    afficherToast(messageErreur(e, T.styles.erreur));
    return false;
  }
}

export async function ouvrir(id: string): Promise<boolean> {
  try {
    const m = await ouvrirMorceau(id);
    if (!m) {
      afficherToast(T.accueil.introuvable);
      return false;
    }
    detruireLecteur();
    ouvrirSession(m, id);
    marquerEcrit(m);
    return true;
  } catch (e) {
    afficherToast(messageErreur(e, T.accueil.introuvable));
    return false;
  }
}

export async function renommer(id: string, titre: string) {
  try {
    const m = await ouvrirMorceau(id);
    if (!m) return;
    const r = reglerInfos(m, { titre });
    if (r !== m) await sauverMorceau(r, id);
  } catch (e) {
    afficherToast(messageErreur(e, T.accueil.erreurListe));
  }
  await rafraichirListe();
}

export async function dupliquer(id: string) {
  try {
    await dupliquerMorceau(id);
    afficherToast(T.accueil.duplique);
  } catch (e) {
    afficherToast(messageErreur(e, T.accueil.erreurListe));
  }
  await rafraichirListe();
}

export async function supprimer(id: string) {
  try {
    await supprimerMorceau(id);
    // Sortie.titres est la seule source de vérité : le morceau supprimé quitte ses sorties.
    await retirerMorceauDesSorties(id).catch((e) => console.error(e));
    afficherToast(T.accueil.supprime);
  } catch (e) {
    afficherToast(messageErreur(e, T.accueil.erreurListe));
  }
  await rafraichirListe();
}

/** « Importer un projet » : renvoie ce qui a été créé, ou null (erreur affichée ; « Bientôt disponible » tant qu'A2 n'a pas fini). */
export async function importer(f: File): Promise<ResultatImport | null> {
  try {
    const r = await importerProjet(f);
    afficherToast(T.accueil.importe);
    if (r.type === 'morceau') await rafraichirListe();
    return r;
  } catch (e) {
    if (e instanceof ErreurOcka && e.code === 'pas_encore') afficherToast(T.bientot);
    else afficherToast(messageErreur(e, T.accueil.erreurImport));
    return null;
  }
}
