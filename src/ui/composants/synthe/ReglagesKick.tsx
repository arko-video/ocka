// Fabricant de kick (L) : préréglages, puis hauteur de départ et de fin, chute, longueur, claquement, saturation.
// Le doigt levé fait entendre le kick tout de suite.
import type { RecetteKick } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { Curseur } from './Curseur';
import { BORNES_KICK, KICKS } from './prereglages';

type Cle = keyof typeof BORNES_KICK;

function versPosition(cle: Cle, v: number): number {
  const b = BORNES_KICK[cle];
  return b.log ? Math.log(v / b.min) / Math.log(b.max / b.min) : (v - b.min) / (b.max - b.min);
}

function depuisPosition(cle: Cle, x: number): number {
  const b = BORNES_KICK[cle];
  const v = b.log ? b.min * Math.pow(b.max / b.min, x) : b.min + x * (b.max - b.min);
  return Math.round(v * 1000) / 1000;
}

function affichage(cle: Cle, v: number): string {
  const u = BORNES_KICK[cle].unite;
  if (u === 'Hz') return `${Math.round(v)} Hz`;
  if (u === 's') return v < 0.1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2).replace('.', ',')} s`;
  return String(Math.round(v * 100));
}

interface Props {
  kick: RecetteKick;
  changer: (k: RecetteKick) => void;
  jouer: (k: RecetteKick) => void;
}

export function ReglagesKick({ kick, changer, jouer }: Props) {
  const actif = (k: RecetteKick) =>
    (Object.keys(BORNES_KICK) as Cle[]).every((c) => Math.abs(k[c] - kick[c]) < 1e-6);
  return (
    <>
      <div class="puces" role="radiogroup" aria-label={T.synthe.prereglages}>
        {Object.entries(KICKS).map(([cle, k]) => (
          <button
            key={cle}
            type="button"
            role="radio"
            class="puce"
            aria-checked={actif(k)}
            onClick={() => (changer(k), jouer(k))}
            data-testid={`kick-preset-${cle}`}
          >
            {T.sonsCourts.kickPresets[cle] ?? cle}
          </button>
        ))}
      </div>
      {(Object.keys(BORNES_KICK) as Cle[]).map((cle) => (
        <Curseur
          key={cle}
          nom={T.sonsCourts.kickParams[cle] ?? cle}
          position={versPosition(cle, kick[cle])}
          affichage={affichage(cle, kick[cle])}
          regler={(x) => changer({ ...kick, [cle]: depuisPosition(cle, x) })}
          surFin={() => jouer(kick)}
          testid={`kick-${cle}`}
        />
      ))}
    </>
  );
}
