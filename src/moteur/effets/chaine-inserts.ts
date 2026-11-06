// La chaîne des inserts d'une piste (propriétaire : M2, vague C1), derrière l'interface ChaineInserts.
//   entrée → inserts natifs d'avant → [ÉTAPE JS] → (√½ si piste mono) → inserts natifs d'après → sortie
// L'ÉTAPE JS calcule ENSEMBLE, à la place du 1er d'entre eux, les compresseurs et bitcrushers actifs (dans leur
// ordre) ; les inserts natifs placés entre eux passent après. Elle est en stéréo explicite (comme le worklet) :
//  - écoute : le worklet « ocka-inserts » (en attendant son chargement, le son passe tel quel) ;
//  - export : le son d'après l'étape a été calculé en JS sur une passe A (preparer.ts) et il est rejoué ici par
//    un AudioBufferSourceNode ; sans passe A, le son passe tel quel (pas de worklet hors ligne, jamais) ;
//  - passe A elle-même (registre.prises) : la chaîne s'arrête à l'entrée de l'étape, sans envois.
// Une piste dont la source est mono (basse, batterie en chaîne 1) gagnerait 3 dB au panoramique en passant en
// stéréo : l'étape la ramène à √½ (même niveau au centre qu'en mono).

import type { Insert, Morceau, Piste } from '../../morceau/types';
import { convertisseurs, mouvement, valeurReelle } from '../automation';
import type { ChaineInserts } from '../types-moteur';
import { estJs, NOM_INSERTS, reglage, reglagesJs } from './dsp';
import { creerBloc, type BlocInsert } from './natifs';
import { programmerParam, sourceGrille, type SourceAuto } from './programme';
import { prises, rendus, type RenduJs } from './registre';
import { chargerInserts, insertsCharges } from './worklet-inserts';

/** Tests (QA) seulement : true met le worklet dans les contextes hors ligne (comparaison worklet / JS). */
export const optionsInserts = { workletHorsLigne: false };

export interface ChaineInsertsM2 extends ChaineInserts {
  /** Prises d'envoi (réverbe / écho) de la chaîne : la tranche les branche sur les bus partagés. */
  readonly envois: NonNullable<BlocInsert['envoi']>[];
  /** Passe A : la sortie est l'entrée de l'étape JS (la tranche la branche telle quelle, sans fader). */
  readonly prise: boolean;
  /** Démarre les modulations, cale l'étape JS et programme les modulations pour ]de, a]. */
  planifier(m: Morceau, de: number, a: number, origine: number): void;
}

const piste1 = (p: Piste, m?: Morceau) => p.id === 'basse' || (p.id === 'batterie' && !!m && m.master.chaine !== 2);

