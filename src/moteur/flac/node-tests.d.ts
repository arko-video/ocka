// Déclarations minimales de Node pour les tests d'A2 (le projet n'installe pas @types/node).
// Elles complètent celles de tests/banc-moteur/node.d.ts et tests/qa/node-qa.d.ts.
declare module 'node:fs' {
  export function mkdtempSync(prefixe: string): string;
  export function rmSync(chemin: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(chemin: string, donnees: Uint8Array): void;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:zlib' {
  export function crc32(o: Uint8Array): number;
}
