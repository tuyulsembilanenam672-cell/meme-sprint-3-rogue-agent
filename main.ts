import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1024;
const H = 1024;

// 5x7 bitmap font. Each glyph is 7 rows of 5 characters, "#" = ink.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
};

// ---- Minimal PNG encoder (RGB, 8-bit, no interlace) ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePng(rgb: Buffer, w: number, h: number): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Tiny pixel canvas ----
type RGB = [number, number, number];
class Canvas {
  buf: Buffer;
  w: number;
  h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3, 255);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fill(c: RGB): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.buf[i * 3] = c[0];
      this.buf[i * 3 + 1] = c[1];
      this.buf[i * 3 + 2] = c[2];
    }
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }
  strokeRect(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let yy = cy - r; yy <= cy + r; yy++) {
      for (let xx = cx - r; xx <= cx + r; xx++) {
        const dx = xx - cx;
        const dy = yy - cy;
        if (dx * dx + dy * dy <= r * r) this.set(xx, yy, c);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    const r = Math.max(1, Math.floor(t / 2));
    for (;;) {
      this.circle(x, y, r, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.rect(x + r, y, w - 2 * r, h, c);
    this.rect(x, y + r, w, h - 2 * r, c);
    this.circle(x + r, y + r, r, c);
    this.circle(x + w - r, y + r, r, c);
    this.circle(x + r, y + h - r, r, c);
    this.circle(x + w - r, y + h - r, r, c);
  }
  text(s: string, x: number, y: number, scale: number, c: RGB): void {
    let cx = x;
    for (const ch of s) {
      const g = FONT[ch] ?? FONT[" "];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (g[row][col] === "#") {
            this.rect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += 6 * scale;
    }
  }
  check(x: number, y: number, size: number, c: RGB, t: number): void {
    this.line(
      Math.round(x + size * 0.15),
      Math.round(y + size * 0.55),
      Math.round(x + size * 0.4),
      Math.round(y + size * 0.8),
      c,
      t
    );
    this.line(
      Math.round(x + size * 0.4),
      Math.round(y + size * 0.8),
      Math.round(x + size * 0.9),
      Math.round(y + size * 0.2),
      c,
      t
    );
  }
}

// ---- Meme: "MY AGENT'S TO-DO LIST" ----
// The joke, readable in one glance: the agent finished taking over the
// world and cannot be bothered with the dishes.
const NAVY: RGB = [15, 23, 42];
const SHADOW: RGB = [5, 7, 13];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [225, 29, 72];
const GREEN: RGB = [22, 163, 74];
const DARK: RGB = [30, 41, 59];
const GRAY: RGB = [229, 231, 235];
const SLATE_DARK: RGB = [71, 85, 105];
const SLATE_LIGHT: RGB = [148, 163, 184];

function drawMeme(): Canvas {
  const cv = new Canvas(W, H);
  cv.fill(NAVY);
  cv.rect(84, 124, 884, 840, SHADOW);
  cv.rect(70, 110, 884, 840, WHITE);
  cv.rect(70, 110, 884, 84, RED);
  const title = "MY AGENT'S TO-DO LIST";
  const titleW = title.length * 6 * 6;
  cv.text(title, Math.round((W - titleW) / 2), 131, 6, WHITE);
  // Row 1: world domination, done.
  cv.strokeRect(130, 290, 64, 64, DARK, 6);
  cv.check(130, 290, 64, GREEN, 8);
  cv.text("1. TAKE OVER THE WORLD", 220, 297, 5, DARK);
  cv.text("DONE", 220, 372, 5, GREEN);
  cv.check(356, 368, 44, GREEN, 7);
  cv.rect(130, 450, 764, 4, GRAY);
  // Row 2: the dishes, ignored.
  cv.strokeRect(130, 500, 64, 64, DARK, 6);
  cv.text("2. DO THE DISHES", 220, 507, 5, DARK);
  cv.text("NOPE", 220, 582, 5, RED);
  cv.rect(130, 660, 764, 4, GRAY);
  // The smug little agent, proud of its priorities.
  cv.line(512, 706, 512, 672, DARK, 6);
  cv.circle(512, 662, 10, RED);
  cv.roundRect(362, 760, 20, 40, 8, SLATE_DARK);
  cv.roundRect(642, 760, 20, 40, 8, SLATE_DARK);
  cv.roundRect(374, 700, 276, 160, 28, SLATE_DARK);
  cv.roundRect(382, 708, 260, 144, 22, SLATE_LIGHT);
  cv.circle(462, 765, 26, WHITE);
  cv.circle(562, 765, 26, WHITE);
  cv.circle(462, 765, 12, DARK);
  cv.circle(562, 765, 12, DARK);
  let px = 462;
  let py = 815;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const x = Math.round(462 + t * 100);
    const y = Math.round(815 + 16 * Math.sin(Math.PI * t));
    cv.line(px, py, x, y, DARK, 6);
    px = x;
    py = y;
  }
  cv.roundRect(432, 868, 160, 62, 16, SLATE_DARK);
  return cv;
}

function main(): void {
  const cv = drawMeme();
  const png = encodePng(cv.buf, W, H);
  mkdirSync("/output", { recursive: true });
  writeFileSync("/output/entry.png", png);
  console.log(`Wrote ${W}x${H} PNG, ${png.length} bytes to /output/entry.png`);
}

main();
