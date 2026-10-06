'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const manuals = require('./build-manuals.js');
const audit = require('../scripts/audit_manuals.js');
const figkit = require('../manuals/_shared/figkit.js');

const roots = [];
test.after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

function tempDir(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

const C = name => figkit.color(name);
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" role="img" aria-labelledby="fig-1-1-title fig-1-1-desc" font-family="JetBrains Mono, ui-monospace, monospace">
  <title id="fig-1-1-title">One request becomes a task</title>
  <desc id="fig-1-1-desc">A client box on the left sends a request arrow to a task box on the right.</desc>
  <rect x="20" y="30" width="160" height="56" fill="${C('blue-fill')}" stroke="${C('blue-ink')}"/>
  <text x="100" y="63" font-size="12" text-anchor="middle">client</text>
  <rect x="460" y="30" width="160" height="56" fill="${C('amber-fill')}" stroke="${C('amber-ink')}"/>
  <text x="540" y="63" font-size="12" text-anchor="middle">task t-1</text>
  <line x1="180" y1="58" x2="460" y2="58" stroke="${C('ink')}"/>
</svg>
`;

const SECTION = `# What demo is for

> A demo exists so that tests have something small to render.

Your test needs a manual. When you finish this section, you can render one and check it.

## The rule

\`\`\`rule
label: core rule
source: spec §1
---
"The server MUST reply with a task."
\`\`\`

**Task:** a unit of work with an id {{spec §1}}. See [the figures](#s-ref-figures) and [figure](#fig-1-1).

\`\`\`figure
id: fig-1-1
kind: flow
title: one request
claim: A request becomes a task.
caption: Read left to right. From capture/out/task.json.
\`\`\`

\`\`\`listing
title: the task
source: capture/out/task.json
lang: json
note: The whole record.
---
{
  "kind": "task",
  …
}
\`\`\`

| Field | Meaning |
|---|---|
| \`id\` | the task \\| id |

\`\`\`takeaways
- Render the manual.
- Check the output.
\`\`\`

Sources: spec §1; capture/out/task.json
`;

function manifest(overrides = {}) {
  return JSON.stringify({
    id: 'demo-101',
    title: 'Demo 101',
    subtitle: 'A fixture manual',
    summary: 'Fixture.',
    audience: 'Test readers.',
    edition: '2026.10',
    status: 'draft',
    pin: { subject: 'Demo protocol', version: '1.0.0', source: 'https://example.com', commit: 'abc1234', date: '2026-05-28', verified: '2026-10-06' },
    outcomes: ['Do one thing.', 'Do another thing.', 'Do a third thing.'],
    palette: [{ hue: 'blue', meaning: 'messages' }, { hue: 'amber', meaning: 'tasks' }, { hue: 'rose', meaning: 'failure' }],
    sources: [{ name: 'Spec', path: 'spec.md', usedFor: 'rules' }],
    quoteSources: { spec: 'research/sources/spec.md' },
    front: 'front.md',
    parts: [{ number: 1, title: 'The Model', thesis: 'One idea.', accent: 'blue', sections: [{ id: '1.1', file: 'sections/1-1-intro.md' }] }],
    reference: { title: 'Reference', sections: [{ id: 'R.1', file: 'sections/r-1-figures.md' }] },
    ...overrides,
  }, null, 2);
}

function fixture(overrides = {}) {
  const root = tempDir('manuals-');
  const dir = path.join(root, 'demo-101');
  const files = {
    'manual.json': manifest(),
    'research/sources/spec.md': 'The server **MUST** reply with a task.\n',
    'capture/out/task.json': '{\n  "kind": "task",\n  "id": "t-1"\n}\n',
    'front.md': '# How to read this manual\n\n> This manual maps one protocol at one version.\n\nThe parts run from the purpose of the protocol to each request.\n\n```parts\n```\n\n```palette\n```\n\nSources: manual.json\n',
    'sections/1-1-intro.md': SECTION,
    'sections/r-1-figures.md': '# Index of figures\n\n> Every figure, by the claim it makes.\n\n```figure-index\n```\n\nSources: every section.\n',
    'figures/fig-1-1.svg': SVG,
    ...overrides,
  };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return { root, dir };
}

function issuesFor(dir) {
  const manual = manuals.loadManual(dir);
  const issues = [];
  audit.auditManual(manual, (where, rule, message) => issues.push({ where, rule, message }));
  return issues;
}

function rules(dir) { return new Set(issuesFor(dir).map(issue => issue.rule)); }

test('parses the markdown subset into typed blocks with line numbers', () => {
  const doc = manuals.parseDocument(SECTION, 'fixture');
  assert.equal(doc.title, 'What demo is for');
  assert.equal(doc.thesis, 'A demo exists so that tests have something small to render.');
  assert.deepEqual(doc.blocks.map(block => block.type), ['paragraph', 'heading', 'rule', 'paragraph', 'figure', 'listing', 'table', 'takeaways', 'paragraph']);
  assert.deepEqual(doc.blocks.find(block => block.type === 'table').rows[0], ['`id`', 'the task | id']);
  assert.equal(doc.blocks[1].line, 7);
});

test('rejects constructs outside the subset', () => {
  assert.throws(() => manuals.parseDocument('no title', 'x'), /first line must be/);
  assert.throws(() => manuals.parseDocument('# T\n\n```\ncode\n```\n', 'x'), /language tag/);
  assert.throws(() => manuals.parseDocument('# T\n\n- a\n  - b\n', 'x'), /nested lists/);
  assert.throws(() => manuals.parseDocument('# T\n\n<div>x</div>\n', 'x'), /raw HTML/);
  assert.throws(() => manuals.parseDocument('# T\n\n---\n', 'x'), /horizontal rules/);
  assert.throws(() => manuals.parseDocument('# T\n\n```figure\nid: f-1\nkind: chart\ntitle: t\nclaim: c.\ncaption: c\n```\n', 'x'), /kind must be one of/);
});

test('inline markup escapes HTML and records cross references with their location', () => {
  const acc = manuals.newInline();
  const html = manuals.inlineHtml('**a** <b> `x < y` {{spec §2}} [s](#s-1-1)', 'doc.md:4', acc);
  assert.match(html, /<strong>a<\/strong> &lt;b&gt; <code>x &lt; y<\/code> <span class="m-cite">spec §2<\/span> <a class="m-xref" href="#s-1-1">s<\/a>/);
  assert.deepEqual(acc.refs, [{ id: 's-1-1', where: 'doc.md:4' }]);
});

test('numbers figures per part and renders the print edition', () => {
  const { dir } = fixture();
  const manual = manuals.loadManual(dir);
  assert.equal(manual.figures.get('fig-1-1').number, '1.1');
  const html = manuals.printPage(manual);
  assert.match(html, /Fig\. 1\.1/);
  assert.match(html, /href="#fig-1-1">1\.1<\/a>/);
  assert.match(html, /string-set: mtitle content\(text\)/);
  assert.match(html, /<span class="m-tok-key">&quot;kind&quot;<\/span>/);
});

test('fails the build on dangling cross references anywhere, including the plate caption', () => {
  assert.throws(() => manuals.loadManual(fixture({ 'sections/1-1-intro.md': SECTION.replace('(#fig-1-1)', '(#fig-9-9)') }).dir), /intro\.md:\d+: link to unknown anchor #fig-9-9/);
  const plated = fixture({ 'manual.json': manifest({ plate: { figure: 'fig-1-1', title: 'plate', caption: 'See [nothing](#s-9-9).' } }) });
  assert.throws(() => manuals.loadManual(plated.dir), /plate caption: link to unknown anchor #s-9-9/);
});

test('the build rejects unsafe or malformed figures', () => {
  const variants = [
    [SVG.replace('<line ', '<line id="arrow" '), /must start with "fig-1-1-"/],
    [SVG.replace('<line ', '<line onload="alert(1)" '), /attribute onload/],
    [SVG.replace('</svg>', '<script>alert(1)</script>\n</svg>'), /<script> is not allowed/],
    [SVG.replace(' id="fig-1-1-title"', ''), /<title id="fig-1-1-title">/],
    [SVG.replace('viewBox="0 0 640 120"', 'viewBox="0 0 600 120"'), /viewBox must be/],
  ];
  for (const [svg, message] of variants) assert.throws(() => manuals.loadManual(fixture({ 'figures/fig-1-1.svg': svg }).dir), message);
});

test('paths and quote keys fail closed', () => {
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ quoteSources: { spec: 'research/sources/missing.md' } }) }).dir), /quoteSources\.spec: missing/);
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ quoteSources: {} }) }).dir), /rule source key "spec" is not declared/);
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ plate: { figure: '../outside', title: 't', caption: 'c.' } }) }).dir), /plate\.figure "\.\.\/outside" must match/);
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ edition: 'Fall 2026' }) }).dir), /edition "Fall 2026" must match/);
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ surprise: true }) }).dir), /unknown key "surprise"/);
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ status: 'final' }) }).dir), /status must be one of draft, ready/);
  assert.throws(() => manuals.loadManual(fixture({ 'manual.json': manifest({ quoteSources: { Spec: null } }) }).dir), /quoteSources key "Spec" must match/);
  const inline = SECTION.replace('**Task:** a unit of work with an id {{spec §1}}.', '**Task:** as the guide says, "the server answers every message quickly" {{guide §2}}.');
  assert.ok(rules(fixture({ 'sections/1-1-intro.md': inline }).dir).has('quote-key'));
  const declared = fixture({ 'sections/1-1-intro.md': inline, 'manual.json': manifest({ quoteSources: { spec: 'research/sources/spec.md', guide: null } }) });
  assert.ok(!rules(declared.dir).has('quote-key'));
});

