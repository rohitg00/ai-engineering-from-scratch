'use strict';

const zlib = require('node:zlib');
const { normalizeWhitespace } = require('./lesson-document');

const WIDTH = 1200;
const HEIGHT = 630;
const LEFT = 64;
const RIGHT = 1136;
const LEVELS = 15;
const COLORS = {
  paper: [250, 250, 245],
  ink: [26, 26, 26],
  mute: [122, 122, 120],
  blue: [53, 83, 255],
  frame: [227, 227, 223],
  dot: [160, 160, 156],
};
const DOMAIN = 'aiengineeringfromscratch.com';
const REPO = 'github.com/rohitg00/ai-engineering-from-scratch';
const LAYERS = ['Agents', 'LLM', 'DL', 'Math'];
const DISPLAY_SIZES = [124, 104, 88, 74];
const DISPLAY_TRACKING = 0.02;
const LABEL_SIZE = 24;
const LABEL_TRACKING = LABEL_SIZE * 0.14;
const FOOT_SIZE = 20;
const FOOT_TRACKING = FOOT_SIZE * 0.04;
const BODY_SIZE = 30;
const BODY_GAP = 70;
const BLOCK_TOP = 118;
const BLOCK_HEIGHT = 352;
const RULE_Y = 500;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const RULE_CUTOFFS = [1, 1, 3, 3, 3, 1, 1, 2, 3, 3, 1, 1, 1, 3, 3, 2].map(shade => [0, 3, 6, 10][shade]);
const SPELLED = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'θ': 'theta',
  'λ': 'lambda', 'μ': 'mu', 'π': 'pi', 'σ': 'sigma', 'τ': 'tau', 'φ': 'phi', 'ω': 'omega',
  'Σ': 'Sigma', 'Δ': 'Delta', 'Ω': 'Omega', '∇': 'nabla', '∈': 'in', '∼': '~', '∏': 'prod',
  '→': '->', '←': '<-', '↔': '<->', '≈': '~', '≤': '<=', '≥': '>=', '≠': '!=', '√': 'sqrt', '∞': 'infinity',
};

const faces = new Map();

/** Load and cache an inflated font atlas at the requested pixel size; throw if unavailable. */
function face(name, size) {
  const key = `${name}:${size}`;
  if (!faces.has(key)) {
    const data = require(`./og-fonts/${name}.json`).sizes[size];
    if (!data) throw new Error(`No ${name} atlas at ${size}px`);
    faces.set(key, { ...data, size, bitmap: zlib.inflateSync(Buffer.from(data.bitmap, 'base64')) });
  }
  return faces.get(key);
}

/** Return the baseline spacing in pixels for display text at this font size. */
function pitch(font) {
  return Math.round(font.size * 0.87);
}

/** Normalize text to supported glyphs, trying symbol spellings and decomposed characters. */
function glyphText(font, text, upper) {
  const out = [];
  for (const ch of normalizeWhitespace(text)) {
    for (const option of [ch, SPELLED[ch] || '', ch.normalize('NFKD').replace(/\p{M}/gu, '')]) {
      const value = upper ? option.toLocaleUpperCase('en-US') : option;
      if (value && Array.from(value).every(c => font.glyphs[c])) {
        out.push(value);
        break;
      }
    }
  }
  return normalizeWhitespace(out.join(''));
}

/** Measure supported text in pixels using glyph advances, kerning, and tracking. */
function measure(font, text, tracking = 0) {
  const chars = Array.from(text);
  return chars.reduce((width, ch, index) => width + font.glyphs[ch][0] + (font.kern[ch + (chars[index + 1] || '')] || 0) + (index < chars.length - 1 ? tracking : 0), 0);
}

/** Fit text to a pixel width, trimming words and then characters with an ellipsis. */
function fitLine(font, text, width, tracking = 0) {
  if (measure(font, text, tracking) <= width) return text;
  const words = text.split(' ');
  while (words.length > 1) {
    words.pop();
    const candidate = words.join(' ').replace(/[\s,;:.·—–-]+$/, '') + '…';
    if (measure(font, candidate, tracking) <= width) return candidate;
  }
  const chars = Array.from(text);
  while (chars.length && measure(font, chars.join('') + '…', tracking) > width) chars.pop();
  return chars.join('') + '…';
}

