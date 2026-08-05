/* figures-capstone-d.js - animated lesson figures for Phase 19 capstone
   projects in the 51-87 range (query rewriting / HyDE, classical metrics,
   perplexity + calibration, ZeRO sharding, pipeline parallel, jailbreak
   taxonomy, prompt-injection detector, constitutional rules engine).
   Loads after lesson-figures.js, registers through window.LF. SMIL motion
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

  // ── cd-hyde-vector (67): query vector misses, hypothetical doc lands on target ─
  function cdHyde(host) {
    var s = svg(250), CX = 150, CY = 130, R = 96;
    s.appendChild(svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
    s.appendChild(txt(CX, 26, 'embedding space', '10', 'var(--ink-mute,#777)'));
    // target region = where the answering document lives
    var tgX = CX + 64, tgY = CY - 40;
    s.appendChild(svgEl('circle', { cx: tgX, cy: tgY, r: '26', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4' }));
    s.appendChild(txt(tgX, tgY + 4, 'doc', '10', 'var(--blueprint,#3553ff)'));
    // raw query vector points the wrong way
    var qX = CX - 58, qY = CY + 46;
    s.appendChild(svgEl('line', { x1: CX, y1: CY, x2: qX, y2: qY, stroke: 'var(--ink-mute,#777)', 'stroke-width': '2' }));
    s.appendChild(txt(qX - 4, qY + 14, 'query vec', '9', 'var(--ink-mute,#777)', 'middle'));
    // hypothetical doc vector sweeps from query direction to target
    var hyp = svgEl('line', { x1: CX, y1: CY, x2: qX, y2: qY, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.4' });
    hyp.appendChild(svgEl('animate', { attributeName: 'x2', values: qX + ';' + tgX + ';' + tgX + ';' + qX, keyTimes: '0;0.45;0.85;1', dur: '4.2s', repeatCount: 'indefinite' }));
    hyp.appendChild(svgEl('animate', { attributeName: 'y2', values: qY + ';' + tgY + ';' + tgY + ';' + qY, keyTimes: '0;0.45;0.85;1', dur: '4.2s', repeatCount: 'indefinite' }));
    s.appendChild(hyp);
    // moving tip marker
    var tip = svgEl('circle', { cx: qX, cy: qY, r: '5', fill: 'var(--blueprint,#3553ff)' });
    tip.appendChild(svgEl('animate', { attributeName: 'cx', values: qX + ';' + tgX + ';' + tgX + ';' + qX, keyTimes: '0;0.45;0.85;1', dur: '4.2s', repeatCount: 'indefinite' }));
    tip.appendChild(svgEl('animate', { attributeName: 'cy', values: qY + ';' + tgY + ';' + tgY + ';' + qY, keyTimes: '0;0.45;0.85;1', dur: '4.2s', repeatCount: 'indefinite' }));
    s.appendChild(tip);
    // right column: the LLM writes a fake answer first
    var bx = 320;
    s.appendChild(txt(bx, 56, 'LLM writes a', '10', 'var(--ink-soft,#555)', 'start'));
    s.appendChild(txt(bx, 70, 'hypothetical answer:', '10', 'var(--ink-soft,#555)', 'start'));
    var rows = ['"AbortMultipartOnFail', 'aborts the S3 upload', 'and decrements the', 'retry budget..."'];
    var i;
    for (i = 0; i < rows.length; i++) {
      var ln = txt(bx, 96 + i * 18, rows[i], '9', 'var(--blueprint,#3553ff)', 'start');
      ln.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1', keyTimes: '0;' + (0.1 + i * 0.06).toFixed(2) + ';' + (0.22 + i * 0.06).toFixed(2) + ';1', dur: '4.2s', repeatCount: 'indefinite' }));
      s.appendChild(ln);
    }
    s.appendChild(txt(bx, 188, 'embed THAT, not', '9', 'var(--ink-mute,#777)', 'start'));
    s.appendChild(txt(bx, 202, 'the question', '9', 'var(--ink-mute,#777)', 'start'));
    shell(host, 'HyDE QUERY REWRITE', 'fake answer lands on target', s,
      'The raw query vector points into the wrong region, so the answering document never reaches the top-N. HyDE asks the model to write the document that would answer the question, embeds that hypothetical answer instead, and the retrieval vector lands where the real document already lives.');
  }

  // ── cd-bleu-overlap (71): candidate n-grams matched against the reference ─────
  function cdBleu(host) {
    var s = svg(230), PAD = 30, ROWY = 70, refY = 150, bw = 56, gap = 10;
    var cand = ['the', 'cat', 'sat', 'on', 'mat'];
    var ref = ['the', 'cat', 'sat', 'on', 'a', 'mat'];
    // matched indices in candidate (the,cat,sat,on,mat all present)
    var matched = [1, 1, 1, 1, 1];
    s.appendChild(txt(PAD, ROWY - 16, 'candidate', '10', 'var(--ink-soft,#555)', 'start'));
    s.appendChild(txt(PAD, refY - 14, 'reference', '10', 'var(--ink-soft,#555)', 'start'));
    var i;
    for (i = 0; i < cand.length; i++) {
      var cx = PAD + i * (bw + gap);
      var on = matched[i];
      var box = rect(cx, ROWY, bw, 28, on ? 'var(--bg-surface,#eee)' : 'var(--bg,#fafaf5)', on ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)');
      box.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.4;1;1', keyTimes: '0;' + (0.12 + i * 0.12).toFixed(2) + ';1', dur: '3.6s', repeatCount: 'indefinite' }));
      s.appendChild(box);
      s.appendChild(txt(cx + bw / 2, ROWY + 19, cand[i], '11', on ? 'var(--blueprint,#3553ff)' : 'var(--ink-mute,#777)'));
    }
    for (i = 0; i < ref.length; i++) {
      var rx = PAD + i * (bw * 5 / 6 + gap);
      s.appendChild(rect(rx, refY, bw - 6, 26, 'var(--bg,#fafaf5)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(rx + (bw - 6) / 2, refY + 18, ref[i], '10', 'var(--ink-mute,#777)'));
    }
    // matching lines that fade in one by one
    for (i = 0; i < cand.length; i++) {
      var x1 = PAD + i * (bw + gap) + bw / 2;
      var rIdx = i < 4 ? i : 5;
      var x2 = PAD + rIdx * (bw * 5 / 6 + gap) + (bw - 6) / 2;
      var mline = svgEl('line', { x1: x1, y1: ROWY + 28, x2: x2, y2: refY, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', opacity: '0.7' });
      mline.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;0.7;0.7', keyTimes: '0;' + (0.12 + i * 0.12).toFixed(2) + ';' + (0.2 + i * 0.12).toFixed(2) + ';1', dur: '3.6s', repeatCount: 'indefinite' }));
      s.appendChild(mline);
    }
    var score = txt(440, ROWY + 4, '5/5', '12', 'var(--blueprint,#3553ff)', 'start');
    score.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1', keyTimes: '0;0.7;0.8;1', dur: '3.6s', repeatCount: 'indefinite' }));
    s.appendChild(score);
    s.appendChild(txt(440, ROWY + 20, 'precision', '8', 'var(--ink-mute,#777)', 'start'));
    s.appendChild(txt(440, ROWY + 40, 'BP < 1', '9', 'var(--warn,#b8870f)', 'start'));
    s.appendChild(txt(440, ROWY + 54, '(too short)', '8', 'var(--ink-mute,#777)', 'start'));
    shell(host, 'BLEU N-GRAM OVERLAP', 'count matches, clamp, penalize', s,
      'BLEU is counting. Each candidate n-gram that appears in the reference scores a match; the clipped count over the candidate length is modified n-gram precision. A candidate shorter than the reference takes a brevity penalty, so high precision on a stub still loses. ROUGE-L instead rewards the longest common subsequence.');
  }

  // ── cd-reliability (73): calibration reliability diagram drifting onto diagonal ─
  function cdReliability(host) {
    var s = svg(250), X0 = 60, Y0 = 30, SZ = 180, Y1 = Y0 + SZ;
    // axes
    s.appendChild(svgEl('line', { x1: X0, y1: Y0, x2: X0, y2: Y1, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    s.appendChild(svgEl('line', { x1: X0, y1: Y1, x2: X0 + SZ, y2: Y1, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    // perfect-calibration diagonal
    s.appendChild(svgEl('line', { x1: X0, y1: Y1, x2: X0 + SZ, y2: Y0, stroke: 'var(--ink-mute,#777)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
    s.appendChild(txt(X0 + SZ - 4, Y0 + 30, 'perfect', '9', 'var(--ink-mute,#777)', 'end'));
    s.appendChild(txt(X0 + SZ / 2, Y1 + 22, 'predicted confidence', '9', 'var(--ink-soft,#555)'));
    var lab = svgEl('text', { x: X0 - 16, y: Y0 + SZ / 2, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '9', fill: 'var(--ink-soft,#555)', transform: 'rotate(-90 ' + (X0 - 16) + ' ' + (Y0 + SZ / 2) + ')' });
    lab.appendChild(document.createTextNode('observed accuracy'));
    s.appendChild(lab);
    // five confidence bins: overconfident (below diagonal) sliding up to diagonal
    var confs = [0.1, 0.3, 0.5, 0.7, 0.9];
    var acc = [0.08, 0.2, 0.34, 0.5, 0.62]; // overconfident
    var i;
    for (i = 0; i < confs.length; i++) {
      var cx = X0 + confs[i] * SZ;
      var yBad = Y1 - acc[i] * SZ;
      var yGood = Y1 - confs[i] * SZ;
      // bar from baseline to point
      var bh = (yBad < yGood ? yBad : yGood);
      var dot = svgEl('circle', { cx: cx, cy: yBad, r: '5', fill: 'var(--blueprint,#3553ff)' });
      dot.appendChild(svgEl('animate', { attributeName: 'cy', values: yBad + ';' + yGood + ';' + yGood + ';' + yBad, keyTimes: '0;0.4;0.7;1', dur: '4.5s', begin: (i * 0.08) + 's', repeatCount: 'indefinite' }));
      s.appendChild(dot);
      // gap line (ECE contribution)
      var gapl = svgEl('line', { x1: cx, y1: yBad, x2: cx, y2: yGood, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' });
      gapl.appendChild(svgEl('animate', { attributeName: 'y1', values: yBad + ';' + yGood + ';' + yGood + ';' + yBad, keyTimes: '0;0.4;0.7;1', dur: '4.5s', begin: (i * 0.08) + 's', repeatCount: 'indefinite' }));
      s.appendChild(gapl);
    }
    var tag = txt(X0 + 14, Y0 + 14, 'ECE: gap to diagonal', '9', 'var(--warn,#b8870f)', 'start');
    s.appendChild(tag);
    shell(host, 'CALIBRATION RELIABILITY', 'confidence vs accuracy', s,
      'Bin predictions by stated confidence and plot observed accuracy. A calibrated model sits on the diagonal. The orange gaps are where it claims more confidence than it earns; the expected calibration error is the bin-weighted average of those gaps. Perplexity asks if held-out text is plausible at all; calibration asks if the confidence is honest.');
  }

  // ── cd-zero-shard (78): optimizer state split across ranks, scatter then gather ─
  function cdZero(host) {
    var s = svg(240), n = 4, PAD = 36, bw = 88, gap = (520 - 2 * PAD - n * bw) / (n - 1);
    var topY = 44, optY = 96, optH = 70;
    s.appendChild(txt(PAD, 28, 'each rank: full params, but only 1/N of the optimiser', '10', 'var(--ink-soft,#777)', 'start'));
    var i;
    for (i = 0; i < n; i++) {
      var x = PAD + i * (bw + gap);
      // full params band (replicated)
      s.appendChild(rect(x, topY, bw, 22, 'var(--bg-surface,#eee)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(x + bw / 2, topY + 15, 'params', '9', 'var(--ink-mute,#777)'));
      // owned optimiser shard only
      var shard = rect(x, optY, bw, optH, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)');
      s.appendChild(shard);
      s.appendChild(txt(x + bw / 2, optY + 26, 'Adam', '9', 'var(--blueprint,#3553ff)'));
      s.appendChild(txt(x + bw / 2, optY + 40, 'shard ' + i, '9', 'var(--blueprint,#3553ff)'));
      s.appendChild(txt(x + bw / 2, optY + optH + 16, 'rank ' + i, '9', 'var(--ink-soft,#555)'));
      // reduce_scatter arrow in (grad shard arrives)
      var rs = svgEl('path', { d: 'M ' + (x + bw / 2) + ' ' + (optY - 14) + ' L ' + (x + bw / 2) + ' ' + (optY - 2), stroke: 'var(--ink-mute,#777)', 'stroke-width': '2' });
      s.appendChild(rs);
      var rsm = svgEl('circle', { cx: x + bw / 2, cy: optY - 14, r: '3.5', fill: 'var(--warn,#b8870f)' });
      rsm.appendChild(svgEl('animate', { attributeName: 'cy', values: (optY - 28) + ';' + (optY - 4), keyTimes: '0;1', dur: '1.8s', begin: '0s', repeatCount: 'indefinite' }));
      rsm.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.2;0.8;1', dur: '1.8s', repeatCount: 'indefinite' }));
      s.appendChild(rsm);
      // allgather pulse: updated shard broadcasts out after step
      var pulse = svgEl('circle', { cx: x + bw / 2, cy: optY + optH / 2, r: '4', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' });
      pulse.appendChild(svgEl('animate', { attributeName: 'r', values: '4;26', keyTimes: '0;1', dur: '1.8s', begin: '0.9s', repeatCount: 'indefinite' }));
      pulse.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.7;0', keyTimes: '0;1', dur: '1.8s', begin: '0.9s', repeatCount: 'indefinite' }));
      s.appendChild(pulse);
    }
    s.appendChild(txt(PAD, 218, 'reduce_scatter grads in', '9', 'var(--warn,#b8870f)', 'start'));
    s.appendChild(txt(520 - PAD, 218, 'allgather params out', '9', 'var(--blueprint,#3553ff)', 'end'));
    shell(host, 'ZeRO STATE SHARDING', 'optimiser split 1/N per rank', s,
      'Vanilla DDP replicates the optimiser state on every rank, the largest allocation in the stack. ZeRO stage 1 gives each rank only 1/N of the Adam moments. reduce_scatter delivers each rank its gradient shard, it steps locally, then allgather broadcasts the updated parameter shards back so every rank rebuilds the full model. Memory drops linearly; the wire cost equals one allreduce.');
  }

  // ── cd-pipeline-bubble (79): microbatches flow through stages, bubble drains ──
  function cdPipeline(host) {
    var s = svg(240), N = 4, M = 4, PAD = 50, cellW = 57, cellH = 26, gap = 6;
    var rowY = 40;
    var i, j;
    // stage row labels
    for (i = 0; i < N; i++) {
      s.appendChild(txt(PAD - 8, rowY + i * (cellH + gap) + 17, 'stage ' + i, '9', 'var(--ink-soft,#555)', 'end'));
      // baseline track
      s.appendChild(svgEl('line', { x1: PAD, y1: rowY + i * (cellH + gap) + cellH / 2, x2: PAD + (M + N) * cellW, y2: rowY + i * (cellH + gap) + cellH / 2, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.6' }));
    }
    // diagonal flow: microbatch m occupies stage i at time t = m + i
    var period = 4.4;
    for (j = 0; j < M; j++) {
      for (i = 0; i < N; i++) {
        var slot = j + i;
        var x = PAD + slot * cellW + 4;
        var y = rowY + i * (cellH + gap);
        var c = rect(x, y, cellW - 8, cellH, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)');
        var begin = (slot * 0.18).toFixed(2);
        c.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.12;1;1;0.35', keyTimes: '0;0.18;0.7;1', dur: period + 's', begin: begin + 's', repeatCount: 'indefinite' }));
        s.appendChild(c);
        var lab = txt(x + (cellW - 8) / 2, y + 17, 'mb' + j, '9', 'var(--blueprint,#3553ff)');
        lab.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0.4', keyTimes: '0;0.18;0.7;1', dur: period + 's', begin: begin + 's', repeatCount: 'indefinite' }));
        s.appendChild(lab);
      }
    }
    // bubble shading: top-right and bottom-left idle triangles
    s.appendChild(txt(PAD + (M + N - 1) * cellW, rowY - 6, 'bubble', '9', 'var(--warn,#b8870f)', 'middle'));
    var bub = svgEl('path', { d: 'M ' + (PAD + M * cellW) + ' ' + rowY + ' L ' + (PAD + (M + N - 1) * cellW) + ' ' + rowY + ' L ' + (PAD + (M + N - 1) * cellW) + ' ' + (rowY + (N - 1) * (cellH + gap)) + ' Z', fill: 'var(--warn,#b8870f)', opacity: '0.12' });
    s.appendChild(bub);
    s.appendChild(txt(PAD, 215, 'bubble fraction = (N-1)/(M+N-1)  =  3/7  ≈  43% at M=4, N=4', '10', 'var(--ink-soft,#555)', 'start'));
    shell(host, 'PIPELINE PARALLEL', 'microbatches fill the stages', s,
      'Each stage lives on its own rank; a microbatch enters stage 0, hands its activation to stage 1, and so on diagonally through time. The shaded triangle is the bubble, the idle time while the pipeline fills and drains. More microbatches per step shrink the bubble: (N-1)/(M+N-1) falls from 43% at M=4 to under 5% at M=64.');
  }

  // ── cd-attack-taxonomy (82): six trust boundaries orbiting the assistant ──────
  function cdTaxonomy(host) {
    var s = svg(260), CX = 260, CY = 130, R = 92;
    var cats = [
      ['role-play', 'persona'],
      ['instruction-override', 'system authority'],
      ['context-smuggling', 'content/instruction gap'],
      ['multi-turn-ramp', 'history as contract'],
      ['encoding-trick', 'surface form'],
      ['prefix-injection', 'next-token']
    ];
    // core assistant
    s.appendChild(svgEl('circle', { cx: CX, cy: CY, r: '34', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6' }));
    s.appendChild(txt(CX, CY - 2, 'assistant', '10', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(CX, CY + 12, 'trust core', '9', 'var(--ink-mute,#777)'));
    var i;
    for (i = 0; i < 6; i++) {
      var ang = (i / 6) * 2 * Math.PI - Math.PI / 2;
      var nx = CX + R * Math.cos(ang), ny = CY + R * Math.sin(ang);
      // spoke
      s.appendChild(svgEl('line', { x1: CX + 34 * Math.cos(ang), y1: CY + 34 * Math.sin(ang), x2: nx, y2: ny, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      // attack pulse travelling inward along the spoke, staggered per category
      var pulse = svgEl('circle', { cx: nx, cy: ny, r: '3.5', fill: 'var(--warn,#b8870f)' });
      pulse.appendChild(svgEl('animate', { attributeName: 'cx', values: nx + ';' + (CX + 36 * Math.cos(ang)), keyTimes: '0;1', dur: '2.4s', begin: (i * 0.4) + 's', repeatCount: 'indefinite' }));
      pulse.appendChild(svgEl('animate', { attributeName: 'cy', values: ny + ';' + (CY + 36 * Math.sin(ang)), keyTimes: '0;1', dur: '2.4s', begin: (i * 0.4) + 's', repeatCount: 'indefinite' }));
      pulse.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0', keyTimes: '0;0.7;1', dur: '2.4s', begin: (i * 0.4) + 's', repeatCount: 'indefinite' }));
      s.appendChild(pulse);
      // node
      var anchor = Math.cos(ang) > 0.2 ? 'start' : Math.cos(ang) < -0.2 ? 'end' : 'middle';
      var lx = nx + (anchor === 'start' ? 8 : anchor === 'end' ? -8 : 0);
      s.appendChild(svgEl('circle', { cx: nx, cy: ny, r: '6', fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4' }));
      s.appendChild(txt(lx, ny - 2, cats[i][0], '9', 'var(--ink,#1a1a1a)', anchor));
      s.appendChild(txt(lx, ny + 10, cats[i][1], '8', 'var(--ink-mute,#777)', anchor));
    }
    shell(host, 'JAILBREAK TAXONOMY', 'six trust boundaries', s,
      'A safety harness without a taxonomy is a coin flip. Each of the six categories names one trust boundary an attack abuses, from the assistant persona to its next-token decision. Naming the boundary turns an attack stream into a histogram, the histogram into a coverage chart, and the chart into the next sprint.');
  }

  // ── cd-output-router (85): three output classifiers feed a policy router ─────
  function cdRouter(host) {
    var s = svg(250), PAD = 24, clsX = 36, clsW = 150, rtX = 244, rtW = 96;
    var cls = [
      [60, 'toxicity', 'slur / harassment', 'low'],
      [125, 'PII', 'email · SSN · card', 'medium'],
      [190, 'leakage', 'system-prompt echo', 'high']
    ];
    s.appendChild(txt(clsX, 28, 'model output → three classifiers run in parallel', '10', 'var(--ink-soft,#555)', 'start'));
    var actions = [
      [54, 'log', 'var(--ink-mute,#777)'],
      [104, 'warn', 'var(--ink-soft,#555)'],
      [154, 'redact', 'var(--warn,#b8870f)'],
      [204, 'block', 'var(--warn,#b8870f)']
    ];
    // router node
    s.appendChild(rect(rtX, 96, rtW, 64, 'var(--bg-surface,#eee)', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(rtX + rtW / 2, 122, 'policy', '11', 'var(--blueprint,#3553ff)'));
    s.appendChild(txt(rtX + rtW / 2, 138, 'router', '11', 'var(--blueprint,#3553ff)'));
    var i;
    for (i = 0; i < cls.length; i++) {
      var cy = cls[i][0];
      s.appendChild(rect(clsX, cy, clsW, 44, 'var(--bg,#fafaf5)', 'var(--rule-soft,#ddd)'));
      s.appendChild(txt(clsX + clsW / 2, cy + 18, cls[i][1], '11', 'var(--ink,#1a1a1a)'));
      s.appendChild(txt(clsX + clsW / 2, cy + 34, cls[i][2], '8', 'var(--ink-mute,#777)'));
      // verdict packet travelling into the router, staggered
      var pkt = svgEl('circle', { cx: clsX + clsW + 4, cy: cy + 22, r: '4.5', fill: 'var(--warn,#b8870f)' });
      pkt.appendChild(svgEl('animate', { attributeName: 'cx', values: (clsX + clsW + 4) + ';' + rtX, keyTimes: '0;1', dur: '1.4s', begin: (i * 0.3) + 's', repeatCount: 'indefinite' }));
      pkt.appendChild(svgEl('animate', { attributeName: 'cy', values: (cy + 22) + ';128', keyTimes: '0;1', dur: '1.4s', begin: (i * 0.3) + 's', repeatCount: 'indefinite' }));
      pkt.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0', keyTimes: '0;0.7;1', dur: '1.4s', begin: (i * 0.3) + 's', repeatCount: 'indefinite' }));
      s.appendChild(pkt);
      s.appendChild(svgEl('line', { x1: clsX + clsW, y1: cy + 22, x2: rtX, y2: 128, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.8' }));
    }
    // action ladder, highest severity wins -> block lights up
    for (i = 0; i < actions.length; i++) {
      var ay = actions[i][0];
      var hot = (i === 3);
      var ab = rect(rtX + rtW + 22, ay, 90, 30, 'var(--bg,#fafaf5)', hot ? 'var(--warn,#b8870f)' : 'var(--rule-soft,#ddd)');
      if (hot) ab.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.3;0.3;1;1;0.3', keyTimes: '0;0.6;0.72;0.95;1', dur: '4.2s', repeatCount: 'indefinite' }));
      s.appendChild(ab);
      s.appendChild(txt(rtX + rtW + 22 + 45, ay + 19, actions[i][1], '10', actions[i][2]));
    }
    s.appendChild(txt(rtX + rtW + 22 + 45, 26, 'severity → action', '8', 'var(--ink-mute,#777)'));
    shell(host, 'OUTPUT POLICY ROUTER', 'classifiers → severity → action', s,
      'Input checks are not enough; an output-side classifier sees the actual response and asks if it is safe to ship. Three independent classifiers (toxicity, PII, leakage) return a severity, and the router picks the action by the worst finding: log, warn, redact, or block. Classifiers run in parallel with streaming so the latency hides behind the final flush.');
  }

  // ── cd-constitution-loop (86): draft, rules, fixer, revised, re-check ─────────
  function cdConstitution(host) {
    var s = svg(240), CX = 260, CY = 116;
    var nodes = [
      [90, 70, 'draft'],
      [260, 50, 'rules engine'],
      [430, 70, 'fixer'],
      [430, 170, 'revised'],
      [260, 190, 'rules 2nd pass'],
      [90, 170, 'verdict']
    ];
    var i;
    // ring connector path the dot travels along (rounded hexagon order)
    var pts = [];
    for (i = 0; i < nodes.length; i++) { pts.push([nodes[i][0], nodes[i][1]]); }
    var pathD = 'M ' + pts[0][0] + ' ' + pts[0][1];
    for (i = 1; i < pts.length; i++) { pathD += ' L ' + pts[i][0] + ' ' + pts[i][1]; }
    pathD += ' Z';
    s.appendChild(svgEl('path', { d: pathD, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.4', 'stroke-dasharray': '5 5' }));
    // violation flag pulse on the rules engine node
    for (i = 0; i < nodes.length; i++) {
      var nx = nodes[i][0], ny = nodes[i][1];
      var isRule = (i === 1 || i === 4);
      s.appendChild(svgEl('rect', { x: nx - 52, y: ny - 15, width: 104, height: 30, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: isRule ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' }));
      s.appendChild(txt(nx, ny + 4, nodes[i][2], '10', isRule ? 'var(--blueprint,#3553ff)' : 'var(--ink,#1a1a1a)'));
    }
    // travelling token using animateMotion along the loop
    var mover = svgEl('circle', { r: '6', fill: 'var(--warn,#b8870f)' });
    var motion = svgEl('animateMotion', { dur: '5.4s', repeatCount: 'indefinite', path: pathD });
    mover.appendChild(motion);
    s.appendChild(mover);
    // violation badge that flashes at the rules engine
    var badge = txt(CX, 30, 'violation: code lacks runnable block', '9', 'var(--warn,#b8870f)');
    badge.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.1;0.25;0.4', dur: '5.4s', repeatCount: 'indefinite' }));
    s.appendChild(badge);
    var ok = txt(CX, 218, 'accepted: revision satisfies every rule', '9', 'var(--blueprint,#3553ff)');
    ok.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: '0;0.6;0.72;0.92;1', dur: '5.4s', repeatCount: 'indefinite' }));
    s.appendChild(ok);
    shell(host, 'CONSTITUTIONAL RULES', 'draft → fix → re-check', s,
      'A rule is a name, a predicate, and an explanation; anything missing one of those is a vibe. The constitution lives in YAML under version control. The engine flags each violation, the fixer proposes a revision, and a second pass confirms the revision satisfies every rule before the response is accepted or escalated.');
  }

  LF.register({
    'cd-hyde-vector': cdHyde,
    'cd-bleu-overlap': cdBleu,
    'cd-reliability-diagram': cdReliability,
    'cd-zero-shard': cdZero,
    'cd-pipeline-bubble': cdPipeline,
    'cd-attack-taxonomy': cdTaxonomy,
    'cd-output-router': cdRouter,
    'cd-constitution-loop': cdConstitution
  });
})();
