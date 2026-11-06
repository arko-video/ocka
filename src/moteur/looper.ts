// Looper façon BandLab (R) : une grille pistes × motifs qu'on lance en direct, calée sur la mesure, puis
// « Enregistrer ce que je joue » écrit des sections dans l'arrangement. Passe par le Lecteur public (charger,
// boucler, lire) : aucun changement du moteur.
// Principe : le looper charge dans le lecteur un morceau LINÉAIRE fait de ses tours (perf/sections-direct.ts). Un
// lancement change le morceau à partir de la mesure visée ; tout ce qui précède est identique, donc le relais du
// lecteur (sans coupure) est inaudible et le changement tombe pile sur la barre de mesure. L'arrangement écrit à la
// fin est fait des MÊMES sections : ce qu'on enregistre est ce qu'on a entendu.

import { idMotifDe } from '../morceau/acces';
import { arrangement, pasVersSecondes, secondesVersPas } from '../morceau/temps';
import type { Morceau } from '../morceau/types';
import type { Lecteur } from './api';
import type { CelluleLooper, LancementLooper, Looper } from './api-performance';
import { ErreurOcka } from './erreur';
// prettier-ignore
import { appliquer, cleActifs, decouper, idSectionLibre, nomSectionLibre, toursDuJournal, type Actifs, type Tour } from './perf/sections-direct';

/** Pistes du looper : toutes sauf les sons importés et la voix (elles ne jouent pas de motif). */
const pisteJouable = (id: string) => id !== 'sons' && id !== 'voix';

/** La grille pistes × motifs : les motifs déjà utilisés par chaque piste, dans l'ordre des sections. Pur. */
export function grilleLooper(m: Morceau): CelluleLooper[] {
  const sections = [...arrangement(m).map((o) => o.section), ...m.sections];
  const out: CelluleLooper[] = [];
  for (const p of m.pistes) {
    if (!pisteJouable(p.id)) continue;
    const vus = new Set<string>();
    for (const s of sections) {
      const id = idMotifDe(s, p.id);
      if (id && m.motifs[id] && !vus.has(id)) (vus.add(id), out.push({ piste: p.id, motif: id }));
    }
  }
  return out;
}

/** « Enregistrer ce que je joue » : le journal devient des sections ajoutées à la fin de l'arrangement. Pur. */
export function journalVersMorceau(m: Morceau, journal: readonly LancementLooper[]): Morceau {
  const valides = journal.filter(
    (l) => m.pistes.some((p) => p.id === l.piste) && (l.motif === null || !!m.motifs[l.motif]),
  );
  if (valides.length === 0) return m;
  const fin = Math.max(...valides.map((l) => l.mesure));
  const tours = toursDuJournal(valides);
  const premier = tours.findIndex((t) => Object.values(t.actifs).some(Boolean));
  if (premier < 0) return m;
  const d = decouper(
    m,
    tours.slice(premier),
    fin,
    (i) => nomSectionLibre(m, i),
    (_cle, i) => idSectionLibre(m, i),
  );
  if (d.ordre.length === 0) return m;
  if (m.sections.length + d.sections.length > 64 || m.ordre.length + d.ordre.length > 200) {
    throw new ErreurOcka(
      'Ce que tu as joué est trop long pour le morceau (64 sections au plus). Enregistre un passage plus court.',
      'trop_gros',
    );
  }
  return { ...m, sections: [...m.sections, ...d.sections], ordre: [...m.ordre, ...d.ordre] };
}

/** Marge avant une barre de mesure (s) : en dessous, le lancement part à la barre suivante (le lecteur doit relayer). */
export const MARGE_LANCEMENT = 0.3;
/** Mesures chargées d'avance dans le lecteur. */
const AVANCE = 64;

