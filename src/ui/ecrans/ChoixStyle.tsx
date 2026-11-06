// Choix du style : la carte « Au hasard » (une idée tirée par une graine : on peut en tirer une autre ou revenir
// à celle d'avant), une recherche, des puces pour sauter à une famille, puis les styles groupés par familles
// (registre morceau/styles), chacune avec son « Au hasard ». Chaque style se pré-écoute (4 mesures du refrain).
// Un appui sur la carte crée un morceau déjà prêt et ouvre Beat. Propriétaire en C2 : S2.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import '../styles/choix-style.css';
import { contexteAudio, creerLecteur, dureeMorceau, ideeAuHasard, instrumentsManquants, nouveauMorceau, nouvelleGraine, telechargerInstrument, type Idee, type Lecteur } from '../../moteur/api';
import { hauteurTonique } from '../../morceau/theorie';
import { FAMILLES_STYLES, stylesDeFamille, type DefinitionStyle, type FamilleStyle } from '../../morceau/styles/index';
import type { Morceau, Style } from '../../morceau/types';
import { T } from '../../textes-fr';
import { afficherToast } from '../etat';
import { creerMorceau, creerMorceauDepuis } from '../mes-morceaux';
import { remplacerPar, retour } from '../navigation';
import { BoutonAide } from '../aide/BoutonAide';
import { IconeDe, IconeLecture, IconeRetour, IconeStop } from '../composants/Icones';

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
            <button type="button" class="btn btn-principal" disabled={occupe} onClick={() => creer({ ...idee.morceau, titre: T.styles.noms[idee.style] })} data-testid="hasard-creer">
              {T.allerVite.cestParti}
            </button>
            <button type="button" class="btn btn-contour" disabled={occupe} onClick={tirer} data-testid="hasard-autre">
              <IconeDe taille={18} /> {T.allerVite.autreIdee}
            </button>
            {graines.length > 1 && (
              <button type="button" class="btn btn-discret" disabled={occupe} title={T.allerVite.revenirAide} onClick={() => setGraines((g) => g.slice(0, -1))} data-testid="hasard-revenir">
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

/** Texte simplifié pour la recherche : minuscules, sans accents ni espaces ni tirets. */
const simple = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s\-&’']/g, '');

/** 4 mesures du refrain du morceau neuf d'un style (sans fill ni coupure, sans fondu). */
function extraitEcoute(style: Style): Morceau {
  const m = nouveauMorceau(style, T.styles.noms[style]);
  const r = m.sections.find((s) => s.id === 'refrain') ?? m.sections[0]!;
  return { ...m, sections: [{ ...r, mesures: 4, fill: false, coupure: 'aucune' }], ordre: [r.id], fondu: 0 };
}

/** Écoute rapide : un lecteur à part, un style à la fois ; les instruments manquants sont téléchargés avant. */
function useEcoute() {
  const lecteur = useRef<Lecteur | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const jeton = useRef(0);
  const [etat, setEtat] = useState<{ id: Style; pret: boolean } | null>(null);
  const arreter = () => {
    jeton.current++;
    clearTimeout(minuteur.current);
    lecteur.current?.pause();
    setEtat(null);
  };
  useEffect(
    () => () => {
      jeton.current++;
      clearTimeout(minuteur.current);
      lecteur.current?.detruire();
      lecteur.current = null;
    },
    [],
  );
  const basculer = async (id: Style) => {
    if (etat?.id === id) return arreter();
    arreter();
    const j = jeton.current;
    setEtat({ id, pret: false });
    try {
      void contexteAudio().resume();
      const m = extraitEcoute(id);
      for (const i of await instrumentsManquants(m)) await telechargerInstrument(i);
      if (j !== jeton.current) return;
      lecteur.current ??= creerLecteur();
      await lecteur.current.charger(m);
      if (j !== jeton.current) return;
      lecteur.current.aller(0);
      lecteur.current.lire();
      setEtat({ id, pret: true });
      minuteur.current = setTimeout(() => j === jeton.current && arreter(), dureeMorceau(m) * 1000 + 250);
    } catch (e) {
      console.error(e);
      if (j === jeton.current) {
        arreter();
        afficherToast(T.choixStyle.ecouteImpossible);
      }
    }
  };
  return { etat, basculer, arreter };
}

interface PropsCarte {
  d: DefinitionStyle;
  occupe: boolean;
  ecoute: 'non' | 'prepa' | 'joue';
  choisir: () => void;
  ecouter: () => void;
}

function CarteStyle({ d, occupe, ecoute, choisir, ecouter }: PropsCarte) {
  return (
    <div class="ligne-style" data-style={d.id}>
      <button type="button" class="carte-style" data-style={d.id} disabled={occupe} aria-busy={occupe} onClick={choisir} data-testid={`style-${d.id}`}>
        <span class="carte-style-haut">
          <span class="carte-style-nom">{d.textes.nom}</span>
          <span class="carte-style-bpm chiffres">{T.styles.bpm(d.reglages.tempo)}</span>
        </span>
        <span class="carte-style-phrase">{d.textes.phrase}</span>
        <span class="carte-style-onde" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} style={{ height: `${hauteur(d, i)}%` }} />
          ))}
        </span>
      </button>
      <button
        type="button"
        class="ecoute-style"
        aria-label={ecoute === 'non' ? T.choixStyle.ecouter(d.textes.nom) : T.choixStyle.arreter(d.textes.nom)}
        aria-pressed={ecoute !== 'non'}
        aria-busy={ecoute === 'prepa'}
        title={ecoute === 'prepa' ? T.choixStyle.chargement : undefined}
        disabled={occupe}
        onClick={ecouter}
        data-testid={`ecouter-${d.id}`}
      >
        {ecoute === 'prepa' ? <span class="ecoute-attente" /> : ecoute === 'joue' ? <IconeStop taille={20} /> : <IconeLecture taille={20} />}
      </button>
    </div>
  );
}

