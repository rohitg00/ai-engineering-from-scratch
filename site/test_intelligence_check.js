const assert = require('node:assert/strict');
const test = require('node:test');
const { init } = require('./intelligence-check');

function setup() {
  const attributes = new Map([['data-state', 'idle']]);
  const handlers = [];
  const button = {
    disabled: true,
    addEventListener(type, handler) {
      assert.equal(type, 'click');
      handlers.push(handler);
    },
  };
  const answer = { textContent: 'A very unofficial test.' };
  const hint = { textContent: 'Ask a big question. Get a small answer.' };
  const label = { textContent: 'Ask the machine' };
  const sponsor = { hidden: true };
  const children = {
    '[data-intelligence-trigger]': button,
    '[data-intelligence-answer]': answer,
    '[data-intelligence-hint]': hint,
    '[data-intelligence-label]': label,
    '[data-intelligence-sponsor]': sponsor,
  };
  const card = {
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, value); },
    querySelector(selector) { return children[selector] ?? null; },
  };
  const doc = {
    querySelector(selector) {
      assert.equal(selector, '[data-intelligence-check]');
      return card;
    },
  };
  const environment = {
    reduced: false,
    matchMedia(query) {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return { matches: this.reduced };
    },
  };
  return {
    doc, card, button, answer, hint, label, sponsor, children, environment, handlers,
    click(detail = 1) { handlers.forEach(handler => handler({ detail })); },
  };
}

test('initialization enables the button without answering the question', () => {
  const state = setup();
  assert.equal(init(state.doc, state.environment), true);
  assert.equal(state.button.disabled, false);
  assert.equal(state.card.getAttribute('data-state'), 'idle');
  assert.equal(state.answer.textContent, 'A very unofficial test.');
  assert.equal(state.hint.textContent, 'Ask a big question. Get a small answer.');
  assert.equal(state.label.textContent, 'Ask the machine');
});

test('pointer activation answers immediately and opts into decorative motion', () => {
  const state = setup();
  init(state.doc, state.environment);
  state.click();
  assert.equal(state.card.getAttribute('data-state'), 'answered');
  assert.equal(state.card.getAttribute('data-motion'), 'animate');
  assert.equal(state.card.getAttribute('data-check'), '1');
  assert.equal(state.card.getAttribute('data-dial'), '1');
  assert.equal(state.answer.textContent, 'Define “here”.');
  assert.equal(state.hint.textContent, 'In the meantime, build something.');
  assert.equal(state.label.textContent, 'Ask again');
  assert.equal(state.button.disabled, false);
});

test('keyboard activation answers immediately without motion', () => {
  const state = setup();
  init(state.doc, state.environment);
  state.click(0);
  assert.equal(state.card.getAttribute('data-motion'), 'instant');
  assert.equal(state.answer.textContent, 'Define “here”.');
});

test('reduced motion is checked at each activation, including changes after initialization', () => {
  const state = setup();
  init(state.doc, state.environment);
  state.environment.reduced = true;
  state.click();
  assert.equal(state.card.getAttribute('data-motion'), 'instant');
  assert.equal(state.answer.textContent, 'Define “here”.');
  state.environment.reduced = false;
  state.click();
  assert.equal(state.card.getAttribute('data-motion'), 'animate');
  assert.equal(state.answer.textContent, 'Define “intelligence”.');
});

test('repeated activation cycles replies while keeping a monotonic check count', () => {
  const state = setup();
  init(state.doc, state.environment);
  const expected = [
    ['Define “here”.', 'In the meantime, build something.'],
    ['Define “intelligence”.', 'A good place to start.'],
    ['Still worth learning backprop.', 'Some questions are best answered by building.'],
    ['Define “here”.', 'In the meantime, build something.'],
  ];
  expected.forEach(([answer, hint], index) => {
    state.click();
    assert.equal(state.answer.textContent, answer);
    assert.equal(state.hint.textContent, hint);
    assert.equal(state.card.getAttribute('data-check'), String(index + 1));
    assert.equal(state.card.getAttribute('data-dial'), String(index % 3 + 1));
  });
});

test('missing or incomplete markup is safe and leaves the static button disabled', () => {
  assert.equal(init(null), false);
  assert.equal(init({ querySelector() { return null; } }), false);
  const state = setup();
  delete state.children['[data-intelligence-answer]'];
  assert.equal(init(state.doc, state.environment), false);
  assert.equal(state.button.disabled, true);
  assert.equal(state.handlers.length, 0);
});

test('initializing twice never duplicates handlers or resets the reply cycle', () => {
  const state = setup();
  init(state.doc, state.environment);
  state.click();
  assert.equal(init(state.doc, state.environment), false);
  assert.equal(state.handlers.length, 1);
  state.click();
  assert.equal(state.answer.textContent, 'Define “intelligence”.');
  assert.equal(state.card.getAttribute('data-check'), '2');
});

test('the optional button label and unavailable matchMedia do not prevent activation', () => {
  const state = setup();
  delete state.children['[data-intelligence-label]'];
  assert.equal(init(state.doc, {}), true);
  state.click();
  assert.equal(state.answer.textContent, 'Define “here”.');
  assert.equal(state.card.getAttribute('data-motion'), 'animate');
});

test('the sponsor link appears after the second answer and stays', () => {
  const state = setup();
  init(state.doc, state.environment);
  state.click();
  assert.equal(state.sponsor.hidden, true);
  state.click();
  assert.equal(state.sponsor.hidden, false);
  state.click();
  assert.equal(state.sponsor.hidden, false);
});

test('a card without the sponsor link still answers', () => {
  const state = setup();
  delete state.children['[data-intelligence-sponsor]'];
  assert.equal(init(state.doc, state.environment), true);
  state.click();
  state.click();
  assert.equal(state.answer.textContent, 'Define “intelligence”.');
});
