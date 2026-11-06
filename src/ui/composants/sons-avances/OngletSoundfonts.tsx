// SoundFonts (.sf2) de l'utilisateur, sous sa responsabilité : importer (analyse dans un Worker), choisir une banque
// et un preset, puis « Ajouter une piste » (instrument « sf2-<id>-<banque>-<preset>@1 », joué par l'échantillonneur).

import { useEffect, useRef, useState } from 'preact/hooks';
import { ajouterSoundfont, importerSoundfont, presetsSoundfont, supprimerSoundfont, type PresetSf2 } from '../../../moteur/api';
import type { SoundFontMorceau } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import { ajouterPiste } from '../../edition/api-edition';
import { afficherToast, modifier, morceau } from '../../etat';
import { toastErreur } from '../../lecture';
import { IconeAlerte, IconePlus } from '../Icones';

export function OngletSoundfonts() {
  const m = morceau.value;
  const fichier = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [choisie, setChoisie] = useState<SoundFontMorceau | null>(null);
  const [presets, setPresets] = useState<PresetSf2[] | null>(null);
  const [banque, setBanque] = useState(0);
  const [preset, setPreset] = useState<PresetSf2 | null>(null);
  const liste = m?.soundfonts ?? [];
  const sf = choisie ?? liste[liste.length - 1] ?? null;

  useEffect(() => {
    setPresets(null);
    setPreset(null);
    if (!sf) return;
    let vivant = true;
    presetsSoundfont(sf).then(
      (p) => vivant && (setPresets(p), setBanque(p[0]?.banque ?? 0)),
      (e) => vivant && (setPresets([]), toastErreur(e, T.soundfonts.erreur)),
    );
    return () => void (vivant = false);
  }, [sf?.id]);

  const importer = async (f: File | undefined) => {
    const x = morceau.peek();
    if (!f || !x) return;
    setEnCours(true);
    try {
      const r = await importerSoundfont(f, x);
      modifier((y) => ajouterSoundfont(y, r.soundfont));
      setChoisie(r.soundfont);
    } catch (e) {
      toastErreur(e, T.soundfonts.erreur);
    } finally {
      setEnCours(false);
      if (fichier.current) fichier.current.value = '';
    }
  };
  const ajouter = () => {
    if (!sf || !preset) return;
    let ok = false;
    modifier((y) => {
      const r = ajouterPiste(ajouterSoundfont(y, sf), preset.instrument, preset.nom);
      ok = !!r;
      return r ? r.m : y;
    });
    afficherToast(ok ? T.soundfonts.pisteAjoutee(preset.nom) : T.soundfonts.tropDePistes);
  };
  const retirer = async () => {
    const x = morceau.peek();
    if (!sf || !x) return;
    const res = await supprimerSoundfont(x, sf.id);
    if (modifier(() => res)) afficherToast(T.soundfonts.retiree);
    setChoisie(null);
  };

  const banques = [...new Set((presets ?? []).map((p) => p.banque))];
  const dansBanque = (presets ?? []).filter((p) => p.banque === banque);

  return (
    <div class="sa-onglet">
      <div class="message message-alerte" role="note" data-testid="sf2-droits">
        <IconeAlerte taille={20} />
        <span>{T.soundfonts.droits}</span>
      </div>
      <input ref={fichier} type="file" accept=".sf2" hidden onChange={(e) => void importer(e.currentTarget.files?.[0])} data-testid="sf2-fichier" />
      <button type="button" class="btn btn-contour" disabled={enCours} onClick={() => fichier.current?.click()} data-testid="sf2-importer">
        <IconePlus taille={20} /> {enCours ? T.soundfonts.importEnCours : T.soundfonts.importer}
      </button>
      <span class="aide">{T.soundfonts.formats}</span>

      {liste.length > 0 && (
        <div class="reglage">
          <span class="reglage-label">{T.soundfonts.tesSoundfonts}</span>
          <div class="puces puces-colonne" role="radiogroup" aria-label={T.soundfonts.tesSoundfonts}>
            {liste.map((s) => (
              <button key={s.id} type="button" role="radio" class="puce puce-large" aria-checked={s.id === sf?.id} onClick={() => setChoisie(s)} data-testid={`sf2-${s.id}`}>
                <span class="puce-nom texte-coupe">{s.nom}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sf && presets === null && <p class="aide">{T.soundfonts.chargement}</p>}
      {sf && presets && presets.length > 0 && (
        <>
          <label class="reglage">
            <span class="reglage-label">{T.soundfonts.banque}</span>
            <select class="champ-texte" value={banque} onChange={(e) => (setBanque(Number(e.currentTarget.value)), setPreset(null))} data-testid="sf2-banque">
              {banques.map((b) => (
                <option key={b} value={b}>
                  {T.soundfonts.banqueNom(b)}
                </option>
              ))}
            </select>
          </label>
          <div class="reglage">
            <span class="reglage-label">{T.soundfonts.presets}</span>
            <div class="puces puces-colonne sa-presets" role="radiogroup" aria-label={T.soundfonts.presets} data-testid="sf2-presets">
              {dansBanque.map((p) => (
                <button key={p.instrument} type="button" role="radio" class="puce puce-large" aria-checked={preset?.instrument === p.instrument} onClick={() => setPreset(p)} data-testid={`sf2-preset-${p.preset}`}>
                  <span class="puce-nom texte-coupe">{p.nom}</span>
                  <span class="puce-detail chiffres">{p.preset}</span>
                </button>
              ))}
              {!dansBanque.length && <p class="aide">{T.soundfonts.aucunPreset}</p>}
            </div>
          </div>
          <div class="sa-actions">
            <button type="button" class="btn btn-principal btn-petit" disabled={!preset} onClick={ajouter} data-testid="sf2-ajouter-piste">
              {T.soundfonts.ajouterPiste}
            </button>
            <button type="button" class="btn btn-discret btn-petit" onClick={() => void retirer()} data-testid="sf2-retirer">
              {T.soundfonts.retirer}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
