// « Mes morceaux » dans IndexedDB, base « ocka-morceaux » (magasin('morceaux') de ./dossiers) :
// - « #index » : la liste des résumés (titre, style, durée, date) ;
// - « <id> » : chaque morceau complet.
// Les morceaux de la phase 1 (base « keyval-store ») sont migrés avant tout accès (./migration.ts).
// Les fichiers des prises (ocka-prises) et des sons (ocka-sons) : copiés quand on duplique. Ils ne sont JAMAIS
// effacés tout de suite (« Annuler » doit pouvoir ramener une prise) : le ramasse-miettes (./menage.ts) s'en charge.
import { del, get, set, update } from 'idb-keyval';
import { nouvelId } from '../enregistrement/contexte';
import { nomDescription, supprimerFichier } from '../enregistrement/fichiers-opfs';
import { copierPrise } from '../enregistrement/prises';
import { ErreurOcka, type ResumeMorceau } from '../moteur/api';
import { normaliserMorceau } from '../morceau/normaliser';
import { REGLE_ID, type Morceau, type SonImporte } from '../morceau/types';
import { copierSon, supprimerSon } from '../sons/import';
import { enErreurOcka, magasin } from './dossiers';
import { indexValide, majIndex, resumer, retirerDeIndex, titreCopie } from './index-morceaux';
import { menage } from './menage';
import { CLE_INDEX, migrer } from './migration';

const base = () => magasin('morceaux');

async function lireIndex(): Promise<ResumeMorceau[]> {
  return indexValide(await get(CLE_INDEX, base()));
}

/** Les morceaux, du plus récent au plus ancien. Lance aussi le ramasse-miettes (fichiers orphelins, vieux exports). */
export async function listerMorceaux(): Promise<ResumeMorceau[]> {
  await migrer();
  const index = await lireIndex();
  void menage().catch(() => undefined);
  return [...index].sort((a, b) => b.modifieLe - a.modifieLe);
}

/** Ouvre un morceau, passé au normaliseur (il corrige ce qui est abîmé). null s'il n'existe pas. */
export async function ouvrirMorceau(id: string): Promise<Morceau | null> {
  if (!REGLE_ID.test(id)) return null;
  await migrer();
  const brut = await get(id, base());
  if (brut === undefined) return null;
  const { morceau, problemes, bloquant } = normaliserMorceau(brut);
  if (bloquant) {
    const raison = problemes.find((p) => p.niveau === 'bloquant')?.message ?? 'il est abîmé.';
    throw new ErreurOcka(`Ce morceau ne peut pas être ouvert : ${raison}`, 'morceau_illisible');
  }
  return morceau;
}

/**
 * Sauve le morceau (id créé si absent) ; renvoie son id. Erreurs : « disque_plein », « stockage ».
 * (Le stockage durable est demandé par l'interface après un geste : demanderPersistance, plus ici.)
 */
export async function sauverMorceau(morceau: Morceau, id?: string): Promise<string> {
  const cle = id ?? nouvelId();
  if (!REGLE_ID.test(cle)) throw new ErreurOcka('Identifiant de morceau invalide.', 'morceau_invalide');
  await migrer();
  try {
    await set(cle, morceau, base());
    await update(CLE_INDEX, (brut) => majIndex(indexValide(brut), resumer(cle, morceau, Date.now())), base());
  } catch (e) {
    throw enErreurOcka(e, { message: "Le morceau n'a pas pu être sauvé (stockage du téléphone plein ?).", code: 'stockage' });
  }
  return cle;
}

/**
 * Copie un morceau ET les fichiers de ses prises et de ses sons ; renvoie l'id de la copie.
 * Tout ou rien : si un fichier ne peut pas être copié, rien n'est créé et une ErreurOcka est levée.
 */
export async function dupliquerMorceau(id: string): Promise<string> {
  await migrer();
  const original = REGLE_ID.test(id) ? await get<Morceau>(id, base()) : undefined;
  if (!original) throw new ErreurOcka("Ce morceau n'existe plus.", 'morceau_introuvable');
  const copie: Morceau = structuredClone(original);
  const titres = (await lireIndex()).map((r) => r.titre);
  copie.titre = titreCopie(original.titre ?? '', titres);
  copie.prises = [];
  const sons: SonImporte[] = [];
  try {
    for (const p of original.prises ?? []) copie.prises.push(await copierPrise(p));
    for (const s of original.sons ?? []) sons.push(await copierSon(s));
    if (original.sons) copie.sons = sons;
    return await sauverMorceau(copie);
  } catch (e) {
    // On efface les copies déjà faites : elles n'appartiennent à aucun morceau.
    for (const p of copie.prises) {
      await supprimerFichier(p.fichier);
      await supprimerFichier(nomDescription(p.fichier));
    }
    for (const s of sons) await supprimerSon(s.fichier);
    throw e;
  }
}

/** Supprime un morceau. Les fichiers de ses prises et sons seront effacés par le ramasse-miettes (pas tout de suite). */
export async function supprimerMorceau(id: string): Promise<void> {
  if (!REGLE_ID.test(id)) return;
  await migrer();
  await del(id, base());
  await update(CLE_INDEX, (brut) => retirerDeIndex(indexValide(brut), id), base());
}

/**
 * Ramasse-miettes : efface les fichiers de prises (et de sons) qu'AUCUN morceau sauvé n'utilise (prises ou
 * morceaux supprimés, essais abandonnés), d'avant cette séance (si aucun autre onglet n'est ouvert) ou vieux
 * d'au moins `ageMin` (1 h par défaut). Renvoie le nombre de fichiers de prises effacés.
 */
export async function nettoyerPrisesOrphelines(ageMin?: number): Promise<number> {
  return (await menage(ageMin)).prises;
}
