// Dossier de sortie : ZIP « Artiste - Titre (sortie).zip » écrit en flux dans OPFS (ocka-sorties). Propriétaire : A1.
// Utilise creerZip (A2, src/zip/ecrire.ts), exporterAudio avec `ecrivain` (A2), verifierPlace (src/stockage/dossiers.ts).
// Contenu : « 01 - Titre.flac » (ou .wav) rendus DIRECTEMENT dans le ZIP, pochette.jpg, paroles/01 - Titre.txt,
// fiche-de-sortie.html et .txt. Un seul niveau (sortie.niveau) pour tous les titres. Annuler = zip.annuler().

import { ErreurOcka } from '../moteur/erreur';
import { exporterAudio, tailleEstimee } from '../moteur/export';
import type { OptionsDossier } from '../moteur/api-sorties';
import { dureeMorceau } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { enErreurOcka, verifierPlace } from '../stockage/dossiers';
import { ouvrirMorceau } from '../stockage/morceaux';
import { lireReglages } from '../stockage/reglages';
import { creerZip } from '../zip/ecrire';
import { TAILLE_MAX_ZIP, type EcrivainZip } from '../zip/types';
import { ficheAvecFormat } from './fiche';
import { tailleJpegBlob } from './jpeg';
import { nomTitre, nomZip, titreComplet } from './noms';
import { parolesMusixmatch } from './paroles';
import { lirePochette } from './pochette';
import { verifierSortie } from './regles';
import type { Reglages, Sortie } from './types';

/** Le téléchargement recopie le fichier : il faut au moins 2,2 × la taille estimée. */
export const FACTEUR_PLACE = 2.2;
/** Marge pour la pochette, les paroles et la fiche. */
const MARGE = 2_000_000;

/** Écran allumé pendant la préparation (sinon le téléphone se met en veille et coupe le calcul). */
async function garderEcranAllume(): Promise<WakeLockSentinel | null> {
  try {
    return (await globalThis.navigator?.wakeLock?.request('screen')) ?? null;
  } catch {
    return null;
  }
}

/** Les morceaux de la sortie, dans l'ordre. Lève « titre_introuvable » si l'un a disparu. */
async function chargerMorceaux(sortie: Sortie): Promise<Map<string, Morceau>> {
  const morceaux = new Map<string, Morceau>();
  for (const id of sortie.titres) {
    const m = await ouvrirMorceau(id);
    if (!m) throw new ErreurOcka('Un titre de la sortie n’existe plus : retire-le dans Infos.', 'titre_introuvable');
    morceaux.set(id, m);
  }
  return morceaux;
}

export async function exporterDossierSortie(sortie: Sortie, options: OptionsDossier): Promise<File> {
  const { format, surProgression, signal } = options;
  const extension = format === 'wav24' ? 'wav' : 'flac';
  const siAnnule = () => {
    if (signal?.aborted) throw new ErreurOcka('Dossier annulé.', 'annule');
  };
  siAnnule();

  // 1. Morceaux et pochette, puis la vérification : aucun problème bloquant.
  const morceaux = await chargerMorceaux(sortie);
  const pochette = sortie.pochette ? await lirePochette(sortie.pochette) : null;
  const taille = pochette ? await tailleJpegBlob(pochette).catch(() => null) : null;
  const aVerifier: Sortie = { ...sortie };
  if (!pochette) delete aVerifier.pochette; // pochette disparue = pas de pochette
  const bloquants = verifierSortie(aVerifier, morceaux, taille ? Math.min(taille.largeur, taille.hauteur) : null).filter((p) => p.niveau === 'bloquant');
  if (bloquants.length || !pochette) {
    const autres = bloquants.length - 1;
    const premier = bloquants[0]?.message ?? 'Il faut une pochette.';
    throw new ErreurOcka(autres > 0 ? `${premier} (et ${autres} autre${autres > 1 ? 's' : ''} chose${autres > 1 ? 's' : ''} à corriger)` : premier, 'sortie_invalide');
  }

  // 2. Place libre : 2,2 × l'estimation ; refus au-delà de 3,9 Go (pas de ZIP64).
  const audio = [...morceaux.values()].reduce((s, m) => s + tailleEstimee(dureeMorceau(m), format), 0);
  const estimation = audio + pochette.size + MARGE;
  if (estimation > TAILLE_MAX_ZIP) {
    throw new ErreurOcka('Le dossier dépasserait 3,9 Go : coupe ta sortie en deux sorties plus petites.', 'trop_gros');
  }
  await verifierPlace(estimation, FACTEUR_PLACE);
  siAnnule();
  const reglages: Reglages = await lireReglages().catch(() => ({}));

  // 3. Le ZIP, en flux : chaque titre est rendu directement dans son entrée.
  const verrou = await garderEcranAllume();
  const texte = new TextEncoder();
  let zip: EcrivainZip | null = null;
  try {
    zip = await creerZip('sorties', nomZip(sortie.artiste, sortie.titre));
    const titres = sortie.titres.map((id) => morceaux.get(id)!);
    for (const [i, m] of titres.entries()) {
      siAnnule();
      surProgression?.(i, 0);
      const ecrivain = await zip.entree(nomTitre(i, titreComplet(m.titre, m.infos?.featuring), extension));
      await exporterAudio(m, { format, niveau: sortie.niveau, ecrivain, signal, surProgression: (p) => surProgression?.(i, p) });
      await ecrivain.fermer();
      surProgression?.(i, 1);
    }
    siAnnule();
    await zip.ajouter('pochette.jpg', pochette);
    for (const [i, m] of titres.entries()) {
      if (m.infos?.langue === 'instrumental') continue;
      const paroles = parolesMusixmatch(m);
      if (paroles) await zip.ajouter(`paroles/${nomTitre(i, titreComplet(m.titre, m.infos?.featuring), 'txt')}`, texte.encode(`${paroles}\n`));
    }
    const fiche = ficheAvecFormat(sortie, morceaux, reglages, extension);
    await zip.ajouter('fiche-de-sortie.html', texte.encode(fiche.html));
    await zip.ajouter('fiche-de-sortie.txt', texte.encode(fiche.txt));
    siAnnule();
    return await zip.terminer();
  } catch (e) {
    // Le fichier partiel est effacé (annulation, disque plein, erreur d'un titre).
    await zip?.annuler().catch(() => undefined);
    if (signal?.aborted) throw new ErreurOcka('Dossier annulé.', 'annule');
    throw enErreurOcka(e, { message: 'Le dossier n’a pas pu être préparé. Réessaie.', code: 'inconnu' });
  } finally {
    await verrou?.release().catch(() => undefined);
  }
}
