// Les 4 modèles de « Fabriquer une pochette », dessinés à n'importe quelle taille (la pochette : 3000 × 3000).
// Seuls textes : le titre et le nom d'artiste, écrits tels quels (ils doivent correspondre aux infos de la sortie).
// Couleurs et formes tirées d'une graine : même graine = même pochette. Propriétaire : A1.

export const POLICE_TITRE = '"Space Grotesk", "Inter", sans-serif';
export const POLICE_ARTISTE = '"Inter", sans-serif';

/** Générateur pseudo-aléatoire (mulberry32) : 0 ≤ x < 1. */
export function hasard(graine: number): () => number {
  let a = Math.floor(graine) >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;

/** Coupe un texte en lignes qui tiennent dans `largeur` (mot par mot). */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const res: string[] = [];
  let ligne = '';
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ligne && ctx.measureText(essai).width > largeur) {
      res.push(ligne);
      ligne = mot;
    } else ligne = essai;
  }
  if (ligne) res.push(ligne);
  return res;
}

interface Texte {
  texte: string;
  x: number;
  y: number;
  largeur: number;
  taille: number;
  lignesMax: number;
  poids: number;
  police: string;
  couleur: string;
  align: CanvasTextAlign;
  /** 'haut' : y = haut du bloc ; 'bas' : y = bas du bloc. */
  ancre: 'haut' | 'bas';
  espacement?: number;
}

