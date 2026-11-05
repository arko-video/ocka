// Minuterie du planificateur, dans un Worker : un setInterval de page est ralenti quand l'onglet passe
// en arrière-plan, celui d'un Worker beaucoup moins. Il envoie « tic » toutes les 25 ms pendant la lecture.

let minuterie: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<'demarrer' | 'arreter'>) => {
  if (minuterie !== null) clearInterval(minuterie);
  minuterie = null;
  if (e.data === 'demarrer') minuterie = setInterval(() => self.postMessage('tic'), 25);
};
