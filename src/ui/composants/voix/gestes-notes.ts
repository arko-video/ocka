// Gestes de l'éditeur de notes (Pointer Events, comme le piano roll) : UN doigt — toucher une note la choisit,
// la glisser en hauteur la déplace d'un demi-ton à la fois (aimantée à la gamme sauf « Libre »), tirer la poignée de
// justesse (haut/bas, ±100 cents) ou de vibrato (gauche/droite, 0 à 200 %), glisser le fond défile ; DEUX doigts
// pincent pour zoomer (écart horizontal = temps, vertical = lignes) et défilent. Rien n'est écrit avant le lâcher.

import type { NoteAutotune } from '../../../morceau/types';
import { borne, NB_LIGNES, ZOOM_NOTES, type GeoNotes } from './vue-notes';

export type ApercuNotes =
  | { type: 'deplacer'; i: number; midi: number }
  | { type: 'justesse'; i: number; cents: number }
  | { type: 'vibrato'; i: number; vibrato: number }
  | null;

export interface ActionsNotes {
  geo(): GeoNotes;
  notes(): readonly NoteAutotune[];
  /** Hauteur visée après un glissé de `d` demi-tons (aimantée ou libre). */
  cible(midi: number, d: number): number;
  choisir(i: number | null): void;
  deplacer(i: number, midi: number): void;
  justesse(i: number, cents: number): void;
  vibrato(i: number, v: number): void;
  apercu(a: ApercuNotes): void;
  vue(v: { t0?: number; haut?: number; secondes?: number; nLignes?: number }): void;
}

type Geste =
  | { type: 'aucun' }
  | { type: 'fond'; x0: number; y0: number; t0: number; haut0: number; bouge: boolean }
  | { type: 'note'; i: number; y0: number; x0: number; bouge: boolean }
  | { type: 'justesse'; i: number; y0: number; c0: number }
  | { type: 'vibrato'; i: number; x0: number; v0: number }
  | { type: 'deux'; sx0: number; sy0: number; tA: number; ligneA: number; secondes0: number; lignes0: number };

const SEUIL = 7;
/** Pixels de glissé pour 100 % de vibrato. */
const PX_VIBRATO = 90;

