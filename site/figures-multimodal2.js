/* figures-multimodal2.js — animated lesson figures for Phase 12 (multimodal AI),
   second set. Loads after lesson-figures.js, uses the shared LF toolkit, and
   registers via LF.register. No deps, ES5 only, theme via CSS vars. Each figure
   is a self-running SMIL animation (no JS loops, no real compute). Authoring is
   the same fenced ```figure block in docs/en.md. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function wrap(host, svg) { host.appendChild(el('div', { class: 'lf-out' }, [svg])); }
  function svgFor(h) { return svgEl('svg', { viewBox: '0 0 520 ' + h }); }
  function txt(x, y, s, anchor, color, size) {
    return svgEl('text', { x: String(x), y: String(y), 'text-anchor': anchor || 'middle', 'font-size': String(size || 10), 'font-family': 'monospace', fill: color || 'var(--ink-soft,#555)' }, [document.createTextNode(s)]);
  }
  function anim(attr, vals, kt, dur, extra) {
    var a = { attributeName: attr, values: vals, keyTimes: kt, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function cap(host, label, hint, text) {
    host.insertBefore(el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]), host.firstChild);
    host.appendChild(el('div', { class: 'lf-cap' }, [text]));
    host.classList.add('lf');
  }

  // ── mm-patch-n-pack: variable-res images flow into one packed sequence ───────
  function patchNPack(host) {
    var svg = svgFor(250), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)';
    var imgs = [
      { x: 18, y: 30, w: 70, h: 54, n: 4, col: B },     // landscape, 4 patches
      { x: 18, y: 96, w: 40, h: 80, n: 3, col: W },      // portrait, 3 patches
      { x: 18, y: 188, w: 56, h: 40, n: 2, col: B }      // small, 2 patches
    ];
    svg.appendChild(txt(53, 18, 'variable-resolution images', 'middle', 'var(--ink-mute,#777)', 10));
    svg.appendChild(txt(360, 18, 'one packed sequence (block-diagonal mask)', 'middle', 'var(--ink-mute,#777)', 10));
    var slot = 0, total = imgs.reduce(function (a, im) { return a + im.n; }, 0), seqX = 230, cw = 26;
    imgs.forEach(function (im, gi) {
      svg.appendChild(svgEl('rect', { x: im.x, y: im.y, width: im.w, height: im.h, fill: 'none', stroke: im.col, 'stroke-width': '1.4', 'stroke-opacity': '0.7' }));
      var k;
      for (k = 0; k < im.n; k++) {
        var cy = im.y + (k + 0.5) * im.h / im.n;
        var dot = svgEl('circle', { cx: im.x + im.w / 2, cy: cy.toFixed(1), r: '5', fill: im.col });
        var destX = seqX + slot * cw + cw / 2;
        var delay = (slot * 0.18).toFixed(2) + 's';
        dot.appendChild(anim('cx', (im.x + im.w / 2) + ';' + destX + ';' + destX, '0;0.5;1', '3.6s', { begin: delay }));
        dot.appendChild(anim('cy', cy.toFixed(1) + ';' + '128;128', '0;0.5;1', '3.6s', { begin: delay }));
        svg.appendChild(dot);
        slot++;
      }
    });
    // sequence track
    svg.appendChild(svgEl('rect', { x: seqX, y: 110, width: total * cw, height: 36, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    var s2;
    for (s2 = 1; s2 < total; s2++) {
      svg.appendChild(svgEl('line', { x1: seqX + s2 * cw, y1: 110, x2: seqX + s2 * cw, y2: 146, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '2 2' }));
    }
    svg.appendChild(txt(seqX + total * cw / 2, 166, total + ' patch tokens · 0 padding', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'PATCH-N-PACK', 'images stream into one sequence',
      'Each image keeps its native aspect ratio and contributes its own count of patches: a wide chart, a tall receipt, a small icon. Patch-n-pack concatenates all of them into a single transformer sequence with a block-diagonal mask, so an image only attends to its own patches. No square-resize, no padding tokens wasted.');
  }

  // ── mm-llava-projector: ViT patch dim 1024 maps through MLP to LLM dim 4096 ──
  function llavaProjector(host) {
    var svg = svgFor(220), B = 'var(--blueprint,#3553ff)';
    svg.appendChild(txt(60, 20, 'ViT patches', 'middle', 'var(--ink-mute,#777)', 10));
    svg.appendChild(txt(260, 20, '2-layer MLP', 'middle', 'var(--ink-mute,#777)', 10));
    svg.appendChild(txt(450, 20, 'LLM tokens', 'middle', 'var(--ink-mute,#777)', 10));
    var i;
    // left: short vectors (dim 1024)
    for (i = 0; i < 4; i++) {
      var ly = 50 + i * 38;
      svg.appendChild(svgEl('rect', { x: 30, y: ly, width: 60, height: 14, fill: B, 'fill-opacity': '0.7' }));
    }
    svg.appendChild(txt(60, 200, 'dim 1024', 'middle', 'var(--ink-soft,#555)', 10));
    // mlp box with pulsing fill
    var mlp = svgEl('rect', { x: 200, y: 50, width: 120, height: 142, rx: '4', fill: B, 'fill-opacity': '0.12', stroke: B, 'stroke-width': '1.4' });
    mlp.appendChild(anim('fill-opacity', '0.10;0.30;0.10', '0;0.5;1', '2.4s'));
    svg.appendChild(mlp);
    svg.appendChild(txt(260, 116, '1024 -> 4096', 'middle', B, 11));
    svg.appendChild(txt(260, 132, 'GELU -> 4096', 'middle', B, 11));
    // flowing token along path into the LLM
    for (i = 0; i < 4; i++) {
      var sy = 57 + i * 38, ey = 57 + i * 38;
      var p = svgEl('circle', { r: '4', fill: B });
      var mo = svgEl('animateMotion', { dur: '2.4s', repeatCount: 'indefinite', path: 'M 90 ' + sy + ' L 200 116 L 320 116 L 420 ' + ey, begin: (i * 0.3).toFixed(2) + 's' });
      p.appendChild(mo);
      svg.appendChild(p);
    }
    // right: long vectors (dim 4096)
    for (i = 0; i < 4; i++) {
      var ry = 50 + i * 38;
      svg.appendChild(svgEl('rect', { x: 400, y: ry, width: 100, height: 14, fill: B, 'fill-opacity': '0.85' }));
    }
    svg.appendChild(txt(450, 200, 'dim 4096', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'LLAVA PROJECTOR', 'patches become LLM tokens',
      'LLaVA replaced the Q-Former bottleneck with the simplest possible bridge: a 2-layer MLP that maps each frozen ViT patch embedding from the vision dimension up to the language model embedding dimension. Every patch becomes one token the LLM reads in its own input sequence, trained directly on the language-model loss. Simpler won.');
  }

  // ── mm-mrope-axes: three rotary axes (time, height, width) spin at own rate ──
  function mropeAxes(host) {
    var svg = svgFor(220), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)';
    var axes = [
      { cx: 100, label: 'temporal', col: B, dur: '6s' },
      { cx: 260, label: 'height', col: W, dur: '3.4s' },
      { cx: 420, label: 'width', col: 'var(--ink-mute,#999)', dur: '2s' }
    ];
    svg.appendChild(txt(260, 22, 'M-RoPE: one position, three rotations', 'middle', 'var(--ink-mute,#777)', 11));
    axes.forEach(function (a) {
      var cy = 110, r = 46;
      svg.appendChild(svgEl('circle', { cx: a.cx, cy: cy, r: r, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
      var g = svgEl('g', {});
      g.appendChild(svgEl('line', { x1: a.cx, y1: cy, x2: a.cx + r, y2: cy, stroke: a.col, 'stroke-width': '2.4' }));
      g.appendChild(svgEl('circle', { cx: a.cx + r, cy: cy, r: '4', fill: a.col }));
      g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 ' + a.cx + ' ' + cy, to: '-360 ' + a.cx + ' ' + cy, dur: a.dur, repeatCount: 'indefinite' }));
      svg.appendChild(g);
      svg.appendChild(txt(a.cx, cy + 70, a.label, 'middle', a.col, 11));
    });
    svg.appendChild(txt(260, 210, 'time slowest · width fastest', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'M-ROPE THREE AXES', 'time, height, width rotate apart',
      'Qwen2-VL gives every token a three-part position and rotates each part on its own axis: temporal, height, and width. The temporal axis turns slowly so a frame an hour later still sits at a distinct phase, while the spatial axes turn faster to encode a patch grid. One absolute-table-free scheme covers a single image, a multi-image batch, and a long video at once.');
  }

  // ── mm-video-token-budget: rising FPS multiplies tokens past the context line ─
  function videoTokenBudget(host) {
    var svg = svgFor(230), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)';
    var PAD = 40, W0 = 520, H0 = 230, baseY = 190, topY = 30;
    svg.appendChild(svgEl('line', { x1: PAD, y1: baseY, x2: W0 - 20, y2: baseY, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    svg.appendChild(svgEl('line', { x1: PAD, y1: baseY, x2: PAD, y2: topY, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    // context window ceiling line
    var ceil = 78;
    svg.appendChild(svgEl('line', { x1: PAD, y1: ceil, x2: W0 - 20, y2: ceil, stroke: W, 'stroke-width': '1.2', 'stroke-dasharray': '5 4' }));
    svg.appendChild(txt(W0 - 24, ceil - 5, 'context limit', 'end', W, 10));
    svg.appendChild(txt(PAD - 6, topY + 6, 'tokens', 'end', 'var(--ink-mute,#777)', 9));
    svg.appendChild(txt(W0 - 20, baseY + 16, 'frames per second', 'end', 'var(--ink-mute,#777)', 10));
    // growing bars, heights animate up to show multiplication with FPS
    var fps = [1, 2, 4, 8, 16], bw = 56, gap = 30;
    fps.forEach(function (f, i) {
      var bx = PAD + 24 + i * (bw + gap);
      var full = Math.min(baseY - topY, 14 * f + 18);
      var hh = full.toFixed(0);
      var bar = svgEl('rect', { x: bx, y: baseY, width: bw, height: '0', fill: full > (baseY - ceil) ? W : B, 'fill-opacity': '0.8' });
      var d = (i * 0.25).toFixed(2) + 's';
      bar.appendChild(anim('height', '0;' + hh, '0;1', '2.6s', { begin: d, fill: 'freeze' }));
      bar.appendChild(anim('y', baseY + ';' + (baseY - full).toFixed(0), '0;1', '2.6s', { begin: d, fill: 'freeze' }));
      svg.appendChild(bar);
      svg.appendChild(txt(bx + bw / 2, baseY + 16, f + ' fps', 'middle', 'var(--ink-soft,#555)', 10));
    });
    wrap(host, svg);
    cap(host, 'VIDEO TOKEN BUDGET', 'frames per second multiply tokens',
      'Visual tokens scale with sampled frames, and frames scale with FPS times duration. Doubling the sampling rate doubles the token count, so an hour-long clip races past any fixed context window. The three escape routes are brute-force million-token context, ring attention split across devices, and aggressive pooling or agentic retrieval that never loads the whole video at once.');
  }

  // ── mm-action-tokens: continuous joint signal snaps into 256 discrete bins ───
  function actionTokens(host) {
    var svg = svgFor(220), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)';
    var PAD = 40, W0 = 520, midY = 96;
    svg.appendChild(txt(W0 / 2, 20, 'continuous joint target -> discrete action token', 'middle', 'var(--ink-mute,#777)', 10));
    // continuous sine path (joint angle over time)
    var d = '', i;
    for (i = 0; i <= 120; i++) {
      var x = PAD + (W0 - 2 * PAD) * i / 120;
      var y = midY + 46 * Math.sin(i / 120 * Math.PI * 3);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.5' }));
    // horizontal bin gridlines
    var b;
    for (b = -2; b <= 2; b++) {
      var by = midY + b * 23;
      svg.appendChild(svgEl('line', { x1: PAD, y1: by, x2: W0 - PAD, y2: by, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '0.8' }));
    }
    // sampling points that snap from the curve to the nearest bin
    var samples = [10, 30, 50, 70, 90, 110];
    samples.forEach(function (si, k) {
      var x = PAD + (W0 - 2 * PAD) * si / 120;
      var cy = midY + 46 * Math.sin(si / 120 * Math.PI * 3);
      var binned = midY + Math.round((cy - midY) / 23) * 23;
      var dot = svgEl('circle', { cx: x.toFixed(1), cy: cy.toFixed(1), r: '4.5', fill: B });
      var overlay = svgEl('circle', { cx: x.toFixed(1), cy: cy.toFixed(1), r: '4.5', fill: W, 'fill-opacity': '0' });
      var bg = (k * 0.3).toFixed(2) + 's';
      var cyVals = cy.toFixed(1) + ';' + cy.toFixed(1) + ';' + binned.toFixed(1) + ';' + binned.toFixed(1);
      dot.appendChild(anim('cy', cyVals, '0;0.4;0.6;1', '3.2s', { begin: bg }));
      overlay.appendChild(anim('cy', cyVals, '0;0.4;0.6;1', '3.2s', { begin: bg }));
      overlay.appendChild(anim('fill-opacity', '0;0;1;1', '0;0.4;0.6;1', '3.2s', { begin: bg }));
      svg.appendChild(dot);
      svg.appendChild(overlay);
    });
    svg.appendChild(txt(W0 / 2, 200, '256 bins -> vocabulary IDs · 10 DOF = 10 tokens per step', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'ACTION TOKENIZATION', 'joints snap to discrete bins',
      'A vision-language-action model has to emit motor commands, but a transformer speaks in tokens. RT-2 discretizes each normalized joint target into one of 256 bins and maps the bin to a vocabulary ID, so a 10-DOF action becomes ten ordinary tokens. The same decoder that captions an image now writes a control trajectory, which is what lets web-scale knowledge transfer to the robot.');
  }

  // ── mm-doc-layout: a page resolves into typed layout regions one by one ──────
  function docLayout(host) {
    var svg = svgFor(250), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)', G = 'var(--ink-mute,#999)';
    // page outline
    svg.appendChild(svgEl('rect', { x: 150, y: 20, width: 220, height: 210, fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }));
    svg.appendChild(txt(260, 14, 'OCR-free model emits typed regions', 'middle', 'var(--ink-mute,#777)', 10));
    var regions = [
      { x: 162, y: 32, w: 196, h: 26, col: W, lab: 'title' },
      { x: 162, y: 66, w: 92, h: 96, col: B, lab: 'text' },
      { x: 264, y: 66, w: 94, h: 60, col: G, lab: 'figure' },
      { x: 264, y: 134, w: 94, h: 28, col: B, lab: 'text' },
      { x: 162, y: 170, w: 196, h: 50, col: W, lab: 'table' }
    ];
    regions.forEach(function (rg, i) {
      var box = svgEl('rect', { x: rg.x, y: rg.y, width: rg.w, height: rg.h, fill: rg.col, 'fill-opacity': '0', stroke: rg.col, 'stroke-width': '1.4', 'stroke-opacity': '0' });
      var bg = (i * 0.5).toFixed(2) + 's';
      box.appendChild(anim('stroke-opacity', '0;0;0.9;0.9', '0;0.45;0.55;1', '3.5s', { begin: bg }));
      box.appendChild(anim('fill-opacity', '0;0;0.12;0.12', '0;0.45;0.55;1', '3.5s', { begin: bg }));
      svg.appendChild(box);
      var lbl = svgEl('text', { x: (rg.x + 4).toFixed(0), y: (rg.y + 13).toFixed(0), 'font-size': '9', 'font-family': 'monospace', fill: rg.col, 'fill-opacity': '0' }, [document.createTextNode(rg.lab)]);
      lbl.appendChild(anim('fill-opacity', '0;0;0.95;0.95', '0;0.5;0.6;1', '3.5s', { begin: bg }));
      svg.appendChild(lbl);
    });
    svg.appendChild(txt(60, 130, 'text', 'middle', B, 11));
    svg.appendChild(txt(60, 150, 'layout', 'middle', W, 11));
    svg.appendChild(txt(60, 170, 'image', 'middle', G, 11));
    svg.appendChild(txt(60, 110, 'three streams', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'DOCUMENT LAYOUT', 'page resolves into typed regions',
      'A document is not a photo. Title, body text, figures, and tables each carry meaning from where they sit on the page. OCR-free models like Donut and Nougat read the page image and emit structured markup directly, while layout-aware encoders fuse three input streams at once: the text content, the bounding-box layout, and the image patches. The position of "Total: $1,245" is part of the answer.');
  }

  // ── mm-maxsim: query terms each grab their best-matching page patch ──────────
  function maxSim(host) {
    var svg = svgFor(240), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)';
    svg.appendChild(txt(110, 18, 'query term vectors', 'middle', 'var(--ink-mute,#777)', 10));
    svg.appendChild(txt(400, 18, 'page patch vectors', 'middle', 'var(--ink-mute,#777)', 10));
    var qY = [60, 110, 160], qX = 90;
    var patches = [];
    var pc, pr, idx = 0;
    for (pr = 0; pr < 4; pr++) {
      for (pc = 0; pc < 4; pc++) {
        patches.push({ x: 340 + pc * 34, y: 50 + pr * 34, i: idx++ });
      }
    }
    patches.forEach(function (p) {
      svg.appendChild(svgEl('rect', { x: p.x, y: p.y, width: 26, height: 26, fill: B, 'fill-opacity': '0.12', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '0.6' }));
    });
    var best = [5, 10, 14]; // each query term's argmax patch index
    var terms = ['Q3', 'revenue', 'chart'];
    qY.forEach(function (y, k) {
      svg.appendChild(svgEl('circle', { cx: qX, cy: y, r: '7', fill: W, 'fill-opacity': '0.85' }));
      svg.appendChild(txt(qX - 14, y + 4, terms[k], 'end', 'var(--ink-soft,#555)', 10));
      var tp = patches[best[k]];
      var tx = tp.x + 13, ty = tp.y + 13;
      // connector line that grows from query to its MaxSim patch
      var ln = svgEl('line', { x1: qX, y1: y, x2: qX, y2: y, stroke: W, 'stroke-width': '1.6', 'stroke-opacity': '0.7' });
      var bg = (k * 0.6).toFixed(2) + 's';
      ln.appendChild(anim('x2', qX + ';' + tx, '0;1', '3s', { begin: bg, fill: 'freeze' }));
      ln.appendChild(anim('y2', y + ';' + ty, '0;1', '3s', { begin: bg, fill: 'freeze' }));
      svg.appendChild(ln);
      // patch lights up as MaxSim winner
      var winner = svgEl('rect', { x: tp.x, y: tp.y, width: 26, height: 26, fill: W, 'fill-opacity': '0', stroke: W, 'stroke-width': '1.6', 'stroke-opacity': '0' });
      winner.appendChild(anim('fill-opacity', '0;0;0.55;0.55', '0;0.7;0.85;1', '3s', { begin: bg }));
      winner.appendChild(anim('stroke-opacity', '0;0;1;1', '0;0.7;0.85;1', '3s', { begin: bg }));
      svg.appendChild(winner);
    });
    svg.appendChild(txt(260, 224, 'score = sum over query terms of max patch similarity', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'LATE-INTERACTION MAXSIM', 'each term finds its best patch',
      'Text-RAG collapses a page into one vector and loses charts and tables. ColPali keeps one vector per image patch and one per query term, then scores by MaxSim: each query term takes the maximum similarity over all page patches, and the page score is the sum of those maxima. A query about a chart can latch onto the exact patch that holds it, with no OCR step in between.');
  }

  // ── mm-agent-loop: perceive -> reason -> act -> observe cycles forever ───────
  function agentLoop(host) {
    var svg = svgFor(240), B = 'var(--blueprint,#3553ff)', W = 'var(--warn,#b8870f)';
    var CX = 260, CY = 130, R = 78;
    var nodes = [
      { a: -90, lab: 'perceive', sub: 'screenshot' },
      { a: 0, lab: 'reason', sub: 'plan' },
      { a: 90, lab: 'act', sub: 'click (x,y)' },
      { a: 180, lab: 'observe', sub: 'new state' }
    ];
    svg.appendChild(txt(CX, 20, 'multimodal agent loop', 'middle', 'var(--ink-mute,#777)', 11));
    // ring
    svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
    var pts = nodes.map(function (n) {
      var rad = n.a * Math.PI / 180;
      return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad), lab: n.lab, sub: n.sub };
    });
    pts.forEach(function (p, i) {
      var node = svgEl('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: '8', fill: B });
      node.appendChild(anim('r', '8;12;8', '0;0.5;1', '4s', { begin: (i * 1).toFixed(0) + 's' }));
      svg.appendChild(node);
      var ly = p.y < CY ? p.y - 14 : p.y + 22;
      svg.appendChild(txt(p.x.toFixed(1), ly.toFixed(1), p.lab, 'middle', 'var(--ink-soft,#555)', 11));
      svg.appendChild(txt(p.x.toFixed(1), (ly + (p.y < CY ? -12 : 13)).toFixed(1), p.sub, 'middle', 'var(--ink-mute,#999)', 9));
    });
    // a token traveling around the cycle clockwise
    var path = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1) +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + pts[1].x.toFixed(1) + ' ' + pts[1].y.toFixed(1) +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + pts[2].x.toFixed(1) + ' ' + pts[2].y.toFixed(1) +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + pts[3].x.toFixed(1) + ' ' + pts[3].y.toFixed(1) +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    var trav = svgEl('circle', { r: '5', fill: W });
    trav.appendChild(svgEl('animateMotion', { dur: '4s', repeatCount: 'indefinite', path: path }));
    svg.appendChild(trav);
    svg.appendChild(txt(CX, 232, 'repeat until the task is done · errors compound', 'middle', 'var(--ink-soft,#555)', 10));
    wrap(host, svg);
    cap(host, 'AGENT LOOP', 'perceive, reason, act, observe',
      'A computer-use agent runs a cycle: perceive the screen, reason about the goal, emit a structured action such as a click coordinate or a typed string, then observe the resulting screenshot and go again. Every turn is one multimodal model call, and grounding to the right pixel is the hard part. Because mistakes carry into the next observation, recovery matters as much as the first plan.');
  }

  LF.register({
    'mm-patch-n-pack': patchNPack,
    'mm-llava-projector': llavaProjector,
    'mm-mrope-axes': mropeAxes,
    'mm-video-token-budget': videoTokenBudget,
    'mm-action-tokens': actionTokens,
    'mm-doc-layout': docLayout,
    'mm-maxsim': maxSim,
    'mm-agent-loop': agentLoop
  });
})();
