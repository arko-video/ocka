// Déclarations minimales de Node pour les e2e de la vague A (le projet n'installe pas @types/node).
// Elles complètent celles de tests/qa/node-qa.d.ts, tests/banc-moteur/node.d.ts et src/moteur/flac/node-tests.d.ts.
declare module 'node:fs' {
  export function readdirSync(chemin: string): string[];
  export function statSync(chemin: string): { isDirectory(): boolean; size: number };
}
declare module 'node:path' {
  export function relative(de: string, vers: string): string;
}
