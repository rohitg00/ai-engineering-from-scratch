'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  const result = await buildSearchIndex();
  if (result.skipped) {
    console.log('pagefind is not installed; skipped the search index. Run npm install to build it.');
    return;
  }
  console.log(`Wrote the search index for ${result.pages} pages and ${result.records} records to site/${OUTPUT}/`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`build-search: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { collectPages, searchHtml, interviewRecord, buildSearchIndex, SOURCES };
