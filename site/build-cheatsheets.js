'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const markdown = require('./lesson-markdown');
const code = require('./lib/code');
const { phaseSlug } = require('../lib/hub-routes');
const { SITE_HEADER } = require('./build-hubs');
const { versionHtml } = require('./version-assets');
const topicMap = require('./cheatsheet-topics');
const evidenceCheck = require('./cheatsheet-evidence');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const REPO = 'https://github.com/rohitg00/ai-engineering-from-scratch';
const ISSUES_URL = `${REPO}/issues`;
const AUTHOR = 'Rohit Ghumare';
const LICENSE = 'MIT license';
const REPO_ROOT = path.resolve(__dirname, '..');
const TOPIC_DIR = 'cheatsheets';
const OUTPUT_DIR = 'cheatsheets';
const BASE = '/cheatsheets';
const COLUMNS = 4;
const MAX_PAGES = 2;
const PAGE_BUDGETS = [870, 930];
const MAX_SUBTITLE = 120;
const SEARCH_DETAIL = 60;
const KIND_LABELS = { concept: 'Concepts', commands: 'Commands and APIs', comparison: 'Comparisons', debugging: 'Debugging', manual: 'Manuals', project: 'Projects' };
const TRACKS = [
  ['foundations', 'Foundations', ['00', '01', '02', '03']],
  ['vision-audio', 'Vision and audio', ['04', '06']],
  ['language', 'Language and transformers', ['05', '07', '10']],
  ['generative', 'Generative and multimodal', ['08', '12']],
  ['rl-safety', 'RL, safety and alignment', ['09', '18']],
  ['llm-engineering', 'LLM engineering', ['11']],
  ['tools', 'Tools and protocols', ['13']],
  ['agents', 'Agents and autonomy', ['14', '15', '16']],
  ['production', 'Production and infrastructure', ['17']],
  ['capstones', 'Capstones', ['19']],
  ['manuals', 'Manuals', []],
  ['projects', 'Projects', []],
];
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const THEME_SCRIPT = "(function(){var r=document.documentElement,s='';try{s=localStorage.getItem('theme')||'';}catch(_){}r.setAttribute('data-theme',s||(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));function i(){var e=document.getElementById('themeIcon');if(e)e.textContent=r.getAttribute('data-theme')==='light'?'N':'D';}document.addEventListener('DOMContentLoaded',function(){i();var b=document.getElementById('themeToggle');if(b)b.addEventListener('click',function(){var n=r.getAttribute('data-theme')==='light'?'dark':'light';r.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(_){}i();});});})();";
const HEAD_ASSETS = '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/cheatsheets.css">\n<link rel="stylesheet" href="/code.css">';
const BODY_ASSETS = '<script src="/header.js" defer></script>\n<script src="/code-copy.js" defer></script>\n<script src="/cheatsheets.js" defer></script>';

const TYPES = {
  concepts: { group: 'know', label: 'Know' },
  glossary: { group: 'know', label: 'Know' },
  'task-table': { group: 'do', label: 'Do' },
  'command-table': { group: 'do', label: 'Do' },
  'annotated-code': { group: 'code', label: 'Code' },
  flow: { group: 'see', label: 'See' },
  architecture: { group: 'see', label: 'See' },
  defaults: { group: 'numbers', label: 'Numbers' },
  comparison: { group: 'compare', label: 'Compare' },
  troubleshooting: { group: 'fix', label: 'Fix' },
  qa: { group: 'recall', label: 'Recall' },
  tips: { group: 'recall', label: 'Recall' },
};
const GROUPS = [
  ['know', 'Concepts and terms'],
  ['do', 'Tasks and commands'],
  ['code', 'Annotated code'],
  ['see', 'Diagrams'],
  ['compare', 'Comparisons'],
  ['numbers', 'Defaults and numbers'],
  ['fix', 'Troubleshooting'],
  ['recall', 'Questions and tips'],
];
const TABLE_SHAPES = {
  'task-table': 2,
  'command-table': 2,
  defaults: 3,
  troubleshooting: 3,
  comparison: 'header',
};
const SOURCE_EXTENSIONS = /\.(?:md|py|ts|js|mjs|rs|jl|go|sh|txt|log|json|jsonl|yaml|yml|toml|csv)$/;
const COMMENT = { bash: /\s{2,}#\s/, sh: /\s{2,}#\s/, python: /\s{2,}#\s/, py: /\s{2,}#\s/, yaml: /\s{2,}#\s/, text: /\s{2,}#\s/, typescript: /\s{2,}\/\/\s/, ts: /\s{2,}\/\/\s/, javascript: /\s{2,}\/\/\s/, js: /\s{2,}\/\/\s/, rust: /\s{2,}\/\/\s/, go: /\s{2,}\/\/\s/, tsx: /\s{2,}\/\/\s/ };
const FULL_COMMENT = /^\s*(?:#|\/\/)\s?/;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function slugOf(text) {
  return String(text).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'block';
}

function inline(text) {
  return markdown.inlineFormat(String(text));
}

function plain(text) {
  return String(text).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\s+/g, ' ').trim();
}

function placeholders(html) {
  return html.replace(/&lt;([a-z][a-z0-9_ -]*)&gt;/gi, '<span class="cs-ph">&lt;$1&gt;</span>');
}

function codeSpan(code) {
  return `<code class="cs-cmd" tabindex="0" title="Click to copy">${placeholders(escapeHtml(code)).replace(/([=,/])(?![^<]*>)/g, '$1<wbr>')}</code>`;
}

