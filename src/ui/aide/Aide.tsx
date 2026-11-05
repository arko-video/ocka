// L'aide en plein écran, par-dessus l'écran en cours (panneau « aide:<page> »). Retour (en-tête ou téléphone) revient
// à la page d'avant ; la croix ferme toute l'aide. Liens externes : nouvel onglet, sans aucun appel réseau de l'appli.
// Propriétaire : B3.

import { useEffect, useRef } from 'preact/hooks';
import { version } from '../../../package.json';
import { T } from '../../textes-fr';
import { IconeRetour } from '../composants/Icones';
import { fermerAide, fermerPanneau, ouvrirAide, pageAideOuverte } from '../navigation';
import { ADRESSE_CODE, LIENS_AIDE } from './liens';
import { estPage, insecables, PAGES } from './pages';
import type { Bloc } from './types';
import './aide.css';

function LienExterne({ href, texte }: { href: string; texte: string }) {
  return (
    <a class="guide-lien" href={href} target="_blank" rel="noopener noreferrer" data-testid="aide-lien">
      <span>{insecables(texte)}</span>
      <span class="sr-only"> {T.aide.nouvelOnglet}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    </a>
  );
}

function BlocAide({ b }: { b: Bloc }) {
  switch (b.t) {
    case 'p':
      return <p class="guide-p">{insecables(b.texte)}</p>;
    case 'titre':
      return <h3 class="guide-intertitre">{insecables(b.texte)}</h3>;
    case 'liste': {
      const items = b.items.map((x) => <li key={x}>{insecables(x)}</li>);
      return b.numerotee ? <ol class="guide-liste guide-etapes">{items}</ol> : <ul class="guide-liste">{items}</ul>;
    }
    case 'conseil':
      return <p class="guide-conseil">{insecables(b.texte)}</p>;
    case 'question':
      return (
        <details class="guide-question">
          <summary>{insecables(b.q)}</summary>
          <p>{insecables(b.r)}</p>
        </details>
      );
    case 'lien':
      return <LienExterne href={LIENS_AIDE[b.lien]} texte={b.texte} />;
    case 'voir':
      return (
        <button type="button" class="guide-voir" onClick={() => ouvrirAide(b.page)} data-testid={`aide-voir-${b.page}`}>
          <span>{insecables(b.texte)}</span>
          <span class="guide-chevron" aria-hidden="true">›</span>
        </button>
      );
  }
}

/** Ce que « À propos » ajoute aux blocs : version, licence, code. */
function APropos() {
  return (
    <div class="guide-apropos">
      <p class="guide-p">
        <strong>{T.appli}</strong> · {T.aide.version(version)} · {T.aide.licence}
      </p>
      <LienExterne href={ADRESSE_CODE} texte={T.aide.code} />
    </div>
  );
}

export function Aide() {
  const id = pageAideOuverte();
  const page = estPage(id) ? id : 'guide';
  const corps = useRef<HTMLDivElement>(null);
  const titre = useRef<HTMLHeadingElement>(null);

  // Nouvelle page : on remonte en haut et le lecteur d'écran lit le titre.
  useEffect(() => {
    corps.current?.scrollTo?.(0, 0);
    titre.current?.focus();
  }, [page]);

  // Échap ferme toute l'aide ; à la fermeture, le focus revient où il était.
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerAide();
    };
    window.addEventListener('keydown', touche);
    return () => {
      window.removeEventListener('keydown', touche);
      avant?.focus?.();
    };
  }, []);

  const p = PAGES[page];
  return (
    <div class="guide" role="dialog" aria-modal="true" aria-labelledby="guide-titre" data-testid="aide" data-page={page}>
      <header class="guide-entete">
        <button type="button" class="btn-icone" aria-label={T.aide.retour} onClick={fermerPanneau} data-testid="aide-retour">
          <IconeRetour />
        </button>
        <span class="guide-marque">{T.aide.titre}</span>
        <button type="button" class="btn-icone" aria-label={T.aide.fermer} onClick={fermerAide} data-testid="aide-fermer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div class="guide-corps" ref={corps}>
        <h2 id="guide-titre" class="guide-titre" tabIndex={-1} ref={titre}>
          {insecables(p.titre)}
        </h2>
        <p class="guide-resume">{insecables(p.resume)}</p>
        {p.blocs.map((b, i) => (
          <BlocAide key={`${page}-${i}`} b={b} />
        ))}
        {page === 'a-propos' && <APropos />}
        {page !== 'guide' && (
          <button type="button" class="btn btn-contour guide-tout" onClick={() => ouvrirAide('guide')} data-testid="aide-tout">
            {T.aide.toutLeGuide}
          </button>
        )}
      </div>
    </div>
  );
}
