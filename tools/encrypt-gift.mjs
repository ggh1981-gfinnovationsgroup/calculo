// Uso: node tools/encrypt-gift.mjs [ruta-mensaje.json]
// La contraseña se lee de GIFT_PASSWORD o se pide por consola; nunca se escribe en disco.
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const messagePath = process.argv[2] ?? join(root, 'tools', 'gift-message.json');
const ITERATIONS = 600000;

async function askPassword() {
  if (process.env.GIFT_PASSWORD) return process.env.GIFT_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const p = await rl.question('Contraseña secreta: ');
  rl.close();
  return p;
}

const password = await askPassword();
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

const message = JSON.parse(await readFile(messagePath, 'utf8'));
for (const k of ['title', 'badge', 'letter', 'close']) {
  if (typeof message[k] !== 'string' || !message[k]) {
    console.error(`Falta el campo "${k}" en ${messagePath}`);
    process.exit(1);
  }
}

const b64 = (buf) => Buffer.from(buf).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password.normalize('NFKC')),
  'PBKDF2',
  false,
  ['deriveKey']
);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
);
const ct = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(JSON.stringify(message))
);

const data = { v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
const dataJs = `export const GIFT = ${JSON.stringify(data, null, 2)};\n`;
await writeFile(join(root, 'gift', 'gift-data.js'), dataJs);

const moduleSrc = (await readFile(join(root, 'gift', 'gift.js'), 'utf8')).replace(/^export /gm, '');
const template = await readFile(join(root, 'gift', 'standalone.template.html'), 'utf8');
const html = template
  .replace('/*GIFT_MODULE*/', () => moduleSrc)
  .replace('/*GIFT_DATA*/', () => `const GIFT = ${JSON.stringify(data)};`);
await writeFile(join(root, 'gift', 'index.html'), html);

console.log('Listo: gift/gift-data.js y gift/index.html (página independiente) actualizados.');
