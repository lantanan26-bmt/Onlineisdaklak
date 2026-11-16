/**
 * Persistent Storage Engine using IndexedDB with fallback to localStorage.
 * Solves the ~5MB localStorage quota limit for large image uploads,
 * ensuring all uploaded pictures, questions, and parts are permanently preserved.
 */

const DB_NAME = 'iSmartExamDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const IDB_MARKER_FLAG = '__idbOnly';

/**
 * Saves a value into IndexedDB and attempts to mirror to localStorage if size permits.
 */
export async function saveToStorage<T>(key: string, value: T): Promise<void> {
  // 1. Save to IndexedDB (virtually unlimited quota for large images)
  let idbSaved = false;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB transaction aborted'));
      };
    });
    idbSaved = true;
  } catch (err) {
    console.warn(`[Storage] Failed to save key "${key}" to IndexedDB:`, err);
  }

  // 2. Mirror to localStorage as fast cache (if within 5MB quota)
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // LocalStorage quota exceeded (common with large images); IndexedDB handles it.
    // Remove stale older cache so getInitialSyncStorage never serves outdated data.
    if (idbSaved) {
      try {
        localStorage.setItem(key, JSON.stringify({ [IDB_MARKER_FLAG]: true, updatedAtMs: Date.now() }));
      } catch {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * Loads a value from IndexedDB, falling back to localStorage if not yet migrated.
 */
export async function loadFromStorage<T>(key: string, defaultValue: T): Promise<T> {
  // 1. Try loading from IndexedDB first
  try {
    const db = await openDatabase();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });

    if (result !== undefined && result !== null) {
      return result;
    }
  } catch (err) {
    console.warn(`[Storage] IndexedDB read failed for "${key}", falling back to localStorage:`, err);
  }

  // 2. Fallback to localStorage
  try {
    const localVal = localStorage.getItem(key);
    if (localVal !== null) {
      const parsed = JSON.parse(localVal) as any;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed[IDB_MARKER_FLAG]) {
        return defaultValue;
      }
      // Asynchronously migrate to IndexedDB for safety
      saveToStorage(key, parsed as T).catch(() => {});
      return parsed as T;
    }
  } catch {
    // ignore
  }

  return defaultValue;
}

/**
 * Synchronous read from localStorage as instant initial state
 */
export function getInitialSyncStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item !== null) {
      const parsed = JSON.parse(item) as any;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed[IDB_MARKER_FLAG]) {
        return fallback;
      }
      return parsed as T;
    }
  } catch {
    // ignore
  }
  return fallback;
}
