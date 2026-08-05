/* figures-foundations3.js - animated lesson figures for Phase 1 (math
   foundations), Phase 2 (ML fundamentals), and Phase 9 (reinforcement
   learning). Loads after lesson-figures.js, registers through window.LF.
   No deps, ES5 only, theme via CSS vars. SMIL-only animation: no JS render
   loops. Authoring: a ```figure block naming a widget below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;
  var SPL = '0.23 1 0.32 1';
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';

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
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '11', fill: fill || INK });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function grp(x, y) {
    return svgEl('g', { transform: 'translate(' + x + ' ' + y + ')', opacity: '0' });
  }
  function pop(node, begin) {
    node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
    node.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
  }
  function enter(node, begin) {
    node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.6s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
  }
  function drawIn(node, len, dur, begin) {
    node.setAttribute('stroke-dasharray', len);
    node.setAttribute('stroke-dashoffset', len);
    node.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: len + ';0', dur: dur, begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
  }

  // -- f3-bootstrap-resample: data row resampled into a histogram of means ----
  function bootstrapResample(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(txt(60, 20, 'observed data (n = 10)', '9', MUTE, 'start'));
    var i, d;
    for (i = 0; i < 10; i++) {
      d = svgEl('circle', { cx: 70 + i * 42, cy: 42, r: '4.5', fill: SOFT, opacity: '0' });
      enter(d, (0.1 + i * 0.06) + 's');
      svg.appendChild(d);
    }
    var ring = svgEl('circle', { r: '8.5', fill: 'none', stroke: BP, 'stroke-width': '2', opacity: '0' });
    ring.appendChild(svgEl('animateMotion', { path: 'M70 42 L448 42 L196 42 L364 42 L70 42', dur: '4s', begin: '0.9s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0.25;0.5;0.75;1', keyTimes: '0;0.25;0.5;0.75;1' }));
    ring.appendChild(anim('opacity', '0;0.9;0.9;0', '4s', { begin: '0.9s', keyTimes: '0;0.06;0.94;1' }));
    svg.appendChild(ring);
    svg.appendChild(txt(460, 21, 'resample with replacement', '9', BP, 'end'));
    var heights = [12, 30, 54, 70, 54, 30, 12], base = 196;
    for (i = 0; i < 7; i++) {
      var h = heights[i], x = 152 + i * 32;
      var bar = svgEl('rect', { x: x, y: base - h, width: '24', height: h, fill: BP, opacity: '0' });
      bar.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.85', dur: '0.5s', begin: (1.2 + i * 0.12) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      bar.appendChild(svgEl('animate', { attributeName: 'height', values: (h * 0.95).toFixed(1) + ';' + h, dur: '0.5s', begin: (1.2 + i * 0.12) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      bar.appendChild(svgEl('animate', { attributeName: 'y', values: (base - h * 0.95).toFixed(1) + ';' + (base - h), dur: '0.5s', begin: (1.2 + i * 0.12) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      svg.appendChild(bar);
    }
    svg.appendChild(txt(260, 216, 'distribution of bootstrap means', '9', MUTE));
    var ci = svgEl('path', { d: 'M184 92 L184 84 L336 84 L336 92', fill: 'none', stroke: WARN, 'stroke-width': '1.8' });
    drawIn(ci, 170, 0.8, '2.6s');
    svg.appendChild(ci);
    var ciLabel = svgEl('g', { opacity: '0' }, [txt(260, 74, '95% confidence interval', '9', WARN)]);
    enter(ciLabel, '3s');
    svg.appendChild(ciLabel);
    shell(host, 'BOOTSTRAP RESAMPLING', 'resample, recompute, repeat',
      svg,
      'The bootstrap treats your sample as a stand-in for the population. Draw n points with replacement, compute the statistic, and repeat thousands of times: the resulting distribution of bootstrap means shows how much the statistic wobbles from sampling noise alone. The middle 95 percent of it is a confidence interval that needs no normality assumption.');
  }

  // -- f3-learning-boundary: centroids emerge from data, boundary follows -----
  function learningBoundary(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var A = [[118, 66], [156, 92], [130, 118], [176, 70]];
    var B = [[318, 150], [356, 178], [382, 140], [336, 118]];
    var i, c;
    for (i = 0; i < 4; i++) {
      c = svgEl('circle', { cx: A[i][0], cy: A[i][1], r: '5', fill: MUTE, opacity: '0' });
      enter(c, (0.1 + i * 0.08) + 's');
      c.appendChild(svgEl('animate', { attributeName: 'fill', values: MUTE + ';' + BP, dur: '0.01s', begin: (2.1 + i * 0.08) + 's', fill: 'freeze', calcMode: 'discrete' }));
      svg.appendChild(c);
      c = svgEl('circle', { cx: B[i][0], cy: B[i][1], r: '5', fill: MUTE, opacity: '0' });
      enter(c, (0.14 + i * 0.08) + 's');
      c.appendChild(svgEl('animate', { attributeName: 'fill', values: MUTE + ';' + WARN, dur: '0.01s', begin: (2.14 + i * 0.08) + 's', fill: 'freeze', calcMode: 'discrete' }));
      svg.appendChild(c);
    }
    var cenA = grp(145, 86);
    cenA.appendChild(svgEl('circle', { r: '9', fill: 'none', stroke: BP, 'stroke-width': '2' }));
    cenA.appendChild(svgEl('circle', { r: '2.5', fill: BP }));
    pop(cenA, '0.9s');
    svg.appendChild(cenA);
    var cenB = grp(348, 146);
    cenB.appendChild(svgEl('circle', { r: '9', fill: 'none', stroke: WARN, 'stroke-width': '2' }));
    cenB.appendChild(svgEl('circle', { r: '2.5', fill: WARN }));
    pop(cenB, '1.05s');
    svg.appendChild(cenB);
    var bound = svgEl('line', { x1: 212, y1: 216, x2: 282, y2: 20, stroke: INK, 'stroke-width': '1.6' });
    drawIn(bound, 210, 0.9, '1.5s');
    svg.appendChild(bound);
    var lbl = svgEl('g', { opacity: '0' }, [
      txt(120, 30, 'class A centroid', '9', BP),
      txt(390, 216, 'class B centroid', '9', WARN),
      txt(300, 224, 'learned boundary: closest centroid wins', '9', MUTE, 'start')
    ]);
    enter(lbl, '2.3s');
    svg.appendChild(lbl);
    shell(host, 'LEARNING FROM DATA', 'no rules written by hand',
      svg,
      'Nobody wrote an if-statement here. The classifier summarizes each labelled cluster by its centroid, and the decision boundary falls out of the geometry: the perpendicular bisector between the two centroids. Feed it different data and a different boundary emerges. That inversion, rules derived from examples rather than typed by hand, is what makes it machine learning.');
  }

  // -- f3-ensemble-average: jittery weak learners average into a smooth one ---
  function ensembleAverage(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var weak = [
      'M40 158 Q 100 148 150 112 T 260 74 T 370 88 T 480 124',
      'M40 146 Q 100 128 150 120 T 260 66 T 370 96 T 480 108',
      'M40 162 Q 100 136 150 104 T 260 84 T 370 74 T 480 128',
      'M40 140 Q 100 152 150 126 T 260 60 T 370 100 T 480 112',
      'M40 154 Q 100 122 150 110 T 260 92 T 370 80 T 480 132'
    ];
    var i, p;
    for (i = 0; i < 5; i++) {
      p = svgEl('path', { d: weak[i], fill: 'none', stroke: MUTE, 'stroke-width': '1.2', opacity: '0' });
      p.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.4', dur: '0.5s', begin: (0.15 + i * 0.22) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      svg.appendChild(p);
    }
    var avg = svgEl('path', { d: 'M40 152 Q 100 138 150 114 T 260 75 T 370 88 T 480 121', fill: 'none', stroke: BP, 'stroke-width': '2.6' });
    drawIn(avg, 480, 1.4, '1.6s');
    svg.appendChild(avg);
    var lbl = svgEl('g', { opacity: '0' }, [
      txt(60, 34, '5 weak learners, each wrong differently', '9', MUTE, 'start'),
      txt(60, 50, 'their average', '9', BP, 'start')
    ]);
    enter(lbl, '2.2s');
    svg.appendChild(lbl);
    var votes = svgEl('circle', { r: '4', fill: BP, opacity: '0' });
    votes.appendChild(svgEl('animateMotion', { path: 'M40 152 Q 100 138 150 114 T 260 75 T 370 88 T 480 121', dur: '3.5s', begin: '3s', repeatCount: 'indefinite', calcMode: 'spline', keyPoints: '0;1', keyTimes: '0;1', keySplines: '0.4 0 0.6 1' }));
    votes.appendChild(anim('opacity', '0;1;1;0', '3.5s', { begin: '3s', keyTimes: '0;0.08;0.92;1' }));
    svg.appendChild(votes);
    shell(host, 'ENSEMBLE AVERAGING', 'many wrongs make a right',
      svg,
      'Each grey curve is one weak learner: high variance, wrong in its own way. Because their errors are (partly) independent, averaging them cancels the noise while keeping the shared signal, and the blue ensemble tracks the true pattern more closely than any member. Bagging builds exactly this, and majority voting is the same cancellation applied to class labels.');
  }

  // -- f3-pipeline-flow: one sample rides through fit-once, ordered stages ----
  function pipelineFlow(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 200' });
    var stages = [
      { x: 76, name: 'impute', sub: 'median' },
      { x: 196, name: 'scale', sub: 'mean, std' },
      { x: 316, name: 'encode', sub: 'one-hot' },
      { x: 436, name: 'model', sub: 'predict' }
    ];
    var i, g;
    for (i = 0; i < 4; i++) {
      g = grp(stages[i].x, 92);
      g.appendChild(svgEl('rect', { x: '-46', y: '-27', width: '92', height: '54', rx: '6', fill: SURF, stroke: BP, 'stroke-width': '1.5' }));
      g.appendChild(txt(0, -4, stages[i].name, '11', BP));
      g.appendChild(txt(0, 13, stages[i].sub, '8', MUTE));
      pop(g, (0.1 + i * 0.18) + 's');
      svg.appendChild(g);
    }
    for (i = 0; i < 3; i++) {
      var ar = svgEl('line', { x1: 122 + i * 120, y1: 92, x2: 150 + i * 120, y2: 92, stroke: SOFT, 'stroke-width': '1.4', opacity: '0' });
      enter(ar, (0.8 + i * 0.1) + 's');
      svg.appendChild(ar);
    }
    var dot = svgEl('circle', { r: '5', fill: BP, opacity: '0' });
    dot.appendChild(svgEl('animateMotion', { path: 'M30 92 L76 92 L196 92 L316 92 L436 92 L496 92', dur: '5s', begin: '1.4s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0.1;0.1;0.35;0.35;0.61;0.61;0.87;0.87;1', keyTimes: '0;0.08;0.2;0.28;0.4;0.48;0.6;0.68;0.8;1' }));
    dot.appendChild(anim('opacity', '0;1;1;0', '5s', { begin: '1.4s', keyTimes: '0;0.04;0.94;1' }));
    dot.appendChild(anim('r', '5;5;3.6;3.6;5;5;3.6;3.6;5', '5s', { begin: '1.4s', keyTimes: '0;0.2;0.28;0.4;0.48;0.6;0.68;0.8;1', calcMode: 'discrete' }));
    svg.appendChild(dot);
    var lock = svgEl('g', { opacity: '0' }, [
      txt(196, 152, 'statistics fitted on train data only', '9', WARN),
      txt(196, 168, 'inference reuses the frozen fit, so train and serve match', '9', MUTE)
    ]);
    enter(lock, '2s');
    svg.appendChild(lock);
    shell(host, 'ML PIPELINE', 'one object, ordered steps',
      svg,
      'A pipeline chains every transformation and the model into one object: the sample enters raw and each stage reshapes it before handing it on. All statistics (medians, means, category maps) are fitted once, on training data only, then frozen. Serving runs the identical chain, which is what closes off data leakage and train-serve skew.');
  }

  // -- f3-series-decompose: observed = trend + seasonality + residual --------
  function seriesDecompose(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 280' });
    var obs = svgEl('path', { d: 'M60 88 C 90 58, 110 58, 140 76 C 170 94, 190 50, 220 46 C 250 42, 270 78, 300 70 C 330 62, 350 34, 380 36 C 410 38, 430 60, 480 48', fill: 'none', stroke: INK, 'stroke-width': '1.8' });
    drawIn(obs, 470, 1.2, '0.2s');
    svg.appendChild(obs);
    svg.appendChild(txt(60, 26, 'observed series', '9', INK, 'start'));
    var rows = [
      { d: 'M60 138 C 200 132, 340 122, 480 112', label: 'trend', color: BP, b: '1.5s' },
      { d: 'M60 192 Q 90 172 120 192 T 180 192 T 240 192 T 300 192 T 360 192 T 420 192 T 480 192', label: 'seasonality', color: WARN, b: '1.8s' },
      { d: 'M60 246 L90 241 L120 249 L150 244 L180 248 L210 242 L240 247 L270 245 L300 250 L330 243 L360 247 L390 244 L420 248 L450 245 L480 247', label: 'residual', color: MUTE, b: '2.1s' }
    ];
    var i;
    for (i = 0; i < 3; i++) {
      var g = svgEl('g', { opacity: '0' });
      g.appendChild(svgEl('path', { d: rows[i].d, fill: 'none', stroke: rows[i].color, 'stroke-width': '1.6' }));
      g.appendChild(txt(60, 118 + i * 54, rows[i].label, '9', rows[i].color, 'start'));
      g.appendChild(txt(40, 142 + i * 54, i === 0 ? '=' : '+', '13', SOFT));
      g.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.55s', begin: rows[i].b, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      g.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 -6;0 0', dur: '0.55s', begin: rows[i].b, fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      svg.appendChild(g);
    }
    var scan = svgEl('line', { x1: 60, y1: 34, x2: 60, y2: 258, stroke: RULE, 'stroke-width': '1', opacity: '0' });
    scan.appendChild(svgEl('animate', { attributeName: 'x1', values: '60;480', dur: '4.5s', begin: '3s', repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0.4 0 0.6 1', keyTimes: '0;1' }));
    scan.appendChild(svgEl('animate', { attributeName: 'x2', values: '60;480', dur: '4.5s', begin: '3s', repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0.4 0 0.6 1', keyTimes: '0;1' }));
    scan.appendChild(anim('opacity', '0;0.8;0.8;0', '4.5s', { begin: '3s', keyTimes: '0;0.08;0.9;1' }));
    svg.appendChild(scan);
    shell(host, 'TIME SERIES DECOMPOSITION', 'peel the layers apart',
      svg,
      'The observed series is a sum of three simpler signals: a slow trend, a repeating seasonal cycle, and what is left over, the residual. Decomposition separates them so each can be handled on its own terms: detrend and deseasonalize to reach stationarity, then model the residual. The sweep line reminds you the parts line up point-for-point in time.');
  }

  // -- f3-anomaly-fence: model the normal region, flag what falls outside ----
  function anomalyFence(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var pts = [[180, 100], [230, 132], [270, 96], [212, 78], [300, 128], [252, 148], [188, 138], [286, 76], [240, 110], [316, 104]];
    var i, c;
    for (i = 0; i < 10; i++) {
      c = svgEl('circle', { cx: pts[i][0], cy: pts[i][1], r: '4.5', fill: SOFT, opacity: '0' });
      enter(c, (0.1 + i * 0.07) + 's');
      svg.appendChild(c);
    }
    var fence = svgEl('ellipse', { cx: 248, cy: 112, rx: 118, ry: 62, fill: 'none', stroke: BP, 'stroke-width': '1.8', pathLength: '100', 'stroke-dasharray': '100', 'stroke-dashoffset': '100' });
    fence.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: '100;0', dur: '1.3s', begin: '1s', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
    svg.appendChild(fence);
    svg.appendChild(txt(248, 200, 'the model learns this region: normal', '9', BP));
    var out = grp(444, 52);
    out.appendChild(svgEl('circle', { r: '5', fill: WARN }));
    pop(out, '2.2s');
    svg.appendChild(out);
    var ringA = svgEl('circle', { cx: 444, cy: 52, r: '6', fill: 'none', stroke: WARN, 'stroke-width': '1.6', opacity: '0' });
    ringA.appendChild(anim('r', '6;20', '2s', { begin: '2.6s', calcMode: 'spline', keySplines: '0.4 0 0.6 1', keyTimes: '0;1' }));
    ringA.appendChild(anim('opacity', '0.8;0', '2s', { begin: '2.6s', keyTimes: '0;1' }));
    svg.appendChild(ringA);
    var lbl = svgEl('g', { opacity: '0' }, [txt(444, 90, 'anomaly:', '9', WARN), txt(444, 104, 'outside normal', '9', WARN)]);
    enter(lbl, '2.8s');
    svg.appendChild(lbl);
    shell(host, 'ANOMALY DETECTION', 'model normal, flag the rest',
      svg,
      'There are too few labelled anomalies to learn what abnormal looks like, so the detector learns the shape of normal instead: the dense region where ordinary points live. Anything that lands outside that fence is flagged, no matter what kind of anomaly it is. That is why the method needs no anomaly labels and still catches failure modes it has never seen.');
  }

  // -- f3-feature-prune: noise features fall away, signal features stay ------
  function featurePrune(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var hs = [96, 14, 72, 10, 20, 84, 12, 58, 16, 9], base = 170;
    var keep = [true, false, true, false, false, true, false, true, false, false];
    var i;
    for (i = 0; i < 10; i++) {
      var h = hs[i], x = 62 + i * 42;
      var bar = svgEl('rect', { x: x, y: base - h, width: '26', height: h, fill: keep[i] ? BP : MUTE, opacity: '0' });
      bar.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.85', dur: '0.5s', begin: (0.1 + i * 0.09) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      bar.appendChild(svgEl('animate', { attributeName: 'height', values: (h * 0.95).toFixed(1) + ';' + h, dur: '0.5s', begin: (0.1 + i * 0.09) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      bar.appendChild(svgEl('animate', { attributeName: 'y', values: (base - h * 0.95).toFixed(1) + ';' + (base - h), dur: '0.5s', begin: (0.1 + i * 0.09) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      if (!keep[i]) {
        bar.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.85;0.12', dur: '0.3s', begin: (2 + i * 0.05) + 's', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
      } else {
        bar.appendChild(anim('opacity', '0.85;1;0.85', '3s', { begin: '2.8s', keyTimes: '0;0.5;1', calcMode: 'spline', keySplines: SPL + ';' + SPL }));
      }
      svg.appendChild(bar);
    }
    var cut = svgEl('line', { x1: 50, y1: base - 34, x2: 490, y2: base - 34, stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
    enter(cut, '1.4s');
    svg.appendChild(cut);
    svg.appendChild(txt(486, base - 40, 'selection threshold', '9', WARN, 'end'));
    svg.appendChild(txt(270, 192, 'feature importance (e.g. mutual information with the target)', '9', MUTE));
    var lbl = svgEl('g', { opacity: '0' }, [txt(270, 32, '10 features in, 4 carry signal, the rest is noise', '9', SOFT)]);
    enter(lbl, '2.6s');
    svg.appendChild(lbl);
    shell(host, 'FEATURE SELECTION', 'keep signal, drop noise',
      svg,
      'Score every feature by how much it tells you about the target, mutual information here, and a threshold splits signal from noise. The low bars fade out: dropping them shrinks the feature space, so distances stay meaningful, the model needs less data, and overfitting to noise columns disappears. Filter, wrapper, and embedded methods differ only in how the scores are computed.');
  }

  // -- f3-dqn-stability: replay decorrelates, target net updates in jumps ----
  function dqnStability(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var boxes = [
      { x: 74, y: 66, name: 'env', sub: 's, a, r, s\'', b: '0.1s' },
      { x: 226, y: 66, name: 'replay buffer', sub: 'shuffled past', b: '0.28s' },
      { x: 400, y: 66, name: 'online net', sub: 'trains every step', b: '0.46s' },
      { x: 400, y: 176, name: 'target net', sub: 'frozen copy', b: '0.64s' }
    ];
    var i, g;
    for (i = 0; i < 4; i++) {
      g = grp(boxes[i].x, boxes[i].y);
      g.appendChild(svgEl('rect', { x: '-58', y: '-26', width: '116', height: '52', rx: '6', fill: SURF, stroke: i === 3 ? WARN : BP, 'stroke-width': '1.5' }));
      g.appendChild(txt(0, -4, boxes[i].name, '10', i === 3 ? WARN : BP));
      g.appendChild(txt(0, 12, boxes[i].sub, '8', MUTE));
      pop(g, boxes[i].b);
      svg.appendChild(g);
    }
    for (i = 0; i < 3; i++) {
      var d = svgEl('circle', { r: '3.5', fill: SOFT, opacity: '0' });
      d.appendChild(svgEl('animateMotion', { path: 'M132 ' + (58 + i * 8) + ' L168 ' + (58 + i * 8), dur: '2.5s', begin: (1 + i * 0.35) + 's', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1', keyTimes: '0;1' }));
      d.appendChild(anim('opacity', '0;0.8;0.8;0', '2.5s', { begin: (1 + i * 0.35) + 's', keyTimes: '0;0.15;0.85;1' }));
      svg.appendChild(d);
    }
    for (i = 0; i < 3; i++) {
      var s = svgEl('circle', { r: '4', fill: BP, opacity: '0' });
      s.appendChild(svgEl('animateMotion', { path: 'M284 ' + (52 + i * 14) + ' L342 66', dur: '2.5s', begin: (1.4 + i * 0.3) + 's', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1', keyTimes: '0;1' }));
      s.appendChild(anim('opacity', '0;1;1;0', '2.5s', { begin: (1.4 + i * 0.3) + 's', keyTimes: '0;0.15;0.85;1' }));
      svg.appendChild(s);
    }
    svg.appendChild(txt(226, 130, 'random minibatch: decorrelated', '8', BP));
    var sync = svgEl('g', { opacity: '0' });
    sync.appendChild(svgEl('line', { x1: 400, y1: 92, x2: 400, y2: 150, stroke: WARN, 'stroke-width': '2' }));
    sync.appendChild(svgEl('polygon', { points: '396,148 404,148 400,156', fill: WARN }));
    sync.appendChild(txt(346, 126, 'copy', '8', WARN, 'end'));
    sync.appendChild(anim('opacity', '0;0;1;1;0', '5s', { begin: '1.8s', keyTimes: '0;0.76;0.8;0.92;1', calcMode: 'discrete' }));
    svg.appendChild(sync);
    var hold = svgEl('g', { opacity: '0' }, [txt(226, 214, 'target held fixed ~10k steps, then synced: a stable bootstrap target', '9', MUTE)]);
    enter(hold, '2.2s');
    svg.appendChild(hold);
    shell(host, 'DQN STABILITY TRICKS', 'replay + frozen target',
      svg,
      'Two of the three tricks that made deep Q-learning converge. Transitions stream into a replay buffer, and training samples them at random, so consecutive updates stop being correlated. Meanwhile the amber target network stays frozen while the online network trains, and only snaps to a fresh copy every ten thousand or so steps, keeping the Bellman target from chasing itself.');
  }

  // -- f3-marl-orbit: independent learners cycle, joint training converges ---
  function marlOrbit(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var orbit = svgEl('circle', { cx: 130, cy: 122, r: 55, fill: 'none', stroke: RULE, 'stroke-width': '1', 'stroke-dasharray': '4 4', opacity: '0' });
    enter(orbit, '0.2s');
    svg.appendChild(orbit);
    var a1 = svgEl('circle', { r: '6', fill: BP, opacity: '0' });
    a1.appendChild(svgEl('animateMotion', { path: 'M130 67 A55 55 0 1 1 129.9 67.001 Z', dur: '4s', begin: '0.6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1', keyTimes: '0;1' }));
    a1.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.5s', begin: '0.6s', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
    svg.appendChild(a1);
    var a2 = svgEl('circle', { r: '6', fill: WARN, opacity: '0' });
    a2.appendChild(svgEl('animateMotion', { path: 'M130 177 A55 55 0 1 1 129.9 176.999 Z', dur: '4s', begin: '0.6s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1', keyTimes: '0;1' }));
    a2.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.5s', begin: '0.7s', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
    svg.appendChild(a2);
    svg.appendChild(txt(130, 214, 'independent learning: each chases', '9', MUTE));
    svg.appendChild(txt(130, 228, 'the other, policies never settle', '9', MUTE));
    var spiralD = 'M390 42 C 462 42, 462 198, 390 198 C 326 198, 326 70, 390 70 C 434 70, 434 170, 390 170 C 352 170, 352 96, 390 96 C 418 96, 418 146, 390 146 C 368 146, 368 118, 390 118';
    var spiral = svgEl('path', { d: spiralD, fill: 'none', stroke: RULE, 'stroke-width': '1', 'stroke-dasharray': '4 4', opacity: '0' });
    enter(spiral, '0.4s');
    svg.appendChild(spiral);
    var eq = svgEl('circle', { cx: 390, cy: 122, r: '4', fill: BP, opacity: '0' });
    eq.appendChild(anim('r', '4;6;4', '3s', { begin: '1.4s', keyTimes: '0;0.5;1', calcMode: 'spline', keySplines: SPL + ';' + SPL }));
    enter(eq, '1.2s');
    svg.appendChild(eq);
    var walker = svgEl('circle', { r: '5.5', fill: WARN, opacity: '0' });
    walker.appendChild(svgEl('animateMotion', { path: spiralD, dur: '5.5s', begin: '1s', repeatCount: 'indefinite', calcMode: 'spline', keyPoints: '0;1', keyTimes: '0;1', keySplines: '0.4 0 0.6 1' }));
    walker.appendChild(anim('opacity', '0;1;1;0', '5.5s', { begin: '1s', keyTimes: '0;0.06;0.9;1' }));
    svg.appendChild(walker);
    svg.appendChild(txt(390, 214, 'centralized critic: the joint view', '9', MUTE));
    svg.appendChild(txt(390, 228, 'damps the chase into an equilibrium', '9', MUTE));
    shell(host, 'MULTI-AGENT DYNAMICS', 'cycle vs converge',
      svg,
      'Left: two independent learners in the same world. Each treats the other as part of the environment, so every update by one invalidates the other\'s value estimates, and the pair orbits forever, the non-stationarity trap. Right: give training a centralized critic that sees the joint state and actions, and the same dynamics spiral inward to a stable joint policy.');
  }

  // -- f3-reality-gap: the randomized sim envelope grows over the real world -
  function realityGap(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    var axis = svgEl('line', { x1: 50, y1: 150, x2: 470, y2: 150, stroke: SOFT, 'stroke-width': '1.2', opacity: '0' });
    enter(axis, '0.1s');
    svg.appendChild(axis);
    svg.appendChild(txt(260, 174, 'physics parameter (friction, mass, latency, lighting...)', '9', MUTE));
    var band = svgEl('rect', { x: 130, y: 82, width: 70, height: 60, rx: '6', fill: BP, opacity: '0' });
    band.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.18;0.18', dur: '6s', begin: '0.5s', repeatCount: 'indefinite', keyTimes: '0;0.08;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1' }));
    band.appendChild(svgEl('animate', { attributeName: 'x', values: '130;130;84;84', dur: '6s', begin: '0.5s', repeatCount: 'indefinite', keyTimes: '0;0.3;0.55;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1' }));
    band.appendChild(svgEl('animate', { attributeName: 'width', values: '70;70;330;330', dur: '6s', begin: '0.5s', repeatCount: 'indefinite', keyTimes: '0;0.3;0.55;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1' }));
    svg.appendChild(band);
    var bandLbl = svgEl('g', { opacity: '0' }, [txt(165, 68, 'sim training envelope', '9', BP, 'start')]);
    enter(bandLbl, '0.7s');
    svg.appendChild(bandLbl);
    var real = svgEl('g', { opacity: '0' });
    real.appendChild(svgEl('line', { x1: 350, y1: 76, x2: 350, y2: 150, stroke: INK, 'stroke-width': '2' }));
    real.appendChild(svgEl('circle', { cx: 350, cy: 150, r: '4.5', fill: INK }));
    real.appendChild(txt(350, 64, 'the real robot', '9', INK));
    enter(real, '1s');
    svg.appendChild(real);
    var gap = svgEl('g', { opacity: '0' }, [txt(276, 118, 'gap', '10', WARN)]);
    gap.appendChild(anim('opacity', '0;1;1;0;0', '6s', { begin: '0.5s', keyTimes: '0;0.18;0.34;0.44;1', calcMode: 'spline', keySplines: SPL + ';0 0 1 1;0.4 0 1 1;0 0 1 1' }));
    svg.appendChild(gap);
    var cover = svgEl('g', { opacity: '0' }, [txt(260, 200, 'randomize the sim until reality is just one more variant', '9', BP)]);
    cover.appendChild(anim('opacity', '0;0;1;1;0', '6s', { begin: '0.5s', keyTimes: '0;0.55;0.66;0.92;1', calcMode: 'spline', keySplines: '0 0 1 1;' + SPL + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(cover);
    shell(host, 'DOMAIN RANDOMIZATION', 'widen the envelope',
      svg,
      'A policy trained in one fixed simulator sits some distance from the real system on every physics axis, and that distance is the reality gap. Domain randomization widens the training envelope: every episode samples different masses, frictions, delays, and lighting. Once the envelope spans the real robot\'s parameters, reality is just another sample the policy already handles.');
  }

  // -- f3-selfplay-ladder: the self-play loop turns cycles into rising skill -
  function selfplayLadder(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var nodes = [
      { x: 120, y: 52, name: 'self-play', b: '0.1s' },
      { x: 196, y: 150, name: 'search', b: '0.28s' },
      { x: 44, y: 150, name: 'update', b: '0.46s' }
    ];
    var i, g;
    for (i = 0; i < 3; i++) {
      g = grp(nodes[i].x, nodes[i].y);
      g.appendChild(svgEl('rect', { x: '-40', y: '-18', width: '80', height: '36', rx: '6', fill: SURF, stroke: BP, 'stroke-width': '1.5' }));
      g.appendChild(txt(0, 4, nodes[i].name, '10', BP));
      pop(g, nodes[i].b);
      svg.appendChild(g);
    }
    var loopD = 'M120 52 L196 150 L44 150 Z';
    var tri = svgEl('path', { d: loopD, fill: 'none', stroke: RULE, 'stroke-width': '1', 'stroke-dasharray': '4 4', opacity: '0' });
    enter(tri, '0.7s');
    svg.appendChild(tri);
    var runner = svgEl('circle', { r: '5', fill: BP, opacity: '0' });
    runner.appendChild(svgEl('animateMotion', { path: loopD, dur: '5s', begin: '1s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1', keyTimes: '0;1' }));
    runner.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', dur: '0.5s', begin: '1s', fill: 'freeze', calcMode: 'spline', keySplines: SPL, keyTimes: '0;1' }));
    svg.appendChild(runner);
    svg.appendChild(txt(120, 206, 'play yourself, let search improve the move,', '9', MUTE));
    svg.appendChild(txt(120, 220, 'train the net on what search found', '9', MUTE));
    var stairs = svgEl('path', { d: 'M280 190 L316 190 L316 166 L352 166 L352 142 L388 142 L388 116 L424 116 L424 90 L460 90 L460 64 L484 64', fill: 'none', stroke: BP, 'stroke-width': '2.2' });
    stairs.setAttribute('stroke-dasharray', '460');
    stairs.setAttribute('stroke-dashoffset', '460');
    stairs.appendChild(svgEl('animate', { attributeName: 'stroke-dashoffset', values: '460;0;0', dur: '5s', begin: '1s', repeatCount: 'indefinite', keyTimes: '0;0.85;1', calcMode: 'linear' }));
    svg.appendChild(stairs);
    var axisY = svgEl('line', { x1: 280, y1: 44, x2: 280, y2: 190, stroke: RULE, 'stroke-width': '1', opacity: '0' });
    enter(axisY, '0.8s');
    svg.appendChild(axisY);
    svg.appendChild(txt(382, 210, 'playing strength, one step per loop', '9', SOFT));
    svg.appendChild(txt(292, 40, 'Elo', '9', MUTE, 'start'));
    shell(host, 'SELF-PLAY LADDER', 'the AlphaZero loop',
      svg,
      'One loop drives AlphaZero, MuZero, and GRPO alike: the current policy plays itself, search (or verification) turns those games into a better move distribution, and the network is trained toward what search found. Every lap around the triangle produces a slightly stronger opponent for the next lap, so playing strength climbs the staircase without any human data.');
  }

  LF.register({
    'f3-bootstrap-resample': bootstrapResample,
    'f3-learning-boundary': learningBoundary,
    'f3-ensemble-average': ensembleAverage,
    'f3-pipeline-flow': pipelineFlow,
    'f3-series-decompose': seriesDecompose,
    'f3-anomaly-fence': anomalyFence,
    'f3-feature-prune': featurePrune,
    'f3-dqn-stability': dqnStability,
    'f3-marl-orbit': marlOrbit,
    'f3-reality-gap': realityGap,
    'f3-selfplay-ladder': selfplayLadder
  });
})();