export function creerGestesNotes(a: ActionsNotes) {
  const doigts = new Map<number, { x: number; y: number }>();
  let geste: Geste = { type: 'aucun' };
  let el: HTMLElement | null = null;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = (el ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const centsDe = (g: Extract<Geste, { type: 'justesse' }>, y: number) =>
    Math.round(borne(g.c0 - ((y - g.y0) / a.geo().h) * 100, -100, 100));
  const vibratoDe = (g: Extract<Geste, { type: 'vibrato' }>, x: number) =>
    Math.round(borne(g.v0 + (x - g.x0) / PX_VIBRATO, 0, 2) * 20) / 20;
  const midiDe = (g: Extract<Geste, { type: 'note' }>, y: number) => {
    const n = a.notes()[g.i];
    return n ? a.cible(n.midi, Math.round(-(y - g.y0) / a.geo().h)) : 0;
  };

  function vueBornee(v: { t0?: number; haut?: number; secondes?: number; nLignes?: number }) {
    const g = a.geo();
    const secondes = v.secondes ?? g.secondes;
    const nLignes = v.nLignes ?? g.nLignes;
    a.vue({
      ...v,
      t0: v.t0 === undefined ? undefined : borne(v.t0, g.tMin - 0.2, Math.max(g.tMin - 0.2, g.tMax + 0.2 - secondes)),
      haut: v.haut === undefined ? undefined : borne(v.haut, 0, NB_LIGNES - nLignes),
    });
  }

  function bougerDeux(g0: Extract<Geste, { type: 'deux' }>) {
    const [p, q] = [...doigts.values()];
    const g = a.geo();
    const sx = Math.abs(p!.x - q!.x);
    const sy = Math.abs(p!.y - q!.y);
    const secondes = g0.sx0 > 40 && sx > 20 ? borne((g0.secondes0 * g0.sx0) / sx, ZOOM_NOTES.secondesMin, ZOOM_NOTES.secondesMax) : g0.secondes0;
    const nLignes = g0.sy0 > 40 && sy > 20 ? borne((g0.lignes0 * g0.sy0) / sy, ZOOM_NOTES.lignesMin, ZOOM_NOTES.lignesMax) : g0.lignes0;
    const cx = (p!.x + q!.x) / 2;
    const cy = (p!.y + q!.y) / 2;
    vueBornee({ secondes, nLignes, t0: g0.tA - (cx * secondes) / g.largeur, haut: g0.ligneA - (cy * nLignes) / g.hauteur });
  }

  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      el = e.currentTarget as HTMLElement;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà relâché : sans capture */
      }
      const p = local(e);
      doigts.set(e.pointerId, p);
      if (doigts.size === 2) {
        const [u, v] = [...doigts.values()];
        const g = a.geo();
        a.apercu(null);
        geste = {
          type: 'deux',
          sx0: Math.abs(u!.x - v!.x),
          sy0: Math.abs(u!.y - v!.y),
          tA: g.t0 + (u!.x + v!.x) / 2 / g.pxS,
          ligneA: g.haut + (u!.y + v!.y) / 2 / g.h,
          secondes0: g.secondes,
          lignes0: g.nLignes,
        };
        return;
      }
      if (doigts.size > 2) return;
      const cible = (e.target as HTMLElement).closest<HTMLElement>('[data-poignee], [data-i]');
      const i = Number(cible?.dataset.i ?? NaN);
      const n = Number.isInteger(i) ? a.notes()[i] : undefined;
      if (n && cible?.dataset.poignee === 'justesse') geste = { type: 'justesse', i, y0: p.y, c0: n.cents };
      else if (n && cible?.dataset.poignee === 'vibrato') geste = { type: 'vibrato', i, x0: p.x, v0: n.vibrato };
      else if (n) geste = { type: 'note', i, x0: p.x, y0: p.y, bouge: false };
      else geste = { type: 'fond', x0: p.x, y0: p.y, t0: a.geo().t0, haut0: a.geo().haut, bouge: false };
      e.preventDefault();
    },
    onPointerMove(e: PointerEvent) {
      if (!doigts.has(e.pointerId)) return;
      const p = local(e);
      doigts.set(e.pointerId, p);
      const g = geste;
      if (g.type === 'deux' && doigts.size === 2) return bougerDeux(g);
      if (g.type === 'note') {
        if (!g.bouge && Math.abs(p.y - g.y0) < SEUIL) return;
        g.bouge = true;
        a.apercu({ type: 'deplacer', i: g.i, midi: midiDe(g, p.y) });
      } else if (g.type === 'justesse') a.apercu({ type: 'justesse', i: g.i, cents: centsDe(g, p.y) });
      else if (g.type === 'vibrato') a.apercu({ type: 'vibrato', i: g.i, vibrato: vibratoDe(g, p.x) });
      else if (g.type === 'fond') {
        if (!g.bouge && Math.hypot(p.x - g.x0, p.y - g.y0) < SEUIL) return;
        g.bouge = true;
        const geo = a.geo();
        vueBornee({ t0: g.t0 - (p.x - g.x0) / geo.pxS, haut: g.haut0 - (p.y - g.y0) / geo.h });
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
      if (g.type === 'note') {
        if (!g.bouge) return a.choisir(g.i);
        const n = a.notes()[g.i];
        const midi = midiDe(g, p.y);
        if (n && midi !== n.midi) a.deplacer(g.i, midi);
      } else if (g.type === 'justesse') a.justesse(g.i, centsDe(g, p.y));
      else if (g.type === 'vibrato') a.vibrato(g.i, vibratoDe(g, p.x));
      else if (g.type === 'fond' && !g.bouge) a.choisir(null);
    },
    onPointerCancel(e: PointerEvent) {
      doigts.delete(e.pointerId);
      if (doigts.size === 0) {
        geste = { type: 'aucun' };
        a.apercu(null);
      }
    },
    /** Molette : défiler ; Ctrl : zoom du temps ; Ctrl + Maj : zoom des lignes. */
    onWheel(e: WheelEvent) {
      e.preventDefault();
      el = e.currentTarget as HTMLElement;
      const g = a.geo();
      const p = local(e);
      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(e.deltaY * 0.004);
        if (e.shiftKey) {
          const nLignes = borne(g.nLignes * f, ZOOM_NOTES.lignesMin, ZOOM_NOTES.lignesMax);
          return vueBornee({ nLignes, haut: g.haut + p.y / g.h - (p.y * nLignes) / g.hauteur });
        }
        const secondes = borne(g.secondes * f, ZOOM_NOTES.secondesMin, ZOOM_NOTES.secondesMax);
        return vueBornee({ secondes, t0: g.t0 + p.x / g.pxS - (p.x * secondes) / g.largeur });
      }
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      vueBornee({ t0: g.t0 + dx / g.pxS, haut: g.haut + dy / g.h });
    },
  };
}