/** Un morceau neuf d'un style de la famille tiré au hasard, à un tempo tiré dans la plage du style. */
function hasardDansFamille(f: FamilleStyle): Morceau {
  const liste = stylesDeFamille(f);
  const d = liste[Math.floor(Math.random() * liste.length)]!;
  const [bas, haut] = d.reglages.plage;
  return { ...nouveauMorceau(d.id, T.styles.noms[d.id]), tempo: bas + Math.floor(Math.random() * (haut - bas + 1)) };
}

export function ChoixStyle() {
  const [occupe, setOccupe] = useState(false);
  const [recherche, setRecherche] = useState('');
  const { etat, basculer, arreter } = useEcoute();
  const lancer = async (faire: () => Promise<boolean>) => {
    if (occupe) return;
    arreter();
    setOccupe(true);
    if (await faire()) remplacerPar('beat');
    setOccupe(false);
  };
  const q = simple(recherche);
  const familles = FAMILLES_STYLES.map((f) => ({
    f,
    styles: stylesDeFamille(f).filter((d) => !q || simple(`${d.id} ${d.textes.nom}`).includes(q)),
  })).filter((x) => x.styles.length > 0);
  const aller = (f: FamilleStyle) => document.getElementById(`famille-${f}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <label class="champ recherche-style">
            <span class="champ-label">{T.choixStyle.recherche}</span>
            <input type="search" class="champ-texte" placeholder={T.choixStyle.rechercheAide} value={recherche} onInput={(e) => setRecherche(e.currentTarget.value)} data-testid="recherche-style" />
          </label>
          <nav class="puces-familles" aria-label={T.choixStyle.allerFamilles}>
            {familles.map(({ f }) => (
              <button key={f} type="button" class="puce-famille" data-famille={f} onClick={() => aller(f)} data-testid={`aller-famille-${f}`}>
                {T.choixStyle.puces[f]}
              </button>
            ))}
          </nav>
          {familles.length === 0 && <p class="aide">{T.choixStyle.aucun(recherche.trim())}</p>}
          {familles.map(({ f, styles }) => (
            <section key={f} class="famille-styles" data-famille={f} aria-labelledby={`famille-${f}`} data-testid={`famille-${f}`}>
              <div class="famille-styles-tete">
                <h2 id={`famille-${f}`} class="famille-styles-titre">
                  {T.choixStyle.familles[f]} <span class="doux chiffres">· {T.choixStyle.nombre(styles.length)}</span>
                </h2>
                <button
                  type="button"
                  class="btn btn-discret hasard-famille"
                  disabled={occupe}
                  title={T.choixStyle.hasardFamilleAide(T.choixStyle.familles[f])}
                  aria-label={T.choixStyle.hasardFamilleAide(T.choixStyle.familles[f])}
                  onClick={() => void lancer(() => creerMorceauDepuis(hasardDansFamille(f)))}
                  data-testid={`hasard-famille-${f}`}
                >
                  <IconeDe taille={18} /> {T.choixStyle.hasardFamille}
                </button>
              </div>
              <div class="liste-styles">
                {styles.map((d) => (
                  <CarteStyle
                    key={d.id}
                    d={d}
                    occupe={occupe}
                    ecoute={etat?.id !== d.id ? 'non' : etat.pret ? 'joue' : 'prepa'}
                    choisir={() => void lancer(() => creerMorceau(d.id))}
                    ecouter={() => void basculer(d.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Petite forme d'onde décorative, celle du style (DefinitionStyle.onde) ou une onde douce. */
function hauteur(d: DefinitionStyle, i: number): number {
  if (d.onde && d.onde.length > 0) return d.onde[i % d.onde.length]!;
  return 35 + Math.round(25 * Math.sin(i / 2.2) + 10 * Math.sin(i * 1.3));
}
