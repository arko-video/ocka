// Export, étapes de calcul : rendu du morceau (même graphe que l'écoute, dans un OfflineAudioContext SANS worklet,
// jusqu'à l'entrée du master), master et fondu appliqués en JS sur le rendu (audio/master-hors-ligne.ts, le même
// calcul que le worklet de l'écoute), puis « passe » en flux : gain, limiteur à crête vraie, mesures, et envoi de
// chaque seconde à une destination (WAV, FLAC, M4A). Mémoire : un seul tampon complet (le rendu), libéré après.

import { dureeMorceau } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { lirePcmVoix } from '../autotune/autotune';
import { lireSon } from '../sons/import';
import { LimiteurFlux } from './audio/limiteur-flux';
import { appliquerMaster, fonduFin } from './audio/master-hors-ligne';
import { retardMaster } from './audio/worklet';
import { CreteVraieFlux, enDb, picEntre } from './crete';
import { ErreurOcka } from './erreur';
import { construireGraphe, type PcmPrise } from './graphe';
import { oublierBanque } from './instruments/banque';
import { busDe, detruireBus } from './instruments/bus';
import { MesureSonie } from './sonie';
import type { PcmSon } from './types-moteur';

export const FREQ_EXPORT = 44100;
/** Marge sous le plafond de crête vraie (notre mesure × 4 contre celle d'autres outils, arrondis). */
export const MARGE_DB = 0.35;
const BLOC = FREQ_EXPORT; // 1 s

/** Temps (ms) de chaque étape du dernier export, pour le banc et le profilage. */
export const profil: Record<string, number> = {};
let repere = 0;
export function etape(nom: string): void {
  const maintenant = performance.now();
  if (nom !== 'debut') profil[nom] = Math.round(maintenant - repere);
  repere = maintenant;
}

export interface OptionsCalcul {
  surProgression?: (p: number) => void;
  signal?: AbortSignal;
}

/** Laisse respirer l'interface (et vérifie l'annulation). */
export async function pause(signal?: AbortSignal): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  if (signal?.aborted) throw new ErreurOcka('Export annulé.', 'annule');
}

/** Rendu complet du morceau (2 canaux à 44,1 kHz, retard du master retiré). Progression de 0 à 0,5. */
export async function rendre(morceau: Morceau, options: OptionsCalcul): Promise<Float32Array[]> {
  // 1. Les prises choisies (corrigées par l'autotune : l'export ATTEND la correction) et les sons importés.
  const prises = new Map<string, PcmPrise>();
  for (const p of morceau.prises) {
    if (!p.choisie || prises.has(p.fichier)) continue;
    const lu = await lirePcmVoix(p, morceau, true);
    if (lu) prises.set(p.fichier, lu);
  }
  const sons = new Map<string, PcmSon>();
  for (const s of morceau.sons ?? []) {
    const lu = await lireSon(s).catch(() => null);
    if (lu) sons.set(s.fichier, lu);
  }

  // 2. Rendu (le limiteur du master retarde le son de quelques trames : on rend un peu plus et on les saute).
  const n = Math.round(dureeMorceau(morceau) * FREQ_EXPORT);
  if (n < FREQ_EXPORT) throw new ErreurOcka('Le morceau est trop court pour être exporté (moins d’une seconde).', 'trop_court');
  // Le contexte doit exister avant le graphe : on le rend assez long pour le retard du master (retardMaster),
  // puis on retire le retard que le graphe annonce lui-même (graphe.latence, la même valeur, en secondes).
  const marge = retardMaster(FREQ_EXPORT);
  const ctx = new OfflineAudioContext(2, n + marge, FREQ_EXPORT);
  etape('prises');
  const graphe = await construireGraphe(ctx, morceau, prises, undefined, { sons });
  const masterJs = (await busDe(ctx, ctx.destination, morceau.master)).chaine.masterJs();
  const retard = Math.min(marge, Math.max(0, Math.round(graphe.latence * FREQ_EXPORT)));
  etape('graphe');
  // Planification par fenêtres de 0,5 s, toujours 0,5 s en avance : seuls les sons proches existent dans le graphe
  // (Chrome parcourt chaque nœud branché à chaque bloc de 128 trames : des milliers de sources planifiées
  // d'un coup rendaient le rendu 10 fois plus lent).
  const AVANCE = 0.5;
  graphe.planifier(0, 2 * AVANCE, 0, true);
  etape('planification+synthese');
  graphe.programmerFondu(graphe.latence);
  const total = (n + marge) / FREQ_EXPORT;
  let annule = false;
  let fini = false;
  for (let t = AVANCE; t < total; t += AVANCE) {
    void ctx.suspend(t).then(() => {
      if (annule || options.signal?.aborted) {
        // Annulé : on coupe tout et on laisse le rendu finir (en silence, donc vite) pour que le contexte
        // et son tampon soient libérés ; plus personne ne garde de référence vers eux.
        if (!annule) graphe.detruire();
        annule = true;
        void ctx.resume();
        return;
      }
      options.surProgression?.((0.5 * t) / total);
      graphe.planifier(t + AVANCE, t + 2 * AVANCE, 0);
      void ctx.resume();
    });
  }
  const rendu = await Promise.race([
    ctx.startRendering(),
    new Promise<never>((_, rejeter) => {
      const verifier = () => {
        if (annule) rejeter(new ErreurOcka('Export annulé.', 'annule'));
        else if (!fini) setTimeout(verifier, 100);
      };
      verifier();
    }),
  ]).finally(() => {
    fini = true;
    // Le contexte hors ligne ne sert plus : graphe et bus débranchés, banque vidée. Sans worklet, Chrome le libère.
    if (!annule) graphe.detruire();
    detruireBus(ctx);
    oublierBanque(ctx);
  });
  etape('rendu');
  const canaux = prendre([rendu.getChannelData(0), rendu.getChannelData(1)]) as [Float32Array, Float32Array];
  if (masterJs) {
    // Le master (colle + limiteur) et le fondu de fin, comme le worklet et le GainNode « fondu » de l'écoute.
    const fondu = fonduFin(graphe.latence, graphe.duree, morceau.fondu ?? 0);
    await appliquerMaster(canaux, masterJs, FREQ_EXPORT, fondu, () => pause(options.signal));
    etape('master');
  }
  return canaux.map((c) => c.subarray(retard, retard + n));
}

