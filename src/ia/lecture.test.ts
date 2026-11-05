// Lecture des réponses de l'IA : liste blanche AVANT le normaliseur, réponses hostiles, infos.ia.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../morceau/normaliser';
import { nouveauMorceau } from '../morceau/styles';
import type { Morceau } from '../morceau/types';
import { ErreurOcka } from '../moteur/erreur';
import { appliquerParoles, marquerIa } from './infos-ia';
import { lireBeat, lireParoles, lireSuite } from './lecture';
import { BEAT_OK, PAROLES_OK, SUITE_OK } from './reponses-test';
import { compterSyllabes } from './syllabes';

const json = (v: unknown) => JSON.stringify(v);

function erreurDe(f: () => unknown): ErreurOcka {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurOcka);
    return e as ErreurOcka;
  }
  throw new Error('Une erreur était attendue.');
}

/** Un morceau ouvert avec des choses que l'IA ne doit jamais toucher. */
function morceauOuvert(): Morceau {
  const m = nouveauMorceau('trap', 'Mon son');
  m.prises = [{ id: 'p1', ancre: { section: 'couplet', occurrence: 0, mesure: 0 }, tempo: 140, fichier: 'prise-p1.f32', frequence: 48000, duree: 10, debutCoupe: 0, finCoupe: 10, decalage: 0, gain: 1, choisie: true }];
  m.sons = [{ id: 's1', nom: 'Mon son', fichier: 'son-s1.f32', frequence: 48000, duree: 2, canaux: 1 }];
  m.pads = { perso1: 's1' };
  m.infos = { explicite: false, langue: 'fr', ia: { paroles: 'aucune', musique: 'aucune', voix: 'aucune' } };
  m.master = { preset: 'chaud', niveau: 'fort', chaine: 2 };
  return normaliserMorceau(m).morceau;
}

