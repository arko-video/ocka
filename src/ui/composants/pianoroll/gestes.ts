// Gestes de la grille du piano roll, en Pointer Events (doigt, stylet, souris) : UN doigt agit (toucher une case vide
// = poser ; toucher une note = la choisir, puis l'effacer ; glisser une note = la déplacer, aimantée ; tirer la
// poignée = allonger), DEUX doigts zooment (écart horizontal = mesures, vertical = lignes) et défilent (centre).
// La grille a `touch-action: none` : aucun conflit avec le défilement de la page. Molette : défiler ; Ctrl + molette :
// zoomer (Maj : zoom vertical). Rien n'est écrit dans le morceau avant le lâcher (aperçu seulement).

import type { Note } from '../../../morceau/types';
import { aimanter, borne, MIDI_BAS, MIDI_HAUT, ZOOM } from './vue';

export interface Geometrie {
  /** Largeur d'un pas et hauteur d'une ligne (px). */
  w: number;
  h: number;
  debut: number;
  haut: number;
  mesures: number;
  nLignes: number;
  lignes: readonly number[];
  longueur: number;
  largeur: number;
  hauteur: number;
  q: number;
}

export type Apercu =
  | { type: 'deplacer'; indices: number[]; dPas: number; dMidi: number }
  | { type: 'allonger'; i: number; duree: number }
  | null;

export interface Actions {
  geo(): Geometrie;
  notes(): readonly Note[];
  /** Indices des notes choisies. */
  choisies(): number[];
  ligneDe(midi: number): number;
  poser(pas: number, midi: number): void;
  toucherNote(i: number): void;
  deplacer(indices: number[], dPas: number, dMidi: number): void;
  allonger(i: number, duree: number): void;
  apercu(a: Apercu): void;
  vue(v: { debut?: number; haut?: number; mesures?: number; nLignes?: number }): void;
}

type Geste =
  | { type: 'aucun' }
  | { type: 'vide'; x0: number; y0: number }
  | { type: 'note'; i: number; x0: number; y0: number; bouge: boolean }
  | { type: 'poignee'; i: number; x0: number }
  | {
      type: 'deux';
      sx0: number;
      sy0: number;
      pasA: number;
      ligneA: number;
      mesures0: number;
      lignes0: number;
    };

/** Distance (px) avant qu'un toucher devienne un glissé. */
const SEUIL = 7;

