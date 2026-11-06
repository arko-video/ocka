// Import d'un .mid en pistes OCKA (P). Une piste instrument par (piste MIDI, canal), programme GM → instrument proche ;
// canal 10 → la batterie (notes GM → kick, snare, charley…, roulements). Premier tempo gardé (60 à 200). Le fichier est
// découpé en sections de 8 mesures (la dernière plus courte), qui deviennent l'arrangement ; dans chaque section, le
// motif le plus court qui se répète (1, 2, 4 ou 8 mesures) est gardé, et les motifs identiques d'une piste sont
// partagés. Les sections d'avant restent dans la liste. Pur (octets → morceau).

import { pistesInstrument } from '../morceau/acces';
import { PLAFONDS, type InstrumentBatterie, type Morceau, type Motif, type MotifBatterie, type Note, type Section } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { TEXTES_OUTILS_NOTES } from '../textes/outils-notes';
import { idLibre } from '../ui/edition/ids';
import { idsPris } from '../ui/edition/notes-motif';
import { ajouterPiste } from '../ui/edition/pistes';
import type { ResultatImportMidi } from './api-midi';
import { CANAL_BATTERIE, instrumentDuProgramme, padDeNote } from './gm';
import { lireSmf, type NoteSmf } from './smf-lecture';

const T = TEXTES_OUTILS_NOTES.midi;
const MESURES_SECTION = 8;
const g24 = (x: number) => Math.round(x * 24) / 24;
const PERIODES = [16, 32, 64, 128];

interface NotePas {
  pas: number;
  fin: number;
  midi: number;
  vel: number;
}

/** Notes d'une section (pas relatifs, fin coupée au bout de la section), triées, sans doublon. */
function notesSection(notes: readonly NotePas[], debut: number, longueur: number): Note[] {
  const parCle = new Map<string, Note>();
  for (const n of notes) {
    if (n.pas < debut || n.pas >= debut + longueur) continue;
    const pas = g24(n.pas - debut);
    const duree = Math.max(1 / 24, g24(Math.min(n.fin, debut + longueur) - debut - pas));
    parCle.set(`${pas}|${n.midi}`, { pas, duree, midi: n.midi, vel: n.vel });
  }
  return [...parCle.values()].sort((a, b) => a.pas - b.pas || a.midi - b.midi);
}

const cleNote = (n: Note) => `${n.pas}|${n.duree}|${n.midi}|${n.vel}`;

/** Le motif le plus court (1, 2, 4 ou 8 mesures) qui, joué en boucle, redonne exactement les notes de la section. */
function plusCourtMotif(notes: readonly Note[], longueur: number): { pas: number; notes: Note[] } {
  const voulu = notes.map(cleNote).join(';');
  for (const p of PERIODES) {
    if (p >= longueur) break;
    const motif = notes.filter((n) => n.pas < p);
    const rejoue: Note[] = [];
    for (let c = 0; c * p < longueur; c++)
      for (const n of motif) {
        const pas = c * p + n.pas;
        if (pas >= longueur) break;
        rejoue.push({ ...n, pas, duree: g24(Math.min(pas + n.duree, c * p + p, longueur) - pas) });
      }
    rejoue.sort((a, b) => a.pas - b.pas || a.midi - b.midi);
    if (rejoue.map(cleNote).join(';') === voulu) return { pas: p, notes: motif };
  }
  return { pas: Math.min(128, Math.ceil(longueur / 16) * 16), notes: [...notes] };
}

/** Motif de batterie d'une section : frappes au pas, roulements (2, 3, 4, 6) quand plusieurs frappes tombent dans un pas. */
function motifBatterie(frappes: readonly NotePas[], debut: number, longueur: number): MotifBatterie | null {
  const cases = new Map<string, { pad: InstrumentBatterie; pas: number; vel: number; n: number }>();
  for (const f of frappes) {
    if (f.pas < debut - 1 / 48 || f.pas >= debut + longueur - 1 / 48) continue;
    const pas = Math.max(0, Math.floor(f.pas - debut + 1 / 48));
    const pad = padDeNote(f.midi);
    const cle = `${pad}|${pas}`;
    const c = cases.get(cle);
    if (c) c.n++;
    else cases.set(cle, { pad, pas, vel: f.vel, n: 1 });
  }
  if (cases.size === 0) return null;
  // Le motif le plus court qui se répète (même calcul que les notes, sur des frappes d'un pas).
  const notes: Note[] = [...cases.values()].map((c) => ({ pas: c.pas, duree: 1, midi: INSTR.indexOf(c.pad) * 8 + Math.min(c.n, 7), vel: c.vel }));
  const court = plusCourtMotif(notes.sort((a, b) => a.pas - b.pas || a.midi - b.midi), longueur);
  const motif: MotifBatterie = { type: 'batterie', pas: court.pas, pistes: {} };
  for (const n of court.notes) {
    const pad = INSTR[Math.floor(n.midi / 8)]!;
    const roul = n.midi % 8;
    (motif.pistes[pad] ??= new Array<number>(court.pas).fill(0))[n.pas] = n.vel;
    if (roul >= 2) {
      const r = roul >= 5 ? 6 : roul;
      (((motif.roulements ??= {})[pad] ??= new Array<number>(court.pas).fill(0)))[n.pas] = r;
    }
  }
  return motif;
}
const INSTR: InstrumentBatterie[] = ['kick', 'snare', 'clap', 'charley', 'charleyOuvert', 'rim', 'cowbell', 'perc', 'perso1', 'perso2', 'perso3', 'perso4'];

