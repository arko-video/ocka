// Le lecteur : toutes les 25 ms (minuterie dans un Worker), on planifie les sons des 200 prochaines ms sur l'horloge
// audio. Boucle sur une section ou sur tout le morceau, métronome, Wake Lock pendant la lecture. charger() prépare
// les sons dans le Worker de synthèse ; en lecture, le nouveau graphe ne prend le relais qu'avec TOUS ses sons
// prêts (aucune note sautée) et reprend sans coupure les sons tenus de l'ancien.

import { contexteAudio } from '../enregistrement/contexte';
import { arrangement, dureePas, pasVersSecondes, secondesVersPas } from '../morceau/temps';
import type { InstrumentBatterie, Morceau } from '../morceau/types';
import type { Lecteur } from './api';
import { preparerGraphe, type Graphe, type PcmPrise } from './graphe';
import { banqueDe } from './instruments/banque';
import { detruireBus } from './instruments/bus';
import { cacheZones } from './instruments/cache-zones';
import { relacherNoteTenue } from './instruments/note-seule';
import { lirePrises, lireSons } from './instruments/pistes';
import type { PcmSon } from './types-moteur';
const FENETRE = 0.2; // fenêtre de planification (s)

export function creerLecteur(): Lecteur {
  let ctx: AudioContext | null = null;
  let morceau: Morceau | null = null;
  let graphe: Graphe | null = null;
  const prises = new Map<string, PcmPrise>();
  const sons = new Map<string, PcmSon>();
  /** Graphes relayés qui finissent leurs frappes (coupés aussi par pause et aller) ; oubliés dès leur fin. */
  const relayes = new Set<Graphe>();
  let enLecture = false;
  let origine = 0; // temps du contexte où tombe le temps 0 du morceau (pour le tour de boucle en cours)
  let origineAvant: number | null = null; // origine du tour précédent (le tour suivant est planifié en avance)
  let prochain = 0; // temps du morceau jusqu'où tout est planifié
  let position = 0; // temps du morceau à l'arrêt
  let boucle: string | null = null;
  let metronome = false;
  let pasAffiche = -1;
  let verrou: { release(): Promise<void> } | null = null;
  let verrouDemande = false; // une demande de Wake Lock est en cours
  let version = 0;
  const ecouteurs = new Set<() => void>();
  const prevenir = () => ecouteurs.forEach((cb) => cb());

  const worker = new Worker(new URL('./minuterie.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = () => planifier();

  function contexte(): AudioContext {
    // Le contexte COMMUN (le même que la capture et le calibrage : même horloge).
    const c = contexteAudio();
    if (c !== ctx) {
      ctx = c;
      graphe = null; // contexte recréé : le graphe sera reconstruit au prochain charger()
    }
    return c;
  }

  /** Bornes de la boucle (temps du morceau) : la 1re apparition de la section, ou tout le morceau. */
  function bornes(): [number, number] {
    if (!morceau || !graphe) return [0, 0];
    if (boucle) {
      const o = arrangement(morceau).find((x) => x.section.id === boucle);
      if (o) {
        const d = dureePas(morceau.tempo);
        return [o.debutPas * d, (o.debutPas + o.pas) * d];
      }
    }
    return [0, graphe.duree];
  }

  function tempsActuel(): number {
    if (!enLecture || !ctx) return position;
    const [debut, fin] = bornes();
    let t = ctx.currentTime - origine;
    // Le tour suivant est déjà planifié, mais on joue encore la fin du précédent.
    if (t < debut && origineAvant !== null) t = ctx.currentTime - origineAvant;
    return Math.min(Math.max(t, debut), fin);
  }

  function clicsMetronome(de: number, a: number) {
    if (!metronome || !morceau || !ctx) return;
    const temps = 4 * dureePas(morceau.tempo);
    for (let k = Math.ceil(de / temps - 1e-9); k * temps < a; k++) {
      const src = ctx.createBufferSource();
      src.buffer = banqueDe(ctx).clic(k % 4 === 0);
      src.connect(ctx.destination);
      src.start(origine + k * temps);
    }
  }

  function planifier() {
    if (!enLecture || !ctx || !graphe) return;
    const horizon = ctx.currentTime + FENETRE;
    const [debut, fin] = bornes();
    // Fin de la boucle dans la fenêtre : on planifie jusqu'au bout, puis on repart au début.
    let tours = 0;
    while (origine + fin <= horizon && fin > debut && tours++ < 4) {
      graphe.planifier(prochain, fin, origine);
      clicsMetronome(prochain, fin);
      origineAvant = origine;
      origine += fin - debut;
      prochain = debut;
      if (!boucle) graphe.programmerFondu(origine);
    }
    const jusqua = horizon - origine;
    if (jusqua > prochain) {
      graphe.planifier(prochain, jusqua, origine);
      clicsMetronome(prochain, jusqua);
      prochain = jusqua;
    }
    const pas = Math.floor(secondesVersPas(morceau!, tempsActuel())) % 16;
    if (pas !== pasAffiche) {
      pasAffiche = pas;
      prevenir();
    }
  }

  /** Coupe aussi les graphes relayés qui finissent leurs frappes. */
  const couperRelayes = () => relayes.forEach((r) => r.arreter());
  /** (Re)démarre la planification à partir du temps `t` du morceau. */
  function demarrerA(t: number) {
    if (!ctx || !graphe) return;
    origine = ctx.currentTime + 0.05 - t;
    origineAvant = null;
    prochain = t;
    graphe.planifier(t, t, origine, true); // notes tenues et prises déjà commencées
    if (!boucle) graphe.programmerFondu(origine);
    planifier();
  }

  /** Wake Lock : l'écran reste allumé pendant la lecture. Une demande en cours à la pause est relâchée à l'arrivée. */
  async function verrouiller(actif: boolean) {
    if (!actif) {
      const v = verrou;
      verrou = null;
      return void (await v?.release().catch(() => {}));
    }
    if (verrou || verrouDemande || !('wakeLock' in navigator)) return;
    verrouDemande = true;
    try {
      const v = await (navigator as unknown as { wakeLock: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock.request('screen');
      if (enLecture) verrou = v;
      else await v.release().catch(() => {}); // pause faite pendant la demande
    } catch {
      // refusé (économie d'énergie…) : la lecture continue quand même
    }
    verrouDemande = false;
  }
  const surVisibilite = () => {
    if (document.visibilityState !== 'visible' || !enLecture) return;
    verrou = null;
    void verrouiller(true);
  };
  document.addEventListener('visibilitychange', surVisibilite);

  return {
    async charger(m) {
      const v = ++version;
      const c = contexte();
      // Les caches ne gardent que les prises choisies et les sons utilisés (les autres libèrent leur mémoire).
      await lirePrises(m, prises);
      await lireSons(m, sons);
      if (v !== version) return; // un chargement plus récent est passé devant
      const nouveau = await preparerGraphe(c, m, prises, c.destination, { sons: new Map(sons) }, tempsActuel());
      // À l'arrêt, le début suffit (le Worker calcule bien plus vite que la musique ne joue) ; pendant la lecture,
      // le relais n'a lieu qu'avec TOUS les sons prêts : aucune note sautée.
      await nouveau.debut;
      if (enLecture && graphe && v === version) await nouveau.pret;
      if (v !== version) return nouveau.detruire();
      const ancien = graphe;
      const ancienMorceau = morceau;
      const t = tempsActuel();
      morceau = m;
      graphe = nouveau;
      if (enLecture && ancien && ancienMorceau) {
        // Sans coupure : l'ancien graphe finit ce qu'il a déjà planifié ; à l'heure `quand`, ses sons tenus
        // s'effacent en 10 ms pendant que le nouveau les reprend au même endroit (même son : rien ne s'entend).
        const tNouveau = pasVersSecondes(m, secondesVersPas(ancienMorceau, prochain));
        origine += prochain - tNouveau;
        prochain = Math.min(tNouveau, nouveau.duree);
        relayes.add(ancien);
        void ancien.relayer(origine + prochain).then(() => relayes.delete(ancien));
        nouveau.planifier(prochain, prochain, origine, true, true);
        if (!boucle) nouveau.programmerFondu(origine);
      } else {
        ancien?.detruire();
        position = Math.min(t, nouveau.duree);
      }
      prevenir();
    },
    lire() {
      if (enLecture || !graphe) return;
      const c = contexte();
      void c.resume();
      enLecture = true;
      const [debut, fin] = bornes();
      demarrerA(position >= fin || position < debut ? debut : position);
      worker.postMessage('demarrer');
      void verrouiller(true);
      prevenir();
    },
    pause() {
      if (!enLecture) return;
      position = tempsActuel();
      enLecture = false;
      worker.postMessage('arreter');
      couperRelayes();
      graphe?.arreter();
      void verrouiller(false);
      prevenir();
    },
    aller(t) {
      const d = graphe?.duree ?? 0;
      position = Math.min(Math.max(0, t), d);
      if (enLecture) {
        couperRelayes();
        graphe?.arreter();
        demarrerA(position);
      }
      prevenir();
    },
    boucler(section) {
      if (section === boucle) return;
      const t = tempsActuel(); // position avec les anciennes bornes
      boucle = section;
      if (enLecture && graphe) {
        const [debut, fin] = bornes();
        if (t < debut || t >= fin) {
          // Tête de lecture hors de la section : on saute proprement à son début (rien ne part en retard).
          couperRelayes();
          graphe.arreter();
          demarrerA(debut);
        } else {
          // Dans la section : la lecture continue. Le fondu de fin ne vaut que sans boucle de section.
          if (boucle) graphe.annulerFondu();
          else graphe.programmerFondu(origine);
        }
      } else if (!enLecture) {
        const [debut, fin] = bornes();
        if (position < debut || position >= fin) position = debut;
      }
      prevenir();
    },
    entendre(instrument) {
      void contexte().resume();
      graphe?.entendre(instrument as InstrumentBatterie);
    },
    metronome(actif) {
      metronome = actif;
    },
    get notesMuettes() { return graphe?.muettes ?? 0; }, // prettier-ignore
    entendreNote(piste, midi, options) {
      void contexte().resume();
      graphe?.entendreNote(piste, midi, options); // une note pas prête est sautée (et préparée pour la fois suivante)
    },
    relacherNote: (piste, midi) => void (ctx && relacherNoteTenue(ctx, piste, midi)),
    get latenceSortie() {
      // outputLatency (jusqu'au haut-parleur) quand le navigateur la donne, sinon baseLatency.
      const c = contexte() as AudioContext & { outputLatency?: number; baseLatency?: number };
      return typeof c.outputLatency === 'number' && c.outputLatency > 0 ? c.outputLatency : (c.baseLatency ?? 0);
    },
    comparer(sans, compensationDb = 0) {
      graphe?.comparer(sans, compensationDb); // master persistant : l'A/B reste après un rechargement
    },
    get temps() {
      return tempsActuel();
    },
    get duree() {
      return graphe?.duree ?? 0;
    },
    get enLecture() {
      return enLecture;
    },
    get ctx() {
      return contexte();
    },
    heureDe(t: number) {
      // Heure où le temps t du morceau sort du graphe (le limiteur du master ajoute quelques ms).
      const latence = graphe?.latence ?? 0;
      if (!enLecture) return (ctx?.currentTime ?? 0) + 0.05 + (t - position) + latence;
      return origine + t + latence;
    },
    get pasCourant() {
      return morceau ? Math.floor(secondesVersPas(morceau, tempsActuel())) % 16 : 0;
    },
    surChangement(cb) {
      ecouteurs.add(cb);
      return () => ecouteurs.delete(cb);
    },
    detruire() {
      this.pause();
      version++; // un chargement en cours ne branchera rien
      worker.terminate();
      document.removeEventListener('visibilitychange', surVisibilite);
      graphe?.detruire();
      graphe = null;
      relayes.forEach((r) => r.detruire());
      if (ctx) detruireBus(ctx); // contexte commun : pas fermé, mais son bus master est débranché
      [prises, sons, ecouteurs].forEach((x) => x.clear());
      cacheZones.purger(); // zones décodées des instruments : celles qu'aucun graphe n'épingle sont lâchées
    },
  };
}
