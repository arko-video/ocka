// « ocka-logdrum@1 » : log drum de l'amapiano (L) : un tambour grave et boisé qui CHANTE la ligne de basse. Sinus
// qui tombe vite de quelques demi-tons sur la note (le « wom »), une harmonique 2 qui part plus vite, un « toc »
// filtré à l'attaque et une saturation qui le fait ressortir sur un téléphone.
import { frequenceMidi } from '../../../morceau/theorie';
import type { DefinitionSynthe } from '../../api-synthes';
import { bruit, FREQ } from '../briques';
import { aLaSonie, fonduFin } from '../outils-notes';
import { courbeFrequence, entre, formant, nb, saturerDoux } from './communs';

export function rendreLogDrum(midi: number, p: Record<string, number>): Float32Array {
  const duree = entre(0.25, 1.4, p.longueur ?? 0.45);
  const n = nb(duree + 0.05);
  const f = frequenceMidi(midi);
  const freq = courbeFrequence(n, f, { glisseCents: 100 + 900 * (p.chute ?? 0.4), tauGlisse: 0.018 });
  const c = new Float32Array(n);
  const tau = duree * 0.35;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    ph += freq[i]! / FREQ;
    const a = Math.exp(-t / tau);
    c[i] = a * (Math.sin(2 * Math.PI * ph) + 0.35 * Math.exp(-t / (tau * 0.4)) * Math.sin(4 * Math.PI * ph));
  }
  const toc = bruit(0.03, 0x10cd + midi);
  formant(toc, c, 1400, 500, 6 * (p.toc ?? 0.5));
  saturerDoux(c, 0.15 + 0.6 * (p.saturation ?? 0.35));
  const e = Math.round(0.001 * FREQ);
  for (let i = 0; i < e; i++) c[i] *= i / e;
  return c;
}

const def: DefinitionSynthe = {
  id: 'logdrum',
  nom: 'Log drum',
  famille: 'Percussions mélodiques',
  motsCles: ['log drum', 'logdrum', 'amapiano', 'afro', 'basse', 'tambour'],
  pret: true,
  params: {
    chute: { defaut: 0.4 },
    longueur: { defaut: 0.45 },
    toc: { defaut: 0.5 },
    saturation: { defaut: 0.35 },
  },
  relache: 0.06,
  tenu: false,
  mode: 'note',
  rendreNote(midi, r) {
    const c = [rendreLogDrum(midi, r.params)];
    aLaSonie(c, 1);
    fonduFin(c, 0.05);
    return { canaux: c };
  },
};
export default def;