test('a clean fixture passes the editorial audit', () => {
  assert.deepEqual(issuesFor(fixture().dir), []);
});

test('audit flags prose, provenance, and quote violations', () => {
  const broken = SECTION
    .replace('Your test needs a manual.', 'Your test needs a manual; it can’t wait — really.')
    .replace('"The server MUST reply with a task."', '"The server SHOULD reply with a task."')
    .replace('  "kind": "task",', '  "kind": "message",');
  const found = rules(fixture({ 'sections/1-1-intro.md': broken }).dir);
  for (const rule of ['semicolon', 'contraction', 'dash', 'quote', 'provenance']) assert.ok(found.has(rule), `expected ${rule}`);
});

test('every reader-visible string goes through the prose lint', () => {
  const noted = SECTION.replace('note: The whole record.', 'note: The whole record; nothing is cut.');
  const issues = issuesFor(fixture({ 'sections/1-1-intro.md': noted, 'manual.json': manifest({ palette: [{ hue: 'blue', meaning: 'messages; replies' }, { hue: 'amber', meaning: 'tasks' }, { hue: 'rose', meaning: 'failure' }] }) }).dir);
  assert.ok(issues.some(issue => issue.rule === 'semicolon' && /intro\.md:\d+/.test(issue.where)));
  assert.ok(issues.some(issue => issue.rule === 'semicolon' && /palette blue/.test(issue.where)));
});

