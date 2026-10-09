const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'motion-lessons/attention.js'), 'utf8'), { window });
const piece = window.CourseMotionPieces.agent;

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should equal ${expected}`);
}

test('stable softmax handles large scores and is invariant to a common offset', () => {
  const large = piece.math.softmax([10000, 10001, 9999]);
  const small = piece.math.softmax([0, 1, -1]);
  large.forEach((weight, index) => near(weight, small[index]));
  near(large.reduce((sum, weight) => sum + weight, 0), 1);
  assert.ok(large.every(Number.isFinite));
  assert.throws(() => piece.math.softmax([Infinity, 1]));
});

test('scaled dot products and weighted values match a hand-computable example', () => {
  const result = piece.math.attention([2, 0], [[1, 0], [0, 1]], [[1, 3], [5, 7]], 1);
  near(result.scores[0], Math.sqrt(2));
  near(result.scores[1], 0);
  const firstWeight = Math.exp(Math.sqrt(2)) / (Math.exp(Math.sqrt(2)) + 1);
  near(result.weights[0], firstWeight);
  near(result.output[0], firstWeight + (1 - firstWeight) * 5);
  near(result.output[1], firstWeight * 3 + (1 - firstWeight) * 7);
});

test('every selectable query has a normalized row and the matching weighted output', () => {
  const frame = piece.create();
  for (const temperature of [0.5, 1, 2]) {
    frame.setTemperature(temperature);
    for (let index = 0; index < 6; index++) {
      frame.setToken(index);
      const metrics = frame.getMetrics();
      assert.equal(metrics.tokenIndex, index);
      near(metrics.weights.reduce((sum, weight) => sum + weight, 0), 1);
      assert.ok(metrics.weights.every(weight => weight >= 0 && weight <= 1));
      metrics.output.forEach((value, component) => {
        near(value, metrics.weights.reduce((sum, weight, key) => sum + weight * metrics.values[key][component], 0));
      });
      metrics.scores.forEach((score, key) => {
        near(score, metrics.queries[index].reduce((sum, value, component) => sum + value * metrics.keys[key][component], 0) / Math.sqrt(2));
      });
    }
  }
});

test('query selection changes the result and hotter temperature spreads the same scores', () => {
  const frame = piece.create();
  const box = frame.getMetrics();
  frame.setToken(1);
  const robot = frame.getMetrics();
  assert.notDeepEqual(robot.output, box.output);
  assert.notDeepEqual(robot.weights, box.weights);
  frame.setTemperature(0.5);
  const cold = frame.getMetrics();
  frame.setTemperature(2);
  const hot = frame.getMetrics();
  assert.deepEqual(cold.scores, hot.scores);
  assert.ok(Math.max(...cold.weights) > Math.max(...hot.weights));
  assert.throws(() => frame.setToken(6));
  assert.throws(() => frame.setTemperature(0));
});

test('weighted stream frames are deterministic, animated, monochrome, and independent of metrics mutation', () => {
  const frame = piece.create();
  const color = new Uint8Array(piece.meta.cols * piece.meta.rows);
  const still = frame(0, { color });
  const firstColors = color.slice();
  const animated = frame(0.75, { color });
  assert.notEqual(still, animated);
  assert.equal(frame(0, { color }), still);
  assert.deepEqual(color, firstColors);
  assert.equal(piece.create()(0), still);
  const lines = still.split('\n');
  assert.equal(lines.length, piece.meta.rows);
  assert.ok(lines.every(line => line.length === piece.meta.cols));
  assert.ok(new Set(color).size > 4);
  assert.ok(color.every(index => index < piece.meta.palette.length));
  assert.match(still, /^[ .:\-=+*#%@\n]+$/);
  assert.ok(piece.meta.palette.every(color => color.slice(1, 3) === color.slice(3, 5) && color.slice(3, 5) === color.slice(5, 7)));
  const metrics = frame.getMetrics();
  metrics.values[0][0] = 999;
  metrics.weights[0] = 999;
  assert.equal(frame(0), still);
  assert.notEqual(frame.getMetrics().values[0][0], 999);
  frame.setToken(1);
  assert.notEqual(frame(0), still);
  frame.setToken(5);
  assert.equal(frame(0), still);
});
