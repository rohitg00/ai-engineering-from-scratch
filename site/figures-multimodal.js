/* figures-multimodal.js — interactive lesson figures for Phase 12 (multimodal
   AI). Loads after lesson-figures.js, uses the shared LF toolkit, registers via
   LF.register. No deps, ES5 only, theme via CSS vars. Authoring is the same
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

  function txt(x, y, s, anchor, color, size) {
    return svgEl('text', { x: String(x), y: String(y), 'text-anchor': anchor || 'middle', 'font-size': String(size || 10), 'font-family': 'monospace', fill: color || 'var(--ink-soft,#555)' }, [document.createTextNode(s)]);
  }

  // ── contrastive-matrix: CLIP InfoNCE similarity matrix, drag temperature ────
  function contrastiveMatrix(host) {
    var n = 5;
    var labels = ['dog', 'car', 'tree', 'boat', 'bird'];
    // Fixed cosine similarities in [-1,1]; diagonal high, off-diagonal lower.
    var sim = [
      [0.92, 0.18, 0.24, 0.10, 0.30],
      [0.15, 0.90, 0.12, 0.40, 0.08],
      [0.27, 0.10, 0.88, 0.14, 0.35],
      [0.12, 0.42, 0.16, 0.91, 0.06],
      [0.33, 0.09, 0.38, 0.07, 0.89]
    ];
    var state = { tau: 0.10 };
    var W = 520, H = 280, PAD = 70, CELL = (W - PAD - 20) / n;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var tau = Math.max(0.01, state.tau);
      var r, c, x, y, diag = 0;
      for (r = 0; r < n; r++) {
        // Softmax over the row of image r against all texts (InfoNCE numerator).
        var sc = [];
        for (c = 0; c < n; c++) { sc.push(sim[r][c] / tau); }
        var mx = Math.max.apply(null, sc);
        var ex = sc.map(function (s) { return Math.exp(s - mx); });
        var sum = ex.reduce(function (a, b) { return a + b; }, 0);
        var probs = ex.map(function (e) { return e / sum; });
        diag += probs[r];
        for (c = 0; c < n; c++) {
          x = PAD + c * CELL; y = 34 + r * CELL;
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (CELL - 2).toFixed(1), height: (CELL - 2).toFixed(1), fill: 'var(--blueprint,#3553ff)', 'fill-opacity': probs[c].toFixed(3), stroke: c === r ? 'var(--warn,#b8870f)' : 'var(--rule-soft,#ddd)', 'stroke-width': c === r ? '1.5' : '0.5' }));
        }
        svg.appendChild(txt((PAD - 8).toFixed(1), (y + CELL / 2 + 3).toFixed(1), 'img:' + labels[r], 'end', 'var(--ink-soft,#555)'));
      }
      for (c = 0; c < n; c++) {
        x = PAD + c * CELL;
        svg.appendChild(txt((x + CELL / 2).toFixed(1), '26', 'txt:' + labels[c], 'middle', 'var(--ink-mute,#777)'));
      }
      var acc = diag / n;
      meta.textContent = 'matched-pair mass ' + (acc * 100).toFixed(0) + '%  ·  diagonal outlined  ·  ' + (state.tau < 0.06 ? 'low τ: matrix sharpens to a clear diagonal' : state.tau > 0.25 ? 'high τ: rows flatten, pairs blur together' : 'balanced');
      formula.textContent = 'L = −log softmax(sim / τ)[matched],  τ = ' + tau.toFixed(2) + '   ·   each image-row and text-column softmaxes to the matched pair';
    };
    var grid = el('div', {}, [slider(state, 'tau', 'temperature τ', 0.02, 0.5, 0.01)]);
    shell(host, 'CONTRASTIVE MATRIX', 'drag τ', grid, [svg, meta, formula],
      'CLIP scores every image against every caption in the batch, forming a similarity matrix. The contrastive loss pulls the matched diagonal pairs together and pushes the off-diagonal apart. Dividing by a small temperature sharpens the softmax so the diagonal lights up; a large temperature flattens it and the model stops distinguishing pairs.');
    state._render();
  }

  // ── cross-attention-fusion: text queries attend to image patch keys ─────────
  function crossAttentionFusion(host) {
    var texts = ['a', 'red', 'bird', 'on', 'branch'];
    var patches = 8;
    var nt = texts.length;
    var state = { focus: 2, sharp: 1.4 };
    // Fixed affinity of each text token to each image patch (bird at patch 4-5).
    var aff = [
      [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
      [0.2, 0.3, 0.5, 0.7, 0.8, 0.6, 0.3, 0.2],
      [0.1, 0.2, 0.4, 0.8, 1.0, 0.9, 0.4, 0.2],
      [0.4, 0.4, 0.3, 0.3, 0.3, 0.4, 0.5, 0.5],
      [0.3, 0.2, 0.2, 0.3, 0.4, 0.6, 0.9, 1.0]
    ];
    var W = 520, H = 250, PAD = 64, CELL = (W - PAD - 20) / patches;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var s = Math.max(0.1, state.sharp), r, c, x, y, peak = 0, peakCol = 0;
      var rowH = (H - 50) / nt;
      for (r = 0; r < nt; r++) {
        var logits = [];
        for (c = 0; c < patches; c++) { logits.push(aff[r][c] * s); }
        var mx = Math.max.apply(null, logits);
        var ex = logits.map(function (z) { return Math.exp(z - mx); });
        var sum = ex.reduce(function (a, b) { return a + b; }, 0);
        var probs = ex.map(function (e) { return e / sum; });
        for (c = 0; c < patches; c++) {
          x = PAD + c * CELL; y = 30 + r * rowH;
          svg.appendChild(svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (CELL - 2).toFixed(1), height: (rowH - 3).toFixed(1), fill: 'var(--blueprint,#3553ff)', 'fill-opacity': probs[c].toFixed(3), stroke: r === state.focus && c === probs.indexOf(Math.max.apply(null, probs)) ? 'var(--warn,#b8870f)' : 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
        }
        if (r === state.focus) { peak = Math.max.apply(null, probs); peakCol = probs.indexOf(peak); }
        svg.appendChild(txt((PAD - 8).toFixed(1), (y + rowH / 2 + 3).toFixed(1), texts[r], 'end', r === state.focus ? 'var(--blueprint,#3553ff)' : 'var(--ink-soft,#555)'));
      }
      for (c = 0; c < patches; c++) {
        x = PAD + c * CELL;
        svg.appendChild(txt((x + CELL / 2).toFixed(1), '24', 'p' + c, 'middle', 'var(--ink-mute,#777)', 9));
      }
      meta.textContent = '"' + texts[state.focus] + '" puts ' + (peak * 100).toFixed(0) + '% of its attention on patch ' + peakCol + '  ·  rows = text queries, columns = image patches';
      formula.textContent = 'A = softmax(Q_text · Kᵀ_image),  rows sum to 1   ·   higher sharpness peaks each query onto its patch';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'focus', 'highlighted text token', 0, nt - 1, 1),
      slider(state, 'sharp', 'attention sharpness', 0.3, 4.0, 0.1)
    ]);
    shell(host, 'CROSS-ATTENTION FUSION', 'drag the query and sharpness', grid, [svg, meta, formula],
      'In a vision-language model, each text token is a query that attends across the image patch keys. The grid is one attention map: rows are text tokens, columns are image patches, and each row softmaxes to one. The content words like "bird" concentrate onto the patches that contain the object, which is how language grounds itself in pixels.');
    state._render();
  }

  // ── modality-projection: align image and text vectors in a shared space ─────
  function modalityProjection(host) {
    var state = { align: 0 };
    var W = 360, H = 260, CX = 70, CY = 150, R = 120;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var imgDeg0 = 78, txtDeg0 = 14; // misaligned to start
    function vec(deg, color, label) {
      var rad = deg * Math.PI / 180;
      var x2 = CX + R * Math.cos(rad), y2 = CY - R * Math.sin(rad);
      svg.appendChild(svgEl('line', { x1: CX, y1: CY, x2: x2.toFixed(1), y2: y2.toFixed(1), stroke: color, 'stroke-width': '2.5' }));
      svg.appendChild(txt((x2 + 6).toFixed(1), (y2 - 2).toFixed(1), label, 'start', color, 11));
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var t = clamp(state.align, 0, 1);
      // Both vectors converge toward a common 45-degree direction as t -> 1.
      var target = 46;
      var imgDeg = imgDeg0 + t * (target - imgDeg0);
      var txtDeg = txtDeg0 + t * (target - txtDeg0);
      svg.appendChild(svgEl('path', { d: 'M ' + CX + ' ' + CY + ' L ' + (CX + R) + ' ' + CY, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      vec(imgDeg, 'var(--blueprint,#3553ff)', 'image');
      vec(txtDeg, 'var(--warn,#b8870f)', 'text');
      var cos = Math.cos((imgDeg - txtDeg) * Math.PI / 180);
      num.innerHTML = cos.toFixed(3) + ' <small>cosine</small>';
      meta.textContent = 'angle between projections ' + Math.abs(imgDeg - txtDeg).toFixed(0) + '°  ·  ' + (cos > 0.97 ? 'aligned: the matched pair points the same way' : cos > 0.6 ? 'partly aligned' : 'misaligned: separate subspaces');
      formula.textContent = 'enc_img(x) → ℝ^d ← enc_txt(y),  train to maximize cos(z_img, z_txt) for matched pairs';
    };
    var grid = el('div', {}, [slider(state, 'align', 'projection training progress', 0, 1, 0.02)]);
    shell(host, 'MODALITY PROJECTION', 'drag to align the pair', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'A separate image encoder and text encoder land in their own spaces, so a matched pair starts pointing in different directions. A learned projection maps both into one shared d-dimensional space, and training rotates the matched vectors together until their cosine approaches one. Once aligned, a single distance compares across modalities.');
    state._render();
  }

  // ── cfg-guidance-scale: guided = uncond + w (cond - uncond) ─────────────────
  function cfgGuidanceScale(host) {
    var state = { w: 3.0 };
    var W = 520, H = 240, PAD = 40;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // 1D illustration: prediction is a point on a number line; vectors add.
    var uncond = 1.4, cond = 3.6; // base predictions (e.g. denoised estimate)
    var XMIN = 0, XMAX = 9;
    function px(v) { return PAD + (v - XMIN) / (XMAX - XMIN) * (W - 2 * PAD); }
    var axisY = 120;
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var w = state.w;
      var guided = uncond + w * (cond - uncond);
      var gClamp = clamp(guided, XMIN, XMAX);
      svg.appendChild(svgEl('line', { x1: PAD, y1: axisY, x2: W - PAD, y2: axisY, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      function tick(v, color, label, dy) {
        svg.appendChild(svgEl('circle', { cx: px(v).toFixed(1), cy: String(axisY), r: '5', fill: color }));
        svg.appendChild(txt(px(v).toFixed(1), String(axisY + dy), label, 'middle', color, 10));
      }
      // arrow from uncond toward cond direction, scaled by w
      svg.appendChild(svgEl('line', { x1: px(uncond).toFixed(1), y1: String(axisY - 26), x2: px(gClamp).toFixed(1), y2: String(axisY - 26), stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(txt(px((uncond + gClamp) / 2).toFixed(1), String(axisY - 34), 'w · (cond − uncond)', 'middle', 'var(--blueprint,#3553ff)', 10));
      tick(uncond, 'var(--ink-mute,#999)', 'uncond', 22);
      tick(cond, 'var(--warn,#b8870f)', 'cond', 38);
      tick(gClamp, 'var(--blueprint,#3553ff)', 'guided', 54);
      // diversity / sharpness bars
      var diversity = clamp(1 / (1 + 0.5 * w), 0, 1);
      var sharp = clamp(w / 12, 0, 1);
      svg.appendChild(txt(PAD.toFixed(1), '200', 'diversity', 'start', 'var(--ink-soft,#555)', 10));
      svg.appendChild(svgEl('rect', { x: String(PAD), y: '204', width: (diversity * 180).toFixed(1), height: '8', fill: 'var(--ink-mute,#999)' }));
      svg.appendChild(txt((W / 2 + 20).toFixed(1), '200', 'prompt adherence', 'start', 'var(--ink-soft,#555)', 10));
      svg.appendChild(svgEl('rect', { x: String(W / 2 + 20), y: '204', width: (sharp * 180).toFixed(1), height: '8', fill: 'var(--blueprint,#3553ff)' }));
      num.innerHTML = 'w = ' + w.toFixed(1);
      meta.textContent = w <= 1.05 ? 'w ≈ 1: prediction sits near unconditional, diverse but loosely on-prompt'
        : w >= 9 ? 'w very high: saturated, sharp but less diverse and prone to artifacts'
          : 'guided estimate pushed ' + ((guided - uncond)).toFixed(1) + ' past unconditional toward the prompt';
      formula.textContent = 'ε_guided = ε_uncond + w · (ε_cond − ε_uncond),  w = ' + w.toFixed(1) + '   ·   w=1 is plain conditional, larger w over-extrapolates';
    };
    var grid = el('div', {}, [slider(state, 'w', 'guidance scale w', 1.0, 12.0, 0.1)]);
    shell(host, 'CLASSIFIER-FREE GUIDANCE', 'drag w', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'Classifier-free guidance runs the diffusion model twice, once with the prompt and once without, then extrapolates along the difference. A scale of one is the plain conditional prediction; higher scales push further toward the prompt, trading diversity for adherence. Push too far and the sample saturates and breaks, so practical scales sit in a middle band.');
    state._render();
  }

  // ── vq-codebook: continuous encoder outputs snap to nearest code ────────────
  function vqCodebook(host) {
    var state = { logK: 4 };
    var W = 520, H = 240, PAD = 34;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // Fixed set of continuous encoder outputs in 2D; deterministic.
    var enc = [
      [0.12, 0.18], [0.22, 0.74], [0.55, 0.30], [0.78, 0.62],
      [0.40, 0.88], [0.66, 0.12], [0.88, 0.40], [0.32, 0.46],
      [0.50, 0.66], [0.14, 0.92], [0.92, 0.84], [0.70, 0.92]
    ];
    function px(x) { return PAD + x * (W - 2 * PAD); }
    function py(y) { return H - PAD - y * (H - 2 * PAD); }
    function codebook(K) {
      // Deterministic grid of codes covering the unit square.
      var side = Math.max(1, Math.round(Math.sqrt(K)));
      var pts = [], i, j;
      for (i = 0; i < side; i++) {
        for (j = 0; j < side; j++) {
          if (pts.length >= K) { break; }
          pts.push([(i + 0.5) / side, (j + 0.5) / side]);
        }
      }
      return pts;
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var K = Math.round(Math.pow(2, state.logK));
      var codes = codebook(K);
      var used = {}, totErr = 0;
      // draw codebook vectors
      codes.forEach(function (c) {
        svg.appendChild(svgEl('rect', { x: (px(c[0]) - 4).toFixed(1), y: (py(c[1]) - 4).toFixed(1), width: '8', height: '8', fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '1' }));
      });
      enc.forEach(function (e) {
        // nearest code (quantization)
        var best = 0, bd = 1e9, k;
        for (k = 0; k < codes.length; k++) {
          var dx = e[0] - codes[k][0], dy = e[1] - codes[k][1];
          var d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = k; }
        }
        used[best] = 1; totErr += Math.sqrt(bd);
        svg.appendChild(svgEl('line', { x1: px(e[0]).toFixed(1), y1: py(e[1]).toFixed(1), x2: px(codes[best][0]).toFixed(1), y2: py(codes[best][1]).toFixed(1), stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1' }));
        svg.appendChild(svgEl('circle', { cx: px(e[0]).toFixed(1), cy: py(e[1]).toFixed(1), r: '3.5', fill: 'var(--blueprint,#3553ff)' }));
        svg.appendChild(svgEl('rect', { x: (px(codes[best][0]) - 3).toFixed(1), y: (py(codes[best][1]) - 3).toFixed(1), width: '6', height: '6', fill: 'var(--warn,#b8870f)' }));
      });
      var usage = Object.keys(used).length;
      var avgErr = totErr / enc.length;
      num.innerHTML = K + ' <small>codes</small>';
      meta.textContent = usage + ' of ' + K + ' codes used by ' + enc.length + ' vectors  ·  avg quantization error ' + avgErr.toFixed(3) + '  ·  bits/token ' + Math.log2(K).toFixed(0);
      formula.textContent = 'z_q = argmin_k ‖z_e − e_k‖,  codebook size K = ' + K + '   ·   larger K → lower error but more codes to learn';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'logK', 'codebook size (2^x)', 2, 8, 1, function (v) { return String(Math.round(Math.pow(2, v))); })
    ]);
    shell(host, 'VQ CODEBOOK', 'drag the codebook size', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'A VQ-VAE encoder produces continuous vectors (blue dots), but the model needs discrete tokens. Each vector snaps to its nearest codebook entry (orange square), turning the image into a sequence of integer codes. A bigger codebook quantizes more finely, lowering reconstruction error, but spends more bits per token and risks codes that never get used.');
    state._render();
  }

  // ── video-temporal-patches: tokens = frames × (H/p)(W/p) ────────────────────
  function videoTemporalPatches(host) {
    var state = { frames: 8, patch: 16, tubelet: 2 };
    var GRID = 224; // assume 224x224 frames
    var W = 520, H = 230, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var p = state.patch, F = state.frames, tub = state.tubelet;
      var perSide = Math.floor(GRID / p);
      var spatial = perSide * perSide;
      var temporal = Math.max(1, Math.floor(F / tub));
      var tokens = spatial * temporal;
      // draw a single representative frame grid + stack indicator
      var face = 120, ox = 40, oy = 36, depth = 5;
      var stack = Math.min(temporal, 6);
      var s;
      for (s = stack - 1; s >= 0; s--) {
        var sx = ox + s * depth * 4, sy = oy + s * depth * 2;
        svg.appendChild(svgEl('rect', { x: sx.toFixed(1), y: sy.toFixed(1), width: String(face), height: String(face), fill: s === 0 ? 'var(--bg-surface,#eee)' : 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'fill-opacity': (1 - s * 0.12).toFixed(2) }));
      }
      // patch grid on the front frame
      var i, j;
      for (i = 0; i <= perSide; i++) {
        svg.appendChild(svgEl('line', { x1: (ox + i * face / perSide).toFixed(1), y1: String(oy), x2: (ox + i * face / perSide).toFixed(1), y2: String(oy + face), stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '0.6', 'stroke-opacity': '0.55' }));
        svg.appendChild(svgEl('line', { x1: String(ox), y1: (oy + i * face / perSide).toFixed(1), x2: String(ox + face), y2: (oy + i * face / perSide).toFixed(1), stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '0.6', 'stroke-opacity': '0.55' }));
      }
      svg.appendChild(txt((ox + face / 2).toFixed(1), String(oy + face + 18), perSide + ' × ' + perSide + ' patches/frame', 'middle', 'var(--ink-soft,#555)', 10));
      // readout on the right
      svg.appendChild(txt('300', '60', F + ' frames', 'start', 'var(--ink-soft,#555)', 11));
      svg.appendChild(txt('300', '82', '÷ ' + tub + ' (tubelet) = ' + temporal + ' temporal', 'start', 'var(--ink-mute,#777)', 10));
      svg.appendChild(txt('300', '108', spatial + ' spatial patches', 'start', 'var(--ink-soft,#555)', 11));
      svg.appendChild(txt('300', '134', temporal + ' × ' + spatial + ' =', 'start', 'var(--ink-mute,#777)', 11));
      svg.appendChild(txt('300', '160', fmtInt(tokens) + ' tokens', 'start', 'var(--blueprint,#3553ff)', 15));
      num.innerHTML = fmtInt(tokens) + ' <small>tokens</small>';
      meta.textContent = F + ' frames · ' + GRID + '² px · patch ' + p + ' · tubelet ' + tub + '  ·  ' + spatial + ' spatial × ' + temporal + ' temporal';
      formula.textContent = 'tokens = ⌊frames / tubelet⌋ · (H/p)·(W/p) = ' + temporal + ' · ' + spatial + ' = ' + fmtInt(tokens) + '   ·   token count drives the attention cost';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'frames', 'frames', 1, 64, 1),
      slider(state, 'patch', 'patch size (px)', 8, 56, 4),
      slider(state, 'tubelet', 'tubelet (frames/token)', 1, 8, 1)
    ]);
    shell(host, 'VIDEO TEMPORAL PATCHES', 'drag frames and patch size', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'Video tokenizes in space and time at once. Each 224-pixel frame splits into a grid of spatial patches, and frames group into tubelets along time. The total token count is the temporal count times the spatial count, and since attention cost grows with the square of tokens, long clips at fine patches explode the budget. Larger patches and tubelets are the main levers to keep it tractable.');
    state._render();
  }

  // ── audio-text-ctc: monotonic alignment, blanks collapse to shorter text ────
  function audioTextCtc(host) {
    var state = { frames: 12, dup: 1 };
    var target = ['C', 'A', 'T'];
    var W = 520, H = 240, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var T = state.frames, dup = state.dup;
      // Build a deterministic monotonic emission: distribute target letters
      // across frames with repeats (dup) and blanks filling the rest.
      var emit = [];
      var spoken = target.length * dup;
      // place letters in the centre region, blanks at the ends and between.
      var lead = Math.max(0, Math.floor((T - spoken) / 2));
      var f, idx = 0;
      for (f = 0; f < T; f++) {
        if (f >= lead && idx < spoken) {
          emit.push(target[Math.floor(idx / dup)]);
          idx++;
        } else {
          emit.push('_'); // blank
        }
      }
      // CTC collapse: remove repeats then remove blanks.
      var collapsed = [], prev = null, k;
      for (k = 0; k < emit.length; k++) {
        if (emit[k] !== prev) { if (emit[k] !== '_') { collapsed.push(emit[k]); } }
        prev = emit[k];
      }
      var cellW = (W - 2 * PAD) / T;
      // top row: audio frames with emitted symbol
      for (f = 0; f < T; f++) {
        var x = PAD + f * cellW;
        var isBlank = emit[f] === '_';
        svg.appendChild(svgEl('rect', { x: (x + 1).toFixed(1), y: '40', width: (cellW - 2).toFixed(1), height: '34', fill: isBlank ? 'var(--bg-surface,#eee)' : 'var(--blueprint,#3553ff)', 'fill-opacity': isBlank ? '0.5' : '0.8', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
        svg.appendChild(txt((x + cellW / 2).toFixed(1), '62', emit[f] === '_' ? '∅' : emit[f], 'middle', isBlank ? 'var(--ink-mute,#999)' : 'var(--bg,#fafaf5)', 12));
      }
      svg.appendChild(txt(PAD.toFixed(1), '32', T + ' audio frames (∅ = blank)', 'start', 'var(--ink-mute,#777)', 10));
      // alignment path arrows down to collapsed text
      var ty = 150, tStep = (W - 2 * PAD) / Math.max(1, target.length);
      for (k = 0; k < target.length; k++) {
        var tx = PAD + (k + 0.5) * tStep;
        svg.appendChild(svgEl('rect', { x: (tx - 16).toFixed(1), y: ty.toFixed(1), width: '32', height: '30', fill: 'var(--warn,#b8870f)', 'fill-opacity': '0.75', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.5' }));
        svg.appendChild(txt(tx.toFixed(1), (ty + 20).toFixed(1), target[k], 'middle', 'var(--bg,#fafaf5)', 13));
      }
      svg.appendChild(txt(PAD.toFixed(1), (ty - 8).toFixed(1), 'collapse repeats, drop blanks →', 'start', 'var(--ink-mute,#777)', 10));
      var ok = collapsed.join('') === target.join('');
      num.innerHTML = T + ' → ' + collapsed.length + ' <small>frames → chars</small>';
      meta.textContent = 'emitted "' + emit.join('') + '" collapses to "' + collapsed.join('') + '"  ·  ' + (ok ? 'matches target CAT' : 'does not yet spell CAT');
      formula.textContent = 'CTC: many alignments map to one label · collapse(a a _ b) = a b   ·   blanks separate repeats so "AA" survives';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'frames', 'audio frames', 4, 24, 1),
      slider(state, 'dup', 'frames per letter', 1, 4, 1)
    ]);
    shell(host, 'AUDIO-TEXT CTC', 'drag frames and duration', grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'Audio is a long frame sequence; the transcript is short. CTC lets the model emit a label or a blank at every frame, then collapses the output by merging repeats and dropping blanks. The alignment stays monotonic, time only moves forward, and the blank token is what keeps a genuine double letter from collapsing into one. Many frame-level alignments map onto the same final text.');
    state._render();
  }

  LF.register({
    'contrastive-matrix': contrastiveMatrix,
    'cross-attention-fusion': crossAttentionFusion,
    'modality-projection': modalityProjection,
    'cfg-guidance-scale': cfgGuidanceScale,
    'vq-codebook': vqCodebook,
    'video-temporal-patches': videoTemporalPatches,
    'audio-text-ctc': audioTextCtc
  });
})();
