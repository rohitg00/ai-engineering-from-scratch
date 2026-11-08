'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BANK = 'interviews';
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LESSON = /^phases\/\d\d-[a-z0-9-]+\/\d\d-[a-z0-9-]+$/;
const MANUAL_REF = /^([a-z0-9]+(?:-[a-z0-9]+)*)#(s-[a-z0-9-]+)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['concept', 'tradeoff', 'design', 'debug', 'code-reading', 'estimate', 'take-home'];
const KIND_LABELS = { concept: 'Concept', tradeoff: 'Trade-off', design: 'Design', debug: 'Debug', 'code-reading': 'Code reading', estimate: 'Estimate', 'take-home': 'Take-home', incident: 'Incident' };
const LEVELS = { 1: 'Screen', 2: 'Working', 3: 'Senior', 4: 'Staff' };
const ROUNDS = ['screen', 'coding', 'take-home', 'system-design', 'design-review', 'debugging', 'ml-depth', 'ml-breadth', 'behavioral', 'customer'];
const QUESTION_KEYS = ['id', 'title', 'card', 'kind', 'level', 'roles', 'rounds', 'tags', 'minutes', 'lessons', 'manuals', 'practice', 'cheatsheet', 'related', 'updated'];
const SCENARIO_KEYS = QUESTION_KEYS.concat(['system', 'source']);
const SYSTEM_KEYS = ['version', 'model', 'hardware'];
const QUESTION_SECTIONS = ['Short answer', 'Full answer', 'Follow-ups', 'Wrong answers', 'Taught in'];
const SCENARIO_SECTIONS = ['Situation', 'Evidence', 'Questions', 'Walkthrough', 'Resolution', 'Wrong turns', 'Generalize', 'Taught in'];
const SCENARIO_CARD = 'scenarios';
const EVIDENCE_KEYS = ['title', 'source', 'lines', 'lang', 'note'];
const EVIDENCE_LANGS = ['text', 'console', 'bash', 'json', 'jsonl', 'python', 'yaml'];
const LOOP_KEYS = ['role', 'title', 'minutes', 'updated'];
const FOLLOW_UP = /^- \*\*Level ([1-4]):\*\* (.+?) Expected: (.+)$/;
const WRONG = /^- "([^"]+)" (\S.*)$/;
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const LEAK_SPAN = 24;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function scalar(value, where) {
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (_) {
      throw new Error(`${where}: the quoted value is not valid`);
    }
  }
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new Error(`${where}: a list must end with ]`);
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(',').map(item => scalar(item.trim(), where)) : [];
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/: | #|^[{}&*!|>'%@`]/.test(value)) throw new Error(`${where}: put double quotes around "${value}"`);
  return value;
}

function parseYaml(text, file) {
  const lines = [];
  text.replace(/\r\n/g, '\n').split('\n').forEach((raw, index) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    if (/^\s*\t/.test(raw)) throw new Error(`${file}:${index + 1}: use spaces, not tabs`);
    lines.push({ indent: /^ */.exec(raw)[0].length, text: raw.trim(), n: index + 1 });
  });
  let i = 0;
  const where = line => `${file}:${line.n}`;
  const isItem = line => line.text === '-' || line.text.startsWith('- ');
  function block(indent) {
    return isItem(lines[i]) ? list(indent) : map(indent);
  }
  function list(indent) {
    const out = [];
    while (i < lines.length && lines[i].indent === indent && isItem(lines[i])) {
      const line = lines[i];
      const rest = line.text.slice(1).trim();
      if (/^[A-Za-z_][\w-]*:(?:\s|$)/.test(rest)) {
        lines[i] = { indent: indent + 2, text: rest, n: line.n };
        out.push(map(indent + 2));
      } else {
        i += 1;
        out.push(scalar(rest, where(line)));
      }
    }
    return out;
  }
  function map(indent) {
    const out = {};
    while (i < lines.length && lines[i].indent === indent && !isItem(lines[i])) {
      const line = lines[i];
      const match = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line.text);
      if (!match) throw new Error(`${where(line)}: expected "key: value", got "${line.text}"`);
      if (Object.prototype.hasOwnProperty.call(out, match[1])) throw new Error(`${where(line)}: duplicate key ${match[1]}`);
      i += 1;
      if (match[2]) out[match[1]] = scalar(match[2], where(line));
      else if (i < lines.length && lines[i].indent > indent) out[match[1]] = block(lines[i].indent);
      else out[match[1]] = null;
    }
    return out;
  }
  if (!lines.length) return null;
  const value = block(lines[0].indent);
  if (i < lines.length) throw new Error(`${where(lines[i])}: unexpected indentation`);
  return value;
}

function splitFrontMatter(text, file) {
  const normal = text.replace(/\r\n/g, '\n');
  if (!normal.startsWith('---\n')) throw new Error(`${file}: the file must start with front matter between two --- lines`);
  const end = normal.indexOf('\n---\n', 4);
  if (end < 0) throw new Error(`${file}: the front matter has no closing --- line`);
  const head = normal.slice(4, end);
  return { data: parseYaml(head, file) || {}, body: normal.slice(end + 5), bodyLine: head.split('\n').length + 3 };
}

