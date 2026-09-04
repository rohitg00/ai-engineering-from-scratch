/* figures-capstone-b.js - animated lesson figures for Phase 19 capstone
   projects (training safety, hybrid retrieval, reranking, end-to-end RAG,
   eval harness, code-exec sandbox, injection detection, safety gate).
   Loads after lesson-figures.js, registers through window.LF. SMIL/CSS motion
   only - no JS loops, no rAF. ES5, no deps, theme via CSS vars. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var svgEl = LF.svgEl, el = LF.el;

  function svg(h) { return svgEl('svg', { viewBox: '0 0 520 ' + h }); }
  function shell(host, label, sub, node, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [node])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '11', fill: fill || 'var(--ink,#1a1a1a)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function rect(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: fill || 'var(--bg-surface,#eee)', stroke: stroke || 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' });
  }

  // ── grad-clip-monitor (45): gradient norm spikes, clip ceiling, scaler skip ─
  function gradClip(host) {
    var s = svg(240), W = 520, BASE = 150, CEIL = 70, PAD = 30;
    s.appendChild(svgEl('line', { x1: PAD, y1: CEIL, x2: W - PAD, y2: CEIL, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' }));
    s.appendChild(txt(W - PAD, CEIL - 6, 'clip ceiling = 1.0', '9', 'var(--warn,#b8870f)', 'end'));
    s.appendChild(svgEl('line', { x1: PAD, y1: BASE, x2: W - PAD, y2: BASE, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    var heights = [110, 96, 82, 108, 30, 100, 90, 112], n = heights.length, bw = 30, gap = (W - 2 * PAD - n * bw) / (n - 1);
    var i, spike = 4;
    for (i = 0; i < n; i++) {
      var x = PAD + i * (bw + gap), raw = heights[i], clipped = Math.min(raw, BASE - CEIL);
      var bar = rect(x, BASE - clipped, bw, clipped, i === spike ? 'var(--warn,#b8870f)' : 'var(--blueprint,#3553ff)', 'none');
      bar.appendChild(anim('height', clipped + ';' + clipped, '0.1s'));
      var grow = svgEl('animate', { attributeName: 'height', values: '0;' + (i === spike ? raw : clipped) + ';' + clipped, keyTimes: '0;0.55;1', dur: '2.6s', begin: (i * 0.14) + 's', repeatCount: 'indefinite' });
      var gy = svgEl('animate', { attributeName: 'y', values: BASE + ';' + (i === spike ? BASE - raw : BASE - clipped) + ';' + (BASE - clipped), keyTimes: '0;0.55;1', dur: '2.6s', begin: (i * 0.14) + 's', repeatCount: 'indefinite' });
      bar.appendChild(grow); bar.appendChild(gy);
      s.appendChild(bar);
    }
    var ghost = rect(PAD + spike * (bw + gap), CEIL - 40, bw, 40, 'none', 'var(--warn,#b8870f)');
    ghost.setAttribute('stroke-dasharray', '3 3');
    ghost.appendChild(anim('opacity', '0;0.9;0', '2.6s', { begin: (spike * 0.14) + 's' }));
    s.appendChild(ghost);
    var skip = txt(PAD + spike * (bw + gap) + bw / 2, CEIL - 48, 'NaN → skip step', '9', 'var(--warn,#b8870f)');
    skip.appendChild(anim('opacity', '0;1;0', '2.6s', { begin: (spike * 0.14) + 's' }));
    s.appendChild(skip);
    s.appendChild(txt(PAD, BASE + 18, 'step →', '9', 'var(--ink-mute,#777)', 'start'));
    shell(host, 'GRADIENT CLIP + AMP', 'norm spikes, ceiling holds', s,
      'Every step the global gradient norm is measured and clipped to the ceiling. A single overflow batch (orange) would spike past it and turn the loss to NaN; the GradScaler detects the Inf, skips the optimizer step, and halves its scale so the run survives.');
  }

  // ── rrf-fusion (65): query splits into BM25 + dense lanes, ranks vote ──────
  function rrfFusion(host) {
    var s = svg(250), defs = svgEl('defs', {});
    var grad = svgEl('marker', { id: 'cb-arr', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto' }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 z', fill: 'var(--ink-soft,#555)' })]);
    defs.appendChild(grad); s.appendChild(defs);
    s.appendChild(rect(20, 105, 80, 40, 'var(--blueprint,#3553ff)', 'none'));
    s.appendChild(txt(60, 129, 'query', '12', 'var(--bg,#fafaf5)'));
    s.appendChild(rect(200, 40, 90, 40)); s.appendChild(txt(245, 64, 'BM25', '11'));
    s.appendChild(rect(200, 170, 90, 40)); s.appendChild(txt(245, 194, 'dense', '11'));
    s.appendChild(rect(400, 105, 100, 40, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(450, 124, 'RRF fuse', '11'));
    s.appendChild(txt(450, 138, '1/(k+rank)', '8', 'var(--ink-mute,#777)'));
    [[100, 122, 200, 60], [100, 128, 200, 188], [290, 60, 400, 120], [290, 188, 400, 130]].forEach(function (c) {
      s.appendChild(svgEl('line', { x1: c[0], y1: c[1], x2: c[2], y2: c[3], stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'marker-end': 'url(#cb-arr)' }));
    });
    function packet(path, begin, fill) {
      var d = svgEl('circle', { r: '5', fill: fill, cx: '0', cy: '0' });
      d.appendChild(svgEl('animateMotion', { path: path, dur: '2.8s', begin: begin, repeatCount: 'indefinite', keyPoints: '0;1', keyTimes: '0;1' }));
      d.appendChild(anim('opacity', '0;1;1;0', '2.8s', { begin: begin, keyTimes: '0;0.1;0.9;1' }));
      return d;
    }
    s.appendChild(packet('M100 122 L200 60', '0s', 'var(--blueprint,#3553ff)'));
    s.appendChild(packet('M100 128 L200 188', '0.3s', 'var(--blueprint,#3553ff)'));
    s.appendChild(packet('M290 60 L400 120', '1.2s', 'var(--warn,#b8870f)'));
    s.appendChild(packet('M290 188 L400 130', '1.5s', 'var(--warn,#b8870f)'));
    var win = txt(450, 168, 'fused top-k', '9', 'var(--blueprint,#3553ff)');
    win.appendChild(anim('opacity', '0.3;1;0.3', '2.8s', { begin: '2.4s' }));
    s.appendChild(win);
    shell(host, 'RECIPROCAL RANK FUSION', 'two lanes, one vote', s,
      'A query runs through BM25 and a dense retriever in parallel. Each returns a ranked list; RRF scores every document by 1/(k+rank) summed across lists, so a document ranked well by either lane rises. The fusion votes rather than interpolates, which is why it wins across query classes.');
  }

  // ── rerank-funnel (66): N candidates funnel through cross-encoder to top-K ─
  function rerankFunnel(host) {
    var s = svg(240), N = 8, x0 = 50, y0 = 30, rh = 22, gap = 4;
    s.appendChild(txt(80, 20, 'retrieved N', '9', 'var(--ink-mute,#777)'));
    s.appendChild(txt(440, 20, 'reranked top-K', '9', 'var(--ink-mute,#777)'));
    s.appendChild(rect(230, 70, 60, 90, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(260, 110, 'cross', '10')); s.appendChild(txt(260, 124, 'encoder', '10'));
    var keep = { 5: 1, 1: 1, 6: 1 }, i, kRank = 0;
    for (i = 0; i < N; i++) {
      var y = y0 + i * (rh + gap);
      s.appendChild(rect(x0, y, 110, rh, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)'));
      var dot = svgEl('circle', { cx: x0 + 12, cy: y + rh / 2, r: '4', fill: 'var(--ink-mute,#777)' });
      s.appendChild(dot);
      var kept = !!keep[i];
      var ty = kept ? (78 + kRank * 30) : (90 + (i % 3) * 4);
      var packet = svgEl('circle', { r: '4.5', fill: kept ? 'var(--blueprint,#3553ff)' : 'var(--ink-mute,#777)', cx: x0 + 12, cy: y + rh / 2 });
      var motion = svgEl('animateMotion', { path: 'M0 0 L' + (218 - x0) + ' ' + (115 - (y + rh / 2)), dur: '3.2s', begin: (i * 0.1) + 's', repeatCount: 'indefinite', keyTimes: '0;0.4;0.5;1', keyPoints: '0;1;1;1', calcMode: 'linear' });
      packet.appendChild(motion);
      if (kept) {
        var out = svgEl('circle', { r: '5', fill: 'var(--blueprint,#3553ff)', cx: 380, cy: ty });
        out.appendChild(anim('opacity', '0;0;1;1;0', '3.2s', { begin: (i * 0.1) + 's', keyTimes: '0;0.55;0.65;0.9;1' }));
        out.appendChild(anim('cx', '300;380', '3.2s', { begin: (i * 0.1) + 's', keyTimes: '0;1' }));
        s.appendChild(svgEl('g', {}, [out, txt(420, ty + 4, 'K' + (kRank + 1), '9', 'var(--blueprint,#3553ff)', 'start')]));
        kRank++;
      }
      packet.appendChild(anim('opacity', '1;1;0;0', '3.2s', { begin: (i * 0.1) + 's', keyTimes: '0;0.45;0.5;1' }));
      s.appendChild(packet);
    }
    shell(host, 'CROSS-ENCODER RERANK', 'N candidates → top-K', s,
      'A cheap retriever returns N candidates; the cross-encoder reads each (query, document) pair with full attention and scores it. Only the top-K survive (blue). The expensive model runs N times instead of corpus-many, so its precision lift lands inside the request latency budget.');
  }

  // ── rag-pipeline-flow (69): query packet travels the full pipeline ─────────
  function ragPipeline(host) {
    var s = svg(220), defs = svgEl('defs', {});
    defs.appendChild(svgEl('marker', { id: 'cb-rag', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '6', markerHeight: '6', orient: 'auto' }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 z', fill: 'var(--ink-soft,#555)' })]));
    s.appendChild(defs);
    var stages = ['rewrite', 'retrieve', 'rerank', 'generate'], i;
    var bw = 96, y = 70, x = [16, 142, 268, 394];
    for (i = 0; i < 4; i++) {
      var b = rect(x[i], y, bw, 44, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)');
      b.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '3.6s', { begin: (i * 0.7) + 's', keyTimes: '0;0.5;1' }));
      s.appendChild(b);
      s.appendChild(txt(x[i] + bw / 2, y + 27, stages[i], '11'));
      if (i < 3) s.appendChild(svgEl('line', { x1: x[i] + bw, y1: y + 22, x2: x[i + 1], y2: y + 22, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'marker-end': 'url(#cb-rag)' }));
    }
    s.appendChild(txt(64, 50, 'corpus + query', '9', 'var(--ink-mute,#777)'));
    var path = 'M0 0 L' + (x[3] + bw / 2 - 64) + ' 0';
    var pk = svgEl('circle', { r: '6', fill: 'var(--warn,#b8870f)', cx: '64', cy: '92' });
    pk.appendChild(svgEl('animateMotion', { path: path, dur: '3.6s', repeatCount: 'indefinite', keyTimes: '0;1', keyPoints: '0;1', calcMode: 'linear' }));
    s.appendChild(pk);
    var cite = txt(x[3] + bw / 2, 150, 'answer + [chunk:42] citation', '10', 'var(--blueprint,#3553ff)');
    cite.appendChild(anim('opacity', '0;0;1;1;0', '3.6s', { keyTimes: '0;0.78;0.85;0.95;1' }));
    s.appendChild(cite);
    var refuse = txt(x[3] + bw / 2, 168, 'or refuse on low confidence', '8', 'var(--ink-mute,#777)');
    refuse.appendChild(anim('opacity', '0;0;0.8;0', '3.6s', { keyTimes: '0;0.85;0.92;1' }));
    s.appendChild(refuse);
    shell(host, 'END-TO-END RAG', 'one query, four stages', s,
      'The packet carries one query through the assembled pipeline: rewrite expands it, the hybrid index retrieves, the cross-encoder reranks, the generator answers with a chunk-anchored citation or refuses when confidence is low. Six isolated components become one system that beats each stage measured alone.');
  }

  // ── sandbox-runner (72): code into subprocess, assertions light up, timeout ─
  function sandboxRunner(host) {
    var s = svg(230);
    s.appendChild(rect(20, 80, 90, 60, 'var(--blueprint,#3553ff)', 'none'));
    s.appendChild(txt(65, 105, 'candidate', '10', 'var(--bg,#fafaf5)'));
    s.appendChild(txt(65, 120, 'code', '10', 'var(--bg,#fafaf5)'));
    s.appendChild(svgEl('rect', { x: 180, y: 40, width: 160, height: 150, rx: '6', fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.5', 'stroke-dasharray': '6 4' }));
    s.appendChild(txt(260, 32, 'subprocess sandbox', '9', 'var(--ink-mute,#777)'));
    var pk = svgEl('circle', { r: '5', fill: 'var(--warn,#b8870f)', cx: '110', cy: '110' });
    pk.appendChild(svgEl('animateMotion', { path: 'M0 0 L70 0', dur: '3.4s', repeatCount: 'indefinite', keyTimes: '0;0.2;1', keyPoints: '0;1;1', calcMode: 'linear' }));
    pk.appendChild(anim('opacity', '1;1;0;0', '3.4s', { keyTimes: '0;0.2;0.25;1' }));
    s.appendChild(pk);
    var res = ['pass', 'pass', 'fail', 'pass'], i;
    for (i = 0; i < 4; i++) {
      var ay = 60 + i * 32, ok = res[i] === 'pass';
      var box = rect(200, ay, 120, 24, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)');
      box.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--bg-surface,#eee);' + (ok ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)'), '3.4s', { begin: (0.3 + i * 0.25) + 's', keyTimes: '0;0.3;1' }));
      s.appendChild(box);
      var tk = txt(208, ay + 16, 'assert ' + (i + 1), '9', 'var(--ink-soft,#555)', 'start');
      tk.appendChild(anim('fill', 'var(--ink-soft,#555);var(--bg,#fafaf5)', '3.4s', { begin: (0.3 + i * 0.25) + 's', keyTimes: '0;1' }));
      s.appendChild(tk);
      var mark = txt(312, ay + 16, ok ? '✓' : '✗', '12', ok ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)', 'end');
      mark.appendChild(anim('opacity', '0;0;1;1', '3.4s', { begin: (0.3 + i * 0.25) + 's', keyTimes: '0;0.3;0.45;1' }));
      mark.setAttribute('fill', 'var(--bg,#fafaf5)');
      s.appendChild(mark);
    }
    var clock = svgEl('circle', { cx: 400, cy: 80, r: '18', fill: 'none', stroke: 'var(--ink-mute,#777)', 'stroke-width': '1.5' });
    s.appendChild(clock);
    var hand = svgEl('line', { x1: 400, y1: 80, x2: 400, y2: 66, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.6' });
    hand.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 400 80', to: '360 400 80', dur: '2s', repeatCount: 'indefinite' }));
    s.appendChild(hand);
    s.appendChild(txt(400, 116, 'wall-clock', '8', 'var(--ink-mute,#777)'));
    s.appendChild(txt(400, 127, 'timeout', '8', 'var(--ink-mute,#777)'));
    var score = txt(400, 175, '3/4 pass', '12', 'var(--blueprint,#3553ff)');
    score.appendChild(anim('opacity', '0.3;1;0.3', '3.4s', { begin: '1.6s' }));
    s.appendChild(score);
    shell(host, 'CODE-EXEC SANDBOX', 'run, assert, time out', s,
      'Generated code is shipped on stdin to a fresh interpreter inside a subprocess with an import denylist and output cap. Each supplied assertion runs and lights pass (blue) or fail (orange); a wall-clock timeout kills runaway loops. The score is the fraction of assertions that pass, with crashes and timeouts as first-class fail modes.');
  }

  // ── eval-grid (75): task grid lights pass/fail across a worker pool ─────────
  function evalGrid(host) {
    var s = svg(240), cols = 8, rows = 4, cw = 38, ch = 30, gx0 = 130, gy0 = 30;
    s.appendChild(txt(60, 50, 'worker', '10', 'var(--ink-soft,#555)'));
    s.appendChild(txt(60, 64, 'pool', '10', 'var(--ink-soft,#555)'));
    var w, c;
    for (w = 0; w < rows; w++) {
      s.appendChild(rect(20, gy0 + w * (ch + 6) + 18, 80, 22, 'var(--blueprint,#3553ff)', 'none'));
      var wl = txt(60, gy0 + w * (ch + 6) + 33, 'w' + w, '9', 'var(--bg,#fafaf5)');
      s.appendChild(wl);
    }
    var seed = [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1];
    for (w = 0; w < rows; w++) {
      for (c = 0; c < cols; c++) {
        var idx = w * cols + c, ok = seed[idx], x = gx0 + c * cw, y = gy0 + w * (ch + 6) + 14, beg = (c * 0.18 + w * 0.06);
        var cell = rect(x, y, cw - 6, ch - 4, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)');
        cell.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--bg-surface,#eee);' + (ok ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)') + ';' + (ok ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)'), '4s', { begin: beg + 's', keyTimes: '0;0.2;0.35;1' }));
        s.appendChild(cell);
      }
    }
    s.appendChild(txt(gx0, gy0 - 8, 'tasks.jsonl →', '9', 'var(--ink-mute,#777)', 'start'));
    var bar = svgEl('line', { x1: gx0, y1: gy0 + 10, x2: gx0, y2: gy0 + rows * (ch + 6) + 4, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.6', opacity: '0.7' });
    bar.appendChild(anim('x1', gx0 + ';' + (gx0 + cols * cw), '4s', { keyTimes: '0;1' }));
    bar.appendChild(anim('x2', gx0 + ';' + (gx0 + cols * cw), '4s', { keyTimes: '0;1' }));
    s.appendChild(bar);
    var sc = txt(260, 218, 'score = mean(pass) · per-model EvalRun → leaderboard', '9', 'var(--blueprint,#3553ff)');
    s.appendChild(sc);
    shell(host, 'EVAL RUNNER', 'tasks fan out, scores light up', s,
      'The runner reads the task spec, fans the tasks across a worker pool, and scores each with the metric layer plus the calibration report. Cells light pass (blue) or fail (orange) as the sweep crosses them. Per-model EvalRun records flow straight into the leaderboard aggregator; the demo self-terminates on a clean run.');
  }

  // ── injection-gate (83): prompts stream through three detector layers ──────
  function injectionGate(host) {
    var s = svg(230), defs = svgEl('defs', {});
    defs.appendChild(svgEl('marker', { id: 'cb-inj', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '6', markerHeight: '6', orient: 'auto' }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 z', fill: 'var(--ink-soft,#555)' })]));
    s.appendChild(defs);
    var layers = ['normalize', 'substring', 'regex'], x = [70, 200, 330], i;
    for (i = 0; i < 3; i++) {
      s.appendChild(rect(x[i], 80, 96, 50, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(x[i] + 48, 100, layers[i], '11'));
      s.appendChild(txt(x[i] + 48, 116, 'layer', '8', 'var(--ink-mute,#777)'));
      if (i < 2) s.appendChild(svgEl('line', { x1: x[i] + 96, y1: 105, x2: x[i + 1], y2: 105, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'marker-end': 'url(#cb-inj)' }));
    }
    s.appendChild(rect(440, 80, 60, 50, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(470, 100, 'verdict', '9'));
    s.appendChild(svgEl('line', { x1: 426, y1: 105, x2: 440, y2: 105, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'marker-end': 'url(#cb-inj)' }));
    // a malicious prompt fired at the regex layer, a benign one passes clean
    function flow(begin, fired, fill) {
      var pk = svgEl('circle', { r: '5', fill: fill, cx: '20', cy: '105' });
      pk.appendChild(svgEl('animateMotion', { path: 'M0 0 L450 0', dur: '3s', begin: begin, repeatCount: 'indefinite', keyTimes: '0;1', keyPoints: '0;1', calcMode: 'linear' }));
      pk.appendChild(anim('opacity', '0;1;1;0', '3s', { begin: begin, keyTimes: '0;0.05;0.92;1' }));
      return pk;
    }
    s.appendChild(flow('0s', false, 'var(--blueprint,#3553ff)'));
    s.appendChild(flow('1.5s', true, 'var(--warn,#b8870f)'));
    var fire = svgEl('circle', { cx: 378, cy: 105, r: '6', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' });
    fire.appendChild(anim('r', '6;20;6', '3s', { begin: '2.55s' }));
    fire.appendChild(anim('opacity', '0;0.9;0', '3s', { begin: '2.55s' }));
    s.appendChild(fire);
    var lab = txt(378, 60, 'rule fires → attack', '9', 'var(--warn,#b8870f)');
    lab.appendChild(anim('opacity', '0;1;0', '3s', { begin: '2.55s' }));
    s.appendChild(lab);
    s.appendChild(txt(470, 145, 'p, category', '8', 'var(--ink-mute,#777)'));
    shell(host, 'INJECTION DETECTOR', 'three layers, one verdict', s,
      'A prompt flows through three auditable layers: normalize decodes base64/rot13/zero-width tricks, substring rules catch hand-written phrases, regex rules catch families. A benign prompt (blue) passes clean; an attack (orange) trips a rule and the aggregator emits a confidence and category instead of a vibe.');
  }

  // ── safety-checkpoints (87): pre / during / post gates over the lifecycle ──
  function safetyCheckpoints(host) {
    var s = svg(250), defs = svgEl('defs', {});
    defs.appendChild(svgEl('marker', { id: 'cb-sg', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '6', markerHeight: '6', orient: 'auto' }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 z', fill: 'var(--ink-soft,#555)' })]));
    s.appendChild(defs);
    var gates = [['pre-gen', 'detector', 60], ['model', 'mock LLM', 200], ['during-gen', 'token filter', 340], ['post-gen', 'classifier', 470]];
    var i;
    for (i = 0; i < gates.length; i++) {
      var g = gates[i], cx = g[2], isModel = i === 1;
      s.appendChild(rect(cx - 46, 90, 92, 50, isModel ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', isModel ? 'none' : 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(cx, 110, g[0], '10', isModel ? 'var(--bg,#fafaf5)' : 'var(--ink,#1a1a1a)'));
      s.appendChild(txt(cx, 125, g[1], '8', isModel ? 'var(--bg,#fafaf5)' : 'var(--ink-mute,#777)'));
      if (i < gates.length - 1) s.appendChild(svgEl('line', { x1: cx + 46, y1: 115, x2: gates[i + 1][2] - 46, y2: 115, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.3', 'marker-end': 'url(#cb-sg)' }));
    }
    var pk = svgEl('circle', { r: '5', fill: 'var(--warn,#b8870f)', cx: '14', cy: '115' });
    pk.appendChild(svgEl('animateMotion', { path: 'M0 0 L502 0', dur: '4s', repeatCount: 'indefinite', keyTimes: '0;1', keyPoints: '0;1', calcMode: 'linear' }));
    s.appendChild(pk);
    // early-block branch dropping down from each checkpoint
    [60, 340, 470].forEach(function (cx, j) {
      var br = svgEl('line', { x1: cx, y1: 140, x2: cx, y2: 175, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.4', 'stroke-dasharray': '4 3', 'marker-end': 'url(#cb-sg)' });
      s.appendChild(br);
    });
    s.appendChild(txt(60, 192, 'block', '8', 'var(--warn,#b8870f)'));
    s.appendChild(txt(340, 192, 'terminate', '8', 'var(--warn,#b8870f)'));
    s.appendChild(txt(470, 192, 'final action', '8', 'var(--warn,#b8870f)'));
    var trace = svgEl('rect', { x: 90, y: 210, width: 340, height: 26, rx: '4', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', 'stroke-dasharray': '760', 'stroke-dashoffset': '760' });
    trace.appendChild(anim('stroke-dashoffset', '760;0', '4s', { keyTimes: '0;1' }));
    s.appendChild(trace);
    s.appendChild(txt(260, 227, 'per-request audit trace', '9', 'var(--blueprint,#3553ff)'));
    shell(host, 'SAFETY GATE', 'pre · during · post', s,
      'One request crosses three checkpoints. Pre-gen the detector can block outright; during-gen a token filter can terminate the stream early on a forbidden phrase; post-gen the classifier and rules engine inspect the full output. The gate aggregates the verdicts, applies a final action, and draws an audit trace every reviewer can read.');
  }

  LF.register({
    'grad-clip-monitor': gradClip,
    'rrf-fusion': rrfFusion,
    'rerank-funnel': rerankFunnel,
    'rag-pipeline-flow': ragPipeline,
    'sandbox-runner': sandboxRunner,
    'eval-grid': evalGrid,
    'injection-gate': injectionGate,
    'safety-checkpoints': safetyCheckpoints
  });
})();
