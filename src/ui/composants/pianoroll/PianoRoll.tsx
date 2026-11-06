// Piano roll en plein écran de la piste `pisteEditee` — propriétaire : U1 (décisions v2 §6).
// Barre de 48 px : retour, lecture, « Simple | Complet », Annuler. Puis la piste, la section (« dans N sections » :
// Rendre unique) et « Rester dans la gamme ». « Simple » = les 8 pads de la gamme (composants/melodie) sur cette
// piste ; « Complet » = EditeurComplet (clavier, grille à gestes, vélocité, outils). Retour (Android) le ferme.

import { useEffect, useRef } from 'preact/hooks';
import { pisteDe } from '../../../morceau/acces';
import { T } from '../../../textes-fr';
import { partageDe, rendreUniqueMotif } from '../../edition/notes';
import {
  afficherToast,
  annulerAction,
  historique,
  modePianoRoll,
  modifier,
  morceau,
  PANNEAUX,
  panneau,
  pisteEditee,
  sectionCourante,
} from '../../etat';
import { basculerLecture, boucle, enLecture } from '../../lecture';
import { fermerPanneau } from '../../navigation';
import { IconeAnnuler, IconeLecture, IconePause, IconeRetour } from '../Icones';
import { sectionAffichee, sectionsUniques, VueMelodie } from '../melodie/VueMelodie';
import { nomInstrument } from '../pistes/catalogue';
import '../pistes/pistes.css';
import { EditeurComplet } from './EditeurComplet';
import { gammeSeule } from './vue';
import './pianoroll.css';
import './pianoroll-grille.css';
import './pianoroll-outils.css';

export function PianoRoll() {
  const ouvert = panneau.value === PANNEAUX.pianoRoll;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const avant = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerPanneau();
    };
    window.addEventListener('keydown', touche);
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', touche);
      document.body.style.overflow = debordement;
      avant?.focus?.();
    };
  }, [ouvert]);
  if (!ouvert) return null;
  const m = morceau.value;
  const p = m && pisteEditee.value ? pisteDe(m, pisteEditee.value) : undefined;
  const piste = p?.genre === 'instrument' ? p : null;
  const section = m ? sectionAffichee(m) : undefined;
  const mode = modePianoRoll.value;
  const partage = m && piste && section ? partageDe(m, piste.id, section.id) : 0;
  const lit = enLecture.value;

  return (
    <div
      class="pr"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={T.pianoRoll.titre(piste?.nom ?? '')}
      data-mode={mode}
      data-testid="panneau-piano-roll"
    >
      <header class="pr-barre">
        <button
          type="button"
          class="btn-icone"
          aria-label={T.retour}
          onClick={fermerPanneau}
          data-testid="pr-retour"
        >
          <IconeRetour taille={22} />
        </button>
        <button
          type="button"
          class="btn-icone pr-lecture"
          aria-label={lit ? T.pianoRoll.pause : T.pianoRoll.lecture}
          onClick={() => {
            if (!lit && section) {
              sectionCourante.value = section.id;
              boucle.value = 'section';
            }
            basculerLecture();
          }}
          data-testid="pr-lecture"
        >
          {lit ? <IconePause taille={20} /> : <IconeLecture taille={20} />}
        </button>
        <div class="segments pr-modes" role="radiogroup" aria-label={T.pianoRoll.mode}>
          {(['simple', 'complet'] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={mode === x}
              class="segment"
              onClick={() => (modePianoRoll.value = x)}
              data-testid={`pr-mode-${x}`}
            >
              {T.pianoRoll[x]}
            </button>
          ))}
        </div>
        <button
          type="button"
          class="btn-icone"
          aria-label={T.annuler}
          disabled={!historique.value?.peutAnnuler}
          onClick={annulerAction}
          data-testid="pr-annuler"
        >
          <IconeAnnuler taille={22} />
        </button>
      </header>

      {!m || !piste || !section ? (
        <p class="vide">{T.pianoRoll.vide}</p>
      ) : (
        <>
          <div class="pr-infos">
            <span class="pr-piste">
              <span class="pr-piste-nom">{piste.nom}</span>
              <span class="pr-piste-instr">{nomInstrument(piste.instrument)}</span>
            </span>
            <select
              class="pr-section"
              aria-label={T.pianoRoll.section}
              value={section.id}
              onChange={(e) => (sectionCourante.value = (e.target as HTMLSelectElement).value)}
              data-testid="pr-section"
            >
              {sectionsUniques(m).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
            {mode === 'complet' && (
              <label class="pr-gamme" title={T.pianoRoll.resterGamme}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={gammeSeule.value}
                  onChange={(e) => (gammeSeule.value = (e.target as HTMLInputElement).checked)}
                  data-testid="pr-gamme"
                />
                <span>{T.pianoRoll.gamme}</span>
              </label>
            )}
          </div>
          {partage > 1 && (
            <div class="pr-partage" role="note">
              <span>{T.pianoRoll.partage(partage)}</span>
              <button
                type="button"
                class="pr-lien"
                onClick={() =>
                  modifier((x) => rendreUniqueMotif(x, section.id, piste.id)) &&
                  afficherToast(T.pianoRoll.rendu)
                }
                data-testid="pr-rendre-unique"
              >
                {T.pianoRoll.rendreUnique}
              </button>
            </div>
          )}
          {mode === 'simple' ? (
            <div class="pr-simple" data-testid="pr-simple">
              <VueMelodie m={m} piste={piste.id} sansSections />
            </div>
          ) : (
            <EditeurComplet m={m} piste={piste} idSection={section.id} />
          )}
        </>
      )}
    </div>
  );
}
