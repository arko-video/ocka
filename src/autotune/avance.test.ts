// Autotune avancé : analyse en notes, détection de la gamme, « Corriger tout seul », conseil appliqué, noms et ménage.
import { describe, expect, it } from 'vitest';
import { choisirOrphelins } from '../enregistrement/prises';
import { FICHIER_PRISE } from '../enregistrement/fichiers-opfs';
import { nouveauMorceau } from '../morceau/styles';
import type { CourbeHauteur, NoteDetectee } from './api-autotune';
import { fichiersAutotune } from './autotune';
import { appliquerConseil, corrigerToutSeul, nettoyerNotes } from './conseil';
import { detecterGamme } from './detection-gamme';
import { analyserPcm } from './moteur-avance';
import { decouperNotes } from './notes';
import { nomRenduAutotune, reglagesPreset } from './reglages';
import { voixSynthese } from './voix-synthese';

const FS = 48000;
const LA_MINEUR = { tonique: 'A', mode: 'mineur' } as const;

/** Courbe artificielle : une valeur toutes les 10 ms. */
function courbe(cents: number[], niveau?: number[]): CourbeHauteur {
  return { pas: 0.01, debut: 0.013, cents: Float32Array.from(cents), niveau: Float32Array.from(niveau ?? cents.map(() => 1)) };
}
const tenue = (c: number, n: number) => new Array<number>(n).fill(c);

describe('analyse en notes', () => {
  it('voix de synthèse : une note par note chantée, justesse, vibrato (amplitude, vitesse)', () => {
    const { pcm, notes } = voixSynthese(9, FS);
    const { analyse } = analyserPcm('prise-x.f32', pcm, FS);
    expect(analyse.voisees).toBeGreaterThan(0.6);
    expect(analyse.notes.length).toBe(notes.length);
    analyse.notes.forEach((d, i) => {
      const n = notes[i]!;
      expect(d.midi).toBe(n.midi);
      expect(Math.abs(d.justesse - n.faux)).toBeLessThan(8);
      expect(Math.abs(d.debut - n.debut)).toBeLessThan(0.08);
      if (i > 0) expect(d.debut).toBeGreaterThanOrEqual(analyse.notes[i - 1]!.fin);
      if (n.duree >= 0.45) {
        expect(d.vibrato).toBeGreaterThan(25); // ±25 cents chantés = 50 crête à crête une fois installé
        expect(d.vibrato).toBeLessThan(70);
        expect(Math.abs(d.vitesseVibrato - 5.5)).toBeLessThan(1);
      }
    });
    // Hauteur moyenne, écart à la gamme détectée, voisée (dans le contrat depuis l'intégration C2).
    const n0 = analyse.notes[0]!;
    expect(Math.abs(n0.hauteur - (notes[0]!.midi * 100 + notes[0]!.faux))).toBeLessThan(15);
    expect(Math.abs(n0.ecartGamme - notes[0]!.faux)).toBeLessThan(8);
    expect(n0.voisee).toBe(true);
  });

  it('saut de plus de 70 cents tenu plus de 60 ms : nouvelle note ; un écart bref ou un vibrato : non', () => {
    const vib = Array.from({ length: 60 }, (_, i) => 6000 + 40 * Math.sin((2 * Math.PI * 6 * i) / 100));
    const n1 = decouperNotes(courbe([...tenue(6000, 40), ...tenue(6200, 40)]), 2);
    expect(n1.map((n) => n.midi)).toEqual([60, 62]);
    expect(n1[1]!.debut).toBeCloseTo(0.013 + 0.4 - 0.005, 3);
    expect(decouperNotes(courbe([...tenue(6000, 30), ...tenue(6150, 4), ...tenue(6000, 30)]), 2)).toHaveLength(1); // 40 ms
    expect(decouperNotes(courbe([...tenue(6000, 30), ...tenue(6060, 30)]), 2)).toHaveLength(1); // 60 cents
    expect(decouperNotes(courbe(vib), 2)).toHaveLength(1);
    // Silence (non voisé) entre deux notes.
    expect(decouperNotes(courbe([...tenue(6000, 20), ...tenue(NaN, 5), ...tenue(6000, 20)]), 2)).toHaveLength(2);
  });

  it('attaque à hauteur constante (creux puis remontée de 6 dB) : nouvelle note', () => {
    const niv = [...tenue(1, 30), 0.3, 0.2, 0.25, ...tenue(1, 30)];
    const n = decouperNotes(courbe(tenue(6000, niv.length), niv), 2);
    expect(n).toHaveLength(2);
    expect(decouperNotes(courbe(tenue(6000, 63), tenue(1, 63)), 2)).toHaveLength(1);
  });
});

