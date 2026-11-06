// Le mélangeur d'un graphe : les pistes du morceau, fixes et instrument (vers le bus master ou vers les pistes
// séparées), les routes de la
// batterie (panoramiques par défaut de la chaîne 2), le retour de la réverbe de caisse claire, la voix et ses prises.
// Tout ce qui est créé ici appartient AU graphe : `debrancher()` le libère (le bus master, lui, reste).

import { placerPrise } from '../../enregistrement/alignement';
import { lirePcmVoix, type PcmVoix } from '../../autotune/autotune';
import { positionAncre } from '../../morceau/temps';
import { estPisteInstrument, ID_MELODIE } from '../../morceau/acces';
import type { IdFixe, IdPiste, InstrumentBatterie, Morceau, PisteFixe } from '../../morceau/types';
import { lireSon } from '../../sons/import';
import { programmerAutomation, valeurCible } from '../automation';
import { creerChaineVoix, creerPiste, type ChainePiste } from '../chaines';
import { preparerTranches } from '../effets/preparer';
import { ErreurOcka } from '../erreur';
import type { OptionsGraphe, PcmSon } from '../types-moteur';
import type { Banque } from './banque';
import type { Bus } from './bus';
import { sonsUtilises, type PrisePlacee } from './preparation';
import { RELAIS } from './sources';

/**
 * Panoramiques par défaut de la chaîne 2 (dans le graphe, JAMAIS écrits dans Piste.pan). `melodie` : la piste
 * instrument d'id « melodie » seulement (celle d'un morceau /2 ; les « melodie-2 »… migrées l'ont dans leur pan).
 */
export const PAN_DEFAUT = { charley: 0.15, perc: -0.2, melodie: 0.1, accords: -0.1 } as const;

const borner = (x: number) => Math.min(1, Math.max(-1, x));
export const pisteParDefaut = (id: IdFixe): PisteFixe => ({ id, volume: 0.8, pan: 0, muet: false, solo: false });

/** Une prise choisie, placée sur le morceau (convention de placerPrise). */
export interface Placee {
  prise: Morceau['prises'][number];
  /** Fichier joué : la prise, ou sa version corrigée par l'autotune (clé de la banque). */
  fichier: string;
  debut: number;
  depuis: number;
  longueur: number;
}

export interface Melangeur {
  /** Une chaîne par piste du morceau (les 5 fixes toujours, plus les pistes instrument). */
  pistes: Record<IdPiste, ChainePiste>;
  /** Entrée d'un son de batterie (chaîne 2 : son panoramique ; chaîne 1 : la piste, comme en phase 1). */
  entreeBatterie(i: InstrumentBatterie): AudioNode;
  /** Gain du retour de réverbe de caisse claire vers NOTRE piste batterie (fondu du relais). */
  retourCaisse: GainNode;
  /**
   * Branche le retour de réverbe (à la 1re planification). `relais` : heure du passage de relais, où la queue
   * de réverbe (partagée) passe en 10 ms de l'ancienne piste batterie à la nôtre.
   */
  brancherRetour(relais: number | null): void;
  /** Entrée de la voix (chaîne de M2 s'il y a des prises). */
  entreeVoix: AudioNode;
  placees: Placee[];
  aPreparer: PrisePlacee[];
  /** C3 — porte de chaque piste gelée (entre sa tranche et sa sortie) et sortie réelle de ces pistes (jeu-gels.ts). */
  portes: Map<IdPiste, GainNode>;
  sorties: Map<IdPiste, AudioNode>;
  /**
   * Tranches de M2 (inserts, sidechain, automation, LFO) et pitch bend des pistes (`hauteurs`, cents) : programmés
   * pour ]de, a] à CHAQUE planification (donc reprogrammés à chaque saut), à l'écoute comme à l'export.
   */
  planifier(de: number, a: number, origine: number, hauteurs: ReadonlyMap<string, AudioParam>): void;
  debrancher(): void;
}

/** Une fonction de M2 encore en bouchon (« pas_encore ») n'a aucun effet ; toute autre erreur remonte. */
function proteger<T>(f: () => T, sinon: T): T {
  try {
    return f();
  } catch (e) {
    if (e instanceof ErreurOcka && e.code === 'pas_encore') return sinon;
    throw e;
  }
}

/**
 * Prépare les inserts JS de M2 pour ce contexte (écoute : worklet ; hors ligne : passe A rendue en JS), AVANT de
 * créer les tranches. `debut` : temps du morceau à la trame 0 d'un contexte hors ligne.
 */
