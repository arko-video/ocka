// Les sons de batterie des kits OCKA, synthétisés en JS (aucun échantillon enregistré).
// Chaque kit est versionné (« trap@1 ») : si on retouche un son, on crée « trap@2 » et les vieux morceaux ne changent pas.
// Le « bruit » vient d'un générateur à graine fixe : un même kit donne toujours exactement les mêmes échantillons.
// À appeler dans avecFrequence(ctx.sampleRate, …) : tout est calculé directement à la bonne fréquence.

import { bruit, courbeExpo, expo, FREQ, melanger, mulberry32, multiplier, oscillateur } from '../synthese/briques';
import { filtrer, saturer } from '../synthese/effets';
import type { InstrumentBatterie } from '../../morceau/types';

/** Réglages d'un kit : chaque style a son caractère. */
interface Kit {
  kick: { de: number; a: number; glisse: number; tau: number; duree: number; clic: number; force: number };
  snare: { corps: [number, number]; tauCorps: number; tauBruit: number; passeHaut: number; passeBas: number; force: number };
  charley: { passeHaut: number; tauFerme: number; tauOuvert: number; passeBas: number };
  /** Passe-bas final de tout le kit (lo-fi : un peu étouffé). */
  sourdine: number;
  // Réglages facultatifs (kits de la vague B) : absents, le son des kits trap@1, drill@1 et lofi@1 ne bouge pas.
  /** Saturation « de bande » après la sourdine (boom bap : son poussiéreux). */
  bande?: number;
  /** Passe-haut final (boom bap : moins de sub, comme un vieux sample). */
  coupeBas?: number;
  /** Cloche 808 plus dure : fréquences des deux carrés, durée (tau) et saturation (phonk). */
  cowbell?: { f1: number; f2: number; tau: number; force: number };
  /** Le pad « perc » joue un bruit de vinyle (craquements et souffle) au lieu d'un « tok » (boom bap). */
  vinyle?: boolean;
  /** Crêtes propres au kit (sinon CRETES). */
  cretes?: Partial<Record<InstrumentBatterie, number>>;
}

const KITS: Record<string, Kit> = {
  'trap@1': {
    kick: { de: 230, a: 52, glisse: 0.04, tau: 0.11, duree: 0.42, clic: 0.5, force: 1.8 },
    snare: { corps: [190, 340], tauCorps: 0.045, tauBruit: 0.11, passeHaut: 1500, passeBas: 11000, force: 1.6 },
    charley: { passeHaut: 7500, tauFerme: 0.022, tauOuvert: 0.28, passeBas: 16000 },
    sourdine: 20000,
  },
  'drill@1': {
    kick: { de: 260, a: 55, glisse: 0.03, tau: 0.08, duree: 0.32, clic: 0.65, force: 2.2 },
    snare: { corps: [230, 410], tauCorps: 0.035, tauBruit: 0.085, passeHaut: 2200, passeBas: 13000, force: 2.0 },
    charley: { passeHaut: 8500, tauFerme: 0.018, tauOuvert: 0.22, passeBas: 17000 },
    sourdine: 20000,
  },
  'lofi@1': {
    kick: { de: 160, a: 48, glisse: 0.05, tau: 0.14, duree: 0.45, clic: 0.2, force: 1.4 },
    snare: { corps: [175, 310], tauCorps: 0.06, tauBruit: 0.14, passeHaut: 900, passeBas: 6500, force: 1.3 },
    charley: { passeHaut: 6000, tauFerme: 0.03, tauOuvert: 0.3, passeBas: 9000 },
    sourdine: 7500,
  },
  // Phonk : kick saturé qui claque, caisse claire SÈCHE (courte), charley fin et court, cloche 808 dure.
  'phonk@1': {
    kick: { de: 210, a: 50, glisse: 0.035, tau: 0.1, duree: 0.4, clic: 0.7, force: 3.2 },
    snare: { corps: [210, 380], tauCorps: 0.028, tauBruit: 0.05, passeHaut: 1800, passeBas: 12000, force: 2.4 },
    charley: { passeHaut: 8000, tauFerme: 0.016, tauOuvert: 0.2, passeBas: 16000 },
    sourdine: 20000,
    cowbell: { f1: 562, f2: 845, tau: 0.09, force: 2.5 },
  },
  // Pop : kick franc et court, clap bien net, charley clair.
  'pop@1': {
    kick: { de: 190, a: 52, glisse: 0.03, tau: 0.085, duree: 0.34, clic: 0.8, force: 1.7 },
    snare: { corps: [200, 360], tauCorps: 0.04, tauBruit: 0.12, passeHaut: 1300, passeBas: 12000, force: 1.6 },
    charley: { passeHaut: 7000, tauFerme: 0.03, tauOuvert: 0.3, passeBas: 15000 },
    sourdine: 20000,
  },
  // Boom bap : kick et caisse claire « poussiéreux » (filtrés, saturation de bande), vinyle sur le pad perc.
  'boombap@1': {
    kick: { de: 150, a: 50, glisse: 0.045, tau: 0.12, duree: 0.38, clic: 0.4, force: 1.9 },
    snare: { corps: [185, 330], tauCorps: 0.055, tauBruit: 0.15, passeHaut: 900, passeBas: 8000, force: 2.0 },
    charley: { passeHaut: 6500, tauFerme: 0.028, tauOuvert: 0.32, passeBas: 10000 },
    sourdine: 8500,
    bande: 1.8,
    coupeBas: 45,
    vinyle: true,
    cretes: { perc: 0.3 },
  },
};

