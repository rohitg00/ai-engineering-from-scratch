const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'motion-lessons/loss-landscape.js'), 'utf8'), { window });
const piece = window.CourseMotionPieces.signal;

test('analytic loss gradient matches central finite differences across the landscape', () => {
  const epsilon = 1e-5;
  for (const w1 of [-2.4, -1.3, 0, 0.8, 1.2, 2.7]) {
    for (const w2 of [-2.9, -0.8, 0, 2.2]) {
      const actual = piece.math.gradient(w1, w2);
      const dx = (piece.math.loss(w1 + epsilon, w2) - piece.math.loss(w1 - epsilon, w2)) / (2 * epsilon);
      const dy = (piece.math.loss(w1, w2 + epsilon) - piece.math.loss(w1, w2 - epsilon)) / (2 * epsilon);
      assert.ok(Math.abs(actual[0] - dx) < 1e-8);
      assert.ok(Math.abs(actual[1] - dy) < 1e-8);
    }
  }
});

test('each supported learning rate follows true decreasing-loss updates and converges within the cap', () => {
  for (const rate of piece.math.learningRates) {
    const frame = piece.create();
    frame.setLearningRate(rate);
    let before = frame.getMetrics();
    for (let step = 1; step <= piece.math.stepLimit && !before.done; step++) {
      const gradient = piece.math.gradient(before.w1, before.w2);
      frame(step / 8);
      const after = frame.getMetrics();
      assert.equal(after.step, step);
      assert.ok(Math.abs(after.w1 - (before.w1 - rate * gradient[0])) < 1e-12);
      assert.ok(Math.abs(after.w2 - (before.w2 - rate * gradient[1])) < 1e-12);
      assert.ok(after.loss < before.loss);
      before = after;
    }
    assert.equal(before.done, true);
    assert.ok(before.step <= piece.math.stepLimit);
    assert.equal(before.step, { 0.03: 182, 0.08: 67, 0.18: 28 }[rate]);
    assert.ok(Math.hypot(...piece.math.gradient(before.w1, before.w2)) < piece.math.gradientTolerance);
    frame(1000000);
    assert.deepEqual(frame.getMetrics(), before);
  }
});

test('frame cadence does not change optimization, and rewind reproduces its trajectory', () => {
  const direct = piece.create();
  const gradual = piece.create();
  const expected = direct(2);
  for (let tick = 0; tick <= 40; tick++) gradual(tick / 20);
  assert.deepEqual(gradual.getMetrics(), direct.getMetrics());
  assert.equal(gradual(2), expected);
  gradual(0);
  assert.equal(gradual.getMetrics().step, 0);
  assert.equal(gradual(2), expected);
});

test('changing learning rate resets the same start and a zero-time frame makes no update', () => {
  const frame = piece.create();
  const initial = frame(0);
  const start = frame.getMetrics();
  frame(0.124);
  assert.equal(frame.getMetrics().step, 0);
  frame(0.125);
  assert.equal(frame.getMetrics().step, 1);
  frame.setLearningRate(0.18);
  assert.equal(frame.getMetrics().step, 0);
  assert.equal(frame.getMetrics().w1, start.w1);
  assert.equal(frame.getMetrics().w2, start.w2);
  assert.equal(frame.getMetrics().learningRate, 0.18);
  assert.equal(frame(0), initial);
  assert.throws(() => frame.setLearningRate(2), /Learning rate/);
  assert.throws(() => frame(NaN), /Frame time/);
});

test('dense dot terrain fits the frame and keeps the moving learner visible', () => {
  const frame = piece.create();
  const colors = new Uint8Array(piece.meta.cols * piece.meta.rows);
  const start = frame(0, { color: colors });
  const next = frame(1, { color: colors });
  const rows = next.split('\n');
  assert.equal(rows.length, piece.meta.rows);
  assert.ok(rows.every(row => row.length === piece.meta.cols));
  assert.notEqual(start, next);
  assert.match(next, /^[ ·•●\n]+$/u);
  assert.equal(rows[0].trim(), '');
  assert.equal(rows[rows.length - 1].trim(), '');
  assert.ok(next.replace(/[ \n]/g, '').length > piece.meta.cols * piece.meta.rows / 3);
  assert.ok([...colors].every(index => index < piece.meta.palette.length));
  assert.ok(new Set(colors).size > 20);
  const white = piece.meta.palette.indexOf('#ffffff');
  const trailColors = ['#9d573b', '#c27b43', '#e5a251', '#ffd38a'].map(color => piece.meta.palette.indexOf(color));
  for (const time of [0, 0.5, 2, 100]) {
    frame(time, { color: colors });
    assert.ok(colors.includes(white));
    if (time > 0) assert.ok(colors.some(color => trailColors.includes(color)));
  }
});
