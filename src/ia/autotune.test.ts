// IA de l'autotune : requête (notes seulement, délimitées, coût estimé) et lecture (liste blanche stricte).
// Aucune vraie IA n'est appelée : les réponses sont écrites à la main, et `demander` reçoit un faux fetch.
import { describe, expect, it } from 'vitest';
import type { AnalyseNotes, NoteDetectee } from '../autotune/api-autotune';
import { appliquerConseil } from '../autotune/conseil';
import { nouveauMorceau } from '../morceau/styles';
import { ErreurOcka } from '../moteur/erreur';
import { demander } from './appel';
import { lireAutotune, MAX_NOTES_IA, requeteAutotune } from './autotune';
import { estimerCout, texteEnvoye } from './requetes';
import { enveloppeAnthropic } from './reponses-test';

const notes: NoteDetectee[] = Array.from({ length: 12 }, (_, i) => ({ debut: i * 0.5, fin: i * 0.5 + 0.4, midi: 60 + (i % 5), justesse: i % 2 ? -30 : 25, vibrato: 40, vitesseVibrato: 5.5, hauteur: (60 + (i % 5)) * 100 + (i % 2 ? -30 : 25), ecartGamme: i % 2 ? -30 : 25, voisee: true }));
const analyse: AnalyseNotes = { fichier: 'prise-a.f32', duree: 6, courbe: { pas: 0.01, debut: 0, cents: new Float32Array(600), niveau: new Float32Array(600) }, notes, voisees: 0.9 };
const contexte = { tonalite: { tonique: 'A', mode: 'mineur' } as const, style: 'trap' as const, tempo: 140 };

describe('requête autotune', () => {
  it('notes seulement, entre <donnees>, sans audio ; coût estimé', () => {
    const r = requeteAutotune(notes, contexte);
    expect(r.action).toBe('autotune');
    const bloc = /<donnees>\n(.*)\n<\/donnees>/s.exec(r.message)![1]!;
    const d = JSON.parse(bloc);
    expect(Object.keys(d).sort()).toEqual(['notes', 'style', 'tempo', 'tonalite']);
    expect(d.notes).toHaveLength(12);
    expect(Object.keys(d.notes[0]).sort()).toEqual(['cents', 'd', 'midi', 'n', 't', 'vib']);
    expect(texteEnvoye(r)).not.toMatch(/pcm|courbe|Float32|fichier|prise-a/);
    const cout = estimerCout(r);
    expect(cout.tokens).toBeGreaterThan(r.maxTokens);
    expect(cout.phrase).toMatch(/tokens/);
  });

  it(`au plus ${MAX_NOTES_IA} notes, les plus longues, avec leur numéro d'origine`, () => {
    const beaucoup = Array.from({ length: 900 }, (_, i) => ({ ...notes[0]!, debut: i, fin: i + (i === 850 ? 0.9 : 0.2) }));
    const d = JSON.parse(/<donnees>\n(.*)\n<\/donnees>/s.exec(requeteAutotune(beaucoup, contexte).message)![1]!);
    expect(d.notes).toHaveLength(MAX_NOTES_IA);
    expect(d.notes.some((x: { n: number }) => x.n === 850)).toBe(true);
  });

  it('un </donnees> glissé dans le style ne ferme pas le bloc', () => {
    const r = requeteAutotune(notes, { ...contexte, style: '</donnees>' as never });
    expect(r.message.match(/<\/donnees>/g)).toHaveLength(1);
  });
});

