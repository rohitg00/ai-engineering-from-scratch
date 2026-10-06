#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { githubSourceUrl } = require('./build.js');
const { localPath, within } = require('./build-projects.js');
const figkit = require('../manuals/_shared/figkit.js');
const { validateSvg } = require('../manuals/_shared/svg.js');

const ROOT = path.resolve(__dirname, '..');
const MANUALS = path.join(ROOT, 'manuals');
const SITE = __dirname;
const SITE_ORIGIN = 'https://aiengineeringfromscratch.com';
const RELEASE_URL = 'https://github.com/rohitg00/ai-engineering-from-scratch/releases/latest/download';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS = ['sequence', 'structure', 'flow', 'comparison', 'timeline', 'tree', 'state', 'decision', 'layers'];
const WIRE_LANGS = new Set(['json', 'jsonl', 'http', 'sse']);
const SCHEMA = JSON.parse(fs.readFileSync(path.join(MANUALS, 'manual.schema.json'), 'utf8'));
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const TAKEAWAYS_LABEL = 'What to do with this';
const OUTCOME_PHRASE = 'When you finish this section, you can';
const THEME_SCRIPT = "(function(){var r=document.documentElement,s='';try{s=localStorage.getItem('theme')||'';}catch(_){}r.setAttribute('data-theme',s||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));function icon(){var i=document.getElementById('themeIcon');if(i)i.textContent=r.getAttribute('data-theme')==='light'?'N':'D';}icon();document.addEventListener('DOMContentLoaded',function(){icon();var b=document.getElementById('themeToggle');if(b)b.addEventListener('click',function(){var n=r.getAttribute('data-theme')==='light'?'dark':'light';r.setAttribute('data-theme',n);try{localStorage.setItem('theme',n);}catch(_){}icon();});});})();";
const escapeHtml = figkit.escapeHtml;

function ensure(condition, message) { if (!condition) throw new Error(message); }
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { throw new Error(`${rel(file)}: ${error.message}`); }
}
function shared(name) { return fs.readFileSync(path.join(MANUALS, '_shared', name), 'utf8'); }
function slugify(text) {
  return String(text).toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}
