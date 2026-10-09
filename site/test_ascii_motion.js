const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener(event); return true; }
  count() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0); }
}

class Element extends Events {
  constructor() {
    super();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    const classes = new Set();
    this.classList = { add: value => classes.add(value), remove: value => classes.delete(value) };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; return child; }
  get firstChild() { return this.children[0] || null; }
}

function environment({ reduced = false } = {}) {
  const document = new Events();
  Object.assign(document, { hidden: false, createElement: () => new Element(), createElementNS: () => new Element() });
  const media = new Events();
  media.matches = reduced;
  const frames = new Map();
  const observers = [];
  const renderers = [];
  let clock = 0;
  let nextFrame = 0;
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const window = {
    document, CustomEvent, IntersectionObserver: Observer, matchMedia: () => media,
    performance: { now: () => clock },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    AsciiRestCanvas: {
      create(canvas, meta) {
        const renderer = {
          canvas, meta, draws: [], destroyed: false, snapshot: null,
          draw(text, color) {
            assert.equal(this.destroyed, false, 'destroyed renderers must not receive frames');
            this.draws.push(clock);
            this.snapshot = { text, color: color ? Buffer.from(color) : null };
          },
          destroy() { this.destroyed = true; },
        };
        renderers.push(renderer);
        return renderer;
      },
    },
  };
  const context = vm.createContext({ window, document, ...window });
  for (const file of ['motion-lessons/loss-landscape.js', 'motion-lessons/attention.js', 'ascii-motion.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
  }
  const host = new Element();
  return {
    host, document, media, frames, observers, renderers,
    mount: (kind, target = host) => window.AsciiMotion.mount(target, { kind }),
    visible(value, target = host) {
      const observer = observers.findLast(item => item.target === target && !item.disconnected);
      observer.callback([{ target, isIntersecting: value, intersectionRatio: value ? 1 : 0 }]);
    },
    hidden(value) { document.hidden = value; document.dispatchEvent({ type: 'visibilitychange' }); },
    reduce(value) { media.matches = value; media.dispatchEvent({ type: 'change', matches: value }); },
    advance(milliseconds, interval = 50) {
      for (let remaining = milliseconds; remaining > 0; remaining -= interval) {
        clock += Math.min(remaining, interval);
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(clock));
      }
    },
  };
}

for (const kind of ['signal', 'agent']) {
  test(`${kind} renders changing lesson frames and restarts reproducibly`, () => {
    const env = environment();
    const controller = env.mount(kind);
    const renderer = env.renderers[0];
    const initial = renderer.snapshot;
    assert.ok(initial.text.trim().length > 100);
    const lines = initial.text.split('\n');
    assert.equal(lines.length, renderer.meta.rows);
    assert.ok(lines.every(line => line.length === renderer.meta.cols));
    if (renderer.meta.palette) {
      assert.equal(initial.color.length, renderer.meta.cols * renderer.meta.rows);
      assert.ok(new Set(initial.color).size > 1);
      assert.ok(initial.color.every(index => index < renderer.meta.palette.length));
    }
    assert.equal(env.frames.size, 0);
    env.visible(true);
    assert.equal(env.frames.size, 1);
    env.advance(1000);
    const animated = renderer.snapshot;
    assert.notDeepEqual(animated, initial);
    controller.replay();
    env.advance(1000);
    assert.deepEqual(renderer.snapshot, animated);
    controller.destroy();
  });
}

test('attention playback continues while metric events remain rate limited', () => {
  const env = environment();
  const changes = [];
  env.host.addEventListener('ascii-motion-change', event => changes.push(event.detail));
  const controller = env.mount('agent');
  env.visible(true);
  const initialEvents = changes.length;
  env.advance(25000);
  const state = controller.getState();
  assert.ok(state.elapsed >= 25000);
  assert.equal(state.complete, false);
  assert.equal(state.playing, true);
  assert.equal(env.frames.size, 1);
  assert.ok(changes.length - initialEvents <= 126, 'metrics must not announce every animation frame');
  controller.destroy();
});

