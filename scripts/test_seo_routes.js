const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const lessonApi = require('../api/lesson');
const certificationApi = require('../api/certification');
const ogApi = require('../api/og');
const ogCards = require('../lib/og-cards');
const { parseMd } = require('../site/lesson-markdown');
const manuals = require('../site/build-manuals.js');
const { buildData: buildProjectData } = require('../site/build-projects.js');
const translations = require('../lib/lesson-translations');
const build = require('../site/build.js');
const { collectCoverage } = require('../site/fetch-translation-coverage.js');
const { compareCoverage, compareBuildCoverage } = require('../scripts/check_translation_coverage.js');

const ROOT = path.join(__dirname, '..');
const PERCEPTRON = 'phases/03-deep-learning-core/01-the-perceptron';

function makeAssets() {
  return {
    lesson: {
      template: [
        '<!DOCTYPE html><html><head>',
        '<!-- AIFS:LESSON-SEO:START --><title>Fallback</title><!-- AIFS:LESSON-SEO:END -->',
        '</head><body><main><div id="lessonContent">',
        '<!-- AIFS:LESSON-FALLBACK:START --><p>Loading</p><!-- AIFS:LESSON-FALLBACK:END -->',
        '</div></main></body></html>',
      ].join('\n'),
      manifest: {
        version: 1,
        certificationTrackIds: ['claude-example'],
        lessons: {
          'phases/01-math/01-vectors': {
            path: 'phases/01-math/01-vectors',
            title: 'Vectors & <Matrices>',
            seoTitle: 'Vectors & Matrices - AI Engineering from Scratch',
            description: 'Build vector operations from first principles.',
            excerpt: 'See how direction and magnitude become useful model inputs.',
            context: { kind: 'course', phaseId: 1, phaseName: 'Math Foundations' },
            previous: null,
            next: { path: 'phases/01-math/02-calculus', title: 'Calculus' },
            learningPathIds: ['math', 'model-context-protocol'],
            fromTrackIds: ['claude-example'],
            sourceUrl: 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/01-math/01-vectors',
            canonicalUrl: 'https://aiengineeringfromscratch.com/lesson?path=phases%2F01-math%2F01-vectors',
          },
          'phases/07-transformers/09-vectors': {
            path: 'phases/07-transformers/09-vectors',
            title: 'Vectors & <Matrices>',
            seoTitle: 'Vectors & Matrices - Transformers Deep Dive',
            description: 'Apply vector operations inside transformer representations.',
            excerpt: 'Connect vector geometry to attention and representation learning.',
            context: { kind: 'course', phaseId: 7, phaseName: 'Transformers Deep Dive' },
            previous: null,
            next: null,
            learningPathIds: [],
            fromTrackIds: [],
            canonicalUrl: 'https://aiengineeringfromscratch.com/lesson?path=phases%2F07-transformers%2F09-vectors',
          },
          'certifications/claude/lessons/01-models': {
            path: 'certifications/claude/lessons/01-models',
            title: 'Model Decisions',
            seoTitle: 'Model Decisions - AI Engineering from Scratch',
            description: 'Choose model boundaries from requirements and evidence.',
            excerpt: 'A certification lesson about model selection and system boundaries.',
            context: {
              kind: 'certification',
              programName: 'Independent Claude Certification Preparation',
              trackIds: ['claude-example'],
            },
            previous: null,
            next: { path: 'phases/14-agent-engineering/01-the-agent-loop', title: 'The Agent Loop' },
            navigationByTrack: {
              'claude-example': {
                previous: null,
                next: { path: 'certifications/claude/lessons/02-tools', title: 'Tool Decisions' },
              },
            },
            learningPathIds: [],
            fromTrackIds: [],
            sourceUrl: 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/certifications/claude/lessons/01-models',
            canonicalUrl: 'https://aiengineeringfromscratch.com/lesson?path=certifications%2Fclaude%2Flessons%2F01-models',
          },
        },
      },
      languageCodes: ['en', 'hi'],
    },
    certification: {
      template: [
        '<!DOCTYPE html><html><head>',
        '<!-- AIFS:CERTIFICATION-SEO:START --><title>Fallback</title><!-- AIFS:CERTIFICATION-SEO:END -->',
        '</head><body><main><section id="trackHero">',
        '<!-- AIFS:CERTIFICATION-FALLBACK:START --><p>Loading</p><!-- AIFS:CERTIFICATION-FALLBACK:END -->',
        '</section></main></body></html>',
      ].join('\n'),
      manifest: {
        version: 1,
        tracks: {
          'claude-example': {
            id: 'claude-example',
            slug: 'example',
            examCode: 'EXAMPLE',
            title: 'Example Architecture Track',
            seoTitle: 'Example Architecture Track - AI Engineering from Scratch',
            description: 'Independent preparation through practical architecture decisions.',
            excerpt: 'Move from blueprint domains to evidence-backed engineering work.',
            canonicalUrl: 'https://aiengineeringfromscratch.com/certification?id=claude-example',
            lessons: [
              { path: 'certifications/claude/lessons/01-models', title: 'Model Decisions' },
              { path: 'phases/14-agent-engineering/01-the-agent-loop', title: 'The Agent Loop' },
            ],
          },
        },
      },
    },
  };
}

function withSecondProgram(assets) {
  assets.lesson.manifest.certificationTrackIds.push('mcpa-example');
  assets.lesson.manifest.lessons['certifications/mcpa/lessons/01-discovery'] = {
    path: 'certifications/mcpa/lessons/01-discovery',
    title: 'Discovery Decisions',
    seoTitle: 'Discovery Decisions - AI Engineering from Scratch',
    description: 'Negotiate protocol capabilities on every request instead of once per session.',
    excerpt: 'A certification lesson about stateless discovery and capability negotiation.',
    context: {
      kind: 'certification',
      programName: 'Independent MCPA Certification Preparation',
      trackIds: ['mcpa-example'],
    },
    previous: null,
    next: null,
    navigationByTrack: {
      'mcpa-example': {
        previous: null,
        next: { path: 'certifications/mcpa/lessons/02-tools', title: 'Tool Contracts' },
      },
    },
    learningPathIds: [],
    fromTrackIds: [],
    sourceUrl: 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/certifications/mcpa/lessons/01-discovery',
    canonicalUrl: 'https://aiengineeringfromscratch.com/lesson?path=certifications%2Fmcpa%2Flessons%2F01-discovery',
  };
  assets.certification.manifest.tracks['mcpa-example'] = {
    id: 'mcpa-example',
    slug: 'mcpa-example',
    examCode: 'MCPA',
    title: 'Example Protocol Track',
    seoTitle: 'Example Protocol Track - AI Engineering from Scratch',
    description: 'Independent preparation through practical protocol decisions.',
    excerpt: 'Move from protocol blueprint domains to working hosts, clients, and servers.',
    canonicalUrl: 'https://aiengineeringfromscratch.com/certification?id=mcpa-example',
    lessons: [
      { path: 'certifications/mcpa/lessons/01-discovery', title: 'Discovery Decisions' },
      { path: 'phases/13-tools-and-protocols/06-mcp-fundamentals', title: 'MCP Fundamentals' },
    ],
  };
  return assets;
}

function recorder() {
  const response = { statusCode: 200, headers: {}, body: undefined };
  const res = {
    setHeader(name, value) {
      response.headers[String(name).toLowerCase()] = String(value);
    },
    end(body) {
      response.body = body == null ? '' : String(body);
    },
  };
  Object.defineProperty(res, 'statusCode', {
    get() { return response.statusCode; },
    set(value) { response.statusCode = value; },
  });
  return { response, res };
}

function invoke(handler, req) {
  const { response, res } = recorder();
  handler(req, res);
  return response;
}

async function invokeAsync(handler, req) {
  const { response, res } = recorder();
  await handler(req, res);
  return response;
}

