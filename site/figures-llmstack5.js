/* figures-llmstack5.js: SMIL-animated lesson figures for Phase 10 (LLMs from
   scratch), Phase 11 (LLM engineering) and Phase 12 (multimodal AI).
   Loads after lesson-figures.js and registers through window.LF.register.
   Vanilla ES5, no deps, theme via CSS vars. Each figure is a self-driving
   animated SVG (SMIL only, no JS loops driving frames). Authoring:
       ```figure
       l5-data-pipeline
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BP = 'var(--blueprint,#3553ff)';
  var INK = 'var(--ink,#1a1a1a)';
  var SOFT = 'var(--ink-soft,#555)';
  var MUTE = 'var(--ink-mute,#777)';
  var RULE = 'var(--rule-soft,#ddd)';
  var SURF = 'var(--bg-surface,#eee)';
  var WARN = 'var(--warn,#b8870f)';
  var MONO = 'var(--font-mono,monospace)';
  var EASE = '0.23 1 0.32 1';

  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) { for (var k in extra) { a[k] = extra[k]; } }
    return svgEl('animate', a);
  }
  function txt(x, y, s, size, fill, anchor) {
    var a = { x: x, y: y, 'font-family': MONO, 'font-size': size, fill: fill };
    if (anchor) { a['text-anchor'] = anchor; }
    var t = svgEl('text', a);
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function box(x, y, w, h, stroke, fill, sw) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: 4, fill: fill || 'none', stroke: stroke, 'stroke-width': sw || 1.3 });
  }
  // One-shot mount entry: fade in from opacity 0 while growing 95% -> 100%
  // about the figure center (cx, cy). Runs once, then the loops take over.
  function entry(g, cx, cy) {
    var common = { dur: '0.7s', begin: '0s', fill: 'freeze', repeatCount: '1', calcMode: 'spline', keyTimes: '0;1', keySplines: EASE };
    g.setAttribute('opacity', '0');
    var o = { attributeName: 'opacity', values: '0;1' }, k;
    for (k in common) { o[k] = common[k]; }
    g.appendChild(svgEl('animate', o));
    var t = { attributeName: 'transform', type: 'translate', values: (cx * 0.05).toFixed(1) + ' ' + (cy * 0.05).toFixed(1) + ';0 0' };
    for (k in common) { t[k] = common[k]; }
    g.appendChild(svgEl('animateTransform', t));
    var s = { attributeName: 'transform', type: 'scale', values: '0.95;1', additive: 'sum' };
    for (k in common) { s[k] = common[k]; }
    g.appendChild(svgEl('animateTransform', s));
    return g;
  }
  function card(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }

  // ── l5-data-pipeline: docs stream through filters, only survivors batch ──
  function dataPipeline(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var g = svgEl('g');
    g.appendChild(svgEl('line', { x1: 24, y1: 77, x2: 470, y2: 77, stroke: RULE, 'stroke-width': 1 }));
    var i;
    for (i = 0; i < 3; i++) {
      g.appendChild(svgEl('rect', { x: 22, y: 56 + i * 9, width: 44, height: 7, fill: SURF, stroke: MUTE, 'stroke-width': 0.8 }));
    }
    g.appendChild(txt(44, 104, 'raw text', 9, MUTE, 'middle'));
    var names = ['dedup', 'quality', 'pack'];
    for (i = 0; i < 3; i++) {
      var sx = 110 + i * 100;
      g.appendChild(box(sx, 61, 72, 32, BP));
      g.appendChild(txt(sx + 36, 81, names[i], 10, BP, 'middle'));
    }
    g.appendChild(txt(146, 150, 'duplicate', 8.5, WARN, 'middle'));
    g.appendChild(txt(246, 150, 'low quality', 8.5, WARN, 'middle'));
    for (i = 0; i < 6; i++) {
      var bx = 420 + (i % 2) * 30, by = 52 + Math.floor(i / 2) * 17;
      var cell = svgEl('rect', { x: bx, y: by, width: 26, height: 13, fill: BP, opacity: 0 });
      var at = 0.56 + i * 0.055;
      cell.appendChild(anim('opacity', '0;0;0.85;0.85;0', '5s', { keyTimes: '0;' + at.toFixed(3) + ';' + (at + 0.04).toFixed(3) + ';0.94;1' }));
      g.appendChild(cell);
    }
    g.appendChild(txt(448, 118, 'batches', 8.5, SOFT, 'middle'));
    function doc(path, begin, fill, opVals, opTimes, kp, kt) {
      var c = svgEl('circle', { r: 4.5, fill: fill, opacity: 0 });
      var m = { dur: '5s', repeatCount: 'indefinite', path: path, begin: begin, calcMode: 'linear', keyPoints: kp, keyTimes: kt };
      c.appendChild(svgEl('animateMotion', m));
      c.appendChild(anim('opacity', opVals, '5s', { begin: begin, keyTimes: opTimes }));
      g.appendChild(c);
    }
    doc('M 44 77 L 432 77', '0s', BP, '0;1;1;0;0', '0;0.05;0.5;0.58;1', '0;1;1', '0;0.52;1');
    doc('M 44 77 L 146 77 L 146 132', '0.35s', MUTE, '0;1;1;0;0', '0;0.05;0.32;0.44;1', '0;0.65;1;1', '0;0.3;0.42;1');
    doc('M 44 77 L 246 77 L 246 132', '0.7s', MUTE, '0;1;1;0;0', '0;0.05;0.4;0.52;1', '0;0.786;1;1', '0;0.38;0.5;1');
    entry(g, 260, 115);
    svg.appendChild(g);
    card(host, 'PRETRAINING DATA PIPELINE', 'filter, pack, keep the GPU fed', svg,
      'Terabytes of raw text stream through deduplication and quality filters before being packed into fixed-length sequences. Only a fraction survives, and the pipeline has to produce batches faster than the GPUs consume them, or the whole cluster waits on the dataloader.');
  }

  // ── l5-spec-decode-eagle: draft proposes, one verifier pass stamps ──
  function specDecode(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var g = svgEl('g');
    g.appendChild(box(8, 88, 50, 26, MUTE));
    g.appendChild(txt(33, 105, 'draft', 9, MUTE, 'middle'));
    g.appendChild(box(160, 16, 220, 26, INK, 'none', 1.4));
    g.appendChild(txt(270, 33, 'verifier: one forward pass', 9.5, INK, 'middle'));
    var sweep = svgEl('rect', { x: 66, y: 80, width: 78, height: 42, fill: BP, opacity: 0 });
    sweep.appendChild(anim('x', '66;66;320;320', '5.5s', { calcMode: 'linear', keyTimes: '0;0.28;0.52;1' }));
    sweep.appendChild(anim('opacity', '0;0;0.16;0.16;0;0', '5.5s', { keyTimes: '0;0.26;0.3;0.52;0.58;1' }));
    g.appendChild(sweep);
    var slotX = [70, 154, 238, 322];
    var appear = ['0;0.05;0.09;0.93;1', '0;0.095;0.135;0.93;1', null, null];
    var i;
    for (i = 0; i < 4; i++) {
      var gs = svgEl('g', { opacity: 0 });
      gs.appendChild(svgEl('rect', { x: slotX[i], y: 84, width: 70, height: 34, rx: 4, fill: 'none', stroke: MUTE, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));
      gs.appendChild(txt(slotX[i] + 35, 106, 'd' + (i + 1), 10, SOFT, 'middle'));
      if (i < 2) {
        gs.appendChild(anim('opacity', '0;0;0.9;0.9;0', '5.5s', { keyTimes: appear[i] }));
      } else {
        var s0 = i === 2 ? '0.14' : '0.185', s1 = i === 2 ? '0.18' : '0.225';
        var e0 = i === 2 ? '0.56' : '0.5', e1 = i === 2 ? '0.62' : '0.56';
        gs.appendChild(anim('opacity', '0;0;0.9;0.9;0;0', '5.5s', { keyTimes: '0;' + s0 + ';' + s1 + ';' + e0 + ';' + e1 + ';1' }));
      }
      g.appendChild(gs);
    }
    var accTimes = ['0;0.34;0.38;0.93;1', '0;0.42;0.46;0.93;1'];
    for (i = 0; i < 2; i++) {
      var acc = svgEl('rect', { x: slotX[i], y: 84, width: 70, height: 34, rx: 4, fill: BP, opacity: 0 });
      acc.appendChild(anim('opacity', '0;0;0.5;0.5;0', '5.5s', { keyTimes: accTimes[i] }));
      g.appendChild(acc);
    }
    var xm = svgEl('path', { d: 'M 263 91 L 283 111 M 283 91 L 263 111', stroke: WARN, 'stroke-width': 2, fill: 'none', opacity: 0 });
    xm.appendChild(anim('opacity', '0;0;1;1;0;0', '5.5s', { keyTimes: '0;0.5;0.53;0.58;0.63;1' }));
    g.appendChild(xm);
    var fix = svgEl('g', { opacity: 0 });
    fix.appendChild(svgEl('rect', { x: 238, y: 84, width: 70, height: 34, rx: 4, fill: BP }));
    fix.appendChild(txt(273, 106, 'resample', 8.5, 'var(--bg,#fafaf5)', 'middle'));
    fix.appendChild(anim('opacity', '0;0;1;1;0', '5.5s', { keyTimes: '0;0.6;0.66;0.93;1', calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';' + EASE }));
    g.appendChild(fix);
    g.appendChild(txt(260, 190, 'two accepted + one corrected token from a single verifier forward', 9, MUTE, 'middle'));
    entry(g, 260, 110);
    svg.appendChild(g);
    card(host, 'SPECULATIVE DECODING', 'draft cheap, verify once', svg,
      'The draft head proposes four cheap tokens. One verifier forward pass scores all of them at once: the agreeing prefix is accepted, the first disagreement is rejected and replaced by a sample from the residual distribution, and everything after it is discarded. On a full accept the verifier emits a bonus token, so one big-model pass can yield N+1 tokens with the verifier distribution preserved exactly.');
  }

  // ── l5-prod-app-paths: cache miss pays the full path, cache hit is free ──
  function prodApp(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var g = svgEl('g');
    var stages = [[12, 62, 'request', SOFT], [100, 60, 'guard', BP], [186, 60, 'cache', BP], [272, 54, 'RAG', BP], [352, 50, 'LLM', BP], [428, 78, 'respond', INK]];
    g.appendChild(svgEl('line', { x1: 74, y1: 73, x2: 428, y2: 73, stroke: RULE, 'stroke-width': 1 }));
    var i;
    for (i = 0; i < 6; i++) {
      g.appendChild(box(stages[i][0], 58, stages[i][1], 30, stages[i][3]));
      g.appendChild(txt(stages[i][0] + stages[i][1] / 2, 77, stages[i][2], 9.5, stages[i][3], 'middle'));
    }
    g.appendChild(svgEl('path', { d: 'M 216 88 C 216 150 300 150 340 150 L 400 150 C 452 150 460 120 462 92', fill: 'none', stroke: RULE, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' }));
    g.appendChild(txt(310, 164, 'cache hit shortcut', 8.5, MUTE, 'middle'));
    var missTag = txt(216, 50, 'miss', 8.5, WARN, 'middle');
    missTag.setAttribute('opacity', 0);
    missTag.appendChild(anim('opacity', '0;0;1;1;0;0', '6s', { keyTimes: '0;0.12;0.16;0.3;0.36;1' }));
    g.appendChild(missTag);
    var flash = svgEl('rect', { x: 186, y: 58, width: 60, height: 30, rx: 4, fill: BP, opacity: 0 });
    flash.appendChild(anim('opacity', '0;0;0.4;0;0', '6s', { keyTimes: '0;0.58;0.62;0.68;1' }));
    g.appendChild(flash);
    var miss = svgEl('circle', { r: 4.5, fill: BP, opacity: 0 });
    miss.appendChild(svgEl('animateMotion', { dur: '6s', repeatCount: 'indefinite', path: 'M 20 73 L 460 73', calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.4;1' }));
    miss.appendChild(anim('opacity', '0;1;1;0;0', '6s', { keyTimes: '0;0.04;0.4;0.47;1' }));
    g.appendChild(miss);
    var hit = svgEl('circle', { r: 4.5, fill: BP, opacity: 0 });
    hit.appendChild(svgEl('animateMotion', { dur: '6s', repeatCount: 'indefinite', path: 'M 20 73 L 216 73 L 216 88 C 216 150 320 150 400 150 C 452 150 460 120 462 95', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.55;0.78;1' }));
    hit.appendChild(anim('opacity', '0;0;1;1;0;0', '6s', { keyTimes: '0;0.55;0.58;0.78;0.84;1' }));
    g.appendChild(hit);
    g.appendChild(txt(60, 208, 'miss', 9, SOFT, 'end'));
    g.appendChild(txt(60, 228, 'hit', 9, SOFT, 'end'));
    g.appendChild(svgEl('rect', { x: 72, y: 198, width: 240, height: 12, fill: 'none', stroke: RULE, 'stroke-width': 1 }));
    g.appendChild(svgEl('rect', { x: 72, y: 218, width: 240, height: 12, fill: 'none', stroke: RULE, 'stroke-width': 1 }));
    var mb = svgEl('rect', { x: 72, y: 198, width: 0, height: 12, fill: WARN });
    mb.appendChild(anim('width', '0;0;220;220;0', '6s', { calcMode: 'linear', keyTimes: '0;0.08;0.4;0.94;1' }));
    g.appendChild(mb);
    var hb = svgEl('rect', { x: 72, y: 218, width: 0, height: 12, fill: BP });
    hb.appendChild(anim('width', '0;0;14;14;0', '6s', { calcMode: 'linear', keyTimes: '0;0.55;0.78;0.94;1' }));
    g.appendChild(hb);
    g.appendChild(txt(320, 208, '~2 s, full token cost', 8.5, MUTE));
    g.appendChild(txt(320, 228, '~50 ms, free', 8.5, MUTE));
    entry(g, 260, 125);
    svg.appendChild(g);
    card(host, 'PRODUCTION LLM SERVICE', 'two requests, two very different paths', svg,
      'One request misses every cache and pays the full path: guardrails, retrieval, the model itself. Seconds of latency and full token cost. An identical request moments later short-circuits at the cache and returns in milliseconds for nearly nothing. Production LLM engineering is largely the work of making the second path the common one.');
  }

  // ── l5-state-graph-ledger: explicit graph, every edge writes a checkpoint ──
  function stateGraph(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var g = svgEl('g');
    var nodes = [[50, 70, 80, 'model', BP], [210, 26, 80, 'tools', BP], [210, 114, 80, 'human', WARN], [390, 114, 70, 'END', MUTE]];
    var i;
    for (i = 0; i < 4; i++) {
      g.appendChild(box(nodes[i][0], nodes[i][1], nodes[i][2], 32, nodes[i][4]));
      g.appendChild(txt(nodes[i][0] + nodes[i][2] / 2, nodes[i][1] + 20, nodes[i][3], 10, nodes[i][4], 'middle'));
    }
    g.appendChild(svgEl('line', { x1: 130, y1: 78, x2: 210, y2: 48, stroke: RULE, 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: 210, y1: 56, x2: 130, y2: 90, stroke: RULE, 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: 130, y1: 98, x2: 210, y2: 126, stroke: RULE, 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: 290, y1: 130, x2: 390, y2: 130, stroke: RULE, 'stroke-width': 1.2 }));
    var walker = svgEl('circle', { r: 5, fill: BP, opacity: 0 });
    walker.appendChild(svgEl('animateMotion', { dur: '6s', repeatCount: 'indefinite', path: 'M 90 86 L 250 42 L 90 86 L 250 130 L 425 130', calcMode: 'linear', keyPoints: '0;0.25;0.5;0.75;0.75;1;1', keyTimes: '0;0.15;0.3;0.45;0.72;0.88;1' }));
    walker.appendChild(anim('opacity', '0;1;1;0;0', '6s', { keyTimes: '0;0.04;0.88;0.94;1' }));
    g.appendChild(walker);
    var ring = svgEl('circle', { cx: 250, cy: 130, r: 24, fill: 'none', stroke: WARN, 'stroke-width': 1.5, opacity: 0 });
    ring.appendChild(anim('opacity', '0;0;0.9;0.9;0;0', '6s', { keyTimes: '0;0.48;0.52;0.68;0.74;1' }));
    g.appendChild(ring);
    var itx = txt(250, 172, 'interrupt: waiting for approval', 8.5, WARN, 'middle');
    itx.setAttribute('opacity', 0);
    itx.appendChild(anim('opacity', '0;0;1;1;0;0', '6s', { keyTimes: '0;0.48;0.52;0.68;0.74;1' }));
    g.appendChild(itx);
    g.appendChild(txt(60, 206, 'checkpointer', 9, MUTE));
    var cpAt = [0.15, 0.3, 0.45, 0.88];
    for (i = 0; i < 4; i++) {
      var cp = svgEl('rect', { x: 170 + i * 36, y: 194, width: 30, height: 16, rx: 2, fill: BP, opacity: 0 });
      cp.appendChild(anim('opacity', '0;0;0.8;0.8;0', '6s', { keyTimes: '0;' + cpAt[i] + ';' + (cpAt[i] + 0.04).toFixed(2) + ';0.94;1' }));
      g.appendChild(cp);
    }
    entry(g, 260, 125);
    svg.appendChild(g);
    card(host, 'AGENT STATE MACHINE', 'the loop becomes a graph you can pause', svg,
      'The same ReAct loop drawn as an explicit graph. The walker crosses model, tools, and human-approval nodes, and every transition writes a checkpoint to the ledger below. At the human node execution simply stops: state is already persisted, so the graph can resume later, or rewind to any earlier checkpoint and branch down a different path.');
  }

  // ── l5-framework-fit: four whiteboards, one per core abstraction ──
  function frameworkFit(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 260' });
    var g = svgEl('g');
    g.appendChild(txt(260, 20, 'the whiteboard test: which shape is your problem?', 9.5, MUTE, 'middle'));
    function panel(x, y, name, tag, sketch, vals, times) {
      var p = svgEl('g', { opacity: 0.35 });
      p.appendChild(svgEl('rect', { x: x, y: y, width: 240, height: 102, fill: 'none', stroke: RULE, 'stroke-width': 1 }));
      p.appendChild(txt(x + 10, y + 20, name, 10.5, INK));
      p.appendChild(txt(x + 10, y + 92, tag, 8.5, MUTE));
      var i;
      for (i = 0; i < sketch.length; i++) { p.appendChild(sketch[i]); }
      p.appendChild(anim('opacity', vals, '6s', { keyTimes: times }));
      g.appendChild(p);
    }
    panel(10, 32, 'LangGraph', 'you draw a graph: typed state, edges', [
      svgEl('circle', { cx: 158, cy: 62, r: 7, fill: 'none', stroke: BP, 'stroke-width': 1.4 }),
      svgEl('circle', { cx: 204, cy: 84, r: 7, fill: 'none', stroke: BP, 'stroke-width': 1.4 }),
      svgEl('circle', { cx: 158, cy: 106, r: 7, fill: 'none', stroke: BP, 'stroke-width': 1.4 }),
      svgEl('line', { x1: 164, y1: 66, x2: 198, y2: 81, stroke: BP, 'stroke-width': 1.1 }),
      svgEl('line', { x1: 198, y1: 88, x2: 164, y2: 103, stroke: BP, 'stroke-width': 1.1 })
    ], '0.35;1;1;0.35;0.35', '0;0.03;0.21;0.26;1');
    panel(270, 32, 'CrewAI', 'you draw an org chart: roles + tasks', [
      svgEl('rect', { x: 420, y: 52, width: 36, height: 14, rx: 2, fill: 'none', stroke: BP, 'stroke-width': 1.4 }),
      svgEl('rect', { x: 396, y: 90, width: 32, height: 14, rx: 2, fill: SURF, stroke: MUTE, 'stroke-width': 1 }),
      svgEl('rect', { x: 448, y: 90, width: 32, height: 14, rx: 2, fill: SURF, stroke: MUTE, 'stroke-width': 1 }),
      svgEl('line', { x1: 432, y1: 66, x2: 412, y2: 90, stroke: MUTE, 'stroke-width': 1.1 }),
      svgEl('line', { x1: 444, y1: 66, x2: 464, y2: 90, stroke: MUTE, 'stroke-width': 1.1 })
    ], '0.35;0.35;1;1;0.35;0.35', '0;0.25;0.28;0.46;0.51;1');
    panel(10, 148, 'AutoGen', 'you draw a chat: agents take turns', [
      svgEl('rect', { x: 146, y: 174, width: 62, height: 18, rx: 9, fill: 'none', stroke: BP, 'stroke-width': 1.4 }),
      svgEl('rect', { x: 168, y: 202, width: 62, height: 18, rx: 9, fill: SURF, stroke: MUTE, 'stroke-width': 1 })
    ], '0.35;0.35;1;1;0.35;0.35', '0;0.5;0.53;0.71;0.76;1');
    panel(270, 148, 'Agno', 'you draw one box: agent + batteries', [
      svgEl('rect', { x: 418, y: 168, width: 50, height: 30, rx: 4, fill: 'none', stroke: BP, 'stroke-width': 1.4 }),
      svgEl('rect', { x: 414, y: 212, width: 12, height: 12, fill: SURF, stroke: MUTE, 'stroke-width': 1 }),
      svgEl('rect', { x: 436, y: 212, width: 12, height: 12, fill: SURF, stroke: MUTE, 'stroke-width': 1 }),
      svgEl('rect', { x: 458, y: 212, width: 12, height: 12, fill: SURF, stroke: MUTE, 'stroke-width': 1 })
    ], '0.35;0.35;1;1;0.35', '0;0.75;0.78;0.97;1');
    entry(g, 260, 130);
    svg.appendChild(g);
    card(host, 'FRAMEWORK TRADEOFFS', 'match the abstraction to the problem shape', svg,
      'Each framework has one core abstraction, and it is the thing you would draw on a whiteboard. LangGraph draws a state graph, CrewAI an org chart, AutoGen a conversation, Agno a single agent with tools attached. Pick the one whose drawing matches your problem; forcing the wrong shape means writing the missing abstraction yourself, twice.');
  }

  // ── l5-vlm-recipe-knobs: five faders, data mix rises highest ──
  function vlmRecipe(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var g = svgEl('g');
    g.appendChild(txt(40, 26, 'impact on final benchmarks', 9, MUTE));
    g.appendChild(svgEl('line', { x1: 40, y1: 192, x2: 480, y2: 192, stroke: MUTE, 'stroke-width': 1 }));
    var bars = [['encoder', 88, false], ['connector', 34, false], ['LLM size', 60, false], ['data mix', 126, true], ['resolution', 72, false]];
    var i;
    for (i = 0; i < 5; i++) {
      var bx = 60 + i * 86, h = bars[i][1], s = 0.05 + i * 0.06;
      var attrs = bars[i][2] ? { fill: BP } : { fill: SURF, stroke: MUTE, 'stroke-width': 1 };
      attrs.x = bx; attrs.y = 182; attrs.width = 48; attrs.height = 10;
      var bar = svgEl('rect', attrs);
      var kt = '0;' + s.toFixed(2) + ';' + (s + 0.14).toFixed(2) + ';0.9;1';
      var ks = '0 0 1 1;' + EASE + ';0 0 1 1;0.42 0 1 1';
      bar.appendChild(anim('height', '10;10;' + h + ';' + h + ';10', '5s', { keyTimes: kt, calcMode: 'spline', keySplines: ks }));
      bar.appendChild(anim('y', '182;182;' + (192 - h) + ';' + (192 - h) + ';182', '5s', { keyTimes: kt, calcMode: 'spline', keySplines: ks }));
      g.appendChild(bar);
      g.appendChild(txt(bx + 24, 208, bars[i][0], 9, SOFT, 'middle'));
    }
    var mark = svgEl('g', { opacity: 0 });
    mark.appendChild(txt(60 + 3 * 86 + 24, 44, 'turn this first', 9, BP, 'middle'));
    mark.appendChild(svgEl('line', { x1: 60 + 3 * 86 + 24, y1: 50, x2: 60 + 3 * 86 + 24, y2: 60, stroke: BP, 'stroke-width': 1.2 }));
    mark.appendChild(anim('opacity', '0;0;1;1;0', '5s', { keyTimes: '0;0.42;0.48;0.9;1' }));
    g.appendChild(mark);
    entry(g, 260, 120);
    svg.appendChild(g);
    card(host, 'VLM RECIPE KNOBS', 'the ablation-stable ranking', svg,
      'The ranking that survives across the MM1, Idefics2, Cambrian-1, and Prismatic ablation tables. Data mixture moves benchmarks most, the image encoder is next, and the connector, the knob most papers obsess over, matters least. When a VLM underperforms, reach for the tallest fader first.');
  }

  // ── l5-onevision-budget: one fixed budget, three packings ──
  function onevisionBudget(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var g = svgEl('g');
    g.appendChild(txt(60, 66, '0', 8.5, MUTE, 'middle'));
    g.appendChild(txt(460, 66, '~3-4K visual tokens', 8.5, MUTE, 'end'));
    g.appendChild(svgEl('rect', { x: 60, y: 78, width: 400, height: 58, fill: 'none', stroke: INK, 'stroke-width': 1.4 }));
    function pack(rects, label, vals, times) {
      var p = svgEl('g', { opacity: 0 });
      var i;
      for (i = 0; i < rects.length; i++) { p.appendChild(rects[i]); }
      p.appendChild(txt(260, 166, label, 9.5, SOFT, 'middle'));
      p.appendChild(anim('opacity', vals, '6s', { keyTimes: times }));
      g.appendChild(p);
    }
    pack([svgEl('rect', { x: 66, y: 84, width: 310, height: 46, fill: BP, opacity: 0.75 })],
      'single image: AnyRes tiles, ~2900 tok', '0;1;1;0;0', '0;0.05;0.3;0.34;1');
    var multi = [], i;
    for (i = 0; i < 6; i++) { multi.push(svgEl('rect', { x: 66 + i * 64, y: 84, width: 56, height: 46, fill: BP, opacity: 0.55 })); }
    pack(multi, 'multi-image: 6 images x 729 tok each', '0;0;1;1;0;0', '0;0.333;0.373;0.63;0.67;1');
    var vid = [];
    for (i = 0; i < 12; i++) { vid.push(svgEl('rect', { x: 66 + i * 32, y: 84, width: 26, height: 46, fill: BP, opacity: 0.4 })); }
    pack(vid, 'video: 32 frames x 81 tok, pooled', '0;0;1;1;0', '0;0.667;0.707;0.96;1');
    entry(g, 260, 115);
    svg.appendChild(g);
    card(host, 'ONEVISION TOKEN BUDGET', 'same jar, three packings', svg,
      'LLaVA-OneVision holds the visual-token budget roughly constant at a few thousand tokens per sample and just repacks it: one image at high AnyRes resolution, several images at moderate resolution, or 32 video frames pooled down to 81 tokens each. Because every scenario costs about the same, one model trains on all three without any of them dominating.');
  }

  // ── l5-native-pretrain: bolted-on wall vs interleaved wall ──
  function nativePretrain(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var g = svgEl('g');
    function brick(x, y, vision, s) {
      var r = svgEl('rect', { x: x, y: y, width: 44, height: 18, fill: vision ? BP : SURF, stroke: vision ? BP : MUTE, 'stroke-width': 1, opacity: 0 });
      r.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;' + s.toFixed(3) + ';' + (s + 0.05).toFixed(3) + ';0.93;1' }));
      return r;
    }
    g.appendChild(txt(70, 48, 'post-hoc: text first, vision bolted on', 9.5, SOFT));
    var i;
    for (i = 0; i < 6; i++) { g.appendChild(brick(70 + i * 50, 64, false, 0.03 + i * 0.045)); }
    g.appendChild(brick(70 + 6 * 50, 64, true, 0.38));
    g.appendChild(brick(70 + 7 * 50, 64, true, 0.44));
    var crack = svgEl('path', { d: 'M 367 58 L 362 68 L 371 76 L 364 88', stroke: WARN, 'stroke-width': 2, fill: 'none', opacity: 0 });
    crack.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.5;0.54;0.93;1' }));
    g.appendChild(crack);
    var clab = txt(367, 108, 'alignment debt', 8.5, WARN, 'middle');
    clab.setAttribute('opacity', 0);
    clab.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.5;0.54;0.93;1' }));
    g.appendChild(clab);
    g.appendChild(txt(70, 148, 'native: interleaved from step one', 9.5, SOFT));
    var mix = [false, true, false, false, true, false, true, false];
    for (i = 0; i < 8; i++) { g.appendChild(brick(70 + i * 50, 164, mix[i], 0.03 + i * 0.045)); }
    var seam = txt(270, 210, 'no seam', 8.5, BP, 'middle');
    seam.setAttribute('opacity', 0);
    seam.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.42;0.48;0.93;1' }));
    g.appendChild(seam);
    entry(g, 260, 125);
    svg.appendChild(g);
    card(host, 'NATIVE MULTIMODAL PRETRAINING', 'two ways to build the same wall', svg,
      'Post-hoc training lays down trillions of text tokens first and glues vision on at the end; the seam is alignment debt, visible as catastrophic forgetting, answer drift, and visual-text inconsistency. InternVL3 lays text, interleaved, and caption data together from the first step, so visual tokens are native citizens of the wall rather than an extension bolted on.');
  }

  // ── l5-emu3-next-token: one cursor writes text, image, and video tokens ──
  function emuNextToken(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var g = svgEl('g');
    g.appendChild(txt(260, 26, 'one decoder, one vocabulary, one loss: predict the next token', 9.5, MUTE, 'middle'));
    var i;
    for (i = 0; i < 12; i++) {
      var attrs = { x: 40 + i * 37, y: 104, width: 34, height: 28, rx: 3, opacity: 0 };
      if (i < 3) { attrs.fill = SURF; attrs.stroke = MUTE; attrs['stroke-width'] = 1; }
      else if (i < 8) { attrs.fill = BP; }
      else { attrs.fill = WARN; }
      var cell = svgEl('rect', attrs);
      var f = i * 0.0733 + 0.02;
      cell.appendChild(anim('opacity', '0;0;1;1;0', '5s', { keyTimes: '0;' + f.toFixed(3) + ';' + (f + 0.03).toFixed(3) + ';0.94;1' }));
      g.appendChild(cell);
    }
    var xs = [], ts = [];
    for (i = 0; i < 13; i++) { xs.push(34 + i * 37); ts.push((i * 0.0733).toFixed(3)); }
    ts[12] = '1';
    var cursor = svgEl('rect', { x: 34, y: 96, width: 3, height: 44, fill: INK });
    cursor.appendChild(anim('x', xs.join(';'), '5s', { calcMode: 'discrete', keyTimes: ts.join(';') }));
    g.appendChild(cursor);
    g.appendChild(txt(94, 160, 'text', 9, SOFT, 'middle'));
    g.appendChild(txt(242, 160, 'image tokens', 9, BP, 'middle'));
    g.appendChild(txt(408, 160, 'video tokens', 9, WARN, 'middle'));
    entry(g, 260, 110);
    svg.appendChild(g);
    card(host, 'EMU3 NEXT-TOKEN GENERATION', 'one head, three modalities', svg,
      'Emu3 trains a single Llama-style decoder with next-token prediction over one shared vocabulary in which text, VQ image tokens, and 3D video tokens are all just entries. No diffusion schedule, no CLIP loss, no second objective. The same sweep of the same head writes a sentence, an image, or a video clip, which is why one model can be Emu3-Chat and Emu3-Gen at once.');
  }

  // ── l5-janus-decouple: two front doors, one shared hall ──
  function janusDecouple(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var g = svgEl('g');
    g.appendChild(box(215, 95, 100, 60, INK, 'none', 1.4));
    g.appendChild(txt(265, 120, 'shared', 9.5, INK, 'middle'));
    g.appendChild(txt(265, 134, 'transformer', 9.5, INK, 'middle'));
    var top = svgEl('g');
    top.appendChild(txt(28, 32, 'understand', 9, BP));
    top.appendChild(svgEl('rect', { x: 28, y: 48, width: 30, height: 24, fill: SURF, stroke: SOFT, 'stroke-width': 1 }));
    top.appendChild(txt(43, 86, 'image', 8.5, MUTE, 'middle'));
    top.appendChild(box(96, 48, 86, 24, BP));
    top.appendChild(txt(139, 64, 'SigLIP', 9.5, BP, 'middle'));
    top.appendChild(svgEl('line', { x1: 58, y1: 60, x2: 96, y2: 60, stroke: RULE, 'stroke-width': 1.2 }));
    top.appendChild(svgEl('line', { x1: 182, y1: 60, x2: 218, y2: 96, stroke: RULE, 'stroke-width': 1.2 }));
    top.appendChild(svgEl('line', { x1: 312, y1: 96, x2: 352, y2: 62, stroke: RULE, 'stroke-width': 1.2 }));
    top.appendChild(txt(358, 64, 'text answer', 9.5, SOFT));
    var ud = svgEl('circle', { r: 4, fill: BP, opacity: 0 });
    ud.appendChild(svgEl('animateMotion', { dur: '6s', repeatCount: 'indefinite', path: 'M 34 60 L 139 60 L 250 108 L 356 62', calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.4;1' }));
    ud.appendChild(anim('opacity', '0;1;1;0;0', '6s', { keyTimes: '0;0.04;0.4;0.46;1' }));
    top.appendChild(ud);
    top.appendChild(anim('opacity', '1;1;0.3;0.3;1', '6s', { keyTimes: '0;0.46;0.5;0.95;1' }));
    g.appendChild(top);
    var bot = svgEl('g');
    bot.appendChild(txt(28, 226, 'generate', 9, WARN));
    bot.appendChild(txt(28, 196, 'prompt', 9, SOFT));
    bot.appendChild(svgEl('line', { x1: 70, y1: 192, x2: 218, y2: 152, stroke: RULE, 'stroke-width': 1.2 }));
    bot.appendChild(svgEl('line', { x1: 312, y1: 152, x2: 346, y2: 188, stroke: RULE, 'stroke-width': 1.2 }));
    bot.appendChild(box(346, 178, 84, 24, WARN));
    bot.appendChild(txt(388, 194, 'VQ decoder', 8.5, WARN, 'middle'));
    bot.appendChild(svgEl('rect', { x: 446, y: 180, width: 10, height: 10, fill: BP, opacity: 0.9 }));
    bot.appendChild(svgEl('rect', { x: 458, y: 180, width: 10, height: 10, fill: BP, opacity: 0.45 }));
    bot.appendChild(svgEl('rect', { x: 446, y: 192, width: 10, height: 10, fill: BP, opacity: 0.3 }));
    bot.appendChild(svgEl('rect', { x: 458, y: 192, width: 10, height: 10, fill: BP, opacity: 0.7 }));
    var gd = svgEl('circle', { r: 4, fill: WARN, opacity: 0 });
    gd.appendChild(svgEl('animateMotion', { dur: '6s', repeatCount: 'indefinite', path: 'M 34 192 L 250 145 L 388 188 L 452 190', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: '0;0.5;0.9;1' }));
    gd.appendChild(anim('opacity', '0;0;1;1;0;0', '6s', { keyTimes: '0;0.5;0.54;0.88;0.94;1' }));
    bot.appendChild(gd);
    bot.appendChild(anim('opacity', '0.3;0.3;1;1;0.3', '6s', { keyTimes: '0;0.46;0.5;0.95;1' }));
    g.appendChild(bot);
    entry(g, 260, 125);
    svg.appendChild(g);
    card(host, 'JANUS-PRO DECOUPLED ENCODERS', 'two front doors, one hall', svg,
      'Understanding wants semantic features, generation wants reconstruction-friendly codes, and one encoder cannot serve both. Janus-Pro routes understanding through SigLIP and generation through a VQ tokenizer while both tasks share the same transformer body. Two front doors, one hall, and neither task pays the other\'s quality tax.');
  }

  // ── l5-thinker-talker: speech streams while the text is still writing ──
  function thinkerTalker(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var g = svgEl('g');
    g.appendChild(txt(20, 79, 'THINKER', 9, BP));
    g.appendChild(txt(20, 91, 'text tokens', 7.5, MUTE));
    g.appendChild(txt(20, 139, 'TALKER', 9, WARN));
    g.appendChild(txt(20, 151, 'speech tokens', 7.5, MUTE));
    function row(y, attrs, off) {
      var i;
      for (i = 0; i < 7; i++) {
        var a = { x: 140 + i * 48, y: y, width: 40, height: 26, rx: 3, opacity: 0 }, k;
        for (k in attrs) { a[k] = attrs[k]; }
        var c = svgEl('rect', a);
        var f = off + i * 0.07;
        c.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;' + f.toFixed(3) + ';' + (f + 0.04).toFixed(3) + ';0.94;1' }));
        g.appendChild(c);
      }
    }
    row(62, { fill: 'none', stroke: BP, 'stroke-width': 1.3 }, 0.05);
    row(122, { fill: WARN, 'fill-opacity': 0.8 }, 0.19);
    var mark = svgEl('line', { x1: 160, y1: 44, x2: 160, y2: 168, stroke: WARN, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
    mark.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.19;0.24;0.94;1' }));
    g.appendChild(mark);
    var mlab = txt(168, 40, 'first audio ~350 ms', 8.5, WARN);
    mlab.setAttribute('opacity', 0);
    mlab.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.19;0.24;0.94;1' }));
    g.appendChild(mlab);
    var wave = svgEl('path', { d: 'M 478 135 q 4 -12 8 0 q 4 12 8 0 q 4 -12 8 0', stroke: WARN, 'stroke-width': 1.4, fill: 'none', opacity: 0 });
    wave.appendChild(anim('opacity', '0;0;1;1;0', '6s', { keyTimes: '0;0.24;0.3;0.94;1' }));
    g.appendChild(wave);
    g.appendChild(svgEl('line', { x1: 140, y1: 190, x2: 468, y2: 190, stroke: MUTE, 'stroke-width': 1 }));
    g.appendChild(svgEl('path', { d: 'M 462 186 L 470 190 L 462 194', fill: 'none', stroke: MUTE, 'stroke-width': 1 }));
    g.appendChild(txt(468, 205, 'time', 8.5, MUTE, 'end'));
    g.appendChild(txt(304, 226, 'the talker streams while the thinker is still writing', 8.5, MUTE, 'middle'));
    entry(g, 260, 120);
    svg.appendChild(g);
    card(host, 'THINKER-TALKER SPLIT', 'parallel streams beat the latency budget', svg,
      'Qwen2.5-Omni splits the voice pipeline: a large Thinker writes the reply as text tokens while a small Talker converts them to speech tokens in parallel, trailing only a couple of tokens behind. The first audio reaches the speaker while most of the sentence is still unwritten, which is how the round trip stays under the 500 ms conversational threshold.');
  }

  LF.register({
    'l5-data-pipeline': dataPipeline,
    'l5-spec-decode-eagle': specDecode,
    'l5-prod-app-paths': prodApp,
    'l5-state-graph-ledger': stateGraph,
    'l5-framework-fit': frameworkFit,
    'l5-vlm-recipe-knobs': vlmRecipe,
    'l5-onevision-budget': onevisionBudget,
    'l5-native-pretrain': nativePretrain,
    'l5-emu3-next-token': emuNextToken,
    'l5-janus-decouple': janusDecouple,
    'l5-thinker-talker': thinkerTalker
  });
})();
