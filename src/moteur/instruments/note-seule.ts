// Une note jouée seule, tout de suite (pads, clavier, piano roll, « + Piste ») : Graphe.entendreNote. Sorti de
// graphe.ts au contrat C3 (même comportement) ; un synthé « motif » (303) y est rendu comme un passage d'une note.

import { syntheOcka } from '../../morceau/acces';
import type { IdPiste, Morceau } from '../../morceau/types';
import type { ChainePiste } from '../chaines';
import { GAIN_NOTE } from '../planning';
import { syntheParMotif } from '../synthese/registre-synthes';
import type { OptionsNote } from '../types-moteur';
import { cles, type Banque, type Demande } from './banque';
import type { Bus } from './bus';
import { relacheSon, sonTenu } from './notes';
import type { JeuEchantillonne } from './pistes-echantillonnees';
import { demandeNote, sonDeLaPiste } from './preparation';
import type { Sources } from './sources';

export interface ContexteNote {
  ctx: BaseAudioContext;
  morceau: Morceau;
  style: string;
  pistes: Record<IdPiste, ChainePiste>;
  bus: Bus;
  jeu: JeuEchantillonne;
  banque: Banque;
  epingles: Set<string>;
  sources: Sources;
  sauter(): void;
  muette(): void;
}

/** Notes tenues (clavier MIDI) : une porte par (piste, note), par contexte (survit au rechargement du graphe). */
const tenues = new WeakMap<BaseAudioContext, Map<string, GainNode>>();
/** Durée maximale d'une note tenue sans relâchement (s) : une note « coincée » finit toujours par s'éteindre. */
export const TENUE_MAX = 30;
/** Relâchement d'une note tenue (s). */
const RELACHE_TENUE = 0.12;

/** Relâche une note tenue (note-off du clavier MIDI) : sa porte descend en RELACHE_TENUE s. Rien si elle n'est pas tenue. */
export function relacherNoteTenue(ctx: BaseAudioContext, idPiste: IdPiste, midi: number): void {
  const map = tenues.get(ctx);
  const cle = `${idPiste}|${midi}`;
  const porte = map?.get(cle);
  if (!porte) return;
  map!.delete(cle);
  const t = ctx.currentTime;
  porte.gain.cancelScheduledValues(t);
  porte.gain.setValueAtTime(porte.gain.value, t);
  porte.gain.linearRampToValueAtTime(0, t + RELACHE_TENUE);
  setTimeout(() => porte.disconnect(), (RELACHE_TENUE + 0.1) * 1000);
}

/** La porte d'une nouvelle note tenue (la précédente sur la même note est relâchée). */
function porteTenue(ctx: BaseAudioContext, idPiste: IdPiste, midi: number, vers: AudioNode): GainNode {
  relacherNoteTenue(ctx, idPiste, midi);
  let map = tenues.get(ctx);
  if (!map) tenues.set(ctx, (map = new Map()));
  const porte = ctx.createGain();
  porte.connect(vers);
  map.set(`${idPiste}|${midi}`, porte);
  const fin = ctx.currentTime + TENUE_MAX;
  porte.gain.setValueAtTime(1, fin - RELACHE_TENUE);
  porte.gain.linearRampToValueAtTime(0, fin);
  return porte;
}

/** Crée la fonction entendreNote d'un graphe. */
export function creerEntendreNote(c: ContexteNote): (idPiste: IdPiste, midi: number, options?: OptionsNote) => void {
  const { ctx, morceau, banque, epingles } = c;
  /** Le tampon s'il est prêt ; sinon la note est sautée (comptée) et préparée tout de suite, pour la prochaine fois. */
  const pret = (d: Demande) => {
    const pr = banque.lire(d.cle);
    if (pr) return pr;
    c.sauter();
    if (!epingles.has(d.cle)) (epingles.add(d.cle), banque.epingler([d.cle]));
    void banque.preparer([d]);
    return undefined;
  };
  return (idPiste, midi, options = {}) => {
    // Piste pas encore créée (écoute dans « + Piste ») : avec `instrument`, la note va droit au bus du master.
    const vers = c.pistes[idPiste]?.entree ?? (options.instrument ? c.bus.entree : null);
    // Note tenue (clavier MIDI) : elle dure jusqu'au relâchement (relacherNoteTenue), TENUE_MAX s au plus.
    const sortie = vers && options.tenue ? porteTenue(ctx, idPiste, midi, vers) : vers;
    if (options.tenue) options = { ...options, duree: options.duree ?? TENUE_MAX };
    const son = sonDeLaPiste(morceau, idPiste, options.instrument);
    const p = morceau.pistes.find((x) => x.id === idPiste);
    const instrument = options.instrument ?? (p?.genre === 'instrument' ? p.instrument : null);
    const reglages = p?.genre === 'instrument' && !options.instrument ? p.synthe : undefined;
    const motif = instrument !== null ? syntheOcka(instrument) : null;
    if (sortie && motif !== null && syntheParMotif(motif)) {
      // Synthé « motif » (303) : un passage d'une seule note.
      const duree = options.duree ?? 0.5;
      const notes = [{ t: 0, duree, midi, vel: options.vel ?? 1 }];
      const d: Demande = { cle: cles.motif(motif, `seule|${midi}|${duree}|${options.vel ?? 1}|${JSON.stringify(reglages ?? null)}`), travail: () => ({ type: 'motif', son: motif, notes, duree, ...(reglages ? { reglages } : {}) }), priorite: -100 };
      const pr = pret(d);
      if (pr) c.sources.jouer(pr.buffer, ctx.currentTime, GAIN_NOTE, [sortie], { genre: 'long', arret: ctx.currentTime + pr.buffer.duration });
      return;
    }
    if (sortie && son === null && instrument !== null && c.jeu.entendre(idPiste, instrument, midi, options, sortie)) return;
    if (!sortie || son === null) return void c.muette();
    const pr = pret(demandeNote(son, c.style, midi, -100, reglages));
    if (!pr) return;
    const quand = ctx.currentTime;
    c.sources.jouer(pr.buffer, quand, GAIN_NOTE * (options.vel ?? 1), [sortie], {
      boucle: pr.boucle,
      finNote: quand + (options.duree ?? (sonTenu(son) ? 0.5 : 1.2)),
      relache: relacheSon(son),
      stereo: pr.buffer.numberOfChannels === 1,
    });
  };
}
