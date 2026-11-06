// Les pistes instrument ÉCHANTILLONNÉES d'un graphe (instruments de la banque de BQ, pas « ocka-<son>@1 ») :
// un échantillonneur par piste, préparé AVANT la lecture avec les seules notes que le morceau joue (et, pour la
// piste des pads « Simple », la gamme). Écoute : un instrument absent du téléphone rend ses notes muettes (comptées) ;
// export (contexte hors ligne) : il est téléchargé, sinon `pret` rejette avec « instrument_absent ».
// Pitch bend : une piste dont l'automation ou un LFO vise « hauteur » a un ConstantSourceNode (cents) branché sur
// le detune de chacune de ses notes (`hauteurs`, pour programmerAutomation de M2).

import { estPisteInstrument, ID_MELODIE, pisteMelodie, pistesInstrument, syntheOcka } from '../../morceau/acces';
import type { Cible, Morceau, PisteInstrument } from '../../morceau/types';
import { valeurCible } from '../automation';
import { PAS_GRILLE } from '../effets/programme';
import type { Evenement } from '../planning';
import type { OptionsNote, SourceZones } from '../types-moteur';
import { creerEchantillonneur, type EchantillonneurPiste } from './echantillonneur';
import { sourcePour } from './fournisseur';
import type { Sources } from './sources';

type EvNote = Extract<Evenement, { type: 'note' }>;
/** Délai au-delà duquel une note entendue seule qui n'était pas prête n'est plus jouée (s). */
const ATTENTE_ENTENDRE = 0.4;

export interface JeuEchantillonne {
  /** Zones jouées décodées. Écoute : ne rejette jamais. Export : rejette (« instrument_absent », zone illisible). */
  readonly pret: Promise<void>;
  /** Pistes dont l'instrument manque (absent du téléphone ou inconnu) : leurs notes sont muettes. */
  readonly manquants: string[];
  /** true si cette piste est jouée par l'échantillonneur. */
  gere(idPiste: string): boolean;
  /** Relâchement (s) de l'instrument de la piste : une reprise après un saut rejoue aussi les queues. */
  queue(idPiste: string): number;
  /** Joue une note planifiée ; « muette » : instrument absent ; « sautee » : zone pas prête. */
  jouer(ev: EvNote, quand: number, ecoule: number, sortie: AudioNode, fondu?: number): 'jouee' | 'muette' | 'sautee';
  /** Note entendue seule (piano roll, choix d'instrument) ; false = instrument absent (muette). */
  entendre(idPiste: string, instrument: string, midi: number, o: OptionsNote, sortie: AudioNode): boolean;
  /** Pitch bend (cents) des pistes qui en ont un. */
  readonly hauteurs: Map<string, AudioParam>;
  /** Libère les zones épinglées et le pitch bend (graphe détruit). */
  liberer(): void;
}

const visent = (cibles: { cible: Cible }[] | undefined) => !!cibles?.some((c) => c.cible.type === 'hauteur');

