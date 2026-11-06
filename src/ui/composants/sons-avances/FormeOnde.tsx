// Forme d'onde d'un son (canvas) avec ses coupes (traits qu'on déplace au doigt) ou un passage choisi (on glisse).
// Découpe : glisser près d'un trait (24 px) le déplace ; toucher ailleurs écoute la découpe touchée.
// Sélection : glisser choisit un passage ; toucher sans glisser revient à « tout le son ».

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PcmSon } from './ecoute';

interface Props {
  pcm: PcmSon;
  libelle: string;
  /** Coupes intérieures (s), triées (mode découpe). */
  coupes?: readonly number[];
  surCoupe?: (i: number, t: number) => void;
  surToucher?: (t: number) => void;
  /** Passage choisi (mode sélection). */
  selection?: { de: number; a: number } | null;
  surSelection?: (s: { de: number; a: number } | null) => void;
}

const HAUTEUR = 128;
const PRISE = 24;

/** Min et max par colonne (mono). */
function colonnes(pcm: PcmSon, n: number): Float32Array {
  const c0 = pcm.canaux;
  const len = Math.min(...c0.map((c) => c.length));
  const out = new Float32Array(n * 2);
  for (let x = 0; x < n; x++) {
    let mi = 0;
    let ma = 0;
    const de = Math.floor((x * len) / n);
    const a = Math.max(de + 1, Math.floor(((x + 1) * len) / n));
    const pas = Math.max(1, Math.floor((a - de) / 256));
    for (let i = de; i < a && i < len; i += pas) {
      let v = 0;
      for (const c of c0) v += c[i]! / c0.length;
      if (v < mi) mi = v;
      if (v > ma) ma = v;
    }
    out[2 * x] = mi;
    out[2 * x + 1] = ma;
  }
  return out;
}

export function FormeOnde({ pcm, libelle, coupes, surCoupe, surToucher, selection, surSelection }: Props) {
  const boite = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const [largeur, setLargeur] = useState(320);
  const [glisse, setGlisse] = useState<{ i: number; t: number } | null>(null);
  const [choix, setChoix] = useState<{ de: number; a: number } | null>(null);
  const geste = useRef<{ x0: number; t0: number; i: number; bouge: boolean } | null>(null);
  const duree = Math.min(...pcm.canaux.map((c) => c.length)) / pcm.frequence;
  const cols = useMemo(() => colonnes(pcm, largeur), [pcm, largeur]);

  useEffect(() => {
    const b = boite.current;
    if (!b) return;
    const regler = () => setLargeur(Math.max(100, Math.round(b.clientWidth)));
    regler();
    const o = new ResizeObserver(regler);
    o.observe(b);
    return () => o.disconnect();
  }, []);

  const lesCoupes = (coupes ?? []).map((t, i) => (glisse?.i === i ? glisse.t : t));
  const passage = choix ?? selection ?? null;

  useEffect(() => {
    const c = toile.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = largeur * dpr;
    c.height = HAUTEUR * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largeur, HAUTEUR);
    const px = (t: number) => (t / duree) * largeur;
    if (coupes) {
      const bornes = [0, ...lesCoupes, duree];
      for (let i = 0; i + 1 < bornes.length; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(168,85,247,0.10)' : 'rgba(236,72,153,0.06)';
        ctx.fillRect(px(bornes[i]!), 0, px(bornes[i + 1]!) - px(bornes[i]!), HAUTEUR);
      }
    }
    if (passage) {
      ctx.fillStyle = 'rgba(168,85,247,0.28)';
      ctx.fillRect(px(passage.de), 0, px(passage.a) - px(passage.de), HAUTEUR);
    }
    const milieu = HAUTEUR / 2;
    ctx.fillStyle = '#c08bff';
    for (let x = 0; x < largeur; x++) {
      const y0 = milieu - cols[2 * x + 1]! * (milieu - 4);
      const y1 = milieu - cols[2 * x]! * (milieu - 4);
      ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
    ctx.fillStyle = '#ec4899';
    for (const t of lesCoupes) {
      ctx.fillRect(Math.round(px(t)) - 1, 0, 2, HAUTEUR);
      ctx.beginPath();
      ctx.arc(px(t), HAUTEUR - 10, 7, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  const temps = (e: PointerEvent) => {
    const r = boite.current!.getBoundingClientRect();
    return Math.min(duree, Math.max(0, ((e.clientX - r.left) / r.width) * duree));
  };
  const bas = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const t = temps(e);
    let i = -1;
    if (coupes) {
      let mieux = PRISE;
      lesCoupes.forEach((c, k) => {
        const d = (Math.abs(c - t) / duree) * largeur;
        if (d < mieux) (mieux = d), (i = k);
      });
    }
    geste.current = { x0: e.clientX, t0: t, i, bouge: false };
    if (i >= 0) setGlisse({ i, t: lesCoupes[i]! });
  };
  const bouge = (e: PointerEvent) => {
    const g = geste.current;
    if (!g) return;
    if (Math.abs(e.clientX - g.x0) > 6) g.bouge = true;
    const t = temps(e);
    if (g.i >= 0) {
      const min = (g.i > 0 ? lesCoupes[g.i - 1]! : 0) + 0.006;
      const max = (g.i + 1 < lesCoupes.length ? lesCoupes[g.i + 1]! : duree) - 0.006;
      setGlisse({ i: g.i, t: Math.min(max, Math.max(min, t)) });
    } else if (surSelection && g.bouge) setChoix({ de: Math.min(g.t0, t), a: Math.max(g.t0, t) });
  };
  const haut = (e: PointerEvent) => {
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    if (g.i >= 0 && glisse) {
      if (g.bouge) surCoupe?.(g.i, glisse.t);
      setGlisse(null);
      if (g.bouge) return;
    }
    if (!g.bouge) {
      setChoix(null);
      if (surSelection) surSelection(null);
      surToucher?.(temps(e));
      return;
    }
    if (choix && surSelection) surSelection(choix.a - choix.de >= 0.005 ? choix : null);
    setChoix(null);
  };

  return (
    <div
      ref={boite}
      class="forme-onde"
      role="img"
      aria-label={libelle}
      onPointerDown={bas}
      onPointerMove={bouge}
      onPointerUp={haut}
      onPointerCancel={() => ((geste.current = null), setGlisse(null), setChoix(null))}
      data-testid="forme-onde"
    >
      <canvas ref={toile} style={{ width: `${largeur}px`, height: `${HAUTEUR}px` }} />
    </div>
  );
}
