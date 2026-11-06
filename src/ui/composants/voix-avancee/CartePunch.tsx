// Punch-in (V) : choisir les mesures à refaire dans la section, 1 ou 2 mesures d'élan, réenregistrer ; l'arrêt est
// automatique après le passage (ou « Arrêter »). La nouvelle prise remplace l'ancienne en une étape d'Annuler.

import { useEffect, useRef, useState } from 'preact/hooks';
import { creerPunch, type Punch } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { morceau } from '../../etat';
import { lecteurPret, obtenirLecteur, toastErreur } from '../../lecture';
import { agir, occupe, type Apparition } from './outils';

const P = () => T.voixAvancee.punch;

export function CartePunch({ ap }: { ap: Apparition }) {
  const mesures = ap.section.mesures;
  const [de, setDe] = useState(0);
  const [a, setA] = useState(Math.min(1, mesures));
  const [pre, setPre] = useState<1 | 2>(1);
  const [niveau, setNiveau] = useState(0);
  const punch = useRef<Punch | null>(null);
  const suivi = useRef<ReturnType<typeof setInterval> | null>(null);
  const enCours = occupe.value === 'punch';
  useEffect(() => () => fin(true), []);

  function fin(abandon = false) {
    if (suivi.current) clearInterval(suivi.current);
    suivi.current = null;
    const p = punch.current;
    punch.current = null;
    if (!p) return;
    if (abandon) return p.detruire();
    void agir('punch-fin', () => p.arreter()).finally(() => p.detruire());
  }

  async function lancer() {
    const m = morceau.peek();
    if (!m || occupe.peek()) return;
    occupe.value = 'punch';
    try {
      const p = await creerPunch();
      punch.current = p;
      const lecteur = obtenirLecteur();
      if (!lecteur) throw new Error('lecteur');
      await lecteurPret();
      await p.demarrer(lecteur, m, { section: ap.section.id, occurrence: ap.occurrence, de: de * 16, a: a * 16, preRoll: pre });
      suivi.current = setInterval(() => {
        setNiveau(p.niveau);
        if (!p.enCours) {
          occupe.value = null;
          fin();
        }
      }, 100);
    } catch (e) {
      occupe.value = null;
      fin(true);
      toastErreur(e);
    }
  }

  const arreter = () => {
    occupe.value = null;
    fin();
  };

  const options = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <section class="carte va-carte" data-testid="va-punch">
      <h3 class="carte-titre">{P().titre}</h3>
      <p class="aide">{P().aide}</p>
      <div class="va-ligne">
        <label class="champ-label">
          {P().de}
          <select class="champ" value={de} disabled={enCours} onChange={(e) => {
            const v = Number(e.currentTarget.value);
            setDe(v);
            if (a <= v) setA(v + 1);
          }} data-testid="punch-de">
            {options(0, mesures - 1).map((n) => <option key={n} value={n}>{T.voixAvancee.mesure(n + 1)}</option>)}
          </select>
        </label>
        <label class="champ-label">
          {P().a}
          <select class="champ" value={a} disabled={enCours} onChange={(e) => setA(Number(e.currentTarget.value))} data-testid="punch-a">
            {options(de + 1, mesures).map((n) => <option key={n} value={n}>{T.voixAvancee.mesure(n)}</option>)}
          </select>
        </label>
      </div>
      <div class="reglage">
        <span class="reglage-label" id="va-preroll">{P().preRoll}</span>
        <div class="segments" role="radiogroup" aria-labelledby="va-preroll">
          {([1, 2] as const).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={pre === n} class="segment" disabled={enCours} onClick={() => setPre(n)} data-testid={`punch-preroll-${n}`}>
              {P().preRollValeur(n)}
            </button>
          ))}
        </div>
      </div>
      {enCours ? (
        <div class="va-ligne">
          <div class="vumetre" aria-hidden="true"><div class="vumetre-barre" style={{ width: `${Math.round(Math.min(1, niveau) * 100)}%` }} /></div>
          <span class="aide">{P().enCours}</span>
          <button type="button" class="btn btn-rouge" onClick={arreter} data-testid="punch-arreter">{P().arreter}</button>
        </div>
      ) : (
        <button type="button" class="btn btn-principal" disabled={occupe.value !== null} onClick={() => void lancer()} data-testid="punch-lancer">
          {occupe.value === 'punch-fin' ? T.voixAvancee.calcul : P().lancer}
        </button>
      )}
    </section>
  );
}