test('sentences that open with code, a quote, or a section sign count on their own', () => {
  const opener = 'Your test needs a manual and a small task that the renderer can draw for it.';
  const text = `${opener} \`GetTask\` reads the stored task back and returns its state and history to you. "Every reply carries a task" is how the guide puts it in its overview. §3.1.3 names the moments when a client calls it after a stream ends.`;
  const found = rules(fixture({ 'sections/1-1-intro.md': SECTION.replace('Your test needs a manual.', text) }).dir);
  assert.ok(!found.has('long-sentence'));
});

test('audit enforces section shape', () => {
  const shapeless = SECTION.replace('When you finish this section, you can render one and check it.', 'It renders.').replace(/```takeaways[\s\S]*?```\n/, '').replace(/\nSources:.*\n$/, '\n');
  const found = rules(fixture({ 'sections/1-1-intro.md': shapeless }).dir);
  for (const rule of ['outcome', 'takeaways', 'sources']) assert.ok(found.has(rule), `expected ${rule}`);
});

test('figure lint catches small, overlapping, spilling, crossed, and off-palette text', () => {
  const bad = SVG
    .replace('font-size="12" text-anchor="middle">client', 'font-size="9" text-anchor="middle">client')
    .replace('>task t-1<', '>a task label far too long for this box<')
    .replace(C('amber-fill'), '#ff0000')
    .replace('</svg>', `<text x="100" y="63" font-size="12" text-anchor="middle">overlap</text>\n<line x1="100" y1="40" x2="100" y2="80" stroke="${C('ink')}"/>\n</svg>`);
  const found = rules(fixture({ 'figures/fig-1-1.svg': bad }).dir);
  for (const rule of ['figure-font', 'figure-spill', 'figure-color', 'figure-overlap', 'figure-crossing']) assert.ok(found.has(rule), `expected ${rule}`);
});

test('figure lint rejects hatch under text and ellipsis labels, and knockouts never act as containers', () => {
  const hatched = SVG.replace('<rect x="20"', '<rect x="10" y="20" width="200" height="80" fill="url(#fig-1-1-hatch)"/>\n  <rect x="20"').replace('>task t-1<', '>task…<');
  const found = rules(fixture({ 'figures/fig-1-1.svg': hatched }).dir);
  assert.ok(found.has('figure-hatch'));
  assert.ok(found.has('figure-ellipsis'));
  const knocked = SVG.replace('  <text x="540" y="63" font-size="12" text-anchor="middle">task t-1</text>', `  <rect class="m-knock" x="380" y="51" width="320" height="16" fill="${C('panel')}"/>\n  <text x="540" y="63" font-size="12" text-anchor="middle">a long task label that spills</text>`);
  assert.ok(rules(fixture({ 'figures/fig-1-1.svg': knocked }).dir).has('figure-spill'));
});

