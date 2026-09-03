const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const learningPaths = fs.readFileSync(path.join(__dirname, 'learning-paths.html'), 'utf8');
const learningPathsCss = fs.readFileSync(path.join(__dirname, 'learning-paths.css'), 'utf8');
const learningPathsJs = fs.readFileSync(path.join(__dirname, 'learning-paths.js'), 'utf8');

const domains = [
  { id: 'building-and-deploying', title: 'Building and Deploying AI Applications', children: 6 },
  { id: 'software-fundamentals', title: 'Software Engineering Fundamentals', children: 5 },
  { id: 'coding-agents', title: 'Agent-Assisted Engineering', children: 8 },
  { id: 'shaping-the-build', title: 'Product Judgment and Delivery', children: 8 },
];

const expectedCareerTitles = new Map([
  ['forward-deployed-ai-engineer', 'Customer AI Deployment'],
  ['ai-developer-relations-engineer', 'Developer Experience and Education'],
  ['ai-data-engineer', 'AI Data Systems'],
  ['agentic-ai-engineer', 'Agent Systems Engineering'],
  ['applied-ai-engineer', 'LLM Product Engineering'],
  ['ai-evaluation-reliability-engineer', 'AI Evaluation and Reliability'],
]);

const careerRoutes = Array.from(expectedCareerTitles, ([id, title]) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'learning-paths', `${id}.json`), 'utf8'));
  return { id, title, manifest };
});

function sectionSource(id) {
  const start = learningPaths.indexOf(`<section class="skills-domain learning-paths-container" id="${id}"`);
  assert.notEqual(start, -1, `${id} section is missing`);
  const end = learningPaths.indexOf('</section>', start);
  assert.notEqual(end, -1, `${id} section is not closed`);
  return learningPaths.slice(start, end);
}

function careerSectionSource() {
  const start = learningPaths.indexOf('<section class="career-routes learning-paths-container" id="career-routes"');
  assert.notEqual(start, -1, 'career routes section is missing');
  const end = learningPaths.indexOf('<section class="skills-domain learning-paths-container"', start);
  assert.notEqual(end, -1, 'career routes section is not closed before the domain sections');
  return learningPaths.slice(start, end);
}

