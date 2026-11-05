// CONTRAT de la vague A — SORTIES (propriétaire : A1). Ré-exporté par api.ts ; l'interface importe depuis api.ts.
// Chaque type ci-dessous est FIGÉ : l'implémentation (fichier indiqué) doit le respecter, sinon tsc échoue ici.
// Toutes les erreurs sont des ErreurOcka (message en français) ; codes indiqués pour chaque fonction.

import type { Morceau } from '../morceau/types';
import * as dossier from '../sortie/dossier';
import * as fiche from '../sortie/fiche';
import * as pochette from '../sortie/pochette';
import * as paroles from '../sortie/paroles';
import * as regles from '../sortie/regles';
import * as reglages from '../stockage/reglages';
import * as sorties from '../stockage/sorties';
import type { ProblemeSortie, Reglages, ResumeSortie, Sortie, TypeSortie } from '../sortie/types';
import { relier } from './relier';

export type { Distributeur, ProblemeSortie, Reglages, ResumeSortie, Sortie, TypeSortie } from '../sortie/types';
export { DISTRIBUTEURS, FORMAT_SORTIE } from '../sortie/types';
export type { PochettePrete } from '../sortie/pochette';
/** Normaliseur des sorties (contrat) : ids morts et doublons retirés, date par défaut = aujourd'hui + 6 semaines. */
export { normaliserSortie, normaliserReglages } from '../morceau/normaliser-sortie';

