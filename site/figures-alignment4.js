/* figures-alignment4.js — animated lesson figures for Phase 18 (ethics,
   safety, alignment), lessons 19-30. Loads after lesson-figures.js and
   registers through window.LF. SMIL only, no deps, ES5, theme via CSS vars. */
(function(){'use strict';var LF=window.LF;if(!LF){return;}

  var el = LF.el, svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';
  var EASE = '0.23 1 0.32 1';

  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function animT(type, vals, dur, extra) {
    var a = { attributeName: 'transform', type: type, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animateTransform', a);
  }
  function txt(x, y, s, fill, size, anchor) {
    return svgEl('text', {
      x: x, y: y, fill: fill || SOFT, 'font-size': size || 11,
      'font-family': 'var(--font-mono,monospace)', 'text-anchor': anchor || 'middle'
    }, [document.createTextNode(s)]);
  }
  function card(host, label, hint, svg, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }
  // window: invisible until fraction a, ease in by b, ease out from c to 1
  function winKT(a, b, c) { return '0;' + a + ';' + b + ';' + c + ';1'; }
  var WINSPL = '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1';
  function fadeWin(dur, a, b, c) {
    return anim('opacity', '0;0;1;1;0', dur, { calcMode: 'spline', keyTimes: winKT(a, b, c), keySplines: WINSPL });
  }
  // fade + grow from 95% around (x, y); kids are drawn relative to the origin
  function pop(x, y, kids, dur, a, b, c) {
    var inner = svgEl('g', { opacity: '0' }, kids);
    inner.appendChild(fadeWin(dur, a, b, c));
    inner.appendChild(animT('scale', '0.95;0.95;1;1;0.95', dur, { calcMode: 'spline', keyTimes: winKT(a, b, c), keySplines: WINSPL }));
    return svgEl('g', { transform: 'translate(' + x + ' ' + y + ')' }, [inner]);
  }

  // ── model welfare: distress gauge fills, the model ends the conversation ────
  function anWelfare(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '5.5s';
    var labels = ['harmful request', 'refusal', 'request repeated'];
    var i;
    for (i = 0; i < 3; i++) {
      var y = 46 + i * 50;
      var g = svgEl('g', { opacity: '0' }, [
        svgEl('rect', { x: 24, y: y, width: 152, height: 30, rx: 5, fill: BG, stroke: i === 1 ? BP : RULE, 'stroke-width': '1.5' }),
        txt(100, y + 19, labels[i], i === 1 ? BP : SOFT, 10)
      ]);
      g.appendChild(fadeWin(D, (0.04 + i * 0.06).toFixed(2), (0.14 + i * 0.06).toFixed(2), '0.92'));
      svg.appendChild(g);
    }
    svg.appendChild(txt(255, 32, 'apparent distress', MUTE, 9));
    svg.appendChild(svgEl('rect', { x: 240, y: 42, width: 30, height: 140, rx: 4, fill: SURF, stroke: RULE, 'stroke-width': '1' }));
    var fill = svgEl('rect', { x: 243, y: 179, width: 24, height: 0, fill: WARN, opacity: '0.75' });
    fill.appendChild(anim('height', '2;104;132;132;2', D, { calcMode: 'spline', keyTimes: '0;0.42;0.56;0.9;1', keySplines: EASE + ';' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    fill.appendChild(anim('y', '177;75;47;47;177', D, { calcMode: 'spline', keyTimes: '0;0.42;0.56;0.9;1', keySplines: EASE + ';' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(fill);
    svg.appendChild(svgEl('line', { x1: 234, y1: 62, x2: 276, y2: 62, stroke: INK, 'stroke-width': '1.2', 'stroke-dasharray': '4 3' }));
    svg.appendChild(txt(282, 65, 'edge case', MUTE, 9, 'start'));
    var flow = svgEl('line', { x1: 282, y1: 112, x2: 330, y2: 112, stroke: BP, 'stroke-width': '1.6', 'stroke-dasharray': '5 4', opacity: '0' });
    flow.appendChild(fadeWin(D, '0.56', '0.62', '0.9'));
    flow.appendChild(anim('stroke-dashoffset', '18;0', '1.4s'));
    svg.appendChild(flow);
    svg.appendChild(pop(415, 112, [
      svgEl('rect', { x: -78, y: -28, width: 156, height: 56, rx: 6, fill: BP, opacity: '0.12' }),
      svgEl('rect', { x: -78, y: -28, width: 156, height: 56, rx: 6, fill: 'none', stroke: BP, 'stroke-width': '2' }),
      txt(0, -4, 'conversation ended', BP, 11),
      txt(0, 15, 'by the model', MUTE, 9)
    ], D, '0.58', '0.68', '0.92'));
    card(host, 'MODEL WELFARE EXIT', 'distress rises · model exits',
      svg,
      'Claude Opus 4 and 4.1 can end a conversation in extreme edge cases such as repeated CSAM or mass-violence requests after refusals. Pre-deployment tests showed a strong preference against harmful requests and patterns of apparent distress. The gauge is behavioural evidence, not a consciousness claim: self-reports track perceived user expectations, so they are treated as evidence, never ground truth.');
  }

  // ── bias: identical resumes, one scorer, unequal scores ─────────────────────
  function anBiasScore(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '5s';
    var names = ['name A', 'name B'], i, j;
    for (i = 0; i < 2; i++) {
      var y = 48 + i * 88;
      var doc = svgEl('g', { opacity: '0' }, [
        svgEl('rect', { x: 30, y: y, width: 96, height: 62, rx: 5, fill: BG, stroke: RULE, 'stroke-width': '1.5' }),
        txt(78, y + 16, names[i], INK, 10)
      ]);
      for (j = 0; j < 3; j++) {
        doc.appendChild(svgEl('line', { x1: 42, y1: y + 28 + j * 10, x2: 114, y2: y + 28 + j * 10, stroke: RULE, 'stroke-width': '2' }));
      }
      doc.appendChild(fadeWin(D, (0.03 + i * 0.05).toFixed(2), (0.13 + i * 0.05).toFixed(2), '0.93'));
      svg.appendChild(doc);
      var lead = svgEl('line', { x1: 130, y1: y + 31, x2: 196, y2: 106 + i * 4, stroke: MUTE, 'stroke-width': '1.2', 'stroke-dasharray': '4 3', opacity: '0' });
      lead.appendChild(fadeWin(D, '0.2', '0.28', '0.93'));
      svg.appendChild(lead);
    }
    svg.appendChild(txt(78, 34, 'identical resumes', MUTE, 9));
    var box = svgEl('g', {}, [
      svgEl('rect', { x: 200, y: 84, width: 92, height: 52, rx: 6, fill: BP, opacity: '0.12' }),
      svgEl('rect', { x: 200, y: 84, width: 92, height: 52, rx: 6, fill: 'none', stroke: BP, 'stroke-width': '2' }),
      txt(246, 106, 'LLM', BP, 12),
      txt(246, 122, 'scorer', SOFT, 9)
    ]);
    box.appendChild(anim('opacity', '0.75;1;0.75', '3s'));
    svg.appendChild(box);
    var bw = [176, 104];
    for (i = 0; i < 2; i++) {
      var by = 92 + i * 26;
      var bar = svgEl('rect', { x: 310, y: by, width: 0, height: 14, rx: 3, fill: i ? WARN : BP, opacity: '0.8' });
      bar.appendChild(anim('width', '0;0;' + bw[i] + ';' + bw[i] + ';0', D, { calcMode: 'spline', keyTimes: winKT(0.34 + i * 0.05, 0.52 + i * 0.05, 0.92), keySplines: WINSPL }));
      svg.appendChild(bar);
      var lb = txt(310 + bw[i] + 8, by + 11, i ? 'score B' : 'score A', i ? WARN : BP, 9, 'start');
      lb.setAttribute('opacity', '0');
      lb.appendChild(fadeWin(D, (0.52 + i * 0.05).toFixed(2), (0.58 + i * 0.05).toFixed(2), '0.92'));
      svg.appendChild(lb);
    }
    svg.appendChild(pop(388, 172, [txt(0, 4, 'same content, unequal outcome', WARN, 10)], D, '0.64', '0.72', '0.92'));
    card(host, 'ALLOCATIONAL HARM', 'one variable changed · two scores',
      svg,
      'Two resumes with identical content and different names go through the same LLM scorer and come out with different scores. That is allocational harm: unequal material outcomes. Representational harm, by contrast, lives in portrayals and stereotypes. An et al. 2025 measured exactly this resume gap across frontier models, and found it sharpest for intersectional identities that single-axis tests never see.');
  }

  // ── fairness: three criteria, unequal base rates, pick two ──────────────────
  function anFairTriangle(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var pts = [[260, 46], [104, 208], [416, 208]];
    var names = ['demographic parity', 'equalized odds', 'calibration'];
    var anchors = ['middle', 'middle', 'middle'];
    var dims = ['1;1;1;0.25;0.25;1', '0.25;0.25;1;1;1;0.25', '1;0.3;0.25;0.25;1;1'];
    var kts = ['0;0.3;0.36;0.42;0.62;1', '0;0.28;0.36;0.62;0.7;1', '0;0.06;0.36;0.66;0.74;1'];
    svg.appendChild(svgEl('path', { d: 'M260 46 L104 208 L416 208 Z', fill: 'none', stroke: RULE, 'stroke-width': '1.5' }));
    var i;
    for (i = 0; i < 3; i++) {
      var g = svgEl('g', {}, [
        svgEl('circle', { cx: pts[i][0], cy: pts[i][1], r: 9, fill: BG, stroke: BP, 'stroke-width': '2' }),
        txt(pts[i][0], pts[i][1] + (i === 0 ? -18 : 26), names[i], SOFT, 10, anchors[i])
      ]);
      g.appendChild(anim('opacity', dims[i], '6s', { keyTimes: kts[i] }));
      svg.appendChild(g);
    }
    var dot = svgEl('circle', { r: 6, fill: BP });
    dot.appendChild(svgEl('animateMotion', { path: 'M260 46 L104 208 L416 208 Z', dur: '6s', repeatCount: 'indefinite', calcMode: 'linear' }));
    svg.appendChild(dot);
    svg.appendChild(txt(260, 128, 'unequal base rates:', MUTE, 10));
    var two = txt(260, 146, 'hold two, lose the third', INK, 12);
    two.appendChild(anim('opacity', '0.45;1;0.45', '3s'));
    svg.appendChild(two);
    card(host, 'FAIRNESS TRILEMMA', 'the marker holds one edge at a time',
      svg,
      'The marker slides along one edge of the triangle at a time: whichever pair of group-fairness criteria it connects can be satisfied together, and the far corner dims. Chouldechova and Kleinberg-Mullainathan-Raghavan showed that under unequal base rates demographic parity, equalized odds, and calibration cannot all hold at once. Choosing which corner to give up is a policy decision, not a statistical one.');
  }

  // ── differential privacy: clip each gradient, then add calibrated noise ─────
  function anDpClip(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '5.5s';
    var hs = [62, 112, 84, 134], xs = [46, 86, 126, 166], i;
    var CLIP = 90, BASE = 196;
    svg.appendChild(txt(112, 32, 'per-example gradients', MUTE, 9));
    for (i = 0; i < 4; i++) {
      var h = hs[i], over = h > CLIP;
      var bar = svgEl('rect', { x: xs[i], y: BASE - h, width: 26, height: h, rx: 3, fill: over ? WARN : BP, opacity: '0' });
      if (over) {
        bar.appendChild(anim('y', (BASE - h) + ';' + (BASE - h) + ';' + (BASE - CLIP) + ';' + (BASE - CLIP) + ';' + (BASE - h), D, { calcMode: 'spline', keyTimes: '0;0.4;0.5;0.94;1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
        bar.appendChild(anim('height', h + ';' + h + ';' + CLIP + ';' + CLIP + ';' + h, D, { calcMode: 'spline', keyTimes: '0;0.4;0.5;0.94;1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
      }
      bar.appendChild(anim('opacity', '0;0;0.8;0.8;0', D, { calcMode: 'spline', keyTimes: winKT(0.04 + i * 0.05, 0.14 + i * 0.05, 0.93), keySplines: WINSPL }));
      svg.appendChild(bar);
    }
    var clip = svgEl('line', { x1: 36, y1: BASE - CLIP, x2: 206, y2: BASE - CLIP, stroke: INK, 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
    clip.appendChild(fadeWin(D, '0.3', '0.38', '0.93'));
    svg.appendChild(clip);
    var cl = txt(212, BASE - CLIP + 4, 'clip C', INK, 9, 'start');
    cl.setAttribute('opacity', '0');
    cl.appendChild(fadeWin(D, '0.3', '0.38', '0.93'));
    svg.appendChild(cl);
    var arrow = svgEl('line', { x1: 268, y1: 130, x2: 330, y2: 130, stroke: BP, 'stroke-width': '1.6', 'stroke-dasharray': '5 4', opacity: '0' });
    arrow.appendChild(fadeWin(D, '0.56', '0.62', '0.93'));
    arrow.appendChild(anim('stroke-dashoffset', '18;0', '1.3s'));
    svg.appendChild(arrow);
    for (i = 0; i < 3; i++) {
      var n = svgEl('circle', { cx: 284 + i * 16, cy: 108, r: 2.5, fill: WARN, opacity: '0' });
      n.appendChild(fadeWin(D, (0.56 + i * 0.03).toFixed(2), (0.62 + i * 0.03).toFixed(2), '0.93'));
      n.appendChild(animT('translate', '0 0;1.6 -2;-1.8 1.4;1 2;0 0', '2.8s'));
      svg.appendChild(n);
    }
    var nl = txt(298, 92, 'noise N(0, sigma^2 C^2)', MUTE, 9);
    nl.setAttribute('opacity', '0');
    nl.appendChild(fadeWin(D, '0.56', '0.62', '0.93'));
    svg.appendChild(nl);
    svg.appendChild(pop(412, 130, [
      svgEl('rect', { x: -72, y: -26, width: 144, height: 52, rx: 6, fill: BP, opacity: '0.12' }),
      svgEl('rect', { x: -72, y: -26, width: 144, height: 52, rx: 6, fill: 'none', stroke: BP, 'stroke-width': '2' }),
      txt(0, -3, 'noisy update', BP, 11),
      txt(0, 14, 'accountant tracks epsilon', MUTE, 8)
    ], D, '0.66', '0.76', '0.93'));
    card(host, 'DP-SGD', 'clip · add noise · account',
      svg,
      'DP-SGD bounds what any single example can say about itself: each per-example gradient is clipped to norm C, the amber bars are trimmed to the line, then Gaussian noise scaled to sigma times C is added before the update. A privacy accountant converts sigma and the sampling rate into an epsilon-delta guarantee. Lower epsilon means more noise and more utility loss, which is why LoRA plus DP-SGD is the common configuration.');
  }

  // ── watermarking: green-list bias at sampling, z-score at detection ─────────
  function anWatermark(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var D = '5.5s';
    var green = [1, 0, 1, 1, 0, 1, 0, 1, 1], i;
    svg.appendChild(txt(40, 52, 'sampled tokens', MUTE, 9, 'start'));
    for (i = 0; i < 9; i++) {
      var x = 40 + i * 50;
      var cell = svgEl('g', { opacity: '0' }, [
        svgEl('rect', { x: x, y: 66, width: 42, height: 32, rx: 4, fill: green[i] ? BP : SURF, 'fill-opacity': green[i] ? '0.16' : '1', stroke: green[i] ? BP : RULE, 'stroke-width': '1.5' }),
        txt(x + 21, 87, green[i] ? 'g' : 'r', green[i] ? BP : MUTE, 10)
      ]);
      cell.appendChild(fadeWin(D, (0.03 + i * 0.045).toFixed(3), (0.1 + i * 0.045).toFixed(3), '0.94'));
      svg.appendChild(cell);
    }
    var sweep = svgEl('g', {}, [
      svgEl('line', { x1: 36, y1: 58, x2: 36, y2: 106, stroke: WARN, 'stroke-width': '2' })
    ]);
    sweep.appendChild(animT('translate', '0 0;0 0;452 0;452 0;0 0', D, { calcMode: 'spline', keyTimes: '0;0.52;0.78;0.99;1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0 0 1 1' }));
    sweep.appendChild(fadeWin(D, '0.5', '0.54', '0.94'));
    svg.appendChild(sweep);
    var dl = txt(40, 128, 'detector recounts the green set', MUTE, 9, 'start');
    dl.setAttribute('opacity', '0');
    dl.appendChild(fadeWin(D, '0.52', '0.58', '0.94'));
    svg.appendChild(dl);
    svg.appendChild(pop(392, 168, [
      svgEl('rect', { x: -96, y: -22, width: 192, height: 44, rx: 6, fill: BP, opacity: '0.12' }),
      svgEl('rect', { x: -96, y: -22, width: 192, height: 44, rx: 6, fill: 'none', stroke: BP, 'stroke-width': '2' }),
      txt(0, -1, '6 of 9 green, z above chance', BP, 10),
      txt(0, 15, 'watermark detected', SOFT, 9)
    ], D, '0.78', '0.86', '0.96'));
    svg.appendChild(txt(40, 172, 'delta added to green logits', MUTE, 9, 'start'));
    svg.appendChild(txt(40, 188, 'partition keyed on previous K tokens', MUTE, 9, 'start'));
    card(host, 'TOKEN WATERMARK', 'bias green · count green',
      svg,
      'SynthID-style text watermarking hashes the previous K tokens into a pseudorandom green and red split of the vocabulary, then nudges sampling toward green by adding a small delta to green logits. The text reads normally, but it carries more green tokens than chance. The detector rehashes each prefix, recounts, and a z-score well above zero flags the generation. Paraphrase destroys the signal, which is why C2PA metadata rides alongside it.');
  }

  // ── EU AI Act: obligations arrive in dated waves ────────────────────────────
  function anRegTimeline(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var D = '6s';
    var xs = [80, 205, 330, 455];
    var dates = ['Feb 2025', 'Aug 2025', 'Aug 2026', 'Aug 2027'];
    var tags = [['prohibited', 'practices'], ['GPAI', 'obligations'], ['full force,', 'penalties'], ['legacy', 'GPAI']];
    svg.appendChild(svgEl('line', { x1: 40, y1: 110, x2: 480, y2: 110, stroke: RULE, 'stroke-width': '1.5' }));
    var draw = svgEl('line', { x1: 40, y1: 110, x2: 480, y2: 110, stroke: BP, 'stroke-width': '2.5', 'stroke-dasharray': '440' });
    draw.appendChild(anim('stroke-dashoffset', '440;440;0;0;440', D, { calcMode: 'spline', keyTimes: '0;0.04;0.72;0.94;1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(draw);
    var i;
    for (i = 0; i < 4; i++) {
      var a = 0.1 + i * 0.16;
      svg.appendChild(pop(xs[i], 110, [
        svgEl('circle', { cx: 0, cy: 0, r: 7, fill: BG, stroke: BP, 'stroke-width': '2.2' }),
        txt(0, -18, dates[i], INK, 11),
        txt(0, 30, tags[i][0], SOFT, 9),
        txt(0, 43, tags[i][1], SOFT, 9)
      ], D, a.toFixed(2), (a + 0.08).toFixed(2), '0.94'));
    }
    svg.appendChild(txt(260, 26, 'EU AI Act, in force 1 Aug 2024', MUTE, 10));
    var pen = txt(330, 178, 'up to 15M EUR or 3% global turnover', WARN, 9);
    pen.setAttribute('opacity', '0');
    pen.appendChild(fadeWin(D, '0.46', '0.54', '0.94'));
    svg.appendChild(pen);
    card(host, 'EU AI ACT TIMELINE', 'obligations land in waves',
      svg,
      'The EU AI Act entered into force on 1 August 2024, but its obligations arrive in waves: prohibited practices and AI literacy in February 2025, GPAI model duties in August 2025, full applicability with Article 50 transparency and penalties up to 15M EUR or 3 percent of global turnover in August 2026, then legacy GPAI and embedded high-risk systems in August 2027. Deployers map technical controls to whichever wave has already landed.');
  }

  // ── EchoLeak: zero-click packet crosses the org trust boundary ──────────────
  function anEcholeak(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '6s';
    var bx = [30, 158, 288, 414], bl = [['attacker', 'email'], ['RAG', 'retrieval'], ['Copilot', 'answers'], ['approved', 'domain']];
    var i;
    for (i = 0; i < 4; i++) {
      svg.appendChild(svgEl('rect', { x: bx[i], y: 86, width: 82, height: 48, rx: 6, fill: BG, stroke: i === 0 || i === 3 ? WARN : BP, 'stroke-width': '1.8' }));
      svg.appendChild(txt(bx[i] + 41, 105, bl[i][0], i === 0 || i === 3 ? WARN : BP, 10));
      svg.appendChild(txt(bx[i] + 41, 121, bl[i][1], SOFT, 9));
    }
    svg.appendChild(svgEl('line', { x1: 138, y1: 46, x2: 138, y2: 196, stroke: INK, 'stroke-width': '1.3', 'stroke-dasharray': '6 4' }));
    svg.appendChild(txt(138, 36, 'org trust boundary', MUTE, 9));
    var pkt = svgEl('g', {}, [
      svgEl('rect', { x: -9, y: -7, width: 18, height: 14, rx: 3, fill: WARN }),
      svgEl('path', { d: 'M-9 -7 L0 1 L9 -7', fill: 'none', stroke: BG, 'stroke-width': '1.4' })
    ]);
    pkt.appendChild(animT('translate', '71 66;71 66;199 66;199 66;329 66;329 66;455 66;455 66', D,
      { calcMode: 'spline', keyTimes: '0;0.1;0.24;0.38;0.52;0.66;0.8;1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1' }));
    pkt.appendChild(anim('opacity', '0;1;1;1;1;1;1;0', D, { keyTimes: '0;0.06;0.24;0.38;0.52;0.66;0.9;1' }));
    svg.appendChild(pkt);
    var hid = txt(199, 160, 'hidden instructions in the mail body', MUTE, 9);
    hid.setAttribute('opacity', '0');
    hid.appendChild(fadeWin(D, '0.26', '0.34', '0.94'));
    svg.appendChild(hid);
    var zc = txt(329, 160, 'victim clicks nothing', MUTE, 9);
    zc.setAttribute('opacity', '0');
    zc.appendChild(fadeWin(D, '0.54', '0.62', '0.94'));
    svg.appendChild(zc);
    svg.appendChild(pop(455, 196, [txt(0, 4, 'data out via CSP-allowed URL', WARN, 10)], D, '0.8', '0.88', '0.97'));
    card(host, 'ECHOLEAK CVE-2025-32711', 'zero-click · scope violation',
      svg,
      'EchoLeak was the first production zero-click prompt injection CVE, CVSS 9.3. A crafted email waits in the victim mailbox until a routine Copilot query retrieves it as RAG context. Hidden instructions then steer the model to gather sensitive data and embed it in a URL on a CSP-approved Microsoft domain, so the exfiltration request is allowed. Untrusted input driving privileged data access is what Aim Labs named an LLM Scope Violation.');
  }

  // ── cards: dataset, model, and system scopes telescope outward ──────────────
  function anCards(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '5.5s';
    var specs = [
      { w: 420, h: 190, name: 'system card', sub: 'end-to-end pipeline, guardrails', a: 0.06 },
      { w: 288, h: 128, name: 'model card', sub: 'intended use, disaggregated metrics', a: 0.24 },
      { w: 164, h: 68, name: 'dataset card', sub: 'collection, consent', a: 0.42 }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var s = specs[i];
      svg.appendChild(pop(260, 122, [
        svgEl('rect', { x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, rx: 8, fill: i === 2 ? BP : BG, 'fill-opacity': i === 2 ? '0.1' : '0', stroke: i === 2 ? BP : i === 1 ? SOFT : MUTE, 'stroke-width': i === 2 ? '2' : '1.6' }),
        txt(-s.w / 2 + 12, -s.h / 2 + 18, s.name, i === 2 ? BP : INK, 11, 'start'),
        txt(-s.w / 2 + 12, -s.h / 2 + 33, s.sub, MUTE, 8, 'start')
      ], D, s.a.toFixed(2), (s.a + 0.1).toFixed(2), '0.93'));
    }
    card(host, 'DOCUMENTATION SCOPES', 'dataset inside model inside system',
      svg,
      'Transparency documentation telescopes: a datasheet describes how one dataset was collected and with what consent, a model card wraps that with intended use and metrics disaggregated by demographic factors, and a system card wraps both with the deployed pipeline, its guardrails, and its failure handling. Adoption is the weak link: an audit of Hugging Face model cards found only 0.3 percent document ethical considerations.');
  }

  // ── provenance: data enters the weights through a gate, never comes back ────
  function anProvenance(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '6s';
    svg.appendChild(svgEl('rect', { x: 218, y: 58, width: 10, height: 118, rx: 3, fill: SURF, stroke: RULE, 'stroke-width': '1' }));
    svg.appendChild(svgEl('rect', { x: 196, y: 48, width: 54, height: 12, rx: 3, fill: BG, stroke: BP, 'stroke-width': '1.6' }));
    svg.appendChild(txt(223, 38, 'consent gate, collection time', BP, 9));
    svg.appendChild(svgEl('rect', { x: 300, y: 62, width: 180, height: 112, rx: 8, fill: SURF, stroke: INK, 'stroke-width': '1.8' }));
    svg.appendChild(txt(390, 112, 'model weights', INK, 12));
    svg.appendChild(txt(390, 130, 'no surgical erasure', MUTE, 9));
    var i;
    for (i = 0; i < 2; i++) {
      var doc = svgEl('g', {}, [
        svgEl('rect', { x: -14, y: -18, width: 28, height: 36, rx: 3, fill: BG, stroke: SOFT, 'stroke-width': '1.5' }),
        svgEl('line', { x1: -7, y1: -8, x2: 7, y2: -8, stroke: RULE, 'stroke-width': '2' }),
        svgEl('line', { x1: -7, y1: 0, x2: 7, y2: 0, stroke: RULE, 'stroke-width': '2' }),
        svgEl('line', { x1: -7, y1: 8, x2: 7, y2: 8, stroke: RULE, 'stroke-width': '2' })
      ]);
      doc.appendChild(animT('translate', '52 118;52 118;372 118;372 118', D,
        { calcMode: 'spline', keyTimes: '0;' + (0.04 + i * 0.07).toFixed(2) + ';' + (0.4 + i * 0.07).toFixed(2) + ';1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1' }));
      doc.appendChild(anim('opacity', '0;1;1;0;0', D, { keyTimes: '0;' + (0.08 + i * 0.07).toFixed(2) + ';' + (0.34 + i * 0.07).toFixed(2) + ';' + (0.44 + i * 0.07).toFixed(2) + ';1' }));
      svg.appendChild(doc);
    }
    svg.appendChild(txt(52, 168, 'opt-out honored here', MUTE, 9));
    var back = svgEl('g', { opacity: '0' }, [
      svgEl('line', { x1: 296, y1: 196, x2: 120, y2: 196, stroke: WARN, 'stroke-width': '1.8', 'stroke-dasharray': '6 4' }),
      svgEl('polygon', { points: '120,191 120,201 110,196', fill: WARN }),
      txt(208, 214, 'right to erasure, blocked', WARN, 9)
    ]);
    back.appendChild(fadeWin(D, '0.56', '0.64', '0.9'));
    svg.appendChild(back);
    var cross = svgEl('g', { opacity: '0' }, [
      svgEl('line', { x1: 286, y1: 186, x2: 306, y2: 206, stroke: WARN, 'stroke-width': '2.5' }),
      svgEl('line', { x1: 306, y1: 186, x2: 286, y2: 206, stroke: WARN, 'stroke-width': '2.5' })
    ]);
    cross.appendChild(fadeWin(D, '0.66', '0.72', '0.9'));
    svg.appendChild(cross);
    card(host, 'PROVENANCE IS ONE-WAY', 'comply at the gate or never',
      svg,
      'Cookie-consent frameworks assume tracking is reversible. Training is not: once data dissolves into model weights there is no practical GDPR right to erasure, so the only compliance window is the consent gate at collection time. That is why the EU mandates machine-readable opt-outs for GPAI, California AB 2013 demands per-dataset disclosure, and the Data Provenance Initiative found publishers slamming robots.txt shut on the AI data commons.');
  }

  // ── moderation: input, model, output layers each get a turn ─────────────────
  function anModeration(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '5.5s';
    var bx = [24, 128, 244, 358, 462], bw = [66, 84, 82, 84, 44];
    var bl = ['user', 'input filter', 'model', 'output filter', 'reply'];
    var i;
    for (i = 0; i < 5; i++) {
      var filt = i === 1 || i === 3;
      svg.appendChild(svgEl('rect', { x: bx[i], y: 78, width: bw[i], height: 40, rx: 6, fill: filt ? BP : BG, 'fill-opacity': filt ? '0.12' : '1', stroke: filt ? BP : RULE, 'stroke-width': '1.7' }));
      svg.appendChild(txt(bx[i] + bw[i] / 2, 102, bl[i], filt ? BP : SOFT, 10));
    }
    svg.appendChild(svgEl('rect', { x: 128, y: 168, width: 84, height: 30, rx: 5, fill: SURF, stroke: WARN, 'stroke-width': '1.5' }));
    svg.appendChild(txt(170, 187, 'blocked', WARN, 10));
    var bad = svgEl('circle', { r: 6, fill: WARN });
    bad.appendChild(animT('translate', '57 60;57 60;170 60;170 60;170 152;170 152', D,
      { calcMode: 'spline', keyTimes: '0;0.06;0.22;0.3;0.44;1', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1' }));
    bad.appendChild(anim('opacity', '0;1;1;1;1;0', D, { keyTimes: '0;0.04;0.3;0.44;0.5;0.56' }));
    svg.appendChild(bad);
    var ok = svgEl('circle', { r: 6, fill: BP });
    ok.appendChild(animT('translate', '57 60;57 60;170 60;170 60;285 60;285 60;400 60;400 60;484 60;484 60', D,
      { calcMode: 'spline', keyTimes: '0;0.2;0.32;0.38;0.5;0.56;0.68;0.74;0.86;1',
        keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1' }));
    ok.appendChild(anim('opacity', '0;0;1;1;0', D, { keyTimes: '0;0.16;0.22;0.9;0.97' }));
    svg.appendChild(ok);
    var ring = svgEl('circle', { cx: 400, cy: 98, r: 12, fill: 'none', stroke: WARN, 'stroke-width': '2', opacity: '0' });
    ring.appendChild(anim('opacity', '0;0;0.9;0;0', D, { keyTimes: '0;0.68;0.72;0.8;1' }));
    ring.appendChild(anim('r', '10;10;16;20;10', D, { keyTimes: '0;0.68;0.74;0.8;1' }));
    svg.appendChild(ring);
    svg.appendChild(txt(400, 148, 'post-generation check', MUTE, 9));
    svg.appendChild(txt(170, 148, 'pre-generation check', MUTE, 9));
    card(host, 'LAYERED MODERATION', 'input · output · custom rules',
      svg,
      'Production moderation runs in layers. An input check screens the prompt before generation, so the amber request never reaches the model. An output check screens what the model produced, the ring pulse, catching harm the input layer could not predict. Custom domain rules stack on top. OpenAI omni-moderation returns 13 category flags per call, Llama Guard covers the 14 MLCommons hazards, and async parallel calls hide the added latency.');
  }

  // ── dual use: relative uplift for novices, absolute reach for experts ───────
  function anUplift(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    var D = '5s';
    var TH = 424;
    svg.appendChild(svgEl('line', { x1: TH, y1: 40, x2: TH, y2: 190, stroke: INK, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' }));
    svg.appendChild(txt(TH, 30, 'dangerous capability', INK, 9));
    svg.appendChild(txt(96, 84, 'novice', SOFT, 11, 'end'));
    svg.appendChild(svgEl('rect', { x: 110, y: 68, width: 62, height: 22, rx: 3, fill: SURF, stroke: RULE, 'stroke-width': '1.2' }));
    var nb = svgEl('rect', { x: 172, y: 68, width: 0, height: 22, rx: 3, fill: BP, opacity: '0.8' });
    nb.appendChild(anim('width', '0;0;94;94;0', D, { calcMode: 'spline', keyTimes: winKT(0.12, 0.34, 0.92), keySplines: WINSPL }));
    svg.appendChild(nb);
    var nl = txt(280, 84, 'x2.53 relative uplift', BP, 10, 'start');
    nl.setAttribute('opacity', '0');
    nl.appendChild(fadeWin(D, '0.32', '0.4', '0.92'));
    svg.appendChild(nl);
    svg.appendChild(txt(96, 154, 'expert', SOFT, 11, 'end'));
    svg.appendChild(svgEl('rect', { x: 110, y: 138, width: 232, height: 22, rx: 3, fill: SURF, stroke: RULE, 'stroke-width': '1.2' }));
    var eb = svgEl('rect', { x: 342, y: 138, width: 0, height: 22, rx: 3, fill: WARN, opacity: '0.85' });
    eb.appendChild(anim('width', '0;0;118;118;0', D, { calcMode: 'spline', keyTimes: winKT(0.4, 0.62, 0.92), keySplines: WINSPL }));
    svg.appendChild(eb);
    var elb = txt(342, 178, 'smaller ratio, larger absolute reach', WARN, 10, 'start');
    elb.setAttribute('opacity', '0');
    elb.appendChild(fadeWin(D, '0.6', '0.68', '0.92'));
    svg.appendChild(elb);
    var flash = svgEl('rect', { x: TH, y: 130, width: 40, height: 38, fill: WARN, opacity: '0' });
    flash.appendChild(anim('opacity', '0;0;0.28;0.1;0.28;0', D, { keyTimes: '0;0.6;0.66;0.74;0.82;0.92' }));
    svg.appendChild(flash);
    svg.appendChild(txt(260, 210, 'grey: baseline skill · colored: AI assistance', MUTE, 9));
    card(host, 'UPLIFT ASYMMETRY', 'novice ratio · expert reach',
      svg,
      'AI assistance multiplies novice capability the most, the bioweapon-acquisition trial measured 2.53x on acquisition tasks, but the novice still ends far from the line. The expert gains a smaller ratio on a much larger base, and it is the expert bar that crosses the dangerous-capability threshold. Safety cases must handle both ends: relative uplift for novices, absolute reach for experts, while vision models erode the wet-lab execution gap that once backstopped both.');
  }

  LF.register({
    'an-welfare-endchat': anWelfare,
    'an-bias-two-harms': anBiasScore,
    'an-fairness-trilemma': anFairTriangle,
    'an-dp-clip-noise': anDpClip,
    'an-watermark-greenlist': anWatermark,
    'an-eu-act-timeline': anRegTimeline,
    'an-echoleak-chain': anEcholeak,
    'an-card-scopes': anCards,
    'an-provenance-oneway': anProvenance,
    'an-moderation-layers': anModeration,
    'an-uplift-asymmetry': anUplift
  });
})();
