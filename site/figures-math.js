/* figures-math.js — interactive lesson figures for Phase 1 (math foundations).
   Loads after lesson-figures.js, uses only the shared LF toolkit, and follows
   the same blueprint theme through CSS vars. Same fenced-block syntax:
       ```figure
       vector-projection
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, select = LF.select;

  // ── vector-projection: project a onto b, watch the foot slide ──────────────
  function vectorProjection(host) {
    var state = { degB: 25, lenA: 2.4, degA: 70 };
    var W = 520, H = 230, OX = 60, OY = H - 40, U = 52;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function arrow(x2, y2, st, w) { return svgEl('line', { x1: OX, y1: OY, x2: OX + x2 * U, y2: OY - y2 * U, stroke: st, 'stroke-width': w || '2.5' }); }
    state._render = function () {
      var ra = state.degA * Math.PI / 180, rb = state.degB * Math.PI / 180;
      var ax = state.lenA * Math.cos(ra), ay = state.lenA * Math.sin(ra);
      var bx = Math.cos(rb), by = Math.sin(rb);                 // b is a unit direction
      var dot = ax * bx + ay * by;                              // a·b, |b|=1
      var projLen = dot;                                        // scalar projection = |a|cos(theta)
      var px = projLen * bx, py = projLen * by;                 // projection vector (a·b/|b|^2) b
      var lenA = Math.sqrt(ax * ax + ay * ay);
      var theta = Math.acos(LF.clamp(dot / (lenA || 1), -1, 1)) * 180 / Math.PI;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrow(3.4 * bx, 3.4 * by, 'var(--ink-mute,#999)', '2'));     // direction of b
      svg.appendChild(arrow(ax, ay, 'var(--blueprint,#3553ff)'));                  // a
      svg.appendChild(arrow(px, py, 'var(--warn,#b8870f)', '3'));                  // projection onto b
      svg.appendChild(svgEl('line', { x1: OX + ax * U, y1: OY - ay * U, x2: OX + px * U, y2: OY - py * U, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1', 'stroke-dasharray': '4 3' }));
      num.innerHTML = projLen.toFixed(2) + ' <small>proj length</small>';
      meta.textContent = 'angle θ = ' + theta.toFixed(0) + '°  ·  proj = |a|cos θ = ' + projLen.toFixed(2) + (projLen < 0 ? '  (points opposite b)' : '');
      formula.textContent = 'proj_b a = (a·b / |b|²) b   ·   scalar = |a|cos θ   ·   b shown as unit vector (grey)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'degB', 'angle of b', 0, 180, 1),
      slider(state, 'degA', 'angle of a', 0, 180, 1),
      slider(state, 'lenA', 'length of a', 0.4, 3.4, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['VECTOR PROJECTION']), el('span', {}, ['drag the angles'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Blue is a, grey is the direction of b, orange is the shadow a casts on b. The scalar projection |a|cos θ shrinks to zero when the vectors are perpendicular and goes negative when the angle passes 90°. The dashed line is the perpendicular dropped from a to its foot on b.'])
    ]));
    state._render();
  }

  // ── matrix-transform: a 2x2 matrix deforms the unit square ─────────────────
  function matrixTransform(host) {
    var state = { a: 1, b: 0.5, c: 0, d: 1 };
    var W = 520, H = 230, CX = 260, CY = 120, U = 42;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function P(x, y) { return (CX + x * U) + ' ' + (CY - y * U); }
    function quad(p, st, fill) { return svgEl('path', { d: 'M ' + P(p[0][0], p[0][1]) + ' L ' + P(p[1][0], p[1][1]) + ' L ' + P(p[2][0], p[2][1]) + ' L ' + P(p[3][0], p[3][1]) + ' Z', fill: fill, stroke: st, 'stroke-width': '2' }); }
    state._render = function () {
      var a = state.a, b = state.b, c = state.c, d = state.d;
      var det = a * d - b * c;
      var unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
      var tf = unit.map(function (v) { return [a * v[0] + b * v[1], c * v[0] + d * v[1]]; });
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: 20, y1: CY, x2: W - 20, y2: CY, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: CX, y1: 12, x2: CX, y2: H - 12, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(quad(unit, 'var(--ink-mute,#999)', 'none'));
      svg.appendChild(quad(tf, 'var(--blueprint,#3553ff)', det < 0 ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)'));
      var img = svg.lastChild; img.setAttribute('fill-opacity', '0.12');
      num.innerHTML = det.toFixed(2) + ' <small>determinant</small>';
      meta.textContent = (det < 0 ? 'orientation flipped  ·  ' : det === 0 ? 'collapsed to a line  ·  ' : '') + 'area scales by ' + Math.abs(det).toFixed(2) + 'x';
      formula.textContent = 'M = [[' + a.toFixed(1) + ', ' + b.toFixed(1) + '], [' + c.toFixed(1) + ', ' + d.toFixed(1) + ']]   ·   det = ad − bc = ' + det.toFixed(2);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'a', 'a  (M₁₁)', -2, 2, 0.1),
      slider(state, 'b', 'b  (M₁₂)', -2, 2, 0.1),
      slider(state, 'c', 'c  (M₂₁)', -2, 2, 0.1),
      slider(state, 'd', 'd  (M₂₂)', -2, 2, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['MATRIX TRANSFORM']), el('span', {}, ['drag the four entries'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Grey is the unit square; blue is its image under M. The columns of M are where the basis vectors land. The determinant ad − bc is the signed area of that parallelogram: it is the factor by which the matrix scales area, and it turns negative when the transform flips orientation.'])
    ]));
    state._render();
  }

  // ── eigen-directions: a symmetric 2x2 scales its eigenvectors, rotates rest ─
  function eigenDirections(host) {
    var state = { a: 2, c: 0.8, d: 1, deg: 30 };
    var W = 520, H = 230, CX = 200, CY = 120, U = 34;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function arrow(vx, vy, st, w) { return svgEl('line', { x1: CX, y1: CY, x2: CX + vx * U, y2: CY - vy * U, stroke: st, 'stroke-width': w || '2' }); }
    state._render = function () {
      var a = state.a, b = state.c, d = state.d;                 // symmetric: M = [[a,b],[b,d]]
      var tr = a + d, det = a * d - b * b;
      var disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
      var l1 = tr / 2 + disc, l2 = tr / 2 - disc;                // real eigenvalues (symmetric)
      function eigvec(l) {
        var ex = b, ey = l - a;
        if (Math.abs(ex) < 1e-6 && Math.abs(ey) < 1e-6) { ex = 1; ey = 0; }
        var n = Math.sqrt(ex * ex + ey * ey); return [ex / n, ey / n];
      }
      var v1 = eigvec(l1), v2 = eigvec(l2);
      var r = state.deg * Math.PI / 180, gx = Math.cos(r), gy = Math.sin(r);
      var tx = a * gx + b * gy, ty = b * gx + d * gy;            // M applied to the generic vector
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: 20, y1: CY, x2: 380, y2: CY, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: CX, y1: 12, x2: CX, y2: H - 12, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      [v1, v2].forEach(function (v) {                            // eigenvectors both directions: invariant axes
        svg.appendChild(svgEl('line', { x1: CX - v[0] * 80, y1: CY + v[1] * 80, x2: CX + v[0] * 80, y2: CY - v[1] * 80, stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', 'stroke-dasharray': '4 3' }));
      });
      svg.appendChild(arrow(v1[0] * l1 / 2, v1[1] * l1 / 2, 'var(--warn,#b8870f)', '3'));   // scaled eigenvector 1
      svg.appendChild(arrow(v2[0] * l2 / 2, v2[1] * l2 / 2, 'var(--warn,#b8870f)', '3'));   // scaled eigenvector 2
      svg.appendChild(arrow(gx, gy, 'var(--rule-soft,#bbb)', '1.5'));                       // generic input
      svg.appendChild(arrow(tx, ty, 'var(--blueprint,#3553ff)', '2.5'));                    // its image (rotated)
      num.innerHTML = 'λ = ' + l1.toFixed(2) + ', ' + l2.toFixed(2);
      meta.textContent = 'eigenvalues stretch the dashed axes  ·  the grey input vector rotates into blue, off-axis';
      formula.textContent = 'M = [[' + a.toFixed(1) + ', ' + b.toFixed(1) + '], [' + b.toFixed(1) + ', ' + d.toFixed(1) + ']]   ·   Mv = λv only along the eigen-axes';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'a', 'a  (M₁₁)', -2, 3, 0.1),
      slider(state, 'd', 'd  (M₂₂)', -2, 3, 0.1),
      slider(state, 'c', 'off-diagonal b', -2, 2, 0.1),
      slider(state, 'deg', 'generic vector angle', 0, 360, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['EIGEN-DIRECTIONS']), el('span', {}, ['drag the matrix'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['For a symmetric matrix the eigenvectors are the dashed axes, and the matrix simply stretches anything along them by the eigenvalue (orange). A generic grey vector, off those axes, both stretches and rotates into the blue image. Drag its angle: only on an eigen-axis does the output stay parallel to the input.'])
    ]));
    state._render();
  }

  // ── derivative-tangent: tangent line to f(x)=x^3-3x at x0 ───────────────────
  function derivativeTangent(host) {
    var state = { x0: -1.6 };
    var W = 520, H = 230, PAD = 30, XR = 2.4, YR = 4.2;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function f(x) { return x * x * x - 3 * x; }
    function df(x) { return 3 * x * x - 3; }
    function px(x) { return PAD + (x + XR) / (2 * XR) * (W - 2 * PAD); }
    function py(y) { return H / 2 - (y / YR) * (H / 2 - PAD); }
    state._render = function () {
      var x0 = state.x0, slope = df(x0), y0 = f(x0);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0), x2: W - PAD, y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: px(0), y1: PAD, x2: px(0), y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var d = '', i; for (i = 0; i <= 140; i++) { var x = -XR + 2 * XR * i / 140; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(f(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var xL = -XR, xRr = XR;                                    // tangent: y = y0 + slope*(x-x0)
      svg.appendChild(svgEl('line', { x1: px(xL), y1: py(y0 + slope * (xL - x0)), x2: px(xRr), y2: py(y0 + slope * (xRr - x0)), stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.8' }));
      svg.appendChild(svgEl('circle', { cx: px(x0), cy: py(y0), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      num.innerHTML = slope.toFixed(2) + ' <small>slope f′(x₀)</small>';
      meta.textContent = 'x₀ = ' + x0.toFixed(2) + '  ·  f(x₀) = ' + y0.toFixed(2) + '  ·  ' + (Math.abs(slope) < 0.05 ? 'flat: a critical point' : slope > 0 ? 'rising' : 'falling');
      formula.textContent = "f(x) = x³ − 3x   ·   f′(x) = 3x² − 3   ·   tangent y = f(x₀) + f′(x₀)(x − x₀)";
    };
    var grid = el('div', {}, [slider(state, 'x0', 'point x₀', -2.3, 2.3, 0.05)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['DERIVATIVE / TANGENT']), el('span', {}, ['drag x₀'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The derivative is the slope of the tangent line. For f(x) = x³ − 3x it equals 3x² − 3, which is zero at x = ±1, the two critical points where the orange line goes flat. Between them the function falls, outside them it rises. Gradient descent reads exactly this slope to decide which way to step.'])
    ]));
    state._render();
  }

  // ── chain-rule: dy/dx for y = sin(a x^2) as a product of local derivatives ──
  function chainRule(host) {
    var state = { x: 1.0, a: 1.5 };
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var rows = el('div', {});
    function bar(label, value, ref) {
      var b = el('i'); b.style.width = LF.clamp(Math.abs(value) / ref * 100, 0, 100).toFixed(0) + '%';
      if (value < 0) b.style.background = 'var(--warn,#b8870f)';
      return el('div', { class: 'lf-ctrl' }, [el('label', {}, [label, el('b', {}, [value.toFixed(3)])]), el('div', { class: 'lf-bar' }, [b])]);
    }
    state._render = function () {
      var x = state.x, a = state.a;
      var u = a * x * x;                 // inner: u = a x^2
      var dydu = Math.cos(u);            // outer derivative: d/du sin(u) = cos(u)
      var dudx = 2 * a * x;              // inner derivative: du/dx = 2 a x
      var dydx = dydu * dudx;            // chain rule product
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      rows.appendChild(bar('dy/du = cos(a x²)', dydu, 1));
      rows.appendChild(bar('du/dx = 2 a x', dudx, Math.max(1, 2 * Math.abs(a) * 2)));
      rows.appendChild(bar('dy/dx = product', dydx, Math.max(1, 2 * Math.abs(a) * 2)));
      num.innerHTML = dydx.toFixed(3) + ' <small>dy/dx</small>';
      meta.textContent = 'y = sin(' + u.toFixed(2) + ') = ' + Math.sin(u).toFixed(3) + '  ·  local slopes multiply: ' + dydu.toFixed(2) + ' × ' + dudx.toFixed(2);
      formula.textContent = 'y = sin(a x²)   ·   dy/dx = cos(a x²) · 2 a x   ·   outer derivative × inner derivative';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'x', 'x', -2.5, 2.5, 0.05),
      slider(state, 'a', 'a', 0.2, 3, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CHAIN RULE']), el('span', {}, ['drag x and a'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, el('div', { style: 'margin-top:12px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The composite y = sin(a x²) differentiates by multiplying two local slopes: the outer cos(a x²) and the inner 2 a x. Each orange-or-blue bar is one factor; their product is the bar below. This is the rule backpropagation applies link by link to push gradients through a whole network.'])
    ]));
    state._render();
  }

  // ── gaussian-pdf: drag mean and std, shade the one-sigma band ───────────────
  function gaussianPdf(host) {
    var state = { mu: 0, sigma: 1 };
    var W = 520, H = 220, PAD = 30, XLO = -6, XHI = 6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(x) { return PAD + (x - XLO) / (XHI - XLO) * (W - 2 * PAD); }
    var YMAX = 1 / (0.4 * Math.sqrt(2 * Math.PI));            // peak at the smallest sigma we allow
    function pdf(x, mu, s) { return Math.exp(-0.5 * Math.pow((x - mu) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); }
    function py(y) { return H - PAD - y / YMAX * (H - 2 * PAD); }
    state._render = function () {
      var mu = state.mu, s = state.sigma, peak = pdf(mu, mu, s);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var shade = 'M ' + px(mu - s).toFixed(1) + ' ' + py(0).toFixed(1) + ' ', i, x;   // +-1 sigma band = ~68%
      for (i = 0; i <= 60; i++) { x = (mu - s) + 2 * s * i / 60; shade += 'L ' + px(x).toFixed(1) + ' ' + py(pdf(x, mu, s)).toFixed(1) + ' '; }
      shade += 'L ' + px(mu + s).toFixed(1) + ' ' + py(0).toFixed(1) + ' Z';
      svg.appendChild(svgEl('path', { d: shade, fill: 'var(--blueprint,#3553ff)', 'fill-opacity': '0.16', stroke: 'none' }));
      var d = '';
      for (i = 0; i <= 160; i++) { x = XLO + (XHI - XLO) * i / 160; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(pdf(x, mu, s)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('line', { x1: px(mu), y1: py(0), x2: px(mu), y2: py(peak), stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      num.innerHTML = peak.toFixed(3) + ' <small>peak density</small>';
      meta.textContent = 'μ = ' + mu.toFixed(2) + '  ·  σ = ' + s.toFixed(2) + '  ·  shaded ±1σ holds ≈ 68% of the mass';
      formula.textContent = 'p(x) = exp(−½((x−μ)/σ)²) / (σ√(2π))   ·   area always integrates to 1';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'mu', 'mean μ', -4, 4, 0.1),
      slider(state, 'sigma', 'std σ', 0.4, 3, 0.05)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['GAUSSIAN PDF']), el('span', {}, ['drag μ and σ'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The mean slides the bell sideways; the standard deviation sets its width. A smaller σ makes a taller, narrower peak, since the total area stays fixed at 1. The shaded band is μ ± σ, which always captures about 68% of the probability no matter where you put the curve.'])
    ]));
    state._render();
  }

  // ── bayes-update: medical test posterior from prior, sensitivity, FPR ──────
  function bayesUpdate(host) {
    var state = { prior: 1, sens: 95, fpr: 5 };
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var rows = el('div', {});
    function bar(label, value) {
      var b = el('i'); b.style.width = (value * 100).toFixed(1) + '%';
      return el('div', { class: 'lf-ctrl' }, [el('label', {}, [label, el('b', {}, [(value * 100).toFixed(1) + '%'])]), el('div', { class: 'lf-bar' }, [b])]);
    }
    state._render = function () {
      var pr = state.prior / 100;            // P(disease)
      var sens = state.sens / 100;           // P(+ | disease)
      var fpr = state.fpr / 100;             // P(+ | healthy)
      var pPos = sens * pr + fpr * (1 - pr); // total probability of a positive test
      var post = pPos > 0 ? sens * pr / pPos : 0;   // Bayes: P(disease | +)
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      rows.appendChild(bar('prior P(disease)', pr));
      rows.appendChild(bar('posterior P(disease | +)', post));
      num.innerHTML = (post * 100).toFixed(1) + ' <small>% have it, given +</small>';
      meta.textContent = 'a positive test happens ' + (pPos * 100).toFixed(1) + '% of the time  ·  most are false alarms when the disease is rare';
      formula.textContent = 'P(D|+) = sens·prior / (sens·prior + fpr·(1−prior)) = ' + (sens).toFixed(2) + '·' + pr.toFixed(3) + ' / ' + pPos.toFixed(4);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'prior', 'prior P(disease) %', 0.1, 50, 0.1),
      slider(state, 'sens', 'sensitivity P(+|D) %', 50, 100, 0.5),
      slider(state, 'fpr', 'false-positive rate %', 0.5, 30, 0.5)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['BAYES UPDATE']), el('span', {}, ['drag prior, sensitivity, FPR'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, el('div', { style: 'margin-top:12px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The surprise of Bayes: a 95%-accurate test on a disease that affects 1 in 100 still leaves most positives healthy, because the false positives drawn from the huge healthy population swamp the few true cases. The posterior only climbs once the prior is high enough that real cases outnumber the false alarms.'])
    ]));
    state._render();
  }

  // ── entropy-kl: two 4-bin distributions, H(p) and KL(p||q) ─────────────────
  function entropyKl(host) {
    var state = { p0: 5, p1: 3, p2: 2, p3: 1, q0: 1, q1: 2, q2: 3, q3: 4 };
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var rows = el('div', {});
    function norm(v) { var s = v.reduce(function (a, x) { return a + x; }, 0) || 1; return v.map(function (x) { return x / s; }); }
    state._render = function () {
      var p = norm([state.p0, state.p1, state.p2, state.p3]);
      var q = norm([state.q0, state.q1, state.q2, state.q3]);
      var H = -p.reduce(function (a, pi) { return a + (pi > 0 ? pi * Math.log2(pi) : 0); }, 0);
      var KL = p.reduce(function (a, pi, i) { return a + (pi > 0 && q[i] > 0 ? pi * Math.log2(pi / q[i]) : 0); }, 0);
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      p.forEach(function (pi, i) {
        var bp = el('i'); bp.style.width = (pi * 100).toFixed(0) + '%';
        var bq = el('i'); bq.style.width = (q[i] * 100).toFixed(0) + '%'; bq.style.background = 'var(--ink-mute,#999)';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [
          el('label', {}, ['bin ' + i, el('b', {}, ['p ' + (pi * 100).toFixed(0) + '% · q ' + (q[i] * 100).toFixed(0) + '%'])]),
          el('div', { class: 'lf-bar' }, [bp]), el('div', { class: 'lf-bar' }, [bq])
        ]));
      });
      num.innerHTML = H.toFixed(2) + ' <small>bits H(p)</small>';
      meta.textContent = 'KL(p‖q) = ' + KL.toFixed(3) + ' bits  ·  always ≥ 0, zero only when p = q  ·  asymmetric: KL(p‖q) ≠ KL(q‖p)';
      formula.textContent = 'H(p) = −Σ pᵢ log₂ pᵢ   ·   KL(p‖q) = Σ pᵢ log₂(pᵢ / qᵢ)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'p0', 'p bin 0', 0, 10, 1), slider(state, 'q0', 'q bin 0', 0, 10, 1),
      slider(state, 'p1', 'p bin 1', 0, 10, 1), slider(state, 'q1', 'q bin 1', 0, 10, 1),
      slider(state, 'p2', 'p bin 2', 0, 10, 1), slider(state, 'q2', 'q bin 2', 0, 10, 1),
      slider(state, 'p3', 'p bin 3', 0, 10, 1), slider(state, 'q3', 'q bin 3', 0, 10, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ENTROPY & KL']), el('span', {}, ['shape p (blue) and q (grey)'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, el('div', { style: 'margin-top:12px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Entropy H(p) measures the average surprise of the blue distribution, maxed out when all four bins are equal. KL(p‖q) measures the extra bits paid for coding samples from p using a code built for q; it is never negative, hits zero only when the two match, and is not symmetric. Cross-entropy training minimizes exactly this gap.'])
    ]));
    state._render();
  }

  // ── pca-axes: correlated cloud, principal axes from the covariance matrix ───
  function pcaAxes(host) {
    var state = { rho: 0.7, scale: 1.4 };
    var W = 520, H = 230, CX = 200, CY = 115, U = 70;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var seeds = []; var s = 12345;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    function gz() { return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()); }
    var i; for (i = 0; i < 120; i++) seeds.push([gz(), gz()]);
    state._render = function () {
      var rho = state.rho, sc = state.scale;
      var sx = sc, sy = 0.55;
      // covariance of generated points: x = sx*z1, y = sy*(rho*z1 + sqrt(1-rho^2)*z2)
      var cxx = sx * sx, cyy = sy * sy, cxy = sx * sy * rho;
      var tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
      var disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
      var l1 = tr / 2 + disc, l2 = tr / 2 - disc;      // variances along the two principal axes
      function eig(l) { var ex = cxy, ey = l - cxx; if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9) { ex = 1; ey = 0; } var n = Math.sqrt(ex * ex + ey * ey); return [ex / n, ey / n]; }
      var v1 = eig(l1), v2 = eig(l2);
      var pct = l1 / (l1 + l2) * 100;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: 20, y1: CY, x2: 380, y2: CY, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: CX, y1: 12, x2: CX, y2: H - 12, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      seeds.forEach(function (z) {
        var x = sx * z[0], y = sy * (rho * z[0] + Math.sqrt(1 - rho * rho) * z[1]);
        svg.appendChild(svgEl('circle', { cx: CX + x * U, cy: CY - y * U, r: '2', fill: 'var(--ink-mute,#999)', 'fill-opacity': '0.6' }));
      });
      var a1 = Math.sqrt(l1) * U * 2, a2 = Math.sqrt(l2) * U * 2;   // axis length ~ std dev
      svg.appendChild(svgEl('line', { x1: CX - v1[0] * a1, y1: CY + v1[1] * a1, x2: CX + v1[0] * a1, y2: CY - v1[1] * a1, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '3' }));
      svg.appendChild(svgEl('line', { x1: CX - v2[0] * a2, y1: CY + v2[1] * a2, x2: CX + v2[0] * a2, y2: CY - v2[1] * a2, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2.5' }));
      num.innerHTML = pct.toFixed(1) + ' <small>% variance on PC1</small>';
      meta.textContent = 'principal variances λ₁ = ' + l1.toFixed(2) + ', λ₂ = ' + l2.toFixed(2) + '  ·  blue = PC1 (most spread), orange = PC2';
      formula.textContent = 'PCs are eigenvectors of the covariance Σ  ·  eigenvalues λ = variance explained along each axis';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'rho', 'correlation ρ', -0.95, 0.95, 0.05),
      slider(state, 'scale', 'x spread', 0.6, 2.2, 0.05)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['PCA AXES']), el('span', {}, ['drag the correlation'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['PCA finds the eigenvectors of the covariance matrix. The blue axis (PC1) points along the direction of greatest spread; the orange axis (PC2) is perpendicular and captures what is left. The eigenvalues are the variances along each axis, so the variance-explained on PC1 climbs as the cloud becomes more elongated and correlated.'])
    ]));
    state._render();
  }

  // ── fourier-synthesis: sum of harmonics approaching a square/saw wave ──────
  function fourierSynthesis(host) {
    var state = { a1: 100, a2: 0, a3: 33, a4: 0 };
    var W = 520, H = 220, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(t) { return PAD + t * (W - 2 * PAD); }                 // t in [0,1] over one period
    function py(v) { return H / 2 - v * (H / 2 - PAD) / 1.4; }
    state._render = function () {
      var amp = [state.a1 / 100, state.a2 / 100, state.a3 / 100, state.a4 / 100];
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0), x2: W - PAD, y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var k;
      for (k = 0; k < 4; k++) {                                        // faint individual harmonics
        if (amp[k] === 0) continue;
        var dk = '', i; for (i = 0; i <= 200; i++) { var t = i / 200; dk += (i ? 'L' : 'M') + px(t).toFixed(1) + ' ' + py(amp[k] * Math.sin(2 * Math.PI * (2 * k + 1) * t)).toFixed(1) + ' '; }
        svg.appendChild(svgEl('path', { d: dk, fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', opacity: '0.4' }));
      }
      var d = '', i2; for (i2 = 0; i2 <= 240; i2++) {                  // the summed waveform
        var tt = i2 / 240, v = 0, kk;
        for (kk = 0; kk < 4; kk++) v += amp[kk] * Math.sin(2 * Math.PI * (2 * kk + 1) * tt);
        d += (i2 ? 'L' : 'M') + px(tt).toFixed(1) + ' ' + py(v).toFixed(1) + ' ';
      }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var square = Math.abs(state.a1 - 100) < 12 && Math.abs(state.a2) < 12 && state.a3 > 20 && Math.abs(state.a4) < 12;
      meta.textContent = 'harmonics at 1f, 3f, 5f, 7f  ·  amplitudes ' + amp.map(function (a) { return a.toFixed(2); }).join(', ') + (square ? '  ·  odd harmonics 1, 1/3, 1/5 build a square wave' : '');
      formula.textContent = 'f(t) = Σ aₖ sin(2π(2k+1)t)   ·   any periodic signal is a sum of sines';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'a1', 'amp · 1st harmonic', 0, 100, 1),
      slider(state, 'a2', 'amp · 3rd harmonic', 0, 100, 1),
      slider(state, 'a3', 'amp · 5th harmonic', 0, 100, 1),
      slider(state, 'a4', 'amp · 7th harmonic', 0, 100, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['FOURIER SYNTHESIS']), el('span', {}, ['add the harmonics'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Every periodic signal is a sum of sine waves at integer multiples of a base frequency. The faint grey curves are the individual odd harmonics; the blue curve is their sum. Set them to 1, 1/3, 1/5, 1/7 of full strength and the sum starts to square off, the classic Fourier-series approach to a square wave.'])
    ]));
    state._render();
  }

  // ── convex-vs-nonconvex: a bowl vs a bumpy landscape, descent gets stuck ────
  function convexVsNonconvex(host) {
    var state = { kind: 'convex', x0: -2.6 };
    var W = 520, H = 230, PAD = 30, XR = 3;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function f(x) { return state.kind === 'convex' ? 0.5 * x * x : 0.18 * x * x + Math.sin(3 * x); }
    function df(x) { return state.kind === 'convex' ? x : 0.36 * x + 3 * Math.cos(3 * x); }
    var YMAX = 4.5;
    function px(x) { return PAD + (x + XR) / (2 * XR) * (W - 2 * PAD); }
    function py(y) { return H - PAD - (y + 1.5) / YMAX * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = '', i, x; for (i = 0; i <= 180; i++) { x = -XR + 2 * XR * i / 180; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(f(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var xc = state.x0, t, pts = [];                          // gradient descent from the chosen start
      for (t = 0; t < 80; t++) { pts.push(xc); xc = xc - 0.08 * df(xc); xc = LF.clamp(xc, -XR, XR); }
      pts.forEach(function (xi, idx) { if (idx % 4 === 0) svg.appendChild(svgEl('circle', { cx: px(xi), cy: py(f(xi)), r: '2.5', fill: 'var(--ink-mute,#999)' })); });
      var end = pts[pts.length - 1];
      svg.appendChild(svgEl('circle', { cx: px(end), cy: py(f(end)), r: '5', fill: 'var(--warn,#b8870f)' }));
      var atGlobal = state.kind === 'convex' || Math.abs(end) < 0.6;
      num.innerHTML = atGlobal ? 'global minimum' : 'stuck: local minimum';
      meta.textContent = 'landed at x = ' + end.toFixed(2) + '  ·  ' + (state.kind === 'convex' ? 'one valley: any start reaches the bottom' : 'many valleys: the start decides which one you fall into');
      formula.textContent = state.kind === 'convex' ? 'f(x) = ½x²   ·   one minimum, every descent path converges there' : 'f(x) = 0.18x² + sin(3x)   ·   several local minima trap descent';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      select(state, 'kind', 'landscape', [['convex bowl', 'convex'], ['non-convex (bumpy)', 'nonconvex']]),
      slider(state, 'x0', 'start x', -2.9, 2.9, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CONVEX VS NON-CONVEX']), el('span', {}, ['switch the landscape'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A convex bowl has one minimum, so gradient descent reaches it from any start. The non-convex landscape has several valleys: the grey trail rolls downhill into whichever one is nearest, and the orange dot can settle in a local minimum that is not the global best. Drag the start to see different basins capture the path.'])
    ]));
    state._render();
  }

  LF.register({
    'vector-projection': vectorProjection,
    'matrix-transform': matrixTransform,
    'eigen-directions': eigenDirections,
    'derivative-tangent': derivativeTangent,
    'chain-rule': chainRule,
    'gaussian-pdf': gaussianPdf,
    'bayes-update': bayesUpdate,
    'entropy-kl': entropyKl,
    'pca-axes': pcaAxes,
    'fourier-synthesis': fourierSynthesis,
    'convex-vs-nonconvex': convexVsNonconvex
  });
})();
