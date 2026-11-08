const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const interviews = require('./build-interviews');
const code = require('./lib/code');
const { writeHubSitemaps, hubLlms } = require('./build');

let built;

test.before(async () => {
  await code.init();
  built = interviews.buildInterviews();
});
const config = require('../vercel.json');
const ORIGIN = 'https://aiengineeringfromscratch.com';

function page(href) {
  return built.pages.find(item => item.href === href);
}

function itemHref(item) {
  return `/interviews/${item.card}/${item.id}`;
}

test('the index, each card with items and each item get a page', () => {
  assert.ok(page('/interviews'));
  assert.ok(built.questions.length >= 3 && built.scenarios.length >= 1);
  for (const item of built.items) assert.ok(page(itemHref(item)), `${item.card}/${item.id} has no page`);
  for (const card of built.cards) {
    const count = built.byCard.get(card.id).length;
    assert.equal(Boolean(page(`/interviews/${card.id}`)), count > 0, card.id);
  }
  assert.equal(built.pages.length, 1 + built.cards.filter(card => built.byCard.get(card.id).length).length + built.items.length);
});

test('the grid has a heading for each group, a tile for each card, a level filter, role chips and search', () => {
  const html = page('/interviews').html;
  for (const group of built.groups) assert.ok(html.includes(`<h2 id="g-${group.id}">`), group.id);
  for (const card of built.cards) assert.ok(html.includes(`data-card="${card.id}"`), card.id);
  for (const item of built.items) assert.ok(html.includes(`data-card-id="${item.card}" data-level="${item.data.level}"`), item.id);
  assert.match(html, /<input type="search" name="q"/);
  for (const level of [1, 2, 3, 4]) assert.ok(html.includes(`name="level" value="${level}"`));
  for (const role of built.roles) assert.ok(html.includes(`name="role" value="${role.id}"`), role.id);
  assert.match(html, /class="iv-mix"/);
  assert.match(html, /"@type":"ItemList"/);
});

test('answers are in the HTML, folded behind details, and nowhere else on the page', () => {
  assert.deepEqual(interviews.checkInterviews(built), []);
  for (const item of built.questions) {
    const html = page(itemHref(item)).html;
    assert.match(html, /<details class="iv-answer" data-answer="short"><summary>Show short answer<\/summary>/);
    assert.match(html, /<details class="iv-answer" data-answer="full"><summary>Show full answer<\/summary>/);
    const folded = Array.from(html.matchAll(/<details\b[\s\S]*?<\/details>/g), match => match[0]).join('\n');
    const firstWords = item.sections['Short answer'].replace(/`/g, '').split(/\s+/).slice(0, 5).join(' ');
    assert.ok(interviews.visibleText(folded.replace(/<\/?details[^>]*>/g, '')).replace(/\s+/g, ' ').includes(firstWords), `${item.id}: the short answer is not in a details element`);
    assert.equal(item.followUps.length, (html.match(/Show expected answer/g) || []).length);
  }
  for (const item of built.scenarios) {
    const html = page(itemHref(item)).html;
    for (const id of ['walkthrough', 'resolution', 'wrong', 'generalize']) assert.ok(html.includes(`data-answer="${id}"`), id);
  }
});

test('a scenario page holds every evidence listing in order, each a step for the reveal', () => {
  for (const item of built.scenarios) {
    const html = page(itemHref(item)).html;
    const text = html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let last = -1;
    item.evidenceOrder.forEach((entry, index) => {
      const at = html.indexOf(`data-step="${index + 1}"`);
      assert.ok(at > last, `${entry.name} order`);
      last = at;
      const evidence = item.evidence.find(file => file.name === entry.name);
      const first = evidence.listing.split('\n')[0].trim().slice(0, 40);
      assert.ok(text.includes(first), `${entry.name} listing is missing`);
    });
    assert.match(html, /data-ev-next/);
    assert.match(html, /<dl class="iv-spec">/);
  }
});

test('code blocks go through the shared code renderer', () => {
  const block = interviews.renderCode('a = 1', 'python', { label: 'main.py' });
  assert.equal(block, code.render('a = 1', 'python', { label: 'main.py' }));
  assert.match(block, /^<div class="cb" data-kind="code" data-lang="python">/);
  assert.match(block, /cb-copy/);
  assert.equal(/cb-copy/.test(interviews.renderCode('log line', 'text')), false);
  const html = page('/interviews/inference-serving/kv-pool-users-fit').html;
  assert.match(html, /<div class="cb" data-kind="output" data-lang="text">/);
  assert.match(html, /\/code\.css\?v=[0-9a-f]{16}/);
  assert.match(html, /\/code-copy\.js\?v=[0-9a-f]{16}/);
});

test('the search index gets every item with the prompt only, never an answer', () => {
  const records = interviews.searchRecords(built);
  assert.equal(records.length, built.items.length);
  for (const item of built.items) {
    const record = records.find(entry => entry.url === itemHref(item));
    assert.ok(record, item.id);
    assert.deepEqual(record.filters.type, ['Interview']);
    assert.deepEqual(record.filters.level, [String(item.data.level)]);
    assert.ok(record.filters.topic.length === 1 && record.filters.role.length === item.data.roles.length);
    const prompt = item.kind === 'scenario' ? item.sections.Situation : item.parsed.preamble;
    assert.ok(record.content.length > 40 && prompt.replace(/`/g, '').replace(/\s+/g, ' ').includes(record.content.slice(0, 30)), item.id);
    for (const other of built.items) assert.deepEqual(require('../scripts/interviews/validate').sharedSpans(interviews.answerText(other), record.content + record.meta.title), [], `${record.url} holds an answer of ${other.id}`);
  }
});

