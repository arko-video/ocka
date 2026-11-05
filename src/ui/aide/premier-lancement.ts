// Premier lancement : les 3 conseils de bienvenue ne s'affichent qu'une fois. Le souvenir est gardé dans le stockage
// local du navigateur (clé préfixée « ocka- », car Arko partage la même origine). Si ce stockage est bloqué (navigation
// privée…), on s'en souvient seulement jusqu'à la fermeture de la page. Pur et testé. Propriétaire : B3.

export const CLE_BIENVENUE = 'ocka-bienvenue-vue';

/** Ce dont on a besoin du stockage (localStorage, ou un faux dans les tests). */
export interface StockageSimple {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

let vueCetteFois = false;

function stockageDuNavigateur(): StockageSimple | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** true si les conseils ont déjà été vus (sur cet appareil, ou pendant cette visite). */
export function bienvenueDejaVue(stockage: StockageSimple | null = stockageDuNavigateur()): boolean {
  if (vueCetteFois) return true;
  try {
    return stockage?.getItem(CLE_BIENVENUE) === '1';
  } catch {
    return false;
  }
}

/** À appeler quand les conseils sont passés : ils ne reviendront plus. */
export function marquerBienvenueVue(stockage: StockageSimple | null = stockageDuNavigateur()) {
  vueCetteFois = true;
  try {
    stockage?.setItem(CLE_BIENVENUE, '1');
  } catch {
    // Stockage plein ou bloqué : tant pis, on s'en souvient pour cette visite.
  }
}

/** Pour les tests : oublie la visite en cours. */
export function oublierVisite() {
  vueCetteFois = false;
}
