// Master hors ligne en JS (sans worklet) contre le worklet de l'écoute : même son, écart ≤ −120 dB.
// Un même signal (le trap de la QA, rendu puis poussé de +6 dB pour faire travailler colle et limiteur) passe :
//  (a) dans la chaîne master AVEC le worklet (optionsMaster.workletHorsLigne) suivie du GainNode du fondu ;
//  (b) dans la chaîne master hors ligne (couleur seule), puis appliquerMaster en JS (master + fondu).
// Chaînes 1 et 2. Besoin du serveur de dev (modules sources) : npx vite --port 5198 --strictPort.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SORTIES } from './outils';

const DEV = 'http://localhost:5198/ocka/';

test('master : JS hors ligne = worklet (≤ −120 dB), chaînes 1 et 2, fondu compris', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(DEV);
  const bilan = await page.evaluate(async () => {
    const imp = (c: string) => import(/* @vite-ignore */ `/ocka/src/${c}.ts`);
    const { nouveauMorceau } = await imp('morceau/styles');
    const { rendre } = await imp('moteur/export-rendu');
    const { creerChaineMaster, optionsMaster } = await imp('moteur/master');
    const { appliquerMaster, fonduFin } = await imp('moteur/audio/master-hors-ligne');
    const { retardMaster } = await imp('moteur/audio/worklet');
    const FS = 44100;
    const m = nouveauMorceau('trap', 'QA master');
    m.ordre = m.ordre.slice(0, 2);
    const [g0, d0] = (await rendre(m, {})) as Float32Array[];
    const n = Math.min(g0!.length, 20 * FS);
    const entree = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: FS });
    entree.copyToChannel(g0!.slice(0, n).map((x) => x * 2), 0);
    entree.copyToChannel(d0!.slice(0, n).map((x) => x * 2), 1);
    const retard = retardMaster(FS);
    const duree = n / FS - 1;
    const resultats: Record<string, { crete: number; ecartDb: number; identiques: number }> = {};
    for (const chaine of [1, 2] as const) {
      const master = { ...m.master, chaine, preset: 'chaud' };
      const rendus: Float32Array[][] = [];
      for (const worklet of [true, false]) {
        optionsMaster.workletHorsLigne = worklet;
        const ctx = new OfflineAudioContext(2, n + retard, FS);
        const src = new AudioBufferSourceNode(ctx, { buffer: entree });
        const c = await creerChaineMaster(ctx, master);
        const fondu = ctx.createGain();
        const f = fonduFin(c.latence, duree, 2);
        src.connect(c.entree);
        if (worklet) {
          fondu.gain.setValueAtTime(1, c.latence);
          fondu.gain.setValueAtTime(1, f.debut);
          fondu.gain.linearRampToValueAtTime(0, f.fin);
          c.sortie.connect(fondu).connect(ctx.destination);
        } else c.sortie.connect(ctx.destination);
        src.start(0);
        const r = await ctx.startRendering();
        const canaux = [r.getChannelData(0).slice(), r.getChannelData(1).slice()];
        const js = c.masterJs();
        if (!worklet && js) await appliquerMaster(canaux, js, FS, f);
        c.detruire();
        rendus.push(canaux);
      }
      optionsMaster.workletHorsLigne = false;
      let crete = 0;
      let ecart = 0;
      let identiques = 0;
      for (let k = 0; k < 2; k++) {
        const a = rendus[0]![k]!;
        const b = rendus[1]![k]!;
        for (let i = 0; i < a.length; i++) {
          crete = Math.max(crete, Math.abs(a[i]!));
          const e = Math.abs(a[i]! - b[i]!);
          if (e === 0) identiques++;
          ecart = Math.max(ecart, e);
        }
      }
      resultats[`chaine${chaine}`] = { crete, ecartDb: ecart > 0 ? 20 * Math.log10(ecart) : -Infinity, identiques: identiques / (2 * (n + retard)) };
    }
    return resultats;
  });
  writeFileSync(join(SORTIES, 'bilan-master-js.json'), JSON.stringify(bilan, (_, v) => (v === -Infinity ? '-inf' : v), 2));
  for (const r of Object.values(bilan)) {
    expect(r.crete).toBeGreaterThan(0.5); // le master a bien travaillé sur un vrai signal
    expect(r.ecartDb).toBeLessThanOrEqual(-120);
  }
});
