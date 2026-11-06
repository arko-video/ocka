// Le graphe audio d'un morceau, LE MÊME pour l'écoute (AudioContext) et l'export (OfflineAudioContext).
//   sources → piste (Gain → Gain → StereoPanner) → bus master PERSISTANT (instruments/bus.ts) → sortie.
// Rien n'est calculé ici : tampons du Worker de synthèse (instruments/banque.ts) et zones des instruments échantillonnés
// (instruments/pistes-echantillonnees.ts) sont prêts AVANT ; un son pas prêt au moment de le jouer est sauté et compté. planifier(de, a, origine) joue ce qui commence
// entre `de` et `a` (temps du morceau), le temps 0 du morceau tombant à `origine` (temps du contexte).

import { dureeMorceau } from '../morceau/temps';
import type { InstrumentBatterie, Morceau, ReglagesSynthe } from '../morceau/types';
import { fonduFin } from './audio/master-hors-ligne';
import type { ChainePiste } from './chaines';
import { banqueDe, cles, type Pret } from './instruments/banque';
import { busDe } from './instruments/bus';
import { gelsDuMorceau } from './gels';
import { creerJeuGels, demandesGels, pistesGeleesEntieres, pisteEvenement } from './instruments/jeu-gels';
import { creerEntendreNote } from './instruments/note-seule';
import { relacheSon, sonAccord } from './instruments/notes';
import { creerMelangeur, lireSons, preparerEffets } from './instruments/pistes';
import { creerJeuEchantillonne } from './instruments/pistes-echantillonnees';
import { besoins, cleBoucle, clePad, demandeNote, estPad, gamme } from './instruments/preparation';
import { RELAIS, Sources, tenir, type Active } from './instruments/sources';
import { calculerPlanning, evenementsEntre, GAIN_NOTE, type Evenement } from './planning';
import type { OptionsGraphe } from './types-moteur';
import type { Graphe, PcmPrise } from './instruments/graphe-type';

/** Gain de pré-master (−3 dB), appliqué dans le bus persistant (instruments/bus.ts). */
export { PRE_MASTER } from './instruments/bus';

export type { Graphe, PcmPrise };

export const graphesVivants = { nombre: 0 }; // graphes pas encore détruits (tests de fuite)
/** Secondes de musique prêtes avant de rendre la main (`debut`) ; fondus d'entrée (s) d'une reprise et d'une boucle. */
const [SECONDES_DEBUT, FONDU_REPRISE, FONDU_BOUCLE] = [8, 0.005, 0.003];

/**
 * Construit le graphe d'un morceau ET attend que tous ses sons soient prêts (export, stems, A/B).
 * `options` : `pistesSeparees` (stems de M2) et `sons` (PCM des sons importés, lus avec lireSon si absent).
 */
export async function construireGraphe(
  ctx: BaseAudioContext,
  morceau: Morceau,
  prises: Map<string, PcmPrise>,
  destination: AudioNode = ctx.destination,
  options: OptionsGraphe = {},
): Promise<Graphe> {
  const graphe = await preparerGraphe(ctx, morceau, prises, destination, options);
  await graphe.pret;
  return graphe;
}

/** Comme construireGraphe, mais ne prépare QUE les sons joués dans [de, a[ (s) : A/B de M2 (le reste est sauté, compté). */
// prettier-ignore
export async function construireGrapheFenetre(ctx: BaseAudioContext, morceau: Morceau, prises: Map<string, PcmPrise>, de: number, a: number,
  destination: AudioNode = ctx.destination, options: OptionsGraphe = {}): Promise<Graphe> {
  const graphe = await preparerGraphe(ctx, morceau, prises, destination, options, de, [de, a]);
  await graphe.pret;
  return graphe;
}

/**
 * Sans attendre la préparation des sons (le lecteur attend `debut` ou `pret`). `position` (s) : là où l'écoute
 * commencera, préparé d'abord ; `fenetre` : ne préparer que ce qui sonne dans [de, a[.
 */
