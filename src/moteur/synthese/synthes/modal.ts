// Synthèse MODALE commune (L) : une note = une somme de partiels amortis (ajouterMode), plus un petit bruit de
// frappe (marteau, mailloche). Sert au Rhodes, au Wurlitzer, au piano jouet, au célesta, au steel drum et au log
// drum. Les partiels au-delà de 0,45 × FREQ sont omis : aucun repliement. Pur, déterministe.
import { bruit, FREQ } from '../briques';
import { ajouterMode, fonduEntree, nb, passeBas1, passeHaut1 } from './communs';

export interface Partiel {
  /** Rapport à la fondamentale (inharmonique permis). */
  ratio: number;
  amp: number;
  /** Décroissance (s : divisé par e) à 262 Hz ; plus court dans l'aigu. */
  tau: number;
  /** Montée (s) : le partiel « fleurit » (steel drum) au lieu de partir tout de suite. */
  montee?: number;
}

export interface OptionsModal {
  /** Multiplie toutes les décroissances (réglage « longueur »). */
  echelle?: number;
  /** Bruit de frappe : niveau, couleur (Hz) et durée (s). */
  frappe?: number;
  couleurFrappe?: number;
  dureeFrappe?: number;
  graine?: number;
  /** Raccourcit l'aigu : tau × (262 / f)^pente (0,5 par défaut). */
  pente?: number;
}

/** Rend `duree` s d'une note modale de fondamentale `f` (Hz). */
export function rendreModal(
  f: number,
  partiels: readonly Partiel[],
  duree: number,
  o: OptionsModal = {},
): Float32Array {
  const c = new Float32Array(nb(duree));
  const aigu = Math.min(1.6, Math.pow(262 / f, o.pente ?? 0.5));
  const echelle = (o.echelle ?? 1) * aigu;
  for (const p of partiels) {
    const tau = Math.max(0.004, p.tau * echelle);
    ajouterMode(c, f * p.ratio, p.amp, tau);
    if (p.montee) ajouterMode(c, f * p.ratio, -p.amp, Math.min(p.montee, tau * 0.5));
  }
  if (o.frappe) {
    const d = o.dureeFrappe ?? 0.012;
    const b = bruit(d * 2, o.graine ?? 0x51a7);
    passeBas1(b, o.couleurFrappe ?? 3000);
    const m = b.length;
    for (let i = 0; i < m; i++) c[i] += b[i]! * o.frappe * Math.exp(-i / (d * FREQ * 0.4));
  }
  fonduEntree([c], 0.0015);
  return c;
}

/** Non-linéarité du micro (Rhodes : asymétrique, ajoute des harmoniques paires ; « grogne » 0 à 1). */
export function micro(c: Float32Array, grogne: number, crete: number): void {
  if (grogne <= 0) return;
  const k = (grogne * 0.6) / Math.max(1e-6, crete);
  for (let i = 0; i < c.length; i++) c[i] += k * c[i]! * c[i]!;
  // Retire le continu créé par x² (sinon un « pop » à la fin de la note).
  passeHaut1(c, 15);
}
