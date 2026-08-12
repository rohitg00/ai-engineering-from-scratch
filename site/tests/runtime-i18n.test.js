'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const siteDir = path.join(__dirname, '..');
const repoRoot = path.join(siteDir, '..');

function loadContentSource(options = {}) {
  const requests = [];
  const window = {
    location: { hostname: options.hostname || 'example.com', href: 'https://example.com/lesson.html' },
    __AIFS_REPOSITORY: options.repository,
    __AIFS_BUILD_META: options.buildMeta,
  };
  if (Object.prototype.hasOwnProperty.call(options, 'ref') && options.ref !== undefined) {
    window.__AIFS_REF = options.ref;
  }
  const context = {
    window,
    URL,
    DOMParser: class {},
    fetch: options.fetch || (async (url) => {
      requests.push(String(url));
      throw new Error('unexpected fetch');
    }),
    isFinite,
    Promise,
    Error,
    Number,
    String,
  };
  vm.runInNewContext(fs.readFileSync(path.join(siteDir, 'content-source.js'), 'utf8'), context);
  return { source: window.AIFSContentSource, requests };
}

function response(ok, body, status = ok ? 200 : 404) {
  return {
    ok,
    status,
    text: async () => body,
  };
}

test('repository and translation URLs use configurable runtime metadata', () => {
  const { source } = loadContentSource({
    ref: 'feature/site-i18n',
    repository: { owner: 'example-fork', name: 'curriculum' },
  });

  assert.equal(
    source.rawRepoUrl('phases/01/docs/en.md'),
    'https://raw.githubusercontent.com/example-fork/curriculum/feature/site-i18n/phases/01/docs/en.md',
  );
  assert.equal(
    source.translationUrl('certifications/claude/lessons/01-intro', 'ru'),
    'https://raw.githubusercontent.com/example-fork/curriculum/feature/site-i18n/i18n/ru/certifications/claude/lessons/01-intro/docs/ru.md',
  );
  assert.equal(source.repository(), 'example-fork/curriculum');
  assert.equal(
    source.generatedTranslationUrl('certifications/claude/lessons/01-intro', 'ru'),
    'https://raw.githubusercontent.com/example-fork/curriculum/translations/i18n/ru/certifications/claude/lessons/01-intro/docs/ru.md',
  );
  assert.equal(
    source.repoTreeUrl('certifications/claude/lessons/01-intro'),
    'https://github.com/example-fork/curriculum/tree/feature/site-i18n/certifications/claude/lessons/01-intro',
  );
  assert.equal(
    source.contentsApiUrl('certifications/claude/lessons/01-intro/code'),
    'https://api.github.com/repos/example-fork/curriculum/contents/certifications/claude/lessons/01-intro/code?ref=feature%2Fsite-i18n',
  );
});

test('build metadata can configure repository and ref', () => {
  const { source } = loadContentSource({
    ref: undefined,
    buildMeta: { ref: 'preview', repository: 'another/course' },
  });
  assert.equal(source.rawRepoUrl('README.md'), 'https://raw.githubusercontent.com/another/course/preview/README.md');
});

test('local and deployed canonical lesson loading keeps working', async () => {
  const remoteCalls = [];
  const remote = loadContentSource({
    repository: 'fork/repo',
    fetch: async (url) => {
      remoteCalls.push(String(url));
      return response(true, '# English');
    },
  }).source;
  const remoteResult = await remote.loadLessonDocument('phases/01-math/01-vectors', 'en');
  assert.deepEqual({ markdown: remoteResult.markdown, lang: remoteResult.lang }, { markdown: '# English', lang: 'en' });
  assert.equal(remoteCalls[0], 'https://raw.githubusercontent.com/fork/repo/main/phases/01-math/01-vectors/docs/en.md');

  const localCalls = [];
  const local = loadContentSource({
    hostname: 'localhost',
    fetch: async (url) => {
      localCalls.push(String(url));
      return response(true, '# Local English');
    },
  }).source;
  const localResult = await local.loadLessonDocument('phases/01-math/01-vectors', 'en');
  assert.equal(localResult.markdown, '# Local English');
  assert.equal(localCalls[0], '../phases/01-math/01-vectors/docs/en.md');
});

test('Russian certification lesson requests translation before embedded English', async () => {
  const calls = [];
  const { source } = loadContentSource({
    repository: 'fork/repo',
    fetch: async (url) => {
      calls.push(String(url));
      return response(true, '# Русский');
    },
  });

  const result = await source.loadLessonDocument(
    'certifications/claude/lessons/01-intro',
    'ru',
    '# Canonical English',
  );

  assert.equal(result.markdown, '# Русский');
  assert.equal(result.lang, 'ru');
  assert.deepEqual(calls, [
    'https://raw.githubusercontent.com/fork/repo/main/i18n/ru/certifications/claude/lessons/01-intro/docs/ru.md',
  ]);
});

for (const failure of ['404', 'network']) {
  test(`${failure} loading a certification translation falls back to embedded English`, async () => {
    const { source } = loadContentSource({
      fetch: async () => {
        if (failure === 'network') throw new Error('offline');
        return response(false, 'not found');
      },
    });

    const result = await source.loadLessonDocument(
      'certifications/claude/lessons/01-intro',
      'ru',
      '# Canonical English',
    );
    assert.equal(result.markdown, '# Canonical English');
    assert.equal(result.lang, 'en');
  });
}

