// Test nul de la v2 : le corpus « /2 » (tests/qa/corpus-v2.ts) rendu par le code COURANT doit sonner comme ses
// rendus de référence, faits par OCKA v1 (copie figée /home/claude/ocka/snapshot-v1) avant tout changement de son.
// Pistes séparées (avant le master, flottant 32 bits) : ≤ −90 dB pour la batterie, la 808 et la voix ;
// les autres pistes et le mix (WAV 24 bits, master et réglage de sonie compris) : ≤ −80 dB (limite de Chrome).
// La mélodie /2 devient en /3 les pistes « Mélodie », « Mélodie 2 »… : leur somme est comparée à l'ancienne.
//
// Refaire les références (seulement avec le code v1 !) : OCKA_REFERENCES=generer npx playwright test \
//   -c tests/qa/playwright.qa.config.ts test-nul-v2   (build de snapshot-v1 servi sur le port 4196).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { construireCorpus, ecart, lireWavStereo, REFERENCES, SNAPSHOT_V1, somme, type Brut, type ElementCorpus, type FichierOpfs } from './corpus-v2';
import { ecrireMorceauIdb, morceauxIdb, SORTIES } from './outils';

const GENERER = process.env.OCKA_REFERENCES === 'generer';
const PORT_V1 = 4196;
/** Pistes à −90 dB (noms des fichiers de pistes séparées) ; les autres à −80 dB. */
const STRICTES = ['Batterie', 'Basse', 'Voix'];

async function poserFichier(page: Page, f: FichierOpfs) {
  const b64 = Buffer.from(f.pcm.buffer, f.pcm.byteOffset, f.pcm.byteLength).toString('base64');
  await page.evaluate(
    async ([dossier, nom, donnees]) => {
      const bin = atob(donnees);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const d = await (await navigator.storage.getDirectory()).getDirectoryHandle(dossier, { create: true });
      const w = await (await d.getFileHandle(nom, { create: true })).createWritable();
      await w.write(u);
      await w.close();
    },
    [f.dossier, f.nom, b64] as const,
  );
}

/** Lance un export (bouton `testid`) du morceau ouvert, et enregistre le fichier à `chemin`. */
async function telecharger(page: Page, testid: string, chemin: string) {
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId(testid).click();
  await expect(page.getByTestId('export-resultat')).toBeVisible({ timeout: 600_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('telecharger').click()]);
  await dl.saveAs(chemin);
}

/** Vide les exports déjà faits (OPFS ocka-exports, ocka-tmp) : le quota d'un contexte de test est petit. */
async function viderExports(page: Page) {
  await page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    for (const nom of ['ocka-exports', 'ocka-tmp']) await racine.removeEntry(nom, { recursive: true }).catch(() => {});
  });
}

async function ouvrir(page: Page, base: string) {
  await page.goto(base);
  await page.getByTestId('ouvrir-morceau').first().click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
}

/** Rend un élément du corpus : `<dossier>/<nom>-mix.wav` et `<dossier>/<nom>-pistes/<Piste>.wav`. */
async function rendre(page: Page, base: string, id: string, el: ElementCorpus, dossier: string) {
  await page.goto(base);
  await viderExports(page);
  await ecrireMorceauIdb(page, id, el.morceau);
  for (const f of el.fichiers) await poserFichier(page, f);
  await ouvrir(page, base);
  await page.getByTestId('onglet-exporter').click();
  await expect(page.getByTestId('export-titre')).toHaveValue(el.morceau.titre as string);
  await telecharger(page, 'exporter-wav', join(dossier, `${el.nom}-mix.wav`));
  await viderExports(page);
  await ouvrir(page, base);
  const zip = join(dossier, `${el.nom}-pistes.zip`);
  await telecharger(page, 'export-pistes', zip);
  const sortie = join(dossier, `${el.nom}-pistes`);
  rmSync(sortie, { recursive: true, force: true });
  mkdirSync(sortie, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zip, '-d', sortie]);
  rmSync(zip);
  // « Corpus trap - Batterie.wav » → « Batterie.wav ».
  for (const f of readdirSync(sortie)) renameSync(join(sortie, f), join(sortie, f.slice(f.lastIndexOf(' - ') + 3)));
}

/** Un morceau neuf dans la base (son id sert de place pour chaque élément du corpus). */
async function place(page: Page, base: string): Promise<string> {
  await page.goto(base);
  const avant = new Set((await morceauxIdb(page)).map((x) => x.id));
  await page.getByTestId('nouveau-morceau').click();
  await page.getByTestId('style-trap').click();
  await expect(page.getByTestId('ecran-beat')).toBeVisible();
  await page.getByTestId('retour').click();
  // La sauvegarde du morceau neuf peut arriver juste après le retour : on l'attend.
  let id: string | undefined;
  await expect.poll(async () => (id = (await morceauxIdb(page)).find((x) => !avant.has(x.id))?.id), { timeout: 15_000 }).toBeTruthy(); // (défaut 5 s : trop court après les scénarios mémoire)
  return id!;
}

