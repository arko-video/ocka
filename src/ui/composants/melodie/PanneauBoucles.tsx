// Panneau « Boucles OCKA » : 6 mélodies prêtes écrites sur les accords de la section. À l'ouverture, l'écoute de
// toutes les boucles est préparée d'un coup (rendu hors temps réel) : un toucher sur ▶ joue tout de suite.
// « Utiliser » pose la boucle sur la section : une seule étape d'Annuler.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { boucles, poserMelodie, preparerEcoute, type Boucle, type Ecoute } from '../../../moteur/api';
import type { Morceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { arreterLecture } from '../../lecture';
import { fermerPanneau } from '../../navigation';
import { IconeLecture, IconeStop } from '../Icones';
import { Panneau } from '../Panneau';

export const PANNEAU_BOUCLES = 'boucles-ocka';

/** Petit aperçu des notes (une barre par note), pour reconnaître la forme de la boucle. */
function Apercu({ b }: { b: Boucle }) {
  const notes = b.motif.notes;
  const bas = Math.min(...notes.map((n) => n.midi));
  const haut = Math.max(...notes.map((n) => n.midi), bas + 1);
  return (
    <svg class="boucle-apercu" viewBox={`0 0 ${b.motif.pas} 10`} preserveAspectRatio="none" aria-hidden="true">
      {notes.map((n, i) => (
        <rect key={i} x={n.pas} y={8.5 - (7.5 * (n.midi - bas)) / (haut - bas)} width={Math.max(0.6, n.duree - 0.3)} height="1.5" rx="0.5" fill="currentColor" />
      ))}
    </svg>
  );
}

export function PanneauBoucles({ m, idSection, nomSection }: { m: Morceau; idSection: string; nomSection: string }) {
  // Les boucles dépendent des accords, de la gamme et de la longueur de la section (pas des autres réglages).
  const section = m.sections.find((s) => s.id === idSection);
  const cle = JSON.stringify([m.tonalite, m.style, section?.mesures, section?.motifs.accords && m.motifs[section.motifs.accords]]);
  const liste = useMemo(() => boucles(m, idSection), [cle, idSection]);
  const [ecoute, setEcoute] = useState<Ecoute | null>(null);
  const [etat, setEtat] = useState<'preparation' | 'prete' | 'erreur'>('preparation');
  const [joue, setJoue] = useState(-1);
  const ecouteRef = useRef<Ecoute | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    setEtat('preparation');
    setJoue(-1);
    // Le morceau tel qu'il est à l'ouverture (tempo, kit, volumes) : la préparation n'est pas refaite à chaque geste.
    preparerEcoute(m, idSection, liste.map((b) => b.motif), controle.signal)
      .then((e) => {
        if (controle.signal.aborted) return e.detruire();
        ecouteRef.current = e;
        setEcoute(e);
        setEtat('prete');
      })
      .catch((e: unknown) => {
        if (!controle.signal.aborted) {
          console.error(e);
          setEtat('erreur');
        }
      });
    return () => {
      controle.abort();
      ecouteRef.current?.detruire();
      ecouteRef.current = null;
    };
  }, [liste]);

  const basculer = (k: number) => {
    if (!ecoute) return;
    if (joue === k) {
      ecoute.arreter();
      setJoue(-1);
      return;
    }
    arreterLecture(); // le morceau s'arrête pendant l'écoute
    ecoute.jouer(k);
    setJoue(k);
  };
  const utiliser = (b: Boucle) => {
    ecoute?.arreter();
    const nom = T.allerVite.nomsBoucles[b.type];
    if (modifier((x) => poserMelodie(x, idSection, b.motif))) afficherToast(T.allerVite.posee(nom), 5000, { label: T.annuler, agir: annulerAction });
    fermerPanneau();
  };

  return (
    <Panneau id={PANNEAU_BOUCLES} titre={T.allerVite.bouclesTitre(nomSection)}>
      <p class="aide">{T.allerVite.bouclesAide}</p>
      {etat !== 'prete' && (
        <p class="aide" role="status" data-testid="boucles-etat">
          {etat === 'preparation' ? T.allerVite.preparation : T.allerVite.erreurEcoute}
        </p>
      )}
      <ul class="liste-boucles" data-testid="liste-boucles">
        {liste.map((b, k) => {
          const nom = T.allerVite.nomsBoucles[b.type];
          return (
            <li key={b.type} class="boucle" data-joue={joue === k ? '1' : '0'} data-testid={`boucle-${b.type}`}>
              <button
                type="button"
                class="boucle-ecouter"
                disabled={etat !== 'prete'}
                aria-pressed={joue === k}
                aria-label={joue === k ? T.allerVite.arreter(nom) : T.allerVite.ecouter(nom)}
                onClick={() => basculer(k)}
                data-testid={`ecouter-${b.type}`}
              >
                {joue === k ? <IconeStop taille={22} /> : <IconeLecture taille={22} />}
              </button>
              <span class="boucle-texte">
                <span class="boucle-nom">{nom}</span>
                <span class="boucle-phrase">{T.allerVite.phrasesBoucles[b.type]}</span>
                <Apercu b={b} />
              </span>
              <button
                type="button"
                class="btn btn-contour btn-petit"
                aria-label={T.allerVite.utiliserAide(nom)}
                onClick={() => utiliser(b)}
                data-testid={`utiliser-${b.type}`}
              >
                {T.allerVite.utiliser}
              </button>
            </li>
          );
        })}
      </ul>
    </Panneau>
  );
}
