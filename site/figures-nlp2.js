/* figures-nlp2.js — interactive lesson figures for Phase 5 (NLP foundations to
   advanced). Loads after lesson-figures.js, uses the shared LF toolkit, registers
   via LF.register. No deps, ES5 only, theme via CSS vars. Authoring is the same
   fenced ```figure block in docs/en.md. */
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

  function svgText(x, y, str, anchor, fill, size) {
    return svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'font-size': size || '10', 'font-family': 'monospace', fill: fill || 'var(--ink-soft,#555)' }, [document.createTextNode(str)]);
  }

  // ── bow-tfidf: raw term frequency vs tf-idf = tf · log(N/df) ────────────────
  function bowTfidf(host) {
    var state = { term: 0 };
    // Three short documents, fixed counts. N = 3 docs.
    var docs = [
      { name: 'doc1', tf: { the: 4, cat: 2, sat: 1, mat: 1 } },
      { name: 'doc2', tf: { the: 3, dog: 2, ran: 1 } },
      { name: 'doc3', tf: { the: 5, cat: 1, fox: 2 } }
    ];
    var terms = ['the', 'cat', 'sat', 'mat', 'dog', 'ran', 'fox'];
    var N = docs.length;
    function df(t) { var c = 0, i; for (i = 0; i < docs.length; i++) { if (docs[i].tf[t]) { c++; } } return c; }
    var rows = el('div', {});
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var t = terms[clamp(Math.round(state.term), 0, terms.length - 1)];
      var dft = df(t);
      var idf = Math.log(N / dft);
      while (rows.firstChild) { rows.removeChild(rows.firstChild); }
      var maxW = 0, i;
      for (i = 0; i < docs.length; i++) { var w = (docs[i].tf[t] || 0) * idf; if (w > maxW) { maxW = w; } }
      maxW = Math.max(maxW, 0.001);
      docs.forEach(function (d) {
        var tf = d.tf[t] || 0;
        var w = tf * idf;
        var bar = el('i'); bar.style.width = (w / maxW * 100).toFixed(1) + '%';
        if (w <= 0.0001) { bar.style.background = 'var(--rule-soft,#ccc)'; }
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [
          el('label', {}, [d.name + '  tf=' + tf, el('b', {}, [w.toFixed(3)])]),
          el('div', { class: 'lf-bar' }, [bar])
        ]));
      });
      meta.textContent = '"' + t + '" appears in ' + dft + ' of ' + N + ' docs  ·  ' + (dft === N ? 'in every doc: idf 0, weight collapses' : dft === 1 ? 'rare: high idf lifts its weight' : 'idf ' + idf.toFixed(3));
      formula.textContent = 'tf-idf = tf · log(N / df) = tf · log(' + N + ' / ' + dft + ') = tf · ' + idf.toFixed(3);
    };
    var sel = LF.select(state, 'term', 'term', terms.map(function (t, i) { return [t, i]; }));
    var orig = state._render;
    state._render = function () { state.term = Number(state.term); orig(); };
    var grid = el('div', {}, [sel]);
    shell(host, 'BAG OF WORDS / TF-IDF', 'pick a term', grid, [rows, meta, formula],
      'Bag of words counts raw frequency, so "the" looks important everywhere. TF-IDF multiplies each count by log(N over document-frequency): a word in every document has idf zero and its weight collapses, while a word in just one document gets a high idf and rises. The rare, discriminating words win.');
    state._render();
  }

  // ── rnn-unroll: h_t = tanh(W h_{t-1} + U x_t) as a chain of cells ───────────
  function rnnUnroll(host) {
    var state = { len: 5 };
    var W = 520, H = 200;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var Wh = 0.6, Ux = 0.5, xs = [1.0, -0.5, 0.8, 0.2, -0.3, 0.6, -0.1, 0.4];
    state._render = function () {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var n = clamp(Math.round(state.len), 1, 8);
      var step = (W - 60) / n, cy = 96, cw = Math.min(48, step - 16), ch = 40;
      var h = 0, i;
      for (i = 0; i < n; i++) {
        var cx = 30 + i * step + (step - cw) / 2;
        var ccx = cx + cw / 2;
        h = Math.tanh(Wh * h + Ux * xs[i]);
        if (i > 0) {
          var prevCx = 30 + (i - 1) * step + (step - cw) / 2 + cw;
          svg.appendChild(svgEl('line', { x1: prevCx.toFixed(1), y1: (cy + ch / 2).toFixed(1), x2: cx.toFixed(1), y2: (cy + ch / 2).toFixed(1), stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' }));
        }
        svg.appendChild(svgEl('rect', { x: cx.toFixed(1), y: cy.toFixed(1), width: cw.toFixed(1), height: ch.toFixed(1), rx: '3', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
        svg.appendChild(svgText(ccx.toFixed(1), (cy + ch / 2 + 4).toFixed(1), 'h' + i, 'middle', 'var(--ink-soft,#555)', '11'));
        svg.appendChild(svgText(ccx.toFixed(1), (cy - 22).toFixed(1), 'x' + i, 'middle', 'var(--ink-mute,#777)', '10'));
        svg.appendChild(svgEl('line', { x1: ccx.toFixed(1), y1: (cy - 16).toFixed(1), x2: ccx.toFixed(1), y2: cy.toFixed(1), stroke: 'var(--ink-mute,#999)', 'stroke-width': '1' }));
        svg.appendChild(svgText(ccx.toFixed(1), (cy + ch + 16).toFixed(1), h.toFixed(2), 'middle', 'var(--blueprint,#3553ff)', '9'));
      }
      meta.textContent = 'sequence length ' + n + '  ·  state passes left to right  ·  final h' + (n - 1) + ' = ' + h.toFixed(3);
      formula.textContent = 'h_t = tanh(W · h_{t-1} + U · x_t)   ·   W = ' + Wh + ', U = ' + Ux + '  (same weights every step)';
    };
    var grid = el('div', {}, [slider(state, 'len', 'sequence length', 1, 8, 1)]);
    shell(host, 'RNN UNROLLED', 'drag the length', grid, [svg, meta, formula],
      'A recurrent network is one cell applied at every time step, sharing the same weights. Unrolled across time it becomes a chain: each cell folds the new input into the previous hidden state with tanh, then passes the result forward. The final state has seen the whole sequence, which is also why long sequences make the gradient hard to carry back.');
    state._render();
  }

  // ── lstm-gates: forget erases, input writes, output exposes the cell state ──
  function lstmGates(host) {
    var state = { f: 0.7, i: 0.5, o: 0.8 };
    var W = 520, H = 180;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var cPrev = 1.0, cand = 0.8; // previous cell state, candidate value
    function bar(x, y, w, val, vmax, color, label) {
      var hh = Math.abs(val) / vmax * 60;
      svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: (y - hh).toFixed(1), width: w.toFixed(1), height: hh.toFixed(1), fill: color, 'fill-opacity': '0.75' }));
      svg.appendChild(svgEl('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: (x + w).toFixed(1), y2: y.toFixed(1), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      svg.appendChild(svgText((x + w / 2).toFixed(1), (y + 16).toFixed(1), label, 'middle', 'var(--ink-mute,#777)', '9'));
      svg.appendChild(svgText((x + w / 2).toFixed(1), (y - hh - 4).toFixed(1), val.toFixed(2), 'middle', 'var(--ink-soft,#555)', '9'));
    }
    state._render = function () {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var kept = state.f * cPrev;
      var written = state.i * cand;
      var cNew = kept + written;
      var hOut = state.o * Math.tanh(cNew);
      var baseY = 120, bw = 70, gap = 24, x0 = 36, vmax = 2.0;
      bar(x0, baseY, bw, cPrev, vmax, 'var(--ink-mute,#999)', 'c_{t-1}');
      bar(x0 + (bw + gap), baseY, bw, kept, vmax, 'var(--warn,#b8870f)', 'f·c (kept)');
      bar(x0 + 2 * (bw + gap), baseY, bw, written, vmax, 'var(--blueprint,#3553ff)', 'i·g (written)');
      bar(x0 + 3 * (bw + gap), baseY, bw, cNew, vmax, 'var(--blueprint,#3553ff)', 'c_t');
      bar(x0 + 4 * (bw + gap), baseY, bw, hOut, vmax, 'var(--blueprint,#3553ff)', 'h_t = o·tanh');
      meta.textContent = 'forget keeps ' + (state.f * 100).toFixed(0) + '% of old state  ·  input writes ' + (state.i * 100).toFixed(0) + '% of candidate  ·  output exposes ' + (state.o * 100).toFixed(0) + '%';
      formula.textContent = 'c_t = f · c_{t-1} + i · g  =  ' + state.f.toFixed(2) + '·' + cPrev.toFixed(1) + ' + ' + state.i.toFixed(2) + '·' + cand.toFixed(1) + ' = ' + cNew.toFixed(2) + '   ·   h_t = o · tanh(c_t)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'f', 'forget gate f', 0, 1, 0.02),
      slider(state, 'i', 'input gate i', 0, 1, 0.02),
      slider(state, 'o', 'output gate o', 0, 1, 0.02)
    ]);
    shell(host, 'LSTM GATES', 'drag the gates', grid, [svg, meta, formula],
      'The LSTM cell state is a memory the gates edit. The forget gate erases part of the old state, the input gate writes part of a new candidate, and the two add to form the next cell state. The output gate then controls how much of that state leaks out as the hidden vector. Gates near zero or one let the cell hold a value for many steps without the gradient vanishing.');
    state._render();
  }

  // ── seq2seq-alignment: encoder-decoder attention, rows sum to 1 ─────────────
  function seq2seqAlignment(host) {
    var state = { sharp: 1.0 };
    var src = ['the', 'red', 'house', '.'];
    var tgt = ['la', 'maison', 'rouge', '.'];
    // Base alignment logits: target row -> source columns. Reordering captured.
    var base = [
      [2.0, 0.2, 0.4, 0.1],
      [0.3, 0.5, 2.2, 0.1],
      [0.2, 2.1, 0.5, 0.1],
      [0.1, 0.1, 0.2, 2.4]
    ];
    var W = 520, H = 240, PAD = 70;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var n = src.length;
    var CELL = (W - PAD - 14) / n;
    state._render = function () {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var s = Math.max(0.1, state.sharp), r, c;
      for (r = 0; r < n; r++) {
        var row = base[r].map(function (z) { return Math.exp(z * s); });
        var sum = row.reduce(function (a, b) { return a + b; }, 0);
        var probs = row.map(function (e) { return e / sum; });
        for (c = 0; c < n; c++) {
          var x = PAD + c * CELL, y = 30 + r * CELL;
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (CELL - 2).toFixed(1), height: (CELL - 2).toFixed(1), fill: 'var(--blueprint,#3553ff)', 'fill-opacity': probs[c].toFixed(3), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
        }
        svg.appendChild(svgText((PAD - 6).toFixed(1), (30 + r * CELL + CELL / 2).toFixed(1), tgt[r], 'end', 'var(--ink-soft,#555)', '10'));
      }
      for (c = 0; c < n; c++) {
        svg.appendChild(svgText((PAD + c * CELL + CELL / 2).toFixed(1), '24', src[c], 'middle', 'var(--ink-mute,#777)', '10'));
      }
      meta.textContent = 'rows = target tokens, columns = source tokens  ·  each row softmaxes to 1  ·  diagonal-off cells show reordering';
      formula.textContent = 'context_t = Σ_s align[t][s] · encoder_s   ·   align = softmax over source for each target token';
    };
    var grid = el('div', {}, [slider(state, 'sharp', 'alignment sharpness', 0.2, 3.0, 0.05)]);
    shell(host, 'SEQ2SEQ ALIGNMENT', 'drag the sharpness', grid, [svg, meta, formula],
      'Attention gives the decoder a soft alignment over the source. Each target token reads a weighted blend of every encoder state, and those weights softmax to one across the source row. Here "maison" attends to "house" and "rouge" to "red", so the off-diagonal cells reveal the reordering that translation needs. Sharper weights pick one source word; flatter weights blend several.');
    state._render();
  }

  // ── edit-distance: Levenshtein DP matrix, min-edit path, distance readout ───
  function editDistance(host) {
    var pairs = [['kitten', 'sitting'], ['flaw', 'lawn'], ['sunday', 'saturday'], ['book', 'back']];
    var state = { pair: 0 };
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var pr = pairs[clamp(Math.round(state.pair), 0, pairs.length - 1)];
      var a = pr[0], b = pr[1], m = a.length, n = b.length;
      var D = [], i, j;
      for (i = 0; i <= m; i++) { D.push([]); for (j = 0; j <= n; j++) { D[i].push(0); } }
      for (i = 0; i <= m; i++) { D[i][0] = i; }
      for (j = 0; j <= n; j++) { D[0][j] = j; }
      for (i = 1; i <= m; i++) {
        for (j = 1; j <= n; j++) {
          var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
          D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost);
        }
      }
      // Backtrace the min-edit path.
      var path = {}; i = m; j = n;
      while (i > 0 || j > 0) {
        path[i + ',' + j] = 1;
        if (i > 0 && j > 0) {
          var cst = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
          if (D[i][j] === D[i - 1][j - 1] + cst) { i--; j--; continue; }
        }
        if (i > 0 && D[i][j] === D[i - 1][j] + 1) { i--; continue; }
        j--;
      }
      path['0,0'] = 1;
      var ox = 70, oy = 56, cell = Math.min(46, (W - ox - 12) / (n + 1), (H - oy - 12) / (m + 1));
      for (j = 0; j <= n; j++) { if (j > 0) { svg.appendChild(svgText((ox + j * cell + cell / 2).toFixed(1), (oy - cell / 2 + 4).toFixed(1), b.charAt(j - 1), 'middle', 'var(--ink-mute,#777)', '11')); } }
      for (i = 0; i <= m; i++) { if (i > 0) { svg.appendChild(svgText((ox - cell / 2).toFixed(1), (oy + i * cell + cell / 2 + 4).toFixed(1), a.charAt(i - 1), 'middle', 'var(--ink-mute,#777)', '11')); } }
      for (i = 0; i <= m; i++) {
        for (j = 0; j <= n; j++) {
          var on = path[i + ',' + j];
          svg.appendChild(svgEl('rect', { x: (ox + j * cell).toFixed(1), y: (oy + i * cell).toFixed(1), width: (cell - 1.5).toFixed(1), height: (cell - 1.5).toFixed(1), fill: on ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', 'fill-opacity': on ? '0.5' : '0.4', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
          svg.appendChild(svgText((ox + j * cell + cell / 2).toFixed(1), (oy + i * cell + cell / 2 + 4).toFixed(1), String(D[i][j]), 'middle', on ? 'var(--blueprint,#3553ff)' : 'var(--ink-soft,#555)', '10'));
        }
      }
      num.innerHTML = D[m][n] + ' <small>edits</small>';
      meta.textContent = '"' + a + '" → "' + b + '"  ·  highlighted cells are the minimum-edit path  ·  bottom-right is the distance';
      formula.textContent = 'D[i][j] = min( D[i-1][j]+1 del, D[i][j-1]+1 ins, D[i-1][j-1]+[a≠b] sub )';
    };
    var sel = LF.select(state, 'pair', 'string pair', pairs.map(function (p, i) { return [p[0] + ' → ' + p[1], i]; }));
    var orig = state._render;
    state._render = function () { state.pair = Number(state.pair); orig(); };
    var grid = el('div', {}, [sel]);
    shell(host, 'EDIT DISTANCE', 'pick a pair', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'Levenshtein distance fills a table where each cell is the cheapest way to turn one prefix into another using insert, delete, and substitute. Every cell takes the minimum of its three neighbors, so the bottom-right corner is the distance for the whole strings. Tracing back the choices recovers the actual edit path, which is how spell-checkers and translation metrics align text.');
    state._render();
  }

  // ── ngram-backoff: higher n captures more context but sparser counts ────────
  function ngramBackoff(host) {
    var state = { n: 2 };
    // Toy corpus token count and vocabulary; observed n-grams shrink with n.
    var tokens = 100000, vocab = 5000;
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M', 'B', 'T'], i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }
    state._render = function () {
      var n = clamp(Math.round(state.n), 1, 5);
      var possible = Math.pow(vocab, n);
      // Distinct n-grams actually seen are bounded by corpus length and saturate.
      var observed = Math.min(tokens - n + 1, possible);
      var coverage = observed / possible;
      num.innerHTML = (coverage * 100 < 0.001 ? coverage.toExponential(1) : (coverage * 100).toFixed(coverage * 100 < 1 ? 4 : 1) + '%') + ' <small>of n-grams seen</small>';
      bar.style.width = Math.max(1, Math.min(100, coverage * 100)).toFixed(2) + '%';
      barWrap.classList.toggle('over', coverage < 0.001);
      meta.textContent = n + '-gram: ' + human(observed) + ' observed of ' + human(possible) + ' possible  ·  ' + (n >= 4 ? 'severe sparsity: most contexts never seen, back off to lower n' : n === 1 ? 'unigram: no context, but every count dense' : 'more context, fewer counts');
      formula.textContent = 'P(w | history of n-1) needs counts of length-n grams  ·  V^n = ' + vocab + '^' + n + ' = ' + human(possible) + ' possible';
    };
    var grid = el('div', {}, [slider(state, 'n', 'n (gram order)', 1, 5, 1)]);
    shell(host, 'N-GRAM SPARSITY', 'drag n', grid, [num, barWrap, meta, formula],
      'An n-gram model predicts the next word from the previous n-1. Raising n captures more context, but the number of possible grams is the vocabulary to the power n, so the fraction your corpus actually observes collapses toward zero. Most long contexts are never seen, which is why high-order models must smooth unseen grams and back off to shorter, denser ones.');
    state._render();
  }

  // ── ner-bio-tagging: BIO tags per token, drag which span is the entity ──────
  function nerBioTagging(host) {
    var toks = ['Barack', 'Obama', 'visited', 'New', 'York', 'last', 'week'];
    // Candidate entity spans: [startIndex, length, type]
    var spans = [
      [0, 2, 'PER'],
      [3, 2, 'LOC'],
      [0, 1, 'PER']
    ];
    var state = { span: 0 };
    var W = 520, H = 130;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var sp = spans[clamp(Math.round(state.span), 0, spans.length - 1)];
      var start = sp[0], len = sp[1], type = sp[2];
      var n = toks.length, bw = (W - 30) / n, x0 = 15, tags = [];
      var i;
      for (i = 0; i < n; i++) {
        var tag = 'O';
        if (i === start) { tag = 'B-' + type; }
        else if (i > start && i < start + len) { tag = 'I-' + type; }
        tags.push(tag);
        var inside = tag !== 'O';
        var x = x0 + i * bw;
        svg.appendChild(svgEl('rect', { x: (x + 3).toFixed(1), y: '34', width: (bw - 6).toFixed(1), height: '34', rx: '3', fill: inside ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', 'fill-opacity': inside ? (tag.charAt(0) === 'B' ? '0.8' : '0.5') : '0.4', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
        svg.appendChild(svgText((x + bw / 2).toFixed(1), '55', toks[i], 'middle', 'var(--ink-soft,#555)', '10'));
        svg.appendChild(svgText((x + bw / 2).toFixed(1), '88', tag, 'middle', inside ? 'var(--blueprint,#3553ff)' : 'var(--ink-mute,#777)', '9'));
      }
      meta.textContent = 'entity span "' + toks.slice(start, start + len).join(' ') + '" tagged as ' + type + '  ·  B = begin, I = inside, O = outside';
      formula.textContent = 'BIO: first token of an entity gets B-TYPE, continuation tokens get I-TYPE, everything else is O';
    };
    var sel = LF.select(state, 'span', 'entity span', spans.map(function (s, i) { return [toks.slice(s[0], s[0] + s[1]).join(' ') + ' (' + s[2] + ')', i]; }));
    var orig = state._render;
    state._render = function () { state.span = Number(state.span); orig(); };
    var grid = el('div', {}, [sel]);
    shell(host, 'NER BIO TAGGING', 'pick the entity', grid, [svg, meta, formula],
      'Named-entity recognition is framed as per-token tagging. The BIO scheme marks the first token of an entity with B-TYPE, every continuation token with I-TYPE, and all other tokens with O. This lets a sequence labeler express multi-word entities and exact boundaries: "New York" becomes B-LOC then I-LOC, distinct from two separate single-word locations.');
    state._render();
  }

  // ── sentiment-logits: summed word weights → logit → sigmoid → probability ───
  function sentimentLogits(host) {
    var words = ['great', 'not', 'terrible', 'okay'];
    var state = { w0: 1.6, w1: -0.4, w2: -1.8, w3: 0.2, bias: 0.0 };
    var keys = ['w0', 'w1', 'w2', 'w3'];
    var W = 520, H = 120;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var logit = state.bias, i;
      for (i = 0; i < keys.length; i++) { logit += state[keys[i]]; }
      var prob = 1 / (1 + Math.exp(-logit));
      var bw = (W - 30) / words.length, x0 = 15, vmax = 2.0, baseY = 70;
      for (i = 0; i < words.length; i++) {
        var v = state[keys[i]];
        var hh = Math.abs(v) / vmax * 40;
        var x = x0 + i * bw;
        var up = v >= 0;
        svg.appendChild(svgEl('rect', { x: (x + bw / 2 - 14).toFixed(1), y: (up ? baseY - hh : baseY).toFixed(1), width: '28', height: hh.toFixed(1), fill: up ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)', 'fill-opacity': '0.75' }));
        svg.appendChild(svgEl('line', { x1: x.toFixed(1), y1: baseY.toFixed(1), x2: (x + bw).toFixed(1), y2: baseY.toFixed(1), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
        svg.appendChild(svgText((x + bw / 2).toFixed(1), (baseY + 18).toFixed(1), words[i], 'middle', 'var(--ink-soft,#555)', '10'));
        svg.appendChild(svgText((x + bw / 2).toFixed(1), (up ? baseY - hh - 4 : baseY + hh + 28).toFixed(1), v.toFixed(2), 'middle', 'var(--ink-mute,#777)', '9'));
      }
      num.innerHTML = (prob * 100).toFixed(1) + '% <small>positive</small>';
      meta.textContent = 'summed logit ' + logit.toFixed(2) + '  ·  sigmoid → ' + (prob >= 0.5 ? 'positive' : 'negative') + '  ·  blue lifts, orange lowers';
      formula.textContent = 'logit = bias + Σ wᵢ = ' + logit.toFixed(2) + '   ·   P(positive) = σ(logit) = 1 / (1 + e^−logit)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'w0', '"great" weight', -2, 2, 0.05),
      slider(state, 'w1', '"not" weight', -2, 2, 0.05),
      slider(state, 'w2', '"terrible" weight', -2, 2, 0.05),
      slider(state, 'w3', '"okay" weight', -2, 2, 0.05),
      slider(state, 'bias', 'bias', -2, 2, 0.05)
    ]);
    shell(host, 'SENTIMENT LOGITS', 'drag the word weights', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'A linear text classifier scores each word with a learned weight, sums them with a bias into a single logit, then squashes it through the sigmoid into a probability. Positive weights push toward positive sentiment, negative weights pull the other way. The decision flips at probability one half, where the summed logit crosses zero.');
    state._render();
  }

  LF.register({
    'bow-tfidf': bowTfidf,
    'rnn-unroll': rnnUnroll,
    'lstm-gates': lstmGates,
    'seq2seq-alignment': seq2seqAlignment,
    'edit-distance': editDistance,
    'ngram-backoff': ngramBackoff,
    'ner-bio-tagging': nerBioTagging,
    'sentiment-logits': sentimentLogits
  });
})();
