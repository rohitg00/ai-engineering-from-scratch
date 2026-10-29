const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'skills');
const { GROUPS, LOADER, build, loadSkills, loaderData } = require('./build-skills.js');
const CRAFT = ['course-style', 'blueprint-figure', 'motion-figure', 'isometric-explainer', 'write-manual', 'lesson-screen'];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

test('every skill folder has exactly one card and every card has a folder', () => {
  const meta = loadSkills();
  const cards = GROUPS.flatMap((group) => Object.keys(group.skills));
  assert.equal(new Set(cards).size, cards.length);
  assert.deepEqual([...cards].sort(), Object.keys(meta).sort());
  for (const group of GROUPS) assert.ok(Object.keys(group.skills).length > 0, group.id);
});

test('the published page and markdown are the build output', () => {
  const html = path.join(__dirname, 'skills.html');
  const md = path.join(__dirname, 'skills.md');
  const before = [fs.readFileSync(html, 'utf8'), fs.readFileSync(md, 'utf8')];
  build();
  assert.deepEqual([fs.readFileSync(html, 'utf8'), fs.readFileSync(md, 'utf8')], before);
});

test('the page lists every skill with its install command and source link', () => {
  const html = fs.readFileSync(path.join(__dirname, 'skills.html'), 'utf8');
  for (const name of Object.keys(loadSkills())) {
    assert.match(html, new RegExp(`id="${name}"`), name);
    assert.ok(html.includes(`npx skills add rohitg00/ai-engineering-from-scratch --skill ${name}`), name);
    assert.ok(html.includes(`/blob/main/skills/${name}/SKILL.md`), name);
  }
  assert.ok(html.includes('og/page/skills.png'));
  assert.doesNotMatch(html, /Claude Code(?! is)/);
});

test('the agent copy of the skills folder matches the canonical one', () => {
  const list = (dir) => files(dir).map((file) => path.relative(dir, file)).sort();
  const canonical = list(skillsDir);
  assert.deepEqual(list(path.join(root, '.claude', 'skills')), canonical);
  for (const rel of canonical) {
    assert.ok(fs.readFileSync(path.join(skillsDir, rel)).equals(fs.readFileSync(path.join(root, '.claude', 'skills', rel))), rel);
  }
});

test('every skill has frontmatter with its own name, a version and a description', () => {
  for (const name of Object.keys(loadSkills())) {
    const text = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
    const head = /^---\n([\s\S]*?)\n---/.exec(text)[1];
    assert.match(head, new RegExp(`^name: ${name}$`, 'm'), name);
    assert.match(head, /^description:/m, name);
  }
  for (const name of CRAFT) {
    const text = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
    assert.match(text, /^version: \d+\.\d+\.\d+$/m, name);
    assert.ok(text.split('\n').length <= 320, `${name}: SKILL.md stays short`);
  }
});

const BANNED = /\b(wir(e|es|ed|ing)|stick(s|y|ing)?|glue|plumbing|footguns?|gotchas?|under the hood|escape hatch|sharp edges?|first[- ]class|out of the box|heavy lifting|moving parts|sweet spot|deep[- ]dive|boils? down|spin(s|ning)? up|kick(s|ed|ing)? off|baked|fall(s|ing)? back|fallbacks?|in[- ]flight|out[- ]of[- ]band|handoffs?|delv(e|es|ing)|robust(ly|ness)?|seamless(ly)?|crucial(ly)?|comprehensive(ly)?|landscape|tapestry|testament|furthermore|moreover|leverag(e|es|ed|ing)|additionally|actually|foster(s|ed|ing)?|garner(s|ed|ing)?|intricate|meticulous(ly)?|quietly|showcas(e|es|ed|ing)|underscor(e|es|ed|ing)|vibrant|enhanc(e|es|ed|ing)|interplay|enduring|bolster(s|ed|ing)?|journey|unlock(s|ed|ing)?|supercharg\w*)\b/i;

function withoutFences(text) {
  let fence = false;
  return text.split('\n').filter((line) => {
    if (/^\s*```/.test(line)) { fence = !fence; return false; }
    return !fence;
  }).join('\n');
}

function prose(text) {
  return withoutFences(text.replace(/^---\n[\s\S]*?\n---/, ''))
    .replace(/`[^`\n]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/"[^"\n]*"/g, '')
    .split('\n')
    .filter((line) => !/^\s*\|/.test(line));
}

test('the making skills follow the plain technical English rules', () => {
  const problems = [];
  for (const name of CRAFT) {
    for (const file of files(path.join(skillsDir, name)).filter((file) => file.endsWith('.md'))) {
      prose(fs.readFileSync(file, 'utf8')).forEach((line, index) => {
        const where = `${path.relative(root, file)}:${index + 1}`;
        if (/[—–]/.test(line)) problems.push(`${where} dash`);
        if (line.includes(';')) problems.push(`${where} semicolon`);
        if (/\bmay\b/i.test(line)) problems.push(`${where} "may"`);
        const word = BANNED.exec(line);
        if (word) problems.push(`${where} "${word[0]}"`);
      });
    }
  }
  assert.deepEqual(problems, []);
});

test('the making skills name no outside skill authors and stay vendor neutral', () => {
  for (const name of CRAFT) {
    for (const file of files(path.join(skillsDir, name)).filter((file) => /\.(md|mjs|js|html|svg)$/.test(file))) {
      if (file.includes(`${path.sep}kit${path.sep}`)) continue;
      const text = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /wheresryan|emilkowal|aihero|mattpocock|anatomy-figures/i, file);
      if (file.endsWith('.md')) assert.doesNotMatch(text, /Claude Code/, file);
    }
  }
});

test('every relative link inside the making skills points to a real file', () => {
  for (const name of CRAFT) {
    for (const file of files(path.join(skillsDir, name)).filter((file) => file.endsWith('.md'))) {
      const text = withoutFences(fs.readFileSync(file, 'utf8')).replace(/`[^`\n]*`/g, '');
      for (const match of text.matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)) {
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), match[1])), `${path.relative(root, file)} -> ${match[1]}`);
      }
    }
  }
});

