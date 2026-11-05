// Voix de SYNTHÈSE pour les tests de l'autotune (Vitest et QA) : source glottique de Rosenberg (dérivée), 3 formants
// (voyelle « a »), vibrato, souffle léger, et une consonne en bruit filtré (« s ») au début de chaque note.
// Elle chante FAUX : chaque note est décalée de ±30 à ±40 cents. Pseudo-aléatoire fixe : même sortie à chaque appel.

export interface NoteChantee {
  /** Note juste (MIDI) et décalage chanté (cents). */
  midi: number;
  faux: number;
  debut: number;
  duree: number;
}

export interface VoixSynthese {
  pcm: Float32Array;
  notes: NoteChantee[];
}

/** Mélodie en la mineur, d'une voix d'homme grave (la 2) à une voix aiguë (ré 5). */
const MELODIE = [45, 48, 52, 57, 55, 53, 52, 57, 60, 64, 62, 60, 59, 57, 64, 67, 69, 72, 74, 69];
const FORMANTS: [number, number][] = [
  [700, 90],
  [1220, 110],
  [2600, 160],
];

/** Résonateur à 2 pôles (fréquence, largeur de bande) : coefficients [gain, a1, a2]. */
function resonateur(f: number, bw: number, fs: number): [number, number, number] {
  const r = Math.exp((-Math.PI * bw) / fs);
  const a1 = 2 * r * Math.cos((2 * Math.PI * f) / fs);
  const a2 = -r * r;
  return [1 - r, a1, a2];
}

/** `duree` secondes de chant (les notes de MELODIE en boucle, ~0,45 s chacune) à `fs` Hz. */
export function voixSynthese(duree: number, fs = 48000): VoixSynthese {
  const n = Math.round(duree * fs);
  const pcm = new Float32Array(n);
  const notes: NoteChantee[] = [];
  let graine = 12345;
  const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const res = FORMANTS.map(([f, bw]) => resonateur(f, bw, fs));
  const mem = res.map(() => [0, 0]);
  let phase = 0;
  let avant = 0;
  let hp = 0;
  let k = 0;
  for (let t0 = 0; t0 < duree - 0.2; k++) {
    const d = 0.38 + 0.1 * ((k * 7) % 3);
    const faux = (k % 2 ? -1 : 1) * (30 + ((k * 3) % 11));
    notes.push({ midi: MELODIE[k % MELODIE.length]!, faux, debut: t0, duree: Math.min(d, duree - t0) });
    t0 += d;
  }
  for (const note of notes) {
    const a = Math.round(note.debut * fs);
    const b = Math.min(n, Math.round((note.debut + note.duree) * fs));
    const consonne = Math.round(0.05 * fs);
    for (let i = a; i < b; i++) {
      const t = (i - a) / fs;
      // Consonne « s » : bruit passe-haut, au début de la note ; la voyelle entre ensuite en 15 ms.
      const bruit = alea();
      hp = 0.6 * hp + 0.4 * bruit;
      const s = i - a < consonne ? 0.12 * (bruit - hp) : 0;
      const voyelle = Math.min(1, Math.max(0, (i - a - consonne) / (0.015 * fs))) * Math.min(1, (b - i) / (0.02 * fs));
      // Vibrato (5,5 Hz, ±25 cents) qui s'installe après 120 ms.
      const vib = 25 * Math.min(1, Math.max(0, (t - 0.12) / 0.1)) * Math.sin(2 * Math.PI * 5.5 * t);
      const f0 = 440 * Math.pow(2, (note.midi - 69 + (note.faux + vib) / 100) / 12);
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
  }
  // Volume : crête à −6 dBFS.
  let crete = 0;
  for (let i = 0; i < n; i++) crete = Math.max(crete, Math.abs(pcm[i]!));
  if (crete > 0) for (let i = 0; i < n; i++) pcm[i] = (pcm[i]! * 0.5) / crete;
  return { pcm, notes };
}

/** Bruit blanc (sans hauteur), crête −6 dBFS. */
export function bruitBlanc(duree: number, fs = 48000): Float32Array {
  let graine = 777;
  return Float32Array.from({ length: Math.round(duree * fs) }, () => ((graine = (graine * 16807) % 2147483647) / 2147483647 - 0.5));
}
