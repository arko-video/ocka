// Textes de l'accueil (onglets Morceaux | Sorties, import d'un projet) et du choix du style. Propriétaire : A1.
// C2 : les noms et phrases des styles sont dans le registre (morceau/styles/<id>.ts) ; familles et recherche :
// textes/styles-autres.ts (S2).
// Groupe `allerVite` (vague B, B1) : « Au hasard », « Une autre idée », « Revenir », Boucles OCKA.

import { DEFINITIONS_STYLES, type DefinitionStyle } from '../morceau/styles/index';
import type { Mode, Style } from '../morceau/types';
import type { TypeBoucle } from '../aller-vite/boucles';

const parStyle = <T>(lire: (d: DefinitionStyle) => T): Readonly<Record<Style, T>> =>
  Object.fromEntries(Object.values(DEFINITIONS_STYLES).map((d) => [d.id, lire(d)])) as Record<Style, T>;

export const TEXTES_ACCUEIL = {
  accueil: {
    titre: 'Mes morceaux',
    onglets: { morceaux: 'Morceaux', sorties: 'Sorties' },
    accroche: 'Fais ton beat, pose ta voix, sors ton son.',
    nouveau: 'Nouveau morceau',
    vide: 'Aucun morceau pour l’instant. Ton premier son t’attend.',
    ouvrir: (titre: string) => `Ouvrir « ${titre} »`,
    actions: (titre: string) => `Actions pour « ${titre} »`,
    renommer: 'Renommer',
    dupliquer: 'Dupliquer',
    supprimer: 'Supprimer',
    nouveauNom: 'Nouveau nom',
    confirmerSuppression: (titre: string) => `Supprimer « ${titre} » ? Ses prises de voix seront effacées aussi.`,
    supprime: 'Morceau supprimé.',
    duplique: 'Morceau dupliqué.',
    introuvable: 'Ce morceau est introuvable.',
    erreurListe: 'Impossible de lire tes morceaux.',
    ongletsAria: 'Morceaux ou sorties',
    titreSorties: 'Mes sorties',
    accrocheSorties: 'Un single, un EP ou un album, prêt à envoyer sur Spotify.',
    nouvelleSortie: 'Nouvelle sortie',
    sortiesVide: 'Aucune sortie pour l’instant. Ouvre un morceau, puis « Sortir sur Spotify » dans Exporter, ou touche « Nouvelle sortie ».',
    erreurSorties: 'Impossible de lire tes sorties.',
    ouvrirSortie: (titre: string) => `Ouvrir la sortie « ${titre} »`,
    actionsSortie: (titre: string) => `Actions pour la sortie « ${titre} »`,
    supprimerSortie: 'Supprimer la sortie',
    confirmerSuppressionSortie: (titre: string) => `Supprimer la sortie « ${titre} » ? Tes morceaux ne sont pas effacés.`,
    sortieSupprimee: 'Sortie supprimée.',
    sansTitre: 'Sans titre',
    importer: 'Importer un projet',
    importAide: 'Un fichier .ocka (morceau) ou .ocka-sortie (sortie complète).',
    importEnCours: 'Import en cours…',
    importe: 'Projet importé.',
    erreurImport: 'Ce projet n’a pas pu être importé.',
  },

  styles: {
    titre: 'Choisis un style',
    intro: 'Tout est prêt : batterie, basse, accords et 6 sections. Tu pourras tout changer.',
    bpm: (t: number) => `${t} BPM`,
    // Noms, tempos et phrases : dans le fichier de chaque style (morceau/styles/<id>.ts, registre).
    noms: parStyle((d) => d.textes.nom),
    tempos: parStyle((d) => d.reglages.tempo),
    phrases: parStyle((d) => d.textes.phrase),
    erreur: 'Impossible de créer le morceau pour l’instant.',
  },

  allerVite: {
    hasard: 'Au hasard',
    hasardPhrase: 'Un style, un tempo, une tonalité, des accords et une mélodie tirés pour toi.',
    hasardTitre: 'Ton idée',
    resume: (style: string, tempo: number, note: string, mode: Mode) => `${style} · ${tempo} BPM · ${note} ${mode}`,
    details: (suite: string, boucle: string) => `Accords « ${suite} » · ${boucle}`,
    cestParti: 'C’est parti',
    autreIdee: 'Une autre idée',
    revenir: 'Revenir',
    revenirAide: 'Reprend l’idée d’avant.',
    numero: (n: number) => `Idée n° ${n}`,
    ideeBatterie: 'Nouvelle idée de batterie. « Revenir » reprend celle d’avant.',
    ideeMelodie: 'Nouvelle idée de mélodie. « Revenir » reprend celle d’avant.',
    revenu: 'Idée d’avant reprise.',
    boucles: 'Boucles OCKA',
    bouclesTitre: (section: string) => `Boucles OCKA · ${section}`,
    bouclesAide: 'Des mélodies prêtes, écrites sur tes accords et ta gamme : jamais de fausse note.',
    preparation: 'Préparation de l’écoute…',
    erreurEcoute: 'L’écoute n’a pas pu être préparée. Tu peux quand même utiliser une boucle.',
    ecouter: (nom: string) => `Écouter « ${nom} »`,
    arreter: (nom: string) => `Arrêter « ${nom} »`,
    utiliser: 'Utiliser',
    utiliserAide: (nom: string) => `Utiliser « ${nom} » sur cette section`,
    posee: (nom: string) => `« ${nom} » est sur la section. Annule si ça ne te plaît pas.`,
    vinyle: 'Vinyle',
    nomsBoucles: {
      cloche: 'Motif de cloche',
      arpege: 'Arpège',
      contrechant: 'Contre-chant',
      refrain: 'Mélodie de refrain',
      nappe: 'Nappe',
      pince: 'Accords pincés',
    } satisfies Record<TypeBoucle, string>,
    phrasesBoucles: {
      cloche: 'La cloche 808 en double-croches, le son du phonk.',
      arpege: 'Les notes des accords, une par une, qui montent et descendent.',
      contrechant: 'Des notes longues dans l’aigu, qui répondent à ta voix.',
      refrain: 'Un petit air qui revient, facile à retenir.',
      nappe: 'Une note tenue par accord, pour remplir doucement.',
      pince: 'Deux notes courtes sur les contretemps, pour le groove.',
    } satisfies Record<TypeBoucle, string>,
  },
};
