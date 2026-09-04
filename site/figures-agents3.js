/* figures-agents3.js - animated lesson figures for agent engineering.
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

  // ── htn-tree-expand: a task tree decomposing node by node ──────────────────
  function htnTree(host) {
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    function node(x, y, label, on, begin) {
      var fill = on ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)';
      var stroke = on ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)';
      var r = svgEl('rect', { x: x - 46, y: y - 15, width: 92, height: 30, rx: '4', fill: fill, stroke: stroke, 'stroke-width': '1.5', opacity: '0' });
      r.appendChild(anim('opacity', '0;1', '0.5s', { begin: begin, fill: 'freeze' }));
      var t = txt(x, y + 4, label, '11', on ? 'var(--bg,#fafaf5)' : 'var(--ink,#1a1a1a)');
      t.setAttribute('opacity', '0');
      t.appendChild(anim('opacity', '0;1', '0.5s', { begin: begin, fill: 'freeze' }));
      return svgEl('g', {}, [r, t]);
    }
    function edge(x1, y1, x2, y2, begin) {
      var l = svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '120', 'stroke-dashoffset': '120' });
      l.appendChild(anim('stroke-dashoffset', '120;0', '0.4s', { begin: begin, fill: 'freeze' }));
      return l;
    }
    svg.appendChild(node(260, 32, 'deliver(pkg)', true, '0s'));
    svg.appendChild(edge(230, 47, 150, 95, '0.5s'));
    svg.appendChild(edge(290, 47, 370, 95, '0.5s'));
    svg.appendChild(node(150, 110, 'pickup', true, '0.9s'));
    svg.appendChild(node(370, 110, 'transport', true, '0.9s'));
    svg.appendChild(edge(150, 125, 90, 188, '1.4s'));
    svg.appendChild(edge(370, 125, 310, 188, '1.4s'));
    svg.appendChild(edge(370, 125, 440, 188, '1.4s'));
    svg.appendChild(node(90, 205, 'drive', false, '1.8s'));
    svg.appendChild(node(310, 205, 'load', false, '1.8s'));
    svg.appendChild(node(440, 205, 'route', false, '1.8s'));
    var lab = txt(260, 240, 'compound -> methods -> primitive operators', '10', 'var(--ink-mute,#777)');
    lab.setAttribute('opacity', '0');
    lab.appendChild(anim('opacity', '0;1', '0.6s', { begin: '2.3s', fill: 'freeze' }));
    svg.appendChild(lab);
    shell(host, 'HTN DECOMPOSITION', 'a task tree unrolling',
      svg,
      'An HTN planner expands a compound task into methods, each method into subtasks, recursing until every leaf is a primitive operator whose preconditions hold. The tree is grown top-down; the plan is the left-to-right reading of the primitive leaves.');
  }

  // ── workflow-chain: prompt chaining links lighting up in sequence ──────────
  function workflowChain(host) {
    var W = 520, H = 210;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var labels = ['INPUT', 'CALL 1', 'GATE', 'CALL 2', 'OUTPUT'];
    var n = labels.length, gap = (W - 60) / (n - 1);
    var i;
    for (i = 0; i < n - 1; i++) {
      var x1 = 30 + gap * i + 30, x2 = 30 + gap * (i + 1) - 30;
      var ln = svgEl('line', { x1: x1, y1: 90, x2: x2, y2: 90, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2', 'stroke-dasharray': '6 5' });
      ln.appendChild(anim('stroke-dashoffset', '22;0', '0.7s', { begin: (i * 0.5) + 's' }));
      svg.appendChild(ln);
    }
    for (i = 0; i < n; i++) {
      var cx = 30 + gap * i;
      var box = svgEl('rect', { x: cx - 30, y: 70, width: 60, height: 40, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
      box.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '2.5s', { begin: (i * 0.5) + 's' }));
      svg.appendChild(box);
      svg.appendChild(txt(cx, 94, labels[i], '9', 'var(--ink,#1a1a1a)'));
    }
    var pulse = svgEl('circle', { cx: '0', cy: '90', r: '5', fill: 'var(--warn,#b8870f)' });
    pulse.appendChild(LF.smil('animateMotion', { dur: '2.5s', path: 'M30 90 H490', keyPoints: '0;1', keyTimes: '0;1', calcMode: 'linear' }));
    svg.appendChild(pulse);
    svg.appendChild(txt(260, 160, 'output of each call becomes input to the next', '10', 'var(--ink-mute,#777)'));
    shell(host, 'PROMPT CHAINING', 'one call feeds the next',
      svg,
      'The simplest workflow: a fixed linear path of model calls where each output is the next input, with optional programmatic gates between steps. Engineers own the graph, so it is cheap to debug and predictable to run. Reach for an agent only when the steps cannot be known in advance.');
  }

  // ── actor-mailbox: messages flying into actor inboxes, async ───────────────
  function actorMailbox(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    function actor(x, y, name) {
      var g = svgEl('g', {}, [
        svgEl('rect', { x: x, y: y, width: 110, height: 70, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }),
        svgEl('rect', { x: x + 10, y: y + 12, width: 90, height: 14, rx: '2', fill: 'none', stroke: 'var(--ink-mute,#777)', 'stroke-width': '1', 'stroke-dasharray': '3 2' }),
        txt(x + 55, y + 45, name, '11', 'var(--ink,#1a1a1a)'),
        txt(x + 55, y + 60, 'private state', '8', 'var(--ink-mute,#777)')
      ]);
      return g;
    }
    svg.appendChild(actor(40, 40, 'coder'));
    svg.appendChild(actor(370, 40, 'reviewer'));
    svg.appendChild(actor(205, 150, 'runtime'));
    function msg(path, dur, begin, color) {
      var c = svgEl('circle', { cx: '0', cy: '0', r: '6', fill: color || 'var(--blueprint,#3553ff)' });
      c.appendChild(svgEl('animateMotion', { dur: dur, begin: begin, repeatCount: 'indefinite', path: path, keyPoints: '0;1', keyTimes: '0;1', calcMode: 'linear' }));
      c.appendChild(anim('opacity', '0;1;1;0', dur, { begin: begin, repeatCount: 'indefinite' }));
      return c;
    }
    svg.appendChild(msg('M150 60 H370', '1.6s', '0s'));
    svg.appendChild(msg('M425 110 L290 150', '1.6s', '0.8s', 'var(--warn,#b8870f)'));
    svg.appendChild(msg('M260 150 L150 75', '1.6s', '1.6s'));
    svg.appendChild(txt(260, 28, 'messages are the only IPC', '10', 'var(--ink-mute,#777)'));
    shell(host, 'ACTOR MODEL', 'async message passing',
      svg,
      'Each agent is an actor: private state, a mailbox, a handler. Actors never share memory; they only send messages, and the runtime decouples delivery from handling. A crash isolates to one actor, concurrency is native, and moving to a distributed deployment is just a change of transport.');
  }

  // ── debate-converge: N proposers exchanging critiques, answers converging ──
  function debateConverge(host) {
    var W = 520, H = 240, cx = 260, cy = 120, R = 78;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var pts = [], i;
    for (i = 0; i < 4; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 2;
      pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    }
    var j;
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) {
      var ln = svgEl('line', { x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1', 'stroke-dasharray': '5 4' });
      ln.appendChild(anim('stroke-dashoffset', '18;0', '1.2s', {}));
      ln.appendChild(anim('opacity', '0.25;0.7;0.25', '1.2s', {}));
      svg.appendChild(ln);
    }
    var consensus = svgEl('circle', { cx: cx, cy: cy, r: '4', fill: 'var(--warn,#b8870f)', opacity: '0' });
    consensus.appendChild(anim('r', '4;16', '4s', {}));
    consensus.appendChild(anim('opacity', '0;0;0.9', '4s', {}));
    svg.appendChild(consensus);
    for (i = 0; i < 4; i++) {
      var dot = svgEl('circle', { cx: pts[i].x, cy: pts[i].y, r: '16', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' });
      var tr = svgEl('animateTransform', { attributeName: 'transform', type: 'translate', dur: '4s', repeatCount: 'indefinite',
        values: '0 0;' + ((cx - pts[i].x) * 0.4).toFixed(0) + ' ' + ((cy - pts[i].y) * 0.4).toFixed(0) + ';0 0', calcMode: 'spline', keyTimes: '0;0.7;1', keySplines: '0.4 0 0.2 1;0.4 0 0.2 1' });
      var g = svgEl('g', {}, [dot, txt(pts[i].x, pts[i].y + 4, 'A' + (i + 1), '10', 'var(--blueprint,#3553ff)')]);
      g.appendChild(tr);
      svg.appendChild(g);
    }
    svg.appendChild(txt(cx, 228, 'N proposers, R rounds of cross-critique, convergence', '10', 'var(--ink-mute,#777)'));
    shell(host, 'MULTI-AGENT DEBATE', 'critique into consensus',
      svg,
      'Independent model instances each propose an answer, then read and critique each other over several rounds, updating toward agreement. Disagreement, not a single chain of thought, surfaces errors. A sparse topology (not the full mesh shown) can match accuracy at a fraction of the token cost.');
  }

  // ── computer-use-cursor: a cursor gliding across a mock UI ─────────────────
  function computerUse(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 30, y: 20, width: 460, height: 180, rx: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }));
    svg.appendChild(svgEl('rect', { x: 30, y: 20, width: 460, height: 22, rx: '6', fill: 'var(--rule-soft,#ddd)' }));
    svg.appendChild(svgEl('circle', { cx: 46, cy: 31, r: '4', fill: 'var(--ink-mute,#777)' }));
    var field = svgEl('rect', { x: 60, y: 70, width: 240, height: 26, rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--ink-mute,#777)', 'stroke-width': '1' });
    svg.appendChild(field);
    svg.appendChild(txt(70, 88, 'search...', '11', 'var(--ink-mute,#777)', 'start'));
    var btn = svgEl('rect', { x: 60, y: 130, width: 90, height: 30, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' });
    btn.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '5s', {}));
    svg.appendChild(btn);
    svg.appendChild(txt(105, 150, 'submit', '11', 'var(--ink,#1a1a1a)'));
    var path = 'M400 50 L180 83 L180 83 L105 145 L105 145 L400 50';
    var cur = svgEl('path', { d: 'M0 0 L0 16 L4 12 L8 18 L11 16 L7 11 L13 11 Z', fill: 'var(--ink,#1a1a1a)', stroke: 'var(--bg,#fafaf5)', 'stroke-width': '0.8' });
    cur.appendChild(LF.smil('animateMotion', { dur: '5s', path: path, keyPoints: '0;0.45;0.5;0.9;0.95;1', keyTimes: '0;0.35;0.45;0.75;0.85;1', calcMode: 'linear' }));
    svg.appendChild(cur);
    svg.appendChild(txt(260, 222, 'screenshot in -> pixel coordinates out', '10', 'var(--ink-mute,#777)'));
    shell(host, 'COMPUTER USE', 'a cursor driving the screen',
      svg,
      'Vision-based computer use reads pixels from a screenshot and emits resolution-independent coordinates, then keyboard and mouse commands - no accessibility API. Everything on screen is untrusted input; only the direct user instruction counts as permission, which is why per-step safety checks gate each action.');
  }

  // ── voice-pipeline: a waveform morphing into a text token ──────────────────
  function voicePipeline(host) {
    var W = 520, H = 220;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var stages = ['VAD', 'STT', 'LLM', 'TTS'];
    var i;
    for (i = 0; i < stages.length; i++) {
      var x = 60 + i * 110;
      var b = svgEl('rect', { x: x, y: 150, width: 80, height: 30, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
      b.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--blueprint,#3553ff);var(--bg-surface,#eee)', '3.2s', { begin: (i * 0.6) + 's' }));
      svg.appendChild(b);
      svg.appendChild(txt(x + 40, 169, stages[i], '10', 'var(--ink,#1a1a1a)'));
      if (i < stages.length - 1) {
        var ar = svgEl('line', { x1: x + 80, y1: 165, x2: x + 110, y2: 165, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '4 3' });
        ar.appendChild(anim('stroke-dashoffset', '14;0', '0.6s', { begin: (i * 0.6 + 0.3) + 's' }));
        svg.appendChild(ar);
      }
    }
    var d = 'M40 80';
    var x2;
    for (x2 = 0; x2 <= 18; x2++) { d += ' L' + (40 + x2 * 10) + ' ' + (80 + (x2 % 2 ? -1 : 1) * (8 + 18 * Math.abs(Math.sin(x2)))).toFixed(0); }
    var wave = svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2', 'stroke-dasharray': '420', 'stroke-dashoffset': '420' });
    wave.appendChild(anim('stroke-dashoffset', '420;0', '1.4s', {}));
    wave.appendChild(anim('opacity', '1;1;0', '3.2s', {}));
    svg.appendChild(wave);
    var word = txt(370, 84, '"hello"', '20', 'var(--ink,#1a1a1a)');
    word.setAttribute('opacity', '0');
    word.appendChild(anim('opacity', '0;0;1;1', '3.2s', { fill: 'freeze' }));
    svg.appendChild(word);
    svg.appendChild(txt(260, 208, 'end-to-end latency budget ~600ms', '10', 'var(--ink-mute,#777)'));
    shell(host, 'VOICE PIPELINE', 'audio frames into speech',
      svg,
      'A voice agent is a frame-based pipeline, not text with TTS bolted on: voice activity detection, speech-to-text, the LLM, then text-to-speech, all under a brutal ~600ms budget. Partial audio is the default and barge-in cancellation flows upstream, so every stage must stream rather than wait for a full turn.');
  }

  // ── injection-hijack: a malicious token glowing red, hijacking flow ────────
  function injectionHijack(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 30, y: 40, width: 150, height: 100, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' }));
    svg.appendChild(txt(105, 34, 'retrieved doc', '10', 'var(--ink-mute,#777)'));
    svg.appendChild(txt(105, 70, 'normal text...', '10', 'var(--ink-soft,#555)'));
    var bad = svgEl('rect', { x: 42, y: 88, width: 126, height: 24, rx: '3', fill: 'var(--bg,#fafaf5)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' });
    bad.appendChild(anim('stroke', 'var(--rule-soft,#ddd);var(--warn,#b8870f);var(--rule-soft,#ddd)', '2.6s', {}));
    svg.appendChild(bad);
    var badt = txt(105, 104, '<send funds>', '9', 'var(--warn,#b8870f)');
    badt.appendChild(anim('opacity', '0.4;1;0.4', '2.6s', {}));
    svg.appendChild(badt);
    var agent = svgEl('rect', { x: 215, y: 65, width: 90, height: 50, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5' });
    svg.appendChild(agent);
    svg.appendChild(txt(260, 94, 'AGENT', '11', 'var(--blueprint,#3553ff)'));
    var safe = svgEl('rect', { x: 360, y: 30, width: 130, height: 40, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
    svg.appendChild(safe);
    svg.appendChild(txt(425, 54, 'intended tool', '10', 'var(--ink-soft,#555)'));
    var danger = svgEl('rect', { x: 360, y: 110, width: 130, height: 40, rx: '4', fill: 'var(--bg-surface,#eee)', stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' });
    svg.appendChild(danger);
    svg.appendChild(txt(425, 134, 'attacker tool', '10', 'var(--warn,#b8870f)'));
    var flow = svgEl('line', { x1: 180, y1: 100, x2: 215, y2: 90, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2', 'stroke-dasharray': '5 4' });
    flow.appendChild(anim('stroke-dashoffset', '18;0', '0.8s', {}));
    svg.appendChild(flow);
    var hij = svgEl('line', { x1: 305, y1: 95, x2: 360, y2: 130, stroke: 'var(--warn,#b8870f)', 'stroke-width': '2', 'stroke-dasharray': '5 4' });
    hij.appendChild(anim('stroke-dashoffset', '20;0', '0.8s', { begin: '0.8s' }));
    hij.appendChild(anim('opacity', '0;0;1', '2.6s', {}));
    svg.appendChild(hij);
    svg.appendChild(txt(260, 200, 'retrieved instructions override the developer prompt', '10', 'var(--ink-mute,#777)'));
    shell(host, 'PROMPT INJECTION', 'untrusted text hijacks a tool call',
      svg,
      'Indirect prompt injection plants instructions in content the agent retrieves. The model cannot reliably separate user intent from retrieved text, so the malicious token (red) redirects the agent toward an attacker-chosen tool. Treat all retrieved content as arbitrary code on the tool-use surface and validate before any call commits.');
  }

  // ── failure-cascade: an error tumbling down a chain of agents ──────────────
  function failureCascade(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var labels = ['plan', 'retrieve', 'reason', 'act'];
    var i;
    for (i = 0; i < labels.length; i++) {
      var x = 50 + i * 120;
      var b = svgEl('rect', { x: x, y: 90, width: 90, height: 44, rx: '5', fill: 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
      b.appendChild(anim('stroke', 'var(--rule-soft,#ddd);var(--warn,#b8870f)', '3s', { begin: (i * 0.7) + 's', fill: 'freeze' }));
      b.appendChild(anim('fill', 'var(--bg-surface,#eee);var(--bg-surface,#eee);var(--warn,#b8870f)', '3s', { begin: (i * 0.7) + 's', fill: 'freeze' }));
      svg.appendChild(b);
      svg.appendChild(txt(x + 45, 117, labels[i], '11', 'var(--ink,#1a1a1a)'));
      if (i < labels.length - 1) {
        var ln = svgEl('line', { x1: x + 90, y1: 112, x2: x + 120, y2: 112, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '4 3' });
        svg.appendChild(ln);
      }
    }
    var bolt = svgEl('path', { d: 'M0 0 L-5 9 L1 9 L-3 18', fill: 'none', stroke: 'var(--warn,#b8870f)', 'stroke-width': '2.5', opacity: '0' });
    bolt.appendChild(LF.smil('animateMotion', { dur: '3s', fill: 'freeze', path: 'M95 75 L215 75 L335 75 L455 75', keyPoints: '0;0.33;0.66;1', keyTimes: '0;0.33;0.66;1', calcMode: 'linear' }));
    bolt.appendChild(anim('opacity', '0;1;1;1', '3s', {}));
    svg.appendChild(bolt);
    svg.appendChild(txt(260, 50, 'a single bad step poisons everything downstream', '11', 'var(--warn,#b8870f)'));
    svg.appendChild(txt(260, 200, 'hallucinated action -> cascade -> context loss', '10', 'var(--ink-mute,#777)'));
    shell(host, 'CASCADING FAILURE', 'one error tumbles down the chain',
      svg,
      'Agent failures are not random noise; they fall into recurring modes. A cascading error is the costliest: one hallucinated step writes into the next step\'s input, so a single wrong action propagates through plan, retrieval, reasoning, and action. Naming the mode is what lets you monitor for it and cut the chain early.');
  }

  LF.register({
    'htn-tree-expand': htnTree,
    'workflow-chain': workflowChain,
    'actor-mailbox': actorMailbox,
    'debate-converge': debateConverge,
    'computer-use-cursor': computerUse,
    'voice-pipeline': voicePipeline,
    'injection-hijack': injectionHijack,
    'failure-cascade': failureCascade
  });
})();
