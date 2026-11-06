// Tests de l'aide : chaque écran a sa page, aucun lien vide ou inconnu, aucun renvoi cassé, premier lancement.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Ecran } from '../etat';
import { ADRESSE_CODE, LIENS_AIDE, SITES_PERMIS } from './liens';
import { IDS_PAGES, ORDRE_GUIDE, PAGES, estPage, pageDeLEcran } from './pages';
import { bienvenueDejaVue, CLE_BIENVENUE, marquerBienvenueVue, oublierVisite, type StockageSimple } from './premier-lancement';
import type { Bloc, IdPage } from './types';

/** Tous les écrans de l'appli : le `satisfies` refuse la compilation si un écran est ajouté sans être listé ici. */
const TOUS_LES_ECRANS = {
  accueil: true, sorties: true, styles: true, beat: true, structure: true, voix: true, son: true, exporter: true,
  'sortie-infos': true, 'sortie-pochette': true, 'sortie-verifier': true,
} satisfies Record<Ecran, true>;
const ECRANS = Object.keys(TOUS_LES_ECRANS) as Ecran[];

const textesDe = (b: Bloc): string[] => {
  switch (b.t) {
    case 'liste':
      return b.items;
    case 'question':
      return [b.q, b.r];
    default:
      return [b.texte];
  }
};

describe('aide de chaque écran', () => {
  it('chaque écran ouvre une page qui existe, et jamais le guide entier', () => {
    for (const e of ECRANS) {
      const p = pageDeLEcran(e);
      expect(estPage(p), e).toBe(true);
      expect(p, e).not.toBe('guide');
    }
  });
  it('Beat donne la batterie ou la mélodie selon la bascule', () => {
    expect(pageDeLEcran('beat', 'batterie')).toBe('beat');
    expect(pageDeLEcran('beat', 'instruments')).toBe('melodie');
  });
  it('les 5 étapes, les 3 écrans de l’assistant et l’accueil ont leur aide à eux', () => {
    expect(['structure', 'voix', 'son', 'exporter'].map((e) => pageDeLEcran(e))).toEqual(['structure', 'voix', 'son', 'exporter']);
    for (const e of ['sortie-infos', 'sortie-pochette', 'sortie-verifier']) expect(pageDeLEcran(e)).toBe('assistant');
    expect(pageDeLEcran('accueil')).toBe('accueil');
    expect(pageDeLEcran('sorties')).toBe('accueil');
  });
  it('un écran inconnu ouvre le guide entier', () => {
    expect(pageDeLEcran('ecran-futur')).toBe('guide');
  });
});

describe('pages du guide', () => {
  it('chaque page a un titre, une phrase et des blocs non vides', () => {
    for (const id of IDS_PAGES) {
      const p = PAGES[id];
      expect(p.titre.trim(), id).not.toBe('');
      expect(p.resume.trim(), id).not.toBe('');
      expect(p.blocs.length, id).toBeGreaterThan(0);
      for (const b of p.blocs) for (const t of textesDe(b)) expect(t.trim(), `${id} : bloc ${b.t}`).not.toBe('');
    }
  });
  it('les pages demandées existent toutes', () => {
    const attendues: IdPage[] = ['premier-morceau', 'voix-propre', 'spotify', 'droits', 'finir-pc', 'installer', 'faq', 'a-propos'];
    for (const id of attendues) expect(ORDRE_GUIDE).toContain(id);
  });
  it('aucun lien vide, et seulement des pages d’aide officielles en https', () => {
    for (const [cle, url] of Object.entries(LIENS_AIDE)) {
      const u = new URL(url);
      expect(u.protocol, cle).toBe('https:');
      expect(SITES_PERMIS, cle).toContain(u.hostname);
    }
    for (const id of IDS_PAGES) {
      for (const b of PAGES[id].blocs) {
        if (b.t !== 'lien') continue;
        expect(b.texte.trim(), id).not.toBe('');
        expect(LIENS_AIDE[b.lien], `${id} → ${b.lien}`).toMatch(/^https:\/\/\S+$/);
      }
    }
    expect(ADRESSE_CODE).toBe('https://github.com/arko-video/ocka');
  });
  it('chaque renvoi mène à une page qui existe, et le guide mène à toutes les pages', () => {
    for (const id of IDS_PAGES) {
      for (const b of PAGES[id].blocs) if (b.t === 'voir') expect(estPage(b.page), `${id} → ${b.page}`).toBe(true);
    }
    const depuisGuide = new Set(PAGES.guide.blocs.flatMap((b) => (b.t === 'voir' ? [b.page] : [])));
    for (const id of IDS_PAGES) if (id !== 'guide') expect(depuisGuide.has(id), id).toBe(true);
  });
  it('« Sortir sur Spotify » donne les points clés vérifiés', () => {
    const texte = PAGES.spotify.blocs.flatMap(textesDe).join(' ');
    for (const mot of ['RouteNote Free', 'FLAC', 'DistroKid', 'WAV', 'âge minimum', '6 semaines', '7 jours', 'nom d’artiste', 'IA', 'Musixmatch']) {
      expect(texte, mot).toContain(mot);
    }
    const liens = PAGES.spotify.blocs.flatMap((b) => (b.t === 'lien' ? [b.lien] : []));
    for (const l of ['routenoteAge', 'distrokidConditions', 'spotifyPitch', 'musixmatchParoles'] as const) expect(liens).toContain(l);
  });
});

describe('premier lancement', () => {
  const faux = (): StockageSimple & { donnees: Map<string, string> } => {
    const donnees = new Map<string, string>();
    return { donnees, getItem: (c) => donnees.get(c) ?? null, setItem: (c, v) => void donnees.set(c, v) };
  };
  beforeEach(() => oublierVisite());

  it('les conseils s’affichent une fois, puis plus jamais', () => {
    const s = faux();
    expect(bienvenueDejaVue(s)).toBe(false);
    marquerBienvenueVue(s);
    expect(s.donnees.get(CLE_BIENVENUE)).toBe('1');
    oublierVisite(); // nouvelle visite : c'est le stockage qui s'en souvient
    expect(bienvenueDejaVue(s)).toBe(true);
  });
  it('stockage bloqué : pas d’erreur, et on s’en souvient pendant la visite', () => {
    const casse: StockageSimple = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(bienvenueDejaVue(casse)).toBe(false);
    expect(() => marquerBienvenueVue(casse)).not.toThrow();
    expect(bienvenueDejaVue(casse)).toBe(true);
    expect(bienvenueDejaVue(null)).toBe(true);
  });
});
