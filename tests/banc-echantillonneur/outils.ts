// Outils du banc de l'échantillonneur (M1, C1) : faux fournisseur sans réseau, morceaux de test, mesures.
import { analyserHauteur } from '../../src/autotune/yin';
import { validerInstrument } from '../../src/instruments/format';
import { declarerInstruments } from '../../src/morceau/acces';
import { nouveauMorceau } from '../../src/morceau/styles';
import type { Morceau, Note, PisteInstrument } from '../../src/morceau/types';
import { ErreurOcka } from '../../src/moteur/erreur';
import { remplacerFournisseur, type Fournisseur } from '../../src/moteur/instruments/fournisseur';
import type { SourceZones } from '../../src/moteur/types-moteur';

export interface FauxInstrument {
  source: SourceZones;
  /** Fichier → octets Opus (base64), fabriqués par ffmpeg dans le test. */
  fichiers: Record<string, string>;
}

let ctxDecodage: OfflineAudioContext | null = null;
const decodeur = () => (ctxDecodage ??= new OfflineAudioContext(1, 1, 48000));
const octets = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

/** Longueurs décodées par Chrome (fichier → échantillons) : l'amorce Opus doit être retirée (longueur = fin). */
export const longueursDecodees = new Map<string, number>();

/** Fournisseur en mémoire : aucun réseau. `telecharger` échoue toujours (« hors ligne »). */
export function installerFaux(faux: FauxInstrument[]): void {
  const par = new Map(faux.map((f) => [f.source.id, f]));
  const f: Fournisseur = {
    async chargerSource(id) {
      const x = par.get(id);
      if (!x) throw new ErreurOcka(`absent ${id}`, 'instrument_absent');
      return x.source;
    },
    async lireZone(id, fichier) {
      const b = await decodeur().decodeAudioData(octets(par.get(id)!.fichiers[fichier]!));
      longueursDecodees.set(`${id}|${fichier}`, b.length);
      return b;
    },
    async telecharger() {
      throw new ErreurOcka('hors ligne', 'hors_ligne');
    },
  };
  remplacerFournisseur(f);
  declarerInstruments(faux.map((x) => x.source.id));
}

/** Fournisseur des VRAIS instruments de BQ (public/instruments, servis par Vite), validés par format.ts de BQ. */
export function installerBanque(): void {
  const base = `${import.meta.env.BASE_URL}instruments/`;
  const dossier = (id: string) => id.slice(0, id.indexOf('@'));
  const f: Fournisseur = {
    async chargerSource(id) {
      const r = await fetch(`${base}${dossier(id)}/instrument.json`);
      if (!r.ok) throw new ErreurOcka(`absent ${id}`, 'instrument_absent');
      const { nom: _n, famille: _f, licence: _l, ...s } = validerInstrument(await r.json(), id);
      return s;
    },
    async lireZone(id, fichier) {
      const r = await fetch(`${base}${dossier(id)}/${fichier}`);
      const b = await decodeur().decodeAudioData(await r.arrayBuffer());
      longueursDecodees.set(`${id}|${fichier}`, b.length);
      return b;
    },
    async telecharger() {
      throw new ErreurOcka('hors ligne', 'hors_ligne');
    },
  };
  remplacerFournisseur(f);
}

export interface PisteTest {
  id: string;
  instrument: string;
  pas: number;
  notes: Note[];
}

/** Morceau sans batterie ni basse (leurs queues ne sont pas reprises après un saut), avec ces pistes instrument. */
export function morceauAvec(pistes: PisteTest[], mesures = 4, tempo = 120): Morceau {
  const m = nouveauMorceau('lofi', 'Banc M1');
  m.tempo = tempo;
  m.swing = 0;
  m.fondu = 0;
  const fixes = m.pistes.filter((p) => p.genre !== 'instrument');
  const instr: PisteInstrument[] = pistes.map((p) => ({ id: p.id, genre: 'instrument', nom: p.id, instrument: p.instrument, volume: 0.8, pan: 0, muet: false, solo: false }));
  m.pistes = [...fixes.slice(0, 3), ...instr, ...fixes.slice(3)];
  const motifs = Object.create(null) as Record<string, string>;
  for (const p of pistes) {
    m.motifs[`m-${p.id}`] = { type: 'notes', pas: p.pas, notes: p.notes };
    motifs[p.id] = `m-${p.id}`;
  }
  m.sections = [{ id: 's', nom: 'Couplet', mesures, motifs }];
  m.ordre = ['s'];
  return m;
}

/** Hauteur médiane (cents MIDI × 100) d'un signal à `fs` Hz, mesurée par YIN entre `de` et `a` (s). */
export function hauteurMediane(x: Float32Array, fs: number, de: number, a: number): number {
  const h = analyserHauteur(x.subarray(Math.round(de * fs), Math.round(a * fs)), fs);
  const v = [...h.cents].filter((c) => Number.isFinite(c)).sort((p, q) => p - q);
  return v.length ? v[v.length >> 1]! : NaN;
}

/**
 * Clic au bouclage : max |Δ²x| près des raccords de boucle (±3 ms), divisé par max |Δ²x| ailleurs dans la partie
 * tenue. ≈ 1 sans clic ; un saut de forme d'onde au raccord le fait monter bien au-dessus.
 */
export function rapportClic(x: Float32Array, fs: number, raccords: number[], de: number, a: number): number {
  const fenetre = Math.round(0.003 * fs);
  const pres = new Uint8Array(x.length);
  for (const t of raccords) {
    const c = Math.round(t * fs);
    for (let i = Math.max(0, c - fenetre); i < Math.min(x.length, c + fenetre); i++) pres[i] = 1;
  }
  let [maxPres, maxAilleurs] = [0, 0];
  for (let i = Math.max(2, Math.round(de * fs)); i < Math.min(x.length, Math.round(a * fs)); i++) {
    const r = Math.abs(x[i]! - 2 * x[i - 1]! + x[i - 2]!);
    if (pres[i]) maxPres = Math.max(maxPres, r);
    else maxAilleurs = Math.max(maxAilleurs, r);
  }
  return maxPres / Math.max(1e-12, maxAilleurs);
}

/** Écart (dB) entre deux rendus stéréo à partir de l'échantillon `de`. */
export function ecartDb(a: Float32Array[], b: Float32Array[], de: number): number {
  let [d, r] = [0, 0];
  for (let c = 0; c < a.length; c++) {
    const n = Math.min(a[c]!.length, b[c]!.length);
    for (let i = de; i < n; i++) {
      const e = a[c]![i]! - b[c]![i]!;
      d += e * e;
      r += a[c]![i]! * a[c]![i]!;
    }
  }
  return 10 * Math.log10(Math.max(1e-30, d) / Math.max(1e-30, r));
}
