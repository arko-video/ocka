// Confort (R) : tap tempo, son du métronome, historique d'Annuler visible, modèles de pistes, marqueurs.
// `signalClic` est lu par la banque du lecteur ; « clic » à volume 1 = EXACTEMENT le clic d'avant C3.
// Réglages (son et volume du métronome) et modèles : IndexedDB BASES_IDB.confort (« metronome », « modele-<id> »).

import { del, entries, get, set } from 'idb-keyval';
import { idPisteLibre, pistesInstrument } from '../morceau/acces';
import { positionAncre } from '../morceau/temps';
import { PLAFONDS, type Marqueur, type Morceau, type PisteInstrument } from '../morceau/types';
import { enErreurOcka, magasin } from '../stockage/dossiers';
import type { EtapeHistorique, ModelePistes, SonMetronome } from './api-performance';
import { etapesHistorique as etapes } from './perf/libelles';

export { libelleChangement } from './perf/libelles';

/* ------------------------------------------------------------ métronome */

/** Comme SONS_METRONOME (api-performance.ts), recopié ici : pas d'import circulaire avec la banque du lecteur. */
const SONS_METRONOME: readonly SonMetronome[] = ['clic', 'bois', 'cloche', 'charley'];
let sonChoisi: SonMetronome = 'clic';
let volume = 1;
let charge: Promise<void> | null = null;

/** Lit une fois le réglage gardé (le métronome garde « clic » tant que la base n'a pas répondu). */
export function chargerConfort(): Promise<void> {
  charge ??= (async () => {
    try {
      const r = (await get('metronome', magasin('confort'))) as
        { son?: unknown; volume?: unknown } | undefined;
      if (r && (SONS_METRONOME as readonly unknown[]).includes(r.son)) sonChoisi = r.son as SonMetronome;
      if (r && typeof r.volume === 'number' && r.volume >= 0 && r.volume <= 1) volume = r.volume;
    } catch {
      /* base illisible : réglages par défaut pour cette séance */
    }
  })();
  return charge;
}
if (typeof indexedDB !== 'undefined') void chargerConfort();

/** Le son du métronome choisi (« clic » par défaut, celui d'avant C3). */
export function metronomeChoisi(): SonMetronome {
  return sonChoisi;
}

/** Volume du métronome (0 à 1, défaut 1). */
export function volumeMetronome(): number {
  return volume;
}

async function garderMetronome() {
  try {
    await set('metronome', { son: sonChoisi, volume }, magasin('confort'));
  } catch {
    /* refusé : le réglage vaut pour cette séance */
  }
}

/** Change le son du métronome (gardé dans BASES_IDB.confort) ; le lecteur l'utilise au prochain clic. */
export async function reglerMetronome(son: SonMetronome): Promise<void> {
  if (!(SONS_METRONOME as readonly string[]).includes(son)) return;
  sonChoisi = son;
  await garderMetronome();
}

/** Change le volume du métronome (0 à 1, gardé). */
export async function reglerVolumeMetronome(v: number): Promise<void> {
  volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));
  await garderMetronome();
}

/** Un clic de métronome (mono, 30 ms ou plus) à `frequence` : `fort` = 1er temps. « clic » = EXACTEMENT celui d'avant C3. */
export function signalClic(fort: boolean, frequence: number, son: SonMetronome = sonChoisi): Float32Array {
  if (son === 'clic') {
    const s = new Float32Array(Math.round(0.03 * frequence));
    const f = fort ? 1800 : 1200;
    for (let i = 0; i < s.length; i++)
      s[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / frequence) * Math.exp(-i / (0.006 * frequence));
    if (volume !== 1) for (let i = 0; i < s.length; i++) s[i]! *= volume;
    return s;
  }
  // Bois (wood block : deux modes courts), cloche (partiels inharmoniques), charley (bruit filtré, déterministe).
  const duree = son === 'cloche' ? 0.25 : son === 'bois' ? 0.06 : 0.05;
  const s = new Float32Array(Math.round(duree * frequence));
  const k = fort ? 1.25 : 1;
  let graine = 12345;
  let precedent = 0;
  for (let i = 0; i < s.length; i++) {
    const t = i / frequence;
    let x: number;
    if (son === 'bois')
      x =
        0.5 *
        (0.7 * Math.sin(2 * Math.PI * 880 * k * t) + 0.3 * Math.sin(2 * Math.PI * 2380 * k * t)) *
        Math.exp(-t / 0.012);
    else if (son === 'cloche')
      x =
        0.3 *
        [1, 2.76, 5.4].reduce((a, r, j) => a + Math.sin(2 * Math.PI * 1320 * k * r * t) / (j + 1), 0) *
        Math.exp(-t / 0.07);
    else {
      graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
      const b = graine / 2 ** 31 - 1;
      x = 0.45 * (b - precedent) * Math.exp(-t / (fort ? 0.014 : 0.009));
      precedent = b;
    }
    const attaque = Math.min(1, i / (0.0005 * frequence));
    s[i] = attaque * x * volume;
  }
  return s;
}

