const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const lessonApi = require('../api/lesson');
const certificationApi = require('../api/certification');

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
