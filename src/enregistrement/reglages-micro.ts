// Vérification (pure) des réglages réellement appliqués au micro : track.getSettings().
// Si le téléphone a gardé un traitement, on le dit en français (on ne bloque pas).

export function verifierReglages(r: MediaTrackSettings): string[] {
  const avertissements: string[] = [];
  if (r.echoCancellation === true) {
    avertissements.push("L'annulation d'écho du téléphone est restée active : ta voix peut sonner métallique.");
  }
  if (r.noiseSuppression === true) {
    avertissements.push('La réduction de bruit du téléphone est restée active : ta voix peut sonner étouffée.');
  }
  if (r.autoGainControl === true) {
    avertissements.push('Le volume automatique du téléphone est resté actif : le niveau de ta voix peut changer tout seul.');
  }
  return avertissements;
}
