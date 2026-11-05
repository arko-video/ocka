// Mélodie : 4 notes posées dans la grille (Intro, 1 pas chacune, sur les temps), puis « Pistes séparées ».
// Sans mélodie, le ZIP n'a pas de piste « Mélodie » (une piste muette ne donne pas de fichier) ; avec, la piste
// « Mélodie » n'est pas vide et chaque attaque tombe au bon temps à ±2 ms (le motif de 2 mesures se répète
// 2 fois dans l'Intro de 4 mesures, et l'Intro ne joue qu'une fois).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { attaquesNettes, crete, dossierNeuf, exporterVers, extraire, lireWav, morceauxIdb, nouveauMorceau, zipSain } from './outils-e2e';

const PAS = [0, 4, 8, 12];
const LIGNES = [0, 2, 4, 7]; // do, mi, sol, do aigu (degrés de la gamme)

test('mélodie : 4 notes dans la grille → piste « Mélodie » non vide, attaques aux bons temps (±2 ms)', async ({ page }) => {
  const dossier = dossierNeuf('melodie');
  await nouveauMorceau(page, 'trap');

  // 1. Sans mélodie : pas de piste « Mélodie » dans le ZIP.
  const sans = extraire(await exporterVers(page, 'export-pistes', dossier), 'melodie-sans');
  expect(sans.fichiers.some((f) => f.endsWith('Mélodie.wav'))).toBe(false);

  // 2. Quatre notes dans la grille de l'Intro (section choisie par défaut), durée 1/16.
  await page.getByTestId('onglet-beat').click();
  await page.getByTestId('vue-melodie').click();
  await expect(page.getByTestId('grille-melodie')).toBeVisible();
  await page.getByTestId('duree-1').click();
  for (let k = 0; k < 4; k++) {
    const c = page.getByTestId(`case-${LIGNES[k]}-${PAS[k]}`);
    await c.click();
    await expect(c).toHaveAttribute('data-note', 'seule');
  }

  // 3. Pistes séparées.
  const zip = await exporterVers(page, 'export-pistes', dossier);
  expect(zipSain(zip).ok).toBe(true);
  const avec = extraire(zip, 'melodie-avec');
  const nom = avec.fichiers.find((f) => f.endsWith('Mélodie.wav'));
  expect(nom, avec.fichiers.join(', ')).toBeTruthy();
  const w = lireWav(join(avec.dossier, nom!));
  expect([w.format, w.bits, w.frequence, w.canaux]).toEqual([3, 32, 44100, 2]);
  expect(crete(w)).toBeGreaterThan(0.01);

  // 4. Attaques attendues : Intro en tête, motif de 32 pas répété 2 fois.
  await page.getByTestId('retour').click();
  const [{ m }] = await morceauxIdb(page);
  const intro = m.sections.find((s) => s.id === m.ordre[0])!;
  expect(m.ordre.filter((id) => id === intro.id)).toHaveLength(1);
  const pas = 60 / m.tempo / 4;
  const attendues: number[] = [];
  for (let r = 0; r < (intro.mesures * 16) / 32; r++) for (const p of PAS) attendues.push((r * 32 + p) * pas);
  const mono = w.donnees[0]!.map((x, i) => Math.abs(x) + Math.abs(w.donnees[1]![i]!));
  const trouvees = attaquesNettes(mono, w.frequence, 1e-4);
  const ecarts = attendues.map((t) => Math.min(...trouvees.map((u) => Math.abs(u - t))));
  writeFileSync(join(dossier, 'bilan.json'), JSON.stringify({ attendues, trouvees, ecartsMs: ecarts.map((e) => e * 1000) }, null, 2));
  expect(trouvees).toHaveLength(attendues.length);
  for (const e of ecarts) expect(e).toBeLessThanOrEqual(0.002);
});