test('high refresh displays generate at most twenty art frames per second', () => {
  const env = environment();
  const controller = env.mount('agent');
  env.visible(true);
  const renderer = env.renderers[0];
  const initialDraws = renderer.draws.length;
  env.advance(1000, 1);
  const draws = renderer.draws.slice(initialDraws);
  assert.ok(draws.length >= 10, 'visible playback must keep rendering');
  assert.ok(draws.length <= 20, 'art must remain capped even with frequent RAF callbacks');
  assert.ok(draws.every((time, index) => index === 0 || time - draws[index - 1] >= 50));
  assert.equal(env.frames.size, 1);
  controller.destroy();
});

test('pause freezes elapsed time; repeated play and replay keep one frame queue', () => {
  const env = environment();
  const controller = env.mount('agent');
  env.visible(true);
  env.advance(1000);
  controller.pause();
  const paused = controller.getState().elapsed;
  const snapshot = env.renderers[0].snapshot;
  env.advance(1000);
  assert.equal(controller.getState().elapsed, paused);
  assert.deepEqual(env.renderers[0].snapshot, snapshot);
  assert.equal(env.frames.size, 0);
  for (let index = 0; index < 5; index++) controller.play();
  assert.equal(env.frames.size, 1);
  env.advance(500);
  assert.ok(controller.getState().elapsed > paused);
  for (let index = 0; index < 5; index++) controller.replay();
  assert.equal(controller.getState().elapsed, 0);
  assert.equal(env.frames.size, 1);
  controller.setSpeed(0.25);
  env.advance(1000);
  const slow = controller.getState().elapsed;
  assert.ok(slow >= 200 && slow <= 250);
  controller.setSpeed(1);
  env.advance(1000);
  assert.ok(controller.getState().elapsed - slow >= 950);
  controller.destroy();
});

test('multiple animations share one frame queue and pause independently', () => {
  const env = environment();
  const otherHost = new Element();
  const first = env.mount('signal');
  const second = env.mount('agent', otherHost);
  env.visible(true);
  env.visible(true, otherHost);
  assert.equal(env.frames.size, 1);
  env.advance(200);
  first.pause();
  const paused = first.getState().elapsed;
  const snapshot = env.renderers[0].snapshot;
  env.advance(200);
  assert.equal(first.getState().elapsed, paused);
  assert.deepEqual(env.renderers[0].snapshot, snapshot);
  assert.ok(second.getState().elapsed > paused);
  assert.equal(env.frames.size, 1);
  second.destroy();
  assert.equal(env.frames.size, 0);
  first.play();
  assert.equal(env.frames.size, 1);
  first.destroy();
  assert.equal(env.frames.size, 0);
  assert.equal(env.document.count() + env.media.count(), 0);
});

test('offscreen and hidden-tab time never advances playback or overrides manual pause', () => {
  const env = environment();
  const controller = env.mount('agent');
  env.visible(true);
  env.advance(1000);
  env.visible(false);
  const elapsed = controller.getState().elapsed;
  env.advance(1500);
  assert.equal(controller.getState().elapsed, elapsed);
  assert.equal(env.frames.size, 0);
  env.hidden(true);
  env.visible(true);
  assert.equal(env.frames.size, 0);
  env.hidden(false);
  assert.equal(env.frames.size, 1);
  env.advance(200);
  assert.ok(controller.getState().elapsed > elapsed);
  controller.pause();
  env.hidden(true);
  env.hidden(false);
  env.visible(false);
  env.visible(true);
  assert.equal(controller.getState().playing, false);
  assert.equal(env.frames.size, 0);
  controller.destroy();
});

test('live reduced motion freezes art and requires an explicit restart when disabled', () => {
  const env = environment({ reduced: true });
  const controller = env.mount('agent');
  env.visible(true);
  const initial = env.renderers[0].snapshot;
  assert.ok(initial.text.trim());
  assert.equal(env.frames.size, 0);
  controller.play();
  env.advance(1000);
  assert.deepEqual(env.renderers[0].snapshot, initial);
  env.reduce(false);
  assert.equal(env.frames.size, 0);
  controller.play();
  assert.equal(env.frames.size, 1);
  env.advance(1000);
  env.reduce(true);
  const frozen = env.renderers[0].snapshot;
  const elapsed = controller.getState().elapsed;
  env.advance(1000);
  assert.equal(controller.getState().reduced, true);
  assert.equal(controller.getState().elapsed, elapsed);
  assert.deepEqual(env.renderers[0].snapshot, frozen);
  assert.equal(env.frames.size, 0);
  controller.replay();
  env.advance(1000);
  assert.equal(env.frames.size, 0);
  controller.setReducedMotion(false);
  assert.equal(controller.getState().reduced, true);
  env.reduce(false);
  controller.setReducedMotion(true);
  assert.equal(controller.getState().reduced, true);
  controller.setReducedMotion(false);
  assert.equal(controller.getState().reduced, false);
  assert.equal(env.frames.size, 0);
  controller.destroy();
});

