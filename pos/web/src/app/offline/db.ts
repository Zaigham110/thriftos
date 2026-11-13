/**
 * A very small store on the device (IndexedDB): one table of named values (the last copy of stock, customers and
 * settings) and one table for things waiting to be sent to the server (bills made offline).
 */
const NAME = 'thriftos-pos';
const KV = 'kv';
const OUTBOX = 'outbox';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(KV);
      req.result.createObjectStore(OUTBOX, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = work(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export interface Waiting {
  key: string;
  type: 'sale' | 'cash';
  at: number;
  payload: Record<string, unknown>;
  /** A copy for the screen and the printer while the bill is not on the server yet. */
  sale?: unknown;
  /** The server refused it (not a connection problem); a person has to look. */
  error?: string;
}

export const deviceDb = {
  get: <T>(key: string) => run<T | undefined>(KV, 'readonly', (s) => s.get(key)).catch(() => undefined),
  set: (key: string, value: unknown) => run(KV, 'readwrite', (s) => s.put(value, key)).catch(() => undefined),
  waiting: () => run<Waiting[]>(OUTBOX, 'readonly', (s) => s.getAll()).then((all) => all.sort((a, b) => a.at - b.at)).catch(() => [] as Waiting[]),
  keep: (item: Waiting) => run(OUTBOX, 'readwrite', (s) => s.put(item)),
  drop: (key: string) => run(OUTBOX, 'readwrite', (s) => s.delete(key)).catch(() => undefined),
};
