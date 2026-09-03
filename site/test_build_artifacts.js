#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
  FIGURE_PROVIDER_ORDER,
  assertAboutCurriculumSummary,
  buildSeoManifests,
  buildFigureProviderManifest,
  discoverFigureProviderOrder,
  discoverUsedFigureIds,
  discoverArtifacts,
  lessonDocumentSeo,
  parseLearningPaths,
  parseCertifications,
  parseReadme,
  parseRoadmap,
  renderCatalogDiscovery,
  renderCertificationDiscovery,
  publishedLanguages,
  requireShortRef,
  resolveRef,
  resolveRepository,
  resolveTranslationSource,
  serializeBuildMeta,
  serializeFigureProviderManifest,
  syncI18nAssetVersions,
  writeBuildMeta,
  writeI18nData,
} = require('./build.js');
const {
  learningPathDestination,
  rebuildIndex,
  resultIndexForEnter,
  search,
} = require('./cmdpalette.js');

function loadContentSource(options = {}) {
  const context = {
    URL,
    window: {
      __AIFS_SOURCE: options.source,
      __AIFS_REF: options.ref,
      __AIFS_REPOSITORY: options.repository,
      __AIFS_TRANSLATION_REF: options.translationRef,
      __AIFS_TRANSLATION_REPOSITORY: options.translationRepository,
      location: {
        hostname: options.hostname || 'localhost',
        href: options.href || 'http://localhost/site/lesson.html',
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'content-source.js'), 'utf8'),
    context
  );
  return context.window.AIFSContentSource;
}

function createEscapingDocument() {
  function encode(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    createElement() {
      let html = '';
      return {
        set textContent(value) {
          html = encode(value);
        },
        get innerHTML() {
          return html;
        },
        set innerHTML(value) {
          html = String(value ?? '');
        },
      };
    },
  };
}

function extractLessonFunctionSource(name) {
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const marker = `      function ${name}(`;
  const start = lessonHtml.indexOf(marker);
  assert.notEqual(start, -1, `lesson.html is missing ${name}`);
  const nextFunction = lessonHtml.indexOf('\n      function ', start + marker.length);
  if (nextFunction === -1) {
    throw new Error(`Could not extract ${name} from lesson.html`);
  }
  return lessonHtml.slice(start, nextFunction).trimEnd();
}

function loadLessonInlineFormatter(options = {}) {
  const repository = options.repository || 'example/fork';
  const ref = options.ref || 'feature-images';
  const source = Object.prototype.hasOwnProperty.call(options, 'contentSource')
    ? options.contentSource
    : loadContentSource({
        hostname: 'preview.example',
        href: 'https://preview.example/lesson.html',
        repository,
        ref,
      });
  const context = {
    URL,
    lessonPath: options.lessonPath || 'phases/14-agent-engineering/16-openai-agents-sdk',
    ACTIVE_REPOSITORY: repository,
    ACTIVE_REF: ref,
    ENCODED_ACTIVE_REF: ref.split('/').map(encodeURIComponent).join('/'),
    document: createEscapingDocument(),
    window: {
      AIFSContentSource: source,
    },
  };
  const runtimeSource = [
    extractLessonFunctionSource('escapeHtml'),
    extractLessonFunctionSource('escapeAttr'),
    extractLessonFunctionSource('lessonMarkdownBaseUrl'),
    extractLessonFunctionSource('resolveMarkdownImageUrl'),
    extractLessonFunctionSource('inlineFormat'),
    extractLessonFunctionSource('slugify'),
    extractLessonFunctionSource('highlightSyntax'),
    extractLessonFunctionSource('renderCodeBlock'),
    extractLessonFunctionSource('splitTableRow'),
    extractLessonFunctionSource('parseMd'),
    'window.__testInlineFormat = inlineFormat;',
    'window.__testResolveMarkdownImageUrl = resolveMarkdownImageUrl;',
    'window.__testParseMd = parseMd;',
  ].join('\n\n');
  vm.runInNewContext(runtimeSource, context, { filename: 'lesson.html#inlineFormat' });
  return {
    inlineFormat: context.window.__testInlineFormat,
    parseMd: context.window.__testParseMd,
    resolveMarkdownImageUrl: context.window.__testResolveMarkdownImageUrl,
  };
}

function loadRoadmapLessonPageUrl(options = {}) {
  const roadmapPath = path.join(__dirname, 'roadmap.js');
  const source = fs.readFileSync(roadmapPath, 'utf8');
  const languages = options.languages || [{ code: 'en' }, { code: 'zh' }];
  const queryLanguage = new URLSearchParams(options.search || '').get('lang');
  const instrumented = source.replace(
    /\n\}\)\(\);\s*$/,
    '\n  window.__testLessonPageUrl = lessonPageUrl;\n})();\n'
  );
  assert.notEqual(instrumented, source, 'roadmap.js should expose its closing IIFE for the test seam');

  const window = {
    AIFS_I18n: { current: options.language || queryLanguage || 'en' },
    AIFS_LANGS: languages,
    addEventListener() {},
    matchMedia() { return { matches: false }; },
  };
  const document = {
    documentElement: { setAttribute() {} },
    addEventListener() {},
  };
  const localStorage = { getItem() { return null; } };

  vm.runInNewContext(
    instrumented,
    { window, document, localStorage, URLSearchParams, encodeURI, encodeURIComponent },
    { filename: roadmapPath }
  );
  return window.__testLessonPageUrl;
}

function loadHomepageTranslator(i18n) {
  const appPath = path.join(__dirname, 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const start = source.indexOf('  function tr(');
  const end = source.indexOf('\n\n  var stored', start);
  assert.ok(start >= 0 && end > start, 'app.js is missing its translation helper');
  const context = { window: { AIFS_I18n: i18n } };
  vm.runInNewContext(
    source.slice(start, end) + '\nthis.tr = tr;',
    context,
    { filename: appPath }
  );
  return context.tr;
}

function loadCatalogLessonHref(hostname) {
  const catalogPath = path.join(__dirname, 'catalog.html');
  const source = fs.readFileSync(catalogPath, 'utf8');
  const start = source.indexOf('function lessonHref(');
  const end = source.indexOf('\n\n        function ', start + 1);
  assert.ok(start >= 0 && end > start, 'catalog.html is missing its lesson route helper');
  const context = { window: { location: { hostname } }, encodeURIComponent };
  vm.runInNewContext(
    source.slice(start, end) + '\nthis.lessonHref = lessonHref;',
    context,
    { filename: catalogPath }
  );
  return context.lessonHref;
}

function loadCatalogGroupHeadingHtml(i18n) {
  const catalogPath = path.join(__dirname, 'catalog.html');
  const source = fs.readFileSync(catalogPath, 'utf8');
  const escapeStart = source.indexOf('        function escapeHtml(');
  const helperStart = source.indexOf('        function catalogGroupHeadingHtml(');
  const helperEnd = source.indexOf('\n\n        function ', helperStart + 1);
  assert.ok(escapeStart >= 0 && helperStart > escapeStart && helperEnd > helperStart);
  const escapeEnd = source.indexOf('\n\n        function ', escapeStart + 1);
  const context = { document: createEscapingDocument(), window: { AIFS_I18n: i18n } };
  vm.runInNewContext(
    source.slice(escapeStart, escapeEnd) + '\n' +
      source.slice(helperStart, helperEnd) +
      '\nthis.catalogGroupHeadingHtml = catalogGroupHeadingHtml;',
    context,
    { filename: catalogPath }
  );
  return context.catalogGroupHeadingHtml;
}

function renderHomepageModalLessons(hostname, phase) {
  const appPath = path.join(__dirname, 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const start = source.indexOf('  function lessonPageUrl(');
  const end = source.indexOf('\n  if (window.AIFSProgress)', start);
  assert.ok(start >= 0 && end > start, 'app.js is missing its modal lesson renderer');
  const elements = {
    modalLessons: { innerHTML: '', querySelectorAll() { return []; } },
    modalProgress: { style: {}, innerHTML: '' },
    modalProgressBar: { style: {}, setAttribute() {} },
    modalProgressBarFill: { style: {} },
  };
  const context = {
    window: { location: { hostname } },
    document: { getElementById(id) { return elements[id] || null; } },
    encodeURIComponent,
    escapeHtml(value) { return String(value); },
    tr(value) { return value; },
  };
  vm.runInNewContext(
    source.slice(start, end) + '\nthis.renderModalLessons = renderModalLessons;',
    context,
    { filename: appPath }
  );
  context.renderModalLessons(phase);
  return elements.modalLessons.innerHTML;
}

function lessonResponse(body, ok = true) {
  return {
    ok,
    text() { return Promise.resolve(body); },
  };
}

function loadLessonFetchRuntime(options = {}) {
  const calls = { fetch: [], lesson: [], quiz: [], localizedQuiz: [] };
  const lessonPath = options.lessonPath || 'phases/01-math-foundations/01-linear-algebra-intuition';
  const contentSource = {
    isLocal() { return false; },
    repoUrl(relativePath) { return `repo:${relativePath}`; },
    rawRepoUrl(relativePath) { return `raw:${relativePath}`; },
    translationUrl(relativePath) { return `translation:${relativePath}`; },
  };
  const context = {
    Promise,
    console,
    setTimeout,
    ACTIVE_REPOSITORY: 'example/repository',
    ENCODED_ACTIVE_REF: 'main',
    TRANSLATION_REPOSITORY: 'example/repository',
    ENCODED_TRANSLATION_REF: 'translations',
    REPO_TREE: 'https://github.com/example/repository/tree/main/',
    certificationLesson: null,
    lessonQuizPromise: null,
    lessonFetchSequence: 0,
    currentLessonIndex: -1,
    flatLessons: [],
    window: {
      AIFS_currentLang() { return options.lang || 'zh'; },
      AIFSContentSource: contentSource,
    },
    document: { documentElement: { lang: '', dir: '' } },
    fetch(url, init) {
      calls.fetch.push({ url, init });
      return options.fetch(url, init);
    },
    loadLocalizedQuiz(quiz, sourceText, requestedPath, lang) {
      calls.localizedQuiz.push({ quiz, sourceText, path: requestedPath, lang });
      return Promise.resolve({
        quiz: options.localizedQuiz || quiz,
        lang: options.quizLang || 'zh',
      });
    },
    renderLesson(markdown, lang) { calls.lesson.push({ markdown, lang }); },
    renderQuiz(quiz, lang) { calls.quiz.push({ quiz, lang }); },
    showError() { assert.fail('fetchLesson unexpectedly reached showError'); },
    escapeAttr(value) { return value; },
    escapeHtml(value) { return value; },
  };
  const runtimeSource = [
    extractLessonFunctionSource('currentLang'),
    extractLessonFunctionSource('applySelectedLanguage'),
    extractLessonFunctionSource('fetchRepositoryFile'),
    extractLessonFunctionSource('fetchLesson'),
    'window.__testFetchLesson = fetchLesson;',
  ].join('\n\n');
  vm.runInNewContext(runtimeSource, context, { filename: 'lesson.html#fetchLesson' });
  return { calls, document: context.document, fetchLesson: context.window.__testFetchLesson, lessonPath };
}

function flushLessonFetch() {
  return new Promise(resolve => setImmediate(resolve));
}

function loadLessonDynamicI18nRuntime(options = {}) {
  const lessonStrings = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'i18n', 'zh', 'lesson.json'), 'utf8')
  ).strings;
  const fallbackQuizStrings = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'i18n', 'zh', 'fallback-quiz.json'), 'utf8')
  ).strings;
  const translations = {
    ...lessonStrings,
    ...fallbackQuizStrings,
    ...(options.translations || {}),
  };

  function element() {
    const attributes = new Map();
    let html = '';
    const node = {
      className: '',
      isConnected: false,
      parentNode: null,
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    Object.defineProperties(node, {
      innerHTML: {
        get() { return html; },
        set(value) { html = String(value ?? ''); },
      },
      textContent: {
        get() { return html; },
        set(value) {
          html = String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        },
      },
    });
    return node;
  }

  function container() {
    return {
      children: [],
      appendChild(child) {
        child.isConnected = true;
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
    };
  }

  const document = {
    documentElement: {},
    createElement() {
      const node = element();
      node.quizBody = element();
      node.querySelector = selector => selector === '#quizContent' ? node.quizBody : null;
      return node;
    },
    getElementById() { return null; },
  };
  const window = {
    AIFS_currentLang() { return options.lang || 'zh'; },
    AIFS_I18n: {
      t(value, params, lang) {
        let translated = lang === 'zh' && Object.prototype.hasOwnProperty.call(translations, value)
          ? translations[value]
          : value;
        return String(translated).replace(/\{([A-Za-z0-9_]+)\}/g, (token, name) =>
          params && Object.prototype.hasOwnProperty.call(params, name) ? params[name] : token
        );
      },
      apply() {},
    },
    AIFSProgress: options.progress || null,
    AIFSLearningPathProgress: options.learningPathProgress || null,
  };
  const context = {
    Promise,
    window,
    document,
    lessonPath: options.lessonPath || 'phases/01-math-foundations/01-linear-algebra-intuition',
    currentLessonIndex: options.currentLessonIndex ?? 0,
    flatLessons: options.flatLessons || [{
      path: 'phases/01-math-foundations/01-linear-algebra-intuition',
      lessonName: 'Linear Algebra Intuition',
      phaseSlug: '01-math-foundations',
      phaseIndex: 0,
      isReadable: true,
    }],
    lessonQuizPromise: options.quizPromise || null,
    certificationMode: false,
    certificationTrack: null,
    learningPathMode: !!options.learningPathMode,
    learningPath: options.learningPath || null,
    PHASES: options.phases || [],
    learningPathPreflightHtml() { return ''; },
    learningPathPreflightDefinitions() { return options.preflights || []; },
    learningPathEntryLocked() { return false; },
    learningPathGateClass() { return ''; },
    learningPathGateAttributes() { return ''; },
    learningPathLessonHref(value) { return `lesson?path=${value}`; },
    learningPathPrerequisiteCallout() { return ''; },
    mountLearningPathPanel(target, panel) { return target.appendChild(panel); },
    revealPhaseCompletion() {},
  };
  const runtimeSource = [
    extractLessonFunctionSource('escapeHtml'),
    extractLessonFunctionSource('escapeAttr'),
    extractLessonFunctionSource('currentLang'),
    extractLessonFunctionSource('lessonUiFormat'),
    extractLessonFunctionSource('lessonUiText'),
    extractLessonFunctionSource('applyLessonUiLanguage'),
    extractLessonFunctionSource('lessonPositionText'),
    extractLessonFunctionSource('relativeLessonCountText'),
    extractLessonFunctionSource('getEnglishFallbackQuizQuestions'),
    extractLessonFunctionSource('getQuizQuestions'),
    extractLessonFunctionSource('fallbackQuizLanguage'),
    extractLessonFunctionSource('lessonQuizPanelQuestions'),
    extractLessonFunctionSource('renderQuizPanel'),
    extractLessonFunctionSource('fillQuizPanel'),
    extractLessonFunctionSource('renderLearningPathPanel'),
    'window.__testDynamicI18n = { renderQuizPanel, relativeLessonCountText, renderLearningPathPanel };',
  ].join('\n\n');
  vm.runInNewContext(runtimeSource, context, { filename: 'lesson.html#dynamic-i18n' });
  return {
    ...window.__testDynamicI18n,
    container,
    context,
  };
}

test('lesson dynamic fallbacks render in the language of their actual content', async () => {
  const direct = loadLessonDynamicI18nRuntime({ lang: 'zh' });
  const directContainer = direct.container();
  direct.renderQuizPanel(directContainer);
  const directBody = directContainer.children[0].quizBody;
  assert.equal(directBody.getAttribute('lang'), 'zh');
  assert.match(directBody.innerHTML, /两个向量的点积衡量什么/);
  assert.match(
    directBody.innerHTML,
    /想做更深入的测验？在 Codex 中使用 <code>check-understanding 01<\/code>，或从 <code>\/skills<\/code> 中选择/
  );

  const promised = loadLessonDynamicI18nRuntime({
    lang: 'zh',
    quizPromise: Promise.resolve({ quiz: { questions: [] }, lang: 'en' }),
  });
  const promisedContainer = promised.container();
  promised.renderQuizPanel(promisedContainer);
  await Promise.resolve();
  const promisedBody = promisedContainer.children[0].quizBody;
  assert.equal(promisedBody.getAttribute('lang'), 'zh');
  assert.match(promisedBody.innerHTML, /两个向量的点积衡量什么/);

  const untranslated = loadLessonDynamicI18nRuntime({ lang: 'hi' });
  const untranslatedContainer = untranslated.container();
  untranslated.renderQuizPanel(untranslatedContainer);
  const untranslatedBody = untranslatedContainer.children[0].quizBody;
  assert.equal(untranslatedBody.getAttribute('lang'), 'en');
  assert.match(untranslatedBody.innerHTML, /What does a dot product measure between two vectors/);
});

test('lesson dynamic progress renderers consume complete localized templates', () => {
  const relative = loadLessonDynamicI18nRuntime({ lang: 'zh' });
  assert.equal(relative.relativeLessonCountText(3, 'earlier', false), '前面还有 3 节');
  assert.equal(relative.relativeLessonCountText(4, 'later', true), '后面还有 4 节课程');

  const optionalPath = loadLessonDynamicI18nRuntime({
    lang: 'zh',
    lessonPath: 'phases/13-tools-and-protocols/99-optional',
    learningPathMode: true,
    learningPath: { id: 'focused', title: 'Focused path' },
    flatLessons: [
      { path: 'phases/13-tools-and-protocols/01-required', lessonName: 'Required 1', required: true },
      { path: 'phases/13-tools-and-protocols/02-required', lessonName: 'Required 2', required: true },
      { path: 'phases/13-tools-and-protocols/99-optional', lessonName: 'Optional', required: false },
    ],
    progress: { isLessonComplete(pathValue) { return pathValue.endsWith('01-required'); } },
    preflights: [{ id: 'one' }, { id: 'two' }],
    learningPathProgress: { isConfirmed(_pathId, checkId) { return checkId === 'one'; } },
  });
  const optionalContainer = optionalPath.container();
  optionalPath.renderLearningPathPanel(optionalContainer);
  assert.match(optionalContainer.children[0].innerHTML, /可选课程。已完成 1 \/ 2 节必修课程。/);
  assert.match(optionalContainer.children[0].innerHTML, /1 \/ 2 项知识预检已确认。/);

  const completedPhase = loadLessonDynamicI18nRuntime({
    lang: 'zh',
    translations: { 'Next Phase': '下一阶段' },
    progress: { isLessonComplete() { return true; } },
    phases: [
      { id: 1, name: 'Math', lessons: [] },
      { id: 2, name: 'Next Phase', lessons: [] },
    ],
  });
  const phaseContainer = completedPhase.container();
  completedPhase.renderLearningPathPanel(phaseContainer);
  assert.match(phaseContainer.children[0].innerHTML, /已准备好进入阶段 02：下一阶段/);
});

function markupAssetUrls(html) {
  return Array.from(
    html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*(["'])(.*?)\1[^>]*>/gi),
    match => match[2]
  );
}

function assertProjectPagesAssetUrls(page, html, projectRoot) {
  const pageUrl = new URL(page, projectRoot);
  for (const target of markupAssetUrls(html)) {
    if (/^(?:https?:|data:|mailto:|#)/i.test(target)) continue;
    assert.ok(!target.startsWith('/'), `${page} uses root-relative asset ${target}`);
    const resolved = new URL(target, pageUrl);
    assert.equal(resolved.origin, projectRoot.origin, `${page} changes origin via ${target}`);
    assert.ok(
      resolved.pathname.startsWith(projectRoot.pathname),
      `${page} escapes the Pages base path via ${target}`
    );
  }
}

function workflowRunScript(stepName) {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'curriculum.yml'),
    'utf8'
  );
  const lines = workflow.split(/\r?\n/);
  const marker = `      - name: ${stepName}`;
  const start = lines.indexOf(marker);
  assert.ok(start >= 0, `curriculum workflow is missing ${stepName}`);
  const runLine = lines.indexOf('        run: |', start);
  assert.ok(runLine > start, `${stepName} is missing a multiline run script`);
  const body = [];
  for (const line of lines.slice(runLine + 1)) {
    if (line && !line.startsWith('          ')) break;
    body.push(line ? line.slice(10) : '');
  }
  return body.join('\n');
}

function runChecked(command, args, cwd, environment = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      ...environment,
    },
  });
  if (result.error) {
    assert.fail(`${command} ${args.join(' ')} failed: ${result.error.message}\n${result.stderr || result.stdout}`);
  }
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function runCommand(command, args, cwd, environment = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      ...environment,
    },
  });
}

test('writeI18nData returns the exact payload written to the core bundle file', t => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-i18n-output-'));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const outputPath = path.join(outputDir, 'i18n-data.js');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(__dirname, '..', 'ROADMAP.md'), 'utf8'));
  const phases = parseReadme(
    fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8'),
    roadmap
  );

  const returned = writeI18nData(phases, outputPath);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(outputPath, 'utf8'), context, { filename: outputPath });

  assert.deepEqual(
    JSON.parse(JSON.stringify(returned)),
    JSON.parse(JSON.stringify(context.window.AIFS_I18N))
  );
  assert.ok(!Object.keys(returned.zh.bundles).some(name => name.startsWith('figures-')));
  assert.ok(!Object.keys(returned.zh.bundles).some(name => name.startsWith('glossary-')));
});

test('content source follows build metadata for fork deployments', () => {
  const source = loadContentSource({
    hostname: 'preview.example',
    href: 'https://preview.example/lesson.html',
    repository: 'example/fork',
    ref: 'feature-i18n',
  });

  assert.equal(
    source.rawRepoUrl('phases/00-setup-and-tooling'),
    'https://raw.githubusercontent.com/example/fork/feature-i18n/phases/00-setup-and-tooling'
  );
  assert.equal(
    source.translationUrl('i18n/zh/phases/00-setup-and-tooling/docs/zh.md'),
    'https://raw.githubusercontent.com/example/fork/translations/i18n/zh/phases/00-setup-and-tooling/docs/zh.md'
  );
});

