/* figures-foundations2.js — interactive lesson figures for Phase 4 (computer
   vision), Phase 6 (speech & audio), and Phase 8 (generative AI). Loads after
   lesson-figures.js and registers widgets through window.LF. Vanilla ES5, no
   deps, theme via CSS vars. Authoring is the same fenced block in docs/en.md:
       ```figure
       data-augmentation
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, select = LF.select;
  var clamp = LF.clamp, lerp = LF.lerp, fmtInt = LF.fmtInt;

  function shell(label, hint, grid, outKids, caption) {
    return el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, outKids)]),
      el('div', { class: 'lf-cap' }, [caption])
    ]);
  }
  function tx(s) { return document.createTextNode(s); }

  // ── data-augmentation: one source image, four transformed copies ───────────
  function dataAugmentation(host) {
    var SRC = [
      [0, 0, 6, 6, 0, 0],
      [0, 6, 9, 9, 3, 0],
      [6, 9, 2, 2, 9, 3],
      [3, 9, 2, 2, 9, 6],
      [0, 3, 9, 9, 6, 0],
      [0, 0, 3, 6, 0, 0]
    ];
    var N = 6;
    var state = { mode: 'flip', copies: 4 };
    var svg = svgEl('svg', { viewBox: '0 0 520 200' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    function sample(r, c, variant) {
      if (state.mode === 'flip') { return SRC[r][variant % 2 ? N - 1 - c : c]; }
      if (state.mode === 'rotate') {
        var q = variant % 4, rr = r, cc = c, t;
        while (q-- > 0) { t = rr; rr = cc; cc = N - 1 - t; }
        return SRC[rr][cc];
      }
      if (state.mode === 'crop') {
        var off = variant % 3;
        var sr = clamp(r + off - 1, 0, N - 1), sc = clamp(c + off - 1, 0, N - 1);
        return SRC[sr][sc];
      }
      var shift = (variant - 1) * 2;
      return clamp(SRC[r][c] + shift, 0, 9);
    }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var cell = 18, gap = 16, x0 = 8, y0 = 28;
      svg.appendChild(svgEl('text', { x: x0, y: 18, fill: 'var(--ink-mute,#777)', 'font-size': '10', 'font-family': 'monospace' }, [tx('source')]));
      var p, r, c;
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
        svg.appendChild(svgEl('rect', { x: x0 + c * cell, y: y0 + r * cell, width: cell - 1, height: cell - 1, fill: 'var(--blueprint,#3553ff)', opacity: (0.08 + 0.9 * SRC[r][c] / 9).toFixed(3) }));
      }
      var bx = x0 + N * cell + 30;
      for (p = 1; p <= state.copies; p++) {
        var px0 = bx + (p - 1) * (N * cell + gap);
        svg.appendChild(svgEl('text', { x: px0, y: 18, fill: 'var(--warn,#b8870f)', 'font-size': '10', 'font-family': 'monospace' }, [tx('aug ' + p)]));
        for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
          svg.appendChild(svgEl('rect', { x: px0 + c * cell, y: y0 + r * cell, width: cell - 1, height: cell - 1, fill: 'var(--blueprint,#3553ff)', opacity: (0.08 + 0.9 * sample(r, c, p) / 9).toFixed(3) }));
        }
      }
      var base = 1000;
      meta.textContent = 'each pass yields a fresh view  ·  ' + base + ' images x ' + (state.copies + 1) + ' = ' + fmtInt(base * (state.copies + 1)) + ' effective examples';
      formula.textContent = 'augment(x) preserves the label while changing the pixels  ·  the model sees more variation, generalizes better';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      select(state, 'mode', 'transform', [['horizontal flip', 'flip'], ['rotate 90', 'rotate'], ['random crop', 'crop'], ['color jitter', 'color']]),
      slider(state, 'copies', 'augmented copies', 1, 4, 1)
    ]);
    host.appendChild(shell('DATA AUGMENTATION', 'pick a transform',
      grid, [svg, meta, formula],
      'Augmentation applies label-preserving transforms — flips, rotations, crops, color shifts — to each training image, so one labelled example becomes many. The network never sees the exact same input twice and learns features that survive these changes, which expands the effective dataset and curbs overfitting without collecting more data.'));
    state._render();
  }

  // ── transfer-learning: freeze a pretrained backbone, train the head ────────
  function transferLearning(host) {
    var TOTAL = 24, FULL = 24e6;
    var state = { frozen: 18 };
    var svg = svgEl('svg', { viewBox: '0 0 520 150' });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function human(x) { var u = ['', 'K', 'M', 'B'], i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return x.toFixed(x < 10 ? 1 : 0) + u[i]; }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var frozen = clamp(state.frozen, 0, TOTAL), trainable = TOTAL - frozen;
      var x0 = 30, y0 = 40, bw = 460 / TOTAL, bh = 46, i;
      for (i = 0; i < TOTAL; i++) {
        var isFrozen = i < frozen;
        svg.appendChild(svgEl('rect', { x: x0 + i * bw, y: y0, width: bw - 1.5, height: bh, fill: isFrozen ? 'var(--rule-soft,#ddd)' : 'var(--blueprint,#3553ff)', opacity: isFrozen ? '0.9' : '0.85' }));
      }
      svg.appendChild(svgEl('text', { x: x0, y: y0 - 10, fill: 'var(--ink-mute,#777)', 'font-size': '11', 'font-family': 'monospace' }, [tx('input →  ' + frozen + ' frozen (grey)  ·  ' + trainable + ' trainable (blue)  → head')]));
      var fracTrain = trainable / TOTAL;
      var trainableParams = FULL * fracTrain;
      var epochs = Math.max(2, Math.round(2 + 22 * fracTrain));
      svg.appendChild(svgEl('text', { x: x0, y: y0 + bh + 22, fill: 'var(--ink-mute,#777)', 'font-size': '11', 'font-family': 'monospace' }, [tx('gradients flow only through the blue layers')]));
      num.innerHTML = human(trainableParams) + ' <small>trainable params</small>';
      meta.textContent = Math.round(fracTrain * 100) + '% of the backbone trains  ·  about ' + epochs + ' epochs to converge on a small dataset';
      formula.textContent = 'frozen layers keep pretrained weights, contribute no gradients  ·  fewer trainable params → less data and compute needed';
    };
    var grid = el('div', {}, [slider(state, 'frozen', 'layers frozen', 0, TOTAL, 1)]);
    host.appendChild(shell('TRANSFER LEARNING', 'drag the freeze line',
      grid, [svg, num, meta, formula],
      'A pretrained backbone already knows generic features — edges, textures, shapes. Transfer learning freezes those lower layers and trains only the top few plus a new head on the target task. Fewer trainable parameters means fewer gradients to store, far less data to fit, and faster convergence; freeze more when your dataset is tiny, fewer when it is large and different.'));
    state._render();
  }

  // ── batchnorm-inference: batch stats in training vs running averages ───────
  function batchnormInference(host) {
    var POP_MEAN = 0.0, POP_STD = 1.0;
    var state = { batch: 8, seed: 3 };
    var svg = svgEl('svg', { viewBox: '0 0 520 200' });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function rng(s) { var x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); }
    function gauss(s) { var u = Math.max(1e-6, rng(s)), v = rng(s + 7.13); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var W = 520, H = 200, PAD = 30, n = state.batch, i, sum = 0, sumsq = 0, xs = [];
      for (i = 0; i < n; i++) { var g = POP_MEAN + POP_STD * gauss(state.seed * 31 + i * 1.7); xs.push(g); sum += g; sumsq += g * g; }
      var bMean = sum / n, bVar = sumsq / n - bMean * bMean, bStd = Math.sqrt(Math.max(1e-6, bVar));
      function px(v) { return W / 2 + v / 4 * (W - 2 * PAD) / 2; }
      svg.appendChild(svgEl('line', { x1: PAD, y1: 70, x2: W - PAD, y2: 70, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      for (i = 0; i < n; i++) { svg.appendChild(svgEl('circle', { cx: px(xs[i]), cy: 70, r: '4', fill: 'var(--blueprint,#3553ff)', opacity: '0.8' })); }
      svg.appendChild(svgEl('line', { x1: px(bMean), y1: 50, x2: px(bMean), y2: 90, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('text', { x: PAD, y: 44, fill: 'var(--warn,#b8870f)', 'font-size': '11', 'font-family': 'monospace' }, [tx('training: this batch  μ=' + bMean.toFixed(2) + '  σ=' + bStd.toFixed(2))]));
      svg.appendChild(svgEl('line', { x1: PAD, y1: 150, x2: W - PAD, y2: 150, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: px(POP_MEAN), y1: 130, x2: px(POP_MEAN), y2: 170, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('text', { x: PAD, y: 124, fill: 'var(--ink-mute,#777)', 'font-size': '11', 'font-family': 'monospace' }, [tx('inference: running avg  μ=' + POP_MEAN.toFixed(2) + '  σ=' + POP_STD.toFixed(2))]));
      var err = Math.abs(bMean - POP_MEAN) + Math.abs(bStd - POP_STD);
      num.innerHTML = err.toFixed(3) + ' <small>batch-vs-population gap</small>';
      meta.textContent = n + ' samples per batch  ·  ' + (n <= 4 ? 'small batch: noisy estimates, unstable normalization' : n >= 32 ? 'large batch: stable estimates close to the population' : 'moderate batch: usable estimates');
      formula.textContent = 'train: normalize by THIS batch μ,σ  ·  eval: normalize by running averages collected during training';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'batch', 'batch size', 1, 64, 1),
      slider(state, 'seed', 'resample batch', 1, 20, 1)
    ]);
    host.appendChild(shell('BATCHNORM: TRAIN vs EVAL', 'drag the batch size',
      grid, [svg, num, meta, formula],
      'During training BatchNorm normalizes each activation by the mean and variance of the current mini-batch (orange), and quietly accumulates a running average. At inference it switches to those frozen running averages (blue) so a single input is processed deterministically. Small batches make the per-batch statistics noisy, which is why tiny batches hurt BatchNorm and motivate Group or Layer Norm.'));
    state._render();
  }

  // ── ctc-collapse: per-frame chars collapse to a transcript ─────────────────
  function ctcCollapse(host) {
    var FRAMES = ['_', 'h', 'h', 'e', '_', 'l', 'l', '_', 'l', 'l', 'o', 'o', '_'];
    var state = { stage: 2 };
    var svg = svgEl('svg', { viewBox: '0 0 520 170' });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    function collapseRepeats(seq) {
      var out = [], prev = null, i;
      for (i = 0; i < seq.length; i++) { if (seq[i] !== prev) { out.push(seq[i]); } prev = seq[i]; }
      return out;
    }
    function removeBlanks(seq) { return seq.filter(function (c) { return c !== '_'; }); }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var shown;
      if (state.stage === 0) { shown = FRAMES.slice(); }
      else if (state.stage === 1) { shown = collapseRepeats(FRAMES); }
      else { shown = removeBlanks(collapseRepeats(FRAMES)); }
      var x0 = 20, y0 = 50, cw = 36, i;
      var stageLabel = state.stage === 0 ? 'raw per-frame argmax (' + FRAMES.length + ' frames)'
        : state.stage === 1 ? 'merge adjacent repeats' : 'drop blank token "_"';
      svg.appendChild(svgEl('text', { x: x0, y: 30, fill: 'var(--ink-mute,#777)', 'font-size': '11', 'font-family': 'monospace' }, [tx(stageLabel)]));
      for (i = 0; i < shown.length; i++) {
        var blank = shown[i] === '_';
        svg.appendChild(svgEl('rect', { x: x0 + i * cw, y: y0, width: cw - 4, height: 36, fill: blank ? 'var(--rule-soft,#ddd)' : 'var(--blueprint,#3553ff)', opacity: blank ? '0.7' : '0.85' }));
        svg.appendChild(svgEl('text', { x: x0 + i * cw + (cw - 4) / 2, y: y0 + 24, fill: 'var(--bg,#fafaf5)', 'font-size': '16', 'font-family': 'monospace', 'text-anchor': 'middle' }, [tx(blank ? '∅' : shown[i])]));
      }
      var transcript = removeBlanks(collapseRepeats(FRAMES)).join('');
      svg.appendChild(svgEl('text', { x: x0, y: y0 + 70, fill: 'var(--warn,#b8870f)', 'font-size': '13', 'font-family': 'monospace' }, [tx('final transcript: "' + transcript + '"')]));
      num.innerHTML = shown.length + ' <small>symbols at this stage</small>';
      meta.textContent = state.stage === 0 ? 'the acoustic model emits one symbol per audio frame, with repeats and blanks'
        : state.stage === 1 ? 'repeated runs of the same symbol become one' : 'blanks are removed, leaving the text';
      formula.textContent = 'CTC decode: collapse repeats first, THEN remove blanks  ·  the blank lets the model separate true double letters';
    };
    var grid = el('div', {}, [slider(state, 'stage', 'decode stage (0 raw → 1 merge → 2 final)', 0, 2, 1)]);
    host.appendChild(shell('CTC COLLAPSE', 'step through decoding',
      grid, [svg, num, meta, formula],
      'CTC lets an acoustic model emit one label per frame without knowing the alignment. Decoding runs two steps in order: first collapse any run of identical symbols into one, then delete the blank token. The blank is essential — it sits between two real "l" frames so that "hello" keeps both letters instead of merging them into one.'));
    state._render();
  }

  // ── mfcc-pipeline: spectrogram → mel → log → DCT → keep N coeffs ────────────
  function mfccPipeline(host) {
    var state = { keep: 13 };
    var MELS = 40;
    var svg = svgEl('svg', { viewBox: '0 0 520 170' });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var stages = ['spectrogram', 'mel filterbank', 'log', 'DCT', 'MFCC'];
      var x0 = 16, y0 = 30, sw = 96, gap = 4, i;
      for (i = 0; i < stages.length; i++) {
        var sx = x0 + i * (sw + gap);
        svg.appendChild(svgEl('rect', { x: sx, y: y0, width: sw, height: 40, fill: i === stages.length - 1 ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', opacity: i === stages.length - 1 ? '0.85' : '1', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
        svg.appendChild(svgEl('text', { x: sx + sw / 2, y: y0 + 24, fill: i === stages.length - 1 ? 'var(--bg,#fafaf5)' : 'var(--ink-soft,#555)', 'font-size': '10', 'font-family': 'monospace', 'text-anchor': 'middle' }, [tx(stages[i])]));
        if (i < stages.length - 1) {
          svg.appendChild(svgEl('text', { x: sx + sw + gap / 2 - 1, y: y0 + 26, fill: 'var(--ink-mute,#777)', 'font-size': '12', 'font-family': 'monospace', 'text-anchor': 'middle' }, [tx('→')]));
        }
      }
      var bx = 16, by = 110, bw = 488 / MELS;
      for (i = 0; i < MELS; i++) {
        var kept = i < state.keep;
        var energy = Math.exp(-i * 0.12);
        svg.appendChild(svgEl('rect', { x: bx + i * bw, y: by, width: bw - 0.8, height: 36, fill: kept ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', opacity: kept ? (0.3 + 0.7 * energy).toFixed(3) : '0.5' }));
      }
      svg.appendChild(svgEl('text', { x: bx, y: by - 6, fill: 'var(--ink-mute,#777)', 'font-size': '10', 'font-family': 'monospace' }, [tx('cepstral coefficients: blue kept, grey discarded (' + MELS + ' total)')]));
      num.innerHTML = state.keep + ' <small>MFCC coefficients kept</small>';
      meta.textContent = 'keeping the first ' + state.keep + ' of ' + MELS + ' coefficients  ·  ' + (state.keep <= 8 ? 'coarse: smooth spectral envelope only' : state.keep >= 26 ? 'fine: includes pitch-like detail and noise' : 'typical for speech (12-13)');
      formula.textContent = 'STFT power → mel filterbank → log → DCT → keep low coefficients  ·  the DCT compacts the envelope into the first few';
    };
    var grid = el('div', {}, [slider(state, 'keep', 'cepstral coefficients kept', 4, 40, 1)]);
    host.appendChild(shell('MFCC PIPELINE', 'drag the coefficient count',
      grid, [svg, num, meta, formula],
      'MFCCs run a fixed pipeline: take the spectrogram, warp it onto mel-spaced filters, take the log to mimic loudness perception, then apply a DCT. The DCT packs the smooth spectral envelope into the first few coefficients, so keeping only the lowest 12-13 captures the vocal-tract shape that distinguishes phonemes while discarding pitch and noise in the higher coefficients.'));
    state._render();
  }

  // ── autoencoder-bottleneck: reconstruction quality vs latent dim ───────────
  function autoencoderBottleneck(host) {
    var DIN = 16;
    var SIGNAL = [];
    (function () { var i; for (i = 0; i < DIN; i++) { SIGNAL.push(0.5 + 0.45 * Math.sin(i * 0.9) + 0.18 * Math.sin(i * 2.7)); } })();
    var state = { latent: 4 };
    var svg = svgEl('svg', { viewBox: '0 0 520 180' });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    function reconstruct(z) {
      var coeffs = [], k2;
      for (k2 = 0; k2 < z; k2++) {
        var c = 0, i2;
        for (i2 = 0; i2 < DIN; i2++) { c += (SIGNAL[i2] - 0.5) * Math.cos(Math.PI * (k2 + 0.5) * i2 / DIN); }
        coeffs.push(c * 2 / DIN);
      }
      var rec = [], i3, kk;
      for (i3 = 0; i3 < DIN; i3++) {
        var s = 0.5;
        for (kk = 0; kk < z; kk++) { s += coeffs[kk] * Math.cos(Math.PI * (kk + 0.5) * i3 / DIN); }
        rec.push(s);
      }
      return rec;
    }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var rec = reconstruct(state.latent);
      var x0 = 30, y0 = 16, gw = 460, gh = 110, i;
      function px(i) { return x0 + i / (DIN - 1) * gw; }
      function py(v) { return y0 + gh - clamp(v, -0.2, 1.2) / 1.4 * gh; }
      var od = '', rd = '';
      for (i = 0; i < DIN; i++) { od += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(SIGNAL[i]).toFixed(1) + ' '; rd += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(rec[i]).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: od, fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('path', { d: rd, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2', 'stroke-dasharray': '5 3' }));
      svg.appendChild(svgEl('text', { x: x0, y: y0 + gh + 22, fill: 'var(--ink-mute,#777)', 'font-size': '11', 'font-family': 'monospace' }, [tx('grey = input (' + DIN + ' dims)   ·   blue dashed = reconstruction from ' + state.latent + '-dim bottleneck')]));
      var mse = 0;
      for (i = 0; i < DIN; i++) { mse += (rec[i] - SIGNAL[i]) * (rec[i] - SIGNAL[i]); }
      mse /= DIN;
      var ratio = DIN / state.latent;
      num.innerHTML = mse.toFixed(4) + ' <small>reconstruction MSE</small>';
      meta.textContent = ratio.toFixed(1) + 'x compression (' + DIN + ' → ' + state.latent + ')  ·  ' + (state.latent <= 2 ? 'bottleneck too small: detail is lost' : state.latent >= DIN - 1 ? 'wide bottleneck: near-perfect but no compression' : 'compresses while keeping the main structure');
      formula.textContent = 'x → encoder → z (' + state.latent + ' dims) → decoder → x̂  ·  the bottleneck forces the network to keep only what matters';
    };
    var grid = el('div', {}, [slider(state, 'latent', 'bottleneck dimension', 1, DIN, 1)]);
    host.appendChild(shell('AUTOENCODER BOTTLENECK', 'drag the latent dim',
      grid, [svg, num, meta, formula],
      'An autoencoder squeezes its input through a narrow bottleneck and rebuilds it on the far side. A wide bottleneck copies everything but learns nothing; a tiny one forces the network to discard detail and keep only the dominant structure, so reconstruction error rises as compression increases. The sweet spot keeps the signal while throwing away the noise — that learned code is the useful representation.'));
    state._render();
  }

  // ── normalizing-flow: invertible map, base → target, log-det Jacobian ──────
  function normalizingFlow(host) {
    var state = { a: 1.4 };
    var W = 520, H = 210, PAD = 34;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function base(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }
    function fwd(z, a) { return z + a * Math.tanh(z); }
    function dfwd(z, a) { var th = Math.tanh(z); return 1 + a * (1 - th * th); }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var a = state.a, i;
      var xs = [], baseY = [], tgtY = [];
      for (i = 0; i <= 160; i++) { var z = -3.4 + 6.8 * i / 160; xs.push(z); }
      function px(x) { return PAD + (x + 3.6) / 7.2 * (W - 2 * PAD); }
      var maxP = 0;
      var pts = [];
      for (i = 0; i < xs.length; i++) {
        var z = xs[i], x = fwd(z, a);
        var pz = base(z), jac = Math.abs(dfwd(z, a));
        var pxden = pz / jac;
        pts.push({ z: z, x: x, pz: pz, px: pxden });
        if (pz > maxP) maxP = pz; if (pxden > maxP) maxP = pxden;
      }
      function py(p) { return H - PAD - p / maxP * (H - 2 * PAD); }
      var bd = '', td = '';
      for (i = 0; i < pts.length; i++) { bd += (i ? 'L' : 'M') + px(pts[i].z).toFixed(1) + ' ' + py(pts[i].pz).toFixed(1) + ' '; td += (i ? 'L' : 'M') + px(pts[i].x).toFixed(1) + ' ' + py(pts[i].px).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: bd, fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('path', { d: td, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.2' }));
      svg.appendChild(svgEl('text', { x: PAD, y: PAD - 6, fill: 'var(--ink-mute,#777)', 'font-size': '11', 'font-family': 'monospace' }, [tx('grey = base Gaussian p(z)   ·   blue = pushed-forward density p(x)')]));
      var logdetAt0 = Math.log(Math.abs(dfwd(0, a)));
      num.innerHTML = logdetAt0.toFixed(3) + ' <small>log|det J| at z=0</small>';
      meta.textContent = 'flow strength a = ' + a.toFixed(2) + '  ·  ' + (a < 0.3 ? 'near identity: target stays close to the base' : a > 1.8 ? 'strong warp: density piles up where the map compresses' : 'moderate warp into a multi-modal shape');
      formula.textContent = 'x = z + a·tanh(z)  invertible  ·  p(x) = p(z) / |dx/dz|  ·  log p(x) = log p(z) − log|det J|';
    };
    var grid = el('div', {}, [slider(state, 'a', 'flow strength a', 0, 2.5, 0.05)]);
    host.appendChild(shell('NORMALIZING FLOW', 'drag the flow parameter',
      grid, [svg, num, meta, formula],
      'A normalizing flow maps a simple base density (grey Gaussian) through an invertible function to a complex target (blue). Because the map is invertible, the change-of-variables formula gives the exact density: divide by the absolute Jacobian determinant, or in logs, subtract log|det J|. Where the map stretches space the density thins; where it compresses, the density piles up — and because everything is exact, the flow can be trained by maximum likelihood.'));
    state._render();
  }

  // ── score-matching: score vector field and Langevin sampling steps ─────────
  function scoreMatching(host) {
    var state = { steps: 18, step: 0.06 };
    var W = 520, H = 240, PAD = 24;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var MODES = [{ x: -1.1, y: 0.4 }, { x: 1.2, y: -0.5 }];
    function dens(x, y) { var s = 0, m; for (m = 0; m < MODES.length; m++) { var dx = x - MODES[m].x, dy = y - MODES[m].y; s += Math.exp(-2 * (dx * dx + dy * dy)); } return s + 1e-6; }
    function score(x, y) {
      var sx = 0, sy = 0, w = 0, m;
      for (m = 0; m < MODES.length; m++) { var dx = x - MODES[m].x, dy = y - MODES[m].y; var g = Math.exp(-2 * (dx * dx + dy * dy)); w += g; sx += g * (-4 * dx); sy += g * (-4 * dy); }
      return { x: sx / w, y: sy / w };
    }
    function gx(x) { return PAD + (x + 2.4) / 4.8 * (W - 2 * PAD); }
    function gy(y) { return H - PAD - (y + 2.0) / 4.0 * (H - 2 * PAD); }

    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var ix, iy;
      for (ix = -2; ix <= 2; ix += 0.5) for (iy = -1.6; iy <= 1.6; iy += 0.5) {
        var s = score(ix, iy);
        var mag = Math.sqrt(s.x * s.x + s.y * s.y) + 1e-6;
        var ux = s.x / mag, uy = s.y / mag, L = 11;
        var x1 = gx(ix), y1 = gy(iy), x2 = gx(ix) + ux * L, y2 = gy(iy) - uy * L;
        svg.appendChild(svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', opacity: '0.7' }));
        svg.appendChild(svgEl('circle', { cx: x2, cy: y2, r: '1.6', fill: 'var(--ink-mute,#999)' }));
      }
      var m;
      for (m = 0; m < MODES.length; m++) { svg.appendChild(svgEl('circle', { cx: gx(MODES[m].x), cy: gy(MODES[m].y), r: '6', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '2' })); }
      var px = -2.0, py = 1.4, path = '', i;
      for (i = 0; i <= state.steps; i++) {
        path += (i ? 'L' : 'M') + gx(px).toFixed(1) + ' ' + gy(py).toFixed(1) + ' ';
        var sc = score(px, py);
        px = px + state.step * sc.x;
        py = py + state.step * sc.y;
      }
      svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', 'stroke-dasharray': '4 3' }));
      svg.appendChild(svgEl('circle', { cx: gx(px), cy: gy(py), r: '5', fill: 'var(--warn,#b8870f)' }));
      var finalDens = dens(px, py);
      num.innerHTML = finalDens.toFixed(3) + ' <small>density at the sample</small>';
      meta.textContent = state.steps + ' Langevin steps  ·  the sample climbs the grey arrows into a high-density mode';
      formula.textContent = 'score s(x) = ∇ₓ log p(x)  ·  Langevin: x ← x + ε·s(x) (+ noise)  ·  arrows point toward where data is dense';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'steps', 'Langevin steps', 0, 40, 1),
      slider(state, 'step', 'step size ε', 0.01, 0.2, 0.01)
    ]);
    host.appendChild(shell('SCORE MATCHING', 'drag the steps',
      grid, [svg, num, meta, formula],
      'A score-based model learns the score — the gradient of the log-density — shown here as the grey vector field pointing toward where data is dense. Generation needs no explicit density: start from noise and repeatedly step along the score (Langevin dynamics, with a little added noise each step). The orange sample follows the arrows out of the empty regions and settles into a high-density mode, which is exactly how diffusion models draw samples.'));
    state._render();
  }

  LF.register({
    'data-augmentation': dataAugmentation,
    'transfer-learning': transferLearning,
    'batchnorm-inference': batchnormInference,
    'ctc-collapse': ctcCollapse,
    'mfcc-pipeline': mfccPipeline,
    'autoencoder-bottleneck': autoencoderBottleneck,
    'normalizing-flow': normalizingFlow,
    'score-matching': scoreMatching
  });
})();
