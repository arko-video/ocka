// Sauvegarde automatique : 1 s après chaque modification, et tout de suite quand on quitte la page.
// Les écritures sont enchaînées (jamais deux en même temps) : un nouveau morceau reçoit un seul id.

import { effect } from '@preact/signals';
import { sauverMorceau } from '../moteur/api';
import type { Morceau } from '../morceau/types';
import { etatSauvegarde, idMorceau, morceau } from './etat';

let minuteur: ReturnType<typeof setTimeout> | undefined;
let minuteurIndicateur: ReturnType<typeof setTimeout> | undefined;
let enAttente: Morceau | null = null;
let dernierEcrit: Morceau | null = null;
let ecriture: Promise<void> = Promise.resolve();

function planifier(m: Morceau) {
  enAttente = m;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => void sauverEnAttente(), 1000);
}

/** Écrit la sauvegarde en attente ; la promesse se résout quand tout est écrit. */
export function sauverEnAttente(): Promise<void> {
  clearTimeout(minuteur);
  if (enAttente) ecriture = ecriture.then(ecrire);
  return ecriture;
}

async function ecrire() {
  const m = enAttente;
  if (!m) return;
  enAttente = null;
  try {
    const id = await sauverMorceau(m, idMorceau.peek() ?? undefined);
    // Le morceau ouvert est toujours celui-ci : on garde son id.
    if (morceau.peek() && !idMorceau.peek()) idMorceau.value = id;
    dernierEcrit = m;
    etatSauvegarde.value = 'enregistre';
  } catch (e) {
    console.error(e);
    etatSauvegarde.value = 'erreur';
  }
  clearTimeout(minuteurIndicateur);
  minuteurIndicateur = setTimeout(() => {
    if (etatSauvegarde.peek() === 'enregistre') etatSauvegarde.value = 'rien';
  }, 2500);
}

/** Enregistre tout de suite un morceau qu'on vient de créer (il apparaît dans « Mes morceaux »). */
export function sauverTout(m: Morceau): Promise<void> {
  enAttente = m;
  return sauverEnAttente();
}

/** Morceau ouvert sans modification : rien à écrire. */
export function marquerEcrit(m: Morceau) {
  dernierEcrit = m;
  enAttente = null;
  clearTimeout(minuteur);
}

export function activerSauvegardeAuto() {
  effect(() => {
    const m = morceau.value;
    if (m && m !== dernierEcrit) planifier(m);
  });
  window.addEventListener('pagehide', () => void sauverEnAttente());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void sauverEnAttente();
  });
}
