// Ta voix → instrument et beatbox — implémentation du contrat C2 (api-dubler.ts). Propriétaire : D.
// Ce fichier rassemble les noms du contrat ; le travail est réparti dans src/dubler/ :
// - détection (pur, testé, et tel quel dans le worklet) : yin-direct.ts, stabilite.ts, calage.ts, detecteur.ts ;
// - beatbox (pur) : fft.ts, attaques.ts, beatbox.ts ; notes (pur) : notes.ts ; latence : latence-detection.ts ;
// - navigateur : dubler.worklet.ts, chaine.ts (micro + worklet), instrument-direct.ts, direct.ts,
//   beatbox-direct.ts, enregistrement.ts. Signaux de synthèse (tests, mesure de latence) : signaux-test.ts.

export { accordChante } from './calage';
export { arreterDirect, demarrerDirect, noteCourante, reglerDirect } from './direct';
export { detecterAttaques } from './attaques';
export { classerAttaque, mesuresAttaque } from './beatbox';
export {
  arreterBeatbox,
  demarrerBeatbox,
  enregistrerExemple,
  lireEntrainement,
  sauverEntrainement,
} from './beatbox-direct';
export { arreterEnregistrementNotes, demarrerEnregistrementNotes } from './enregistrement';
export { poserNotesChantees, quantifierNotesChantees } from './notes';
export { mesurerLatenceDetection } from './latence-detection';
