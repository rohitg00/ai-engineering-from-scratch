(function () {
  'use strict';

  var COLS = 216, ROWS = 108;
  var START = [-1.9, 1.7];
  var RATES = [0.03, 0.08, 0.18];
  var LIMIT = 200;
  var TOLERANCE = 0.01;
  var DOTS = ' ·•●';
  var COVERAGE = [0, 0.3, 0.6, 1];
  var ORDER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var HUES = [[20, 79, 132], [39, 171, 191], [93, 111, 205], [173, 120, 197], [246, 184, 120]];
  var PALETTE = [];
  for (var hue = 0; hue < 32; hue++) {
    var blend = hue / 31 * (HUES.length - 1);
    var low = Math.min(HUES.length - 2, Math.floor(blend));
    for (var shade = 0; shade < 6; shade++) {
      var channels = HUES[low].map(function (value, channel) {
        var mixed = value + (HUES[low + 1][channel] - value) * (blend - low);
        return Math.min(255, Math.round(mixed * (0.36 + shade * 0.15))).toString(16).padStart(2, '0');
      });
      PALETTE.push('#' + channels.join(''));
    }
  }
  var TRAIL = PALETTE.length;
  PALETTE.push('#9d573b', '#c27b43', '#e5a251', '#ffd38a', '#b9f4f5', '#ffffff');
  var WHITE = PALETTE.length - 1;
  var terrain;
  var meta = {
    name: 'Gradient descent on a loss landscape', cols: COLS, rows: ROWS, cell: 1, fps: 20,
    note: 'Height is loss. The white point is the current weights; the amber trail records gradient updates.',
    ground: '#05080f', palette: PALETTE
  };

  function loss(w1, w2) {
    return (w1 - 1) * (w1 - 1) + 0.5 * (w2 + 0.8) * (w2 + 0.8) + 0.2 * Math.pow(Math.sin(2 * w1), 2);
  }

  function gradient(w1, w2) {
    return [2 * (w1 - 1) + 0.4 * Math.sin(4 * w1), w2 + 0.8];
  }

  function project(w1, w2, height) {
    var x = w1 - 0.6, y = w2 + 0.1;
    var across = (x - y) * Math.SQRT1_2;
    var along = (x + y) * Math.SQRT1_2;
    return { x: 108 + across * 25, y: 73 + along * 11.8 - height * 2.2, depth: along * 0.8816 + height * 0.0471 };
  }

  function buildTerrain() {
    var count = COLS * ROWS;
    var glyphs = new Array(count).fill(' ');
    var colors = new Uint8Array(count);
    var depth = new Float32Array(count).fill(-Infinity);
    var heights = new Float32Array(count);
    var lights = new Float32Array(count);
    var rings = 96, sectors = 288, radius = 3.45;
    var vertices = [];

    function vertex(w1, w2) {
      var height = loss(w1, w2);
      var point = project(w1, w2, height);
      var slope = gradient(w1, w2);
      var nx = -0.0998 * slope[0], ny = -0.0998 * slope[1];
      var length = Math.hypot(nx, ny, 1);
      var diffuse = Math.max(0, (-0.55 * nx - 0.38 * ny + 0.744) / length);
      point.height = height;
      point.light = 0.22 + 0.78 * diffuse;
      return point;
    }

    function triangle(a, b, c) {
      var area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(area) < 0.000001) return;
      var minX = Math.max(0, Math.ceil(Math.min(a.x, b.x, c.x)));
      var maxX = Math.min(COLS - 1, Math.floor(Math.max(a.x, b.x, c.x)));
      var minY = Math.max(0, Math.ceil(Math.min(a.y, b.y, c.y)));
      var maxY = Math.min(ROWS - 1, Math.floor(Math.max(a.y, b.y, c.y)));
      for (var y = minY; y <= maxY; y++) {
        for (var x = minX; x <= maxX; x++) {
          var u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / area;
          var v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / area;
          var w = 1 - u - v;
          if (u < -0.00001 || v < -0.00001 || w < -0.00001) continue;
          var z = u * a.depth + v * b.depth + w * c.depth;
          var index = y * COLS + x;
          if (z < depth[index]) continue;
          depth[index] = z;
          heights[index] = u * a.height + v * b.height + w * c.height;
          lights[index] = u * a.light + v * b.light + w * c.light;
        }
      }
    }

    for (var ring = 0; ring <= rings; ring++) {
      for (var sector = 0; sector < sectors; sector++) {
        var angle = sector / sectors * Math.PI * 2;
        var r = radius * ring / rings;
        vertices.push(vertex(0.6 + r * Math.cos(angle), -0.1 + r * Math.sin(angle)));
      }
    }
    for (var row = 0; row < rings; row++) {
      for (var col = 0; col < sectors; col++) {
        var next = (col + 1) % sectors;
        var a = vertices[row * sectors + col];
        var b = vertices[row * sectors + next];
        var c = vertices[(row + 1) * sectors + col];
        var d = vertices[(row + 1) * sectors + next];
        triangle(a, c, d);
        triangle(a, d, b);
      }
    }

    for (var index = 0; index < count; index++) {
      if (depth[index] === -Infinity) continue;
      var x = index % COLS, y = Math.floor(index / COLS);
      var threshold = (ORDER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      var light = Math.min(1, lights[index]);
      var level = 0.28 + 0.65 * light;
      var dot = Math.min(3, Math.floor(level * 3 + threshold));
      glyphs[index] = DOTS[dot];
      if (!dot) continue;
      // Smaller dots need brighter ink to retain the same shaded surface value.
      var brightness = Math.min(1.11, level / COVERAGE[dot]);
      var shade = Math.max(0, Math.min(5, Math.round((brightness - 0.36) / 0.15)));
      var hue = Math.max(0, Math.min(31, Math.floor(heights[index] / 18 * 31 + threshold)));
      colors[index] = hue * 6 + shade;
    }
    return { glyphs: glyphs, colors: colors, depth: depth };
  }

  function create() {
    if (!terrain) terrain = buildTerrain();
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
      var output = terrain.glyphs.slice();
      var colors = environment && environment.color;
      if (colors) colors.set(terrain.colors);

      function overlay(point, glyph, tint, offsetX, offsetY) {
        var x = Math.round(point.x + (offsetX || 0)), y = Math.round(point.y + (offsetY || 0));
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
        var index = y * COLS + x;
        if (point.depth < terrain.depth[index] - 0.15) return;
        output[index] = glyph;
        if (colors) colors[index] = tint;
      }

      for (var i = 1; i < trajectory.length; i++) {
        var before = trajectory[i - 1], after = trajectory[i];
        var samples = Math.max(2, Math.ceil(Math.hypot(after[0] - before[0], after[1] - before[1]) * 55));
        var tint = TRAIL + Math.min(3, Math.floor(i / trajectory.length * 4));
        for (var j = 0; j <= samples; j++) {
          var f = j / samples;
          var x = before[0] + (after[0] - before[0]) * f;
          var y = before[1] + (after[1] - before[1]) * f;
          overlay(project(x, y, loss(x, y)), '•', tint);
        }
      }

      var origin = project(START[0], START[1], loss(START[0], START[1]));
      overlay(origin, '•', TRAIL + 2);
      var traveler = project(weights[0], weights[1], loss(weights[0], weights[1]));
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          var distance = Math.hypot(dx, dy);
          if (distance > 2.1) continue;
          if (distance > 1.5) overlay(traveler, '·', WHITE - 1, dx, dy);
          else if (distance > 1) overlay(traveler, '•', WHITE, dx, dy);
          else overlay(traveler, '●', WHITE, dx, dy);
        }
      }
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
