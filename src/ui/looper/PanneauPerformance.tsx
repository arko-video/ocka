// Effets de fin de la section `sectionCourante` (R) : stutter, demi-tempo, tape stop, gate, reverse (Section.perf).
// Ouvert par ouvrirPerformance (Structure). Une pastille = un effet sur la fin de la section (1 temps, 2 temps ou
// 1 mesure) ; toucher la pastille allumée le retire. Un seul effet de fin à la fois (le nouveau remplace l'ancien).
// Le son est calculé hors ligne (Worker) : il s'entend dès qu'il est prêt, à l'écoute comme à l'export.

import { useSignal } from '@preact/signals';
import { ajouterEffetPerf, retirerEffetPerf } from '../../moteur/api';
import { TYPES_PERF, type EffetPerf, type Morceau } from '../../morceau/types';
import { T } from '../../textes-fr';
import { afficherToast, modifier, morceau, PANNEAUX, panneau, sectionCourante } from '../etat';
import { basculerLecture, boucle, enLecture } from '../lecture';
import { Panneau } from '../composants/Panneau';
import './looper.css';

const LONGUEURS = [4, 8, 16] as const;
const DIVISIONS = [2, 4, 8] as const;

/** L'effet de type `type` qui finit la section (ou −1). */
function indexFin(perf: readonly EffetPerf[], type: string, fin: number): number {
  return perf.findIndex((e) => e.type === type && e.pas + e.duree >= fin);
}

/** Pose `effet` sur la fin de la section : retire d'abord ceux qui le chevauchent. Une seule étape d'Annuler. */
function poser(m: Morceau, id: string, effet: EffetPerf): Morceau {
  let out = m;
  const s = m.sections.find((x) => x.id === id);
  const perf = s?.perf ?? [];
  for (let i = perf.length - 1; i >= 0; i--) {
    const e = perf[i]!;
    if (e.pas < effet.pas + effet.duree && e.pas + e.duree > effet.pas) out = retirerEffetPerf(out, id, i);
  }
  return ajouterEffetPerf(out, id, effet);
}

export function PanneauPerformance() {
  const longueur = useSignal<number>(4);
  const division = useSignal<number>(4);
  if (panneau.value !== PANNEAUX.performance) return null;
  const m = morceau.value;
  const id = sectionCourante.value ?? m?.ordre[0] ?? null;
  const s = m?.sections.find((x) => x.id === id);
  const t = T.performance;
  const fin = (s?.mesures ?? 1) * 16;
  const perf = s?.perf ?? [];

  function toucher(type: EffetPerf['type']) {
    if (!s) return;
    const i = indexFin(perf, type, fin);
    if (i >= 0) return void modifier((x) => retirerEffetPerf(x, s.id, i));
    const duree = Math.min(longueur.peek(), fin);
    const effet: EffetPerf = { type, pas: fin - duree, duree };
    if (type === 'stutter' || type === 'gate') effet.division = division.peek() as EffetPerf['division'];
    if (perf.length >= 8 && indexFin(perf, type, fin) < 0) afficherToast(t.plein);
    if (modifier((x) => poser(x, s.id, effet))) afficherToast(t.calcul, 2500);
  }

  function ecouter() {
    if (!s) return;
    sectionCourante.value = s.id;
    boucle.value = 'section';
    if (!enLecture.peek()) basculerLecture();
  }

  return (
    <Panneau id={PANNEAUX.performance} titre={t.titre}>
      <p class="aide" data-testid="performance-intro">
        {t.intro}
      </p>
      {!m || m.sections.length === 0 ? (
        <p class="aide">{t.aucuneSection}</p>
      ) : (
        <>
          <div class="r-defile" role="radiogroup" aria-label={t.section('')}>
            {m.ordre
              .filter((x, i, tous) => tous.indexOf(x) === i)
              .map((sid) => m.sections.find((x) => x.id === sid))
              .filter((x) => !!x)
              .map((x) => (
                <button
                  type="button"
                  class="puce"
                  role="radio"
                  aria-checked={x.id === s?.id}
                  onClick={() => (sectionCourante.value = x.id)}
                  data-testid={`perf-section-${x.id}`}
                >
                  {x.nom}
                  {x.perf?.length ? ' •' : ''}
                </button>
              ))}
          </div>
          <section class="r-bloc" aria-label={t.titre}>
            <div class="r-pastilles">
              {TYPES_PERF.map((type) => (
                <button
                  type="button"
                  class="r-pastille"
                  aria-pressed={indexFin(perf, type, fin) >= 0}
                  onClick={() => toucher(type)}
                  data-testid={`perf-${type}`}
                >
                  {t.noms[type]}
                  <small>{t.aides[type]}</small>
                </button>
              ))}
            </div>
            <div class="r-ligne" role="radiogroup" aria-label={t.longueur}>
              <span class="r-mesure">{t.longueur}</span>
              {LONGUEURS.map((n) => (
                <button
                  type="button"
                  class="puce"
                  role="radio"
                  aria-checked={longueur.value === n}
                  onClick={() => (longueur.value = n)}
                  data-testid={`perf-longueur-${n}`}
                >
                  {t.longueurs[n]}
                </button>
              ))}
            </div>
            <div class="r-ligne" role="radiogroup" aria-label={t.division}>
              <span class="r-mesure">{t.division}</span>
              {DIVISIONS.map((n) => (
                <button
                  type="button"
                  class="puce"
                  role="radio"
                  aria-checked={division.value === n}
                  onClick={() => (division.value = n)}
                  data-testid={`perf-division-${n}`}
                >
                  {t.divisions[n]}
                </button>
              ))}
            </div>
          </section>
          <section class="r-bloc">
            <h3>{t.actifs}</h3>
            {perf.length === 0 ? (
              <p class="aide">{t.aucun}</p>
            ) : (
              <ul class="r-liste" data-testid="perf-liste">
                {perf.map((e, i) => (
                  <li>
                    <span>
                      {t.noms[e.type]} · {t.longueurs[e.duree] ?? `${e.duree} pas`}
                      {e.division ? ` · ${t.divisions[e.division] ?? `÷${e.division}`}` : ''}
                    </span>
                    <button
                      type="button"
                      class="btn btn-petit btn-discret"
                      onClick={() => modifier((x) => retirerEffetPerf(x, s!.id, i))}
                    >
                      {t.retirer}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" class="btn btn-contour" onClick={ecouter} data-testid="perf-ecouter">
              {t.ecouter}
            </button>
          </section>
        </>
      )}
    </Panneau>
  );
}
