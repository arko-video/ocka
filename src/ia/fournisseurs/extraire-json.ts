// Retrouve l'objet JSON dans le texte écrit par une IA, même mal emballé : bloc ```json, phrases autour,
// virgules en trop. Adapté d'Arko (licence MIT, même auteur). Fonctions pures, jamais d'eval.

/** Le premier objet JSON du texte, ou undefined s'il est illisible ou absent. */
export function extraireObjet(reponse: string): Record<string, unknown> | undefined {
  const texte = sansEmballage(reponse);
  const debut = texte.indexOf('{');
  if (debut < 0) return undefined;
  const fin = finDuBloc(texte, debut);
  if (fin < 0) return undefined;
  const v = lire(texte.slice(debut, fin + 1));
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

/** Retire le bloc ```json … ``` (même sans les ``` de fin) et les caractères invisibles du début. */
function sansEmballage(reponse: string): string {
  const t = reponse.replace(/^﻿/, '');
  const bloc = t.match(/```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)(?:```|$)/);
  return bloc && /\{/.test(bloc[1]!) ? bloc[1]! : t;
}

/** JSON.parse tolérant : retire d'abord les virgules en trop. undefined si illisible. */
function lire(morceau: string): unknown {
  try {
    return JSON.parse(sansVirgulesFinales(morceau)) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Index du } ou ] qui ferme le bloc ouvert à `debut` (-1 si le texte s'arrête avant).
 * Les accolades écrites DANS les chaînes ("…{…") ne comptent pas.
 */
function finDuBloc(t: string, debut: number): number {
  let profondeur = 0;
  let dansChaine = false;
  for (let i = debut; i < t.length; i++) {
    const c = t[i];
    if (dansChaine) {
      if (c === '\\') i++;
      else if (c === '"') dansChaine = false;
    } else if (c === '"') dansChaine = true;
    else if (c === '{' || c === '[') profondeur++;
    else if (c === '}' || c === ']') {
      profondeur--;
      if (profondeur === 0) return i;
    }
  }
  return -1;
}

/** Retire les virgules juste avant } ou ] (erreur fréquente des IA), sans toucher aux chaînes. */
export function sansVirgulesFinales(t: string): string {
  let res = '';
  let dansChaine = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (dansChaine) {
      res += c;
      if (c === '\\' && i + 1 < t.length) res += t[++i];
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    if (c === ',' && /^\s*[}\]]/.test(t.slice(i + 1, i + 40))) continue;
    res += c;
  }
  return res;
}
