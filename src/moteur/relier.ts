// Relie une fonction du contrat (api-*.ts) à son implémentation, lue AU MOMENT DE L'APPEL :
// l'ordre de chargement des modules (boucles d'imports) ne peut jamais donner « undefined ».
// Le type déclaré dans api-*.ts est vérifié par TypeScript contre celui de l'implémentation.

export function relier<F extends (...args: never[]) => unknown>(lire: () => F): F {
  return ((...args: Parameters<F>) => lire()(...args)) as F;
}
