// THE WORLD TODAY — Thursday 19 November 2026.
// A newspaper front page drawn from scratch in Node 22 with the standard
// library only. It decodes four news panels, sets the page under a bold
// masthead, and writes a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png
// (default ./out). Same input bytes in, same output bytes out: no clock,
// no randomness, no network.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------------------------------------------------ page setup
type Trio = [number, number, number];

const PAGE_W = 1024;
const PAGE_H = 1024;
const EDGE = 30; // side margin
const SPAN = PAGE_W - EDGE * 2; // content width

const PAPER: Trio = [246, 241, 227];
const INK: Trio = [17, 17, 17];
const SCARLET: Trio = [179, 38, 30];
const SNOW: Trio = [255, 255, 255];

// ------------------------------------------------------- tiny bitmap face
// My own 5-by-7 face. Each glyph is seven rows; each row holds five bits,
// bit 4 (16) is the leftmost column and bit 0 (1) the rightmost.
type Glyph = number[];
const FACE: Record<string, Glyph> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x0e, 0x10, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "*": [0, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
};
const GLYPH_W = 5;
const GLYPH_H = 7;

// ------------------------------------------------------------------ PNG codec
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

interface Photo {
  w: number;
  h: number;
  rgb: Buffer; // 3 bytes per pixel, row-major
}

function readPhoto(path: string): Photo {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error(`not a PNG: ${path}`);
  }
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let color = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      color = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG: ${path}`);
  const channels = color === 2 ? 3 : color === 6 ? 4 : color === 0 ? 1 : 0;
  if (channels === 0) throw new Error(`unsupported color type ${color}: ${path}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const rgb = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) v = (v + paeth(a, b, c)) & 255;
      else if (f !== 0) throw new Error(`bad PNG filter ${f}`);
      cur[x] = v;
    }
    for (let px = 0; px < w; px++) {
      const s = px * channels;
      const d = (y * w + px) * 3;
      if (channels === 1) {
        rgb[d] = cur[s];
        rgb[d + 1] = cur[s];
        rgb[d + 2] = cur[s];
      } else {
        rgb[d] = cur[s];
        rgb[d + 1] = cur[s + 1];
        rgb[d + 2] = cur[s + 2];
      }
    }
    prev = cur;
  }
  return { w, h, rgb };
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  return Buffer.concat([head, data, tail]);
}

function writePng(w: number, h: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = rgb.subarray(y * stride, (y + 1) * stride);
    let bestF = 0;
    let bestScore = Infinity;
    let bestRow: Buffer | null = null;
    for (let f = 0; f <= 4; f++) {
      const out = Buffer.alloc(stride);
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 3 ? row[x - 3] : 0;
        const b = prev[x];
        const c = x >= 3 ? prev[x - 3] : 0;
        let pred = 0;
        if (f === 1) pred = a;
        else if (f === 2) pred = b;
        else if (f === 3) pred = (a + b) >> 1;
        else if (f === 4) pred = paeth(a, b, c);
        const d = (row[x] - pred) & 255;
        out[x] = d;
        score += Math.abs(d >= 128 ? d - 256 : d);
      }
      if (score < bestScore) {
        bestScore = score;
        bestF = f;
        bestRow = out;
      }
    }
    raw[y * (stride + 1)] = bestF;
    (bestRow as Buffer).copy(raw, y * (stride + 1) + 1);
    prev = Buffer.from(row);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------------- sheet
class Sheet {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer;
  constructor(w: number, h: number, base: Trio) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = base[0];
      this.px[i * 3 + 1] = base[1];
      this.px[i * 3 + 2] = base[2];
    }
  }
  dot(x: number, y: number, c: Trio): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
  }
  block(x: number, y: number, w: number, h: number, c: Trio): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.dot(xx, yy, c);
    }
  }
  frame(x: number, y: number, w: number, h: number, t: number, c: Trio): void {
    this.block(x, y, w, t, c);
    this.block(x, y + h - t, w, t, c);
    this.block(x, y, t, h, c);
    this.block(x + w - t, y, t, h, c);
  }
}

