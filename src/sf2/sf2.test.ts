import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../morceau/normaliser';
import { ErreurOcka } from '../moteur/erreur';
import { choisirZone } from '../moteur/instruments/zones';
import { cents, yin } from '../sons/signaux-test';
import { exempleMorceau } from '../ui/edition/exemple';
import { analyserSf2, lecteurBlob } from './analyse';
import { TAILLE_MAX_SF2 } from './api-sf2';
import { fabriquerSf2, plageGen, positionBloc, sf2DeTest, sinus16 } from './fabrique-sf2';
import { lirePcmZone } from './pcm-sf2';
import { ajouterSoundfont, idPreset, importerSoundfont, lireIdPreset, supprimerSoundfont } from './sf2';
import { sourceDuPreset } from './zones-sf2';

const analyser = (o: Uint8Array) => analyserSf2(lecteurBlob(new Blob([o as Uint8Array<ArrayBuffer>])), o.length);

/** Joue une note comme l'échantillonneur (detune depuis la racine, boucle) : `duree` s rendues à la fréquence du sample. */
async function jouer(o: Uint8Array, midi: number, duree: number) {
  const a = await analyser(o);
  const p = a.presets[0]!;
  const source = sourceDuPreset('sf2-x-0-5@1', p);
  const choix = choisirZone(source, midi, 0.8)!;
  const z = p.zones.find((x) => x.cle === choix.zone.fichier)!;
  const pcm = (await lirePcmZone(lecteurBlob(new Blob([o as Uint8Array<ArrayBuffer>])), a.smpl, z)).canaux[0]!;
  const vitesse = Math.pow(2, choix.detune / 1200);
  const out = new Float32Array(Math.round(duree * z.frequence));
  let pos = 0;
  const b = choix.zone.boucle;
  for (let i = 0; i < out.length; i++) {
    if (b && pos >= b.fin) pos -= b.fin - b.debut;
    if (pos + 1 >= pcm.length) break;
    const k = Math.floor(pos);
    out[i] = pcm[k]! + (pcm[k + 1]! - pcm[k]!) * (pos - k);
    pos += vitesse;
  }
  return { out, sr: z.frequence, source };
}

describe('SoundFont valide (fabriquée)', () => {
  it('presets, zones, plages, boucle, ADSR simple', async () => {
    const a = await analyser(sf2DeTest());
    expect(a.nom).toBe('OCKA test');
    expect(a.presets).toHaveLength(1);
    const p = a.presets[0]!;
    expect(p).toMatchObject({ nom: 'Sinus test', banque: 0, preset: 5 });
    expect(p.zones).toHaveLength(2);
    expect(p.zones[0]).toMatchObject({ bas: 0, haut: 70, racine: 69 });
    expect(p.zones[0]!.boucle).toBeDefined();
    expect(p.zones[1]).toMatchObject({ bas: 71, haut: 127, racine: 72 });
    expect(p.zones[1]!.boucle).toBeUndefined();
    const s = sourceDuPreset('sf2-x-0-5@1', p);
    expect(s.relache).toBeCloseTo(0.25, 2);
    expect(s.canaux).toBe(1);
    for (const z of s.zones) expect(Math.abs(z.cents)).toBeLessThanOrEqual(50);
  });
  it('justesse à ±5 cents (YIN), boucle tenue au-delà de la fin du sample', async () => {
    for (const midi of [57, 60, 69, 72, 79]) {
      const { out, sr } = await jouer(sf2DeTest(), midi, midi <= 70 ? 2 : 0.8);
      const attendu = 440 * Math.pow(2, (midi - 69) / 12);
      const debut = midi <= 70 ? Math.round(1.5 * sr) : undefined; // après la fin du sample (1 s) : la boucle joue
      const f = yin(out, sr, 80, 2000, debut);
      expect(Math.abs(cents(f, attendu)), `midi ${midi}`).toBeLessThan(5);
    }
  });
  it('id de preset « sf2-<id>-<banque>-<preset>@1 » (id avec des tirets)', () => {
    expect(lireIdPreset(idPreset('ab-c_d', 128, 0))).toEqual({ sf: 'ab-c_d', banque: 128, preset: 0 });
    expect(lireIdPreset('sf2-x-1@1')).toBeNull();
    expect(lireIdPreset('vcsl-marimba@1')).toBeNull();
  });
  it('ajouter / retirer : pur, 8 au plus, normaliseur sans problème', async () => {
    const m = exempleMorceau();
    const s = { id: 'abc', nom: 'Test', fichier: 'sf2-abc.sf2', taille: 1000 };
    const m1 = ajouterSoundfont(m, s);
    expect(m1.soundfonts).toHaveLength(1);
    expect(ajouterSoundfont(m1, s)).toBe(m1);
    expect(normaliserMorceau(m1).problemes).toEqual([]);
    expect((await supprimerSoundfont(m1, 'abc')).soundfonts).toBeUndefined();
    expect(await supprimerSoundfont(m, 'abc')).toBe(m);
  });
});

