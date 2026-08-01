/* figures-capstone-h.js - animated lesson figures for Phase 19 capstone
   projects (paper writer, critic loop, iteration scheduler, research demo,
   vision patches, ViT encoder, projection alignment, cross-attention,
   vision-language pretraining, multimodal eval).
   Loads after lesson-figures.js, registers through window.LF. SMIL motion
   only - no JS loops, no rAF. ES5, no deps, theme via CSS vars. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var svgEl = LF.svgEl, el = LF.el;

  var EASE = '0.23 1 0.32 1';
  var SPL4 = '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1';

  function svg(h) { return svgEl('svg', { viewBox: '0 0 520 ' + h }); }
  function shell(host, label, sub, node, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [node])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '11', fill: fill || 'var(--ink,#1a1a1a)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function rect(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: fill || 'var(--bg-surface,#eee)', stroke: stroke || 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' });
  }
  // fade+grow entry from opacity 0 and 95% size; a..b is the entry phase
  // window, exit runs 0.94..1 which is faster than any entry window here.
  function entry(cx, cy, dur, begin, a, b) {
    a = a || 0.02; b = b || 0.12;
    var kt = '0;' + a + ';' + b + ';0.94;1';
    var g = svgEl('g', { transform: 'translate(' + cx + ' ' + cy + ')', opacity: '0' });
    g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;0.95;1;1;0.97', keyTimes: kt, calcMode: 'spline', keySplines: SPL4, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' }));
    g.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: kt, calcMode: 'spline', keySplines: SPL4, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' }));
    return g;
  }

  // ── ch-paper-skeleton (54): slots declared as data, prose ink arrives later ──
  function chPaper(host) {
    var s = svg(250), px = 40, py = 24, pw = 170;
    s.appendChild(svgEl('rect', { x: px, y: py, width: pw, height: 208, rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4' }));
    var slots = [
      [py + 12, 22, 'abstract'],
      [py + 42, 26, 'sec: intro'],
      [py + 76, 26, 'sec: method'],
      [py + 110, 38, 'fig slot: results.png'],
      [py + 156, 24, 'bib: 3 keys']
    ];
    var i;
    for (i = 0; i < slots.length; i++) {
      var sy = slots[i][0], sh = slots[i][1];
      s.appendChild(svgEl('rect', { x: px + 10, y: sy, width: pw - 20, height: sh, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      s.appendChild(txt(px + 16, sy + 12, slots[i][2], '8', 'var(--ink-mute,#777)', 'start'));
      var g = entry(px + pw / 2, sy + sh - 7, '5s', (1.6 + i * 0.25).toFixed(2) + 's');
      g.appendChild(svgEl('rect', { x: -(pw / 2 - 14), y: -3.5, width: pw - 28, height: 7, rx: '2', fill: 'var(--blueprint,#3553ff)', opacity: '0.55' }));
      s.appendChild(g);
    }
    var vx = 262;
    s.appendChild(txt(vx, 44, 'validate before prose:', '10', 'var(--ink-soft,#555)', 'start'));
    var checks = ['every figure has a slot', 'every cite has an entry', 'every section in TOC'];
    for (i = 0; i < checks.length; i++) {
      var cg = entry(vx + 110, 66 + i * 24, '5s', (0.2 + i * 0.2).toFixed(2) + 's');
      cg.appendChild(txt(-110, 3, 'ok', '9', 'var(--blueprint,#3553ff)', 'start'));
      cg.appendChild(txt(-86, 3, checks[i], '9', 'var(--ink,#1a1a1a)', 'start'));
      s.appendChild(cg);
    }
    s.appendChild(txt(vx, 168, 'then prose fills the slots,', '9', 'var(--ink-mute,#777)', 'start'));
    s.appendChild(txt(vx, 182, 'one section at a time', '9', 'var(--ink-mute,#777)', 'start'));
    shell(host, 'PAPER SKELETON', 'structure first, prose second', s,
      'The skeleton declares sections, figure slots, and bibliography keys as data before any prose exists. The harness validates that contract first: every referenced figure has a slot, every citation has an entry, every section lands in the table of contents. Only then does the generator write prose into each slot, so structural debt never accumulates.');
  }

  // ── ch-critic-converge (55): five score trajectories settle into the target band ─
  function chCritic(host) {
    var s = svg(250), Y0 = 200, X = [110, 210, 310, 410];
    s.appendChild(svgEl('line', { x1: 70, y1: 40, x2: 70, y2: Y0, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    s.appendChild(svgEl('line', { x1: 70, y1: Y0, x2: 452, y2: Y0, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    s.appendChild(svgEl('rect', { x: 70, y: 65, width: 382, height: 16, fill: 'var(--blueprint,#3553ff)', opacity: '0.08' }));
    s.appendChild(txt(448, 61, 'target 8+', '8', 'var(--blueprint,#3553ff)', 'end'));
    var i;
    for (i = 0; i < 4; i++) {
      s.appendChild(svgEl('line', { x1: X[i], y1: 48, x2: X[i], y2: Y0, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.6' }));
      s.appendChild(txt(X[i], Y0 + 16, 'round ' + (i + 1), '8', 'var(--ink-mute,#777)'));
    }
    var dims = [
      ['clarity', [4, 6, 8, 8.4]],
      ['novelty', [3, 5, 7, 8.2]],
      ['evidence', [5, 6.5, 7.8, 8.3]],
      ['methodology', [4.5, 7, 8.1, 8.3]],
      ['related-work', [2.5, 5, 7.4, 8.1]]
    ];
    for (i = 0; i < dims.length; i++) {
      var sc = dims[i][1], ys = [];
      for (var j = 0; j < 4; j++) { ys.push(Y0 - sc[j] * 15); }
      var dot = svgEl('circle', { cx: X[0], cy: ys[0], r: '4.5', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
      dot.appendChild(svgEl('animate', { attributeName: 'cx', values: X[0] + ';' + X[1] + ';' + X[2] + ';' + X[3] + ';' + X[3], keyTimes: '0;0.26;0.52;0.78;1', calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';0 0 1 1', dur: '5.2s', begin: (i * 0.1).toFixed(1) + 's', repeatCount: 'indefinite' }));
      dot.appendChild(svgEl('animate', { attributeName: 'cy', values: ys[0] + ';' + ys[1] + ';' + ys[2] + ';' + ys[3] + ';' + ys[3], keyTimes: '0;0.26;0.52;0.78;1', calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';0 0 1 1', dur: '5.2s', begin: (i * 0.1).toFixed(1) + 's', repeatCount: 'indefinite' }));
      dot.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.07;0.96;1', dur: '5.2s', begin: (i * 0.1).toFixed(1) + 's', repeatCount: 'indefinite' }));
      s.appendChild(dot);
      s.appendChild(txt(100, ys[0] + 3, dims[i][0], '8', 'var(--ink-mute,#777)', 'end'));
    }
    var badge = txt(260, 34, 'plateau detected: stop', '9', 'var(--warn,#b8870f)');
    badge.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: '0;0.78;0.84;0.96;1', dur: '5.2s', repeatCount: 'indefinite' }));
    s.appendChild(badge);
    shell(host, 'CRITIC LOOP', 'five dimensions converge or stop', s,
      'Each round the critic returns a five-dimension score vector, the revision applies as a structured diff, and the trajectories climb toward the target band. Convergence is engineered, not hoped for: the loop stops on plateau, on target met, or on budget exhausted, and a dimension that regresses is caught because the score is a vector, not a paragraph.');
  }

  // ── ch-ucb-scheduler (56): hypothesis queue feeds slots, results loop back, low UCB pruned ─
  function chScheduler(host) {
    var s = svg(250), qx = 36, qw = 110, sx = 220, sw = 100, ys = [58, 104, 150];
    s.appendChild(txt(qx, 44, 'hypothesis queue', '9', 'var(--ink-soft,#555)', 'start'));
    s.appendChild(txt(sx, 44, 'slots (parallel)', '9', 'var(--ink-soft,#555)', 'start'));
    var chips = [['h0', 'ucb 1.9'], ['h1', 'ucb 1.4'], ['h2', 'ucb 0.6']];
    var i;
    for (i = 0; i < 3; i++) {
      var cg = svgEl('g', {});
      cg.appendChild(rect(qx, ys[i], qw, 32, 'var(--bg-surface,#eee)', i === 2 ? 'var(--rule-soft,#ddd)' : 'var(--blueprint,#3553ff)'));
      cg.appendChild(txt(qx + 12, ys[i] + 20, chips[i][0], '10', 'var(--ink,#1a1a1a)', 'start'));
      cg.appendChild(txt(qx + qw - 10, ys[i] + 20, chips[i][1], '8', i === 2 ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)', 'end'));
      if (i === 2) {
        cg.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0.15;0.15', keyTimes: '0;0.55;0.61;1', calcMode: 'spline', keySplines: '0 0 1 1;0.4 0 1 1;0 0 1 1', dur: '4.8s', repeatCount: 'indefinite' }));
      }
      s.appendChild(cg);
      s.appendChild(rect(sx, ys[i], sw, 32, 'var(--bg,#fafaf5)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(sx + sw / 2, ys[i] + 20, 'slot ' + i, '9', 'var(--ink-mute,#777)'));
    }
    var pr = txt(qx + qw + 8, ys[2] + 20, 'pruned', '8', 'var(--warn,#b8870f)', 'start');
    pr.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1', keyTimes: '0;0.58;0.64;1', dur: '4.8s', repeatCount: 'indefinite' }));
    s.appendChild(pr);
    s.appendChild(svgEl('line', { x1: 392, y1: 58, x2: 392, y2: 182, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' }));
    s.appendChild(txt(392, 200, 'result bus', '9', 'var(--ink-soft,#555)'));
    var arc = 'M 392 58 C 392 16, 90 16, 90 54';
    s.appendChild(svgEl('path', { d: arc, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
    for (i = 0; i < 2; i++) {
      var d = svgEl('circle', { cx: qx + qw, cy: ys[i] + 16, r: '4', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
      d.appendChild(svgEl('animate', { attributeName: 'cx', values: (qx + qw) + ';' + (qx + qw) + ';' + sx + ';' + sx, keyTimes: '0;0.04;0.24;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4.8s', begin: (i * 0.3).toFixed(1) + 's', repeatCount: 'indefinite' }));
      d.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0;0', keyTimes: '0;0.06;0.24;0.3;1', dur: '4.8s', begin: (i * 0.3).toFixed(1) + 's', repeatCount: 'indefinite' }));
      s.appendChild(d);
    }
    var res = svgEl('circle', { r: '4', fill: 'var(--warn,#b8870f)', opacity: '0' });
    res.appendChild(svgEl('animateMotion', { path: 'M 320 74 L 392 74 L 392 58 C 392 16, 90 16, 90 54', keyPoints: '0;0;1;1', keyTimes: '0;0.4;0.8;1', calcMode: 'linear', dur: '4.8s', repeatCount: 'indefinite' }));
    res.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0;0', keyTimes: '0;0.4;0.46;0.78;0.82;1', dur: '4.8s', repeatCount: 'indefinite' }));
    s.appendChild(res);
    s.appendChild(txt(240, 232, 'result updates UCB, reorders the queue', '9', 'var(--ink-mute,#777)'));
    shell(host, 'UCB SCHEDULER', 'explore, exploit, prune', s,
      'The queue holds hypotheses scored by upper confidence bound. When a slot frees, the scheduler dispatches the highest-UCB branch; finished experiments fan onto the result bus and loop back to update the statistics, so a finding from one experiment reorders everything behind it. A branch whose bound collapses is pruned instead of burning a slot.');
  }

  // ── ch-research-pipeline (57): a baton crosses five stages through contract gates ─
  function chPipeline(host) {
    var s = svg(220), names = ['seed', 'scheduler', 'runner', 'critic', 'writer'];
    var i, bx = [20, 124, 228, 332, 436], cy = 108;
    for (i = 0; i < 5; i++) {
      s.appendChild(rect(bx[i], 86, 76, 44, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(bx[i] + 38, 112, names[i], '10', 'var(--ink,#1a1a1a)'));
    }
    s.appendChild(svgEl('line', { x1: 58, y1: cy, x2: 474, y2: cy, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.6' }));
    for (i = 0; i < 4; i++) {
      var gx = 110 + i * 104;
      var gate = svgEl('rect', { x: gx - 5, y: cy - 5, width: 10, height: 10, fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', transform: 'rotate(45 ' + gx + ' ' + cy + ')', opacity: '0.3' });
      var p = (0.14 + i * 0.22).toFixed(2), p2 = (0.18 + i * 0.22).toFixed(2);
      gate.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.3;0.3;1;1', keyTimes: '0;' + p + ';' + p2 + ';1', dur: '5.2s', repeatCount: 'indefinite' }));
      s.appendChild(gate);
    }
    s.appendChild(txt(110, 148, 'contract gates: broken input stops the run', '8', 'var(--ink-mute,#777)', 'start'));
    var baton = svgEl('circle', { cx: 58, cy: cy, r: '5', fill: 'var(--warn,#b8870f)', opacity: '0' });
    baton.appendChild(svgEl('animate', { attributeName: 'cx', values: '58;162;266;370;474;474', keyTimes: '0;0.22;0.44;0.66;0.88;1', calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';' + EASE + ';0 0 1 1', dur: '5.2s', repeatCount: 'indefinite' }));
    baton.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.04;0.95;1', dur: '5.2s', repeatCount: 'indefinite' }));
    s.appendChild(baton);
    var rep = entry(474, 52, '5.2s', '0s', 0.86, 0.92);
    rep.appendChild(svgEl('rect', { x: -34, y: -16, width: 68, height: 30, rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4' }));
    rep.appendChild(txt(0, 3, 'report', '9', 'var(--blueprint,#3553ff)'));
    s.appendChild(rep);
    s.appendChild(txt(20, 40, 'plain Python imports, no framework', '9', 'var(--ink-soft,#555)', 'start'));
    shell(host, 'RESEARCH DEMO', 'five contracts must compose', s,
      'The demo threads one run through every stage built in the earlier Track D lessons: seed hypotheses, the UCB scheduler, the experiment runner, the critic loop, the paper writer. Each hand-off passes a contract gate that validates the shape before the next stage runs, and the loop self-terminates into a single demo report. If any contract leaks, this is the lesson that catches it.');
  }

  // ── ch-patch-tokenizer (58): a pixel grid is cut into a strip of tokens ──────
  function chPatches(host) {
    var s = svg(250), gx = 40, gy = 54, c = 24, p = 26;
    s.appendChild(txt(gx, 40, '224x224 image, 16x16 patches', '9', 'var(--ink-soft,#555)', 'start'));
    var i, j;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        var hot = (i === 1 && j === 2);
        s.appendChild(svgEl('rect', { x: gx + j * p, y: gy + i * p, width: c, height: c, fill: hot ? 'var(--bg-surface,#eee)' : 'var(--bg,#fafaf5)', stroke: hot ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', 'stroke-width': hot ? '1.6' : '1' }));
      }
    }
    var fx = gx + 2 * p, fy = gy + p, tx = 250 + 2 * 24, ty = 186;
    var fly = svgEl('rect', { x: fx, y: fy, width: c, height: c, fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', opacity: '0' });
    fly.appendChild(svgEl('animate', { attributeName: 'x', values: fx + ';' + fx + ';' + tx + ';' + tx, keyTimes: '0;0.1;0.5;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4s', repeatCount: 'indefinite' }));
    fly.appendChild(svgEl('animate', { attributeName: 'y', values: fy + ';' + fy + ';' + (ty - 2) + ';' + (ty - 2), keyTimes: '0;0.1;0.5;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4s', repeatCount: 'indefinite' }));
    fly.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0;0', keyTimes: '0;0.1;0.52;0.58;1', dur: '4s', repeatCount: 'indefinite' }));
    s.appendChild(fly);
    s.appendChild(txt(232, 130, 'flatten (768) + one linear layer', '9', 'var(--ink-soft,#555)', 'start'));
    s.appendChild(txt(228, 178, '+CLS', '8', 'var(--ink-mute,#777)', 'end'));
    for (i = 0; i < 8; i++) {
      var sq = svgEl('rect', { x: 250 + i * 24, y: ty, width: 20, height: 20, fill: 'var(--bg-surface,#eee)', stroke: i === 2 ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', opacity: '0.3' });
      var q = (0.5 + i * 0.05).toFixed(2), q2 = (0.55 + i * 0.05).toFixed(2);
      sq.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.3;0.3;1;1', keyTimes: '0;' + q + ';' + q2 + ';1', dur: '4s', repeatCount: 'indefinite' }));
      s.appendChild(sq);
    }
    s.appendChild(txt(345, 168, '196 tokens of dim 768', '9', 'var(--ink,#1a1a1a)'));
    s.appendChild(svgEl('path', { d: 'M 250 226 q 12 -10 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2', opacity: '0.6' }));
    s.appendChild(txt(345, 244, '+ 2D sinusoidal position', '8', 'var(--ink-mute,#777)'));
    shell(host, 'PATCH EMBEDDING', 'a tokenizer for pixels', s,
      'Reading every pixel as a token gives a 150,528-token sequence no 12-layer transformer can afford. Cutting the image into 16x16 squares gives 196 patches; each is flattened to 768 values and projected through one linear layer into the hidden dimension, and a 2D sinusoidal signal restores where each square sat. The transformer sees a short sequence it can chew on.');
  }

  // ── ch-cls-funnel (59): patch pulses rise through the block stack into CLS ───
  function chVit(host) {
    var s = svg(260), cx = 260, cy = 62;
    var bands = [[160, 'block 1'], [124, '...'], [88, 'block 12']];
    var i;
    for (i = 0; i < 3; i++) {
      s.appendChild(svgEl('rect', { x: 110, y: bands[i][0], width: 300, height: 26, rx: '3', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', opacity: '0.55' }));
      s.appendChild(txt(420, bands[i][0] + 17, bands[i][1], '8', 'var(--ink-mute,#777)', 'start'));
    }
    var toks = [136, 180, 224, 268, 312, 356];
    for (i = 0; i < 6; i++) {
      s.appendChild(svgEl('rect', { x: toks[i], y: 212, width: 18, height: 18, rx: '2', fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }));
      s.appendChild(svgEl('line', { x1: toks[i] + 9, y1: 212, x2: cx, y2: cy + 12, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.6' }));
    }
    var send = [0, 2, 3, 5];
    for (i = 0; i < 4; i++) {
      var sx = toks[send[i]] + 9;
      var d = svgEl('circle', { cx: sx, cy: 212, r: '3.5', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
      d.appendChild(svgEl('animate', { attributeName: 'cx', values: sx + ';' + cx, keyTimes: '0;1', calcMode: 'spline', keySplines: EASE, dur: '3.4s', begin: (i * 0.15).toFixed(2) + 's', repeatCount: 'indefinite' }));
      d.appendChild(svgEl('animate', { attributeName: 'cy', values: '212;' + (cy + 14), keyTimes: '0;1', calcMode: 'spline', keySplines: EASE, dur: '3.4s', begin: (i * 0.15).toFixed(2) + 's', repeatCount: 'indefinite' }));
      d.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.12;0.9;1', dur: '3.4s', begin: (i * 0.15).toFixed(2) + 's', repeatCount: 'indefinite' }));
      s.appendChild(d);
    }
    s.appendChild(svgEl('circle', { cx: cx, cy: cy, r: '13', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' }));
    s.appendChild(txt(cx, cy + 3, 'CLS', '9', 'var(--blueprint,#3553ff)'));
    var ring = svgEl('circle', { cx: cx, cy: cy, r: '13', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' });
    ring.appendChild(svgEl('animate', { attributeName: 'r', values: '13;26', keyTimes: '0;1', calcMode: 'spline', keySplines: EASE, dur: '3.4s', begin: '0.7s', repeatCount: 'indefinite' }));
    ring.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.6;0', keyTimes: '0;1', dur: '3.4s', begin: '0.7s', repeatCount: 'indefinite' }));
    s.appendChild(ring);
    s.appendChild(txt(cx, 32, 'CLS pools the whole image', '9', 'var(--ink-soft,#555)'));
    s.appendChild(txt(cx, 250, '12 pre-LN blocks x 12 heads, GELU, 4x FFN', '9', 'var(--ink-mute,#777)'));
    shell(host, 'ViT ENCODER', 'attention builds awareness', s,
      'Patch tokens enter with no awareness of each other. Twelve pre-LN blocks of multi-head self-attention let every patch exchange information with every other, and the CLS token accumulates whole-image features layer by layer; its final hidden state is the pooled summary the rest of the stack reads. This block recipe is the spine of CLIP, SigLIP, and DINOv2.');
  }

  // ── ch-projection-bridge (60): an image vector crosses the MLP into text space ─
  function chProjection(host) {
    var s = svg(250);
    s.appendChild(svgEl('ellipse', { cx: 110, cy: 122, rx: 80, ry: 66, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
    s.appendChild(svgEl('ellipse', { cx: 410, cy: 122, rx: 80, ry: 66, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
    s.appendChild(txt(110, 40, 'vision space (768d)', '9', 'var(--ink-soft,#555)'));
    s.appendChild(txt(410, 40, 'text space (512d)', '9', 'var(--ink-soft,#555)'));
    s.appendChild(txt(110, 202, 'frozen', '8', 'var(--ink-mute,#777)'));
    s.appendChild(txt(410, 202, 'frozen', '8', 'var(--ink-mute,#777)'));
    var pts = [[78, 96], [132, 88], [120, 152], [388, 150], [442, 140], [396, 96]];
    var i;
    for (i = 0; i < 6; i++) {
      s.appendChild(svgEl('circle', { cx: pts[i][0], cy: pts[i][1], r: '3', fill: 'var(--ink-mute,#777)', opacity: '0.5' }));
    }
    s.appendChild(svgEl('circle', { cx: 86, cy: 128, r: '5', fill: 'var(--blueprint,#3553ff)' }));
    s.appendChild(txt(86, 146, 'image CLS', '8', 'var(--ink,#1a1a1a)'));
    s.appendChild(svgEl('circle', { cx: 434, cy: 102, r: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' }));
    s.appendChild(txt(434, 84, 'caption', '8', 'var(--ink,#1a1a1a)'));
    s.appendChild(rect(226, 92, 68, 60, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(260, 108, 'linear', '8', 'var(--ink,#1a1a1a)'));
    s.appendChild(txt(260, 122, 'GELU', '8', 'var(--ink,#1a1a1a)'));
    s.appendChild(txt(260, 136, 'linear', '8', 'var(--ink,#1a1a1a)'));
    s.appendChild(txt(260, 170, 'trains (1.3M params)', '8', 'var(--blueprint,#3553ff)'));
    var mv = svgEl('circle', { cx: 86, cy: 128, r: '5', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
    mv.appendChild(svgEl('animate', { attributeName: 'cx', values: '86;86;260;424;424', keyTimes: '0;0.08;0.42;0.72;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';' + EASE + ';0 0 1 1', dur: '4.6s', repeatCount: 'indefinite' }));
    mv.appendChild(svgEl('animate', { attributeName: 'cy', values: '128;128;122;106;106', keyTimes: '0;0.08;0.42;0.72;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';' + EASE + ';0 0 1 1', dur: '4.6s', repeatCount: 'indefinite' }));
    mv.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;1;0', keyTimes: '0;0.08;0.72;0.95;1', dur: '4.6s', repeatCount: 'indefinite' }));
    s.appendChild(mv);
    var hit = svgEl('circle', { cx: 434, cy: 102, r: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4' });
    hit.appendChild(svgEl('animate', { attributeName: 'r', values: '5;5;16', keyTimes: '0;0.72;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE, dur: '4.6s', repeatCount: 'indefinite' }));
    hit.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.5;0', keyTimes: '0;0.72;1', dur: '4.6s', repeatCount: 'indefinite' }));
    s.appendChild(hit);
    var cl = txt(410, 232, 'cosine loss pulls the pair together', '9', 'var(--warn,#b8870f)');
    cl.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: '0;0.72;0.8;0.95;1', dur: '4.6s', repeatCount: 'indefinite' }));
    s.appendChild(cl);
    shell(host, 'MODALITY PROJECTION', 'a bridge between two spaces', s,
      'The vision encoder and the text table live in unrelated bases. A two-layer MLP, about 1.3M parameters, carries the pooled image vector across into the text embedding space, and a cosine alignment loss against the paired caption pulls the projected point onto its partner. Encoder and text table stay frozen; the bridge is the only piece that learns.');
  }

  // ── ch-crossattn-fan (61): one text token fans queries across the image memory ─
  function chCross(host) {
    var s = svg(260), mts = [130, 176, 222, 268, 314, 360], my = 48;
    s.appendChild(txt(260, 34, 'image memory tokens (computed once per image)', '9', 'var(--ink-soft,#555)'));
    var i;
    for (i = 0; i < 6; i++) {
      s.appendChild(svgEl('rect', { x: mts[i], y: my, width: 26, height: 26, rx: '3', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }));
    }
    var words = ['a', 'cat', 'on', 'the', 'mat'], txs = [120, 176, 232, 288, 344], ty = 196;
    for (i = 0; i < 5; i++) {
      s.appendChild(rect(txs[i], ty, 44, 26, 'var(--bg,#fafaf5)', i === 2 ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(txs[i] + 22, ty + 17, words[i], '10', i === 2 ? 'var(--blueprint,#3553ff)' : 'var(--ink,#1a1a1a)'));
      if (i < 4) {
        s.appendChild(svgEl('line', { x1: txs[i] + 44, y1: ty + 13, x2: txs[i + 1], y2: ty + 13, stroke: 'var(--ink-mute,#777)', 'stroke-width': '1.2' }));
      }
    }
    s.appendChild(txt(260, 244, 'causal self-attention: left to right only', '9', 'var(--ink-mute,#777)'));
    var ax = txs[2] + 22;
    for (i = 0; i < 6; i++) {
      var fan = svgEl('line', { x1: ax, y1: ty, x2: mts[i] + 13, y2: my + 26, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2', opacity: '0' });
      var f0 = (0.08 + i * 0.06).toFixed(2), f1 = (0.16 + i * 0.06).toFixed(2);
      fan.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;0.75;0.75;0;0', keyTimes: '0;' + f0 + ';' + f1 + ';0.56;0.6;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1;0 0 1 1', dur: '3.8s', repeatCount: 'indefinite' }));
      s.appendChild(fan);
    }
    s.appendChild(txt(392, 130, 'queries: no mask', '8', 'var(--blueprint,#3553ff)', 'start'));
    var ans = svgEl('circle', { cx: mts[3] + 13, cy: my + 26, r: '4', fill: 'var(--warn,#b8870f)', opacity: '0' });
    ans.appendChild(svgEl('animate', { attributeName: 'cx', values: (mts[3] + 13) + ';' + (mts[3] + 13) + ';' + ax + ';' + ax, keyTimes: '0;0.62;0.84;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '3.8s', repeatCount: 'indefinite' }));
    ans.appendChild(svgEl('animate', { attributeName: 'cy', values: (my + 26) + ';' + (my + 26) + ';' + (ty - 4) + ';' + (ty - 4), keyTimes: '0;0.62;0.84;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '3.8s', repeatCount: 'indefinite' }));
    ans.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: '0;0.6;0.66;0.86;1', dur: '3.8s', repeatCount: 'indefinite' }));
    s.appendChild(ans);
    shell(host, 'CROSS-ATTENTION', 'text asks, the image answers', s,
      'In late fusion the decoder runs on text-only tokens and reaches into the image stream at every layer: the highlighted token sends a query to every memory token, unmasked, and the weighted answer flows back into its residual stream. Self-attention along the bottom row stays causal. The image side is encoded once and reused for every decode step, so long captions stay cheap.');
  }

  // ── ch-infonce-diagonal (62): matching pairs light the diagonal, both losses fall ─
  function chInfoNCE(host) {
    var s = svg(250), mx = 70, my = 60, pitch = 36;
    s.appendChild(txt(mx + 2 * pitch, 46, 'captions', '9', 'var(--ink-soft,#555)'));
    var lab = svgEl('text', { x: mx - 16, y: my + 2 * pitch, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '9', fill: 'var(--ink-soft,#555)', transform: 'rotate(-90 ' + (mx - 16) + ' ' + (my + 2 * pitch) + ')' });
    lab.appendChild(document.createTextNode('images'));
    s.appendChild(lab);
    var off = svgEl('g', {});
    var i, j;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        if (i !== j) {
          off.appendChild(svgEl('rect', { x: mx + j * pitch, y: my + i * pitch, width: 34, height: 34, rx: '2', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
        }
      }
    }
    off.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.9;0.9;0.3;0.3', keyTimes: '0;0.2;0.6;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4.4s', repeatCount: 'indefinite' }));
    s.appendChild(off);
    for (i = 0; i < 4; i++) {
      var g = entry(mx + i * pitch + 17, my + i * pitch + 17, '4.4s', (0.2 + i * 0.18).toFixed(2) + 's', 0.02, 0.14);
      g.appendChild(svgEl('rect', { x: -17, y: -17, width: 34, height: 34, rx: '2', fill: 'var(--blueprint,#3553ff)', opacity: '0.85' }));
      s.appendChild(g);
    }
    s.appendChild(txt(mx + 2 * pitch, my + 4 * pitch + 18, 'N positives, N*N - N negatives', '8', 'var(--ink-mute,#777)'));
    var x0 = 290, y1 = 190;
    s.appendChild(svgEl('line', { x1: x0, y1: 70, x2: x0, y2: y1, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    s.appendChild(svgEl('line', { x1: x0, y1: y1, x2: 470, y2: y1, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    var c1 = svgEl('path', { d: 'M 292 88 Q 340 150 468 166', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.8', 'stroke-dasharray': '260', 'stroke-dashoffset': '260' });
    c1.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: '260;0;0', keyTimes: '0;0.7;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1', dur: '4.4s', repeatCount: 'indefinite' }));
    s.appendChild(c1);
    var c2 = svgEl('path', { d: 'M 292 108 Q 350 158 468 178', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.8', 'stroke-dasharray': '260', 'stroke-dashoffset': '260' });
    c2.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: '260;260;0;0', keyTimes: '0;0.1;0.75;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4.4s', repeatCount: 'indefinite' }));
    s.appendChild(c2);
    s.appendChild(txt(322, 82, 'InfoNCE', '9', 'var(--blueprint,#3553ff)', 'start'));
    s.appendChild(txt(340, 116, 'LM loss', '9', 'var(--warn,#b8870f)', 'start'));
    s.appendChild(txt(380, 208, '50 demo steps, shared weights', '8', 'var(--ink-mute,#777)'));
    shell(host, 'DUAL-OBJECTIVE PRETRAINING', 'rank and generate in one pass', s,
      'For a batch of N image-caption pairs the similarity matrix has N matching cells on the diagonal and N squared minus N mismatches off it; InfoNCE runs cross-entropy over each row and column so the diagonal brightens while everything else dims. The LM loss trains the same weights to caption each image, and both curves fall together in the 50-step demo loop.');
  }

  // ── ch-recall-window (63): the matching image climbs into the R@K window ─────
  function chEval(host) {
    var s = svg(260), rx = 56, rw = 150;
    s.appendChild(txt(rx, 34, 'retrieval: rank every image', '9', 'var(--ink-soft,#555)', 'start'));
    var i;
    for (i = 0; i < 6; i++) {
      s.appendChild(rect(rx, 48 + i * 30, rw, 24, 'var(--bg,#fafaf5)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(rx - 10, 65 + i * 30, String(i + 1), '9', 'var(--ink-mute,#777)', 'end'));
    }
    s.appendChild(svgEl('rect', { x: rx - 4, y: 44, width: rw + 8, height: 152, rx: '4', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2', 'stroke-dasharray': '5 4', opacity: '0.5' }));
    s.appendChild(txt(rx + rw + 12, 56, 'R@5 window', '8', 'var(--blueprint,#3553ff)', 'start'));
    s.appendChild(txt(rx + rw + 12, 70, 'R@1: row 1 only', '8', 'var(--ink-mute,#777)', 'start'));
    var tg = svgEl('g', { transform: 'translate(' + rx + ' 198)' });
    tg.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: rx + ' 198;' + rx + ' 198;' + rx + ' 78;' + rx + ' 78', keyTimes: '0;0.16;0.52;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4.8s', repeatCount: 'indefinite' }));
    tg.appendChild(svgEl('rect', { x: 0, y: 0, width: rw, height: 24, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' }));
    tg.appendChild(txt(rw / 2, 16, 'matching image', '9', 'var(--blueprint,#3553ff)'));
    s.appendChild(tg);
    var hit = txt(rx + rw + 12, 92, 'R@1 miss, R@5 hit', '9', 'var(--warn,#b8870f)', 'start');
    hit.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: '0;0.52;0.6;0.95;1', dur: '4.8s', repeatCount: 'indefinite' }));
    s.appendChild(hit);
    s.appendChild(txt(330, 34, 'two more surfaces', '9', 'var(--ink-soft,#555)', 'start'));
    s.appendChild(rect(330, 48, 168, 44, 'var(--bg,#fafaf5)', 'var(--rule-soft,#ddd)'));
    s.appendChild(txt(340, 66, 'VQA exact match', '9', 'var(--ink,#1a1a1a)', 'start'));
    var em = entry(414, 80, '4.8s', '0s', 0.3, 0.4);
    em.appendChild(txt(-74, 3, 'pred == ref: 1 bit per sample', '8', 'var(--blueprint,#3553ff)', 'start'));
    s.appendChild(em);
    s.appendChild(rect(330, 112, 168, 44, 'var(--bg,#fafaf5)', 'var(--rule-soft,#ddd)'));
    s.appendChild(txt(340, 130, 'captioning BLEU-4', '9', 'var(--ink,#1a1a1a)', 'start'));
    s.appendChild(svgEl('rect', { x: 340, y: 138, width: 120, height: 8, rx: '2', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    var bar = svgEl('rect', { x: 340, y: 138, width: 0, height: 8, rx: '2', fill: 'var(--blueprint,#3553ff)' });
    bar.appendChild(svgEl('animate', { attributeName: 'width', values: '0;0;86;86', keyTimes: '0;0.35;0.65;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1', dur: '4.8s', repeatCount: 'indefinite' }));
    s.appendChild(bar);
    s.appendChild(txt(330, 186, '1-4 gram precisions,', '8', 'var(--ink-mute,#777)', 'start'));
    s.appendChild(txt(330, 200, 'geometric mean + brevity penalty', '8', 'var(--ink-mute,#777)', 'start'));
    s.appendChild(txt(rx, 240, 'training loss plateauing is not one of the three', '9', 'var(--ink-mute,#777)', 'start'));
    shell(host, 'MULTIMODAL EVAL', 'R@K, exact match, BLEU-4', s,
      'Three surfaces measure what training loss cannot. Retrieval ranks every image by cosine against a query caption and asks whether the match lands in the top 1, 5, or 10; here it climbs to rank 2, an R@1 miss but an R@5 hit. VQA scores one bit per sample on exact answer match, and captioning takes BLEU-4 over generated tokens with a brevity penalty.');
  }

  LF.register({
    'ch-paper-skeleton': chPaper,
    'ch-critic-converge': chCritic,
    'ch-ucb-scheduler': chScheduler,
    'ch-research-pipeline': chPipeline,
    'ch-patch-tokenizer': chPatches,
    'ch-cls-funnel': chVit,
    'ch-projection-bridge': chProjection,
    'ch-crossattn-fan': chCross,
    'ch-infonce-diagonal': chInfoNCE,
    'ch-recall-window': chEval
  });
})();
