// L'atelier : file des travaux de synthèse envoyés au Worker de synthèse (un seul pour toute l'appli).
// Priorités : plus petit = plus urgent (une note touchée sur un pad passe devant tout le morceau).
// Sans Worker (tests Vitest, vieux navigateur) ou si le Worker plante : même calcul sur le fil principal,
// un travail par tâche (setTimeout 0) pour laisser respirer l'interface.

import { executer, type Resultat, type Travail } from './travaux';

interface Tache {
  id: number;
  travail: Travail;
  frequence: number;
  priorite: number;
  ok(r: Resultat): void;
  ko(e: unknown): void;
}

/** Une demande en cours : sa promesse, et de quoi la rendre plus urgente. */
export interface Commande {
  promesse: Promise<Resultat>;
  prioriser(priorite: number): void;
}

/** Travaux confiés au Worker en même temps (2 : il enchaîne sans attendre l'aller-retour). */
const EN_VOL_MAX = 2;

let worker: Worker | null | undefined; // undefined = pas encore essayé ; null = pas de Worker
const file: Tache[] = [];
const enVol = new Map<number, Tache>();
let suivant = 1;
let localOccupe = false;

/** Statistiques (tests et mesures). */
export const compteurs = { travaux: 0, local: 0 };

function ouvrir(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    const w = new Worker(new URL('./synthese.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; canaux?: Float32Array[]; boucle?: [number, number]; erreur?: string }>) => {
      const t = enVol.get(e.data.id);
      enVol.delete(e.data.id);
      if (t) {
        if (e.data.canaux) t.ok({ canaux: e.data.canaux, boucle: e.data.boucle });
        else t.ko(new Error(e.data.erreur ?? 'synthèse impossible'));
      }
      pomper();
    };
    w.onerror = (e) => {
      // Worker cassé (module introuvable, CSP…) : tout repasse sur le fil principal, rien n'est perdu.
      e.preventDefault?.();
      w.terminate();
      worker = null;
      const perdues = [...enVol.values()];
      enVol.clear();
      for (const t of perdues) ranger(t);
      pomper();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Range une tâche dans la file triée par priorité (à priorité égale : dans l'ordre d'arrivée). */
function ranger(t: Tache) {
  let bas = 0;
  let haut = file.length;
  while (bas < haut) {
    const m = (bas + haut) >> 1;
    if (file[m]!.priorite <= t.priorite) bas = m + 1;
    else haut = m;
  }
  file.splice(bas, 0, t);
}

function pomper() {
  const w = ouvrir();
  if (w) {
    while (enVol.size < EN_VOL_MAX && file.length > 0) {
      const t = file.shift()!;
      enVol.set(t.id, t);
      w.postMessage({ id: t.id, travail: t.travail, frequence: t.frequence });
    }
    return;
  }
  if (localOccupe || file.length === 0) return;
  localOccupe = true;
  setTimeout(() => {
    const t = file.shift();
    if (t) {
      compteurs.local++;
      try {
        t.ok(executer(t.travail, t.frequence));
      } catch (e) {
        t.ko(e);
      }
    }
    localOccupe = false;
    pomper();
  }, 0);
}

/** Demande un travail de synthèse à la fréquence `frequence`. */
export function commander(travail: Travail, frequence: number, priorite: number): Commande {
  let tache!: Tache;
  const promesse = new Promise<Resultat>((ok, ko) => {
    tache = { id: suivant++, travail, frequence, priorite, ok, ko };
  });
  compteurs.travaux++;
  ranger(tache);
  pomper();
  return {
    promesse,
    prioriser(p) {
      if (p >= tache.priorite) return;
      const i = file.indexOf(tache);
      tache.priorite = p;
      if (i < 0) return; // déjà en cours de calcul
      file.splice(i, 1);
      ranger(tache);
    },
  };
}

/** Nombre de travaux pas encore finis (file + en cours). */
export function travauxEnAttente(): number {
  return file.length + enVol.size + (localOccupe ? 1 : 0);
}
