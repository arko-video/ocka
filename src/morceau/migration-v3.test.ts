// Migration /1 et /2 → /3 (contrat C0) : la mélodie devient la piste instrument « melodie » (même son, même tranche,
// même pan par défaut), un son de plus → « melodie-2 »…, rien d'autre ne bouge ; un vieil OCKA refuse un /3.
import { describe, expect, it } from 'vitest';
import { calculerPlanning, GAIN_NOTE } from '../moteur/planning';
import { idMotifDe, motifNotesDe, pistesInstrument } from './acces';
import { lireVersion, normaliserMorceau } from './normaliser';
import { Journal } from './normaliser-outils';
import { nouveauMorceau } from './styles';
import { arrangement, pasVersSecondes } from './temps';
import { FORMAT_MORCEAU, type Morceau } from './types';

const notesV2 = (decalage: number) => [
  { pas: 0, duree: 2, midi: 60 + decalage },
  { pas: 4, duree: 4, midi: 64 + decalage, vel: 0.5 },
  { pas: 8, duree: 8, midi: 67 + decalage },
];

/** Un morceau /2 avec trois sections de mélodie (piano, lead, piano) et un motif de mélodie jamais joué (pluck). */
function morceauV2(): Record<string, unknown> {
  const m = JSON.parse(JSON.stringify(nouveauMorceau('pop'))) as Record<string, any>;
  m.format = 'ocka.morceau/2';
  m.pistes = m.pistes.map((p: Record<string, unknown>) => (p.id === 'melodie' ? { id: 'melodie', volume: 0.6, pan: 0.4, muet: false, solo: true } : p));
  m.motifs['mel-a'] = { type: 'melodie', pas: 16, son: 'piano', notes: notesV2(0) };
  m.motifs['mel-b'] = { type: 'melodie', pas: 32, son: 'lead', notes: notesV2(2) };
  m.motifs['mel-c'] = { type: 'melodie', pas: 16, son: 'pluck', notes: notesV2(4) };
  m.sections[0].motifs.melodie = 'mel-a';
  m.sections[1].motifs.melodie = 'mel-b';
  m.sections[2].motifs.melodie = 'mel-a';
  return m;
}

/** Le planning tel que l'écoute le joue : (temps, durée, hauteur, gain, son) de chaque note, sans la piste. */
const notesJouees = (m: Morceau) =>
  calculerPlanning(m)
    .filter((e) => e.type === 'note')
    .map((e) => (e.type === 'note' ? [e.t, e.duree, e.midi, e.vel, e.son] : []));

