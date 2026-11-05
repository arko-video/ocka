// FAUX navigateur pour les tests Vitest (Node) d'A2 : OPFS en mémoire (dossiers, fichiers, flux d'écriture avec
// position, quota simulé), idb-keyval en mémoire (à brancher avec vi.mock), verrous et estimation de la place.
// Jamais importé par l'appli.

type Contenu = { donnees: Uint8Array; modifie: number };

export class FichierFactice {
  readonly kind = 'file' as const;
  constructor(
    public name: string,
    public contenu: Contenu,
    private racine: RacineFactice,
  ) {}
  async getFile(): Promise<File> {
    return new File([this.contenu.donnees.slice()], this.name, { lastModified: this.contenu.modifie });
  }
  async createWritable(options?: { keepExistingData?: boolean }) {
    let travail = options?.keepExistingData ? this.contenu.donnees.slice() : new Uint8Array(0);
    let curseur = 0;
    let ferme = false;
    const racine = this.racine;
    const contenu = this.contenu;
    const ecrire = (data: Uint8Array, position: number) => {
      const fin = position + data.length;
      if (racine.quota !== null && racine.utilise() - contenu.donnees.length + Math.max(fin, travail.length) > racine.quota) {
        throw new DOMException('Quota dépassé (factice)', 'QuotaExceededError');
      }
      if (fin > travail.length) {
        const plus = new Uint8Array(Math.max(fin, travail.length * 2));
        plus.set(travail);
        travail = plus.subarray(0, fin);
      }
      travail.set(data, position);
      curseur = fin;
    };
    const versOctets = async (d: unknown): Promise<Uint8Array> => {
      if (typeof d === 'string') return new TextEncoder().encode(d);
      if (d instanceof Blob) return new Uint8Array(await d.arrayBuffer());
      if (d instanceof ArrayBuffer) return new Uint8Array(d);
      if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
      throw new TypeError('donnée inconnue');
    };
    const fermer = async () => {
      ferme = true;
      contenu.donnees = travail.slice();
      contenu.modifie = racine.maintenant();
    };
    // Un vrai WritableStream (pour pipeTo), avec en plus les méthodes de FileSystemWritableFileStream.
    const flux = new WritableStream<unknown>({
      write: async (c) => ecrire((await versOctets(c)).slice(), curseur),
      close: fermer,
      abort: async () => void (ferme = true),
    });
    return Object.assign(flux, {
      async write(arg: unknown) {
        if (ferme) throw new TypeError('flux fermé');
        racine.ecritures++;
        if (arg && typeof arg === 'object' && 'type' in (arg as object)) {
          const a = arg as { type: string; position?: number; data?: unknown; size?: number };
          if (a.type === 'seek') curseur = a.position!;
          else if (a.type === 'truncate') travail = travail.slice(0, a.size!);
          else ecrire((await versOctets(a.data)).slice(), a.position ?? curseur);
          return;
        }
        ecrire((await versOctets(arg)).slice(), curseur);
      },
      async seek(p: number) {
        curseur = p;
      },
      async truncate(n: number) {
        travail = travail.slice(0, n);
      },
      close: fermer,
      async abort() {
        ferme = true;
      },
    });
  }
  async move(dossier: DossierFactice, nom: string) {
    const parent = this.racine.parentDe(this);
    parent?.enfants.delete(this.name);
    this.name = nom;
    dossier.enfants.set(nom, this);
  }
}

export class DossierFactice {
  readonly kind = 'directory' as const;
  enfants = new Map<string, DossierFactice | FichierFactice>();
  constructor(
    public name: string,
    private racine: RacineFactice,
  ) {}
  async getDirectoryHandle(nom: string, o?: { create?: boolean }) {
    const e = this.enfants.get(nom);
    if (e instanceof DossierFactice) return e;
    if (e) throw new DOMException('pas un dossier', 'TypeMismatchError');
    if (!o?.create) throw new DOMException(`${nom} introuvable`, 'NotFoundError');
    const d = new DossierFactice(nom, this.racine);
    this.enfants.set(nom, d);
    return d;
  }
  async getFileHandle(nom: string, o?: { create?: boolean }) {
    if (!nom || nom.includes('/')) throw new TypeError('nom invalide');
    const e = this.enfants.get(nom);
    if (e instanceof FichierFactice) return e;
    if (e) throw new DOMException('pas un fichier', 'TypeMismatchError');
    if (!o?.create) throw new DOMException(`${nom} introuvable`, 'NotFoundError');
    const f = new FichierFactice(nom, { donnees: new Uint8Array(0), modifie: this.racine.maintenant() }, this.racine);
    this.enfants.set(nom, f);
    return f;
  }
  async removeEntry(nom: string, o?: { recursive?: boolean }) {
    const e = this.enfants.get(nom);
    if (!e) throw new DOMException(`${nom} introuvable`, 'NotFoundError');
    if (e instanceof DossierFactice && e.enfants.size > 0 && !o?.recursive) throw new DOMException('dossier non vide', 'InvalidModificationError');
    this.enfants.delete(nom);
  }
  async *keys() {
    for (const k of [...this.enfants.keys()]) yield k;
  }
  async *values() {
    for (const v of [...this.enfants.values()]) yield v;
  }
  async *entries() {
    for (const e of [...this.enfants.entries()]) yield e;
  }
}

