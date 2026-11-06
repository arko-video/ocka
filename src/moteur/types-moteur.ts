// Interfaces INTERNES du moteur, figées par le contrat de la vague A (M1 graphe/lecteur, M2 effets, A2 fichiers),
// complétées par le contrat C0 de la v2 (pistes séparées par id, OptionsNote, SourceZones de l'échantillonneur).
// L'interface (src/ui) ne les voit pas : elle passe par api.ts. Changement = demande dans le rapport.

import type { Master } from '../morceau/types';

/** PCM d'un son importé, rendu par lireSon (A2) et joué par le graphe (M1) : un Float32Array par canal (1 ou 2). */
export interface PcmSon {
  frequence: number;
  canaux: Float32Array[];
}

/** Options de construireGraphe (M1). */
export interface OptionsGraphe {
  /**
   * Pistes séparées (stems, M2) : chaque piste listée est envoyée vers ce nœud AU LIEU du bus master, telle
   * qu'elle y entrerait (volume, panoramique, muet/solo, effets et réverbes propres à la piste compris ;
   * AVANT le pré-gain et la chaîne master). Les pistes non listées vont au master comme d'habitude.
   * Promesse testée : Σ pistes séparées − entrée du master ≤ −90 dBFS, sans décalage.
   * Clés : ids de pistes (fixes et instrument). Dictionnaire lu avec Object.hasOwn.
   */
  pistesSeparees?: Record<string, AudioNode>;
  /** PCM des sons importés, par clé de fichier (SonImporte.fichier), comme la Map des prises. */
  sons?: Map<string, PcmSon>;
  /**
   * C3 — Passages gelés (effets de performance, gel d'une piste : moteur/gels.ts). Absent = ceux des fournisseurs
   * (gelsDuMorceau : écoute sans attendre, hors ligne en attendant) ; false = aucun (rendu d'un gel lui-même).
   */
  gels?: import('./gels').Gel[] | false;
}

/**
 * Chaîne du master (M2) : couleur → colle (chaîne 2, compresseur en JS dans le worklet) → limiteur.
 * Créée UNE fois par contexte (bus persistant, M1) ; `regler` la change sans recréer les nœuds lourds.
 * Le pré-gain (−3 dB) et le fondu de fin restent dans le graphe (M1).
 */
export interface ChaineMaster {
  /** On y branche le mélange des pistes (après le pré-gain). */
  readonly entree: AudioNode;
  /** Sortie du master (après le limiteur), branchée par le graphe sur le fondu puis la destination. */
  readonly sortie: AudioNode;
  /** Retard ajouté par la chaîne (s) : l'export et `heureDe` le retirent. */
  readonly latence: number;
  /** Applique preset, niveau et chaîne (1 = phases 0 et 1, 2 = avec la colle) d'un morceau. */
  regler(master: Master): void;
  /**
   * A/B : `sans` = true contourne la couleur et la colle (le limiteur reste) et applique `compensationDb`
   * (le `ecartLu` de mesurerEcartAB) pour garder le même volume perçu ; false revient au son normal.
   */
  contourner(sans: boolean, compensationDb: number): void;
  /**
   * Hors ligne (OfflineAudioContext) : AUCUN worklet (Chrome ne libère jamais un contexte hors ligne où un worklet
   * a été chargé). `sortie` est alors l'ENTRÉE du master (après couleur, avec/sans) et le rendu doit passer par
   * appliquerMaster (audio/master-hors-ligne.ts) avec ces réglages. null = le worklet fait le master (écoute).
   */
  masterJs(): { chaine: 1 | 2; seuilColle: number; colle: number } | null;
  /** Débranche tout et arrête le worklet (message « fin »). */
  detruire(): void;
}

/** Chaîne de la voix (M2) : préréglage + effets (réverbe, écho, radio, doubler). */
export interface ChaineVoix {
  /** On y branche les prises. */
  readonly entree: AudioNode;
  /** Débranche tout (l'écho a une boucle de retour : sans ça, rien n'est libéré). */
  detruire(): void;
}

/** Options d'une note jouée seule (Lecteur.entendreNote, Graphe.entendreNote). */
export interface OptionsNote {
  /** Vélocité 0,1 à 1 (défaut 1). */
  vel?: number;
  /** Faire entendre cet instrument sur la piste au lieu du sien (choix d'instrument, avant de le poser). */
  instrument?: string;
  /** Durée tenue (s) avant le relâchement ; défaut : celle du son. */
  duree?: number;
  /** C3 (clavier MIDI) : la note est tenue jusqu'à Lecteur.relacherNote (30 s au plus). */
  tenue?: boolean;
}

