// Écoute de référence (V) : import d'un morceau pro (il reste sur l'appareil), choix du passage, A/B « Mon mix |
// Référence » au même volume perçu (sonie BS.1770 des deux). Ouvert par ouvrirReference (Son).

import { useEffect, useRef, useState } from 'preact/hooks';
import { creerEcouteReference, importerReference, listerReferences, supprimerReference, type EcouteReference, type InfoReference } from '../../../moteur/api';
import { formaterDuree } from '../../../morceau/temps';
import { T } from '../../../textes-fr';
import { morceau, PANNEAUX, panneau } from '../../etat';
import { lecteurPret, obtenirLecteur, toastErreur } from '../../lecture';
import { Panneau } from '../../composants/Panneau';
import './voix-avancee.css';

const R = () => T.reference;

export function PanneauReference() {
  const ouvert = panneau.value === PANNEAUX.reference;
  const [refs, setRefs] = useState<InfoReference[] | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [passage, setPassage] = useState(0);
  const [progres, setProgres] = useState<number | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [surRef, setSurRef] = useState(false);
  const [comp, setComp] = useState<number | null>(null);
  const ecoute = useRef<EcouteReference | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  const fermerEcoute = () => {
    ecoute.current?.detruire();
    ecoute.current = null;
    setSurRef(false);
    setComp(null);
  };
  useEffect(() => {
    if (!ouvert) return fermerEcoute();
    listerReferences().then(setRefs, (e: unknown) => (toastErreur(e), setRefs([])));
    return fermerEcoute;
  }, [ouvert]);
  if (!ouvert) return null;

  const ref = refs?.find((r) => r.id === choisie) ?? refs?.[0] ?? null;

  async function importer(f: File) {
    setProgres(0);
    try {
      const info = await importerReference(f, { surProgression: setProgres });
      setRefs((l) => [...(l ?? []).filter((x) => x.id !== info.id), info]);
      setChoisie(info.id);
      setPassage(0);
      fermerEcoute();
    } catch (e) {
      toastErreur(e);
    } finally {
      setProgres(null);
    }
  }

  async function basculer(versRef: boolean) {
    if (!ref) return;
    try {
      if (!ecoute.current) {
        if (!versRef) return;
        const l = obtenirLecteur();
        if (!l) return;
        setPreparation(true);
        await lecteurPret();
        ecoute.current = await creerEcouteReference(l, ref.id, { morceau: morceau.peek() ?? undefined, passage });
        setComp(ecoute.current.compensationDb);
      }
      ecoute.current.basculer(versRef);
      setSurRef(versRef);
    } catch (e) {
      toastErreur(e);
    } finally {
      setPreparation(false);
    }
  }

  async function supprimer(id: string) {
    if (ref?.id === id) fermerEcoute();
    await supprimerReference(id).catch(toastErreur);
    setRefs((l) => (l ?? []).filter((x) => x.id !== id));
  }

  return (
    <Panneau id={PANNEAUX.reference} titre={R().titre}>
      <div class="va" data-testid="reference-panneau">
        <p class="aide" data-testid="reference-intro">{R().aide}</p>
        <p class="aide" data-testid="reference-sur-appareil">{R().surAppareil}</p>
        <input ref={champ} class="va-fichier" type="file" accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg" onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) void importer(f);
        }} data-testid="reference-fichier" />
        <button type="button" class="btn btn-contour" disabled={progres !== null} onClick={() => champ.current?.click()} data-testid="reference-importer">
          {progres !== null ? R().import(progres) : R().importer}
        </button>
        {refs && refs.length === 0 && <p class="aide">{R().aucune}</p>}
        {refs && refs.length > 0 && (
          <ul class="va-refs">
            {refs.map((r) => (
              <li key={r.id} class="va-ref" aria-current={r.id === ref?.id} data-testid="reference">
                <button type="button" class="btn btn-petit btn-discret va-nom" onClick={() => (fermerEcoute(), setChoisie(r.id), setPassage(0))}>
                  {r.nom}
                </button>
                <span class="chiffres aide" data-testid="reference-lufs">{R().sonie(r.lufs)}</span>
                <button type="button" class="btn btn-petit btn-discret" onClick={() => void supprimer(r.id)} data-testid="reference-supprimer">
                  {R().supprimer}
                </button>
              </li>
            ))}
          </ul>
        )}
        {ref && (
          <section class="carte va-carte">
            <div class="reglage">
              <div class="reglage-tete">
                <label for="va-passage-ref">{R().passage}</label>
                <span class="reglage-valeur chiffres">{formaterDuree(passage)}</span>
              </div>
              <input id="va-passage-ref" type="range" class="curseur" min={0} max={Math.max(0, Math.floor(ref.duree - 5))} step={1} value={passage}
                onChange={(e) => (fermerEcoute(), setPassage(e.currentTarget.valueAsNumber))} data-testid="reference-passage" />
            </div>
            <div class="va-ab" role="group" aria-label="A/B">
              <button type="button" class="btn btn-contour" aria-pressed={!surRef} onClick={() => void basculer(false)} data-testid="reference-mix">{R().ecouterMix}</button>
              <button type="button" class="btn btn-contour" aria-pressed={surRef} disabled={preparation} onClick={() => void basculer(true)} data-testid="reference-ab">{R().ecouterRef}</button>
            </div>
            {preparation && <p class="aide">{R().preparation}</p>}
            {comp !== null && <p class="aide" data-testid="reference-compensation">{R().compensation(comp)}</p>}
          </section>
        )}
      </div>
    </Panneau>
  );
}
