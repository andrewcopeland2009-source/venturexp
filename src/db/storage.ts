import { VentureDB, db, setDatabase } from './db';
import { ensureDefaults } from './progression';
import { readAll, writeAll, BackupSchema } from './backup';

/**
 * Storage bootstrap. IndexedDB is the primary store. If the browser refuses IndexedDB
 * (rare — some locked-down or private modes), we fall back to an in-memory IndexedDB
 * that is snapshotted to localStorage, so progress still survives a reload.
 */
export type StorageMode = 'indexeddb' | 'localstorage-fallback';
export let storageMode: StorageMode = 'indexeddb';

const SNAPSHOT_KEY = 'venturexp:fallback-snapshot';

async function canUseIndexedDB(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    await db.open();
    return true;
  } catch {
    return false;
  }
}

async function startFallback() {
  const { indexedDB: memIDB, IDBKeyRange: memRange } = await import('fake-indexeddb');
  const mem = new VentureDB('venturexp-fallback', { indexedDB: memIDB, IDBKeyRange: memRange });
  setDatabase(mem);
  storageMode = 'localstorage-fallback';
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (raw) {
      const parsed = BackupSchema.shape.data.safeParse(JSON.parse(raw));
      if (parsed.success) await writeAll(parsed.data);
    }
  } catch {
    /* corrupted snapshot: start fresh */
  }
  let last = '';
  const save = async () => {
    try {
      const json = JSON.stringify(await readAll());
      if (json !== last) {
        localStorage.setItem(SNAPSHOT_KEY, json);
        last = json;
      }
    } catch {
      /* quota exceeded: keep going in memory */
    }
  };
  setInterval(save, 4000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void save());
  window.addEventListener('pagehide', () => void save());
}

export async function initStorage(): Promise<StorageMode> {
  if (!(await canUseIndexedDB())) await startFallback();
  await ensureDefaults();
  return storageMode;
}