test('remount and destruction release listeners, observers, and pending animation frames', () => {
  const env = environment();
  const first = env.mount('signal');
  env.visible(true);
  const listeners = env.document.count() + env.media.count();
  const second = env.mount('agent');
  assert.equal(first.getState().destroyed, true);
  assert.equal(env.renderers[0].destroyed, true);
  assert.equal(env.observers[0].disconnected, true);
  assert.equal(env.document.count() + env.media.count(), listeners);
  env.visible(true);
  assert.equal(env.frames.size, 1);
  second.destroy();
  second.destroy();
  second.play();
  second.replay();
  second.step();
  assert.equal(env.frames.size, 0);
  assert.equal(env.document.count() + env.media.count(), 0);
  assert.ok(env.observers.every(observer => observer.disconnected));
  assert.ok(env.renderers.every(renderer => renderer.destroyed));
  assert.equal(env.host.children.length, 0);
  assert.equal(second.getState().destroyed, true);
});


test('gradient descent completes and parameters restart the actual model', () => {
  const env = environment();
  const controller = env.mount('signal');
  const initialLoss = controller.getState().metrics.loss;
  env.visible(true);
  env.advance(30000);
  const final = controller.getState();
  assert.equal(final.complete, true);
  assert.ok(final.metrics.loss < initialLoss);
  assert.equal(env.frames.size, 0);
  controller.setParameter('learningRate', 0.03);
  assert.equal(controller.getState().metrics.step, 0);
  assert.equal(controller.getState().metrics.learningRate, 0.03);
  assert.equal(env.frames.size, 1);
  controller.replay();
  assert.equal(controller.getState().metrics.learningRate, 0.03);
  controller.destroy();
});

test('reduced motion can advance a real gradient step without starting playback', () => {
  const env = environment({ reduced: true });
  const controller = env.mount('signal');
  env.visible(true);
  const initial = controller.getState().metrics;
  controller.step();
  assert.equal(controller.getState().metrics.step, 1);
  assert.ok(controller.getState().metrics.loss < initial.loss);
  assert.equal(env.frames.size, 0);
  controller.setParameter('learningRate', 0.18);
  assert.equal(controller.getState().metrics.step, 0);
  assert.equal(env.frames.size, 0);
  controller.destroy();
});

test('attention parameters change computed weights and survive replay', () => {
  const env = environment({ reduced: true });
  const controller = env.mount('agent');
  const initial = JSON.stringify(controller.getState().metrics.weights);
  controller.setParameter('token', 1);
  controller.setParameter('temperature', 0.5);
  assert.notEqual(JSON.stringify(controller.getState().metrics.weights), initial);
  controller.replay();
  assert.equal(controller.getState().metrics.tokenIndex, 1);
  assert.equal(controller.getState().metrics.temperature, 0.5);
  assert.equal(env.frames.size, 0);
  controller.destroy();
});


test('Next advances one displayed optimization step after a pause between paints', () => {
  for (const reduced of [false, true]) {
    const env = environment();
    const controller = env.mount('signal');
    env.visible(true);
    env.advance(149, 1);
    if (reduced) env.reduce(true);
    else controller.pause();
    assert.equal(controller.getState().metrics.step, 0);
    controller.step();
    assert.equal(controller.getState().metrics.step, 1);
    assert.equal(env.frames.size, 0);
    controller.destroy();
  }
});

test('changing optimization metrics publish at most five times per second', () => {
  const env = environment();
  let events = 0;
  env.host.addEventListener('ascii-motion-change', () => events++);
  const controller = env.mount('signal');
  env.visible(true);
  events = 0;
  env.advance(1000, 1);
  assert.equal(events, 5);
  controller.destroy();
});