/** Mélodie (MIDI, durée en croches) → notes détectées « parfaites ». */
function melodie(m: [number, number][]): NoteDetectee[] {
  let t = 0;
  return m.map(([midi, d]) => {
    const n = { debut: t, fin: t + d * 0.25, midi, justesse: 0, vibrato: 0, vitesseVibrato: 0, hauteur: midi * 100, ecartGamme: 0, voisee: true };
    t += d * 0.25;
    return n;
  });
}
const C = 60, D = 62, E = 64, F = 65, G = 67, A = 69, B = 71;
const MELODIES: { nom: string; gamme: string; notes: [number, number][] }[] = [
  { nom: 'Frère Jacques', gamme: 'C-majeur', notes: [[C, 2], [D, 2], [E, 2], [C, 2], [C, 2], [D, 2], [E, 2], [C, 2], [E, 2], [F, 2], [G, 4], [E, 2], [F, 2], [G, 4], [G, 1], [A, 1], [G, 1], [F, 1], [E, 2], [C, 2], [G, 1], [A, 1], [G, 1], [F, 1], [E, 2], [C, 2], [C, 2], [G - 12, 2], [C, 4]] },
  { nom: 'Ode à la joie', gamme: 'D-majeur', notes: [[66, 2], [66, 2], [G, 2], [A, 2], [A, 2], [G, 2], [66, 2], [E, 2], [D, 2], [D, 2], [E, 2], [66, 2], [66, 3], [E, 1], [E, 4], [66, 2], [66, 2], [G, 2], [A, 2], [A, 2], [G, 2], [66, 2], [E, 2], [D, 2], [D, 2], [E, 2], [66, 2], [E, 3], [D, 1], [D, 4], [A - 12, 2], [D, 4]] },
  { nom: 'Joyeux anniversaire', gamme: 'F-majeur', notes: [[C, 1], [C, 1], [D, 2], [C, 2], [F, 2], [E, 4], [C, 1], [C, 1], [D, 2], [C, 2], [G, 2], [F, 4], [C, 1], [C, 1], [C + 12, 2], [A, 2], [F, 2], [E, 2], [D, 4], [70, 1], [70, 1], [A, 2], [F, 2], [G, 2], [F, 4]] },
  { nom: 'Greensleeves', gamme: 'A-mineur', notes: [[A, 2], [C + 12, 4], [D + 12, 2], [E + 12, 3], [F + 12, 1], [E + 12, 2], [D + 12, 4], [B, 2], [G, 3], [A, 1], [B, 2], [C + 12, 4], [A, 2], [A, 3], [68, 1], [A, 2], [B, 4], [68, 2], [E, 4], [A, 2], [C + 12, 4], [D + 12, 2], [E + 12, 3], [F + 12, 1], [E + 12, 2], [D + 12, 4], [B, 2], [G, 3], [A, 1], [B, 2], [C + 12, 3], [B, 1], [A, 2], [68, 3], [66, 1], [68, 2], [A, 6]] },
  { nom: 'La Marseillaise (début)', gamme: 'G-majeur', notes: [[D, 1], [D, 2], [D, 1], [G, 3], [G, 3], [A, 3], [A, 3], [D + 12, 5], [B, 1], [G, 2], [G, 1], [B, 1], [G, 2], [E, 1], [C + 12, 6], [A, 1], [66, 1], [G, 6]] },
];

