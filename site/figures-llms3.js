/* figures-llms3.js: SMIL-animated lesson figures for Phase 07 (transformers
   deep dive) and Phase 10 (LLMs from scratch). Loads after lesson-figures.js
   and registers through window.LF.register. Vanilla ES5, no deps, theme via
   CSS vars. Each figure is a self-driving animated SVG (SMIL only — no JS
   loops, never hangs). Authoring is the same fenced block:
       ```figure
       bert-mlm
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BP = 'var(--blueprint,#3553ff)';
  var INK = 'var(--ink,#1a1a1a)';
  var MUTE = 'var(--ink-mute,#999)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var WARN = 'var(--warn,#b8870f)';

  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function card(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }

  // ── expert-routing: each token routes to top-k of E experts, the rest idle ──
  function expertRouting(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var toks = ['the', 'cat', 'sat', 'down'];
    var tx0 = 30, tw = 56, tg = 10, ty = 30;
    var E = 4, ex0 = 320, ew = 150, eh = 34, eg = 16, eyTop = 24;
    // the router in the middle
    var routerX = 180;
    svg.appendChild(svgEl('rect', { x: routerX, y: 90, width: 70, height: 56, rx: 5, fill: 'none', stroke: BP, 'stroke-width': 1.6 }));
    svg.appendChild(svgEl('text', { x: routerX + 35, y: 122, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': 11, fill: BP }, [document.createTextNode('router')]));
    // experts on the right
    for (var e = 0; e < E; e++) {
      var ey = eyTop + e * (eh + eg);
      svg.appendChild(svgEl('rect', { x: ex0, y: ey, width: ew, height: eh, rx: 4, fill: SOFT, stroke: MUTE, 'stroke-width': 1 }));
      svg.appendChild(svgEl('text', { x: ex0 + 10, y: ey + 22, 'font-family': 'var(--font-mono,monospace)', 'font-size': 11, fill: INK }, [document.createTextNode('expert ' + (e + 1))]));
      // pulse the expert when it is selected (each token picks 2 of 4, cycling)
      var lit = svgEl('rect', { x: ex0, y: ey, width: ew, height: eh, rx: 4, fill: BP, opacity: 0 });
      var phase = (e * 0.22).toFixed(2);
      lit.appendChild(anim('opacity', '0;0.7;0;0', '4.4s', { keyTimes: '0;' + phase + ';' + (Number(phase) + 0.2).toFixed(2) + ';1' }));
      svg.appendChild(lit);
    }
    // tokens on the left, each shooting a routing beam to its 2 experts
    var pick = [[0, 2], [1, 3], [0, 3], [1, 2]];
    toks.forEach(function (t, i) {
      var x = tx0 + i * (tw + tg);
      svg.appendChild(svgEl('rect', { x: x, y: ty, width: tw, height: 28, rx: 4, fill: SOFT, stroke: MUTE, 'stroke-width': 1 }));
      svg.appendChild(svgEl('text', { x: x + tw / 2, y: ty + 19, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': 11, fill: INK }, [document.createTextNode(t)]));
      // a routing token travels token → router → expert
      pick[i].forEach(function (e, j) {
        var ey = eyTop + e * (eh + eg) + eh / 2;
        var d = 'M ' + (x + tw / 2) + ' ' + (ty + 28) + ' Q ' + routerX + ' 118 ' + ex0 + ' ' + ey;
        var beam = svgEl('path', { d: d, fill: 'none', stroke: BP, 'stroke-width': 1.4, 'stroke-dasharray': '5 5', opacity: 0.18 });
        beam.appendChild(anim('opacity', '0.12;0.8;0.12', '4.4s', { begin: (i * 0.22 + j * 0.05) + 's' }));
        beam.appendChild(anim('stroke-dashoffset', '20;0', '0.9s'));
        svg.appendChild(beam);
      });
    });
    svg.appendChild(svgEl('text', { x: W / 2, y: 224, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': 10, fill: MUTE }, [document.createTextNode('each token activates top-k of E experts — the rest stay idle')]));
    card(host, 'MIXTURE OF EXPERTS', 'route each token to a few experts',
      svg, 'A dense block runs one FFN for every token. An MoE block swaps in many expert FFNs and a router that sends each token to only the top-k of them. Total parameters scale with the number of experts, but compute per token scales only with k — so the model gets bigger without getting slower.');
  }

  // ── encoder-decoder: source encodes once, decoder cross-attends step by step ─
  function encoderDecoder(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var encX = 70, decX = 360, n = 4, by = 40, bh = 34, bg = 10;
    // encoder stack (left) — fills in once, stays lit
    for (var i = 0; i < n; i++) {
      var ey = by + i * (bh + bg);
      var er = svgEl('rect', { x: encX, y: ey, width: 90, height: bh, rx: 4, fill: SOFT, stroke: MUTE, 'stroke-width': 1 });
      er.appendChild(anim('fill', 'var(--bg,#fafaf5);' + SOFT + ';' + SOFT, '4s', { keyTimes: '0;0.2;1', fill: 'freeze', repeatCount: '1' }));
      svg.appendChild(er);
    }
    svg.appendChild(svgEl('text', { x: encX + 45, y: 28, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 11, fill: MUTE }, [document.createTextNode('ENCODER')]));
    svg.appendChild(svgEl('text', { x: decX + 45, y: 28, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 11, fill: BP }, [document.createTextNode('DECODER')]));
    // decoder stack (right)
    for (i = 0; i < n; i++) {
      var dy = by + i * (bh + bg);
      svg.appendChild(svgEl('rect', { x: decX, y: dy, width: 90, height: bh, rx: 4, fill: 'none', stroke: BP, 'stroke-width': 1.4 }));
      // cross-attention link from encoder to this decoder layer, lighting in turn
      var link = svgEl('line', { x1: encX + 90, y1: dy + bh / 2, x2: decX, y2: dy + bh / 2,
        stroke: BP, 'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: 0.2 });
      link.appendChild(anim('opacity', '0.15;0.9;0.15', '4s', { begin: (1.4 + i * 0.3) + 's' }));
      link.appendChild(anim('stroke-dashoffset', '18;0', '0.9s'));
      svg.appendChild(link);
    }
    // generated tokens emerging below the decoder, one at a time
    var outs = ['le', 'chat', 'dort'];
    outs.forEach(function (t, j) {
      var ox = decX + j * 34;
      var oc = svgEl('rect', { x: ox, y: 200, width: 30, height: 24, rx: 3, fill: BP, opacity: 0 });
      oc.appendChild(anim('opacity', '0;0;1;1', '4s', { keyTimes: '0;' + (0.55 + j * 0.12).toFixed(2) + ';' + (0.62 + j * 0.12).toFixed(2) + ';1' }));
      svg.appendChild(oc);
    });
    svg.appendChild(svgEl('text', { x: encX + 45, y: 218, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 11, fill: MUTE }, [document.createTextNode('the cat sleeps')]));
    card(host, 'ENCODER – DECODER', 'cross-attention lights up',
      svg, 'The encoder reads the whole source once and freezes a dense representation. The decoder then generates the output token by token, cross-attending into that representation at every layer. Translation, summarization, and transcription are all this same input-to-output shape.');
  }

  // ── rnn-vs-parallel: serial hidden state crawling vs all-at-once attention ──
  function rnnVsParallel(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var n = 6, bw = 54, gap = 10, x0 = 40;
    function row(y, label, color) {
      svg.appendChild(svgEl('text', { x: 8, y: y - 14, 'font-family': 'var(--font-mono,monospace)', 'font-size': 10, fill: color }, [document.createTextNode(label)]));
      for (var i = 0; i < n; i++) {
        var x = x0 + i * (bw + gap);
        svg.appendChild(svgEl('rect', { x: x, y: y, width: bw, height: 28, rx: 3, fill: SOFT, stroke: MUTE, 'stroke-width': 1 }));
      }
    }
    row(50, 'RNN — serial', MUTE);
    row(160, 'TRANSFORMER — parallel', BP);
    // RNN: a hidden state token walks left to right, slowly
    var hs = svgEl('circle', { cx: x0 + bw / 2, cy: 64, r: 9, fill: WARN });
    var path = 'M ' + (x0 + bw / 2) + ' 64 L ' + (x0 + (n - 1) * (bw + gap) + bw / 2) + ' 64';
    var mo = svgEl('animateMotion', { dur: '4s', repeatCount: 'indefinite', path: 'M 0 0 L ' + ((n - 1) * (bw + gap)) + ' 0', keyPoints: '0;1', keyTimes: '0;1', calcMode: 'linear' });
    hs.appendChild(mo);
    svg.appendChild(hs);
    // parallel: every block lights at once, repeatedly
    for (var i = 0; i < n; i++) {
      var x = x0 + i * (bw + gap);
      var fl = svgEl('rect', { x: x, y: 160, width: bw, height: 28, rx: 3, fill: BP, opacity: 0 });
      fl.appendChild(anim('opacity', '0;0.85;0;0', '4s', { keyTimes: '0;0.1;0.4;1' }));
      svg.appendChild(fl);
    }
    // the cross-attention web for the parallel row, drawn faintly and flowing
    for (i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var ax = x0 + i * (bw + gap) + bw / 2, bx = x0 + j * (bw + gap) + bw / 2;
        if (j - i > 2) continue;
        var web = svgEl('path', { d: 'M ' + ax + ' 160 Q ' + (ax + bx) / 2 + ' 130 ' + bx + ' 160',
          fill: 'none', stroke: BP, 'stroke-width': 1, opacity: 0.18 });
        web.appendChild(anim('opacity', '0;0.5;0;0', '4s', { keyTimes: '0;0.12;0.45;1' }));
        svg.appendChild(web);
      }
    }
    svg.appendChild(svgEl('text', { x: W / 2, y: 214, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 11, fill: MUTE }, [document.createTextNode('serial: t+1 waits for t   vs   parallel: one matmul')]));
    card(host, 'WHY TRANSFORMERS', 'serial state vs parallel attention',
      svg, 'An RNN drags a single hidden state across the sequence one step at a time, so a 1,000-token input is 1,000 serial steps. A transformer lets every position attend to every other in one parallel matrix multiply. That single bet — drop recurrence — is what let the curves keep scaling after 2017.');
  }

  // ── draft-verify-tokens: cheap drafter proposes, verifier accepts or rejects ─
  function draftVerifyTokens(host) {
    var W = 520, H = 220;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var n = 5, bw = 64, gap = 12, x0 = 60, dy = 50, vy = 140;
    svg.appendChild(svgEl('text', { x: 8, y: dy + 17, 'font-family': 'var(--font-mono,monospace)', 'font-size': 9, fill: MUTE }, [document.createTextNode('DRAFT')]));
    svg.appendChild(svgEl('text', { x: 8, y: vy + 17, 'font-family': 'var(--font-mono,monospace)', 'font-size': 9, fill: BP }, [document.createTextNode('VERIFY')]));
    var accepted = [1, 1, 1, 0, 0]; // last two rejected
    for (var i = 0; i < n; i++) {
      var x = x0 + i * (bw + gap);
      // drafted token appears quickly, left to right
      var d = svgEl('rect', { x: x, y: dy, width: bw, height: 30, rx: 4, fill: SOFT, stroke: MUTE, 'stroke-width': 1, opacity: 0 });
      d.appendChild(anim('opacity', '0;1;1;1', '5s', { keyTimes: '0;' + (0.05 + i * 0.04).toFixed(2) + ';0.95;1' }));
      svg.appendChild(d);
      // verifier pass: one sweep checks all, then marks accept (blue) / reject (warn)
      var ok = accepted[i];
      var v = svgEl('rect', { x: x, y: vy, width: bw, height: 30, rx: 4,
        fill: 'none', stroke: ok ? BP : WARN, 'stroke-width': 1.6, opacity: 0 });
      v.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.55;0.62;1' }));
      svg.appendChild(v);
      var vfill = svgEl('rect', { x: x, y: vy, width: bw, height: 30, rx: 4, fill: ok ? BP : WARN, opacity: 0 });
      vfill.appendChild(anim('opacity', '0;0;' + (ok ? '0.8' : '0.25') + ';' + (ok ? '0.8' : '0.25'), '5s', { keyTimes: '0;0.62;0.7;1' }));
      svg.appendChild(vfill);
      svg.appendChild(svgEl('text', { x: x + bw / 2, y: vy + 47, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
        'font-size': 10, fill: ok ? BP : WARN }, [document.createTextNode(ok ? 'accept' : 'reject')]));
    }
    // a single verifier sweep bar moving across to show "one forward pass"
    var sweep = svgEl('rect', { x: x0 - 6, y: vy - 6, width: 6, height: 42, fill: BP, opacity: 0.6 });
    sweep.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate',
      values: '0 0;' + ((n - 1) * (bw + gap) + bw) + ' 0', dur: '5s', repeatCount: 'indefinite', keyTimes: '0;1' }));
    sweep.appendChild(anim('opacity', '0;0.6;0.6;0;0', '5s', { keyTimes: '0;0.5;0.6;0.65;1' }));
    svg.appendChild(sweep);
    card(host, 'SPECULATIVE DECODING', 'draft → verify → keep the prefix',
      svg, 'A cheap drafter proposes several tokens in quick small passes. The big model then verifies all of them in a single forward pass, accepting the longest prefix that matches its own distribution and rejecting the rest. When the draft is good you get many tokens for the price of one big step — with no change to the output distribution.');
  }

  // ── multi-token-predict: one hidden state supervised on several future tokens ─
  function multiTokenPredict(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var hx = 90, hy = 150, hw = 80, hh = 40;
    // the shared hidden state
    var h = svgEl('rect', { x: hx, y: hy, width: hw, height: hh, rx: 5, fill: BP, opacity: 0.85 });
    svg.appendChild(h);
    svg.appendChild(svgEl('text', { x: hx + hw / 2, y: hy + 25, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 11, fill: 'var(--bg,#fafaf5)' }, [document.createTextNode('h_t')]));
    // three depth heads chained: t+1, t+2, t+3, each refining and emitting
    var depths = ['t+1', 't+2', 't+3'];
    var px = hx + hw + 60;
    depths.forEach(function (lab, k) {
      var y = 40 + k * 56;
      var box = svgEl('rect', { x: px, y: y, width: 70, height: 36, rx: 4, fill: 'none', stroke: BP, 'stroke-width': 1.4 });
      svg.appendChild(box);
      svg.appendChild(svgEl('text', { x: px + 35, y: y + 23, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
        'font-size': 11, fill: BP }, [document.createTextNode('MTP ' + lab)]));
      // flow from hidden state into this head, staggered (sequential refinement)
      var ln = svgEl('path', { d: 'M ' + (hx + hw) + ' ' + (hy + hh / 2) + ' C ' + (px - 30) + ' ' + (hy + hh / 2) + ' ' + (px - 30) + ' ' + (y + 18) + ' ' + px + ' ' + (y + 18),
        fill: 'none', stroke: BP, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', opacity: 0.25 });
      ln.appendChild(anim('opacity', '0.2;0.9;0.2', '3.6s', { begin: (k * 0.5) + 's' }));
      ln.appendChild(anim('stroke-dashoffset', '18;0', '0.8s'));
      svg.appendChild(ln);
      // predicted token pops out to the right
      var tok = svgEl('rect', { x: px + 100, y: y + 4, width: 30, height: 28, rx: 3, fill: BP, opacity: 0 });
      tok.appendChild(anim('opacity', '0;1;1;0.3', '3.6s', { keyTimes: '0;' + (0.15 + k * 0.15).toFixed(2) + ';0.85;1', begin: (k * 0.5) + 's' }));
      svg.appendChild(tok);
    });
    svg.appendChild(svgEl('text', { x: hx + hw / 2, y: hy + hh + 22, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 10, fill: MUTE }, [document.createTextNode('one hidden state')]));
    card(host, 'MULTI-TOKEN PREDICTION', 'one state, several futures',
      svg, 'Standard training supervises each hidden state to predict exactly one next token — a weak signal. MTP adds depth heads that each predict a token further ahead, chained so the causal order survives. The richer signal sharpens the backbone, and the trained heads double as a speculative drafter at inference.');
  }

  // ── self-critique-loop: a draft answer cycles through critique then revision ─
  function selfCritiqueLoop(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var cx = 260, cy = 120, r = 78;
    var stages = [
      { a: -90, t: 'draft' },
      { a: 30, t: 'critique' },
      { a: 150, t: 'revise' }
    ];
    // the cycle ring
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: SOFT, 'stroke-width': 2 }));
    // a token of activity travelling around the ring
    var dot = svgEl('circle', { cx: cx + r, cy: cy, r: 7, fill: BP });
    dot.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'rotate',
      values: '0 ' + cx + ' ' + cy + ';360 ' + cx + ' ' + cy, dur: '6s', repeatCount: 'indefinite' }));
    svg.appendChild(dot);
    stages.forEach(function (s, i) {
      var rad = s.a * Math.PI / 180;
      var nx = cx + r * Math.cos(rad), ny = cy + r * Math.sin(rad);
      var node = svgEl('circle', { cx: nx, cy: ny, r: 11, fill: 'var(--bg,#fafaf5)', stroke: BP, 'stroke-width': 1.6 });
      node.appendChild(anim('fill', 'var(--bg,#fafaf5);' + BP + ';var(--bg,#fafaf5);var(--bg,#fafaf5)', '6s', { keyTimes: '0;' + (0.04 + i * 0.333).toFixed(3) + ';' + (0.2 + i * 0.333).toFixed(3) + ';1' }));
      svg.appendChild(node);
      var lx = nx + (s.a === 30 ? 18 : s.a === 150 ? -18 : 0);
      svg.appendChild(svgEl('text', { x: lx, y: ny + (s.a === -90 ? -18 : 30), 'text-anchor': 'middle',
        'font-family': 'var(--font-mono,monospace)', 'font-size': 11, fill: BP }, [document.createTextNode(s.t)]));
    });
    // the written constitution feeding the critique node
    svg.appendChild(svgEl('rect', { x: 30, y: 80, width: 96, height: 70, rx: 4, fill: 'none', stroke: MUTE, 'stroke-width': 1 }));
    svg.appendChild(svgEl('text', { x: 78, y: 72, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': 10, fill: MUTE }, [document.createTextNode('constitution')]));
    [0, 1, 2].forEach(function (k) {
      svg.appendChild(svgEl('line', { x1: 42, y1: 100 + k * 16, x2: 114, y2: 100 + k * 16, stroke: MUTE, 'stroke-width': 1, opacity: 0.6 }));
    });
    var feed = svgEl('line', { x1: 126, y1: 115, x2: cx + r * Math.cos(30 * Math.PI / 180) - 12, y2: cy + r * Math.sin(30 * Math.PI / 180),
      stroke: WARN, 'stroke-width': 1.4, 'stroke-dasharray': '4 4', opacity: 0.4 });
    feed.appendChild(anim('stroke-dashoffset', '16;0', '1s'));
    feed.appendChild(anim('opacity', '0.2;0.8;0.2', '6s', { begin: '2s' }));
    svg.appendChild(feed);
    card(host, 'CONSTITUTIONAL AI', 'critique and revise, no human',
      svg, 'Instead of paying humans for preference labels, the model grades itself. It drafts an answer, critiques that draft against a written constitution of principles, and revises. The revised pairs become the training signal, so most of the alignment work loops through the model itself.');
  }

  // ── loss-masking: assistant tokens contribute loss, prompt tokens are masked ─
  function lossMasking(host) {
    var W = 520, H = 200;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var seq = [
      { t: 'system', m: 0 }, { t: 'You', m: 0 }, { t: 'are', m: 0 }, { t: 'helpful', m: 0 },
      { t: 'user', m: 0 }, { t: 'capital?', m: 0 },
      { t: 'assistant', m: 1 }, { t: 'Paris', m: 1 }, { t: '.', m: 1 }
    ];
    var x0 = 14, bw = 52, gap = 6, ty = 70;
    seq.forEach(function (s, i) {
      var x = x0 + i * (bw + gap);
      var on = s.m === 1;
      svg.appendChild(svgEl('rect', { x: x, y: ty, width: bw, height: 34, rx: 4,
        fill: on ? 'var(--bg,#fafaf5)' : SOFT, stroke: on ? BP : MUTE, 'stroke-width': on ? 1.6 : 1 }));
      svg.appendChild(svgEl('text', { x: x + bw / 2, y: ty + 22, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
        'font-size': 9, fill: on ? BP : MUTE }, [document.createTextNode(s.t)]));
      // loss contribution column above each token
      var lossH = on ? 30 : 0;
      var bar = svgEl('rect', { x: x + 14, y: ty - 6, width: bw - 28, height: 4, rx: 2, fill: on ? BP : SOFT });
      if (on) {
        bar.setAttribute('y', String(ty - lossH));
        bar.setAttribute('height', '0');
        bar.appendChild(anim('height', '0;' + lossH + ';' + lossH + ';0', '3.5s', { keyTimes: '0;0.25;0.85;1', begin: (0.6 + (i - 6) * 0.18) + 's' }));
        bar.appendChild(anim('y', (ty) + ';' + (ty - lossH) + ';' + (ty - lossH) + ';' + ty, '3.5s', { keyTimes: '0;0.25;0.85;1', begin: (0.6 + (i - 6) * 0.18) + 's' }));
      }
      svg.appendChild(bar);
    });
    svg.appendChild(svgEl('text', { x: 14, y: 30, 'font-family': 'var(--font-mono,monospace)', 'font-size': 10, fill: BP }, [document.createTextNode('loss ↑ only on assistant tokens')]));
    svg.appendChild(svgEl('text', { x: 14, y: ty + 56, 'font-family': 'var(--font-mono,monospace)', 'font-size': 10, fill: MUTE }, [document.createTextNode('prompt tokens masked — gradient = 0')]));
    card(host, 'SFT LOSS MASKING', 'learn the reply, not the prompt',
      svg, 'A chat example contains system, user, and assistant turns, but the model should only be trained to produce the assistant turn. Loss masking zeroes the gradient on every prompt token so the model learns to answer rather than to memorize and replay the question.');
  }

  // ── activation-recompute: store a few checkpoints, recompute the rest ────────
  function activationRecompute(host) {
    var W = 520, H = 220;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var n = 8, bw = 46, gap = 10, x0 = 50, fy = 60, by = 140;
    svg.appendChild(svgEl('text', { x: 8, y: fy + 18, 'font-family': 'var(--font-mono,monospace)', 'font-size': 9, fill: MUTE }, [document.createTextNode('FWD')]));
    svg.appendChild(svgEl('text', { x: 8, y: by + 18, 'font-family': 'var(--font-mono,monospace)', 'font-size': 9, fill: BP }, [document.createTextNode('BWD')]));
    var ckpt = { 0: 1, 3: 1, 6: 1 }; // layers whose activations are kept
    for (var i = 0; i < n; i++) {
      var x = x0 + i * (bw + gap);
      var kept = ckpt[i];
      // forward pass: every layer computed, only checkpoints stay solid
      var f = svgEl('rect', { x: x, y: fy, width: bw, height: 30, rx: 3,
        fill: kept ? BP : SOFT, stroke: kept ? BP : MUTE, 'stroke-width': 1, opacity: kept ? 0.85 : 1 });
      if (!kept) {
        // non-checkpoint activations fade away (dropped to save memory)
        f.appendChild(anim('opacity', '1;1;0.12;0.12', '5s', { keyTimes: '0;0.28;0.36;1' }));
      }
      svg.appendChild(f);
      if (kept) svg.appendChild(svgEl('text', { x: x + bw / 2, y: fy - 6, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': 8, fill: BP }, [document.createTextNode('save')]));
      // backward pass slot
      svg.appendChild(svgEl('rect', { x: x, y: by, width: bw, height: 30, rx: 3, fill: 'none', stroke: SOFT, 'stroke-width': 1 }));
    }
    // backward sweep: recompute dropped layers from the nearest checkpoint, right to left
    var rc = svgEl('rect', { x: 0, y: by, width: bw, height: 30, rx: 3, fill: WARN, opacity: 0.5 });
    rc.appendChild(anim('x', (x0 + (n - 1) * (bw + gap)) + ';' + x0, '5s', { keyTimes: '0;1', begin: '0s', calcMode: 'linear' }));
    rc.appendChild(anim('opacity', '0;0;0.55;0.55;0', '5s', { keyTimes: '0;0.45;0.5;0.95;1' }));
    svg.appendChild(rc);
    svg.appendChild(svgEl('text', { x: W / 2, y: by + 52, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)',
      'font-size': 10, fill: MUTE }, [document.createTextNode('recompute dropped activations during backward')]));
    card(host, 'GRADIENT CHECKPOINTING', 'trade FLOPs for memory',
      svg, 'Backward needs the forward activations, but keeping them all blows the memory budget. Checkpointing saves only a few layers (solid) and discards the rest. During backward, each dropped segment is recomputed from the nearest checkpoint — a little extra compute buys a large drop in peak memory.');
  }

  LF.register({
    'expert-routing': expertRouting,
    'encoder-decoder': encoderDecoder,
    'rnn-vs-parallel': rnnVsParallel,
    'draft-verify-tokens': draftVerifyTokens,
    'multi-token-predict': multiTokenPredict,
    'self-critique-loop': selfCritiqueLoop,
    'loss-masking': lossMasking,
    'activation-recompute': activationRecompute
  });
})();
