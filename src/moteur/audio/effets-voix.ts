// Effets de la voix (Piste.effets), branchés par creerChaineVoix (chaines.ts) après le préréglage.
//  - Écho : croche pointée au tempo, retour 0,35, passe-haut 250 Hz + passe-bas 4 kHz DANS la boucle.
//  - Radio : 2 passe-haut 400 Hz + 2 passe-bas 3 kHz autour d'une saturation douce (WaveShaper, oversample 4x), +4 dB.
//  - Doubler : 2 copies retardées de 12 et 19 ms, modulées lentement, à gauche et à droite.
// Les filtres « Butterworth » : pour un passe-haut ou un passe-bas, le Q du Web Audio est en dB (−3,01 dB = 0,707).

/** Q (en dB, Web Audio) d'un filtre Butterworth du 2e ordre. */
export const Q_BUTTERWORTH = 20 * Math.log10(Math.SQRT1_2);
/** Retour de l'écho (chaque répétition est 0,35 fois la précédente). */
export const RETOUR_ECHO = 0.35;
/** Niveau de la 1re répétition quand echo = 1. */
export const NIVEAU_ECHO = 0.5;
/** Envoi de réverbe AJOUTÉ à celui du préréglage quand reverbe = 1. */
export const NIVEAU_REVERBE = 0.5;
/** Niveau de chaque copie du doubler. */
export const NIVEAU_DOUBLE = 0.5;
/**
 * Avance de l'écho (trames) : le passe-haut et le passe-bas de la boucle retardent le pic d'une répétition
 * de 2 trames (44,1 et 48 kHz) ; on les retire pour que l'écho tombe pile sur la croche pointée.
 */
const AVANCE_FILTRES = 2;

/** Un effet : on branche le son sur `entree` ; `noeuds` sont débranchés et `arreter` coupe les oscillateurs. */
export interface Effet {
  entree: AudioNode;
  sortie: AudioNode;
  noeuds: AudioNode[];
  arreter?: () => void;
}

function filtre(ctx: BaseAudioContext, type: BiquadFilterType, frequence: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequence;
  f.Q.value = Q_BUTTERWORTH;
  return f;
}

/** Retard de l'écho (s) : une croche pointée (3/4 de temps) au tempo, moins l'avance des filtres. */
export function retardEcho(tempo: number, frequence: number): number {
  return (0.75 * 60) / tempo - AVANCE_FILTRES / frequence;
}

/** Écho : envoi (niveau) → retard → passe-haut → passe-bas → sortie, et sortie → retour (0,35) → retard. */
export function creerEcho(ctx: BaseAudioContext, niveau: number, tempo: number): Effet {
  const envoi = ctx.createGain();
  envoi.gain.value = NIVEAU_ECHO * niveau;
  const t = retardEcho(tempo, ctx.sampleRate);
  const retard = ctx.createDelay(Math.max(1, t + 0.1));
  retard.delayTime.value = t;
  const passeHaut = filtre(ctx, 'highpass', 250);
  const passeBas = filtre(ctx, 'lowpass', 4000);
  const retour = ctx.createGain();
  retour.gain.value = RETOUR_ECHO;
  envoi.connect(retard).connect(passeHaut).connect(passeBas);
  passeBas.connect(retour).connect(retard);
  return { entree: envoi, sortie: passeBas, noeuds: [envoi, retard, passeHaut, passeBas, retour] };
}

/** Courbe de saturation douce (pente 1 près de 0, plafond 1/K) : grain de vieux haut-parleur. */
export function courbeRadio(points = 4097, k = 2.5): Float32Array<ArrayBuffer> {
  const c = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (2 * i) / (points - 1) - 1;
    c[i] = Math.tanh(k * x) / k;
  }
  return c;
}

/** Radio : 2 passe-haut 400 Hz → saturation (4x) → 2 passe-bas 3 kHz → +4 dB. Remplace le son sec. */
export function creerRadio(ctx: BaseAudioContext): Effet {
  const h1 = filtre(ctx, 'highpass', 400);
  const h2 = filtre(ctx, 'highpass', 400);
  const sat = ctx.createWaveShaper();
  sat.curve = courbeRadio();
  sat.oversample = '4x';
  const b1 = filtre(ctx, 'lowpass', 3000);
  const b2 = filtre(ctx, 'lowpass', 3000);
  const gain = ctx.createGain();
  gain.gain.value = Math.pow(10, 4 / 20);
  h1.connect(h2).connect(sat).connect(b1).connect(b2).connect(gain);
  return { entree: h1, sortie: gain, noeuds: [h1, h2, sat, b1, b2, gain] };
}

/** Doubler : 2 copies (12 et 19 ms, retards modulés ±1,5 ms à 0,31 et 0,47 Hz), à gauche et à droite. */
export function creerDoubler(ctx: BaseAudioContext): Effet {
  const entree = ctx.createGain();
  const fusion = ctx.createChannelMerger(2);
  const noeuds: AudioNode[] = [entree, fusion];
  const oscillateurs: OscillatorNode[] = [];
  [
    { t: 0.012, f: 0.31 },
    { t: 0.019, f: 0.47 },
  ].forEach(({ t, f }, cote) => {
    const retard = ctx.createDelay(0.05);
    retard.delayTime.value = t;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = f;
    const profondeur = ctx.createGain();
    profondeur.gain.value = 0.0015;
    lfo.connect(profondeur).connect(retard.delayTime);
    lfo.start();
    const niveau = ctx.createGain();
    niveau.gain.value = NIVEAU_DOUBLE;
    entree.connect(retard).connect(niveau).connect(fusion, 0, cote);
    noeuds.push(retard, lfo, profondeur, niveau);
    oscillateurs.push(lfo);
  });
  return {
    entree,
    sortie: fusion,
    noeuds,
    arreter() {
      for (const o of oscillateurs) {
        try {
          o.stop();
        } catch {
          /* déjà arrêté */
        }
      }
    },
  };
}
