// Interfaces INTERNES du moteur, figées par le contrat de la vague A (M1 graphe/lecteur, M2 effets, A2 fichiers).
// L'interface (src/ui) ne les voit pas : elle passe par api.ts. Changement = demande dans le rapport.

import type { IdPiste, Master } from '../morceau/types';

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
   */
  pistesSeparees?: Partial<Record<IdPiste, AudioNode>>;
  /** PCM des sons importés, par clé de fichier (SonImporte.fichier), comme la Map des prises. */
  sons?: Map<string, PcmSon>;
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
