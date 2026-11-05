// Fichiers WAV. Export d'un titre : PCM entier (code de format 0x0001, jamais 0xFFFE : exigence des distributeurs),
// en-tête de 44 octets (« RIFF », « WAVE », « fmt » de 16 octets, « data »), échantillons convertis bloc par bloc.
// Projets et pistes séparées : WAV 32 bits flottants (enTeteWavFlottant). Lecture d'un en-tête : lireWav.

export const CODE_PCM = 0x0001;

/** En-tête WAV (44 octets) pour `trames` trames de `canaux` canaux. */
export function enTeteWav(trames: number, canaux: number, frequence: number, bits: 16 | 24): Uint8Array<ArrayBuffer> {
  const octets = bits / 8;
  const tailleDonnees = trames * canaux * octets;
  const b = new ArrayBuffer(44);
  const v = new DataView(b);
  const texte = (pos: number, s: string) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
  texte(0, 'RIFF');
  v.setUint32(4, 36 + tailleDonnees, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  v.setUint32(16, 16, true); // taille du bloc fmt
  v.setUint16(20, CODE_PCM, true); // 1 = PCM entier
  v.setUint16(22, canaux, true);
  v.setUint32(24, frequence, true);
  v.setUint32(28, frequence * canaux * octets, true); // octets par seconde
  v.setUint16(32, canaux * octets, true); // octets par trame
  v.setUint16(34, bits, true);
  texte(36, 'data');
  v.setUint32(40, tailleDonnees, true);
  return new Uint8Array(b);
}

/** Générateur de bruit pour le dither TPDF (graine fixe : l'export est reproductible). */
export function creerDither(graine = 0x0c4a): () => number {
  let a = graine >>> 0;
  const h = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // TPDF : différence de deux bruits uniformes → bruit triangulaire entre −1 et +1 LSB.
  return () => h() - h();
}

/**
 * Quantifie `n` trames en entiers (canaux entrelacés). 24 bits : arrondi simple (bruit à −144 dB) ;
 * 16 bits : dither TPDF avant l'arrondi. Le WAV 16 bits et le FLAC passent par ICI : mêmes échantillons.
 */
export function quantifier(canaux: Float32Array[], n: number, bits: 16 | 24, dither?: () => number): Int32Array {
  const nc = canaux.length;
  const sortie = new Int32Array(n * nc);
  const max = bits === 24 ? 8388607 : 32767;
  const min = -max - 1;
  let pos = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      let x = canaux[c]![i]! * (max + 1);
      if (bits === 16 && dither) x += dither();
      let e = Math.round(x);
      if (e > max) e = max;
      else if (e < min) e = min;
      sortie[pos++] = e;
    }
  }
  return sortie;
}

/** Convertit `n` trames (canaux entrelacés) en entiers PCM petit-boutistes (voir quantifier). */
export function versPcm(canaux: Float32Array[], n: number, bits: 16 | 24, dither?: () => number): Uint8Array<ArrayBuffer> {
  const e = quantifier(canaux, n, bits, dither);
  const octets = bits / 8;
  const sortie = new Uint8Array(e.length * octets);
  let pos = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i]!;
    sortie[pos++] = v & 0xff;
    sortie[pos++] = (v >> 8) & 0xff;
    if (bits === 24) sortie[pos++] = (v >> 16) & 0xff;
  }
  return sortie;
}

/** Code de format des WAV en flottants (IEEE 754). */
export const CODE_FLOTTANT = 0x0003;
/** Taille de l'en-tête de enTeteWavFlottant. */
export const TAILLE_ENTETE_FLOTTANT = 58;

/**
 * En-tête d'un WAV 32 bits FLOTTANTS (prises et sons d'un projet, pistes séparées) : bloc « fmt » de 18 octets
 * (code 3), bloc « fact » (nombre de trames, exigé pour les formats non PCM), puis « data ». 58 octets.
 */
