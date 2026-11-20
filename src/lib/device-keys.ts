// This browser's device key pair, kept in IndexedDB. CryptoKey objects are stored as they are:
// the private key was created non-extractable, so even this code can't read its bytes.
// One record per signed-in user, since a shared computer may be used by more than one person.
//
// Browser only.

import type {PublicJwk} from './crypto';

const DB_NAME = 'curadiario';
const DB_VERSION = 1;
const STORE = 'devices';

export type StoredDevice = {
  userId: string;
  deviceId: string;
  keyPair: CryptoKeyPair;
  publicJwk: PublicJwk;
  createdAt: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, {keyPath: 'userId'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function readDevice(userId: string): Promise<StoredDevice | null> {
  return ((await run('readonly', (store) => store.get(userId))) as StoredDevice | undefined) ?? null;
}

export async function writeDevice(device: StoredDevice): Promise<void> {
  await run('readwrite', (store) => store.put(device));
}

export async function forgetDevice(userId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(userId));
}

/** False in private windows and some in-app browsers: keys would vanish when the tab closes. */
export async function canKeepKeys(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    await open().then((db) => db.close());
    return true;
  } catch {
    return false;
  }
}

/** "Chrome · Android", "Safari · iPhone": helps people tell their devices apart. */
export function describeThisDevice(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const system = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent)
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Mac OS X/.test(userAgent)
          ? 'Mac'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : '';
  const browser = /SamsungBrowser/.test(userAgent)
    ? 'Samsung Internet'
    : /Edg\//.test(userAgent)
      ? 'Edge'
      : /Firefox|FxiOS/.test(userAgent)
        ? 'Firefox'
        : /Chrome|CriOS/.test(userAgent)
          ? 'Chrome'
          : /Safari/.test(userAgent)
            ? 'Safari'
            : '';
  return [browser, system].filter(Boolean).join(' · ');
}
