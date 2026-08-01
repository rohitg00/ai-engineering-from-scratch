/* figures-autonomous2.js - animated lesson figures for Phase 15 autonomous
   systems. Loads after lesson-figures.js and registers through window.LF.
   No deps, ES5 only, theme via CSS vars. Every figure is a unique animated
   SVG (SMIL: animate / animateTransform / animateMotion / stroke-dashoffset).
   Authoring: a ```figure block naming one of the widgets below. */
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
  var WARN = 'var(--warn,#b8870f)';
  var SURF = 'var(--bg-surface,#eee)';
  var BG = 'var(--bg,#fafaf5)';

  function txt(x, y, s, opts) {
    opts = opts || {};
    var t = svgEl('text', {
      x: x, y: y, 'text-anchor': opts.anchor || 'middle',
      'font-family': opts.mono ? 'var(--font-mono,monospace)' : 'var(--font-body,serif)',
      'font-size': opts.size || '11', fill: opts.fill || INK
    });
    if (opts.spacing) t.setAttribute('letter-spacing', opts.spacing);
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function anim(attr, opts) {
    var a = svgEl('animate', { attributeName: attr, repeatCount: 'indefinite' });
    for (var k in opts) if (opts.hasOwnProperty(k)) a.setAttribute(k, opts[k]);
    return a;
  }
  function shell(host, label, sub, svg, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out', style: 'border-top:none;margin-top:0;padding-top:4px' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }
  function newSvg(h) { return svgEl('svg', { viewBox: '0 0 520 ' + h }); }

  // ── alphaevolve-loop: propose → evaluate → keep spiralling into a growing
  //    program database. (Phase 15 · 03) ──────────────────────────────────────
  function alphaevolveLoop(host) {
    var svg = newSvg(250);
    var cx = 160, cy = 125;
    var ringStops = [[300, 'propose'], [60, 'evaluate'], [180, 'keep']];
    var i;
    // faint outward spiral suggesting generations accumulating
    var sp = 'M ' + cx + ' ' + cy + ' ';
    for (i = 0; i <= 220; i++) {
      var th = i / 220 * Math.PI * 6, rr = i / 220 * 78;
      sp += 'L ' + (cx + rr * Math.cos(th)).toFixed(1) + ' ' + (cy + rr * Math.sin(th)).toFixed(1) + ' ';
    }
    var spiral = svgEl('path', { d: sp, fill: 'none', stroke: RULE, 'stroke-width': '1', 'stroke-dasharray': '420 420', 'stroke-dashoffset': '420' });
    spiral.appendChild(anim('stroke-dashoffset', { from: '420', to: '0', dur: '5s' }));
    svg.appendChild(spiral);
    // three stages on the ring
    var R = 78;
    for (i = 0; i < 3; i++) {
      var ang = (i / 3 * 2 - 0.5) * Math.PI;
      var x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: '24', fill: SURF, stroke: BP, 'stroke-width': '1.5' }));
      svg.appendChild(txt(x, y + 4, ringStops[i][1], { mono: true, size: '10', fill: BP }));
    }
    // a candidate token orbiting the loop
    var orbit = 'M ' + (cx + R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 1 1 ' + (cx + R) + ' ' + (cy - 0.1) + ' Z';
    svg.appendChild(svgEl('path', { id: 'ae-orbit', d: orbit, fill: 'none', stroke: 'none' }));
    var dot = svgEl('circle', { r: '6', fill: WARN });
    var m = svgEl('animateMotion', { dur: '3s', repeatCount: 'indefinite', rotate: 'auto' });
    m.appendChild(svgEl('mpath', { href: '#ae-orbit' }));
    dot.appendChild(m);
    svg.appendChild(dot);
    // growing database column on the right
    var bx = 380;
    for (i = 0; i < 6; i++) {
      var r = svgEl('rect', { x: bx, y: 200 - i * 28, width: 110, height: 22, rx: '3', fill: i === 0 ? BP : SURF, stroke: RULE, 'stroke-width': '1', opacity: '0' });
      r.appendChild(anim('opacity', { values: '0;1;1', dur: '6s', begin: (i * 0.7) + 's', keyTimes: '0;0.1;1' }));
      svg.appendChild(r);
      svg.appendChild(txt(bx + 55, 200 - i * 28 + 15, 'score ' + (95 - i * 7), { mono: true, size: '9', fill: i === 0 ? BG : SOFT }));
    }
    svg.appendChild(txt(435, 36, 'PROGRAM DATABASE', { mono: true, size: '9', fill: MUTE, spacing: '0.12em' }));
    shell(host, 'ALPHAEVOLVE LOOP', 'propose · evaluate · keep',
      svg,
      'The LLM proposes a targeted edit, a machine-checkable evaluator scores it, and high scorers are kept as parents for the next generation. The loop spirals outward as the program database fills with ever-better variants. The wins come from the rigor of the evaluator, not the cleverness of the loop.');
  }

  // ── dgm-archive: an expanding lineage of self-modifying agents, branches
  //    drawing forward, scores climbing. (Phase 15 · 04) ───────────────────────
  function dgmArchive(host) {
    var svg = newSvg(250);
    var nodes = [
      { x: 40, y: 125, s: 20 }, { x: 150, y: 80, s: 31 }, { x: 150, y: 175, s: 28 },
      { x: 270, y: 55, s: 42 }, { x: 270, y: 120, s: 36 }, { x: 270, y: 200, s: 33 },
      { x: 400, y: 90, s: 50 }, { x: 400, y: 175, s: 44 }
    ];
    var edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [4, 6], [5, 7]];
    var i;
    for (i = 0; i < edges.length; i++) {
      var a = nodes[edges[i][0]], b = nodes[edges[i][1]];
      var d = 'M ' + a.x + ' ' + a.y + ' C ' + ((a.x + b.x) / 2) + ' ' + a.y + ' ' + ((a.x + b.x) / 2) + ' ' + b.y + ' ' + b.x + ' ' + b.y;
      var p = svgEl('path', { d: d, fill: 'none', stroke: RULE, 'stroke-width': '1.5', 'stroke-dasharray': '160 160', 'stroke-dashoffset': '160' });
      p.appendChild(anim('stroke-dashoffset', { from: '160', to: '0', dur: '4.5s', begin: (i * 0.45) + 's', fill: 'freeze' }));
      svg.appendChild(p);
    }
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i], best = (i === 6);
      var g = svgEl('g', { opacity: '0' });
      g.appendChild(anim('opacity', { values: '0;1', dur: '0.5s', begin: (0.45 + i * 0.45) + 's', fill: 'freeze' }));
      g.appendChild(svgEl('circle', { cx: n.x, cy: n.y, r: best ? '20' : '16', fill: best ? BP : SURF, stroke: best ? BP : RULE, 'stroke-width': '1.5' }));
      g.appendChild(txt(n.x, n.y + 4, String(n.s) + '%', { mono: true, size: best ? '11' : '9', fill: best ? BG : SOFT }));
      if (best) {
        var ring = svgEl('circle', { cx: n.x, cy: n.y, r: '20', fill: 'none', stroke: BP, 'stroke-width': '1.5' });
        ring.appendChild(anim('r', { values: '20;28;20', dur: '2s', begin: '4s' }));
        ring.appendChild(anim('opacity', { values: '0.8;0;0.8', dur: '2s', begin: '4s' }));
        g.appendChild(ring);
      }
      svg.appendChild(g);
    }
    svg.appendChild(txt(40, 218, 'A0  seed', { mono: true, size: '9', fill: MUTE }));
    svg.appendChild(txt(400, 30, 'best variant', { mono: true, size: '9', fill: BP }));
    shell(host, 'DARWIN GODEL ARCHIVE', 'self-modifying lineage',
      svg,
      'DGM drops the formal proof and keeps an open-ended archive. Each agent proposes an edit to its own source, is scored on a benchmark, and is kept if it clears the bar. The lineage branches forward and the best score climbs — SWE-bench rose from 20% to 50% this way. The same open-endedness is what let it learn to game its own evaluator.');
  }

  // ── aar-forum: parallel sandboxed agents writing through to an append-only
  //    forum outside any sandbox. (Phase 15 · 06) ──────────────────────────────
  function aarForum(host) {
    var svg = newSvg(250);
    var boxes = [{ x: 30, y: 30 }, { x: 30, y: 105 }, { x: 30, y: 180 }];
    var logX = 350, i;
    // the append-only log on the right
    svg.appendChild(svgEl('rect', { x: logX, y: 24, width: 140, height: 200, rx: '5', fill: 'none', stroke: BP, 'stroke-width': '2' }));
    svg.appendChild(txt(logX + 70, 18, 'SHARED FORUM (append-only)', { mono: true, size: '8', fill: BP, spacing: '0.08em' }));
    for (i = 0; i < 5; i++) {
      var lr = svgEl('rect', { x: logX + 12, y: 200 - i * 34, width: 116, height: 26, rx: '2', fill: SURF, stroke: RULE, 'stroke-width': '1', opacity: '0' });
      lr.appendChild(anim('opacity', { values: '0;1;1', dur: '6s', begin: (1 + i * 1) + 's', keyTimes: '0;0.08;1', fill: 'freeze' }));
      svg.appendChild(lr);
      svg.appendChild(txt(logX + 70, 200 - i * 34 + 17, 'finding #' + (i + 1), { mono: true, size: '9', fill: SOFT }));
    }
    // three sandboxes, each fires a record toward the log
    var colors = [BP, WARN, SOFT];
    for (i = 0; i < boxes.length; i++) {
      var bx = boxes[i].x, by = boxes[i].y;
      svg.appendChild(svgEl('rect', { x: bx, y: by, width: 120, height: 56, rx: '4', fill: SURF, stroke: RULE, 'stroke-width': '1.5', 'stroke-dasharray': '5 4' }));
      svg.appendChild(txt(bx + 60, by + 24, 'AAR ' + (i + 1), { mono: true, size: '11', fill: INK }));
      svg.appendChild(txt(bx + 60, by + 42, 'sandbox', { mono: true, size: '8', fill: MUTE }));
      var pid = 'aar-path-' + i;
      var sy = by + 28, ey = 200 - i * 50 + 13;
      svg.appendChild(svgEl('path', { id: pid, d: 'M ' + (bx + 120) + ' ' + sy + ' C 250 ' + sy + ' 280 ' + ey + ' ' + logX + ' ' + ey, fill: 'none', stroke: RULE, 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var rec = svgEl('rect', { x: -7, y: -5, width: 14, height: 10, rx: '2', fill: colors[i] });
      var mo = svgEl('animateMotion', { dur: '3s', begin: (i * 0.6) + 's', repeatCount: 'indefinite' });
      mo.appendChild(svgEl('mpath', { href: '#' + pid }));
      rec.appendChild(mo);
      svg.appendChild(rec);
    }
    shell(host, 'AUTOMATED ALIGNMENT RESEARCH', 'parallel agents · external log',
      svg,
      'Parallel Claude AARs each run in an isolated sandbox and publish findings to a shared forum whose storage sits outside every sandbox. The agents can read the log but cannot delete or edit past records from inside their box. That append-only, write-through property is what makes the research output trustworthy — an agent cannot quietly cover up a failed experiment.');
  }

  // ── bounded-gates: a proposed edit rises through invariant gates; one that
  //    violates is bounced. (Phase 15 · 08) ────────────────────────────────────
  function boundedGates(host) {
    var svg = newSvg(260);
    var gates = ['invariants', 'alignment anchor', 'multi-objective', 'regression'];
    var gy = [210, 160, 110, 60], gx = 150, gw = 220, i;
    for (i = 0; i < 4; i++) {
      svg.appendChild(svgEl('line', { x1: gx, y1: gy[i], x2: gx + gw, y2: gy[i], stroke: RULE, 'stroke-width': '2' }));
      svg.appendChild(txt(gx + gw + 8, gy[i] + 4, gates[i], { mono: true, size: '10', fill: SOFT, anchor: 'start' }));
      svg.appendChild(svgEl('circle', { cx: gx, cy: gy[i], r: '3', fill: BP }));
      svg.appendChild(svgEl('circle', { cx: gx + gw, cy: gy[i], r: '3', fill: BP }));
    }
    // accepted edit: climbs through all gates
    var accepted = svgEl('circle', { cx: gx + 50, cy: 240, r: '8', fill: BP });
    accepted.appendChild(anim('cy', { values: '240;210;160;110;60;30', dur: '5s', keyTimes: '0;0.2;0.42;0.62;0.82;1' }));
    svg.appendChild(accepted);
    svg.appendChild(txt(gx + 50, 252, 'edit', { mono: true, size: '8', fill: MUTE }));
    // rejected edit: rises to a gate, then bounces back down
    var rej = svgEl('circle', { cx: gx + 160, cy: 240, r: '8', fill: WARN });
    rej.appendChild(anim('cy', { values: '240;210;160;160;240', dur: '5s', keyTimes: '0;0.25;0.45;0.55;1', begin: '1.2s' }));
    rej.appendChild(anim('opacity', { values: '1;1;1;0.3;0', dur: '5s', keyTimes: '0;0.45;0.5;0.6;1', begin: '1.2s' }));
    svg.appendChild(rej);
    // a little X flashing at the second gate when the rejected one hits it
    var x1 = svgEl('text', { x: gx + 160, y: 152, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '16', fill: WARN, opacity: '0' });
    x1.appendChild(document.createTextNode('×'));
    x1.appendChild(anim('opacity', { values: '0;0;1;0;0', dur: '5s', keyTimes: '0;0.45;0.55;0.75;1', begin: '1.2s' }));
    svg.appendChild(x1);
    svg.appendChild(txt(gx + 110, 22, 'accepted: all invariants hold', { mono: true, size: '9', fill: BP }));
    shell(host, 'BOUNDED SELF-IMPROVEMENT', 'edit must clear every gate',
      svg,
      'A bounded loop checks each proposed self-modification against external invariants the loop cannot edit: formal invariants, an immutable alignment anchor, every safety objective, and a regression check. An edit is accepted only if it clears all of them; one that violates any gate is bounced. None of this is a proof of safety — it raises the cost of silent failure.');
  }

  // ── injection-boundary: untrusted page content fires injection attempts at
  //    the agent's read/act boundary; most bounce, one slips. (Phase 15 · 11) ──
  function injectionBoundary(host) {
    var svg = newSvg(250);
    var bx = 250;
    // the fuzzy read/act boundary
    var bound = svgEl('line', { x1: bx, y1: 30, x2: bx, y2: 220, stroke: BP, 'stroke-width': '2', 'stroke-dasharray': '6 5' });
    svg.appendChild(bound);
    svg.appendChild(txt(bx, 22, 'read  ⇋  act  boundary', { mono: true, size: '9', fill: BP }));
    // left: untrusted web page
    svg.appendChild(svgEl('rect', { x: 24, y: 60, width: 120, height: 130, rx: '4', fill: SURF, stroke: RULE, 'stroke-width': '1.5' }));
    svg.appendChild(txt(84, 52, 'untrusted page', { mono: true, size: '9', fill: MUTE }));
    var ly;
    for (ly = 0; ly < 5; ly++) svg.appendChild(svgEl('line', { x1: 38, y1: 82 + ly * 22, x2: 130, y2: 82 + ly * 22, stroke: RULE, 'stroke-width': '4' }));
    // right: the agent
    svg.appendChild(svgEl('circle', { cx: 420, cy: 125, r: '34', fill: SURF, stroke: BP, 'stroke-width': '2' }));
    svg.appendChild(txt(420, 122, 'agent', { mono: true, size: '11', fill: INK }));
    svg.appendChild(txt(420, 138, 'tools', { mono: true, size: '8', fill: MUTE }));
    // injection darts: three bounce off the boundary, one passes through
    var lanes = [80, 125, 170], i;
    for (i = 0; i < 3; i++) {
      var dart = svgEl('polygon', { points: '0,-4 12,0 0,4', fill: WARN });
      var bounce = svgEl('animateTransform', {
        attributeName: 'transform', type: 'translate', repeatCount: 'indefinite',
        dur: '2.6s', begin: (i * 0.55) + 's',
        values: '150,' + lanes[i] + '; ' + (bx - 6) + ',' + lanes[i] + '; 150,' + lanes[i],
        keyTimes: '0;0.5;1'
      });
      dart.appendChild(bounce);
      var fade = anim('opacity', { values: '0;1;1;0.4;0', dur: '2.6s', begin: (i * 0.55) + 's', keyTimes: '0;0.1;0.45;0.55;1' });
      dart.appendChild(fade);
      svg.appendChild(dart);
    }
    // the one that slips through
    var slip = svgEl('polygon', { points: '0,-4 12,0 0,4', fill: BP });
    slip.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', repeatCount: 'indefinite', dur: '3.6s', begin: '1.8s', values: '150,125; 386,125', keyTimes: '0;1' }));
    slip.appendChild(anim('opacity', { values: '0;1;1;0', dur: '3.6s', begin: '1.8s', keyTimes: '0;0.08;0.9;1' }));
    svg.appendChild(slip);
    shell(host, 'BROWSER-AGENT INJECTION', 'reading is a command channel',
      svg,
      'A browser agent reads untrusted pages and takes consequential actions. Every page is an input the user did not write, so each line of content is a potential command aimed at the fuzzy read-versus-act boundary. Defenses bounce most attempts, but indirect prompt injection lives in that boundary and, as OpenAI put it, "is not a bug that can be fully patched."');
  }

  // ── cost-governor-stack: spend rises through stacked caps at different time
  //    scales; the velocity limit trips first. (Phase 15 · 13) ─────────────────
  function costGovernorStack(host) {
    var svg = newSvg(250);
    var caps = [
      { y: 190, label: 'per-request', v: '0' },
      { y: 150, label: 'per-task', v: '1' },
      { y: 110, label: 'velocity (10 min)', v: '2', trip: true },
      { y: 70, label: 'per-day', v: '3' },
      { y: 36, label: 'per-month', v: '4' }
    ];
    var gx = 70, gw = 320, i;
    for (i = 0; i < caps.length; i++) {
      var c = caps[i];
      svg.appendChild(svgEl('line', { x1: gx, y1: c.y, x2: gx + gw, y2: c.y, stroke: c.trip ? WARN : RULE, 'stroke-width': c.trip ? '2' : '1.5', 'stroke-dasharray': c.trip ? '' : '4 4' }));
      svg.appendChild(txt(gx + gw + 8, c.y + 4, c.label, { mono: true, size: '9', fill: c.trip ? WARN : SOFT, anchor: 'start' }));
    }
    // rising spend bar
    var bar = svgEl('rect', { x: gx + 40, y: 220, width: 40, height: 0, rx: '2', fill: BP });
    bar.appendChild(anim('y', { values: '220;110;110', dur: '4s', keyTimes: '0;0.7;1', fill: 'freeze' }));
    bar.appendChild(anim('height', { values: '0;110;110', dur: '4s', keyTimes: '0;0.7;1', fill: 'freeze' }));
    bar.appendChild(anim('fill', { values: BP + ';' + BP + ';' + WARN + ';' + WARN, dur: '4s', keyTimes: '0;0.68;0.72;1', fill: 'freeze' }));
    svg.appendChild(bar);
    svg.appendChild(txt(gx + 60, 234, '$ spend', { mono: true, size: '9', fill: MUTE }));
    // "CUT" flash when velocity cap trips
    var cut = svgEl('text', { x: gx + 160, y: 100, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '14', fill: WARN, opacity: '0' });
    cut.appendChild(document.createTextNode('⚡ access cut'));
    cut.appendChild(anim('opacity', { values: '0;0;1;1', dur: '4s', keyTimes: '0;0.7;0.78;1', fill: 'freeze' }));
    svg.appendChild(cut);
    shell(host, 'COST-GOVERNOR STACK', 'caps at every time scale',
      svg,
      'A single monthly cap catches a runaway agent only after the wallet is gone. The fix is a stack of limits at different time scales — per-request, per-task, velocity, per-day, per-month. A runaway loop burns fast, so the velocity limit ("$50 in 10 minutes") trips long before the daily or monthly caps would ever fire.');
  }

  // ── circuit-breaker: a repeating identical tool call trips the breaker, which
  //    flips from closed to open. (Phase 15 · 14) ──────────────────────────────
  function circuitBreaker(host) {
    var svg = newSvg(240);
    // call log on the left: five identical calls stack up
    var lx = 36, i;
    svg.appendChild(txt(lx + 70, 24, 'tool calls', { mono: true, size: '9', fill: MUTE }));
    for (i = 0; i < 5; i++) {
      var r = svgEl('rect', { x: lx, y: 40 + i * 34, width: 150, height: 26, rx: '3', fill: SURF, stroke: i === 4 ? WARN : RULE, 'stroke-width': '1.5', opacity: '0' });
      r.appendChild(anim('opacity', { values: '0;1', dur: '0.3s', begin: (i * 0.7) + 's', fill: 'freeze' }));
      svg.appendChild(r);
      var tl = txt(lx + 75, 40 + i * 34 + 17, 'delete(record_42)', { mono: true, size: '10', fill: i === 4 ? WARN : SOFT });
      tl.setAttribute('opacity', '0');
      tl.appendChild(anim('opacity', { values: '0;1', dur: '0.3s', begin: (i * 0.7) + 's', fill: 'freeze' }));
      svg.appendChild(tl);
    }
    // the breaker switch on the right
    var bx = 360, by = 120;
    svg.appendChild(svgEl('circle', { cx: bx, cy: by - 50, r: '6', fill: BP }));
    svg.appendChild(svgEl('circle', { cx: bx, cy: by + 50, r: '6', fill: BP }));
    svg.appendChild(svgEl('line', { x1: bx, y1: by - 50, x2: bx, y2: by - 44, stroke: SOFT, 'stroke-width': '2' }));
    svg.appendChild(svgEl('line', { x1: bx, y1: by + 50, x2: bx, y2: by + 44, stroke: SOFT, 'stroke-width': '2' }));
    // the lever: starts closed (connecting), then snaps open
    var lever = svgEl('line', { x1: bx, y1: by - 44, x2: bx, y2: by + 44, stroke: BP, 'stroke-width': '3' });
    var lt = svgEl('animateTransform', { attributeName: 'transform', type: 'rotate', dur: '4.5s', repeatCount: 'indefinite', values: '0 ' + bx + ' ' + (by - 44) + ';0 ' + bx + ' ' + (by - 44) + ';48 ' + bx + ' ' + (by - 44) + ';48 ' + bx + ' ' + (by - 44), keyTimes: '0;0.62;0.72;1' });
    lever.appendChild(lt);
    lever.appendChild(anim('stroke', { values: BP + ';' + BP + ';' + WARN + ';' + WARN, dur: '4.5s', keyTimes: '0;0.62;0.72;1' }));
    svg.appendChild(lever);
    var st = svgEl('text', { x: bx + 4, y: by + 78, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '11', fill: WARN, opacity: '0' });
    st.appendChild(document.createTextNode('OPEN — paused'));
    st.appendChild(anim('opacity', { values: '0;0;1;1', dur: '4.5s', keyTimes: '0;0.7;0.78;1', fill: 'freeze' }));
    svg.appendChild(st);
    svg.appendChild(txt(bx, 30, 'circuit breaker', { mono: true, size: '9', fill: MUTE }));
    shell(host, 'CIRCUIT BREAKER', 'pattern trips the switch',
      svg,
      'A circuit breaker watches for a specific action pattern — here, five identical destructive calls in a row. When the pattern trips, it snaps from closed to open: the offending path pauses and escalates to a human. Unlike a cost cap, it does not trust the agent\'s self-report; it reacts to what the agent actually does.');
  }

  // ── checkpoint-replay: a workflow runs, crashes mid-step, and a new worker
  //    replays from the last checkpoint. (Phase 15 · 16) ───────────────────────
  function checkpointReplay(host) {
    var svg = newSvg(240);
    var y = 110, steps = ['start', 'ckpt A', 'step', 'ckpt B', 'step', 'commit'];
    var x0 = 40, dx = 88, i;
    svg.appendChild(svgEl('line', { x1: x0, y1: y, x2: x0 + dx * 5, y2: y, stroke: RULE, 'stroke-width': '2' }));
    for (i = 0; i < steps.length; i++) {
      var x = x0 + i * dx, ck = steps[i].indexOf('ckpt') === 0;
      if (ck) {
        svg.appendChild(svgEl('rect', { x: x - 9, y: y - 9, width: 18, height: 18, fill: BP, transform: 'rotate(45 ' + x + ' ' + y + ')' }));
      } else {
        svg.appendChild(svgEl('circle', { cx: x, cy: y, r: '7', fill: SURF, stroke: SOFT, 'stroke-width': '1.5' }));
      }
      svg.appendChild(txt(x, ck ? y - 18 : y + 24, steps[i], { mono: true, size: '9', fill: ck ? BP : SOFT }));
    }
    var crashX = x0 + dx * 4;
    var ckBX = x0 + dx * 3;
    // crash marker
    var crash = svgEl('text', { x: crashX, y: y - 26, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '15', fill: WARN, opacity: '0' });
    crash.appendChild(document.createTextNode('✕ crash'));
    crash.appendChild(anim('opacity', { values: '0;0;1;1;0;0', dur: '6s', keyTimes: '0;0.42;0.46;0.62;0.66;1' }));
    svg.appendChild(crash);
    // worker playhead: advances to crash, jumps back to ckpt B, replays forward
    var head = svgEl('circle', { cx: x0, cy: y, r: '6', fill: WARN });
    head.appendChild(anim('cx', {
      values: x0 + ';' + crashX + ';' + ckBX + ';' + (x0 + dx * 5),
      dur: '6s', keyTimes: '0;0.45;0.55;1', calcMode: 'linear'
    }));
    head.appendChild(anim('fill', { values: WARN + ';' + WARN + ';' + BP + ';' + BP, dur: '6s', keyTimes: '0;0.5;0.55;1' }));
    svg.appendChild(head);
    // resume arc from crash back to ckpt B
    var arc = svgEl('path', { d: 'M ' + crashX + ' ' + (y - 12) + ' Q ' + ((crashX + ckBX) / 2) + ' ' + (y - 52) + ' ' + ckBX + ' ' + (y - 12), fill: 'none', stroke: BP, 'stroke-width': '1.5', 'stroke-dasharray': '4 3', 'marker-end': '', opacity: '0' });
    arc.appendChild(anim('opacity', { values: '0;0;1;1;0;0', dur: '6s', keyTimes: '0;0.46;0.5;0.7;0.8;1' }));
    svg.appendChild(arc);
    svg.appendChild(txt((crashX + ckBX) / 2, y - 56, 'resume from last checkpoint', { mono: true, size: '9', fill: BP }));
    shell(host, 'CHECKPOINT + REPLAY', 'lease recovery after a crash',
      svg,
      'Every graph-state transition persists. When a worker crashes mid-step its lease expires and another worker picks up at the latest checkpoint, replaying forward from there. Combined with an idempotency key and a precondition check, replay lands safely instead of double-executing an already-approved action.');
  }

  LF.register({
    'alphaevolve-loop': alphaevolveLoop,
    'dgm-archive': dgmArchive,
    'aar-forum': aarForum,
    'bounded-gates': boundedGates,
    'injection-boundary': injectionBoundary,
    'cost-governor-stack': costGovernorStack,
    'circuit-breaker': circuitBreaker,
    'checkpoint-replay': checkpointReplay
  });
})();
