// Formulaires des outils malins (un par onglet) : réglages au pouce (puces de 44 px, curseurs), puis « Appliquer ».
// Chaque outil passe par api-outils-notes.ts (fonction pure) et `appliquer` (une étape d'Annuler).

import type { ComponentChildren } from 'preact';
import type { Morceau, PisteInstrument } from '../../../morceau/types';
import { T } from '../../../textes-fr';
import {
  arpeger,
  GAMMES_RIFF,
  gratter,
  humaniser,
  quantifier,
  reglerGlisse,
  reglerSwingPiste,
  riffMachine,
  SENS_ARPEGE,
  STYLES_RIFF,
} from '../../edition/api-outils-notes';
import { modifier } from '../../etat';
import { QUANTIFS, quantif } from '../pianoroll/vue';
import { appliquer, arpege, derniereIdee, force, humain, nouvelleGraine, riff, strum, type Onglet } from './reglages-outils';

const TO = T.outilsNotes;

export interface Cible {
  m: Morceau;
  piste: PisteInstrument;
  section: string;
  /** Notes choisies dans le piano roll ; null = toutes. */
  indices: number[] | null;
  nNotes: number;
}

function Puces<V extends string | number>({ nom, valeurs, valeur, libelle, choisir, testid }: { nom: string; valeurs: readonly V[]; valeur: V; libelle: (v: V) => string; choisir: (v: V) => void; testid: string }) {
  return (
    <div class="on-reglage">
      <span class="curseur-label">{nom}</span>
      <div class="puces puces-defile" role="radiogroup" aria-label={nom}>
        {valeurs.map((v, i) => (
          <button key={String(v)} type="button" role="radio" class="puce" aria-checked={v === valeur} onClick={() => choisir(v)} data-testid={`${testid}-${typeof v === 'number' ? i : v}`}>
            {libelle(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Curseur({ nom, valeur, min, max, pas, texte, changer, testid }: { nom: string; valeur: number; min: number; max: number; pas: number; texte: string; changer: (v: number) => void; testid: string }) {
  return (
    <label class="curseur-ligne on-curseur">
      <span class="curseur-label">{nom}</span>
      <input type="range" class="curseur" min={min} max={max} step={pas} value={valeur} onInput={(e) => changer(e.currentTarget.valueAsNumber)} data-testid={testid} />
      <span class="on-valeur chiffres">{texte}</span>
    </label>
  );
}

function Appliquer({ id, agir, desactive, children }: { id: Onglet; agir: () => void; desactive?: boolean; children?: ComponentChildren }) {
  return (
    <button type="button" class="btn btn-principal on-appliquer" disabled={desactive} onClick={agir} data-testid={`outils-appliquer-${id}`}>
      {children ?? TO.appliquer}
    </button>
  );
}

export function FormRiff({ c }: { c: Cible }) {
  const r = riff.value;
  const generer = () => {
    const graine = nouvelleGraine();
    if (appliquer((m) => riffMachine(m, c.piste.id, c.section, { ...r, graine }), TO.onglets.riff)) derniereIdee.value = graine;
  };
  return (
    <>
      <p class="aide">{TO.riffAide}</p>
      <Puces nom={TO.style} valeurs={STYLES_RIFF} valeur={r.style} libelle={(s) => TO.styles[s]} choisir={(style) => (riff.value = { ...r, style })} testid="riff-style" />
      <Puces nom={TO.gamme} valeurs={GAMMES_RIFF} valeur={r.gamme} libelle={(g) => TO.gammes[g]} choisir={(gamme) => (riff.value = { ...r, gamme })} testid="riff-gamme" />
      <Curseur nom={TO.densite} valeur={r.densite} min={0.1} max={1} pas={0.05} texte={TO.pourcent(r.densite)} changer={(densite) => (riff.value = { ...r, densite })} testid="riff-densite" />
      <Appliquer id="riff" agir={generer}>
        ✦ {TO.riffGenerer}
      </Appliquer>
      {derniereIdee.value !== null && <p class="aide on-idee">{TO.riffIdee(derniereIdee.value)}</p>}
    </>
  );
}

export function FormCaler({ c }: { c: Cible }) {
  const q = quantif.value;
  const nom = QUANTIFS.find((x) => Math.abs(x.v - q) < 1e-9)?.nom ?? '1/16';
  return (
    <>
      <p class="aide">{TO.calerAide}</p>
      <Puces nom={TO.grille(nom)} valeurs={QUANTIFS.map((x) => x.v)} valeur={q} libelle={(v) => QUANTIFS.find((x) => x.v === v)!.nom} choisir={(v) => (quantif.value = v)} testid="caler-grille" />
      <Curseur nom={TO.force} valeur={force.value} min={0} max={1} pas={0.05} texte={TO.pourcent(force.value)} changer={(v) => (force.value = v)} testid="caler-force" />
      <Appliquer id="caler" desactive={c.nNotes === 0} agir={() => appliquer((m) => quantifier(m, c.piste.id, c.section, c.indices, q, force.peek()), TO.onglets.caler)} />
    </>
  );
}

export function FormArpege({ c }: { c: Cible }) {
  const a = arpege.value;
  return (
    <>
      <p class="aide">{TO.arpegeAide}</p>
      <Puces nom={TO.sens} valeurs={SENS_ARPEGE} valeur={a.sens} libelle={(s) => TO.sensArpege[s]} choisir={(sens) => (arpege.value = { ...a, sens })} testid="arpege-sens" />
      <Puces nom={TO.vitesse} valeurs={TO.vitesses.map((x) => x.v)} valeur={a.vitesse} libelle={(v) => TO.vitesses.find((x) => x.v === v)!.nom} choisir={(vitesse) => (arpege.value = { ...a, vitesse })} testid="arpege-vitesse" />
      <Puces nom={TO.octaves} valeurs={[1, 2, 3] as const} valeur={a.octaves} libelle={String} choisir={(octaves) => (arpege.value = { ...a, octaves })} testid="arpege-octaves" />
      <Curseur nom={TO.tenue} valeur={a.tenue} min={0.1} max={1} pas={0.05} texte={TO.pourcent(a.tenue)} changer={(tenue) => (arpege.value = { ...a, tenue })} testid="arpege-tenue" />
      <Appliquer id="arpege" desactive={c.nNotes === 0} agir={() => appliquer((m) => arpeger(m, c.piste.id, c.section, c.indices, { ...a, graine: nouvelleGraine() }), TO.onglets.arpege)} />
    </>
  );
}

export function FormStrum({ c }: { c: Cible }) {
  const s = strum.value;
  return (
    <>
      <p class="aide">{TO.strumAide}</p>
      <Puces nom={TO.sens} valeurs={['haut', 'bas'] as const} valeur={s.sens} libelle={(x) => TO.sensStrum[x]} choisir={(sens) => (strum.value = { ...s, sens })} testid="strum-sens" />
      <Curseur nom={TO.etalement} valeur={s.etalement} min={0} max={120} pas={5} texte={TO.ms(s.etalement)} changer={(etalement) => (strum.value = { ...s, etalement })} testid="strum-etalement" />
      <Appliquer id="strum" desactive={c.nNotes === 0} agir={() => appliquer((m) => gratter(m, c.piste.id, c.section, c.indices, s), TO.onglets.strum)} />
    </>
  );
}

export function FormHumaniser({ c }: { c: Cible }) {
  const h = humain.value;
  return (
    <>
      <p class="aide">{TO.humaniserAide}</p>
      <Curseur nom={TO.timing} valeur={h.timing} min={0} max={1} pas={0.05} texte={TO.pourcent(h.timing)} changer={(timing) => (humain.value = { ...h, timing })} testid="humaniser-timing" />
      <Curseur nom={TO.velocite} valeur={h.velocite} min={0} max={1} pas={0.05} texte={TO.pourcent(h.velocite)} changer={(velocite) => (humain.value = { ...h, velocite })} testid="humaniser-velocite" />
      <Appliquer id="humaniser" desactive={c.nNotes === 0} agir={() => appliquer((m) => humaniser(m, c.piste.id, c.section, c.indices, { ...h, graine: nouvelleGraine() }), TO.onglets.humaniser)} />
    </>
  );
}

export function FormGlisse({ c }: { c: Cible }) {
  const indices = c.indices ?? Array.from({ length: c.nNotes }, (_, i) => i);
  return (
    <>
      <p class="aide">{TO.glisseAide}</p>
      <div class="on-deux">
        <button type="button" class="btn btn-contour" disabled={c.nNotes === 0} onClick={() => appliquer((m) => reglerGlisse(m, c.piste.id, c.section, indices, true), TO.onglets.glisse)} data-testid="glisse-mettre">
          {TO.glisseMettre}
        </button>
        <button type="button" class="btn btn-discret" disabled={c.nNotes === 0} onClick={() => appliquer((m) => reglerGlisse(m, c.piste.id, c.section, indices, false), TO.onglets.glisse)} data-testid="glisse-retirer">
          {TO.glisseRetirer}
        </button>
      </div>
    </>
  );
}

export function FormSwing({ c }: { c: Cible }) {
  const propre = c.piste.swing;
  const regler = (v: number | null) => modifier((m) => reglerSwingPiste(m, c.piste.id, v), `swing-piste:${c.piste.id}`);
  return (
    <>
      <p class="aide">{TO.swingAide}</p>
      <label class="on-case">
        <input type="checkbox" role="switch" checked={propre === undefined} onChange={(e) => regler(e.currentTarget.checked ? null : c.m.swing)} data-testid="swing-morceau" />
        <span>{TO.swingMorceau(c.m.swing)}</span>
      </label>
      {propre !== undefined && (
        <Curseur nom={TO.swingPiste} valeur={propre} min={0} max={0.6} pas={0.01} texte={TO.pourcent(propre)} changer={regler} testid="swing-piste" />
      )}
    </>
  );
}
