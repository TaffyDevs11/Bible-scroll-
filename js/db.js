// Local-only storage in IndexedDB. Nothing ever leaves the device.
const DB_NAME = 'bible-advisor';
const VERSION = 1;
export const STORES = ['kv', 'saved', 'highlights', 'notes', 'plans'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      for (const s of ['saved', 'highlights', 'notes', 'plans']) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const get = (store, key) => tx(store, 'readonly', (s) => s.get(key));
export const all = (store) => tx(store, 'readonly', (s) => s.getAll());
export const put = (store, val, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
export const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
export const clear = (store) => tx(store, 'readwrite', (s) => s.clear());

export async function exportAll() {
  const out = { app: 'Bible Advisor', version: 1, exportedAt: new Date().toISOString() };
  for (const s of STORES) {
    if (s === 'kv') {
      const db = await open();
      out.kv = await new Promise((resolve, reject) => {
        const res = {};
        const req = db.transaction('kv').objectStore('kv').openCursor();
        req.onsuccess = () => { const c = req.result; if (c) { res[c.key] = c.value; c.continue(); } else resolve(res); };
        req.onerror = () => reject(req.error);
      });
    } else out[s] = await all(s);
  }
  return out;
}

export async function importAll(data, { replace = false } = {}) {
  if (!data || data.app !== 'Bible Advisor') throw new Error('This file is not a Bible Advisor backup.');
  for (const s of STORES) {
    if (replace) await clear(s);
    if (s === 'kv') { for (const [k, v] of Object.entries(data.kv || {})) await put('kv', v, k); }
    else for (const row of data[s] || []) if (row && row.id) await put(s, row);
  }
}

export async function resetAll() {
  for (const s of STORES) await clear(s);
}