/* ------------------------------------------------------------ échantillonneur (C1 : M1 consomme, BQ produit) */

/**
 * Une zone d'un instrument échantillonné : un fichier par (zone, couche de vélocité). Mêmes champs que
 * `zones[]` de `public/instruments/<id>/instrument.json` (décisions v2 §2, src/instruments/format.ts de BQ).
 * Positions en ÉCHANTILLONS du fichier DÉCODÉ (48 kHz pour l'Opus, amorce de 312 échantillons déjà retirée).
 */
export interface ZoneSource {
  /** Nom du fichier dans le dossier de l'instrument (« c4-v2.ogg », Ogg Opus), ou clé de l'échantillon d'une SoundFont. */
  fichier: string;
  /** Note MIDI jouée telle quelle par le fichier, et son accord fin (cents, −50 à 50). */
  racine: number;
  cents: number;
  /** Notes MIDI couvertes (comprises). Zones espacées d'au plus 3 demi-tons : `detune` ≤ ±150 cents. */
  bas: number;
  haut: number;
  /** Vélocités MIDI couvertes (1 à 127, comprises) : vel × 127 de la Note choisit la couche. */
  velBas: number;
  velHaut: number;
  /** Gain propre à la zone (dB). */
  gainDb: number;
  /** Partie jouée du fichier décodé (échantillons). */
  debut: number;
  fin: number;
  /** Boucle des sons tenus (échantillons, mesurés après décodage ; fondu enchaîné préparé avant l'encodage). */
  boucle?: { debut: number; fin: number };
}

/**
 * Ce que l'échantillonneur (M1) joue : un instrument de la banque (instrument.json, BQ) ou un preset de SoundFont
 * (.sf2, C3). EXACTEMENT les champs de instrument.json (décisions v2 §2) sans les métadonnées (nom, famille,
 * licence) : un InstrumentJson de src/instruments/format.ts doit lui être assignable. Données pures ; les PCM des
 * zones se lisent par lireZone (api-instruments.ts).
 */
export interface SourceZones {
  /** Id de l'instrument (« vcsl-marimba@1 », « sf2-<idSon>-<banque>-<preset>@1 »). */
  id: string;
  canaux: 1 | 2;
  /** Gain de l'instrument (dB), appliqué avant la vélocité ((vel)^1,6). */
  gainDb: number;
  /** Relâchement après la fin de la note (s). */
  relache: number;
  /** Secondes décodées au plus (plafond mémoire : 60 s mono par instrument). */
  budgetS: number;
  zones: ZoneSource[];
  /** Groupes de notes MIDI qui se coupent entre elles (charley ouvert / fermé). */
  exclusif?: number[][];
  /** Une seule note à la fois (une nouvelle note coupe la précédente ; glissé possible). */
  mono?: boolean;
}

/* ------------------------------------------------------------ inserts (C1 : M2 produit, M1 branche) */

/** La chaîne des inserts d'une piste (moteur/effets/inserts.ts, M2), branchée par le graphe entre entrée et volume. */
export interface ChaineInserts {
  readonly entree: AudioNode;
  readonly sortie: AudioNode;
  /** Paramètres automatisables : « <idInsert>.<param> » → AudioParam (automation et LFO, M2). */
  readonly params: Map<string, AudioParam>;
  /** Hors ligne : les inserts calculés en JS après le rendu (traiterInsertsJs), sinon null. */
  inserts(): import('../morceau/types').Insert[] | null;
  /** Débranche tout et arrête le worklet. */
  detruire(): void;
}

/** Échantillonneur d'une piste (moteur/instruments/echantillonneur.ts, M1). */
export interface Echantillonneur {
  /** Décode les zones des notes qui seront jouées (et seulement elles), dans le budget mémoire. */
  preparer(notes: { midi: number; vel: number }[], signal?: AbortSignal): Promise<void>;
  /** Joue une note (`detune` ≤ ±150 cents depuis la racine de sa zone) vers `sortie`. Sautée si pas prête. */
  jouer(midi: number, vel: number, quand: number, duree: number, sortie: AudioNode, options?: { glisseVers?: number }): void;
  /** Libère les tampons décodés. */
  liberer(): void;
}
