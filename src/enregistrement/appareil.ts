// Appareil audio en cours (micro + sortie) : nom pour la mémoire de latence, détection du Bluetooth,
// et écoute des branchements (devicechange) pour proposer un nouveau calibrage.
import { choisirAppareil, latenceMemorisee, signatureAppareil } from './latence';

/** Vrai si un nom d'appareil ressemble à un casque Bluetooth. */
export function ressembleBluetooth(nom: string): boolean {
  return /bluetooth|hands[- ]?free|airpods|\bbt\b/i.test(nom);
}

/** Conseil affiché quand un casque Bluetooth est détecté (on prévient, on ne bloque pas). */
export const CONSEIL_BLUETOOTH =
  'Casque Bluetooth détecté : il ajoute beaucoup de retard. Pour chanter en rythme, un casque filaire est fortement conseillé.';

/** Latence de sortie au-delà de laquelle on considère que c'est du Bluetooth. */
export const SORTIE_TROP_LENTE = 0.15;

async function appareils(): Promise<MediaDeviceInfo[]> {
  try {
    return (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
  } catch {
    return [];
  }
}

/** Noms du micro et de la sortie en cours (vides si le navigateur les cache encore). */
export async function nomsEnCours(pisteMicro?: MediaStreamTrack | null): Promise<{ micro: string; sortie: string }> {
  const liste = await appareils();
  const parDefaut = (genre: MediaDeviceKind) => liste.find((d) => d.kind === genre && d.deviceId === 'default') ?? liste.find((d) => d.kind === genre);
  return {
    micro: pisteMicro?.label || parDefaut('audioinput')?.label || '',
    sortie: parDefaut('audiooutput')?.label || '',
  };
}

/** Met à jour l'appareil en cours ; renvoie true si sa latence est déjà mesurée. */
export async function majAppareil(pisteMicro?: MediaStreamTrack | null): Promise<boolean> {
  const noms = await nomsEnCours(pisteMicro);
  return choisirAppareil(signatureAppareil(noms.micro, noms.sortie));
}

/** Vrai si le micro, la sortie ou la latence de sortie trahissent un casque Bluetooth. */
export async function bluetoothDetecte(ctx: AudioContext, pisteMicro?: MediaStreamTrack | null): Promise<boolean> {
  const noms = await nomsEnCours(pisteMicro);
  return ressembleBluetooth(noms.micro) || ressembleBluetooth(noms.sortie) || (ctx.outputLatency ?? 0) > SORTIE_TROP_LENTE;
}

/**
 * Prévient quand on branche ou débranche un casque. `rappel(aCalibrer)` : aCalibrer = true si le nouvel
 * appareil n'a pas encore de latence mesurée (l'interface propose alors un nouveau calibrage).
 * Renvoie une fonction pour arrêter d'écouter.
 */
export function surChangementAppareil(rappel: (aCalibrer: boolean) => void): () => void {
  const md = navigator.mediaDevices;
  if (!md?.addEventListener) return () => {};
  const quandChange = () => {
    void majAppareil().then(() => rappel(latenceMemorisee() === null));
  };
  md.addEventListener('devicechange', quandChange);
  return () => md.removeEventListener('devicechange', quandChange);
}
