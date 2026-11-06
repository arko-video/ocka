// Banc de l'échantillonneur (M1, C1), piloté par echantillonneur.spec.ts : justesse, bouclage, écoute = export,
// instrument absent, mémoire de 8 vrais instruments, planification de 16 pistes. Chaque scénario est sur window.m1.
import { contexteAudio } from '../../src/enregistrement/contexte';
import { dureeMorceau } from '../../src/morceau/temps';
import type { Morceau } from '../../src/morceau/types';
import { construireGraphe, preparerGraphe } from '../../src/moteur/graphe';
import { banqueDe, oublierBanque } from '../../src/moteur/instruments/banque';
import { cacheZones } from '../../src/moteur/instruments/cache-zones';
import { creerEchantillonneur } from '../../src/moteur/instruments/echantillonneur';
import { fournisseur } from '../../src/moteur/instruments/fournisseur';
import { choisirZone } from '../../src/moteur/instruments/zones';
import { creerLecteur } from '../../src/moteur/lecteur';
import { ErreurOcka } from '../../src/moteur/erreur';
import { ecartDb, hauteurMediane, installerBanque, installerFaux, longueursDecodees, morceauAvec, rapportClic, type FauxInstrument, type PisteTest } from './outils';

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une note tenue `duree` s, rendue seule (échantillonneur direct) à `fs` Hz. */
async function rendreNote(id: string, midi: number, vel: number, duree: number, fs: number, glisseVers?: number): Promise<Float32Array> {
  const source = await fournisseur().chargerSource(id);
  const ctx = new OfflineAudioContext(1, Math.ceil((duree + 0.5) * fs), fs);
  const e = creerEchantillonneur(ctx, source);
  await e.preparer([{ midi, vel }]);
  e.jouer(midi, vel, 0, duree, ctx.destination, { glisseVers });
  const b = await ctx.startRendering();
  e.liberer();
  return b.getChannelData(0);
}

/** Rendu hors ligne d'un morceau : `t0` null = comme l'export (fenêtres de 0,5 s depuis 0) ; sinon comme l'écoute après un saut à t0. */
async function rendreMorceau(m: Morceau, t0: number | null, fs: number): Promise<Float32Array[]> {
  const duree = dureeMorceau(m);
  const ctx = new OfflineAudioContext(2, Math.ceil((duree + 1) * fs), fs);
  const g = await preparerGraphe(ctx, m, new Map(), ctx.destination, { sons: new Map() }, t0 ?? 0);
  await g.pret;
  if (t0 === null) {
    g.planifier(0, 1, 0, true);
    for (let t = 1; t < duree + 1; t += 0.5) g.planifier(t, t + 0.5, 0);
  } else {
    g.planifier(t0, t0, 0, true); // demarrerA du lecteur : notes déjà commencées
    for (let t = t0; t < duree + 1; t += 0.2) g.planifier(t, t + 0.2, 0);
  }
  const b = await ctx.startRendering();
  g.detruire();
  oublierBanque(ctx);
  return [b.getChannelData(0), b.getChannelData(1)];
}

/** Morceau chromatique qui joue TOUTES les zones d'un instrument (pire cas pour la mémoire). */
async function pisteToutesZones(id: string, idPiste: string): Promise<PisteTest> {
  const s = await fournisseur().chargerSource(id);
  const notes = s.zones.slice(0, 64).map((z, i) => ({ pas: i, duree: 1, midi: z.racine, vel: Math.max(0.1, (z.velBas + z.velHaut) / 2 / 127) }));
  const pas = Math.max(16, Math.ceil(notes.length / 16) * 16);
  return { id: idPiste, instrument: id, pas, notes };
}

const tas = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;

