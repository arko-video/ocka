// Les sources d'un graphe : chaque son joué = AudioBufferSourceNode → GainNode → piste(s).
// Les tampons sont DÉJÀ prêts (banque) : ici on ne fait que brancher, programmer les gains et arrêter.
// - note sans durée : rampe de relâchement à la fin de la note puis stop() ;
// - relais (rechargement pendant la lecture) : les sons tenus s'effacent en 10 ms, le nouveau graphe les reprend ;
// - arrêt : fondu de 2 ms (pas de clic).

/** Durée du fondu croisé quand un nouveau graphe reprend les sons tenus de l'ancien (s). */
export const RELAIS = 0.01;

/** Garde la valeur programmée d'un paramètre à `t` et oublie la suite (sans saut de valeur). */
export function tenir(p: AudioParam, t: number): void {
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
}

/** « court » = frappes, pads, notes entendues seules (finissent seules) ; « long » = repris par le graphe suivant. */
export type Genre = 'court' | 'long';

export interface Active {
  src: AudioBufferSourceNode;
  g: GainNode;
  genre: Genre;
  /** Heure de départ (contexte). */
  debut: number;
  /** Heure (contexte) où le son tenu commence à finir (fin de la note, de la prise, de la boucle). */
  fin: number;
  vel: number;
}

export interface OptionsJeu {
  /** Secondes sautées au début du tampon (reprise en cours de son). */
  decalage?: number;
  /** Durée jouée (s) : start(quand, decalage, longueur). */
  longueur?: number;
  genre?: Genre;
  /** Boucle [début, fin] (s) du tampon (sons tenus). */
  boucle?: [number, number];
  /** Note sans durée : heure de fin de la note. Le gain descend ensuite en ligne droite pendant `relache` s. */
  finNote?: number;
  relache?: number;
  /** Heure d'arrêt forcé (boucles de sons importés), précédée d'un fondu de `fonduSortie` s. */
  arret?: number;
  fonduSortie?: number;
  /** Fondu d'entrée (s) : reprise en cours de son, relance d'une boucle. */
  fonduEntree?: number;
  /** Tampon mono joué en stéréo sans perte (gauche = droite = mono), comme les anciens accords stéréo. */
  stereo?: boolean;
  /** Heure de fin du son tenu (relais), si ni finNote ni arret. */
  fin?: number;
  /**
   * Débrancher le gain à la fin du son MÊME hors ligne (chaîne 1 : envois de caisse claire et de clap vers la réverbe,
   * comme en phase 1). Tant qu'un gain reste branché, la réverbe (stéréo) reste active, et Chrome passe alors toute
   * la piste batterie (mono) en stéréo : +3 dB. En phase 1, la batterie revenait à −3 dB dès la fin de la queue.
   */
  debrancher?: boolean;
  /** Échantillonneur : hauteur de lecture (cents, k-rate) et glissé (rampe linéaire de `debut` à `fin`, heures). */
  detune?: number;
  rampeDetune?: { debut: number; fin: number; vers: number };
  /** Pitch bend de la piste (cents) : ajouté au `detune` de la source (ConstantSourceNode branché dessus). */
  hauteur?: AudioNode;
}

export class Sources {
  readonly actives = new Set<Active>();
  /** Appelé quand plus aucun son ne joue (le graphe relayé se détruit alors). */
  surVide: (() => void) | null = null;

  constructor(
    private ctx: BaseAudioContext,
    /** Compteur des sons démarrés en retard ; null = rendu hors ligne (export). */
    private enRetard: (() => void) | null,
  ) {}

