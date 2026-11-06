import { afterEach, describe, expect, it, vi } from 'vitest';
import { motifNotesDe } from '../morceau/acces';
import { normaliserMorceau } from '../morceau/normaliser';
import { dureePas } from '../morceau/temps';
import type { Lecteur } from '../moteur/api';
import { ErreurOcka } from '../moteur/erreur';
import { exempleMorceau } from '../ui/edition/exemple';
import { ajouterPiste } from '../ui/edition/pistes';
import { lireMessage } from './messages-midi';
import { enregistrerMidi, jouerMidiDirect, listerAppareilsMidi, oublierAcces } from './web-midi';

/** Faux clavier Web MIDI : envoie des messages comme un vrai MIDIInput. */
class FauxClavier {
  private ecouteurs = new Set<(e: Event) => void>();
  constructor(
    public id: string,
    public name: string,
    public manufacturer = 'Faux',
  ) {}
  addEventListener(_t: string, f: (e: Event) => void) {
    this.ecouteurs.add(f);
  }
  removeEventListener(_t: string, f: (e: Event) => void) {
    this.ecouteurs.delete(f);
  }
  envoyer(...octets: number[]) {
    const e = { data: new Uint8Array(octets), timeStamp: performance.now() } as unknown as Event;
    for (const f of this.ecouteurs) f(e);
  }
  get branche() {
    return this.ecouteurs.size;
  }
}

function injecter(claviers: FauxClavier[], refuser = false) {
  const acces = { inputs: new Map(claviers.map((c) => [c.id, c])), onstatechange: null };
  const demande = vi.fn(() => (refuser ? Promise.reject(new Error('SecurityError')) : Promise.resolve(acces)));
  vi.stubGlobal('navigator', { requestMIDIAccess: demande });
  return { acces, demande };
}

function fauxLecteur() {
  const ctx = { currentTime: 0 };
  const l = {
    entendreNote: vi.fn(),
    relacherNote: vi.fn(),
    boucler: vi.fn(),
    aller: vi.fn(),
    lire: vi.fn(),
    pause: vi.fn(),
    latenceSortie: 0.05,
    temps: 0,
    ctx,
    heureDe: (t: number) => 10 + t,
  };
  return { l, lecteur: l as unknown as Lecteur, ctx };
}

afterEach(() => {
  vi.unstubAllGlobals();
  oublierAcces();
});

describe('Web MIDI (faux navigator.requestMIDIAccess)', () => {
  it('sans Web MIDI ou accès refusé : ErreurOcka « midi_indisponible » avec un message clair', async () => {
    vi.stubGlobal('navigator', {});
    await expect(listerAppareilsMidi()).rejects.toMatchObject({ code: 'midi_indisponible' });
    injecter([], true);
    const e = await listerAppareilsMidi().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurOcka);
    expect((e as ErreurOcka).message).toMatch(/refusé/);
  });
  it('liste les claviers ; l’accès n’est demandé qu’une fois', async () => {
    const { demande } = injecter([new FauxClavier('k1', 'Arturia MiniLab'), new FauxClavier('k2', '')]);
    expect(await listerAppareilsMidi()).toEqual([
      { id: 'k1', nom: 'Arturia MiniLab', fabricant: 'Faux' },
      { id: 'k2', nom: 'Clavier MIDI', fabricant: 'Faux' },
    ]);
    await listerAppareilsMidi();
    expect(demande).toHaveBeenCalledTimes(1);
  });
  it('jeu en direct : entendreNote (tenue) sur la piste avec la vélocité, relâchée au note-off ; l’appareil choisi seulement ; arrêt', async () => {
    const k1 = new FauxClavier('k1', 'A');
    const k2 = new FauxClavier('k2', 'B');
    injecter([k1, k2]);
    const { l, lecteur } = fauxLecteur();
    const arreter = await jouerMidiDirect(lecteur, { piste: 'lead', appareil: 'k1' });
    k1.envoyer(0x90, 60, 127);
    k1.envoyer(0x91, 64, 32); // autre canal : joué aussi
    k1.envoyer(0x80, 60, 0);
    k1.envoyer(0xb0, 64, 127); // pédale : ignorée
    k1.envoyer(0x90, 5, 100); // hors des bornes d'OCKA
    k2.envoyer(0x90, 62, 100); // pas l'appareil choisi
    expect(l.entendreNote.mock.calls).toEqual([
      ['lead', 60, { vel: 1, tenue: true }],
      ['lead', 64, { vel: 32 / 127, tenue: true }],
    ]);
    expect(l.relacherNote.mock.calls).toEqual([['lead', 60]]); // note-off : la note tenue est relâchée
    arreter();
    expect(k1.branche).toBe(0);
    k1.envoyer(0x90, 60, 100);
    expect(l.entendreNote).toHaveBeenCalledTimes(2);
  });
  it('enregistrement : boucle sur la section, latence retirée, durée par le relâchement, notes dans le motif', async () => {
    const k = new FauxClavier('k', 'K');
    injecter([k]);
    const r = ajouterPiste(normaliserMorceau(exempleMorceau()).morceau, 'ocka-piano@1')!;
    const { l, lecteur, ctx } = fauxLecteur();
    const d = dureePas(r.m.tempo);
    const rec = await enregistrerMidi(lecteur, r.m, { piste: r.id, section: 'intro' });
    expect(l.boucler).toHaveBeenCalledWith('intro');
    expect(l.lire).toHaveBeenCalled();
    // Entendue au pas 2 (heure 10 + 2 d + latence), relâchée 1,5 pas plus tard.
    ctx.currentTime = 10 + 2 * d + 0.05;
    k.envoyer(0x90, 67, 100);
    ctx.currentTime += 1.5 * d;
    k.envoyer(0x80, 67, 0);
    // Un peu en retard sur le pas 5 (0,2 pas) : gardé tel quel (le panneau quantifie ensuite).
    ctx.currentTime = 10 + 5.2 * d + 0.05;
    k.envoyer(0x90, 70, 64);
    ctx.currentTime += d;
    k.envoyer(0x90, 70, 0);
    // Deuxième tour de la section (4 mesures = 64 pas) : retombe au pas 8.
    ctx.currentTime = 10 + (64 + 8) * d + 0.05;
    k.envoyer(0x90, 72, 127);
    ctx.currentTime += d; // la dernière, jamais relâchée, finit à l'arrêt
    expect(rec.notes).toBe(3);
    const m = await rec.arreter();
    expect(l.pause).toHaveBeenCalled();
    const notes = motifNotesDe(m, 'intro', r.id)!.notes;
    expect(notes.map((n) => [n.pas, n.midi, n.duree])).toEqual([
      [2, 67, 1.5],
      [5.208333333333333, 70, 1],
      [8, 72, 1],
    ]);
    expect(notes[1]!.vel).toBeCloseTo(64 / 127);
    expect(normaliserMorceau(JSON.parse(JSON.stringify(m))).problemes).toEqual([]);
  });
  it('messages mal formés ignorés', () => {
    expect(lireMessage({ data: new Uint8Array([0x90]) })).toBeNull();
    expect(lireMessage({})).toBeNull();
    expect(lireMessage({ data: new Uint8Array([0x90, 60, 0]), timeStamp: 3 })).toMatchObject({ type: 'off', midi: 60 });
  });
});
