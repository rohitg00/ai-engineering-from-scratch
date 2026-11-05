const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMd } = require('./lesson-markdown');

test('level-4 headings render as h4 with a slug id', () => {
  const html = parseMd('#### Shape Mismatch\n\nText.');
  assert.match(html, /<h4 id="shape-mismatch">Shape Mismatch<\/h4>/);
  assert.doesNotMatch(html, /####/);
});

test('level-4 headings are not confused with levels 1-3', () => {
  assert.match(parseMd('# One'), /<h1 id="one">One<\/h1>/);
  assert.match(parseMd('## Two'), /<h2 id="two"[^>]*>Two<\/h2>/);
  assert.match(parseMd('### Three'), /<h3 id="three">Three<\/h3>/);
  assert.match(parseMd('#### Four'), /<h4 id="four">Four<\/h4>/);
});

test('duplicate heading slugs are suffixed in document order across levels', () => {
  const html = parseMd('### Setup\n\n## Setup\n\n#### Setup\n\n### Setup\n');
  assert.match(html, /<h3 id="setup">Setup<\/h3>/);
  assert.match(html, /<h2 id="setup-2"[^>]*>Setup<\/h2>/);
  assert.match(html, /<h4 id="setup-3">Setup<\/h4>/);
  assert.match(html, /<h3 id="setup-4">Setup<\/h3>/);
});

test('a repeated heading keeps the bare slug only on its first occurrence', () => {
  const html = parseMd('#### Review\n\n#### Review\n\n#### Review\n');
  assert.match(html, /<h4 id="review">Review<\/h4>/);
  assert.match(html, /<h4 id="review-2">Review<\/h4>/);
  assert.match(html, /<h4 id="review-3">Review<\/h4>/);
});

test('level-4 headings honor inline formatting and code fences', () => {
  assert.match(parseMd('#### NaN **Loss**'), /<h4 id="nan-loss">NaN <strong>Loss<\/strong><\/h4>/);
  const fenced = parseMd('```\n#### Not a heading\n```');
  assert.doesNotMatch(fenced, /<h4/);
});

test('the 35 existing level-4 headings in English lessons parse as h4', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const phases = path.resolve(__dirname, '..', 'phases');
  let seen = 0;
  for (const phase of fs.readdirSync(phases).sort()) {
    const phaseDir = path.join(phases, phase);
    if (!fs.statSync(phaseDir).isDirectory()) continue;
    for (const lesson of fs.readdirSync(phaseDir).sort()) {
      const doc = path.join(phaseDir, lesson, 'docs', 'en.md');
      if (!fs.existsSync(doc)) continue;
      const md = fs.readFileSync(doc, 'utf8');
      let fence = false;
      for (const line of md.split('\n')) {
        if (/^\s*```/.test(line)) { fence = !fence; continue; }
        if (fence) continue;
        const h4 = line.match(/^#### (.+)/);
        if (!h4) continue;
        seen++;
        const html = parseMd(line);
        assert.match(html, /<h4 id="[^"]+">/, `should render as h4: ${line} (${doc})`);
      }
    }
  }
  assert.ok(seen > 0, 'expected at least one level-4 heading in the English lessons');
});