export async function preparerEffets(ctx: BaseAudioContext, morceau: Morceau, prises: Map<string, PcmVoix>, sons: Map<string, PcmSon>, debut: number): Promise<void> {
  try {
    await preparerTranches(ctx, morceau, prises, sons, debut);
  } catch (e) {
    if (!(e instanceof ErreurOcka && e.code === 'pas_encore')) throw e;
  }
}

/**
 * PCM des sons importés utilisés par le morceau (lireSon d'A2) ; un son illisible reste muet. `cache` : ceux déjà
 * lus (gardés s'ils servent encore, les autres libèrent leur mémoire).
 */
export async function lireSons(morceau: Morceau, cache = new Map<string, PcmSon>()): Promise<Map<string, PcmSon>> {
  const utiles = sonsUtilises(morceau);
  const fichiers = new Set(utiles.map((s) => s.fichier));
  for (const f of [...cache.keys()]) if (!fichiers.has(f)) cache.delete(f);
  for (const s of utiles) {
    if (cache.has(s.fichier)) continue;
    try {
      const pcm = await lireSon(s);
      if (pcm) cache.set(s.fichier, pcm);
    } catch {
      /* pas encore disponible ou fichier perdu */
    }
  }
  return cache;
}

/**
 * PCM des prises choisies, avec le même cache que lireSons : la version corrigée par l'autotune si elle est prête,
 * sinon la prise brute (la correction part en tâche de fond ; surAutotune prévient quand elle est prête).
 */
export async function lirePrises(morceau: Morceau, cache: Map<string, PcmVoix>): Promise<void> {
  const utiles = new Set(morceau.prises.filter((p) => p.choisie).map((p) => p.fichier));
  for (const f of [...cache.keys()]) if (!utiles.has(f)) cache.delete(f);
  for (const p of morceau.prises) {
    if (!p.choisie) continue;
    const lu = await lirePcmVoix(p, morceau, false, cache.get(p.fichier));
    if (lu) cache.set(p.fichier, lu);
  }
}

