// Normaliseur /3 (contrat C0) : pistes instrument, tranches (inserts, sidechain, automation, LFO), ajouts C2/C3,
// idempotence, « __proto__ », plafonds, ids hostiles, instrument inconnu, grille du 1/24 de pas.
import { describe, expect, it } from 'vitest';
import { calculerPlanning } from '../moteur/planning';
import { declarerInstruments, idMotifDe, pistesInstrument } from './acces';
import { normaliserMorceau } from './normaliser';
import { nouveauMorceau } from './styles';
import { IDS_FIXES, PLAFONDS, type MotifNotes, type PisteInstrument } from './types';

/** Normalise deux fois (après un aller-retour JSON) : même morceau ; la 2e fois aucun problème (hors conseils). */
function idempotent(brut: unknown) {
  const a = normaliserMorceau(brut);
  const b = normaliserMorceau(JSON.parse(JSON.stringify(a.morceau)));
  expect(b.problemes.filter((p) => p.niveau !== 'conseil')).toEqual([]);
  expect(b.morceau).toEqual(a.morceau);
  expect(JSON.stringify(b.morceau)).toBe(JSON.stringify(a.morceau));
  return a;
}

const piste = (id: unknown, plus: Record<string, unknown> = {}) => ({ id, genre: 'instrument', nom: `P ${String(id)}`, instrument: 'ocka-lead@1', volume: 0.7, pan: 0, muet: false, solo: false, ...plus });

/** Un morceau /3 qui utilise TOUS les champs du format (jusqu'à C3). */
function complet(): Record<string, any> {
  const m = JSON.parse(JSON.stringify(nouveauMorceau('trap'))) as Record<string, any>;
  m.motifs.n1 = { type: 'notes', pas: 32, notes: [{ pas: 0.5, duree: 1.25, midi: 62, vel: 0.8, glisse: true }, { pas: 4, duree: 2, midi: 65, vel: 1 }] };
  m.pistes.splice(4, 0, piste('lead', {
    synthe: { params: { coupure: 0.4, resonance: 0.9 }, onde: Array.from({ length: 32 }, (_, i) => Math.sin(i / 5)) },
    swing: 0.2,
    inserts: [{ id: 'eq1', type: 'eq', actif: true, params: { grave: -3, freqAigu: 9000 } }, { id: 'comp', type: 'compresseur', actif: false, params: { seuil: -20 } }],
    sidechain: { source: 'kick', force: 0.7, relache: 0.2 },
    lfo: [{ cible: { type: 'insert', insert: 'eq1', param: 'grave' }, forme: 'triangle', periode: 8, profondeur: 0.3, phase: 0.25 }],
    auto: [{ cible: { type: 'volume' }, sections: { refrain: [{ pas: 0, valeur: 0.2 }, { pas: 64, valeur: 1, forme: 'palier' }] } }],
  }));
  m.sections[1].motifs.lead = 'n1';
  m.sections[2].perf = [{ type: 'stutter', pas: 120, duree: 8, division: 8, pistes: ['batterie', 'lead'] }, { type: 'tape-stop', pas: 0, duree: 4 }];
  m.marqueurs = [{ id: 'drop', nom: 'Drop', ancre: { section: 'refrain', occurrence: 1, mesure: 0 } }];
  m.soundfonts = [{ id: 'gm', nom: 'Ma SF2', fichier: 'sf2-gm.sf2', taille: 1000, sha256: 'a'.repeat(64) }];
  m.sons = [{ id: 'k', nom: 'Kick', fichier: 'son-k.f32', frequence: 48000, duree: 1, canaux: 1, recette: { type: 'kick', hauteur: 45, depart: 300, chute: 0.05, duree: 0.8, claquement: 0.6, saturation: 0.2 }, tranches: [{ debut: 0.5, fin: 1 }, { debut: 0, fin: 0.5 }] }];
  m.pads = { perso1: 'k' };
  m.tranchesPads = { perso1: 1 };
  m.prises = [{ id: 'p', ancre: { section: 'couplet', occurrence: 0, mesure: 0 }, tempo: 140, fichier: 'prise-p.f32', frequence: 48000, duree: 10, debutCoupe: 0, finCoupe: 10, decalage: 0, gain: 1, choisie: true,
    autotune: { gamme: { tonique: 'F', mode: 'mineur' }, vitesse: 30, force: 0.9, humaniser: 0.4, formants: -2, preset: 'pop', notes: [{ debut: 1, fin: 1.5, midi: 65, cents: -10, vibrato: 0.5 }] } }];
  return m;
}

