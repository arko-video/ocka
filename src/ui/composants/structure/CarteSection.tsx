// Une section de l'arrangement : résumé (nom, mesures, fill / coupure, motifs, boucle), et une fois ouverte,
// ses réglages, sa boucle, ses effets de fin (C3, R), ses paroles et ses actions (monter, descendre, dupliquer, supprimer).
// Vague B (B2) : « Continue mon idée » et « Aide aux paroles » (IA facultative), dans des panneaux propres à la carte.

import { idMotifDe, pistesInstrument } from '../../../morceau/acces';
import type { Morceau, Section } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { motifsBatterie, nomMotif } from '../../edition/batterie';
import {
  choisirMotifSection,
  deplacerSection,
  dupliquerSection,
  dureeSection,
  occurrence,
  reglerSection,
  supprimerSection,
} from '../../edition/sections';
import { sonParId } from '../../edition/sons';
import { afficherToast, annulerAction, modifier } from '../../etat';
import { mmss } from '../../format';
import { IconeBas, IconeBoucle, IconeCopier, IconeHaut, IconeMoins, IconePlus, IconePoubelle } from '../Icones';
import { ouvrirPanneau, ouvrirPerformance } from '../../navigation';
import { PanneauParolesIA } from '../../ia/PanneauParolesIA';
import { PanneauReglagesIA } from '../../ia/PanneauReglagesIA';
import { PanneauSuiteIA } from '../../ia/PanneauSuiteIA';

interface Props {
  m: Morceau;
  s: Section;
  index: number;
  ouverte: boolean;
  basculer: () => void;
  /** Ouvre le panneau « Boucle » de cette section. */
  ouvrirBoucle: () => void;
}