test('two builds give the same bytes', () => {
  const again = interviews.buildInterviews();
  assert.deepEqual(Array.from(again.files.keys()), Array.from(built.files.keys()));
  for (const [file, body] of built.files) assert.equal(again.files.get(file), body, file);
  for (const [file, body] of built.markdown) assert.equal(again.markdown.get(file), body, file);
  assert.equal(again.api, built.api);
});

test('no page links out of the site, except to the repository', () => {
  const allowed = /^https:\/\/(?:aiengineeringfromscratch\.com\/|github\.com\/rohitg00\/ai-engineering-from-scratch(?:\/|$)|fonts\.googleapis\.com\/|fonts\.gstatic\.com)/;
  for (const item of built.pages) {
    const outbound = Array.from(item.html.matchAll(/<a\b[^>]*href="(https?:[^"]+)"/g), match => match[1]).filter(url => !allowed.test(url));
    assert.deepEqual(outbound, [], item.href);
    assert.equal(/target="_blank"/.test(item.html.slice(item.html.indexOf('<main'), item.html.indexOf('</main>'))), false, `${item.href} opens a new tab`);
  }
  for (const [file, body] of built.markdown) assert.equal(/\]\(https?:\/\/(?!aiengineeringfromscratch\.com|github\.com\/rohitg00\/ai-engineering-from-scratch)/.test(body), false, file);
});

test('repository links become site links', () => {
  assert.equal(interviews.siteUrl('phases/17-infrastructure-and-production/06-sglang-radixattention'), '/lesson?path=phases%2F17-infrastructure-and-production%2F06-sglang-radixattention');
  assert.equal(interviews.siteUrl('manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md', 'goodput-finds-the-knee-that-throughput-hides'), '/manual-sglang-101/sglang-benchmark-serving#s-sglang-benchmark-serving-goodput-finds-the-knee-that-throughput-hides');
  assert.equal(interviews.siteUrl('manuals/vllm-101/sections/r-3-incident-index.md'), '/manual-vllm-101/ref-incident-index');
  assert.equal(interviews.siteUrl('interviews/scenarios/prefix-cache-inflated-benchmark/README.md'), '/interviews/scenarios/prefix-cache-inflated-benchmark');
  assert.equal(interviews.siteUrl('interviews/questions/inference-serving/kv-pool-users-fit.md'), '/interviews/inference-serving/kv-pool-users-fit');
  const html = page('/interviews/inference-serving/prefix-cache-order').html;
  assert.ok(html.includes('href="/manual-sglang-101/prefix-friendly-prompts"'));
  assert.ok(html.includes('href="/lesson?path=phases%2F17-infrastructure-and-production%2F06-sglang-radixattention"'));
});