export class RacineFactice extends DossierFactice {
  quota: number | null = null;
  horloge = 1_000_000_000_000;
  ecritures = 0;
  constructor() {
    super('', null as unknown as RacineFactice);
    (this as unknown as { racine: RacineFactice }).racine = this;
  }
  maintenant() {
    return this.horloge;
  }
  /** Octets de tous les fichiers fermés. */
  utilise(d: DossierFactice = this): number {
    let s = 0;
    for (const e of d.enfants.values()) s += e instanceof FichierFactice ? e.contenu.donnees.length : this.utilise(e);
    return s;
  }
  parentDe(f: FichierFactice, d: DossierFactice = this): DossierFactice | null {
    for (const e of d.enfants.values()) {
      if (e === f) return d;
      if (e instanceof DossierFactice) {
        const p = this.parentDe(f, e);
        if (p) return p;
      }
    }
    return null;
  }
  /** Noms des fichiers d'un dossier (pour les vérifications). */
  noms(dossier: string): string[] {
    const d = this.enfants.get(dossier);
    return d instanceof DossierFactice ? [...d.enfants.keys()].sort() : [];
  }
  fichier(dossier: string, nom: string): FichierFactice | null {
    const d = this.enfants.get(dossier);
    const f = d instanceof DossierFactice ? d.enfants.get(nom) : undefined;
    return f instanceof FichierFactice ? f : null;
  }
  /** Pose un fichier directement (préparation d'un test). */
  poser(dossier: string, nom: string, donnees: Uint8Array, modifie = this.horloge) {
    let d = this.enfants.get(dossier) as DossierFactice | undefined;
    if (!d) {
      d = new DossierFactice(dossier, this);
      this.enfants.set(dossier, d);
    }
    d.enfants.set(nom, new FichierFactice(nom, { donnees: donnees.slice(), modifie }, this));
  }
}

/* ------------------------------------------------------------ idb-keyval en mémoire */

export const bases = new Map<string, Map<IDBValidKey, unknown>>();
type Magasin = { base: string; magasin: string };
const DEFAUT: Magasin = { base: 'keyval-store', magasin: 'keyval' };
function table(m?: Magasin): Map<IDBValidKey, unknown> {
  const s = m ?? DEFAUT;
  const cle = `${s.base}/${s.magasin}`;
  let t = bases.get(cle);
  if (!t) bases.set(cle, (t = new Map()));
  return t;
}
/** Remplace idb-keyval : vi.mock('idb-keyval', async () => (await import('…/test-factices')).idbFactice). */
export const idbFactice = {
  createStore: (base: string, magasin: string) => ({ base, magasin }),
  get: async (k: IDBValidKey, m?: Magasin) => structuredClone(table(m).get(k)),
  set: async (k: IDBValidKey, v: unknown, m?: Magasin) => void table(m).set(k, structuredClone(v)),
  del: async (k: IDBValidKey, m?: Magasin) => void table(m).delete(k),
  delMany: async (ks: IDBValidKey[], m?: Magasin) => ks.forEach((k) => table(m).delete(k)),
  keys: async (m?: Magasin) => [...table(m).keys()],
  values: async (m?: Magasin) => [...table(m).values()].map((v) => structuredClone(v)),
  entries: async (m?: Magasin) => [...table(m).entries()].map(([k, v]) => [k, structuredClone(v)]),
  clear: async (m?: Magasin) => table(m).clear(),
  update: async (k: IDBValidKey, f: (v: unknown) => unknown, m?: Magasin) => void table(m).set(k, structuredClone(f(structuredClone(table(m).get(k))))),
};

/* ------------------------------------------------------------ navigateur */

/** Installe le faux navigateur (OPFS, place, verrous) ; renvoie la racine OPFS. */
export function installerNavigateur(stub: (nom: string, valeur: unknown) => void, opts: { libre?: number } = {}): RacineFactice {
  const racine = new RacineFactice();
  const files = new Map<string, Promise<unknown>>();
  bases.clear();
  stub('navigator', {
    storage: {
      getDirectory: async () => racine,
      estimate: async () => ({ quota: opts.libre ?? 1e12, usage: 0 }),
      persist: async () => true,
      persisted: async () => false,
    },
    locks: {
      request: (nom: string, f: () => Promise<unknown>) => {
        const avant = files.get(nom) ?? Promise.resolve();
        const p = avant.catch(() => {}).then(f);
        files.set(nom, p);
        return p;
      },
      query: async () => ({ held: [], pending: [] }),
    },
  });
  stub('indexedDB', { databases: async () => [...new Set([...bases.keys()].map((k) => k.split('/')[0]))].map((name) => ({ name, version: 1 })) });
  return racine;
}
