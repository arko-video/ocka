// Chaînes de voix prêtes, clé du gel, compensation de la référence (sonie égale à ±0,5 LU), tampon circulaire.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../morceau/normaliser';
import { nouveauMorceau } from '../morceau/styles';
import type { PisteFixe } from '../morceau/types';
import { cleGel } from '../moteur/gel';
import { compensation, entrelacer } from '../moteur/reference';
import { TamponCirculaire } from '../moteur/reference-lecture';
import { MesureSonie, mesurerSonie } from '../moteur/sonie';
import { CHAINES_VOIX } from './api-voix-avancee';
import { appliquerChaineVoix, chainesVoix } from './chaines-voix';

describe('chaînes de voix prêtes', () => {
  it('chaque chaîne remplace les inserts de la voix, morceau valide, pur ; Hyperpop met l’autotune au bout Robot', () => {
    const m = nouveauMorceau('trap', 'Test');
    expect(chainesVoix().map((c) => c.id).sort()).toEqual([...CHAINES_VOIX].sort());
    for (const c of chainesVoix()) {
      const m2 = appliquerChaineVoix(m, c.id);
      const voix = m2.pistes.find((p) => p.id === 'voix') as PisteFixe;
      expect(voix.inserts?.map((x) => x.type)).toEqual(c.inserts.map((x) => x.type));
      expect(voix.inserts!.length).toBeLessThanOrEqual(6);
      const n = normaliserMorceau(m2);
      expect(n.problemes, c.id).toEqual([]);
      expect(n.morceau.pistes.find((p) => p.id === 'voix')!.inserts).toEqual(voix.inserts);
      if (c.id === 'hyperpop') expect(voix.effets?.autotune).toBe(1);
    }
    expect(m.pistes.find((p) => p.id === 'voix')!.inserts).toBeUndefined();
  });

  it('les courbes et LFO qui visaient les anciens inserts partent avec eux', () => {
    const m0 = appliquerChaineVoix(nouveauMorceau('trap', 'Test'), 'rap-clair');
    const voix = m0.pistes.find((p) => p.id === 'voix') as PisteFixe;
    const cible = { type: 'insert' as const, insert: 'vx-sat', param: 'force' };
    const m1 = { ...m0, pistes: m0.pistes.map((p) => (p.id === 'voix' ? { ...voix, lfo: [{ cible, forme: 'sinus' as const, periode: 16, profondeur: 0.5, phase: 0 }, { cible: { type: 'volume' as const }, forme: 'sinus' as const, periode: 16, profondeur: 0.2, phase: 0 }] } : p)) };
    const m2 = appliquerChaineVoix(m1, 'lofi-telephone');
    expect((m2.pistes.find((p) => p.id === 'voix') as PisteFixe).lfo).toEqual([m1.pistes.find((p) => p.id === 'voix')!.lfo![1]]);
    expect(normaliserMorceau(m2).problemes).toEqual([]);
  });
});

describe('gel : clé du rendu', () => {
  it('change avec la piste, ses notes ou le tempo ; pas avec une autre piste ni le titre', () => {
    const m = nouveauMorceau('trap', 'Test');
    const k = cleGel(m, 'basse');
    expect(k).toBeTruthy();
    expect(cleGel({ ...m, titre: 'Autre' }, 'basse')).toBe(k);
    expect(cleGel({ ...m, pistes: m.pistes.map((p) => (p.id === 'accords' ? { ...p, volume: 0.3 } : p)) }, 'basse')).toBe(k);
    expect(cleGel({ ...m, tempo: m.tempo + 1 }, 'basse')).not.toBe(k);
    expect(cleGel({ ...m, pistes: m.pistes.map((p) => (p.id === 'basse' ? { ...p, volume: 0.3 } : p)) }, 'basse')).not.toBe(k);
    expect(cleGel({ ...m, pistes: m.pistes.map((p) => (p.id === 'accords' ? { ...p, solo: true } : p)) }, 'basse')).not.toBe(k);
    const motif = m.sections.map((s) => s.motifs.basse).find((x) => x && m.motifs[x])!;
    expect(cleGel({ ...m, motifs: { ...m.motifs, [motif]: { ...m.motifs[motif]!, notes: [] } as never } }, 'basse')).not.toBe(k);
    expect(cleGel(m, 'inconnue')).toBeNull();
  });
});

describe('référence : même volume perçu', () => {
  it('sonie mesurée en flux = sonie entière ; référence compensée = mix à ±0,5 LU', () => {
    let g = 11;
    const bruit = (n: number, a: number) => Float32Array.from({ length: n }, () => a * ((g = (g * 16807) % 2147483647) / 2147483647 - 0.5));
    const fsMix = 44100;
    const mix = [bruit(10 * fsMix, 0.3), bruit(10 * fsMix, 0.3)];
    const fsRef = 48000;
    // Référence plus forte, au contenu différent (des sinus graves + du bruit) et avec des passages calmes.
    const ref = [0, 1].map((c) => Float32Array.from({ length: 12 * fsRef }, (_, i) => (i > 3 * fsRef && i < 4 * fsRef ? 0.01 : 0.9) * (0.5 * Math.sin((2 * Math.PI * 80 * i) / fsRef + c) + 0.4 * ((g = (g * 16807) % 2147483647) / 2147483647 - 0.5))));
    // Mesure par paquets (comme l'import Mediabunny) : identique à la mesure d'un bloc.
    const flux = new MesureSonie(fsRef, 2);
    for (let i = 0; i < ref[0]!.length; i += 1152) flux.ajouter([ref[0]!.subarray(i, i + 1152), ref[1]!.subarray(i, i + 1152)]);
    const lufsRef = flux.integree();
    expect(lufsRef).toBeCloseTo(mesurerSonie(ref, fsRef), 6);
    const lufsMix = mesurerSonie(mix, fsMix);
    const db = compensation(lufsMix, lufsRef);
    const k = 10 ** (db / 20);
    const compensee = mesurerSonie(ref.map((x) => x.map((v) => v * k)), fsRef);
    console.log(`référence ${lufsRef.toFixed(2)} LUFS, mix ${lufsMix.toFixed(2)} LUFS, compensation ${db} dB → ${compensee.toFixed(2)} LUFS`);
    expect(Math.abs(compensee - lufsMix)).toBeLessThanOrEqual(0.5);
  });

  it('tampon circulaire : ordre gardé, jamais plus que sa capacité', () => {
    const t = new TamponCirculaire(5);
    const g = new Float32Array(5);
    const d = new Float32Array(5);
    expect(t.ecrire(entrelacer(Float32Array.of(1, 2, 3), Float32Array.of(-1, -2, -3)))).toBe(3);
    expect(t.lire(g, d, 2)).toBe(2);
    expect([...g.slice(0, 2), ...d.slice(0, 2)]).toEqual([1, 2, -1, -2]);
    expect(t.ecrire(entrelacer(Float32Array.of(4, 5, 6, 7, 8), Float32Array.of(-4, -5, -6, -7, -8)))).toBe(4);
    expect(t.disponibles).toBe(5);
    expect(t.lire(g, d, 9)).toBe(5);
    expect([...g]).toEqual([3, 4, 5, 6, 7]);
    expect([...d]).toEqual([-3, -4, -5, -6, -7]);
  });
});
