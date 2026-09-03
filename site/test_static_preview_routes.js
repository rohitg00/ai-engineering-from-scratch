const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { navigationDestination } = require('./cmdpalette.js');

const headerSource = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');

function testLocation(url) {
  const parsed = new URL(url);
  return {
    href: parsed.href,
    hostname: parsed.hostname,
    origin: parsed.origin,
    pathname: parsed.pathname,
    protocol: parsed.protocol,
  };
}

function testLink(initialHref) {
  let href = initialHref;
  return {
    nodeType: 1,
    matches(selector) {
      return selector === 'a[href]';
    },
    closest(selector) {
      return selector === 'a[href]' ? this : null;
    },
    querySelectorAll() {
      return [];
    },
    getAttribute(name) {
      return name === 'href' ? href : null;
    },
    setAttribute(name, value) {
      if (name === 'href') href = value;
    },
    value() {
      return href;
    },
  };
}

function loadRouteRuntime(url, initialLinks = []) {
  const listeners = new Map();
  const observers = [];
  const document = {
    readyState: 'loading',
    documentElement: {},
    querySelectorAll(selector) {
      return selector === 'a[href]' ? initialLinks : [];
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
  };
  class TestMutationObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
  }
  const window = {
    location: testLocation(url),
  };
  vm.runInNewContext(headerSource, {
    URL,
    MutationObserver: TestMutationObserver,
    document,
    window,
  }, { filename: 'header.js' });
  return {
    api: window.AIFSRouteLinks,
    click(link) {
      for (const listener of listeners.get('click') || []) listener({ target: link });
    },
    mutate(mutation) {
      for (const observer of observers) observer.callback([mutation]);
    },
  };
}

function runtimeRouteLinks(filename) {
  const source = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  return Array.from(source.matchAll(/href="((?:lesson|certification)\?[^"<]+)"/g), match => (
    match[1].replaceAll('&amp;', '&')
  ));
}

test('plain static preview rewrites every route-producing site surface', () => {
  const surfaces = [
    ['index.html', /Start the Course/],
    ['catalog.html', /data-generated-discovery="lesson"/],
    ['lesson.html', /lesson-nav-btn next/],
    ['certifications.html', /certification\?id=/],
    ['learning-paths.html', /learningPath=/],
  ];
  const hrefs = [];
  for (const [filename, marker] of surfaces) {
    const source = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    assert.match(source, marker, `${filename} no longer contains its expected route surface`);
    const routes = runtimeRouteLinks(filename);
    assert.ok(routes.length > 0, `${filename} has no route links to exercise`);
    hrefs.push(...routes);
  }

  const links = hrefs.map(testLink);
  loadRouteRuntime('http://127.0.0.1:8000/site/index.html', links);
  assert.equal(links.every(link => /^(?:lesson|certification)\.html\?/.test(link.value())), true);

  const directFileLinks = runtimeRouteLinks('learning-paths.html').map(testLink);
  loadRouteRuntime('file:///tmp/ai-engineering-from-scratch/site/learning-paths.html', directFileLinks);
  assert.equal(directFileLinks.every(link => link.value().startsWith('lesson.html?')), true);
  assert.match(fs.readFileSync(path.join(__dirname, 'learning-paths.html'), 'utf8'), />Study specialist lessons<\/a>/);
});

test('GitHub project Pages rewrites shared routes to static files', () => {
  const routes = runtimeRouteLinks('certifications.html');
  assert.equal(routes.some(route => route.startsWith('lesson?')), true);
  assert.equal(routes.some(route => route.startsWith('certification?')), true);
  const links = routes.map(testLink);
  const runtime = loadRouteRuntime(
    'https://example.github.io/ai-engineering-from-scratch/certifications.html',
    links
  );

  assert.equal(runtime.api.isStaticPreview(), true);
  assert.equal(links.length > 0, true);
  assert.equal(links.every(link => /^(?:lesson|certification)\.html\?/.test(link.value())), true);
});

test('shared adapter covers dynamically inserted links, click races, and command palette navigation', () => {
  const runtime = loadRouteRuntime('http://localhost:8000/site/index.html');
  const inserted = testLink('lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment');
  runtime.mutate({ type: 'childList', addedNodes: [inserted] });
  assert.equal(inserted.value(), 'lesson.html?path=phases%2F00-setup-and-tooling%2F01-dev-environment');

  inserted.setAttribute('href', 'certification?id=claude-ccar-f');
  runtime.mutate({ type: 'attributes', target: inserted, addedNodes: [] });
  assert.equal(inserted.value(), 'certification.html?id=claude-ccar-f');

  const immediate = testLink('lesson?path=phases%2F14-agent-engineering%2F47-outcomes-before-output');
  runtime.click(immediate);
  assert.equal(immediate.value(), 'lesson.html?path=phases%2F14-agent-engineering%2F47-outcomes-before-output');

  assert.equal(
    navigationDestination('certification?id=claude-ccar-f', runtime.api),
    'certification.html?id=claude-ccar-f'
  );
});

test('deployed routes and canonical SEO URLs remain extensionless', () => {
  const production = loadRouteRuntime('https://aiengineeringfromscratch.com/index.html');
  assert.equal(
    production.api.adaptHref('lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment'),
    'lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment'
  );
  assert.equal(
    production.api.adaptHref('certification?id=claude-ccar-f'),
    'certification?id=claude-ccar-f'
  );

  const lesson = fs.readFileSync(path.join(__dirname, 'lesson.html'), 'utf8');
  const certification = fs.readFileSync(path.join(__dirname, 'certification.html'), 'utf8');
  assert.match(lesson, /<link rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/lesson">/);
  assert.match(certification, /<link rel="canonical" href="https:\/\/aiengineeringfromscratch\.com\/certification">/);
  assert.doesNotMatch(lesson, /rel="canonical"[^>]+lesson\.html/);
  assert.doesNotMatch(certification, /rel="canonical"[^>]+certification\.html/);
});
