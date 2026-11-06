// Tests purs (Node) des effets de M2 : DSP JS, inserts par défaut et préréglages, sidechain, automation, programme.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../../morceau/normaliser';
import { nouveauMorceau } from '../../morceau/styles';
import { dureePas } from '../../morceau/temps';
import { TYPES_EFFETS, type Morceau, type Piste } from '../../morceau/types';
import { valeurCible, valeurReelle } from '../automation';
import { gainsSidechain, tempsKicks } from '../sidechain';
import { BitFlux, CompFlux, rattrapageDb } from './dsp';
import { insertParDefaut, presetsInserts, traiterInsertsJs } from './inserts';
import { sourceGrille } from './programme';

const FS = 48000;
const sinus = (n: number, a: number, f = 1000) => Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / FS));
const crete = (x: Float32Array, de = 0) => x.subarray(de).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const db = (x: number) => 20 * Math.log10(x);

function avecPiste(m: Morceau, id: string, plus: Partial<Piste>): Morceau {
  return { ...m, pistes: m.pistes.map((p) => (p.id === id ? ({ ...p, ...plus } as Piste) : p)) };
}

describe('DSP JS (compresseur, bitcrusher)', () => {
  it('compresseur : courbe statique à ±0,5 dB sous et au-dessus du seuil, rattrapage compensé', () => {
    const p = { seuil: -18, ratio: 4, attaque: 1, relache: 50, genou: 0, mix: 1 };
    const r = rattrapageDb(-18, 4);
    for (const niveau of [-40, -30, -12, -6, 0]) {
      const g = sinus(FS, Math.pow(10, niveau / 20));
      const d = g.slice();
      new CompFlux(FS, p).traiter(g, d, g.length);
      const sortie = db(crete(g, FS / 2));
      const attendu = niveau <= -18 ? niveau + r : -18 + (niveau + 18) / 4 + r;
      expect(Math.abs(sortie - attendu)).toBeLessThan(0.5);
    }
  });

  it('bitcrusher : quantification et tenue calées sur la trame du morceau (même résultat par blocs)', () => {
    const x = sinus(4096, 0.7, 440);
    const un = [x.slice(), x.slice()];
    new BitFlux({ bits: 4, reduction: 5, mix: 1 }).traiter(un[0]!, un[1]!, 4096, 1000);
    const blocs = [x.slice(), x.slice()];
    const b = new BitFlux({ bits: 4, reduction: 5, mix: 1 });
    for (let i = 0; i < 4096; i += 128) b.traiter(blocs[0]!.subarray(i, i + 128), blocs[1]!.subarray(i, i + 128), 128, 1000 + i);
    expect(blocs[0]).toEqual(un[0]);
    // Tenue : la trame du morceau k = 1000 + i est un multiple de 5 → nouvel échantillon, quantifié sur 8 niveaux.
    expect(un[0]![0]).toBe(Math.round(x[0]! * 8) / 8);
    expect(un[0]![4]).toBe(un[0]![0]);
    expect(un[0]![5]).toBe(Math.round(x[5]! * 8) / 8);
  });

  it('traiterInsertsJs ignore les inserts natifs et inactifs', () => {
    const g = sinus(1000, 0.5);
    const c = [g.slice(), g.slice()];
    traiterInsertsJs(c, FS, [insertParDefaut('eq', 'a'), { ...insertParDefaut('bitcrusher', 'b'), actif: false }]);
    expect(c[0]).toEqual(g);
  });
});

describe('inserts par défaut et préréglages', () => {
  it('chaque type et chaque préréglage passe le normaliseur sans problème', () => {
    const base = nouveauMorceau('trap', 'T');
    const listes = [TYPES_EFFETS.map((t, i) => insertParDefaut(t, `fx-${i}`)).slice(0, 6), ...presetsInserts().map((p) => p.inserts)];
    for (const inserts of listes) {
      const r = normaliserMorceau(avecPiste(base, 'basse', { inserts }));
      expect(r.problemes).toEqual([]);
    }
    expect(presetsInserts().length).toBeGreaterThanOrEqual(6);
  });
});

describe('sidechain', () => {
  it('le gain tombe à 1 − force sur chaque kick et remonte à 1', () => {
    const m = avecPiste(nouveauMorceau('trap', 'T'), 'basse', { sidechain: { source: 'kick', force: 0.75, relache: 0.15 } });
    const kicks = tempsKicks(m);
    expect(kicks.length).toBeGreaterThan(4);
    const pts = gainsSidechain(m, 'basse', 0, 8);
    for (const t of kicks.filter((k) => k < 7.5)) {
      const bas = pts.find((p) => Math.abs(p.t - (t + 0.002)) < 1e-9);
      expect(bas?.gain).toBeCloseTo(0.25, 9);
    }
    expect(gainsSidechain(m, 'accords', 0, 8)).toEqual([]);
  });
});

describe('automation et LFO', () => {
  it('courbe par section, palier, LFO calé sur le temps du morceau', () => {
    const m0 = nouveauMorceau('trap', 'T');
    const s = m0.ordre[0]!;
    const sections = Object.create(null);
    sections[s] = [{ pas: 0, valeur: 0 }, { pas: 16, valeur: 1, forme: 'palier' }, { pas: 32, valeur: 0.5 }];
    const m = avecPiste(m0, 'accords', {
      auto: [{ cible: { type: 'volume' }, sections }],
      lfo: [{ cible: { type: 'pan' }, forme: 'sinus', periode: 16, profondeur: 1, phase: 0 }],
    });
    const dp = dureePas(m.tempo);
    expect(valeurCible(m, 'accords', { type: 'volume' }, 8 * dp)).toBeCloseTo(0.5, 9);
    expect(valeurCible(m, 'accords', { type: 'volume' }, 24 * dp)).toBe(1);
    expect(valeurCible(m, 'accords', { type: 'pan' }, 4 * dp)).toBeCloseTo(1, 9); // quart de période : sommet
    expect(valeurCible(m, 'accords', { type: 'hauteur' }, 0)).toBeNull();
    expect(valeurReelle(m.pistes[0]!, { type: 'pan' }, 0.75)).toBeCloseTo(0.5, 9);
  });

  it('la ligne programmée ne dépend pas des fenêtres (sources de grille)', () => {
    const f = (t: number) => Math.sin(2 * Math.PI * 3 * t);
    const s = sourceGrille(f);
    for (const t of [0.0137, 1.23456, 2.5]) {
      const autour = s.points(t - 0.02, t + 0.02);
      const g = autour.filter((p) => p.t <= t).pop()!;
      const d = autour.find((p) => p.t > t)!;
      expect(s.valeur(t)).toBeCloseTo(g.v + ((d.v - g.v) * (t - g.t)) / (d.t - g.t), 12);
    }
  });
});
