import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { motifDe, motifNotesDe, pistesInstrument, sectionDe } from '../morceau/acces';
import { normaliserMorceau } from '../morceau/normaliser';
import type { Morceau, MotifBatterie } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { exempleMorceau } from '../ui/edition/exemple';
import { poserNotesAccord } from '../ui/edition/notes';
import { arpeger, gratter, humaniser } from '../ui/edition/outils-notes';
import { ajouterPiste } from '../ui/edition/pistes';
import { exporterMidi, importerMidi } from './midi';
import { instrumentDuProgramme, padDeNote, programmeDe } from './gm';
import { ecrireSmf } from './smf-ecriture';
import { lireSmf, PLAFONDS_MIDI } from './smf-lecture';

const neuf = () => normaliserMorceau(exempleMorceau()).morceau;
const sain = (m: Morceau) => expect(normaliserMorceau(JSON.parse(JSON.stringify(m))).problemes).toEqual([]);
const illisible = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurOcka);
    expect((e as ErreurOcka).code).toBe('midi_illisible');
    return;
  }
  throw new Error('aucune erreur');
};

/** Notes de chaque piste d'un .mid, par nom de piste : [début, fin, midi, vélocité, canal]. */
function parNom(octets: Uint8Array): Record<string, number[][]> {
  const smf = lireSmf(octets);
  const r: Record<string, number[][]> = {};
  for (const n of smf.notes) (r[smf.noms[n.piste] || `#${n.piste}`] ??= []).push([n.debut, n.fin, n.midi, n.vel, n.canal === 9 ? 9 : 0]);
  for (const k in r) r[k]!.sort((a, b) => a[0]! - b[0]! || a[2]! - b[2]! || a[1]! - b[1]!);
  return r;
}

/** Un morceau riche : batterie (fill, drop), 808, accords, et 2 pistes instrument (arpège, strum, humaniser). */
function morceauRiche(): Morceau {
  let m = neuf();
  const a = ajouterPiste(m, 'vsco-cordes@1', 'Cordes')!;
  m = poserNotesAccord(a.m, a.id, 'couplet', 0, 8, [60, 64, 67], 0.8);
  m = poserNotesAccord(m, a.id, 'couplet', 16, 8, [57, 60, 64], 0.7);
  m = gratter(m, a.id, 'couplet', null, { sens: 'haut', etalement: 25 });
  m = arpeger(m, a.id, 'couplet', [0, 1, 2], { sens: 'haut-bas', vitesse: 2 / 3, octaves: 2, tenue: 0.7, graine: 1 });
  const b = ajouterPiste(m, 'ocka-lead@1', 'Lead')!;
  m = poserNotesAccord(b.m, b.id, 'refrain', 3 + 1 / 3, 1.5, [72], 0.9);
  m = poserNotesAccord(m, b.id, 'refrain', 9, 5, [74, 79], 0.6);
  m = humaniser(m, b.id, 'refrain', null, { timing: 1, velocite: 1, graine: 9 });
  return m;
}

