// Les 20 styles de S2 (vague C2) : morceau neuf valide, instruments qui existent (banque ou sons OCKA) et notes
// jouables (dans la tessiture, touches de batterie existantes, une note à la fois pour les instruments
// monophoniques), motifs et kits propres à chaque style, traits typiques (dembow, swing ternaire, 174 BPM…),
// et les 6 styles d'avant C2 qui ne bougent pas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDS_BANQUE } from '../../instruments/ids-banque';
import { calculerPlanning } from '../../moteur/planning';
import { declarerInstruments, syntheOcka } from '../acces';
import '../../moteur/synthese/registre-synthes'; // C3 : déclare les synthés d'OCKA (supersaw, chœurs, cuivres…)
import { normaliserMorceau } from '../normaliser';
import { nouveauMorceau, reecrireNotesDeDepart } from '../styles';
import { STYLES, type MotifBatterie, type MotifNotes, type Style } from '../types';
import { boucleDans, ligne, motif, plaquer, ternaire } from '../styles-ecriture';
import { DEFINITIONS_STYLES, stylesDeFamille, type FamilleStyle } from './index';

declarerInstruments(IDS_BANQUE);

const AUTRES: Record<FamilleStyle, Style[]> = {
  rap: [],
  electro: ['hyperpop', 'house', 'techno', 'dnb', 'ukgarage', 'synthwave'],
  monde: ['bossanova', 'afrobeats', 'reggaeton', 'amapiano', 'reggae'],
  poprockjazz: ['rnb', 'jazz', 'rock', 'poppunk', 'funk', 'gospel', 'kpop'],
  cinema: ['orchestral', 'ambient'],
};
const S2 = Object.values(AUTRES).flat();

const RACINE = decodeURIComponent(new URL('../../../public/instruments', import.meta.url).pathname);
interface Zones { bas: number; haut: number; touches: Set<number>; mono: boolean; famille: string }
const zones = new Map<string, Zones>();
function zonesDe(id: string): Zones {
  if (!zones.has(id)) {
    const j = JSON.parse(readFileSync(join(RACINE, id.split('@')[0]!, 'instrument.json'), 'utf8')) as { famille: string; mono?: boolean; zones: { bas: number; haut: number }[] };
    const touches = new Set<number>();
    for (const z of j.zones) for (let k = z.bas; k <= z.haut; k++) touches.add(k);
    zones.set(id, { bas: Math.min(...j.zones.map((z) => z.bas)), haut: Math.max(...j.zones.map((z) => z.haut)), touches, mono: j.mono === true, famille: j.famille });
  }
  return zones.get(id)!;
}

function fnv(texte: string): string {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
}

