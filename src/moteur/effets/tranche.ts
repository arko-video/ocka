// La TRANCHE d'une piste (propriétaire : M2, vague C1) : ce que creerPiste (chaines.ts) construit quand il reçoit
// le morceau.
//   entrée → inserts (chaine-inserts.ts) → volume (fader : volume, muet, solo) → [sidechain] → [automation]
//          → panoramique (+ décalage automatisé) → sortie (bus master ou piste séparée)
// Fader, sidechain et automation sont 3 gains SÉPARÉS (décisions v2 §3), créés seulement s'ils servent : une piste
// sans rien de tout ça a EXACTEMENT les nœuds d'avant (entrée → volume → panoramique), donc le même son.
// Envois (réverbe, écho) : pris à leur place dans les inserts, puis suivent le fader, le sidechain et l'automation
// (des copies des mêmes gains, programmées pareil) vers les bus partagés de la même sortie (envois.ts).
// La hauteur (pistes instrument) est un signal du jeu échantillonné de M1 (Graphe.hauteurs) : M1 le programme avec
// programmerAutomation (clé « hauteur »).

import type { Cible, Morceau, Piste } from '../../morceau/types';
import { mouvement, programmerAutomation } from '../automation';
import { gainPiste, type ChainePiste } from '../chaines';
import { sourceSidechain } from '../sidechain';
import { creerChaineInserts } from './chaine-inserts';
import { prendreEnvoi } from './envois';
import { programmerParam } from './programme';

export interface ChaineTranche extends ChainePiste {
  planifier(de: number, a: number, origine: number): void;
  detruire(): void;
}

export function creerTranche(ctx: BaseAudioContext, m: Morceau, p: Piste, toutes: Piste[], sortie: AudioNode): ChaineTranche {
  const horsLigne = 'startRendering' in ctx;
  const vise = (c: Cible) => mouvement(m, p, c) !== null;
  const avecInserts = (p.inserts ?? []).some((i) => i.actif);
  const chaine = avecInserts ? creerChaineInserts(ctx, p, horsLigne, m) : null;
  const entree = (chaine?.entree as GainNode | undefined) ?? ctx.createGain();
  const noeuds: AudioNode[] = [entree];
  const sources: AudioScheduledSourceNode[] = [];
  const fader = gainPiste(p, toutes);
  const volume = ctx.createGain();
  volume.gain.value = fader;
  const pan = ctx.createStereoPanner();
  pan.pan.value = p.pan;
  noeuds.push(volume, pan);
  const sc = sourceSidechain(m, p.id);
  const autoVolume = vise({ type: 'volume' });

  // Les gains après le fader (et leurs copies pour chaque envoi) : [sidechain] → [automation].
  const gainsSc: AudioParam[] = [];
  const gainsAuto: AudioParam[] = [];
  const apresFader = (depart: AudioNode): AudioNode => {
    let bout = depart;
    for (const [besoin, liste] of [
      [!!sc, gainsSc],
      [autoVolume, gainsAuto],
    ] as const) {
      if (!besoin) continue;
      const g = ctx.createGain();
      noeuds.push(g);
      liste.push(g.gain);
      bout.connect(g);
      bout = g;
    }
    return bout;
  };

  if (chaine?.prise) chaine.sortie.connect(sortie);
  else {
    (chaine?.sortie ?? entree).connect(volume);
    apresFader(volume).connect(pan).connect(sortie);
  }

  // Panoramique et hauteur automatisés : un décalage ajouté au paramètre (le panoramique borne la somme).
  const params = new Map<string, AudioParam>(chaine?.params ?? []);
  const constante = () => {
    const c = new ConstantSourceNode(ctx, { offset: 0 });
    c.start();
    sources.push(c);
    noeuds.push(c);
    return c;
  };
  if (gainsAuto[0]) params.set('volume', gainsAuto[0]);
  if (vise({ type: 'pan' })) {
    const c = constante();
    c.connect(pan.pan);
    params.set('pan', c.offset);
  }

  // Envois : niveau (dans l'insert) → copie du fader → copies sidechain / automation → bus partagé.
  const liberer: (() => void)[] = [];
  for (const e of chaine?.envois ?? []) {
    const f = ctx.createGain();
    f.gain.value = fader;
    noeuds.push(f);
    e.gain.connect(f);
    const bus = prendreEnvoi(ctx, sortie, e.vers, m.tempo);
    apresFader(f).connect(bus.entree);
    liberer.push(bus.liberer);
  }

  return {
    entree,
    volume,
    pan,
    planifier(de, a, origine) {
      chaine?.planifier(m, de, a, origine);
      programmerAutomation(m, p.id, params, de, a, origine);
      for (const g of gainsAuto.slice(1)) programmerAutomation(m, p.id, new Map([['volume', g]]), de, a, origine);
      if (sc) for (const g of gainsSc) programmerParam(g, sc, de, a, origine);
    },
    detruire() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* déjà arrêtée */
        }
      }
      for (const n of noeuds) n.disconnect();
      chaine?.detruire();
      for (const l of liberer) l();
    },
  };
}