describe('fichiers .mid : aller-retour', () => {
  it('OCKA → .mid → OCKA → .mid : les mêmes notes, piste par piste (noms gardés)', () => {
    const m = morceauRiche();
    const octets = exporterMidi(m);
    const smf = lireSmf(octets);
    expect(smf.format).toBe(1);
    expect(smf.division).toBe(96);
    expect(Math.round(60_000_000 / smf.tempos[0]!.usParNoire)).toBe(m.tempo);
    const avant = parNom(octets);
    expect(Object.keys(avant).sort()).toEqual(['808', 'Accords', 'Batterie', 'Cordes', 'Lead']);
    const r = importerMidi(octets, neuf());
    sain(r.m);
    expect(r.m.tempo).toBe(m.tempo);
    expect(r.pistes[0]).toBe('batterie');
    expect(pistesInstrument(r.m).map((p) => p.nom)).toEqual(['808', 'Accords', 'Cordes', 'Lead']);
    expect(parNom(exporterMidi(r.m))).toEqual(avant);
  });
  it('sections de 8 mesures, motifs les plus courts et dédoublonnés', () => {
    const r = importerMidi(exporterMidi(morceauRiche()), neuf());
    const sections = r.m.ordre.map((id) => sectionDe(r.m, id)!);
    expect(sections.map((s) => s.mesures)).toEqual([8, 8, 8, 8, 8]); // 4 + 8 + 8 + 8 + 8 + 4 = 40 mesures
    const accords = pistesInstrument(r.m).find((p) => p.nom === 'Accords')!;
    const motifs = new Set(sections.map((s) => s.motifs[accords.id]).filter(Boolean));
    expect(motifs.size).toBeLessThanOrEqual(2);
    for (const s of sections) {
      const motif = motifNotesDe(r.m, s, accords.id);
      if (motif) expect(motif.pas).toBeLessThan(128);
    }
  });
  it('drums : canal 10, notes GM, roulements relus', () => {
    let m = neuf();
    const bat = motifDe(m, 'intro', 'batterie') as MotifBatterie;
    const pistes = { ...bat.pistes, perc: Array<number>(16).fill(0).map((_, i) => (i === 6 ? 0.5 : 0)) };
    const roulements = { charley: Array<number>(16).fill(0).map((_, i) => (i === 3 ? 3 : i === 7 ? 6 : 0)) };
    m = { ...m, motifs: Object.assign(Object.create(null), m.motifs, { 'bat-intro': { ...bat, pistes: { ...pistes, charley: Array<number>(16).fill(0.7) }, roulements } }) };
    const octets = exporterMidi(m);
    const r = importerMidi(octets, neuf());
    const relu = motifDe(r.m, r.m.ordre[0]!, 'batterie') as MotifBatterie;
    expect(relu.roulements?.charley?.[3]).toBe(3);
    expect(relu.roulements?.charley?.[7]).toBe(6);
    expect(relu.pistes.perc?.[6]).toBeCloseTo(0.5, 2);
    expect(parNom(exporterMidi(r.m)).Batterie).toEqual(parNom(octets).Batterie);
    expect(padDeNote(35)).toBe('kick');
    expect(padDeNote(44)).toBe('charley');
    expect(padDeNote(49)).toBe('charleyOuvert');
    expect(padDeNote(81)).toBe('perc');
  });
  it('programmes GM ↔ instruments', () => {
    expect(instrumentDuProgramme(33)).toBe('karoryfer-basse@1');
    expect(instrumentDuProgramme(0)).toBe('vcsl-piano-queue@1');
    expect(instrumentDuProgramme(999)).toBe('ocka-pluck@1');
    for (let p = 0; p < 128; p++) {
      const i = instrumentDuProgramme(p);
      if (!i.startsWith('ocka-')) expect(instrumentDuProgramme(programmeDe(i))).toBe(i);
    }
    expect(programmeDe('sf2-abc-0-42@1')).toBe(42);
    expect(programmeDe('inconnu-truc@1')).toBe(0);
  });
  it('type 0 : un seul bloc, une piste OCKA par canal', () => {
    const octets = ecrireSmf(
      [
        { nom: 'A', canal: 0, programme: 40, notes: [{ debut: 0, fin: 96, midi: 60, vel: 100 }] },
        { nom: 'B', canal: 3, programme: 73, notes: [{ debut: 48, fin: 72, midi: 72, vel: 50 }] },
        { nom: 'D', canal: 9, notes: [{ debut: 0, fin: 12, midi: 36, vel: 120 }] },
      ],
      { division: 96, tempo: 128, format: 0 },
    );
    expect(lireSmf(octets).format).toBe(0);
    const r = importerMidi(octets, neuf());
    expect(pistesInstrument(r.m).map((p) => p.instrument).slice(-2)).toEqual(['vsco-violon@1', 'vsco-flute@1']);
    expect(r.pistes).toContain('batterie');
    expect(r.m.tempo).toBe(128);
    sain(r.m);
  });
});

