/* figures-agents4.js - animated lesson figures for agent engineering.
   Loads after lesson-figures.js, registers through window.LF. No deps, ES5,
   theme via CSS vars. SMIL-only animation: no JS render loops. Authoring: a
   ```figure block naming one of the widgets below. */
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
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur };
    if (extra) for (var k in extra) a[k] = extra[k];
    return LF.smil('animate', a);
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '11', fill: fill || 'var(--ink,#1a1a1a)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }

  // -- ae-memory-fusion: a query splitting into three stores, scores fusing ---
  function memoryFusion(host) {
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var stores = [
      { y: 50, name: 'VECTOR', sub: 'semantic', w: '0.50' },
      { y: 110, name: 'KV', sub: 'fact lookup', w: '0.30' },
      { y: 170, name: 'GRAPH', sub: 'relations', w: '0.20' }
    ];
    svg.appendChild(svgEl('rect', { x: 24, y: 95, width: 80, height: 40, rx: '5', fill: 'var(--blueprint,#3553ff)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(64, 119, 'query', '11', 'var(--bg,#fafaf5)'));
    var i;
    for (i = 0; i < 3; i++) {
      var s = stores[i];
      var b = svgEl('rect', { x: 210, y: s.y, width: 110, height: 40, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
      b.appendChild(anim('stroke', 'var(--rule-soft,#ddd);var(--blueprint,#3553ff);var(--rule-soft,#ddd)', '3s', { begin: (i * 0.4) + 's' }));
      svg.appendChild(b);
      svg.appendChild(txt(265, s.y + 17, s.name, '11', 'var(--blueprint,#3553ff)'));
      svg.appendChild(txt(265, s.y + 31, s.sub, '8', 'var(--ink-mute,#777)'));
      var into = svgEl('line', { x1: 104, y1: 115, x2: 210, y2: s.y + 20, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
      into.appendChild(anim('stroke-dashoffset', '18;0', '0.8s', { begin: (i * 0.4) + 's' }));
      svg.appendChild(into);
      var out = svgEl('line', { x1: 320, y1: s.y + 20, x2: 420, y2: 115, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
      out.appendChild(anim('stroke-dashoffset', '18;0', '0.8s', { begin: (1.4 + i * 0.4) + 's' }));
      svg.appendChild(out);
      var pulse = svgEl('circle', { cx: '0', cy: '0', r: '4', fill: 'var(--warn,#b8870f)', opacity: '0' });
      pulse.appendChild(LF.smil('animateMotion', { dur: '3s', begin: (i * 0.4) + 's', path: 'M320 ' + (s.y + 20) + ' L420 115', keyPoints: '0;0;1;1', keyTimes: '0;0.5;0.85;1', calcMode: 'linear' }));
      pulse.appendChild(anim('opacity', '0;0;1;1', '3s', { begin: (i * 0.4) + 's' }));
      svg.appendChild(pulse);
      svg.appendChild(txt(355, s.y + 17, 'w ' + s.w, '8', 'var(--ink-mute,#777)'));
    }
    var fuse = svgEl('rect', { x: 420, y: 95, width: 76, height: 40, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' });
    fuse.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '3s', { begin: '2.2s' }));
    svg.appendChild(fuse);
    svg.appendChild(txt(458, 119, 'fuse', '11', 'var(--ink,#1a1a1a)'));
    svg.appendChild(txt(260, 232, 'score = relevance + importance + recency, weighted sum', '10', 'var(--ink-mute,#777)'));
    shell(host, 'HYBRID MEMORY', 'one query, three stores',
      svg,
      'Mem0 writes every memory to three stores at once and fuses them on retrieval. Vector answers semantic similarity, KV answers fact lookup, graph answers relationship reasoning. A weighted score over relevance, importance, and recency blends the three, so the single add/search surface is never wrong for two of three query classes the way one store always is.');
  }

  // -- ae-crew-vs-flow: autonomous role mesh against a deterministic chain ----
  function crewVsFlow(host) {
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(txt(135, 28, 'CREW', '11', 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(135, 42, 'autonomous, role-based', '8', 'var(--ink-mute,#777)'));
    var roles = [[70, 80], [200, 80], [135, 160]];
    var i, j;
    for (i = 0; i < 3; i++) for (j = i + 1; j < 3; j++) {
      var ln = svgEl('line', { x1: roles[i][0], y1: roles[i][1], x2: roles[j][0], y2: roles[j][1], stroke: 'var(--ink-soft,#555)', 'stroke-width': '1', 'stroke-dasharray': '5 4' });
      ln.appendChild(anim('opacity', '0.2;0.8;0.2', '2.4s', { begin: ((i + j) * 0.3) + 's', repeatCount: 'indefinite' }));
      ln.appendChild(anim('stroke-dashoffset', '18;0', '1s', { begin: ((i + j) * 0.3) + 's' }));
      svg.appendChild(ln);
    }
    var names = ['research', 'write', 'edit'];
    for (i = 0; i < 3; i++) {
      var c = svgEl('circle', { cx: roles[i][0], cy: roles[i][1], r: '20', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' });
      c.appendChild(anim('opacity', '0.65;1;0.65', '2.4s', { begin: (i * 0.5) + 's', repeatCount: 'indefinite' }));
      svg.appendChild(c);
      svg.appendChild(txt(roles[i][0], roles[i][1] + 3, names[i], '8', 'var(--blueprint,#3553ff)'));
    }
    svg.appendChild(svgEl('line', { x1: 290, y1: 30, x2: 290, y2: 210, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    svg.appendChild(txt(405, 28, 'FLOW', '11', 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(405, 42, 'event-driven, deterministic', '8', 'var(--ink-mute,#777)'));
    var steps = ['fetch', 'route', 'emit'];
    for (i = 0; i < 3; i++) {
      var y = 70 + i * 50;
      var b = svgEl('rect', { x: 350, y: y, width: 110, height: 34, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
      b.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '3s', { begin: (i * 0.6) + 's' }));
      svg.appendChild(b);
      svg.appendChild(txt(405, y + 21, steps[i], '10', 'var(--ink,#1a1a1a)'));
      if (i < 2) {
        var ar = svgEl('line', { x1: 405, y1: y + 34, x2: 405, y2: y + 50, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '4 3' });
        ar.appendChild(anim('stroke-dashoffset', '14;0', '0.5s', { begin: (i * 0.6 + 0.3) + 's' }));
        svg.appendChild(ar);
      }
    }
    svg.appendChild(txt(260, 236, 'docs: for production, start with a Flow', '10', 'var(--ink-mute,#777)'));
    shell(host, 'CREW vs FLOW', 'two shapes, one framework',
      svg,
      'CrewAI ships two top-level shapes. A Crew is autonomous role-based collaboration, agents critiquing each other in a loose mesh, good for exploratory work. A Flow is an event-driven deterministic chain you can replay, audit, and cost. The docs are blunt: for any production-ready application, start with a Flow.');
  }

  // -- ae-agent-handoff: a transfer_to tool passing control between agents ----
  function agentHandoff(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    function agent(x, label) {
      svg.appendChild(svgEl('rect', { x: x, y: 80, width: 120, height: 56, rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
      svg.appendChild(txt(x + 60, 105, label, '11', 'var(--blueprint,#3553ff)'));
      svg.appendChild(txt(x + 60, 122, 'agent', '8', 'var(--ink-mute,#777)'));
    }
    agent(40, 'triage');
    agent(360, 'refund');
    var path = svgEl('path', { d: 'M160 108 C240 60, 280 60, 360 108', fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.6', 'stroke-dasharray': '6 5' });
    path.appendChild(anim('stroke-dashoffset', '22;0', '1s', {}));
    svg.appendChild(path);
    var tool = svgEl('rect', { x: 195, y: 30, width: 130, height: 26, rx: '4', fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' });
    svg.appendChild(tool);
    var toolt = txt(260, 48, 'transfer_to_refund', '9', 'var(--warn,#b8870f)');
    toolt.appendChild(anim('opacity', '0.4;1;1', '2.4s', {}));
    svg.appendChild(toolt);
    var ctx = svgEl('circle', { cx: '0', cy: '0', r: '6', fill: 'var(--blueprint,#3553ff)' });
    ctx.appendChild(LF.smil('animateMotion', { dur: '2.4s', path: 'M160 108 C240 60, 280 60, 360 108', keyPoints: '0;0;1;1', keyTimes: '0;0.3;0.8;1', calcMode: 'linear' }));
    ctx.appendChild(anim('opacity', '0;1;1;1', '2.4s', {}));
    svg.appendChild(ctx);
    svg.appendChild(txt(260, 170, 'handoff is a tool the model can call', '11', 'var(--ink,#1a1a1a)'));
    svg.appendChild(txt(260, 200, 'conversation context travels with control', '10', 'var(--ink-mute,#777)'));
    shell(host, 'AGENT HANDOFF', 'delegation as a tool call',
      svg,
      'In the OpenAI Agents SDK a handoff is just a tool named transfer_to_<agent>. When the triage agent calls it, control and the running conversation context pass to the target agent, which continues the session. Modeling delegation as an ordinary tool keeps the loop uniform: the model decides to hand off the same way it decides to call any function.');
  }

  // -- ae-subagent-isolation: a parent spawning children with fresh context ---
  function subagentIsolation(host) {
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 200, y: 24, width: 120, height: 46, rx: '6', fill: 'var(--blueprint,#3553ff)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(260, 44, 'orchestrator', '11', 'var(--bg,#fafaf5)'));
    svg.appendChild(txt(260, 60, 'main context', '8', 'var(--bg-surface,#cdd6ff)'));
    var kids = [80, 260, 440];
    var i;
    for (i = 0; i < 3; i++) {
      var x = kids[i];
      var edge = svgEl('line', { x1: 260, y1: 70, x2: x, y2: 130, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '90', 'stroke-dashoffset': '90' });
      edge.appendChild(anim('stroke-dashoffset', '90;0', '0.5s', { begin: (i * 0.5) + 's', fill: 'freeze' }));
      svg.appendChild(edge);
      var ring = svgEl('rect', { x: x - 52, y: 130, width: 104, height: 54, rx: '6', fill: 'none', stroke: 'var(--ink-mute,#777)', 'stroke-width': '1', 'stroke-dasharray': '4 3' });
      svg.appendChild(ring);
      var b = svgEl('rect', { x: x - 46, y: 136, width: 92, height: 42, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5', opacity: '0' });
      b.appendChild(anim('opacity', '0;1', '0.5s', { begin: (0.5 + i * 0.5) + 's', fill: 'freeze' }));
      svg.appendChild(b);
      var t1 = txt(x, 157, 'subagent ' + (i + 1), '9', 'var(--blueprint,#3553ff)');
      t1.setAttribute('opacity', '0');
      t1.appendChild(anim('opacity', '0;1', '0.5s', { begin: (0.5 + i * 0.5) + 's', fill: 'freeze' }));
      svg.appendChild(t1);
      var t2 = txt(x, 171, 'own window', '8', 'var(--ink-mute,#777)');
      t2.setAttribute('opacity', '0');
      t2.appendChild(anim('opacity', '0;1', '0.5s', { begin: (0.5 + i * 0.5) + 's', fill: 'freeze' }));
      svg.appendChild(t2);
      var ret = svgEl('circle', { cx: '0', cy: '0', r: '4', fill: 'var(--warn,#b8870f)', opacity: '0' });
      ret.appendChild(LF.smil('animateMotion', { dur: '4s', begin: (i * 0.5) + 's', path: 'M' + x + ' 130 L260 70', keyPoints: '0;0;1;1', keyTimes: '0;0.6;0.9;1', calcMode: 'linear' }));
      ret.appendChild(anim('opacity', '0;0;1;1', '4s', { begin: (i * 0.5) + 's' }));
      svg.appendChild(ret);
    }
    svg.appendChild(txt(260, 218, 'each subagent runs in an isolated context, returns a summary', '10', 'var(--ink-mute,#777)'));
    shell(host, 'SUBAGENT ISOLATION', 'fan out, summarize back',
      svg,
      'The Claude Agent SDK spawns subagents that each run in their own context window (dashed boundary). The orchestrator keeps its main context clean: children explore in parallel and return only a compact summary. This buys both parallelism and context isolation, so a noisy search does not flood the parent transcript.');
  }

  // -- ae-swebench-gate: a patch run against FAIL_TO_PASS unit tests ----------
  function swebenchGate(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 30, y: 95, width: 100, height: 46, rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(80, 114, 'agent', '11', 'var(--blueprint,#3553ff)'));
    svg.appendChild(txt(80, 130, 'patch', '8', 'var(--ink-mute,#777)'));
    var arr = svgEl('line', { x1: 130, y1: 118, x2: 185, y2: 118, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.6', 'stroke-dasharray': '5 4' });
    arr.appendChild(anim('stroke-dashoffset', '18;0', '0.8s', {}));
    svg.appendChild(arr);
    svg.appendChild(svgEl('rect', { x: 185, y: 40, width: 150, height: 156, rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(260, 34, 'test harness', '10', 'var(--ink-mute,#777)'));
    var tests = [
      { y: 60, lab: 'FAIL_TO_PASS', begin: '0.8s' },
      { y: 95, lab: 'FAIL_TO_PASS', begin: '1.3s' },
      { y: 130, lab: 'PASS_TO_PASS', begin: '1.8s' },
      { y: 165, lab: 'PASS_TO_PASS', begin: '2.3s' }
    ];
    var i;
    for (i = 0; i < tests.length; i++) {
      var t = tests[i];
      var dot = svgEl('circle', { cx: 205, cy: t.y + 10, r: '6', fill: 'var(--rule-soft,#ddd)', stroke: 'var(--ink-mute,#777)', 'stroke-width': '1' });
      dot.appendChild(anim('fill', 'var(--rule-soft,#ddd);var(--blueprint,#3553ff)', '4s', { begin: t.begin, fill: 'freeze' }));
      svg.appendChild(dot);
      svg.appendChild(txt(222, t.y + 14, t.lab, '9', 'var(--ink-soft,#555)', 'start'));
      var chk = svgEl('path', { d: 'M202 ' + (t.y + 10) + ' l3 3 l5 -6', fill: 'none', stroke: 'var(--bg,#fafaf5)', 'stroke-width': '1.6', opacity: '0' });
      chk.appendChild(anim('opacity', '0;1', '0.3s', { begin: t.begin, fill: 'freeze' }));
      svg.appendChild(chk);
    }
    var gate = svgEl('rect', { x: 390, y: 95, width: 100, height: 46, rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' });
    gate.appendChild(anim('stroke', 'var(--warn,#b8870f);var(--blueprint,#3553ff)', '4s', { begin: '2.6s', fill: 'freeze' }));
    svg.appendChild(gate);
    var res = txt(440, 122, 'RESOLVED', '10', 'var(--ink,#1a1a1a)');
    svg.appendChild(res);
    var g2 = svgEl('line', { x1: 335, y1: 118, x2: 390, y2: 118, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.6', 'stroke-dasharray': '5 4' });
    g2.appendChild(anim('stroke-dashoffset', '18;0', '0.8s', { begin: '2.6s' }));
    svg.appendChild(g2);
    svg.appendChild(txt(260, 222, 'resolved only if every gated test goes green', '10', 'var(--ink-mute,#777)'));
    shell(host, 'SWE-BENCH GATE', 'tests, not judgment, score the patch',
      svg,
      'SWE-bench scores a patch by running the repo test suite, not by asking a model if it looks right. A task counts as resolved only when the FAIL_TO_PASS tests now pass and the PASS_TO_PASS tests still pass. Execution-based grading is why the benchmark resists gaming, and why SWE-bench Verified strips out tasks whose tests were ambiguous or broken.');
  }

  // -- ae-agent-human-gap: two bars closing as the agent line climbs ----------
  function agentHumanGap(host) {
    var W = 520, H = 240, PAD = 44, base = 200;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: PAD, y1: base, x2: W - 20, y2: base, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    svg.appendChild(svgEl('line', { x1: PAD, y1: 30, x2: PAD, y2: base, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
    var humanY = 50;
    svg.appendChild(svgEl('line', { x1: PAD, y1: humanY, x2: W - 20, y2: humanY, stroke: 'var(--ink-mute,#777)', 'stroke-width': '1.4', 'stroke-dasharray': '5 4' }));
    svg.appendChild(txt(W - 24, humanY - 6, 'human ~78%', '9', 'var(--ink-mute,#777)', 'end'));
    var x0 = PAD + 20, x1 = W - 60, y0 = base - 22, y1 = base - 120;
    var line = svgEl('path', { d: 'M' + x0 + ' ' + y0 + ' Q ' + ((x0 + x1) / 2) + ' ' + (y0 - 10) + ' ' + x1 + ' ' + y1, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.4', 'stroke-dasharray': '320', 'stroke-dashoffset': '320' });
    line.appendChild(anim('stroke-dashoffset', '320;0', '3s', { begin: '0.3s', fill: 'freeze' }));
    svg.appendChild(line);
    var head = svgEl('circle', { cx: x0, cy: y0, r: '5', fill: 'var(--blueprint,#3553ff)' });
    head.appendChild(svgEl('animateMotion', { dur: '3s', begin: '0.3s', fill: 'freeze', repeatCount: '1', path: 'M0 0 Q ' + ((x1 - x0) / 2) + ' ' + ((y1 - y0) / 2 - 10) + ' ' + (x1 - x0) + ' ' + (y1 - y0), keyTimes: '0;1', keyPoints: '0;1', calcMode: 'linear' }));
    svg.appendChild(head);
    svg.appendChild(txt(x0, base + 16, '2023', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(x1, base + 16, '2026', '9', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(x0 + 4, y0 - 10, '14%', '9', 'var(--blueprint,#3553ff)', 'start'));
    svg.appendChild(txt(260, 222, 'gap narrows, failure modes stay: grounding and operational knowledge', '10', 'var(--ink-mute,#777)'));
    shell(host, 'AGENT vs HUMAN', 'the gap is closing',
      svg,
      'At release WebArena and OSWorld showed a wide gap: the best agent near 14% where humans sit around 78%. The blue line is climbing year over year, but the two failure modes have not changed. Agents still miss GUI grounding (where to click) and operational knowledge (what the task actually requires), so the score rises faster than reliability.');
  }

  // -- ae-genai-span-tree: nested OTel spans drawing in parent-child order ----
  function genaiSpanTree(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var spans = [
      { x: 40, w: 440, y: 40, lab: 'invoke_agent  CLIENT', begin: '0s', kind: 'agent' },
      { x: 80, w: 200, y: 80, lab: 'execute_tool  search', begin: '0.6s', kind: 'tool' },
      { x: 120, w: 120, y: 120, lab: 'chat  gpt model', begin: '1.2s', kind: 'model' },
      { x: 80, w: 240, y: 160, lab: 'execute_tool  fetch', begin: '1.8s', kind: 'tool' },
      { x: 120, w: 150, y: 200, lab: 'chat  claude model', begin: '2.4s', kind: 'model' }
    ];
    var i;
    for (i = 0; i < spans.length; i++) {
      var s = spans[i];
      var fill = s.kind === 'agent' ? 'var(--blueprint,#3553ff)' : s.kind === 'tool' ? 'var(--bg-surface,#eee)' : 'var(--bg,#fafaf5)';
      var stroke = s.kind === 'model' ? 'var(--ink-mute,#777)' : 'var(--blueprint,#3553ff)';
      var ink = s.kind === 'agent' ? 'var(--bg,#fafaf5)' : 'var(--ink,#1a1a1a)';
      var bar = svgEl('rect', { x: s.x, y: s.y, width: '0', height: 24, rx: '3', fill: fill, stroke: stroke, 'stroke-width': '1.4' });
      bar.appendChild(anim('width', '0;' + s.w, '0.5s', { begin: s.begin, fill: 'freeze' }));
      svg.appendChild(bar);
      var t = txt(s.x + 8, s.y + 16, s.lab, '9', ink, 'start');
      t.setAttribute('opacity', '0');
      t.appendChild(anim('opacity', '0;1', '0.4s', { begin: s.begin, fill: 'freeze' }));
      svg.appendChild(t);
      if (i > 0) {
        var px = spans[i].x - 18;
        var conn = svgEl('path', { d: 'M' + px + ' ' + (spans[i - (s.kind === 'model' ? 1 : (i === 3 ? 3 : 1))].y + 24) + ' V ' + (s.y + 12) + ' H ' + s.x, fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1', 'stroke-dasharray': '2 2', opacity: '0' });
        conn.appendChild(anim('opacity', '0;0.7', '0.3s', { begin: s.begin, fill: 'freeze' }));
        svg.appendChild(conn);
      }
    }
    svg.appendChild(txt(260, 230, 'one schema: agent > tool > model, parent-child by convention', '10', 'var(--ink-mute,#777)'));
    shell(host, 'GENAI SPAN TREE', 'standard telemetry, nested',
      svg,
      'OpenTelemetry\'s GenAI conventions give every vendor one schema. An invoke_agent span is the root; each execute_tool span hangs off it; each model chat span hangs off the tool that called it. Because the names and parent-child links are standardized, the same trace reads the same way in Datadog, Grafana, Jaeger, or Honeycomb.');
  }

  // -- ae-eval-three-layers: the eval loop wrapping the build, three rings ----
  function evalThreeLayers(host) {
    var W = 520, H = 250, cx = 175, cy = 125;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var rings = [
      { r: 96, lab: 'online production', dash: '12 8', dur: '8s', op: '0.45' },
      { r: 70, lab: 'custom offline', dash: '9 7', dur: '6s', op: '0.65' },
      { r: 44, lab: 'static benchmarks', dash: '6 5', dur: '4s', op: '0.85' }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var ring = svgEl('circle', { cx: cx, cy: cy, r: rings[i].r, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', 'stroke-dasharray': rings[i].dash, opacity: rings[i].op });
      var rot = svgEl('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 ' + cx + ' ' + cy, to: '360 ' + cx + ' ' + cy, dur: rings[i].dur, repeatCount: 'indefinite' });
      ring.appendChild(rot);
      svg.appendChild(ring);
    }
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: '22', fill: 'var(--blueprint,#3553ff)' }));
    svg.appendChild(txt(cx, cy - 1, 'build', '10', 'var(--bg,#fafaf5)'));
    svg.appendChild(txt(cx, cy + 12, 'agent', '8', 'var(--bg-surface,#cdd6ff)'));
    var labelsX = 300;
    for (i = 0; i < 3; i++) {
      var y = 78 + i * 36;
      svg.appendChild(svgEl('circle', { cx: labelsX, cy: y - 4, r: '5', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.6', 'stroke-dasharray': rings[2 - i].dash }));
      svg.appendChild(txt(labelsX + 14, y, rings[2 - i].lab, '11', 'var(--ink,#1a1a1a)', 'start'));
    }
    var notes = ['SWE-bench, GAIA, BFCL', 'LLM-judge, execution, trajectory', 'live traffic, regressions, gates'];
    for (i = 0; i < 3; i++) {
      svg.appendChild(txt(labelsX + 14, 78 + i * 36 + 14, notes[i], '8', 'var(--ink-mute,#777)', 'start'));
    }
    svg.appendChild(txt(260, 236, 'evaluation is the outer loop, not the last step', '10', 'var(--ink-mute,#777)'));
    shell(host, 'EVAL-DRIVEN LOOP', 'three layers around the build',
      svg,
      'Evaluation is not the final checkbox; it is the outer loop that drives every choice. Static benchmarks fix the model, custom offline evals measure your product shape, and online production evals catch regressions on live traffic. The three rings turn around the build continuously, which is why 2026 practice keeps evals next to code, in CI, gating every PR.');
  }

  LF.register({
    'ae-memory-fusion': memoryFusion,
    'ae-crew-vs-flow': crewVsFlow,
    'ae-agent-handoff': agentHandoff,
    'ae-subagent-isolation': subagentIsolation,
    'ae-swebench-gate': swebenchGate,
    'ae-agent-human-gap': agentHumanGap,
    'ae-genai-span-tree': genaiSpanTree,
    'ae-eval-three-layers': evalThreeLayers
  });
})();
