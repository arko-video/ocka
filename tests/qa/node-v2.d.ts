// Déclarations minimales de Node pour le test nul de la v2 (le projet n'installe pas @types/node).
// Elles complètent tests/qa/node-qa.d.ts, tests/e2e/node-e2e.d.ts, tests/banc-moteur/node.d.ts et src/moteur/flac/node-tests.d.ts.
declare module 'node:fs' {
  export function readFileSync(chemin: string, encodage: 'utf8'): string;
  export function writeFileSync(chemin: string, donnees: Uint8Array): void;
  export function renameSync(de: string, vers: string): void;
}
declare module 'node:child_process' {
  export function execFileSync(fichier: string, args: string[], options?: { cwd?: string; encoding?: 'utf8'; stdio?: unknown }): string;
}
declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(donnees: ArrayBufferLike, debut?: number, longueur?: number): { toString(encodage: 'base64'): string } };