/* ------------------------------------------------------------ tap tempo */

/** Taps gardés pour la moyenne (les 4 derniers) et silence qui recommence le compte (ms). */
const TAPS = 4;
const PAUSE_MAX = 2000;

/** Tempo (60–200, arrondi) d'après les heures des frappes (ms, croissantes) : moyenne des 4 dernières ; null si < 3. */
export function tapTempo(frappes: readonly number[]): number | null {
  let debut = 0;
  for (let i = 1; i < frappes.length; i++)
    if (!(frappes[i]! > frappes[i - 1]!) || frappes[i]! - frappes[i - 1]! > PAUSE_MAX) debut = i;
  const utiles = frappes.slice(debut).slice(-TAPS);
  if (utiles.length < 3) return null;
  const ecart = (utiles[utiles.length - 1]! - utiles[0]!) / (utiles.length - 1);
  return Math.min(200, Math.max(60, Math.round(60000 / ecart)));
}

/* ------------------------------------------------------------ historique */

export function etapesHistorique(
  passe: readonly Morceau[],
  present: Morceau,
  futur: readonly Morceau[],
): EtapeHistorique[] {
  return etapes(passe, present, futur);
}

/* ------------------------------------------------------------ modèles de pistes */

const PREFIXE = 'modele-';

export async function listerModeles(): Promise<ModelePistes[]> {
  try {
    const tout = await entries<string, ModelePistes>(magasin('confort'));
    return tout
      .filter(([k, v]) => String(k).startsWith(PREFIXE) && v && Array.isArray(v.pistes))
      .map(([, v]) => v)
      .sort((a, b) => b.creeLe - a.creeLe);
  } catch (e) {
    throw enErreurOcka(e, { message: 'Les modèles n’ont pas pu être lus.', code: 'stockage' });
  }
}

/** Une piste instrument sans ce qui dépend du morceau (automation au temps, muet, solo). */
function pisteModele(p: PisteInstrument): PisteInstrument {
  const { auto: _auto, ...reste } = structuredClone(p);
  return { ...reste, muet: false, solo: false };
}

/** Garde les pistes instrument de `m` (réglages, inserts, pompe ; jamais de notes) sous le nom `nom`. */
export async function sauverModele(nom: string, m: Morceau): Promise<ModelePistes> {
  const pistes = pistesInstrument(m).map(pisteModele);
  const modele: ModelePistes = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    nom: nom.trim().slice(0, 40) || 'Mon modèle',
    pistes,
    creeLe: Date.now(),
  };
  try {
    await set(PREFIXE + modele.id, modele, magasin('confort'));
  } catch (e) {
    throw enErreurOcka(e, { message: 'Le modèle n’a pas pu être gardé.', code: 'stockage' });
  }
  return modele;
}

export async function supprimerModele(id: string): Promise<void> {
  await del(PREFIXE + id, magasin('confort')).catch(() => undefined);
}