function sectionAnchor(id) { return `s-${String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
function pageName(id) { return `manual-${id}.html`; }
function text(value, label) { ensure(typeof value === 'string' && value.trim(), `${label}: nonempty text required`); return value; }

function keyValues(lines, label, allowed) {
  const values = {};
  let last = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = /^([a-z][a-z-]*):\s*(.*)$/.exec(line);
    if (match) {
      ensure(allowed.includes(match[1]), `${label}: unknown key "${match[1]}"`);
      ensure(!(match[1] in values), `${label}: duplicate key "${match[1]}"`);
      values[match[1]] = match[2].trim();
      last = match[1];
    } else {
      ensure(last && /^\s{2,}\S/.test(line), `${label}: expected "key: value", got "${line.trim()}"`);
      values[last] = `${values[last]} ${line.trim()}`;
    }
  }
  return values;
}

function splitHeader(body, label) {
  const index = body.findIndex(line => /^---\s*$/.test(line));
  ensure(index >= 0, `${label}: header and body must be separated by a "---" line`);
  return { head: body.slice(0, index), rest: body.slice(index + 1) };
}

function fenceBlock(info, body, label) {
  if (info === 'figure') {
    const values = keyValues(body, label, ['id', 'kind', 'title', 'claim', 'caption']);
    for (const key of ['id', 'kind', 'title', 'claim', 'caption']) ensure(values[key], `${label}: figure "${key}" required`);
    ensure(SLUG.test(values.id), `${label}: figure id "${values.id}" must be lowercase and hyphenated`);
    ensure(KINDS.includes(values.kind), `${label}: figure ${values.id} kind must be one of ${KINDS.join(', ')}`);
    return { type: 'figure', ...values };
  }
  if (info === 'listing') {
    const { head, rest } = splitHeader(body, label);
    const values = keyValues(head, label, ['title', 'source', 'lang', 'note']);
    for (const key of ['title', 'source', 'lang']) ensure(values[key], `${label}: listing "${key}" required`);
    while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
    ensure(rest.length, `${label}: listing ${values.source} needs a body`);
    return { type: 'listing', ...values, code: rest.join('\n') };
  }
  if (info === 'rule') {
    const { head, rest } = splitHeader(body, label);
    const values = keyValues(head, label, ['label', 'source']);
    ensure(values.label && values.source, `${label}: rule "label" and "source" required`);
    const quote = rest.map(line => line.trim()).filter(Boolean).join(' ');
    ensure(quote, `${label}: rule needs a quote`);
    return { type: 'rule', ...values, quote };
  }
  if (info === 'takeaways') {
    const items = [];
    for (const line of body) {
      if (!line.trim()) continue;
      const match = /^[-*]\s+(.*)$/.exec(line);
      if (match) items.push(match[1].trim());
      else {
        ensure(items.length && /^\s{2,}\S/.test(line), `${label}: takeaways use "- item" lines`);
        items[items.length - 1] += ` ${line.trim()}`;
      }
    }
    ensure(items.length >= 2, `${label}: takeaways need at least two items`);
    return { type: 'takeaways', items };
  }
  if (['palette', 'parts', 'figure-index', 'contents'].includes(info)) {
    ensure(!body.some(line => line.trim()), `${label}: a ${info} block must be empty`);
    return { type: info };
  }
  ensure(/^[a-z0-9-]+$/.test(info), `${label}: every code fence needs a language tag`);
  return { type: 'code', lang: info, code: body.join('\n') };
}

function splitRow(line) {
  const cells = [];
  let current = '';
  let inCode = false;
  const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '\\' && row[i + 1] === '|') { current += '|'; i += 1; continue; }
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode) { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

const BLOCK_START = [/^```/, /^#{1,6}\s/, /^([-*]|\d+\.)\s+/, /^\|/, /^>/];
const TABLE_RULE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function parseDocument(source, label) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  const at = line => `${label}:${line}`;
  const skipBlank = () => { while (i < lines.length && !lines[i].trim()) i += 1; };
  skipBlank();
  const heading = /^#\s+(.+?)\s*$/.exec(lines[i] || '');
  ensure(heading, `${label}: the first line must be "# Title"`);
  const title = heading[1];
  const titleLine = i + 1;
  i += 1;
  skipBlank();
  let thesis = '';
  const thesisLine = i + 1;
  if (/^>\s?/.test(lines[i] || '')) {
    const parts = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) { parts.push(lines[i].replace(/^>\s?/, '').trim()); i += 1; }
    thesis = parts.join(' ').trim();
  }
  const blocks = [];
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const fence = /^```\s*([A-Za-z0-9_-]*)\s*$/.exec(line);
    if (fence) {
      const body = [];
      const start = i + 1;
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i += 1; }
      ensure(i < lines.length, `${at(start)}: this fence is never closed`);
      i += 1;
      blocks.push({ ...fenceBlock(fence[1], body, at(start)), line: start });
      continue;
    }
    const sub = /^(#{2,3})\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/.exec(line);
    if (sub) {
      blocks.push({ type: 'heading', level: sub[1].length, text: sub[2], id: sub[3] || '', line: i + 1 });
      i += 1;
      continue;
    }
    ensure(!/^#\s/.test(line), `${at(i + 1)}: only one "# " title per file`);
    ensure(!/^#{4,}\s/.test(line), `${at(i + 1)}: headings deeper than ### are not allowed`);
    ensure(!/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line), `${at(i + 1)}: horizontal rules are not allowed`);
    ensure(!/^>/.test(line), `${at(i + 1)}: a quote block is only allowed as the thesis; use a rule block`);
    ensure(!/^\s*<[a-zA-Z!/]/.test(line), `${at(i + 1)}: raw HTML is not allowed`);
    if (/^\|/.test(line) && TABLE_RULE.test(lines[i + 1] || '')) {
      const head = splitRow(line);
      const start = i + 1;
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const row = splitRow(lines[i]);
        ensure(row.length === head.length, `${at(i + 1)}: the row has ${row.length} cells and the header has ${head.length}`);
        rows.push(row);
        i += 1;
      }
      blocks.push({ type: 'table', head, rows, line: start });
      continue;
    }
    ensure(!/^\s+([-*]|\d+\.)\s+/.test(line), `${at(i + 1)}: nested lists are not allowed`);
    if (/^([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items = [];
      const start = i + 1;
      while (i < lines.length) {
        const item = /^([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (item) {
          ensure(/^\d+\./.test(item[1]) === ordered, `${at(i + 1)}: do not mix list markers`);
          items.push(item[2].trim());
          i += 1;
          continue;
        }
        if (items.length && /^\s{2,}\S/.test(lines[i])) {
          ensure(!/^\s+([-*]|\d+\.)\s+/.test(lines[i]), `${at(i + 1)}: nested lists are not allowed`);
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: 'list', ordered, items, line: start });
      continue;
    }
    const start = i + 1;
    const parts = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.some(pattern => pattern.test(lines[i]))) {
      parts.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: parts.join(' '), line: start });
  }
  return { title, titleLine, thesis, thesisLine, blocks };
}

function newInline() {
  return { refs: [], repoLinks: [] };
}

