// Voix avancée (V) : punch-in avec pré-roll, comping, nettoyeur, doublage auto, chaînes de voix prêtes.
// Le format n'a pas de champ pour le comping, le nettoyeur ni le doublage : leur résultat est une NOUVELLE prise
// (fichier OPFS ocka-prises, même ancre et même alignement), choisie à la place de l'ancienne, qui reste dans
// m.prises (non choisie : Annuler la rechoisit). Le crochet `traiterPrise` (lirePcmVoix) sert à l'écoute d'un
// réglage AVANT de l'appliquer : le lecteur se recharge (prevenirGels) et joue la prise traitée.

import type { PcmVoix } from '../autotune/autotune';
import { ErreurOcka } from '../moteur/erreur';
import type { Morceau, Prise } from '../morceau/types';
import type { PassageComp, Punch, ReglagesDoublage, ReglagesNettoyeur } from './api-voix-avancee';
import { ajouterDerivee, assemblerPcm, echantillonA, longueurAssemblage, prisesDeSection, type Source } from './assemblage';
import { ecrirePrise, lirePcmBrut, sourceDe, trouverPrise } from './prises-derivees';
import { cleTraitement, traitementPret, traiter, type Traitement } from './traitement-voix';

export { appliquerChaineVoix, chainesVoix } from './chaines-voix';

// Imports dynamiques : ce fichier est chargé par le crochet des prises (autotune → graphe) ; il ne doit pas tirer
// le graphe, l'enregistreur ni moteur/api à son chargement (boucles d'imports, mocks des tests du lecteur).
const prevenirGels = () => void import('../moteur/gels').then((g) => g.prevenirGels());

/** Demande le micro (geste requis) : punch.ts. */
export async function creerPunch(): Promise<Punch> {
  return (await import('./punch')).creerPunch();
}

type Reglages = { nettoyeur?: ReglagesNettoyeur; doublage?: ReglagesDoublage };
let ecoute: { idPrise: string; r: Reglages } | null = null;

function etapes(r: Reglages): Traitement[] {
  const l: Traitement[] = [];
  if (r.nettoyeur) l.push({ type: 'nettoyer', reglages: r.nettoyeur });
  if (r.doublage) l.push({ type: 'doubler', reglages: r.doublage });
  return l;
}

/** Applique les étapes l'une après l'autre (chaque étape mise en cache) ; renvoie le PCM et sa clé. */
async function enchainer(source: string, pcm: Float32Array, frequence: number, l: Traitement[]): Promise<{ pcm: Float32Array; cle: string }> {
  let cle = source;
  for (const t of l) {
    pcm = await traiter(cle, pcm, frequence, t);
    cle = cleTraitement(cle, t);
  }
  return { pcm, cle };
}

/** Toutes les étapes sont-elles déjà calculées ? */
function pret(source: string, l: Traitement[]): boolean {
  let cle = source;
  for (const t of l) {
    if (!traitementPret(cle, t)) return false;
    cle = cleTraitement(cle, t);
  }
  return true;
}

/** Crochet de lecture (crochets-prise.ts) : MÊME objet si rien ne change, sinon un nouveau PcmVoix (version changée). */
export async function traiterPrise(prise: Prise, _m: Morceau, pcm: PcmVoix, attendre: boolean): Promise<PcmVoix> {
  const e = ecoute;
  if (!e || e.idPrise !== prise.id) return pcm;
  const l = etapes(e.r);
  if (l.length === 0) return pcm;
  const source = pcm.version ?? prise.fichier;
  if (!attendre && !pret(source, l)) {
    // Écoute : on joue la prise telle quelle, le calcul part ; le lecteur se recharge quand il est prêt.
    void enchainer(source, pcm.pcm, pcm.frequence, l).then(
      () => ecoute === e && prevenirGels(),
      (err: unknown) => console.error(err),
    );
    return pcm;
  }
  const r = await enchainer(source, pcm.pcm, pcm.frequence, l);
  return { frequence: pcm.frequence, pcm: r.pcm, version: `ecoute:${r.cle}` };
}

export function ecouterReglage(idPrise: string, r: Reglages | null): void {
  ecoute = r && etapes(r).length > 0 ? { idPrise, r: { ...r } } : null;
  prevenirGels(); // le lecteur se recharge (ui/lecture.ts : surGels)
}

/** Traite le fichier brut d'une prise et l'ajoute en nouvelle prise choisie. */
async function deriver(m: Morceau, idPrise: string, t: Traitement, suffixe: string): Promise<Morceau> {
  const p = trouverPrise(m, idPrise);
  const brut = await lirePcmBrut(p);
  const { pcm } = await enchainer(p.fichier, brut, p.frequence, [t]);
  const fichier = await ecrirePrise(pcm, p.frequence, t.type);
  if (ecoute?.idPrise === idPrise) ecouterReglage(idPrise, null);
  return ajouterDerivee(m, p, fichier, suffixe);
}

export function nettoyerPrise(m: Morceau, idPrise: string, r: ReglagesNettoyeur): Promise<Morceau> {
  return deriver(m, idPrise, { type: 'nettoyer', reglages: r }, '(nettoyée)');
}

export function doublerPrise(m: Morceau, idPrise: string, r: ReglagesDoublage): Promise<Morceau> {
  return deriver(m, idPrise, { type: 'doubler', reglages: r }, '(doublée)');
}

/**
 * Comping : les passages (secondes du morceau) de plusieurs prises de cette apparition de section, assemblés avec des
 * fondus enchaînés de 10 ms dans une nouvelle prise alignée sur la prise qui commence le plus tôt (sinon la choisie).
 */
export async function assemblerComp(m: Morceau, section: string, occurrence: number, passages: readonly PassageComp[]): Promise<Morceau> {
  const prises = prisesDeSection(m, section, occurrence);
  const valides = passages.filter((x) => Number.isFinite(x.de) && Number.isFinite(x.a) && x.a > x.de);
  if (valides.length === 0) throw new ErreurOcka('Choisis au moins un passage.', 'trop_court');
  const ids = [...new Set(valides.map((x) => x.prise))];
  const utilisees = ids.map((id) => {
    const p = prises.find((x) => x.id === id);
    if (!p) throw new ErreurOcka('Une des prises choisies n’est pas dans cette section.', 'prise_introuvable');
    return p;
  });
  const sources: Source[] = [];
  for (const p of utilisees) sources.push(await sourceDe(m, p));
  // Base : celle dont l'ancre est la plus tôt (rien de ce qu'on garde n'est avant elle) ; à égalité, la choisie.
  let b = 0;
  sources.forEach((s, i) => {
    const mieux = s.debutAncre < sources[b]!.debutAncre - 1e-9 || (Math.abs(s.debutAncre - sources[b]!.debutAncre) < 1e-9 && utilisees[i]!.choisie);
    if (mieux) b = i;
  });
  const base = sources[b]!;
  const liste = valides.map((x) => ({ source: ids.indexOf(x.prise), de: x.de, a: x.a }));
  const n = longueurAssemblage({ ...base, longueur: base.pcm.length }, liste);
  const pcm = assemblerPcm(base, sources, liste, n);
  const fichier = await ecrirePrise(pcm, base.frequence, 'comp');
  const duree = n / base.frequence;
  const fin = Math.max(...liste.map((x) => echantillonA(base, x.a + 0.01) / base.frequence));
  return ajouterDerivee(m, utilisees[b]!, fichier, '(comp)', { duree, finCoupe: Math.min(duree, Math.max(utilisees[b]!.finCoupe, fin)) });
}
