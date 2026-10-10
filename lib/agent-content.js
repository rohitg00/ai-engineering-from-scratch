const fs = require('node:fs');
const path = require('node:path');
const { TRANSLATION_LANGUAGES, isTranslationLanguage, translationsOf, lessonUrl, translationSourceUrl, readTranslation: readTranslationFromSource } = require('./lesson-translations');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const PAGES = {
  '/': 'index.html', '/about': 'about.html', '/catalog': 'catalog.html',
  '/glossary': 'glossary.html', '/prereqs': 'prereqs.html', '/path': 'prereqs.html', '/roadmap': 'prereqs.html',
  '/developer': 'developer.html', '/developers': 'developer.html', '/docs': 'developer.html',
  '/api': 'developer.html', '/contact': 'contact.html', '/privacy': 'privacy.html',
  '/sponsors': 'sponsors.html', '/projects': 'projects.html',
  '/learning-paths': 'learning-paths.html', '/certifications': 'certifications.html',
};
for (const filename of Object.values(PAGES)) PAGES['/' + filename] = filename;

let resources;
function loadResources() {
  if (!resources) resources = JSON.parse(fs.readFileSync(path.join(__dirname, '../generated/agent-content.json'), 'utf8'));
  return resources;
}

class InputError extends Error {}
function validateSearch(args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new InputError('Search arguments must be an object.');
  if (Object.keys(args).some(key => !['q', 'kind', 'limit', 'offset'].includes(key))) throw new InputError('Supported search arguments are q, kind, limit, and offset.');
  const { q = '', kind = 'all', limit = 10, offset = 0 } = args;
  if (typeof q !== 'string' || q.length > 200) throw new InputError('q must be a string of at most 200 characters.');
  if (!['all', 'lesson', 'project'].includes(kind)) throw new InputError('kind must be all, lesson, or project.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new InputError('limit must be an integer from 1 to 50.');
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new InputError('offset must be an integer from 0 to 10000.');
  return { q, kind, limit, offset };
}

function metadata({ markdown, ...entry }) { return entry; }

function search(args, entries = loadResources()) {
  const { q, kind, limit, offset } = validateSearch(args);
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = entries.filter(entry => {
    if (kind !== 'all' && entry.kind !== kind) return false;
    const text = `${entry.title} ${entry.description} ${entry.path}`.toLowerCase();
    return words.every(word => text.includes(word));
  });
  const items = matches.slice(offset, offset + limit).map(metadata);
  return { items, total: matches.length, offset, limit, nextOffset: offset + items.length < matches.length ? offset + items.length : null };
}

function readResource(resourcePath, entries = loadResources()) {
  if (typeof resourcePath !== 'string' || !resourcePath || resourcePath.length > 240) throw new InputError('path must be a nonempty resource path of at most 240 characters, returned by search.');
  return entries.find(entry => entry.path === resourcePath) || null;
}

async function readTranslatedResource(resourcePath, lang = 'en', { read = readResource, readTranslation = readTranslationFromSource } = {}) {
  if (lang !== 'en' && !isTranslationLanguage(lang)) throw new InputError(`lang must be en or one of: ${TRANSLATION_LANGUAGES.join(', ')}.`);
  const entry = read(resourcePath);
  if (!entry || lang === 'en') return entry;
  if (!translationsOf(entry).includes(lang)) return null;
  const markdown = await readTranslation(lang, entry.path);
  if (typeof markdown !== 'string') throw new Error('translation-unavailable');
  return { ...entry, lang, url: lessonUrl(entry.path, lang), sourceUrl: translationSourceUrl(lang, entry.path), markdown };
}

module.exports = { ORIGIN, PAGES, InputError, validateSearch, search, readResource, readTranslatedResource };