export function creerGestes(a: Actions) {
  const doigts = new Map<number, { x: number; y: number }>();
  let geste: Geste = { type: 'aucun' };
  let el: HTMLElement | null = null;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = (el ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Le glissé d'une note, aimanté : décalage en pas (grille de quantification) et en demi-tons (lignes). */
  function decalage(i: number, dx: number, dy: number): { indices: number[]; dPas: number; dMidi: number } {
    const g = a.geo();
    const notes = a.notes();
    const n = notes[i]!;
    const sel = a.choisies();
    const indices = sel.includes(i) && sel.length > 1 ? sel : [i];
    const groupe = indices.map((k) => notes[k]!);
    const nouveau = aimanter(n.pas + dx / g.w, g.q);
    const premier = Math.min(...groupe.map((x) => x.pas));
    const dernier = Math.max(...groupe.map((x) => x.pas));
    const dPas = borne(nouveau - n.pas, -premier, g.longueur - 1 / 24 - dernier);
    const ligne = borne(Math.round(a.ligneDe(n.midi) + dy / g.h), 0, g.lignes.length - 1);
    const bas = Math.min(...groupe.map((x) => x.midi));
    const haut = Math.max(...groupe.map((x) => x.midi));
    const dMidi = borne(g.lignes[ligne]! - n.midi, MIDI_BAS - bas, MIDI_HAUT - haut);
    return { indices, dPas: Math.round(dPas * 24) / 24, dMidi };
  }

  function deuxDoigts() {
    const [p, q] = [...doigts.values()];
    const g = a.geo();
    const cx = (p!.x + q!.x) / 2;
    const cy = (p!.y + q!.y) / 2;
    a.apercu(null);
    geste = {
      type: 'deux',
      sx0: Math.abs(p!.x - q!.x),
      sy0: Math.abs(p!.y - q!.y),
      pasA: g.debut + cx / g.w,
      ligneA: g.haut + cy / g.h,
      mesures0: g.mesures,
      lignes0: g.nLignes,
    };
  }

  function bougerDeux(g0: Extract<Geste, { type: 'deux' }>) {
    const [p, q] = [...doigts.values()];
    const g = a.geo();
    const sx = Math.abs(p!.x - q!.x);
    const sy = Math.abs(p!.y - q!.y);
    // Écart trop petit sur un axe : pas de zoom sur cet axe (deux doigts côte à côte = défiler).
    const mesures =
      g0.sx0 > 40 && sx > 20
        ? borne((g0.mesures0 * g0.sx0) / sx, ZOOM.mesuresMin, ZOOM.mesuresMax)
        : g0.mesures0;
    const nLignes =
      g0.sy0 > 40 && sy > 20 ? borne((g0.lignes0 * g0.sy0) / sy, ZOOM.lignesMin, ZOOM.lignesMax) : g0.lignes0;
    const w = g.largeur / (mesures * 16);
    const h = g.hauteur / nLignes;
    const cx = (p!.x + q!.x) / 2;
    const cy = (p!.y + q!.y) / 2;
    a.vue({ mesures, nLignes, debut: g0.pasA - cx / w, haut: g0.ligneA - cy / h });
  }

  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      el = e.currentTarget as HTMLElement;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà relâché (évènement de synthèse) : sans capture */
      }
      const p = local(e);
      doigts.set(e.pointerId, p);
      if (doigts.size === 2) return deuxDoigts();
      if (doigts.size > 2) return;
      const cible = (e.target as HTMLElement).closest<HTMLElement>('[data-poignee], [data-i]');
      const i = Number(cible?.dataset.i ?? cible?.dataset.poignee ?? NaN);
      if (cible?.dataset.poignee !== undefined && Number.isInteger(i))
        geste = { type: 'poignee', i, x0: p.x };
      else if (Number.isInteger(i)) geste = { type: 'note', i, x0: p.x, y0: p.y, bouge: false };
      else geste = { type: 'vide', x0: p.x, y0: p.y };
      e.preventDefault();
    },
    onPointerMove(e: PointerEvent) {
      if (!doigts.has(e.pointerId)) return;
      const p = local(e);
      doigts.set(e.pointerId, p);
      const g = geste;
      if (g.type === 'deux' && doigts.size === 2) return bougerDeux(g);
      if (g.type === 'note') {
        if (!g.bouge && Math.hypot(p.x - g.x0, p.y - g.y0) < SEUIL) return;
        g.bouge = true;
        a.apercu({ type: 'deplacer', ...decalage(g.i, p.x - g.x0, p.y - g.y0) });
      } else if (g.type === 'poignee') {
        const n = a.notes()[g.i];
        if (!n) return;
        const geo = a.geo();
        const fin = aimanter(n.pas + n.duree + (p.x - g.x0) / geo.w, geo.q);
        a.apercu({
          type: 'allonger',
          i: g.i,
          duree: borne(fin - n.pas, Math.min(geo.q, 1 / 24), geo.longueur - n.pas),
        });
      }
    },
    onPointerUp(e: PointerEvent) {
      if (!doigts.has(e.pointerId)) return;
      const p = local(e);
      doigts.delete(e.pointerId);
      const g = geste;
      if (g.type === 'deux') {
        if (doigts.size === 0) geste = { type: 'aucun' };
        return;
      }
      geste = { type: 'aucun' };
      a.apercu(null);
      const geo = a.geo();
      if (g.type === 'vide' && Math.hypot(p.x - g.x0, p.y - g.y0) < SEUIL * 2) {
        const ligne = Math.floor(geo.haut + p.y / geo.h);
        const midi = geo.lignes[ligne];
        const pas = aimanter(geo.debut + p.x / geo.w, geo.q, true);
        if (midi !== undefined && pas >= 0 && pas < geo.longueur) a.poser(pas, midi);
      } else if (g.type === 'note') {
        if (!g.bouge) a.toucherNote(g.i);
        else {
          const d = decalage(g.i, p.x - g.x0, p.y - g.y0);
          if (d.dPas !== 0 || d.dMidi !== 0) a.deplacer(d.indices, d.dPas, d.dMidi);
        }
      } else if (g.type === 'poignee') {
        const n = a.notes()[g.i];
        if (!n) return;
        const fin = aimanter(n.pas + n.duree + (p.x - g.x0) / geo.w, geo.q);
        const duree = borne(fin - n.pas, Math.min(geo.q, 1 / 24), geo.longueur - n.pas);
        if (duree !== n.duree) a.allonger(g.i, duree);
      }
    },
    onPointerCancel(e: PointerEvent) {
      doigts.delete(e.pointerId);
      if (doigts.size === 0) {
        geste = { type: 'aucun' };
        a.apercu(null);
      }
    },
    /** Molette (souris, pavé tactile) : défiler ; Ctrl : zoom horizontal, Ctrl + Maj : zoom vertical. */
    onWheel(e: WheelEvent) {
      e.preventDefault();
      el = e.currentTarget as HTMLElement;
      const g = a.geo();
      const p = local(e);
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(e.deltaY * 0.004);
        if (e.shiftKey) {
          const nLignes = borne(g.nLignes * f, ZOOM.lignesMin, ZOOM.lignesMax);
          a.vue({ nLignes, haut: g.haut + p.y / g.h - p.y / (g.hauteur / nLignes) });
        } else {
          const mesures = borne(g.mesures * f, ZOOM.mesuresMin, ZOOM.mesuresMax);
          a.vue({ mesures, debut: g.debut + p.x / g.w - p.x / (g.largeur / (mesures * 16)) });
        }
        return;
      }
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      a.vue({ debut: g.debut + dx / g.w, haut: g.haut + dy / g.h });
    },
  };
}