/** Le kit demandé, ou celui du même style en version 1, ou trap@1. */
function kitDe(nom: string): Kit {
  return KITS[nom] ?? KITS[`${nom.split('@')[0]}@1`] ?? KITS['trap@1']!;
}

/** Ramène la crête d'un son à `crete` (les niveaux relatifs du kit sont réglés ici). */
function aCrete(s: Float32Array, crete: number): Float32Array {
  let max = 0;
  for (let i = 0; i < s.length; i++) max = Math.max(max, Math.abs(s[i]!));
  if (max > 0) for (let i = 0; i < s.length; i++) s[i] *= crete / max;
  return s;
}

/** Kick 808 court : la hauteur tombe très vite (le « claquement »), puis un corps rond qui s'éteint. */
function kick(k: Kit['kick'], graine: number): Float32Array {
  const corps = multiplier(oscillateur('sinus', k.duree, courbeExpo(k.de, k.a, k.glisse)), expo(k.duree, k.tau, 0.0006));
  // Le clic d'attaque : un éclat de bruit très court, filtré dans les aigus.
  const clic = multiplier(filtrer(bruit(0.012, graine), 'passe-haut', 2500), expo(0.012, 0.0018, 0.0002));
  return saturer(melanger(k.duree, [{ signal: corps }, { signal: clic, gain: k.clic }]), k.force);
}

/** Caisse claire : un corps (deux notes qui descendent un peu) + un bruit filtré qui « claque ». */
function snare(s: Kit['snare'], graine: number): Float32Array {
  const d = 0.38;
  const corps1 = multiplier(oscillateur('triangle', d, courbeExpo(s.corps[0] * 1.35, s.corps[0], 0.02)), expo(d, s.tauCorps, 0.0008));
  const corps2 = multiplier(oscillateur('sinus', d, courbeExpo(s.corps[1] * 1.25, s.corps[1], 0.015)), expo(d, s.tauCorps * 0.7, 0.0008));
  const souffle = filtrer(filtrer(bruit(d, graine), 'passe-haut', s.passeHaut), 'passe-bas', s.passeBas);
  const bruitEnv = multiplier(souffle, expo(d, s.tauBruit, 0.001));
  const claque = multiplier(filtrer(bruit(d, graine + 1), 'passe-bande', 4500, 1.2), expo(d, 0.012, 0.0005));
  return saturer(melanger(d, [{ signal: corps1, gain: 0.7 }, { signal: corps2, gain: 0.45 }, { signal: bruitEnv, gain: 0.8 }, { signal: claque, gain: 0.5 }]), s.force);
}

