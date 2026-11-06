// Beatbox en direct : entraînement (un exemple à la fois), entraînement gardé sur l'appareil (base « ocka-dubler »),
// et jeu en direct (chaque attaque classée joue le pad du kit du morceau). Le micro reste ouvert entre deux exemples
// (5 s au plus sans demande), pour ne pas refaire getUserMedia à chaque « boum ».

import { get, set } from 'idb-keyval';
import { INSTRUMENTS_BATTERIE, type InstrumentBatterie, type Morceau } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { magasin } from '../stockage/dossiers';
import { TEXTES_DUBLER } from '../textes/dubler';
import { SONS_BEATBOX, type EntrainementBeatbox, type SonBeatbox } from './api-dubler';
import { classerAttaque, mesuresAttaque, NB_MESURES, sonsEntraines } from './beatbox';
import { lecteurOcka, ouvrirChaine, type Chaine } from './chaine';
import { NOTES_BATTERIE, type EvenementDate } from './notes';

const CLE = 'entrainement-beatbox';
const INACTIF_MS = 5000;
/** On ignore les attaques des 150 premières ms (le toucher sur l'écran s'entend parfois). */
const DEBUT_IGNORE_S = 0.15;
const E = TEXTES_DUBLER.beatbox.erreurs;

interface Attaque {
  pcm: Float32Array;
  debut: number;
  frame: number;
  crete: number;
}

let chaine: Chaine | null = null;
let ouverture: Promise<Chaine> | null = null;
let minuteur: ReturnType<typeof setTimeout> | undefined;
const ecouteurs = new Set<(a: Attaque) => void>();
let direct: {
  e: EntrainementBeatbox;
  joueur: (i: InstrumentBatterie) => void;
  notes: Set<(e: EvenementDate) => void>;
} | null = null;

async function chaineBeatbox(): Promise<Chaine> {
  clearTimeout(minuteur);
  if (chaine) return chaine;
  if (!ouverture) {
    ouverture = ouvrirChaine('beatbox').then((c) => {
      c.noeud.port.onmessage = (ev: MessageEvent) => {
        const d = ev.data as { type: string } & Attaque;
        if (d.type === 'attaque') ecouteurs.forEach((f) => f(d));
      };
      chaine = c;
      return c;
    });
    ouverture.catch(() => undefined).finally(() => (ouverture = null));
  }
  return ouverture;
}

/** Coupe le micro quand personne ne s'en sert plus. */
function liberer(delai = INACTIF_MS): void {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    if (direct || ecouteurs.size > 0) return;
    chaine?.fermer();
    chaine = null;
  }, delai);
}

/** Écoute le micro jusqu'à la prochaine attaque et renvoie ses mesures (un exemple). Erreurs : micro, « annule ». */
export async function enregistrerExemple(
  _son: SonBeatbox,
  options: { signal?: AbortSignal } = {},
): Promise<number[]> {
  const annule = () => new ErreurOcka(E.annule, 'annule');
  if (options.signal?.aborted) throw annule();
  const c = await chaineBeatbox();
  const depuis = c.ctx.currentTime + DEBUT_IGNORE_S;
  try {
    return await new Promise<number[]>((ok, ko) => {
      const fin = () => {
        ecouteurs.delete(f);
        options.signal?.removeEventListener('abort', abandon);
      };
      const f = (a: Attaque) => {
        if (a.frame / c.ctx.sampleRate < depuis) return;
        fin();
        ok(mesuresAttaque(a.pcm, c.ctx.sampleRate, a.debut));
      };
      const abandon = () => {
        fin();
        ko(annule());
      };
      ecouteurs.add(f);
      options.signal?.addEventListener('abort', abandon);
    });
  } finally {
    liberer();
  }
}

function entrainementValide(x: unknown): x is EntrainementBeatbox {
  const e = x as EntrainementBeatbox | null;
  if (!e || e.version !== 1 || typeof e.exemples !== 'object' || typeof e.instruments !== 'object')
    return false;
  return SONS_BEATBOX.every(
    (s) =>
      Array.isArray(e.exemples[s]) &&
      e.exemples[s].every(
        (v) =>
          Array.isArray(v) &&
          v.length === NB_MESURES &&
          v.every((n) => typeof n === 'number' && Number.isFinite(n)),
      ) &&
      (INSTRUMENTS_BATTERIE as readonly string[]).includes(e.instruments[s]),
  );
}

/** L'entraînement gardé sur l'appareil, ou null. */
export async function lireEntrainement(): Promise<EntrainementBeatbox | null> {
  try {
    const e: unknown = await get(CLE, magasin('dubler'));
    return entrainementValide(e) ? e : null;
  } catch {
    return null;
  }
}

export async function sauverEntrainement(e: EntrainementBeatbox): Promise<void> {
  if (!entrainementValide(e)) throw new ErreurOcka(E.invalide, 'entrainement_incomplet');
  try {
    await set(CLE, JSON.parse(JSON.stringify(e)), magasin('dubler'));
  } catch {
    throw new ErreurOcka(E.stockage, 'stockage');
  }
}

/** Beatbox en direct : chaque attaque classée joue le pad du kit du morceau. */
export async function demarrerBeatbox(_m: Morceau, e: EntrainementBeatbox): Promise<void> {
  if (!sonsEntraines(e)) throw new ErreurOcka(E.incomplet, 'entrainement_incomplet');
  if (direct) throw new ErreurOcka(E.dejaEnCours, 'deja_en_cours');
  const { lecteur, pret } = await lecteurOcka();
  await pret().catch(() => undefined);
  const c = await chaineBeatbox();
  const d = {
    e,
    joueur: (i: InstrumentBatterie) => lecteur?.entendre(i),
    notes: new Set<(x: EvenementDate) => void>(),
  };
  direct = d;
  const f = (a: Attaque) => {
    if (direct !== d) return;
    const r = classerAttaque(d.e, mesuresAttaque(a.pcm, c.ctx.sampleRate, a.debut));
    if (!r) return;
    const instrument = d.e.instruments[r.son];
    d.joueur(instrument);
    const vel = Math.max(
      0.3,
      Math.min(1, 0.4 + (0.6 * (20 * Math.log10(Math.max(1e-5, a.crete)) + 40)) / 40),
    );
    const ev: EvenementDate = {
      heure: a.frame / c.ctx.sampleRate,
      jouees: [NOTES_BATTERIE[instrument]],
      vel,
    };
    d.notes.forEach((n) => n(ev));
  };
  ecouteurs.add(f);
  arretDirect = () => ecouteurs.delete(f);
}

let arretDirect: (() => void) | null = null;

export async function arreterBeatbox(): Promise<void> {
  if (!direct) return;
  direct = null;
  arretDirect?.();
  arretDirect = null;
  liberer(0);
}

/** Pour l'enregistrement : écoute les frappes du beatbox en direct (null s'il n'est pas lancé). */
export function ecouterFrappes(
  f: (e: EvenementDate) => void,
): { ctx: AudioContext; arreter: () => void } | null {
  const d = direct;
  if (!d || !chaine) return null;
  d.notes.add(f);
  return { ctx: chaine.ctx, arreter: () => d.notes.delete(f) };
}
