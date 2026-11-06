// Casque : on prévient si un casque Bluetooth semble branché (noms des appareils, une fois le micro autorisé, ou
// latence de sortie trop grande). La règle est celle de l'enregistrement (bluetoothDetecte, par moteur/api.ts).

import { bluetoothDetecte, contexteAudio } from '../../../moteur/api';

/** Latence de sortie (s) du contexte commun (outputLatency, sinon baseLatency), affichée en direct. */
export function latenceSortie(): number {
  try {
    const c = contexteAudio() as AudioContext & { outputLatency?: number };
    return typeof c.outputLatency === 'number' && c.outputLatency > 0
      ? c.outputLatency
      : (c.baseLatency ?? 0);
  } catch {
    return 0;
  }
}

/** true si un casque Bluetooth semble utilisé. Ne lève jamais. */
export async function bluetoothProbable(): Promise<boolean> {
  try {
    return await bluetoothDetecte(contexteAudio());
  } catch {
    return false;
  }
}
