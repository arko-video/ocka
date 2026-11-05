// Ouverture du micro, sans les « améliorations » du téléphone (écho, bruit, volume auto) qui abîment la voix.
import { ErreurOcka } from '../moteur/api';
import { verifierReglages } from './reglages-micro';

export interface Micro {
  flux: MediaStream;
  piste: MediaStreamTrack;
  /** Réglages que le téléphone n'a pas respectés, en français (à afficher). */
  avertissements: string[];
}

/** Demande le micro (geste de l'utilisateur requis). Lève ErreurOcka « micro_refuse » ou « micro_absent ». */
export async function ouvrirMicro(): Promise<Micro> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ErreurOcka("Ce navigateur ne donne pas accès au micro. Ouvre OCKA dans Chrome.", 'micro_absent');
  }
  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    const nom = (e as { name?: string }).name;
    if (nom === 'NotAllowedError' || nom === 'SecurityError') {
      throw new ErreurOcka("OCKA n'a pas le droit d'utiliser le micro. Autorise-le dans les réglages du site (icône à gauche de l'adresse).", 'micro_refuse');
    }
    if (nom === 'NotReadableError') {
      throw new ErreurOcka('Le micro est déjà utilisé par une autre appli. Ferme-la puis réessaie.', 'micro_absent');
    }
    throw new ErreurOcka('Aucun micro trouvé sur cet appareil.', 'micro_absent');
  }
  const piste = flux.getAudioTracks()[0];
  if (!piste) throw new ErreurOcka('Aucun micro trouvé sur cet appareil.', 'micro_absent');
  return { flux, piste, avertissements: verifierReglages(piste.getSettings()) };
}

/** Coupe le micro (le voyant du téléphone s'éteint). */
export function fermerMicro(micro: Micro | null): void {
  micro?.flux.getTracks().forEach((p) => p.stop());
}
