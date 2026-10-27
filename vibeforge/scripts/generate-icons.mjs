#!/usr/bin/env node
/**
 * Genererar VibeForge-logotypen som riktiga ikonfiler (PNG, ICO och ICNS) helt utan
 * externa beroenden. Formen ritas matematiskt och skrivs med Node:s inbyggda zlib.
 *
 * Kör: npm run icons
 *
 * Filerna är avsiktligt enkla och deterministiska. Byt gärna ut dem mot ett Design-Original
 * senare – formaten är standard, så inget annat behöver ändras.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const iconDir = path.resolve(here, '..', 'apps', 'desktop', 'src-tauri', 'icons');
const publicDir = path.resolve(here, '..', 'apps', 'desktop', 'public');

const PALETTE = {
  anvil: [0x14, 0x16, 0x1c],
  forge: [0x1b, 0x1f, 0x27],
  steel: [0x2a, 0x2f, 0x3a],
  iron: [0x3a, 0x41, 0x50],
  ember: [0xff, 0x7a, 0x3d],
  spark: [0xff, 0xd1, 0x66],
};

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Skriver RGBA-pixlar som en PNG (8 bitar per kanal, ingen interlace). */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filtertyp 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach((image, index) => {
    const entry = directory.subarray(index * 16, index * 16 + 16);
    entry[0] = image.size >= 256 ? 0 : image.size;
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
  });
  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

function packIcns(entries) {
  const iconEntries = entries.map(({ type, data }) => {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length + 8, 0);
    return Buffer.concat([Buffer.from(type, 'ascii'), size, data]);
  });
  const body = Buffer.concat(iconEntries);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

// ---- ritprimitiver (allt i normaliserade koordinater 0..1) ----

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function insideRoundedSquare(x, y, inset, radius) {
  const min = inset;
  const max = 1 - inset;
  if (x < min || x > max || y < min || y > max) return false;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  return (
    Math.hypot(x - cx, y - cy) <= radius + 1e-9 ||
    (x >= min + radius && x <= max - radius) ||
    (y >= min + radius && y <= max - radius)
  );
}

/** Returnerar färgen [r,g,b,a] för en punkt i logotypen. */
function sample(x, y) {
  // bakgrund: mörk forge-platta med ljus kant
  if (!insideRoundedSquare(x, y, 0.035, 0.22)) return [0, 0, 0, 0];
  const edge = !insideRoundedSquare(x, y, 0.075, 0.2);
  if (edge) return [...PALETTE.steel, 255];

  let color = [...PALETTE.forge, 255];

  // städlinje längst ner
  if (x >= 0.28 && x <= 0.72 && y >= 0.78 && y <= 0.845) color = [...PALETTE.iron, 255];

  // V-formad smidesform (två streck)
  const width = 0.075;
  const left = distanceToSegment(x, y, 0.26, 0.24, 0.5, 0.68);
  const right = distanceToSegment(x, y, 0.5, 0.68, 0.74, 0.24);
  if (left <= width || right <= width) {
    color = left <= width && right <= width ? [...PALETTE.spark, 255] : [...PALETTE.ember, 255];
  }

  // gnista vid sidan av formen
  if (Math.abs(x - 0.76) + Math.abs(y - 0.6) <= 0.055) color = [...PALETTE.spark, 255];

  return color;
}

/** Renderar logotypen med 3x3-supersampling för mjuka kanter. */
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 3;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          const [sr, sg, sb, sa] = sample(x, y);
          const alpha = sa / 255;
          r += sr * alpha;
          g += sg * alpha;
          b += sb * alpha;
          a += alpha;
        }
      }
      const total = samples * samples;
      const alpha = a / total;
      const offset = (py * size + px) * 4;
      if (alpha > 0) {
        rgba[offset] = Math.round(r / a);
        rgba[offset + 1] = Math.round(g / a);
        rgba[offset + 2] = Math.round(b / a);
      }
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="VibeForge">
  <rect x="2.2" y="2.2" width="59.6" height="59.6" rx="13" fill="#1b1f27" stroke="#2a2f3a" stroke-width="2.6"/>
  <path d="M16.6 15.4 32 43.5 47.4 15.4" fill="none" stroke="#ff7a3d" stroke-width="9.6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="18" y="50" width="28" height="4.2" rx="2.1" fill="#3a4150"/>
  <path d="M48.6 38.4 51.4 41.2 48.6 44 45.8 41.2z" fill="#ffd166"/>
</svg>
`;

function main() {
  fs.mkdirSync(iconDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const sizes = [32, 128, 256, 512];
  const pngs = new Map();
  for (const size of sizes) {
    const png = encodePng(size, size, render(size));
    pngs.set(size, png);
  }

  const files = [
    ['32x32.png', pngs.get(32)],
    ['128x128.png', pngs.get(128)],
    ['128x128@2x.png', pngs.get(256)],
    ['icon.png', pngs.get(512)],
    [
      'icon.ico',
      packIco([
        { size: 32, data: pngs.get(32) },
        { size: 128, data: pngs.get(128) },
        { size: 256, data: pngs.get(256) },
      ]),
    ],
    [
      'icon.icns',
      packIcns([
        { type: 'ic07', data: pngs.get(128) },
        { type: 'ic08', data: pngs.get(256) },
        { type: 'ic09', data: pngs.get(512) },
      ]),
    ],
  ];

  for (const [name, data] of files) {
    fs.writeFileSync(path.join(iconDir, name), data);
    console.log(`ikon: ${name} (${data.length} byte)`);
  }

  // Logotyp till webbappen (favicon i skrivbordsappen och den publika sajten).
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), LOGO_SVG);
  fs.writeFileSync(path.join(iconDir, 'logo.svg'), LOGO_SVG);
  console.log('logo.svg skriven till apps/desktop/public och src-tauri/icons');
}

main();
