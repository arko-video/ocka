// Détecteur de la voix en direct (le même code que le worklet) : justesse de 80 à 1 000 Hz avec du bruit 20 dB
// sous la voix, latence de détection des modes grave et aigu, hystérésis (pas de va-et-vient sur un vibrato),
// calage et accords de la gamme.
import { describe, expect, it, vi } from 'vitest';
import type { ModeDetection } from './api-dubler';
import { accordChante, caler, classesGamme } from './calage';
import { DetecteurVoix, type EvenementNote, type ReglagesDetecteur } from './detecteur';
import { mesurerLatence } from './latence-detection';
import { voixSegments, type SegmentVoix } from './signaux-test';

// Calculs longs (plusieurs secondes de signal) : la machine peut être chargée.
vi.setConfig({ testTimeout: 60_000 });

const FS = 48000;
const reglages = (mode: ModeDetection, r: Partial<ReglagesDetecteur> = {}): ReglagesDetecteur => ({
  mode,
  calage: null,
  gamme: classesGamme({ tonique: 'A', mode: 'mineur' }),
  glisse: 0,
  accords: null,
  suivreVolume: true,
  decroissance: 0,
  ...r,
});

function analyser(pcm: Float32Array, r: ReglagesDetecteur) {
  const d = new DetecteurVoix(FS, r);
  d.journal = [];
  const evenements: EvenementNote[] = [];
  const sorties = {
    gain: new Float32Array(128),
    voix: [new Float32Array(128)],
    courbure: new Float32Array(128),
  };
  for (let i = 0; i + 128 <= pcm.length; i += 128) {
    d.traiter(pcm.subarray(i, i + 128), i, sorties);
    evenements.push(...d.evenements);
    d.evenements.length = 0;
  }
  return { journal: d.journal, evenements };
}

const enCents = (hz: number) => 6900 + 1200 * Math.log2(hz / 440);

/** Part des trames à ±50 cents, sur les trames dont toute l'analyse tombe dans une note tenue. */
function justesse(segments: SegmentVoix[], journal: { t: number; cents: number }[], marge: number) {
  let t0 = 0;
  let bonnes = 0;
  let total = 0;
  for (const s of segments) {
    if (s.hz !== null) {
      for (const tr of journal) {
        if (tr.t < t0 + marge || tr.t > t0 + s.duree - marge) continue;
        total++;
        if (Math.abs(tr.cents - enCents(s.hz)) <= 50) bonnes++;
      }
    }
    t0 += s.duree;
  }
  return { part: bonnes / total, total };
}

