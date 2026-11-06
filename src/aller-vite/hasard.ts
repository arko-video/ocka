// « Idée au hasard » : des règles et une graine, sans IA ni réseau. Même graine → exactement la même idée.
//   - ideeAuHasard : style, tempo dans la plage du style, tonalité, suite d'accords, variation de batterie, mélodie ;
//   - varierMelodie / autreIdeeMelodie : une variation de la mélodie d'une section (toujours dans la gamme) ;
//   - poserMelodie / poserBatterie : posent un motif dans le morceau (une seule étape d'Annuler côté interface).

import { nouveauMorceau, reecrireNotesDeDepart, REGLAGES_STYLE, suitesAccords } from '../morceau/styles';
import { demiTonsDegre, hauteurTonique, TONIQUES } from '../morceau/theorie';
import { avecMotifSection, avecPisteMelodie, idMotifDe, motifNotesDe, pisteMelodie, sectionDe, sonOcka } from '../morceau/acces';
import { STYLES, type Morceau, type Motif, type MotifBatterie, type MotifNotes, type Note, type SonMelodie, type Style, type Tonique } from '../morceau/types';
import { hasardGraine, varier } from '../morceau/varier';
import { ecrireBoucle, sonConseille, TYPES_BOUCLES, type TypeBoucle } from './boucles';

/** Ce que l'idée a tiré, pour l'afficher avant de créer le morceau. */
export interface Idee {
  graine: number;
  style: Style;
  tempo: number;
  tonique: Tonique;
  mode: Morceau['tonalite']['mode'];
  /** Nom de la suite d'accords tirée (« Memphis »…). */
  suite: string;
  /** Type de la mélodie posée sur le refrain. */
  boucle: TypeBoucle;
  morceau: Morceau;
}

