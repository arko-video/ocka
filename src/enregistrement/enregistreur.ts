// Enregistreur de voix : le lecteur joue une mesure de décompte (avec métronome), puis la capture
// écrit le micro en flux dans OPFS. À l'arrêt, la prise est recalée grâce aux horloges du contexte :
// heure de l'ancre côté lecteur (ctx.currentTime) face au 1er échantillon capturé (currentFrame).
import { ErreurOcka } from '../moteur/api';
import type { Enregistreur, Lecteur } from '../moteur/api';
import type { Morceau, Prise } from '../morceau/types';
import { positionAncre } from '../morceau/temps';
import { calculerAlignement, dureeMesure } from './alignement';
import { bluetoothDetecte, CONSEIL_BLUETOOTH, majAppareil } from './appareil';
import { Capture } from './capture';
import { attendre, contexteAudio, nouvelId } from './contexte';
import { ecrireTexte, nomDescription, ouvrirEcriture, type EcrivainFlux } from './fichiers-opfs';
import { ajustementLatence, latenceMemorisee } from './latence';
import { fermerMicro, ouvrirMicro, type Micro } from './micro';

export interface OptionsEnregistreur {
  /** Pour les tests : remplace le micro par un nœud audio du contexte (boucle interne, latence connue). */
  entree?: (ctx: AudioContext) => AudioNode;
}

interface Session {
  lecteur: Lecteur;
  morceau: Morceau;
  ancre: Prise['ancre'];
  fichier: string;
  ecrivain: EcrivainFlux;
  capture: Capture;
  premierFrame: Promise<number>;
  heureAncre: Promise<number>;
  minuteries: ReturnType<typeof setTimeout>[];
  verrou: { release(): Promise<void> } | null;
}

/**
 * Demande le micro (geste de l'utilisateur requis). Lève ErreurOcka « micro_refuse » | « micro_absent ».
 * Le micro est coupé (voyant éteint) à la fin de chaque prise et par detruire() ; demarrer() le rouvre.
 */
export async function creerEnregistreur(options: OptionsEnregistreur = {}): Promise<Enregistreur> {
  const e = new EnregistreurOcka(options);
  if (options.entree) await majAppareil(null).catch(() => false);
  // Micro et capture prêts tout de suite dans le contexte commun : le vumètre marche avant d'enregistrer.
  await e.ouvrir(contexteAudio());
  return e;
}

class EnregistreurOcka implements Enregistreur {
  avertissements: string[] = [];
  private micro: Micro | null = null;
  private capture: Capture | null = null;
  private session: Session | null = null;

  constructor(private options: OptionsEnregistreur) {}

  get niveau(): number {
    return this.capture?.niveau ?? 0;
  }
  get enCours(): boolean {
    return this.session !== null;
  }

  /** Rouvre le micro s'il a été coupé, puis prépare la capture dans ce contexte. */
  async ouvrir(ctx: AudioContext): Promise<Capture> {
    if (!this.options.entree && this.micro?.piste.readyState !== 'live') {
      this.couperMicro();
      this.micro = await ouvrirMicro();
      await majAppareil(this.micro.piste).catch(() => false);
      this.avertissements = [...this.micro.avertissements];
      if (await bluetoothDetecte(ctx, this.micro.piste).catch(() => false)) this.avertissements.push(CONSEIL_BLUETOOTH);
    }
    return this.captureDans(ctx);
  }

  /** Coupe le micro : ses pistes sont arrêtées et le voyant du téléphone s'éteint. */
  private couperMicro(): void {
    this.capture?.fermer();
    this.capture = null;
    fermerMicro(this.micro);
    this.micro = null;
  }

  /** La capture doit vivre dans le contexte du lecteur (même horloge) : on la refait si besoin. */
  private async captureDans(ctx: AudioContext): Promise<Capture> {
    if (this.capture?.ctx === ctx) return this.capture;
    this.capture?.fermer();
    const entree = this.options.entree ? this.options.entree(ctx) : ctx.createMediaStreamSource(this.micro!.flux);
    this.capture = await Capture.creer(ctx, entree);
    return this.capture;
  }

