// Le petit écrivain WAV 32 bits FLOTTANTS des pistes séparées (pur, testé dans Node).
// En-tête : RIFF / « fmt » de 18 octets (format 3 = IEEE flottant, cbSize = 0) / « fact » / « data » = 58 octets,
// la forme prévue par la norme pour un format non PCM (ffmpeg y lit « pcm_f32le »).
// Les échantillons sont écrits tels quels (petit-boutiste, entrelacés G, D), sans arrondi ni écrêtage.

/** Code de format WAV des flottants IEEE. */
export const CODE_FLOTTANT = 0x0003;
export const TAILLE_EN_TETE_FLOTTANT = 58;

/** Taille (octets) d'un WAV flottant de `trames` trames. */
export function tailleWavFlottant(trames: number, canaux: number): number {
  return TAILLE_EN_TETE_FLOTTANT + trames * canaux * 4;
}

/** En-tête d'un WAV 32 bits flottants (la taille des données est connue d'avance). */
export function enTeteWavFlottant(trames: number, canaux: number, frequence: number): Uint8Array<ArrayBuffer> {
  const donnees = trames * canaux * 4;
  const b = new ArrayBuffer(TAILLE_EN_TETE_FLOTTANT);
  const v = new DataView(b);
  const texte = (pos: number, s: string) => {
    for (let i = 0; i < 4; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texte(0, 'RIFF');
  v.setUint32(4, TAILLE_EN_TETE_FLOTTANT - 8 + donnees, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  v.setUint32(16, 18, true);
  v.setUint16(20, CODE_FLOTTANT, true);
  v.setUint16(22, canaux, true);
  v.setUint32(24, frequence, true);
  v.setUint32(28, frequence * canaux * 4, true);
  v.setUint16(32, canaux * 4, true);
  v.setUint16(34, 32, true);
  v.setUint16(36, 0, true); // cbSize
  texte(38, 'fact');
  v.setUint32(42, 4, true);
  v.setUint32(46, trames, true);
  texte(50, 'data');
  v.setUint32(54, donnees, true);
  return new Uint8Array(b);
}

/** Là où partent les octets d'une piste (fichier de travail). */
export interface Puits {
  ecrire(o: Uint8Array): Promise<void>;
}

/**
 * Reçoit les blocs du worklet de capture (pour chaque piste à la suite : `bloc` trames entrelacées G, D),
 * coupe après `trames`, mesure la crête de chaque piste et écrit chaque piste dans son puits.
 * Le silence du début d'une piste n'est écrit qu'au premier son : une piste muette n'écrit RIEN (pas de disque perdu).
 */
export class RepartiteurPistes {
  readonly cretes: number[];
  ecrites = 0;
  /** Trames de silence du début, pas encore écrites, par piste. */
  private retenues: number[];

  constructor(
    private pistes: number,
    private bloc: number,
    private trames: number,
    private puits: Puits[],
  ) {
    this.cretes = new Array<number>(pistes).fill(0);
    this.retenues = new Array<number>(pistes).fill(0);
  }

  async ajouter(debut: number, donnees: Float32Array): Promise<void> {
    if (debut !== this.ecrites) throw new Error(`Bloc de capture inattendu (${debut} au lieu de ${this.ecrites}).`);
    const n = Math.max(0, Math.min(this.bloc, this.trames - debut));
    this.ecrites = debut + this.bloc;
    if (n === 0) return;
    for (let p = 0; p < this.pistes; p++) {
      const vue = donnees.subarray(p * this.bloc * 2, p * this.bloc * 2 + n * 2);
      let c = this.cretes[p]!;
      for (let i = 0; i < vue.length; i++) {
        const a = Math.abs(vue[i]!);
        if (a > c) c = a;
      }
      this.cretes[p] = c;
      if (c === 0) {
        this.retenues[p]! += n; // toujours rien entendu sur cette piste
        continue;
      }
      await this.ecrireSilence(p);
      await this.puits[p]!.ecrire(new Uint8Array(vue.buffer, vue.byteOffset, vue.byteLength));
    }
  }

  /** Écrit le silence retenu au début de la piste `p`. */
  private async ecrireSilence(p: number): Promise<void> {
    let reste = this.retenues[p]!;
    this.retenues[p] = 0;
    const zeros = new Uint8Array(Math.min(reste, this.bloc) * 8);
    while (reste > 0) {
      const k = Math.min(reste, this.bloc);
      await this.puits[p]!.ecrire(zeros.subarray(0, k * 8));
      reste -= k;
    }
  }
}
