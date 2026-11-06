// Autotune avancé dans Chrome (serveur de dev, modules sources : npx vite --port 5223 --strictPort).
//  1. Une prise de 3 min (voix de synthèse, 48 kHz) dans OPFS : analyse en notes (Worker), rendu complet (Pop),
//     puis UNE note déplacée de 2 demi-tons : recalcul partiel (seule la note ±100 ms), temps mesurés.
//  2. L'export (lirePcmVoix avec attente) joue le rendu avancé dès que Prise.autotune existe ; le ménage le garde.
//  3. Annuler une analyse : erreur « annule », et le Worker repart au calcul suivant.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SORTIES } from './outils';

test.use({ baseURL: 'http://localhost:5223/ocka/' });

test('autotune avancé : 3 min analysées et rendues dans le Worker, recalcul d’une note, export, annulation', async ({ page }) => {
  test.setTimeout(300_000);
  // Client de Vite remplacé par un bouchon : un fichier modifié ailleurs ne recharge pas la page pendant la mesure.
  await page.route('**/@vite/client', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: 'export const createHotContext = () => ({ accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {}, data: {} }); export const updateStyle = () => {}; export const removeStyle = () => {}; export const injectQuery = (u) => u; export const ErrorOverlay = class {};',
    }),
  );
  await page.goto('./icones/icone-192.png');
  const bilan = await page.evaluate(async () => {
    const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
    const { voixSynthese } = await imp('autotune/voix-synthese');
    const api = await imp('autotune/api-autotune');
    const auto = await imp('autotune/autotune');
    const opfs = await imp('enregistrement/fichiers-opfs');
    const { nouveauMorceau } = await imp('morceau/styles');
    const tonalite = { tonique: 'A', mode: 'mineur' };
    const ecrire = async (nom: string, pcm: Float32Array) => {
      const e = await opfs.ouvrirEcriture(nom);
      e.ecrire(pcm);
      await e.fermer();
    };
    const id = `qa${Date.now().toString(36)}`;
    const longue = voixSynthese(180, 48000).pcm as Float32Array;
    await ecrire(`prise-${id}.f32`, longue);
    const m = nouveauMorceau('trap', 'QA autotune avancé');
    m.tonalite = tonalite;
    const prise = { id: 'p', ancre: { section: m.sections[0].id, occurrence: 0, mesure: 0 }, tempo: m.tempo, fichier: `prise-${id}.f32`, frequence: 48000, duree: 180, debutCoupe: 0, finCoupe: 180, decalage: 0, gain: 1, choisie: true };

    // 1. Analyse, rendu complet, recalcul d'une note.
    let t = performance.now();
    const analyse = await api.analyserNotes(prise);
    // Le module de mesure tel que l'API l'a chargé (le serveur de dev ajoute « ?t=… » aux fichiers modifiés).
    const url = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.includes('/autotune/calcul-avance.ts')).pop()!;
    const { mesuresAvance } = await import(/* @vite-ignore */ url);
    const analyseTotalMs = performance.now() - t;
    const analyseWorkerMs = mesuresAvance.analyseMs;
    t = performance.now();
    const deja = await api.analyserNotes(prise);
    const analyseCacheMs = performance.now() - t;
    const pop = api.reglagesPreset('pop');
    t = performance.now();
    const complet = await api.rendreAutotune(prise, pop, tonalite);
    const renduTotalMs = performance.now() - t;
    const renduWorkerMs = mesuresAvance.renduMs;
    const k = Math.floor(analyse.notes.length / 2);
    const n = analyse.notes[k];
    const reglages = { ...pop, preset: 'perso', notes: [{ debut: n.debut, fin: n.fin, midi: n.midi + 2, cents: 0, vibrato: 1 }] };
    t = performance.now();
    const partiel = await api.rendreAutotune(prise, reglages, tonalite);
    const partielTotalMs = performance.now() - t;
    const partielWorkerMs = mesuresAvance.renduMs;
    const estPartiel = mesuresAvance.partiel;
    // Hors de la zone recalculée, rien n'a bougé.
    const za = Math.round((n.debut - 0.1) * 48000);
    const zb = Math.round((n.fin + 0.1) * 48000);
    let differents = 0;
    for (let i = 0; i < longue.length; i++) if ((i < za || i >= zb) && complet.pcm[i] !== partiel.pcm[i]) differents++;
    let changes = 0;
    for (let i = za; i < zb; i++) if (complet.pcm[i] !== partiel.pcm[i]) changes++;

    // Pour comparer, dans les mêmes conditions : l'autotune simple (YIN + PSOLA) sur la même prise.
    const w = new Worker(new URL('/ocka/src/autotune/autotune.worker.ts', location.href), { type: 'module' });
    t = performance.now();
    await new Promise((ok) => {
      w.onmessage = ok;
      w.postMessage({ pcm: longue.slice(), frequence: 48000, force: 1, tonalite });
    });
    const simpleMs = Math.round(performance.now() - t);
    w.terminate();

    // 2. Export et ménage.
    const avecAutotune = { ...prise, autotune: reglages };
    m.prises = [avecAutotune];
    const exporte = await auto.lirePcmVoix(avecAutotune, m, true);
    const nom = api.nomRenduAutotune(avecAutotune, reglages, tonalite);
    const fichiers = (await opfs.listerFichiers()).map((f: { nom: string }) => f.nom);

    // 3. Annulation.
    const ctrl = new AbortController();
    await ecrire(`prise-${id}b.f32`, longue.subarray(0, 48000 * 20));
    const pb = { ...prise, fichier: `prise-${id}b.f32`, duree: 20, finCoupe: 20 };
    const enCours = api.analyserNotes(pb, { signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 5);
    const annule = await enCours.then(() => 'fini', (e: { code?: string }) => e.code ?? String(e));
    const apres = await api.analyserNotes(pb);
    return {
      notes: analyse.notes.length,
      voisees: Math.round(analyse.voisees * 1000) / 1000,
      cacheIdentique: deja === analyse,
      simpleMs,
      analyseWorkerMs,
      analyseTotalMs: Math.round(analyseTotalMs),
      analyseCacheMs: Math.round(analyseCacheMs),
      renduWorkerMs,
      renduTotalMs: Math.round(renduTotalMs),
      partielWorkerMs,
      partielTotalMs: Math.round(partielTotalMs),
      estPartiel,
      longueurIdentique: complet.pcm.length === longue.length && partiel.pcm.length === longue.length,
      differentsHorsZone: differents,
      changesDansZone: changes,
      exportVersion: exporte?.version ?? null,
      nomAttendu: nom,
      fichiersCrees: fichiers.filter((f: string) => f.startsWith(`auto-prise-${id}-av`)),
      gardesParMenage: auto.fichiersAutotune(m),
      annule,
      notesApresAnnulation: apres.notes.length,
    };
  });
  writeFileSync(join(SORTIES, 'bilan-autotune-avance.json'), JSON.stringify(bilan, null, 2));
  console.log(JSON.stringify(bilan, null, 2));
  expect(bilan.notes).toBeGreaterThan(300);
  expect(bilan.cacheIdentique).toBe(true);
  expect(bilan.estPartiel).toBe(true);
  expect(bilan.longueurIdentique).toBe(true);
  expect(bilan.differentsHorsZone).toBe(0);
  expect(bilan.changesDansZone).toBeGreaterThan(1000);
  expect(bilan.partielWorkerMs).toBeLessThan(bilan.renduWorkerMs / 10);
  expect(bilan.exportVersion).toBe(bilan.nomAttendu);
  expect(bilan.fichiersCrees.length).toBe(4); // 2 rendus (+ leurs descriptions)
  expect(bilan.gardesParMenage).toEqual([bilan.nomAttendu]);
  expect(bilan.annule).toBe('annule');
  expect(bilan.notesApresAnnulation).toBeGreaterThan(20);
});
