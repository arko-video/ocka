// Mise en forme des nombres et des dates pour l'interface (fonctions pures).

/** 75,4 → « 1:15 ». */
export function mmss(t: number): string {
  const s = Math.max(0, Math.floor(t + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Date courte : « aujourd'hui 14:05 », « hier », « 3 nov. ». */
export function dateCourte(ms: number, maintenant = Date.now()): string {
  const d = new Date(ms);
  const auj = new Date(maintenant);
  const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (memeJour(d, auj)) return `aujourd’hui ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const hier = new Date(maintenant - 86_400_000);
  if (memeJour(d, hier)) return 'hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** −14,02 → « −14,0 » (signe moins typographique, virgule). */
export function nombre(x: number, decimales = 1): string {
  return x.toFixed(decimales).replace('-', '−').replace('.', ',');
}

/** Nom de fichier sûr à partir du titre. */
export function nomFichier(titre: string, extension: string): string {
  const base =
    titre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'morceau';
  return `${base}.${extension}`;
}
