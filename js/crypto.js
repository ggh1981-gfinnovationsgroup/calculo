const enc = new TextEncoder();

export const toB64 = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function sha256Hex(str) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Bits(pw, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, k, 256);
}

export async function hashPin(pin) {
  const salt = randomBytes(16);
  const iter = 200000;
  return { salt: toB64(salt), iter, hash: toB64(await pbkdf2Bits(String(pin), salt, iter)) };
}

export async function verifyPin(pin, rec) {
  if (!rec) return false;
  return toB64(await pbkdf2Bits(String(pin), fromB64(rec.salt), rec.iter)) === rec.hash;
}

export async function deriveAesKey(secret, saltStr, iter = 100000) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(saltStr), iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(key, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, iv: toB64(iv), ct: toB64(ct) });
}

export async function decryptJson(key, blob) {
  const { iv, ct } = JSON.parse(blob);
  const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return JSON.parse(new TextDecoder().decode(p));
}
