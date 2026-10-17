const DB = 'calculo';
const KEY = 'state';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const tx = (db, mode, fn) =>
  new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode);
    const r = fn(t.objectStore('kv'));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
  });

export class LocalProvider {
  constructor() {
    this.db = null;
  }

  async _db() {
    if (this.db === null) {
      try {
        this.db = await openDb();
      } catch {
        this.db = false; // IndexedDB no disponible (p. ej. navegación privada)
      }
    }
    return this.db;
  }

  async load() {
    const db = await this._db();
    if (db) return (await tx(db, 'readonly', (s) => s.get(KEY))) || null;
    try {
      return JSON.parse(localStorage.getItem('calculo.state') || 'null');
    } catch {
      return null;
    }
  }

  async save(obj) {
    const db = await this._db();
    if (db) return void (await tx(db, 'readwrite', (s) => s.put(obj, KEY)));
    localStorage.setItem('calculo.state', JSON.stringify(obj));
  }

  async clear() {
    const db = await this._db();
    if (db) await tx(db, 'readwrite', (s) => s.delete(KEY));
    localStorage.removeItem('calculo.state');
  }
}