test('homepage nodes open the expanded learning paths domains', () => {
  assert.match(homepage, /href="learning-paths\.html"[\s\S]*?>\s*<span>Explore Learning Paths<\/span>/);
  assert.match(homepage, /srcset="assets\/figures\/006-ai-engineering-learning-paths-mobile\.svg"[\s\S]*?data-i18n-srcset-zh="assets\/figures\/006-ai-engineering-learning-paths-mobile\.zh-CN\.svg"/);
  assert.match(homepage, /src="assets\/figures\/006-ai-engineering-learning-paths\.svg"[\s\S]*?data-i18n-src-zh="assets\/figures\/006-ai-engineering-learning-paths\.zh-CN\.svg"/);
  assert.match(homepage, /href="learning-paths\.html#career-routes">Browse career routes<\/a>/);
  assert.match(homepage, /<figcaption class="learning-paths-compact-root">\s*<strong>AI Engineering<\/strong>\s*<span>4 connected domains<\/span>\s*<\/figcaption>/);
  assert.match(homepage, /@media \(max-width: 600px\)[\s\S]*?\.learning-paths-figure\s*\{[\s\S]*?display: grid;[\s\S]*?gap: 8px;[\s\S]*?padding: 12px;/);
  assert.match(homepage, /@media \(max-width: 600px\)[\s\S]*?\.learning-paths-figure picture\s*\{\s*display: none;\s*\}/);
  assert.match(homepage, /@media \(max-width: 600px\)[\s\S]*?\.learning-paths-node\s*\{[\s\S]*?position: relative;[\s\S]*?min-height: 48px;/);
  assert.match(homepage, /@media \(max-width: 600px\)[\s\S]*?\.learning-paths-node-label\s*\{[\s\S]*?position: static;[\s\S]*?clip: auto;/);
  for (const domain of domains) {
    assert.match(homepage, new RegExp(`href="learning-paths\\.html#${domain.id}"`));
    assert.match(learningPaths, new RegExp(`href="#${domain.id}"`));
  }
});

test('every core learning path exposes clickable child competencies', () => {
  let totalChildren = 0;
  for (const domain of domains) {
    const source = sectionSource(domain.id);
    assert.match(source, new RegExp(`<h2[^>]*>${domain.title}</h2>`));
    assert.match(source, /class="skills-domain-root-link"[^>]+learningPath=/);
    const children = source.match(/<a class="skills-node"/g) || [];
    assert.equal(children.length, domain.children, `${domain.id} child count drifted`);
    totalChildren += children.length;
  }
  assert.equal(totalChildren, 27);
});

test('software foundations follows five capability branches backed by lessons', () => {
  const source = sectionSource('software-fundamentals');
  for (const branch of [
    'End-to-End Application Delivery',
    'Data Lifecycle and Storage',
    'System Architecture and Boundaries',
    'Secure and Resilient Systems',
    'Production Scale and Service Ownership',
  ]) {
    assert.match(source, new RegExp(`<strong>${branch}</strong>`));
  }
  assert.match(source, /class="skills-domain-children skills-domain-children--five"/);
  assert.match(source, /Open representative lesson/);
  assert.match(source, /13-lesson foundation path · 730 minutes/);
  assert.match(source, /17-infrastructure-and-production\/25-security-secrets-audit/);
});

test('domain route totals match their canonical manifests', () => {
  assert.match(sectionSource('building-and-deploying'), /12-lesson path · 780 minutes/);
  assert.match(sectionSource('software-fundamentals'), /13-lesson foundation path · 730 minutes/);
  assert.match(sectionSource('coding-agents'), /16-lesson path · 900 minutes/);
});

test('every child node resolves to a real local lesson', () => {
  const hrefs = Array.from(learningPaths.matchAll(/<a class="skills-node" href="lesson\?path=([^&"]+)&amp;learningPath=([^"]+)"/g));
  assert.equal(hrefs.length, 27);
  for (const match of hrefs) {
    const lessonPath = decodeURIComponent(match[1]);
    const learningPath = match[2];
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'learning-paths', `${learningPath}.json`), 'utf8'));
    assert.equal(
      fs.existsSync(path.join(root, lessonPath, 'docs', 'en.md')),
      true,
      `${lessonPath} does not resolve to a published lesson`
    );
    assert.equal(
      manifest.lessons.some(lesson => lesson.path === lessonPath),
      true,
      `${lessonPath} is not part of ${learningPath}`
    );
  }
});

test('career chooser opens detailed work-family guides before lessons', () => {
  const source = careerSectionSource();
  assert.equal((source.match(/<details class="career-guide"/g) || []).length, careerRoutes.length);
  assert.equal((source.match(/data-career-choice=/g) || []).length, careerRoutes.length);
  assert.equal((source.match(/>Study specialist lessons<\/a>/g) || []).length, careerRoutes.length);
  assert.doesNotMatch(source, /career-path-card|Start path/);

  for (const career of careerRoutes) {
    const manifest = career.manifest;
    const guideId = `career-route-${career.id}`;
    const firstLesson = manifest.lessons[0].path;
    const href = `lesson?path=${firstLesson}&amp;learningPath=${career.id}`;
    assert.equal(source.includes(`href="#${guideId}" data-career-choice="${career.id}"`), true, `${career.id} chooser link is missing`);
    assert.equal(source.includes(`id="${guideId}" data-career-guide="${career.id}"`), true, `${career.id} guide is missing`);
    assert.equal(source.includes(`<strong>${career.title}</strong>`), true, `${career.id} work-family title is missing`);
    assert.equal(source.includes(manifest.commonTitles.join(' · ')), true, `${career.id} search titles drifted from its manifest`);
    assert.equal(source.includes(`${manifest.lessons.length} specialist lessons · ${manifest.estimatedMinutes} minutes`), true, `${career.id} guided time is missing`);
    assert.equal(source.includes(`href="${href}"`), true, `${career.id} guide does not open its specialist lessons`);
  }
});

