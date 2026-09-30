'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, 'figures/projects/runtime.js'), 'utf8');

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatch(name, target = this) { for (const fn of this.listeners.get(name) || []) fn({ target }); }
  listenerCount() { return Array.from(this.listeners.values()).reduce((n, listeners) => n + listeners.size, 0); }
}

class Element extends Events {
  constructor(tag) { super(); this.tagName = tag; this.children = []; this.attributes = {}; this.style = {}; this.hidden = false; this.value = ''; this.checked = false; this.parentNode = null; this._text = ''; this.animations = []; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  set textContent(value) { this._text = String(value); for (const child of this.children) child.parentNode = null; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children.at(-1) || null; }
  get isConnected() { return this.tagName === 'body' || !!this.parentNode?.isConnected; }
  appendChild(child) { return this.insertBefore(child, null); }
  append(...children) { for (const child of children) this.appendChild(child); }
  insertBefore(child, sibling) { child.remove(); const at = sibling ? this.children.indexOf(sibling) : this.children.length; this.children.splice(at, 0, child); child.parentNode = this; return child; }
  remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
  replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this._text = ''; this.append(...children); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.getAttribute('class') || '').split(' ').includes(selector.slice(1));
    const attribute = selector.match(/^\[([^=\]]+)(?:="?([^"\]]+)"?)?\]$/);
    if (attribute) return this.getAttribute(attribute[1]) !== null && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    return this.tagName === selector;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { left: (this.parentNode?.parentNode?.parentNode?.children.indexOf(this.parentNode.parentNode) || 0) * 200, top: (this.parentNode?.children.indexOf(this) || 0) * 50 }; }
  animate(keyframes, options) { const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } }; this.animations.push(animation); return animation; }
}

