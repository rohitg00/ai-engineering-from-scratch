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
const ISSUES_URL = 'https://github.com/rohitg00/ai-engineering-from-scratch/issues';
const AUTHOR = 'Rohit Ghumare';
const LICENSE = 'MIT license';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS = ['sequence', 'structure', 'flow', 'comparison', 'timeline', 'tree', 'state', 'decision', 'layers'];
const CONTINUATION = /^\s{2,}\S/;
const NESTED_ITEM = /^\s+([-*]|\d+\.)\s+/;
const LISTING_LANGS = new Set(['json', 'jsonl', 'http', 'sse']);
const SCHEMA = JSON.parse(fs.readFileSync(path.join(MANUALS, 'manual.schema.json'), 'utf8'));
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=VT323&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap';
const TAKEAWAYS_LABEL = 'What to do with this';
const OUTCOME_PHRASE = 'When you finish this section, you can';
const escapeHtml = figkit.escapeHtml;

function ensure(condition, message) { if (!condition) throw new Error(message); }
function scope(label) { return (condition, message) => ensure(condition, `${label}: ${message}`); }
function docLine(doc, line) { return `${doc.label}:${line}`; }
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { throw new Error(`${rel(file)}: ${error.message}`); }
}
function shared(name) { return fs.readFileSync(path.join(MANUALS, '_shared', name), 'utf8'); }
function slugify(text) {
  return String(text).toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}
function sectionAnchor(file) { return `s-${path.basename(file, '.md').replace(/^\d+-\d+-/, '').replace(/^r-\d+-/, 'ref-')}`; }
function pageName(id) { return `manual-${id}.html`; }

function keyValues(lines, label, kind, required, optional = []) {
  const allowed = [...required, ...optional];
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
      ensure(last && CONTINUATION.test(line), `${label}: expected "key: value", got "${line.trim()}"`);
      values[last] = `${values[last]} ${line.trim()}`;
    }
  }
  for (const key of required) ensure(values[key], `${label}: ${kind} "${key}" required`);
  return values;
}

function splitHeader(body, label) {
  const index = body.findIndex(line => /^---\s*$/.test(line));
  ensure(index >= 0, `${label}: header and body must be separated by a "---" line`);
  return { head: body.slice(0, index), rest: body.slice(index + 1) };
}

