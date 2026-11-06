// CONTRAT C3 — MIDI (propriétaire : P). Ré-exporté par moteur/api.ts. Chaque type et chaque signature est FIGÉ ;
// implémentations : ./midi.ts (fichiers .mid) et ./web-midi.ts (clavier MIDI). Rien ne part en ligne.
// Erreurs : « midi_illisible » (fichier), « midi_indisponible » (navigateur sans Web MIDI, accès refusé).

import type { Morceau } from '../morceau/types';
import type { Lecteur } from '../moteur/api';
import { relier } from '../moteur/relier';
import * as fichiers from './midi';
import * as direct from './web-midi';

/** Résultat d'un import : le morceau avec les pistes ajoutées (16 au plus) et ce qui n'a pas pu entrer (en français). */
export interface ResultatImportMidi {
  m: Morceau;
  pistes: string[];
  avertissements: string[];
}
/**
 * Importe un .mid : une piste instrument par canal ou piste MIDI (programme GM → instrument proche du catalogue,
 * canal 10 → batterie), notes en motifs par section (grille du 1/24), tempo et mesure lus. Pur (octets → morceau).
 */
export const importerMidi: (octets: Uint8Array, m: Morceau) => ResultatImportMidi = relier(() => fichiers.importerMidi);
/** Exporte le morceau en .mid de type 1 (une piste MIDI par piste : batterie canal 10, 808, accords, instruments). Pur. */
export const exporterMidi: (m: Morceau) => Uint8Array = relier(() => fichiers.exporterMidi);

export interface AppareilMidi {
  id: string;
  nom: string;
  fabricant: string;
}
export interface OptionsMidiDirect {
  /** Appareil (id) ; absent = tous. */
  appareil?: string;
  /** Piste instrument jouée. */
  piste: string;
}
export interface EnregistrementMidi {
  /** Arrête ; renvoie le morceau avec les notes posées dans le motif de la section (latence retirée, sans caler). */
  arreter(): Promise<Morceau>;
  readonly notes: number;
}
export const listerAppareilsMidi: () => Promise<AppareilMidi[]> = relier(() => direct.listerAppareilsMidi);
/** Joue en direct la piste au clavier MIDI ; renvoie la fonction qui arrête. */
export const jouerMidiDirect: (lecteur: Lecteur, o: OptionsMidiDirect) => Promise<() => void> = relier(() => direct.jouerMidiDirect);
/** Enregistre ce qu'on joue pendant la lecture (le lecteur boucle sur la section). */
export const enregistrerMidi: (lecteur: Lecteur, m: Morceau, o: OptionsMidiDirect & { section: string }) => Promise<EnregistrementMidi> = relier(() => direct.enregistrerMidi);
