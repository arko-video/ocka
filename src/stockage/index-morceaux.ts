// Calculs (purs) pour « Mes morceaux » : résumé d'un morceau, mise à jour de l'index, fichiers utilisés.
import type { ResumeMorceau } from '../moteur/api';
import { dureeMorceau } from '../morceau/temps';
import type { Morceau } from '../morceau/types';

/** Résumé affiché dans « Mes morceaux ». */
export function resumer(id: string, morceau: Morceau, maintenant: number): ResumeMorceau {
  let duree = 0;
  try {
    duree = dureeMorceau(morceau);
  } catch {
    // morceau incomplet : durée inconnue
  }
  return {
    id,
    titre: morceau.titre?.trim() || 'Sans titre',
    style: morceau.style,
    duree: Number.isFinite(duree) ? duree : 0,
    modifieLe: maintenant,
  };
}

/** Index lu dans la base : on ne garde que les lignes valides. */
export function indexValide(brut: unknown): ResumeMorceau[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter((r): r is ResumeMorceau => !!r && typeof r === 'object' && typeof (r as ResumeMorceau).id === 'string');
}

/** Remplace (ou ajoute) le résumé d'un morceau ; le plus récent en premier. */
export function majIndex(index: ResumeMorceau[], resume: ResumeMorceau): ResumeMorceau[] {
  return [resume, ...index.filter((r) => r.id !== resume.id)].sort((a, b) => b.modifieLe - a.modifieLe);
}

/** Retire un morceau de l'index. */
export function retirerDeIndex(index: ResumeMorceau[], id: string): ResumeMorceau[] {
  return index.filter((r) => r.id !== id);
}

/** Titre d'une copie : « Mon son » → « Mon son (copie) » → « Mon son (copie 2) »… */
export function titreCopie(titre: string, existants: string[]): string {
  const base = titre.replace(/\s*\(copie(?: \d+)?\)$/, '').trim() || 'Sans titre';
  const pris = new Set(existants);
  let essai = `${base} (copie)`;
  for (let n = 2; pris.has(essai); n++) essai = `${base} (copie ${n})`;
  return essai;
}

/** Tous les fichiers de prises utilisés par ces morceaux. */
export function fichiersUtilises(morceaux: Morceau[]): Set<string> {
  const utilises = new Set<string>();
  for (const m of morceaux) for (const p of m.prises ?? []) if (p?.fichier) utilises.add(p.fichier);
  return utilises;
}

/** Tous les fichiers de sons importés utilisés par ces morceaux. */
/** Fichiers « sf2-<id>.sf2 » listés par au moins un morceau (C3). */
export function soundfontsUtilisees(morceaux: Morceau[]): Set<string> {
  const utilises = new Set<string>();
  for (const m of morceaux) for (const s of m.soundfonts ?? []) if (s?.fichier) utilises.add(s.fichier);
  return utilises;
}

export function sonsUtilises(morceaux: Morceau[]): Set<string> {
  const utilises = new Set<string>();
  for (const m of morceaux) for (const s of m.sons ?? []) if (s?.fichier) utilises.add(s.fichier);
  return utilises;
}