test('lesson route renders unique crawlable HTML with a path-only canonical', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=math&lang=hi',
    query: { path: 'phases/01-math/01-vectors', learningPath: 'math', lang: 'hi' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['cache-control'], /s-maxage=86400/);
  assert.match(response.body, /<title>Vectors &amp; Matrices - AI Engineering from Scratch<\/title>/);
  assert.match(response.body, /rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/lesson\?path=phases%2F01-math%2F01-vectors"/);
  assert.doesNotMatch(response.body, /canonical"[^>]+learningPath=/);
  assert.equal((response.body.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(response.body, /<h1>Vectors &amp; &lt;Matrices&gt; - Math Foundations<\/h1>/);
  assert.match(response.body, /"@type":"LearningResource"/);
  assert.match(response.body, /"@type":"BreadcrumbList"/);
  assert.doesNotMatch(response.body, /"@type":"Person"|#person|rohitghumare\.com/);
  assert.doesNotMatch(response.body, /<script>Vectors/);
  assert.match(response.body, /path=phases%2F01-math%2F02-calculus/);
});

test('lesson route keeps certification navigation inside the selected track', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=certifications%2Fclaude%2Flessons%2F01-models&track=claude-example',
    query: { path: 'certifications/claude/lessons/01-models', track: 'claude-example' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /path=certifications%2Fclaude%2Flessons%2F02-tools&amp;track=claude-example/);
  assert.doesNotMatch(response.body, /path=phases%2F14-agent-engineering%2F01-the-agent-loop/);
  assert.doesNotMatch(response.body, /canonical"[^>]+track=/);
});

test('lesson route serves every certification program and keeps its track navigation', function () {
  const assets = withSecondProgram(makeAssets());
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=certifications%2Fmcpa%2Flessons%2F01-discovery&track=mcpa-example',
    query: { path: 'certifications/mcpa/lessons/01-discovery', track: 'mcpa-example' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/lesson\?path=certifications%2Fmcpa%2Flessons%2F01-discovery"/);
  assert.match(response.body, /path=certifications%2Fmcpa%2Flessons%2F02-tools&amp;track=mcpa-example/);
});

test('lesson route disambiguates duplicate H1 values across pages', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const first = invoke(handler, { method: 'GET', query: { path: 'phases/01-math/01-vectors' } });
  const second = invoke(handler, { method: 'GET', query: { path: 'phases/07-transformers/09-vectors' } });
  const firstHeading = first.body.match(/<h1>(.*?)<\/h1>/)[1];
  const secondHeading = second.body.match(/<h1>(.*?)<\/h1>/)[1];

  assert.notEqual(firstHeading, secondHeading);
  assert.equal(firstHeading, 'Vectors &amp; &lt;Matrices&gt; - Math Foundations');
  assert.equal(secondHeading, 'Vectors &amp; &lt;Matrices&gt; - Transformers Deep Dive');
});

test('production lesson manifest yields one distinct server heading per URL', function () {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site', 'lesson-seo.json'), 'utf8'));
  const headings = Object.values(manifest.lessons).map(function (entry) {
    return lessonApi.lessonHeading(entry, manifest);
  });

  assert.equal(headings.length, Object.keys(manifest.lessons).length);
  assert.equal(new Set(headings).size, headings.length);
  assert.ok(Array.isArray(manifest.certificationTrackIds));
  assert.ok(manifest.certificationTrackIds.length > 0);
  Object.values(manifest.lessons).forEach(function (entry) {
    assert.ok(Array.isArray(entry.learningPathIds), entry.path);
    assert.ok(Array.isArray(entry.fromTrackIds), entry.path);
  });
});

test('legacy lesson route keeps one navigation mode plus language and local TTS state', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/api/lesson?legacy=1&path=phases%2F01-math%2F01-vectors&learningPath=math&fromTrack=claude-example&lang=hi&ttsTest=silent&utm_source=old-link',
    query: {
      legacy: '1',
      path: 'phases/01-math/01-vectors',
      learningPath: 'math',
      fromTrack: 'claude-example',
      lang: 'hi',
      ttsTest: 'silent',
      utm_source: 'old-link',
    },
    headers: { host: '127.0.0.1:4277' },
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=math&lang=hi&ttsTest=silent');
  assert.equal(response.body, '');
});

test('lesson route normalizes unknown or unsupported query context before caching HTML', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const unknown = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=math&lang=hi&ttsTest=silent&utm_source=random',
  });
  assert.equal(unknown.statusCode, 308);
  assert.equal(unknown.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=math&lang=hi');
  assert.equal(unknown.body, '');

  const unsupported = invoke(handler, {
    method: 'GET',
    query: {
      path: 'phases/01-math/01-vectors',
      fromTrack: 'missing-track',
      learningPath: 'missing-path',
      lang: 'zz',
      ttsTest: 'verbose',
    },
  });
  assert.equal(unsupported.statusCode, 308);
  assert.equal(unsupported.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors');

  const certificationLanguage = invoke(handler, {
    method: 'GET',
    query: {
      path: 'certifications/claude/lessons/01-models',
      track: 'claude-example',
      lang: 'hi',
    },
  });
  assert.equal(certificationLanguage.statusCode, 308);
  assert.equal(certificationLanguage.headers.location, '/lesson?path=certifications%2Fclaude%2Flessons%2F01-models&track=claude-example');

  const silentTts = invoke(handler, {
    method: 'GET',
    query: { path: 'phases/01-math/01-vectors', ttsTest: 'silent' },
    headers: { host: 'localhost:4277' },
  });
  assert.equal(silentTts.statusCode, 200);

  const deployedTts = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors&ttsTest=silent',
    headers: { host: 'aiengineeringfromscratch.com' },
  });
  assert.equal(deployedTts.statusCode, 308);
  assert.equal(deployedTts.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors');
});

test('lesson route canonicalizes valid query parameter order before caching HTML', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?lang=hi&path=phases/01-math/01-vectors&learningPath=math',
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=math&lang=hi');
  assert.equal(response.body, '');
});

test('lesson route keeps certification return context on supplemental course lessons', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors&fromTrack=claude-example&lang=hi',
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /fromTrack=claude-example&amp;lang=hi/);
});

test('lesson route rejects certification return context outside its actual supplemental lessons', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F07-transformers%2F09-vectors&fromTrack=claude-example',
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, '/lesson?path=phases%2F07-transformers%2F09-vectors');
});

test('lesson route rejects learning paths that do not contain the lesson', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=using-coding-agents',
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors');
});

test('lesson route redirects the former MCP path name to the canonical path ID', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=mcp-engineering',
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors&learningPath=model-context-protocol');
});

test('lesson route redirects equivalent raw path encodings to one cache key', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  for (const encodedPath of ['phases/01-math/01-vectors', 'phases%2f01-math%2f01-vectors']) {
    const response = invoke(handler, {
      method: 'GET',
      url: `/lesson?path=${encodedPath}`,
    });
    assert.equal(response.statusCode, 308);
    assert.equal(response.headers.location, '/lesson?path=phases%2F01-math%2F01-vectors');
  }
});

test('lesson route supports HEAD and rejects unsupported methods', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const head = invoke(handler, { method: 'HEAD', query: { path: 'phases/01-math/01-vectors' } });
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);

  const post = invoke(handler, { method: 'POST', query: { path: 'phases/01-math/01-vectors' } });
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal(post.headers['cache-control'], 'no-store');
});

test('lesson route returns recoverable 404s and reloads injected fixture assets', function () {
  const assets = makeAssets();
  let loadCount = 0;
  const handler = lessonApi.createHandler({
    loadAssets: function () {
      loadCount += 1;
      return assets.lesson;
    },
  });
  const missing = invoke(handler, { method: 'GET', query: { path: 'phases/01-math/99-missing' } });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.headers['cache-control'], 'no-store');
  assert.match(missing.body, /href="\/sitemap\.xml"/);
  assert.match(missing.body, /href="\/llms\.txt"/);

  const traversal = invoke(handler, { method: 'GET', query: { path: '../site/lesson' } });
  assert.equal(traversal.statusCode, 404);

  const initial = invoke(handler, { method: 'GET', query: { path: 'phases/01-math/01-vectors' } });
  assert.equal(initial.statusCode, 200);

  assets.lesson.template = '<!DOCTYPE html><html><body>marker missing</body></html>';
  const broken = invoke(handler, { method: 'GET', query: { path: 'phases/01-math/01-vectors' } });
  assert.equal(broken.statusCode, 500);
  assert.equal(broken.headers['cache-control'], 'no-store');
  assert.equal(loadCount, 3);
});

function fallbackRegion(html) {
  const match = html.match(/<!-- AIFS:LESSON-FALLBACK:START -->([\s\S]*?)<!-- AIFS:LESSON-FALLBACK:END -->/);
  assert.ok(match, 'fallback region');
  return match[1];
}

function visibleWords(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(function (token) { return /[A-Za-z0-9]/.test(token); }).length;
}

function embeddedMarkdown(html) {
  const match = html.match(/<script type="application\/json" id="lessonMarkdown">([\s\S]*?)<\/script>/);
  return match ? match[1] : null;
}

function productionAssets(readMarkdown) {
  return Object.assign({}, lessonApi.loadProductionAssets(), { readMarkdown });
}

