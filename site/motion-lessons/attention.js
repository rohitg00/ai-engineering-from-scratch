(function () {
  'use strict';

  var tokens = ['The', 'robot', 'lifted', 'the', 'red', 'box'];
  var queries = [[1, 0], [0, 2], [1, 1], [0.5, 0], [2, 0], [2, 1]];
  var keys = [[0.1, 0.1], [0, 2], [1, 1], [0.1, 0], [2, 0], [2, 1]];
  var values = [[0.1, 0.2], [0.2, 0.9], [0.7, 0.4], [0.1, 0.1], [1, 0.1], [0.9, 0.8]];
  var meta = {
    name: 'Where does this token look?',
    note: 'Synthetic Q/K/V: score every key, normalize the row, then blend the values.',
    cols: 128, rows: 40, cell: 2, fps: 20, ground: '#050505',
    palette: ['#484848', '#686868', '#888888', '#a4a4a4', '#bdbdbd', '#d0d0d0', '#e4e4e4', '#f4f4f4', '#ffffff']
  };

  function softmax(scores) {
    if (!scores.length || !Array.from(scores).every(Number.isFinite)) throw new Error('Softmax requires finite scores');
    var maximum = Math.max.apply(null, scores);
    var weights = Array.from(scores, function (score) { return Math.exp(score - maximum); });
    var total = weights.reduce(function (sum, weight) { return sum + weight; }, 0);
    return weights.map(function (weight) { return weight / total; });
  }

  function attention(query, keyVectors, valueVectors, temperature) {
    var scores = keyVectors.map(function (key) {
      return query.reduce(function (sum, value, index) { return sum + value * key[index]; }, 0) / Math.sqrt(query.length);
    });
    var weights = softmax(scores.map(function (score) { return score / temperature; }));
    var output = valueVectors[0].map(function (_, component) {
      return weights.reduce(function (sum, weight, index) { return sum + weight * valueVectors[index][component]; }, 0);
    });
    return { scores: scores, weights: weights, output: output };
  }

  function create() {
    var tokenIndex = 5;
    var temperature = 1;
    var matrix = new Float64Array(36);
    var scores = new Float64Array(36);
    var outputs = new Float64Array(12);
    var glyphs = new Uint16Array(meta.cols * meta.rows);
    var colors = new Uint8Array(glyphs.length);
    var depth = new Float32Array(glyphs.length);
    var light = new Float32Array(glyphs.length);
    var distance = new Float32Array(glyphs.length);
    var surfaceWeight = new Float32Array(glyphs.length);
    var lines = new Array(meta.rows);
    var geometryKey = '';

    function calculate() {
      queries.forEach(function (query, row) {
        var result = attention(query, keys, values, temperature);
        matrix.set(result.weights, row * 6);
        scores.set(result.scores, row * 6);
        outputs.set(result.output, row * 2);
      });
    }

    function center(branch, position) {
      if (branch === 6) {
        return [2.3 + 1.05 * position, 0.06 * Math.sin(position * Math.PI), 0.08 * position];
      }
      var arc = Math.sin(Math.PI * position);
      var sourceY = (2.5 - branch) * 0.66;
      return [
        -3.25 + 5.55 * position,
        sourceY * (1 - Math.pow(position, 1.75)) + 0.14 * arc * Math.sin(branch * 0.8 + position * 3),
        arc * (0.13 * (branch - 2.5) + 0.34 * Math.sin(position * Math.PI * 2 + branch * 0.7))
      ];
    }

    function sample(x, y, z, nx, ny, nz, along, weight) {
      var column = Math.round(64 + x * 17 + z * 2);
      var row = Math.round(19.5 - y * 9.3 + z * 2.2);
      if (column < 0 || column >= meta.cols || row < 0 || row >= meta.rows) return;
      var index = row * meta.cols + column;
      var cameraDepth = z + y * 0.08;
      if (cameraDepth <= depth[index]) return;
      depth[index] = cameraDepth;
      var diffuse = Math.max(0, (-0.35 * nx + 0.55 * ny + nz) / 1.194);
      var specular = Math.pow(Math.max(0, -0.17 * nx + 0.27 * ny + 0.947 * nz), 16);
      light[index] = (0.24 + 0.68 * diffuse + 0.2 * specular) * (0.48 + 0.52 * Math.sqrt(weight));
      distance[index] = along;
      surfaceWeight[index] = weight;
    }

    function buildGeometry() {
      depth.fill(-Infinity);
      for (var branch = 0; branch < 7; branch++) {
        var weight = branch === 6 ? 1 : matrix[tokenIndex * 6 + branch];
        // The minimum radius keeps very small contributions visible as thin wires.
        var radius = 0.035 + 0.25 * Math.sqrt(weight);
        var samples = branch === 6 ? 70 : 280;
        for (var step = 0; step <= samples; step++) {
          var position = step / samples;
          var point = center(branch, position);
          var before = center(branch, Math.max(0, position - 0.001));
          var after = center(branch, Math.min(1, position + 0.001));
          var tx = after[0] - before[0], ty = after[1] - before[1], tz = after[2] - before[2];
          var length = Math.hypot(tx, ty, tz);
          tx /= length; ty /= length; tz /= length;
          var across = Math.hypot(tx, ty);
          var ax = -ty / across, ay = tx / across;
          var bx = -tz * ay, by = tz * ax, bz = tx * ay - ty * ax;
          var along = branch === 6 ? 1 + position * 0.3 : position;
          for (var ring = 0; ring < 40; ring++) {
            var angle = ring * Math.PI / 20;
            var cosine = Math.cos(angle), sine = Math.sin(angle);
            var nx = ax * cosine + bx * sine, ny = ay * cosine + by * sine, nz = bz * sine;
            sample(point[0] + radius * nx, point[1] + radius * ny, point[2] + radius * nz, nx, ny, nz, along, weight);
          }
        }
      }
      geometryKey = tokenIndex + ':' + temperature;
    }

    function frame(time, environment) {
      var ink = environment && environment.color || colors;
      if (ink.length !== glyphs.length) throw new Error('Attention color buffer has the wrong size');
      if (geometryKey !== tokenIndex + ':' + temperature) buildGeometry();
      glyphs.fill(32);
      ink.fill(0);
      var packet = Math.max(0, time) * 0.26 % 1.5;
      var ramp = '.:-=+*#%@';
      for (var pixel = 0; pixel < glyphs.length; pixel++) {
        if (depth[pixel] === -Infinity) continue;
        var separation = Math.abs(distance[pixel] - packet);
        separation = Math.min(separation, 1.5 - separation);
        var pulse = Math.exp(-separation * separation / 0.0024);
        var intensity = Math.min(1, light[pixel] + pulse * (0.25 + 0.3 * Math.sqrt(surfaceWeight[pixel])));
        var level = Math.min(8, Math.floor(intensity * 9));
        glyphs[pixel] = ramp.charCodeAt(level);
        ink[pixel] = level;
      }
      for (var line = 0; line < meta.rows; line++) {
        lines[line] = String.fromCharCode.apply(null, glyphs.subarray(line * meta.cols, (line + 1) * meta.cols));
      }
      return lines.join('\n');
    }

    frame.setToken = function (index) {
      if (!Number.isInteger(index) || index < 0 || index >= tokens.length) throw new Error('Choose a token from 0 to 5');
      tokenIndex = index;
    };
    frame.setTemperature = function (value) {
      if ([0.5, 1, 2].indexOf(value) === -1) throw new Error('Temperature must be 0.5, 1, or 2');
      temperature = value;
      calculate();
    };
    frame.getMetrics = function () {
      return {
        tokenIndex: tokenIndex, tokens: tokens.slice(), temperature: temperature,
        scores: Array.from(scores.subarray(tokenIndex * 6, tokenIndex * 6 + 6)),
        weights: Array.from(matrix.subarray(tokenIndex * 6, tokenIndex * 6 + 6)),
        output: Array.from(outputs.subarray(tokenIndex * 2, tokenIndex * 2 + 2)),
        queries: queries.map(function (query) { return query.slice(); }),
        keys: keys.map(function (key) { return key.slice(); }),
        values: values.map(function (value) { return value.slice(); })
      };
    };
    calculate();
    return frame;
  }

  window.CourseMotionPieces = window.CourseMotionPieces || {};
  window.CourseMotionPieces.agent = { meta: meta, create: create, math: { softmax: softmax, attention: attention } };
})();
