// Carte « Autotune » de la prise choisie (Voix, C2, A2) : préréglages Naturel / Pop / Robot / Hyperpop en pastilles,
// gamme (détectée : 2 choix, ou « Changer »), réglages fins en « Avancé », « Corriger tout seul », « Avec l'IA »,
// « Écouter Avant / Après » et le badge « En préparation… » pendant le rendu. Tout changement = une étape d'Annuler.

import { useEffect, useState } from 'preact/hooks';
import { appliquerConseil, corrigerToutSeul, PRESETS_FIXES, reglagesPreset, type PresetFixe } from '../../../moteur/api';
import type { Morceau, Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { appliquerPreset, ecrireAutotunePrise } from '../../edition/autotune';
import { afficherToast, annulerAction, modeAvance, modifier } from '../../etat';
import { ouvrirEditeurAutotune } from '../../navigation';
import { IconeLecture, IconeStop } from '../Icones';
import { AutotuneIA } from './AutotuneIA';
import { analyses, chargerAnalyse, ecouteAB, ecouter, planifierRendu, rendus, signaler } from './autotune-etat';
import { GammeAutotune } from './GammeAutotune';
import { ReglagesAutotune } from './ReglagesAutotune';
import './autotune.css';

export function CarteAutotune({ m, prise, nom }: { m: Morceau; prise: Prise; nom: string }) {
  const a = prise.autotune;
  const [ia, setIa] = useState(false);
  const [occupe, setOccupe] = useState(false);
  // Chaque changement des réglages (Annuler compris) relance le rendu en tâche de fond.
  useEffect(() => planifierRendu(m, prise), [JSON.stringify(a), m.tonalite.tonique, m.tonalite.mode, prise.id]);
  // Avec un autotune : on cherche la gamme (analyse en cache, sans toast si elle n'est pas encore livrée).
  useEffect(() => {
    if (a) void chargerAnalyse(prise, false);
  }, [prise.fichier, !!a]);

  const rendu = rendus.value.get(prise.id);
  const ecoute = ecouteAB.value?.idPrise === prise.id ? ecouteAB.value.cote : null;
  const analyse = analyses.value.get(prise.fichier);

  function choisirPreset(p: PresetFixe) {
    try {
      const reglages = reglagesPreset(p);
      modifier((x) => appliquerPreset(x, prise.id, reglages));
    } catch (e) {
      signaler(e);
    }
  }

  async function corriger() {
    setOccupe(true);
    try {
      const an = await chargerAnalyse(prise);
      if (!an) return;
      const conseil = corrigerToutSeul(an, m.tonalite, m.style);
      if (modifier((x) => appliquerConseil(x, prise.id, conseil)))
        afficherToast(conseil.explication ?? T.autotuneAvance.corrige, 6000, { label: T.annuler, agir: annulerAction });
    } catch (e) {
      signaler(e);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section class="carte carte-autotune" aria-labelledby="titre-autotune-prise" data-testid="carte-autotune">
      <h2 id="titre-autotune-prise" class="carte-titre">
        {T.autotuneAvance.carte} <span class="carte-autotune-prise">{T.autotuneAvance.deLaPrise(nom)}</span>
      </h2>
      {rendu?.etat === 'calcul' && (
        <p class="badge autotune-badge" role="status" data-testid="autotune-avance-preparation">
          {rendu.part > 0 ? T.autotuneAvance.preparationPart(Math.round(rendu.part * 100)) : T.autotuneAvance.preparation}
        </p>
      )}

      <div class="pastilles-presets" role="radiogroup" aria-label={T.autotuneAvance.sonAutotune}>
        {PRESETS_FIXES.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            class="pastille-effet pastille-preset"
            aria-checked={a?.preset === p}
            onClick={() => choisirPreset(p)}
            data-testid={`autotune-preset-${p}`}
          >
            {T.autotuneAvance.presets[p]}
          </button>
        ))}
      </div>
      <p class="aide" data-testid="autotune-preset-aide">
        {a ? T.autotuneAvance.presetsAide[a.preset] : T.autotuneAvance.choisir}
        {a?.preset === 'perso' && <span class="badge">{T.autotuneAvance.presets.perso}</span>}
      </p>

      {a && <GammeAutotune m={m} prise={prise} a={a} analyse={analyse} />}
      {a && modeAvance.value && <ReglagesAutotune prise={prise} a={a} />}

      {rendu?.etat === 'repli' && (
        <p class="message message-alerte" role="status" data-testid="autotune-avance-repli">
          {T.autotuneAvance.repli}
        </p>
      )}

      {a && (
        <div class="reglage">
          <span class="reglage-label" id="label-ab-autotune">
            {T.autotuneAvance.ab}
          </span>
          <div class="segments" role="group" aria-labelledby="label-ab-autotune">
            {(['avant', 'apres'] as const).map((cote) => (
              <button
                key={cote}
                type="button"
                class="segment segment-ab"
                aria-pressed={ecoute === cote}
                onClick={() => void ecouter(prise, cote)}
                data-testid={`autotune-${cote}`}
              >
                {ecoute === cote ? <IconeStop taille={16} /> : <IconeLecture taille={16} />}
                {T.autotuneAvance[cote]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="actions-autotune">
        <button type="button" class="btn btn-contour" disabled={occupe} onClick={() => void corriger()} data-testid="autotune-corriger">
          {occupe ? T.autotuneAvance.analyse : T.autotuneAvance.corriger}
        </button>
        <button type="button" class="btn btn-contour" aria-expanded={ia} onClick={() => setIa(!ia)} data-testid="autotune-ia">
          {T.autotuneAvance.ia}
        </button>
      </div>
      {!ia && <p class="aide">{T.autotuneAvance.corrigerAide}</p>}
      {ia && <AutotuneIA m={m} prise={prise} />}

      {a && (
        <div class="actions-autotune">
          {modeAvance.value && (
            <button type="button" class="btn btn-principal" onClick={() => ouvrirEditeurAutotune(prise.id)} data-testid="autotune-ouvrir-editeur">
              {T.autotuneAvance.ouvrirEditeur}
            </button>
          )}
          <button
            type="button"
            class="btn btn-discret btn-petit"
            onClick={() =>
              modifier((x) => ecrireAutotunePrise(x, prise.id, undefined)) &&
              afficherToast(T.autotuneAvance.retire, 6000, { label: T.annuler, agir: annulerAction })
            }
            data-testid="autotune-retirer"
          >
            {T.autotuneAvance.retirer}
          </button>
        </div>
      )}
    </section>
  );
}
