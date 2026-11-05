// Compte de syllabes approché (français surtout), quand l'IA oublie de le donner ou donne un nombre absurde.
// Groupes de voyelles, moins le « e » muet de fin de mot. Ce n'est qu'une aide : l'oreille décide.

const VOYELLES = /[aeiouyàâäéèêëîïôöùûüÿœæ]+/gi;

export function compterSyllabes(ligne: string): number {
  let total = 0;
  for (const brut of ligne.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüÿœæç'-]+/)) {
    const mot = brut.replace(/^[^a-zàâäéèêëîïôöùûüÿœæç]+|[^a-zàâäéèêëîïôöùûüÿœæç]+$/g, '');
    if (!mot) continue;
    for (const morceau of mot.split(/['-]/)) {
      if (!morceau) continue;
      let n = (morceau.match(VOYELLES) ?? []).length;
      // « e », « es », « ent » muets en fin de mot (« belle », « portes », « chantent ») : pas une syllabe.
      if (n > 1 && /[^aeiouy](e|es|ent)$/.test(morceau)) n--;
      total += n;
    }
  }
  return total;
}
