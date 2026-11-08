#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { TRANSLATION_LANGUAGES, lessonPathFromCacheKey } = require('../lib/lesson-translations');

function compareCoverage(recorded, published) {
  const problems = [];
  for (const lang of TRANSLATION_LANGUAGES) {
    const cached = recorded[lang] || new Set();
    const docs = published[lang] || new Set();
    for (const lessonPath of cached) if (!docs.has(lessonPath)) problems.push(`${lang}: ${lessonPath} is recorded as translated but its docs/${lang}.md is missing`);
    for (const lessonPath of docs) if (!cached.has(lessonPath)) problems.push(`${lang}: ${lessonPath} has docs/${lang}.md but no translation record, so it may be an English placeholder`);
  }
  return problems;
}

function compareBuildCoverage(recorded, coverage) {
  const problems = [];
  const languages = (coverage && coverage.languages) || {};
  for (const lang of TRANSLATION_LANGUAGES) {
    const expected = recorded[lang] || new Set();
    const built = new Set(languages[lang] || []);
    if (expected.size !== built.size || [...expected].some(lessonPath => !built.has(lessonPath))) {
      problems.push(`${lang}: build coverage lists ${built.size} lessons, the translations branch records ${expected.size}`);
    }
  }
  return problems;
}

function readBranch(ref, git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) {
  const files = git('ls-tree', '-r', '--name-only', ref, 'i18n/').split('\n').filter(Boolean);
  const recorded = {};
  const published = {};
  for (const lang of TRANSLATION_LANGUAGES) {
    const prefix = `i18n/${lang}/`;
    recorded[lang] = new Set();
    published[lang] = new Set();
    for (const file of files) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      if (/^\.cache\/[^/]+\.json$/.test(rest)) {
        for (const key of Object.keys(JSON.parse(git('show', `${ref}:${file}`)))) {
          const lessonPath = lessonPathFromCacheKey(key);
          if (lessonPath) recorded[lang].add(lessonPath);
        }
      } else if (rest.endsWith(`/docs/${lang}.md`)) {
        published[lang].add(rest.slice(0, -`/docs/${lang}.md`.length));
      }
    }
  }
  return { recorded, published };
}

function main(argv) {
  const refIndex = argv.indexOf('--ref');
  const coverageIndex = argv.indexOf('--coverage');
  const ref = refIndex >= 0 ? argv[refIndex + 1] : 'origin/translations';
  const { recorded, published } = readBranch(ref);
  const problems = compareCoverage(recorded, published);
  if (coverageIndex >= 0) {
    const coverage = JSON.parse(fs.readFileSync(path.resolve(argv[coverageIndex + 1]), 'utf8'));
    problems.push(...compareBuildCoverage(recorded, coverage));
  }
  for (const lang of TRANSLATION_LANGUAGES) console.log(`${lang}: ${recorded[lang].size} recorded, ${published[lang].size} published`);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('translation coverage matches the published files');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { compareCoverage, compareBuildCoverage, readBranch };