/** Un looper qui joue par le lecteur (Lecteur public : charger, boucler, lire, aller, pause). */
export function creerLooper(lecteur: Lecteur, m: Morceau): Looper {
  let tours: Tour[] = [{ debut: 0, mesures: Infinity, actifs: {} }];
  let actifs: Actifs = {};
  let attente: { piste: string; motif: string | null; mesure: number }[] = [];
  let mesure = 0;
  let charge = 0;
  let demarre = false;
  let enregistre = false;
  let journal: LancementLooper[] = [];
  let minuteur: ReturnType<typeof setInterval> | undefined;
  let chargement: Promise<void> = Promise.resolve();
  let desabonner: (() => void) | null = null;
  const ecouteurs = new Set<() => void>();
  const prevenir = () => ecouteurs.forEach((cb) => cb());

  const etatA = (k: number): Actifs => [...tours].reverse().find((t) => t.debut <= k)?.actifs ?? {};
  /** Le morceau que joue le lecteur : les tours, jusqu'à `jusqua` mesures. */
  function morceauDirect(jusqua: number): Morceau {
    const d = decouper(
      m,
      tours,
      jusqua,
      (i) => `Direct ${i + 1}`,
      (_c, i) => `direct-${i}`,
    );
    return { ...m, sections: d.sections, ordre: d.ordre, prises: [], marqueurs: undefined, fondu: 0 };
  }
  function recharger() {
    charge = Math.max(mesure, ...attente.map((a) => a.mesure)) + AVANCE;
    chargement = lecteur.charger(morceauDirect(charge));
    chargement.catch((e: unknown) => console.error(e));
  }
  /** Change l'état à partir de la mesure `k` (le tour en cours est coupé là). */
  function changerA(k: number, piste: string, motif: string | null) {
    const avant = tours.filter((t) => t.debut < k);
    const dernier = avant[avant.length - 1];
    const meme = tours.find((t) => t.debut === k);
    const base = meme ? meme.actifs : etatA(k);
    const nouveaux = appliquer(base, [{ piste, motif }]);
    if (dernier && cleActifs(dernier.actifs) === cleActifs(nouveaux)) {
      // Rien ne change à cette mesure (lancement annulé) : le tour d'avant continue, sans repartir au début.
      dernier.mesures = Infinity;
      tours = avant;
      return;
    }
    if (dernier) dernier.mesures = k - dernier.debut;
    tours = [...avant, { debut: k, mesures: Infinity, actifs: nouveaux }];
  }
  function noter(k: number, piste: string, motif: string | null) {
    if (!enregistre) return;
    journal = [...journal.filter((l) => !(l.mesure === k && l.piste === piste)), { mesure: k, piste, motif }];
  }

  function mesureCourante(): { k: number; avantBarre: number } {
    const t = lecteur.temps;
    const pas = secondesVersPas(m, t);
    const k = Math.floor(pas / 16 + 1e-9);
    return { k, avantBarre: pasVersSecondes(m, (k + 1) * 16) - t };
  }
  function tic() {
    if (!demarre || !lecteur.enLecture) return;
    const { k } = mesureCourante();
    let change = k !== mesure;
    mesure = Math.max(mesure, k);
    const parties = attente.filter((a) => a.mesure <= mesure);
    if (parties.length > 0) {
      attente = attente.filter((a) => a.mesure > mesure);
      actifs = etatA(mesure);
      change = true;
    }
    if (mesure > charge - AVANCE / 2) recharger();
    if (change) prevenir();
  }

  return {
    get mesure() { return mesure; }, // prettier-ignore
    get actifs() { return actifs; }, // prettier-ignore
    get enAttente() { return attente.map(({ piste, motif }) => ({ piste, motif })); }, // prettier-ignore
    get enregistre() { return enregistre; }, // prettier-ignore
    get journal() { return journal; }, // prettier-ignore
    async demarrer() {
      if (demarre) return;
      demarre = true;
      mesure = 0;
      tours = [{ debut: 0, mesures: Infinity, actifs: appliquer(actifs, attente) }];
      actifs = tours[0]!.actifs;
      attente = [];
      lecteur.pause();
      lecteur.boucler(null);
      charge = AVANCE;
      chargement = lecteur.charger(morceauDirect(charge));
      // Un lancement pendant le chargement en relance un autre : on attend le dernier (jamais l'ancien morceau).
      for (let p = chargement; ; p = chargement) if ((await p, p === chargement)) break;
      lecteur.aller(0);
      lecteur.lire();
      desabonner = lecteur.surChangement(tic);
      minuteur = setInterval(tic, 25);
      prevenir();
    },
    arreter() {
      if (!demarre) return;
      if (enregistre) this.enregistrer(false);
      demarre = false;
      clearInterval(minuteur);
      desabonner?.();
      desabonner = null;
      lecteur.pause();
      actifs = appliquer(actifs, attente);
      attente = [];
      prevenir();
    },
    lancer(c) {
      if (!pisteJouable(c.piste) || (c.motif !== null && !m.motifs[c.motif])) return;
      if (!demarre || !lecteur.enLecture) {
        attente = attente.filter((a) => a.piste !== c.piste);
        actifs = appliquer(actifs, [c]);
        noter(mesure, c.piste, c.motif);
        if (demarre) {
          // Le looper démarre (le lecteur charge encore) : la case joue dès la mesure en cours.
          changerA(mesure, c.piste, c.motif);
          recharger();
        }
        return prevenir();
      }
      const { k, avantBarre } = mesureCourante();
      const vise = Math.max(mesure, k) + (avantBarre < MARGE_LANCEMENT ? 2 : 1);
      // Un seul lancement en attente par piste : le nouveau remplace l'ancien (même toucher deux fois = rien).
      const deja = attente.find((a) => a.piste === c.piste);
      attente = attente.filter((a) => a.piste !== c.piste);
      if (deja && deja.mesure !== vise) {
        changerA(deja.mesure, c.piste, etatA(deja.mesure - 1)[c.piste] ?? null);
        journal = journal.filter((l) => !(l.mesure === deja.mesure && l.piste === c.piste));
      }
      attente.push({ piste: c.piste, motif: c.motif, mesure: vise });
      changerA(vise, c.piste, c.motif);
      noter(vise, c.piste, c.motif);
      recharger();
      prevenir();
    },
    enregistrer(actif) {
      if (actif === enregistre) return;
      const k = demarre && lecteur.enLecture ? Math.max(mesure, mesureCourante().k) + 1 : mesure;
      if (actif) {
        enregistre = true;
        journal = [];
        if (demarre && lecteur.enLecture && !tours.some((t) => t.debut === k)) {
          // L'enregistrement commence une section : le looper repart aussi au début de ses motifs à cette mesure.
          const avant = tours.filter((t) => t.debut < k);
          const dernier = avant[avant.length - 1]!;
          const suite = tours.filter((t) => t.debut > k);
          const etat = etatA(k);
          dernier.mesures = k - dernier.debut;
          tours = [
            ...avant,
            { debut: k, mesures: suite[0] ? suite[0].debut - k : Infinity, actifs: etat },
            ...suite,
          ];
          recharger();
        }
        const etat = demarre ? etatA(k) : actifs;
        for (const piste of Object.keys(etat)) if (etat[piste]) noter(k, piste, etat[piste]!);
        for (const a of attente) if (a.mesure > k) noter(a.mesure, a.piste, a.motif);
      } else {
        const fin = Math.max(k, ...journal.map((l) => l.mesure));
        const etat = demarre ? etatA(fin) : actifs;
        for (const piste of Object.keys(etat)) if (etat[piste]) noter(fin, piste, null);
        enregistre = false;
      }
      prevenir();
    },
    surChangement(cb) {
      ecouteurs.add(cb);
      return () => ecouteurs.delete(cb);
    },
    detruire() {
      this.arreter();
      ecouteurs.clear();
    },
  };
}
