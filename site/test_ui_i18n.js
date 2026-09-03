#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SITE_DIR = __dirname;
const REPO_ROOT = path.dirname(SITE_DIR);
const ZH_DIR = path.join(SITE_DIR, 'i18n', 'zh');
const ZH_CATALOG_DIR = path.join(REPO_ROOT, 'i18n', 'zh', 'catalog');
const ZH_QUIZ_DIR = path.join(ZH_DIR, 'quizzes');
const ZH_SEARCH_DIR = path.join(ZH_DIR, 'search');
const LEARNING_PATHS_DIR = path.join(REPO_ROOT, 'learning-paths');
const UI_RUNTIME_PATH = path.join(SITE_DIR, 'ui-i18n.js');
const LANGUAGE_PICKER_PATH = path.join(SITE_DIR, 'lang-picker.js');

const PUBLIC_HTML_PAGES = [
  'index.html',
  'catalog.html',
  'lesson.html',
  'prereqs.html',
  'glossary.html',
  'learning-paths.html',
  'about.html',
  'contact.html',
  'privacy.html',
  'developer.html',
  '404.html',
];

const CERTIFICATION_HTML_PAGES = [
  'certification.html',
  'certifications.html',
  'assessment.html',
];

const INTENTIONALLY_UNTRANSLATED_VISIBLE_COPY = new Set([
  'AI / FROM SCRATCH',
  'AI Engineering',
  'AI Engineering from Scratch',
  'from Scratch',
  'y = σ(Wx + b)',
  'x',
  'h₁',
  'h₂',
  'ŷ',
  '/learn',
  'bar',
  'N',
  'A-Z',
  'Claude',
  'Cursor',
  'Codex',
  'Apple',
  'UC Berkeley',
  'Google',
  'Meta',
  'Stanford',
  'OpenAI',
  'Cornell',
  'NVIDIA',
  'Rutgers',
  'Microsoft',
  'UConn',
  'Amazon',
  'Carnegie Mellon',
  'Yahoo',
  'Major League Hacking',
  'EPUB',
  'PDF',
  'MIT',
  'Python',
  'TypeScript',
  'Rust',
  'Julia',
  'MCP',
  'Model Context Protocol (MCP)',
  'GitHub',
  'Rohit Ghumare',
  'github.com/rohitg00/ai-engineering-from-scratch',
  'llms.txt',
  '404 · AI Engineering from Scratch',
]);

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  const source = readUtf8(filePath);
  assertNoDuplicateJsonKeys(source, filePath);
  return JSON.parse(source);
}

function walkFiles(directory, predicate, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(filePath, predicate, files);
    else if (entry.isFile() && predicate(filePath)) files.push(filePath);
  }
  return files;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedRepoPath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join('/');
}

function exactStringsFromPackages(packages) {
  const strings = new Map();
  for (const pkg of packages) {
    for (const entry of packageStringEntries(pkg)) strings.set(entry.source, entry.translation);
  }
  return strings;
}

function loadPackagesFrom(directory) {
  return walkFiles(directory, file => file.endsWith('.json')).map(filePath => ({
    file: normalizedRepoPath(filePath),
    filePath,
    data: readJson(filePath),
  }));
}

function canonicalQuizFiles() {
  return walkFiles(path.join(REPO_ROOT, 'phases'), file => path.basename(file) === 'quiz.json');
}

function canonicalQuizQuestions(quiz) {
  if (Array.isArray(quiz)) return quiz;
  if (quiz && Array.isArray(quiz.questions)) return quiz.questions;
  return [];
}

function quizLessonPath(filePath) {
  return normalizedRepoPath(path.dirname(filePath));
}

function assertNoDuplicateJsonKeys(source, filePath) {
  const stack = [];
  let inString = false;
  let escaped = false;
  let token = '';
  let lastString = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        token += ch;
        escaped = false;
      } else if (ch === '\\') {
        token += ch;
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        lastString = JSON.parse('"' + token + '"');
        token = '';
      } else {
        token += ch;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      token = '';
    } else if (ch === '{') {
      stack.push(new Set());
      lastString = null;
    } else if (ch === '}') {
      stack.pop();
      lastString = null;
    } else if (ch === ':' && lastString !== null && stack.length) {
      const keys = stack[stack.length - 1];
      assert.ok(!keys.has(lastString), `${filePath} contains duplicate JSON key ${JSON.stringify(lastString)}`);
      keys.add(lastString);
      lastString = null;
    } else if (!/\s/.test(ch)) {
      lastString = null;
    }
  }
}

function loadZhPackages() {
  return fs.readdirSync(ZH_DIR)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => ({ file, data: readJson(path.join(ZH_DIR, file)) }));
}

function packageStringEntries(pkg) {
  const entries = [];
  for (const field of ['strings', 'exact']) {
    const table = pkg.data[field];
    if (!table) continue;
    for (const [source, translation] of Object.entries(table)) {
      entries.push({ file: pkg.file, field, source, translation });
    }
  }
  return entries;
}

function packagePatternEntries(pkg) {
  return (pkg.data.patterns || []).map((raw) => ({
    file: pkg.file,
    source: raw.pattern ?? raw.exact ?? raw.source,
    replacement: raw.replacement ?? raw.translation ?? raw.target,
    raw,
  }));
}

function placeholderNames(template) {
  return Array.from(
    String(template).matchAll(/\{([a-zA-Z0-9_]+)\}/g),
    match => match[1]
  );
}

function regexCaptureCount(source) {
  return new RegExp(`(?:${source})|`).exec('').length - 1;
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort((left, right) => left.localeCompare(right));
}

function assertSameKeys(actual, expected, message) {
  assert.deepEqual(sortedKeys(actual), sortedKeys(expected), message);
}

function addVisibleString(target, value, label) {
  if (typeof value === 'string' && value.trim()) target.push({ value, label });
}

