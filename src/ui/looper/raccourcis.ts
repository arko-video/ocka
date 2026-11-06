// Raccourcis clavier sur PC (R) : appelé par App.tsx AVANT ses raccourcis (Ctrl+Z, Ctrl+Y, Espace), hors champs de
// saisie et hors aide. Renvoie true si la touche est prise (App ne fait alors rien d'autre).
// Espace, Ctrl+Z et Ctrl+Y restent ceux d'App ; ici : flèches, Début, M, S, T et « ? ».

import { arrangement, dureePas, PAS_PAR_MESURE } from '../../morceau/temps';
import { T } from '../../textes-fr';
import { afficherToast, modifier, morceau, panneau, pisteEditee, sectionCourante } from '../etat';
import { reglerTranche } from '../edition/mixage';
import { allerAuTemps, tempsLecture } from '../lecture';
import { ouvrirConfort } from '../navigation';
import { taper, voirRaccourcis } from './PanneauConfort';

/** Va d'une mesure en avant ou en arrière (calé sur la barre de mesure). */
function sauterMesure(sens: -1 | 1) {
  const m = morceau.peek();
  if (!m) return;
  const mesure = PAS_PAR_MESURE * dureePas(m.tempo);
  const k = Math.round(tempsLecture.peek() / mesure);
  allerAuTemps(Math.max(0, (k + sens) * mesure));
}

/** Section précédente ou suivante (sectionCourante), et la tête de lecture à son début. */
function sauterSection(sens: -1 | 1) {
  const m = morceau.peek();
  if (!m) return;
  const occs = arrangement(m);
  if (occs.length === 0) return;
  const i = Math.max(
    0,
    occs.findIndex((o) => o.section.id === sectionCourante.peek()),
  );
  const o = occs[Math.min(occs.length - 1, Math.max(0, i + sens))]!;
  sectionCourante.value = o.section.id;
  allerAuTemps(o.debutPas * dureePas(m.tempo));
}

/** Coupe (M) ou met en solo (S) la piste ouverte. */
function basculer(cle: 'muet' | 'solo') {
  const id = pisteEditee.peek();
  const p = id ? morceau.peek()?.pistes.find((x) => x.id === id) : undefined;
  if (!p) return afficherToast(T.confort.pasDePiste);
  modifier((m) => reglerTranche(m, p.id, { [cle]: !p[cle] }));
}

export function raccourciC3(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  // Dans un panneau, les flèches et les lettres restent au panneau (curseurs, listes) ; « ? » marche partout.
  const dansPanneau = panneau.peek() !== null;
  const prendre = (fn: () => void) => (e.preventDefault(), fn(), true);
  if (e.key === '?') return prendre(() => ((voirRaccourcis.value = true), ouvrirConfort()));
  if (dansPanneau) return false;
  switch (e.key) {
    case 'ArrowLeft':
      return prendre(() => sauterMesure(-1));
    case 'ArrowRight':
      return prendre(() => sauterMesure(1));
    case 'ArrowUp':
      return prendre(() => sauterSection(-1));
    case 'ArrowDown':
      return prendre(() => sauterSection(1));
    case 'Home':
      return prendre(() => allerAuTemps(0));
  }
  switch (e.key.toLowerCase()) {
    case 'm':
      return prendre(() => basculer('muet'));
    case 's':
      return prendre(() => basculer('solo'));
    case 't':
      return prendre(taper);
  }
  return false;
}
