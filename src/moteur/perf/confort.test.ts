// Confort (R) et édition des effets de performance : fonctions pures acceptées par le normaliseur.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../../morceau/normaliser';
import { nouveauMorceau } from '../../morceau/styles';
import type { Morceau, PisteInstrument } from '../../morceau/types';
import { ajouterPiste } from '../../ui/edition/pistes';
import { reglerTranche } from '../../ui/edition/mixage';
import * as c from '../confort';
import { ajouterEffetPerf, gelsPerformance, reglerEffetPerf, retirerEffetPerf } from '../performance';
import { passagesPerf } from './passages';

const sansProblemes = (m: Morceau) =>
  expect(normaliserMorceau(JSON.parse(JSON.stringify(m))).problemes).toEqual([]);

describe('effets de performance : édition', () => {
  const m = nouveauMorceau('trap', 'Perf');
  const s = m.sections[0]!;
  const fin = s.mesures * 16;

  it('ajouter, régler, retirer : pur, borné (au 1/24, dans la section, 8 au plus), normaliseur content', () => {
    const a = ajouterEffetPerf(m, s.id, { type: 'stutter', pas: fin - 4, duree: 99, division: 5 as never });
    expect(a.sections[0]!.perf).toEqual([{ type: 'stutter', pas: fin - 4, duree: 4, division: 4 }]);
    expect(m.sections[0]!.perf).toBeUndefined();
    sansProblemes(a);
    const b = reglerEffetPerf(a, s.id, 0, { type: 'tape-stop', pas: fin - 8.01, duree: 8 });
    expect(b.sections[0]!.perf).toEqual([{ type: 'tape-stop', pas: fin - 8, duree: 8 }]);
    expect(reglerEffetPerf(b, s.id, 0, { type: 'tape-stop', pas: fin - 8, duree: 8 })).toBe(b);
    const c8 = Array.from({ length: 10 }).reduce<Morceau>(
      (x) => ajouterEffetPerf(x, s.id, { type: 'gate', pas: 0, duree: 4 }),
      b,
    );
    expect(c8.sections[0]!.perf).toHaveLength(8);
    sansProblemes(c8);
    const r = retirerEffetPerf(b, s.id, 0);
    expect('perf' in r.sections[0]!).toBe(false);
    expect(retirerEffetPerf(r, s.id, 0)).toBe(r);
    expect(ajouterEffetPerf(m, 'inconnue', { type: 'reverse', pas: 0, duree: 4 })).toBe(m);
  });

  it('passages : clé stable ; change avec l’effet ou la section ; pas avec une section qui joue après', async () => {
    const a = ajouterEffetPerf(m, s.id, { type: 'reverse', pas: fin - 4, duree: 4 });
    const p1 = passagesPerf(a, 48000);
    expect(p1.length).toBe(a.ordre.filter((id) => id === s.id).length);
    expect(p1[0]!.pistes).not.toContain('voix');
    expect(p1[0]!.a - p1[0]!.de).toBeCloseTo(4 * (60 / a.tempo / 4), 6);
    expect(passagesPerf(a, 48000).map((p) => p.cle)).toEqual(p1.map((p) => p.cle));
    expect(
      passagesPerf(reglerEffetPerf(a, s.id, 0, { type: 'gate', pas: fin - 4, duree: 4 }), 48000)[0]!.cle,
    ).not.toBe(p1[0]!.cle);
    expect(passagesPerf({ ...a, tempo: a.tempo + 1 }, 48000)[0]!.cle).not.toBe(p1[0]!.cle);
    expect(passagesPerf(a, 44100)[0]!.cle).not.toBe(p1[0]!.cle);
    // Rien à geler sans effet ; écoute sans rendu prêt : aucun gel (le calcul part en tâche de fond).
    expect(await gelsPerformance(m, { frequence: 48000, attendre: false })).toEqual([]);
  });
});

