// Jeu des GELS dans un graphe (contrat C3, intégrateur ; voir moteur/gels.ts) : la porte de chaque piste gelée se
// ferme pendant le passage (gain 0, coupure nette au même échantillon) et le rendu gelé joue à sa place vers la
// sortie de la piste. Écoute = export : tout est programmé à chaque planification, reprise comprise.

import type { IdPiste } from '../../morceau/types';
import { gelEntier, type Gel } from '../gels';
import type { Evenement } from '../planning';
import { cles, type Banque, type Demande } from './banque';
import type { Sources } from './sources';

/** Piste d'un événement du planning (pour sauter les notes d'une piste gelée en entier). */
export function pisteEvenement(ev: Evenement): IdPiste {
  if (ev.type === 'frappe') return 'batterie';
  if (ev.type === 'basse') return 'basse';
  if (ev.type === 'accord') return 'accords';
  if (ev.type === 'boucle') return 'sons';
  return ev.piste;
}

/** Les pistes gelées en entier (leurs notes ne sont ni préparées ni jouées). */
export function pistesGeleesEntieres(gels: readonly Gel[], duree: number): Set<IdPiste> {
  return new Set(gels.filter((g) => gelEntier(g, duree)).map((g) => g.piste));
}

/** Demandes de la banque : chaque rendu gelé, à la fréquence du contexte (Worker, travail « frequence »). */
export function demandesGels(gels: readonly Gel[]): Demande[] {
  return gels.map((g) => ({ cle: cles.gel(g.cle), travail: () => ({ type: 'frequence', canaux: g.pcm.canaux, de: g.pcm.frequence }), priorite: Math.max(0, g.de) }));
}

export interface JeuGels {
  /** Programme portes et rendus gelés pour [de, a[ (temps du morceau ; `origine` = heure du temps 0). */
  planifier(de: number, a: number, origine: number, reprise: boolean): void;
}

/**
 * `portes` : la porte (GainNode) de chaque piste gelée, entre sa tranche et sa sortie ; `sorties` : la sortie réelle
 * (bus du master ou nœud de piste séparée). `sauter` : compte un rendu pas prêt (comme une note sautée).
 */
// prettier-ignore
export function creerJeuGels(ctx: BaseAudioContext, gels: readonly Gel[], banque: Banque, sources: Sources, portes: ReadonlyMap<IdPiste, GainNode>, sorties: ReadonlyMap<IdPiste, AudioNode>, sauter: () => void): JeuGels {
  return {
    planifier(de, a, origine, reprise) {
      if (reprise) {
        // Reprise (saut, relais, début du rendu) : on oublie le programme d'avant, la porte prend l'état de `de`.
        for (const [id, porte] of portes) {
          const dedans = gels.some((g) => g.piste === id && g.de <= de && g.a > de);
          porte.gain.cancelScheduledValues(ctx.currentTime);
          porte.gain.setValueAtTime(dedans ? 0 : 1, ctx.currentTime);
        }
      }
      for (const g of gels) {
        const porte = portes.get(g.piste);
        const sortie = sorties.get(g.piste);
        if (!porte || !sortie) continue;
        const tFin = origine + g.a;
        if (g.de >= de && g.de < a) {
          porte.gain.setValueAtTime(0, Math.max(0, origine + g.de));
          jouer(g, origine + g.de, 0, tFin, sortie);
        } else if (reprise && g.de < de && g.a > de) jouer(g, origine + de, de - g.de, tFin, sortie);
        if (g.a >= de && g.a < a) porte.gain.setValueAtTime(1, tFin);
      }
    },
  };

  function jouer(g: Gel, quand: number, decalage: number, arret: number, sortie: AudioNode) {
    const p = banque.lire(cles.gel(g.cle));
    if (!p) return void sauter();
    if (p.buffer.duration - decalage <= 0) return;
    sources.jouer(p.buffer, quand, 1, [sortie], { decalage, genre: 'long', arret, fonduSortie: 0 });
  }
}
