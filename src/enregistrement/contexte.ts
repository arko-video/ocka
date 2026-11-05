// Le contexte audio COMMUN : le lecteur, la capture et le calibrage doivent tous utiliser le même,
// pour partager la même horloge (ctx.currentTime ↔ currentFrame dans le worklet).
// Le lecteur crée son contexte avec contexteAudio() (voir api.ts) ; l'enregistreur prend lecteur.ctx s'il existe.

let commun: AudioContext | null = null;

/** Donne le contexte audio commun d'OCKA (créé au premier appel, ou recréé s'il a été fermé). */
export function contexteAudio(): AudioContext {
  if (!commun || commun.state === 'closed') commun = new AudioContext({ latencyHint: 'interactive' });
  return commun;
}

/** Petite pause (en millisecondes). */
export function attendre(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, Math.max(0, ms)));
}

/** Identifiant court et unique (pour les prises et les morceaux). */
export function nouvelId(): string {
  const hasard = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `${Date.now().toString(36)}${hasard}`;
}
