// « Enregistrer » (Chanter et Beatbox) : section, calage (quantification), décompte d'une mesure, la section tourne en
// boucle ; « Arrêter et poser » met les notes (ou les frappes) dans le motif de la piste en UNE étape d'Annuler.

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  arreterEnregistrementNotes,
  demarrerEnregistrementNotes,
  poserNotesChantees,
} from '../../../moteur/api';
import { sectionDe } from '../../../morceau/acces';
import { T } from '../../../textes-fr';
import { afficherToast, modifier, morceau, sectionCourante } from '../../etat';
import { toastErreur } from '../../lecture';
import { ouvrirPianoRoll } from '../../navigation';

const QUANTIFS: { cle: keyof typeof T.chanter.quantifs; valeur: number | null }[] = [
  { cle: 'aucune', valeur: null },
  { cle: 'double', valeur: 1 },
  { cle: 'croche', valeur: 2 },
  { cle: 'noire', valeur: 4 },
];

interface Props {
  /** Piste qui reçoit les notes : une piste instrument, ou « batterie » (beatbox). */
  piste: string;
  /** Le direct (Chanter) ou le beatbox joue-t-il ? Sinon on le dit au lieu d'enregistrer. */
  enDirect: boolean;
  textes: {
    poser: string;
    enregistre: string;
    posees: (n: number) => string;
    rienEntendu: string;
    lancerDabord: string;
  };
}

export function EnregistrerNotes({ piste, enDirect, textes }: Props) {
  const m = morceau.value;
  const sections = m
    ? [...new Set(m.ordre)].map((id) => sectionDe(m, id)).filter((s) => s !== undefined)
    : [];
  const [section, setSection] = useState<string>(sectionCourante.peek() ?? sections[0]?.id ?? '');
  const [quantif, setQuantif] = useState<number | null>(1);
  const [phase, setPhase] = useState<'repos' | 'decompte' | 'enregistre'>('repos');
  const [compte, setCompte] = useState(4);
  const enCours = useRef(false);

  // Panneau fermé pendant l'enregistrement : on arrête sans rien poser.
  useEffect(
    () => () => {
      if (enCours.current) void arreterEnregistrementNotes().catch(() => undefined);
    },
    [],
  );

  async function lancer() {
    const x = morceau.peek();
    if (!x || phase !== 'repos') return;
    if (!enDirect) return afficherToast(textes.lancerDabord);
    setPhase('decompte');
    setCompte(4);
    const noire = 60000 / x.tempo;
    const minuteur = setInterval(() => setCompte((c) => Math.max(1, c - 1)), noire);
    enCours.current = true;
    try {
      await demarrerEnregistrementNotes(x, { piste, section, occurrence: 0, quantif });
      setPhase('enregistre');
    } catch (e) {
      enCours.current = false;
      setPhase('repos');
      toastErreur(e, T.chanter.erreurs.echec);
    } finally {
      clearInterval(minuteur);
    }
  }

  async function poser() {
    if (!enCours.current) return;
    enCours.current = false;
    setPhase('repos');
    try {
      const n = await arreterEnregistrementNotes();
      if (n.notes.length === 0 || !modifier((x) => poserNotesChantees(x, n)))
        return afficherToast(textes.rienEntendu);
      const action =
        piste === 'batterie'
          ? null
          : { label: T.chanter.voirNotes, agir: () => ouvrirPianoRoll(piste, 'complet') };
      afficherToast(textes.posees(n.notes.length), 5000, action);
    } catch (e) {
      toastErreur(e, T.chanter.erreurs.echec);
    }
  }

  return (
    <div class="dubler-enregistrer">
      <p class="dubler-etiquette" id="dubler-section">
        {T.chanter.section}
      </p>
      <div class="puces puces-defile" role="radiogroup" aria-labelledby="dubler-section">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            class="puce"
            aria-checked={s.id === section}
            disabled={phase !== 'repos'}
            onClick={() => setSection(s.id)}
            data-testid={`dubler-section-${s.id}`}
          >
            {s.nom}
          </button>
        ))}
      </div>
      <p class="dubler-etiquette" id="dubler-quantif">
        {T.chanter.quantif}
      </p>
      <div class="segments" role="radiogroup" aria-labelledby="dubler-quantif">
        {QUANTIFS.map((q) => (
          <button
            key={q.cle}
            type="button"
            role="radio"
            class="segment"
            aria-checked={quantif === q.valeur}
            disabled={phase !== 'repos'}
            onClick={() => setQuantif(q.valeur)}
            data-testid={`dubler-quantif-${q.cle}`}
          >
            {T.chanter.quantifs[q.cle]}
          </button>
        ))}
      </div>
      {phase === 'repos' ? (
        <button
          type="button"
          class="btn btn-rouge dubler-bouton"
          onClick={() => void lancer()}
          data-testid="dubler-enregistrer"
        >
          {T.chanter.enregistrer}
        </button>
      ) : (
        <>
          <p class="dubler-etat" aria-live="polite" data-testid="dubler-phase" data-phase={phase}>
            {phase === 'decompte' ? T.chanter.decompte(compte) : textes.enregistre}
          </p>
          <button
            type="button"
            class="btn btn-principal dubler-bouton"
            disabled={phase !== 'enregistre'}
            onClick={() => void poser()}
            data-testid="dubler-poser"
          >
            {textes.poser}
          </button>
        </>
      )}
    </div>
  );
}
