// Calculs (purs) pour placer une prise sur le beat. Toutes les durées sont en secondes.
//
// Convention d'OCKA (à respecter par le moteur pour l'écoute et l'export) :
//   le son du fichier au temps x tombe au temps du morceau  debutAncre + (x − debutCoupe) − decalage.
// - debutCoupe : là où l'ancre commence dans le fichier, d'après les horloges (le décompte est retiré) ;
// - decalage   : latence aller-retour (sortie + entrée) mesurée au calibrage : ce qu'on chante en
//                réponse au beat arrive dans le fichier `decalage` secondes trop tard.
import type { Prise } from '../morceau/types';
// Le début d'une ancre se calcule avec positionAncre (src/morceau/temps.ts, écrit par le dev moteur).

/** Durée d'une mesure de 4/4 (4 noires) au tempo donné. */
export function dureeMesure(tempo: number): number {
  return 240 / tempo;
}

/** Repères relevés pendant l'enregistrement. */
export interface Reperes {
  /** Heure du contexte (comme ctx.currentTime) où le lecteur a joué le début de l'ancre. */
  heureAncre: number;
  /** N° d'échantillon (horloge du contexte, `currentFrame`) du 1er échantillon du fichier. */
  premierFrame: number;
  /** Fréquence du contexte (= du fichier). */
  frequence: number;
  /** Nombre d'échantillons du fichier. */
  echantillons: number;
  /** Latence aller-retour à retirer. */
  latence: number;
}

/** Calcule debutCoupe, finCoupe, duree et decalage d'une nouvelle prise. */
export function calculerAlignement(r: Reperes): Pick<Prise, 'debutCoupe' | 'finCoupe' | 'duree' | 'decalage'> {
  const duree = r.echantillons / r.frequence;
  let debutCoupe = r.heureAncre - r.premierFrame / r.frequence;
  let decalage = r.latence;
  // Cas rare : la capture a commencé après l'ancre. On garde la même place en reportant l'écart sur le décalage.
  if (debutCoupe < 0) {
    decalage += debutCoupe;
    debutCoupe = 0;
  }
  return { duree, debutCoupe: Math.min(debutCoupe, duree), finCoupe: duree, decalage };
}

/**
 * Où jouer une prise (pour l'écoute et l'export) : à partir du temps `quand` du morceau,
 * jouer le fichier de `depuis` à `jusqua` (secondes dans le fichier). Rien n'est joué avant l'ancre.
 */
export function placerPrise(
  prise: Pick<Prise, 'debutCoupe' | 'finCoupe' | 'decalage'>,
  debutDeLAncre: number,
): { quand: number; depuis: number; jusqua: number } {
  const depuis = Math.max(0, prise.debutCoupe + Math.max(0, prise.decalage));
  const quand = debutDeLAncre + (depuis - prise.debutCoupe) - prise.decalage;
  return { quand, depuis, jusqua: Math.max(depuis, prise.finCoupe) };
}