export function creerMelangeur(
  ctx: BaseAudioContext,
  morceau: Morceau,
  prises: Map<string, PcmVoix>,
  bus: Bus,
  banque: Banque,
  options: OptionsGraphe,
  gelees: ReadonlySet<IdPiste> = new Set(),
): Melangeur {
  const chaine2 = morceau.master.chaine === 2;
  const noeuds: AudioNode[] = [];
  const portes = new Map<IdPiste, GainNode>();
  const sorties = new Map<IdPiste, AudioNode>();

  // Pistes : vers le bus master, ou vers leur nœud de pistes séparées (stems de M2). Dans l'ordre du morceau.
  const pistes = Object.create(null) as Record<IdPiste, ChainePiste>;
  const fixes: IdFixe[] = ['batterie', 'basse', 'accords', 'sons', 'voix'];
  const liste = [...morceau.pistes, ...fixes.filter((id) => !morceau.pistes.some((p) => p.id === id)).map(pisteParDefaut)];
  for (const p of liste) {
    const id = p.id;
    const separee = options.pistesSeparees && Object.hasOwn(options.pistesSeparees, id) ? options.pistesSeparees[id] : undefined;
    // C3 : une piste gelée passe par une porte (fermée pendant ses passages gelés, voir jeu-gels.ts).
    let sortie: AudioNode = separee ?? bus.entree;
    if (gelees.has(id)) {
      const porte = ctx.createGain();
      porte.connect(sortie);
      portes.set(id, porte);
      sorties.set(id, sortie);
      noeuds.push(porte);
      sortie = porte;
    }
    // Avec le morceau : la tranche de M2 (inserts, sidechain, automation, LFO) ; sans rien de tout ça, les mêmes nœuds.
    pistes[id] = proteger(() => creerPiste(ctx, p, morceau.pistes, sortie, morceau), null) ?? creerPiste(ctx, p, morceau.pistes, sortie);
    const panDefaut = id === 'accords' && !estPisteInstrument(p) ? PAN_DEFAUT.accords : id === ID_MELODIE && estPisteInstrument(p) ? PAN_DEFAUT.melodie : 0;
    if (chaine2 && panDefaut !== 0) pistes[id].pan.pan.value = borner(p.pan + panDefaut);
    noeuds.push(pistes[id].entree, pistes[id].volume, pistes[id].pan);
  }

  // Retour de la réverbe de caisse claire (persistante, dans le bus) sur notre piste batterie, comme en phase 1
  // (sortie de la réverbe → volume de la batterie), par un gain à nous pour le relais entre deux graphes.
  const retourCaisse = ctx.createGain();
  retourCaisse.connect(pistes.batterie!.volume);
  noeuds.push(retourCaisse);
  let retourBranche = false;

  // Chaîne 2 : chaque frappe passe par un panoramique (charley +0,15, perc −0,2, le reste au centre), à puissance
  // constante et au niveau du centre (mono → stéréo sans perte, gain √2 après le panoramique à puissance égale).
  const routes = new Map<string, AudioNode>();
  if (chaine2) {
    const centre = ctx.createGain();
    centre.channelCount = 2;
    centre.channelCountMode = 'explicit';
    centre.connect(pistes.batterie!.entree);
    routes.set('centre', centre);
    noeuds.push(centre);
    for (const nom of ['charley', 'perc'] as const) {
      const panneur = ctx.createStereoPanner();
      panneur.pan.value = PAN_DEFAUT[nom];
      const niveau = ctx.createGain();
      niveau.gain.value = Math.SQRT2;
      panneur.connect(niveau).connect(pistes.batterie!.entree);
      routes.set(nom, panneur);
      noeuds.push(panneur, niveau);
    }
  }

  // Prises choisies, placées selon la convention de l'enregistrement (placerPrise) :
  // le son du fichier au temps x tombe au temps du morceau  ancre + (x − debutCoupe) − decalage.
  const placees: Placee[] = [];
  const aPreparer: PrisePlacee[] = [];
  for (const p of morceau.prises) {
    const pcm = prises.get(p.fichier);
    if (!p.choisie || !pcm) continue;
    const ancre = positionAncre(morceau, p.ancre);
    if (ancre === null) continue;
    const { quand, depuis, jusqua } = placerPrise(p, ancre);
    if (jusqua > depuis) {
      const fichier = pcm.version ?? p.fichier;
      placees.push({ prise: p, fichier, debut: quand, depuis, longueur: jusqua - depuis });
      aPreparer.push({ fichier, frequence: pcm.frequence, pcm: pcm.pcm, debut: quand });
    }
  }
  // Chaîne de la voix (et sa réverbe) seulement s'il y a des prises à jouer : une réverbe coûte cher.
  const trouvee = morceau.pistes.find((p) => p.id === 'voix');
  const voix = trouvee && !estPisteInstrument(trouvee) ? trouvee : pisteParDefaut('voix');
  const chaineVoix = placees.length > 0 ? creerChaineVoix(ctx, voix, banque, pistes.voix!.entree, morceau.tempo) : null;

  return {
    pistes,
    entreeBatterie: (i) => (!chaine2 ? pistes.batterie!.entree : routes.get(i === 'charley' || i === 'charleyOuvert' ? 'charley' : i === 'perc' ? 'perc' : 'centre')!),
    retourCaisse,
    brancherRetour(relais) {
      if (retourBranche) return;
      retourBranche = true;
      if (relais !== null) {
        retourCaisse.gain.setValueAtTime(0, ctx.currentTime);
        retourCaisse.gain.setValueAtTime(0, relais);
        retourCaisse.gain.linearRampToValueAtTime(1, relais + RELAIS);
      }
      bus.retourCaisse.connect(retourCaisse);
    },
    entreeVoix: chaineVoix?.entree ?? pistes.voix!.entree,
    placees,
    aPreparer,
    portes,
    sorties,
    planifier(de, a, origine, hauteurs) {
      /** Pose un pitch bend (normalisé ; cents = (v − 0,5) × 2400) dès le début du bloc de rendu de `heure`. */
      const calerBloc = (h: AudioParam, v: number | null, heure: number) => {
        const bloc = 128 / ctx.sampleRate;
        const t = Math.max(ctx.currentTime, Math.floor(heure / bloc + 1e-9) * bloc);
        if (v === null) return;
        h.cancelScheduledValues(t);
        h.setValueAtTime((v - 0.5) * 2400, t);
      };
      for (const id of Object.keys(pistes)) proteger(() => pistes[id]!.planifier?.(de, a, origine), undefined);
      for (const [id, h] of hauteurs) {
        // Reprise : le detune est k-rate (lu au début du bloc de 128 trames) ; le pitch bend doit déjà valoir sa
        // valeur au début du bloc où la reprise tombe, sinon la note reprend décalée (écoute ≠ export).
        if (de === a) proteger(() => calerBloc(h, valeurCible(morceau, id, { type: 'hauteur' }, de), origine + de), undefined);
        proteger(() => programmerAutomation(morceau, id, new Map([['hauteur', h]]), de, a, origine), undefined);
      }
    },
    debrancher() {
      for (const id of Object.keys(pistes)) pistes[id]!.detruire?.();
      if (retourBranche) bus.retourCaisse.disconnect(retourCaisse);
      for (const n of noeuds) n.disconnect();
      chaineVoix?.detruire();
    },
  };
}