function splitSections(body) {
  const lines = body.split('\n');
  const sections = [];
  const preamble = [];
  let current = null;
  let fence = false;
  lines.forEach(line => {
    if (/^```/.test(line)) fence = !fence;
    const heading = !fence && /^## (.+?)\s*$/.exec(line);
    if (heading) {
      current = { title: heading[1], lines: [] };
      sections.push(current);
      return;
    }
    (current ? current.lines : preamble).push(line);
  });
  return {
    preamble: preamble.join('\n').trim(),
    sections: sections.map(section => ({ title: section.title, text: section.lines.join('\n').trim() })),
  };
}

function sectionMap(parsed) {
  return Object.fromEntries(parsed.sections.map(section => [section.title, section.text]));
}

function stripCode(text) {
  const out = [];
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (!fence) out.push(line.replace(/`[^`]*`/g, ' '));
  }
  return out.join('\n');
}

function sentenceCount(text) {
  const flat = stripCode(text).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  if (!flat) return 0;
  return flat.split(/(?<=[.!?]["')*]*)\s+(?=["'(*\[]?[A-Z0-9])/).filter(part => part.trim()).length;
}

function numberTokens(text) {
  const clean = text.replace(/\]\([^)]*\)/g, ']');
  return Array.from(clean.matchAll(NUMBER), match => match[0].replace(/,/g, ''));
}

function needsSource(token) {
  return token.includes('.') || Number(token) >= 10;
}

function normalizeSpan(text) {
  return stripCode(text).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sharedSpans(answer, other, size = LEAK_SPAN) {
  const source = normalizeSpan(answer);
  const target = normalizeSpan(other);
  const found = [];
  if (!source || !target) return found;
  for (let at = 0; at + size <= source.length; at++) {
    if (at > 0 && source[at - 1] !== ' ') continue;
    const span = source.slice(at, at + size);
    if (target.includes(span)) {
      found.push(span);
      at += size;
    }
  }
  return found;
}

function headingSlugs(markdown) {
  const counts = new Map();
  const slugs = new Set();
  let fence = false;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    const match = !fence && /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = match[1].toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
    const seen = counts.get(base) || 0;
    counts.set(base, seen + 1);
    slugs.add(seen ? `${base}-${seen}` : base);
  }
  return slugs;
}

function markdownLinks(markdown) {
  const links = [];
  const lines = markdown.split('\n');
  let fence = false;
  lines.forEach((line, index) => {
    if (/^```/.test(line)) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const visible = line.replace(/`[^`]*`/g, match => ' '.repeat(match.length));
    for (const match of visible.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) links.push({ target: match[1], line: index + 1 });
  });
  return links;
}

function manualSections(root, id, cache) {
  if (cache.has(id)) return cache.get(id);
  const file = path.join(root, 'manuals', id, 'manual.json');
  let value = null;
  if (fs.existsSync(file)) {
    const manual = JSON.parse(read(file));
    const files = manual.parts.flatMap(part => part.sections.map(section => section.file)).concat(((manual.reference || {}).sections || []).map(section => section.file));
    value = { id, title: manual.title, sections: new Map(files.map(name => [`s-${path.basename(name, '.md').replace(/^\d+-\d+-/, '').replace(/^r-\d+-/, 'ref-')}`, `manuals/${id}/${name}`])) };
  }
  cache.set(id, value);
  return value;
}

function lessonTitle(root, lesson) {
  const file = path.join(root, lesson, 'docs', 'en.md');
  if (!fs.existsSync(file)) return '';
  const match = /^#\s+(.+?)\s*$/m.exec(read(file));
  return match ? match[1] : '';
}

function loadDenylist(root) {
  const file = path.join(root, 'scripts', 'interviews', 'denylist.txt');
  if (!fs.existsSync(file)) return [];
  return read(file).split('\n').map(line => line.trim().toLowerCase()).filter(Boolean);
}

function denylistHits(text, names) {
  const lower = text.toLowerCase();
  return names.filter(name => new RegExp(`(?<![a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![a-z0-9])`).test(lower));
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function checkList(value, key, errors, where, { min = 0, max = Infinity } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${where}: ${key} must be a list`);
    return [];
  }
  if (value.length < min || value.length > max) errors.push(`${where}: ${key} must have ${max === Infinity ? `at least ${min}` : `${min} to ${max}`} items`);
  return value;
}

function checkFront(item, ctx) {
  const { data, file, kind } = item;
  const errors = item.errors;
  const keys = kind === 'scenario' ? SCENARIO_KEYS : QUESTION_KEYS;
  for (const key of keys) if (!(key in data)) errors.push(`${file}: front matter has no ${key}`);
  for (const key of Object.keys(data)) if (!keys.includes(key)) errors.push(`${file}: unknown front matter key ${key}`);
  if (errors.length) return;
  if (data.id !== item.id) errors.push(`${file}: id is ${data.id}, the file name gives ${item.id}`);
  if (!ID.test(String(data.id))) errors.push(`${file}: id must be lower case words joined by hyphens`);
  if (typeof data.title !== 'string' || !data.title || data.title.length > 60) errors.push(`${file}: title must have 1 to 60 characters`);
  if (data.card !== item.card) errors.push(`${file}: card is ${data.card}, the folder gives ${item.card}`);
  if (!ctx.cards.has(item.card)) errors.push(`${file}: unknown card ${item.card}`);
  if (kind === 'scenario' ? data.kind !== 'incident' : !KINDS.includes(data.kind)) errors.push(`${file}: kind must be ${kind === 'scenario' ? 'incident' : `one of ${KINDS.join(', ')}`}`);
  if (!Number.isInteger(data.level) || data.level < 1 || data.level > 4) errors.push(`${file}: level must be 1 to 4`);
  for (const role of checkList(data.roles, 'roles', errors, file, { min: 1 })) {
    const entry = ctx.roles.get(role);
    if (!entry) errors.push(`${file}: unknown role ${role}`);
    else if (!entry.cards.includes(item.card)) errors.push(`${file}: role ${role} does not list card ${item.card}`);
  }
  for (const round of checkList(data.rounds, 'rounds', errors, file, { min: 1 })) if (!ROUNDS.includes(round)) errors.push(`${file}: unknown round ${round}`);
  for (const tag of checkList(data.tags, 'tags', errors, file, { min: 1, max: 6 })) if (!ID.test(String(tag))) errors.push(`${file}: tag ${tag} must be lower case hyphenated words`);
  if (!Number.isInteger(data.minutes) || data.minutes < 2 || data.minutes > 60) errors.push(`${file}: minutes must be 2 to 60`);
  const card = ctx.cards.get(item.card);
  for (const lesson of checkList(data.lessons, 'lessons', errors, file)) {
    if (!LESSON.test(String(lesson))) errors.push(`${file}: lesson ${lesson} must be phases/NN-phase/MM-lesson`);
    else if (!fs.existsSync(path.join(ctx.root, lesson, 'docs', 'en.md'))) errors.push(`${file}: lesson ${lesson} does not exist`);
    else if (card && !card.lessons.includes(lesson)) errors.push(`${file}: card ${item.card} does not list lesson ${lesson}`);
  }
  for (const ref of checkList(data.manuals, 'manuals', errors, file)) {
    const match = MANUAL_REF.exec(String(ref));
    if (!match) {
      errors.push(`${file}: manual ${ref} must be <manual-id>#s-<slug>`);
      continue;
    }
    const manual = manualSections(ctx.root, match[1], ctx.manualCache);
    if (!manual) errors.push(`${file}: manual ${match[1]} does not exist`);
    else if (!manual.sections.has(match[2])) errors.push(`${file}: manual ${match[1]} has no section ${match[2]}`);
    else if (card && !card.manuals.includes(match[1])) errors.push(`${file}: card ${item.card} does not list manual ${match[1]}`);
  }
  if (Array.isArray(data.lessons) && Array.isArray(data.manuals) && !data.lessons.length && !data.manuals.length) errors.push(`${file}: name at least one lesson or one manual section`);
  for (const id of checkList(data.practice, 'practice', errors, file)) if (!fs.existsSync(path.join(ctx.root, 'practice', String(id), 'meta.json'))) errors.push(`${file}: practice task ${id} does not exist`);
  for (const id of checkList(data.cheatsheet, 'cheatsheet', errors, file)) if (!fs.existsSync(path.join(ctx.root, 'cheatsheets', `${id}.md`))) errors.push(`${file}: cheat sheet ${id} does not exist`);
  for (const ref of checkList(data.related, 'related', errors, file)) {
    const [cardId, id] = String(ref).split('/');
    const target = cardId === SCENARIO_CARD ? path.join(ctx.root, BANK, 'scenarios', id || '', 'README.md') : path.join(ctx.root, BANK, 'questions', cardId, `${id}.md`);
    if (!id || !fs.existsSync(target)) errors.push(`${file}: related item ${ref} does not exist`);
  }
  const date = String(data.updated);
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) errors.push(`${file}: updated must be a date as YYYY-MM-DD`);
  if (kind === 'scenario') {
    const system = data.system;
    if (!system || typeof system !== 'object' || Array.isArray(system)) errors.push(`${file}: system must have ${SYSTEM_KEYS.join(', ')}`);
    else {
      for (const key of SYSTEM_KEYS) if (typeof system[key] !== 'string' || !system[key]) errors.push(`${file}: system has no ${key}`);
      for (const key of Object.keys(system)) if (!SYSTEM_KEYS.includes(key)) errors.push(`${file}: unknown system key ${key}`);
    }
    for (const source of checkList(data.source, 'source', errors, file, { min: 1 })) {
      const full = path.join(ctx.root, String(source));
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) errors.push(`${file}: source ${source} is not a file`);
    }
  }
}

