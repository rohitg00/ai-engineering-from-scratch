'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAP_FILE = 'cheatsheets/topics.yaml';
const KINDS = ['concept', 'commands', 'comparison', 'debugging', 'manual', 'project'];
const FIELDS = ['id', 'title', 'kind', 'sources', 'explainer'];
const HASH_EXTENSIONS = /\.(?:md|py|ts|tsx|js|mjs|rs|jl|go|sh|txt|log|json|jsonl|yaml|yml|toml|csv)$/;
const SKIP_DIRS = new Set(['node_modules', '__pycache__', 'figures', 'media', 'starter', 'notebook', 'assets', 'images']);
const SKIP_FILES = new Set(['quiz.json', 'package-lock.json', '.gitkeep']);
const MAX_FILE_BYTES = 400000;

function scalar(value, where, errors) {
  if (/^".*"$/.test(value)) {
    try {
      return JSON.parse(value);
    } catch (_) {
      errors.push(`${where}: the quoted value is not valid`);
      return value;
    }
  }
  if (/: |^[\[\]{}&*!|>'"%@`#]| #/.test(value)) errors.push(`${where}: put double quotes around "${value}"`);
  return value;
}

function parseTopicMap(text, file = MAP_FILE) {
  const errors = [];
  const topics = [];
  let current = null;
  let inSources = false;
  text.replace(/\r\n/g, '\n').split('\n').forEach((raw, index) => {
    const where = `${file}:${index + 1}`;
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) return;
    const start = /^- id:\s*(\S+)$/.exec(line);
    if (start) {
      current = { id: start[1], title: '', kind: '', sources: [], line: index + 1 };
      topics.push(current);
      inSources = false;
      return;
    }
    if (!current) {
      errors.push(`${where}: expected "- id: <id>"`);
      return;
    }
    const item = /^ {4}- (\S+)$/.exec(line);
    if (item && inSources) {
      current.sources.push(item[1]);
      return;
    }
    const field = /^ {2}([a-z]+):\s*(.*)$/.exec(line);
    if (!field || !FIELDS.includes(field[1]) || field[1] === 'id') {
      errors.push(`${where}: unexpected line "${line.trim()}"`);
      return;
    }
    inSources = field[1] === 'sources';
    if (inSources) {
      if (field[2]) errors.push(`${where}: list the sources on their own lines`);
      return;
    }
    current[field[1]] = scalar(field[2], where, errors);
  });
  const seen = new Set();
  for (const topic of topics) {
    const where = `${file}:${topic.line}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id)) errors.push(`${where}: id "${topic.id}" must be lower case with hyphens`);
    if (seen.has(topic.id)) errors.push(`${where}: id "${topic.id}" appears twice`);
    seen.add(topic.id);
    if (!topic.title) errors.push(`${where}: topic "${topic.id}" needs a title`);
    if (!KINDS.includes(topic.kind)) errors.push(`${where}: topic "${topic.id}" kind must be one of ${KINDS.join(', ')}`);
    if (!topic.sources.length) errors.push(`${where}: topic "${topic.id}" needs sources`);
    if (topic.explainer !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(topic.explainer)) errors.push(`${where}: explainer "${topic.explainer}" must be a page name such as inside-a-decompiler.html`);
  }
  return { topics, errors };
}

function loadTopicMap(root) {
  const file = path.join(root, MAP_FILE);
  if (!fs.existsSync(file)) return { topics: [], errors: [`${MAP_FILE} does not exist`] };
  return parseTopicMap(fs.readFileSync(file, 'utf8'));
}

function listDirs(root, parent, keep) {
  const dir = path.join(root, parent);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.') && keep(path.join(dir, entry.name)))
    .map(entry => `${parent}/${entry.name}`)
    .sort();
}

function coverageUniverse(root) {
  const lessons = listDirs(root, 'phases', () => true).flatMap(phase => listDirs(root, phase, dir => fs.existsSync(path.join(dir, 'docs', 'en.md'))));
  const manuals = listDirs(root, 'manuals', dir => fs.existsSync(path.join(dir, 'sections')));
  const projects = listDirs(root, 'projects', dir => fs.existsSync(path.join(dir, 'project.json')));
  return { lessons, manuals, projects };
}

function sourceFiles(source, root) {
  const files = [];
  const walk = rel => {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) return;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) {
        if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
        const child = `${rel}/${name}`;
        if (/(^|\/)docs$/.test(rel) && name !== 'en.md') continue;
        walk(child);
      }
      return;
    }
    if (HASH_EXTENSIONS.test(rel) && !SKIP_FILES.has(path.basename(rel)) && stat.size <= MAX_FILE_BYTES) files.push(rel);
  };
  walk(source.replace(/\/+$/, ''));
  return files;
}

function sourceHash(sources, root) {
  const hash = crypto.createHash('sha256');
  for (const source of [...sources].sort()) {
    for (const file of sourceFiles(source, root)) {
      hash.update(file);
      hash.update('\0');
      hash.update(fs.readFileSync(path.join(root, file)));
      hash.update('\0');
    }
  }
  return hash.digest('hex').slice(0, 16);
}

function sameList(a, b) {
  return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
}

function mapProblems(map, sheets, root) {
  const problems = map.errors.slice();
  const universe = coverageUniverse(root);
  const covered = new Set(map.topics.flatMap(topic => topic.sources));
  for (const [label, items] of [['lesson', universe.lessons], ['manual', universe.manuals], ['project', universe.projects]]) {
    for (const item of items) if (!covered.has(item)) problems.push(`${MAP_FILE}: the ${label} ${item} is in no topic`);
  }
  for (const topic of map.topics) {
    for (const source of topic.sources) {
      if (!fs.existsSync(path.join(root, source))) problems.push(`${MAP_FILE}: topic "${topic.id}" names ${source}, which does not exist`);
    }
  }
  const byId = new Map(map.topics.map(topic => [topic.id, topic]));
  for (const sheet of sheets) {
    const entry = byId.get(sheet.id);
    if (!entry) {
      problems.push(`${sheet.file}: topic "${sheet.id}" is not in ${MAP_FILE}`);
      continue;
    }
    if (!sameList(entry.sources, sheet.sources)) problems.push(`${sheet.file}: the sources must match the "${sheet.id}" entry in ${MAP_FILE}`);
    if (entry.title !== sheet.title) problems.push(`${sheet.file}: the title must match the "${sheet.id}" entry in ${MAP_FILE}`);
  }
  return problems;
}

function mapStatus(map, sheets, root) {
  const byId = new Map(sheets.map(sheet => [sheet.id, sheet]));
  const missing = [];
  const stale = [];
  for (const topic of map.topics) {
    const sheet = byId.get(topic.id);
    if (!sheet) missing.push(topic.id);
    else if (sheet.sourceHash !== sourceHash(topic.sources, root)) stale.push(topic.id);
  }
  const universe = coverageUniverse(root);
  const covered = new Set(map.topics.flatMap(topic => topic.sources));
  const all = universe.lessons.length + universe.manuals.length + universe.projects.length;
  const done = [...universe.lessons, ...universe.manuals, ...universe.projects].filter(item => covered.has(item)).length;
  return { topics: map.topics.length, sheets: sheets.length, missing, stale, coverage: { covered: done, total: all, lessons: universe.lessons.filter(item => covered.has(item)).length, lessonTotal: universe.lessons.length } };
}

module.exports = { MAP_FILE, KINDS, parseTopicMap, loadTopicMap, coverageUniverse, sourceFiles, sourceHash, mapProblems, mapStatus };