/** Fit a display path by eliding middle segments, then middle characters. */
function fitPath(font, text, width, tracking) {
  if (measure(font, text, tracking) <= width) return text;
  const parts = text.split('/');
  for (let keep = parts.length - 2; keep >= 2; keep--) {
    const candidate = parts.slice(0, keep).concat('…', parts[parts.length - 1]).join('/');
    if (measure(font, candidate, tracking) <= width) return candidate;
  }
  const chars = Array.from(text);
  for (let keep = chars.length - 1; keep > 1; keep--) {
    const head = Math.ceil(keep * 0.45);
    const candidate = chars.slice(0, head).join('') + '…' + chars.slice(chars.length - keep + head).join('');
    if (measure(font, candidate, tracking) <= width) return candidate;
  }
  return '…';
}

/** Fit a description on one line, preferring complete sentences when they fill enough space. */
function oneLine(font, text, width) {
  if (measure(font, text) <= width) return text;
  let line = '';
  for (const part of text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [text]) {
    const next = (line + part).trim();
    if (measure(font, next) > width) break;
    line = next;
  }
  return measure(font, line) >= width * 0.6 ? line : fitLine(font, text, width);
}

/** Wrap text at word boundaries to a pixel width, leaving oversized words intact. */
function wrap(font, text, width, tracking) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(font, next, tracking) <= width) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  return line ? lines.concat(line) : lines;
}

/** Narrow the wrapping width while preserving the original number of lines. */
function balance(font, text, width, tracking) {
  const count = wrap(font, text, width, tracking).length;
  let low = Math.max(...text.split(' ').map(word => measure(font, word, tracking)));
  let high = width;
  while (count > 1 && high - low > 2) {
    const middle = (low + high) / 2;
    if (wrap(font, text, middle, tracking).length === count) high = middle;
    else low = middle;
  }
  return wrap(font, text, high, tracking);
}

/** Split an oversized word into character groups that fit the requested pixel width. */
function splitWord(font, word, width, tracking) {
  const pieces = [];
  let piece = '';
  for (const ch of word) {
    if (piece && measure(font, piece + ch, tracking) > width) {
      pieces.push(piece);
      piece = '';
    }
    piece += ch;
  }
  return pieces.concat(piece);
}

/**
 * Choose the largest display font that fits the title within the supplied bounds.
 * Fall back to the smallest font, splitting long words and truncating excess lines.
 */
function layoutTitle(text, width, maxLines, maxHeight) {
  for (const size of DISPLAY_SIZES) {
    const font = face('display', size);
    const tracking = size * DISPLAY_TRACKING;
    const value = glyphText(font, text, true);
    if (value.split(' ').some(word => measure(font, word, tracking) > width)) continue;
    const lines = balance(font, value, width, tracking);
    if (lines.length <= maxLines && font.capHeight + (lines.length - 1) * pitch(font) <= maxHeight) return { font, tracking, lines };
  }
  const font = face('display', DISPLAY_SIZES[DISPLAY_SIZES.length - 1]);
  const tracking = font.size * DISPLAY_TRACKING;
  const words = glyphText(font, text, true).split(' ').flatMap(word => splitWord(font, word, width, tracking));
  const lines = wrap(font, words.join(' '), width, tracking);
  if (lines.length > maxLines) lines.splice(maxLines - 1, lines.length, fitLine(font, lines.slice(maxLines - 1).join(' '), width, tracking));
  return { font, tracking, lines };
}

/** Fit the label and optional metadata into the shared header width without overlap. */
function layoutHeader(label, meta) {
  const font = face('mono', LABEL_SIZE);
  const left = glyphText(font, label, true);
  const room = RIGHT - LEFT - Math.min(measure(font, left, LABEL_TRACKING), RIGHT - LEFT) - 48;
  const right = meta && room >= 120 ? fitLine(font, glyphText(font, meta, true), room, LABEL_TRACKING) : '';
  return { right, left: fitLine(font, left, RIGHT - LEFT - (right ? measure(font, right, LABEL_TRACKING) + 48 : 0), LABEL_TRACKING) };
}

