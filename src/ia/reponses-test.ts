// Réponses d'IA écrites à la main pour les tests (Vitest et e2e). Aucune vraie IA n'est appelée.
// Fichier pur, sans import : Playwright peut aussi le lire.

/** Un beat compact correct (phonk, 3 sections, batterie en écriture compacte). */
export const BEAT_OK = {
  titre: 'Drift de minuit',
  style: 'phonk',
  tempo: 135,
  tonalite: { tonique: 'G', mode: 'mineur' },
  motifs: {
    bat: { type: 'batterie', pas: 16, pistes: { kick: 'x-----x---x-----', snare: '----x-------x---', cowbell: 'x--x--x---x--x--', charley: 'x-x-x-x-x-x-x-x-' } },
    'bat-intro': { type: 'batterie', pas: 16, pistes: { charley: 'x-x-x-x-x-x-x-x-' } },
    basse: { type: 'basse', pas: 16, notes: [{ pas: 0, duree: 6, degre: 0 }, { pas: 10, duree: 4, degre: 4, octave: -1, glisse: true }] },
    acc: { type: 'accords', pas: 64, son: 'nappe', accords: [{ pas: 0, duree: 16, degre: 'i' }, { pas: 16, duree: 16, degre: 'VI' }, { pas: 32, duree: 16, degre: 'iv' }, { pas: 48, duree: 16, degre: 'V' }] },
    mel: { type: 'melodie', pas: 32, son: 'cloche', notes: [{ pas: 0, duree: 2, midi: 67 }, { pas: 4, duree: 2, midi: 70 }, { pas: 8, duree: 4, midi: 74 }, { pas: 16, duree: 8, midi: 72 }] },
  },
  sections: [
    { id: 'intro', nom: 'Intro', mesures: 4, motifs: { batterie: 'bat-intro', accords: 'acc', melodie: 'mel' }, fill: true },
    { id: 'couplet', nom: 'Couplet', mesures: 8, motifs: { batterie: 'bat', basse: 'basse', accords: 'acc' }, coupure: 'break' },
    { id: 'refrain', nom: 'Refrain', mesures: 8, motifs: { batterie: 'bat', basse: 'basse', accords: 'acc', melodie: 'mel' } },
  ],
  ordre: ['intro', 'couplet', 'refrain', 'couplet', 'refrain'],
};

/** « Continue mon idée » : un pont avec 2 nouveaux motifs (dont un id déjà pris dans le morceau) et un motif existant. */
export const SUITE_OK = {
  motifs: {
    'bat-pont': { type: 'batterie', pas: 16, pistes: { kick: 'x-------x-------', rim: '----x-------x---' } },
    accords: { type: 'melodie', pas: 32, son: 'pluck', notes: [{ pas: 0, duree: 4, midi: 65 }, { pas: 8, duree: 8, midi: 68 }] },
  },
  section: { nom: 'Pont', mesures: 8, motifs: { batterie: 'bat-pont', melodie: 'accords', accords: 'accords' }, coupure: 'drop' },
};

/** « Aide aux paroles » : 3 propositions (la 2e sans nombre de syllabes, la 3e avec du HTML). */
export const PAROLES_OK = {
  propositions: [
    { rime: '-ur', lignes: [{ texte: 'J’avance dans la nuit sans peur', syllabes: 8 }, { texte: 'La ville me prête sa chaleur', syllabes: 8 }] },
    { rime: '-on', lignes: [{ texte: 'Le bitume chante mon nom' }, { texte: 'J’écris ma vie au crayon' }] },
    { rime: '-é', lignes: [{ texte: '<img src=x onerror="alert(1)"> <b>Tout</b> est gravé', syllabes: 6 }] },
  ],
};

/** Enveloppe d'une réponse Anthropic (Messages API) contenant `texte`. */
export function enveloppeAnthropic(texte: string): unknown {
  return { id: 'msg_test', type: 'message', role: 'assistant', content: [{ type: 'text', text: texte }], stop_reason: 'end_turn' };
}