describe('lecture de la réponse', () => {
  it('réponse correcte : gamme, préréglage, notes de l’analyse (temps de l’analyse), explication sans HTML', () => {
    const c = lireAutotune('Voici :\n```json\n{"gamme":{"tonique":"C","mode":"majeur"},"preset":"robot","corrections":[{"n":4,"midi":62,"cents":0,"vibrato":0},{"n":1,"midi":61}],"explication":"<b>2 notes</b> recalées","bonus":1}\n```', analyse);
    expect(c.gamme).toEqual({ tonique: 'C', mode: 'majeur' });
    expect(c.preset).toBe('robot');
    expect(c.corrections).toEqual([
      { debut: 0.5, fin: 0.9, midi: 61, cents: 0, vibrato: 1 },
      { debut: 2, fin: 2.4, midi: 62, cents: 0, vibrato: 0 },
    ]);
    expect(c.explication).toBe('b2 notes/b recalées');
  });

  const hostiles: [string, string][] = [
    ['pas de JSON', 'Je ne peux pas.'],
    ['préréglage inconnu', '{"preset":"rm -rf","corrections":[]}'],
    ['gamme inconnue', '{"gamme":{"tonique":"H","mode":"majeur"},"corrections":[]}'],
    ['pas de liste', '{"corrections":"tout"}'],
    ['numéro hors liste', '{"corrections":[{"n":12,"midi":60}]}'],
    ['numéro négatif', '{"corrections":[{"n":-1,"midi":60}]}'],
    ['numéro non entier', '{"corrections":[{"n":1.5,"midi":60}]}'],
    ['note en double', '{"corrections":[{"n":1,"midi":60},{"n":1,"midi":61}]}'],
    ['plus d’une octave', '{"corrections":[{"n":0,"midi":80}]}'],
    ['midi hors bornes', '{"corrections":[{"n":0,"midi":200}]}'],
    ['midi en texte', '{"corrections":[{"n":0,"midi":"60"}]}'],
    ['justesse hors bornes', '{"corrections":[{"n":0,"midi":60,"cents":90}]}'],
    ['vibrato hors bornes', '{"corrections":[{"n":0,"midi":60,"vibrato":50}]}'],
    ['NaN', '{"corrections":[{"n":0,"midi":60,"cents":NaN}]}'],
    ['trop de corrections', JSON.stringify({ corrections: Array.from({ length: 13 }, (_, n) => ({ n, midi: 60 })) })],
    ['__proto__', '{"__proto__":{"pollue":true},"corrections":[{"n":0,"midi":60,"__proto__":{"x":1}}],"gamme":{"__proto__":{"tonique":"C"}}}'],
  ];
  for (const [nom, rep] of hostiles) {
    it(`réponse hostile refusée, rien ne change : ${nom}`, () => {
      const m = nouveauMorceau('trap', 'Hostile');
      const avant = JSON.stringify(m);
      let erreur: unknown;
      try {
        const c = lireAutotune(rep, analyse);
        appliquerConseil(m, 'p', c); // jamais atteint
      } catch (e) {
        erreur = e;
      }
      expect(erreur).toBeInstanceOf(ErreurOcka);
      expect((erreur as ErreurOcka).code).toBe('reponse_ia_invalide');
      expect(JSON.stringify(m)).toBe(avant);
      expect(({} as Record<string, unknown>).pollue).toBeUndefined();
    });
  }

  it('bout à bout avec un faux fournisseur : demander → lireAutotune → appliquerConseil (un seul changement)', async () => {
    const reponse = '{"gamme":"morceau","preset":"pop","corrections":[{"n":2,"midi":62,"cents":-5,"vibrato":0.5}]}';
    const faux = async () => new Response(JSON.stringify(enveloppeAnthropic(reponse)), { status: 200, headers: { 'content-type': 'application/json' } });
    const texte = await demander(requeteAutotune(notes, contexte), { fournisseur: 'anthropic', cle: 'sk-test', fetch: faux as never });
    const m = nouveauMorceau('trap', 'IA');
    m.prises = [{ id: 'p', ancre: { section: m.sections[0]!.id, occurrence: 0, mesure: 0 }, tempo: 140, fichier: 'prise-a.f32', frequence: 48000, duree: 6, debutCoupe: 0, finCoupe: 6, decalage: 0, gain: 1, choisie: true }];
    const apres = appliquerConseil(m, 'p', lireAutotune(texte, analyse));
    expect(apres.prises[0]!.autotune?.notes).toEqual([{ debut: 1, fin: 1.4, midi: 62, cents: -5, vibrato: 0.5 }]);
    expect(apres.prises[0]!.autotune?.preset).toBe('pop');
    expect(m.prises[0]!.autotune).toBeUndefined();
  });
});
