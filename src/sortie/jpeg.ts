// Taille d'un JPEG lue dans son en-tête (marqueur SOF), sans décoder l'image (pur). Propriétaire : A1.
// Sert à connaître le côté d'une pochette déjà rangée (vérification de la sortie, import d'un .ocka-sortie).

export interface TailleImage {
  largeur: number;
  hauteur: number;
}

/** Largeur et hauteur d'un JPEG, ou null si ce n'en est pas un (ou s'il est abîmé). */
export function tailleJpeg(o: Uint8Array): TailleImage | null {
  if (o.length < 4 || o[0] !== 0xff || o[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < o.length) {
    if (o[i] !== 0xff) return null;
    const m = o[i + 1]!;
    // Octets de remplissage, marqueurs sans longueur (RSTn, TEM).
    if (m === 0xff) {
      i += 1;
      continue;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      i += 2;
      continue;
    }
    // Début des données (SOS) ou fin d'image (EOI) avant tout SOF : pas de taille.
    if (m === 0xda || m === 0xd9) return null;
    const longueur = (o[i + 2]! << 8) | o[i + 3]!;
    if (longueur < 2) return null;
    const estSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (estSof) {
      if (i + 8 >= o.length) return null;
      const hauteur = (o[i + 5]! << 8) | o[i + 6]!;
      const largeur = (o[i + 7]! << 8) | o[i + 8]!;
      return largeur > 0 && hauteur > 0 ? { largeur, hauteur } : null;
    }
    i += 2 + longueur;
  }
  return null;
}

/** Taille d'un JPEG rangé dans un Blob (on ne lit que le début : 256 Ko suffisent, même avec des données EXIF). */
export async function tailleJpegBlob(b: Blob): Promise<TailleImage | null> {
  const debut = new Uint8Array(await b.slice(0, 256 * 1024).arrayBuffer());
  return tailleJpeg(debut);
}
