(function () {
  'use strict';

  var tokens = ['The', 'robot', 'lifted', 'the', 'red', 'box'];
  var queries = [[1, 0], [0, 2], [1, 1], [0.5, 0], [2, 0], [2, 1]];
  var keys = [[0.1, 0.1], [0, 2], [1, 1], [0.1, 0], [2, 0], [2, 1]];
  var values = [[0.1, 0.2], [0.2, 0.9], [0.7, 0.4], [0.1, 0.1], [1, 0.1], [0.9, 0.8]];
  var meta = {
    name: 'Where does this token look?',
    note: 'Synthetic Q/K/V: score every key, normalize the row, then blend the values.',
    cols: 96, rows: 32, cell: 2, fps: 20, ground: '#05080f',
    palette: ['#15283f', '#57718e', '#a6b6cc', '#edf6ff', '#25566a', '#43849b', '#5eead4', '#c2fff4', '#9582d7', '#e0caff', '#ffc76b']
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
    var lines = new Array(meta.rows);
    var ink = colors;

    function calculate() {
      queries.forEach(function (query, row) {
        var result = attention(query, keys, values, temperature);
        matrix.set(result.weights, row * 6);
        scores.set(result.scores, row * 6);
        outputs.set(result.output, row * 2);
      });
    }

    function put(x, y, character, color) {
      if (x < 0 || x >= meta.cols || y < 0 || y >= meta.rows) return;
      var index = y * meta.cols + x;
      glyphs[index] = character.charCodeAt(0);
      ink[index] = color;
    }

    function write(x, y, text, color) {
      for (var index = 0; index < text.length; index++) put(x + index, y, text[index], color);
    }

    function vector(numbers, digits) {
      return '[' + numbers.map(function (number) { return number.toFixed(digits); }).join(', ') + ']';
    }

    function frame(time, environment) {
      ink = environment && environment.color || colors;
      if (ink.length !== glyphs.length) throw new Error('Attention color buffer has the wrong size');
      glyphs.fill(32);
      ink.fill(0);
      var phase = Math.max(0, time) % 6;
      var activeKey = Math.floor(phase);
      var progress = phase - activeKey;
      var selectedStart = tokenIndex * 6;
      var partial = [0, 0];

      write(3, 0, 'SELF-ATTENTION / ONE HEAD / NO CAUSAL MASK', 3);
      write(3, 2, 'Synthetic Q/K/V   query: ' + tokens[tokenIndex] + ' ' + vector(queries[tokenIndex], 1) + '   T=' + temperature, 2);
      write(3, 4, '01 / SOFTMAX ATTENTION MATRIX', 6);
      write(68, 4, '02 / WEIGHT x VALUE', 10);
      for (var column = 0; column < 6; column++) {
        write(14 + column * 8, 6, tokens[column], column === activeKey ? 7 : 2);
      }
      for (var row = 0; row < 6; row++) {
        var y = 8 + row * 3;
        var selected = row === tokenIndex;
        write(3, y, tokens[row], selected ? 7 : 2);
        if (selected) write(10, y, '->', 7);
        for (var key = 0; key < 6; key++) {
          var weight = matrix[row * 6 + key];
          var strength = Math.min(5, Math.floor(Math.sqrt(weight) * 7));
          var character = '.:+*#@'[strength];
          var cellColor = selected ? 6 : 4 + Math.min(1, Math.floor(weight * 3));
          var x = 14 + key * 8;
          for (var dy = 0; dy < 2; dy++) {
            for (var dx = 0; dx < 7; dx++) {
              put(x + dx, y + dy, character, cellColor);
            }
          }
          write(x + 1, y + 2, weight.toFixed(3), selected ? 7 : 1);
          if (selected && key === activeKey) put(x + Math.min(6, Math.floor(progress * 7)), y, '@', 3);
        }
      }

      for (var index = 0; index < 6; index++) {
        var contribution = [0, 0];
        var selectedWeight = matrix[selectedStart + index];
        var rowY = 8 + index * 3;
        var contributionColor = index === activeKey ? 10 : 2;
        for (var component = 0; component < 2; component++) {
          contribution[component] = selectedWeight * values[index][component];
          if (index < activeKey) partial[component] += contribution[component];
          if (index === activeKey) partial[component] += progress * contribution[component];
        }
        write(68, rowY, tokens[index] + '  ' + (selectedWeight * 100).toFixed(1) + '%', contributionColor);
        write(68, rowY + 1, 'x ' + vector(values[index], 1), contributionColor);
        write(68, rowY + 2, '= ' + vector(contribution, 3), index === activeKey ? 3 : 1);
      }

      var fromY = 8 + tokenIndex * 3;
      var toY = 8 + activeKey * 3;
      for (var routeY = Math.min(fromY, toY); routeY <= Math.max(fromY, toY); routeY++) put(64, routeY, '|', 5);
      write(62, fromY, '--+', 6);
      write(64, toY, '+->', 10);
      for (var divider = 3; divider < 93; divider++) put(divider, 27, '-', 0);
      write(3, 28, '03 / FULL OUTPUT = ' + vector(Array.from(outputs.subarray(tokenIndex * 2, tokenIndex * 2 + 2)), 3), 7);
      write(63, 28, 'ROW WEIGHTS SUM TO 1', 2);
      write(3, 30, 'Animated partial sum: ' + vector(partial, 3), 10);
      write(57, 30, 'Denser marks = higher weight', 1);
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
