import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Draws the app icon (a gold coin) and the tray icons (the coin with a status
// dot) as PNG files, so there are no binary assets to keep in the repository.
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets");
mkdirSync(out, { recursive: true });

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// One sample of the coin at unit coordinates (-1..1); null = transparent.
function coin(u, v) {
  const d = Math.hypot(u, v);
  if (d > 0.94) return null;
  if (d > 0.80) return mix([120, 82, 12], [176, 128, 26], 1 - (d - 0.80) / 0.14);      // rim
  if (d > 0.72) return [96, 66, 10];                                                    // groove
  const shine = Math.max(0, 1 - Math.hypot(u + 0.35, v + 0.4) / 1.1);                   // face, lit from the top left
  const face = mix([212, 160, 40], [255, 224, 120], shine);
  // A simple "Q": a ring with a tail.
  const ring = Math.abs(Math.hypot(u, v * 1.05) - 0.36);
  const tail = Math.abs((u - v) * 0.7071 - 0.02) < 0.06 && u > 0.12 && v > 0.12 && u < 0.5;
  if (ring < 0.075 || tail) return [104, 70, 8];
  return face;
}

function render(size, dot) {
  const samples = 3;
  return png(size, (x, y) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const px = x + (sx + 0.5) / samples, py = y + (sy + 0.5) / samples;
      const u = (px / size) * 2 - 1, v = (py / size) * 2 - 1;
      let color = coin(u, v);
      if (dot) {
        const dd = Math.hypot(u - 0.56, v - 0.56);
        if (dd < 0.42) color = dd > 0.32 ? [20, 16, 8] : dot;
      }
      if (color) { r += color[0]; g += color[1]; b += color[2]; a += 255; }
    }
    const n = samples * samples;
    const weight = a / 255 || 1;
    return [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight), Math.round(a / n)];
  });
}

writeFileSync(join(out, "icon.png"), render(256));
writeFileSync(join(out, "tray-ok.png"), render(32, [60, 200, 90]));
writeFileSync(join(out, "tray-error.png"), render(32, [225, 70, 60]));
writeFileSync(join(out, "tray-setup.png"), render(32, [230, 170, 40]));
console.log("Icons written to", out);