/** La chaîne des inserts d'une piste. `horsLigne` : export (aucun worklet). `m` : morceau (automation, mono). */
export function creerChaineInserts(ctx: BaseAudioContext, piste: Piste, horsLigne: boolean, m?: Morceau): ChaineInsertsM2 {
  const actifs = (piste.inserts ?? []).filter((i) => i.actif);
  const auto = new Set<string>();
  for (const c of [...(piste.auto ?? []), ...(piste.lfo ?? [])]) if (c.cible.type === 'insert') auto.add(`${c.cible.insert}.${c.cible.param}`);
  const premierJs = actifs.findIndex(estJs);
  const avant = premierJs < 0 ? actifs : actifs.slice(0, premierJs);
  const apres = premierJs < 0 ? [] : actifs.slice(premierJs).filter((i) => !estJs(i));
  const prise = premierJs >= 0 && (prises.get(ctx)?.has(piste.id) ?? false);
  const blocs: BlocInsert[] = [];
  const noeuds: AudioNode[] = [];
  const entree = ctx.createGain();
  noeuds.push(entree);
  let bout: AudioNode = entree;
  const ajouter = (ins: Insert) => {
    const b = creerBloc(ctx, ins, auto);
    blocs.push(b);
    noeuds.push(...b.noeuds);
    bout.connect(b.entree);
    bout = b.sortie;
  };
  avant.forEach(ajouter);

  // Étape JS.
  let worklet: AudioWorkletNode | null = null;
  let rendu: RenduJs | null = null;
  let source: AudioBufferSourceNode | null = null;
  let detruit = false;
  let origineJs: { o: number; t: number } | null = null;
  if (premierJs >= 0) {
    const js = reglagesJs(actifs);
    const etape = ctx.createGain();
    etape.channelCount = 2;
    etape.channelCountMode = 'explicit';
    etape.channelInterpretation = 'speakers';
    noeuds.push(etape);
    bout.connect(etape);
    if (prise) {
      bout = etape;
    } else {
      const sortieJs = ctx.createGain();
      sortieJs.gain.value = piste1(piste, m) ? Math.SQRT1_2 : 1;
      noeuds.push(sortieJs);
      const enWorklet = !horsLigne || optionsInserts.workletHorsLigne;
      const creerWorklet = () => {
        worklet = new AudioWorkletNode(ctx, NOM_INSERTS, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
          processorOptions: { inserts: js },
        });
        etape.connect(worklet).connect(sortieJs);
        if (origineJs) caler(origineJs.o, origineJs.t);
      };
      rendu = horsLigne ? (rendus.get(ctx)?.get(piste.id) ?? null) : null;
      if (enWorklet && insertsCharges(ctx)) creerWorklet();
      else if (enWorklet) {
        // Pas encore chargé : le son passe tel quel, puis le worklet prend sa place.
        etape.connect(sortieJs);
        void chargerInserts(ctx)
          .then(() => {
            if (detruit) return;
            etape.disconnect(sortieJs);
            creerWorklet();
          })
          .catch(() => {});
      } else if (rendu) {
        source = new AudioBufferSourceNode(ctx, { buffer: rendu.tampon });
        const separe = ctx.createChannelSplitter(rendu.tampon.numberOfChannels);
        const fusion = ctx.createChannelMerger(2);
        source.connect(separe);
        separe.connect(fusion, rendu.canal, 0);
        separe.connect(fusion, rendu.canal + 1, 1);
        fusion.connect(sortieJs);
        noeuds.push(source, separe, fusion);
      } else etape.connect(sortieJs);
      bout = sortieJs;
      apres.forEach(ajouter);
    }
  }
  function caler(o: number, t: number) {
    if (!worklet) return;
    const haut = Math.floor(o / 4096);
    worklet.parameters.get('origineHaut')!.setValueAtTime(haut, t);
    worklet.parameters.get('origineBas')!.setValueAtTime(o - haut * 4096, t);
  }

  const params = new Map<string, AudioParam>();
  for (const b of blocs) for (const x of b.params) params.set(x.cle, x.param);
  // Convertisseurs (Q en dB…) lus par programmerAutomation.
  for (const b of blocs) for (const x of b.params) if (x.conv) convertisseurs.set(x.param, x.conv);
  const sources = blocs.flatMap((b) => b.sources);
  let demarre = false;
  let origineAvant: number | null = null;
  const mods = new Map<AudioParam, SourceAuto>();

  return {
    entree,
    sortie: bout,
    params,
    envois: prise ? [] : blocs.flatMap((b) => (b.envoi ? [b.envoi] : [])),
    prise,
    inserts: () => (horsLigne && premierJs >= 0 ? actifs.filter(estJs) : null),
    planifier(morceau, de, a, origine) {
      if (!demarre) {
        demarre = true;
        for (const s of sources) s.start();
        if (source && rendu) {
          const t0 = origine + rendu.debut;
          source.start(Math.max(0, t0), Math.max(0, -t0));
        }
      }
      if (origine !== origineAvant) {
        origineAvant = origine;
        origineJs = { o: Math.round(origine * ctx.sampleRate), t: Math.max(0, origine + de) };
        caler(origineJs.o, origineJs.t);
      }
      for (const b of blocs) {
        for (const mod of b.modulations) {
          let s = mods.get(mod.param);
          if (!s) {
            const [id, cle] = mod.profondeur.split('.') as [string, string];
            const cible = { type: 'insert' as const, insert: id, param: cle };
            const mv = mouvement(morceau, piste, cible);
            const ins = piste.inserts?.find((i) => i.id === id);
            const fixe = ins ? reglage(ins.type, ins.params, cle) : 0;
            s = sourceGrille((t) => mod.f(t, mv ? valeurReelle(piste, cible, mv.f(t)) : fixe));
            mods.set(mod.param, s);
          }
          programmerParam(mod.param, s, de, a, origine);
        }
      }
    },
    detruire() {
      detruit = true;
      if (worklet) (worklet as AudioWorkletNode).port.postMessage('fin');
      for (const s of [...sources, ...(source ? [source] : [])]) {
        try {
          s.stop();
        } catch {
          /* jamais démarrée */
        }
      }
      for (const n of [...noeuds, ...(worklet ? [worklet] : [])]) n.disconnect();
    },
  };
}