function cellHtml(cell) {
  const whole = /^`([^`]+)`$/.exec(cell.trim());
  if (whole) return codeSpan(whole[1]);
  return placeholders(inline(cell));
}

function parseFrontMatter(lines, errors) {
  const meta = {};
  if (lines[0] !== '---') {
    errors.push('the file must start with a front matter block');
    return { meta, end: 0 };
  }
  let end = 1;
  for (; end < lines.length && lines[end] !== '---'; end++) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(lines[end]);
    if (match) meta[match[1]] = match[2].trim();
    else if (lines[end].trim()) errors.push(`front matter line ${end + 1} is not "key: value"`);
  }
  return { meta, end: end + 1 };
}

function splitList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function parseTable(lines) {
  const rows = [];
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = markdown.splitTableRow(line.trim());
    if (cells.every(cell => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return { header: rows[0] || [], rows: rows.slice(1) };
}

function parseBullets(lines) {
  const items = [];
  for (const line of lines) {
    const match = /^(?:[-*]|\d+[.)])\s+(.+)$/.exec(line);
    if (match) items.push(match[1].trim());
    else if (items.length && /^\s{2,}\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map(item => {
    const lead = /^\*\*(.+?)\*\*\s*:?\s*(.*)$/.exec(item);
    return lead ? { lead: lead[1].replace(/:$/, ''), text: lead[2] } : { lead: '', text: item };
  });
}

function parseFence(lines) {
  const start = lines.findIndex(line => /^\s*(?:`{3,}|~{3,})/.test(line));
  if (start < 0) return null;
  const open = /^\s*(`{3,}|~{3,})\s*(.*)$/.exec(lines[start]);
  const marker = open[1];
  const lang = open[2].trim().toLowerCase();
  const end = lines.findIndex((line, index) => {
    if (index <= start) return false;
    const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
    return Boolean(close) && close[1][0] === marker[0] && close[1].length >= marker.length;
  });
  return { lang, code: lines.slice(start + 1, end < 0 ? undefined : end) };
}

const NODE_KINDS = {
  client: 'M1,1 h12 v8 h-12 z M5,12 h4 M7,9 v3',
  process: 'M1,2 h12 v10 h-12 z M1,5 h12 M3,3.5 h1 M5,3.5 h1',
  store: 'M1,3 a6,2 0 1,0 12,0 a6,2 0 1,0 -12,0 v8 a6,2 0 0,0 12,0 v-8',
  queue: 'M1,2 h12 v3 h-12 z M1,6 h12 v3 h-12 z M1,10 h12 v3 h-12 z',
  gpu: 'M3,3 h8 v8 h-8 z M5,5 h4 v4 h-4 z M5,1 v2 M9,1 v2 M5,11 v2 M9,11 v2 M1,5 h2 M1,9 h2 M11,5 h2 M11,9 h2',
  model: 'M7,1 l6,3.5 v6 l-6,3.5 l-6,-3.5 v-6 z M7,1 v13 M1,4.5 l6,3.5 l6,-3.5',
};

function parseArchitecture(lines, errors, where) {
  const fence = parseFence(lines);
  const nodes = [];
  const edges = [];
  if (!fence || fence.lang !== 'arch') {
    errors.push(`${where}: an architecture block needs a fenced arch block`);
    return { nodes, edges };
  }
  for (const line of fence.code) {
    if (!line.trim()) continue;
    const parts = line.split('|').map(part => part.trim());
    if (parts[0] === 'node') {
      const at = /^(\d+),(\d+)$/.exec(parts[2] || '');
      if (!parts[1] || !at || !parts[3]) errors.push(`${where}: bad node line "${line.trim()}"`);
      else if (parts[5] && !NODE_KINDS[parts[5]]) errors.push(`${where}: node kind "${parts[5]}" must be one of ${Object.keys(NODE_KINDS).join(', ')}`);
      else nodes.push({ id: parts[1], col: Number(at[1]), row: Number(at[2]), label: parts[3], sub: parts[4] || '', kind: parts[5] || '' });
    } else if (parts[0] === 'edge') {
      if (!parts[1] || !parts[2]) errors.push(`${where}: bad edge line "${line.trim()}"`);
      else edges.push({ from: parts[1], to: parts[2], label: parts[3] || '' });
    } else {
      errors.push(`${where}: unknown arch line "${line.trim()}"`);
    }
  }
  const ids = new Set(nodes.map(node => node.id));
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`${where}: edge ${edge.from} -> ${edge.to} names a missing node`);
  }
  const cells = new Set();
  for (const node of nodes) {
    const key = `${node.col},${node.row}`;
    if (cells.has(key)) errors.push(`${where}: two nodes share cell ${key}`);
    cells.add(key);
  }
  return { nodes, edges };
}

function parseTopic(text, file = '') {
  const errors = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const { meta, end } = parseFrontMatter(lines, errors);
  for (const key of ['id', 'title', 'subtitle', 'hue', 'sources']) {
    if (!meta[key]) errors.push(`front matter needs "${key}"`);
  }
  if (meta.id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.id)) errors.push(`id "${meta.id}" must be lower case with hyphens`);
  if (file && meta.id && path.basename(file, '.md') !== meta.id) errors.push(`id "${meta.id}" must match the file name`);
  const hue = Number(meta.hue);
  if (!(hue >= 0 && hue < 360)) errors.push('hue must be a number from 0 to 359');
  const blocks = [];
  let current = null;
  for (let i = end; i < lines.length; i++) {
    const heading = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (heading) {
      current = { title: heading[1], meta: {}, body: [], line: i + 1 };
      blocks.push(current);
      let j = i + 1;
      for (; j < lines.length && lines[j].trim(); j++) {
        const match = /^([a-z]+):\s*(.*)$/.exec(lines[j]);
        if (!match) break;
        current.meta[match[1]] = match[2].trim();
      }
      i = j - 1;
      continue;
    }
    if (current) current.body.push(lines[i]);
  }
  const ids = new Set();
  const parsed = blocks.map(block => {
    const where = `block "${block.title}" (line ${block.line})`;
    const type = block.meta.type;
    if (!TYPES[type]) errors.push(`${where}: unknown type "${type}"`);
    const from = splitList(block.meta.from);
    if (!from.length) errors.push(`${where}: needs a from line`);
    let id = slugOf(block.title);
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const col = block.meta.col ? Number(block.meta.col) : 0;
    if (block.meta.col && !(col >= 1 && col <= COLUMNS)) errors.push(`${where}: col must be 1 to ${COLUMNS}`);
    const defaultSpan = ['annotated-code', 'architecture', 'troubleshooting', 'defaults', 'comparison'].includes(type) ? 2 : 1;
    const span = block.meta.span ? Number(block.meta.span) : defaultSpan;
    if (!(span >= 1 && span <= COLUMNS)) errors.push(`${where}: span must be 1 to ${COLUMNS}`);
    if (col && col + span - 1 > COLUMNS) errors.push(`${where}: col ${col} with span ${span} runs past column ${COLUMNS}`);
    const out = { id, title: block.title, type, from, col, span, lang: block.meta.lang || '', line: block.line };
    if (TABLE_SHAPES[type]) {
      const table = parseTable(block.body);
      if (!table.rows.length) errors.push(`${where}: the table has no rows`);
      const width = TABLE_SHAPES[type] === 'header' ? table.header.length : TABLE_SHAPES[type];
      if (TABLE_SHAPES[type] === 'header' && !(width >= 3 && width <= 5)) errors.push(`${where}: a comparison table needs 3 to 5 columns`);
      for (const row of table.rows) {
        if (row.length !== width) errors.push(`${where}: row "${row.join(' | ')}" needs ${width} cells`);
      }
      out.header = table.header;
      out.rows = table.rows;
    } else if (type === 'annotated-code') {
      const fence = parseFence(block.body);
      if (!fence) errors.push(`${where}: needs one fenced code block`);
      out.lang = (fence && fence.lang) || out.lang || 'text';
      out.code = fence ? fence.code : [];
    } else if (type === 'architecture') {
      Object.assign(out, parseArchitecture(block.body, errors, where));
    } else if (type === 'flow') {
      out.items = parseBullets(block.body);
      if (!out.items.length) errors.push(`${where}: the flow has no steps`);
    } else if (TYPES[type]) {
      out.items = parseBullets(block.body);
      if (!out.items.length) errors.push(`${where}: no bullets`);
    }
    return out;
  });
  if (!parsed.length) errors.push('the topic has no blocks');
  return {
    id: meta.id || '',
    title: meta.title || '',
    subtitle: meta.subtitle || '',
    hue: Number.isFinite(hue) ? hue : 222,
    code: meta.code || initials(meta.title || ''),
    sources: splitList(meta.sources),
    sourceHash: meta.source_hash || '',
    blocks: parsed,
    errors,
    hash: sha(text).slice(0, 12),
  };
}

function initials(title) {
  const words = title.replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(word => word && !/^(?:and|with|the|of|for|to|a)$/i.test(word));
  return ((words[0] || 'X')[0] + ((words[1] || words[0] || 'X')[words[1] ? 0 : 1] || 'X')).toUpperCase();
}

function textWidth(text, size) {
  return Array.from(String(text)).length * size * 0.6;
}

function wrap(text, size, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function svgText(lines, x, y, size, className, anchor = 'middle') {
  return lines.map((line, index) => `<text class="${className}" x="${x}" y="${y + index * size * 1.25}" font-size="${size}" text-anchor="${anchor}">${escapeHtml(line)}</text>`).join('');
}

const round1 = value => Math.round(value * 10) / 10;

function segmentHitsBox(x1, y1, x2, y2, r, pad = 1) {
  const left = r.x + pad;
  const right = r.x + r.w - pad;
  const top = r.y + pad;
  const bottom = r.y + r.h - pad;
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - left], [dx, right - x1], [-dy, y1 - top], [dy, bottom - y1]]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function edgeLabelBox(label, x, y, style) {
  const lw = textWidth(label, 8.5) + 6;
  if (style === 'above') return { x, y: y - 4, anchor: 'middle', knock: false, box: { x: x - lw / 2 + 3, y: y - 11, w: lw - 6, h: 9 } };
  if (style === 'right') return { x: x + 5, y: y + 3, anchor: 'start', knock: false, box: { x: x + 5, y: y - 4, w: lw - 6, h: 9 } };
  return { x, y: y + 3, anchor: 'middle', knock: true, box: { x: x - lw / 2, y: y - 6, w: lw, h: 12 } };
}

function placeArchitecture(block, gutter) {
  const width = 300 * (block.span || 1) + 14 * ((block.span || 1) - 1);
  const cols = Math.max(...block.nodes.map(node => node.col));
  const rows = Math.max(...block.nodes.map(node => node.row));
  const rowOf = new Map(block.nodes.map(node => [node.id, node]));
  const sideLabels = block.edges.filter(edge => rowOf.get(edge.from) && rowOf.get(edge.to) && rowOf.get(edge.from).row === rowOf.get(edge.to).row && Math.abs(rowOf.get(edge.from).col - rowOf.get(edge.to).col) === 1 && edge.label);
  const wantGap = Math.max(28, ...sideLabels.map(edge => textWidth(edge.label, 8.5) + 12));
  const room = width - gutter;
  const gapX = cols > 1 ? Math.min(wantGap, (room * 0.36) / (cols - 1)) : 0;
  const nodeW = (room - 2 - gapX * (cols - 1)) / cols;
  const labelSize = 10.5;
  const subSize = 9;
  const laid = block.nodes.map(node => ({ ...node, labelLines: wrap(node.label, labelSize, nodeW - 10), subLines: node.sub ? wrap(node.sub, subSize, nodeW - 10) : [] }));
  const nodeH = Math.max(...laid.map(node => 10 + node.labelLines.length * labelSize * 1.25 + node.subLines.length * subSize * 1.25 + 4));
  const gapY = 34;
  const box = node => ({ x: 1 + (node.col - 1) * (nodeW + gapX), y: 1 + (node.row - 1) * (nodeH + gapY), w: nodeW, h: nodeH });
  const nodes = laid.map(node => ({ ...node, box: box(node) }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const rowTop = row => 1 + (row - 1) * (nodeH + gapY);
  const laneSets = [];
  for (let row = 0; row <= rows; row += 1) {
    const centre = row === 0 ? rowTop(1) - 11 : row === rows ? rowTop(rows) + nodeH + 11 : rowTop(row) + nodeH + gapY / 2;
    const offsets = row === 0 ? [0, -12] : row === rows ? [0, 12] : [0, -8, 8];
    laneSets.push({ after: row, ys: offsets.map(offset => centre + offset), margin: row === 0 || row === rows });
  }
  const colLanes = [];
  for (let col = 1; col < cols; col += 1) for (const offset of gapX >= 20 ? [0, -gapX / 4, gapX / 4] : [0]) colLanes.push(1 + col * (nodeW + gapX) - gapX / 2 + offset);
  if (gutter) colLanes.push(width - gutter / 2);
  const placedLabels = [];
  const placedSegments = [];
  const crossesNode = (edge, points) => points.slice(1).some((point, i) => nodes.some(node => node.id !== edge.from && node.id !== edge.to && segmentHitsBox(points[i][0], points[i][1], point[0], point[1], node.box)));
  const labelFits = label => label.box.x >= 0 && label.box.x + label.box.w <= width && !nodes.some(node => boxesOverlap(label.box, node.box)) && !placedLabels.some(other => boxesOverlap(label.box, other));
  const sharesLine = (x1, y1, x2, y2) => placedSegments.some(([sx1, sy1, sx2, sy2]) => {
    if (Math.abs(y1 - y2) < 0.5 && Math.abs(sy1 - sy2) < 0.5 && Math.abs(sy1 - y1) < 3) return Math.min(Math.max(x1, x2), Math.max(sx1, sx2)) - Math.max(Math.min(x1, x2), Math.min(sx1, sx2)) > 2;
    if (Math.abs(x1 - x2) < 0.5 && Math.abs(sx1 - sx2) < 0.5 && Math.abs(sx1 - x1) < 3) return Math.min(Math.max(y1, y2), Math.max(sy1, sy2)) - Math.max(Math.min(y1, y2), Math.min(sy1, sy2)) > 2;
    return false;
  });
  const travel = points => points.slice(1).reduce((sum, [x2, y2], i) => sum + Math.abs(x2 - points[i][0]) + Math.abs(y2 - points[i][1]), 25 * (points.length - 2));
  const penalty = (points, label) => {
    let cost = 25 * (points.length - 2);
    for (let i = 1; i < points.length; i += 1) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      cost += Math.abs(x2 - x1) + Math.abs(y2 - y1);
      for (const other of placedLabels) if (segmentHitsBox(x1, y1, x2, y2, other, 0)) cost += 60;
      if (points.length > 2 && sharesLine(x1, y1, x2, y2)) cost += 80;
    }
    if (label) for (const seg of placedSegments) if (segmentHitsBox(...seg, label.box, 0)) cost += 40;
    return cost;
  };
  const labelsOn = (edge, points, styles) => {
    if (!edge.label) return [null];
    const out = [];
    for (let i = 1; i < points.length; i += 1) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      const flat = Math.abs(y2 - y1) < 0.5;
      const upright = Math.abs(x2 - x1) < 0.5;
      const these = flat ? styles.flat : upright ? styles.upright : styles.slant;
      if (!these) continue;
      for (const t of [0.5, 0.3, 0.7]) for (const style of these) out.push(edgeLabelBox(edge.label, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, style));
    }
    return out;
  };
  const edges = block.edges.map(edge => {
    const a = byId.get(edge.from).box;
    const b = byId.get(edge.to).box;
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const clip = r => Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
    const straight = [[ax + dx * clip(a), ay + dy * clip(a)], [bx - dx * clip(b), by - dy * clip(b)]];
    const candidates = [];
    const offer = (points, styles, extra = 0) => {
      if (crossesNode(edge, points)) return;
      for (const label of labelsOn(edge, points, styles)) {
        if (label && !labelFits(label)) continue;
        const cost = penalty(points, label);
        candidates.push({ points, label, cost: cost + extra, clean: cost === travel(points) && extra < 80 });
      }
    };
    offer(straight, { flat: ['above', 'knock'], upright: ['right', 'knock'], slant: ['knock'] }, sharesLine(...straight[0], ...straight[1]) ? 80 : 0);
    const exit = (r, y) => (y > r.y + r.h / 2 ? r.y + r.h : r.y);
    const side = (r, x) => (x > r.x + r.w / 2 ? r.x + r.w : r.x);
    const rowAfter = r => Math.round((r.y - 1) / (nodeH + gapY));
    const near = r => laneSets.filter(set => set.after === rowAfter(r) || set.after === rowAfter(r) + 1);
    const ports = [0, -0.25, 0.25];
    const settled = () => candidates.some(candidate => candidate.clean);
    for (const set of laneSets) {
      if (Math.abs(dx) < 1 || settled()) break;
      for (const y of set.ys) {
        for (const pa of ports) for (const pb of ports) {
          const xa = ax + pa * a.w;
          const xb = bx + pb * b.w;
          offer([[xa, exit(a, y)], [xa, y], [xb, y], [xb, exit(b, y)]], { flat: ['knock'] }, (set.margin ? 150 : 0) + (pa || pb ? 10 : 0));
        }
      }
    }
    for (const x of colLanes) {
      if (settled()) break;
      offer([[side(a, x), ay], [x, ay], [x, by], [side(b, x), by]], { upright: ['knock'] });
      for (const setA of near(a)) for (const setB of near(b)) {
        for (const ya of setA.ys) for (const yb of setB.ys) {
          for (const pa of ports) for (const pb of ports) {
            const xa = ax + pa * a.w;
            const xb = bx + pb * b.w;
            offer([[xa, exit(a, ya)], [xa, ya], [x, ya], [x, yb], [xb, yb], [xb, exit(b, yb)]], { flat: ['knock'] }, (setA.margin ? 150 : 0) + (setB.margin ? 150 : 0) + (pa || pb ? 10 : 0));
          }
        }
      }
    }
    candidates.sort((p, q) => p.cost - q.cost);
    const chosen = candidates[0] || { points: straight, label: edge.label ? edgeLabelBox(edge.label, (straight[0][0] + straight[1][0]) / 2, (straight[0][1] + straight[1][1]) / 2, 'knock') : null };
    if (chosen.label) placedLabels.push(chosen.label.box);
    for (let i = 1; i < chosen.points.length; i += 1) placedSegments.push([...chosen.points[i - 1], ...chosen.points[i]]);
    return { ...edge, points: chosen.points, place: chosen.label };
  });
  let minY = 0;
  let maxY = rows * nodeH + (rows - 1) * gapY + 2;
  for (const edge of edges) {
    for (const [, y] of edge.points) {
      minY = Math.min(minY, y - 2);
      maxY = Math.max(maxY, y + 2);
    }
    if (edge.place) {
      minY = Math.min(minY, edge.place.box.y - 1);
      maxY = Math.max(maxY, edge.place.box.y + edge.place.box.h + 1);
    }
  }
  return { block, width, minY, height: maxY - minY, nodes, edges, labelSize, subSize };
}

function layoutOverlaps({ width, nodes, edges }) {
  const found = [];
  const name = edge => `${edge.from} to ${edge.to}`;
  for (const edge of edges) {
    for (let i = 1; i < edge.points.length; i += 1) {
      const [x1, y1] = edge.points[i - 1];
      const [x2, y2] = edge.points[i];
      for (const node of nodes) {
        if (node.id !== edge.from && node.id !== edge.to && segmentHitsBox(x1, y1, x2, y2, node.box)) found.push(`edge ${name(edge)} crosses node ${node.id}`);
      }
    }
    if (!edge.place) continue;
    for (const node of nodes) if (boxesOverlap(edge.place.box, node.box)) found.push(`label of edge ${name(edge)} overlaps node ${node.id}`);
    if (edge.place.box.x < 0 || edge.place.box.x + edge.place.box.w > width) found.push(`label of edge ${name(edge)} runs off the diagram`);
  }
  const labelled = edges.filter(edge => edge.place);
  for (let i = 0; i < labelled.length; i += 1) {
    for (let j = i + 1; j < labelled.length; j += 1) {
      if (boxesOverlap(labelled[i].place.box, labelled[j].place.box)) found.push(`labels of edges ${name(labelled[i])} and ${name(labelled[j])} overlap`);
    }
  }
  return [...new Set(found)];
}

const architectureCache = new WeakMap();

function architectureLayout(source, narrow = false) {
  const cached = architectureCache.get(source) || [];
  if (!cached[Number(narrow)]) {
    cached[Number(narrow)] = routeArchitecture(source, narrow);
    architectureCache.set(source, cached);
  }
  return cached[Number(narrow)];
}

function routeArchitecture(source, narrow) {
  const block = narrow ? { ...source, span: 1, id: `${source.id}-n`, nodes: source.nodes.map(node => ({ ...node, col: node.row, row: node.col })) } : source;
  const plainLayout = placeArchitecture(block, 0);
  const plainCount = layoutOverlaps(plainLayout).length;
  if (!plainCount) return plainLayout;
  const gutter = Math.min(120, Math.max(40, ...block.edges.map(edge => (edge.label ? textWidth(edge.label, 8.5) + 18 : 0))));
  const guttered = placeArchitecture(block, gutter);
  return layoutOverlaps(guttered).length < plainCount ? guttered : plainLayout;
}

function architectureOverlaps(source, narrow = false) {
  return layoutOverlaps(architectureLayout(source, narrow));
}

function architectureSvg(source, narrow = false) {
  const { block, width, minY, height, nodes, edges, labelSize, subSize } = architectureLayout(source, narrow);
  const parts = [];
  for (const edge of edges) {
    const points = edge.points.map(([x, y]) => `${round1(x)},${round1(y)}`);
    if (points.length === 2) {
      const [[x1, y1], [x2, y2]] = edge.points;
      parts.push(`<line class="cs-arch-edge" x1="${round1(x1)}" y1="${round1(y1)}" x2="${round1(x2)}" y2="${round1(y2)}" marker-end="url(#cs-arrow-${block.id})"/>`);
    } else {
      parts.push(`<polyline class="cs-arch-edge" fill="none" points="${points.join(' ')}" marker-end="url(#cs-arrow-${block.id})"/>`);
    }
    if (!edge.place) continue;
    const label = edge.place;
    if (label.knock) parts.push(`<rect class="cs-arch-knock" x="${round1(label.box.x)}" y="${round1(label.box.y)}" width="${round1(label.box.w)}" height="${round1(label.box.h)}"/>`);
    parts.push(svgText([edge.label], round1(label.x), round1(label.y), 8.5, 'cs-arch-elabel', label.anchor));
  }
  for (const node of nodes) {
    const r = node.box;
    parts.push(`<rect class="cs-arch-node" x="${round1(r.x)}" y="${round1(r.y)}" width="${round1(r.w)}" height="${round1(r.h)}" rx="2"/>`);
    if (node.kind) parts.push(`<path class="cs-arch-kind" transform="translate(${round1(r.x + 4)} ${round1(r.y + 4)}) scale(0.8)" d="${NODE_KINDS[node.kind]}"><title>${node.kind}</title></path>`);
    const top = r.y + (r.h - (node.labelLines.length * labelSize * 1.25 + node.subLines.length * subSize * 1.25)) / 2 + labelSize;
    parts.push(svgText(node.labelLines, round1(r.x + r.w / 2), round1(top), labelSize, 'cs-arch-label'));
    if (node.subLines.length) parts.push(svgText(node.subLines, round1(r.x + r.w / 2), round1(top + node.labelLines.length * labelSize * 1.25), subSize, 'cs-arch-sub'));
  }
  const marker = `<defs><marker id="cs-arrow-${block.id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="cs-arch-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>`;
  const title = `${block.title}: ${block.nodes.map(node => node.label).join(', ')}`;
  return `<svg class="cs-arch${narrow ? ' cs-arch-narrow' : ' cs-arch-wide'}" viewBox="0 ${round1(minY)} ${width} ${Math.round(height)}" role="img" aria-label="${escapeHtml(title)}">${marker}${parts.join('')}</svg>`;
}

function flowSvg(block) {
  const width = 300 * (block.span || 1) + 14 * ((block.span || 1) - 1);
  const size = 9.5;
  const left = 30;
  const textW = width - left - 8;
  let y = 2;
  const parts = [];
  const steps = block.items.map((item, index) => {
    const lead = plain(item.lead);
    const body = plain(item.text);
    const leadLines = lead ? wrap(lead, size, textW) : [];
    const bodyLines = wrap(body, size * 0.95, textW);
    const h = 8 + leadLines.length * size * 1.3 + bodyLines.length * size * 0.95 * 1.3 + 4;
    const step = { index, leadLines, bodyLines, y, h };
    y += h + 12;
    return step;
  });
  const round = value => Math.round(value * 10) / 10;
  for (const step of steps) {
    if (step.index < steps.length - 1) parts.push(`<line class="cs-flow-link" x1="12" y1="${round(step.y + 22)}" x2="12" y2="${round(step.y + step.h + 12)}"/>`);
    parts.push(`<rect class="cs-flow-box" x="${left - 4}" y="${round(step.y)}" width="${width - left + 3}" height="${round(step.h)}" rx="2"/>`);
    parts.push(`<circle class="cs-flow-dot" cx="12" cy="${round(step.y + 11)}" r="10"/>`);
    parts.push(svgText([String(step.index + 1)], 12, round(step.y + 14.5), 10, 'cs-flow-num'));
    let ty = step.y + 6 + size;
    if (step.leadLines.length) {
      parts.push(svgText(step.leadLines, left + 2, round(ty), size, 'cs-flow-lead', 'start'));
      ty += step.leadLines.length * size * 1.3;
    }
    parts.push(svgText(step.bodyLines, left + 2, round(ty), size * 0.95, 'cs-flow-text', 'start'));
  }
  const title = `${block.title}: ${block.items.map((item, index) => `${index + 1} ${plain(item.lead || item.text)}`).join(', ')}`;
  return `<svg class="cs-flow" viewBox="0 0 ${width} ${Math.round(y - 10)}" role="img" aria-label="${escapeHtml(title)}">${parts.join('')}</svg>`;
}

function annotatedHtml(block) {
  const pattern = COMMENT[block.lang] || COMMENT.bash;
  const heading = line => FULL_COMMENT.test(line) && !/^\s*#!/.test(line);
  const parts = block.code.map(line => {
    if (!line.trim() || heading(line)) return null;
    const match = pattern.exec(line);
    return { code: (match ? line.slice(0, match.index) : line).replace(/\s+$/, ''), note: match ? line.slice(match.index + match[0].length) : '' };
  });
  const lit = code.lines(parts.filter(Boolean).map(part => part.code), block.lang);
  let at = 0;
  const rows = block.code.map((line, index) => {
    if (!line.trim()) return '<div class="cs-ann-gap"></div>';
    if (heading(line)) return `<div class="cs-ann-head">${escapeHtml(line.replace(FULL_COMMENT, ''))}</div>`;
    return `<div class="cs-ann-row"><code class="cb-ln">${placeholders(lit[at++])}</code><span>${escapeHtml(parts[index].note)}</span></div>`;
  });
  return `<div class="cs-ann" data-lang="${escapeHtml(block.lang)}"><button type="button" class="cb-copy" aria-label="Copy code">Copy</button>${rows.join('')}</div>`;
}

function tableHtml(block) {
  const head = block.header.length ? `<thead><tr>${block.header.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead>` : '';
  const body = block.rows.map(row => `<tr>${row.map((cell, index) => (index === 0 ? `<th scope="row">${cellHtml(cell)}</th>` : `<td>${cellHtml(cell)}</td>`)).join('')}</tr>`).join('');
  return `<table class="cs-table cs-cols-${block.rows[0] ? block.rows[0].length : 2}">${head}<tbody>${body}</tbody></table>`;
}

function listHtml(block) {
  if (block.type === 'concepts' || block.type === 'glossary') {
    return `<dl class="cs-defs">${block.items.map(item => `<div><dt>${placeholders(inline(item.lead || ''))}</dt><dd>${placeholders(inline(item.text))}</dd></div>`).join('')}</dl>`;
  }
  if (block.type === 'qa') {
    return `<dl class="cs-qa">${block.items.map(item => `<div><dt>${inline(item.lead || '')}</dt><dd>${placeholders(inline(item.text))}</dd></div>`).join('')}</dl>`;
  }
  return `<ul class="cs-tips">${block.items.map(item => `<li>${item.lead ? `<strong>${inline(item.lead)}</strong> ` : ''}${placeholders(inline(item.text))}</li>`).join('')}</ul>`;
}

function sourceLink(source) {
  const lesson = /^phases\/(\d+)-[^/]+\/(\d+)-[^/]+(?:\/(.*))?$/.exec(source);
  const lessonDir = /^(phases\/[^/]+\/[^/]+)/.exec(source);
  if (lesson && (!lesson[3] || lesson[3] === 'docs/en.md')) return { href: `/lesson?path=${lessonDir[1]}`, label: `Lesson ${lesson[1]}.${lesson[2]}` };
  if (lesson) return { href: `${REPO}/blob/main/${source}`, label: `${lesson[1]}.${lesson[2]} ${lesson[3]}` };
  const section = /^manuals\/([^/]+)\/sections\/((?:r-)?\d+(?:-\d+)?)-[^/]+\.md$/.exec(source);
  if (section) {
    const file = path.basename(source, '.md');
    const anchor = `s-${file.replace(/^\d+-\d+-/, '').replace(/^r-\d+-/, 'ref-')}`;
    const number = section[2].startsWith('r-') ? `R${section[2].slice(2)}` : section[2].replace('-', '.');
    return { href: `/manual-${section[1]}#${anchor}`, label: `${section[1]} §${number}` };
  }
  const manualRoot = /^manuals\/([^/]+)\/?$/.exec(source);
  if (manualRoot) return { href: `/manual-${manualRoot[1]}`, label: manualRoot[1] };
  const manualFile = /^manuals\/([^/]+)\/(.+)$/.exec(source);
  if (manualFile) return { href: `${REPO}/blob/main/${source}`, label: `${manualFile[1]} ${manualFile[2].replace(/^capture\/out\//, 'capture: ').replace(/^capture\//, 'capture: ')}` };
  return { href: `${REPO}/blob/main/${source}`, label: source.split('/').slice(-2).join('/') };
}

