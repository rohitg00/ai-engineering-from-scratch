/* figures-ml.js — interactive, theme-aware lesson figures for Phase 2 (classical ML).
   Loads after lesson-figures.js and registers widgets via LF.register({...}).
   Vanilla ES5, no deps, theme via CSS vars. Same fenced-block authoring:
       ```figure
       linear-regression-fit
       ```  */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, select = LF.select;

  // ── linear-regression-fit: drag slope + intercept, watch the MSE ───────────
  function linearRegressionFit(host) {
    // fixed scatter of 12 points along y ≈ 0.7x + 1.4 with deterministic jitter
    var X = [0.4, 1.1, 1.8, 2.3, 3.0, 3.6, 4.2, 5.0, 5.7, 6.4, 7.1, 7.8];
    var Y = [2.0, 1.9, 2.9, 2.7, 3.8, 3.5, 4.6, 4.4, 5.7, 5.3, 6.5, 6.2];
    var state = { m: 0.7, b: 1.4 };
    var W = 520, H = 230, PAD = 32, XMAX = 8.4, YMAX = 7.5;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(x) { return PAD + x / XMAX * (W - 2 * PAD); }
    function py(y) { return H - PAD - y / YMAX * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var se = 0, i;
      for (i = 0; i < X.length; i++) {
        var pred = state.m * X[i] + state.b;
        se += (Y[i] - pred) * (Y[i] - pred);
        svg.appendChild(svgEl('line', { x1: px(X[i]), y1: py(Y[i]), x2: px(X[i]), y2: py(pred), stroke: 'var(--warn,#b8870f)', 'stroke-width': '1', opacity: '0.7' }));
      }
      var x1 = 0, x2 = XMAX;
      svg.appendChild(svgEl('line', { x1: px(x1), y1: py(state.m * x1 + state.b), x2: px(x2), y2: py(state.m * x2 + state.b), stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      for (i = 0; i < X.length; i++) { svg.appendChild(svgEl('circle', { cx: px(X[i]), cy: py(Y[i]), r: '4', fill: 'var(--ink,#1a1a1a)' })); }
      var mse = se / X.length;
      status.innerHTML = 'MSE = ' + mse.toFixed(3);
      meta.textContent = 'line y = ' + state.m.toFixed(2) + 'x + ' + state.b.toFixed(2) + '  ·  ' + X.length + ' points  ·  orange bars are residuals';
      formula.textContent = 'MSE = (1/n) Σ (yᵢ − (m·xᵢ + b))²   ·   least squares finds the m, b that minimize it';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'm', 'slope m', -0.5, 2.0, 0.01),
      slider(state, 'b', 'intercept b', -2.0, 5.0, 0.05)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LINEAR REGRESSION FIT']), el('span', {}, ['drag slope and intercept'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each orange bar is a residual, the gap between a point and the line. Squaring and averaging them gives the mean squared error. Least squares is just the choice of slope and intercept that makes that average as small as possible.'])
    ]));
    state._render();
  }

  // ── logistic-sigmoid: drag w and b, find the decision boundary ─────────────
  function logisticSigmoid(host) {
    var state = { w: 1.5, b: 0.0 };
    var W = 520, H = 220, PAD = 32, XR = 6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function sig(x) { return 1 / (1 + Math.exp(-(state.w * x + state.b))); }
    function px(x) { return PAD + (x + XR) / (2 * XR) * (W - 2 * PAD); }
    function py(p) { return H - PAD - p * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0.5), x2: W - PAD, y2: py(0.5), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var d = '', i; for (i = 0; i <= 160; i++) { var x = -XR + 2 * XR * i / 160; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(sig(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var xb = state.w === 0 ? null : -state.b / state.w;
      if (xb !== null && xb > -XR && xb < XR) {
        svg.appendChild(svgEl('line', { x1: px(xb), y1: PAD, x2: px(xb), y2: H - PAD, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
        svg.appendChild(svgEl('circle', { cx: px(xb), cy: py(0.5), r: '4', fill: 'var(--warn,#b8870f)' }));
      }
      status.innerHTML = xb === null ? 'no boundary' : 'x* = ' + xb.toFixed(2) + ' <small>at p = 0.5</small>';
      meta.textContent = 'steepness grows with |w|  ·  the boundary shifts with b  ·  output is a probability in (0, 1)';
      formula.textContent = 's(x) = 1 / (1 + e^−(w·x + b))   ·   decision boundary where w·x + b = 0  →  x* = −b/w';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'w', 'weight w', -4, 4, 0.05),
      slider(state, 'b', 'bias b', -5, 5, 0.05)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LOGISTIC SIGMOID']), el('span', {}, ['drag w and b'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Logistic regression squashes a linear score through the sigmoid to get a probability. The weight controls how sharply the curve turns; the bias slides it left or right. The orange line is the decision boundary, where the probability crosses one half.'])
    ]));
    state._render();
  }

  // ── svm-margin: rotate the boundary, widen the street, mark support vectors ─
  function svmMargin(host) {
    // two linearly separable clusters (fixed). class +1 upper-right, class -1 lower-left
    var POS = [[6.0, 5.4], [6.8, 4.6], [5.4, 6.2], [7.2, 5.8], [6.4, 6.8], [7.8, 6.0]];
    var NEG = [[2.2, 3.0], [3.0, 2.2], [1.6, 2.4], [3.4, 3.2], [2.6, 1.6], [1.8, 3.6]];
    var state = { ang: 45, margin: 1.0 };
    var W = 520, H = 240, PAD = 30, AX = 9;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var CX = 4.6, CY = 4.0; // line passes through this midpoint
    function px(x) { return PAD + x / AX * (W - 2 * PAD); }
    function py(y) { return H - PAD - y / AX * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var rad = state.ang * Math.PI / 180;
      // unit normal to the boundary
      var nx = Math.cos(rad), ny = Math.sin(rad);
      // boundary direction (perpendicular to normal)
      var dx = -ny, dy = nx;
      function lineAt(off, stroke, dash) {
        var ox = CX + nx * off, oy = CY + ny * off;
        var L = 12;
        svg.appendChild(svgEl('line', {
          x1: px(ox - dx * L), y1: py(oy - dy * L), x2: px(ox + dx * L), y2: py(oy + dy * L),
          stroke: stroke, 'stroke-width': dash ? '1' : '2', 'stroke-dasharray': dash ? '4 3' : 'none'
        }));
      }
      lineAt(state.margin, 'var(--rule-soft,#bbb)', true);
      lineAt(-state.margin, 'var(--rule-soft,#bbb)', true);
      lineAt(0, 'var(--blueprint,#3553ff)', false);
      function dist(p) { return (p[0] - CX) * nx + (p[1] - CY) * ny; }
      var sv = 0, i, p, d;
      for (i = 0; i < POS.length; i++) {
        p = POS[i]; d = dist(p);
        var onP = Math.abs(d - state.margin) < 0.35;
        if (onP) sv++;
        svg.appendChild(svgEl('circle', { cx: px(p[0]), cy: py(p[1]), r: onP ? '6' : '4', fill: 'var(--blueprint,#3553ff)', stroke: onP ? 'var(--warn,#b8870f)' : 'none', 'stroke-width': '2' }));
      }
      for (i = 0; i < NEG.length; i++) {
        p = NEG[i]; d = dist(p);
        var onN = Math.abs(d + state.margin) < 0.35;
        if (onN) sv++;
        svg.appendChild(svgEl('circle', { cx: px(p[0]), cy: py(p[1]), r: onN ? '6' : '4', fill: 'var(--ink-mute,#999)', stroke: onN ? 'var(--warn,#b8870f)' : 'none', 'stroke-width': '2' }));
      }
      status.innerHTML = sv + ' <small>support vectors</small>';
      meta.textContent = 'margin width ' + (2 * state.margin).toFixed(2) + '  ·  points ringed in gold sit on the margin  ·  the wider the street, the better it generalizes';
      formula.textContent = 'maximize the margin 2/‖w‖ subject to yᵢ(w·xᵢ + b) ≥ 1   ·   only the support vectors define the boundary';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'ang', 'boundary angle', 0, 180, 1),
      slider(state, 'margin', 'margin width', 0.3, 2.5, 0.05)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SVM MARGIN']), el('span', {}, ['rotate the boundary, widen the street'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A support vector machine does not just separate the classes, it pushes the boundary as far from both as it can. The dashed lines mark the margin; the points touching them, ringed in gold, are the support vectors. Move every other point and nothing changes.'])
    ]));
    state._render();
  }

  // ── knn-smoothness: raise k, the probability curve smooths out ─────────────
  function knnSmoothness(host) {
    // 1D two-class points: x position, class (1 or 0). Deterministic layout.
    var PTS = [
      [0.6, 1], [1.0, 1], [1.4, 0], [1.8, 1], [2.3, 1], [2.7, 0], [3.1, 1],
      [3.6, 0], [4.0, 0], [4.5, 1], [4.9, 0], [5.3, 0], [5.8, 0], [6.2, 1],
      [6.7, 0], [7.1, 0], [7.6, 0], [8.0, 1]
    ];
    var state = { k: 3 };
    var W = 520, H = 220, PAD = 30, XMAX = 8.6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(x) { return PAD + x / XMAX * (W - 2 * PAD); }
    function py(p) { return H - PAD - p * (H - 2 * PAD); }
    function probAt(x, k) {
      var sorted = PTS.slice().sort(function (a, b) { return Math.abs(a[0] - x) - Math.abs(b[0] - x); });
      var s = 0, i; for (i = 0; i < k && i < sorted.length; i++) s += sorted[i][1];
      return s / Math.min(k, sorted.length);
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0.5), x2: W - PAD, y2: py(0.5), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var d = '', i; for (i = 0; i <= 200; i++) { var x = XMAX * i / 200; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(probAt(x, state.k)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      for (i = 0; i < PTS.length; i++) {
        svg.appendChild(svgEl('circle', { cx: px(PTS[i][0]), cy: py(PTS[i][1] ? 0.96 : 0.04), r: '4', fill: PTS[i][1] ? 'var(--blueprint,#3553ff)' : 'var(--ink-mute,#999)' }));
      }
      var regime = state.k <= 2 ? 'jagged · overfit' : state.k >= 11 ? 'flat · underfit' : 'balanced';
      status.innerHTML = 'k = ' + state.k + ' <small>· ' + regime + '</small>';
      meta.textContent = 'top dots are class 1, bottom dots class 0  ·  the curve is P(class 1) from the k nearest points';
      formula.textContent = 'P(y = 1 | x) = (fraction of class 1 among the k nearest)   ·   small k follows noise, large k washes it out';
    };
    var grid = el('div', {}, [slider(state, 'k', 'k (number of neighbors)', 1, 17, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['K-NN SMOOTHNESS']), el('span', {}, ['drag k'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['With k = 1 the prediction copies the nearest point exactly, so the curve is jagged and fits every quirk. Raising k averages over more neighbors, smoothing the boundary until, at very large k, it flattens toward the overall class rate and ignores local structure.'])
    ]));
    state._render();
  }

  // ── kmeans-step: step through Lloyd iterations, watch WCSS fall ────────────
  function kmeansStep(host) {
    // fixed 2D points in three loose blobs
    var PTS = [
      [1.8, 7.4], [2.4, 8.0], [1.4, 6.8], [2.8, 7.0], [2.0, 8.4], [1.2, 7.8],
      [7.6, 7.2], [8.2, 7.8], [7.0, 6.8], [8.6, 7.0], [7.8, 8.2], [8.0, 6.4],
      [4.4, 1.8], [5.0, 2.4], [3.8, 1.4], [5.4, 1.8], [4.0, 2.6], [4.8, 1.2]
    ];
    // start centroids deliberately off, so they migrate
    var INIT = [[3.5, 5.5], [6.0, 5.0], [5.0, 3.5]];
    var state = { iter: 0 };
    var W = 520, H = 240, PAD = 28, AX = 10;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var COLORS = ['var(--blueprint,#3553ff)', 'var(--warn,#b8870f)', 'var(--ink,#1a1a1a)'];
    function px(x) { return PAD + x / AX * (W - 2 * PAD); }
    function py(y) { return H - PAD - y / AX * (H - 2 * PAD); }
    // precompute Lloyd iterations deterministically (max 6 steps)
    function assign(cs) {
      var a = [], i, j;
      for (i = 0; i < PTS.length; i++) {
        var best = 0, bd = 1e9;
        for (j = 0; j < cs.length; j++) {
          var dx = PTS[i][0] - cs[j][0], dy = PTS[i][1] - cs[j][1], dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = j; }
        }
        a.push(best);
      }
      return a;
    }
    function update(a) {
      var cs = [], j; for (j = 0; j < 3; j++) { var sx = 0, sy = 0, n = 0, i;
        for (i = 0; i < PTS.length; i++) if (a[i] === j) { sx += PTS[i][0]; sy += PTS[i][1]; n++; }
        cs.push(n ? [sx / n, sy / n] : INIT[j]);
      }
      return cs;
    }
    function wcss(cs, a) { var s = 0, i; for (i = 0; i < PTS.length; i++) { var c = cs[a[i]]; var dx = PTS[i][0] - c[0], dy = PTS[i][1] - c[1]; s += dx * dx + dy * dy; } return s; }
    var FRAMES = [], cur = INIT.map(function (c) { return c.slice(); }), t;
    for (t = 0; t <= 6; t++) {
      var a = assign(cur);
      FRAMES.push({ cs: cur.map(function (c) { return c.slice(); }), a: a, wcss: wcss(cur, a) });
      cur = update(a);
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var f = FRAMES[Math.min(state.iter, FRAMES.length - 1)];
      var i;
      for (i = 0; i < PTS.length; i++) {
        svg.appendChild(svgEl('circle', { cx: px(PTS[i][0]), cy: py(PTS[i][1]), r: '4', fill: COLORS[f.a[i]], opacity: '0.85' }));
      }
      for (i = 0; i < f.cs.length; i++) {
        var cx = px(f.cs[i][0]), cy = py(f.cs[i][1]);
        svg.appendChild(svgEl('path', { d: 'M ' + (cx - 7) + ' ' + cy + ' L ' + (cx + 7) + ' ' + cy + ' M ' + cx + ' ' + (cy - 7) + ' L ' + cx + ' ' + (cy + 7), stroke: COLORS[i], 'stroke-width': '2.5' }));
        svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: '8', fill: 'none', stroke: COLORS[i], 'stroke-width': '2' }));
      }
      status.innerHTML = 'WCSS = ' + f.wcss.toFixed(2);
      meta.textContent = 'iteration ' + state.iter + ' of 6  ·  crosses are centroids  ·  WCSS falls every step until assignments stop changing';
      formula.textContent = 'repeat: assign each point to its nearest centroid → move each centroid to its cluster mean   ·   WCSS = Σ ‖x − μ‖²';
    };
    var grid = el('div', {}, [slider(state, 'iter', 'iteration', 0, 6, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['K-MEANS STEP']), el('span', {}, ['step through the iterations'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['K-means alternates two steps: assign every point to its nearest centroid, then move each centroid to the mean of its points. The within-cluster sum of squares can only fall, so the algorithm converges once no point switches clusters.'])
    ]));
    state._render();
  }

  // ── decision-tree-depth: deeper tree, more splits, overfitting warning ─────
  function decisionTreeDepth(host) {
    var state = { depth: 3 };
    var W = 520, H = 220, PAD = 24;
    // the data has roughly 4 real regions; past depth ~2 (3 leaves) we overfit
    var REAL_LEAVES = 4;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var depth = state.depth;
      var levels = depth + 1;
      var topY = PAD, botY = H - PAD;
      var dy = (botY - topY) / Math.max(1, depth);
      var L;
      // draw the binary tree, level by level
      for (L = 0; L <= depth; L++) {
        var nodes = Math.pow(2, L);
        var y = depth === 0 ? (topY + botY) / 2 : topY + L * dy;
        var i;
        for (i = 0; i < nodes; i++) {
          var x = PAD + (i + 0.5) / nodes * (W - 2 * PAD);
          var leaf = (L === depth);
          if (L > 0) {
            var pnodes = Math.pow(2, L - 1);
            var pi = Math.floor(i / 2);
            var pxv = PAD + (pi + 0.5) / pnodes * (W - 2 * PAD);
            var pyv = topY + (L - 1) * dy;
            svg.appendChild(svgEl('line', { x1: pxv, y1: pyv, x2: x, y2: y, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1' }));
          }
          var over = leaf && nodes > REAL_LEAVES;
          svg.appendChild(svgEl('circle', { cx: x, cy: y, r: leaf ? '6' : '5', fill: leaf ? (over ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)') : 'var(--bg,#fafaf5)', stroke: leaf ? 'none' : 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
        }
      }
      var splits = Math.pow(2, depth) - 1;
      var leaves = Math.pow(2, depth);
      var over = leaves > REAL_LEAVES;
      status.innerHTML = splits + ' <small>internal splits · ' + leaves + ' leaves</small>';
      meta.textContent = (over ? 'past the data: ' + leaves + ' leaves for ~' + REAL_LEAVES + ' real regions, the tree starts memorizing noise' : 'depth ' + depth + ': still tracking real structure');
      formula.textContent = 'a depth-d binary tree has up to 2^d − 1 splits and 2^d leaves   ·   d = ' + depth + '  →  ' + splits + ' splits, ' + leaves + ' leaves';
    };
    var grid = el('div', {}, [slider(state, 'depth', 'max depth', 0, 6, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['DECISION TREE DEPTH']), el('span', {}, ['drag the max depth'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each extra level of depth doubles the leaves and squares the regions the tree can carve. A few splits capture the real structure; beyond that the leaves turn gold, a sign the tree is fitting one point at a time instead of a pattern.'])
    ]));
    state._render();
  }

  // ── feature-scaling: raw elongated contours vs scaled circular ones ────────
  function featureScaling(host) {
    var state = { mode: 'raw' };
    var W = 520, H = 240, PAD = 30, CX = 260, CY = 120;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var raw = state.mode === 'raw';
      var ax = raw ? 210 : 90, ay = 70; // x-radius wide when raw, near-circular when scaled
      var k;
      for (k = 1; k <= 4; k++) {
        svg.appendChild(svgEl('ellipse', { cx: CX, cy: CY, rx: ax * k / 4, ry: ay * k / 4, fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.2' }));
      }
      svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: '4', fill: 'var(--ink,#1a1a1a)' }));
      // gradient-descent path from a fixed start toward the center
      var sx = CX - (raw ? 200 : 80), sy = CY - 62;
      var path = 'M ' + sx + ' ' + sy + ' ', x = sx, y = sy, i;
      for (i = 0; i < 9; i++) {
        // step proportional to local gradient: large along the steep (short) axis
        var gx = (x - CX) / (ax * ax), gy = (y - CY) / (ay * ay);
        var scale = raw ? 7200 : 2600;
        x -= gx * scale; y -= gy * scale;
        path += 'L ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        svg.appendChild(svgEl('circle', { cx: x, cy: y, r: '3', fill: 'var(--blueprint,#3553ff)' }));
      }
      svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }));
      svg.appendChild(svgEl('circle', { cx: sx, cy: sy, r: '4', fill: 'var(--warn,#b8870f)' }));
      meta.textContent = raw ? 'raw features: contours are stretched, so descent zig-zags across the narrow valley' : 'standardized: contours are near-circular, so descent heads almost straight to the minimum';
      formula.textContent = raw ? 'unequal feature scales → elongated loss surface → slow, oscillating convergence' : 'x′ = (x − μ) / σ   →   each feature unit variance → round bowl → fast descent';
    };
    var grid = el('div', {}, [select(state, 'mode', 'features', [['raw (unscaled)', 'raw'], ['standardized', 'scaled']])]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['FEATURE SCALING']), el('span', {}, ['toggle raw vs standardized'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['When features live on different scales the loss surface is a long narrow valley, and gradient descent bounces between the walls. Standardizing each feature to zero mean and unit variance rounds the bowl, so the same algorithm walks almost straight to the minimum.'])
    ]));
    state._render();
  }

  // ── naive-bayes: observe a value, compare likelihoods, read the posterior ──
  function naiveBayes(host) {
    // two class-conditional gaussians on one feature, equal priors
    var muA = 0.38, muB = 0.66, sd = 0.12;
    var state = { x: 0.5 };
    var W = 520, H = 220, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function gauss(x, mu) { return Math.exp(-0.5 * Math.pow((x - mu) / sd, 2)); }
    function px(x) { return PAD + x * (W - 2 * PAD); }
    function py(v) { return H - PAD - v * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      [{ mu: muA, st: 'var(--ink-mute,#999)' }, { mu: muB, st: 'var(--blueprint,#3553ff)' }].forEach(function (g) {
        var d = '', i; for (i = 0; i <= 120; i++) { var x = i / 120; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(gauss(x, g.mu)).toFixed(1) + ' '; }
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: g.st, 'stroke-width': '2' }));
      });
      var tx = px(state.x);
      svg.appendChild(svgEl('line', { x1: tx, y1: PAD, x2: tx, y2: H - PAD, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
      var la = gauss(state.x, muA), lb = gauss(state.x, muB);
      // equal priors → posterior is normalized likelihood
      var postB = lb / (la + lb || 1);
      svg.appendChild(svgEl('circle', { cx: tx, cy: py(la), r: '4', fill: 'var(--ink-mute,#999)' }));
      svg.appendChild(svgEl('circle', { cx: tx, cy: py(lb), r: '4', fill: 'var(--blueprint,#3553ff)' }));
      bar.style.width = (postB * 100).toFixed(1) + '%';
      status.innerHTML = 'P(B | x) = ' + postB.toFixed(3);
      meta.textContent = 'observed x = ' + state.x.toFixed(2) + '  ·  likelihood A ' + la.toFixed(3) + '  ·  likelihood B ' + lb.toFixed(3) + '  ·  equal priors';
      formula.textContent = 'P(B | x) = P(x | B)·P(B) / Σ_c P(x | c)·P(c)   ·   with equal priors, the bigger likelihood wins';
    };
    var grid = el('div', {}, [slider(state, 'x', 'observed feature value', 0.02, 0.98, 0.01)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['NAIVE BAYES']), el('span', {}, ['drag the observed value'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each class has its own bell curve over the feature. The orange line is what you observed; the dots are how likely each class is to produce it. Bayes turns those likelihoods, weighted by the priors, into the posterior bar, the probability the point belongs to class B.'])
    ]));
    state._render();
  }

  // ── class-imbalance: the accuracy paradox of predicting the majority ───────
  function classImbalance(host) {
    var state = { ratio: 5 }; // positive-class percent
    var N = 1000;
    var W = 520, H = 120, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var pos = state.ratio / 100, neg = 1 - pos;
      var inner = W - 2 * PAD;
      var split = PAD + neg * inner;
      svg.appendChild(svgEl('rect', { x: PAD, y: 40, width: (neg * inner).toFixed(1), height: '40', fill: 'var(--ink-mute,#999)' }));
      svg.appendChild(svgEl('rect', { x: split.toFixed(1), y: 40, width: (pos * inner).toFixed(1), height: '40', fill: 'var(--warn,#b8870f)' }));
      // a "predict majority (negative)" classifier
      var acc = neg; // accuracy = fraction it gets right = negatives
      var recall = 0; // it never predicts positive → zero true positives
      bar.style.width = (acc * 100).toFixed(1) + '%';
      barWrap.classList.toggle('over', pos < 0.2);
      status.innerHTML = (acc * 100).toFixed(1) + '% <small>accuracy · 0% recall</small>';
      meta.textContent = 'predict everything negative: catches all ' + Math.round(neg * N) + ' negatives, misses all ' + Math.round(pos * N) + ' positives  ·  gold = positives never found';
      formula.textContent = 'accuracy = (1 − positive rate)   ·   recall = 0   ·   high accuracy here means nothing';
    };
    var grid = el('div', {}, [slider(state, 'ratio', 'positive-class ratio (%)', 1, 50, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CLASS IMBALANCE']), el('span', {}, ['drag the positive ratio'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['When one class is rare, a classifier that always predicts the majority scores high accuracy while catching none of the cases you care about. The gold slice, the positives it never finds, is invisible to accuracy. This is why recall and F1 matter on imbalanced data.'])
    ]));
    state._render();
  }

  // ── k-fold-cv: split into k folds, hold one out per round ──────────────────
  function kFoldCv(host) {
    var state = { k: 5 };
    var W = 520, ROWH = 26, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' 220' });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var k = state.k;
      var H = PAD * 2 + k * ROWH;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var cellW = (W - 2 * PAD) / k;
      var round, fold;
      for (round = 0; round < k; round++) {
        var y = PAD + round * ROWH;
        for (fold = 0; fold < k; fold++) {
          var x = PAD + fold * cellW;
          var held = (fold === round);
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (cellW - 3).toFixed(1), height: (ROWH - 6).toFixed(1), fill: held ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)', opacity: held ? '1' : '0.32' }));
        }
      }
      var trainFrac = (k - 1) / k;
      status.innerHTML = k + '-fold <small>· ' + k + ' rounds</small>';
      meta.textContent = 'each round trains on ' + (k - 1) + ' folds (' + Math.round(trainFrac * 100) + '%) and validates on the gold one  ·  every example is held out exactly once';
      formula.textContent = 'split data into k equal folds → for each fold, train on the other k−1 and score on it → average the k scores';
    };
    var grid = el('div', {}, [slider(state, 'k', 'number of folds k', 2, 10, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['K-FOLD CROSS-VALIDATION']), el('span', {}, ['drag k'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each row is one round: the gold fold is held out for validation, the blue folds are used for training. Rotating the held-out fold means every example is scored exactly once, and averaging the k scores gives a more stable estimate than a single split.'])
    ]));
    state._render();
  }

  LF.register({
    'linear-regression-fit': linearRegressionFit,
    'logistic-sigmoid': logisticSigmoid,
    'svm-margin': svmMargin,
    'knn-smoothness': knnSmoothness,
    'kmeans-step': kmeansStep,
    'decision-tree-depth': decisionTreeDepth,
    'feature-scaling': featureScaling,
    'naive-bayes': naiveBayes,
    'class-imbalance': classImbalance,
    'k-fold-cv': kFoldCv
  });
})();