/**
 * Reprend les données des canaux du rendu (ArrayBuffer.transfer) : l'AudioBuffer est vidé et la mémoire est à nous
 * (le master y est appliqué en place), libérée après l'export, même si Chrome tardait à lâcher le contexte.
 * Les canaux peuvent partager UN ArrayBuffer (Chrome) : on transfère chaque ArrayBuffer une seule fois.
 * Sans transfer (vieux navigateur) ou s'il est refusé : les vues telles quelles.
 */
function prendre(canaux: Float32Array[]): Float32Array[] {
  type Transferable = ArrayBuffer & { transfer?: () => ArrayBuffer };
  const tampons = [...new Set(canaux.map((c) => c.buffer as Transferable))];
  if (tampons.some((b) => typeof b.transfer !== 'function')) return canaux;
  const vues = canaux.map((c) => ({ b: c.buffer as Transferable, o: c.byteOffset, n: c.length }));
  try {
    const repris = new Map(tampons.map((b) => [b, b.transfer!()] as const));
    return vues.map((v) => new Float32Array(repris.get(v.b)!, v.o, v.n));
  } catch {
    return canaux;
  }
}

export interface Bilan {
  lufs: number;
  /** Crête vraie (dBTP) du signal envoyé (NaN pour une passe d'essai). */
  crete: number;
}

/** Reçoit chaque bloc (≤ 1 s, 2 canaux) après le gain et le limiteur. Les tableaux sont réutilisés ensuite. */
export type Recepteur = (canaux: Float32Array[], n: number) => Promise<void>;

/**
 * Passe en flux sur le rendu (`canaux`, jamais modifié) : gain, limiteur à crête vraie sous `plafond` (dBTP),
 * mesures. Passe d'essai (`recepteur` = null) : seule la sonie compte. Progression de p0 à p1.
 */
export async function passe(canaux: Float32Array[], gain: number, plafond: number, recepteur: Recepteur | null, options: OptionsCalcul, p0: number, p1: number): Promise<Bilan> {
  const n = canaux[0]!.length;
  const seuil = Math.pow(10, (plafond - MARGE_DB) / 20);
  const lim = new LimiteurFlux(FREQ_EXPORT, seuil, 0.002, 0.1);
  const sonie = new MesureSonie(FREQ_EXPORT, 2);
  const crete = new CreteVraieFlux(2);
  const [g, d] = canaux as [Float32Array, Float32Array];
  const bloc = [new Float32Array(BLOC), new Float32Array(BLOC)] as [Float32Array, Float32Array];
  let rempli = 0;
  let blocs = 0;
  const vider = async () => {
    if (rempli === 0) return;
    const vue = [bloc[0].subarray(0, rempli), bloc[1].subarray(0, rempli)];
    sonie.ajouter(vue);
    if (recepteur) {
      crete.ajouter(vue);
      await recepteur(vue, rempli); // 1 s écrite tout de suite
    }
    rempli = 0;
  };
  // On ne cherche la crête entre les échantillons que près des pics (≥ −6 dB sous le seuil) : bien plus rapide.
  const candidat = (0.5 * seuil) / gain;
  for (let i = 0; i < n + lim.retard; i++) {
    let pic = 0;
    if (i < n) {
      const a = Math.abs(g[i]!);
      const b = Math.abs(d[i]!);
      pic = Math.max(a, b);
      if (pic > candidat || (i + 1 < n && Math.max(Math.abs(g[i + 1]!), Math.abs(d[i + 1]!)) > candidat)) {
        pic = Math.max(pic, picEntre(g, i), picEntre(d, i));
      }
      pic *= gain;
    }
    const gl = lim.pousser(pic);
    const j = i - lim.retard; // trame qui sort du retard
    if (j < 0) continue;
    bloc[0][rempli] = g[j]! * gain * gl;
    bloc[1][rempli] = d[j]! * gain * gl;
    rempli++;
    if (rempli === BLOC) {
      await vider();
      if (++blocs % 2 === 0) {
        options.surProgression?.(p0 + ((p1 - p0) * j) / n);
        await pause(options.signal);
      }
    }
  }
  await vider();
  return { lufs: sonie.integree(), crete: recepteur ? enDb(crete.fin()) : NaN };
}
