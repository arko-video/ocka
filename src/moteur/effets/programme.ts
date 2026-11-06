// Programmation des AudioParam d'une piste (automation, LFO, sidechain, modulations du chorus…), M2, vague C1.
// Une « source » donne des POINTS (temps du morceau → valeur du paramètre) reliés par des rampes linéaires.
// Les points ne dépendent QUE du temps du morceau (jamais des fenêtres de planification) : l'écoute, qui planifie
// par petites fenêtres et peut sauter n'importe où, programme exactement la même ligne que l'export.
// Après un saut (ou au 1er appel), la ligne reprend à la valeur qu'elle aurait à cet instant (`valeur`).

/** Un point : rampe linéaire jusqu'à `v` au temps `t` (s du morceau). `avant` : saut (rampe jusqu'à `avant`, puis `v`). */
export interface Point {
  t: number;
  v: number;
  avant?: number;
}

export interface SourceAuto {
  /** Points de ]de, a], triés. */
  points(de: number, a: number): Point[];
  /** Valeur de la ligne programmée au temps t (après un saut en t : la valeur d'après). */
  valeur(t: number): number;
}

/** Pas de la grille (s) des sources continues (courbes non linéaires, LFO, modulations). */
export const PAS_GRILLE = 0.01;
/**
 * Un point sur GARDE est toujours gardé (même sur une ligne droite) : 50 ms au plus entre deux points, bien moins que
 * l'avance du lecteur (200 ms). Sinon une rampe longue serait connue trop tard : le paramètre resterait sur place
 * jusqu'à la planification suivante, puis sauterait.
 */
const GARDE = 5;

interface Etat {
  origine: number;
  fin: number;
}
const etats = new WeakMap<AudioParam, Etat>();

/**
 * Programme `param` pour ]de, a] (temps du morceau ; `origine` = heure du contexte du temps 0). Les appels qui se
 * suivent (même origine, `de` = fin du précédent) prolongent la ligne ; sinon (saut, nouveau tour de boucle,
 * reprise) les événements à partir de `origine + de` sont annulés et la ligne repart de `valeur(de)`.
 */
export function programmerParam(param: AudioParam, source: SourceAuto, de: number, a: number, origine: number): void {
  const e = etats.get(param);
  if (!e || e.origine !== origine || Math.abs(e.fin - de) > 1e-9) {
    const t0 = Math.max(0, origine + de);
    param.cancelScheduledValues(t0);
    param.setValueAtTime(source.valeur(de), t0);
  }
  for (const p of source.points(de, a)) {
    const t = origine + p.t;
    if (t < 0) continue;
    if (p.avant !== undefined) {
      param.linearRampToValueAtTime(p.avant, t);
      param.setValueAtTime(p.v, t);
    } else param.linearRampToValueAtTime(p.v, t);
  }
  etats.set(param, { origine, fin: a });
}

/** Oublie la programmation d'un paramètre (la prochaine repart de zéro). */
export function oublierParam(param: AudioParam): void {
  etats.delete(param);
}

/**
 * Source échantillonnée sur la grille (PAS_GRILLE) : `f(t, gauche)` = valeur du paramètre (gauche = limite à
 * gauche, pour les sauts), `ruptures(de, a)` = temps des sauts dans ]de, a]. Les points de grille au milieu d'une
 * ligne droite sont omis (moins d'événements), sauf un sur GARDE.
 */
export function sourceGrille(f: (t: number, gauche: boolean) => number, ruptures: (de: number, a: number) => number[] = () => []): SourceAuto {
  const H = PAS_GRILLE;
  const cache = new Map<number, number>();
  const fj = (j: number) => {
    let v = cache.get(j);
    if (v === undefined) {
      if (cache.size > 8192) cache.clear();
      v = f(j * H, false);
      cache.set(j, v);
    }
    return v;
  };
  const garde = (j: number): boolean => {
    if (j % GARDE === 0) return true;
    if (ruptures((j - 1) * H, (j + 1) * H).length > 0) return true;
    const a = fj(j - 1);
    const b = fj(j);
    const c = fj(j + 1);
    return Math.abs(b - (a + c) / 2) > 1e-9 * Math.max(1, Math.abs(b));
  };
  const points = (de: number, a: number): Point[] => {
    const out: Point[] = [];
    const sauts = ruptures(de, a);
    for (const t of sauts) out.push({ t, v: f(t, false), avant: f(t, true) });
    for (let j = Math.floor(de / H) + 1; j * H <= a; j++) {
      const t = j * H;
      if (t <= de || sauts.some((s) => Math.abs(s - t) < 1e-9)) continue;
      if (garde(j)) out.push({ t, v: fj(j) });
    }
    return out.sort((x, y) => x.t - y.t);
  };
  return {
    points,
    valeur(t) {
      const autour = points(t - (GARDE + 1) * H, t + (GARDE + 1) * H);
      let g: Point | undefined;
      let d: Point | undefined;
      for (const p of autour) {
        if (p.t <= t) g = p;
        else if (!d) d = p;
      }
      if (g && Math.abs(g.t - t) < 1e-12) return g.v;
      if (!g || !d) return f(t, false);
      const vd = d.avant ?? d.v;
      return g.v + ((vd - g.v) * (t - g.t)) / (d.t - g.t);
    },
  };
}

/** Source faite d'une liste de points FIXE (triés, temps du morceau), constante avant le 1er et après le dernier. */
export function sourcePoints(liste: Point[], avantTout: number): SourceAuto {
  const premier = (t: number) => {
    let bas = 0;
    let haut = liste.length;
    while (bas < haut) {
      const m = (bas + haut) >> 1;
      if (liste[m]!.t <= t) bas = m + 1;
      else haut = m;
    }
    return bas; // 1er indice de temps > t
  };
  return {
    points(de, a) {
      const out: Point[] = [];
      for (let i = premier(de); i < liste.length && liste[i]!.t <= a; i++) out.push(liste[i]!);
      return out;
    },
    valeur(t) {
      const i = premier(t);
      const g = liste[i - 1];
      const d = liste[i];
      if (!g) return avantTout;
      if (!d || g.t === t) return g.v;
      return g.v + (((d.avant ?? d.v) - g.v) * (t - g.t)) / (d.t - g.t);
    },
  };
}
