const DB_NAME = 'thriftos';
const DB_VERSION = 1;
const STORES = ['writes', 'results'] as const;

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** A tiny promise wrapper over one IndexedDB object store keyed by `id`. */
export class IdbStore<T extends { id: string }> {
  constructor(private readonly name: (typeof STORES)[number]) {}

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await open()).transaction(this.name, mode).objectStore(this.name);
  }

  async get(id: string): Promise<T | undefined> {
    return done((await this.store('readonly')).get(id)) as Promise<T | undefined>;
  }

  async all(): Promise<T[]> {
    return done((await this.store('readonly')).getAll()) as Promise<T[]>;
  }

  async put(value: T): Promise<void> {
    await done((await this.store('readwrite')).put(value));
  }

  async delete(id: string): Promise<void> {
    await done((await this.store('readwrite')).delete(id));
  }
}