describe('confort', () => {
  it('tap tempo : moyenne des 4 derniers taps, arrondie, bornée ; null s’il en manque ; une pause recommence', () => {
    expect(c.tapTempo([0, 500])).toBe(null);
    expect(c.tapTempo([0, 500, 1000])).toBe(120);
    expect(c.tapTempo([0, 1000, 1500, 2000, 2500])).toBe(120); // le 1er écart (1 s) n'est plus dans les 4 derniers
    expect(c.tapTempo([0, 641, 1282, 1923])).toBe(94);
    expect(c.tapTempo([0, 100, 200, 300])).toBe(200);
    expect(c.tapTempo([0, 500, 1000, 5000, 5400])).toBe(null);
    expect(c.tapTempo([0, 500, 1000, 5000, 5400, 5800])).toBe(150);
  });

  it('métronome : « clic » = le clic d’avant C3 ; bois, cloche, charley différents et sans saturation', () => {
    const f = 48000;
    const ancien = new Float32Array(Math.round(0.03 * f));
    for (let i = 0; i < ancien.length; i++)
      ancien[i] = 0.5 * Math.sin((2 * Math.PI * 1800 * i) / f) * Math.exp(-i / (0.006 * f));
    expect(c.signalClic(true, f, 'clic')).toEqual(ancien);
    for (const son of ['bois', 'cloche', 'charley'] as const) {
      const x = c.signalClic(false, f, son);
      expect(x.length).toBeGreaterThanOrEqual(Math.round(0.03 * f));
      expect(Math.max(...x.map(Math.abs))).toBeLessThan(1);
      expect(Math.max(...x.map(Math.abs))).toBeGreaterThan(0.05);
    }
    expect(c.metronomeChoisi()).toBe('clic');
  });

  it('historique : un nom lisible par étape, position relative au présent', () => {
    const m0 = nouveauMorceau('trap', 'Histo');
    const r = ajouterPiste(m0, 'ocka-piano@1', 'Piano')!;
    const m2 = reglerTranche(r.m, r.id, { muet: true });
    const m3 = { ...m2, tempo: 150 };
    const e = c.etapesHistorique([m0, r.m], m2, [m3]);
    expect(e.map((x) => x.position)).toEqual([-2, -1, 0, 1]);
    expect(e.map((x) => x.libelle)).toEqual([
      'Ouverture du morceau',
      'Piste ajoutée (Piano)',
      'Piste coupée (Piano)',
      `Tempo changé (${m0.tempo} → 150)`,
    ]);
    const s = m0.sections[0]!;
    expect(c.libelleChangement(m0, ajouterEffetPerf(m0, s.id, { type: 'reverse', pas: 0, duree: 4 }))).toBe(
      `Effet de fin ajouté (${s.nom})`,
    );
    const id = Object.values(s.motifs).find((x) => m0.motifs[x]?.type === 'batterie')!;
    const bat = m0.motifs[id]! as Extract<Morceau['motifs'][string], { type: 'batterie' }>;
    const cowbell = Array.from({ length: bat.pas }, (_, i) => bat.pistes.cowbell?.[i] ?? 0);
    cowbell[cowbell.findIndex((v) => !(v > 0))] = 1;
    const posee = {
      ...m0,
      motifs: Object.assign(Object.create(null), m0.motifs, {
        [id]: { ...bat, pistes: { ...bat.pistes, cowbell } },
      }),
    };
    expect(c.libelleChangement(m0, posee)).toBe('Frappe posée');
  });

  it('modèles : pistes sans automation ni solo ; appliquer ajoute avec ids et noms libres (16 au plus)', () => {
    const base = nouveauMorceau('trap', 'Modèle');
    const r = ajouterPiste(base, 'ocka-nappe@1', 'Nappe')!;
    const p = r.m.pistes.find((x) => x.id === r.id) as PisteInstrument;
    const modele = {
      id: 'x',
      nom: 'Ma nappe',
      creeLe: 1,
      pistes: [
        { ...p, solo: true, sidechain: { source: 'kick' as const, force: 0.6, relache: 0.2 }, auto: [] },
      ],
    };
    const a = c.appliquerModele(r.m, modele);
    const ajoutee = a.pistes.find(
      (x) => x.genre === 'instrument' && x.id !== r.id && x.nom.startsWith('Nappe'),
    ) as PisteInstrument;
    expect(ajoutee.nom).toBe('Nappe 2');
    expect(ajoutee.instrument).toBe('ocka-nappe@1');
    expect(ajoutee.sidechain?.force).toBe(0.6);
    expect(ajoutee.solo).toBe(false);
    expect('auto' in ajoutee).toBe(false);
    expect(a.pistes[a.pistes.length - 1]!.id).toBe('voix');
    sansProblemes(a);
    let plein = a;
    for (let i = 0; i < 20; i++) plein = c.appliquerModele(plein, modele);
    expect(plein.pistes.filter((x) => x.genre === 'instrument')).toHaveLength(16);
  });

  it('marqueurs : poser, nommer, placer sur le temps, retirer ; ancre bornée', () => {
    const m = nouveauMorceau('trap', 'Repères');
    const s = m.sections[1]!;
    const a = c.ajouterMarqueur(m, '  Drop  ', { section: s.id, occurrence: 0, mesure: 99 });
    expect(a.marqueurs).toEqual([
      { id: 'marqueur-1', nom: 'Drop', ancre: { section: s.id, occurrence: 0, mesure: s.mesures - 1 } },
    ]);
    expect(c.ajouterMarqueur(m, 'x', { section: 'nope', occurrence: 0, mesure: 0 })).toBe(m);
    const b = c.ajouterMarqueur(a, '', { section: m.sections[0]!.id, occurrence: 0, mesure: 0 });
    expect(c.marqueursPlaces(b).map((x) => x.nom)).toEqual(['Repère 2', 'Drop']);
    expect(c.marqueursPlaces(b)[0]!.t).toBe(0);
    const r = c.modifierMarqueur(b, 'marqueur-1', { nom: 'Refrain fort' });
    expect(r.marqueurs![0]!.nom).toBe('Refrain fort');
    expect(c.modifierMarqueur(r, 'marqueur-1', { nom: 'Refrain fort' })).toBe(r);
    sansProblemes(r);
    const vide = c.retirerMarqueur(c.retirerMarqueur(r, 'marqueur-1'), 'marqueur-2');
    expect('marqueurs' in vide).toBe(false);
  });
});