function fenceBlock(info, body, label) {
  if (info === 'figure') {
    const values = keyValues(body, label, 'figure', ['id', 'kind', 'title', 'claim', 'caption']);
    ensure(SLUG.test(values.id), `${label}: figure id "${values.id}" must be lowercase and hyphenated`);
    ensure(KINDS.includes(values.kind), `${label}: figure ${values.id} kind must be one of ${KINDS.join(', ')}`);
    return { type: 'figure', ...values };
  }
  if (info === 'listing') {
    const { head, rest } = splitHeader(body, label);
    const values = keyValues(head, label, 'listing', ['title', 'source', 'lang'], ['note']);
    while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
    ensure(rest.length, `${label}: listing ${values.source} needs a body`);
    return { type: 'listing', ...values, code: rest.join('\n') };
  }
  if (info === 'rule') {
    const { head, rest } = splitHeader(body, label);
    const values = keyValues(head, label, 'rule', ['label', 'source']);
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
        ensure(items.length && CONTINUATION.test(line), `${label}: takeaways use "- item" lines`);
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
const FORBIDDEN = [
  [/^#\s/, 'only one "# " title per file'],
  [/^#{4,}\s/, 'headings deeper than ### are not allowed'],
  [/^\s*(-{3,}|\*{3,}|_{3,})\s*$/, 'horizontal rules are not allowed'],
  [/^>/, 'a quote block is only allowed as the thesis; use a rule block'],
  [/^\s*<[a-zA-Z!/]/, 'raw HTML is not allowed'],
];

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
    for (const [pattern, message] of FORBIDDEN) ensure(!pattern.test(line), `${at(i + 1)}: ${message}`);
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
    ensure(!NESTED_ITEM.test(line), `${at(i + 1)}: nested lists are not allowed`);
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
        if (items.length && CONTINUATION.test(lines[i])) {
          ensure(!NESTED_ITEM.test(lines[i]), `${at(i + 1)}: nested lists are not allowed`);
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
  if (!LISTING_LANGS.has(lang)) return escapeHtml(code);
  return code.split('\n').map(line => highlightLine(line, lang)).join('\n');
}

function loadSvg(file, id, where) {
  const raw = fs.readFileSync(file, 'utf8').replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const result = validateSvg(raw, id, figkit.WIDTH);
  ensure(!result.issues.length, `${where}: ${rel(file)}: ${result.issues[0]}`);
  return { svg: raw };
}

function schemaErrors(value, rule, where = '', errors = []) {
  const schema = rule.$ref ? SCHEMA.$defs[rule.$ref.replace('#/$defs/', '')] : rule;
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  const fail = message => errors.push(`${where || 'manifest'} ${message}`);
  const types = [].concat(schema.type || []);
  if (types.length && !types.includes(kind) && !(kind === 'integer' && types.includes('number'))) {
    fail(`must be ${types.join(' or ')}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(value)) fail(`must be one of ${schema.enum.join(', ')}`);
  if (kind === 'string' && schema.minLength && value.length < schema.minLength) fail(`needs at least ${schema.minLength} character(s)`);
  if (kind === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value)) fail(`"${value}" must match ${schema.pattern}`);
  if (kind === 'integer' && schema.minimum !== undefined && value < schema.minimum) fail(`must be at least ${schema.minimum}`);
  if (kind === 'array') {
    if (schema.minItems && value.length < schema.minItems) fail(`needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, index) => schemaErrors(item, schema.items, `${where}[${index}]`, errors));
  }
  if (kind === 'object') {
    for (const key of schema.required || []) if (!(key in value)) fail(`needs "${key}"`);
    for (const [key, item] of Object.entries(value)) {
      const path = where ? `${where}.${key}` : key;
      if (schema.propertyNames && !new RegExp(schema.propertyNames.pattern).test(key)) fail(`key "${key}" must match ${schema.propertyNames.pattern}`);
      if (schema.properties && schema.properties[key]) schemaErrors(item, schema.properties[key], path, errors);
      else if (schema.additionalProperties === false) fail(`has unknown key "${key}"`);
      else if (schema.additionalProperties) schemaErrors(item, schema.additionalProperties, path, errors);
    }
  }
  return errors;
}

function validateManifest(manual, label, dir) {
  const need = scope(label);
  const errors = schemaErrors(manual, SCHEMA);
  need(!errors.length, errors[0]);
  const hues = manual.palette.map(entry => entry.hue);
  need(new Set(hues).size === hues.length, 'palette hues must not repeat');
  const quoteSources = {};
  for (const [key, file] of Object.entries(manual.quoteSources || {})) quoteSources[key] = file === null ? null : localPath(dir, file, `${label}.quoteSources.${key}`);
  return quoteSources;
}

function loadManual(dir) {
  const manifestFile = path.join(dir, 'manual.json');
  if (!fs.existsSync(manifestFile)) return null;
  const label = rel(manifestFile);
  const need = scope(label);
  const manual = readJson(manifestFile);
  const id = path.basename(dir);
  need(manual.id === id && SLUG.test(id), `id must match the lowercase hyphenated directory name`);
  const quoteSources = validateManifest(manual, label, dir);
  const documents = [];
  const readDoc = (file, meta) => {
    const full = localPath(dir, file, `${label}: document`);
    const docLabel = rel(full);
    const doc = { ...meta, file, label: docLabel, ...parseDocument(fs.readFileSync(full, 'utf8'), docLabel) };
    documents.push(doc);
    return doc;
  };
  const front = manual.front ? readDoc(manual.front, { kind: 'front', id: 'front', anchor: 's-front', prefix: '0', accent: 'grey' }) : null;
  const parts = manual.parts.map((part, index) => {
    const number = index + 1;
    need(part.number === number, `parts must be numbered 1..N in order`);
    const sections = part.sections.map((entry, position) => {
      need(entry.id === `${number}.${position + 1}`, `part ${number} section ${position + 1} must have id "${number}.${position + 1}"`);
      return readDoc(entry.file, { kind: 'section', id: entry.id, anchor: sectionAnchor(entry.file), prefix: String(number), accent: part.accent });
    });
    return { ...part, anchor: `p-${number}`, sections };
  });
  let reference = null;
  if (manual.reference) {
    const accent = manual.reference.accent || 'grey';
    const sections = manual.reference.sections.map((entry, position) => {
      need(entry.id === `R.${position + 1}`, `reference section ${position + 1} must have id "R.${position + 1}"`);
      return readDoc(entry.file, { kind: 'reference', id: entry.id, anchor: sectionAnchor(entry.file), prefix: 'R', accent });
    });
    reference = { title: manual.reference.title || 'Reference', thesis: manual.reference.thesis || '', summary: manual.reference.summary || '', accent, anchor: 'p-r', sections };
  }
  const anchors = new Set([...parts.map(part => part.anchor), ...(reference ? ['p-r'] : [])]);
  const figures = new Map();
  const counters = new Map();
  for (const doc of documents) {
    need(!anchors.has(doc.anchor), `duplicate anchor ${doc.anchor}`);
    anchors.add(doc.anchor);
    for (const block of doc.blocks) {
      const where = docLine(doc, block.line);
      if (block.type === 'heading') {
        block.id = block.id || `${doc.anchor}-${slugify(block.text)}`;
        ensure(!anchors.has(block.id), `${where}: duplicate heading anchor ${block.id}`);
        anchors.add(block.id);
      }
      if (block.type === 'figure') {
        ensure(!anchors.has(block.id), `${where}: duplicate figure id ${block.id}`);
        const count = (counters.get(doc.prefix) || 0) + 1;
        counters.set(doc.prefix, count);
        const art = loadSvg(localPath(dir, `figures/${block.id}.svg`, `${where}: figure`), block.id, where);
        Object.assign(block, { number: `${doc.prefix}.${count}`, art, accent: doc.accent });
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
    plate = { ...manual.plate, art: loadSvg(localPath(dir, `figures/${manual.plate.figure}.svg`, `${label}: plate`), manual.plate.figure, label) };
  }
  const built = { ...manual, label, dir, front, parts, reference, figures, plate, documents, quoteSources };
  const acc = newInline();
  renderAll(built, acc);
  for (const ref of acc.refs) ensure(anchors.has(ref.id), `${ref.where}: link to unknown anchor #${ref.id}`);
  for (const link of acc.repoLinks) {
    const target = within(ROOT, path.join(ROOT, link.path));
    ensure(fs.existsSync(target), `${link.where}: repository link target missing ${link.path}`);
  }
  need(manual.status === 'draft' || fs.existsSync(path.join(dir, 'README.md')), 'ready manuals need README.md');
  return built;
}

function* proseSpans(manual) {
  const label = manual.label;
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
    yield { text: doc.title, kind: 'label', where: docLine(doc, doc.titleLine) };
    if (doc.thesis) yield { text: doc.thesis, kind: 'thesis', where: docLine(doc, doc.thesisLine) };
    for (const block of doc.blocks) {
      const where = docLine(doc, block.line);
      if (block.type === 'paragraph' && !/^Sources:\s/.test(block.text)) yield { text: block.text, kind: 'sentence', where };
      if (block.type === 'heading') yield { text: block.text, kind: 'label', where };
      if (block.type === 'list' || block.type === 'takeaways') for (const item of block.items) yield { text: item, kind: block.type === 'takeaways' ? 'step' : 'sentence', where };
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

function frameHtml({ attrs, num, title, kind, svg, caption }) {
  return `<figure ${attrs}><div class="m-fig-box"><div class="m-fig-head"><span class="m-fig-num">${num}</span><span class="m-fig-title">${escapeHtml(title)}</span>${kind ? `<span class="m-fig-kind">${kind}</span>` : ''}</div><div class="m-fig-art">${svg}</div></div><figcaption class="m-fig-cap">${caption}</figcaption></figure>`;
}

function figureHtml(block) {
  return frameHtml({ attrs: `class="m-fig" id="${block.id}" data-accent="${block.accent}"`, num: `Fig. ${block.number}`, title: block.title, kind: block.kind, svg: block.art.svg, caption: `<strong>${block.claimHtml}</strong> ${block.captionHtml}` });
}

function tableHtml(head, rows) {
  return `<div class="m-table-wrap"><table class="m-table"><thead><tr>${head.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr${row.accent ? ` data-accent="${row.accent}"` : ''}>${row.cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function blockHtml(block, doc, manual, acc) {
  const where = docLine(doc, block.line);
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
    case 'code': return `<pre class="m-code"><code>${highlight(block.code, block.lang)}</code></pre>`;
    case 'figure': return figureHtml(block);
    case 'palette': return `<table class="m-palette"><tbody>${manual.paletteHtml.map(entry => `<tr data-accent="${entry.hue}"><td><span class="m-swatch"></span><span class="m-kicker">${entry.hue}</span></td><td>${entry.html}</td></tr>`).join('')}</tbody></table>`;
    case 'parts': {
      const rows = manual.parts.map(part => ({ accent: part.accent, cells: [`<span class="m-kicker">${part.number} · ${escapeHtml(part.title)}</span>`, part.summaryHtml] }));
      if (manual.reference) rows.push({ accent: manual.reference.accent, cells: [`<span class="m-kicker">R · ${escapeHtml(manual.reference.title)}</span>`, manual.reference.summaryHtml] });
      return tableHtml(['Part', 'What it covers'], rows);
    }
    case 'figure-index': return tableHtml(['Fig.', 'The claim it makes'], [...manual.figures.values()].map(figure => ({ accent: figure.accent, cells: [`<a class="m-xref" href="#${figure.id}">${figure.number}</a>`, figure.claimHtml] })));
    case 'contents': return tocHtml(manual, 'web');
    case 'listing': return `<figure class="m-listing"><div class="m-listing-head"><span class="m-listing-title">${inline(block.title)}</span><span class="m-listing-src">${escapeHtml(block.source)}</span><span>${escapeHtml(block.lang)}</span></div><pre><code>${highlight(block.code, block.lang)}</code></pre>${block.note ? `<figcaption class="m-listing-note">${inline(block.note)}</figcaption>` : ''}</figure>`;
    case 'takeaways': return `<aside class="m-takeaways"><div class="m-box-label">${TAKEAWAYS_LABEL}</div><ul>${block.items.map(item => `<li>${inline(item)}</li>`).join('')}</ul></aside>`;
    case 'rule': return `<aside class="m-rule"><div class="m-box-label">${escapeHtml(block.label)}</div><blockquote>${inline(block.quote)}</blockquote><div class="m-rule-src">${escapeHtml(block.source)}</div></aside>`;
    default: throw new Error(`${where}: unknown block ${block.type}`);
  }
}

function numberFigureLinks(html, manual) {
  return html.replace(/<a class="m-xref" href="#([a-z0-9-]+)">([Ff]igure)<\/a>/g, (match, id, word) => (manual.figures.has(id) ? `<a class="m-xref" href="#${id}">${word} ${manual.figures.get(id).number}</a>` : match));
}

function renderAll(manual, acc) {
  const label = manual.label;
  manual.paletteHtml = manual.palette.map(entry => ({ hue: entry.hue, html: inlineHtml(entry.meaning, `${label} palette`, acc) }));
  for (const part of manual.parts) part.summaryHtml = inlineHtml(part.summary || part.thesis, `${label} part ${part.number}`, acc);
  if (manual.reference) manual.reference.summaryHtml = inlineHtml(manual.reference.summary || manual.reference.thesis || 'Lookup tables for every name in the manual.', `${label} reference`, acc);
  if (manual.plate) manual.plate.captionHtml = inlineHtml(manual.plate.caption, `${label} plate caption`, acc);
  for (const doc of manual.documents) {
    for (const block of doc.blocks.filter(item => item.type === 'figure')) {
      block.claimHtml = inlineHtml(block.claim, docLine(doc, block.line), acc);
      block.captionHtml = inlineHtml(block.caption, docLine(doc, block.line), acc);
    }
  }
  for (const doc of manual.documents) {
    doc.thesisHtml = doc.thesis ? inlineHtml(doc.thesis, docLine(doc, doc.thesisLine), acc) : '';
    doc.html = numberFigureLinks(doc.blocks.map(block => blockHtml(block, doc, manual, acc)).join('\n'), manual);
  }
  if (manual.plate) manual.plate.captionHtml = numberFigureLinks(manual.plate.captionHtml, manual);
}

function tocHtml(manual, mode) {
  const link = (href, kicker, title) => `<a href="#${href}"><span class="m-kicker">${kicker}</span><span>${escapeHtml(title)}</span></a>`;
  const group = (accent, href, kicker, title, sections = []) => `<li class="m-toc-part" data-accent="${accent}">${link(href, kicker, title)}${sections.length ? `<ol>${sections.map(section => `<li>${link(section.anchor, section.id, section.title)}</li>`).join('')}</ol>` : ''}</li>`;
  const groups = [];
  if (manual.front) groups.push(group('grey', 's-front', '00', manual.front.title));
  for (const part of manual.parts) groups.push(group(part.accent, part.anchor, String(part.number).padStart(2, '0'), part.title, part.sections));
  if (manual.reference) groups.push(group(manual.reference.accent, 'p-r', 'R', manual.reference.title, manual.reference.sections));
  const head = mode === 'web' ? '<div class="m-kicker m-toc-label">Contents</div>' : '<div class="m-section-head"><div class="m-section-num">Contents</div></div>';
  return `<nav class="m-toc" aria-label="Contents">${head}<ol>${groups.join('')}</ol></nav>`;
}

function docHtml(doc) {
  const front = doc.kind === 'front';
  return `<section class="${front ? 'm-front-section' : 'm-section'}" id="${doc.anchor}" data-accent="${doc.accent}"><header class="m-section-head"><div class="m-section-num">${front ? '00' : doc.id}</div><h1 class="m-section-title">${escapeHtml(doc.title)}</h1>${doc.thesisHtml ? `<p class="m-thesis">${doc.thesisHtml}</p>` : ''}</header>${doc.html}</section>`;
}

function ditherHtml(seed, label, slim) {
  return `<div class="m-dither${slim ? ' is-slim' : ''}" data-seed="${escapeHtml(seed)}" aria-hidden="true"><span class="m-dither-label">${escapeHtml(label)}</span></div>`;
}

function partHtml(part, kicker, band = '') {
  return `<section class="m-part" id="${part.anchor}" data-accent="${part.accent}">${band}<div class="m-kicker m-part-kicker">${kicker}</div><h1 class="m-part-title">${escapeHtml(part.title)}</h1>${part.thesis ? `<p class="m-part-thesis">${escapeHtml(part.thesis)}</p>` : ''}<ol class="m-part-list">${part.sections.map(section => `<li><span class="m-kicker">${section.id}</span><a href="#${section.anchor}">${escapeHtml(section.title)}</a></li>`).join('')}</ol></section>`;
}

function pdfUrl(manual) { return `${RELEASE_URL}/aiefs-manual-${manual.id}.pdf`; }
function sectionCount(manual) { return manual.parts.reduce((total, part) => total + part.sections.length, 0); }
function action(href, label, primary = false) { return `<a class="m-action${primary ? ' is-primary' : ''}" href="${href}">${label}</a>`; }
function sourceAction(manual) { return action(escapeHtml(githubSourceUrl(`manuals/${manual.id}`)), 'Source files'); }

function pinLine(manual) {
  const pin = manual.pin;
  return `${escapeHtml(pin.subject)} ${escapeHtml(pin.version)} · ${escapeHtml(pin.commit.slice(0, 7))} · ${escapeHtml(pin.date)} · Edition ${escapeHtml(manual.edition)}`;
}

function plateHtml(manual, attrs) {
  return manual.plate ? frameHtml({ attrs, num: 'Plate I', title: manual.plate.title, svg: manual.plate.art.svg, caption: manual.plate.captionHtml }) : '';
}

function partDots(manual) {
  return `<ul class="m-cover-parts">${manual.parts.map(part => `<li data-accent="${part.accent}">${escapeHtml(part.title)}</li>`).join('')}</ul>`;
}

function copyLine(manual) { return `© ${manual.edition.slice(0, 4)} ${AUTHOR} · ${LICENSE}`; }

function editionHtml(manual) {
  const page = `${SITE_ORIGIN}/${pageName(manual.id)}`;
  return `<div class="m-cover-edition"><div class="m-kicker">Edition ${escapeHtml(manual.edition)} · a snapshot of a living manual · the newest edition is at the link below</div><div class="m-cover-links"><a href="${page}">${page.replace('https://', '')}</a><a href="${escapeHtml(githubSourceUrl(`manuals/${manual.id}`))}">source on GitHub</a></div></div>`;
}

function colophonHtml(manual) {
  const page = `${SITE_ORIGIN}/${pageName(manual.id)}`;
  const pin = manual.pin;
  return `<section class="m-colophon" id="colophon"><div class="m-kicker">About this edition</div><p>${escapeHtml(manual.title)}, edition ${escapeHtml(manual.edition)}, by ${AUTHOR}. It is part of AI Engineering from Scratch, an open source course at <a href="${SITE_ORIGIN}">aiengineeringfromscratch.com</a>. The newest edition is always at <a href="${page}">${page.replace('https://', '')}</a>.</p><p>${escapeHtml(pin.subject)} ${escapeHtml(pin.version)} is the subject, at commit ${escapeHtml(pin.commit)} of ${escapeHtml(pin.date)}, checked on ${escapeHtml(pin.verified)}. Every listing comes from a recorded run of the capture kit in the manual's source directory, and every quoted rule is checked word for word against the vendored sources.</p><p>${copyLine(manual)}. You can copy and share this manual. Keep this page and the copyright line with it. Report an error at <a href="${ISSUES_URL}">${ISSUES_URL.replace('https://', '')}</a>.</p></section>`;
}

function coverHtml(manual, mode) {
  const plate = plateHtml(manual, 'class="m-fig m-plate" id="plate"');
  const head = `<div class="m-cover-stamp"><span class="m-kicker m-cover-kicker">AI Engineering from Scratch · Manual</span><span class="m-kicker m-copy">${copyLine(manual)}</span></div><h1 class="m-cover-title">${escapeHtml(manual.title)}</h1><p class="m-cover-subtitle">${escapeHtml(manual.subtitle)}</p><div class="m-cover-pin">${pinLine(manual)}</div>`;
  if (mode === 'print') return `<section class="m-cover" id="cover">${plate}${head}${partDots(manual)}${editionHtml(manual)}</section>`;
  const band = ditherHtml(manual.id, `${manual.pin.subject} ${manual.pin.version}`, false);
  const download = manual.status === 'ready' ? action(pdfUrl(manual), 'Download the PDF', true) : '';
  const draft = manual.status === 'draft' ? '<div class="m-draft-note">Draft edition, not yet listed</div>' : '';
  return `<section class="m-cover" id="cover">${band}${draft}${head}<div class="m-cover-actions">${download}${action('#s-front', 'Start reading', !download)}${sourceAction(manual)}</div>${partDots(manual)}${plate}</section>`;
}

function manualArticle(manual, mode) {
  const band = (seed, label) => (mode === 'web' ? ditherHtml(`${manual.id}-${seed}`, label, true) : '');
  const body = [];
  if (manual.front) body.push(docHtml(manual.front));
  for (const part of manual.parts) {
    body.push(partHtml(part, `Part ${part.number}`, band(part.anchor, `Part ${part.number} · ${part.title}`)));
    for (const section of part.sections) body.push(docHtml(section));
  }
  if (manual.reference) {
    body.push(partHtml(manual.reference, 'Reference', band('reference', manual.reference.title)));
    for (const section of manual.reference.sections) body.push(docHtml(section));
  }
  return `<article class="manual">${coverHtml(manual, mode)}${mode === 'print' ? tocHtml(manual, 'print') : ''}${body.join('\n')}\n${colophonHtml(manual)}</article>`;
}

const SITE_HEADER = '<header class="site-header"><div class="header-inner"><a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a><nav class="header-nav"><a href="index.html#contents">Contents</a><a href="catalog.html">Catalog</a><a href="projects.html">Projects</a><a href="manuals.html">Manuals</a><a href="prereqs.html">Roadmap</a><a href="glossary.html">Glossary</a><a href="about.html">About</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github"><span>GitHub</span><span class="star-count" data-loading="true">…</span></a></nav><button class="search-toggle" type="button" data-cmd-palette aria-label="Search"><span aria-hidden="true">⌕</span></button><button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button></div></header>';

function pageShell({ title, ogTitle, description, canonical, noindex, card, main }) {
  const css = shared('tokens.css') + shared('manual.css') + shared('web.css');
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(ogTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${SITE_ORIGIN}/og/${card}.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<style>${css}</style>
<script>${shared('theme.js')}</script>
</head>
<body>
<a href="#main" class="skip-link">Skip to content</a>
${SITE_HEADER}
${main}
<footer class="site-footer"><div class="container footer-inner"><p>AI Engineering from Scratch · open source · free forever.</p><div class="footer-links"><a href="index.html">Home</a><a href="manuals.html">Manuals</a><a href="catalog.html">Course catalog</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
<script src="data.js"></script>
<script src="content-source.js"></script>
<script src="header.js" defer></script>
<script src="cmdpalette.js" defer></script>
<script>${shared('dither.js')}</script>
<script>${shared('motion.js')}</script>
</body>
</html>
`;
}

function webPage(manual) {
  return pageShell({
    title: `${manual.title}: ${manual.subtitle} - AI Engineering from Scratch`,
    ogTitle: `${manual.title} · AI Engineering from Scratch`,
    description: manual.summary,
    canonical: `${SITE_ORIGIN}/${pageName(manual.id)}`,
    noindex: manual.status === 'draft',
    card: manual.status === 'ready' ? `manual/${manual.id}` : 'page/manuals',
    main: `<main id="main" class="m-web"><div class="m-layout"><aside class="m-sidebar">${tocHtml(manual, 'web')}</aside>${manualArticle(manual, 'web')}</div></main>`,
  });
}

const INDEX_LEDE = 'Each manual explains one subject at one exact version, from its purpose to each request and response. The examples come from recorded runs of a working system, and each rule links to the specification text that it comes from.';
const INDEX_GIVES = [
  ['Read', 'The web edition, with figures that play as you scroll.'],
  ['Keep', 'A PDF of the same text, attached to every release of the course.'],
  ['Rerun', 'A capture kit that regenerates every listing in the manual with one command.'],
];

function manualCard(manual) {
  const actions = [action(pageName(manual.id), 'Read the manual', true)];
  if (manual.status === 'ready') actions.push(action(pdfUrl(manual), 'Download the PDF'));
  actions.push(sourceAction(manual));
  const draft = manual.status === 'draft' ? '<div class="m-draft-note">Draft edition</div>' : '';
  return `<article class="m-index-card">${draft}<div class="m-kicker m-index-pin">${pinLine(manual)}</div><h2 class="m-index-name"><a href="${pageName(manual.id)}">${escapeHtml(manual.title)}</a></h2><p class="m-index-subtitle">${escapeHtml(manual.subtitle)}</p><p class="m-index-summary">${escapeHtml(manual.summary)}</p>${partDots(manual)}<div class="m-kicker m-index-stats">${manual.parts.length} parts · ${sectionCount(manual)} sections · ${manual.figures.size} figures</div><div class="m-index-actions">${actions.join('')}</div>${plateHtml(manual, 'class="m-fig m-plate"')}</article>`;
}

function indexPage(listed) {
  const gives = INDEX_GIVES.map(([label, text]) => `<li><span class="m-kicker">${label}</span><p>${text}</p></li>`).join('');
  const body = listed.length ? listed.map(manualCard).join('') : '<p class="m-index-empty">No manual is published yet.</p>';
  return pageShell({
    title: 'Manuals - AI Engineering from Scratch',
    ogTitle: 'Manuals · AI Engineering from Scratch',
    description: 'Long technical manuals that explain one subject at one exact version, from its purpose to each request and response.',
    canonical: `${SITE_ORIGIN}/manuals.html`,
    noindex: !listed.some(manual => manual.status === 'ready'),
    card: 'page/manuals',
    main: `<main id="main" class="m-web"><div class="manual m-index"><section class="m-index-hero">${ditherHtml('manuals', 'Manuals', false)}<div class="m-kicker m-cover-kicker">AI Engineering from Scratch</div><h1 class="m-index-title">Manuals</h1><p class="m-index-lede">${INDEX_LEDE}</p><ul class="m-index-gives">${gives}</ul></section>${body}</div></main>`,
  });
}

function stripMotion(html) {
  return html.replace(/<circle class="m-packet"[^>]*>[\s\S]*?<\/circle>/g, '').replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/g, '');
}

function printPage(manual) {
  const css = shared('tokens.css') + shared('manual.css') + shared('print.css');
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(manual.title)}: ${escapeHtml(manual.subtitle)}</title>
<meta name="author" content="${AUTHOR}">
<meta name="subject" content="${escapeHtml(manual.summary)}">
<meta name="keywords" content="${escapeHtml(manual.pin.subject)},AI Engineering from Scratch,${escapeHtml(manual.id)}">
<link href="${FONT_LINK}" rel="stylesheet">
<style>${css}</style>
</head>
<body>
${stripMotion(manualArticle(manual, 'print'))}
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
    sections: sectionCount(manual),
    figures: manual.figures.size,
    url: pageName(manual.id),
    pdf: pdfUrl(manual),
  };
}

function loadAll(options = {}) {
  const base = options.root || MANUALS;
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !/^[_.]/.test(entry.name) && (!options.only || entry.name === options.only))
    .map(entry => loadManual(path.join(base, entry.name)))
    .filter(Boolean);
}

function writeWeb(manuals, siteDir = SITE, options = {}) {
  if (!options.only) {
    for (const name of fs.readdirSync(siteDir).filter(file => /^manual-[a-z0-9-]+\.html$/.test(file))) fs.rmSync(path.join(siteDir, name));
  }
  for (const manual of manuals) fs.writeFileSync(path.join(siteDir, pageName(manual.id)), webPage(manual), 'utf8');
  if (options.only) return null;
  const listed = manuals.filter(manual => options.drafts || manual.status === 'ready');
  fs.writeFileSync(path.join(siteDir, 'manuals-data.js'), `window.AIFS_MANUALS = ${JSON.stringify(listed.map(manualSummary), null, 2)};\n`, 'utf8');
  fs.writeFileSync(path.join(siteDir, 'manuals.html'), indexPage(listed), 'utf8');
  return listed.length;
}

function writePrint(manuals, outDir) {
  for (const manual of manuals) {
    const out = path.join(outDir, manual.id);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'print.html'), printPage(manual), 'utf8');
  }
}

function main(argv) {
  const args = argv.slice(2);
  const flag = name => args.includes(name);
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const options = { only: value('--manual'), drafts: flag('--drafts') };
  const manuals = loadAll(options);
  const printDir = value('--print');
  if (printDir) {
    const selected = flag('--ready') ? manuals.filter(manual => manual.status === 'ready') : manuals;
    writePrint(selected, path.resolve(printDir));
    console.log(`wrote print HTML for ${selected.length} manual(s) to ${printDir}`);
    return;
  }
  const listed = writeWeb(manuals, SITE, options);
  console.log(`built ${manuals.length} manual page(s)${listed === null ? '' : `; ${listed} listed on manuals.html`}`);
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
  LISTING_LANGS,
  inlineHtml,
  loadAll,
  loadManual,
  newInline,
  parseDocument,
  printPage,
  proseSpans,
  writeWeb,
};
