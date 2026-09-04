/* figures-infra4.js - animated lesson figures for Phase 17 (Infrastructure and
   Production): managed platforms, observability wiring, canary rollout,
   AI SRE, chaos guardrails, secrets rotation, compliance mapping, FinOps.
   Loads after lesson-figures.js, registers through window.LF. SMIL motion
   only - no JS loops, no rAF. ES5, no deps, theme via CSS vars. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BP = 'var(--blueprint,#3553ff)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var MUTE = 'var(--ink-mute,#777)';
  var INKS = 'var(--ink-soft,#555)';
  var WARN = 'var(--warn,#b8870f)';
  var INK = 'var(--ink,#1a1a1a)';
  var BG = 'var(--bg,#fafaf5)';
  var SURF = 'var(--bg-surface,#eee)';
  var EASE = '0.23 1 0.32 1';
  var SPL4 = '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1';

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
  function rect(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: fill || BG, stroke: stroke || SOFT, 'stroke-width': '1.4' });
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) { for (var k in extra) { a[k] = extra[k]; } }
    return svgEl('animate', a);
  }
  function motion(path, dur, begin) {
    return svgEl('animateMotion', { path: path, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' });
  }
  // fade+grow entry: opacity 0 and 95% size in over the a..b phase window,
  // faster exit at 0.94..1. Contents draw relative to (cx, cy).
  function entry(cx, cy, dur, begin, a, b) {
    a = a || 0.02; b = b || 0.12;
    var kt = '0;' + a + ';' + b + ';0.94;1';
    var g = svgEl('g', { transform: 'translate(' + cx + ' ' + cy + ')', opacity: '0' });
    g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;0.95;1;1;0.97', keyTimes: kt, calcMode: 'spline', keySplines: SPL4, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' }));
    g.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: kt, calcMode: 'spline', keySplines: SPL4, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' }));
    return g;
  }

  // ── i4-platform-lanes: PTU reserved lane vs shared on-demand lane ──────────
  // 01-managed-llm-platforms
  function platformLanes(host) {
    var s = svg(230);
    s.appendChild(txt(40, 40, 'PTU reserved lane', '9', BP, 'start'));
    s.appendChild(svgEl('rect', { x: 40, y: 50, width: 330, height: 34, rx: '4', fill: 'none', stroke: BP, 'stroke-width': '1.6' }));
    s.appendChild(rect(390, 44, 100, 46, BG, BP));
    s.appendChild(txt(440, 63, 'dedicated', '9', BP));
    s.appendChild(txt(440, 77, '~50 ms median', '8', MUTE));
    var i;
    for (i = 0; i < 4; i++) {
      var d = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BP });
      d.appendChild(motion('M20 67 L440 67', '1.6s', (i * 0.4) + 's'));
      s.appendChild(d);
    }
    s.appendChild(txt(40, 128, 'on-demand shared lane', '9', WARN, 'start'));
    s.appendChild(svgEl('rect', { x: 40, y: 138, width: 330, height: 34, rx: '4', fill: 'none', stroke: WARN, 'stroke-width': '1.6' }));
    s.appendChild(rect(390, 132, 100, 46, BG, WARN));
    s.appendChild(txt(440, 151, 'shared pool', '9', WARN));
    s.appendChild(txt(440, 165, '~75 ms median', '8', MUTE));
    // shared lane: other tenants' grey traffic crowds the pipe, ours waits
    for (i = 0; i < 3; i++) {
      var o = svgEl('rect', { x: -5, y: -5, width: 10, height: 10, rx: '2', fill: MUTE, opacity: '0.5' });
      o.appendChild(motion('M60 155 L440 155', '2.6s', (i * 0.85) + 's'));
      s.appendChild(o);
    }
    for (i = 0; i < 2; i++) {
      var m = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: WARN });
      m.appendChild(motion('M20 155 L120 155 L120 155 L440 155', '3.2s', (i * 1.6) + 's'));
      s.appendChild(m);
    }
    var q = entry(150, 155, '3.2s', '0.3s', 0.05, 0.2);
    q.appendChild(txt(0, -16, 'queued behind neighbors', '8', MUTE));
    s.appendChild(q);
    s.appendChild(txt(260, 208, 'same model, different capacity contract: reserved beats shared by ~25 ms', '9', MUTE));
    shell(host, 'PLATFORM LANES', 'reserved PTU capacity vs shared on-demand', s,
      'The hyperscaler latency gap is a capacity story, not a model story. Azure PTUs reserve throughput, so requests ride a dedicated lane at ~50 ms median. Bedrock on-demand shares a pool with every other tenant, and the same-scale model reads ~75 ms because your tokens queue behind theirs. Pick the platform for its catalog and FinOps surface, then decide which workloads deserve the reserved lane.');
  }

  // ── i4-otel-glue: gateway spans fan out through OTel to two backends ───────
  // 13-llm-observability
  function otelGlue(host) {
    var s = svg(240);
    s.appendChild(rect(30, 96, 74, 44, BG, INK));
    s.appendChild(txt(67, 114, 'app', '10', INK));
    s.appendChild(txt(67, 128, 'LLM calls', '8', MUTE));
    s.appendChild(rect(170, 96, 84, 44, BG, INKS));
    s.appendChild(txt(212, 114, 'gateway', '10', INKS));
    s.appendChild(txt(212, 128, 'Helicone', '8', MUTE));
    s.appendChild(rect(300, 96, 70, 44, SURF, BP));
    s.appendChild(txt(335, 114, 'OTel', '10', BP));
    s.appendChild(txt(335, 128, 'collector', '8', MUTE));
    s.appendChild(rect(410, 34, 96, 44, BG, BP));
    s.appendChild(txt(458, 52, 'telemetry', '9', BP));
    s.appendChild(txt(458, 66, 'traces + cost', '8', MUTE));
    s.appendChild(rect(410, 158, 96, 44, BG, WARN));
    s.appendChild(txt(458, 176, 'eval platform', '9', WARN));
    s.appendChild(txt(458, 190, 'drift + RAG', '8', MUTE));
    s.appendChild(svgEl('path', { d: 'M104 118 L170 118', fill: 'none', stroke: SOFT, 'stroke-width': '1.2' }));
    s.appendChild(svgEl('path', { d: 'M254 118 L300 118', fill: 'none', stroke: SOFT, 'stroke-width': '1.2' }));
    var up = svgEl('path', { d: 'M370 108 L408 62', fill: 'none', stroke: BP, 'stroke-width': '1.4', 'stroke-dasharray': '4 4' });
    up.appendChild(anim('stroke-dashoffset', '16;0', '0.8s'));
    s.appendChild(up);
    var dn = svgEl('path', { d: 'M370 128 L408 174', fill: 'none', stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '4 4' });
    dn.appendChild(anim('stroke-dashoffset', '16;0', '0.8s'));
    s.appendChild(dn);
    // one request becomes a span; the collector clones it to both sinks
    var i;
    for (i = 0; i < 3; i++) {
      var b = (i * 1.4) + 's';
      var c = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: INKS });
      c.appendChild(motion('M0 118 L67 118 L212 118 L335 118', '4.2s', b));
      c.appendChild(anim('opacity', '1;1;0;0', '4.2s', { keyTimes: '0;0.6;0.62;1', begin: b }));
      s.appendChild(c);
      var t1 = svgEl('rect', { x: -5, y: -4, width: 10, height: 8, rx: '2', fill: BP });
      t1.appendChild(motion('M335 118 L335 118 L458 56', '4.2s', b));
      t1.appendChild(anim('opacity', '0;0;1;1;0', '4.2s', { keyTimes: '0;0.6;0.66;0.9;1', begin: b }));
      s.appendChild(t1);
      var t2 = svgEl('rect', { x: -5, y: -4, width: 10, height: 8, rx: '2', fill: WARN });
      t2.appendChild(motion('M335 118 L335 118 L458 180', '4.2s', b));
      t2.appendChild(anim('opacity', '0;0;1;1;0', '4.2s', { keyTimes: '0;0.6;0.66;0.9;1', begin: b }));
      s.appendChild(t2);
    }
    s.appendChild(txt(260, 228, 'one span, two sinks: no tool has to do both jobs', '9', MUTE));
    shell(host, 'OTEL GLUE PATTERN', 'gateway telemetry cloned to a metrics sink and an eval sink', s,
      'No single observability tool wins both jobs, so the production pattern splits them. The gateway captures every LLM call as an OpenTelemetry span; the collector clones each span to two sinks: a telemetry backend for traces, latency, and cost, and an eval platform for drift and RAG quality. Swapping either side later is a config change, not a re-instrumentation.');
  }

  // ── i4-canary-ramp: shadow mirror first, then gated traffic steps ──────────
  // 20-shadow-canary-progressive
  function canaryRamp(host) {
    var s = svg(250);
    s.appendChild(rect(30, 30, 70, 40, BG, INK));
    s.appendChild(txt(65, 47, 'traffic', '9', INK));
    s.appendChild(txt(65, 61, 'splitter', '8', MUTE));
    s.appendChild(rect(150, 20, 90, 36, BG, INKS));
    s.appendChild(txt(195, 35, 'prod model', '9', INKS));
    s.appendChild(txt(195, 48, 'serves users', '7.5', MUTE));
    s.appendChild(rect(150, 74, 90, 36, BG, BP));
    s.appendChild(txt(195, 89, 'candidate', '9', BP));
    s.appendChild(txt(195, 102, 'shadow: log only', '7.5', MUTE));
    s.appendChild(svgEl('path', { d: 'M100 42 L150 38', fill: 'none', stroke: SOFT, 'stroke-width': '1.2' }));
    var mir = svgEl('path', { d: 'M100 56 L150 88', fill: 'none', stroke: BP, 'stroke-width': '1.2', 'stroke-dasharray': '3 4' });
    mir.appendChild(anim('stroke-dashoffset', '14;0', '0.9s'));
    s.appendChild(mir);
    var i;
    for (i = 0; i < 3; i++) {
      var r1 = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: INKS });
      r1.appendChild(motion('M10 50 L65 50 L195 38', '2s', (i * 0.7) + 's'));
      s.appendChild(r1);
      var r2 = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: BP, opacity: '0.55' });
      r2.appendChild(motion('M10 50 L65 50 L195 92', '2s', (i * 0.7) + 's'));
      s.appendChild(r2);
    }
    s.appendChild(txt(120, 128, 'mirrored copy is discarded, never returned', '8', MUTE, 'start'));
    // canary share meter: steps 10 -> 25 -> 50 -> 100 with gates between
    var mx = 300, mw = 190, my = 40, mh = 130;
    s.appendChild(txt(mx + mw / 2, 28, 'canary share of live traffic', '9', INKS));
    s.appendChild(svgEl('rect', { x: mx, y: my, width: mw, height: mh, rx: '3', fill: 'none', stroke: SOFT, 'stroke-width': '1.2' }));
    var fill = svgEl('rect', { x: mx, y: my + mh, width: mw, height: 0, fill: BP, opacity: '0.3' });
    fill.appendChild(anim('height', '13;13;33;33;65;65;130;130;13', '6s', { keyTimes: '0;0.16;0.24;0.4;0.48;0.64;0.72;0.94;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    fill.appendChild(anim('y', (my + mh - 13) + ';' + (my + mh - 13) + ';' + (my + mh - 33) + ';' + (my + mh - 33) + ';' + (my + mh - 65) + ';' + (my + mh - 65) + ';' + (my + mh - 130) + ';' + (my + mh - 130) + ';' + (my + mh - 13), '6s', { keyTimes: '0;0.16;0.24;0.4;0.48;0.64;0.72;0.94;1', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    s.appendChild(fill);
    var steps = [[13, '10%'], [33, '25%'], [65, '50%'], [130, '100%']];
    for (i = 0; i < steps.length; i++) {
      s.appendChild(svgEl('line', { x1: mx, y1: my + mh - steps[i][0], x2: mx + mw, y2: my + mh - steps[i][0], stroke: SOFT, 'stroke-width': '0.7', 'stroke-dasharray': '2 3' }));
      s.appendChild(txt(mx + mw + 6, my + mh - steps[i][0] + 3, steps[i][1], '8', MUTE, 'start'));
    }
    var gate = entry(mx + mw / 2, my + mh + 20, '6s', '0s', 0.16, 0.22);
    gate.appendChild(txt(0, 3, 'gate: latency, cost, refusals, length, feedback', '8', WARN));
    s.appendChild(gate);
    s.appendChild(txt(260, 238, 'each step holds until the metric gate passes; rollback is a policy flip', '9', MUTE));
    shell(host, 'SHADOW THEN CANARY', 'mirror first, then step live traffic through metric gates', s,
      'Shadow mode duplicates production requests to the candidate and discards its answers, catching cost spikes and distribution shifts at zero user risk. Only then does the canary ramp start: 10, 25, 50, 100 percent, each step gated on latency percentiles, cost per request, refusal rate, output-length distribution, and user feedback. Rollback is a policy flip measured in seconds, never a redeploy.');
  }

  // ── i4-incident-agents: supervisor fans out to agents, human gate acts ─────
  // 23-sre-for-ai
  function incidentAgents(host) {
    var s = svg(250);
    var agents = [[52, 'logs'], [118, 'metrics'], [184, 'runbooks']];
    s.appendChild(rect(30, 96, 80, 44, BG, INK));
    s.appendChild(txt(70, 114, 'supervisor', '9', INK));
    s.appendChild(txt(70, 128, 'triage', '8', MUTE));
    var alert = svgEl('g', {}, [svgEl('circle', { cx: 0, cy: 0, r: 6, fill: WARN }), txt(0, 3, '!', '9', BG)]);
    alert.appendChild(motion('M-20 118 L30 118', '5.4s', '0s'));
    alert.appendChild(anim('opacity', '1;1;0;0', '5.4s', { keyTimes: '0;0.09;0.11;1' }));
    s.appendChild(alert);
    var i;
    for (i = 0; i < agents.length; i++) {
      var ax = 220, ay = agents[i][0];
      s.appendChild(rect(ax, ay - 16, 86, 34, BG, BP));
      s.appendChild(txt(ax + 43, ay + 4, agents[i][1] + ' agent', '8.5', BP));
      s.appendChild(svgEl('path', { d: 'M110 112 L' + ax + ' ' + ay, fill: 'none', stroke: SOFT, 'stroke-width': '1', 'stroke-dasharray': '3 4' }));
      // query out, evidence back
      var qd = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: BP });
      qd.appendChild(motion('M70 118 L' + (ax + 43) + ' ' + ay + ' L70 118', '5.4s', (0.6 + i * 0.25) + 's'));
      qd.appendChild(anim('opacity', '0;1;1;0;0', '5.4s', { keyTimes: '0;0.12;0.5;0.55;1', begin: (0.6 + i * 0.25) + 's' }));
      s.appendChild(qd);
    }
    var hyp = entry(70, 178, '5.4s', '0s', 0.55, 0.64);
    hyp.appendChild(svgEl('rect', { x: -55, y: -14, width: 110, height: 28, rx: '4', fill: SURF, stroke: BP, 'stroke-width': '1.2' }));
    hyp.appendChild(txt(0, -1, 'hypothesis:', '8', BP));
    hyp.appendChild(txt(0, 10, 'vLLM OOM, KV spike', '8', INKS));
    s.appendChild(hyp);
    s.appendChild(rect(350, 96, 66, 44, BG, WARN));
    s.appendChild(txt(383, 114, 'human', '9', WARN));
    s.appendChild(txt(383, 128, 'approve?', '8', MUTE));
    s.appendChild(rect(440, 96, 66, 44, BG, INKS));
    s.appendChild(txt(473, 114, 'action', '9', INKS));
    s.appendChild(txt(473, 128, 'restart pod', '7.5', MUTE));
    var toGate = svgEl('circle', { cx: 0, cy: 0, r: 4.5, fill: BP });
    toGate.appendChild(motion('M125 178 L383 178 L383 118 L383 118 L473 118', '5.4s', '0s'));
    toGate.appendChild(anim('opacity', '0;0;1;1;1;0', '5.4s', { keyTimes: '0;0.66;0.7;0.82;0.95;1' }));
    s.appendChild(toGate);
    var ok = entry(383, 78, '5.4s', '0s', 0.8, 0.86);
    ok.appendChild(txt(0, 3, 'approved', '8', WARN));
    s.appendChild(ok);
    s.appendChild(txt(260, 238, 'agents gather evidence in parallel; judgment stays human', '9', MUTE));
    shell(host, 'AI SRE TRIAGE', 'supervisor fans out, evidence converges, a human gates the fix', s,
      'The page lands on a supervisor agent that fans queries to specialists: one greps logs, one correlates metrics to deploys, one matches runbooks. Their evidence converges into a hypothesis before anyone opens a dashboard. The remediation still crosses a human approval gate, and the autonomous set stays narrow: restart a pod, revert a deploy, nothing that re-architects the service at 3 a.m.');
  }

  // ── i4-chaos-guard: fault injections land until the burn-rate guard aborts ─
  // 24-chaos-engineering-llm
  function chaosGuard(host) {
    var s = svg(240);
    s.appendChild(rect(40, 40, 110, 44, BG, INKS));
    s.appendChild(txt(95, 58, 'control plane', '9', INKS));
    s.appendChild(txt(95, 72, 'scheduler', '8', MUTE));
    s.appendChild(rect(230, 90, 130, 60, BG, INK));
    s.appendChild(txt(295, 112, 'target: LLM service', '9', INK));
    s.appendChild(txt(295, 128, 'KV cache, gateway', '8', MUTE));
    // three faults fire into the target: two land, the third gets aborted
    var faults = [['429 storm', '0s', BP], ['KV evict', '1.8s', BP], ['net loss', '3.6s', WARN]];
    var i;
    for (i = 0; i < faults.length; i++) {
      var g = svgEl('g', {}, [
        svgEl('rect', { x: -26, y: -9, width: 52, height: 18, rx: '3', fill: BG, stroke: faults[i][2], 'stroke-width': '1.2' }),
        txt(0, 3, faults[i][0], '7.5', faults[i][2])
      ]);
      var land = i < 2;
      g.appendChild(motion(land ? 'M95 84 L95 120 L226 120' : 'M95 84 L95 120 L180 120 L180 120', '5.4s', faults[i][1]));
      g.appendChild(anim('opacity', land ? '0;1;1;0;0' : '0;1;1;1;0;0', '5.4s',
        { keyTimes: land ? '0;0.05;0.3;0.34;1' : '0;0.05;0.28;0.32;0.36;1', begin: faults[i][1] }));
      s.appendChild(g);
    }
    // safety plane: error-budget burn meter fills, crosses 2x, abort drops
    var bx = 410, by = 40, bh = 110;
    s.appendChild(txt(bx + 20, 30, 'budget burn', '8.5', INKS));
    s.appendChild(svgEl('rect', { x: bx, y: by, width: 40, height: bh, rx: '3', fill: 'none', stroke: SOFT, 'stroke-width': '1.2' }));
    s.appendChild(svgEl('line', { x1: bx - 4, y1: by + 36, x2: bx + 44, y2: by + 36, stroke: WARN, 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
    s.appendChild(txt(bx + 58, by + 39, '2x', '8', WARN, 'start'));
    var burn = svgEl('rect', { x: bx + 3, y: by + bh - 3, width: 34, height: 0, fill: BP, opacity: '0.45' });
    burn.appendChild(anim('height', '0;20;44;80;80;0', '5.4s', { keyTimes: '0;0.2;0.45;0.68;0.94;1', calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    burn.appendChild(anim('y', (by + bh - 3) + ';' + (by + bh - 23) + ';' + (by + bh - 47) + ';' + (by + bh - 83) + ';' + (by + bh - 83) + ';' + (by + bh - 3), '5.4s', { keyTimes: '0;0.2;0.45;0.68;0.94;1', calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    burn.appendChild(anim('fill', BP + ';' + BP + ';' + BP + ';' + WARN + ';' + WARN + ';' + BP, '5.4s', { keyTimes: '0;0.2;0.45;0.68;0.94;1' }));
    s.appendChild(burn);
    var abort = entry(260, 190, '5.4s', '0s', 0.66, 0.72);
    abort.appendChild(svgEl('rect', { x: -92, y: -13, width: 184, height: 26, rx: '4', fill: SURF, stroke: WARN, 'stroke-width': '1.4' }));
    abort.appendChild(txt(0, 4, 'guard: burn > 2x, experiment paused', '8.5', WARN));
    s.appendChild(abort);
    s.appendChild(txt(260, 228, 'faults are scheduled, never loose: the safety plane can always abort', '9', MUTE));
    shell(host, 'CHAOS WITH A LEASH', 'injected faults run until the burn-rate guard pulls the plug', s,
      'The control plane schedules faults against the target: a 429 storm, a KV cache eviction, a network drop. The safety plane watches the error-budget burn meter the whole time. When daily burn crosses twice the expected rate, the guard aborts the experiment mid-flight and the last fault never lands. Chaos without that leash is just an outage you signed up for.');
  }

  // ── i4-vault-rotation: key rotates in the vault, gateway picks it up live ──
  // 25-security-secrets-audit
  function vaultRotation(host) {
    var s = svg(240);
    s.appendChild(rect(40, 80, 90, 70, BG, INK));
    s.appendChild(txt(85, 72, 'vault', '9', INK));
    // the stored key chip: old key fades out, new key grows in, in place
    var oldKey = svgEl('g', { transform: 'translate(85 115)' }, [
      svgEl('rect', { x: -30, y: -10, width: 60, height: 20, rx: '3', fill: WARN, opacity: '0.8' }),
      txt(0, 4, 'key v1', '8.5', BG)
    ]);
    oldKey.appendChild(anim('opacity', '1;1;0;0;1', '5.6s', { keyTimes: '0;0.3;0.36;0.96;1' }));
    s.appendChild(oldKey);
    var newKey = entry(85, 115, '5.6s', '0s', 0.36, 0.46);
    newKey.appendChild(svgEl('rect', { x: -30, y: -10, width: 60, height: 20, rx: '3', fill: BP }));
    newKey.appendChild(txt(0, 4, 'key v2', '8.5', BG));
    s.appendChild(newKey);
    var rot = entry(85, 166, '5.6s', '0s', 0.3, 0.38);
    rot.appendChild(txt(0, 3, 'rotated, <=90 days', '8', MUTE));
    s.appendChild(rot);
    s.appendChild(rect(220, 85, 100, 60, BG, INKS));
    s.appendChild(txt(270, 107, 'AI gateway', '9', INKS));
    s.appendChild(txt(270, 122, 'pulls at runtime', '7.5', MUTE));
    var pull = svgEl('path', { d: 'M130 115 L220 115', fill: 'none', stroke: BP, 'stroke-width': '1.4', 'stroke-dasharray': '4 4' });
    pull.appendChild(anim('stroke-dashoffset', '16;0', '0.8s'));
    s.appendChild(pull);
    // key material travels vault -> gateway only; color flips after rotation
    var kd = svgEl('rect', { x: -7, y: -5, width: 14, height: 10, rx: '2', fill: WARN });
    kd.appendChild(motion('M115 115 L215 115', '2.8s', '0s'));
    kd.appendChild(anim('fill', WARN + ';' + WARN + ';' + BP + ';' + BP, '5.6s', { keyTimes: '0;0.35;0.44;1' }));
    s.appendChild(kd);
    // apps call through the gateway and never hold a credential
    var apps = [[55, 'app A'], [115, 'app B'], [175, 'app C']];
    var i;
    for (i = 0; i < apps.length; i++) {
      s.appendChild(rect(400, apps[i][0] - 14, 76, 30, BG, SOFT));
      s.appendChild(txt(438, apps[i][0] + 5, apps[i][1], '8.5', MUTE));
      s.appendChild(svgEl('path', { d: 'M400 ' + apps[i][0] + ' L324 ' + (100 + i * 12), fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
      var rq = svgEl('circle', { cx: 0, cy: 0, r: 3.5, fill: INKS });
      rq.appendChild(motion('M438 ' + (apps[i][0] + 12) + ' L270 130', '2.2s', (i * 0.7) + 's'));
      s.appendChild(rq);
    }
    s.appendChild(txt(438, 190, 'no keys in env files or VCS', '8', MUTE));
    s.appendChild(txt(260, 228, 'rotate once in the vault; every app is current in minutes, zero redeploys', '9', MUTE));
    shell(host, 'VAULT-BACKED ROTATION', 'the key changes in one place and the gateway picks it up live', s,
      'Credentials live in the vault and nowhere else. Apps call the AI gateway, which pulls the current key at runtime, so no service ever holds a static secret. When key v1 rotates to v2, the swap happens in one place and every caller is current within minutes: no redeploys, no 40 config files, no message asking who has the new key. The 90-day rotation policy stops being a migration and becomes a non-event.');
  }

  // ── i4-control-matrix: one control lights its cells across framework rows ──
  // 26-compliance-frameworks
  function controlMatrix(host) {
    var s = svg(250);
    var rows = [['SOC 2 II', 1], ['GDPR', 1], ['HIPAA', 1], ['EU AI Act', 0], ['ISO 42001', 0]];
    var cols = [['access ctl', 140], ['PII redact', 250], ['audit log', 360]];
    // which controls satisfy which frameworks (1 = cell lights up)
    var map = [[1, 1, 1], [1, 1, 1], [1, 1, 1], [0, 1, 1], [1, 0, 1]];
    var i, j;
    for (j = 0; j < cols.length; j++) { s.appendChild(txt(cols[j][1] + 40, 38, cols[j][0], '8.5', INKS)); }
    for (i = 0; i < rows.length; i++) {
      var ry = 54 + i * 34;
      s.appendChild(txt(126, ry + 15, rows[i][0], '8.5', MUTE, 'end'));
      for (j = 0; j < cols.length; j++) {
        s.appendChild(svgEl('rect', { x: cols[j][1], y: ry, width: 80, height: 24, rx: '2', fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
        if (map[i][j]) {
          var c = svgEl('rect', { x: cols[j][1] + 2, y: ry + 2, width: 76, height: 20, rx: '2', fill: BP, opacity: '0' });
          c.appendChild(anim('opacity', '0;0;0.35;0.35;0', '5.2s', { keyTimes: '0;' + (0.1 + j * 0.22).toFixed(2) + ';' + (0.16 + j * 0.22).toFixed(2) + ';0.94;1', calcMode: 'spline', keySplines: SPL4, begin: (i * 0.05).toFixed(2) + 's' }));
          s.appendChild(c);
        }
      }
    }
    // one implemented control sweeps its column, lighting every row it maps to
    var chip = svgEl('g', {}, [
      svgEl('rect', { x: -38, y: -10, width: 76, height: 20, rx: '3', fill: BG, stroke: BP, 'stroke-width': '1.4' }),
      txt(0, 4, 'built once', '8', BP)
    ]);
    chip.appendChild(motion('M180 24 L180 24 L290 24 L290 24 L400 24 L400 24', '5.2s', '0s'));
    s.appendChild(chip);
    s.appendChild(txt(260, 238, 'one control, many cells: the matrix fills faster than the framework count grows', '9', MUTE));
    shell(host, 'CONTROL CROSS-MAPPING', 'each control lights every framework cell it satisfies', s,
      'Procurement wants a matrix with a row per framework, and the way to survive it is cross-mapping. One access-control implementation lights cells in SOC 2, GDPR Article 32, HIPAA 164.312(a), and ISO alike; PII redaction and audit logging sweep their own columns. You build each control once and claim it many times, so five frameworks cost far less than five audits, and the gaps that remain are visibly framework-specific, not everywhere.');
  }

  // ── i4-spend-ladder: tenant meters fill, one trips the cap and kill switch ─
  // 27-finops-llms
  function spendLadder(host) {
    var s = svg(250);
    s.appendChild(txt(40, 34, 'tokens in, stamped tenant_id at the call site', '9', INKS, 'start'));
    var tens = [
      { x: 70, name: 'tenant A', fills: '0;44;56;62;62;0', ok: true },
      { x: 220, name: 'tenant B', fills: '0;30;38;44;44;0', ok: true },
      { x: 370, name: 'tenant C', fills: '0;60;104;118;118;0', ok: false }
    ];
    var by = 60, bh = 120, i;
    for (i = 0; i < tens.length; i++) {
      var t = tens[i];
      s.appendChild(svgEl('rect', { x: t.x, y: by, width: 56, height: bh, rx: '3', fill: 'none', stroke: t.ok ? SOFT : WARN, 'stroke-width': '1.2' }));
      s.appendChild(svgEl('line', { x1: t.x - 4, y1: by + 24, x2: t.x + 60, y2: by + 24, stroke: WARN, 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      s.appendChild(txt(t.x + 28, by + bh + 16, t.name, '8.5', t.ok ? MUTE : WARN));
      var kt = '0;0.25;0.5;0.72;0.94;1';
      var f = svgEl('rect', { x: t.x + 3, y: by + bh - 3, width: 50, height: 0, fill: t.ok ? BP : WARN, opacity: '0.45' });
      f.appendChild(anim('height', t.fills, '5.6s', { keyTimes: kt, calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';0 0 1 1;0.4 0 1 1' }));
      f.appendChild(anim('y', t.fills.split(';').map(function (v) { return by + bh - 3 - Number(v); }).join(';'), '5.6s', { keyTimes: kt, calcMode: 'spline', keySplines: EASE + ';' + EASE + ';' + EASE + ';0 0 1 1;0.4 0 1 1' }));
      s.appendChild(f);
      // token drops feeding each meter
      var d = svgEl('circle', { cx: 0, cy: 0, r: 3.5, fill: t.ok ? BP : WARN });
      d.appendChild(motion('M' + (t.x + 28) + ' 40 L' + (t.x + 28) + ' ' + (by + 20), '1.1s', (i * 0.3) + 's'));
      s.appendChild(d);
    }
    s.appendChild(txt(36, by + 27, 'cap', '8', WARN, 'start'));
    // tenant C crosses the daily cap: kill switch trips, feed gets cut
    var kill = entry(398, 44, '5.6s', '0s', 0.52, 0.6);
    kill.appendChild(svgEl('rect', { x: -62, y: -12, width: 124, height: 24, rx: '4', fill: SURF, stroke: WARN, 'stroke-width': '1.4' }));
    kill.appendChild(txt(0, 4, 'z > 4: kill switch, 429', '8', WARN));
    s.appendChild(kill);
    s.appendChild(txt(260, 238, 'rate limit, then spend cap, then kill switch: A and B never notice C', '9', MUTE));
    shell(host, 'TENANT SPEND METERS', 'per-tenant meters fill until one trips the enforcement ladder', s,
      'Every call is stamped with tenant_id at creation, so spend lands in the right meter as it happens, not in a retroactive tagging pass. Tenants A and B fill normally under their daily caps. Tenant C spikes past the cap line, its spend z-score crosses 4, and the kill switch answers with 429s while the on-call gets paged. The ladder runs rate limit, spend cap, kill switch, and the blast radius stays inside one meter.');
  }

  LF.register({
    'i4-platform-lanes': platformLanes,
    'i4-otel-glue': otelGlue,
    'i4-canary-ramp': canaryRamp,
    'i4-incident-agents': incidentAgents,
    'i4-chaos-guard': chaosGuard,
    'i4-vault-rotation': vaultRotation,
    'i4-control-matrix': controlMatrix,
    'i4-spend-ladder': spendLadder
  });
})();
