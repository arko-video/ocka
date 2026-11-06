// « ocka-303@1 » : basse acide façon TB-303 / LB302 (L). Mode « motif » : UN tampon par passage du motif, car
// l'accent (vel ≥ 0,8) et le slide (Note.glisse) dépendent des notes voisines :
// - slide : la note garde la porte ouverte et glisse (≈ 35 ms) vers la suivante, qui ne relance pas les enveloppes ;
// - accent : plus fort, enveloppe du filtre courte, et un « condensateur » d'accent qui se charge quand les accents
//   se suivent (le « wow » de la 303).
// Filtre passe-bas résonant 24 dB/oct (échelle à 4 pôles, intégrateurs TPT de Zavalishin, tanh à l'entrée) : stable
// même résonance au maximum (chaque étage est stable et reçoit un signal borné). Pur, déterministe.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe, NoteMotifSynthe } from '../../api-synthes';
import { FREQ } from '../briques';
import { entreLog, nb } from './communs';

/** Queue après la fin du passage (relâchement de la dernière note et filtre). */
const QUEUE = 0.08;
/** Niveau de sortie (la vélocité et l'accent sont DANS le tampon, joué au gain GAIN_NOTE). */
const NIVEAU = 0.32;

/** PolyBLEP : arrondit le saut d'une onde scie ou carrée autour du saut (moins de repliement). */
function blep(p: number, dp: number): number {
  if (p < dp) {
    const x = p / dp;
    return x + x - x * x - 1;
  }
  if (p > 1 - dp) {
    const x = (p - 1) / dp;
    return x * x + x + x + 1;
  }
  return 0;
}

interface Etape {
  debut: number;
  /** Fin de la porte (échantillon) : la note suivante si elle glisse, sinon sa fin. */
  finPorte: number;
  midi: number;
  vel: number;
  relance: boolean;
}

/** Les notes du passage, triées, avec leurs portes (slide = porte tenue jusqu'à la note suivante, sans relance). */
function etapes(notes: readonly NoteMotifSynthe[], duree: number): Etape[] {
  const ns = notes
    .filter((x) => x.t >= 0 && x.t < duree && Number.isFinite(x.midi))
    .sort((a, b) => a.t - b.t || a.midi - b.midi);
  return ns.map((x, i) => {
    const suivante = ns[i + 1];
    const glisse = x.glisse !== undefined && suivante !== undefined;
    const fin = glisse ? suivante.t + 0.001 : x.t + Math.max(0.005, x.duree);
    const avant = ns[i - 1];
    return {
      debut: Math.round(x.t * FREQ),
      finPorte: Math.round(fin * FREQ),
      midi: x.midi,
      vel: x.vel,
      relance: !(avant && avant.glisse !== undefined),
    };
  });
}