function inlineHtml(source, where, acc) {
  const codes = [];
  let html = String(source).replace(/`([^`]+)`/g, (match, code) => { codes.push(code); return `\u0000${codes.length - 1}\u0000`; });
  html = escapeHtml(html);
  html = html.replace(/\{\{(.+?)\}\}/g, (match, cite) => `<span class="m-cite">${cite}</span>`);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => linkHtml(label, href.replace(/&amp;/g, '&').replace(/&#39;/g, "'"), where, acc));
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>');
  return html.replace(/\u0000(\d+)\u0000/g, (match, index) => `<code>${escapeHtml(codes[Number(index)])}</code>`);
}

function linkHtml(label, href, where, acc) {
  if (href.startsWith('#')) {
    acc.refs.push({ id: href.slice(1), where });
    return `<a class="m-xref" href="${escapeHtml(href)}">${label}</a>`;
  }
  if (/^https?:\/\//.test(href)) return `<a href="${escapeHtml(href)}" rel="noopener">${label}</a>`;
  ensure(!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/'), `${where}: unsupported link target "${href}"`);
  const [target, fragment] = href.split('#');
  acc.repoLinks.push({ path: target, where });
  return `<a href="${escapeHtml(githubSourceUrl(target) + (fragment ? `#${fragment}` : ''))}" rel="noopener">${label}</a>`;
}

function highlightJson(line) {
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g;
  let out = '';
  let last = 0;
  let match;
  while ((match = pattern.exec(line))) {
    out += escapeHtml(line.slice(last, match.index));
    if (match[1]) out += `<span class="${match[2] ? 'm-tok-key' : 'm-tok-str'}">${escapeHtml(match[1])}</span>${match[2] ? escapeHtml(match[2]) : ''}`;
    else if (match[3]) out += `<span class="m-tok-num">${match[3]}</span>`;
    else out += `<span class="m-tok-lit">${match[4]}</span>`;
    last = pattern.lastIndex;
  }
  return out + escapeHtml(line.slice(last));
}

function highlightLine(line, lang) {
  if (/^\s*…\s*$/.test(line)) return `<span class="m-tok-dim">${escapeHtml(line)}</span>`;
  if (lang === 'json' || lang === 'jsonl') return highlightJson(line);
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S+ HTTP\/\d(\.\d)?$|^HTTP\/\d(\.\d)? \d{3}.*$/.test(line)) return `<span class="m-tok-meta">${escapeHtml(line)}</span>`;
  const field = /^(event|data|id|retry):(\s?)(.*)$/.exec(line);
  if (field) return `<span class="m-tok-meta">${field[1]}:</span>${field[2]}${field[1] === 'data' ? highlightJson(field[3]) : escapeHtml(field[3])}`;
  const header = /^([A-Za-z][A-Za-z0-9-]*):(\s.*)$/.exec(line);
  if (header) return `<span class="m-tok-key">${escapeHtml(header[1])}</span>:${escapeHtml(header[2])}`;
  return highlightJson(line);
}

function highlight(code, lang) {
  if (!WIRE_LANGS.has(lang)) return escapeHtml(code);
  return code.split('\n').map(line => highlightLine(line, lang)).join('\n');
}

function loadSvg(file, id, where) {
  const raw = fs.readFileSync(file, 'utf8').replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const result = validateSvg(raw, id, figkit.WIDTH);
  ensure(!result.issues.length, `${where}: ${rel(file)}: ${result.issues[0]}`);
  return { svg: raw, height: result.height };
}

function validateManifest(manual, label, dir) {
  for (const key of Object.keys(manual)) ensure(key in SCHEMA.properties, `${label}: unknown key "${key}"`);
  for (const key of SCHEMA.required) ensure(key in manual, `${label}: "${key}" required`);
  for (const key of ['title', 'subtitle', 'summary', 'audience']) text(manual[key], `${label}.${key}`);
  ensure(new RegExp(SCHEMA.properties.edition.pattern).test(manual.edition || ''), `${label}: edition must be YYYY.MM`);
  ensure(['draft', 'ready'].includes(manual.status), `${label}: status must be draft or ready`);
  const pin = manual.pin || {};
  for (const key of SCHEMA.properties.pin.required) text(pin[key], `${label}.pin.${key}`);
  ensure(/^https:\/\/\S+$/.test(pin.source), `${label}: pin.source must be an https URL`);
  ensure(pin.commit.length >= 7, `${label}: pin.commit needs at least seven characters`);
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(pin.date) && /^\d{4}-\d{2}-\d{2}$/.test(pin.verified), `${label}: pin dates must be YYYY-MM-DD`);
  ensure(Array.isArray(manual.outcomes) && manual.outcomes.length >= 3, `${label}: at least three outcomes required`);
  ensure(Array.isArray(manual.palette) && manual.palette.length >= 3, `${label}: the palette must map at least three hues`);
  const hues = new Set();
  for (const entry of manual.palette) {
    ensure(figkit.HUES.includes(entry.hue) && !hues.has(entry.hue), `${label}: palette hue "${entry.hue}" is unknown or repeated`);
    text(entry.meaning, `${label}: palette ${entry.hue}`);
    hues.add(entry.hue);
  }
  ensure(Array.isArray(manual.sources) && manual.sources.length, `${label}: a ranked sources list is required`);
  ensure(Array.isArray(manual.parts) && manual.parts.length, `${label}: parts required`);
  const quoteSources = {};
  for (const [key, file] of Object.entries(manual.quoteSources || {})) {
    ensure(/^[a-z][a-z0-9-]*$/.test(key), `${label}: quoteSources key "${key}" must be lowercase`);
    quoteSources[key] = file === null ? null : localPath(dir, file, `${label}.quoteSources.${key}`);
  }
  if (manual.capture !== undefined) {
    for (const key of ['run', 'check']) ensure(Array.isArray(manual.capture[key]) && manual.capture[key].length && manual.capture[key].every(arg => typeof arg === 'string' && arg), `${label}: capture.${key} must be a nonempty argv array`);
  }
  return quoteSources;
}

function loadManual(dir, options = {}) {
  const manifestFile = path.join(dir, 'manual.json');
  if (!fs.existsSync(manifestFile)) return null;
  const label = rel(manifestFile);
  const manual = readJson(manifestFile);
  const id = path.basename(dir);
  ensure(manual.id === id && SLUG.test(id), `${label}: id must match the lowercase hyphenated directory name`);
  const quoteSources = validateManifest(manual, label, dir);
  const documents = [];
  const readDoc = (file, meta) => {
    ensure(typeof file === 'string' && file.endsWith('.md'), `${label}: document path "${file}" must end in .md`);
    const full = localPath(dir, file, `${label}: document`);
    const doc = parseDocument(fs.readFileSync(full, 'utf8'), rel(full));
    documents.push({ ...meta, file, label: rel(full), ...doc });
    return documents[documents.length - 1];
  };
  const front = manual.front ? readDoc(manual.front, { kind: 'front', id: 'front', anchor: 's-front', prefix: '0', accent: 'grey' }) : null;
  const parts = manual.parts.map((part, index) => {
    const number = index + 1;
    ensure(part.number === number, `${label}: parts must be numbered 1..N in order`);
    text(part.title, `${label}: part ${number} title`);
    text(part.thesis, `${label}: part ${number} thesis`);
    ensure(figkit.HUES.includes(part.accent), `${label}: part ${number} accent must be a palette hue`);
    ensure(Array.isArray(part.sections) && part.sections.length, `${label}: part ${number} needs sections`);
    const sections = part.sections.map((entry, position) => {
      ensure(entry.id === `${number}.${position + 1}`, `${label}: part ${number} section ${position + 1} must have id "${number}.${position + 1}"`);
      return readDoc(entry.file, { kind: 'section', id: entry.id, anchor: sectionAnchor(entry.id), prefix: String(number), accent: part.accent });
    });
    return { ...part, anchor: `p-${number}`, sections };
  });
  let reference = null;
  if (manual.reference) {
    ensure(Array.isArray(manual.reference.sections) && manual.reference.sections.length, `${label}: reference needs sections`);
    const accent = manual.reference.accent || 'grey';
    ensure(figkit.HUES.includes(accent), `${label}: the reference accent must be a palette hue`);
    const sections = manual.reference.sections.map((entry, position) => {
      ensure(entry.id === `R.${position + 1}`, `${label}: reference section ${position + 1} must have id "R.${position + 1}"`);
      return readDoc(entry.file, { kind: 'reference', id: entry.id, anchor: sectionAnchor(entry.id), prefix: 'R', accent });
    });
    reference = { title: manual.reference.title || 'Reference', thesis: manual.reference.thesis || '', summary: manual.reference.summary || '', accent, anchor: 'p-r', sections };
  }
  const anchors = new Set([...parts.map(part => part.anchor), ...(reference ? ['p-r'] : [])]);
  const figures = new Map();
  const counters = new Map();
  for (const doc of documents) {
    ensure(!anchors.has(doc.anchor), `${label}: duplicate anchor ${doc.anchor}`);
    anchors.add(doc.anchor);
    for (const block of doc.blocks) {
      const where = `${doc.label}:${block.line}`;
      if (block.type === 'heading') {
        block.id = block.id || `${doc.anchor}-${slugify(block.text)}`;
        ensure(!anchors.has(block.id), `${where}: duplicate heading anchor ${block.id}`);
        anchors.add(block.id);
      }
      if (block.type === 'figure') {
        ensure(!figures.has(block.id) && !anchors.has(block.id), `${where}: duplicate figure id ${block.id}`);
        const count = (counters.get(doc.prefix) || 0) + 1;
        counters.set(doc.prefix, count);
        const art = loadSvg(localPath(dir, `figures/${block.id}.svg`, `${where}: figure`), block.id, where);
        Object.assign(block, { number: `${doc.prefix}.${count}`, art, accent: doc.accent, section: doc.id });
        figures.set(block.id, block);
        anchors.add(block.id);
      }
      if (block.type === 'listing') block.sourceFile = localPath(dir, block.source, `${where}: listing source`);
      if (block.type === 'rule') {
        const key = block.source.trim().split(/\s+/)[0];
        ensure(key in quoteSources, `${where}: rule source key "${key}" is not declared in manual.json quoteSources`);
      }
    }
  }
  let plate = null;
  if (manual.plate) {
    ensure(SLUG.test(manual.plate.figure || '') && manual.plate.title && manual.plate.caption, `${label}: plate needs a figure id, a title, and a caption`);
    plate = { ...manual.plate, art: loadSvg(localPath(dir, `figures/${manual.plate.figure}.svg`, `${label}: plate`), manual.plate.figure, label) };
  }
  const built = { ...manual, dir, front, parts, reference, figures, anchors, plate, documents, quoteSources };
  const acc = newInline();
  renderAll(built, acc);
  for (const ref of acc.refs) ensure(anchors.has(ref.id), `${ref.where}: link to unknown anchor #${ref.id}`);
  for (const link of acc.repoLinks) {
    const target = within(ROOT, path.join(ROOT, link.path));
    ensure(fs.existsSync(target), `${link.where}: repository link target missing ${link.path}`);
  }
  if (options.strict) ensure(manual.status === 'draft' || fs.existsSync(path.join(dir, 'README.md')), `${label}: ready manuals need README.md`);
  return built;
}

