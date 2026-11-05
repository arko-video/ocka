// CONTRAT de la vague A — EFFETS, A/B, STEMS, ARKO (propriétaire : M2). Ré-exporté par api.ts.
// Chaque type ci-dessous est FIGÉ : l'implémentation (fichier indiqué) doit le respecter, sinon tsc échoue ici.
// Interfaces internes de M2 (ChaineMaster, ChaineVoix) : src/moteur/types-moteur.ts.

import type { Morceau } from '../morceau/types';
import * as arko from '../arko/envoi';
import type { OptionsLongues } from './api-fichiers';
import * as ab from './ab';
import { relier } from './relier';
import * as stems from './stems';

/**
 * « Pistes séparées » (src/moteur/stems.ts) : un ZIP « Titre (pistes).zip » dans ocka-exports, avec un WAV 44,1 kHz
 * 32 bits flottants par piste qui joue (batterie, basse, accords, mélodie, sons, voix), pris AVANT le master
 * (ni couleur, ni colle, ni limiteur, ni réglage de sonie), tous au même gain : posés ensemble, ils redonnent le mix
 * avant le mastering. Une piste muette (aucune note, aucune prise, volume 0 ou coupée) ne donne PAS de fichier.
 * Erreurs : « morceau_invalide », « trop_court », « disque_plein », « annule ».
 */
export const exporterPistes: (morceau: Morceau, options?: OptionsLongues) => Promise<File> = relier(() => stems.exporterPistes);

/**
 * A/B (src/moteur/ab.ts) : écart de sonie BS.1770 entre le master « avec » et « sans » couleur et colle, mesuré
 * hors temps réel sur 8 mesures du refrain (ou du début), à ±0,5 LU près. `ecartLu` = avec − sans : c'est la
 * compensation à passer à Lecteur.comparer(true, ecartLu). Erreurs : « morceau_invalide », « trop_court ».
 */
export const mesurerEcartAB: (morceau: Morceau) => Promise<{ ecartLu: number }> = relier(() => ab.mesurerEcartAB);

/**
 * « Envoyer vers Arko » (src/arko/envoi.ts) : `f` (le M4A de exporterAudio) part par la feuille de partage d'Android
 * si navigator.canShare({ files }) → « partage » ; sinon, sur l'origine d'Arko, il est déposé dans la boîte IndexedDB
 * partagée (BASES_IDB.versArko, magasin « boite ») → « boite » ; sinon il est téléchargé → « telechargement »
 * (l'interface dit : « Dans Arko : Son guide → Importer »).
 * « annule » (partage fermé par l'utilisateur) n'est PAS une erreur : l'interface l'ignore, sans message.
 * Erreurs : « partage_impossible », « disque_plein » (boîte).
 */
export const envoyerVersArko: (f: File) => Promise<'partage' | 'telechargement' | 'boite'> = relier(() => arko.envoyerVersArko);
