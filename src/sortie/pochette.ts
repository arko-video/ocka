// Pochette : recadrage d'une image importée, 4 modèles fabriqués, stockage (base ocka-pochettes). Propriétaire : A1.
// Règles (décisions §3) : refus sous 1425 px de côté ; on n'agrandit jamais ; 3000 × 3000 au plus ; carré CENTRÉ sur
// `centre` ; JPEG sRGB qualité 0,92. Clé « pochette-<base36 de l'heure>-<hasard> » : l'heure sert au ramasse-miettes.

import { del, get, keys, set } from 'idb-keyval';
import { ErreurOcka } from '../moteur/erreur';
import { REGLE_CLE_POCHETTE } from '../morceau/types';
import { enErreurOcka, magasin } from '../stockage/dossiers';
import { tailleJpegBlob } from './jpeg';
import { dessinerModele, POLICE_ARTISTE, POLICE_TITRE } from './modeles-pochette';

export interface PochettePrete {
  /** Clé dans ocka-pochettes (REGLE_CLE_POCHETTE). */
  cle: string;
  /** Côté du carré en pixels (1425 à 3000). */
  cote: number;
}

export const COTE_MIN_POCHETTE = 1425;
export const COTE_POCHETTE = 3000;
const QUALITE = 0.92;
/** Une pochette que plus aucune sortie n'utilise est effacée après ce délai (l'assistant a pu la créer à l'instant). */
const AGE_MIN_MENAGE = 3600_000;

const ERREUR_STOCKAGE = { message: 'La pochette n’a pas pu être rangée.', code: 'stockage' };

/** Clé neuve : « pochette-<heure en base 36>-<hasard> ». */
export function nouvelleCle(maintenant = Date.now()): string {
  const hasard = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `pochette-${maintenant.toString(36)}-${hasard}`;
}

/** Heure de création lue dans la clé (null si illisible). */
export function heureDeCle(cle: string): number | null {
  const m = /^pochette-([0-9a-z]{6,10})-/.exec(cle);
  if (!m) return null;
  const t = parseInt(m[1]!, 36);
  return Number.isFinite(t) ? t : null;
}

/** Fenêtre carrée (source) de côté `cote` centrée au mieux sur `centre`, sans sortir de l'image. */
export function cadrage(largeur: number, hauteur: number, centre: { x: number; y: number }) {
  const cote = Math.min(largeur, hauteur);
  const fx = Number.isFinite(centre?.x) ? Math.min(1, Math.max(0, centre.x)) : 0.5;
  const fy = Number.isFinite(centre?.y) ? Math.min(1, Math.max(0, centre.y)) : 0.5;
  const sx = Math.round(Math.min(largeur - cote, Math.max(0, fx * largeur - cote / 2)));
  const sy = Math.round(Math.min(hauteur - cote, Math.max(0, fy * hauteur - cote / 2)));
  return { sx, sy, cote };
}

function toile(cote: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cote;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb', alpha: false });
  if (!ctx) throw new ErreurOcka('Ce téléphone ne peut pas dessiner la pochette.', 'image_illisible');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function enJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, ko) =>
    canvas.toBlob(
      (b) => {
        canvas.width = canvas.height = 0; // libère la mémoire tout de suite (36 Mo en 3000 × 3000)
        if (b) ok(b);
        else ko(new ErreurOcka('La pochette n’a pas pu être enregistrée en JPEG.', 'image_illisible'));
      },
      'image/jpeg',
      QUALITE,
    ),
  );
}

async function ranger(jpeg: Blob, cote: number): Promise<PochettePrete> {
  const cle = nouvelleCle();
  try {
    await set(cle, jpeg, magasin('pochettes'));
  } catch (e) {
    throw enErreurOcka(e, ERREUR_STOCKAGE);
  }
  return { cle, cote };
}

