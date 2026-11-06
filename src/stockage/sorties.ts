// « Mes sorties » dans IndexedDB (base ocka-sorties, via magasin('sorties') de ./dossiers). Propriétaire : A1.
// Une entrée par sortie : « <id> » → Sortie. Tout ce qui est lu passe par normaliserSortie.
// `Sortie.titres` est la seule source de vérité : un morceau peut être dans plusieurs sorties ; supprimer un
// morceau le retire de ses sorties (retirerMorceauDesSorties). Les pochettes orphelines partent au ramasse-miettes.

import { del, entries, get, set, values } from 'idb-keyval';
import { nouvelId } from '../enregistrement/contexte';
import { ErreurOcka } from '../moteur/erreur';
import { dateParDefaut, normaliserSortie } from '../morceau/normaliser-sortie';
import { DEFINITIONS_STYLES } from '../morceau/styles/index';
import { REGLE_ID, type Morceau, type Style } from '../morceau/types';
import { nettoyerPochettes } from '../sortie/pochette';
import { typeSortie } from '../sortie/regles';
import { FORMAT_SORTIE, type Reglages, type ResumeSortie, type Sortie } from '../sortie/types';
import { enErreurOcka, magasin } from './dossiers';
import { listerMorceaux, ouvrirMorceau } from './morceaux';
import { lireReglages } from './reglages';

const ERREUR_LECTURE = { message: 'Impossible de lire tes sorties.', code: 'stockage' };
const ERREUR_ECRITURE = { message: 'La sortie n’a pas pu être sauvée.', code: 'stockage' };

/** Genre proposé d'après le style du morceau (valeur des listes des distributeurs ; dans le fichier du style). */
export const GENRE_PAR_STYLE: Readonly<Record<Style, string>> = Object.fromEntries(
  Object.values(DEFINITIONS_STYLES).map((d) => [d.id, d.genre]),
) as Record<Style, string>;

/**
 * Une sortie neuve (pure) : artiste, lien et distributeur repris des réglages, label = artiste,
 * date = aujourd'hui + 6 semaines. Avec un morceau : un titre, son nom, son genre et son niveau.
 */
export function sortieNeuve(reglages: Reglages, morceau: Morceau | null, idMorceau: string | undefined, id: string, maintenant: number): Sortie {
  const artiste = reglages.artiste ?? morceau?.artiste?.trim() ?? '';
  const s: Sortie = {
    format: FORMAT_SORTIE,
    id,
    titre: morceau?.titre.trim() ?? '',
    artiste,
    dateSortie: dateParDefaut(maintenant),
    genre: morceau ? (GENRE_PAR_STYLE[morceau.style] ?? 'Hip-Hop/Rap') : 'Hip-Hop/Rap',
    langue: 'fr',
    titres: morceau && idMorceau ? [idMorceau] : [],
    distributeur: reglages.distributeur ?? 'routenote',
    niveau: morceau?.master.niveau ?? 'standard',
    modifieLe: maintenant,
  };
  if (artiste) s.label = artiste;
  if (reglages.lienProfil) s.lienProfil = reglages.lienProfil;
  return s;
}

/* ------------------------------------------------------------ ramasse-miettes des pochettes */

let dernierMenage = 0;

/**
 * Efface les pochettes qu'aucune sortie n'utilise (vieilles d'au moins une heure), sous le verrou « ocka-menage »
 * (jamais en même temps que le ménage des prises et des sons, ni dans deux onglets). Au plus une fois par 10 min.
 */
export async function menagePochettes(force = false): Promise<number> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks?.request) return 0;
  const maintenant = Date.now();
  if (!force && maintenant - dernierMenage < 600_000) return 0;
  dernierMenage = maintenant;
  return locks.request('ocka-menage', { ifAvailable: true }, async (verrou) => {
    if (!verrou) return 0;
    const utilisees = new Set<string>();
    // Toutes les sorties, même illisibles (format plus récent) : on ne touche pas à leur pochette.
    for (const brut of await values(magasin('sorties'))) {
      const p = (brut as { pochette?: unknown } | null)?.pochette;
      if (typeof p === 'string') utilisees.add(p);
    }
    return nettoyerPochettes(utilisees, maintenant);
  });
}

/* ------------------------------------------------------------ sorties */

