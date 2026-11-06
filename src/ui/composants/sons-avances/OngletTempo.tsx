// Tempo et tonalité d'un son : BPM (avec le double et la moitié), 2 tonalités avec leur confiance ;
// « Caler le morceau sur ce son » (tempo du morceau) ou « Caler le son sur le morceau » (WSOLA, nouveau son).

import { useEffect, useState } from 'preact/hooks';
import { detecterBpm, detecterTonaliteSon, etirerSon, type BpmDetecte, type TonaliteDetectee } from '../../../moteur/api';
import type { SonImporte } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { reglerTempo } from '../../edition/reglages';
import { afficherToast, modifier, morceau } from '../../etat';
import { nombre } from '../../format';
import type { PcmSon } from './ecoute';
import { remplacerPar } from './OngletModifier';

const NOTES: Record<string, string> = { C: 'Do', 'C#': 'Do♯', D: 'Ré', 'D#': 'Ré♯', E: 'Mi', F: 'Fa', 'F#': 'Fa♯', G: 'Sol', 'G#': 'Sol♯', A: 'La', 'A#': 'La♯', B: 'Si' };
const RAPPORT_MIN = 0.8;
const RAPPORT_MAX = 1.25;

interface Analyse {
  bpm: BpmDetecte | null;
  tons: TonaliteDetectee[];
}

export function OngletTempo({ son, pcm }: { son: SonImporte; pcm: PcmSon }) {
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);
  const m = morceau.value;

  useEffect(() => {
    setAnalyse(null);
    // Calcul court (moins de 0,3 s pour 30 s de son) : laissé après l'affichage du message d'attente.
    const t = setTimeout(() => {
      try {
        const bpm = detecterBpm(pcm);
        setAnalyse({ bpm, tons: detecterTonaliteSon(pcm) });
        setChoisi(bpm?.bpm ?? null);
      } catch {
        setAnalyse({ bpm: null, tons: [] });
      }
    }, 30);
    return () => clearTimeout(t);
  }, [pcm]);

  if (!m) return null;
  if (!analyse) return <p class="aide" data-testid="tempo-analyse">{T.editeurSon.analyse}</p>;
  const { bpm, tons } = analyse;
  const rapport = choisi ? choisi / m.tempo : 1; // nouvelle durée / ancienne
  const etirable = rapport >= RAPPORT_MIN && rapport <= RAPPORT_MAX;
  const tempoOk = choisi !== null && choisi >= 60 && choisi <= 200;

  const calerMorceau = () => {
    if (!tempoOk) return afficherToast(T.editeurSon.horsTempo);
    const t = Math.round(choisi!);
    if (modifier((x) => reglerTempo(x, t))) afficherToast(T.editeurSon.morceauCale(t));
  };
  const calerSon = () => {
    if (!etirable || enCours) return;
    void remplacerPar(son, () => etirerSon(morceau.peek()!, son.id, rapport), setEnCours);
  };

  return (
    <div class="sa-onglet">
      <div class="reglage">
        <span class="reglage-label">{T.editeurSon.bpm}</span>
        {bpm ? (
          <div class="puces" role="radiogroup" aria-label={T.editeurSon.bpm} data-testid="tempo-bpm">
            {(
              [
                [bpm.bpm, '', 'bpm'],
                [bpm.moitie, T.editeurSon.moitie, 'moitie'],
                [bpm.double, T.editeurSon.double, 'double'],
              ] as const
            ).map(([v, quoi, cle]) => (
              <button key={cle} type="button" role="radio" class="puce puce-large" aria-checked={choisi === v} onClick={() => setChoisi(v)} data-testid={`tempo-choix-${cle}`}>
                <span class="puce-nom chiffres">{T.editeurSon.bpmValeur(v)}</span>
                {quoi && <span class="puce-detail">{quoi}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p class="aide">{T.editeurSon.pasDeBpm}</p>
        )}
        {bpm && <span class="aide">{T.editeurSon.confiance(bpm.confiance)}</span>}
      </div>
      <div class="reglage">
        <span class="reglage-label">{T.editeurSon.tonalite}</span>
        {tons.length ? (
          <ol class="sa-tons" data-testid="tempo-tonalites">
            {tons.map((t) => (
              <li key={`${t.tonique}${t.mode}`}>
                <strong>
                  {NOTES[t.tonique]} {t.mode === 'majeur' ? T.editeurSon.majeur : T.editeurSon.mineur}
                </strong>{' '}
                <span class="aide">{T.editeurSon.confiance(t.confiance)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p class="aide">{T.editeurSon.pasDeTonalite}</p>
        )}
      </div>
      <p class="aide">{T.editeurSon.tempoMorceau(m.tempo)}</p>
      <div class="sa-actions">
        <button type="button" class="btn btn-contour btn-petit" disabled={!tempoOk} onClick={calerMorceau} data-testid="tempo-caler-morceau">
          {T.editeurSon.caleMorceau}
        </button>
        <button type="button" class="btn btn-contour btn-petit" disabled={!choisi || !etirable || enCours} onClick={calerSon} data-testid="tempo-caler-son">
          {enCours ? T.editeurSon.etireEnCours : T.editeurSon.caleSon}
        </button>
      </div>
      {choisi && !etirable && <p class="aide">{T.editeurSon.tropLoin}</p>}
      {choisi && etirable && <p class="aide chiffres">× {nombre(rapport, 3)}</p>}
    </div>
  );
}
