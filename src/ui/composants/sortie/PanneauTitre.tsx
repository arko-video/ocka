// Écran Infos : le panneau d'un titre (gros mots, langue, invité, crédits, déjà sorti, IA). Propriétaire : A1.
// Questions en mots simples ; chaque bloc porte data-champ="<id>:<champ>" pour le bouton « Corriger ».

import { useState } from 'preact/hooks';
import type { Sortie } from '../../../moteur/api';
import { dureeMorceau } from '../../../morceau/temps';
import { NIVEAUX_IA, ROLES_CREDIT, type Morceau, type NiveauIa, type RoleCredit } from '../../../morceau/types';
import { LANGUES, ROLES } from '../../../textes/sortie';
import { T } from '../../../textes-fr';
import { mmss } from '../../format';
import { changerTitre, retirerTitre } from '../../sorties';
import { IconeAlerte, IconePlus, IconePoubelle } from '../Icones';
import { Choix } from './communs';
import { ajouterCredit, isrcValide, nettoyerIsrc, reglerCredit, reglerIa, reglerInfo, reglerTitre, retirerCredit } from './infos-titre';

const PARTIES_IA = ['paroles', 'musique', 'voix'] as const;

function Credits({ id, m }: { id: string; m: Morceau }) {
  const credits = m.infos?.credits ?? [];
  return (
    <div class="champ" data-champ={`${id}:credits`}>
      <span class="champ-label">{T.sortie.credits}</span>
      <span class="aide">{T.sortie.creditsAide}</span>
      {credits.map((c, i) => (
        <div class="credit" key={i}>
          <input
            class="champ-texte"
            value={c.nom}
            maxLength={100}
            autoComplete="name"
            placeholder={T.sortie.nomPersonne}
            aria-label={T.sortie.nomPersonne}
            onInput={(e) => changerTitre(id, (x) => reglerCredit(x, i, { nom: e.currentTarget.value }), `credit-${id}-${i}`)}
            data-testid="credit-nom"
          />
          <div class="credit-bas">
            <select
              class="champ-texte"
              value={c.role}
              aria-label={T.sortie.role}
              onChange={(e) => changerTitre(id, (x) => reglerCredit(x, i, { role: e.currentTarget.value as RoleCredit }))}
              data-testid="credit-role"
            >
              {ROLES_CREDIT.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r]}
                </option>
              ))}
            </select>
            <button type="button" class="btn-icone encadre" aria-label={T.sortie.retirerPersonne(c.nom)} onClick={() => changerTitre(id, (x) => retirerCredit(x, i))} data-testid="credit-retirer">
              <IconePoubelle taille={20} />
            </button>
          </div>
        </div>
      ))}
      <button type="button" class="btn btn-petit sortie-ajouter" onClick={() => changerTitre(id, (x) => ajouterCredit(x))} data-testid="ajouter-credit">
        <IconePlus taille={18} /> {T.sortie.ajouterPersonne}
      </button>
    </div>
  );
}

function DejaSorti({ id, m }: { id: string; m: Morceau }) {
  const [oui, setOui] = useState(!!m.infos?.isrc);
  const [tape, setTape] = useState(m.infos?.isrc ?? '');
  const faux = tape.length > 0 && !isrcValide(tape);
  return (
    <div class="champ" data-champ={`${id}:isrc`}>
      <span class="champ-label">{T.sortie.dejaSorti}</span>
      <Choix<boolean>
        etiquette={T.sortie.dejaSorti}
        options={[
          { valeur: false, texte: T.sortie.non, id: 'non' },
          { valeur: true, texte: T.sortie.oui, id: 'oui' },
        ]}
        valeur={oui}
        surChoix={(v) => {
          setOui(v);
          if (!v) {
            setTape('');
            changerTitre(id, (x) => reglerInfo(x, 'isrc', undefined));
          }
        }}
        testid="deja-sorti"
      />
      {oui && (
        <>
          <input
            class="champ-texte"
            value={tape}
            aria-label={T.sortie.isrc}
            placeholder="FRAB12400001"
            autoCapitalize="characters"
            spellcheck={false}
            onInput={(e) => {
              const v = nettoyerIsrc(e.currentTarget.value);
              setTape(v);
              changerTitre(id, (x) => reglerInfo(x, 'isrc', isrcValide(v) ? v : undefined), `isrc-${id}`);
            }}
            data-testid="titre-isrc"
          />
          {faux ? <span class="sortie-erreur">{T.sortie.isrcInvalide}</span> : <span class="aide">{T.sortie.isrcAide}</span>}
        </>
      )}
    </div>
  );
}

