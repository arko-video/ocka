// Lecture EN FLUX d'une référence (PCM stéréo entrelacé f32 dans OPFS ocka-references) : un TAMPON CIRCULAIRE de
// 10 s (jamais plus de 30 s en mémoire) est rempli par tranches lues dans le fichier (File.slice), et vidé par blocs
// de 0,25 s planifiés dans le contexte commun, 1 s en avance. Le fichier n'est jamais chargé en entier.

/** Capacité du tampon circulaire (s) : bien sous la limite de 30 s en mémoire. */
export const SECONDES_TAMPON = 10;
const BLOC = 0.25;
const AVANCE = 1;

/** Tampon circulaire de trames stéréo entrelacées (pur : testé). */
export class TamponCirculaire {
  readonly donnees: Float32Array;
  private lecture = 0;
  private ecriture = 0;
  private remplies = 0;

  constructor(readonly capacite: number) {
    this.donnees = new Float32Array(capacite * 2);
  }
  get disponibles(): number {
    return this.remplies;
  }
  get libres(): number {
    return this.capacite - this.remplies;
  }
  /** Ajoute des trames entrelacées (au plus `libres`) ; renvoie le nombre de trames gardées. */
  ecrire(x: Float32Array): number {
    const n = Math.min(this.libres, Math.floor(x.length / 2));
    for (let i = 0; i < n; i++) {
      const j = ((this.ecriture + i) % this.capacite) * 2;
      this.donnees[j] = x[2 * i]!;
      this.donnees[j + 1] = x[2 * i + 1]!;
    }
    this.ecriture = (this.ecriture + n) % this.capacite;
    this.remplies += n;
    return n;
  }
  /** Retire `n` trames (au plus `disponibles`) vers deux canaux. Renvoie le nombre lu. */
  lire(g: Float32Array, d: Float32Array, n: number): number {
    const k = Math.min(n, this.remplies);
    for (let i = 0; i < k; i++) {
      const j = ((this.lecture + i) % this.capacite) * 2;
      g[i] = this.donnees[j]!;
      d[i] = this.donnees[j + 1]!;
    }
    this.lecture = (this.lecture + k) % this.capacite;
    this.remplies -= k;
    return k;
  }
  vider(): void {
    this.lecture = this.ecriture = this.remplies = 0;
  }
}

/** Joue une référence en flux, au gain donné (dB), à partir d'une position (s). */
export class LecteurFlux {
  private tampon: TamponCirculaire;
  private sortie: GainNode;
  private sources: AudioBufferSourceNode[] = [];
  /** Prochaine trame à lire dans le fichier. */
  private suivante = 0;
  private remplissage: Promise<void> | null = null;
  private minuterie: ReturnType<typeof setInterval> | null = null;
  private planifieJusqua = 0;
  private departCtx = 0;
  private departPos = 0;
  /** Plus grand nombre de trames jamais gardées dans le tampon (mesure de mémoire). */
  maxTrames = 0;
  position: number;

  constructor(private ctx: AudioContext, private fichier: Blob, private frequence: number, private trames: number, gainDb: number, depuis: number) {
    this.tampon = new TamponCirculaire(Math.round(SECONDES_TAMPON * frequence));
    this.sortie = ctx.createGain();
    this.sortie.gain.value = 10 ** (gainDb / 20);
    this.sortie.connect(ctx.destination);
    this.position = Math.max(0, Math.min(depuis, trames / frequence));
  }

  get enLecture(): boolean {
    return this.minuterie !== null;
  }

  /** Remplit le tampon depuis le fichier (tranches de 2 s), sans jamais dépasser sa capacité. */
  private remplir(): Promise<void> {
    this.remplissage ??= (async () => {
      while (this.tampon.libres >= 2 * this.frequence && this.suivante < this.trames) {
        const n = Math.min(2 * this.frequence, this.trames - this.suivante);
        const de = this.suivante;
        const octets = await this.fichier.slice(de * 8, (de + n) * 8).arrayBuffer();
        if (this.suivante !== de) return; // repositionné pendant la lecture du fichier
        this.tampon.ecrire(new Float32Array(octets));
        this.suivante += n;
        this.maxTrames = Math.max(this.maxTrames, this.tampon.disponibles);
      }
    })().finally(() => (this.remplissage = null));
    return this.remplissage;
  }

  private planifier(): void {
    const n = Math.round(BLOC * this.frequence);
    while (this.planifieJusqua < this.ctx.currentTime + AVANCE && this.tampon.disponibles > 0) {
      const k = Math.min(n, this.tampon.disponibles);
      const b = this.ctx.createBuffer(2, k, this.frequence);
      this.tampon.lire(b.getChannelData(0), b.getChannelData(1), k);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.sortie);
      s.start(this.planifieJusqua);
      s.onended = () => (this.sources = this.sources.filter((x) => x !== s));
      this.sources.push(s);
      this.planifieJusqua += k / this.frequence;
    }
    void this.remplir();
    if (this.tampon.disponibles === 0 && this.suivante >= this.trames && this.ctx.currentTime > this.planifieJusqua) this.pause();
  }

  async lire(): Promise<void> {
    if (this.minuterie) return;
    this.tampon.vider();
    this.suivante = Math.round(this.position * this.frequence);
    await this.remplir();
    await this.ctx.resume();
    this.departCtx = this.planifieJusqua = this.ctx.currentTime + 0.05;
    this.departPos = this.position;
    this.minuterie = setInterval(() => this.planifier(), 100);
    this.planifier();
  }

  /** Pause : la position garde l'endroit entendu ; le tampon est vidé (rempli de nouveau à la reprise). */
  pause(): void {
    if (!this.minuterie) return;
    clearInterval(this.minuterie);
    this.minuterie = null;
    this.position = Math.min(this.trames / this.frequence, this.departPos + Math.max(0, this.ctx.currentTime - this.departCtx));
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // pas encore partie
      }
      s.disconnect();
    }
    this.sources = [];
    this.tampon.vider();
  }

  detruire(): void {
    this.pause();
    this.sortie.disconnect();
  }
}
