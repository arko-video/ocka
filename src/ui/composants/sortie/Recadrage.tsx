// Recadrage d'une image importée : un carré CENTRÉ qu'on ajuste en glissant l'image (pas de pincement en v1).
// Le centre (fractions 0 à 1 de la largeur et de la hauteur) est celui que preparerPochette recoupe. Propriétaire : A1.

import { useRef } from 'preact/hooks';
import { T } from '../../../textes-fr';

export interface ImageChoisie {
  fichier: File;
  url: string;
  largeur: number;
  hauteur: number;
}

/** Centre possible : le carré ne sort jamais de l'image. */
export function bornerCentre(c: { x: number; y: number }, largeur: number, hauteur: number) {
  const cote = Math.min(largeur, hauteur);
  const mx = cote / 2 / largeur;
  const my = cote / 2 / hauteur;
  return { x: Math.min(1 - mx, Math.max(mx, c.x)), y: Math.min(1 - my, Math.max(my, c.y)) };
}

export function Recadrage({ image, centre, surCentre }: { image: ImageChoisie; centre: { x: number; y: number }; surCentre: (c: { x: number; y: number }) => void }) {
  const cadre = useRef<HTMLDivElement>(null);
  const depart = useRef<{ px: number; py: number; c: { x: number; y: number }; taille: number } | null>(null);
  const cote = Math.min(image.largeur, image.hauteur);
  // Taille affichée de l'image, en fractions du cadre (le plus petit côté remplit le cadre).
  const w = image.largeur / cote;
  const h = image.hauteur / cote;
  return (
    <div
      ref={cadre}
      class="recadrage"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        depart.current = { px: e.clientX, py: e.clientY, c: centre, taille: cadre.current?.clientWidth || 1 };
      }}
      onPointerMove={(e) => {
        const d = depart.current;
        if (!d) return;
        const dx = (e.clientX - d.px) / (d.taille * w);
        const dy = (e.clientY - d.py) / (d.taille * h);
        surCentre(bornerCentre({ x: d.c.x - dx, y: d.c.y - dy }, image.largeur, image.hauteur));
      }}
      onPointerUp={() => (depart.current = null)}
      onPointerCancel={() => (depart.current = null)}
      role="img"
      aria-label={T.sortie.glisser}
      data-testid="recadrage"
    >
      <img
        src={image.url}
        alt=""
        draggable={false}
        style={{
          width: `${w * 100}%`,
          height: `${h * 100}%`,
          left: `${(0.5 - centre.x * w) * 100}%`,
          top: `${(0.5 - centre.y * h) * 100}%`,
        }}
      />
      <span class="recadrage-grille" aria-hidden="true" />
    </div>
  );
}