test('career route manifests are honest evidence-building overlays', () => {
  for (const career of careerRoutes) {
    const manifest = career.manifest;
    assert.equal(manifest.id, career.id);
    assert.equal(manifest.title, career.title);
    assert.equal(manifest.kind, 'career-route');
    assert.equal(manifest.workFamily, career.title);
    assert.equal(manifest.sourceBasis.reviewedAt, '2026-08-29');
    assert.match(manifest.sourceBasis.method, /primary job descriptions/i);
    assert.ok(manifest.commonTitles.length >= 3);
    assert.ok(manifest.responsibilities.length >= 3);
    assert.ok(manifest.goodFitIf.length >= 2);
    assert.ok(manifest.baseline.length >= 2);
    assert.ok(manifest.portfolioProof.evidence.length >= 3);
    assert.ok(manifest.readinessCriteria.length >= 4);
    assert.ok(manifest.coverage.strong.length >= 2);
    assert.ok(manifest.coverage.partial.length >= 1);
    assert.ok(manifest.coverage.outsideCourse.length >= 1);
    assert.match(manifest.boundary, /specialist overlay/i);
    assert.match(manifest.timeNote, /lesson time only/i);
    assert.match(manifest.completionClaim, /does not guarantee/i);
    assert.equal(manifest.stages.length, 4);
    assert.deepEqual(
      manifest.stages.map(stage => stage.id),
      ['common-core', 'role-practice', 'proof-project', 'interview-readiness-evidence']
    );
    for (const stage of manifest.stages) {
      assert.ok(stage.outcome.length > 20, `${career.id} ${stage.id} needs a concrete outcome`);
      assert.ok(stage.artifact.length > 20, `${career.id} ${stage.id} needs a concrete artifact`);
      assert.ok(stage.lessonPaths.length > 0, `${career.id} ${stage.id} needs lessons`);
    }

    const lessonPaths = manifest.lessons.map(lesson => lesson.path);
    const stagePaths = manifest.stages.flatMap(stage => stage.lessonPaths);
    assert.deepEqual(stagePaths, lessonPaths, `${career.id} stages must partition lessons in route order`);
    assert.deepEqual(manifest.lessons.map(lesson => lesson.order), Array.from({ length: manifest.lessons.length }, (_, index) => index + 1));
    assert.equal(manifest.lessons.reduce((total, lesson) => total + lesson.minutes, 0), manifest.estimatedMinutes);
    assert.equal(new Set(lessonPaths).size, manifest.lessons.length);
    assert.doesNotMatch(JSON.stringify(manifest), /https?:\/\/|[–—]/);
    for (const lesson of manifest.lessons) {
      assert.equal(
        fs.existsSync(path.join(root, lesson.path, 'docs', 'en.md')),
        true,
        `${career.id} references missing lesson ${lesson.path}`
      );
    }
  }
});

test('career guidance states the prerequisite and employment boundaries', () => {
  const source = careerSectionSource();
  assert.match(source, /specialist overlays after shared foundations/i);
  assert.match(source, /does not guarantee a job/i);
  assert.match(source, /guided lesson time only/i);
  assert.match(source, /exclude foundation work, independent projects, and professional experience/i);
  assert.match(source, /href="#software-fundamentals">Engineering foundations<\/a>/);
  assert.match(source, /href="#building-and-deploying">AI application foundations<\/a>/);
  assert.match(source, /Which work would you want to repeat every week\?/);
  assert.match(source, /What you would own/);
  assert.match(source, /Portfolio proof/);
  assert.match(source, /Course coverage and gaps/);
  assert.doesNotMatch(source, /[–—]/);
});

