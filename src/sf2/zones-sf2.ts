// Presets d'une SoundFont → zones jouables par l'échantillonneur (SourceZones). PUR.
// Gardé : plages de notes et de vélocités, note racine (overridingRootKey), accord (coarse, fine, correction du
// sample), décalages d'adresses, boucles (sampleModes 1 et 3), atténuation, ADSR simple (attaque, maintien, chute,
// soutien, relâchement), paires stéréo gauche/droite. Ignoré : modulateurs, filtres, LFO, panoramique, effets.
// Les générateurs du preset S'AJOUTENT à ceux de l'instrument ; les zones globales donnent les valeurs par défaut.

import type { SourceZones, ZoneSource } from '../moteur/types-moteur';
import { refusSf2, type EnteteSample, type Generateurs, type Sf2Brut } from './riff';

/** Une zone résolue (positions ABSOLUES en échantillons du bloc smpl). */
export interface ZoneSf2 {
  cle: string;
  ech: number;
  /** Échantillon de droite (paire stéréo), même longueur. */
  droite?: number;
  /** Début (absolu) du passage de droite. */
  droiteDebut?: number;
  bas: number;
  haut: number;
  velBas: number;
  velHaut: number;
  racine: number;
  cents: number;
  gainDb: number;
  debut: number;
  fin: number;
  boucle?: { debut: number; fin: number };
  frequence: number;
  /** ADSR (s ; soutien en dB ≤ 0). */
  attaque: number;
  maintien: number;
  chute: number;
  soutienDb: number;
  relache: number;
}
export interface PresetAnalyse {
  nom: string;
  banque: number;
  preset: number;
  zones: ZoneSf2[];
  /** Octets décodés (Float32) de ses zones distinctes. */
  octets: number;
}

/** Zones au plus par preset (une SoundFont piégée ne fait pas exploser la mémoire). */
export const ZONES_MAX = 512;

const G = { debut: 0, fin: 1, boucleDebut: 2, boucleFin: 3, debutG: 4, finG: 12, attaque: 34, maintien: 35, chute: 36, soutien: 37, relache: 38, instrument: 41, notes: 43, vels: 44, boucleDebutG: 45, attenuation: 48, boucleFinG: 50, grossier: 51, fin2: 52, sample: 53, modes: 54, racine: 58 } as const;

const signe = (x: number | undefined) => (x === undefined ? 0 : x >= 0x8000 ? x - 0x10000 : x);
const plage = (x: number | undefined): [number, number] => (x === undefined ? [0, 127] : [x & 0xff, (x >> 8) & 0xff]);
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const secondes = (tc: number) => borne(Math.pow(2, tc / 1200), 0, 20);

/** Fusion : zone globale puis zone locale (la locale gagne). */
const fusion = (globale: Generateurs | null, locale: Generateurs): Generateurs => Object.assign(Object.create(null), globale, locale);

/** Valeur additionnée instrument + preset (signée), avec la valeur par défaut de l'instrument. */
function somme(i: Generateurs, p: Generateurs, g: number, defaut = 0): number {
  return (i[g] === undefined ? defaut : signe(i[g])) + signe(p[g]);
}

function cleZone(z: Omit<ZoneSf2, 'cle'>): string {
  const ms = (s: number) => Math.round(s * 1000);
  const env = z.boucle ? `a${ms(z.attaque)}` : `a${ms(z.attaque)}h${ms(z.maintien)}c${ms(z.chute)}s${Math.round(z.soutienDb * 10)}`;
  return `e${z.ech}${z.droite !== undefined ? `-${z.droite}` : ''}-${z.debut}-${z.fin}-${env}`;
}

function zone(s: EnteteSample, ech: number, droite: number | undefined, i: Generateurs, p: Generateurs, smpl: number): ZoneSf2 | null {
  const [pb, ph] = plage(p[G.notes]);
  const [ib, ih] = plage(i[G.notes]);
  const [pvb, pvh] = plage(p[G.vels]);
  const [ivb, ivh] = plage(i[G.vels]);
  const bas = Math.max(pb, ib);
  const haut = Math.min(ph, ih, 127);
  const velBas = Math.max(1, pvb, ivb);
  const velHaut = Math.min(pvh, ivh, 127);
  if (bas > haut || velBas > velHaut) return null;
  const debut = s.debut + signe(i[G.debut]) + 32768 * signe(i[G.debutG]);
  const fin = s.fin + signe(i[G.fin]) + 32768 * signe(i[G.finG]);
  if (debut < 0 || fin > smpl || fin - debut < 8) return null;
  let boucle: ZoneSf2['boucle'];
  const mode = (i[G.modes] ?? 0) & 3;
  if (mode === 1 || mode === 3) {
    const bd = s.boucleDebut + signe(i[G.boucleDebut]) + 32768 * signe(i[G.boucleDebutG]);
    const bf = s.boucleFin + signe(i[G.boucleFin]) + 32768 * signe(i[G.boucleFinG]);
    if (bd >= debut && bf <= fin && bf - bd >= 2) boucle = { debut: bd, fin: bf };
  }
  const forcee = i[G.racine] !== undefined ? signe(i[G.racine]) : -1;
  const root = forcee >= 0 && forcee <= 127 ? forcee : s.racine <= 127 ? s.racine : 60;
  const accord = 100 * somme(i, p, G.grossier) + somme(i, p, G.fin2) + s.correction; // cents ajoutés à la hauteur
  const racine = Math.round(root - accord / 100);
  const cents = Math.round((100 * root - accord - 100 * racine) * 100) / 100;
  const base = {
    ech,
    droite,
    bas,
    haut,
    velBas,
    velHaut,
    racine,
    cents,
    gainDb: -borne(somme(i, p, G.attenuation), 0, 1440) / 10,
    debut,
    fin,
    boucle,
    frequence: s.frequence,
    attaque: secondes(somme(i, p, G.attaque, -12000)),
    maintien: secondes(somme(i, p, G.maintien, -12000)),
    chute: secondes(somme(i, p, G.chute, -12000)),
    soutienDb: -borne(somme(i, p, G.soutien), 0, 1440) / 10,
    relache: borne(secondes(somme(i, p, G.relache, -12000)), 0.005, 10),
  };
  return { ...base, cle: cleZone(base) };
}