test('translation content can use a published source without changing fork previews', () => {
  const source = loadContentSource({
    hostname: 'preview.example',
    href: 'https://preview.example/lesson.html',
    repository: 'example/fork',
    ref: 'feature-i18n',
    translationRepository: 'publisher/curriculum',
    translationRef: 'localized-lessons',
  });

  assert.equal(
    source.rawRepoUrl('phases/00-setup-and-tooling/docs/en.md'),
    'https://raw.githubusercontent.com/example/fork/feature-i18n/phases/00-setup-and-tooling/docs/en.md'
  );
  assert.equal(
    source.translationUrl('i18n/zh/phases/00-setup-and-tooling/docs/zh.md'),
    'https://raw.githubusercontent.com/publisher/curriculum/localized-lessons/i18n/zh/phases/00-setup-and-tooling/docs/zh.md'
  );
});

test('translation source defaults to the active repository translations branch', () => {
  assert.equal(
    resolveRepository({
      VERCEL_GIT_REPO_OWNER: 'example',
      VERCEL_GIT_REPO_SLUG: 'fork',
    }),
    'example/fork'
  );
  assert.deepEqual(
    resolveTranslationSource({}, 'example/fork'),
    { repository: 'example/fork', ref: 'translations' }
  );
  assert.deepEqual(
    resolveTranslationSource({
      AIFS_TRANSLATION_REPOSITORY: 'publisher/curriculum',
      AIFS_TRANSLATION_REF: 'localized-lessons',
    }, 'example/fork'),
    { repository: 'publisher/curriculum', ref: 'localized-lessons' }
  );
});

test('translation refs follow Git short-ref rules in build metadata', () => {
  for (const ref of ['feature+preview', 'feature@preview', 'release-1/topic']) {
    assert.equal(requireShortRef(ref, 'test ref'), ref);
    assert.equal(
      resolveTranslationSource({ AIFS_TRANSLATION_REF: ref }, 'example/fork').ref,
      ref
    );
  }
  for (const ref of ['@', '-preview', 'refs/heads/main', 'feature..bad', 'feature/x.lock']) {
    assert.throws(
      () => resolveTranslationSource({ AIFS_TRANSLATION_REF: ref }, 'example/fork'),
      /valid short Git ref/
    );
  }
});

test('build metadata recognizes GitHub Actions repository and branch variables', () => {
  const previewSha = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(
    resolveRepository({ GITHUB_REPOSITORY: 'example/pages-fork' }),
    'example/pages-fork'
  );
  assert.equal(resolveRef({ GITHUB_REF_NAME: 'main' }), 'main');
  assert.equal(resolveRef({ GITHUB_REF: 'refs/heads/pages-preview' }), 'pages-preview');
  assert.equal(resolveRef({
    VERCEL_GIT_COMMIT_REF: 'vercel-preview',
    GITHUB_REF_NAME: 'main',
  }), 'vercel-preview');
  assert.equal(resolveRef({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: previewSha,
    VERCEL_GIT_COMMIT_REF: 'vercel-preview',
  }), previewSha);
  assert.equal(resolveRef({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: 'not-a-sha',
    VERCEL_GIT_COMMIT_REF: 'vercel-preview',
  }), 'vercel-preview');
  assert.equal(resolveRef({
    VERCEL_ENV: 'production',
    VERCEL_GIT_COMMIT_SHA: previewSha,
    VERCEL_GIT_COMMIT_REF: 'vercel-preview',
  }), 'main');
  const previewMetadata = serializeBuildMeta({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: previewSha,
    VERCEL_GIT_COMMIT_REF: 'vercel-preview',
    GITHUB_REPOSITORY: 'example/pages-fork',
  });
  assert.equal(previewMetadata.ref, previewSha);
  assert.match(previewMetadata.source, new RegExp(`window\.__AIFS_REF = "${previewSha}";`));
  assert.match(previewMetadata.source, new RegExp(`"revision":"${previewSha}"`));
  assert.equal(resolveRepository({
    VERCEL_GIT_REPO_OWNER: 'vercel-owner',
    VERCEL_GIT_REPO_SLUG: 'vercel-fork',
    GITHUB_REPOSITORY: 'github/pages-fork',
  }), 'vercel-owner/vercel-fork');

  const metadata = serializeBuildMeta({
    GITHUB_REPOSITORY: 'example/pages-fork',
    GITHUB_REF_NAME: 'main',
    AIFS_TRANSLATION_REPOSITORY: 'example/translations-publisher',
    AIFS_TRANSLATION_REF: 'localized-content',
  });
  assert.deepEqual(metadata.translationSource, {
    repository: 'example/translations-publisher',
    ref: 'localized-content',
  });
  assert.match(metadata.source, /window\.__AIFS_REF = "main";/);
  assert.match(metadata.source, /window\.__AIFS_REPOSITORY = "example\/pages-fork";/);
  assert.match(
    metadata.source,
    /window\.__AIFS_SOURCE = \{"owner":"example","repo":"pages-fork","revision":"main"\};/
  );
  assert.match(
    metadata.source,
    /window\.__AIFS_TRANSLATION_REPOSITORY = "example\/translations-publisher";/
  );
  assert.match(metadata.source, /window\.__AIFS_TRANSLATION_REF = "localized-content";/);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-build-meta-'));
  const outputPath = path.join(tempDir, 'build-meta.js');
  try {
    writeBuildMeta({
      GITHUB_REPOSITORY: 'example/pages-fork',
      GITHUB_REF_NAME: 'main',
      AIFS_TRANSLATION_REPOSITORY: 'example/translations-publisher',
      AIFS_TRANSLATION_REF: 'localized-content',
    }, outputPath);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), metadata.source);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('content source URL-encodes ref path segments without flattening slashes', () => {
  const source = loadContentSource({
    hostname: 'preview.example',
    repository: 'example/fork',
    ref: 'release-1/topic',
    translationRef: 'localized-1/topic',
  });

  assert.equal(
    source.rawRepoUrl('phases/00-setup-and-tooling/docs/en.md'),
    'https://raw.githubusercontent.com/example/fork/release-1/topic/phases/00-setup-and-tooling/docs/en.md'
  );
  assert.equal(
    source.translationUrl('i18n/zh/phases/00-setup-and-tooling/docs/zh.md'),
    'https://raw.githubusercontent.com/example/fork/localized-1/topic/i18n/zh/phases/00-setup-and-tooling/docs/zh.md'
  );
});

test('content source accepts Git-valid refs and URL-encodes each path segment', () => {
  const source = loadContentSource({
    hostname: 'preview.example',
    repository: 'example/fork',
    ref: 'release+1/topic@preview',
    translationRef: 'localized+1/topic@published',
  });

  assert.equal(
    source.rawRepoUrl('phases/00-setup-and-tooling/docs/en.md'),
    'https://raw.githubusercontent.com/example/fork/release%2B1/topic%40preview/phases/00-setup-and-tooling/docs/en.md'
  );
  assert.equal(
    source.translationUrl('i18n/zh/phases/00-setup-and-tooling/docs/zh.md'),
    'https://raw.githubusercontent.com/example/fork/localized%2B1/topic%40published/i18n/zh/phases/00-setup-and-tooling/docs/zh.md'
  );
});

test('lesson reader applies the same Git short-ref contract as content loading', () => {
  const context = {};
  vm.runInNewContext(
    extractLessonFunctionSource('validRepositoryRef') + '\nthis.validRepositoryRef = validRepositoryRef;',
    context,
    { filename: 'lesson.html#validRepositoryRef' }
  );

  for (const ref of ['feature+preview', 'feature@preview', 'release-1/topic']) {
    assert.equal(context.validRepositoryRef(ref), true, ref);
  }
  for (const ref of ['@', '-preview', 'refs/heads/main', 'foo..bar', 'foo//bar', 'foo.lock']) {
    assert.equal(context.validRepositoryRef(ref), false, ref);
  }
});

test('content source rejects refs with unsafe URL syntax', () => {
  const source = loadContentSource({
    hostname: 'preview.example',
    repository: 'example/fork',
    ref: 'release?1/topic',
    translationRef: 'localized?1/topic',
  });

  assert.equal(
    source.rawRepoUrl('README.md'),
    'https://raw.githubusercontent.com/example/fork/main/README.md'
  );
  assert.equal(
    source.translationUrl('i18n/zh/README.md'),
    'https://raw.githubusercontent.com/example/fork/translations/i18n/zh/README.md'
  );
});

test('fetchLesson renders a successful Chinese translation and localized quiz as zh', async () => {
  const localizedQuiz = { questions: [{ question: '中文题目' }] };
  const runtime = loadLessonFetchRuntime({
    lang: 'zh',
    localizedQuiz,
    fetch(url) {
      if (url.endsWith('/quiz.json')) {
        return Promise.resolve(lessonResponse('{"questions":[{"question":"English"}]}'));
      }
      if (url.startsWith('translation:')) return Promise.resolve(lessonResponse('# 中文课程'));
      assert.fail(`unexpected fetch: ${url}`);
    },
  });

  runtime.fetchLesson(runtime.lessonPath);
  await flushLessonFetch();

  assert.deepEqual(runtime.calls.lesson, [{ markdown: '# 中文课程', lang: 'zh' }]);
  assert.equal(runtime.calls.localizedQuiz[0].lang, 'zh');
  assert.equal(runtime.calls.quiz.length, 1);
  assert.equal(runtime.calls.quiz[0].quiz, localizedQuiz);
  assert.equal(runtime.calls.quiz[0].lang, 'zh');
  assert.equal(runtime.document.documentElement.lang, 'zh');
});

test('fetchLesson falls back to English prose without losing localized quiz language', async () => {
  const localizedQuiz = { questions: [{ question: '中文题目' }] };
  const runtime = loadLessonFetchRuntime({
    lang: 'zh',
    localizedQuiz,
    fetch(url) {
      if (url.endsWith('/quiz.json')) {
        return Promise.resolve(lessonResponse('{"questions":[{"question":"English"}]}'));
      }
      if (url.startsWith('translation:')) return Promise.resolve(lessonResponse('', false));
      if (url.endsWith('/docs/en.md')) return Promise.resolve(lessonResponse('# English lesson'));
      assert.fail(`unexpected fetch: ${url}`);
    },
  });

  runtime.fetchLesson(runtime.lessonPath);
  await flushLessonFetch();

  assert.deepEqual(runtime.calls.lesson, [{ markdown: '# English lesson', lang: 'en' }]);
  assert.equal(runtime.calls.quiz.length, 1);
  assert.equal(runtime.calls.quiz[0].quiz, localizedQuiz);
  assert.equal(runtime.calls.quiz[0].lang, 'zh');
});

test('lesson markdown renders relative images against the active fork repository and ref', () => {
  const { inlineFormat, resolveMarkdownImageUrl } = loadLessonInlineFormatter({
    repository: 'example/fork',
    ref: 'feature-i18n',
    lessonPath: 'phases/14-agent-engineering/16-openai-agents-sdk',
  });

  assert.equal(
    resolveMarkdownImageUrl('../assets/diagram.svg'),
    'https://raw.githubusercontent.com/example/fork/feature-i18n/phases/14-agent-engineering/16-openai-agents-sdk/assets/diagram.svg'
  );
  assert.equal(
    inlineFormat('![Actor flow](../assets/diagram.svg)'),
    '<img src="https://raw.githubusercontent.com/example/fork/feature-i18n/phases/14-agent-engineering/16-openai-agents-sdk/assets/diagram.svg" alt="Actor flow" loading="lazy" decoding="async">'
  );
});

test('lesson markdown falls back to the active repository root for certification assets', () => {
  const { inlineFormat, resolveMarkdownImageUrl } = loadLessonInlineFormatter({
    repository: 'example/fork',
    ref: 'feature-certifications',
    lessonPath: 'certifications/claude/lessons/16-multi-agent-orchestration-and-delegation',
    contentSource: undefined,
  });

  assert.equal(
    resolveMarkdownImageUrl('../assets/orchestration.svg'),
    'https://raw.githubusercontent.com/example/fork/feature-certifications/certifications/claude/lessons/16-multi-agent-orchestration-and-delegation/assets/orchestration.svg'
  );
  assert.equal(
    inlineFormat('![Orchestration flow](../assets/orchestration.svg)'),
    '<img src="https://raw.githubusercontent.com/example/fork/feature-certifications/certifications/claude/lessons/16-multi-agent-orchestration-and-delegation/assets/orchestration.svg" alt="Orchestration flow" loading="lazy" decoding="async">'
  );
  assert.equal(resolveMarkdownImageUrl('../../../../../../outside.svg'), null);
});

test('the production Markdown parser renders lesson images', () => {
  const { parseMd } = loadLessonInlineFormatter({
    repository: 'example/fork',
    ref: 'feature-images',
    lessonPath: 'phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment',
  });
  const html = parseMd('# NLI\n\n![NLI flow](../assets/nli.svg)');
  assert.match(
    html,
    /<p><img src="https:\/\/raw\.githubusercontent\.com\/example\/fork\/feature-images\/phases\/05-nlp-foundations-to-advanced\/21-nli-textual-entailment\/assets\/nli\.svg" alt="NLI flow" loading="lazy" decoding="async"><\/p>/
  );
});

test('lesson markdown renders external https images and preserves ordinary links', () => {
  const { inlineFormat } = loadLessonInlineFormatter();

  assert.equal(
    inlineFormat('![Remote](https://cdn.example.com/figures/agent.png)'),
    '<img src="https://cdn.example.com/figures/agent.png" alt="Remote" loading="lazy" decoding="async">'
  );
  assert.equal(
    inlineFormat('[Docs](https://example.com/docs?q=1&lang=en)'),
    '<a href="https://example.com/docs?q=1&amp;lang=en" target="_blank" rel="noopener">Docs</a>'
  );
  assert.equal(
    inlineFormat('[Local lesson](../README.md)'),
    'Local lesson'
  );
});

test('lesson markdown rejects unsafe image URLs and escapes alt text safely', () => {
  const { inlineFormat, resolveMarkdownImageUrl } = loadLessonInlineFormatter();

  assert.equal(resolveMarkdownImageUrl('javascript:alert(1)'), null);
  assert.equal(resolveMarkdownImageUrl('data:image/png;base64,abc'), null);
  assert.equal(resolveMarkdownImageUrl('//cdn.example.com/agent.png'), null);
  assert.equal(resolveMarkdownImageUrl('/absolute/path.png'), null);
  assert.equal(
    inlineFormat('![x < y & "quoted"](javascript:alert1)'),
    'x &lt; y &amp; &quot;quoted&quot;'
  );
});

test('roadmap lesson links preserve a valid non-English deep-link language', () => {
  const lesson = {
    url: 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/00-setup-and-tooling/01-dev-environment/',
  };

  assert.equal(
    loadRoadmapLessonPageUrl({ search: '?lang=zh' })(lesson),
    'lesson?path=phases/00-setup-and-tooling/01-dev-environment&lang=zh'
  );
  assert.equal(
    loadRoadmapLessonPageUrl({ language: 'en' })(lesson),
    'lesson?path=phases/00-setup-and-tooling/01-dev-environment'
  );
  assert.equal(
    loadRoadmapLessonPageUrl({ search: '?lang=bogus' })(lesson),
    'lesson?path=phases/00-setup-and-tooling/01-dev-environment'
  );
});

test('site publishes human-maintained locales without machine-translation CI', () => {
  assert.deepEqual(
    publishedLanguages({
      languages: [
        { code: 'en', native: 'English', source: true },
        { code: 'zh', native: '简体中文', manual: true },
        { code: 'fr', native: 'Français', ci: true },
        { code: 'de', native: 'Deutsch' },
      ],
    }),
    [
      { code: 'en', native: 'English' },
      { code: 'zh', native: '简体中文' },
      { code: 'fr', native: 'Français' },
    ]
  );
});

function createMcpTestDom() {
  const ids = new Map();

  class TestNode {
    constructor(tagName, text = '') {
      this.nodeType = tagName ? 1 : 3;
      this.tagName = tagName ? tagName.toUpperCase() : '';
      this.parentNode = null;
      this.childNodes = [];
      this.attributes = new Map();
      this.listeners = new Map();
      this.className = '';
      this._id = '';
      this._text = String(text);
      this._innerHtml = '';
    }

    get children() {
      return this.childNodes.filter(child => child.nodeType === 1);
    }

    get firstChild() {
      return this.childNodes[0] || null;
    }

    get id() {
      return this._id;
    }

    set id(value) {
      if (this._id && ids.get(this._id) === this) ids.delete(this._id);
      this._id = String(value || '');
      if (this._id) ids.set(this._id, this);
    }

    get textContent() {
      if (this.nodeType === 3) return this._text;
      return this._text + this.childNodes.map(child => child.textContent).join('');
    }

    set textContent(value) {
      this.childNodes.forEach(child => { child.parentNode = null; });
      this.childNodes = [];
      this._text = String(value ?? '');
      this._innerHtml = '';
    }

    get innerHTML() {
      return this._innerHtml || this.textContent;
    }

    set innerHTML(value) {
      this.childNodes.forEach(child => { child.parentNode = null; });
      this.childNodes = [];
      this._text = '';
      this._innerHtml = String(value ?? '');
    }

    setAttribute(name, value) {
      const normalized = String(value);
      if (name === 'id') this.id = normalized;
      else if (name === 'class') this.className = normalized;
      else this.attributes.set(name, normalized);
    }

    getAttribute(name) {
      if (name === 'id') return this.id || null;
      if (name === 'class') return this.className || null;
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    hasAttribute(name) {
      return this.getAttribute(name) !== null;
    }

    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this._text = '';
      this._innerHtml = '';
      this.childNodes.push(child);
      child.parentNode = this;
      return child;
    }

    removeChild(child) {
      const index = this.childNodes.indexOf(child);
      if (index < 0) throw new Error('Cannot remove a node that is not a child');
      this.childNodes.splice(index, 1);
      child.parentNode = null;
      return child;
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    dispatchEvent(event) {
      const normalized = typeof event === 'string' ? { type: event } : event;
      if (!normalized.target) normalized.target = this;
      for (const listener of this.listeners.get(normalized.type) || []) listener.call(this, normalized);
      return true;
    }

    click() {
      this.dispatchEvent({ type: 'click', target: this });
    }
  }

  const document = {
    createElement(tagName) {
      return new TestNode(tagName);
    },
    createTextNode(text) {
      return new TestNode('', text);
    },
    getElementById(id) {
      return ids.get(id) || null;
    },
  };
  document.head = document.createElement('head');

  function el(tag, attrs, kids) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs || {})) {
      if (name === 'class') node.className = value;
      else if (name === 'html') node.innerHTML = value;
      else node.setAttribute(name, value);
    }
    for (const child of kids || []) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function findAll(root, predicate) {
    const matches = [];
    function visit(node) {
      if (predicate(node)) matches.push(node);
      node.childNodes.forEach(visit);
    }
    visit(root);
    return matches;
  }

  return { document, el, findAll };
}

function loadMcpLabLogic() {
  const file = path.join(__dirname, 'figures-mcp.js');
  const source = fs.readFileSync(file, 'utf8');
  const registrationMarker = '\n  LF.register({';
  assert.ok(source.includes(registrationMarker), 'MCP lab registration marker is missing');
  const testExport = `
  window.__MCP_LAB_TEST_API = {
    contractScenarios: contractScenarios,
    transportScenarios: transportScenarios,
    requestScenarios: requestScenarios,
    dispatchScenarios: dispatchScenarios,
    conformanceScenarios: conformanceScenarios,
    reliabilityScenarios: reliabilityScenarios,
    admissionScenarios: admissionScenarios,
    primitiveScenarios: primitiveScenarios,
    retryScenarios: retryScenarios,
    driftScenarios: driftScenarios,
    mergeScenarios: mergeScenarios,
    boundaryScenarios: boundaryScenarios,
    taskScenarios: taskScenarios,
    appScenarios: appScenarios,
    poisonScenarios: poisonScenarios,
    oauthScenarios: oauthScenarios,
    jwksScenarios: jwksScenarios,
    evaluateContract: evaluateContract,
    evaluateTransport: evaluateTransport,
    evaluateRequestScenario: evaluateRequestScenario,
    evaluateDispatch: evaluateDispatch,
    evaluateConformance: evaluateConformance,
    evaluateReliability: evaluateReliability,
    evaluateAdmission: evaluateAdmission,
    evaluatePrimitive: evaluatePrimitive,
    evaluateRetry: evaluateRetry,
    evaluateDrift: evaluateDrift,
    evaluateMerge: evaluateMerge,
    evaluateBoundary: evaluateBoundary,
    evaluateTask: evaluateTask,
    evaluateApp: evaluateApp,
    evaluatePoison: evaluatePoison,
    evaluateOAuth: evaluateOAuth,
    evaluateJwks: evaluateJwks
  };
`;
  const dom = createMcpTestDom();
  const registrations = {};
  const context = {
    window: {
      LF: {
        el: dom.el,
        register(entries) {
          Object.assign(registrations, entries);
        },
      },
    },
    document: dom.document,
  };
  vm.runInNewContext(
    source.replace(registrationMarker, testExport + registrationMarker),
    context,
    { filename: file }
  );
  return {
    ...context.window.__MCP_LAB_TEST_API,
    registeredFigureIds: Object.keys(registrations).sort(),
    document: dom.document,
    renderFigure(id) {
      const host = dom.document.createElement('div');
      assert.equal(typeof registrations[id], 'function', `missing renderer for ${id}`);
      registrations[id](host);
      return host;
    },
    findAll: dom.findAll,
  };
}

function plainMcpValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadProgressRuntime(seed = {}) {
  const storage = new Map(Object.entries(seed));
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };
  const context = {
    localStorage,
    window: { addEventListener() {} },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'progress.js'), 'utf8'),
    context,
    { filename: path.join(__dirname, 'progress.js') }
  );
  return { api: context.window.AIFSProgress, storage };
}

