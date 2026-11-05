// Paroles au format Musixmatch, fabriquées depuis la structure du morceau (pur). Propriétaire : A1.
// Règles de Musixmatch (celles que Spotify affiche) : chaque répétition écrite en entier (un refrain qui revient
// est réécrit), une ligne par vers, une ligne vide entre les sections, aucune étiquette ([Refrain], « Couplet 2 : »),
// pas de « x2 » (on écrit la ligne deux fois), pas de virgule ni de point en fin de ligne.

import { arrangement } from '../morceau/temps';
import type { Morceau } from '../morceau/types';

const NOMS_SECTIONS =
  'intro|couplet|refrain|pont|outro|pré-refrain|pre-refrain|prérefrain|hook|verse|chorus|pre-chorus|bridge|interlude|break|drop|post-refrain|refrain final|ad-?libs?';
/** Une ligne qui n'est qu'une étiquette : « [Refrain] », « (Couplet 2) », « Refrain : », « REFRAIN x2 ». */
const ETIQUETTE = new RegExp(`^(?:\\[[^\\]]*\\]|\\{[^}]*\\}|\\(?\\s*(?:${NOMS_SECTIONS})\\s*\\d*\\s*(?:[x×]\\s*\\d)?\\s*\\)?\\s*:?)$`, 'i');
/** « Je pars (x2) », « Je pars x3 », « Je pars ×2 » : la ligne est écrite 2 ou 3 fois (4 au plus). */
const REPETITION = /(?:\s+[([]?|\s*[([])\s*[x×]\s*([2-4])\s*[)\]]?\s*$/i;

/** Nettoie une ligne : espaces invisibles, espaces en double, virgule ou point final (pas « … » ni « ?! »). */
export function nettoyerLigne(brute: string): string {
  let l = brute
    .normalize('NFC')
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\t\u00a0\u202f\u2000-\u200a]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (!/\.\.\.$/.test(l)) l = l.replace(/\s*[,;.]+$/, '');
  return l;
}

/** Les vers d'un bloc de paroles, nettoyés, sans étiquette, répétitions « x2 » développées. */
export function vers(texte: string): string[] {
  const sortie: string[] = [];
  for (const brute of texte.replace(/\r\n?/g, '\n').split('\n')) {
    const l = nettoyerLigne(brute);
    if (!l || ETIQUETTE.test(l)) continue;
    const rep = REPETITION.exec(l);
    const fois = rep && rep.index > 0 ? Number(rep[1]) : 1;
    const ligne = rep && rep.index > 0 ? nettoyerLigne(l.slice(0, rep.index)) : l;
    if (!ligne) continue;
    for (let i = 0; i < fois; i++) sortie.push(ligne);
  }
  return sortie;
}

/**
 * Paroles au format Musixmatch : chaque apparition de section (dans `ordre`) écrite en entier, une ligne par vers,
 * une ligne vide entre les sections, sans étiquette. '' si aucune parole.
 */
export function parolesMusixmatch(morceau: Morceau): string {
  const blocs: string[] = [];
  for (const o of arrangement(morceau)) {
    const v = vers(o.section.paroles ?? '');
    if (v.length) blocs.push(v.join('\n'));
  }
  return blocs.join('\n\n');
}
