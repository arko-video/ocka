// Frise de l'étape Structure (vue « Frise ») : une ligne par piste (fixes et instrument), une colonne par passage de
// section ; chaque cellule est un clip qui boucle jusqu'à la fin de la section. Toucher un clip l'édite (piano roll
// pour une piste instrument) ; appui long : Vider, Copier le motif depuis…, Rendre unique (« dans N sections »).
// Défilement horizontal qui suit la tête de lecture. Réglage « Avancé » : un couloir d'automation sous une piste.

import { useEffect, useRef } from 'preact/hooks';
import { estPisteInstrument, idMotifDe, sectionDe } from '../../../morceau/acces';
import { arrangement, pasVersSecondes, secondesVersPas, type Occurrence } from '../../../morceau/temps';
import type { Morceau, Piste } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { modeAvance, modifier, motifEdite, PANNEAUX, sectionCourante, vueBeat } from '../../etat';
import { allerA, ouvrirPanneau, ouvrirPianoRoll } from '../../navigation';
import { allerAuTemps, enLecture, tempsLecture } from '../../lecture';
import { Couloir } from '../automation/Couloir';
import { nomCible, PanneauAutomation } from '../automation/PanneauAutomation';
import { couleurPiste, nomPiste, pistesFrise } from './apercu';
import { Clip } from './Clip';
import { basculerCouloir, clipVise, couloirs, PANNEAUX_FRISE, pisteAutomation, pointChoisi, zoomFrise, ZOOMS } from './etat-frise';
import { MenuClip } from './MenuClip';
import { retirerPoint } from '../../edition/automation';
import './frise.css';

/** Largeur de la colonne des noms (px). */
const NOM = 96;

interface Props {
  m: Morceau;
  /** Ouvre le panneau de la boucle d'une section (piste « Tes sons »). */
  ouvrirBoucle?: (idSection: string) => void;
}

