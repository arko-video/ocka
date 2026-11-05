// Test nul contre le code d'avant la vague A (/home/claude/ocka/snapshot-phase1, copie figée, jamais modifiée) :
// le morceau trap des QA (chaîne 1, sans mélodie) rendu par les deux versions doit être identique, à la limite de
// reproductibilité de Chrome près (≤ −70 dB), avec la même sonie (±0,1 LU).
// 1. Le build de la phase 1 (fait une fois dans sorties/phase1-dist) est servi sur le port 4195 : trap → WAV 24 bits.
// 2. Le morceau tel que la phase 1 l'a sauvé (base « keyval-store ») est recopié dans le nouveau build, à l'ancien
//    endroit : la migration d'A2 le déplace, le normaliseur le lit en chaîne 1. Puis WAV 24 bits.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { comparerWav } from './comparer';
import { analyserWav, ecrireMorceauIdb, exporter, morceauxIdb, SORTIES } from './outils';

const SNAPSHOT = join(SORTIES, '..', '..', '..', '..', 'snapshot-phase1');
const DIST = join(SORTIES, 'phase1-dist');
const PORT = 4195;
const REFERENCES = join(SNAPSHOT, '..', 'references-phase1');

/** Toutes les entrées de « keyval-store » (base par défaut d'idb-keyval) dont la clé commence par « ocka. ». */
function lireAncienneBase(page: Page): Promise<[string, unknown][]> {
  return page.evaluate(
    () =>
      new Promise<[string, unknown][]>((ok, ko) => {
        const q = indexedDB.open('keyval-store');
        q.onerror = () => ko(q.error);
        q.onsuccess = () => {
          const out: [string, unknown][] = [];
          const c = q.result.transaction('keyval').objectStore('keyval').openCursor();
          c.onsuccess = () => {
            if (!c.result) return (q.result.close(), ok(out));
            if (String(c.result.key).startsWith('ocka.')) out.push([String(c.result.key), c.result.value]);
            c.result.continue();
          };
        };
      }),
  );
}

type Brut = { format: string; master: { chaine?: number }; pistes: { id: string; muet: boolean }[] };

/** Variantes rendues : le mix, puis chaque instrument seul (les autres pistes en muet). */
const VARIANTES = [
  { nom: 'mix', seule: null },
  { nom: 'batterie', seule: 'batterie' },
  { nom: 'basse', seule: 'basse' },
  { nom: 'accords', seule: 'accords' },
] as const;

function variante(m: Brut, seule: string | null): Brut {
  const c = JSON.parse(JSON.stringify(m)) as Brut;
  if (seule) for (const p of c.pistes) p.muet = p.id !== seule;
  return c;
}

/** Écrit un morceau dans la base de la phase 1 (« keyval-store », clé « ocka.morceau.<id> ») de la page courante. */
function ecrireAncienneBase(page: Page, es: [string, unknown][]): Promise<void> {
  return page.evaluate(
    (x) =>
      new Promise<void>((ok, ko) => {
        const q = indexedDB.open('keyval-store');
        q.onupgradeneeded = () => q.result.createObjectStore('keyval');
        q.onerror = () => ko(q.error);
        q.onsuccess = () => {
          const tx = q.result.transaction('keyval', 'readwrite');
          for (const [k, v] of x) tx.objectStore('keyval').put(v, k);
          tx.oncomplete = () => (q.result.close(), ok());
        };
      }),
    es,
  );
}