  async demarrer(lecteur: Lecteur, morceau: Morceau, ancre: Prise['ancre']): Promise<void> {
    if (this.session) throw new ErreurOcka('Un enregistrement est déjà en cours.', 'deja_en_cours');
    const ta = positionAncre(morceau, ancre);
    if (ta === null) throw new ErreurOcka("Cette section n'existe plus dans le morceau.", 'ancre_introuvable');
    const ctx = lecteur.ctx ?? contexteAudio();
    await ctx.resume();
    const capture = await this.ouvrir(ctx);
    const fichier = `prise-${nouvelId()}.f32`;
    let ecrivain: EcrivainFlux;
    try {
      ecrivain = await ouvrirEcriture(fichier);
    } catch {
      throw new ErreurOcka("Impossible d'écrire la prise sur le téléphone (stockage indisponible ou plein).", 'stockage');
    }
    capture.surMorceau = (m) => ecrivain.ecrire(m.pcm);

    // 1. Décompte d'une mesure : le lecteur part une mesure avant l'ancre, métronome allumé.
    const mesure = dureeMesure(morceau.tempo);
    const minuteries: Session['minuteries'] = [];
    lecteur.boucler(null);
    lecteur.metronome(true);
    let lancement: Promise<void>;
    if (ta - mesure >= -1e-6) {
      lecteur.aller(Math.max(0, ta - mesure));
      lecteur.lire();
      lancement = Promise.resolve();
    } else {
      // L'ancre est au tout début du morceau : on joue le décompte nous-mêmes, puis le lecteur part de l'ancre.
      lecteur.aller(ta);
      const finDecompte = jouerDecompte(ctx, morceau.tempo);
      lancement = new Promise((ok) => {
        const quand = (finDecompte - ctx.currentTime) * 1000 - 20;
        minuteries.push(
          setTimeout(() => {
            if (this.session) lecteur.lire();
            ok();
          }, quand),
        );
      });
    }
    // 2. Puis la capture (elle garde aussi le décompte ; il sera retiré par debutCoupe).
    const premierFrame = capture.demarrer();
    const heureAncre = lancement.then(() => heureDeLAncre(lecteur, ctx, ta));
    // Le métronome ne sert qu'au décompte : il se tait au début de l'ancre.
    const session: Session = { lecteur, morceau, ancre, fichier, ecrivain, capture, premierFrame, heureAncre, minuteries, verrou: null };
    this.session = session;
    void heureAncre.then((h) => {
      minuteries.push(
        setTimeout(() => {
          if (this.session === session) lecteur.metronome(false);
        }, (h - ctx.currentTime) * 1000),
      );
    });
    void demanderVerrouEcran().then((v) => {
      if (this.session === session) session.verrou = v;
      else void v?.release();
    });
  }

  async arreter(): Promise<Prise> {
    const s = this.session;
    if (!s) throw new ErreurOcka("Aucun enregistrement n'est en cours.", 'pas_en_cours');
    const echantillons = await s.capture.arreter();
    const premierFrame = await s.premierFrame;
    const heureAncre = await s.heureAncre;
    const ctx = s.capture.ctx;
    const latence = latenceMemorisee() ?? estimerLatence(ctx, this.micro) + ajustementLatence();
    this.finirSession(s);
    // Fin de la prise : on coupe le micro tout de suite (le voyant s'éteint), même en cas d'erreur ensuite.
    this.couperMicro();
    try {
      await s.ecrivain.fermer();
    } catch {
      await s.ecrivain.annuler();
      throw new ErreurOcka("La prise n'a pas pu être enregistrée (stockage du téléphone plein ?).", 'stockage');
    }
    const frequence = ctx.sampleRate;
    const al = calculerAlignement({ heureAncre, premierFrame, frequence, echantillons, latence });
    if (al.duree - al.debutCoupe < 0.05) {
      await s.ecrivain.annuler();
      throw new ErreurOcka("Arrêté pendant le décompte : il n'y a rien à garder.", 'prise_vide');
    }
    const description = { format: 'ocka.prise/1', encodage: 'f32le', canaux: 1, frequence, echantillons, premierFrame, heureAncre };
    await ecrireTexte(nomDescription(s.fichier), JSON.stringify(description)).catch(() => {});
    return {
      id: s.fichier.replace(/^prise-|\.f32$/g, ''),
      ancre: { ...s.ancre },
      tempo: s.morceau.tempo,
      fichier: s.fichier,
      frequence,
      ...al,
      gain: 1,
      choisie: true,
    };
  }

  detruire(): void {
    const s = this.session;
    if (s) {
      void s.capture.arreter();
      this.finirSession(s);
      void s.ecrivain.annuler();
    }
    this.couperMicro();
  }

  private finirSession(s: Session): void {
    this.session = null;
    s.capture.surMorceau = null;
    s.minuteries.forEach((m) => clearTimeout(m));
    s.lecteur.pause();
    s.lecteur.metronome(false);
    void s.verrou?.release().catch(() => {});
  }
}

/**
 * Heure du contexte où le lecteur joue le début de l'ancre. Avec `heureDe` (recommandé), c'est exact.
 * Sans, on la déduit de `temps` pendant la lecture (exact si le lecteur calcule temps depuis ctx.currentTime).
 */
async function heureDeLAncre(lecteur: Lecteur, ctx: AudioContext, ta: number): Promise<number> {
  const h = lecteur.heureDe?.(ta);
  if (h !== undefined && Number.isFinite(h)) return h;
  await attendre(150);
  return ctx.currentTime - lecteur.temps + ta;
}

/** Joue 4 clics (le 1er plus aigu) et renvoie l'heure du contexte où la mesure de décompte se termine. */
function jouerDecompte(ctx: AudioContext, tempo: number): number {
  const noire = 60 / tempo;
  const debut = ctx.currentTime + 0.1;
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = i === 0 ? 1600 : 1000;
    const t = debut + i * noire;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }
  return debut + 4 * noire;
}

/** Estimation de la latence quand on n'a jamais calibré : sortie + base + entrée annoncées par le navigateur. */
export function estimerLatence(ctx: AudioContext, micro: Micro | null): number {
  const entree = (micro?.piste.getSettings() as { latency?: number } | undefined)?.latency ?? 0.01;
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + entree;
}

/** Garde l'écran allumé pendant l'enregistrement (si le navigateur le permet). */
async function demanderVerrouEcran(): Promise<{ release(): Promise<void> } | null> {
  try {
    return (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    return null;
  }
}
