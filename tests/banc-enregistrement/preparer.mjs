// Fabrique le WAV du faux micro avec ffmpeg : un clic de 1 ms toutes les 0,5 s (120 BPM), 8 s pile
// (la boucle de Chrome ne casse donc pas le rythme). Mono, 48 kHz, 16 bits.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const WAV_FAUX_MICRO = join(tmpdir(), 'ocka-banc-enregistrement', 'clics-120.wav');

/** Appelé une fois par Playwright avant les tests. */
export default function preparer() {
  if (existsSync(WAV_FAUX_MICRO)) return;
  mkdirSync(join(tmpdir(), 'ocka-banc-enregistrement'), { recursive: true });
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', "aevalsrc='0.8*lt(mod(t,0.5),0.001)':s=48000:d=8",
    '-ac', '1', '-c:a', 'pcm_s16le', WAV_FAUX_MICRO,
  ]);
}
