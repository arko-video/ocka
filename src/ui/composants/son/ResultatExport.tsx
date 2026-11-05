// Progression et résultat d'un export (étape Exporter) : barre + Annuler, puis mesures (pour un titre),
// Télécharger, Partager ; pour Arko, le bouton « Envoyer vers Arko » (le partage demande un geste).

import { T } from '../../../textes-fr';
import { afficherToast } from '../../etat';
import { annulerExport, envoyerArko, etatExport, messageArko } from '../../exportation';
import { mmss, nombre } from '../../format';
import { IconeAlerte, IconeCoche, IconePartager, IconeTelecharger } from '../Icones';

async function partager(fichier: File, titre: string) {
  try {
    if (navigator.canShare?.({ files: [fichier] })) await navigator.share({ files: [fichier], title: titre });
    else afficherToast(T.exporter.partageImpossible);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') afficherToast(T.exporter.partageImpossible);
  }
}

export function ResultatExport({ titre }: { titre: string }) {
  const e = etatExport.value;
  if (e.phase === 'erreur')
    return (
      <div class="message message-erreur" role="alert" data-testid="erreur-export">
        <IconeAlerte taille={20} />
        <span>{e.message}</span>
      </div>
    );

  if (e.phase === 'encours') {
    const p = Math.round(e.p * 100);
    return (
      <div class="carte progression" data-testid="export-progression" data-type={e.type}>
        <span aria-live="polite">{e.type === 'wav' ? T.exporter.enCours(p) : `${T.exporter.enCoursDe[e.type]} ${p} %`}</span>
        <div class="barre-progression" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
          <span style={{ transform: `scaleX(${e.p})` }} />
        </div>
        <button type="button" class="btn" onClick={annulerExport} data-testid="annuler-export">
          {T.annuler}
        </button>
      </div>
    );
  }

  if (e.phase !== 'fini') return null;
  const arko = e.type === 'arko';
  return (
    <div class="carte resultat" data-testid="export-resultat" data-type={e.type}>
      <h2 class="carte-titre resultat-titre">
        <IconeCoche taille={20} /> {T.exporter.finiDe[e.type]}
      </h2>
      {e.mesures && (
        <dl class="mesures">
          <div>
            <dt>{T.exporter.sonie}</dt>
            <dd class="chiffres" data-testid="export-lufs">
              {nombre(e.mesures.lufs)} LUFS
            </dd>
          </div>
          <div>
            <dt>{T.exporter.crete}</dt>
            <dd class="chiffres" data-testid="export-crete">
              {nombre(e.mesures.creteVraie)} dBTP
            </dd>
          </div>
          <div>
            <dt>{T.exporter.duree}</dt>
            <dd class="chiffres">{mmss(e.mesures.duree)}</dd>
          </div>
        </dl>
      )}
      {arko && (
        <button type="button" class="btn btn-principal" onClick={() => void envoyerArko()} data-testid="envoyer-arko-maintenant">
          <IconePartager /> {T.exporter.envoyer}
        </button>
      )}
      {arko && messageArko.value && (
        <p class="message message-info" role="status" data-testid="message-arko">
          {messageArko.value}
        </p>
      )}
      <a class={arko ? 'btn' : 'btn btn-principal'} href={e.url} download={e.nom} data-testid="telecharger">
        <IconeTelecharger /> {T.exporter.telecharger}
      </a>
      {!arko && (
        <button type="button" class="btn" onClick={() => void partager(e.fichier, titre)} data-testid="partager">
          <IconePartager /> {T.exporter.partager}
        </button>
      )}
    </div>
  );
}