export function creerJeuEchantillonne(
  ctx: BaseAudioContext,
  morceau: Morceau,
  planning: Evenement[],
  sources: Sources,
  gamme: number[] | null,
): JeuEchantillonne {
  const exporter = 'startRendering' in ctx;
  const parPiste = new Map<string, EchantillonneurPiste | null>(); // null : instrument absent
  const apercus = new Map<string, Promise<EchantillonneurPiste | null>>();
  const parInstrument = new Map<string, Promise<SourceZones | null>>();
  const tous = new Set<EchantillonneurPiste>();
  const manquants: string[] = [];
  const hauteurs = new Map<string, AudioParam>();
  const noeudsHauteur = new Map<string, ConstantSourceNode>();
  const controleur = new AbortController();
  /** Heure (temps du morceau) où une note est coupée par la suivante (mono, groupe exclusif) : pas de reprise après. */
  const coupures = new WeakMap<EvNote, number>();
  let libere = false;

  const source = (id: string) => {
    let p = parInstrument.get(id);
    if (!p) parInstrument.set(id, (p = sourcePour(id, exporter, controleur.signal)));
    return p;
  };
  const nouveau = (s: SourceZones) => {
    const e = creerEchantillonneur(ctx, s, sources);
    tous.add(e);
    return e;
  };

  const echantillonnees = pistesInstrument(morceau).filter((p) => syntheOcka(p.instrument) === null);
  const melodie = pisteMelodie(morceau)?.id ?? ID_MELODIE;
  for (const p of pistesInstrument(morceau)) {
    if (!visent(p.auto) && !visent(p.lfo)) continue;
    const n = ctx.createConstantSource();
    n.offset.value = 0;
    n.start(0);
    noeudsHauteur.set(p.id, n);
    hauteurs.set(p.id, n.offset);
  }

  async function preparerPiste(p: PisteInstrument): Promise<void> {
    const s = await source(p.instrument);
    if (libere) return;
    if (!s) {
      parPiste.set(p.id, null);
      manquants.push(p.instrument);
      return;
    }
    const e = nouveau(s);
    parPiste.set(p.id, e);
    const evs = planning.filter((ev): ev is EvNote => ev.type === 'note' && ev.piste === p.id);
    const notes = evs.map((ev) => ({ midi: ev.midi, vel: ev.velNote }));
    const groupe = (midi: number) => (s.mono ? 0 : (s.exclusif?.findIndex((g) => g.includes(Math.round(midi))) ?? -1));
    evs.forEach((ev, i) => {
      const g = groupe(ev.midi);
      const suivante = g < 0 ? undefined : evs.find((x, j) => j > i && x.t > ev.t && groupe(x.midi) === g);
      if (suivante) coupures.set(ev, suivante.t);
    });
    if (gamme && p.id === melodie) for (const midi of gamme) notes.push({ midi, vel: 1 });
    // Sans signal : un décodage est partagé entre graphes (cache commun), on ne l'interrompt pas.
    await e.preparer(notes);
  }

  const promesses = echantillonnees.map((p) =>
    preparerPiste(p).catch((e: unknown) => {
      if (exporter) throw e;
      console.warn('OCKA : instrument impossible à préparer', p.instrument, e);
    }),
  );
  const pret = Promise.all(promesses).then(() => undefined);

  /**
   * Pitch bend (cents) de la piste de `ev`, à r s du début de la note, tel que programmerAutomation le pose : des
   * rampes linéaires entre les points de la grille de M2 (PAS_GRILLE). Sert à reprendre la note au bon endroit.
   */
  function bendDe(ev: EvNote): (r: number) => number {
    const cents = (t: number) => {
      try {
        const v = valeurCible(morceau, ev.piste, { type: 'hauteur' }, t);
        return v === null ? 0 : (v - 0.5) * 2400;
      } catch {
        return 0; // bouchon de M2
      }
    };
    return (r) => {
      const t = ev.t + r;
      const j = Math.floor(t / PAS_GRILLE + 1e-9);
      const x = t / PAS_GRILLE - j;
      return x < 1e-9 ? cents(j * PAS_GRILLE) : (1 - x) * cents(j * PAS_GRILLE) + x * cents((j + 1) * PAS_GRILLE);
    };
  }

  /** Échantillonneur d'aperçu (autre instrument que celui de la piste), préparé à la demande. */
  function apercu(idPiste: string, instrument: string): Promise<EchantillonneurPiste | null> {
    const cle = `${idPiste}|${instrument}`;
    let p = apercus.get(cle);
    if (!p) {
      p = sourcePour(instrument, false).then((s) => (s && !libere ? nouveau(s) : null));
      apercus.set(cle, p);
    }
    return p;
  }

  return {
    pret,
    manquants,
    hauteurs,
    gere: (id) => echantillonnees.some((p) => p.id === id),
    queue: (id) => parPiste.get(id)?.source.relache ?? 0,

    jouer(ev, quand, ecoule, sortie, fondu) {
      const e = parPiste.get(ev.piste);
      if (e === null) return 'muette';
      if (!e) return 'sautee'; // pas encore chargé (l'écoute attend pourtant `pret`)
      const coupee = coupures.get(ev);
      if (coupee !== undefined && ev.t + ecoule >= coupee - 1e-6) return 'jouee'; // reprise d'une note déjà coupée
      const hauteur = noeudsHauteur.get(ev.piste);
      const o = { glisseVers: ev.glisse, ecoule, fonduEntree: fondu, hauteur, bend: hauteur ? bendDe(ev) : undefined };
      return e.jouer(ev.midi, ev.velNote, quand, ev.duree, sortie, o) ? 'jouee' : 'sautee';
    },

    entendre(idPiste, instrument, midi, o, sortie) {
      const piste = morceau.pistes.find((x) => x.id === idPiste);
      const vel = o.vel ?? 1;
      const duree = o.duree ?? 0.8;
      const demande = ctx.currentTime;
      const deLaPiste = estPisteInstrument(piste) && piste.instrument === instrument && parPiste.has(idPiste);
      const attente = deLaPiste ? Promise.resolve(parPiste.get(idPiste) ?? null) : apercu(idPiste, instrument);
      const joue = (e: EchantillonneurPiste) => e.jouer(midi, vel, ctx.currentTime + 0.005, duree, sortie, { hauteur: noeudsHauteur.get(idPiste) });
      const tout = deLaPiste ? parPiste.get(idPiste) : undefined;
      if (tout && tout.pret(midi, vel)) return joue(tout), true;
      if (deLaPiste && tout === null) return false;
      // Pas prête : on décode sa zone, puis on la joue si l'attente reste courte (sinon elle sera prête la fois suivante).
      void attente.then(async (e) => {
        if (!e || libere) return;
        await e.preparer([{ midi, vel }]);
        if (!libere && ctx.currentTime - demande < ATTENTE_ENTENDRE) joue(e);
      }).catch((e: unknown) => console.warn('OCKA : note impossible à préparer', instrument, e));
      return true;
    },

    liberer() {
      if (libere) return;
      libere = true;
      controleur.abort();
      for (const e of tous) e.liberer();
      for (const p of apercus.values()) void p.then((e) => e?.liberer());
      for (const n of noeudsHauteur.values()) {
        try {
          n.stop();
        } catch {
          /* déjà arrêté */
        }
        n.disconnect();
      }
    },
  };
}
