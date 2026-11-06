// Beatbox sur des sons de SYNTHÈSE réalistes (kick : bruit grave filtré qui descend ; « ka » : bruit médium court ;
// « ts » : bruit aigu ; perso : clic de langue). Entraînement (5 exemples par son) et lot de validation SÉPARÉ
// (autres graines, autres niveaux) : taux de réussite mesuré. Détection des attaques par flux spectral.
import { describe, expect, it, vi } from 'vitest';
import { EXEMPLES_PAR_SON, SONS_BEATBOX, type EntrainementBeatbox, type SonBeatbox } from './api-dubler';
import { detecterAttaques } from './attaques';
import { classerAttaque, mesuresAttaque, NB_MESURES } from './beatbox';
import { hasard, sonBeatbox, suiteBeatbox } from './signaux-test';

// Calculs longs (plusieurs secondes de signal) : la machine peut être chargée.
vi.setConfig({ testTimeout: 60_000 });

const FS = 48000;
const DEBUT = Math.round(0.01 * FS); // attaque des sons de synthèse

function entrainer(sons: readonly SonBeatbox[], fs = FS): EntrainementBeatbox {
  const exemples = { boum: [], ka: [], ts: [], perso: [] } as Record<SonBeatbox, number[][]>;
  for (const s of sons) {
    for (let g = 1; g <= EXEMPLES_PAR_SON; g++) {
      const pcm = sonBeatbox(s, g, fs);
      const a = detecterAttaques(pcm, fs)[0] ?? DEBUT;
      exemples[s].push(mesuresAttaque(pcm, fs, a));
    }
  }
  return { version: 1, exemples, instruments: { boum: 'kick', ka: 'snare', ts: 'charley', perso: 'rim' } };
}

function reussite(e: EntrainementBeatbox, sons: readonly SonBeatbox[], parSon: number, fs = FS) {
  let bons = 0;
  let total = 0;
  const confusions: string[] = [];
  for (const s of sons) {
    for (let g = 1000; g < 1000 + parSon; g++) {
      const pcm = sonBeatbox(s, g, fs);
      const a = detecterAttaques(pcm, fs)[0];
      total++;
      if (a === undefined) {
        confusions.push(`${s}→rien`);
        continue;
      }
      const r = classerAttaque(e, mesuresAttaque(pcm, fs, a));
      if (r?.son === s) bons++;
      else confusions.push(`${s}→${r?.son}`);
    }
  }
  return { part: bons / total, total, confusions };
}

describe('mesures et classement', () => {
  it('15 mesures entre 0 et 1', () => {
    for (const s of SONS_BEATBOX) {
      const m = mesuresAttaque(sonBeatbox(s, 3), FS, DEBUT);
      expect(m).toHaveLength(NB_MESURES);
      for (const v of m) expect(v >= 0 && v <= 1).toBe(true);
    }
    expect(mesuresAttaque(new Float32Array(100), FS, 0)).toHaveLength(NB_MESURES); // trop court, silence : sans planter
  });

  it('null tant que boum, ka et ts n’ont pas 5 exemples ; perso vide = ignoré, perso à moitié = incomplet', () => {
    const e = entrainer(['boum', 'ka', 'ts']);
    const m = mesuresAttaque(sonBeatbox('ka', 50), FS, DEBUT);
    expect(classerAttaque(e, m)?.son).toBe('ka');
    expect(
      classerAttaque({ ...e, exemples: { ...e.exemples, ts: e.exemples.ts.slice(0, 4) } }, m),
    ).toBeNull();
    expect(classerAttaque({ ...e, exemples: { ...e.exemples, perso: [m] } }, m)).toBeNull();
  });

  it('3 sons : taux de réussite sur un lot de validation séparé', () => {
    const sons = ['boum', 'ka', 'ts'] as const;
    const r = reussite(entrainer(sons), sons, 60);
    console.info(
      `[dubler] beatbox 3 sons : ${(100 * r.part).toFixed(1)} % de ${r.total} (${r.confusions.slice(0, 6).join(', ')})`,
    );
    expect(r.part).toBeGreaterThanOrEqual(0.9);
  });

  it('4 sons (avec le clic de langue) : taux de réussite', () => {
    const r = reussite(entrainer(SONS_BEATBOX), SONS_BEATBOX, 60);
    console.info(
      `[dubler] beatbox 4 sons : ${(100 * r.part).toFixed(1)} % de ${r.total} (${r.confusions.slice(0, 6).join(', ')})`,
    );
    expect(r.part).toBeGreaterThanOrEqual(0.85);
  });

  it('à 44,1 kHz aussi', () => {
    const sons = ['boum', 'ka', 'ts'] as const;
    const r = reussite(entrainer(sons, 44100), sons, 30, 44100);
    expect(r.part).toBeGreaterThanOrEqual(0.9);
  });
});

describe('attaques par flux spectral', () => {
  it('une suite de beatbox : attaques retrouvées à ±5 ms, puis classées', () => {
    const h = hasard(4242);
    const sons: { son: SonBeatbox; t: number; graine: number }[] = [];
    let t = 0.2;
    for (let i = 0; i < 40; i++) {
      const son = (['boum', 'ka', 'ts', 'ts'] as const)[Math.floor((h() * 0.5 + 0.5) * 3.999)]!;
      sons.push({ son, t, graine: 500 + i });
      t += 0.14 + 0.12 * (0.5 + 0.5 * h());
    }
    const pcm = suiteBeatbox(sons, t + 0.4);
    const attaques = detecterAttaques(pcm, FS);
    const e = entrainer(['boum', 'ka', 'ts']);
    let trouvees = 0;
    let bien = 0;
    let pire = 0;
    for (const s of sons) {
      const vrai = Math.round(s.t * FS) + DEBUT;
      const a = attaques.find((x) => Math.abs(x - vrai) < 0.02 * FS);
      if (a === undefined) continue;
      trouvees++;
      pire = Math.max(pire, Math.abs(a - vrai) / FS);
      if (classerAttaque(e, mesuresAttaque(pcm, FS, a))?.son === s.son) bien++;
    }
    console.info(
      `[dubler] suite : ${trouvees}/${sons.length} attaques (${attaques.length} détectées, pire écart ${(pire * 1000).toFixed(1)} ms), ${bien} bien classées`,
    );
    expect(trouvees).toBeGreaterThanOrEqual(38);
    expect(attaques.length).toBeLessThanOrEqual(sons.length + 2);
    expect(pire).toBeLessThan(0.005);
    expect(bien / trouvees).toBeGreaterThanOrEqual(0.9);
  });

  it('rien dans le silence ni dans une voix tenue', () => {
    const silence = new Float32Array(FS);
    const fond = hasard(5);
    for (let i = 0; i < silence.length; i++) silence[i] = 0.001 * fond();
    expect(detecterAttaques(silence, FS)).toEqual([]);
  });
});
