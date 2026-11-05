import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import { dureePas } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import { LimiteurFlux } from './audio/limiteur-flux';
import { creteVraie, CreteVraieFlux, enDb } from './crete';
import { calculerPlanning, HUMANISATION, type Evenement } from './planning';
import { reechantillonner } from './reechantillonner';
import { mesurerSonie } from './sonie';
import { CODE_PCM, creerDither, enTeteWav, lireEnTeteWav, nomFichier, versPcm } from './wav';

/* ------------------------------------------------------------------ sonie (EBU Tech 3341) */

/** Sinus de 1 kHz, `segments` = [[niveau dBFS, durée s], …], sur 1 ou 2 canaux. */
function sinus(fs: number, segments: [number, number][], canaux = 2): Float32Array[] {
  const n = segments.reduce((s, [, d]) => s + Math.round(d * fs), 0);
  const x = new Float32Array(n);
  let i = 0;
  for (const [db, d] of segments) {
    const a = Math.pow(10, db / 20);
    for (let k = 0; k < Math.round(d * fs); k++, i++) x[i] = a * Math.sin((2 * Math.PI * 1000 * i) / fs);
  }
  return canaux === 2 ? [x, x] : [x, new Float32Array(n)];
}

describe('sonie BS.1770 (signaux EBU Tech 3341)', () => {
  it('1 kHz à −20 dBFS sur 2 canaux = −20,0 LUFS (48 et 44,1 kHz)', () => {
    for (const fs of [48000, 44100]) expect(mesurerSonie(sinus(fs, [[-20, 10]]), fs)).toBeCloseTo(-20, 1);
  });
  it('1 kHz à −20 dBFS sur un seul canal = −23,0 LUFS', () => {
    expect(mesurerSonie(sinus(48000, [[-20, 10]], 1), 48000)).toBeCloseTo(-23, 1);
  });
  it('cas 1 et 2 : −23 et −33 dBFS', () => {
    expect(Math.abs(mesurerSonie(sinus(48000, [[-23, 20]]), 48000) + 23)).toBeLessThan(0.1);
    expect(Math.abs(mesurerSonie(sinus(48000, [[-33, 20]]), 48000) + 33)).toBeLessThan(0.1);
  });
  it('cas 3 : seuil relatif (−36 / −23 / −36) = −23 LUFS', () => {
    expect(Math.abs(mesurerSonie(sinus(48000, [[-36, 10], [-23, 60], [-36, 10]]), 48000) + 23)).toBeLessThan(0.1);
  });
  it('cas 4 : seuils absolu et relatif (−72 / −36 / −23 / −36 / −72) = −23 LUFS', () => {
    const s = sinus(48000, [[-72, 10], [-36, 10], [-23, 60], [-36, 10], [-72, 10]]);
    expect(Math.abs(mesurerSonie(s, 48000) + 23)).toBeLessThan(0.1);
  });
  it('cas 5 : −26 / −20 / −26 dBFS = −23 LUFS', () => {
    expect(Math.abs(mesurerSonie(sinus(48000, [[-26, 20], [-20, 20.1], [-26, 20]]), 48000) + 23)).toBeLessThan(0.1);
  });
  it('silence : −Infinity (tout sous −70 LUFS)', () => {
    expect(mesurerSonie(sinus(48000, [[-80, 5]]), 48000)).toBe(-Infinity);
  });
});

/* ------------------------------------------------------------------ crête vraie */

describe('crête vraie', () => {
  it('sinus à fs/4 déphasé de 45° : échantillons à 0,707, vraie crête 1 (+3 dB)', () => {
    const n = 4800;
    const x = new Float32Array(n);
    // Fondus de 200 échantillons aux bords : pas de dépassement dû au début brutal du signal.
    for (let i = 0; i < n; i++) x[i] = Math.sin((Math.PI / 2) * i + Math.PI / 4) * Math.min(1, i / 200, (n - 1 - i) / 200);
    const echantillons = Math.max(...Array.from(x, Math.abs));
    expect(enDb(echantillons)).toBeCloseTo(-3.01, 1);
    expect(Math.abs(enDb(creteVraie([x])))).toBeLessThan(0.05);
  });
  it('en flux : même résultat par petits blocs', () => {
    const x = new Float32Array(10000);
    for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(i * 1.3) + 0.3 * Math.sin(i * 2.9);
    const m = new CreteVraieFlux(1);
    for (let i = 0; i < x.length; i += 333) m.ajouter([x.subarray(i, Math.min(x.length, i + 333))]);
    expect(m.fin()).toBeCloseTo(creteVraie([x]), 6);
  });
});

