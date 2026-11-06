// Curseur au pouce (L) : un réglage de 0 à 1 (ou une position 0 à 1 d'une échelle log), grand pouce, valeur lue.
// `surFin` : quand le doigt se lève (pour faire entendre le résultat une fois, pas à chaque pixel).

const PAS = 1000;

interface Props {
  nom: string;
  /** Position du curseur, de 0 à 1. */
  position: number;
  /** Valeur affichée (« 72 », « 180 Hz »). */
  affichage: string;
  regler: (position: number) => void;
  surFin?: () => void;
  testid: string;
}

export function Curseur({ nom, position, affichage, regler, surFin, testid }: Props) {
  return (
    <label class="synthe-ligne">
      <span class="synthe-nom">{nom}</span>
      <input
        type="range"
        class="curseur"
        min={0}
        max={PAS}
        step={1}
        value={Math.round(Math.min(1, Math.max(0, position)) * PAS)}
        aria-label={nom}
        aria-valuetext={affichage}
        onInput={(e) => regler(e.currentTarget.valueAsNumber / PAS)}
        onChange={() => surFin?.()}
        data-testid={testid}
      />
      <span class="synthe-valeur chiffres">{affichage}</span>
    </label>
  );
}

/** Puces d'un réglage à crans (forme, arpège…) : `n` choix, valeur 0 à 1. */
export function Crans({
  nom,
  valeur,
  etiquettes,
  n,
  regler,
  testid,
}: {
  nom: string;
  valeur: number;
  etiquettes: string[] | undefined;
  n: number;
  regler: (v: number) => void;
  testid: string;
}) {
  const actuel = Math.round(valeur * (n - 1));
  return (
    <div class="synthe-crans">
      <span class="synthe-nom">{nom}</span>
      <div class="puces" role="radiogroup" aria-label={nom}>
        {Array.from({ length: n }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            class="puce"
            aria-checked={i === actuel}
            onClick={() => regler(n > 1 ? i / (n - 1) : 0)}
            data-testid={`${testid}-${i}`}
          >
            {etiquettes?.[i] ?? String(i + 1)}
          </button>
        ))}
      </div>
    </div>
  );
}