function decodeHtmlText(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function staticVisibleStrings(html) {
  const body = (html.match(/<body[\s\S]*<\/body>/i) || [''])[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<tr[^>]*data-generated-discovery=["']lesson["'][^>]*>[\s\S]*?<\/tr>/gi, '')
    .replace(/<(pre|code|kbd|samp|textarea)[^>]*>[\s\S]*?<\/\1>/gi, '<$1></$1>')
    .replace(/<!--[\s\S]*?-->/g, '');
  return [
    ...Array.from(body.matchAll(/>([^<]+)</g), match => decodeHtmlText(match[1])),
    ...Array.from(
      body.matchAll(/(?:aria-label|aria-valuetext|alt|title|placeholder|data-tts-section|data-tts-label)="([^"]+)"/g),
      match => decodeHtmlText(match[1])
    ),
  ].filter(value => /[A-Za-z]/.test(value));
}

function learningPathVisibleStrings(learningPath, label) {
  const strings = [];
  for (const field of ['title', 'summary', 'conceptualFallback']) {
    addVisibleString(strings, learningPath[field], `${label}.${field}`);
  }
  addVisibleString(
    strings,
    learningPath.invocation && learningPath.invocation.portableFallback,
    `${label}.invocation.portableFallback`
  );
  for (const [index, prerequisite] of (learningPath.prerequisites || []).entries()) {
    addVisibleString(strings, prerequisite.title, `${label}.prerequisites[${index}].title`);
    addVisibleString(strings, prerequisite.description, `${label}.prerequisites[${index}].description`);
  }
  const quickStart = learningPath.quickStart || {};
  addVisibleString(strings, quickStart.goal, `${label}.quickStart.goal`);
  addVisibleString(strings, quickStart.workingDirectory, `${label}.quickStart.workingDirectory`);
  for (const [index, value] of (quickStart.expectedEvidence || []).entries()) {
    addVisibleString(strings, value, `${label}.quickStart.expectedEvidence[${index}]`);
  }
  const deploymentGate = learningPath.publicDeploymentGate || {};
  addVisibleString(strings, deploymentGate.appliesBefore, `${label}.publicDeploymentGate.appliesBefore`);
  for (const [index, value] of (deploymentGate.requiredEvidence || []).entries()) {
    addVisibleString(strings, value, `${label}.publicDeploymentGate.requiredEvidence[${index}]`);
  }
  for (const collection of ['lessons', 'optionalLessons']) {
    for (const [index, lesson] of (learningPath[collection] || []).entries()) {
      if (!lesson || typeof lesson !== 'object') continue;
      for (const field of ['title', 'checkpoint', 'entryRule']) {
        addVisibleString(strings, lesson[field], `${label}.${collection}[${index}].${field}`);
      }
      for (const [evidenceIndex, value] of (lesson.checkpointEvidence || []).entries()) {
        addVisibleString(
          strings,
          value,
          `${label}.${collection}[${index}].checkpointEvidence[${evidenceIndex}]`
        );
      }
    }
  }
  return strings;
}

function extractCatalog() {
  const source = readUtf8(path.join(SITE_DIR, 'data.js'));
  const context = {};
  vm.runInNewContext(
    `${source}\nthis.__TEST_CAPTURE__ = { PHASES, GLOSSARY, ARTIFACTS, LEARNING_PATHS, CURRICULUM_SUMMARY };`,
    context,
    { filename: 'site/data.js' }
  );

  // Return host-realm objects. This keeps strict assertions and builder calls
  // independent of VM prototypes.
  return JSON.parse(JSON.stringify(context.__TEST_CAPTURE__));
}

let generatedI18nCache = null;
function generateI18nData() {
  if (generatedI18nCache) return generatedI18nCache;

  const { writeI18nData } = require('./build.js');
  const { PHASES } = extractCatalog();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifs-ui-i18n-'));
  const outputPath = path.join(tempDir, 'i18n-data.js');

  try {
    writeI18nData(PHASES, outputPath);
    const source = readUtf8(outputPath);
    const figureSource = readUtf8(path.join(tempDir, 'i18n-figures.js'));
    const glossarySource = readUtf8(path.join(tempDir, 'i18n-glossary.js'));
    const context = { window: {} };
    for (const [filename, generatedSource] of [
      [outputPath, source],
      [path.join(tempDir, 'i18n-figures.js'), figureSource],
      [path.join(tempDir, 'i18n-glossary.js'), glossarySource],
    ]) {
      vm.runInNewContext(generatedSource, context, { filename });
    }
    generatedI18nCache = {
      payload: JSON.parse(JSON.stringify(context.window.AIFS_I18N)),
      source,
      figureSource,
      glossarySource,
      generatedAssets: new Map(
        fs.readdirSync(tempDir)
          .filter(file => /^i18n-(?:quizzes|search)-zh-.*\.json$/.test(file))
          .map(file => [file, readUtf8(path.join(tempDir, file))])
      ),
      phases: PHASES,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return generatedI18nCache;
}

function lessonCatalogPath(url) {
  const match = String(url || '').match(/(phases\/[^/?#]+\/[^/?#]+)/);
  return match ? match[1] : '';
}

function phaseCatalogPath(phase) {
  for (const lesson of phase.lessons || []) {
    const lessonPath = lessonCatalogPath(lesson.url);
    if (lessonPath) return lessonPath.split('/')[1];
  }
  return '';
}

function textNode(value) {
  return {
    nodeType: 3,
    nodeValue: String(value),
    parentNode: null,
    nextSibling: null,
  };
}

function elementNode(tagName, children = [], attributes = {}) {
  const attrs = new Map(
    Object.entries(attributes).map(([name, value]) => [name, String(value)])
  );
  const element = {
    nodeType: 1,
    tagName: String(tagName).toUpperCase(),
    parentNode: null,
    firstChild: null,
    nextSibling: null,
    lang: '',
    dir: '',
    hasAttribute(name) {
      return attrs.has(name);
    },
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    appendChild(child) {
      if (!this.firstChild) {
        this.firstChild = child;
      } else {
        let previous = this.firstChild;
        while (previous.nextSibling) previous = previous.nextSibling;
        previous.nextSibling = child;
      }
      child.parentNode = this;
      child.nextSibling = null;
      return child;
    },
  };

  for (const child of children) element.appendChild(child);
  return element;
}

function documentStub(bodyChildren) {
  const body = elementNode('body', bodyChildren);
  const documentElement = elementNode('html', [body]);
  return {
    nodeType: 9,
    documentElement,
    body,
    readyState: 'complete',
    addEventListener() {},
  };
}

function memoryStorage(initial = {}) {
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
  };
}

function bootUiRuntime({
  payload,
  phases = [],
  languages = [{ code: 'en' }, { code: 'zh' }],
  figureProviders = {},
  pathname = '/index.html',
  search = '',
  bodyChildren = [],
  storage = {},
  MutationObserver,
  pageMarker = '',
}) {
  const listeners = new Map();
  const document = documentStub(bodyChildren);
  if (pageMarker) document.documentElement.setAttribute('data-i18n-page', pageMarker);
  const localStorage = memoryStorage(storage);
  const window = {
    AIFS_I18N: payload,
    AIFS_LANGS: languages,
    AIFS_FIGURE_PROVIDERS: figureProviders,
    PHASES: phases,
    WeakMap,
    URLSearchParams,
    location: { pathname, search },
    localStorage,
    MutationObserver,
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) {
        listener.call(window, event);
      }
      return true;
    },
  };

  vm.runInNewContext(
    readUtf8(UI_RUNTIME_PATH),
    { window, document, URLSearchParams },
    { filename: 'site/ui-i18n.js' }
  );

  return {
    api: window.AIFS_I18n,
    document,
    localStorage,
    window,
    changeLanguage(lang) {
      window.dispatchEvent({
        type: 'aifs:language-change',
        detail: { lang },
      });
    },
  };
}

function glossaryEntryRenderer(api, entry) {
  const pageSource = readUtf8(path.join(SITE_DIR, 'glossary.html'));
  function sourceBetween(startMarker, endMarker) {
    const start = pageSource.indexOf(startMarker);
    const end = pageSource.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `missing glossary renderer seam: ${startMarker}`);
    return pageSource.slice(start, end);
  }

  let escaped = '';
  const context = {
    URL,
    window: {
      AIFS_I18n: api,
      location: {
        href: 'https://aiengineeringfromscratch.com/glossary.html',
        origin: 'https://aiengineeringfromscratch.com',
      },
    },
    document: {
      createElement() {
        return {
          set textContent(value) { escaped = String(value); },
          get innerHTML() {
            return escaped
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          },
        };
      },
    },
    entries: [JSON.parse(JSON.stringify(entry))],
    entryByKey: Object.create(null),
    normalize(value) { return String(value || '').trim().toLowerCase(); },
    slugify(value) {
      return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    },
    refreshCollator() {},
  };

  const rendererSource = [
    sourceBetween('        function text(value)', '        function normalize(value)'),
    sourceBetween('        function localized(value)', '        function refreshCollator()'),
    sourceBetween('        function escapeHtml(str)', '        function compareText(a, b)'),
    sourceBetween('        function refreshLocalizedEntries()', '        var categoryCounts'),
    sourceBetween('        function resourceHtml(label, resources, sourceKind)', '        function announce(message)'),
    'this.renderEntry = function () { refreshLocalizedEntries(); return entryHtml(entries[0]); };',
  ].join('\n');

  vm.runInNewContext(rendererSource, context, { filename: 'site/glossary.html#entryRenderer' });
  return () => context.renderEntry();
}

test('zh i18n packages use supported JSON shapes and valid patterns', () => {
  const packages = loadZhPackages();
  const allowedTopLevelKeys = new Set([
    'locale',
    'description',
    'target',
    'strings',
    'exact',
    'patterns',
    'providers',
  ]);

  assert.ok(packages.length > 0, 'expected at least one site/i18n/zh package');

  for (const pkg of packages) {
    const keys = Object.keys(pkg.data);
    assert.ok(
      keys.some(key => key === 'strings' || key === 'exact' || key === 'patterns'),
      `${pkg.file} should contain strings, exact, or patterns`
    );

    for (const key of keys) {
      assert.ok(
        allowedTopLevelKeys.has(key),
        `${pkg.file} uses unsupported top-level key ${JSON.stringify(key)}`
      );
    }

    for (const entry of packageStringEntries(pkg)) {
      assert.equal(
        typeof entry.translation,
        'string',
        `${pkg.file} ${entry.field}.${JSON.stringify(entry.source)} must map to a string`
      );
    }

    for (const entry of packagePatternEntries(pkg)) {
      assert.equal(typeof entry.source, 'string', `${pkg.file} pattern source must be a string`);
      assert.ok(entry.source.length > 0, `${pkg.file} patterns need a non-empty source`);
      assert.equal(
        typeof entry.replacement,
        'string',
        `${pkg.file} pattern replacement must be a string`
      );
      assert.ok(entry.replacement.length > 0, `${pkg.file} patterns need a non-empty replacement`);

      if (typeof entry.raw.pattern === 'string') {
        assert.doesNotThrow(
          () => new RegExp(entry.raw.pattern),
          `${pkg.file} contains an invalid regular expression: ${entry.raw.pattern}`
        );
      }

      const replacementNames = placeholderNames(entry.replacement);
      if (!replacementNames.length) continue;
      const availableNames = typeof entry.raw.pattern === 'string'
        ? Array.from(entry.raw.pattern.matchAll(/\(\?<([a-zA-Z0-9_]+)>/g), match => match[1])
        : placeholderNames(entry.source);
      for (const name of replacementNames) {
        assert.ok(
          availableNames.includes(name),
          `${pkg.file} replacement references unavailable placeholder {${name}}`
        );
      }
    }
  }
});

test('all catalog and nested zh source JSON rejects duplicate raw keys', () => {
  const files = [
    ...walkFiles(ZH_DIR, file => file.endsWith('.json')),
    ...walkFiles(ZH_CATALOG_DIR, file => file.endsWith('.json')),
  ];
  assert.ok(files.length > loadZhPackages().length, 'nested quiz and search JSON should be audited');
  for (const file of files) readJson(file);
});

test('catalog source values are strict non-empty strings', () => {
  for (const pkg of loadPackagesFrom(ZH_CATALOG_DIR)) {
    for (const [phase, value] of Object.entries(pkg.data.phases || {})) {
      assert.equal(typeof value, 'object', `${pkg.file} phase ${phase} must be an object`);
      for (const field of ['title', 'description']) {
        assert.equal(typeof value[field], 'string', `${pkg.file} ${phase}.${field} must be a string`);
        assert.ok(value[field].trim(), `${pkg.file} ${phase}.${field} must be non-empty`);
      }
    }
    for (const [lesson, value] of Object.entries(pkg.data.lessons || {})) {
      assert.equal(typeof value, 'string', `${pkg.file} lesson ${lesson} must be a string`);
      assert.ok(value.trim(), `${pkg.file} lesson ${lesson} must be non-empty`);
    }
  }
});

test('pattern replacement numeric captures never exceed the source capture count', () => {
  for (const pkg of loadZhPackages()) {
    for (const entry of packagePatternEntries(pkg)) {
      let captureCount = 0;
      if (typeof entry.raw.pattern === 'string') captureCount = regexCaptureCount(entry.raw.pattern);
      else if (/\{[A-Za-z0-9_]+\}/.test(entry.source)) captureCount = placeholderNames(entry.source).length;
      else if (/^\^|\$$|\\|\(\?<|\(\.|\[/.test(entry.source)) captureCount = regexCaptureCount(entry.source);
      for (const match of entry.replacement.matchAll(/\$(\d+)/g)) {
        const reference = Number(match[1]);
        assert.ok(
          reference === 0 || reference <= captureCount,
          `${pkg.file} replacement ${entry.replacement} references $${reference}, but ${entry.source} has ${captureCount} captures`
        );
      }
    }
  }
});

test('all visible learning-path prose has an exact Simplified Chinese mapping', () => {
  const strings = exactStringsFromPackages(loadZhPackages());
  for (const file of walkFiles(LEARNING_PATHS_DIR, value => value.endsWith('.json'))) {
    const learningPath = readJson(file);
    for (const entry of learningPathVisibleStrings(learningPath, normalizedRepoPath(file))) {
      assert.ok(strings.has(entry.value), `missing zh mapping for ${entry.label}: ${entry.value}`);
      assert.equal(typeof strings.get(entry.value), 'string');
      assert.ok(strings.get(entry.value).trim(), `empty zh mapping for ${entry.label}`);
    }
  }
});

test('homepage visible copy has explicit Simplified Chinese coverage', () => {
  const strings = new Map(
    loadZhPackages()
      .filter(pkg => ['shared.json', 'home.json', 'learning-paths.json'].includes(pkg.file))
      .flatMap(packageStringEntries)
      .map(entry => [entry.source.trim(), entry.translation])
  );
  for (const source of new Set(staticVisibleStrings(readUtf8(path.join(SITE_DIR, 'index.html'))))) {
    if (INTENTIONALLY_UNTRANSLATED_VISIBLE_COPY.has(source) || /^[xh]?[₁₂]? =|^\d+(?: \/ \d+)?$/.test(source)) continue;
    assert.ok(strings.has(source), `missing index.html zh mapping: ${source}`);
    assert.ok(strings.get(source).trim(), `empty index.html zh mapping: ${source}`);
  }
});

test('all localized public page templates translate visible text and attributes', () => {
  const payload = generateI18nData().payload;
  let checked = 0;
  const missing = [];

  for (const file of PUBLIC_HTML_PAGES) {
    const runtime = bootUiRuntime({
      payload,
      phases: generateI18nData().phases,
      pathname: '/' + file,
      search: '?lang=zh',
    });
    const sources = new Set(staticVisibleStrings(readUtf8(path.join(SITE_DIR, file))));
    for (const source of sources) {
      if (INTENTIONALLY_UNTRANSLATED_VISIBLE_COPY.has(source)) continue;
      if (/^[xh]?[₁₂]? =|^\d+(?: \/ \d+)?$/.test(source)) continue;
      checked += 1;
      if (runtime.api.t(source, 'zh') === source) missing.push(`${file}: ${source}`);
    }
  }

  assert.ok(checked > 100, `expected broad public-page coverage, checked only ${checked} strings`);
  assert.deepEqual(missing, [], 'visible public-page copy should have Simplified Chinese coverage');
});

test('all visible glossary prose and course/source link labels have zh mappings', () => {
  const { GLOSSARY } = extractCatalog();
  const strings = exactStringsFromPackages(
    loadZhPackages().filter(pkg => pkg.file.startsWith('glossary-') || pkg.file === 'catalog-glossary.json')
  );
  const fields = ['category', 'says', 'means', 'whyItMatters', 'example', 'confusion', 'whyCalled'];
  for (const entry of GLOSSARY) {
    for (const field of fields) {
      if (!entry[field]) continue;
      assert.ok(strings.has(entry[field]), `missing glossary zh mapping for ${entry.term}.${field}`);
    }
    // Course links are curriculum UI labels and should be localized. Official
    // paper/specification titles are proper names and intentionally remain as-is.
    for (const link of entry.lessons || []) {
      assert.ok(strings.has(link.label), `missing glossary zh lesson label for ${entry.term}: ${link.label}`);
    }
  }
});

test('glossary entry markup relocalizes every dynamic label and restores English', () => {
  const payload = {
    zh: {
      bundles: {
        'catalog-glossary': readJson(path.join(ZH_DIR, 'catalog-glossary.json')),
        'glossary-a-e': readJson(path.join(ZH_DIR, 'glossary-a-e.json')),
      },
    },
  };
  const runtime = bootUiRuntime({
    payload,
    pathname: '/glossary.html',
  });
  const entry = {
    term: 'Backpropagation',
    slug: 'backpropagation',
    category: 'Math & training',
    says: 'How neural networks learn.',
    means: 'An efficient application of the chain rule that propagates derivatives from a scalar loss backward through a computation graph. It computes gradients; an optimizer uses those gradients to update parameters.',
    whyItMatters: 'It lets you train larger models or sequences within a fixed memory budget by trading additional computation for lower activation storage.',
    example: 'Checkpoint the memory-heavy transformer blocks, measure the extra step time, and keep recovery checkpoints separate from activation-recomputation settings.',
    confusion: 'Backpropagation calculates gradients. It does not choose the update rule or learning rate.',
    whyCalled: 'Derivative information moves backward from the loss toward earlier operations.',
    aliases: ['Reverse-mode differentiation'],
    related: ['Autograd'],
    lessons: [{
      label: 'Backpropagation from Scratch',
      url: '../phases/03-deep-learning-core/03-backpropagation/',
    }],
    sources: [{
      label: 'Training Deep Nets with Sublinear Memory Cost',
      url: 'https://arxiv.org/abs/1604.06174',
    }],
    sourceIndex: 0,
  };

  const renderEntry = glossaryEntryRenderer(runtime.api, entry);
  runtime.changeLanguage('zh');
  const chinese = renderEntry();
  for (const expected of [
    '朗读术语',
    '复制链接',
    '工作定义',
    '为什么重要',
    '实际应用',
    '常见简写',
    '又称 · Reverse-mode differentiation',
    '不要与它混淆',
    '为何这样命名',
    '在课程中学习它',
    '一手资料',
    '区别与依据',
    '相关术语',
    'aria-label=\"朗读',
    'aria-label=\"复制指向',
    'aria-label=\"与',
  ]) {
    assert.ok(chinese.includes(expected), `Chinese glossary markup should include ${expected}`);
  }
  for (const staleEnglish of [
    '>Read term<',
    '>Copy link<',
    '>Working definition<',
    '>Why it matters<',
    '>In practice<',
    '>Do not confuse it with<',
    '>Why it is called this<',
    '>Distinctions and evidence<',
    '>Related terms<',
    'aria-label=\"Read ',
    'aria-label=\"Copy link to ',
    'aria-label=\"Terms related to ',
  ]) {
    assert.ok(!chinese.includes(staleEnglish), `Chinese glossary markup should not retain ${staleEnglish}`);
  }

  runtime.changeLanguage('en');
  const english = renderEntry();
  for (const expected of [
    '>Read term<',
    '>Copy link<',
    '>Working definition<',
    '>Common shortcut<',
    '>Do not confuse it with<',
    '>Why it is called this<',
    '>Learn it in the course<',
    '>Primary sources<',
    '>Distinctions and evidence<',
    '>Related terms<',
    'aria-label=\"Read Backpropagation aloud\"',
    'aria-label=\"Copy link to Backpropagation\"',
    'aria-label=\"Terms related to Backpropagation\"',
  ]) {
    assert.ok(english.includes(expected), `English glossary markup should restore ${expected}`);
  }
});

test('quiz overlays exactly cover canonical quizzes and preserve source structure', () => {
  const canonical = new Map(canonicalQuizFiles().map(file => [quizLessonPath(file), file]));
  const overlays = new Map();
  for (const pkg of loadPackagesFrom(ZH_QUIZ_DIR)) {
    assert.equal(pkg.data.schemaVersion, 1, `${pkg.file} schemaVersion`);
    assert.deepEqual(sortedKeys(pkg.data).sort(), ['lessons', 'schemaVersion']);
    for (const [lessonPath, overlay] of Object.entries(pkg.data.lessons || {})) {
      assert.ok(!overlays.has(lessonPath), `duplicate quiz overlay for ${lessonPath}`);
      overlays.set(lessonPath, { overlay, file: pkg.file });
    }
  }
  assertSameKeys(Object.fromEntries(overlays), Object.fromEntries(canonical), 'quiz overlay paths must exactly match canonical quiz files');
  for (const [lessonPath, sourcePath] of canonical) {
    const sourceRaw = fs.readFileSync(sourcePath);
    const source = readJson(sourcePath);
    const sourceQuestions = canonicalQuizQuestions(source);
    const { overlay, file } = overlays.get(lessonPath);
    assert.equal(overlay.sourceSha256, sha256(sourceRaw), `${file} stale hash for ${lessonPath}`);
    assert.equal(overlay.questions.length, sourceQuestions.length, `${file} question count for ${lessonPath}`);
    for (let index = 0; index < sourceQuestions.length; index += 1) {
      const translated = overlay.questions[index];
      const original = sourceQuestions[index];
      assert.deepEqual(sortedKeys(translated), ['explanation', 'options', 'question']);
      assert.equal(typeof translated.question, 'string');
      assert.ok(translated.question.trim());
      assert.equal(typeof translated.explanation, 'string');
      if (original.explanation) {
        assert.ok(translated.explanation.trim(), `${file} question ${index} explanation`);
      } else {
        assert.equal(translated.explanation, '', `${file} question ${index} should preserve an empty explanation`);
      }
      assert.equal(translated.options.length, original.options.length);
      for (const option of translated.options) {
        assert.equal(typeof option, 'string');
        assert.ok(option.trim());
      }
    }
  }
});

test('search overlays exactly cover lesson summaries and described artifacts', () => {
  const { PHASES, ARTIFACTS } = extractCatalog();
  const expectedLessons = {};
  for (const phase of PHASES) {
    for (const lesson of phase.lessons || []) {
      const lessonPath = lessonCatalogPath(lesson.url);
      if (lessonPath && lesson.summary) expectedLessons[lessonPath] = lesson.summary;
    }
  }
  const expectedArtifacts = Object.fromEntries(
    ARTIFACTS.filter(artifact => artifact.file && artifact.description)
      .map(artifact => [artifact.file, artifact.description])
  );
  const lessons = {};
  const artifacts = {};
  for (const pkg of loadPackagesFrom(ZH_SEARCH_DIR)) {
    assert.equal(pkg.data.schemaVersion, 1, `${pkg.file} schemaVersion`);
    for (const [key, value] of Object.entries(pkg.data.lessons || {})) {
      assert.ok(!Object.hasOwn(lessons, key), `duplicate search lesson ${key}`);
      lessons[key] = value;
    }
    for (const [key, value] of Object.entries(pkg.data.artifacts || {})) {
      assert.ok(!Object.hasOwn(artifacts, key), `duplicate search artifact ${key}`);
      artifacts[key] = value;
    }
  }
  assert.equal(
    Object.keys(expectedLessons).length,
    PHASES.reduce((total, phase) => total + (phase.lessons || []).length, 0)
  );
  assertSameKeys(lessons, expectedLessons, 'search lesson overlays');
  assertSameKeys(artifacts, expectedArtifacts, 'search artifact overlays');
  for (const [key, source] of Object.entries(expectedLessons)) {
    assert.deepEqual(sortedKeys(lessons[key]), ['source', 'translation']);
    assert.equal(lessons[key].source, source, `${key} source drift`);
    assert.ok(lessons[key].translation.trim(), `${key} missing translation`);
  }
  for (const [key, source] of Object.entries(expectedArtifacts)) {
    assert.deepEqual(sortedKeys(artifacts[key]), ['source', 'translation']);
    assert.equal(artifacts[key].source, source, `${key} source drift`);
    assert.ok(artifacts[key].translation.trim(), `${key} missing translation`);
  }
});

test('build.js emits the window.AIFS_I18N.zh.bundles contract with a complete catalog', () => {
  const { payload, source, figureSource, glossarySource, phases } = generateI18nData();
  const bundles = payload.zh && payload.zh.bundles;

  assert.ok(bundles, 'generated payload should expose zh.bundles');
  assert.ok(bundles.shared, 'generated payload should include the shared bundle');
  assert.ok(bundles.catalog, 'generated payload should include the generated catalog bundle');
  const expectedPhaseCount = fs.readdirSync(path.join(REPO_ROOT, 'phases'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name)).length;
  const expectedLessonCount = phases.reduce((total, phase) => total + phase.lessons.length, 0);
  assert.equal(phases.length, expectedPhaseCount, 'site data should expose every core phase directory');
  assert.equal(Object.keys(bundles.catalog.phases).length, expectedPhaseCount);
  assert.equal(Object.keys(bundles.catalog.lessons).length, expectedLessonCount);

  for (const phase of phases) {
    const phasePath = phaseCatalogPath(phase);
    const localizedPhase = bundles.catalog.phases[phasePath];
    assert.ok(localizedPhase, `missing generated phase translation for ${phasePath}`);
    assert.ok(localizedPhase.title, `missing generated phase title for ${phasePath}`);
    assert.ok(localizedPhase.description, `missing generated phase description for ${phasePath}`);

    for (const lesson of phase.lessons || []) {
      const lessonPath = lessonCatalogPath(lesson.url);
      assert.ok(lessonPath, `lesson ${lesson.name} should have a canonical path`);
      assert.ok(
        bundles.catalog.lessons[lessonPath],
        `missing generated lesson translation for ${lessonPath}`
      );
    }
  }

  assert.equal(bundles.catalog.phases['00-setup-and-tooling'].title, '设置与工具');
  assert.equal(
    bundles.catalog.lessons['phases/00-setup-and-tooling/01-dev-environment'],
    '开发环境'
  );

  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'generated/i18n-data.js' });
  assert.ok(context.window.AIFS_I18N.zh.bundles.catalog);
  assert.ok(!Object.keys(context.window.AIFS_I18N.zh.bundles).some(name => name.startsWith('figures-')));
  assert.ok(!Object.keys(context.window.AIFS_I18N.zh.bundles).some(name => name.startsWith('glossary-')));
  const extensionContext = { window: context.window };
  vm.runInNewContext(
    figureSource,
    extensionContext,
    { filename: 'generated/i18n-figures.js' }
  );
  vm.runInNewContext(
    glossarySource,
    extensionContext,
    { filename: 'generated/i18n-glossary.js' }
  );
  assert.ok(extensionContext.window.AIFS_I18N.zh.bundles['figures-a']);
  assert.ok(extensionContext.window.AIFS_I18N.zh.bundles['glossary-a-e']);
  assert.equal(
    Object.keys(context.window.AIFS_I18N.zh.bundles.catalog.lessons).length,
    expectedLessonCount
  );
});

test('catalog runtime translates every phase and lesson title from its canonical path mapping', () => {
  const { payload, phases } = generateI18nData();
  const catalog = payload.zh.bundles.catalog;
  const runtime = bootUiRuntime({
    payload,
    phases,
    pathname: '/catalog.html',
    search: '?lang=zh',
  });
  let lessonCount = 0;

  for (const phase of phases) {
    const phasePath = phaseCatalogPath(phase);
    assert.equal(runtime.api.t(phase.name, 'zh'), catalog.phases[phasePath].title);
    assert.equal(runtime.api.t(phase.desc, 'zh'), catalog.phases[phasePath].description);
    for (const lesson of phase.lessons || []) {
      const lessonPath = lessonCatalogPath(lesson.url);
      assert.ok(lessonPath, `lesson ${lesson.name} should expose a canonical path`);
      assert.equal(
        runtime.api.catalogTitle(lesson.url, lesson.name, 'zh'),
        catalog.lessons[lessonPath],
        `runtime translation mismatch for ${lessonPath}`
      );
      lessonCount += 1;
    }
  }

  assert.equal(lessonCount, 523);
});

test('curriculum summary distinguishes core phases from guided routes', () => {
  const { PHASES, LEARNING_PATHS, CURRICULUM_SUMMARY } = extractCatalog();
  const phaseDirectories = fs.readdirSync(path.join(REPO_ROOT, 'phases'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name));
  const certificationTracks = fs.readdirSync(path.join(REPO_ROOT, 'certifications', 'claude', 'tracks'))
    .filter(file => file.endsWith('.json'));
  const certificationLessons = fs.readdirSync(path.join(REPO_ROOT, 'certifications', 'claude', 'lessons'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name));

  assert.equal(PHASES.length, phaseDirectories.length);
  assert.equal(CURRICULUM_SUMMARY.corePhases, phaseDirectories.length);
  assert.equal(CURRICULUM_SUMMARY.coreLessons, PHASES.reduce((total, phase) => total + phase.lessons.length, 0));
  assert.equal(CURRICULUM_SUMMARY.focusedLearningPaths, LEARNING_PATHS.length);
  assert.equal(CURRICULUM_SUMMARY.certificationTracks, certificationTracks.length);
  assert.equal(CURRICULUM_SUMMARY.certificationLessons, certificationLessons.length);
  assert.equal(CURRICULUM_SUMMARY.guidedRoutes, LEARNING_PATHS.length + certificationTracks.length);
  assert.equal(CURRICULUM_SUMMARY.publishedLessons, CURRICULUM_SUMMARY.coreLessons + certificationLessons.length);
  const aboutHtml = readUtf8(path.join(SITE_DIR, 'about.html'));
  const fallback = aboutHtml.match(/<p class="lede" id="aboutCurriculumSummary">([^<]+)<\/p>/);
  assert.ok(fallback, 'about page should include a no-JavaScript curriculum summary');
  assert.match(fallback[1], new RegExp('\\b' + CURRICULUM_SUMMARY.coreLessons + ' lessons\\b'));
  assert.match(fallback[1], new RegExp('\\b' + CURRICULUM_SUMMARY.focusedLearningPaths + ' focused paths\\b'));
});

test('contact page visible copy is covered by the pages bundle', () => {
  const pages = JSON.parse(readUtf8(path.join(SITE_DIR, 'i18n', 'zh', 'pages.json')));
  const html = readUtf8(path.join(SITE_DIR, 'contact.html'));
  for (const text of [
    'Choose the right channel',
    'Open an issue when a published lesson, code example, quiz, translation, or website feature is incorrect or cannot be used as documented. Use a discussion when you need help understanding a concept, want to compare learning approaches, or have an idea that still needs community input. Keeping those conversations public makes the answer searchable for the next learner with the same question.',
    'The course does not operate learner accounts, paid enrollment, admissions, or an official credential service. Maintainers review public reports as time allows, so there is no guaranteed response time. A specific title, URL, command, environment, and observed result makes a report easier to reproduce and resolve.',
  ]) {
    assert.ok(html.includes(text), 'contact page should retain the reviewed English source text');
    assert.equal(typeof pages.strings[text], 'string', 'pages bundle should translate: ' + text);
    assert.ok(pages.strings[text].trim(), 'contact translation should not be empty: ' + text);
  }
});

test('generated split quiz and search assets match source metadata and content', () => {
  const { payload, generatedAssets } = generateI18nData();
  const assets = payload.zh && payload.zh.assets;
  assert.ok(assets, 'generated payload should expose zh.assets');
  assert.equal(assets.quizzes.manifestVersion, 1);
  assert.match(assets.search.url, /^i18n-search-zh-[0-9a-f]{12}\.json$/);
  assert.match(assets.search.sha256, /^[0-9a-f]{64}$/);

  const searchRaw = generatedAssets.get(assets.search.url);
  assert.ok(searchRaw, `missing generated ${assets.search.url}`);
  assert.equal(sha256(searchRaw), assets.search.sha256);
  const search = JSON.parse(searchRaw);
  assert.equal(search.schemaVersion, 1);
  assert.equal(search.locale, 'zh');
  assert.equal(
    Object.keys(search.lessons).length,
    extractCatalog().PHASES.reduce(
      (total, phase) => total + (phase.lessons || []).length,
      0
    )
  );
  assert.equal(Object.keys(search.glossary).length, 250);

  const { ARTIFACTS } = extractCatalog();
  assert.equal(
    Object.keys(search.artifacts).length,
    ARTIFACTS.filter(artifact => artifact.description).length
  );
  for (const [slug, entry] of Object.entries(search.glossary)) {
    assert.deepEqual(sortedKeys(entry), ['keywords', 'says', 'summary', 'term'], `${slug} search fields`);
    for (const field of ['term', 'summary', 'says', 'keywords']) assert.equal(typeof entry[field], 'string');
    assert.ok(entry.term.trim(), `${slug} needs a display term`);
    assert.ok(entry.summary.trim(), `${slug} needs a localized summary`);
  }

  const canonical = new Map(canonicalQuizFiles().map(file => [quizLessonPath(file), file]));
  assertSameKeys(assets.quizzes.lessons, Object.fromEntries(canonical), 'quiz manifest coverage');
  for (const [lessonPath, sourcePath] of canonical) {
    const manifestEntry = assets.quizzes.lessons[lessonPath];
    assert.deepEqual(sortedKeys(manifestEntry), ['sourceSha256', 'url']);
    assert.match(manifestEntry.url, /^i18n-quizzes-zh-[a-z0-9-]+-[0-9a-f]{12}\.json$/);
    assert.equal(manifestEntry.sourceSha256, sha256(fs.readFileSync(sourcePath)));
    const raw = generatedAssets.get(manifestEntry.url);
    assert.ok(raw, `manifest references missing ${manifestEntry.url}`);
    const generated = JSON.parse(raw);
    assert.equal(generated.schemaVersion, 1);
    assert.equal(generated.locale, 'zh');
    assert.ok(generated.quizByLesson[lessonPath], `${manifestEntry.url} missing ${lessonPath}`);
    const sourceQuiz = readJson(sourcePath);
    const translatedQuiz = generated.quizByLesson[lessonPath];
    assert.deepEqual(sortedKeys(translatedQuiz), sortedKeys(sourceQuiz), `${lessonPath} top-level metadata drift`);
    const sourceQuestions = canonicalQuizQuestions(sourceQuiz);
    const translatedQuestions = canonicalQuizQuestions(translatedQuiz);
    assert.equal(translatedQuestions.length, sourceQuestions.length);
    for (let index = 0; index < sourceQuestions.length; index += 1) {
      const sourceQuestion = sourceQuestions[index];
      const translatedQuestion = translatedQuestions[index];
      assert.deepEqual(sortedKeys(translatedQuestion), sortedKeys(sourceQuestion), `${lessonPath} question ${index} fields`);
      for (const field of Object.keys(sourceQuestion)) {
        if (['question', 'options', 'explanation'].includes(field)) continue;
        assert.deepEqual(translatedQuestion[field], sourceQuestion[field], `${lessonPath} question ${index}.${field} drift`);
      }
      assert.equal(translatedQuestion.options.length, sourceQuestion.options.length);
      assert.ok(translatedQuestion.question.trim());
      if (sourceQuestion.explanation) assert.ok(translatedQuestion.explanation.trim());
      else assert.equal(translatedQuestion.explanation, '');
    }
  }

  const serializedCore = { window: {} };
  vm.runInNewContext(generateI18nData().source, serializedCore);
  assert.ok(serializedCore.window.AIFS_I18N.zh.assets.search);
  assert.ok(serializedCore.window.AIFS_I18N.zh.assets.quizzes);
  assert.ok(!JSON.stringify(serializedCore.window.AIFS_I18N).includes('certifications/claude/'));
});

test('figure providers map to exactly one localized bundle', () => {
  const { discoverFigureProviderOrder } = require('./build.js');
  const expected = new Set(['lesson-figures.js', ...discoverFigureProviderOrder(SITE_DIR)]);
  // Certification content is intentionally English-only, including figures.
  expected.delete('figures-claude-certifications.js');
  const assignments = new Map();

  for (const pkg of loadZhPackages().filter(pkg => pkg.file.startsWith('figures-'))) {
    assert.ok(Array.isArray(pkg.data.providers), `${pkg.file} should declare its source providers`);
    for (const provider of pkg.data.providers) {
      assert.ok(expected.has(provider), `${pkg.file} declares unknown provider ${provider}`);
      const owners = assignments.get(provider) || [];
      owners.push(pkg.file);
      assignments.set(provider, owners);
    }
  }

  assert.deepEqual(
    [...expected].filter(provider => !assignments.has(provider)),
    [],
    'every figure provider should have a Simplified Chinese bundle'
  );
  for (const [provider, owners] of assignments) {
    assert.equal(owners.length, 1, `${provider} should belong to exactly one figure bundle`);
  }
});

test('few-shot curve current copy is covered by its provider-specific Chinese bundle', () => {
  const visible = new Set();
  let registered = null;
  let sliderControl = null;

  function captureText(value) {
    const normalized = String(value).trim();
    if (normalized) visible.add(normalized);
  }

  function captureHtml(value) {
    for (const part of String(value).split(/<[^>]+>/)) captureText(part);
  }

  function fakeNode() {
    const children = [];
    return {
      style: {},
      get firstChild() {
        return children[0] || null;
      },
      appendChild(child) {
        children.push(child);
        return child;
      },
      removeChild(child) {
        const index = children.indexOf(child);
        if (index >= 0) children.splice(index, 1);
        return child;
      },
      set textContent(value) {
        captureText(value);
      },
      set innerHTML(value) {
        captureHtml(value);
      },
    };
  }

  const LF = {
    el(_tag, _attrs, children = []) {
      const node = fakeNode();
      for (const child of children) {
        if (typeof child === 'string') captureText(child);
        node.appendChild(child);
      }
      return node;
    },
    svgEl() {
      return fakeNode();
    },
    slider(state, key, label, min, max) {
      captureText(label);
      sliderControl = { state, key, min, max };
      return fakeNode();
    },
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    register(figures) {
      registered = figures;
    },
  };

  vm.runInNewContext(
    readUtf8(path.join(SITE_DIR, 'figures-llmeng.js')),
    {
      window: { LF },
      document: {
        createTextNode(value) {
          captureText(value);
          return fakeNode();
        },
      },
    },
    { filename: 'site/figures-llmeng.js' }
  );

  assert.ok(registered && registered['few-shot-curve'], 'few-shot provider should register');
  registered['few-shot-curve'](fakeNode());
  assert.ok(sliderControl, 'few-shot curve should expose its example-count control');
  for (const value of [sliderControl.min, sliderControl.min + 1, sliderControl.max]) {
    sliderControl.state[sliderControl.key] = value;
    sliderControl.state._render();
  }

  const sourceStrings = [...visible].filter(value => /[A-Za-z]/.test(value)).sort();
  for (const expected of ['zero-shot', '1-shot', '16-shot', 'illustrative curve']) {
    assert.ok(sourceStrings.includes(expected), `few-shot capture should include ${expected}`);
  }

  const textNodes = sourceStrings.map(textNode);
  const figure = elementNode('div', textNodes, { 'data-figure': 'few-shot-curve' });
  bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          'figures-b': readJson(path.join(ZH_DIR, 'figures-b.json')),
        },
      },
    },
    pathname: '/lesson.html',
    search: '?path=phases/11-llm-engineering/02-few-shot-cot&lang=zh',
    figureProviders: { 'few-shot-curve': ['figures-llmeng.js'] },
    bodyChildren: [figure],
  });

  for (let index = 0; index < sourceStrings.length; index += 1) {
    assert.notEqual(
      textNodes[index].nodeValue,
      sourceStrings[index],
      `figures-b should translate few-shot provider text: ${sourceStrings[index]}`
    );
  }
});

