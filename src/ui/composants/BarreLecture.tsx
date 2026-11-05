// Barre de lecture toujours visible en bas du studio : Lecture/Pause, position, boucle, métronome.

import { dureeMorceau } from '../../moteur/api';
import { T } from '../../textes-fr';
import { morceau, sectionCourante } from '../etat';
import { mmss } from '../format';
import { boucle, basculerLecture, enLecture, metronomeActif, tempsLecture } from '../lecture';
import { IconeBoucle, IconeLecture, IconeMetronome, IconePause } from './Icones';

export function BarreLecture() {
  const m = morceau.value;
  if (!m) return null;
  const lit = enLecture.value;
  const nomSection = m.sections.find((s) => s.id === sectionCourante.value)?.nom ?? T.barre.boucleSection;
  const surSection = boucle.value === 'section';
  return (
    <div class="barre-lecture" role="region" aria-label={T.lecture} data-testid="barre-lecture">
      <button
        type="button"
        class="btn-lecture"
        aria-label={lit ? T.pause : T.lecture}
        aria-keyshortcuts="Space"
        onClick={basculerLecture}
        data-testid="lecture"
        data-etat={lit ? 'lecture' : 'pause'}
      >
        {lit ? <IconePause taille={26} /> : <IconeLecture taille={26} />}
      </button>
      <div class="barre-temps chiffres" aria-label={T.barre.position} data-testid="position">
        <span class="barre-temps-actuel">{mmss(tempsLecture.value)}</span>
        <span class="barre-temps-total">/ {mmss(dureeMorceau(m))}</span>
      </div>
      <button
        type="button"
        class="btn-bascule"
        aria-pressed={surSection}
        aria-label={T.barre.boucleAide(surSection ? nomSection : T.barre.boucleMorceau)}
        onClick={() => (boucle.value = surSection ? 'morceau' : 'section')}
        data-testid="boucle"
      >
        <IconeBoucle taille={18} />
        <span class="btn-bascule-texte">{surSection ? nomSection : T.barre.boucleMorceau}</span>
      </button>
      <button
        type="button"
        class="btn-bascule btn-carre"
        aria-pressed={metronomeActif.value}
        aria-label={T.barre.metronome}
        title={T.barre.metronome}
        onClick={() => (metronomeActif.value = !metronomeActif.peek())}
        data-testid="metronome"
      >
        <IconeMetronome taille={20} />
      </button>
    </div>
  );
}
