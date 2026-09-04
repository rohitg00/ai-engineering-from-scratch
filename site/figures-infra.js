/* figures-infra.js: interactive lesson figures for Phase 17 (infrastructure and
   production). Loads after lesson-figures.js and registers through window.LF.register.
   Vanilla ES5, no deps, theme via CSS vars. Authoring is the same fenced block:
       ```figure
       data-parallel
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, select = LF.select, fmtInt = LF.fmtInt;

  // ── data-parallel: split the global batch into per-GPU shards, all-reduce ──
  function dataParallel(host) {
    var state = { gpus: 4, batch: 256 };
    var W = 520, H = 210, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var g = state.gpus, B = state.batch;
      var shard = Math.ceil(B / g);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var colW = (W - 2 * PAD) / g, boxW = Math.min(colW - 10, 84), top = 34, boxH = 64;
      var i;
      for (i = 0; i < g; i++) {
        var cx = PAD + i * colW + (colW - boxW) / 2;
        svg.appendChild(svgEl('rect', { x: cx.toFixed(1), y: top, width: boxW.toFixed(1), height: boxH, rx: '3',
          fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2' }));
        var lab = svgEl('text', { x: (cx + boxW / 2).toFixed(1), y: (top + 26).toFixed(1), 'text-anchor': 'middle',
          'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink,#1a1a1a)' });
        lab.appendChild(document.createTextNode('GPU ' + (i + 1)));
        svg.appendChild(lab);
        var cp = svgEl('text', { x: (cx + boxW / 2).toFixed(1), y: (top + 44).toFixed(1), 'text-anchor': 'middle',
          'font-family': 'monospace', 'font-size': '9', fill: 'var(--ink-mute,#777)' });
        cp.appendChild(document.createTextNode('full copy'));
        svg.appendChild(cp);
        var shB = svgEl('rect', { x: cx.toFixed(1), y: (top + boxH + 10).toFixed(1), width: boxW.toFixed(1), height: '20', rx: '2',
          fill: 'var(--blueprint,#3553ff)', opacity: '0.85' });
        svg.appendChild(shB);
        var sl = svgEl('text', { x: (cx + boxW / 2).toFixed(1), y: (top + boxH + 24).toFixed(1), 'text-anchor': 'middle',
          'font-family': 'monospace', 'font-size': '9', fill: 'var(--bg,#fafaf5)' });
        sl.appendChild(document.createTextNode(shard + ' rows'));
        svg.appendChild(sl);
      }
      var ry = top + boxH + 48;
      svg.appendChild(svgEl('line', { x1: PAD, y1: ry, x2: W - PAD, y2: ry, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' }));
      var rl = svgEl('text', { x: (W / 2).toFixed(1), y: (ry + 16).toFixed(1), 'text-anchor': 'middle',
        'font-family': 'monospace', 'font-size': '10', fill: 'var(--warn,#b8870f)' });
      rl.appendChild(document.createTextNode('all-reduce gradients across ' + g + ' GPUs'));
      svg.appendChild(rl);
      num.innerHTML = g + 'x <small>throughput (ideal)</small>';
      meta.textContent = 'global batch ' + B + ' split into ' + g + ' shards of ' + shard + '  ·  each GPU holds a full model copy';
      formula.textContent = 'per-GPU batch = ceil(' + B + ' / ' + g + ') = ' + shard + '  ·  gradients summed by all-reduce, weights stay in sync';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'gpus', 'number of GPUs', 1, 8, 1),
      slider(state, 'batch', 'global batch size', 8, 1024, 8)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['DATA PARALLELISM']), el('span', {}, ['drag the GPU count'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each GPU holds a complete copy of the model and processes a different slice of the global batch. After the backward pass an all-reduce sums every GPU’s gradients so the copies stay identical. Throughput scales close to linearly with GPU count, but memory does not drop because every device still stores the whole model.'])
    ]));
    state._render();
  }

  // ── tensor-parallel: split a matmul column-wise, gather partial outputs ────
  function tensorParallel(host) {
    var state = { gpus: 4, dim: 4096 };
    var W = 520, H = 200, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var g = state.gpus, d = state.dim;
      var colsEach = Math.ceil(d / g);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var mx = PAD, my = 40, mw = W - 2 * PAD, mh = 90;
      svg.appendChild(svgEl('rect', { x: mx, y: my, width: mw, height: mh, fill: 'none',
        stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4' }));
      var i;
      for (i = 0; i < g; i++) {
        var sx = mx + i * mw / g;
        svg.appendChild(svgEl('rect', { x: sx.toFixed(1), y: my, width: (mw / g - 2).toFixed(1), height: mh, rx: '2',
          fill: 'var(--blueprint,#3553ff)', opacity: (0.4 + 0.5 * (i % 2)).toFixed(2) }));
        var lab = svgEl('text', { x: (sx + mw / g / 2).toFixed(1), y: (my + mh / 2 + 4).toFixed(1), 'text-anchor': 'middle',
          'font-family': 'monospace', 'font-size': '10', fill: 'var(--bg,#fafaf5)' });
        lab.appendChild(document.createTextNode('GPU ' + (i + 1)));
        svg.appendChild(lab);
      }
      var gy = my + mh + 28;
      svg.appendChild(svgEl('line', { x1: PAD, y1: gy, x2: W - PAD, y2: gy, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' }));
      var gl = svgEl('text', { x: (W / 2).toFixed(1), y: (gy + 16).toFixed(1), 'text-anchor': 'middle',
        'font-family': 'monospace', 'font-size': '10', fill: 'var(--warn,#b8870f)' });
      gl.appendChild(document.createTextNode('all-gather partial outputs into the full result'));
      svg.appendChild(gl);
      num.innerHTML = colsEach + ' <small>columns / GPU</small>';
      meta.textContent = 'weight matrix W is split column-wise across ' + g + ' GPUs  ·  each holds 1/' + g + ' of the parameters';
      formula.textContent = 'Y = X·W  with W = [W₁ | … | W' + (g > 1 ? 'ₙ' : '₁') + '],  each GPU computes X·Wᵢ then all-gather  ·  mem/GPU ≈ d/' + g + ' cols = ' + colsEach;
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'gpus', 'number of GPUs', 1, 8, 1),
      slider(state, 'dim', 'output width (columns)', 512, 8192, 256)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TENSOR PARALLELISM']), el('span', {}, ['drag the GPU count'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A single large matmul is split across GPUs by partitioning the weight matrix into column blocks. Each GPU multiplies the full input by its slice, producing a partial output, then an all-gather stitches the slices into the complete result. The parameters per GPU drop by the GPU count, which is how one layer too big for a single device gets served.'])
    ]));
    state._render();
  }

  // ── pipeline-parallel: bubble fraction shrinks as micro-batches rise ───────
  function pipelineParallel(host) {
    var state = { micro: 4, stages: 4 };
    var W = 520, H = 210, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var m = state.micro, s = state.stages;
      var totalSlots = m + s - 1;
      var bubbleFrac = (s - 1) / (m + s - 1);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var rowH = (H - 2 * PAD) / s, cw = (W - 2 * PAD) / totalSlots;
      var r, c;
      for (r = 0; r < s; r++) {
        var y = PAD + r * rowH + 2;
        for (c = 0; c < totalSlots; c++) {
          var x = PAD + c * cw;
          // stage r processes micro-batch (c - r); busy when 0 <= c-r < m
          var mb = c - r;
          var busy = mb >= 0 && mb < m;
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (cw - 2).toFixed(1), height: (rowH - 4).toFixed(1), rx: '2',
            fill: busy ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ccc)',
            opacity: busy ? '0.85' : '0.6' }));
        }
        var sl = svgEl('text', { x: (PAD - 4).toFixed(1), y: (y + rowH / 2).toFixed(1), 'text-anchor': 'end',
          'font-family': 'monospace', 'font-size': '9', fill: 'var(--ink-mute,#777)' });
        sl.appendChild(document.createTextNode('S' + (r + 1)));
        svg.appendChild(sl);
      }
      num.innerHTML = (bubbleFrac * 100).toFixed(1) + ' <small>% bubble (idle)</small>';
      bar.style.width = (bubbleFrac * 100).toFixed(1) + '%';
      barWrap.classList.toggle('over', bubbleFrac > 0.4);
      meta.textContent = m + ' micro-batches across ' + s + ' stages  ·  grey cells are idle pipeline bubble at fill and drain';
      formula.textContent = 'bubble fraction = (stages − 1) / (micro-batches + stages − 1) = ' + (s - 1) + ' / ' + (m + s - 1) + ' = ' + (bubbleFrac * 100).toFixed(1) + '%';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'micro', 'micro-batches', 1, 16, 1),
      slider(state, 'stages', 'pipeline stages', 2, 8, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['PIPELINE PARALLELISM']), el('span', {}, ['drag the micro-batch count'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The model is split into stages, one per GPU, and micro-batches flow through them like an assembly line. While the pipeline fills and drains some stages sit idle, the grey bubble. The bubble fraction is (stages minus one) over (micro-batches plus stages minus one), so feeding more micro-batches amortizes the fixed fill-and-drain cost toward zero.'])
    ]));
    state._render();
  }

  // ── zero-sharding: ZeRO stages shard optimizer, gradients, then params ─────
  function zeroSharding(host) {
    var state = { stage: '2', gpus: 8 };
    var num = el('span', { class: 'lf-num' });
    var rows = el('div', {});
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // per-parameter bytes in mixed precision Adam: params 2, grads 2, opt states 12
    var COMPONENTS = [
      { key: 'params', label: 'parameters (fp16)', bytes: 2, shardAt: 3 },
      { key: 'grads', label: 'gradients (fp16)', bytes: 2, shardAt: 2 },
      { key: 'opt', label: 'optimizer states (Adam)', bytes: 12, shardAt: 1 }
    ];
    state._render = function () {
      var stage = Number(state.stage), g = state.gpus;
      var total = 0, i;
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var maxBytes = 16; // full per-param footprint, for bar scale
      for (i = 0; i < COMPONENTS.length; i++) {
        var c = COMPONENTS[i];
        var sharded = stage >= c.shardAt;
        var perGpu = sharded ? c.bytes / g : c.bytes;
        total += perGpu;
        var bw = el('i'); bw.style.width = Math.min(100, perGpu / maxBytes * 100).toFixed(1) + '%';
        if (sharded) bw.style.background = 'var(--warn,#b8870f)';
        var lab = el('label', {}, [c.label + (sharded ? ' ÷ ' + g : ''),
          el('b', {}, [perGpu.toFixed(2) + ' B/param'])]);
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' }, [bw])]));
      }
      num.innerHTML = total.toFixed(2) + ' <small>bytes / param / GPU</small>';
      meta.textContent = 'ZeRO stage ' + stage + '  ·  ' + g + ' GPUs  ·  '
        + (stage === 0 ? 'nothing sharded (plain data parallel)'
          : stage === 1 ? 'optimizer states sharded'
            : stage === 2 ? 'optimizer states + gradients sharded'
              : 'optimizer states + gradients + parameters sharded');
      formula.textContent = 'full footprint 16 B/param  →  sharded components divided across ' + g + ' GPUs  →  ' + total.toFixed(2) + ' B/param per GPU';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      select(state, 'stage', 'ZeRO stage', [['stage 0', '0'], ['stage 1', '1'], ['stage 2', '2'], ['stage 3', '3']]),
      slider(state, 'gpus', 'data-parallel GPUs', 2, 64, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ZERO SHARDING']), el('span', {}, ['pick the ZeRO stage'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, rows, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Plain data parallelism replicates the full optimizer state, gradients, and parameters on every GPU. ZeRO removes that redundancy in stages: stage 1 shards the heavy Adam optimizer states, stage 2 adds gradients, stage 3 adds the parameters themselves. Each stage cuts the per-GPU memory further, trading a little communication for the ability to train far larger models.'])
    ]));
    state._render();
  }

  // ── gpu-memory-breakdown: stacked training memory vs GPU capacity ──────────
  function gpuMemoryBreakdown(host) {
    var state = { params: 7, batch: 8 };
    var GB = 1e9, REF = 80; // one 80 GB GPU
    var num = el('span', { class: 'lf-num' });
    var rows = el('div', {});
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var N = state.params * 1e9; // params in billions
      var weights = N * 2 / GB;
      var grads = N * 2 / GB;
      var opt = N * 12 / GB;
      // activations: rough per-sample cost grows with batch, here a simple linear model
      var acts = state.batch * state.params * 0.6;
      var total = weights + grads + opt + acts;
      var parts = [
        { label: 'weights (2 B)', v: weights },
        { label: 'gradients (2 B)', v: grads },
        { label: 'optimizer states (Adam ~12 B)', v: opt },
        { label: 'activations (batch ' + state.batch + ')', v: acts }
      ];
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      parts.forEach(function (p) {
        var bw = el('i'); bw.style.width = Math.min(100, p.v / REF * 100).toFixed(1) + '%';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [
          el('label', {}, [p.label, el('b', {}, [p.v.toFixed(1) + ' GB'])]),
          el('div', { class: 'lf-bar' }, [bw])
        ]));
      });
      num.innerHTML = total.toFixed(total < 100 ? 1 : 0) + ' <small>GB total</small>';
      var pct = Math.min(100, total / REF * 100);
      bar.style.width = pct + '%';
      barWrap.classList.toggle('over', total > REF);
      meta.textContent = (total > REF ? '⚠ exceeds ' : '') + Math.round(total / REF * 100) + '% of one ' + REF + ' GB GPU  ·  optimizer states dominate at training time';
      formula.textContent = state.params + 'B params × (2 + 2 + 12) B = ' + (weights + grads + opt).toFixed(0) + ' GB fixed, + ' + acts.toFixed(1) + ' GB activations';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'params', 'model params (billions)', 1, 70, 1),
      slider(state, 'batch', 'batch size', 1, 64, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TRAINING MEMORY']), el('span', {}, ['drag params and batch'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, rows, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Training memory is more than the weights. In mixed-precision Adam each parameter costs two bytes for the fp16 weight, two for the gradient, and about twelve for the optimizer states, so the fixed cost is roughly sixteen bytes per parameter before a single activation. Activations then scale with batch size. This is why a model that fits for inference can be far too large to train on one GPU.'])
    ]));
    state._render();
  }

  // ── throughput-latency: batch size lifts throughput and per-request latency ─
  function throughputLatency(host) {
    var state = { batch: 16 };
    var W = 520, H = 220, PAD = 36, BMAX = 128;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // throughput saturates (Amdahl-ish); latency rises with batch (queueing + compute)
    function thru(b) { return 4000 * b / (b + 24); } // tokens/sec, saturating
    function lat(b) { return 20 + 0.9 * b; }          // ms per request, linear
    var TMAX = thru(BMAX), LMAX = lat(BMAX);
    // knee: where marginal throughput per unit latency drops most; here near saturation onset
    var knee = 24;
    function px(b) { return PAD + b / BMAX * (W - 2 * PAD); }
    function pyT(t) { return H - PAD - t / TMAX * (H - 2 * PAD); }
    function pyL(l) { return H - PAD - l / LMAX * (H - 2 * PAD); }
    state._render = function () {
      var b = state.batch;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = '', i, x;
      for (i = 0; i <= 100; i++) { x = 1 + (BMAX - 1) * i / 100; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + pyT(thru(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var d2 = '';
      for (i = 0; i <= 100; i++) { x = 1 + (BMAX - 1) * i / 100; d2 += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + pyL(lat(x)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d2, fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '2', 'stroke-dasharray': '4 3' }));
      var kx = px(knee);
      svg.appendChild(svgEl('line', { x1: kx, y1: PAD, x2: kx, y2: H - PAD, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5', 'stroke-dasharray': '3 3' }));
      svg.appendChild(svgEl('circle', { cx: px(b), cy: pyT(thru(b)), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      svg.appendChild(svgEl('circle', { cx: px(b), cy: pyL(lat(b)), r: '4', fill: 'var(--ink-mute,#999)' }));
      num.innerHTML = fmtInt(Math.round(thru(b))) + ' <small>tokens/sec</small>';
      meta.textContent = 'batch ' + b + '  ·  per-request latency ' + lat(b).toFixed(0) + ' ms  ·  knee near batch ' + knee + ' (orange)';
      formula.textContent = 'larger batch → throughput rises toward saturation, latency rises linearly  ·  pick batch at the knee for the best of both';
    };
    var grid = el('div', {}, [slider(state, 'batch', 'batch size', 1, BMAX, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['THROUGHPUT / LATENCY']), el('span', {}, ['drag the batch size'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Blue is throughput, the dashed grey line is per-request latency. Bigger batches keep the GPU busier so total tokens per second climbs, but each individual request waits longer behind the others, so latency rises too. The knee (orange) is where throughput stops growing much while latency keeps climbing, which is the batch size most serving systems aim for.'])
    ]));
    state._render();
  }

  // ── autoscaling: replicas track incoming QPS to hold latency under target ──
  function autoscaling(host) {
    var state = { qps: 120, cap: 40 };
    var W = 520, H = 200, PAD = 26;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var RMAX = 12;
    state._render = function () {
      var qps = state.qps, cap = state.cap;
      var replicas = Math.max(1, Math.ceil(qps / cap));
      var shown = Math.min(RMAX, replicas);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var perRow = 6, bw = 56, bh = 30, gx = 14, gy = 18, ox = PAD, oy = 36;
      var i;
      for (i = 0; i < shown; i++) {
        var col = i % perRow, row = Math.floor(i / perRow);
        var x = ox + col * (bw + gx), y = oy + row * (bh + gy);
        // load on this replica
        var thisLoad = Math.min(cap, qps - i * cap);
        var fillFrac = Math.max(0, thisLoad) / cap;
        svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: bw, height: bh, rx: '3',
          fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.1' }));
        svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: (y + bh - bh * fillFrac).toFixed(1), width: bw, height: (bh * fillFrac).toFixed(1), rx: '3',
          fill: 'var(--blueprint,#3553ff)', opacity: '0.85' }));
      }
      if (replicas > RMAX) {
        var more = svgEl('text', { x: (ox + 5 * (bw + gx)).toFixed(1), y: (oy + 2 * (bh + gy) + 14).toFixed(1),
          'font-family': 'monospace', 'font-size': '11', fill: 'var(--ink-mute,#777)' });
        more.appendChild(document.createTextNode('+ ' + (replicas - RMAX) + ' more'));
        svg.appendChild(more);
      }
      var headroom = replicas * cap - qps;
      num.innerHTML = replicas + ' <small>replicas</small>';
      meta.textContent = qps + ' QPS  ·  ' + cap + ' QPS per replica  ·  headroom ' + headroom + ' QPS keeps latency under target';
      formula.textContent = 'replicas = ceil(QPS / per-replica capacity) = ceil(' + qps + ' / ' + cap + ') = ' + replicas;
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'qps', 'incoming load (QPS)', 0, 480, 10),
      slider(state, 'cap', 'per-replica capacity (QPS)', 10, 80, 5)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['AUTOSCALING']), el('span', {}, ['drag the incoming load'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['An autoscaler adds and removes replicas so that the offered load stays within capacity and latency holds under its target. The replica count is the load divided by what one replica can serve, rounded up. Raise the QPS and replicas spin up; lower it and they scale back down, which is what keeps both latency and cost in check.'])
    ]));
    state._render();
  }

  // ── cost-per-token: GPU price and throughput set the cost per 1M tokens ────
  function costPerToken(host) {
    var state = { price: 2.5, tps: 2000 };
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var REF = 5; // $5 / 1M tokens as a visual reference
    state._render = function () {
      var price = state.price, tps = state.tps;
      var tokensPerHr = tps * 3600;
      var costPerMillion = price / tokensPerHr * 1e6;
      num.innerHTML = '$' + costPerMillion.toFixed(costPerMillion < 1 ? 3 : 2) + ' <small>/ 1M tokens</small>';
      bar.style.width = Math.min(100, costPerMillion / REF * 100).toFixed(1) + '%';
      barWrap.classList.toggle('over', costPerMillion > REF);
      meta.textContent = '$' + price.toFixed(2) + '/hr GPU  ·  ' + fmtInt(tps) + ' tokens/sec  ·  ' + (tokensPerHr / 1e6).toFixed(1) + 'M tokens/hr served';
      formula.textContent = 'cost/1M = (price/hr) / (tokens/sec × 3600) × 10⁶ = (' + price.toFixed(2) + ' / ' + fmtInt(tokensPerHr) + ') × 10⁶ = $' + costPerMillion.toFixed(3);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'price', 'GPU price ($/hr)', 0.5, 12, 0.1),
      slider(state, 'tps', 'throughput (tokens/sec)', 100, 8000, 100)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['COST PER TOKEN']), el('span', {}, ['drag price and throughput'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Serving economics reduce to two numbers: what the GPU costs per hour and how many tokens it produces in that hour. Cost per million tokens is the hourly price divided by the tokens served per hour, scaled to a million. Doubling throughput halves the unit cost, which is why batching, quantization, and faster kernels all translate directly into a lower price per token.'])
    ]));
    state._render();
  }

  // ── roofline: arithmetic intensity sets memory-bound vs compute-bound ──────
  function roofline(host) {
    var state = { logAI: 1.2 };
    var W = 520, H = 230, PAD = 40;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var PEAK = 1000;      // peak compute, GFLOP/s (arbitrary units)
    var BW = 8;           // memory bandwidth, GB/s units -> attainable = BW * AI
    var ridge = PEAK / BW; // arithmetic intensity where the two regimes meet
    var AIMIN = 0.5, AIMAX = 1000;
    function lx(ai) { return PAD + (Math.log10(ai) - Math.log10(AIMIN)) / (Math.log10(AIMAX) - Math.log10(AIMIN)) * (W - 2 * PAD); }
    function ly(perf) { return H - PAD - (Math.log10(perf) - Math.log10(8)) / (Math.log10(PEAK) - Math.log10(8)) * (H - 2 * PAD); }
    function attainable(ai) { return Math.min(PEAK, BW * ai); }
    state._render = function () {
      var ai = Math.pow(10, state.logAI);
      var perf = attainable(ai);
      var bound = ai < ridge ? 'memory-bound' : 'compute-bound';
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // roofline: slanted memory roof then flat compute roof
      var d = '', i, a;
      for (i = 0; i <= 100; i++) {
        a = Math.pow(10, Math.log10(AIMIN) + (Math.log10(AIMAX) - Math.log10(AIMIN)) * i / 100);
        d += (i ? 'L' : 'M') + lx(a).toFixed(1) + ' ' + ly(attainable(a)).toFixed(1) + ' ';
      }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      // ridge line
      var rx = lx(ridge);
      svg.appendChild(svgEl('line', { x1: rx, y1: PAD, x2: rx, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      // kernel marker
      svg.appendChild(svgEl('circle', { cx: lx(ai), cy: ly(perf), r: '5', fill: 'var(--warn,#b8870f)' }));
      var rl = svgEl('text', { x: (rx + 4).toFixed(1), y: (PAD + 12).toFixed(1), 'font-family': 'monospace', 'font-size': '9', fill: 'var(--ink-mute,#777)' });
      rl.appendChild(document.createTextNode('ridge ' + ridge.toFixed(0) + ' FLOP/B'));
      svg.appendChild(rl);
      num.innerHTML = bound + ' <small>at AI ' + ai.toFixed(ai < 10 ? 1 : 0) + ' FLOP/B</small>';
      meta.textContent = 'attainable ' + perf.toFixed(0) + ' GFLOP/s  ·  ' + (ai < ridge ? 'starved on memory bandwidth: feed it more reuse' : 'saturating the compute units: near peak');
      formula.textContent = 'attainable = min(peak compute, bandwidth × AI)  ·  ridge at AI = peak/BW = ' + ridge.toFixed(0) + ' FLOP/byte';
    };
    var grid = el('div', {}, [slider(state, 'logAI', 'arithmetic intensity (10^x FLOP/byte)', -0.3, 3, 0.05)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ROOFLINE']), el('span', {}, ['drag the arithmetic intensity'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Arithmetic intensity is the FLOPs a kernel does per byte it moves. On the left the slanted roof means performance is capped by memory bandwidth; on the right the flat roof means it is capped by raw compute. The ridge is where the two meet. A kernel below and left of the ridge (orange) is memory-bound, and the fix is more data reuse, not a faster chip.'])
    ]));
    state._render();
  }

  LF.register({
    'data-parallel': dataParallel,
    'tensor-parallel': tensorParallel,
    'pipeline-parallel': pipelineParallel,
    'zero-sharding': zeroSharding,
    'gpu-memory-breakdown': gpuMemoryBreakdown,
    'throughput-latency': throughputLatency,
    'autoscaling': autoscaling,
    'cost-per-token': costPerToken,
    'roofline': roofline
  });
})();
