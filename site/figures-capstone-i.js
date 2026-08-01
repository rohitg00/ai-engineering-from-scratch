/* figures-capstone-i.js: animated figures for Phase 19 capstone lessons
   64, 68, 70, 74, 76, 77, 80, 81, 84. SMIL only, no deps, theme via CSS vars. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }

  var el = LF.el, svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';
  var EASE = '0.23 1 0.32 1';

  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function animT(type, vals, dur, extra) {
    var a = { attributeName: 'transform', type: type, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animateTransform', a);
  }
  function card(host, label, hint, svg, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }
  function txt(x, y, s, fill, size, anchor) {
    return svgEl('text', {
      x: x, y: y, fill: fill || SOFT, 'font-size': size || 11,
      'font-family': 'var(--font-mono,monospace)', 'text-anchor': anchor || 'middle'
    }, [svgEl('tspan', {}, [document.createTextNode(s)])]);
  }
  // Entry: fade in from opacity 0 at ~95% size, ease out, hold for the loop.
  function popIn(g, cx, cy, dur, begin) {
    var b = begin || '0s', kt = '0;0.16;1', sp = EASE + ';0 0 1 1';
    g.setAttribute('opacity', '0');
    g.appendChild(animT('translate', (cx * 0.05).toFixed(1) + ' ' + (cy * 0.05).toFixed(1) + ';0 0;0 0', dur,
      { keyTimes: kt, calcMode: 'spline', keySplines: sp, begin: b, additive: 'sum' }));
    g.appendChild(animT('scale', '0.95;1;1', dur,
      { keyTimes: kt, calcMode: 'spline', keySplines: sp, begin: b, additive: 'sum' }));
    g.appendChild(anim('opacity', '0;1;1', dur, { keyTimes: kt, calcMode: 'spline', keySplines: sp, begin: b }));
  }

  // ── 64: same document, three cut plans; one slices the gold answer span ────
  function chunkBoundaries(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var x0 = 100, w = 380;
    svg.appendChild(txt(92, 50, 'document', MUTE, 10, 'end'));
    svg.appendChild(svgEl('rect', { x: x0, y: 34, width: w, height: 26, rx: 4, fill: BG, stroke: RULE, 'stroke-width': '1.5' }));
    svg.appendChild(svgEl('rect', { x: 255, y: 34, width: 80, height: 26, rx: 4, fill: BP, opacity: '0.16', stroke: BP, 'stroke-width': '1.4' }));
    svg.appendChild(txt(295, 26, 'gold answer span', BP, 9));
    var rows = [
      { y: 100, label: 'fixed 512', cuts: [195, 290, 385], bad: 290 },
      { y: 150, label: 'sentence', cuts: [178, 255, 335, 412], bad: -1 },
      { y: 200, label: 'markdown', cuts: [222, 358], bad: -1 }
    ];
    var i, j;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      svg.appendChild(txt(92, r.y + 15, r.label, SOFT, 10, 'end'));
      svg.appendChild(svgEl('rect', { x: x0, y: r.y, width: w, height: 22, rx: 3, fill: BG, stroke: RULE, 'stroke-width': '1' }));
      svg.appendChild(svgEl('rect', { x: 255, y: r.y, width: 80, height: 22, rx: 3, fill: BP, opacity: '0.08' }));
      var cg = svgEl('g', {});
      for (j = 0; j < r.cuts.length; j++) {
        var cx = r.cuts[j], bad = cx === r.bad;
        var ln = svgEl('line', { x1: cx, y1: r.y - 4, x2: cx, y2: r.y + 26, stroke: bad ? WARN : BP, 'stroke-width': bad ? '2.4' : '1.6' });
        if (bad) ln.appendChild(anim('opacity', '1;0.35;1', '2.6s'));
        cg.appendChild(ln);
      }
      popIn(cg, 260, r.y + 10, '5s', (0.3 + i * 0.35) + 's');
      svg.appendChild(cg);
    }
    svg.appendChild(txt(290, 244, 'fixed-window slices the span; markdown keeps it whole', MUTE, 9));
    card(host, 'CHUNK BOUNDARIES', 'same doc · three cut plans',
      svg,
      'Every strategy cuts the same document at different offsets. The fixed 512-token window slices straight through the gold answer span, so the two halves embed into different clusters and recall drops before the retriever even runs. Sentence and structural markdown splitters respect the boundaries the text already carries.');
  }

  // ── 68: sweep descends the ranked list, gold hits light the metric panel ───
  function ragMetricLadder(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var x0 = 70, y0 = 42, rh = 34, gold = { 0: 1, 3: 1 };
    var i;
    svg.appendChild(txt(x0, 28, 'retrieved top-5', MUTE, 10, 'start'));
    for (i = 0; i < 5; i++) {
      var y = y0 + i * rh, g = gold[i];
      svg.appendChild(txt(x0 - 14, y + 17, String(i + 1), MUTE, 10, 'end'));
      svg.appendChild(svgEl('rect', { x: x0, y: y, width: 170, height: 26, rx: 4, fill: g ? BP : BG, 'fill-opacity': g ? '0.14' : '1', stroke: g ? BP : RULE, 'stroke-width': g ? '1.8' : '1' }));
      svg.appendChild(txt(x0 + 85, y + 17, g ? 'gold doc' : 'doc', g ? BP : MUTE, 10));
    }
    var sweep = svgEl('rect', { x: x0 - 4, y: y0 - 4, width: 178, height: 34, rx: 5, fill: 'none', stroke: BP, 'stroke-width': '2.2', opacity: '0.9' });
    sweep.appendChild(animT('translate', '0 0;0 ' + rh + ';0 ' + (2 * rh) + ';0 ' + (3 * rh) + ';0 ' + (4 * rh) + ';0 0', '5s',
      { calcMode: 'discrete', keyTimes: '0;0.18;0.36;0.54;0.72;0.9' }));
    svg.appendChild(sweep);
    var metrics = [
      ['precision@5 = 2/5', 0.2], ['recall@5    = 2/3', 0.4],
      ['MRR         = 1.0', 0.6], ['nDCG@5      = 0.86', 0.8]
    ];
    svg.appendChild(txt(310, 28, 'metric panel', MUTE, 10, 'start'));
    for (i = 0; i < metrics.length; i++) {
      var m = txt(310, 58 + i * 26, metrics[i][0], i < 2 ? SOFT : BP, 11, 'start');
      m.appendChild(anim('opacity', '0;0;1;1', '5s',
        { keyTimes: '0;' + (metrics[i][1] - 0.06) + ';' + metrics[i][1] + ';1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1' }));
      svg.appendChild(m);
    }
    svg.appendChild(txt(310, 190, 'faithfulness + relevance', MUTE, 9, 'start'));
    svg.appendChild(txt(310, 204, 'grade the answer, not the rank', MUTE, 9, 'start'));
    card(host, 'RAG EVAL SWEEP', 'rank by rank · six metrics',
      svg,
      'The evaluator walks the ranked list once. Each gold document it passes updates precision and recall; the position of the first gold hit fixes MRR; the discounted positions fix nDCG. Faithfulness and answer relevance are computed afterwards on the generated answer, which is why a perfect retrieval score can still ship a wrong response.');
  }

  // ── 70: JSONL records stream through the validator gate; a bad line drops ──
  function taskSpecGate(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    svg.appendChild(txt(62, 66, 'tasks.jsonl', MUTE, 10));
    var i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(svgEl('rect', { x: 34, y: 78 + i * 14, width: 56, height: 9, rx: 2, fill: SURF, stroke: RULE, 'stroke-width': '1' }));
    }
    var gate = svgEl('rect', { x: 244, y: 56, width: 14, height: 88, rx: 4, fill: BP });
    gate.appendChild(anim('opacity', '0.7;1;0.7', '2.6s'));
    svg.appendChild(gate);
    svg.appendChild(txt(251, 44, 'validator', BP, 10));
    svg.appendChild(txt(251, 160, 'schema · metric vocab · types', MUTE, 8));
    svg.appendChild(svgEl('rect', { x: 396, y: 78, width: 92, height: 44, rx: 5, fill: BP, opacity: '0.12', stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(442, 104, 'runner', BP, 11));
    svg.appendChild(svgEl('path', { d: 'M300 176 H360', stroke: WARN, 'stroke-width': '1.4', fill: 'none' }));
    svg.appendChild(txt(330, 192, 'bad line aborts the record, not the run', WARN, 8.5));
    var passPath = 'M100 100 H396';
    for (i = 0; i < 2; i++) {
      var ok = svgEl('rect', { x: -9, y: -6, width: 18, height: 12, rx: 2, fill: BG, stroke: BP, 'stroke-width': '1.6' });
      ok.appendChild(svgEl('animateMotion', { dur: '4.8s', repeatCount: 'indefinite', path: passPath, begin: (i * -1.6) + 's', calcMode: 'spline', keySplines: '0.4 0 0.6 1', keyTimes: '0;1', keyPoints: '0;1' }));
      svg.appendChild(ok);
    }
    var badRec = svgEl('rect', { x: -9, y: -6, width: 18, height: 12, rx: 2, fill: BG, stroke: WARN, 'stroke-width': '1.8' });
    badRec.appendChild(svgEl('animateMotion', { dur: '4.8s', repeatCount: 'indefinite', path: 'M100 100 H240 L300 172', begin: '-3.2s', calcMode: 'spline', keySplines: '0.4 0 0.6 1;' + EASE, keyTimes: '0;0.6;1', keyPoints: '0;0.66;1' }));
    badRec.appendChild(anim('opacity', '1;1;0.15', '4.8s', { keyTimes: '0;0.8;1', begin: '-3.2s' }));
    svg.appendChild(badRec);
    card(host, 'TASK SPEC GATE', 'validate · dispatch · reject',
      svg,
      'Every line of tasks.jsonl is validated independently before it reaches the runner: required fields present, metric_name inside the closed vocabulary, targets typed correctly. A malformed record is diverted and logged; the run continues. Freezing this gate is what lets lessons 71 through 75 dispatch on a single field.');
  }

  // ── 74: mean bars grow, bootstrap whiskers pop in, two CIs overlap ─────────
  function leaderboardCI(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var x0 = 140, dur = '5s';
    svg.appendChild(svgEl('line', { x1: x0, y1: 36, x2: x0, y2: 186, stroke: RULE, 'stroke-width': '1.4' }));
    svg.appendChild(txt(480, 200, 'mean score, bootstrap 95% CI', MUTE, 9, 'end'));
    var models = [
      { y: 56, label: 'model A', w: 280, lo: -34, hi: 30 },
      { y: 104, label: 'model B', w: 258, lo: -30, hi: 36 },
      { y: 152, label: 'model C', w: 156, lo: -22, hi: 22 }
    ];
    var i;
    for (i = 0; i < models.length; i++) {
      var m = models[i], bx = x0 + m.w;
      svg.appendChild(txt(x0 - 10, m.y + 14, m.label, SOFT, 11, 'end'));
      var bar = svgEl('rect', { x: x0, y: m.y, width: (m.w * 0.4).toFixed(0), height: 20, rx: 3, fill: BP, opacity: i === 2 ? '0.35' : '0.75' });
      bar.appendChild(anim('width', (m.w * 0.4).toFixed(0) + ';' + m.w + ';' + m.w, dur,
        { keyTimes: '0;0.28;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1', begin: (i * 0.2) + 's' }));
      svg.appendChild(bar);
      var wg = svgEl('g', {});
      wg.appendChild(svgEl('line', { x1: bx + m.lo, y1: m.y + 10, x2: bx + m.hi, y2: m.y + 10, stroke: INK, 'stroke-width': '1.8' }));
      wg.appendChild(svgEl('line', { x1: bx + m.lo, y1: m.y + 3, x2: bx + m.lo, y2: m.y + 17, stroke: INK, 'stroke-width': '1.8' }));
      wg.appendChild(svgEl('line', { x1: bx + m.hi, y1: m.y + 3, x2: bx + m.hi, y2: m.y + 17, stroke: INK, 'stroke-width': '1.8' }));
      popIn(wg, bx, m.y + 10, dur, (1.5 + i * 0.25) + 's');
      svg.appendChild(wg);
    }
    var ovA = models[0], ovB = models[1];
    var oLo = x0 + ovB.w + ovB.lo, oHi = x0 + ovA.w + ovA.hi;
    var band = svgEl('g', {});
    band.appendChild(svgEl('rect', { x: oLo, y: 44, width: oHi - oLo, height: 90, fill: WARN, opacity: '0.12', stroke: WARN, 'stroke-width': '1', 'stroke-dasharray': '4 4' }));
    band.appendChild(txt((oLo + oHi) / 2, 38, 'CIs overlap: gap may be noise', WARN, 9));
    band.appendChild(anim('opacity', '0;0;1;1', dur, { keyTimes: '0;0.55;0.68;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1' }));
    svg.appendChild(band);
    card(host, 'LEADERBOARD + BOOTSTRAP CI', 'rank · then doubt the rank',
      svg,
      'The aggregator turns per-task EvalRun records into per-model means, then resamples tasks with replacement to put a bootstrap confidence interval on each mean. Model A leads model B on the point estimate, but the intervals overlap, so the pairwise difference CI is the number that decides whether the ranking is real or sampling noise.');
  }

  // ── 76: four ranks on a ring, chunks rotate; two passes alternate ──────────
  function ringAllreduce(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var cx = 170, cy = 128, r = 76;
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: RULE, 'stroke-width': '1.5', 'stroke-dasharray': '5 5' }));
    var pos = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
    var lbl = [[cx, cy - r - 12], [cx + r + 30, cy + 4], [cx, cy + r + 18], [cx - r - 30, cy + 4]];
    var i;
    for (i = 0; i < 4; i++) {
      svg.appendChild(svgEl('circle', { cx: pos[i][0], cy: pos[i][1], r: 13, fill: BG, stroke: BP, 'stroke-width': '2' }));
      svg.appendChild(txt(pos[i][0], pos[i][1] + 4, String(i), INK, 11));
      svg.appendChild(txt(lbl[i][0], lbl[i][1], 'rank ' + i, MUTE, 9));
    }
    var ringPath = 'M' + cx + ' ' + (cy - r) + ' A ' + r + ' ' + r + ' 0 1 1 ' + (cx - 0.01) + ' ' + (cy - r);
    for (i = 0; i < 4; i++) {
      var chunk = svgEl('rect', { x: -5, y: -5, width: 10, height: 10, rx: 2, fill: i === 0 ? WARN : BP, opacity: '0.9' });
      chunk.appendChild(svgEl('animateMotion', { dur: '4s', repeatCount: 'indefinite', path: ringPath, begin: (i * -1) + 's' }));
      svg.appendChild(chunk);
    }
    var p1 = txt(390, 84, 'pass 1 · reduce-scatter', BP, 11);
    p1.appendChild(anim('opacity', '1;1;0.2;0.2;1', '8s', { keyTimes: '0;0.42;0.5;0.92;1' }));
    svg.appendChild(p1);
    svg.appendChild(txt(390, 100, 'N-1 hops, sums build up', MUTE, 9));
    var p2 = txt(390, 132, 'pass 2 · allgather', BP, 11);
    p2.appendChild(anim('opacity', '0.2;0.2;1;1;0.2', '8s', { keyTimes: '0;0.42;0.5;0.92;1' }));
    svg.appendChild(p2);
    svg.appendChild(txt(390, 148, 'N-1 hops, sums fan out', MUTE, 9));
    svg.appendChild(txt(390, 190, '2T(N-1)/N bytes per rank', SOFT, 10));
    svg.appendChild(txt(390, 205, 'independent of cluster size', MUTE, 9));
    card(host, 'RING ALLREDUCE', 'reduce-scatter · allgather',
      svg,
      'Each rank owns one chunk of the tensor and only ever talks to its ring neighbour. In the reduce-scatter pass a chunk accumulates partial sums as it hops N-1 times; in the allgather pass the finished sums rotate back around. No root, no bottleneck: per-rank traffic stays at 2T(N-1)/N bytes no matter how many ranks join.');
  }

  // ── 77: backward sweeps right to left, buckets fill, allreduce overlaps ────
  function ddpGradSync(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var lw = 88, gap = 18, x0 = 60, y0 = 50, dur = '5s';
    var i;
    svg.appendChild(txt(x0, 34, 'backward pass', MUTE, 10, 'start'));
    svg.appendChild(txt(470, 34, 'grads flow this way', MUTE, 9, 'end'));
    for (i = 0; i < 4; i++) {
      var lx = x0 + i * (lw + gap);
      svg.appendChild(svgEl('rect', { x: lx, y: y0, width: lw, height: 34, rx: 4, fill: BG, stroke: RULE, 'stroke-width': '1.4' }));
      svg.appendChild(txt(lx + lw / 2, y0 + 22, 'layer ' + (i + 1), SOFT, 11));
    }
    var hl = svgEl('rect', { x: x0 + 3 * (lw + gap) - 3, y: y0 - 3, width: lw + 6, height: 40, rx: 5, fill: BP, opacity: '0.16', stroke: BP, 'stroke-width': '2' });
    hl.appendChild(animT('translate', '0 0;' + (-(lw + gap)) + ' 0;' + (-2 * (lw + gap)) + ' 0;' + (-3 * (lw + gap)) + ' 0;0 0', dur,
      { calcMode: 'discrete', keyTimes: '0;0.22;0.44;0.66;0.92' }));
    svg.appendChild(hl);
    var buckets = [
      { x: x0 + 2 * (lw + gap) + 30, label: 'bucket 1', fillKT: '0;0.05;0.4;1', fillV: '4;4;26;26' },
      { x: x0 + 30, label: 'bucket 0', fillKT: '0;0.45;0.85;1', fillV: '4;4;26;26' }
    ];
    for (i = 0; i < 2; i++) {
      var b = buckets[i];
      svg.appendChild(svgEl('rect', { x: b.x, y: 118, width: lw + gap, height: 30, rx: 3, fill: 'none', stroke: MUTE, 'stroke-width': '1.4' }));
      svg.appendChild(txt(b.x + (lw + gap) / 2, 164, b.label, MUTE, 9));
      var lvl = svgEl('rect', { x: b.x + 2, y: 144, width: lw + gap - 4, height: 4, fill: BP, opacity: '0.55' });
      lvl.appendChild(anim('height', b.fillV, dur, { keyTimes: b.fillKT }));
      lvl.appendChild(anim('y', '144;144;122;122', dur, { keyTimes: b.fillKT }));
      svg.appendChild(lvl);
    }
    svg.appendChild(svgEl('line', { x1: x0, y1: 200, x2: 470, y2: 200, stroke: RULE, 'stroke-width': '5' }));
    svg.appendChild(txt(x0, 222, 'allreduce wire, runs while backward continues', MUTE, 9, 'start'));
    var pulse = svgEl('circle', { r: 5, fill: WARN });
    pulse.appendChild(svgEl('animateMotion', { dur: dur, repeatCount: 'indefinite', path: 'M' + (buckets[0].x + 50) + ' 200 H' + x0, keyPoints: '0;0;1;1', keyTimes: '0;0.4;0.8;1', calcMode: 'linear' }));
    pulse.appendChild(anim('opacity', '0;0;1;1;0', dur, { keyTimes: '0;0.38;0.42;0.8;1' }));
    svg.appendChild(pulse);
    card(host, 'DDP GRADIENT SYNC', 'hook · bucket · overlap',
      svg,
      'A backward hook on every parameter drops its gradient into a bucket. The moment bucket 1 fills, its allreduce launches on the wire while layers 2 and 1 are still backpropagating, so communication hides behind compute. One broadcast at construction made all replicas identical; the summed gradients keep them identical every step.');
  }

  // ── 80: four ranks write tmp shards in parallel, then one atomic rename ────
  function shardedCheckpoint(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var dur = '6s', i;
    var gTmp = svgEl('g', {}), gFin = svgEl('g', {});
    for (i = 0; i < 4; i++) {
      var y = 34 + i * 42;
      svg.appendChild(svgEl('rect', { x: 40, y: y, width: 74, height: 28, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.6' }));
      svg.appendChild(txt(77, y + 18, 'rank ' + i, INK, 10));
      var dot = svgEl('circle', { cx: '120', cy: y + 14, r: 4, fill: BP });
      dot.appendChild(anim('cx', '120;240;240', dur, { keyTimes: '0;0.3;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1' }));
      svg.appendChild(dot);
      gTmp.appendChild(svgEl('rect', { x: 250, y: y, width: 128, height: 28, rx: 4, fill: 'none', stroke: WARN, 'stroke-width': '1.6', 'stroke-dasharray': '5 4' }));
      gTmp.appendChild(txt(314, y + 18, 'rank' + i + '.bin.tmp', WARN, 9.5));
      gFin.appendChild(svgEl('rect', { x: 250, y: y, width: 128, height: 28, rx: 4, fill: BP, opacity: '0.12', stroke: BP, 'stroke-width': '2' }));
      gFin.appendChild(txt(314, y + 18, 'rank' + i + '.bin', BP, 9.5));
    }
    gTmp.appendChild(anim('opacity', '1;1;0;0', dur, { keyTimes: '0;0.55;0.65;1' }));
    gFin.appendChild(anim('opacity', '0;0;1;1', dur, { keyTimes: '0;0.55;0.65;1' }));
    svg.appendChild(gTmp);
    svg.appendChild(gFin);
    var stamp = txt(314, 22, 'rename: all shards flip at once', SOFT, 9.5);
    stamp.appendChild(anim('opacity', '0;0;1;1', dur, { keyTimes: '0;0.55;0.62;1' }));
    svg.appendChild(stamp);
    var man = svgEl('g', {});
    man.appendChild(svgEl('rect', { x: 410, y: 84, width: 86, height: 62, rx: 5, fill: BG, stroke: INK, 'stroke-width': '1.6' }));
    man.appendChild(txt(453, 108, 'manifest', INK, 10));
    man.appendChild(txt(453, 126, 'world=4 · sha256', MUTE, 8.5));
    man.appendChild(anim('opacity', '0;0;1;1', dur, { keyTimes: '0;0.72;0.82;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1' }));
    svg.appendChild(man);
    card(host, 'SHARDED CHECKPOINT', 'parallel write · atomic rename',
      svg,
      'Every rank streams its own shard to a temp file at the same time, so write bandwidth scales with the cluster instead of one gather bottleneck. Only after all shards land does the rename flip the temp files and the manifest live. Resume reads the manifest first, checks world size and hashes, and fails loudly on any mismatch.');
  }

  // ── 81: three proven pieces slot into one loop; a run rides 20 steps ───────
  function distributedAssembly(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var dur = '5.5s', pieces = [
      ['DDP broadcast', 'lesson 77'], ['ZeRO-1 step', 'lesson 78'], ['sharded ckpt', 'lesson 80']
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var y = 36 + i * 52;
      var pg = svgEl('g', {});
      pg.appendChild(svgEl('rect', { x: 36, y: y, width: 130, height: 38, rx: 5, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
      pg.appendChild(txt(101, y + 17, pieces[i][0], INK, 10));
      pg.appendChild(txt(101, y + 31, pieces[i][1], MUTE, 8.5));
      popIn(pg, 101, y + 19, dur, (0.2 + i * 0.3) + 's');
      svg.appendChild(pg);
      svg.appendChild(svgEl('path', { d: 'M166 ' + (y + 19) + ' C 200 ' + (y + 19) + ', 200 106, 226 106', fill: 'none', stroke: MUTE, 'stroke-width': '1.2', opacity: '0.6' }));
    }
    svg.appendChild(svgEl('rect', { x: 226, y: 74, width: 258, height: 64, rx: 6, fill: BP, opacity: '0.1', stroke: BP, 'stroke-width': '2' }));
    svg.appendChild(txt(355, 100, 'for step in 1..20', BP, 12));
    svg.appendChild(txt(355, 118, '4 ranks · tiny GPT · gloo CPU', SOFT, 9));
    var tx0 = 240, tx1 = 470, ty = 182;
    svg.appendChild(svgEl('line', { x1: tx0, y1: ty, x2: tx1, y2: ty, stroke: RULE, 'stroke-width': '2' }));
    svg.appendChild(txt(tx0, ty + 16, 'step 0', MUTE, 8.5));
    svg.appendChild(txt(tx1, ty + 16, '20 · exit 0', MUTE, 8.5));
    var mid = (tx0 + tx1) / 2;
    svg.appendChild(svgEl('line', { x1: mid, y1: ty - 14, x2: mid, y2: ty + 6, stroke: WARN, 'stroke-width': '1.8' }));
    var flag = txt(mid, ty - 20, 'ckpt @ step 10', WARN, 8.5);
    flag.appendChild(anim('opacity', '0.4;0.4;1;1;0.4', dur, { keyTimes: '0;0.45;0.52;0.7;1' }));
    svg.appendChild(flag);
    var runner = svgEl('circle', { cy: ty, r: 6, fill: BP });
    runner.appendChild(anim('cx', tx0 + ';' + tx1 + ';' + tx1, dur, { keyTimes: '0;0.9;1', calcMode: 'spline', keySplines: '0.4 0 0.6 1;0 0 1 1' }));
    svg.appendChild(runner);
    svg.appendChild(txt(355, 222, 'invariants: loss falls · ranks agree · 12P/N optimiser bytes · resume byte-equal', MUTE, 8.5));
    card(host, 'DISTRIBUTED ASSEMBLY', 'compose · run 20 steps',
      svg,
      'Each piece was built and tested alone; the capstone proves they compose. DDP broadcast syncs the initial weights once, the ZeRO-1 step replaces optimiser.step every iteration, and the sharded checkpoint fires at step 10. The run self-terminates after 20 steps only if all four invariants hold on every rank.');
  }

  // ── 84: prompts fall into a 2x2 quadrant; the off-diagonal cells are bugs ──
  function refusalQuadrant(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var gx = 160, gy = 56, cw = 130, ch = 74, dur = '5s';
    svg.appendChild(txt(gx + cw / 2, 42, 'answered', SOFT, 10));
    svg.appendChild(txt(gx + cw + cw / 2, 42, 'refused', SOFT, 10));
    svg.appendChild(txt(gx - 12, gy + ch / 2 + 4, 'safe', SOFT, 10, 'end'));
    svg.appendChild(txt(gx - 12, gy + ch + ch / 2 + 4, 'unsafe', SOFT, 10, 'end'));
    var cells = [
      { x: gx, y: gy, ok: 1, label: 'correct' },
      { x: gx + cw, y: gy, ok: 0, label: 'over-refusal' },
      { x: gx, y: gy + ch, ok: 0, label: 'under-refusal' },
      { x: gx + cw, y: gy + ch, ok: 1, label: 'correct' }
    ];
    var i;
    for (i = 0; i < 4; i++) {
      var c = cells[i];
      var cr = svgEl('rect', { x: c.x, y: c.y, width: cw, height: ch, fill: c.ok ? BP : WARN, opacity: c.ok ? '0.08' : '0.14', stroke: c.ok ? BP : WARN, 'stroke-width': c.ok ? '1.2' : '2' });
      if (!c.ok) cr.appendChild(anim('opacity', '0.14;0.3;0.14', '3s', { begin: (i * 0.4) + 's' }));
      svg.appendChild(cr);
      svg.appendChild(txt(c.x + cw / 2, c.y + ch - 8, c.label, c.ok ? BP : WARN, 9));
    }
    svg.appendChild(txt(290, 20, 'labeled prompt set', MUTE, 10));
    var drops = [
      { tx: gx + 40, ty: gy + 32, safe: 1 }, { tx: gx + cw + 66, ty: gy + ch + 30, safe: 0 },
      { tx: gx + cw + 44, ty: gy + 30, safe: 1 }, { tx: gx + 62, ty: gy + ch + 34, safe: 0 }
    ];
    for (i = 0; i < 4; i++) {
      var d = drops[i];
      var dot = svgEl('circle', { cx: 290, cy: 26, r: 5, fill: d.safe ? BP : INK });
      dot.appendChild(anim('cx', '290;' + d.tx + ';' + d.tx, dur, { keyTimes: '0;0.22;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1', begin: (i * 0.45) + 's' }));
      dot.appendChild(anim('cy', '26;' + d.ty + ';' + d.ty, dur, { keyTimes: '0;0.22;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1', begin: (i * 0.45) + 's' }));
      dot.appendChild(anim('opacity', '0;1;1;0', dur, { keyTimes: '0;0.06;0.9;1', begin: (i * 0.45) + 's' }));
      svg.appendChild(dot);
    }
    svg.appendChild(txt(290, 232, 'plus ECE: does stated confidence match accuracy per bin', MUTE, 9));
    card(host, 'REFUSAL QUADRANT', 'two failure modes · not one',
      svg,
      'The evaluator treats the assistant as a binary classifier on prompt safety. Safe prompts that get refused land in the over-refusal cell; unsafe prompts that get answered land in the under-refusal cell. Both off-diagonal cells are bugs, measured separately per taxonomy category, with ECE tracking whether the model knows when it is right.');
  }


  LF.register({
    'ci-chunk-boundaries': chunkBoundaries,
    'ci-rag-metric-ladder': ragMetricLadder,
    'ci-task-spec-gate': taskSpecGate,
    'ci-leaderboard-ci': leaderboardCI,
    'ci-ring-allreduce': ringAllreduce,
    'ci-ddp-grad-sync': ddpGradSync,
    'ci-sharded-checkpoint': shardedCheckpoint,
    'ci-distributed-assembly': distributedAssembly,
    'ci-refusal-quadrant': refusalQuadrant
  });
})();
