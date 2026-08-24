#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
  FIGURE_PROVIDER_ORDER,
  buildFigureProviderManifest,
  discoverFigureProviderOrder,
  discoverUsedFigureIds,
  discoverArtifacts,
  parseLearningPaths,
  parseReadme,
  parseRoadmap,
  serializeFigureProviderManifest,
} = require('./build.js');
const {
  learningPathDestination,
  rebuildIndex,
  resultIndexForEnter,
  search,
} = require('./cmdpalette.js');

function loadContentSource() {
  const context = {
    URL,
    window: {
      location: {
        hostname: 'localhost',
        href: 'http://localhost/site/lesson.html',
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'content-source.js'), 'utf8'),
    context
  );
  return context.window.AIFSContentSource;
}

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

test('shared site asset families use the expected cache keys on every page', () => {
  const release = '20260822a';
  const navigationRelease = '20260823b';
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
  const sourceFor = page => fs.readFileSync(path.join(__dirname, page), 'utf8');
  const versionFor = (source, asset) => {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escaped}\\?v=([a-z0-9.-]+)`, 'i'));
    assert.ok(match, `${asset} is missing a cache key`);
    return match[1];
  };

  for (const page of pages) {
    const source = sourceFor(page);
    assert.equal(versionFor(source, 'style.css'), navigationRelease, `${page} has stale style.css`);
    assert.equal(versionFor(source, 'progress.js'), release, `${page} has stale progress.js`);
    assert.equal(versionFor(source, 'header.js'), navigationRelease, `${page} has stale header.js`);
  }

  assert.equal(versionFor(sourceFor('index.html'), 'app.js'), release);
  assert.equal(versionFor(sourceFor('prereqs.html'), 'roadmap.css'), release);
  assert.equal(versionFor(sourceFor('prereqs.html'), 'roadmap.js'), release);
  assert.match(
    fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8'),
    new RegExp(`NARRATION_VERSION = '${release}'`)
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

test('homepage routes loop, graph, and harness engineering to real lessons', () => {
  const root = path.resolve(__dirname, '..');
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const routes = [
    ['Loop engineering', 'phases/14-agent-engineering/01-the-agent-loop'],
    ['Graph engineering', 'phases/14-agent-engineering/13-langgraph-stateful-graphs'],
    ['Harness engineering', 'phases/14-agent-engineering/31-agent-workbench-why-models-fail'],
  ];

  for (const [label, lessonPath] of routes) {
    assert.ok(fs.existsSync(path.join(root, lessonPath, 'docs', 'en.md')), `${label} lesson docs are missing`);
    assert.ok(fs.existsSync(path.join(root, lessonPath, 'code')), `${label} lesson code is missing`);
    assert.match(homepage, new RegExp(`>${label}<`, 'i'));
    assert.match(homepage, new RegExp(`lesson\\.html\\?path=${lessonPath}`));
    assert.match(homepage, new RegExp(`github\\.com/rohitg00/ai-engineering-from-scratch/tree/main/${lessonPath}`));
  }

  assert.equal((homepage.match(/lesson\.html\?path=phases\/14-agent-engineering\/01-the-agent-loop/g) || []).length, 1);
  assert.match(homepage, /Build agent state-graph orchestration/);
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
  assert.match(mastheadCta[0], /<span>Choose Your Goal<\/span>/);
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
  assert.match(homepage, /clone = half\.cloneNode\(true\);[\s\S]*?clone\.setAttribute\('aria-hidden', 'true'\);[\s\S]*?track\.appendChild\(clone\)/);
  assert.match(homepage, /marquee\.classList\.add\('is-ready'\)/);

  assert.match(learnerStyles[0], /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.marquee\s*\{[\s\S]*?overflow-x: auto/);
  assert.match(learnerStyles[0], /\.marquee\.is-ready \.marquee-track\s*\{[\s\S]*?animation: none;[\s\S]*?transform: none/);
  assert.match(learnerStyles[0], /\.marquee-track > \[aria-hidden="true"\]\s*\{\s*display: none/);
  assert.match(homepage, /if \(reducedMotion\.matches \|\| !half\.offsetWidth\) return/);
  assert.match(homepage, /reducedMotion\.addEventListener\('change', buildAll\)/);
});

test('shared header progressively compacts without hiding GitHub stars or search', () => {
  const headerSource = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const movableTools = headerSource.match(/function isMovableTool\(child\) \{([\s\S]*?)\n    \}/);

  assert.match(headerSource, /var COMPACT_HEADER_QUERY = '\(max-width: 1240px\)'/);
  assert.match(headerSource, /var NARROW_HEADER_QUERY = '\(max-width: 820px\)'/);
  assert.match(headerSource, /priorityNav\.className = 'header-priority-nav'/);
  assert.match(headerSource, /label !== 'contents' && label !== 'catalog'/);
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
  assert.match(styles, /@media \(max-width: 1320px\) and \(min-width: 1241px\)/);
  assert.match(styles, /@media \(max-width: 1240px\) \{[\s\S]*?\.header-priority-nav\s*\{[\s\S]*?\.header-inner > \.header-github[\s\S]*?\.header-inner > \.search-toggle[\s\S]*?\.header-nav\s*\{[\s\S]*?width: min\(360px, calc\(100vw - 32px\)\);[\s\S]*?overflow-y: auto;/);
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

  assert.match(roadmapSource, /group\.addEventListener\('keydown'[\s\S]*?togglePhaseSelection\(phase\.id, \{ animate: false \}\)/);
  assert.match(roadmapSource, /jump\.addEventListener\('change'[\s\S]*?selectPhase\(id, \{ updateHistory: true, animate: false \}\)/);
  assert.match(roadmapSource, /event\.key === 'Escape'[\s\S]*?clearSelection\(true, \{ animate: false \}\)/);
  assert.match(roadmapSource, /var keyboardTriggered = event\.detail === 0;[\s\S]*?animate: !keyboardTriggered/);
});

test('learning path query and Enter fallback open the first result predictably', () => {
  assert.equal(
    learningPathDestination('phases/13-tools-and-protocols/22-skills-and-agent-sdks', 'agent-skills'),
    'lesson.html?path=phases%2F13-tools-and-protocols%2F22-skills-and-agent-sdks&learningPath=agent-skills'
  );
  assert.equal(resultIndexForEnter(-1, 5), 0);
  assert.equal(resultIndexForEnter(3, 5), 3);
  assert.equal(resultIndexForEnter(-1, 0), -1);
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
    assert.equal(first.url, 'lesson.html?path=phases%2F13-tools-and-protocols%2F22-skills-and-agent-sdks&learningPath=agent-skills');
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
  assert.match(lessonHtml, /In Codex use <code>check-understanding /);
  assert.match(lessonHtml, /\/check-understanding/);
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