/** Attend un refus propre (ErreurOcka sf2_illisible), jamais une autre exception. */
async function refuse(o: Uint8Array, motif?: RegExp) {
  const e = await analyser(o).then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(ErreurOcka);
  expect((e as ErreurOcka).code).toBe('sf2_illisible');
  if (motif) expect((e as ErreurOcka).message).toMatch(motif);
}

describe('SoundFont hostile : refusée proprement', () => {
  const sain = sf2DeTest();
  const piege = (f: (o: Uint8Array, v: DataView) => void) => {
    const o = sain.slice();
    f(o, new DataView(o.buffer));
    return o;
  };
  it('pas un sf2, vide, tronqué', async () => {
    await refuse(new Uint8Array(0));
    await refuse(new TextEncoder().encode('RIFF\0\0\0\0WAVEfmt '), /pas un fichier .sf2/);
    await refuse(sain.slice(0, sain.length - 300));
  });
  it('bloc qui annonce une taille énorme', async () => {
    await refuse(piege((o, v) => v.setUint32(positionBloc(o, 'pdta') - 4, 0x7ffffff0, true)));
    await refuse(piege((o, v) => v.setUint32(positionBloc(o, 'shdr') + 4, 0xffffffff, true)));
  });
  it('enregistrements de mauvaise taille, index hors limites', async () => {
    await refuse(piege((o, v) => v.setUint32(positionBloc(o, 'shdr') + 4, 45, true)));
    await refuse(piege((o, v) => v.setUint16(positionBloc(o, 'pbag') + 8, 9999, true)), /index/);
    await refuse(piege((o, v) => v.setUint16(positionBloc(o, 'pgen') + 8 + 2, 99, true)), /instrument absent/);
  });
  it('échantillon qui sort des données, .sf3', async () => {
    await refuse(piege((o, v) => v.setUint32(positionBloc(o, 'shdr') + 8 + 24, 0x7fffffff, true)), /sort des données/);
    await refuse(piege((o, v) => v.setUint16(positionBloc(o, 'shdr') + 8 + 44, 0x11, true)), /sf3/);
    await refuse(fabriquerSf2({ version: 3, samples: [], instruments: [], presets: [] }), /sf3/);
  });
  it('octets au hasard dans pdta (300 essais) : lu ou refusé, jamais planté', async () => {
    const debut = positionBloc(sain, 'pdta');
    let graine = 12345;
    const h = () => ((graine = (graine * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let essai = 0; essai < 300; essai++) {
      const o = sain.slice();
      for (let k = 0; k < 6; k++) o[debut + Math.floor(h() * (o.length - debut))] = Math.floor(h() * 256);
      const r = await analyser(o).then((a) => a, (e: unknown) => e);
      if (!(r instanceof ErreurOcka)) for (const p of (r as Awaited<ReturnType<typeof analyser>>).presets) expect(p.zones.length).toBeLessThanOrEqual(512);
    }
  });
  it('trop de zones : coupé à 512 par preset', async () => {
    const zones = Array.from({ length: 700 }, (_, i) => [[43, plageGen(i % 128, i % 128)], [53, 0]] as [number, number][]);
    const o = fabriquerSf2({ samples: [{ nom: 's', pcm: sinus16(440, 44100, 1000), frequence: 44100, racine: 69 }], instruments: [{ nom: 'i', zones }], presets: [{ nom: 'p', preset: 0, banque: 0, zones: [[[41, 0]]] }] });
    expect((await analyser(o)).presets[0]!.zones).toHaveLength(512);
  });
  it('plus de 32 Mo : refusé avant toute lecture', async () => {
    const f = new File([new Uint8Array(TAILLE_MAX_SF2 + 1)], 'gros.sf2');
    await expect(importerSoundfont(f, exempleMorceau())).rejects.toMatchObject({ code: 'trop_gros' });
  });
});
