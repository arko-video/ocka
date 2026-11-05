// Choix du style : la carte « Au hasard » (une idée tirée par une graine : on peut en tirer une autre ou revenir
// à celle d'avant), puis les 6 grosses cartes de style. Un appui crée un morceau déjà prêt et ouvre Beat.

import { useMemo, useState } from 'preact/hooks';
import { ideeAuHasard, nouvelleGraine, type Idee } from '../../moteur/api';
import { hauteurTonique } from '../../morceau/theorie';
import { STYLES, type Morceau, type Style } from '../../morceau/types';
import { T } from '../../textes-fr';
import { creerMorceau, creerMorceauDepuis } from '../mes-morceaux';
import { remplacerPar, retour } from '../navigation';
import { BoutonAide } from '../aide/BoutonAide';
import { IconeDe, IconeRetour } from '../composants/Icones';

/** Les graines tirées (la dernière est l'idée affichée) : « Revenir » remonte d'une graine. */
function CarteHasard({ occupe, creer }: { occupe: boolean; creer: (m: Morceau) => void }) {
  const [graines, setGraines] = useState<number[]>([]);
  const graine = graines[graines.length - 1];
  const idee: Idee | null = useMemo(() => (graine === undefined ? null : ideeAuHasard(graine)), [graine]);
  const tirer = () => setGraines((g) => [...g, nouvelleGraine()].slice(-50));
  return (
    <section class="carte-hasard" aria-labelledby="titre-hasard" data-testid="carte-hasard">
      <div class="carte-hasard-tete">
        <h2 id="titre-hasard" class="carte-hasard-nom">
          <IconeDe taille={22} /> {idee ? T.allerVite.hasardTitre : T.allerVite.hasard}
        </h2>
        {idee && <span class="idee-numero chiffres">{T.allerVite.numero(graines.length)}</span>}
      </div>
      {idee ? (
        <>
          <p class="idee-resume" aria-live="polite" data-testid="idee-resume">
            {T.allerVite.resume(T.styles.noms[idee.style], idee.tempo, T.melodie.notes[hauteurTonique(idee.tonique)]!, idee.mode)}
          </p>
          <p>{T.allerVite.details(idee.suite, T.allerVite.nomsBoucles[idee.boucle])}</p>
          <div class="idees">
            <button
              type="button"
              class="btn btn-principal"
              disabled={occupe}
              onClick={() => creer({ ...idee.morceau, titre: T.styles.noms[idee.style] })}
              data-testid="hasard-creer"
            >
              {T.allerVite.cestParti}
            </button>
            <button type="button" class="btn btn-contour" disabled={occupe} onClick={tirer} data-testid="hasard-autre">
              <IconeDe taille={18} /> {T.allerVite.autreIdee}
            </button>
            {graines.length > 1 && (
              <button
                type="button"
                class="btn btn-discret"
                disabled={occupe}
                title={T.allerVite.revenirAide}
                onClick={() => setGraines((g) => g.slice(0, -1))}
                data-testid="hasard-revenir"
              >
                <IconeRetour taille={18} /> {T.allerVite.revenir}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p>{T.allerVite.hasardPhrase}</p>
          <div class="idees">
            <button type="button" class="btn btn-contour" disabled={occupe} onClick={tirer} data-testid="style-hasard">
              <IconeDe taille={18} /> {T.allerVite.hasard}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function ChoixStyle() {
  const [occupe, setOccupe] = useState(false);
  const lancer = async (faire: () => Promise<boolean>) => {
    if (occupe) return;
    setOccupe(true);
    if (await faire()) remplacerPar('beat');
    setOccupe(false);
  };
  return (
    <div class="ecran" data-testid="ecran-styles">
      <header class="entete">
        <button type="button" class="btn-icone" aria-label={T.retour} onClick={retour} data-testid="retour">
          <IconeRetour />
        </button>
        <h1 class="entete-titre entete-titre-large">{T.styles.titre}</h1>
        <BoutonAide />
      </header>
      <main class="ecran-corps">
        <p class="intro">{T.styles.intro}</p>
        <div class="cartes-styles">
          <CarteHasard occupe={occupe} creer={(m) => void lancer(() => creerMorceauDepuis(m))} />
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              class="carte-style"
              data-style={s}
              disabled={occupe}
              aria-busy={occupe}
              onClick={() => void lancer(() => creerMorceau(s))}
              data-testid={`style-${s}`}
            >
              <span class="carte-style-haut">
                <span class="carte-style-nom">{T.styles.noms[s]}</span>
                <span class="carte-style-bpm chiffres">{T.styles.bpm(T.styles.tempos[s])}</span>
              </span>
              <span class="carte-style-phrase">{T.styles.phrases[s]}</span>
              <span class="carte-style-onde" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <i key={i} style={{ height: `${hauteur(s, i)}%` }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Petite forme d'onde décorative, différente pour chaque style. */
function hauteur(s: Style, i: number): number {
  if (s === 'trap') return [90, 20, 35, 20, 60, 20, 35, 80][i % 8]!;
  if (s === 'drill') return [85, 15, 30, 70, 15, 55, 25, 40][i % 8]!;
  if (s === 'phonk') return [95, 25, 25, 70, 25, 25, 85, 30, 30, 60, 20, 45][i % 12]!;
  if (s === 'pop') return [80, 30, 55, 30][i % 4]!;
  if (s === 'boombap') return [90, 20, 30, 15, 75, 20, 45, 15][i % 8]! - (i % 5) * 3;
  return 35 + Math.round(25 * Math.sin(i / 2.2) + 10 * Math.sin(i * 1.3));
}
