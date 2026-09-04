/* figures-autoswarm5.js - animated, theme-aware figures for Phase 15
   (autonomous systems) and Phase 16 (multi-agent and swarms), fifth module.
   Loads after lesson-figures.js, registers through window.LF. No deps,
   ES5 only, SMIL animation, theme via CSS vars. Authoring: a ```figure
   block naming one of the widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function shell(host, label, hint, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '10', fill: fill || 'var(--ink-mute,#777)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function anim(attr, vals, kt, dur, opts) {
    var a = { attributeName: attr, values: vals, keyTimes: kt, dur: dur + 's', repeatCount: 'indefinite' };
    if (opts) for (var k in opts) a[k] = opts[k];
    return svgEl('animate', a);
  }
  function motion(path, kp, kt, dur, begin) {
    return svgEl('animateMotion', { path: path, keyPoints: kp, keyTimes: kt, dur: dur + 's', begin: (begin || 0) + 's', repeatCount: 'indefinite', calcMode: 'linear' });
  }
  function f2(x) { return x.toFixed(3); }
  var EASE = '0.23 1 0.32 1';
  var LIN = '0 0 1 1';
  // entry: hidden until lo, spline-eases to full by lo+rise, holds to hi,
  // exits by hi+drop (keep drop < rise so exits read faster than entries)
  function appear(node, lo, rise, hi, drop, period) {
    var kt = '0;' + f2(lo) + ';' + f2(lo + rise) + ';' + f2(hi) + ';' + f2(hi + drop) + ';1';
    node.appendChild(svgEl('animate', {
      attributeName: 'opacity', values: '0;0;1;1;0;0', keyTimes: kt, dur: period + 's',
      repeatCount: 'indefinite', calcMode: 'spline',
      keySplines: LIN + ';' + EASE + ';' + LIN + ';' + LIN + ';' + LIN
    }));
  }
  // scalar attribute grows from -> to inside the loop with the same ease
  function grow(node, attr, from, to, lo, rise, period) {
    var kt = '0;' + f2(lo) + ';' + f2(lo + rise) + ';1';
    node.appendChild(svgEl('animate', {
      attributeName: attr, values: from + ';' + from + ';' + to + ';' + to, keyTimes: kt,
      dur: period + 's', repeatCount: 'indefinite', calcMode: 'spline',
      keySplines: LIN + ';' + EASE + ';' + LIN
    }));
  }

  var BP = 'var(--blueprint,#3553ff)';
  var WARN = 'var(--warn,#b8870f)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var SURF = 'var(--bg-surface,#eee)';
  var MUTE = 'var(--ink-mute,#777)';

  // ── a5-scaffold-delta: one model feeds two scaffolds; the score bars land
  //    16.6 points apart with identical weights ──────────────────────────────
  function scaffoldDelta(host) {
    var W = 520, H = 250, period = 6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var mx = 62, my = 122, sx = 205, sy = [72, 172], i;
    var names = ['SWE-agent v1', 'Cline autonomous'];
    var pct = ['43.2%', '59.8%'];
    var bw = [78, 108];
    for (i = 0; i < 2; i++) {
      svg.appendChild(svgEl('line', { x1: mx + 24, y1: my, x2: sx - 52, y2: sy[i], stroke: SOFT, 'stroke-width': '1.2' }));
    }
    for (i = 0; i < 2; i++) {
      var pkt = svgEl('circle', { r: '4', fill: BP });
      appear(pkt, 0.02 + i * 0.05, 0.04, 0.2 + i * 0.05, 0.03, period);
      pkt.appendChild(motion('M' + (mx + 24) + ',' + my + ' L' + (sx - 52) + ',' + sy[i], '0;0;1;1', '0;' + f2(0.02 + i * 0.05) + ';' + f2(0.24 + i * 0.05) + ';1', period));
      svg.appendChild(pkt);
    }
    svg.appendChild(svgEl('circle', { cx: mx, cy: my, r: '24', stroke: BP, 'stroke-width': '2', fill: SURF }));
    svg.appendChild(txt(mx, my - 2, 'same', '8', BP));
    svg.appendChild(txt(mx, my + 10, 'model', '8', BP));
    for (i = 0; i < 2; i++) {
      svg.appendChild(svgEl('rect', { x: sx - 52, y: sy[i] - 18, width: 104, height: 36, fill: SURF, stroke: (i ? WARN : MUTE), 'stroke-width': '2', rx: '3' }));
      svg.appendChild(txt(sx, sy[i] + 3, names[i], '8', i ? WARN : MUTE));
      svg.appendChild(svgEl('rect', { x: 290, y: sy[i] - 6, width: 180, height: 12, fill: SURF, stroke: SOFT, 'stroke-width': '1' }));
      var fill = svgEl('rect', { x: 290, y: sy[i] - 6, width: 0, height: 12, fill: i ? WARN : MUTE });
      grow(fill, 'width', 0, bw[i], 0.3 + i * 0.1, 0.2, period);
      svg.appendChild(fill);
      var lab = txt(290 + bw[i] + 6, sy[i] + 3, pct[i], '9', i ? WARN : MUTE, 'start');
      appear(lab, 0.5 + i * 0.1, 0.08, 0.94, 0.04, period);
      svg.appendChild(lab);
    }
    var delta = txt(380, 126, '+16.6 pts, same weights', '9', BP);
    appear(delta, 0.7, 0.1, 0.93, 0.05, period);
    svg.appendChild(delta);
    svg.appendChild(txt(W / 2, H - 12, 'one model, two scaffolds  ·  the loop around the model is load-bearing', '9', MUTE));
    shell(host, 'SCAFFOLD DELTA', 'same weights, different loop', svg,
      'Claude Sonnet 4.5 scores 43.2% on SWE-bench Verified inside SWE-agent v1 and 59.8% inside the Cline autonomous scaffold. Same weights, 16.6 points apart. The retrieval layer, planner, sandbox, and edit-verify loop around the model now matter as much as the model itself.');
  }

  // ── a5-guard-sieve: prompts pass an input classifier and responses pass an
  //    output classifier; one attack is caught, an emoji-smuggled one slips ──
  function guardSieve(host) {
    var W = 520, H = 230, period = 7, y = 100;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: 30, y1: y, x2: 490, y2: y, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(svgEl('rect', { x: 235, y: y - 24, width: 76, height: 48, fill: SURF, stroke: MUTE, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(273, y + 4, 'model', '10', MUTE));
    var gx = [160, 372], glab = ['guard in', 'guard out'], i;
    for (i = 0; i < 2; i++) {
      var g = svgEl('rect', { x: gx[i] - 9, y: y - 38, width: 18, height: 76, fill: SURF, stroke: BP, 'stroke-width': '2', rx: '3' });
      if (i === 0) g.appendChild(anim('stroke', BP + ';' + BP + ';' + WARN + ';' + WARN + ';' + BP + ';' + BP, '0;0.4;0.43;0.52;0.56;1', period));
      svg.appendChild(g);
      svg.appendChild(txt(gx[i], y - 46, glab[i], '8', BP));
      svg.appendChild(txt(gx[i], y + 52, 'S1-S14', '7', MUTE));
    }
    var safe = svgEl('circle', { r: '4.5', fill: BP });
    appear(safe, 0.02, 0.04, 0.3, 0.03, period);
    safe.appendChild(motion('M38,' + y + ' L482,' + y, '0;0;1;1', '0;0.02;0.32;1', period));
    svg.appendChild(safe);
    var bad = svgEl('rect', { x: -4.5, y: -4.5, width: 9, height: 9, fill: WARN, rx: '2' });
    var bg = svgEl('g', {});
    bg.appendChild(bad);
    appear(bg, 0.36, 0.03, 0.5, 0.03, period);
    bg.appendChild(motion('M38,' + y + ' L' + gx[0] + ',' + y + ' L' + gx[0] + ',' + (y + 58), '0;0;0.65;1;1', '0;0.36;0.44;0.52;1', period));
    svg.appendChild(bg);
    var blocked = txt(gx[0] + 34, y + 62, 'blocked', '8', WARN, 'start');
    appear(blocked, 0.45, 0.05, 0.56, 0.03, period);
    svg.appendChild(blocked);
    var smug = svgEl('circle', { r: '4.5', fill: 'none', stroke: MUTE, 'stroke-width': '1.6', 'stroke-dasharray': '2 2' });
    appear(smug, 0.6, 0.04, 0.93, 0.03, period);
    smug.appendChild(motion('M38,' + y + ' L482,' + y, '0;0;1;1', '0;0.6;0.94;1', period));
    svg.appendChild(smug);
    var slip = txt(440, y - 18, 'smuggled', '8', MUTE);
    appear(slip, 0.82, 0.06, 0.93, 0.03, period);
    svg.appendChild(slip);
    svg.appendChild(txt(W / 2, H - 12, 'classify the input, classify the output  ·  character-level attacks still get through', '9', MUTE));
    shell(host, 'GUARD SIEVE', 'classify in, classify out', svg,
      'Llama Guard sits on both sides of the model, classifying inputs and outputs against the MLCommons S1-S14 hazard taxonomy. Obvious misuse is caught cheaply. But Huang et al. 2025 measured emoji smuggling at 100% attack success across six guard systems: classifiers are a layer, not a solution.');
  }

  // ── a5-rsp-ladder: a capability gauge rises toward the AI R&D-4 threshold
  //    while the v3.0 policy splits commitments into two tiers ───────────────
  function rspLadder(host) {
    var W = 520, H = 250, period = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var gx = 100, top = 50, bot = 205;
    svg.appendChild(svgEl('rect', { x: gx - 17, y: top, width: 34, height: bot - top, fill: SURF, stroke: SOFT, 'stroke-width': '1.2' }));
    var fill = svgEl('rect', { x: gx - 17, y: bot, width: 34, height: 0, fill: BP, opacity: '0.55' });
    grow(fill, 'height', 0, 108, 0.05, 0.35, period);
    grow(fill, 'y', bot, bot - 108, 0.05, 0.35, period);
    svg.appendChild(fill);
    var th = svgEl('line', { x1: gx - 26, y1: 74, x2: gx + 26, y2: 74, stroke: WARN, 'stroke-width': '2', 'stroke-dasharray': '5 3' });
    th.appendChild(anim('opacity', '1;1;0.35;1;0.35;1;1', '0;0.45;0.52;0.6;0.68;0.76;1', period));
    svg.appendChild(th);
    svg.appendChild(txt(gx + 32, 78, 'AI R&D-4', '9', WARN, 'start'));
    var mark = txt(gx + 32, 101, 'Opus 4.6 today', '8', BP, 'start');
    appear(mark, 0.42, 0.08, 0.95, 0.04, period);
    svg.appendChild(mark);
    svg.appendChild(txt(gx, bot + 16, 'capability', '8', MUTE));
    var cx = 330;
    svg.appendChild(svgEl('rect', { x: cx - 80, y: 58, width: 160, height: 52, fill: SURF, stroke: BP, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(cx, 78, 'unilateral', '9', BP));
    svg.appendChild(txt(cx, 94, 'training + deploy gates', '7', MUTE));
    svg.appendChild(svgEl('rect', { x: cx - 80, y: 122, width: 160, height: 52, fill: 'none', stroke: MUTE, 'stroke-width': '1.6', 'stroke-dasharray': '5 3', rx: '3' }));
    svg.appendChild(txt(cx, 142, 'industry recommendation', '8', MUTE));
    svg.appendChild(txt(cx, 158, 'RAND SL-4 security', '7', MUTE));
    var pg = svgEl('g', {});
    pg.appendChild(svgEl('rect', { x: cx - 58, y: 186, width: 116, height: 24, fill: SURF, stroke: MUTE, 'stroke-width': '1.4', rx: '3' }));
    pg.appendChild(txt(cx, 202, 'pause clause (v2)', '8', MUTE));
    pg.appendChild(svgEl('line', { x1: cx - 52, y1: 198, x2: cx + 52, y2: 198, stroke: WARN, 'stroke-width': '1.8' }));
    appear(pg, 0.55, 0.08, 0.82, 0.04, period);
    svg.appendChild(pg);
    var drop = txt(cx, 226, 'dropped in v3.0', '8', WARN);
    appear(drop, 0.66, 0.06, 0.94, 0.03, period);
    svg.appendChild(drop);
    svg.appendChild(txt(gx, 40, 'gauge', '8', MUTE));
    svg.appendChild(txt(cx, 46, 'two-tier commitments', '8', MUTE));
    shell(host, 'RSP v3.0', 'gauge vs threshold', svg,
      'RSP v3.0 names AI R&D-4 as the next threshold: a model that could automate a substantial fraction of AI research at competitive cost. Claude Opus 4.6 sits below it, though Anthropic concedes that confidently ruling it out is getting difficult. Commitments now split into unilateral actions and industry recommendations, and the 2023 pause clause is gone; SaferAI scored the policy down from 2.2 to 1.9.');
  }

  // ── a5-tracked-vs-research: two lanes for the same capability; the Tracked
  //    lane passes reports and a review gate, the Research lane is only watched ─
  function trackedVsResearch(host) {
    var W = 520, H = 250, period = 7;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var ty = 82, ry = 178;
    svg.appendChild(svgEl('line', { x1: 40, y1: ty, x2: 480, y2: ty, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(svgEl('line', { x1: 40, y1: ry, x2: 480, y2: ry, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(txt(42, ty - 30, 'TRACKED', '9', BP, 'start'));
    svg.appendChild(txt(42, ry - 30, 'RESEARCH', '9', MUTE, 'start'));
    svg.appendChild(svgEl('rect', { x: 162, y: ty - 20, width: 92, height: 40, fill: SURF, stroke: BP, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(208, ty - 2, 'capability +', '8', BP));
    svg.appendChild(txt(208, ty + 10, 'safeguards reports', '7', MUTE));
    svg.appendChild(svgEl('rect', { x: 292, y: ty - 20, width: 56, height: 40, fill: SURF, stroke: BP, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(320, ty + 4, 'SAG', '9', BP));
    var gate = svgEl('line', { x1: 388, y1: ty - 18, x2: 388, y2: ty + 18, stroke: WARN, 'stroke-width': '3' });
    gate.appendChild(anim('opacity', '1;1;0;0;1', '0;0.5;0.56;0.94;1', period));
    svg.appendChild(gate);
    var open = txt(388, ty - 26, 'gate opens', '7', WARN);
    appear(open, 0.52, 0.05, 0.9, 0.04, period);
    svg.appendChild(open);
    var tc = svgEl('circle', { r: '5', fill: BP });
    appear(tc, 0.02, 0.04, 0.9, 0.04, period);
    tc.appendChild(motion('M48,' + ty + ' L472,' + ty, '0;0;0.34;0.34;0.6;0.6;1;1', '0;0.02;0.2;0.32;0.42;0.55;0.88;1', period));
    svg.appendChild(tc);
    svg.appendChild(svgEl('circle', { cx: 300, cy: ry, r: '13', fill: 'none', stroke: MUTE, 'stroke-width': '1.6' }));
    var eye = svgEl('circle', { cx: 300, cy: ry, r: '4', fill: MUTE });
    eye.appendChild(anim('r', '4;4;5.5;4;4', '0;0.5;0.58;0.66;1', period));
    svg.appendChild(eye);
    svg.appendChild(txt(300, ry + 28, 'observed', '7', MUTE));
    var rc = svgEl('circle', { r: '5', fill: MUTE });
    appear(rc, 0.38, 0.04, 0.9, 0.04, period);
    rc.appendChild(motion('M48,' + ry + ' L472,' + ry, '0;0;1;1', '0;0.38;0.88;1', period));
    svg.appendChild(rc);
    var nt = txt(420, ry - 12, 'no automatic trigger', '7', MUTE);
    appear(nt, 0.72, 0.06, 0.92, 0.04, period);
    svg.appendChild(nt);
    svg.appendChild(txt(W / 2, H - 12, 'same capability, two buckets  ·  which lane it lives in decides whether it is gated or watched', '8.5', MUTE));
    shell(host, 'TRACKED vs RESEARCH', 'gated or observed', svg,
      'OpenAI Preparedness v2 splits categories in two. Tracked Categories trigger Capabilities and Safeguards Reports reviewed by the Safety Advisory Group before deployment. Research Categories, including Long-range Autonomy and Sandbagging, are monitored with only potential mitigations. DeepMind FSF v3 makes the same move by folding autonomy into its ML R&D and Cyber domains.');
  }

  // ── a5-horizon-fit: task dots scatter on a log-time axis, a logistic curve
  //    draws through them, and the 50% crossing pins the time horizon ────────
  function horizonFit(host) {
    var W = 520, H = 250, period = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('line', { x1: 70, y1: 195, x2: 470, y2: 195, stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('line', { x1: 70, y1: 195, x2: 70, y2: 40, stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(txt(70, 212, '1 min', '8', MUTE));
    svg.appendChild(txt(270, 212, '1 hr', '8', MUTE));
    svg.appendChild(txt(455, 212, '8 hr+', '8', MUTE));
    svg.appendChild(txt(58, 58, '1.0', '8', MUTE, 'end'));
    svg.appendChild(txt(58, 125, '0.5', '8', MUTE, 'end'));
    svg.appendChild(txt(58, 196, '0.0', '8', MUTE, 'end'));
    svg.appendChild(txt(40, 32, 'P(success)', '8', MUTE, 'start'));
    var dx = [95, 140, 185, 240, 300, 360, 430];
    var dy = [60, 66, 80, 108, 152, 172, 182];
    var ok = [1, 1, 1, 1, 0, 0, 0], i;
    for (i = 0; i < 7; i++) {
      var d = svgEl('circle', { cx: dx[i], cy: dy[i], r: '4.5', fill: ok[i] ? BP : 'none', stroke: ok[i] ? 'none' : MUTE, 'stroke-width': '1.6' });
      appear(d, 0.03 + i * 0.03, 0.04, 0.95, 0.04, period);
      d.appendChild(anim('r', '4.3;4.3;4.8;4.5;4.5', '0;' + f2(0.03 + i * 0.03) + ';' + f2(0.08 + i * 0.03) + ';' + f2(0.12 + i * 0.03) + ';1', period));
      svg.appendChild(d);
    }
    var curve = svgEl('path', {
      d: 'M80,56 C170,58 210,74 268,120 C320,162 380,180 460,184',
      fill: 'none', stroke: BP, 'stroke-width': '2', pathLength: '100',
      'stroke-dasharray': '100', 'stroke-dashoffset': '100'
    });
    curve.appendChild(svgEl('animate', {
      attributeName: 'stroke-dashoffset', values: '100;100;0;0', keyTimes: '0;0.28;0.55;1',
      dur: period + 's', repeatCount: 'indefinite', calcMode: 'spline',
      keySplines: LIN + ';' + EASE + ';' + LIN
    }));
    svg.appendChild(curve);
    var hl = svgEl('line', { x1: 70, y1: 121, x2: 270, y2: 121, stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '4 3' });
    appear(hl, 0.58, 0.06, 0.95, 0.04, period);
    svg.appendChild(hl);
    var vl = svgEl('line', { x1: 270, y1: 121, x2: 270, y2: 195, stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '4 3' });
    appear(vl, 0.64, 0.06, 0.95, 0.04, period);
    svg.appendChild(vl);
    var hp = svgEl('circle', { cx: 270, cy: 121, r: '5.5', fill: WARN });
    appear(hp, 0.62, 0.05, 0.95, 0.04, period);
    hp.appendChild(anim('r', '5.2;5.2;6;5.5;5.5', '0;0.62;0.68;0.74;1', period));
    svg.appendChild(hp);
    var lab = txt(282, 140, 'time horizon', '9', WARN, 'start');
    appear(lab, 0.7, 0.06, 0.95, 0.04, period);
    svg.appendChild(lab);
    shell(host, 'TIME HORIZON FIT', 'logistic through the tasks', svg,
      'METR runs a model across HCAST, RE-Bench, and SWAA tasks spanning minutes to hours of expert time, then fits a logistic curve to success probability versus log expert-completion-time. The 50% crossing is the time horizon. It is an idealized upper bound measured without real consequences, not a deployment prediction.');
  }

  // ── a5-four-risks: the CAIS quadrants light in sequence; organizational
  //    risk holds the highlight because it is the one practitioners control ──
  function fourRisks(host) {
    var W = 520, H = 250, period = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var qx = [113, 293], qy = [46, 128], names = ['malicious use', 'AI races', 'organizational risks', 'rogue AIs'];
    var i;
    for (i = 0; i < 4; i++) {
      var x = qx[i % 2], y = qy[i < 2 ? 0 : 1];
      svg.appendChild(svgEl('rect', { x: x, y: y, width: 164, height: 70, fill: SURF, stroke: SOFT, 'stroke-width': '1.4', rx: '3' }));
      svg.appendChild(txt(x + 82, y + (i === 2 ? 22 : 40), names[i], '9', i === 2 ? WARN : 'var(--ink-soft,#555)'));
      var hi = svgEl('rect', { x: x, y: y, width: 164, height: 70, fill: 'none', stroke: i === 2 ? WARN : BP, 'stroke-width': '2.5', rx: '3' });
      if (i === 2) appear(hi, 0.28, 0.06, 0.94, 0.04, period);
      else appear(hi, 0.04 + i * 0.12, 0.05, 0.14 + i * 0.12, 0.03, period);
      svg.appendChild(hi);
    }
    var chips = ['safety culture', 'rigorous audits', 'infosec'];
    for (i = 0; i < 3; i++) {
      var c = txt(qx[0] + 82, qy[1] + 38 + i * 13, chips[i], '7.5', MUTE);
      appear(c, 0.48 + i * 0.05, 0.06, 0.93, 0.04, period);
      svg.appendChild(c);
    }
    svg.appendChild(txt(W / 2, H - 24, 'four societal-scale risk classes  ·  one of them is under your control', '9', MUTE));
    shell(host, 'FOUR RISKS', 'the CAIS taxonomy', svg,
      'The CAIS framework groups catastrophic AI risk into malicious use, AI races, organizational risks, and rogue AIs. The categories overlap: a rogue AI shipped by a lab that traded audits for speed in a race is all four at once. Organizational risk is the quadrant a practitioner can actually act on, which is why it holds the highlight.');
  }

  // ── a5-primitive-radar: agent, handoff, shared state, orchestrator as four
  //    axes; each framework is a different shape on the same radar ───────────
  function primitiveRadar(host) {
    var W = 520, H = 260, period = 9;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var cx = 260, cy = 122;
    svg.appendChild(svgEl('line', { x1: cx, y1: cy - 82, x2: cx, y2: cy + 82, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(svgEl('line', { x1: cx - 145, y1: cy, x2: cx + 145, y2: cy, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(txt(cx, cy - 90, 'agent', '9', MUTE));
    svg.appendChild(txt(cx + 152, cy + 3, 'handoff', '9', MUTE, 'start'));
    svg.appendChild(txt(cx, cy + 98, 'shared state', '9', MUTE));
    svg.appendChild(txt(cx - 152, cy + 3, 'orchestrator', '9', MUTE, 'end'));
    function pts(t) {
      return cx + ',' + (cy - 82 * t[0]) + ' ' + (cx + 145 * t[1]) + ',' + cy + ' ' +
        cx + ',' + (cy + 82 * t[2]) + ' ' + (cx - 145 * t[3]) + ',' + cy;
    }
    var shapes = [
      { n: 'OpenAI Swarm', t: [0.9, 0.9, 0.22, 0.18], c: BP },
      { n: 'LangGraph', t: [0.5, 0.6, 0.9, 0.95], c: WARN },
      { n: 'CrewAI', t: [0.85, 0.4, 0.5, 0.75], c: MUTE }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var poly = svgEl('polygon', { points: pts(shapes[i].t), fill: 'none', stroke: shapes[i].c, 'stroke-width': '2' });
      appear(poly, 0.02 + i * 0.33, 0.06, 0.27 + i * 0.33, 0.03, period);
      svg.appendChild(poly);
      var nm = txt(cx, H - 22, shapes[i].n, '10', shapes[i].c);
      appear(nm, 0.02 + i * 0.33, 0.06, 0.27 + i * 0.33, 0.03, period);
      svg.appendChild(nm);
    }
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: '3.5', fill: 'var(--ink,#1a1a1a)' }));
    shell(host, 'PRIMITIVE RADAR', 'four axes, every framework', svg,
      'Agent, handoff, shared state, orchestrator: four primitives span the whole design space. OpenAI Swarm leans on agents plus handoffs and leaves state to the caller. LangGraph puts weight on the StateGraph and a deterministic graph orchestrator. CrewAI leans on role-heavy agents with a manager process. Every new framework release is another shape on the same radar.');
  }

  // ── a5-og-narrator: an LLM alone closes few deals; splitting a deterministic
  //    offer generator from an LLM narrator triples the deal rate ────────────
  function ogNarrator(host) {
    var W = 520, H = 250, period = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var y1 = 70, y2 = 165;
    svg.appendChild(txt(42, y1 - 32, 'LLM ALONE', '8', MUTE, 'start'));
    svg.appendChild(svgEl('line', { x1: 40, y1: y1, x2: 330, y2: y1, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(svgEl('rect', { x: 140, y: y1 - 18, width: 100, height: 36, fill: SURF, stroke: MUTE, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(190, y1 - 2, 'LLM decides', '8', MUTE));
    svg.appendChild(txt(190, y1 + 10, 'and narrates', '7', MUTE));
    var p1 = svgEl('circle', { r: '4.5', fill: MUTE });
    appear(p1, 0.02, 0.04, 0.32, 0.03, period);
    p1.appendChild(motion('M46,' + y1 + ' L324,' + y1, '0;0;1;1', '0;0.02;0.33;1', period));
    svg.appendChild(p1);
    svg.appendChild(txt(42, y2 - 32, 'OG-NARRATOR', '8', BP, 'start'));
    svg.appendChild(svgEl('line', { x1: 40, y1: y2, x2: 330, y2: y2, stroke: SOFT, 'stroke-width': '1.2' }));
    svg.appendChild(svgEl('rect', { x: 96, y: y2 - 18, width: 88, height: 36, fill: SURF, stroke: BP, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(140, y2 - 2, 'offer generator', '7.5', BP));
    svg.appendChild(txt(140, y2 + 10, 'deterministic', '7', MUTE));
    svg.appendChild(svgEl('rect', { x: 208, y: y2 - 18, width: 88, height: 36, fill: SURF, stroke: WARN, 'stroke-width': '2', rx: '3' }));
    svg.appendChild(txt(252, y2 - 2, 'LLM narrator', '7.5', WARN));
    svg.appendChild(txt(252, y2 + 10, 'words only', '7', MUTE));
    var p2 = svgEl('circle', { r: '4.5', fill: BP });
    appear(p2, 0.4, 0.04, 0.78, 0.03, period);
    p2.appendChild(motion('M46,' + y2 + ' L324,' + y2, '0;0;0.33;0.33;0.72;0.72;1;1', '0;0.4;0.5;0.55;0.62;0.67;0.76;1', period));
    svg.appendChild(p2);
    svg.appendChild(svgEl('rect', { x: 360, y: y1 - 7, width: 110, height: 14, fill: SURF, stroke: SOFT, 'stroke-width': '1' }));
    var b1 = svgEl('rect', { x: 360, y: y1 - 7, width: 0, height: 14, fill: MUTE });
    grow(b1, 'width', 0, 29, 0.3, 0.14, period);
    svg.appendChild(b1);
    svg.appendChild(txt(415, y1 + 24, '26.7% deals', '8', MUTE));
    svg.appendChild(svgEl('rect', { x: 360, y: y2 - 7, width: 110, height: 14, fill: SURF, stroke: SOFT, 'stroke-width': '1' }));
    var b2 = svgEl('rect', { x: 360, y: y2 - 7, width: 0, height: 14, fill: BP });
    grow(b2, 'width', 0, 98, 0.76, 0.16, period);
    svg.appendChild(b2);
    svg.appendChild(txt(415, y2 + 24, '88.9% deals', '8', BP));
    svg.appendChild(txt(W / 2, H - 12, 'decide the number, then narrate it  ·  decoupling mechanism from language wins', '8.5', MUTE));
    shell(host, 'OG-NARRATOR', 'numbers, then words', svg,
      'LLMs conflate deciding an offer with narrating it, and close only 26.7% of tightly-parameterized bargains; scale does not fix it. OG-Narrator splits the two: a deterministic offer generator computes each numeric move and the LLM only writes the accompanying message. Deal rate jumps to 88.9%, echoing Contract Net: keep the mechanism separate from the communication layer.');
  }

  // ── a5-memory-reflection: observations stack into a stream, a reflection
  //    synthesizes from them and drops back in as a new retrievable memory ────
  function memoryReflection(host) {
    var W = 520, H = 250, period = 9;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var sx = 70, ey = [196, 170, 144, 118, 92], i;
    svg.appendChild(txt(sx + 60, 44, 'memory stream', '8', MUTE));
    for (i = 0; i < 5; i++) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: sx, y: ey[i], width: 120, height: 20, fill: SURF, stroke: SOFT, 'stroke-width': '1.2', rx: '2' }));
      g.appendChild(txt(sx + 60, ey[i] + 13, 'observation', '7.5', 'var(--ink-soft,#555)'));
      appear(g, 0.03 + i * 0.055, 0.05, 0.96, 0.03, period);
      svg.appendChild(g);
    }
    var rx = 350, ry = 105;
    for (i = 2; i < 5; i++) {
      var ln = svgEl('line', { x1: sx + 120, y1: ey[i] + 10, x2: rx - 56, y2: ry, stroke: BP, 'stroke-width': '1.2', 'stroke-dasharray': '3 3' });
      appear(ln, 0.38 + (i - 2) * 0.03, 0.05, 0.62, 0.03, period);
      svg.appendChild(ln);
    }
    var refl = svgEl('g', {});
    var ell = svgEl('ellipse', { cx: rx, cy: ry, rx: '56', ry: '30', fill: SURF, stroke: WARN, 'stroke-width': '2' });
    refl.appendChild(ell);
    refl.appendChild(txt(rx, ry - 2, 'reflection', '9', WARN));
    refl.appendChild(txt(rx, ry + 12, 'higher-order synthesis', '6.5', MUTE));
    appear(refl, 0.46, 0.06, 0.96, 0.03, period);
    ell.appendChild(anim('rx', '53;53;57;56;56', '0;0.46;0.52;0.58;1', period));
    svg.appendChild(refl);
    var back = svgEl('path', { d: 'M' + (rx - 50) + ',' + (ry - 22) + ' Q250,40 ' + (sx + 120) + ',62', fill: 'none', stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '4 3' });
    appear(back, 0.6, 0.05, 0.96, 0.03, period);
    svg.appendChild(back);
    var ne = svgEl('g', {});
    ne.appendChild(svgEl('rect', { x: sx, y: 56, width: 120, height: 20, fill: SURF, stroke: WARN, 'stroke-width': '1.6', rx: '2' }));
    ne.appendChild(txt(sx + 60, 69, 'reflection', '7.5', WARN));
    appear(ne, 0.66, 0.06, 0.96, 0.03, period);
    svg.appendChild(ne);
    var pl = svgEl('g', {});
    pl.appendChild(svgEl('rect', { x: rx - 46, y: 172, width: 92, height: 34, fill: SURF, stroke: BP, 'stroke-width': '2', rx: '3' }));
    pl.appendChild(txt(rx, 186, 'plan', '9', BP));
    pl.appendChild(txt(rx, 199, 'day, hour, action', '6.5', MUTE));
    appear(pl, 0.78, 0.06, 0.96, 0.03, period);
    svg.appendChild(pl);
    var pln = svgEl('line', { x1: rx, y1: ry + 32, x2: rx, y2: 170, stroke: BP, 'stroke-width': '1.4' });
    appear(pln, 0.74, 0.05, 0.96, 0.03, period);
    svg.appendChild(pln);
    svg.appendChild(txt(W / 2, H - 12, 'observe, reflect, plan  ·  reflections re-enter the stream and are retrieved like any memory', '8.5', MUTE));
    shell(host, 'GENERATIVE AGENT LOOP', 'stream, reflect, plan', svg,
      'Smallville agents keep an append-only memory stream scored by recency, importance, and relevance. Periodically the agent synthesizes recent memories into a reflection, which drops back into the stream and feeds top-down plans from day level to action level. Ablate any of the three and believability drops: this loop is what let one seeded party idea spread through 24 unscripted agents.');
  }

  // ── a5-retry-cascade: one payment failure fans out into multiplying retries
  //    downstream until a circuit breaker cuts the storm ─────────────────────
  function retryCascade(host) {
    var W = 520, H = 250, period = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var bx = [90, 250, 410], by = 100, names = ['payment', 'orders', 'inventory'], i;
    svg.appendChild(svgEl('line', { x1: bx[0], y1: by, x2: bx[2], y2: by, stroke: SOFT, 'stroke-width': '1.2' }));
    for (i = 0; i < 3; i++) {
      svg.appendChild(svgEl('rect', { x: bx[i] - 40, y: by - 20, width: 80, height: 40, fill: SURF, stroke: i === 0 ? WARN : BP, 'stroke-width': '2', rx: '3' }));
      svg.appendChild(txt(bx[i], by + 4, names[i], '9', i === 0 ? WARN : BP));
    }
    var fail = txt(bx[0], by - 30, 'fail', '9', WARN);
    appear(fail, 0.03, 0.04, 0.5, 0.03, period);
    svg.appendChild(fail);
    for (i = 0; i < 2; i++) {
      var r1 = svgEl('circle', { r: '4', fill: WARN });
      appear(r1, 0.08 + i * 0.04, 0.03, 0.24 + i * 0.04, 0.03, period);
      r1.appendChild(motion('M' + (bx[0] + 42) + ',' + by + ' L' + (bx[1] - 42) + ',' + by, '0;0;1;1', '0;' + f2(0.08 + i * 0.04) + ';' + f2(0.26 + i * 0.04) + ';1', period));
      svg.appendChild(r1);
    }
    for (i = 0; i < 4; i++) {
      var r2 = svgEl('circle', { r: '4', fill: WARN });
      appear(r2, 0.24 + i * 0.035, 0.03, 0.42 + i * 0.035, 0.03, period);
      r2.appendChild(motion('M' + (bx[1] + 42) + ',' + by + ' L' + (bx[2] - 42) + ',' + by, '0;0;1;1', '0;' + f2(0.24 + i * 0.035) + ';' + f2(0.44 + i * 0.035) + ';1', period));
      svg.appendChild(r2);
    }
    svg.appendChild(svgEl('rect', { x: bx[2] - 40, y: 140, width: 80, height: 10, fill: SURF, stroke: SOFT, 'stroke-width': '1' }));
    var load = svgEl('rect', { x: bx[2] - 40, y: 140, width: 6, height: 10, fill: WARN });
    grow(load, 'width', 6, 80, 0.28, 0.24, period);
    svg.appendChild(load);
    var tenx = txt(bx[2], 168, '10x load', '8', WARN);
    appear(tenx, 0.46, 0.05, 0.94, 0.03, period);
    svg.appendChild(tenx);
    var brk = svgEl('line', { x1: 330, y1: by - 26, x2: 330, y2: by + 26, stroke: WARN, 'stroke-width': '3' });
    appear(brk, 0.56, 0.05, 0.96, 0.03, period);
    svg.appendChild(brk);
    var bl = txt(330, by - 34, 'circuit breaker', '8', WARN);
    appear(bl, 0.6, 0.05, 0.94, 0.03, period);
    svg.appendChild(bl);
    var late = svgEl('circle', { r: '4', fill: MUTE });
    appear(late, 0.68, 0.03, 0.8, 0.02, period);
    late.appendChild(motion('M' + (bx[1] + 42) + ',' + by + ' L326,' + by, '0;0;1;1', '0;0.68;0.8;1', period));
    svg.appendChild(late);
    svg.appendChild(txt(W / 2, H - 12, '1 failure, 2 retries, 4 retries  ·  coordination failures are 36.9% of MAST traces', '8.5', MUTE));
    shell(host, 'RETRY CASCADE', 'the storm and the breaker', svg,
      'MAST puts coordination failures at 36.94% of 1642 multi-agent execution traces, and the retry storm is the canonical cascade: a payment failure triggers order retries, each order retry triggers inventory retries, and the inventory service sees 10x load within seconds. A circuit breaker between tiers is the mitigation that turns an amplifying chain back into one contained failure.');
  }

  // ── a5-bench-gap: the same frontier model as two columns, tall on Verified
  //    and short on Pro; the dashed line makes the gap visible ───────────────
  function benchGap(host) {
    var W = 520, H = 260, period = 7;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var base = 200;
    svg.appendChild(svgEl('line', { x1: 90, y1: base, x2: 430, y2: base, stroke: MUTE, 'stroke-width': '1.4' }));
    var vh = 127, ph = 39, vx = 150, px = 320, cw = 70;
    svg.appendChild(svgEl('rect', { x: vx, y: base - vh, width: cw, height: vh, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    var vc = svgEl('rect', { x: vx, y: base, width: cw, height: 0, fill: BP });
    grow(vc, 'height', 0, vh, 0.05, 0.22, period);
    grow(vc, 'y', base, base - vh, 0.05, 0.22, period);
    svg.appendChild(vc);
    var vl = txt(vx + cw / 2, base - vh - 10, '70-80%', '10', BP);
    appear(vl, 0.24, 0.06, 0.95, 0.04, period);
    svg.appendChild(vl);
    svg.appendChild(svgEl('rect', { x: px, y: base - ph, width: cw, height: ph, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    var pc = svgEl('rect', { x: px, y: base, width: cw, height: 0, fill: WARN });
    grow(pc, 'height', 0, ph, 0.35, 0.18, period);
    grow(pc, 'y', base, base - ph, 0.35, 0.18, period);
    svg.appendChild(pc);
    var pl = txt(px + cw / 2, base - ph - 10, '~23%', '10', WARN);
    appear(pl, 0.5, 0.06, 0.95, 0.04, period);
    svg.appendChild(pl);
    svg.appendChild(txt(vx + cw / 2, base + 16, 'SWE-bench Verified', '8', MUTE));
    svg.appendChild(txt(px + cw / 2, base + 16, 'SWE-bench Pro', '8', MUTE));
    svg.appendChild(txt(px + cw / 2, base + 29, '10+ line tasks', '7', MUTE));
    var dash = svgEl('line', { x1: vx + cw, y1: base - vh, x2: px + cw, y2: base - vh, stroke: BP, 'stroke-width': '1.2', 'stroke-dasharray': '4 3' });
    appear(dash, 0.56, 0.06, 0.95, 0.04, period);
    svg.appendChild(dash);
    var gap = svgEl('line', { x1: px + cw + 12, y1: base - vh, x2: px + cw + 12, y2: base - ph, stroke: WARN, 'stroke-width': '1.4' });
    appear(gap, 0.62, 0.06, 0.95, 0.04, period);
    svg.appendChild(gap);
    var gl = txt(px + cw + 20, base - (vh + ph) / 2, 'generalization gap', '8', WARN, 'start');
    appear(gl, 0.68, 0.06, 0.95, 0.04, period);
    svg.appendChild(gl);
    svg.appendChild(txt(W / 2, H - 12, 'same model, two task distributions  ·  passing Verified is not evidence of generalization', '8.5', MUTE));
    shell(host, 'BENCHMARK GAP', 'Verified vs Pro', svg,
      'Frontier models score 70%+ on SWE-bench Verified and about 23% on SWE-bench Pro, whose 1865 problems require 10+ line changes across 41 repos. Verified is near saturation, partially contaminated, and padded by an easy tail of one-to-two-line tasks. Pro is the uncontaminated reality check: read any leaderboard claim against both columns.');
  }

  // ── a5-orchestrator-scale: a lead agent spawns 1, then 3, then 10+ subagents
  //    as query complexity rises, and the token meter pays for it ────────────
  function orchestratorScale(host) {
    var W = 520, H = 260, period = 9;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var cx = 260, cy = 110, i;
    var win = [[0.02, 0.3], [0.35, 0.63], [0.68, 0.96]];
    var phases = ['simple query: 1 subagent', 'medium: 3 subagents', 'complex research: 10+ subagents'];
    function dot(ang, r, w, stag) {
      var x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
      var d = svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: '6', fill: SURF, stroke: BP, 'stroke-width': '1.8' });
      appear(d, w[0] + stag, 0.04, w[1], 0.025, period);
      d.appendChild(anim('r', '5.7;5.7;6.3;6;6', '0;' + f2(w[0] + stag) + ';' + f2(w[0] + stag + 0.05) + ';' + f2(w[0] + stag + 0.09) + ';1', period));
      svg.appendChild(d);
    }
    dot(-Math.PI / 2, 55, win[0], 0);
    for (i = 0; i < 3; i++) dot(-Math.PI / 2 + i * 2.09, 68, win[1], i * 0.025);
    for (i = 0; i < 8; i++) dot(i * Math.PI / 4, 88, win[2], i * 0.02);
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: '26', fill: SURF, stroke: BP, 'stroke-width': '2.5' }));
    svg.appendChild(txt(cx, cy - 2, 'lead', '9', BP));
    svg.appendChild(txt(cx, cy + 10, 'plans + synthesizes', '5.8', MUTE));
    for (i = 0; i < 3; i++) {
      var pt = txt(cx, 226, phases[i], '9', i === 2 ? WARN : BP);
      appear(pt, win[i][0], 0.05, win[i][1], 0.025, period);
      svg.appendChild(pt);
    }
    svg.appendChild(svgEl('rect', { x: 400, y: 46, width: 80, height: 10, fill: SURF, stroke: SOFT, 'stroke-width': '1' }));
    var tk = svgEl('rect', { x: 400, y: 46, width: 5, height: 10, fill: WARN });
    tk.appendChild(anim('width', '5;5;14;14;32;32;80;80', '0;0.05;0.28;0.38;0.6;0.7;0.94;1', period));
    svg.appendChild(tk);
    svg.appendChild(txt(440, 70, '15x tokens', '8', WARN));
    svg.appendChild(txt(W / 2, H - 12, 'scale effort to query complexity  ·  each subagent buys a fresh context window', '8.5', MUTE));
    shell(host, 'ORCHESTRATOR SCALE', 'spawn to match the query', svg,
      'Anthropic\'s Research system scales effort to query complexity: one agent with a few tool calls for simple lookups, three for medium queries, ten or more parallel subagents for complex research. It beat single-agent Opus 4 by 90.2%, token usage alone explained 80% of BrowseComp variance, and the bill is 15x tokens per query plus rainbow deploys for the long-running agents.');
  }

  LF.register({
    'a5-scaffold-delta': scaffoldDelta,
    'a5-guard-sieve': guardSieve,
    'a5-rsp-ladder': rspLadder,
    'a5-tracked-vs-research': trackedVsResearch,
    'a5-horizon-fit': horizonFit,
    'a5-four-risks': fourRisks,
    'a5-primitive-radar': primitiveRadar,
    'a5-og-narrator': ogNarrator,
    'a5-memory-reflection': memoryReflection,
    'a5-retry-cascade': retryCascade,
    'a5-bench-gap': benchGap,
    'a5-orchestrator-scale': orchestratorScale
  });
})();
