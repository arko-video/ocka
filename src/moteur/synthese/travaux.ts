// Les travaux de synthèse : tout ce que le moteur calcule AVANT la lecture (notes, frappes, 808, réverbes,
// prises et sons rééchantillonnés). Pur JS : le MÊME code tourne dans le Worker de synthèse et, en secours,
// sur le fil principal (tests, navigateur sans Worker). Même entrée → mêmes échantillons, au bit près.

import type { EffetPerf, InstrumentBatterie, ReglagesSynthe } from '../../morceau/types';
import type { NoteMotifSynthe } from '../api-synthes';
import { synthetiserFrappe } from '../instruments/batterie';
import { caler, preparerPad, versFrequence } from '../instruments/importes';
import { synthetiser808 } from '../instruments/melodiques';
import { synthetiserMotif, synthetiserNote } from '../instruments/notes';
import { appliquerEffetPerf } from '../effets-perf';
import { avecFrequence } from './briques';
import { reponseReverbe } from './effets';

export type Travail =
  | { type: 'frappe'; kit: string; instrument: InstrumentBatterie }
  | { type: 'basse'; style: string; midi: number; duree: number; cible?: number }
  /** Note sans durée d'un son v1 ou d'un synthé de C3 (id court) ; `reglages` = PisteInstrument.synthe. */
  | { type: 'note'; son: string; variante: string; midi: number; reglages?: ReglagesSynthe }
  /** C3 — passage d'un motif d'un synthé « motif » (303) : un tampon pour tout le passage. */
  | { type: 'motif'; son: string; notes: NoteMotifSynthe[]; duree: number; reglages?: ReglagesSynthe }
  /** C3 — effet de performance (R) appliqué à un passage gelé (rendu de pistes séparées), dans ce Worker. */
  | { type: 'perf'; canaux: Float32Array[]; effet: EffetPerf; secondesParPas: number }
  | { type: 'reverbe'; taille: number; duree: number }
  /** Prise de voix ou son importé : rééchantillonné (sinc) à la fréquence du contexte. */
  | { type: 'frequence'; canaux: Float32Array[]; de: number }
  /** Pad perso : silence de début coupé, fréquence du contexte, crête du kit. */
  | { type: 'pad'; canaux: Float32Array[]; de: number; crete: number }
  /** Boucle calée : exactement `longueur` échantillons à la fréquence du contexte. */
  | { type: 'caler'; canaux: Float32Array[]; longueur: number };

export interface Resultat {
  canaux: Float32Array[];
  /** Boucle [début, fin] (s) des sons tenus. */
  boucle?: [number, number];
}

/** Exécute un travail à la fréquence `frequence` (celle du contexte audio qui jouera le son). */
export function executer(t: Travail, frequence: number): Resultat {
  return avecFrequence(frequence, (): Resultat => {
    switch (t.type) {
      case 'frappe':
        return { canaux: [synthetiserFrappe(t.kit, t.instrument)] };
      case 'basse':
        return { canaux: [synthetiser808(t.style, t.midi, t.duree, t.cible)] };
      case 'note':
        return synthetiserNote(t.son, t.variante, t.midi, t.reglages);
      case 'motif':
        return { canaux: synthetiserMotif(t.son, t.notes, t.duree, t.reglages) };
      case 'perf':
        return { canaux: appliquerEffetPerf(t.canaux, frequence, t.effet, t.secondesParPas) };
      case 'reverbe':
        return { canaux: reponseReverbe(t.taille, t.duree) };
      case 'frequence':
        return { canaux: versFrequence(t.canaux, t.de, frequence) };
      case 'pad':
        return { canaux: preparerPad(t.canaux, t.de, frequence, t.crete) };
      case 'caler':
        return { canaux: caler(t.canaux, t.longueur) };
    }
  });
}
