import { describe, expect, it } from 'vitest';
import { calculerAlignement, dureeMesure, placerPrise } from './alignement';
import { verifierReglages } from './reglages-micro';

describe('alignement d’une prise', () => {
  it('debutCoupe = heure de l’ancre − heure du 1er échantillon ; decalage = latence', () => {
    // Capture commencée à l’échantillon 480 000 (10 s), ancre jouée à 11,764 s, latence 42 ms.
    const a = calculerAlignement({ heureAncre: 11.764, premierFrame: 480000, frequence: 48000, echantillons: 48000 * 5, latence: 0.042 });
    expect(a.debutCoupe).toBeCloseTo(1.764, 9);
    expect(a.decalage).toBe(0.042);
    expect(a.duree).toBe(5);
    expect(a.finCoupe).toBe(5);
  });

  it('un son chanté pile sur l’ancre (entendu avec la latence) retombe pile sur l’ancre', () => {
    const fe = 44100;
    const premierFrame = 1234567;
    const heureAncre = 30.5;
    const latence = 0.0371;
    const a = calculerAlignement({ heureAncre, premierFrame, frequence: fe, echantillons: fe * 8, latence });
    // Le micro capte le son à heureAncre + latence : sa place dans le fichier…
    const x = heureAncre + latence - premierFrame / fe;
    // … et la convention le replace au temps debutAncre (ici 12 s) + (x − debutCoupe) − decalage.
    expect(12 + (x - a.debutCoupe) - a.decalage).toBeCloseTo(12, 9);
  });

  it('capture commencée après l’ancre : même placement, report sur le décalage', () => {
    const a = calculerAlignement({ heureAncre: 10, premierFrame: 48000 * 10.2, frequence: 48000, echantillons: 48000, latence: 0.05 });
    expect(a.debutCoupe).toBe(0);
    expect(a.decalage).toBeCloseTo(-0.15, 9);
  });

  it('placerPrise : rien n’est joué avant l’ancre', () => {
    const p = placerPrise({ debutCoupe: 1.7, finCoupe: 9, decalage: 0.04 }, 20);
    expect(p.quand).toBeCloseTo(20, 9);
    expect(p.depuis).toBeCloseTo(1.74, 9);
    expect(p.jusqua).toBe(9);
  });

  it('une mesure de 4/4 à 140 BPM dure 1,714 s', () => {
    expect(dureeMesure(140)).toBeCloseTo(1.7142857, 6);
  });
});

describe('réglages du micro', () => {
  it('rien à dire si tout est désactivé', () => {
    expect(verifierReglages({ echoCancellation: false, noiseSuppression: false, autoGainControl: false })).toEqual([]);
  });
  it('un avertissement en français par réglage resté actif', () => {
    const a = verifierReglages({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    expect(a).toHaveLength(3);
    expect(a[0]).toMatch(/écho/);
  });
});
