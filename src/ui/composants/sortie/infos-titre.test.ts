import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../../../morceau/styles';
import { ajouterCredit, completerInfos, deplacer, infosCompletes, nettoyerIsrc, reglerCredit, reglerIa, reglerInfo, retirerCredit } from './infos-titre';

describe('infos d’un titre (assistant)', () => {
  it('completerInfos : IA « aucune » et crédits avec le vrai nom, sans rien écraser', () => {
    const m = nouveauMorceau('trap', 'Nuit');
    const c = completerInfos(m, 'Romain Dupont');
    expect(c.infos).toEqual({
      ia: { paroles: 'aucune', musique: 'aucune', voix: 'aucune' },
      credits: [
        { nom: 'Romain Dupont', role: 'auteur' },
        { nom: 'Romain Dupont', role: 'compositeur' },
        { nom: 'Romain Dupont', role: 'producteur' },
      ],
    });
    expect(completerInfos(c, 'Autre Nom')).toBe(c);
    const deja = reglerInfo(m, 'credits', [{ nom: 'Léa Martin', role: 'compositeur' }]);
    expect(completerInfos(deja, 'Romain Dupont').infos!.credits).toEqual([{ nom: 'Léa Martin', role: 'compositeur' }]);
    expect(completerInfos(m).infos).toEqual({ ia: { paroles: 'aucune', musique: 'aucune', voix: 'aucune' } });
  });
  it('crédits : ajouter (rôle manquant d’abord), modifier, retirer', () => {
    let m = ajouterCredit(nouveauMorceau('trap', 'Nuit'));
    m = ajouterCredit(m);
    expect(m.infos!.credits!.map((c) => c.role)).toEqual(['auteur', 'compositeur']);
    m = reglerCredit(m, 1, { nom: 'Léa Martin' });
    expect(m.infos!.credits![1]).toEqual({ nom: 'Léa Martin', role: 'compositeur' });
    m = retirerCredit(retirerCredit(m, 0), 0);
    expect(m.infos!.credits).toBeUndefined();
  });
  it('IA, explicite, ISRC, liste complète, flèches', () => {
    const m = reglerIa(nouveauMorceau('trap', 'Nuit'), 'voix', 'ia');
    expect(m.infos!.ia).toEqual({ paroles: 'aucune', musique: 'aucune', voix: 'ia' });
    expect(infosCompletes(m)).toBe(false);
    const ok = reglerInfo(completerInfos(m, 'Romain Dupont'), 'explicite', false);
    expect(infosCompletes(ok)).toBe(true);
    expect(nettoyerIsrc('fr-ab1 2400001xx')).toBe('FRAB12400001');
    expect(deplacer(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(deplacer(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