test('every page is in the sitemap, and llms.txt lists every item', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-interviews-sitemap-'));
  try {
    const names = writeHubSitemaps({ phasePages: [], termPages: [], interviewPages: built.pages }, temp);
    assert.ok(names.includes('sitemap-interviews.xml'));
    const xml = fs.readFileSync(path.join(temp, 'sitemap-interviews.xml'), 'utf8');
    for (const item of built.pages) assert.ok(xml.includes(`<loc>${ORIGIN}${item.href}</loc>`), item.href);
    assert.equal((xml.match(/<loc>/g) || []).length, built.pages.length);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  const llms = hubLlms({ phaseModels: [], termPages: [], interviews: built });
  assert.match(llms, /## Interview questions and scenarios/);
  for (const item of built.items) assert.ok(llms.includes(`${ORIGIN}${itemHref(item)}`), item.id);
});

test('the API file lists cards and items without the answers', () => {
  const api = JSON.parse(built.api);
  assert.equal(api.cards.length, built.cards.length);
  assert.equal(api.items.length, built.items.length);
  for (const item of api.items) {
    assert.deepEqual(Object.keys(item).sort(), ['card', 'id', 'kind', 'lessons', 'level', 'manuals', 'markdown', 'minutes', 'roles', 'rounds', 'tags', 'title', 'type', 'url']);
  }
  const rewrite = config.rewrites.find(rule => rule.source === '/api/interviews.json');
  assert.equal(rewrite.destination, '/interviews.json');
  assert.ok(config.rewrites.indexOf(rewrite) < config.rewrites.findIndex(rule => rule.source === '/api/:missing*'));
});

test('answer engines get Markdown pages with the full answers', () => {
  assert.ok(built.markdown.get('index.md').startsWith('# Interview questions and scenarios'));
  for (const item of built.items) {
    const md = built.markdown.get(`${item.card}/${item.id}.md`);
    assert.ok(md.startsWith(`# ${item.data.title}\n\nCanonical page: ${ORIGIN}${itemHref(item)}`), item.id);
    assert.ok(md.includes(item.kind === 'scenario' ? '## Resolution' : '## Short answer'));
  }
  for (const [source, destination] of [['/interviews/:card([a-z0-9-]+)/:page([a-z0-9-]+)', '/agent-pages/interviews/:card/:page.md'], ['/interviews/:card([a-z0-9-]+)', '/agent-pages/interviews/:card.md']]) {
    const markdownRule = config.rewrites.find(rule => rule.source === source && rule.has);
    const htmlRule = config.rewrites.findIndex(rule => rule.source === source && !rule.has);
    assert.equal(markdownRule.destination, destination);
    assert.ok(config.rewrites.indexOf(markdownRule) < htmlRule, source);
  }
});

test('clean URLs route to the pages and the old .html URLs redirect', () => {
  const rewrites = config.rewrites.map(rule => `${rule.source} ${rule.destination}`);
  assert.ok(rewrites.includes('/interviews /interviews/index.html'));
  assert.ok(rewrites.includes('/interviews/:card([a-z0-9-]+)/:page([a-z0-9-]+) /interviews/:card/:page.html'));
  assert.ok(rewrites.includes('/interviews/:card([a-z0-9-]+) /interviews/:card.html'));
  assert.ok(config.redirects.some(rule => rule.source === '/interviews/index.html' && rule.destination === '/interviews'));
  assert.ok(config.headers.some(rule => rule.source === '/agent-pages/interviews/:path*' && rule.headers.some(header => header.value === 'text/markdown; charset=utf-8')));
});

test('the menu, the footers, the hub pages and the roadmap link to the interviews', () => {
  assert.match(fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8'), /ensureNavigationLink\(nav, '\/interviews', 'Interviews', ''\)/);
  assert.match(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), /<a href="\/interviews">Interviews<\/a>/);
  assert.match(fs.readFileSync(path.join(__dirname, 'build-hubs.js'), 'utf8'), /\['\/interviews', 'Interviews'\]/);
  const roadmap = fs.readFileSync(path.join(__dirname, 'roadmap.html'), 'utf8');
  const main = roadmap.slice(roadmap.indexOf('<main'), roadmap.indexOf('</main>'));
  for (const href of ['/practice', '/cheatsheets', '/interviews']) assert.ok(main.includes(`href="${href}"`), href);
  assert.ok(page('/interviews').html.includes('<a href="/interviews">Interviews</a>'));
});

test('structured data describes each item', () => {
  for (const item of built.items) {
    const ld = JSON.parse(page(itemHref(item)).html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'Quiz');
    assert.equal(ld.url, `${ORIGIN}${itemHref(item)}`);
    assert.equal(ld.hasPart[0]['@type'], 'Question');
    assert.ok(ld.hasPart[0].acceptedAnswer.text.length > 40);
  }
});

test('the deploy step stamps the social card on every interview page', () => {
  const { versionSite } = require('./version-assets');
  const { pageCard } = require('../lib/og-cards');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-interviews-cards-'));
  try {
    fs.writeFileSync(path.join(temp, 'og-cards.json'), JSON.stringify({ version: 1, cards: { 'page/interviews': pageCard('interviews', {}) } }));
    const file = path.join(temp, 'interviews', 'inference-serving', 'prefix-cache-order.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, built.files.get('inference-serving/prefix-cache-order.html'));
    versionSite(temp);
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /og\/page\/interviews\.png\?v=[0-9a-f]+/);
    assert.match(html, /<meta property="og:image:width" content="1200">/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('a card tile shows only when one of its items passes every filter', () => {
  const { cardVisible } = require('./interviews.js');
  const card = { search: 'inference and serving prefix caching', roles: 'inference-engineer' };
  const empty = { search: 'rag chunking retrieval', roles: 'applied-ai-engineer' };
  assert.equal(cardVisible(card, { q: 'prefix', level: '3', role: '' }, 0, 3), false);
  assert.equal(cardVisible(card, { q: 'prefix', level: '', role: '' }, 1, 3), true);
  assert.equal(cardVisible(card, { q: 'schedulers', level: '', role: '' }, 0, 3), false);
  assert.equal(cardVisible(empty, { q: '', level: '', role: '' }, 0, 0), true);
  assert.equal(cardVisible(empty, { q: 'chunking', level: '', role: '' }, 0, 0), true);
  assert.equal(cardVisible(empty, { q: '', level: '2', role: '' }, 0, 0), false);
  assert.equal(cardVisible(card, { q: '', level: '', role: 'applied-ai-engineer' }, 1, 3), true);
  assert.equal(cardVisible(empty, { q: '', level: '', role: 'applied-ai-engineer' }, 0, 0), true);
  assert.equal(cardVisible(empty, { q: '', level: '', role: 'inference-engineer' }, 0, 0), false);
});

test('the API URL sends the same CORS header as the file it rewrites to', () => {
  for (const source of ['/interviews.json', '/api/interviews.json']) {
    const rule = config.headers.find(entry => entry.source === source);
    assert.ok(rule && rule.headers.some(header => header.key === 'Access-Control-Allow-Origin' && header.value === '*'), source);
  }
});

test('the header marks Interviews as the current page on every interview route', () => {
  assert.match(fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8'), /\/\^\\\/interviews\(\?:\\\/\|\$\)\/\.test\(location\.pathname\)/);
});