/** Une graine neuve (entier positif sur 31 bits). */
export function nouvelleGraine(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Copie du dictionnaire des motifs (sans prototype, comme le normaliseur) avec un motif changé. */
function avecMotif(m: Morceau, id: string, motif: Motif): Morceau {
  const motifs = Object.assign(Object.create(null) as Morceau['motifs'], m.motifs);
  motifs[id] = motif;
  return { ...m, motifs };
}

/** Un id de motif libre : `base`, sinon `base-2`, `base-3`… */
function idLibre(m: Morceau, base: string): string {
  if (!Object.hasOwn(m.motifs, base)) return base;
  for (let k = 2; ; k++) if (!Object.hasOwn(m.motifs, `${base}-${k}`)) return `${base}-${k}`;
}

/**
 * Pose une mélodie sur une section, sur la piste de la mélodie (remplace son motif, ou en crée un). `son` : son de
 * la boucle (instrument de la piste). Renvoie le même morceau si rien ne change.
 */
export function poserMelodie(m: Morceau, idSection: string, motif: MotifNotes, son?: SonMelodie): Morceau {
  const s = sectionDe(m, idSection);
  if (!s) return m;
  const { m: m1, id: piste } = avecPisteMelodie(m, son);
  const idActuel = idMotifDe(s, piste);
  const actuel = motifNotesDe(m1, s, piste);
  if (idActuel && actuel) {
    if (JSON.stringify(actuel) === JSON.stringify(motif)) return m1;
    return avecMotif(m1, idActuel, structuredClone(motif));
  }
  const id = idLibre(m1, `mel-${idSection}`.slice(0, 40));
  return avecMotifSection(avecMotif(m1, id, structuredClone(motif)), idSection, piste, id);
}

/** Remplace un motif de batterie existant. */
export function poserBatterie(m: Morceau, idMotif: string, motif: MotifBatterie): Morceau {
  if (m.motifs[idMotif]?.type !== 'batterie' || JSON.stringify(m.motifs[idMotif]) === JSON.stringify(motif)) return m;
  return avecMotif(m, idMotif, structuredClone(motif));
}

/** Les notes MIDI de la gamme du morceau (classes de hauteur). */
function classesGamme(m: Morceau): Set<number> {
  const t = hauteurTonique(m.tonalite.tonique);
  return new Set(Array.from({ length: 7 }, (_, d) => (t + demiTonsDegre(m.tonalite.mode, d)) % 12));
}

/** Monte ou descend de `pas` notes dans la gamme (la note de départ peut être hors gamme : elle ne bouge pas). */
function marche(gamme: Set<number>, midi: number, pas: number): number {
  if (!gamme.has(((midi % 12) + 12) % 12)) return midi;
  let x = midi;
  for (let k = 0; k < Math.abs(pas); k++) {
    do x += Math.sign(pas);
    while (!gamme.has(((x % 12) + 12) % 12));
  }
  return x;
}

/**
 * Variation d'une mélodie : quelques notes montent ou descendent d'une note de la gamme, changent d'octave,
 * se coupent en deux ou disparaissent. Le rythme général et la gamme sont gardés. Même graine → même résultat.
 */
export function varierMelodie(motif: MotifNotes, graine: number, m: Morceau): MotifNotes {
  const h = hasardGraine(graine * 40503 + 7);
  const gamme = classesGamme(m);
  const sortie: Note[] = [];
  for (const n of motif.notes) {
    const r = h();
    if (r < 0.1 && motif.notes.length > 3) continue; // retirée
    let midi = n.midi;
    if (r < 0.35) midi = marche(gamme, midi, h() < 0.5 ? -1 : 1);
    else if (r < 0.45) midi += midi < 72 ? 12 : -12;
    midi = Math.min(108, Math.max(24, midi));
    if (r >= 0.45 && r < 0.6 && n.duree >= 4) {
      const moitie = Math.floor(n.duree / 2);
      sortie.push({ ...n, duree: moitie, midi }, { ...n, pas: n.pas + moitie, duree: n.duree - moitie, midi: marche(gamme, midi, h() < 0.5 ? -1 : 1) });
    } else sortie.push({ ...n, midi });
  }
  const vues = new Set<string>();
  const notes = sortie
    .filter((x) => x.midi >= 24 && x.midi <= 108 && !vues.has(`${x.pas}|${x.midi}`) && vues.add(`${x.pas}|${x.midi}`) !== undefined)
    .sort((a, b) => a.pas - b.pas || a.midi - b.midi);
  return { ...motif, notes };
}

/** Une boucle tirée au hasard pour une section (type et variante choisis par la graine). */
export function boucleAuHasard(m: Morceau, idSection: string, graine: number, son?: SonMelodie): { type: TypeBoucle; motif: MotifNotes; son: SonMelodie } {
  const h = hasardGraine(graine * 2246822519 + 3);
  const type = TYPES_BOUCLES[Math.floor(h() * TYPES_BOUCLES.length)]!;
  return { type, motif: ecrireBoucle(m, type, idSection, graine), son: son ?? sonConseille(m.style, type) };
}

/**
 * « Une autre idée » dans Mélodie : une variation de la mélodie de la section, ou, si elle est vide,
 * une boucle tirée au hasard (au son déjà choisi s'il y en a un).
 */
export function autreIdeeMelodie(m: Morceau, idSection: string, graine: number): MotifNotes {
  const p = pisteMelodie(m);
  const actuel = p ? motifNotesDe(m, idSection, p.id) : null;
  if (actuel && actuel.notes.length > 0) return varierMelodie(actuel, graine, m);
  return boucleAuHasard(m, idSection, graine, (p && sonOcka(p.instrument)) ?? undefined).motif;
}

/** « Une autre idée » dans Batterie : une variation du motif (règles de varier.ts). */
export function autreIdeeBatterie(motif: MotifBatterie, graine: number): MotifBatterie {
  return varier(motif, graine);
}

/**
 * « Au hasard » : un morceau complet tiré par la graine. Style (si absent), tempo dans la plage du style,
 * tonique (le mode reste celui du style), une des 3 suites, une variation des motifs de batterie, une mélodie.
 */
export function ideeAuHasard(graine: number, style?: Style, titre?: string): Idee {
  const h = hasardGraine(graine * 1597334677 + 11);
  const s: Style = style && STYLES.includes(style) ? style : STYLES[Math.floor(h() * STYLES.length)]!;
  const r = REGLAGES_STYLE[s];
  let m = nouveauMorceau(s, titre);
  const tempo = r.plage[0] + Math.floor(h() * (r.plage[1] - r.plage[0] + 1));
  const tonique = TONIQUES[Math.floor(h() * 12)]!;
  const suites = suitesAccords(s);
  const suite = suites[Math.floor(h() * suites.length)]!;
  m = { ...m, tempo, tonalite: { tonique, mode: r.mode } };
  m = avecMotif(m, 'accords', suite.motif);
  // Les instruments par défaut (guitare, piano, contrebasse…) suivent la nouvelle tonalité et la nouvelle suite.
  m = reecrireNotesDeDepart(m);
  // Variation de batterie : couplet et refrain (l'intro et le pont gardent leur sobriété).
  for (const id of ['bat-couplet', 'bat-refrain']) {
    const b = m.motifs[id];
    if (b?.type === 'batterie') m = avecMotif(m, id, varier(b, Math.floor(h() * 1e9)));
  }
  // Mélodie : la cloche du phonk est réécrite sur la nouvelle tonalité ; sinon une boucle sur le refrain.
  const graineMel = Math.floor(h() * 1e9);
  let boucle: TypeBoucle = 'cloche';
  if (m.motifs['mel-cloche']) {
    m = avecMotif(m, 'mel-cloche', ecrireBoucle(m, 'cloche', 'refrain', graineMel));
  } else {
    const mel = boucleAuHasard(m, 'refrain', graineMel);
    boucle = mel.type;
    m = poserMelodie(m, 'refrain', mel.motif, mel.son);
  }
  return { graine, style: s, tempo, tonique, mode: r.mode, suite: suite.nom, boucle, morceau: m };
}
