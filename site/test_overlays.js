const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

function fakeElement(id) {
  const el = new EventTarget();
  const attrs = {};
  const classes = new Set();
  el.id = id || '';
  el.value = '';
  el.innerHTML = '';
  el.children = [];
  el.setAttribute = (name, value) => { attrs[name] = String(value); };
  el.getAttribute = (name) => (name in attrs ? attrs[name] : null);
  el.hasAttribute = (name) => name in attrs;
  el.removeAttribute = (name) => { delete attrs[name]; };
  el.classList = {
    add: (name) => classes.add(name),
    remove: (name) => classes.delete(name),
    contains: (name) => classes.has(name),
    toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
  };
  el.querySelectorAll = () => [];
  el.appendChild = (child) => { el.children.push(child); return child; };
  el.focus = () => { el.ownerDocument.activeElement = el; };
  return el;
}

function paletteHarness() {
  const doc = new EventTarget();
  const registry = {};
  doc.readyState = 'complete';
  doc.createElement = () => {
    const el = fakeElement();
    el.ownerDocument = doc;
    return el;
  };
  doc.getElementById = (id) => registry[id] || null;
  doc.querySelectorAll = () => [];
  doc.body = doc.createElement('body');
  doc.activeElement = doc.body;
  const appendToBody = doc.body.appendChild;
  doc.body.appendChild = (child) => {
    appendToBody(child);
    registry[child.id] = child;
    for (const id of ['cpBackdrop', 'cpClose', 'cpInput', 'cpResults']) {
      registry[id] = doc.createElement('div');
      registry[id].id = id;
    }
    return child;
  };
  const win = new EventTarget();
  const context = {
    window: win,
    document: doc,
    navigator: { platform: 'Linux' },
    CustomEvent,
    Event,
    Promise,
    module: undefined,
  };
  win.window = win;
  win.document = doc;
  vm.createContext(context);
  vm.runInContext(read('cmdpalette.js'), context);
  return { win, doc };
}

test('the open palette takes Escape before any other overlay can see it', () => {
  const { win, doc } = paletteHarness();
  const claims = [];
  doc.addEventListener('aifs:overlayopen', (event) => claims.push(event.detail.source));
  win.CmdPalette.open();
  assert.deepEqual(claims, ['palette'], 'opening the palette tells the header, theme menu and language panel to close');
  assert.ok(doc.body.hasAttribute('data-palette-open'));

  let reachedOthers = false;
  win.addEventListener('keydown', () => { reachedOthers = true; }, true);
  const escape = new Event('keydown', { cancelable: true });
  escape.key = 'Escape';
  win.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(reachedOthers, false, 'no later Escape handler runs while the palette closes');
  assert.equal(doc.body.hasAttribute('data-palette-open'), false);
  assert.equal(doc.getElementById('cmdPalette').classList.contains('cp-open'), false);

  const later = new Event('keydown', { cancelable: true });
  later.key = 'Escape';
  win.dispatchEvent(later);
  assert.equal(later.defaultPrevented, false, 'a closed palette leaves Escape to the page');
  assert.equal(reachedOthers, true);
});

test('an Escape that cancels IME composition leaves the palette open', () => {
  const { win, doc } = paletteHarness();
  win.CmdPalette.open();
  const dialog = doc.getElementById('cmdPalette');
  for (const fields of [{ isComposing: true }, { keyCode: 229 }]) {
    const escape = new Event('keydown', { cancelable: true });
    Object.assign(escape, { key: 'Escape' }, fields);
    win.dispatchEvent(escape);
    dialog.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented, false);
    assert.equal(dialog.classList.contains('cp-open'), true);
    assert.ok(doc.body.hasAttribute('data-palette-open'));
  }
  const escape = new Event('keydown', { cancelable: true });
  escape.key = 'Escape';
  dialog.dispatchEvent(escape);
  assert.equal(dialog.classList.contains('cp-open'), false);
});

test('overlays close each other and the header steps aside for open popups', () => {
  const theme = read('theme-menu.js');
  assert.match(theme, /emit\('aifs:overlayopen', \{ source: 'theme-menu' \}\)/);
  assert.match(theme, /addEventListener\('aifs:overlayopen'/);
  assert.match(theme, /api\.close = function/);
  const lang = read('lang-picker.js');
  assert.match(lang, /new CustomEvent\('aifs:overlayopen', \{ detail: \{ source: id \} \}\)/);
  assert.match(lang, /addEventListener\('aifs:overlayopen'/);
  const header = read('header.js');
  assert.match(header, /event\.detail\.source === 'palette'\) setOpen\(false, false\)/);
  assert.match(header, /\.lang-panel:not\(\[hidden\]\), #aifsThemeMenu:not\(\[hidden\]\)/);
  assert.match(header, /function syncLayout\(\) \{\s*if \(window\.AIFSThemeMenu && typeof window\.AIFSThemeMenu\.close === 'function'\) window\.AIFSThemeMenu\.close\(\);/);
});

test('the palette retries Pagefind after a failed load and refreshes page results', () => {
  const source = read('cmdpalette.js');
  assert.match(source, /\.catch\(function \(\) \{\s*_pagefind = null;\s*return null;/);
  assert.match(source, /renderResults\(query \? search\(query\) : \[\], true\);\s*searchPages\(query\);/);
  assert.match(source, /renderResults\(q \? search\(q\) : \[\]\);\s*searchPages\(q\);/);
  assert.match(source, /renderResults\(mergePages\(merged\.local, merged\.pages, PAGE_RESULTS\), true\)/);
});

test('the phase modal keeps focus across progress re-renders', () => {
  const source = read('app.js');
  assert.match(source, /modal-lesson-toggle\[data-path="' \+ focusedPath \+ '"\]/);
  assert.match(source, /if \(!returnTo && modalReturnPhase !== null\) returnTo = phaseRow\(modalReturnPhase\);/);
  assert.match(source, /modalReturnPhase = null;\s*currentPhaseIdx = -1;/);
});
