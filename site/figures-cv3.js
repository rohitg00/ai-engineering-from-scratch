/* figures-cv3.js — animated SVG lesson figures for Phase 4 (computer vision),
   second batch. Loads after lesson-figures.js and registers widgets through
   window.LF. Every figure is a self-running SMIL animation of one CV concept:
   no JS timers, no compute loops. Vanilla ES5, no deps, theme via CSS vars.
   Authoring is the same fenced block in docs/en.md:
       ```figure
       cv3-roialign-sampling
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
  function txt(x, y, s, size, anchor) {
    return svgEl('text', { x: x, y: y, fill: 'var(--ink-mute,#777)', 'font-size': size || 10, 'font-family': 'monospace', 'text-anchor': anchor || 'start' }, [document.createTextNode(s)]);
  }
  var BLUE = 'var(--blueprint,#3553ff)', INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)', MUTE = 'var(--ink-mute,#777)';

  // ── cv3-roialign-sampling (08): a proposal box's sample points sit off-grid ──
  function roialignSampling(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(txt(14, 16, 'feature map · integer pixel grid'));
    var gx = 18, gy = 26, cell = 30, N = 6, r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
      svg.appendChild(svgEl('rect', { x: gx + c * cell, y: gy + r * cell, width: cell, height: cell, fill: BLUE, opacity: (0.06 + 0.12 * ((r * 2 + c) % 4)).toFixed(3), stroke: SOFT, 'stroke-width': '0.6' }));
    }
    // a proposal box with fractional corners, sliding slightly to show misalignment
    var box = svgEl('rect', { x: 70, y: 64, width: 118, height: 110, fill: 'none', stroke: WARN, 'stroke-width': '2', 'stroke-dasharray': '5 3' });
    box.appendChild(anim('x', '70;78;70', '5s', { keyTimes: '0;0.5;1' }));
    svg.appendChild(box);
    svg.appendChild(txt(70, 60, 'RoI proposal (fractional)', 9));
    // four bilinear sample points, each pulsing with the four neighbour cells it reads
    var pts = [[100, 94], [150, 94], [100, 144], [150, 144]];
    pts.forEach(function (p, i) {
      var d = svgEl('circle', { cx: p[0], cy: p[1], r: '4', fill: WARN, opacity: '0' });
      d.appendChild(anim('opacity', '0;0;1;1', '5s', { begin: (i * 0.2) + 's', keyTimes: '0;0.25;0.4;1' }));
      svg.appendChild(d);
      // crosshair lines to the four surrounding integer cell centres (bilinear weights)
      var ring = svgEl('circle', { cx: p[0], cy: p[1], r: '14', fill: 'none', stroke: WARN, 'stroke-width': '1', opacity: '0' });
      ring.appendChild(anim('opacity', '0;0;0.6;0;0', '5s', { begin: (i * 0.2) + 's', keyTimes: '0;0.4;0.55;0.8;1' }));
      svg.appendChild(ring);
    });
    // output: a clean fixed-size 2x2 pooled grid on the right
    svg.appendChild(txt(320, 60, 'aligned 2x2 output', 9));
    var ox = 330, oy = 70, oc = 44, rr, cc;
    for (rr = 0; rr < 2; rr++) for (cc = 0; cc < 2; cc++) {
      var o = svgEl('rect', { x: ox + cc * oc, y: oy + rr * oc, width: oc - 3, height: oc - 3, fill: BLUE, stroke: BLUE, opacity: '0' });
      o.appendChild(anim('opacity', '0;0;0.7;0.7', '5s', { keyTimes: '0;0.55;0.75;1' }));
      svg.appendChild(o);
    }
    // arrow from RoI to output
    var arr = svgEl('line', { x1: 196, y1: 120, x2: 322, y2: 120, stroke: MUTE, 'stroke-width': '1.5', 'stroke-dasharray': '130', 'stroke-dashoffset': '130' });
    arr.appendChild(anim('stroke-dashoffset', '130;130;0;0', '5s', { keyTimes: '0;0.45;0.7;1' }));
    svg.appendChild(arr);
    svg.appendChild(txt(320, 150, 'bilinear interpolation,', 10));
    svg.appendChild(txt(320, 165, 'no rounding of the box', 10));
    host.appendChild(shell('MASK R-CNN · RoIAlign', 'sample points fall between pixels', svg,
      'RoIPool snaps a proposal box to the integer feature grid twice, and those roundings smear the mask by fractions of a pixel. RoIAlign keeps the box fractional: it places a fixed set of sample points inside each output bin and reads each one by bilinear interpolation of its four neighbouring cells. No rounding, so the mask lands where the object actually is.'));
  }

  // ── cv3-latent-compression (11): image grid shrinks to a small latent, back ──
  function latentCompression(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(txt(14, 16, '3 x 512 x 512 image'));
    svg.appendChild(txt(220, 16, '4 x 64 x 64 latent'));
    svg.appendChild(txt(380, 16, 'decoded image'));
    // left big grid (8x8 stand-in), each cell fading as the encoder reads it
    var i;
    function grid(ox, oy, n, c, fillTarget, begin, kt) {
      var r, cc;
      for (r = 0; r < n; r++) for (cc = 0; cc < n; cc++) {
        var rect = svgEl('rect', { x: ox + cc * c, y: oy + r * c, width: c - 1.5, height: c - 1.5, fill: BLUE, opacity: '0' });
        var base = (0.18 + 0.45 * ((r * 3 + cc * 2) % 5) / 5).toFixed(2);
        rect.appendChild(anim('opacity', '0;' + base + ';' + base + ';' + base, '5s', { begin: begin, keyTimes: kt }));
        svg.appendChild(rect);
      }
    }
    grid(14, 30, 8, 21, BLUE, '0s', '0;0.12;0.9;1');
    // VAE encoder wedge collapsing toward the small grid
    var enc = svgEl('polygon', { points: '186,40 210,90 210,150 186,200', fill: BLUE, opacity: '0.16', stroke: BLUE });
    svg.appendChild(enc);
    svg.appendChild(txt(186, 218, 'VAE encoder', 9));
    // small latent grid (4x4), brightens as the wedge fires
    var lx = 224, ly = 70, lc = 22, r, cc;
    for (r = 0; r < 4; r++) for (cc = 0; cc < 4; cc++) {
      var lr = svgEl('rect', { x: lx + cc * lc, y: ly + r * lc, width: lc - 2, height: lc - 2, fill: WARN, opacity: '0' });
      var v = (0.3 + 0.5 * ((r * 5 + cc * 3) % 4) / 4).toFixed(2);
      lr.appendChild(anim('opacity', '0;0;' + v + ';' + v, '5s', { keyTimes: '0;0.3;0.45;1' }));
      svg.appendChild(lr);
    }
    // decoder wedge expanding back out
    var dec = svgEl('polygon', { points: '326,90 350,40 350,200 326,150', fill: BLUE, opacity: '0.16', stroke: BLUE });
    svg.appendChild(dec);
    svg.appendChild(txt(322, 218, 'VAE decoder', 9));
    grid(360, 30, 8, 21, BLUE, '0s', '0;0.55;0.78;1');
    svg.appendChild(txt(150, 226, '(3*512*512)/(4*64*64) = 48x less compute to denoise', 9));
    host.appendChild(shell('STABLE DIFFUSION · LATENT SPACE', 'diffuse in 64x64, not 512x512', svg,
      'Pixel-space diffusion backprops through 786,432 values per step. Stable Diffusion trains a VAE that compresses the 3x512x512 image into a 4x64x64 latent (the small orange grid), runs the whole denoising loop there, then decodes back to pixels. The latent is 48x cheaper to attend over, which is what made open-weight text-to-image practical.'));
  }

  // ── cv3-ctc-collapse (19): per-frame char predictions collapse to a string ───
  function ctcCollapse(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    svg.appendChild(txt(14, 16, 'CRNN per-frame predictions (one column per time step)'));
    var labels = ['h', 'h', '_', 'e', 'l', 'l', '_', 'l', 'o', 'o'];
    var x0 = 22, cw = 44, top = 40;
    var i;
    for (i = 0; i < labels.length; i++) {
      var cx = x0 + i * cw;
      var box = svgEl('rect', { x: cx, y: top, width: cw - 6, height: 34, fill: labels[i] === '_' ? MUTE : BLUE, opacity: '0' });
      box.appendChild(anim('opacity', '0;0.8;0.8', '5s', { begin: (i * 0.08) + 's', keyTimes: '0;0.18;1' }));
      svg.appendChild(box);
      var t = svgEl('text', { x: cx + (cw - 6) / 2, y: top + 23, fill: 'var(--bg,#fafaf5)', 'font-size': '14', 'font-family': 'monospace', 'text-anchor': 'middle', opacity: '0' }, [document.createTextNode(labels[i] === '_' ? 'ε' : labels[i])]);
      t.appendChild(anim('opacity', '0;1;1', '5s', { begin: (i * 0.08) + 's', keyTimes: '0;0.2;1' }));
      svg.appendChild(t);
    }
    // step 1 label: merge repeats. step 2: drop blanks. animated brackets sweep under
    svg.appendChild(txt(14, 100, 'rule 1 · merge repeated neighbours', 10));
    svg.appendChild(txt(14, 116, 'rule 2 · delete blank ε', 10));
    var sweep = svgEl('rect', { x: x0, y: top, width: cw - 6, height: 34, fill: 'none', stroke: WARN, 'stroke-width': '2.5' });
    var path = 'M 0 0';
    for (i = 1; i < labels.length; i++) path += ' L ' + (i * cw) + ' 0';
    var mp = svgEl('animateMotion', { dur: '5s', repeatCount: 'indefinite', path: path, keyTimes: '0;0.2;0.95;1', keyPoints: '0;0;1;1', calcMode: 'linear' });
    sweep.appendChild(mp);
    svg.appendChild(sweep);
    // collapsed result, characters dropping in
    var out = 'hello';
    var ox = 180, oy = 175;
    for (i = 0; i < out.length; i++) {
      var oc = svgEl('text', { x: ox + i * 30, y: oy, fill: BLUE, 'font-size': '28', 'font-family': 'monospace', opacity: '0' }, [document.createTextNode(out[i])]);
      oc.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.6;' + (0.7 + i * 0.04).toFixed(2) + ';1' }));
      svg.appendChild(oc);
    }
    svg.appendChild(txt(180, 200, 'h h ε e l l ε l o o  ->  "hello"', 10));
    host.appendChild(shell('OCR · CTC COLLAPSE', 'frame labels fold into one string', svg,
      'A CRNN emits one character (or a blank ε) per time-step, with no fixed alignment to the input. CTC defines the collapse: merge runs of the same label, then delete the blanks. The blank between the two l-runs is what keeps "hello" from collapsing to "helo". Training sums over every alignment that collapses to the target.'));
  }

  // ── cv3-pose-heatmap (21): a Gaussian peak resolves, the skeleton draws in ───
  function poseHeatmap(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    svg.appendChild(txt(14, 16, 'per-keypoint heatmap (argmax = joint)'));
    svg.appendChild(txt(300, 16, 'assembled skeleton'));
    // left: a blurry heatmap blob sharpening to a peak
    var hx = 90, hy = 110;
    var blob = svgEl('circle', { cx: hx, cy: hy, r: '46', fill: WARN, opacity: '0.18' });
    blob.appendChild(anim('r', '46;46;20;20', '5s', { keyTimes: '0;0.3;0.55;1' }));
    blob.appendChild(anim('opacity', '0.16;0.16;0.4;0.4', '5s', { keyTimes: '0;0.3;0.55;1' }));
    svg.appendChild(blob);
    var peak = svgEl('circle', { cx: hx, cy: hy, r: '5', fill: WARN, opacity: '0' });
    peak.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.5;0.6;1' }));
    svg.appendChild(peak);
    svg.appendChild(txt(60, 180, 'one of K heatmaps', 9));
    // right: 17-ish joints; we use a compact skeleton of joints + bones
    var J = {
      head: [400, 50], neck: [400, 78], sho_l: [372, 86], sho_r: [428, 86],
      elb_l: [360, 122], elb_r: [440, 122], hip_l: [384, 140], hip_r: [416, 140],
      kne_l: [380, 184], kne_r: [420, 184], ank_l: [378, 222], ank_r: [422, 222]
    };
    var bones = [['head', 'neck'], ['neck', 'sho_l'], ['neck', 'sho_r'], ['sho_l', 'elb_l'], ['sho_r', 'elb_r'],
      ['neck', 'hip_l'], ['neck', 'hip_r'], ['hip_l', 'kne_l'], ['hip_r', 'kne_r'], ['kne_l', 'ank_l'], ['kne_r', 'ank_r']];
    bones.forEach(function (b, i) {
      var a = J[b[0]], z = J[b[1]];
      var len = Math.round(Math.hypot(z[0] - a[0], z[1] - a[1])) + 2;
      var ln = svgEl('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], stroke: BLUE, 'stroke-width': '2.4', 'stroke-dasharray': len, 'stroke-dashoffset': len });
      ln.appendChild(anim('stroke-dashoffset', len + ';' + len + ';0;0', '5s', { begin: (i * 0.06) + 's', keyTimes: '0;0.4;0.75;1' }));
      svg.appendChild(ln);
    });
    var k;
    for (k in J) {
      var d = svgEl('circle', { cx: J[k][0], cy: J[k][1], r: '3.4', fill: WARN, opacity: '0' });
      d.appendChild(anim('opacity', '0;0;1;1', '5s', { keyTimes: '0;0.45;0.6;1' }));
      svg.appendChild(d);
    }
    svg.appendChild(txt(60, 236, 'regress a Gaussian per joint, take the argmax pixel', 9));
    host.appendChild(shell('POSE · HEATMAP REGRESSION', 'peaks resolve, bones connect', svg,
      'A pose model does not regress coordinates directly. It outputs one heatmap per keypoint, trained so a Gaussian bump sits over the true joint; the argmax pixel is the coordinate. Once all K peaks resolve, the joints are linked into a skeleton by a fixed body graph (top-down) or by association fields (bottom-up).'));
  }

  // ── cv3-gaussian-splat (22): overlapping blobs alpha-composite into a scene ──
  function gaussianSplat(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(txt(14, 16, 'a cloud of oriented 3D Gaussians, sorted and alpha-composited'));
    // a set of elliptical splats, each fading in front-to-back, building a shape
    var splats = [
      [150, 150, 70, 40, 18, BLUE, 0.22], [210, 110, 55, 34, -22, BLUE, 0.26],
      [280, 150, 64, 38, 8, WARN, 0.24], [330, 110, 46, 30, 30, BLUE, 0.28],
      [200, 175, 50, 26, -10, INK, 0.2], [300, 95, 40, 24, 14, WARN, 0.3],
      [250, 140, 78, 44, 0, BLUE, 0.18], [360, 160, 44, 30, -18, INK, 0.22]
    ];
    splats.forEach(function (s, i) {
      var g = svgEl('ellipse', { cx: s[0], cy: s[1], rx: s[2], ry: s[3], fill: s[5], opacity: '0', transform: 'rotate(' + s[4] + ' ' + s[0] + ' ' + s[1] + ')' });
      g.appendChild(anim('opacity', '0;0;' + s[6] + ';' + s[6], '5s', { begin: (i * 0.18) + 's', keyTimes: '0;0.1;0.4;1' }));
      svg.appendChild(g);
    });
    // a sweeping "depth sort" line, front-to-back
    var sort = svgEl('line', { x1: 130, y1: 60, x2: 130, y2: 210, stroke: WARN, 'stroke-width': '1.5', opacity: '0.7' });
    sort.appendChild(anim('x1', '130;390;390', '5s', { keyTimes: '0;0.55;1' }));
    sort.appendChild(anim('x2', '130;390;390', '5s', { keyTimes: '0;0.55;1' }));
    svg.appendChild(sort);
    svg.appendChild(txt(420, 70, 'each splat:', 9));
    svg.appendChild(txt(420, 86, 'mu, R, s,', 9));
    svg.appendChild(txt(420, 100, 'alpha, SH', 9));
    svg.appendChild(txt(420, 124, 'rasterise,', 9));
    svg.appendChild(txt(420, 138, 'not march', 9));
    svg.appendChild(txt(14, 228, 'no MLP query per ray; project each blob to 2D and blend at 100+ fps', 9));
    host.appendChild(shell('3D GAUSSIAN SPLATTING', 'blobs project and blend, no ray marching', svg,
      'A scene is millions of 3D Gaussians, each carrying a centre, a rotation+scale covariance, an opacity, and view-dependent colour. Rendering projects every blob to a 2D ellipse, sorts them by depth, and alpha-composites front to back, the same blend NeRF needed hundreds of MLP queries to approximate. That is why splats render at 100+ fps and train in minutes.'));
  }

  // ── cv3-rectified-flow (23): straight line vs curved diffusion noise->data ───
  function rectifiedFlow(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var nx = 70, ny = 180, dx = 440, dy = 70;
    svg.appendChild(svgEl('circle', { cx: nx, cy: ny, r: '7', fill: MUTE }));
    svg.appendChild(txt(40, 205, 'x_T noise'));
    svg.appendChild(svgEl('circle', { cx: dx, cy: dy, r: '7', fill: BLUE }));
    svg.appendChild(txt(412, 60, 'x_0 data'));
    // curved DDPM trajectory (many small steps)
    var curve = 'M 70 180 C 120 60, 220 230, 300 90 S 400 140, 440 70';
    var cv = svgEl('path', { d: curve, fill: 'none', stroke: MUTE, 'stroke-width': '1.6', 'stroke-dasharray': '5 4', opacity: '0.7' });
    svg.appendChild(cv);
    svg.appendChild(txt(120, 130, 'DDPM: curved path, ~1000 steps', 10));
    // dot crawling the curve in many little hops
    var slow = svgEl('circle', { r: '4', fill: MUTE });
    var sm = svgEl('animateMotion', { dur: '5s', repeatCount: 'indefinite', path: curve, keyTimes: '0;0.1;0.2;0.3;0.4;0.5;0.6;0.7;0.8;0.9;1', keyPoints: '0;0.1;0.2;0.3;0.4;0.5;0.6;0.7;0.8;0.9;1', calcMode: 'discrete' });
    slow.appendChild(sm);
    svg.appendChild(slow);
    // straight rectified-flow line
    var line = 'M 70 180 L 440 70';
    var st = svgEl('path', { d: line, fill: 'none', stroke: BLUE, 'stroke-width': '2.4', 'stroke-dasharray': '388', 'stroke-dashoffset': '388' });
    st.appendChild(anim('stroke-dashoffset', '388;0;0', '5s', { keyTimes: '0;0.5;1' }));
    svg.appendChild(st);
    svg.appendChild(txt(250, 165, 'rectified flow: straight line, ~20 steps', 10));
    // a few big hops along the straight line
    var fast = svgEl('circle', { r: '5', fill: BLUE });
    var fm = svgEl('animateMotion', { dur: '5s', repeatCount: 'indefinite', path: line, keyTimes: '0;0.25;0.5;0.75;1', keyPoints: '0;0.25;0.5;0.75;1', calcMode: 'discrete' });
    fast.appendChild(fm);
    svg.appendChild(fast);
    host.appendChild(shell('RECTIFIED FLOW', 'straighten the path, sample in 20 steps', svg,
      'DDPM learns a curved trajectory from noise to data, so faithfully integrating it takes hundreds of small steps. Rectified flow trains the model to follow a straight line between the noise sample and the data point. A straight path needs far fewer integration steps, which is how SD3 and FLUX sample in 20 steps (or 1-4 when distilled) instead of 1000.'));
  }

  // ── cv3-open-vocab (24): a text prompt lights up matching objects in a scene ─
  function openVocab(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 230' });
    // prompt pill
    svg.appendChild(svgEl('rect', { x: 14, y: 18, width: 150, height: 26, rx: '13', fill: BLUE, opacity: '0.16', stroke: BLUE }));
    svg.appendChild(svgEl('text', { x: 26, y: 36, fill: BLUE, 'font-size': '13', 'font-family': 'monospace' }, [document.createTextNode('prompt: "orange"')]));
    // scene
    svg.appendChild(svgEl('rect', { x: 14, y: 56, width: 360, height: 160, fill: 'var(--bg-surface,#eee)', stroke: SOFT }));
    // objects: three oranges (match) and two distractors (apple, box)
    var objs = [
      [70, 110, 'orange', true], [150, 160, 'orange', true], [250, 100, 'orange', true],
      [320, 170, 'apple', false], [110, 190, 'box', false]
    ];
    objs.forEach(function (o, i) {
      var match = o[3];
      if (o[2] === 'box') {
        svg.appendChild(svgEl('rect', { x: o[0] - 16, y: o[1] - 16, width: 32, height: 32, fill: INK, opacity: '0.35' }));
      } else {
        svg.appendChild(svgEl('circle', { cx: o[0], cy: o[1], r: '18', fill: match ? WARN : MUTE, opacity: '0.4' }));
      }
      // mask outline that appears only on matches, with an instance id
      if (match) {
        var ring = svgEl('circle', { cx: o[0], cy: o[1], r: '22', fill: 'none', stroke: WARN, 'stroke-width': '2.4', 'stroke-dasharray': '138', 'stroke-dashoffset': '138' });
        ring.appendChild(anim('stroke-dashoffset', '138;138;0;0', '5s', { begin: (i * 0.25) + 's', keyTimes: '0;0.3;0.6;1' }));
        svg.appendChild(ring);
        var id = svgEl('text', { x: o[0], y: o[1] - 28, fill: WARN, 'font-size': '10', 'font-family': 'monospace', 'text-anchor': 'middle', opacity: '0' }, [document.createTextNode('#' + (i + 1))]);
        id.appendChild(anim('opacity', '0;0;1;1', '5s', { begin: (i * 0.25) + 's', keyTimes: '0;0.55;0.7;1' }));
        svg.appendChild(id);
      }
    });
    // single forward pass arrow
    svg.appendChild(txt(390, 80, 'one forward', 10));
    svg.appendChild(txt(390, 95, 'pass:', 10));
    svg.appendChild(txt(390, 120, 'all matching', 10));
    svg.appendChild(txt(390, 135, 'masks +', 10));
    svg.appendChild(txt(390, 150, 'instance ids', 10));
    svg.appendChild(txt(14, 227, 'no detector cascade — text in, every matching mask out', 9));
    host.appendChild(shell('SAM 3 · OPEN-VOCAB SEGMENTATION', 'a noun phrase selects every match', svg,
      'Promptable Concept Segmentation takes a short noun phrase and returns masks for every matching object plus instance IDs in one pass. The grey apple and box stay unselected; the three oranges get outlined and numbered. Earlier systems chained a text-grounded detector into a separate segmenter, accumulating error at the seam. SAM 3 collapses that cascade into a single model.'));
  }

  // ── cv3-track-assoc (27): detections in frame t match tracks from t-1 by IoU ─
  function trackAssoc(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    svg.appendChild(txt(14, 16, 'tracks at t-1 (solid) + detections at t (dashed), matched by IoU'));
    // three predicted track boxes (solid) with IDs, three detections (dashed) nearby
    var tracks = [[60, 60, 70, 60, '#1', BLUE], [220, 90, 64, 64, '#2', BLUE], [360, 70, 72, 58, '#3', BLUE]];
    var dets = [[70, 68, 70, 60], [230, 100, 64, 64], [372, 80, 72, 58]];
    tracks.forEach(function (t, i) {
      svg.appendChild(svgEl('rect', { x: t[0], y: t[1], width: t[2], height: t[3], fill: 'none', stroke: t[5], 'stroke-width': '2' }));
      svg.appendChild(svgEl('text', { x: t[0] + 4, y: t[1] - 4, fill: t[5], 'font-size': '11', 'font-family': 'monospace' }, [document.createTextNode(t[4])]));
      // detection slides from offset into overlap with its track (the match)
      var d = dets[i];
      var box = svgEl('rect', { x: d[0] + 26, y: d[1] + 22, width: d[2], height: d[3], fill: 'none', stroke: WARN, 'stroke-width': '1.6', 'stroke-dasharray': '5 3' });
      box.appendChild(anim('x', (d[0] + 26) + ';' + d[0] + ';' + d[0], '5s', { begin: (i * 0.15) + 's', keyTimes: '0;0.55;1' }));
      box.appendChild(anim('y', (d[1] + 22) + ';' + d[1] + ';' + d[1], '5s', { begin: (i * 0.15) + 's', keyTimes: '0;0.55;1' }));
      svg.appendChild(box);
      // a "matched" check appears once aligned, ID carried over
      var id = svgEl('text', { x: d[0] + d[2] / 2, y: d[1] + d[3] + 18, fill: WARN, 'font-size': '10', 'font-family': 'monospace', 'text-anchor': 'middle', opacity: '0' }, [document.createTextNode('keep ' + t[4])]);
      id.appendChild(anim('opacity', '0;0;1;1', '5s', { begin: (i * 0.15) + 's', keyTimes: '0;0.6;0.75;1' }));
      svg.appendChild(id);
    });
    // the cost matrix / Hungarian hint at the bottom
    svg.appendChild(txt(14, 196, 'IoU cost matrix -> Hungarian assignment -> persist IDs across frames', 10));
    var bx = 14, by = 206;
    var rr, cc;
    for (rr = 0; rr < 3; rr++) for (cc = 0; cc < 3; cc++) {
      var on = rr === cc;
      var cellr = svgEl('rect', { x: bx + cc * 18, y: by + rr * 9, width: 16, height: 7, fill: on ? BLUE : MUTE, opacity: '0' });
      cellr.appendChild(anim('opacity', '0;0;' + (on ? '0.9' : '0.2') + ';' + (on ? '0.9' : '0.2'), '5s', { keyTimes: '0;0.6;0.75;1' }));
      svg.appendChild(cellr);
    }
    host.appendChild(shell('MULTI-OBJECT TRACKING · ASSOCIATION', 'detections snap to tracks, IDs persist', svg,
      'Tracking-by-detection runs a detector every frame, then asks which new box is which old track. It scores every (track, detection) pair by IoU (often plus motion and appearance), solves the assignment with the Hungarian algorithm, and carries the matched ID forward. Unmatched detections start new tracks; unmatched tracks age out. The identity, not the box, is the product.'));
  }

  LF.register({
    'cv3-roialign-sampling': roialignSampling,
    'cv3-latent-compression': latentCompression,
    'cv3-ctc-collapse': ctcCollapse,
    'cv3-pose-heatmap': poseHeatmap,
    'cv3-gaussian-splat': gaussianSplat,
    'cv3-rectified-flow': rectifiedFlow,
    'cv3-open-vocab': openVocab,
    'cv3-track-assoc': trackAssoc
  });
})();
