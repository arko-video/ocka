// Déclarations minimales de Node pour le banc (le projet n'installe pas @types/node).
declare module 'node:child_process' {
  export function execFileSync(fichier: string, args: string[], options?: { encoding?: 'utf8'; stdio?: unknown }): string;
}
declare module 'node:fs' {
  export function mkdirSync(chemin: string, options?: { recursive?: boolean }): void;
  export function readFileSync(chemin: string): Uint8Array;
}
