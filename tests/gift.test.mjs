// Requiere haber ejecutado tools/encrypt-gift.mjs y la variable GIFT_PASSWORD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decryptGift } from '../gift/gift.js';
import { GIFT } from '../gift/gift-data.js';

const pw = process.env.GIFT_PASSWORD;

test('la contraseña correcta descifra el regalo', { skip: !pw }, async () => {
  const g = await decryptGift(GIFT, pw);
  assert.equal(g.title, 'Nivel 14 desbloqueado');
});

test('una contraseña incorrecta falla', async () => {
  await assert.rejects(decryptGift(GIFT, 'clave-incorrecta-123'));
});

test('ni la contraseña ni la carta aparecen en el código', { skip: !pw }, async () => {
  for (const f of ['gift/index.html', 'gift/gift-data.js', 'gift/gift.js']) {
    const src = await readFile(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!src.includes(pw), `${f} contiene la contraseña`);
    assert.ok(!src.includes('PolloFenix'), `${f} contiene la carta`);
  }
});
