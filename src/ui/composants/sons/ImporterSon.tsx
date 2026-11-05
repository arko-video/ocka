// Importer un son (« Tes sons ») : rappel des droits, bouton qui ouvre le choix de fichier, import par le moteur
// (importerSon, A2), puis le son est ajouté au morceau. En cas d'erreur (ou de bouchon), un toast propre.

import { useRef, useState } from 'preact/hooks';
import { importerSon } from '../../../moteur/api';
import type { SonImporte } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { ajouterSon } from '../../edition/sons';
import { modifier, morceau } from '../../etat';
import { toastErreur } from '../../lecture';
import { IconeAlerte, IconePlus } from '../Icones';

export function RappelDroits() {
  return (
    <div class="message message-alerte" role="note" data-testid="rappel-droits">
      <IconeAlerte taille={20} />
      <span>{T.tesSons.droits}</span>
    </div>
  );
}

export function ImporterSon({ surImport }: { surImport: (son: SonImporte) => void }) {
  const fichier = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);

  const importer = async (f: File | undefined) => {
    const m = morceau.peek();
    if (!f || !m) return;
    setEnCours(true);
    try {
      const son = await importerSon(f, m);
      if (modifier((x) => ajouterSon(x, son))) surImport(son);
    } catch (e) {
      toastErreur(e, T.tesSons.erreur);
    } finally {
      setEnCours(false);
      if (fichier.current) fichier.current.value = '';
    }
  };

  return (
    <div class="importer-son">
      <RappelDroits />
      <input
        ref={fichier}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg"
        hidden
        onChange={(e) => void importer(e.currentTarget.files?.[0])}
        data-testid="importer-son-fichier"
      />
      <button type="button" class="btn btn-contour" disabled={enCours} onClick={() => fichier.current?.click()} data-testid="importer-son">
        <IconePlus taille={20} /> {enCours ? T.tesSons.importEnCours : T.tesSons.importer}
      </button>
      <span class="aide">{T.tesSons.formats}</span>
    </div>
  );
}