/** Rend un passage de 303 (mono). `p` : réglages 0 à 1 (voir `params`). */
export function rendre303(
  notes: readonly NoteMotifSynthe[],
  duree: number,
  p: Record<string, number>,
): Float32Array {
  const n = nb(duree + QUEUE);
  const out = new Float32Array(n);
  const es = etapes(notes, duree);
  if (es.length === 0) return out;
  const carre = (p.onde ?? 0) >= 0.5;
  const fBase = entreLog(35, 2500, p.coupure ?? 0.35);
  const k = 3.98 * Math.min(1, Math.max(0, p.resonance ?? 0.6));
  const modEnv = 5 * (p.enveloppe ?? 0.5);
  const tauEnv = entreLog(0.08, 1.6, p.decroissance ?? 0.4);
  const forceAccent = p.accent ?? 0.6;
  const sat = p.saturation ?? 0.2;
  const drive = 1 + sat * 7;
  // La saturation compresse (plus de sonie) : on la compense pour garder un niveau stable.
  const normeSat = Math.tanh(drive) * (1 + 0.9 * sat);
  const kGlisse = 1 - Math.exp(-1 / (0.035 * FREQ));
  const kAtt = 1 - Math.exp(-1 / (0.002 * FREQ));
  const kRel = Math.exp(-1 / (0.005 * FREQ));
  const kAmp = Math.exp(-1 / (1.6 * FREQ));
  const kCharge = 1 - Math.exp(-1 / (0.06 * FREQ));
  const compense = 1 + 0.6 * k;
  let kEnv = Math.exp(-1 / (tauEnv * FREQ));

  let e = -1;
  let fin = 0;
  let lf = Math.log2(frequenceMidi(es[0]!.midi));
  let lfCible = lf;
  let phase = 0;
  let envF = 0;
  let envA = 0;
  let cibleA = 0;
  let accent = false;
  let vel = 1;
  let charge = 0;
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0; // prettier-ignore
  let fcAvant = -1;
  let G = 0;
  for (let i = 0; i < n; i++) {
    while (e + 1 < es.length && es[e + 1]!.debut <= i) {
      const x = es[++e]!;
      fin = x.finPorte;
      lfCible = Math.log2(frequenceMidi(x.midi));
      if (x.relance) {
        lf = lfCible;
        envF = 1;
        cibleA = 1;
        accent = x.vel >= 0.8;
        vel = accent ? 1 : 0.55 + 0.45 * Math.min(1, x.vel / 0.8);
        kEnv = Math.exp(-1 / ((accent ? Math.min(tauEnv, 0.12) : tauEnv) * FREQ));
      }
    }
    const porte = e >= 0 && i < fin;
    lf += (lfCible - lf) * kGlisse;
    const f = Math.pow(2, lf);
    // Oscillateur (PolyBLEP).
    const dp = f / FREQ;
    let osc = 2 * phase - 1 - blep(phase, dp);
    if (carre) osc = (phase < 0.5 ? 1 : -1) + blep(phase, dp) - blep((phase + 0.5) % 1, dp);
    phase += dp;
    if (phase >= 1) phase -= 1;
    // Enveloppes : filtre (relancée à chaque note), accent (condensateur), volume (porte).
    envF *= kEnv;
    charge += ((accent ? envF : 0) - charge) * kCharge;
    cibleA *= kAmp;
    envA = porte ? envA + (cibleA - envA) * kAtt : envA * kRel;
    // Filtre 24 dB/oct.
    const fc = Math.min(0.42 * FREQ, fBase * Math.pow(2, modEnv * envF + 3.2 * forceAccent * charge));
    if (Math.abs(fc - fcAvant) > 0.5) {
      fcAvant = fc;
      const g = Math.tan((Math.PI * fc) / FREQ);
      G = g / (1 + g);
    }
    const x = osc * 0.7;
    const G2 = G * G;
    const S = (1 - G) * (G2 * G * s1 + G2 * s2 + G * s3 + s4);
    const y4lin = (G2 * G2 * x + S) / (1 + k * G2 * G2);
    const u = Math.tanh(x - k * y4lin);
    let v = (u - s1) * G;
    let y = v + s1;
    s1 = y + v;
    v = (y - s2) * G;
    y = v + s2;
    s2 = y + v;
    v = (y - s3) * G;
    y = v + s3;
    s3 = y + v;
    v = (y - s4) * G;
    y = v + s4;
    s4 = y + v;
    const a = y * compense * envA * vel * (accent ? 1 + 0.6 * forceAccent : 1);
    out[i] = (NIVEAU * Math.tanh(a * drive)) / normeSat;
  }
  return out;
}

const def: DefinitionSynthe = {
  id: '303',
  nom: 'Basse acide 303',
  famille: 'Synthés',
  motsCles: ['303', 'acide', 'acid', 'basse', 'lb302', 'synthe'],
  pret: true,
  params: {
    onde: { defaut: 0, crans: 2 }, // scie | carré
    coupure: { defaut: 0.35 },
    resonance: { defaut: 0.6 },
    enveloppe: { defaut: 0.5 },
    decroissance: { defaut: 0.4 },
    accent: { defaut: 0.6 },
    saturation: { defaut: 0.2 },
  },
  relache: 0.01,
  tenu: false,
  mode: 'motif',
  rendreMotif(notes, duree, r) {
    return [rendre303(notes, duree, r.params)];
  },
};
export default def;
