// Rendu d'un bruitage sfxr (L) : la boucle de synthèse de sfxr (voir sfxr.ts), échantillon par échantillon, à
// 44 100 Hz avec 8 sous-échantillons, puis portée à 48 kHz (interpolation linéaire) et normalisée. Pur, déterministe.
import { mulberry32 } from '../briques';
import { paramsComplets } from './sfxr';

const FS_SFXR = 44100;
/** 5 s au plus (les enveloppes de sfxr peuvent aller jusqu'à 6,8 s). */
const MAX = 5 * FS_SFXR;
/** Crête du son fini (−1 dBFS). */
export const CRETE_SON = 0.89;

/** Le bruitage à 44 100 Hz (avant normalisation). */
export function synthetiserSfxr(params: Record<string, number>, graine: number): Float32Array {
  const p = paramsComplets(params);
  const hasard = mulberry32(graine >>> 0);
  const frnd = (r: number) => hasard() * r;
  const onde = Math.round(p.onde * 3);
  const bruit = new Float32Array(32);
  const phaser = new Float32Array(1024);
  const sortie = new Float32Array(MAX);

  let phase = 0, fperiod = 0, fmaxperiod = 0, fslide = 0, fdslide = 0, period = 0, squareDuty = 0, squareSlide = 0; // prettier-ignore
  let arpMod = 0, arpTime = 0, arpLimit = 0; // prettier-ignore
  const reinit = (relance: boolean) => {
    if (!relance) phase = 0;
    fperiod = 100 / (p.startFrequency * p.startFrequency + 0.001);
    period = Math.floor(fperiod);
    fmaxperiod = 100 / (p.minFrequency * p.minFrequency + 0.001);
    fslide = 1 - Math.pow(p.slide, 3) * 0.01;
    fdslide = -Math.pow(p.deltaSlide, 3) * 0.000001;
    squareDuty = 0.5 - p.squareDuty * 0.5;
    squareSlide = -p.dutySweep * 0.00005;
    arpMod =
      p.changeAmount >= 0 ? 1 - Math.pow(p.changeAmount, 2) * 0.9 : 1 + Math.pow(p.changeAmount, 2) * 10;
    arpTime = 0;
    arpLimit = p.changeSpeed === 1 ? 0 : Math.floor(Math.pow(1 - p.changeSpeed, 2) * 20000 + 32);
  };
  reinit(false);
  let fltp = 0, fltdp = 0, fltphp = 0; // prettier-ignore
  let fltw = Math.pow(p.lpFilterCutoff, 3) * 0.1;
  const fltwD = 1 + p.lpFilterCutoffSweep * 0.0001;
  const fltdmp = Math.min(0.8, (5 / (1 + Math.pow(p.lpFilterResonance, 2) * 20)) * (0.01 + fltw));
  let flthp = Math.pow(p.hpFilterCutoff, 2) * 0.1;
  const flthpD = 1 + p.hpFilterCutoffSweep * 0.0003;
  let vibPhase = 0;
  const vibSpeed = Math.pow(p.vibratoSpeed, 2) * 0.01;
  const vibAmp = p.vibratoDepth * 0.5;
  const envLength = [p.attackTime, p.sustainTime, p.decayTime].map((x) => Math.floor(x * x * 100000));
  let envStage = 0, envTime = 0, envVol = 0; // prettier-ignore
  let fphase = Math.pow(p.phaserOffset, 2) * 1020 * Math.sign(p.phaserOffset);
  const fdphase = Math.pow(p.phaserSweep, 2) * Math.sign(p.phaserSweep);
  let iphase = Math.abs(Math.trunc(fphase));
  let ipp = 0;
  for (let i = 0; i < 32; i++) bruit[i] = frnd(2) - 1;
  let repTime = 0;
  const repLimit = p.repeatSpeed === 0 ? 0 : Math.floor(Math.pow(1 - p.repeatSpeed, 2) * 20000 + 32);

  let n = 0;
  for (; n < MAX; n++) {
    repTime++;
    if (repLimit !== 0 && repTime >= repLimit) {
      repTime = 0;
      reinit(true);
    }
    arpTime++;
    if (arpLimit !== 0 && arpTime >= arpLimit) {
      arpLimit = 0;
      fperiod *= arpMod;
    }
    fslide += fdslide;
    fperiod *= fslide;
    if (fperiod > fmaxperiod) {
      fperiod = fmaxperiod;
      if (p.minFrequency > 0) break;
    }
    let rfperiod = fperiod;
    if (vibAmp > 0) {
      vibPhase += vibSpeed;
      rfperiod = fperiod * (1 + Math.sin(vibPhase) * vibAmp);
    }
    period = Math.max(8, Math.floor(rfperiod));
    squareDuty = Math.min(0.5, Math.max(0, squareDuty + squareSlide));
    envTime++;
    if (envTime > envLength[envStage]!) {
      envTime = 0;
      envStage++;
      if (envStage === 3) break;
    }
    if (envStage === 0) envVol = envLength[0]! > 0 ? envTime / envLength[0]! : 1;
    else if (envStage === 1)
      envVol = 1 + (envLength[1]! > 0 ? 1 - envTime / envLength[1]! : 0) * 2 * p.sustainPunch;
    else envVol = envLength[2]! > 0 ? 1 - envTime / envLength[2]! : 0;
    fphase += fdphase;
    iphase = Math.min(1023, Math.abs(Math.trunc(fphase)));
    if (flthpD !== 1) flthp = Math.min(0.1, Math.max(0.00001, flthp * flthpD));
    let ssample = 0;
    for (let si = 0; si < 8; si++) {
      let s = 0;
      phase++;
      if (phase >= period) {
        phase %= period;
        if (onde === 3) for (let k = 0; k < 32; k++) bruit[k] = frnd(2) - 1;
      }
      const fp = phase / period;
      if (onde === 0) s = fp < squareDuty ? 0.5 : -0.5;
      else if (onde === 1) s = 1 - fp * 2;
      else if (onde === 2) s = Math.sin(fp * 2 * Math.PI);
      else s = bruit[Math.floor((phase * 32) / period)]!;
      const pp = fltp;
      fltw = Math.min(0.1, Math.max(0, fltw * fltwD));
      if (p.lpFilterCutoff !== 1) {
        fltdp += (s - fltp) * fltw;
        fltdp -= fltdp * fltdmp;
      } else {
        fltp = s;
        fltdp = 0;
      }
      fltp += fltdp;
      fltphp += fltp - pp;
      fltphp -= fltphp * flthp;
      s = fltphp;
      phaser[ipp & 1023] = s;
      s += phaser[(ipp - iphase + 1024) & 1023]!;
      ipp = (ipp + 1) & 1023;
      ssample += s * envVol;
    }
    sortie[n] = Math.min(1, Math.max(-1, ssample / 8));
  }
  return sortie.slice(0, Math.max(1, n));
}

/** Le bruitage à `frequence` Hz (48 000 par défaut), crête à CRETE_SON, sans clic au début ni à la fin. */
export function rendreSfxr(params: Record<string, number>, graine: number, frequence = 48000): Float32Array {
  const s = synthetiserSfxr(params, graine);
  const n = Math.max(1, Math.round((s.length * frequence) / FS_SFXR));
  const out = new Float32Array(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const x = (i * FS_SFXR) / frequence;
    const k = Math.floor(x);
    const a = s[k] ?? 0;
    const b = s[k + 1] ?? 0;
    out[i] = a + (b - a) * (x - k);
    max = Math.max(max, Math.abs(out[i]!));
  }
  const g = max > 0 ? CRETE_SON / max : 0;
  const bord = Math.min(n >> 1, Math.round(0.002 * frequence));
  for (let i = 0; i < n; i++) {
    let e = g;
    if (i < bord) e *= i / bord;
    if (i >= n - bord) e *= (n - 1 - i) / bord;
    out[i] = out[i]! * e;
  }
  return out;
}
