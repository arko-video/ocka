// Lecture : passer en « boucle de section » pendant la lecture. Deux soupçons de la relecture du lecteur :
//  1. la tête de lecture est déjà après la section → tous les sons de la section partent en retard, d'un coup ;
//  2. le fondu de fin (programmé pour le morceau entier) reste programmé → silence après la fin du morceau.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ecrireMorceauIdb, morceauxIdb, nouveau, SORTIES } from './outils';

async function espionner(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __retards: number[]; __an?: AnalyserNode };
    w.__retards = [];
    for (const C of [AudioScheduledSourceNode, AudioBufferSourceNode, OscillatorNode, ConstantSourceNode]) {
      if (!Object.prototype.hasOwnProperty.call(C.prototype, 'start')) continue;
      const start = C.prototype.start as (...a: number[]) => void;
      Object.defineProperty(C.prototype, 'start', {
        configurable: true,
        writable: true,
        value: function (this: AudioScheduledSourceNode, quand = 0, ...reste: number[]) {
          const c = this.context;
          if (c instanceof AudioContext && quand > 0 && quand < c.currentTime - 0.03) w.__retards.push(c.currentTime - quand);
          return start.call(this, quand, ...reste);
        },
      });
    }
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...a: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, dest: unknown, ...reste: unknown[]) {
      const r = connect.call(this, dest, ...reste);
      if (dest instanceof AudioDestinationNode && this.context instanceof AudioContext && !(this instanceof AudioScheduledSourceNode)) {
        if (!w.__an || w.__an.context !== this.context) w.__an = this.context.createAnalyser();
        connect.call(this, w.__an);
      }
      return r;
    } as typeof AudioNode.prototype.connect;
  });
}

/** Niveau RMS de la sortie, mesuré toutes les 100 ms pendant `ms`. */
function niveaux(page: Page, ms: number): Promise<number[]> {
  return page.evaluate(async (duree) => {
    const an = (window as unknown as { __an: AnalyserNode }).__an;
    const x = new Float32Array(an.fftSize);
    const out: number[] = [];
    for (let t = 0; t < duree; t += 100) {
      await new Promise((r) => setTimeout(r, 100));
      an.getFloatTimeDomainData(x);
      out.push(Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length));
    }
    return out;
  }, ms);
}

test('boucle de section activée alors que la lecture est déjà plus loin : aucun son ne part en retard', async ({ page }) => {
  await espionner(page);
  await nouveau(page, 'trap');
  await page.getByTestId('lecture').click();
  await page.waitForTimeout(9000); // Intro = 4 mesures = 6,86 s : on est dans le Couplet
  const avant = await page.evaluate(() => (window as unknown as { __retards: number[] }).__retards.length);
  await page.getByTestId('boucle').click(); // boucle sur la section suivie (l'Intro)
  await page.waitForTimeout(1500);
  const retards = await page.evaluate(() => (window as unknown as { __retards: number[] }).__retards);
  writeFileSync(join(SORTIES, 'bilan-lecture-boucle.json'), JSON.stringify({ avant, apres: retards.length, max: Math.max(0, ...retards) }, null, 2));
  expect(retards.length - avant).toBe(0);
});

test('boucle de section activée pendant la lecture du morceau entier : le son ne s\'éteint pas à la fin du morceau', async ({ page }) => {
  await espionner(page);
  await nouveau(page, 'trap');
  await page.getByTestId('retour').click();
  const [{ id, m }] = await morceauxIdb(page);
  // Morceau court : Intro 2 mesures + Couplet 1 mesure = 5,14 s.
  const court = { ...m, ordre: [m.ordre[0], m.ordre[1]], sections: m.sections.map((s) => ({ ...s, mesures: s.id === m.ordre[0] ? 2 : 1 })) };
  await ecrireMorceauIdb(page, id, court);
  await page.reload();
  await page.getByTestId('ouvrir-morceau').first().click();
  await page.getByTestId('lecture').click();
  await page.waitForTimeout(800);
  await page.getByTestId('boucle').click(); // boucle sur l'Intro (0 à 3,43 s), on y est déjà
  const n = await niveaux(page, 9000); // couvre la fin du morceau (5,14 s) et au-delà
  const debut = n.slice(0, 20);
  const fin = n.slice(-30);
  writeFileSync(join(SORTIES, 'bilan-lecture-fondu.json'), JSON.stringify({ rms: n.map((x) => Math.round(x * 1e4) / 1e4) }, null, 2));
  expect(Math.max(...debut)).toBeGreaterThan(0.005);
  // Toujours du son dans les 3 dernières secondes (l'Intro boucle).
  expect(Math.max(...fin)).toBeGreaterThan(0.005);
});
