#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { TRANSLATION_SOURCE, TRANSLATION_LANGUAGES, lessonPathFromCacheKey } = require('../lib/lesson-translations');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(__dirname, 'translation-coverage.json');
const PHASE = /^\d{2}-[a-z0-9-]+$/;

function phaseNames(root = ROOT) {
  return fs.readdirSync(path.join(root, 'phases'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && PHASE.test(entry.name))
    .map(entry => entry.name)
    .sort();
}

async function phaseLessons(fetchImpl, lang, phase, timeoutMs) {
  const response = await fetchImpl(`${TRANSLATION_SOURCE}/${lang}/.cache/${phase}.json`, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`${lang}/${phase}: HTTP ${response.status}`);
  const cache = await response.json();
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) throw new Error(`${lang}/${phase}: cache is not an object`);
  return Object.keys(cache).map(lessonPathFromCacheKey).filter(lessonPath => lessonPath && lessonPath.startsWith(`phases/${phase}/`));
}

function withRetry(task) {
  return task().catch(() => task());
}

async function collectCoverage({
  languages = TRANSLATION_LANGUAGES,
  phases = phaseNames(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
} = {}) {
  const coverage = { languages: {}, unavailable: {} };
  for (const lang of languages) {
    const results = await Promise.allSettled(phases.map(phase => withRetry(() => phaseLessons(fetchImpl, lang, phase, timeoutMs))));
    const failed = results.filter(result => result.status === 'rejected').map(result => result.reason.message);
    const lessons = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value).sort();
    if (lessons.length) coverage.languages[lang] = lessons;
    if (failed.length) coverage.unavailable[lang] = failed.join('; ');
  }
  return coverage;
}

async function main() {
  let coverage;
  try {
    coverage = await collectCoverage();
  } catch (error) {
    coverage = { languages: {}, unavailable: { all: error.message } };
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(coverage, null, 2) + '\n', 'utf8');
  const counts = Object.entries(coverage.languages).map(([lang, lessons]) => `${lang} ${lessons.length}`).join(', ');
  console.log(`translation-coverage.json: ${counts || 'no translated lessons'}`);
  for (const [lang, reason] of Object.entries(coverage.unavailable)) {
    console.warn(`translation coverage incomplete for ${lang}: ${reason}; the affected lessons stay English-only in this build`);
  }
}

if (require.main === module) main();

module.exports = { collectCoverage, phaseNames, OUTPUT_PATH };