function loadFigureRuntime({ reducedMotion = false } = {}) {
  let nextFrame = 0;
  let cancelledFrames = 0;
  const scheduledFrames = new Map();
  const windowListeners = {};

  function element(tagName) {
    const listeners = {};
    const node = {
      tagName,
      id: '',
      className: '',
      textContent: '',
      disabled: false,
      hidden: false,
      dataset: {},
      attributes: {},
      children: [],
      parentNode: null,
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
      },
      getAttribute(name) { return this.attributes[name] || null; },
      removeAttribute(name) { delete this.attributes[name]; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child, before) {
        child.parentNode = this;
        const index = before ? this.children.indexOf(before) : -1;
        if (index >= 0) this.children.splice(index, 0, child);
        else this.children.push(child);
        return child;
      },
      removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) this.children.splice(index, 1);
        child.parentNode = null;
        return child;
      },
      addEventListener(type, handler) { listeners[type] = handler; },
      removeEventListener(type) { delete listeners[type]; },
      click() { if (listeners.click) listeners.click({ target: this }); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    Object.defineProperty(node, 'firstChild', {
      get() { return this.children.length ? this.children[0] : null; },
    });
    node.classList = {
      add(name) {
        const names = new Set(node.className.split(/\s+/).filter(Boolean));
        names.add(name);
        node.className = [...names].join(' ');
      },
      remove(name) {
        node.className = node.className.split(/\s+/).filter(value => value && value !== name).join(' ');
      },
      contains(name) { return node.className.split(/\s+/).includes(name); },
      toggle(name, force) {
        if (force) this.add(name);
        else this.remove(name);
      },
    };
    return node;
  }

  const head = element('head');
  const document = {
    hidden: false,
    head,
    createElement: element,
    createElementNS(_namespace, tagName) { return element(tagName); },
    createTextNode(text) { return { textContent: String(text), parentNode: null }; },
    getElementById(id) { return head.children.find(child => child.id === id) || null; },
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {
    document,
    matchMedia() { return { matches: reducedMotion }; },
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      scheduledFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      if (scheduledFrames.delete(id)) cancelledFrames++;
    },
    addEventListener(type, handler) { windowListeners[type] = handler; },
    removeEventListener(type) { delete windowListeners[type]; },
  };
  const context = {
    console,
    document,
    performance: { now() { return 0; } },
    window,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'lesson-figures.js'), 'utf8'),
    context,
    { filename: path.join(__dirname, 'lesson-figures.js') }
  );
  return {
    window,
    element,
    scheduledFrames,
    dispatchWindow(type) { if (windowListeners[type]) windowListeners[type](); },
    cancelledFrames() { return cancelledFrames; },
  };
}

function loadLearningPathProgressRuntime(storage) {
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const match = lessonHtml.match(/<script id="learningPathProgressRuntime">([\s\S]*?)<\/script>/);
  assert.ok(match, 'lesson reader is missing the learning-path progress runtime');
  const context = { window: { localStorage: storage } };
  vm.runInNewContext(match[1], context, { filename: 'lesson.html#learningPathProgressRuntime' });
  return context.window.AIFSLearningPathProgress;
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    value(key) {
      return values.get(key);
    },
  };
}

function writeMarkdown(file, { name, description, version }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    `version: ${version}`,
    'license: MIT',
    'tags: [skills, testing]',
    '---',
    '',
    `# ${name}`,
    '',
  ].join('\n'));
}

test('copy controls reset from stable source labels after a language change', () => {
  const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const start = appSource.indexOf('function wireCopyButton(');
  const end = appSource.indexOf('function initCopyButton()', start);
  assert.ok(start >= 0 && end > start, 'app.js should expose wireCopyButton before initCopyButton');
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  let language = 'zh';
  const translations = {
    zh: {
      copy: '复制',
      'Copy command': '复制命令',
      copied: '已复制',
      'Command copied': '命令已复制',
    },
  };
  const window = {
    AIFS_I18n: { t(value) { return translations[language]?.[value] || value; } },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const document = { createElement() { return {}; }, body: { appendChild() {} } };
  const navigator = { clipboard: { writeText() { return Promise.resolve(); } } };
  const setTimeout = callback => { const id = ++timerId; timers.set(id, callback); return id; };
  const clearTimeout = id => timers.delete(id);
  const tr = value => translations[language]?.[value] || value;
  const context = { window, document, navigator, setTimeout, clearTimeout, tr };
  vm.runInNewContext(
    appSource.slice(start, end) + '\nthis.wireCopyButton = wireCopyButton;',
    context,
    { filename: 'site/app.js#copy-control' }
  );
  const buttonListeners = {};
  const button = {
    id: 'copyBtn',
    attrs: { 'aria-label': '复制命令' },
    classList: { add() {}, remove() {} },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, listener) { buttonListeners[type] = listener; },
  };
  const label = { textContent: '复制' };
  context.wireCopyButton(button, label, () => 'command');
  buttonListeners.click();

  return Promise.resolve().then(() => {
    assert.equal(label.textContent, '已复制');
    language = 'en';
    listeners.get('aifs:language-change')();
    assert.equal(label.textContent, 'copy');
    assert.equal(button.attrs['aria-label'], 'Copy command');
    for (const callback of timers.values()) callback();
    assert.equal(label.textContent, 'copy');
    assert.equal(button.attrs['aria-label'], 'Copy command');
  });
});

test('homepage lesson links use the static file route on GitHub Pages', () => {
  const lessonPath = 'phases/00-setup-and-tooling/01-dev-environment';
  const encodedPath = encodeURIComponent(lessonPath);
  const phase = {
    name: 'Setup & Tooling',
    lessons: [{
      name: 'Dev Environment',
      type: 'Build',
      lang: 'Python',
      status: 'complete',
      url: `https://github.com/example/repo/tree/main/${lessonPath}/`,
    }],
  };

  assert.ok(
    renderHomepageModalLessons('example.github.io', phase)
      .includes(`href="lesson.html?path=${encodedPath}"`)
  );
  assert.ok(
    renderHomepageModalLessons('aiengineeringfromscratch.com', phase)
      .includes(`href="lesson?path=${encodedPath}"`)
  );
  assert.ok(
    renderHomepageModalLessons('preview.vercel.app', phase)
      .includes(`href="lesson?path=${encodedPath}"`)
  );
});

test('homepage translation fallback interpolates template parameters', () => {
  const tr = loadHomepageTranslator();

  assert.equal(
    tr('{publishedLessons} published lessons. {corePhases} core phases.', {
      publishedLessons: 556,
      corePhases: 20,
    }),
    '556 published lessons. 20 core phases.'
  );
  assert.equal(tr('{known} and {missing}', { known: 0 }), '0 and {missing}');
});

test('about fallback counts stay aligned with the curriculum summary', () => {
  const root = path.resolve(__dirname, '..');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'));
  const phases = parseReadme(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), roadmap);
  const learningPaths = parseLearningPaths(root, phases);
  const certifications = parseCertifications();
  const summary = {
    corePhases: phases.length,
    coreLessons: phases.reduce((total, phase) => total + phase.lessons.length, 0),
    focusedLearningPaths: learningPaths.length,
    certificationTracks: certifications.tracks.length,
    certificationLessons: Object.keys(certifications.lessonsByPath).length,
  };

  assert.doesNotThrow(() => assertAboutCurriculumSummary(summary));

  for (const [field, label] of [
    ['corePhases', 'core phases'],
    ['coreLessons', 'core lessons'],
    ['focusedLearningPaths', 'focused paths'],
    ['certificationTracks', 'certification tracks'],
    ['certificationLessons', 'certification lessons'],
  ]) {
    const drifted = { ...summary, [field]: summary[field] + 1 };
    assert.throws(
      () => assertAboutCurriculumSummary(drifted),
      {
        name: 'Error',
        message: `about.html static fallback ${label} drift: expected ${drifted[field]}, found ${summary[field]}`,
      }
    );
  }
});

test('catalog lesson links use static Pages routes and preserve remote URLs', () => {
  const lessonPath = 'phases/01-math-foundations/01-linear-algebra-intuition';
  const sourceUrl = `https://github.com/example/repo/tree/main/${lessonPath}/`;
  const encodedPath = encodeURIComponent(lessonPath);
  const remoteUrl = 'https://example.com/resources/external-lesson';

  assert.equal(loadCatalogLessonHref('example.github.io')(sourceUrl), `lesson.html?path=${encodedPath}`);
  assert.equal(loadCatalogLessonHref('aiengineeringfromscratch.com')(sourceUrl), `lesson?path=${encodedPath}`);
  assert.equal(loadCatalogLessonHref('preview.vercel.app')(sourceUrl), `lesson?path=${encodedPath}`);
  assert.equal(loadCatalogLessonHref('example.github.io')(remoteUrl), remoteUrl);
  assert.match(
    fs.readFileSync(path.join(__dirname, 'catalog.html'), 'utf8'),
    /var href = lessonHref\(r\.url\);/,
    'the catalog renderer should use the deployment-aware route helper'
  );
});

test('catalog group headings localize the phase label and lesson count', () => {
  const english = loadCatalogGroupHeadingHtml(null);
  assert.equal(
    english(1, 'Math &amp; Foundations', 3),
    'Phase 01: Math &amp;amp; Foundations<span class="catalog-group-count">3 lessons</span>'
  );

  const chinese = loadCatalogGroupHeadingHtml({
    catalogPhase(phase, name) { return `第 ${String(phase).padStart(2, '0')} 阶段：${name}`; },
    catalogLesson(count) { return `${count} 节课程`; },
  });
  assert.equal(
    chinese(1, '数学基础', 3),
    '第 01 阶段：数学基础<span class="catalog-group-count">3 节课程</span>'
  );
});

test('shared site asset families use the expected cache keys on every page', () => {
  const sourceFor = page => fs.readFileSync(path.join(__dirname, page), 'utf8');
  const versionFor = (source, asset) => {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`(?:src|href)=["'](?:[^"']*/)?${escaped}\\?v=([a-z0-9.-]+)`, 'i'));
    assert.ok(match, `${asset} is missing a cache key`);
    return match[1];
  };
  const styleRelease = '20260824a';
  const contentRelease = asset => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, asset), 'utf8'))
    .digest('hex')
    .slice(0, 12);
  const dataRelease = versionFor(sourceFor('index.html'), 'data.js');
  const progressRelease = '20260828a';
  const navigationRelease = contentRelease('header.js');
  const cmdPaletteRelease = contentRelease('cmdpalette.js');
  const appRelease = contentRelease('app.js');
  const roadmapStyleRelease = '20260822a';
  const roadmapScriptRelease = contentRelease('roadmap.js');
  const narrationRelease = '20260829a';
  const pages = [
    'about.html',
    'assessment.html',
    'catalog.html',
    'certification.html',
    'certifications.html',
    'glossary.html',
    'index.html',
    'lesson.html',
    'prereqs.html',
  ];
  for (const page of pages) {
    const source = sourceFor(page);
    assert.equal(versionFor(source, 'style.css'), styleRelease, `${page} has stale style.css`);
    assert.equal(versionFor(source, 'data.js'), dataRelease, `${page} has stale data.js`);
    assert.equal(versionFor(source, 'progress.js'), progressRelease, `${page} has stale progress.js`);
    assert.equal(versionFor(source, 'header.js'), navigationRelease, `${page} has stale header.js`);
    assert.equal(versionFor(source, 'cmdpalette.js'), cmdPaletteRelease, `${page} has stale cmdpalette.js`);
  }

  assert.equal(versionFor(sourceFor('index.html'), 'app.js'), appRelease);
  assert.equal(versionFor(sourceFor('prereqs.html'), 'roadmap.css'), roadmapStyleRelease);
  assert.equal(versionFor(sourceFor('prereqs.html'), 'roadmap.js'), roadmapScriptRelease);
  assert.match(
    fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8'),
    new RegExp(`NARRATION_VERSION = '${narrationRelease}'`)
  );
});

