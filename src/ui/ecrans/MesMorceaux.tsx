// Accueil : onglets « Morceaux | Sorties ». Morceaux : Nouveau morceau, liste (titre, style, durée, date) et actions.
// Sorties : Nouvelle sortie et la liste des sorties. En bas : « Importer un projet ». Propriétaire : A1.
// Vague B (B2) : « Lance-moi un beat » (IA facultative, clé de l'utilisateur) sous « Nouveau morceau ».

import { useEffect, useState } from 'preact/hooks';
import type { ResumeMorceau } from '../../moteur/api';
import { T } from '../../textes-fr';
import { ongletAccueil, panneau } from '../etat';
import { dateCourte, mmss } from '../format';
import { dupliquer, importer, liste, ouvrir, rafraichirListe, renommer, supprimer } from '../mes-morceaux';
import { allerA, fermerPanneau, ouvrirPanneau } from '../navigation';
import { IconeCopier, IconeCrayon, IconePlus, IconePlusDActions, IconePoubelle } from '../composants/Icones';
import { Panneau } from '../composants/Panneau';
import { ListeSorties, rafraichirSorties } from '../composants/sortie/ListeSorties';
import { ID_BEAT, LanceMoiUnBeat } from '../ia/PanneauBeatIA';
import { BoutonAide } from '../aide/BoutonAide';

function ImporterProjet() {
  const [occupe, setOccupe] = useState(false);
  return (
    <div class="importer-projet">
      <label class="btn btn-discret" aria-disabled={occupe} data-testid="importer-projet">
        {occupe ? T.accueil.importEnCours : T.accueil.importer}
        <input
          type="file"
          accept=".ocka,.ocka-sortie,application/zip"
          class="sr-only"
          disabled={occupe}
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (!f) return;
            setOccupe(true);
            const r = await importer(f);
            setOccupe(false);
            if (r?.type === 'sortie') {
              ongletAccueil.value = 'sorties';
              await rafraichirSorties();
            } else if (r) ongletAccueil.value = 'morceaux';
          }}
          data-testid="importer-fichier"
        />
      </label>
      <span class="aide">{T.accueil.importAide}</span>
    </div>
  );
}