function sourceTexts(item, ctx) {
  const texts = [];
  for (const lesson of item.data.lessons || []) {
    const file = path.join(ctx.root, lesson, 'docs', 'en.md');
    if (fs.existsSync(file)) texts.push(read(file));
  }
  for (const ref of item.data.manuals || []) {
    const match = MANUAL_REF.exec(String(ref));
    const manual = match && manualSections(ctx.root, match[1], ctx.manualCache);
    const file = manual && manual.sections.get(match[2]);
    if (file) texts.push(read(path.join(ctx.root, file)));
  }
  if (item.kind === 'scenario') {
    for (const source of item.data.source || []) {
      const file = path.join(ctx.root, String(source));
      if (fs.existsSync(file) && fs.statSync(file).isFile()) texts.push(read(file));
    }
    for (const evidence of item.evidence || []) texts.push(evidence.listing);
  }
  return texts;
}

function checkNumbers(item, ctx, parts) {
  const known = new Set(sourceTexts(item, ctx).flatMap(numberTokens));
  for (const [label, text] of parts) {
    const missing = Array.from(new Set(numberTokens(text).filter(token => needsSource(token) && !known.has(token))));
    if (missing.length) item.errors.push(`${item.file}: ${label} has numbers that no named source holds: ${missing.join(', ')}`);
  }
}

