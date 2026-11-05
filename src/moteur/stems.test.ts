import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import type { Morceau } from '../morceau/types';
import { fenetreAB } from './ab';
import { courbeRadio, retardEcho } from './audio/effets-voix';
import { CODE_FLOTTANT, enTeteWavFlottant, RepartiteurPistes, tailleWavFlottant } from './audio/wav-flottant';
import { exporterPistes, nomPropre, pistesAttendues } from './stems';

describe('WAV 32 bits flottants (pistes séparées)', () => {
  it('en-tête : format 3, fmt de 18 octets, fact, tailles justes', () => {
    const t = enTeteWavFlottant(1000, 2, 44100);
    const v = new DataView(t.buffer);
    const txt = (p: number) => String.fromCharCode(...t.subarray(p, p + 4));
    expect(t.length).toBe(58);
    expect([txt(0), txt(8), txt(12), txt(38), txt(50)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'fact', 'data']);
    expect(v.getUint32(4, true)).toBe(tailleWavFlottant(1000, 2) - 8);
    expect(v.getUint32(16, true)).toBe(18);
    expect(v.getUint16(20, true)).toBe(CODE_FLOTTANT);
    expect([v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true)]).toEqual([2, 44100, 352800, 8, 32]);
    expect(v.getUint32(46, true)).toBe(1000);
    expect(v.getUint32(54, true)).toBe(8000);
  });

  it('répartiteur : une piste par puits, coupée à la bonne longueur, crêtes mesurées, ordre vérifié', async () => {
    const bloc = 4;
    const ecrits: number[][] = [[], []];
    const r = new RepartiteurPistes(2, bloc, 6, ecrits.map((e) => ({ ecrire: async (o: Uint8Array) => void e.push(...new Float32Array(o.slice().buffer)) })));
    // bloc 1 : piste 0 = 1..8, piste 1 = silence ; bloc 2 : piste 0 = −0,5 partout, piste 1 = 2 au début.
    const b1 = new Float32Array(16);
    for (let i = 0; i < 8; i++) b1[i] = (i + 1) / 10;
    const b2 = new Float32Array(16).fill(-0.5, 0, 8);
    b2[8] = 2;
    await r.ajouter(0, b1);
    await r.ajouter(4, b2);
    expect(ecrits[0]!.length).toBe(12); // 6 trames × 2 canaux
    expect(ecrits[0]!.slice(0, 8).map((x) => Math.round(x * 10))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ecrits[1]!.slice(8)).toEqual([2, 0, 0, 0]);
    expect(r.cretes[0]).toBeCloseTo(0.8, 6);
    expect(r.cretes[1]).toBe(2);
    expect(ecrits[1]!.length).toBe(12); // le silence du début est bien écrit… au premier son
    await expect(r.ajouter(4, b2)).rejects.toThrow();
  });

  it('répartiteur : une piste muette n’écrit rien', async () => {
    const ecrits: number[] = [];
    const r = new RepartiteurPistes(1, 4, 8, [{ ecrire: async (o: Uint8Array) => void ecrits.push(o.length) }]);
    await r.ajouter(0, new Float32Array(8));
    await r.ajouter(4, new Float32Array(8));
    expect(ecrits).toEqual([]);
    expect(r.cretes[0]).toBe(0);
  });

  it('noms de fichiers propres', () => {
    expect(nomPropre(' Mon/titre: "fou" ')).toBe('Montitre fou');
    expect(nomPropre('???')).toBe('morceau');
  });

  it('exporterPistes refuse un morceau invalide (avant tout rendu)', async () => {
    await expect(exporterPistes({ format: 'pas un morceau' } as unknown as Morceau)).rejects.toMatchObject({ code: 'morceau_invalide' });
  });
});

describe('A/B : 8 mesures du 1er refrain', () => {
  it('commence au 1er refrain, avec une mesure d’avance', () => {
    const m = nouveauMorceau('trap', 'AB');
    const f = fenetreAB(m);
    const mesure = (16 * 60) / m.tempo / 4;
    expect(f.duree).toBeCloseTo(8 * mesure, 6);
    expect(f.avant).toBeCloseTo(mesure, 6);
    expect(f.debut).toBeGreaterThan(0);
  });
  it('sans refrain : depuis le début ; morceau court : ce qu’il y a', () => {
    const m = nouveauMorceau('trap', 'AB');
    for (const s of m.sections) s.nom = 'Couplet';
    const f = fenetreAB(m);
    expect([f.debut, f.avant]).toEqual([0, 0]);
    m.ordre = m.ordre.slice(0, 1);
    m.sections[0]!.mesures = 2;
    m.ordre = [m.sections[0]!.id];
    expect(fenetreAB(m).duree).toBeCloseTo((2 * 16 * 60) / m.tempo / 4, 6);
  });
});

describe('effets de voix (calculs purs)', () => {
  it('écho : croche pointée (3/4 de temps), moins les 2 trames de retard des filtres', () => {
    expect(retardEcho(140, 44100) * 44100).toBeCloseTo(0.75 * (60 / 140) * 44100 - 2, 6);
    expect(retardEcho(90, 48000)).toBeCloseTo(0.5 - 2 / 48000, 9);
  });
  it('radio : courbe impaire, pente 1 au centre, plafonnée', () => {
    const c = courbeRadio(4097);
    expect(c[2048]).toBe(0);
    expect(c[0]).toBeCloseTo(-c[4096]!, 7);
    expect((c[2049]! - c[2047]!) / (2 / 4096) / 2).toBeCloseTo(1, 3);
    expect(Math.max(...c)).toBeLessThan(0.4 + 1e-6);
  });
});

describe('pistes séparées : place estimée', () => {
  it('compte les pistes qui peuvent jouer (pas les muettes, ni la mélodie absente)', () => {
    const m = nouveauMorceau('trap', 'Place');
    const base = pistesAttendues(m);
    expect(base).toBe(3); // batterie, basse, accords (pas de mélodie, de sons ni de voix)
    m.pistes.find((p) => p.id === 'basse')!.muet = true;
    expect(pistesAttendues(m)).toBe(2);
  });
});