/** Lay out home card copy, inventory counts, and header within their allotted widths. */
function layoutHome(spec) {
  const serif = face('serif', BODY_SIZE);
  return {
    header: layoutHeader(spec.label, spec.meta),
    title: layoutTitle(spec.title, 760, 2, 200),
    body: balance(serif, glyphText(serif, spec.description, false), 740, 0).slice(0, 3),
    stats: fitLine(face('mono', LABEL_SIZE), glyphText(face('mono', LABEL_SIZE), spec.stats.join(' · '), true), RIGHT - LEFT, LABEL_TRACKING),
  };
}

/** Lay out a page card header, title, one-line description, and footer path. */
function layoutPage(spec) {
  const serif = face('serif', BODY_SIZE);
  const small = face('mono', FOOT_SIZE);
  const description = oneLine(serif, glyphText(serif, spec.description, false), RIGHT - LEFT);
  return {
    header: layoutHeader(spec.label, spec.meta),
    title: layoutTitle(spec.title, RIGHT - LEFT, 3, BLOCK_HEIGHT - (description ? BODY_GAP : 0)),
    description,
    path: fitPath(small, glyphText(small, spec.path, false), RIGHT - LEFT - measure(small, DOMAIN, FOOT_TRACKING) - FOOT_TRACKING, FOOT_TRACKING),
  };
}

/** Return the home or page text layout for a card specification. */
function layout(spec) {
  return spec.kind === 'home' ? layoutHome(spec) : layoutPage(spec);
}

/** Allocate a 1200x630 RGB byte array filled with the paper background color. */
function createCanvas() {
  const canvas = new Uint8Array(WIDTH * HEIGHT * 3);
  canvas.set(COLORS.paper);
  for (let filled = 3; filled < canvas.length; filled *= 2) canvas.copyWithin(filled, 0, Math.min(filled, canvas.length - filled));
  return canvas;
}

/** Blend one in-bounds pixel toward an RGB color using a coverage level from 0 to LEVELS. */
function blend(canvas, x, y, color, level) {
  if (level <= 0 || x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const index = (y * WIDTH + x) * 3;
  for (let channel = 0; channel < 3; channel++) {
    canvas[index + channel] = Math.round(canvas[index + channel] + (color[channel] - canvas[index + channel]) * level / LEVELS);
  }
}

/** Paint an integer-aligned rectangle onto the canvas at full coverage. */
function fillRect(canvas, x, y, width, height, color) {
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) blend(canvas, column, row, color, LEVELS);
}

/**
 * Draw supported glyphs at a baseline using atlas phases, kerning, and tracking.
 * @returns {number} The horizontal end position excluding trailing tracking.
 */
function drawText(canvas, font, text, x, y, color, tracking = 0) {
  const chars = Array.from(text);
  let pen = x;
  chars.forEach((ch, index) => {
    const glyph = font.glyphs[ch];
    const whole = Math.floor(pen);
    const step = Math.round((pen - whole) * font.phases);
    const phase = step % font.phases;
    const [gx, gy, width, height, offset] = glyph.slice(1 + phase * 5, 6 + phase * 5);
    const left = whole + (step === font.phases ? 1 : 0) + gx;
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) blend(canvas, left + column, y + gy + row, color, font.bitmap[offset + row * width + column]);
    }
    pen += glyph[0] + (font.kern[ch + (chars[index + 1] || '')] || 0) + tracking;
  });
  return pen - tracking;
}

/** Draw text in two colors split at the first middle-dot separator and return its end. */
function drawSegments(canvas, font, text, x, y, colors, tracking) {
  const split = text.indexOf(' · ');
  if (split < 0) return drawText(canvas, font, text, x, y, colors[0], tracking);
  const end = drawText(canvas, font, text.slice(0, split), x, y, colors[0], tracking);
  return drawText(canvas, font, text.slice(split), end + tracking, y, colors[1], tracking);
}