function checkSectionOrder(item, parsed, expected) {
  const titles = parsed.sections.map(section => section.title);
  if (titles.join('|') !== expected.join('|')) item.errors.push(`${item.file}: the ## sections must be ${expected.join(', ')}; found ${titles.join(', ') || 'none'}`);
}

function checkWrongList(item, text, label) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2 || lines.length > 5) item.errors.push(`${item.file}: ${label} must have 2 to 5 items`);
  for (const line of lines) if (!WRONG.test(line)) item.errors.push(`${item.file}: ${label} item must be - "wrong answer" reason: ${line}`);
}

function parseFollowUps(text) {
  return text.split('\n').filter(line => line.trim()).map(line => {
    const match = FOLLOW_UP.exec(line);
    return match ? { level: Number(match[1]), question: match[2], expected: match[3], line } : { line };
  });
}

function parseWrong(text) {
  return text.split('\n').filter(line => line.trim()).map(line => {
    const match = WRONG.exec(line);
    return match ? { answer: match[1], reason: match[2] } : { answer: line.replace(/^- /, ''), reason: '' };
  });
}

function checkQuestionBody(item, ctx) {
  const parsed = splitSections(item.body);
  item.parsed = parsed;
  item.sections = sectionMap(parsed);
  if (!parsed.preamble) item.errors.push(`${item.file}: the prompt paragraph before the first ## section is empty`);
  checkSectionOrder(item, parsed, QUESTION_SECTIONS);
  const s = item.sections;
  if (s['Short answer'] !== undefined) {
    const count = sentenceCount(s['Short answer']);
    if (count < 2 || count > 4) item.errors.push(`${item.file}: Short answer must have 2 to 4 sentences; it has ${count}`);
  }
  if (s['Follow-ups'] !== undefined) {
    const items = parseFollowUps(s['Follow-ups']);
    item.followUps = items;
    if (items.length < 3 || items.length > 5) item.errors.push(`${item.file}: Follow-ups must have 3 to 5 items`);
    for (const entry of items) if (!entry.level) item.errors.push(`${item.file}: follow-up must be - **Level N:** question Expected: answer: ${entry.line}`);
    const levels = items.filter(entry => entry.level).map(entry => entry.level);
    if (levels.some((level, index) => index && level < levels[index - 1]) || (levels.length > 1 && levels[levels.length - 1] <= levels[0])) item.errors.push(`${item.file}: follow-up levels must rise: ${levels.join(', ')}`);
  }
  if (s['Wrong answers'] !== undefined) {
    checkWrongList(item, s['Wrong answers'], 'Wrong answers');
    item.wrong = parseWrong(s['Wrong answers']);
  }
  if (s['Taught in'] !== undefined) {
    if (sentenceCount(s['Taught in']) !== 1) item.errors.push(`${item.file}: Taught in must be one sentence`);
    if (!markdownLinks(s['Taught in']).length) item.errors.push(`${item.file}: Taught in must link a lesson or a manual section`);
  }
  checkNumbers(item, ctx, [['the prompt', parsed.preamble]].concat(['Short answer', 'Full answer', 'Follow-ups', 'Wrong answers'].filter(name => s[name] !== undefined).map(name => [name, s[name]])));
  const answers = [s['Short answer'] || '', s['Full answer'] || ''].concat((item.followUps || []).filter(entry => entry.expected).map(entry => entry.expected)).join('\n');
  const asked = [parsed.preamble].concat((item.followUps || []).filter(entry => entry.question).map(entry => entry.question)).join('\n');
  const spans = sharedSpans(answers, asked);
  if (spans.length) item.errors.push(`${item.file}: the prompt or a follow-up question shows an answer span: "${spans[0]}"`);
}

function parseEvidence(text, file) {
  const separator = /\r?\n---\r?\n/.exec(text);
  if (!separator) throw new Error(`${file}: the header must end with a --- line`);
  const header = {};
  for (const line of text.slice(0, separator.index).split(/\r?\n/)) {
    const match = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`${file}: expected "key: value" in the header, got "${line}"`);
    if (match[1] in header) throw new Error(`${file}: duplicate header ${match[1]}`);
    header[match[1]] = match[2].trim();
  }
  const body = text.slice(separator.index + separator[0].length);
  return { header, body, listing: body.replace(/\r?\n$/, '') };
}

function sourceLines(source) {
  return source.match(/[^\n]*\n|[^\n]+$/g) || [];
}

function expectedBody(source, lines) {
  if (lines === undefined) return { body: source };
  const match = /^(\d+)-(\d+)$/.exec(lines);
  const all = sourceLines(source);
  if (!match || Number(match[1]) < 1 || Number(match[2]) < Number(match[1]) || Number(match[2]) > all.length) return { error: `lines must be N-M inside 1-${all.length}` };
  return { body: all.slice(Number(match[1]) - 1, Number(match[2])).join('') };
}