function* proseSpans(manual) {
  const label = rel(path.join(manual.dir, 'manual.json'));
  yield { text: manual.subtitle, kind: 'label', where: `${label} subtitle` };
  yield { text: manual.summary, kind: 'sentence', where: `${label} summary` };
  yield { text: manual.audience, kind: 'sentence', where: `${label} audience` };
  for (const outcome of manual.outcomes) yield { text: outcome, kind: 'sentence', where: `${label} outcomes` };
  for (const entry of manual.palette) yield { text: entry.meaning, kind: 'label', where: `${label} palette ${entry.hue}` };
  for (const part of manual.parts) {
    yield { text: part.title, kind: 'label', where: `${label} part ${part.number}` };
    yield { text: part.thesis, kind: 'thesis', where: `${label} part ${part.number} thesis` };
    if (part.summary) yield { text: part.summary, kind: 'sentence', where: `${label} part ${part.number} summary` };
  }
  if (manual.reference) {
    if (manual.reference.thesis) yield { text: manual.reference.thesis, kind: 'thesis', where: `${label} reference thesis` };
    if (manual.reference.summary) yield { text: manual.reference.summary, kind: 'sentence', where: `${label} reference summary` };
  }
  if (manual.plate) {
    yield { text: manual.plate.title, kind: 'label', where: `${label} plate title` };
    yield { text: manual.plate.caption, kind: 'sentence', where: `${label} plate caption` };
  }
  for (const doc of manual.documents) {
    yield { text: doc.title, kind: 'label', where: `${doc.label}:${doc.titleLine}` };
    if (doc.thesis) yield { text: doc.thesis, kind: 'thesis', where: `${doc.label}:${doc.thesisLine}` };
    for (const block of doc.blocks) {
      const where = `${doc.label}:${block.line}`;
      if (block.type === 'paragraph' && !/^Sources:\s/.test(block.text)) yield { text: block.text, kind: 'sentence', where };
      if (block.type === 'heading') yield { text: block.text, kind: 'label', where };
      if (block.type === 'list' || block.type === 'takeaways') for (const item of block.items) yield { text: item, kind: 'sentence', where };
      if (block.type === 'table') for (const row of [block.head, ...block.rows]) for (const cell of row) yield { text: cell, kind: 'label', where };
      if (block.type === 'figure') {
        yield { text: block.title, kind: 'label', where };
        yield { text: block.claim, kind: 'claim', where };
        yield { text: block.caption, kind: 'sentence', where };
      }
      if (block.type === 'listing') {
        yield { text: block.title, kind: 'label', where };
        if (block.note) yield { text: block.note, kind: 'sentence', where };
      }
      if (block.type === 'rule') yield { text: block.label, kind: 'label', where };
    }
  }
}

