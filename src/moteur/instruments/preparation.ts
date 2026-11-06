// Ce qu'un graphe doit avoir PRÊT avant de jouer : une demande par tampon (clé du cache, travail du Worker,
// priorité = première utilisation après la position d'écoute). Pur : aucun calcul de son ici.

import { pisteDe, pistesInstrument, sonOcka, syntheOcka } from '../../morceau/acces';
import { demiTonsDegre, hauteurTonique } from '../../morceau/theorie';
import type { DecoupeSon, InstrumentBatterie, Morceau, PadPerso, ReglagesSynthe, SonImporte, SonMelodie } from '../../morceau/types';
import { INSTRUMENTS_BATTERIE, PADS_PERSO } from '../../morceau/types';
import type { PcmSon } from '../types-moteur';
import type { Evenement } from '../planning';
import { cles, dureeBasse, type Demande } from './banque';
import { CRETES } from './batterie';
import { longueurCalee } from './importes';
import { sonAccord, varianteNote } from './notes';
import { empreinteReglages, synthe, syntheParMotif } from '../synthese/registre-synthes';

/** Prise de voix placée sur le morceau (début, partie du fichier). */
export interface PrisePlacee {
  fichier: string;
  frequence: number;
  pcm: Float32Array;
  debut: number;
}

/** Les sons de la gamme sont préparés AVANT tout (pads de la mélodie : latence minimale). */
const PRIORITE_GAMME = -2;
/** Sons du kit jamais joués par le morceau (mais touchables sur la grille) : après le reste. */
const PRIORITE_INUTILISE = 1e6;

export function estPad(i: InstrumentBatterie): i is PadPerso {
  return (PADS_PERSO as readonly string[]).includes(i);
}

/** Le son importé d'id `id`, ou null. */
export function sonParId(morceau: Morceau, id: string | undefined): SonImporte | null {
  return id === undefined ? null : (morceau.sons?.find((s) => s.id === id) ?? null);
}

/** Les sons importés utilisés par le morceau (pads et boucles). */
export function sonsUtilises(morceau: Morceau): SonImporte[] {
  const ids = new Set<string>();
  for (const p of PADS_PERSO) if (morceau.pads?.[p]) ids.add(morceau.pads[p]!);
  for (const s of morceau.sections) if (s.boucle) ids.add(s.boucle.son);
  return (morceau.sons ?? []).filter((s) => ids.has(s.id));
}

/** C3 — La découpe jouée par un pad (Morceau.tranchesPads → SonImporte.tranches), ou null (le son entier). */
export function decoupePad(morceau: Morceau, pad: PadPerso, son: SonImporte): DecoupeSon | null {
  const n = morceau.tranchesPads?.[pad];
  return n === undefined ? null : (son.tranches?.[n] ?? null);
}

/** Clé du tampon d'un pad perso (null si le pad est vide ou son son illisible). Avec une découpe : ses bornes. */
export function clePad(morceau: Morceau, pad: PadPerso, sons: Map<string, PcmSon>): string | null {
  const son = sonParId(morceau, morceau.pads?.[pad]);
  if (!son || !sons.has(son.fichier)) return null;
  const d = decoupePad(morceau, pad, son);
  return cles.pad(d ? `${son.fichier}|${d.debut}|${d.fin}` : son.fichier, CRETES[pad]);
}

/** Les canaux qu'un pad joue : le son entier, ou une copie de sa découpe (décalages dans le même tampon). */
function canauxPad(morceau: Morceau, pad: PadPerso, son: SonImporte, pcm: PcmSon): Float32Array[] {
  const d = decoupePad(morceau, pad, son);
  if (!d) return pcm.canaux;
  const [i, j] = [Math.round(d.debut * pcm.frequence), Math.round(d.fin * pcm.frequence)];
  return pcm.canaux.map((c) => c.slice(Math.min(i, c.length), Math.max(Math.min(j, c.length), Math.min(i, c.length) + 1)));
}

/** Clé du tampon d'une boucle (calée sur ses mesures au tempo, ou seulement à la fréquence du contexte). */
export function cleBoucle(morceau: Morceau, ev: { son: string; mesures: number; caler: boolean }, frequence: number, sons: Map<string, PcmSon>): string | null {
  const son = sonParId(morceau, ev.son);
  if (!son || !sons.has(son.fichier)) return null;
  return cles.boucle(son.fichier, ev.caler ? longueurCalee(ev.mesures, morceau.tempo, frequence) : null);
}

/** Les 8 notes de la gamme (degrés 0 à 7), tonique entre C4 (60) et B4 (71) : celles des pads de la mélodie. */
export function gamme(morceau: Morceau): number[] {
  const base = 60 + hauteurTonique(morceau.tonalite.tonique);
  return Array.from({ length: 8 }, (_, d) => base + demiTonsDegre(morceau.tonalite.mode, d));
}

/** Les sons v1 des pistes instrument « ocka-<son>@1 » du morceau, ou le piano s'il n'y en a pas. */
export function sonsMelodie(morceau: Morceau): SonMelodie[] {
  const s = new Set<SonMelodie>();
  for (const p of pistesInstrument(morceau)) {
    const son = sonOcka(p.instrument);
    if (son) s.add(son);
  }
  return s.size > 0 ? [...s] : ['piano'];
}

