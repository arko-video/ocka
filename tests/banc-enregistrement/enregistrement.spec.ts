// Banc de l'enregistrement et du stockage, dans Chrome avec un faux micro (WAV de clics à 120 BPM).
// Lancer : npx playwright test -c playwright.enregistrement.local.ts   (BANC_BUILD=1 pour tester le build)
import { expect, test, type Page } from '@playwright/test';

type Banc = Record<string, (...args: unknown[]) => Promise<any>>;

async function ouvrir(page: Page): Promise<void> {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('tests/banc-enregistrement/banc.html');
  await expect(page.locator('body[data-pret="oui"]')).toBeAttached({ timeout: 30_000 });
  expect(erreurs).toEqual([]);
}

function appeler(page: Page, nom: string, ...args: unknown[]): Promise<any> {
  return page.evaluate(([n, a]) => ((window as unknown as { banc: Banc }).banc[n as string]!)(...(a as unknown[])), [nom, args] as const);
}

test('calibrage en boucle interne : retrouve un retard connu de 40 ms (±0,1 ms)', async ({ page }) => {
  await ouvrir(page);
  const r = await appeler(page, 'calibrageBoucle', 0.04);
  expect(Math.abs(r.mesure - 0.04)).toBeLessThan(0.0001);
  expect(Math.abs(r.memorisee - 0.04)).toBeLessThan(0.0001);
});

test('prise en boucle interne : après recalage, chaque clic tombe pile sur sa noire (±0,1 ms)', async ({ page }) => {
  await ouvrir(page);
  await appeler(page, 'calibrageBoucle', 0.04); // la latence mémorisée = le retard de la boucle
  const r = await appeler(page, 'priseBoucle', 120, 0.04, 4000);
  // Décompte : le lecteur part une mesure (2 s à 120 BPM) avant l'ancre (Couplet, à 4 s).
  expect(r.journal.slice(0, 4)).toEqual(['boucler@null', 'metronome@true', 'aller@2.000', 'lire@2.000']);
  expect(r.prise.decalage).toBeCloseTo(0.04, 4);
  expect(r.prise.debutCoupe).toBeGreaterThan(1.9);
  expect(r.prise.debutCoupe).toBeLessThan(2.3);
  expect(r.clics.length).toBeGreaterThanOrEqual(7);
  for (const e of r.ecarts) expect(Math.abs(e)).toBeLessThan(0.0001);
  // Le 1er clic après l'ancre tombe au temps de l'ancre ; placerPrise ne joue rien avant elle.
  expect(r.clics.some((t: number) => Math.abs(t - r.ta) < 0.0001)).toBe(true);
  expect(r.place.quand).toBeCloseTo(r.ta, 6);
});

test('prise avec le faux micro : fichier écrit, relu, cohérent', async ({ page }) => {
  await ouvrir(page);
  const r = await appeler(page, 'priseFauxMicro', 120, 3000);
  const p = r.prise;
  expect(p.frequence).toBe(r.sampleRate);
  expect(p.fichier).toMatch(/^prise-[\w]+\.f32$/);
  expect(p.ancre).toEqual({ section: 'couplet', occurrence: 0, mesure: 0 });
  expect(p).toMatchObject({ tempo: 120, gain: 1, choisie: true });
  // Durée ≈ temps d'enregistrement ; le fichier relu a exactement le nombre d'échantillons annoncé.
  expect(p.duree).toBeGreaterThan(2.7);
  expect(p.duree).toBeLessThan(3.6);
  expect(r.echantillonsLus).toBe(Math.round(p.duree * p.frequence));
  expect(r.description).toMatchObject({ format: 'ocka.prise/1', encodage: 'f32le', canaux: 1, frequence: p.frequence });
  // Alignement : debutCoupe = heure de l'ancre − heure du 1er échantillon, ≈ une mesure de décompte.
  expect(p.debutCoupe).toBeCloseTo(r.description.heureAncre - r.description.premierFrame / p.frequence, 9);
  expect(p.debutCoupe).toBeGreaterThan(1.9);
  expect(p.debutCoupe).toBeLessThan(2.3);
  expect(p.finCoupe).toBeCloseTo(p.duree, 9);
  expect(p.decalage).toBeGreaterThanOrEqual(0);
  // Le son du faux micro est bien là : clics réguliers toutes les 0,5 s (à 1 ms près).
  expect(r.crete).toBeGreaterThan(0.3);
  expect(r.niveauMax).toBeGreaterThan(0.3);
  expect(r.clics.length).toBeGreaterThanOrEqual(5);
  // Le faux micro de Chrome livre des tampons de 10 ms ; sous forte charge, il en perd ou en double un
  // (saut de 10 ms pile, en amont de notre capture, qui est exacte : voir le test en boucle interne).
  const ecarts = r.clics.slice(1).map((t: number, i: number) => Math.abs(t - r.clics[i] - 0.5));
  expect(ecarts.filter((e: number) => e < 0.001).length).toBeGreaterThanOrEqual(ecarts.length - 1);
  for (const e of ecarts) expect(e).toBeLessThan(0.0105);
  expect(Array.isArray(r.avertissements)).toBe(true);
  // QA n° 3 : le micro est coupé dès la fin de la prise (voyant éteint).
  expect(r.pistesPendant).toBeGreaterThan(0);
  expect(r.pistesApresArret).toBe(0);
});