export async function preparerPochette(image: Blob, centre: { x: number; y: number }): Promise<PochettePrete> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image, { colorSpaceConversion: 'default', imageOrientation: 'from-image' });
  } catch {
    throw new ErreurOcka('Cette image ne peut pas être lue. Essaie une photo JPEG ou PNG.', 'image_illisible');
  }
  try {
    const { width: l, height: h } = bitmap;
    if (Math.min(l, h) < COTE_MIN_POCHETTE) {
      throw new ErreurOcka(
        `Ton image fait ${l} × ${h} px : il faut au moins ${COTE_MIN_POCHETTE} px de côté (idéal : 3000 × 3000). Prends une image plus grande.`,
        'pochette_trop_petite',
      );
    }
    const { sx, sy, cote } = cadrage(l, h, centre);
    const sortie = Math.min(COTE_POCHETTE, cote);
    const { canvas, ctx } = toile(sortie);
    ctx.drawImage(bitmap, sx, sy, cote, cote, 0, 0, sortie, sortie);
    bitmap.close();
    return await ranger(await enJpeg(canvas), sortie);
  } finally {
    bitmap.close();
  }
}

/** Attend les polices du titre et de l'artiste (sinon le canvas dessinerait avec une police de secours). */
async function attendrePolices(texte: string) {
  try {
    await Promise.all([
      document.fonts.load(`700 100px ${POLICE_TITRE}`, texte),
      document.fonts.load(`600 100px ${POLICE_ARTISTE}`, texte),
    ]);
  } catch {
    // Police indisponible : on dessine quand même avec la police de secours.
  }
}

export async function fabriquerPochette(modele: 0 | 1 | 2 | 3, titre: string, artiste: string, graine: number): Promise<PochettePrete> {
  const m = ([0, 1, 2, 3] as const).includes(modele) ? modele : 0;
  await attendrePolices(`${titre} ${artiste}`);
  const { canvas, ctx } = toile(COTE_POCHETTE);
  dessinerModele(ctx, COTE_POCHETTE, m, titre.trim(), artiste.trim(), Number.isFinite(graine) ? graine : 1);
  return ranger(await enJpeg(canvas), COTE_POCHETTE);
}

export async function lirePochette(cle: string): Promise<Blob | null> {
  if (typeof cle !== 'string' || !REGLE_CLE_POCHETTE.test(cle)) return null;
  try {
    const b = await get<unknown>(cle, magasin('pochettes'));
    return b instanceof Blob ? b : null;
  } catch (e) {
    throw enErreurOcka(e, { message: 'La pochette n’a pas pu être lue.', code: 'stockage' });
  }
}

/** Interne (A2, import d'un .ocka-sortie) : range un JPEG déjà prêt, sans le recompresser. */
export async function stockerPochette(jpeg: Blob): Promise<PochettePrete> {
  const t = await tailleJpegBlob(jpeg).catch(() => null);
  if (!t) throw new ErreurOcka('La pochette n’est pas un JPEG lisible.', 'image_illisible');
  const cote = Math.min(t.largeur, t.hauteur);
  return ranger(jpeg.type === 'image/jpeg' ? jpeg : new Blob([jpeg], { type: 'image/jpeg' }), cote);
}

/**
 * Ramasse-miettes (appelé sous le verrou « ocka-menage » par stockage/sorties.ts) : efface les pochettes
 * qu'aucune sortie n'utilise et créées il y a plus d'une heure. Renvoie le nombre de pochettes effacées.
 */
export async function nettoyerPochettes(utilisees: ReadonlySet<string>, maintenant = Date.now()): Promise<number> {
  const store = magasin('pochettes');
  let n = 0;
  for (const k of await keys(store)) {
    if (typeof k !== 'string' || utilisees.has(k)) continue;
    const heure = heureDeCle(k);
    if (heure !== null && maintenant - heure < AGE_MIN_MENAGE) continue;
    await del(k, store);
    n++;
  }
  return n;
}
