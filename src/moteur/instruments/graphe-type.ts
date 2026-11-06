// Le type du graphe audio d'un morceau (construit par graphe.ts), à part pour garder graphe.ts court.

import type { InstrumentBatterie, IdPiste } from '../../morceau/types';
import type { OptionsNote } from '../types-moteur';

/** Le son d'une prise, tel que donné par lirePrise (mono, à sa fréquence d'enregistrement). */
export interface PcmPrise {
  frequence: number;
  pcm: Float32Array;
  /** Fichier corrigé par l'autotune (src/autotune) que ce PCM contient ; absent = la prise brute. */
  version?: string;
}

export interface Graphe {
  readonly duree: number;
  /** Retard (s) ajouté par la chaîne du master : l'export le retire. */
  readonly latence: number;
  /** Tous les sons du morceau sont prêts (construireGraphe l'attend déjà ; le lecteur, lui, choisit). */
  readonly pret: Promise<void>;
  /** Prêts pour commencer l'écoute : gamme de la mélodie et premières secondes depuis la position demandée. */
  readonly debut: Promise<void>;
  /** Sons sautés par ce graphe (pas prêts au moment de les jouer). */
  readonly sautees: number;
  /** Notes muettes : instrument que ce moteur ne sait pas (encore) jouer (contrat C0 ; échantillonneur en C1, M1). */
  readonly muettes: number;
  /** Instruments échantillonnés absents du téléphone (ou inconnus) : leurs notes sont muettes (écoute seulement). */
  readonly instrumentsManquants: readonly string[];
  /** Pitch bend (cents) des pistes instrument dont l'automation ou un LFO vise « hauteur » (pour M2). */
  readonly hauteurs: ReadonlyMap<string, AudioParam>;
  /** Planifie [de, a[ ; `reprise` : aussi la suite des sons tenus déjà commencés (fondu de relais si `relais`). */
  planifier(de: number, a: number, origine: number, reprise?: boolean, relais?: boolean): void;
  /** Ajoute le fondu de fin pour une lecture dont le temps 0 tombe à `origine`. */
  programmerFondu(origine: number): void;
  /** Joue un son de batterie seul, tout de suite (perso1 à perso4 : le son importé du pad). */
  entendre(instrument: InstrumentBatterie): void;
  /**
   * Joue une note seule sur une piste instrument, tout de suite (sautée et préparée si elle n'est pas prête).
   * `options.instrument` : faire entendre un autre instrument sur cette piste (choix d'instrument). Instrument
   * inconnu ou piste absente : rien (compté dans `muettes`).
   */
  entendreNote(piste: IdPiste, midi: number, options?: OptionsNote): void;
  /** A/B du master (ChaineMaster.contourner de M2). */
  comparer(sans: boolean, compensationDb: number): void;
  /** Retire le fondu de fin (lecture en boucle sur une section). */
  annulerFondu(): void;
  /** Coupe tous les sons planifiés (fondu de 2 ms : pas de clic). */
  arreter(): void;
  /** Relais à `quand` : les sons tenus s'effacent en 10 ms (le nouveau graphe les reprend), puis autodestruction. */
  relayer(quand: number): Promise<void>;
  /** Débranche tout le graphe (pas le bus master, qui est persistant). */
  detruire(): void;
}