describe('« Lance-moi un beat »', () => {
  it('un beat correct donne un morceau complet, normalisé et jouable, avec musique « ia » (tout écrit par l’IA)', () => {
    const { morceau: m, ignores } = lireBeat(`Voici ton beat :\n\`\`\`json\n${json(BEAT_OK)}\n\`\`\``);
    expect(ignores).toEqual([]);
    expect(m).toMatchObject({ format: 'ocka.morceau/2', style: 'phonk', tempo: 135, kit: 'phonk@1', titre: 'Drift de minuit' });
    expect(m.sections).toHaveLength(3);
    expect(m.ordre).toHaveLength(5);
    expect(m.pistes).toHaveLength(6);
    expect(m.prises).toEqual([]);
    expect(m.master.chaine).toBe(2);
    // L'écriture compacte de la batterie devient des vélocités.
    const bat = m.motifs.bat;
    expect(bat?.type === 'batterie' && bat.pistes.kick?.slice(0, 7)).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(m.infos?.ia).toEqual({ paroles: 'aucune', musique: 'ia', voix: 'aucune' });
    // Normaliser encore ne change rien : le morceau est propre.
    expect(normaliserMorceau(m).morceau).toEqual(m);
  });

  it('paroles écrites dans le beat : paroles « ia » aussi', () => {
    const avec = { ...BEAT_OK, sections: BEAT_OK.sections.map((x, i) => (i === 0 ? { ...x, paroles: 'Une ligne de l’IA' } : x)) };
    expect(lireBeat(json(avec)).morceau.infos?.ia).toEqual({ paroles: 'ia', musique: 'ia', voix: 'aucune' });
  });

  it('champs interdits (prises, sons, pads, infos, master, kit, boucle, pads perso) : ignorés AVANT le normaliseur', () => {
    const hostile = {
      ...BEAT_OK,
      prises: [{ id: 'x', fichier: 'prise-x.f32' }],
      sons: [{ id: 'x', fichier: 'son-x.f32', nom: 'vol' }],
      pads: { perso1: 'x' },
      infos: { ia: { musique: 'aucune', paroles: 'aucune', voix: 'aucune' }, isrc: 'FRAB12400001' },
      master: { preset: 'lofi', niveau: 'fort', chaine: 1 },
      kit: 'trap@9',
      pistes: [{ id: 'voix', volume: 1.5 }],
      sections: [{ ...BEAT_OK.sections[0], boucle: { son: 'x', mesures: 4, caler: true } }],
      motifs: { ...BEAT_OK.motifs, bat: { ...BEAT_OK.motifs.bat, pistes: { ...BEAT_OK.motifs.bat.pistes, perso1: 'xxxxxxxxxxxxxxxx' } } },
    };
    const { morceau: m, ignores } = lireBeat(json(hostile));
    expect(ignores).toEqual(expect.arrayContaining(['prises', 'sons', 'pads', 'infos', 'master', 'kit', 'pistes', 'sections[0].boucle', 'motifs.bat.pistes.perso1']));
    expect(m.prises).toEqual([]);
    expect(m.sons).toBeUndefined();
    expect(m.pads).toBeUndefined();
    expect(m.kit).toBe('phonk@1');
    expect(m.master).toEqual({ preset: 'neutre', niveau: 'standard', chaine: 2 });
    expect(m.infos).toEqual({ ia: { paroles: 'aucune', musique: 'ia', voix: 'aucune' } });
    expect(m.sections[0]!.boucle).toBeUndefined();
    const bat = m.motifs.bat;
    expect(bat?.type === 'batterie' && bat.pistes.perso1).toBeFalsy();
  });

  it('« __proto__ » et « constructor » en ids ou en clés : Object.prototype reste intact', () => {
    const texte = `{"__proto__":{"pollue":1},"titre":"x","constructor":{"prototype":{"pollue":2}},"style":"trap",
      "motifs":{"__proto__":{"type":"batterie","pas":16,"pistes":{"kick":"x---x---x---x---","__proto__":"xxxx"}}},
      "sections":[{"id":"__proto__","nom":"A","mesures":4,"motifs":{"batterie":"__proto__"}}],"ordre":["__proto__"]}`;
    const { morceau: m } = lireBeat(texte);
    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('pollue');
    expect(m.sections).toHaveLength(1);
    expect(m.sections[0]!.id).not.toBe('__proto__');
    expect(Object.keys(m.motifs)).not.toContain('__proto__');
  });

  it('texte avec du HTML : gardé tel quel comme texte (l’interface l’affiche en texte brut), sans caractère de contrôle', () => {
    const { morceau: m } = lireBeat(json({ ...BEAT_OK, titre: '<script>alert(1)</script>\u0000\u0007Beat' }));
    expect(m.titre).toBe('<script>alert(1)</script>  Beat');
  });

  it('JSON géant (dizaines de milliers de notes, textes immenses) : coupé aux plafonds, sans exploser', () => {
    const notes = Array.from({ length: 50_000 }, (_, i) => ({ pas: i % 64, duree: 1, midi: 60 + (i % 12) }));
    const motifs: Record<string, unknown> = { ...BEAT_OK.motifs, mel: { type: 'melodie', pas: 64, son: 'piano', notes } };
    for (let i = 0; i < 500; i++) motifs[`m${i}`] = { type: 'batterie', pas: 16, pistes: { kick: 'x'.repeat(5000) } };
    const geant = { ...BEAT_OK, titre: 'T'.repeat(100_000), motifs, ordre: Array(5000).fill('couplet') };
    const debut = performance.now();
    const { morceau: m } = lireBeat(json(geant));
    expect(performance.now() - debut).toBeLessThan(3000);
    expect(m.titre.length).toBeLessThanOrEqual(100);
    expect(Object.keys(m.motifs).length).toBeLessThanOrEqual(64);
    expect(m.ordre.length).toBeLessThanOrEqual(200);
    for (const mo of Object.values(m.motifs)) if (mo.type === 'melodie') expect(mo.notes.length).toBeLessThanOrEqual(512);
  });

  it('réponses mal formées → message clair « Rien n’a été changé »', () => {
    for (const mauvais of ['', 'Désolé, je ne peux pas.', '{"titre": "coupé', '[1,2,3]', '{"titre":"x"}', json({ ...BEAT_OK, sections: 'non' })]) {
      const e = erreurDe(() => lireBeat(mauvais));
      expect(e.code).toBe('reponse_ia_invalide');
      expect(e.message).toContain('Rien n’a été changé');
    }
    // Des sections, mais aucune note nulle part.
    const muet = { titre: 'x', style: 'trap', sections: [{ id: 'a', nom: 'A', mesures: 4, motifs: {} }], ordre: ['a'] };
    expect(erreurDe(() => lireBeat(json(muet))).message).toContain('aucune note');
  });

  it('valeurs de mauvais type (objets à la place de nombres) : retirées puis corrigées par le normaliseur', () => {
    const { morceau: m } = lireBeat(json({ ...BEAT_OK, tempo: { valueOf: 999 }, tonalite: { tonique: ['F'], mode: 'mineur' } }));
    expect(m.tempo).toBeGreaterThanOrEqual(60);
    expect(m.tempo).toBeLessThanOrEqual(200);
    expect(m.tonalite.tonique).toBe('C');
  });
});