test('lesson route serves the full lesson body, headings, and code to crawlers', function () {
  const lessonUrl = '/lesson?path=' + encodeURIComponent(PERCEPTRON);
  const full = invoke(lessonApi, { method: 'GET', url: lessonUrl, headers: { host: 'aiengineeringfromscratch.com' } });
  const summary = invoke(lessonApi.createHandler({ loadAssets: function () { return productionAssets(); } }), { method: 'GET', url: lessonUrl });
  assert.equal(full.statusCode, 200);
  assert.equal(summary.statusCode, 200);

  const region = fallbackRegion(full.body);
  const markdown = fs.readFileSync(path.join(ROOT, PERCEPTRON, 'docs', 'en.md'), 'utf8');
  const body = parseMd(markdown).replace(/<h1 id="[^"]*">[\s\S]*?<\/h1>/, '<h1>The Perceptron</h1>');
  assert.ok(region.includes(body), 'the server HTML holds the whole rendered lesson');
  assert.equal((region.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(region, /<h1>The Perceptron<\/h1>/);
  assert.match(region, /<h2 id="the-concept" class="">The Concept<\/h2>/);
  assert.match(region, /<h3 id="the-xor-problem">The XOR Problem<\/h3>/);
  assert.match(region, /<pre><span class="code-lang">python<\/span>[\s\S]*?<span class="syn-keyword">class<\/span> Perceptron:/);
  assert.match(region, /XOR was unsolvable by single-layer networks/);
  assert.match(region, /class="lesson-nav-btn next"/);
  assert.ok(visibleWords(region) > 1500, 'full lesson text');
  assert.ok(visibleWords(region) > 5 * visibleWords(fallbackRegion(summary.body)), 'much longer than the summary fallback');
  assert.deepEqual(JSON.parse(embeddedMarkdown(full.body)), { path: PERCEPTRON, lang: 'en', markdown });
  assert.match(full.body, /<link rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/lesson\?path=phases%2F03-deep-learning-core%2F01-the-perceptron">/);
  assert.match(full.body, /"@type":"LearningResource"/);
});

test('lesson route keeps the summary fallback when Markdown is unreadable', function () {
  const reads = [];
  const unreadable = invoke(lessonApi.createHandler({ loadAssets: function () {
    return productionAssets(function (lessonPath) {
      reads.push(lessonPath);
      throw new Error('ENOENT');
    });
  } }), { method: 'GET', url: '/lesson?path=' + encodeURIComponent(PERCEPTRON) });
  const summary = invoke(lessonApi.createHandler({ loadAssets: function () { return productionAssets(); } }), {
    method: 'GET',
    url: '/lesson?path=' + encodeURIComponent(PERCEPTRON),
  });
  assert.deepEqual(reads, [PERCEPTRON]);
  assert.equal(unreadable.statusCode, 200);
  assert.equal(unreadable.body, summary.body);
  assert.equal(embeddedMarkdown(unreadable.body), null);
  assert.match(fallbackRegion(unreadable.body), /<p class="motto">/);

  const english = invoke(lessonApi, { method: 'GET', url: '/lesson?path=' + encodeURIComponent(PERCEPTRON) + '&lang=en' });
  assert.equal(english.statusCode, 200);
  assert.ok(embeddedMarkdown(english.body));
});

test('lesson route never reads Markdown for paths outside the manifest', function () {
  const assets = makeAssets();
  const reads = [];
  assets.lesson.readMarkdown = function (lessonPath) {
    reads.push(lessonPath);
    return '# Vectors\n';
  };
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  for (const lessonPath of ['phases/01-math/99-missing', '../site/lesson', 'phases/01-math/01-vectors/../../02-x', 'certifications/claude/lessons/99-missing']) {
    const response = invoke(handler, { method: 'GET', query: { path: lessonPath } });
    assert.equal(response.statusCode, 404, lessonPath);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.body, /<meta name="robots" content="noindex">/);
    assert.match(response.body, /href="\/sitemap\.xml"/);
  }
  assert.deepEqual(reads, []);

  const production = invoke(lessonApi, { method: 'GET', url: '/lesson?path=phases%2F03-deep-learning-core%2F99-not-a-lesson' });
  assert.equal(production.statusCode, 404);
  assert.equal(production.headers['cache-control'], 'no-store');
  assert.doesNotMatch(production.body, /lessonMarkdown/);
});

test('embedded lesson Markdown cannot close its script tag', function () {
  const assets = makeAssets();
  const markdown = [
    '# Vectors',
    '',
    '> A </script><script>alert(1)</script> motto with <!-- a comment --> and ]]> and \u2028 inside.',
    '',
    '## Build It',
    '',
    '```html',
    '</script><img src=x onerror=alert(2)>',
    '```',
    '',
  ].join('\n');
  assets.lesson.readMarkdown = function () { return markdown; };
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, { method: 'GET', url: '/lesson?path=phases%2F01-math%2F01-vectors' });
  assert.equal(response.statusCode, 200);

  const embedded = embeddedMarkdown(response.body);
  assert.ok(embedded);
  assert.doesNotMatch(embedded, /[<>]/);
  assert.deepEqual(JSON.parse(embedded), { path: 'phases/01-math/01-vectors', lang: 'en', markdown });
  assert.equal((response.body.match(/<script\b/g) || []).length, 2);
  assert.doesNotMatch(fallbackRegion(response.body), /<script>alert|<img src=x/);
  assert.match(fallbackRegion(response.body), /&lt;\/script&gt;&lt;img src=x onerror=alert\(2\)&gt;/);
  assert.match(fallbackRegion(response.body), /<h1>Vectors &amp; &lt;Matrices&gt; - Math Foundations<\/h1>/);
});

test('certification lessons render the body and disclaimer without a duplicate Markdown payload', function () {
  const assets = makeAssets();
  const lessonPath = 'certifications/claude/lessons/01-models';
  assets.lesson.manifest.lessons[lessonPath].context.disclaimer = 'Independent preparation that is not affiliated with the exam provider.';
  assets.lesson.readMarkdown = function (requested) {
    assert.equal(requested, lessonPath);
    return '# Model Decisions\n\n> Choose models from evidence.\n\n## Practice Lab\n\nScore three options.\n';
  };
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, { method: 'GET', query: { path: lessonPath, track: 'claude-example' } });
  const region = fallbackRegion(response.body);
  assert.equal(response.statusCode, 200);
  assert.match(region, /<aside class="cert-notice lesson-cert-notice"[^>]*><strong>Independent preparation<\/strong><p>Independent preparation that is not affiliated with the exam provider\.<\/p><\/aside>/);
  assert.match(region, /<h2 id="practice-lab" class="">Practice Lab<\/h2>/);
  assert.match(region, /path=certifications%2Fclaude%2Flessons%2F02-tools&amp;track=claude-example/);
  assert.equal(embeddedMarkdown(response.body), null);
});

test('lesson template renders through the shared Markdown module', function () {
  const template = fs.readFileSync(path.join(ROOT, 'site', 'lesson.html'), 'utf8');
  const moduleTag = template.indexOf('<script src="lesson-markdown.js?v=');
  assert.ok(moduleTag > 0);
  assert.ok(moduleTag < template.indexOf('window.AIFSLessonMarkdown.parseMd(md)'));
  assert.doesNotMatch(template, /function (?:parseMd|inlineFormat|highlightSyntax|renderCodeBlock|splitTableRow)\(/);
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const included = config.functions['api/lesson.js'].includeFiles;
  for (const pattern of ['site/lesson-markdown.js', 'phases/*/*/docs/en.md', 'certifications/*/lessons/*/docs/en.md']) {
    assert.ok(included.includes(pattern), pattern);
  }
});

test('shared Markdown renderer escapes text exactly like the DOM serializer', function () {
  const html = parseMd('```mermaid\nA["x & y"] --> B[\'<b>\u00a0\']\n```\n');
  assert.equal(html, '<div class="mermaid-container"><div class="mermaid-block" data-mermaid-index="1"><div class="mermaid-toolbar">'
    + '<button type="button" class="mermaid-btn mermaid-expand" data-mermaid-index="1">Expand</button></div>'
    + '<pre class="mermaid mermaid-source" id="mermaid-1">A["x &amp; y"] --&gt; B[\'&lt;b&gt;&nbsp;\']</pre>'
    + '<div class="mermaid-render" id="mermaid-render-1"></div></div></div>');
});

test('sitemap lists ready manuals at their canonical URLs and every ready project', function (t) {
  const sitemap = fs.readFileSync(path.join(ROOT, 'site', 'sitemap.xml'), 'utf8');
  const locs = new Set(Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), function (match) { return match[1].replace(/&amp;/g, '&'); }));

  const ready = manuals.loadAll().filter(function (manual) { return manual.status === 'ready'; });
  assert.ok(ready.length > 0);
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-sitemap-manuals-'));
  t.after(function () { fs.rmSync(site, { recursive: true, force: true }); });
  manuals.writeWeb(ready, site);
  for (const page of ['manuals.html'].concat(ready.map(function (manual) { return `manual-${manual.id}.html`; }))) {
    const canonical = fs.readFileSync(path.join(site, page), 'utf8').match(/<link rel="canonical" href="([^"]+)">/)[1];
    assert.ok(locs.has(canonical), canonical);
  }

  const projectIds = buildProjectData().projects.map(function (project) { return project.id; }).sort();
  const sitemapProjects = Array.from(locs)
    .filter(function (loc) { return loc.startsWith('https://aiengineeringfromscratch.com/project?id='); })
    .map(function (loc) { return decodeURIComponent(loc.split('=')[1]); })
    .sort();
  assert.ok(projectIds.length > 0);
  assert.deepEqual(sitemapProjects, projectIds);
  assert.doesNotMatch(sitemap, /<lastmod>/);
  assert.doesNotMatch(sitemap, /project\.html\?id=/);
});