test('site build refreshes cache keys after generated data changes and then settles', t => {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-site-cache-'));
  t.after(() => fs.rmSync(siteDir, { recursive: true, force: true }));
  const assets = [
    'langs.js',
    'i18n-data.js',
    'i18n-figures.js',
    'i18n-glossary.js',
    'ui-i18n.js',
    'lang-picker.js',
    'content-source.js',
    'header.js',
    'data.js',
    'app.js',
    'cmdpalette.js',
    'roadmap.js',
  ];
  for (const asset of assets) fs.writeFileSync(path.join(siteDir, asset), `first ${asset}\n`);
  fs.writeFileSync(
    path.join(siteDir, 'index.html'),
    assets.map((asset, index) => `<script src=${index % 2 ? "'" : '"'}${asset}?v=stale${index % 2 ? "'" : '"'}></script>`).join('\n')
  );

  const versions = syncI18nAssetVersions(siteDir);
  const firstHtml = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  assert.equal(versions['data.js'], crypto.createHash('sha256').update('first data.js\n').digest('hex').slice(0, 12));
  assert.match(firstHtml, new RegExp(`data\\.js\\?v=${versions['data.js']}`));
  assert.match(firstHtml, new RegExp(`app\\.js\\?v=${versions['app.js']}`));
  assert.match(firstHtml, new RegExp(`header\\.js\\?v=${versions['header.js']}`));

  fs.writeFileSync(path.join(siteDir, 'data.js'), 'second data.js\n');
  const changedVersions = syncI18nAssetVersions(siteDir);
  const changedHtml = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  assert.notEqual(changedVersions['data.js'], versions['data.js']);
  assert.match(changedHtml, new RegExp(`data\\.js\\?v=${changedVersions['data.js']}`));
  assert.match(changedHtml, new RegExp(`app\\.js\\?v=${versions['app.js']}`));

  syncI18nAssetVersions(siteDir);
  assert.equal(fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8'), changedHtml);
});

test('README autosync rebuilds after a push race and stages only README outputs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-readme-autosync-'));
  const origin = path.join(root, 'origin.git');
  const checkout = path.join(root, 'checkout');
  const racer = path.join(root, 'racer');
  const script = workflowRunScript('commit + push if README changed');

  try {
    runChecked('git', ['init', '--bare', '--initial-branch=main', origin], root);
    runChecked('git', ['init', '--initial-branch=main', checkout], root);
    runChecked('git', ['config', 'user.name', 'fixture'], checkout);
    runChecked('git', ['config', 'user.email', 'fixture@example.com'], checkout);
    runChecked('git', ['config', 'commit.gpgSign', 'false'], checkout);
    fs.mkdirSync(path.join(root, 'hooks'));
    runChecked('git', ['config', 'core.hooksPath', path.join(root, 'hooks')], checkout);
    fs.mkdirSync(path.join(checkout, 'scripts'));
    fs.mkdirSync(path.join(checkout, 'i18n', 'zh'), { recursive: true });
    fs.writeFileSync(path.join(checkout, '.gitignore'), 'catalog.json\n');
    fs.writeFileSync(path.join(checkout, 'source.txt'), 'first\n');
    fs.writeFileSync(path.join(checkout, 'README.md'), 'old readme\n');
    fs.writeFileSync(path.join(checkout, 'i18n', 'zh', 'README.md'), 'old translation\n');
    fs.writeFileSync(path.join(checkout, 'i18n', 'zh', 'manual.json'), '{"source":true}\n');
    fs.writeFileSync(
      path.join(checkout, 'scripts', 'build_catalog.py'),
      "from pathlib import Path\nPath('catalog.json').write_text('catalog:' + Path('source.txt').read_text())\n"
    );
    fs.writeFileSync(
      path.join(checkout, 'scripts', 'check_readme_counts.py'),
      [
        'import sys',
        'from pathlib import Path',
        "expected = 'readme:' + Path('source.txt').read_text()",
        "if '--fix' in sys.argv:",
        "    Path('README.md').write_text(expected)",
        "elif Path('README.md').read_text() != expected:",
        '    raise SystemExit(1)',
      ].join('\n') + '\n'
    );
    fs.writeFileSync(
      path.join(checkout, 'scripts', 'build_readme_i18n.py'),
      [
        'from pathlib import Path',
        "source = Path('source.txt').read_text()",
        "Path('i18n/zh/README.md').write_text('zh:' + source)",
      ].join('\n') + '\n'
    );
    runChecked('git', ['add', '.'], checkout);
    runChecked('git', ['commit', '-m', 'chore(readme): sync counts prior'], checkout);
    runChecked('git', ['remote', 'add', 'origin', origin], checkout);
    runChecked('git', ['push', '-u', 'origin', 'main'], checkout);

    runChecked('python3', ['scripts/build_catalog.py'], checkout);
    runChecked('python3', ['scripts/check_readme_counts.py', '--fix'], checkout);
    runChecked('python3', ['scripts/build_readme_i18n.py'], checkout);
    fs.writeFileSync(path.join(checkout, 'i18n', 'zh', 'manual.json'), '{"source":false}\n');

    runChecked('git', ['clone', origin, racer], root);
    runChecked('git', ['config', 'user.name', 'racer'], racer);
    runChecked('git', ['config', 'user.email', 'racer@example.com'], racer);
    runChecked('git', ['config', 'commit.gpgSign', 'false'], racer);
    runChecked('git', ['config', 'core.hooksPath', path.join(root, 'hooks')], racer);
    fs.writeFileSync(path.join(racer, 'source.txt'), 'raced\n');
    runChecked('git', ['add', 'source.txt'], racer);
    runChecked('git', ['commit', '-m', 'advance main during README build'], racer);
    runChecked('git', ['push', 'origin', 'main'], racer);

    const syncOutput = runChecked('bash', ['-eu', '-o', 'pipefail', '-c', script], checkout, {
      BOT_COMMIT_PREFIX: 'chore(readme): sync counts',
      GITHUB_REF: 'refs/heads/main',
    });
    assert.match(syncOutput, /push attempt 1 rejected; rebuilding from origin\/main/);
    assert.equal(fs.readFileSync(path.join(checkout, 'README.md'), 'utf8'), 'readme:raced\n');
    assert.equal(fs.readFileSync(path.join(checkout, 'i18n', 'zh', 'README.md'), 'utf8'), 'zh:raced\n');
    assert.deepEqual(
      runChecked('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], checkout).trim().split('\n').sort(),
      ['README.md', 'i18n/zh/README.md']
    );
    assert.equal(runChecked('git', ['status', '--short'], checkout).trim(), 'M i18n/zh/manual.json');

    const commitsBefore = runChecked('git', ['rev-list', '--count', 'HEAD'], checkout).trim();
    const settledOutput = runChecked('bash', ['-eu', '-o', 'pipefail', '-c', script], checkout, {
      BOT_COMMIT_PREFIX: 'chore(readme): sync counts',
      GITHUB_REF: 'refs/heads/main',
    });
    assert.match(settledOutput, /README.md \+ translations already in sync/);
    assert.equal(runChecked('git', ['rev-list', '--count', 'HEAD'], checkout).trim(), commitsBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('README autosync fails when every push attempt is rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-readme-autosync-failure-'));
  const origin = path.join(root, 'origin.git');
  const checkout = path.join(root, 'checkout');
  const bin = path.join(root, 'bin');
  const script = workflowRunScript('commit + push if README changed');

  try {
    runChecked('git', ['init', '--bare', '--initial-branch=main', origin], root);
    runChecked('git', ['init', '--initial-branch=main', checkout], root);
    fs.mkdirSync(path.join(checkout, 'scripts'));
    fs.mkdirSync(path.join(checkout, 'i18n', 'zh'), { recursive: true });
    fs.mkdirSync(bin);
    runChecked('git', ['config', 'user.name', 'fixture'], checkout);
    runChecked('git', ['config', 'user.email', 'fixture@example.com'], checkout);
    runChecked('git', ['config', 'commit.gpgSign', 'false'], checkout);
    fs.mkdirSync(path.join(root, 'hooks'));
    runChecked('git', ['config', 'core.hooksPath', path.join(root, 'hooks')], checkout);
    fs.writeFileSync(path.join(checkout, 'source.txt'), 'new\n');
    fs.writeFileSync(path.join(checkout, 'README.md'), 'old\n');
    fs.writeFileSync(path.join(checkout, 'i18n', 'zh', 'README.md'), 'old\n');
    fs.writeFileSync(path.join(checkout, 'scripts', 'build_catalog.py'), '\n');
    fs.writeFileSync(
      path.join(checkout, 'scripts', 'check_readme_counts.py'),
      "from pathlib import Path\nPath('README.md').write_text('readme:' + Path('source.txt').read_text())\n"
    );
    fs.writeFileSync(
      path.join(checkout, 'scripts', 'build_readme_i18n.py'),
      "from pathlib import Path\nPath('i18n/zh/README.md').write_text('zh:' + Path('source.txt').read_text())\n"
    );
    runChecked('git', ['add', '.'], checkout);
    runChecked('git', ['commit', '-m', 'initial'], checkout);
    runChecked('git', ['remote', 'add', 'origin', origin], checkout);
    runChecked('git', ['push', '-u', 'origin', 'main'], checkout);
    runChecked('python3', ['scripts/check_readme_counts.py', '--fix'], checkout);
    runChecked('python3', ['scripts/build_readme_i18n.py'], checkout);

    const realGit = runChecked('sh', ['-c', 'command -v git'], checkout).trim();
    const gitWrapper = path.join(bin, 'git');
    fs.writeFileSync(
      gitWrapper,
      `#!/bin/sh\nif [ "$1" = push ]; then exit 1; fi\nexec ${JSON.stringify(realGit)} "$@"\n`
    );
    fs.chmodSync(gitWrapper, 0o755);
    const sleepWrapper = path.join(bin, 'sleep');
    fs.writeFileSync(sleepWrapper, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(sleepWrapper, 0o755);

    const result = runCommand('bash', ['-eu', '-o', 'pipefail', '-c', script], checkout, {
      BOT_COMMIT_PREFIX: 'chore(readme): sync counts',
      GITHUB_REF: 'refs/heads/main',
      PATH: bin + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /push failed after 5 attempts; README translations remain stale/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('site autosync stages all tracked build outputs, pushes, and then stays clean', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-site-autosync-'));
  const origin = path.join(root, 'origin.git');
  const checkout = path.join(root, 'checkout');
  const racer = path.join(root, 'racer');
  const script = workflowRunScript('commit + push if generated site artifacts changed');

  try {
    runChecked('git', ['init', '--bare', '--initial-branch=main', origin], root);
    runChecked('git', ['init', '--initial-branch=main', checkout], root);
    runChecked('git', ['config', 'user.name', 'fixture'], checkout);
    runChecked('git', ['config', 'user.email', 'fixture@example.com'], checkout);
    runChecked('git', ['config', 'commit.gpgSign', 'false'], checkout);
    fs.mkdirSync(path.join(root, 'hooks'));
    runChecked('git', ['config', 'core.hooksPath', path.join(root, 'hooks')], checkout);
    fs.mkdirSync(path.join(checkout, 'site'));
    fs.writeFileSync(path.join(checkout, 'README.md'), 'old count\n');
    fs.writeFileSync(path.join(checkout, 'site', 'data.js'), 'old data\n');
    fs.writeFileSync(path.join(checkout, 'site', 'cmdpalette.js'), 'old count\n');
    fs.writeFileSync(path.join(checkout, 'site', 'index.html'), '<script src="data.js?v=old"></script>\n');
    fs.writeFileSync(path.join(checkout, 'site', 'deleted.html'), 'obsolete generated page\n');
    fs.writeFileSync(path.join(checkout, 'site', 'source.js'), 'source code\n');
    fs.writeFileSync(path.join(checkout, 'source.txt'), 'first\n');
    fs.writeFileSync(
      path.join(checkout, 'site', 'build.js'),
      [
        "const fs = require('node:fs');",
        "const crypto = require('node:crypto');",
        "const source = fs.readFileSync('source.txt', 'utf8').trim();",
        "const data = 'data:' + source + '\\n';",
        "fs.writeFileSync('README.md', 'readme:' + source + '\\n');",
        "fs.writeFileSync('site/data.js', data);",
        "fs.writeFileSync('site/cmdpalette.js', 'palette:' + source + '\\n');",
        "const version = crypto.createHash('sha256').update(data).digest('hex').slice(0, 12);",
        `fs.writeFileSync('site/index.html', '<script src="data.js?v=' + version + '"></script>\\n');`,
        "fs.rmSync('site/deleted.html', { force: true });",
      ].join('\n')
    );
    runChecked('git', ['add', '.'], checkout);
    runChecked('git', ['commit', '-m', 'initial'], checkout);
    runChecked('git', ['remote', 'add', 'origin', origin], checkout);
    runChecked('git', ['push', '-u', 'origin', 'main'], checkout);

    runChecked('node', ['site/build.js'], checkout);
    fs.writeFileSync(path.join(checkout, 'site', 'source.js'), 'unrelated edit\n');
    runChecked('git', ['clone', origin, racer], root);
    runChecked('git', ['config', 'user.name', 'racer'], racer);
    runChecked('git', ['config', 'user.email', 'racer@example.com'], racer);
    runChecked('git', ['config', 'commit.gpgSign', 'false'], racer);
    runChecked('git', ['config', 'core.hooksPath', path.join(root, 'hooks')], racer);
    fs.writeFileSync(path.join(racer, 'source.txt'), 'raced\n');
    runChecked('git', ['add', 'source.txt'], racer);
    runChecked('git', ['commit', '-m', 'advance main during site build'], racer);
    runChecked('git', ['push', 'origin', 'main'], racer);

    const syncOutput = runChecked('bash', ['-eu', '-o', 'pipefail', '-c', script], checkout, {
      BOT_COMMIT_PREFIX: 'chore(site): rebuild generated artifacts',
      GITHUB_REF: 'refs/heads/main',
    });
    assert.match(syncOutput, /push attempt 1 rejected; rebuilding from origin\/main/);
    assert.equal(runChecked('git', ['log', '-1', '--pretty=%s'], checkout).trim(), 'chore(site): rebuild generated artifacts');
    assert.equal(
      runChecked('git', ['rev-parse', 'HEAD'], checkout).trim(),
      runChecked('git', ['--git-dir', origin, 'rev-parse', 'refs/heads/main'], root).trim()
    );
    assert.equal(fs.readFileSync(path.join(checkout, 'site', 'data.js'), 'utf8'), 'data:raced\n');
    assert.deepEqual(
      runChecked('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], checkout).trim().split('\n').sort(),
      ['README.md', 'site/cmdpalette.js', 'site/data.js', 'site/deleted.html', 'site/index.html']
    );
    assert.equal(runChecked('git', ['status', '--short'], checkout).trim(), 'M site/source.js');

    const commitsBefore = runChecked('git', ['rev-list', '--count', 'HEAD'], checkout).trim();
    runChecked('node', ['site/build.js'], checkout);
    const settledOutput = runChecked('bash', ['-eu', '-o', 'pipefail', '-c', script], checkout, {
      BOT_COMMIT_PREFIX: 'chore(site): rebuild generated artifacts',
      GITHUB_REF: 'refs/heads/main',
    });
    assert.match(settledOutput, /generated site artifacts already in sync/);
    assert.equal(runChecked('git', ['rev-list', '--count', 'HEAD'], checkout).trim(), commitsBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('site autosync fails when every push attempt is rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-site-autosync-failure-'));
  const origin = path.join(root, 'origin.git');
  const checkout = path.join(root, 'checkout');
  const bin = path.join(root, 'bin');
  const script = workflowRunScript('commit + push if generated site artifacts changed');

  try {
    runChecked('git', ['init', '--bare', '--initial-branch=main', origin], root);
    runChecked('git', ['init', '--initial-branch=main', checkout], root);
    fs.mkdirSync(path.join(checkout, 'site'));
    fs.mkdirSync(bin);
    runChecked('git', ['config', 'user.name', 'fixture'], checkout);
    runChecked('git', ['config', 'user.email', 'fixture@example.com'], checkout);
    runChecked('git', ['config', 'commit.gpgSign', 'false'], checkout);
    runChecked('git', ['config', 'core.hooksPath', path.join(root, 'hooks')], checkout);
    fs.mkdirSync(path.join(root, 'hooks'));
    fs.writeFileSync(path.join(checkout, 'README.md'), 'old\n');
    fs.writeFileSync(path.join(checkout, 'site', 'data.js'), 'old\n');
    fs.writeFileSync(path.join(checkout, 'site', 'cmdpalette.js'), 'old\n');
    fs.writeFileSync(path.join(checkout, 'site', 'index.html'), 'old\n');
    fs.writeFileSync(path.join(checkout, 'site', 'build.js'), "require('node:fs').writeFileSync('site/data.js', 'new\\n');\n");
    runChecked('git', ['add', '.'], checkout);
    runChecked('git', ['commit', '-m', 'initial'], checkout);
    runChecked('git', ['remote', 'add', 'origin', origin], checkout);
    runChecked('git', ['push', '-u', 'origin', 'main'], checkout);
    fs.writeFileSync(path.join(checkout, 'site', 'data.js'), 'new\n');

    const realGit = runChecked('sh', ['-c', 'command -v git'], checkout).trim();
    const gitWrapper = path.join(bin, 'git');
    fs.writeFileSync(
      gitWrapper,
      `#!/bin/sh\nif [ "$1" = push ]; then exit 1; fi\nexec ${JSON.stringify(realGit)} "$@"\n`
    );
    fs.chmodSync(gitWrapper, 0o755);
    const sleepWrapper = path.join(bin, 'sleep');
    fs.writeFileSync(sleepWrapper, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(sleepWrapper, 0o755);

    const result = runCommand('bash', ['-eu', '-o', 'pipefail', '-c', script], checkout, {
      BOT_COMMIT_PREFIX: 'chore(site): rebuild generated artifacts',
      GITHUB_REF: 'refs/heads/main',
      PATH: bin + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /push failed after 5 attempts; generated site artifacts remain stale/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('build-time SEO manifests cover every readable lesson and expose canonical no-JavaScript discovery links', () => {
  const root = path.resolve(__dirname, '..');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'));
  const phases = parseReadme(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), roadmap);
  const learningPaths = parseLearningPaths(root, phases);
  const certifications = parseCertifications();
  const { lessonManifest, certificationManifest } = buildSeoManifests(phases, certifications, learningPaths);
  const expectedCoursePaths = phases.flatMap(phase => phase.lessons.map(lesson => {
    const match = lesson.url && lesson.url.match(/(phases\/[^/?#]+\/[^/?#]+)/);
    if (!match || !fs.existsSync(path.join(root, match[1], 'docs', 'en.md'))) return null;
    return match[1];
  }).filter(Boolean));
  const expectedCertificationPaths = Object.keys(certifications.lessonsByPath);
  const expectedPaths = expectedCoursePaths.concat(expectedCertificationPaths).sort();

  assert.equal(lessonManifest.version, 1);
  assert.deepEqual(
    lessonManifest.certificationTrackIds,
    certifications.tracks.map(track => track.id).sort()
  );
  assert.deepEqual(Object.keys(lessonManifest.lessons).sort(), expectedPaths);
  assert.equal(certificationManifest.version, 1);
  assert.equal(Object.keys(certificationManifest.tracks).length, 4);

  function inspectKeys(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['quiz', 'questions', 'correct', 'options', 'answerKey'].includes(key), `SEO manifest leaked ${key}`);
      inspectKeys(child);
    }
  }
  inspectKeys(lessonManifest);

  const lessonEntries = Object.values(lessonManifest.lessons);
  assert.equal(new Set(lessonEntries.map(entry => entry.seoTitle)).size, lessonEntries.length);
  const visionTransformerEntries = [
    lessonManifest.lessons['phases/04-computer-vision/14-vision-transformers'],
    lessonManifest.lessons['phases/07-transformers-deep-dive/09-vision-transformers'],
  ];
  assert.ok(visionTransformerEntries.every(entry => entry.title === 'Vision Transformers (ViT)'));
  assert.equal(new Set(visionTransformerEntries.map(entry => entry.seoTitle)).size, 2);
  assert.match(visionTransformerEntries[0].seoTitle, /Computer Vision/);
  assert.match(visionTransformerEntries[1].seoTitle, /Transformers Deep Dive/);

  const expectedLearningPathIds = new Map();
  for (const learningPath of learningPaths) {
    for (const lesson of learningPath.lessons.concat(learningPath.optionalLessons)) {
      const ids = expectedLearningPathIds.get(lesson.path) || [];
      ids.push(learningPath.id);
      expectedLearningPathIds.set(lesson.path, ids);
    }
  }
  const expectedFromTrackIds = new Map();
  const expectedSourcePrefix = 'https://github.com/' + resolveRepository(process.env) + '/';
  for (const track of certifications.tracks) {
    for (const lesson of track.lessons) {
      if (lesson.path.startsWith('certifications/')) continue;
      const ids = expectedFromTrackIds.get(lesson.path) || [];
      ids.push(track.id);
      expectedFromTrackIds.set(lesson.path, ids);
    }
  }

  for (const [lessonPath, entry] of Object.entries(lessonManifest.lessons)) {
    assert.equal(entry.path, lessonPath);
    const expectedKeys = ['path', 'title', 'seoTitle', 'description', 'excerpt', 'context', 'previous', 'next'];
    if (entry.context.kind === 'certification') expectedKeys.push('navigationByTrack');
    expectedKeys.push('learningPathIds');
    expectedKeys.push('fromTrackIds');
    expectedKeys.push('sourceUrl', 'canonicalUrl');
    assert.deepEqual(
      Object.keys(entry),
      expectedKeys
    );
    assert.ok(entry.title && entry.seoTitle && entry.description && entry.excerpt);
    assert.ok(entry.seoTitle.length <= 60);
    assert.ok(entry.description.length <= 160);
    assert.ok(entry.excerpt.split(/\s+/).length <= 220);
    assert.match(entry.canonicalUrl, /^https:\/\/aiengineeringfromscratch\.com\/lesson\?path=/);
    assert.doesNotMatch(entry.canonicalUrl, /lesson\.html|[&?](?:track|learningPath)=/);
    assert.ok(
      entry.sourceUrl.startsWith(expectedSourcePrefix),
      'source URL should follow the active repository: ' + entry.sourceUrl
    );
    assert.ok(['course', 'certification'].includes(entry.context.kind));
    assert.deepEqual(entry.learningPathIds, (expectedLearningPathIds.get(lessonPath) || []).sort());
    assert.deepEqual(entry.fromTrackIds, (expectedFromTrackIds.get(lessonPath) || []).sort());
    for (const neighbor of [entry.previous, entry.next]) {
      if (!neighbor) continue;
      assert.deepEqual(Object.keys(neighbor), ['path', 'title', 'canonicalUrl']);
      assert.equal(neighbor.canonicalUrl, lessonManifest.lessons[neighbor.path].canonicalUrl);
    }
    if (entry.context.kind === 'certification') {
      assert.deepEqual(
        Object.keys(entry.navigationByTrack).sort(),
        [...new Set(entry.context.trackIds)].sort()
      );
      for (const navigation of Object.values(entry.navigationByTrack)) {
        for (const neighbor of [navigation.previous, navigation.next]) {
          if (!neighbor) continue;
          assert.deepEqual(Object.keys(neighbor), ['path', 'title', 'canonicalUrl']);
          assert.equal(neighbor.canonicalUrl, lessonManifest.lessons[neighbor.path].canonicalUrl);
        }
      }
    }
  }

  const trackEntries = Object.values(certificationManifest.tracks);
  for (const field of ['title', 'description', 'excerpt', 'canonicalUrl']) {
    assert.equal(new Set(trackEntries.map(track => track[field])).size, 4, `track ${field} values are not unique`);
  }
  for (const track of trackEntries) {
    assert.ok(track.seoTitle.length <= 60);
    assert.ok(track.description.length <= 160);
    assert.ok(track.excerpt.split(/\s+/).length <= 220);
    assert.match(track.canonicalUrl, /^https:\/\/aiengineeringfromscratch\.com\/certification\?id=/);
    assert.doesNotMatch(track.canonicalUrl, /certification\.html/);
    assert.ok(track.lessons.length > 0);
    for (const lesson of track.lessons) {
      assert.equal(lesson.canonicalUrl, lessonManifest.lessons[lesson.path].canonicalUrl);
    }
  }

  const catalogDiscovery = renderCatalogDiscovery(phases, lessonManifest);
  const certificationDiscovery = renderCertificationDiscovery(certifications, certificationManifest);
  assert.equal((catalogDiscovery.match(/href="lesson\?path=/g) || []).length, expectedCoursePaths.length);
  assert.equal((certificationDiscovery.match(/href="certification\?id=/g) || []).length, 4);
  assert.ok((certificationDiscovery.match(/href="lesson\?path=/g) || []).length >= expectedCertificationPaths.length);
  assert.doesNotMatch(catalogDiscovery + certificationDiscovery, /(?:lesson|certification)\.html\?/);

  for (const file of ['index.html', 'prereqs.html']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const description = source.match(/<meta name="description" content="([^"]+)">/);
    assert.ok(description, `${file} lacks a meta description`);
    assert.ok(description[1].length <= 160, `${file} meta description exceeds 160 characters`);
  }

  const longDocument = lessonDocumentSeo(
    '# A Deliberately Long Lesson Title for Search Metadata Validation\n\n' +
    '> A compact hook that needs supporting prose before it can describe the lesson well.\n\n' +
    '## The mechanism\n\n' +
    Array.from({ length: 260 }, (_, index) => `evidence${index + 1}`).join(' '),
    'Fallback title'
  );
  assert.ok(longDocument.seoTitle.length <= 60);
  assert.ok(longDocument.description.length >= 120 && longDocument.description.length <= 160);
  assert.ok(longDocument.sourceWordCount >= 180);
  assert.ok(longDocument.excerpt.split(/\s+/).length >= 180);
  assert.ok(longDocument.excerpt.split(/\s+/).length <= 220);
});

test('site startup assets remain inside a GitHub project Pages base path', () => {
  const projectRoot = new URL('https://example.github.io/ai-engineering-from-scratch/');
  const requiredAssets = [
    'build-meta.js',
    'langs.js',
    'data.js',
    'content-source.js',
  ];
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const lessonAssets = markupAssetUrls(lessonHtml).map(target => new URL(target, projectRoot).pathname);
  for (const asset of requiredAssets) {
    assert.ok(
      lessonAssets.includes(projectRoot.pathname + asset),
      'lesson.html is missing a script/link reference for ' + asset
    );
  }

  for (const page of fs.readdirSync(__dirname).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
    assertProjectPagesAssetUrls(page, html, projectRoot);
  }
  assert.throws(
    () => assertProjectPagesAssetUrls('fixture.html', "<script src='/app.js'></script>", projectRoot),
    /root-relative asset \/app\.js/
  );
});

test('site discovery emits one bundle linked to SKILL.md and preserves flat records', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-site-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outputs = path.join(root, 'phases', '14-agent-engineering', '22-skill-runtime', 'outputs');
  const flat = path.join(outputs, 'skill-flat-reviewer.md');
  writeMarkdown(flat, {
    name: 'flat-reviewer',
    description: 'Review a flat artifact.',
    version: '1.0.0',
  });
  const bundle = path.join(outputs, 'release-gate');
  writeMarkdown(path.join(bundle, 'SKILL.md'), {
    name: 'release-gate',
    description: 'Gate a release.',
    version: '2.1.0',
  });
  writeMarkdown(path.join(bundle, 'references', 'guide.md'), {
    name: 'nested-guide',
    description: 'Not a second artifact.',
    version: '1.0.0',
  });
  fs.mkdirSync(path.join(bundle, 'scripts'));
  fs.writeFileSync(path.join(bundle, 'scripts', 'check.py'), "print('ok')\n");

  const artifacts = discoverArtifacts(root);

  assert.equal(artifacts.length, 2);
  assert.deepEqual(artifacts[0], {
    kind: 'skill',
    name: 'flat-reviewer',
    description: 'Review a flat artifact.',
    tags: ['skills', 'testing'],
    phase: 14,
    lesson: 22,
    lessonPath: 'phases/14-agent-engineering/22-skill-runtime',
    file: 'phases/14-agent-engineering/22-skill-runtime/outputs/skill-flat-reviewer.md',
  });
  assert.deepEqual(artifacts[1], {
    kind: 'skill',
    name: 'release-gate',
    description: 'Gate a release.',
    tags: ['skills', 'testing'],
    version: '2.1.0',
    license: 'MIT',
    phase: 14,
    lesson: 22,
    lessonPath: 'phases/14-agent-engineering/22-skill-runtime',
    file: 'phases/14-agent-engineering/22-skill-runtime/outputs/release-gate/SKILL.md',
    bundle: true,
    bundlePath: 'phases/14-agent-engineering/22-skill-runtime/outputs/release-gate',
    files: ['SKILL.md', 'references/guide.md', 'scripts/check.py'],
  });
});

test('site discovery rejects bundle symlinks instead of following escapes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-site-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundle = path.join(
    root,
    'phases',
    '14-agent-engineering',
    '22-skill-runtime',
    'outputs',
    'release-gate'
  );
  writeMarkdown(path.join(bundle, 'SKILL.md'), {
    name: 'release-gate',
    description: 'Gate a release.',
    version: '2.1.0',
  });
  const outside = path.join(root, 'private.txt');
  fs.writeFileSync(outside, 'do not read\n');
  fs.mkdirSync(path.join(bundle, 'references'));
  fs.symlinkSync(outside, path.join(bundle, 'references', 'private.txt'));

  assert.throws(
    () => discoverArtifacts(root),
    /Skill bundle contains a symlink/
  );
});

test('site discovery rejects a bundle reached through an escaping parent symlink', t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-site-artifacts-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const root = path.join(tempRoot, 'workspace');
  const lesson = path.join(root, 'phases', '14-agent-engineering', '22-skill-runtime');
  fs.mkdirSync(lesson, { recursive: true });
  const outsideOutputs = path.join(tempRoot, 'outside-outputs');
  writeMarkdown(path.join(outsideOutputs, 'release-gate', 'SKILL.md'), {
    name: 'release-gate',
    description: 'Gate a release.',
    version: '2.1.0',
  });
  writeMarkdown(path.join(outsideOutputs, 'skill-leaked-reviewer.md'), {
    name: 'leaked-reviewer',
    description: 'This flat artifact must never be ingested.',
    version: '1.0.0',
  });
  fs.symlinkSync(outsideOutputs, path.join(lesson, 'outputs'), 'dir');

  assert.throws(
    () => discoverArtifacts(root),
    /Lesson outputs escapes the repository/
  );
});

test('site discovery rejects an in-repository outputs directory symlink', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-site-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lesson = path.join(root, 'phases', '14-agent-engineering', '22-skill-runtime');
  const sharedOutputs = path.join(root, 'shared-outputs');
  fs.mkdirSync(lesson, { recursive: true });
  writeMarkdown(path.join(sharedOutputs, 'skill-shared-reviewer.md'), {
    name: 'shared-reviewer',
    description: 'This artifact is in the repository but behind a symlink.',
    version: '1.0.0',
  });
  fs.symlinkSync(sharedOutputs, path.join(lesson, 'outputs'), 'dir');

  assert.throws(
    () => discoverArtifacts(root),
    /Lesson outputs must be a regular directory/
  );
});

test('lesson output merging preserves bundle identity and unmatched live files', () => {
  const source = loadContentSource();
  const lesson = 'phases/13-agent-development/22-skill-runtime';
  const outputs = `${lesson}/outputs`;
  const liveReport = {
    name: 'report.json',
    path: `${outputs}/report.json`,
  };
  const live = [
    { name: 'skill-flat-reviewer.md', path: `${outputs}/skill-flat-reviewer.md` },
    { name: 'release-gate', path: `${outputs}/release-gate`, type: 'dir' },
    liveReport,
  ];
  const flat = {
    kind: 'skill',
    name: 'flat-reviewer',
    lessonPath: lesson,
    file: `${outputs}/skill-flat-reviewer.md`,
  };
  const bundle = {
    kind: 'skill',
    name: 'release-gate',
    lessonPath: lesson,
    file: `${outputs}/release-gate/SKILL.md`,
    bundle: true,
    bundlePath: `${outputs}/release-gate`,
    files: ['SKILL.md', 'references/guide.md', 'scripts/check.py'],
  };
  const artifacts = [
    flat,
    bundle,
    { kind: 'mission', name: 'mission', lessonPath: lesson, file: `${lesson}/mission.md` },
    {
      kind: 'skill',
      name: 'other-lesson',
      lessonPath: 'phases/13-agent-development/24-other',
      file: 'phases/13-agent-development/24-other/outputs/other/SKILL.md',
    },
  ];

  const merged = source.mergeLessonOutputs(lesson, live, artifacts);
  assert.equal(merged.length, 3);
  assert.equal(merged[0], flat);
  assert.equal(merged[1], bundle);
  assert.equal(merged[2], liveReport);
  assert.equal(merged[1].files, bundle.files);
  assert.deepEqual(Array.from(merged, entry => entry.name), [
    'flat-reviewer',
    'release-gate',
    'report.json',
  ]);

  const withoutDirectoryListing = source.mergeLessonOutputs(lesson, [], artifacts);
  assert.equal(withoutDirectoryListing.length, 2);
  assert.equal(withoutDirectoryListing[0], flat);
  assert.equal(withoutDirectoryListing[1], bundle);
});

test('remote content source rejects dot-segment repositories and revisions', () => {
  const invalid = loadContentSource({
    source: { owner: 'example-owner', repo: '..', revision: 'release/../private' },
    ref: 'preview/ref',
  });
  assert.equal(
    invalid.rawRepoUrl('phases/00-setup-and-tooling/01-dev-environment/docs/en.md'),
    'https://raw.githubusercontent.com/example-owner/ai-engineering-from-scratch/preview/ref/phases/00-setup-and-tooling/01-dev-environment/docs/en.md'
  );

  const invalidFallback = loadContentSource({
    source: { owner: 'example-owner', repo: 'course', revision: 'a/../b' },
    ref: '../main',
  });
  assert.equal(
    invalidFallback.rawRepoUrl('README.md'),
    'https://raw.githubusercontent.com/example-owner/course/main/README.md'
  );

  const valid = loadContentSource({
    source: { owner: 'example-owner', repo: 'course.repo', revision: 'feature/lesson-copy' },
  });
  assert.equal(
    valid.rawRepoUrl('README.md'),
    'https://raw.githubusercontent.com/example-owner/course.repo/feature/lesson-copy/README.md'
  );
});

test('learning path manifests preserve route order and use canonical lesson titles', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-learning-paths-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'learning-paths'), { recursive: true });
  fs.writeFileSync(path.join(root, 'learning-paths', 'agent-skills.json'), JSON.stringify({
    id: 'agent-skills',
    title: 'Agent Skills',
    summary: 'Build portable skills that agents can discover and invoke.',
    estimatedMinutes: 570,
    quickStart: {
      lessonPath: 'phases/13-tools-and-protocols/22-skills-and-agent-sdks',
      estimatedMinutes: 10,
      command: 'python3 code/main.py',
    },
    lessons: [
      {
        order: 1,
        path: 'phases/13-tools-and-protocols/22-skills-and-agent-sdks',
        title: 'Stale title',
        minutes: 90,
        group: 'core',
        checkpointEvidence: ['A real host invocation transcript.'],
      },
      {
        order: 2,
        path: 'phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure',
        prerequisitePaths: ['phases/13-tools-and-protocols/22-skills-and-agent-sdks'],
      },
    ],
    optionalLessons: [
      { path: 'phases/13-tools-and-protocols/23-capstone-tool-ecosystem' },
    ],
  }));
  const github = 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/';
  const phases = [{
    id: 13,
    name: 'Tools and Protocols',
    lessons: [
      { name: 'Skills and Agent SDKs', type: 'Build', lang: 'Python', url: github + 'phases/13-tools-and-protocols/22-skills-and-agent-sdks/' },
      { name: 'Tool Ecosystem Capstone', type: 'Capstone', lang: 'Python', url: github + 'phases/13-tools-and-protocols/23-capstone-tool-ecosystem/' },
      { name: 'Skill Discovery and Progressive Disclosure', type: 'Learn', lang: 'Python', url: github + 'phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/' },
    ],
  }];

  const [learningPath] = parseLearningPaths(root, phases);

  assert.equal(learningPath.id, 'agent-skills');
  assert.deepEqual(learningPath.lessons.map(entry => entry.path), [
    'phases/13-tools-and-protocols/22-skills-and-agent-sdks',
    'phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure',
  ]);
  assert.deepEqual(learningPath.lessons.map(entry => entry.title), [
    'Skills and Agent SDKs',
    'Skill Discovery and Progressive Disclosure',
  ]);
  assert.equal(learningPath.lessons[0].required, true);
  assert.equal(learningPath.lessons[0].minutes, 90);
  assert.equal(learningPath.lessons[0].group, 'core');
  assert.deepEqual(learningPath.lessons[0].checkpointEvidence, ['A real host invocation transcript.']);
  assert.equal(learningPath.quickStart.estimatedMinutes, 10);
  assert.equal(learningPath.quickStart.command, 'python3 code/main.py');
  assert.deepEqual(learningPath.lessons[1].prerequisitePaths, [
    'phases/13-tools-and-protocols/22-skills-and-agent-sdks',
  ]);
  assert.equal(learningPath.optionalLessons[0].required, false);
});

test('learning path manifests reject duplicate and unresolved prerequisite checks', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-learning-paths-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'learning-paths'), { recursive: true });
  const lessonPath = 'phases/13-tools-and-protocols/22-skills-and-agent-sdks';
  const phases = [{
    id: 13,
    name: 'Tools and Protocols',
    lessons: [{
      name: 'Skills and Agent SDKs',
      type: 'Build',
      lang: 'Python',
      url: 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/' + lessonPath + '/',
    }],
  }];
  const manifestFile = path.join(root, 'learning-paths', 'agent-skills.json');

  fs.writeFileSync(manifestFile, JSON.stringify({
    id: 'agent-skills',
    prerequisites: [{ id: 'poisoning' }, { id: 'poisoning' }],
    lessons: [{ path: lessonPath, prerequisiteChecks: ['poisoning'] }],
  }));
  assert.throws(
    () => parseLearningPaths(root, phases),
    /repeats prerequisite id: poisoning/
  );

  fs.writeFileSync(manifestFile, JSON.stringify({
    id: 'agent-skills',
    prerequisites: [{ id: 'poisoning' }],
    lessons: [{ path: lessonPath, prerequisiteChecks: ['poisoning-typo'] }],
  }));
  assert.throws(
    () => parseLearningPaths(root, phases),
    /references an unknown prerequisite check: poisoning-typo/
  );
});

test('learning path manifests reject invalid prerequisite path graphs', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-learning-paths-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'learning-paths'), { recursive: true });
  const paths = [
    'phases/13-tools-and-protocols/22-skills-and-agent-sdks',
    'phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure',
    'phases/13-tools-and-protocols/25-skill-invocation-and-routing',
  ];
  const github = 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/';
  const phases = [{
    id: 13,
    name: 'Tools and Protocols',
    lessons: paths.map((lessonPath, index) => ({
      name: `Lesson ${index + 1}`,
      type: 'Build',
      lang: 'Python',
      url: github + lessonPath + '/',
    })),
  }];
  const manifestFile = path.join(root, 'learning-paths', 'route.json');
  const writeRoute = lessons => fs.writeFileSync(
    manifestFile,
    JSON.stringify({ id: 'route', lessons })
  );

  writeRoute([
    { path: paths[0] },
    { path: paths[1], prerequisitePaths: ['phases/13-tools-and-protocols/99-missing'] },
  ]);
  assert.throws(
    () => parseLearningPaths(root, phases),
    /references an unknown prerequisite path/
  );

  writeRoute([
    { path: paths[0] },
    { path: paths[1], prerequisitePaths: [paths[1]] },
  ]);
  assert.throws(
    () => parseLearningPaths(root, phases),
    /cannot depend on itself/
  );

  writeRoute([
    { path: paths[0], prerequisitePaths: [paths[1]] },
    { path: paths[1] },
  ]);
  assert.throws(
    () => parseLearningPaths(root, phases),
    /has a forward prerequisite/
  );

  writeRoute([
    { path: paths[0], prerequisitePaths: [paths[1]] },
    { path: paths[1], prerequisitePaths: [paths[0]] },
  ]);
  assert.throws(
    () => parseLearningPaths(root, phases),
    /contains a prerequisite cycle/
  );
});

test('repository Agent Skills path routes 22 to 24 and keeps 23 optional', () => {
  const root = path.resolve(__dirname, '..');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'));
  const phases = parseReadme(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), roadmap);
  const learningPath = parseLearningPaths(root, phases).find(entry => entry.id === 'agent-skills');

  assert.ok(learningPath);
  assert.deepEqual(learningPath.lessons.map(entry => entry.lesson), [22, 24, 25, 26, 27]);
  assert.deepEqual(learningPath.optionalLessons.map(entry => entry.lesson), [23]);
  assert.equal(learningPath.lessons[0].path, 'phases/13-tools-and-protocols/22-skills-and-agent-sdks');
  assert.equal(learningPath.lessons[1].path, 'phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure');
  assert.deepEqual(learningPath.lessons[3].prerequisitePaths, [
    'phases/13-tools-and-protocols/25-skill-invocation-and-routing',
  ]);
  assert.deepEqual(learningPath.lessons[3].prerequisiteChecks, [
    'tool-poisoning-and-untrusted-instructions',
  ]);
  const poisoningPreflight = learningPath.prerequisites.find(
    entry => entry.id === 'tool-poisoning-and-untrusted-instructions'
  );
  assert.equal(poisoningPreflight.title, 'Tool poisoning and untrusted instructions');
  assert.equal(poisoningPreflight.required, true);
  assert.equal(Object.hasOwn(poisoningPreflight, 'path'), false);
});

test('repository phase directories and README phase inventory stay aligned', () => {
  const root = path.resolve(__dirname, '..');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'));
  const phases = parseReadme(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), roadmap);
  const phaseDirectories = fs.readdirSync(path.join(root, 'phases'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name));
  const directoryIds = phaseDirectories
    .map(entry => Number(entry.name.slice(0, 2)))
    .sort((left, right) => left - right);
  assert.deepEqual(phases.map(phase => phase.id), directoryIds);

  for (const phase of phases) {
    const phaseDirectory = phaseDirectories.find(entry => Number(entry.name.slice(0, 2)) === phase.id);
    assert.ok(phaseDirectory, `README phase ${phase.id} has no phase directory`);
    const linkedLessonPaths = phase.lessons.map(lesson => {
      const match = lesson.url && lesson.url.match(/(phases\/[^/?#]+\/[^/?#]+)/);
      assert.ok(match, `README lesson ${phase.id}/${lesson.name} is missing a canonical lesson link`);
      return match[1];
    }).sort();
    const lessonDirectories = fs.readdirSync(
      path.join(root, 'phases', phaseDirectory.name),
      { withFileTypes: true }
    )
      .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name))
      .map(entry => `phases/${phaseDirectory.name}/${entry.name}`)
      .sort();
    assert.equal(
      new Set(linkedLessonPaths).size,
      linkedLessonPaths.length,
      `README contains duplicate lesson links in ${phaseDirectory.name}`
    );
    assert.deepEqual(
      linkedLessonPaths,
      lessonDirectories,
      `README lesson links do not match ${phaseDirectory.name}`
    );
  }
});

test('optional MCP capstone keeps its prerequisite gate in every lesson reader surface', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'learning-paths', 'model-context-protocol.json'), 'utf8'));
  const capstone = manifest.optionalLessons.find(entry => entry.lesson === 23);
  const completedPaths = new Set();
  const progress = loadLearningPathProgressRuntime(createMemoryStorage());
  const isLessonComplete = lessonPath => completedPaths.has(lessonPath);

  assert.ok(capstone);
  assert.equal(capstone.required, false);
  assert.deepEqual(capstone.prerequisitePaths, [
    'phases/13-tools-and-protocols/19-a2a-protocol',
    'phases/13-tools-and-protocols/20-opentelemetry-genai',
  ]);
  assert.equal(progress.canEnter(manifest, capstone, isLessonComplete), false);
  assert.deepEqual(Array.from(progress.unmetPaths(capstone, isLessonComplete)), capstone.prerequisitePaths);
  completedPaths.add(capstone.prerequisitePaths[0]);
  assert.equal(progress.canEnter(manifest, capstone, isLessonComplete), false);
  completedPaths.add(capstone.prerequisitePaths[1]);
  assert.equal(progress.canEnter(manifest, capstone, isLessonComplete), true);

  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  assert.match(lessonHtml, /var focusedEntry = flatLessons\.find\(function \(item\) \{ return item\.path === lessonPath; \}\) \|\| null/);
  assert.match(lessonHtml, /learningPathPrerequisiteCallout\(focusedEntry, 'Required before this lesson'\)/);
  assert.match(lessonHtml, /var focusedOptionalLocked = learningPathEntryLocked\(focusedOptionalLesson\)/);
  assert.match(
    lessonHtml,
    /class="path-completion-link' \+ learningPathGateClass\(focusedOptionalLesson\)[\s\S]{0,300}learningPathGateAttributes\(focusedOptionalLesson\)/
  );
  assert.match(lessonHtml, /focusedOptionalLocked \? 'Locked optional capstone: ' : 'Optional capstone: '/);
});

test('Agent Skills knowledge preflight persists per path and gates Lesson 26 deterministically', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'learning-paths', 'agent-skills.json'), 'utf8'));
  const lesson = manifest.lessons.find(entry => entry.lesson === 26);
  const checkId = 'tool-poisoning-and-untrusted-instructions';
  const storage = createMemoryStorage();
  const progress = loadLearningPathProgressRuntime(storage);

  assert.equal(progress.storageKey, 'aifs:learning-path-progress:v1');
  const completedPaths = new Set();
  const isLessonComplete = lessonPath => completedPaths.has(lessonPath);
  assert.equal(progress.canEnter(manifest, lesson, isLessonComplete), false);
  assert.deepEqual(Array.from(progress.unmetPaths(lesson, isLessonComplete)), [
    'phases/13-tools-and-protocols/25-skill-invocation-and-routing',
  ]);
  assert.deepEqual(
    Array.from(progress.unmetChecks(manifest, lesson), check => check.id),
    [checkId]
  );

  assert.equal(progress.confirm(manifest.id, checkId), true);
  assert.equal(progress.canEnter(manifest, lesson, isLessonComplete), false);
  completedPaths.add('phases/13-tools-and-protocols/25-skill-invocation-and-routing');
  assert.equal(progress.canEnter(manifest, lesson, isLessonComplete), true);
  assert.equal(
    storage.value(progress.storageKey),
    JSON.stringify({ version: 1, paths: { 'agent-skills': { checks: { [checkId]: true } } } })
  );

  const restored = loadLearningPathProgressRuntime(storage);
  assert.equal(restored.isConfirmed('agent-skills', checkId), true);
  assert.equal(restored.isConfirmed('model-context-protocol', checkId), false);
  assert.equal(restored.canEnter(manifest, lesson, isLessonComplete), true);
});

