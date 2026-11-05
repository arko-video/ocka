// Panneau qui monte du bas (feuille) : dialogue modal, fermé par le voile, Échap ou le bouton Retour d'Android.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { T } from '../../textes-fr';
import { panneau } from '../etat';
import { fermerPanneau } from '../navigation';

interface Props {
  id: string;
  titre: string;
  children: ComponentChildren;
  testid?: string;
}

export function Panneau({ id, titre, children, testid }: Props) {
  const ouvert = panneau.value === id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const avant = document.activeElement as HTMLElement | null;
    const premier = ref.current?.querySelector<HTMLElement>('button, input, textarea, [tabindex="0"]');
    premier?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerPanneau();
    };
    window.addEventListener('keydown', touche);
    return () => {
      window.removeEventListener('keydown', touche);
      avant?.focus?.();
    };
  }, [ouvert]);
  if (!ouvert) return null;
  return (
    <div class="voile" onClick={(e) => e.target === e.currentTarget && fermerPanneau()}>
      <div
        class="feuille"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`titre-${id}`}
        ref={ref}
        data-testid={testid ?? `panneau-${id}`}
      >
        <div class="feuille-poignee" aria-hidden="true" />
        <div class="feuille-entete">
          <h2 id={`titre-${id}`} class="feuille-titre">
            {titre}
          </h2>
          <button type="button" class="btn btn-discret btn-petit" onClick={fermerPanneau}>
            {T.fermer}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
