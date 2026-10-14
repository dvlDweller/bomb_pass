// Generates public/thumbnail.png (400x300) with no dependencies.
// Draws a simple bomb-pass themed placeholder: dark background, orange band,
// black bomb circle with a spark.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 400;
const HEIGHT = 300;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Simple vertical gradient background + bomb circle + spark.
const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
const cx = 200;
const cy = 150;
const radius = 70;
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    // Background gradient: deep navy to slightly lighter navy.
    let r = lerp(18, 34, y / HEIGHT);
    let g = lerp(24, 44, y / HEIGHT);
    let b = lerp(48, 78, y / HEIGHT);
    // Orange band across the middle.
    if (y >= 110 && y <= 190) {
      r = 230;
      g = 120;
      b = 30;
    }
    // Bomb circle.
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= radius) {
      r = 25;
      g = 25;
      b = 30;
      // Highlight.
      if (dist <= radius * 0.55 && dx < 0 && dy < 0) {
        r = 70;
        g = 70;
        b = 80;
      }
    }
    // Fuse spark (top-right of the bomb).
    const sx = x - (cx + 45);
    const sy = y - (cy - 55);
    if (Math.sqrt(sx * sx + sy * sy) <= 14) {
      r = 255;
      g = 200;
      b = 60;
    }
    const i = (y * WIDTH + x) * 3;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  }
}

// Raw scanlines with filter byte 0.
const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (1 + WIDTH * 3)] = 0;
  pixels.copy(raw, y * (1 + WIDTH * 3) + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', '..', 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'thumbnail.png'), png);
console.log(`Wrote ${path.join(outDir, 'thumbnail.png')} (${png.length} bytes)`);