/** Options de exporterDossierSortie. */
export interface OptionsDossier {
  /** « flac16 » (défaut conseillé : RouteNote refuse le WAV) ou « wav24 » (DistroKid). */
  format: 'flac16' | 'wav24';
  /** `titre` = index (0…) du titre en cours dans sortie.titres, `p` = avancement de ce titre (0 à 1). */
  surProgression?: (titre: number, p: number) => void;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------ stockage (src/stockage/sorties.ts) */

/** Toutes les sorties, de la plus récente à la plus ancienne. Erreur : « stockage ». */
export const listerSorties: () => Promise<ResumeSortie[]> = relier(() => sorties.listerSorties);
/**
 * Ouvre une sortie, passée par normaliserSortie avec les ids des morceaux existants (titres morts retirés).
 * null si elle n'existe pas. Erreur : « sortie_illisible » (format plus récent).
 */
export const ouvrirSortie: (id: string) => Promise<Sortie | null> = relier(() => sorties.ouvrirSortie);
/** Normalise puis sauve (modifieLe = maintenant) ; renvoie la sortie sauvée. Erreurs : « disque_plein », « stockage ». */
export const sauverSortie: (sortie: Sortie) => Promise<Sortie> = relier(() => sorties.sauverSortie);
/** Supprime une sortie (jamais ses morceaux ; sa pochette part au ramasse-miettes). Erreur : « stockage ». */
export const supprimerSortie: (id: string) => Promise<void> = relier(() => sorties.supprimerSortie);
/**
 * Crée ET sauve une sortie pré-remplie avec les réglages (artiste, lien, distributeur), date = aujourd'hui + 6 semaines.
 * `depuisMorceau` : id d'un morceau → sortie d'un titre, au titre du morceau (bouton « Sortir sur Spotify »).
 * Erreurs : « morceau_introuvable », « disque_plein », « stockage ».
 */
export const nouvelleSortie: (depuisMorceau?: string) => Promise<Sortie> = relier(() => sorties.nouvelleSortie);
/** Retire un morceau de toutes les sorties (appelée après supprimerMorceau, dans ui/mes-morceaux.ts). */
export const retirerMorceauDesSorties: (idMorceau: string) => Promise<void> = relier(() => sorties.retirerMorceauDesSorties);

/* ------------------------------------------------------------ réglages (src/stockage/reglages.ts) */

/** Réglages de l'utilisateur ({} au premier lancement). Erreur : « stockage ». */
export const lireReglages: () => Promise<Reglages> = relier(() => reglages.lireReglages);
/** Fusionne `changements` dans les réglages, les sauve et renvoie le résultat normalisé. Erreurs : « disque_plein », « stockage ». */
export const ecrireReglages: (changements: Partial<Reglages>) => Promise<Reglages> = relier(() => reglages.ecrireReglages);

/* ------------------------------------------------------------ règles (src/sortie/regles.ts, pures) */

/**
 * Type de sortie (règle de Spotify) d'après les durées des titres (s) : single = 1 à 3 titres et < 30 min ;
 * EP = 4 à 6 titres et < 30 min ; sinon album. 0 titre → « single ».
 */
export const typeSortie: (durees: readonly number[]) => TypeSortie = relier(() => regles.typeSortie);
/**
 * Liste « Prêt pour Spotify ? » (vide = prêt). `morceaux` : les morceaux de la sortie par id (un id absent →
 * problème « titre_introuvable »). `cotePochette` : côté de la pochette en px s'il est connu (< 3000 → conseil).
 * Contrôles : titre/artiste remplis, pochette, ≥ 30 s par titre, explicite répondu, IA déclarée, crédits avec
 * vrais noms, règles du titre (pas tout en MAJUSCULES, pas de n° de piste, pas le nom de l'artiste, ≤ 12 mots,
 * « (feat. X) »), doublons, ISRC, moyenne ≥ 60 s pour DistroKid (conseil), date à moins de 4 semaines (conseil :
 * la vérification du distributeur prend ~3 semaines, et le pitch Spotify doit partir 7 jours avant la sortie).
 */
export const verifierSortie: (sortie: Sortie, morceaux: ReadonlyMap<string, Morceau>, cotePochette?: number | null) => ProblemeSortie[] =
  relier(() => regles.verifierSortie);

/* ------------------------------------------------------------ pochette (src/sortie/pochette.ts) */

/**
 * Recadre une image importée en carré CENTRÉ sur `centre` (fractions 0 à 1 de la largeur et de la hauteur),
 * côté = min(3000, plus petit côté), JPEG sRGB qualité 0,92, rangée dans ocka-pochettes.
 * Erreurs : « pochette_trop_petite » (< 1425 px de côté), « image_illisible », « disque_plein ».
 */
export const preparerPochette: (image: Blob, centre: { x: number; y: number }) => Promise<{ cle: string; cote: number }> =
  relier(() => pochette.preparerPochette);
/** Fabrique une pochette 3000 × 3000 (modèle 0 à 3, couleurs tirées de `graine`) avec le titre et l'artiste. Erreur : « disque_plein ». */
export const fabriquerPochette: (modele: 0 | 1 | 2 | 3, titre: string, artiste: string, graine: number) => Promise<{ cle: string; cote: number }> =
  relier(() => pochette.fabriquerPochette);
/** Le JPEG d'une pochette, ou null si elle n'existe plus. */
export const lirePochette: (cle: string) => Promise<Blob | null> = relier(() => pochette.lirePochette);

/* ------------------------------------------------------------ textes (pures) */

/**
 * Paroles au format Musixmatch depuis la structure : chaque apparition de section écrite en entier, dans l'ordre,
 * une ligne par vers, une ligne vide entre les sections, sans étiquette (« Refrain »…). '' si aucune parole.
 */
export const parolesMusixmatch: (morceau: Morceau) => string = relier(() => paroles.parolesMusixmatch);
/**
 * Fiche de sortie : `html` (tout est échappé, aucun script) et `txt`, avec tout ce qu'il faut recopier chez le
 * distributeur et son guide pas à pas (limite d'âge : renvoyer vers sa page ; Amuse n'est plus cité comme gratuit).
 */
export const ficheSortie: (sortie: Sortie, morceaux: ReadonlyMap<string, Morceau>, reglages: Reglages) => { html: string; txt: string } =
  relier(() => fiche.ficheSortie);

/* ------------------------------------------------------------ dossier (src/sortie/dossier.ts) */

/**
 * Prépare « Artiste - Titre (sortie).zip » dans OPFS ocka-sorties : « 01 - Titre.flac » (ou .wav) rendus DIRECTEMENT
 * dans le ZIP (exporterAudio avec `ecrivain`, niveau = sortie.niveau pour tous), pochette.jpg, paroles/01 - Titre.txt,
 * fiche-de-sortie.html et .txt. Place vérifiée avant (2,2 × la taille estimée), Wake Lock, fichier partiel effacé
 * en cas d'erreur. Erreurs : « sortie_invalide » (problème bloquant), « titre_introuvable », « disque_plein »,
 * « trop_gros » (> 3,9 Go), « annule ».
 */
export const exporterDossierSortie: (sortie: Sortie, options: OptionsDossier) => Promise<File> = relier(() => dossier.exporterDossierSortie);