/**
 * Le son fabriqué par le code joué NOTE PAR NOTE par une piste instrument (ou par `instrument` s'il est donné) : son v1
 * ou synthé de C3 en mode « note » ; null sinon (échantillonné, inconnu : muet ; synthé « motif » : pas de note seule).
 */
export function sonDeLaPiste(morceau: Morceau, idPiste: string, instrument?: string): string | null {
  const p = pisteDe(morceau, idPiste);
  const id = instrument ?? (p?.genre === 'instrument' ? p.instrument : null);
  const son = id === null ? null : syntheOcka(id);
  return son !== null && !syntheParMotif(son) ? son : null;
}

/** Demande d'une note sans durée. `reglages` : PisteInstrument.synthe (synthés de C3). */
export function demandeNote(son: string, style: string, midi: number, priorite: number, reglages?: ReglagesSynthe): Demande {
  const variante = varianteNote(son, style);
  const def = reglages ? synthe(son) : null;
  const e = def ? empreinteReglages(def, reglages) : '';
  const r = e ? { reglages } : {};
  return { cle: cles.note(son, variante, midi, e), travail: () => ({ type: 'note', son, variante, midi, ...r }), priorite };
}

/**
 * Toutes les demandes d'un morceau. `position` (s) : là où l'écoute va commencer ; ce qui y est joué tôt passe
 * d'abord (priorité = secondes avant la 1re utilisation ; ce qui est avant la position passe après le reste).
 */
export function besoins(
  morceau: Morceau,
  planning: Evenement[],
  prises: PrisePlacee[],
  sons: Map<string, PcmSon>,
  frequence: number,
  position = 0,
  gammeAussi = true,
): Map<string, Demande> {
  const style = morceau.kit.split('@')[0] ?? morceau.style;
  const liste = new Map<string, Demande>();
  const priorite = (t: number) => (t >= position - 1e-9 ? t - position : 1e5 + t);
  const ajouter = (d: Demande) => {
    const deja = liste.get(d.cle);
    if (!deja || d.priorite < deja.priorite) liste.set(d.cle, d);
  };
  if (gammeAussi) for (const midi of gamme(morceau)) for (const son of sonsMelodie(morceau)) ajouter(demandeNote(son, style, midi, PRIORITE_GAMME));
  // Tout le kit (et les pads perso remplis) : la grille peut les faire entendre à tout moment.
  for (const inst of INSTRUMENTS_BATTERIE) {
    if (estPad(inst)) {
      const son = sonParId(morceau, morceau.pads?.[inst]);
      const pcm = son ? sons.get(son.fichier) : undefined;
      const cle = clePad(morceau, inst, sons);
      if (cle && pcm && son) ajouter({ cle, travail: () => ({ type: 'pad', canaux: canauxPad(morceau, inst, son, pcm), de: pcm.frequence, crete: CRETES[inst] }), priorite: PRIORITE_INUTILISE });
    } else {
      ajouter({ cle: cles.frappe(morceau.kit, inst), travail: () => ({ type: 'frappe', kit: morceau.kit, instrument: inst }), priorite: PRIORITE_INUTILISE });
    }
  }
  for (const ev of planning) {
    const p = priorite(ev.t);
    if (ev.type === 'frappe') {
      const cle = estPad(ev.instrument) ? clePad(morceau, ev.instrument, sons) : cles.frappe(morceau.kit, ev.instrument);
      const deja = cle ? liste.get(cle) : undefined;
      if (deja && p < deja.priorite) liste.set(cle!, { ...deja, priorite: p });
    } else if (ev.type === 'basse') {
      const duree = dureeBasse(ev.duree);
      ajouter({ cle: cles.basse(style, ev.midi, ev.duree, ev.cible), travail: () => ({ type: 'basse', style, midi: ev.midi, duree, cible: ev.cible }), priorite: p });
    } else if (ev.type === 'accord') {
      for (const midi of ev.notes) ajouter(demandeNote(sonAccord(ev.son), style, midi, p));
    } else if (ev.type === 'note') {
      if (ev.son !== null) ajouter(demandeNote(ev.son, style, ev.midi, p, ev.reglages));
    } else if (ev.type === 'motif') {
      const { son, notes, duree, reglages } = ev;
      ajouter({ cle: cles.motif(son, ev.cle), travail: () => ({ type: 'motif', son, notes, duree, ...(reglages ? { reglages } : {}) }), priorite: p });
    } else {
      const son = sonParId(morceau, ev.son);
      const pcm = son ? sons.get(son.fichier) : undefined;
      const cle = cleBoucle(morceau, ev, frequence, sons);
      if (!cle || !pcm) continue;
      const longueur = ev.caler ? longueurCalee(ev.mesures, morceau.tempo, frequence) : 0;
      ajouter({
        cle,
        travail: () =>
          ev.caler
            ? { type: 'caler', canaux: pcm.canaux, longueur }
            : { type: 'frequence', canaux: pcm.canaux, de: pcm.frequence },
        priorite: p,
      });
    }
  }
  for (const x of prises) {
    ajouter({ cle: cles.prise(x.fichier), travail: () => ({ type: 'frequence', canaux: [x.pcm], de: x.frequence }), priorite: priorite(x.debut) });
  }
  return liste;
}
