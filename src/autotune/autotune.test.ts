import { describe, expect, it } from 'vitest';
import { choisirOrphelins } from '../enregistrement/prises';
import { FICHIER_PRISE } from '../enregistrement/fichiers-opfs';
import { nouveauMorceau } from '../morceau/styles';
import { reechantillonner } from '../moteur/reechantillonner';
import { fichiersAutotune, forceAutotune, nomAutotune } from './autotune';
import { corrigerVoix, PART_VOISEE_MIN } from './correction';
import { gamme, noteProche, nomTonalite } from './gamme';
import { bruitBlanc, voixSynthese, type NoteChantee } from './voix-synthese';
import { analyserHauteur } from './yin';

const FS = 48000;
const LA_MINEUR = { tonique: 'A', mode: 'mineur' } as const;

/** Médiane de la hauteur (cents) au milieu de chaque note (sans la consonne ni les bords). */
function hauteursNotes(pcm: Float32Array, notes: NoteChantee[]): number[] {
  const h = analyserHauteur(reechantillonner(pcm, FS, 24000), 24000);
  return notes.map((n) => {
    const v: number[] = [];
    for (let i = 0; i < h.cents.length; i++) {
      const t = i * h.pas + h.centre;
      if (t > n.debut + 0.12 && t < n.debut + n.duree - 0.06 && !Number.isNaN(h.cents[i]!)) v.push(h.cents[i]!);
    }
    v.sort((a, b) => a - b);
    return v.length ? v[v.length >> 1]! : NaN;
  });
}

describe('gamme', () => {
  it('la mineur, note la plus proche, nom de fichier', () => {
    expect(gamme(LA_MINEUR)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(gamme({ tonique: 'C#', mode: 'majeur' })).toEqual([0, 1, 3, 5, 6, 8, 10]);
    expect(noteProche(5240, gamme(LA_MINEUR))).toBe(5200); // mi + 40 cents → mi (fa est à 60)
    expect(noteProche(5940, gamme(LA_MINEUR))).toBe(5900); // si + 40 → si
    expect(nomTonalite({ tonique: 'C#', mode: 'mineur' })).toBe('Cdiese-mineur');
  });
});

describe('autotune doux', () => {
  it('une voix de synthèse qui chante faux (±30 à 40 cents) ressort à ±15 cents, sans erreur d’octave, même longueur', () => {
    const { pcm, notes } = voixSynthese(9, FS);
    const avant = hauteursNotes(pcm, notes);
    const r = corrigerVoix(pcm, FS, 1, LA_MINEUR);
    expect(r.applique).toBe(true);
    expect(r.voisees).toBeGreaterThan(PART_VOISEE_MIN);
    expect(r.pcm.length).toBe(pcm.length);
    const apres = hauteursNotes(r.pcm, notes);
    const ecartsAvant = notes.map((n, i) => avant[i]! - n.midi * 100);
    const ecartsApres = notes.map((n, i) => apres[i]! - n.midi * 100);
    // La détection voit bien la voix fausse…
    for (const [i, n] of notes.entries()) expect(Math.abs(ecartsAvant[i]! - n.faux)).toBeLessThan(8);
    // … et la sortie est juste, sur la bonne note (pas d'octave en trop ou en moins).
    console.log('écarts après (cents) :', ecartsApres.map((e) => Math.round(e)).join(' '));
    for (const e of ecartsApres) expect(Math.abs(e)).toBeLessThanOrEqual(15);
  });

  it('force moyenne : la voix se rapproche de la note sans y être collée', () => {
    const { pcm, notes } = voixSynthese(4, FS);
    const r = corrigerVoix(pcm, FS, 0.3, LA_MINEUR);
    const apres = hauteursNotes(r.pcm, notes);
    for (const [i, n] of notes.entries()) {
      const e = Math.abs(apres[i]! - n.midi * 100);
      expect(e).toBeLessThan(Math.abs(n.faux) - 10);
    }
  });

  it('un bruit (sans hauteur) n’est pas modifié : repli, au bit près', () => {
    const x = bruitBlanc(3, FS);
    const r = corrigerVoix(x, FS, 1, LA_MINEUR);
    expect(r.applique).toBe(false);
    expect(r.voisees).toBeLessThan(PART_VOISEE_MIN);
    expect(r.pcm).toEqual(x);
  });

  it('les sons non voisés (consonnes, silences) sont recopiés tels quels', () => {
    const { pcm } = voixSynthese(3, FS);
    const silence = new Float32Array(FS); // 1 s de silence devant
    const x = new Float32Array(pcm.length + FS);
    x.set(silence);
    x.set(pcm, FS);
    const r = corrigerVoix(x, FS, 1, LA_MINEUR);
    expect(r.applique).toBe(true);
    expect(r.pcm.subarray(0, FS - 2000)).toEqual(x.subarray(0, FS - 2000));
  });
});

describe('fichiers de l’autotune', () => {
  it('nom, fichiers utilisés et ramasse-miettes : seule la version actuelle est gardée', () => {
    const m = nouveauMorceau('trap', 'Auto');
    m.tonalite = { tonique: 'C#', mode: 'mineur' };
    const prise = { id: 'p', ancre: { section: m.sections[0]!.id, occurrence: 0, mesure: 0 }, tempo: 120, fichier: 'prise-abc123.f32', frequence: 48000, duree: 1, debutCoupe: 0, finCoupe: 1, decalage: 0, gain: 1, choisie: true };
    m.prises = [prise, { ...prise, id: 'q', fichier: 'prise-pas-choisie.f32', choisie: false }];
    expect(fichiersAutotune(m)).toEqual([]); // autotune éteint
    m.pistes = m.pistes.map((p) => (p.id === 'voix' ? { ...p, effets: { autotune: 0.66 } } : p));
    expect(forceAutotune(m)).toBe(0.7);
    const nom = nomAutotune('prise-abc123.f32', 0.7, m.tonalite);
    expect(nom).toBe('auto-prise-abc123-0.7-Cdiese-mineur.f32');
    expect(FICHIER_PRISE.test(nom)).toBe(true);
    expect(fichiersAutotune(m)).toEqual([nom]);
    const utilises = new Set(['prise-abc123.f32', ...fichiersAutotune(m)]);
    const vieux = [nom, nom.replace('.f32', '.json'), 'auto-prise-abc123-0.3-Cdiese-mineur.f32', 'auto-prise-abc123-0.3-Cdiese-mineur.json', 'auto-prise-mort-1.0-C-majeur.f32', 'prise-abc123.f32'];
    expect(choisirOrphelins(vieux.map((n) => ({ nom: n, modifie: 0 })), utilises, 10, 1, 5)).toEqual(vieux.slice(2, 5));
  });
});