/** Écrit un texte en le réduisant jusqu'à ce qu'il tienne (lignesMax lignes dans `largeur`). Renvoie sa hauteur. */
function ecrire(ctx: CanvasRenderingContext2D, t: Texte): number {
  if (!t.texte.trim()) return 0;
  let taille = t.taille;
  let ls: string[] = [];
  const reglerPolice = (px: number) => {
    ctx.font = `${t.poids} ${px}px ${t.police}`;
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${(t.espacement ?? 0) * px}px`;
  };
  for (;;) {
    reglerPolice(taille);
    ls = lignes(ctx, t.texte, t.largeur);
    const tient = ls.length <= t.lignesMax && ls.every((l) => ctx.measureText(l).width <= t.largeur);
    if (tient || taille < t.taille * 0.2) break;
    taille *= 0.92;
  }
  const interligne = taille * 1.02;
  const hauteur = interligne * ls.length;
  ctx.fillStyle = t.couleur;
  ctx.textAlign = t.align;
  ctx.textBaseline = 'alphabetic';
  const premier = t.ancre === 'haut' ? t.y + taille * 0.82 : t.y - hauteur + taille * 0.82;
  ls.forEach((l, i) => ctx.fillText(l, t.x, premier + i * interligne));
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
  return hauteur;
}

/** Grain : une tuile de bruit répétée par-dessus, en « incrustation douce ». */
function grain(ctx: CanvasRenderingContext2D, S: number, rnd: () => number, force: number) {
  const tuile = document.createElement('canvas');
  tuile.width = tuile.height = 256;
  const t = tuile.getContext('2d')!;
  const img = t.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  t.putImageData(img, 0, 0);
  const motif = ctx.createPattern(tuile, 'repeat')!;
  motif.setTransform(new DOMMatrix().scale(Math.max(1, S / 1500)));
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = force;
  ctx.fillStyle = motif;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

/** Tache de lumière douce (dégradé radial vers la transparence). */
function tache(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, couleur: (a: number) => string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, couleur(0.9));
  g.addColorStop(0.5, couleur(0.4));
  g.addColorStop(1, couleur(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** Dessine le modèle `modele` (0 à 3) dans un carré de côté S. */
export function dessinerModele(ctx: CanvasRenderingContext2D, S: number, modele: 0 | 1 | 2 | 3, titre: string, artiste: string, graine: number) {
  const rnd = hasard(graine * 4 + modele);
  const h = rnd() * 360;
  const h2 = h + 35 + rnd() * 50;
  const h3 = h + 160 + rnd() * 40;
  const m = S * 0.075;
  const ombre = (flou: number) => {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = flou;
  };
  ctx.save();
  if (modele === 0) {
    // Aurore : dégradé profond et taches de lumière.
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, hsl(h, 55, 10));
    g.addColorStop(1, hsl(h2, 60, 22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    tache(ctx, S * (0.2 + rnd() * 0.6), S * (0.15 + rnd() * 0.3), S * 0.7, (a) => hsl(h, 90, 58, a));
    tache(ctx, S * (0.5 + rnd() * 0.4), S * (0.4 + rnd() * 0.3), S * 0.6, (a) => hsl(h2, 90, 55, a));
    tache(ctx, S * rnd() * 0.5, S * (0.5 + rnd() * 0.3), S * 0.45, (a) => hsl(h3, 80, 60, a * 0.7));
    grain(ctx, S, rnd, 0.35);
    ombre(S * 0.02);
    const hT = ecrire(ctx, { texte: titre, x: m, y: S - m, largeur: S - 2 * m, taille: S * 0.13, lignesMax: 3, poids: 700, police: POLICE_TITRE, couleur: '#fff', align: 'left', ancre: 'bas' });
    ecrire(ctx, { texte: artiste, x: m, y: S - m - hT - S * 0.025, largeur: S - 2 * m, taille: S * 0.045, lignesMax: 1, poids: 600, police: POLICE_ARTISTE, couleur: 'rgba(255,255,255,0.85)', align: 'left', ancre: 'bas', espacement: 0.08 });
  } else if (modele === 1) {
    // Formes : fond clair, grand disque, anneaux et barres.
    ctx.fillStyle = hsl(h, 45, 90);
    ctx.fillRect(0, 0, S, S);
    const cx = S * (0.55 + rnd() * 0.1);
    const cy = S * (0.36 + rnd() * 0.06);
    const r = S * (0.2 + rnd() * 0.05);
    ctx.fillStyle = hsl(h, 85, 55);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Deux anneaux ouverts (au-dessus de la zone du titre).
    ctx.strokeStyle = hsl(h3, 70, 35);
    ctx.lineWidth = S * 0.008;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + i * S * 0.045, -Math.PI * (0.1 + rnd() * 0.3), Math.PI * (0.6 + rnd() * 0.5));
      ctx.stroke();
    }
    // Une grille de points (jamais des barres : elles feraient penser à un code-barres, interdit).
    ctx.fillStyle = hsl(h2, 80, 50);
    const px = m + S * 0.012;
    const py = S * (0.3 + rnd() * 0.08);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.arc(px + i * S * 0.045, py + j * S * 0.045, S * 0.011, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    grain(ctx, S, rnd, 0.18);
    const fonce = hsl(h, 50, 12);
    ecrire(ctx, { texte: artiste, x: m, y: m, largeur: S - 2 * m, taille: S * 0.045, lignesMax: 1, poids: 600, police: POLICE_ARTISTE, couleur: fonce, align: 'left', ancre: 'haut', espacement: 0.08 });
    ecrire(ctx, { texte: titre, x: m, y: S - m, largeur: S - 2 * m, taille: S * 0.12, lignesMax: 3, poids: 700, police: POLICE_TITRE, couleur: fonce, align: 'left', ancre: 'bas' });
  } else if (modele === 2) {
    // Onde : nuit, barres d'une onde sonore en dégradé, beaucoup de grain.
    ctx.fillStyle = hsl(h, 35, 7);
    ctx.fillRect(0, 0, S, S);
    tache(ctx, S / 2, S / 2, S * 0.6, (a) => hsl(h, 80, 35, a * 0.5));
    const n = 36;
    const pas = (S - 2 * m) / n;
    const g = ctx.createLinearGradient(m, 0, S - m, 0);
    g.addColorStop(0, hsl(h, 90, 60));
    g.addColorStop(1, hsl(h2, 90, 60));
    ctx.fillStyle = g;
    let v = 0.5;
    for (let i = 0; i < n; i++) {
      v = Math.min(1, Math.max(0.08, v + (rnd() - 0.5) * 0.5));
      const enveloppe = Math.sin((Math.PI * (i + 0.5)) / n);
      const haut = S * 0.32 * v * (0.35 + 0.65 * enveloppe);
      ctx.beginPath();
      ctx.roundRect(m + i * pas + pas * 0.2, S * 0.5 - haut / 2, pas * 0.6, haut, pas * 0.3);
      ctx.fill();
    }
    grain(ctx, S, rnd, 0.45);
    ombre(S * 0.015);
    ecrire(ctx, { texte: titre, x: m, y: m, largeur: S - 2 * m, taille: S * 0.11, lignesMax: 2, poids: 700, police: POLICE_TITRE, couleur: '#fff', align: 'left', ancre: 'haut' });
    ecrire(ctx, { texte: artiste, x: m, y: S - m, largeur: S - 2 * m, taille: S * 0.045, lignesMax: 1, poids: 600, police: POLICE_ARTISTE, couleur: hsl(h2, 90, 80), align: 'left', ancre: 'bas', espacement: 0.12 });
  } else {
    // Soleil couchant : ciel en dégradé, soleil rayé, lignes d'horizon.
    const ciel = ctx.createLinearGradient(0, 0, 0, S);
    ciel.addColorStop(0, hsl(h2, 60, 14));
    ciel.addColorStop(0.62, hsl(h, 70, 40));
    ciel.addColorStop(0.62, hsl(h3, 40, 10));
    ciel.addColorStop(1, hsl(h3, 45, 6));
    ctx.fillStyle = ciel;
    ctx.fillRect(0, 0, S, S);
    const cx = S / 2;
    const cy = S * 0.62;
    const r = S * 0.26;
    const soleil = ctx.createLinearGradient(0, cy - r, 0, cy);
    soleil.addColorStop(0, hsl(h + 40, 95, 65));
    soleil.addColorStop(1, hsl(h, 90, 55));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.clip();
    ctx.fillStyle = soleil;
    ctx.fillRect(cx - r, cy - r, 2 * r, r);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) {
      const y = cy - r * 0.45 + i * r * 0.09;
      ctx.fillRect(cx - r, y, 2 * r, r * (0.012 + i * 0.008));
    }
    ctx.restore();
    ctx.strokeStyle = hsl(h, 90, 60, 0.55);
    ctx.lineWidth = S * 0.004;
    for (let i = 1; i <= 7; i++) {
      const y = cy + ((S - cy) * (i * i)) / 49;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y);
      ctx.stroke();
    }
    grain(ctx, S, rnd, 0.3);
    ombre(S * 0.015);
    const hT = ecrire(ctx, { texte: titre, x: cx, y: m * 1.2, largeur: S - 2 * m, taille: S * 0.11, lignesMax: 2, poids: 700, police: POLICE_TITRE, couleur: '#fff', align: 'center', ancre: 'haut' });
    ecrire(ctx, { texte: artiste, x: cx, y: m * 1.2 + hT + S * 0.03, largeur: S - 2 * m, taille: S * 0.042, lignesMax: 1, poids: 600, police: POLICE_ARTISTE, couleur: 'rgba(255,255,255,0.85)', align: 'center', ancre: 'haut', espacement: 0.12 });
  }
  ctx.restore();
}