test('certification route renders a crawlable track with an id-only canonical', function () {
  const assets = makeAssets();
  const handler = certificationApi.createHandler({ loadAssets: function () { return assets.certification; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/certification?id=claude-example',
    query: { id: 'claude-example' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['cache-control'], /s-maxage=86400/);
  assert.match(response.body, /rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/certification\?id=claude-example"/);
  assert.doesNotMatch(response.body, /canonical"[^>]+result=/);
  assert.equal((response.body.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(response.body, /"@type":"Course"/);
  assert.match(response.body, /"@type":"CollectionPage"/);
  assert.match(response.body, /path=certifications%2Fclaude%2Flessons%2F01-models&amp;track=claude-example/);
  assert.match(response.body, /path=phases%2F14-agent-engineering%2F01-the-agent-loop&amp;fromTrack=claude-example/);
});

test('certification route links a second program\'s own lessons in track context', function () {
  const assets = withSecondProgram(makeAssets());
  const handler = certificationApi.createHandler({ loadAssets: function () { return assets.certification; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/certification?id=mcpa-example',
    query: { id: 'mcpa-example' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /path=certifications%2Fmcpa%2Flessons%2F01-discovery&amp;track=mcpa-example/);
  assert.match(response.body, /path=phases%2F13-tools-and-protocols%2F06-mcp-fundamentals&amp;fromTrack=mcpa-example/);
});

test('certification route strips unknown query parameters before serving cached HTML', function () {
  const assets = makeAssets();
  const handler = certificationApi.createHandler({ loadAssets: function () { return assets.certification; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/certification?id=claude-example&result=latest&utm_source=random',
    query: { id: 'claude-example', result: 'latest', utm_source: 'random' },
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, '/certification?id=claude-example');
  assert.equal(response.body, '');
});

test('certification route redirects legacy and alias URLs to the canonical ID', function () {
  const assets = makeAssets();
  const handler = certificationApi.createHandler({ loadAssets: function () { return assets.certification; } });
  const alias = invoke(handler, { method: 'GET', query: { id: 'EXAMPLE' } });
  const track = invoke(handler, { method: 'GET', query: { track: 'example' } });
  const legacy = invoke(handler, { method: 'GET', query: { legacy: '1', id: 'claude-example' } });

  [alias, track, legacy].forEach(function (response) {
    assert.equal(response.statusCode, 308);
    assert.equal(response.headers.location, '/certification?id=claude-example');
    assert.equal(response.body, '');
  });
});

test('certification route returns recoverable 404s and rejects unsupported methods', function () {
  const assets = makeAssets();
  const handler = certificationApi.createHandler({ loadAssets: function () { return assets.certification; } });
  const missing = invoke(handler, { method: 'GET', query: { id: 'missing-track' } });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.headers['cache-control'], 'no-store');
  assert.match(missing.body, /href="\/certifications\.html"/);

  const traversal = invoke(handler, { method: 'GET', query: { id: '../secret' } });
  assert.equal(traversal.statusCode, 404);

  const post = invoke(handler, { method: 'PATCH', query: { id: 'claude-example' } });
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('certification route fails closed and reloads injected fixture assets', function () {
  const assets = makeAssets();
  let loadCount = 0;
  const handler = certificationApi.createHandler({
    loadAssets: function () {
      loadCount += 1;
      return assets.certification;
    },
  });
  const initial = invoke(handler, { method: 'GET', query: { id: 'claude-example' } });
  assert.equal(initial.statusCode, 200);

  assets.certification.template = '<!DOCTYPE html><html><body>marker missing</body></html>';
  const broken = invoke(handler, { method: 'GET', query: { id: 'claude-example' } });
  assert.equal(broken.statusCode, 500);
  assert.equal(broken.headers['cache-control'], 'no-store');
  assert.equal(loadCount, 2);
});

test('deployment routes extensionless pages through handlers and redirects legacy HTML URLs', function () {
  const repoRoot = path.join(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
  const rewrites = new Map(config.rewrites.map(function (rule) { return [rule.source, rule.destination]; }));
  const routes = new Map(config.routes.map(function (rule) { return [rule.src, rule]; }));
  assert.equal(rewrites.get('/lesson'), '/api/lesson');
  assert.equal(rewrites.get('/certification'), '/api/certification');
  assert.deepEqual(routes.get('/lesson\\.html'), {
    src: '/lesson\\.html',
    methods: ['GET', 'HEAD'],
    dest: '/api/lesson?legacy=1',
  });
  assert.deepEqual(routes.get('/certification\\.html'), {
    src: '/certification\\.html',
    methods: ['GET', 'HEAD'],
    dest: '/api/certification?legacy=1',
  });

  const lessonTemplate = fs.readFileSync(path.join(repoRoot, 'site', 'lesson.html'), 'utf8');
  const certificationTemplate = fs.readFileSync(path.join(repoRoot, 'site', 'certification.html'), 'utf8');
  const certificationsScript = fs.readFileSync(path.join(repoRoot, 'site', 'certifications.js'), 'utf8');
  assert.equal((lessonTemplate.match(/AIFS:LESSON-SEO:START/g) || []).length, 1);
  assert.equal((lessonTemplate.match(/AIFS:LESSON-FALLBACK:START/g) || []).length, 1);
  assert.equal((certificationTemplate.match(/AIFS:CERTIFICATION-SEO:START/g) || []).length, 1);
  assert.equal((certificationTemplate.match(/AIFS:CERTIFICATION-FALLBACK:START/g) || []).length, 1);
  assert.doesNotMatch(lessonTemplate, /lesson\.html\?path=/);
  assert.doesNotMatch(certificationsScript, /lesson\.html\?path=|certification\.html\?id=/);
  assert.match(certificationsScript, /aiengineeringfromscratch\.com\/certification\?id=/);
});

test('site runtime sources use canonical lesson and certification routes', function () {
  const repoRoot = path.join(__dirname, '..');
  [
    'site/index.html',
    'site/app.js',
    'site/header.js',
    'site/cmdpalette.js',
    'site/lesson.html',
    'site/catalog.html',
    'site/glossary.html',
    'site/roadmap.js',
    'site/certifications.html',
    'site/certifications.js',
    'site/learning-paths.html',
  ].forEach(function (relativePath) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /lesson\.html\?path=|certification\.html\?id=/, relativePath);
  });
});

test('GitHub source links use immutable preview revisions and main in production', function () {
  const build = require('../site/build.js');
  const names = [
    'VERCEL_ENV',
    'VERCEL_GIT_COMMIT_REF',
    'VERCEL_GIT_COMMIT_SHA',
    'VERCEL_GIT_REPO_OWNER',
    'VERCEL_GIT_REPO_SLUG',
  ];
  const previous = Object.fromEntries(names.map(function (name) { return [name, process.env[name]]; }));

  try {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'feat/source-links';
    process.env.VERCEL_GIT_COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
    process.env.VERCEL_GIT_REPO_OWNER = 'preview-owner';
    process.env.VERCEL_GIT_REPO_SLUG = 'preview-repo';
    assert.equal(
      build.githubSourceUrl('phases/14-agent-engineering/47-outcomes-before-output'),
      'https://github.com/preview-owner/preview-repo/tree/0123456789abcdef0123456789abcdef01234567/phases/14-agent-engineering/47-outcomes-before-output'
    );

    process.env.VERCEL_GIT_COMMIT_SHA = '';
    assert.equal(
      build.githubSourceUrl('phases/14-agent-engineering/47-outcomes-before-output'),
      'https://github.com/preview-owner/preview-repo/tree/feat/source-links/phases/14-agent-engineering/47-outcomes-before-output'
    );
    process.env.VERCEL_GIT_COMMIT_REF = 'feat/source+links';
    assert.equal(
      build.githubSourceUrl('phases/14-agent-engineering/47-outcomes-before-output'),
      'https://github.com/preview-owner/preview-repo/tree/feat/source%2Blinks/phases/14-agent-engineering/47-outcomes-before-output'
    );

    process.env.VERCEL_ENV = 'production';
    assert.equal(
      build.githubSourceUrl('certifications/claude/tracks/example.json', 'blob'),
      'https://github.com/preview-owner/preview-repo/blob/main/certifications/claude/tracks/example.json'
    );

    delete process.env.VERCEL_ENV;
    process.env.VERCEL_GIT_COMMIT_REF = 'local-unpushed-branch';
    assert.equal(
      build.githubSourceUrl('phases/01-math/01-vectors'),
      'https://github.com/preview-owner/preview-repo/tree/main/phases/01-math/01-vectors'
    );
  } finally {
    names.forEach(function (name) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    });
  }
});

test('server and browser source links honor generated repository identity', function () {
  const assets = makeAssets();
  assets.lesson.manifest.lessons['phases/01-math/01-vectors'].sourceUrl =
    'https://github.com/preview-owner/preview-repo/tree/0123456789abcdef/phases/01-math/01-vectors';
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const response = invoke(handler, {
    method: 'GET',
    url: '/lesson?path=phases%2F01-math%2F01-vectors',
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /https:\/\/github\.com\/preview-owner\/preview-repo\/tree\/0123456789abcdef/);

  const repoRoot = path.join(__dirname, '..');
  const buildMeta = fs.readFileSync(path.join(repoRoot, 'site', 'build-meta.js'), 'utf8');
  const contentSource = fs.readFileSync(path.join(repoRoot, 'site', 'content-source.js'), 'utf8');
  const lessonTemplate = fs.readFileSync(path.join(repoRoot, 'site', 'lesson.html'), 'utf8');
  assert.match(buildMeta, /__AIFS_SOURCE/);
  assert.match(contentSource, /__AIFS_SOURCE/);
  assert.match(lessonTemplate, /SOURCE_OWNER/);
  assert.doesNotMatch(lessonTemplate, /api\.github\.com\/repos\/rohitg00\/ai-engineering-from-scratch\/contents/);
});

const HINDI = [
  '# पर्सेप्ट्रोन',
  '',
  '> पर्सेप्ट्रॉन तंत्रिका नेटवर्क का परमाणु है। इसे खोलें और आपको भार, एक पूर्वाग्रह और एक निर्णय मिलता है।',
  '',
  '## अवधारणा',
  '',
  'एक न्यूरॉन एक निर्णय लेता है। भार और पूर्वाग्रह मिलकर एक रेखा बनाते हैं जो इनपुट को दो भागों में बांटती है।',
  '',
  '```python',
  'class Perceptron:',
  '    pass',
  '```',
  '',
].join('\n');
const ARABIC = '# البيرسبترون\n\n> البيرسبترون هو ذرة الشبكات العصبية.\n\n## المفهوم\n\nخلية عصبية واحدة تتخذ قرارا واحدا.\n';

function withTranslations(list) {
  const assets = lessonApi.loadProductionAssets();
  const entry = Object.assign({}, assets.manifest.lessons[PERCEPTRON], { translations: list });
  const lessons = Object.assign({}, assets.manifest.lessons, { [PERCEPTRON]: entry });
  return Object.assign({}, assets, { manifest: Object.assign({}, assets.manifest, { lessons }) });
}

function alternateLinks(html) {
  return Array.from(html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g), function (match) {
    return [match[1], match[2].replace(/&amp;/g, '&')];
  });
}

const PERCEPTRON_URL = 'https://aiengineeringfromscratch.com/lesson?path=phases%2F03-deep-learning-core%2F01-the-perceptron';

test('translated lesson pages render the translation with a self canonical, hreflang, lang, and dir', async function () {
  const reads = [];
  const handler = lessonApi.createHandler({
    loadAssets: function () { return withTranslations(['hi', 'ar']); },
    readTranslation: function (lang, lessonPath) {
      reads.push(`${lang}:${lessonPath}`);
      return Promise.resolve(lang === 'ar' ? ARABIC : HINDI);
    },
  });
  const hindi = await invokeAsync(handler, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=hi` });
  assert.equal(hindi.statusCode, 200);
  assert.match(hindi.body, /<html lang="hi" dir="ltr" data-theme="light">/);
  assert.match(hindi.body, /<link rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/lesson\?path=phases%2F03-deep-learning-core%2F01-the-perceptron&amp;lang=hi">/);
  assert.match(hindi.body, /<meta property="og:url" content="[^"]+&amp;lang=hi">/);
  assert.match(hindi.body, /<meta property="og:locale" content="hi_IN">/);
  assert.match(hindi.body, /<title>पर्सेप्ट्रोन \| AI Engineering from Scratch<\/title>/);
  assert.match(hindi.body, /<meta name="description" content="पर्सेप्ट्रोन: पर्सेप्ट्रॉन तंत्रिका नेटवर्क का परमाणु है।/);
  assert.deepEqual(alternateLinks(hindi.body), [
    ['en', PERCEPTRON_URL],
    ['x-default', PERCEPTRON_URL],
    ['hi', PERCEPTRON_URL + '&lang=hi'],
    ['ar', PERCEPTRON_URL + '&lang=ar'],
  ]);
  const jsonLd = JSON.parse(hindi.body.match(/<script type="application\/ld\+json" id="lessonJsonLd">([\s\S]*?)<\/script>/)[1]);
  assert.equal(jsonLd['@graph'][0].inLanguage, 'hi');
  assert.equal(jsonLd['@graph'][0].translationOfWork.url, PERCEPTRON_URL);
  const region = fallbackRegion(hindi.body);
  assert.equal((region.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(region, /<h1>पर्सेप्ट्रोन<\/h1>/);
  assert.match(region, /<h2 id="[^"]*" class="">अवधारणा<\/h2>/);
  assert.match(region, /<a href="\/lesson\?path=phases%2F03-deep-learning-core%2F01-the-perceptron&amp;lang=hi" hreflang="hi" lang="hi" aria-current="page">हिन्दी<\/a>/);
  assert.match(region, /<a href="\/lesson\?path=phases%2F03-deep-learning-core%2F01-the-perceptron" hreflang="en" lang="en">English<\/a>/);
  assert.doesNotMatch(region, /XOR was unsolvable/);
  assert.deepEqual(JSON.parse(embeddedMarkdown(hindi.body)), { path: PERCEPTRON, lang: 'hi', markdown: HINDI });
  assert.equal(hindi.headers['cache-control'], 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  assert.equal(hindi.headers['content-language'], 'hi');
  assert.equal(hindi.headers.vary, 'Accept, Accept-Encoding');

  const arabic = await invokeAsync(handler, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=ar` });
  assert.match(arabic.body, /<html lang="ar" dir="rtl" data-theme="light">/);
  assert.match(arabic.body, /<meta property="og:locale" content="ar_AR">/);
  assert.match(fallbackRegion(arabic.body), /<h1>البيرسبترون<\/h1>/);
  assert.deepEqual(reads, [`hi:${PERCEPTRON}`, `ar:${PERCEPTRON}`]);
});

test('translated lesson URLs fall back to the English page and canonical', async function () {
  const english = lessonApi.loadProductionAssets().readMarkdown(PERCEPTRON);
  for (const reader of [
    function () { return Promise.resolve(null); },
    function () { return Promise.resolve(english); },
    function () { return Promise.reject(new Error('network')); },
  ]) {
    const handler = lessonApi.createHandler({ loadAssets: function () { return withTranslations(['hi']); }, readTranslation: reader });
    const response = await invokeAsync(handler, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=hi` });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="en" data-theme="light">/);
    assert.ok(response.body.includes(`<link rel="canonical" href="${PERCEPTRON_URL}">`));
    assert.equal(response.headers['cache-control'], 'public, max-age=0, s-maxage=300, must-revalidate');
    assert.equal(response.headers['content-language'], 'en');
    assert.equal(JSON.parse(embeddedMarkdown(response.body)).lang, 'en');
    assert.match(fallbackRegion(response.body), /XOR was unsolvable/);
  }

  const reads = [];
  const uncovered = lessonApi.createHandler({
    loadAssets: function () { return withTranslations(['hi']); },
    readTranslation: function (lang) { reads.push(lang); return Promise.resolve(HINDI); },
  });
  const french = await invokeAsync(uncovered, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=fr` });
  assert.equal(french.statusCode, 200);
  assert.deepEqual(reads, []);
  assert.match(french.body, /<html lang="en" data-theme="light">/);
  assert.equal(french.headers['cache-control'], 'public, max-age=0, s-maxage=86400, must-revalidate');
});

test('lesson URLs return Markdown when Accept prefers text/markdown', async function () {
  const english = lessonApi.loadProductionAssets().readMarkdown(PERCEPTRON);
  const handler = lessonApi.createHandler({
    loadAssets: function () { return withTranslations(['hi']); },
    readTranslation: function () { return Promise.resolve(HINDI); },
  });
  const url = `/lesson?path=${encodeURIComponent(PERCEPTRON)}`;
  const markdown = invoke(handler, { method: 'GET', url, headers: { accept: 'text/markdown, text/html;q=0.8' } });
  assert.equal(markdown.statusCode, 200);
  assert.equal(markdown.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(markdown.headers.vary, 'Accept, Accept-Encoding');
  assert.equal(markdown.body, english);

  const translated = await invokeAsync(handler, { method: 'GET', url: url + '&lang=hi', headers: { accept: 'text/markdown' } });
  assert.equal(translated.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(translated.headers['content-language'], 'hi');
  assert.equal(translated.body, HINDI);

  const html = invoke(handler, { method: 'GET', url, headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } });
  assert.match(html.headers['content-type'], /^text\/html/);
});

test('hreflang alternates appear only on course lessons, never on English-only pages', function () {
  const assets = makeAssets();
  const handler = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const course = invoke(handler, { method: 'GET', query: { path: 'phases/01-math/01-vectors' } });
  assert.deepEqual(alternateLinks(course.body).map(function (link) { return link[0]; }), ['en', 'x-default']);
  assert.doesNotMatch(course.body, /class="lesson-languages"/);
  const certification = invoke(handler, { method: 'GET', query: { path: 'certifications/claude/lessons/01-models' } });
  assert.deepEqual(alternateLinks(certification.body), []);
  assert.match(certification.body, /<meta property="og:locale" content="en_US">/);
  for (const name of fs.readdirSync(path.join(ROOT, 'site')).filter(function (file) { return file.endsWith('.html'); })) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'site', name), 'utf8'), /<link[^>]+hreflang=/, name);
  }
});

test('translation reader builds allowlisted URLs, caps size, and caches results', async function () {
  assert.equal(translations.translationUrl('hi', PERCEPTRON), `${translations.TRANSLATION_SOURCE}/hi/${PERCEPTRON}/docs/hi.md`);
  for (const [lang, lessonPath] of [['de', PERCEPTRON], ['../hi', PERCEPTRON], ['hi', `${PERCEPTRON}/../../x`], ['hi', 'certifications/claude/lessons/01-models'], ['hi', 'phases/03-a/b?x=1'], ['hi', 'https://example.com/x'], [['hi'], PERCEPTRON]]) {
    assert.throws(function () { translations.translationUrl(lang, lessonPath); }, /invalid-translation-request/);
  }

  let time = 0;
  const calls = [];
  function reader(body, options) {
    return translations.createTranslationReader(Object.assign({
      now: function () { return time; },
      fetchImpl: function (url, init) {
        calls.push({ url, init });
        return Promise.resolve(typeof body === 'function' ? body() : new Response(body, { status: 200 }));
      },
    }, options));
  }
  const read = reader(HINDI);
  assert.equal(await read('hi', PERCEPTRON), HINDI);
  assert.equal(await read('hi', PERCEPTRON), HINDI);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, translations.translationUrl('hi', PERCEPTRON));
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(calls[0].init.signal instanceof AbortSignal);

  assert.equal(await reader('# ' + 'x'.repeat(100), { maxBytes: 20 })('hi', PERCEPTRON), null);
  assert.equal(await reader(function () { return new Response(HINDI, { headers: { 'content-length': '999999' } }); }, { maxBytes: 1000 })('hi', PERCEPTRON), null);
  assert.equal(await reader('no heading here')('hi', PERCEPTRON), null);
  calls.length = 0;
  const missing = reader(function () { return new Response('', { status: 404 }); });
  assert.equal(await missing('ar', PERCEPTRON), null);
  assert.equal(await missing('ar', PERCEPTRON), null);
  assert.equal(calls.length, 1);
  time += 61 * 1000;
  assert.equal(await missing('ar', PERCEPTRON), null);
  assert.equal(calls.length, 2);
  const failing = translations.createTranslationReader({ fetchImpl: function () { return Promise.reject(new Error('timeout')); } });
  assert.equal(await failing('hi', PERCEPTRON), null);

  let healthy = true;
  const flaky = translations.createTranslationReader({
    now: function () { return time; },
    fetchImpl: function () { return Promise.resolve(healthy ? new Response(HINDI) : new Response('', { status: 502 })); },
  });
  assert.equal(await flaky('hi', PERCEPTRON), HINDI);
  healthy = false;
  time += 11 * 60 * 1000;
  assert.equal(await flaky('hi', PERCEPTRON), HINDI, 'keeps the last good translation when a refresh fails');
  assert.equal(translations.translationSourceUrl('hi', PERCEPTRON), `https://github.com/rohitg00/ai-engineering-from-scratch/blob/translations/i18n/hi/${PERCEPTRON}/docs/hi.md`);
  assert.equal(translations.lessonUrl(PERCEPTRON, 'pt-BR'), PERCEPTRON_URL + '&lang=pt-BR');
  assert.equal(translations.lessonUrl(PERCEPTRON, 'en'), PERCEPTRON_URL);
});

test('translation coverage comes from translation records and never fails the build', async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-coverage-'));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const attempts = {};
  const coverage = await collectCoverage({
    languages: ['hi', 'ar', 'es'],
    phases: ['01-a', '02-b'],
    fetchImpl: function (url) {
      attempts[url] = (attempts[url] || 0) + 1;
      if (url.endsWith('/ar/.cache/02-b.json')) return Promise.reject(new Error('fetch failed'));
      if (url.endsWith('/hi/.cache/02-b.json') && attempts[url] === 1) return Promise.resolve(new Response('', { status: 503 }));
      if (url.includes('/es/')) return Promise.resolve(new Response('', { status: 404 }));
      if (url.endsWith('/.cache/01-a.json')) {
        return Promise.resolve(Response.json({
          'phases/01-a/01-x/docs/en.md': 'hash',
          'phases/01-a/02-y/docs/en.md': 'hash',
          'phases/02-b/09-z/docs/en.md': 'listed in the wrong phase file',
          '../escape/docs/en.md': 'hash',
        }));
      }
      return Promise.resolve(Response.json({ 'phases/02-b/01-w/docs/en.md': 'hash' }));
    },
  });
  assert.deepEqual(coverage.languages, {
    hi: ['phases/01-a/01-x', 'phases/01-a/02-y', 'phases/02-b/01-w'],
    ar: ['phases/01-a/01-x', 'phases/01-a/02-y'],
  });
  assert.deepEqual(Object.keys(coverage.unavailable), ['ar']);
  assert.match(coverage.unavailable.ar, /fetch failed/);
  assert.equal(attempts[`${translations.TRANSLATION_SOURCE}/hi/.cache/02-b.json`], 2);
  assert.equal(attempts[`${translations.TRANSLATION_SOURCE}/ar/.cache/02-b.json`], 2);

  const manifest = { lessons: {
    'phases/01-a/01-x': { path: 'phases/01-a/01-x', context: { kind: 'course' } },
    'phases/01-a/02-y': { path: 'phases/01-a/02-y', context: { kind: 'course' } },
    'certifications/c/lessons/01-z': { path: 'certifications/c/lessons/01-z', context: { kind: 'certification' } },
  } };
  build.annotateTranslations(manifest, { hi: ['phases/01-a/01-x'], ar: ['phases/01-a/01-x'], de: ['phases/01-a/01-x'], fr: 'not a list' });
  assert.deepEqual(manifest.lessons['phases/01-a/01-x'].translations, ['hi', 'ar']);
  assert.deepEqual(manifest.lessons['phases/01-a/02-y'].translations, []);
  assert.equal(manifest.lessons['certifications/c/lessons/01-z'].translations, undefined);

  const site = path.join(root, 'site');
  fs.mkdirSync(site);
  fs.writeFileSync(path.join(site, 'sitemap-lessons-fa.xml'), 'stale');
  assert.deepEqual(build.writeLanguageSitemaps(manifest, site), ['sitemap-lessons-hi.xml', 'sitemap-lessons-ar.xml']);
  assert.equal(fs.existsSync(path.join(site, 'sitemap-lessons-fa.xml')), false);
  assert.match(fs.readFileSync(path.join(site, 'sitemap-lessons-hi.xml'), 'utf8'), /<loc>https:\/\/aiengineeringfromscratch\.com\/lesson\?path=phases%2F01-a%2F01-x&amp;lang=hi<\/loc>/);
  const index = fs.readFileSync(path.join(site, 'sitemap-index.xml'), 'utf8');
  assert.deepEqual(Array.from(index.matchAll(/<loc>([^<]+)<\/loc>/g), function (match) { return match[1]; }), [
    'https://aiengineeringfromscratch.com/sitemap.xml',
    'https://aiengineeringfromscratch.com/sitemap-lessons-hi.xml',
    'https://aiengineeringfromscratch.com/sitemap-lessons-ar.xml',
  ]);

  build.annotateTranslations(manifest, {});
  assert.deepEqual(build.writeLanguageSitemaps(manifest, site), []);
  assert.deepEqual(fs.readdirSync(site).sort(), ['sitemap-index.xml']);
  assert.match(fs.readFileSync(path.join(site, 'sitemap-index.xml'), 'utf8'), /sitemap\.xml<\/loc>\n  <\/sitemap>\n<\/sitemapindex>/);
  assert.equal(build.translationLlms(manifest), '');
});

test('translation coverage check fails when records, published files, or the build disagree', function () {
  const set = function (list) { return new Set(list); };
  assert.deepEqual(compareCoverage({ hi: set(['phases/01-a/01-x']) }, { hi: set(['phases/01-a/01-x']) }), []);
  const problems = compareCoverage({ hi: set(['phases/01-a/01-x']) }, { hi: set(['phases/01-a/02-y']) });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /recorded as translated but its docs\/hi\.md is missing/);
  assert.match(problems[1], /no translation record/);
  assert.deepEqual(compareBuildCoverage({ hi: set(['phases/01-a/01-x']) }, { languages: { hi: ['phases/01-a/01-x'] } }), []);
  assert.match(compareBuildCoverage({ hi: set(['phases/01-a/01-x']) }, { languages: {} })[0], /hi: build coverage lists 0 lessons/);
});

test('llms.txt and the API docs state the translation languages and URL pattern', function () {
  const manifest = { lessons: { [PERCEPTRON]: { path: PERCEPTRON, context: { kind: 'course' }, translations: ['hi', 'ar'] } } };
  const section = build.translationLlms(manifest);
  assert.match(section, /in 2 languages: hi \(हिन्दी, 1 lessons\), ar \(العربية, 1 lessons\)/);
  assert.match(section, /\/lesson\?path=<lesson path>&lang=<code>/);
  assert.match(section, /\/api\/v1\/resource\?path=<lesson path>&lang=<code>/);
  assert.match(section, /translations\/i18n\/<code>\/<lesson path>\/docs\/<code>\.md/);
  const docs = fs.readFileSync(path.join(ROOT, 'site', 'developer.md'), 'utf8');
  const listed = docs.match(/besides English: ([^.]+)\./)[1].replace(/\s+/g, ' ').replace(', and ', ', ').split(', ');
  assert.deepEqual(listed, translations.TRANSLATION_LANGUAGES);
  const html = fs.readFileSync(path.join(ROOT, 'site', 'developer.html'), 'utf8');
  assert.deepEqual(html.match(/also published in ([^.]+) at/)[1].replace(', and ', ', ').split(', '), translations.TRANSLATION_LANGUAGES);
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'openapi.json'), 'utf8'));
  for (const route of ['/lesson', '/api/v1/resource']) {
    const lang = spec.paths[route].parameters.find(function (parameter) { return parameter.name === 'lang'; });
    assert.deepEqual(lang.schema.enum, ['en'].concat(translations.TRANSLATION_LANGUAGES), route);
  }
  assert.match(docs, /`\/lesson\?path=<lesson path>&lang=<code>`/);
  const robots = fs.readFileSync(path.join(ROOT, 'site', 'robots.txt'), 'utf8');
  assert.match(robots, /^Sitemap: https:\/\/aiengineeringfromscratch\.com\/sitemap-index\.xml$/m);
});

test('a language with index false stays out of hreflang and the lesson sitemaps, and its pages are noindex', async function (t) {
  const registry = require('../languages.json');
  const arabic = registry.languages.find(function (language) { return language.code === 'ar'; });
  const fresh = ['../lib/lesson-translations', '../api/lesson', '../site/build.js'].map(function (name) { return require.resolve(name); });
  const reload = function () { for (const file of fresh) delete require.cache[file]; };
  arabic.index = false;
  reload();
  t.after(function () { delete arabic.index; reload(); });
  assert.equal(require('../lib/lesson-translations').isIndexedLanguage('ar'), false);
  assert.equal(require('../lib/lesson-translations').isIndexedLanguage('hi'), true);

  const handler = require('../api/lesson').createHandler({
    loadAssets: function () { return withTranslations(['hi', 'ar']); },
    readTranslation: function (lang) { return Promise.resolve(lang === 'ar' ? ARABIC : HINDI); },
  });
  const hindi = await invokeAsync(handler, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=hi` });
  assert.deepEqual(alternateLinks(hindi.body).map(function (link) { return link[0]; }), ['en', 'x-default', 'hi']);
  assert.doesNotMatch(hindi.body, /<meta name="robots"/);
  const arabicPage = await invokeAsync(handler, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=ar` });
  assert.equal(arabicPage.statusCode, 200);
  assert.match(arabicPage.body, /<html lang="ar" dir="rtl"/);
  assert.match(arabicPage.body, /<meta name="robots" content="noindex">/);
  assert.match(fallbackRegion(arabicPage.body), /<h1>البيرسبترون<\/h1>/);

  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-unindexed-'));
  t.after(function () { fs.rmSync(site, { recursive: true, force: true }); });
  const isolatedBuild = require('../site/build.js');
  const manifest = { lessons: { 'phases/01-a/01-x': { path: 'phases/01-a/01-x', context: { kind: 'course' } } } };
  isolatedBuild.annotateTranslations(manifest, { hi: ['phases/01-a/01-x'], ar: ['phases/01-a/01-x'] });
  assert.deepEqual(manifest.lessons['phases/01-a/01-x'].translations, ['hi', 'ar']);
  assert.deepEqual(isolatedBuild.writeLanguageSitemaps(manifest, site), ['sitemap-lessons-hi.xml']);
});

