// CONTRAT C3 — SOUNDFONTS .sf2 (propriétaire : S). Ré-exporté par moteur/api.ts. Chaque type et chaque signature est
// FIGÉ ; implémentation : ./sf2.ts. Le moteur joue un preset par l'échantillonneur de C1 (SourceZones, lireZone) :
// moteur/instruments/fournisseur.ts envoie déjà les ids « sf2-… » vers chargerSourceSf2 / lireZoneSf2 (contrat C3).
// Erreurs : « sf2_illisible », « trop_gros » (> 32 Mo), « sf2_trop_lourd » (> 64 Mio décodés), « disque_plein ».

import type { Morceau, SoundFontMorceau } from '../morceau/types';
import { relier } from '../moteur/relier';
import * as sf2 from './sf2';

/** Taille maximale d'un fichier .sf2 importé (octets) : plus strict que le format (PLAFONDS.tailleSoundfont = 64 Mo). */
export const TAILLE_MAX_SF2 = 32 * 1024 * 1024;
/** Mémoire décodée maximale des zones d'une SoundFont jouées par un morceau (octets). */
export const MEMOIRE_MAX_SF2 = 64 * 1024 * 1024;

/** Un preset d'une SoundFont : son instrument est « sf2-<idSoundfont>-<banque>-<preset>@1 » (REGLE_INSTRUMENT). */
export interface PresetSf2 {
  instrument: string;
  nom: string;
  banque: number;
  preset: number;
  /** Batterie (banque 128). */
  batterie: boolean;
}
/**
 * Importe un .sf2 (analyse dans un Worker, copie dans OPFS ocka-sf2, SHA-256) : la SoundFont à poser par
 * ajouterSoundfont et ses presets (déclarés au normaliseur par declarerInstruments).
 */
export const importerSoundfont: (f: File, m: Morceau) => Promise<{ soundfont: SoundFontMorceau; presets: PresetSf2[] }> = relier(() => sf2.importerSoundfont);
export const presetsSoundfont: (s: SoundFontMorceau) => Promise<PresetSf2[]> = relier(() => sf2.presetsSoundfont);
/** Ajoute la SoundFont à Morceau.soundfonts (8 au plus). Pur. */
export const ajouterSoundfont: (m: Morceau, s: SoundFontMorceau) => Morceau = relier(() => sf2.ajouterSoundfont);
/** Retire la SoundFont (les pistes qui la jouent deviennent muettes) ; le fichier est effacé par le ménage. */
export const supprimerSoundfont: (m: Morceau, id: string) => Promise<Morceau> = relier(() => sf2.supprimerSoundfont);
