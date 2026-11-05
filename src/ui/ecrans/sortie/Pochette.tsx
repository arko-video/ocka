// Assistant de sortie — écran 2 « Pochette » : importer une image (recadrage centré qu'on glisse) ou
// « Fabriquer une pochette » (4 modèles). Rappel des interdits en une ligne. Propriétaire : A1.

import { useEffect, useState } from 'preact/hooks';
import { preparerPochette } from '../../../moteur/api';
import { T } from '../../../textes-fr';
import { messageErreur, sortieEditee } from '../../etat';
import { cotePochette, majCote, modifierSortie } from '../../sorties';
import { IconeAlerte } from '../../composants/Icones';
import { BoutonSuivant, EnteteSortie, IconeImage, IconePinceau, useVise, VignettePochette } from '../../composants/sortie/communs';
import { Modeles } from '../../composants/sortie/Modeles';
import { Recadrage, type ImageChoisie } from '../../composants/sortie/Recadrage';

const COTE_MIN = 1425;

/** Lit la taille d'une image (en tenant compte de l'orientation de la photo). */
function chargerImage(fichier: File): Promise<ImageChoisie> {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => ok({ fichier, url, largeur: img.naturalWidth, hauteur: img.naturalHeight });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      ko(new Error('image'));
    };
    img.src = url;
  });
}

export function Pochette() {
  const s = sortieEditee.value;
  const [mode, setMode] = useState<'rien' | 'recadrer' | 'fabriquer'>('rien');
  const [image, setImage] = useState<ImageChoisie | null>(null);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useVise();
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  if (!s) return <div class="ecran sortie" data-testid="ecran-sortie-pochette" />;
  const peutFabriquer = !!s.titre.trim() && !!s.artiste.trim();
  const cote = cotePochette.value;

  const choisirFichier = async (f: File | undefined) => {
    if (!f) return;
    setErreur(null);
    try {
      const i = await chargerImage(f);
      if (Math.min(i.largeur, i.hauteur) < COTE_MIN) {
        URL.revokeObjectURL(i.url);
        setMode('rien');
        return setErreur(T.sortie.tropPetite(i.largeur, i.hauteur));
      }
      setImage(i);
      setCentre({ x: 0.5, y: 0.5 });
      setMode('recadrer');
    } catch {
      setErreur(T.sortie.imageIllisible);
    }
  };
  const garder = async () => {
    if (!image) return;
    setOccupe(true);
    try {
      const p = await preparerPochette(image.fichier, centre);
      modifierSortie({ pochette: p.cle });
      void majCote(p.cle, p.cote);
      setMode('rien');
      setImage(null);
    } catch (e) {
      setErreur(messageErreur(e, T.sortie.erreurPochette));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div class="ecran sortie" data-testid="ecran-sortie-pochette">
      <EnteteSortie />
      <main class="ecran-corps">
        <p class="intro">{T.sortie.pochetteIntro}</p>
        {mode !== 'recadrer' && (
          <section class="carte pochette-actuelle">
            <VignettePochette cle={s.pochette} classe="pochette-grande" testid="pochette-apercu" />
            <p class="aide chiffres">{s.pochette ? (cote ? T.sortie.cote(cote) : T.sortie.pochetteActuelle) : T.sortie.aucunePochette}</p>
          </section>
        )}
        {mode === 'recadrer' && image && (
          <section class="carte">
            <p class="aide">{T.sortie.glisser}</p>
            <Recadrage image={image} centre={centre} surCentre={setCentre} />
            <button type="button" class="btn btn-principal" disabled={occupe} onClick={() => void garder()} data-testid="pochette-garder">
              {occupe ? T.sortie.preparation : T.sortie.garder}
            </button>
          </section>
        )}
        {erreur && (
          <div class="message message-erreur" role="alert" data-testid="pochette-erreur">
            <IconeAlerte taille={20} />
            <span>{erreur}</span>
          </div>
        )}
        <div class="pochette-choix">
          <label class="btn btn-contour" data-testid="pochette-importer">
            <IconeImage /> {mode === 'recadrer' ? T.sortie.changerImage : T.sortie.importer}
            <input
              type="file"
              accept="image/*"
              class="sr-only"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                void choisirFichier(f);
              }}
              data-testid="pochette-fichier"
            />
          </label>
          <span class="aide">{T.sortie.importerAide}</span>
          <button
            type="button"
            class="btn btn-contour"
            disabled={!peutFabriquer}
            aria-pressed={mode === 'fabriquer'}
            onClick={() => {
              setMode('fabriquer');
              setErreur(null);
            }}
            data-testid="pochette-fabriquer"
          >
            <IconePinceau /> {T.sortie.fabriquer}
          </button>
          {!peutFabriquer && <span class="aide">{T.sortie.fabriquerAvant}</span>}
        </div>
        {mode === 'fabriquer' && peutFabriquer && <Modeles s={s} />}
        <p class="sortie-interdits" data-testid="pochette-interdits">
          <IconeAlerte taille={16} /> {T.sortie.interdits}
        </p>
      </main>
      <BoutonSuivant vers="sortie-verifier" texte={T.sortie.suivantVerifier} />
    </div>
  );
}