test('protocol data must come through a listing with a source', () => {
  assert.ok(rules(fixture({ 'sections/1-1-intro.md': SECTION.replace('| Field | Meaning |', '```json\n{"a": 1}\n```\n\n| Field | Meaning |') }).dir).has('listing-fence'));
});

test('web output is flat, lists only ready manuals, and a scoped build leaves other pages alone', () => {
  const { root, dir } = fixture();
  const site = tempDir('manuals-site-');
  fs.writeFileSync(path.join(site, 'manual-other-101.html'), 'keep');
  assert.equal(manuals.writeWeb(manuals.loadAll({ root, only: 'demo-101' }), site, { only: 'demo-101' }), null);
  assert.ok(fs.existsSync(path.join(site, 'manual-other-101.html')));
  assert.ok(!fs.existsSync(path.join(site, 'manuals-data.js')));
  assert.equal(manuals.writeWeb(manuals.loadAll({ root }), site), 0);
  assert.ok(!fs.existsSync(path.join(site, 'manual-other-101.html')));
  const page = fs.readFileSync(path.join(site, 'manual-demo-101.html'), 'utf8');
  assert.match(page, /noindex/);
  assert.match(page, /<script src="header\.js" defer>/);
  assert.doesNotMatch(page, /Download the PDF/);
  fs.writeFileSync(path.join(dir, 'manual.json'), manifest({ status: 'ready' }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# Demo\n');
  assert.equal(manuals.writeWeb(manuals.loadAll({ root }), site), 1);
  assert.match(fs.readFileSync(path.join(site, 'manuals-data.js'), 'utf8'), /"url": "manual-demo-101\.html"/);
});

test('scoped loading ignores a broken sibling manual', () => {
  const { root } = fixture();
  fs.mkdirSync(path.join(root, 'broken-101'));
  fs.writeFileSync(path.join(root, 'broken-101', 'manual.json'), '{ not json');
  assert.throws(() => manuals.loadAll({ root }), /broken-101\/manual\.json/);
  assert.equal(manuals.loadAll({ root, only: 'demo-101' }).length, 1);
});

test('the schema, the hues, and the figure kinds stay in step', () => {
  assert.deepEqual(manuals.SCHEMA.$defs.hue.enum.slice().sort(), figkit.HUES.slice().sort());
  const templates = path.join(__dirname, '..', 'manuals', '_shared', 'templates');
  assert.deepEqual(fs.readdirSync(templates).filter(name => name.endsWith('.js')).map(name => name.slice(0, -3)).sort(), manuals.KINDS.slice().sort());
});

test('every shared template renders through figkit and passes the figure lint', () => {
  const templates = path.join(__dirname, '..', 'manuals', '_shared', 'templates');
  const out = tempDir('manual-templates-');
  for (const kind of manuals.KINDS) {
    const id = `tpl-${kind}`;
    const file = path.join(out, `${id}.svg`);
    fs.writeFileSync(file, require(path.join(templates, `${kind}.js`)));
    const issues = [];
    audit.lintFigure(file, id, (where, rule, message) => issues.push(`${rule}: ${message}`));
    assert.deepEqual(issues, [], kind);
  }
});

test('figkit build writes figures and check reports drift', () => {
  const { dir } = fixture({ 'figures/fig-1-1.svg': null });
  fs.mkdirSync(path.join(dir, 'figures', 'src'), { recursive: true });
  const source = `const { figure } = require(${JSON.stringify(path.join(__dirname, '..', 'manuals', '_shared', 'figkit.js'))});\nmodule.exports = figure('fig-1-1', { height: 80, title: 'One box', desc: 'A single grey box with one label, used to test the figure kit build.' }, f => { f.box({ x: 20, y: 20, w: 200, h: 40, hue: 'grey', title: 'client' }); });\n`;
  fs.writeFileSync(path.join(dir, 'figures', 'src', 'fig-1-1.js'), source);
  assert.deepEqual(figkit.build(dir, true), ['fig-1-1']);
  figkit.build(dir);
  assert.deepEqual(figkit.build(dir, true), []);
  assert.deepEqual(issuesFor(dir), []);
  assert.throws(() => figkit.figure('fig-x', { height: 60, title: 't', desc: 'a description that is long enough to pass the check' }, f => f.box({ x: 0, y: 0, w: 40, h: 30, title: 'a label far too long' })), /wide, max/);
});

test('the audit flags figurative words, long steps, and long paragraphs, and quotes stay exempt', () => {
  const prose = SECTION
    .replace('Your test needs a manual.', 'Your test needs a manual on the wire.')
    .replace('- Render the manual.', '- Render the manual, then open the new page and read each part of it slowly before you check the whole output twice.')
    .replace('**Task:** a unit of work', 'One. Two. Three. Four. Five. Six. Seven.\n\n**Task:** a unit of work');
  const found = rules(fixture({ 'sections/1-1-intro.md': prose }).dir);
  for (const rule of ['lexicon', 'long-step', 'long-paragraph']) assert.ok(found.has(rule), rule);
  const quoted = SECTION.replace('Your test needs a manual.', 'The spec says "on the wire" here.');
  assert.ok(!rules(fixture({ 'sections/1-1-intro.md': quoted }).dir).has('lexicon'));
  assert.deepEqual(audit.lexiconHits('The planner sends a request.'), []);
  assert.equal(audit.lexiconHits('A capability flag gates the call.').length, 1);
});

test('figure beats render as SMIL groups that the lint accepts, and the print edition strips them', () => {
  const svg = figkit.figure('fig-1-1', { height: 80, title: 'Two beats', desc: 'A box and an arrow that appear in two steps, used to test the animation layer.' }, f => {
    f.box({ x: 20, y: 20, w: 120, h: 40, hue: 'grey', title: 'client' });
    f.beat(1);
    f.arrow([140, 40], [300, 40], { label: 'SendMessage' });
    f.beat(2);
    f.box({ x: 310, y: 20, w: 120, h: 40, hue: 'amber', title: 'task' });
  });
  assert.match(svg, /<g data-beat="1"><animate attributeName="opacity"/);
  assert.match(svg, /<circle class="m-packet"[^>]*><animateMotion path="M140 40 L300 40"/);
  const { dir } = fixture({ 'figures/fig-1-1.svg': svg });
  assert.deepEqual(issuesFor(dir), []);
  const page = manuals.printPage(manuals.loadManual(dir));
  assert.doesNotMatch(page, /<animate|m-packet/);
  assert.match(page, /data-beat="2"/);
  assert.ok(rules(fixture({ 'figures/fig-1-1.svg': svg.replace('keyTimes="0;0;1"', 'keyTimes="0;1"') }).dir).has('figure-smil'));
  assert.ok(rules(fixture({ 'figures/fig-1-1.svg': svg.replace('>task<', '>over the wire<') }).dir).has('figure-lexicon'));
  assert.throws(() => figkit.figure('fig-x', { height: 60, title: 't', desc: 'a description that is long enough to pass the check' }, f => f.beat(-1)), /beat must be/);
});

test('the manuals index lists ready manuals, and lists drafts only on request', () => {
  const { root } = fixture();
  const site = tempDir('manuals-index-');
  assert.equal(manuals.writeWeb(manuals.loadAll({ root }), site), 0);
  let index = fs.readFileSync(path.join(site, 'manuals.html'), 'utf8');
  assert.match(index, /No manual is published yet/);
  assert.match(index, /noindex/);
  assert.equal(manuals.writeWeb(manuals.loadAll({ root }), site, { drafts: true }), 1);
  index = fs.readFileSync(path.join(site, 'manuals.html'), 'utf8');
  assert.match(index, /href="manual-demo-101\.html"/);
  assert.match(index, /Draft edition/);
  assert.match(index, /<a href="manuals\.html">Manuals<\/a>/);
  const page = fs.readFileSync(path.join(site, 'manual-demo-101.html'), 'utf8');
  assert.match(page, /class="m-dither"/);
  assert.match(page, /m-fig-replay/);
});

test('print and web editions carry the author, license, and colophon', () => {
  const { dir } = fixture();
  const manual = manuals.loadManual(dir);
  const print = manuals.printPage(manual);
  assert.match(print, /<meta name="author" content="Rohit Ghumare">/);
  assert.match(print, /<span class="m-kicker m-copy">© 2026 Rohit Ghumare · MIT license<\/span>/);
  assert.match(print, /class="m-cover-edition"/);
  assert.match(print, /id="colophon"/);
  const site = tempDir('manuals-colophon-');
  manuals.writeWeb([manual], site, { only: 'demo-101' });
  const page = fs.readFileSync(path.join(site, 'manual-demo-101.html'), 'utf8');
  assert.match(page, /id="colophon"/);
  assert.match(page, /<footer class="site-footer">/);
});
