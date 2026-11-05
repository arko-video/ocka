// Écran Infos : les titres de la sortie (ordre avec flèches haut / bas, panneau d'infos, + Ajouter un morceau).
// Propriétaire : A1.

import { useEffect, useState } from 'preact/hooks';
import { listerMorceaux, type ResumeMorceau, type Sortie } from '../../../moteur/api';
import { dureeMorceau } from '../../../morceau/temps';
import { T } from '../../../textes-fr';
import { panneau } from '../../etat';
import { mmss } from '../../format';
import { fermerPanneau, ouvrirPanneau } from '../../navigation';
import { ajouterTitre, modifierSortie, titresSortie } from '../../sorties';
import { IconeBas, IconeCoche, IconeCrayon, IconeHaut, IconePlus } from '../Icones';
import { Panneau } from '../Panneau';
import { useVise } from './communs';
import { deplacer, infosCompletes } from './infos-titre';
import { PanneauTitre } from './PanneauTitre';

function AjouterMorceau({ s }: { s: Sortie }) {
  const [liste, setListe] = useState<ResumeMorceau[] | null>(null);
  const ouvert = panneau.value === 'ajouter-titre';
  useEffect(() => {
    if (ouvert) void listerMorceaux().then(setListe, () => setListe([]));
  }, [ouvert]);
  if (!ouvert) return null;
  const libres = (liste ?? []).filter((r) => !s.titres.includes(r.id));
  return (
    <Panneau id="ajouter-titre" titre={T.sortie.choisirMorceau}>
      {liste && libres.length === 0 && <p class="vide">{T.sortie.tousAjoutes}</p>}
      <div class="liste-actions" data-testid="liste-ajout">
        {libres.map((r) => (
          <button
            key={r.id}
            type="button"
            class="btn btn-ligne sortie-ajout"
            onClick={() => {
              fermerPanneau();
              void ajouterTitre(r.id);
            }}
            data-testid="ajout-morceau"
          >
            <span class="sortie-ajout-titre">{r.titre}</span>
            <span class="doux chiffres">{mmss(r.duree)}</span>
          </button>
        ))}
      </div>
    </Panneau>
  );
}

export function ListeTitres({ s }: { s: Sortie }) {
  const map = titresSortie.value;
  const [ouvert, setOuvert] = useState<string | null>(s.titres.length === 1 ? s.titres[0]! : null);
  useVise((t) => setOuvert(t));
  const bouger = (i: number, sens: -1 | 1) => modifierSortie({ titres: deplacer(s.titres, i, sens) });
  return (
    <section class="carte" data-champ="sortie:titres">
      <h2 class="carte-titre">
        {T.sortie.carteTitres} <span class="badge">{s.titres.length}</span>
      </h2>
      {s.titres.length === 0 && <p class="vide">{T.sortie.aucunTitre}</p>}
      <ol class="sortie-titres" data-testid="sortie-titres">
        {s.titres.map((id, i) => {
          const m = map.get(id);
          const nom = m?.titre.trim() || T.sortie.sansTitre;
          const complet = !!m && infosCompletes(m);
          return (
            <li key={id} class="sortie-titre" data-champ={`${id}:`} data-ouvert={ouvert === id}>
              <div class="sortie-titre-ligne">
                <button
                  type="button"
                  class="sortie-titre-ouvrir"
                  aria-expanded={ouvert === id}
                  aria-label={T.sortie.details(nom)}
                  onClick={() => setOuvert(ouvert === id ? null : id)}
                  data-testid="titre-ouvrir"
                >
                  <span class="sortie-titre-num chiffres">{i + 1}</span>
                  <span class="sortie-titre-textes">
                    <span class="sortie-titre-nom">{nom}</span>
                    <span class="sortie-titre-infos" data-complet={complet}>
                      {m && <span class="chiffres">{mmss(dureeMorceau(m))}</span>}
                      {' · '}
                      {complet ? (
                        <>
                          <IconeCoche taille={13} /> {T.sortie.complet}
                        </>
                      ) : (
                        T.sortie.aRemplir
                      )}
                    </span>
                  </span>
                  <span class="sortie-titre-crayon" aria-hidden="true">
                    <IconeCrayon taille={18} />
                  </span>
                </button>
                <button type="button" class="btn-icone" aria-label={T.sortie.monter(nom)} disabled={i === 0} onClick={() => bouger(i, -1)} data-testid="titre-monter">
                  <IconeHaut />
                </button>
                <button
                  type="button"
                  class="btn-icone"
                  aria-label={T.sortie.descendre(nom)}
                  disabled={i === s.titres.length - 1}
                  onClick={() => bouger(i, 1)}
                  data-testid="titre-descendre"
                >
                  <IconeBas />
                </button>
              </div>
              {ouvert === id && m && <PanneauTitre key={id} id={id} m={m} s={s} />}
            </li>
          );
        })}
      </ol>
      {s.titres.length < 32 && (
        <button type="button" class="btn btn-contour" onClick={() => ouvrirPanneau('ajouter-titre')} data-testid="ajouter-titre">
          <IconePlus /> {T.sortie.ajouterTitre}
        </button>
      )}
      <AjouterMorceau s={s} />
    </section>
  );
}