describe('les 20 styles de S2', () => {
  it('20 styles, chacun dans sa famille ; les familles réunissent bien les 35 styles', () => {
    expect(S2).toHaveLength(20);
    for (const [f, ids] of Object.entries(AUTRES) as [FamilleStyle, Style[]][]) {
      for (const s of ids) expect(DEFINITIONS_STYLES[s].famille, s).toBe(f);
      for (const s of ids) expect(stylesDeFamille(f).map((d) => d.id)).toContain(s);
    }
    expect(new Set([...S2, 'trap', 'drill', 'lofi', 'phonk', 'pop', 'boombap'] as Style[]).size).toBe(26);
    expect(STYLES.length).toBe(35);
  });

  for (const s of S2) {
    it(`${s} : style fini, morceau neuf valide, instruments jouables`, () => {
      const d = DEFINITIONS_STYLES[s];
      expect(d.provisoire).toBeUndefined();
      const m = nouveauMorceau(s);
      expect(normaliserMorceau(m).problemes).toEqual([]);
      expect(calculerPlanning(m).length).toBeGreaterThan(50);
      for (const i of d.instrumentsParDefaut) {
        const ocka = syntheOcka(i.instrument) !== null;
        expect(ocka || IDS_BANQUE.includes(i.instrument), `${s} : ${i.instrument}`).toBe(true);
        if (!i.notes) continue;
        const x = m.motifs[i.notes.idMotif] as MotifNotes;
        expect(x?.type, `${s} ${i.id}`).toBe('notes');
        expect(x.pas % 16).toBe(0);
        expect(x.notes.length, `${s} ${i.id} a des notes`).toBeGreaterThan(0);
        for (const sec of i.notes.sections) expect(m.sections.find((z) => z.id === sec)?.motifs[i.id], `${s} ${i.id} ${sec}`).toBe(i.notes.idMotif);
        if (ocka) continue;
        const z = zonesDe(i.instrument);
        const percu = z.famille === 'Batteries' || z.famille === 'Percussions';
        for (const n of x.notes) {
          if (percu) expect(z.touches.has(n.midi), `${s} ${i.id} touche ${n.midi}`).toBe(true);
          else expect(n.midi >= z.bas && n.midi <= z.haut, `${s} ${i.id} note ${n.midi} hors de ${z.bas}–${z.haut}`).toBe(true);
        }
        if (z.mono) {
          const departs = x.notes.map((n) => n.pas);
          expect(new Set(departs).size, `${s} ${i.id} est monophonique`).toBe(departs.length);
        }
      }
    });
  }

  it('chaque style a ses motifs de batterie, sa basse et son kit (aucun n’est la copie d’un autre)', () => {
    const vus = { bat: new Map<string, string>(), basse: new Map<string, string>(), kit: new Map<string, string>() };
    for (const d of Object.values(DEFINITIONS_STYLES)) {
      const b = d.batterie();
      const cles = { bat: JSON.stringify([b.couplet, b.refrain]), basse: JSON.stringify(d.basse()), kit: JSON.stringify(d.son.kits[d.reglages.kit]) };
      for (const k of ['bat', 'basse', 'kit'] as const) {
        if (!S2.includes(d.id)) {
          vus[k].set(cles[k], d.id);
          continue;
        }
        expect(vus[k].get(cles[k]), `${d.id} : ${k} identique à ${vus[k].get(cles[k])}`).toBeUndefined();
        vus[k].set(cles[k], d.id);
      }
    }
  });

  it('traits typiques : dembow, drum & bass à 174, 2-step swingué, swing ternaire du jazz, ambient presque sans batterie', () => {
    const snare = (s: Style, partie: 'couplet' | 'refrain') => (DEFINITIONS_STYLES[s].batterie()[partie] as MotifBatterie).pistes.snare!.slice(0, 16);
    expect(snare('reggaeton', 'couplet').map((v, p) => (v > 0 ? p : -1)).filter((p) => p >= 0)).toEqual([3, 6, 11, 14]);
    expect(DEFINITIONS_STYLES.dnb.reglages.tempo).toBe(174);
    expect(DEFINITIONS_STYLES.ukgarage.reglages.swing).toBeGreaterThanOrEqual(0.25);
    const jazz = nouveauMorceau('jazz');
    expect((jazz.motifs['jazz-batterie'] as MotifNotes).notes.some((n) => n.midi === 51 && Math.abs(n.pas - (4 + 8 / 3)) < 1e-6)).toBe(true);
    const amb = DEFINITIONS_STYLES.ambient.batterie();
    expect(Object.keys(amb.intro.pistes)).toEqual([]);
    expect(Object.keys(amb.pont.pistes)).toEqual([]);
    for (const s of ['house', 'techno'] as Style[]) for (const i of DEFINITIONS_STYLES[s].instrumentsParDefaut) expect(syntheOcka(i.instrument), `${s} : synthés OCKA`).not.toBeNull();
    expect(DEFINITIONS_STYLES.rock.instrumentsParDefaut.map((i) => i.instrument)).toContain('karoryfer-batterie@1');
    expect(DEFINITIONS_STYLES.jazz.instrumentsParDefaut.map((i) => i.instrument)).toContain('virtuosity-batterie-jazz@1');
    expect(DEFINITIONS_STYLES.bossanova.instrumentsParDefaut.map((i) => i.instrument)).toEqual(expect.arrayContaining(['freepats-guitare-nylon@1', 'karoryfer-contrebasse@1', 'karoryfer-batterie-balais@1']));
  });

  it('les 6 styles d’avant C2 ne changent pas (morceau neuf et planning)', () => {
    const AVANT: Record<string, [string, string]> = {
      trap: ['4fb6e255', 'e8f8999f'],
      drill: ['746872ed', '9bd6e8cc'],
      lofi: ['d4c0190d', 'd6dd9420'], // intégration C3 : piste mélodie sur le Rhodes (morceau seulement ; planning inchangé)
      phonk: ['5a405091', '64c6734'],
      pop: ['5d7760b6', '24cbdd05'],
      boombap: ['b107bc6a', '64e7fd06'],
    };
    for (const s of Object.keys(AVANT) as Style[]) {
      const m = nouveauMorceau(s);
      const p = calculerPlanning(m).map((e) => [e.type, Math.round(e.t * 1e6), 'vel' in e ? Math.round(e.vel * 1e6) : 0, 'midi' in e ? e.midi : 0]);
      expect([fnv(JSON.stringify(m)), fnv(JSON.stringify(p))], s).toEqual(AVANT[s]);
    }
  });
});

