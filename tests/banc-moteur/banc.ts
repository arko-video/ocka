// Banc du moteur son : exporte des WAV dans Chrome (téléchargés), pour les vérifier avec ffmpeg.
import { exporterWav, profil } from '../../src/moteur/export';
import { nouveauMorceau } from '../../src/morceau/styles';
import type { Morceau, MotifBatterie, Style } from '../../src/morceau/types';

const journal = document.getElementById('journal')!;
const ecrire = (s: string) => (journal.textContent += s + '\n');

async function exporter(m: Morceau, nom: string, bits: 16 | 24 = 24) {
  const debut = performance.now();
  const r = await exporterWav(m, { bits });
  const ms = Math.round(performance.now() - debut);
  ecrire(JSON.stringify({ nom, lufs: r.lufs, creteVraie: r.creteVraie, duree: r.duree, ms, profil }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.fichier);
  a.download = nom;
  a.click();
  (window as unknown as { dernier: unknown }).dernier = { nom, lufs: r.lufs, creteVraie: r.creteVraie, duree: r.duree, ms, taille: r.fichier.size, profil: { ...profil } };
}

/** Morceau trap par défaut, avec une frappe de kick ajoutée (pas 5 du couplet). */
function trap(): Morceau {
  const m = nouveauMorceau('trap', 'Banc trap');
  (m.motifs['bat-couplet'] as MotifBatterie).pistes.kick![5] = 0.75;
  return m;
}

/** Démo : chaque son du kit, puis des notes de 808 et des accords, pour les 3 styles à la suite. */
function demo(style: Style): Morceau {
  const m = nouveauMorceau(style, `Demo ${style}`);
  m.tempo = 120;
  m.swing = 0;
  m.fondu = 0;
  m.motifs.demo = {
    type: 'batterie',
    pas: 32,
    pistes: {
      kick: [1, ...new Array(31).fill(0)],
      snare: [0, 0, 0, 0, 1, ...new Array(27).fill(0)],
      clap: [...new Array(8).fill(0), 1, ...new Array(23).fill(0)],
      charley: [...new Array(12).fill(0), 1, 0, 1, 0, ...new Array(16).fill(0)],
      charleyOuvert: [...new Array(16).fill(0), 1, ...new Array(15).fill(0)],
      rim: [...new Array(20).fill(0), 1, ...new Array(11).fill(0)],
      perc: [...new Array(24).fill(0), 1, ...new Array(7).fill(0)],
    },
  };
  m.sections = [
    { id: 'kit', nom: 'Kit', mesures: 2, motifs: { batterie: 'demo' } },
    { id: 'notes', nom: 'Notes', mesures: 4, motifs: { basse: 'basse-couplet', accords: 'accords' } },
  ];
  m.ordre = ['kit', 'notes'];
  return m;
}

document.getElementById('trap')!.onclick = () => exporter(trap(), 'banc-trap.wav');
document.getElementById('long')!.onclick = () => {
  const m = trap();
  m.ordre = ['intro', ...new Array(6).fill(['couplet', 'refrain']).flat(), 'outro'];
  return exporter(m, 'banc-trap-3min.wav');
};
document.getElementById('kit')!.onclick = async () => {
  for (const s of ['trap', 'drill', 'lofi'] as Style[]) await exporter(demo(s), `demo-${s}.wav`);
};
(window as unknown as { bancPret: boolean }).bancPret = true;

/** Diagnostic : intro + couplet, une piste en solo. */
async function solos() {
  for (const id of ['batterie', 'basse', 'accords'] as const) {
    const m = trap();
    m.ordre = ['intro', 'couplet'];
    m.fondu = 0;
    for (const p of m.pistes) p.solo = p.id === id;
    await exporter(m, `solo-${id}.wav`);
  }
}
const bouton = document.createElement('button');
bouton.id = 'solos';
bouton.textContent = 'Pistes en solo';
bouton.onclick = solos;
document.body.append(bouton);

/** Écoute : le lecteur charge le morceau (worklet compris), joue 2 s, et le temps avance. */
document.getElementById('ecoute')!.onclick = async () => {
  const { creerLecteur } = await import('../../src/moteur/lecteur');
  const lecteur = creerLecteur();
  const resultat: Record<string, unknown> = {};
  try {
    await lecteur.charger(trap());
    lecteur.lire();
    const pas = new Set<number>();
    const debut = performance.now();
    while (performance.now() - debut < 2000) {
      pas.add(lecteur.pasCourant);
      await new Promise((r) => setTimeout(r, 20));
    }
    Object.assign(resultat, { ok: true, temps: lecteur.temps, pasVus: pas.size, etat: lecteur.ctx?.state, heure0: lecteur.heureDe?.(0) });
    lecteur.pause();
  } catch (e) {
    Object.assign(resultat, { ok: false, erreur: String(e) });
  }
  lecteur.detruire();
  ecrire(JSON.stringify(resultat));
  (window as unknown as { resultatEcoute: unknown }).resultatEcoute = resultat;
};

/** Niveau « fort » (−11 LUFS, ≤ −2 dBTP) en 16 bits avec dither. */
const fort = document.createElement('button');
fort.id = 'fort16';
fort.textContent = 'Trap fort, 16 bits';
fort.onclick = () => {
  const m = trap();
  m.master.niveau = 'fort';
  return exporter(m, 'banc-trap-fort-16.wav', 16);
};
document.body.append(fort);

/** Annulation : on annule pendant le rendu, puis un nouvel export doit marcher normalement. */
const annuler = document.createElement('button');
annuler.id = 'annuler';
annuler.textContent = 'Annuler un export';
annuler.onclick = async () => {
  const controle = new AbortController();
  const debut = performance.now();
  let code = '';
  setTimeout(() => controle.abort(), 300);
  try {
    await exporterWav(trap(), { signal: controle.signal });
  } catch (e) {
    code = (e as { code?: string }).code ?? String(e);
  }
  const msAnnulation = Math.round(performance.now() - debut);
  const r = await exporterWav(trap(), {});
  (window as unknown as { annulation: unknown }).annulation = { code, msAnnulation, ensuite: r.lufs, taille: r.fichier.size };
};
document.body.append(annuler);
