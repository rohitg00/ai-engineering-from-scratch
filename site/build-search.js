'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE = __dirname;
const OUTPUT = 'pagefind';
const LEVELS = ['1', '2', '3', '4'];
const SOURCES = [
  { type: 'Practice', dir: 'practice', url: name => (name === 'index' ? '/practice' : `/practice/${name}`) },
  { type: 'Practice', dir: 'practice/tracks', url: name => `/practice/tracks/${name}` },
  { type: 'Cheat sheet', dir: 'cheatsheets', url: name => (name === 'index' ? '/cheatsheets' : `/cheatsheets/${name}`) },
  { type: 'Phase', dir: 'hubs/phase', url: name => `/phase/${name}` },
  { type: 'Glossary', dir: 'hubs/glossary', url: name => `/glossary/${name}` },
];
const DROP = /<(script|style|svg|textarea|nav|form|button|template|noscript)\b[\s\S]*?<\/\1>/gi;

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.html')).sort().map(name => path.join(dir, name));
}

function searchHtml(html, type) {
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(html);
  const body = (main ? main[1] : html).replace(DROP, ' ');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body><main data-pagefind-body data-pagefind-filter="type:${escapeAttr(type)}">${body}</main></body></html>`;
}

function collectPages(siteDir = SITE) {
  const pages = [];
  for (const source of SOURCES) {
    for (const file of htmlFiles(path.join(siteDir, source.dir))) {
      pages.push({ url: source.url(path.basename(file, '.html')), type: source.type, file });
    }
  }
  const manuals = path.join(siteDir, 'manual');
  if (fs.existsSync(manuals)) {
    for (const id of fs.readdirSync(manuals).sort()) {
      for (const file of htmlFiles(path.join(manuals, id))) {
        pages.push({ url: `/${id}/${path.basename(file, '.html')}`, type: 'Manual', file });
      }
    }
  }
  return pages.map(page => ({ ...page, content: searchHtml(fs.readFileSync(page.file, 'utf8'), page.type) }));
}

function list(value) {
  return (Array.isArray(value) ? value : [value]).filter(item => item != null && item !== '').map(String);
}

function interviewRecord({ url, title, content, topic, level, role, type = 'Interview' }) {
  if (!/^\/[a-z0-9/-]*$/.test(url || '')) throw new Error(`search record url must be a site path: ${url}`);
  if (!title || !content) throw new Error(`search record ${url} needs a title and content`);
  const levels = list(level);
  if (!levels.length || !levels.every(item => LEVELS.includes(item))) throw new Error(`search record ${url} needs a level from 1 to 4`);
  const topics = list(topic);
  const roles = list(role);
  if (!topics.length || !roles.length) throw new Error(`search record ${url} needs a topic and a role`);
  return { url, content, language: 'en', meta: { title }, filters: { type: [type], topic: topics, level: levels, role: roles } };
}

const LESSON_TEXT_LIMIT = 12000;
const INLINE_CODE_LIMIT = 40;
const LESSON_PATH = /(phases\/[^/?#]+\/[^/?#]+)/;

function loadPhases(siteDir = SITE) {
  const file = path.join(siteDir, 'data.js');
  if (!fs.existsSync(file)) return [];
  const source = fs.readFileSync(file, 'utf8');
  return vm.runInNewContext(`${source}\n;typeof PHASES === 'undefined' ? [] : PHASES`, {}, { filename: file });
}

function lessonPathOf(lesson) {
  const match = LESSON_PATH.exec((lesson && lesson.url) || '');
  return match ? match[1] : '';
}

function lessonUrl(lessonPath) {
  return `/lesson?path=${encodeURIComponent(lessonPath)}`;
}

function stripFences(lines) {
  const kept = [];
  let fence = null;
  let math = false;
  for (const line of lines) {
    const open = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && !line.trim().slice(open[1].length).trim()) fence = null;
      continue;
    }
    if (open) {
      fence = open[1];
      continue;
    }
    if (/^\s*\$\$/.test(line)) {
      if (!(line.trim().length > 2 && line.trim().endsWith('$$'))) math = !math;
      continue;
    }
    if (math) continue;
    kept.push(line);
  }
  return kept;
}

function inlineText(line) {
  const codes = [];
  let text = line.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, ticks, value) => {
    const word = value.trim();
    codes.push(word.length <= INLINE_CODE_LIMIT ? word : '');
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<https?:\/\/[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g, ' ')
    .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](?=\S)([^*_]*?\S)[*_](?!\w)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~$])/g, '$1');
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

function markdownText(markdown) {
  const source = String(markdown || '').replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/<!--[\s\S]*?-->/g, ' ');
  const lines = stripFences(source.split(/\r?\n/));
  const out = [];
  for (const raw of lines) {
    if (/^\s*\[[^\]]+\]:\s*\S/.test(raw)) continue;
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(raw)) continue;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) continue;
    let line = raw.replace(/^\s{0,3}(?:>\s?)+/, '').replace(/^\s*#{1,6}\s+/, '').replace(/\s+#+\s*$/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '');
    if (line.includes('|')) line = line.replace(/^\s*\||\|\s*$/g, '').replace(/\s*\|\s*/g, ' · ');
    line = inlineText(line).replace(/\s+/g, ' ').trim();
    if (line) out.push(line);
  }
  return out.join('\n');
}

function capText(text, limit = LESSON_TEXT_LIMIT) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.search(/\s\S*$/);
  return (space > limit * 0.8 ? cut.slice(0, space) : cut).trimEnd();
}

function lessonRecord({ lessonPath, title, phase, markdown, limit = LESSON_TEXT_LIMIT }) {
  if (!/^phases\/[^/?#]+\/[^/?#]+$/.test(lessonPath || '')) throw new Error(`lesson record needs a phases/<phase>/<lesson> path: ${lessonPath}`);
  const heading = stripFences(String(markdown || '').split(/\r?\n/)).map(line => /^\s*#\s+(.+?)\s*#*\s*$/.exec(line)).find(Boolean);
  const name = (heading ? inlineText(heading[1]).replace(/\s+/g, ' ').trim() : '') || title;
  const content = capText(markdownText(markdown), limit);
  if (!name || !content) throw new Error(`lesson record ${lessonPath} needs a title and content`);
  return { url: lessonUrl(lessonPath), content, language: 'en', meta: { title: name }, filters: { type: ['Lesson'], phase: list(phase) } };
}

function lessonSearchRecords({ siteDir = SITE, repoRoot = path.join(SITE, '..'), phases = loadPhases(siteDir), limit } = {}) {
  const records = [];
  const seen = new Set();
  for (const phase of phases || []) {
    for (const lesson of (phase && phase.lessons) || []) {
      if (lesson.status && lesson.status !== 'complete') continue;
      const lessonPath = lessonPathOf(lesson);
      if (!lessonPath || seen.has(lessonPath)) continue;
      const file = path.join(repoRoot, lessonPath, 'docs', 'en.md');
      if (!fs.existsSync(file)) continue;
      seen.add(lessonPath);
      records.push(lessonRecord({ lessonPath, title: lesson.name, phase: phase.name, markdown: fs.readFileSync(file, 'utf8'), limit }));
    }
  }
  return records;
}

async function loadPagefind() {
  try {
    return await import('pagefind');
  } catch (error) {
    if (error && error.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
}

function raise(response, step) {
  if (response && response.errors && response.errors.length) throw new Error(`pagefind ${step}: ${response.errors.join('; ')}`);
  return response;
}

async function buildSearchIndex({ siteDir = SITE, records = [] } = {}) {
  const pagefind = await loadPagefind();
  if (!pagefind) return { skipped: true, pages: 0, records: 0 };
  const pages = collectPages(siteDir);
  const { index } = raise(await pagefind.createIndex({ forceLanguage: 'en' }), 'createIndex');
  try {
    for (const page of pages) raise(await index.addHTMLFile({ url: page.url, content: page.content }), `addHTMLFile ${page.url}`);
    for (const record of records) raise(await index.addCustomRecord(record), `addCustomRecord ${record.url}`);
    const outputPath = path.join(siteDir, OUTPUT);
    fs.rmSync(outputPath, { recursive: true, force: true });
    raise(await index.writeFiles({ outputPath }), 'writeFiles');
  } finally {
    await pagefind.close();
  }
  return { skipped: false, pages: pages.length, records: records.length };
}

async function main() {
  const interviews = require('./build-interviews').interviewSearchRecords();
  const lessons = lessonSearchRecords();
  const result = await buildSearchIndex({ records: interviews.concat(lessons) });
  if (result.skipped) {
    console.log('pagefind is not installed; skipped the search index. Run npm install to build it.');
    return;
  }
  console.log(`Wrote the search index for ${result.pages} pages and ${result.records} records (${interviews.length} interview, ${lessons.length} lesson) to site/${OUTPUT}/`);
}

module.exports = { collectPages, searchHtml, interviewRecord, lessonRecord, lessonSearchRecords, markdownText, buildSearchIndex, SOURCES };

if (require.main === module) {
  main().catch(error => {
    console.error(`build-search: ${error.message}`);
    process.exitCode = 1;
  });
}
