// Registre des synthés d'OCKA (propriétaire : L). UN fichier par synthé (`export default` une DefinitionSynthe,
// api-synthes.ts) et UNE ligne ici. Le moteur le lit par synthese/registre-synthes.ts (intégrateur). Les 6 sons v1
// (piano … nappe) ne changent JAMAIS de son (empreintes : registre.test.ts) ; un synthé livré ne change plus (sinon @2).
// C3 : 303, chiptune, onde dessinée, supersaw, chœurs, log drum, cuivres, Rhodes, Wurlitzer, piano jouet, célesta,
// steel drum (empreintes : synthes.test.ts).
import type { DefinitionSynthe } from '../../api-synthes';
import acide from './303';
import celesta from './celesta';
import choeurs from './choeurs';
import cloche from './cloche';
import cuivres from './cuivres';
import epiano from './epiano';
import lead from './lead';
import logdrum from './logdrum';
import nappe from './nappe';
import nes from './nes';
import onde from './onde';
import piano from './piano';
import pianojouet from './pianojouet';
import pluck from './pluck';
import rhodes from './rhodes';
import steeldrum from './steeldrum';
import supersaw from './supersaw';
import wurlitzer from './wurlitzer';

export const SYNTHES: readonly DefinitionSynthe[] = [
  piano,
  epiano,
  lead,
  pluck,
  cloche,
  nappe,
  acide,
  nes,
  onde,
  supersaw,
  choeurs,
  logdrum,
  cuivres,
  rhodes,
  wurlitzer,
  pianojouet,
  celesta,
  steeldrum,
];