function checkEvidence(item, ctx) {
  const dir = path.join(item.dir, 'evidence');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => !name.startsWith('.')).sort() : [];
  item.evidence = [];
  for (const name of files) {
    const file = rel(ctx.root, path.join(dir, name));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/.test(name)) {
      item.errors.push(`${file}: an evidence file name must be lower case words joined by hyphens, with .txt`);
      continue;
    }
    const raw = read(path.join(dir, name));
    let parsed;
    try {
      parsed = parseEvidence(raw, file);
    } catch (error) {
      item.errors.push(error.message);
      continue;
    }
    const { header, listing, body } = parsed;
    for (const key of ['title', 'source', 'lang', 'note']) if (!header[key]) item.errors.push(`${file}: header has no ${key}`);
    for (const key of Object.keys(header)) if (!EVIDENCE_KEYS.includes(key)) item.errors.push(`${file}: unknown header ${key}`);
    if (header.lang && !EVIDENCE_LANGS.includes(header.lang)) item.errors.push(`${file}: lang must be one of ${EVIDENCE_LANGS.join(', ')}`);
    if (!listing.trim()) item.errors.push(`${file}: the listing is empty`);
    item.evidence.push({ name, file, header, listing, raw });
    if (!header.source) continue;
    if (!(item.data.source || []).includes(header.source)) item.errors.push(`${file}: source ${header.source} is not in the source list of the scenario`);
    const sourceFile = path.join(ctx.root, header.source);
    if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) {
      item.errors.push(`${file}: source ${header.source} is not a file`);
      continue;
    }
    const source = read(sourceFile);
    const expected = expectedBody(source, header.lines);
    if (expected.error) {
      item.errors.push(`${file}: ${expected.error}`);
      continue;
    }
    if (body !== expected.body) item.errors.push(`${file}: the listing does not match ${header.source}${header.lines ? ` lines ${header.lines}` : ''} byte for byte`);
  }
  return files;
}

function checkScenarioBody(item, ctx) {
  const files = checkEvidence(item, ctx);
  const parsed = splitSections(item.body);
  item.parsed = parsed;
  item.sections = sectionMap(parsed);
  if (parsed.preamble) item.errors.push(`${item.file}: put the text before the first ## section into Situation`);
  checkSectionOrder(item, parsed, SCENARIO_SECTIONS);
  const s = item.sections;
  if (s.Evidence !== undefined) {
    const listed = [];
    for (const line of s.Evidence.split('\n').filter(entry => entry.trim())) {
      const match = /^- \[([^\]]+)\]\(evidence\/([a-z0-9-]+\.txt)\)$/.exec(line);
      if (!match) item.errors.push(`${item.file}: Evidence item must be - [what](evidence/<name>.txt): ${line}`);
      else listed.push({ label: match[1], name: match[2] });
    }
    const names = listed.map(entry => entry.name);
    for (const name of new Set(names)) if (names.filter(entry => entry === name).length > 1) item.errors.push(`${item.file}: evidence/${name} is listed twice`);
    for (const name of names) if (!files.includes(name)) item.errors.push(`${item.file}: evidence/${name} does not exist`);
    for (const name of files) if (!names.includes(name)) item.errors.push(`${item.file}: evidence/${name} is not listed in Evidence`);
    item.evidenceOrder = listed;
  }
  if (s.Questions !== undefined) {
    const lines = s.Questions.split('\n').filter(line => line.trim());
    const numbered = lines.filter(line => /^\d+\. \S/.test(line));
    if (numbered.length !== lines.length) item.errors.push(`${item.file}: each line in Questions must be a numbered question`);
    if (numbered.length < 3 || numbered.length > 6) item.errors.push(`${item.file}: Questions must have 3 to 6 items`);
    item.questions = numbered.map(line => line.replace(/^\d+\. /, ''));
  }
  if (s['Wrong turns'] !== undefined) {
    checkWrongList(item, s['Wrong turns'], 'Wrong turns');
    item.wrong = parseWrong(s['Wrong turns']);
  }
  if (s['Taught in'] !== undefined) {
    if (sentenceCount(s['Taught in']) !== 1) item.errors.push(`${item.file}: Taught in must be one sentence`);
    if (!markdownLinks(s['Taught in']).length) item.errors.push(`${item.file}: Taught in must link a lesson or a manual section`);
  }
  checkNumbers(item, ctx, SCENARIO_SECTIONS.filter(name => name !== 'Evidence' && name !== 'Taught in' && s[name] !== undefined).map(name => [name, s[name]]));
  const answers = [s.Walkthrough || '', s.Resolution || ''].join('\n');
  const spans = sharedSpans(answers, [s.Situation || '', s.Questions || ''].join('\n'));
  if (spans.length) item.errors.push(`${item.file}: Situation or Questions shows an answer span: "${spans[0]}"`);
}