/** Extract the first value of each named/property meta tag and decode HTML attribute entities. */
function metaTags(html) {
  const tags = {};
  for (const match of html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"\s*\/?>/g)) {
    if (!(match[1] in tags)) tags[match[1]] = match[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }
  return tags;
}

/** Invoke a synchronous card handler and capture its status, headers, and response body. */
function cardRequest(handler, url, method = 'GET', query) {
  const response = { statusCode: 200, headers: {}, body: undefined };
  const res = {
    setHeader(name, value) { response.headers[String(name).toLowerCase()] = String(value); },
    end(body) { response.body = body; },
  };
  Object.defineProperty(res, 'statusCode', {
    get() { return response.statusCode; },
    set(value) { response.statusCode = value; },
  });
  handler({ method, url, query }, res);
  return response;
}

/** Create lesson, track, and static-card manifests with a Hindi translation for route tests. */
function cardFixture() {
  const assets = makeAssets();
  const vectors = Object.assign({}, assets.lesson.manifest.lessons['phases/01-math/01-vectors'], { translations: ['hi'] });
  return {
    'lesson-seo.json': { lessons: Object.assign({}, assets.lesson.manifest.lessons, { 'phases/01-math/01-vectors': vectors }) },
    'certification-seo.json': assets.certification.manifest,
    'og-cards.json': { version: 1, cards: { 'page/about': ogCards.pageCard('about', {}) } },
  };
}

/** Strip the known production origin from a card URL for local handler requests. */
function withoutOrigin(url) {
  return url.slice(ogCards.ORIGIN.length);
}

test('social card route renders known cards only at their versioned URL', function () {
  const manifests = cardFixture();
  const rendered = [];
  const handler = ogApi.createHandler({
    manifest: function (name) { return manifests[name]; },
    render: function (spec) { rendered.push(spec.title); return Buffer.from(`png:${spec.title}`); },
  });
  const vectors = manifests['lesson-seo.json'].lessons['phases/01-math/01-vectors'];
  const lesson = ogCards.cardPath('lesson', vectors.path, ogCards.lessonCard(vectors));
  assert.match(lesson, /^\/og\/lesson\/phases\/01-math\/01-vectors\.png\?v=[0-9a-f]{12}$/);
  const response = cardRequest(handler, lesson);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'image/png');
  assert.equal(response.headers['cache-control'], 'public, max-age=31536000, s-maxage=31536000, immutable');
  assert.equal(String(response.body), 'png:Vectors & <Matrices>');
  const head = cardRequest(handler, lesson, 'HEAD');
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, undefined);
  assert.equal(head.headers['content-length'], response.headers['content-length']);

  const hindi = ogCards.cardPath('lesson', vectors.path, ogCards.lessonCard(vectors, 'hi'), 'hi');
  assert.match(hindi, /\?lang=hi&v=[0-9a-f]{12}$/);
  assert.notEqual(hindi.split('v=')[1], lesson.split('v=')[1]);
  assert.equal(cardRequest(handler, hindi).statusCode, 200);

  const track = manifests['certification-seo.json'].tracks['claude-example'];
  const trackUrl = ogCards.cardPath('track', 'claude-example', ogCards.trackCard(track));
  assert.equal(cardRequest(handler, trackUrl).statusCode, 200);
  const about = ogCards.cardPath('page', 'about', manifests['og-cards.json'].cards['page/about']);
  const routed = cardRequest(handler, `/api/og?type=page&id=about&v=${about.split('v=')[1]}`, 'GET', { type: 'page', id: 'about', v: about.split('v=')[1] });
  assert.equal(routed.statusCode, 200);
  assert.deepEqual(rendered, ['Vectors & <Matrices>', 'Vectors & <Matrices>', 'Example Architecture Track', 'About this curriculum']);

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const route = config.routes.find(function (rule) { return rule.dest === '/api/og?type=$1&id=$2'; });
  const pattern = new RegExp(`^${route.src}$`);
  assert.deepEqual(pattern.exec('/og/lesson/phases/01-math/01-vectors.png').slice(1), ['lesson', 'phases/01-math/01-vectors']);
  assert.equal(pattern.test('/og/lesson/../secret.png'), false);
  assert.deepEqual(route.methods, ['GET', 'HEAD']);
  for (const name of ['api/og.js', 'api/lesson.js', 'api/certification.js']) {
    assert.match(config.functions[name].includeFiles, /lib\/og-render\.js,lib\/og-fonts\/\*\.json/, name);
  }
  assert.match(config.functions['api/og.js'].includeFiles, /site\/og-cards\.json/);
});

