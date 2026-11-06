const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const nudge = require('./star-nudge.js');

const { RULES, fresh, visit, nextAsk, asked, starred } = nudge;
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 13);

test('a first visit is never asked before three minutes of active reading', () => {
  const state = fresh(T0);
  assert.equal(nextAsk(state, T0, 600), false);
  assert.equal(nextAsk({ ...state, active: RULES.activeSeconds - 5 }, T0, 600), false);
  assert.equal(nextAsk({ ...state, active: RULES.activeSeconds }, T0, 600), true);
});

test('a second session is asked without waiting for reading time', () => {
  const first = fresh(T0);
  const same = visit(first, T0 + RULES.sessionGapMs - 1000);
  assert.equal(same.sessions, 1);
  const second = visit(first, T0 + RULES.sessionGapMs + 1000);
  assert.equal(second.sessions, 2);
  assert.equal(nextAsk(second, T0 + RULES.sessionGapMs + 1000, RULES.pageSeconds), true);
});

test('no page is interrupted in its first seconds', () => {
  const ready = { ...fresh(T0), active: 600 };
  assert.equal(nextAsk(ready, T0, RULES.pageSeconds - 5), false);
  assert.equal(nextAsk(ready, T0, RULES.pageSeconds), true);
});

test('after one ask the next waits fourteen days, and there is no third', () => {
  const once = asked({ ...fresh(T0), active: 600 }, T0);
  assert.equal(nextAsk(once, T0 + 13 * DAY, 60), false);
  assert.equal(nextAsk(once, T0 + 14 * DAY, 60), true);
  const twice = asked(once, T0 + 14 * DAY);
  assert.equal(nextAsk(twice, T0 + 400 * DAY, 60), false);
});

test('a star click ends every future ask', () => {
  const done = starred({ ...fresh(T0), active: 600, sessions: 5 });
  assert.equal(nextAsk(done, T0 + 400 * DAY, 600), false);
  assert.equal(nextAsk(visit(done, T0 + 30 * DAY), T0 + 30 * DAY, 600), false);
});

test('the note closes after six seconds unless it is held', () => {
  assert.equal(RULES.visibleMs, 6000);
  const source = fs.readFileSync(path.join(__dirname, 'star-nudge.js'), 'utf8');
  assert.match(source, /pointerenter[\s\S]*clearTimeout\(closeTimer\)/);
  assert.match(source, /focusin[\s\S]*clearTimeout\(closeTimer\)/);
  assert.match(source, /Escape/);
  assert.match(source, /prefers-reduced-motion/);
  assert.doesNotMatch(source, /overflow\s*:\s*hidden|aria-modal="true">|showModal/);
});

test('the shared header loads the nudge on every page', () => {
  const header = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');
  assert.match(header, /script\.src = 'star-nudge\.js\?v=' \+ STAR_NUDGE_VERSION/);
  assert.match(header, /ensureStarNudge\(\);/);
});

test('only overlays that are actually open hold the note back', () => {
  const { BUSY, busyIn } = nudge;
  assert.doesNotMatch(BUSY, /aria-modal/, 'the home modal and the palette always carry aria-modal, so it says nothing about open state');
  for (const open of ['dialog[open]', 'body[data-palette-open]', '#cmdPalette.cp-open', '#modalOverlay.open', '.header-menu-toggle[aria-expanded="true"]']) {
    assert.ok(BUSY.split(', ').includes(open), open);
  }
  const seen = [];
  assert.equal(busyIn({ querySelector: (selector) => { seen.push(selector); return null; } }), false);
  assert.deepEqual(seen, [BUSY]);
  assert.equal(busyIn({ querySelector: () => ({}) }), true);
  const source = fs.readFileSync(path.join(__dirname, 'star-nudge.js'), 'utf8');
  assert.match(source, /event\.key === 'Escape' && !event\.defaultPrevented/);
});
