// Banc CPU des tranches de M2 : 8 pistes × 3 inserts (égaliseur, compresseur = 1 worklet par piste, chorus modulé),
// plus automation, LFO et sidechain, dans un VRAI AudioContext, planifiées comme le lecteur (toutes les 25 ms,
// 200 ms d'avance). Mesures : coupures de la sortie (AudioContext.playbackStats), fenêtres planifiées en retard,
// temps passé à planifier (fil principal), et charge du rendu (même graphe hors ligne avec worklets, temps / durée).

import { nouveauMorceau } from '../../src/morceau/styles';
import type { Morceau, Piste } from '../../src/morceau/types';
import { creerPiste, type ChainePiste } from '../../src/moteur/chaines';
import { optionsInserts } from '../../src/moteur/effets/chaine-inserts';
import { chargerInserts } from '../../src/moteur/effets/worklet-inserts';
import { FS, ins, signal } from './banc-effets';

/** Morceau à 8 pistes (5 fixes + 3 instrument), chacune avec 3 inserts ; automation / LFO / sidechain sur certaines. */
export function morceauCpu(): Morceau {
  const m = nouveauMorceau('trap', 'CPU');
  const sec = Object.create(null);
  for (const s of m.sections) sec[s.id] = [{ pas: 0, valeur: 0.5 }, { pas: 32, valeur: 1 }];
  const regler = (p: Piste, k: number): Piste => ({
    ...p,
    inserts: [ins('eq', 'eq', { grave: 3, aigu: -2 }), ins('compresseur', 'comp'), ins('chorus', 'ch', { vitesse: 0.5 + k / 10 })],
    ...(k % 2 === 0 ? { sidechain: { source: 'kick' as const, force: 0.6, relache: 0.15 } } : {}),
    auto: [{ cible: { type: 'insert', insert: 'eq', param: 'aigu' }, sections: sec }],
    lfo: [{ cible: { type: 'pan' }, forme: 'sinus', periode: 16, profondeur: 0.5, phase: k / 8 }],
  });
  const instruments: Piste[] = [1, 2, 3].map((i) => ({ id: `p${i}`, genre: 'instrument', nom: `P${i}`, instrument: 'ocka-piano@1', volume: 0.5, pan: 0, muet: false, solo: false }));
  const pistes = [...m.pistes, ...instruments].slice(0, 8).map(regler);
  return { ...m, pistes };
}

function brancher(ctx: BaseAudioContext, m: Morceau): ChainePiste[] {
  const total = 10 * FS;
  return m.pistes.map((p, k) => {
    const c = creerPiste(ctx, p, m.pistes, ctx.destination, m);
    const src = new AudioBufferSourceNode(ctx, { buffer: signal(p.id, total, k % 3), loop: true });
    src.connect(c.entree);
    src.start(0);
    return c;
  });
}

/** Écoute réelle pendant `secondes` ; renvoie les relevés. */
export async function ecouter(secondes: number) {
  const m = morceauCpu();
  const ctx = new AudioContext({ sampleRate: FS });
  await chargerInserts(ctx);
  await ctx.resume();
  const chaines = brancher(ctx, m);
  const origine = ctx.currentTime + 1.1;
  let prochain = 0;
  let enRetard = 0;
  let planification = 0;
  let tics = 0;
  const stats = () => (ctx as unknown as { playbackStats?: { underrunEvents: number; underrunDuration: number; totalDuration: number } }).playbackStats;
  const lire = () => {
    const s = stats();
    return s ? { underrunEvents: s.underrunEvents, underrunDuration: s.underrunDuration, totalDuration: s.totalDuration } : null;
  };
  // Mesure après 1 s de chauffe (démarrage du contexte et du worklet, non compté).
  await new Promise((ok) => setTimeout(ok, 1000));
  const avant = lire() ?? { underrunEvents: 0, underrunDuration: 0, totalDuration: 0 };
  const t0 = performance.now();
  await new Promise<void>((fini) => {
    const id = setInterval(() => {
      const d = performance.now();
      const a = ctx.currentTime + 0.2 - origine;
      if (origine + prochain < ctx.currentTime) enRetard++;
      if (a > prochain) for (const c of chaines) c.planifier?.(prochain, a, origine);
      prochain = Math.max(prochain, a);
      planification += performance.now() - d;
      tics++;
      if (performance.now() - t0 > secondes * 1000) {
        clearInterval(id);
        fini();
      }
    }, 25);
  });
  const apres = lire();
  chaines.forEach((c) => c.detruire?.());
  await ctx.close();
  return {
    coupures: apres ? apres.underrunEvents - avant.underrunEvents : null,
    dureeCoupuresMs: apres ? 1000 * (apres.underrunDuration - avant.underrunDuration) : null,
    secondesJouees: apres ? apres.totalDuration - avant.totalDuration : null,
    fenetresEnRetard: enRetard,
    planificationMsParSeconde: planification / secondes,
    tics,
  };
}

/** Charge du rendu audio : le même graphe hors ligne AVEC les worklets, temps de calcul / durée du son. */
export async function chargeRendu(secondes: number): Promise<number> {
  const m = morceauCpu();
  const ctx = new OfflineAudioContext(2, secondes * FS, FS);
  optionsInserts.workletHorsLigne = true;
  await chargerInserts(ctx);
  const chaines = brancher(ctx, m);
  for (const c of chaines) c.planifier?.(0, secondes, 0);
  const t = performance.now();
  await ctx.startRendering();
  optionsInserts.workletHorsLigne = false;
  chaines.forEach((c) => c.detruire?.());
  return (performance.now() - t) / 1000 / secondes;
}
