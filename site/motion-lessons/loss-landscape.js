(function () {
  'use strict';

  var COLS = 120, ROWS = 60;
  var START = [-1.9, 1.7];
  var RATES = [0.03, 0.08, 0.18];
  var LIMIT = 200;
  var TOLERANCE = 0.01;
  var meta = {
    name: 'Gradient descent on a loss landscape', cols: COLS, rows: ROWS, cell: 1, fps: 20,
    note: 'Height is loss. The white point is the current weights; the amber trail records gradient updates.',
    ground: '#05080f',
    palette: ['#122636', '#15475b', '#236c80', '#3695a9', '#67c9d5', '#a4eeec', '#d9fff3', '#342b58', '#68518e', '#a981c6', '#d2abdb', '#86603e', '#daa55f', '#ffd27a', '#fff7df', '#3e687b']
  };

  function loss(w1, w2) {
    return (w1 - 1) * (w1 - 1) + 0.5 * (w2 + 0.8) * (w2 + 0.8) + 0.2 * Math.pow(Math.sin(2 * w1), 2);
  }

  function gradient(w1, w2) {
    return [2 * (w1 - 1) + 0.4 * Math.sin(4 * w1), w2 + 0.8];
  }

  function project(w1, w2, height) {
    var x = w1 - 0.25, y = w2 + 0.35;
    var across = (x - y) * Math.SQRT1_2;
    var along = (x + y) * Math.SQRT1_2;
    return { x: 60 + across * 14, y: 40 + along * 4.5 - height * 1.4, depth: along * 0.815 + height * 0.127 };
  }

  function create() {
    var base = new Array(COLS * ROWS).fill(' ');
    var baseColor = new Uint8Array(COLS * ROWS);
    var depth = new Float32Array(COLS * ROWS).fill(-Infinity);
    var ramp = '.:-=+*#%';

    function cell(point, glyph, color) {
      var x = Math.round(point.x), y = Math.round(point.y);
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
      var index = y * COLS + x;
      if (point.depth < depth[index]) return;
      depth[index] = point.depth;
      base[index] = glyph;
      baseColor[index] = color;
    }

    for (var line = 0; line <= 10; line++) {
      for (var p = 0; p <= 150; p++) {
        var a = -2.5 + 5.5 * line / 10, b = -3.1 + 5.5 * p / 150;
        cell(project(a, b, -0.1), '.', 0);
        cell(project(-2.5 + 5.5 * p / 150, -3.1 + 5.5 * line / 10, -0.1), '.', 0);
      }
    }

    for (var row = 0; row <= 196; row++) {
      for (var col = 0; col <= 196; col++) {
        var w1 = -2.5 + 5.5 * col / 196, w2 = -3.1 + 5.5 * row / 196;
        var height = loss(w1, w2);
        var slope = gradient(w1, w2);
        var nx = -0.22 * slope[0], ny = -0.22 * slope[1];
        var light = Math.max(0.12, Math.min(1, 0.22 + 0.78 * (-0.45 * nx - 0.6 * ny + 1) / (1.25 * Math.hypot(nx, ny, 1))));
        var mesh = col % 14 === 0 || row % 14 === 0;
        var tint;
        if (height < 3.3) tint = 1 + Math.floor(light * 5);
        else if (height < 10.5) tint = 7 + Math.floor(light * 3);
        else tint = 11 + Math.floor(light * 1.9);
        cell(project(w1, w2, height), mesh ? '+' : ramp[Math.min(7, Math.floor(light * 8))], tint);
      }
    }

    var weights, step, done, trajectory;
    var learningRate = 0.08;

    function reset() {
      weights = START.slice();
      step = 0;
      done = false;
      trajectory = [weights.slice()];
      return getMetrics();
    }

    function getMetrics() {
      return { loss: loss(weights[0], weights[1]), step: step, w1: weights[0], w2: weights[1], learningRate: learningRate, done: done };
    }

    function update() {
      var derivatives = gradient(weights[0], weights[1]);
      weights[0] -= learningRate * derivatives[0];
      weights[1] -= learningRate * derivatives[1];
      step++;
      trajectory.push(weights.slice());
      var next = gradient(weights[0], weights[1]);
      done = Math.hypot(next[0], next[1]) < TOLERANCE || step >= LIMIT;
    }

    function frame(time, environment) {
      if (!Number.isFinite(time) || time < 0) throw new Error('Frame time must be a nonnegative finite number');
      var target = Math.min(LIMIT, Math.floor(time * 8 + 1e-9));
      if (target < step) reset();
      while (step < target && !done) update();
      var output = base.slice();
      var colors = environment && environment.color;
      if (colors) colors.set(baseColor);

      function overlay(point, glyph, tint, always) {
        var x = Math.round(point.x), y = Math.round(point.y);
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
        var index = y * COLS + x;
        // The small depth allowance keeps a surface annotation above raster rounding.
        if (!always && point.depth < depth[index] - 0.18) return;
        output[index] = glyph;
        if (colors) colors[index] = tint;
      }

      for (var i = 1; i < trajectory.length; i++) {
        var before = trajectory[i - 1], after = trajectory[i];
        var samples = Math.max(2, Math.ceil(Math.hypot(after[0] - before[0], after[1] - before[1]) * 32));
        for (var j = 0; j <= samples; j++) {
          var f = j / samples;
          var x = before[0] + (after[0] - before[0]) * f;
          var y = before[1] + (after[1] - before[1]) * f;
          overlay(project(x, y, loss(x, y)), '.', 13, false);
        }
      }

      var origin = project(START[0], START[1], loss(START[0], START[1]));
      overlay(origin, '○', 13, true);
      var traveler = project(weights[0], weights[1], loss(weights[0], weights[1]));
      overlay({ x: traveler.x - 1, y: traveler.y, depth: traveler.depth }, '·', 13, true);
      overlay({ x: traveler.x + 1, y: traveler.y, depth: traveler.depth }, '·', 13, true);
      overlay({ x: traveler.x, y: traveler.y - 1, depth: traveler.depth }, '·', 13, true);
      overlay({ x: traveler.x, y: traveler.y + 1, depth: traveler.depth }, '·', 13, true);
      overlay(traveler, '●', 14, true);
      var lines = [];
      for (var r = 0; r < ROWS; r++) lines.push(output.slice(r * COLS, (r + 1) * COLS).join(''));
      return lines.join('\n');
    }

    frame.getMetrics = getMetrics;
    frame.setLearningRate = function (value) {
      value = Number(value);
      if (RATES.indexOf(value) < 0) throw new Error('Learning rate must be 0.03, 0.08, or 0.18');
      learningRate = value;
      return reset();
    };
    frame.reset = reset;
    reset();
    return frame;
  }

  window.CourseMotionPieces = window.CourseMotionPieces || {};
  window.CourseMotionPieces.signal = {
    meta: meta, create: create,
    math: { loss: loss, gradient: gradient, learningRates: RATES.slice(), stepLimit: LIMIT, gradientTolerance: TOLERANCE }
  };
})();