describe('migration /2 → /3', () => {
  it('la mélodie devient la piste instrument « melodie » (même tranche), un autre son → « melodie-2 »', () => {
    const r = normaliserMorceau(morceauV2());
    expect(r.bloquant).toBe(false);
    const m = r.morceau;
    expect(m.format).toBe(FORMAT_MORCEAU);
    expect(m.pistes.map((p) => p.id)).toEqual(['batterie', 'basse', 'accords', 'melodie', 'melodie-2', 'sons', 'voix']);
    expect(pistesInstrument(m)).toEqual([
      { id: 'melodie', genre: 'instrument', nom: 'Mélodie', instrument: 'ocka-piano@1', volume: 0.6, pan: 0.4, muet: false, solo: true },
      // Chaîne 2 : le pan par défaut de la mélodie (+0,1, appliqué par le graphe à « melodie » seulement) est écrit.
      { id: 'melodie-2', genre: 'instrument', nom: 'Mélodie 2', instrument: 'ocka-lead@1', volume: 0.6, pan: 0.5, muet: false, solo: true },
    ]);
    expect(idMotifDe(m.sections[0], 'melodie')).toBe('mel-a');
    expect(idMotifDe(m.sections[1], 'melodie-2')).toBe('mel-b');
    expect(idMotifDe(m.sections[1], 'melodie')).toBeUndefined();
    expect(idMotifDe(m.sections[2], 'melodie')).toBe('mel-a');
    expect(motifNotesDe(m, m.sections[0]!, 'melodie')).toEqual({
      type: 'notes',
      pas: 16,
      notes: [
        { pas: 0, duree: 2, midi: 60, vel: 1 },
        { pas: 4, duree: 4, midi: 64, vel: 0.5 },
        { pas: 8, duree: 8, midi: 67, vel: 1 },
      ],
    });
    expect(m.motifs['mel-c']?.type).toBe('notes'); // jamais joué : gardé, sans piste
  });

  it('même son : le planning /3 joue exactement les notes du /2 (mêmes temps, gains et sons)', () => {
    const v2 = morceauV2() as Record<string, any>;
    const m = normaliserMorceau(v2).morceau;
    // Ce que jouait OCKA v1 (planifierMelodie de la phase 6) : la mélodie de chaque section, au son de son motif.
    const attendu: unknown[][] = [];
    for (const o of arrangement(m)) {
      const ref = v2.sections.find((s: { id: string }) => s.id === o.section.id).motifs.melodie;
      const mo = ref ? v2.motifs[ref] : null;
      if (!mo) continue;
      for (let cycle = 0; cycle * mo.pas < o.pas; cycle++) {
        for (const n of mo.notes) {
          const debut = cycle * mo.pas + n.pas;
          if (debut >= o.pas) break;
          const fin = Math.min(debut + Math.max(1, n.duree), cycle * mo.pas + mo.pas, o.pas);
          const t = pasVersSecondes(m, o.debutPas + debut);
          attendu.push([t, pasVersSecondes(m, o.debutPas + fin) - t, n.midi, GAIN_NOTE * (n.vel ?? 1), mo.son]);
        }
      }
    }
    attendu.sort((a, b) => (a[0] as number) - (b[0] as number));
    expect(attendu.length).toBeGreaterThan(20);
    expect(notesJouees(m)).toEqual(attendu);
  });

  it('sans mélodie jouée : une piste « melodie » au son du 1er motif ; sans motif : piano', () => {
    const a = morceauV2() as Record<string, any>;
    for (const s of a.sections) delete s.motifs.melodie;
    expect(pistesInstrument(normaliserMorceau(a).morceau).map((p) => [p.id, p.instrument])).toEqual([['melodie', 'ocka-piano@1']]);
    delete a.motifs['mel-a'];
    delete a.motifs['mel-b'];
    expect(pistesInstrument(normaliserMorceau(a).morceau).map((p) => [p.id, p.instrument])).toEqual([['melodie', 'ocka-pluck@1']]);
  });

  it('chaîne 1 (morceau des phases 0 et 1) : aucun pan ajouté à « melodie-2 »', () => {
    const v = morceauV2() as Record<string, any>;
    v.master = { preset: 'neutre', niveau: 'standard', chaine: 1 };
    const m = normaliserMorceau(v).morceau;
    expect(m.pistes.find((p) => p.id === 'melodie-2')?.pan).toBe(0.4);
  });

  it('version 1 : piste melodie (piano, 0,8) et sons ajoutées, chaîne 1', () => {
    const v1 = JSON.parse(JSON.stringify(nouveauMorceau('trap'))) as Record<string, any>;
    v1.format = 'ocka.morceau/1';
    v1.pistes = v1.pistes.filter((p: { id: string }) => p.id !== 'melodie' && p.id !== 'sons');
    delete v1.master.chaine;
    const r = normaliserMorceau(v1);
    expect(r.problemes).toEqual([]);
    expect(r.morceau.master.chaine).toBe(1);
    expect(pistesInstrument(r.morceau)).toEqual([{ id: 'melodie', genre: 'instrument', nom: 'Mélodie', instrument: 'ocka-piano@1', volume: 0.8, pan: 0, muet: false, solo: false }]);
  });

  it('idempotente : /2 → /3 → /3 donne le même morceau, sans problème la 2e fois', () => {
    const a = normaliserMorceau(morceauV2()).morceau;
    const b = normaliserMorceau(JSON.parse(JSON.stringify(a)));
    expect(b.problemes).toEqual([]);
    expect(b.morceau).toEqual(a);
  });

  it('un vieil OCKA (/2) refuse un /3 : sa règle « version > courante → bloquant »', () => {
    const journal = new Journal();
    expect(lireVersion(FORMAT_MORCEAU, 'ocka.morceau', 2, journal)).toBe(2);
    expect(journal.problemes[0]).toMatchObject({ chemin: 'format', niveau: 'bloquant' });
    expect(normaliserMorceau({ ...nouveauMorceau('trap'), format: 'ocka.morceau/4' }).bloquant).toBe(true);
  });

  it('IA ou vieux fichier : un motif « melodie » dans un /3 est lu comme un motif de notes', () => {
    const m = { ...nouveauMorceau('trap'), motifs: { ...nouveauMorceau('trap').motifs, ia: { type: 'melodie', pas: 16, son: 'lead', notes: notesV2(0) } } };
    m.sections = m.sections.map((s, i) => (i === 0 ? { ...s, motifs: { ...s.motifs, melodie: 'ia' } } : s));
    const r = normaliserMorceau(m);
    expect(r.morceau.motifs.ia?.type).toBe('notes');
    expect(idMotifDe(r.morceau.sections[0], 'melodie')).toBe('ia');
    expect(r.problemes.some((p) => p.chemin === 'motifs.ia.type' && p.niveau === 'corrige')).toBe(true);
  });
  it('sans « format » mais avec une mélodie /2 (fichier écrit à la main) : migré, son gardé', () => {
    const v2 = morceauV2() as Record<string, unknown>;
    delete v2.format;
    const m = normaliserMorceau(v2).morceau;
    expect(pistesInstrument(m).map((p) => p.instrument)).toEqual(['ocka-piano@1', 'ocka-lead@1']);
  });
});
