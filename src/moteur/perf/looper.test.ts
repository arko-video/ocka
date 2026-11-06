// Looper (R) : grille, lancement À LA MESURE (morceau chargé = changement pile sur la barre), « Enregistrer ce que je
// joue » → sections identiques à ce qui a été joué, en un seul changement du morceau, accepté par le normaliseur.
import { describe, expect, it } from 'vitest';
import { normaliserMorceau } from '../../morceau/normaliser';
import { nouveauMorceau } from '../../morceau/styles';
import { arrangement, pasVersSecondes } from '../../morceau/temps';
import type { Morceau } from '../../morceau/types';
import type { Lecteur } from '../api';
import { creerLooper, grilleLooper, journalVersMorceau } from '../looper';

/** Un lecteur factice : on avance le temps à la main, il garde les morceaux chargés. */
function faux() {
  const charges: Morceau[] = [];
  let cb: (() => void) | null = null;
  const l = {
    temps: 0,
    enLecture: false,
    async charger(m: Morceau) {
      charges.push(m);
    },
    lire() {
      l.enLecture = true;
    },
    pause() {
      l.enLecture = false;
    },
    aller(t: number) {
      l.temps = t;
    },
    boucler() {},
    surChangement(f: () => void) {
      cb = f;
      return () => (cb = null);
    },
  };
  const avancer = (t: number) => ((l.temps = t), cb?.());
  return { lecteur: l as unknown as Lecteur & typeof l, charges, avancer };
}

/** Motif joué par `piste` à la mesure `k` dans un morceau linéaire. */
function motifA(m: Morceau, piste: string, k: number): string | null {
  const o = arrangement(m).find((x) => x.debutPas <= k * 16 && k * 16 < x.debutPas + x.pas);
  return o?.section.motifs[piste] ?? null;
}

describe('looper', () => {
  const m = nouveauMorceau('trap', 'Looper');
  const grille = grilleLooper(m);

  it('grille : chaque piste qui joue un motif (ni sons ni voix), motifs sans doublon', () => {
    expect(grille.length).toBeGreaterThan(3);
    expect(grille.some((c) => c.piste === 'voix' || c.piste === 'sons')).toBe(false);
    const cles = grille.map((c) => `${c.piste}/${c.motif}`);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of grille) expect(m.motifs[c.motif!]).toBeTruthy();
  });

  it('un lancement part à la PROCHAINE mesure (barre suivante si trop près), un seul par piste, Stop par piste', async () => {
    const { lecteur, charges, avancer } = faux();
    const lp = creerLooper(lecteur, m);
    const batterie = grille.filter((c) => c.piste === 'batterie');
    const basse = grille.find((c) => c.piste === 'basse')!;
    lp.lancer(batterie[0]!); // à l'arrêt : tout de suite
    await lp.demarrer();
    expect(lp.actifs.batterie).toBe(batterie[0]!.motif);
    const mesure = pasVersSecondes(m, 16);
    avancer(1.2 * mesure); // dans la 2e mesure (k = 1)
    lp.lancer(basse);
    expect(lp.enAttente).toEqual([basse]);
    expect(lp.actifs.basse ?? null).toBe(null);
    const charge = charges[charges.length - 1]!;
    expect(motifA(charge, 'basse', 1)).toBe(null);
    expect(motifA(charge, 'basse', 2)).toBe(basse.motif);
    expect(motifA(charge, 'batterie', 1)).toBe(batterie[0]!.motif);
    avancer(1.99 * mesure);
    expect(lp.actifs.basse ?? null).toBe(null);
    avancer(2.01 * mesure);
    expect(lp.actifs.basse).toBe(basse.motif);
    expect(lp.enAttente).toEqual([]);
    // Trop près de la barre : la suivante.
    avancer(3 * mesure - 0.1);
    lp.lancer({ piste: 'basse', motif: null });
    const c2 = charges[charges.length - 1]!;
    expect(motifA(c2, 'basse', 3)).toBe(basse.motif);
    expect(motifA(c2, 'basse', 4)).toBe(null);
    lp.detruire();
  });

  it('« Enregistrer ce que je joue » : les sections ajoutées rejouent exactement les mesures jouées (un seul changement)', async () => {
    const { lecteur, charges, avancer } = faux();
    const lp = creerLooper(lecteur, m);
    const [b1, b2] = [grille.find((c) => c.piste === 'batterie')!, grille.find((c) => c.piste === 'basse')!];
    lp.lancer(b1);
    await lp.demarrer();
    const d = pasVersSecondes(m, 16);
    avancer(0.5 * d);
    lp.enregistrer(true); // à partir de la mesure 1
    avancer(1.5 * d);
    lp.lancer(b2); // mesure 2
    for (let k = 2; k < 21; k++) avancer((k + 0.5) * d);
    lp.lancer({ piste: 'batterie', motif: null }); // mesure 21
    avancer(21.5 * d);
    lp.enregistrer(false); // fin à la mesure 22
    const joue = charges[charges.length - 1]!;
    const avant = m;
    const apres = journalVersMorceau(avant, lp.journal);
    expect(apres).not.toBe(avant);
    expect(apres.sections.slice(0, avant.sections.length)).toEqual(avant.sections);
    const ajout = arrangement(apres).filter((o) => o.index >= avant.ordre.length);
    const total = ajout.reduce((n, o) => n + o.pas, 0) / 16;
    expect(total).toBe(21); // mesures 1 à 21
    expect(ajout.every((o) => o.section.mesures <= 16)).toBe(true);
    // Mesure par mesure : même motif par piste que ce que le looper a fait jouer.
    let k = 1;
    for (const o of ajout)
      for (let j = 0; j < o.section.mesures; j++, k++)
        for (const piste of ['batterie', 'basse'])
          expect(o.section.motifs[piste] ?? null, `${piste} mesure ${k}`).toBe(motifA(joue, piste, k));
    // Les sections repartent à leur début aux mêmes mesures que dans le looper.
    const debutsJoue = arrangement(joue)
      .map((o) => o.debutPas / 16)
      .filter((x) => x >= 1 && x < 22);
    expect(
      ajout.map((o) => o.debutPas / 16 - arrangement(avant).reduce((n, x) => n + x.pas, 0) / 16 + 1),
    ).toEqual(debutsJoue);
    const n = normaliserMorceau(JSON.parse(JSON.stringify(apres)));
    expect(n.problemes).toEqual([]);
    lp.detruire();
  });

  it('journal vide ou que du silence : morceau inchangé', () => {
    expect(journalVersMorceau(m, [])).toBe(m);
    expect(journalVersMorceau(m, [{ mesure: 0, piste: 'basse', motif: null }])).toBe(m);
  });
});