export function enTeteWavFlottant(trames: number, canaux: number, frequence: number): Uint8Array<ArrayBuffer> {
  const tailleDonnees = trames * canaux * 4;
  const b = new ArrayBuffer(TAILLE_ENTETE_FLOTTANT);
  const v = new DataView(b);
  const texte = (pos: number, s: string) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
  texte(0, 'RIFF');
  v.setUint32(4, TAILLE_ENTETE_FLOTTANT - 8 + tailleDonnees, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  v.setUint32(16, 18, true);
  v.setUint16(20, CODE_FLOTTANT, true);
  v.setUint16(22, canaux, true);
  v.setUint32(24, frequence, true);
  v.setUint32(28, frequence * canaux * 4, true);
  v.setUint16(32, canaux * 4, true);
  v.setUint16(34, 32, true);
  v.setUint16(36, 0, true); // pas d'extension
  texte(38, 'fact');
  v.setUint32(42, 4, true);
  v.setUint32(46, trames, true);
  texte(50, 'data');
  v.setUint32(54, tailleDonnees, true);
  return new Uint8Array(b);
}

export interface InfosWav {
  /** 1 = PCM entier, 3 = flottant, 0xFFFE = extensible (code réel dans le sous-format). */
  format: number;
  canaux: number;
  frequence: number;
  bits: number;
  /** Début et taille du bloc « data ». */
  donnees: number;
  taille: number;
  trames: number;
}

/**
 * Lit l'en-tête d'un WAV en parcourant ses blocs (« fmt », « data », et les autres qu'on saute), sans lire les
 * échantillons. `debut` : les premiers octets du fichier (64 Kio suffisent). null si ce n'est pas un WAV lisible.
 * `tailleFichier` borne le bloc « data » (un en-tête qui ment ne fait pas lire au-delà du fichier).
 */
export function lireWav(debut: Uint8Array, tailleFichier: number): InfosWav | null {
  if (debut.length < 12) return null;
  const v = new DataView(debut.buffer, debut.byteOffset, debut.byteLength);
  const quatre = (p: number) => String.fromCharCode(debut[p]!, debut[p + 1]!, debut[p + 2]!, debut[p + 3]!);
  if (quatre(0) !== 'RIFF' || quatre(8) !== 'WAVE') return null;
  let p = 12;
  let fmt: Omit<InfosWav, 'donnees' | 'taille' | 'trames'> | null = null;
  while (p + 8 <= debut.length) {
    const id = quatre(p);
    const taille = v.getUint32(p + 4, true);
    if (id === 'fmt ' && taille >= 16 && p + 8 + 16 <= debut.length) {
      let format = v.getUint16(p + 8, true);
      if (format === 0xfffe && taille >= 40 && p + 8 + 26 <= debut.length) format = v.getUint16(p + 8 + 24, true);
      fmt = { format, canaux: v.getUint16(p + 10, true), frequence: v.getUint32(p + 12, true), bits: v.getUint16(p + 22, true) };
    } else if (id === 'data') {
      if (!fmt || fmt.canaux < 1 || fmt.bits < 8 || fmt.frequence < 1) return null;
      const donnees = p + 8;
      const reelle = Math.max(0, Math.min(taille, tailleFichier - donnees));
      const parTrame = fmt.canaux * Math.ceil(fmt.bits / 8);
      return { ...fmt, donnees, taille: reelle, trames: Math.floor(reelle / parTrame) };
    }
    p += 8 + taille + (taille % 2);
  }
  return null;
}

/** Lit l'en-tête d'un WAV (pour les tests et les vérifications). */
export function lireEnTeteWav(octets: Uint8Array): { format: number; canaux: number; frequence: number; bits: number; trames: number } {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const canaux = v.getUint16(22, true);
  const bits = v.getUint16(34, true);
  return {
    format: v.getUint16(20, true),
    canaux,
    frequence: v.getUint32(24, true),
    bits,
    trames: v.getUint32(40, true) / (canaux * (bits / 8)),
  };
}

/** Nom de fichier propre à partir du titre (« titre.wav », ou une autre extension). */
export function nomFichier(titre: string, extension = 'wav'): string {
  const propre = titre.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
  return `${propre || 'morceau'}.${extension}`;
}