/** Clap : 4 éclats de bruit rapprochés (plusieurs mains), puis une petite queue. */
function clap(graine: number, sourdine: number): Float32Array {
  const d = 0.4;
  const source = filtrer(filtrer(bruit(d, graine), 'passe-bande', 1300, 0.9), 'passe-bas', Math.min(sourdine, 9000));
  const env = new Float32Array(source.length);
  const f = source.length / d;
  const eclats = [0, 0.0095, 0.019, 0.03];
  for (let i = 0; i < env.length; i++) {
    const t = i / f;
    let g = 0;
    for (const e of eclats) if (t >= e) g = Math.max(g, Math.exp(-(t - e) / (e === 0.03 ? 0.11 : 0.0055)));
    env[i] = g;
  }
  return saturer(multiplier(source, env), 1.4);
}

/** Charley : 6 ondes carrées « métalliques » (les rapports de la 808) + du bruit, gardés dans les aigus. */
function charley(c: Kit['charley'], ouvert: boolean, graine: number): Float32Array {
  const d = ouvert ? 0.7 : 0.14;
  const metal = melanger(d, [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => ({ signal: oscillateur('carre', d, f * 1.7), gain: 0.15 })));
  const source = melanger(d, [{ signal: metal, gain: 0.6 }, { signal: bruit(d, graine), gain: 0.5 }]);
  const filtre = filtrer(filtrer(filtrer(source, 'passe-haut', c.passeHaut), 'passe-haut', c.passeHaut), 'passe-bas', c.passeBas);
  return multiplier(filtre, expo(d, ouvert ? c.tauOuvert : c.tauFerme, 0.0005));
}

/** Rim : un « toc » sec sur le bord de la caisse. */
function rim(graine: number): Float32Array {
  const d = 0.09;
  const toc = melanger(d, [
    { signal: multiplier(oscillateur('triangle', d, 1750), expo(d, 0.009, 0.0003)), gain: 0.7 },
    { signal: multiplier(oscillateur('sinus', d, 520), expo(d, 0.014, 0.0003)), gain: 0.5 },
    { signal: multiplier(filtrer(bruit(d, graine), 'passe-bande', 3200, 1.5), expo(d, 0.004, 0.0002)), gain: 0.6 },
  ]);
  return saturer(toc, 1.5);
}

/** Perc : un petit « tok » boisé qui descend un peu. */
function perc(graine: number, style: string): Float32Array {
  const d = 0.2;
  const f = style === 'drill' ? 1150 : style === 'lofi' ? 640 : 880;
  const tok = multiplier(oscillateur('sinus', d, courbeExpo(f * 1.25, f, 0.02)), expo(d, 0.035, 0.0005));
  const grain = multiplier(filtrer(bruit(d, graine), 'passe-bande', f * 3, 2), expo(d, 0.008, 0.0003));
  return melanger(d, [{ signal: tok }, { signal: grain, gain: 0.35 }]);
}

/** Cowbell : deux carrés (540 et 800 Hz) passés dans un filtre, la cloche de la 808. */
function cowbell(): Float32Array {
  const d = 0.45;
  const deux = melanger(d, [{ signal: oscillateur('carre', d, 540) }, { signal: oscillateur('carre', d, 800) }]);
  const env = expo(d, 0.11, 0.0005);
  for (let i = 0; i < env.length; i++) env[i] *= 0.6 + 0.4 * Math.exp(-i / (0.012 * (env.length / d)));
  return multiplier(filtrer(deux, 'passe-bande', 2600, 1.4), env);
}

/**
 * Cloche 808 « accordée » (phonk) : deux carrés à `f` et `f` × 1,5 (les rapports de la 808), filtrés autour du
 * 2e, saturés. Sert au kit phonk (fréquence fixe) et peut servir de son de mélodie accordé (voir le rapport B1).
 */
export function cowbellAccordee(f: number, total: number, tau = 0.09, force = 2.5): Float32Array {
  const deux = melanger(total, [{ signal: oscillateur('carre', total, f) }, { signal: oscillateur('carre', total, f * 1.504), gain: 0.8 }]);
  const env = expo(total, tau, 0.0005);
  for (let i = 0; i < env.length; i++) env[i] *= 0.55 + 0.45 * Math.exp(-i / (0.01 * FREQ));
  return saturer(multiplier(filtrer(filtrer(deux, 'passe-bande', f * 3, 1.1), 'passe-haut', f * 0.9), env), force);
}

