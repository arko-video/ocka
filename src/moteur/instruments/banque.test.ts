// Banque : cache LRU (~48 Mo) des tampons préparés AVANT la lecture. Faux contexte (createBuffer) ; sans Worker
// dans Vitest, l'atelier calcule sur le fil principal (même code que le Worker).
import { describe, expect, it } from 'vitest';
import { compteurs } from '../synthese/atelier';
import { executer } from '../synthese/travaux';
import { Banque, cles, type Demande } from './banque';
import { demandeNote } from './preparation';

class FauxTampon {
  donnees: Float32Array[];
  constructor(readonly numberOfChannels: number, readonly length: number, readonly sampleRate: number) {
    this.donnees = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  copyToChannel(c: Float32Array, i: number) {
    this.donnees[i]!.set(c);
  }
}
const fauxContexte = (sampleRate = 48000) =>
  ({ sampleRate, createBuffer: (n: number, l: number, f: number) => new FauxTampon(n, l, f) }) as unknown as BaseAudioContext;

/** Une demande qui fabrique `secondes` de silence mono (taille connue : secondes × 48000 × 4 octets). */
const demande = (cle: string, secondes: number, priorite = 0): Demande => ({
  cle,
  travail: () => ({ type: 'frequence', canaux: [new Float32Array(Math.round(secondes * 48000))], de: 48000 }),
  priorite,
});

describe('banque de sons', () => {
  it('rien n’est calculé à la lecture : un son pas encore préparé est absent', async () => {
    const b = new Banque(fauxContexte());
    expect(b.lire('n|piano||60')).toBeUndefined();
    await b.preparer([demandeNote('piano', 'trap', 60, 0)]);
    const p = b.lire(cles.note('piano', '', 60))!;
    expect(p).toBeDefined();
    // Même échantillons que le calcul direct (Worker ou fil principal : même code).
    const direct = executer({ type: 'note', son: 'piano', variante: '', midi: 60 }, 48000).canaux[0]!;
    expect((p.buffer as unknown as FauxTampon).donnees[0]).toEqual(direct);
  });

  it('une même demande en cours n’est calculée qu’une fois', async () => {
    const b = new Banque(fauxContexte());
    const avant = compteurs.travaux;
    await Promise.all([b.preparer([demande('a', 0.1)]), b.preparer([demande('a', 0.1)]), b.preparer([demande('a', 0.1)])]);
    expect(compteurs.travaux - avant).toBe(1);
    await b.preparer([demande('a', 0.1)]);
    expect(compteurs.travaux - avant).toBe(1);
  });

  it('LRU : au-delà du plafond, les plus anciens non épinglés partent ; les épinglés restent toujours', async () => {
    const octets = 0.1 * 48000 * 4;
    const b = new Banque(fauxContexte(), 3.5 * octets);
    b.epingler(['a']);
    await b.preparer([demande('a', 0.1), demande('b', 0.1), demande('c', 0.1)]);
    b.lire('b'); // b devient récent : c est maintenant le plus ancien non épinglé
    await b.preparer([demande('d', 0.1)]);
    expect(b.octets).toBeLessThanOrEqual(3.5 * octets);
    expect(['a', 'b', 'c', 'd'].map((k) => b.lire(k) !== undefined)).toEqual([true, true, false, true]);
    // Tout épinglé : le plafond peut être dépassé, mais rien d'utile n'est jeté.
    b.epingler(['b', 'd', 'e', 'f']);
    await b.preparer([demande('e', 0.1), demande('f', 0.1)]);
    expect(['a', 'b', 'd', 'e', 'f'].every((k) => b.lire(k) !== undefined)).toBe(true);
    // Libérés : on revient sous le plafond.
    b.liberer(['a', 'b', 'd', 'e', 'f']);
    expect(b.octets).toBeLessThanOrEqual(3.5 * octets);
  });

  it('priorités : la demande la plus urgente passe devant celles déjà en file', async () => {
    const b = new Banque(fauxContexte());
    const ordre: string[] = [];
    const suivre = (d: Demande) => b.preparer([d]).then(() => ordre.push(d.cle));
    const attentes = [suivre(demande('lent1', 0.01, 10)), suivre(demande('lent2', 0.01, 10)), suivre(demande('urgent', 0.01, -100))];
    await Promise.all(attentes);
    // Le 1er était peut-être déjà parti ; « urgent » passe en tout cas avant « lent2 ».
    expect(ordre.indexOf('urgent')).toBeLessThan(ordre.indexOf('lent2'));
  });
});
