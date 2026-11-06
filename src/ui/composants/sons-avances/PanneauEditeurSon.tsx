// Découpe et éditeur de `sonEdite` (S) : découpe aux attaques ou en parts égales → pads, couper, fondu, normaliser,
// inverser, WSOLA, BPM (double, moitié), tonalité (2 choix) ; SoundFonts .sf2. Ouvert par ouvrirEditeurSon (« Tes sons »).
// Le PCM du son est lu une fois (lireSon) puis partagé par les onglets ; un son modifié devient `sonEdite`.

import { useEffect, useState } from 'preact/hooks';
import { lireSon } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { morceau, PANNEAUX, panneau, sonEdite } from '../../etat';
import { Panneau } from '../../composants/Panneau';
import { arreterEcoute, type PcmSon } from './ecoute';
import { OngletDecoupe } from './OngletDecoupe';
import { OngletModifier } from './OngletModifier';
import { OngletSoundfonts } from './OngletSoundfonts';
import { OngletTempo } from './OngletTempo';
import './sons-avances.css';

type Onglet = 'decouper' | 'modifier' | 'tempo' | 'soundfonts';
const ONGLETS: Onglet[] = ['decouper', 'modifier', 'tempo', 'soundfonts'];

export function PanneauEditeurSon() {
  const ouvert = panneau.value === PANNEAUX.editeurSon;
  const m = morceau.value;
  const son = m?.sons?.find((s) => s.id === sonEdite.value) ?? null;
  const [onglet, setOnglet] = useState<Onglet>('decouper');
  const [pcm, setPcm] = useState<{ fichier: string; pcm: PcmSon | null } | null>(null);

  useEffect(() => {
    if (!ouvert || !son) return;
    if (pcm?.fichier === son.fichier) return;
    let vivant = true;
    setPcm(null);
    lireSon(son).then(
      (p) => vivant && setPcm({ fichier: son.fichier, pcm: p }),
      () => vivant && setPcm({ fichier: son.fichier, pcm: null }),
    );
    return () => void (vivant = false);
  }, [ouvert, son?.fichier]);
  useEffect(() => () => arreterEcoute(), []);

  if (!ouvert) return null;
  const actif: Onglet = son ? onglet : 'soundfonts';
  const pret = son && pcm?.fichier === son.fichier ? pcm.pcm : undefined;

  return (
    <Panneau id={PANNEAUX.editeurSon} titre={son ? son.nom : T.soundfonts.titre}>
      <div class="segments sa-onglets" role="tablist">
        {ONGLETS.map((o) => (
          <button
            key={o}
            type="button"
            role="tab"
            class="segment"
            aria-selected={actif === o}
            aria-checked={actif === o}
            disabled={!son && o !== 'soundfonts'}
            onClick={() => (arreterEcoute(), setOnglet(o))}
            data-testid={`editeur-onglet-${o}`}
          >
            {T.editeurSon.onglets[o]}
          </button>
        ))}
      </div>
      {actif === 'soundfonts' ? (
        <OngletSoundfonts />
      ) : !son ? (
        <p class="aide">{T.editeurSon.aucunSon}</p>
      ) : pret === undefined ? (
        <p class="aide" data-testid="editeur-chargement">
          {T.editeurSon.chargement}
        </p>
      ) : pret === null ? (
        <p class="message message-alerte">{T.editeurSon.introuvable}</p>
      ) : actif === 'decouper' ? (
        <OngletDecoupe son={son} pcm={pret} />
      ) : actif === 'modifier' ? (
        <OngletModifier son={son} pcm={pret} />
      ) : (
        <OngletTempo son={son} pcm={pret} />
      )}
    </Panneau>
  );
}
