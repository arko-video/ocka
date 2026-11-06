// « Gérer les instruments » : ceux qui sont sur le téléphone, la place prise, la suppression.
// Tout est dans le Cache Storage « ocka-instruments » (rien d'autre n'y est touché).

import { CACHE_INSTRUMENTS, chargerCatalogue, urlInstruments, type EntreeCatalogue } from './catalogue';
import { dossierInstrument } from './format';
import { ENTETE_TAILLE } from './telechargement';

export interface InstrumentTelecharge {
  id: string;
  nom: string;
  famille: EntreeCatalogue['famille'] | null;
  /** Octets pris (fichiers rangés). */
  taille: number;
  /** false : téléchargement interrompu (des fichiers sans instrument.json) ; à supprimer. */
  complet: boolean;
}

async function ouvrir(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  return caches.open(CACHE_INSTRUMENTS);
}

/** « vcsl-marimba/z060-v1.ogg » pour une URL de la banque, sinon null. */
function cheminDans(url: string): { dossier: string; fichier: string } | null {
  const prefixe = urlInstruments('');
  const p = new URL(url).pathname;
  if (!p.startsWith(prefixe)) return null;
  const reste = p.slice(prefixe.length).split('/');
  return reste.length === 2 ? { dossier: reste[0], fichier: reste[1] } : null;
}

async function inventaire(): Promise<Map<string, { taille: number; complet: boolean }>> {
  const cache = await ouvrir();
  const res = new Map<string, { taille: number; complet: boolean }>();
  if (!cache) return res;
  for (const req of await cache.keys()) {
    const c = cheminDans(req.url);
    if (!c) continue;
    const r = await cache.match(req);
    const taille = Number(r?.headers.get(ENTETE_TAILLE)) || 0;
    const d = res.get(c.dossier) ?? { taille: 0, complet: false };
    d.taille += taille;
    if (c.fichier === 'instrument.json') d.complet = true;
    res.set(c.dossier, d);
  }
  return res;
}

/** Les instruments présents sur le téléphone, triés par nom (le catalogue donne nom et famille s'il est lisible). */
export async function listerTelecharges(): Promise<InstrumentTelecharge[]> {
  const inv = await inventaire();
  let catalogue: EntreeCatalogue[] = [];
  try {
    catalogue = await chargerCatalogue();
  } catch {
    // hors ligne et jamais vu : on montre quand même les dossiers
  }
  const liste: InstrumentTelecharge[] = [];
  for (const [dossier, d] of inv) {
    const e = catalogue.find((x) => dossierInstrument(x.id) === dossier);
    liste.push({ id: e?.id ?? dossier, nom: e?.nom ?? dossier, famille: e?.famille ?? null, taille: d.taille, complet: d.complet });
  }
  return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Place prise par tous les instruments (octets). */
export async function placeInstruments(): Promise<number> {
  let total = 0;
  for (const d of (await inventaire()).values()) total += d.taille;
  return total;
}

/** Efface un instrument (id « vcsl-marimba@1 » ou nom de dossier). Le catalogue gardé n'est pas touché. */
export async function supprimerInstrument(id: string): Promise<void> {
  const cache = await ouvrir();
  const dossier = dossierInstrument(id) ?? id;
  if (!cache || !/^[a-z0-9-]{1,60}$/.test(dossier)) return;
  for (const req of await cache.keys()) {
    if (cheminDans(req.url)?.dossier === dossier) await cache.delete(req);
  }
}

/** Efface tous les instruments téléchargés. */
export async function supprimerTout(): Promise<void> {
  const cache = await ouvrir();
  if (!cache) return;
  for (const req of await cache.keys()) if (cheminDans(req.url)) await cache.delete(req);
}

/** true si l'instrument est complet sur le téléphone (utilisable hors ligne). */
export async function estTelecharge(id: string): Promise<boolean> {
  const dossier = dossierInstrument(id);
  const cache = await ouvrir();
  if (!dossier || !cache) return false;
  return (await cache.match(urlInstruments(`${dossier}/instrument.json`))) !== undefined;
}