function blockBody(block) {
  if (TABLE_SHAPES[block.type]) return tableHtml(block);
  if (block.type === 'annotated-code') return annotatedHtml(block);
  if (block.type === 'architecture') return architectureSvg(block) + architectureSvg(block, true);
  if (block.type === 'flow') return flowSvg(block);
  return listHtml(block);
}

function blockHtml(block, place, href = '') {
  const group = TYPES[block.type] ? TYPES[block.type].group : 'know';
  const style = place ? ` style="grid-column:${place.col} / span ${place.span};grid-row:${place.row} / span ${place.rows}"` : '';
  const wide = place && place.span > 1 ? ' cs-wide' : '';
  return `<section class="cs-block cs-g-${group} cs-t-${block.type}${wide}" id="${block.id}"${style}><h2 class="cs-bar"><span>${placeholders(inline(block.title))}</span><a class="cs-anchor" href="${href}#${block.id}" aria-label="Link to this block">#</a></h2><div class="cs-bb">${blockBody(block)}</div></section>`;
}

function textLength(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, 'x').length;
}

function estimateBlock(block) {
  const scale = block.span || 1;
  let h = 34;
  if (block.type === 'comparison') {
    const width = (36 * scale) / block.header.length;
    const lines = cells => Math.max(...cells.map(cell => Math.ceil(plain(cell).length / width) || 1));
    h += 24 + 17 * (lines(block.header) - 1);
    for (const row of block.rows) h += 6 + 17 * lines(row);
  } else if (TABLE_SHAPES[block.type]) {
    const widths = TABLE_WIDTHS[block.type] || TABLE_WIDTHS.default;
    h += block.type === 'defaults' ? 30 : 16;
    for (const row of block.rows) h += 6 + 17 * Math.max(...row.map((cell, index) => cellLines(cell, widths[index] * scale)));
  } else if (block.type === 'annotated-code') {
    const pattern = COMMENT[block.lang] || COMMENT.bash;
    const noted = block.code.some(line => pattern.test(line) && !FULL_COMMENT.test(line));
    h += 18;
    for (const line of block.code) {
      if (!line.trim()) {
        h += 6;
        continue;
      }
      const match = FULL_COMMENT.test(line) ? null : pattern.exec(line);
      const code = match ? line.slice(0, match.index) : line;
      const note = match ? line.slice(match.index + match[0].length) : '';
      const codeLines = Math.ceil(code.length / ((noted ? 28 : 54) * scale)) || 1;
      const noteLines = note ? Math.ceil(note.length / (20 * scale)) : 1;
      h += 17 * Math.max(codeLines, noteLines);
    }
  } else if (block.type === 'architecture' || block.type === 'flow') {
    const svg = block.type === 'architecture' ? architectureSvg(block) : flowSvg(block);
    const viewBox = /viewBox="0 -?[\d.]+ (\d+) (\d+)"/.exec(svg);
    h += viewBox ? Number(viewBox[2]) * (350 * scale) / Number(viewBox[1]) : 200;
  } else {
    for (const item of block.items) {
      if (block.type === 'qa') h += 8 + 18 * (Math.ceil(plain(item.lead).length / (40 * scale)) + Math.ceil(plain(item.text).length / (44 * scale)));
      else h += 6 + 18 * Math.ceil((plain(item.lead).length + plain(item.text).length + 2) / (44 * scale));
    }
  }
  return h + 16;
}

