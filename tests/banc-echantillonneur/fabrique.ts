// Fabrique (côté Node, avec ffmpeg) des faux instruments du banc M1 : Ogg Opus 48 kHz, comme ceux de BQ.
// - faux-orgue@1 : 3 zones (racines ≈ 57, 60, 63), sons tenus à période ENTIÈRE (boucle exacte de 100 périodes) ;
// - faux-mono@1 : les mêmes fichiers, en mode mono ; faux-orgue-pcm@1 : les mêmes sons SANS perte (WAV flottant),
//   pour juger le bouclage du moteur seul (l'Opus ajoute son propre bruit de codage au raccord) ;
// - faux-batterie@1 : stéréo, charley fermé (42) et ouvert (46) dans un groupe exclusif.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceZones, ZoneSource } from '../../src/moteur/types-moteur';

declare const Buffer: { from(donnees: ArrayBufferLike, debut?: number, longueur?: number): { toString(encodage: 'base64'): string } };

export interface Faux {
  source: SourceZones;
  fichiers: Record<string, string>;
}

const FS = 48000;

function opus(dossier: string, nom: string, expr: string, duree: number, canaux: 1 | 2, pcm = false): string {
  const chemin = join(dossier, pcm ? nom.replace('.ogg', '.wav') : nom);
  const codec = pcm ? ['-c:a', 'pcm_f32le'] : ['-c:a', 'libopus', '-b:a', canaux === 2 ? '128k' : '96k'];
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=${FS}:d=${duree}`,
    '-ac', String(canaux), ...codec, '-ar', String(FS), chemin,
  ]);
  const o = readFileSync(chemin);
  return Buffer.from(o.buffer, o.byteOffset, o.byteLength).toString('base64');
}

const zone = (fichier: string, racine: number, cents: number, bas: number, haut: number, fin: number, boucle?: { debut: number; fin: number }): ZoneSource => ({
  fichier, racine, cents, bas, haut, velBas: 1, velHaut: 127, gainDb: 0, debut: 0, fin, ...(boucle ? { boucle } : {}),
});

export function fabriquerFaux(dossier: string): Faux[] {
  mkdirSync(dossier, { recursive: true });
  const fichiers: Record<string, string> = {};
  const sansPerte: Record<string, string> = {};
  const zones: ZoneSource[] = [];
  for (const [periode, bas, haut] of [[219, 56, 58], [184, 59, 61], [155, 62, 64]] as const) {
    const f = FS / periode;
    const m = 69 + 12 * Math.log2(f / 440);
    const racine = Math.round(m);
    const nom = `p${periode}.ogg`;
    const expr = `min(1,t/0.005)*0.3*(sin(2*PI*${f}*t)+0.5*sin(4*PI*${f}*t)+0.25*sin(6*PI*${f}*t))`;
    fichiers[nom] = opus(dossier, nom, expr, 2, 1);
    sansPerte[nom] = opus(dossier, nom, expr, 2, 1, true);
    zones.push(zone(nom, racine, (m - racine) * 100, bas, haut, 2 * FS, { debut: FS, fin: FS + 100 * periode }));
  }
  const orgue: SourceZones = { id: 'faux-orgue@1', canaux: 1, gainDb: 0, relache: 0.3, budgetS: 6, zones };
  const mono: SourceZones = { ...orgue, id: 'faux-mono@1', mono: true };
  const bat: Record<string, string> = {
    'hh-ferme.ogg': opus(dossier, 'hh-ferme.ogg', '0.5*(random(0)*2-1)*exp(-t/0.04)|0.5*(random(1)*2-1)*exp(-t/0.04)', 0.4, 2),
    'hh-ouvert.ogg': opus(dossier, 'hh-ouvert.ogg', '0.4*(random(0)*2-1)*exp(-t/0.35)|0.4*(random(1)*2-1)*exp(-t/0.35)', 1.2, 2),
  };
  const batterie: SourceZones = {
    id: 'faux-batterie@1', canaux: 2, gainDb: 0, relache: 0.08, budgetS: 3.2,
    zones: [zone('hh-ferme.ogg', 42, 0, 42, 42, 0.4 * FS), zone('hh-ouvert.ogg', 46, 0, 46, 46, 1.2 * FS)],
    exclusif: [[42, 46]],
  };
  const pcm: SourceZones = { ...orgue, id: 'faux-orgue-pcm@1' };
  return [{ source: orgue, fichiers }, { source: mono, fichiers }, { source: batterie, fichiers: bat }, { source: pcm, fichiers: sansPerte }];
}