describe('détection de la gamme (Krumhansl)', () => {
  for (const m of MELODIES) {
    it(`${m.nom} → ${m.gamme}`, () => {
      const g = detecterGamme(melodie(m.notes));
      console.log(m.nom, g.map((x) => `${x.tonique}-${x.mode} ${x.confiance}`).join(' | '));
      expect(g).toHaveLength(2);
      expect(`${g[0]!.tonique}-${g[0]!.mode}`).toBe(m.gamme);
      expect(g[0]!.confiance).toBeGreaterThan(g[1]!.confiance);
    });
  }

  it('la tonalité du morceau départage une voix qui hésite ; sans notes : []', () => {
    const hesite = melodie([[C, 2], [D, 2], [E, 2], [F, 2], [G, 2], [A, 2], [B, 2]]); // do majeur ou la mineur
    expect(detecterGamme(hesite, LA_MINEUR)[0]).toMatchObject(LA_MINEUR);
    expect(detecterGamme(hesite, { tonique: 'C', mode: 'majeur' })[0]).toMatchObject({ tonique: 'C', mode: 'majeur' });
    expect(detecterGamme([])).toEqual([]);
  });
});

describe('« Corriger tout seul » et conseil appliqué', () => {
  const { pcm, notes } = voixSynthese(9, FS);
  const { analyse } = analyserPcm('prise-x.f32', pcm, FS);

  it('gamme du morceau, notes recalées sur la gamme, notes courtes laissées, préréglage selon le style', () => {
    const c = corrigerToutSeul(analyse, LA_MINEUR);
    expect(c.gamme).toBe('morceau');
    expect(c.corrections.map((n) => n.midi)).toEqual(notes.map((n) => n.midi));
    expect(c.corrections.every((n) => n.cents === 0)).toBe(true);
    expect(['naturel', 'pop']).toContain(c.preset);
    expect(c.explication).toMatch(/notes? recalée/);
    expect(corrigerToutSeul(analyse, LA_MINEUR, 'trap').preset).toBe('robot');
    expect(corrigerToutSeul(analyse, LA_MINEUR, 'hyperpop').preset).toBe('hyperpop');
    expect(corrigerToutSeul(analyse, LA_MINEUR, 'jazz').preset).toBe('naturel');
    // Une note courte, et une note hors gamme chantée juste (voulue) : gardées telles quelles.
    const t = 10;
    const ajout = [{ debut: t, fin: t + 0.06, midi: 61, justesse: 22, vibrato: 0, vitesseVibrato: 0, hauteur: 6122, ecartGamme: 22, voisee: true }, { debut: t + 0.1, fin: t + 0.5, midi: 63, justesse: 5, vibrato: 0, vitesseVibrato: 0, hauteur: 6305, ecartGamme: 5, voisee: true }, { debut: t + 0.5, fin: t + 0.9, midi: 63, justesse: 40, vibrato: 0, vitesseVibrato: 0, hauteur: 6340, ecartGamme: 40, voisee: true }];
    const ce = corrigerToutSeul({ ...analyse, notes: [...analyse.notes, ...ajout] }, LA_MINEUR).corrections.slice(-3);
    expect(ce[0]).toMatchObject({ midi: 61, cents: 22, vibrato: 1 });
    expect(ce[1]!.midi).toBe(63); // ré# chanté juste : voulu
    expect(ce[2]!.midi).toBe(64); // ré# + 40 cents : mi
  });

  it('une voix qui chante nettement dans une autre gamme : la gamme détectée', () => {
    const c = corrigerToutSeul({ ...analyse, notes: melodie(MELODIES[1]!.notes) }, { tonique: 'F', mode: 'mineur' });
    expect(c.gamme).toEqual({ tonique: 'D', mode: 'majeur' });
  });

  it('appliquerConseil : réglages du préréglage + gamme + notes nettoyées ; prise inconnue : même objet', () => {
    const m = nouveauMorceau('trap', 'Conseil');
    const p = { id: 'p', ancre: { section: m.sections[0]!.id, occurrence: 0, mesure: 0 }, tempo: 120, fichier: 'prise-abc.f32', frequence: 48000, duree: 2, debutCoupe: 0, finCoupe: 2, decalage: 0, gain: 1, choisie: true };
    m.prises = [p, { ...p, id: 'q', fichier: 'prise-q.f32' }];
    const notesSales = [{ debut: 1, fin: 3, midi: 200, cents: 500, vibrato: -1 }, { debut: 0, fin: 1.2, midi: 60, cents: 0, vibrato: 1 }, { debut: 0.5, fin: 0.7, midi: 61, cents: 0, vibrato: 1 }];
    const r = appliquerConseil(m, 'p', { gamme: { tonique: 'D', mode: 'majeur' }, corrections: notesSales, preset: 'robot' });
    expect(r).not.toBe(m);
    expect(r.prises[1]).toBe(m.prises[1]);
    expect(r.prises[0]!.autotune).toEqual({ ...reglagesPreset('robot'), gamme: { tonique: 'D', mode: 'majeur' }, notes: [{ debut: 0, fin: 1.2, midi: 60, cents: 0, vibrato: 1 }] });
    expect(appliquerConseil(m, 'inconnue', { gamme: 'morceau', corrections: [], preset: 'pop' })).toBe(m);
    expect(nettoyerNotes(notesSales, 2)).toHaveLength(1);
  });
});

