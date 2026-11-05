// Étape 2 — Structure : l'arrangement (sections dans l'ordre), durée totale, ajout de sections, boucles de tes sons.

import { useState } from 'preact/hooks';
import { dureeMorceau } from '../../moteur/api';
import { T } from '../../textes-fr';
import { ajouterSection, NOMS_SECTIONS, repeterSection } from '../edition/sections';
import { modifier, morceau, panneau, sectionCourante } from '../etat';
import { mmss } from '../format';
import { fermerPanneau, ouvrirPanneau } from '../navigation';
import { IconePlus } from '../composants/Icones';
import { Panneau } from '../composants/Panneau';
import { CarteSection } from '../composants/structure/CarteSection';
import { PanneauBoucle } from '../composants/structure/PanneauBoucle';

export function Structure() {
  const m = morceau.value;
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [boucleDe, setBoucleDe] = useState<string | null>(null);
  if (!m) return null;

  const ajouter = (op: () => void) => {
    op();
    fermerPanneau();
    const n = morceau.peek()?.ordre.length ?? 0;
    setOuverte(n - 1);
    sectionCourante.value = morceau.peek()?.ordre[n - 1] ?? null;
  };

  return (
    <div class="etape-structure">
      <div class="resume-structure">
        <div>
          <span class="aide">{T.structure.duree}</span>
          <span class="duree-totale chiffres" data-testid="duree-totale">
            {mmss(dureeMorceau(m))}
          </span>
        </div>
        <button
          type="button"
          class="btn btn-contour"
          aria-haspopup="dialog"
          onClick={() => ouvrirPanneau('ajouter-section')}
          data-testid="ajouter-section"
        >
          <IconePlus /> {T.structure.ajouter}
        </button>
      </div>

      <ol class="liste-sections" aria-label={T.structure.titre} data-testid="liste-sections">
        {m.ordre.map((id, i) => {
          const s = m.sections.find((x) => x.id === id);
          if (!s) return null;
          return (
            <CarteSection
              key={`${id}-${i}`}
              m={m}
              s={s}
              index={i}
              ouverte={ouverte === i}
              basculer={() => {
                setOuverte(ouverte === i ? null : i);
                sectionCourante.value = id;
              }}
              ouvrirBoucle={() => {
                setBoucleDe(id);
                ouvrirPanneau('boucle');
              }}
            />
          );
        })}
      </ol>

      {panneau.value === 'boucle' && boucleDe && <PanneauBoucle idSection={boucleDe} />}

      {panneau.value === 'ajouter-section' && (
        <Panneau id="ajouter-section" titre={T.structure.ajouterTitre}>
          <h3 class="sous-titre">{T.structure.nouvelle}</h3>
          <div class="grille-choix">
            {NOMS_SECTIONS.map((nom) => (
              <button
                key={nom}
                type="button"
                class="choix"
                onClick={() => ajouter(() => modifier((x) => ajouterSection(x, nom)))}
                data-testid={`nouvelle-${nom}`}
              >
                {nom}
              </button>
            ))}
          </div>
          <h3 class="sous-titre">{T.structure.repeter}</h3>
          <div class="grille-choix">
            {m.sections.map((s) => (
              <button
                key={s.id}
                type="button"
                class="choix choix-contour"
                onClick={() => ajouter(() => modifier((x) => repeterSection(x, s.id)))}
                data-testid={`repeter-${s.id}`}
              >
                {s.nom}
              </button>
            ))}
          </div>
        </Panneau>
      )}
    </div>
  );
}