/** Ajoute les pistes du modèle au morceau (16 pistes instrument au plus, ids et noms libres). Pur. */
export function appliquerModele(m: Morceau, modele: ModelePistes): Morceau {
  let out = m;
  for (const brute of modele.pistes) {
    if (brute.genre !== 'instrument') continue;
    if (pistesInstrument(out).length >= PLAFONDS.pistesInstrument) break;
    const noms = new Set(out.pistes.map((p) => (p.genre === 'instrument' ? p.nom : p.id)));
    let nom = brute.nom.slice(0, 40);
    for (let n = 2; noms.has(nom); n++) nom = `${brute.nom.slice(0, 36)} ${n}`;
    const p: PisteInstrument = { ...pisteModele(brute), id: idPisteLibre(out, brute.id), nom };
    const pistes = [...out.pistes];
    const i = pistes.findIndex((x) => x.id === 'sons' || x.id === 'voix');
    pistes.splice(i < 0 ? pistes.length : i, 0, p);
    out = { ...out, pistes };
  }
  return out;
}

/* ------------------------------------------------------------ marqueurs */

function idMarqueurLibre(m: Morceau): string {
  const pris = new Set((m.marqueurs ?? []).map((x) => x.id));
  for (let n = 1; ; n++) if (!pris.has(`marqueur-${n}`)) return `marqueur-${n}`;
}

/** L'ancre remise dans les règles (section existante, mesure dans la section) ; null si la section n'existe pas. */
function ancreValide(m: Morceau, a: Marqueur['ancre']): Marqueur['ancre'] | null {
  const s = m.sections.find((x) => x.id === a.section);
  if (!s) return null;
  const entier = (x: number, max: number) =>
    Math.min(max, Math.max(0, Math.round(Number.isFinite(x) ? x : 0)));
  return { section: s.id, occurrence: entier(a.occurrence, 99), mesure: entier(a.mesure, s.mesures - 1) };
}

const nomPropre = (nom: string, defaut: string) => nom.trim().slice(0, 40) || defaut;

/** Ajoute un marqueur (64 au plus, nom ≤ 40 caractères, ancré à une apparition de section). Pur. */
export function ajouterMarqueur(m: Morceau, nom: string, ancre: Marqueur['ancre']): Morceau {
  const liste = m.marqueurs ?? [];
  const a = ancreValide(m, ancre);
  if (!a || liste.length >= PLAFONDS.marqueurs) return m;
  return {
    ...m,
    marqueurs: [
      ...liste,
      { id: idMarqueurLibre(m), nom: nomPropre(nom, `Repère ${liste.length + 1}`), ancre: a },
    ],
  };
}

export function modifierMarqueur(
  m: Morceau,
  id: string,
  changement: Partial<Pick<Marqueur, 'nom' | 'ancre'>>,
): Morceau {
  const liste = m.marqueurs ?? [];
  const i = liste.findIndex((x) => x.id === id);
  if (i < 0) return m;
  const avant = liste[i]!;
  const ancre = changement.ancre ? ancreValide(m, changement.ancre) : avant.ancre;
  if (!ancre) return m;
  const apres: Marqueur = {
    id,
    nom: changement.nom !== undefined ? nomPropre(changement.nom, avant.nom) : avant.nom,
    ancre,
  };
  if (JSON.stringify(apres) === JSON.stringify(avant)) return m;
  return { ...m, marqueurs: liste.map((x, j) => (j === i ? apres : x)) };
}

export function retirerMarqueur(m: Morceau, id: string): Morceau {
  const liste = m.marqueurs ?? [];
  if (!liste.some((x) => x.id === id)) return m;
  const reste = liste.filter((x) => x.id !== id);
  if (reste.length > 0) return { ...m, marqueurs: reste };
  const { marqueurs: _m, ...sans } = m;
  return sans;
}

/** Les marqueurs placés sur le temps du morceau (s), triés ; ceux dont l'apparition n'existe plus sont omis. */
export function marqueursPlaces(m: Morceau): { id: string; nom: string; t: number }[] {
  return (m.marqueurs ?? [])
    .map((x) => ({ id: x.id, nom: x.nom, t: positionAncre(m, x.ancre) }))
    .filter((x): x is { id: string; nom: string; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t);
}
