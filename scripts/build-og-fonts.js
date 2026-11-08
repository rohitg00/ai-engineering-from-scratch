#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.join(__dirname, '..', 'lib', 'og-fonts');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:opsz,wght@8..60,400&family=JetBrains+Mono:wght@500&display=block';
const { LEVELS } = require('../lib/og-render');
const ASCII = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)).join('');
const LATIN1 = Array.from({ length: 96 }, (_, index) => String.fromCharCode(0xa0 + index)).join('');
const EXTRA = '\u2014\u2013\u2026\u2018\u2019\u201c\u201d\u2192\u2190\u2194\u20ac\u2022\u2248\u2264\u2265\u2260\u2212\u221a\u221e\u0178';
const LATIN = ASCII + LATIN1 + EXTRA;
const UPPER = Array.from(new Set(Array.from(LATIN).filter(ch => ch === ch.toLocaleUpperCase('en-US')))).join('');
const FONTS = [
  { name: 'display', family: 'VT323', weight: 400, sizes: [124, 104, 88, 74], phases: 1, chars: UPPER },
  { name: 'mono', family: 'JetBrains Mono', weight: 500, sizes: [24, 20], phases: 2, chars: LATIN },
  { name: 'serif', family: 'Source Serif 4', weight: 400, sizes: [30], phases: 3, chars: LATIN, kern: true },
];

function pageSource() {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONT_CSS}"></head><body><script>
const FONTS = ${JSON.stringify(FONTS)};
const LEVELS = ${LEVELS};
function css(font, size, fallback) { return font.weight + ' ' + size + 'px "' + font.family + '", ' + fallback; }
function raster(ctx, cell, text, x, y) {
  ctx.clearRect(0, 0, cell, cell);
  ctx.fillText(text, x, y);
  const data = ctx.getImageData(0, 0, cell, cell).data;
  let x0 = cell, y0 = cell, x1 = -1, y1 = -1;
  for (let py = 0; py < cell; py++) for (let px = 0; px < cell; px++) {
    if (data[(py * cell + px) * 4 + 3] === 0) continue;
    if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
  if (x1 < 0) return { x: 0, y: 0, w: 0, h: 0, levels: [] };
  const levels = [];
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) levels.push(Math.round(data[(py * cell + px) * 4 + 3] * LEVELS / 255));
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, levels };
}
function same(a, b) { return a.w === b.w && a.h === b.h && a.x === b.x && a.y === b.y && a.levels.join() === b.levels.join(); }
async function run() {
  for (const font of FONTS) for (const size of font.sizes) await document.fonts.load(css(font, size, 'serif'), font.chars);
  await document.fonts.ready;
  const result = [];
  for (const font of FONTS) {
    if (!document.fonts.check(css(font, 20, 'serif'))) throw new Error('font did not load: ' + font.family);
    const sizes = {};
    for (const size of font.sizes) {
      const cell = Math.ceil(size * 2.2);
      const pad = Math.round(size * 0.5);
      const base = Math.round(size * 1.4);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = cell;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      ctx.font = css(font, size, 'serif');
      const metrics = ctx.measureText('H');
      const glyphs = {};
      const bytes = [];
      const missing = [];
      for (const ch of font.chars) {
        ctx.font = css(font, size, 'monospace');
        const mono = raster(ctx, cell, ch, pad, base);
        const monoWidth = ctx.measureText(ch).width;
        ctx.font = css(font, size, 'serif');
        const serif = raster(ctx, cell, ch, pad, base);
        if (!same(mono, serif) || monoWidth !== ctx.measureText(ch).width) { missing.push(ch); continue; }
        const record = [Math.round(ctx.measureText(ch).width * 64) / 64];
        for (let phase = 0; phase < font.phases; phase++) {
          const glyph = phase ? raster(ctx, cell, ch, pad + phase / font.phases, base) : serif;
          record.push(glyph.x - pad, glyph.y - base, glyph.w, glyph.h, bytes.length);
          for (const level of glyph.levels) bytes.push(level);
        }
        glyphs[ch] = record;
      }
      const kern = {};
      if (font.kern) {
        ctx.font = css(font, size, 'serif');
        const keys = Object.keys(glyphs).filter(ch => /[A-Za-z0-9.,;:'"\\-]/.test(ch));
        for (const a of keys) for (const b of keys) {
          const delta = ctx.measureText(a + b).width - ctx.measureText(a).width - ctx.measureText(b).width;
          if (Math.abs(delta) >= 0.1) kern[a + b] = Math.round(delta * 16) / 16;
        }
      }
      sizes[size] = {
        capHeight: Math.round(metrics.actualBoundingBoxAscent * 100) / 100,
        phases: font.phases,
        glyphs,
        kern,
        missing: missing.join(''),
        bitmap: btoa(bytes.map(level => String.fromCharCode(level)).join('')),
      };
    }
    result.push({ name: font.name, family: font.family, sizes });
  }
  return result;
}
run().then(r => JSON.stringify(r), e => 'ERROR ' + e.message).then(body => fetch('/', { method: 'POST', body }));
</script></body></html>`;
}

function rasterize() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-og-fonts-'));
  let chrome;
  let timer;
  const server = http.createServer();
  const done = new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pageSource());
        return;
      }
      const chunks = [];
      req.on('data', part => chunks.push(part));
      req.on('end', () => {
        res.end();
        const text = Buffer.concat(chunks).toString('utf8');
        if (text.startsWith('ERROR')) reject(new Error(text));
        else resolve(JSON.parse(text));
      });
    });
    timer = setTimeout(() => reject(new Error('Chrome did not report glyphs within 120 seconds')), 120000);
    server.listen(0, '127.0.0.1', () => {
      chrome = childProcess.spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--user-data-dir=${dir}`, `http://127.0.0.1:${server.address().port}/`,
      ], { stdio: 'ignore' });
      chrome.on('error', reject);
    });
  });
  return done.finally(async () => {
    clearTimeout(timer);
    server.closeAllConnections();
    server.close();
    if (chrome && chrome.exitCode === null) {
      const exited = new Promise(resolve => chrome.once('exit', resolve));
      chrome.kill();
      await exited;
    }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const font of await rasterize()) {
    for (const size of Object.values(font.sizes)) {
      if (size.missing) console.log(`${font.family}: no glyph for ${JSON.stringify(size.missing)}`);
      delete size.missing;
      size.bitmap = zlib.deflateSync(Buffer.from(size.bitmap, 'base64'), { level: 9 }).toString('base64');
    }
    const file = path.join(OUT, `${font.name}.json`);
    fs.writeFileSync(file, JSON.stringify({ sizes: font.sizes }) + '\n');
    console.log(`${path.relative(process.cwd(), file)}: ${fs.statSync(file).size} bytes`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
