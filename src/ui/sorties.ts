// Pont entre le studio et l'assistant de sortie (A1) : c'est ici que U branche le bouton « Sortir sur Spotify »
// de l'écran Exporter, et qu'A1 ouvre l'assistant depuis l'onglet Sorties. Propriétaire : A1.
// État de l'assistant : la sortie (`sortieEditee`, dans etat.ts), ses morceaux, les réglages, le champ à corriger.
// Sauvegardes différées (600 ms) ; le morceau ouvert dans le studio passe par l'historique (Annuler / auto-sauvegarde).

import { signal } from '@preact/signals';
import {
  ecrireReglages,
  lirePochette,
  listerSorties,
  nouvelleSortie,
  ouvrirMorceau,
  ouvrirSortie,
  sauverMorceau,
  sauverSortie,
  type ProblemeSortie,
  type Reglages,
  lireReglages,
  type Sortie,
} from '../moteur/api';
import type { Morceau } from '../morceau/types';
import { T } from '../textes-fr';
import { afficherToast, historique, idMorceau, messageErreur, modifier, morceau, sortieEditee, type EcranSortie } from './etat';
import { allerA } from './navigation';
import { sauverEnAttente } from './sauvegarde';
import { completerInfos, reglerTitre } from './composants/sortie/infos-titre';
import { formatChoisi, oublierDossier } from './composants/sortie/dossier-ui';

/** Les morceaux de la sortie ouverte, par id (le morceau ouvert dans le studio y est tenu à jour). */
export const titresSortie = signal<ReadonlyMap<string, Morceau>>(new Map());
export const reglagesSortie = signal<Reglages>({});
/** Côté de la pochette (px), s'il est connu. */
export const cotePochette = signal<number | null>(null);
/** Champ à mettre en avant après « Corriger » (n change à chaque clic, pour relancer l'effet). */
export const vise = signal<{ titre?: string; champ?: string; n: number } | null>(null);

const DELAI = 600;
let minuteurSortie: ReturnType<typeof setTimeout> | undefined;
let minuteurMorceaux: ReturnType<typeof setTimeout> | undefined;
let minuteurReglages: ReturnType<typeof setTimeout> | undefined;
const morceauxEnAttente = new Map<string, Morceau>();
let reglagesEnAttente: Partial<Reglages> = {};
/** La sortie a changé depuis sa dernière écriture. */
let aSauver = false;
let ecriture: Promise<void> = Promise.resolve();

const enSession = (id: string) => id === idMorceau.peek() && !!historique.peek();

/** Un morceau de la sortie : celui du studio s'il est ouvert (plus frais), sinon celui du stockage. */
async function lireTitre(id: string): Promise<Morceau | null> {
  const m = morceau.peek();
  if (m && enSession(id)) return m;
  return ouvrirMorceau(id).catch(() => null);
}

/** Côté de la pochette, lu en décodant l'image (une fois, à l'ouverture de l'assistant). */
export async function majCote(cle: string | undefined, cote?: number) {
  if (cote !== undefined || !cle) {
    cotePochette.value = cote ?? null;
    return;
  }
  cotePochette.value = null;
  try {
    const b = await lirePochette(cle);
    if (!b) return;
    const image = await createImageBitmap(b);
    cotePochette.value = Math.min(image.width, image.height);
    image.close();
  } catch {
    cotePochette.value = null;
  }
}

/** Charge une sortie dans l'assistant (sans changer d'écran) et complète les infos de ses titres. */
export async function chargerAssistant(s: Sortie): Promise<void> {
  await sauverEnAttente();
  const reglages = await lireReglages().catch(() => ({}) as Reglages);
  const map = new Map<string, Morceau>();
  for (const id of s.titres) {
    const m = await lireTitre(id);
    if (m) map.set(id, m);
  }
  oublierDossier();
  formatChoisi.value = null;
  reglagesSortie.value = reglages;
  titresSortie.value = map;
  sortieEditee.value = s;
  vise.value = null;
  for (const id of map.keys()) changerTitre(id, (m) => completerInfos(m, reglages.vraiNom));
  void majCote(s.pochette);
}

