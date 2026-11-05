import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { morceauPret, sortiePrete } from './aides-test';
import { echapper, ficheAvecFormat, ficheSortie, nomGenre } from './fiche';
import { tailleJpeg } from './jpeg';
import { nomSur, nomTitre, nomZip, titreComplet } from './noms';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 4, 12));
});
afterEach(() => vi.useRealTimers());

const HOSTILES = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "' onmouseover='x", '&lt;déjà&gt;'];

describe('ficheSortie', () => {
  it('tout ce qu’il faut recopier : sortie, titres (feat.), crédits, IA, guide RouteNote en FLAC', () => {
    const m = morceauPret('Nuit blanche', { featuring: 'Léa', isrc: 'FRAB12400001', explicite: true });
    const { html, txt } = ficheSortie(sortiePrete(['m1']), new Map([['m1', m]]), {});
    for (const t of [html, txt]) {
      expect(t).toContain('Nuit blanche (feat. Léa)');
      expect(t).toContain('01 - Nuit blanche (feat. Léa).flac');
      expect(t).toContain('Single (1 titre, 1:08)');
      expect(t).toContain('01/03/2027');
      expect(t).toContain('Hip-Hop/Rap');
      expect(t).toContain('Romain Dupont : Auteur (paroles) — Lyricist');
      expect(t).toContain('FRAB12400001');
      expect(t).toContain('Oui (Explicit)');
      expect(t).toContain('Paroles : Non');
      expect(t).toContain('paroles/01 - Nuit blanche (feat. Léa).txt');
      expect(t).toContain('https://support.routenote.com/kb-article/how-old-do-you-have-to-be-to-use-routenote/');
      expect(t).toContain('7 jours avant');
      expect(t).not.toMatch(/amuse/i);
    }
    expect(txt).toContain('Label : Kalo');
    expect(html).toContain('<a href="https://artists.spotify.com/" rel="noopener noreferrer">');
  });

  it('genre : le nom français seulement s’il apporte quelque chose', () => {
    expect(nomGenre('Hip-Hop/Rap')).toBe('Hip-Hop/Rap');
    expect(nomGenre('Electronic')).toBe('Electronic (Électro)');
    expect(nomGenre('')).toBe('à choisir');
  });

  it('DistroKid : WAV, conditions et pages d’aide de DistroKid', () => {
    const { txt } = ficheSortie(sortiePrete(['m1'], { distributeur: 'distrokid' }), new Map([['m1', morceauPret()]]), {});
    expect(txt).toContain('01 - Nuit blanche.wav');
    expect(txt).toContain('https://distrokid.com/terms/');
    expect(ficheAvecFormat(sortiePrete(['m1']), new Map([['m1', morceauPret()]]), {}, 'wav').txt).toContain('01 - Nuit blanche.wav');
  });

  it('HTML : chaque donnée de l’utilisateur ressort échappée, aucune balise ni attribut injecté', () => {
    for (const h of HOSTILES) {
      const m = morceauPret(h, { featuring: h, credits: [{ nom: h, role: 'auteur' }] });
      const s = sortiePrete(['m1'], { titre: h, artiste: h, genre: h, label: h, lienProfil: `https://x.y/${h}` });
      const { html } = ficheSortie(s, new Map([['m1', m]]), { vraiNom: h });
      expect(html).toContain(echapper(h));
      expect(html).not.toContain('<script');
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toMatch(/<[^>]*\son\w+\s*=/i); // aucun attribut « on… » dans une vraie balise
    }
    expect(echapper('<a href="x">\'&')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });

  it('HTML autonome : pas de script, aucune ressource externe, CSP stricte', () => {
    const { html } = ficheSortie(sortiePrete(['m1']), new Map([['m1', morceauPret()]]), {});
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<script|<link|<img|<iframe|src=|@import|url\(/i);
  });
});

describe('noms de fichiers', () => {
  it('sûrs pour Windows : ni <>:"/\\|?*, ni espace ou point final, noms réservés évités, accents gardés', () => {
    expect(nomSur('Ça va? <oui> "non" a|b*c:d')).toBe('Ça va oui non abcd');
    expect(nomSur('Nuit / Jour \\ Soir')).toBe('Nuit - Jour - Soir');
    expect(nomSur('Fin...  ')).toBe('Fin');
    expect(nomSur('CON')).toBe('CON_');
    expect(nomSur('nul.txt')).toBe('nul.txt_');
    expect(nomSur('   ', 60, 'Sans titre')).toBe('Sans titre');
    expect(nomSur('a\u0000b\u001fc')).toBe('abc');
    expect(Array.from(nomSur('é'.repeat(100))).length).toBe(60);
    expect(nomSur('😀'.repeat(70)).length).toBe(120); // 60 emojis entiers (paires gardées)
  });
  it('« 01 - Titre.flac » et « Artiste - Titre (sortie).zip »', () => {
    expect(nomTitre(0, titreComplet('Nuit', 'Léa'), 'flac')).toBe('01 - Nuit (feat. Léa).flac');
    expect(nomTitre(11, 'A/B', 'wav')).toBe('12 - A-B.wav');
    expect(nomZip('Kalo', 'Nuit blanche')).toBe('Kalo - Nuit blanche (sortie).zip');
    expect(nomZip('', '')).toBe('Artiste - Sans titre (sortie).zip');
  });
});

describe('tailleJpeg', () => {
  it('lit la taille dans le marqueur SOF, après un segment APP0', () => {
    const o = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, 0xc0, 0, 11, 8, 0x0b, 0xb8, 0x0b, 0xb8, 3, 0, 0, 0]);
    expect(tailleJpeg(o)).toEqual({ largeur: 3000, hauteur: 3000 });
    expect(tailleJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(tailleJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
  });
});
