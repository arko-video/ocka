// Historique d'Annuler visible (R) : chaque étape reçoit un nom lisible (« Note posée (Piano) », « Piste ajoutée »…),
// trouvé en comparant l'état à celui d'avant. Les modifications gardent les objets qui ne changent pas (fonctions
// pures) : on compare d'abord par référence, ce qui reste rapide sur 60 étapes.

import type { EtapeHistorique } from '../api-performance';
import type { Morceau, Motif, Piste } from '../../morceau/types';

const nomPiste = (p: Piste | undefined) =>
  !p
    ? ''
    : p.genre === 'instrument'
      ? p.nom
      : ((
          { batterie: 'Batterie', basse: 'Basse', accords: 'Accords', sons: 'Sons', voix: 'Voix' } as Record<
            string,
            string
          >
        )[p.id] ?? p.id);

/** Le changement d'un motif (notes posées ou effacées, frappes…). */
function libelleMotif(avant: Motif | undefined, apres: Motif, ou: string): string {
  const suffixe = ou ? ` (${ou})` : '';
  if (!avant) return `Motif créé${suffixe}`;
  if (apres.type === 'notes' && avant.type === 'notes') {
    const d = apres.notes.length - avant.notes.length;
    if (d === 1) return `Note posée${suffixe}`;
    if (d > 1) return `${d} notes posées${suffixe}`;
    if (d === -1) return `Note effacée${suffixe}`;
    if (d < -1) return `${-d} notes effacées${suffixe}`;
    return `Notes modifiées${suffixe}`;
  }
  if (apres.type === 'batterie' && avant.type === 'batterie') {
    const compte = (x: typeof apres) =>
      Object.values(x.pistes).reduce((n, v) => n + (v ?? []).filter((y) => y > 0).length, 0);
    const d = compte(apres) - compte(avant);
    if (d > 0) return d === 1 ? 'Frappe posée' : `${d} frappes posées`;
    if (d < 0) return d === -1 ? 'Frappe effacée' : `${-d} frappes effacées`;
    return 'Batterie modifiée';
  }
  if (apres.type === 'basse') return 'Basse modifiée';
  if (apres.type === 'accords') return 'Accords modifiés';
  return `Motif modifié${suffixe}`;
}

/** Les pistes : ajout, suppression, instrument, mixage, effets, automation. */
function libellePistes(a: Morceau, b: Morceau): string | null {
  if (a.pistes === b.pistes) return null;
  if (b.pistes.length > a.pistes.length) {
    const neuves = b.pistes.filter((p) => !a.pistes.some((x) => x.id === p.id));
    return neuves.length > 1 ? `${neuves.length} pistes ajoutées` : `Piste ajoutée (${nomPiste(neuves[0])})`;
  }
  if (b.pistes.length < a.pistes.length)
    return `Piste supprimée (${nomPiste(a.pistes.find((p) => !b.pistes.some((x) => x.id === p.id)))})`;
  const i = b.pistes.findIndex((p, j) => p !== a.pistes[j]);
  if (i < 0) return null;
  const x = a.pistes[i]!;
  const y = b.pistes[i]!;
  const nom = nomPiste(y);
  if (x.id !== y.id) return 'Pistes déplacées';
  if (x.genre === 'instrument' && y.genre === 'instrument') {
    if (x.instrument !== y.instrument) return `Instrument changé (${nom})`;
    if (x.nom !== y.nom) return `Piste renommée (${nom})`;
    if (x.synthe !== y.synthe) return `Synthé réglé (${nom})`;
  }
  if (x.muet !== y.muet) return y.muet ? `Piste coupée (${nom})` : `Piste rallumée (${nom})`;
  if (x.solo !== y.solo) return y.solo ? `Solo (${nom})` : `Solo retiré (${nom})`;
  if (x.volume !== y.volume) return `Volume réglé (${nom})`;
  if (x.pan !== y.pan) return `Panoramique réglé (${nom})`;
  if (x.inserts !== y.inserts) {
    const d = (y.inserts?.length ?? 0) - (x.inserts?.length ?? 0);
    return d > 0 ? `Effet ajouté (${nom})` : d < 0 ? `Effet retiré (${nom})` : `Effet réglé (${nom})`;
  }
  if (x.sidechain !== y.sidechain) return `Pompe réglée (${nom})`;
  if (x.auto !== y.auto || x.lfo !== y.lfo) return `Automation modifiée (${nom})`;
  return `Piste modifiée (${nom})`;
}

