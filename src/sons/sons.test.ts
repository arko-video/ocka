// « Tes sons » : plafonds vérifiés AVANT de décoder, en-tête qui ment, fichier par canal, lecture et copie.
// Node n'a pas de Web Audio : OfflineAudioContext est simulé (decodeAudioData rend un tampon fabriqué).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installerNavigateur, type RacineFactice } from '../projets/test-factices';
import type { Morceau, SonImporte } from '../morceau/types';
import { importerSon, lireInfosAudio, lireSon, nomSon } from './import';

let racine: RacineFactice;
let decodages = 0;
/** Ce que rendra le prochain decodeAudioData : n trames, c canaux. */
let rendu = { n: 0, canaux: 1 };

beforeEach(() => {
  racine = installerNavigateur(vi.stubGlobal);
  decodages = 0;
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      constructor(
        _c: number,
        _n: number,
        public sampleRate: number,
      ) {}
      async decodeAudioData() {
        decodages++;
        const { n, canaux } = rendu;
        const donnees = Array.from({ length: canaux }, (_, c) => Float32Array.from({ length: n }, (_, i) => (c + 1) * Math.sin(i / 10) * 0.1));
        return { length: n, sampleRate: this.sampleRate, numberOfChannels: canaux, getChannelData: (c: number) => donnees[c]! };
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Un WAV PCM 16 bits (avec un bloc LIST avant les données, comme beaucoup de logiciels). */
function wav(secondes: number, canaux = 2, frequence = 44100): File {
  const trames = Math.round(secondes * frequence);
  const liste = 12;
  const b = new ArrayBuffer(44 + liste + trames * canaux * 2);
  const v = new DataView(b);
  const t = (p: number, s: string) => [...s].forEach((c, i) => v.setUint8(p + i, c.charCodeAt(0)));
  t(0, 'RIFF');
  v.setUint32(4, b.byteLength - 8, true);
  t(8, 'WAVE');
  t(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, canaux, true);
  v.setUint32(24, frequence, true);
  v.setUint32(28, frequence * canaux * 2, true);
  v.setUint16(32, canaux * 2, true);
  v.setUint16(34, 16, true);
  t(36, 'LIST');
  v.setUint32(40, liste - 8, true);
  t(36 + liste, 'data');
  v.setUint32(40 + liste, trames * canaux * 2, true);
  return new File([b], 'Mon kick.wav', { type: 'audio/wav' });
}

const morceau = (sons: Partial<SonImporte>[] = []) => ({ sons: sons as SonImporte[] }) as Morceau;

describe('import d’un son', () => {
  it('durée lue dans l’en-tête WAV (sans décoder), blocs inconnus sautés', async () => {
    expect(await lireInfosAudio(wav(2.5))).toEqual({ duree: 2.5, frequence: 44100, canaux: 2 });
    expect(decodages).toBe(0);
    expect(nomSon('  Mon kick 808.wav ')).toBe('Mon kick 808');
  });

  it('refus AVANT de décoder : trop gros, trop de sons, plus de 120 s au total', async () => {
    const gros = new File([new Uint8Array(20e6 + 1)], 'gros.wav');
    await expect(importerSon(gros, morceau())).rejects.toMatchObject({ code: 'son_trop_gros' });
    const seize = Array.from({ length: 16 }, () => ({ duree: 1 }));
    await expect(importerSon(wav(1), morceau(seize))).rejects.toMatchObject({ code: 'trop_de_sons' });
    await expect(importerSon(wav(3), morceau([{ duree: 118 }]))).rejects.toMatchObject({ code: 'son_trop_long' });
    await expect(importerSon(new File([new Uint8Array(100)], 'x.mp3'), morceau())).rejects.toMatchObject({ code: 'son_illisible' });
    expect(decodages).toBe(0);
    expect(racine.noms('ocka-sons')).toEqual([]);
  });

  it('en-tête qui ment (le décodage dure plus) : refusé, rien d’écrit', async () => {
    rendu = { n: 44100 * 130, canaux: 1 };
    await expect(importerSon(wav(1, 1), morceau())).rejects.toMatchObject({ code: 'son_trop_long' });
    expect(racine.noms('ocka-sons')).toEqual([]);
  });

  it('stéréo : fichier « par canal » à la fréquence d’origine, relu à l’identique ; le morceau n’est pas modifié', async () => {
    rendu = { n: 22050, canaux: 2 };
    const m = morceau();
    const son = await importerSon(wav(1, 2, 22050), m);
    expect(m.sons).toEqual([]);
    expect(son).toMatchObject({ nom: 'Mon kick', frequence: 22050, duree: 1, canaux: 2 });
    expect(son.fichier).toMatch(/^son-[a-z0-9]+\.f32$/);
    expect(racine.fichier('ocka-sons', son.fichier)!.contenu.donnees.length).toBe(22050 * 2 * 4);
    const pcm = (await lireSon(son))!;
    expect(pcm.frequence).toBe(22050);
    expect(pcm.canaux).toHaveLength(2);
    expect(pcm.canaux[1]![10]).toBeCloseTo(2 * Math.sin(1) * 0.1, 6);
    expect(await lireSon({ ...son, fichier: 'son-disparu.f32' })).toBeNull();
    expect(await lireSon({ ...son, fichier: '../prises/prise-x.f32' })).toBeNull();
  });
});