function lireCorpus(): ElementCorpus[] {
  const liste = JSON.parse(readFileSync(join(REFERENCES, 'corpus.json'), 'utf8')) as { nom: string; fichiers: { dossier: FichierOpfs['dossier']; nom: string }[] }[];
  return liste.map((x) => ({
    nom: x.nom,
    morceau: JSON.parse(readFileSync(join(REFERENCES, `${x.nom}.json`), 'utf8')) as Brut,
    fichiers: x.fichiers.map((f) => {
      const b = readFileSync(join(REFERENCES, f.nom));
      return { ...f, pcm: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) };
    }),
  }));
}

test('test nul v2 : corpus /2 rendu par le code courant = rendus de référence d’OCKA v1', async ({ page }) => {
  test.setTimeout(3_600_000);
  if (GENERER) {
    if (!existsSync(join(SNAPSHOT_V1, 'dist', 'index.html'))) execFileSync('npx', ['vite', 'build'], { cwd: SNAPSHOT_V1 });
    const serveur = spawn(join(SNAPSHOT_V1, 'node_modules', '.bin', 'vite'), ['preview', '--port', String(PORT_V1), '--strictPort'], { cwd: SNAPSHOT_V1, stdio: 'ignore' });
    try {
      const base = `http://localhost:${PORT_V1}/ocka/`;
      await expect.poll(async () => (await page.request.get(base).catch(() => null))?.ok() ?? false, { timeout: 30_000 }).toBe(true);
      const bases: Record<string, Brut> = {};
      for (const style of ['trap', 'drill', 'lofi', 'phonk', 'pop', 'boombap']) {
        await page.goto(base);
        await page.getByTestId('nouveau-morceau').click();
        await page.getByTestId(`style-${style}`).click();
        await expect(page.getByTestId('ecran-beat')).toBeVisible();
        await page.getByTestId('retour').click();
        bases[style] = (await morceauxIdb(page)).map((x) => x.m as Brut).find((m) => m.style === style)!;
      }
      const corpus = construireCorpus(bases);
      mkdirSync(REFERENCES, { recursive: true });
      const id = await place(page, base);
      for (const el of corpus) {
        writeFileSync(join(REFERENCES, `${el.nom}.json`), JSON.stringify(el.morceau, null, 1));
        for (const f of el.fichiers) writeFileSync(join(REFERENCES, f.nom), new Uint8Array(f.pcm.buffer));
        await rendre(page, base, id, el, REFERENCES);
      }
      writeFileSync(join(REFERENCES, 'corpus.json'), JSON.stringify(corpus.map((el) => ({ nom: el.nom, fichiers: el.fichiers.map(({ dossier, nom }) => ({ dossier, nom })) })), null, 1));
    } finally {
      serveur.kill();
    }
    return;
  }

  const corpus = lireCorpus();
  const dossier = join(SORTIES, 'test-nul-v2');
  mkdirSync(dossier, { recursive: true });
  const id = await place(page, './');
  const bilan: Record<string, Record<string, unknown>> = {};
  const echecs: string[] = [];
  for (const el of corpus) {
    await rendre(page, './', id, el, dossier);
    const b: Record<string, unknown> = {};
    const mix = ecart(lireWavStereo(join(REFERENCES, `${el.nom}-mix.wav`)), lireWavStereo(join(dossier, `${el.nom}-mix.wav`)));
    b.mix = mix;
    if (!(mix.ecartDb <= -80) || mix.decalage !== 0 || mix.trames[0] !== mix.trames[1]) echecs.push(`${el.nom} mix ${JSON.stringify(mix)}`);
    const anciennes = readdirSync(join(REFERENCES, `${el.nom}-pistes`));
    const nouvelles = readdirSync(join(dossier, `${el.nom}-pistes`));
    for (const f of anciennes) {
      const nom = f.replace(/\.wav$/, '');
      const memes = nouvelles.filter((n) => n === f || (nom === 'Mélodie' && /^Mélodie \d+\.wav$/.test(n)));
      if (memes.length === 0) {
        echecs.push(`${el.nom} : la piste ${nom} manque`);
        continue;
      }
      const e = ecart(lireWavStereo(join(REFERENCES, `${el.nom}-pistes`, f)), somme(memes.map((n) => join(dossier, `${el.nom}-pistes`, n))));
      b[nom] = e;
      const seuil = STRICTES.includes(nom) ? -90 : -80;
      if (!(e.ecartDb <= seuil) || e.decalage !== 0 || e.trames[0] !== e.trames[1]) echecs.push(`${el.nom} ${nom} ${JSON.stringify(e)}`);
    }
    const enTrop = nouvelles.filter((n) => !anciennes.includes(n) && !/^Mélodie \d+\.wav$/.test(n));
    if (enTrop.length > 0) echecs.push(`${el.nom} : pistes en trop ${enTrop.join(', ')}`);
    bilan[el.nom] = b;
  }
  writeFileSync(join(SORTIES, 'bilan-test-nul-v2.json'), JSON.stringify(bilan, null, 2));
  expect(echecs).toEqual([]);
});