test('runtime exposes its public API and maps catalog English text to Chinese', () => {
  const { payload, phases } = generateI18nData();
  const { api } = bootUiRuntime({
    payload,
    phases,
    pathname: '/catalog.html',
    search: '?lang=zh',
  });

  assert.ok(api, 'runtime should expose window.AIFS_I18n');
  assert.equal(typeof api.t, 'function');
  assert.equal(api.translate, api.t, 'translate should be the documented alias of t');
  assert.equal(typeof api.apply, 'function');
  assert.equal(typeof api.searchText, 'function');
  assert.equal(typeof api.catalogPhase, 'function');
  assert.equal(typeof api.catalogLesson, 'function');

  assert.equal(api.t('Setup & Tooling', 'zh'), '设置与工具');
  assert.equal(
    api.translate('Get your environment ready for everything that follows.', 'zh'),
    '为后续所有学习内容准备好开发环境。'
  );
  assert.equal(api.t('Dev Environment', 'zh'), '开发环境');
  assert.equal(api.t('Phase 00: Setup & Tooling', 'zh'), '第 00 阶段：设置与工具');
  assert.equal(api.catalogPhase(0, 'Setup & Tooling'), '第 00 阶段：设置与工具');
  assert.equal(api.catalogLesson(511), '511 节课程');
});