describe('« Continue mon idée »', () => {
  it('ajoute UNE section juste après la section choisie, avec des ids neufs, sans toucher au reste', () => {
    const m = morceauOuvert();
    const r = lireSuite(m, 'couplet', 1, 'pont', json(SUITE_OK));
    expect(r.sections).toHaveLength(m.sections.length + 1);
    const neuve = r.sections.at(-1)!;
    expect(neuve.nom).toBe('Pont');
    expect(r.ordre).toEqual(['intro', 'couplet', neuve.id, 'refrain', 'couplet', 'refrain', 'outro']);
    // Le motif « accords » de l'IA (une mélodie) ne remplace pas les accords du morceau.
    expect(r.motifs.accords).toBe(m.motifs.accords);
    expect(neuve.motifs.accords).toBe('accords');
    expect(r.motifs[neuve.motifs.melodie!]?.type).toBe('melodie');
    expect(r.motifs[neuve.motifs.batterie!]?.type).toBe('batterie');
    expect(neuve.motifs.melodie).toMatch(/^ia-/);
    // Prises, sons, pads, master, pistes : les mêmes objets ; infos : seulement musique « aide ».
    expect(r.prises).toBe(m.prises);
    expect(r.sons).toBe(m.sons);
    expect(r.pads).toBe(m.pads);
    expect(r.master).toBe(m.master);
    expect(r.pistes).toBe(m.pistes);
    for (const s of m.sections) expect(r.sections).toContain(s);
    expect(r.infos).toEqual({ ...m.infos, ia: { paroles: 'aucune', musique: 'aide', voix: 'aucune' } });
    expect(normaliserMorceau(r).morceau).toEqual(r);
  });

  it('la section choisie n’est plus à sa place : on l’ajoute après sa dernière apparition', () => {
    const m = morceauOuvert();
    const r = lireSuite(m, 'refrain', 0, 'refrain', json(SUITE_OK));
    expect(r.ordre.indexOf(r.sections.at(-1)!.id)).toBe(m.ordre.lastIndexOf('refrain') + 1);
  });

  it('section qui n’utilise que des motifs existants : pas de musique « aide » (l’IA n’a écrit aucune note)', () => {
    const m = morceauOuvert();
    const r = lireSuite(m, 'couplet', 1, 'variation', json({ section: { nom: 'Couplet bis', mesures: 4, motifs: { batterie: 'bat-refrain', accords: 'accords' } } }));
    expect(r.infos?.ia?.musique).toBe('aucune');
  });

  it('réponses hostiles ou vides : erreur claire, le morceau d’origine n’est pas modifié', () => {
    const m = morceauOuvert();
    const copie = structuredClone(m);
    const cas = [
      'pas du JSON',
      json({ motifs: {} }),
      json({ section: { nom: 'Vide', mesures: 4, motifs: { batterie: 'inconnu' } } }),
      json({ section: { nom: 'x', motifs: { batterie: 'bat-refrain' } }, prises: [], infos: { ia: {} } }).replace('"bat-refrain"', '{"a":1}'),
    ];
    for (const c of cas) expect(erreurDe(() => lireSuite(m, 'couplet', 1, 'pont', c)).code).toBe('reponse_ia_invalide');
    expect(m).toEqual(copie);
  });

  it('champs interdits dans la section (paroles, boucle) et dans la réponse (prises, infos) : ignorés', () => {
    const m = morceauOuvert();
    const r = lireSuite(m, 'couplet', 1, 'pont', json({ ...SUITE_OK, prises: [], infos: { isrc: 'X' }, section: { ...SUITE_OK.section, paroles: 'Paroles connues', boucle: { son: 's1', mesures: 4 } } }));
    const neuve = r.sections.at(-1)!;
    expect(neuve.paroles).toBeUndefined();
    expect(neuve.boucle).toBeUndefined();
    expect(r.prises).toBe(m.prises);
  });

  it('morceau plein (64 sections) : refusé avec un message clair', () => {
    const m = morceauOuvert();
    const plein = { ...m, sections: Array.from({ length: 64 }, (_, i) => ({ ...m.sections[0]!, id: `s${i}` })) };
    expect(erreurDe(() => lireSuite(plein, 's0', 0, 'pont', json(SUITE_OK))).message).toContain('plein');
  });
});

