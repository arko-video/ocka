// Préparation de Vitest (setupFiles, vite.config.ts) : déclare la banque d'instruments au normaliseur, comme
// api-banque.ts le fait au démarrage de l'appli. Sans cela, chaque piste d'un instrument de la banque reçoit un
// conseil « pas encore disponible » et les morceaux des styles ne sont plus « déjà normalisés ».
import { declarerInstruments } from '../morceau/acces';
import { IDS_BANQUE } from './ids-banque';

declarerInstruments(IDS_BANQUE);
// Contrat C3 : le registre des synthés déclare les synthés prêts (« ocka-<id>@1 »), comme au démarrage de l'appli.
import '../moteur/synthese/registre-synthes';