function figureHtml(block) {
  return `<figure class="m-fig" id="${block.id}" data-kind="${block.kind}" data-accent="${block.accent}">`
    + `<div class="m-fig-box"><div class="m-fig-head"><span class="m-fig-num">Fig. ${block.number}</span>`
    + `<span class="m-fig-title">${escapeHtml(block.title)}</span><span class="m-fig-kind">${block.kind}</span></div>`
    + `<div class="m-fig-art">${block.art.svg}</div></div>`
    + `<figcaption class="m-fig-cap"><strong>${block.claimHtml}</strong> ${block.captionHtml}</figcaption></figure>`;
}

function tableHtml(head, rows) {
  return `<div class="m-table-wrap"><table class="m-table"><thead><tr>${head.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr${row.accent ? ` data-accent="${row.accent}"` : ''}>${row.cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function generatedHtml(type, manual) {
  if (type === 'palette') return `<table class="m-palette"><tbody>${manual.paletteHtml.map(entry => `<tr data-accent="${entry.hue}"><td><span class="m-swatch"></span><span class="m-kicker">${entry.hue}</span></td><td>${entry.html}</td></tr>`).join('')}</tbody></table>`;
  if (type === 'parts') {
    const rows = manual.parts.map(part => ({ accent: part.accent, cells: [`<span class="m-kicker">${part.number} · ${escapeHtml(part.title)}</span>`, part.summaryHtml] }));
    if (manual.reference) rows.push({ accent: manual.reference.accent, cells: [`<span class="m-kicker">R · ${escapeHtml(manual.reference.title)}</span>`, manual.reference.summaryHtml] });
    return tableHtml(['Part', 'What it covers'], rows);
  }
  if (type === 'figure-index') return tableHtml(['Fig.', 'The claim it makes'], [...manual.figures.values()].map(figure => ({ accent: figure.accent, cells: [`<a class="m-xref" href="#${figure.id}">${figure.number}</a>`, figure.claimHtml] })));
  return tocHtml(manual, 'web');
}

function blockHtml(block, doc, manual, acc) {
  const where = `${doc.label}:${block.line}`;
  const inline = value => inlineHtml(value, where, acc);
  switch (block.type) {
    case 'heading': return `<h${block.level} id="${block.id}">${inline(block.text)}</h${block.level}>`;
    case 'paragraph': {
      if (/^Sources:\s/.test(block.text)) return `<p class="m-sources"><span class="m-sources-label">Sources:</span>${inline(block.text.replace(/^Sources:\s*/, ''))}</p>`;
      return `<p${/^\*\*[^*]+:\*\*\s/.test(block.text) ? ' class="m-def"' : ''}>${inline(block.text)}</p>`;
    }
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}>${block.items.map(item => `<li>${inline(item)}</li>`).join('')}</${tag}>`;
    }
    case 'table': return tableHtml(block.head.map(inline), block.rows.map(row => ({ cells: row.map(inline) })));
    case 'code': return `<pre class="m-code" data-lang="${block.lang}"><code>${highlight(block.code, block.lang)}</code></pre>`;
    case 'figure':
      block.claimHtml = inline(block.claim);
      block.captionHtml = inline(block.caption);
      return null;
    case 'listing': return `<figure class="m-listing" data-lang="${escapeHtml(block.lang)}"><div class="m-listing-head"><span class="m-listing-title">${inline(block.title)}</span><span class="m-listing-src">${escapeHtml(block.source)}</span><span>${escapeHtml(block.lang)}</span></div><pre><code>${highlight(block.code, block.lang)}</code></pre>${block.note ? `<figcaption class="m-listing-note">${inline(block.note)}</figcaption>` : ''}</figure>`;
    case 'takeaways': return `<aside class="m-takeaways"><div class="m-box-label">${TAKEAWAYS_LABEL}</div><ul>${block.items.map(item => `<li>${inline(item)}</li>`).join('')}</ul></aside>`;
    case 'rule': return `<aside class="m-rule"><div class="m-box-label">${escapeHtml(block.label)}</div><blockquote>${inline(block.quote)}</blockquote><div class="m-rule-src">${escapeHtml(block.source)}</div></aside>`;
    default: return null;
  }
}

