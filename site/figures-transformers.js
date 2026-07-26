/* figures-transformers.js — interactive lesson figures for Phase 5 (NLP) and
   Phase 7 (transformers deep dive). Loads after lesson-figures.js, uses the
   shared LF toolkit, registers via LF.register. No deps, ES5 only, theme via
   CSS vars. Authoring is the same fenced ```figure block in docs/en.md. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, clamp = LF.clamp, fmtInt = LF.fmtInt;

  function shell(host, label, hint, grid, outKids, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, outKids)]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }

  // ── attention-heatmap: QK^T scores, softmax rows, opacity = weight ─────────
  function attentionHeatmap(host) {
    var toks = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
    var n = toks.length;
    // Fixed Q,K vectors (3-dim) per token; deterministic, no randomness.
    var Q = [[1.0, 0.2, 0.0], [0.3, 1.0, 0.1], [0.1, 0.4, 0.9], [0.6, 0.1, 0.5], [0.9, 0.3, 0.0], [0.2, 0.5, 0.8]];
    var K = [[0.9, 0.1, 0.0], [0.2, 1.0, 0.2], [0.0, 0.3, 1.0], [0.5, 0.2, 0.4], [0.9, 0.2, 0.1], [0.1, 0.4, 0.9]];
    var state = { T: 1.0 };
    var W = 520, H = 240, PAD = 56, CELL = (W - PAD - 12) / n;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var T = Math.max(0.05, state.T);
      var r, c, x, y;
      for (r = 0; r < n; r++) {
        var scores = [];
        for (c = 0; c < n; c++) { scores.push(dot(Q[r], K[c]) / T); }
        var mx = Math.max.apply(null, scores);
        var ex = scores.map(function (s) { return Math.exp(s - mx); });
        var sum = ex.reduce(function (a, b) { return a + b; }, 0);
        var probs = ex.map(function (e) { return e / sum; });
        for (c = 0; c < n; c++) {
          x = PAD + c * CELL; y = 30 + r * CELL;
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (CELL - 2).toFixed(1), height: (CELL - 2).toFixed(1), fill: 'var(--blueprint,#3553ff)', 'fill-opacity': probs[c].toFixed(3), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
        }
        svg.appendChild(svgEl('text', { x: (PAD - 6).toFixed(1), y: (y + CELL / 2).toFixed(1), 'text-anchor': 'end', 'font-size': '10', 'font-family': 'monospace', fill: 'var(--ink-soft,#555)' }, [document.createTextNode(toks[r])]));
      }
      for (c = 0; c < n; c++) {
        x = PAD + c * CELL;
        svg.appendChild(svgEl('text', { x: (x + CELL / 2 - 1).toFixed(1), y: '24', 'text-anchor': 'middle', 'font-size': '10', 'font-family': 'monospace', fill: 'var(--ink-mute,#777)' }, [document.createTextNode(toks[c])]));
      }
      meta.textContent = 'rows = queries, columns = keys  ·  each row softmaxes to 1  ·  ' + (T < 0.6 ? 'sharp / peaked' : T > 1.6 ? 'diffuse / blurred' : 'balanced');
      formula.textContent = 'A = softmax(QKᵀ / T),  T = ' + T.toFixed(2) + '   ·   cell opacity = attention weight';
    };
    var grid = el('div', {}, [slider(state, 'T', 'temperature', 0.2, 3.0, 0.05)]);
    shell(host, 'ATTENTION HEATMAP', 'drag T', grid, [svg, meta, formula],
      'Each query token scores every key token by dot product, divides by the temperature, then softmaxes the row so the weights sum to one. Darker cells take more attention. Lower temperature sharpens onto a single key; higher temperature spreads the focus.');
    state._render();
  }

  // ── multihead-split: split d_model into num_heads of size d_model/heads ─────
  function multiheadSplit(host) {
    var state = { dModel: 512, heads: 8 };
    var W = 520, H = 200, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var divisors = [1, 2, 4, 8, 16, 32, 64];
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = state.dModel, h = state.heads;
      var even = d % h === 0;
      var dh = Math.floor(d / h);
      var rowY = 40, barW = W - 2 * PAD, barH = 36;
      svg.appendChild(svgEl('rect', { x: PAD, y: rowY, width: barW, height: barH, fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('text', { x: (PAD + barW / 2).toFixed(1), y: (rowY - 6).toFixed(1), 'text-anchor': 'middle', 'font-size': '11', 'font-family': 'monospace', fill: 'var(--ink-soft,#555)' }, [document.createTextNode('d_model = ' + d)]));
      var splitY = 120;
      if (even) {
        var i;
        for (i = 0; i < h; i++) {
          var x = PAD + i * (barW / h);
          svg.appendChild(svgEl('rect', { x: (x + 1).toFixed(1), y: splitY, width: (barW / h - 2).toFixed(1), height: barH, fill: 'var(--blueprint,#3553ff)', 'fill-opacity': (0.35 + 0.5 * (i % 2)).toFixed(2), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
          svg.appendChild(svgEl('line', { x1: (PAD + (i + 0.5) * (barW / h)).toFixed(1), y1: (rowY + barH).toFixed(1), x2: (PAD + (i + 0.5) * (barW / h)).toFixed(1), y2: splitY.toFixed(1), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5', 'stroke-dasharray': '2 2' }));
        }
        svg.appendChild(svgEl('text', { x: (PAD + barW / 2).toFixed(1), y: (splitY + barH + 18).toFixed(1), 'text-anchor': 'middle', 'font-size': '11', 'font-family': 'monospace', fill: 'var(--ink-soft,#555)' }, [document.createTextNode(h + ' heads × d_head ' + dh)]));
        meta.textContent = 'each head sees a ' + dh + '-dim slice  ·  total params unchanged: ' + h + ' × ' + dh + ' = ' + d;
      } else {
        svg.appendChild(svgEl('text', { x: (PAD + barW / 2).toFixed(1), y: (splitY + barH).toFixed(1), 'text-anchor': 'middle', 'font-size': '13', 'font-family': 'monospace', fill: 'var(--warn,#b8870f)' }, [document.createTextNode(d + ' is not divisible by ' + h)]));
        meta.textContent = 'pick a head count that divides d_model evenly: ' + divisors.filter(function (x) { return d % x === 0; }).join(', ');
      }
      formula.textContent = 'd_head = d_model / num_heads = ' + d + ' / ' + h + (even ? ' = ' + dh : ' (not integer)');
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'dModel', 'd_model', 64, 1024, 64),
      slider(state, 'heads', 'num_heads', 1, 32, 1)
    ]);
    shell(host, 'MULTI-HEAD SPLIT', 'drag the dims', grid, [svg, meta, formula],
      'Multi-head attention splits the model dimension into equal slices, one per head, so the head count must divide d_model evenly. Each head attends in its own subspace; the slices concatenate back to d_model, so adding heads costs nothing in total width.');
    state._render();
  }

  // ── causal-mask: NxN grid, upper triangle masked (greyed) ──────────────────
  function causalMask(host) {
    var state = { n: 7 };
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var n = state.n;
      var PAD = 30, size = Math.min(W - 2 * PAD, H - 40);
      var cell = size / n;
      var ox = (W - size) / 2, oy = 14;
      var r, c, visible = 0;
      for (r = 0; r < n; r++) {
        for (c = 0; c < n; c++) {
          var masked = c > r;
          if (!masked) { visible++; }
          svg.appendChild(svgEl('rect', {
            x: (ox + c * cell).toFixed(1), y: (oy + r * cell).toFixed(1),
            width: (cell - 1.5).toFixed(1), height: (cell - 1.5).toFixed(1),
            fill: masked ? 'var(--bg-surface,#eee)' : 'var(--blueprint,#3553ff)',
            'fill-opacity': masked ? '0.5' : (c === r ? '0.95' : '0.55'),
            stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5'
          }));
        }
      }
      var total = n * n;
      meta.textContent = visible + ' of ' + total + ' positions attend  ·  ' + (total - visible) + ' masked  ·  token i sees tokens 0..i';
      formula.textContent = 'mask[i][j] = −∞ when j > i  →  softmax sends future weights to 0  (lower triangle = causal)';
    };
    var grid = el('div', {}, [slider(state, 'n', 'sequence length N', 2, 14, 1)]);
    shell(host, 'CAUSAL MASK', 'drag N', grid, [svg, meta, formula],
      'A causal mask sets every future score to negative infinity before the softmax, so each token attends only to itself and the tokens before it. The grey upper triangle is the forbidden future. This single constraint is what lets a transformer generate left to right without peeking ahead.');
    state._render();
  }

  // ── softmax-attention-scaling: why divide by sqrt(d_k) ─────────────────────
  function softmaxAttentionScaling(host) {
    var state = { dk: 64, scaled: 1 };
    var W = 520, H = 210, PAD = 30;
    var n = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // Fixed unit-scale base logits; raw dot-product std grows as sqrt(d_k).
    var base = [1.4, 0.9, 0.5, 0.1, -0.2, -0.5, -0.9, -1.3];
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var dk = state.dk;
      // Unscaled dot product magnitude scales ~ sqrt(dk); scaled divides it back.
      var spread = Math.sqrt(dk);
      var logits = base.map(function (b) { return state.scaled ? b * spread / Math.sqrt(dk) : b * spread; });
      var mx = Math.max.apply(null, logits);
      var ex = logits.map(function (z) { return Math.exp(z - mx); });
      var sum = ex.reduce(function (a, b) { return a + b; }, 0);
      var probs = ex.map(function (e) { return e / sum; });
      var pmax = Math.max.apply(null, probs);
      var ent = -probs.reduce(function (a, p) { return a + (p > 0 ? p * Math.log2(p) : 0); }, 0);
      var barW = (W - 2 * PAD) / n;
      probs.forEach(function (p, i) {
        var hh = p * (H - 2 * PAD);
        svg.appendChild(svgEl('rect', { x: (PAD + i * barW + 2).toFixed(1), y: (H - PAD - hh).toFixed(1), width: (barW - 4).toFixed(1), height: hh.toFixed(1), fill: 'var(--blueprint,#3553ff)', 'fill-opacity': '0.75' }));
      });
      svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      status.innerHTML = (pmax * 100).toFixed(0) + '% <small>on top token</small>';
      meta.textContent = (state.scaled ? 'scaled by 1/√d_k: ' : 'unscaled: ') + (pmax > 0.85 ? 'softmax saturated, gradients vanish' : 'distribution stays calibrated') + '  ·  entropy ' + ent.toFixed(2) + ' bits';
      formula.textContent = state.scaled ? 'softmax(QKᵀ / √d_k),  d_k = ' + dk + ',  √d_k = ' + spread.toFixed(1) : 'softmax(QKᵀ),  variance grows with d_k = ' + dk;
    };
    var sel = LF.select(state, 'scaled', 'scaling', [['scaled  (÷ √d_k)', 1], ['unscaled', 0]]);
    // select stores string; coerce on render
    var origRender = state._render;
    state._render = function () { state.scaled = Number(state.scaled); origRender(); };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'dk', 'head dim d_k', 8, 256, 8),
      sel
    ]);
    shell(host, 'SOFTMAX SCALING', 'toggle the √d_k divisor', grid, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula],
      'Dot products grow with the head dimension, so without scaling the scores get large and the softmax saturates onto one token, killing the gradient. Dividing by the square root of d_k cancels that growth and keeps the attention distribution calibrated across any dimension.');
    state._render();
  }

  // ── word-vector-arithmetic: king - man + woman ≈ queen ─────────────────────
  function wordVectorArithmetic(host) {
    var state = { t: 1.0 };
    var W = 520, H = 260, PAD = 36;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // Fixed 2D embedding space. Gender axis horizontal, royalty axis vertical.
    var pts = { man: [1.0, 1.0], woman: [3.0, 1.0], king: [1.0, 4.0], queen: [3.0, 4.0] };
    function px(x) { return PAD + (x + 0.5) / 4.5 * (W - 2 * PAD); }
    function py(y) { return H - PAD - (y) / 5 * (H - 2 * PAD); }
    function dot(label, x, y, color) {
      svg.appendChild(svgEl('circle', { cx: px(x).toFixed(1), cy: py(y).toFixed(1), r: '5', fill: color }));
      svg.appendChild(svgEl('text', { x: (px(x) + 8).toFixed(1), y: (py(y) + 4).toFixed(1), 'font-size': '11', 'font-family': 'monospace', fill: 'var(--ink-soft,#555)' }, [document.createTextNode(label)]));
    }
    function arrow(x1, y1, x2, y2, color, dash) {
      svg.appendChild(svgEl('line', { x1: px(x1).toFixed(1), y1: py(y1).toFixed(1), x2: px(x2).toFixed(1), y2: py(y2).toFixed(1), stroke: color, 'stroke-width': '1.6', 'stroke-dasharray': dash || '' }));
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // result = king - man + woman, animated along t from king toward result.
      var resX = pts.king[0] - pts.man[0] + pts.woman[0];
      var resY = pts.king[1] - pts.man[1] + pts.woman[1];
      var t = clamp(state.t, 0, 1);
      var curX = pts.king[0] + t * (resX - pts.king[0]);
      var curY = pts.king[1] + t * (resY - pts.king[1]);
      arrow(pts.man[0], pts.man[1], pts.king[0], pts.king[1], 'var(--rule-soft,#ccc)', '3 3');
      arrow(pts.woman[0], pts.woman[1], pts.queen[0], pts.queen[1], 'var(--rule-soft,#ccc)', '3 3');
      arrow(pts.king[0], pts.king[1], curX, curY, 'var(--blueprint,#3553ff)');
      dot('man', pts.man[0], pts.man[1], 'var(--ink-mute,#999)');
      dot('woman', pts.woman[0], pts.woman[1], 'var(--ink-mute,#999)');
      dot('king', pts.king[0], pts.king[1], 'var(--blueprint,#3553ff)');
      dot('queen', pts.queen[0], pts.queen[1], 'var(--warn,#b8870f)');
      svg.appendChild(svgEl('circle', { cx: px(curX).toFixed(1), cy: py(curY).toFixed(1), r: '4', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
      var dist = Math.sqrt(Math.pow(curX - pts.queen[0], 2) + Math.pow(curY - pts.queen[1], 2));
      meta.textContent = 'result lands at (' + curX.toFixed(1) + ', ' + curY.toFixed(1) + ')  ·  distance to "queen" ' + dist.toFixed(2) + (dist < 0.05 ? '  ·  match' : '');
      formula.textContent = 'king − man + woman ≈ queen   ·   the same offset (man→king) carries woman→queen';
    };
    var grid = el('div', {}, [slider(state, 't', 'walk the arithmetic', 0, 1, 0.02)]);
    shell(host, 'WORD VECTOR ARITHMETIC', 'drag to add the vectors', grid, [svg, meta, formula],
      'Word2Vec arranges words so that relationships become directions. The vector from man to king is the same as woman to queen, so subtracting man and adding woman to king lands almost exactly on queen. Meaning becomes geometry, and analogy becomes vector addition.');
    state._render();
  }

  // ── bpe-merge: step through byte-pair-encoding merges ──────────────────────
  function bpeMerge(host) {
    var state = { step: 0 };
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var rows = el('div', {});
    // Toy corpus of word counts (split into chars, words end in stop marker _).
    var corpus = [['l o w _', 5], ['l o w e r _', 2], ['n e w e s t _', 6], ['w i d e s t _', 3]];
    // Precompute the deterministic merge sequence.
    function tokenizeAll(words) { return words.map(function (w) { return [w[0].split(' '), w[1]]; }); }
    function pairCounts(toks) {
      var counts = {}, order = [];
      toks.forEach(function (t) {
        var arr = t[0], cnt = t[1], i;
        for (i = 0; i < arr.length - 1; i++) {
          var key = arr[i] + ' ' + arr[i + 1];
          if (counts[key] === undefined) { counts[key] = 0; order.push(key); }
          counts[key] += cnt;
        }
      });
      return { counts: counts, order: order };
    }
    function bestPair(toks) {
      var pc = pairCounts(toks), best = null, bestN = -1;
      pc.order.forEach(function (k) { if (pc.counts[k] > bestN) { bestN = pc.counts[k]; best = k; } });
      return best === null ? null : { pair: best, count: bestN };
    }
    function applyMerge(toks, pair) {
      var parts = pair.split(' '), a = parts[0], b = parts[1], merged = a + b;
      return toks.map(function (t) {
        var arr = t[0], out = [], i = 0;
        while (i < arr.length) {
          if (i < arr.length - 1 && arr[i] === a && arr[i + 1] === b) { out.push(merged); i += 2; }
          else { out.push(arr[i]); i += 1; }
        }
        return [out, t[1]];
      });
    }
    var merges = [];
    (function () {
      var toks = tokenizeAll(corpus), step;
      for (step = 0; step < 10; step++) {
        var bp = bestPair(toks);
        if (!bp || bp.count < 2) { break; }
        merges.push(bp);
        toks = applyMerge(toks, bp.pair);
      }
    })();
    var MAXSTEP = merges.length;
    function countTokens(toks) { return toks.reduce(function (a, t) { return a + t[0].length; }, 0); }
    function vocabAt(s) {
      var v = {};
      'l o w e r n s t i d _'.split(' ').forEach(function (c) { v[c] = 1; });
      var i; for (i = 0; i < s; i++) { var p = merges[i].pair.split(' '); v[p[0] + p[1]] = 1; }
      return Object.keys(v).length;
    }
    state._render = function () {
      var s = clamp(Math.round(state.step), 0, MAXSTEP);
      var toks = tokenizeAll(corpus), i;
      for (i = 0; i < s; i++) { toks = applyMerge(toks, merges[i].pair); }
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      toks.forEach(function (t) {
        var line = el('div', { class: 'lf-formula', style: 'margin-top:2px' }, [
          t[0].join(' · ') + '   (×' + t[1] + ')'
        ]);
        rows.appendChild(line);
      });
      var tc = countTokens(toks), vc = vocabAt(s);
      var nextStr = s < MAXSTEP ? 'next merge: "' + merges[s].pair.replace(' ', '" + "') + '" (freq ' + merges[s].count + ')' : 'no pair occurs twice — merging stops';
      meta.textContent = 'step ' + s + ' of ' + MAXSTEP + '  ·  vocab ' + vc + ' symbols  ·  ' + tc + ' tokens across corpus';
      formula.textContent = nextStr;
    };
    var grid = el('div', {}, [slider(state, 'step', 'merge step', 0, MAXSTEP, 1)]);
    shell(host, 'BPE MERGE', 'step through merges', grid, [rows, meta, formula],
      'Byte-pair encoding starts from characters and repeatedly merges the most frequent adjacent pair into a new symbol. Each merge adds one entry to the vocabulary and shortens the corpus. Common sequences like "es" and "est" become single tokens, so frequent text packs into fewer tokens while rare words still fall back to pieces.');
    state._render();
  }

  // ── gqa-kv-sharing: query heads sharing kv heads (MHA / GQA / MQA) ──────────
  function gqaKvSharing(host) {
    var state = { qHeads: 8, kvHeads: 2 };
    var W = 520, H = 220;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var q = state.qHeads;
      var kv = clamp(state.kvHeads, 1, q);
      if (state.kvHeads > q) { state.kvHeads = q; kv = q; }
      // Snap kv to a divisor of q for clean grouping.
      var divs = [], d; for (d = 1; d <= q; d++) { if (q % d === 0) { divs.push(d); } }
      var nearest = divs[0];
      divs.forEach(function (x) { if (Math.abs(x - kv) <= Math.abs(nearest - kv)) { nearest = x; } });
      kv = nearest;
      var perGroup = q / kv;
      var qY = 36, kvY = 168, r = 9;
      var qStep = (W - 60) / q, kvStep = (W - 60) / kv;
      var i;
      for (i = 0; i < kv; i++) {
        var kx = 30 + (i + 0.5) * kvStep;
        svg.appendChild(svgEl('rect', { x: (kx - 14).toFixed(1), y: kvY.toFixed(1), width: '28', height: '20', fill: 'var(--warn,#b8870f)', 'fill-opacity': '0.7' }));
      }
      svg.appendChild(svgEl('text', { x: '30', y: (kvY + 38).toFixed(1), 'font-size': '10', 'font-family': 'monospace', fill: 'var(--ink-mute,#777)' }, [document.createTextNode(kv + ' kv head' + (kv > 1 ? 's' : ''))]));
      for (i = 0; i < q; i++) {
        var qx = 30 + (i + 0.5) * qStep;
        var grp = Math.floor(i / perGroup);
        var kx2 = 30 + (grp + 0.5) * kvStep;
        svg.appendChild(svgEl('line', { x1: qx.toFixed(1), y1: (qY + r).toFixed(1), x2: kx2.toFixed(1), y2: kvY.toFixed(1), stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1' }));
        svg.appendChild(svgEl('circle', { cx: qx.toFixed(1), cy: qY.toFixed(1), r: String(r), fill: 'var(--blueprint,#3553ff)', 'fill-opacity': '0.8' }));
      }
      svg.appendChild(svgEl('text', { x: '30', y: '20', 'font-size': '10', 'font-family': 'monospace', fill: 'var(--ink-mute,#777)' }, [document.createTextNode(q + ' query heads')]));
      var mode = kv === q ? 'MHA (one kv per query)' : kv === 1 ? 'MQA (all queries share one kv)' : 'GQA (' + perGroup + ' queries per kv)';
      var factor = q / kv;
      status.innerHTML = factor.toFixed(factor < 10 ? 1 : 0) + 'x <small>smaller kv-cache</small>';
      meta.textContent = mode + '  ·  ' + q + ' query heads → ' + kv + ' kv heads';
      formula.textContent = 'kv-cache reduction = query_heads / kv_heads = ' + q + ' / ' + kv + ' = ' + factor.toFixed(2) + 'x';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'qHeads', 'query heads', 1, 16, 1),
      slider(state, 'kvHeads', 'kv heads (groups)', 1, 16, 1)
    ]);
    shell(host, 'GQA KV-SHARING', 'drag the head counts', grid, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula],
      'Every query head keeps its own projection, but several can share one key-value head. One kv per query is full multi-head attention; one kv for all is multi-query; a few groups in between is grouped-query attention. Fewer kv heads shrink the cache by the ratio of query to kv heads while keeping most of the quality.');
    state._render();
  }

  // ── transformer-residual: one block with residual skip connections ─────────
  function transformerResidual(host) {
    var state = { skip: 1 };
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function box(x, y, w, h, label, fill) {
      svg.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, rx: '3', fill: fill || 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('text', { x: (x + w / 2).toFixed(1), y: (y + h / 2 + 4).toFixed(1), 'text-anchor': 'middle', 'font-size': '11', 'font-family': 'monospace', fill: 'var(--ink-soft,#555)' }, [document.createTextNode(label)]));
    }
    function flow(x1, y1, x2, y2, color) {
      svg.appendChild(svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: color || 'var(--ink-mute,#999)', 'stroke-width': '1.6' }));
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var cx = W / 2, bw = 150, bh = 30, lx = cx - bw / 2;
      var skip = state.skip ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#eee)';
      // main spine
      flow(cx, 16, cx, 36);
      box(lx, 36, bw, bh, 'self-attention', 'var(--blueprint,#3553ff)');
      var attnAdd = 86;
      flow(cx, 66, cx, attnAdd);
      box(cx - 36, attnAdd, 72, 24, 'add & norm');
      flow(cx, attnAdd + 24, cx, attnAdd + 44);
      box(lx, attnAdd + 44, bw, bh, 'FFN', 'var(--blueprint,#3553ff)');
      var ffnAdd = attnAdd + 78;
      flow(cx, attnAdd + 44 + bh, cx, ffnAdd);
      box(cx - 36, ffnAdd, 72, 24, 'add & norm');
      flow(cx, ffnAdd + 24, cx, ffnAdd + 40);
      // input/output labels
      svg.appendChild(svgEl('text', { x: cx.toFixed(1), y: '12', 'text-anchor': 'middle', 'font-size': '10', 'font-family': 'monospace', fill: 'var(--ink-mute,#777)' }, [document.createTextNode('x in')]));
      svg.appendChild(svgEl('text', { x: cx.toFixed(1), y: (ffnAdd + 38).toFixed(1), 'text-anchor': 'middle', 'font-size': '10', 'font-family': 'monospace', fill: 'var(--ink-mute,#777)' }, [document.createTextNode('x out')]));
      // residual skips (curve around the blocks)
      var rx = cx + bw / 2 + 24;
      svg.appendChild(svgEl('path', { d: 'M ' + cx + ' 30 C ' + rx + ' 30, ' + rx + ' ' + attnAdd + ', ' + (cx + 36) + ' ' + (attnAdd + 12), fill: 'none', stroke: skip, 'stroke-width': '2', 'stroke-dasharray': '5 3' }));
      svg.appendChild(svgEl('path', { d: 'M ' + cx + ' ' + (attnAdd + 30) + ' C ' + rx + ' ' + (attnAdd + 30) + ', ' + rx + ' ' + ffnAdd + ', ' + (cx + 36) + ' ' + (ffnAdd + 12), fill: 'none', stroke: skip, 'stroke-width': '2', 'stroke-dasharray': '5 3' }));
      meta.textContent = state.skip ? 'residual on: the input adds back after each sublayer, so gradients flow straight through' : 'residual off: deep stacks of these blocks stop training — gradients vanish';
      formula.textContent = 'x → x + Attention(Norm(x)) → x + FFN(Norm(x))   ·   the + is the skip connection';
    };
    var grid = el('div', {}, [LF.select(state, 'skip', 'residual skip', [['on', 1], ['off', 0]])]);
    var orig = state._render;
    state._render = function () { state.skip = Number(state.skip); orig(); };
    shell(host, 'TRANSFORMER BLOCK', 'toggle the residual', grid, [svg, meta, formula],
      'A transformer block is two sublayers: self-attention, then a feed-forward network, each wrapped in add-and-norm. The dashed lines are the residual skips that carry the input x forward and add it back after each sublayer. Those skips are what let hundreds of blocks stack without the gradient dying on the way down.');
    state._render();
  }

  // ── flash-attention-memory: O(N^2) standard vs O(N) tiled ──────────────────
  function flashAttentionMemory(host) {
    var state = { logN: 12 };
    var W = 520, H = 220, PAD = 36;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var bytesPerEl = 2; // bf16 score
    function human(x) { var u = ['B', 'KB', 'MB', 'GB', 'TB']; var i = 0; while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; } return x.toFixed(x < 10 ? 1 : 0) + ' ' + u[i]; }
    var NMIN = 9, NMAX = 18; // 2^9 .. 2^18 tokens
    function stdBytes(N) { return N * N * bytesPerEl; }
    function flashBytes(N) { var blk = 128; return N * blk * bytesPerEl; }
    function px(ln) { return PAD + (ln - NMIN) / (NMAX - NMIN) * (W - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var ymax = Math.log2(stdBytes(Math.pow(2, NMAX)));
      var ymin = Math.log2(flashBytes(Math.pow(2, NMIN)));
      function py(bytes) { return H - PAD - (Math.log2(bytes) - ymin) / (ymax - ymin) * (H - 2 * PAD); }
      function curve(fn, color) {
        var d = '', i; for (i = 0; i <= 80; i++) { var ln = NMIN + (NMAX - NMIN) * i / 80; var N = Math.pow(2, ln); d += (i ? 'L' : 'M') + px(ln).toFixed(1) + ' ' + py(fn(N)).toFixed(1) + ' '; }
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: color, 'stroke-width': '2' }));
      }
      curve(stdBytes, 'var(--warn,#b8870f)');
      curve(flashBytes, 'var(--blueprint,#3553ff)');
      var ln = state.logN, N = Math.pow(2, ln);
      var sx = px(ln);
      svg.appendChild(svgEl('line', { x1: sx, y1: PAD, x2: sx, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(svgEl('circle', { cx: sx.toFixed(1), cy: py(stdBytes(N)).toFixed(1), r: '4', fill: 'var(--warn,#b8870f)' }));
      svg.appendChild(svgEl('circle', { cx: sx.toFixed(1), cy: py(flashBytes(N)).toFixed(1), r: '4', fill: 'var(--blueprint,#3553ff)' }));
      var sb = stdBytes(N), fb = flashBytes(N), saved = sb / fb;
      num.innerHTML = saved.toFixed(saved < 10 ? 1 : 0) + 'x <small>less memory</small>';
      meta.textContent = 'N = ' + fmtInt(N) + '  ·  standard (orange) ' + human(sb) + '  ·  flash (blue) ' + human(fb);
      formula.textContent = 'standard materializes the full N×N scores: O(N²)  ·  flash tiles and never stores it: O(N)';
    };
    var grid = el('div', {}, [slider(state, 'logN', 'sequence length (2^x)', NMIN, NMAX, 1, function (v) { return fmtInt(Math.pow(2, v)); })]);
    shell(host, 'FLASH ATTENTION MEMORY', 'drag the sequence length', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'Standard attention writes the full N×N score matrix to memory, so it grows with the square of the sequence length and quickly dominates. FlashAttention computes attention in tiles and never materializes that matrix, so its memory grows linearly. The two curves separate fast: at long context the saving is orders of magnitude.');
    state._render();
  }

  LF.register({
    'attention-heatmap': attentionHeatmap,
    'multihead-split': multiheadSplit,
    'causal-mask': causalMask,
    'softmax-attention-scaling': softmaxAttentionScaling,
    'word-vector-arithmetic': wordVectorArithmetic,
    'bpe-merge': bpeMerge,
    'gqa-kv-sharing': gqaKvSharing,
    'transformer-residual': transformerResidual,
    'flash-attention-memory': flashAttentionMemory
  });
})();