function loadTopics(root, errors) {
  const file = path.join(root, BANK, 'topics.yaml');
  const where = `${BANK}/topics.yaml`;
  if (!fs.existsSync(file)) {
    errors.push(`${where} is missing`);
    return { groups: [], cards: [] };
  }
  let data;
  try {
    data = parseYaml(read(file), where) || {};
  } catch (error) {
    errors.push(error.message);
    return { groups: [], cards: [] };
  }
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const groupIds = new Set();
  for (const group of groups) {
    if (!ID.test(String(group.id))) errors.push(`${where}: group id ${group.id} must be lower case words joined by hyphens`);
    if (groupIds.has(group.id)) errors.push(`${where}: group ${group.id} appears twice`);
    groupIds.add(group.id);
    if (!group.title || !group.summary) errors.push(`${where}: group ${group.id} needs a title and a summary`);
  }
  const seen = new Set();
  for (const card of cards) {
    const label = `${where}: card ${card.id}`;
    for (const key of Object.keys(card)) if (!['id', 'title', 'group', 'planned', 'summary', 'lessons', 'manuals'].includes(key)) errors.push(`${label}: unknown key ${key}`);
    if (!ID.test(String(card.id))) errors.push(`${label}: id must be lower case words joined by hyphens`);
    if (seen.has(card.id)) errors.push(`${label}: appears twice`);
    seen.add(card.id);
    if (!card.title || !card.summary) errors.push(`${label}: needs a title and a summary`);
    if (!groupIds.has(card.group)) errors.push(`${label}: unknown group ${card.group}`);
    if (!Number.isInteger(card.planned) || card.planned < 1) errors.push(`${label}: planned must be a positive number`);
    card.lessons = Array.isArray(card.lessons) ? card.lessons : [];
    card.manuals = Array.isArray(card.manuals) ? card.manuals : [];
    if (!card.lessons.length && !card.manuals.length) errors.push(`${label}: needs at least one lesson or manual`);
    for (const lesson of card.lessons) {
      if (!LESSON.test(String(lesson))) errors.push(`${label}: lesson ${lesson} must be phases/NN-phase/MM-lesson`);
      else if (!fs.existsSync(path.join(root, lesson, 'docs', 'en.md'))) errors.push(`${label}: lesson ${lesson} does not exist`);
    }
    for (const manual of card.manuals) if (!fs.existsSync(path.join(root, 'manuals', String(manual), 'manual.json'))) errors.push(`${label}: manual ${manual} does not exist`);
  }
  if (!cards.some(card => card.id === SCENARIO_CARD)) errors.push(`${where}: the card ${SCENARIO_CARD} is missing`);
  return { groups, cards };
}

function loadRoles(root, cardIds, errors) {
  const file = path.join(root, BANK, 'roles.yaml');
  const where = `${BANK}/roles.yaml`;
  if (!fs.existsSync(file)) {
    errors.push(`${where} is missing`);
    return [];
  }
  let roles;
  try {
    roles = parseYaml(read(file), where) || [];
  } catch (error) {
    errors.push(error.message);
    return [];
  }
  const seen = new Set();
  return roles.map(role => {
    const label = `${where}: role ${role.id}`;
    if (!ID.test(String(role.id))) errors.push(`${label}: id must be lower case words joined by hyphens`);
    if (seen.has(role.id)) errors.push(`${label}: appears twice`);
    seen.add(role.id);
    for (const key of Object.keys(role)) if (!['id', 'path', 'title', 'summary', 'cards'].includes(key)) errors.push(`${label}: unknown key ${key}`);
    const out = { id: role.id, path: role.path || null, title: role.title || '', summary: role.summary || '', cards: Array.isArray(role.cards) ? role.cards : [] };
    if (role.path) {
      if (role.title || role.summary) errors.push(`${label}: a role with a path takes its title and summary from the path`);
      const full = path.join(root, String(role.path));
      if (!/^learning-paths\/[a-z0-9-]+\.json$/.test(role.path) || !fs.existsSync(full)) errors.push(`${label}: path ${role.path} does not exist`);
      else {
        const json = JSON.parse(read(full));
        if (json.id !== role.id) errors.push(`${label}: the id in ${role.path} is ${json.id}`);
        if (json.kind !== 'career-route') errors.push(`${label}: ${role.path} is not a career route`);
        out.title = json.title;
        out.summary = json.summary;
        out.commonTitles = json.commonTitles || [];
      }
    } else if (!role.title || !role.summary) errors.push(`${label}: a role without a path needs a title and a summary`);
    if (!out.cards.length) errors.push(`${label}: needs at least one card`);
    for (const card of out.cards) if (!cardIds.has(card)) errors.push(`${label}: unknown card ${card}`);
    return out;
  });
}

function loadItems(root, ctx) {
  const questions = [];
  const questionDir = path.join(root, BANK, 'questions');
  if (fs.existsSync(questionDir)) {
    for (const card of fs.readdirSync(questionDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
      for (const name of fs.readdirSync(path.join(questionDir, card)).filter(entry => entry.endsWith('.md') && entry !== 'README.md').sort()) {
        const full = path.join(questionDir, card, name);
        const item = { kind: 'question', id: name.replace(/\.md$/, ''), card, file: rel(root, full), full, errors: [] };
        try {
          Object.assign(item, splitFrontMatter(read(full), item.file));
        } catch (error) {
          item.errors.push(error.message);
          questions.push(item);
          continue;
        }
        checkFront(item, ctx);
        if (!item.errors.length) checkQuestionBody(item, ctx);
        questions.push(item);
      }
    }
  }
  const scenarios = [];
  const scenarioDir = path.join(root, BANK, 'scenarios');
  if (fs.existsSync(scenarioDir)) {
    for (const id of fs.readdirSync(scenarioDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
      const dir = path.join(scenarioDir, id);
      const full = path.join(dir, 'README.md');
      const item = { kind: 'scenario', id, card: SCENARIO_CARD, dir, file: rel(root, full), full, errors: [] };
      if (!fs.existsSync(full)) {
        item.errors.push(`${item.file} is missing`);
        scenarios.push(item);
        continue;
      }
      try {
        Object.assign(item, splitFrontMatter(read(full), item.file));
      } catch (error) {
        item.errors.push(error.message);
        scenarios.push(item);
        continue;
      }
      checkFront(item, ctx);
      if (!item.errors.length) checkScenarioBody(item, ctx);
      scenarios.push(item);
    }
  }
  return { questions, scenarios };
}

function loadLoops(root, ctx, errors) {
  const dir = path.join(root, BANK, 'loops');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.md')).sort().map(name => {
    const file = `${BANK}/loops/${name}`;
    const id = name.replace(/\.md$/, '');
    let parsed;
    try {
      parsed = splitFrontMatter(read(path.join(dir, name)), file);
    } catch (error) {
      errors.push(error.message);
      return null;
    }
    const { data, body } = parsed;
    for (const key of LOOP_KEYS) if (!(key in data)) errors.push(`${file}: front matter has no ${key}`);
    for (const key of Object.keys(data)) if (!LOOP_KEYS.includes(key)) errors.push(`${file}: unknown front matter key ${key}`);
    if (data.role !== id) errors.push(`${file}: role must equal the file name`);
    if (!ctx.roles.has(id)) errors.push(`${file}: unknown role ${id}`);
    if (!Number.isInteger(data.minutes)) errors.push(`${file}: minutes must be a number`);
    const items = body.split('\n').filter(line => line.startsWith('- '));
    if (!items.length) errors.push(`${file}: list the rounds`);
    for (const line of items) {
      const match = /^- \*\*([a-z-]+)\*\*, (\d+) minutes: \S.* \(card: ([a-z0-9-]+)\)$/.exec(line);
      if (!match || !ROUNDS.includes(match[1])) errors.push(`${file}: a round must be - **<round>**, N minutes: text (card: <card-id>), with a round from the list: ${line}`);
      else if (!ctx.cards.has(match[3])) errors.push(`${file}: unknown card ${match[3]}`);
    }
    return { id, data, body, file };
  }).filter(Boolean);
}

