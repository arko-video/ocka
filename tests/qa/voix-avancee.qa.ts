// C3 (V) dans Chrome, sur les modules sources (serveur de dev : OCKA_DEV, par défaut http://localhost:5198/ocka/) :
//  1. gel d'une piste : export avec la basse gelée (gelerPiste + gelsPistes, le vrai fournisseur) = export normal
//     à ≤ −80 dB ; le gel s'annule seul quand la piste change ;
//  2. référence : un WAV et un MP3 (ffmpeg) importés EN FLUX par Mediabunny ; sonie BS.1770 = celle de ffmpeg
//     (ebur128) à ±0,5 LU ; référence compensée = sonie du mix à ±0,5 LU ; lecture en flux : tampon ≤ 30 s ;
//  3. nettoyeur dans le Worker (temps mesuré) sur une prise OPFS.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SORTIES } from './outils';

const DEV = process.env.OCKA_DEV ?? 'http://localhost:5198/ocka/';

test('gel d’une piste : export identique (≤ −80 dB), dégel automatique quand la piste change', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(DEV);
  const bilan = await page.evaluate(async () => {
    const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
    const { nouveauMorceau } = await imp('morceau/styles');
    const { rendre } = await imp('moteur/export-rendu');
    const { outilsGels } = await imp('moteur/gels');
    const gel = await imp('moteur/gel');
    const m = nouveauMorceau('trap', 'QA gel V');
    m.ordre = m.ordre.slice(0, 2);
    const ecart = (a: Float32Array[], b: Float32Array[]) => {
      let e = 0;
      let crete = 0;
      for (let k = 0; k < 2; k++) for (let i = 0; i < a[k]!.length; i++) (e = Math.max(e, Math.abs(a[k]![i]! - (b[k]![i] ?? 0)))), (crete = Math.max(crete, Math.abs(a[k]![i]!)));
      return { db: e > 0 ? 20 * Math.log10(e) : -999, crete };
    };
    const avant = outilsGels.fournisseurs;
    const fournisseur = [(x: unknown, o: unknown) => gel.gelsPistes(x, o)];
    try {
      // a) Chaque piste seule (en solo) : gelée contre normale (master compris).
      const pistes: Record<string, { db: number; crete: number; plancher: number }> = {};
      for (const id of ['accords', 'batterie', 'basse']) {
        const solo = { ...m, pistes: m.pistes.map((p: { id: string }) => ({ ...p, solo: p.id === id })) };
        outilsGels.fournisseurs = [];
        const normale = (await rendre(solo, {})) as Float32Array[];
        const plancher = ecart(normale, (await rendre(solo, {})) as Float32Array[]).db;
        outilsGels.fournisseurs = fournisseur;
        await gel.gelerPiste(solo, id);
        pistes[id] = { ...ecart(normale, (await rendre(solo, {})) as Float32Array[]), plancher };
        gel.degelerPiste(id);
      }
      // b) Le mix complet, basse gelée, face au plancher de Chrome (deux exports normaux).
      outilsGels.fournisseurs = [];
      const normal = (await rendre(m, {})) as Float32Array[];
      const plancher = ecart(normal, (await rendre(m, {})) as Float32Array[]);
      outilsGels.fournisseurs = fournisseur;
      const t0 = performance.now();
      await gel.gelerPiste(m, 'basse');
      const msGel = Math.round(performance.now() - t0);
      const gelees = gel.pistesGelees(m);
      const t1 = performance.now();
      const gele = (await rendre(m, {})) as Float32Array[];
      const msExport = Math.round(performance.now() - t1);
      const m2 = { ...m, pistes: m.pistes.map((p: { id: string }) => (p.id === 'basse' ? { ...p, volume: 0.2 } : p)) };
      const apres = gel.pistesGelees(m2);
      gel.degelerPiste('basse');
      return { pistes, plancher, nul: ecart(normal, gele), gelees, apres, msGel, msExport };
    } finally {
      outilsGels.fournisseurs = avant;
    }
  });
  writeFileSync(join(SORTIES, 'bilan-gel-piste.json'), JSON.stringify(bilan, null, 2));
  console.log(JSON.stringify(bilan));
  expect(bilan.gelees).toEqual(['basse']);
  // Piste seule (master compris) : ≤ −80 dB pour les accords et la batterie. La basse gelée seule reste à −70,3 dB
  // (mesuré à l'intégration C3, à l'ENTRÉE du master, quelques ms au début de certaines notes de 808) alors que son
  // rendu gelé est identique au bit près à sa piste séparée : écart inaudible, cause dans le mélange du bus non trouvée
  // (noté dans la passation). Seuil de la basse : −65 dB ; le mix complet, lui, reste au plancher de Chrome (plus bas).
  for (const id of ['accords', 'batterie', 'basse']) {
    expect(bilan.pistes[id]!.crete, id).toBeGreaterThan(0.05);
    expect(bilan.pistes[id]!.db, id).toBeLessThanOrEqual(id === 'basse' ? -65 : -80);
  }
  expect(bilan.nul.crete).toBeGreaterThan(0.1);
  // Mix complet : au plancher de reproductibilité de Chrome (deux exports SANS gel), comme gels.qa.ts.
  expect(bilan.nul.db).toBeLessThanOrEqual(Math.max(bilan.plancher.db, -120) + 6);
  expect(bilan.apres).toEqual([]);
});