test('the isometric explainer starter builds a page', () => {
  const dir = path.join(skillsDir, 'isometric-explainer', 'templates');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-template-'));
  fs.cpSync(path.join(skillsDir, 'isometric-explainer'), path.join(scratch, 'isometric-explainer'), { recursive: true });
  const copy = path.join(scratch, 'isometric-explainer', 'templates');
  execFileSync(process.execPath, [path.join(copy, 'build.mjs')], { cwd: copy, stdio: 'pipe' });
  const out = fs.readFileSync(path.join(copy, 'out.html'), 'utf8');
  assert.match(out, /<svg[\s\S]*<\/svg>/);
  assert.ok(!fs.existsSync(path.join(dir, 'out.html')), 'templates/out.html is not committed');
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('the skill loader figure counts tokens from the real skill files', () => {
  const quarter = (file, strip) => {
    let text = fs.readFileSync(file, 'utf8');
    if (strip) text = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
    return Math.round(Buffer.byteLength(text, 'utf8') / 4);
  };
  const data = loaderData();
  const says = GROUPS.flatMap((group) => Object.values(group.skills).flatMap((info) => info.say));
  assert.equal(data.skills.length, Object.keys(loadSkills()).length);
  assert.equal(data.requests.length, LOADER.length);
  for (const request of data.requests) {
    assert.ok(says.includes(request.say), request.say);
    assert.ok(data.skills.some((skill) => skill.name === request.skill), request.skill);
    const [main, ...refs] = request.files;
    assert.equal(main.path, `${request.skill}/SKILL.md`);
    assert.equal(main.tokens, quarter(path.join(skillsDir, request.skill, 'SKILL.md'), true));
    for (const ref of refs) assert.equal(ref.tokens, quarter(path.join(skillsDir, request.skill, ref.path), false), ref.path);
  }
  const full = files(skillsDir).filter((file) => file.endsWith('.md')).reduce((sum, file) => sum + quarter(file, false), 0);
  assert.equal(data.full, full);
  const html = fs.readFileSync(path.join(__dirname, 'skills.html'), 'utf8');
  const embedded = JSON.parse(/<script type="application\/json" class="sl-data">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.deepEqual(embedded, data);
});

test('the page draws a dither band from the motion figure template and loads the demo', () => {
  const html = fs.readFileSync(path.join(__dirname, 'skills.html'), 'utf8');
  assert.match(html, /<div class="dither[^"]*" data-seed="skills"[^>]*aria-hidden="true"><\/div>/);
  assert.match(html, /<script src="dither\.js\?v=[^"]+" defer><\/script>/);
  assert.match(html, /<script src="skills-demo\.js\?v=[^"]+" defer><\/script>/);
  assert.doesNotMatch(html, /lesson-figures\.js|softmax-temperature/);
  assert.ok(fs.readFileSync(path.join(__dirname, 'dither.js')).equals(fs.readFileSync(path.join(skillsDir, 'motion-figure', 'templates', 'dither.js'))));
  for (const name of ['dither.js', 'skills-demo.js']) {
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    assert.doesNotMatch(source, /=>|\blet\b|\bconst\b|`/, name);
  }
});

test('the page copy has no contrast tells, dashes, semicolons, or banned words', () => {
  const html = fs.readFileSync(path.join(__dirname, 'skills.html'), 'utf8');
  const text = html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<code>[\s\S]*?<\/code>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ');
  const problems = [];
  if (/[—–]/.test(text)) problems.push('dash');
  if (text.includes(';')) problems.push('semicolon');
  if (/\bmay\b/i.test(text)) problems.push('"may"');
  const contrast = /, not [a-z]|\bnot just\b|\bnot only\b|\brather than\b|\bnever full\b/i.exec(text);
  if (contrast) problems.push(`contrast "${contrast[0]}"`);
  const word = BANNED.exec(text);
  if (word) problems.push(`"${word[0]}"`);
  assert.deepEqual(problems, []);
});

test('inline figures style every class they use', () => {
  const html = fs.readFileSync(path.join(__dirname, 'skills.html'), 'utf8');
  for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) || []) {
    if (svg.includes('class="m-serif"')) assert.match(html, /\.m-serif\s*\{\s*font-family/);
    if (/<text(?![^>]*fill=)/.test(svg)) assert.match(html, /\.sk-example svg \{ fill: var\(--m-ink\)/);
  }
});
