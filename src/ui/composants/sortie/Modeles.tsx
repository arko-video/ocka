// « Fabriquer une pochette » : 4 modèles dessinés en 3000 × 3000 avec le titre et l'artiste ; « Autres couleurs »
// relance avec une autre graine. On touche un modèle pour le choisir. Propriétaire : A1.

import { useEffect, useState } from 'preact/hooks';
import { fabriquerPochette, lirePochette, type Sortie } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { afficherToast, messageErreur } from '../../etat';
import { majCote, modifierSortie } from '../../sorties';
import { IconeCoche, IconeDe } from '../Icones';

type Carte = { cle: string; url: string } | null;
const MODELES = [0, 1, 2, 3] as const;

export function Modeles({ s }: { s: Sortie }) {
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1e9));
  const [cartes, setCartes] = useState<Carte[]>([null, null, null, null]);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    let fini = false;
    const urls: string[] = [];
    setCartes([null, null, null, null]);
    setErreur(null);
    void (async () => {
      for (const m of MODELES) {
        const p = await fabriquerPochette(m, s.titre, s.artiste, graine);
        const b = await lirePochette(p.cle);
        if (fini || !b) return;
        const url = URL.createObjectURL(b);
        urls.push(url);
        setCartes((c) => c.map((x, i) => (i === m ? { cle: p.cle, url } : x)));
      }
    })().catch((e) => !fini && setErreur(messageErreur(e, T.sortie.erreurPochette)));
    return () => {
      fini = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [graine]);
  const pret = cartes.every(Boolean);
  return (
    <div class="modeles" data-testid="modeles">
      <p class="aide" aria-live="polite">
        {pret ? T.sortie.fabriquerAide : T.sortie.fabrication}
      </p>
      {erreur && (
        <p class="sortie-erreur" role="alert">
          {erreur}
        </p>
      )}
      <div class="modeles-grille">
        {cartes.map((c, i) => (
          <button
            key={i}
            type="button"
            class="modele"
            disabled={!c}
            aria-pressed={!!c && s.pochette === c.cle}
            aria-label={T.sortie.modele(i + 1)}
            onClick={() => {
              if (!c) return;
              modifierSortie({ pochette: c.cle });
              void majCote(c.cle, 3000);
              afficherToast(T.sortie.choisie);
            }}
            data-testid={`pochette-modele-${i}`}
          >
            {c ? <img src={c.url} alt="" draggable={false} /> : <span class="modele-attente" aria-hidden="true" />}
            {c && s.pochette === c.cle && (
              <span class="modele-choisi" aria-hidden="true">
                <IconeCoche taille={18} />
              </span>
            )}
          </button>
        ))}
      </div>
      <button type="button" class="btn btn-petit" disabled={!pret} onClick={() => setGraine(Math.floor(Math.random() * 1e9))} data-testid="pochette-autre">
        <IconeDe taille={18} /> {T.sortie.autre}
      </button>
    </div>
  );
}
