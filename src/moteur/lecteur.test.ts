// Tests du lecteur avec des doublures : faux contexte audio (horloge réglable), faux graphe (qui note les appels),
// fausse minuterie et faux Wake Lock. On vérifie la boucle de section, le Wake Lock, le cache des prises et des sons,
// le passage de relais pendant la lecture (après la préparation complète), les notes, la latence et l'A/B.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nouveauMorceau } from '../morceau/styles';
import { dureeMorceau } from '../morceau/temps';
import type { Morceau, Prise, SonImporte } from '../morceau/types';

const horloge = { currentTime: 0 };
interface Appels {
  planifier: [number, number, number][];
  reprises: [number, number, boolean, boolean][];
  arreter: number;
  annulerFondu: number;
  fondus: number[];
  relais: number[];
  notes: [string, number][];
  comparer: [boolean, number][];
  detruits: number;
  bus: number;
}
const appels: Appels = { planifier: [], reprises: [], arreter: 0, annulerFondu: 0, fondus: [], relais: [], notes: [], comparer: [], detruits: 0, bus: 0 };
const lectures: string[] = [];
const sonsLus: string[] = [];
/** Préparation complète des prochains graphes (null = tout de suite). */
let pretManuel: Promise<void> | null = null;

const fauxContexte = { get currentTime() { return horloge.currentTime; }, resume: async () => {}, state: 'running', baseLatency: 0.01, outputLatency: 0 as number | undefined };
vi.mock('../enregistrement/contexte', () => ({ contexteAudio: () => fauxContexte }));
vi.mock('../enregistrement/prises', () => ({
  lirePrise: async (p: Prise) => {
    lectures.push(p.fichier);
    return { frequence: 48000, pcm: new Float32Array(10) };
  },
}));
vi.mock('../sons/import', () => ({
  lireSon: async (s: SonImporte) => {
    sonsLus.push(s.fichier);
    return { frequence: 48000, canaux: [new Float32Array(10)] };
  },
}));
vi.mock('./instruments/bus', () => ({ detruireBus: () => appels.bus++ }));
vi.mock('./graphe', () => ({
  preparerGraphe: async (_ctx: unknown, m: Morceau) => ({
    duree: dureeMorceau(m),
    latence: 0,
    debut: Promise.resolve(),
    pret: pretManuel ?? Promise.resolve(),
    sautees: 0,
    planifier: (de: number, a: number, origine: number, reprise = false, relais = false) => {
      appels.planifier.push([de, a, origine]);
      if (reprise) appels.reprises.push([de, origine, reprise, relais]);
    },
    programmerFondu: (o: number) => appels.fondus.push(o),
    annulerFondu: () => appels.annulerFondu++,
    entendre: () => {},
    entendreNote: (son: string, midi: number) => appels.notes.push([son, midi]),
    comparer: (sans: boolean, c: number) => appels.comparer.push([sans, c]),
    relayer: async (quand: number) => void appels.relais.push(quand),
    arreter: () => appels.arreter++,
    detruire: () => appels.detruits++,
  }),
}));

let tic: () => void = () => {};
let liberes = 0;
let donnerVerrou: (v: { release(): Promise<void> }) => void = () => {};
vi.stubGlobal('Worker', class {
  set onmessage(f: () => void) { tic = f; }
  postMessage() {}
  terminate() {}
});
vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
vi.stubGlobal('navigator', { wakeLock: { request: () => new Promise((ok) => (donnerVerrou = ok)) } });

const { creerLecteur } = await import('./lecteur');

/** Avance l'horloge audio par pas de 25 ms, comme la minuterie. */
function avancer(secondes: number) {
  for (let t = 0; t < secondes; t += 0.025) {
    horloge.currentTime += 0.025;
    tic();
  }
}

beforeEach(() => {
  horloge.currentTime = 10;
  Object.assign(appels, { planifier: [], reprises: [], arreter: 0, annulerFondu: 0, fondus: [], relais: [], notes: [], comparer: [], detruits: 0, bus: 0 });
  lectures.length = 0;
  sonsLus.length = 0;
  liberes = 0;
  pretManuel = null;
  fauxContexte.outputLatency = 0;
});

describe('lecteur : boucle de section pendant la lecture', () => {
  it('tête de lecture après la section : saut propre au début, aucun son en retard', async () => {
    const l = creerLecteur();
    await l.charger(nouveauMorceau('trap'));
    l.aller(20); // dans le couplet
    l.lire();
    avancer(1);
    appels.planifier = [];
    l.boucler('intro');
    expect(appels.arreter).toBe(1);
    expect(l.temps).toBeLessThan(0.1);
    avancer(8); // plus d'un tour de l'intro (6,86 s)
    for (const [de, , origine] of appels.planifier.slice(1)) expect(origine + de).toBeGreaterThanOrEqual(horloge.currentTime - 8.05);
    // Chaque fenêtre planifiée commence dans le futur au moment où elle est planifiée : rien ne part en retard.
    const intro = (4 * 16 * 60) / 140 / 4;
    expect(Math.max(...appels.planifier.map(([, a]) => a))).toBeLessThanOrEqual(intro + 1e-9);
    expect(l.temps).toBeGreaterThan(0);
    expect(l.temps).toBeLessThan(intro);
    l.detruire();
  });

  it('tête de lecture dans la section : pas de coupure, le fondu du morceau est retiré', async () => {
    const l = creerLecteur();
    await l.charger(nouveauMorceau('trap'));
    l.aller(2);
    l.lire();
    avancer(0.5);
    const avant = l.temps;
    l.boucler('intro');
    expect(appels.arreter).toBe(0);
    expect(appels.annulerFondu).toBe(1);
    expect(l.temps).toBeCloseTo(avant, 5);
    l.boucler(null);
    expect(appels.fondus.length).toBeGreaterThan(1); // fondu remis pour le morceau entier
    l.detruire();
  });

  it('planification en retard impossible : chaque fenêtre est dans le futur', async () => {
    const l = creerLecteur();
    await l.charger(nouveauMorceau('trap'));
    l.aller(30);
    l.lire();
    avancer(0.3);
    l.boucler('intro');
    const debutSaut = horloge.currentTime;
    appels.planifier = [];
    avancer(0.5);
    // Le 1er son replanifié tombe au plus tôt maintenant (pas de salve de sons passés).
    const premier = Math.min(...appels.planifier.map(([de, , o]) => o + de));
    expect(premier).toBeGreaterThanOrEqual(debutSaut);
    l.detruire();
  });
});

