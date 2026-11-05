// Limiteur « en flux » à anticipation, utilisé à deux endroits :
//  - dans l'AudioWorklet du master (écoute ET export : la même chaîne) ;
//  - dans la passe finale de l'export, nourri par la crête VRAIE (sur-échantillonnée).
// Principe (une trame = un échantillon de chaque canal) :
//  1. gain nécessaire pour la trame : seuil / crête (1 si la crête est sous le seuil) ;
//  2. relâchement : le gain ne remonte que doucement ;
//  3. « maintien du minimum » sur L trames, puis moyenne glissante sur L trames :
//     le gain descend en douceur PENDANT les L trames qui précèdent le pic, et l'atteint pile au pic.
// Le son doit donc être retardé de `retard` trames (L − 1) avant d'être multiplié par le gain.
// Ce fichier est aussi importé par le worklet : il ne doit rien importer de la page (pas de DOM).

/** Nom du processeur du worklet limiteur (le master). */
export const NOM_LIMITEUR = 'ocka-limiteur';
/** Anticipation du limiteur du master (5 ms). */
export const ATTAQUE_MASTER_S = 0.005;

export class LimiteurFlux {
  /** Nombre de trames dont le son doit être retardé. */
  readonly retard: number;
  private seuil: number;
  private L: number;
  private relache: number;
  private gainRelache: number;
  // File du « minimum glissant » (valeurs et numéros de trame), en anneau.
  private fileVal: Float64Array;
  private fileNum: Float64Array;
  private tete: number;
  private taille: number;
  // Moyenne glissante.
  private moyenne: Float64Array;
  private posMoyenne: number;
  private somme: number;
  private numero: number;

  constructor(frequence: number, seuil: number, attaqueS = 0.005, relacheS = 0.12) {
    this.L = Math.max(1, Math.round(attaqueS * frequence));
    this.retard = this.L - 1;
    this.seuil = seuil;
    this.relache = 1 - Math.exp(-1 / (relacheS * frequence));
    this.gainRelache = 1;
    this.fileVal = new Float64Array(this.L + 1);
    this.fileNum = new Float64Array(this.L + 1);
    this.tete = 0;
    this.taille = 0;
    this.moyenne = new Float64Array(this.L).fill(1);
    this.posMoyenne = 0;
    this.somme = this.L;
    this.numero = 0;
  }

  /** Change le seuil (valeur linéaire). */
  reglerSeuil(seuil: number): void {
    this.seuil = seuil;
  }

  /**
   * Donne la crête de la trame qui ENTRE ; renvoie le gain à appliquer à la trame entrée `retard` trames plus tôt.
   */
  pousser(crete: number): number {
    // 1 + 2. Gain nécessaire, avec relâchement lent.
    const besoin = crete > this.seuil ? this.seuil / crete : 1;
    this.gainRelache = besoin < this.gainRelache ? besoin : this.gainRelache + (besoin - this.gainRelache) * this.relache;
    // 3a. Minimum glissant sur L trames (file monotone : chaque valeur entre et sort une seule fois).
    const cap = this.L + 1;
    while (this.taille > 0) {
      const dernier = (this.tete + this.taille - 1) % cap;
      if (this.fileVal[dernier]! >= this.gainRelache) this.taille--;
      else break;
    }
    const pos = (this.tete + this.taille) % cap;
    this.fileVal[pos] = this.gainRelache;
    this.fileNum[pos] = this.numero;
    this.taille++;
    if (this.fileNum[this.tete]! <= this.numero - this.L) {
      this.tete = (this.tete + 1) % cap;
      this.taille--;
    }
    const minimum = this.fileVal[this.tete]!;
    // 3b. Moyenne glissante sur L trames.
    this.somme += minimum - this.moyenne[this.posMoyenne]!;
    this.moyenne[this.posMoyenne] = minimum;
    this.posMoyenne = (this.posMoyenne + 1) % this.L;
    this.numero++;
    // Recalcul exact de temps en temps (les petites erreurs d'arrondi ne s'accumulent pas).
    if (this.posMoyenne === 0) {
      let s = 0;
      for (let i = 0; i < this.L; i++) s += this.moyenne[i]!;
      this.somme = s;
    }
    return Math.min(1, this.somme / this.L);
  }
}
