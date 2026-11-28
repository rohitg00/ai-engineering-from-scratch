#!/usr/bin/env node
/**
 * Parse-check every source file and sanity-check the content payload.
 * No browser required.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') || entry.name.endsWith('.mjs') ? [full] : [];
  });
}

let failures = 0;

for (const file of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'scripts'))]) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failures += 1;
    console.error(`syntax: ${path.relative(ROOT, file)}`);
    console.error(String(error.stderr ?? error.message).split('\n').slice(0, 4).join('\n'));
  }
}

const catalogPath = path.join(ROOT, 'public', 'content', 'catalog.json');
if (!fs.existsSync(catalogPath)) {
  console.error('content: public/content/catalog.json is missing. Run npm run content.');
  failures += 1;
} else {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const lessons = catalog.phases.reduce((n, phase) => n + phase.lessons.length, 0);
  if (lessons < 1) {
    console.error('content: no lessons parsed');
    failures += 1;
  }
  console.log(`content: ${lessons} lessons across ${catalog.phases.length} phases`);

  // Sample one lesson per four phases: enough to catch a shape regression
  // without reading 16 MB over a network share.
  const sample = catalog.phases
    .filter((_, index) => index % 4 === 0)
    .flatMap((phase) => phase.lessons.slice(0, 1));

  for (const entry of sample) {
    const file = path.join(ROOT, 'public', 'content', 'lessons', `${entry.id}.json`);
    if (!fs.existsSync(file)) {
      console.error(`content: missing lesson file for ${entry.id}`);
      failures += 1;
      continue;
    }
    const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
    const problems = [];
    const warnings = [];
    if (!lesson.reading?.length) problems.push('no reading steps');
    if (!lesson.objectives?.length) warnings.push('no objectives');
    for (const question of lesson.quiz ?? []) {
      if (!Array.isArray(question.options) || question.options.length < 2) problems.push('bad options');
      if (!Number.isInteger(question.correct) || question.correct >= question.options.length) {
        problems.push('bad correct index');
      }
    }
    if (problems.length) {
      console.error(`content: ${entry.id} -> ${problems.join(', ')}`);
      failures += 1;
    }
    if (warnings.length) {
      console.warn(`content: ${entry.id} -> ${warnings.join(', ')} (upstream doc)`);
    }
  }
  console.log(`content: sampled ${sample.length} lesson files`);
}

console.log(failures === 0 ? 'check: ok' : `check: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