describe('lecteur : Wake Lock et cache des prises', () => {
  it('pause avant la réponse de request() : le verrou est relâché dès son arrivée', async () => {
    const l = creerLecteur();
    await l.charger(nouveauMorceau('lofi'));
    l.lire();
    l.pause();
    donnerVerrou({ release: async () => void liberes++ });
    await new Promise((r) => setTimeout(r, 0));
    expect(liberes).toBe(1);
    l.detruire();
  });

  it('le cache oublie une prise retirée du morceau', async () => {
    const l = creerLecteur();
    const m = nouveauMorceau('trap');
    const prise: Prise = { id: 'p', ancre: { section: 'couplet', occurrence: 0, mesure: 0 }, tempo: 140, fichier: 'a.f32', frequence: 48000, duree: 1, debutCoupe: 0, finCoupe: 1, decalage: 0, gain: 1, choisie: true };
    await l.charger({ ...m, prises: [prise] });
    await l.charger({ ...m, prises: [prise] });
    expect(lectures).toEqual(['a.f32']); // gardée en cache
    await l.charger({ ...m, prises: [] });
    await l.charger({ ...m, prises: [prise] });
    expect(lectures).toEqual(['a.f32', 'a.f32']); // purgée puis relue
    l.detruire();
  });
});

describe('lecteur : rechargement pendant la lecture (relais)', () => {
  it('le nouveau graphe ne prend le relais qu’une fois TOUS ses sons prêts, puis reprend les sons tenus', async () => {
    const l = creerLecteur();
    const m = nouveauMorceau('trap');
    await l.charger(m);
    l.lire();
    avancer(1);
    let finir: () => void = () => {};
    pretManuel = new Promise<void>((ok) => (finir = ok));
    const charge = l.charger({ ...m, tempo: 140 });
    await new Promise((r) => setTimeout(r, 0));
    avancer(0.2);
    expect(appels.relais).toEqual([]); // sons pas encore tous prêts : l'ancien graphe continue seul
    finir();
    await charge;
    expect(appels.relais).toHaveLength(1);
    // Relais dans le futur, au bout de ce qui est déjà planifié ; le nouveau graphe reprend à la même heure.
    expect(appels.relais[0]!).toBeGreaterThan(horloge.currentTime);
    const [de, origine, reprise, relais] = appels.reprises.at(-1)!;
    expect(reprise && relais).toBe(true);
    expect(origine + de).toBeCloseTo(appels.relais[0]!, 9);
    l.detruire();
  });

  it('à l’arrêt : pas de relais, l’ancien graphe est détruit ; detruire() débranche le bus master', async () => {
    const l = creerLecteur();
    await l.charger(nouveauMorceau('lofi'));
    await l.charger(nouveauMorceau('lofi'));
    expect(appels.relais).toEqual([]);
    expect(appels.detruits).toBe(1);
    l.detruire();
    expect(appels.detruits).toBe(2);
    expect(appels.bus).toBe(1);
  });
});

describe('lecteur : notes, latence, A/B et sons importés', () => {
  it('entendreNote passe au graphe ; comparer aussi (compensation 0 par défaut)', async () => {
    const l = creerLecteur();
    await l.charger(nouveauMorceau('trap'));
    l.entendreNote('pluck', 72);
    l.comparer(true, -1.5);
    l.comparer(false);
    expect(appels.notes).toEqual([['pluck', 72]]);
    expect(appels.comparer).toEqual([[true, -1.5], [false, 0]]);
    l.detruire();
  });

  it('latenceSortie : outputLatency si le navigateur la donne, sinon baseLatency', () => {
    const l = creerLecteur();
    expect(l.latenceSortie).toBe(0.01);
    fauxContexte.outputLatency = 0.045;
    expect(l.latenceSortie).toBe(0.045);
    l.detruire();
  });

  it('les sons des pads et des boucles sont lus une fois, puis oubliés quand plus rien ne les utilise', async () => {
    const l = creerLecteur();
    const m = nouveauMorceau('trap');
    const son: SonImporte = { id: 's1', nom: 'Mon son', fichier: 'son-a.f32', frequence: 48000, duree: 1, canaux: 1 };
    const avec: Morceau = { ...m, sons: [son], pads: { perso1: 's1' } };
    await l.charger(avec);
    await l.charger(avec);
    expect(sonsLus).toEqual(['son-a.f32']);
    await l.charger({ ...avec, pads: {} });
    await l.charger(avec);
    expect(sonsLus).toEqual(['son-a.f32', 'son-a.f32']);
    l.detruire();
  });
});