function renderAll(manual, acc) {
  const label = rel(path.join(manual.dir, 'manual.json'));
  manual.paletteHtml = manual.palette.map(entry => ({ hue: entry.hue, html: inlineHtml(entry.meaning, `${label} palette`, acc) }));
  for (const part of manual.parts) part.summaryHtml = inlineHtml(part.summary || part.thesis, `${label} part ${part.number}`, acc);
  if (manual.reference) manual.reference.summaryHtml = inlineHtml(manual.reference.summary || manual.reference.thesis || 'Lookup tables for every name in the manual.', `${label} reference`, acc);
  if (manual.plate) manual.plate.captionHtml = inlineHtml(manual.plate.caption, `${label} plate caption`, acc);
  for (const doc of manual.documents) {
    doc.thesisHtml = doc.thesis ? inlineHtml(doc.thesis, `${doc.label}:${doc.thesisLine}`, acc) : '';
    for (const block of doc.blocks) block.html = blockHtml(block, doc, manual, acc);
  }
  for (const doc of manual.documents) {
    doc.html = doc.blocks.map(block => (block.type === 'figure' ? figureHtml(block) : block.html || generatedHtml(block.type, manual))).join('\n');
  }
}

function tocHtml(manual, mode) {
  const item = (href, kicker, title) => `<li><a href="#${href}"><span class="m-kicker">${kicker}</span><span>${escapeHtml(title)}</span></a></li>`;
  const groups = [];
  if (manual.front) groups.push(`<li class="m-toc-part" data-accent="grey"><a href="#s-front"><span class="m-kicker">00</span><span>${escapeHtml(manual.front.title)}</span></a></li>`);
  for (const part of manual.parts) groups.push(`<li class="m-toc-part" data-accent="${part.accent}"><a href="#${part.anchor}"><span class="m-kicker">${String(part.number).padStart(2, '0')}</span><span>${escapeHtml(part.title)}</span></a><ol>${part.sections.map(section => item(section.anchor, section.id, section.title)).join('')}</ol></li>`);
  if (manual.reference) groups.push(`<li class="m-toc-part" data-accent="${manual.reference.accent}"><a href="#p-r"><span class="m-kicker">R</span><span>${escapeHtml(manual.reference.title)}</span></a><ol>${manual.reference.sections.map(section => item(section.anchor, section.id, section.title)).join('')}</ol></li>`);
  const head = mode === 'web' ? '<div class="m-kicker m-toc-label">Contents</div>' : '<div class="m-section-head"><div class="m-section-num">Contents</div></div>';
  return `<nav class="m-toc" aria-label="Contents">${head}<ol>${groups.join('')}</ol></nav>`;
}

