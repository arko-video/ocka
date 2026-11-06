// Looper façon BandLab (R) : grille pistes × motifs, lancement à la mesure, « Enregistrer ce que je joue ».
// Ouvert par ouvrirLooper (« Jouer en direct », Structure). Le looper joue par le lecteur de l'appli ; en fermant le
// panneau, le lecteur reprend le morceau. « Garder dans le morceau » ajoute les sections jouées en UNE étape d'Annuler.

import { useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import {
  creerLooper,
  grilleLooper,
  journalVersMorceau,
  type CelluleLooper,
  type Looper,
} from '../../moteur/api';
import type { Morceau } from '../../morceau/types';
import { T } from '../../textes-fr';
import { afficherToast, modifier, morceau, PANNEAUX, panneau } from '../etat';
import { arreterLecture, enLecture, obtenirLecteur, reappliquerReglages, reserverLecteurAuLooper, toastErreur } from '../lecture';
import { Panneau } from '../composants/Panneau';
import './looper.css';

/** Les lignes de la grille : une par piste, avec un nom lisible par case (section où la boucle apparaît d'abord). */
function lignes(m: Morceau, grille: CelluleLooper[]) {
  const parPiste = new Map<string, { cellule: CelluleLooper; nom: string }[]>();
  for (const c of grille) {
    const liste = parPiste.get(c.piste) ?? [];
    const s = m.ordre
      .map((id) => m.sections.find((x) => x.id === id))
      .find((x) => x?.motifs[c.piste] === c.motif);
    let nom = s?.nom ?? T.looper.motif(liste.length + 1);
    if (liste.some((x) => x.nom === nom)) nom = `${nom} ${liste.length + 1}`;
    liste.push({ cellule: c, nom });
    parPiste.set(c.piste, liste);
  }
  return [...parPiste].map(([piste, cases]) => {
    const p = m.pistes.find((x) => x.id === piste);
    return { piste, nom: p?.genre === 'instrument' ? p.nom : (T.looper.pistes[piste] ?? piste), cases };
  });
}

function Grille({ looper, m }: { looper: Looper; m: Morceau }) {
  const grille = useMemo(() => lignes(m, grilleLooper(m)), [m]);
  if (grille.length === 0) return <p class="aide">{T.looper.vide}</p>;
  const toucher = (c: CelluleLooper) => {
    const joue = looper.actifs[c.piste] === c.motif;
    looper.lancer(joue ? { piste: c.piste, motif: null } : c);
    if (!joue) void looper.demarrer().catch(toastErreur);
  };
  return (
    <div class="r-grille" data-testid="looper-grille">
      {grille.map((l) => (
        <div class="r-piste">
          <span class="r-piste-nom">{l.nom}</span>
          <div class="r-cases">
            {l.cases.map(({ cellule, nom }) => {
              const attente = looper.enAttente.some(
                (a) => a.piste === cellule.piste && a.motif === cellule.motif,
              );
              const etat = attente
                ? 'attente'
                : looper.actifs[cellule.piste] === cellule.motif
                  ? 'joue'
                  : 'rien';
              return (
                <button
                  type="button"
                  class="r-case"
                  data-etat={etat}
                  aria-pressed={etat === 'joue'}
                  onClick={() => toucher(cellule)}
                  data-testid={`looper-case-${cellule.piste}-${cellule.motif}`}
                >
                  {nom}
                </button>
              );
            })}
            <button
              type="button"
              class="r-case r-case-stop"
              onClick={() => looper.lancer({ piste: l.piste, motif: null })}
              data-testid={`looper-stop-${l.piste}`}
            >
              {T.looper.stop}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Contenu() {
  const m = morceau.peek()!;
  const version = useSignal(0);
  const ref = useRef<Looper | null>(null);
  const [looper, base] = useMemo(() => {
    const lecteur = obtenirLecteur();
    return lecteur ? [creerLooper(lecteur, m), m] : [null, m];
    // Un looper par ouverture du panneau (le morceau de départ fixe la grille).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ref.current = looper;
  useEffect(() => {
    arreterLecture();
    reserverLecteurAuLooper(looper !== null);
    const fin = looper?.surChangement(() => version.value++);
    return () => {
      fin?.();
      looper?.detruire();
      reserverLecteurAuLooper(false);
      const l = obtenirLecteur();
      const actuel = morceau.peek();
      if (l && actuel) void l.charger(actuel).then(reappliquerReglages, (e: unknown) => console.error(e));
    };
  }, [looper]);
  void version.value;
  if (!looper) return <p class="aide">{T.barre.pasPret}</p>;
  const t = T.looper;
  const demarre = enLecture.value;

  function garder() {
    const lp = ref.current!;
    lp.enregistrer(false);
    const journal = lp.journal;
    lp.arreter();
    try {
      let ajout = 0;
      const fait = modifier((x) => {
        const y = journalVersMorceau(x, journal);
        ajout = y.ordre.length - x.ordre.length;
        return y;
      });
      afficherToast(fait ? t.ajoutees(ajout) : t.rien);
    } catch (e) {
      toastErreur(e);
    }
  }

  return (
    <>
      <div class="r-transport">
        <button
          type="button"
          class="btn btn-contour"
          onClick={() =>
            looper.enregistre
              ? garder()
              : demarre
                ? looper.arreter()
                : void looper.demarrer().catch(toastErreur)
          }
          data-testid="looper-transport"
        >
          {demarre ? t.arreter : t.jouer}
        </button>
        <span class="r-mesure" data-testid="looper-mesure">
          {t.mesure(looper.mesure + 1)}
        </span>
      </div>
      <button
        type="button"
        class="btn btn-principal r-enr"
        aria-pressed={looper.enregistre}
        onClick={() =>
          looper.enregistre ? garder() : (looper.enregistrer(true), void looper.demarrer().catch(toastErreur))
        }
        data-testid="looper-enregistrer"
      >
        {looper.enregistre ? t.finEnregistrer : t.enregistrer}
      </button>
      {looper.enregistre && <p class="aide">{t.enregistre}</p>}
      <Grille looper={looper} m={base} />
    </>
  );
}

export function PanneauLooper() {
  if (panneau.value !== PANNEAUX.looper || !morceau.value) return null;
  return (
    <Panneau id={PANNEAUX.looper} titre={T.looper.titre}>
      <p class="aide" data-testid="looper-intro">
        {T.looper.intro}
      </p>
      <Contenu />
    </Panneau>
  );
}
