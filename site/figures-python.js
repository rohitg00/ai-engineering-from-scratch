/* figures-python.js: animated lesson figures for the Python for AI Engineering
   lesson in Phase 00. Loads after lesson-figures.js and registers through
   window.LF.register. Vanilla ES5, no deps, theme via CSS vars. Animation is
   SMIL only (animate / animateTransform). Authoring is the same fenced block:
       ```figure
       s0-list-vs-generator
       ``` */
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
  var EASE = '0.23 1 0.32 1';

  function shell(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function txt(x, y, s, size, fill, anchor) {
    return svgEl('text', { x: x, y: y, 'font-family': 'var(--font-mono,monospace)', 'font-size': size || 11, fill: fill || MUTE, 'text-anchor': anchor || 'middle' }, [document.createTextNode(s)]);
  }
  function rect(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: 2, fill: fill || 'none', stroke: stroke || 'none', 'stroke-width': 1.4 });
  }
  function strip(x, y, cells, cw, h) {
    var d = '';
    for (var i = 1; i < cells; i++) { d += 'M' + (x + i * cw) + ' ' + y + ' L' + (x + i * cw) + ' ' + (y + h) + ' '; }
    return [rect(x, y, cells * cw, h, BG, INKS), svgEl('path', { d: d, fill: 'none', stroke: SOFT, 'stroke-width': 1 })];
  }
  function arrow(x1, x2, y) {
    return svgEl('path', { d: 'M' + x1 + ' ' + y + ' L' + x2 + ' ' + y + ' M' + (x2 - 6) + ' ' + (y - 5) + ' L' + x2 + ' ' + y + ' L' + (x2 - 6) + ' ' + (y + 5), fill: 'none', stroke: INKS, 'stroke-width': 1.5 });
  }
  function grow(x, y, w, h, fill, dur) {
    var g = svgEl('g', { transform: 'translate(' + x + ' ' + y + ')' });
    var r = rect(0, 0, w, h, fill);
    r.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', values: '0 1;0 1;1 1;1 1;0 1', keyTimes: '0;0.05;0.45;0.92;1', dur: dur, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0 0 1 1;0.45 0 0.55 1;0 0 1 1;0.4 0 1 1' }));
    g.appendChild(r);
    return g;
  }

  // ── s0-list-vs-generator: a list holds every row, a generator one batch ──
  // 13-python-for-ai-engineering
  function listVsGenerator(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '8s';
    var CW = 30, X0 = 30, MX = 330, MW = 160, H = 26;
    var AY = 70, BY = 162;

    svg.appendChild(txt(X0 + 4 * CW, 24, 'dataset on disk, 8 rows', 9, MUTE));
    svg.appendChild(txt(MX + MW / 2, 24, 'held in memory', 9, MUTE));

    svg.appendChild(txt(X0, AY - 10, 'rows = list(read_rows(path))', 10, INK, 'start'));
    strip(X0, AY, 8, CW, H).forEach(function (n) { svg.appendChild(n); });
    var readA = grow(X0, AY, 8 * CW, H, BP, D);
    readA.setAttribute('opacity', '0.25');
    svg.appendChild(readA);
    svg.appendChild(arrow(X0 + 8 * CW + 8, MX - 8, AY + H / 2));
    svg.appendChild(rect(MX, AY, MW, H, BG, INKS));
    var fillA = grow(MX, AY, MW, H, WARN, D);
    fillA.setAttribute('opacity', '0.55');
    svg.appendChild(fillA);
    svg.appendChild(txt(MX + MW / 2, AY + H + 16, '8 of 8 rows held', 9, WARN));
    var waitA = txt(MX + MW / 2, AY + H + 30, 'step 1 waits for every row', 9, INKS);
    waitA.setAttribute('opacity', '0');
    waitA.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;1;1;0', keyTimes: '0;0.45;0.5;0.92;1', dur: D, repeatCount: 'indefinite' }));
    svg.appendChild(waitA);

    svg.appendChild(txt(X0, BY - 10, 'for batch in batches(read_rows(path), 2):', 10, INK, 'start'));
    strip(X0, BY, 8, CW, H).forEach(function (n) { svg.appendChild(n); });
    var win = rect(X0, BY - 3, 2 * CW, H + 6, 'none', BP);
    win.setAttribute('stroke-width', '2.4');
    win.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;0 0;60 0;60 0;120 0;120 0;180 0;180 0;0 0', keyTimes: '0;0.12;0.2;0.34;0.42;0.56;0.64;0.92;1', dur: D, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1' }));
    svg.appendChild(win);
    svg.appendChild(arrow(X0 + 8 * CW + 8, MX - 8, BY + H / 2));
    svg.appendChild(rect(MX, BY, MW, H, BG, INKS));
    var fillB = rect(MX, BY, MW / 4, H, BP);
    fillB.setAttribute('opacity', '0.5');
    fillB.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.5;1;0.5;1;0.5;1;0.5;1;0.5', keyTimes: '0;0.04;0.2;0.24;0.42;0.46;0.64;0.68;1', dur: D, repeatCount: 'indefinite' }));
    svg.appendChild(fillB);
    svg.appendChild(txt(MX + MW / 2, BY + H + 16, '2 of 8 rows held', 9, BP));
    svg.appendChild(txt(MX + MW / 2, BY + H + 30, 'step 1 starts with batch 1', 9, INKS));

    svg.appendChild(txt(260, 242, 'same rows, same batches, different memory', 9, MUTE));
    shell(host, 'LIST VS GENERATOR', 'a list holds every row, a generator holds one batch', svg,
      'Both loops read the same eight rows. The list version reads every row into memory before the first training step starts. The generator version holds one batch of two rows, and the first step starts when that batch is ready. For a real dataset, the list needs memory for the whole file, and the generator needs memory for one batch.');
  }

  LF.register({
    's0-list-vs-generator': listVsGenerator
  });
})();
