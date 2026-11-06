// Éditeur de notes, analyse prête : géométrie (zoom, défilement), gestes, grille, et barre du bas (note choisie :
// nom, justesse, vibrato ; Couper, Fusionner, Écouter la note). Les notes affichées sont celles de Prise.autotune.notes,
// sinon les notes détectées visées sur la gamme ; la 1re modification les écrit (avec des réglages de départ).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AnalyseNotes } from '../../../moteur/api';
import { hauteurTonique } from '../../../morceau/theorie';
import type { Morceau, NoteAutotune, Prise } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import {
  classesGamme,
  couperNote,
  deplacerNote,
  ecrireNotes,
  fusionnerNotes,
  gammeResolue,
  midiCible,
  notesDepuisDetection,
  reglerJustesse,
  reglerVibrato,
} from '../../edition/autotune';
import { afficherToast, modifier } from '../../etat';
import { nomMidi } from '../pianoroll/ClavierPiano';
import { ecouterPassage, jouerReference, planifierRendu, reglagesDepart, rendus, signaler } from './autotune-etat';
import { creerGestesNotes, type ApercuNotes } from './gestes-notes';
import { ClavierNotes, GrilleNotes } from './GrilleNotes';
import { borne, cheminsCourbe, debutT, hautLigne, libre, lignesVues, medianes, NB_LIGNES, secondesVues, vueDepart, type GeoNotes } from './vue-notes';

const E = () => T.autotuneAvance.editeur;