function checkFiles(root, errors, generated) {
  const names = loadDenylist(root);
  for (const full of listFiles(path.join(root, BANK))) {
    const file = rel(root, full);
    if (isGeneratedPath(file)) continue;
    if (!/\.(?:md|yaml|txt)$/.test(file)) {
      errors.push(`${file}: only .md, .yaml and .txt files belong in ${BANK}/`);
      continue;
    }
    const text = read(full);
    const isEvidence = /\/evidence\/[^/]+\.txt$/.test(file);
    const prose = isEvidence ? text.slice(0, Math.max(0, text.indexOf('\n---\n'))) : text;
    if (/[\u2013\u2014]/.test(text)) errors.push(`${file}: remove the em dash or en dash`);
    const hits = denylistHits(text, names);
    if (hits.length) errors.push(`${file}: names a company from the denylist: ${hits.join(', ')}`);
    if (/https?:\/\//i.test(prose)) errors.push(`${file}: use relative repository links, not http links`);
    if (!file.endsWith('.md')) continue;
    checkLinks(root, file, text, errors, generated);
  }
  for (const [file, text] of generated) checkLinks(root, file, text, errors, generated);
}

function checkLinks(root, file, text, errors, generated) {
  const full = path.join(root, file);
  for (const link of markdownLinks(text)) {
    if (/^[a-z]+:/i.test(link.target)) {
      errors.push(`${file}:${link.line}: ${link.target} is not a relative repository link`);
      continue;
    }
    const [target, anchor] = link.target.split('#');
    const resolved = target ? path.resolve(path.dirname(full), decodeURIComponent(target)) : full;
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      errors.push(`${file}:${link.line}: ${link.target} leaves the repository`);
      continue;
    }
    const isDir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
    const doc = isDir ? path.join(resolved, 'README.md') : resolved;
    const future = generated.get(rel(root, doc));
    if (!fs.existsSync(resolved) && future === undefined) {
      errors.push(`${file}:${link.line}: ${link.target} does not exist`);
      continue;
    }
    if (anchor === undefined) continue;
    const docText = future !== undefined ? future : doc.endsWith('.md') && fs.existsSync(doc) ? read(doc) : null;
    if (docText === null || !headingSlugs(docText).has(anchor)) errors.push(`${file}:${link.line}: no heading #${anchor} in ${rel(root, doc)}`);
  }
}

function itemHref(item) {
  return item.kind === 'scenario' ? `scenarios/${item.id}/README.md` : `questions/${item.card}/${item.id}.md`;
}