test('catalog lesson lookup accepts exact and trailing-slash keys', () => {
  const exactPath = 'phases/01-math-foundations/01-exact-key';
  const trailingPath = 'phases/01-math-foundations/02-trailing-key';
  const { api } = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          catalog: {
            lessons: {
              [exactPath]: '精确键课程',
              [`${exactPath}/`]: '不应覆盖精确键',
              [`${trailingPath}/`]: '尾斜杠课程',
            },
          },
        },
      },
    },
    phases: [{
      id: 1,
      name: 'Math Foundations',
      desc: '',
      lessons: [
        { name: 'Exact Key Lesson', url: `${exactPath}/` },
        { name: 'Trailing Key Lesson', url: trailingPath },
      ],
    }],
    pathname: '/catalog.html',
    search: '?lang=zh',
  });

  assert.equal(api.t('Exact Key Lesson', 'zh'), '精确键课程');
  assert.equal(api.t('Trailing Key Lesson', 'zh'), '尾斜杠课程');
});

test('locale search text keeps English source and current translations across language changes', () => {
  const runtime = bootUiRuntime({
    payload: { zh: { bundles: { 'catalog-glossary': { strings: {
      'Dev Environment': '开发环境',
      'Setup & Tooling': '设置与工具',
    } } } } },
    pathname: '/catalog.html',
  });

  assert.equal(runtime.api.searchText(['Dev Environment', 'Setup & Tooling']), 'Dev Environment Setup & Tooling');
  runtime.changeLanguage('zh');
  const localizedIndex = runtime.api.searchText(['Dev Environment', 'Setup & Tooling']);
  assert.ok(localizedIndex.includes('Dev Environment'));
  assert.ok(localizedIndex.includes('开发环境'));
  assert.ok(localizedIndex.includes('Setup & Tooling'));
  assert.ok(localizedIndex.includes('设置与工具'));
});

