'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVIDENCE_DIR = 'cheatsheets/evidence';
const SHARED_FILES = new Set(['cheatsheets/topics.yaml']);
const PAIR = /(?:^|[\s,;:(])([A-Za-z0-9][A-Za-z0-9_]*(?:\/[A-Za-z0-9_]+)?)\s*=\s*((?:\.\.\.\/)?[A-Za-z0-9_][A-Za-z0-9_.\-/]*)/g;
const END = '(?![\\d:/A-Za-z_-]|\\.[\\dA-Za-z])';
const REF = new RegExp(`([A-Za-z0-9_][A-Za-z0-9_.\\-/]*):(\\d+(?:-\\d+)?(?:,\\s*\\d+(?:-\\d+)?${END})*)${END}`, 'g');
const LIST_KEYS = /(?:^|[\s:])[A-Za-z][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z][A-Za-z0-9_]*)+\s*=/;
const RANGE_KEYS = /[A-Za-z0-9]\.\.[A-Za-z0-9]|\s\.\.\s/;
const FILE_LIKE = /\.(?:md|py|ts|tsx|js|mjs|rs|go|jl|sh|txt|log|json|jsonl|yaml|yml|toml|csv|http|ipynb)$/;

function abbreviations(header) {
  const keys = new Map();
  let previous = '';
  for (const line of header) {
    for (const match of line.matchAll(PAIR)) {
      const key = match[1];
      let value = match[2].replace(/\.+$/, '').replace(/\/+$/, '');
      if (value.startsWith('.../')) value = `${path.posix.dirname(previous)}/${value.slice(4)}`;
      const owner = key.split('/')[0];
      if (key.includes('/') && !keys.has(value.split('/')[0])) value = `${owner}/${value}`;
      keys.set(key, value);
      previous = value;
    }
  }
  return keys;
}

function expand(token, keys, seen = new Set()) {
  const parts = token.split('/');
  const pair = parts.slice(0, 2).join('/');
  if (parts.length > 1 && keys.has(pair) && !seen.has(pair)) return expand([keys.get(pair), ...parts.slice(2)].join('/'), keys, new Set([...seen, pair]));
  return parts.map(part => {
    if (!keys.has(part) || seen.has(part)) return part;
    return expand(keys.get(part), keys, new Set([...seen, part]));
  }).join('/');
}

function lineCount(file, cache) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8').replace(/\n$/, '').split('\n').length);
  return cache.get(file);
}

function parseEvidence(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex(line => line.startsWith('## '));
  const header = first === -1 ? lines : lines.slice(0, first);
  const keys = abbreviations(header);
  const sections = [];
  for (const [index, line] of lines.entries()) {
    if (first === -1 || index < first) continue;
    if (line.startsWith('## ')) {
      sections.push({ title: line.slice(3), refs: [] });
      continue;
    }
    if (!/^\s*(?:[-*]|\d+\.)\s/.test(line)) continue;
    for (const match of line.matchAll(REF)) {
      const token = match[1].replace(/^[.\-/]+/, '');
      if (/^https?$/i.test(token) || !(token.includes('/') || keys.has(token) || FILE_LIKE.test(token))) continue;
      const spans = match[2].split(/,\s*/).map(span => span.split('-').map(Number));
      sections[sections.length - 1].refs.push({ token, file: expand(token, keys), spans, line: index + 1 });
    }
  }
  const listed = header.some(line => LIST_KEYS.test(line) || RANGE_KEYS.test(line));
  return { title: lines[0], keys, sections, listed };
}

function inherited(file, before, root) {
  let base = path.posix.dirname(before);
  while (base && base !== '.') {
    const candidate = `${base}/${file}`;
    if (fs.existsSync(path.join(root, candidate))) return candidate;
    base = path.posix.dirname(base);
  }
  return '';
}

function refProblem(ref, entry, root, cache) {
  const file = ref.file;
  const plain = path.posix.normalize(file) === file && !file.startsWith('/') && !file.split('/').includes('..');
  if (!plain) return `${ref.token} is not a plain repository path`;
  const inScope = SHARED_FILES.has(file) || entry.sources.some(source => file === source || file.startsWith(`${source}/`));
  if (!inScope) return `${ref.token} (${file}) is not in a source of this topic`;
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return `${ref.token} (${file}) does not exist`;
  const total = lineCount(full, cache);
  for (const [start, end = start] of ref.spans) {
    if (start < 1 || end < start || end > total) return `${ref.token}:${start}${end === start ? '' : `-${end}`} is outside ${file} (${total} lines)`;
  }
  return '';
}

function evidenceProblems(text, entry, blocks, root, cache = new Map()) {
  const problems = [];
  const parsed = parseEvidence(text);
  if (parsed.title !== `# Evidence: cheatsheets/${entry.id}.md`) problems.push(`the evidence file must start with "# Evidence: cheatsheets/${entry.id}.md"`);
  if (parsed.listed) problems.push('the abbreviations use a list or a range of keys. Give one KEY = path pair for each key');
  const previous = new Map();
  for (const section of parsed.sections) {
    for (const ref of section.refs) {
      const before = previous.get(ref.line);
      if (before && !fs.existsSync(path.join(root, ref.file))) ref.file = inherited(ref.file, before, root) || ref.file;
      const problem = refProblem(ref, entry, root, cache);
      ref.ok = !problem;
      if (problem) problems.push(`evidence line ${ref.line}: ${problem}`);
      else previous.set(ref.line, ref.file);
    }
  }
  for (const block of blocks) {
    const section = parsed.sections.find(item => item.title.includes(block.title)) || parsed.sections.find(item => titleKey(item.title).includes(titleKey(block.title)));
    if (!section) problems.push(`the evidence file has no section for the block "${block.title}"`);
    else if (!section.refs.some(ref => ref.ok)) problems.push(`the evidence section for "${block.title}" gives no valid path:line`);
    else {
      const facts = factCount(block);
      const cited = new Set(section.refs.filter(ref => ref.ok).map(ref => ref.line)).size;
      if (cited < facts) problems.push(`the evidence section for "${block.title}" cites ${cited} of ${facts} facts. Give one bullet with a valid path:line for each row, step, node or item`);
    }
  }
  return problems;
}

function factCount(block) {
  return (block.rows || block.items || block.nodes || []).length;
}

function titleKey(title) {
  return title.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function evidenceFile(id) {
  return `${EVIDENCE_DIR}/${id}.md`;
}

function checkEvidence(map, topics, root) {
  const byId = new Map(map.topics.map(entry => [entry.id, entry]));
  const cache = new Map();
  const problems = [];
  let refs = 0;
  for (const topic of topics) {
    const entry = byId.get(topic.id);
    if (!entry) continue;
    const file = evidenceFile(topic.id);
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      problems.push(`${file}: the evidence file is missing`);
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    refs += parseEvidence(text).sections.reduce((sum, section) => sum + section.refs.length, 0);
    for (const problem of evidenceProblems(text, entry, topic.blocks, root, cache)) problems.push(`${file}: ${problem}`);
  }
  return { problems, refs };
}

module.exports = { EVIDENCE_DIR, parseEvidence, evidenceProblems, evidenceFile, checkEvidence };