const m1 = {
  installerFaux,
  installerBanque,
  longueurs: () => Object.fromEntries(longueursDecodees),

  /** Hauteur mesurée (cents) de chaque note, rendue à `fs` Hz. */
  async justesse(id: string, notes: number[], fs: number) {
    const res: { midi: number; mesure: number; ecart: number; detune: number }[] = [];
    const s = await fournisseur().chargerSource(id);
    for (const midi of notes) {
      const x = await rendreNote(id, midi, 0.9, 1.2, fs);
      const mesure = hauteurMediane(x, fs, 0.25, 1.1);
      res.push({ midi, mesure, ecart: mesure - midi * 100, detune: choisirZone(s, midi, 0.9)!.detune });
    }
    return res;
  },

  /** Glissé : hauteur au début et à la fin d'une note qui glisse vers `vers`. */
  async glisse(id: string, midi: number, vers: number, fs: number) {
    const x = await rendreNote(id, midi, 0.9, 1, fs, vers);
    return { debut: hauteurMediane(x, fs, 0.2, 0.6), fin: hauteurMediane(x, fs, 0.97, 1.12) };
  },

  /** Note tenue `duree` s sur une zone bouclée : rapport de clic aux raccords de boucle. */
  async bouclage(id: string, midi: number, duree: number, fs: number) {
    const s = await fournisseur().chargerSource(id);
    const { zone, detune } = choisirZone(s, midi, 0.9)!;
    if (!zone.boucle) return null;
    const x = await rendreNote(id, midi, 0.9, duree, fs);
    const vitesse = Math.pow(2, detune / 1200) * 48000;
    const [lb, lf] = [zone.boucle.debut, zone.boucle.fin];
    const raccords: number[] = [];
    for (let k = 1; (lf + (k - 1) * (lf - lb)) / vitesse < duree; k++) raccords.push((lf + (k - 1) * (lf - lb)) / vitesse);
    return { raccords: raccords.length, rapport: rapportClic(x, fs, raccords, Math.min(0.3, raccords[0]! - 0.05), duree - 0.02) };
  },

  /**
   * Écoute après un saut à t0 = export, sur [t0 + 30 ms, fin]. `effets` : sidechain (kicks d'une batterie muette),
   * LFO de hauteur (pitch bend) et de panoramique, courbe de volume (tranches de M2).
   */
  async ecouteExport(pistes: PisteTest[], t0: number, fs: number, effets: string[] = []) {
    const m = morceauAvec(pistes, 4, 120);
    if (effets.length) {
      const a = (x: string) => effets.includes(x);
      m.motifs.kicks = { type: 'batterie', pas: 16, pistes: { kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] } };
      m.sections[0]!.motifs.batterie = 'kicks';
      m.pistes = m.pistes.map((p) => {
        if (p.id === 'batterie') return { ...p, muet: true };
        const sc = a('sidechain') ? { sidechain: { source: 'kick' as const, force: 0.8, relache: 0.15 } } : {};
        if (p.id === 'orgue') return { ...p, ...sc, ...(a('hauteur') ? { lfo: [{ cible: { type: 'hauteur' as const }, forme: 'sinus' as const, periode: 16, profondeur: 0.04, phase: 0 }] } : {}) };
        if (p.id === 'mono' && a('pan')) return { ...p, lfo: [{ cible: { type: 'pan' as const }, forme: 'triangle' as const, periode: 8, profondeur: 0.6, phase: 0.25 }] };
        if (p.id === 'piano' && a('volume')) return { ...p, auto: [{ cible: { type: 'volume' as const }, sections: { s: [{ pas: 0, valeur: 1 }, { pas: 48, valeur: 0.3 }] } }] };
        return p;
      });
    }
    const exp = await rendreMorceau(m, null, fs);
    const ecoute = await rendreMorceau(m, t0, fs);
    const de = Math.round((t0 + 0.03) * fs);
    let crete = 0;
    for (const c of exp) for (let i = de; i < c.length; i++) crete = Math.max(crete, Math.abs(c[i]!));
    return { ecartDb: ecartDb(exp, ecoute, de), crete };
  },

  /** Instrument absent : muet et compté à l'écoute (sans planter), erreur claire « instrument_absent » à l'export. */
  async absent() {
    const m = morceauAvec([{ id: 'x', instrument: 'absent-instrument@1', pas: 16, notes: [{ pas: 0, duree: 4, midi: 60, vel: 1 }, { pas: 8, duree: 4, midi: 62, vel: 1 }] }], 1);
    const ctx = contexteAudio();
    await ctx.resume();
    const g = await preparerGraphe(ctx, m, new Map(), ctx.createGain(), { sons: new Map() });
    await g.pret;
    g.planifier(0, 2, ctx.currentTime + 0.1);
    const ecoute = { muettes: g.muettes, manquants: [...g.instrumentsManquants] };
    g.arreter();
    g.detruire();
    const off = new OfflineAudioContext(2, 48000 * 3, 48000);
    let erreur: { code: string; message: string } | null = null;
    try {
      await construireGraphe(off, m, new Map(), off.destination, { sons: new Map() });
    } catch (e) {
      erreur = e instanceof ErreurOcka ? { code: e.code, message: e.message } : { code: 'autre', message: String(e) };
    }
    oublierBanque(off);
    return { ecoute, erreur };
  },

  /** 8 pistes de vrais instruments (toutes leurs zones) : préparation par le lecteur, lecture 3 s, puis export. */
  async memoire8(ids: string[]) {
    const pistes = await Promise.all(ids.map((id, i) => pisteToutesZones(id, `p${i}`)));
    const m = morceauAvec(pistes, 4, 120);
    const avant = { tas: tas(), zones: cacheZones.octets };
    const lecteur = creerLecteur();
    const t = performance.now();
    await lecteur.charger(m);
    const msPreparation = performance.now() - t;
    lecteur.lire();
    await attendre(3000);
    lecteur.pause();
    const apresLecture = { tas: tas(), zones: cacheZones.octets, decodages: cacheZones.decodages };
    const t2 = performance.now();
    const off = new OfflineAudioContext(2, 44100 * 2, 44100);
    const g = await construireGraphe(off, m, new Map(), off.destination, { sons: new Map() });
    const msExport = performance.now() - t2;
    g.detruire();
    oublierBanque(off);
    const r = { avant, msPreparation, apresLecture, msGrapheExport: msExport, decodagesExport: cacheZones.decodages - apresLecture.decodages, muettes: lecteur.notesMuettes, pic: cacheZones.pic };
    (window as unknown as { lecteurM1: unknown }).lecteurM1 = lecteur;
    return r;
  },

  /** Libère le lecteur du test mémoire (les zones restent en cache, désépinglées). */
  finirMemoire() {
    (window as unknown as { lecteurM1?: { detruire(): void } }).lecteurM1?.detruire();
    return { zones: cacheZones.octets };
  },

  /** 16 pistes denses jouées par le vrai lecteur pendant `ms` ; temps de planifier sur des fenêtres de 200 ms. */
  async seizePistes(pistes: PisteTest[], ms: number) {
    const m = morceauAvec(pistes, 8, 140);
    const ctx = contexteAudio();
    await ctx.resume();
    // 1. planifier seul : 40 fenêtres de 200 ms, chronométrées.
    const g = await preparerGraphe(ctx, m, new Map(), ctx.createGain(), { sons: new Map() });
    await g.pret;
    const temps: number[] = [];
    const origine = ctx.currentTime + 0.5;
    for (let t = 0; t < 8; t += 0.2) {
      const d = performance.now();
      g.planifier(t, t + 0.2, origine);
      temps.push(performance.now() - d);
    }
    g.arreter();
    g.detruire();
    // 2. Le vrai lecteur (minuterie de 25 ms, fenêtre de 200 ms).
    const banque = banqueDe(ctx);
    const [retards0, sautees0] = [banque.retards, banque.sautees];
    const lecteur = creerLecteur();
    await lecteur.charger(m);
    lecteur.lire();
    await attendre(ms);
    lecteur.pause();
    const r = { retards: banque.retards - retards0, sautees: banque.sautees - sautees0, muettes: lecteur.notesMuettes };
    lecteur.detruire();
    temps.sort((a, b) => a - b);
    return { ...r, planifierMoyenMs: temps.reduce((a, b) => a + b, 0) / temps.length, planifierMaxMs: temps.at(-1)!, notes: pistes.reduce((a, p) => a + p.notes.length, 0) };
  },
};

(window as unknown as { m1: typeof m1; m1Pret: boolean }).m1 = m1;
(window as unknown as { m1Pret: boolean }).m1Pret = true;
export type { FauxInstrument };
