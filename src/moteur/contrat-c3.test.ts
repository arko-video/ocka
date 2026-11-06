// Contrat C3 : les signatures de P, S, L, R et V existent (api.ts, api-outils-notes.ts) ; les crochets (gels, prises) laissent le son tel quel tant que rien n'est branché ; un pad joue
// sa découpe (Morceau.tranchesPads) ; l'export n'a plus d'option « worklet hors ligne ».
import { describe, expect, it } from 'vitest';
import { crochetPrise } from '../enregistrement/crochets-prise';
import { nouveauMorceau } from '../morceau/styles';
import type { Morceau } from '../morceau/types';
import * as outils from '../ui/edition/api-outils-notes';
import * as api from './api';
import { gelsDuMorceau, outilsGels, type Gel } from './gels';
import * as master from './master';
import { besoins, clePad } from './instruments/preparation';
import type { PcmSon } from './types-moteur';

const C3_API = {
  P: ['importerMidi', 'exporterMidi', 'listerAppareilsMidi', 'jouerMidiDirect', 'enregistrerMidi'],
  S: ['decouperAttaques', 'decouperEgal', 'poserDecoupes', 'tranchesVersPads', 'editerSon', 'etirerPcm', 'etirerSon',
    'detecterBpm', 'detecterTonaliteSon', 'importerSoundfont', 'presetsSoundfont', 'ajouterSoundfont', 'supprimerSoundfont'],
  L: ['reglerParamSynthe', 'dessinerOnde', 'tablesOnde', 'kickParDefaut', 'sfxrAuHasard', 'fabriquerSon', 'enregistrerSonFabrique'],
  R: ['ajouterEffetPerf', 'reglerEffetPerf', 'retirerEffetPerf', 'grilleLooper', 'creerLooper', 'journalVersMorceau', 'tapTempo',
    'reglerMetronome', 'etapesHistorique', 'listerModeles', 'sauverModele', 'supprimerModele', 'appliquerModele',
    'ajouterMarqueur', 'modifierMarqueur', 'retirerMarqueur', 'marqueursPlaces'],
  V: ['creerPunch', 'assemblerComp', 'nettoyerPrise', 'doublerPrise', 'ecouterReglage', 'chainesVoix', 'appliquerChaineVoix',
    'importerReference', 'listerReferences', 'supprimerReference', 'creerEcouteReference', 'gelerPiste', 'degelerPiste', 'pistesGelees'],
} as const;
const C3_OUTILS = ['arpeger', 'gratter', 'humaniser', 'reglerGlisse', 'reglerSwingPiste', 'riffMachine', 'notesFantomes'] as const;

describe('contrat C3', () => {
  it('api.ts expose les fonctions de P, S, L, R, V ; api-outils-notes.ts celles de P (et poserAccord, quantifier de C1)', () => {
    const a = api as unknown as Record<string, unknown>;
    for (const noms of Object.values(C3_API)) for (const nom of noms) expect(typeof a[nom], nom).toBe('function');
    for (const nom of [...C3_OUTILS, 'poserAccord', 'quantifier']) expect(typeof (outils as Record<string, unknown>)[nom], nom).toBe('function');
    for (const nom of ['instrumentsSynthes', 'definitionSynthe', 'reglagesLus', 'metronomeChoisi', 'surGels']) expect(typeof a[nom], nom).toBe('function');
  });

  it('gels : bouchons → aucun gel ; un gel invalide (piste inconnue, début négatif, chevauchement) est ignoré', async () => {
    const m = nouveauMorceau('trap', 'C3');
    expect(await gelsDuMorceau(m, { frequence: 48000, attendre: true })).toEqual([]);
    const pcm: PcmSon = { frequence: 48000, canaux: [new Float32Array(10), new Float32Array(10)] };
    const g = (piste: string, de: number, a: number): Gel => ({ piste, de, a, pcm, cle: `${piste}-${de}` });
    const avant = outilsGels.fournisseurs;
    outilsGels.fournisseurs = [async () => [g('basse', 4, 8), g('basse', 6, 9), g('inconnue', 0, 1), g('accords', -1, 2), g('batterie', 0, 99)]];
    try {
      const gels = await gelsDuMorceau(m, { frequence: 48000, attendre: true });
      expect(gels.map((x) => x.cle)).toEqual(['batterie-0', 'basse-4']);
    } finally {
      outilsGels.fournisseurs = avant;
    }
  });

  it('crochet des prises : rend le MÊME PCM tant que V ne change rien', async () => {
    const m = nouveauMorceau('trap', 'C3');
    const pcm = { frequence: 48000, pcm: new Float32Array(4) };
    const prise = { id: 'p', ancre: { section: m.ordre[0]!, occurrence: 0, mesure: 0 }, tempo: m.tempo, fichier: 'prise-p.f32', frequence: 48000, duree: 1, debutCoupe: 0, finCoupe: 1, decalage: 0, gain: 1, choisie: true };
    expect(await crochetPrise(prise, m, pcm, true)).toBe(pcm);
  });

  it('un pad perso joue sa découpe (tranchesPads) : clé et tampon de la découpe, le son entier sinon', () => {
    const base = nouveauMorceau('trap', 'C3');
    const son = { id: 's1', nom: 'Boucle', fichier: 'son-s1.f32', frequence: 1000, duree: 2, canaux: 1 as const, tranches: [{ debut: 0.5, fin: 1 }] };
    const sons = new Map<string, PcmSon>([['son-s1.f32', { frequence: 1000, canaux: [Float32Array.from({ length: 2000 }, (_, i) => i)] }]]);
    const entier: Morceau = { ...base, sons: [son], pads: { perso1: 's1' } };
    const coupe: Morceau = { ...entier, tranchesPads: { perso1: 0 } };
    expect(clePad(entier, 'perso1', sons)).not.toBe(clePad(coupe, 'perso1', sons));
    const travail = (m: Morceau) => besoins(m, [], [], sons, 48000).get(clePad(m, 'perso1', sons)!)!.travail();
    const t = travail(coupe) as { canaux: Float32Array[] };
    expect(t.canaux[0]!.length).toBe(500);
    expect(t.canaux[0]![0]).toBe(500);
    expect((travail(entier) as { canaux: Float32Array[] }).canaux[0]!.length).toBe(2000);
  });

  it('nettoyage : plus d’option pour charger le worklet du master dans un contexte hors ligne', () => {
    expect('optionsMaster' in master).toBe(false);
  });
});
