// Échantillonneur (M1, C1) : choix des zones, gain de vélocité, glissé, position de reprise, cache des zones (LRU).
import { describe, expect, it } from 'vitest';
import type { PcmSon, SourceZones, ZoneSource } from '../types-moteur';
import { CacheZones } from './cache-zones';
import { choisirZone, fichiersPour, gainNote, groupeExclusif, positionTampon, positionTamponBlocs, rampeGlisse, velMidi } from './zones';

const z = (racine: number, velBas: number, velHaut: number, cents = 0): ZoneSource => ({
  fichier: `z${racine}-${velBas}.ogg`,
  racine,
  cents,
  bas: racine - 1,
  haut: racine + 1,
  velBas,
  velHaut,
  gainDb: 0,
  debut: 0,
  fin: 48000,
});

// Zones tous les 3 demi-tons (comme la banque de BQ), deux couches de vélocité.
const source: SourceZones = {
  id: 'faux-piano@1',
  canaux: 1,
  gainDb: -6,
  relache: 0.3,
  budgetS: 60,
  zones: [48, 51, 54, 57, 60].flatMap((r) => [z(r, 1, 79, r === 60 ? 12 : 0), z(r, 80, 127)]),
  exclusif: [[42, 44, 46]],
};

describe('choix des zones', () => {
  it('note dans une zone : la zone qui la couvre, la bonne couche, detune = 100 × (midi − racine) − cents', () => {
    const c = choisirZone(source, 52, 0.5)!;
    expect(c.zone.racine).toBe(51);
    expect(c.zone.velHaut).toBe(79);
    expect(c.detune).toBe(100);
    const fort = choisirZone(source, 50, 1)!;
    expect([fort.zone.racine, fort.zone.velBas, fort.detune]).toEqual([51, 80, -100]);
    // Racine accordée 12 cents trop haut : on la redescend.
    expect(choisirZone(source, 60, 0.3)!.detune).toBe(-12);
  });

  it('couche : vel × 127 arrondi (0,62 → 79 : couche douce ; 0,63 → 80 : couche forte)', () => {
    expect(velMidi(0.62)).toBe(79);
    expect(velMidi(0.63)).toBe(80);
    expect(choisirZone(source, 57, 0.62)!.zone.velHaut).toBe(79);
    expect(choisirZone(source, 57, 0.63)!.zone.velBas).toBe(80);
    expect(velMidi(0)).toBe(1);
  });

  it('hors tessiture : la zone la plus proche (jamais muette)', () => {
    expect(choisirZone(source, 30, 1)!.zone.racine).toBe(48);
    expect(choisirZone(source, 30, 1)!.detune).toBe(-1800);
    expect(choisirZone(source, 90, 0.2)!.zone.racine).toBe(60);
    expect(choisirZone({ zones: [] }, 60, 1)).toBeNull();
  });

  it('detune toujours ≤ ±150 cents dans la tessiture (zones espacées de 3 demi-tons)', () => {
    for (let midi = 47; midi <= 61; midi++) for (const v of [0.2, 0.9]) expect(Math.abs(choisirZone(source, midi, v)!.detune)).toBeLessThanOrEqual(150);
  });

  it('seules les zones jouées sont à décoder', () => {
    const f = fichiersPour(source, [{ midi: 52, vel: 0.5 }, { midi: 51, vel: 0.4 }, { midi: 60, vel: 1 }]);
    expect([...f].sort()).toEqual(['z51-1.ogg', 'z60-80.ogg']);
  });

  it('gain = 10^(dB/20) × vel^1,6 ; groupes exclusifs', () => {
    expect(gainNote(source, { gainDb: 6 }, 1)).toBeCloseTo(1, 12);
    expect(gainNote(source, { gainDb: 0 }, 0.5)).toBeCloseTo(Math.pow(10, -6 / 20) * Math.pow(0.5, 1.6), 12);
    expect(groupeExclusif(source, 44)).toBe(0);
    expect(groupeExclusif(source, 36)).toBe(-1);
  });
});

