// Autotune avancé — implémentation du contrat C2 (api-autotune.ts). Propriétaire : A1.
// Le calcul est réparti : notes.ts (analyse en notes), detection-gamme.ts (Krumhansl), reglages.ts (préréglages,
// noms), courbe-correction.ts + psola-avance.ts + rendu-avance.ts (rendu, partiel ou complet), moteur-avance.ts
// (caches) dans avance.worker.ts (calcul-avance.ts côté page), conseil.ts (« Corriger tout seul », appliquer).
// Ici : les caches de la page (analyses en mémoire, rendus dans OPFS ocka-prises) et l'état des rendus.

import { ecrireTexte, nomDescription, ouvrirEcriture } from '../enregistrement/fichiers-opfs';
import type { AutotunePrise, Morceau, Prise } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import type { AnalyseNotes, NoteDetectee, OptionsAutotune } from './api-autotune';
import { calculerAnalyse, calculerRendu } from './calcul-avance';
import { detecterGamme as detecter } from './detection-gamme';
import { lireFait, noter, type PcmVoix } from './etats';
import { nomRenduAutotune } from './reglages';

export { appliquerConseil, corrigerToutSeul } from './conseil';
export { nomRenduAutotune, presetDuStyle, reglagesDeForce, reglagesPreset } from './reglages';

/** Les 2 gammes les plus probables ; `tonalite` (facultatif) : celle du morceau, favorisée quand la voix hésite. */
export function detecterGamme(notes: readonly NoteDetectee[], tonalite?: Morceau['tonalite']): ReturnType<typeof detecter> {
  return detecter(notes, tonalite);
}

/* ------------------------------------------------------------ analyse (cache par fichier) */

const MAX_ANALYSES = 8;
const analyses = new Map<string, Promise<AnalyseNotes>>();

export function analyserNotes(prise: Prise, options?: OptionsAutotune): Promise<AnalyseNotes> {
  const cle = `${prise.fichier}@${prise.frequence}`;
  const deja = analyses.get(cle);
  if (deja) return deja;
  const p = calculerAnalyse(prise, options?.signal, options?.surProgression);
  analyses.set(cle, p);
  while (analyses.size > MAX_ANALYSES) analyses.delete(analyses.keys().next().value!);
  p.catch(() => analyses.delete(cle)); // une erreur ou une annulation ne reste pas en cache
  return p;
}

/* ------------------------------------------------------------ rendu (cache dans OPFS) */

const enCours = new Map<string, Promise<PcmVoix | null>>();

export function rendreAutotune(prise: Prise, reglages: AutotunePrise, tonalite: Morceau['tonalite'], options?: OptionsAutotune): Promise<PcmVoix | null> {
  const nom = nomRenduAutotune(prise, reglages, tonalite);
  const deja = enCours.get(nom);
  if (deja) return deja;
  const p = (async (): Promise<PcmVoix | null> => {
    const fait = await lireFait(nom, prise.frequence);
    if (fait) return fait === 'repli' ? null : fait;
    noter(nom, { etat: 'calcul', voisees: 0 });
    try {
      const r = await calculerRendu(prise, reglages, tonalite, options?.signal, options?.surProgression);
      if (r.applique) {
        const e = await ouvrirEcriture(nom);
        e.ecrire(r.pcm);
        await e.fermer();
      }
      await ecrireTexte(nomDescription(nom), JSON.stringify({ voisees: Math.round(r.voisees * 1000) / 1000, applique: r.applique }));
      noter(nom, { etat: r.applique ? 'pret' : 'repli', voisees: r.voisees });
      return r.applique ? { frequence: prise.frequence, pcm: r.pcm, version: nom } : null;
    } catch (e) {
      const code = e instanceof ErreurOcka ? e.code : '';
      noter(nom, { etat: code === 'annule' ? 'calcul' : 'erreur', voisees: 0 });
      throw e;
    }
  })().finally(() => enCours.delete(nom));
  enCours.set(nom, p);
  return p;
}

const attentes = new Map<string, ReturnType<typeof setTimeout>>();

/** Rendu en tâche de fond, 0,7 s après la DERNIÈRE demande pour cette prise (réglage qui glisse). */
export function rendrePlusTard(prise: Prise, tonalite: Morceau['tonalite']): void {
  const reglages = prise.autotune;
  if (!reglages) return;
  clearTimeout(attentes.get(prise.fichier));
  attentes.set(
    prise.fichier,
    setTimeout(() => {
      attentes.delete(prise.fichier);
      rendreAutotune(prise, reglages, tonalite).catch((e: unknown) => console.error(e));
    }, 700),
  );
}

/**
 * Le PCM à jouer pour une prise qui a un `autotune` (voir lirePcmVoix, autotune.ts) : `attendre` (export) attend
 * le rendu ; sinon le rendu s'il est prêt, sinon `brut()` et le rendu part en tâche de fond.
 */
export async function pcmAvance(prise: Prise, m: Morceau, attendre: boolean, brut: () => Promise<PcmVoix | null>, deja?: PcmVoix): Promise<PcmVoix | null> {
  const reglages = prise.autotune!;
  const nom = nomRenduAutotune(prise, reglages, m.tonalite);
  if (deja?.version === nom) return deja;
  if (attendre) {
    const r = await rendreAutotune(prise, reglages, m.tonalite).catch((e: unknown) => (console.error(e), null));
    return r ?? brut();
  }
  const fait = await lireFait(nom, prise.frequence);
  if (fait && fait !== 'repli') return fait;
  if (!fait) rendrePlusTard(prise, m.tonalite);
  return brut();
}