describe('fichiers rendus et ménage', () => {
  const prise = { fichier: 'prise-abc123.f32', frequence: 48000 };
  it('nom déterministe, préfixe « auto- », qui change avec le son et pas avec le nom du préréglage', () => {
    const r = reglagesPreset('pop');
    const nom = nomRenduAutotune(prise, r, LA_MINEUR);
    expect(nom).toMatch(/^auto-prise-abc123-av[0-9a-f]{14}\.f32$/);
    expect(FICHIER_PRISE.test(nom)).toBe(true);
    expect(nomRenduAutotune(prise, { ...r, preset: 'perso' }, LA_MINEUR)).toBe(nom);
    expect(nomRenduAutotune(prise, r, { tonique: 'C', mode: 'majeur' })).toBe(nom); // relative : mêmes notes
    expect(nomRenduAutotune(prise, { ...r, gamme: LA_MINEUR }, undefined)).toBe(nom);
    expect(nomRenduAutotune(prise, { ...r, formants: 1 }, LA_MINEUR)).not.toBe(nom);
    expect(nomRenduAutotune(prise, { ...r, notes: [{ debut: 0, fin: 1, midi: 60, cents: 0, vibrato: 1 }] }, LA_MINEUR)).not.toBe(nom);
  });

  it('fichiersAutotune garde le rendu avancé d’une prise choisie ; le ménage efface les anciens', () => {
    const m = nouveauMorceau('trap', 'Ménage');
    m.tonalite = LA_MINEUR;
    const p = { id: 'p', ancre: { section: m.sections[0]!.id, occurrence: 0, mesure: 0 }, tempo: 120, fichier: 'prise-abc123.f32', frequence: 48000, duree: 1, debutCoupe: 0, finCoupe: 1, decalage: 0, gain: 1, choisie: true, autotune: reglagesPreset('robot') };
    m.prises = [p, { ...p, id: 'q', fichier: 'prise-q.f32', choisie: false }];
    m.pistes = m.pistes.map((x) => (x.id === 'voix' ? { ...x, effets: { autotune: 0.5 } } : x));
    const nom = nomRenduAutotune(p, p.autotune, LA_MINEUR);
    expect(fichiersAutotune(m)).toEqual([nom]); // le réglage avancé l'emporte sur le curseur simple
    const vieux = nomRenduAutotune(p, reglagesPreset('pop'), LA_MINEUR);
    const tous = [nom, nom.replace('.f32', '.json'), vieux, vieux.replace('.f32', '.json'), 'auto-prise-abc123-0.5-A-mineur.f32', 'prise-abc123.f32'];
    const utilises = new Set(['prise-abc123.f32', ...fichiersAutotune(m)]);
    expect(choisirOrphelins(tous.map((n) => ({ nom: n, modifie: 0 })), utilises, 10, 1, 5)).toEqual(tous.slice(2, 5));
    // Un morceau brut abîmé ne fait pas planter le ménage.
    expect(fichiersAutotune({ ...m, prises: [{ ...p, autotune: { gamme: 'morceau' } as never }] }).length).toBeLessThanOrEqual(1);
  });
});
