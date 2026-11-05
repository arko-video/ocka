// Déclarations minimales de Node pour les scénarios QA (le projet n'installe pas @types/node).
declare module 'node:child_process' {
  export function spawnSync(fichier: string, args: string[], options?: { encoding?: 'utf8' }): { stdout: string; stderr: string; status: number | null };
}
declare module 'node:fs' {
  export function existsSync(chemin: string): boolean;
  export function writeFileSync(chemin: string, donnees: string): void;
}
declare module 'node:path' {
  export function dirname(chemin: string): string;
  export function join(...parties: string[]): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}
declare module 'node:child_process' {
  export function spawn(commande: string, args: string[], options?: { cwd?: string; stdio?: unknown; detached?: boolean }): { pid?: number; kill(signal?: string): boolean };
}
