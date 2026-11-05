// Bus master PERSISTANT : créé UNE fois par contexte audio (et par destination), gardé d'un charger() à l'autre.
//   pistes → pré-gain (−3 dB) → chaîne master de M2 (couleur → colle → limiteur) → fondu de fin → destination
// + la réverbe de la caisse claire (convolution) : son envoi et son retour sont partagés par tous les graphes.
// charger() ne refait que les pistes et les sources ; detruireBus() débranche tout (fin du lecteur).

import type { Master } from '../../morceau/types';
import { creerReverbeCaisse } from '../chaines';
import { creerChaineMaster } from '../master';
import type { ChaineMaster } from '../types-moteur';
import { banqueDe } from './banque';

/** Gain de pré-master (−3 dB) : laisse de la marge avant le limiteur. */
export const PRE_MASTER = 0.7;
/** Niveau d'envoi vers la réverbe de la caisse claire et du clap (phase 1). */
export const ENVOI_CAISSE = 0.22;
/** Réverbes calculées dans le Worker dès la création du bus (caisse claire ; voix : préréglages de M2). */
const REVERBES: [number, number][] = [
  [0.55, 1.2],
  [0.75, 2.2],
];

export interface Bus {
  /** On y branche les pistes (pré-gain). */
  readonly entree: GainNode;
  readonly chaine: ChaineMaster;
  /** Fondu de fin du morceau (partagé : le graphe courant le programme). */
  readonly fondu: GainNode;
  /** Les sons de caisse claire et de clap s'y branchent (envoi vers la réverbe, déjà au bon niveau). */
  readonly envoiCaisse: AudioNode;
  /** Sortie de la réverbe : chaque graphe la branche sur SA piste batterie (par un gain à lui, pour le relais). */
  readonly retourCaisse: GainNode;
  readonly destination: AudioNode;
  detruire(): void;
}

const tous = new WeakMap<BaseAudioContext, Map<AudioNode, Promise<Bus>>>();

async function creerBus(ctx: BaseAudioContext, destination: AudioNode, master: Master): Promise<Bus> {
  const banque = banqueDe(ctx);
  // Réverbes calculées dans le Worker : les chaînes (M2) les lisent ensuite sans calcul sur le fil principal.
  await Promise.all(REVERBES.map(([t, d]) => banque.prechargerReverbe(t, d).catch(() => {})));
  const chaine = await creerChaineMaster(ctx, master);
  const entree = ctx.createGain();
  entree.gain.value = PRE_MASTER;
  const fondu = ctx.createGain();
  entree.connect(chaine.entree);
  // Hors ligne, le master et le fondu sont appliqués en JS après le rendu (master-hors-ligne.ts) : le fondu reste
  // débranché (le graphe le programme quand même, sans effet).
  if (chaine.masterJs()) chaine.sortie.connect(destination);
  else chaine.sortie.connect(fondu).connect(destination);
  const retourCaisse = ctx.createGain();
  const envoiCaisse = creerReverbeCaisse(ctx, banque, retourCaisse, ENVOI_CAISSE);
  return {
    entree,
    chaine,
    fondu,
    envoiCaisse,
    retourCaisse,
    destination,
    detruire() {
      envoiCaisse.disconnect();
      retourCaisse.disconnect();
      entree.disconnect();
      chaine.detruire();
      fondu.disconnect();
    },
  };
}

/** Le bus du contexte vers `destination` (créé au premier appel), réglé sur le master du morceau. */
export async function busDe(ctx: BaseAudioContext, destination: AudioNode, master: Master): Promise<Bus> {
  let parDestination = tous.get(ctx);
  if (!parDestination) tous.set(ctx, (parDestination = new Map()));
  let p = parDestination.get(destination);
  if (!p) {
    p = creerBus(ctx, destination, master);
    parDestination.set(destination, p);
    p.catch(() => parDestination.delete(destination)); // on pourra réessayer
  }
  const bus = await p;
  bus.chaine.regler(master);
  return bus;
}

/** Débranche les bus du contexte (lecteur détruit). Le prochain graphe en recréera un. */
export function detruireBus(ctx: BaseAudioContext): void {
  const parDestination = tous.get(ctx);
  if (!parDestination) return;
  tous.delete(ctx);
  for (const p of parDestination.values()) void p.then((b) => b.detruire()).catch(() => {});
}