export async function listerSorties(): Promise<ResumeSortie[]> {
  let lues: [IDBValidKey, unknown][];
  let durees: Map<string, number>;
  try {
    const [e, morceaux] = await Promise.all([entries(magasin('sorties')), listerMorceaux()]);
    lues = e;
    durees = new Map(morceaux.map((r) => [r.id, r.duree]));
  } catch (e) {
    throw enErreurOcka(e, ERREUR_LECTURE);
  }
  const liste: ResumeSortie[] = [];
  for (const [cle, brut] of lues) {
    const { sortie, bloquant } = normaliserSortie(brut, durees.keys());
    if (bloquant) continue;
    const ds = sortie.titres.map((id) => durees.get(id) ?? 0);
    const r: ResumeSortie = {
      id: typeof cle === 'string' && REGLE_ID.test(cle) ? cle : sortie.id,
      titre: sortie.titre,
      artiste: sortie.artiste,
      nbTitres: sortie.titres.length,
      duree: ds.reduce((s, d) => s + d, 0),
      type: typeSortie(ds),
      modifieLe: sortie.modifieLe,
    };
    if (sortie.pochette) r.pochette = sortie.pochette;
    liste.push(r);
  }
  void menagePochettes().catch(() => 0);
  return liste.sort((a, b) => b.modifieLe - a.modifieLe);
}

export async function ouvrirSortie(id: string): Promise<Sortie | null> {
  if (typeof id !== 'string' || !REGLE_ID.test(id)) return null;
  let brut: unknown;
  let ids: string[];
  try {
    brut = await get(id, magasin('sorties'));
    if (brut === undefined) return null;
    ids = (await listerMorceaux()).map((r) => r.id);
  } catch (e) {
    throw enErreurOcka(e, ERREUR_LECTURE);
  }
  const { sortie, problemes, bloquant } = normaliserSortie(brut, ids);
  if (bloquant) {
    const raison = problemes.find((p) => p.niveau === 'bloquant')?.message ?? 'elle est abîmée.';
    throw new ErreurOcka(`Cette sortie ne peut pas être ouverte : ${raison}`, 'sortie_illisible');
  }
  sortie.id = id;
  return sortie;
}

export async function sauverSortie(s: Sortie): Promise<Sortie> {
  const { sortie, problemes, bloquant } = normaliserSortie(s);
  if (bloquant) {
    throw new ErreurOcka(problemes.find((p) => p.niveau === 'bloquant')?.message ?? 'Cette sortie est illisible.', 'sortie_illisible');
  }
  sortie.modifieLe = Date.now();
  try {
    await set(sortie.id, sortie, magasin('sorties'));
  } catch (e) {
    throw enErreurOcka(e, ERREUR_ECRITURE);
  }
  return sortie;
}

export async function supprimerSortie(id: string): Promise<void> {
  if (typeof id !== 'string' || !REGLE_ID.test(id)) return;
  try {
    await del(id, magasin('sorties'));
  } catch (e) {
    throw enErreurOcka(e, { message: 'La sortie n’a pas pu être supprimée.', code: 'stockage' });
  }
  void menagePochettes(true).catch(() => 0);
}

export async function nouvelleSortie(depuisMorceau?: string): Promise<Sortie> {
  const reglages = await lireReglages();
  let morceau: Morceau | null = null;
  if (depuisMorceau !== undefined) {
    morceau = REGLE_ID.test(depuisMorceau) ? await ouvrirMorceau(depuisMorceau) : null;
    if (!morceau) throw new ErreurOcka('Ce morceau n’existe plus.', 'morceau_introuvable');
  }
  return sauverSortie(sortieNeuve(reglages, morceau, depuisMorceau, nouvelId(), Date.now()));
}

export async function retirerMorceauDesSorties(idMorceau: string): Promise<void> {
  const store = magasin('sorties');
  try {
    for (const [cle, brut] of await entries(store)) {
      const titres = (brut as { titres?: unknown } | null)?.titres;
      if (!Array.isArray(titres) || !titres.includes(idMorceau)) continue;
      const { sortie, bloquant } = normaliserSortie(brut);
      if (bloquant) continue; // format plus récent : on n'y touche pas
      if (typeof cle === 'string') sortie.id = cle;
      sortie.titres = sortie.titres.filter((t) => t !== idMorceau);
      sortie.modifieLe = Date.now();
      await set(cle, sortie, store);
    }
  } catch (e) {
    throw enErreurOcka(e, ERREUR_ECRITURE);
  }
}
