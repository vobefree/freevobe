// Engångsskript: undersöker logotypens färg (är den mörk eller vit?).
const fs = require("fs");
const zlib = require("zlib");

const buf = fs.readFileSync(process.argv[2] || "public/logo.png");
let pos = 8;
let width = 0;
let height = 0;
let bitDepth = 8;
let colorType = 6;
const idat = [];

while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString("ascii", pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === "IDAT") {
    idat.push(data);
  } else if (type === "IEND") {
    break;
  }
  pos += 12 + len;
}

const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
if (bitDepth !== 8 || channels === 0) {
  console.log(JSON.stringify({ width, height, bitDepth, colorType, note: "okänd format" }));
  process.exit(0);
}

const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = width * channels;
const pixels = Buffer.alloc(stride * height);
let prev = Buffer.alloc(stride);

for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const out = pixels.subarray(y * stride, (y + 1) * stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= channels ? out[i - channels] : 0;
    const b = prev[i];
    const c = i >= channels ? prev[i - channels] : 0;
    let value = line[i];
    if (filter === 1) value += a;
    else if (filter === 2) value += b;
    else if (filter === 3) value += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    out[i] = value & 0xff;
  }
  prev = out;
}

let r = 0;
let g = 0;
let b = 0;
let n = 0;
for (let i = 0; i < pixels.length; i += channels) {
  const alpha = channels === 4 ? pixels[i + 3] : 255;
  if (alpha > 128) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    n++;
  }
}
const hex = (v) => Math.round(v / n).toString(16).padStart(2, "0");
console.log(
  JSON.stringify({
    width,
    height,
    colorType,
    opaquePixels: n,
    avgColor: `#${hex(r)}${hex(g)}${hex(b)}`,
    brightness: Math.round((r + g + b) / (3 * n)),
  }),
);
