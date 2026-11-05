// Étape 5 — Exporter : titre, artiste, gros bouton « Sortir sur Spotify » (assistant de sortie, A1), puis en plus
// petit : WAV, M4A pour écouter, pistes séparées, envoi vers Arko, export du projet. Progression, Annuler, résultat.

import { T } from '../../textes-fr';
import { reglerInfos } from '../edition/reglages';
import { modifier, morceau } from '../etat';
import { bits16, etatExport, lancerExport, sortirSpotify, type TypeExport } from '../exportation';
import { ResultatExport } from '../composants/son/ResultatExport';

const AUTRES: { type: Exclude<TypeExport, 'wav'>; testid: string }[] = [
  { type: 'm4a', testid: 'export-m4a' },
  { type: 'pistes', testid: 'export-pistes' },
  { type: 'arko', testid: 'envoyer-arko' },
  { type: 'projet', testid: 'exporter-projet' },
];

const TEXTES: Record<Exclude<TypeExport, 'wav'>, { nom: string; detail: string }> = {
  m4a: { nom: T.exporter.m4a, detail: T.exporter.m4aDetail },
  pistes: { nom: T.exporter.pistes, detail: T.exporter.pistesDetail },
  arko: { nom: T.exporter.arko, detail: T.exporter.arkoDetail },
  projet: { nom: T.exporter.projet, detail: T.exporter.projetDetail },
};

export function Exporter() {
  const m = morceau.value;
  if (!m) return null;
  const occupe = etatExport.value.phase === 'encours';

  return (
    <div class="etape-exporter">
      <section class="carte">
        <label class="champ">
          <span class="champ-label">{T.exporter.titre}</span>
          <input
            class="champ-texte"
            value={m.titre}
            maxLength={80}
            onInput={(ev) => modifier((x) => reglerInfos(x, { titre: ev.currentTarget.value }), 'titre')}
            data-testid="export-titre"
          />
        </label>
        <label class="champ">
          <span class="champ-label">{T.exporter.artiste}</span>
          <input
            class="champ-texte"
            value={m.artiste ?? ''}
            maxLength={80}
            placeholder={T.exporter.artisteExemple}
            autoComplete="nickname"
            onInput={(ev) => modifier((x) => reglerInfos(x, { artiste: ev.currentTarget.value }), 'artiste')}
            data-testid="export-artiste"
          />
        </label>
      </section>

      <button type="button" class="btn btn-principal btn-export" disabled={occupe} onClick={() => void sortirSpotify()} data-testid="sortir-spotify">
        <span>{T.exporter.spotify}</span>
        <span class="btn-export-detail">{T.exporter.spotifyDetail}</span>
      </button>

      <ResultatExport titre={m.titre} />

      <section class="autres-exports" aria-labelledby="titre-autres-exports">
        <h2 id="titre-autres-exports" class="sous-titre">
          {T.exporter.autres}
        </h2>
        <div class="liste-exports">
          <div class="export-wav">
            <button type="button" class="btn btn-ligne btn-export-ligne" disabled={occupe} onClick={() => void lancerExport('wav')} data-testid="exporter-wav">
              <span class="btn-export-nom">{T.exporter.wavCourt}</span>
              <span class="btn-export-detail">{bits16.value ? T.exporter.wavDetail.replace('24', '16') : T.exporter.wavDetail}</span>
            </button>
            <label class="case">
              <input type="checkbox" checked={bits16.value} onChange={(ev) => (bits16.value = ev.currentTarget.checked)} data-testid="option-16-bits" />
              <span>{T.exporter.bits16}</span>
            </label>
          </div>
          {AUTRES.map(({ type, testid }) => (
            <button
              key={type}
              type="button"
              class="btn btn-ligne btn-export-ligne"
              disabled={occupe}
              onClick={() => void lancerExport(type)}
              data-testid={testid}
            >
              <span class="btn-export-nom">{TEXTES[type].nom}</span>
              <span class="btn-export-detail">{TEXTES[type].detail}</span>
            </button>
          ))}
        </div>
      </section>

      <p class="astuce">{T.exporter.astuce}</p>
    </div>
  );
}
