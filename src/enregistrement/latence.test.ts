import { beforeEach, describe, expect, it } from 'vitest';
import { ressembleBluetooth } from './appareil';
import { ajustementLatence, choisirAppareil, latenceMemorisee, memoriserMesure, reglerLatence, signatureAppareil, utiliserRangement } from './latence';

let donnees: Map<string, string>;
beforeEach(() => {
  donnees = new Map();
  utiliserRangement({ getItem: (c) => donnees.get(c) ?? null, setItem: (c, v) => void donnees.set(c, v) });
});

describe('mémoire de latence par appareil', () => {
  it('null tant que rien n’est mesuré', () => {
    expect(latenceMemorisee()).toBeNull();
  });

  it('mesure + réglage manuel, borné à ±100 ms', () => {
    choisirAppareil(signatureAppareil('Micro', 'Haut-parleur'));
    memoriserMesure(0.08);
    reglerLatence(0.5);
    expect(ajustementLatence()).toBe(0.1);
    expect(latenceMemorisee()).toBeCloseTo(0.18, 9);
    reglerLatence(-0.02);
    expect(latenceMemorisee()).toBeCloseTo(0.06, 9);
  });

  it('chaque appareil garde sa propre mesure', () => {
    choisirAppareil(signatureAppareil('Micro', 'Haut-parleur'));
    memoriserMesure(0.12);
    expect(choisirAppareil(signatureAppareil('Micro du casque', 'Casque filaire'))).toBe(false);
    expect(latenceMemorisee()).toBeNull();
    memoriserMesure(0.03);
    expect(choisirAppareil(signatureAppareil('Micro', 'Haut-parleur'))).toBe(true);
    expect(latenceMemorisee()).toBeCloseTo(0.12, 9);
  });

  it('une mémoire abîmée ne casse rien', () => {
    donnees.set('ocka.latence/1', '{pas du json');
    expect(latenceMemorisee()).toBeNull();
    memoriserMesure(0.05);
    expect(latenceMemorisee()).toBeCloseTo(0.05, 9);
  });

  it('stockage bloqué (navigation privée) : pas d’erreur', () => {
    utiliserRangement({
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
    });
    expect(() => reglerLatence(0.01)).not.toThrow();
    expect(latenceMemorisee()).toBeNull();
  });
});

describe('détection du Bluetooth par le nom', () => {
  it.each(['Casque Bluetooth', 'Hands-Free AG Audio', 'AirPods Pro de Romain', 'BT headset'])('« %s » → oui', (nom) => {
    expect(ressembleBluetooth(nom)).toBe(true);
  });
  it.each(['Micro par défaut', 'Casque filaire', 'Speakerphone'])('« %s » → non', (nom) => {
    expect(ressembleBluetooth(nom)).toBe(false);
  });
});