test('social card route redirects stale URLs and refuses unknown or forged input', function () {
  const manifests = cardFixture();
  const rendered = [];
  const handler = ogApi.createHandler({
    manifest: function (name) { return manifests[name]; },
    render: function (spec) { rendered.push(spec.title); return Buffer.from('png'); },
  });
  const about = ogCards.cardPath('page', 'about', manifests['og-cards.json'].cards['page/about']);
  for (const stale of ['/og/page/about.png', '/og/page/about.png?v=0123456789ab', `${about}&title=Forged`, `${about.replace('?', '?lang=en&')}`]) {
    const response = cardRequest(handler, stale);
    assert.equal(response.statusCode, 307, stale);
    assert.equal(response.headers.location, about, stale);
    assert.equal(response.headers['cache-control'], 'public, max-age=0, s-maxage=300, must-revalidate');
  }
  for (const unknown of [
    '/og/page/missing.png', '/og/page/__proto__.png', '/og/page/constructor.png', '/og/evil/about.png',
    '/og/lesson/phases/01-math/99-missing.png', '/og/lesson/../../etc/passwd.png', '/og/track/missing.png',
    '/og/lesson/phases/01-math/01-vectors.png?lang=fr', '/og/lesson/phases/01-math/01-vectors.png?lang=%3Cscript%3E',
    '/og/page/about.png?lang=hi', '/og/project/about.png', '/og/page/ABOUT.png',
  ]) {
    const response = cardRequest(handler, unknown);
    assert.equal(response.statusCode, 404, unknown);
    assert.equal(response.headers['cache-control'], 'no-store', unknown);
    assert.equal(String(response.body), 'Card not found\n');
  }
  const post = cardRequest(handler, about, 'POST');
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.deepEqual(rendered, []);

  const broken = ogApi.createHandler({ manifest: function () { throw new Error('missing'); } });
  assert.equal(cardRequest(broken, about).statusCode, 500);
  const failing = ogApi.createHandler({ manifest: function (name) { return manifests[name]; }, render: function () { throw new Error('atlas'); } });
  assert.equal(cardRequest(failing, about).headers['cache-control'], 'no-store');
});

