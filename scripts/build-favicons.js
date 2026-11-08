const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SITE = path.join(__dirname, '..', 'site');
const BLUE = [0x35, 0x53, 0xff];
const CREAM = [0xfa, 0xfa, 0xf5];
const GLYPHS = [
  { x: 4, rows: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'] },
  { x: 9, rows: ['###', '.#.', '.#.', '.#.', '.#.', '###'] },
];
const TOP = 5;

function grid() {
  const cells = Array.from({ length: 16 }, () => Array(16).fill(false));
  for (let i = 1; i <= 14; i++) {
    cells[1][i] = cells[14][i] = cells[i][1] = cells[i][14] = true;
  }
  for (const glyph of GLYPHS) {
    glyph.rows.forEach((row, dy) => [...row].forEach((mark, dx) => {
      if (mark === '#') cells[TOP + dy][glyph.x + dx] = true;
    }));
  }
  return cells;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, scale, margin) {
  const cells = grid();
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - margin) / scale);
      const gy = Math.floor((y - margin) / scale);
      const inside = gx >= 0 && gy >= 0 && gx < 16 && gy < 16;
      const color = inside && cells[gy][gx] ? BLUE : CREAM;
      row.set(color, 1 + x * 3);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(24, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(image => image.data)]);
}

function svg() {
  const hex = color => '#' + color.map(value => value.toString(16).padStart(2, '0')).join('');
  const runs = [];
  grid().forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      if (!row[x]) { x++; continue; }
      const start = x;
      while (x < 16 && row[x]) x++;
      runs.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="${hex(CREAM)}"/><path fill="${hex(BLUE)}" d="${runs.join('')}"/></svg>\n`;
}

function build(site = SITE) {
  const sizes = [16, 32, 48].map(size => ({ size, data: png(size, size / 16, 0) }));
  fs.writeFileSync(path.join(site, 'favicon.ico'), ico(sizes));
  fs.writeFileSync(path.join(site, 'favicon.svg'), svg());
  fs.writeFileSync(path.join(site, 'apple-touch-icon.png'), png(180, 11, 2));
}

if (require.main === module) {
  build();
  console.log('wrote site/favicon.ico (16, 32, 48), site/favicon.svg, site/apple-touch-icon.png (180)');
}

module.exports = { build, png, ico, svg };