/** Les zones de chaque preset (refus si un index d'instrument ou d'échantillon sort des limites). */
export function resoudrePresets(sf: Sf2Brut): PresetAnalyse[] {
  const out: PresetAnalyse[] = [];
  for (const pr of sf.presets) {
    const zs: ZoneSf2[] = [];
    let globaleP: Generateurs | null = null;
    pr.zones.forEach((pz, k) => {
      if (pz[G.instrument] === undefined) {
        if (k === 0) globaleP = pz;
        return;
      }
      const inst = sf.instruments[pz[G.instrument]!];
      if (!inst) throw refusSf2('un preset renvoie à un instrument absent');
      const p = fusion(globaleP, pz);
      let globaleI: Generateurs | null = null;
      inst.zones.forEach((iz, j) => {
        if (iz[G.sample] === undefined) {
          if (j === 0) globaleI = iz;
          return;
        }
        if (zs.length >= ZONES_MAX) return;
        const n = iz[G.sample]!;
        const s = sf.samples[n];
        if (!s) throw refusSf2('un instrument renvoie à un échantillon absent');
        if (s.type & 0x8000 || !(s.frequence >= 4000 && s.frequence <= 192000)) return; // ROM, fréquence absurde
        const d = (s.type & 4) !== 0 ? sf.samples[s.lien] : undefined;
        const droite = d && (d.type & 2) !== 0 && d.fin - d.debut === s.fin - s.debut ? s.lien : undefined;
        const z = zone(s, n, droite, fusion(globaleI, iz), p, sf.smpl.echantillons);
        if (z && droite !== undefined) {
          const ecart = sf.samples[droite]!.debut - s.debut;
          if (z.debut + ecart < 0 || z.fin + ecart > sf.smpl.echantillons) delete z.droite;
          else z.droiteDebut = z.debut + ecart;
        }
        if (z) zs.push(z);
      });
    });
    // Une zone « droite » dont la gauche est déjà jouée en stéréo n'est pas jouée une 2e fois.
    const droites = new Set(zs.filter((z) => z.droite !== undefined).map((z) => z.droite));
    const zones = zs.filter((z) => !(droites.has(z.ech) && (sf.samples[z.ech]!.type & 2) !== 0));
    const vues = new Map<string, number>();
    for (const z of zones) vues.set(z.cle, (z.fin - z.debut) * 4 * (z.droite !== undefined ? 2 : 1));
    const octets = [...vues.values()].reduce((a, b) => a + b, 0);
    if (zones.length) out.push({ nom: pr.nom || `Preset ${pr.preset}`, banque: pr.banque, preset: pr.preset, zones, octets });
  }
  return out.sort((a, b) => a.banque - b.banque || a.preset - b.preset);
}

/** SourceZones de l'échantillonneur pour un preset (positions relatives au PCM de chaque clé). */
export function sourceDuPreset(id: string, p: PresetAnalyse): SourceZones {
  const zones: ZoneSource[] = p.zones.map((z) => {
    const zs: ZoneSource = { fichier: z.cle, racine: z.racine, cents: z.cents, bas: z.bas, haut: z.haut, velBas: z.velBas, velHaut: z.velHaut, gainDb: z.gainDb, debut: 0, fin: z.fin - z.debut };
    if (z.boucle) zs.boucle = { debut: z.boucle.debut - z.debut, fin: z.boucle.fin - z.debut };
    return zs;
  });
  const secondes = new Map(p.zones.map((z) => [z.cle, ((z.fin - z.debut) / z.frequence) * (z.droite !== undefined ? 2 : 1)]));
  const relache = p.zones.reduce((r, z) => Math.max(r, z.relache), 0.005);
  return {
    id,
    canaux: p.zones.some((z) => z.droite !== undefined) ? 2 : 1,
    gainDb: 0,
    relache: Math.min(5, relache),
    budgetS: [...secondes.values()].reduce((a, b) => a + b, 0),
    zones,
  };
}
