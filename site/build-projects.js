#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANGUAGES = new Set(['python', 'typescript', 'rust', 'go']);
const LEVELS = [
  { level: 1, name: 'Starter', summary: 'One program, one clear input and output. No model needed to pass the tests.' },
  { level: 2, name: 'Builder', summary: 'A pipeline of three or more parts with a typed contract between them.' },
  { level: 3, name: 'Engineer', summary: 'State, budgets, retries, traces, and one measured eval number.' },
  { level: 4, name: 'Systems', summary: 'Isolation, concurrency, protocols, many tools, long-running work.' },
  { level: 5, name: 'Frontier', summary: 'Compare agent systems, trace failures, and measure reproducible experiments.' },
];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function relative(root, file) { return path.relative(root, file).split(path.sep).join('/'); }
function ensure(condition, message) { if (!condition) throw new Error(message); }
function within(root, file) {
  const base = fs.realpathSync(root);
  const resolved = path.resolve(file);
  let ancestor = resolved;
  const missing = [];
  while (!fs.existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  const check = path.join(fs.realpathSync(ancestor), ...missing);
  const rel = path.relative(base, check);
  ensure(!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel), `path escapes project root: ${file}`);
  return resolved;
}
function localPath(root, value, label, exists = true) {
  ensure(typeof value === 'string' && value && !path.isAbsolute(value) && !value.includes('\\'), `${label}: expected relative path`);
  const file = within(root, path.join(root, value));
  ensure(!exists || fs.existsSync(file), `${label}: missing ${value}`);
  return file;
}
function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  function visit(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = within(root, path.join(dir, item.name));
      if (item.isDirectory()) visit(file);
      else if (fs.statSync(file).isFile()) files.push(file);
    }
  }
  visit(root);
  return files;
}
function nonemptyDirectory(root, file, label) {
  within(root, file);
  ensure(fs.existsSync(file) && fs.statSync(file).isDirectory() && filesUnder(file).length, `${label}: nonempty directory required`);
}
function requireText(value, label) { ensure(typeof value === 'string' && value.trim(), `${label}: nonempty text required`); }
function argv(value, label) { ensure(Array.isArray(value) && value.length && value.every(x => typeof x === 'string' && x.length), `${label}: nonempty argv array required`); }
function figureRegistry(root) {
  const registry = new Map();
  const site = path.join(root, 'site');
  const sources = [path.join(site, 'figures-projects.js'), ...filesUnder(path.join(site, 'figures', 'projects')).filter(file => file.endsWith('.js'))];
  for (const file of sources.filter(fs.existsSync)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/['"](pj-[a-z0-9-]+)['"]\s*:/g)) registry.set(match[1], relative(site, file));
    for (const match of text.matchAll(/\.register\s*\(\s*['"](pj-[a-z0-9-]+)['"]/g)) registry.set(match[1], relative(site, file));
  }
  return registry;
}
function validateRunners(stage, project, label) {
  const language = stage.language || String(project.languages[0]).toLowerCase();
  ensure(typeof language === 'string' && language.split('+').every(part => LANGUAGES.has(part)), `${label}: unsupported language`);
  const runners = stage.runners || [{ language, ...(stage.runner ? { argv: stage.runner } : {}) }];
  ensure(Array.isArray(runners) && runners.length, `${label}: runners required`);
  for (const runner of runners) {
    ensure(runner && typeof runner === 'object' && LANGUAGES.has(runner.language || language), `${label}: each runner needs one language`);
    if (runner.argv !== undefined) argv(runner.argv, `${label}.argv`);
    for (const timeout of [stage.timeout, runner.timeout].filter(value => value !== undefined)) ensure(Number.isFinite(timeout) && timeout > 0 && timeout <= 600, `${label}: invalid timeout`);
    for (const requirements of [stage.requires, runner.requires].filter(value => value !== undefined)) ensure(Array.isArray(requirements) && requirements.every(value => typeof value === 'string' && value), `${label}: requires must list executable names`);
    if (runner.optional !== undefined) ensure(typeof runner.optional === 'boolean', `${label}: optional must be boolean`);
    for (const argument of runner.argv || []) for (const token of argument.matchAll(/\{([^}]+)\}/g)) ensure(['workspace', 'project', 'stage', 'tests', 'python'].includes(token[1]), `${label}: unknown runner placeholder ${token[0]}`);
  }
  return language;
}

function loadProject(dir, options = {}) {
  const root = options.root || ROOT;
  const strict = !!options.strict;
  const registry = options.registry || figureRegistry(root);
  const manifest = path.join(dir, 'project.json');
  if (!fs.existsSync(manifest)) return null;
  within(path.join(root, 'projects'), dir);
  within(dir, manifest);
  const raw = fs.readFileSync(manifest);
  const project = JSON.parse(raw.toString('utf8'));
  const id = path.basename(dir);
  const label = relative(root, manifest);
  ensure(project.id === id && SLUG.test(id), `${label}: id must match lowercase hyphenated directory`);
  for (const key of ['title', 'tagline', 'summary']) requireText(project[key], `${label}.${key}`);
  ensure(LEVELS.some(level => level.level === project.level), `${label}: level must be 1-5`);
  ensure(Number.isFinite(project.hours) && project.hours > 0, `${label}: hours must be positive`);
  ensure(Array.isArray(project.languages) && project.languages.length && project.languages.every(language => LANGUAGES.has(String(language).toLowerCase())), `${label}: supported languages required`);
  ensure(['ready', 'draft'].includes(project.status), `${label}: status must be ready or draft`);
  ensure(['core', 'community'].includes(project.source), `${label}: source must be core or community`);
  ensure(Array.isArray(project.stages) && project.stages.length, `${label}: stages must be nonempty`);
  const ready = project.status === 'ready';
  if (ready) {
    ensure(fs.existsSync(within(dir, path.join(dir, 'README.md'))), `${label}: README.md required`);
    nonemptyDirectory(dir, path.join(dir, 'solution'), `${label}.solution`);
    if (strict) ensure(project.stages.length >= 4 && project.stages.length <= 8, `${label}: ready projects need 4-8 stages`);
  }
  const seen = new Set();
  const scripts = new Set();
  const stages = project.stages.map((stage, index) => {
    ensure(stage && SLUG.test(stage.id || '') && !seen.has(stage.id), `${label}: invalid or duplicate stage id ${stage && stage.id}`);
    seen.add(stage.id);
    for (const key of ['title', 'summary']) requireText(stage[key], `${label}.${stage.id}.${key}`);
    ensure(Number.isFinite(stage.hours) && stage.hours > 0, `${label}.${stage.id}: hours must be positive`);
    const language = validateRunners(stage, project, `${label}.${stage.id}`);
    const stageDir = within(dir, path.join(dir, 'stages', stage.id));
    const doc = within(dir, path.join(stageDir, 'docs', 'en.md'));
    if (ready) {
      ensure(fs.existsSync(doc) && fs.statSync(doc).isFile(), `${relative(root, doc)} is missing`);
      nonemptyDirectory(dir, path.join(stageDir, 'starter'), `${label}.${stage.id}.starter`);
      nonemptyDirectory(dir, path.join(stageDir, 'tests'), `${label}.${stage.id}.tests`);
    }
    const text = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8') : '';
    const figures = [...new Set([...(stage.figure ? [stage.figure] : []), ...Array.from(text.matchAll(/```figure\s*\n([^`]+)```/g), match => match[1].trim())])];
    if (ready && strict) ensure(figures.length, `${label}.${stage.id}: at least one mechanism figure is required`);
    for (const figure of figures) {
      ensure(registry.has(figure), `${label}.${stage.id}: unregistered figure ${figure}`);
      scripts.add(registry.get(figure));
    }
    return { ...stage, language, number: index + 1, doc: relative(root, doc), contentUrl: `project-content/${id}/stages/${stage.id}/docs/en.md`, tests: relative(root, path.join(stageDir, 'tests')), figures };
  });
  if (project.demo !== undefined) {
    ensure(project.demo && typeof project.demo === 'object', `${label}.demo must be an object`);
    if (project.demo.command !== undefined) argv(project.demo.command, `${label}.demo.command`);
    if (project.demo.cwd !== undefined) localPath(dir, project.demo.cwd, `${label}.demo.cwd`);
    for (const key of ['path', 'poster', 'video']) if (project.demo[key] !== undefined) localPath(dir, project.demo[key], `${label}.demo.${key}`, strict);
  }
  if (project.demos !== undefined) {
    ensure(Array.isArray(project.demos), `${label}.demos must be an array`);
    for (const demo of project.demos) {
      ensure(demo && typeof demo === 'object', `${label}.demos item must be an object`);
      for (const key of ['gif', 'poster', 'video']) if (demo[key] !== undefined) localPath(dir, demo[key], `${label}.demos.${key}`, strict);
    }
  }
  if (ready && strict) {
    ensure(project.demo && project.demo.command, `${label}: a runnable demo command is required`);
    ensure(project.demos && project.demos.some(demo => demo.gif || demo.video), `${label}: a recorded demo is required`);
  }
  return { ...project, path: relative(root, dir), readme: relative(root, path.join(dir, 'README.md')), contentBase: `project-content/${id}`, manifestHash: crypto.createHash('sha256').update(raw).digest('hex'), stages, figureScripts: [...scripts] };
}

function buildData(options = {}) {
  const root = options.root || ROOT;
  const projectsDir = path.join(root, 'projects');
  const registry = figureRegistry(root);
  const loaded = fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')).map(entry => loadProject(path.join(projectsDir, entry.name), { ...options, root, registry })).filter(Boolean) : [];
  const projects = loaded.filter(project => project.status === 'ready').sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
  const readyIds = new Set(projects.map(project => project.id));
  const roadmapFile = path.join(projectsDir, 'roadmap.json');
  const roadmap = fs.existsSync(roadmapFile) ? readJson(roadmapFile).planned : [];
  ensure(Array.isArray(roadmap), 'roadmap.planned must be an array');
  const seen = new Set();
  for (const entry of roadmap) {
    ensure(entry && SLUG.test(entry.id || '') && !seen.has(entry.id), `roadmap: invalid or duplicate id ${entry && entry.id}`);
    ensure(LEVELS.some(level => level.level === entry.level), `roadmap: invalid level for ${entry.id}`);
    requireText(entry.title, `roadmap.${entry.id}.title`);
    seen.add(entry.id);
  }
  const planned = roadmap.filter(project => !readyIds.has(project.id)).map(project => ({ ...project, status: 'planned' }));
  for (const project of loaded.filter(project => project.status === 'draft')) if (!seen.has(project.id)) planned.push({ ...project, status: 'draft' });
  return { generated: new Date().toISOString().slice(0, 10), repo: 'https://github.com/rohitg00/ai-engineering-from-scratch', levels: LEVELS, projects, planned };
}

function bundleContent(data, root, outDir) {
  const content = path.join(outDir, 'project-content');
  fs.mkdirSync(content, { recursive: true });
  for (const project of data.projects) {
    const source = path.join(root, project.path);
    const copy = file => {
      const target = path.join(content, project.id, relative(source, file));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(within(source, file), target);
    };
    copy(path.join(source, 'README.md'));
    for (const stage of project.stages) for (const file of filesUnder(path.join(source, 'stages', stage.id, 'docs'))) copy(file);
    for (const file of filesUnder(path.join(source, 'media'))) copy(file);
    for (const demo of [project.demo, ...(project.demos || [])].filter(Boolean)) for (const key of ['path', 'poster', 'video', 'gif']) if (demo[key] && fs.existsSync(path.join(source, demo[key]))) copy(path.join(source, demo[key]));
  }
}

function main() {
  const data = buildData({ strict: process.argv.includes('--strict') });
  bundleContent(data, ROOT, __dirname);
  fs.writeFileSync(path.join(__dirname, 'projects-data.js'), `window.AIFS_PROJECTS = ${JSON.stringify(data, null, 2)};\n`);
  console.log(`projects-data.js: ${data.projects.length} ready, ${data.planned.length} planned`);
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(`projects build: ${error.message}`); process.exitCode = 1; }
}
module.exports = { buildData, loadProject, bundleContent, within, LEVELS };
