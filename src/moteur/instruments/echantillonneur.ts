// Échantillonneur d'une piste (M1, vague C1) : joue un instrument SourceZones (banque de BQ, SoundFont en C3).
// Décisions v2 §2 :
// - la zone se choisit par la note et la couche (vel × 127) ; elle se joue avec `detune` depuis sa racine (pas de
//   rééchantillonnage sinc par note) ; gain = gains en dB × vel^1,6 ;
// - boucles (loopStart/loopEnd, en échantillons du fichier décodé), relâchement par rampe de gain puis stop() ;
// - groupes exclusifs (charley ouvert/fermé), mode mono (une note coupe la précédente), glissé (rampe de detune) ;
// - preparer() ne décode que les zones jouées, AVANT la lecture (cache commun, budget 128 Mio, zones épinglées).
// Rien n'est calculé pendant la lecture : jouer() ne fait que brancher une source (sautée si sa zone n'est pas prête).

import type { Echantillonneur, SourceZones } from '../types-moteur';
import { cacheZones, CacheZones, type LectureZone } from './cache-zones';
import { fournisseur } from './fournisseur';
import { Sources, type Active } from './sources';
import { choisirZone, fichiersPour, gainNote, groupeExclusif, positionTamponBlocs, rampeGlisse } from './zones';

/** Options internes de jouer() (au-delà du contrat) : reprise d'une note commencée, fondu d'entrée, pitch bend. */
export interface OptionsJeuZone {
  /** Note MIDI vers laquelle la fin de la note glisse (Note.glisse). */
  glisseVers?: number;
  /** Secondes de note déjà jouées (reprise après un saut ou un relais) : `quand` est alors l'heure de reprise. */
  ecoule?: number;
  fonduEntree?: number;
  /** Pitch bend de la piste (cents), branché sur le detune de la source. */
  hauteur?: AudioNode;
  /** Valeur de ce pitch bend (cents) à r s du début de la note : position juste à la reprise. */
  bend?: (r: number) => number;
}

export interface EchantillonneurPiste extends Echantillonneur {
  readonly source: SourceZones;
  /** true si la note est jouée (ou déjà finie à l'heure de reprise) ; false si sa zone n'est pas prête (sautée). */
  jouer(midi: number, vel: number, quand: number, duree: number, sortie: AudioNode, options?: OptionsJeuZone): boolean;
  /** true si la zone de cette note est décodée. */
  pret(midi: number, vel: number): boolean;
  /** Zones sautées (pas prêtes au moment de jouer). */
  readonly sautees: number;
}

interface Tenue {
  a: Active;
  midi: number;
  groupe: number;
  /** Heure où la note est vraiment finie (relâchement compris). */
  finie: number;
}

/**
 * `sources` : celles du graphe (relais, arrêt, retards comptés) ; `lecture` : d'où viennent les zones (le fournisseur
 * de BQ par défaut) ; `cache` : le cache commun des zones décodées.
 */
