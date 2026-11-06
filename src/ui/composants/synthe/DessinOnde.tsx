// Onde dessinée au doigt (synthé « onde », façon BitInvader) : 64 points dans un cadre ; le doigt pose les points
// qu'il traverse (sans trou s'il va vite). Formes toutes prêtes : sinus, scie, carré, triangle, au hasard.
import { useRef, useState } from 'preact/hooks';
import { T } from '../../../textes-fr';

interface Props {
  onde: readonly number[];
  /** Pendant le geste (fusionné en une étape d'Annuler). */
  dessiner: (onde: number[]) => void;
  /** Doigt levé : on fait entendre le son. */
  surFin: () => void;
}

const FORMES: Record<string, (x: number) => number> = {
  sinus: (x) => Math.sin(2 * Math.PI * x),
  scie: (x) => 1 - 2 * x,
  carre: (x) => (x < 0.5 ? 0.8 : -0.8),
  triangle: (x) => (x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4),
};

function auHasard(n: number): number[] {
  let v = 0;
  return Array.from({ length: n }, () => (v = Math.max(-1, Math.min(1, v + (Math.random() * 2 - 1) * 0.5))));
}

export function DessinOnde({ onde, dessiner, surFin }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [geste, setGeste] = useState<number[] | null>(null);
  const dernier = useRef<number | null>(null);
  const points = geste ?? [...onde];
  const n = points.length;

  const poser = (e: PointerEvent, depart: boolean) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
    const v = Math.round(Math.max(-1, Math.min(1, 1 - (2 * (e.clientY - r.top)) / r.height)) * 1000) / 1000;
    const o = [...(geste ?? onde)];
    const j = depart || dernier.current === null ? i : dernier.current;
    const de = o[j] ?? v;
    const pas = Math.abs(i - j);
    for (let k = 0; k <= pas; k++) {
      const x = j + Math.sign(i - j) * k;
      o[x] = pas === 0 ? v : Math.round((de + ((v - de) * k) / pas) * 1000) / 1000;
    }
    dernier.current = i;
    setGeste(o);
    dessiner(o);
  };

  const finir = () => {
    if (geste) surFin();
    dernier.current = null;
    setGeste(null);
  };

  const trace = points.map((v, i) => `${((i + 0.5) / n) * 640},${100 - v * 92}`).join(' ');
  return (
    <div class="synthe-onde">
      <svg
        ref={ref}
        class="synthe-onde-cadre"
        viewBox="0 0 640 200"
        preserveAspectRatio="none"
        role="img"
        aria-label={T.synthe.onde}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          poser(e, true);
        }}
        onPointerMove={(e) => geste && poser(e, false)}
        onPointerUp={finir}
        onPointerCancel={finir}
        data-testid="synthe-onde"
      >
        <line x1="0" y1="100" x2="640" y2="100" class="synthe-onde-zero" />
        <polyline points={trace} class="synthe-onde-trait" />
      </svg>
      <div class="puces">
        {[...Object.keys(FORMES), 'hasard'].map((f) => (
          <button
            key={f}
            type="button"
            class="puce"
            onClick={() => {
              dessiner(
                f === 'hasard'
                  ? auHasard(n)
                  : Array.from({ length: n }, (_, i) => Math.round(FORMES[f]!(i / n) * 1000) / 1000),
              );
              surFin();
            }}
            data-testid={`synthe-forme-${f}`}
          >
            {T.synthe.formes[f]}
          </button>
        ))}
      </div>
    </div>
  );
}
