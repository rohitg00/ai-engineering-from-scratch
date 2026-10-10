const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const lessonApi = require('../api/lesson');
const certificationApi = require('../api/certification');
const { parseMd } = require('../site/lesson-markdown');
const manuals = require('../site/build-manuals.js');
const { buildData: buildProjectData } = require('../site/build-projects.js');

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

function invoke(handler, req) {
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
  handler(req, res);
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
  assert.deepEqual(JSON.parse(embeddedMarkdown(full.body)), { path: PERCEPTRON, markdown });
  assert.match(full.body, /<link rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/lesson\?path=phases%2F03-deep-learning-core%2F01-the-perceptron">/);
  assert.match(full.body, /"@type":"LearningResource"/);
});

test('lesson route keeps the summary fallback when Markdown is unreadable or a translation is requested', function () {
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

  const translatedReads = [];
  const translated = invoke(lessonApi.createHandler({ loadAssets: function () {
    return productionAssets(function (lessonPath) {
      translatedReads.push(lessonPath);
      return '# Never rendered\n';
    });
  } }), { method: 'GET', url: '/lesson?path=' + encodeURIComponent(PERCEPTRON) + '&lang=hi' });
  assert.equal(translated.statusCode, 200);
  assert.deepEqual(translatedReads, []);
  assert.equal(embeddedMarkdown(translated.body), null);

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
  assert.deepEqual(JSON.parse(embedded), { path: 'phases/01-math/01-vectors', markdown });
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
