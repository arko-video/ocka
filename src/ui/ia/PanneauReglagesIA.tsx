// Réglages de l'IA, dans un panneau : fournisseur, clé (champ mot de passe), « Tester ma clé », « Oublier ma clé »,
// et le rappel « Ta clé reste sur ton téléphone ». Le test ne coûte rien (liste des modèles).

import { useEffect, useState } from 'preact/hooks';
import { ErreurOcka, FOURNISSEURS, masquer, testerCle, trouverFournisseur } from '../../moteur/api';
import { T } from '../../textes-fr';
import { afficherToast } from '../etat';
import { Panneau } from '../composants/Panneau';
import { chargerIa, choisirFournisseur, cleEnMemoire, cleIa, fournisseurIa, garderCle, nomCourt, oublierCleIa } from './etat-ia';
import './ia.css';

type Test = { etat: 'rien' | 'encours' | 'ok' | 'erreur'; message?: string };

export function PanneauReglagesIA({ id }: { id: string }) {
  return (
    <Panneau id={id} titre={T.ia.reglages} testid="panneau-ia-reglages">
      <ReglagesIA />
    </Panneau>
  );
}

function ReglagesIA() {
  const f = fournisseurIa.value;
  const cle = cleIa.value;
  const [saisie, setSaisie] = useState('');
  const [test, setTest] = useState<Test>({ etat: 'rien' });
  useEffect(() => void chargerIa(), []);

  async function tester() {
    const fournisseur = f;
    const essai = saisie.trim() || cle || '';
    if (!essai) return setTest({ etat: 'erreur', message: T.ia.sansCle });
    setTest({ etat: 'encours' });
    try {
      await testerCle(fournisseur, essai);
      if (saisie.trim()) await garderCle(fournisseur, essai);
      if (fournisseurIa.peek() !== fournisseur) return;
      setSaisie('');
      setTest({ etat: 'ok', message: T.ia.cleOk });
    } catch (e) {
      if (fournisseurIa.peek() === fournisseur) setTest({ etat: 'erreur', message: e instanceof ErreurOcka ? e.message : T.ia.erreur });
    }
  }

  async function oublier() {
    await oublierCleIa(f);
    setSaisie('');
    setTest({ etat: 'rien' });
    afficherToast(T.ia.cleOubliee);
  }

  return (
    <div class="ia-panneau" data-testid="reglages-ia">
      <p class="aide">{T.ia.intro}</p>
      <div class="reglage">
        <span class="reglage-label" id="ia-fournisseur">
          {T.ia.fournisseur}
        </span>
        <div class="segments" role="radiogroup" aria-labelledby="ia-fournisseur">
          {FOURNISSEURS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              class="segment"
              aria-checked={x.id === f}
              onClick={() => {
                setSaisie('');
                setTest({ etat: 'rien' });
                void choisirFournisseur(x.id);
              }}
              data-testid={`ia-fournisseur-${x.id}`}
            >
              {nomCourt(x.id)}
            </button>
          ))}
        </div>
        <span class="aide">{T.ia.modele(trouverFournisseur(f).modeleParDefaut)}</span>
      </div>

      <label class="champ">
        <span class="champ-label">{T.ia.cle}</span>
        {cle && !saisie ? (
          <span class="ia-cle-gardee" data-testid="ia-cle-gardee">
            {T.ia.cleGardee(masquer(cle))}
          </span>
        ) : null}
        <input
          key={f}
          class="champ-texte"
          type="password"
          autocomplete="off"
          spellcheck={false}
          placeholder={T.ia.clePlaceholder}
          value={saisie}
          onInput={(e) => setSaisie(e.currentTarget.value)}
          data-testid="ia-cle"
        />
      </label>
      <p class="ia-rappel" data-testid="ia-rappel">
        {T.ia.rappel}
      </p>
      {cleEnMemoire.value && <p class="aide">{T.ia.cleMemoire}</p>}

      <div class="ia-boutons">
        <button type="button" class="btn" disabled={test.etat === 'encours' || (!saisie.trim() && !cle)} onClick={() => void tester()} data-testid="ia-tester">
          {T.ia.tester}
        </button>
        <button type="button" class="btn btn-discret" disabled={!cle} onClick={() => void oublier()} data-testid="ia-oublier">
          {T.ia.oublier}
        </button>
      </div>
      {test.etat !== 'rien' && (
        <p class="ia-etat" data-etat={test.etat} role="status" data-testid="ia-test">
          {test.etat === 'encours' ? T.ia.test : test.message}
        </p>
      )}
    </div>
  );
}
