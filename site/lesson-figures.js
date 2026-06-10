/* lesson-figures.js — interactive, theme-aware figures embedded in lessons.
   Authoring: a fenced block in docs/en.md
       ```figure
       kv-cache
       ```
   renders <div class="lesson-figure" data-figure="kv-cache">, which this file
   hydrates into a real interactive widget. No deps. Uses the site's CSS vars
   so it follows the blueprint theme in light and dark. */
(function () {
  'use strict';

  // Scoped styles, injected once.
  function ensureStyles() {
    if (document.getElementById('lf-styles')) return;
    var s = document.createElement('style');
    s.id = 'lf-styles';
    s.textContent = [
      '.lf{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;padding:0;font-family:var(--font-body,serif)}',
      '.lf-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 16px;border-bottom:1px solid var(--rule-soft,#ddd);font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.lf-head .lf-label{color:var(--blueprint,#3553ff)}',
      '.lf-body{padding:16px}',
      '.lf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}',
      '@media(max-width:640px){.lf-grid{grid-template-columns:1fr}}',
      '.lf-ctrl{display:flex;flex-direction:column;gap:4px}',
      '.lf-ctrl label{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft,#555);display:flex;justify-content:space-between}',
      '.lf-ctrl label b{color:var(--blueprint,#3553ff);font-variant-numeric:tabular-nums}',
      '.lf-ctrl input[type=range]{width:100%;accent-color:var(--blueprint,#3553ff)}',
      '.lf-ctrl select{font-family:var(--font-mono,monospace);font-size:.82rem;padding:4px 6px;background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);border:1px solid var(--rule-soft,#ddd)}',
      '.lf-out{margin-top:18px;padding-top:14px;border-top:1px dashed var(--rule-soft,#ddd)}',
      '.lf-num{font-family:var(--font-mono,monospace);font-size:2rem;color:var(--blueprint,#3553ff);font-variant-numeric:tabular-nums;line-height:1}',
      '.lf-num small{font-size:.9rem;color:var(--ink-soft,#555);letter-spacing:.04em}',
      '.lf-bar{position:relative;height:10px;background:var(--rule-soft,#eee);margin-top:12px;overflow:hidden}',
      '.lf-bar i{position:absolute;inset:0 auto 0 0;width:0;background:var(--blueprint,#3553ff);transition:width .12s ease}',
      '.lf-bar.over i{background:var(--warn,#b8870f)}',
      '.lf-meta{font-family:var(--font-mono,monospace);font-size:.7rem;color:var(--ink-mute,#777);margin-top:8px;letter-spacing:.04em}',
      '.lf-formula{font-family:var(--font-mono,monospace);font-size:.72rem;color:var(--ink-soft,#555);margin-top:6px;word-break:break-word}',
      '.lf-cap{font-family:var(--font-body,serif);font-size:.92rem;color:var(--ink-soft,#555);line-height:1.5;padding:12px 16px;border-top:1px solid var(--rule-soft,#ddd)}',
      '.lesson-figure.lf-animated{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);margin:28px 0;padding:14px}',
      '.lesson-figure.lf-animated svg{display:block;width:100%;height:auto;max-width:760px;margin:0 auto;color:var(--blueprint,#3553ff)}',
      '.lf-out svg{display:block;width:100%;height:auto;max-width:560px;margin:4px auto 0}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svgEl(tag, attrs, kids) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function fmtInt(n) { return n.toLocaleString('en-US'); }
  function fmtSeq(n) { return n >= 1024 ? (n / 1024) + 'K' : String(n); }

  function slider(state, key, label, min, max, step, fmt) {
    var val = el('b', {}, [fmt ? fmt(state[key]) : String(state[key])]);
    var input = el('input', { type: 'range', min: min, max: max, step: step, value: state[key] });
    input.addEventListener('input', function () {
      state[key] = Number(input.value);
      val.textContent = fmt ? fmt(state[key]) : String(state[key]);
      state._render();
    });
    return el('div', { class: 'lf-ctrl' }, [el('label', {}, [label, val]), input]);
  }

  function select(state, key, label, options) {
    var sel = el('select');
    options.forEach(function (o) { sel.appendChild(el('option', { value: o[1] }, [o[0]])); });
    sel.value = state[key];
    sel.addEventListener('change', function () { state[key] = sel.value; state._render(); });
    return el('div', { class: 'lf-ctrl' }, [el('label', {}, [label]), sel]);
  }

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // requestAnimationFrame loop that respects reduced-motion (renders one static
  // frame for headless / reduced-motion, animates in a real browser).
  function raf(step) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !window.requestAnimationFrame) { step(0, true); return function () {}; }
    var alive = true, t0 = null;
    function tick(ts) { if (!alive) return; if (t0 === null) t0 = ts; step((ts - t0) / 1000, false); window.requestAnimationFrame(tick); }
    window.requestAnimationFrame(tick);
    return function () { alive = false; };
  }

  // ── kv-cache: drag the dims, watch the cache size ──────────────────────
  function kvCache(host, cfg) {
    var GiB = Math.pow(1024, 3);
    var REF = (cfg && cfg.refGiB) || 80; // one H100 / A100 80GB
    var state = {
      seq: 8192, batch: 8, layers: (cfg && cfg.layers) || 32,
      kvHeads: (cfg && cfg.kvHeads) || 8, headDim: (cfg && cfg.headDim) || 128, dbytes: 2
    };

    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    state._render = function () {
      var bytes = 2 * state.layers * state.kvHeads * state.headDim * state.seq * state.batch * state.dbytes;
      var gib = bytes / GiB;
      num.innerHTML = gib.toFixed(gib < 10 ? 2 : 1) + ' <small>GiB</small>';
      var pct = Math.min(100, gib / REF * 100);
      bar.style.width = pct + '%';
      barWrap.classList.toggle('over', gib > REF);
      meta.textContent = (gib > REF ? '⚠ exceeds ' : '') + Math.round(gib / REF * 100) + '% of one ' + REF + ' GiB GPU';
      formula.textContent = '2 · ' + state.layers + ' layers · ' + state.kvHeads + ' kv-heads · ' + state.headDim +
        ' head-dim · ' + fmtInt(state.seq) + ' tokens · ' + state.batch + ' batch · ' + state.dbytes + ' B';
    };

    var dtype = el('select');
    [['fp16 / bf16', 2], ['fp8', 1], ['int8', 1]].forEach(function (o) {
      var op = el('option', { value: o[1] }, [o[0]]); dtype.appendChild(op);
    });
    dtype.addEventListener('change', function () { state.dbytes = Number(dtype.value); state._render(); });

    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'seq', 'sequence length', 256, 131072, 256, fmtSeq),
      slider(state, 'batch', 'batch size', 1, 128, 1),
      slider(state, 'layers', 'layers', 1, 128, 1),
      slider(state, 'kvHeads', 'kv heads (GQA)', 1, 128, 1),
      slider(state, 'headDim', 'head dim', 32, 256, 8),
      el('div', { class: 'lf-ctrl' }, [el('label', {}, ['dtype']), dtype])
    ]);

    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['KV-CACHE SIZER']), el('span', {}, ['drag the dimensions'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The cache holds one key and one value per token, per layer, per kv-head. It grows linearly with sequence length and batch — which is why long context at high batch is what fills the GPU, not the weights.'])
    ]));
    state._render();
  }

  // ── gradient-descent: drag the learning rate, watch it converge or blow up ─
  function gradDescent(host) {
    var state = { lr: 0.1, steps: 12, x0: -2.6 };
    var W = 520, H = 220, PAD = 28;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function fx(x) { return x * x; }
    function px(x) { return PAD + (x + 3) / 6 * (W - 2 * PAD); }
    function py(y) { return H - PAD - (y / 9) * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = '', i;
      for (i = 0; i <= 120; i++) { var x = -3 + 6 * i / 120; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(fx(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('line', { x1: px(0), y1: PAD, x2: px(0), y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var xc = state.x0, diverged = false, pts = [], t;
      for (t = 0; t <= state.steps; t++) { pts.push(xc); xc = xc - state.lr * (2 * xc); if (Math.abs(xc) > 3.2) { diverged = true; break; } }
      var pd = '';
      pts.forEach(function (xi, idx) { pd += (idx ? 'L' : 'M') + px(xi).toFixed(1) + ' ' + py(fx(xi)).toFixed(1) + ' '; });
      svg.appendChild(svgEl('path', { d: pd, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }));
      pts.forEach(function (xi, idx) { svg.appendChild(svgEl('circle', { cx: px(xi), cy: py(fx(xi)), r: idx === pts.length - 1 ? '5' : '3', fill: 'var(--blueprint,#3553ff)' })); });
      var last = pts[pts.length - 1];
      var conv = !diverged && Math.abs(last) < 0.05;
      status.innerHTML = diverged ? 'diverged' : (conv ? 'converged' : 'x = ' + last.toFixed(3));
      meta.textContent = diverged ? 'lr too large: each step overshoots the minimum and the loss explodes'
        : 'final loss f(x) = ' + fx(last).toFixed(4) + '  ·  ' + state.steps + ' steps';
      formula.textContent = 'x ← x − lr · 2x   (loss f(x) = x²,  diverges when lr > 1)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'lr', 'learning rate', 0.01, 1.2, 0.01),
      slider(state, 'steps', 'steps', 1, 40, 1),
      slider(state, 'x0', 'start x', -2.9, 2.9, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['GRADIENT DESCENT']), el('span', {}, ['drag the learning rate'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:12px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each step moves downhill by the gradient times the learning rate. Too small and it crawls; too large and it overshoots and diverges. Training is the search for the rate in between.'])
    ]));
    state._render();
  }

  // ── softmax-temperature: divide the logits, reshape the distribution ───────
  function softmaxTemp(host, cfg) {
    var logits = (cfg && cfg.logits) || [3.1, 2.2, 1.5, 0.8, 0.1];
    var labels = (cfg && cfg.labels) || ['cat', 'dog', 'fox', 'owl', 'elk'];
    var state = { T: 1.0 };
    var rows = el('div', {});
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var T = Math.max(0.05, state.T);
      var ex = logits.map(function (z) { return Math.exp(z / T); });
      var sum = ex.reduce(function (a, b) { return a + b; }, 0);
      var p = ex.map(function (e) { return e / sum; });
      var ent = -p.reduce(function (a, pi) { return a + (pi > 0 ? pi * Math.log2(pi) : 0); }, 0);
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      p.forEach(function (pi, i) {
        var bar = el('i'); bar.style.width = (pi * 100).toFixed(1) + '%';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [
          el('label', {}, [labels[i], el('b', {}, [(pi * 100).toFixed(1) + '%'])]),
          el('div', { class: 'lf-bar' }, [bar])
        ]));
      });
      meta.textContent = 'entropy ' + ent.toFixed(2) + ' bits  ·  ' + (T < 0.6 ? 'sharp / confident' : T > 1.6 ? 'flat / random' : 'balanced');
      formula.textContent = 'softmax(zᵢ / T),  T = ' + T.toFixed(2) + '   ·   logits [' + logits.join(', ') + ']';
    };
    var grid = el('div', {}, [slider(state, 'T', 'temperature', 0.1, 3.0, 0.05)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SOFTMAX TEMPERATURE']), el('span', {}, ['drag T'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Temperature divides the logits before the exponential. Below 1 it sharpens the distribution toward the top token; above 1 it flattens toward uniform. At T→0 it is argmax; at T→∞ it is a coin flip.'])
    ]));
    state._render();
  }

  // ── bias-variance: slide model complexity across the U-shaped test error ───
  function biasVariance(host) {
    var state = { d: 6 };
    var W = 520, H = 230, PAD = 34, DMAX = 15;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    function train(d) { return 0.35 + 6.5 / (d + 0.6); }
    function test(d) { return 8.5 / (d + 0.6) + 0.16 * d + 0.35; }
    var best = 1, bv = 1e9, dd;
    for (dd = 1; dd <= DMAX; dd++) { if (test(dd) < bv) { bv = test(dd); best = dd; } }
    var YMAX = Math.max(test(1), train(1), test(DMAX)) + 0.5;
    function px(d) { return PAD + (d - 1) / (DMAX - 1) * (W - 2 * PAD); }
    function py(y) { return H - PAD - (y / YMAX) * (H - 2 * PAD); }
    function curve(fn, stroke) { var d = '', i; for (i = 0; i <= 80; i++) { var x = 1 + (DMAX - 1) * i / 80; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(fn(x)).toFixed(1) + ' '; } return svgEl('path', { d: d, fill: 'none', stroke: stroke, 'stroke-width': '2' }); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: px(best), y1: PAD, x2: px(best), y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(curve(train, 'var(--ink-mute,#999)'));
      svg.appendChild(curve(test, 'var(--blueprint,#3553ff)'));
      svg.appendChild(svgEl('circle', { cx: px(state.d), cy: py(test(state.d)), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      svg.appendChild(svgEl('circle', { cx: px(state.d), cy: py(train(state.d)), r: '4', fill: 'var(--ink-mute,#999)' }));
      var region = state.d < best - 1 ? 'underfit · high bias' : state.d > best + 1 ? 'overfit · high variance' : 'sweet spot';
      status.innerHTML = region + ' <small>· degree ' + state.d + '</small>';
      meta.textContent = 'train err ' + train(state.d).toFixed(2) + '  ·  test err ' + test(state.d).toFixed(2) + '  ·  test min at degree ' + best;
    };
    var grid = el('div', {}, [slider(state, 'd', 'model complexity (polynomial degree)', 1, DMAX, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['BIAS – VARIANCE']), el('span', {}, ['drag complexity'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta])]),
      el('div', { class: 'lf-cap' }, ['Grey is training error, blue is test error. Simple models miss the signal (high bias); complex models fit the noise (high variance). Test error is their sum, lowest where the two pressures balance.'])
    ]));
    state._render();
  }

  // ── l2-regularization: raise lambda, watch every weight shrink ─────────────
  function regL2(host) {
    var base = [1.0, -0.8, 0.65, -0.5, 0.4, -0.3];
    var norm0 = Math.sqrt(base.reduce(function (a, x) { return a + x * x; }, 0));
    var state = { lam: 0 };
    var rows = el('div', { class: 'lf-grid' });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var lam = state.lam;
      var w = base.map(function (b) { return b / (1 + lam); });
      var norm = Math.sqrt(w.reduce(function (a, x) { return a + x * x; }, 0));
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      w.forEach(function (wi, i) {
        var bar = el('i'); bar.style.width = (Math.abs(wi) * 100).toFixed(0) + '%';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [
          el('label', {}, ['w' + (i + 1), el('b', {}, [wi.toFixed(2)])]),
          el('div', { class: 'lf-bar' }, [bar])
        ]));
      });
      var shrink = Math.round((1 - norm / norm0) * 100);
      status.innerHTML = '‖w‖ = ' + norm.toFixed(2) + ' <small>· ' + shrink + '% smaller</small>';
      meta.textContent = lam < 0.05 ? 'λ ≈ 0: full-strength weights, risk of overfitting'
        : lam > 5 ? 'λ large: weights crushed toward 0, model underfits'
          : 'λ shrinks every weight toward zero, trading fit for smoothness';
      formula.textContent = 'J(w) + λ‖w‖²   →   wᵢ ≈ wᵢ⁰ / (1 + λ),  λ = ' + lam.toFixed(2);
    };
    var grid = el('div', {}, [slider(state, 'lam', 'λ  (regularization strength)', 0, 10, 0.1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['L2 REGULARIZATION']), el('span', {}, ['drag λ'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, el('div', { style: 'margin-top:12px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['L2 adds the squared weight norm to the loss. Raising λ pulls every coefficient toward zero, smoothing the model. Too little and it overfits; too much and it forgets the signal.'])
    ]));
    state._render();
  }

  // ── lr-schedule: compare warmup, cosine, step, and exponential decay ───────
  function lrSchedule(host) {
    var N = 1000;
    var state = { sched: 'warmup-cosine', peak: 50, warmup: 10 };
    var W = 520, H = 210, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function lrAt(step, peak) {
      var ws = state.warmup / 100 * N;
      if (state.sched === 'constant') return peak;
      if (state.sched === 'step') return peak * Math.pow(0.5, Math.floor(step / (N / 3)));
      if (state.sched === 'exponential') return peak * Math.exp(-3 * step / N);
      if (state.sched === 'cosine') return peak * 0.5 * (1 + Math.cos(Math.PI * step / N));
      if (step < ws) return peak * (step / Math.max(1, ws));
      var t = (step - ws) / (N - ws); return peak * 0.5 * (1 + Math.cos(Math.PI * t));
    }
    function px(s) { return PAD + s / N * (W - 2 * PAD); }
    function py(v, peak) { return H - PAD - (v / peak) * (H - 2 * PAD); }
    state._render = function () {
      var peak = state.peak / 100;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = '', i;
      for (i = 0; i <= 160; i++) { var s = N * i / 160; d += (i ? 'L' : 'M') + px(s).toFixed(1) + ' ' + py(lrAt(s, peak), peak).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      if (state.sched === 'warmup-cosine') { var wx = px(state.warmup / 100 * N); svg.appendChild(svgEl('line', { x1: wx, y1: PAD, x2: wx, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' })); }
      meta.textContent = 'peak lr ' + peak.toFixed(3) + (state.sched === 'warmup-cosine' ? '  ·  warmup ' + state.warmup + '% of steps' : '') + '  ·  ' + N + ' steps';
      formula.textContent = { constant: 'lr = peak', step: 'lr = peak · 0.5^⌊step / (N/3)⌋', exponential: 'lr = peak · e^(−3·step/N)', cosine: 'lr = peak · ½(1 + cos(π·step/N))', 'warmup-cosine': 'linear warmup → cosine decay to 0' }[state.sched];
    };
    var sel = el('select');
    [['warmup + cosine', 'warmup-cosine'], ['cosine', 'cosine'], ['step decay', 'step'], ['exponential', 'exponential'], ['constant', 'constant']].forEach(function (o) { sel.appendChild(el('option', { value: o[1] }, [o[0]])); });
    sel.value = state.sched;
    sel.addEventListener('change', function () { state.sched = sel.value; state._render(); });
    var grid = el('div', { class: 'lf-grid' }, [
      el('div', { class: 'lf-ctrl' }, [el('label', {}, ['schedule']), sel]),
      slider(state, 'peak', 'peak lr (×10⁻²)', 1, 100, 1),
      slider(state, 'warmup', 'warmup (% steps)', 0, 30, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LR SCHEDULE']), el('span', {}, ['pick a schedule'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The learning rate rarely stays fixed. A short warmup avoids early instability; cosine or step decay then anneals the rate toward zero so late training settles into a good minimum.'])
    ]));
    state._render();
  }

  // ── sampling-decoder: temperature, then top-k, then top-p, over the logits ─
  function samplingDecoder(host, cfg) {
    var logits = (cfg && cfg.logits) || [4.2, 3.6, 3.1, 2.5, 2.0, 1.4, 0.9, 0.4, -0.2, -0.9];
    var labels = (cfg && cfg.labels) || ['the', 'a', 'an', 'this', 'that', 'one', 'some', 'my', 'our', 'its'];
    var state = { T: 0.8, k: 5, p: 0.9 };
    var rows = el('div', {});
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var T = Math.max(0.05, state.T);
      var ex = logits.map(function (z) { return Math.exp(z / T); });
      var sum = ex.reduce(function (a, b) { return a + b; }, 0);
      var probs = ex.map(function (e) { return e / sum; });
      var idx = probs.map(function (p, i) { return i; }).sort(function (a, b) { return probs[b] - probs[a]; });
      var keep = {};
      var kLim = state.k === 0 ? probs.length : state.k;
      var cum = 0, kept = 0;
      idx.forEach(function (i, rank) {
        if (rank < kLim && (cum < state.p || kept === 0)) { keep[i] = true; cum += probs[i]; kept++; }
      });
      var kSum = idx.reduce(function (a, i) { return a + (keep[i] ? probs[i] : 0); }, 0);
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      idx.forEach(function (i) {
        var on = !!keep[i];
        var renorm = on ? probs[i] / kSum : 0;
        var bar = el('i'); bar.style.width = (renorm * 100).toFixed(1) + '%';
        if (!on) bar.style.background = 'var(--rule-soft,#ccc)';
        var lab = el('label', {}, [labels[i] + (on ? '' : ' ·'), el('b', {}, [on ? (renorm * 100).toFixed(1) + '%' : 'cut'])]);
        if (!on) lab.style.opacity = '0.45';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' }, [bar])]));
      });
      meta.textContent = kept + ' of ' + probs.length + ' tokens survive  ·  ' + (T < 0.5 ? 'low T: near-greedy' : T > 1.2 ? 'high T: wild' : 'balanced');
      formula.textContent = 'softmax(z / T) → keep top-' + (state.k === 0 ? '∞' : state.k) + ' → keep until cumulative p ≤ ' + state.p.toFixed(2) + ' → renormalize';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'T', 'temperature', 0.1, 2.0, 0.05),
      slider(state, 'k', 'top-k (0 = off)', 0, 10, 1),
      slider(state, 'p', 'top-p (nucleus)', 0.1, 1.0, 0.05)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SAMPLING DECODER']), el('span', {}, ['temperature → top-k → top-p'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Decoding runs three filters in order. Temperature reshapes the distribution, top-k caps the candidate count, top-p keeps the smallest set covering probability p. What survives is renormalized and sampled from.'])
    ]));
    state._render();
  }

  // ── scaling-laws: Chinchilla loss and the 20-tokens-per-parameter rule ─────
  function scalingLaws(host) {
    var state = { logN: 9, logD: 10.3 };
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M', 'B', 'T', 'P']; var i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }
    state._render = function () {
      var N = Math.pow(10, state.logN), D = Math.pow(10, state.logD);
      var L = 1.69 + 406.4 / Math.pow(N, 0.34) + 410.7 / Math.pow(D, 0.28);
      var C = 6 * N * D;
      var ratio = D / N;
      num.innerHTML = L.toFixed(3) + ' <small>loss</small>';
      var pct = Math.max(2, Math.min(100, (ratio / 20) * 50));
      bar.style.width = pct + '%';
      barWrap.classList.toggle('over', ratio > 30 || ratio < 12);
      meta.textContent = human(ratio) + ' tokens/param  ·  ' + (ratio < 12 ? 'under-trained: too few tokens' : ratio > 30 ? 'over-trained: spend on params instead' : 'near Chinchilla-optimal (~20)');
      formula.textContent = 'N = ' + human(N) + ' params · D = ' + human(D) + ' tokens · compute 6ND ≈ ' + human(C) + ' FLOPs';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'logN', 'parameters (10^x)', 7, 12, 0.1),
      slider(state, 'logD', 'tokens (10^x)', 9, 13, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SCALING LAWS']), el('span', {}, ['drag params and tokens'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The Chinchilla fit predicts loss from parameters and tokens. For a fixed compute budget, loss is lowest near 20 tokens per parameter. Most early large models were badly under-trained: too many parameters, too few tokens.'])
    ]));
    state._render();
  }

  // ── quantization: bits per weight against model size and precision ─────────
  function quantization(host) {
    var state = { logN: 9.85, bits: 16 };
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var GB = 1e9;
    function human(x) { var u = ['', 'K', 'M', 'B', 'T']; var i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }
    state._render = function () {
      var N = Math.pow(10, state.logN);
      var bytesFp32 = N * 4;
      var bytes = N * state.bits / 8;
      var gb = bytes / GB;
      num.innerHTML = gb.toFixed(gb < 10 ? 2 : 1) + ' <small>GB</small>';
      bar.style.width = Math.min(100, state.bits / 32 * 100) + '%';
      var levels = Math.pow(2, state.bits);
      var err = state.bits >= 16 ? 'negligible' : state.bits >= 8 ? '< 1% perplexity hit' : state.bits >= 4 ? 'small with good schemes (GPTQ/AWQ)' : 'large: needs care';
      meta.textContent = Math.round((1 - bytes / bytesFp32) * 100) + '% smaller than fp32  ·  quantization error: ' + err;
      formula.textContent = human(N) + ' params · ' + state.bits + ' bits = ' + (state.bits >= 16 ? '2^' + state.bits : human(levels)) + ' levels per weight';
    };
    var sel = el('select');
    [['fp32 (32-bit)', 32], ['fp16 / bf16 (16-bit)', 16], ['int8 (8-bit)', 8], ['int4 (4-bit)', 4], ['int2 (2-bit)', 2]].forEach(function (o) { sel.appendChild(el('option', { value: o[1] }, [o[0]])); });
    sel.value = state.bits;
    sel.addEventListener('change', function () { state.bits = Number(sel.value); state._render(); });
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'logN', 'parameters (10^x)', 8, 12, 0.05),
      el('div', { class: 'lf-ctrl' }, [el('label', {}, ['precision']), sel])
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['QUANTIZATION']), el('span', {}, ['pick the precision'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each weight costs its bit-width in storage. Halving the bits halves the memory and roughly doubles throughput, while the precision lost grows. 8-bit is nearly free; 4-bit needs careful schemes; below that, accuracy falls off.'])
    ]));
    state._render();
  }

  // ── rope-explorer: rotary frequencies across position and dimension ────────
  function ropeExplorer(host) {
    var state = { pos: 16, logBase: 4 };
    var W = 520, H = 220, PAD = 28, D = 64, SEQ = 64;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var dims = [0, 8, 24, 56];
    function px(s) { return PAD + s / SEQ * (W - 2 * PAD); }
    function py(v) { return H - PAD - (v + 1) / 2 * (H - 2 * PAD); }
    state._render = function () {
      var base = Math.pow(10, state.logBase);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0), x2: W - PAD, y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      dims.forEach(function (di, j) {
        var freq = 1 / Math.pow(base, di / D);
        var d = '', i;
        for (i = 0; i <= 160; i++) { var s = SEQ * i / 160; d += (i ? 'L' : 'M') + px(s).toFixed(1) + ' ' + py(Math.sin(s * freq)).toFixed(1) + ' '; }
        var op = (1 - j * 0.2).toFixed(2);
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', opacity: op }));
      });
      var mx = px(state.pos);
      svg.appendChild(svgEl('line', { x1: mx, y1: PAD, x2: mx, y2: H - PAD, stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      meta.textContent = 'position ' + state.pos + '  ·  base ' + Math.round(base).toLocaleString('en-US') + '  ·  4 of ' + D + ' dimension pairs shown (dark = low dim, fast)';
      formula.textContent = 'θ(pos, i) = pos / base^(2i/d)   ·   low dims rotate fast, high dims slow';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'pos', 'token position', 0, SEQ, 1),
      slider(state, 'logBase', 'base (10^x)', 2, 5, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ROTARY POSITION']), el('span', {}, ['drag position and base'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['RoPE rotates each pair of dimensions by an angle that grows with position. Low dimensions use high frequencies (rotate fast, encode nearby order); high dimensions use low frequencies (rotate slowly, encode long-range distance). Raising the base stretches every wavelength, extending usable context.'])
    ]));
    state._render();
  }

  // ── lora-params: rank against trainable fraction of a weight matrix ────────
  function loraParams(host) {
    var state = { d: 4096, r: 8, layers: 32 };
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M', 'B']; var i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 2 : 1) + u[i]; }
    state._render = function () {
      var mats = 2 * state.layers; // q and v projections per layer
      var full = mats * state.d * state.d;
      var lora = mats * 2 * state.d * state.r;
      var frac = lora / full * 100;
      num.innerHTML = frac.toFixed(frac < 1 ? 3 : 2) + ' <small>% trainable</small>';
      bar.style.width = Math.min(100, frac * 8) + '%';
      meta.textContent = human(lora) + ' trainable of ' + human(full) + ' frozen  ·  ' + Math.round(full / lora) + 'x fewer gradients to store';
      formula.textContent = 'ΔW = B·A,  A∈ℝ^{r×d}, B∈ℝ^{d×r}  →  2·d·r per matrix vs d²  =  2r/d = ' + (2 * state.r / state.d * 100).toFixed(3) + '%';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'd', 'model dim d', 512, 8192, 128),
      slider(state, 'r', 'LoRA rank r', 1, 128, 1),
      slider(state, 'layers', 'layers (q,v each)', 1, 96, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LORA RANK']), el('span', {}, ['drag the rank'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['LoRA freezes the d×d weight and trains a low-rank update B·A with only 2·d·r parameters. The trainable fraction is 2r/d, so a rank of 8 on a 4096-dim model trains well under one percent of the weights while keeping most of the quality.'])
    ]));
    state._render();
  }

  // ── precision-recall-threshold: slide the cutoff, watch P, R, F1 trade ─────
  function precisionRecall(host) {
    var state = { thr: 0.5 };
    var muP = 0.64, muN = 0.36, sd = 0.13, Npos = 100, Nneg = 100;
    var W = 520, H = 210, PAD = 28;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
    function cdf(x, mu) { return 0.5 * (1 + erf((x - mu) / (sd * Math.SQRT2))); }
    function gauss(x, mu) { return Math.exp(-0.5 * Math.pow((x - mu) / sd, 2)); }
    function px(x) { return PAD + x * (W - 2 * PAD); }
    function py(v) { return H - PAD - v * (H - 2 * PAD); }
    state._render = function () {
      var tp = Npos * (1 - cdf(state.thr, muP));
      var fp = Nneg * (1 - cdf(state.thr, muN));
      var fn = Npos - tp;
      var prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1);
      var f1 = 2 * prec * rec / ((prec + rec) || 1);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      [{ mu: muN, st: 'var(--ink-mute,#999)' }, { mu: muP, st: 'var(--blueprint,#3553ff)' }].forEach(function (g) {
        var d = '', i; for (i = 0; i <= 120; i++) { var x = i / 120; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(gauss(x, g.mu)).toFixed(1) + ' '; }
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: g.st, 'stroke-width': '2' }));
      });
      var tx = px(state.thr);
      svg.appendChild(svgEl('line', { x1: tx, y1: PAD, x2: tx, y2: H - PAD, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
      status.innerHTML = 'F1 = ' + f1.toFixed(3);
      meta.textContent = 'precision ' + prec.toFixed(2) + '  ·  recall ' + rec.toFixed(2) + '  ·  TP ' + Math.round(tp) + ' · FP ' + Math.round(fp) + ' · FN ' + Math.round(fn);
      formula.textContent = 'predict positive when score ≥ ' + state.thr.toFixed(2) + '   ·   raise it for precision, lower it for recall';
    };
    var grid = el('div', {}, [slider(state, 'thr', 'decision threshold', 0.02, 0.98, 0.01)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['PRECISION / RECALL']), el('span', {}, ['drag the threshold'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Grey is the negative class, blue the positive; the orange line is the threshold. Move it right and you predict positive less often: precision rises, recall falls. F1 is their harmonic mean, highest where the two curves cross.'])
    ]));
    state._render();
  }

  // ── cross-entropy-loss: the price of being confident and wrong ─────────────
  function crossEntropy(host) {
    var state = { p: 0.5 };
    var W = 520, H = 200, PAD = 30, LMAX = 5;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(p) { return PAD + p * (W - 2 * PAD); }
    function py(l) { return H - PAD - Math.min(l, LMAX) / LMAX * (H - 2 * PAD); }
    state._render = function () {
      var p = Math.max(0.001, state.p);
      var loss = -Math.log(p);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = '', i; for (i = 0; i <= 140; i++) { var x = 0.007 + (1 - 0.007) * i / 140; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(-Math.log(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('circle', { cx: px(p), cy: py(loss), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      num.innerHTML = loss.toFixed(3) + ' <small>nats</small>';
      meta.textContent = p > 0.9 ? 'confident and correct: loss near zero' : p < 0.1 ? 'confident and wrong: loss explodes' : 'uncertain: moderate loss';
      formula.textContent = 'loss = −log(p_true),  p = ' + p.toFixed(3) + '   ·   p→1 gives 0, p→0 gives ∞';
    };
    var grid = el('div', {}, [slider(state, 'p', 'probability on the true class', 0.01, 1.0, 0.01)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CROSS-ENTROPY LOSS']), el('span', {}, ['drag the probability'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Cross-entropy charges −log of the probability the model put on the correct answer. Right and confident costs almost nothing; wrong and confident costs a fortune. That asymmetry is what pushes the model to be calibrated, not just correct.'])
    ]));
    state._render();
  }

  // ── cosine-similarity: the angle is the similarity ─────────────────────────
  function cosineSim(host) {
    var state = { deg: 40 };
    var W = 300, H = 240, CX = 60, CY = 150, R = 110;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    function vec(x2, y2, st) { return svgEl('line', { x1: CX, y1: CY, x2: x2, y2: y2, stroke: st, 'stroke-width': '2.5' }); }
    state._render = function () {
      var rad = state.deg * Math.PI / 180;
      var cos = Math.cos(rad);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('path', { d: 'M ' + (CX + 30) + ' ' + CY + ' A 30 30 0 0 0 ' + (CX + 30 * cos) + ' ' + (CY - 30 * Math.sin(rad)), fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.5' }));
      svg.appendChild(vec(CX + R, CY, 'var(--ink-mute,#999)'));
      svg.appendChild(vec(CX + R * cos, CY - R * Math.sin(rad), 'var(--blueprint,#3553ff)'));
      num.innerHTML = cos.toFixed(3) + ' <small>cos θ</small>';
      meta.textContent = state.deg + '°  ·  ' + (cos > 0.7 ? 'similar' : cos > 0.1 ? 'loosely related' : cos > -0.1 ? 'unrelated (orthogonal)' : 'opposite');
    };
    var grid = el('div', {}, [slider(state, 'deg', 'angle between vectors', 0, 180, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['COSINE SIMILARITY']), el('span', {}, ['drag the angle'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta])]),
      el('div', { class: 'lf-cap' }, ['Embeddings compare by angle, not distance. Cosine is 1 when two vectors point the same way, 0 when orthogonal (unrelated), and negative when opposed. Magnitude drops out, so a long document and a short query can still match.'])
    ]));
    state._render();
  }

  // ── tokenizer-tradeoff: vocabulary size against tokens and table cost ──────
  function tokenizerTradeoff(host) {
    var state = { logV: 15, dim: 768 };
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M', 'B']; var i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }
    state._render = function () {
      var vocab = Math.pow(2, state.logV);
      var tpw = Math.max(1.0, 1 + 6 / (state.logV - 5));
      var docWords = 1000;
      var seq = Math.round(docWords * tpw);
      var emb = vocab * state.dim;
      num.innerHTML = human(emb) + ' <small>embedding params</small>';
      meta.textContent = tpw.toFixed(2) + ' tokens/word  ·  a ' + docWords + '-word doc ≈ ' + seq + ' tokens';
      formula.textContent = 'vocab ' + human(vocab) + ' × dim ' + state.dim + ' = embedding table  ·  bigger vocab → fewer tokens, larger table';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'logV', 'vocabulary (2^x)', 8, 18, 1),
      slider(state, 'dim', 'embedding dim', 128, 4096, 128)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TOKENIZER TRADEOFF']), el('span', {}, ['drag the vocab size'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A larger vocabulary splits text into fewer tokens, so sequences are shorter and cheaper to attend over. But the embedding and output tables scale with vocab size, so the gain is paid back in parameters. Real tokenizers sit where the two pressures balance, around 32K to 128K.'])
    ]));
    state._render();
  }

  // ── rag-chunking: chunk size and overlap against count and context ─────────
  function ragChunking(host) {
    var state = { chunk: 512, overlap: 64, topk: 5 };
    var corpus = 100000;
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M']; var i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }
    state._render = function () {
      var ov = Math.min(state.overlap, state.chunk - 16);
      var stride = state.chunk - ov;
      var nChunks = Math.ceil((corpus - ov) / stride);
      var ctx = state.topk * state.chunk;
      num.innerHTML = fmtInt(nChunks) + ' <small>chunks</small>';
      meta.textContent = 'top-' + state.topk + ' retrieval feeds ' + fmtInt(ctx) + ' tokens into the prompt  ·  ' + human(nChunks) + ' vectors to store';
      formula.textContent = 'chunks = ⌈(corpus − overlap) / (chunk − overlap)⌉  ·  corpus = ' + human(corpus) + ' tokens';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'chunk', 'chunk size (tokens)', 64, 2048, 32),
      slider(state, 'overlap', 'overlap (tokens)', 0, 256, 8),
      slider(state, 'topk', 'top-k retrieved', 1, 20, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['RAG CHUNKING']), el('span', {}, ['drag chunk and k'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Small chunks pinpoint the relevant passage but fragment context and multiply the vectors to index. Large chunks keep context whole but dilute each match and blow up the tokens fed into the prompt. Overlap softens boundaries at the cost of more chunks.'])
    ]));
    state._render();
  }

  // Interactive widgets defined here. Animated figures live in figures.js and
  // are reached through window.AIFS_FIGURES (same fenced-block syntax).
  var FIGS = {
    'kv-cache-sizer': kvCache,
    'gradient-descent': gradDescent,
    'softmax-temperature': softmaxTemp,
    'bias-variance': biasVariance,
    'l2-regularization': regL2,
    'lr-schedule': lrSchedule,
    'sampling-decoder': samplingDecoder,
    'scaling-laws': scalingLaws,
    'quantization': quantization,
    'rope-explorer': ropeExplorer,
    'lora-params': loraParams,
    'precision-recall-threshold': precisionRecall,
    'cross-entropy-loss': crossEntropy,
    'cosine-similarity': cosineSim,
    'tokenizer-tradeoff': tokenizerTradeoff,
    'rag-chunking': ragChunking
  };

  function mountLessonFigures(root) {
    ensureStyles();
    (root || document).querySelectorAll('.lesson-figure[data-figure]').forEach(function (host) {
      if (host.dataset.lfMounted) return;
      var parts = (host.dataset.figure || '').trim().split(/\s+/);
      var name = parts[0];
      var cfg = {};
      var rest = host.dataset.figure.trim().slice(name.length).trim();
      if (rest) { try { cfg = JSON.parse(rest); } catch (e) {} }

      var local = FIGS[name];
      var animated = window.AIFS_FIGURES && window.AIFS_FIGURES[name];
      try {
        if (local) {
          local(host, cfg);
        } else if (animated) {
          host.classList.add('lf-animated');
          animated(host, cfg);
        } else {
          return; // unknown figure; leave the empty host out
        }
        host.dataset.lfMounted = '1';
      } catch (e) {
        console.warn('lesson figure "' + name + '" failed:', e);
      }
    });
  }

  // Register more widgets from external module files (figures-<topic>.js).
  // Modules load after this file and call LF.register({ 'name': fn, ... }).
  function register(obj) { for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) FIGS[k] = obj[k]; }

  window.mountLessonFigures = mountLessonFigures;
  window.LESSON_FIGURES = FIGS;
  // Shared toolkit for figure module files. Vanilla, no deps, theme via CSS vars.
  window.LF = {
    el: el, svgEl: svgEl, slider: slider, select: select,
    fmtInt: fmtInt, fmtSeq: fmtSeq, clamp: clamp, lerp: lerp, raf: raf,
    register: register
  };
})();