describe('« Aide aux paroles »', () => {
  it('3 propositions en texte brut, syllabes données ou comptées', () => {
    const p = lireParoles(json(PAROLES_OK));
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual({ rime: '-ur', lignes: [{ texte: 'J’avance dans la nuit sans peur', syllabes: 8 }, { texte: 'La ville me prête sa chaleur', syllabes: 8 }] });
    expect(p[1]!.lignes.map((l) => l.syllabes)).toEqual([compterSyllabes('Le bitume chante mon nom'), compterSyllabes('J’écris ma vie au crayon')]);
    // Le HTML reste du texte : rien n'est interprété (l'interface affiche des nœuds texte).
    expect(p[2]!.lignes[0]!.texte).toContain('<img src=x onerror="alert(1)">');
  });

  it('plus de 3 propositions ou de 16 lignes, lignes vides, syllabes absurdes, retours à la ligne : nettoyés', () => {
    const lignes = Array.from({ length: 40 }, (_, i) => ({ texte: `ligne\n${i}`, syllabes: i === 0 ? 9999 : 4 }));
    const p = lireParoles(json({ propositions: [{ lignes }, { lignes: [{ texte: '   ' }] }, ...Array(5).fill({ lignes: ['seule'] })] }));
    expect(p).toHaveLength(2);
    expect(p[0]!.lignes).toHaveLength(16);
    expect(p[0]!.lignes[0]).toEqual({ texte: 'ligne 0', syllabes: compterSyllabes('ligne 0') });
    expect(p[1]!.lignes[0]!.texte).toBe('seule');
  });

  it('aucune ligne lisible → erreur claire', () => {
    expect(erreurDe(() => lireParoles(json({ propositions: [] }))).code).toBe('reponse_ia_invalide');
    expect(erreurDe(() => lireParoles('nope')).code).toBe('reponse_ia_invalide');
  });

  it('compter les syllabes (approché, à l’oral) : e muet de fin de mot, apostrophes', () => {
    expect(compterSyllabes('La ville me prête sa chaleur')).toBe(7);
    expect(compterSyllabes('Le bitume chante mon nom')).toBe(6);
    expect(compterSyllabes('J’écris ma vie au crayon')).toBe(6);
    expect(compterSyllabes('')).toBe(0);
  });
});

describe('infos.ia (déclaration chez le distributeur)', () => {
  it('appliquerParoles : lignes ajoutées à la section, paroles « aide », le reste intact', () => {
    const m = morceauOuvert();
    const avecTexte = { ...m, sections: m.sections.map((s) => (s.id === 'couplet' ? { ...s, paroles: 'Déjà là\n' } : s)) };
    const r = appliquerParoles(avecTexte, 'couplet', ['Ligne 1', ' ', 'Ligne 2']);
    expect(r.sections.find((s) => s.id === 'couplet')!.paroles).toBe('Déjà là\nLigne 1\nLigne 2');
    expect(r.infos).toEqual({ explicite: false, langue: 'fr', ia: { paroles: 'aide', musique: 'aucune', voix: 'aucune' } });
    expect(appliquerParoles(m, 'inconnue', ['x'])).toBe(m);
  });

  it('marquerIa : crée la déclaration, ne baisse jamais « ia », ne change rien si c’est déjà fait', () => {
    const m = nouveauMorceau('lofi');
    expect(marquerIa(m, { musique: true }).infos?.ia).toEqual({ paroles: 'aucune', musique: 'aide', voix: 'aucune' });
    const deja = { ...m, infos: { ia: { paroles: 'ia', musique: 'aide', voix: 'aucune' } as const } };
    expect(marquerIa(deja, { musique: true, paroles: true })).toBe(deja);
    // « ia » ne redescend jamais à « aide » ; « aide » monte à « ia ».
    const toutIa = marquerIa(m, { musique: 'ia' });
    expect(toutIa.infos?.ia).toEqual({ paroles: 'aucune', musique: 'ia', voix: 'aucune' });
    expect(marquerIa(toutIa, { musique: true, paroles: true }).infos?.ia).toEqual({ paroles: 'aide', musique: 'ia', voix: 'aucune' });
    expect(marquerIa(deja, { musique: 'ia' }).infos?.ia).toEqual({ paroles: 'ia', musique: 'ia', voix: 'aucune' });
  });
});