describe('outils d’écriture (styles-ecriture)', () => {
  const m = nouveauMorceau('jazz');
  it('swing ternaire : la croche du « et » aux 2/3 du temps, les temps ne bougent pas', () => {
    expect(ternaire(0)).toBe(0);
    expect(ternaire(2)).toBeCloseTo(8 / 3);
    expect(ternaire(4)).toBe(4);
    expect(ternaire(14)).toBeCloseTo(12 + 8 / 3);
  });
  it('motif propre : trié, sans doublon, dans le motif, vélocités bornées', () => {
    const x = motif(16, [{ pas: 3, duree: 40, midi: 60, vel: 2 }, { pas: 1, duree: 1, midi: 62, vel: 0 }, { pas: 1, duree: 1, midi: 62, vel: 0.5 }, { pas: 20, duree: 1, midi: 60, vel: 1 }]);
    expect(x.notes).toEqual([{ pas: 1, duree: 1, midi: 62, vel: 0.1 }, { pas: 3, duree: 13, midi: 60, vel: 1 }]);
  });
  it('ligne de basse : la fondamentale dans le registre, l’approche un demi-ton sous l’accord suivant', () => {
    const x = ligne([[[0, 4, 'R', 1], [12, 4, 'A', 1]]], 31)(m, 'refrain');
    const racines = x.notes.filter((n) => n.pas % 16 === 0).map((n) => n.midi);
    for (const r of racines) expect(r >= 31 && r < 43).toBe(true);
    const approches = x.notes.filter((n) => n.pas % 16 === 12).map((n) => n.midi);
    expect(Math.abs(approches[0]! - racines[1]!)).toBe(1);
  });
  it('notes de départ réécrites après un changement de tonalité (« Au hasard ») : tout monte d’un ton', () => {
    const b = nouveauMorceau('bossanova');
    const haut = reecrireNotesDeDepart({ ...b, tonalite: { tonique: 'G', mode: 'majeur' } });
    const avant = (b.motifs['bossa-contrebasse'] as MotifNotes).notes.map((n) => n.midi % 12);
    const apres = (haut.motifs['bossa-contrebasse'] as MotifNotes).notes.map((n) => n.midi % 12);
    expect(apres).toEqual(avant.map((x) => (x + 2) % 12));
    expect(reecrireNotesDeDepart(b).motifs).toEqual(b.motifs);
  });
  it('accords plaqués : une seule voix pour un instrument monophonique, boucle ramenée dans la tessiture', () => {
    const une = plaquer({ bas: 60, haut: 79, voix: 0, rythme: [[[0, 4, 1]]] })(m, 'refrain');
    expect(une.notes).toHaveLength(4);
    const b = boucleDans('contrechant', 50, 64)(m, 'refrain');
    for (const n of b.notes) expect(n.midi >= 50 && n.midi <= 64).toBe(true);
  });
});
