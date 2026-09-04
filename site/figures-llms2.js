/* figures-llms2.js: a second batch of interactive lesson figures for Phase 10
   (LLMs from scratch). Loads after lesson-figures.js and registers through
   window.LF.register. Vanilla ES5, no deps, theme via CSS vars. Authoring is
   the same fenced block:
       ```figure
       rmsnorm-vs-layernorm
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, select = LF.select, fmtInt = LF.fmtInt;

  // ── rmsnorm-vs-layernorm: center+scale vs scale-only over a feature vector ─
  function rmsnormVsLayernorm(host) {
    var feats = [2.4, -1.2, 0.8, 3.1, -0.6, 1.7];
    var state = { mode: 'rmsnorm', shift: 0 };
    var W = 520, H = 200, PAD = 28, N = feats.length;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(i) { return PAD + (i + 0.5) / N * (W - 2 * PAD); }
    function py(v) { return H / 2 - v * 22; }
    state._render = function () {
      var x = feats.map(function (f) { return f + state.shift; });
      var mean = x.reduce(function (a, b) { return a + b; }, 0) / N;
      var ss = x.reduce(function (a, b) { return a + b * b; }, 0) / N;
      var meanSq = x.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / N;
      var rms = Math.sqrt(ss + 1e-5);
      var std = Math.sqrt(meanSq + 1e-5);
      var out;
      if (state.mode === 'rmsnorm') { out = x.map(function (v) { return v / rms; }); }
      else { out = x.map(function (v) { return (v - mean) / std; }); }
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0), x2: W - PAD, y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var i;
      for (i = 0; i < N; i++) {
        svg.appendChild(svgEl('rect', { x: (px(i) - 9).toFixed(1), y: Math.min(py(0), py(x[i])).toFixed(1), width: '6', height: Math.abs(py(x[i]) - py(0)).toFixed(1), fill: 'var(--ink-mute,#999)', opacity: '0.6' }));
        svg.appendChild(svgEl('rect', { x: (px(i) + 3).toFixed(1), y: Math.min(py(0), py(out[i])).toFixed(1), width: '6', height: Math.abs(py(out[i]) - py(0)).toFixed(1), fill: 'var(--blueprint,#3553ff)' }));
      }
      var outMean = out.reduce(function (a, b) { return a + b; }, 0) / N;
      num.innerHTML = (state.mode === 'rmsnorm' ? 'RMS ' + rms.toFixed(2) : 'std ' + std.toFixed(2)) + ' <small>divisor</small>';
      meta.textContent = state.mode === 'rmsnorm'
        ? 'no mean subtraction: output mean ' + outMean.toFixed(2) + ' (shift survives) · cheaper, no centering'
        : 'mean ' + mean.toFixed(2) + ' subtracted first: output mean ' + outMean.toFixed(2) + ' (recentered to 0)';
      formula.textContent = state.mode === 'rmsnorm'
        ? 'RMSNorm: xᵢ / sqrt(mean(x²) + ε)   ·   skips the mean, keeps the scale'
        : 'LayerNorm: (xᵢ − mean) / sqrt(var + ε)   ·   center then scale';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      select(state, 'mode', 'normalization', [['RMSNorm', 'rmsnorm'], ['LayerNorm', 'layernorm']]),
      slider(state, 'shift', 'add a constant shift', -2, 2, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['RMSNORM vs LAYERNORM']), el('span', {}, ['toggle and shift'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Grey is the raw feature vector, blue the normalized output. LayerNorm subtracts the mean then divides by the standard deviation, recentering every vector to zero. RMSNorm skips the mean entirely and divides by the root-mean-square, so it is cheaper and keeps any constant shift. Add a shift and watch LayerNorm absorb it while RMSNorm lets it through.'])
    ]));
    state._render();
  }

  // ── swiglu-ffn: a gate path modulates a value path, vs plain ReLU ──────────
  function swigluFfn(host) {
    var state = { x: 1.2, mode: 'swiglu' };
    var W = 520, H = 200, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var wV = 1.0, wG = 0.8;
    function swish(z) { return z / (1 + Math.exp(-z)); }
    function relu(z) { return z > 0 ? z : 0; }
    function out(x) {
      var v = x * wV;
      if (state.mode === 'swiglu') { return v * swish(x * wG); }
      return relu(v);
    }
    function px(x) { return PAD + (x + 4) / 8 * (W - 2 * PAD); }
    function py(y) { return H - PAD - (y + 4) / 8 * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: px(-4), y1: py(0), x2: px(4), y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: px(0), y1: py(-4), x2: px(0), y2: py(4), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var d = '', i;
      for (i = 0; i <= 160; i++) { var x = -4 + 8 * i / 160; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(out(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var y = out(state.x);
      svg.appendChild(svgEl('circle', { cx: px(state.x), cy: py(y), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      var v = state.x * wV, g = swish(state.x * wG);
      num.innerHTML = y.toFixed(3) + ' <small>output</small>';
      meta.textContent = state.mode === 'swiglu'
        ? 'value path ' + v.toFixed(2) + ' × gate swish(' + (state.x * wG).toFixed(2) + ') = ' + g.toFixed(2) + '  →  ' + y.toFixed(2)
        : 'plain FFN: ReLU(' + v.toFixed(2) + ') = ' + y.toFixed(2) + ' (no gate)';
      formula.textContent = state.mode === 'swiglu'
        ? 'SwiGLU: (x·W) ⊙ swish(x·V)   ·   the gate smoothly modulates the value'
        : 'ReLU FFN: max(0, x·W)   ·   a hard cutoff, no second path';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      select(state, 'mode', 'feed-forward', [['SwiGLU (gated)', 'swiglu'], ['ReLU (plain)', 'relu']]),
      slider(state, 'x', 'input x', -4, 4, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SWIGLU FEED-FORWARD']), el('span', {}, ['toggle and drag x'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A plain FFN runs the input through one matrix and a ReLU: a hard kink at zero. SwiGLU splits into two paths from the same input, a value x·W and a gate swish(x·V), and multiplies them. The gate smoothly scales the value up or down per coordinate, giving the network a soft, learnable on-off switch that modern open models prefer over a flat ReLU.'])
    ]));
    state._render();
  }

  // ── rlhf-pipeline: SFT → reward model → PPO, three stages with data flow ────
  function rlhfPipeline(host) {
    var state = { stage: 0 };
    var W = 520, H = 210, PAD = 18;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var STAGES = [
      { name: 'SFT', sub: 'supervised fine-tune', data: 'demonstrations', out: 'policy π₀' },
      { name: 'Reward', sub: 'train reward model', data: 'preference pairs', out: 'reward r(x,y)' },
      { name: 'PPO', sub: 'RL optimization', data: 'prompts + reward', out: 'aligned policy π' }
    ];
    var DESC = [
      'Stage 1 — SFT: fine-tune the base model on human-written demonstrations to get a starting policy.',
      'Stage 2 — Reward Model: train a model on chosen-vs-rejected pairs to score how good a response is.',
      'Stage 3 — PPO: optimize the policy against the reward model with a KL penalty back to the SFT policy.'
    ];
    function box(x, y, w, h, label, sub, active) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4',
        fill: active ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)',
        stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2' }));
      var t = svgEl('text', { x: (x + w / 2).toFixed(1), y: (y + 20).toFixed(1), 'text-anchor': 'middle',
        'font-family': 'monospace', 'font-size': '12', fill: active ? 'var(--bg,#fafaf5)' : 'var(--ink,#1a1a1a)' });
      t.appendChild(document.createTextNode(label));
      g.appendChild(t);
      var s = svgEl('text', { x: (x + w / 2).toFixed(1), y: (y + 36).toFixed(1), 'text-anchor': 'middle',
        'font-family': 'monospace', 'font-size': '9', fill: active ? 'var(--bg,#fafaf5)' : 'var(--ink-mute,#777)' });
      s.appendChild(document.createTextNode(sub));
      g.appendChild(s);
      return g;
    }
    function caption(x, y, txt, st) {
      var t = svgEl('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle',
        'font-family': 'monospace', 'font-size': '9.5', fill: st });
      t.appendChild(document.createTextNode(txt));
      return t;
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var bw = 134, bh = 48, gap = (W - 2 * PAD - 3 * bw) / 2, midY = 80;
      var i, xs = [];
      for (i = 0; i < 3; i++) { xs.push(PAD + i * (bw + gap)); }
      for (i = 0; i < 3; i++) {
        svg.appendChild(box(xs[i], midY, bw, bh, STAGES[i].name, STAGES[i].sub, i === state.stage));
        svg.appendChild(caption(xs[i] + bw / 2, midY - 14, STAGES[i].data + ' →', 'var(--ink-mute,#777)'));
        svg.appendChild(caption(xs[i] + bw / 2, midY + bh + 18, '→ ' + STAGES[i].out, 'var(--ink-soft,#555)'));
        if (i < 2) {
          var ax = xs[i] + bw, bx = xs[i + 1];
          svg.appendChild(svgEl('line', { x1: ax, y1: midY + bh / 2, x2: bx, y2: midY + bh / 2, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
          svg.appendChild(svgEl('polygon', { points: bx + ',' + (midY + bh / 2) + ' ' + (bx - 8) + ',' + (midY + bh / 2 - 4) + ' ' + (bx - 8) + ',' + (midY + bh / 2 + 4), fill: 'var(--blueprint,#3553ff)' }));
        }
      }
      meta.textContent = DESC[state.stage];
      formula.textContent = 'SFT(demos) → RM(preferences) → PPO(maximize reward − β·KL[π ‖ π₀])';
    };
    var grid = el('div', {}, [slider(state, 'stage', 'pipeline stage', 0, 2, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['RLHF PIPELINE']), el('span', {}, ['step through the stages'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['RLHF runs in three stages. First supervised fine-tuning teaches the base model to follow instructions from human demonstrations. Then a reward model learns to score responses from preference pairs. Finally PPO optimizes the policy to maximize that reward while a KL penalty keeps it close to the SFT model so it does not drift into reward hacking.'])
    ]));
    state._render();
  }

  // ── dpo-loss: margin between chosen and rejected, scaled by beta ───────────
  function dpoLoss(host) {
    var state = { beta: 0.3, gap: 0.0 };
    var W = 520, H = 200, PAD = 32, GMAX = 6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
    function loss(gap, beta) { return -Math.log(sigmoid(beta * gap)); }
    function px(g) { return PAD + (g + GMAX) / (2 * GMAX) * (W - 2 * PAD); }
    var LMAX = loss(-GMAX, state.beta);
    function py(l, lmax) { return H - PAD - Math.min(l, lmax) / lmax * (H - 2 * PAD); }
    state._render = function () {
      var beta = state.beta;
      var lmax = Math.max(0.5, loss(-GMAX, beta));
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: px(0), y1: PAD, x2: px(0), y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var d = '', i;
      for (i = 0; i <= 160; i++) { var g = -GMAX + 2 * GMAX * i / 160; d += (i ? 'L' : 'M') + px(g).toFixed(1) + ' ' + py(loss(g, beta), lmax).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var l = loss(state.gap, beta);
      svg.appendChild(svgEl('circle', { cx: px(state.gap), cy: py(l, lmax), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      num.innerHTML = l.toFixed(3) + ' <small>DPO loss</small>';
      meta.textContent = state.gap > 0.5 ? 'chosen ahead of rejected: loss small, model already prefers the right answer'
        : state.gap < -0.5 ? 'rejected ahead of chosen: loss large, strong gradient to fix it'
          : 'tie: loss ≈ ' + loss(0, beta).toFixed(2) + ' (−log ½ scaled by β)';
      formula.textContent = 'L = −log σ( β · ( (logπ(yc) − logπref(yc)) − (logπ(yr) − logπref(yr)) ) )   ·   β = ' + beta.toFixed(2);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'beta', 'β (KL strength)', 0.05, 1.0, 0.05),
      slider(state, 'gap', 'chosen − rejected margin', -GMAX, GMAX, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['DPO LOSS']), el('span', {}, ['drag β and the margin'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['DPO skips the separate reward model: it directly trains the policy so the chosen response outscores the rejected one, both measured relative to a frozen reference. The loss is −log σ of β times that margin. A positive margin (chosen ahead) drives the loss toward zero; a negative one pushes a large gradient. β controls how hard the implicit KL constraint pulls back toward the reference.'])
    ]));
    state._render();
  }

  // ── paged-kv-cache: fixed pages vs contiguous, fragmentation and waste ─────
  function pagedKvCache(host) {
    var state = { seq: 70, page: 16 };
    var W = 520, H = 210, PAD = 18;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var SLOTS = 128; // a contiguous reservation must over-allocate to max length
    var MAXLEN = 128;
    state._render = function () {
      var seq = state.seq, page = state.page;
      var pages = Math.ceil(seq / page);
      var paged = pages * page;
      var pagedWaste = paged - seq;
      var contigWaste = MAXLEN - seq; // contiguous reserves the full max up front
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var cols = 32, cw = (W - 2 * PAD) / cols, ch = 12;
      // contiguous row: one reservation of MAXLEN, used part blue, reserved-but-empty grey
      var rowY = 40, i;
      var ttop = svgEl('text', { x: PAD, y: (rowY - 8).toFixed(1), 'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink-mute,#777)' });
      ttop.appendChild(document.createTextNode('contiguous: reserve max length up front'));
      svg.appendChild(ttop);
      for (i = 0; i < MAXLEN; i++) {
        var cx = PAD + (i % cols) * cw, cy = rowY + Math.floor(i / cols) * (ch + 2);
        svg.appendChild(svgEl('rect', { x: cx.toFixed(1), y: cy.toFixed(1), width: (cw - 2).toFixed(1), height: ch, rx: '1',
          fill: i < seq ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ccc)', opacity: i < seq ? '0.9' : '0.5' }));
      }
      // paged row: pages allocated on demand, only the last page partly wasted
      var rowY2 = rowY + 4 * (ch + 2) + 30;
      var tbot = svgEl('text', { x: PAD, y: (rowY2 - 8).toFixed(1), 'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink-mute,#777)' });
      tbot.appendChild(document.createTextNode('paged: ' + pages + ' pages of ' + page + ', only the last partly free'));
      svg.appendChild(tbot);
      for (i = 0; i < paged; i++) {
        var px2 = PAD + (i % cols) * cw, py2 = rowY2 + Math.floor(i / cols) * (ch + 2);
        var usedCell = i < seq;
        svg.appendChild(svgEl('rect', { x: px2.toFixed(1), y: py2.toFixed(1), width: (cw - 2).toFixed(1), height: ch, rx: '1',
          fill: usedCell ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)', opacity: usedCell ? '0.9' : '0.55' }));
        if (i % page === 0) {
          svg.appendChild(svgEl('line', { x1: px2.toFixed(1), y1: py2.toFixed(1), x2: px2.toFixed(1), y2: (py2 + ch).toFixed(1), stroke: 'var(--ink,#1a1a1a)', 'stroke-width': '1' }));
        }
      }
      var savedPct = Math.round((1 - paged / MAXLEN) * 100);
      num.innerHTML = pagedWaste + ' <small>cells wasted (paged)</small>';
      bar.style.width = Math.max(2, Math.min(100, savedPct)) + '%';
      meta.textContent = 'contiguous wastes ' + contigWaste + ' reserved cells · paged wastes only ' + pagedWaste
        + ' (last page) · ' + savedPct + '% less reserved memory';
      formula.textContent = 'pages = ⌈seq / page⌉ = ⌈' + seq + ' / ' + page + '⌉ = ' + pages
        + '  ·  internal waste ≤ page − 1 per sequence, not max − seq';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'seq', 'sequence length', 1, MAXLEN, 1),
      slider(state, 'page', 'page (block) size', 4, 32, 4)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['PAGED KV CACHE']), el('span', {}, ['drag length and page size'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A contiguous KV cache reserves the full maximum sequence length per request up front, so most of it sits empty (grey). PagedAttention stores the cache in fixed-size pages allocated on demand: only the final page is partly free (orange). Internal waste drops from max minus length to at most one page, which is why paged caches fit far more concurrent sequences on the same GPU.'])
    ]));
    state._render();
  }

  // ── expert-capacity: capacity factor vs tokens, dropped vs wasted slots ─────
  function expertCapacity(host) {
    var state = { cap: 1.25, tokens: 64 };
    var W = 520, H = 200, PAD = 24, E = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // deterministic skewed routing: expert e gets a fixed share of tokens
    var SHARE = [0.22, 0.18, 0.15, 0.13, 0.11, 0.09, 0.07, 0.05];
    state._render = function () {
      var T = state.tokens, cap = state.cap;
      var perExpert = Math.floor(cap * T / E); // capacity slots per expert
      var loads = SHARE.map(function (s) { return Math.round(s * T); });
      var sum = loads.reduce(function (a, b) { return a + b; }, 0);
      loads[0] += (T - sum); // keep total exactly T
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var bw = (W - 2 * PAD) / E - 8, dropped = 0, wasted = 0, e;
      var maxBar = H - 2 * PAD;
      var capRef = Math.max(1, Math.max.apply(null, loads), perExpert);
      var capY = H - PAD - perExpert / capRef * maxBar;
      for (e = 0; e < E; e++) {
        var x = PAD + e * ((W - 2 * PAD) / E) + 4;
        var load = loads[e];
        var routed = Math.min(load, perExpert);
        var over = Math.max(0, load - perExpert);
        dropped += over; wasted += Math.max(0, perExpert - load);
        var hUsed = routed / capRef * maxBar;
        svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: (H - PAD - hUsed).toFixed(1), width: bw.toFixed(1), height: hUsed.toFixed(1), fill: 'var(--blueprint,#3553ff)', opacity: '0.9' }));
        if (over > 0) {
          var hOver = over / capRef * maxBar;
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: (H - PAD - hUsed - hOver).toFixed(1), width: bw.toFixed(1), height: hOver.toFixed(1), fill: 'var(--warn,#b8870f)', opacity: '0.7' }));
        }
      }
      svg.appendChild(svgEl('line', { x1: PAD, y1: capY.toFixed(1), x2: W - PAD, y2: capY.toFixed(1), stroke: 'var(--ink,#1a1a1a)', 'stroke-width': '1', 'stroke-dasharray': '4 3' }));
      num.innerHTML = dropped + ' <small>tokens dropped</small>';
      meta.textContent = 'capacity ' + perExpert + ' / expert · dropped ' + dropped + ' (overflow, orange) · idle ' + wasted
        + ' slots (wasted compute) · ' + (cap < 1 ? 'too tight' : cap > 1.5 ? 'too loose' : 'balanced');
      formula.textContent = 'capacity = ⌊capacity_factor · tokens / experts⌋ = ⌊' + cap.toFixed(2) + ' · ' + T + ' / ' + E + '⌋ = ' + perExpert;
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'cap', 'capacity factor', 0.5, 2.0, 0.05),
      slider(state, 'tokens', 'tokens in batch', 16, 128, 8)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['EXPERT CAPACITY']), el('span', {}, ['drag capacity and tokens'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each expert in an MoE layer gets a fixed number of token slots, set by the capacity factor. Routing is uneven, so popular experts overflow and the extra tokens are dropped (orange above the dashed line). Set the factor too low and you drop many tokens; set it too high and lightly-loaded experts sit idle, wasting padded compute. The factor is tuned to keep both small.'])
    ]));
    state._render();
  }

  // ── sliding-window-attention: banded mask of width w vs full O(N^2) ────────
  function slidingWindowAttention(host) {
    var state = { window: 4 };
    var W = 520, H = 240, PAD = 24, N = 16;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var GRID = 200;
    state._render = function () {
      var w = state.window;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var ox = PAD, oy = (H - GRID) / 2, cell = GRID / N;
      var active = 0, full = 0, i, j;
      for (i = 0; i < N; i++) {
        for (j = 0; j < N; j++) {
          var causal = j <= i;
          if (causal) full++;
          var inWindow = causal && (i - j) < w;
          if (inWindow) active++;
          var fill;
          if (inWindow) fill = 'var(--blueprint,#3553ff)';
          else if (causal) fill = 'var(--rule-soft,#ccc)';
          else fill = 'var(--bg,#fafaf5)';
          svg.appendChild(svgEl('rect', { x: (ox + j * cell).toFixed(1), y: (oy + i * cell).toFixed(1),
            width: (cell - 1).toFixed(1), height: (cell - 1).toFixed(1),
            fill: fill, opacity: inWindow ? '0.9' : '0.5' }));
        }
      }
      svg.appendChild(svgEl('rect', { x: ox, y: oy.toFixed(1), width: GRID, height: GRID, fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1' }));
      var saved = Math.round((1 - active / full) * 100);
      num.innerHTML = active + ' <small>of ' + full + ' attended pairs</small>';
      meta.textContent = 'window w = ' + w + ' · each token sees the previous ' + (w - 1) + ' plus itself · '
        + saved + '% fewer pairs than full causal attention';
      formula.textContent = 'attend(i, j) iff 0 ≤ i − j < w   ·   cost O(N·w) vs full O(N²) when w ≪ N';
    };
    var grid = el('div', {}, [slider(state, 'window', 'window size w', 1, N, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SLIDING WINDOW ATTENTION']), el('span', {}, ['drag the window width'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Rows are queries, columns are keys. Blue cells are the pairs a token actually attends to; grey cells are inside the causal triangle but cut by the window; white is the future, always masked. Full causal attention fills the whole lower triangle at O(N²) cost. A sliding window of width w keeps only the banded diagonal, dropping to O(N·w) so long context stays affordable.'])
    ]));
    state._render();
  }

  // ── differential-attention: two softmax maps subtracted, λ cancels noise ────
  function differentialAttention(host) {
    var state = { lambda: 0.6 };
    var W = 520, H = 200, PAD = 30, N = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // map1: a real signal peak at token 2 plus broad noise; map2: the same broad noise
    var sig = [0.04, 0.06, 0.55, 0.07, 0.05, 0.07, 0.06, 0.10];
    var noise = [0.10, 0.13, 0.11, 0.14, 0.12, 0.15, 0.13, 0.12];
    function norm(a) { var s = a.reduce(function (x, y) { return x + y; }, 0); return a.map(function (v) { return v / s; }); }
    state._render = function () {
      var lam = state.lambda;
      var m1 = norm(sig.map(function (v, i) { return v + noise[i]; }));
      var m2 = norm(noise.slice());
      var diff = m1.map(function (v, i) { return Math.max(0, v - lam * m2[i]); });
      var ds = diff.reduce(function (a, b) { return a + b; }, 0) || 1;
      var out = diff.map(function (v) { return v / ds; });
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var cw = (W - 2 * PAD) / N;
      var i, peak = out[2];
      var maxV = Math.max.apply(null, out.concat(m1));
      for (i = 0; i < N; i++) {
        var x = PAD + i * cw;
        var h1 = m1[i] / maxV * 60;
        svg.appendChild(svgEl('rect', { x: (x + 2).toFixed(1), y: (90 - h1).toFixed(1), width: (cw / 2 - 3).toFixed(1), height: h1.toFixed(1), fill: 'var(--ink-mute,#999)', opacity: '0.6' }));
        var ho = out[i] / maxV * 60;
        svg.appendChild(svgEl('rect', { x: (x + cw / 2).toFixed(1), y: (170 - ho).toFixed(1), width: (cw / 2 - 3).toFixed(1), height: ho.toFixed(1), fill: 'var(--blueprint,#3553ff)' }));
      }
      var t1 = svgEl('text', { x: PAD, y: '24', 'font-family': 'monospace', 'font-size': '9.5', fill: 'var(--ink-mute,#777)' });
      t1.appendChild(document.createTextNode('map 1 (signal + noise)'));
      svg.appendChild(t1);
      var t2 = svgEl('text', { x: PAD, y: '104', 'font-family': 'monospace', 'font-size': '9.5', fill: 'var(--blueprint,#3553ff)' });
      t2.appendChild(document.createTextNode('map1 − λ·map2 (denoised)'));
      svg.appendChild(t2);
      num.innerHTML = (peak * 100).toFixed(0) + ' <small>% mass on the true token</small>';
      meta.textContent = lam < 0.3 ? 'λ small: little subtracted, broad noise survives'
        : lam > 0.9 ? 'λ large: aggressive cancellation, signal sharpened'
          : 'λ = ' + lam.toFixed(2) + ': common-mode noise cancels, the real peak stands out';
      formula.textContent = 'Attn = softmax(Q₁K₁) − λ · softmax(Q₂K₂)   ·   shared noise subtracts, signal remains';
    };
    var grid = el('div', {}, [slider(state, 'lambda', 'λ (subtraction weight)', 0, 1.0, 0.05)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['DIFFERENTIAL ATTENTION']), el('span', {}, ['drag λ'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Differential attention computes two separate softmax maps and subtracts the second, scaled by a learned λ, from the first. Both maps carry the same broad attention noise, so the subtraction cancels it as common mode, while the genuine signal peak (token 2 here) survives. Raising λ subtracts more aggressively, sharpening the mass onto the relevant token instead of spreading it across irrelevant context.'])
    ]));
    state._render();
  }

  // ── weight-tying: reuse the embedding matrix as the output projection ──────
  function weightTying(host) {
    var state = { logV: 15, dim: 768 };
    var W = 520, H = 190, PAD = 22;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M', 'B']; var i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }
    function box(x, y, w, h, label, fill) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, rx: '3', fill: fill, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2' }));
      var t = svgEl('text', { x: (x + w / 2).toFixed(1), y: (y + h / 2 + 4).toFixed(1), 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '10.5', fill: 'var(--ink,#1a1a1a)' });
      t.appendChild(document.createTextNode(label));
      g.appendChild(t);
      return g;
    }
    state._render = function () {
      var vocab = Math.pow(2, state.logV), d = state.dim;
      var saved = vocab * d;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(box(PAD, 30, 150, 44, 'input embedding', 'var(--blueprint,#3553ff)'));
      svg.appendChild(box(W - PAD - 150, 116, 150, 44, 'output projection', 'var(--blueprint,#3553ff)'));
      // tie arrow: same matrix reused (transposed)
      svg.appendChild(svgEl('line', { x1: PAD + 75, y1: 74, x2: W - PAD - 75, y2: 116, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2', 'stroke-dasharray': '5 3' }));
      var tt = svgEl('text', { x: (W / 2).toFixed(1), y: '100', 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '10', fill: 'var(--warn,#b8870f)' });
      tt.appendChild(document.createTextNode('tied: same V×d matrix, transposed'));
      svg.appendChild(tt);
      num.innerHTML = human(saved) + ' <small>params saved</small>';
      meta.textContent = 'vocab ' + human(vocab) + ' × dim ' + d + ' = one matrix instead of two · readout reuses the embedding';
      formula.textContent = 'logits = h · Eᵀ   ·   saved = vocab × d_model = ' + human(vocab) + ' × ' + d + ' = ' + human(saved);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'logV', 'vocabulary (2^x)', 10, 18, 1),
      slider(state, 'dim', 'model dim d', 128, 4096, 128)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['WEIGHT TYING']), el('span', {}, ['drag vocab and dim'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The input embedding maps each token id to a d-dimensional vector; the output projection maps a hidden vector back to a logit per vocabulary entry. Both are vocab×d matrices that play inverse roles, so many models tie them: the output layer reuses the transposed embedding. That removes a whole vocab×d_model block of parameters, a large saving when the vocabulary is tens of thousands of tokens wide.'])
    ]));
    state._render();
  }

  LF.register({
    'rmsnorm-vs-layernorm': rmsnormVsLayernorm,
    'swiglu-ffn': swigluFfn,
    'rlhf-pipeline': rlhfPipeline,
    'dpo-loss': dpoLoss,
    'paged-kv-cache': pagedKvCache,
    'expert-capacity': expertCapacity,
    'sliding-window-attention': slidingWindowAttention,
    'differential-attention': differentialAttention,
    'weight-tying': weightTying
  });
})();
