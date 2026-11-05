// Outils pour écrire les motifs des styles comme des grilles lisibles :
//   'X' = frappe forte (1), 'o' = moyenne (0,75), 'x' = douce (0,5), '.' = rien.
//   Roulements : un chiffre (2, 3, 4 ou 6) = autant de frappes dans ce pas.
// Une grille de 16 caractères = 1 mesure ; on peut mettre plusieurs mesures à la suite (espaces ignorés).

import type { InstrumentBatterie, MotifBasse, MotifBatterie, NoteBasse } from './types';

/** Lit une grille de frappes : « X.x. » → [1, 0, 0.5, 0]. */
export function frappes(grille: string): number[] {
  const valeurs: Record<string, number> = { X: 1, o: 0.75, x: 0.5 };
  return [...grille.replace(/\s/g, '')].map((c) => valeurs[c] ?? 0);
}

/** Lit une grille de roulements : « ..3.6 » → [0, 0, 3, 0, 6]. */
export function roulements(grille: string): number[] {
  return [...grille.replace(/\s/g, '')].map((c) => (['2', '3', '4', '6'].includes(c) ? Number(c) : 0));
}

export type Grilles = Partial<Record<InstrumentBatterie, string>>;

/** Fabrique un motif de batterie à partir de grilles (et de roulements éventuels). */
export function motifBatterie(grilles: Grilles, rouls: Grilles = {}): MotifBatterie {
  const pistes: MotifBatterie['pistes'] = {};
  let pas = 16;
  for (const [inst, g] of Object.entries(grilles) as [InstrumentBatterie, string][]) {
    pistes[inst] = frappes(g);
    pas = Math.max(pas, pistes[inst]!.length);
  }
  const motif: MotifBatterie = { type: 'batterie', pas, pistes };
  const entrees = Object.entries(rouls) as [InstrumentBatterie, string][];
  if (entrees.length > 0) {
    motif.roulements = {};
    for (const [inst, g] of entrees) motif.roulements[inst] = roulements(g);
  }
  // Toutes les lignes à la même longueur (une mesure répétée si besoin).
  for (const p of [motif.pistes, motif.roulements ?? {}]) {
    for (const inst of Object.keys(p) as InstrumentBatterie[]) {
      const l = p[inst]!;
      p[inst] = Array.from({ length: pas }, (_, i) => l[i % l.length] ?? 0);
    }
  }
  return motif;
}

/** Les 4 motifs de batterie d'un style : intro, couplet, refrain, pont (la variation, jouée aussi à l'outro). */
export type QuatreMotifs = { intro: MotifBatterie; couplet: MotifBatterie; refrain: MotifBatterie; pont: MotifBatterie };

/** Note de basse (degré relatif à la fondamentale de l'accord : la basse suit les accords). */
export function n(pas: number, duree: number, degre = 0, plus: Partial<NoteBasse> = {}): NoteBasse {
  return { pas, duree, degre, ...plus };
}

/** Répète une mesure de basse sur 4 mesures (une par accord), la 4e pouvant être différente. */
export function quatreMesures(mesure: NoteBasse[], derniere: NoteBasse[] = mesure): MotifBasse {
  const notes: NoteBasse[] = [];
  for (let m = 0; m < 4; m++) for (const x of m === 3 ? derniere : mesure) notes.push({ ...x, pas: x.pas + m * 16 });
  return { type: 'basse', pas: 64, notes, suitAccords: true };
}
