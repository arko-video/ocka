import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from './normaliser';
import { MAX_PROBLEMES } from './normaliser-outils';
import { nouveauMorceau } from './styles';
import { FORMAT_MORCEAU, PLAFONDS, STYLES, type MotifBatterie, type MotifNotes, type PisteFixe } from './types';

/** Un morceau de la phase 1, tel qu'il est rangé sur le téléphone (version 1, 4 pistes, sans chaîne, avec « album »). */
function morceauV1(): Record<string, unknown> {
  const m = structuredClone(nouveauMorceau('trap')) as unknown as Record<string, unknown>;
  m.format = 'ocka.morceau/1';
  m.pistes = (m.pistes as { id: string }[]).filter((p) => !['melodie', 'sons'].includes(p.id));
  m.master = { preset: 'chaud', niveau: 'fort' };
  m.album = 'vieux';
  return m;
}

const prise = (id: unknown, fichier: unknown, section = 'couplet') => ({
  id, ancre: { section, occurrence: 0, mesure: 0 }, tempo: 140, fichier, frequence: 48000, duree: 4, debutCoupe: 0, finCoupe: 4, decalage: 0, gain: 1, choisie: false,
});
const son = (id: unknown, fichier: unknown, duree = 10) => ({ id, nom: 'Son', fichier, frequence: 48000, duree, canaux: 2 });

/** Normalise deux fois (la 2e fois après un aller-retour JSON, comme IndexedDB ou un fichier) : même morceau, aucun problème. */
function idempotent(brut: unknown) {
  const a = normaliserMorceau(brut);
  const b = normaliserMorceau(JSON.parse(JSON.stringify(a.morceau)));
  expect(b.problemes).toEqual([]);
  expect(b.morceau).toEqual(a.morceau);
  expect(JSON.stringify(b.morceau)).toBe(JSON.stringify(a.morceau));
  return a;
}

describe('format 2 (puis 3) : lecture des morceaux de la phase 1', () => {
  it('v1 → v3 : piste instrument melodie (piano, 0,8 ; 0) et piste sons ajoutées, chaîne 1, « album » oublié, rien d’autre ne change', () => {
    const v1 = morceauV1();
    const r = normaliserMorceau(v1);
    expect(r.problemes).toEqual([]);
    const m = r.morceau;
    expect(m.format).toBe(FORMAT_MORCEAU);
    expect(m.master).toEqual({ preset: 'chaud', niveau: 'fort', chaine: 1 });
    expect('album' in m).toBe(false);
    expect(m.pistes.map((p) => p.id)).toEqual(['batterie', 'basse', 'accords', 'melodie', 'sons', 'voix']);
    expect(m.pistes.find((p) => p.id === 'melodie')).toEqual({ id: 'melodie', genre: 'instrument', nom: 'Mélodie', instrument: 'ocka-piano@1', volume: 0.8, pan: 0, muet: false, solo: false });
    expect(m.pistes.find((p) => p.id === 'sons')).toEqual({ id: 'sons', volume: 0.8, pan: 0, muet: false, solo: false });
    expect(m.pistes.filter((p) => !['melodie', 'sons'].includes(p.id))).toEqual(v1.pistes);
    expect({ ...m.motifs }).toEqual(v1.motifs);
    expect(m.sections).toEqual(v1.sections);
    expect('sons' in m || 'pads' in m || 'infos' in m).toBe(false);
    idempotent(v1);
  });
  it('un vieil onglet de la phase 1 refuse la version 2 (sa règle : version > 1 → bloquant)', () => {
    const regleV1 = (format: string) => /^ocka\.morceau\/(\d+)$/.test(format) && Number(format.split('/')[1]) > 1;
    expect(regleV1(nouveauMorceau('trap').format)).toBe(true);
    expect(normaliserMorceau({ ...nouveauMorceau('trap'), format: 'ocka.morceau/4' }).problemes[0]?.niveau).toBe('bloquant');
  });
  it('nouveauMorceau : version 3, chaîne 2, déjà normalisé, pour les 6 styles', () => {
    for (const s of STYLES) {
      const m = nouveauMorceau(s);
      expect(m.format).toBe('ocka.morceau/3');
      expect(m.master.chaine).toBe(2);
      expect(m.kit).toBe(`${s}@1`);
      const r = normaliserMorceau(m);
      expect(r.problemes).toEqual([]);
      expect(r.morceau).toEqual(m);
    }
  });
  it('chaîne : absente en version 2 → 2 ; valeur fausse corrigée', () => {
    const m = { ...nouveauMorceau('drill'), master: { preset: 'neutre', niveau: 'standard' } };
    expect(normaliserMorceau(m).morceau.master.chaine).toBe(2);
    expect(normaliserMorceau({ ...m, master: { chaine: 7 } }).morceau.master.chaine).toBe(2);
    expect(normaliserMorceau({ ...morceauV1(), master: { chaine: 2 } }).morceau.master.chaine).toBe(2);
  });
});

