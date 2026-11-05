// Édition pure des réglages : tempo, swing, accords, basse, mélange, master, titre et prises.

import type { IdPiste, Master, Morceau, MotifAccords, Piste, Prise } from '../../morceau/types';

const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function reglerTempo(m: Morceau, tempo: number): Morceau {
  if (!Number.isFinite(tempo)) return m;
  const t = Math.round(borner(tempo, 60, 200));
  return t === m.tempo ? m : { ...m, tempo: t };
}

export function reglerSwing(m: Morceau, swing: number): Morceau {
  if (!Number.isFinite(swing)) return m;
  const s = Math.round(borner(swing, 0, 0.6) * 100) / 100;
  return s === m.swing ? m : { ...m, swing: s };
}

/** Id du motif d'accords joué par l'arrangement (le premier trouvé). */
export function idMotifAccords(m: Morceau): string | null {
  for (const id of m.ordre) {
    const a = m.sections.find((s) => s.id === id)?.motifs.accords;
    if (a && m.motifs[a]?.type === 'accords') return a;
  }
  return Object.keys(m.motifs).find((k) => m.motifs[k]!.type === 'accords') ?? null;
}

/** Indice de la suite d'accords en place parmi celles proposées (−1 si aucune ne correspond). */
export function suiteActive(m: Morceau, suites: { motif: MotifAccords }[]): number {
  const id = idMotifAccords(m);
  const actuel = id ? m.motifs[id] : null;
  if (!actuel || actuel.type !== 'accords') return -1;
  const cle = JSON.stringify(actuel.accords);
  return suites.findIndex((s) => JSON.stringify(s.motif.accords) === cle);
}

/** Remplace la suite d'accords (le son choisi est gardé). Sans motif d'accords, il est créé pour toutes les sections. */
export function choisirAccords(m: Morceau, suite: MotifAccords): Morceau {
  const id = idMotifAccords(m);
  if (id) {
    const actuel = m.motifs[id] as MotifAccords;
    const nouveau: MotifAccords = { ...suite, son: actuel.son ?? suite.son };
    if (JSON.stringify(nouveau) === JSON.stringify(actuel)) return m;
    return { ...m, motifs: { ...m.motifs, [id]: nouveau } };
  }
  const nouvelId = 'accords';
  return {
    ...m,
    motifs: { ...m.motifs, [nouvelId]: suite },
    sections: m.sections.map((s) => ({ ...s, motifs: { ...s.motifs, accords: nouvelId } })),
  };
}

export function basseActive(m: Morceau): boolean {
  return m.sections.some((s) => s.motifs.basse && m.motifs[s.motifs.basse]?.type === 'basse');
}

/** Active ou coupe la basse dans toutes les sections (le motif reste gardé dans `motifs`). */
export function activerBasse(m: Morceau, actif: boolean): Morceau {
  if (basseActive(m) === actif) return m;
  if (!actif) {
    return {
      ...m,
      sections: m.sections.map((s) => {
        const motifs = { ...s.motifs };
        delete motifs.basse;
        return { ...s, motifs };
      }),
    };
  }
  const id = Object.keys(m.motifs).find((k) => m.motifs[k]!.type === 'basse');
  if (!id) return m;
  return { ...m, sections: m.sections.map((s) => ({ ...s, motifs: { ...s.motifs, basse: id } })) };
}

/** Volume (0 à 1,5), panoramique (−1 à 1), muet, solo, préréglage de la voix. */
export function reglerPiste(
  m: Morceau,
  id: IdPiste,
  c: Partial<Pick<Piste, 'volume' | 'pan' | 'muet' | 'solo' | 'preset'>>,
): Morceau {
  const p = m.pistes.find((x) => x.id === id);
  const base: Piste = p ?? { id, volume: 0.8, pan: 0, muet: false, solo: false };
  const n: Piste = { ...base, ...c };
  n.volume = Math.round(borner(n.volume, 0, 1.5) * 100) / 100;
  n.pan = Math.round(borner(n.pan, -1, 1) * 100) / 100;
  if (p && JSON.stringify(n) === JSON.stringify(p)) return m;
  return { ...m, pistes: p ? m.pistes.map((x) => (x.id === id ? n : x)) : [...m.pistes, n] };
}

export function reglerMaster(m: Morceau, c: Partial<Master>): Morceau {
  const master = { ...m.master, ...c };
  return JSON.stringify(master) === JSON.stringify(m.master) ? m : { ...m, master };
}

/** Fondu de fin, de 0 à 8 s. */
export function reglerFondu(m: Morceau, s: number): Morceau {
  const f = Math.round(borner(s, 0, 8) * 2) / 2;
  return f === (m.fondu ?? 0) ? m : { ...m, fondu: f };
}

export function reglerInfos(m: Morceau, c: { titre?: string; artiste?: string }): Morceau {
  let r = m;
  if (c.titre !== undefined) {
    const t = c.titre.trim().slice(0, 80);
    if (t && t !== m.titre) r = { ...r, titre: t };
  }
  if (c.artiste !== undefined) {
    const a = c.artiste.trim().slice(0, 80);
    if (a !== (m.artiste ?? '')) {
      r = { ...r };
      if (a) r.artiste = a;
      else delete r.artiste;
    }
  }
  return r;
}

/* ------------------------------------------------------------ prises */

const memeAncre = (a: Prise['ancre'], b: Prise['ancre']) => a.section === b.section && a.occurrence === b.occurrence;

/** Prises d'une section (et de son occurrence), dans l'ordre d'enregistrement. */
export function prisesDe(m: Morceau, section: string, occ: number): Prise[] {
  return m.prises.filter((p) => p.ancre.section === section && p.ancre.occurrence === occ);
}

/** Ajoute une nouvelle prise : elle devient la prise gardée de sa section (une seule par section en v1). */
export function ajouterPrise(m: Morceau, prise: Prise): Morceau {
  const autres = m.prises.filter((p) => p.id !== prise.id).map((p) => (memeAncre(p.ancre, prise.ancre) && p.choisie ? { ...p, choisie: false } : p));
  return { ...m, prises: [...autres, { ...prise, choisie: true }] };
}

/** Garde cette prise pour sa section, les autres de la même section deviennent muettes. */
export function garderPrise(m: Morceau, id: string): Morceau {
  const p = m.prises.find((x) => x.id === id);
  if (!p || p.choisie) return m;
  return {
    ...m,
    prises: m.prises.map((x) => (x.id === id ? { ...x, choisie: true } : memeAncre(x.ancre, p.ancre) ? { ...x, choisie: false } : x)),
  };
}

export function retirerPrise(m: Morceau, id: string): Morceau {
  return m.prises.some((p) => p.id === id) ? { ...m, prises: m.prises.filter((p) => p.id !== id) } : m;
}