test('page-specific exact and pattern translations take priority over shared ones', () => {
  const payload = {
    zh: {
      bundles: {
        shared: {
          exact: { Status: '共享状态' },
          patterns: [
            { pattern: '^Items: (\\d+)$', replacement: '共享：$1' },
          ],
        },
        home: {
          exact: { Status: '首页状态' },
          patterns: [
            { pattern: '^Items: (\\d+)$', replacement: '首页：$1' },
          ],
        },
      },
    },
  };
  const { api } = bootUiRuntime({
    payload,
    pathname: '/index.html',
    search: '?lang=zh',
  });

  assert.equal(api.t('Status', 'zh'), '首页状态');
  assert.equal(api.t('Items: 12', 'zh'), '首页：12');

  const lessonRuntime = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          'figures-d': { exact: { Prompt: 'Prompt' } },
          lesson: { exact: { Prompt: '提示词' } },
        },
      },
    },
    pathname: '/lesson.html',
    search: '?path=phases/00-setup-and-tooling/01-dev-environment&lang=zh',
  });
  assert.equal(lessonRuntime.api.t('Prompt', 'zh'), '提示词');
});

test('lesson figures load only their provider-specific dictionary', () => {
  const figureText = textNode('agent');
  const figure = elementNode('div', [figureText], { 'data-figure': 'agent-loop' });
  const normalText = textNode('agent');
  const runtime = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          lesson: { exact: { agent: '课程智能体' } },
          'figures-c': { exact: { agent: '图示智能体' }, providers: ['figures-agents-alignment.js'] },
          'figures-d': { exact: { agent: '图示代理' }, providers: ['figures-mcp.js'] },
        },
      },
    },
    phases: [],
    pathname: '/lesson.html',
    search: '?path=phases/14-agent-engineering/01-the-agent-loop&lang=zh',
    bodyChildren: [elementNode('p', [normalText]), figure],
    figureProviders: { 'agent-loop': ['figures-agents-alignment.js'] },
  });

  assert.equal(normalText.nodeValue, '课程智能体');
  assert.equal(figureText.nodeValue, '图示智能体');
  assert.equal(runtime.api.t('agent', 'zh'), '课程智能体');
});

test('exact translations keep whitespace-sensitive figure fragments distinct', () => {
  const dynamicText = textNode('42 frames · 100 tokens');
  const figure = elementNode('div', [dynamicText], { 'data-figure': 'video-budget' });
  const plainText = textNode('42 frames · 100 tokens');
  const { api } = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          'figures-e': {
            providers: ['figures-multimodal.js'],
            exact: {
              frames: '帧数',
              ' frames': ' 帧',
              tokens: 'token',
              ' tokens': ' 个 token',
            },
          },
        },
      },
    },
    pathname: '/lesson.html',
    search: '?path=phases/00-setup-and-tooling/01-dev-environment&lang=zh',
    figureProviders: { 'video-budget': ['figures-multimodal.js'] },
    bodyChildren: [figure, elementNode('p', [plainText])],
  });

  assert.equal(dynamicText.nodeValue, '42 帧 · 100 个 token');
  assert.equal(plainText.nodeValue, '42 frames · 100 tokens');
});

test('split small figure labels use their provider-specific Chinese dictionary', () => {
  const { payload } = generateI18nData();
  const gibText = textNode('GiB');
  const lossText = textNode('loss');
  const gbText = textNode('GB');
  const trainableText = textNode('% trainable');
  const cacheFigure = elementNode(
    'div',
    [elementNode('small', [gibText])],
    { 'data-figure': 'kv-cache' }
  );
  const lossFigure = elementNode(
    'div',
    [elementNode('small', [lossText])],
    { 'data-figure': 'scaling-laws' }
  );
  const quantizationFigure = elementNode(
    'div',
    [elementNode('small', [gbText])],
    { 'data-figure': 'quantization' }
  );
  const trainableFigure = elementNode(
    'div',
    [elementNode('small', [trainableText])],
    { 'data-figure': 'lora-params' }
  );

  bootUiRuntime({
    payload,
    pathname: '/lesson.html',
    search: '?path=phases/05-training-optimization/01-example&lang=zh',
    figureProviders: {
      'kv-cache': ['lesson-figures.js'],
      'scaling-laws': ['lesson-figures.js'],
      quantization: ['lesson-figures.js'],
      'lora-params': ['lesson-figures.js'],
    },
    bodyChildren: [cacheFigure, lossFigure, quantizationFigure, trainableFigure],
  });

  assert.equal(gibText.nodeValue, 'GiB');
  assert.equal(lossText.nodeValue, '损失');
  assert.equal(gbText.nodeValue, 'GB');
  assert.equal(trainableText.nodeValue, '% 可训练');
});

test('language-change events translate normal DOM text reversibly and skip code tags', () => {
  const visibleText = textNode('Visible label');
  const visible = elementNode('span', [visibleText]);
  const button = elementNode('button', [], { 'aria-label': 'Button help' });
  const slider = elementNode('input', [], { 'aria-valuetext': 'Visible label' });
  const image = elementNode('img', [], { alt: 'Visible label' });
  const protectedNodes = ['code', 'pre', 'kbd', 'samp', 'textarea'].map((tagName) => {
    const text = textNode('Visible label');
    return { tagName, text, element: elementNode(tagName, [text]) };
  });
  const nestedProtectedText = textNode('Visible label');
  const nestedProtected = elementNode('pre', [elementNode('span', [nestedProtectedText])]);
  const optedOutText = textNode('Visible label');
  const optedOut = elementNode('section', [elementNode('span', [optedOutText])], { 'data-no-i18n': '' });
  const payload = {
    zh: {
      bundles: {
        shared: {
          exact: {
            'Visible label': '可见标签',
            'Button help': '按钮帮助',
          },
        },
      },
    },
  };
  const runtime = bootUiRuntime({
    payload,
    pathname: '/index.html',
    bodyChildren: [visible, button, slider, image, ...protectedNodes.map(item => item.element), nestedProtected, optedOut],
  });

  assert.equal(runtime.api.current, 'en');
  runtime.changeLanguage('zh');

  assert.equal(runtime.api.current, 'zh');
  assert.equal(runtime.document.documentElement.lang, 'zh');
  assert.equal(runtime.localStorage.getItem('lang'), 'zh');
  assert.equal(visibleText.nodeValue, '可见标签');
  assert.equal(button.getAttribute('aria-label'), '按钮帮助');
  assert.equal(slider.getAttribute('aria-valuetext'), '可见标签');
  assert.equal(image.getAttribute('alt'), '可见标签');
  for (const item of protectedNodes) {
    assert.equal(item.text.nodeValue, 'Visible label', `<${item.tagName}> text must remain unchanged`);
  }
  assert.equal(nestedProtectedText.nodeValue, 'Visible label');
  assert.equal(optedOutText.nodeValue, 'Visible label');

  runtime.changeLanguage('en');

  assert.equal(runtime.api.current, 'en');
  assert.equal(runtime.document.documentElement.lang, 'en');
  assert.equal(runtime.localStorage.getItem('lang'), null);
  assert.equal(visibleText.nodeValue, 'Visible label');
  assert.equal(button.getAttribute('aria-label'), 'Button help');
  assert.equal(slider.getAttribute('aria-valuetext'), 'Visible label');
  assert.equal(image.getAttribute('alt'), 'Visible label');
  for (const item of protectedNodes) {
    assert.equal(item.text.nodeValue, 'Visible label', `<${item.tagName}> text must remain unchanged`);
  }
});