export function importerMidi(octets: Uint8Array, m: Morceau): ResultatImportMidi {
  const smf = lireSmf(octets);
  const avertissements: string[] = [];
  const pasParTick = 4 / smf.division;
  const vers = (n: NoteSmf): NotePas => {
    const pas = g24(n.debut * pasParTick);
    return { pas, fin: Math.max(pas + 1 / 24, g24(n.fin * pasParTick)), midi: n.midi, vel: Math.max(0.1, Math.round((n.vel / 127) * 1000) / 1000) };
  };
  if (smf.notes.length === 0) throw new ErreurOcka(T.aucuneNote, 'midi_illisible');

  // Tempo et mesure.
  const us = smf.tempos[0]?.usParNoire ?? 500_000;
  const brut = 60_000_000 / us;
  const tempo = Math.min(200, Math.max(60, Math.round(brut)));
  if (Math.abs(tempo - brut) > 0.5) avertissements.push(T.tempoBorne(Math.round(brut), tempo));
  if (new Set(smf.tempos.map((t) => t.usParNoire)).size > 1) avertissements.push(T.tempoChange);
  if (smf.mesures.some((x) => x.num !== 4 || x.den !== 4)) avertissements.push(T.pasEn44);

  // Groupes : la batterie (canal 10), puis une piste par (piste MIDI, canal), dans l'ordre du fichier.
  const frappes: NotePas[] = [];
  const groupes = new Map<string, { piste: number; canal: number; notes: NotePas[] }>();
  for (const n of smf.notes) {
    if (n.canal === CANAL_BATTERIE) frappes.push(vers(n));
    else {
      const cle = `${n.piste}:${n.canal}`;
      let g = groupes.get(cle);
      if (!g) groupes.set(cle, (g = { piste: n.piste, canal: n.canal, notes: [] }));
      g.notes.push(vers(n));
    }
  }
  const place = PLAFONDS.pistesInstrument - pistesInstrument(m).length;
  const liste = [...groupes.values()];
  if (liste.length > place) avertissements.push(T.tropDePistes(liste.length - Math.max(0, place)));
  const gardes = liste.slice(0, Math.max(0, place));

  // Sections de 8 mesures.
  let fin = 1;
  for (const liste of [frappes, ...gardes.map((g) => g.notes)]) for (const n of liste) fin = Math.max(fin, n.pas + 1 / 24);
  const mesures = Math.ceil(fin / 16);
  const placeSections = Math.min(PLAFONDS.ordre, PLAFONDS.sections - m.sections.length);
  if (placeSections <= 0) throw new ErreurOcka(T.tropDeSections, 'midi_illisible');
  let nSections = Math.ceil(mesures / MESURES_SECTION);
  if (nSections > placeSections) {
    avertissements.push(T.coupe(placeSections * MESURES_SECTION));
    nSections = placeSections;
  }

  let x = m;
  const pris = new Set(idsPris(x));
  const nouvelId = (base: string) => {
    const id = idLibre(base, pris, 'midi');
    pris.add(id);
    return id;
  };
  const motifs = Object.assign(Object.create(null) as Morceau['motifs'], x.motifs);
  const sections: Section[] = [];
  for (let k = 0; k < nSections; k++) {
    const mes = Math.min(MESURES_SECTION, mesures - k * MESURES_SECTION);
    sections.push({ id: nouvelId(`midi-${k + 1}`), nom: T.section(k + 1), mesures: mes, motifs: Object.create(null) as Section['motifs'] });
  }
  const debutDe = (k: number) => k * MESURES_SECTION * 16;
  const placer = (idPiste: string, motifDe: (debut: number, longueur: number) => Motif | null) => {
    const vus = new Map<string, string>();
    sections.forEach((s, k) => {
      const motif = motifDe(debutDe(k), s.mesures * 16);
      if (!motif) return;
      const cle = JSON.stringify(motif);
      let id = vus.get(cle);
      if (!id) {
        id = nouvelId(`${idPiste}-midi`);
        vus.set(cle, id);
        motifs[id] = motif;
      }
      s.motifs[idPiste] = id;
    });
  };

  const pistes: string[] = [];
  if (frappes.length > 0) {
    placer('batterie', (d, l) => motifBatterie(frappes, d, l));
    pistes.push('batterie');
  }
  let tronquees = 0;
  for (const g of gardes) {
    const programme = smf.programmes.get(`${g.piste}:${g.canal}`) ?? [...smf.programmes].find(([c]) => c.endsWith(`:${g.canal}`))?.[1] ?? 0;
    const nom = smf.noms[g.piste] && [...groupes.values()].filter((y) => y.piste === g.piste).length === 1 ? smf.noms[g.piste] : undefined;
    const r = ajouterPiste(x, instrumentDuProgramme(programme), nom);
    if (!r) continue;
    x = r.m;
    pris.add(r.id);
    placer(r.id, (d, l) => {
      const notes = notesSection(g.notes, d, l);
      if (notes.length === 0) return null;
      if (notes.length > PLAFONDS.notesParMotifNotes) tronquees++;
      const court = plusCourtMotif(notes.slice(0, PLAFONDS.notesParMotifNotes), l);
      return { type: 'notes', pas: court.pas, notes: court.notes };
    });
    pistes.push(r.id);
  }
  if (tronquees > 0) avertissements.push(T.tropDeNotes);
  if (m.swing > 0) avertissements.push(T.swingRetire);
  return {
    m: { ...x, tempo, swing: 0, motifs, sections: [...x.sections, ...sections], ordre: sections.map((s) => s.id) },
    pistes,
    avertissements,
  };
}