/** Paint the left label and optional right-aligned metadata at the header baseline. */
function drawHeader(canvas, { left, right }) {
  const font = face('mono', LABEL_SIZE);
  drawSegments(canvas, font, left, LEFT, 82, [COLORS.blue, COLORS.mute], LABEL_TRACKING);
  if (right) drawText(canvas, font, right, RIGHT - measure(font, right, LABEL_TRACKING), 82, COLORS.mute, LABEL_TRACKING);
}

/** Paint laid-out title lines from the supplied baseline with display line spacing. */
function drawTitle(canvas, { font, tracking, lines }, baseline) {
  lines.forEach((line, index) => drawText(canvas, font, line, LEFT, baseline + index * pitch(font), COLORS.blue, tracking));
}

/** Paint the decorative horizontal rule using repeating Bayer coverage patterns. */
function ditherRule(canvas) {
  for (let cell = 0; LEFT + cell * 13 + 11 <= RIGHT; cell++) {
    const cutoff = RULE_CUTOFFS[cell % RULE_CUTOFFS.length];
    for (let dy = 0; dy < 14; dy++) {
      for (let dx = 0; dx < 11; dx++) if (BAYER[(dy % 4) * 4 + (dx % 4)] < cutoff) blend(canvas, LEFT + cell * 13 + dx, RULE_Y + dy, COLORS.dot, LEVELS);
    }
  }
}

/** Paint the one-pixel inset border around the card. */
function frame(canvas) {
  fillRect(canvas, 28, 28, WIDTH - 56, 1, COLORS.frame);
  fillRect(canvas, 28, HEIGHT - 29, WIDTH - 56, 1, COLORS.frame);
  fillRect(canvas, 28, 28, 1, HEIGHT - 56, COLORS.frame);
  fillRect(canvas, WIDTH - 29, 28, 1, HEIGHT - 56, COLORS.frame);
}

/** Fill a polygon using 4x4 subpixel coverage samples blended at the requested level. */
function fillPolygon(canvas, points, color, level = LEVELS) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(WIDTH - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(HEIGHT - 1, Math.ceil(Math.max(...ys)));
  const span = x1 - x0 + 1;
  const coverage = new Uint8Array(span * (y1 - y0 + 1));
  for (let sample = y0 * 4; sample < (y1 + 1) * 4; sample++) {
    const sy = (sample + 0.5) / 4;
    const cuts = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      if ((point[1] <= sy) !== (next[1] <= sy)) cuts.push(point[0] + (sy - point[1]) * (next[0] - point[0]) / (next[1] - point[1]));
    });
    cuts.sort((a, b) => a - b);
    for (let index = 0; index + 1 < cuts.length; index += 2) {
      const end = Math.min((x1 + 1) * 4, Math.ceil(cuts[index + 1] * 4 - 0.5));
      for (let sx = Math.max(x0 * 4, Math.ceil(cuts[index] * 4 - 0.5)); sx < end; sx++) coverage[(Math.floor(sample / 4) - y0) * span + (sx >> 2) - x0]++;
    }
  }
  coverage.forEach((count, index) => {
    if (count) blend(canvas, x0 + index % span, y0 + Math.floor(index / span), color, Math.round(count * level / 16));
  });
}

/** Paint a line of the requested width as a filled quadrilateral. */
function strokeLine(canvas, from, to, width, color) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const nx = (from[1] - to[1]) / length * width / 2;
  const ny = (to[0] - from[0]) / length * width / 2;
  fillPolygon(canvas, [[from[0] + nx, from[1] + ny], [to[0] + nx, to[1] + ny], [to[0] - nx, to[1] - ny], [from[0] - nx, from[1] - ny]], color);
}

/** Paint the labeled Math, DL, LLM, and Agents layer illustration on the home card. */
function drawStack(canvas) {
  const font = face('mono', FOOT_SIZE);
  LAYERS.forEach((name, index) => {
    const x = 866 - index * 10;
    const y = 186 + index * 40;
    const plane = [[x + 30, y], [x + 88, y], [x + 120, y + 30], [x + 62, y + 30]];
    fillPolygon(canvas, plane, COLORS.blue, Math.round(LEVELS * (0.06 + index * 0.05)));
    plane.forEach((point, corner) => strokeLine(canvas, point, plane[(corner + 1) % 4], 1.5, COLORS.blue));
    for (let dash = 0; dash < 44; dash += 6) strokeLine(canvas, [x + 124 + dash, y + 15 - dash * 0.18], [x + 127 + dash, y + 15 - (dash + 3) * 0.18], 1.4, COLORS.blue);
    drawText(canvas, font, glyphText(font, name, true), x + 174, y + 14, COLORS.blue, FOOT_SIZE * 0.12);
  });
}