test('learning path navigation selects the first actually unmet knowledge check', () => {
  const manifest = {
    id: 'agent-skills',
    prerequisites: [
      { id: 'first', title: 'First check' },
      { id: 'second', title: 'Second check' },
    ],
  };
  const lesson = { prerequisiteChecks: ['first', 'second'] };
  const progress = loadLearningPathProgressRuntime(createMemoryStorage());

  assert.equal(progress.firstUnmetCheckId(manifest, lesson), 'first');
  assert.equal(progress.confirm(manifest.id, 'first'), true);
  assert.equal(progress.firstUnmetCheckId(manifest, lesson), 'second');
});

test('generic course skills dispatch every supported state to an installed owner', () => {
  const root = path.resolve(__dirname, '..');
  const routeOwners = [
    ['LEARNING.md', 'learn'],
    ['MCP-LEARNING.md', 'learn-mcp'],
    ['AGENT-SKILLS-LEARNING.md', 'learn-agent-skills'],
    ['CLAUDE-CERTIFICATION.md', 'claude-certification'],
  ];

  for (const name of ['learn', 'start-learning']) {
    const source = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const mirror = fs.readFileSync(path.join(root, '.claude', 'skills', name, 'SKILL.md'), 'utf8');
    const section = source.match(/## Focused Agent Skills handoff\s+([\s\S]*?)(?=\n## |$)/);
    assert.ok(section, `${name} is missing the focused Agent Skills handoff`);
    assert.match(section[1], /AGENT-SKILLS-LEARNING\.md/);
    assert.match(section[1], /learn-agent-skills/);
    assert.match(section[1], /do not\s+(?:copy Agent Skills state into|create)\s+`LEARNING\.md`/);
    const resume = source.match(/## Resume routing across course modes\s+([\s\S]*?)(?=\n## |$)/);
    assert.ok(resume, `${name} is missing cross-route resume handling`);
    for (const [stateFile, owner] of routeOwners) {
      assert.match(
        resume[1],
        new RegExp('`' + stateFile.replace('.', '\\.') + '` belongs to `' + owner + '`'),
        `${name} does not dispatch ${stateFile} to ${owner}`
      );
      assert.ok(fs.existsSync(path.join(root, 'skills', owner, 'SKILL.md')), `${owner} is not installed`);
      assert.ok(fs.existsSync(path.join(root, '.claude', 'skills', owner, 'SKILL.md')), `${owner} mirror is not installed`);
    }
    assert.match(
      resume[1],
      /`MCP-ENGINEERING-LEARNING\.md` is the legacy filename[\s\S]*?`learn-mcp` route, not a separate route/
    );
    assert.match(resume[1], /names a route[\s\S]*?(?:use|dispatch to)\s+its\s+owner[\s\S]*?even when other state files exist/);
    assert.match(resume[1], /(?:group the files by route owner|collect the owners whose state files\s+exist)/);
    assert.match(resume[1], /If exactly one route(?:\s+owner)?\s+(?:is\s+represented|remains)[\s\S]*?(?:resume|invoke)\s+(?:its\s+owner|it|that\s+owner)/);
    assert.match(resume[1], /If two\s+or more\s+(?:distinct\s+routes\s+are\s+represented|route\s+owners\s+remain)/);
    assert.match(resume[1], /ask which\s+(?:one|route)\s+to\s+resume/);
    assert.match(source, /Legacy runtimes[\s\S]*?`learn-mcp-engineering` as an alias[\s\S]*?`learn-mcp`/);
    assert.match(source, /learning-paths\/model-context-protocol\.json/);
    assert.doesNotMatch(source, /learning-paths\/mcp-engineering\.json/);
    assert.equal(source, mirror, `${name} skill mirrors diverged`);

    const genericStart = name === 'learn'
      ? source.indexOf('## Step 0')
      : source.indexOf('If `LEARNING.md` already exists');
    assert.ok(source.indexOf('## Resume routing across course modes') < genericStart);
  }

  assert.ok(fs.existsSync(path.join(root, 'learning-paths', 'model-context-protocol.json')));
  assert.ok(fs.existsSync(path.join(root, 'learning-paths', 'agent-skills.json')));
  assert.equal(fs.existsSync(path.join(root, 'learning-paths', 'mcp-engineering.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'skills', 'learn-mcp-engineering')), false);
});

test('terminal quiz skills isolate answer keys and use neutral reply formats', () => {
  const root = path.resolve(__dirname, '..');
  const neutralSkills = [
    'check-understanding',
    'find-your-level',
    'learn',
    'learn-agent-skills',
    'learn-mcp',
    'start-learning',
  ];
  const sources = neutralSkills.map(name => {
    const canonical = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const mirror = fs.readFileSync(path.join(root, '.claude', 'skills', name, 'SKILL.md'), 'utf8');
    assert.equal(canonical, mirror, `${name} skill mirrors diverged`);
    return canonical;
  });
  const placement = sources[neutralSkills.indexOf('find-your-level')];
  const canonicalKey = fs.readFileSync(
    path.join(root, 'skills', 'find-your-level', 'references', 'answer-key.md'),
    'utf8'
  );
  const mirrorKey = fs.readFileSync(
    path.join(root, '.claude', 'skills', 'find-your-level', 'references', 'answer-key.md'),
    'utf8'
  );

  assert.match(placement, /references\/answer-key\.md/);
  assert.match(placement, /Reply with Q1: <letter>, Q2: <letter>\./);
  assert.doesNotMatch(placement, /\*\*Correct:/);
  assert.equal(canonicalKey, mirrorKey);
  const answers = new Map(
    Array.from(canonicalKey.matchAll(/^- Q(\d+): ([A-D])\./gm), match => [Number(match[1]), match[2]])
  );
  const questionBlocks = Array.from(
    placement.matchAll(/\*\*Q(\d+)\.\*\*[\s\S]*?(?=\n---|\n\*\*Q\d+\.\*\*|\n## )/g)
  );
  assert.equal(questionBlocks.length, 10);
  for (const match of questionBlocks) {
    const questionNumber = Number(match[1]);
    const options = Array.from(match[0].matchAll(/^- ([A-D])\) (.+)$/gm), option => ({
      letter: option[1],
      text: option[2].trim(),
    }));
    const correct = options.find(option => option.letter === answers.get(questionNumber));
    assert.ok(correct, `Q${questionNumber} is missing its keyed answer`);
    assert.ok(
      options.some(option => option.letter !== correct.letter && option.text.length >= correct.text.length),
      `Q${questionNumber} exposes its answer as the uniquely longest option`
    );
  }
  for (let round = 1; round <= 5; round++) {
    assert.match(canonicalKey, new RegExp(`## Round ${round}:`));
  }
  const combined = sources.join('\n');
  assert.match(combined, /Reply with one letter: <A\|B\|C\|D>\./);
  assert.doesNotMatch(combined, /Reply like Q\d+:\s*[A-D]\b/i);
  assert.doesNotMatch(combined, /Reply with[^.\n]{0,80}\b[A-D]\s*,\s*[A-D]\b/i);
});

test('the vectors and matrices quiz has parallel choices and varied answer positions', () => {
  const root = path.resolve(__dirname, '..');
  const file = path.join(
    root,
    'phases',
    '01-math-foundations',
    '02-vectors-matrices-operations',
    'quiz.json'
  );
  const questions = JSON.parse(fs.readFileSync(file, 'utf8')).questions;
  const expectedAnswers = [
    "The first matrix's columns must equal the second matrix's rows",
    'A square matrix that leaves a compatible matrix unchanged when multiplied',
    'Element-wise multiplication uses matching entries; matrix multiplication uses row-column dot products',
    'It expands b across compatible batch dimensions before addition',
    'The matrix is singular and cannot have an inverse',
    'It exchanges the matrix rows and columns',
  ];

  assert.equal(questions.length, expectedAnswers.length);
  assert.deepEqual(
    questions.map(question => question.options[question.correct]),
    expectedAnswers
  );
  assert.ok(new Set(questions.map(question => question.correct)).size >= 4);
  assert.match(questions[3].explanation, /b\[:, None\]/);
  assert.match(questions[3].explanation, /trailing-dimension alignment/);
  assert.match(questions[3].explanation, /does not reliably broadcast across the batch axis/);
  for (const question of questions) {
    const wordCounts = question.options.map(option => option.trim().split(/\s+/).length);
    const correctWords = wordCounts[question.correct];
    const distractorWords = wordCounts.filter((_, index) => index !== question.correct).sort((a, b) => a - b);
    const medianDistractor = distractorWords[1];
    assert.ok(
      correctWords <= medianDistractor * 1.6,
      `correct option is an obvious length outlier: ${question.question}`
    );
  }
});

test('new Phase 14 quizzes use one pre, three check, and two post questions', () => {
  const root = path.resolve(__dirname, '..');
  const quizPaths = [
    '44-plan-from-evidence',
    '47-outcomes-before-output',
    '48-discover-the-real-workflow',
    '51-write-specifications-that-preserve-judgment',
    '54-build-the-feedback-ratchet',
  ];

  for (const lesson of quizPaths) {
    const quiz = JSON.parse(fs.readFileSync(
      path.join(root, 'phases', '14-agent-engineering', lesson, 'quiz.json'),
      'utf8'
    ));
    const stages = quiz.questions.map(question => question.stage);
    assert.equal(stages.filter(stage => stage === 'pre').length, 1, lesson);
    assert.equal(stages.filter(stage => stage === 'check').length, 3, lesson);
    assert.equal(stages.filter(stage => stage === 'post').length, 2, lesson);
  }
});

test('course guide shape count matches its six routing bullets in both mirrors', () => {
  const root = path.resolve(__dirname, '..');
  for (const file of [
    path.join(root, 'skills', 'course-guide', 'SKILL.md'),
    path.join(root, '.claude', 'skills', 'course-guide', 'SKILL.md'),
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    const routing = source.match(/1\. \*\*Interpret the ask\*\*[\s\S]*?(?=\n2\. \*\*Scan the Contents tables\*\*)/);
    assert.ok(routing, `${file} is missing the routing-shape section`);
    assert.match(routing[0], /one of six shapes/);
    assert.equal(Array.from(routing[0].matchAll(/^\s+- \*[^*]+\*/gm)).length, 6);
  }
});

test('repository exposes the canonical Model Context Protocol learning path only', () => {
  const root = path.resolve(__dirname, '..');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'));
  const phases = parseReadme(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), roadmap);
  const learningPaths = parseLearningPaths(root, phases);
  const modelContextProtocol = learningPaths.find(entry => entry.id === 'model-context-protocol');

  assert.ok(modelContextProtocol);
  assert.equal(modelContextProtocol.title, 'Model Context Protocol (MCP)');
  assert.equal(modelContextProtocol.lessons[0].path, 'phases/13-tools-and-protocols/06-mcp-fundamentals');
  assert.equal(learningPaths.some(entry => entry.id === 'mcp-engineering'), false);
  assert.equal(fs.existsSync(path.join(root, 'learning-paths', 'mcp-engineering.json')), false);
});

test('repository exposes the four core AI engineering learning paths', () => {
  const root = path.resolve(__dirname, '..');
  const roadmap = parseRoadmap(fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'));
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const phases = parseReadme(readme, roadmap);
  const learningPaths = parseLearningPaths(root, phases);
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const domains = [
    ['building-and-deploying-ai-applications', 'Building and Deploying AI Applications', 12],
    ['software-engineering-fundamentals', 'Software Engineering Fundamentals', 13],
    ['using-coding-agents', 'Agent-Assisted Engineering', 16],
    ['shaping-the-build', 'Product Judgment and Delivery', 8],
  ];

  for (const [id, title, lessonCount] of domains) {
    const learningPath = learningPaths.find(entry => entry.id === id);
    assert.ok(learningPath, `${id} manifest is missing`);
    assert.equal(learningPath.title, title);
    assert.equal(learningPath.lessons.length, lessonCount);
    assert.match(homepage, new RegExp(`>${title}<`, 'i'));
    assert.match(homepage, new RegExp(`learningPath=${id}`));
    assert.match(homepage, new RegExp(`learning-paths/${id}\\.json`));
  }

  const shaping = learningPaths.find(entry => entry.id === 'shaping-the-build');
  assert.deepEqual(
    shaping.lessons.map(entry => entry.path),
    [
      'phases/14-agent-engineering/47-outcomes-before-output',
      'phases/14-agent-engineering/48-discover-the-real-workflow',
      'phases/14-agent-engineering/49-map-assumptions-and-risk',
      'phases/14-agent-engineering/50-choose-the-smallest-testable-slice',
      'phases/14-agent-engineering/51-write-specifications-that-preserve-judgment',
      'phases/14-agent-engineering/52-design-success-metrics',
      'phases/14-agent-engineering/53-prototype-pilot-or-production',
      'phases/14-agent-engineering/54-build-the-feedback-ratchet',
    ]
  );
  assert.match(homepage, /assets\/figures\/006-ai-engineering-learning-paths\.svg/);
  assert.match(homepage, /assets\/figures\/006-ai-engineering-learning-paths-mobile\.svg/);
  assert.equal((homepage.match(/class="learning-paths-node /g) || []).length, domains.length);
  const homepageTargets = new Map([
    ['building-and-deploying-ai-applications', ['Building and Deploying AI Applications', 'building-and-deploying']],
    ['software-engineering-fundamentals', ['Software Engineering Fundamentals', 'software-fundamentals']],
    ['using-coding-agents', ['Agent-Assisted Engineering', 'coding-agents']],
    ['shaping-the-build', ['Product Judgment and Delivery', 'shaping-the-build']],
  ]);
  for (const [id] of domains) {
    const [title, anchor] = homepageTargets.get(id);
    assert.match(
      homepage,
      new RegExp(`class="learning-paths-node [^"]+"[^>]+href="learning-paths\\.html#${anchor}"[^>]+aria-label="Explore the competencies for ${title}"`)
    );
  }
  assert.match(readme, /<!-- STATS:START[\s\S]*?<p align="center"><sub><b>[^<]+<\/b> readers[\s\S]*?<!-- STATS:END -->/);
  assert.doesNotMatch(readme, /\[stats-start\]: #/);
  assert.doesNotMatch(readme, /## AI Engineering Learning Paths|site\/assets\/figures\/006-ai-engineering-learning-paths\.svg/);
});

test('homepage preserves live GitHub CTAs and the motion-aware learner marquee', () => {
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const headerSource = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');
  const mastheadCta = homepage.match(/<div class="masthead-cta[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="masthead-install/);
  const mastheadFigure = homepage.match(/\.masthead-figure\s*\{([\s\S]*?)\n    \}/);
  const wideMasthead = homepage.match(/@media \(min-width: 1280px\) \{([\s\S]*?)\n    \}\n\n    @media \(min-width: 1440px\)/);
  const learnerStrip = homepage.match(/<section class="learners-strip"[\s\S]*?<\/section>/);
  const learnerStyles = homepage.match(/\/\* Learner organization index \*\/([\s\S]*?)\.masthead-install-caption/);

  assert.ok(mastheadCta, 'prominent masthead CTA row is missing');
  assert.match(mastheadCta[0], /<span>Start the Course<\/span>/);
  assert.match(mastheadCta[0], /href="learning-paths\.html"[\s\S]*?<span>Explore Learning Paths<\/span>/);
  assert.doesNotMatch(mastheadCta[0], /Start (?:MCP Engineering|Agent Skills)/i);
  assert.match(
    mastheadCta[0],
    /<a class="masthead-btn" href="https:\/\/github\.com\/rohitg00\/ai-engineering-from-scratch"[^>]*aria-label="Star ai-engineering-from-scratch on GitHub"[^>]*>[\s\S]*?<span>Star on GitHub<\/span>[\s\S]*?<span class="masthead-btn-count" data-gh-stars="rohitg00\/ai-engineering-from-scratch" data-loading="true">/
  );
  assert.match(
    mastheadCta[0],
    /<a class="masthead-btn" href="https:\/\/github\.com\/rohitg00"[^>]*aria-label="Follow Rohit Ghumare on GitHub"[^>]*>[\s\S]*?<span>Follow @rohitg00<\/span>/
  );
  assert.match(homepage, /<script src="header\.js\?v=[^"]+" defer><\/script>/);
  assert.match(headerSource, /\[data-gh-stars="' \+ REPO \+ '"\]/);
  assert.match(headerSource, /fetch\('https:\/\/api\.github\.com\/repos\/' \+ REPO/);
  assert.match(headerSource, /var n = data\.stargazers_count;[\s\S]*?paint\(n\)/);

  assert.ok(mastheadFigure, 'contained masthead figure rule is missing');
  assert.match(mastheadFigure[0], /width: 100%/);
  assert.match(mastheadFigure[0], /max-width: 430px/);
  assert.doesNotMatch(mastheadFigure[0], /position:\s*absolute|right:\s*-/);
  assert.match(homepage, /@media \(min-width: 601px\) and \(max-width: 1279px\) \{[\s\S]*?\.manual-masthead\.container\s*\{[\s\S]*?padding-left: clamp\(24px, 2\.5vw, 32px\);[\s\S]*?padding-right: clamp\(24px, 2\.5vw, 32px\);/);
  assert.ok(wideMasthead, 'wide-screen masthead layout is missing');
  assert.match(wideMasthead[0], /grid-template-columns: minmax\(0, 1fr\) minmax\(360px, 400px\)/);
  assert.match(wideMasthead[0], /"title figure"/);
  assert.match(wideMasthead[0], /"install figure"/);
  assert.match(wideMasthead[0], /\.masthead-figure\s*\{[\s\S]*?position: static;[\s\S]*?grid-area: figure/);
  assert.match(homepage, /\.masthead-cta\s*\{\s*display: grid;\s*grid-template-columns: 1fr/);

  assert.ok(learnerStrip, 'institution and company learner strip is missing');
  assert.match(learnerStrip[0], /data-marquee/);
  assert.match(learnerStrip[0], /class="marquee-track"/);
  assert.match(learnerStrip[0], /class="marquee-half"/);
  assert.ok((learnerStrip[0].match(/class="marquee-item/g) || []).length >= 12);
  ['Apple', 'Google', 'OpenAI', 'UC Berkeley', 'Stanford', 'MIT'].forEach(name => {
    assert.ok(learnerStrip[0].includes(name), `learner marquee is missing ${name}`);
  });

  assert.ok(learnerStyles, 'learner marquee styles are missing');
  assert.match(learnerStyles[0], /\.marquee-track\s*\{[\s\S]*?width: max-content/);
  assert.match(learnerStyles[0], /\.marquee\.is-ready \.marquee-track\s*\{[\s\S]*?animation: marquee-left var\(--marquee-dur, 36s\) linear infinite/);
  assert.match(learnerStyles[0], /@keyframes marquee-left\s*\{\s*to\s*\{\s*transform: translateX\(-50%\)/);
  assert.match(homepage, /querySelectorAll\('\[data-marquee\]'\)/);
  assert.match(homepage, /marquee\._aifsSourceHalf = half\.cloneNode\(true\)/);
  assert.match(homepage, /clone = marquee\._aifsSourceHalf\.cloneNode\(true\);[\s\S]*?clone\.setAttribute\('aria-hidden', 'true'\);[\s\S]*?track\.appendChild\(clone\)/);
  assert.match(homepage, /marquee\.classList\.add\('is-ready'\)/);

  assert.match(learnerStyles[0], /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.marquee\s*\{[\s\S]*?overflow-x: auto/);
  assert.match(learnerStyles[0], /\.marquee\.is-ready \.marquee-track\s*\{[\s\S]*?animation: none;[\s\S]*?transform: none/);
  assert.match(learnerStyles[0], /\.marquee-track > \[aria-hidden="true"\]\s*\{\s*display: none/);
  assert.match(homepage, /if \(reducedMotion\.matches \|\| !half\.offsetWidth\) return/);
  assert.match(homepage, /reducedMotion\.addEventListener\('change', buildAll\)/);
});

test('homepage uses consistent responsive grids for controls, routes, and curriculum rows', () => {
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  assert.match(
    homepage,
    /\.masthead-cta\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) minmax\(0, 1\.28fr\) minmax\(0, 1\.12fr\)/
  );
  assert.match(homepage, /@media \(min-width: 761px\) \{[\s\S]*?\.masthead-cta\s*\{[\s\S]*?height: 44px;/);
  assert.match(
    homepage,
    /@media \(min-width: 601px\) and \(max-width: 1279px\) \{[\s\S]*?\.masthead-install,[\s\S]*?\.masthead-install-caption\s*\{[\s\S]*?max-width: none;/
  );
  assert.match(
    homepage,
    /\.course-route-actions\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?width: 248px;[\s\S]*?justify-self: end;/
  );
  assert.match(
    homepage,
    /@media \(max-width: 600px\) \{[\s\S]*?\.course-route-actions\s*\{[\s\S]*?width: 100%;[\s\S]*?justify-self: stretch;[\s\S]*?\.toc-row\s*\{[\s\S]*?grid-template-columns: 36px minmax\(0, 1fr\) auto;[\s\S]*?\.toc-row \.toc-meta\s*\{[\s\S]*?grid-column: 3;[\s\S]*?grid-row: 1;/
  );
});

test('reader prose stays ragged-right without browser-inserted hyphens', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');

  assert.match(styles, /body\s*\{[\s\S]*?hyphens: none;[\s\S]*?-webkit-hyphens: none;/);
  assert.match(lessonHtml, /\.lesson-article p\s*\{[\s\S]*?text-align: left;[\s\S]*?hyphens: none;[\s\S]*?-webkit-hyphens: none;/);
  assert.match(homepage, /\.preface-body\s*\{[\s\S]*?text-align: left;[\s\S]*?hyphens: none;[\s\S]*?-webkit-hyphens: none;/);

  [styles, homepage, lessonHtml].forEach(source => {
    assert.doesNotMatch(source, /(?:-webkit-)?hyphens:\s*auto/);
    assert.doesNotMatch(source, /text-align:\s*justify/);
  });
});

test('shared header progressively compacts without hiding GitHub stars or search', () => {
  const headerSource = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const movableTools = headerSource.match(/function isMovableTool\(child\) \{([\s\S]*?)\n    \}/);

  assert.match(headerSource, /var COMPACT_HEADER_QUERY = '\(max-width: 1400px\)'/);
  assert.match(headerSource, /var NARROW_HEADER_QUERY = '\(max-width: 820px\)'/);
  assert.match(headerSource, /priorityNav\.className = 'header-priority-nav'/);
  assert.match(headerSource, /label !== 'contents' && label !== 'catalog' && label !== 'learning paths'/);
  assert.match(headerSource, /ensureNavigationLink\(nav, 'learning-paths\.html', 'Learning Paths', ''\)/);
  assert.match(headerSource, /if \(isNarrow\) restorePriorityLinks\(\);[\s\S]*?else movePriorityLinksOut\(\)/);

  assert.match(
    headerSource,
    /github\.setAttribute\('data-header-persistent', 'true'\);[\s\S]*?inner\.insertBefore\(github, nav\.nextSibling\)/
  );
  assert.match(headerSource, /classList\.contains\('search-toggle'\)/);
  assert.ok(movableTools, 'compact header tool filter is missing');
  ['priorityNav', 'github', 'search'].forEach(control => {
    assert.match(movableTools[0], new RegExp(`child !== ${control}`));
  });
  assert.match(headerSource, /function appendTool\(child\) \{[\s\S]*?tts-toggle[\s\S]*?tools\.appendChild\(child\)/);
  assert.match(headerSource, /new MutationObserver\([\s\S]*?isMovableTool\(added\[j\]\)[\s\S]*?appendTool\(added\[j\]\)/);

  assert.match(headerSource, /toggle\.setAttribute\('aria-controls', nav\.id\)/);
  assert.match(headerSource, /toggle\.setAttribute\('aria-expanded', open \? 'true' : 'false'\)/);
  assert.match(headerSource, /event\.key !== 'ArrowDown'[\s\S]*?setOpen\(true, false\)[\s\S]*?firstLink\.focus\(\)/);
  assert.match(headerSource, /open && !header\.contains\(event\.target\)[\s\S]*?setOpen\(false, false\)/);
  assert.match(headerSource, /event\.key === 'Escape'[\s\S]*?setOpen\(false, true\)/);

  assert.match(styles, /\.header-inner\s*\{[\s\S]*?width: 100%;[\s\S]*?max-width: 1360px;[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.header-nav,\s*\n\.header-priority-nav\s*\{[\s\S]*?white-space: nowrap;/);
  assert.match(styles, /@media \(max-width: 1480px\) and \(min-width: 1401px\)/);
  assert.match(styles, /@media \(max-width: 1400px\) \{[\s\S]*?\.header-priority-nav\s*\{[\s\S]*?\.header-inner > \.header-github[\s\S]*?\.header-inner > \.search-toggle[\s\S]*?\.header-nav\s*\{[\s\S]*?width: min\(360px, calc\(100vw - 32px\)\);[\s\S]*?overflow-y: auto;/);
  assert.match(styles, /@media \(max-width: 820px\) \{[\s\S]*?\.header-priority-nav\s*\{\s*display: none;[\s\S]*?\.header-inner > \.header-github[\s\S]*?\.header-inner > \.search-toggle/);
  assert.match(styles, /@media \(max-width: 480px\) \{[\s\S]*?\.header-inner > \.header-github svg\s*\{\s*display: none;[\s\S]*?\.header-inner > \.header-github::before/);
});

test('website motion contracts keep interaction state stable and compositor-friendly', () => {
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const agentSource = fs.readFileSync(path.join(__dirname, 'figures-agents-alignment.js'), 'utf8');
  const ttsSource = fs.readFileSync(path.join(__dirname, 'tts.js'), 'utf8');
  const roadmapSource = fs.readFileSync(path.join(__dirname, 'roadmap.js'), 'utf8');

  const homepageStatBar = homepage.match(/\.stat-row-bar::before\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(homepageStatBar, 'homepage stat bar rule is missing');
  assert.match(homepageStatBar[0], /transform: scaleX\(var\(--bar-scale, 0\)\)/);
  assert.match(homepageStatBar[0], /transition: transform/);
  assert.doesNotMatch(homepageStatBar[0], /transition:\s*width/);
  assert.match(appSource, /barFill\.style\.transform = 'scaleX\('/);
  assert.doesNotMatch(appSource, /barFill\.style\.width\s*=/);

  const agentLoop = agentSource.match(/function agentLoop\(host\) \{[\s\S]*?\n  \}\n\n  \/\/ .* react-trace/);
  assert.ok(agentLoop, 'persistent Agent Loop renderer is missing');
  const agentSteps = agentLoop[0].match(/var steps = \[([\s\S]*?)\n    \];/);
  assert.ok(agentSteps, 'Agent Loop step sequence is missing');
  assert.equal((agentSteps[1].match(/\{ node:/g) || []).length, 12);
  assert.match(agentLoop[0], /transition:stroke 180ms[^'\"]*,opacity 180ms/);
  assert.doesNotMatch(agentLoop[0], /transition:[^'\"]*stroke-width/);
  assert.doesNotMatch(agentLoop[0], /edgeEls\[i\]\.setAttribute\('stroke-width'/);
  assert.match(agentLoop[0], /STEP ' \+ \(state\.step \+ 1\) \+ ' OF 12/);

  const place = ttsSource.match(/function place\(x, y, persist, limits\) \{[\s\S]*?\n  \}/);
  const placeDuringDrag = ttsSource.match(/function placeDuringDrag\(x, y, limits\) \{[\s\S]*?\n  \}/);
  assert.ok(place && placeDuringDrag, 'TTS placement functions are missing');
  assert.match(place[0], /style\.transform = 'translate3d\('/);
  assert.match(placeDuringDrag[0], /style\.transform = 'translate3d\('/);
  assert.doesNotMatch(place[0] + placeDuringDrag[0], /style\.(?:left|top)\s*=/);
  assert.match(ttsSource, /if \(!els\.bar \|\| els\.bar\.classList\.contains\('is-placed'\)\) return;/);
  assert.match(ttsSource, /function glide\(now\)[\s\S]*?place\(x, y, false, limits\)/);
  assert.match(ttsSource, /return !!\(reducedMotion && reducedMotion\.matches\)/);
  assert.match(ttsSource, /if \(event\.matches\) commitDragInertiaForReducedMotion\(\)/);
  assert.match(ttsSource, /reducedMotion\.addEventListener\('change', reducedMotionListener\)/);

  assert.match(ttsSource, /function pageLocale\(\)[\s\S]*?contentRoot\(state\.scope\)[\s\S]*?getAttribute\('lang'\)/);
  assert.match(ttsSource, /function refreshLanguage\(\)[\s\S]*?state\.forcedLocal = null;[\s\S]*?state\.stalls = 0;[\s\S]*?state\.idleTicks = 0;/);
  assert.match(ttsSource, /function refreshQueue\(restartIfMissing\)[\s\S]*?fresh\[keyIndex\]\.key === current\.key[\s\S]*?Math\.min\(current\.part \|\| 0, keyedChunks\.length - 1\)/);
  assert.match(ttsSource, /function resume\(\)[\s\S]*?synth\.resume\(\);[\s\S]*?if \(!state\.utterance\) speakCurrent\(\)/);
  assert.match(ttsSource, /function selectedVoice\(locale\)[\s\S]*?sameLanguage\(all\[i\], locale\)/);
  assert.match(ttsSource, /function localVoice\(\)[\s\S]*?sameLanguage\(all\[i\], locale\)[\s\S]*?return null;/);
  assert.match(ttsSource, /aifs:content-language-change', refreshContentLanguage/);
  assert.match(roadmapSource, /'data-tts-key': 'roadmap-phase-' \+ phase\.id/);

  assert.match(roadmapSource, /group\.addEventListener\('keydown'[\s\S]*?togglePhaseSelection\(phase\.id, \{ animate: false \}\)/);
  assert.match(roadmapSource, /jump\.addEventListener\('change'[\s\S]*?selectPhase\(id, \{ updateHistory: true, animate: false \}\)/);
  assert.match(roadmapSource, /event\.key === 'Escape'[\s\S]*?clearSelection\(true, \{ animate: false \}\)/);
  assert.match(roadmapSource, /var keyboardTriggered = event\.detail === 0;[\s\S]*?animate: !keyboardTriggered/);
});

test('TTS continuation accepts canonical and legacy lesson routes under one route key', () => {
  const source = fs.readFileSync(path.join(__dirname, 'tts.js'), 'utf8');
  const routeKeySource = source.match(/function routeKey\(url\) \{[\s\S]*?\n  \}/);
  const continuationSource = source.match(/function isLessonContinuationLink\(link\) \{[\s\S]*?\n  \}/);
  assert.ok(routeKeySource, 'TTS route key helper is missing');
  assert.ok(continuationSource, 'TTS continuation helper is missing');

  const origin = 'https://aiengineeringfromscratch.com';
  const context = {
    URL,
    URLSearchParams,
    location: {
      href: origin + '/lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment',
      origin,
    },
  };
  vm.runInNewContext(
    `${routeKeySource[0]}\n${continuationSource[0]}\nthis.routeKey = routeKey; this.isLessonContinuationLink = isLessonContinuationLink;`,
    context
  );

  const query = 'path=phases%2F00-setup-and-tooling%2F01-dev-environment&learningPath=software-engineering-fundamentals';
  assert.equal(context.routeKey(origin + '/lesson.html?' + query), context.routeKey(origin + '/lesson?' + query));
  const link = href => ({ href, matches: selector => selector === '.lesson-nav-btn,.continue-link' });
  assert.equal(context.isLessonContinuationLink(link(origin + '/lesson?' + query)), true);
  assert.equal(context.isLessonContinuationLink(link(origin + '/lesson.html?' + query)), true);
  assert.equal(context.isLessonContinuationLink(link(origin + '/certification?id=claude-architect')), false);
});

test('localized interaction helpers stay language-aware and recoverable', () => {
  const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const paletteSource = fs.readFileSync(path.join(__dirname, 'cmdpalette.js'), 'utf8');
  const ttsSource = fs.readFileSync(path.join(__dirname, 'tts.js'), 'utf8');

  assert.match(appSource, /var defaultLabel = 'copy'/);
  assert.match(appSource, /var defaultAriaLabel = btn\.id === 'installCopy' \? 'Copy the install command' : 'Copy command'/);
  assert.match(appSource, /function resetCopyState\(\)[\s\S]*?label\.textContent = tr\(defaultLabel\)[\s\S]*?tr\(defaultAriaLabel\)/);
  assert.match(appSource, /addEventListener\('aifs:language-change'[\s\S]*?clearTimeout\(revertTimer\)[\s\S]*?resetCopyState\(\)/);
  assert.match(appSource, /function confirmCopied\(\)[\s\S]*?tr\('copied'\)[\s\S]*?tr\('Command copied'\)/);
  assert.match(appSource, /function reportCopyFailure\(\)[\s\S]*?tr\('retry'\)[\s\S]*?tr\('Copy failed\. Try again'\)/);

  assert.doesNotMatch(paletteSource, /_zhSearchFailed/);
  assert.match(paletteSource, /function isCertificationSurface\(\)/);
  assert.match(paletteSource, /if \(isCertificationSurface\(\)\) return 'en'/);
  assert.match(paletteSource, /function open\(\)[\s\S]*?currentLang\(\) === 'zh'[\s\S]*?ensureZhSearchAsset\(\)/);
  assert.doesNotMatch(paletteSource, /function _init\(\)[\s\S]*?buildIndex\(\);\s*ensureZhSearchAsset\(\);/);

  assert.match(ttsSource, /var isChinese = languageBase\(pageLocale\(\)\) === 'zh'/);
  assert.match(ttsSource, /isChinese \? ' 指向 ' : ' leads to '/);
  assert.match(ttsSource, /isChinese \? ' 小于或等于 ' : ' less than or equal to '/);
  assert.match(ttsSource, /isChinese \? ' 大于或等于 ' : ' greater than or equal to '/);
});

test('catalog and glossary rebuild bilingual page indexes after language changes', () => {
  const catalog = fs.readFileSync(path.join(__dirname, 'catalog.html'), 'utf8');
  const glossary = fs.readFileSync(path.join(__dirname, 'glossary.html'), 'utf8');

  assert.match(catalog, /function refreshLocalizedRows\(\)[\s\S]*?AIFS_I18n\.searchText\(searchValues\)/);
  assert.match(catalog, /addEventListener\('aifs:language-change'[\s\S]*?refreshLocalizedRows\(\);[\s\S]*?render\(\)/);
  assert.match(glossary, /function refreshLocalizedEntries\(\)[\s\S]*?AIFS_I18n\.searchText\(searchValues\)/);
  assert.match(glossary, /addEventListener\('aifs:language-change'[\s\S]*?refreshLocalizedEntries\(\);[\s\S]*?renderGlossary\(\)/);
  assert.ok(
    glossary.indexOf('refreshLocalizedEntries();') < glossary.indexOf("var initialSlug = ''"),
    'glossary must build its bilingual key map before resolving the initial hash'
  );
});

test('learning path query and Enter fallback open the first result predictably', () => {
  assert.equal(
    learningPathDestination('phases/13-tools-and-protocols/22-skills-and-agent-sdks', 'agent-skills'),
    'lesson?path=phases%2F13-tools-and-protocols%2F22-skills-and-agent-sdks&learningPath=agent-skills'
  );
  assert.equal(resultIndexForEnter(-1, 5), 0);
  assert.equal(resultIndexForEnter(3, 5), 3);
  assert.equal(resultIndexForEnter(-1, 0), -1);
});

test('career lessons return to their exact learning paths guide without a fake catalog search', () => {
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');

  assert.match(lessonHtml, /var pathReturnHref = 'catalog\.html';/);
  assert.match(lessonHtml, /if \(learningPath\.kind === 'career-route'\)/);
  assert.match(lessonHtml, /pathReturnHref = 'learning-paths\.html#career-route-' \+ encodeURIComponent\(learningPath\.id\);/);
  assert.match(lessonHtml, /pathReturnLabel = 'Back to career route';/);
  assert.match(lessonHtml, /href="' \+ pathReturnHref \+ '">&larr; ' \+ pathReturnLabel/);
  assert.doesNotMatch(lessonHtml, /catalog\.html\?q=' \+ encodeURIComponent\(learningPath\.title/);
});

test('exact Agent Skills search ranks the focused path before individual lessons', () => {
  global.LEARNING_PATHS = [{
    id: 'agent-skills',
    title: 'Agent Skills Engineering',
    summary: 'A focused route.',
    estimatedMinutes: 570,
    lessons: [{ path: 'phases/13-tools-and-protocols/22-skills-and-agent-sdks' }],
  }];
  global.PHASES = [{
    id: 13,
    name: 'Tools and Protocols',
    lessons: [{
      name: 'Agent Skills: Portable Contract and Runtime Boundary',
      summary: 'Learn agent skills.',
      url: 'https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/phases/13-tools-and-protocols/22-skills-and-agent-sdks/',
    }],
  }];

  try {
    rebuildIndex();
    const [first] = search('Agent Skills');
    assert.equal(first.kind, 'learning-path');
    assert.equal(first.url, 'lesson?path=phases%2F13-tools-and-protocols%2F22-skills-and-agent-sdks&learningPath=agent-skills');
  } finally {
    delete global.LEARNING_PATHS;
    delete global.PHASES;
    rebuildIndex();
  }
});

test('lesson reader keeps learning-path context and renders a copyable full-depth install', () => {
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');

  assert.match(lessonHtml, /'mcp-engineering': 'model-context-protocol'/);
  assert.match(lessonHtml, /requestedLearningPathId = LEARNING_PATH_ID_ALIASES\[incomingLearningPathId\]/);
  assert.match(lessonHtml, /searchParams\.set\('learningPath', pathId\)/);
  assert.match(lessonHtml, /Lesson ' \+ \(focusedIndex \+ 1\) \+ ' of ' \+ focusedLessons\.length/);
  assert.match(lessonHtml, /prerequisitePaths: pathEntry/);
  assert.match(lessonHtml, /prerequisiteChecks: pathEntry/);
  assert.match(lessonHtml, /data-prerequisite-paths/);
  assert.match(lessonHtml, /learningPathEntryLocked/);
  assert.match(lessonHtml, /firstId = linkUnmetLearningPathCheckIds\(link\)\[0\]/);
  assert.match(lessonHtml, /data-learning-path-prerequisite-callout="true"/);
  assert.match(lessonHtml, /function linkUnmetLearningPathPrerequisitePaths\(link\)/);
  assert.match(lessonHtml, /function ensureLearningPathPrerequisiteCallout\(link\)/);
  assert.match(lessonHtml, /var pathCallout = button \? null : ensureLearningPathPrerequisiteCallout\(link\)/);
  assert.match(lessonHtml, /feedbackTarget\.scrollIntoView/);
  assert.match(lessonHtml, /feedbackTarget\.focus\(\)/);
  assert.match(lessonHtml, /var nextLocked = learningPathMode && learningPathEntryLocked\(next\)/);
  assert.match(
    lessonHtml,
    /data-learning-path-gate-label>'\s*\+\s*\(nextLocked\s*\?\s*'Locked'\s*:\s*'Next &rarr;'\)/
  );
  assert.doesNotMatch(lessonHtml, /\|\| \{ id: checkId, title: checkId, description: '' \}/);
  assert.match(lessonHtml, /learningPathPrerequisiteCallout\(nextRequired/);
  assert.match(lessonHtml, /--skill ' \+ skillName \+ ' --full-depth/);
  assert.match(lessonHtml, /class="output-btn output-install-copy"/);
  assert.match(lessonHtml, /class="output-btn output-install-toggle" type="button" aria-expanded="false" aria-controls="' \+ installId/);
  assert.match(lessonHtml, /btn\.setAttribute\('aria-expanded', expanded \? 'true' : 'false'\)/);
  assert.match(lessonHtml, /currentLessonIndex - 1/);
  assert.doesNotMatch(lessonHtml, /currentLessonIndex - 2/);
  assert.match(lessonHtml, /Requires a local clone/);
  assert.doesNotMatch(lessonHtml, /git rev-parse --show-toplevel/);
  assert.match(lessonHtml, /lessonQuizCorrectAnswers\[qid\] = q\.correct/);
  assert.doesNotMatch(lessonHtml, /data-correct=/);
  assert.equal((lessonHtml.match(/getQuizQuestions\(fallbackLang\), fallbackLang/g) || []).length, 2);
  assert.match(lessonHtml, /function fallbackQuizLanguage\(\)/);
  assert.doesNotMatch(lessonHtml, /getQuizQuestions\('en'\), 'en'/);
  assert.match(lessonHtml, /lessonUiFormat\(\s*'Want a deeper quiz\? In Codex use \{codexCommand\}[^']+\{portableCommand\}'/);
  assert.match(lessonHtml, /codexCommand: '<code>check-understanding /);
  assert.match(lessonHtml, /claudeCommand: '<code>\/check-understanding /);
  assert.match(lessonHtml, /lessonUiFormat\('Optional lesson\. \{done\} of \{total\} required lessons completed\.'/);
  assert.match(lessonHtml, /lessonUiFormat\('\{done\} of \{total\} knowledge preflights confirmed\.'/);
  assert.doesNotMatch(lessonHtml, /lessonUiText\('Optional lesson\. '\) \+ focusedDone/);
  assert.doesNotMatch(lessonHtml, /focusedChecksDone \+ lessonUiText\(' of '\)/);
  assert.match(lessonHtml, /lessonUiFormat\('\{count\}' \+ suffix, \{ count: count \}\)/);
  assert.match(lessonHtml, /lessonUiFormat\('Ready for Phase \{number\}: \{name\}'/);
  assert.doesNotMatch(lessonHtml, /currentLang\(\) === 'zh'/);
  assert.match(lessonHtml, /Act on this lesson/);
  assert.match(lessonHtml, /data-checkpoint="read"/);
  assert.match(lessonHtml, /data-checkpoint="built"/);
  assert.match(lessonHtml, /data-checkpoint="ran"/);
  assert.match(lessonHtml, /data-checkpoint="evidence"/);
  assert.match(lessonHtml, /data-lesson-complete="true"/);
  assert.match(lessonHtml, /learningPath\.estimatedMinutes/);
  assert.match(lessonHtml, /entry\.checkpointEvidence/);
  assert.match(lessonHtml, /quickStart\.expectedEvidence/);
  assert.match(lessonHtml, /function repoRootCommand\(filename, path\)/);
  assert.equal((lessonHtml.match(/repoRootCommand\(file\.name, filePath\)/g) || []).length, 2);
  assert.match(lessonHtml, /\.code-card-run \{[\s\S]*?white-space: pre-wrap;[\s\S]*?overflow-wrap: anywhere;/);
  assert.doesNotMatch(lessonHtml, /\.code-card-run::-[a-z-]*scrollbar/);
  assert.match(lessonHtml, /\.output-cards,[\s\S]*?\.code-cards \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(lessonHtml, /\.code-card \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;[\s\S]*?height: 100%;/);
  assert.match(lessonHtml, /\.code-card-actions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(lessonHtml, /\.code-cards:not\(\.single\) \.code-card:last-child:nth-child\(odd\) \{[\s\S]*?grid-column: 1 \/ -1;/);
  assert.match(lessonHtml, /\.output-card-heading \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/);
  assert.match(lessonHtml, /\.output-card-name \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?word-break: normal;/);
  assert.match(lessonHtml, /\.output-cards\.single \.output-card \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?align-items: center;/);
  assert.match(lessonHtml, /\.output-cards\.single \.output-actions \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;[\s\S]*?margin-top: 0;/);
  assert.match(lessonHtml, /\.output-cards\.single \.output-card--stacked-actions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?align-items: start;/);
  assert.match(lessonHtml, /\.output-cards\.single \.output-card--stacked-actions \.output-actions \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: auto;[\s\S]*?justify-content: flex-start;/);
  assert.match(lessonHtml, /var actionCount = 1 \+ \(bundleUrl \? 1 : 0\) \+ \(installHint \? 1 : 0\) \+ \(installCommand \? 1 : 0\);/);
  assert.match(lessonHtml, /actionCount > 2 \? ' output-card--stacked-actions' : ''/);
  assert.match(lessonHtml, /\.output-cards\.single \.output-install-hint \{[\s\S]*?grid-column: 1 \/ -1;/);
  assert.match(lessonHtml, /var visibleOutputs = Array\.isArray\(data\) \? data\.filter\(isRenderableOutput\) : \[\];/);
  assert.match(lessonHtml, /name\.charAt\(0\) !== '\.'/);
  assert.match(lessonHtml, /else if \(isMarkdownOutput\(file\)\)/);
  assert.match(lessonHtml, /data-output-description=/);
  assert.match(lessonHtml, /if \(!response\.ok\) throw new Error\('fetch-failed'\)/);
  assert.doesNotMatch(lessonHtml, /extractFrontmatterDesc/);
  assert.doesNotMatch(lessonHtml, /id="desc-/);
  assert.match(lessonHtml, /@media \(max-width: 768px\) \{[\s\S]*?\.output-cards,[\s\S]*?\.code-cards \{ grid-template-columns: 1fr; \}/);
  assert.match(lessonHtml, /@media \(max-width: 480px\) \{[\s\S]*?\.code-card-actions,[\s\S]*?\.output-actions \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(lessonHtml, /Run from the repository root, the folder containing README\.md/);
  assert.match(lessonHtml, /Run copied commands from the repository root, the directory containing README\.md and phases\//);
  assert.doesNotMatch(lessonHtml, /shell is anywhere inside the repository/);
  assert.match(lessonHtml, /inferLearningPath\(lessonPath\)/);
  assert.match(lessonHtml, /preferredIds = \['agent-skills', 'model-context-protocol'\]/);
  assert.match(lessonHtml, /A code fence is not automatically a runnable program/);
  assert.match(lessonHtml, /var fetchOptions = localPreview \? \{ cache: 'no-store' \} : undefined/);
  assert.match(lessonHtml, /fetch\(primary, fetchOptions\)/);
  assert.doesNotMatch(lessonHtml, /<script src="figures(?:\.js|-)/);
  assert.match(lessonHtml, /<script src="figure-manifest\.js/);
  assert.match(lessonHtml, /import\('https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@11/);
});

test('MCP lesson labs override legacy figures with modern inspectable protocol outcomes', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = buildFigureProviderManifest(root, __dirname);
  const moduleSource = fs.readFileSync(path.join(__dirname, 'figures-mcp.js'), 'utf8');
  const legacyIndex = manifest.providerOrder.indexOf('figures-tools3.js');
  const mcpIndex = manifest.providerOrder.indexOf('figures-mcp.js');

  assert.ok(legacyIndex >= 0);
  assert.ok(mcpIndex > legacyIndex);
  assert.deepEqual(manifest.providersByFigure['t3-dispatch-loop'], [
    'figures-tools3.js',
    'figures-mcp.js',
  ]);
  assert.equal(manifest.providersByFigure['mcp-tool-call'].at(-1), 'figures-mcp.js');

  const expectedFigureIds = [
    'mcp-tool-call',
    't3-dispatch-loop',
    'tp-client-merge',
    'tp-transport-handshake',
    't3-primitive-sort',
    't3-sampling-flip',
    't3-roots-boundary',
    'tp-task-lifecycle',
    't3-ui-sandbox',
    'tp-tool-poisoning',
    't3-scope-stepup',
    't3-gateway-funnel',
    't3-jwks-rotate',
    'mcp-contract-pipeline',
    'mcp-reliability-race',
    'mcp-registry-admission',
    'mcp-conformance-operations',
  ].sort();
  const logic = loadMcpLabLogic();
  assert.deepEqual(logic.registeredFigureIds, expectedFigureIds);

  assert.doesNotMatch(moduleSource, /repeatCount\s*[:=]/);
  assert.doesNotMatch(moduleSource, /rpcRequest\([^)]*notifications\/progress/);
  assert.doesNotMatch(moduleSource, /httpStatus:\s*202|HTTP 202|202 Accepted|accept-no-response/);
  assert.match(moduleSource, /el\('figure'/);
  assert.match(moduleSource, /el\('figcaption'/);
  assert.match(moduleSource, /'aria-live': 'polite'/);
  assert.match(moduleSource, /'aria-pressed'/);
  assert.match(moduleSource, /prefers-reduced-motion:reduce/);
  assert.match(moduleSource, /@media\(max-width:640px\)/);
  assert.match(moduleSource, /\.mcp-lab__scenario,\.mcp-lab__choice,\.mcp-lab__action\{transition:transform var\(--motion-press,160ms\) var\(--ease-out/);
  assert.match(moduleSource, /\.mcp-lab__stage\{transition:transform var\(--motion-drawer,250ms\) var\(--ease-in-out/);
  assert.match(moduleSource, /opacity var\(--motion-feedback,180ms\) var\(--ease-out/);
  assert.match(moduleSource, /var stageViews = \[\]/);
  assert.match(moduleSource, /if \(stageViews\[index\]\) return stageViews\[index\]/);
  assert.match(moduleSource, /pipeline\.appendChild\(node\)/);
  assert.match(moduleSource, /stageView\.node\.hidden = false/);
  assert.doesNotMatch(moduleSource, /pipeline\.(?:replaceChildren|innerHTML\s*=|textContent\s*=)/);

  for (const figureId of expectedFigureIds) {
    const host = logic.renderFigure(figureId);
    const figures = logic.findAll(host, node => node.tagName === 'FIGURE');
    assert.equal(figures.length, 1, `${figureId} must render one semantic figure`);
    const figure = figures[0];
    const captions = logic.findAll(figure, node => node.tagName === 'FIGCAPTION');
    assert.equal(captions.length, 1, `${figureId} must render one figcaption`);
    assert.ok(captions[0].textContent.trim(), `${figureId} must explain its outcome`);
    const titleId = figure.getAttribute('aria-labelledby');
    assert.ok(titleId && logic.document.getElementById(titleId), `${figureId} must label its figure`);

    const verdict = logic.findAll(figure, node => node.getAttribute && node.getAttribute('class') === 'mcp-lab__verdict')[0];
    assert.equal(verdict.getAttribute('role'), 'status');
    assert.equal(verdict.getAttribute('aria-live'), 'polite');
    assert.equal(verdict.getAttribute('aria-atomic'), 'true');

    const scenarioButtons = logic.findAll(figure, node =>
      node.tagName === 'BUTTON' && String(node.className).split(/\s+/).includes('mcp-lab__scenario')
    );
    assert.ok(scenarioButtons.length > 1, `${figureId} must expose multiple scenarios`);
    assert.equal(scenarioButtons[0].getAttribute('aria-pressed'), 'true');
    assert.equal(scenarioButtons[1].getAttribute('aria-pressed'), 'false');
    scenarioButtons[1].click();
    assert.equal(scenarioButtons[0].getAttribute('aria-pressed'), 'false');
    assert.equal(scenarioButtons[1].getAttribute('aria-pressed'), 'true');

    const action = logic.findAll(figure, node =>
      node.tagName === 'BUTTON' && String(node.className).split(/\s+/).includes('mcp-lab__action')
    )[0];
    const runBefore = figure.getAttribute('data-run');
    action.click();
    assert.notEqual(figure.getAttribute('data-run'), runBefore);
    assert.ok(verdict.getAttribute('data-announced'));
  }

  const styles = logic.document.getElementById('mcp-lab-styles');
  assert.ok(styles, 'rendering must install the MCP lab styles');
  assert.match(styles.textContent, /@media\(max-width:640px\)/);
  assert.match(styles.textContent, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles.textContent, /transform:none!important/);
  assert.equal(
    logic.document.head.children.filter(child => child.id === 'mcp-lab-styles').length,
    1,
    'rendering many labs must not duplicate the style element'
  );
});

test('MCP evaluators expose each protocol boundary in its owning scenario', () => {
  const logic = loadMcpLabLogic();
  const byId = (entries, id) => entries.find(entry => entry.id === id);

  const discovery = plainMcpValue(logic.evaluateRequestScenario(byId(logic.requestScenarios, 'discover')));
  assert.equal(discovery.evidence.request.body.method, 'server/discover');
  assert.equal(discovery.evidence.request.body.params._meta['io.modelcontextprotocol/protocolVersion'], '2026-07-28');
  assert.deepEqual(discovery.evidence.request.body.params._meta['io.modelcontextprotocol/clientCapabilities'], { tools: {} });
  assert.equal(discovery.evidence.request.body.params._meta['io.modelcontextprotocol/clientInfo'].name, 'course-host');
  assert.equal(discovery.evidence.request.headers['MCP-Protocol-Version'], '2026-07-28');
  assert.equal(discovery.evidence.request.headers['Mcp-Method'], 'server/discover');
  assert.deepEqual(discovery.evidence.response.body.result.supportedVersions, ['2026-07-28']);
  assert.equal(discovery.evidence.response.body.result._meta['io.modelcontextprotocol/serverInfo'].name, 'notes-replica-b');

  const subscription = plainMcpValue(logic.evaluateTransport(byId(logic.transportScenarios, 'listen')));
  assert.equal(subscription.evidence.request.body.method, 'subscriptions/listen');
  assert.equal(subscription.evidence.response.events[0].params._meta['io.modelcontextprotocol/subscriptionId'], 'listen-1');

  const retry = plainMcpValue(logic.evaluateRetry(byId(logic.retryScenarios, 'valid')));
  assert.equal(retry.evidence.firstResponse.result.resultType, 'input_required');
  assert.ok(retry.evidence.firstResponse.result.inputRequests.pick_files);
  assert.ok(retry.evidence.retryRequest.params.inputResponses.pick_files);
  assert.equal(retry.evidence.retryRequest.params.requestState, retry.evidence.firstResponse.result.requestState);
  assert.equal(retry.evidence.finalResponse.result.resultType, 'complete');
  assert.deepEqual(retry.evidence.finalResponse.result.structuredContent.filesUsed, ['README.md', 'server.py', 'docs/intro.md']);

  const completion = plainMcpValue(logic.evaluateContract(byId(logic.contractScenarios, 'completion')));
  assert.equal(completion.evidence.callRequest.method, 'completion/complete');
  const cursor = plainMcpValue(logic.evaluateContract(byId(logic.contractScenarios, 'cursor')));
  assert.equal(cursor.evidence.callResponse.result.nextCursor, 'cur_J9opaque');
  assert.equal(cursor.evidence.continuationRequest.params.cursor, 'cur_J9opaque');

  const taskInput = plainMcpValue(logic.evaluateTask(byId(logic.taskScenarios, 'input')));
  assert.equal(taskInput.evidence.request.method, 'tasks/get');
  assert.ok(taskInput.evidence.response.result.inputRequests.approve_outline);
  const taskUpdate = plainMcpValue(logic.evaluateTask(byId(logic.taskScenarios, 'update')));
  assert.equal(taskUpdate.evidence.request.method, 'tasks/update');
  assert.equal(taskUpdate.evidence.request.params.inputResponses.approve_outline.action, 'accept');
  const taskCancelled = plainMcpValue(logic.evaluateTask(byId(logic.taskScenarios, 'cancelled')));
  assert.equal(taskCancelled.evidence.request.method, 'tasks/cancel');
  assert.equal(taskCancelled.evidence.after.status, 'cancelled');

  const app = plainMcpValue(logic.evaluateApp(byId(logic.appScenarios, 'lifecycle')));
  const descriptor = app.evidence.toolDiscovery.result.tools[0];
  assert.equal(descriptor._meta.ui.resourceUri, 'ui://notes/timeline.html');
  assert.equal(app.evidence.uiResourceRead.params.uri, descriptor._meta.ui.resourceUri);
  assert.deepEqual(app.evidence.bridge.map(message => message.method).filter(Boolean), [
    'ui/initialize',
    'ui/notifications/initialized',
  ]);

  const collision = plainMcpValue(logic.evaluateMerge(byId(logic.mergeScenarios, 'collision'), 'prefix'));
  assert.deepEqual(collision.evidence.collisions, ['search']);
  assert.equal(collision.evidence.canonicalRouteTable['issues/search'].peer, 'issues');

  const oauth = plainMcpValue(logic.evaluateOAuth(byId(logic.oauthScenarios, 'valid')));
  assert.equal(oauth.evidence.boundaryValues.protectedResource, oauth.evidence.boundaryValues.requestedResource);
  assert.equal(oauth.evidence.boundaryValues.tokenAudience, oauth.evidence.boundaryValues.requestedResource);
  assert.equal(oauth.evidence.boundaryValues.returnedIss, oauth.evidence.boundaryValues.authorizationServer);
  const opaque = plainMcpValue(logic.evaluateJwks(byId(logic.jwksScenarios, 'opaque')));
  assert.equal(opaque.evidence.token.format, 'opaque');
  assert.match(opaque.evidence.actions.join(' '), /introspection/);
  const singleflight = plainMcpValue(logic.evaluateJwks(byId(logic.jwksScenarios, 'singleflight')));
  assert.match(singleflight.evidence.actions.join(' '), /singleflightRefresh/);

  const drift = plainMcpValue(logic.evaluateDrift(byId(logic.driftScenarios, 'aligned')));
  assert.equal(drift.evidence.identityRule, 'display name and serverInfo are not security identity');
  const conformance = plainMcpValue(logic.evaluateConformance(byId(logic.conformanceScenarios, 'unknown-result'), 'differential'));
  assert.equal(conformance.kind, 'nonconformant');
  assert.deepEqual(conformance.evidence.normalizedDiff.map(entry => entry.path), ['$.decision', '$.normalized']);
});

test('every Agent Skills figure mounts through the shared lesson runtime', () => {
  const rootPath = path.resolve(__dirname, '..');
  const manifest = buildFigureProviderManifest(rootPath, __dirname);
  const figureIds = Object.entries(manifest.providersByFigure)
    .filter(([, providers]) => providers.at(-1) === 'figures-agent-skills.js')
    .map(([figureId]) => figureId)
    .sort();
  assert.equal(figureIds.length, 19);

  const runtime = loadFigureRuntime({ reducedMotion: true });
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'figures-agent-skills.js'), 'utf8'),
    {
      console,
      document: runtime.window.document,
      window: runtime.window,
    },
    { filename: path.join(__dirname, 'figures-agent-skills.js') }
  );

  const hosts = figureIds.map(figureId => {
    const host = runtime.element('div');
    host.dataset.figure = figureId;
    return host;
  });
  const root = runtime.element('article');
  root.querySelectorAll = selector => selector === '.lesson-figure[data-figure]' ? hosts : [];
  runtime.window.mountLessonFigures(root);

  const findDescendant = (node, predicate) => {
    if (predicate(node)) return node;
    for (const child of node.children || []) {
      const match = findDescendant(child, predicate);
      if (match) return match;
    }
    return null;
  };

  for (const host of hosts) {
    assert.equal(host.dataset.lfMounted, '1', `${host.dataset.figure} did not mount`);
    assert.ok(
      findDescendant(host, node => node.className === 'asf-shell'),
      `${host.dataset.figure} did not render its staged shell`
    );
    const range = findDescendant(host, node => node.className === 'asf-range');
    assert.ok(range, `${host.dataset.figure} did not render its step control`);
    assert.match(range.getAttribute('aria-valuetext'), /^Step \d+ of \d+:/);
  }

  runtime.window.AIFSFigureRuntime.disposeRoot(root);
});

test('figure manifest deterministically routes only providers needed by lesson figure IDs', () => {
  const root = path.resolve(__dirname, '..');
  const first = buildFigureProviderManifest(root, __dirname);
  const second = buildFigureProviderManifest(root, __dirname);
  const usedIds = discoverUsedFigureIds(root);

  assert.deepEqual(first, second);
  assert.deepEqual(first.providerOrder, discoverFigureProviderOrder(__dirname));
  assert.deepEqual(first.providerOrder.slice(0, FIGURE_PROVIDER_ORDER.length), FIGURE_PROVIDER_ORDER);
  assert.equal(
    first.providerVersions['figures.js'],
    crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'figures.js'), 'utf8')).digest('hex').slice(0, 12)
  );
  assert.ok(usedIds.length > 500);
  assert.ok(Object.keys(first.providersByFigure).length < usedIds.length, 'runtime-local figures should not load a provider');
  assert.deepEqual(first.providersByFigure['tokenizer-bpe'], ['figures.js']);
  for (const providers of Object.values(first.providersByFigure)) {
    const indexes = providers.map(provider => first.providerOrder.indexOf(provider));
    assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
  }

  const manifestSource = serializeFigureProviderManifest(first);
  const manifestVersion = crypto.createHash('sha256').update(manifestSource).digest('hex').slice(0, 12);
  const runtimeSource = fs.readFileSync(path.join(__dirname, 'lesson-figures.js'), 'utf8');
  const runtimeVersion = crypto.createHash('sha256').update(runtimeSource).digest('hex').slice(0, 12);
  const lessonHtml = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  assert.match(manifestSource, /window\.AIFS_FIGURE_PROVIDER_VERSIONS =/);
  assert.match(lessonHtml, new RegExp(`lesson-figures\\.js\\?v=${runtimeVersion}`));
  assert.match(lessonHtml, new RegExp(`figure-manifest\\.js\\?v=${manifestVersion}`));
});

test('new figure provider modules are appended deterministically without disturbing legacy order', t => {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiefs-figure-providers-'));
  t.after(() => fs.rmSync(siteDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(siteDir, 'figures.js'), '');
  fs.writeFileSync(path.join(siteDir, 'figures-zeta.js'), '');
  fs.writeFileSync(path.join(siteDir, 'figures-agent-skills.js'), '');
  fs.writeFileSync(path.join(siteDir, 'lesson-figures.js'), '');

  assert.deepEqual(discoverFigureProviderOrder(siteDir, ['figures.js']), [
    'figures.js',
    'figures-agent-skills.js',
    'figures-zeta.js',
  ]);
});

test('progress v2 migrates quiz completion and keeps workflow checkpoints distinct', () => {
  const lesson = 'phases/13-tools-and-protocols/06-mcp-fundamentals';
  const legacy = JSON.stringify({
    lessons: {
      [lesson]: {
        answers: { q1: { picked: 1, correct: true, t: 100 } },
        completedAt: 200,
        visitedAt: 50,
      },
    },
    updatedAt: 200,
  });
  const migrated = loadProgressRuntime({ 'aifs:progress:v1': legacy });
  const historical = migrated.api.getLessonProgress(lesson);
  assert.equal(historical.completedAt, 200);
  assert.equal(historical.quizPassedAt, 200);
  assert.equal(historical.completionSource, 'migrated-v1');
  assert.equal(JSON.parse(migrated.storage.get('aifs:progress:v2')).schemaVersion, 2);

  const fresh = loadProgressRuntime();
  fresh.api.recordVisit(lesson);
  fresh.api.setCheckpoint(lesson, 'read', true);
  fresh.api.setCheckpoint(lesson, 'built', true);
  fresh.api.setCheckpoint(lesson, 'ran', true);
  fresh.api.setCheckpoint(lesson, 'evidence', true);
  fresh.api.markQuizPassed(lesson);
  assert.equal(fresh.api.isLessonComplete(lesson), false);
  assert.ok(fresh.api.getLessonProgress(lesson).quizPassedAt);
  assert.ok(fresh.api.getLessonProgress(lesson).checkpoints.evidenceAt);
  fresh.api.markLessonComplete(lesson, 'learner');
  fresh.api.unmarkQuizPassed(lesson);
  assert.equal(fresh.api.isLessonComplete(lesson), true);
  assert.equal(fresh.api.getLessonProgress(lesson).quizPassedAt, null);
});

test('lesson figure runtime mounts once and disposes its animation frame and control', () => {
  const runtime = loadFigureRuntime();
  const host = runtime.element('div');
  host.dataset.figure = 'runtime-test';
  const root = runtime.element('article');
  root.querySelectorAll = selector => selector === '.lesson-figure[data-figure]' ? [host] : [];
  let staticFrames = 0;

  runtime.window.LF.register({
    'runtime-test': figureHost => {
      runtime.window.LF.autoplay(figureHost, () => { staticFrames++; }, 1000, { staticT: 0.5 });
    },
  });
  runtime.window.mountLessonFigures(root);
  runtime.window.mountLessonFigures(root);

  assert.equal(staticFrames, 1, 'a mounted host must not receive a duplicate SVG loop');
  assert.equal(host.dataset.lfMounted, '1');
  const control = host.children.find(child => child.className === 'lf-motion-toggle');
  assert.ok(control);
  assert.equal(control.getAttribute('aria-pressed'), 'false');
  assert.equal(runtime.scheduledFrames.size, 1);

  runtime.dispatchWindow('beforeprint');
  assert.equal(staticFrames, 2);
  assert.equal(runtime.scheduledFrames.size, 0);
  runtime.dispatchWindow('afterprint');
  assert.equal(runtime.scheduledFrames.size, 1);

  control.click();
  assert.equal(control.getAttribute('aria-pressed'), 'true');
  assert.equal(runtime.scheduledFrames.size, 0);
  runtime.window.AIFSFigureRuntime.disposeRoot(root);
  assert.equal(host.dataset.lfMounted, undefined);
  assert.equal(host.children.includes(control), false);
  assert.ok(runtime.cancelledFrames() >= 1);
});

test('reduced motion holds SMIL figures on a meaningful static frame', () => {
  const runtime = loadFigureRuntime({ reducedMotion: true });
  const host = runtime.element('div');
  host.dataset.figure = 'smil-test';
  const svg = runtime.element('svg');
  let staticTime = null;
  let pauses = 0;
  svg.setCurrentTime = value => { staticTime = value; };
  svg.pauseAnimations = () => { pauses++; };
  svg.unpauseAnimations = () => {};
  host.querySelector = selector => selector === 'svg' ? svg : null;
  host.querySelectorAll = selector => {
    if (selector === 'svg') return [svg];
    if (selector.includes('repeatCount="indefinite"')) return [{}];
    return [];
  };
  const root = runtime.element('article');
  root.querySelectorAll = selector => selector === '.lesson-figure[data-figure]' ? [host] : [];
  runtime.window.LF.register({ 'smil-test': figureHost => figureHost.appendChild(svg) });

  runtime.window.mountLessonFigures(root);

  assert.equal(staticTime, 1.5);
  assert.ok(pauses >= 1);
  const control = host.children.find(child => child.className === 'lf-motion-toggle');
  assert.ok(control);
  assert.equal(control.disabled, true);
  assert.equal(control.textContent, 'Motion reduced');
  assert.equal(control.getAttribute('aria-label'), 'Animation disabled because reduced motion is enabled');
  assert.equal(runtime.scheduledFrames.size, 0);
});

test('MCP contract evaluator follows empty cursors and validates every structuredContent JSON type', () => {
  const logic = loadMcpLabLogic();
  const scenario = id => logic.contractScenarios.find(entry => entry.id === id);

  const emptyCursor = plainMcpValue(logic.evaluateContract(scenario('empty-cursor')));
  assert.equal(emptyCursor.kind, 'valid-complete');
  assert.equal(emptyCursor.tone, 'pass');
  assert.equal(emptyCursor.evidence.callResponse.result.nextCursor, '');
  assert.equal(emptyCursor.evidence.validation.cursorPresent, true);
  assert.equal(emptyCursor.evidence.validation.follow, true);
  assert.equal(emptyCursor.evidence.continuationRequest.params.cursor, '');
  assert.match(emptyCursor.verdict, /even when it is the empty string/i);

  const scalar = plainMcpValue(logic.evaluateContract(scenario('scalar')));
  assert.equal(scalar.kind, 'valid-complete');
  assert.equal(scalar.tone, 'pass');
  assert.equal(scalar.evidence.authoredDefinition.outputSchema.type, 'string');
  assert.equal(typeof scalar.evidence.callResponse.result.structuredContent, 'string');
  assert.equal(scalar.evidence.validation.outputSchemaMatched, true);
  assert.match(scalar.verdict, /any JSON value/i);

  const mismatch = plainMcpValue(logic.evaluateContract(scenario('schema')));
  assert.equal(mismatch.kind, 'protocol-error');
  assert.equal(mismatch.tone, 'fail');
  assert.equal(mismatch.evidence.callResponse.result.isError, true);
  assert.equal(mismatch.evidence.validation.valid, false);
  assert.equal(mismatch.evidence.validation.outputSchemaMatched, false);
  assert.match(mismatch.verdict, /does not waive outputSchema/i);

  const toolError = plainMcpValue(logic.evaluateContract(scenario('tool-error')));
  assert.equal(toolError.kind, 'tool-error');
  assert.equal(toolError.evidence.callResponse.result.isError, true);
  assert.equal(toolError.evidence.validation.valid, true);
  assert.equal(toolError.evidence.validation.outputSchemaMatched, true);
});

test('MCP progress is server-to-client and every reliability Task snapshot is complete', () => {
  const logic = loadMcpLabLogic();
  const byId = (entries, id) => entries.find(entry => entry.id === id);

  assert.ok(logic.requestScenarios.every(scenario => scenario.method !== 'notifications/progress'));
  assert.ok(logic.requestScenarios.every(scenario => scenario.idValue !== null));
  assert.ok(logic.transportScenarios.every(scenario => scenario.mode !== 'notification'));
  assert.ok(logic.dispatchScenarios.every(scenario => scenario.id !== 'notification'));

  const resourceRead = plainMcpValue(logic.evaluateRequestScenario(byId(logic.requestScenarios, 'resource-read')));
  assert.equal(resourceRead.tone, 'pass');
  assert.equal(resourceRead.evidence.request.body.method, 'resources/read');
  assert.equal(resourceRead.evidence.response.body.id, resourceRead.evidence.request.body.id);

  const stream = plainMcpValue(logic.evaluateTransport(byId(logic.transportScenarios, 'request-sse')));
  assert.equal(stream.evidence.request.body.method, 'tools/call');
  assert.equal(stream.evidence.response.progressDirection, 'server-to-client on the request-scoped response');
  assert.equal(stream.evidence.response.events[0].method, 'notifications/progress');
  assert.equal(stream.evidence.response.events[0].params.progressToken, stream.evidence.request.body.params._meta.progressToken);
  assert.equal(stream.evidence.response.events[1].id, stream.evidence.request.body.id);

  const conformance = plainMcpValue(logic.evaluateConformance(byId(logic.conformanceScenarios, 'request-progress'), 'differential'));
  assert.equal(conformance.kind, 'conformant');
  assert.equal(conformance.tone, 'pass');
  assert.equal(conformance.evidence.input.request.method, 'tools/call');
  assert.equal(conformance.evidence.input.responseEvents[0].method, 'notifications/progress');
  assert.equal(conformance.evidence.input.responseEvents[0].params.progressToken, conformance.evidence.input.request.params._meta.progressToken);
  assert.equal(conformance.evidence.input.responseEvents[1].id, conformance.evidence.input.request.id);
  assert.equal(conformance.evidence.expected.normalized.progressDirection, 'server-to-client');

  const toolsListDispatch = plainMcpValue(logic.evaluateDispatch(byId(logic.dispatchScenarios, 'tools-list')));
  assert.equal(toolsListDispatch.kind, 'response');
  assert.equal(JSON.parse(toolsListDispatch.evidence.stdinLine).method, 'tools/list');
  assert.equal(toolsListDispatch.evidence.stdout.id, JSON.parse(toolsListDispatch.evidence.stdinLine).id);

  const taskSnapshots = [];
  const collectTaskSnapshots = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.taskId === 'string' && typeof value.status === 'string') taskSnapshots.push(value);
    Object.values(value).forEach(collectTaskSnapshots);
  };
  for (const scenario of logic.reliabilityScenarios) {
    for (const operation of ['observe', 'request', 'task']) {
      collectTaskSnapshots(plainMcpValue(logic.evaluateReliability(scenario, operation)));
    }
  }
  assert.ok(taskSnapshots.length > 0, 'reliability evaluator did not expose any Task snapshots');
  for (const task of taskSnapshots) {
    assert.equal(typeof task.createdAt, 'string', `Task ${task.taskId} lacks createdAt`);
    assert.equal(typeof task.lastUpdatedAt, 'string', `Task ${task.taskId} lacks lastUpdatedAt`);
    assert.equal(typeof task.ttlMs, 'number', `Task ${task.taskId} lacks ttlMs`);
  }
});

test('MCP registry drift quarantines and deactivates only the drifted release', () => {
  const logic = loadMcpLabLogic();
  const scenario = logic.admissionScenarios.find(entry => entry.id === 'rollback');
  const result = plainMcpValue(logic.evaluateAdmission(scenario));

  assert.equal(result.kind, 'quarantined');
  assert.equal(result.tone, 'fail');
  assert.equal(result.evidence.computedState, 'quarantined');
  assert.equal(result.evidence.currentReleaseState.version, '4.0.0');
  assert.equal(result.evidence.currentReleaseState.quarantined, true);
  assert.equal(result.evidence.currentReleaseState.activeRouting, false);
  assert.match(result.evidence.currentReleaseState.quarantineReason, /descriptor digest/i);
  assert.equal(result.evidence.routingState.releaseVersion, '4.0.0');
  assert.equal(result.evidence.routingState.active, false);
  assert.equal(result.evidence.routingState.action, 'remove-from-active-routing');

  assert.notEqual(result.evidence.rollbackCandidate.version, result.evidence.currentReleaseState.version);
  assert.equal(result.evidence.rollbackCandidate.version, '3.9.2');
  assert.equal(result.evidence.rollbackCandidate.admissionState, 'admitted');
  assert.equal(result.evidence.rollbackCandidate.healthStatus, 'healthy');
  assert.equal(result.evidence.rollbackCandidate.rollbackEligible, true);
  assert.equal(result.evidence.rollbackCandidate.activeRouting, false);
  assert.equal(result.evidence.rollbackCandidate.activationRequires, 'explicit rollback decision');
  assert.match(result.verdict, /separately admitted, healthy 3\.9\.2 release/i);
});
