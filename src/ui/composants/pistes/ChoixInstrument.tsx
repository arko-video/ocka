// « + Piste » (ou « Changer d'instrument ») : choix par familles, recherche, écoute (Lecteur.entendreNote avec
// options.instrument), téléchargement à la demande avec la progression (telechargerInstrument de BQ). Les sons
// d'OCKA (« ocka-<son>@1 ») sont toujours là : Claviers et Synthés, même sans la banque.

import { useEffect, useState } from 'preact/hooks';
import { FAMILLES_INSTRUMENTS, type FamilleInstrument, type InfoInstrument } from '../../../moteur/api';
import { pisteDe } from '../../../morceau/acces';
import { T } from '../../../textes-fr';
import { morceau, PANNEAUX, panneau } from '../../etat';
import { IconeLecture } from '../Icones';
import { Panneau } from '../Panneau';
import { choisirInstrument, choixPour, ecouterInstrument, fermerPuis } from './actions';
import { catalogue, chargerCatalogue, etatCatalogue, filtrer, taille, telechargements } from './catalogue';
import { ouvrirPanneau } from '../../navigation';
import './pistes.css';

function Ligne({ info, actuel }: { info: InfoInstrument; actuel: boolean }) {
  const part = telechargements.value[info.id];
  const etat =
    part !== undefined
      ? T.banque.telechargement(Math.round(part * 100))
      : info.source === 'code'
        ? T.pistes.familleOcka
        : info.installe
          ? T.banque.installe
          : T.banque.aTelecharger(taille(info.taille));
  return (
    <li class="instr" data-actuel={actuel ? '1' : '0'} data-testid={`instrument-${info.id}`}>
      <button
        type="button"
        class="instr-ecouter"
        aria-label={T.pistes.ecouterNom(info.nom)}
        disabled={part !== undefined}
        onClick={() => void ecouterInstrument(info)}
        data-testid={`ecouter-instrument-${info.id}`}
      >
        <IconeLecture taille={18} />
      </button>
      <span class="instr-texte">
        <span class="instr-nom">{info.nom}</span>
        <span class="instr-etat">{etat}</span>
        {part !== undefined && (
          <span
            class="instr-barre"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(part * 100)}
          >
            <span style={{ width: `${Math.round(part * 100)}%` }} />
          </span>
        )}
      </span>
      <button
        type="button"
        class="btn btn-contour btn-petit"
        aria-label={T.pistes.choisirNom(info.nom)}
        disabled={part !== undefined || actuel}
        onClick={() => void choisirInstrument(info)}
        data-testid={`choisir-${info.id}`}
      >
        {T.pistes.choisir}
      </button>
    </li>
  );
}

export function ChoixInstrument() {
  const ouvert = panneau.value === PANNEAUX.choixInstrument;
  const [texte, setTexte] = useState('');
  const [famille, setFamille] = useState<FamilleInstrument | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    setTexte('');
    setFamille(null);
    void chargerCatalogue();
  }, [ouvert]);
  if (!ouvert) return null;
  const m = morceau.value;
  const pour = choixPour.value;
  const p = m && pour ? pisteDe(m, pour) : undefined;
  const actuel = p?.genre === 'instrument' ? p.instrument : null;
  const liste = catalogue.value;
  const presentes = FAMILLES_INSTRUMENTS.filter((f) => liste.some((x) => x.famille === f));
  const trouves = filtrer(liste, texte, famille);
  const groupes = presentes
    .map((f) => ({
      f,
      instruments: trouves.filter((x) => x.famille === f).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    }))
    .filter((g) => g.instruments.length);

  return (
    <Panneau
      id={PANNEAUX.choixInstrument}
      titre={pour ? T.pistes.changerInstrument : T.pistes.choixInstrument}
      testid="panneau-choix-instrument"
    >
      <input
        type="search"
        class="champ-texte instr-recherche"
        placeholder={T.pistes.rechercher}
        aria-label={T.pistes.rechercher}
        value={texte}
        onInput={(e) => setTexte((e.target as HTMLInputElement).value)}
        data-testid="recherche-instrument"
      />
      <div class="puces puces-defile instr-familles" role="radiogroup" aria-label={T.pistes.titre}>
        {[null, ...presentes].map((f) => (
          <button
            key={f ?? 'toutes'}
            type="button"
            role="radio"
            aria-checked={famille === f}
            class="puce"
            onClick={() => setFamille(f)}
            data-testid={`famille-${f ?? 'toutes'}`}
          >
            {f ? (T.banque.familles[f] ?? f) : T.pistes.toutes}
          </button>
        ))}
      </div>
      {etatCatalogue.value !== 'complet' && (
        <p class="aide" role="status" data-testid="catalogue-etat">
          {etatCatalogue.value === 'chargement' ? T.pistes.chargement : T.pistes.catalogueAbsent}
        </p>
      )}
      {groupes.length === 0 && <p class="vide">{T.pistes.aucun}</p>}
      {groupes.map((g) => (
        <section key={g.f} class="instr-famille" aria-label={T.banque.familles[g.f] ?? g.f}>
          <h3 class="instr-famille-titre">{T.banque.familles[g.f] ?? g.f}</h3>
          <ul class="instr-liste">
            {g.instruments.map((x) => (
              <Ligne key={x.id} info={x} actuel={x.id === actuel} />
            ))}
          </ul>
        </section>
      ))}
      <button
        type="button"
        class="btn btn-discret btn-petit instr-gerer"
        onClick={() => fermerPuis(() => ouvrirPanneau(PANNEAUX.gererInstruments))}
        data-testid="ouvrir-gerer-instruments"
      >
        {T.banque.gerer}
      </button>
    </Panneau>
  );
}
