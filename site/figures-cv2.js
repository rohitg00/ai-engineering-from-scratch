/* figures-cv2.js — animated SVG lesson figures for Phase 4 (computer vision).
   Loads after lesson-figures.js and registers widgets through window.LF.
   Every figure is a self-running SMIL animation of one CV concept: no JS
   timers, no compute loops. Vanilla ES5, no deps, theme via CSS vars.
   Authoring is the same fenced block in docs/en.md:
       ```figure
       object-detection-nms
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function shell(label, hint, svg, caption) {
    return el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]);
  }
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
  function txt(x, y, s, size, anchor) {
    return svgEl('text', { x: x, y: y, fill: 'var(--ink-mute,#777)', 'font-size': size || 10, 'font-family': 'monospace', 'text-anchor': anchor || 'start' }, [document.createTextNode(s)]);
  }
  var BLUE = 'var(--blueprint,#3553ff)', INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)', MUTE = 'var(--ink-mute,#777)';

  // ── object-detection-nms (06): candidate boxes pop in, NMS prunes overlaps ──
  function objectDetectionNms(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(svgEl('rect', { x: 14, y: 24, width: 240, height: 200, fill: 'var(--bg-surface,#eee)', stroke: SOFT }));
    svg.appendChild(txt(14, 18, 'scene · all candidate boxes'));
    // the "object" silhouette
    svg.appendChild(svgEl('ellipse', { cx: 130, cy: 130, rx: 58, ry: 70, fill: BLUE, opacity: '0.16' }));
    // overlapping raw candidates (drawn with dash to look proposed)
    var raw = [[80, 70, 100, 120], [92, 80, 96, 116], [70, 64, 118, 132], [104, 92, 88, 104]];
    raw.forEach(function (b, i) {
      var r = svgEl('rect', { x: b[0], y: b[1], width: b[2], height: b[3], fill: 'none', stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '4 3', opacity: '0' });
      r.appendChild(anim('opacity', '0;0.9;0.9;0.15;0.15', '5s', { begin: (i * 0.12) + 's', keyTimes: '0;0.18;0.5;0.62;1' }));
      svg.appendChild(r);
    });
    // the survivor box, drawn last, solid
    var win = svgEl('rect', { x: 78, y: 66, width: 104, height: 126, fill: 'none', stroke: BLUE, 'stroke-width': '2.6', opacity: '0' });
    win.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.55;0.72;1' }));
    svg.appendChild(win);
    var lab = svgEl('rect', { x: 78, y: 52, width: 56, height: 13, fill: BLUE, opacity: '0' });
    lab.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.6;0.78;1' }));
    svg.appendChild(lab);
    var lt = svgEl('text', { x: 82, y: 62, fill: 'var(--bg,#fafaf5)', 'font-size': '9', 'font-family': 'monospace', opacity: '0' }, [document.createTextNode('dog 0.94')]);
    lt.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.6;0.78;1' }));
    svg.appendChild(lt);
    // right column: the NMS step labels lighting up in sequence
    var steps = ['1 · dense grid of boxes', '2 · score each box', '3 · sort by objectness', '4 · drop high-IoU overlaps', '5 · one box per object'];
    steps.forEach(function (s, i) {
      var y = 56 + i * 34;
      var dot = svgEl('circle', { cx: 296, cy: y - 4, r: '5', fill: SOFT });
      dot.appendChild(anim('fill', SOFT + ';' + SOFT + ';' + BLUE + ';' + BLUE, '5s', { keyTimes: '0;' + (0.12 + i * 0.16).toFixed(2) + ';' + (0.2 + i * 0.16).toFixed(2) + ';1' }));
      svg.appendChild(dot);
      svg.appendChild(txt(310, y, s, 11));
    });
    host.appendChild(shell('OBJECT DETECTION · NMS', 'boxes pop in, overlaps pruned', svg,
      'A YOLO head predicts a box at every grid cell, so one object spawns many overlapping candidates (dashed). Non-maximum suppression sorts them by confidence, keeps the strongest, and deletes every box that overlaps it too much. What survives is one tight box per object.'));
  }

  // ── segmentation-flood (07): encoder→bottleneck→decoder, regions flood-fill ──
  function segmentationFlood(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(txt(14, 16, 'input image'));
    svg.appendChild(txt(330, 16, 'per-pixel mask'));
    // a 6x6 region map: assign each cell a class id, flood-fill in waves
    var N = 6, cell = 26, gx = 14, gy = 26, gx2 = 330;
    var classOf = [
      [0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 1, 1], [0, 2, 2, 1, 1, 1],
      [2, 2, 2, 2, 1, 1], [2, 2, 2, 2, 2, 1], [2, 2, 2, 2, 2, 2]
    ];
    var classFill = [BLUE, WARN, INK];
    var r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
      // left: greyscale input
      svg.appendChild(svgEl('rect', { x: gx + c * cell, y: gy + r * cell, width: cell - 1.5, height: cell - 1.5, fill: BLUE, opacity: (0.1 + 0.5 * ((r * 3 + c * 2) % 5) / 5).toFixed(3) }));
      // right: class mask flooding in by distance from top-left
      var dist = (r + c) / 10;
      var cl = classOf[r][c];
      var m = svgEl('rect', { x: gx2 + c * cell, y: gy + r * cell, width: cell - 1.5, height: cell - 1.5, fill: classFill[cl], opacity: '0' });
      var dcl = Math.min(0.85, dist);
      m.appendChild(anim('opacity', '0;0;0.8;0.8', '4s', { keyTimes: '0;' + dcl.toFixed(2) + ';' + (dcl + 0.12).toFixed(2) + ';1' }));
      svg.appendChild(m);
    }
    // skip-connection arc bridging encoder side to decoder side
    var arc = svgEl('path', { d: 'M 175 70 C 240 30, 300 30, 330 70', fill: 'none', stroke: BLUE, 'stroke-width': '1.8', 'stroke-dasharray': '6 4', opacity: '0.7' });
    var arcLen = '170';
    arc.setAttribute('stroke-dasharray', arcLen);
    arc.setAttribute('stroke-dashoffset', arcLen);
    arc.appendChild(anim('stroke-dashoffset', arcLen + ';0;0;' + arcLen, '4s'));
    svg.appendChild(arc);
    svg.appendChild(txt(210, 28, 'skip connection', 9));
    // a pixel travelling the skip arc
    var dot = svgEl('circle', { r: '4', fill: WARN });
    var mp = svgEl('animateMotion', { dur: '4s', repeatCount: 'indefinite', path: 'M 175 70 C 240 30, 300 30, 330 70', keyPoints: '0;1;1', keyTimes: '0;0.5;1' });
    dot.appendChild(mp);
    svg.appendChild(dot);
    host.appendChild(shell('SEMANTIC SEGMENTATION', 'every pixel labelled, regions flood in', svg,
      'Segmentation is classification at every pixel. The encoder compresses the image for context, the decoder upsamples back to full resolution, and a skip connection carries the fine spatial detail across so boundaries stay crisp. Watch each pixel claim its class as the mask floods outward.'));
  }

  // ── gan-minimax (09): G turns noise into an image, D's verdict oscillates ───
  function ganMinimax(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(txt(14, 16, 'noise z'));
    svg.appendChild(txt(150, 16, 'generator G'));
    svg.appendChild(txt(300, 16, 'fake image'));
    svg.appendChild(txt(430, 16, 'critic D'));
    // noise dots (left), flickering
    var i;
    for (i = 0; i < 9; i++) {
      var nx = 18 + (i % 3) * 18, ny = 40 + Math.floor(i / 3) * 18;
      var n = svgEl('circle', { cx: nx, cy: ny, r: '4', fill: MUTE });
      n.appendChild(anim('opacity', '0.3;1;0.3', '0.9s', { begin: (i * 0.1) + 's' }));
      svg.appendChild(n);
    }
    // arrow into G
    svg.appendChild(svgEl('path', { d: 'M 86 70 L 138 70', stroke: SOFT, 'stroke-width': '2', 'marker-end': '' }));
    // G block
    svg.appendChild(svgEl('rect', { x: 138, y: 40, width: 70, height: 60, fill: BLUE, opacity: '0.16', stroke: BLUE }));
    // fake image: 4x4 grid that sharpens from noise to a coherent pattern over the loop
    var gx = 290, gy = 40, cs = 18, r, c;
    for (r = 0; r < 4; r++) for (c = 0; c < 4; c++) {
      var target = ((r < 2) === (c < 2)) ? 0.85 : 0.18; // a 2x2 "face" block pattern
      var rect = svgEl('rect', { x: gx + c * cs, y: gy + r * cs, width: cs - 1.5, height: cs - 1.5, fill: BLUE });
      var noisy = (0.2 + 0.6 * ((r * 7 + c * 5) % 4) / 4).toFixed(2);
      rect.appendChild(anim('opacity', noisy + ';' + target + ';' + target, '4.5s', { keyTimes: '0;0.7;1' }));
      svg.appendChild(rect);
    }
    // arrow to D
    svg.appendChild(svgEl('path', { d: 'M 364 70 L 414 70', stroke: SOFT, 'stroke-width': '2' }));
    // D's P(real) gauge bar
    svg.appendChild(svgEl('rect', { x: 430, y: 50, width: 70, height: 12, fill: 'var(--bg-surface,#eee)' }));
    var gauge = svgEl('rect', { x: 430, y: 50, width: 18, height: 12, fill: WARN });
    gauge.appendChild(anim('width', '12;30;20;46;38', '4.5s', { calcMode: 'spline', keySplines: '.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1', keyTimes: '0;0.3;0.55;0.8;1' }));
    gauge.appendChild(anim('fill', WARN + ';' + WARN + ';' + BLUE, '4.5s', { keyTimes: '0;0.6;1' }));
    svg.appendChild(gauge);
    svg.appendChild(txt(430, 80, 'P(real) →', 9));
    // tug-of-war loss bars at the bottom
    svg.appendChild(txt(14, 150, 'minimax — G pushes the score up, D pushes it down', 11));
    var seesaw = svgEl('line', { x1: 60, y1: 190, x2: 460, y2: 190, stroke: INK, 'stroke-width': '2.5' });
    seesaw.appendChild(animT('rotate', '-7 260 190;7 260 190;-7 260 190', '4.5s'));
    svg.appendChild(seesaw);
    svg.appendChild(svgEl('circle', { cx: 260, cy: 196, r: '4', fill: BLUE }));
    var gL = svgEl('text', { x: 70, y: 178, fill: BLUE, 'font-size': '10', 'font-family': 'monospace' }, [document.createTextNode('G')]);
    var dL = svgEl('text', { x: 446, y: 178, fill: WARN, 'font-size': '10', 'font-family': 'monospace' }, [document.createTextNode('D')]);
    svg.appendChild(gL); svg.appendChild(dL);
    host.appendChild(shell('GAN · THE MINIMAX GAME', 'one draws, one critiques', svg,
      'The generator turns a noise vector into an image; the critic scores how real it looks. They train against each other: the generator pushes the critic\'s P(real) up, the critic pushes it down. As the seesaw settles toward balance the fake image sharpens from noise into structure.'));
  }

  // ── diffusion-denoise (10): a noisy grid walks back to a clean image ────────
  function diffusionDenoise(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 220' });
    svg.appendChild(txt(14, 16, 'x_T  pure noise'));
    svg.appendChild(txt(360, 16, 'x_0  sample'));
    // a 6x6 grid: each cell animates from random noise opacity to a target image
    var N = 6, cell = 28, gx = 150, gy = 30;
    var target = [
      [0.1, 0.1, 0.7, 0.7, 0.1, 0.1], [0.1, 0.7, 0.9, 0.9, 0.7, 0.1],
      [0.7, 0.9, 0.3, 0.3, 0.9, 0.7], [0.7, 0.9, 0.3, 0.3, 0.9, 0.7],
      [0.1, 0.7, 0.9, 0.9, 0.7, 0.1], [0.1, 0.1, 0.7, 0.7, 0.1, 0.1]
    ];
    var r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
      var rect = svgEl('rect', { x: gx + c * cell, y: gy + r * cell, width: cell - 2, height: cell - 2, fill: BLUE });
      // five denoise steps: noise opacity wanders, then converges to target
      var v = ((r * 11 + c * 7) % 5) / 5;
      var v2 = ((r * 5 + c * 13) % 5) / 5;
      var t = target[r][c];
      rect.appendChild(anim('opacity', v.toFixed(2) + ';' + v2.toFixed(2) + ';' + ((v2 + t) / 2).toFixed(2) + ';' + t.toFixed(2) + ';' + t.toFixed(2), '5s', { keyTimes: '0;0.3;0.6;0.85;1' }));
      svg.appendChild(rect);
    }
    // a step counter walking T → 0
    var counter = svgEl('text', { x: 260, y: 212, fill: BLUE, 'font-size': '13', 'font-family': 'monospace', 'text-anchor': 'middle' }, [document.createTextNode('t = 1000')]);
    var ct = svgEl('animate', { attributeName: 'opacity', values: '1;1', dur: '5s', repeatCount: 'indefinite' });
    counter.appendChild(ct);
    // simulate countdown with discrete text via <set>-style chained values is hard; use a sweeping arrow instead
    svg.appendChild(counter);
    // denoise arrow sweeping right with a moving marker
    svg.appendChild(svgEl('line', { x1: 150, y1: 200, x2: 318, y2: 200, stroke: SOFT, 'stroke-width': '2' }));
    var head = svgEl('polygon', { points: '0,-4 8,0 0,4', fill: WARN });
    var mp = svgEl('animateMotion', { dur: '5s', repeatCount: 'indefinite', path: 'M 150 200 L 318 200' });
    head.appendChild(mp);
    svg.appendChild(head);
    svg.appendChild(txt(150, 196, 'reverse process: predict and subtract noise, step by step', 9));
    host.appendChild(shell('DIFFUSION · DENOISING', 'from pure noise to a sample', svg,
      'A diffusion model learns to remove a little noise at a time. Sampling starts from a grid of pure Gaussian noise and walks backward: each step predicts the noise and subtracts it, so structure emerges gradually. Repeat the small denoising step enough times and a coherent image condenses out of static.'));
  }

  // ── nerf-rays (13): a camera casts rays through a volume, samples accumulate ─
  function nerfRays(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(txt(14, 16, 'camera'));
    svg.appendChild(txt(300, 16, 'volume (density · colour field)'));
    // camera origin
    var ox = 40, oy = 120;
    svg.appendChild(svgEl('circle', { cx: ox, cy: oy, r: '6', fill: INK }));
    svg.appendChild(svgEl('rect', { x: ox - 4, y: oy - 12, width: 8, height: 24, fill: 'none', stroke: INK, 'stroke-width': '1.5' }));
    // the implicit object: a soft blob in the volume
    svg.appendChild(svgEl('ellipse', { cx: 380, cy: 120, rx: 64, ry: 78, fill: BLUE, opacity: '0.14' }));
    svg.appendChild(svgEl('ellipse', { cx: 380, cy: 120, rx: 34, ry: 44, fill: BLUE, opacity: '0.2' }));
    // three rays fanning out, drawn progressively with dashoffset
    var rays = [[ox, oy, 470, 60], [ox, oy, 480, 120], [ox, oy, 470, 180]];
    rays.forEach(function (rr, i) {
      var len = 460;
      var line = svgEl('line', { x1: rr[0], y1: rr[1], x2: rr[2], y2: rr[3], stroke: SOFT, 'stroke-width': '1.4', 'stroke-dasharray': len, 'stroke-dashoffset': len });
      line.appendChild(anim('stroke-dashoffset', len + ';0;0', '4s', { begin: (i * 0.25) + 's', keyTimes: '0;0.6;1' }));
      svg.appendChild(line);
      // sample points marching along each ray, brightening inside the blob
      var s;
      for (s = 0; s < 8; s++) {
        var t = s / 7;
        var sx = rr[0] + (rr[2] - rr[0]) * t;
        var sy = rr[1] + (rr[3] - rr[1]) * t;
        var inside = sx > 320 && sx < 444;
        var pt = svgEl('circle', { cx: sx, cy: sy, r: inside ? '3.2' : '2', fill: inside ? BLUE : MUTE, opacity: '0' });
        pt.appendChild(anim('opacity', '0;0;' + (inside ? '1' : '0.5') + ';' + (inside ? '1' : '0.5'), '4s', { begin: (i * 0.25 + s * 0.05) + 's', keyTimes: '0;' + (0.1 + t * 0.5).toFixed(2) + ';' + (0.2 + t * 0.5).toFixed(2) + ';1' }));
        svg.appendChild(pt);
      }
    });
    // accumulated pixel swatches on the right edge
    var i2;
    for (i2 = 0; i2 < 3; i2++) {
      var px = svgEl('rect', { x: 488, y: 50 + i2 * 60, width: 18, height: 40, fill: BLUE, opacity: '0' });
      px.appendChild(anim('opacity', '0;0;0.85;0.85', '4s', { begin: (i2 * 0.25) + 's', keyTimes: '0;0.7;0.9;1' }));
      svg.appendChild(px);
    }
    svg.appendChild(txt(150, 215, 'march along each ray, query the MLP for density + colour, integrate → one pixel', 9));
    host.appendChild(shell('NeRF · VOLUME RENDERING', 'rays sample the field, colours integrate', svg,
      'A NeRF stores a scene as a function: give it a 3D point and view direction, it returns density and colour. To render a pixel, cast a ray from the camera, sample points along it, query the MLP at each, and integrate density-weighted colour front to back. Each ray collapses a line through space into one pixel.'));
  }

  // ── clip-contrastive (18): NxN similarity matrix, diagonal lights up ────────
  function clipContrastive(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(txt(86, 18, 'text embeddings →'));
    var N = 5, cell = 30, gx = 86, gy = 30;
    // row = image, col = caption; build the matrix
    var r, c;
    for (r = 0; r < N; r++) {
      svg.appendChild(txt(gx - 8, gy + r * cell + 20, 'img', 9, 'end'));
      for (c = 0; c < N; c++) {
        var diag = r === c;
        var rect = svgEl('rect', { x: gx + c * cell, y: gy + r * cell, width: cell - 2, height: cell - 2, fill: diag ? BLUE : MUTE, 'stroke': SOFT, 'stroke-width': '0.5' });
        if (diag) {
          rect.appendChild(anim('opacity', '0.2;0.2;1;1', '4s', { keyTimes: '0;0.3;0.6;1' }));
        } else {
          rect.appendChild(anim('opacity', '0.5;0.5;0.12;0.12', '4s', { keyTimes: '0;0.3;0.6;1' }));
        }
        svg.appendChild(rect);
      }
    }
    // sweeping highlight that travels down the diagonal
    var hl = svgEl('rect', { x: gx, y: gy, width: cell - 2, height: cell - 2, fill: 'none', stroke: WARN, 'stroke-width': '2.5' });
    var pts = [];
    for (r = 0; r < N; r++) pts.push((gx + r * cell) + ',' + (gy + r * cell));
    var mp = svgEl('animateMotion', { dur: '4s', repeatCount: 'indefinite', path: 'M 0 0' });
    // build a path along the diagonal cells
    var pd = 'M 0 0';
    for (r = 1; r < N; r++) pd += ' L ' + (r * cell) + ' ' + (r * cell);
    mp.setAttribute('path', pd);
    mp.setAttribute('begin', '0.4s');
    hl.appendChild(mp);
    svg.appendChild(hl);
    // legend
    svg.appendChild(svgEl('rect', { x: 300, y: 70, width: 14, height: 14, fill: BLUE }));
    svg.appendChild(txt(320, 81, 'matching (image, caption) — pull together', 11));
    svg.appendChild(svgEl('rect', { x: 300, y: 96, width: 14, height: 14, fill: MUTE, opacity: '0.5' }));
    svg.appendChild(txt(320, 107, 'mismatched pairs — push apart', 11));
    svg.appendChild(txt(300, 150, 'softmax over each row and column', 10));
    svg.appendChild(txt(300, 166, 'drives the diagonal high', 10));
    host.appendChild(shell('CLIP · CONTRASTIVE MATRIX', 'matching pairs land on the diagonal', svg,
      'CLIP embeds images and captions into one shared space. For a batch of N pairs it builds an NxN similarity matrix and trains so the diagonal (true pairs) scores high and every off-diagonal scores low. Watch the diagonal brighten as matching pairs are pulled together and mismatches pushed apart.'));
  }

  // ── metric-embedding (20): points cluster by class, a query finds neighbours ─
  function metricEmbedding(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(txt(14, 16, 'embedding space — metric learning pulls same-class together'));
    // three clusters: scattered start positions and tight end positions
    var clusters = [
      { cx: 130, cy: 150, fill: BLUE, start: [[60, 60], [200, 90], [90, 200], [180, 190], [50, 130]] },
      { cx: 300, cy: 90, fill: WARN, start: [[360, 180], [240, 200], [330, 200], [380, 60], [260, 50]] },
      { cx: 400, cy: 170, fill: INK, start: [[330, 70], [460, 70], [450, 200], [340, 210], [410, 60]] }
    ];
    clusters.forEach(function (cl) {
      cl.start.forEach(function (s, i) {
        var ang = i / cl.start.length * 6.28;
        var ex = cl.cx + Math.cos(ang) * 22;
        var ey = cl.cy + Math.sin(ang) * 22;
        var dot = svgEl('circle', { cx: s[0], cy: s[1], r: '5', fill: cl.fill, opacity: '0.85' });
        dot.appendChild(anim('cx', s[0] + ';' + ex.toFixed(0) + ';' + ex.toFixed(0) + ';' + s[0], '6s', { calcMode: 'spline', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1', keyTimes: '0;0.4;0.7;1' }));
        dot.appendChild(anim('cy', s[1] + ';' + ey.toFixed(0) + ';' + ey.toFixed(0) + ';' + s[1], '6s', { calcMode: 'spline', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1', keyTimes: '0;0.4;0.7;1' }));
        svg.appendChild(dot);
      });
    });
    // query point + a top-k ring expanding once clusters are tight
    var q = svgEl('circle', { cx: 130, cy: 150, r: '6', fill: 'none', stroke: WARN, 'stroke-width': '2.5' });
    svg.appendChild(q);
    var ring = svgEl('circle', { cx: 130, cy: 150, r: '5', fill: 'none', stroke: WARN, 'stroke-width': '1.5', opacity: '0' });
    ring.appendChild(anim('r', '5;5;48;48', '6s', { keyTimes: '0;0.45;0.65;1' }));
    ring.appendChild(anim('opacity', '0;0;0.9;0', '6s', { keyTimes: '0;0.45;0.65;1' }));
    svg.appendChild(ring);
    svg.appendChild(txt(220, 230, 'query → nearest neighbours by cosine distance = same class', 10));
    host.appendChild(shell('METRIC LEARNING · RETRIEVAL', 'same-class points cluster, query rings its neighbours', svg,
      'Retrieval ranks candidates by distance in an embedding space. Metric learning shapes that space: a triplet or contrastive loss pulls same-class points together and pushes other classes apart. Once the clusters are tight, a query\'s nearest neighbours by cosine distance are reliably the right answers.'));
  }

  // ── depth-rays (26): RGB grid → depth gradient, a scan sweep colours by range ─
  function depthSweep(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(txt(14, 16, 'RGB frame'));
    svg.appendChild(txt(300, 16, 'predicted depth (near → far)'));
    var N = 6, cell = 28, gx = 14, gy = 28, gx2 = 300;
    // depth value per cell: a scene receding to the top-right (sky far, floor near)
    var depthOf = function (r, c) { return (c * 0.6 + (5 - r) * 0.7) / 6.6; };
    var r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
      // left: flat-ish RGB texture
      svg.appendChild(svgEl('rect', { x: gx + c * cell, y: gy + r * cell, width: cell - 1.5, height: cell - 1.5, fill: BLUE, opacity: (0.2 + 0.35 * ((r * 3 + c) % 4) / 4).toFixed(3) }));
      // right: depth cell, revealed as a vertical scan sweeps across
      var d = depthOf(r, c);
      var col = d < 0.4 ? WARN : (d < 0.7 ? BLUE : INK);
      var op = (0.25 + 0.6 * (1 - d)).toFixed(3); // near = brighter
      var dep = svgEl('rect', { x: gx2 + c * cell, y: gy + r * cell, width: cell - 1.5, height: cell - 1.5, fill: col, opacity: '0' });
      var reveal = Math.min(0.85, c / N);
      dep.appendChild(anim('opacity', '0;0;' + op + ';' + op, '4s', { keyTimes: '0;' + reveal.toFixed(2) + ';' + (reveal + 0.12).toFixed(2) + ';1' }));
      svg.appendChild(dep);
    }
    // the scan line sweeping left→right across the depth map
    var scan = svgEl('line', { x1: gx2, y1: gy, x2: gx2, y2: gy + N * cell, stroke: WARN, 'stroke-width': '2.5' });
    scan.appendChild(anim('x1', gx2 + ';' + (gx2 + N * cell), '4s'));
    scan.appendChild(anim('x2', gx2 + ';' + (gx2 + N * cell), '4s'));
    svg.appendChild(scan);
    // depth legend bar
    svg.appendChild(svgEl('rect', { x: 14, y: 206, width: 20, height: 10, fill: WARN }));
    svg.appendChild(txt(38, 215, 'near', 9));
    svg.appendChild(svgEl('rect', { x: 78, y: 206, width: 20, height: 10, fill: BLUE }));
    svg.appendChild(txt(102, 215, 'mid', 9));
    svg.appendChild(svgEl('rect', { x: 138, y: 206, width: 20, height: 10, fill: INK }));
    svg.appendChild(txt(162, 215, 'far', 9));
    svg.appendChild(txt(230, 215, 'one RGB frame → a distance per pixel, no stereo or LiDAR', 9));
    host.appendChild(shell('MONOCULAR DEPTH', 'one frame in, a distance per pixel out', svg,
      'A monocular depth model maps a single RGB frame to a distance for every pixel. A frozen ViT encoder reads perspective, texture, and learned scene priors; a light decoder upsamples them into a dense depth map. Near surfaces glow bright, far ones recede — all from one image, no stereo rig or depth sensor.'));
  }

  LF.register({
    'object-detection-nms': objectDetectionNms,
    'segmentation-flood': segmentationFlood,
    'cv-gan-image': ganMinimax,
    'cv-diffusion-image': diffusionDenoise,
    'nerf-rays': nerfRays,
    'clip-contrastive': clipContrastive,
    'metric-embedding': metricEmbedding,
    'depth-sweep': depthSweep
  });
})();
