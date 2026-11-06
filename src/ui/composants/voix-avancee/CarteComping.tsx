// Comping (V) : les prises d'une apparition de section, les unes sous les autres ; une case par mesure (ou demi-mesure).
// On touche, pour chaque case, la prise à garder, puis « Créer la prise comp » (fondus enchaînés de 10 ms).

import { useState } from 'preact/hooks';
import { assemblerComp, type PassageComp } from '../../../moteur/api';
import { debutOccurrence, dureePas } from '../../../morceau/temps';
import { T } from '../../../textes-fr';
import { morceau } from '../../etat';
import { agir, nomPrise, occupe, type Apparition } from './outils';

const C = () => T.voixAvancee.comp;

/** Passages (secondes du morceau) : cases voisines de la même prise fusionnées. */
function passages(choix: (string | null)[], debut: number, pasCase: number, duree: number): PassageComp[] {
  const out: PassageComp[] = [];
  choix.forEach((id, c) => {
    if (!id) return;
    const de = debut + c * pasCase * duree;
    const a = de + pasCase * duree;
    const dernier = out[out.length - 1];
    if (dernier && dernier.prise === id && Math.abs(dernier.a - de) < 1e-9) dernier.a = a;
    else out.push({ prise: id, de, a });
  });
  return out;
}

export function CarteComping({ ap }: { ap: Apparition }) {
  const [demi, setDemi] = useState(false);
  const pasCase = demi ? 8 : 16;
  const cases = Math.max(1, Math.round((ap.section.mesures * 16) / pasCase));
  const parDefaut = (ap.prises.find((p) => p.choisie) ?? ap.prises[0])!.id;
  const [choixBrut, setChoix] = useState<{ cle: string; liste: (string | null)[] }>({ cle: '', liste: [] });
  const cle = `${ap.section.id}:${ap.occurrence}:${cases}:${ap.prises.map((p) => p.id).join(',')}`;
  const choix = choixBrut.cle === cle ? choixBrut.liste : Array.from({ length: cases }, () => parDefaut);
  const choisir = (c: number, id: string) => setChoix({ cle, liste: choix.map((x, i) => (i === c ? id : x)) });

  if (ap.prises.length < 2) {
    return (
      <section class="carte va-carte" data-testid="va-comp">
        <h3 class="carte-titre">{C().titre}</h3>
        <p class="aide">{C().unePrise}</p>
      </section>
    );
  }

  const creer = () => {
    const m = morceau.peek();
    const debut = m && debutOccurrence(m, ap.section.id, ap.occurrence);
    if (!m || debut === null || debut === undefined) return;
    void agir('comp', () => assemblerComp(m, ap.section.id, ap.occurrence, passages(choix, debut, pasCase, dureePas(m.tempo))));
  };

  return (
    <section class="carte va-carte" data-testid="va-comp">
      <h3 class="carte-titre">{C().titre}</h3>
      <p class="aide">{C().aide}</p>
      <div class="segments" role="radiogroup" aria-label={C().grain}>
        {[false, true].map((d) => (
          <button key={String(d)} type="button" role="radio" aria-checked={demi === d} class="segment" onClick={() => setDemi(d)} data-testid={d ? 'comp-demi' : 'comp-mesure'}>
            {d ? C().parDemi : C().parMesure}
          </button>
        ))}
      </div>
      <div class="va-grille" style={{ gridTemplateColumns: `minmax(52px, 80px) repeat(${cases}, minmax(24px, 1fr))` }}>
        <span />
        {choix.map((_, c) => (
          <span key={c} class="va-entete chiffres">{demi ? (c % 2 === 0 ? c / 2 + 1 : '·') : c + 1}</span>
        ))}
        {ap.prises.map((p, r) => [
          <span key={`n${p.id}`} class="va-nom" title={nomPrise(ap, p)}>{nomPrise(ap, p)}</span>,
          ...choix.map((id, c) => (
            <button
              key={`${p.id}-${c}`}
              type="button"
              class="va-case"
              aria-pressed={id === p.id}
              aria-label={`${nomPrise(ap, p)}, ${T.voixAvancee.mesure(Math.floor((c * pasCase) / 16) + 1)}`}
              onClick={() => choisir(c, p.id)}
              data-testid={`comp-case-${r}-${c}`}
            />
          )),
        ])}
      </div>
      <button type="button" class="btn btn-principal" disabled={occupe.value !== null} onClick={creer} data-testid="comp-creer">
        {occupe.value === 'comp' ? T.voixAvancee.calcul : C().creer}
      </button>
    </section>
  );
}