/**
 * Vinyle (boom bap) : un souffle très doux + des craquements épars, avec des fondus de 0,15 s.
 * Joué 2 fois par mesure (pas 0 et 8) : les fondus se chevauchent dès 75 BPM, donc le bruit ne s'arrête pas.
 */
function vinyle(graine: number): Float32Array {
  const d = 1.9;
  const souffle = multiplier(filtrer(filtrer(bruit(d, graine), 'passe-haut', 2000), 'passe-bas', 7000), 0.05);
  const n = souffle.length;
  const h = mulberry32(graine + 7);
  const craque = new Float32Array(n);
  for (let k = 0; k < 40; k++) {
    const debut = Math.floor(h() * (n - 400));
    const force = 0.15 + 0.85 * h() * h();
    const longueur = 30 + Math.floor(h() * 160);
    for (let j = 0; j < longueur; j++) craque[debut + j] += force * (h() * 2 - 1) * Math.exp(-j / (longueur / 4));
  }
  const s = melanger(d, [{ signal: souffle }, { signal: filtrer(craque, 'passe-haut', 1200) }]);
  const fondu = Math.round(0.15 * FREQ);
  for (let i = 0; i < fondu; i++) {
    s[i] *= i / fondu;
    s[n - 1 - i] *= i / fondu;
  }
  return s;
}

/**
 * Niveau de crête de chaque instrument dans le kit (l'équilibre de départ). Pads perso : la crête à laquelle
 * le son importé est ramené (un peu sous le kick, comme une caisse claire forte).
 */
export const CRETES: Record<InstrumentBatterie, number> = {
  kick: 1, snare: 0.82, clap: 0.7, charley: 0.32, charleyOuvert: 0.26, rim: 0.42, perc: 0.38, cowbell: 0.3,
  perso1: 0.8, perso2: 0.8, perso3: 0.8, perso4: 0.8,
};

/** Synthétise un son de batterie d'un kit (signal mono à la fréquence des briques). */
export function synthetiserFrappe(nomKit: string, instrument: InstrumentBatterie): Float32Array {
  const kit = kitDe(nomKit);
  const style = nomKit.split('@')[0] ?? 'trap';
  const graine = 1000 + Object.keys(CRETES).indexOf(instrument) * 17;
  let s: Float32Array;
  switch (instrument) {
    case 'kick': s = kick(kit.kick, graine); break;
    case 'snare': s = snare(kit.snare, graine); break;
    case 'clap': s = clap(graine, kit.sourdine); break;
    case 'charley': s = charley(kit.charley, false, graine); break;
    case 'charleyOuvert': s = charley(kit.charley, true, graine); break;
    case 'rim': s = rim(graine); break;
    case 'perc': s = kit.vinyle ? vinyle(graine) : perc(graine, style); break;
    case 'cowbell': s = kit.cowbell ? cowbellAccordee(kit.cowbell.f1, 0.45, kit.cowbell.tau, kit.cowbell.force) : cowbell(); break;
    // perso1 à perso4 jouent le son importé du pad (importes.ts), jamais un son synthétisé.
    default: s = new Float32Array(Math.round(0.01 * FREQ)); break;
  }
  if (kit.sourdine < 19000) s = filtrer(s, 'passe-bas', kit.sourdine, 0.6);
  // Kits de la vague B seulement (réglages absents des kits @1 d'avant) : bande puis passe-haut.
  if (kit.bande !== undefined && !(kit.vinyle && instrument === 'perc')) s = saturer(s, kit.bande);
  if (kit.coupeBas !== undefined) s = filtrer(s, 'passe-haut', kit.coupeBas, 0.6);
  // Fondu de 3 ms à la fin : jamais de clic.
  const n = Math.min(s.length, Math.round(0.003 * FREQ));
  for (let k = 0; k < n; k++) s[s.length - n + k] *= 1 - (k + 1) / n;
  return aCrete(s, kit.cretes?.[instrument] ?? CRETES[instrument]);
}
