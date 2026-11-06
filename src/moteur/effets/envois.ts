// Les 2 bus d'envoi PARTAGÉS (propriétaire : M2) : réverbe (la même que la voix, 0,75 / 2,2 s) et écho (croche
// pointée au tempo, effets-voix.ts). Un bus par (contexte, sortie, tempo) : toutes les pistes qui vont au master
// partagent les mêmes ; une piste séparée (stems) a les siens, qui reviennent dans SA sortie. La réverbe et l'écho
// sont linéaires : Σ des pistes séparées = mélange avant le master. Comptés : libérés au départ de la dernière piste
// (pendant un relais, l'ancien et le nouveau graphe gardent le même bus : les queues continuent).

import { creerEcho } from '../audio/effets-voix';
import { banqueDe } from '../instruments/banque';

export type Vers = 'reverbe' | 'echo';

interface Bus {
  entree: AudioNode;
  noeuds: AudioNode[];
  utilisateurs: number;
}

const tous = new WeakMap<BaseAudioContext, Map<AudioNode, Map<string, Bus>>>();

/** Entrée du bus `vers` (créé au 1er appel) ; `liberer()` à appeler une fois quand la piste n'en a plus besoin. */
export function prendreEnvoi(ctx: BaseAudioContext, sortie: AudioNode, vers: Vers, tempo: number): { entree: AudioNode; liberer(): void } {
  let parSortie = tous.get(ctx);
  if (!parSortie) tous.set(ctx, (parSortie = new Map()));
  let parCle = parSortie.get(sortie);
  if (!parCle) parSortie.set(sortie, (parCle = new Map()));
  const cle = vers === 'echo' ? `echo|${tempo}` : 'reverbe';
  let bus = parCle.get(cle);
  if (!bus) {
    if (vers === 'reverbe') {
      const conv = ctx.createConvolver();
      conv.buffer = banqueDe(ctx).reverbe(0.75, 2.2);
      conv.connect(sortie);
      bus = { entree: conv, noeuds: [conv], utilisateurs: 0 };
    } else {
      const e = creerEcho(ctx, 1, tempo > 0 ? tempo : 120);
      e.sortie.connect(sortie);
      bus = { entree: e.entree, noeuds: e.noeuds, utilisateurs: 0 };
    }
    parCle.set(cle, bus);
  }
  const b = bus;
  b.utilisateurs++;
  let libre = false;
  return {
    entree: b.entree,
    liberer() {
      if (libre) return;
      libre = true;
      if (--b.utilisateurs > 0) return;
      for (const n of b.noeuds) n.disconnect();
      parCle.delete(cle);
    },
  };
}
