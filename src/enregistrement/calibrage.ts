// Calibrage de la latence aller-retour (sortie → air → micro → entrée), dans le contexte audio COMMUN :
// on joue un chirp à une heure précise, le capteur date ce qu'il entend, l'intercorrélation donne le retard.
// 7 essais ; si les mesures ne tombent pas d'accord à 3 ms près, on recommence (3 séries au plus) ; médiane.
import { ErreurOcka } from '../moteur/api';
import { bluetoothDetecte, CONSEIL_BLUETOOTH, majAppareil } from './appareil';
import { fabriquerChirp, intercorreler, medianeAvecRejet, signalSuffisant } from './calcul-calibrage';
import { Capture, type MorceauCapture } from './capture';
import { attendre, contexteAudio } from './contexte';
import { memoriserMesure } from './latence';
import { fermerMicro, ouvrirMicro, type Micro } from './micro';

export { ajustementLatence, latenceMemorisee, reglerLatence } from './latence';

const ESSAIS = 7;
const SERIES_MAX = 3;
/** Plus grand retard cherché : 0,5 s (bien au-delà d'un casque filaire). */
const RETARD_MAX = 0.5;

export interface OptionsCalibrage {
  /**
   * Défaut true : avec un casque Bluetooth, on calibre quand même et on PRÉVIENT (voir surAvertissement et
   * avertissementCalibrage). false : on lève ErreurOcka « bluetooth » comme avant.
   */
  ignorerBluetooth?: boolean;
  /** Appelé dès qu'un conseil est à afficher (avant la fin des 7 essais). Code : « bluetooth ». */
  surAvertissement?: (message: string, code: 'bluetooth') => void;
  /** Pour les tests : le chirp va dans `sortie` et la capture écoute `entree` (au lieu du haut-parleur et du micro). */
  branchement?: (ctx: AudioContext) => { sortie: AudioNode; entree: AudioNode };
}

let dernierAvertissement: string | null = null;

/** Conseil du dernier calibrage (casque Bluetooth détecté), ou null : l'interface l'affiche à côté de la mesure. */
export function avertissementCalibrage(): string | null {
  return dernierAvertissement;
}

/** Mesure la latence aller-retour en secondes et la mémorise pour cet appareil. */
export async function calibrerLatence(surProgression?: (p: number) => void, options: OptionsCalibrage = {}): Promise<number> {
  const ctx = contexteAudio();
  await ctx.resume();
  dernierAvertissement = null;
  let micro: Micro | null = null;
  let capture: Capture | null = null;
  try {
    let sortie: AudioNode = ctx.destination;
    let entree: AudioNode;
    if (options.branchement) ({ sortie, entree } = options.branchement(ctx));
    else {
      micro = await ouvrirMicro();
      entree = ctx.createMediaStreamSource(micro.flux);
    }
    await majAppareil(micro?.piste).catch(() => false);
    if (!options.branchement && (await bluetoothDetecte(ctx, micro?.piste))) {
      if (options.ignorerBluetooth === false) throw new ErreurOcka(CONSEIL_BLUETOOTH, 'bluetooth');
      dernierAvertissement = CONSEIL_BLUETOOTH;
      options.surAvertissement?.(CONSEIL_BLUETOOTH, 'bluetooth');
    }
    capture = await Capture.creer(ctx, entree);
    const chirp = fabriquerChirp(ctx.sampleRate);
    for (let serie = 0; serie < SERIES_MAX; serie++) {
      const mesures: number[] = [];
      let faibles = 0;
      for (let i = 0; i < ESSAIS; i++) {
        const r = await unEssai(ctx, capture, sortie, chirp);
        if (r === null) faibles++;
        else mesures.push(r);
        surProgression?.(Math.min(0.99, (serie * ESSAIS + i + 1) / (ESSAIS * (serie + 1))));
        // Trop d'essais sans chirp entendu : inutile d'insister.
        if (faibles > ESSAIS - 5) {
          throw new ErreurOcka("Le micro n'entend pas le signal. Colle l'écouteur contre le micro du téléphone, ou monte le volume.", 'signal_faible');
        }
      }
      const latence = medianeAvecRejet(mesures);
      if (latence !== null) {
        memoriserMesure(latence);
        surProgression?.(1);
        return latence;
      }
    }
    throw new ErreurOcka("Les mesures ne tombent pas d'accord. Mets-toi au calme, colle l'écouteur contre le micro et recommence.", 'calibrage_instable');
  } finally {
    capture?.fermer();
    fermerMicro(micro);
  }
}

/** Un essai : joue le chirp à une heure exacte, capture, cherche le chirp ; renvoie le retard (s) ou null. */
async function unEssai(ctx: AudioContext, capture: Capture, sortie: AudioNode, chirp: Float32Array): Promise<number | null> {
  const fe = ctx.sampleRate;
  const morceaux: MorceauCapture[] = [];
  capture.surMorceau = (m) => morceaux.push(m);
  const premier = await capture.demarrer();
  // Heure du chirp : sur un échantillon entier, un peu après le début de la capture.
  const frameChirp = Math.ceil((Math.max(ctx.currentTime, premier / fe) + 0.12) * fe);
  const tampon = ctx.createBuffer(1, chirp.length, fe);
  tampon.copyToChannel(chirp as Float32Array<ArrayBuffer>, 0);
  const source = ctx.createBufferSource();
  source.buffer = tampon;
  source.connect(sortie);
  source.start(frameChirp / fe);
  await attendre((frameChirp / fe - ctx.currentTime + DUREE_ATTENTE) * 1000);
  await capture.arreter();
  capture.surMorceau = null;
  source.disconnect();
  const signal = assembler(morceaux, frameChirp, Math.round(RETARD_MAX * fe) + chirp.length);
  const r = intercorreler(signal, chirp);
  await attendre(80); // laisse l'écho s'éteindre avant l'essai suivant
  return signalSuffisant(r) ? r.retard / fe : null;
}

const DUREE_ATTENTE = RETARD_MAX + 0.1;

/** Recolle les morceaux capturés en un seul signal qui commence à l'échantillon `debut` (silence si trou). */
function assembler(morceaux: MorceauCapture[], debut: number, longueur: number): Float32Array {
  const signal = new Float32Array(longueur);
  for (const m of morceaux) {
    const decal = m.debut - debut;
    for (let i = Math.max(0, -decal); i < m.pcm.length && decal + i < longueur; i++) signal[decal + i] = m.pcm[i]!;
  }
  return signal;
}
