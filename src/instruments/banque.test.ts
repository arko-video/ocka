// La banque livrée dans public/instruments/ : chaque instrument.json est valide, CC0 ou domaine public,
// avec les SHA-256 de ses sources, dans son budget de 60 s mono, ses zones couvrent sa plage sans trou,
// et chaque fichier référencé existe (taille du catalogue exacte). Le bilan YIN / clics est relu aussi.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validerCatalogue } from './catalogue';
import { IDS_BANQUE } from './ids-banque';
import {
  BUDGET_MAX_S,
  dossierInstrument,
  FREQUENCE_INSTRUMENTS,
  LICENCES_ACCEPTEES,
  validerInstrument,
  type InstrumentJson,
} from './format';

const chemin = (relatif: string) => decodeURIComponent(new URL(relatif, import.meta.url).pathname);
const RACINE = chemin('../../public/instruments');
const OUTILS = chemin('../../outils/instruments');
const dossiers = existsSync(RACINE)
  ? readdirSync(RACINE).filter((d) => statSync(join(RACINE, d)).isDirectory()).sort()
  : [];
const lire = (d: string): unknown => JSON.parse(readFileSync(join(RACINE, d, 'instrument.json'), 'utf8'));
const SANS_HAUTEUR = new Set(['Batteries', 'Percussions']);

/** Pour chaque note couverte : vélocités 1 à 127 sans trou ni chevauchement ; notes contiguës (sauf batteries). */
function couvertureSansTrou(inst: InstrumentJson): string | null {
  const parNote = new Map<number, [number, number][]>();
  for (const z of inst.zones) {
    for (let n = z.bas; n <= z.haut; n++) parNote.set(n, [...(parNote.get(n) ?? []), [z.velBas, z.velHaut]]);
  }
  for (const [n, vels] of parNote) {
    vels.sort((a, b) => a[0] - b[0]);
    if (vels[0][0] !== 1 || vels[vels.length - 1][1] !== 127) return `note ${n} : vélocités pas de 1 à 127`;
    for (let i = 1; i < vels.length; i++) if (vels[i][0] !== vels[i - 1][1] + 1) return `note ${n} : trou ou chevauchement`;
  }
  if (!SANS_HAUTEUR.has(inst.famille)) {
    const notes = [...parNote.keys()].sort((a, b) => a - b);
    for (let n = notes[0]; n <= notes[notes.length - 1]; n++) if (!parNote.has(n)) return `trou à la note ${n}`;
  }
  return null;
}

describe('banque d’instruments (public/instruments)', () => {
  it('contient au moins les 10 instruments prioritaires', () => {
    expect(dossiers.length).toBeGreaterThanOrEqual(10);
  });

  for (const d of dossiers) {
    describe(d, () => {
      const inst = validerInstrument(lire(d));

      it('instrument.json valide, id = dossier + version', () => {
        expect(dossierInstrument(inst.id)).toBe(d);
      });

      it('licence CC0 ou domaine public, avec URL, auteur et SHA-256 des sources', () => {
        expect(LICENCES_ACCEPTEES as readonly string[]).toContain(inst.licence.nom);
        expect(inst.licence.url).toMatch(/^https:\/\//);
        expect(inst.licence.auteur.length).toBeGreaterThan(3);
        expect(inst.licence.sha256.length).toBeGreaterThan(0);
        for (const s of inst.licence.sha256) expect(s).toMatch(/^[0-9a-f]{64}$/);
      });

      it('budget : au plus 60 s mono décodées, budgetS exact', () => {
        const total = inst.zones.reduce((s, z) => s + (z.fin / FREQUENCE_INSTRUMENTS) * inst.canaux, 0);
        expect(total).toBeLessThanOrEqual(BUDGET_MAX_S);
        expect(Math.abs(total - inst.budgetS)).toBeLessThan(0.01);
      });

      it('les zones couvrent la plage sans trou, racines à 3 demi-tons au plus', () => {
        expect(couvertureSansTrou(inst)).toBeNull();
        for (const z of inst.zones) {
          expect(z.racine).toBeGreaterThanOrEqual(z.bas - 1);
          expect(z.racine).toBeLessThanOrEqual(z.haut + 1);
          if (!SANS_HAUTEUR.has(inst.famille) && z.bas !== Math.min(...inst.zones.map((x) => x.bas))) {
            expect(z.racine - z.bas).toBeLessThanOrEqual(1);
          }
        }
      });

      it('chaque fichier référencé existe ; rien d’autre dans le dossier', () => {
        const presents = readdirSync(join(RACINE, d)).sort();
        const attendus = [...inst.zones.map((z) => z.fichier), 'instrument.json'].sort();
        expect(presents).toEqual(attendus);
        for (const z of inst.zones) {
          const o = readFileSync(join(RACINE, d, z.fichier));
          expect(String.fromCharCode(...o.subarray(0, 4))).toBe('OggS');
        }
      });
    });
  }

  it('catalogue.json : valide, une entrée par dossier, taille au octet près', () => {
    const cat = validerCatalogue(JSON.parse(readFileSync(join(RACINE, 'catalogue.json'), 'utf8')));
    expect(cat.map((e) => dossierInstrument(e.id)).sort()).toEqual(dossiers);
    for (const e of cat) {
      const d = dossierInstrument(e.id)!;
      const taille = readdirSync(join(RACINE, d)).reduce((s, f) => s + statSync(join(RACINE, d, f)).size, 0);
      expect(e.taille).toBe(taille);
      const inst = validerInstrument(lire(d));
      expect([e.nom, e.famille, e.licence, e.dureeS]).toEqual([inst.nom, inst.famille, inst.licence.nom, inst.budgetS]);
    }
    expect(cat.reduce((s, e) => s + e.taille, 0)).toBeLessThanOrEqual(150_000_000);
  });

  it('ids-banque.ts (déclarés au normaliseur) = les ids de catalogue.json', () => {
    const cat = validerCatalogue(JSON.parse(readFileSync(join(RACINE, 'catalogue.json'), 'utf8')));
    expect([...IDS_BANQUE]).toEqual(cat.map((e) => e.id));
  });
  it('bilan du vérificateur (YIN ±5 cents, aucun clic aux boucles) : 0 erreur, à jour', () => {
    const bilan = JSON.parse(readFileSync(join(OUTILS, 'bilan.json'), 'utf8')) as {
      erreurs: number;
      instruments: { id: string; erreurs: string[]; zones: { justesse: number | null; clicDb?: number }[] }[];
    };
    expect(bilan.erreurs).toBe(0);
    expect(bilan.instruments.map((i) => dossierInstrument(i.id) ?? i.id).sort()).toEqual(dossiers);
    for (const i of bilan.instruments) {
      for (const z of i.zones) {
        if (z.justesse !== null) expect(Math.abs(z.justesse)).toBeLessThanOrEqual(5);
        if (z.clicDb !== undefined) expect(z.clicDb).toBeLessThanOrEqual(6);
      }
    }
  });

  it('une copie de la licence de chaque banque est gardée dans outils/instruments/licences', () => {
    const textes = readdirSync(join(OUTILS, 'licences')).map((f) => readFileSync(join(OUTILS, 'licences', f), 'utf8'));
    expect(textes.length).toBeGreaterThanOrEqual(5);
    for (const t of textes) expect(t).toMatch(/CC0 1\.0 Universal/);
  });
});
