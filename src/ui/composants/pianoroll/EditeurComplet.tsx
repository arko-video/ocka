// Piano roll « Complet » : règle, clavier de 32 px + grille (gestes), couloir de vélocité, barre d'outils.
// Chaque geste passe par une fonction pure de edition/notes.ts puis par modifier() (une étape d'Annuler).
// La note posée ou déplacée se fait entendre (entendreNote de la piste).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { motifNotesDe, sectionDe } from '../../../morceau/acces';
import type { Morceau, PisteInstrument } from '../../../morceau/types';
import { notesAccordSur } from '../../edition/accords';
import {
  ajouterNote,
  allongerNote,
  deplacerNotes,
  poserNotesAccord,
  supprimerNotes,
} from '../../edition/notes';
import { longueurNeuve, partageDe } from '../../edition/notes-motif';
import { modeAvance, modifier } from '../../etat';
import { fantomesVisibles } from '../outils-notes/reglages-outils';
import { fantomesSurLongueur } from './fantomes';
import { entendreNote } from '../../lecture';
import { BarreOutils } from './BarreOutils';
import { ClavierPiano, Regle } from './ClavierPiano';
import { CouloirVelocite } from './CouloirVelocite';
import { creerGestes, type Apercu, type Geometrie } from './gestes';
import { GrillePiano } from './GrillePiano';
import {
  borne,
  choisies,
  cleNote,
  couloirOuvert,
  debutPas,
  derniereDuree,
  gammeSeule,
  hautCentre,
  hautLigne,
  ligneDe,
  lignesClavier,
  lignesVues,
  mesuresVues,
  quantif,
  typeAccord,
  ZOOM,
} from './vue';

const VEL_NEUVE = 0.8;
const grille24 = (x: number) => Math.round(x * 24) / 24;