test('lesson and certification heads point at their own versioned cards', async function () {
  const assets = makeAssets();
  const lessons = lessonApi.createHandler({ loadAssets: function () { return assets.lesson; } });
  const english = metaTags(invoke(lessons, { method: 'GET', url: '/lesson?path=phases%2F01-math%2F01-vectors', query: { path: 'phases/01-math/01-vectors' } }).body);
  assert.match(english['og:image'], /^https:\/\/aiengineeringfromscratch\.com\/og\/lesson\/phases\/01-math\/01-vectors\.png\?v=[0-9a-f]{12}$/);
  assert.equal(english['twitter:image'], english['og:image']);
  assert.equal(english['og:image:width'], '1200');
  assert.equal(english['og:image:height'], '630');
  assert.equal(english['og:image:alt'], 'Vectors & <Matrices> - AI Engineering from Scratch');
  assert.equal(english['twitter:card'], 'summary_large_image');

  const translated = lessonApi.createHandler({
    loadAssets: function () { return withTranslations(['hi']); },
    readTranslation: function () { return Promise.resolve(HINDI); },
  });
  const hindi = metaTags((await invokeAsync(translated, { method: 'GET', url: `/lesson?path=${encodeURIComponent(PERCEPTRON)}&lang=hi` })).body);
  assert.match(hindi['og:image'], /\/og\/lesson\/phases\/03-deep-learning-core\/01-the-perceptron\.png\?lang=hi&v=[0-9a-f]{12}$/);
  assert.equal(hindi['twitter:image'], hindi['og:image']);

  const tracks = certificationApi.createHandler({ loadAssets: function () { return assets.certification; } });
  const track = metaTags(invoke(tracks, { method: 'GET', url: '/certification?id=claude-example', query: { id: 'claude-example' } }).body);
  assert.match(track['og:image'], /^https:\/\/aiengineeringfromscratch\.com\/og\/track\/claude-example\.png\?v=[0-9a-f]{12}$/);
  assert.equal(track['twitter:image'], track['og:image']);
});