const TABLE_WIDTHS = { troubleshooting: [13, 15, 15], defaults: [13, 10, 20], 'command-table': [21, 21], default: [17, 26] };

function cellLines(cell, width) {
  const text = plain(cell);
  if (!/`/.test(cell)) return Math.ceil(text.length / width) || 1;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/(?<=[\s=,/])/).filter(Boolean)) {
    const size = word.trimEnd().length;
    if (used && used + size > width) {
      lines += 1;
      used = 0;
    }
    if (size > width) {
      lines += Math.ceil(size / width) - 1;
      used = size % width;
    } else {
      used += word.length;
    }
  }
  return lines;
}
const ROW_UNIT = 8;
const STRETCH_ROWS = 40;
const BLOCK_GAP = 12;

function layout(topic) {
  const heights = topic.blocks.map(estimateBlock);
  const natural = topic.blocks.map((_, index) => index);
  const first = packBlocks(topic, heights, natural);
  if (first.pages <= MAX_PAGES) return first;
  const tallest = natural.slice().sort((a, b) => heights[b] * (topic.blocks[b].span || 1) - heights[a] * (topic.blocks[a].span || 1) || a - b);
  const second = packBlocks(topic, heights, tallest);
  return second.pages < first.pages ? second : first;
}

function packBlocks(topic, heights, order) {
  const pages = [];
  const newPage = () => {
    const budget = Math.floor((PAGE_BUDGETS[pages.length] || PAGE_BUDGETS[PAGE_BUDGETS.length - 1]) / ROW_UNIT);
    const page = { budget, taken: Array.from({ length: COLUMNS }, () => []) };
    pages.push(page);
    return page;
  };
  newPage();
  const fit = (page, block, rows) => {
    const span = Math.min(block.span || 1, COLUMNS);
    const free = (col, start) => start + rows <= page.budget && page.taken[col].every(([a, b]) => start + rows <= a || start >= b);
    const columns = block.col ? [block.col - 1] : Array.from({ length: COLUMNS - span + 1 }, (_, c) => c);
    let best = null;
    for (const col of columns) {
      const starts = [0].concat(...Array.from({ length: span }, (_, k) => page.taken[col + k].map(([, b]) => b))).sort((a, b) => a - b);
      for (const start of starts) {
        let ok = true;
        for (let k = 0; k < span && ok; k++) ok = free(col + k, start);
        if (ok) {
          if (!best || start < best.start || (start === best.start && col < best.col)) best = { col, start };
          break;
        }
      }
    }
    return best && { ...best, span };
  };
  const places = [];
  order.forEach(index => {
    const block = topic.blocks[index];
    const rows = Math.ceil((heights[index] + BLOCK_GAP) / ROW_UNIT);
    let pageIndex = 0;
    let spot = null;
    for (; pageIndex < pages.length && !spot; pageIndex++) spot = fit(pages[pageIndex], block, rows);
    if (spot) pageIndex--;
    else {
      const page = newPage();
      pageIndex = pages.length - 1;
      spot = fit(page, block, Math.min(rows, page.budget)) || { col: 0, start: 0, span: Math.min(block.span || 1, COLUMNS) };
    }
    for (let k = 0; k < spot.span; k++) pages[pageIndex].taken[spot.col + k].push([spot.start, spot.start + rows]);
    places[index] = { page: pageIndex, col: spot.col + 1, span: spot.span, row: spot.start + 1, rows };
  });
  const used = pages.map(page => Math.max(0, ...page.taken.flat().map(([, b]) => b)) * ROW_UNIT);
  for (const place of places) {
    const page = pages[place.page];
    const start = place.row - 1;
    const end = start + place.rows;
    let limit = page.budget;
    for (let c = place.col - 1; c < place.col - 1 + place.span; c++) {
      for (const [a] of page.taken[c]) if (a >= end && a < limit) limit = a;
    }
    const lastRow = Math.max(0, ...page.taken.flat().map(([, b]) => b));
    if (limit === page.budget) limit = Math.min(limit, lastRow);
    if (limit > end && limit - end <= STRETCH_ROWS) place.rows = limit - start;
  }
  return { places, heights, used, pages: pages.length };
}

function legendHtml(topic) {
  const used = new Set(topic.blocks.map(block => TYPES[block.type] && TYPES[block.type].group));
  return `<ul class="cs-legend" aria-label="Colour key">${GROUPS.filter(([group]) => used.has(group)).map(([group, label]) => `<li class="cs-g-${group}"><span aria-hidden="true"></span>${label}</li>`).join('')}</ul>`;
}

function copyLine(year) {
  return `© ${year} ${AUTHOR} · ${LICENSE}`;
}

function posterMain(topic, year, neighbours) {
  const { places, pages } = layout(topic);
  const cols = Array.from({ length: pages }, (_, page) => `<div class="cs-grid cs-sheet-page" data-page="${page + 1}">${topic.blocks.map((block, index) => (places[index].page === page ? blockHtml(block, places[index], topic.href) : '')).join('')}</div>`).join('');
  const sources = topic.sources.map(source => {
    const link = sourceLink(source);
    return `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`;
  }).join('');
  const head = `<header class="cs-poster-head"><div class="cs-title-block"><span class="cs-code" aria-hidden="true">${escapeHtml(topic.code)}</span><div><p class="cs-kicker"><a href="${BASE}">Cheat sheets</a></p><h1>${escapeHtml(topic.title)}</h1><p class="cs-sub">${placeholders(inline(topic.subtitle))}</p></div></div><div class="cs-head-side">${legendHtml(topic)}<p class="cs-actions"><button type="button" class="cs-print" data-print>Print</button>${topic.explainer ? `<a href="/${escapeHtml(topic.explainer.replace(/\.html$/, ''))}">Interactive machine</a>` : ''}<a href="${REPO}/blob/main/${TOPIC_DIR}/${topic.id}.md">Source</a></p></div></header>`;
  const pager = [neighbours.previous && `<a href="${neighbours.previous.href}" rel="prev">← ${escapeHtml(neighbours.previous.title)}</a>`, `<a href="${BASE}">All cheat sheets</a>`, neighbours.next && `<a href="${neighbours.next.href}" rel="next">${escapeHtml(neighbours.next.title)} →</a>`].filter(Boolean).join('');
  const foot = `<footer class="cs-foot"><p class="cs-covers"><span>Covers</span>${sources}</p><nav class="cs-pager" aria-label="Cheat sheet navigation">${pager}</nav><p class="cs-stamp"><span>aiengineeringfromscratch.com${BASE}/${topic.id}</span><span>${copyLine(year)}</span><span>source ${topic.hash}</span></p></footer>`;
  return `<main id="main" class="cs-page cs-poster">${head}${cols}${foot}</main>`;
}

function topicCounts(topic) {
  const rows = topic.blocks.filter(block => TABLE_SHAPES[block.type]).reduce((sum, block) => sum + block.rows.length, 0);
  const diagrams = topic.blocks.filter(block => block.type === 'flow' || block.type === 'architecture').length;
  return { blocks: topic.blocks.length, rows, diagrams };
}

function tileHtml(topic) {
  const counts = topicCounts(topic);
  return `<li class="cs-tile" data-kind="${topic.kind}" style="--h:${topic.hue}"><a href="${topic.href}"><span class="cs-code" aria-hidden="true">${escapeHtml(topic.code)}</span><span class="cs-tile-name">${escapeHtml(topic.title)}</span><span class="cs-tile-sub">${escapeHtml(plain(topic.subtitle))}</span><span class="cs-tile-meta"><span class="cs-tile-kind">${KIND_LABELS[topic.kind]}</span>${counts.rows} rows · ${counts.diagrams} ${counts.diagrams === 1 ? 'diagram' : 'diagrams'}</span></a></li>`;
}

function indexMain(topics, year, phases) {
  const search = `<div class="cs-search" role="search"><label for="cs-q" class="cs-kicker">Search topics, tasks, commands and terms</label><input id="cs-q" type="search" autocomplete="off" spellcheck="false" placeholder="mem fraction, causal mask, budget" data-index="${BASE}/search.json"><p class="cs-search-count" aria-live="polite"></p><ol class="cs-results" hidden></ol></div>`;
  const tracks = TRACKS.map(([slug, label]) => ({ slug, label, topics: topics.filter(topic => topic.track === slug).sort((a, b) => a.title.localeCompare(b.title)) })).filter(track => track.topics.length);
  const kinds = Object.keys(KIND_LABELS).map(kind => [kind, topics.filter(topic => topic.kind === kind).length]).filter(([, count]) => count);
  const filters = `<div class="cs-filters"><div class="cs-filter-kinds" role="group" aria-label="Show one kind of sheet"><button type="button" data-kind="" aria-pressed="true">All <span>${topics.length}</span></button>${kinds.map(([kind, count]) => `<button type="button" data-kind="${kind}" aria-pressed="false">${KIND_LABELS[kind]} <span>${count}</span></button>`).join('')}</div><nav class="cs-track-nav" aria-label="Tracks">${tracks.map(track => `<a href="${BASE}#t-${track.slug}">${escapeHtml(track.label)} <span>${track.topics.length}</span></a>`).join('')}</nav><p class="cs-filter-count" aria-live="polite"></p></div>`;
  const sections = tracks.map(track => `<section class="cs-index-section cs-track" id="t-${track.slug}" aria-labelledby="h-${track.slug}"><h2 id="h-${track.slug}">${escapeHtml(track.label)} <span class="cs-count">${track.topics.length}</span></h2><ol class="cs-tiles">${track.topics.map(tileHtml).join('')}</ol></section>`).join('');
  const byPhase = phases.filter(phase => phase.topics.length).map(phase => `<li id="p-${phase.slug}"><a href="/phase/${phase.slug}">${escapeHtml(phase.label)}</a><span>${phase.topics.map(topic => `<a href="${topic.href}">${escapeHtml(topic.title)}</a>`).join(', ')}</span></li>`).join('');
  const head = `<header class="cs-index-head"><p class="cs-kicker">AI Engineering from Scratch</p><h1>Cheat sheets</h1><p class="cs-sub">${topics.length} posters. Each poster holds the tasks, commands, code, diagrams, defaults and fixes that you use while you work. Every fact comes from a lesson, a manual or a project of this course.</p>${search}${filters}</header>`;
  const phaseList = byPhase ? `<section class="cs-index-section" aria-labelledby="by-phase"><h2 id="by-phase">By phase</h2><ul class="cs-by-phase">${byPhase}</ul></section>` : '';
  const how = '<section class="cs-index-section" aria-labelledby="how"><h2 id="how">How to use them</h2><ul class="cs-tips"><li>Each colour means one kind of block. Blue blocks are tasks and commands. Red blocks are fixes. The key is at the top of each poster.</li><li>Click a command to copy it. Replace each value in angle brackets, such as <code>&lt;model&gt;</code>.</li><li>The foot of each poster lists the lessons and manuals that it covers. Open one when you need the reason.</li><li>Print a poster on one or two landscape pages. It fits A4 and Letter paper.</li></ul></section>';
  return `<main id="main" class="cs-page cs-index">${head}${sections}${phaseList}${how}<footer class="cs-foot"><p class="cs-stamp"><span>aiengineeringfromscratch.com${BASE}</span><span>${copyLine(year)}</span></p></footer></main>`;
}

function shell({ title, description, href, card, main, bodyClass, hue = 222 }, assets) {
  const canonical = ORIGIN + href;
  const image = `${ORIGIN}/og/${card}.png`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="/">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="AI Engineering from Scratch">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
${assets.head}
<script>${THEME_SCRIPT}</script>
</head>
<body class="${bodyClass}" style="--h:${hue}">
<a href="${href}#main" class="skip-link">Skip to content</a>
${SITE_HEADER}
${main}
${assets.body}
</body>
</html>
`;
}

function editionDate(root) {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  if (epoch > 0) return new Date(epoch * 1000).toISOString().slice(0, 10);
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch (_) {}
  return new Date().toISOString().slice(0, 10);
}

function topicFiles(root) {
  const dir = path.join(root, TOPIC_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.md') && name !== 'AUTHORING.md' && name !== 'README.md').sort().map(name => path.join(dir, name));
}

function trackOf(topic) {
  if (topic.kind === 'manual') return 'manuals';
  if (topic.kind === 'project') return 'projects';
  const counts = new Map();
  for (const source of topic.sources) {
    const phase = /^phases\/(\d{2})-/.exec(source);
    if (phase) counts.set(phase[1], (counts.get(phase[1]) || 0) + (phase[1] === '19' ? 0.5 : 1));
  }
  const best = Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!best) return topic.sources.some(source => source.startsWith('manuals/')) ? 'manuals' : 'projects';
  return (TRACKS.find(([, , phases]) => phases.includes(best[0])) || TRACKS[0])[0];
}

function loadTopics(root = REPO_ROOT) {
  const map = topicMap.loadTopicMap(root);
  const kinds = new Map(map.topics.map(entry => [entry.id, entry.kind]));
  const explainers = new Map(map.topics.filter(entry => entry.explainer).map(entry => [entry.id, entry.explainer]));
  return topicFiles(root).map(file => {
    const topic = parseTopic(fs.readFileSync(file, 'utf8'), file);
    topic.file = path.relative(root, file);
    topic.href = `${BASE}/${topic.id}`;
    topic.kind = kinds.get(topic.id) || 'concept';
    topic.explainer = explainers.get(topic.id) || '';
    topic.track = trackOf(topic);
    return topic;
  });
}

function coveredLessons(topic, root = REPO_ROOT) {
  const lessons = new Set();
  for (const source of topic.sources.concat(topic.blocks.flatMap(block => block.from))) {
    const lesson = /^phases\/([^/]+)\/([^/]+)/.exec(source);
    if (lesson) {
      lessons.add(`phases/${lesson[1]}/${lesson[2]}`);
      continue;
    }
    const phase = /^phases\/([^/]+)\/?$/.exec(source);
    if (phase && fs.existsSync(path.join(root, source))) {
      for (const name of fs.readdirSync(path.join(root, source)).sort()) {
        if (fs.existsSync(path.join(root, source, name, 'docs', 'en.md'))) lessons.add(`phases/${phase[1]}/${name}`);
      }
    }
  }
  return Array.from(lessons).sort();
}

function coverage(topics, root = REPO_ROOT) {
  const lessons = {};
  const phases = {};
  for (const topic of topics) {
    for (const lesson of coveredLessons(topic, root)) {
      (lessons[lesson] = lessons[lesson] || []).push({ id: topic.id, title: topic.title, href: topic.href });
      const slug = phaseSlug(lesson.split('/')[1]);
      phases[slug] = phases[slug] || [];
      if (!phases[slug].some(item => item.id === topic.id)) phases[slug].push({ id: topic.id, title: topic.title, href: topic.href });
    }
  }
  return { lessons, phases };
}

function phaseList(root, map) {
  const dir = path.join(root, 'phases');
  return fs.readdirSync(dir).filter(name => /^\d+-/.test(name)).sort().map(name => {
    const readme = path.join(dir, name, 'README.md');
    const text = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : '';
    const title = /^#\s+(Phase\s+\d+\s*:\s*.+?)\s*$/m.exec(text);
    const slug = phaseSlug(name);
    return { slug, label: title ? title[1] : name, topics: map.phases[slug] || [] };
  });
}

function searchRow(title, rest, blockId, showDetail) {
  const detail = plain(rest);
  let shown = '';
  if (showDetail) shown = detail.length <= SEARCH_DETAIL ? detail : `${detail.slice(0, SEARCH_DETAIL - 1)}…`;
  const spans = (rest.match(/`[^`]+`/g) || []).join(' ').replace(/`/g, '');
  const extra = factTokens(spans).filter(token => !shown.includes(token) && !title.includes(token));
  return extra.length ? [title, shown, blockId, extra.join(' ')] : [title, shown, blockId];
}

function searchIndex(topics) {
  return topics.map(topic => ({
    i: topic.id,
    t: topic.title,
    c: topic.code,
    h: topic.hue,
    k: topic.kind,
    b: topic.blocks.map(block => block.id),
    r: topic.blocks.flatMap((block, index) => {
      if (TABLE_SHAPES[block.type]) return block.rows.map(row => searchRow(plain(row[0]), row.slice(1).join(' · '), index, block.type === 'task-table' || block.type === 'defaults'));
      if (block.type === 'concepts' || block.type === 'glossary') return block.items.map(item => searchRow(plain(item.lead), item.text, index, block.type === 'glossary'));
      return [[plain(block.title), '', index]];
    }),
  }));
}

function topicErrors(topics) {
  return topics.flatMap(topic => topic.errors.map(error => `${topic.file}: ${error}`));
}

function buildCheatsheets({ root = REPO_ROOT, siteDir = __dirname, edition } = {}) {
  const topics = loadTopics(root);
  const invalid = topicErrors(topics);
  if (invalid.length) throw new Error(`Cheat sheet topics have errors. Run node site/build-cheatsheets.js --check for the full report.\n${invalid.join('\n')}`);
  const assets = { head: versionHtml(HEAD_ASSETS, siteDir), body: versionHtml(BODY_ASSETS, siteDir) };
  const date = edition || editionDate(root);
  const year = date.slice(0, 4);
  const map = coverage(topics, root);
  const phases = phaseList(root, map);
  const pages = [{
    file: 'index.html',
    href: BASE,
    html: shell({ title: 'Cheat sheets - AI Engineering from Scratch', description: 'Printable cheat sheets: tasks, commands, annotated code, diagrams, defaults and fixes for each topic of AI Engineering from Scratch.', href: BASE, card: 'page/home', main: indexMain(topics, year, phases), bodyClass: 'cs-body' }, assets),
  }];
  topics.forEach((topic, index) => {
    const neighbours = { previous: topics[index - 1], next: topics[index + 1] };
    pages.push({
      file: `${topic.id}.html`,
      href: topic.href,
      html: shell({ title: `${topic.title} cheat sheet - AI Engineering from Scratch`, description: `${topic.title} cheat sheet. ${plain(topic.subtitle)}`, href: topic.href, card: 'page/home', main: posterMain(topic, year, neighbours), bodyClass: 'cs-body', hue: topic.hue }, assets),
    });
  });
  return { topics, pages, date, map, search: JSON.stringify(searchIndex(topics)) };
}

function readSources(sources, root, cache) {
  return sources.map(source => {
    if (cache.has(source)) return cache.get(source);
    const full = path.join(root, source);
    let text = '';
    const walk = target => {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        for (const name of fs.readdirSync(target).sort()) {
          if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__') continue;
          walk(path.join(target, name));
        }
      } else if (SOURCE_EXTENSIONS.test(target) && stat.size < 2000000) {
        text += `\n${fs.readFileSync(target, 'utf8')}`;
      }
    };
    if (fs.existsSync(full)) walk(full);
    cache.set(source, text);
    return text;
  }).join('\n');
}

