/* figures-workbench.js - animated lesson figures for the agent workbench
   mini-track and late phase-14 lessons. Loads after lesson-figures.js,
   registers through window.LF. No deps, ES5, theme via CSS vars. SMIL-only
   animation: no JS render loops. Authoring: a ```figure block naming one of
   the widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function shell(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '10', fill: fill || 'var(--ink,#1a1a1a)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function box(x, y, w, h, stroke, fill) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: fill || 'var(--bg-surface,#eee)', stroke: stroke || 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
  }
  function sp(n) { var s = [], i; for (i = 0; i < n; i++) { s.push('0.23 1 0.32 1'); } return s.join(';'); }
  function seq(attr, vals, times, dur, splines) {
    var a = { attributeName: attr, values: vals, keyTimes: times, dur: dur, repeatCount: 'indefinite' };
    if (splines) { a.calcMode = 'spline'; a.keySplines = splines; }
    return svgEl('animate', a);
  }
  /* Entry craft: fade in from opacity 0 at ~95% size, hold, exit faster than
     the entry. kids must be drawn centered on (0,0). */
  function popG(x, y, kids, times, dur) {
    var g = svgEl('g', { transform: 'translate(' + x + ' ' + y + ')' }, kids);
    g.appendChild(seq('opacity', '0;0;1;1;0;0', times, dur, sp(5)));
    g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;0.95;1;1;0.98;0.98', keyTimes: times, dur: dur, repeatCount: 'indefinite' }));
    return g;
  }
  function fly(node, path, dur, kp, kt) {
    node.appendChild(svgEl('animateMotion', { path: path, dur: dur, repeatCount: 'indefinite', keyPoints: kp, keyTimes: kt, calcMode: 'linear' }));
    return node;
  }
  function dot(r, fill) { return svgEl('circle', { cx: '0', cy: '0', r: r || '5', fill: fill || 'var(--blueprint,#3553ff)' }); }

  // ── wb-runtime-spawn: a fresh agent instantiated per request, then gone ────
  function runtimeSpawn(host) {
    var W = 520, H = 230, D = '3.6s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: 30, y1: 90, x2: 205, y2: 90, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    svg.appendChild(svgEl('line', { x1: 315, y1: 90, x2: 490, y2: 90, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    svg.appendChild(txt(70, 74, 'request', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(450, 74, 'response', '9', 'var(--ink-mute,#777)'));
    var req = dot('5');
    req.appendChild(seq('opacity', '0;1;1;0;0', '0;0.05;0.26;0.3;1', D));
    svg.appendChild(fly(req, 'M35 90 H205', D, '0;1;1', '0;0.3;1'));
    var agent = popG(260, 90, [
      box(-46, -25, 92, 50, 'var(--blueprint,#3553ff)'),
      txt(0, -3, 'agent', '11'),
      txt(0, 13, 'fresh, ~us spawn', '7.5', 'var(--ink-mute,#777)')
    ], '0;0.3;0.4;0.78;0.84;1', D);
    svg.appendChild(agent);
    var link = svgEl('line', { x1: 260, y1: 115, x2: 260, y2: 152, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' });
    link.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.42;0.47;0.6;0.64;1', D));
    svg.appendChild(link);
    svg.appendChild(box(200, 152, 120, 34, 'var(--rule-soft,#ddd)'));
    svg.appendChild(txt(260, 173, 'session store', '9.5', 'var(--ink-soft,#555)'));
    var res = dot('5');
    res.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.64;0.68;0.86;0.9;1', D));
    svg.appendChild(fly(res, 'M315 90 H485', D, '0;0;1;1', '0;0.64;0.88;1'));
    svg.appendChild(txt(260, 214, 'stateless loop: the agent is disposable, the session is not', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'PRODUCTION RUNTIME', 'a fresh agent per request',
      svg,
      'Agno\'s recommended production shape: a stateless session-scoped backend where every request instantiates a fresh agent in microseconds, session state lives in a store, and the agent is torn down after the response. Mastra makes the same bet in TypeScript with typed Agents, Tools, and Workflows served behind standard server adapters.');
  }

  // ── wb-trace-ingest: spans stacking into a waterfall, a judge scores one ───
  function traceIngest(host) {
    var W = 520, H = 250, D = '4.8s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(38, 96, 104, 46, 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(90, 123, 'agent run', '10.5'));
    var feed = svgEl('line', { x1: 142, y1: 119, x2: 228, y2: 119, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    feed.appendChild(seq('stroke-dashoffset', '18;0;18', '0;0.5;1', D));
    svg.appendChild(feed);
    svg.appendChild(svgEl('rect', { x: 228, y: 30, width: 262, height: 192, rx: '5', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5', 'stroke-dasharray': '5 4' }));
    svg.appendChild(txt(359, 48, 'observability platform', '9', 'var(--ink-mute,#777)'));
    var spans = [
      { x: 244, y: 66, w: 196, lb: 'run' },
      { x: 258, y: 92, w: 124, lb: 'plan' },
      { x: 276, y: 118, w: 152, lb: 'tool call' },
      { x: 296, y: 144, w: 96, lb: 'model call' }
    ];
    var i;
    for (i = 0; i < spans.length; i++) {
      var s = spans[i], t0 = (0.1 + i * 0.11).toFixed(2), t1 = (0.18 + i * 0.11).toFixed(2);
      var g = popG(s.x + s.w / 2, s.y + 7, [
        svgEl('rect', { x: -s.w / 2, y: -7, width: s.w, height: 14, rx: '2', fill: 'var(--blueprint,#3553ff)', opacity: (1 - i * 0.18).toFixed(2) }),
        txt(-s.w / 2 + 4, 3, s.lb, '7.5', 'var(--bg,#fafaf5)', 'start')
      ], '0;' + t0 + ';' + t1 + ';0.86;0.9;1', D);
      svg.appendChild(g);
    }
    var judge = popG(430, 151, [
      svgEl('circle', { cx: 0, cy: 0, r: 13, fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }),
      txt(0, 3, 'eval', '7', 'var(--warn,#b8870f)')
    ], '0;0.6;0.68;0.86;0.9;1', D);
    svg.appendChild(judge);
    var verdict = popG(359, 196, [txt(0, 3, 'llm-judge: grounded, no hallucination', '8.5', 'var(--warn,#b8870f)')],
      '0;0.68;0.75;0.86;0.9;1', D);
    svg.appendChild(verdict);
    svg.appendChild(txt(260, 240, 'spans arrive, the waterfall assembles, a judge scores a span', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'AGENT OBSERVABILITY', 'spans into a scored waterfall',
      svg,
      'The platform layer above OTel GenAI: it ingests spans, renders the trace waterfall, and runs evaluations over individual steps. Langfuse pairs this with prompt management and session replay, Phoenix with RAG-focused evals and auto-instrumentation, Opik with prompt optimization and LLM-judge hallucination checks.');
  }

  // ── wb-runtime-shapes: queue, event, and cron intakes feeding one worker ───
  function runtimeShapes(host) {
    var W = 520, H = 250, D = '4.2s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(svgEl('rect', { x: 34 + i * 20, y: 42, width: 16, height: 16, rx: '2', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.3' }));
    }
    svg.appendChild(txt(64, 78, 'queue', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(svgEl('path', { d: 'M58 104 L50 120 L58 120 L50 136', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' }));
    svg.appendChild(txt(64, 152, 'event', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(svgEl('circle', { cx: 56, cy: 192, r: 13, fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.5' }));
    var hand = svgEl('line', { x1: 56, y1: 192, x2: 56, y2: 182, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.5' });
    hand.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 56 192', to: '360 56 192', dur: D, repeatCount: 'indefinite' }));
    svg.appendChild(hand);
    svg.appendChild(txt(90, 196, 'cron', '9', 'var(--ink-mute,#777)', 'start'));
    svg.appendChild(box(360, 90, 116, 62, 'var(--rule-soft,#ddd)'));
    var flash = svgEl('rect', { x: 362, y: 92, width: 112, height: 58, rx: '3', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
    flash.appendChild(seq('opacity', '0;0.35;0;0.35;0;0.35;0', '0;0.28;0.4;0.6;0.72;0.92;1', D));
    svg.appendChild(flash);
    svg.appendChild(txt(418, 117, 'agent worker', '10.5'));
    svg.appendChild(txt(418, 133, 'same loop inside', '7.5', 'var(--ink-mute,#777)'));
    var paths = ['M96 50 L360 108', 'M96 120 L360 121', 'M96 192 L360 136'];
    var fills = ['var(--blueprint,#3553ff)', 'var(--warn,#b8870f)', 'var(--ink-soft,#555)'];
    var wins = [['0;0.04;0.26;0.3;1', '0;1;1', '0;0.28;1'],
      ['0;0.36;0.58;0.62;1', '0;0;1;1', '0;0.32;0.6;1'],
      ['0;0.68;0.9;0.94;1', '0;0;1;1', '0;0.64;0.92;1']];
    for (i = 0; i < 3; i++) {
      var d = dot('5', fills[i]);
      d.appendChild(seq('opacity', i === 0 ? '0;1;1;0;0' : '0;0;1;0;0', wins[i][0], D));
      svg.appendChild(fly(d, paths[i], D, wins[i][1], wins[i][2]));
    }
    svg.appendChild(txt(300, 226, 'pick the intake shape first; the loop inside barely changes', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'RUNTIME SHAPES', 'three intakes, one worker',
      svg,
      'Queue-based background work, event-driven triggers, and scheduled cron jobs are three of the six production runtime shapes. Each intake delivers work to the same agent loop, but the shape decides which failures are survivable: a queue can retry, an event can replay, a cron must assume the last run died.');
  }

  // ── wb-seven-surfaces: workbench surfaces docking around a bare model ──────
  function sevenSurfaces(host) {
    var W = 520, H = 270, D = '6s', CX = 260, CY = 122, R = 92;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var ring = svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1', 'stroke-dasharray': '4 4' });
    ring.appendChild(seq('opacity', '0;0;0.55;0.55;0;0', '0;0.66;0.72;0.9;0.94;1', D));
    svg.appendChild(ring);
    svg.appendChild(box(CX - 42, CY - 19, 84, 38, 'var(--rule-soft,#ddd)'));
    var wob = svgEl('rect', { x: CX - 42, y: CY - 19, width: 84, height: 38, rx: '4', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' });
    wob.appendChild(seq('opacity', '1;1;0.15;1;0;0', '0;0.05;0.1;0.15;0.24;1', D));
    svg.appendChild(wob);
    var steady = svgEl('rect', { x: CX - 42, y: CY - 19, width: 84, height: 38, rx: '4', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' });
    steady.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.66;0.72;0.9;0.94;1', D));
    svg.appendChild(steady);
    svg.appendChild(txt(CX, CY + 4, 'capable model', '10'));
    var names = ['instructions', 'state', 'scope', 'feedback', 'verify', 'review', 'handoff'];
    var i;
    for (i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / 7;
      var x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
      var t0 = (0.08 + i * 0.08).toFixed(2), t1 = (0.14 + i * 0.08).toFixed(2);
      svg.appendChild(popG(x, y, [
        box(-35, -11, 70, 22, 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'),
        txt(0, 3, names[i], '8', 'var(--blueprint,#3553ff)')
      ], '0;' + t0 + ';' + t1 + ';0.9;0.94;1', D));
    }
    svg.appendChild(txt(CX, 258, 'the model is constant; the surfaces are what changed', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'THE WORKBENCH', 'seven surfaces dock around the model',
      svg,
      'A frontier model on its own flickers: plausible code, no definition of done, no record of what it assumed. Reliability appears as the seven workbench surfaces dock around it, one by one: instructions, state, scope, feedback, verification, review, and handoff. Strip any one away and its failure mode comes back.');
  }

  // ── wb-three-files: the read-work-write cycle over three workbench files ───
  function threeFiles(host) {
    var W = 520, H = 250, D = '5s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(50, 98, 110, 54, 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(105, 122, 'agent loop', '10.5'));
    var work = txt(105, 138, 'working...', '7.5', 'var(--ink-mute,#777)');
    work.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.34;0.4;0.56;0.6;1', D));
    svg.appendChild(work);
    var files = [
      { y: 40, lb: 'AGENTS.md', sub: 'root router' },
      { y: 108, lb: 'agent_state.json', sub: 'durable state' },
      { y: 176, lb: 'task_board.json', sub: 'in flight / blocked / next' }
    ];
    var i;
    for (i = 0; i < files.length; i++) {
      svg.appendChild(box(320, files[i].y, 160, 42, 'var(--rule-soft,#ddd)'));
      svg.appendChild(txt(400, files[i].y + 18, files[i].lb, '9'));
      svg.appendChild(txt(400, files[i].y + 32, files[i].sub, '7.5', 'var(--ink-mute,#777)'));
    }
    var reads = [
      ['M160 110 L320 58', '0;0.03;0.15;0.18;1', '0;1;1', '0;0.16;1'],
      ['M160 118 L320 126', '0;0.2;0.3;0.33;1', '0;0;1;1', '0;0.19;0.31;1']
    ];
    for (i = 0; i < reads.length; i++) {
      var rd = dot('4.5');
      rd.appendChild(seq('opacity', i === 0 ? '0;1;1;0;0' : '0;0;1;0;0', reads[i][1], D));
      svg.appendChild(fly(rd, reads[i][0], D, reads[i][2], reads[i][3]));
    }
    var writes = [
      ['M160 128 L320 132', '0;0.62;0.72;0.75;1', '0;0;1;1', '0;0.61;0.73;1', 152],
      ['M160 140 L320 194', '0;0.78;0.88;0.91;1', '0;0;1;1', '0;0.77;0.89;1', 220]
    ];
    for (i = 0; i < writes.length; i++) {
      var wr = dot('4.5', 'var(--warn,#b8870f)');
      wr.appendChild(seq('opacity', '0;0;1;0;0', writes[i][1], D));
      svg.appendChild(fly(wr, writes[i][0], D, writes[i][2], writes[i][3]));
      var mark = svgEl('rect', { x: 466, y: writes[i][4] - 40, width: 8, height: 8, rx: '1', fill: 'var(--warn,#b8870f)' });
      mark.appendChild(seq('opacity', '0;0;1;1;0;0', '0;' + (0.72 + i * 0.16).toFixed(2) + ';' + (0.76 + i * 0.16).toFixed(2) + ';0.94;0.97;1', D));
      svg.appendChild(mark);
    }
    svg.appendChild(txt(260, 236, 'read at turn start (blue), write at turn end (amber)', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'MINIMAL WORKBENCH', 'three files, one cycle',
      svg,
      'The smallest useful workbench: a short root router the agent reads first, a state file it reads before acting and writes after, and a task board that says what is in flight, blocked, and next. Reads open every turn, writes close it, and no part of the cycle depends on chat history surviving.');
  }

  // ── wb-rule-checkoff: a rule set scored against a real run ─────────────────
  function ruleCheckoff(host) {
    var W = 520, H = 250, D = '4.4s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 40, y: 36, width: 280, height: 176, rx: '5', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(180, 28, 'docs/agent-rules.md', '9', 'var(--ink-mute,#777)'));
    var scan = svgEl('rect', { x: 46, y: 48, width: 268, height: 30, rx: '3', fill: 'var(--bg-surface,#eee)' });
    scan.appendChild(seq('y', '48;48;88;128;168;168', '0;0.08;0.26;0.46;0.66;1', D));
    scan.appendChild(seq('opacity', '0;0.9;0.9;0.9;0.9;0', '0;0.08;0.26;0.46;0.7;1', D));
    svg.appendChild(scan);
    var rules = ['startup: init ran before any edit', 'forbidden: no writes outside scope', 'done: tests actually ran', 'uncertainty: asked before assuming'];
    var pass = [true, false, true, true];
    var i;
    for (i = 0; i < 4; i++) {
      var y = 63 + i * 40;
      svg.appendChild(txt(54, y + 4, rules[i], '8.5', 'var(--ink-soft,#555)', 'start'));
      var t0 = (0.14 + i * 0.2).toFixed(2), t1 = (0.2 + i * 0.2).toFixed(2);
      var mark = pass[i]
        ? svgEl('path', { d: 'M-6 0 L-2 5 L7 -6', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.5' })
        : svgEl('path', { d: 'M-5 -5 L5 5 M5 -5 L-5 5', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '2.5' });
      svg.appendChild(popG(300, y, [mark], '0;' + t0 + ';' + t1 + ';0.92;0.96;1', D));
    }
    svg.appendChild(box(360, 60, 130, 56, 'var(--rule-soft,#ddd)'));
    svg.appendChild(txt(425, 84, 'run artifacts', '9'));
    svg.appendChild(txt(425, 99, 'diff + feedback log', '7.5', 'var(--ink-mute,#777)'));
    svg.appendChild(popG(425, 160, [
      txt(0, -4, 'score 3 / 4', '11', 'var(--warn,#b8870f)'),
      txt(0, 12, 'one violation, named', '7.5', 'var(--ink-mute,#777)')
    ], '0;0.78;0.85;0.92;0.96;1', D));
    svg.appendChild(txt(260, 238, 'each rule is a check, not a wish', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'RULES AS CONSTRAINTS', 'a run scored against the rule set',
      svg,
      'Prose instructions say "be careful"; constraints say which check failed. The rule checker walks the rule set against the run artifacts and marks each rule pass or fail, so a violation is a named line in a report instead of a vibe. Diff-friendly rules mean review sees exactly which constraint changed.');
  }

  // ── wb-state-persist: chat evaporates, the repo file survives the boundary ─
  function statePersist(host) {
    var W = 520, H = 260, D = '5s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(txt(50, 32, 'chat (volatile)', '9', 'var(--ink-mute,#777)', 'start'));
    var bx = [60, 190, 320], i;
    for (i = 0; i < 3; i++) {
      var t0 = (0.04 + i * 0.06).toFixed(2), t1 = (0.09 + i * 0.06).toFixed(2);
      svg.appendChild(popG(bx[i] + 55, 56, [
        svgEl('rect', { x: -55, y: -12, width: 110, height: 24, rx: '11', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }),
        txt(0, 3, i === 0 ? 'let me check...' : i === 1 ? 'editing utils.py' : 'done, I think', '8', 'var(--ink-soft,#555)')
      ], '0;' + t0 + ';' + t1 + ';0.42;0.47;1', D));
    }
    var ends = txt(260, 96, 'session ends', '9', 'var(--warn,#b8870f)');
    ends.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.42;0.47;0.58;0.62;1', D));
    svg.appendChild(ends);
    svg.appendChild(svgEl('line', { x1: 40, y1: 108, x2: 480, y2: 108, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '4 4' }));
    svg.appendChild(txt(50, 126, 'repo (durable)', '9', 'var(--ink-mute,#777)', 'start'));
    var wd = dot('4.5', 'var(--warn,#b8870f)');
    wd.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.16;0.19;0.3;0.33;1', D));
    svg.appendChild(fly(wd, 'M115 68 L150 178 L196 178', D, '0;0;0.7;1;1', '0;0.16;0.26;0.33;1'));
    var dia = svgEl('path', { d: 'M150 164 L164 178 L150 192 L136 178 Z', fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.3' });
    dia.appendChild(seq('stroke', 'var(--rule-soft,#ddd);var(--rule-soft,#ddd);var(--blueprint,#3553ff);var(--rule-soft,#ddd);var(--rule-soft,#ddd)', '0;0.24;0.28;0.34;1', D));
    svg.appendChild(dia);
    svg.appendChild(txt(150, 206, 'schema', '7.5', 'var(--ink-mute,#777)'));
    svg.appendChild(box(196, 150, 160, 58, 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'));
    svg.appendChild(txt(276, 172, 'agent_state.json', '9.5', 'var(--blueprint,#3553ff)'));
    var r6 = txt(276, 190, 'rev 6', '8', 'var(--ink-mute,#777)');
    r6.appendChild(seq('opacity', '1;1;0;0;1', '0;0.3;0.36;0.97;1', D));
    svg.appendChild(r6);
    var r7 = txt(276, 190, 'rev 7 · atomic write', '8', 'var(--ink-mute,#777)');
    r7.appendChild(seq('opacity', '0;0;1;1;0', '0;0.3;0.36;0.97;1', D));
    svg.appendChild(r7);
    var next = popG(430, 178, [
      txt(0, -4, 'next session', '8.5', 'var(--blueprint,#3553ff)'),
      txt(0, 10, 'reads the same file', '7.5', 'var(--ink-mute,#777)')
    ], '0;0.66;0.74;0.92;0.96;1', D);
    svg.appendChild(next);
    svg.appendChild(txt(260, 244, 'chat evaporates; the repo remembers', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'REPO MEMORY', 'state survives the session boundary',
      svg,
      'The chat bubbles dissolve when the session ends; the state file does not. A write goes through the schema check before it lands, the revision advances atomically, and the next session, the next agent, and the reviewer all read the same versioned file instead of re-deriving where the work left off.');
  }

  // ── wb-init-probes: health checks light up before the gate opens ───────────
  function initProbes(host) {
    var W = 520, H = 260, D = '4.6s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var probes = ['runtime', 'deps', 'paths', 'tests'];
    var i;
    for (i = 0; i < 4; i++) {
      var y = 52 + i * 44;
      var t0 = (0.08 + i * 0.13).toFixed(2), t1 = (0.14 + i * 0.13).toFixed(2);
      var lamp = svgEl('circle', { cx: 70, cy: y, r: 9, fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
      lamp.appendChild(seq('fill', 'var(--bg-surface,#eee);var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '0;' + t0 + ';' + t1 + ';0.92;1', D));
      svg.appendChild(lamp);
      svg.appendChild(txt(90, y + 4, probes[i], '9', 'var(--ink-soft,#555)', 'start'));
      var row = svgEl('rect', { x: 196, y: y - 5, width: 96, height: 10, rx: '2', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
      row.appendChild(seq('opacity', '0;0;0.75;0.75;0;0', '0;' + t1 + ';' + (0.2 + i * 0.13).toFixed(2) + ';0.88;0.92;1', D));
      svg.appendChild(row);
    }
    svg.appendChild(svgEl('rect', { x: 186, y: 30, width: 116, height: 186, rx: '5', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(244, 232, 'init_report.json', '8.5', 'var(--ink-mute,#777)'));
    var gate = svgEl('rect', { x: 366, y: 82, width: 8, height: 84, rx: '2', fill: 'var(--ink-soft,#555)' });
    gate.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;0 0;0 -84;0 -84;0 0', keyTimes: '0;0.62;0.72;0.94;1', dur: D, repeatCount: 'indefinite', calcMode: 'spline', keySplines: sp(4) }));
    svg.appendChild(gate);
    svg.appendChild(txt(370, 66, 'gate', '8', 'var(--ink-mute,#777)'));
    var run = dot('6');
    run.appendChild(seq('opacity', '0;1;1;1;0;0', '0;0.04;0.72;0.88;0.92;1', D));
    svg.appendChild(fly(run, 'M340 124 H478', D, '0;0;1;1', '0;0.72;0.86;1'));
    svg.appendChild(txt(452, 150, 'work', '8.5', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(260, 254, 'probe once, persist the answers, then start', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'INIT SCRIPT', 'health checks before the first edit',
      svg,
      'One deterministic script probes the runtime, dependencies, paths, and test command before the agent does anything else, and writes each answer into an init report. Only when every lamp is lit does the gate lift and real work begin; a cold session reads the report instead of paying the discovery tax again.');
  }

  // ── wb-scope-bounce: one diff lands in scope, one bounces off the glob ─────
  function scopeBounce(host) {
    var W = 520, H = 250, D = '4.2s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 300, y: 36, width: 184, height: 72, rx: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5', 'stroke-dasharray': '6 4' }));
    svg.appendChild(txt(392, 58, 'allowed', '9', 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(392, 74, 'src/auth/**', '8.5', 'var(--ink-mute,#777)'));
    svg.appendChild(svgEl('rect', { x: 300, y: 140, width: 184, height: 72, rx: '5', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(392, 162, 'forbidden', '9', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(392, 178, 'db/** · release/**', '8.5', 'var(--ink-mute,#777)'));
    var edge = svgEl('line', { x1: 300, y1: 140, x2: 300, y2: 212, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2' });
    edge.appendChild(seq('stroke-width', '2;2;6;2;2', '0;0.58;0.62;0.68;1', D));
    svg.appendChild(edge);
    var chipA = svgEl('g', {}, [
      box(-30, -12, 60, 24, 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'),
      txt(0, 3, 'diff A', '8.5', 'var(--blueprint,#3553ff)')
    ]);
    chipA.appendChild(seq('opacity', '0;1;1;0;0', '0;0.05;0.88;0.93;1', D));
    svg.appendChild(fly(chipA, 'M64 84 H388', D, '0;1;1', '0;0.3;1'));
    var chipB = svgEl('g', {}, [
      box(-30, -12, 60, 24, 'var(--warn,#b8870f)', 'var(--bg,#fafaf5)'),
      txt(0, 3, 'diff B', '8.5', 'var(--warn,#b8870f)')
    ]);
    chipB.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.3;0.34;0.85;0.9;1', D));
    svg.appendChild(fly(chipB, 'M64 176 L264 176 L204 196', D, '0;0;0.77;1;1', '0;0.32;0.58;0.7;1'));
    svg.appendChild(popG(150, 232, [txt(0, 3, 'violation: db/** touched, rolled back', '8.5', 'var(--warn,#b8870f)')],
      '0;0.66;0.73;0.85;0.9;1', D));
    svg.appendChild(txt(150, 40, 'scope_contract.json', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(150, 56, 'allowed + forbidden + rollback', '8', 'var(--ink-mute,#777)'));
    shell(host, 'SCOPE CONTRACT', 'a diff bounces off the forbidden glob',
      svg,
      'The contract lists where the task may write and where it must not. A diff that lands inside the allowed glob passes; a diff that drifts toward a forbidden path hits the contract boundary, bounces, and becomes a named violation with a rollback plan, caught by the checker rather than by a reviewer two days later.');
  }

  // ── wb-feedback-loop: captured exit codes route back into the next turn ────
  function feedbackLoop(host) {
    var W = 520, H = 260, D = '5s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(48, 56, 110, 50, 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(103, 85, 'agent turn', '10'));
    svg.appendChild(box(218, 56, 100, 50, 'var(--rule-soft,#ddd)'));
    svg.appendChild(txt(268, 79, 'runner', '10'));
    svg.appendChild(txt(268, 94, 'wraps the cmd', '7.5', 'var(--ink-mute,#777)'));
    svg.appendChild(box(382, 56, 90, 50, 'var(--rule-soft,#ddd)'));
    svg.appendChild(txt(427, 85, 'shell', '10'));
    svg.appendChild(box(190, 168, 168, 52, 'var(--rule-soft,#ddd)', 'var(--bg,#fafaf5)'));
    svg.appendChild(txt(274, 186, 'feedback_record.jsonl', '8.5', 'var(--ink-soft,#555)'));
    var rec1 = txt(274, 204, 'exit 1 · stderr captured', '8.5', 'var(--warn,#b8870f)');
    rec1.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.24;0.29;0.6;0.64;1', D));
    svg.appendChild(rec1);
    var rec2 = txt(274, 204, 'exit 0 · 412ms', '8.5', 'var(--blueprint,#3553ff)');
    rec2.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.76;0.81;0.95;0.98;1', D));
    svg.appendChild(rec2);
    svg.appendChild(svgEl('path', { d: 'M427 106 L427 194 L358 194', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    svg.appendChild(svgEl('path', { d: 'M190 194 L103 194 L103 106', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    var runs = [
      ['M158 74 L382 74', '0;0.03;0.17;0.2;1', '0;1;1', '0;0.18;1', 'var(--blueprint,#3553ff)', '0;1;1;0;0'],
      ['M427 106 L427 194 L358 194', '0;0.2;0.28;0.31;1', '0;0;1;1', '0;0.2;0.29;1', 'var(--warn,#b8870f)', '0;0;1;0;0'],
      ['M190 194 L103 194 L103 106', '0;0.34;0.46;0.49;1', '0;0;1;1', '0;0.34;0.47;1', 'var(--warn,#b8870f)', '0;0;1;0;0'],
      ['M158 88 L382 88', '0;0.55;0.69;0.72;1', '0;0;1;1', '0;0.55;0.7;1', 'var(--blueprint,#3553ff)', '0;0;1;0;0'],
      ['M427 106 L427 194 L358 194', '0;0.72;0.8;0.83;1', '0;0;1;1', '0;0.72;0.81;1', 'var(--blueprint,#3553ff)', '0;0;1;0;0']
    ];
    var i;
    for (i = 0; i < runs.length; i++) {
      var m = dot('4.5', runs[i][4]);
      m.appendChild(seq('opacity', runs[i][5], runs[i][1], D));
      svg.appendChild(fly(m, runs[i][0], D, runs[i][2], runs[i][3]));
    }
    svg.appendChild(txt(260, 246, 'the error routes back in; the retry reacts to facts', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'FEEDBACK LOOP', 'exit codes flow back into the turn',
      svg,
      'Every command goes through the runner, which captures stdout, stderr, exit code, and duration into a structured record. The first run fails with exit 1 and that record, not the agent\'s imagination of the output, routes back into the next turn; the retry then earns its exit 0 on the same evidence trail the gate will read.');
  }

  // ── wb-gate-sequence: a diff clears three gates, the fourth blocks it ──────
  function gateSequence(host) {
    var W = 520, H = 240, D = '4.6s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: 40, y1: 120, x2: 480, y2: 120, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    var gx = [150, 240, 330, 420];
    var names = ['rules', 'scope', 'feedback', 'accept'];
    var i;
    for (i = 0; i < 4; i++) {
      var bar = svgEl('rect', { x: gx[i] - 4, y: 84, width: 8, height: 72, rx: '2', fill: i < 3 ? 'var(--ink-soft,#555)' : 'var(--warn,#b8870f)' });
      if (i < 3) {
        var tp = (0.12 + i * 0.18).toFixed(2), tq = (0.2 + i * 0.18).toFixed(2), tr = (0.3 + i * 0.18).toFixed(2);
        bar.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;0 0;0 -46;0 -46;0 0;0 0', keyTimes: '0;' + tp + ';' + tq + ';' + tr + ';' + (0.38 + i * 0.18).toFixed(2) + ';1', dur: D, repeatCount: 'indefinite', calcMode: 'spline', keySplines: sp(5) }));
      } else {
        bar.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;0 0;3 0;-3 0;0 0;0 0', keyTimes: '0;0.68;0.7;0.72;0.74;1', dur: D, repeatCount: 'indefinite' }));
      }
      svg.appendChild(bar);
      svg.appendChild(txt(gx[i], 174, names[i], '8.5', i < 3 ? 'var(--ink-mute,#777)' : 'var(--warn,#b8870f)'));
    }
    var chip = svgEl('g', {}, [
      box(-26, -12, 52, 24, 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'),
      txt(0, 3, 'diff', '9', 'var(--blueprint,#3553ff)')
    ]);
    chip.appendChild(seq('opacity', '0;1;1;0;0', '0;0.05;0.9;0.95;1', D));
    svg.appendChild(fly(chip, 'M62 120 H388', D, '0;1;1', '0;0.66;1'));
    svg.appendChild(popG(300, 52, [txt(0, 3, 'blocked: acceptance never ran', '9', 'var(--warn,#b8870f)')],
      '0;0.72;0.78;0.9;0.94;1', D));
    svg.appendChild(popG(260, 210, [txt(0, 3, 'verification_report.json · passed: false', '8.5', 'var(--ink-mute,#777)')],
      '0;0.78;0.84;0.92;0.96;1', D));
    shell(host, 'VERIFICATION GATE', 'ordered gates, one verdict',
      svg,
      'The gate is a deterministic function over artifacts the agent already produced: the rule report, the scope report, the feedback records, and the diff. The change clears rules, scope, and feedback, but acceptance has no record of ever running, so the final gate stays down and done stays false, whatever the chat claimed.');
  }

  // ── wb-builder-marker: artifacts cross the wall to an independent marker ───
  function builderMarker(host) {
    var W = 520, H = 250, D = '4.4s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: 260, y1: 30, x2: 260, y2: 96, stroke: 'var(--ink-soft,#555)', 'stroke-width': '2' }));
    svg.appendChild(svgEl('line', { x1: 260, y1: 128, x2: 260, y2: 200, stroke: 'var(--ink-soft,#555)', 'stroke-width': '2' }));
    svg.appendChild(box(50, 82, 120, 54, 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(110, 106, 'builder', '10.5'));
    svg.appendChild(txt(110, 122, 'wrote the change', '7.5', 'var(--ink-mute,#777)'));
    svg.appendChild(box(350, 82, 130, 54, 'var(--rule-soft,#ddd)'));
    var rev = svgEl('rect', { x: 352, y: 84, width: 126, height: 50, rx: '3', fill: 'var(--blueprint,#3553ff)', opacity: '0' });
    rev.appendChild(seq('opacity', '0;0;0.3;0;0', '0;0.4;0.47;0.54;1', D));
    svg.appendChild(rev);
    svg.appendChild(txt(415, 106, 'reviewer', '10.5'));
    svg.appendChild(txt(415, 122, 'read-only, own prompt', '7.5', 'var(--ink-mute,#777)'));
    var bundle = svgEl('g', {}, [
      svgEl('rect', { x: -24, y: -16, width: 44, height: 24, rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }),
      svgEl('rect', { x: -18, y: -8, width: 44, height: 24, rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2' }),
      txt(4, 8, 'artifacts', '7', 'var(--blueprint,#3553ff)')
    ]);
    bundle.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.08;0.14;0.36;0.4;1', D));
    svg.appendChild(fly(bundle, 'M196 110 L330 110', D, '0;0;1;1', '0;0.14;0.34;1'));
    svg.appendChild(popG(415, 190, [
      box(-62, -20, 124, 40, 'var(--rule-soft,#ddd)', 'var(--bg,#fafaf5)'),
      txt(0, -3, 'review_report.json', '8.5', 'var(--ink-soft,#555)'),
      txt(0, 12, 'scored per rubric line', '7.5', 'var(--ink-mute,#777)'),
      svgEl('circle', { cx: 48, cy: -12, r: 10, fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' })
    ], '0;0.56;0.66;0.9;0.94;1', D));
    svg.appendChild(txt(260, 236, 'artifacts cross the wall; edits never cross back', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'REVIEWER AGENT', 'builder output crosses to a marker',
      svg,
      'The builder cannot grade its own work, so its artifacts pass through a slot in the wall to a second loop with a different system prompt, a different goal, and read-only access. The reviewer grades against a rubric line by line and emits a report; nothing it does can modify what the builder produced.');
  }

  // ── wb-handoff-packet: state arcs across the gap between sessions ──────────
  function handoffPacket(host) {
    var W = 520, H = 260, D = '5.2s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var left = svgEl('g', {}, [
      svgEl('rect', { x: 40, y: 50, width: 172, height: 124, rx: '5', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }),
      txt(126, 68, 'session n', '9', 'var(--ink-mute,#777)')
    ]);
    left.appendChild(seq('opacity', '1;1;0.3;0.3;1', '0;0.5;0.58;0.96;1', D));
    svg.appendChild(left);
    var chips = [['state', 70, 96], ['verdict', 70, 128], ['review', 70, 160]];
    var i;
    for (i = 0; i < 3; i++) {
      var c = svgEl('g', {}, [
        svgEl('rect', { x: -26, y: -10, width: 52, height: 20, rx: '3', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2' }),
        txt(0, 3, chips[i][0], '7.5', 'var(--ink-soft,#555)')
      ]);
      c.appendChild(seq('opacity', '0;1;1;0;0', '0;' + (0.04 + i * 0.03).toFixed(2) + ';0.3;0.36;1', D));
      svg.appendChild(fly(c, 'M' + (chips[i][1] + 26) + ' ' + chips[i][2] + ' L172 150', D, '0;0;1;1', '0;0.22;0.34;1'));
    }
    var packet = svgEl('g', {}, [
      box(-34, -15, 68, 30, 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'),
      txt(0, 4, 'handoff', '8.5', 'var(--blueprint,#3553ff)')
    ]);
    packet.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.34;0.4;0.62;0.66;1', D));
    packet.appendChild(svgEl('animateMotion', { path: 'M172 150 Q260 76 348 150', dur: D, repeatCount: 'indefinite', keyPoints: '0;0;1;1', keyTimes: '0;0.44;0.6;1', calcMode: 'spline', keySplines: '0.23 1 0.32 1;0.23 1 0.32 1;0.23 1 0.32 1' }));
    svg.appendChild(packet);
    var gap = txt(260, 44, 'session boundary', '8.5', 'var(--warn,#b8870f)');
    gap.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.44;0.5;0.62;0.66;1', D));
    svg.appendChild(gap);
    var right = svgEl('g', {}, [
      svgEl('rect', { x: 308, y: 50, width: 172, height: 124, rx: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }),
      txt(394, 68, 'session n+1', '9', 'var(--blueprint,#3553ff)')
    ]);
    right.appendChild(seq('opacity', '0.3;0.3;1;1;0.3', '0;0.58;0.66;0.96;1', D));
    svg.appendChild(right);
    svg.appendChild(popG(394, 132, [
      txt(0, -4, 'first action:', '8', 'var(--ink-mute,#777)'),
      txt(0, 10, 'rerun the failing test', '8.5', 'var(--ink,#1a1a1a)')
    ], '0;0.68;0.76;0.92;0.96;1', D));
    svg.appendChild(txt(260, 244, 'what changed, what failed, what is next, what to do first', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'MULTI-SESSION HANDOFF', 'a packet carries state across the gap',
      svg,
      'At session end the workbench compresses state, verdict, and review into one handoff packet and throws it across the boundary. The old session dims, the new one lights up already knowing its first action, so the next agent is productive in the first minute instead of spending thirty rediscovering the last thirty seconds.');
  }

  // ── wb-ab-runs: the same task through both pipelines, five outcomes each ───
  function abRuns(host) {
    var W = 520, H = 260, D = '4.8s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(170, 24, 180, 26, 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'));
    svg.appendChild(txt(260, 41, 'task: validate /signup', '9', 'var(--blueprint,#3553ff)'));
    svg.appendChild(svgEl('path', { d: 'M200 50 L130 74', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('path', { d: 'M320 50 L390 74', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.4' }));
    svg.appendChild(txt(130, 90, 'prompt-only', '9.5', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(390, 90, 'workbench', '9.5', 'var(--blueprint,#3553ff)'));
    var metrics = ['tests pass', 'scope held', 'feedback real', 'handoff usable', 'no reverts'];
    var passA = [false, false, true, false, false];
    var i;
    for (i = 0; i < 5; i++) {
      var y = 112 + i * 24;
      svg.appendChild(txt(260, y + 4, metrics[i], '8.5', 'var(--ink-mute,#777)'));
      var tA = (0.14 + i * 0.1).toFixed(2), tA1 = (0.2 + i * 0.1).toFixed(2);
      var tB = (0.19 + i * 0.1).toFixed(2), tB1 = (0.25 + i * 0.1).toFixed(2);
      var mA = passA[i]
        ? svgEl('path', { d: 'M-5 0 L-1 4 L6 -5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.2' })
        : svgEl('path', { d: 'M-4 -4 L4 4 M4 -4 L-4 4', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '2.2' });
      svg.appendChild(popG(130, y, [mA], '0;' + tA + ';' + tA1 + ';0.9;0.94;1', D));
      var mB = svgEl('path', { d: 'M-5 0 L-1 4 L6 -5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.2' });
      svg.appendChild(popG(390, y, [mB], '0;' + tB + ';' + tB1 + ';0.9;0.94;1', D));
    }
    svg.appendChild(popG(130, 244, [txt(0, 3, '1 / 5', '11', 'var(--warn,#b8870f)')], '0;0.74;0.8;0.9;0.94;1', D));
    svg.appendChild(popG(390, 244, [txt(0, 3, '5 / 5', '11', 'var(--blueprint,#3553ff)')], '0;0.78;0.84;0.9;0.94;1', D));
    shell(host, 'BEFORE / AFTER', 'one task, two pipelines, five outcomes',
      svg,
      'The same task runs twice on the same repo: once prompt-only, once through the full workbench. Five measured outcomes do the arguing: tests, scope, feedback records, handoff quality, and reverts. The model is identical in both lanes; the surfaces are the only variable, and the tally is the case you hand a skeptic.');
  }

  // ── wb-pack-install: the workbench pack copied into a target repo ──────────
  function packInstall(host) {
    var W = 520, H = 250, D = '4.8s';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 36, y: 44, width: 158, height: 158, rx: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(115, 36, 'agent-workbench-pack/', '8.5', 'var(--blueprint,#3553ff)'));
    svg.appendChild(svgEl('rect', { x: 326, y: 44, width: 158, height: 158, rx: '5', fill: 'none', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(405, 36, 'target repo', '8.5', 'var(--ink-mute,#777)'));
    var rows = ['AGENTS.md', 'schemas/', 'scripts/', 'docs/templates/'];
    var i;
    for (i = 0; i < 4; i++) {
      var y = 66 + i * 34;
      svg.appendChild(svgEl('rect', { x: 48, y: y - 9, width: 134, height: 20, rx: '2', fill: 'var(--bg-surface,#eee)' }));
      svg.appendChild(txt(54, y + 4, rows[i], '8', 'var(--ink-soft,#555)', 'start'));
      var slot = svgEl('rect', { x: 338, y: y - 9, width: 134, height: 20, rx: '2', fill: 'var(--bg,#fafaf5)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.2', 'stroke-dasharray': '4 3' });
      var ta = (0.22 + i * 0.11).toFixed(2);
      slot.appendChild(seq('fill', 'var(--bg,#fafaf5);var(--bg,#fafaf5);var(--bg-surface,#eee);var(--bg-surface,#eee);var(--bg,#fafaf5)', '0;' + ta + ';' + (0.26 + i * 0.11).toFixed(2) + ';0.94;1', D));
      slot.appendChild(seq('stroke-dasharray', '4 3;4 3;1 0;1 0;4 3', '0;' + ta + ';' + (0.26 + i * 0.11).toFixed(2) + ';0.94;1', D));
      svg.appendChild(slot);
      var chip = svgEl('rect', { x: -14, y: -6, width: 28, height: 12, rx: '2', fill: 'var(--blueprint,#3553ff)' });
      var g = svgEl('g', {}, [chip]);
      g.appendChild(seq('opacity', '0;0;1;0;0', '0;' + (0.1 + i * 0.11).toFixed(2) + ';' + (0.16 + i * 0.11).toFixed(2) + ';' + ta + ';1', D));
      svg.appendChild(fly(g, 'M182 ' + y + ' L338 ' + y, D, '0;0;1;1', '0;' + (0.1 + i * 0.11).toFixed(2) + ';' + ta + ';1'));
    }
    svg.appendChild(txt(260, 110, 'bin/install.sh', '8.5', 'var(--ink-mute,#777)'));
    var rerun = svgEl('line', { x1: 194, y1: 170, x2: 326, y2: 170, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5', 'stroke-dasharray': '5 4' });
    rerun.appendChild(seq('opacity', '0;0;1;1;0;0', '0;0.72;0.76;0.86;0.9;1', D));
    svg.appendChild(rerun);
    svg.appendChild(popG(260, 190, [txt(0, 3, 'second run: already present, skipped', '8', 'var(--warn,#b8870f)')],
      '0;0.78;0.84;0.9;0.94;1', D));
    svg.appendChild(txt(260, 234, 'one command lays the workbench down, idempotently', '9.5', 'var(--ink-mute,#777)'));
    shell(host, 'WORKBENCH PACK', 'cp -r and the agent works tomorrow',
      svg,
      'The capstone compresses eleven lessons of surfaces into one versioned directory: the router, the schemas, the scripts, the templates, and a single installer. Each file lands in its slot in the target repo, and a second run detects what is already present and skips it, so the pack is safe to reapply forever.');
  }

  LF.register({
    'wb-runtime-spawn': runtimeSpawn,
    'wb-trace-ingest': traceIngest,
    'wb-runtime-shapes': runtimeShapes,
    'wb-seven-surfaces': sevenSurfaces,
    'wb-three-files': threeFiles,
    'wb-rule-checkoff': ruleCheckoff,
    'wb-state-persist': statePersist,
    'wb-init-probes': initProbes,
    'wb-scope-bounce': scopeBounce,
    'wb-feedback-loop': feedbackLoop,
    'wb-gate-sequence': gateSequence,
    'wb-builder-marker': builderMarker,
    'wb-handoff-packet': handoffPacket,
    'wb-ab-runs': abRuns,
    'wb-pack-install': packInstall
  });
})();