function readmes(bank) {
  const out = new Map();
  const items = bank.questions.concat(bank.scenarios);
  const byCard = card => items.filter(item => item.card === card.id && item.data);
  const lines = ['# Interviews and scenarios', '', 'This file is generated by `node scripts/interviews/validate.js --write`. Do not edit it.', '', `Questions and scenarios for AI engineering interviews, in ${bank.cards.length} cards. Each answer links to the lessons and manual sections that teach it. Read [AUTHORING.md](AUTHORING.md) before you add an item.`];
  for (const group of bank.groups) {
    lines.push('', `## ${group.title}`, '', group.summary, '', '| Card | Items | Planned |', '|---|---|---|');
    for (const card of bank.cards.filter(entry => entry.group === group.id)) {
      const count = byCard(card).length;
      const index = card.id === SCENARIO_CARD ? 'scenarios/README.md' : `questions/${card.id}/README.md`;
      lines.push(`| ${count ? `[${card.title}](${index})` : card.title} | ${count} | ${card.planned} |`);
    }
  }
  lines.push('', '## Roles', '', '| Role | Cards |', '|---|---|');
  for (const role of bank.roles) lines.push(`| ${role.title} | ${role.cards.length} |`);
  out.set(`${BANK}/README.md`, `${lines.join('\n')}\n`);
  for (const card of bank.cards) {
    const list = bank.questions.filter(item => item.card === card.id && item.data);
    if (!list.length) continue;
    const body = [`# ${card.title}`, '', 'This file is generated by `node scripts/interviews/validate.js --write`. Do not edit it.', '', card.summary, '', '| Question | Kind | Level | Minutes |', '|---|---|---|---|'];
    for (const item of list.sort((a, b) => a.data.level - b.data.level || a.id.localeCompare(b.id))) body.push(`| [${item.data.title}](${item.id}.md) | ${KIND_LABELS[item.data.kind]} | ${item.data.level} ${LEVELS[item.data.level]} | ${item.data.minutes} |`);
    body.push('', '[All cards](../../README.md)');
    out.set(`${BANK}/questions/${card.id}/README.md`, `${body.join('\n')}\n`);
  }
  const scenarios = bank.scenarios.filter(item => item.data);
  if (scenarios.length) {
    const card = bank.cards.find(entry => entry.id === SCENARIO_CARD);
    const body = [`# ${card ? card.title : 'Scenarios'}`, '', 'This file is generated by `node scripts/interviews/validate.js --write`. Do not edit it.', '', card ? card.summary : '', '', '| Scenario | Level | System | Minutes |', '|---|---|---|---|'];
    for (const item of scenarios.sort((a, b) => a.data.level - b.data.level || a.id.localeCompare(b.id))) body.push(`| [${item.data.title}](${item.id}/README.md) | ${item.data.level} ${LEVELS[item.data.level]} | ${item.data.system.version}, ${item.data.system.hardware} | ${item.data.minutes} |`);
    body.push('', '[All cards](../README.md)');
    out.set(`${BANK}/scenarios/README.md`, `${body.join('\n')}\n`);
  }
  return out;
}

function isGeneratedPath(file) {
  return file === `${BANK}/README.md` || file === `${BANK}/scenarios/README.md` || /^interviews\/questions\/[^/]+\/README\.md$/.test(file);
}

function generatedPaths(root) {
  return listFiles(path.join(root, BANK)).map(full => rel(root, full)).filter(isGeneratedPath);
}

function loadBank(root = REPO_ROOT) {
  const errors = [];
  const topics = loadTopics(root, errors);
  const cards = new Map(topics.cards.map(card => [card.id, card]));
  const roles = loadRoles(root, new Set(cards.keys()), errors);
  const ctx = { root, cards, roles: new Map(roles.map(role => [role.id, role])), manualCache: new Map() };
  const { questions, scenarios } = loadItems(root, ctx);
  for (const item of questions.concat(scenarios)) errors.push(...item.errors);
  const loops = loadLoops(root, ctx, errors);
  const bank = { root, groups: topics.groups, cards: topics.cards, roles, questions, scenarios, loops, errors, manualCache: ctx.manualCache };
  bank.readmes = readmes(bank);
  checkFiles(root, errors, bank.readmes);
  return bank;
}

function staleReadmes(bank) {
  const problems = [];
  for (const [file, body] of bank.readmes) {
    const full = path.join(bank.root, file);
    if (!fs.existsSync(full) || read(full) !== body) problems.push(`${file} is not current. Run node scripts/interviews/validate.js --write`);
  }
  for (const file of generatedPaths(bank.root)) if (!bank.readmes.has(file)) problems.push(`${file} has no item. Run node scripts/interviews/validate.js --write`);
  return problems;
}

function writeReadmes(bank) {
  for (const file of generatedPaths(bank.root)) if (!bank.readmes.has(file)) fs.unlinkSync(path.join(bank.root, file));
  for (const [file, body] of bank.readmes) {
    fs.mkdirSync(path.dirname(path.join(bank.root, file)), { recursive: true });
    fs.writeFileSync(path.join(bank.root, file), body);
  }
}

function main(argv) {
  const rootArg = argv.indexOf('--root');
  const root = rootArg >= 0 ? path.resolve(argv[rootArg + 1]) : REPO_ROOT;
  let bank = loadBank(root);
  if (argv.includes('--write')) {
    writeReadmes(bank);
    bank = loadBank(root);
  }
  const stale = staleReadmes(bank);
  const problems = argv.includes('--check-readmes') ? bank.errors.concat(stale) : bank.errors;
  console.log(`Checked ${bank.cards.length} cards, ${bank.roles.length} roles, ${bank.questions.length} questions, ${bank.scenarios.length} scenarios and ${bank.loops.length} loops.`);
  for (const problem of problems) console.error(`  ${problem}`);
  if (stale.length && !argv.includes('--check-readmes')) console.log(`${stale.length} generated README files differ from the items. CI makes them again on main, so a pull request leaves them as they are.`);
  return problems.length ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {
  loadBank,
  parseYaml,
  splitFrontMatter,
  splitSections,
  sentenceCount,
  numberTokens,
  needsSource,
  sharedSpans,
  headingSlugs,
  markdownLinks,
  parseEvidence,
  expectedBody,
  parseFollowUps,
  parseWrong,
  denylistHits,
  manualSections,
  lessonTitle,
  staleReadmes,
  writeReadmes,
  itemHref,
  KINDS,
  KIND_LABELS,
  LEVELS,
  ROUNDS,
  QUESTION_SECTIONS,
  SCENARIO_SECTIONS,
  SCENARIO_CARD,
  LEAK_SPAN,
};