function docHtml(doc) {
  const front = doc.kind === 'front';
  return `<section class="${front ? 'm-front-section' : 'm-section'}" id="${doc.anchor}" data-accent="${doc.accent}"><header class="m-section-head"><div class="m-section-num">${front ? '00' : doc.id}</div><h1 class="m-section-title">${escapeHtml(doc.title)}</h1>${doc.thesisHtml ? `<p class="m-thesis">${doc.thesisHtml}</p>` : ''}</header><div class="m-body">${doc.html}</div></section>`;
}

function partHtml(part, kicker, title) {
  return `<section class="m-part" id="${part.anchor}" data-accent="${part.accent}"><div class="m-kicker m-part-kicker">${kicker}</div><h1 class="m-part-title">${escapeHtml(title)}</h1>${part.thesis ? `<p class="m-part-thesis">${escapeHtml(part.thesis)}</p>` : ''}<ol class="m-part-list">${part.sections.map(section => `<li><span class="m-kicker">${section.id}</span><a href="#${section.anchor}">${escapeHtml(section.title)}</a></li>`).join('')}</ol></section>`;
}

function coverHtml(manual, mode) {
  const pin = manual.pin;
  const pinLine = `${escapeHtml(pin.subject)} ${escapeHtml(pin.version)} · ${escapeHtml(pin.commit)} · ${escapeHtml(pin.date)} · Edition ${escapeHtml(manual.edition)}`;
  const parts = manual.parts.map(part => `<li data-accent="${part.accent}">${escapeHtml(part.title)}</li>`).join('');
  const plate = manual.plate ? `<figure class="m-fig m-plate" id="plate"><div class="m-fig-box"><div class="m-fig-head"><span class="m-fig-num">Plate I</span><span class="m-fig-title">${escapeHtml(manual.plate.title)}</span></div><div class="m-fig-art">${manual.plate.art.svg}</div></div><figcaption class="m-fig-cap">${manual.plate.captionHtml}</figcaption></figure>` : '';
  const head = `<div class="m-kicker m-cover-kicker">AI Engineering from Scratch · Manual</div><h1 class="m-cover-title">${escapeHtml(manual.title)}</h1><p class="m-cover-subtitle">${escapeHtml(manual.subtitle)}</p><div class="m-cover-pin">${pinLine}</div>`;
  if (mode === 'print') return `<section class="m-cover" id="cover">${plate}${head}<ul class="m-cover-parts">${parts}</ul></section>`;
  const download = manual.status === 'ready' ? `<a class="m-action is-primary" href="${RELEASE_URL}/aiefs-manual-${manual.id}.pdf">Download the PDF</a>` : '';
  const draft = manual.status === 'draft' ? '<div class="m-draft-note">Draft edition, not yet listed</div>' : '';
  return `<section class="m-cover" id="cover">${draft}${head}<div class="m-cover-actions">${download}<a class="m-action${download ? '' : ' is-primary'}" href="#s-front">Start reading</a><a class="m-action" href="${escapeHtml(githubSourceUrl(`manuals/${manual.id}`))}">Source and traces</a></div><ul class="m-cover-parts">${parts}</ul>${plate}</section>`;
}

function manualArticle(manual, mode) {
  const body = [];
  if (manual.front) body.push(docHtml(manual.front));
  for (const part of manual.parts) {
    body.push(partHtml(part, `Part ${part.number}`, part.title));
    for (const section of part.sections) body.push(docHtml(section));
  }
  if (manual.reference) {
    body.push(partHtml(manual.reference, 'Reference', manual.reference.title));
    for (const section of manual.reference.sections) body.push(docHtml(section));
  }
  return `<article class="manual" data-manual="${manual.id}">${coverHtml(manual, mode)}${mode === 'print' ? tocHtml(manual, 'print') : ''}${body.join('\n')}</article>`;
}

