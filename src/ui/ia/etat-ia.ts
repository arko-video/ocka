// État de l'IA côté interface : fournisseur choisi et clé (lue une fois dans ocka-cles, puis gardée en mémoire de la
// page pour que l'envoi parte DANS le toucher). Si le téléphone refuse de garder la clé (navigation privée), elle
// reste en mémoire jusqu'à la fermeture d'OCKA. Repris de cles-monteur.ts d'Arko (licence MIT, même auteur).

import { signal } from '@preact/signals';
import {
  lireCle,
  lireFournisseur,
  oublierCle,
  sauverCle,
  sauverFournisseur,
  trouverFournisseur,
  type IdFournisseur,
  type ReglagesIa as Reglages,
} from '../../moteur/api';

export const fournisseurIa = signal<IdFournisseur>('anthropic');
/** Clé du fournisseur choisi (null = pas de clé). Jamais affichée en entier. */
export const cleIa = signal<string | null>(null);
/** true quand la clé n'est gardée qu'en mémoire (le téléphone a refusé). */
export const cleEnMemoire = signal(false);
export const iaChargee = signal(false);

const enMemoire: Partial<Record<IdFournisseur, string>> = {};

async function chargerCle(f: IdFournisseur) {
  const c = (await lireCle(f)) ?? enMemoire[f] ?? null;
  if (fournisseurIa.peek() !== f) return;
  cleIa.value = c;
  cleEnMemoire.value = !!enMemoire[f];
}

/** À appeler à l'ouverture d'un panneau d'IA (lit le fournisseur et la clé une seule fois). */
export async function chargerIa(): Promise<void> {
  if (iaChargee.peek()) return;
  fournisseurIa.value = await lireFournisseur();
  await chargerCle(fournisseurIa.peek());
  iaChargee.value = true;
}

export async function choisirFournisseur(f: IdFournisseur): Promise<void> {
  fournisseurIa.value = f;
  cleIa.value = null;
  void sauverFournisseur(f);
  await chargerCle(f);
}

/** Garde la clé (après un test réussi). */
export async function garderCle(f: IdFournisseur, cle: string): Promise<void> {
  const propre = cle.replace(/\s+/g, '');
  try {
    await sauverCle(f, propre);
    delete enMemoire[f];
  } catch {
    enMemoire[f] = propre;
  }
  if (fournisseurIa.peek() === f) {
    cleIa.value = propre;
    cleEnMemoire.value = !!enMemoire[f];
  }
}

export async function oublierCleIa(f: IdFournisseur): Promise<void> {
  await oublierCle(f);
  delete enMemoire[f];
  if (fournisseurIa.peek() === f) {
    cleIa.value = null;
    cleEnMemoire.value = false;
  }
}

/** Réglages pour un envoi, ou null sans clé. */
export function reglagesIa(signal?: AbortSignal): Reglages | null {
  const cle = cleIa.peek();
  return cle ? { fournisseur: fournisseurIa.peek(), cle, signal } : null;
}

/** « Anthropic », « OpenAI », « Gemini ». */
export function nomCourt(id: IdFournisseur): string {
  return trouverFournisseur(id)
    .nom.replace(/\s*\(.*\)/, '')
    .replace(/^Google\s+/, '');
}
