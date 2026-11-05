import { describe, expect, it } from 'vitest';
import { T as ancien } from '../textes-fr';
import { GROUPES_TEXTES, T } from '.';

describe('textes', () => {
  it('aucun groupe de premier niveau en double entre les fichiers', () => {
    const vus = new Map<string, string>();
    for (const [fichier, groupe] of Object.entries(GROUPES_TEXTES)) {
      for (const cle of Object.keys(groupe)) {
        expect(vus.get(cle), `« ${cle} » est dans ${vus.get(cle)} et ${fichier}`).toBeUndefined();
        vus.set(cle, fichier);
      }
    }
  });
  it('textes-fr.ts redonne le même objet T', () => {
    expect(ancien).toBe(T);
    expect(T.accueil.titre).toBe('Mes morceaux');
    expect(T.instruments.perso1).toBe('Ton son 1');
    expect(T.son.noms.melodie).toBe('Mélodie');
  });
});
