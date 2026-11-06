// Les 9 styles rap de la vague C2 (S1) : chacun est fini (plus de copie provisoire), donne un morceau neuf valide,
// joue des instruments qui existent (banque de BQ ou sons d'OCKA) dans leur tessiture, et SONNE comme son style
// (tempo, groove, kit, 808 propres). Les 6 styles d'avant ne bougent pas (mêmes empreintes que registre.test.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDS_BANQUE } from '../../instruments/ids-banque';
import { synthetiserFrappe } from '../../moteur/instruments/batterie';
import { avecFrequence } from '../../moteur/synthese/briques';
import { calculerPlanning } from '../../moteur/planning';
import { TEXTES_STYLES_RAP } from '../../textes/styles-rap';
import { declarerInstruments, motifNotesDe, syntheOcka } from '../acces';
import '../../moteur/synthese/registre-synthes'; // C3 : déclare les synthés d'OCKA (supersaw, chœurs, cuivres…)
import { normaliserMorceau } from '../normaliser';
import { nouveauMorceau } from '../styles';
import { INSTRUMENTS_BATTERIE, STYLES, type MotifBasse, type MotifBatterie, type Style } from '../types';
import { DEFINITIONS_STYLES, stylesDeFamille } from './index';

// Comme api-banque.ts dans l'appli : les instruments de la banque de cette version sont connus du normaliseur.
declarerInstruments(IDS_BANQUE);

const RAP: Style[] = ['rage', 'plugg', 'cloud', 'jerseyclub', 'afrotrap', 'rapmelodique', 'jazzrap', 'ukdrill', 'memphis'];
const AVANT_C2: Style[] = ['trap', 'drill', 'lofi', 'phonk', 'pop', 'boombap'];

/** Tessiture (notes MIDI jouables) d'un instrument de la banque, lue dans son instrument.json. */
function tessiture(id: string): Set<number> {
  const dossier = join(decodeURIComponent(new URL('../../../public/instruments', import.meta.url).pathname), id.split('@')[0]!);
  const def = JSON.parse(readFileSync(join(dossier, 'instrument.json'), 'utf8')) as { zones: { bas: number; haut: number }[] };
  const notes = new Set<number>();
  for (const z of def.zones) for (let x = z.bas; x <= z.haut; x++) notes.add(x);
  return notes;
}

const frappes = (m: MotifBatterie, inst: 'kick' | 'snare' | 'clap' | 'charley' | 'cowbell' | 'perc', mesure = 0) =>
  (m.pistes[inst] ?? []).slice(mesure * 16, mesure * 16 + 16).flatMap((v, i) => (v > 0 ? [i] : []));

function fnv(texte: string): string {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
}

