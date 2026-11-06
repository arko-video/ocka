// Téléchargement d'un instrument de la banque, à la demande, depuis la MÊME origine (CSP connect-src 'self').
// Progression et annulation, taille vérifiée (au octet près, d'après le catalogue), puis Cache Storage
// « ocka-instruments ». instrument.json est rangé EN DERNIER : sa présence veut dire « instrument complet ».
// On rend l'instrument validé et une fonction `lire(fichier)` : le moteur ne décode que les zones jouées.

import { ErreurOcka } from '../moteur/erreur';
import { enErreurOcka, verifierPlace } from '../stockage/dossiers';
import { CACHE_INSTRUMENTS, entreeCatalogue, urlInstruments, type EntreeCatalogue } from './catalogue';
import { dossierInstrument, validerInstrument, type InstrumentJson } from './format';

export interface Progression {
  /** Octets reçus, et à recevoir en tout. */
  faits: number;
  total: number;
}

export interface OptionsTelechargement {
  signal?: AbortSignal;
  progression?: (p: Progression) => void;
}

export interface InstrumentPret {
  instrument: InstrumentJson;
  /** Octets pris dans le cache. */
  taille: number;
  /** Les octets Opus d'une zone, à donner à decodeAudioData (un ArrayBuffer neuf à chaque appel). */
  lire(fichier: string): Promise<ArrayBuffer>;
}

/** En-tête ajouté aux réponses rangées : la taille, pour compter la place sans relire les fichiers. */
export const ENTETE_TAILLE = 'X-Ocka-Taille';
const MAX_FICHIER = 2_000_000;
const MAX_JSON = 200_000;
const EN_PARALLELE = 4;

const enCours = new Map<string, Promise<InstrumentPret>>();

function horsLigne(nom: string): ErreurOcka {
  return new ErreurOcka(
    `Pas de réseau : impossible de télécharger « ${nom} ». Reconnecte-toi, puis réessaie.`,
    'hors_ligne',
  );
}

function abime(nom: string): ErreurOcka {
  return new ErreurOcka(`« ${nom} » n’a pas été reçu en entier. Réessaie dans un moment.`, 'instrument_invalide');
}

/** Lit une réponse en flux : progression, plafond, et taille annoncée = taille reçue. */
async function lireCorps(r: Response, max: number, recu: (n: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  const annonce = Number(r.headers.get('Content-Length'));
  if (Number.isFinite(annonce) && annonce > max) throw new Error('trop gros');
  if (!r.body) {
    const b = new Uint8Array(await r.arrayBuffer());
    if (b.byteLength > max) throw new Error('trop gros');
    recu(b.byteLength);
    return b;
  }
  const lecteur = r.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel().catch(() => undefined);
      throw new Error('trop gros');
    }
    morceaux.push(value);
    recu(value.byteLength);
  }
  const tout = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) {
    tout.set(m, p);
    p += m.byteLength;
  }
  return tout;
}

