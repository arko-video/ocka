// Mémoire : 12 exports FLAC de suite d'un morceau de 3 min (« Préparer le dossier » d'une sortie d'un titre, FLAC 16 bits
// rendu directement dans le ZIP). Après chaque export : alerte mémoire « critique » (caches purgeables vidés, comme
// Android quand la RAM manque), ramasse-miettes forcé, puis tas JS de la page (CDP) et mémoire de tous les processus
// de ce Chrome (RSS). Ni l'un ni l'autre ne doit monter.
// Historique : tant qu'un AudioWorklet était chargé dans chaque OfflineAudioContext, Chrome ne libérait jamais ces
// contextes (~64 Mo retenus par titre de 3 min, +100 Mo par export avec la pochette décodée). Depuis la vague B, aucun
// worklet hors ligne (master en JS : moteur/audio/master-hors-ligne.ts) : mesuré +2 Mo par export (bruit), 4 nov. 2026.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ecrireMorceauIdb, morceauxIdb, nouveau, SORTIES } from './outils';

/** RSS (Mo) du Chrome de ce test : le processus lancé avec le faux micro de la QA, et tous ses descendants. */
function memoireChrome(): number {
  return Object.values(memoireParType()).reduce((a, b) => a + b, 0);
}

/** La même mémoire, par type de processus (browser, renderer, gpu-process, utility…), en Mo. */
function memoireParType(): Record<string, number> {
  const lignes = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,args='], { encoding: 'utf8' })
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l))
    .filter((x): x is RegExpExecArray => !!x)
    .map((x) => ({ pid: x[1]!, ppid: x[2]!, rss: Number(x[3]), args: x[4]! }));
  const pids = new Set(lignes.filter((l) => l.args.includes('clics-qa.wav') && !l.args.includes('--type=')).map((l) => l.pid));
  let avant = -1;
  while (pids.size !== avant) {
    avant = pids.size;
    for (const l of lignes) if (pids.has(l.ppid)) pids.add(l.pid);
  }
  const parType: Record<string, number> = {};
  for (const l of lignes) {
    if (!pids.has(l.pid)) continue;
    const type = (/--type=(\S+)/.exec(l.args)?.[1] ?? 'browser') + (/--utility-sub-type=(\S+)/.exec(l.args)?.[1] ? `:${/--utility-sub-type=(\S+)/.exec(l.args)![1]}` : '');
    parType[type] = (parType[type] ?? 0) + Math.round(l.rss / 1024);
  }
  return parType;
}

/** Tas JS de la page (Mo) après un ramasse-miettes forcé. */
async function tasJs(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  // Alerte mémoire « critique » (comme Android quand la RAM manque) : Chrome vide ses caches purgeables, dont les
  // images décodées (la pochette 3000 px de « Vérifier », ~36 Mo à chaque retour), avant la mesure.
  await cdp.send('Memory.simulatePressureNotification', { level: 'critical' }).catch(() => {});
  await page.waitForTimeout(300);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
  await cdp.detach();
  return Math.round(usedSize / 1e5) / 10;
}

/** Morceau trap de 3 min (Intro 9 + 6 × 16 mesures à 140 BPM = 180 s), comme le scénario de performance. */
async function morceau3min(page: Page) {
  await nouveau(page, 'trap');
  await page.getByTestId('retour').click();
  const [{ id, m }] = await morceauxIdb(page);
  const [intro, couplet, refrain, ...autres] = m.ordre;
  const sections = m.sections.map((s) => ({ ...s, mesures: s.id === intro ? 9 : 16 }));
  await ecrireMorceauIdb(page, id, { ...m, sections, ordre: [intro, couplet, refrain, couplet, refrain, refrain, autres.at(-1)!] });
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
}