describe('.mid fabriqué par un outil connu (mido 1.3.2)', () => {
  const octets = new Uint8Array(readFileSync(decodeURIComponent(new URL('./fixtures/mido-exemple.mid', import.meta.url).pathname)));
  it('lu : tempo 90 (le 2e ignoré), noms, programmes, batterie, motifs partagés', () => {
    const r = importerMidi(octets, neuf());
    sain(r.m);
    expect(r.m.tempo).toBe(90);
    expect(r.avertissements.some((a) => a.includes('premier'))).toBe(true);
    const pistes = pistesInstrument(r.m).slice(-2);
    expect(pistes.map((p) => [p.nom, p.instrument])).toEqual([
      ['Basse Mido', 'karoryfer-basse@1'],
      ['Piano Mido', 'vcsl-piano-queue@1'],
    ]);
    const [s1, s2] = r.m.ordre.map((id) => sectionDe(r.m, id)!);
    expect([s1!.mesures, s2!.mesures]).toEqual([8, 4]);
    const basse = pistes[0]!.id;
    expect(s1!.motifs[basse]).toBe(s2!.motifs[basse]);
    expect(motifNotesDe(r.m, s1!, basse)).toEqual({ type: 'notes', pas: 16, notes: [36, 43, 41, 43].map((midi, k) => ({ pas: k * 4, duree: 2, midi, vel: 0.787 })) });
    expect(motifNotesDe(r.m, s2!, pistes[1]!.id)!.notes.map((n) => n.midi)).toEqual([62, 65, 69]);
    const bat = motifDe(r.m, s1!, 'batterie') as MotifBatterie;
    expect(bat.pas).toBe(16);
    expect(bat.pistes.kick!.map((v) => (v > 0 ? 1 : 0))).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(bat.pistes.snare![4]).toBeGreaterThan(0);
    expect(bat.pistes.charley!.filter((v) => v > 0)).toHaveLength(8);
  });
});

describe('fichier hostile : refusé proprement', () => {
  const bon = exporterMidi(morceauRiche());
  it('cas connus', () => {
    illisible(() => lireSmf(new Uint8Array([1, 2, 3])));
    illisible(() => lireSmf(new TextEncoder().encode('MThd pas un vrai fichier MIDI du tout')));
    illisible(() => lireSmf(bon.slice(0, 30))); // coupé
    const smpte = bon.slice();
    smpte[12] = 0xe7;
    illisible(() => lireSmf(smpte));
    const longueur = bon.slice();
    longueur[18] = 0x7f; // bloc plus long que le fichier
    illisible(() => lireSmf(longueur));
    illisible(() => lireSmf(new Uint8Array(PLAFONDS_MIDI.taille + 1)));
    // Nombre à longueur variable sans fin, statut courant sans statut d'avant.
    const piste = (corps: number[]) => new Uint8Array([...bon.slice(0, 14), 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, corps.length, ...corps]);
    illisible(() => lireSmf(piste([0xff, 0xff, 0xff, 0xff, 0x7f])));
    illisible(() => lireSmf(piste([0, 0x3c, 0x40])));
    illisible(() => lireSmf(piste([0, 0xff, 0x03, 0x7f, 0x41])));
    // Trop de pistes.
    const vide = [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 4, 0, 0xff, 0x2f, 0];
    illisible(() => lireSmf(new Uint8Array([...bon.slice(0, 14), ...Array.from({ length: 257 }, () => vide).flat()])));
    // Sans note.
    illisible(() => importerMidi(new Uint8Array([...bon.slice(0, 14), ...vide]), neuf()));
  });
  it('octets abîmés au hasard : une ErreurOcka ou un morceau sain, jamais autre chose', () => {
    let graine = 12345;
    const hasard = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let essai = 0; essai < 300; essai++) {
      const x = bon.slice(0, 14 + Math.floor(hasard() * (bon.length - 14)) + 1);
      for (let k = 0; k < 4; k++) x[Math.floor(hasard() * x.length)] = Math.floor(hasard() * 256);
      try {
        const r = importerMidi(x, neuf());
        expect(normaliserMorceau(JSON.parse(JSON.stringify(r.m))).problemes).toEqual([]);
      } catch (e) {
        expect(e).toBeInstanceOf(ErreurOcka);
      }
    }
  });
});
