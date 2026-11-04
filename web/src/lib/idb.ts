// Tiny IndexedDB key-value store for files kept on this device only (the
// player's own wallpaper). Never throws: failures resolve to undefined/false.

const DB_NAME = "playchain";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function idbGet(key: string): Promise<Blob | undefined> {
  try {
    const value = await run<unknown>("readonly", (s) => s.get(key));
    return value instanceof Blob ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: Blob): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(value, key));
    return true;
  } catch {
    return false;
  }
}

export async function idbDelete(key: string): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.delete(key));
    return true;
  } catch {
    return false;
  }
}
