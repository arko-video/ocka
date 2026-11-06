// Contrat C3 — registre des synthés : les 6 sons v1 passent par le registre (synthese/synthes/*) SANS changer un
// échantillon (empreintes FNV-1a relevées AVANT le registre, 44,1 et 48 kHz, variantes lo-fi et cowbell comprises),
// leurs clés de cache ne changent pas, et chaque synthé prêt sait se rendre dans son mode.
import { describe, expect, it } from 'vitest';
import { syntheOcka } from '../../morceau/acces';
import { PLAFONDS, REGLE_INSTRUMENT, SONS_MELODIE } from '../../morceau/types';
import { cles } from '../instruments/banque';
import { synthetiserNote } from '../instruments/notes';
import { avecFrequence } from './briques';
import { definitionDe, empreinteReglages, instrumentsSynthes, reglagesLus, synthe } from './registre-synthes';
import { SYNTHES } from './synthes/index';

const EMPREINTES: Record<string, string> = {
  '44100|piano||36': '80f3bbf0:264600',
  '44100|piano||60': '25499039:220500',
  '44100|piano||79': '53222ace:154350',
  '44100|epiano||36': 'e172150c:220500',
  '44100|epiano||60': '4c45aeac:220500',
  '44100|epiano||79': '4289f4d4:220500',
  '44100|epiano|lofi|36': '5683da83:220500',
  '44100|epiano|lofi|60': '9230227d:220500',
  '44100|epiano|lofi|79': '4bd28d71:220500',
  '44100|lead||36': 'c0ed56f3:114660|1,2.6',
  '44100|lead||60': '2832d1d7:114660|1,2.6',
  '44100|lead||79': '95d46c1b:114660|1,2.6',
  '44100|pluck||36': '687a81d:110250',
  '44100|pluck||60': '61dfc85:73611',
  '44100|pluck||79': '8931ecd2:38103',
  '44100|cloche||36': 'ce14b2ea:176400',
  '44100|cloche||60': '62cb5143:176400',
  '44100|cloche||79': '45063233:176400',
  '44100|cloche|cowbell|36': '76b9cdb9:52920',
  '44100|cloche|cowbell|60': 'b95d499e:52920',
  '44100|cloche|cowbell|79': '60d80ac7:52920',
  '44100|nappe||36': '1295d121:176400/176400|2,4',
  '44100|nappe||60': '171aa1cb:176400/176400|2,4',
  '44100|nappe||79': '9e3f234c:176400/176400|2,4',
  '48000|piano||36': 'b73c23d0:288000',
  '48000|piano||60': '63a639dc:240000',
  '48000|piano||79': '2c6783c9:168000',
  '48000|epiano||36': '961d0468:240000',
  '48000|epiano||60': '6cb7455f:240000',
  '48000|epiano||79': '37479ead:240000',
  '48000|epiano|lofi|36': 'df6d780c:240000',
  '48000|epiano|lofi|60': 'daa4ebfc:240000',
  '48000|epiano|lofi|79': '3fa7ea6d:240000',
  '48000|lead||36': 'd4862556:124800|1,2.6',
  '48000|lead||60': 'cfdf1ea5:124800|1,2.6',
  '48000|lead||79': '98d618a:124800|1,2.6',
  '48000|pluck||36': '4d72ed8c:120000',
  '48000|pluck||60': '7f925373:80121',
  '48000|pluck||79': '597cafb:41473',
  '48000|cloche||36': 'f92e2d3d:192000',
  '48000|cloche||60': 'cc4d7804:192000',
  '48000|cloche||79': '969630aa:192000',
  '48000|cloche|cowbell|36': '8cc18cf6:57600',
  '48000|cloche|cowbell|60': 'e81c157c:57600',
  '48000|cloche|cowbell|79': '11c25464:57600',
  '48000|nappe||36': '942782ac:192000/192000|2,4',
  '48000|nappe||60': '2433c25:192000/192000|2,4',
  '48000|nappe||79': 'b5892c3a:192000/192000|2,4',
};

function empreinte(canaux: Float32Array[]): string {
  let x = 0x811c9dc5;
  for (const c of canaux) {
    const u = new Uint32Array(c.buffer, c.byteOffset, c.length);
    for (let i = 0; i < u.length; i++) x = Math.imul(x ^ u[i]!, 0x01000193) >>> 0;
  }
  return x.toString(16) + ':' + canaux.map((c) => c.length).join('/');
}

describe('registre des synthés (contrat C3)', () => {
  it('les 6 sons v1 rendent EXACTEMENT les mêmes échantillons qu’avant le registre (test nul)', () => {
    for (const [cle, attendu] of Object.entries(EMPREINTES)) {
      const [fs, son, variante, midi] = cle.split('|');
      const r = avecFrequence(Number(fs), () => synthetiserNote(son!, variante!, Number(midi)));
      expect(empreinte(r.canaux) + (r.boucle ? `|${r.boucle.join(',')}` : ''), cle).toBe(attendu);
    }
  }, 60_000);

  it('les clés de cache des sons v1 ne changent pas (réglages absents ou neutres)', () => {
    expect(cles.note('piano', '', 60)).toBe('n|piano||60');
    const piano = synthe('piano')!;
    expect(empreinteReglages(piano, { params: { inconnu: 0.3 } })).toBe('');
  });

  it('ids valides et uniques ; réglages bornés ; chaque synthé PRÊT sait se rendre dans son mode', () => {
    const ids = SYNTHES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v1 of SONS_MELODIE) expect(ids).toContain(v1);
    for (const s of SYNTHES) {
      expect(s.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(`ocka-${s.id}@1`).toMatch(REGLE_INSTRUMENT);
      expect(Object.keys(s.params).length).toBeLessThanOrEqual(PLAFONDS.paramsSynthe);
      for (const p of Object.values(s.params)) expect(p.defaut >= 0 && p.defaut <= 1).toBe(true);
      if (s.points !== undefined) expect(s.points >= 16 && s.points <= PLAFONDS.ondeSynthe).toBe(true);
      if (s.pret) expect(typeof (s.mode === 'note' ? s.rendreNote : s.rendreMotif)).toBe('function');
    }
  });

  it('syntheOcka : sons v1 et synthés prêts seulement ; le catalogue ne liste que les synthés prêts de C3', () => {
    expect(syntheOcka('ocka-piano@1')).toBe('piano');
    expect(syntheOcka('vcsl-marimba@1')).toBeNull();
    for (const s of SYNTHES) expect(syntheOcka(`ocka-${s.id}@1`)).toBe(s.pret ? s.id : null);
    const cat = instrumentsSynthes().map((x) => x.id);
    for (const s of SYNTHES) expect(cat.includes(`ocka-${s.id}@1`)).toBe(s.pret && !(SONS_MELODIE as readonly string[]).includes(s.id));
    expect(definitionDe('ocka-epiano@1')?.id).toBe('epiano');
  });

  it('reglagesLus : défauts, bornes, crans et onde rééchantillonnée', () => {
    const d = { ...synthe('piano')!, params: { a: { defaut: 0.5 }, b: { defaut: 0, crans: 3 } }, points: 4 };
    const r = reglagesLus(d, { params: { a: 7, b: 0.4 }, onde: [0, 1] });
    expect(r.params).toEqual({ a: 1, b: 0.5 });
    expect(r.onde).toEqual([0, 0.5, 1, 0.5]);
    expect(reglagesLus(d, undefined).onde).toHaveLength(4);
  });
});