async function recevoir(
  url: string,
  max: number,
  signal: AbortSignal | undefined,
  recu: (n: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const r = await fetch(url, { signal, credentials: 'same-origin', redirect: 'error' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return lireCorps(r, max, recu);
}

function reponse(octets: Uint8Array<ArrayBuffer>, type: string): Response {
  return new Response(octets, { headers: { 'Content-Type': type, [ENTETE_TAILLE]: String(octets.byteLength) } });
}

function estOgg(o: Uint8Array): boolean {
  return o.byteLength > 4 && o[0] === 0x4f && o[1] === 0x67 && o[2] === 0x67 && o[3] === 0x53; // « OggS »
}

function pret(instrument: InstrumentJson, taille: number, cache: Cache, dossier: string): InstrumentPret {
  const fichiers = new Set(instrument.zones.map((z) => z.fichier));
  return {
    instrument,
    taille,
    async lire(fichier: string) {
      if (!fichiers.has(fichier)) throw new ErreurOcka('Ce son ne fait pas partie de l’instrument.', 'instrument_invalide');
      const r = await cache.match(urlInstruments(`${dossier}/${fichier}`));
      if (!r) {
        throw new ErreurOcka(`« ${instrument.nom} » a été effacé du téléphone. Télécharge-le de nouveau.`, 'instrument_absent');
      }
      return r.arrayBuffer();
    },
  };
}

/** Lit un instrument COMPLET depuis le cache, ou null. */
export async function depuisCache(id: string): Promise<InstrumentPret | null> {
  const dossier = dossierInstrument(id);
  if (!dossier || typeof caches === 'undefined') return null;
  const cache = await caches.open(CACHE_INSTRUMENTS);
  const json = await cache.match(urlInstruments(`${dossier}/instrument.json`));
  if (!json) return null;
  let instrument: InstrumentJson;
  try {
    instrument = validerInstrument(JSON.parse(await json.text()), id);
  } catch {
    return null;
  }
  let taille = Number(json.headers.get(ENTETE_TAILLE)) || 0;
  for (const z of instrument.zones) {
    const r = await cache.match(urlInstruments(`${dossier}/${z.fichier}`));
    if (!r) return null;
    taille += Number(r.headers.get(ENTETE_TAILLE)) || 0;
  }
  return pret(instrument, taille, cache, dossier);
}

async function effacerPartiel(cache: Cache, dossier: string): Promise<void> {
  const prefixe = urlInstruments(`${dossier}/`);
  for (const req of await cache.keys()) {
    if (new URL(req.url).pathname.startsWith(prefixe)) await cache.delete(req).catch(() => false);
  }
}

async function telecharger(entree: EntreeCatalogue, opts: OptionsTelechargement): Promise<InstrumentPret> {
  const dossier = dossierInstrument(entree.id);
  if (!dossier) throw abime(entree.nom);
  if (typeof caches === 'undefined') {
    throw new ErreurOcka('Ce navigateur ne peut pas garder les instruments. Utilise Chrome à jour.', 'stockage');
  }
  await verifierPlace(entree.taille, 1.1);
  const cache = await caches.open(CACHE_INSTRUMENTS);
  let faits = 0;
  const recu = (n: number) => {
    faits += n;
    opts.progression?.({ faits: Math.min(faits, entree.taille), total: entree.taille });
  };
  opts.progression?.({ faits: 0, total: entree.taille });
  try {
    const octetsJson = await recevoir(urlInstruments(`${dossier}/instrument.json`), MAX_JSON, opts.signal, recu);
    const instrument = validerInstrument(JSON.parse(new TextDecoder().decode(octetsJson)), entree.id);
    const fichiers = instrument.zones.map((z) => z.fichier);
    const ranges: Promise<void>[] = [];
    let suivant = 0;
    const ouvrier = async () => {
      while (suivant < fichiers.length) {
        const f = fichiers[suivant++];
        const octets = await recevoir(urlInstruments(`${dossier}/${f}`), MAX_FICHIER, opts.signal, recu);
        if (!estOgg(octets)) throw abime(entree.nom);
        ranges.push(cache.put(urlInstruments(`${dossier}/${f}`), reponse(octets, 'audio/ogg')));
      }
    };
    await Promise.all(Array.from({ length: Math.min(EN_PARALLELE, fichiers.length) }, ouvrier));
    await Promise.all(ranges);
    if (faits !== entree.taille) throw abime(entree.nom);
    await cache.put(urlInstruments(`${dossier}/instrument.json`), reponse(octetsJson, 'application/json'));
    return pret(instrument, faits, cache, dossier);
  } catch (e) {
    await effacerPartiel(cache, dossier).catch(() => undefined);
    if (e instanceof ErreurOcka) throw e;
    const nom = (e as { name?: unknown } | null)?.name;
    if (nom === 'AbortError' || nom === 'QuotaExceededError') throw enErreurOcka(e);
    if (e instanceof TypeError) throw horsLigne(entree.nom);
    if (e instanceof SyntaxError || (e instanceof Error && /trop gros|HTTP/.test(e.message))) throw abime(entree.nom);
    throw enErreurOcka(e);
  }
}

/** L'instrument, depuis le cache s'il est complet, sinon téléchargé (un seul téléchargement à la fois par id). */
export async function ouvrirInstrument(id: string, opts: OptionsTelechargement = {}): Promise<InstrumentPret> {
  const garde = await depuisCache(id);
  if (garde) return garde;
  let p = enCours.get(id);
  if (!p) {
    p = entreeCatalogue(id).then((e) => telecharger(e, opts));
    enCours.set(id, p);
    p.then(
      () => enCours.delete(id),
      () => enCours.delete(id),
    );
  }
  return p;
}

/**
 * Avant un export : télécharge les instruments qui manquent, avec une progression globale.
 * Hors réseau, l'erreur nomme l'instrument (jamais de piste muette).
 */
export async function assurerInstruments(ids: readonly string[], opts: OptionsTelechargement = {}): Promise<void> {
  const manquants: EntreeCatalogue[] = [];
  for (const id of new Set(ids)) if (!(await depuisCache(id))) manquants.push(await entreeCatalogue(id));
  const total = manquants.reduce((s, e) => s + e.taille, 0);
  let avant = 0;
  for (const e of manquants) {
    await ouvrirInstrument(e.id, {
      signal: opts.signal,
      progression: (p) => opts.progression?.({ faits: avant + p.faits, total }),
    });
    avant += e.taille;
  }
}
