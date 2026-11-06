// Contrat C3 : la plomberie du registre des synthés, avec deux synthés de test ajoutés au registre (vi.mock) :
// « note » avec réglages (clé de cache et travail du Worker) et « motif » (un tampon par passage, slides, Worker).
import { describe, expect, it, vi } from 'vitest';
import type { DefinitionSynthe } from '../api-synthes';

vi.mock('./synthes/index', async (importOriginal) => {
  const vrai = await importOriginal<typeof import('./synthes/index')>();
  const commun = { nom: 'Test', famille: 'Synthés' as const, motsCles: ['test'], pret: true, relache: 0.1, tenu: false };
  const note: DefinitionSynthe = {
    ...commun,
    id: 'test-note',
    params: { brillance: { defaut: 0.5 } },
    mode: 'note',
    rendreNote: (midi, r) => ({ canaux: [new Float32Array(64).fill(midi + r.params.brillance!)] }),
  };
  const motif: DefinitionSynthe = {
    ...commun,
    id: 'test-motif',
    params: {},
    mode: 'motif',
    rendreMotif: (notes, duree) => [Float32Array.from({ length: Math.round(duree * 100) }, (_, i) => notes.filter((n) => n.t * 100 <= i).length)],
  };
  return { SYNTHES: [...vrai.SYNTHES, note, motif] };
});

// Le registre est déjà chargé par la préparation de Vitest (preparer-tests.ts) : on recharge les modules avec le faux.
vi.resetModules();
const { syntheOcka } = await import('../../morceau/acces');
const { normaliserMorceau } = await import('../../morceau/normaliser');
const { nouveauMorceau } = await import('../../morceau/styles');
const edition = await import('../../ui/edition/api-edition');
const { calculerPlanning } = await import('../planning');
const { besoins } = await import('../instruments/preparation');
const { executer } = await import('./travaux');
const { instrumentsSynthes } = await import('./registre-synthes');

function avecPiste(instrument: string, synthe?: { params: Record<string, number> }) {
  const r = edition.ajouterPiste(nouveauMorceau('trap', 'C3'), instrument)!;
  let m = r.m;
  const section = m.ordre[0]!;
  m = edition.ajouterNote(m, r.id, section, { pas: 0, duree: 2, midi: 48, vel: 0.9, glisse: true });
  m = edition.ajouterNote(m, r.id, section, { pas: 4, duree: 2, midi: 51, vel: 0.5 });
  if (synthe) m = { ...m, pistes: m.pistes.map((p) => (p.id === r.id ? { ...p, synthe } : p)) };
  return { m, id: r.id };
}

describe('plomberie des synthés (contrat C3)', () => {
  it('un synthé prêt est connu du normaliseur et du catalogue', () => {
    expect(syntheOcka('ocka-test-motif@1')).toBe('test-motif');
    expect(instrumentsSynthes().map((x) => x.id)).toEqual(expect.arrayContaining(['ocka-test-note@1', 'ocka-test-motif@1']));
    const { m } = avecPiste('ocka-test-note@1', { params: { brillance: 0.25 } });
    expect(normaliserMorceau(m).problemes).toEqual([]);
  });

  it('mode « note » : les réglages de la piste vont dans la clé du cache et dans le travail du Worker', () => {
    const { m, id } = avecPiste('ocka-test-note@1', { params: { brillance: 0.25 } });
    const evs = calculerPlanning(m).filter((e) => e.type === 'note' && e.piste === id);
    expect(evs.length).toBeGreaterThan(0);
    const d = [...besoins(m, evs, [], new Map(), 48000, 0, false).values()].filter((x) => x.cle.startsWith('n|'));
    expect(d.length).toBeGreaterThan(0);
    expect(d.every((x) => /^n\|test-note\|\|\d+\|/.test(x.cle))).toBe(true);
    const r = executer(d[0]!.travail(), 48000);
    expect(r.canaux[0]![0]).toBeCloseTo(48.25, 5);
    // Réglages par défaut : la clé d'avant (sans empreinte).
    const neutre = avecPiste('ocka-test-note@1');
    const cles = [...besoins(neutre.m, calculerPlanning(neutre.m), [], new Map(), 48000, 0, false).keys()];
    expect(cles).toContain('n|test-note||48');
  });

  it('mode « motif » : un événement par passage du motif, notes en secondes, slide vers la note suivante', () => {
    const { m, id } = avecPiste('ocka-test-motif@1');
    const plan = calculerPlanning(m);
    expect(plan.some((e) => e.type === 'note' && e.piste === id)).toBe(false);
    const passages = plan.filter((e) => e.type === 'motif' && e.piste === id);
    expect(passages.length).toBeGreaterThan(0);
    const p = passages[0]!;
    if (p.type !== 'motif') throw new Error('type');
    expect(p.notes.map((n) => n.midi)).toEqual([48, 51]);
    expect(p.notes[0]!.glisse).toBe(51);
    expect(p.notes[1]!.t).toBeCloseTo((4 * 60) / m.tempo / 4, 6);
    // Même passage → même clé ; le Worker rend tout le passage.
    expect(new Set(passages.map((x) => (x.type === 'motif' ? x.cle : ''))).size).toBe(1);
    const d = besoins(m, [p], [], new Map(), 48000, 0, false).get(`s|test-motif|${p.cle}`)!;
    const r = executer(d.travail(), 48000);
    expect(r.canaux[0]!.length).toBe(Math.round(p.duree * 100));
  });
});