/** Assistant de sortie rempli jusqu'à « Vérifier » sans problème bloquant (vrai nom, gros mots, IA, pochette). */
async function sortiePrete(page: Page) {
  await page.getByTestId('onglet-exporter').click();
  await page.getByTestId('sortir-spotify').click();
  await page.getByTestId('vrai-nom').fill('Romain Testeur');
  await page.getByTestId('vrai-nom-valider').click();
  await page.getByTestId('sortie-artiste').fill('Ocka QA');
  const p = page.getByTestId('panneau-titre');
  await p.getByTestId('explicite-non').click();
  for (const partie of ['paroles', 'musique', 'voix']) await p.getByTestId(`ia-${partie}-aucune`).click();
  await page.getByTestId('sortie-suivant').click();
  await page.getByTestId('pochette-fabriquer').click();
  await page.getByTestId('pochette-modele-0').click();
  await expect(page.getByTestId('pochette-apercu')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('sortie-suivant').click();
  await expect(page.getByTestId('sortie-prete')).toBeVisible();
}

test('mémoire : 12 exports FLAC de 3 min de suite, ni le tas JS ni la mémoire de Chrome ne montent sans fin', async ({ page }) => {
  test.setTimeout(1_500_000);
  await morceau3min(page);
  await sortiePrete(page);
  const mesures: { n: number; ms: number; tasMo: number; chromeMo: number; parType: Record<string, number> }[] = [
    { n: 0, ms: 0, tasMo: await tasJs(page), chromeMo: memoireChrome(), parType: memoireParType() },
  ];
  for (let n = 1; n <= 12; n++) {
    if (n > 1) {
      // Le résultat précédent est oublié dès que la sortie change : on change son genre (pas le morceau), puis on revient.
      await page.getByTestId('etape-infos').click();
      await page.getByTestId('sortie-genre').selectOption({ index: 1 + (n % 2) });
      await page.getByTestId('etape-verifier').click();
    }
    const t0 = Date.now();
    await page.getByTestId('preparer-dossier').click();
    await expect(page.getByTestId('dossier-pret')).toBeVisible({ timeout: 240_000 });
    mesures.push({ n, ms: Date.now() - t0, tasMo: await tasJs(page), chromeMo: memoireChrome(), parType: memoireParType() });
  }
  const base = (k: 'tasMo' | 'chromeMo') => Math.max(...mesures.slice(1, 4).map((x) => x[k]));
  const fin = (k: 'tasMo' | 'chromeMo') => Math.max(...mesures.slice(-3).map((x) => x[k]));
  // Pente (Mo par export) par moindres carrés sur les exports 3 à 12.
  const pente = (k: 'tasMo' | 'chromeMo') => {
    const xs = mesures.slice(3);
    const mx = xs.reduce((a, x) => a + x.n, 0) / xs.length;
    const my = xs.reduce((a, x) => a + x[k], 0) / xs.length;
    return Math.round((xs.reduce((a, x) => a + (x.n - mx) * (x[k] - my), 0) / xs.reduce((a, x) => a + (x.n - mx) ** 2, 0)) * 10) / 10;
  };
  const tamponRenduMo = Math.round((180 * 44100 * 2 * 4) / 1e6 / 1.048576);
  const bilan = {
    mesures,
    tasMo: { base: base('tasMo'), fin: fin('tasMo'), pente: pente('tasMo') },
    chromeMo: { base: base('chromeMo'), fin: fin('chromeMo'), pente: pente('chromeMo'), tamponRenduMo },
  };
  writeFileSync(join(SORTIES, 'bilan-memoire.json'), JSON.stringify(bilan, null, 2));
  // Tas JS : plat (après le régime établi des exports 1 à 3, les 3 derniers ne le dépassent que de peu).
  expect(bilan.tasMo.fin - bilan.tasMo.base).toBeLessThan(15);
  expect(bilan.tasMo.pente).toBeLessThan(0.5);
  // Mémoire de Chrome : plate. Mesuré : pente +2 Mo par export, fin − base −7 Mo (avant la vague B : +100 Mo par
  // export). Marge : moins d'un sixième du tampon de rendu d'un titre (61 Mo) par export.
  expect(bilan.chromeMo.pente).toBeLessThan(10);
  expect(bilan.chromeMo.fin - bilan.chromeMo.base).toBeLessThan(80);
});

// Album : « Préparer le dossier » d'une sortie de 12 titres de 3 min (exporterDossierSortie), sur le serveur de dev
// (modules sources : npx vite --port 5198 --strictPort). Mémoire de Chrome avant, PENDANT (crête, relevée toutes les
// 0,5 s) et après. « avant » = l'ancien chemin (worklet chargé dans chaque contexte hors ligne, optionsMaster),
// « après » = master en JS. Chaque cas dans une page neuve.
test.describe('album', () => {
  test.use({ baseURL: 'http://localhost:5198/ocka/' });
  test('mémoire : dossier de sortie de 12 titres de 3 min (master JS contre worklet)', async ({ page }) => {
    test.setTimeout(1_800_000);
    await morceau3min(page);
    await sortiePrete(page);
    await page.getByTestId('retour').click().catch(() => {});
    const bilan: Record<string, { ms: number; avantMo: number; creteMo: number; apresMo: number; tasMo: number; parType: Record<string, number>[] }> = {};
    for (const [nom, worklet] of [['apres', false], ['avant', true]] as const) {
      await page.goto('./');
      await page.waitForTimeout(1000);
      await tasJs(page);
      const avantMo = memoireChrome();
      const typeAvant = memoireParType();
      let creteMo = avantMo;
      const releve = setInterval(() => (creteMo = Math.max(creteMo, memoireChrome())), 500);
      const ms = await page.evaluate(async (w) => {
        const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
        const api = await imp('moteur/api');
        (await imp('moteur/master')).optionsMaster.workletHorsLigne = w;
        const [r] = await api.listerSorties();
        const sortie = await api.ouvrirSortie(r.id);
        const ids: string[] = [sortie.titres[0]];
        const tous = (await api.listerMorceaux()) as { id: string }[];
        for (const m of tous) if (!ids.includes(m.id) && ids.length < 12) ids.push(m.id);
        while (ids.length < 12) ids.push(await api.dupliquerMorceau(ids[0]));
        const s = await api.sauverSortie({ ...sortie, titres: ids });
        const t0 = performance.now();
        await api.exporterDossierSortie(s, { format: 'flac16' });
        return performance.now() - t0;
      }, worklet);
      clearInterval(releve);
      await page.waitForTimeout(2000);
      const tasMo = await tasJs(page); // purge les caches avant de mesurer
      bilan[nom] = { ms: Math.round(ms), avantMo, creteMo, apresMo: memoireChrome(), tasMo, parType: [typeAvant, memoireParType()] };
    }
    writeFileSync(join(SORTIES, 'bilan-memoire-album.json'), JSON.stringify(bilan, null, 2));
    // Mesuré (4 nov. 2026) : master JS, l'onglet (renderer) +13 Mo après l'album, crête de tout Chrome +336 Mo ;
    // ancien chemin (worklet) : onglet +819 Mo. (Le processus « browser » garde ~195 Mo une fois, après la 1re
    // écriture du ZIP de ~300 Mo dans OPFS : il ne remonte pas au 2e album.)
    const onglet = (b: (typeof bilan)[string]) => b.parType[1]!.renderer! - b.parType[0]!.renderer!;
    expect(onglet(bilan.apres!)).toBeLessThan(60);
    expect(bilan.apres!.creteMo - bilan.apres!.avantMo).toBeLessThan(500);
    expect(onglet(bilan.avant!) - onglet(bilan.apres!)).toBeGreaterThan(500); // le remède compte vraiment
  });
});