describe('les 9 styles rap', () => {
  it('famille rap : les 6 d’avant et les 9 nouveaux', () => {
    expect(stylesDeFamille('rap').map((d) => d.id).sort()).toEqual([...AVANT_C2.filter((s) => s !== 'pop'), ...RAP].sort());
  });

  for (const s of RAP) {
    it(`${s} : fini, morceau neuf valide après normalisation, idempotent`, () => {
      const d = DEFINITIONS_STYLES[s];
      expect(d.provisoire).toBeUndefined();
      expect(d.famille).toBe('rap');
      const m = nouveauMorceau(s);
      const r = normaliserMorceau(m);
      expect(r.problemes).toEqual([]);
      expect(r.morceau).toEqual(m);
      expect(normaliserMorceau(r.morceau).morceau).toEqual(r.morceau);
      expect(calculerPlanning(m).length).toBeGreaterThan(300);
    });

    it(`${s} : instruments par défaut dans la banque ou parmi les sons d’OCKA, notes dans leur tessiture`, () => {
      const d = DEFINITIONS_STYLES[s];
      const m = nouveauMorceau(s);
      for (const i of d.instrumentsParDefaut) {
        const ocka = syntheOcka(i.instrument) !== null;
        expect(ocka || IDS_BANQUE.includes(i.instrument), i.instrument).toBe(true);
        expect(Object.values(TEXTES_STYLES_RAP.stylesRap.pistes)).toContain(i.nom);
        if (!i.notes) continue;
        // Des notes dans chaque section demandée, et nulle part ailleurs.
        for (const sec of m.sections) {
          const motif = motifNotesDe(m, sec.id, i.id);
          if (i.notes.sections.includes(sec.id)) expect(motif?.notes.length, `${i.id} ${sec.id}`).toBeGreaterThan(0);
          else expect(motif?.notes.length ?? 0, `${i.id} ${sec.id}`).toBe(0);
        }
        if (ocka) continue;
        const jouables = tessiture(i.instrument);
        for (const x of motifNotesDe(m, i.notes.sections[0]!, i.id)!.notes) expect(jouables.has(x.midi), `${i.instrument} ${x.midi}`).toBe(true);
      }
    });

    it(`${s} : kit, 808 et motifs propres (plus rien de la copie provisoire)`, () => {
      const d = DEFINITIONS_STYLES[s];
      const kit = d.son.kits[`${s}@1`]!;
      for (const autre of [...AVANT_C2, ...RAP].filter((x) => x !== s)) {
        const o = DEFINITIONS_STYLES[autre];
        expect(kit, `kit ${s} = ${autre}`).not.toEqual(o.son.kits[`${autre}@1`]);
        expect(d.son.basse808, `808 ${s} = ${autre}`).not.toEqual(o.son.basse808);
      }
      // Le kit sonne : chaque frappe est finie, bornée, non nulle.
      for (const inst of INSTRUMENTS_BATTERIE.filter((x) => !x.startsWith('perso'))) {
        const a = avecFrequence(48000, () => synthetiserFrappe(`${s}@1`, inst));
        let max = 0;
        for (const v of a) max = Math.max(max, Math.abs(v));
        expect(Number.isFinite(max) && max > 0.05 && max <= 1.0001, `${s} ${inst}`).toBe(true);
      }
    });
  }

  it('les motifs (batterie et 808) diffèrent d’un style rap à l’autre', () => {
    const tous = [...AVANT_C2, ...RAP];
    for (const motif of ['intro', 'couplet', 'refrain', 'pont'] as const) {
      const vus = new Map<string, Style>();
      for (const s of tous) {
        const cle = JSON.stringify(DEFINITIONS_STYLES[s].batterie()[motif]);
        expect(vus.get(cle), `${motif} : ${s} = ${vus.get(cle)}`).toBeUndefined();
        vus.set(cle, s);
      }
    }
    for (const partie of ['couplet', 'refrain'] as const) {
      const vus = new Map<string, Style>();
      for (const s of tous) {
        const cle = JSON.stringify(DEFINITIONS_STYLES[s].basse()[partie]);
        expect(vus.get(cle), `808 ${partie} : ${s} = ${vus.get(cle)}`).toBeUndefined();
        vus.set(cle, s);
      }
    }
  });

  it('chaque style a ses traits', () => {
    const bat = (s: Style) => DEFINITIONS_STYLES[s].batterie();
    const reg = (s: Style) => DEFINITIONS_STYLES[s].reglages;
    // Jersey club : rafales de 5 kicks par mesure, « grincement » (perc) doublé.
    for (const k of [0, 1]) expect(frappes(bat('jerseyclub').couplet, 'kick', k)).toEqual([0, 4, 8, 10, 12]);
    expect(frappes(bat('jerseyclub').refrain, 'kick', 0)).toEqual([0, 3, 6, 8, 10]);
    expect(bat('jerseyclub').couplet.roulements?.perc?.some((x) => x === 2)).toBe(true);
    // Afro trap : kick en 3-3-2, deux fois par mesure ; congas de la banque.
    expect(frappes(bat('afrotrap').couplet, 'kick')).toEqual([0, 3, 6, 8, 11, 14]);
    // UK drill : caisse claire en contretemps à la 2e mesure ; 808 qui glisse longtemps.
    expect(frappes(bat('ukdrill').couplet, 'snare', 1).some((p) => p % 4 !== 0)).toBe(true);
    expect(DEFINITIONS_STYLES.ukdrill.son.basse808!.glisse).toBeGreaterThan(DEFINITIONS_STYLES.drill.son.basse808!.glisse);
    expect((DEFINITIONS_STYLES.ukdrill.basse().couplet as MotifBasse).notes.some((x) => x.glisse)).toBe(true);
    // Memphis : lent, cowbell, charley en double-croches, son de cassette.
    expect(reg('memphis').tempo).toBeLessThan(90);
    expect(frappes(bat('memphis').couplet, 'cowbell').length).toBeGreaterThan(2);
    expect(frappes(bat('memphis').couplet, 'charley')).toHaveLength(16);
    expect(DEFINITIONS_STYLES.memphis.son.kits['memphis@1']!.bande).toBeGreaterThan(1);
    // Rage : 808 énorme (longue et très saturée), charley en rafales de triolets.
    expect(DEFINITIONS_STYLES.rage.son.basse808!.force).toBeGreaterThan(DEFINITIONS_STYLES.trap.son.basse808!.force * 1.5);
    expect(bat('rage').refrain.roulements?.charley?.filter((x) => x === 3).length).toBeGreaterThan(6);
    // Jazz rap : swing, 808 muette, contrebasse et ride ; plugg et cloud : nappe ; rap mélodique : guitare + piano.
    expect(reg('jazzrap').swing).toBeGreaterThanOrEqual(0.25);
    expect(reg('jazzrap').muettes).toContain('basse');
    const instruments = (s: Style) => DEFINITIONS_STYLES[s].instrumentsParDefaut.map((i) => i.instrument);
    expect(instruments('jazzrap')).toEqual(['vsco-piano-droit@1', 'karoryfer-contrebasse@1', 'virtuosity-batterie-jazz@1']);
    expect(instruments('rapmelodique')).toEqual(['freepats-guitare-nylon@1', 'karoryfer-piano-doux@1']);
    expect(instruments('afrotrap')).toEqual(['vcsl-marimba@1', 'vcsl-percussions-latines@1']);
    expect(instruments('plugg')).toEqual(['ocka-cloche@1', 'ocka-nappe@1']);
    expect(instruments('memphis')).toEqual(['ocka-cloche@1', 'ocka-nappe@1']);
    expect(instruments('rage')).toEqual(['ocka-supersaw@1']);
    expect(instruments('cloud')).toContain('ocka-nappe@1');
    expect(reg('plugg').mode).toBe('majeur');
  });

  it('les 6 styles d’avant C2 : même morceau neuf et même planning', () => {
    const AVANT: Record<string, [string, string]> = {
      trap: ['4fb6e255', 'e8f8999f'],
      drill: ['746872ed', '9bd6e8cc'],
      lofi: ['d4c0190d', 'd6dd9420'], // intégration C3 : piste mélodie sur le Rhodes (morceau seulement ; planning inchangé)
      phonk: ['5a405091', '64c6734'],
      pop: ['5d7760b6', '24cbdd05'],
      boombap: ['b107bc6a', '64e7fd06'],
    };
    for (const s of AVANT_C2) {
      const m = nouveauMorceau(s);
      const p = calculerPlanning(m).map((e) => [e.type, Math.round(e.t * 1e6), 'vel' in e ? Math.round(e.vel * 1e6) : 0, 'midi' in e ? e.midi : 0]);
      expect([fnv(JSON.stringify(m)), fnv(JSON.stringify(p))], s).toEqual(AVANT[s]);
    }
  });
  it('effets de départ (tranche) : réverbe en cloud, compresseur sur la contrebasse du jazz rap, rien ailleurs', () => {
    const inserts = (s: Style) => Object.fromEntries(nouveauMorceau(s).pistes.filter((p) => p.inserts?.length).map((p) => [p.id, p.inserts!.map((x) => x.type)]));
    expect(inserts('cloud')).toEqual({ melodie: ['envoi-reverbe'], vibraphone: ['envoi-reverbe'] });
    expect(inserts('jazzrap')).toEqual({ contrebasse: ['compresseur'] });
    // Réglages en dictionnaire sans prototype, déjà normalisés (le normaliseur ne les change pas : test des styles).
    const c = nouveauMorceau('jazzrap').pistes.find((p) => p.id === 'contrebasse')!.inserts![0]!;
    expect(Object.getPrototypeOf(c.params)).toBe(null);
    expect(c.params.ratio).toBe(3);
    // Les 33 autres styles n'ont aucun effet de départ : leur son ne bouge pas.
    for (const s of STYLES.filter((x) => x !== 'cloud' && x !== 'jazzrap')) expect(inserts(s), s).toEqual({});
  });
});