export async function preparerGraphe(
  ctx: BaseAudioContext,
  morceau: Morceau,
  prises: Map<string, PcmPrise>,
  destination: AudioNode = ctx.destination,
  options: OptionsGraphe = {},
  position = 0,
  fenetre?: [number, number],
): Promise<Graphe> {
  const banque = banqueDe(ctx);
  const bus = await busDe(ctx, destination, morceau.master);
  const sons = options.sons ?? (await lireSons(morceau));
  const style = morceau.kit.split('@')[0] ?? morceau.style;
  const duree = dureeMorceau(morceau);
  const enDirect = !('startRendering' in ctx);
  // C3 : passages gelés (effets de performance, gel d'une piste) ; une piste gelée en entier ne joue plus ses notes.
  const gels = options.gels === false ? [] : (options.gels ?? (await gelsDuMorceau(morceau, { frequence: ctx.sampleRate, attendre: !enDirect })));
  const entieres = pistesGeleesEntieres(gels, duree);
  const planning = calculerPlanning(morceau).filter((ev) => entieres.size === 0 || !entieres.has(pisteEvenement(ev)));
  await preparerEffets(ctx, morceau, prises, sons, fenetre?.[0] ?? 0); // inserts JS de M2 (worklet ou passe A)
  const mel = creerMelangeur(ctx, morceau, prises, bus, banque, options, new Set(gels.map((g) => g.piste)));
  graphesVivants.nombre++;
  const { pistes } = mel;
  const placees = entieres.has('voix') ? [] : mel.placees;

  // Préparation (Worker) de tout ce que le morceau joue ; épinglé tant que le graphe vit.
  const dans = (t: number, d: number) => !fenetre || (t < fenetre[1] && t + d > fenetre[0]);
  const aJouer = fenetre ? planning.filter((ev) => dans(ev.t, ev.type === 'frappe' ? 1 : ev.duree)) : planning;
  const prisesUtiles = (entieres.has('voix') ? [] : mel.aPreparer).filter((x) => dans(x.debut, Infinity));
  const demandes = besoins(morceau, aJouer, prisesUtiles, sons, ctx.sampleRate, position, !fenetre);
  for (const d of demandesGels(gels)) if (dans(d.priorite, Infinity)) demandes.set(d.cle, d);
  const epingles = new Set(demandes.keys());
  banque.epingler(epingles);
  const sources = new Sources(ctx, enDirect ? () => banque.retards++ : null);
  // Pistes échantillonnées (banque de BQ) : zones jouées décodées avant la lecture ; export : instrument absent = erreur.
  const jeu = creerJeuEchantillonne(ctx, morceau, aJouer, sources, fenetre ? null : gamme(morceau));
  const pret = Promise.all([banque.preparer(demandes.values()), jeu.pret]).then(() => undefined);
  const debut = Promise.all([banque.preparer([...demandes.values()].filter((d) => d.priorite < SECONDES_DEBUT)), jeu.pret.catch(() => {})]).then(() => undefined);

  let sautees = 0;
  let muettes = 0; // notes d'un instrument absent ou inconnu : muettes, comptées (contrat C0)
  const sauter = () => void (sautees++, banque.sautees++);
  const jeuGels = creerJeuGels(ctx, gels, banque, sources, mel.portes, mel.sorties, sauter);
  // prettier-ignore
  const entendreNote = creerEntendreNote({ ctx, morceau, style, pistes, bus, jeu, banque, epingles, sources, sauter, muette: () => void muettes++ });
  let ouvert: { gain: GainNode; t: number } | null = null;
  const derniersPads = new Map<InstrumentBatterie, Active>();
  let detruit = false;
  let fonduPris = false;
  let minuteurFin: ReturnType<typeof setTimeout> | undefined;
  let finRelais: (() => void) | null = null;

  function lire(cle: string | null): Pret | undefined {
    if (cle === null) return undefined;
    const p = banque.lire(cle);
    if (!p) sauter();
    return p;
  }

  function frappe(i: InstrumentBatterie, quand: number, vel: number, envoi: boolean) {
    if (estPad(i)) {
      const cle = clePad(morceau, i, sons);
      const p = lire(cle);
      if (!p) return; // pad vide (cle null : pas compté) ou pas prêt (compté)
      const avant = derniersPads.get(i);
      if (avant && avant.debut < quand) sources.couper(avant, quand); // une nouvelle frappe coupe la précédente
      derniersPads.set(i, sources.jouer(p.buffer, quand, vel, [mel.entreeBatterie(i)]));
      return;
    }
    const p = lire(cles.frappe(morceau.kit, i));
    if (!p) return;
    const vers: AudioNode[] = [mel.entreeBatterie(i)];
    if (envoi && (i === 'snare' || i === 'clap')) vers.push(bus.envoiCaisse);
    // Le charley fermé coupe le charley ouvert (comme sur une vraie batterie).
    if (i === 'charley' && ouvert && ouvert.t < quand) ouvert.gain.gain.setTargetAtTime(0, quand, 0.008);
    // Chaîne 1 : son des phases 0 et 1, y compris la fin de la réverbe de caisse (voir OptionsJeu.debrancher).
    const a = sources.jouer(p.buffer, quand, vel, vers, { debrancher: vers.length > 1 && morceau.master.chaine !== 2 });
    if (i === 'charleyOuvert') ouvert = { gain: a.g, t: quand };
  }

  // prettier-ignore
  function note(son: string, midi: number, ev: { t: number; duree: number; vel: number; reglages?: ReglagesSynthe }, piste: ChainePiste | undefined, origine: number, retard: number, fondu?: number) {
    const p = piste ? lire(demandeNote(son, style, midi, 0, ev.reglages).cle) : undefined;
    if (!p || !piste) return;
    sources.jouer(p.buffer, origine + ev.t + retard, ev.vel, [piste.entree], {
      decalage: retard,
      boucle: p.boucle,
      finNote: origine + ev.t + ev.duree,
      relache: relacheSon(son),
      stereo: p.buffer.numberOfChannels === 1,
      genre: 'long',
      fonduEntree: fondu,
    });
  }

  function jouerEvenement(ev: Evenement, origine: number, retard: number, fondu?: number) {
    // Reprise : calée sur la grille d'échantillons du son (même sous-échantillon qu'à l'export : écoute = export).
    if (retard > 0) retard = Math.ceil(retard * ctx.sampleRate - 1e-6) / ctx.sampleRate;
    const quand = origine + ev.t + retard;
    if (ev.type === 'frappe') frappe(ev.instrument, quand, ev.vel, true);
    else if (ev.type === 'basse') {
      const p = lire(cles.basse(style, ev.midi, ev.duree, ev.cible));
      if (p) sources.jouer(p.buffer, quand, ev.vel, [pistes.basse!.entree], { decalage: retard, genre: 'long', fin: origine + ev.t + ev.duree, fonduEntree: fondu });
    } else if (ev.type === 'accord') {
      for (const n of ev.notes) note(sonAccord(ev.son), n, ev, pistes.accords, origine, retard, fondu);
    } else if (ev.type === 'motif') {
      // C3 : passage d'un synthé « motif » (303), un seul tampon, joué comme une boucle de son importé.
      const piste = pistes[ev.piste];
      const p = piste ? lire(cles.motif(ev.son, ev.cle)) : undefined;
      if (!p || !piste || p.buffer.duration - retard <= 0.004) return;
      sources.jouer(p.buffer, quand, GAIN_NOTE, [piste.entree], { decalage: retard, genre: 'long', fonduEntree: fondu ?? FONDU_BOUCLE, arret: origine + ev.t + ev.duree });
    } else if (ev.type === 'note') {
      const piste = pistes[ev.piste];
      if (ev.son !== null) note(ev.son, ev.midi, ev, piste, origine, retard, fondu);
      else {
        const r = piste ? jeu.jouer(ev, quand, retard, piste.entree, fondu) : 'muette';
        if (r === 'muette') muettes++;
        else if (r === 'sautee') sauter();
      }
    } else {
      const p = lire(cleBoucle(morceau, ev, ctx.sampleRate, sons));
      const reste = p ? p.buffer.duration - retard : 0;
      if (!p || reste <= 0.004) return;
      const arret = Math.min(origine + ev.t + ev.duree, quand + reste);
      sources.jouer(p.buffer, quand, 1, [pistes.sons!.entree], { decalage: retard, genre: 'long', fonduEntree: fondu ?? FONDU_BOUCLE, arret });
    }
  }

  const graphe: Graphe = {
    duree,
    latence: bus.chaine.latence,
    pret,
    debut,
    get sautees() { return sautees; }, // prettier-ignore
    get muettes() { return muettes; }, // prettier-ignore
    instrumentsManquants: jeu.manquants,
    hauteurs: jeu.hauteurs,

    planifier(de, a, origine, reprise = false, relais = false) {
      if (detruit) return;
      mel.brancherRetour(relais ? origine + de : null);
      mel.planifier(de, a, origine, jeu.hauteurs); // inserts, sidechain, automation, LFO, pitch bend (M2)
      jeuGels.planifier(de, a, origine, reprise); // C3 : portes et rendus gelés
      for (const ev of evenementsEntre(planning, de, a)) jouerEvenement(ev, origine, 0);
      const fondu = relais ? RELAIS : FONDU_REPRISE;
      if (reprise) {
        // Sons tenus déjà commencés : repris au bon endroit (après un saut, avec la queue des notes échantillonnées).
        for (const ev of planning) {
          if (ev.t >= de) break;
          const queue = !relais && ev.type === 'note' && ev.son === null ? jeu.queue(ev.piste) : 0;
          if (ev.type !== 'frappe' && ev.t + ev.duree + queue > de + 0.01) jouerEvenement(ev, origine, de - ev.t, fondu);
        }
      }
      for (const x of placees) {
        const fin = x.debut + x.longueur;
        const cle = cles.prise(x.fichier);
        if (x.debut >= de && x.debut < a) {
          const p = lire(cle);
          if (p) sources.jouer(p.buffer, origine + x.debut, x.prise.gain, [mel.entreeVoix], { decalage: x.depuis, longueur: x.longueur, genre: 'long', fin: origine + fin });
        } else if (reprise && x.debut < de && fin > de) {
          const deja = de - x.debut;
          const p = lire(cle);
          if (p) sources.jouer(p.buffer, origine + de, x.prise.gain, [mel.entreeVoix], { decalage: x.depuis + deja, longueur: x.longueur - deja, genre: 'long', fin: origine + fin, fonduEntree: fondu });
        }
      }
    },

    programmerFondu(origine) {
      const g = bus.fondu.gain;
      if (!fonduPris) {
        // Le fondu est partagé (bus persistant) : on oublie le programme du graphe d'avant, sans saut de volume.
        fonduPris = true;
        if (enDirect) tenir(g, ctx.currentTime);
      }
      // Sans fondu demandé : un mini-fondu de 10 ms. Hors ligne, le même fondu est appliqué en JS (master-hors-ligne).
      const f = fonduFin(origine, duree, morceau.fondu ?? 0);
      g.setValueAtTime(1, Math.max(0, origine));
      g.setValueAtTime(1, f.debut);
      g.linearRampToValueAtTime(0, f.fin);
    },

    entendre(instrument) {
      if (!detruit) frappe(instrument, ctx.currentTime + 0.005, 0.9, false);
    },

    entendreNote(idPiste, midi, options) {
      if (!detruit) entendreNote(idPiste, midi, options);
    },

    comparer(sans, compensationDb) {
      bus.chaine.contourner(sans, compensationDb);
    },

    annulerFondu() {
      bus.fondu.gain.cancelScheduledValues(0);
      bus.fondu.gain.setValueAtTime(1, ctx.currentTime);
    },

    arreter() {
      sources.arreter();
      bus.fondu.gain.cancelScheduledValues(0);
      bus.fondu.gain.value = 1;
    },

    relayer(quand) {
      if (detruit) return Promise.resolve();
      sources.relayer(quand);
      tenir(mel.retourCaisse.gain, quand);
      mel.retourCaisse.gain.linearRampToValueAtTime(0, quand + RELAIS);
      // Détruit quand tout s'est tu (frappes et queues), au plus tard 10 s après.
      const attente = Math.max(0, quand - ctx.currentTime) * 1000;
      return new Promise<void>((fini) => {
        finRelais = fini;
        sources.surVide = () => graphe.detruire();
        minuteurFin = setTimeout(() => graphe.detruire(), attente + (sources.actives.size > 0 ? 10_000 : 100));
      });
    },

    detruire() {
      if (detruit) return;
      detruit = true;
      graphesVivants.nombre--;
      clearTimeout(minuteurFin);
      sources.surVide = null;
      sources.arreter();
      mel.debrancher();
      jeu.liberer();
      banque.liberer(epingles);
      finRelais?.();
    },
  };
  return graphe;
}