test('scoped translation does not replace the document content language', () => {
  const fallbackText = textNode('Visible label');
  const fallback = elementNode('section', [fallbackText]);
  const runtime = bootUiRuntime({
    payload: { zh: { bundles: { shared: { exact: { 'Visible label': '可见标签' } } } } },
    pathname: '/lesson.html',
    bodyChildren: [fallback],
  });

  runtime.api.apply(fallback, 'zh');

  assert.equal(fallbackText.nodeValue, '可见标签');
  assert.equal(runtime.api.current, 'en');
  assert.equal(runtime.document.documentElement.lang, 'en');
});

test('MutationObserver translates dynamic text and attributes and preserves new originals for reversal', () => {
  let callback = null;
  let observed = null;
  class FakeMutationObserver {
    constructor(handler) { callback = handler; }
    observe(target, options) { observed = { target, options }; }
  }
  const existingText = textNode('Visible label');
  const existing = elementNode('span', [existingText], { title: 'Button help' });
  const runtime = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          shared: {
            exact: {
              'Visible label': '可见标签',
              'Button help': '按钮帮助',
              'Fresh status': '新状态',
              'Fresh help': '新帮助',
            },
          },
        },
      },
    },
    pathname: '/index.html',
    search: '?lang=zh',
    bodyChildren: [existing],
    MutationObserver: FakeMutationObserver,
  });

  assert.equal(typeof callback, 'function', 'runtime should construct a real observer callback');
  assert.equal(observed.target, runtime.document.documentElement);
  assert.equal(observed.options.subtree, true);
  assert.equal(observed.options.characterData, true);
  assert.equal(observed.options.attributes, true);
  assert.ok(observed.options.attributeFilter.includes('title'));

  const addedText = textNode('Visible label');
  const added = elementNode('button', [addedText], { title: 'Button help' });
  runtime.document.body.appendChild(added);
  callback([{ type: 'childList', addedNodes: [added] }]);
  assert.equal(addedText.nodeValue, '可见标签');
  assert.equal(added.getAttribute('title'), '按钮帮助');

  existingText.nodeValue = 'Fresh status';
  callback([{ type: 'characterData', target: existingText }]);
  assert.equal(existingText.nodeValue, '新状态');
  existing.setAttribute('title', 'Fresh help');
  callback([{ type: 'attributes', target: existing, attributeName: 'title' }]);
  assert.equal(existing.getAttribute('title'), '新帮助');

  runtime.changeLanguage('en');
  assert.equal(existingText.nodeValue, 'Fresh status');
  assert.equal(existing.getAttribute('title'), 'Fresh help');
  assert.equal(addedText.nodeValue, 'Visible label');
  assert.equal(added.getAttribute('title'), 'Button help');
});

test('the observer leaves an explicitly English fallback subtree untranslated', () => {
  let callback = null;
  class FakeMutationObserver {
    constructor(handler) { callback = handler; }
    observe() {}
  }
  const fallback = elementNode('section', [], { lang: 'en', 'data-no-i18n': '' });
  const runtime = bootUiRuntime({
    payload: { zh: { bundles: { shared: { exact: { 'Visible label': '可见标签' } } } } },
    pathname: '/lesson.html',
    search: '?lang=zh',
    bodyChildren: [fallback],
    MutationObserver: FakeMutationObserver,
  });
  const addedText = textNode('Visible label');
  const fallbackLink = elementNode('a', [addedText], {
    href: 'lesson?path=phases/00-setup-and-tooling/02-git-and-collaboration',
  });
  const added = elementNode('p', [fallbackLink]);
  fallback.appendChild(added);

  callback([{ type: 'childList', addedNodes: [added] }]);

  assert.equal(runtime.api.current, 'zh');
  assert.equal(runtime.document.documentElement.lang, 'zh');
  assert.equal(addedText.nodeValue, 'Visible label');
  assert.equal(
    fallbackLink.getAttribute('href'),
    'lesson?path=phases%2F00-setup-and-tooling%2F02-git-and-collaboration&lang=zh'
  );
});

test('registered lesson languages remain supported without a UI dictionary', () => {
  const spanishText = textNode('Visible label');
  const spanish = bootUiRuntime({
    payload: { zh: { bundles: { shared: { exact: { 'Visible label': '可见标签' } } } } },
    languages: [{ code: 'en' }, { code: 'zh' }, { code: 'es' }, { code: 'ar' }],
    pathname: '/lesson.html',
    search: '?path=phases/00-setup-and-tooling/01-dev-environment&lang=es',
    bodyChildren: [elementNode('span', [spanishText])],
  });

  assert.equal(spanish.api.current, 'es');
  assert.equal(spanish.document.documentElement.lang, 'es');
  assert.equal(spanish.document.documentElement.dir, 'ltr');
  assert.equal(spanishText.nodeValue, 'Visible label');

  spanish.changeLanguage('ar');
  assert.equal(spanish.api.current, 'ar');
  assert.equal(spanish.document.documentElement.lang, 'ar');
  assert.equal(spanish.document.documentElement.dir, 'rtl');
  assert.equal(spanishText.nodeValue, 'Visible label');
});

test('an invalid language query falls back to a valid saved language', () => {
  const visibleText = textNode('Visible label');
  const runtime = bootUiRuntime({
    payload: { zh: { bundles: { shared: { exact: { 'Visible label': '可见标签' } } } } },
    pathname: '/index.html',
    search: '?lang=bogus',
    storage: { lang: 'zh' },
    bodyChildren: [elementNode('span', [visibleText])],
  });

  assert.equal(runtime.api.current, 'zh');
  assert.equal(runtime.document.documentElement.lang, 'zh');
  assert.equal(visibleText.nodeValue, '可见标签');
});

test('language picker treats an explicit English query as authoritative', () => {
  const source = readUtf8(LANGUAGE_PICKER_PATH);
  assert.match(
    source,
    /function supported\(code\) \{[\s\S]*?LANGS\.some/,
    'the picker should validate English through the same language registry as other locales'
  );
  assert.doesNotMatch(
    source,
    /code !== ['"]en['"]/,
    'the picker must not reject an explicit ?lang=en before checking saved preferences'
  );
});

test('extensionless public routes select the same page bundles as html routes', () => {
  const { payload, phases } = generateI18nData();
  const catalog = bootUiRuntime({
    payload,
    phases,
    pathname: '/catalog',
    search: '?lang=zh',
  });
  const glossary = bootUiRuntime({
    payload,
    phases,
    pathname: '/glossary',
    search: '?lang=zh',
  });
  const roadmap = bootUiRuntime({
    payload,
    phases,
    pathname: '/roadmap',
    search: '?lang=zh',
  });
  const lesson = bootUiRuntime({
    payload,
    phases,
    pathname: '/lesson',
    search: '?path=phases/14-agent-engineering/01-the-agent-loop&lang=zh',
  });

  assert.equal(catalog.api.t('Lesson Catalog', 'zh'), '课程目录');
  assert.equal(glossary.api.t('Working definition', 'zh'), '工作定义');
  assert.equal(roadmap.api.t('Route inspector', 'zh'), '路径查看器');
  assert.equal(lesson.api.t('Prompt', 'zh'), '提示词');
});

test('internal navigation preserves the active locale and keeps certification routes English-only', () => {
  const nextLesson = elementNode('a', [], {
    href: 'lesson?path=phases/01-math-foundations/02-vectors-matrices-operations&learningPath=foundations',
  });
  const paletteLesson = elementNode('li', [], {
    'data-href': 'lesson?path=phases/02-ml-fundamentals/01-what-is-machine-learning',
  });
  const catalog = elementNode('a', [], { href: 'catalog.html#phase-01' });
  const certification = elementNode('a', [], {
    href: 'lesson?path=certifications%2Fclaude%2Flessons%2F01-example',
  });
  const trackedCourseLesson = elementNode('a', [], {
    href: 'lesson?path=phases%2F14-agent-engineering%2F01-the-agent-loop&track=claude-architect&lang=zh',
  });
  const supplementalCourseLesson = elementNode('a', [], {
    href: 'lesson?path=phases%2F14-agent-engineering%2F02-agent-components&fromTrack=claude-architect&lang=zh',
  });
  const certificationCatalog = elementNode('a', [], {
    href: 'certification?id=claude-architect&lang=zh',
  });
  const assessment = elementNode('a', [], {
    href: 'assessment?track=claude-architect&lang=zh',
  });
  const fallbackText = textNode('Visible label');
  const fallbackLesson = elementNode('a', [fallbackText], {
    href: 'lesson?path=phases/01-math-foundations/03-matrix-transformations',
  });
  const fallbackContainer = elementNode('section', [fallbackLesson], { 'data-no-i18n': '' });
  const runtime = bootUiRuntime({
    payload: { zh: { bundles: { shared: {} } } },
    pathname: '/lesson',
    search: '?path=phases/01-math-foundations/01-linear-algebra-intuition&lang=zh',
    bodyChildren: [
      nextLesson,
      paletteLesson,
      catalog,
      certification,
      trackedCourseLesson,
      supplementalCourseLesson,
      certificationCatalog,
      assessment,
      fallbackContainer,
    ],
  });

  assert.equal(nextLesson.getAttribute('href'), 'lesson?path=phases%2F01-math-foundations%2F02-vectors-matrices-operations&learningPath=foundations&lang=zh');
  assert.equal(paletteLesson.getAttribute('data-href'), 'lesson?path=phases%2F02-ml-fundamentals%2F01-what-is-machine-learning&lang=zh');
  assert.equal(catalog.getAttribute('href'), 'catalog.html?lang=zh#phase-01');
  assert.equal(certification.getAttribute('href'), 'lesson?path=certifications%2Fclaude%2Flessons%2F01-example');
  assert.equal(trackedCourseLesson.getAttribute('href'), 'lesson?path=phases%2F14-agent-engineering%2F01-the-agent-loop&track=claude-architect');
  assert.equal(supplementalCourseLesson.getAttribute('href'), 'lesson?path=phases%2F14-agent-engineering%2F02-agent-components&fromTrack=claude-architect');
  assert.equal(certificationCatalog.getAttribute('href'), 'certification?id=claude-architect');
  assert.equal(assessment.getAttribute('href'), 'assessment?track=claude-architect');
  assert.equal(fallbackLesson.getAttribute('href'), 'lesson?path=phases%2F01-math-foundations%2F03-matrix-transformations&lang=zh');
  assert.equal(fallbackText.nodeValue, 'Visible label');

  runtime.changeLanguage('en');
  assert.equal(nextLesson.getAttribute('href'), 'lesson?path=phases%2F01-math-foundations%2F02-vectors-matrices-operations&learningPath=foundations');
  assert.equal(paletteLesson.getAttribute('data-href'), 'lesson?path=phases%2F02-ml-fundamentals%2F01-what-is-machine-learning');
  assert.equal(catalog.getAttribute('href'), 'catalog.html#phase-01');
  assert.equal(fallbackLesson.getAttribute('href'), 'lesson?path=phases%2F01-math-foundations%2F03-matrix-transformations');
});

test('pattern matching is bounded for long dynamic text', () => {
  const { api } = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          shared: { patterns: [{ pattern: '^query \"(.+)\"  →  (.+)$', replacement: '查询“$1” → $2' }] },
        },
      },
    },
    pathname: '/index.html',
    search: '?lang=zh',
  });
  const longValue = 'query "' + 'a"  →  '.repeat(600) + 'tail';
  assert.equal(api.t(longValue, 'zh'), longValue);
});