function environment({ reduced = false } = {}) {
  const document = new Events();
  document.body = new Element('body');
  document.hidden = false;
  const media = new Events(); media.matches = reduced;
  const window = new Events();
  const providers = {};
  const disposers = [];
  const timers = new Map();
  const observers = [];
  let clock = 0;
  function el(tag, attrs = {}, children = []) {
    const element = new Element(tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    for (let child of children) { if (typeof child === 'string') { const text = new Element('#text'); text.textContent = child; child = text; } element.appendChild(child); }
    return element;
  }
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  Object.assign(window, {
    matchMedia: () => media,
    setInterval: fn => { timers.set(++clock, fn); return clock; },
    clearInterval: id => timers.delete(id),
    IntersectionObserver: Observer,
    MutationObserver: Observer,
    LF: { el, motion: { easeOut: 'cubic-bezier(0.23,1,0.32,1)' }, register: value => Object.assign(providers, value), registerDisposer: (_, fn) => disposers.push(fn) },
  });
  vm.runInNewContext(source, { window, document, Map, Set, Promise, Number, Object, Array, String, Error });
  function mount(config) {
    const host = el('div', { class: 'lesson-figure' });
    document.body.append(host);
    window.AIFSProjectFigures.register('example', config);
    const cleanup = providers.example(host);
    return { host, cleanup, lab: host.querySelector('.pj-mechanism-lab') };
  }
  return { window, document, media, timers, observers, disposers, el, mount, tick: () => [...timers.values()].forEach(fn => fn()) };
}

const controls = [{ key: 'amount', label: 'Rows', type: 'range', value: 2, min: 1, max: 10 }];
function trace(amount = 2) {
  return {
    summary: 'Final result must not appear at the beginning',
    frames: [
      { label: 'Read rows', explanation: 'The records begin in the input lane.', lanes: [{ id: 'input', label: 'Input', items: [{ id: 'a', label: 'Row A', value: amount }] }, { id: 'result', label: 'Result', items: [] }], metrics: [{ label: 'Rows examined', value: 0 }], bars: [{ label: 'Rows', value: 0, max: 10 }], columns: ['Row', 'State'], rows: [['a', 'pending']] },
      { label: 'Move the row', explanation: 'The matching key sends the record to the result lane.', summary: 'Moved ' + amount, lanes: [{ id: 'input', label: 'Input', items: [] }, { id: 'result', label: 'Result', items: [{ id: 'a', label: 'Row A', value: amount, tone: 'good' }] }], metrics: [{ label: 'Rows examined', value: amount }], bars: [{ label: 'Rows', value: amount, max: 10 }], columns: ['Row', 'State'], rows: [['a', 'matched']], receipt: { moved: amount } },
    ],
  };
}
function button(root, label) { return root.querySelectorAll('button').find(node => node.textContent === label); }
function click(root, label) { const found = button(root, label); assert.ok(found, label); assert.notEqual(found.disabled, true, label + ' is enabled'); found.dispatch('click'); return found; }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('legacy calculators expose live results and method notes without fake playback', () => {
  const env = environment(); let calls = 0;
  const { host } = env.mount({ title: 'Live comparison', steps: [{ label: 'Count', detail: 'Count the input records.' }], lab: { controls, calculate: values => { calls++; return { summary: 'Rows: ' + values.amount }; } } });
  assert.equal(host.querySelector('.pj-trace-controls').hidden, true);
  assert.match(host.querySelector('.pj-method').textContent, /Count the input records/);
  assert.equal(calls, 1);
  const input = host.querySelector('input'); input.value = '5'; input.dispatch('input');
  assert.equal(host.querySelector('.pj-lab-summary').textContent, 'Rows: 5');
  assert.equal(calls, 2);
  assert.equal(env.timers.size, 0);
});

test('manual frame navigation consumes one computed trace and preserves visible record, metric, bar and table identities', () => {
  const env = environment(); let calls = 0;
  const { host } = env.mount({ lab: { controls, calculate: values => { calls++; return trace(values.amount); } } });
  const item = host.querySelector('.pj-trace-item');
  const metric = host.querySelector('dd');
  const bar = host.querySelector('.pj-lab-track');
  const row = host.querySelector('tbody').children[0];
  assert.equal(host.querySelector('.pj-lab-summary').hidden, true);
  assert.equal(item.closest('[data-lane-id]').getAttribute('data-lane-id'), 'input');
  click(host, 'Next step');
  assert.equal(host.querySelector('.pj-trace-item'), item);
  assert.equal(item.closest('[data-lane-id]').getAttribute('data-lane-id'), 'result');
  assert.equal(host.querySelector('dd'), metric);
  assert.equal(metric.textContent, '2');
  assert.equal(host.querySelector('.pj-lab-track'), bar);
  assert.equal(host.querySelector('tbody').children[0], row);
  assert.equal(row.children[1].textContent, 'matched');
  assert.equal(calls, 1);
  assert.equal(host.querySelector('.pj-trace-receipt').hidden, false);
  click(host, 'Previous');
  assert.equal(host.querySelector('.pj-trace-receipt').hidden, true);
  assert.equal(host.querySelector('.pj-lab-summary').hidden, true);
  assert.equal(calls, 1);
});

test('older asynchronous computations cannot overwrite newer inputs or errors', async () => {
  const env = environment(); const pending = [];
  const { host } = env.mount({ lab: { controls, calculate: values => new Promise((resolve, reject) => pending.push({ values, resolve, reject })) } });
  const input = host.querySelector('input');
  input.value = '7'; input.dispatch('input');
  pending[1].resolve(trace(7)); await flush();
  pending[0].resolve(trace(2)); await flush();
  assert.equal(host.querySelector('.pj-trace-value').textContent, '7');
  input.value = '6'; input.dispatch('input');
  assert.equal(host.querySelector('.pj-trace-state').hidden, true);
  input.value = ''; input.dispatch('input');
  pending[2].resolve(trace(6)); await flush();
  assert.match(host.querySelector('.pj-lab-message').textContent, /needs a number/);
  assert.equal(host.querySelector('.pj-trace-state').hidden, true);
});

test('an outdated asynchronous rejection stays silent and teardown ignores pending results', async () => {
  const env = environment(); const pending = [];
  const { host, cleanup } = env.mount({ lab: { controls, calculate: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } });
  host.querySelector('input').dispatch('input');
  pending[1].resolve(trace()); await flush();
  pending[0].reject(new Error('Old error')); await flush();
  assert.equal(host.querySelector('.pj-lab-message').textContent, '');
  host.querySelector('input').dispatch('input'); cleanup();
  pending[2].resolve(trace(9)); await flush();
  assert.equal(host.querySelector('.pj-trace-state').hidden, true);
});

test('input edits, presets and reset stop playback, reset to frame zero and update accessible slider values', () => {
  const env = environment(); const observed = [];
  const { host } = env.mount({ lab: { controls: [...controls, { key: 'name', type: 'text', label: 'Name', value: 'default' }], scenarios: [{ label: 'Nine rows', values: { amount: 9 } }], calculate: values => { observed.push(values); return trace(values.amount); } } });
  click(host, 'Play steps'); assert.equal(env.timers.size, 1); env.tick();
  assert.equal(env.timers.size, 0);
  click(host, 'Replay steps'); assert.equal(env.timers.size, 1);
  const input = host.querySelector('input'); input.value = '4'; input.dispatch('input');
  assert.equal(env.timers.size, 0);
  assert.equal(host.querySelector('.pj-trace-label').textContent, 'Read rows');
  assert.equal(input.getAttribute('aria-valuetext'), '4');
  host.querySelectorAll('input')[1].value = 'changed';
  click(host, 'Nine rows');
  assert.equal(observed.at(-1).name, 'default');
  assert.equal(input.getAttribute('aria-valuetext'), '9');
  click(host, 'Next step'); click(host, 'Reset inputs');
  assert.equal(input.getAttribute('aria-valuetext'), '2');
  assert.equal(host.querySelector('.pj-trace-label').textContent, 'Read rows');
});

test('direct step selection stops playback without recomputing', () => {
  const env = environment(); let calls = 0;
  const { host } = env.mount({ lab: { calculate: () => { calls++; return trace(); } } });
  click(host, 'Play steps');
  const steps = host.querySelector('.pj-trace-steps');
  steps.dispatch('click', steps.children[1]);
  assert.equal(env.timers.size, 0);
  assert.equal(calls, 1);
  assert.equal(steps.children[1].getAttribute('aria-current'), 'step');
});

test('step navigation reveals the active button by scrolling only the overflowing step strip', () => {
  const { host } = environment().mount({ lab: { calculate: trace } });
  const steps = host.querySelector('.pj-trace-steps');
  steps.clientWidth = 250;
  steps.scrollWidth = 500;
  steps.scrollLeft = 0;
  steps.getBoundingClientRect = () => ({ left: 100, right: 350 });
  steps.children[0].getBoundingClientRect = () => ({ left: 100 - steps.scrollLeft, right: 230 - steps.scrollLeft });
  steps.children[1].getBoundingClientRect = () => ({ left: 300 - steps.scrollLeft, right: 450 - steps.scrollLeft });
  click(host, 'Next step');
  assert.equal(steps.scrollLeft, 100);
  click(host, 'Previous');
  assert.equal(steps.scrollLeft, 0);
});

test('mixed bar units use each declared domain and retain readable values', () => {
  const { host } = environment().mount({ lab: { calculate: () => ({ bars: [{ label: 'Time', value: 500, max: 1000, unit: 'ms' }, { label: 'Rows', value: 5, max: 10 }] }) } });
  const bars = host.querySelectorAll('.pj-lab-track');
  assert.deepEqual(bars.map(bar => bar.children[0].style.transform), ['scaleX(0.5)', 'scaleX(0.5)']);
  assert.equal(bars[0].getAttribute('aria-valuetext'), '500 ms / 1000 ms');
  assert.equal(bars[1].getAttribute('aria-valuemax'), '10');
});

test('zero budget and deadline domains stay zero in visible and accessible output with empty tracks', () => {
  const { host } = environment().mount({ lab: { calculate: () => ({ bars: [
    { label: 'Budget', value: 0, max: 0, unit: 'teaching units' },
    { label: 'Elapsed time', value: 0, max: 0, unit: 'ms' },
    { label: 'Unscaled count', value: 0 },
  ] }) } });
  const bars = host.querySelectorAll('.pj-lab-track');
  for (const [index, unit] of ['teaching units', 'ms'].entries()) {
    assert.equal(bars[index].getAttribute('aria-valuemin'), '0');
    assert.equal(bars[index].getAttribute('aria-valuemax'), '0');
    assert.equal(bars[index].getAttribute('aria-valuenow'), '0');
    assert.equal(bars[index].getAttribute('aria-valuetext'), `0 ${unit} / 0 ${unit}`);
    assert.equal(bars[index].parentNode.querySelector('output').textContent, `0 ${unit} / 0 ${unit}`);
    assert.equal(bars[index].children[0].style.transform, 'scaleX(0)');
  }
  assert.equal(bars[2].getAttribute('aria-valuemax'), '1');
  assert.equal(bars[2].children[0].style.transform, 'scaleX(0)');
});

test('reduced motion disables timed play while preserving every manual frame', () => {
  const env = environment({ reduced: true });
  const { host } = env.mount({ lab: { calculate: trace } });
  assert.equal(button(host, 'Play steps').disabled, true);
  click(host, 'Next step');
  assert.equal(host.querySelector('.pj-trace-label').textContent, 'Move the row');
  assert.equal(host.querySelector('.pj-trace-item').animations.length, 0);
  env.media.matches = false; env.media.dispatch('change');
  click(host, 'Replay steps'); assert.equal(env.timers.size, 1);
  env.media.matches = true; env.media.dispatch('change');
  assert.equal(env.timers.size, 0);
  assert.equal(button(host, 'Play steps').disabled, true);
});

test('hidden, offscreen and printing states stop playback; detaching releases listeners, observers and timers', () => {
  const env = environment(); const { host, cleanup } = env.mount({ lab: { calculate: trace } });
  click(host, 'Play steps'); env.document.hidden = true; env.document.dispatch('visibilitychange');
  assert.equal(env.timers.size, 0);
  env.document.hidden = false; env.document.dispatch('visibilitychange'); click(host, 'Play steps');
  env.observers[0].callback([{ target: host.querySelector('.pj-mechanism-lab'), isIntersecting: false }]);
  assert.equal(env.timers.size, 0);
  env.observers[0].callback([{ target: host.querySelector('.pj-mechanism-lab'), isIntersecting: true }]); click(host, 'Play steps');
  env.window.dispatch('beforeprint'); assert.equal(env.timers.size, 0);
  env.window.dispatch('afterprint'); click(host, 'Play steps');
  host.remove(); env.observers[1].callback();
  assert.equal(env.timers.size, 0);
  assert.equal(env.document.listenerCount(), 0);
  assert.equal(env.window.listenerCount(), 0);
  assert.equal(env.media.listenerCount(), 0);
  assert.ok(env.observers.every(observer => observer.disconnected));
  assert.ok(host.querySelectorAll('button').every(node => node.listenerCount() === 0));
  cleanup();
});

test('invalid inputs and invalid trace links hide stale results and keep errors visible', () => {
  const env = environment(); let calls = 0;
  const { host } = env.mount({ lab: { controls, calculate: values => { calls++; const data = trace(values.amount); if (values.amount === 8) data.frames[0].links = [{ from: 'a', to: 'missing', label: 'Not present' }]; return data; } } });
  click(host, 'Play steps');
  const input = host.querySelector('input'); input.value = '11'; input.dispatch('input');
  assert.equal(calls, 1); assert.equal(env.timers.size, 0);
  assert.equal(host.querySelector('.pj-trace-state').hidden, true);
  assert.equal(host.querySelector('.pj-lab-message').getAttribute('data-error'), 'true');
  input.value = '8'; input.dispatch('input');
  assert.match(host.querySelector('.pj-lab-message').textContent, /identify two records/);
  assert.equal(host.querySelector('.pj-trace-controls').hidden, true);
});

test('links visibly name both connected records and include their stable IDs', () => {
  const { host } = environment().mount({ lab: { calculate: () => ({ frames: [{ label: 'Compare', explanation: 'Equal fingerprints reveal overlap.', lanes: [{ id: 'pairs', label: 'Pair', items: [{ id: 'train-a', label: 'Train row' }, { id: 'test-a', label: 'Test row' }] }], links: [{ from: 'train-a', to: 'test-a', label: 'Same fingerprint', tone: 'bad' }] }] }) } });
  assert.equal(host.querySelector('.pj-trace-links').textContent, 'Train row (train-a) → Test row (test-a): Same fingerprint');
});

test('mountLab remains a callable updater and registers cleanup with the enclosing figure', () => {
  const env = environment(); const figure = env.el('div', { class: 'lesson-figure' }); env.document.body.append(figure);
  const body = env.el('div'); figure.append(body);
  let externalStep = 2;
  const draw = env.window.AIFSProjectFigures.mountLab(body, { calculate: (_, step) => ({ summary: 'Step ' + step }) }, () => externalStep);
  assert.equal(body.querySelector('.pj-lab-summary').textContent, 'Step 2');
  externalStep = 3; draw();
  assert.equal(body.querySelector('.pj-lab-summary').textContent, 'Step 3');
  assert.equal(env.disposers.length, 1);
  env.disposers[0]();
  assert.equal(env.window.listenerCount(), 0);
  assert.equal(typeof draw.dispose, 'function');
});
