/* figures-genai3.js: animated lesson figures for Phase 8 (generative AI) and
   Phase 5 (NLP). Loads after lesson-figures.js and registers through window.LF.
   No deps, ES5 only, theme via CSS vars. Animation is SMIL only (declarative),
   no JS loops, no real compute. Each figure is a single static SVG scene that
   the browser animates and headless / reduced-motion renders as a still frame. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  var BP = 'var(--blueprint,#3553ff)';
  var MUTE = 'var(--ink-mute,#999)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var WARN = 'var(--warn,#b8870f)';
  var INK = 'var(--ink,#1a1a1a)';

  function frame(host, label, hint, svg, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    if (a.keySplines && !a.calcMode) a.calcMode = 'spline';
    return svgEl('animate', a);
  }
  function txt(x, y, s, size, fill, anchor) {
    return svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-size': size || 11, fill: fill || MUTE, 'font-family': 'monospace' }, [document.createTextNode(s)]);
  }

  // ── gx-var-next-scale: next-scale prediction, grids growing 1→2→4→8 ─────────
  function varNextScale(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var scales = [1, 2, 4, 8];
    var bx = [40, 150, 280, 430], by = 70, size = 96;
    scales.forEach(function (n, si) {
      var x0 = bx[si], cell = size / n;
      // appear in scale order: stage si lights at fraction si/4
      var t0 = si / 4, t1 = (si + 0.5) / 4;
      var g = svgEl('g', {});
      // frame
      g.appendChild(svgEl('rect', { x: x0, y: by, width: size, height: size, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
      var r, c;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
        var rect = svgEl('rect', { x: (x0 + c * cell).toFixed(1), y: (by + r * cell).toFixed(1), width: (cell - 1.2).toFixed(1), height: (cell - 1.2).toFixed(1), fill: BP, opacity: '0' });
        rect.appendChild(anim('opacity', '0;0;0.85;0.85', '8s', { keyTimes: '0;' + t0.toFixed(3) + ';' + t1.toFixed(3) + ';1', keySplines: '0 0 1 1;.4 0 .2 1;0 0 1 1' }));
        g.appendChild(rect);
      }
      g.appendChild(txt(x0 + size / 2, by + size + 16, n + 'x' + n, 11, MUTE));
      svg.appendChild(g);
      // conditioning arrow to next scale
      if (si < scales.length - 1) {
        var ax = x0 + size + 4, axe = bx[si + 1] - 4;
        var ar = svgEl('line', { x1: ax, y1: by + size / 2, x2: axe, y2: by + size / 2, stroke: MUTE, 'stroke-width': '1.6', 'marker-end': 'none', opacity: '0.25' });
        ar.appendChild(anim('opacity', '0.25;0.25;1;0.25', '8s', { keyTimes: '0;' + t1.toFixed(3) + ';' + ((si + 1) / 4).toFixed(3) + ';1', keySplines: '0 0 1 1;.4 0 .2 1;0 0 1 1' }));
        svg.appendChild(ar);
        svg.appendChild(svgEl('polygon', { points: (axe - 6) + ',' + (by + size / 2 - 4) + ' ' + axe + ',' + (by + size / 2) + ' ' + (axe - 6) + ',' + (by + size / 2 + 4), fill: MUTE }));
      }
    });
    svg.appendChild(txt(W / 2, 30, 'predict each scale in one pass, conditioned on all coarser scales', 11, MUTE));
    frame(host, 'NEXT-SCALE PREDICTION', 'coarse to fine', svg,
      'VAR generates an image as a sequence of resolutions, not pixels in raster order. It predicts a 1x1 token summary, then a 2x2 grid, then 4x4, then 8x8, each scale produced in a single parallel pass and conditioned on every coarser scale before it. The generation-order problem of pixel-by-pixel models disappears.');
  }

  // ── gx-fid-distributions: FID as distance between two feature clouds ────────
  function fidDistributions(host) {
    var W = 520, H = 240, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(svgEl('rect', { x: 30, y: 40, width: W - 60, height: H - 80, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    svg.appendChild(txt(40, 30, 'Inception feature space (2 of 2048 dims)', 11, MUTE, 'start'));
    // real cloud: fixed Gaussian-ish blob, centered left-low; gen cloud animates from far to overlapping
    var realC = [180, 150], genStart = [400, 90], genEnd = [205, 138];
    function blob(cx, cy, st, pts) {
      var g = svgEl('g', {}), i;
      var off = [[0, 0], [22, -14], [-18, 16], [30, 18], [-26, -20], [12, 28], [-34, 4], [8, -30]];
      for (i = 0; i < pts; i++) {
        g.appendChild(svgEl('circle', { cx: (cx + off[i][0]).toFixed(1), cy: (cy + off[i][1]).toFixed(1), r: '4', fill: st, opacity: '0.8' }));
      }
      return g;
    }
    svg.appendChild(blob(realC[0], realC[1], BP, 8));
    // generated blob translated via animateTransform from start offset to overlap
    var genG = blob(genEnd[0], genEnd[1], WARN, 8);
    var dx0 = genStart[0] - genEnd[0], dy0 = genStart[1] - genEnd[1];
    genG.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: dx0 + ' ' + dy0 + ';0 0;0 0;' + dx0 + ' ' + dy0, keyTimes: '0;0.45;0.7;1', dur: '9s', repeatCount: 'indefinite', calcMode: 'spline', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    svg.appendChild(genG);
    // mean-to-mean distance line
    var line = svgEl('line', { x1: realC[0], y1: realC[1], x2: genStart[0], y2: genStart[1], stroke: INK, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    line.appendChild(anim('x2', genStart[0] + ';' + genEnd[0] + ';' + genEnd[0] + ';' + genStart[0], '9s', { keyTimes: '0;0.45;0.7;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    line.appendChild(anim('y2', genStart[1] + ';' + genEnd[1] + ';' + genEnd[1] + ';' + genStart[1], '9s', { keyTimes: '0;0.45;0.7;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    svg.appendChild(line);
    svg.appendChild(svgEl('circle', { cx: realC[0], cy: realC[1], r: '3', fill: INK }));
    svg.appendChild(txt(110, 215, 'real (blue)   generated (amber)', 11, MUTE, 'start'));
    var fidLabel = txt(W - 40, 215, 'FID = high', 12, WARN, 'end');
    fidLabel.appendChild(svgEl('animate', { attributeName: 'fill', values: WARN + ';' + BP + ';' + BP + ';' + WARN, keyTimes: '0;0.45;0.7;1', dur: '9s', repeatCount: 'indefinite' }));
    svg.appendChild(fidLabel);
    frame(host, 'FRECHET INCEPTION DISTANCE', 'two distributions', svg,
      'FID does not score images one by one. It fits a Gaussian to the real images and another to the generated images in Inception feature space, then measures the distance between those two distributions through their means and covariances. As the generated cloud moves to overlap the real one, the distance, and the FID, falls toward zero.');
  }

  // ── gx-patchgan: discriminator scores a grid of overlapping patches ─────────
  function patchgan(host) {
    var W = 520, H = 240, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var ix = 60, iy = 50, isz = 150, n = 4;
    svg.appendChild(txt(ix + isz / 2, 36, 'generated image y  (conditioned on input x)', 11, MUTE));
    svg.appendChild(svgEl('rect', { x: ix, y: iy, width: isz, height: isz, fill: BP, opacity: '0.06', stroke: SOFT, 'stroke-width': '1' }));
    var cell = isz / n, r, c, k = 0;
    // verdict grid on the right; each patch lights as the receptive-field box sweeps
    var gx = 330, gy = 50, gcell = 30;
    var rf = svgEl('rect', { x: ix, y: iy, width: cell + 8, height: cell + 8, fill: 'none', stroke: WARN, 'stroke-width': '1.8' });
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
      var t = k / (n * n);
      var verdict = svgEl('rect', { x: gx + c * gcell, y: gy + r * gcell, width: gcell - 2, height: gcell - 2, fill: BP, opacity: '0.1', stroke: SOFT, 'stroke-width': '0.8' });
      verdict.appendChild(anim('opacity', '0.1;0.1;0.85;0.85', '8s', { keyTimes: '0;' + t.toFixed(3) + ';' + Math.min(1, t + 0.05).toFixed(3) + ';1', keySplines: '0 0 1 1;.3 0 .2 1;0 0 1 1' }));
      svg.appendChild(verdict);
      k++;
    }
    // sweeping receptive-field marker over the image, cell by cell
    var rx = [], ry = [], kt = [];
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) { rx.push((ix + c * cell - 4).toFixed(1)); ry.push((iy + r * cell - 4).toFixed(1)); kt.push((rx.length - 1) / (n * n)); }
    kt.push(1); rx.push(rx[rx.length - 1]); ry.push(ry[ry.length - 1]);
    rf.appendChild(svgEl('animate', { attributeName: 'x', values: rx.join(';'), keyTimes: kt.join(';'), dur: '8s', repeatCount: 'indefinite', calcMode: 'discrete' }));
    rf.appendChild(svgEl('animate', { attributeName: 'y', values: ry.join(';'), keyTimes: kt.join(';'), dur: '8s', repeatCount: 'indefinite', calcMode: 'discrete' }));
    svg.appendChild(rf);
    svg.appendChild(txt(gx + (n * gcell) / 2 - 1, gy + n * gcell + 18, 'NxN real/fake grid', 11, MUTE));
    svg.appendChild(txt(ix + isz / 2, iy + isz + 18, '70x70 receptive field', 11, WARN));
    frame(host, 'PATCHGAN DISCRIMINATOR', 'local realism', svg,
      'A PatchGAN does not output one real/fake score for the whole image. It slides a fixed receptive field across the output and judges each local patch independently, producing an NxN grid of verdicts that is then averaged. Realism is treated as a local property, which makes the discriminator smaller, faster, and sharper on high-frequency texture.');
  }

  // ── gx-stylegan-mapping: z entangled, w disentangled, injected per scale ────
  function styleganMapping(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    // left: entangled z (tangled wandering path); MLP; disentangled w (axis-aligned); injection ticks
    svg.appendChild(txt(70, 30, 'Z: entangled', 11, MUTE));
    svg.appendChild(txt(250, 30, 'f (8-layer MLP)', 11, BP));
    svg.appendChild(txt(440, 30, 'W: disentangled', 11, MUTE));
    // entangled blob: a knotted path
    svg.appendChild(svgEl('rect', { x: 30, y: 50, width: 110, height: 110, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    var knot = svgEl('path', { d: 'M50 70 C 120 60, 60 130, 110 120 S 50 150, 120 90 S 70 70, 100 140', fill: 'none', stroke: BP, 'stroke-width': '1.8', 'stroke-dasharray': '260', 'stroke-dashoffset': '260' });
    knot.appendChild(anim('stroke-dashoffset', '260;0;0;260', '8s', { keyTimes: '0;0.35;0.7;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    svg.appendChild(knot);
    // mapping arrow
    svg.appendChild(svgEl('line', { x1: 145, y1: 105, x2: 200, y2: 105, stroke: MUTE, 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('rect', { x: 200, y: 78, width: 90, height: 54, fill: BP, opacity: '0.08', stroke: SOFT, 'stroke-width': '1' }));
    var li;
    for (li = 0; li < 4; li++) svg.appendChild(svgEl('line', { x1: 210, y1: 88 + li * 11, x2: 280, y2: 88 + li * 11, stroke: BP, 'stroke-width': '1', opacity: '0.5' }));
    svg.appendChild(svgEl('line', { x1: 290, y1: 105, x2: 345, y2: 105, stroke: MUTE, 'stroke-width': '1.4' }));
    // disentangled W: two clean orthogonal axes (pose / lighting)
    svg.appendChild(svgEl('rect', { x: 350, y: 50, width: 110, height: 110, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    var axH = svgEl('line', { x1: 360, y1: 105, x2: 360, y2: 105, stroke: BP, 'stroke-width': '2' });
    axH.appendChild(anim('x2', '360;450;450;360', '8s', { keyTimes: '0;0.5;0.7;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    var axV = svgEl('line', { x1: 405, y1: 155, x2: 405, y2: 155, stroke: WARN, 'stroke-width': '2' });
    axV.appendChild(anim('y2', '155;60;60;155', '8s', { keyTimes: '0;0.5;0.7;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    svg.appendChild(axH); svg.appendChild(axV);
    svg.appendChild(txt(405, 178, 'pose axis', 9, BP));
    // injection ticks down the synthesis stack
    var sy;
    for (sy = 0; sy < 4; sy++) {
      var ty = 200 + 0; // single row of resolution blocks
      var rect = svgEl('rect', { x: 60 + sy * 100, y: 195, width: 70, height: 32, fill: BP, opacity: '0.08', stroke: SOFT, 'stroke-width': '1' });
      svg.appendChild(rect);
      svg.appendChild(txt(95 + sy * 100, 215, ['4x4', '16x16', '64x64', '1024'][sy], 10, MUTE));
      var inj = svgEl('circle', { cx: 95 + sy * 100, cy: 195, r: '3', fill: WARN, opacity: '0.2' });
      inj.appendChild(anim('opacity', '0.2;0.2;1;0.2', '8s', { keyTimes: '0;' + (0.55 + sy * 0.08).toFixed(2) + ';' + (0.6 + sy * 0.08).toFixed(2) + ';1', keySplines: '0 0 1 1;.3 0 .2 1;0 0 1 1' }));
      svg.appendChild(inj);
    }
    svg.appendChild(txt(W / 2, 245, 'w injected via AdaIN at every resolution', 10, WARN));
    frame(host, 'STYLEGAN MAPPING', 'untangle then inject', svg,
      'A plain generator feeds the noise vector z straight into the network, so every factor of variation stays tangled together. StyleGAN first maps z through an 8-layer MLP to an intermediate space W whose axes line up with meaningful factors like pose and lighting, then injects that w through AdaIN at every resolution. Disentangling first is what made style mixing and editing possible.');
  }

  // ── gx-hybrid-retrieval: sparse + dense lists fused by RRF, then reranked ───
  function hybridRetrieval(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    function col(x, title, items, color) {
      svg.appendChild(txt(x + 30, 38, title, 11, color));
      items.forEach(function (lab, i) {
        svg.appendChild(svgEl('rect', { x: x, y: 50 + i * 26, width: 60, height: 20, fill: color, opacity: (0.5 - i * 0.08).toFixed(2), stroke: SOFT, 'stroke-width': '0.6' }));
        svg.appendChild(txt(x + 30, 64 + i * 26, lab, 9, INK));
      });
    }
    col(30, 'BM25 (sparse)', ['D7', 'D2', 'D9', 'D4'], BP);
    col(130, 'dense', ['D2', 'D5', 'D7', 'D1'], MUTE);
    // RRF fused column (center) fades in
    var fg = svgEl('g', { opacity: '0' });
    fg.appendChild(anim('opacity', '0;0;1;1', '8s', { keyTimes: '0;0.35;0.5;1', keySplines: '0 0 1 1;.3 0 .2 1;0 0 1 1' }));
    fg.appendChild(txt(290, 38, 'RRF fusion', 11, WARN));
    ['D2', 'D7', 'D5', 'D9'].forEach(function (lab, i) {
      fg.appendChild(svgEl('rect', { x: 260, y: 50 + i * 26, width: 60, height: 20, fill: WARN, opacity: (0.5 - i * 0.08).toFixed(2), stroke: SOFT, 'stroke-width': '0.6' }));
      fg.appendChild(txt(290, 64 + i * 26, lab, 9, INK));
    });
    svg.appendChild(fg);
    // merge arrows from both lists into fused
    [70, 170].forEach(function (sx) {
      var ar = svgEl('line', { x1: sx + 20, y1: 100, x2: 255, y2: 90, stroke: SOFT, 'stroke-width': '1' });
      ar.appendChild(anim('opacity', '0;0;1;1', '8s', { keyTimes: '0;0.3;0.45;1' }));
      svg.appendChild(ar);
    });
    // cross-encoder rerank column fades in last, reordered top result highlighted
    var rg = svgEl('g', { opacity: '0' });
    rg.appendChild(anim('opacity', '0;0;0;1;1', '8s', { keyTimes: '0;0.55;0.65;0.78;1', keySplines: '0 0 1 1;0 0 1 1;.3 0 .2 1;0 0 1 1' }));
    rg.appendChild(txt(430, 38, 'rerank top-5', 11, BP));
    ['D5', 'D2', 'D7'].forEach(function (lab, i) {
      rg.appendChild(svgEl('rect', { x: 400, y: 50 + i * 26, width: 60, height: 20, fill: i === 0 ? BP : SOFT, opacity: i === 0 ? '0.7' : '0.3', stroke: SOFT, 'stroke-width': '0.6' }));
      rg.appendChild(txt(430, 64 + i * 26, lab, 9, i === 0 ? 'var(--bg,#fff)' : INK));
    });
    svg.appendChild(rg);
    var ar2 = svgEl('line', { x1: 322, y1: 90, x2: 395, y2: 75, stroke: SOFT, 'stroke-width': '1' });
    ar2.appendChild(anim('opacity', '0;0;0;1', '8s', { keyTimes: '0;0.55;0.65;1' }));
    svg.appendChild(ar2);
    svg.appendChild(txt(W / 2, 232, 'each layer catches the failures of the one before', 11, MUTE));
    frame(host, 'HYBRID RETRIEVAL', 'sparse + dense + rerank', svg,
      'Production retrieval is a chain, not a single method. Sparse BM25 nails exact keywords; dense vectors catch paraphrase; Reciprocal Rank Fusion merges the two ranked lists using only positions, so their incompatible score scales do not matter; a cross-encoder then reranks the survivors by reading each query and document together. The final top result can differ from either input list.');
  }

  // ── gx-matryoshka: truncate embedding dimensions, vector shrinks ────────────
  function matryoshka(host) {
    var W = 520, H = 230, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var x0 = 40, y0 = 70, full = 440, h = 34, dims = 64;
    // full-width vector of cells; a cut line sweeps left, cells past it dim out
    svg.appendChild(txt(W / 2, 40, 'one Matryoshka vector, truncated to a smaller prefix', 11, MUTE));
    var i, cw = full / dims;
    for (i = 0; i < dims; i++) {
      var cell = svgEl('rect', { x: (x0 + i * cw).toFixed(1), y: y0, width: (cw - 0.6).toFixed(1), height: h, fill: BP });
      // each cell's "kept" fraction: dims sweep from full (1.0) down to 1/8 (0.125) and back
      var keep = (i + 1) / dims; // fraction of vector that includes this cell
      // cut sweeps 1 -> .125 over t in [0,0.4], holds, then returns over [0.6,1];
      // each cell dims when the cut passes it and re-lights on the way back
      var lo = '0.1', hiOp = '0.85';
      if (keep <= 0.125) {
        cell.setAttribute('opacity', hiOp);
      } else {
        var fk = (keep - 0.125) / 0.875;
        var tDim = 0.4 * (1 - fk);
        var tRise = Math.min(0.6 + 0.4 * fk, 0.96);
        var op = hiOp + ';' + hiOp + ';' + lo + ';' + lo + ';' + hiOp + ';' + hiOp;
        var kt = '0;' + tDim.toFixed(3) + ';' + (tDim + 0.03).toFixed(3) + ';' + tRise.toFixed(3) + ';' + (tRise + 0.03).toFixed(3) + ';1';
        cell.appendChild(anim('opacity', op, '7s', { keyTimes: kt }));
      }
      svg.appendChild(cell);
    }
    svg.appendChild(svgEl('rect', { x: x0, y: y0, width: full, height: h, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    // sweeping cut line
    var cut = svgEl('line', { x1: x0 + full, y1: y0 - 8, x2: x0 + full, y2: y0 + h + 8, stroke: WARN, 'stroke-width': '2' });
    cut.appendChild(anim('x1', (x0 + full) + ';' + (x0 + full / 8) + ';' + (x0 + full / 8) + ';' + (x0 + full), '7s', { keyTimes: '0;0.4;0.6;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    cut.appendChild(anim('x2', (x0 + full) + ';' + (x0 + full / 8) + ';' + (x0 + full / 8) + ';' + (x0 + full), '7s', { keyTimes: '0;0.4;0.6;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    svg.appendChild(cut);
    var lbl = txt(x0 + full + 4, y0 + h + 28, '3072 dims', 11, WARN, 'middle');
    lbl.appendChild(anim('x', (x0 + full) + ';' + (x0 + full / 8) + ';' + (x0 + full / 8) + ';' + (x0 + full), '7s', { keyTimes: '0;0.4;0.6;1', keySplines: '.4 0 .2 1;0 0 1 1;.4 0 .2 1' }));
    svg.appendChild(lbl);
    svg.appendChild(txt(x0, y0 + h + 28, 'prefix kept', 11, MUTE, 'start'));
    svg.appendChild(txt(W / 2, 200, 'storage scales with kept dimensions; quality degrades gracefully', 11, MUTE));
    frame(host, 'MATRYOSHKA TRUNCATION', 'shed dimensions', svg,
      'A Matryoshka-trained embedding packs the most important information into its earliest dimensions. You can keep only a prefix of the vector, slicing 3072 floats down to a few hundred, and still retrieve well. Truncation cuts index storage several-fold while quality falls off gradually rather than collapsing, so you tune the dimension budget to your cost target.');
  }

  // ── gx-entity-linking: mention → candidate KB entries → context disambiguation
  function entityLinking(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(txt(70, 36, 'mention', 11, MUTE));
    svg.appendChild(svgEl('rect', { x: 30, y: 48, width: 90, height: 40, fill: BP, opacity: '0.12', stroke: SOFT, 'stroke-width': '1' }));
    svg.appendChild(txt(75, 73, '"Jordan"', 12, INK));
    svg.appendChild(txt(75, 120, 'context: beat the press', 9, MUTE));
    var cands = ['Q41421  M. Jordan (NBA)', 'Q44437  M.B. Jordan (actor)', 'Q810  Jordan (country)', 'Q3308285  M.I. Jordan (ML)'];
    var cy = [40, 90, 140, 190], cx = 250, correct = 0;
    cands.forEach(function (lab, i) {
      // candidate generation: all appear; then disambiguation keeps #0, dims rest
      var box = svgEl('rect', { x: cx, y: cy[i], width: 230, height: 34, fill: BP, opacity: '0.1', stroke: SOFT, 'stroke-width': '1' });
      var t0 = 0.2 + i * 0.06;
      box.appendChild(anim('opacity', '0;0;0.18;0.18;' + (i === correct ? '0.7' : '0.06') + ';' + (i === correct ? '0.7' : '0.06'),
        '8s', { keyTimes: '0;' + t0.toFixed(2) + ';' + (t0 + 0.05).toFixed(2) + ';0.6;0.72;1', keySplines: '0 0 1 1;.3 0 .2 1;0 0 1 1;.3 0 .2 1;0 0 1 1' }));
      svg.appendChild(box);
      var t = txt(cx + 12, cy[i] + 22, lab, 10, INK, 'start');
      svg.appendChild(t);
      // edge from mention to candidate
      var e = svgEl('line', { x1: 122, y1: 68, x2: cx, y2: cy[i] + 17, stroke: SOFT, 'stroke-width': '1', opacity: '0' });
      e.appendChild(anim('opacity', '0;0;0.6;0.6', '8s', { keyTimes: '0;' + t0.toFixed(2) + ';' + (t0 + 0.05).toFixed(2) + ';1' }));
      svg.appendChild(e);
    });
    // checkmark tick on the winner
    var ok = svgEl('circle', { cx: cx + 245, cy: cy[correct] + 17, r: '7', fill: BP, opacity: '0' });
    ok.appendChild(anim('opacity', '0;0;0;1;1', '8s', { keyTimes: '0;0.6;0.7;0.78;1' }));
    svg.appendChild(ok);
    var okt = txt(cx + 245, cy[correct] + 21, '✓', 11, 'var(--bg,#fff)', 'middle');
    okt.appendChild(anim('opacity', '0;0;0;1;1', '8s', { keyTimes: '0;0.6;0.7;0.78;1' }));
    svg.appendChild(okt);
    svg.appendChild(txt(135, 235, 'generate candidates, then disambiguate by context', 11, MUTE, 'start'));
    frame(host, 'ENTITY LINKING', 'candidates then pick', svg,
      'Entity linking runs in two stages. Candidate generation pulls every knowledge-base entry a surface form like "Jordan" could refer to. Disambiguation then scores each candidate against the surrounding context and keeps one. Here the sports context resolves the mention to the basketball entry while the actor, country, and ML-professor candidates fade out.');
  }

  // ── gx-niah-decay: needle accuracy decays with depth and context length ─────
  function niahDecay(host) {
    var W = 520, H = 240, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var hx = 40, hy = 50, hw = 300, hh = 150;
    svg.appendChild(txt(hx + hw / 2, 36, 'haystack: context grows left to right', 11, MUTE));
    // haystack body
    svg.appendChild(svgEl('rect', { x: hx, y: hy, width: hw, height: hh, fill: BP, opacity: '0.06', stroke: SOFT, 'stroke-width': '1' }));
    // faint text lines
    var ln;
    for (ln = 0; ln < 9; ln++) svg.appendChild(svgEl('line', { x1: hx + 10, y1: hy + 14 + ln * 16, x2: hx + hw - 10, y2: hy + 14 + ln * 16, stroke: MUTE, 'stroke-width': '1', opacity: '0.22' }));
    // the needle: a marker that moves deeper (rightward + downward) over time
    var needle = svgEl('rect', { x: hx + 30, y: hy + 20, width: 46, height: 14, fill: WARN });
    needle.appendChild(anim('x', (hx + 20) + ';' + (hx + hw - 70) + ';' + (hx + 20), '10s', { keyTimes: '0;0.5;1', keySplines: '.4 0 .2 1;.4 0 .2 1' }));
    needle.appendChild(anim('y', (hy + 18) + ';' + (hy + hh - 34) + ';' + (hy + 18), '10s', { keyTimes: '0;0.5;1', keySplines: '.4 0 .2 1;.4 0 .2 1' }));
    svg.appendChild(needle);
    svg.appendChild(txt(hx + 53, hy + 30, 'needle', 8, 'var(--bg,#fff)'));
    // accuracy gauge on the right: bar height drops as needle goes deeper
    var gx = 400, gtop = 50, gh = 150, gw = 50;
    svg.appendChild(svgEl('rect', { x: gx, y: gtop, width: gw, height: gh, fill: 'none', stroke: SOFT, 'stroke-width': '1' }));
    var fill = svgEl('rect', { x: gx, y: gtop, width: gw, height: gh, fill: BP, opacity: '0.7' });
    // y and height co-animate: high accuracy (full) -> low (short) -> high
    fill.appendChild(anim('y', gtop + ';' + (gtop + gh * 0.72) + ';' + gtop, '10s', { keyTimes: '0;0.5;1', keySplines: '.4 0 .2 1;.4 0 .2 1' }));
    fill.appendChild(anim('height', gh + ';' + (gh * 0.28) + ';' + gh, '10s', { keyTimes: '0;0.5;1', keySplines: '.4 0 .2 1;.4 0 .2 1' }));
    fill.appendChild(svgEl('animate', { attributeName: 'fill', values: BP + ';' + WARN + ';' + BP, keyTimes: '0;0.5;1', dur: '10s', repeatCount: 'indefinite' }));
    svg.appendChild(fill);
    svg.appendChild(txt(gx + gw / 2, gtop + gh + 18, 'recall accuracy', 10, MUTE));
    svg.appendChild(txt(hx + hw / 2, hy + hh + 24, 'advertised context is not all usable', 11, MUTE));
    frame(host, 'NEEDLE IN A HAYSTACK', 'depth vs recall', svg,
      'A needle test plants a single fact at a controlled depth in a long context and asks the model to retrieve it. Recall is near-perfect for shallow needles in short contexts, but as the fact sits deeper inside a longer haystack the accuracy gauge falls. The advertised context window is rarely the usable one, which is why depth-by-length sweeps matter.');
  }

  LF.register({
    'gx-var-next-scale': varNextScale,
    'gx-fid-distributions': fidDistributions,
    'gx-patchgan': patchgan,
    'gx-stylegan-mapping': styleganMapping,
    'gx-hybrid-retrieval': hybridRetrieval,
    'gx-matryoshka': matryoshka,
    'gx-entity-linking': entityLinking,
    'gx-niah-decay': niahDecay
  });
})();