// ---------------------------------------------------------------------- text
function glyphFor(ch: string): Glyph {
  return FACE[ch.toUpperCase()] ?? FACE["?"];
}

function textWidth(text: string, scale: number, gap: number): number {
  if (text.length === 0) return 0;
  return text.length * (GLYPH_W * scale + gap) - gap;
}

function drawText(
  sheet: Sheet,
  text: string,
  x: number,
  y: number,
  scale: number,
  gap: number,
  weight: number,
  color: Trio,
): void {
  let cx = x;
  for (const ch of text) {
    const g = glyphFor(ch);
    for (let r = 0; r < GLYPH_H; r++) {
      const bits = g[r];
      for (let col = 0; col < GLYPH_W; col++) {
        if ((bits >> (GLYPH_W - 1 - col)) & 1) {
          sheet.block(cx + col * scale, y + r * scale, scale, scale, color);
          if (weight > 0) {
            sheet.block(cx + col * scale + weight, y + r * scale, scale, scale, color);
          }
        }
      }
    }
    cx += GLYPH_W * scale + gap;
  }
}

function wrapLines(text: string, maxW: number, scale: number, gap: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (textWidth(trial, scale, gap) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// --------------------------------------------------------------------- photo
function paintPhoto(
  sheet: Sheet,
  photo: Photo,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  focusY: number,
): void {
  const srcAspect = photo.w / photo.h;
  const dstAspect = dw / dh;
  let sw: number;
  let sh: number;
  let ox: number;
  let oy: number;
  if (srcAspect > dstAspect) {
    sh = photo.h;
    sw = sh * dstAspect;
    ox = (photo.w - sw) / 2;
    oy = 0;
  } else {
    sw = photo.w;
    sh = sw / dstAspect;
    ox = 0;
    oy = (photo.h - sh) * focusY;
  }
  for (let y = 0; y < dh; y++) {
    const sy = oy + ((y + 0.5) * sh) / dh - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(photo.h - 1, y0 + 1);
    const fy = Math.min(1, Math.max(0, sy - y0));
    for (let x = 0; x < dw; x++) {
      const sx = ox + ((x + 0.5) * sw) / dw - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(photo.w - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      const o = ((dy + y) * sheet.w + dx + x) * 3;
      for (let c = 0; c < 3; c++) {
        const tl = photo.rgb[(y0 * photo.w + x0) * 3 + c];
        const tr = photo.rgb[(y0 * photo.w + x1) * 3 + c];
        const bl = photo.rgb[(y1 * photo.w + x0) * 3 + c];
        const br = photo.rgb[(y1 * photo.w + x1) * 3 + c];
        const top = tl + (tr - tl) * fx;
        const bot = bl + (br - bl) * fx;
        sheet.px[o + c] = Math.round(top + (bot - top) * fy);
      }
    }
  }
}

// -------------------------------------------------------------------- layout
interface Story {
  file: string;
  tag: string;
  focus: number;
  head: string;
  deck: string;
}

function buildPage(root: string): Sheet {
  const sheet = new Sheet(PAGE_W, PAGE_H, PAPER);
  sheet.frame(0, 0, PAGE_W, PAGE_H, 6, INK);
  sheet.frame(14, 14, PAGE_W - 28, PAGE_H - 28, 2, INK);

  // Masthead and dateline.
  const mast = "THE WORLD TODAY";
  const mastX = Math.round((PAGE_W - textWidth(mast, 9, 4)) / 2);
  drawText(sheet, mast, mastX, 24, 9, 4, 2, INK);
  sheet.block(EDGE, 98, SPAN, 3, INK);
  const date = "THURSDAY, 19 NOVEMBER 2026";
  const dateX = Math.round((PAGE_W - textWidth(date, 3, 2)) / 2);
  drawText(sheet, date, dateX, 108, 3, 2, 1, INK);
  sheet.block(EDGE, 138, SPAN, 2, INK);

  // Lead story: the Shenzhen summit, full width.
  const summit = readPhoto(join(root, "panels", "summit.png"));
  paintPhoto(sheet, summit, EDGE, 148, SPAN, 304, 0.6);
  sheet.frame(EDGE, 148, SPAN, 304, 2, INK);
  sheet.block(EDGE, 464, 12, 12, SCARLET);
  drawText(sheet, "DIPLOMACY - SHENZHEN, CHINA", EDGE + 20, 462, 3, 2, 1, SCARLET);
  const headLines = [
    "TRUMP, XI, PUTIN MEET IN SHENZHEN - FIRST",
    "THREE-WAY SUMMIT OF US, CHINA, RUSSIA -",
    "NUCLEAR ARMS AND IRAN WAR ON THE TABLE",
  ];
  headLines.forEach((ln, i) => drawText(sheet, ln, EDGE, 492 + i * 32, 4, 2, 1, INK));
  sheet.block(EDGE, 596, SPAN, 2, INK);

  // Three stories side by side.
  const colW = 310;
  const colX = [31, 357, 683];
  const stories: Story[] = [
    {
      file: "gta.png",
      tag: "CULTURE",
      focus: 0.55,
      head: "GTA VI IS HERE",
      deck: "AFTER 13 YEARS, ROCKSTAR'S SEQUEL IS OUT TODAY",
    },
    {
      file: "voyager.png",
      tag: "SCIENCE",
      focus: 0.5,
      head: "VOYAGER 1 REACHES ONE LIGHT-DAY",
      deck: "NASA CONFIRMS THE PROBE IS 16 BILLION MILES OUT",
    },
    {
      file: "icj.png",
      tag: "JUSTICE - THE HAGUE",
      focus: 0.45,
      head: "WORLD COURT RULES ON ROHINGYA CASE",
      deck: "GENOCIDE VERDICT, SEVEN YEARS AFTER THE CASE",
    },
  ];
  stories.forEach((s, i) => {
    const x = colX[i];
    const photo = readPhoto(join(root, "panels", s.file));
    paintPhoto(sheet, photo, x, 608, colW, 130, s.focus);
    sheet.frame(x, 608, colW, 130, 2, INK);
    sheet.block(x, 748, 10, 10, SCARLET);
    drawText(sheet, s.tag, x + 16, 746, 3, 1, 1, SCARLET);
    const hl = wrapLines(s.head, colW, 3, 2);
    hl.forEach((ln, j) => drawText(sheet, ln, x, 774 + j * 26, 3, 2, 1, INK));
    const dl = wrapLines(s.deck, colW, 2, 1);
    dl.forEach((ln, j) => drawText(sheet, ln, x, 832 + j * 18, 2, 1, 0, INK));
  });

  // Bottom ticker: black band, three rows, five items of the day.
  sheet.block(EDGE, 908, SPAN, 92, INK);
  const ticker = [
    "ALSO TODAY: CYCLONE AKVAN RED ALERT - GULF WAR GRINDS ON",
    "EU UKRAINE LOAN - JEFFRIES SET TO BE FIRST",
    "AFRICAN-AMERICAN SPEAKER - PELTOLA WINS ALASKA SENATE",
  ];
  ticker.forEach((ln, i) => drawText(sheet, ln, EDGE + 8, 916 + i * 29, 3, 1, 1, SNOW));
  return sheet;
}

// ---------------------------------------------------------------------- main
function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? join(here, "out");
  mkdirSync(outDir, { recursive: true });
  const sheet = buildPage(here);
  const png = writePng(sheet.w, sheet.h, sheet.px);
  const target = join(outDir, "entry.png");
  writeFileSync(target, png);
  console.log(`wrote ${target} (${png.length} bytes, ${sheet.w}x${sheet.h})`);
}

main();