export function creerEchantillonneur(
  ctx: BaseAudioContext,
  source: SourceZones,
  sources: Sources = new Sources(ctx, null),
  lecture: LectureZone = (id, f, s) => fournisseur().lireZone(id, f, s),
  cache: CacheZones = cacheZones,
): EchantillonneurPiste {
  const epinglees = new Set<string>();
  const tenues: Tenue[] = [];
  let sautees = 0;
  let libere = false;
  const cle = (fichier: string) => CacheZones.cle(source.id, fichier);
  const finZone = new Map(source.zones.map((z) => [z.fichier, z.fin]));

  /** Coupe à `quand` les notes encore là du même groupe exclusif (ou toutes, en mono). */
  function couper(groupe: number, quand: number, menage = false) {
    for (let i = tenues.length - 1; i >= 0; i--) {
      const t = tenues[i]!;
      if (t.finie <= quand) {
        tenues.splice(i, 1);
        continue;
      }
      if (!menage && (source.mono || (groupe >= 0 && t.groupe === groupe)) && t.a.debut < quand) {
        sources.couper(t.a, quand);
        tenues.splice(i, 1);
      }
    }
  }

  return {
    source,
    get sautees() {
      return sautees;
    },

    async preparer(notes, signal) {
      if (libere) return;
      const fichiers = [...fichiersPour(source, notes)].filter((f) => !epinglees.has(cle(f)));
      const cles = fichiers.map(cle);
      cache.epingler(cles); // avant de décoder : le LRU ne les jettera pas pendant qu'on décode les suivantes
      cles.forEach((c) => epinglees.add(c));
      await Promise.all(fichiers.map((f) => cache.obtenir(lecture, source.id, f, finZone.get(f) ?? 0, signal)));
    },

    pret(midi, vel) {
      const c = choisirZone(source, midi, vel);
      return !!c && cache.lire(cle(c.zone.fichier)) !== undefined;
    },

    jouer(midi, vel, quand, duree, sortie, options = {}) {
      const c = choisirZone(source, midi, vel);
      const buffer = c && !libere ? cache.lire(cle(c.zone.fichier)) : undefined;
      if (!c || !buffer) {
        sautees++;
        return false;
      }
      const { zone, detune } = c;
      const sr = buffer.sampleRate;
      const depart = quand - Math.max(0, options.ecoule ?? 0); // heure du début de la note
      // Reprise : calée sur la grille d'échantillons de la note (même sous-échantillon que l'export).
      const fs = ctx.sampleRate;
      const ecoule = options.ecoule ? Math.ceil(options.ecoule * fs - 1e-6) / fs : 0;
      if (ecoule > 0) quand = depart + ecoule;
      const relache = Math.max(0.005, source.relache);
      const g = options.glisseVers !== undefined && options.glisseVers !== midi ? { ...rampeGlisse(duree), cents: 100 * (options.glisseVers - midi) } : undefined;
      const fin = Math.min(zone.fin, buffer.length) / sr;
      const boucle: [number, number] | undefined = zone.boucle ? [zone.boucle.debut / sr, Math.min(zone.boucle.fin, buffer.length) / sr] : undefined;
      const decalage = zone.debut / sr + positionTamponBlocs(depart, ecoule, detune, g, 128 / fs, ecoule > 0 ? options.bend : undefined);
      if (!boucle && decalage >= fin - 0.002) return true; // son déjà fini à l'heure de la reprise
      if (ecoule >= duree + relache - 0.002) return true;
      // Reprise pendant le relâchement : la rampe repart de sa valeur à cette heure (même droite qu'à l'export).
      let gain = gainNote(source, zone, vel);
      let [finNote, rel] = [depart + duree, relache];
      if (ecoule > duree) {
        const entree = options.fonduEntree ?? 0;
        const reste = duree + relache - ecoule;
        gain *= Math.max(0, reste - entree) / relache;
        [finNote, rel] = [quand, Math.max(0.001, reste - entree)];
      }
      const groupe = groupeExclusif(source, midi);
      couper(groupe, quand);
      // Glissé : detune au moment de la reprise, puis rampe jusqu'à la fin de la note.
      let rampe: { debut: number; fin: number; vers: number } | undefined;
      let depuis = detune;
      if (g) {
        const k = g.cents / Math.max(1e-9, g.fin - g.debut);
        depuis = ecoule > g.debut ? detune + k * Math.min(ecoule - g.debut, g.fin - g.debut) : detune;
        rampe = { debut: Math.max(quand, depart + g.debut), fin: depart + g.fin, vers: detune + g.cents };
      }
      const a = sources.jouer(buffer, quand, gain, [sortie], {
        decalage,
        boucle,
        finNote,
        relache: rel,
        stereo: buffer.numberOfChannels === 1,
        genre: 'long',
        fonduEntree: options.fonduEntree,
        detune: depuis,
        rampeDetune: rampe && rampe.fin > rampe.debut ? rampe : undefined,
        hauteur: options.hauteur,
      });
      tenues.push({ a, midi, groupe, finie: depart + duree + relache });
      if (tenues.length > 256) couper(-1, quand, true); // ménage des notes finies
      return true;
    },

    liberer() {
      if (libere) return;
      libere = true;
      tenues.length = 0;
      cache.liberer(epinglees);
      epinglees.clear();
    },
  };
}
