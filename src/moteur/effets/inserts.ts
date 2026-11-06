// Inserts d'une piste (propriétaire : M2, vague C1). Règles (décisions v2 §3) : nœuds natifs pour eq, filtre,
// saturation (4x), chorus, flanger, phaser (natifs.ts) ; compresseur et bitcrusher en JS (dsp.ts) dans UN worklet
// par piste à l'écoute ; À L'EXPORT AUCUN WORKLET : mêmes calculs en JS sur le rendu (passe A, preparer.ts),
// écart worklet/JS testé. Envois : réverbe et écho partagés (envois.ts).

import { PARAMS_EFFETS, type Insert, type TypeEffet } from '../../morceau/types';
import { ChaineJs, reglagesJs } from './dsp';

export { creerChaineInserts, optionsInserts, type ChaineInsertsM2 } from './chaine-inserts';

/** Un insert neuf de ce type, réglages par défaut (PARAMS_EFFETS), actif. Pur. */
export function insertParDefaut(type: TypeEffet, id: string): Insert {
  const params = Object.create(null) as Record<string, number>;
  for (const [cle, r] of Object.entries(PARAMS_EFFETS[type])) params[cle] = r.defaut;
  return { id, type, actif: true, params };
}

function avec(type: TypeEffet, id: string, reglages: Record<string, number>): Insert {
  const i = insertParDefaut(type, id);
  for (const [k, v] of Object.entries(reglages)) i.params[k] = v;
  return i;
}

/** Préréglages de chaînes d'inserts (« Voix claire », « Lo-fi téléphone », « 808 qui tape »…). Pur. */
export function presetsInserts(): { nom: string; inserts: Insert[] }[] {
  return [
    {
      nom: 'Voix claire',
      inserts: [
        avec('eq', 'fx-1', { passeHaut: 100, medium: -2, freqMedium: 400, aigu: 3, freqAigu: 9000 }),
        avec('compresseur', 'fx-2', { seuil: -20, ratio: 3, attaque: 5, relache: 120 }),
        avec('envoi-reverbe', 'fx-3', { niveau: 0.2 }),
      ],
    },
    {
      nom: '808 qui tape',
      inserts: [
        avec('saturation', 'fx-1', { force: 0.35, ton: 0.55, mix: 0.7 }),
        avec('compresseur', 'fx-2', { seuil: -14, ratio: 4, attaque: 15, relache: 200 }),
        avec('eq', 'fx-3', { passeHaut: 28, grave: 2, freqGrave: 60 }),
      ],
    },
    {
      nom: 'Batterie compacte',
      inserts: [
        avec('compresseur', 'fx-1', { seuil: -22, ratio: 5, attaque: 8, relache: 100, mix: 0.6 }),
        avec('eq', 'fx-2', { grave: 2, freqGrave: 90, aigu: 2 }),
      ],
    },
    {
      nom: 'Lo-fi téléphone',
      inserts: [
        avec('filtre', 'fx-1', { mode: 2, frequence: 1400, resonance: 1.2 }),
        avec('saturation', 'fx-2', { force: 0.5, mix: 1 }),
        avec('bitcrusher', 'fx-3', { bits: 10, reduction: 2, mix: 0.6 }),
      ],
    },
    {
      nom: 'Rétro 8 bits',
      inserts: [avec('bitcrusher', 'fx-1', { bits: 6, reduction: 6, mix: 1 }), avec('filtre', 'fx-2', { mode: 0, frequence: 9000 })],
    },
    {
      nom: 'Nappe qui tourne',
      inserts: [avec('phaser', 'fx-1', { vitesse: 0.25, profondeur: 0.6 }), avec('chorus', 'fx-2', { mix: 0.4 }), avec('envoi-reverbe', 'fx-3', { niveau: 0.35 })],
    },
    {
      nom: 'Guitare large',
      inserts: [avec('eq', 'fx-1', { passeHaut: 120, medium: 2, freqMedium: 2500 }), avec('chorus', 'fx-2', { vitesse: 0.6, profondeur: 0.5 }), avec('envoi-echo', 'fx-3', { niveau: 0.2 })],
    },
    {
      nom: 'Phonk sale',
      inserts: [avec('saturation', 'fx-1', { force: 0.7, ton: 0.4 }), avec('flanger', 'fx-2', { vitesse: 0.15, mix: 0.3 }), avec('envoi-echo', 'fx-3', { niveau: 0.15 })],
    },
  ];
}

/**
 * Export : applique en JS, EN PLACE, les inserts calculés en JS (compresseur, bitcrusher, actifs, dans l'ordre)
 * d'une piste rendue (son pris juste avant eux). `trameDebut` = trame du morceau de canaux[…][0] (tenue du
 * bitcrusher calée sur le morceau, comme le worklet).
 */
export function traiterInsertsJs(canaux: Float32Array[], frequence: number, inserts: Insert[], trameDebut = 0): void {
  const js = reglagesJs(inserts);
  const g = canaux[0];
  if (!g || js.length === 0) return;
  const d = canaux[1] ?? new Float32Array(g);
  new ChaineJs(frequence, js).traiter(g, d, g.length, trameDebut);
}
