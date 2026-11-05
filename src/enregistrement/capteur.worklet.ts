// Worklet « capteur » : il tourne dans le fil audio, à côté du lecteur (même AudioContext, même horloge).
// - Il mesure toujours le niveau du micro (pour le vumètre).
// - Pendant l'enregistrement, il envoie le son par morceaux de Float32 (mono).
// - Il date le 1er échantillon avec `currentFrame` : n° d'échantillon de l'horloge du contexte,
//   donc heure = currentFrame / sampleRate, comme ctx.currentTime.
// Messages reçus : 'demarrer', 'arreter', 'fermer'.
// Messages envoyés : {type:'niveau', valeur}, {type:'debut', frame}, {type:'morceau', debut, pcm}, {type:'fin', total}.

// Ces noms existent dans le fil audio, mais TypeScript ne les connaît pas : on les déclare.
declare const currentFrame: number;
declare function registerProcessor(nom: string, classe: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

/** Taille d'un morceau envoyé : 4096 échantillons ≈ 85 ms à 48 kHz. */
const TAILLE_MORCEAU = 4096;
/** Le niveau est envoyé tous les 1024 échantillons ≈ 21 ms. */
const TAILLE_NIVEAU = 1024;

class Capteur extends AudioWorkletProcessor {
  private enregistre = false;
  private arretDemande = false;
  private ferme = false;
  private tampon = new Float32Array(TAILLE_MORCEAU);
  private rempli = 0;
  private debutTampon = 0;
  private total = 0;
  private crete = 0;
  private compteNiveau = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data === 'demarrer') {
        this.enregistre = true;
        this.arretDemande = false;
        this.rempli = 0;
        this.total = 0;
        this.port.postMessage({ type: 'debut', frame: currentFrame });
      } else if (e.data === 'arreter') {
        this.arretDemande = true;
      } else if (e.data === 'fermer') {
        this.ferme = true;
      }
    };
  }

  process(entrees: Float32Array[][]): boolean {
    if (this.ferme) return false;
    if (this.arretDemande) this.terminer();
    const canaux = entrees[0] ?? [];
    const n = canaux[0]?.length ?? 128;
    for (let i = 0; i < n; i++) {
      // Mono : moyenne des canaux (le micro est demandé en mono, mais on reste prudent).
      let x = 0;
      for (const c of canaux) x += c[i]!;
      if (canaux.length > 1) x /= canaux.length;
      const a = Math.abs(x);
      if (a > this.crete) this.crete = a;
      if (this.enregistre) {
        if (this.rempli === 0) this.debutTampon = currentFrame + i;
        this.tampon[this.rempli++] = x;
        if (this.rempli === TAILLE_MORCEAU) this.envoyer();
      }
    }
    this.compteNiveau += n;
    if (this.compteNiveau >= TAILLE_NIVEAU) {
      this.port.postMessage({ type: 'niveau', valeur: Math.min(1, this.crete) });
      this.compteNiveau = 0;
      this.crete = 0;
    }
    return true;
  }

  /** Envoie le morceau en cours (le tableau est transféré, pas copié) et en prépare un neuf. */
  private envoyer(): void {
    if (this.rempli === 0) return;
    const pcm = this.rempli === TAILLE_MORCEAU ? this.tampon : this.tampon.slice(0, this.rempli);
    this.port.postMessage({ type: 'morceau', debut: this.debutTampon, pcm }, [pcm.buffer]);
    this.total += this.rempli;
    this.tampon = new Float32Array(TAILLE_MORCEAU);
    this.rempli = 0;
  }

  /** Fin de l'enregistrement : on envoie le reste, puis le nombre total d'échantillons. */
  private terminer(): void {
    if (this.enregistre) this.envoyer();
    this.enregistre = false;
    this.arretDemande = false;
    this.port.postMessage({ type: 'fin', total: this.total });
  }
}

registerProcessor('ocka-capteur', Capteur);
export {};
