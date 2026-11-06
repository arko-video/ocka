// Pose d'un son modifié (éditeur, étirement) dans le morceau : PUR, un seul Annuler. Le son d'origine reste dans
// « Tes sons » ; les pads et les boucles de section qui le jouaient passent au nouveau son (sans ses découpes).

import { PADS_PERSO, type Morceau, type SonImporte } from '../../../morceau/types';
import { ajouterSon } from '../../edition/sons';

export function poserSonModifie(m: Morceau, ancien: string, nouveau: SonImporte): Morceau {
  const m1 = ajouterSon(m, nouveau);
  if (m1 === m) return m;
  const pads = { ...m1.pads };
  const tp = { ...m1.tranchesPads };
  for (const p of PADS_PERSO) {
    if (pads[p] !== ancien) continue;
    pads[p] = nouveau.id;
    delete tp[p];
  }
  const res: Morceau = { ...m1, sections: m1.sections.map((s) => (s.boucle?.son === ancien ? { ...s, boucle: { ...s.boucle, son: nouveau.id } } : s)) };
  if (m1.pads) res.pads = pads;
  if (Object.keys(tp).length) res.tranchesPads = tp;
  else delete res.tranchesPads;
  return res;
}