test('core translation failure falls back to fetched canonical English', async () => {
  const calls = [];
  const { source } = loadContentSource({
    fetch: async (url) => {
      calls.push(String(url));
      if (String(url).includes('/i18n/ru/')) return response(false, 'missing');
      return response(true, '# Core English');
    },
  });

  const result = await source.loadLessonDocument('phases/01-math/01-vectors', 'ru');
  assert.equal(result.markdown, '# Core English');
  assert.equal(result.lang, 'en');
  assert.match(calls[0], /\/main\/i18n\/ru\/phases\/01-math\/01-vectors\/docs\/ru\.md$/);
  assert.match(calls[1], /\/translations\/i18n\/ru\/phases\/01-math\/01-vectors\/docs\/ru\.md$/);
  assert.match(calls[2], /\/main\/phases\/01-math\/01-vectors\/docs\/en\.md$/);
});

test('certification picker accepts Russian and is not hard-hidden', () => {
  let domReady;
  const window = {
    AIFS_LANGS: [{ code: 'en', native: 'English' }, { code: 'ru', native: 'Русский' }, { code: 'tr', native: 'Türkçe' }],
    AIFS_CERTIFICATION_LANGS: ['ru'],
    location: { href: 'https://example.com/lesson.html?path=certifications/claude/lessons/01-intro&lang=ru' },
  };
  const document = {
    readyState: 'loading',
    documentElement: {},
    addEventListener(name, callback) { if (name === 'DOMContentLoaded') domReady = callback; },
    getElementById() { return null; },
  };
  const context = {
    window,
    document,
    location: { search: '?path=certifications/claude/lessons/01-intro&lang=ru', href: window.location.href },
    URL,
    URLSearchParams,
    localStorage: { getItem() { return ''; } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(siteDir, 'lang-picker.js'), 'utf8'), context);

  assert.equal(window.AIFS_currentLang(), 'ru');
  domReady();
  assert.equal(document.documentElement.lang, undefined);
});

test('lesson runtime renders only the latest response and keeps certification quiz canonical', () => {
  const html = fs.readFileSync(path.join(siteDir, 'lesson.html'), 'utf8');
  assert.match(html, /AIFSContentSource\.loadLessonDocument/);
  assert.match(html, /requestSequence !== lessonFetchSequence/);
  assert.match(html, /applyRenderedLanguage\(documentResult\.lang\)/);
  assert.match(html, /lessonQuizPromise = Promise\.resolve\(certificationLesson\.quiz \|\| null\)/);
  assert.match(html, /quiz-language-note/);
  assert.match(html, /Certification quizzes remain in English/);
  assert.doesNotMatch(html, /if \(certificationLesson\)[\s\S]{0,300}langPicker\.hidden = true/);
  assert.doesNotMatch(html, /raw\.githubusercontent\.com\/rohitg00[^\n]+translations\/i18n/);
});

test('internal lesson links preserve the selected translation language', () => {
  const html = fs.readFileSync(path.join(siteDir, 'lesson.html'), 'utf8');
  assert.match(html, /function lessonHref\(path, track\)/);
  assert.match(html, /searchParams\.set\('lang', lang\)/);
  assert.match(html, /url \+= '&lang=' \+ encodeURIComponent\(renderedLang\)/);
  assert.doesNotMatch(html, /href=\\?"lesson\.html\?path=/);
});

test('production language registry actually offers Russian', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'languages.json'), 'utf8'));
  const offered = registry.languages.filter((lang) => lang.source || lang.ci).map((lang) => lang.code);
  assert.ok(offered.includes('ru'));
});

test('language selection waits for the winning document before changing html lang', () => {
  const picker = fs.readFileSync(path.join(siteDir, 'lang-picker.js'), 'utf8');
  const choose = picker.match(/function choose\(code\) \{[\s\S]*?\n    \}/)[0];
  assert.doesNotMatch(choose, /applyDir\(lang\)/);
});

test('translation URLs preserve canonical BCP-47 case', () => {
  const sourceText = fs.readFileSync(path.join(siteDir, 'content-source.js'), 'utf8');
  assert.match(sourceText, /\^\[A-Za-z\]/);
  assert.doesNotMatch(sourceText, /String\(lang \|\| ''\)\.toLowerCase\(\)/);
});

test('curriculum CI runs the runtime i18n tests', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/curriculum.yml'), 'utf8');
  assert.match(workflow, /node --test site\/tests\/runtime-i18n\.test\.js/);
  assert.equal((workflow.match(/- "languages\.json"/g) || []).length, 2);
});

test('English error UI resets the rendered document language', () => {
  const html = fs.readFileSync(path.join(siteDir, 'lesson.html'), 'utf8');
  const showError = html.match(/function showError\(title, msg\) \{([\s\S]*?)\n      \}/);
  assert.ok(showError);
  assert.match(showError[1], /applyRenderedLanguage\('en'\)/);
});