function webPage(manual) {
  const url = `${SITE_ORIGIN}/${pageName(manual.id)}`;
  const css = shared('tokens.css') + shared('manual.css') + shared('web.css');
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(manual.title)}: ${escapeHtml(manual.subtitle)} - AI Engineering from Scratch</title>
<meta name="description" content="${escapeHtml(manual.summary)}">
${manual.status === 'draft' ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${url}">
<meta property="og:title" content="${escapeHtml(manual.title)} · AI Engineering from Scratch">
<meta property="og:description" content="${escapeHtml(manual.summary)}">
<meta property="og:image" content="${SITE_ORIGIN}/og-image.png?v=4">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<style>${css}</style>
<script>${THEME_SCRIPT}</script>
</head>
<body data-manual-page="${manual.id}">
<a href="#main" class="skip-link">Skip to content</a>
<header class="site-header"><div class="header-inner"><a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a><nav class="header-nav"><a href="index.html#contents">Contents</a><a href="catalog.html">Catalog</a><a href="projects.html">Projects</a><a href="prereqs.html">Roadmap</a><a href="glossary.html">Glossary</a><a href="about.html">About</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github"><span>GitHub</span><span class="star-count" data-loading="true">…</span></a></nav><button class="search-toggle" type="button" data-cmd-palette aria-label="Search"><span aria-hidden="true">⌕</span></button><button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button></div></header>
<main id="main" class="m-web"><div class="m-layout"><aside class="m-sidebar">${tocHtml(manual, 'web')}</aside>${manualArticle(manual, 'web')}</div></main>
<script src="data.js"></script>
<script src="content-source.js"></script>
<script src="header.js" defer></script>
<script src="cmdpalette.js" defer></script>
</body>
</html>
`;
}

function printPage(manual, options = {}) {
  const css = shared('tokens.css') + shared('manual.css') + shared('print.css');
  const polyfill = options.polyfill ? '<script src="https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js"></script>\n' : '';
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(manual.title)}: ${escapeHtml(manual.subtitle)}</title>
<link href="${FONT_LINK}" rel="stylesheet">
<style>${css}</style>
${polyfill}</head>
<body>
${manualArticle(manual, 'print')}
</body>
</html>
`;
}

function manualSummary(manual) {
  return {
    id: manual.id,
    title: manual.title,
    subtitle: manual.subtitle,
    summary: manual.summary,
    status: manual.status,
    edition: manual.edition,
    pin: manual.pin,
    parts: manual.parts.map(part => ({ number: part.number, title: part.title, accent: part.accent })),
    sections: manual.parts.reduce((total, part) => total + part.sections.length, 0),
    figures: manual.figures.size,
    url: pageName(manual.id),
    pdf: `${RELEASE_URL}/aiefs-manual-${manual.id}.pdf`,
  };
}

function loadAll(options = {}) {
  const base = options.root || MANUALS;
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !/^[_.]/.test(entry.name) && (!options.only || entry.name === options.only))
    .map(entry => loadManual(path.join(base, entry.name), options))
    .filter(Boolean);
}

function writeWeb(manuals, siteDir = SITE, options = {}) {
  if (!options.only) {
    for (const name of fs.readdirSync(siteDir).filter(file => /^manual-[a-z0-9-]+\.html$/.test(file))) fs.rmSync(path.join(siteDir, name));
  }
  for (const manual of manuals) fs.writeFileSync(path.join(siteDir, pageName(manual.id)), webPage(manual), 'utf8');
  if (options.only) return null;
  const listed = manuals.filter(manual => manual.status === 'ready').map(manualSummary);
  fs.writeFileSync(path.join(siteDir, 'manuals-data.js'), `window.AIFS_MANUALS = ${JSON.stringify(listed, null, 2)};\n`, 'utf8');
  return listed.length;
}

function writePrint(manuals, outDir, options = {}) {
  for (const manual of manuals) {
    const out = path.join(outDir, manual.id);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'print.html'), printPage(manual, options), 'utf8');
  }
}

function main(argv) {
  const args = argv.slice(2);
  const flag = name => args.includes(name);
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const options = { strict: flag('--strict'), only: value('--manual') };
  const manuals = loadAll(options);
  if (flag('--check')) {
    for (const manual of manuals) console.log(`ok ${manual.id}: ${manual.parts.length} parts, ${manual.documents.length} documents, ${manual.figures.size} figures`);
    return;
  }
  const printDir = value('--print');
  if (printDir) {
    const selected = flag('--ready') ? manuals.filter(manual => manual.status === 'ready') : manuals;
    writePrint(selected, path.resolve(printDir), { polyfill: flag('--polyfill') });
    console.log(`wrote print HTML for ${selected.length} manual(s) to ${printDir}`);
    return;
  }
  const listed = writeWeb(manuals, SITE, options);
  console.log(`built ${manuals.length} manual page(s)${listed === null ? '' : `; ${listed} listed in manuals-data.js`}`);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(`build-manuals: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  KINDS,
  OUTCOME_PHRASE,
  SCHEMA,
  TAKEAWAYS_LABEL,
  WIRE_LANGS,
  highlight,
  inlineHtml,
  loadAll,
  loadManual,
  newInline,
  pageName,
  parseDocument,
  printPage,
  proseSpans,
  webPage,
  writePrint,
  writeWeb,
};
