// « Préparer le dossier » (écran Vérifier) : progression par titre, Annuler, résultat à télécharger. Propriétaire : A1.
// Pendant la préparation, le bouton Retour est bloqué (gardesRetour) et l'écran reste allumé (Wake Lock, dans le moteur).

import { signal } from '@preact/signals';
import { demanderPersistance, ErreurOcka, exporterDossierSortie, type Sortie } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { afficherToast, messageErreur, sortieEditee } from '../../etat';
import { gardesRetour } from '../../navigation';
import { viderSauvegardes } from '../../sorties';

export type FormatDossier = 'flac16' | 'wav24';

export type EtatDossier =
  | { phase: 'avant' }
  | { phase: 'encours'; titre: number; p: number; annuler: () => void }
  | { phase: 'fini'; fichier: File; url: string; nom: string; pour: Sortie }
  | { phase: 'erreur'; message: string };

export const etatDossier = signal<EtatDossier>({ phase: 'avant' });
/** Format choisi à la main (null = selon le distributeur : DistroKid → WAV, sinon FLAC). */
export const formatChoisi = signal<FormatDossier | null>(null);

export function formatDe(s: Sortie | null): FormatDossier {
  return formatChoisi.value ?? (s?.distributeur === 'distrokid' ? 'wav24' : 'flac16');
}

export const dossierEnCours = () => etatDossier.peek().phase === 'encours';

/** Le résultat n'est plus valable (sortie ou titre modifié, autre sortie ouverte). */
export function oublierDossier() {
  const e = etatDossier.peek();
  if (e.phase === 'encours') return;
  if (e.phase === 'fini') URL.revokeObjectURL(e.url);
  if (e.phase !== 'avant') etatDossier.value = { phase: 'avant' };
}

export async function preparerDossier() {
  const s = sortieEditee.peek();
  if (!s || dossierEnCours()) return;
  gardesRetour.set('sortie-verifier', () => (dossierEnCours() ? T.sortie.enCoursRetour : null));
  oublierDossier();
  const ctrl = new AbortController();
  etatDossier.value = { phase: 'encours', titre: 0, p: 0, annuler: () => ctrl.abort() };
  try {
    await viderSauvegardes();
    const fichier = await exporterDossierSortie(s, {
      format: formatDe(s),
      signal: ctrl.signal,
      surProgression: (titre, p) => {
        if (etatDossier.peek().phase === 'encours') etatDossier.value = { ...(etatDossier.peek() as { phase: 'encours'; annuler: () => void }), titre, p };
      },
    });
    if (ctrl.signal.aborted) return;
    etatDossier.value = { phase: 'fini', fichier, url: URL.createObjectURL(fichier), nom: fichier.name, pour: s };
    void demanderPersistance();
  } catch (e) {
    if (ctrl.signal.aborted || (e instanceof ErreurOcka && e.code === 'annule')) {
      etatDossier.value = { phase: 'avant' };
      afficherToast(T.sortie.annule);
      return;
    }
    console.error(e);
    etatDossier.value = { phase: 'erreur', message: messageErreur(e, T.sortie.erreurDossier) };
  }
}

export function annulerDossier() {
  const e = etatDossier.peek();
  if (e.phase === 'encours') e.annuler();
}

/** « Partager » le ZIP (si le téléphone sait le faire) ; sinon on conseille Télécharger. */
export async function partagerDossier() {
  const e = etatDossier.peek();
  if (e.phase !== 'fini') return;
  try {
    if (navigator.canShare?.({ files: [e.fichier] })) await navigator.share({ files: [e.fichier], title: e.nom });
    else afficherToast(T.exporter.partageImpossible);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') afficherToast(T.exporter.partageImpossible);
  }
}
