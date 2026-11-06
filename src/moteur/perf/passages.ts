// Les passages à geler pour les effets de performance (R) : un par (apparition de section, effet), avec les pistes
// touchées, le temps [de, a[ et une clé stable. La clé ne dépend que de ce qui change le son du passage : tempo,
// swing, kit, tonalité, pistes (tranches, automation), sons et pads, la section jouée et celle d'avant (traînes),
// leurs motifs, l'effet, la position (automation au temps du morceau) et la fréquence du rendu.

import { idMotifDe } from '../../morceau/acces';
import { arrangement, dureePas, pasVersSecondes, type Occurrence } from '../../morceau/temps';
import type { EffetPerf, IdPiste, Morceau, Section } from '../../morceau/types';

export interface Passage {
  /** Clé du rendu de ce passage (toutes ses pistes) ; la clé d'un gel = `${cle}|${piste}`. */
  cle: string;
  pistes: IdPiste[];
  de: number;
  a: number;
  effet: EffetPerf;
  secondesParPas: number;
}

/** Empreinte FNV-1a 32 bits (deux passes, 16 caractères hexadécimaux) d'un texte. */
export function empreinte(texte: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ texte.length;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** Pistes touchées par un effet : `effet.pistes`, sinon toutes celles qui jouent dans la section, sauf la voix. */
export function pistesTouchees(m: Morceau, section: Section, effet: EffetPerf): IdPiste[] {
  const existe = new Set(m.pistes.map((p) => p.id));
  if (effet.pistes && effet.pistes.length > 0) return effet.pistes.filter((id) => existe.has(id));
  return m.pistes
    .map((p) => p.id)
    .filter(
      (id) => id !== 'voix' && (idMotifDe(section, id) !== undefined || (id === 'sons' && !!section.boucle)),
    );
}

/** Ce qui, dans le morceau, change le son d'un passage de la section `o` (hors effet et position). */
function contexte(m: Morceau, o: Occurrence, avant: Occurrence | undefined, voix: boolean): string {
  const sections = [avant?.section, o.section].filter((s): s is Section => !!s);
  const motifs: Record<string, unknown> = {};
  for (const s of sections)
    for (const id of Object.keys(s.motifs)) motifs[s.motifs[id]!] = m.motifs[s.motifs[id]!];
  const sansPerf = sections.map(({ perf: _perf, paroles: _paroles, ...s }) => s);
  return JSON.stringify([
    m.tempo,
    m.swing,
    m.kit,
    m.style,
    m.tonalite,
    m.pistes,
    m.sons,
    m.pads,
    m.tranchesPads,
    m.soundfonts,
    sansPerf,
    motifs,
    voix ? m.prises : 0,
  ]);
}

/** Tous les passages d'effets de performance du morceau, à la fréquence `frequence`. */
export function passagesPerf(m: Morceau, frequence: number): Passage[] {
  const occs = arrangement(m);
  if (!occs.some((o) => o.section.perf?.length)) return [];
  const d = dureePas(m.tempo);
  const out: Passage[] = [];
  occs.forEach((o, i) => {
    const perf = o.section.perf;
    if (!perf?.length) return;
    let ctx: string | null = null;
    for (const effet of perf) {
      const pistes = pistesTouchees(m, o.section, effet);
      if (pistes.length === 0) continue;
      const fin = Math.min(effet.pas + effet.duree, o.pas);
      const de = pasVersSecondes(m, o.debutPas + effet.pas);
      const a = pasVersSecondes(m, o.debutPas + fin);
      if (!(a > de)) continue;
      const c = pistes.includes('voix')
        ? contexte(m, o, occs[i - 1], true)
        : (ctx ??= contexte(m, o, occs[i - 1], false));
      const cle = empreinte(
        `${c}|${JSON.stringify(effet)}|${pistes.join(',')}|${de.toFixed(6)}|${a.toFixed(6)}|${frequence}`,
      );
      out.push({ cle: `perf-${cle}`, pistes, de, a, effet, secondesParPas: d });
    }
  });
  return out;
}