test('runtime supports template and named-capture patterns through the public translate API', () => {
  const { payload, phases } = generateI18nData();
  const catalogRuntime = bootUiRuntime({
    payload,
    phases,
    pathname: '/catalog.html',
    search: '?lang=zh',
  });
  assert.equal(
    catalogRuntime.api.t('Showing 12 of 30 matching lessons. 511 total.', 'zh'),
    '显示 12 / 30 节匹配课程，共 511 节。'
  );
  const homeRuntime = bootUiRuntime({
    payload,
    phases,
    pathname: '/index.html',
    search: '?lang=zh',
  });
  assert.equal(
    homeRuntime.api.t(
      'Core curriculum · {corePhases} phases · {coreLessons} lessons',
      { corePhases: 21, coreLessons: 512 },
      'zh'
    ),
    '核心课程 · 21 个阶段 · 512 节课'
  );
  assert.equal(
    homeRuntime.api.t(
      '{publishedLessons} published lessons. {corePhases} core phases. {guidedRoutes} guided routes.',
      { publishedLessons: 545, corePhases: 21, guidedRoutes: 7 },
      'zh'
    ),
    '已发布 545 节课程。21 个核心阶段。7 条专题与认证路线。'
  );

  const namedCaptureRuntime = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          shared: {
            patterns: [
              {
                pattern: '^Route (?<route>[A-Z]+) unlocks (?<count>\\d+) lessons$',
                replacement: '路线 {route} 解锁 {count} 节课',
              },
            ],
          },
        },
      },
    },
    pathname: '/prereqs.html',
    search: '?lang=zh',
  });
  assert.equal(
    namedCaptureRuntime.api.t('Route NLP unlocks 14 lessons', 'zh'),
    '路线 NLP 解锁 14 节课'
  );

  const roadmapRuntime = bootUiRuntime({
    payload,
    phases,
    pathname: '/prereqs.html',
    search: '?lang=zh',
  });
  assert.equal(roadmapRuntime.api.t('PHASE 00', 'zh'), '阶段 00');
  assert.equal(
    roadmapRuntime.api.t(
      'Phase {phase} selected. {ancestors} prerequisite phases and {descendants} downstream phases highlighted.',
      { phase: '14', ancestors: 3, descendants: 5 },
      'zh'
    ),
    '已选择阶段 14。已高亮 3 个前置阶段和 5 个后续阶段。'
  );
  assert.equal(
    roadmapRuntime.api.t(
      'Phase {phase}: {name}.',
      { phase: '14', name: '智能体工程' },
      'zh'
    ),
    '阶段 14：智能体工程。'
  );
  assert.equal(
    roadmapRuntime.api.t('Phase 14 selected. 3 prerequisite phases and 5 downstream phases highlighted.', 'zh'),
    '已选择阶段 14。已高亮 3 个前置阶段和 5 个后续阶段。'
  );
  assert.equal(
    roadmapRuntime.api.t('Phase 00 · Setup & Tooling', 'zh'),
    '阶段 00 · 设置与工具'
  );
});

test('TTS templates translate before injecting runtime values and retain regex compatibility', () => {
  const payload = {
    zh: {
      bundles: {
        shared: readJson(path.join(ZH_DIR, 'shared.json')),
      },
    },
  };
  const runtime = bootUiRuntime({ payload, pathname: '/index.html', search: '?lang=zh' });

  assert.equal(runtime.api.t('Auto — {name}', { name: 'Ava' }, 'zh'), '自动 — Ava');
  assert.equal(
    runtime.api.t('Switched to {name} — the previous voice kept cutting out', { name: 'Ava' }, 'zh'),
    '已切换到 Ava，之前的声音持续断断续续'
  );
  assert.equal(
    runtime.api.t(
      '{state} · {section} · {current}/{total} · {minutes} min left',
      { state: '朗读中', section: '页面', current: 2, total: 9, minutes: 4 },
      'zh'
    ),
    '朗读中 · 页面 · 2/9 · 剩余 4 分钟'
  );
  assert.equal(runtime.api.t('Auto — Ava', 'zh'), '自动 — Ava');
});

test('lesson runtime translates representative dynamic reader strings', () => {
  const { payload, phases } = generateI18nData();
  const runtime = bootUiRuntime({
    payload,
    phases,
    pathname: '/lesson.html',
    search: '?path=phases/13-tools-and-protocols/06-mcp-fundamentals&lang=zh',
  });
  const examples = new Map([
    ['Lesson 3 of 17', '第 3 / 17 课'],
    ['Path 1395 min', '路径 1395 分钟'],
    ['Group core', '分组 core'],
    ['4 of 5 checkpoints · Quiz passed', '4 / 5 个检查点 · 测验已通过'],
    ['Complete this lesson: MCP Fundamentals.', '完成本课：MCP Fundamentals。'],
    ['Knowledge preflight: Tool poisoning.', '知识预检：Tool poisoning。'],
    ['Optional capstone: Tool Ecosystem', '可选结课项目：Tool Ecosystem'],
    ['Browse all Phase 13 lessons', '浏览第 13 阶段的全部课程'],
  ]);
  for (const [source, expected] of examples) assert.equal(runtime.api.t(source, 'zh'), expected, source);
  assert.equal(runtime.api.t('{count} earlier', { count: 3 }, 'zh'), '前面还有 3 节');
  assert.equal(runtime.api.t('{count} later lessons', { count: 4 }, 'zh'), '后面还有 4 节课程');
  assert.equal(
    runtime.api.t('Ready for Phase {number}: {name}', { number: 14, name: '智能体工程' }, 'zh'),
    '已准备好进入阶段 14：智能体工程'
  );
  assert.equal(
    runtime.api.t(
      'Optional lesson. {done} of {total} required lessons completed.',
      { done: 2, total: 5 },
      'zh'
    ),
    '可选课程。已完成 2 / 5 节必修课程。'
  );
  assert.equal(
    runtime.api.t(
      '{done} of {total} knowledge preflights confirmed.',
      { done: 1, total: 3 },
      'zh'
    ),
    '1 / 3 项知识预检已确认。'
  );
  assert.equal(
    runtime.api.t(
      'Want a deeper quiz? In Codex use {codexCommand} or choose it from {skillsCommand}. In Claude Code use {claudeCommand}. In another compatible host say: {portableCommand}',
      {
        codexCommand: 'check-understanding 13',
        skillsCommand: '/skills',
        claudeCommand: '/check-understanding 13',
        portableCommand: 'Use check-understanding to quiz me on Phase 13.',
      },
      'zh'
    ),
    '想做更深入的测验？在 Codex 中使用 check-understanding 13，或从 /skills 中选择。在 Claude Code 中使用 /check-understanding 13。在其他兼容宿主中可以这样说：Use check-understanding to quiz me on Phase 13.'
  );
});