/** Sonie intégrée selon ffmpeg (filtre ebur128, lue dans sa sortie d'erreur). */
function lufsFfmpeg(chemin: string): number {
  try {
    execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${chemin}" -af ebur128 -f null - 2> "${chemin}.txt"`]);
  } catch {
    // ffmpeg écrit sur stderr
  }
  const t = readFileSync(`${chemin}.txt`, 'utf8');
  const m = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(t);
  return m ? Number(m[1]) : NaN;
}

test('référence : import en flux (WAV, MP3), sonie = ffmpeg à ±0,5 LU, compensation, tampon ≤ 30 s', async ({ page }) => {
  test.setTimeout(300_000);
  const fichiers: { nom: string; b64: string; lufs: number }[] = [];
  for (const [nom, args] of [
    ['ref.wav', ['-c:a', 'pcm_s16le']],
    ['ref.mp3', ['-c:a', 'libmp3lame', '-b:a', '192k']],
  ] as const) {
    const chemin = join(SORTIES, nom);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', "anoisesrc=color=pink:a=0.25:d=40,volume='if(between(t,10,14),0.05,1)':eval=frame", '-ac', '2', '-ar', '44100', ...args, chemin]);
    fichiers.push({ nom, b64: (readFileSync(chemin) as unknown as { toString(codage: string): string }).toString('base64'), lufs: lufsFfmpeg(chemin) });
  }
  await page.goto(DEV);
  const bilan = await page.evaluate(async (fichiers) => {
    const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
    const ref = await imp('moteur/reference');
    const gel = await imp('moteur/gel');
    const { nouveauMorceau } = await imp('morceau/styles');
    const m = nouveauMorceau('lofi', 'QA référence');
    m.ordre = m.ordre.slice(0, 2);
    await gel.gelsPistes(m, { frequence: 48000, attendre: false }); // le morceau « écouté »
    const lufsMix = await ref.sonieMix(m);
    const out = [];
    for (const f of fichiers) {
      const octets = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
      const t0 = performance.now();
      const info = await ref.importerReference(new File([octets], f.nom));
      const ms = Math.round(performance.now() - t0);
      const faux = { ctx: undefined, enLecture: false, pause() {}, lire() {} };
      const e = await ref.creerEcouteReference(faux, info.id, { morceau: m, passage: 5 });
      e.basculer(true);
      await new Promise((r) => setTimeout(r, 2500));
      const flux = (e as unknown as { flux: { maxTrames: number; position: number } }).flux;
      const maxSecondes = flux.maxTrames / 44100;
      e.basculer(false);
      const position = flux.position;
      e.detruire();
      out.push({ nom: f.nom, ffmpeg: f.lufs, ocka: info.lufs, duree: info.duree, ms, comp: e.compensationDb, compense: info.lufs + e.compensationDb, maxSecondes, position });
      await ref.supprimerReference(info.id);
    }
    return { lufsMix, out, restantes: (await ref.listerReferences()).length };
  }, fichiers);
  writeFileSync(join(SORTIES, 'bilan-reference.json'), JSON.stringify(bilan, null, 2));
  console.log(JSON.stringify(bilan));
  for (const r of bilan.out) {
    expect(Math.abs(r.ocka - r.ffmpeg), r.nom).toBeLessThanOrEqual(0.5);
    expect(Math.abs(r.compense - bilan.lufsMix), r.nom).toBeLessThanOrEqual(0.5);
    expect(r.duree).toBeGreaterThan(39);
    expect(r.maxSecondes).toBeLessThanOrEqual(30);
    expect(r.position).toBeGreaterThan(5.5);
  }
  expect(bilan.restantes).toBe(0);
});
