import { sha256Hex, deriveAesKey, encryptJson, decryptJson, randomBytes } from '../crypto.js';
import { mergeStates } from '../merge.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newFamilyCode() {
  let s = '';
  for (const x of randomBytes(16)) s += ALPHABET[x % 32];
  return s.match(/.{4}/g).join('-');
}
export const normalizeCode = (c) => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isValidCode = (c) => {
  const n = normalizeCode(c);
  return n.length === 16 && [...n].every((ch) => ALPHABET.includes(ch));
};

const stripLocal = (state) => {
  const { sync, ...rest } = state;
  return rest;
};

/** Envuelve un proveedor local y, si hay código de familia, sincroniza un bloque cifrado en el cliente. */
export class CloudProvider {
  constructor(local, { url = '', fetchFn = (...a) => fetch(...a) } = {}) {
    this.local = local;
    this.url = url.replace(/\/$/, '');
    this.fetchFn = fetchFn;
    this.syncing = false;
    this._timer = null;
    this._cred = null;
    this.store = null;
  }

  configured() {
    return !!this.url;
  }
  load() {
    return this.local.load();
  }
  async save(obj) {
    await this.local.save(obj);
    if (!this.syncing && obj.sync && this.configured()) this.schedule();
  }
  clear() {
    return this.local.clear();
  }

  schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.syncNow().catch(() => {}), 5000);
  }

  async credentials(code) {
    const n = normalizeCode(code);
    if (this._cred?.n === n) return this._cred;
    const [id, token, key] = await Promise.all([
      sha256Hex(`calculo:id:${n}`),
      sha256Hex(`calculo:auth:${n}`),
      deriveAesKey(n, 'calculo-sync-v1'),
    ]);
    return (this._cred = { n, id, token, key });
  }

  request(method, cred, body) {
    return this.fetchFn(`${this.url}/v1/family`, {
      method,
      headers: {
        'X-Family-Id': cred.id,
        Authorization: `Bearer ${cred.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async _pull(cred) {
    const res = await this.request('GET', cred);
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const { rev, blob } = await res.json();
    return { rev, remote: await decryptJson(cred.key, blob) };
  }

  async _push(cred, state) {
    const blob = await encryptJson(cred.key, stripLocal(state));
    const res = await this.request('PUT', cred, { baseRev: state.sync.rev || 0, blob });
    if (res.status === 409) {
      const { rev, blob: rb } = await res.json();
      return { conflict: true, rev, remote: await decryptJson(cred.key, rb) };
    }
    if (!res.ok) throw new Error(`sync ${res.status}`);
    return { rev: (await res.json()).rev };
  }

  async syncNow() {
    const store = this.store;
    if (!store?.state.sync || !this.configured() || this.syncing) return;
    this.syncing = true;
    try {
      const cred = await this.credentials(store.state.sync.code);
      const pulled = await this._pull(cred);
      if (!pulled.notFound) {
        const sync = { ...store.state.sync, rev: pulled.rev };
        store.replace({ ...mergeStates(store.state, pulled.remote), sync });
      }
      for (let i = 0; i < 2; i++) {
        const r = await this._push(cred, store.state);
        if (r.conflict) {
          const sync = { ...store.state.sync, rev: r.rev };
          store.replace({ ...mergeStates(store.state, r.remote), sync });
          continue;
        }
        store.state.sync.rev = r.rev;
        store.state.sync.last = Date.now();
        break;
      }
      await this.local.save(store.state);
    } finally {
      this.syncing = false;
    }
  }

  async enable() {
    const code = newFamilyCode();
    this.store.state.sync = { code, rev: 0, last: null };
    try {
      await this.syncNow();
    } catch (e) {
      this.store.state.sync = null;
      throw e;
    }
    return code;
  }

  async join(code) {
    const store = this.store;
    if (!isValidCode(code)) throw new Error('invalid');
    const cred = await this.credentials(code);
    const pulled = await this._pull(cred);
    if (pulled.notFound) throw new Error('notfound');
    const sync = { code: normalizeCode(code).match(/.{4}/g).join('-'), rev: pulled.rev, last: Date.now() };
    const local = store.state;
    if (local.profiles.length === 0) store.replace({ ...pulled.remote, lang: local.lang || pulled.remote.lang, sync });
    else store.replace({ ...mergeStates(local, pulled.remote), sync });
    await this.syncNow();
  }

  async disconnect({ deleteRemote = false } = {}) {
    const s = this.store.state.sync;
    if (s && deleteRemote && this.configured()) {
      const res = await this.request('DELETE', await this.credentials(s.code));
      if (!res.ok && res.status !== 404) throw new Error(`sync ${res.status}`);
    }
    this.store.state.sync = null;
    this._cred = null;
    await this.local.save(this.store.state);
  }
}
