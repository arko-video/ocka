// Page de banc : expose window.banc pour les tests Playwright (faux micro de Chrome, boucle interne).
import {
  calibrerLatence,
  contexteAudio,
  creerEnregistreur,
  dupliquerMorceau,
  ErreurOcka,
  latenceMemorisee,
  lirePrise,
  listerMorceaux,
  ouvrirMorceau,
  placerPrise,
  sauverMorceau,
  supprimerMorceau,
  supprimerPrise,
  nettoyerPrisesOrphelines,
} from '../../src/moteur/api';
import { calibrerLatence as calibrerAvecOptions } from '../../src/enregistrement/calibrage';
import { creerEnregistreur as creerAvecOptions } from '../../src/enregistrement/enregistreur';
import { lireFichier, nomDescription, listerFichiers } from '../../src/enregistrement/fichiers-opfs';
import { positionAncre } from '../../src/morceau/temps';
import type { Prise } from '../../src/morceau/types';
import { crete, debutsDeClics, morceauDeTest } from './analyse';
import { LecteurFactice } from './lecteur-factice';

const attendre = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// On garde les flux du micro pour vérifier que leurs pistes sont bien arrêtées (voyant éteint).
const flux: MediaStream[] = [];
const gumOriginal = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
  const f = await gumOriginal(c);
  flux.push(f);
  return f;
};
const pistesActives = () => flux.flatMap((f) => f.getTracks()).filter((t) => t.readyState === 'live').length;

const ANCRE: Prise['ancre'] = { section: 'couplet', occurrence: 0, mesure: 0 };

/** Prise avec le vrai micro (ici le faux micro de Chrome qui joue un WAV de clics). */
async function priseFauxMicro(tempo: number, dureeMs: number) {
  const morceau = morceauDeTest(tempo);
  const lecteur = new LecteurFactice();
  await lecteur.charger(morceau);
  const enr = await creerEnregistreur();
  await enr.demarrer(lecteur, morceau, ANCRE);
  let niveauMax = 0;
  const fin = Date.now() + dureeMs;
  const pistesPendant = pistesActives();
  while (Date.now() < fin) {
    niveauMax = Math.max(niveauMax, enr.niveau);
    await attendre(20);
  }
  const prise = await enr.arreter();
  const pistesApresArret = pistesActives();
  enr.detruire();
  const donnees = await lirePrise(prise);
  const description = JSON.parse(new TextDecoder().decode((await lireFichier(nomDescription(prise.fichier)))!));
  const pcm = donnees!.pcm;
  const clics = debutsDeClics(pcm, 0.3, Math.round(0.1 * prise.frequence)).map((i) => i / prise.frequence);
  return {
    prise,
    description,
    sampleRate: lecteur.ctx.sampleRate,
    echantillonsLus: pcm.length,
    crete: crete(pcm),
    niveauMax,
    clics,
    journal: lecteur.journal,
    avertissements: enr.avertissements ?? [],
    pistesPendant,
    pistesApresArret,
  };
}

/** Deux prises avec le même enregistreur : le micro est coupé après chaque prise, puis rouvert. */
async function deuxPrises() {
  const morceau = morceauDeTest(120);
  const lecteur = new LecteurFactice();
  await lecteur.charger(morceau);
  const enr = await creerEnregistreur();
  const etapes: number[] = [pistesActives()];
  const durees: number[] = [];
  for (let i = 0; i < 2; i++) {
    await enr.demarrer(lecteur, morceau, ANCRE);
    etapes.push(pistesActives());
    await attendre(2600);
    durees.push((await enr.arreter()).duree);
    etapes.push(pistesActives());
  }
  enr.detruire();
  etapes.push(pistesActives());
  return { etapes, durees };
}

/** Boucle interne : la sortie du lecteur passe par un retard connu et revient dans la capture. */
function boucle(retard: number) {
  return (ctx: AudioContext) => {
    const d = ctx.createDelay(1);
    d.delayTime.value = retard;
    return d;
  };
}

/** Calibrage en boucle interne (retard connu) : la mesure doit retomber sur ce retard. */
async function calibrageBoucle(retard: number) {
  const fabrique = boucle(retard);
  const mesure = await calibrerAvecOptions(undefined, {
    branchement: (ctx) => {
      const d = fabrique(ctx);
      return { sortie: d, entree: d };
    },
  });
  return { mesure, memorisee: latenceMemorisee() };
}

