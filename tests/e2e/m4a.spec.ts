// M4A « pour écouter » : AAC, 44,1 kHz, 2 canaux (ffprobe). Ce Chrome Linux n'a pas d'encodeur AAC natif
// (WebCodecs) : c'est le secours WebAssembly (@mediabunny/aac-encoder, dans un Worker blob:) qui encode. Il faut la CSP
// de la vague A ('wasm-unsafe-eval' et worker-src blob:) ; on vérifie qu'aucune violation CSP ni erreur n'arrive.
import { expect, test } from '@playwright/test';
import { dossierNeuf, erreursDecodage, exporterVers, nouveauMorceau, sonder } from './outils-e2e';

test('M4A : AAC 44,1 kHz stéréo, par le secours WebAssembly sous la CSP stricte', async ({ page }) => {
  const csp: string[] = [];
  const erreurs: string[] = [];
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.exposeFunction('__csp', (t: string) => csp.push(t));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp(t: string): void }).__csp(`${e.violatedDirective} ${e.blockedURI}`));
  });

  await nouveauMorceau(page, 'trap');
  // Pas d'AAC natif ici : le secours WebAssembly sera bien celui qui encode.
  const natif = await page.evaluate(async () => {
    if (typeof AudioEncoder === 'undefined') return false;
    const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 256_000 }).catch(() => null);
    return !!r?.supported;
  });
  test.info().annotations.push({ type: 'aac-natif', description: String(natif) });

  const chemin = await exporterVers(page, 'export-m4a', dossierNeuf('m4a'));
  expect(chemin).toMatch(/\.m4a$/);
  const s = sonder(chemin);
  expect([s.codec_name, Number(s.sample_rate), Number(s.channels)]).toEqual(['aac', 44100, 2]);
  expect(String(s.format_name)).toContain('mp4');
  expect(Math.abs(Number(s.duree) - 68.571)).toBeLessThan(0.1);
  expect(Number(s.bit_rate)).toBeGreaterThan(200_000);
  expect(erreursDecodage(chemin)).toBe('');
  expect(csp).toEqual([]);
  expect(erreurs).toEqual([]);
  if (!natif) test.info().annotations.push({ type: 'secours', description: 'encodé par le secours WebAssembly' });
});
