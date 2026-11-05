// Autotune dans Chrome (serveur de dev, modules sources : npx vite --port 5198 --strictPort).
//  1. Temps de calcul d'une prise de 3 min (voix de synthèse, 48 kHz) dans le Worker.
//  2. Parcours des fichiers : prise écrite dans OPFS ocka-prises, autotune à 1 → « auto-<prise>-1.0-A-mineur.f32 »
//     (+ .json), même longueur au bit près ; l'export (lirePcmVoix avec attente) joue la version corrigée.
//  3. Repli : une prise de bruit n'est pas corrigée (description seule, état « repli »).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SORTIES } from './outils';

test.use({ baseURL: 'http://localhost:5198/ocka/' });

test('autotune : 3 min dans le Worker, fichiers dans OPFS, export qui attend, repli sur du bruit', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('./');
  const bilan = await page.evaluate(async () => {
    const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
    const { voixSynthese, bruitBlanc } = await imp('autotune/voix-synthese');
    const auto = await imp('autotune/autotune');
    const opfs = await imp('enregistrement/fichiers-opfs');
    const { nouveauMorceau } = await imp('morceau/styles');
    const tonalite = { tonique: 'A', mode: 'mineur' };

    // 1. 3 min dans le Worker.
    const longue = voixSynthese(180, 48000).pcm as Float32Array;
    const w = new Worker(new URL('/ocka/src/autotune/autotune.worker.ts', location.href), { type: 'module' });
    const t0 = performance.now();
    const r = await new Promise<{ ms: number; applique: boolean; voisees: number; pcm: Float32Array }>((ok) => {
      w.onmessage = (e) => ok(e.data);
      w.postMessage({ pcm: longue.slice(), frequence: 48000, force: 1, tonalite });
    });
    const totalMs = performance.now() - t0;
    w.terminate();

    // 2. Une vraie prise dans OPFS, corrigée puis lue comme le fait l'export.
    const ecrire = async (nom: string, pcm: Float32Array) => {
      const e = await opfs.ouvrirEcriture(nom);
      e.ecrire(pcm);
      await e.fermer();
    };
    const court = voixSynthese(12, 48000).pcm as Float32Array;
    const id = `qa${Date.now().toString(36)}`;
    await ecrire(`prise-${id}.f32`, court);
    const m = nouveauMorceau('trap', 'QA autotune');
    m.tonalite = tonalite;
    const prise = { id: 'p', ancre: { section: m.sections[0].id, occurrence: 0, mesure: 0 }, tempo: m.tempo, fichier: `prise-${id}.f32`, frequence: 48000, duree: 12, debutCoupe: 0, finCoupe: 12, decalage: 0, gain: 1, choisie: true };
    m.prises = [prise];
    m.pistes = m.pistes.map((p: { id: string }) => (p.id === 'voix' ? { ...p, effets: { autotune: 1 } } : p));
    const ecoute = await auto.lirePcmVoix(prise, m, false); // écoute : la prise brute tout de suite
    const exporte = await auto.lirePcmVoix(prise, m, true); // export : attend la correction
    const nom = auto.nomAutotune(prise.fichier, 1, tonalite);
    const fichiers = (await opfs.listerFichiers()).map((f: { nom: string }) => f.nom);

    // 3. Repli sur du bruit.
    await ecrire(`prise-${id}b.f32`, bruitBlanc(5, 48000));
    const pb = { ...prise, fichier: `prise-${id}b.f32`, duree: 5, finCoupe: 5 };
    const repli = await auto.preparerAutotune(pb, 1, tonalite);
    const etatRepli = auto.etatAutotune(auto.nomAutotune(pb.fichier, 1, tonalite));
    return {
      workerMs: Math.round(r.ms),
      allerRetourMs: Math.round(totalMs),
      voisees3min: Math.round(r.voisees * 1000) / 1000,
      applique3min: r.applique,
      longueurIdentique3min: r.pcm.length === longue.length,
      ecouteBrute: !ecoute.version,
      exportVersion: exporte?.version ?? null,
      nomAttendu: nom,
      exportLongueurIdentique: exporte?.pcm.length === court.length,
      fichiersCrees: fichiers.filter((f: string) => f.startsWith(`auto-prise-${id}`)),
      repliNull: repli === null,
      etatRepli,
    };
  });
  writeFileSync(join(SORTIES, 'bilan-autotune.json'), JSON.stringify(bilan, null, 2));
  expect(bilan.applique3min).toBe(true);
  expect(bilan.longueurIdentique3min).toBe(true);
  expect(bilan.ecouteBrute).toBe(true);
  expect(bilan.exportVersion).toBe(bilan.nomAttendu);
  expect(bilan.nomAttendu).toMatch(/^auto-prise-qa\w+-1\.0-A-mineur\.f32$/);
  expect(bilan.exportLongueurIdentique).toBe(true);
  expect(bilan.fichiersCrees.sort()).toEqual([bilan.nomAttendu, bilan.nomAttendu.replace('.f32', '.json')].sort());
  expect(bilan.repliNull).toBe(true);
  expect(bilan.etatRepli?.etat).toBe('repli');
});
