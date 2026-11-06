// Catalogue de la banque d'instruments (public/instruments/catalogue.json) : liste, familles, recherche.
// Le catalogue vient de la même origine que l'appli ; il est validé comme toute donnée du réseau, et gardé dans
// le Cache Storage « ocka-instruments » pour qu'on puisse voir ses instruments hors ligne.

import { ErreurOcka } from '../moteur/erreur';
import { CACHE_INSTRUMENTS } from '../stockage/dossiers';
import { FAMILLES, LICENCES_ACCEPTEES, REGLE_ID_INSTRUMENT, type Famille } from './format';

export { CACHE_INSTRUMENTS };
export const FORMAT_CATALOGUE = 'ocka.instruments/1';
const MAX_ENTREES = 200;
/** Plafond d'un instrument téléchargé (octets) : bien au-dessus du réel (≈ 1 Mo), bien en dessous d'un abus. */
export const TAILLE_MAX_INSTRUMENT = 8_000_000;

export interface EntreeCatalogue {
  /** « vcsl-marimba@1 » */
  id: string;
  nom: string;
  famille: Famille;
  /** Octets à télécharger (fichiers .ogg + instrument.json). */
  taille: number;
  /** Secondes décodées (mono ; stéréo compte double) : la mémoire prise une fois tout décodé. */
  dureeS: number;
  licence: string;
}

/** Adresse d'un fichier de la banque, sur la même origine (GitHub Pages sert l'appli et les instruments). */
export function urlInstruments(chemin: string): string {
  return `${import.meta.env.BASE_URL}instruments/${chemin}`;
}

export function validerCatalogue(x: unknown): EntreeCatalogue[] {
  const refus = () => new ErreurOcka('La liste des instruments est abîmée. Recharge la page.', 'catalogue_invalide');
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw refus();
  const o = x as Record<string, unknown>;
  if (o.format !== FORMAT_CATALOGUE || !Array.isArray(o.instruments) || o.instruments.length > MAX_ENTREES) throw refus();
  const vus = new Set<string>();
  return o.instruments.map((e: unknown) => {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) throw refus();
    const r = e as Record<string, unknown>;
    const cles = Object.keys(r).sort().join(',');
    if (cles !== 'dureeS,famille,id,licence,nom,taille') throw refus();
    const { id, nom, famille, taille, dureeS, licence } = r;
    if (typeof id !== 'string' || !REGLE_ID_INSTRUMENT.test(id) || vus.has(id)) throw refus();
    if (typeof nom !== 'string' || nom.length === 0 || nom.length > 60) throw refus();
    if (typeof famille !== 'string' || !(FAMILLES as readonly string[]).includes(famille)) throw refus();
    if (typeof taille !== 'number' || !Number.isInteger(taille) || taille <= 0 || taille > TAILLE_MAX_INSTRUMENT) throw refus();
    if (typeof dureeS !== 'number' || !Number.isFinite(dureeS) || dureeS <= 0 || dureeS > 60) throw refus();
    if (typeof licence !== 'string' || !(LICENCES_ACCEPTEES as readonly string[]).includes(licence)) throw refus();
    vus.add(id);
    return { id, nom, famille: famille as Famille, taille, dureeS, licence };
  });
}

let memoire: Promise<EntreeCatalogue[]> | null = null;

async function lireCatalogue(): Promise<EntreeCatalogue[]> {
  const url = urlInstruments('catalogue.json');
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE_INSTRUMENTS).catch(() => null) : null;
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const texte = await r.text();
    if (texte.length > 200_000) throw new Error('trop gros');
    const liste = validerCatalogue(JSON.parse(texte));
    await cache?.put(url, new Response(texte, { headers: { 'Content-Type': 'application/json' } })).catch(() => undefined);
    return liste;
  } catch (e) {
    if (e instanceof ErreurOcka) throw e;
    const garde = await cache?.match(url);
    if (garde) return validerCatalogue(JSON.parse(await garde.text()));
    throw new ErreurOcka('Pas de réseau : la liste des instruments n’est pas disponible. Reconnecte-toi puis réessaie.', 'hors_ligne');
  }
}

/** La liste des instruments (une seule lecture par session ; réessaie après une erreur). */
export function chargerCatalogue(): Promise<EntreeCatalogue[]> {
  if (!memoire) {
    memoire = lireCatalogue();
    memoire.catch(() => (memoire = null));
  }
  return memoire;
}

/** Pour les tests. */
export function oublierCatalogue(): void {
  memoire = null;
}

export async function entreeCatalogue(id: string): Promise<EntreeCatalogue> {
  const e = (await chargerCatalogue()).find((x) => x.id === id);
  if (!e) throw new ErreurOcka('Cet instrument n’existe pas (ou plus) dans OCKA.', 'instrument_introuvable');
  return e;
}

/** Les familles dans l'ordre d'affichage, chacune avec ses instruments triés par nom. Familles vides retirées. */
export function parFamilles(liste: readonly EntreeCatalogue[]): { famille: Famille; instruments: EntreeCatalogue[] }[] {
  return FAMILLES.map((famille) => ({
    famille,
    instruments: liste.filter((e) => e.famille === famille).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
  })).filter((f) => f.instruments.length > 0);
}

function simplifier(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Recherche sans accents ni majuscules, dans le nom et la famille (« cle » trouve « Clavecin », « Claviers »…). */
export function rechercher(liste: readonly EntreeCatalogue[], texte: string): EntreeCatalogue[] {
  const mots = simplifier(texte).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [...liste];
  return liste.filter((e) => {
    const cible = simplifier(`${e.nom} ${e.famille}`);
    return mots.every((m) => cible.includes(m));
  });
}