test('learning paths page visible copy has explicit Simplified Chinese coverage', () => {
  const html = readUtf8(path.join(SITE_DIR, 'learning-paths.html'));
  const body = (html.match(/<body[\s\S]*<\/body>/i) || [''])[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const visible = [
    ...Array.from(body.matchAll(/>([^<]+)</g), match => match[1]),
    ...Array.from(
      body.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g),
      match => match[1]
    ),
    'Learning Paths',
    'Switch to dark theme',
    'Switch to light theme',
  ].map(value => value.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
    .filter(value => /[A-Za-z]/.test(value) && value !== 'AI / FROM SCRATCH' && value !== 'N');
  const strings = exactStringsFromPackages(loadZhPackages());

  for (const source of new Set(visible)) {
    assert.ok(strings.has(source), `missing learning-paths.html zh mapping: ${source}`);
    assert.ok(strings.get(source).trim(), `empty learning-paths.html zh mapping: ${source}`);
  }
});

test('learning paths page translates static and dynamic copy and restores English', () => {
  let callback = null;
  class FakeMutationObserver {
    constructor(handler) { callback = handler; }
    observe() {}
  }
  const heading = textNode('AI Engineering Learning Paths');
  const pathTitle = textNode('Building and Deploying AI Applications');
  const themeButton = elementNode('button', [], { 'aria-label': 'Toggle theme' });
  const lessonLink = elementNode('a', [pathTitle], {
    href: 'lesson?path=phases/11-llm-engineering/01-prompt-engineering&learningPath=building-and-deploying-ai-applications',
  });
  const runtime = bootUiRuntime({
    payload: generateI18nData().payload,
    pathname: '/learning-paths.html',
    search: '?lang=zh',
    bodyChildren: [elementNode('h1', [heading]), lessonLink, themeButton],
    MutationObserver: FakeMutationObserver,
  });

  assert.equal(runtime.api.current, 'zh');
  assert.equal(heading.nodeValue, 'AI 工程学习路径');
  assert.equal(pathTitle.nodeValue, '构建与部署 AI 应用');
  assert.equal(themeButton.getAttribute('aria-label'), '切换主题');
  assert.match(lessonLink.getAttribute('href'), /[?&]lang=zh(?:&|$)/);

  const dynamicNavText = textNode('Learning Paths');
  const dynamicNavLink = elementNode('a', [dynamicNavText], { href: 'learning-paths.html' });
  runtime.document.body.appendChild(dynamicNavLink);
  callback([{ type: 'childList', addedNodes: [dynamicNavLink] }]);
  assert.equal(dynamicNavText.nodeValue, '学习路径');
  assert.equal(dynamicNavLink.getAttribute('href'), 'learning-paths.html?lang=zh');

  themeButton.setAttribute('aria-label', 'Switch to dark theme');
  callback([{ type: 'attributes', target: themeButton, attributeName: 'aria-label' }]);
  assert.equal(themeButton.getAttribute('aria-label'), '切换到深色主题');

  runtime.changeLanguage('en');
  assert.equal(heading.nodeValue, 'AI Engineering Learning Paths');
  assert.equal(pathTitle.nodeValue, 'Building and Deploying AI Applications');
  assert.equal(dynamicNavText.nodeValue, 'Learning Paths');
  assert.equal(themeButton.getAttribute('aria-label'), 'Switch to dark theme');
  assert.doesNotMatch(lessonLink.getAttribute('href'), /[?&]lang=/);

  runtime.changeLanguage('zh');
  assert.equal(heading.nodeValue, 'AI 工程学习路径');
  assert.equal(pathTitle.nodeValue, '构建与部署 AI 应用');
  assert.equal(dynamicNavText.nodeValue, '学习路径');
  assert.equal(themeButton.getAttribute('aria-label'), '切换到深色主题');
});

test('homepage switches localized learning-path assets and restores English', () => {
  const desktop = elementNode('img', [], {
    src: 'assets/figures/006-ai-engineering-learning-paths.svg',
    'data-i18n-src-zh': 'assets/figures/006-ai-engineering-learning-paths.zh-CN.svg',
    alt: 'AI Engineering connects building and deploying AI applications, software engineering fundamentals, agent-assisted engineering, and product judgment and delivery.',
  });
  const mobile = elementNode('source', [], {
    srcset: 'assets/figures/006-ai-engineering-learning-paths-mobile.svg',
    'data-i18n-srcset-zh': 'assets/figures/006-ai-engineering-learning-paths-mobile.zh-CN.svg',
  });
  const runtime = bootUiRuntime({
    payload: generateI18nData().payload,
    pathname: '/index.html',
    search: '?lang=zh',
    bodyChildren: [elementNode('picture', [mobile, desktop])],
  });

  assert.equal(desktop.getAttribute('src'), 'assets/figures/006-ai-engineering-learning-paths.zh-CN.svg');
  assert.equal(mobile.getAttribute('srcset'), 'assets/figures/006-ai-engineering-learning-paths-mobile.zh-CN.svg');
  assert.equal(
    desktop.getAttribute('alt'),
    'AI 工程连接四条核心学习路径：构建与部署 AI 应用、软件工程基础、智能体辅助工程，以及产品判断与交付。'
  );

  runtime.changeLanguage('en');
  assert.equal(desktop.getAttribute('src'), 'assets/figures/006-ai-engineering-learning-paths.svg');
  assert.equal(mobile.getAttribute('srcset'), 'assets/figures/006-ai-engineering-learning-paths-mobile.svg');
  assert.equal(
    desktop.getAttribute('alt'),
    'AI Engineering connects building and deploying AI applications, software engineering fundamentals, agent-assisted engineering, and product judgment and delivery.'
  );

  runtime.changeLanguage('zh');
  assert.equal(desktop.getAttribute('src'), 'assets/figures/006-ai-engineering-learning-paths.zh-CN.svg');
  assert.equal(mobile.getAttribute('srcset'), 'assets/figures/006-ai-engineering-learning-paths-mobile.zh-CN.svg');
});

test('localized learning-path SVGs are accessible and contain Chinese labels', () => {
  for (const filename of [
    '006-ai-engineering-learning-paths.zh-CN.svg',
    '006-ai-engineering-learning-paths-mobile.zh-CN.svg',
  ]) {
    const svg = readUtf8(path.join(SITE_DIR, 'assets', 'figures', filename));
    assert.match(svg, /<svg[^>]+role="img"[^>]+aria-labelledby="title desc"[^>]+lang="zh-CN"/);
    assert.match(svg, /<title id="title">AI 工程学习路径<\/title>/);
    for (const label of ['构建与部署', '软件工程', '智能体辅助', '产品判断']) {
      assert.ok(svg.includes(label), `${filename} should include ${label}`);
    }
  }
});

test('public curriculum pages load generated data, runtime, and picker in dependency order', () => {
  const pickerSource = readUtf8(LANGUAGE_PICKER_PATH);
  const runtimeSource = readUtf8(UI_RUNTIME_PATH);
  const pickerEvent = pickerSource.match(/new CustomEvent\(['"]([^'"]+)['"]/);
  const runtimeEvent = runtimeSource.match(/LANGUAGE_EVENT\s*=\s*['"]([^'"]+)['"]/);

  assert.ok(pickerEvent, 'language picker should dispatch a language-change event');
  assert.ok(runtimeEvent, 'ui runtime should register a language-change event');
  assert.equal(pickerEvent[1], 'aifs:language-change');
  assert.equal(pickerEvent[1], runtimeEvent[1], 'picker and runtime must use the same event name');

  for (const file of PUBLIC_HTML_PAGES) {
    const html = readUtf8(path.join(SITE_DIR, file));
    const langsIndex = html.indexOf('langs.js');
    const dataIndex = html.indexOf('i18n-data.js');
    const runtimeIndex = html.indexOf('ui-i18n.js');
    const pickerIndex = html.indexOf('lang-picker.js');

    assert.ok(html.includes('id="langPicker"'), `${file} should include the language-picker host`);
    assert.ok(langsIndex >= 0, `${file} should load langs.js`);
    assert.ok(dataIndex > langsIndex, `${file} should load i18n-data.js after langs.js`);
    assert.ok(runtimeIndex > dataIndex, `${file} should load ui-i18n.js after its data`);
    assert.ok(pickerIndex > runtimeIndex, `${file} should load lang-picker.js after the runtime`);
    if (file === 'learning-paths.html') {
      const curriculumIndex = html.search(/src=["']data\.js(?:\?v=[^"']*)?["']/);
      const paletteIndex = html.search(/src=["']cmdpalette\.js(?:\?v=[^"']*)?["']/);
      assert.ok(curriculumIndex > pickerIndex, 'learning-paths.html should load the search index');
      assert.ok(paletteIndex > curriculumIndex, 'learning-paths.html should initialize search after data.js');
    }
    if (file === 'lesson.html') {
      const figureIndex = html.indexOf('i18n-figures.js');
      assert.ok(figureIndex > dataIndex && figureIndex < runtimeIndex, 'lesson.html should load figure translations before the runtime');
    } else {
      assert.ok(!html.includes('i18n-figures.js'), `${file} should not load figure translations`);
    }
    if (file === 'glossary.html') {
      const glossaryIndex = html.indexOf('i18n-glossary.js');
      assert.ok(glossaryIndex > dataIndex && glossaryIndex < runtimeIndex, 'glossary.html should load glossary translations before the runtime');
    } else {
      assert.ok(!html.includes('i18n-glossary.js'), `${file} should not load glossary translations`);
    }
  }
});

test('public pages pin i18n assets to their current content hashes', () => {
  const coreAssets = ['langs.js', 'i18n-data.js', 'ui-i18n.js', 'lang-picker.js'];
  const hash = asset => crypto.createHash('sha256')
    .update(readUtf8(path.join(SITE_DIR, asset)))
    .digest('hex')
    .slice(0, 12);

  for (const file of PUBLIC_HTML_PAGES) {
    const html = readUtf8(path.join(SITE_DIR, file));
    for (const asset of coreAssets) {
      assert.ok(
        html.includes(`${asset}?v=${hash(asset)}`),
        `${file} should pin ${asset} to its content hash`
      );
    }
  }

  const lessonHtml = readUtf8(path.join(SITE_DIR, 'lesson.html'));
  const glossaryHtml = readUtf8(path.join(SITE_DIR, 'glossary.html'));
  assert.ok(lessonHtml.includes(`i18n-figures.js?v=${hash('i18n-figures.js')}`));
  assert.ok(glossaryHtml.includes(`i18n-glossary.js?v=${hash('i18n-glossary.js')}`));
});

test('pages that load content-source pin it to its current content hash', () => {
  const hash = crypto.createHash('sha256')
    .update(readUtf8(path.join(SITE_DIR, 'content-source.js')))
    .digest('hex')
    .slice(0, 12);
  for (const file of ['lesson.html', 'assessment.html']) {
    assert.ok(
      readUtf8(path.join(SITE_DIR, file)).includes(`content-source.js?v=${hash}`),
      `${file} should pin content-source.js to its content hash`
    );
  }
});

test('nested GitHub Pages 404 routes resolve assets from the project root', () => {
  const html = readUtf8(path.join(SITE_DIR, '404.html'));
  const headEnd = html.indexOf('</head>');
  const baseScript = html.indexOf("document.createElement('base')");
  const stylesheet = html.indexOf('href="style.css');

  assert.ok(baseScript >= 0 && baseScript < stylesheet && stylesheet < headEnd);
  assert.ok(html.includes('/\\.github\\.io$/i'));
  assert.ok(html.includes("pathname.split('/').filter(Boolean)[0]"));
  assert.ok(html.includes("siteRoot = isProjectPages && firstSegment ? '/' + firstSegment + '/' : '/'"));
  assert.match(html, /document\.head\.appendChild\(base\)/);
  assert.match(html, /data-i18n-page=["']404\.html["']/, '404 template needs an explicit page marker');

  const nestedUrl = new URL('/ai-engineering-from-scratch/missing/deep/path', 'https://example.github.io');
  const firstSegment = nestedUrl.pathname.split('/').filter(Boolean)[0];
  const siteRoot = `/${firstSegment}/`;
  assert.equal(
    new URL('i18n-data.js', new URL(siteRoot, nestedUrl)).pathname,
    '/ai-engineering-from-scratch/i18n-data.js'
  );
});

test('nested 404 page marker selects the pages bundle and reverses its visible copy', () => {
  const heading = textNode('Page not found');
  const explanation = textNode('This path does not exist.');
  const runtime = bootUiRuntime({
    payload: generateI18nData().payload,
    pathname: '/ai-engineering-from-scratch/missing/deep/path',
    search: '?lang=zh',
    pageMarker: '404.html',
    bodyChildren: [elementNode('h1', [heading]), elementNode('p', [explanation])],
  });
  assert.equal(heading.nodeValue, '页面不存在');
  assert.equal(explanation.nodeValue, '这个路径不存在。');
  runtime.changeLanguage('en');
  assert.equal(heading.nodeValue, 'Page not found');
  assert.equal(explanation.nodeValue, 'This path does not exist.');
});

test('certification pages and certification lesson routes remain English-only', () => {
  for (const file of CERTIFICATION_HTML_PAGES) {
    const html = readUtf8(path.join(SITE_DIR, file));
    assert.ok(!html.includes('id="langPicker"'), `${file} should not render a language picker`);
    assert.ok(!html.includes('lang-picker.js'), `${file} should not load lang-picker.js`);
    assert.ok(!html.includes('ui-i18n.js'), `${file} should not load the UI translation runtime`);
  }

  const protectedText = textNode('Visible label');
  const runtime = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          shared: { exact: { 'Visible label': '可见标签' } },
        },
      },
    },
    pathname: '/lesson.html',
    search: '?path=certifications/claude/lessons/01-example&lang=zh',
    bodyChildren: [elementNode('span', [protectedText])],
  });

  assert.equal(runtime.api.current, 'en');
  assert.equal(runtime.document.documentElement.lang, 'en');
  assert.equal(protectedText.nodeValue, 'Visible label');

  runtime.changeLanguage('zh');
  assert.equal(runtime.api.current, 'en');
  assert.equal(protectedText.nodeValue, 'Visible label');

  const extensionlessText = textNode('Visible label');
  const extensionlessRuntime = bootUiRuntime({
    payload: {
      zh: {
        bundles: {
          shared: { exact: { 'Visible label': '可见标签' } },
        },
      },
    },
    pathname: '/lesson',
    search: '?path=certifications/claude/lessons/01-example&lang=zh',
    bodyChildren: [elementNode('span', [extensionlessText])],
  });
  assert.equal(extensionlessRuntime.api.current, 'en');
  assert.equal(extensionlessRuntime.document.documentElement.lang, 'en');
  assert.equal(extensionlessText.nodeValue, 'Visible label');

  const pickerSource = readUtf8(LANGUAGE_PICKER_PATH);
  assert.match(pickerSource, /certifications\/claude\/lessons\//);
  assert.match(pickerSource, /host\.hidden\s*=\s*true/);
});
