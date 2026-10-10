'use strict';

const registry = require('../languages.json');
const { readBounded } = require('./read-bounded');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const REPOSITORY = 'rohitg00/ai-engineering-from-scratch';
const TRANSLATION_SOURCE = `https://raw.githubusercontent.com/${REPOSITORY}/translations/i18n`;
const COURSE_LESSON = /^phases\/\d{2}-[a-z0-9-]+\/[a-z0-9][a-z0-9-]*$/;
const CACHE_KEY = /^(phases\/\d{2}-[a-z0-9-]+\/[a-z0-9][a-z0-9-]*)\/docs\/en\.md$/;
const TRANSLATION_LANGUAGES = Object.freeze(registry.languages
  .filter(language => language.ci && !language.source)
  .map(language => language.code));
const NATIVE_NAMES = Object.freeze(Object.fromEntries(registry.languages.map(language => [language.code, language.native])));
const OG_LOCALES = Object.freeze(Object.fromEntries(registry.languages.filter(language => language.locale).map(language => [language.code, language.locale])));
const RTL_LANGUAGES = new Set(registry.languages.filter(language => language.dir === 'rtl').map(language => language.code));
const UNINDEXED_LANGUAGES = new Set(registry.languages.filter(language => language.index === false).map(language => language.code));
const TIMEOUT_MS = 2500;
const TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 64;

function isTranslationLanguage(lang) {
  return typeof lang === 'string' && TRANSLATION_LANGUAGES.includes(lang);
}

function isIndexedLanguage(lang) {
  return isTranslationLanguage(lang) && !UNINDEXED_LANGUAGES.has(lang);
}

function translationsOf(entry) {
  return entry && Array.isArray(entry.translations) ? entry.translations.filter(isTranslationLanguage) : [];
}

function lessonPathFromCacheKey(key) {
  const match = String(key).match(CACHE_KEY);
  return match ? match[1] : null;
}

function lessonUrl(lessonPath, lang) {
  return `${ORIGIN}/lesson?path=${encodeURIComponent(lessonPath)}${lang && lang !== 'en' ? `&lang=${encodeURIComponent(lang)}` : ''}`;
}

function translationUrl(lang, lessonPath) {
  if (!isTranslationLanguage(lang) || typeof lessonPath !== 'string' || !COURSE_LESSON.test(lessonPath)) {
    throw new Error('invalid-translation-request');
  }
  return `${TRANSLATION_SOURCE}/${lang}/${lessonPath}/docs/${lang}.md`;
}

function translationSourceUrl(lang, lessonPath) {
  translationUrl(lang, lessonPath);
  return `https://github.com/${REPOSITORY}/blob/translations/i18n/${lang}/${lessonPath}/docs/${lang}.md`;
}

function createTranslationReader({ fetchImpl = globalThis.fetch, maxBytes = 256 * 1024, now = Date.now } = {}) {
  const cache = new Map();

  async function load(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    if (!response.ok) {
      if (response.body) response.body.cancel().catch(() => {});
      throw new Error(`translation-status-${response.status}`);
    }
    const markdown = await readBounded(response, maxBytes, 'translation-too-large');
    if (!/^# \S/m.test(markdown)) throw new Error('translation-shape');
    return markdown;
  }

  return function readTranslation(lang, lessonPath) {
    const url = translationUrl(lang, lessonPath);
    const cached = cache.get(url);
    if (cached && cached.expires > now()) return cached.value;
    const previous = cached && cached.good;
    cache.delete(url);
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    const entry = { expires: now() + TTL_MS, good: previous, value: null };
    entry.value = load(url).then(markdown => {
      entry.good = markdown;
      return markdown;
    }, () => {
      entry.expires = now() + FAILURE_TTL_MS;
      return previous || null;
    });
    cache.set(url, entry);
    return entry.value;
  };
}

module.exports = {
  TRANSLATION_SOURCE,
  TRANSLATION_LANGUAGES,
  NATIVE_NAMES,
  RTL_LANGUAGES,
  OG_LOCALES,
  isTranslationLanguage,
  isIndexedLanguage,
  translationsOf,
  lessonPathFromCacheKey,
  lessonUrl,
  translationUrl,
  translationSourceUrl,
  createTranslationReader,
  readTranslation: createTranslationReader(),
};
