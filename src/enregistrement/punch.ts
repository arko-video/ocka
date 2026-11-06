// Punch-in : on réenregistre un passage d'une prise. Le lecteur part `preRoll` mesures avant le passage (la 1re
// avec le métronome : c'est le décompte de l'enregistreur), la capture tourne (même calibrage, même latence que
// l'enregistreur), puis s'arrête seule 0,3 s après la fin du passage. La prise de punch, recalée par ses propres
// repères (ancre, debutCoupe, decalage = latence), remplace le passage dans une NOUVELLE prise alignée sur
// l'ancienne, avec des fondus enchaînés de 10 ms aux bords (assemblage.ts). Le fichier temporaire est effacé.

import type { Enregistreur, Lecteur } from '../moteur/api';
import { ErreurOcka } from '../moteur/erreur';
import { arrangement, debutOccurrence, dureePas, PAS_PAR_MESURE } from '../morceau/temps';
import type { Morceau, Prise } from '../morceau/types';
import type { Punch, ZonePunch } from './api-voix-avancee';
import { ajouterDerivee, assemblerPcm, echantillonA, longueurAssemblage, prisesDeSection, tempsDe } from './assemblage';
import { creerEnregistreur, type OptionsEnregistreur } from './enregistreur';
import { nomDescription, supprimerFichier } from './fichiers-opfs';
import { ecrirePrise, sourceDe } from './prises-derivees';

/** Marge enregistrée après la fin du passage (s) : le fondu de sortie a de quoi travailler. */
const APRES = 0.3;

/** La prise remplacée par un punch : la choisie de cette apparition de section, sinon la dernière. */
export function priseDuPunch(m: Morceau, section: string, occurrence: number): Prise | null {
  const liste = prisesDeSection(m, section, occurrence);
  return liste.find((p) => p.choisie) ?? liste[liste.length - 1] ?? null;
}

/** La zone en secondes du morceau, et la mesure (dans la section) où démarre l'enregistreur. Lève si invalide. */
export function zoneEnSecondes(m: Morceau, z: ZonePunch): { de: number; a: number; mesureAncre: number } {
  const occ = arrangement(m).find((o) => o.section.id === z.section && o.occurrence === z.occurrence);
  const debut = debutOccurrence(m, z.section, z.occurrence);
  if (!occ || debut === null) throw new ErreurOcka("Cette section n'existe plus dans le morceau.", 'ancre_introuvable');
  const de = Math.max(0, Math.min(z.de, occ.pas));
  const a = Math.max(0, Math.min(z.a, occ.pas));
  if (!(a > de)) throw new ErreurOcka('Choisis un passage d’au moins un pas.', 'trop_court');
  const pre = z.preRoll === 2 ? 2 : 1;
  // L'enregistreur joue UNE mesure de décompte avant son ancre : l'ancre est donc (pré-roll − 1) mesures avant.
  const mesureAncre = Math.floor(de / PAS_PAR_MESURE) - (pre - 1);
  const d = dureePas(m.tempo);
  return { de: debut + de * d, a: debut + a * d, mesureAncre };
}

class PunchOcka implements Punch {
  private session: { m: Morceau; source: Prise; de: number; a: number; minuterie: ReturnType<typeof setInterval> } | null = null;
  private fin: Promise<Morceau> | null = null;

  constructor(private enr: Enregistreur) {}

  get niveau(): number {
    return this.enr.niveau;
  }
  get enCours(): boolean {
    return this.session !== null && this.fin === null;
  }

  async demarrer(lecteur: Lecteur, m: Morceau, zone: ZonePunch): Promise<void> {
    if (this.session) throw new ErreurOcka('Un enregistrement est déjà en cours.', 'deja_en_cours');
    const source = priseDuPunch(m, zone.section, zone.occurrence);
    if (!source) throw new ErreurOcka('Enregistre d’abord une prise de cette section : le punch-in en remplace un passage.', 'prise_introuvable');
    const { de, a, mesureAncre } = zoneEnSecondes(m, zone);
    await this.enr.demarrer(lecteur, m, { section: zone.section, occurrence: zone.occurrence, mesure: mesureAncre });
    const minuterie = setInterval(() => {
      if (lecteur.temps >= a + APRES) this.arretAuto();
    }, 40);
    this.session = { m, source, de, a, minuterie };
    this.fin = null;
  }

  /** Arrête (ou reprend l'arrêt automatique déjà lancé) et rend le morceau assemblé. */
  arreter(): Promise<Morceau> {
    const s = this.session;
    if (!s) return Promise.reject(new ErreurOcka("Aucun enregistrement n'est en cours.", 'pas_en_cours'));
    const fin = this.fin ?? this.terminer(s);
    this.session = null;
    this.fin = null;
    return fin;
  }

  /** Arrêt automatique après le passage : le résultat attend l'appel à arreter(). */
  private arretAuto(): void {
    if (!this.session || this.fin) return;
    this.fin = this.terminer(this.session);
    this.fin.catch(() => {});
  }

  private async terminer(s: NonNullable<PunchOcka['session']>): Promise<Morceau> {
    clearInterval(s.minuterie);
    const prisePunch = await this.enr.arreter();
    try {
      const base = await sourceDe(s.m, s.source);
      const punch = await sourceDe(s.m, prisePunch);
      // Arrêté avant la fin du passage : on ne remplace que ce qui a été chanté.
      const a = Math.min(s.a, tempsDe(punch, punch.pcm.length) - 0.01);
      if (!(a > s.de + 0.02)) throw new ErreurOcka('Arrêté avant le passage : il n’y a rien à remplacer.', 'prise_vide');
      const passages = [
        { source: 0, de: -Infinity, a: s.de },
        { source: 1, de: s.de, a },
        { source: 0, de: a, a: Infinity },
      ];
      const n = longueurAssemblage({ ...base, longueur: base.pcm.length }, [{ a }]);
      const pcm = assemblerPcm(base, [base, punch], passages, n);
      const fichier = await ecrirePrise(pcm, base.frequence, 'punch');
      const duree = n / base.frequence;
      const finCoupe = Math.min(duree, Math.max(s.source.finCoupe, echantillonA(base, a + 0.01) / base.frequence));
      return ajouterDerivee(s.m, s.source, fichier, '(punch)', { duree, finCoupe });
    } finally {
      await supprimerFichier(prisePunch.fichier);
      await supprimerFichier(nomDescription(prisePunch.fichier));
    }
  }

  detruire(): void {
    if (this.session) clearInterval(this.session.minuterie);
    this.session = null;
    this.enr.detruire();
  }
}

/** Demande le micro (geste requis). `options.entree` : faux micro des tests (comme l'enregistreur). */
export async function creerPunch(options: OptionsEnregistreur = {}): Promise<Punch> {
  return new PunchOcka(await creerEnregistreur(options));
}
