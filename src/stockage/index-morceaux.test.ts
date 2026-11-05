import { describe, expect, it } from 'vitest';
import { choisirOrphelins } from '../enregistrement/prises';
import { FORMAT_MORCEAU, type Morceau, type Prise } from '../morceau/types';
import { fichiersUtilises, indexValide, majIndex, resumer, retirerDeIndex, titreCopie } from './index-morceaux';

function morceau(prises: Partial<Prise>[] = []): Morceau {
  return {
    format: FORMAT_MORCEAU,
    titre: 'Nuit',
    style: 'trap',
    tempo: 120,
    swing: 0,
    tonalite: { tonique: 'A', mode: 'mineur' },
    kit: 'trap@1',
    motifs: {},
    sections: [
      { id: 'a', nom: 'Intro', mesures: 2, motifs: {} },
      { id: 'b', nom: 'Couplet', mesures: 8, motifs: {} },
    ],
    ordre: ['a', 'b', 'b'],
    pistes: [],
    prises: prises as Prise[],
    master: { preset: 'neutre', niveau: 'standard', chaine: 2 },
  };
}

describe('index de « Mes morceaux »', () => {
  it('résumé : titre, style, durée (18 mesures à 120 BPM = 36 s) et date', () => {
    expect(resumer('m1', morceau(), 1000)).toEqual({ id: 'm1', titre: 'Nuit', style: 'trap', duree: 36, modifieLe: 1000 });
  });

  it('titre vide → « Sans titre »', () => {
    expect(resumer('m1', { ...morceau(), titre: '  ' }, 0).titre).toBe('Sans titre');
  });

  it('mise à jour : remplace la ligne, le plus récent en premier', () => {
    let index = majIndex([], resumer('a', morceau(), 1));
    index = majIndex(index, resumer('b', morceau(), 2));
    index = majIndex(index, resumer('a', { ...morceau(), titre: 'Jour' }, 3));
    expect(index.map((r) => [r.id, r.titre])).toEqual([
      ['a', 'Jour'],
      ['b', 'Nuit'],
    ]);
    expect(retirerDeIndex(index, 'a').map((r) => r.id)).toEqual(['b']);
  });

  it('un index abîmé est nettoyé', () => {
    expect(indexValide('n’importe quoi')).toEqual([]);
    expect(indexValide([null, { id: 'x' }, 3])).toEqual([{ id: 'x' }]);
  });

  it('titre des copies', () => {
    expect(titreCopie('Nuit', ['Nuit'])).toBe('Nuit (copie)');
    expect(titreCopie('Nuit', ['Nuit', 'Nuit (copie)'])).toBe('Nuit (copie 2)');
    expect(titreCopie('Nuit (copie)', ['Nuit', 'Nuit (copie)'])).toBe('Nuit (copie 2)');
  });
});

describe('nettoyage des prises', () => {
  it('fichiers utilisés par les morceaux', () => {
    const u = fichiersUtilises([morceau([{ fichier: 'prise-1.f32' }]), morceau([{ fichier: 'prise-2.f32' }, { fichier: 'prise-1.f32' }])]);
    expect([...u].sort()).toEqual(['prise-1.f32', 'prise-2.f32']);
  });

  it('efface seulement nos vieux fichiers que personne n’utilise', () => {
    const heure = 3600_000;
    const fichiers = [
      { nom: 'prise-1.f32', modifie: 0 },
      { nom: 'prise-1.json', modifie: 0 },
      { nom: 'prise-2.f32', modifie: 0 },
      { nom: 'prise-2.json', modifie: 0 },
      { nom: 'prise-3.f32', modifie: 10 * heure }, // trop récent : peut-être pas encore sauvé
      { nom: 'prise-4.f32.crswap', modifie: 0 }, // fichier temporaire de Chrome
    ];
    // Séance commencée à 9 h, il est 10 h 30.
    expect(choisirOrphelins(fichiers, new Set(['prise-1.f32']), 10.5 * heure, heure, 9 * heure)).toEqual(['prise-2.f32', 'prise-2.json']);
  });

  it('au démarrage : un orphelin d’avant la séance part, même récent ; un de la séance attend 1 h', () => {
    const heure = 3600_000;
    const fichiers = [
      { nom: 'prise-a.f32', modifie: 8.9 * heure }, // séance précédente
      { nom: 'prise-b.f32', modifie: 9.05 * heure }, // cette séance, 3 min : Annuler peut la ramener
      { nom: 'prise-c.f32', modifie: 7.5 * heure }, // utilisé
    ];
    expect(choisirOrphelins(fichiers, new Set(['prise-c.f32']), 9.1 * heure, heure, 9 * heure)).toEqual(['prise-a.f32']);
    expect(choisirOrphelins(fichiers, new Set(['prise-c.f32']), 10.1 * heure, heure, 9 * heure)).toEqual(['prise-a.f32', 'prise-b.f32']);
  });
});
