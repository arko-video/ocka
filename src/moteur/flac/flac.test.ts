// L'encodeur FLAC est vérifié par ffmpeg : le décodage doit redonner EXACTEMENT le PCM 16 bits (échantillon par
// échantillon), et ffmpeg ne doit signaler aucune erreur (CRC des trames, en-têtes). Sauté si ffmpeg est absent.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { creerDither, quantifier, versPcm } from '../wav';
import { crc16, crc8, EcrivainBits } from './bits';
import { EncodeurFlac, POSITION_STREAMINFO } from './encodeur';

const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const dossier = mkdtempSync(join(tmpdir(), 'ocka-flac-'));
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

/** Encode des trames entrelacées en plusieurs appels (comme l'export : 1 s à la fois), STREAMINFO corrigé. */
function encoder(e: Int32Array, morceau = 44100): Uint8Array {
  const trames = e.length / 2;
  const enc = new EncodeurFlac(trames);
  const parties = [enc.entete()];
  for (let i = 0; i < trames; i += morceau) {
    const n = Math.min(morceau, trames - i);
    parties.push(enc.ajouter(e.subarray(2 * i, 2 * (i + n)), n));
  }
  parties.push(enc.terminer());
  const o = new Uint8Array(parties.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const x of parties) {
    o.set(x, p);
    p += x.length;
  }
  o.set(enc.streamInfoFinal(), POSITION_STREAMINFO);
  return o;
}

let compteur = 0;
/** Décode par ffmpeg en PCM 16 bits entrelacé. */
function decoder(flac: Uint8Array): Int16Array {
  const f = join(dossier, `t${compteur++}.flac`);
  writeFileSync(f, flac);
  const sortie = `${f}.raw`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-f', 's16le', sortie], { encoding: 'utf8' });
  expect(r.stderr).toBe('');
  expect(r.status).toBe(0);
  const o = readFileSync(sortie);
  return new Int16Array(o.buffer, o.byteOffset, o.byteLength / 2);
}

function verifier(e: Int32Array, nom: string, morceau?: number): number {
  const flac = encoder(e, morceau);
  const d = decoder(flac);
  expect(d.length).toBe(e.length);
  let ecarts = 0;
  for (let i = 0; i < e.length; i++) if (d[i] !== e[i]) ecarts++;
  expect(ecarts).toBe(0);
  const taux = flac.length / (e.length * 2);
  console.log(`FLAC ${nom} : ${(100 * taux).toFixed(1)} % de la taille du WAV 16 bits`);
  return taux;
}

function hasard(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('bits et contrôles', () => {
  it('écriture bit à bit, signés, Rice', () => {
    const w = new EcrivainBits(4);
    w.ecrire(0b101, 3);
    w.ecrireSigne(-1, 5);
    w.rice(-3, 2); // u = 5 → q = 1, reste 01 : « 0 1 01 »
    w.aligner();
    expect([...w.octets.subarray(0, w.pos)]).toEqual([0b10111111, 0b01010000]);
    for (let i = 0; i < 100; i++) w.ecrireLong(0xdeadbeef, 32); // le tampon grandit tout seul
    expect(w.pos).toBe(402);
  });

  it('CRC-8 et CRC-16 de référence (« 123456789 »)', () => {
    const o = new TextEncoder().encode('123456789');
    expect(crc8(o, 0, o.length)).toBe(0xf4);
    expect(crc16(o, 0, o.length)).toBe(0xfee8);
  });
});

describe.skipIf(!ffmpeg)('décodé par ffmpeg = PCM 16 bits exact', () => {
  it('bruit blanc plein niveau (cas le pire : échappements, verbatim)', () => {
    const h = hasard(1);
    const e = new Int32Array(2 * 50_000).map(() => Math.floor(h() * 65536) - 32768);
    expect(verifier(e, 'bruit')).toBeLessThan(1.01);
  });

  it('sinus stéréo + bruit léger, blocs de taille quelconque', () => {
    const h = hasard(2);
    const n = 3 * 44100 + 1234;
    const e = new Int32Array(2 * n);
    for (let i = 0; i < n; i++) {
      e[2 * i] = Math.round(20000 * Math.sin((2 * Math.PI * 440 * i) / 44100) + h() * 4 - 2);
      e[2 * i + 1] = Math.round(15000 * Math.sin((2 * Math.PI * 660 * i) / 44100 + 1) + h() * 4 - 2);
    }
    expect(verifier(e, 'sinus', 10_007)).toBeLessThan(0.6);
  });

  it('silence, une seule trame, valeurs extrêmes', () => {
    expect(verifier(new Int32Array(2 * 10_000), 'silence')).toBeLessThan(0.01);
    verifier(new Int32Array([5, -5]), 'une trame');
    const n = 9000;
    const e = new Int32Array(2 * n).map((_, i) => (i % 3 === 0 ? 32767 : i % 3 === 1 ? -32768 : 0));
    verifier(e, 'extrêmes');
  });

  it('même dither TPDF que le WAV 16 bits : décodage FLAC = données du WAV 16', () => {
    const n = 44100 + 777;
    const g = new Float32Array(n);
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      g[i] = 0.7 * Math.sin((2 * Math.PI * 220 * i) / 44100) * Math.exp(-i / 30000);
      d[i] = i < 1000 ? 0 : 0.5 * Math.sin((2 * Math.PI * 330 * i) / 44100);
    }
    const flac = encoder(quantifier([g, d], n, 16, creerDither()));
    const wav = versPcm([g, d], n, 16, creerDither());
    const dec = decoder(flac);
    const decOctets = new Uint8Array(dec.buffer, dec.byteOffset, dec.byteLength);
    expect(decOctets.length).toBe(wav.length);
    expect(decOctets.every((o, i) => o === wav[i])).toBe(true);
  });

  it('STREAMINFO corrigé : nombre d’échantillons et tailles de trame lus par ffprobe', () => {
    const e = new Int32Array(2 * 20_000).map((_, i) => (i * 37) % 2000);
    const f = join(dossier, 'info.flac');
    writeFileSync(f, encoder(e));
    const json = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', f], { encoding: 'utf8' }));
    expect(json.streams[0]).toMatchObject({ codec_name: 'flac', sample_rate: '44100', channels: 2, duration_ts: 20_000 });
  });
});