  jouer(buffer: AudioBuffer, quand: number, vel: number, vers: AudioNode[], o: OptionsJeu = {}): Active {
    const ctx = this.ctx;
    // Une reprise calculée (−début + t) + (début − t) vaut parfois −5e-16 s : Web Audio refuse les heures négatives.
    quand = Math.max(0, quand);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    if (o.stereo) {
      g.channelCount = 2;
      g.channelCountMode = 'explicit';
    }
    if (o.detune) src.detune.value = o.detune;
    if (o.rampeDetune) {
      src.detune.setValueAtTime(o.detune ?? 0, Math.max(0, o.rampeDetune.debut));
      src.detune.linearRampToValueAtTime(o.rampeDetune.vers, o.rampeDetune.fin);
    }
    if (o.hauteur) o.hauteur.connect(src.detune);
    let decalage = o.decalage ?? 0;
    if (o.boucle) {
      src.loop = true;
      src.loopStart = o.boucle[0];
      src.loopEnd = o.boucle[1];
      if (decalage >= o.boucle[1]) decalage = o.boucle[0] + ((decalage - o.boucle[0]) % (o.boucle[1] - o.boucle[0]));
    }
    const entree = o.fonduEntree ?? 0;
    if (entree > 0) {
      g.gain.setValueAtTime(0, quand);
      g.gain.linearRampToValueAtTime(vel, quand + entree);
    } else g.gain.value = vel;
    src.connect(g);
    for (const v of vers) g.connect(v);
    if (o.longueur === undefined) src.start(quand, decalage);
    else src.start(quand, decalage, o.longueur);
    let fin = o.fin ?? quand + (o.longueur ?? buffer.duration - decalage);
    if (o.finNote !== undefined) {
      const debutRelache = Math.max(o.finNote, quand + entree);
      const relache = Math.max(0.005, o.relache ?? 0.05);
      g.gain.setValueAtTime(vel, debutRelache);
      g.gain.linearRampToValueAtTime(0, debutRelache + relache);
      src.stop(debutRelache + relache + 0.002);
      fin = o.finNote;
    }
    if (o.arret !== undefined) {
      const sortie = Math.min(o.fonduSortie ?? 0.003, Math.max(0, o.arret - quand - entree));
      g.gain.setValueAtTime(vel, Math.max(0, o.arret - sortie));
      g.gain.linearRampToValueAtTime(0, o.arret);
      src.stop(o.arret);
      fin = o.arret;
    }
    if (this.enRetard && quand < ctx.currentTime - 0.001) this.enRetard();
    const a: Active = { src, g, genre: o.genre ?? 'court', debut: quand, fin, vel };
    this.actives.add(a);
    src.onended = () => {
      this.actives.delete(a);
      // Hors ligne, onended arrive à un moment quelconque du rendu : débrancher ici rendrait deux exports
      // différents. On ne débranche qu'en direct ; hors ligne, tout part avec le contexte à la fin du rendu.
      if (this.enRetard || o.debrancher) g.disconnect();
      if (o.hauteur && this.enRetard) o.hauteur.disconnect(src.detune);
      if (this.actives.size === 0) this.surVide?.();
    };
    return a;
  }

  /** Coupe un son à `quand` (fondu de 3 ms juste avant) : nouvelle frappe sur le même pad. */
  couper(a: Active, quand: number): void {
    try {
      a.g.gain.setValueAtTime(a.vel, Math.max(a.debut, quand - 0.003));
      a.g.gain.linearRampToValueAtTime(0, quand);
      a.src.stop(quand + 0.001);
    } catch {
      /* déjà fini */
    }
  }

  /**
   * Relais : à `quand`, les sons tenus qui continuent après (genre « long ») s'effacent en RELAIS secondes ;
   * le nouveau graphe les reprend au même endroit avec un fondu d'entrée (même signal : aucune coupure).
   */
  relayer(quand: number): void {
    for (const a of this.actives) {
      if (a.genre !== 'long' || a.fin <= quand + 0.01) continue;
      const p = a.g.gain;
      try {
        tenir(p, quand);
        p.linearRampToValueAtTime(0, quand + RELAIS);
        a.src.stop(quand + RELAIS + 0.002);
      } catch {
        /* déjà fini */
      }
    }
  }

  /**
   * Coupe tous les sons (fondu de 2 ms : pas de clic). Leur « onended » est retiré : après un rendu hors ligne, une
   * source qui n'a pas fini (elle dépassait la fin) ne le recevra jamais, et Chrome garderait alors la source, son
   * contexte et tous ses tampons (≈ 110 Mo par export de 3 min, scénario QA « mémoire »).
   */
  arreter(): void {
    const maintenant = this.ctx.currentTime;
    for (const a of this.actives) {
      a.src.onended = null;
      try {
        a.g.gain.cancelScheduledValues(maintenant);
        a.g.gain.setTargetAtTime(0, maintenant, 0.002);
        a.src.stop(maintenant + 0.015);
      } catch {
        try {
          a.src.stop();
        } catch {
          /* déjà arrêtée */
        }
      }
    }
    this.actives.clear();
  }
}