test('test nul : trap (chaîne 1, sans mélodie) rendu par la phase 1 et par la vague A, ≤ −70 dB, ±0,1 LU', async ({ page }) => {
  test.setTimeout(1_200_000);
  if (!existsSync(join(DIST, 'index.html'))) {
    execFileSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { encoding: 'utf8', cwd: SNAPSHOT } as never);
  }
  const serveur = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: SNAPSHOT, stdio: 'ignore' });
  const fichiers: Record<string, [string, string]> = {};
  try {
    // 1. Phase 1 : trap neuf, puis chaque variante (écrite dans sa base, page rechargée).
    const ancien = `http://localhost:${PORT}/ocka/`;
    await expect.poll(async () => (await page.request.get(ancien).catch(() => null))?.ok() ?? false, { timeout: 30_000 }).toBe(true);
    await page.goto(ancien);
    await page.getByTestId('nouveau-morceau').click();
    await page.getByTestId('style-trap').click();
    await expect(page.getByTestId('ecran-beat')).toBeVisible();
    await page.getByTestId('retour').click();
    await expect(page.getByTestId('liste-morceaux')).toBeVisible();
    const entrees = await lireAncienneBase(page);
    expect(entrees.length).toBe(2); // ocka.index + ocka.morceau.<id>
    const [cle, brut] = entrees.find(([k]) => k.startsWith('ocka.morceau.')) as [string, Brut];
    const id = cle.slice('ocka.morceau.'.length);
    for (const v of VARIANTES) {
      await ecrireAncienneBase(page, [[cle, variante(brut, v.seule)]]);
      await page.goto(ancien);
      await page.getByTestId('ouvrir-morceau').first().click();
      fichiers[v.nom] = [(await exporter(page, `qa-nul-phase1-${v.nom}`)).chemin, ''];
    }

    // 2. Vague A. Un vrai fichier de la phase 1 est en version 1, sans master.chaine (la copie figée, faite après la
    //    tâche « contrat », écrit déjà la version 2 et chaine = 2, mais son master est encore celui de la phase 1).
    //    Il est posé à l'ancien endroit avant le premier lancement (page sans script de l'origine) : la migration
    //    d'A2 le déplace tel quel, le normaliseur le lit en chaîne 1.
    const v1 = JSON.parse(JSON.stringify(brut)) as Brut;
    v1.format = 'ocka.morceau/1';
    delete v1.master.chaine;
    await page.goto('./manifest.webmanifest');
    await ecrireAncienneBase(page, entrees.map(([k, v]) => [k, k === cle ? v1 : v] as [string, unknown]));
    await page.goto('./');
    await page.getByTestId('ouvrir-morceau').first().click();
    const [{ m }] = await morceauxIdb(page);
    expect((m as unknown as Brut).master.chaine).toBeUndefined();
    await page.getByTestId('onglet-son').click();
    await expect(page.getByTestId('ancien-son')).toBeVisible(); // chaîne 1 : « l'ancien son » est proposé
    for (const v of VARIANTES) {
      await ecrireMorceauIdb(page, id, variante(v1, v.seule));
      await page.goto('./');
      await page.getByTestId('ouvrir-morceau').first().click();
      fichiers[v.nom]![1] = (await exporter(page, `qa-nul-vague-a-${v.nom}`)).chemin;
    }
  } finally {
    serveur.kill();
  }

  // 3. Comparaison, variante par variante (chaque export est réglé à −14 LUFS : on compare aussi la sonie).
  const bilan: Record<string, unknown> = {};
  for (const v of VARIANTES) {
    const [a, b] = fichiers[v.nom]!;
    const ia = analyserWav(a);
    const ib = analyserWav(b);
    bilan[v.nom] = { ...comparerWav(a, b), lufs: [ia.lufs, ib.lufs], crete: [ia.creteVraie, ib.creteVraie] };
  }
  const reference = join(REFERENCES, 'qa-trap.wav');
  bilan.phase1ContreReference = existsSync(reference) ? comparerWav(reference, fichiers.mix![0]) : null;
  writeFileSync(join(SORTIES, 'bilan-test-nul.json'), JSON.stringify(bilan, null, 2));
  for (const v of VARIANTES) {
    const c = bilan[v.nom] as ReturnType<typeof comparerWav> & { lufs: number[] };
    expect(c.trames[0], v.nom).toBe(c.trames[1]);
    expect(c.decalage, v.nom).toBe(0);
    expect(Math.abs(c.lufs[0]! - c.lufs[1]!), v.nom).toBeLessThanOrEqual(0.1);
    expect(c.ecartDb, v.nom).toBeLessThanOrEqual(-70);
  }
});