function ListeMorceaux({ actions }: { actions: (r: ResumeMorceau) => void }) {
  const l = liste.value;
  const ouvrirEtAller = async (id: string) => {
    if (await ouvrir(id)) allerA('beat');
  };
  return (
    <>
      <button type="button" class="btn btn-principal" onClick={() => allerA('styles')} data-testid="nouveau-morceau">
        <IconePlus /> {T.accueil.nouveau}
      </button>
      <LanceMoiUnBeat ouvrir={() => ouvrirPanneau(ID_BEAT)} />
      {l && l.length === 0 && <p class="vide">{T.accueil.vide}</p>}
      {l && l.length > 0 && (
        <ul class="liste-morceaux" data-testid="liste-morceaux">
          {l.map((r) => (
            <li key={r.id} class="morceau-ligne" data-style={r.style}>
              <button type="button" class="morceau-ouvrir" aria-label={T.accueil.ouvrir(r.titre)} onClick={() => void ouvrirEtAller(r.id)} data-testid="ouvrir-morceau">
                <span class="morceau-pastille" aria-hidden="true" />
                <span class="morceau-textes">
                  <span class="morceau-titre">{r.titre}</span>
                  <span class="morceau-infos">
                    {T.styles.noms[r.style] ?? r.style} · <span class="chiffres">{mmss(r.duree)}</span> · {dateCourte(r.modifieLe)}
                  </span>
                </span>
              </button>
              <button type="button" class="btn-icone" aria-label={T.accueil.actions(r.titre)} aria-haspopup="dialog" onClick={() => actions(r)} data-testid="actions-morceau">
                <IconePlusDActions />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function MesMorceaux() {
  useEffect(() => void rafraichirListe(), []);
  const onglet = ongletAccueil.value;
  const [choisi, setChoisi] = useState<ResumeMorceau | null>(null);
  const [mode, setMode] = useState<'actions' | 'renommer' | 'supprimer'>('actions');
  const [nom, setNom] = useState('');

  const actions = (r: ResumeMorceau) => {
    setChoisi(r);
    setMode('actions');
    setNom(r.titre);
    ouvrirPanneau('actions-morceau');
  };
  const onglets = [
    { id: 'morceaux', texte: T.accueil.onglets.morceaux },
    { id: 'sorties', texte: T.accueil.onglets.sorties },
  ] as const;

  return (
    <div class="ecran accueil" data-testid="ecran-accueil">
      <header class="accueil-entete">
        <div class="accueil-haut">
          <div class="logo" aria-hidden="true">
            <span class="logo-onde" />
            {T.appli}
          </div>
          <BoutonAide />
        </div>
        <h1 class="titre">{onglet === 'sorties' ? T.accueil.titreSorties : T.accueil.titre}</h1>
        <p class="intro">{onglet === 'sorties' ? T.accueil.accrocheSorties : T.accueil.accroche}</p>
      </header>
      <div class="accueil-onglets" role="tablist" aria-label={T.accueil.ongletsAria}>
        {onglets.map((o) => (
          <button
            key={o.id}
            id={`onglet-accueil-${o.id}`}
            type="button"
            role="tab"
            class="accueil-onglet"
            aria-selected={onglet === o.id}
            aria-controls="panneau-accueil"
            onClick={() => (ongletAccueil.value = o.id)}
            data-testid={`onglet-${o.id}`}
          >
            {o.texte}
          </button>
        ))}
      </div>
      <div id="panneau-accueil" class="ecran-corps" role="tabpanel" aria-labelledby={`onglet-accueil-${onglet}`}>
        {onglet === 'sorties' ? <ListeSorties /> : <ListeMorceaux actions={actions} />}
        <ImporterProjet />
      </div>

      {choisi && panneau.value === 'actions-morceau' && (
        <Panneau id="actions-morceau" titre={choisi.titre}>
          {mode === 'actions' && (
            <div class="liste-actions">
              <button type="button" class="btn btn-ligne" onClick={() => setMode('renommer')} data-testid="renommer">
                <IconeCrayon /> {T.accueil.renommer}
              </button>
              <button
                type="button"
                class="btn btn-ligne"
                onClick={() => {
                  fermerPanneau();
                  void dupliquer(choisi.id);
                }}
                data-testid="dupliquer"
              >
                <IconeCopier /> {T.accueil.dupliquer}
              </button>
              <button type="button" class="btn btn-ligne btn-danger" onClick={() => setMode('supprimer')} data-testid="supprimer">
                <IconePoubelle /> {T.accueil.supprimer}
              </button>
            </div>
          )}
          {mode === 'renommer' && (
            <form
              class="formulaire"
              onSubmit={(e) => {
                e.preventDefault();
                fermerPanneau();
                void renommer(choisi.id, nom);
              }}
            >
              <label class="champ">
                <span class="champ-label">{T.accueil.nouveauNom}</span>
                <input class="champ-texte" value={nom} maxLength={80} onInput={(e) => setNom(e.currentTarget.value)} data-testid="champ-nom" />
              </label>
              <button type="submit" class="btn btn-principal" data-testid="valider-nom">
                {T.valider}
              </button>
            </form>
          )}
          {mode === 'supprimer' && (
            <div class="formulaire">
              <p>{T.accueil.confirmerSuppression(choisi.titre)}</p>
              <button
                type="button"
                class="btn btn-principal btn-rouge"
                onClick={() => {
                  fermerPanneau();
                  void supprimer(choisi.id);
                }}
                data-testid="confirmer-suppression"
              >
                <IconePoubelle /> {T.accueil.supprimer}
              </button>
            </div>
          )}
        </Panneau>
      )}
    </div>
  );
}