export function PanneauTitre({ id, m, s }: { id: string; m: Morceau; s: Sortie }) {
  const infos = m.infos ?? {};
  const langue = infos.langue ?? s.langue;
  const duree = dureeMorceau(m);
  return (
    <div class="sortie-panneau-titre" data-testid="panneau-titre">
      <label class="champ" data-champ={`${id}:titre`}>
        <span class="champ-label">{T.sortie.titreMorceau}</span>
        <input class="champ-texte" value={m.titre} maxLength={80} onInput={(e) => changerTitre(id, (x) => reglerTitre(x, e.currentTarget.value), `titre-${id}`)} data-testid="titre-nom" />
      </label>
      <p class={duree < 30 ? 'sortie-erreur' : 'aide'} data-champ={`${id}:duree`}>
        {duree < 30 && <IconeAlerte taille={16} />} {T.sortie.duree(mmss(duree))}
        {duree < 30 && ` ${T.sortie.dureeCourte}`}
      </p>
      <div class="champ" data-champ={`${id}:explicite`}>
        <span class="champ-label">{T.sortie.grosMots}</span>
        <Choix<boolean>
          etiquette={T.sortie.grosMots}
          options={[
            { valeur: false, texte: T.sortie.non, id: 'non' },
            { valeur: true, texte: T.sortie.oui, id: 'oui' },
          ]}
          valeur={infos.explicite}
          surChoix={(v) => changerTitre(id, (x) => reglerInfo(x, 'explicite', v))}
          testid="explicite"
        />
        <span class="aide">{T.sortie.grosMotsAide}</span>
      </div>
      <label class="champ" data-champ={`${id}:langue`}>
        <span class="champ-label">{T.sortie.langueTitre}</span>
        <select class="champ-texte" value={langue} onChange={(e) => changerTitre(id, (x) => reglerInfo(x, 'langue', e.currentTarget.value))} data-testid="titre-langue">
          {Object.entries(LANGUES).map(([c, nom]) => (
            <option key={c} value={c}>
              {nom}
            </option>
          ))}
          {!LANGUES[langue] && langue !== 'instrumental' && <option value={langue}>{langue}</option>}
          <option value="instrumental">{T.sortie.instrumental}</option>
        </select>
      </label>
      <label class="champ" data-champ={`${id}:featuring`}>
        <span class="champ-label">{T.sortie.featuring}</span>
        <input
          class="champ-texte"
          value={infos.featuring ?? ''}
          maxLength={100}
          placeholder={T.sortie.featuringExemple}
          onInput={(e) => changerTitre(id, (x) => reglerInfo(x, 'featuring', e.currentTarget.value || undefined), `feat-${id}`)}
          data-testid="titre-featuring"
        />
        <span class="aide">{T.sortie.featuringAide}</span>
      </label>
      <Credits id={id} m={m} />
      <DejaSorti id={id} m={m} />
      <div class="champ" data-champ={`${id}:ia`}>
        <span class="champ-label">{T.sortie.ia}</span>
        <span class="aide">{T.sortie.iaAide}</span>
        {PARTIES_IA.map((partie) => (
          <div class="sortie-ia" key={partie}>
            <span class="sortie-ia-nom">{T.sortie.iaParties[partie]}</span>
            <Choix<NiveauIa>
              etiquette={`${T.sortie.ia} ${T.sortie.iaParties[partie]}`}
              options={NIVEAUX_IA.map((n) => ({ valeur: n, texte: T.sortie.iaChoix[n] }))}
              valeur={infos.ia?.[partie]}
              surChoix={(n) => changerTitre(id, (x) => reglerIa(x, partie, n))}
              testid={`ia-${partie}`}
            />
          </div>
        ))}
      </div>
      <button type="button" class="btn btn-ligne btn-danger" aria-label={T.sortie.retirerAide(m.titre)} onClick={() => retirerTitre(id)} data-testid="titre-retirer">
        <IconePoubelle /> {T.sortie.retirer}
      </button>
    </div>
  );
}
