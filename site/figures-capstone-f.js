/* figures-capstone-f.js - animated lesson figures for Phase 19 capstone
   projects 12-17 and 20-23 (video scene index, MCP gate, speculative decode,
   safety stack, issue-to-PR, tutor loop, harness loop contract, tool registry
   validation, JSON-RPC framing, dispatcher retry). Loads after
   lesson-figures.js, registers through window.LF. SMIL motion only, ES5,
   no deps, theme via CSS vars. */
(function(){'use strict';var LF=window.LF;if(!LF){return;}
  var el = LF.el, svgEl = LF.svgEl;
  var EASE = '0.23 1 0.32 1';
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BLUE = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';

  function svg(h) { return svgEl('svg', { viewBox: '0 0 520 ' + h }); }
  function shell(host, label, sub, node, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [node])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '10', fill: fill || INK });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function box(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: fill || SURF, stroke: stroke || RULE, 'stroke-width': '1.3' });
  }
  function line(x1, y1, x2, y2, stroke, extra) {
    var a = { x1: x1, y1: y1, x2: x2, y2: y2, stroke: stroke || SOFT, 'stroke-width': '1.3' };
    if (extra) { for (var k in extra) { a[k] = extra[k]; } }
    return svgEl('line', a);
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) { for (var k in extra) { a[k] = extra[k]; } }
    return svgEl('animate', a);
  }
  function fade(node, dur, at) {
    node.appendChild(anim('opacity', '0;1;1', dur, { begin: at, keyTimes: '0;0.12;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1' }));
    return node;
  }
  // fade + grow entrance from 95% about (cx,cy), soft exit at loop end
  function pop(kids, cx, cy, dur, at) {
    var g = svgEl('g', { transform: 'translate(' + cx + ' ' + cy + ')' }, kids);
    g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;1;1', dur: dur, begin: at, repeatCount: 'indefinite', calcMode: 'spline', keySplines: EASE + ';0 0 1 1', keyTimes: '0;0.18;1' }));
    g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', additive: 'sum', values: (-cx) + ' ' + (-cy), dur: dur, begin: at, repeatCount: 'indefinite' }));
    g.appendChild(anim('opacity', '0;1;1;0', dur, { begin: at, keyTimes: '0;0.14;0.94;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1;0.4 0 1 1' }));
    return g;
  }
  function dot(r, fill) { return svgEl('circle', { r: r, fill: fill, cx: '0', cy: '0' }); }
  function mov(path, dur, extra) {
    var a = { path: path, dur: dur, repeatCount: 'indefinite' };
    if (extra) { for (var k in extra) { a[k] = extra[k]; } }
    return svgEl('animateMotion', a);
  }
  function arrows(s, id) {
    s.appendChild(svgEl('defs', {}, [svgEl('marker', { id: id, viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '6', markerHeight: '6', orient: 'auto' }, [svgEl('path', { d: 'M0 0 L8 4 L0 8 z', fill: SOFT })])]));
    return 'url(#' + id + ')';
  }

  // ── cf-scene-index (12): scenes fan into three vectors, query returns a window ─
  function sceneIndex(host) {
    var D = '5.5s', s = svg(260), i;
    var xs = [30, 112, 220, 290, 414], ws = [78, 104, 66, 120, 88];
    var strip = [txt(30, 22, 'scene segmentation', '9', MUTE, 'start')];
    for (i = 0; i < 5; i++) {
      strip.push(fade(box(xs[i], 32, ws[i], 26, i === 2 ? BLUE : SURF, i === 2 ? 'none' : RULE), D, (0.05 + i * 0.09) + 's'));
    }
    s.appendChild(pop(strip, 260, 45, D, '0s'));
    var chips = [], cx = [60, 205, 350], cl = ['caption emb', 'frame emb', 'transcript emb'];
    for (i = 0; i < 3; i++) {
      chips.push(line(253, 60, cx[i] + 55, 118, SOFT));
      chips.push(box(cx[i], 118, 110, 24));
      chips.push(txt(cx[i] + 55, 133, cl[i], '9'));
    }
    s.appendChild(pop(chips, 260, 130, D, '0.5s'));
    var idx = [box(190, 168, 140, 30), txt(260, 187, 'multi-vector index', '9')];
    for (i = 0; i < 3; i++) { idx.push(line(cx[i] + 55, 142, 200 + i * 60, 168, SOFT)); }
    s.appendChild(pop(idx, 260, 183, D, '0.9s'));
    s.appendChild(box(30, 214, 80, 26, BLUE, 'none'));
    s.appendChild(txt(70, 231, 'query', '10', BG));
    var q = dot('5', BLUE);
    q.appendChild(mov('M114 227 L200 186', D, { calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.55;0.72;1' }));
    q.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.55;0.6;0.74;1' }));
    s.appendChild(q);
    var br = svgEl('path', { d: 'M220 28 L220 20 L286 20 L286 28', fill: 'none', stroke: WARN, 'stroke-width': '1.5' });
    br.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.76;0.82;0.94;1' }));
    var bl = txt(253, 14, '(start, end)', '8', WARN);
    bl.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.76;0.82;0.94;1' }));
    s.appendChild(br); s.appendChild(bl);
    shell(host, 'SCENE-LEVEL VIDEO INDEX', 'three vectors per scene', s,
      'Ingest cuts the video into scenes, and every scene stores three vectors side by side: caption embedding, keyframe embedding, transcript embedding. A query fires against all three at once, results merge, and the answer comes back as a (start, end) window inside the top scene rather than a whole file.');
  }

  // ── cf-mcp-gate (13): stateless metadata, policy, registry and live discovery ─
  function mcpGate(host) {
    var D = '5s', s = svg(250);
    s.appendChild(pop([box(24, 44, 92, 40), txt(70, 62, 'MCP client', '9'), txt(70, 76, 'version + caps', '8', MUTE)], 70, 64, D, '0s'));
    s.appendChild(pop([box(404, 44, 92, 40), txt(450, 62, 'MCP server', '9'), txt(450, 76, 'stateless', '8', MUTE)], 450, 64, D, '0.15s'));
    var pipe = line(116, 64, 404, 64, SOFT, { 'stroke-dasharray': '6 5' });
    pipe.appendChild(anim('stroke-dashoffset', '22;0', '1.4s'));
    s.appendChild(pipe);
    s.appendChild(txt(258, 30, 'one POST per JSON-RPC message', '8', MUTE));
    var gr = svgEl('rect', { x: 252, y: 42, width: 10, height: 44, rx: 2, fill: WARN });
    gr.appendChild(anim('opacity', '1;1;0.3;1;1', D, { keyTimes: '0;0.24;0.28;0.34;1' }));
    s.appendChild(pop([gr, txt(257, 100, 'auth + policy', '8', WARN)], 257, 64, D, '0.3s'));
    var p1 = dot('5', BLUE);
    p1.appendChild(mov('M116 58 L404 58', D, { calcMode: 'linear', keyPoints: '0;0.48;0.48;1;1', keyTimes: '0;0.2;0.32;0.5;1' }));
    p1.appendChild(anim('opacity', '0;1;1;0;0', D, { keyTimes: '0;0.04;0.5;0.56;1' }));
    s.appendChild(p1);
    var p2 = dot('5', WARN);
    p2.appendChild(mov('M116 70 L257 70 L257 140', D, { begin: '2.4s', calcMode: 'linear', keyPoints: '0;0.668;0.668;1;1', keyTimes: '0;0.15;0.25;0.4;1' }));
    p2.appendChild(anim('opacity', '0;1;1;1;0;0', D, { begin: '2.4s', keyTimes: '0;0.03;0.3;0.38;0.44;1' }));
    s.appendChild(p2);
    var ok = txt(257, 190, 'actor + tool + args + expiry', '8', WARN);
    ok.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.85;0.9;0.98;1' }));
    s.appendChild(pop([box(197, 146, 120, 28), txt(257, 163, 'approval record', '9'), ok], 257, 160, D, '0.45s'));
    var reg = [box(40, 170, 110, 30), txt(95, 184, 'registry', '9'), txt(95, 196, 'server.json', '7', MUTE),
      line(150, 185, 430, 86, SOFT, { 'stroke-dasharray': '4 3' }),
      txt(300, 152, 'live server/discover probe', '8', MUTE)];
    s.appendChild(pop(reg, 95, 185, D, '0.6s'));
    var poll = dot('3.5', MUTE);
    poll.appendChild(mov('M150 185 L430 86', D, { begin: '0.9s', calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.22;1' }));
    poll.appendChild(anim('opacity', '0;1;0;0', D, { begin: '0.9s', keyTimes: '0;0.06;0.24;1' }));
    s.appendChild(poll);
    shell(host, 'STATELESS MCP GATE + REGISTRY', 'metadata and authority checked per request', s,
      'Each JSON-RPC message gets its own POST and carries protocol version plus client capabilities. The gate validates issuer, audience, scope, tool, and arguments; a consequential call also needs an approval record bound to that exact action. The registry indexes server.json publication metadata, while a separate server/discover probe verifies what the live endpoint supports.');
  }

  // ── cf-spec-decode (14): draft proposes k tokens, one verify pass accepts a prefix ─
  function specDecode(host) {
    var D = '5.5s', s = svg(240), i;
    s.appendChild(pop([box(24, 96, 88, 40), txt(68, 113, 'draft head', '9'), txt(68, 127, 'k tokens', '8', MUTE), line(112, 116, 146, 116, SOFT)], 68, 116, D, '0s'));
    s.appendChild(pop([box(185, 20, 150, 30), txt(260, 39, 'target verify pass', '9'), line(260, 50, 260, 92, SOFT, { 'stroke-dasharray': '4 3' })], 260, 35, D, '0.15s'));
    var words = ['def', 'main', '(', ')', ':'], tiles = [];
    for (i = 0; i < 5; i++) {
      var tx = 150 + i * 62, rej = i > 2, e1 = 0.06 + i * 0.045, e2 = e1 + 0.05;
      var g = svgEl('g', {}, [box(tx, 100, 52, 32), txt(tx + 26, 120, words[i], '10')]);
      g.appendChild(anim('opacity', rej ? '0;0;1;1;0.15;0.15' : '0;0;1;1', D,
        { keyTimes: rej ? '0;' + e1 + ';' + e2 + ';0.62;0.7;1' : '0;' + e1 + ';' + e2 + ';1', calcMode: 'spline', keySplines: rej ? '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1;0 0 1 1' : '0 0 1 1;' + EASE + ';0 0 1 1' }));
      tiles.push(g);
      if (!rej) {
        var ov = box(tx, 100, 52, 32, 'none', BLUE);
        ov.setAttribute('stroke-width', '2');
        ov.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;' + (0.36 + i * 0.06) + ';' + (0.4 + i * 0.06) + ';1' }));
        tiles.push(ov);
      }
    }
    s.appendChild(pop(tiles, 300, 116, D, '0.25s'));
    var sweep = box(150, 94, 52, 44, 'none', BLUE);
    sweep.setAttribute('stroke-width', '1.8');
    sweep.appendChild(anim('x', '150;150;398;398', D, { keyTimes: '0;0.3;0.55;1' }));
    sweep.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.28;0.32;0.55;0.6;1' }));
    s.appendChild(sweep);
    var rs = svgEl('g', {}, [box(336, 100, 52, 32, WARN, 'none'), txt(362, 120, 'ret', '10', BG)]);
    rs.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.74;0.8;0.94;1' }));
    s.appendChild(rs);
    var rj = txt(438, 158, 'rejected, resampled', '8', WARN);
    rj.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.66;0.72;0.94;1' }));
    s.appendChild(rj);
    var sum = txt(150, 192, '3 of 5 accepted in one target pass', '9', MUTE, 'start');
    sum.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.5;0.6;1' }));
    s.appendChild(sum);
    shell(host, 'SPECULATIVE DECODING', 'draft proposes, target verifies once', s,
      'The draft head proposes five candidate tokens; the target model scores all of them in a single verify pass. The accepted prefix replaces three sequential decode steps, the rejected suffix is dropped and resampled. Acceptance rate sets the speedup, and the larger verify pass on rejection is exactly why p99 latency needs its own report.');
  }

  // ── cf-safety-stack (15): five layers, one request passes, one attack deflects ─
  function safetyStack(host) {
    var D = '5.5s', s = svg(270), i;
    var names = ['input sanitize', 'rails / policy', 'classifier gate', 'target model', 'output filter'];
    var stack = [];
    for (i = 0; i < 5; i++) {
      var y = 24 + i * 34, model = i === 3, gate = i === 2;
      stack.push(fade(box(150, y, 220, 26, model ? BLUE : SURF, model ? 'none' : (gate ? WARN : RULE)), D, (i * 0.08) + 's'));
      stack.push(fade(txt(260, y + 17, names[i], '9', model ? BG : INK), D, (i * 0.08) + 's'));
    }
    s.appendChild(pop(stack, 260, 105, D, '0s'));
    var safe = dot('5', BLUE);
    safe.appendChild(mov('M260 8 L260 200', D, { calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.1;0.6;1' }));
    safe.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.1;0.14;0.56;0.62;1' }));
    s.appendChild(safe);
    var atk = dot('5', WARN);
    atk.appendChild(mov('M310 8 L310 105 L430 105', D, { calcMode: 'linear', keyPoints: '0;0;0.447;0.447;1;1', keyTimes: '0;0.3;0.5;0.56;0.72;1' }));
    atk.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.3;0.34;0.7;0.76;1' }));
    s.appendChild(atk);
    var flash = box(150, 92, 220, 26, 'none', WARN);
    flash.setAttribute('stroke-width', '2');
    flash.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.48;0.53;0.6;1' }));
    s.appendChild(flash);
    var blk = txt(436, 100, 'blocked', '9', WARN, 'start');
    blk.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.62;0.68;0.9;1' }));
    s.appendChild(blk);
    [0, 2, 4].forEach(function (j, n) {
      var py = 37 + j * 34;
      var pr = line(470, py, 376, py, WARN, { 'stroke-dasharray': '4 3' });
      pr.appendChild(anim('opacity', '0.15;1;0.15', '2.2s', { begin: (n * 0.5) + 's' }));
      s.appendChild(pr);
    });
    s.appendChild(txt(496, 228, 'red-team probes: garak · PyRIT', '8', WARN, 'end'));
    var hitl = [line(340, 186, 352, 196, SOFT, { 'stroke-dasharray': '3 3' }), box(300, 196, 130, 26), txt(365, 213, 'HITL queue', '9')];
    s.appendChild(pop(hitl, 365, 209, D, '0.55s'));
    shell(host, 'LAYERED SAFETY HARNESS', 'five layers around one model', s,
      'A clean request falls straight through: sanitize, rails, classifier gate, model, output filter. A jailbreak makes it two layers deep before the classifier gate catches and deflects it. The red-team range keeps probing every layer from outside, and anything the output filter flags as high risk detours to the human review queue.');
  }

  // ── cf-issue-to-pr (16): label to review-ready PR through sandbox and CI gate ─
  function issuePr(host) {
    var D = '5.5s', s = svg(240);
    var m = arrows(s, 'cf-a16');
    s.appendChild(pop([box(24, 60, 88, 40), txt(68, 77, 'issue', '9'), txt(68, 91, '@agent fix', '8', MUTE)], 68, 80, D, '0s'));
    s.appendChild(pop([box(142, 60, 92, 40), txt(188, 84, 'dispatcher', '9'), txt(188, 50, 'App webhook', '8', MUTE),
      box(142, 110, 92, 6), svgEl('rect', { x: 142, y: 110, width: 55, height: 6, rx: 2, fill: BLUE }),
      txt(142, 128, 'budget 3/5 today', '8', MUTE, 'start')], 188, 80, D, '0.12s'));
    var tb = svgEl('rect', { x: 272, y: 88, width: 0, height: 6, rx: 2, fill: BLUE });
    tb.appendChild(anim('width', '0;0;80;80', D, { keyTimes: '0;0.35;0.6;1' }));
    s.appendChild(pop([box(264, 60, 96, 40), txt(312, 78, 'sandbox', '9'), txt(312, 50, 'clone · build · test', '8', MUTE),
      box(272, 88, 80, 6), tb], 312, 80, D, '0.24s'));
    s.appendChild(pop([svgEl('path', { d: 'M398 64 L414 80 L398 96 L382 80 z', fill: SURF, stroke: BLUE, 'stroke-width': '1.3' }),
      txt(398, 84, 'CI', '8')], 398, 80, D, '0.36s'));
    var pf = box(432, 60, 64, 40, 'none', BLUE);
    pf.setAttribute('stroke-width', '2');
    pf.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.88;0.92;0.98;1' }));
    var pl = txt(464, 118, 'review-ready', '8', BLUE);
    pl.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.88;0.92;0.98;1' }));
    s.appendChild(pop([box(432, 60, 64, 40), txt(464, 84, 'PR', '10'), pf, pl], 464, 80, D, '0.48s'));
    [[112, 142], [234, 264], [360, 382], [414, 432]].forEach(function (c) {
      s.appendChild(line(c[0], 80, c[1] - 4, 80, SOFT, { 'marker-end': m }));
    });
    var pk = dot('5', BLUE);
    pk.appendChild(mov('M28 80 L462 80', D, { calcMode: 'linear', keyPoints: '0;0.369;0.369;0.654;0.654;0.852;1', keyTimes: '0;0.15;0.22;0.33;0.62;0.75;1' }));
    pk.appendChild(anim('opacity', '0;1;1;0;0', D, { keyTimes: '0;0.03;0.86;0.92;1' }));
    s.appendChild(pk);
    s.appendChild(txt(28, 225, 'branch protection: no direct writes to main · no force-push', '8', MUTE, 'start'));
    shell(host, 'ISSUE-TO-PR PIPELINE', 'label in, review-ready PR out', s,
      'A labeled issue fires the GitHub App webhook; the dispatcher checks the per-repo daily budget before enqueueing. The sandbox reproduces the build from scratch and holds the task until the full test suite passes. Only a green CI gate opens the PR, and branch protection, not agent goodwill, forbids force-push.');
  }

  // ── cf-tutor-loop (17): Socratic exchange feeds mastery bars on the graph ──
  function tutorLoop(host) {
    var D = '5.5s', s = svg(250), i;
    var m = arrows(s, 'cf-a17');
    s.appendChild(pop([box(30, 44, 92, 36), txt(76, 66, 'learner', '9')], 76, 62, D, '0s'));
    s.appendChild(pop([box(30, 156, 92, 36), txt(76, 172, 'tutor policy', '9'), txt(76, 186, 'Socratic', '8', MUTE)], 76, 174, D, '0.12s'));
    s.appendChild(line(60, 84, 60, 148, SOFT, { 'marker-end': m }));
    s.appendChild(line(92, 152, 92, 92, SOFT, { 'marker-end': m }));
    s.appendChild(txt(54, 121, 'answer', '7', MUTE, 'end'));
    s.appendChild(txt(98, 121, 'hint', '7', MUTE, 'start'));
    var ad = dot('4', BLUE);
    ad.appendChild(mov('M60 84 L60 148', D, { calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.14;1' }));
    ad.appendChild(anim('opacity', '0;1;0;0', D, { keyTimes: '0;0.06;0.16;1' }));
    s.appendChild(ad);
    var hd = dot('4', WARN);
    hd.appendChild(mov('M92 152 L92 88', D, { begin: '1.4s', calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.14;1' }));
    hd.appendChild(anim('opacity', '0;1;0;0', D, { begin: '1.4s', keyTimes: '0;0.06;0.16;1' }));
    s.appendChild(hd);
    var graph = [line(122, 170, 224, 80, SOFT, { 'stroke-dasharray': '4 3' }), txt(180, 138, 'graph walk', '8', MUTE)];
    var cxs = [240, 330, 420];
    for (i = 0; i < 3; i++) {
      graph.push(svgEl('circle', { cx: cxs[i], cy: 70, r: '16', fill: SURF, stroke: RULE, 'stroke-width': '1.3' }));
      graph.push(txt(cxs[i], 74, 'c' + (i + 1), '9'));
      graph.push(box(cxs[i] - 18, 96, 36, 5));
      if (i < 2) { graph.push(line(cxs[i] + 16, 70, cxs[i + 1] - 20, 70, SOFT, { 'marker-end': m })); }
    }
    var mb = svgEl('rect', { x: 222, y: 96, width: 0, height: 5, rx: 2, fill: BLUE });
    mb.appendChild(anim('width', '0;12;12;24;24;36;36', D, { keyTimes: '0;0.12;0.28;0.4;0.56;0.68;1' }));
    graph.push(mb);
    var ring = svgEl('circle', { cx: 330, cy: 70, r: '20', fill: 'none', stroke: BLUE, 'stroke-width': '1.6' });
    ring.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.7;0.78;1' }));
    graph.push(ring);
    var nx = txt(330, 40, 'next concept', '8', BLUE);
    nx.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.7;0.78;1' }));
    graph.push(nx);
    s.appendChild(pop(graph, 330, 90, D, '0.3s'));
    s.appendChild(txt(28, 232, 'mastery update after every interaction (knowledge tracing)', '8', MUTE, 'start'));
    shell(host, 'SOCRATIC LOOP + LEARNER MODEL', 'each exchange moves a mastery bar', s,
      'The tutor never dumps the answer: every learner reply comes back as a leading question or a scaffolded hint. Each exchange updates the mastery probability for the active concept, and when the bar fills, the policy walks the prerequisite edge in the curriculum graph and lights up the next concept.');
  }

  // ── cf-loop-contract (20): a token walks the six-state machine, events tick out ─
  function loopContract(host) {
    var D = '6s', s = svg(260), i;
    var m = arrows(s, 'cf-a20');
    var st = [['IDLE', 30, 40, 64], ['PLANNING', 140, 24, 86], ['EXECUTING', 270, 40, 92], ['AWAITING_TOOL', 392, 96, 104], ['REFLECTING', 268, 152, 92], ['DONE', 70, 152, 60]];
    var pulses = ['0.55s', '1.15s', '1.9s', '2.65s', '3.4s', '5.5s'];
    var nodes = [];
    for (i = 0; i < st.length; i++) {
      var b = st[i], done = i === 5;
      nodes.push(fade(box(b[1], b[2], b[3], 26, done ? BLUE : SURF, done ? 'none' : RULE), D, (i * 0.07) + 's'));
      nodes.push(fade(txt(b[1] + b[3] / 2, b[2] + 17, b[0], '9', done ? BG : INK), D, (i * 0.07) + 's'));
      var ov = box(b[1], b[2], b[3], 26, 'none', BLUE);
      ov.setAttribute('stroke-width', '2');
      ov.appendChild(anim('opacity', '0;1;0;0', D, { begin: pulses[i], keyTimes: '0;0.04;0.1;1' }));
      nodes.push(ov);
    }
    [[94, 60, 140, 46], [226, 42, 270, 50], [362, 60, 400, 96], [428, 122, 336, 152], [300, 152, 310, 66], [268, 165, 130, 165]].forEach(function (e) {
      nodes.push(line(e[0], e[1], e[2], e[3], SOFT, { 'marker-end': m }));
    });
    s.appendChild(pop(nodes, 260, 100, D, '0s'));
    var tk = dot('5', BLUE);
    tk.appendChild(mov('M62 53 L183 37 L316 53 L444 109 L314 165 L316 53 L444 109 L314 165 L100 165', D));
    tk.appendChild(anim('opacity', '0;1;1;0', D, { keyTimes: '0;0.04;0.96;1' }));
    s.appendChild(tk);
    s.appendChild(line(30, 214, 490, 214, RULE));
    for (i = 0; i < 8; i++) {
      var t = 0.1 + i * 0.115;
      var tick = svgEl('rect', { x: 40 + i * 56, y: 208, width: 4, height: 12, rx: 1, fill: BLUE });
      tick.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;' + t.toFixed(2) + ';' + (t + 0.03).toFixed(2) + ';1' }));
      s.appendChild(tick);
    }
    s.appendChild(txt(30, 236, 'typed event stream', '8', MUTE, 'start'));
    s.appendChild(txt(490, 236, 'budget: turns · tool calls · wall-clock', '8', MUTE, 'end'));
    shell(host, 'HARNESS LOOP CONTRACT', 'six states, one auditable walk', s,
      'The loop is a deterministic state machine, not a chat while-loop. One run token walks IDLE through PLANNING, EXECUTING, AWAITING_TOOL, and REFLECTING, takes the inner execute-reflect cycle as many turns as the budget allows, and lands in DONE. Every transition emits a typed event on the stream, so UIs and tracers subscribe instead of inspecting the loop.');
  }

  // ── cf-registry-validate (21): bad args bounce with a json-pointer, good args reach the handler ─
  function registryValidate(host) {
    var D = '5.5s', s = svg(240);
    s.appendChild(pop([box(24, 88, 80, 40), txt(64, 112, 'model', '9')], 64, 108, D, '0s'));
    var sr = box(194, 92, 132, 24, SURF, BLUE);
    s.appendChild(pop([box(180, 36, 160, 140, BG, RULE), txt(260, 52, 'tool registry', '9'),
      box(194, 62, 132, 24), txt(260, 77, 'name', '8'),
      sr, txt(260, 107, 'schema check', '8'),
      box(194, 122, 132, 24), txt(260, 137, 'handler ref', '8'),
      txt(260, 166, 'no silent overwrite', '7', MUTE)], 260, 106, D, '0.15s'));
    s.appendChild(pop([box(416, 88, 80, 40), txt(456, 112, 'handler', '9')], 456, 108, D, '0.3s'));
    var c1 = dot('4.5', WARN);
    c1.appendChild(mov('M104 100 L194 104', D, { calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.12;1' }));
    c1.appendChild(anim('opacity', '0;1;1;0;0', D, { keyTimes: '0;0.02;0.12;0.16;1' }));
    s.appendChild(c1);
    var f1 = box(194, 92, 132, 24, 'none', WARN);
    f1.setAttribute('stroke-width', '2');
    f1.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.13;0.18;0.24;1' }));
    s.appendChild(f1);
    var b1 = dot('4.5', WARN);
    b1.appendChild(mov('M194 104 L104 84', D, { calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.2;0.32;1' }));
    b1.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.2;0.3;0.34;1' }));
    s.appendChild(b1);
    var er = txt(28, 74, '/args/limit: expected integer', '8', WARN, 'start');
    er.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.24;0.3;0.48;1' }));
    s.appendChild(er);
    var c2 = dot('4.5', BLUE);
    c2.appendChild(mov('M104 112 L416 112', D, { calcMode: 'linear', keyPoints: '0;0;0.288;0.288;1;1', keyTimes: '0;0.5;0.58;0.66;0.8;1' }));
    c2.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.5;0.53;0.79;0.83;1' }));
    s.appendChild(c2);
    var f2 = box(194, 92, 132, 24, 'none', BLUE);
    f2.setAttribute('stroke-width', '2');
    f2.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.6;0.66;0.72;1' }));
    s.appendChild(f2);
    var hp = box(416, 88, 80, 40, 'none', BLUE);
    hp.setAttribute('stroke-width', '2');
    hp.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.8;0.85;0.94;1' }));
    s.appendChild(hp);
    s.appendChild(txt(28, 220, 'schema is data, handler is code: the validator never touches I/O', '8', MUTE, 'start'));
    shell(host, 'REGISTRY + SCHEMA GATE', 'validate before any handler runs', s,
      'The registry pins name to schema to handler once, and the dispatcher trusts it afterwards. A bad call never reaches the handler: the schema check bounces it back with a json-pointer path the model can fix in one round trip. The corrected call passes the same pure validator and only then touches code.');
  }

  // ── cf-jsonrpc-frames (22): one JSON frame per line, ids pair the traffic ──
  function jsonrpcFrames(host) {
    var D = '6s', s = svg(250);
    s.appendChild(line(80, 36, 80, 224, SOFT));
    s.appendChild(line(440, 36, 440, 224, SOFT));
    s.appendChild(txt(80, 26, 'client', '9'));
    s.appendChild(txt(440, 26, 'server', '9'));
    s.appendChild(txt(260, 26, 'one frame per \\n line', '8', MUTE));
    function frame(y, label, stroke, begin, toLeft) {
      var x0 = toLeft ? 230 : 90;
      var g = svgEl('g', {}, [box(x0, y, 200, 18, SURF, stroke), txt(x0 + 6, y + 13, label, '8', INK, 'start')]);
      g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;' + (toLeft ? -150 : 150) + ' 0;' + (toLeft ? -150 : 150) + ' 0', dur: D, begin: begin, repeatCount: 'indefinite', calcMode: 'spline', keySplines: EASE + ';0 0 1 1', keyTimes: '0;0.14;1' }));
      g.appendChild(anim('opacity', '0;1;1;0;0', D, { begin: begin, keyTimes: '0;0.04;0.16;0.2;1', calcMode: 'spline', keySplines: EASE + ';0 0 1 1;0.4 0 1 1;0 0 1 1' }));
      s.appendChild(g);
    }
    frame(44, '{"id":7,"method":"tools/call"}', BLUE, '0s', false);
    frame(74, '{"id":7,"result":{...}}', BLUE, '0.9s', true);
    frame(104, '{"method":"progress"}', RULE, '1.9s', false);
    var no = txt(90, 134, 'notification: no id, no reply', '8', MUTE, 'start');
    no.appendChild(anim('opacity', '0;0;1;1;0', D, { begin: '1.9s', keyTimes: '0;0.1;0.16;0.3;1' }));
    s.appendChild(no);
    frame(140, '{"id":9,"met###', WARN, '3.1s', false);
    frame(170, '{"id":null,"error":{"code":-32700}}', WARN, '3.9s', true);
    frame(200, '{"id":10,"method":"ping"}', RULE, '4.7s', false);
    var cont = txt(260, 240, 'one bad line, stream survives', '8', MUTE);
    cont.appendChild(anim('opacity', '0;0;1;1', D, { begin: '4.7s', keyTimes: '0;0.08;0.14;1' }));
    s.appendChild(cont);
    shell(host, 'JSON-RPC OVER STDIO', 'newline-delimited frames', s,
      'Every message is one JSON object on one line. A request carries an id and gets exactly one response with the same id; a notification carries no id and must get nothing back. A garbled line earns a -32700 parse error with id null, and the very next line parses normally: one bad frame never poisons the stream.');
  }

  // ── cf-dispatch-retry (23): timeout, backoff with jitter, dedupe, one envelope ─
  function dispatchRetry(host) {
    var D = '6s', s = svg(250);
    var m = arrows(s, 'cf-a23');
    s.appendChild(pop([box(24, 28, 96, 34), txt(72, 49, 'harness loop', '9')], 72, 45, D, '0s'));
    s.appendChild(pop([box(150, 20, 240, 50, SURF, BLUE), txt(270, 40, 'dispatcher', '10'), txt(270, 56, 'timeout · retry · dedupe', '8', MUTE)], 270, 45, D, '0.12s'));
    s.appendChild(pop([box(420, 28, 80, 34), txt(460, 49, 'handler', '9')], 460, 45, D, '0.24s'));
    s.appendChild(line(120, 45, 146, 45, SOFT, { 'marker-end': m }));
    s.appendChild(line(390, 45, 416, 45, SOFT, { 'marker-end': m }));
    s.appendChild(line(60, 168, 490, 168, RULE));
    s.appendChild(txt(60, 184, 't', '8', MUTE, 'start'));
    function attempt(x, w, ok, t0, t1, label) {
      var r = svgEl('rect', { x: x, y: 150, width: 0, height: 14, rx: 2, fill: ok ? BLUE : SURF, stroke: ok ? 'none' : RULE, 'stroke-width': '1.3' });
      r.appendChild(anim('width', '0;0;' + w + ';' + w, D, { keyTimes: '0;' + t0 + ';' + t1 + ';1' }));
      s.appendChild(r);
      s.appendChild(txt(x + w / 2, 144, label, '7', MUTE));
      if (!ok) {
        var g = svgEl('g', {}, [line(x + w - 6, 147, x + w + 6, 161, WARN), line(x + w + 6, 147, x + w - 6, 161, WARN)]);
        g.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;' + (t1 + 0.01) + ';' + (t1 + 0.05) + ';1' }));
        s.appendChild(g);
      }
    }
    attempt(70, 70, false, 0.05, 0.2, 'attempt 1');
    attempt(158, 70, false, 0.3, 0.45, 'attempt 2');
    attempt(264, 56, true, 0.58, 0.7, 'attempt 3');
    var okc = svgEl('circle', { cx: 334, cy: 157, r: '7', fill: 'none', stroke: BLUE, 'stroke-width': '1.6' });
    okc.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.71;0.75;1' }));
    s.appendChild(okc);
    s.appendChild(txt(149, 184, '1s', '7', MUTE));
    s.appendChild(txt(246, 184, '2s + jitter', '7', MUTE));
    var gh = svgEl('g', {}, [box(158, 124, 70, 14, 'none', WARN), txt(193, 120, 'dup, key a1f3', '7', WARN)]);
    gh.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;0 0;0 22;0 22', dur: D, keyTimes: '0;0.38;0.47;1', repeatCount: 'indefinite' }));
    gh.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.32;0.38;0.48;1' }));
    s.appendChild(gh);
    s.appendChild(txt(105, 132, 'key a1f3', '7', MUTE));
    var env = svgEl('g', {}, [box(360, 100, 130, 24, BG, BLUE), txt(425, 116, 'typed result envelope', '8'),
      line(360, 110, 124, 60, BLUE, { 'stroke-dasharray': '4 3' })]);
    env.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.76;0.83;1' }));
    s.appendChild(env);
    s.appendChild(txt(490, 234, 'parallel dispatch capped: max in-flight', '8', MUTE, 'end'));
    shell(host, 'DISPATCHER SEAM', 'timeout, backoff, dedupe, one envelope', s,
      'Attempt one runs to its per-call timeout and returns a typed error instead of hanging the loop. Backoff doubles with jitter before each retry, and a duplicate that races the in-flight attempt collapses into it on the idempotency key. Whatever happens, the loop receives one envelope shape: result or mapped error, never a raw stack trace.');
  }

  LF.register({
    'cf-scene-index': sceneIndex,
    'cf-mcp-gate': mcpGate,
    'cf-spec-decode': specDecode,
    'cf-safety-stack': safetyStack,
    'cf-issue-to-pr': issuePr,
    'cf-tutor-loop': tutorLoop,
    'cf-loop-contract': loopContract,
    'cf-registry-validate': registryValidate,
    'cf-jsonrpc-frames': jsonrpcFrames,
    'cf-dispatch-retry': dispatchRetry
  });
})();