describe('ajouts de la version 2', () => {
  it('motif de notes (/3) : longueur ≤ 128, notes bornées, triées, sans doublon, vélocité écrite', () => {
    const notes = [{ pas: 140, duree: 9, midi: 200 }, { pas: 0, duree: 2, midi: 60, vel: 3 }, { pas: 0, duree: 4, midi: 60 }, { pas: 4, duree: 1, midi: 55.4 }];
    const r = idempotent({ ...nouveauMorceau('trap'), motifs: { ...nouveauMorceau('trap').motifs, m: { type: 'notes', pas: 200, notes } } });
    const mel = r.morceau.motifs.m as MotifNotes;
    expect(mel.pas).toBe(128);
    expect(mel.notes).toEqual([{ pas: 0, duree: 2, midi: 60, vel: 1 }, { pas: 4, duree: 1, midi: 55, vel: 1 }, { pas: 127 + 23 / 24, duree: 1 / 24, midi: 120, vel: 1 }]);
  });
  it('sections : motif de mélodie référencé, boucle vers un son existant (mesures 1/2/4/8)', () => {
    const base = nouveauMorceau('lofi');
    const sections = base.sections.map((s, i) => (i === 0 ? { ...s, motifs: { ...s.motifs, melodie: 'm' }, boucle: { son: 'mon son', mesures: 3 } } : i === 1 ? { ...s, boucle: { son: 'absent', mesures: 4, caler: false } } : s));
    const r = idempotent({ ...base, motifs: { ...base.motifs, m: { type: 'melodie', pas: 16, notes: [], son: 'pluck' } }, sons: [son('mon son', 'son-a1.f32')], sections });
    expect(r.morceau.sons![0]!.id).toBe('mon-son');
    expect(r.morceau.sections[0]!.motifs.melodie).toBe('m');
    expect(r.morceau.sections[0]!.boucle).toEqual({ son: 'mon-son', mesures: 2, caler: true });
    expect(r.morceau.sections[1]!.boucle).toBeUndefined();
  });
  it('sons et pads : clé de fichier vérifiée, 120 s au total, pads vers des sons existants', () => {
    const sons = [son('a', 'son-a.f32', 100), son('b', '../../ocka-prises/prise-x.f32'), son('c', 'prise-c.f32'), son('d', 'son-d.f32', 30), son('e', 'son-e.f32', 20)];
    const pads = JSON.parse('{"perso1": "a", "perso2": "b", "perso3": "e", "perso9": "a", "__proto__": "a"}');
    const r = idempotent({ ...nouveauMorceau('trap'), sons, pads });
    expect(r.morceau.sons!.map((s) => s.id)).toEqual(['a', 'e']);
    expect(r.morceau.pads).toEqual({ perso1: 'a', perso3: 'e' });
  });
  it('effets de voix (voix seulement), autotune au dixième', () => {
    const pistes = [{ id: 'voix', volume: 1, pan: 0, muet: false, solo: false, effets: { reverbe: 2, echo: 0.3, radio: 'oui', autotune: 0.66, bruit: 1 } }, { id: 'basse', volume: 1, pan: 0, muet: false, solo: false, effets: { echo: 1 } }];
    const r = idempotent({ ...nouveauMorceau('trap'), pistes });
    expect((r.morceau.pistes.find((p) => p.id === 'voix') as PisteFixe).effets).toEqual({ reverbe: 1, echo: 0.3, radio: true, autotune: 0.7 });
    expect((r.morceau.pistes.find((p) => p.id === 'basse') as PisteFixe).effets).toBeUndefined();
  });
  it('infos du titre : langue, crédits, ISRC, IA', () => {
    const infos = { explicite: 'oui', langue: 'PT_br', credits: [{ nom: '  Romain Dupont ', role: 'compositeur' }, { nom: '', role: 'auteur' }, { nom: 'X', role: 'DJ' }], featuring: ' Léa ', isrc: 'fr-ab1-24-00001', ia: { musique: 'aide' } };
    const r = idempotent({ ...nouveauMorceau('trap'), infos });
    expect(r.morceau.infos).toEqual({ explicite: true, langue: 'pt-br', credits: [{ nom: 'Romain Dupont', role: 'compositeur' }, { nom: 'X', role: 'auteur' }], featuring: 'Léa', isrc: 'FRAB12400001', ia: { paroles: 'aucune', musique: 'aide', voix: 'aucune' } });
    expect(normaliserMorceau({ ...nouveauMorceau('trap'), infos: { isrc: 'pas un isrc', langue: 'instrumental' } }).morceau.infos).toEqual({ langue: 'instrumental' });
  });
});