function factTokens(text) {
  const cleaned = String(text).replace(/<[a-z][a-z0-9_ -]*>/gi, ' ');
  const tokens = new Set();
  for (const match of cleaned.matchAll(/(?:^|[\s`(=])(--[a-z][a-z0-9-]*)/g)) tokens.add(match[1]);
  for (const match of cleaned.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+\b/g)) {
    if (!/^(?:e\.g|i\.e)$/i.test(match[0]) && !/\.(?:md|py|ts|js|json|txt|log|yaml|sh)$/.test(match[0])) tokens.add(match[0]);
  }
  for (const match of cleaned.matchAll(/\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/g)) tokens.add(match[0]);
  for (const match of cleaned.matchAll(/\b([A-Za-z_][A-Za-z0-9_]{2,})\(/g)) tokens.add(match[1]);
  return Array.from(tokens);
}

function blockFacts(block) {
  const facts = [];
  if (TABLE_SHAPES[block.type]) {
    for (const row of block.rows) {
      const codeCells = row.filter(cell => /`/.test(cell)).map(cell => (cell.match(/`([^`]+)`/g) || []).map(span => span.slice(1, -1)).join(' '));
      for (const token of factTokens(codeCells.join(' '))) facts.push(token);
      if (block.type === 'defaults') {
        const value = row[1].replace(/`/g, '').trim();
        if (value && !/^(?:none|off|on|yes|no|true|false)$/i.test(value)) facts.push(value);
      }
    }
  } else if (block.type === 'annotated-code') {
    const pattern = COMMENT[block.lang] || COMMENT.bash;
    for (const line of block.code) {
      if (FULL_COMMENT.test(line)) continue;
      const match = pattern.exec(line);
      for (const token of factTokens(match ? line.slice(0, match.index) : line)) facts.push(token);
    }
  } else if (block.type === 'architecture') {
    for (const node of block.nodes) for (const token of factTokens(`${node.label} ${node.sub}`)) facts.push(token);
  } else if (block.items) {
    for (const item of block.items) {
      const spans = (`${item.lead} ${item.text}`.match(/`([^`]+)`/g) || []).map(span => span.slice(1, -1)).join(' ');
      for (const token of factTokens(spans)) facts.push(token);
    }
  }
  return Array.from(new Set(facts));
}

function checkTopic(topic, root = REPO_ROOT, cache = new Map()) {
  const problems = topic.errors.map(error => `${topic.file}: ${error}`);
  if (problems.length) return problems;
  for (const source of topic.sources) {
    if (!fs.existsSync(path.join(root, source))) problems.push(`${topic.file}: source ${source} does not exist`);
  }
  for (const block of topic.blocks) {
    for (const source of block.from) {
      if (path.posix.normalize(source) !== source || source.split('/').includes('..') || path.isAbsolute(source)) problems.push(`${topic.file}: block "${block.title}" names ${source}, which is not a plain repository path`);
      else if (!topic.sources.some(allowed => source === allowed || source.startsWith(`${allowed.replace(/\/+$/, '')}/`))) problems.push(`${topic.file}: block "${block.title}" names ${source}, which is not a source of this topic`);
    }
    const missing = block.from.filter(source => !fs.existsSync(path.join(root, source)));
    for (const source of missing) problems.push(`${topic.file}: block "${block.title}" names ${source}, which does not exist`);
    if (missing.length) continue;
    const text = readSources(block.from, root, cache);
    for (const fact of blockFacts(block)) {
      if (!text.includes(fact)) problems.push(`${topic.file}: block "${block.title}": "${fact}" is not in its from files`);
    }
  }
  if (topic.subtitle.length > MAX_SUBTITLE) problems.push(`${topic.file}: the subtitle has ${topic.subtitle.length} characters, the limit is ${MAX_SUBTITLE}`);
  const { pages } = layout(topic);
  if (pages > MAX_PAGES) problems.push(`${topic.file}: the poster needs ${pages} pages, the limit is ${MAX_PAGES}`);
  return problems;
}

const MAINTAINER_ONLY = /capture\/(?:gpu\/)?run\.py|\bpython3? run\.py\b|\brun\.py --(?:check|build-fixtures|only)\b|--build-fixtures|build-manuals\.js|build-cheatsheets\.js|build-projects\.js|audit_manuals|audit_lessons|\bmanual\.json\b|site\/data\.js|\.github\/workflows|\bnode (?:site|scripts)\/|\bcapture kit\b|\btimeoutSeconds\b|SGLANG_KIT_PROFILE|\bREA_COMMAND\b/i;
const BLANK_CELL = /^(?:|-|tbd|todo|\.\.\.|…)$/i;

function blockTexts(block) {
  const texts = [block.title];
  if (block.header) texts.push(block.header.join(' '));
  if (block.rows) for (const row of block.rows) texts.push(row.join(' '));
  if (block.items) for (const item of block.items) texts.push(`${item.lead} ${item.text}`);
  if (block.code) texts.push(...block.code);
  if (block.nodes) for (const node of block.nodes) texts.push(`${node.label} ${node.sub || ''}`);
  if (block.edges) for (const edge of block.edges) texts.push(edge.label);
  return texts.map(plain);
}

function maintainerContent(topic) {
  return topic.blocks.filter(block => blockTexts(block).some(text => MAINTAINER_ONLY.test(text))).map(block => block.title);
}

function incompleteRows(topic) {
  const found = [];
  for (const block of topic.blocks) {
    if (!block.rows) continue;
    for (const row of block.rows) {
      if (row.some(cell => BLANK_CELL.test(plain(cell).trim()))) found.push(`${block.title}: ${plain(row[0])}`);
    }
  }
  return found;
}

const EMPTY_VALUES = /^(?:|-|n\/a|tbd|todo|not given|not covered|not listed|not stated|none stated|no number given|unknown)$/i;
const QUALITY_RULES = {
  concept: { doRows: 4, troubleRows: 3 },
  commands: { doRows: 8, troubleRows: 3, code: true },
  comparison: { doRows: 3, troubleRows: 3, compare: true },
  debugging: { doRows: 4, troubleRows: 5 },
  manual: { doRows: 8, troubleRows: 3, code: true },
  project: { doRows: 6, troubleRows: 3 },
};

function blockSize(block) {
  if (TABLE_SHAPES[block.type]) return block.rows.length;
  if (block.type === 'annotated-code') return block.code.filter(line => line.trim()).length;
  if (block.type === 'architecture') return block.nodes.length;
  return (block.items || []).length;
}

function qualityReport(topic) {
  const rules = QUALITY_RULES[topic.kind] || QUALITY_RULES.concept;
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass, detail });
  const types = new Set(topic.blocks.map(block => block.type));
  const rows = type => topic.blocks.filter(block => block.type === type).reduce((sum, block) => sum + block.rows.length, 0);
  const doRows = rows('task-table') + rows('command-table');
  add('blocks', topic.blocks.length >= 10 && topic.blocks.length <= 14, `${topic.blocks.length} blocks, 10 to 14 needed`);
  add('variety', types.size >= 6, `${types.size} block types, 6 needed`);
  add('tasks', doRows >= rules.doRows, `${doRows} task or command rows, ${rules.doRows} needed for a ${topic.kind} sheet`);
  add('diagram', types.has('flow') || types.has('architecture'), 'a flow or architecture diagram');
  add('troubleshooting', rows('troubleshooting') >= rules.troubleRows, `${rows('troubleshooting')} troubleshooting rows, ${rules.troubleRows} needed`);
  add('recall', types.has('qa') || types.has('tips'), 'a qa or tips block');
  if (rules.code) add('code', types.has('annotated-code'), 'an annotated-code block');
  if (rules.compare) add('comparison', types.has('comparison'), 'a comparison table');
  const emptyDefaults = topic.blocks.filter(block => block.type === 'defaults').flatMap(block => block.rows.filter(row => EMPTY_VALUES.test(plain(row[1])))).map(row => plain(row[0]));
  add('defaults', !emptyDefaults.length, emptyDefaults.length ? `defaults without a value: ${emptyDefaults.join(', ')}` : 'every default has a value');
  const minimum = { 'annotated-code': 3, architecture: 3, flow: 3 };
  const thin = topic.blocks.filter(block => blockSize(block) < (minimum[block.type] || 2)).map(block => block.title);
  add('thin', !thin.length, thin.length ? `thin blocks: ${thin.join(', ')}` : 'no thin block');
  const seen = new Set();
  const duplicates = [];
  for (const block of topic.blocks) {
    const keys = TABLE_SHAPES[block.type] ? block.rows.map(row => plain(row.join(' ')).toLowerCase()) : (block.items || []).map(item => plain(`${item.lead} ${item.text}`).toLowerCase());
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
  }
  add('duplicates', !duplicates.length, duplicates.length ? `duplicate rows: ${duplicates.slice(0, 3).join(' | ')}` : 'no duplicate row');
  const maintainer = maintainerContent(topic);
  add('reader', !maintainer.length, maintainer.length ? `maintainer-only content in: ${maintainer.join(', ')}` : 'learner content only');
  const incomplete = incompleteRows(topic);
  add('complete', !incomplete.length, incomplete.length ? `rows with an empty cell: ${incomplete.slice(0, 3).join(' | ')}` : 'every row is complete');
  const overlaps = topic.blocks.filter(block => block.type === 'architecture').flatMap(block => [false, true].flatMap(narrow => architectureOverlaps(block, narrow).map(problem => `${block.title}${narrow ? ' (narrow)' : ''}: ${problem}`)));
  add('overlap', !overlaps.length, overlaps.length ? `diagram overlaps: ${overlaps.slice(0, 3).join(' | ')}` : 'no diagram overlap');
  const { pages } = layout(topic);
  add('fit', pages <= MAX_PAGES, `${pages} pages, ${MAX_PAGES} at most`);
  const passed = checks.filter(check => check.pass).length;
  return { id: topic.id, kind: topic.kind, score: Math.round((passed / checks.length) * 100), pass: passed === checks.length, failures: checks.filter(check => !check.pass).map(check => `${check.name}: ${check.detail}`) };
}

function checkLinks(built, root = REPO_ROOT) {
  const known = new Set(built.pages.map(page => page.href));
  const fixed = new Set(['/', '/catalog', '/roadmap', '/glossary', '/about', BASE]);
  const broken = [];
  const manuals = new Set(fs.existsSync(path.join(root, 'manuals')) ? fs.readdirSync(path.join(root, 'manuals')) : []);
  for (const page of built.pages) {
    for (const match of page.html.matchAll(/\shref="([^"]+)"/g)) {
      const href = match[1].replace(/&amp;/g, '&');
      if (/^https:\/\/fonts\.(?:googleapis|gstatic)\.com/.test(href) || href.startsWith('#')) continue;
      const asset = /^\/([a-z0-9./-]+\.(?:css|js|ico|svg|png))(?:\?.*)?$/.exec(href);
      if (asset) {
        if (!fs.existsSync(path.join(root, 'site', asset[1]))) broken.push({ page: page.href, href });
        continue;
      }
      if (href.startsWith(`${REPO}/blob/main/`)) {
        if (!fs.existsSync(path.join(root, href.slice(`${REPO}/blob/main/`.length).split('#')[0]))) broken.push({ page: page.href, href });
        continue;
      }
      if (/^https?:/.test(href)) continue;
      const target = href.split('#')[0];
      if (!target || known.has(target) || fixed.has(target)) continue;
      const lesson = /^\/lesson\?path=(phases\/[a-z0-9-]+\/[a-z0-9-]+)$/.exec(target);
      if (lesson && fs.existsSync(path.join(root, lesson[1], 'docs', 'en.md'))) continue;
      const phase = /^\/phase\/([a-z0-9-]+)$/.exec(target);
      if (phase) continue;
      const manual = /^\/manual-([a-z0-9-]+)$/.exec(target);
      if (manual && manuals.has(manual[1])) continue;
      const explainer = /^\/(inside-[a-z0-9-]+)$/.exec(target);
      if (explainer && fs.existsSync(path.join(root, 'site', `${explainer[1]}.html`))) continue;
      broken.push({ page: page.href, href });
    }
  }
  return broken;
}

function writeCheatsheets({ root = REPO_ROOT, siteDir = __dirname, edition } = {}) {
  const built = buildCheatsheets({ root, siteDir, edition });
  const outDir = path.join(siteDir, OUTPUT_DIR);
  const files = new Map(built.pages.map(page => [path.join(outDir, page.file), page.html]));
  files.set(path.join(outDir, 'search.json'), `${built.search}\n`);
  if (fs.existsSync(outDir)) {
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          if (!fs.readdirSync(full).length) fs.rmdirSync(full);
        } else if (!files.has(full)) {
          fs.unlinkSync(full);
        }
      }
    };
    walk(outDir);
  }
  for (const [file, body] of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  fs.writeFileSync(path.join(siteDir, 'cheatsheet-map.json'), `${JSON.stringify(built.map)}\n`, 'utf8');
  return built;
}

function printHtml(built) {
  const year = built.date.slice(0, 4);
  const cover = `<section class="cs-cover"><div class="cs-cover-stamp"><span>AI Engineering from Scratch · Cheat sheets</span><span class="cs-cover-copy">${copyLine(year)}</span></div><h1>Cheat sheets</h1><p class="cs-sub">${built.topics.length} topic posters: tasks, commands, annotated code, diagrams, defaults and fixes.</p><ol class="cs-cover-list">${built.topics.map(topic => `<li style="--h:${topic.hue}"><span class="cs-code">${escapeHtml(topic.code)}</span>${escapeHtml(topic.title)}</li>`).join('')}</ol><div class="cs-cover-edition"><p>Edition ${escapeHtml(built.date)}. The newest edition is at the link below.</p><p><a href="${ORIGIN}${BASE}">aiengineeringfromscratch.com${BASE}</a> · <a href="${REPO}">source on GitHub</a></p></div></section>`;
  const posters = built.topics.map((topic, index) => `<section class="cs-print-topic" style="--h:${topic.hue}">${posterMain(topic, year, { previous: built.topics[index - 1], next: built.topics[index + 1] })}</section>`).join('');
  const colophon = `<section class="cs-colophon"><p class="cs-kicker">About this edition</p><p>Cheat sheets, edition ${escapeHtml(built.date)}, by ${AUTHOR}. They are part of AI Engineering from Scratch, an open source course at <a href="${ORIGIN}">aiengineeringfromscratch.com</a>. The newest edition is always at <a href="${ORIGIN}${BASE}">aiengineeringfromscratch.com${BASE}</a>.</p><p>Each poster comes from one file in the <code>cheatsheets/</code> folder of the repository. Each block names the lessons and manual sections that hold its facts. The build checks that each flag, function name and default in a block appears in those files.</p><p>${copyLine(year)}. You can copy and share these sheets. Keep this page and the copyright line with them. Report an error at <a href="${ISSUES_URL}">${ISSUES_URL.replace('https://', '')}</a>.</p></section>`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>Cheat sheets - AI Engineering from Scratch</title>
<meta name="author" content="${AUTHOR}">
<meta name="subject" content="Cheat sheets for AI Engineering from Scratch, edition ${escapeHtml(built.date)}">
<meta name="keywords" content="AI engineering, cheat sheet, LLM serving, agents, transformers">
<link href="${FONT_LINK}" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="cheatsheets.css">
<link rel="stylesheet" href="code.css">
<link rel="stylesheet" href="cheatsheets-print.css">
</head>
<body class="cs-body cs-print-edition">
${cover}${posters}${colophon}
<script src="cheatsheets.js"></script>
</body>
</html>
`;
}

function unescapeHtml(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function prerenderMath(html, katex) {
  const katexCss = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" crossorigin="anonymous">';
  return html
    .replace('</head>', `${katexCss}\n</head>`)
    .replace(/<(div|span) class="(math-display|math-inline)" data-math="(display|inline)">([\s\S]*?)<\/\1>/g, (match, tag, kind, mode, tex) => {
      try {
        const rendered = katex.renderToString(unescapeHtml(tex), { displayMode: mode === 'display', throwOnError: true, strict: 'ignore', trust: false });
        return `<${tag} class="${kind}" data-math="${mode}" data-math-rendered>${rendered}</${tag}>`;
      } catch (_) {
        return match;
      }
    });
}

function writePrint(outDir, options = {}) {
  const built = buildCheatsheets(options);
  fs.mkdirSync(outDir, { recursive: true });
  const html = printHtml(built);
  fs.writeFileSync(path.join(outDir, 'print.html'), options.katex ? prerenderMath(html, options.katex) : html, 'utf8');
  for (const name of ['style.css', 'cheatsheets.css', 'code.css', 'cheatsheets-print.css', 'cheatsheets.js']) {
    fs.copyFileSync(path.join(__dirname, name), path.join(outDir, name));
  }
  return built;
}

const CLI_FLAGS = new Set(['--check', '--check-topic', '--check-quality', '--status', '--print', '--edition', '--katex']);

async function main(argv) {
  await code.init();
  const unknown = argv.filter(arg => arg.startsWith('--') && !CLI_FLAGS.has(arg));
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(', ')}. Options: ${Array.from(CLI_FLAGS).join(', ')}`);
    return 2;
  }
  const flag = name => argv.includes(name);
  const value = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : '';
  };
  if (flag('--check-topic')) {
    const file = path.resolve(value('--check-topic'));
    const topic = parseTopic(fs.readFileSync(file, 'utf8'), file);
    topic.file = path.relative(REPO_ROOT, file);
    const problems = checkTopic(topic);
    if (topic.errors.length) {
      for (const problem of problems) console.error(`  ${problem}`);
      return 1;
    }
    const { pages, used } = layout(topic);
    console.log(`${topic.file}: ${topic.blocks.length} blocks on ${pages} page(s). Height used per page: ${used.map((value, index) => `${value} of ${PAGE_BUDGETS[index] || PAGE_BUDGETS[PAGE_BUDGETS.length - 1]}px`).join(', ')}.`);
    for (const problem of problems) console.error(`  ${problem}`);
    return problems.length ? 1 : 0;
  }
  if (flag('--print')) {
    const katexPath = value('--katex');
    const katex = katexPath ? require(path.resolve(katexPath)) : null;
    const built = writePrint(path.resolve(value('--print')), { edition: value('--edition') || undefined, katex });
    console.log(`Wrote the print edition of ${built.topics.length} topic posters to ${value('--print')}/print.html`);
    return 0;
  }
  if (flag('--check-quality')) {
    const reports = loadTopics().map(qualityReport);
    for (const report of reports) console.log(`${String(report.score).padStart(3)}  ${report.id}${report.pass ? '' : `  ${report.failures.join('; ')}`}`);
    const failed = reports.filter(report => !report.pass);
    console.log(`Quality: ${reports.length - failed.length} of ${reports.length} sheets pass the rubric. Mean score ${Math.round(reports.reduce((sum, report) => sum + report.score, 0) / reports.length)}.`);
    return failed.length ? 1 : 0;
  }
  if (flag('--status')) {
    const topics = loadTopics();
    console.log(JSON.stringify(topicMap.mapStatus(topicMap.loadTopicMap(REPO_ROOT), topics, REPO_ROOT), null, 2));
    return 0;
  }
  if (flag('--check')) {
    const invalid = topicErrors(loadTopics());
    if (invalid.length) {
      for (const problem of invalid) console.error(`  ${problem}`);
      return 1;
    }
    const first = buildCheatsheets({ edition: '2026-01-01' });
    const second = buildCheatsheets({ edition: '2026-01-01' });
    const problems = [];
    const digest = built => sha(built.pages.map(page => `${page.file}\n${page.html}`).join('\n') + built.search);
    if (digest(first) !== digest(second)) problems.push('two builds of the same input gave different bytes');
    const cache = new Map();
    for (const topic of first.topics) problems.push(...checkTopic(topic, REPO_ROOT, cache));
    const ids = first.topics.map(topic => topic.id);
    if (new Set(ids).size !== ids.length) problems.push('two topics share an id');
    const codes = first.topics.map(topic => topic.code);
    if (new Set(codes).size !== codes.length) problems.push('two topics share a code');
    for (const item of checkLinks(first)) problems.push(`broken link on ${item.page}: ${item.href}`);
    const map = topicMap.loadTopicMap(REPO_ROOT);
    problems.push(...topicMap.mapProblems(map, first.topics, REPO_ROOT));
    const evidence = evidenceCheck.checkEvidence(map, first.topics, REPO_ROOT);
    problems.push(...evidence.problems);
    const status = topicMap.mapStatus(map, first.topics, REPO_ROOT);
    console.log(`Checked ${first.topics.length} cheat sheet topics (${first.topics.reduce((sum, topic) => sum + topic.blocks.length, 0)} blocks).`);
    console.log(`Resolved ${evidence.refs} evidence references in ${first.topics.length} evidence files.`);
    console.log(`Coverage: ${status.coverage.covered} of ${status.coverage.total} lessons, manuals and projects are in ${map.topics.length} topics (${status.coverage.lessons} of ${status.coverage.lessonTotal} lessons).`);
    if (status.missing.length) console.log(`${status.missing.length} topics have no sheet yet: ${status.missing.join(', ')}. The cheat sheet generate workflow writes them.`);
    if (status.stale.length) console.log(`${status.stale.length} sheets are older than their sources: ${status.stale.join(', ')}.`);
    for (const problem of problems) console.error(`  ${problem}`);
    return problems.length ? 1 : 0;
  }
  const built = writeCheatsheets({ edition: value('--edition') || undefined });
  console.log(`Wrote ${built.topics.length} cheat sheet posters to site/${OUTPUT_DIR}/`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(status => { process.exitCode = status; }, error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { qualityReport, QUALITY_RULES, MAINTAINER_ONLY, maintainerContent, incompleteRows, trackOf, parseTopic, loadTopics, buildCheatsheets, writeCheatsheets, writePrint, printHtml, prerenderMath, checkTopic, checkLinks, coverage, layout, factTokens, blockFacts, architectureSvg, architectureLayout, architectureOverlaps, flowSvg, TYPES };
