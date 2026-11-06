// Voix de SYNTHÈSE chantée LIÉE (legato) pour les tests de l'autotune avancé : comme voix-synthese.ts (source de
// Rosenberg, 3 formants de « a », vibrato, souffle), mais les notes s'enchaînent sans consonne ni silence, avec un
// glissé de 30 ms : une seule région voisée, découpée en notes par les sauts de hauteur. Une consonne « s » au début.

export interface NoteLiee {
  /** Note juste (MIDI), décalage chanté (cents) et durée (s). */
  midi: number;
  faux: number;
  duree: number;
}

const FORMANTS: [number, number][] = [
  [700, 90],
  [1220, 110],
  [2600, 160],
];

/** PCM à `fs` Hz : 0,1 s de consonne, puis les notes liées ; `vibrato` en cents (± autour de la note). */
export function voixLiee(notes: NoteLiee[], fs = 48000, vibrato = 25): { pcm: Float32Array; debuts: number[] } {
  const consonne = 0.1;
  const total = consonne + notes.reduce((s, n) => s + n.duree, 0) + 0.05;
  const n = Math.round(total * fs);
  const pcm = new Float32Array(n);
  const debuts: number[] = [];
  let t = consonne;
  for (const note of notes) {
    debuts.push(t);
    t += note.duree;
  }
  const hauteur = (temps: number) => {
    let k = 0;
    while (k + 1 < notes.length && debuts[k + 1]! <= temps) k++;
    const c = notes[k]!.midi * 100 + notes[k]!.faux;
    const dt = temps - debuts[k]!;
    if (k > 0 && dt < 0.03) {
      const p = notes[k - 1]!.midi * 100 + notes[k - 1]!.faux;
      return p + ((c - p) * dt) / 0.03;
    }
    return c + vibrato * Math.min(1, Math.max(0, (dt - 0.12) / 0.1)) * Math.sin(2 * Math.PI * 5.5 * dt);
  };
  const res = FORMANTS.map(([f, bw]) => {
    const r = Math.exp((-Math.PI * bw) / fs);
    return [1 - r, 2 * r * Math.cos((2 * Math.PI * f) / fs), -r * r] as const;
  });
  const mem = res.map(() => [0, 0]);
  let graine = 4242;
  const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let phase = 0;
  let avant = 0;
  let hp = 0;
  const fin = consonne + notes.reduce((s, x) => s + x.duree, 0);
  for (let i = 0; i < n; i++) {
    const temps = i / fs;
    const bruit = alea();
    hp = 0.6 * hp + 0.4 * bruit;
    const s = temps < consonne * 0.6 ? 0.12 * (bruit - hp) : 0;
    const voyelle = Math.min(1, Math.max(0, (temps - consonne) / 0.015)) * Math.min(1, Math.max(0, (fin - temps) / 0.02));
    const f0 = 440 * Math.pow(2, (hauteur(Math.max(consonne, temps)) - 6900) / 1200);
    phase = (phase + f0 / fs) % 1;
    const g = phase < 0.4 ? 0.5 * (1 - Math.cos((Math.PI * phase) / 0.4)) : phase < 0.56 ? Math.cos((Math.PI * (phase - 0.4)) / 0.32) : 0;
    const e = (g - avant) * voyelle;
    avant = g;
    let v = 0;
    res.forEach(([gain, a1, a2], j) => {
      const m = mem[j]!;
      const y = gain * e + a1 * m[0]! + a2 * m[1]!;
      m[1] = m[0]!;
      m[0] = y;
      v += y;
    });
    pcm[i] = 0.9 * v + s + 0.003 * bruit * voyelle;
  }
  let crete = 0;
  for (let i = 0; i < n; i++) crete = Math.max(crete, Math.abs(pcm[i]!));
  if (crete > 0) for (let i = 0; i < n; i++) pcm[i] = (pcm[i]! * 0.5) / crete;
  return { pcm, debuts };
}
