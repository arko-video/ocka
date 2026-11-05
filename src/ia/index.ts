// L'IA compositrice d'OCKA (facultative, avec la clé de l'utilisateur) : ce que l'interface utilise.
// Fournisseurs et clé copiés d'Arko (licence MIT, même auteur). Aucune IA par défaut, aucun appel sans geste.

export { FOURNISSEURS, estFournisseur, testerCle, trouverFournisseur, type IdFournisseur } from './fournisseurs';
export { lireCle, lireFournisseur, masquer, oublierCle, sauverCle, sauverFournisseur } from './cle';
export { demander, gesteRecent, type Reglages } from './appel';
export {
  estimerCout,
  GENRES_SUITE,
  LANGUES_PAROLES,
  MAX_PHRASE,
  requeteBeat,
  requeteParoles,
  requeteSuite,
  texteEnvoye,
  type Cout,
  type GenreSuite,
  type LangueParoles,
  type Requete,
} from './requetes';
export { lireBeat, lireParoles, lireSuite, type LigneProposee, type Proposition } from './lecture';
export { appliquerParoles, marquerIa } from './infos-ia';
