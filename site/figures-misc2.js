/* figures-misc2.js: animated lesson figures spanning Phase 15 (Autonomous
   Systems), Phase 17 (Infrastructure and Production), and Phase 11 (LLM
   Engineering). Loads after lesson-figures.js and registers through
   window.LF.register. Vanilla ES5, no deps, theme via CSS vars. Animation is
   SMIL only (animate / animateMotion / animateTransform). Authoring is the same
   fenced block:
       ```figure
       mx-tool-call-loop
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BP = 'var(--blueprint,#3553ff)';
  var SOFT = 'var(--rule-soft,#ccc)';
  var MUTE = 'var(--ink-mute,#999)';
  var WARN = 'var(--warn,#b8870f)';
  var INK = 'var(--ink,#1a1a1a)';
  var BG = 'var(--bg,#fafaf5)';

  function shell(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function motion(path, dur, begin) {
    return svgEl('animateMotion', { path: path, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' });
  }
  function box(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: 4, fill: fill || 'none', stroke: stroke || SOFT, 'stroke-width': 1.4 });
  }
  function txt(x, y, s, size, fill, anchor) {
    return svgEl('text', { x: x, y: y, 'font-family': 'var(--font-mono,monospace)', 'font-size': size || 11, fill: fill || MUTE, 'text-anchor': anchor || 'middle' }, [document.createTextNode(s)]);
  }

  // ── mx-propose-then-commit: durable record walks propose→review→commit→verify
  // phases/15-autonomous-systems/15-propose-then-commit
  function proposeThenCommit(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var stages = [
      { x: 40, t: 'PROPOSE', s: 'persist + key' },
      { x: 170, t: 'REVIEW', s: 'intent · blast' },
      { x: 300, t: 'COMMIT', s: 'positive ack' },
      { x: 430, t: 'VERIFY', s: 'side effect?' }
    ];
    stages.forEach(function (st, i) {
      svg.appendChild(svgEl('rect', { x: st.x, y: 80, width: 90, height: 50, rx: 4, fill: 'none', stroke: SOFT, 'stroke-width': 1.6 }));
      var active = svgEl('rect', { x: st.x, y: 80, width: 90, height: 50, rx: 4, fill: 'none', stroke: BP, 'stroke-width': 1.6, 'stroke-opacity': 0 });
      active.appendChild(anim('stroke-opacity', '0;1;0', '6.4s', { begin: (i * 1.6) + 's' }));
      svg.appendChild(active);
      svg.appendChild(txt(st.x + 45, 102, st.t, 9, INK));
      svg.appendChild(txt(st.x + 45, 118, st.s, 7.5, MUTE));
      if (i < 3) svg.appendChild(svgEl('path', { d: 'M' + (st.x + 90) + ' 105 L' + (st.x + 130) + ' 105', fill: 'none', stroke: SOFT, 'stroke-width': 1.2 }));
    });
    // the durable record token travels stage to stage and loops
    var rec = svgEl('g', {}, [svgEl('rect', { x: -11, y: -9, width: 22, height: 18, rx: 3, fill: BP }), txt(0, 4, 'rec', 7.5, BG)]);
    rec.appendChild(motion('M85 105 L215 105 L345 105 L475 105', '6.4s', '0s'));
    svg.appendChild(rec);
    // rubber-stamp warning: a fast skip from review straight past commit, flagged
    var stamp = txt(215, 60, 'rubber-stamp: skips review', 8, WARN);
    stamp.appendChild(anim('opacity', '0;0;0;1;1;0', '6.4s', { begin: '1.6s' }));
    svg.appendChild(stamp);
    svg.appendChild(txt(260, 175, 'idempotency key = resubmit returns the same record', 8.5, MUTE));
    svg.appendChild(txt(260, 192, 'commit only on positive ack; verify confirms the effect landed', 8.5, MUTE));
    shell(host, 'PROPOSE-THEN-COMMIT', 'a durable proposal walks four gated stages', svg,
      'The 2026 HITL shape is not a synchronous Approve prompt. The proposed action is persisted with an idempotency key, surfaced with intent, blast radius, and a rollback plan, committed only on positive acknowledgement, then verified to confirm the side effect actually happened. The failure mode is the rubber-stamp: clicking Approve without review. Challenge-and-response with an explicit checklist is the documented mitigation.');
  }

  // ── mx-priority-tiers: four-tier resolver, higher tier always wins ──────────
  // phases/15-autonomous-systems/17-constitutional-ai
  function priorityTiers(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var tiers = [
      { y: 40, t: '1 · SAFETY + OVERSIGHT', c: WARN, w: 380, hard: true },
      { y: 88, t: '2 · ETHICS', c: BP, w: 300, hard: false },
      { y: 136, t: '3 · ANTHROPIC GUIDELINES', c: MUTE, w: 230, hard: false },
      { y: 184, t: '4 · HELPFULNESS', c: SOFT, w: 160, hard: false }
    ];
    tiers.forEach(function (ti, i) {
      var x = (W - ti.w) / 2;
      svg.appendChild(svgEl('rect', { x: x, y: ti.y, width: ti.w, height: 36, rx: 4, fill: 'none', stroke: ti.c, 'stroke-width': i === 0 ? 2 : 1.4 }));
      svg.appendChild(txt(W / 2, ti.y + 23, ti.t, 9.5, ti.hard ? WARN : INK));
    });
    // a request signal rises through the tiers and is resolved at the top tier
    var probe = svgEl('circle', { cx: W / 2 + 130, cy: 202, r: 6, fill: BP });
    probe.appendChild(anim('cy', '202;202;154;106;58;58', '5s'));
    probe.appendChild(anim('cx', (W / 2 + 130) + ';' + (W / 2 + 130) + ';' + (W / 2 + 90) + ';' + (W / 2 + 40) + ';' + (W / 2) + ';' + (W / 2), '5s'));
    svg.appendChild(probe);
    var win = txt(W / 2, 30, 'conflict → higher tier wins', 9, WARN);
    win.appendChild(anim('opacity', '0;0;0;0;1;1', '5s'));
    svg.appendChild(win);
    svg.appendChild(txt(W / 2, 228, 'tier 1 is hardcoded: operators and users cannot override it', 8.5, MUTE));
    shell(host, 'CONSTITUTIONAL PRIORITY TIERS', 'four ranked tiers; conflicts resolve upward', svg,
      'The 2026 Claude Constitution ranks behaviour in four tiers: safety and supporting human oversight first, ethics second, Anthropic guidelines third, helpfulness last. When tiers conflict the higher one wins, the same shape as Unix priorities or network QoS. Hardcoded prohibitions sit above the whole stack and cannot be overridden; everything else is reason-based within the hierarchy, which trades auditability for generalisation to unseen cases.');
  }

  // ── mx-research-loop: hypothesis→code→run→critique cycle with sandbox + review
  // phases/15-autonomous-systems/05-ai-scientist-v2
  function researchLoop(host) {
    var W = 520, H = 240, CX = 260, CY = 120, R = 78;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var nodes = [
      { a: -90, t: 'idea', c: BP },
      { a: -18, t: 'novelty?', c: MUTE },
      { a: 54, t: 'experiment', c: BP },
      { a: 126, t: 'sandbox run', c: WARN },
      { a: 198, t: 'figures', c: BP },
      { a: 270, t: 'writeup', c: BP }
    ];
    // dashed cycle ring
    var ring = svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: SOFT, 'stroke-width': 1.4, 'stroke-dasharray': '5 5' });
    ring.appendChild(anim('stroke-dashoffset', '40;0', '2.2s'));
    svg.appendChild(ring);
    nodes.forEach(function (n) {
      var rad = n.a * Math.PI / 180;
      var x = CX + R * Math.cos(rad), y = CY + R * Math.sin(rad);
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, fill: n.c }));
      var lx = CX + (R + 30) * Math.cos(rad), ly = CY + (R + 30) * Math.sin(rad) + 3;
      svg.appendChild(txt(lx, ly, n.t, 8.5, n.c === WARN ? WARN : INK));
    });
    // the loop pointer orbits the ring
    var ptr = svgEl('circle', { cx: 0, cy: 0, r: 7, fill: BP });
    ptr.appendChild(motion('M' + CX + ' ' + (CY - R) + ' A ' + R + ' ' + R + ' 0 1 1 ' + (CX - 0.1) + ' ' + (CY - R) + ' Z', '5s', '0s'));
    svg.appendChild(ptr);
    // center critique label
    svg.appendChild(txt(CX, CY - 4, 'VLM', 9, INK));
    svg.appendChild(txt(CX, CY + 10, 'critique', 8, MUTE));
    svg.appendChild(txt(CX, 224, '42% of runs fail on coding errors; the loop re-enters at sandbox', 8.5, WARN));
    shell(host, 'AUTONOMOUS RESEARCH LOOP', 'idea → experiment → sandbox → critique, iterated', svg,
      'AI Scientist v2 closes the research loop without human templates: it generates ideas, checks novelty, drafts and runs experiments in a sandbox, has a vision-language model critique the figures, and writes the paper, iterating on internal review. One generated paper passed an ICLR 2025 workshop review. Independent evaluation found 42% of experiments failed on coding errors and the novelty check often mislabeled established methods as new, so the sandbox edge of the loop is where reliability is decided.');
  }

  // ── mx-speculative-tree: draft proposes K tokens, target verifies, accept/reject
  // phases/17-infrastructure-and-production/05-eagle3-speculative-decoding
  function speculativeTree(host) {
    var W = 520, H = 235;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(30, 95, 70, 44, BG, BP));
    svg.appendChild(txt(65, 113, 'draft', 9, BP));
    svg.appendChild(txt(65, 127, 'head', 8, MUTE));
    svg.appendChild(box(370, 95, 80, 44, BG, INK));
    svg.appendChild(txt(410, 113, 'target', 9, INK));
    svg.appendChild(txt(410, 127, '1 forward', 8, MUTE));
    // K drafted tokens in a row between draft and target; last is rejected
    var ks = [{ x: 140, ok: true }, { x: 190, ok: true }, { x: 240, ok: true }, { x: 290, ok: false }];
    ks.forEach(function (k, i) {
      var tok = svgEl('rect', { x: k.x, y: 102, width: 30, height: 28, rx: 3, fill: 'none', stroke: SOFT, 'stroke-width': 1.4 });
      tok.appendChild(anim('stroke', SOFT + ';' + (k.ok ? BP : WARN) + ';' + (k.ok ? BP : WARN), '4s', { begin: (i * 0.4) + 's' }));
      svg.appendChild(tok);
      svg.appendChild(txt(k.x + 15, 120, 't' + (i + 1), 8, MUTE));
      var mark = txt(k.x + 15, 152, k.ok ? 'accept' : 'reject', 7.5, k.ok ? BP : WARN);
      mark.appendChild(anim('opacity', '0;0;1;1', '4s', { begin: (i * 0.4) + 's' }));
      svg.appendChild(mark);
    });
    // draft proposes (token flowing right), target verifies (single pulse back)
    var prop = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BP });
    prop.appendChild(motion('M100 117 L370 117', '4s', '0s'));
    svg.appendChild(prop);
    var verify = svgEl('rect', { x: 365, y: 90, width: 90, height: 54, rx: 4, fill: 'none', stroke: INK, 'stroke-width': 1 });
    verify.appendChild(anim('opacity', '0.2;1;0.2', '4s', { begin: '1.8s' }));
    svg.appendChild(verify);
    svg.appendChild(txt(260, 185, 'accepted tokens are free; one reject costs a second target pass', 8.5, MUTE));
    svg.appendChild(txt(260, 202, 'alpha < ~0.55 → speculative decoding goes net negative', 8.5, WARN));
    shell(host, 'SPECULATIVE DECODING', 'draft proposes K, target verifies in one pass', svg,
      'EAGLE-3 trains a draft head on the target model hidden states, so its distribution tracks the target and acceptance rate alpha lands in the 0.6 to 0.8 band on general chat. The draft proposes K tokens; the target verifies all K in a single forward; accepted tokens are amortized free. But every rejected draft costs a second target pass, so below alpha of about 0.55 the technique is net negative at high concurrency. Measure alpha on real traffic first, flip the flag second.');
  }

  // ── mx-gateway-fallback: one API fans out to providers, 429 reroutes ────────
  // phases/17-infrastructure-and-production/19-ai-gateways
  function gatewayFallback(host) {
    var W = 520, H = 235;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(40, 95, 80, 46, BG, INK));
    svg.appendChild(txt(80, 113, 'gateway', 9, INK));
    svg.appendChild(txt(80, 128, 'one API', 8, MUTE));
    var prov = [
      { y: 45, t: 'primary', s: '429 over quota', c: WARN, down: true },
      { y: 110, t: 'fallback', s: 'serves it', c: BP, down: false },
      { y: 175, t: 'self-host', s: 'spare', c: MUTE, down: false }
    ];
    prov.forEach(function (p) {
      svg.appendChild(box(390, p.y - 20, 110, 40, BG, p.c));
      svg.appendChild(txt(445, p.y - 4, p.t, 9, p.c));
      svg.appendChild(txt(445, p.y + 10, p.s, 7.5, MUTE));
    });
    // primary link blocked (warn), fallback link active (blue dash)
    svg.appendChild(svgEl('path', { d: 'M120 108 L388 45', fill: 'none', stroke: WARN, 'stroke-width': 1.2, 'stroke-dasharray': '3 5' }));
    var fb = svgEl('path', { d: 'M120 116 L388 110', fill: 'none', stroke: BP, 'stroke-width': 2, 'stroke-dasharray': '6 4' });
    fb.appendChild(anim('stroke-dashoffset', '20;0', '0.8s'));
    svg.appendChild(fb);
    svg.appendChild(svgEl('path', { d: 'M120 124 L388 175', fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 5' }));
    // requests in: first tries primary (bounces), then routes to fallback
    var i;
    for (i = 0; i < 4; i++) {
      var g = svgEl('g', {}, [svgEl('circle', { cx: 0, cy: 0, r: 5, fill: BP })]);
      g.appendChild(motion('M-20 116 L80 116 L445 110', '3s', (i * 0.55) + 's'));
      svg.appendChild(g);
    }
    var bounce = txt(250, 60, '429 → reroute', 8, WARN);
    bounce.appendChild(anim('opacity', '0.3;1;0.3', '1.6s'));
    svg.appendChild(bounce);
    svg.appendChild(txt(260, 212, 'routing · fallback · retries · rate limits · secrets · observability', 8.5, MUTE));
    shell(host, 'AI GATEWAY FALLBACK', 'one API fans out; a 429 reroutes to the next provider', svg,
      'A gateway sits between your apps and providers, consolidating routing, fallback, retries, rate limits, secret references, and observability behind one OpenAI-compatible API. When the primary returns 429 or 5xx the gateway reroutes to a fallback provider so the request still completes. The 2026 split: LiteLLM (MIT, 100+ providers, breaks down near 2000 RPS), Portkey (control-plane, guardrails), Kong AI (fastest in its own benchmark), Bifrost (auto-retry). Data residency drives self-host vs managed.');
  }

  // ── mx-sequential-test: cumulative effect crosses an early-stop boundary ────
  // phases/17-infrastructure-and-production/21-ab-testing-llm-features
  function sequentialTest(host) {
    var W = 520, H = 230, PAD = 36;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var midY = H / 2;
    function px(t) { return PAD + t * (W - 2 * PAD); }
    function py(v) { return midY - v * (midY - PAD); }
    // funnel-shaped sequential boundaries (always-valid): wide early, narrow late
    function bound(sign) {
      var d = '', i;
      for (i = 0; i <= 40; i++) {
        var t = i / 40;
        var b = 0.95 / Math.sqrt(0.04 + t);
        b = Math.min(b, 1.05);
        d += (i ? 'L' : 'M') + px(t).toFixed(1) + ' ' + py(sign * b).toFixed(1) + ' ';
      }
      return d;
    }
    svg.appendChild(svgEl('path', { d: bound(1), fill: 'none', stroke: SOFT, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }));
    svg.appendChild(svgEl('path', { d: bound(-1), fill: 'none', stroke: SOFT, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }));
    svg.appendChild(svgEl('line', { x1: PAD, y1: midY, x2: W - PAD, y2: midY, stroke: MUTE, 'stroke-width': 1, 'stroke-dasharray': '2 4' }));
    svg.appendChild(txt(W - PAD, py(1) - 6, 'reject H0 (B wins)', 8, BP, 'end'));
    svg.appendChild(txt(W - PAD, midY + 14, 'no effect', 8, MUTE, 'end'));
    // cumulative test statistic random-walks up and crosses the upper boundary
    var walk = 'M' + px(0) + ' ' + py(0) + ' L' + px(0.12) + ' ' + py(0.18) + ' L' + px(0.24) + ' ' + py(0.1) +
      ' L' + px(0.36) + ' ' + py(0.34) + ' L' + px(0.48) + ' ' + py(0.46) + ' L' + px(0.6) + ' ' + py(0.62) +
      ' L' + px(0.7) + ' ' + py(0.78);
    var path = svgEl('path', { d: walk, fill: 'none', stroke: BP, 'stroke-width': 2 });
    var len = 600;
    path.setAttribute('stroke-dasharray', len);
    path.appendChild(anim('stroke-dashoffset', len + ';0', '4s'));
    svg.appendChild(path);
    var hit = svgEl('circle', { cx: px(0.7), cy: py(0.78), r: 6, fill: BP });
    hit.appendChild(anim('opacity', '0;0;0;1;1', '4s'));
    svg.appendChild(hit);
    var stop = txt(px(0.7), py(0.78) - 12, 'stop early', 8, BP);
    stop.appendChild(anim('opacity', '0;0;0;1;1', '4s'));
    svg.appendChild(stop);
    svg.appendChild(txt(W / 2, H - 10, 'peeking is safe: the boundary already paid for every look', 8.5, MUTE));
    shell(host, 'SEQUENTIAL A/B TEST', 'cumulative effect crosses an always-valid boundary', svg,
      'Evals ask whether the model can do the job; A/B tests ask whether users care. Fixed-horizon tests punish peeking, so 2026 platforms use sequential testing with always-valid boundaries that stay wide early and tighten over time. The cumulative statistic random-walks until it crosses a boundary, at which point you stop and ship, or it stays inside and you call it flat. CUPED reduces variance and Benjamini-Hochberg corrects for testing many variants at once.');
  }

  // ── mx-schema-funnel: free text → constrained decode → validated typed JSON ──
  // phases/11-llm-engineering/03-structured-outputs
  function schemaFunnel(host) {
    var W = 520, H = 235;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    // free text on the left
    svg.appendChild(box(28, 70, 120, 90, BG, MUTE));
    svg.appendChild(txt(88, 60, 'free text', 9, MUTE));
    [82, 100, 118, 136].forEach(function (ly, i) {
      svg.appendChild(svgEl('line', { x1: 40, y1: ly, x2: 40 + [96, 80, 104, 60][i], y2: ly, stroke: SOFT, 'stroke-width': 3 }));
    });
    // constrained-decode grammar gate in the middle
    svg.appendChild(box(210, 80, 100, 70, BG, BP));
    svg.appendChild(txt(260, 70, 'grammar gate', 9, BP));
    svg.appendChild(txt(260, 108, 'FSM / CFG', 8, MUTE));
    svg.appendChild(txt(260, 124, 'mask logits', 8, MUTE));
    // valid JSON on the right
    svg.appendChild(box(372, 70, 120, 90, BG, INK));
    svg.appendChild(txt(432, 60, 'typed JSON', 9, INK));
    svg.appendChild(txt(432, 95, '{ name, price,', 8, BP, 'middle'));
    svg.appendChild(txt(432, 110, '  in_stock }', 8, BP, 'middle'));
    // links
    svg.appendChild(svgEl('path', { d: 'M148 115 L210 115', fill: 'none', stroke: SOFT, 'stroke-width': 1.4 }));
    var g2 = svgEl('path', { d: 'M310 115 L372 115', fill: 'none', stroke: BP, 'stroke-width': 2, 'stroke-dasharray': '6 4' });
    g2.appendChild(anim('stroke-dashoffset', '20;0', '0.8s'));
    svg.appendChild(g2);
    // tokens fall through the gate; invalid ones (warn) are masked out, valid pass
    var spec = [{ ok: true, b: '0s' }, { ok: false, b: '0.7s' }, { ok: true, b: '1.4s' }, { ok: true, b: '2.1s' }];
    spec.forEach(function (s) {
      var c = svgEl('circle', { cx: 0, cy: 0, r: 5, fill: s.ok ? BP : WARN });
      if (s.ok) {
        c.appendChild(motion('M150 115 L260 115 L432 115', '3.2s', s.b));
      } else {
        c.appendChild(motion('M150 115 L255 115 L255 175', '3.2s', s.b));
      }
      svg.appendChild(c);
    });
    var drop = txt(255, 195, 'invalid token masked at the gate', 8, WARN);
    svg.appendChild(drop);
    svg.appendChild(txt(260, 218, 'constrained decoding forbids any token that breaks the schema', 8.5, MUTE));
    shell(host, 'STRUCTURED OUTPUT FUNNEL', 'free text is forced through a grammar into typed JSON', svg,
      'An LLM returns a string; your application needs typed JSON. Adding "respond in JSON" to the prompt works about 90% of the time and crashes on the rest. Constrained decoding closes the gap at the token level: a finite-state machine or grammar masks the logits so any token that would break the schema is forbidden before it is sampled. The output is valid JSON by construction, not by post-processing, with a Pydantic layer validating types and retrying on the rare miss.');
  }

  // ── mx-tool-call-loop: model emits call JSON → execute → result back → answer
  // phases/11-llm-engineering/09-function-calling
  function toolCallLoop(host) {
    var W = 520, H = 235;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(60, 90, 110, 56, BG, BP));
    svg.appendChild(txt(115, 112, 'model', 9.5, BP));
    svg.appendChild(txt(115, 128, 'the brain', 8, MUTE));
    svg.appendChild(box(350, 90, 110, 56, BG, INK));
    svg.appendChild(txt(405, 112, 'your code', 9.5, INK));
    svg.appendChild(txt(405, 128, 'the hands', 8, MUTE));
    // top arc: model emits call JSON to code
    var out = svgEl('path', { d: 'M170 100 C 240 50, 290 50, 350 100', fill: 'none', stroke: BP, 'stroke-width': 1.8, 'stroke-dasharray': '6 4' });
    out.appendChild(anim('stroke-dashoffset', '20;0', '0.8s'));
    svg.appendChild(out);
    svg.appendChild(txt(260, 56, 'call: get_weather("Tokyo")', 8.5, BP));
    // bottom arc: code returns result to model
    var back = svgEl('path', { d: 'M350 136 C 290 186, 240 186, 170 136', fill: 'none', stroke: INK, 'stroke-width': 1.8, 'stroke-dasharray': '6 4' });
    back.appendChild(anim('stroke-dashoffset', '0;20', '0.8s'));
    svg.appendChild(back);
    svg.appendChild(txt(260, 182, 'result: 15°C', 8.5, INK));
    // a token rides the out arc, then a result token rides back, looping
    var callTok = svgEl('rect', { x: -10, y: -7, width: 20, height: 14, rx: 2, fill: BP });
    callTok.appendChild(motion('M170 100 C 240 50, 290 50, 350 100', '2.8s', '0s'));
    callTok.appendChild(anim('opacity', '1;1;0;0', '2.8s'));
    svg.appendChild(callTok);
    var resTok = svgEl('rect', { x: -10, y: -7, width: 20, height: 14, rx: 2, fill: INK });
    resTok.appendChild(motion('M350 136 C 290 186, 240 186, 170 136', '2.8s', '1.4s'));
    resTok.appendChild(anim('opacity', '0;1;1;0', '2.8s', { begin: '1.4s' }));
    svg.appendChild(resTok);
    svg.appendChild(txt(260, 215, 'loop until the model stops requesting calls, then it answers', 8.5, MUTE));
    shell(host, 'FUNCTION-CALLING LOOP', 'model emits call JSON; your code runs it and feeds the result back', svg,
      'An LLM only generates text, so it cannot check the weather or query a database. Function calling is the protocol that bridges the gap: the model outputs structured JSON naming which function to call with what arguments, your code executes it, and the result is fed back into the conversation. The model is the brain, your tools are the hands, the loop is the nervous system. It repeats until the model stops requesting calls and produces a final answer, with guards against parallel calls and infinite tool loops.');
  }

  LF.register({
    'mx-propose-then-commit': proposeThenCommit,
    'mx-priority-tiers': priorityTiers,
    'mx-research-loop': researchLoop,
    'mx-speculative-tree': speculativeTree,
    'mx-gateway-fallback': gatewayFallback,
    'mx-sequential-test': sequentialTest,
    'mx-schema-funnel': schemaFunnel,
    'mx-tool-call-loop': toolCallLoop
  });
})();
