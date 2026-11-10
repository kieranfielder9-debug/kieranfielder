// Generates the PWA icons (solid rounded tile with a simple glyph) without any image library.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const inRounded = (x, y, x0, y0, w, h, r) => {
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r));
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

function paint(x, y, size, maskable) {
  const pad = maskable ? 0 : size * 0.06;
  const r = maskable ? 0 : size * 0.22;
  if (!inRounded(x + 0.5, y + 0.5, pad, pad, size - pad * 2, size - pad * 2, r)) return [0, 0, 0, 0];
  const t = (x + y) / (2 * size);
  const bg = [Math.round(79 + (236 - 79) * t * 0.35), Math.round(70 + (72 - 70) * t), Math.round(229 - 60 * t), 255];
  // Glyph: a frame (outline) with a stack of three bars inside.
  const u = size / 24;
  const frame = inRounded(x + 0.5, y + 0.5, 5 * u, 5 * u, 14 * u, 14 * u, 2.2 * u) && !inRounded(x + 0.5, y + 0.5, 6.6 * u, 6.6 * u, 10.8 * u, 10.8 * u, 1.4 * u);
  const bars = [8.5, 11.5, 14.5].some((by) => inRounded(x + 0.5, y + 0.5, 8.5 * u, by * u, 7 * u, 1.6 * u, 0.8 * u));
  return frame || bars ? [255, 255, 255, 255] : bg;
}

const out = path.resolve('apps/editor/public/icons');
mkdirSync(out, { recursive: true });
for (const size of [192, 512]) writeFileSync(path.join(out, `icon-${size}.png`), png(size, (x, y, s) => paint(x, y, s, false)));
writeFileSync(path.join(out, 'icon-512-maskable.png'), png(512, (x, y, s) => paint(x, y, s, true)));
writeFileSync(path.join(out, 'apple-touch-icon.png'), png(180, (x, y, s) => paint(x, y, s, true)));
console.log('icons written to', out);