/* ------------------------------------------------------------ sauvegardes */

function ecrire(tache: () => Promise<unknown>) {
  ecriture = ecriture.then(tache).then(
    () => undefined,
    (e) => {
      console.error(e);
      afficherToast(messageErreur(e, T.sortie.erreurSauvegarde));
    },
  );
  return ecriture;
}

/** Écrit tout de suite ce qui attend (avant de préparer le dossier, en quittant la page). */
export function viderSauvegardes(): Promise<void> {
  clearTimeout(minuteurSortie);
  clearTimeout(minuteurMorceaux);
  clearTimeout(minuteurReglages);
  const s = sortieEditee.peek();
  const morceaux = [...morceauxEnAttente];
  morceauxEnAttente.clear();
  const r = reglagesEnAttente;
  reglagesEnAttente = {};
  if (s && aSauver) {
    aSauver = false;
    void ecrire(() => sauverSortie(s));
  }
  for (const [id, m] of morceaux) void ecrire(() => sauverMorceau(m, id));
  if (Object.keys(r).length) void ecrire(() => ecrireReglages(r));
  return ecriture.then(() => sauverEnAttente());
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void viderSauvegardes());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void viderSauvegardes());
}

/* ------------------------------------------------------------ modifier la sortie */

/** Change des champs de la sortie (undefined = retiré). Garde le label et les réglages en accord. */
export function modifierSortie(c: Partial<Sortie>) {
  const s = sortieEditee.peek();
  if (!s) return;
  const n: Sortie = { ...s, ...c };
  for (const [k, v] of Object.entries(c)) if (v === undefined) delete (n as unknown as Record<string, unknown>)[k];
  if (c.artiste !== undefined && (!s.label || s.label === s.artiste)) {
    if (c.artiste.trim()) n.label = c.artiste.trim();
    else delete n.label;
  }
  // Single d'un titre : le nom de la sortie et le titre du morceau restent les mêmes.
  if (c.titre !== undefined && s.titres.length === 1) {
    const id = s.titres[0]!;
    const m = titresSortie.peek().get(id);
    if (m && m.titre.trim() === s.titre.trim()) changerTitre(id, (x) => reglerTitre(x, c.titre!), `sortie-titre-${id}`, false);
  }
  sortieEditee.value = n;
  oublierDossier();
  aSauver = true;
  clearTimeout(minuteurSortie);
  minuteurSortie = setTimeout(() => void viderSauvegardes(), DELAI);
  const r: Partial<Reglages> = {};
  if (c.artiste !== undefined) r.artiste = c.artiste.trim();
  if (c.distributeur !== undefined) r.distributeur = c.distributeur;
  if ('lienProfil' in c) r.lienProfil = c.lienProfil ?? '';
  if (Object.keys(r).length) {
    reglagesEnAttente = { ...reglagesEnAttente, ...r };
    reglagesSortie.value = { ...reglagesSortie.peek(), ...r };
    clearTimeout(minuteurReglages);
    minuteurReglages = setTimeout(() => void viderSauvegardes(), DELAI);
  }
}

/**
 * Change un titre de la sortie avec une fonction pure. Le morceau ouvert dans le studio passe par l'historique
 * (sa sauvegarde automatique l'écrit) ; les autres sont écrits après 600 ms.
 */
export function changerTitre(id: string, op: (m: Morceau) => Morceau, cle?: string, suivreSingle = true) {
  const map = titresSortie.peek();
  const m = map.get(id);
  if (!m) return;
  let n = op(m);
  if (n === m) return;
  if (enSession(id)) {
    modifier(op, cle);
    n = morceau.peek() ?? n;
  } else {
    morceauxEnAttente.set(id, n);
    clearTimeout(minuteurMorceaux);
    minuteurMorceaux = setTimeout(() => void viderSauvegardes(), DELAI);
  }
  const copie = new Map(map);
  copie.set(id, n);
  titresSortie.value = copie;
  oublierDossier();
  // Single d'un titre : renommer le morceau renomme la sortie (si elle avait le même nom).
  const s = sortieEditee.peek();
  if (suivreSingle && s && s.titres.length === 1 && s.titres[0] === id && n.titre !== m.titre && s.titre.trim() === m.titre.trim()) {
    modifierSortie({ titre: n.titre });
  }
}

