// Validation stricte d'un instrument.json venu du réseau, catalogue, familles et recherche.
import { describe, expect, it } from 'vitest';
import { parFamilles, rechercher, validerCatalogue, type EntreeCatalogue } from './catalogue';
import { dossierInstrument, fichiersUtiles, validerInstrument, zonesPour } from './format';

const SHA = 'a'.repeat(64);

function instrument(): Record<string, unknown> {
  return {
    id: 'vcsl-marimba@1',
    nom: 'Marimba',
    famille: 'Percussions mélodiques',
    licence: { nom: 'CC0-1.0', url: 'https://github.com/sgossner/VCSL', auteur: 'Versilian Studios LLC', sha256: [SHA] },
    canaux: 1,
    gainDb: 0,
    relache: 0.3,
    budgetS: 2,
    zones: [
      { fichier: 'z060-v1.ogg', racine: 60, cents: -3.5, bas: 59, haut: 61, velBas: 1, velHaut: 79, gainDb: -6, debut: 0, fin: 24000 },
      {
        fichier: 'z060-v2.ogg', racine: 60, cents: 0, bas: 59, haut: 61, velBas: 80, velHaut: 127, gainDb: -6, debut: 0, fin: 48000,
        boucle: { debut: 12000, fin: 40000 },
      },
    ],
  };
}

function avec(modif: (o: Record<string, any>) => void): unknown {
  const o = JSON.parse(JSON.stringify(instrument()));
  modif(o);
  return o;
}

describe('validerInstrument', () => {
  it('accepte un instrument correct et rend une copie propre', () => {
    const i = validerInstrument(instrument(), 'vcsl-marimba@1');
    expect(i.zones[1].boucle).toEqual({ debut: 12000, fin: 40000 });
    expect(dossierInstrument(i.id)).toBe('vcsl-marimba');
  });

  const refus: [string, (o: Record<string, any>) => void][] = [
    ['licence CC-BY', (o) => (o.licence.nom = 'CC-BY-3.0')],
    ['licence sans SHA-256', (o) => (o.licence.sha256 = [])],
    ['SHA-256 mal écrit', (o) => (o.licence.sha256 = ['xyz'])],
    ['URL non https', (o) => (o.licence.url = 'javascript:alert(1)')],
    ['chemin qui remonte', (o) => (o.zones[0].fichier = '../z.ogg')],
    ['sous-dossier', (o) => (o.zones[0].fichier = 'a/z.ogg')],
    ['URL absolue', (o) => (o.zones[0].fichier = 'https://x.y/z.ogg')],
    ['autre format', (o) => (o.zones[0].fichier = 'z.wav')],
    ['clé inconnue', (o) => (o.zones[0].script = 1)],
    ['__proto__', (o) => Object.defineProperty(o, '__proto__', { value: {}, enumerable: true })],
    ['budget dépassé', (o) => (o.budgetS = 1)],
    ['budget > 60 s', (o) => (o.budgetS = 61)],
    ['note hors MIDI', (o) => (o.zones[0].haut = 128)],
    ['vélocité 0', (o) => (o.zones[0].velBas = 0)],
    ['bornes inversées', (o) => (o.zones[0].bas = 62)],
    ['boucle hors du son', (o) => (o.zones[1].boucle.fin = 50000)],
    ['famille inconnue', (o) => (o.famille = 'Synthés')],
    ['id sans version', (o) => (o.id = 'vcsl-marimba')],
    ['canaux 6', (o) => (o.canaux = 6)],
    ['fichier en double', (o) => (o.zones[1].fichier = 'z060-v1.ogg')],
    ['NaN', (o) => (o.gainDb = Number.NaN)],
  ];
  for (const [quoi, modif] of refus) {
    it(`refuse : ${quoi}`, () => {
      expect(() => validerInstrument(avec(modif))).toThrow(expect.objectContaining({ code: 'instrument_invalide' }));
    });
  }

  it('refuse un id différent de celui demandé', () => {
    expect(() => validerInstrument(instrument(), 'vsco-flute@1')).toThrow();
  });

  it('zonesPour et fichiersUtiles choisissent la couche par la vélocité', () => {
    const i = validerInstrument(instrument());
    expect(zonesPour(i, 60, 100).map((z) => z.fichier)).toEqual(['z060-v2.ogg']);
    expect(zonesPour(i, 70, 100)).toEqual([]);
    expect([...fichiersUtiles(i, [{ midi: 59, vel: 30 }, { midi: 61, vel: 30 }])]).toEqual(['z060-v1.ogg']);
  });
});

describe('catalogue', () => {
  const entree = (id: string, nom: string, famille: string): EntreeCatalogue =>
    ({ id, nom, famille, taille: 1000, dureeS: 10, licence: 'CC0-1.0' }) as EntreeCatalogue;
  const liste = [
    entree('vcsl-clavecin@1', 'Clavecin', 'Claviers'),
    entree('vsco-flute@1', 'Flûte', 'Vents'),
    entree('vcsl-piano-queue@1', 'Piano à queue', 'Claviers'),
  ];

  it('valide le fichier et refuse une licence non CC0 ou une entrée en double', () => {
    expect(validerCatalogue({ format: 'ocka.instruments/1', instruments: liste })).toHaveLength(3);
    expect(() => validerCatalogue({ format: 'ocka.instruments/1', instruments: [{ ...liste[0], licence: 'CC-BY-4.0' }] })).toThrow();
    expect(() => validerCatalogue({ format: 'ocka.instruments/1', instruments: [liste[0], liste[0]] })).toThrow();
    expect(() => validerCatalogue({ format: 'autre', instruments: [] })).toThrow();
  });

  it('range par familles dans l’ordre, et trie par nom', () => {
    const f = parFamilles(liste);
    expect(f.map((x) => x.famille)).toEqual(['Claviers', 'Vents']);
    expect(f[0].instruments.map((x) => x.nom)).toEqual(['Clavecin', 'Piano à queue']);
  });

  it('cherche sans accents ni majuscules', () => {
    expect(rechercher(liste, 'flute').map((x) => x.nom)).toEqual(['Flûte']);
    expect(rechercher(liste, 'CLAV').map((x) => x.nom)).toEqual(['Clavecin', 'Piano à queue']);
    expect(rechercher(liste, 'piano queue')).toHaveLength(1);
    expect(rechercher(liste, '  ')).toHaveLength(3);
  });
});