describe('glissé et reprise', () => {
  it('le glissé occupe la fin de la note (0,12 s au plus, la moitié de la note au plus)', () => {
    expect(rampeGlisse(1)).toEqual({ debut: 0.88, fin: 1 });
    expect(rampeGlisse(0.1)).toEqual({ debut: 0.05, fin: 0.1 });
  });

  it('position dans le tampon : vitesse 2^(detune/1200), intégrée pendant le glissé', () => {
    expect(positionTampon(1, 0)).toBe(1);
    expect(positionTampon(1, 1200)).toBeCloseTo(2, 12);
    // Glissé d'une octave entre 0,5 et 1 s : ∫ 2^(t/0,5) dt de 0 à 0,5 = 0,5 / ln 2.
    const g = { debut: 0.5, fin: 1, cents: 1200 };
    expect(positionTampon(1, 0, g)).toBeCloseTo(0.5 + 0.5 / Math.LN2, 9);
    expect(positionTampon(1.5, 0, g)).toBeCloseTo(0.5 + 0.5 / Math.LN2 + 1, 9);
    // Intégrale numérique (vérification de la formule).
    let x = 0;
    for (let t = 0; t < 0.8; t += 1e-5) x += 1e-5 * Math.pow(2, (100 + (t > 0.5 ? (700 * (t - 0.5)) / 0.5 : 0)) / 1200);
    expect(positionTampon(0.8, 100, { debut: 0.5, fin: 1, cents: 700 })).toBeCloseTo(x, 4);
  });
});

describe('position de reprise comme Chrome la joue (detune k-rate, blocs de 128 trames)', () => {
  const g = { debut: 0.5, fin: 1, cents: 700 };
  it('sans glissé ni bend : vitesse constante', () => {
    expect(positionTamponBlocs(0.3, 0.8, 100, undefined, 128 / 48000)).toBe(positionTampon(0.8, 100));
  });
  it('blocs minuscules : l’intégrale continue ; vrais blocs : à moins d’un bloc près', () => {
    expect(positionTamponBlocs(0.1, 0.9, 100, g, 1e-6)).toBeCloseTo(positionTampon(0.9, 100, g), 5);
    expect(Math.abs(positionTamponBlocs(0.1, 0.9, 100, g, 128 / 48000) - positionTampon(0.9, 100, g))).toBeLessThan(128 / 48000);
  });
  it('pitch bend constant : comme un detune plus grand', () => {
    expect(positionTamponBlocs(0.2, 1.5, 0, undefined, 128 / 48000, () => 120)).toBeCloseTo(1.5 * Math.pow(2, 0.1), 9);
  });
});

describe('cache des zones décodées (budget, LRU, épingles)', () => {
  class FauxTampon {
    numberOfChannels: number;
    length: number;
    sampleRate: number;
    constructor(o: { numberOfChannels: number; length: number; sampleRate: number }) {
      [this.numberOfChannels, this.length, this.sampleRate] = [o.numberOfChannels, o.length, o.sampleRate];
    }
    copyToChannel() {}
  }
  (globalThis as unknown as { AudioBuffer: unknown }).AudioBuffer = FauxTampon;
  const pcm = (n: number): PcmSon => ({ frequence: 48000, canaux: [new Float32Array(n)] });

  it('ne jette jamais une zone épinglée ; jette les plus anciennes au-delà du budget ; un seul décodage par zone', async () => {
    const cache = new CacheZones(3 * 4000); // 3 zones de 1000 échantillons
    let lectures = 0;
    const lire = async () => (lectures++, pcm(1000));
    cache.epingler(['i|a']);
    await cache.obtenir(lire, 'i', 'a', 1000);
    await Promise.all([cache.obtenir(lire, 'i', 'b', 1000), cache.obtenir(lire, 'i', 'b', 1000)]);
    expect(lectures).toBe(2);
    await cache.obtenir(lire, 'i', 'c', 1000);
    await cache.obtenir(lire, 'i', 'd', 1000);
    expect(cache.lire('i|a')).toBeDefined(); // épinglée : gardée bien que la plus ancienne
    expect(cache.lire('i|b')).toBeUndefined(); // la plus ancienne non épinglée : jetée
    expect(cache.octets).toBeLessThanOrEqual(cache.plafond);
    cache.liberer(['i|a']);
    expect(cache.taille).toBe(3);
  });

  it('épinglées au-delà du budget : gardées (le pic le dit), puis rendues au budget dès qu’elles sont libérées', async () => {
    const cache = new CacheZones(4000);
    const cles = ['i|x', 'i|y'];
    cache.epingler(cles);
    for (const f of ['x', 'y']) await cache.obtenir(async () => pcm(1000), 'i', f, 1000);
    expect(cache.taille).toBe(2);
    expect(cache.pic).toBe(8000);
    cache.liberer(cles);
    expect(cache.octets).toBeLessThanOrEqual(4000);
  });

  it('coupe le tampon à `fin` (amorce ou fin de fichier en trop)', async () => {
    const cache = new CacheZones();
    const b = await cache.obtenir(async () => pcm(1200), 'i', 'e', 1000);
    expect(b.length).toBe(1000);
  });
});
