// Rééchantillonnage de qualité (sinc fenêtré) : pour une prise enregistrée à 48 kHz jouée à 44,1 kHz (ou l'inverse).
// Chaque échantillon de sortie est une moyenne pondérée de 2 × DEMI_LARGEUR échantillons d'entrée autour de sa position.
// Quand on descend en fréquence, le filtre coupe sous la nouvelle limite (pas de repliement).

const DEMI_LARGEUR = 16;
/** Finesse de la table du noyau (points par échantillon d'entrée). */
const FINESSE = 512;

/** Fenêtre de Blackman : adoucit les bords du noyau sinc. */
function blackman(x: number): number {
  return 0.42 + 0.5 * Math.cos(Math.PI * x) + 0.08 * Math.cos(2 * Math.PI * x);
}

/** Rééchantillonne un signal mono de `de` Hz vers `vers` Hz. */
export function reechantillonner(entree: Float32Array, de: number, vers: number): Float32Array {
  if (de === vers) return entree.slice();
  const rapport = vers / de;
  const coupure = Math.min(1, rapport) * 0.97; // fréquence de coupure (relative à la limite d'entrée)
  const largeur = Math.ceil(DEMI_LARGEUR / Math.min(1, rapport)); // en échantillons d'entrée
  // Table du noyau : h(x) pour x de 0 à largeur (symétrique), tous les 1/FINESSE échantillons.
  const table = new Float32Array(largeur * FINESSE + 2);
  for (let k = 0; k < table.length; k++) {
    const x = k / FINESSE;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * coupure * x) / (Math.PI * coupure * x);
    table[k] = x >= largeur ? 0 : coupure * sinc * blackman(x / largeur);
  }
  const n = Math.round(entree.length * rapport);
  const sortie = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const centre = i / rapport; // position dans l'entrée
    const debut = Math.max(0, Math.ceil(centre - largeur));
    const fin = Math.min(entree.length - 1, Math.floor(centre + largeur));
    let s = 0;
    for (let k = debut; k <= fin; k++) {
      const pos = Math.abs(k - centre) * FINESSE;
      const j = Math.floor(pos);
      const f = pos - j;
      s += entree[k]! * (table[j]! + f * (table[j + 1]! - table[j]!));
    }
    sortie[i] = s;
  }
  return sortie;
}