export function Frise({ m, ouvrirBoucle }: Props) {
  const defile = useRef<HTMLDivElement>(null);
  const zoom = zoomFrise.value;
  const occs = arrangement(m);
  const total = occs.reduce((s, o) => s + o.pas, 0);
  const pistes = pistesFrise(m);
  const avance = modeAvance.value;
  const ouverts = couloirs.value;
  const t = tempsLecture.value;
  const joue = enLecture.value;
  const xTete = Math.min(total, secondesVersPas(m, t)) * zoom;

  // La tête de lecture reste visible : si elle sort de la vue, la frise défile.
  useEffect(() => {
    const d = defile.current;
    if (!d || !joue) return;
    const vue = d.clientWidth - NOM;
    if (xTete < d.scrollLeft + 8 || xTete > d.scrollLeft + vue - 24) d.scrollLeft = Math.max(0, xTete - vue / 4);
  }, [xTete, joue]);

  const editer = (idPiste: string, idSection: string) => {
    const p = m.pistes.find((x) => x.id === idPiste);
    sectionCourante.value = idSection;
    if (estPisteInstrument(p)) return ouvrirPianoRoll(idPiste);
    if (idPiste === 'sons') return ouvrirBoucle?.(idSection);
    if (idPiste === 'voix') return allerA('voix');
    if (idPiste === 'batterie') motifEdite.value = idMotifDe(sectionDe(m, idSection), 'batterie') ?? motifEdite.peek();
    vueBeat.value = 'batterie';
    allerA('beat');
  };
  const menu = (p: Piste, o: Occurrence) => {
    clipVise.value = { piste: p.id, section: o.section.id };
    ouvrirPanneau(PANNEAUX_FRISE.clip);
  };
  const toucher = (p: Piste, o: Occurrence) => {
    const aMotif = idMotifDe(o.section, p.id) !== undefined;
    if (estPisteInstrument(p) || p.id === 'voix' || p.id === 'sons' || (p.id === 'batterie' && aMotif)) editer(p.id, o.section.id);
    else menu(p, o);
  };
  const choisi = pointChoisi.value;

  return (
    <div class="frise" data-testid="frise" data-pistes={pistes.length} style={{ '--nom': `${NOM}px` }}>
      <div class="frise-barre">
        <p class="aide">{T.frise.aide}</p>
        <div class="frise-zoom">
          <button type="button" class="btn-bascule btn-carre" aria-label={T.frise.zoomMoins} disabled={zoom <= ZOOMS[0]} onClick={() => (zoomFrise.value = ZOOMS[Math.max(0, ZOOMS.indexOf(zoom as never) - 1)]!)} data-testid="frise-zoom-moins">
            −
          </button>
          <button type="button" class="btn-bascule btn-carre" aria-label={T.frise.zoomPlus} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => (zoomFrise.value = ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom as never) + 1)]!)} data-testid="frise-zoom-plus">
            +
          </button>
        </div>
      </div>

      <div class="frise-defile" ref={defile} data-testid="frise-defile">
        <div class="frise-contenu" style={{ width: `${NOM + total * zoom}px` }}>
          <div class="frise-ligne frise-regle">
            <div class="frise-nom" />
            {occs.map((o) => (
              <button
                key={o.index}
                type="button"
                class="frise-passage"
                data-courant={sectionCourante.value === o.section.id ? '1' : '0'}
                style={{ width: `${o.pas * zoom}px` }}
                aria-label={T.frise.allerSection(o.section.nom)}
                onClick={() => {
                  sectionCourante.value = o.section.id;
                  allerAuTemps(pasVersSecondes(m, o.debutPas));
                }}
                data-testid={`frise-passage-${o.index}`}
              >
                <span class="texte-coupe">{o.section.nom}</span>
              </button>
            ))}
          </div>

          {pistes.map((p) => {
            const couleur = couleurPiste(m, p);
            const nom = nomPiste(p);
            const cible = ouverts[p.id];
            return (
              <div key={p.id} class="frise-piste" data-testid={`frise-piste-${p.id}`}>
                <div class="frise-ligne">
                  <div class="frise-nom" style={{ '--c': couleur }}>
                    <span class="frise-nom-texte texte-coupe">{nom}</span>
                    {avance && p.id !== 'voix' && p.id !== 'sons' && (
                      <button type="button" class="frise-auto" aria-pressed={!!cible} aria-label={`${T.automation.montrer} ${nom}`} onClick={() => basculerCouloir(p.id)} data-testid={`auto-${p.id}`}>
                        A
                      </button>
                    )}
                  </div>
                  {occs.map((o) => (
                    <Clip key={o.index} m={m} p={p} nom={nom} o={o} couleur={couleur} zoom={zoom} toucher={() => toucher(p, o)} appuiLong={() => menu(p, o)} />
                  ))}
                </div>
                {avance && cible && (
                  <div class="frise-ligne frise-couloir">
                    <div class="frise-nom frise-nom-couloir">
                      <button
                        type="button"
                        class="frise-cible texte-coupe"
                        onClick={() => {
                          pisteAutomation.value = p.id;
                          ouvrirPanneau(PANNEAUX_FRISE.automation);
                        }}
                        data-testid={`auto-cible-${p.id}`}
                      >
                        {nomCible(p, cible)}
                        {(p.lfo?.length ?? 0) > 0 && <span class="frise-lfo">{T.melangeur.lfo}</span>}
                      </button>
                      {choisi?.piste === p.id && (
                        <button
                          type="button"
                          class="frise-retirer"
                          aria-label={T.automation.retirerPoint}
                          onClick={() => {
                            modifier((x) => retirerPoint(x, p.id, cible, choisi.section, choisi.indice));
                            pointChoisi.value = null;
                          }}
                          data-testid={`auto-retirer-${p.id}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {occs.map((o) => (
                      <Couloir key={o.index} m={m} idPiste={p.id} cible={cible} o={o} zoom={zoom} couleur={couleur} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {(joue || t > 0) && <div class="frise-tete" style={{ left: `${NOM + xTete}px` }} aria-hidden="true" data-testid="frise-tete" />}
        </div>
      </div>

      {!avance && (
        <p class="aide frise-avance">
          {T.frise.avancePourAuto}{' '}
          <button type="button" class="lien" onClick={() => ouvrirPanneau(PANNEAUX.avance)} data-testid="frise-ouvrir-avance">
            {T.frise.ouvrirAvance}
          </button>
        </p>
      )}

      <MenuClip editer={editer} nomPiste={(id) => nomPiste(m.pistes.find((x) => x.id === id)!)} />
      <PanneauAutomation />
    </div>
  );
}