export function EditeurPret({ m, prise, analyse }: { m: Morceau; prise: Prise; analyse: AnalyseNotes }) {
  const a = prise.autotune;
  const gamme = a?.gamme ?? 'morceau';
  const cleGamme = JSON.stringify(gamme) + m.tonalite.tonique + m.tonalite.mode;
  const classes = useMemo(() => classesGamme(gamme, m.tonalite), [cleGamme]);
  const t = gammeResolue(gamme, m.tonalite);
  const tonique = t ? hauteurTonique(t.tonique) : null;
  const notes: readonly NoteAutotune[] = useMemo(
    () => (a?.notes?.length ? a.notes : notesDepuisDetection(analyse.notes, classes)),
    [a?.notes, analyse, classes],
  );
  const meds = useMemo(() => medianes(analyse.courbe, notes), [analyse, notes]);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [apercu, setApercu] = useState<ApercuNotes>(null);
  const [taille, setTaille] = useState({ l: 320, h: 480 });
  const grille = useRef<HTMLDivElement>(null);
  const sel = choisie !== null && choisie < notes.length ? choisie : null;

  useEffect(() => planifierRendu(m, prise), [JSON.stringify(a), m.tonalite.tonique, m.tonalite.mode, prise.id]);
  useLayoutEffect(() => {
    const el = grille.current;
    if (!el) return;
    const mesurer = () => setTaille({ l: el.clientWidth || 320, h: el.clientHeight || 480 });
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // À l'ouverture : 3 s dès la 1re note, centrées sur les notes.
  useLayoutEffect(() => {
    const v = vueDepart(notes, prise.debutCoupe, prise.finCoupe, Math.round(lignesVues.peek()));
    debutT.value = v.debut;
    secondesVues.value = v.secondes;
    hautLigne.value = v.haut;
    setChoisie(null);
  }, [prise.id]);

  const geo: GeoNotes = {
    pxS: taille.l / secondesVues.value,
    h: taille.h / lignesVues.value,
    t0: debutT.value,
    haut: borne(hautLigne.value, 0, NB_LIGNES - lignesVues.value),
    secondes: secondesVues.value,
    nLignes: lignesVues.value,
    largeur: taille.l,
    hauteur: taille.h,
    tMin: prise.debutCoupe,
    tMax: prise.finCoupe,
  };
  const affichees = apercu ? notes.map((n, i) => (i === apercu.i ? apercuDe(n, apercu) : n)) : notes;
  const chemins = cheminsCourbe(analyse.courbe, affichees, meds, geo);

  /** Écrit les notes (avec des réglages de départ si la prise n'a pas encore d'autotune). */
  function ecrire(nouvelles: readonly NoteAutotune[]): boolean {
    if (nouvelles === courant.current.notes) return false;
    const x = morceau0();
    try {
      const base = x.prises.find((p) => p.id === prise.id)?.autotune ? undefined : reglagesDepart(x);
      return modifier((y) => ecrireNotes(y, prise.id, nouvelles, base));
    } catch (e) {
      signaler(e);
      return false;
    }
  }
  const courant = useRef({ geo, notes, classes, m, prise });
  courant.current = { geo, notes, classes, m, prise };
  const morceau0 = () => courant.current.m;

  const gestes = useMemo(() => {
    let dernierMidi = -1;
    return creerGestesNotes({
      geo: () => courant.current.geo,
      notes: () => courant.current.notes,
      cible: (midi, d) => midiCible(midi, d, libre.peek() ? null : courant.current.classes),
      choisir(i) {
        setChoisie(i);
        const n = i === null ? undefined : courant.current.notes[i];
        if (n) ecouterPassage(courant.current.prise, n.debut, n.fin);
      },
      deplacer(i, midi) {
        if (ecrire(deplacerNote(courant.current.notes, i, midi))) setChoisie(i);
      },
      justesse: (i, c) => ecrire(reglerJustesse(courant.current.notes, i, c)),
      vibrato: (i, v) => ecrire(reglerVibrato(courant.current.notes, i, v)),
      apercu(x) {
        setApercu(x);
        if (x?.type === 'deplacer' && x.midi !== dernierMidi) jouerReference(x.midi);
        dernierMidi = x?.type === 'deplacer' ? x.midi : -1;
      },
      vue(v) {
        if (v.secondes !== undefined) secondesVues.value = v.secondes;
        if (v.nLignes !== undefined) lignesVues.value = v.nLignes;
        if (v.t0 !== undefined) debutT.value = v.t0;
        if (v.haut !== undefined) hautLigne.value = v.haut;
      },
    });
  }, [prise.id]);

  useEffect(() => {
    const el = grille.current;
    if (!el) return;
    el.addEventListener('wheel', gestes.onWheel, { passive: false });
    return () => el.removeEventListener('wheel', gestes.onWheel);
  }, [gestes]);

  const rendu = rendus.value.get(prise.id);
  const enCalcul = useMemo(() => new Set(rendu?.etat === 'calcul' ? rendu.notes : []), [rendu]);
  const n = sel !== null ? affichees[sel] : undefined;

  function couper() {
    if (sel === null) return;
    const r = couperNote(notes, sel);
    if (r === notes) return afficherToast(E().tropCourte);
    if (ecrire(r)) afficherToast(E().coupee);
  }
  function fusionner() {
    if (sel === null) return;
    const r = fusionnerNotes(notes, sel);
    if (r === notes) return afficherToast(E().derniere);
    if (ecrire(r)) afficherToast(E().fusionnee);
  }

  if (!notes.length) return <p class="vide" data-testid="an-vide">{E().vide}</p>;
  return (
    <div class="pr-complet an-complet" data-testid="an-editeur">
      <p class="an-info" aria-live="polite" data-testid="an-info">
        {n ? E().infoNote(nomMidi(n.midi), E().cents(n.cents), E().pourcent(n.vibrato)) : E().aide}
      </p>
      <div class="pr-milieu">
        <ClavierNotes geo={geo} classes={classes} tonique={tonique} entendre={jouerReference} />
        <GrilleNotes
          geo={geo}
          notes={notes}
          choisie={sel}
          apercu={apercu}
          classes={classes}
          tonique={tonique}
          chemins={chemins}
          enCalcul={enCalcul}
          gestes={gestes}
          grille={grille}
          entendre={jouerReference}
          clavierPoignee={(type, i, s) => {
            const x = notes[i];
            if (!x) return;
            ecrire(type === 'justesse' ? reglerJustesse(notes, i, x.cents + 5 * s) : reglerVibrato(notes, i, x.vibrato + 0.1 * s));
          }}
        />
      </div>
      <div class="an-outils" role="toolbar" aria-label={E().titre}>
        <button type="button" class="btn btn-contour btn-petit" disabled={sel === null} onClick={couper} data-testid="an-couper">
          {E().couper}
        </button>
        <button type="button" class="btn btn-contour btn-petit" disabled={sel === null} onClick={fusionner} data-testid="an-fusionner">
          {E().fusionner}
        </button>
        <button
          type="button"
          class="btn btn-contour btn-petit"
          disabled={!n}
          onClick={() => n && ecouterPassage(prise, n.debut, n.fin)}
          data-testid="an-ecouter-note"
        >
          {E().note}
        </button>
      </div>
    </div>
  );
}

function apercuDe(n: NoteAutotune, a: NonNullable<ApercuNotes>): NoteAutotune {
  if (a.type === 'deplacer') return { ...n, midi: a.midi };
  if (a.type === 'justesse') return { ...n, cents: a.cents };
  return { ...n, vibrato: a.vibrato };
}