describe('justesse en direct (bruit 20 dB sous la voix)', () => {
  const hauteurs = Array.from({ length: 15 }, (_, i) => 80 * Math.pow(1000 / 80, i / 14));
  for (const mode of ['grave', 'aigu'] as const) {
    it(`mode ${mode} : au moins 95 % des trames à ±50 cents`, () => {
      const hz = mode === 'grave' ? hauteurs : hauteurs.filter((f) => f >= 140);
      const segments: SegmentVoix[] = hz.flatMap((f) => [
        { hz: null, duree: 0.15 },
        { hz: f, duree: 0.6 },
      ]);
      const pcm = voixSegments(segments, FS, 20);
      const { journal } = analyser(pcm, reglages(mode));
      const r = justesse(segments, journal, mode === 'grave' ? 0.03 : 0.015);
      console.info(`[dubler] justesse ${mode} : ${(100 * r.part).toFixed(1)} % de ${r.total} trames`);
      expect(r.part).toBeGreaterThanOrEqual(0.95);
    });
  }
  it('chaque hauteur, une par une (grave), au moins 90 % des trames', () => {
    for (const f of hauteurs) {
      const segments: SegmentVoix[] = [
        { hz: null, duree: 0.1 },
        { hz: f, duree: 0.5 },
      ];
      const r = justesse(segments, analyser(voixSegments(segments, FS, 20), reglages('grave')).journal, 0.03);
      expect(r.part, `${f.toFixed(0)} Hz`).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe('latence de détection', () => {
  for (const mode of ['grave', 'aigu'] as const) {
    it(`mode ${mode} : mesurée (changements de note et départs après un silence)`, () => {
      const l = mesurerLatence(mode);
      console.info(
        `[dubler] latence ${mode} : moyenne ${l.moyenneMs.toFixed(1)} ms, max ${l.maxMs.toFixed(1)} ms (${l.mesures} mesures)`,
      );
      expect(l.mesures).toBeGreaterThanOrEqual(8);
      expect(l.moyenneMs).toBeLessThan(mode === 'grave' ? 110 : 90);
    });
  }
  it("le début estimé d'une note est à moins de 20 ms du vrai début", () => {
    const segments: SegmentVoix[] = [
      { hz: null, duree: 0.3 },
      { hz: 220, duree: 0.4 },
      { hz: 330, duree: 0.4 },
      { hz: null, duree: 0.3 },
      { hz: 262, duree: 0.4 },
      { hz: null, duree: 0.2 },
    ];
    const { evenements } = analyser(voixSegments(segments, FS, 40), reglages('grave'));
    const notes = evenements.filter((e) => e.midi !== null);
    expect(notes.map((e) => e.midi)).toEqual([57, 64, 60]);
    [0.3, 0.7, 1.4].forEach((t, i) => expect(Math.abs(notes[i]!.debut / FS - t)).toBeLessThan(0.02));
    const silences = evenements.filter((e) => e.midi === null);
    expect(silences.length).toBe(2);
    expect(Math.abs(silences[0]!.debut / FS - 1.1)).toBeLessThan(0.03);
  });
});

describe('silences', () => {
  it('la même note rechantée après un silence bruité (porte restée ouverte) donne deux notes', () => {
    const segments: SegmentVoix[] = [
      { hz: null, duree: 0.2 },
      { hz: 220, duree: 0.5 },
      { hz: null, duree: 0.25 },
      { hz: 220, duree: 0.5 },
      { hz: null, duree: 0.2 },
    ];
    const pcm = voixSegments(segments, FS, 30); // bruit à ≈ −45 dBFS : la porte (fermeture à −50) reste ouverte
    const notes = analyser(pcm, reglages('grave')).evenements.filter((e) => e.midi !== null);
    expect(notes.map((e) => e.midi)).toEqual([57, 57]);
    expect(Math.abs(notes[1]!.debut / FS - 0.95)).toBeLessThan(0.03);
  });
});

describe('hystérésis', () => {
  for (const mode of ['grave', 'aigu'] as const) {
    it(`mode ${mode} : un vibrato de ±40 cents ne fait pas changer de note`, () => {
      for (const hz of [196, 220, 440]) {
        const segments: SegmentVoix[] = [
          { hz: null, duree: 0.2 },
          { hz, duree: 3, vibrato: 40, vibratoHz: 5.5 },
          { hz: null, duree: 0.3 },
        ];
        for (const calage of [null, classesGamme({ tonique: 'C', mode: 'majeur' })]) {
          const { evenements } = analyser(voixSegments(segments, FS, 25), reglages(mode, { calage }));
          expect(evenements.filter((e) => e.midi !== null).length, `${hz} Hz`).toBe(1);
        }
      }
    });
  }
  it('un saut de 50 cents tenu ne change pas la note ; 80 cents tenus, si', () => {
    const base = 220;
    const petit = voixSegments(
      [
        { hz: null, duree: 0.2 },
        { hz: base, duree: 0.5 },
        { hz: base * Math.pow(2, 50 / 1200), duree: 0.5 },
      ],
      FS,
      30,
    );
    expect(analyser(petit, reglages('grave')).evenements.filter((e) => e.midi !== null).length).toBe(1);
    const grand = voixSegments(
      [
        { hz: null, duree: 0.2 },
        { hz: base, duree: 0.5 },
        { hz: base * Math.pow(2, 80 / 1200), duree: 0.5 },
      ],
      FS,
      30,
    );
    expect(
      analyser(grand, reglages('grave'))
        .evenements.filter((e) => e.midi !== null)
        .map((e) => e.midi),
    ).toEqual([57, 58]);
  });
});

describe('calage, accords et signaux de contrôle', () => {
  it('calage sur la gamme ou chromatique', () => {
    const doMaj = classesGamme({ tonique: 'C', mode: 'majeur' });
    expect(caler(6140, null)).toBe(61); // do# chanté
    expect(caler(6140, doMaj)).toBe(62); // → ré (plus proche que do)
    expect(caler(6050, doMaj)).toBe(60); // égalité : la note du dessous
    expect(caler(6460, doMaj)).toBe(65);
  });
  it('accords de la gamme : triade et septième', () => {
    const t = { tonique: 'C', mode: 'majeur' } as const;
    expect(accordChante(60, t, 'triade')).toEqual([60, 64, 67]);
    expect(accordChante(62, t, 'triade')).toEqual([62, 65, 69]);
    expect(accordChante(71, t, 'triade')).toEqual([71, 74, 77]);
    expect(accordChante(67, t, 'septieme')).toEqual([67, 71, 74, 77]);
    expect(accordChante(57, { tonique: 'A', mode: 'mineur' }, 'septieme')).toEqual([57, 60, 64, 67]);
    expect(accordChante(61, t, 'triade')).toEqual([60, 64, 67]); // do# → ramené sur do
  });
  it('les sorties de contrôle : gain qui suit la voix, hauteurs des voix en cents, accords', () => {
    const pcm = voixSegments(
      [
        { hz: null, duree: 0.2 },
        { hz: 220, duree: 0.6 },
        { hz: null, duree: 0.4 },
      ],
      FS,
      40,
    );
    const d = new DetecteurVoix(FS, reglages('aigu', { accords: 'triade' }));
    const s = {
      gain: new Float32Array(128),
      voix: [0, 1, 2].map(() => new Float32Array(128)),
      courbure: new Float32Array(128),
    };
    let gainMax = 0;
    let pendant: number[] = [];
    for (let i = 0; i + 128 <= pcm.length; i += 128) {
      d.traiter(pcm.subarray(i, i + 128), i, s);
      gainMax = Math.max(gainMax, s.gain[127]!);
      if (i / FS > 0.6 && i / FS < 0.65) pendant = s.voix.map((v) => v[127]!);
    }
    expect(gainMax).toBeGreaterThan(0.5);
    expect(s.gain[127]).toBeLessThan(0.01); // porte refermée
    expect(pendant).toEqual([5700, 6000, 6400]); // la mineur : la, do, mi
  });
});