test('learning paths stays navigable on narrow screens and uses a neutral root', () => {
  assert.match(learningPaths, /<title>AI Engineering Learning Paths - AI Engineering from Scratch<\/title>/);
  assert.match(learningPaths, /<span class="learning-paths-eyebrow">4 core paths · 6 career routes<\/span>/);
  assert.match(learningPaths, /<h1 id="learningPathsTitle">AI Engineering Learning Paths<\/h1>/);
  assert.match(learningPaths, /class="learning-paths-entry-nav"[\s\S]*?href="#overview"[\s\S]*?href="#career-routes"/);
  assert.match(learningPathsCss, /@media \(max-width: 600px\)[\s\S]*?\.skills-domain-children\s*\{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(learningPathsCss, /\.skills-domain-children\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);[\s\S]*?min-width: 0;/);
  assert.match(learningPathsCss, /\.skills-domain-children--five\s*\{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(learningPathsCss, /@media \(max-width: 900px\)[\s\S]*?\.skills-domain-children--five\s*\{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(learningPathsCss, /@media \(max-width: 900px\)[\s\S]*?\.skills-domain-children--five \.skills-node::before\s*\{[\s\S]*?display: block/);
  assert.match(learningPathsCss, /@media \(max-width: 600px\)[\s\S]*?\.skills-domain-children \.skills-node::before\s*\{[\s\S]*?display: block/);
  assert.match(learningPathsCss, /\.skills-domain-children:not\(\.skills-domain-children--five\) \.skills-node:nth-child\(n \+ 5\)::before\s*\{\s*display: block;\s*height: 28px;\s*\}/);
  assert.match(learningPathsCss, /@media \(max-width: 900px\)[\s\S]*?\.skills-domain-children:not\(\.skills-domain-children--five\) \.skills-node:nth-child\(n \+ 3\)::before\s*\{\s*display: block;\s*height: 28px;\s*\}/);
  assert.match(learningPathsCss, /@media \(max-width: 600px\)[\s\S]*?\.skills-domain-children:not\(\.skills-domain-children--five\) \.skills-node:nth-child\(n \+ 3\)::before\s*\{\s*height: 0;\s*\}/);
  assert.doesNotMatch(learningPathsCss, /\.skills-node:nth-child\(n \+ (?:3|5)\)::before\s*\{[^}]*display:\s*none/);
  assert.match(learningPathsCss, /\.career-choice-grid\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(learningPathsCss, /@media \(max-width: 900px\)[\s\S]*?\.career-choice-grid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(learningPathsCss, /@media \(max-width: 600px\)[\s\S]*?\.career-choice-grid\s*\{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(learningPathsCss, /\.career-guide-grid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(learningPathsCss, /@media \(max-width: 900px\)[\s\S]*?\.career-guide-grid\s*\{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(learningPathsCss, /\.career-guide-grid p,[\s\S]*?\.career-guide-grid li\s*\{[\s\S]*?font-size: 1rem/);
  assert.doesNotMatch(learningPathsCss, /min-width: calc\(var\(--child-count\)/);
  assert.doesNotMatch(learningPaths, /class="skills-domain-scroller" tabindex=/);
  assert.match(learningPathsCss, /\.learning-paths-domain-link:focus-visible/);
  assert.match(learningPathsCss, /\.career-guide > summary:focus-visible/);
  assert.match(learningPathsCss, /\.career-guide-cta:focus-visible/);
  assert.match(learningPathsCss, /\.skills-node:focus-visible/);
  for (const filename of ['006-ai-engineering-learning-paths.svg', '006-ai-engineering-learning-paths-mobile.svg']) {
    const svg = fs.readFileSync(path.join(__dirname, 'assets', 'figures', filename), 'utf8');
    assert.match(svg, /\.root\{fill:#fafaf5;stroke:#1a1a1a;stroke-width:3\}/);
    assert.doesNotMatch(svg, /\.root\{fill:#3553ff/);
  }
});

test('career chooser hash navigation reveals and focuses a guide', () => {
  assert.match(learningPathsJs, /function careerGuideFromHash\(hash\)/);
  assert.match(learningPathsJs, /guide\.matches\('details\.career-guide'\)/);
  assert.match(learningPathsJs, /function closeOtherCareerGuides\(activeGuide\)/);
  assert.match(learningPathsJs, /if \(guide !== activeGuide\) guide\.open = false/);
  assert.match(learningPathsJs, /guide\.open = true/);
  assert.match(learningPathsJs, /setAttribute\('aria-current', 'location'\)/);
  assert.match(learningPathsJs, /addEventListener\('hashchange'/);
  assert.match(learningPathsJs, /if \(!revealCareerGuide\(window\.location\.hash, true\)\) syncCareerChoice\(null\)/);
  assert.match(learningPathsJs, /prefers-reduced-motion: reduce/);
});

test('learning paths shares the site theme preference', () => {
  assert.match(learningPaths, /<script src="learning-paths\.js\?v=20260830a"><\/script>/);
  assert.match(learningPaths, /<link rel="stylesheet" href="learning-paths\.css\?v=20260829d">/);
  assert.match(learningPathsJs, /localStorage\.getItem\('theme'\)/);
  assert.match(learningPathsJs, /localStorage\.setItem\('theme', theme\)/);
  assert.match(learningPathsJs, /prefers-color-scheme: dark/);
  assert.match(learningPathsJs, /addEventListener\('storage'/);
});