/** Les sections et l'arrangement. */
function libelleSections(a: Morceau, b: Morceau): string | null {
  if (a.sections === b.sections && a.ordre === b.ordre) return null;
  if (b.sections.length > a.sections.length)
    return b.sections.length - a.sections.length > 1 ? 'Sections ajoutées' : 'Section ajoutée';
  if (b.sections.length < a.sections.length) return 'Section supprimée';
  const i = b.sections.findIndex((s, j) => s !== a.sections[j]);
  if (i >= 0) {
    const x = a.sections[i]!;
    const y = b.sections[i]!;
    if (x.perf !== y.perf) {
      const d = (y.perf?.length ?? 0) - (x.perf?.length ?? 0);
      return d > 0
        ? `Effet de fin ajouté (${y.nom})`
        : d < 0
          ? `Effet de fin retiré (${y.nom})`
          : `Effet de fin réglé (${y.nom})`;
    }
    if (x.nom !== y.nom) return 'Section renommée';
    if (x.mesures !== y.mesures) return `Longueur changée (${y.nom})`;
    if (x.motifs !== y.motifs) return `Motif changé (${y.nom})`;
    if (x.paroles !== y.paroles) return `Paroles modifiées (${y.nom})`;
    return `Section modifiée (${y.nom})`;
  }
  return b.ordre.length > a.ordre.length
    ? 'Section ajoutée'
    : b.ordre.length < a.ordre.length
      ? 'Section retirée'
      : 'Arrangement modifié';
}

/** Nom lisible du changement de `a` vers `b`. */
export function libelleChangement(a: Morceau, b: Morceau): string {
  if (a.tempo !== b.tempo) return `Tempo changé (${a.tempo} → ${b.tempo})`;
  if (a.swing !== b.swing) return 'Swing réglé';
  if (a.tonalite !== b.tonalite) return 'Tonalité changée';
  if (a.kit !== b.kit) return 'Kit changé';
  const pistes = libellePistes(a, b);
  if (pistes) return pistes;
  const sections = libelleSections(a, b);
  if (sections && (a.sections !== b.sections || a.motifs === b.motifs)) return sections;
  if (a.motifs !== b.motifs) {
    for (const id of Object.keys(b.motifs)) {
      if (a.motifs[id] === b.motifs[id]) continue;
      const s = b.sections.find((x) => Object.values(x.motifs).includes(id));
      const piste = s ? Object.keys(s.motifs).find((p) => s.motifs[p] === id) : undefined;
      const p = b.pistes.find((x) => x.id === piste);
      return libelleMotif(a.motifs[id], b.motifs[id]!, p?.genre === 'instrument' ? p.nom : '');
    }
    if (sections) return sections;
    return 'Motif retiré';
  }
  if (a.prises !== b.prises)
    return b.prises.length > a.prises.length
      ? 'Prise enregistrée'
      : b.prises.length < a.prises.length
        ? 'Prise supprimée'
        : 'Prise modifiée';
  if (a.master !== b.master) return 'Mastering réglé';
  if (a.sons !== b.sons)
    return (b.sons?.length ?? 0) > (a.sons?.length ?? 0) ? 'Son importé' : 'Sons modifiés';
  if (a.pads !== b.pads || a.tranchesPads !== b.tranchesPads) return 'Pad changé';
  if (a.marqueurs !== b.marqueurs) {
    const d = (b.marqueurs?.length ?? 0) - (a.marqueurs?.length ?? 0);
    return d > 0 ? 'Repère posé' : d < 0 ? 'Repère retiré' : 'Repère renommé';
  }
  if (a.titre !== b.titre || a.artiste !== b.artiste || a.infos !== b.infos) return 'Infos du titre';
  if (a.fondu !== b.fondu) return 'Fondu de fin réglé';
  if (a.soundfonts !== b.soundfonts) return 'SoundFont ajoutée';
  if (a.style !== b.style) return 'Style changé';
  return 'Modification';
}

/** Les étapes (au plus 60 + présent + futur), de la plus ancienne à la plus récente. */
export function etapesHistorique(
  passe: readonly Morceau[],
  present: Morceau,
  futur: readonly Morceau[],
): EtapeHistorique[] {
  const etats = [...passe, present, ...futur];
  const n = passe.length;
  return etats.map((m, i) => ({
    libelle:
      i === 0
        ? n >= 60
          ? 'Étape la plus ancienne'
          : 'Ouverture du morceau'
        : libelleChangement(etats[i - 1]!, m),
    position: i - n,
  }));
}
