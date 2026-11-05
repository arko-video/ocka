// Le type du graphe audio d'un morceau (construit par graphe.ts), à part pour garder graphe.ts court.

import type { InstrumentBatterie, SonMelodie } from '../../morceau/types';

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
  /** Planifie [de, a[ ; `reprise` : aussi la suite des sons tenus déjà commencés (fondu de relais si `relais`). */
  planifier(de: number, a: number, origine: number, reprise?: boolean, relais?: boolean): void;
  /** Ajoute le fondu de fin pour une lecture dont le temps 0 tombe à `origine`. */
  programmerFondu(origine: number): void;
  /** Joue un son de batterie seul, tout de suite (perso1 à perso4 : le son importé du pad). */
  entendre(instrument: InstrumentBatterie): void;
  /** Joue une note de mélodie seule, tout de suite (sautée et préparée si elle n'est pas prête). */
  entendreNote(son: SonMelodie, midi: number): void;
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
