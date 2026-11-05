// Mémoire de la latence, PAR APPAREIL AUDIO (micro + sortie : haut-parleur, casque filaire…), dans localStorage.
// latenceMemorisee() = mesure du calibrage + réglage manuel (±100 ms), ou null si jamais mesurée.

const CLE = 'ocka.latence/1';
export const AJUSTEMENT_MAX = 0.1;

interface Entree {
  /** Latence aller-retour mesurée (s), ou null si seulement un réglage manuel. */
  mesure: number | null;
  ajustement: number;
  date: number;
}
interface Memoire {
  actuel: string;
  appareils: Record<string, Entree>;
}

/** Où ranger les données (localStorage dans le navigateur ; remplaçable dans les tests). */
export interface Rangement {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}
let rangement: Rangement | null = null;
export function utiliserRangement(r: Rangement | null): void {
  rangement = r;
}
function lieu(): Rangement | null {
  if (rangement) return rangement;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function lire(): Memoire {
  try {
    const texte = lieu()?.getItem(CLE);
    const m = texte ? (JSON.parse(texte) as Memoire) : null;
    if (m && typeof m.actuel === 'string' && m.appareils && typeof m.appareils === 'object') return m;
  } catch {
    // mémoire illisible ou bloquée : on repart de zéro
  }
  return { actuel: 'inconnu', appareils: {} };
}
function ecrire(m: Memoire): void {
  try {
    lieu()?.setItem(CLE, JSON.stringify(m));
  } catch {
    // navigation privée ou stockage plein : tant pis, la valeur reste valable pour cette séance
  }
}

/** Nom de l'appareil audio en cours, fait à partir des noms du micro et de la sortie. */
export function signatureAppareil(micro: string, sortie: string): string {
  const net = (s: string) => s.trim().toLowerCase() || '?';
  return `${net(micro)} → ${net(sortie)}`;
}

/** Change d'appareil en cours ; renvoie true si une mesure existe déjà pour lui. */
export function choisirAppareil(signature: string): boolean {
  const m = lire();
  m.actuel = signature;
  ecrire(m);
  return (m.appareils[signature]?.mesure ?? null) !== null;
}

export function appareilActuel(): string {
  return lire().actuel;
}

/** Garde la mesure du calibrage pour l'appareil en cours (le réglage manuel est conservé). */
export function memoriserMesure(mesure: number): void {
  const m = lire();
  const avant = m.appareils[m.actuel];
  m.appareils[m.actuel] = { mesure, ajustement: avant?.ajustement ?? 0, date: Date.now() };
  ecrire(m);
}

/** Latence mémorisée pour cet appareil (mesurée + réglage manuel), ou null si jamais mesurée. */
export function latenceMemorisee(): number | null {
  const m = lire();
  const e = m.appareils[m.actuel];
  if (!e || e.mesure === null) return null;
  return Math.max(0, e.mesure + e.ajustement);
}

/** Réglage manuel actuel (s), de −0,1 à +0,1. */
export function ajustementLatence(): number {
  const m = lire();
  return m.appareils[m.actuel]?.ajustement ?? 0;
}

/** Réglage manuel, en secondes, ajouté à la mesure (−0,1 à +0,1). */
export function reglerLatence(ajustement: number): void {
  const a = Number.isFinite(ajustement) ? Math.max(-AJUSTEMENT_MAX, Math.min(AJUSTEMENT_MAX, ajustement)) : 0;
  const m = lire();
  const avant = m.appareils[m.actuel];
  m.appareils[m.actuel] = { mesure: avant?.mesure ?? null, ajustement: a, date: avant?.date ?? Date.now() };
  ecrire(m);
}