test('deux prises avec le même enregistreur : micro coupé après chaque prise, rouvert au démarrage', async ({ page }) => {
  await ouvrir(page);
  const r = await appeler(page, 'deuxPrises');
  // créé (vumètre) → 1re prise → arrêt → 2e prise → arrêt → détruit
  expect(r.etapes).toEqual([1, 1, 0, 1, 0, 0]);
  for (const d of r.durees) expect(d).toBeGreaterThan(2.3);
});

test('calibrage avec le faux micro (il n’entend pas le chirp) : erreur « signal_faible »', async ({ page }) => {
  await ouvrir(page);
  expect(await appeler(page, 'calibrageFauxMicro')).toBe('signal_faible');
});

test('Mes morceaux : sauver, lister, ouvrir, dupliquer, supprimer, nettoyer, puis rechargement', async ({ page }) => {
  await ouvrir(page);
  const { prise } = await appeler(page, 'priseFauxMicro', 120, 2800);
  const orpheline = await appeler(page, 'priseFauxMicro', 120, 2600); // jamais sauvée
  const r = await appeler(page, 'parcoursStockage', prise);
  expect(r.liste1[0]).toMatchObject({ id: r.id, titre: 'Mon son', style: 'trap', duree: 12 });
  // Le normaliseur peut arrondir les temps : on compare à 0,1 ms près.
  expect(r.ouvertPrise.fichier).toBe(prise.fichier);
  expect(Math.abs(r.ouvertPrise.debutCoupe - prise.debutCoupe)).toBeLessThan(0.0001);
  expect(Math.abs(r.ouvertPrise.decalage - prise.decalage)).toBeLessThan(0.0001);
  expect(r.titreCopie).toBe('Mon son (copie)');
  expect(r.fichierCopie).not.toBe(prise.fichier);
  expect(r.longueurCopie).toBe(Math.round(prise.duree * prise.frequence));
  // QA n° 5 : duplication tout ou rien.
  expect(r.codeEchec).toBe('duplication_impossible');
  expect(r.echecSansDoublon).toBe(true);
  // QA n° 2 : supprimer ne touche pas au fichier ; le ramasse-miettes l'efface ensuite.
  expect(r.originalGarde).toBe(true);
  expect(r.originalEfface).toBe(true);
  expect(r.copieToujoursLa).toBe(true);
  expect(r.absent).toBeNull();
  expect(r.fichiersAvant).toContain(orpheline.prise.fichier);
  expect(r.fichiersApres).not.toContain(orpheline.prise.fichier);
  expect(r.fichiersApres).toContain(r.fichierCopie);
  expect(r.liste2.map((m: { id: string }) => m.id)).toEqual([r.idCopie]);
  // Rechargement de la page : le morceau revient.
  await page.reload();
  await expect(page.locator('body[data-pret="oui"]')).toBeAttached();
  const apres = await appeler(page, 'listerMorceaux');
  expect(apres.map((m: { id: string }) => m.id)).toEqual([r.idCopie]);
  const rouvert = await appeler(page, 'ouvrirMorceau', r.idCopie);
  expect(rouvert.prises[0].fichier).toBe(r.fichierCopie);
});