/* ------------------------------------------------------------------ limiteur */

describe('limiteur en flux', () => {
  it('aucune trame au-dessus du seuil, sans toucher au son calme', () => {
    const fs = 44100;
    const seuil = 0.5;
    const lim = new LimiteurFlux(fs, seuil, 0.002, 0.05);
    const x = new Float32Array(fs);
    for (let i = 0; i < fs; i++) x[i] = (i > 20000 && i < 20100 ? 1.8 : 0.2) * Math.sin(i * 0.05);
    let max = 0;
    let calme = 0;
    for (let i = 0; i < fs + lim.retard; i++) {
      const g = lim.pousser(i < fs ? Math.abs(x[i]!) : 0);
      const j = i - lim.retard;
      if (j < 0) continue;
      max = Math.max(max, Math.abs(x[j]! * g));
      if (j < 15000) calme = Math.max(calme, Math.abs(1 - g));
    }
    expect(max).toBeLessThanOrEqual(seuil + 1e-6);
    expect(calme).toBe(0);
  });
  it('le worklet enregistre son processeur et limite un bloc de 128 trames', async () => {
    const enregistres: [string, new (o: object) => { process(e: Float32Array[][], s: Float32Array[][]): boolean }][] = [];
    const g = globalThis as Record<string, unknown>;
    g.AudioWorkletProcessor = class {
      port = { onmessage: null, postMessage() {} };
    };
    g.registerProcessor = (nom: string, classe: never) => enregistres.push([nom, classe]);
    g.sampleRate = 48000;
    await import('./audio/limiteur.worklet');
    expect(enregistres[0]![0]).toBe('ocka-limiteur');
    const p = new enregistres[0]![1]({ processorOptions: { seuil: 0.5 } });
    const sortie = [new Float32Array(128), new Float32Array(128)];
    for (let k = 0; k < 10; k++) p.process([[new Float32Array(128).fill(0.9), new Float32Array(128).fill(-0.9)]], [sortie]);
    expect(Math.max(...sortie[0]!.map(Math.abs))).toBeLessThanOrEqual(0.5 + 1e-6);
    expect(sortie[0]![127]).toBeGreaterThan(0.4);
  });
});

/* ------------------------------------------------------------------ WAV */

describe('WAV PCM', () => {
  for (const bits of [24, 16] as const) {
    it(`en-tête ${bits} bits, code 0x0001, 44,1 kHz stéréo`, () => {
      const h = enTeteWav(44100, 2, 44100, bits);
      expect(h.length).toBe(44);
      expect(new TextDecoder().decode(h.subarray(0, 4))).toBe('RIFF');
      expect(new TextDecoder().decode(h.subarray(8, 16))).toBe('WAVEfmt ');
      expect(lireEnTeteWav(h)).toEqual({ format: CODE_PCM, canaux: 2, frequence: 44100, bits, trames: 44100 });
      const v = new DataView(h.buffer);
      expect(v.getUint16(20, true)).toBe(1);
      expect(v.getUint32(4, true)).toBe(36 + 44100 * 2 * (bits / 8));
      expect(v.getUint16(32, true)).toBe(2 * (bits / 8));
    });
  }
  it('échantillons 24 bits petit-boutistes, saturés proprement', () => {
    const o = versPcm([new Float32Array([0.5, 2]), new Float32Array([-1, 0])], 2, 24);
    expect(Array.from(o)).toEqual([0x00, 0x00, 0x40, 0x00, 0x00, 0x80, 0xff, 0xff, 0x7f, 0, 0, 0]);
  });
  it('16 bits : dither TPDF entre −1 et +1 LSB', () => {
    const d = creerDither();
    const v = Array.from({ length: 10000 }, d);
    expect(Math.max(...v)).toBeLessThanOrEqual(1);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(-1);
    expect(Math.abs(v.reduce((a, x) => a + x, 0) / v.length)).toBeLessThan(0.02);
  });
  it('nom de fichier = titre.wav', () => {
    expect(nomFichier('Mon son / v2?')).toBe('Mon son  v2.wav');
    expect(nomFichier('  ')).toBe('morceau.wav');
  });
});

