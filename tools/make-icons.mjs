import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};

// Icono: fondo índigo redondeado con un "+" y un "×" simplificados.
function icon(size) {
  const px = Buffer.alloc(size * (size * 4 + 1));
  const r = size * 0.22;
  const inRound = (x, y) => {
    const dx = Math.max(r - x, 0, x - (size - 1 - r));
    const dy = Math.max(r - y, 0, y - (size - 1 - r));
    return dx * dx + dy * dy <= r * r;
  };
  const t = size * 0.09;
  const c = size / 2;
  const arm = size * 0.26;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    px[row] = 0;
    for (let x = 0; x < size; x++) {
      const o = row + 1 + x * 4;
      let col = [0, 0, 0, 0];
      if (inRound(x, y)) {
        col = [91, 91, 214, 255];
        const plus = (Math.abs(x - c) < t && Math.abs(y - c) < arm) || (Math.abs(y - c) < t && Math.abs(x - c) < arm);
        if (plus) col = [255, 255, 255, 255];
      }
      px.set(col, o);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(px)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', icon(192));
writeFileSync('icons/icon-512.png', icon(512));
writeFileSync('icons/apple-touch-icon.png', icon(180));
console.log('icons ok');
