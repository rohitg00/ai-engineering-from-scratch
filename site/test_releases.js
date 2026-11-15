'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { collectReleases, toEntries, summaryOf, titleOf } = require('./fetch-releases.js');

const RELEASE = {
  tag_name: 'v2026.11.2',
  name: 'Edition 2026.11.2: Lessons in Five Languages',
  published_at: '2026-11-09T10:00:00Z',
  html_url: 'https://github.com/rohitg00/ai-engineering-from-scratch/releases/tag/v2026.11.2',
  body: 'Read each lesson in the **language** you use at work.\n\n[Start](https://example.com) · [Catalog](https://example.com)\n\n## Site\n\n- One',
};

test('release entries keep the subtitle, the date, and the first prose paragraph', () => {
  const [entry] = toEntries([RELEASE]);
  assert.deepEqual(entry, {
    tag: 'v2026.11.2',
    title: 'Lessons in Five Languages',
    date: '2026-11-09',
    summary: 'Read each lesson in the language you use at work.',
    url: RELEASE.html_url,
  });
  assert.equal(titleOf({ name: 'Edition 2026.10.3', tag_name: 'v2026.10.3' }), 'Edition 2026.10.3');
});

test('release entries skip drafts, prereleases, foreign links, and overflow', () => {
  const many = Array.from({ length: 9 }, (_, index) => Object.assign({}, RELEASE, { tag_name: `v${index}` }));
  assert.equal(toEntries(many).length, 6);
  assert.deepEqual(toEntries([Object.assign({}, RELEASE, { draft: true })]), []);
  assert.deepEqual(toEntries([Object.assign({}, RELEASE, { prerelease: true })]), []);
  assert.deepEqual(toEntries([Object.assign({}, RELEASE, { html_url: 'https://example.com/releases/tag/v1' })]), []);
  assert.deepEqual(toEntries([Object.assign({}, RELEASE, { published_at: null })]), []);
  const prereleases = Array.from({ length: 7 }, () => Object.assign({}, RELEASE, { prerelease: true }));
  assert.equal(toEntries(prereleases.concat(many)).length, 6);
  assert.deepEqual(toEntries({ message: 'rate limited' }), []);
});

test('release summaries clip long text at a word boundary and skip headings, tables, and link rows', () => {
  const long = summaryOf(`${'word '.repeat(80)}`);
  assert.ok(long.length <= 183);
  assert.match(long, /word\.\.\.$/);
  assert.equal(summaryOf('## Heading\n\n| a | b |\n\n- item\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf('[New lessons](lesson.md) are now available.\n\nMore.'), 'New lessons are now available.');
  assert.equal(summaryOf('[Start](https://a.example) · [Catalog](https://b.example)\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf('## Heading\nProse right under it.'), 'Prose right under it.');
  assert.equal(summaryOf('修复错误。\n\nMore.'), '修复错误。');
  assert.equal(summaryOf('[Start][docs] · [Catalog][index]\n\nNew lessons are available.'), 'New lessons are available.');
  assert.equal(summaryOf('[New lessons][docs] are available.'), 'New lessons are available.');
  assert.equal(summaryOf('## Changes\n> Preview only.\n\nNew lessons are available.'), 'New lessons are available.');
  assert.equal(summaryOf('## Run\n```bash\nnpm test\n\nnpm run build\n```\n\nRun the suite first.'), 'Run the suite first.');
  assert.equal(summaryOf('````md\n```js\nrun()\n```\n\nstill code\n````\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf('```\ncode\n``` not a close\n\nmore code\n```\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf('~~~\ncode\n\nmore\n~~~\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf('```\n```\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf('1. First step\n\nThe prose.'), 'The prose.');
  assert.equal(summaryOf(''), '');
});

test('release collection sends the token only when present and fails on a bad status', async () => {
  const calls = [];
  const ok = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => [RELEASE] };
  };
  assert.equal((await collectReleases({ fetchImpl: ok, token: '' })).length, 1);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await collectReleases({ fetchImpl: ok, token: 'abc' });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer abc');
  assert.match(calls[0].url, /^https:\/\/api\.github\.com\/repos\/rohitg00\/ai-engineering-from-scratch\/releases\?per_page=30$/);
  await assert.rejects(collectReleases({ fetchImpl: async () => ({ ok: false, status: 403 }), token: '' }), /HTTP 403/);
});

test('the release page renders the list that the build step fills', () => {
  const homepage = fs.readFileSync(path.join(__dirname, 'whats-new.html'), 'utf8');
  const app = homepage;
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.match(homepage, /<ol class="whats-new-list" id="whatsNewList"><\/ol>/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), /id="whats-new"/);
  assert.match(homepage, /href="https:\/\/www\.google\.com\/preferences\/source\?q=aiengineeringfromscratch\.com"/);
  assert.match(app, /fetch\('releases\.json'\)/);
  const prebuild = fs.readFileSync(path.join(__dirname, 'prebuild.js'), 'utf8');
  assert.match(config.buildCommand, /^node site\/prebuild\.js && /);
  assert.match(prebuild, /'fetch-translation-coverage\.js', 'fetch-releases\.js'/);
  assert.ok(config.buildCommand.length <= 256, 'Vercel rejects a build command over 256 characters');
});
