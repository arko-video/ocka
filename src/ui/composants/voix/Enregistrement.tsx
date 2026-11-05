// Calque plein écran pendant l'enregistrement : décompte « 4, 3, 2, 1 », prompteur qui défile, vumètre, Arrêter.

import { useEffect, useRef } from 'preact/hooks';
import type { Section } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { arreter, decompte, ecoule, niveauMicro, phaseEnr } from '../../voix';
import { IconeStop } from '../Icones';
import { Vumetre } from './Vumetre';

export function Enregistrement({ section, duree }: { section: Section; duree: number }) {
  const phase = phaseEnr.value;
  const prompteur = useRef<HTMLDivElement>(null);
  const fenetre = useRef<HTMLDivElement>(null);
  const actif = phase === 'decompte' || phase === 'enregistrement';
  const t = ecoule.value;
  useEffect(() => {
    const el = prompteur.current;
    if (!el || phase !== 'enregistrement') return;
    const course = el.scrollHeight - el.clientHeight;
    el.scrollTop = course > 0 ? (course * Math.min(1, t / Math.max(1, duree))) : 0;
  }, [t, phase, duree]);
  // La fenêtre prend le focus à l'ouverture (puis le rend) ; Échap arrête, mais seulement pendant la prise.
  const ouverte = phase !== 'repos';
  useEffect(() => {
    if (!ouverte) return;
    const avant = document.activeElement as HTMLElement | null;
    fenetre.current?.focus();
    return () => avant?.focus?.();
  }, [ouverte]);
  useEffect(() => {
    if (!actif) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void arreter();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [actif]);
  if (phase === 'repos') return null;
  const paroles = section.paroles?.trim();
  return (
    <div
      class="calque-enr"
      role="dialog"
      aria-modal="true"
      aria-label={`${T.voix.enregistrement} : ${section.nom}`}
      tabIndex={-1}
      ref={fenetre}
      data-testid="calque-enregistrement"
    >
      <div class="calque-enr-haut">
        <span class="pastille-rec" data-actif={phase === 'enregistrement' ? '1' : '0'}>
          {phase === 'enregistrement' ? 'REC' : T.voix.pret}
        </span>
        <span class="calque-enr-section">{section.nom}</span>
      </div>
      {phase === 'decompte' || phase === 'preparation' ? (
        <div class="decompte" aria-live="assertive" data-testid="decompte">
          <span class="decompte-chiffre" key={decompte.value}>
            {phase === 'preparation' ? '…' : decompte.value}
          </span>
          <span class="aide">{T.voix.decompte}</span>
        </div>
      ) : null}
      <div class="prompteur" ref={prompteur} data-phase={phase} data-testid="prompteur">
        {paroles ? paroles.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>) : <p class="aide">{T.voix.sansParoles}</p>}
      </div>
      <Vumetre niveau={niveauMicro.value} />
      <button
        type="button"
        class="btn-rec"
        data-actif="1"
        aria-label={T.voix.arreter}
        onClick={() => void arreter()}
        disabled={phase === 'fin' || phase === 'preparation'}
        data-testid="arreter"
      >
        <IconeStop taille={34} />
      </button>
    </div>
  );
}