describe('durcissement', () => {
  it('__proto__ : aucune pollution, dictionnaire sans prototype, ids réservés renommés', () => {
    const texte = `{"motifs": {"__proto__": {"type": "batterie", "pas": 16, "pistes": {"kick": [1]}},
      "constructor": {"type": "batterie", "pas": 16, "pistes": {}, "roulements": {"__proto__": [2], "toString": [3]}}},
      "sections": [{"id": "__proto__", "nom": "A", "mesures": 2, "motifs": {"batterie": "__proto__"}}],
      "ordre": ["__proto__", "constructor"], "pads": {"__proto__": "x"}}`;
    const r = idempotent(texte);
    const m = r.morceau;
    expect(Object.getPrototypeOf(m.motifs)).toBeNull();
    expect(Object.keys(m.motifs)).toEqual(['motif-1', 'motif-2']);
    expect((m.motifs['motif-2'] as MotifBatterie).roulements).toEqual({});
    expect(Object.getPrototypeOf((m.motifs['motif-2'] as MotifBatterie).roulements)).toBe(Object.prototype);
    expect(m.sections[0]!.id).toBe('section-1');
    expect(m.sections[0]!.motifs.batterie).toBe('motif-1');
    expect(m.ordre).toEqual(['section-1']);
    expect(({} as Record<string, unknown>).type).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'pas')).toBe(false);
  });
  it('ids hostiles : corrigés, dédoublonnés, références suivies', () => {
    const base = nouveauMorceau('trap');
    const sections = [
      { id: 'a b', nom: 'A', mesures: 2, motifs: { batterie: 'Mon motif é' } },
      { id: 'a-b', nom: 'B', mesures: 2, motifs: {} },
      { id: 42, nom: 'C', mesures: 2, motifs: {} },
      { id: 'x'.repeat(60), nom: 'D', mesures: 2, motifs: {} },
      { id: 'a b', nom: 'E', mesures: 2, motifs: {} },
    ];
    const prises = [prise('p', 'prise-1.f32', 'a b'), prise('p', 'prise-2.f32', 'a-b'), prise('p 3', 'prise-3.f32', '42'), prise('z', '../secret', 'a-b'), prise('y', 'prise-4.f32/../../x', 'a-b')];
    const r = idempotent({ ...base, motifs: { 'Mon motif é': base.motifs['bat-intro'] }, sections, ordre: ['a b', 'a-b', '42', 'x'.repeat(60), 'zzz'], prises });
    const m = r.morceau;
    expect(m.sections.map((s) => s.id)).toEqual(['a-b', 'a-b-2', '42', 'x'.repeat(40), 'a-b-3']);
    expect(Object.keys(m.motifs)).toEqual(['Mon-motif-e']);
    expect(m.sections[0]!.motifs.batterie).toBe('Mon-motif-e');
    expect(m.ordre).toEqual(['a-b', 'a-b-2', '42', 'x'.repeat(40)]);
    expect(m.prises.map((p) => [p.id, p.ancre.section, p.fichier])).toEqual([['p', 'a-b', 'prise-1.f32'], ['p-2', 'a-b-2', 'prise-2.f32'], ['p-3', '42', 'prise-3.f32']]);
  });
  it('plafonds : motifs, sections, ordre, notes, prises, sons', () => {
    const motifs: Record<string, unknown> = {};
    for (let i = 0; i < PLAFONDS.motifs + 20; i++) motifs[`b${i}`] = { type: 'basse', pas: 16, notes: Array.from({ length: 600 }, (_, k) => ({ pas: k % 16, duree: 1, degre: 0 })) };
    const sections = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, nom: 'S', mesures: 1, motifs: {} }));
    const r = idempotent({
      motifs,
      sections,
      ordre: Array.from({ length: 300 }, () => 's0'),
      prises: Array.from({ length: 250 }, (_, i) => prise(`p${i}`, `prise-${i}.f32`, 's0')),
      sons: Array.from({ length: 20 }, (_, i) => son(`n${i}`, `son-${i}.f32`, 1)),
    });
    const m = r.morceau;
    expect(Object.keys(m.motifs)).toHaveLength(PLAFONDS.motifs);
    expect(m.motifs.b0?.type === 'basse' && m.motifs.b0.notes.length).toBe(PLAFONDS.notesParMotif);
    expect(m.sections).toHaveLength(PLAFONDS.sections);
    expect(m.ordre).toHaveLength(PLAFONDS.ordre);
    expect(m.prises).toHaveLength(PLAFONDS.prises);
    expect(m.sons).toHaveLength(PLAFONDS.sons);
  });
  it('journal plafonné (un fichier hostile ne produit pas des millions de messages), bloquant toujours noté', () => {
    const bizarre: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) bizarre[`cle${i}`] = i;
    const r = normaliserMorceau({ ...bizarre, format: 'ocka.morceau/9' });
    expect(r.problemes.length).toBeLessThanOrEqual(MAX_PROBLEMES + 3);
    expect(r.bloquant).toBe(true);
  });
  it('textes : caractères de contrôle retirés, messages courts même pour une valeur énorme', () => {
    const r = idempotent({ ...nouveauMorceau('trap'), titre: 'Nuit\u0000\u0007 noire', style: 'x'.repeat(100000) });
    expect(r.morceau.titre).toBe('Nuit noire');
    expect(Math.max(...r.problemes.map((p) => p.message.length))).toBeLessThan(300);
  });
});