/** Paint the home layout, stack illustration, statistics, and site/repository footer. */
function drawHome(canvas, card) {
  drawHeader(canvas, card.header);
  drawTitle(canvas, card.title, 228);
  const serif = face('serif', BODY_SIZE);
  card.body.forEach((line, index) => drawText(canvas, serif, line, LEFT, 400 + index * 38, COLORS.ink));
  drawStack(canvas);
  ditherRule(canvas);
  drawSegments(canvas, face('mono', LABEL_SIZE), card.stats, LEFT, 551, [COLORS.blue, COLORS.ink], LABEL_TRACKING);
  const small = face('mono', FOOT_SIZE);
  drawText(canvas, small, DOMAIN, LEFT, 582, COLORS.blue, FOOT_TRACKING);
  drawText(canvas, small, REPO, RIGHT - measure(small, REPO, FOOT_TRACKING), 582, COLORS.mute, FOOT_TRACKING);
}

/** Paint a page layout with a vertically centered text block and a path footer. */
function drawPage(canvas, card) {
  drawHeader(canvas, card.header);
  const { font, lines } = card.title;
  const cap = Math.round(font.capHeight);
  const block = cap + (lines.length - 1) * pitch(font) + (card.description ? BODY_GAP : 0);
  const baseline = Math.round(BLOCK_TOP + Math.max(0, (BLOCK_HEIGHT - block) / 2)) + cap;
  drawTitle(canvas, card.title, baseline);
  if (card.description) drawText(canvas, face('serif', BODY_SIZE), card.description, LEFT, baseline + (lines.length - 1) * pitch(font) + BODY_GAP, COLORS.ink);
  ditherRule(canvas);
  const small = face('mono', FOOT_SIZE);
  const end = drawText(canvas, small, DOMAIN, LEFT, 574, COLORS.blue, FOOT_TRACKING);
  drawText(canvas, small, card.path, end + FOOT_TRACKING, 574, COLORS.mute, FOOT_TRACKING);
}

/** Render a card specification into a framed 1200x630 RGB byte array. */
function renderPixels(spec) {
  const canvas = createCanvas();
  frame(canvas);
  if (spec.kind === 'home') drawHome(canvas, layout(spec));
  else drawPage(canvas, layout(spec));
  return canvas;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** Compute the unsigned CRC-32 checksum used by PNG chunks. */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Encode a PNG chunk with its length, four-character type, payload, and CRC-32. */
function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, body.length + 8)), body.length + 8);
  return out;
}

/**
 * Encode the RGB canvas as a lossless 1200x630 indexed-color PNG buffer.
 * @throws {Error} If the canvas requires more than 256 palette colors.
 */
function encodePng(canvas) {
  const palette = new Map();
  const rows = Buffer.alloc((WIDTH + 1) * HEIGHT);
  for (let y = 0, at = 0, out = 0; y < HEIGHT; y++) {
    out++;
    for (let x = 0; x < WIDTH; x++, at += 3) {
      const key = canvas[at] << 16 | canvas[at + 1] << 8 | canvas[at + 2];
      let index = palette.get(key);
      if (index === undefined) palette.set(key, index = palette.size);
      rows[out++] = index;
    }
  }
  if (palette.size > 256) throw new Error(`Card needs ${palette.size} colors; a palette PNG holds 256`);
  const header = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 8, 3, 0, 0, 0]);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('PLTE', Buffer.from([...palette.keys()].flatMap(key => [key >> 16, key >> 8 & 255, key & 255]))),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Render a card specification into a deterministic 1200x630 palette PNG buffer. */
function renderCard(spec) {
  return encodePng(renderPixels(spec));
}

module.exports = { LEVELS, layout, renderCard, renderPixels };