describe('normaliseur /3', () => {
  it('un morceau qui utilise tout le format /3 ressort tel quel, sans problème', () => {
    const r = idempotent(complet());
    expect(r.problemes.filter((p) => p.niveau !== 'conseil')).toEqual([]);
    const lead = r.morceau.pistes.find((p) => p.id === 'lead') as PisteInstrument;
    expect(lead.inserts?.map((x) => x.id)).toEqual(['eq1', 'comp']);
    expect(lead.auto?.[0]?.sections.refrain).toHaveLength(2);
    expect(r.morceau.pistes.map((p) => p.id)).toEqual(['batterie', 'basse', 'accords', 'melodie', 'lead', 'sons', 'voix']);
    expect(r.morceau.prises[0]!.autotune?.preset).toBe('pop');
    expect(r.morceau.sons![0]!.tranches).toEqual([{ debut: 0, fin: 0.5 }, { debut: 0.5, fin: 1 }]);
  });

  it('un preset de SoundFont du morceau est connu (pas de conseil) ; celui d’une autre SoundFont en a un', () => {
    const m = complet();
    m.pistes.splice(4, 0, piste('sfa', { instrument: 'sf2-gm-0-24@1' }), piste('sfb', { instrument: 'sf2-autre-0-24@1' }));
    const r = idempotent(m);
    const conseils = r.problemes.filter((p) => p.niveau === 'conseil').map((p) => p.message).join('\n');
    expect(conseils).not.toContain('sf2-gm-0-24@1');
    expect(conseils).toContain('sf2-autre-0-24@1');
  });

  it('nouveaux champs du fichier : jamais plus que les plafonds (constantes exportées)', () => {
    const m = complet();
    m.pistes = [...m.pistes, ...Array.from({ length: 30 }, (_, i) => piste(`x${i}`))];
    const lead = m.pistes.find((p: { id: string }) => p.id === 'lead');
    lead.inserts = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, type: 'filtre', actif: true, params: {} }));
    lead.lfo = Array.from({ length: 5 }, () => ({ cible: { type: 'pan' }, forme: 'sinus', periode: 4, profondeur: 1, phase: 0 }));
    lead.auto = Array.from({ length: 12 }, () => ({ cible: { type: 'volume' }, sections: { refrain: Array.from({ length: 100 }, (_, k) => ({ pas: k, valeur: 0.5 })) } }));
    m.motifs.n1.notes = Array.from({ length: 3000 }, (_, k) => ({ pas: k % 32, duree: 1, midi: 30 + (k % 80), vel: 1 }));
    m.marqueurs = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, nom: 'M', ancre: { section: 'intro', occurrence: 0, mesure: 0 } }));
    m.sections[2].perf = Array.from({ length: 20 }, () => ({ type: 'gate', pas: 0, duree: 4 }));
    const r = idempotent(m);
    const l = r.morceau.pistes.find((p) => p.id === 'lead') as PisteInstrument;
    expect(pistesInstrument(r.morceau)).toHaveLength(PLAFONDS.pistesInstrument);
    expect(l.inserts).toHaveLength(PLAFONDS.inserts);
    expect(l.lfo).toHaveLength(PLAFONDS.lfo);
    expect(l.auto).toHaveLength(PLAFONDS.courbes);
    expect(l.auto![0]!.sections.refrain).toHaveLength(PLAFONDS.pointsParCourbe);
    expect((r.morceau.motifs.n1 as MotifNotes).notes.length).toBeLessThanOrEqual(PLAFONDS.notesParMotifNotes);
    expect(r.morceau.marqueurs).toHaveLength(PLAFONDS.marqueurs);
    expect(r.morceau.sections[2]!.perf).toHaveLength(PLAFONDS.perfParSection);
  });

  it('« __proto__ » partout : aucune pollution, dictionnaires sans prototype', () => {
    const texte = JSON.stringify(complet()).replace('"sections":[', '"sections":[{"id":"z","nom":"Z","mesures":1,"motifs":{"__proto__":"n1","constructor":"n1","lead":"n1"}},');
    const brut = JSON.parse(texte);
    brut.pistes.push(JSON.parse('{"id":"__proto__","genre":"instrument","nom":"x","instrument":"ocka-pluck@1"}'));
    brut.pistes.find((p: { id: string }) => p.id === 'lead').inserts[0].params = JSON.parse('{"__proto__": 3, "grave": 2}');
    const r = idempotent(brut);
    const z = r.morceau.sections[0]!;
    expect(Object.getPrototypeOf(z.motifs)).toBeNull();
    // La piste « __proto__ » est renommée (piste-3) et la référence la suit ; « constructor » ne vise aucune piste.
    expect(Object.keys(z.motifs)).toEqual(['piste-3', 'lead']);
    const ids = r.morceau.pistes.map((p) => p.id);
    expect(ids).not.toContain('__proto__');
    expect(ids).toContain('piste-3');
    expect(({} as Record<string, unknown>).grave).toBeUndefined();
    expect(({} as Record<string, unknown>).lead).toBeUndefined();
  });

  it('ids hostiles : une piste instrument ne prend jamais un id fixe ; doublons renommés, références suivies', () => {
    const m = complet();
    m.pistes.push(piste('batterie'), piste('voix'), piste('lead'), piste('a b é'), piste(42));
    m.sections[0].motifs = { 'a b é': 'n1', 42: 'n1', batterie: 'bat-intro' };
    const r = idempotent(m);
    const ids = pistesInstrument(r.morceau).map((p) => p.id);
    for (const id of ids) expect(IDS_FIXES as readonly string[]).not.toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['melodie', 'lead', 'batterie-2', 'voix-2', 'lead-2', 'a-b-e', '42']);
    expect(idMotifDe(r.morceau.sections[0], 'a-b-e')).toBe('n1');
    expect(idMotifDe(r.morceau.sections[0], '42')).toBe('n1');
    expect(idMotifDe(r.morceau.sections[0], 'batterie')).toBe('bat-intro');
  });

  it('instrument inconnu bien écrit : gardé avec un conseil ; mal écrit : remplacé par ocka-piano@1', () => {
    const m = complet();
    m.pistes.push(piste('a', { instrument: 'vcsl-marimba@1' }), piste('b', { instrument: '../../evil.js' }), piste('c', { instrument: 42 }), piste('d', { instrument: 'sf2-autre-0-24@1' }));
    const r = normaliserMorceau(m);
    const instr = Object.fromEntries(pistesInstrument(r.morceau).map((p) => [p.id, p.instrument]));
    expect(instr).toMatchObject({ a: 'vcsl-marimba@1', b: 'ocka-piano@1', c: 'ocka-piano@1', d: 'sf2-autre-0-24@1' });
    expect(r.problemes.filter((p) => p.niveau === 'conseil').map((p) => p.chemin)).toEqual(expect.arrayContaining([expect.stringMatching(/instrument$/)]));
    expect(r.problemes.filter((p) => p.niveau === 'corrige' && p.chemin.endsWith('instrument'))).toHaveLength(2);
    // Déclaré par la banque (BQ, au démarrage) : plus de conseil.
    declarerInstruments(['vcsl-marimba@1', 'sf2-autre-0-24@1']);
    expect(normaliserMorceau(r.morceau).problemes.filter((p) => p.niveau === 'conseil')).toEqual([]);
  });

  it('instrument inconnu : muet (son null au planning), les pistes « ocka-<son>@1 » jouent', () => {
    const m = normaliserMorceau(complet()).morceau;
    m.pistes = m.pistes.map((p) => (p.id === 'lead' ? { ...p, instrument: 'vcsl-marimba@1' } : p));
    const notes = calculerPlanning(m).filter((e) => e.type === 'note');
    expect(notes.filter((e) => e.type === 'note' && e.piste === 'lead').every((e) => e.type === 'note' && e.son === null)).toBe(true);
    expect(notes.some((e) => e.type === 'note' && e.piste === 'lead')).toBe(true);
  });

  it('grille du 1/24 de pas : notes, points d’automation et effets de performance arrondis', () => {
    const m = complet();
    m.motifs.n1.notes = [{ pas: 0.51, duree: 0.004, midi: 61.6, vel: 0.01 }, { pas: 1 / 3, duree: 2 / 3, midi: 70, vel: 1 }, { pas: 31.99, duree: 5, midi: 72, vel: 1 }];
    m.pistes.find((p: { id: string }) => p.id === 'lead').auto[0].sections.refrain = [{ pas: 1.01, valeur: 2 }];
    m.sections[2].perf = [{ type: 'gate', pas: 2.02, duree: 3.97, division: 5 }];
    const r = idempotent(m);
    expect((r.morceau.motifs.n1 as MotifNotes).notes).toEqual([
      { pas: 1 / 3, duree: 2 / 3, midi: 70, vel: 1 },
      { pas: 0.5, duree: 1 / 24, midi: 62, vel: 0.1 },
      { pas: 31 + 23 / 24, duree: 1 / 24, midi: 72, vel: 1 },
    ]);
    for (const n of (r.morceau.motifs.n1 as MotifNotes).notes) for (const x of [n.pas, n.duree]) expect(Math.abs(x * 24 - Math.round(x * 24))).toBeLessThan(1e-9);
    const lead = r.morceau.pistes.find((p) => p.id === 'lead') as PisteInstrument;
    expect(lead.auto![0]!.sections.refrain).toEqual([{ pas: 1, valeur: 1 }]);
    expect(r.morceau.sections[2]!.perf).toEqual([{ type: 'gate', pas: 2, duree: 95 / 24, division: 4 }]);
    expect(r.problemes.some((p) => /1\/24/.test(p.message))).toBe(true);
  });

  it('références cassées : motif d’un mauvais type, cible d’automation absente, découpe de pad impossible', () => {
    const m = complet();
    m.sections[0].motifs.lead = 'bat-intro';
    const lead = m.pistes.find((p: { id: string }) => p.id === 'lead');
    lead.lfo = [{ cible: { type: 'insert', insert: 'absent', param: 'grave' } }, { cible: { type: 'hauteur' }, forme: 'carre' }];
    m.pistes.find((p: { id: string }) => p.id === 'basse').lfo = [{ cible: { type: 'hauteur' } }];
    m.tranchesPads = { perso1: 7, perso2: 0 };
    const r = idempotent(m);
    expect(idMotifDe(r.morceau.sections[0], 'lead')).toBeUndefined();
    expect((r.morceau.pistes.find((p) => p.id === 'lead') as PisteInstrument).lfo).toEqual([{ cible: { type: 'hauteur' }, forme: 'carre', periode: 16, profondeur: 0.5, phase: 0 }]);
    expect(r.morceau.pistes.find((p) => p.id === 'basse')!.lfo).toBeUndefined();
    expect(r.morceau.tranchesPads).toBeUndefined();
  });
});
