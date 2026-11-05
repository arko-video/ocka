// Exports de l'étape Exporter : WAV pour Spotify, M4A pour écouter, pistes séparées, envoi vers Arko (M4A),
// projet « .ocka ». Un seul export à la fois : progression, annulation, résultat. Toute modification du morceau
// rend le résultat périmé. Aussi : « Sortir sur Spotify » (assistant d'A1) et la demande de persistance.

import { effect, signal } from '@preact/signals';
import { demanderPersistance, envoyerVersArko, ErreurOcka, exporterAudio, exporterPistes, exporterProjet, exporterWav } from '../moteur/api';
import type { Morceau } from '../morceau/types';
import { T } from '../textes-fr';
import { afficherToast, idMorceau, messageErreur, morceau } from './etat';
import { nomFichier } from './format';
import { toastErreur } from './lecture';
import { sauverEnAttente } from './sauvegarde';
import { sortirSurSpotify } from './sorties';

export type TypeExport = 'wav' | 'm4a' | 'pistes' | 'arko' | 'projet';
/** Sonie (LUFS), crête vraie (dBTP) et durée : seulement pour un titre (WAV, M4A). */
export interface MesuresExport {
  lufs: number;
  creteVraie: number;
  duree: number;
}

export type EtatExport =
  | { phase: 'avant' }
  | { phase: 'encours'; type: TypeExport; p: number; annuler: () => void }
  | { phase: 'fini'; type: TypeExport; fichier: File; mesures: MesuresExport | null; url: string; nom: string }
  | { phase: 'erreur'; type: TypeExport; message: string };

export const etatExport = signal<EtatExport>({ phase: 'avant' });
export const bits16 = signal(false);
/** Message après « Envoyer vers Arko » (partagé, téléchargé…). */
export const messageArko = signal<string | null>(null);
let exporte: Morceau | null = null;

export function exportEnCours(): boolean {
  return etatExport.peek().phase === 'encours';
}

export function oublierExport() {
  const e = etatExport.peek();
  if (e.phase === 'fini') URL.revokeObjectURL(e.url);
  if (e.phase === 'encours') e.annuler();
  exporte = null;
  messageArko.value = null;
  etatExport.value = { phase: 'avant' };
}

/* ------------------------------------------------------------ persistance */

let persistanceDemandee = false;

/**
 * Après un geste (1re prise gardée, 1er export) : demande que les données d'OCKA ne soient pas effacées.
 * Refusé : on conseille « Exporter le projet » (un peu plus tard, pour ne pas cacher le message en cours).
 */
export async function persisterApresGeste() {
  if (persistanceDemandee) return;
  persistanceDemandee = true;
  try {
    if (!(await demanderPersistance())) setTimeout(() => afficherToast(T.exporter.persistance, 8000), 4000);
  } catch (e) {
    console.error(e);
  }
}

/* ------------------------------------------------------------ exports */

/** Id du morceau dans « Mes morceaux », après avoir écrit la sauvegarde en attente. */
async function idEnregistre(): Promise<string> {
  await sauverEnAttente();
  const id = idMorceau.peek();
  if (!id) throw new ErreurOcka(T.exporter.pasEnregistre, 'morceau_introuvable');
  return id;
}

async function produire(type: TypeExport, m: Morceau, signal: AbortSignal, surProgression: (p: number) => void) {
  switch (type) {
    case 'wav': {
      const r = await exporterWav(m, { bits: bits16.peek() ? 16 : 24, signal, surProgression });
      return { fichier: r.fichier, mesures: r as MesuresExport };
    }
    case 'm4a':
    case 'arko': {
      const r = await exporterAudio(m, { format: 'm4a', signal, surProgression });
      if (!r.fichier) throw new ErreurOcka(T.exporter.erreur, 'inconnu');
      return { fichier: r.fichier, mesures: r as MesuresExport };
    }
    case 'pistes':
      return { fichier: await exporterPistes(m, { signal, surProgression }), mesures: null };
    case 'projet':
      return { fichier: await exporterProjet(await idEnregistre(), { signal, surProgression }), mesures: null };
  }
}

const EXTENSIONS: Record<TypeExport, string> = { wav: 'wav', m4a: 'm4a', arko: 'm4a', pistes: 'zip', projet: 'ocka' };

/** Lance un export (un seul à la fois). Un bouchon (« pas_encore ») donne un toast propre, pas d'erreur. */
export async function lancerExport(type: TypeExport = 'wav') {
  const m = morceau.peek();
  if (!m || exportEnCours()) return;
  oublierExport();
  const ctrl = new AbortController();
  etatExport.value = { phase: 'encours', type, p: 0, annuler: () => ctrl.abort() };
  try {
    const r = await produire(type, m, ctrl.signal, (p) => {
      const e = etatExport.peek();
      if (e.phase === 'encours') etatExport.value = { ...e, p };
    });
    if (ctrl.signal.aborted) return;
    exporte = m;
    const nom = r.fichier.name || nomFichier(m.titre, EXTENSIONS[type]);
    etatExport.value = { phase: 'fini', type, fichier: r.fichier, mesures: r.mesures, url: URL.createObjectURL(r.fichier), nom };
    void persisterApresGeste();
  } catch (e) {
    if (ctrl.signal.aborted || (e instanceof ErreurOcka && e.code === 'annule')) {
      etatExport.value = { phase: 'avant' };
      return;
    }
    if (e instanceof ErreurOcka && e.code === 'pas_encore') {
      etatExport.value = { phase: 'avant' };
      afficherToast(e.message);
      return;
    }
    if (!(e instanceof ErreurOcka)) console.error(e);
    etatExport.value = { phase: 'erreur', type, message: messageErreur(e, T.exporter.erreur) };
  }
}

export function annulerExport() {
  const e = etatExport.peek();
  if (e.phase === 'encours') e.annuler();
  etatExport.value = { phase: 'avant' };
}

/** « Envoyer vers Arko » : le M4A prêt part par la feuille de partage (geste de l'utilisateur), sinon il est téléchargé. */
export async function envoyerArko() {
  const e = etatExport.peek();
  if (e.phase !== 'fini') return;
  try {
    const r = await envoyerVersArko(e.fichier);
    messageArko.value = r === 'partage' ? T.exporter.arkoPartage : r === 'boite' ? T.exporter.arkoBoite : T.exporter.arkoTelechargement;
  } catch (err) {
    if (err instanceof ErreurOcka && err.code === 'annule') return;
    toastErreur(err, T.exporter.partageImpossible);
  }
}

/** « Sortir sur Spotify » : crée une sortie d'un titre (A1) et ouvre l'assistant. */
export async function sortirSpotify() {
  try {
    await sortirSurSpotify(await idEnregistre());
  } catch (e) {
    toastErreur(e, T.exporter.erreur);
  }
}

/** Le résultat n'est valable que pour le morceau exporté. */
export function suivreExport() {
  effect(() => {
    const m = morceau.value;
    if (exporte && m !== exporte && etatExport.peek().phase === 'fini') oublierExport();
  });
}