export function CarteSection({ m, s, index, ouverte, basculer, ouvrirBoucle }: Props) {
  const occ = occurrence(m.ordre, index);
  const repetee = m.ordre.filter((x) => x === s.id).length > 1;
  const coupure = s.coupure ?? 'aucune';
  const pistes = [
    s.motifs.batterie ? `${T.structure.batterie} : ${nomMotif(m, s.motifs.batterie)}` : null,
    s.motifs.basse ? T.structure.basse : null,
    s.motifs.accords ? T.structure.accords : null,
    // Pistes instrument qui jouent dans la section (format /3 : « Mélodie », « Piano »…).
    ...pistesInstrument(m).map((p) => (idMotifDe(s, p.id) ? p.nom : null)),
  ].filter(Boolean);
  const sonBoucle = sonParId(m, s.boucle?.son);
  const boucle = s.boucle && sonBoucle ? T.structure.boucleDe(sonBoucle.nom, s.boucle.mesures) : null;
  const idCorps = `section-corps-${index}`;
  const cle = (quoi: string) => `section:${s.id}:${quoi}`;
  // Panneaux de l'IA propres à cette carte (une section peut revenir plusieurs fois dans l'ordre).
  const ia = { suite: `ia-suite-${index}`, paroles: `ia-paroles-${index}`, reglages: `ia-reglages-${index}` };

  return (
    <li class="carte-section" data-ouverte={ouverte ? '1' : '0'} data-testid="section">
      <button
        type="button"
        class="carte-section-tete"
        aria-expanded={ouverte}
        aria-controls={idCorps}
        onClick={basculer}
        data-testid="section-tete"
      >
        <span class="carte-section-num chiffres" aria-hidden="true">
          {index + 1}
        </span>
        <span class="carte-section-textes">
          <span class="carte-section-nom" data-testid="section-nom">
            {s.nom}
            {repetee && <span class="carte-section-fois"> · {T.structure.fois(occ)}</span>}
          </span>
          <span class="carte-section-infos">
            {T.structure.mesures(s.mesures)} · <span class="chiffres">{mmss(dureeSection(m, s))}</span>
            {s.fill && <span class="badge">{T.structure.badgeFill}</span>}
            {coupure !== 'aucune' && <span class="badge badge-magenta">{T.structure.coupures[coupure]}</span>}
          </span>
          <span class="carte-section-motifs">{pistes.length ? pistes.join(' · ') : T.structure.silence}</span>
          {boucle && (
            <span class="carte-section-boucle texte-coupe" data-testid="section-boucle-resume">
              {T.structure.boucle} : {boucle}
            </span>
          )}
        </span>
      </button>

      {ouverte && (
        <div id={idCorps} class="carte-section-corps">
          <label class="champ">
            <span class="champ-label">{T.structure.nom}</span>
            <input
              class="champ-texte"
              value={s.nom}
              maxLength={30}
              onInput={(e) => modifier((x) => reglerSection(x, s.id, { nom: e.currentTarget.value }), cle('nom'))}
              data-testid="section-renommer"
            />
          </label>

          <div class="reglage-ligne">
            <span class="reglage-label">{T.structure.nbMesures}</span>
            <div class="compteur">
              <button
                type="button"
                class="btn-icone encadre"
                aria-label={T.structure.moins}
                disabled={s.mesures <= 1}
                onClick={() => modifier((x) => reglerSection(x, s.id, { mesures: s.mesures - 1 }))}
              >
                <IconeMoins />
              </button>
              <span class="compteur-valeur chiffres" aria-live="polite" data-testid="section-mesures">
                {s.mesures}
              </span>
              <button
                type="button"
                class="btn-icone encadre"
                aria-label={T.structure.plus}
                disabled={s.mesures >= 16}
                onClick={() => modifier((x) => reglerSection(x, s.id, { mesures: s.mesures + 1 }))}
              >
                <IconePlus />
              </button>
            </div>
          </div>

          <label class="interrupteur">
            <span>
              <span class="reglage-label">{T.structure.fill}</span>
              <span class="aide">{T.structure.fillAide}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={!!s.fill}
              onChange={(e) => modifier((x) => reglerSection(x, s.id, { fill: e.currentTarget.checked }))}
            />
          </label>

          <div class="reglage">
            <span class="reglage-label" id={`coupure-${index}`}>
              {T.structure.coupure}
            </span>
            <div class="segments" role="radiogroup" aria-labelledby={`coupure-${index}`} aria-describedby={`aide-coupure-${index}`}>
              {(['aucune', 'break', 'drop'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={coupure === c}
                  class="segment"
                  onClick={() => modifier((x) => reglerSection(x, s.id, { coupure: c }))}
                >
                  {T.structure.coupures[c]}
                </button>
              ))}
            </div>
            <p id={`aide-coupure-${index}`} class="aide">
              {T.structure.coupuresAide}
            </p>
          </div>

          <div class="reglage">
            <span class="reglage-label" id={`batterie-${index}`}>
              {T.structure.batterie}
            </span>
            <div class="puces puces-defile" role="radiogroup" aria-labelledby={`batterie-${index}`}>
              {[...motifsBatterie(m), null].map((idm) => (
                <button
                  key={idm ?? 'aucun'}
                  type="button"
                  role="radio"
                  aria-checked={(s.motifs.batterie ?? null) === idm}
                  class="puce"
                  onClick={() => modifier((x) => choisirMotifSection(x, s.id, 'batterie', idm))}
                >
                  {idm ? nomMotif(m, idm) : T.structure.silence}
                </button>
              ))}
            </div>
          </div>

          <div class="reglage-ligne ligne-boucle">
            <span class="ligne-boucle-textes">
              <span class="reglage-label">{T.structure.boucle}</span>
              <span class="aide texte-coupe">{boucle ?? T.structure.sansBoucle}</span>
            </span>
            <button type="button" class="btn btn-contour btn-petit" aria-haspopup="dialog" onClick={ouvrirBoucle} data-testid="section-boucle">
              <IconeBoucle taille={18} /> {T.structure.boucle}
            </button>
          </div>

          <label class="champ">
            <span class="champ-label">{T.structure.paroles}</span>
            <textarea
              class="champ-texte champ-paroles"
              rows={4}
              value={s.paroles ?? ''}
              aria-describedby={`aide-paroles-${index}`}
              onInput={(e) => modifier((x) => reglerSection(x, s.id, { paroles: e.currentTarget.value }), cle('paroles'))}
              data-testid="section-paroles"
            />
            <span id={`aide-paroles-${index}`} class="aide">
              {T.structure.parolesAide}
            </span>
          </label>

          <div class="ia-actions-section">
            <button type="button" class="btn btn-contour btn-petit" aria-haspopup="dialog" onClick={() => ouvrirPerformance(s.id)} data-testid="section-perf">
              {T.performance.carte(s.perf?.length ?? 0)}
            </button>
          </div>

          <div class="ia-actions-section">
            <button type="button" class="btn btn-contour btn-petit" aria-haspopup="dialog" onClick={() => ouvrirPanneau(ia.paroles)} data-testid="ia-paroles">
              {T.ia.paroles}
            </button>
            <button type="button" class="btn btn-contour btn-petit" aria-haspopup="dialog" onClick={() => ouvrirPanneau(ia.suite)} data-testid="ia-suite">
              {T.ia.suite}
            </button>
          </div>

          <div class="actions-section">
            <button type="button" class="btn btn-petit" disabled={index === 0} onClick={() => modifier((x) => deplacerSection(x, index, -1))} data-testid="section-monter">
              <IconeHaut /> {T.structure.monter}
            </button>
            <button
              type="button"
              class="btn btn-petit"
              disabled={index === m.ordre.length - 1}
              onClick={() => modifier((x) => deplacerSection(x, index, 1))}
              data-testid="section-descendre"
            >
              <IconeBas /> {T.structure.descendre}
            </button>
            <button type="button" class="btn btn-petit" onClick={() => modifier((x) => dupliquerSection(x, index))} data-testid="section-dupliquer">
              <IconeCopier /> {T.structure.dupliquer}
            </button>
            <button
              type="button"
              class="btn btn-petit btn-danger"
              onClick={() => {
                if (m.ordre.length <= 1) return afficherToast(T.structure.derniere);
                if (modifier((x) => supprimerSection(x, index)))
                  afficherToast(T.structure.supprimee, 5000, { label: T.annuler, agir: annulerAction });
              }}
              data-testid="section-supprimer"
            >
              <IconePoubelle /> {T.structure.supprimer}
            </button>
          </div>
        </div>
      )}
      <PanneauSuiteIA id={ia.suite} idReglages={ia.reglages} m={m} s={s} index={index} />
      <PanneauParolesIA id={ia.paroles} idReglages={ia.reglages} m={m} s={s} />
      <PanneauReglagesIA id={ia.reglages} />
    </li>
  );
}
