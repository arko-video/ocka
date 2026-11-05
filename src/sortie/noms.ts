// Noms de fichiers du dossier de sortie, sûrs pour Windows, macOS, Android et les distributeurs (pur). Propriétaire : A1.
// On garde les accents (UTF-8 dans le ZIP), on retire ce que Windows refuse : < > : " / \ | ? * et les caractères
// de contrôle, l'espace ou le point final, les noms réservés (CON, NUL, COM1…), et on coupe à une longueur raisonnable.

const INTERDITS = /[<>:"|?*\u0000-\u001f\u007f]/g;
const RESERVES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/** Coupe à `max` caractères sans casser un emoji (paires de substitution). */
function couper(s: string, max: number): string {
  const car = Array.from(s);
  return car.length <= max ? s : car.slice(0, max).join('');
}

/**
 * Un morceau de nom de fichier sûr : « Nuit / Jour » → « Nuit - Jour », « Ça va? » → « Ça va ».
 * `secours` si rien ne reste.
 */
export function nomSur(brut: string, max = 60, secours = 'Sans titre'): string {
  let s = (brut ?? '')
    .normalize('NFC')
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/[/\\]/g, '-')
    .replace(INTERDITS, '')
    .replace(/\s+/g, ' ')
    .trim();
  s = couper(s, max).replace(/[ .]+$/g, '').replace(/^[ .]+/g, '');
  if (!s) return secours;
  if (RESERVES.test(s)) s = `${s}_`;
  return s;
}

/** Numéro de piste sur 2 chiffres : 0 → « 01 ». */
export function numero(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** « 01 - Nuit.flac » (le titre complet, featuring compris, rendu sûr). */
export function nomTitre(index: number, titre: string, extension: string): string {
  return `${numero(index)} - ${nomSur(titre, 60)}.${extension}`;
}

/** « Romain - Nuit (sortie).zip ». */
export function nomZip(artiste: string, titre: string): string {
  return `${nomSur(artiste, 40, 'Artiste')} - ${nomSur(titre, 60)} (sortie).zip`;
}

/** Titre affiché partout (fiche, fichiers) : « Nuit (feat. Léa) ». */
export function titreComplet(titre: string, featuring?: string): string {
  const t = titre.trim();
  const f = featuring?.trim();
  return f ? `${t} (feat. ${f})` : t;
}