/** Prise en boucle interne : les clics du lecteur, retardés de `retard`, doivent retomber pile sur les noires. */
async function priseBoucle(tempo: number, retard: number, dureeMs: number) {
  const morceau = morceauDeTest(tempo);
  const lecteur = new LecteurFactice();
  await lecteur.charger(morceau);
  const fabrique = boucle(retard);
  const enr = await creerAvecOptions({
    entree: (ctx) => {
      const d = fabrique(ctx);
      lecteur.sortie.connect(d);
      return d;
    },
  });
  await enr.demarrer(lecteur, morceau, ANCRE);
  await attendre(dureeMs);
  const prise = await enr.arreter();
  enr.detruire();
  const pcm = (await lirePrise(prise))!.pcm;
  const fe = prise.frequence;
  // Convention : le son du fichier en x tombe au temps du morceau ta + (x − debutCoupe) − decalage.
  const ta = positionAncre(morceau, ANCRE)!;
  const versMorceau = (x: number) => ta + (x - prise.debutCoupe) - prise.decalage;
  const clics = debutsDeClics(pcm, 0.3, Math.round(0.1 * fe)).map((i) => versMorceau(i / fe));
  const noire = 60 / tempo;
  const ecarts = clics.map((t) => t - Math.round(t / noire) * noire);
  return { prise, ta, clics, ecarts, place: placerPrise(prise, ta), journal: lecteur.journal };
}

/** Calibrage avec le faux micro : il n'entend pas le chirp → « signal_faible » attendu. */
async function calibrageFauxMicro(): Promise<string> {
  try {
    await calibrerLatence();
    return 'aucune erreur';
  } catch (e) {
    return e instanceof ErreurOcka ? e.code : String(e);
  }
}

/** Parcours « Mes morceaux » : sauver, lister, ouvrir, dupliquer (fichiers copiés), supprimer, nettoyer. */
async function parcoursStockage(prise: Prise) {
  const morceau = { ...morceauDeTest(120), titre: 'Mon son', prises: [prise] };
  const id = await sauverMorceau(morceau);
  const liste1 = await listerMorceaux();
  const ouvert = await ouvrirMorceau(id);
  const idCopie = await dupliquerMorceau(id);
  const copie = await ouvrirMorceau(idCopie);
  const pcmCopie = copie?.prises[0] ? await lirePrise(copie.prises[0]) : null;
  // Duplication d'un morceau dont une prise a perdu son fichier : échec complet, rien de créé.
  const casse = { ...morceauDeTest(120), titre: 'Cassé', prises: [{ ...prise, id: 'x', fichier: 'prise-absente.f32' }] };
  const idCasse = await sauverMorceau(casse);
  const avantEchec = (await listerMorceaux()).length;
  let codeEchec = 'aucune erreur';
  await dupliquerMorceau(idCasse).catch((e: unknown) => (codeEchec = e instanceof ErreurOcka ? e.code : String(e)));
  const apresEchec = (await listerMorceaux()).length;
  await supprimerMorceau(idCasse);
  await supprimerPrise(prise); // ne doit rien effacer
  await supprimerMorceau(id);
  const originalGarde = ((await lirePrise(prise))?.pcm.length ?? 0) > 0;
  const fichiersAvant = (await listerFichiers()).map((f) => f.nom);
  const effaces = await nettoyerPrisesOrphelines(0);
  const fichiersApres = (await listerFichiers()).map((f) => f.nom);
  const pcmOriginalApres = await lirePrise(prise);
  const pcmCopieApres = copie?.prises[0] ? await lirePrise(copie.prises[0]) : null;
  return {
    id,
    idCopie,
    liste1,
    ouvertPrise: ouvert?.prises[0] ?? null,
    titreCopie: copie?.titre,
    fichierCopie: copie?.prises[0]?.fichier,
    longueurCopie: pcmCopie?.pcm.length ?? -1,
    codeEchec,
    echecSansDoublon: avantEchec === apresEchec,
    originalGarde,
    originalEfface: pcmOriginalApres === null,
    copieToujoursLa: (pcmCopieApres?.pcm.length ?? -1) > 0,
    absent: await ouvrirMorceau(id),
    fichiersAvant,
    effaces,
    fichiersApres,
    liste2: await listerMorceaux(),
  };
}

declare global {
  interface Window {
    banc: Record<string, (...args: never[]) => Promise<unknown>>;
  }
}
window.banc = { priseFauxMicro, deuxPrises, calibrageBoucle, priseBoucle, calibrageFauxMicro, parcoursStockage, listerMorceaux, ouvrirMorceau };
// Le contexte commun est créé tout de suite (lecture autorisée sans geste grâce à l'option de Chrome du banc).
void contexteAudio().resume();
document.body.dataset.pret = 'oui';