export function EditeurComplet({
  m,
  piste,
  idSection,
}: {
  m: Morceau;
  piste: PisteInstrument;
  idSection: string;
}) {
  const section = sectionDe(m, idSection);
  const motif = motifNotesDe(m, idSection, piste.id);
  const longueur = motif?.pas ?? longueurNeuve(section?.mesures ?? 2);
  const notes = motif?.notes ?? [];
  const gamme = gammeSeule.value;
  const lignes = useMemo(
    () => lignesClavier(m.tonalite, gamme),
    [m.tonalite.tonique, m.tonalite.mode, gamme],
  );
  const grille = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ l: 320, h: 480 });
  const [apercu, setApercu] = useState<Apercu>(null);

  useLayoutEffect(() => {
    const el = grille.current;
    if (!el) return;
    const mesurer = () => setTaille({ l: el.clientWidth || 320, h: el.clientHeight || 480 });
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, [couloirOuvert.value]);

  // À l'ouverture (piste, section, gamme) : vue centrée sur les notes, au début du motif.
  useLayoutEffect(() => {
    hautLigne.value = hautCentre(notes, lignes, Math.round(lignesVues.peek()), m.tonalite);
    debutPas.value = 0;
    choisies.value = new Set();
  }, [piste.id, idSection, gamme]);

  const mesures = mesuresVues.value;
  const nLignes = lignesVues.value;
  const w = taille.l / (mesures * 16);
  const h = taille.h / nLignes;
  const geo: Geometrie = {
    w,
    h,
    mesures,
    nLignes,
    lignes,
    longueur,
    largeur: taille.l,
    hauteur: taille.h,
    q: quantif.value,
    debut: borne(debutPas.value, 0, Math.max(0, longueur - mesures * 16)),
    haut: borne(hautLigne.value, 0, Math.max(0, lignes.length - nLignes)),
  };
  const indices = notes.flatMap((n, i) => (choisies.value.has(cleNote(n)) ? [i] : []));

  // Valeurs à jour pour les gestes (créés une seule fois).
  const courant = useRef({ geo, notes, indices, m });
  courant.current = { geo, notes, indices, m };

  const gestes = useMemo(
    () =>
      creerGestes({
        geo: () => courant.current.geo,
        notes: () => courant.current.notes,
        choisies: () => courant.current.indices,
        ligneDe: (midi) => ligneDe(midi, courant.current.geo.lignes),
        apercu: setApercu,
        poser(pas, midi) {
          const type = typeAccord.peek();
          const midis = type ? notesAccordSur(midi, type, courant.current.m.tonalite) : [midi];
          const duree = Math.min(derniereDuree.peek(), courant.current.geo.longueur - pas);
          const ok = type
            ? modifier((x) => poserNotesAccord(x, piste.id, idSection, pas, duree, midis, VEL_NEUVE))
            : modifier((x) => ajouterNote(x, piste.id, idSection, { pas, duree, midi, vel: VEL_NEUVE }));
          if (!ok) return;
          choisies.value = new Set(midis.map((x) => cleNote({ pas: grille24(pas), midi: x })));
          for (const x of midis) entendreNote(piste.id, x, { vel: VEL_NEUVE });
        },
        toucherNote(i) {
          const n = courant.current.notes[i];
          if (!n) return;
          const cle = cleNote(n);
          if (choisies.peek().has(cle)) {
            // Toucher une note déjà choisie l'efface.
            if (modifier((x) => supprimerNotes(x, piste.id, idSection, [i]))) {
              const reste = new Set(choisies.peek());
              reste.delete(cle);
              choisies.value = reste;
            }
            return;
          }
          choisies.value = new Set([cle]);
          derniereDuree.value = n.duree;
          entendreNote(piste.id, n.midi, { vel: n.vel });
        },
        deplacer(liste, dPas, dMidi) {
          const avant = courant.current.notes;
          if (!modifier((x) => deplacerNotes(x, piste.id, idSection, liste, dPas, dMidi))) return;
          choisies.value = new Set(
            liste.map((k) => cleNote({ pas: grille24(avant[k]!.pas + dPas), midi: avant[k]!.midi + dMidi })),
          );
          if (dMidi !== 0 && avant[liste[0]!])
            entendreNote(piste.id, avant[liste[0]!]!.midi + dMidi, { vel: avant[liste[0]!]!.vel });
        },
        allonger(i, duree) {
          if (modifier((x) => allongerNote(x, piste.id, idSection, i, duree))) derniereDuree.value = duree;
        },
        vue(v) {
          const g = courant.current.geo;
          if (v.mesures !== undefined) mesuresVues.value = borne(v.mesures, ZOOM.mesuresMin, ZOOM.mesuresMax);
          if (v.nLignes !== undefined) lignesVues.value = borne(v.nLignes, ZOOM.lignesMin, ZOOM.lignesMax);
          const mes = mesuresVues.peek();
          const nl = lignesVues.peek();
          if (v.debut !== undefined) debutPas.value = borne(v.debut, 0, Math.max(0, g.longueur - mes * 16));
          if (v.haut !== undefined) hautLigne.value = borne(v.haut, 0, Math.max(0, g.lignes.length - nl));
        },
      }),
    [piste.id, idSection],
  );

  useEffect(() => {
    const el = grille.current;
    if (!el) return;
    el.addEventListener('wheel', gestes.onWheel, { passive: false });
    return () => el.removeEventListener('wheel', gestes.onWheel);
  }, [gestes]);

  return (
    <div class="pr-complet" data-testid="pr-complet">
      <Regle geo={geo} />
      <div class="pr-milieu">
        <ClavierPiano geo={geo} tonalite={m.tonalite} piste={piste.id} />
        <GrillePiano
          geo={geo}
          notes={notes}
          choisies={indices}
          apercu={apercu}
          tonalite={m.tonalite}
          idSection={idSection}
          gestes={gestes}
          grille={grille}
          fantomes={modeAvance.value && fantomesVisibles.value ? fantomesSurLongueur(m, piste.id, idSection, longueur) : undefined}
        />
      </div>
      {couloirOuvert.value && (
        <div class="pr-couloir-ligne">
          <span class="pr-regle-coin" />
          <CouloirVelocite
            geo={geo}
            notes={notes}
            choisies={indices}
            piste={piste.id}
            idSection={idSection}
          />
        </div>
      )}
      <BarreOutils
        piste={piste.id}
        idSection={idSection}
        motif={motif}
        notes={notes}
        indices={indices}
        partage={partageDe(m, piste.id, idSection)}
      />
    </div>
  );
}
