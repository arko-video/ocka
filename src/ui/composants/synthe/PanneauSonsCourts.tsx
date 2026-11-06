// Sons courts fabriqués (L) : fabricant de kick (hauteur, chute, claquement, saturation) et bruitages sfxr, écoutés
// tout de suite, gardés dans « Tes sons » avec leur recette (enregistrerSonFabrique), puis posés sur un pad. Un son
// déjà fabriqué se retouche : « Mettre à jour » le remplace (même id : ses pads le gardent). Ouvert depuis « Tes sons ».

import { useState } from 'preact/hooks';
import { enregistrerSonFabrique, fabriquerSon, kickParDefaut } from '../../../moteur/api';
import {
  PADS_PERSO,
  type Morceau,
  type PadPerso,
  type RecetteKick,
  type RecetteSfxr,
  type RecetteSon,
  type SonImporte,
} from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { affecterPad, ajouterSon, sonDuPad } from '../../edition/sons';
import { afficherToast, instrumentEdite, modifier, morceau, PANNEAUX, panneau } from '../../etat';
import { entendre, toastErreur } from '../../lecture';
import { Panneau } from '../Panneau';
import { ecouterPcm } from './ecoute';
import { ReglagesBruitages } from './ReglagesBruitages';
import { ReglagesKick } from './ReglagesKick';
import './synthe.css';

/** Remplace un son fabriqué par sa version retouchée (même id ; ses découpes et les pads sur une découpe sont retirés). Pur. */
function remplacerSon(m: Morceau, id: string, son: SonImporte): Morceau {
  if (!m.sons?.some((s) => s.id === id)) return m;
  const tranchesPads = { ...m.tranchesPads };
  for (const pad of PADS_PERSO) if (m.pads?.[pad] === id) delete tranchesPads[pad];
  const sons = m.sons.map((s) => (s.id === id ? { ...son, id } : s));
  return m.tranchesPads ? { ...m, sons, tranchesPads } : { ...m, sons };
}

function jouer(r: RecetteSon) {
  try {
    void ecouterPcm(fabriquerSon(r)).catch(toastErreur);
  } catch (e) {
    toastErreur(e);
  }
}

function Contenu({ m }: { m: Morceau }) {
  const [onglet, setOnglet] = useState<'kick' | 'sfxr'>('kick');
  const [kick, setKick] = useState<RecetteKick>(kickParDefaut);
  const [sfxr, setSfxr] = useState<RecetteSfxr | null>(null);
  const [nom, setNom] = useState<string>(T.sonsCourts.nomKick);
  const [retouche, setRetouche] = useState<string | null>(null);
  const [garde, setGarde] = useState<SonImporte | null>(null);
  const [enCours, setEnCours] = useState(false);
  const recette: RecetteSon | null = onglet === 'kick' ? kick : sfxr;
  const fabriques = (m.sons ?? []).filter((s) => s.recette);
  const ancien = retouche ? m.sons?.find((s) => s.id === retouche) : undefined;

  const garder = async () => {
    if (!recette || enCours) return;
    setEnCours(true);
    try {
      const son = await enregistrerSonFabrique(recette, nom, m);
      if (ancien) {
        modifier((x) => remplacerSon(x, ancien.id, son));
        afficherToast(T.sonsCourts.misAJour(son.nom));
        setGarde(null);
      } else {
        modifier((x) => ajouterSon(x, son));
        setGarde(son);
      }
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnCours(false);
    }
  };

  const poser = (pad: PadPerso) => {
    if (!garde) return;
    modifier((x) => affecterPad(x, pad, garde.id));
    instrumentEdite.value = pad;
    afficherToast(T.sonsCourts.surPad(garde.nom, PADS_PERSO.indexOf(pad) + 1));
    entendre(pad);
  };

  const changerOnglet = (o: 'kick' | 'sfxr') => (
    setOnglet(o),
    setRetouche(null),
    setGarde(null),
    setNom(o === 'kick' ? T.sonsCourts.nomKick : T.sonsCourts.categories.piece!)
  );

  return (
    <>
      <div class="puces" role="radiogroup" aria-label={T.sonsCourts.titre}>
        {(['kick', 'sfxr'] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            class="puce"
            aria-checked={onglet === o}
            onClick={() => changerOnglet(o)}
            data-testid={`sons-courts-onglet-${o}`}
          >
            {o === 'kick' ? T.sonsCourts.kick : T.sonsCourts.bruitages}
          </button>
        ))}
      </div>

      {fabriques.length > 0 && (
        <div class="reglage">
          <span class="reglage-label">{T.sonsCourts.retoucher}</span>
          <div class="puces">
            {fabriques.map((s) => (
              <button
                key={s.id}
                type="button"
                class="puce"
                aria-pressed={retouche === s.id}
                onClick={() => {
                  const r = s.recette!;
                  if (r.type === 'kick') (setOnglet('kick'), setKick(r));
                  else (setOnglet('sfxr'), setSfxr(r));
                  setNom(s.nom);
                  setRetouche(s.id);
                  setGarde(null);
                  jouer(r);
                }}
                data-testid={`sons-courts-retoucher-${s.id}`}
              >
                {s.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="reglage">
        {onglet === 'kick' ? (
          <ReglagesKick kick={kick} changer={(k) => (setKick(k), setGarde(null))} jouer={jouer} />
        ) : (
          <ReglagesBruitages
            recette={sfxr}
            choisir={(r, n) => (setSfxr(r), setGarde(null), n && !retouche && setNom(n), jouer(r))}
          />
        )}
      </div>

      {recette && (
        <div class="reglage">
          <label class="champ">
            <span class="champ-label">{T.sonsCourts.nom}</span>
            <input
              class="champ-texte"
              type="text"
              maxLength={60}
              value={nom}
              onInput={(e) => setNom(e.currentTarget.value)}
              data-testid="sons-courts-nom"
            />
          </label>
          <div class="synthe-actions">
            <button
              type="button"
              class="btn btn-petit btn-contour"
              onClick={() => jouer(recette)}
              data-testid="sons-courts-ecouter"
            >
              {T.sonsCourts.ecouter}
            </button>
            <button
              type="button"
              class="btn btn-petit btn-principal"
              disabled={enCours}
              onClick={() => void garder()}
              data-testid="sons-courts-garder"
            >
              {enCours
                ? T.sonsCourts.enCours
                : ancien
                  ? T.sonsCourts.remplacer(ancien.nom)
                  : T.sonsCourts.garder}
            </button>
          </div>
        </div>
      )}

      {garde && (
        <div class="reglage" data-testid="sons-courts-pads">
          <span class="reglage-label">{T.sonsCourts.garde(garde.nom)}</span>
          <div class="synthe-pads">
            {PADS_PERSO.map((pad, i) => {
              const actuel = sonDuPad(m, pad);
              return (
                <button
                  key={pad}
                  type="button"
                  class="choix choix-pad"
                  aria-pressed={actuel?.id === garde.id}
                  onClick={() => poser(pad)}
                  data-testid={`sons-courts-pad-${i + 1}`}
                >
                  <span>{T.sonsCourts.pad(i + 1)}</span>
                  <span class="choix-detail texte-coupe">{actuel ? actuel.nom : T.sonsCourts.padVide}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export function PanneauSonsCourts() {
  if (panneau.value !== PANNEAUX.sonsCourts) return null;
  const m = morceau.value;
  return (
    <Panneau id={PANNEAUX.sonsCourts} titre={T.sonsCourts.titre}>
      {m && <Contenu m={m} />}
    </Panneau>
  );
}
