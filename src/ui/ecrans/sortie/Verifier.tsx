// Assistant de sortie — écran 3 « Vérifier » : « Prêt pour Spotify ? » (problèmes avec « Corriger »), type de sortie
// calculé, format des fichiers, puis « Préparer le dossier » (progression par titre, Annuler) et le téléchargement.
// Propriétaire : A1.

import { useEffect, useRef } from 'preact/hooks';
import { typeSortie, verifierSortie, type ProblemeSortie, type Sortie } from '../../../moteur/api';
import { dureeMorceau } from '../../../morceau/temps';
import { T } from '../../../textes-fr';
import { sortieEditee } from '../../etat';
import { mmss } from '../../format';
import { cotePochette, titresSortie, viser } from '../../sorties';
import { IconeAlerte, IconeCoche, IconePartager, IconeTelecharger } from '../../composants/Icones';
import { Choix, EnteteSortie, PiedSortie, VignettePochette } from '../../composants/sortie/communs';
import { annulerDossier, etatDossier, formatChoisi, formatDe, partagerDossier, preparerDossier, type FormatDossier } from '../../composants/sortie/dossier-ui';

function Probleme({ p }: { p: ProblemeSortie }) {
  return (
    <li class="probleme" data-niveau={p.niveau} data-code={p.code}>
      <span class="probleme-icone" aria-hidden="true">
        <IconeAlerte taille={18} />
      </span>
      <span class="probleme-texte">
        <span class="sr-only">{p.niveau === 'bloquant' ? T.sortie.bloquant : T.sortie.conseil} : </span>
        {p.message}
      </span>
      <button type="button" class="btn btn-petit probleme-corriger" onClick={() => viser(p.corriger)} data-testid="probleme-corriger">
        {T.sortie.corriger}
      </button>
    </li>
  );
}

function Dossier({ s, bloque }: { s: Sortie; bloque: boolean }) {
  const e = etatDossier.value;
  const n = s.titres.length;
  // La progression, le résultat ou l'erreur apparaissent en bas de l'écran : on les amène sous le pouce.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (e.phase !== 'avant') ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [e.phase]);
  if (e.phase === 'encours') {
    const finitions = e.titre >= n - 1 && e.p >= 1;
    const nom = titresSortie.value.get(s.titres[e.titre] ?? '')?.titre ?? '';
    const total = n ? (e.titre + e.p) / n : 0;
    return (
      <section class="carte" ref={ref} data-testid="dossier-progression">
        <span aria-live="polite">{finitions ? T.sortie.finitions : T.sortie.progression(e.titre + 1, n, nom, Math.round(e.p * 100))}</span>
        <div class="sortie-barre" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(total * 100)}>
          <span style={{ transform: `scaleX(${total})` }} />
        </div>
        <button type="button" class="btn" onClick={annulerDossier} data-testid="annuler-dossier">
          {T.sortie.annuler}
        </button>
      </section>
    );
  }
  if (e.phase === 'fini') {
    return (
      <section class="carte dossier-pret" ref={ref} data-testid="dossier-pret">
        <h2 class="carte-titre">
          <IconeCoche taille={20} /> {T.sortie.dossierPret}
        </h2>
        <p class="aide sortie-nom-fichier">{e.nom}</p>
        <a class="btn btn-principal" href={e.url} download={e.nom} data-testid="telecharger-dossier">
          <IconeTelecharger /> {T.sortie.telecharger}
        </a>
        <button type="button" class="btn" onClick={() => void partagerDossier()} data-testid="partager-dossier">
          <IconePartager /> {T.sortie.partager}
        </button>
        <p class="sortie-rappel">{T.sortie.rappel(s.distributeur === 'autre' ? T.sortie.tonDistributeur : T.sortie.distributeurs[s.distributeur])}</p>
      </section>
    );
  }
  return (
    <>
      {e.phase === 'erreur' && (
        <section class="message message-erreur" role="alert" ref={ref} data-testid="erreur-dossier">
          <IconeAlerte taille={20} />
          <span>{e.message}</span>
        </section>
      )}
      <PiedSortie>
        <button type="button" class="btn btn-principal" disabled={bloque} onClick={() => void preparerDossier()} data-testid="preparer-dossier">
          {T.sortie.preparer}
        </button>
      </PiedSortie>
    </>
  );
}

export function Verifier() {
  const s = sortieEditee.value;
  if (!s) return <div class="ecran sortie" data-testid="ecran-sortie-verifier" />;
  const map = titresSortie.value;
  const problemes = verifierSortie(s, map, cotePochette.value);
  const bloquants = problemes.filter((p) => p.niveau === 'bloquant');
  const conseils = problemes.filter((p) => p.niveau === 'conseil');
  const durees = s.titres.flatMap((id) => (map.has(id) ? [dureeMorceau(map.get(id)!)] : []));
  const total = durees.reduce((a, d) => a + d, 0);
  const format = formatDe(s);
  const [a, m, j] = s.dateSortie.split('-');
  return (
    <div class="ecran sortie" data-testid="ecran-sortie-verifier">
      <EnteteSortie />
      <main class="ecran-corps">
        <section class="carte sortie-resume">
          <VignettePochette cle={s.pochette} classe="sortie-resume-pochette" />
          <div class="sortie-resume-textes">
            <strong class="sortie-resume-titre">{s.titre.trim() || T.sortie.sansTitre}</strong>
            <span>{s.artiste}</span>
            <span class="doux chiffres" data-testid="type-sortie">
              {T.sortie.resume(T.sortie.types[typeSortie(durees)], T.sortie.nbTitres(s.titres.length), mmss(total))}
            </span>
            <span class="doux chiffres">
              {j}/{m}/{a} · {T.sortie.distributeurs[s.distributeur]}
            </span>
          </div>
        </section>
        <section class="carte" data-testid="verifier-problemes">
          <h2 class="carte-titre">{T.sortie.pret}</h2>
          {bloquants.length === 0 ? (
            <p class="sortie-ok" data-testid="sortie-prete">
              <IconeCoche taille={20} /> {T.sortie.toutBon}
            </p>
          ) : (
            <p class="sortie-ko">{T.sortie.aCorriger(bloquants.length)}</p>
          )}
          {bloquants.length > 0 && (
            <ul class="problemes">
              {bloquants.map((p, i) => (
                <Probleme key={`${p.code}-${i}`} p={p} />
              ))}
            </ul>
          )}
          {conseils.length > 0 && (
            <>
              <h3 class="sous-titre">{T.sortie.conseils}</h3>
              <ul class="problemes">
                {conseils.map((p, i) => (
                  <Probleme key={`${p.code}-${i}`} p={p} />
                ))}
              </ul>
            </>
          )}
        </section>
        <section class="carte">
          <h2 class="carte-titre">{T.sortie.format}</h2>
          <Choix<FormatDossier>
            etiquette={T.sortie.format}
            options={[
              { valeur: 'flac16', texte: T.sortie.formats.flac16 },
              { valeur: 'wav24', texte: T.sortie.formats.wav24 },
            ]}
            valeur={format}
            surChoix={(f) => (formatChoisi.value = f)}
            testid="format"
          />
          <span class="aide">{T.sortie.formatAide[format]}</span>
        </section>
        <Dossier s={s} bloque={bloquants.length > 0} />
      </main>
    </div>
  );
}
