import { describe, expect, it } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import { nettoyerLigne, parolesMusixmatch, vers } from './paroles';

function morceau(paroles: Record<string, string>, ordre?: string[]) {
  const m = nouveauMorceau('trap', 'Nuit');
  m.sections = m.sections.map((s) => ({ ...s, paroles: paroles[s.id] ?? '' }));
  if (ordre) m.ordre = ordre;
  return m;
}

describe('parolesMusixmatch', () => {
  it('chaque apparition écrite en entier (le refrain qui revient est réécrit), une ligne vide entre les sections', () => {
    const m = morceau({ couplet: 'Je pars de rien\nJ’avance au pouce', refrain: 'Oh oh\nNuit blanche' });
    // ordre : intro, couplet, refrain, couplet, refrain, outro (intro et outro sans paroles)
    expect(parolesMusixmatch(m)).toBe(
      ['Je pars de rien\nJ’avance au pouce', 'Oh oh\nNuit blanche', 'Je pars de rien\nJ’avance au pouce', 'Oh oh\nNuit blanche'].join('\n\n'),
    );
  });

  it('aucune étiquette, espaces nettoyés, lignes vides retirées dans une section', () => {
    const m = morceau(
      { refrain: '[Refrain]\n  Oh   oh  \n\n\tNuit\u00a0blanche,\nRefrain :\n(Couplet 2)\nREFRAIN x2\n{Hook}' },
      ['refrain'],
    );
    expect(parolesMusixmatch(m)).toBe('Oh oh\nNuit blanche');
  });

  it('« x2 » en fin de ligne : la ligne est écrite deux fois ; « Max2 » n’est pas touché', () => {
    expect(vers('Encore (x2)\nEncore une fois x3\nMax2')).toEqual(['Encore', 'Encore', 'Encore une fois', 'Encore une fois', 'Encore une fois', 'Max2']);
  });

  it('virgule ou point final retirés, mais pas « ... », « ? » ni « ! »', () => {
    expect(nettoyerLigne('Je marche, ')).toBe('Je marche');
    expect(nettoyerLigne('Fin.')).toBe('Fin');
    expect(nettoyerLigne('Et après...')).toBe('Et après...');
    expect(nettoyerLigne('Tu viens ?')).toBe('Tu viens ?');
    expect(nettoyerLigne('Allez !')).toBe('Allez !');
    expect(nettoyerLigne('a\u200bb')).toBe('ab');
  });

  it('fins de ligne Windows, section inconnue dans l’ordre sautée, rien du tout → chaîne vide', () => {
    expect(parolesMusixmatch(morceau({ couplet: 'Un\r\nDeux\r\n' }, ['couplet', 'fantome']))).toBe('Un\nDeux');
    expect(parolesMusixmatch(morceau({}))).toBe('');
    expect(parolesMusixmatch(morceau({ refrain: '[Refrain]\n\n' }))).toBe('');
  });
});
