// Vumètre horizontal (0 à 1) : vert, puis jaune, puis rouge près de la saturation.

import { T } from '../../../textes-fr';

export function Vumetre({ niveau }: { niveau: number }) {
  const n = Math.max(0, Math.min(1, niveau));
  return (
    <div
      class="vumetre"
      role="meter"
      aria-label={T.voix.niveau}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(n * 100)}
      data-testid="vumetre"
    >
      <span class="vumetre-barre" style={{ transform: `scaleX(${n})` }} data-fort={n > 0.9 ? '1' : '0'} />
    </div>
  );
}