test('every page type in the sitemap carries full social card tags that resolve to its own card', function (t) {
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'og-cards.json'), 'utf8')).cards;
  const og = ogApi.createHandler({ render: function () { return Buffer.from('png'); } });
  const lessons = lessonApi.createHandler();
  const tracks = certificationApi.createHandler();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-social-cards-'));
  t.after(function () { fs.rmSync(site, { recursive: true, force: true }); });
  manuals.writeWeb(manuals.loadAll().filter(function (manual) { return manual.status === 'ready'; }), site);
  const sitemap = fs.readFileSync(path.join(ROOT, 'site', 'sitemap.xml'), 'utf8');
  const seen = {};
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(match[1].replace(/&amp;/g, '&'));
    const name = url.pathname.slice(1).replace(/\.html$/, '') || 'index';
    let html;
    let card;
    if (name === 'lesson') {
      html = invoke(lessons, { method: 'GET', url: url.pathname + url.search }).body;
      card = `lesson/${url.searchParams.get('path')}`;
    } else if (name === 'certification') {
      html = invoke(tracks, { method: 'GET', url: url.pathname + url.search, query: { id: url.searchParams.get('id') } }).body;
      card = `track/${url.searchParams.get('id')}`;
    } else if (name.startsWith('manual')) {
      html = fs.readFileSync(path.join(site, `${name}.html`), 'utf8');
      card = name === 'manuals' ? 'page/manuals' : `manual/${name.slice('manual-'.length)}`;
    } else {
      html = fs.readFileSync(path.join(ROOT, 'site', `${name}.html`), 'utf8');
      card = `page/${name === 'index' ? 'home' : name}`;
    }
    const tags = metaTags(ogCards.stampCards(html, cards));
    assert.equal(tags['og:image'], tags['twitter:image'], url.href);
    assert.ok(tags['og:image'].startsWith(`${ogCards.ORIGIN}/og/${card}.png?`), `${url.href} uses ${tags['og:image']}`);
    assert.equal(tags['og:image:width'], '1200', url.href);
    assert.equal(tags['og:image:height'], '630', url.href);
    assert.ok(tags['og:image:alt'], url.href);
    assert.equal(tags['twitter:card'], 'summary_large_image', url.href);
    assert.equal(cardRequest(og, withoutOrigin(tags['og:image'])).statusCode, 200, tags['og:image']);
    const type = card.split('/')[0];
    seen[type] = (seen[type] || 0) + 1;
  }
  assert.deepEqual(Object.keys(seen).sort(), ['lesson', 'manual', 'page', 'track']);
});

test('the home card counts and page labels come from the build inventory', function () {
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'og-cards.json'), 'utf8')).cards;
  const phases = build.parseReadme(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'), build.parseRoadmap(fs.readFileSync(path.join(ROOT, 'ROADMAP.md'), 'utf8')));
  const artifacts = build.discoverArtifacts();
  const lessons = phases.reduce(function (total, phase) { return total + phase.lessons.length; }, 0);
  /** Count discovered build artifacts of a given kind for home-card inventory assertions. */
  const count = function (kind) { return artifacts.filter(function (artifact) { return artifact.kind === kind; }).length; };
  assert.deepEqual(cards['page/home'].stats, [`${lessons} lessons`, `${phases.length} phases`, `${count('skill')} skills`, `${count('prompt')} prompts`]);
  assert.equal(cards['page/catalog'].label, `Catalog · ${lessons} lessons`);
  const projects = buildProjectData().projects;
  assert.equal(cards['page/projects'].label, `Projects · ${projects.length} ready`);
  assert.deepEqual(Object.keys(cards).filter(function (key) { return key.startsWith('project/'); }).sort(), projects.map(function (project) { return `project/${project.id}`; }).sort());
});