export async function ajouterTitre(id: string) {
  const s = sortieEditee.peek();
  if (!s || s.titres.includes(id) || s.titres.length >= 32) return;
  const m = await lireTitre(id);
  if (!m) return afficherToast(T.accueil.introuvable);
  titresSortie.value = new Map(titresSortie.peek()).set(id, m);
  modifierSortie({ titres: [...s.titres, id], ...(s.titre.trim() ? {} : { titre: m.titre }) });
  changerTitre(id, (x) => completerInfos(x, reglagesSortie.peek().vraiNom));
}

export function retirerTitre(id: string) {
  const s = sortieEditee.peek();
  if (s) modifierSortie({ titres: s.titres.filter((t) => t !== id) });
}

/** Le vrai nom (demandé une seule fois) : sauvé, puis il remplit les crédits des titres qui n'en ont pas. */
export async function enregistrerVraiNom(nom: string) {
  try {
    reglagesSortie.value = await ecrireReglages({ vraiNom: nom.trim() });
  } catch (e) {
    return afficherToast(messageErreur(e, T.sortie.erreurSauvegarde));
  }
  for (const id of titresSortie.peek().keys()) changerTitre(id, (m) => completerInfos(m, nom.trim()));
}

/** « Corriger » : va sur le bon écran et met le champ en avant. */
export function viser(p: ProblemeSortie['corriger']) {
  vise.value = { ...(p.titre ? { titre: p.titre } : {}), ...(p.champ ? { champ: p.champ } : {}), n: Date.now() };
  allerA(`sortie-${p.ecran}` as EcranSortie);
}

/* ------------------------------------------------------------ ouvrir l'assistant */

/** Une sortie d'un seul titre qui contient déjà ce morceau (on la rouvre au lieu d'en créer une autre). */
async function singleExistant(idM: string): Promise<Sortie | null> {
  for (const r of await listerSorties()) {
    if (r.nbTitres !== 1) continue;
    const s = await ouvrirSortie(r.id).catch(() => null);
    if (s?.titres[0] === idM) return s;
  }
  return null;
}

/**
 * « Sortir sur Spotify » (écran Exporter) : sauve le morceau en attente, crée une sortie d'un titre
 * (nouvelleSortie(idMorceau)) — ou rouvre celle qui existe déjà —, la met dans `sortieEditee` et va sur « sortie-infos ».
 * N'échoue jamais : une erreur s'affiche en toast.
 */
export async function sortirSurSpotify(idMorceauASortir: string): Promise<void> {
  try {
    await sauverEnAttente();
    const s = (await singleExistant(idMorceauASortir)) ?? (await nouvelleSortie(idMorceauASortir));
    await chargerAssistant(s);
    allerA('sortie-infos');
  } catch (e) {
    console.error(e);
    afficherToast(messageErreur(e, T.sortie.erreurOuverture));
  }
}

/** Ouvre une sortie existante dans l'assistant (charge `sortieEditee`, puis va sur `ecran`, « sortie-infos » par défaut). */
export async function ouvrirAssistant(idSortie: string, ecranVise: EcranSortie = 'sortie-infos'): Promise<void> {
  try {
    const s = await ouvrirSortie(idSortie);
    if (!s) return afficherToast(T.sortie.introuvable);
    await chargerAssistant(s);
    allerA(ecranVise);
  } catch (e) {
    console.error(e);
    afficherToast(messageErreur(e, T.sortie.erreurOuverture));
  }
}

/** « Nouvelle sortie » (onglet Sorties) : une sortie vide, pré-remplie avec les réglages. */
export async function creerSortieVide(): Promise<void> {
  try {
    await chargerAssistant(await nouvelleSortie());
    allerA('sortie-infos');
  } catch (e) {
    console.error(e);
    afficherToast(messageErreur(e, T.sortie.erreurOuverture));
  }
}
