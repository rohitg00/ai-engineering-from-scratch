#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { extractMath } = require('../site/lesson-markdown');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const katexIndex = args.indexOf('--katex');
const katexPath = katexIndex >= 0 ? args.splice(katexIndex, 2)[1] : process.env.KATEX_PATH;
const phaseFilter = args[0] || '';

if (!katexPath) {
  console.error('usage: node scripts/check_lesson_math.js --katex <path to katex.min.js> [phase prefix]');
  console.error('Download the build pinned in site/lesson.html, for example katex@0.16.47/dist/katex.min.js.');
  process.exit(2);
}

const katex = require(path.resolve(katexPath));
const phasesDir = path.join(root, 'phases');
let count = 0;
const failures = [];

for (const phase of fs.readdirSync(phasesDir).sort()) {
  if (!phase.startsWith(phaseFilter)) continue;
  const phaseDir = path.join(phasesDir, phase);
  if (!fs.statSync(phaseDir).isDirectory()) continue;
  for (const lesson of fs.readdirSync(phaseDir).sort()) {
    const doc = path.join(phaseDir, lesson, 'docs', 'en.md');
    if (!fs.existsSync(doc)) continue;
    for (const item of extractMath(fs.readFileSync(doc, 'utf8'))) {
      count++;
      try {
        katex.renderToString(item.tex, { displayMode: item.display, throwOnError: true, strict: 'ignore' });
      } catch (error) {
        failures.push(`${path.relative(root, doc)}:${item.line}: ${error.message}`);
      }
    }
  }
}

for (const failure of failures) console.log(failure);
console.log(`${count} math spans checked, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
