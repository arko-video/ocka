// Messages d'un clavier MIDI (Web MIDI) : note enfoncée, note relâchée. Le reste (molettes, pédale, horloge,
// sysex) est ignoré. Un message mal formé est ignoré sans bruit (un appareil peut envoyer n'importe quoi).

/** Ce qu'OCKA attend d'une entrée Web MIDI (MIDIInput, ou un faux dans les tests). */
export interface EntreeMidi {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  addEventListener(type: 'midimessage', f: (e: Event) => void): void;
  removeEventListener(type: 'midimessage', f: (e: Event) => void): void;
}

export interface MessageMidi {
  type: 'on' | 'off';
  canal: number;
  midi: number;
  /** Vélocité 0 à 127 (0 pour un relâchement). */
  vel: number;
  /** Heure du message (ms, horloge de performance.now()). */
  ms: number;
}

export function lireMessage(e: { data?: Uint8Array | null; timeStamp?: number }): MessageMidi | null {
  const d = e?.data;
  if (!d || typeof d.length !== 'number' || d.length < 3) return null;
  const statut = d[0]!;
  const type = statut & 0xf0;
  const midi = d[1]! & 0x7f;
  const vel = d[2]! & 0x7f;
  const ms = typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp) ? e.timeStamp : typeof performance !== 'undefined' ? performance.now() : 0;
  if (type === 0x90 && vel > 0) return { type: 'on', canal: statut & 0x0f, midi, vel, ms };
  if (type === 0x80 || type === 0x90) return { type: 'off', canal: statut & 0x0f, midi, vel: 0, ms };
  return null;
}
