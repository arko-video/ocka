// Stabilité de la note jouée (décisions v2 §5) : porte de bruit (s'ouvre à −42 dBFS, se ferme sous −50 dBFS tenus
// 60 ms) et hystérésis (on ne change de note qu'après un écart de plus de 65 cents tenu 40 ms).
// Fichier pur, importé par le worklet (pas de fonction nommée en majuscule : voir vite.config.ts, Prefresh).

export const PORTE_OUVRE_DB = -42;
export const PORTE_FERME_DB = -50;
export const PORTE_MAINTIEN_S = 0.06;
export const ECART_CHANGE = 65;
export const TENUE_CHANGE_S = 0.04;
/** Deux trames voisées à moins de 60 cents l'une de l'autre pour lancer une note après un silence. */
const ACCORD_DEPART = 60;
/** Porte ouverte mais plus de hauteur pendant 80 ms (bruit de la pièce, consonne longue) : la note s'arrête. */
export const SOURD_FIN_S = 0.08;

/** Porte de bruit à deux seuils, avec maintien. Le niveau est l'efficace (RMS) en dBFS. */
export class PorteBruit {
  ouverte = false;
  /** Heure (s) d'ouverture, et depuis quand le niveau est sous le seuil de fermeture (ou null). */
  ouverteA = 0;
  /** Heure (s) où le niveau est passé sous le seuil, pour la dernière fermeture. */
  fermeeA = 0;
  private sousDepuis: number | null = null;

  /** Met à jour la porte avec le niveau `db` à l'heure `t` (s). Renvoie true si elle vient de changer. */
  pousser(db: number, t: number): boolean {
    if (!this.ouverte) {
      if (db > PORTE_OUVRE_DB) {
        this.ouverte = true;
        this.ouverteA = t;
        this.sousDepuis = null;
        return true;
      }
      return false;
    }
    if (db >= PORTE_FERME_DB) {
      this.sousDepuis = null;
      return false;
    }
    if (this.sousDepuis === null) this.sousDepuis = t;
    if (t - this.sousDepuis >= PORTE_MAINTIEN_S) {
      this.ouverte = false;
      this.fermeeA = this.sousDepuis;
      this.sousDepuis = null;
      return true;
    }
    return false;
  }
}

/** Changement de note : la nouvelle note (MIDI ou null = silence) et l'heure estimée où elle a commencé (s). */
export interface ChangementNote {
  note: number | null;
  debut: number;
}

/**
 * Hystérésis sur les trames de hauteur. `caler(cents) → MIDI` applique le calage (gamme ou chromatique).
 * Chaque trame : son heure (centre de l'analyse, s), sa hauteur en cents MIDI (NaN = non voisée), et l'état de la porte.
 */
export class Stabilisateur {
  note: number | null = null;
  private ecartDepuis: number | null = null;
  private sourdDepuis: number | null = null;
  private precedente: { t: number; cents: number } | null = null;

  constructor(public caler: (cents: number) => number) {}

  /** Oublie tout (porte fermée, réglages changés). */
  remettre(): void {
    this.note = null;
    this.ecartDepuis = null;
    this.sourdDepuis = null;
    this.precedente = null;
  }

  /** Recale la note en cours (gamme changée) sans attendre. */
  recaler(cents: number): number | null {
    if (this.note === null || Number.isNaN(cents)) return null;
    const n = this.caler(cents);
    if (n === this.note) return null;
    this.note = n;
    return n;
  }

  pousser(t: number, cents: number, ouverte: boolean): ChangementNote | null {
    if (!ouverte) {
      this.precedente = null;
      this.ecartDepuis = null;
      this.sourdDepuis = null;
      if (this.note === null) return null;
      this.note = null;
      return { note: null, debut: t };
    }
    if (Number.isNaN(cents)) {
      this.ecartDepuis = null;
      this.precedente = null;
      if (this.note === null) return null;
      if (this.sourdDepuis === null) this.sourdDepuis = t;
      if (t - this.sourdDepuis < SOURD_FIN_S - 1e-9) return null;
      this.note = null;
      const debut = this.sourdDepuis;
      this.sourdDepuis = null;
      return { note: null, debut };
    }
    this.sourdDepuis = null;
    if (this.note === null) {
      const p = this.precedente;
      this.precedente = { t, cents };
      if (!p || Math.abs(p.cents - cents) > ACCORD_DEPART) return null;
      this.note = this.caler((p.cents + cents) / 2);
      this.precedente = null;
      return { note: this.note, debut: p.t };
    }
    if (Math.abs(cents - this.note * 100) <= ECART_CHANGE) {
      this.ecartDepuis = null;
      return null;
    }
    if (this.ecartDepuis === null) this.ecartDepuis = t;
    if (t - this.ecartDepuis < TENUE_CHANGE_S - 1e-9) return null;
    const debut = this.ecartDepuis;
    this.ecartDepuis = null;
    const n = this.caler(cents);
    if (n === this.note) return null;
    this.note = n;
    return { note: n, debut };
  }
}