/* ------------------------------------------------------------------ planning */

const frappes = (p: Evenement[], inst: string) => p.filter((e) => e.type === 'frappe' && e.instrument === inst);

describe('planning', () => {
  function simple(swing: number, roul = 0, section: Partial<Morceau['sections'][number]> = {}): Morceau {
    const m = nouveauMorceau('trap');
    m.swing = swing;
    m.tempo = 120;
    m.motifs.b = { type: 'batterie', pas: 16, pistes: { charley: new Array(16).fill(1) }, roulements: { charley: [roul, ...new Array(15).fill(0)] } };
    m.sections = [{ id: 's', nom: 'Couplet', mesures: 2, motifs: { batterie: 'b' }, ...section }];
    m.ordre = ['s'];
    return m;
  }
  it('swing : les double-croches paires sont retardées', () => {
    const d = dureePas(120);
    const t = frappes(calculerPlanning(simple(0.3)), 'charley').map((e) => e.t);
    expect(t).toHaveLength(32);
    expect(t[1]).toBeCloseTo(d * 1.3, 9);
    expect(t[2]).toBeCloseTo(2 * d, 9);
  });
  it('roulements : 3 frappes régulières dans le pas', () => {
    const d = dureePas(120);
    const t = frappes(calculerPlanning(simple(0, 3)), 'charley').map((e) => e.t);
    expect(t).toHaveLength(32 + 4);
    expect(t.slice(0, 4).map((x) => x / d)).toEqual([0, 1 / 3, 2 / 3, 1].map((x) => expect.closeTo(x, 9) as unknown as number));
  });
  it('coupures : break (dernière mesure sans batterie) et drop (1re mesure sans batterie ni basse)', () => {
    expect(frappes(calculerPlanning(simple(0, 0, { coupure: 'break' })), 'charley')).toHaveLength(16);
    const drop = calculerPlanning(simple(0, 0, { coupure: 'drop' }));
    expect(frappes(drop, 'charley').every((e) => e.t >= 16 * dureePas(120) - 1e-9)).toBe(true);
  });
  it('fill : caisse claire en roulements sur la fin de la dernière mesure', () => {
    const p = calculerPlanning(simple(0, 0, { fill: true }));
    const caisse = frappes(p, 'snare');
    expect(caisse.length).toBe(2 + 2 + 3 + 4);
    expect(caisse.every((e) => e.t >= 28 * dureePas(120) - 1e-9)).toBe(true);
  });
  it('humanisation ±8 % à graine fixe', () => {
    const a = calculerPlanning(nouveauMorceau('trap'));
    const b = calculerPlanning(nouveauMorceau('trap'));
    expect(a).toEqual(b);
    const vels = frappes(a, 'kick').map((e) => (e.type === 'frappe' ? e.vel : 0));
    expect(new Set(vels).size).toBeGreaterThan(5);
    expect(Math.min(...vels)).toBeGreaterThanOrEqual(0.75 * (1 - HUMANISATION) - 1e-9);
  });
  it('808 drill : glissé vers la note suivante, basse dans le grave', () => {
    const basse = calculerPlanning(nouveauMorceau('drill')).filter((e) => e.type === 'basse');
    expect(basse.some((e) => e.type === 'basse' && e.cible !== undefined)).toBe(true);
    expect(basse.every((e) => e.type === 'basse' && e.midi >= 16 && e.midi <= 56)).toBe(true);
  });
  it('fin du planning = durée du morceau', () => {
    const m = nouveauMorceau('lofi');
    const p = calculerPlanning(m);
    expect(p[p.length - 1]!.t).toBeLessThan((40 * 240) / 85);
  });
});

describe('rééchantillonnage sinc', () => {
  it('48 → 44,1 kHz : un sinus de 1 kHz garde son niveau et sa hauteur', () => {
    const x = new Float32Array(48000);
    for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 48000);
    const y = reechantillonner(x, 48000, 44100);
    expect(y.length).toBe(44100);
    let err = 0;
    for (let i = 1000; i < 43000; i++) err = Math.max(err, Math.abs(y[i]! - 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 44100)));
    expect(err).toBeLessThan(0.002);
  });
});
