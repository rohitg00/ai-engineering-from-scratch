/* figures-mcpa-certifications.js: mechanism figures for the MCPA certification
   curriculum. Loads after lesson-figures.js and registers through window.LF.
   Vanilla ES5, no dependencies. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)';
  var SOFT = 'var(--ink-soft,#555)';
  var MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)';
  var BG = 'var(--bg,#fafaf5)';
  var SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)';
  var ERR = '#c94a34';
  var EASE = '0.23 1 0.32 1';
  var WIN = '0 0 1 1;' + EASE + ';0 0 1 1;0.4 0 1 1';
  var MID = { 'text-anchor': 'middle' };
  var BOLD = { 'font-weight': 700 };
  var DASH = { 'stroke-dasharray': '4 3' };

  function num(v) { return String(Math.round(v * 1000) / 1000); }
  function extend(target, extra) {
    for (var key in extra) target[key] = extra[key];
    return target;
  }
  function times(a, b, c) { return '0;' + num(a) + ';' + num(b) + ';' + num(c) + ';1'; }

  function anim(attr, values, D, extra) {
    return svgEl('animate', extend({ attributeName: attr, values: values, dur: D + 's', repeatCount: 'indefinite' }, extra));
  }
  function stage(w, h) {
    return svgEl('svg', { viewBox: '0 0 ' + w + ' ' + h, 'font-family': 'var(--font-mono,monospace)', 'font-size': 11 });
  }
  function grp(kids, attrs) { return svgEl('g', attrs || {}, kids); }
  function txt(x, y, s, fill, attrs) {
    return svgEl('text', extend({ x: x, y: y, fill: fill || INK }, attrs), [document.createTextNode(s)]);
  }
  function rct(x, y, w, h, stroke, fill, attrs) {
    return svgEl('rect', extend({ x: x, y: y, width: w, height: h, rx: 4, fill: fill || SURF, stroke: stroke || RULE }, attrs));
  }
  function box(x, y, w, h, title, sub, stroke, fill) {
    var g = grp([rct(x, y, w, h, stroke, fill)]);
    if (sub) {
      g.appendChild(txt(x + 10, y + h / 2 - 3, title));
      g.appendChild(txt(x + 10, y + h / 2 + 12, sub, MUTE));
    } else {
      g.appendChild(txt(x + 10, y + h / 2 + 4, title));
    }
    return g;
  }
  function ln(x1, y1, x2, y2, stroke, attrs) {
    return svgEl('line', extend({ x1: x1, y1: y1, x2: x2, y2: y2, stroke: stroke || MUTE, 'stroke-width': 1.4 }, attrs));
  }
  function pth(d, stroke, attrs) {
    return svgEl('path', extend({ d: d, fill: 'none', stroke: stroke || MUTE, 'stroke-width': 1.4 }, attrs));
  }
  function head(x, y, deg, fill) {
    return svgEl('path', { d: 'M0 0L-8 -4L-8 4Z', fill: fill || BP, transform: 'translate(' + num(x) + ' ' + num(y) + ') rotate(' + num(deg) + ')' });
  }
  function arrow(points, color, attrs) {
    var last = points[points.length - 1];
    var prev = points[points.length - 2];
    var dx = last[0] - prev[0];
    var dy = last[1] - prev[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    var d = '';
    var total = 0;
    for (var i = 0; i < points.length; i++) {
      var p = i === points.length - 1 ? [last[0] - dx / len * 6, last[1] - dy / len * 6] : points[i];
      d += (i ? 'L' : 'M') + num(p[0]) + ' ' + num(p[1]);
      if (i) total += Math.sqrt(Math.pow(p[0] - points[i - 1][0], 2) + Math.pow(p[1] - points[i - 1][1], 2));
    }
    var g = grp([]);
    g.line = g.appendChild(pth(d, color || BP, attrs));
    g.tip = g.appendChild(head(last[0], last[1], Math.atan2(dy, dx) * 180 / Math.PI, color || BP));
    g.len = total;
    return g;
  }

  function show(node, D, a, b, c) {
    node.setAttribute('opacity', '0');
    node.appendChild(anim('opacity', '0;0;1;1;0', D, { calcMode: 'spline', keyTimes: times(a, b || a + 0.06, c || 0.94), keySplines: WIN }));
    return node;
  }
  function pop(kids, x, y, D, a, b, c) {
    b = b || a + 0.07;
    c = c || 0.94;
    var mid = grp([grp(kids, { transform: 'translate(' + -x + ' ' + -y + ')' })]);
    mid.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', values: '0.95;0.95;1;1;0.95', dur: D + 's', repeatCount: 'indefinite', calcMode: 'spline', keyTimes: times(a, b, c), keySplines: WIN }));
    return show(grp([mid], { transform: 'translate(' + x + ' ' + y + ')' }), D, a, b, c);
  }
  function grow(kids, x, y, D, a, b, c, sideways) {
    b = b || a + 0.08;
    c = c || 0.94;
    var from = sideways ? '0.001 1' : '1 0.001';
    var mid = grp([grp(kids, { transform: 'translate(' + -x + ' ' + -y + ')' })]);
    mid.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', values: from + ';' + from + ';1 1;1 1;' + from, dur: D + 's', repeatCount: 'indefinite', calcMode: 'spline', keyTimes: times(a, b, c), keySplines: WIN }));
    return grp([mid], { transform: 'translate(' + x + ' ' + y + ')' });
  }
  function slide(node, dx, dy, D, a, b) {
    node.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 0;0 0;' + dx + ' ' + dy + ';' + dx + ' ' + dy, dur: D + 's', repeatCount: 'indefinite', keyTimes: '0;' + num(a) + ';' + num(b) + ';1' }));
    return node;
  }
  function draw(node, len, D, a, b, c) {
    node.setAttribute('stroke-dasharray', num(len));
    node.appendChild(anim('stroke-dashoffset', num(len) + ';' + num(len) + ';0;0;' + num(len), D, { calcMode: 'spline', keyTimes: times(a, b, c || 0.94), keySplines: '0 0 1 1;0 0 1 1;0 0 1 1;0.4 0 1 1' }));
    return node;
  }
  function route(points) {
    var d = '';
    for (var i = 0; i < points.length; i++) d += (i ? 'L' : 'M') + num(points[i][0]) + ' ' + num(points[i][1]);
    return d;
  }
  function packet(d, D, a, b, color, label) {
    var kids;
    if (label) {
      var w = label.length * 6.6 + 14;
      kids = [rct(-w / 2, -8, w, 16, color || BP, BG, { rx: 8 }), txt(0, 4, label, color || BP, MID)];
    } else {
      kids = [svgEl('circle', { r: 4.5, fill: color || BP, stroke: BG, 'stroke-width': 1.5 })];
    }
    var t = '0;' + num(a) + ';' + num(b) + ';1';
    var g = grp(kids, { opacity: '0' });
    g.appendChild(anim('opacity', '0;1;0;0', D, { calcMode: 'discrete', keyTimes: t }));
    g.appendChild(svgEl('animateMotion', { path: d, dur: D + 's', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: t }));
    return g;
  }
  function send(points, D, a, b, color, attrs, cargo) {
    var g = arrow(points, color, attrs);
    if (attrs && attrs['stroke-dasharray']) show(g.line, D, a, a + 0.04);
    else draw(g.line, g.len, D, a, b);
    show(g.tip, D, b - 0.02, b);
    if (cargo !== null) g.appendChild(packet(route(points), D, a, b, color, cargo));
    return g;
  }
  function spot(x, y, w, h, D, a, b, color, attrs) {
    var r = rct(x, y, w, h, color || BP, color || BP, extend({ 'fill-opacity': 0.1, 'stroke-width': 2, opacity: '0' }, attrs));
    r.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;' + num(a) + ';' + num(a + 0.03) + ';' + num(b) + ';' + num(b + 0.05) + ';1' }));
    return r;
  }
  function card(host, D, svg, label, hint, desc, caption) {
    if (!document.getElementById('mf-styles')) {
      document.head.appendChild(el('style', { id: 'mf-styles' }, ['@media(max-width:640px){.mf .lf-head{flex-direction:column;align-items:flex-start;gap:4px}.mf .lf-body{overflow-x:auto;padding:12px 8px;background:linear-gradient(90deg,var(--bg,#fafaf5) 40%,transparent) 0 0/28px 100% no-repeat local,linear-gradient(270deg,var(--bg,#fafaf5) 40%,transparent) 100% 0/28px 100% no-repeat local,linear-gradient(90deg,rgba(127,127,127,.28),transparent) 0 0/12px 100% no-repeat scroll,linear-gradient(270deg,rgba(127,127,127,.28),transparent) 100% 0/12px 100% no-repeat scroll}.mf .lf-body svg{min-width:500px}}']));
    }
    host.setAttribute('data-static-time', num(D * 0.9));
    svg.insertBefore(svgEl('desc', {}, [document.createTextNode(desc)]), svg.firstChild);
    host.appendChild(el('div', { class: 'lf mf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [svg]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }

  function blueprintWeightsFigure(host) {
    var D = 7;
    var domains = [
      ['Fundamentals', 16],
      ['Architecture', 14],
      ['Interactions', 26],
      ['Security', 24],
      ['Use Cases', 20]
    ];
    var baseline = 210;
    var barWidth = 70;
    var step = 100;
    var startX = 45;
    var pxPerPercent = 5;
    var svg = stage(560, 250);
    svg.appendChild(ln(30, baseline, 530, baseline, RULE, { 'stroke-width': 1 }));
    var i, x, centerX, barHeight, barY, valueY, a;
    var spots = [];
    for (i = 0; i < domains.length; i++) {
      x = startX + i * step;
      centerX = x + barWidth / 2;
      barHeight = domains[i][1] * pxPerPercent;
      barY = baseline - barHeight;
      valueY = barY - 8;
      a = 0.05 + i * 0.09;
      svg.appendChild(grow([rct(x, barY, barWidth, barHeight, 'none', BP, { opacity: 0.85 })], centerX, baseline, D, a));
      svg.appendChild(pop([txt(centerX, valueY, domains[i][1] + '%', INK, MID)], centerX, valueY, D, a + 0.08));
      svg.appendChild(txt(centerX, baseline + 18, domains[i][0], MUTE, MID));
      if (i === 2 || i === 3) spots.push([x, barY, barWidth, barHeight]);
    }
    for (i = 0; i < spots.length; i++) {
      svg.appendChild(spot(spots[i][0], spots[i][1], spots[i][2], spots[i][3], D, 0.6, 0.78, BP));
    }
    card(host, D, svg, 'MCPA Blueprint', 'five domains weighted by percent of exam content',
      'Bar chart of the five MCPA domain weights: MCP Fundamentals 16 percent, Architecture and Components 14 percent, Interactions and Execution 26 percent, Security and Governance 24 percent, Use Cases and Ecosystem 20 percent',
      'Interactions and Execution and Security and Governance together carry half the blueprint. Study hours split evenly across five domains would starve the two tallest bars.');
  }

  function specMapFigure(host) {
    var D = 9;
    var must = ['Base Protocol', 'Versioning', 'Message Patterns'];
    var may = ['Authorization', 'Server Features', 'Client Features', 'Utilities'];
    var mustW = 150, mustGap = 10, mustStartX = 45, mustY = 66, mustH = 26;
    var mayW = 125, mayGap = 8, mayStartX = 18, mayY = 138, mayH = 26;
    var rootX = 200, rootY = 12, rootW = 160, rootH = 32;
    var rootCx = rootX + rootW / 2;
    var rootBy = rootY + rootH;
    var svg = stage(560, 300);
    svg.appendChild(pop([
      rct(rootX, rootY, rootW, rootH, BP, SURF, { 'stroke-width': 1.4 }),
      txt(rootCx, rootY + 14, 'Specification', INK, MID),
      txt(rootCx, rootY + 27, '2026-07-28, Current', INK, MID)
    ], rootCx, rootY + rootH / 2, D, 0.03, 0.09));
    svg.appendChild(show(txt(mustStartX, mustY - 6, 'MUST support', MUTE), D, 0.11));
    var i, x, cx, a;
    for (i = 0; i < must.length; i++) {
      x = mustStartX + i * (mustW + mustGap);
      cx = x + mustW / 2;
      a = 0.14 + i * 0.06;
      svg.appendChild(draw(ln(rootCx, rootBy, cx, mustY, MUTE, { 'stroke-width': 0.7, opacity: 0.65 }), Math.sqrt(Math.pow(cx - rootCx, 2) + Math.pow(mustY - rootBy, 2)), D, a, a + 0.05));
      svg.appendChild(pop([rct(x, mustY, mustW, mustH, BP, BP, { 'fill-opacity': 0.14, 'stroke-width': 1.2 }), txt(cx, mustY + 17, must[i], INK, MID)], cx, mustY + mustH / 2, D, a, a + 0.06));
    }
    svg.appendChild(show(txt(mayStartX, mayY - 6, 'MAY support', MUTE), D, 0.35));
    for (i = 0; i < may.length; i++) {
      x = mayStartX + i * (mayW + mayGap);
      cx = x + mayW / 2;
      a = 0.38 + i * 0.045;
      svg.appendChild(draw(ln(rootCx, rootBy, cx, mayY, MUTE, { 'stroke-width': 0.7, opacity: 0.65 }), Math.sqrt(Math.pow(cx - rootCx, 2) + Math.pow(mayY - rootBy, 2)), D, a, a + 0.04));
      svg.appendChild(pop([rct(x, mayY, mayW, mayH, RULE, SURF), txt(cx, mayY + 17, may[i], MUTE, MID)], cx, mayY + mayH / 2, D, a, a + 0.05));
    }
    var chips = ['Active', 'Deprecated', 'Removed'];
    var chipW = 110, chipGap = 40, chipStartX = 75, chipY = 210, chipH = 26, chipCy = chipY + chipH / 2;
    var chipT = [[0.6, 0.655], [0.695, 0.745], [0.78, 0.83]];
    for (i = 0; i < chips.length; i++) {
      x = chipStartX + i * (chipW + chipGap);
      cx = x + chipW / 2;
      svg.appendChild(pop([rct(x, chipY, chipW, chipH, SOFT, SURF, { rx: 13 }), txt(cx, chipY + 17, chips[i], INK, MID)], cx, chipCy, D, chipT[i][0], chipT[i][1]));
      if (i > 0) svg.appendChild(send([[x - chipGap, chipCy], [x - 4, chipCy]], D, chipT[i - 1][1], chipT[i][0], BP));
    }
    svg.appendChild(show(txt(chipStartX, chipY + chipH + 18, 'feature lifecycle, independent of the revision state', MUTE), D, 0.835, 0.875));
    card(host, D, svg, 'Reading the Specification', 'what every implementation MUST support, what it MAY add, and how a feature ages',
      'A map of the MCP specification: a root node for the 2026-07-28 Current revision branches to three MUST-support components, base protocol, versioning, and message patterns, and four MAY components, authorization, server features, client features, and utilities. Below, three chips show a feature moving from Active to Deprecated to Removed, a lifecycle independent of the revision.',
      'Every implementation MUST support the base protocol, versioning, and message patterns. Authorization, server features, client features, and utilities are added as needed. A feature also carries its own Active, Deprecated, or Removed state, tracked separately from whether the document itself is Draft, Current, or Final.');
  }

  function nByMFigure(host) {
    var D = 8;
    var apps = ['chat', 'editor', 'agent', 'portal'];
    var systems = ['files', 'tickets', 'crm', 'docs', 'db', 'ci'];
    var svg = stage(560, 230);
    var i, j, mesh, a;
    for (i = 0; i < apps.length; i++) {
      svg.appendChild(rct(16, 34 + i * 44, 76, 24));
      svg.appendChild(txt(24, 50 + i * 44, apps[i]));
      svg.appendChild(rct(300, 34 + i * 44, 76, 24));
      svg.appendChild(txt(308, 50 + i * 44, apps[i]));
    }
    for (j = 0; j < systems.length; j++) {
      svg.appendChild(rct(208, 18 + j * 30, 60, 22));
      svg.appendChild(txt(214, 33 + j * 30, systems[j]));
      svg.appendChild(rct(486, 18 + j * 30, 60, 22));
      svg.appendChild(txt(492, 33 + j * 30, systems[j]));
    }
    for (i = 0; i < apps.length; i++) {
      mesh = [];
      for (j = 0; j < systems.length; j++) {
        mesh.push(ln(92, 46 + i * 44, 208, 30 + j * 30, MUTE, { 'stroke-width': 0.6, opacity: 0.7 }));
      }
      svg.appendChild(show(grp(mesh), D, 0.05 + i * 0.06));
    }
    svg.appendChild(show(txt(96, 222, 'N x M = 24 integrations', MUTE), D, 0.31));
    svg.appendChild(pop([rct(420, 100, 20, 40, 'none', BP, { rx: 3 })], 430, 120, D, 0.4));
    for (i = 0; i < apps.length; i++) {
      svg.appendChild(draw(ln(376, 46 + i * 44, 420, 120, BP), Math.sqrt(Math.pow(376 - 420, 2) + Math.pow(46 + i * 44 - 120, 2)), D, 0.49, 0.55));
    }
    for (j = 0; j < systems.length; j++) {
      svg.appendChild(draw(ln(440, 120, 486, 29 + j * 30, BP), Math.sqrt(Math.pow(440 - 486, 2) + Math.pow(120 - (29 + j * 30), 2)), D, 0.57, 0.63));
    }
    var routes = [
      [[376, 46], [420, 120], [440, 120], [486, 29]],
      [[376, 90], [420, 120], [440, 120], [486, 89]],
      [[376, 134], [420, 120], [440, 120], [486, 179]]
    ];
    for (i = 0; i < routes.length; i++) {
      a = 0.65 + i * 0.04;
      svg.appendChild(packet(route(routes[i]), D, a, a + 0.08, BP));
    }
    svg.appendChild(show(txt(358, 222, 'N + M = 10 implementations', MUTE), D, 0.82, 0.86));
    card(host, D, svg, 'The Integration Problem', '24 custom links versus 10 protocol implementations',
      'Left: four applications wired to six systems with twenty-four links. Right: the same applications and systems each connect once to one shared protocol, ten connections.',
      'Bespoke glue grows with every application-system pair. With one protocol, each application implements a client once and each system implements a server once, and any client can discover any server at runtime.');
  }

  function envelopeFigure(host) {
    var D = 8;
    var shapes = [
      ['request', 'id required', 'not null'],
      ['notification', 'no id field', 'no reply sent'],
      ['result', 'id matches call', 'has resultType'],
      ['error', 'id if readable', 'code + message']
    ];
    var cardW = 120, gap = 12, startX = 18;
    var svg = stage(560, 220);
    svg.appendChild(txt(18, 14, 'four message shapes share one envelope', INK, BOLD));
    var i, x, a;
    for (i = 0; i < shapes.length; i++) {
      x = startX + i * (cardW + gap);
      a = 0.04 + i * 0.08;
      svg.appendChild(pop([
        rct(x, 22, cardW, 70),
        txt(x + 8, 40, shapes[i][0], INK, BOLD),
        txt(x + 8, 60, shapes[i][1], MUTE),
        txt(x + 8, 80, shapes[i][2], MUTE)
      ], x + cardW / 2, 57, D, a));
    }
    svg.appendChild(txt(18, 112, 'is a _meta key reserved for MCP?', INK, BOLD));
    svg.appendChild(pop([rct(36.6, 124, 157.2, 16, 'none', BP, { 'fill-opacity': 0.22 })], 115.2, 132, D, 0.47, 0.54));
    svg.appendChild(show(grp([
      txt(18, 136, 'io.', SOFT, { 'font-size': 12 }),
      txt(39.6, 136, 'modelcontextprotocol', INK, { 'font-size': 12, 'font-weight': 700 }),
      txt(190.8, 136, '/protocolVersion', SOFT, { 'font-size': 12 })
    ]), D, 0.4, 0.46));
    svg.appendChild(show(txt(18, 154, 'second label is modelcontextprotocol: reserved', MUTE), D, 0.55, 0.61));
    svg.appendChild(pop([rct(43.8, 170, 56.4, 16, 'none', RULE, { 'fill-opacity': 0.6 })], 72, 178, D, 0.72, 0.79));
    svg.appendChild(show(grp([
      txt(18, 182, 'com.', SOFT, { 'font-size': 12 }),
      txt(46.8, 182, 'example', INK, { 'font-size': 12, 'font-weight': 700 }),
      txt(97.2, 182, '.mcp/scanId', SOFT, { 'font-size': 12 })
    ]), D, 0.65, 0.71));
    svg.appendChild(show(txt(18, 200, 'second label is example, not mcp: not reserved', MUTE), D, 0.8, 0.86));
    card(host, D, svg, 'The JSON-RPC Envelope', 'four message shapes and the _meta key anatomy',
      'Top row: four message shape cards, request, notification, result, and error, each with the field that defines it. Bottom: two _meta keys split into prefix labels and a name, with the second label highlighted. io dot modelcontextprotocol is reserved because its second label is modelcontextprotocol. com dot example dot mcp is not reserved because its second label is example.',
      'A request always carries a non-null id, a notification never carries one, and a result or error echoes the id it answers. A _meta key is reserved for MCP only when its second dot-separated label is modelcontextprotocol or mcp, wherever mcp itself might also appear.');
  }

  function statelessRequestsFigure(host) {
    var D = 9;
    var svg = stage(560, 230);
    svg.appendChild(rct(14, 26, 76, 26));
    svg.appendChild(txt(22, 43, 'alice'));
    svg.appendChild(rct(14, 140, 76, 26));
    svg.appendChild(txt(22, 157, 'bob'));
    svg.appendChild(rct(150, 80, 100, 40));
    svg.appendChild(txt(158, 97, 'router'));
    svg.appendChild(txt(158, 112, 'round robin'));
    svg.appendChild(rct(300, 14, 100, 30));
    svg.appendChild(txt(308, 33, 'replica A'));
    svg.appendChild(rct(300, 156, 100, 30));
    svg.appendChild(txt(308, 175, 'replica B'));
    svg.appendChild(rct(452, 60, 96, 80, BP, BG, DASH));
    svg.appendChild(txt(460, 95, 'shared'));
    svg.appendChild(txt(460, 113, 'store'));
    var links = [
      [[90, 39], [148, 90]],
      [[90, 153], [148, 110]],
      [[250, 90], [298, 29]],
      [[250, 110], [298, 171]],
      [[400, 29], [450, 80]],
      [[400, 171], [450, 120]]
    ];
    var i;
    for (i = 0; i < links.length; i++) svg.appendChild(arrow(links[i], i < 2 ? SOFT : BP, i < 2 ? { 'stroke-width': 1 } : undefined));
    var flows = [
      [links[0], links[2], links[4]],
      [links[1], links[3], links[5]],
      [links[0], links[3], links[5]]
    ];
    var t;
    for (i = 0; i < flows.length; i++) {
      t = 0.05 + i * 0.22;
      svg.appendChild(packet(route(flows[i][0]), D, t, t + 0.05, BP));
      svg.appendChild(spot(150, 80, 100, 40, D, t + 0.04, t + 0.09, BP));
      svg.appendChild(packet(route(flows[i][1]), D, t + 0.07, t + 0.12, BP));
      svg.appendChild(packet(route(flows[i][2]), D, t + 0.13, t + 0.18, BP));
      svg.appendChild(spot(452, 60, 96, 80, D, t + 0.16, t + 0.2, BP));
    }
    svg.appendChild(show(grp([
      txt(14, 222, 'same handle, either replica', MUTE),
      txt(300, 222, 'state lives in the store', MUTE)
    ]), D, 0.74, 0.8));
    card(host, D, svg, 'The Stateless Core', 'any replica answers, because state lives off the process',
      'Two clients, alice and bob, send requests through a round robin router to two interchangeable server replicas, A and B. Both replicas read and write the same shared handle store, so whichever replica gets the next request answers it correctly.',
      'Alice\'s and bob\'s requests are routed round robin, with no stickiness to either replica. Neither replica keeps basket state in memory; both read and write the same shared store keyed by the opaque handle a tool call returned, so whichever replica answers the next request answers it correctly.');
  }

  function eraMatrixFigure(host) {
    var D = 8;
    var mid = [['DiscoverResult', 95], ['-32022 (recognized)', 280], ['other error / timeout', 465]];
    var out = [['Modern: use it', 95], ['Modern: retry version', 280], ['Legacy: use initialize', 465]];
    var svg = stage(560, 210);
    svg.appendChild(pop([rct(190, 10, 180, 30), txt(207, 29, 'server/discover probe')], 280, 25, D, 0.03, 0.1));
    var i, cx, t;
    for (i = 0; i < mid.length; i++) {
      cx = mid[i][1];
      t = 0.12 + i * 0.21;
      svg.appendChild(send([[280, 40], [cx, 78]], D, t, t + 0.05, MUTE, { 'stroke-width': 1 }));
      svg.appendChild(pop([rct(cx - 85, 80, 170, 28), txt(cx - 77, 98, mid[i][0])], cx, 94, D, t + 0.04, t + 0.09));
      svg.appendChild(send([[cx, 108], [cx, 148]], D, t + 0.1, t + 0.14, MUTE, { 'stroke-width': 1 }, null));
      svg.appendChild(pop([rct(cx - 85, 150, 170, 28, BP, SURF, { 'stroke-width': 1.2 }), txt(cx - 77, 168, out[i][0])], cx, 164, D, t + 0.14, t + 0.19));
    }
    svg.appendChild(show(grp([
      txt(18, 193, 'Era is a property of the server: cache the decision per', SOFT),
      txt(18, 206, 'process (stdio) or origin (HTTP).', SOFT)
    ]), D, 0.76, 0.82));
    card(host, D, svg, 'Protocol Era Probe', 'one server/discover probe, three outcomes, no handshake required to ask',
      'A server/discover probe fans out to three outcomes: a DiscoverResult means the server is modern, a recognized -32022 UnsupportedProtocolVersion error means modern with a different version to retry, and any other error or a timeout means legacy, falling back to the initialize handshake.',
      'The same probe sorts every stdio server into modern, modern with a different version, or legacy. A recognized modern error never falls back; only an unrecognized error or a timeout does.');
  }

  function topologyFigure(host) {
    var D = 9;
    var rows = [
      ['client: files', 'server: files', 'local . stdio . tools', 'reports: "primary"', 32],
      ['client: notes', 'server: notes', 'local . stdio . tools', 'reports: "primary"', 104],
      ['client: metrics', 'server: metrics', 'remote . http . resources', 'reports: "metrics-svc"', 176]
    ];
    var svg = stage(560, 330);
    svg.appendChild(rct(6, 6, 190, 248));
    svg.appendChild(txt(16, 22, 'host process', MUTE, { style: 'text-transform:uppercase;letter-spacing:.06em' }));
    var i, r, y, cy, t;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      y = r[4];
      cy = y + 27;
      t = 0.04 + i * 0.21;
      svg.appendChild(pop([rct(22, y, 160, 54, RULE, BG), txt(32, y + 32, r[0])], 102, cy, D, t, t + 0.07));
      svg.appendChild(send([[182, cy], [350, cy]], D, t + 0.06, t + 0.12, BP));
      svg.appendChild(pop([
        rct(350, y, 200, 54, RULE, BG),
        txt(360, y + 18, r[1]),
        txt(360, y + 32, r[2], MUTE),
        txt(360, y + 46, r[3], MUTE)
      ], 450, cy, D, t + 0.12, t + 0.19));
    }
    var regs = [
      'registry keys are host-assigned ids, never serverInfo.name',
      'search -> files (first to declare the name keeps it)',
      'notes/search -> notes (the collision gets a server-id prefix)'
    ];
    for (i = 0; i < regs.length; i++) {
      svg.appendChild(show(txt(20, 282 + i * 18, regs[i], SOFT), D, 0.68 + i * 0.06, 0.74 + i * 0.06));
    }
    svg.appendChild(spot(14, 304, 414, 18, D, 0.83, 0.89, BP));
    card(host, D, svg, 'Hosts, Clients, and Servers', 'one client per server, one registry behind the host',
      'One host embeds three clients, each bound to one server. Files and notes run locally over stdio and both self-report the name primary. Metrics runs remotely over Streamable HTTP. The registry keeps search for files and prefixes the colliding notes tool as notes slash search.',
      'The host embeds one client per server. Files and notes are local stdio subprocesses that both self-report the name "primary", so the host keys its registry on the connection id it assigned, files and notes, never on that self-reported name. Metrics is a remote Streamable HTTP server with no tools capability, so its tools are never listed. Both files and notes declare a tool named search; the aggregator keeps the first as the canonical name and exposes the second as notes/search.');
  }

  function discoverCapabilityFigure(host) {
    var D = 8;
    var svg = stage(560, 210);
    svg.appendChild(txt(16, 24, 'discover: optional, once', INK, { 'font-size': 12, 'font-weight': 700 }));
    svg.appendChild(txt(16, 100, 'every tools/call: declare capabilities again', INK, { 'font-size': 12, 'font-weight': 700 }));
    [
      [46, 'server/discover', 'supportedVersions + capabilities + ttlMs', BP, null, SOFT, 0.03],
      [124, 'clientCapabilities: {}', '-32021 missing elicitation', MUTE, DASH, ERR, 0.28],
      [172, 'clientCapabilities: {elicitation:{form:{}}}', 'result: complete', BP, null, BP, 0.53]
    ].forEach(function (lane) {
      var y = lane[0];
      var a = lane[6];
      svg.appendChild(box(16, y - 12, 84, 24, 'client'));
      svg.appendChild(box(460, y - 12, 84, 24, 'server'));
      if (lane[5] !== SOFT) svg.appendChild(spot(458, y - 14, 88, 28, D, a + 0.09, a + 0.19, lane[5]));
      svg.appendChild(show(txt(280, y - 8, lane[1], SOFT, MID), D, a));
      svg.appendChild(send([[100, y], [460, y]], D, a, a + 0.09, lane[3], lane[4]));
      svg.appendChild(show(txt(280, y + 14, lane[2], lane[5], MID), D, a + 0.1));
      svg.appendChild(packet(route([[460, y], [100, y]]), D, a + 0.1, a + 0.19, lane[5] === SOFT ? BP : lane[5]));
    });
    card(host, D, svg, 'Discovery and Capability Negotiation', 'discover once; declare capabilities on every call',
      'Top lane: a client calls server/discover once, optionally, and gets back supported versions, capabilities, instructions, and cache hints. Bottom lane: every tools/call still declares its own client capabilities in that request; without elicitation declared the server returns -32021, and with it declared the call completes.',
      'server/discover is optional and cacheable, a one-time summary of what a server can do. Every tools/call still carries its own clientCapabilities in _meta, checked fresh: missing elicitation gets -32021 naming it, declaring it lets the call complete.');
  }

  function schemaContractFigure(host) {
    var D = 8;
    var svg = stage(560, 260);
    svg.appendChild(rct(16, 14, 190, 64));
    svg.appendChild(txt(24, 30, 'tool: lookup_product'));
    svg.appendChild(txt(24, 44, 'inputSchema: sku required', MUTE));
    svg.appendChild(txt(24, 58, 'outputSchema: 4 fields', MUTE));
    svg.appendChild(txt(24, 72, 'extra properties: refused', MUTE));
    svg.appendChild(arrow([[111, 78], [111, 90]], MUTE));
    svg.appendChild(arrow([[111, 124], [111, 148]], MUTE));
    svg.appendChild(box(51, 150, 120, 32, 'validate()', undefined, BP));
    svg.appendChild(arrow([[436, 60], [436, 74]], MUTE));
    svg.appendChild(pop([box(16, 92, 190, 32, 'arguments: {"sku": "X"}')], 111, 108, D, 0.03));
    svg.appendChild(packet(route([[111, 124], [111, 148]]), D, 0.1, 0.17, BP));
    svg.appendChild(spot(51, 150, 120, 32, D, 0.16, 0.25, BP));
    svg.appendChild(send([[81, 182], [81, 196]], D, 0.23, 0.29, MUTE, DASH));
    svg.appendChild(pop([rct(14, 198, 192, 30, MUTE, SURF, DASH), txt(22, 218, 'result isError: true')], 110, 213, D, 0.29));
    svg.appendChild(send([[171, 166], [328, 166]], D, 0.36, 0.42, BP));
    svg.appendChild(pop([box(330, 150, 212, 32, 'handler(arguments)', undefined, BP)], 436, 166, D, 0.42));
    svg.appendChild(send([[436, 182], [436, 196]], D, 0.49, 0.55, BP));
    svg.appendChild(pop([box(330, 198, 212, 48, 'structuredContent: {...}', 'content[0].text: same JSON', BP)], 436, 222, D, 0.55));
    svg.appendChild(pop([box(330, 14, 212, 46, 'name: "delete_catalog"', 'not in tools/list')], 436, 37, D, 0.62));
    svg.appendChild(packet(route([[436, 60], [436, 74]]), D, 0.69, 0.75, MUTE));
    svg.appendChild(pop([rct(330, 76, 212, 32, MUTE, SURF, DASH), txt(344, 97, 'error -32602 Invalid params')], 436, 92, D, 0.75));
    card(host, D, svg, 'The Schema Contract', 'one gate, two ways out',
      'A tool definition with inputSchema and outputSchema. Arguments enter a validate gate. A schema failure returns a result with isError true. A pass runs the handler and returns structuredContent plus a text mirror conforming to outputSchema. A tool name the server never advertised takes a separate path to a protocol error, -32602, off to the side of the gate.',
      'A schema failure inside a known tool comes back as a normal result with isError true, content the model can read and correct. A tool name the server never advertised comes back as a JSON-RPC protocol error instead, on a separate path that never reaches the handler.');
  }

  function manifestAnatomyFigure(host) {
    var D = 8;
    var svg = stage(560, 200);
    var panels = [
      { t: 'server/discover', x: 8, rows: [['capabilities', 0], ['instructions', 1], ['cacheScope, ttlMs', 0]] },
      { t: 'tools/list', x: 196, rows: [['annotations: none', 1], ['x-mcp-header', 1], ['cacheScope: public', 1]] },
      { t: 'server.json', x: 384, rows: [['name: acme-tools', 1], ['packages: npm', 0], ['remotes: http', 0]] }
    ];
    var bodyHeight = 138;
    var i, j, panel, row, rowY, kids, flags, a;
    flags = [];
    for (i = 0; i < panels.length; i++) {
      panel = panels[i];
      kids = [rct(panel.x, 30, 168, bodyHeight), rct(panel.x, 30, 168, 26, RULE, 'none'), txt(panel.x + 9, 47, panel.t, INK, BOLD)];
      for (j = 0; j < panel.rows.length; j++) {
        row = panel.rows[j];
        rowY = 70 + j * 34;
        kids.push(svgEl('circle', { cx: panel.x + 13, cy: rowY, r: 6, fill: row[1] ? ERR : BP }));
        if (row[1]) {
          kids.push(txt(panel.x + 13, rowY + 4, '!', '#fff', { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 9 }));
          flags.push([panel.x + 13, rowY]);
        }
        kids.push(txt(panel.x + 26, rowY + 4, row[0], MUTE));
      }
      svg.appendChild(pop(kids, panel.x + 84, 99, D, 0.04 + i * 0.1));
    }
    for (i = 0; i < flags.length; i++) {
      a = 0.33 + i * 0.08;
      svg.appendChild(spot(flags[i][0] - 10, flags[i][1] - 10, 20, 20, D, a, a + 0.08, ERR));
    }
    svg.appendChild(show(txt(8, 188, 'circle marks a field; the exclamation is one a reviewer should not skip', SOFT), D, 0.78));
    card(host, D, svg, 'Manifest Anatomy', 'three documents, read before the first call',
      'Three panels: a server/discover result with capabilities and instructions, a tools/list result with a tool\'s annotations and x-mcp-header, and a registry server.json with its namespaced name. Flagged fields mark what a reviewer checks first: steering instructions, a tool with no annotations, a header exposing a secret-looking parameter, and a name with no namespace.',
      'A manifest is three documents: what a server claims to support, what it currently offers, and how the registry names it. Marked fields, steering instructions, a tool with no annotations, a header exposing a secret-looking parameter, and a namespace-free name, are the ones a reviewer checks before the first real call.');
  }

  function modelInteractionFlowFigure(host) {
    var D = 9;
    var svg = stage(560, 296);
    svg.appendChild(box(6, 26, 90, 44, 'user asks'));
    svg.appendChild(box(104, 26, 116, 44, 'host: context'));
    svg.appendChild(box(228, 26, 112, 44, 'model selects'));
    svg.appendChild(box(348, 26, 104, 44, 'confirm gate', undefined, BP));
    svg.appendChild(box(460, 26, 94, 44, 'server'));
    svg.appendChild(arrow([[96, 48], [104, 48]], BP));
    svg.appendChild(arrow([[220, 48], [228, 48]], BP));
    svg.appendChild(arrow([[340, 48], [348, 48]], BP));
    svg.appendChild(arrow([[452, 48], [460, 48]], BP));
    svg.appendChild(txt(410, 18, 'approved', MUTE));
    svg.appendChild(rct(20, 110, 140, 40, MUTE, 'none', DASH));
    svg.appendChild(txt(28, 134, 'held (denied)'));
    svg.appendChild(arrow([[507, 70], [75, 180]], BP));
    svg.appendChild(arrow([[507, 70], [230, 180]], BP));
    svg.appendChild(arrow([[507, 70], [415, 180]], BP));
    svg.appendChild(arrow([[75, 224], [85, 250]], BP));
    svg.appendChild(packet(route([[96, 48], [460, 48]]), D, 0.03, 0.17, BP));
    svg.appendChild(spot(348, 26, 104, 44, D, 0.13, 0.17, BP));
    svg.appendChild(send([[402, 70], [90, 110]], D, 0.19, 0.24, MUTE));
    svg.appendChild(show(txt(20, 160, 'denied, never sent', MUTE), D, 0.2));
    svg.appendChild(packet(route([[507, 70], [75, 180]]), D, 0.26, 0.31, BP));
    svg.appendChild(pop([box(20, 180, 110, 44, 'complete')], 75, 202, D, 0.31, 0.37));
    svg.appendChild(packet(route([[507, 70], [230, 180]]), D, 0.37, 0.42, BP));
    svg.appendChild(pop([box(160, 180, 140, 44, 'isError: true')], 230, 202, D, 0.42, 0.48));
    svg.appendChild(packet(route([[507, 70], [415, 180]]), D, 0.48, 0.53, BP));
    svg.appendChild(pop([box(330, 180, 170, 44, 'input_required')], 415, 202, D, 0.53, 0.59));
    svg.appendChild(send([[230, 180], [230, 80], [284, 80], [284, 70]], D, 0.59, 0.64, MUTE, DASH));
    svg.appendChild(show(txt(236, 112, 'retry, corrected args', MUTE), D, 0.6));
    svg.appendChild(send([[415, 180], [415, 86], [300, 86], [300, 70]], D, 0.63, 0.68, MUTE, DASH));
    svg.appendChild(show(txt(330, 240, 'retry, new id, requestState echoed', MUTE), D, 0.64));
    svg.appendChild(packet(route([[75, 224], [85, 250]]), D, 0.68, 0.73, BP));
    svg.appendChild(pop([box(10, 250, 150, 36, 'answer to user')], 85, 268, D, 0.73, 0.79));
    card(host, D, svg, 'Model Interaction Flow', 'context, selection, confirmation, call, and back',
      'A user request flows through a host that builds model context, a model that selects a tool and drafts arguments, and a confirmation gate. An approved call reaches the server; a denied one is held and never sent. The server can return a complete result that becomes the answer, a tool execution error that sends the model back to correct its arguments, or an input required result that sends the host to gather an answer and retry with a new id and the same requestState.',
      'The loop has one branch the wire never sees: a denied confirmation stops before the client sends anything. Of the branches that reach the server, a tool execution error and an input required result both return control to the model, but only the input required branch is a retry with a new id and an echoed requestState; a protocol error also returns control to the model, with nothing to correct, so the loop does not send it again.');
  }

  function toolCallFigure(host) {
    var D = 7;
    var svg = stage(560, 230);
    svg.appendChild(rct(16, 36, 110, 40));
    svg.appendChild(txt(71, 60, 'Client', INK, MID));
    svg.appendChild(rct(434, 36, 110, 40));
    svg.appendChild(txt(489, 60, 'Server', INK, MID));
    svg.appendChild(send([[126, 48], [434, 48]], D, 0.04, 0.11, BP));
    svg.appendChild(show(txt(280, 40, 'tools/call', MUTE, MID), D, 0.04));
    svg.appendChild(send([[434, 70], [126, 70]], D, 0.14, 0.21, BP));
    svg.appendChild(show(txt(280, 86, 'CallToolResult', MUTE, MID), D, 0.14));
    svg.appendChild(show(txt(8, 112, 'content can hold:', MUTE), D, 0.26));
    var chipLabels = ['text', 'image', 'audio', 'resource_link', 'resource'];
    var chipX = [8, 120, 232, 344, 456];
    var chipW = [104, 104, 104, 104, 96];
    var i;
    for (i = 0; i < chipLabels.length; i++) {
      svg.appendChild(pop([rct(chipX[i], 122, chipW[i], 26), txt(chipX[i] + chipW[i] / 2, 139, chipLabels[i], INK, MID)], chipX[i] + chipW[i] / 2, 135, D, 0.3 + i * 0.06));
    }
    svg.appendChild(show(txt(8, 172, 'and reports:', MUTE), D, 0.62));
    svg.appendChild(pop([rct(8, 182, 140, 26), txt(78, 199, 'isError omitted', INK, MID)], 78, 195, D, 0.66));
    svg.appendChild(pop([rct(170, 182, 140, 26), txt(240, 199, 'isError: true', INK, MID)], 240, 195, D, 0.72));
    card(host, D, svg, 'The Tools Primitive', 'one call, five kinds of content, two error channels',
      'A client sends tools/call to a server and gets back a CallToolResult. The result content list can hold text, image, audio, resource_link, or resource blocks. The same result also reports isError, omitted or false on success, true when the tool itself failed.',
      'A tools/call request names one tool and its arguments; the CallToolResult that comes back carries a content list built from any mix of the five block types, an optional structuredContent value, and isError. Omitted or false means the call succeeded; true means the tool ran into a problem the model can read and correct.');
  }

  function resourceReadFigure(host) {
    var D = 7;
    var svg = stage(560, 232);
    svg.appendChild(rct(224, 76, 150, 64));
    svg.appendChild(txt(234, 96, 'resources/read', INK, BOLD));
    svg.appendChild(txt(234, 112, 'sanitize against root', MUTE));
    svg.appendChild(txt(234, 128, 'then look up the uri', MUTE));
    svg.appendChild(arrow([[180, 108], [224, 108]], BP));
    svg.appendChild(txt(182, 100, 'expand', MUTE));
    svg.appendChild(pop([rct(8, 76, 172, 64), txt(18, 96, 'template', INK, BOLD), txt(18, 112, 'file:///project/{+path}', MUTE), txt(18, 128, 'path = src/app.py', MUTE)], 94, 108, D, 0.04));
    svg.appendChild(packet(route([[180, 108], [224, 108]]), D, 0.14, 0.2, BP));
    svg.appendChild(spot(224, 76, 150, 64, D, 0.19, 0.27, BP));
    svg.appendChild(send([[374, 92], [400, 40]], D, 0.3, 0.37, BP));
    svg.appendChild(show(txt(330, 60, 'found', MUTE), D, 0.3));
    svg.appendChild(pop([rct(400, 10, 156, 66), txt(408, 30, 'complete', INK, BOLD), txt(408, 46, 'contents[]', MUTE), txt(408, 62, 'ttlMs + cacheScope', MUTE)], 478, 43, D, 0.37));
    svg.appendChild(send([[374, 124], [400, 176]], D, 0.47, 0.54, ERR));
    svg.appendChild(show(txt(320, 164, 'missing', MUTE), D, 0.47));
    svg.appendChild(pop([rct(400, 146, 156, 66), txt(408, 166, '-32602', ERR, BOLD), txt(408, 182, 'data.uri', MUTE), txt(408, 198, 'never empty contents[]', MUTE)], 478, 179, D, 0.54));
    svg.appendChild(show(txt(8, 222, 'sanitize before lookup: a path segment can never resolve outside the project root', SOFT), D, 0.63));
    card(host, D, svg, 'Reading a Resource', 'one URI, two lawful outcomes',
      'A URI template, file colon slash slash slash project slash plus path, expands into a concrete URI, which resources read resolves against the project root. A resource that exists returns a complete result carrying contents, ttlMs, and cacheScope. A resource that is missing, or a path that tries to climb outside the root, returns JSON-RPC error -32602 naming the requested URI in data.uri, never a result with an empty contents array.',
      'A URI template expands into a concrete URI, and resources/read sanitizes it against the server\'s root before any lookup. A resource that exists returns a complete result carrying contents, ttlMs, and cacheScope. A resource that does not exist, or a path that tries to climb outside the root, returns JSON-RPC error -32602 naming the requested URI in data.uri, never a successful result with an empty contents array.');
  }

  function promptTemplateFigure(host) {
    var D = 7;
    var svg = stage(560, 204);
    svg.appendChild(txt(14, 18, 'prompts/get renders a template', MUTE));
    svg.appendChild(arrow([[131, 70], [131, 84]], BP));
    svg.appendChild(arrow([[131, 130], [131, 144]], BP));
    svg.appendChild(txt(312, 18, 'completion narrows with context', MUTE));
    svg.appendChild(pop([rct(14, 26, 234, 44), txt(22, 42, 'text: {language} snippet,'), txt(22, 58, 'follow {framework} style')], 131, 48, D, 0.04));
    svg.appendChild(packet(route([[131, 70], [131, 84]]), D, 0.13, 0.19, BP));
    svg.appendChild(pop([rct(14, 86, 234, 44), txt(22, 102, 'language: python'), txt(22, 118, 'framework: flask')], 131, 108, D, 0.19));
    svg.appendChild(packet(route([[131, 130], [131, 144]]), D, 0.28, 0.34, BP));
    svg.appendChild(pop([rct(14, 146, 234, 44, BP), txt(22, 162, 'rendered: python snippet,'), txt(22, 178, 'follow flask style')], 131, 168, D, 0.34));
    svg.appendChild(pop([rct(312, 26, 234, 44), txt(320, 42, 'framework "fa", no context:'), txt(320, 58, 'falcon, fastapi, fastify')], 429, 48, D, 0.44));
    svg.appendChild(send([[429, 70], [429, 84]], D, 0.54, 0.6, BP));
    svg.appendChild(show(txt(366, 80, '+ context', MUTE), D, 0.54));
    svg.appendChild(pop([rct(312, 86, 234, 44, BP), txt(320, 102, 'language: python'), txt(320, 118, 'narrows to: falcon, fastapi')], 429, 108, D, 0.6));
    svg.appendChild(show(txt(312, 146, '3 matches narrow to 2', MUTE), D, 0.72));
    card(host, D, svg, 'Prompt Template and Completion', 'arguments fill a template; context narrows suggestions',
      'Left: a code_review prompt template fills language and framework placeholders to render its text. Right: completion for the framework argument returns three matches with no context, narrowing to two once context.arguments supplies the chosen language.',
      'A prompt argument fills its placeholder to render PromptMessage content. completion/complete ranks suggestions for one argument, and narrows them further once context.arguments carries an answer already given, such as the chosen language.');
  }

  function mrtrFigure(host) {
    var D = 8;
    var svg = stage(560, 290);
    [100, 460].forEach(function (x, i) {
      svg.appendChild(ln(x, 40, x, 272, RULE, { 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      svg.appendChild(rct(x - 36, 16, 72, 22));
      svg.appendChild(txt(x, 31, i ? 'Server' : 'Client', INK, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }));
    });
    svg.appendChild(pop([rct(188, 229, 184, 18, BP, BP, { 'fill-opacity': 0.1, rx: 9 })], 280, 238, D, 0.78));
    [
      [70, 100, 460, 'tools/call (id 1): deploy_release', 0.04, undefined],
      [118, 460, 100, 'input_required: confirm + requestState', 0.2, null],
      [206, 100, 460, 'tools/call (id 2): new id, inputResponses', 0.5, null],
      [254, 460, 100, 'complete: deployed = true', 0.66, undefined]
    ].forEach(function (row) {
      svg.appendChild(show(txt(280, row[0] - 13, row[3], INK, MID), D, row[4]));
      svg.appendChild(send([[row[1], row[0]], [row[2], row[0]]], D, row[4], row[4] + 0.12, BP, null, row[5]));
    });
    svg.appendChild(show(txt(296, 160, 'client gathers confirmation from the user', MUTE, { 'text-anchor': 'middle', 'font-style': 'italic' }), D, 0.34));
    var token = grp([rct(-47, -9, 94, 18, BP, BG, { rx: 9 }), txt(0, 4, 'requestState', BP, MID)], { opacity: '0' });
    token.appendChild(anim('opacity', '0;1;0;0', D, { calcMode: 'discrete', keyTimes: '0;0.2;0.62;1' }));
    token.appendChild(svgEl('animateMotion', { path: 'M460 118L100 118L100 206L460 206', dur: D + 's', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;0;0.446;0.554;1;1', keyTimes: '0;0.2;0.32;0.48;0.62;1' }));
    svg.appendChild(token);
    card(host, D, svg, 'Multi Round-Trip Requests', 'one call, an input_required pause, a fresh retry that echoes requestState',
      'A client sends tools/call with id 1. The server ends that request with an input_required result carrying inputRequests and requestState instead of holding a stream open. The client gathers the confirmation from the user, then sends an independent tools/call with a new id 2 that carries inputResponses and echoes requestState exactly. The server replies complete.',
      'The server never pushes a request to the client. It ends the first call with input_required, and the client starts an independent second call, with a new JSON-RPC id, that echoes requestState byte for byte and supplies inputResponses.');
  }

  function deprecationTimelineFigure(host) {
    var D = 8;
    var svg = stage(560, 256);
    var depX = 150;
    var remX = 360;
    var endX = 524;
    var lns = [
      { label: 'Roots', y: 84 },
      { label: 'Sampling', y: 112 },
      { label: 'Logging', y: 140 }
    ];
    var svalid = [
      'roots/list (MRTR input request)',
      'sampling/createMessage (MRTR)',
      'logLevel + notifications/message'
    ];
    var rmv = [
      'logging/setLevel',
      'notifications/roots/list_changed'
    ];
    var i;
    var y;
    svg.appendChild(ln(depX, 40, endX, 40, MUTE));
    svg.appendChild(ln(18, 160, 542, 160, RULE));
    for (i = 0; i < lns.length; i++) svg.appendChild(txt(18, lns[i].y + 4, lns[i].label));
    svg.appendChild(txt(18, 176, 'Deprecated, still on the wire', INK, BOLD));
    svg.appendChild(txt(300, 176, 'Fully removed', INK, BOLD));
    svg.appendChild(pop([
      svgEl('circle', { cx: depX, cy: 40, r: 4, fill: BP }),
      txt(depX, 24, 'Deprecated', INK, MID),
      txt(depX, 56, '2026-07-28', MUTE, MID)
    ], depX, 40, D, 0.03));
    svg.appendChild(pop([
      svgEl('circle', { cx: remX, cy: 40, r: 4, fill: BP }),
      txt(remX, 24, 'Eligible for removal', INK, MID),
      txt(remX, 56, '2027-07-28+', MUTE, MID)
    ], remX, 40, D, 0.35));
    for (i = 0; i < lns.length; i++) svg.appendChild(svgEl('circle', { cx: depX, cy: lns[i].y, r: 3, fill: BP }));
    var skids = [];
    for (i = 0; i < lns.length; i++) skids.push(ln(depX, lns[i].y, remX, lns[i].y, BP, { 'stroke-width': 5 }));
    svg.appendChild(grow(skids, depX, 0, D, 0.12, 0.35, undefined, true));
    var cursor = spot(depX, 30, 1, 122, D, 0.12, 0.52, BP);
    svg.appendChild(slide(cursor, endX - depX, 0, D, 0.12, 0.52));
    var dkids = [];
    for (i = 0; i < lns.length; i++) dkids.push(ln(remX, lns[i].y, endX, lns[i].y, SOFT, { 'stroke-width': 5, 'stroke-dasharray': '6 4' }));
    svg.appendChild(show(grp(dkids), D, 0.39));
    for (i = 0; i < svalid.length; i++) {
      y = 196 + i * 20;
      svg.appendChild(show(box(18, y - 8, 6, 6, svalid[i], 0, 'none', BP), D, 0.56 + i * 0.055));
    }
    for (i = 0; i < rmv.length; i++) {
      y = 196 + i * 20;
      svg.appendChild(show(box(300, y - 8, 6, 6, rmv[i], 0, 'none', MUTE), D, 0.56 + (svalid.length + i) * 0.055));
    }
    card(host, D, svg, 'Deprecated, Not Removed', 'roots, sampling, and logging keep answering through the removal window',
      'Timeline from the 2026-07-28 deprecation of roots, sampling, and logging to their earliest possible removal on or after 2027-07-28, each lane solid then dashed to show the feature keeps working past the marker. Below, one column lists roots/list, sampling/createMessage, and per-request logLevel with notifications/message as still valid on the wire, and a second column lists logging/setLevel and notifications/roots/list_changed as already removed.',
      'Deprecated in 2026-07-28 starts a twelve month clock, not a deletion: roots, sampling, and logging keep their exact wire shape past the earliest-removal marker, while logging/setLevel and notifications/roots/list_changed are already gone, replaced by MRTR input requests and a per-request logLevel key.');
  }

  function subscriptionStreamFigure(host) {
    var D = 9;
    var svg = stage(560, 330);
    var cX = 61;
    var sX = 499;
    var beats = [
      [cX, sX, 'ok', 'listen id=1: toolsListChanged, config.json'],
      [sX, cX, 'ok', 'ack: _meta.subscriptionId=1'],
      [cX, sX, 'ok', 'listen id=2: resourcesListChanged'],
      [sX, cX, 'ok', 'ack: _meta.subscriptionId=2'],
      [sX, cX, 'ok', 'resources/updated, subscriptionId=1'],
      [sX, cX, 'ok', 'resources/list_changed, subscriptionId=2'],
      [cX, sX, 'ok', 'tools/call id=3, _meta.progressToken=job-42'],
      [sX, cX, 'prog', 'progress 0.2, 0.6, 1.0: no subscriptionId'],
      [sX, cX, 'ok', 'result id=3: resultType complete'],
      [cX, sX, 'no', 'notifications/cancelled requestId=2'],
      [sX, cX, 'drop', 'late update for sub=2: dropped locally']
    ];
    var top = 46;
    var step = 26;
    var lfB = top + (beats.length - 1) * step + 14;
    var i;
    var cls;
    var label;
    var y;
    var x1;
    var x2;
    var a;
    var midX;
    svg.appendChild(box(16, 6, 90, 22, 'client'));
    svg.appendChild(box(454, 6, 90, 22, 'server'));
    svg.appendChild(ln(cX, 28, cX, lfB, RULE, { 'stroke-dasharray': '2 3' }));
    svg.appendChild(ln(sX, 28, sX, lfB, RULE, { 'stroke-dasharray': '2 3' }));
    for (i = 0; i < beats.length; i++) {
      x1 = beats[i][0];
      x2 = beats[i][1];
      cls = beats[i][2];
      label = beats[i][3];
      y = top + i * step;
      a = 0.03 + i * 0.07;
      svg.appendChild(show(txt(280, y - 6, label, SOFT, MID), D, a));
      if (cls === 'prog') {
        svg.appendChild(send([[x1, y], [x2, y]], D, a, a + 0.07, INK, { 'stroke-dasharray': '1 3', 'stroke-linecap': 'round' }, null));
        svg.appendChild(packet(route([[x1, y], [x2, y]]), D, a, a + 0.025, INK));
        svg.appendChild(packet(route([[x1, y], [x2, y]]), D, a + 0.035, a + 0.06, INK));
        svg.appendChild(packet(route([[x1, y], [x2, y]]), D, a + 0.07, a + 0.095, INK));
      } else if (cls === 'drop') {
        midX = (x1 + x2) / 2;
        svg.appendChild(show(ln(x1, y, midX, y, MUTE, DASH), D, a, a + 0.03));
        svg.appendChild(packet(route([[x1, y], [midX, y]]), D, a + 0.01, a + 0.07, MUTE));
      } else {
        svg.appendChild(send([[x1, y], [x2, y]], D, a, a + 0.09, cls === 'no' ? MUTE : BP, cls === 'no' ? DASH : null));
      }
    }
    card(host, D, svg, 'Notification Streams, Progress, and Cancellation', 'the listen stream tags every message with a subscriptionId; a request’s own progress never does',
      'Sequence between a client and a server. The client opens two subscriptions/listen requests, id 1 and id 2; each is acknowledged first with the matching subscriptionId in _meta, then resources/updated and list_changed notifications arrive tagged with that same id so the client can tell them apart. A separate tools/call request runs on its own response channel: its progress notifications carry only a progressToken, never a subscriptionId, and its result arrives on that same request, not on the listen stream. The client then cancels subscription 2 with notifications/cancelled, and a stray update for subscription 2 that arrives afterward is dropped rather than delivered.',
      'Two subscriptions share one channel and are told apart only by the subscriptionId every acknowledgment and notification carries in _meta, matching the id of the subscriptions/listen request that opened it. Progress and the final result for an ordinary call travel on that call’s own response, never on the listen stream, so they never carry a subscriptionId. Cancelling a subscription stops new messages for it; a message already in flight when the cancel lands still arrives and must be dropped, not delivered.');
  }

  function toolLifecycleFigure(host) {
    var D = 9;
    var svg = stage(560, 384);
    var stg = [
      'DISCOVER: server/discover',
      'LIST: tools/list, cached',
      'SELECT: model picks a tool',
      'CONFIRM: host approval gate',
      'CALL: tools/call sent',
      'VALIDATE: is the tool known',
      'EXECUTE: validate args, run',
      'RESULT: resultType'
    ];
    var barX = 16;
    var barW = 234;
    var barH = 26;
    var step = 40;
    var midX = barX + barW / 2;
    var i;
    var y;
    var t;
    var ys = [];
    for (i = 0; i < stg.length; i++) {
      y = 14 + i * step;
      ys.push(y);
      t = 0.04 + i * 0.075;
      svg.appendChild(box(barX, y, barW, barH, stg[i], 0, INK));
      svg.appendChild(spot(barX, y, barW, barH, D, t, t + 0.05));
      if (i) svg.appendChild(send([[midX, ys[i - 1] + barH], [midX, y]], D, t - 0.075, t, BP, null, null));
    }
    var yCall = ys[4];
    var rX = 340;
    var rW = 204;
    var rE = barX + barW;
    svg.appendChild(show(grp([ln(rE, ys[5] + 13, rX, ys[5] + 13, MUTE, DASH), box(rX, ys[5], rW, barH, 'unknown tool: -32602', 0, MUTE)]), D, 0.465));
    svg.appendChild(show(grp([ln(rE, ys[6] + 13, rX, ys[6] + 13, MUTE, DASH), box(rX, ys[6], rW, barH, 'isError (actionable)', 0, MUTE)]), D, 0.54));
    svg.appendChild(show(grp([
      ln(rE, ys[7] + 13, rX, ys[7] + 13, BP, DASH),
      rct(rX, ys[7], rW, barH, BP, SURF, { 'stroke-width': 1.6 }),
      txt(rX + 10, ys[7] + 17, 'complete: final')
    ]), D, 0.615));
    var yRetry = ys[7] + step;
    var eX = rE + 30;
    var cY = yRetry + 8;
    svg.appendChild(show(grp([pth(route([[rE, ys[7] + 13], [eX, ys[7] + 13], [eX, cY], [rX, cY]]), MUTE, DASH), box(rX, yRetry, rW, barH, 'input_required: retry', 0, MUTE)]), D, 0.675));
    var lX = rE + 18;
    var lY = yRetry + 18;
    svg.appendChild(send([[rX, lY], [lX, lY], [lX, yCall + 13], [rE + 2, yCall + 13]], D, 0.75, 0.82));
    card(host, D, svg, 'The Tool Invocation Lifecycle', 'eight checkpoints, two error channels, one loop back for input_required',
      'A vertical chain of eight checkpoints: discover, list, select, confirm, call, validate, execute, result. Validate branches right to an unknown tool -32602 protocol error. Execute branches right to an isError tool execution result. Result branches right to two outcomes: complete, which is final, and input_required, which loops back up to call with a new request id.',
      'Validate only asks whether the tool exists; failing there is always a protocol error, -32602, with no execute or result stage after it. Everything discovered once execute has started, a bad argument or a business rule, comes back isError inside a normal complete result so the model can read it and retry. A result of input_required is not the end: the client answers it and calls again with a new id, running validate, execute, and result a second time.');
  }

  function errorTaxonomyFigure(host) {
    var D = 7;
    var svg = stage(560, 300);
    var pCodes = [
      ['-32601', 'Method not found'],
      ['-32602', 'Invalid params (unknown tool)'],
      ['-32020', 'HeaderMismatch'],
      ['-32021', 'MissingRequiredClientCapability'],
      ['-32022', 'UnsupportedProtocolVersion']
    ];
    var rh = 32;
    var gap = 6;
    var sY = 40;
    var i;
    var y;
    svg.appendChild(txt(16, 14, 'two channels answer a failed request; only one of them is content the model reads', SOFT, BOLD));
    svg.appendChild(txt(16, 30, 'protocol error -> JSON-RPC error', SOFT, BOLD));
    svg.appendChild(txt(296, 30, 'tool problem -> isError: true', SOFT, BOLD));
    svg.appendChild(ln(282, 36, 282, 224, RULE));
    for (i = 0; i < pCodes.length; i++) {
      y = sY + i * (rh + gap);
      svg.appendChild(pop([
        rct(16, y, 250, rh),
        txt(24, y + 13, pCodes[i][0], INK, { 'font-size': 12, 'font-weight': 700 }),
        txt(24, y + 26, pCodes[i][1], MUTE)
      ], 141, y + 16, D, 0.04 + i * 0.07));
    }
    svg.appendChild(pop([
      rct(296, 40, 248, 184),
      txt(304, 58, 'isError: true', INK, { 'font-size': 12, 'font-weight': 700 })
    ], 420, 132, D, 0.40));
    svg.appendChild(show(grp([
      txt(304, 76, 'API failures', MUTE),
      txt(304, 92, 'input validation errors', MUTE),
      txt(304, 108, 'business logic refusals', MUTE),
      txt(304, 124, 'expired server-minted handles', MUTE)
    ]), D, 0.48));
    svg.appendChild(show(grp([
      ln(304, 138, 536, 138, RULE),
      txt(304, 158, 'content the model reads,', MUTE),
      txt(304, 176, 'then retries with a fix', MUTE)
    ]), D, 0.60));
    svg.appendChild(pop([
      rct(16, 240, 528, 48, MUTE, 'none', { 'stroke-dasharray': '4 3' }),
      txt(28, 260, 'forbidden: -32000 to -32019 legacy, -32002 and -32042 retired', INK, BOLD),
      txt(28, 278, 'a 2026-07-28 server must refuse to put any of these on the wire', MUTE)
    ], 280, 264, D, 0.73));
    svg.appendChild(spot(16, 240, 528, 48, D, 0.75, 0.80, ERR));
    card(host, D, svg, 'Two Ways for a Request to Fail', 'a protocol error travels as a JSON-RPC error object; a tool problem travels as a normal result with isError true',
      'Left column: five JSON-RPC protocol error codes, -32601 method not found, -32602 invalid params, -32020 header mismatch, -32021 missing required client capability, -32022 unsupported protocol version. Right column: a tool problem card showing API failures, input validation errors, business logic refusals, and expired handles all reported as a result with isError true, which is content the model reads and then retries with a fix. Bottom band: the forbidden zone, -32000 to -32019 legacy and -32002 and -32042 retired, labeled as codes a 2026-07-28 server must refuse to put on the wire.',
      'A protocol error is a JSON-RPC error object the client handles itself. A tool problem is a normal result with isError true, content the model can read and act on. Both are legitimate channels; a code from the forbidden band below is never legitimate, whichever channel would carry it.');
  }

  function transportsFigure(host) {
    var D = 7;
    var svg = stage(560, 232);
    var i;
    svg.appendChild(txt(8, 16, 'STDIO (SUBPROCESS)', MUTE));
    svg.appendChild(box(8, 24, 254, 28, 'client process'));
    svg.appendChild(box(8, 118, 254, 28, 'server (child process)'));
    svg.appendChild(txt(296, 16, 'STREAMABLE HTTP (POST /mcp)', MUTE));
    svg.appendChild(box(296, 24, 256, 28, 'client (any HTTP peer)'));
    svg.appendChild(box(296, 118, 256, 28, 'server (validate + dispatch)'));
    svg.appendChild(show(txt(68, 80, 'stdin', MUTE), D, 0.05));
    svg.appendChild(send([[60, 52], [60, 116]], D, 0.05, 0.16));
    svg.appendChild(show(txt(358, 80, 'POST /mcp', MUTE), D, 0.05));
    svg.appendChild(send([[350, 52], [350, 116]], D, 0.05, 0.16));
    svg.appendChild(show(txt(158, 80, 'stdout', MUTE), D, 0.22));
    svg.appendChild(send([[150, 116], [150, 52]], D, 0.22, 0.33));
    svg.appendChild(show(txt(478, 80, 'response', MUTE), D, 0.40));
    svg.appendChild(send([[470, 116], [470, 52]], D, 0.40, 0.51));
    svg.appendChild(show(txt(226, 100, 'stderr', MUTE), D, 0.40));
    svg.appendChild(send([[220, 116], [220, 52]], D, 0.40, 0.51, MUTE, DASH));
    svg.appendChild(pop([
      svgEl('circle', { cx: 372, cy: 100, r: 7, fill: ERR }),
      txt(372, 104, '!', '#fff', { 'font-size': 9, 'font-weight': 700, 'text-anchor': 'middle' }),
      txt(384, 104, 'mismatch: 400 + -32020', MUTE)
    ], 450, 100, D, 0.22));
    svg.appendChild(spot(343, 90, 14, 20, D, 0.22, 0.30, ERR));
    var fnotes = [
      'protocol semantics are identical on every transport; only the binding differs',
      'stdio has no header layer: version and capabilities travel only in _meta',
      'HTTP mirrors method, name, and x-mcp-header params; a mismatch is 400 + -32020'
    ];
    for (i = 0; i < fnotes.length; i++) {
      svg.appendChild(show(txt(8, 178 + i * 16, fnotes[i], SOFT), D, 0.58 + i * 0.08));
    }
    card(host, D, svg, 'Transports and Headers', 'the same message, two bindings',
      'Left: stdio transport between a client and a child server process, connected by a stdin line down, a stdout line up, and a dashed stderr line up, with no header layer at all. Right: Streamable HTTP, where a client posts to the server and the server posts back a response; a checkpoint on the request arrow marks where mismatched headers are rejected with HTTP 400 and error code -32020.',
      'stdio carries every message inline over stdin and stdout, with logs on a separate stderr line and no header layer at all. Streamable HTTP mirrors the method, the tool or resource name, and any x-mcp-header argument into headers so a gateway can route without parsing the body, but the body stays the source of truth: a header that disagrees with it is rejected with HTTP 400 and a HeaderMismatch (-32020) error before the tool ever runs.');
  }

  function cacheFreshnessFigure(host) {
    var D = 7;
    var svg = stage(560, 208);
    svg.appendChild(txt(70, 16, 'A. TTL alone: fresh until t_received + ttlMs', INK, { 'font-size': 12 }));
    svg.appendChild(ln(70, 54, 500, 54, RULE));
    svg.appendChild(ln(70, 54, 70, 60, RULE));
    svg.appendChild(ln(310, 54, 310, 60, RULE));
    svg.appendChild(txt(70, 72, 't_received', MUTE));
    svg.appendChild(txt(70, 100, 'B. Notification during the window: stale immediately', INK, { 'font-size': 12 }));
    svg.appendChild(ln(70, 178, 500, 178, RULE));
    svg.appendChild(ln(70, 178, 70, 184, RULE));
    svg.appendChild(ln(310, 178, 310, 184, RULE));
    svg.appendChild(txt(70, 196, 't_received', MUTE));
    svg.appendChild(grow([rct(70, 30, 240, 24, 'none', BP, { 'fill-opacity': 0.2 })], 70, 30, D, 0.05, 0.38, undefined, true));
    svg.appendChild(show(txt(190, 46, 'fresh', INK, { 'font-size': 12, 'text-anchor': 'middle' }), D, 0.38));
    svg.appendChild(show(grp([
      rct(310, 30, 190, 24, 'none', MUTE, { 'fill-opacity': 0.16 }),
      txt(405, 46, 'stale', INK, { 'font-size': 12, 'text-anchor': 'middle' }),
      txt(310, 72, 't_received + ttlMs', MUTE, MID)
    ]), D, 0.44));
    svg.appendChild(grow([rct(70, 154, 160, 24, 'none', BP, { 'fill-opacity': 0.2 })], 70, 154, D, 0.05, 0.28, undefined, true));
    svg.appendChild(show(txt(230, 124, 'list_changed notification', MUTE, MID), D, 0.20));
    svg.appendChild(send([[230, 130], [230, 148]], D, 0.22, 0.28));
    svg.appendChild(show(txt(150, 170, 'fresh', INK, { 'font-size': 12, 'text-anchor': 'middle' }), D, 0.28));
    svg.appendChild(show(grp([rct(230, 154, 270, 24, 'none', MUTE, { 'fill-opacity': 0.16 }), txt(365, 170, 'stale', INK, { 'font-size': 12, 'text-anchor': 'middle' })]), D, 0.28));
    svg.appendChild(show(grp([ln(310, 150, 310, 178, SOFT, DASH), txt(310, 196, 'ttl would end here', MUTE, MID)]), D, 0.34));
    card(host, D, svg, 'Cache Freshness', 'a TTL window ends on the clock, unless a notification ends it first',
      'Two timelines that share the same t_received. In scenario A the cached response stays fresh until t_received plus ttlMs, then goes stale. In scenario B a list_changed notification arrives before the TTL would have expired, and the response goes stale immediately at the notification, leaving the remaining TTL unused.',
      'A cached response stays fresh until its ttlMs runs out, but a relevant list_changed notification invalidates it immediately on arrival, even with time left on the clock. TTL and notifications are complementary, not competing.');
  }

  function taskStateLifecycleFigure(host) {
    var D = 8;
    var svg = stage(560, 260);
    var boxes = [
      [30, 24, 150, 44, 'input_required', false],
      [30, 188, 150, 44, 'working', false],
      [380, 20, 150, 40, 'completed', true],
      [380, 110, 150, 40, 'cancelled', true],
      [380, 200, 150, 40, 'failed', true]
    ];
    var i;
    var b;
    var cx;
    var cy;
    var e;
    for (i = 0; i < boxes.length; i++) {
      b = boxes[i];
      cx = b[0] + b[2] / 2;
      cy = b[1] + b[3] / 2;
      svg.appendChild(rct(b[0], b[1], b[2], b[3], SOFT, SURF, b[5] ? { 'stroke-dasharray': '4 2' } : null));
      svg.appendChild(txt(cx, cy + 4, b[4], INK, { 'font-size': 12, 'text-anchor': 'middle' }));
    }
    svg.appendChild(spot(boxes[1][0], boxes[1][1], boxes[1][2], boxes[1][3], D, 0.04, 0.10));
    var edges = [
      [6, 105, 'needs input', [[95, 185], [95, 71]], BP, 0.10, 0.20, 0],
      [132, 155, 'tasks/update', [[118, 71], [118, 185]], BP, 0.26, 0.36, 1],
      [250, 128, 'work finishes', [[183, 193], [377, 42]], BP, 0.42, 0.54, 2],
      [250, 169, 'tasks/cancel', [[183, 210], [377, 130]], MUTE, 0.64, 0.72, -1],
      [250, 208, 'protocol error', [[183, 227], [377, 218]], MUTE, 0.70, 0.78, -1]
    ];
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      svg.appendChild(show(txt(e[0], e[1], e[2], MUTE), D, e[5]));
      svg.appendChild(send(e[3], D, e[5], e[6], e[4]));
      if (e[7] >= 0) svg.appendChild(spot(boxes[e[7]][0], boxes[e[7]][1], boxes[e[7]][2], boxes[e[7]][3], D, e[6], e[6] + 0.06));
    }
    card(host, D, svg, 'Task Status Lifecycle', 'working pauses at input_required until tasks/update resumes it, then ends in one terminal status',
      'State diagram of an MCP task. Working moves to input_required when the server needs client input, and back to working after a tasks/update call. Working moves to completed when the work finishes, to cancelled after tasks/cancel, or to failed on a protocol error. Completed, cancelled, and failed are terminal and shown with a dashed border.',
      'Every tasks/get poll repeats a working snapshot until a terminal status arrives; that self-loop is not drawn. A cancel or a protocol error can also end a task directly from input_required. SEP-2663 inlines the completed result and the failed error into this same tasks/get response; there is no separate tasks/result call.');
  }

  function trustZonesFigure(host) {
    var D = 7;
    var svg = stage(560, 230);
    svg.appendChild(txt(91, 18, 'trusted zone', MUTE, MID));
    svg.appendChild(txt(380, 18, 'untrusted zone', MUTE, MID));
    svg.appendChild(pth('M8 26L174 26L174 206L8 206Z', RULE, DASH));
    svg.appendChild(ln(190, 26, 190, 206, RULE, DASH));
    svg.appendChild(txt(196, 34, 'trust boundary', MUTE));
    svg.appendChild(box(20, 40, 140, 36, 'host', 'the user\'s app'));
    svg.appendChild(box(20, 88, 140, 36, 'client', 'one per server'));
    svg.appendChild(box(230, 94, 110, 36, 'server', 'third party'));
    svg.appendChild(box(390, 94, 140, 36, 'upstream systems', 'once removed'));
    svg.appendChild(box(20, 156, 140, 40, 'model', 'sees labeled data'));
    svg.appendChild(pth('M190 90L206 108L190 126L174 108Z', BP, { fill: SURF, 'stroke-width': 2 }));
    svg.appendChild(txt(195, 142, 'trust filter', MUTE, MID));
    svg.appendChild(send([[90, 76], [90, 88]], D, 0.03, 0.13, BP));
    svg.appendChild(send([[160, 98], [230, 98]], D, 0.15, 0.25, BP));
    svg.appendChild(send([[340, 112], [390, 112]], D, 0.31, 0.41, MUTE, DASH));
    svg.appendChild(send([[230, 118], [160, 118]], D, 0.47, 0.75, MUTE, DASH, null));
    svg.appendChild(packet(route([[230, 118], [190, 118]]), D, 0.47, 0.59, MUTE));
    svg.appendChild(spot(174, 90, 32, 36, D, 0.59, 0.65, BP));
    svg.appendChild(packet(route([[190, 118], [160, 118]]), D, 0.63, 0.75, BP));
    svg.appendChild(send([[90, 124], [90, 156]], D, 0.77, 0.85, BP));
    svg.appendChild(spot(20, 156, 140, 40, D, 0.85, 0.89, BP));
    card(host, D, svg, 'Trust Zones in an MCP Exchange', 'host and client trusted, server and upstream untrusted, the model reads only labeled content',
      'Host, client, and model sit inside a trusted zone on the left, connected by short arrows. A dashed trust boundary separates them from the server zone on the right. A request crosses the boundary to the server. Content returning from the server crosses back through a trust filter marked untrusted before the model reads it. The server connects onward to upstream systems that the client never sees directly.',
      'The host and the client it owns sit with the model inside one trust domain. A request crosses the dashed boundary to reach the server; whatever the server returns crosses back through the trust filter, marked untrusted, before the model reads it. The server may reach further upstream systems that the client never observes directly.');
  }

  function oauthFlowFigure(host) {
    var D = 8;
    var svg = stage(560, 228);
    [
      [46, '1. tools/call with no token', 'mcp server', 'tools/call, no Authorization header', MUTE, DASH, '401 + WWW-Authenticate: resource_metadata=...', ERR, false, 0.04],
      [122, '2. discover, PKCE, authorize', 'auth server', 'PRM + AS metadata + S256 challenge + resource + state', BP, null, 'code + iss checked against the recorded issuer', BP, false, 0.32],
      [198, '3. retry with a bearer token', 'mcp server', 'tools/call, Authorization: Bearer <token>', BP, null, '200, resultType complete (audience validated)', BP, true, 0.58]
    ].forEach(function (lane) {
      var y = lane[0];
      var a = lane[9];
      svg.appendChild(txt(16, y - 22, lane[1], INK, { 'font-size': 12, 'font-weight': 700 }));
      svg.appendChild(box(16, y - 12, 84, 24, 'client'));
      svg.appendChild(box(460, y - 12, 84, 24, lane[2]));
      svg.appendChild(show(txt(280, y - 8, lane[3], SOFT, MID), D, a));
      svg.appendChild(send([[100, y], [460, y]], D, a, a + 0.09, lane[4], lane[5]));
      svg.appendChild(show(txt(280, y + 14, lane[6], lane[7], MID), D, a + 0.11));
      svg.appendChild(packet(route([[460, y], [100, y]]), D, a + 0.11, a + 0.2, lane[7]));
      if (lane[8]) svg.appendChild(spot(458, y - 14, 88, 28, D, a + 0.2, a + 0.26, BP));
    });
    card(host, D, svg, 'Authorizing an MCP Request', 'a 401, a round trip to the authorization server, then a bearer-authenticated retry',
      'Three lanes. Top: the client calls tools/call with no token and the server replies HTTP 401 with a WWW-Authenticate header naming the Protected Resource Metadata URL, no JSON-RPC body. Middle: the client discovers Protected Resource Metadata and authorization server metadata, generates a PKCE S256 pair, and the authorization server returns a code and an iss value the client checks against what it recorded. Bottom: the client retries the same tools/call with an Authorization Bearer header and the server returns a complete result after validating the token audience.',
      'Rejection happens at the HTTP layer with no JSON-RPC body. The middle lane resolves entirely outside the MCP wire: Protected Resource Metadata, authorization server metadata, PKCE, and an iss check the client applies itself. Only the retried tools/call, now carrying a bearer token whose audience matches this server, reaches the tool.');
  }

  function registrationPathsFigure(host) {
    var D = 8;
    var svg = stage(560, 300);
    var steps = [
      ['1', 'Pre-registered credentials', 'client id already on file', false],
      ['2', 'Client ID Metadata Document', 'AS advertises CIMD support', false],
      ['3', 'Dynamic Client Registration', 'deprecated fallback via DCR', true],
      ['4', 'Ask the user', 'no automated path available', false]
    ];
    var rowH = 54, gapY = 16, top = 18, colX = 8, colW = 300, midX = colX + colW / 2;
    var seq = [0.04, 0.2, 0.36, 0.52];
    steps.forEach(function (step, i) {
      var y = top + i * (rowH + gapY);
      svg.appendChild(rct(colX, y, colW, rowH, step[3] ? MUTE : BP, SURF, step[3] ? DASH : { 'stroke-width': 1.4 }));
      svg.appendChild(txt(colX + 12, y + 22, step[0], BP, { 'font-size': 13, 'font-weight': 700 }));
      svg.appendChild(txt(colX + 30, y + 22, step[1], INK, BOLD));
      svg.appendChild(txt(colX + 30, y + 39, step[2], MUTE));
      svg.appendChild(spot(colX, y, colW, rowH, D, seq[i], seq[i] + 0.07, step[3] ? MUTE : BP));
      if (i < 3) {
        var y1 = y + rowH;
        var y2 = y1 + gapY - 4;
        var a = seq[i] + 0.08;
        svg.appendChild(send([[midX, y1], [midX, y2]], D, a, seq[i + 1] - 0.02, MUTE));
        svg.appendChild(show(txt(midX + 10, y1 + gapY / 2 + 4, 'if unavailable', SOFT), D, a));
      }
    });
    var panelX = colX + colW + 18;
    var panelW = 560 - panelX - 8;
    var panelH = steps.length * (rowH + gapY) - gapY;
    svg.appendChild(rct(panelX, top, panelW, panelH, RULE, SURF));
    svg.appendChild(txt(panelX + 12, top + 22, 'a CIMD checked like this', INK, BOLD));
    var checklist = ['client_id equals the URL', 'https scheme with a path', 'redirect_uris validated', 'kept keyed by issuer'];
    checklist.forEach(function (item, i) {
      var cy = top + 46 + i * 46;
      var a = 0.6 + i * 0.06;
      svg.appendChild(pop([svgEl('circle', { cx: panelX + 18, cy: cy, r: 5, fill: BP }), txt(panelX + 32, cy + 4, item, MUTE)], panelX + 18, cy, D, a));
    });
    card(host, D, svg, 'Client Registration Paths', 'priority order for a client an authorization server has never met',
      'A four step priority ladder: pre-registered credentials, Client ID Metadata Document, Dynamic Client Registration marked deprecated, and asking the user, each tried in order when the one above is unavailable. Beside it, a checklist of what an authorization server verifies in a Client ID Metadata Document and why credentials are kept per issuer.',
      'A client tries each path in order and stops at the first one available: pre-registered credentials, then a Client ID Metadata Document if the authorization server advertises it, then Dynamic Client Registration as a deprecated fallback, then asking the user. Credentials from any path are kept keyed by the issuing authorization server and are never reused against a different one.');
  }

  function consentGatesFigure(host) {
    var D = 7;
    var svg = stage(560, 210);
    var loop1 = 'M172 80 C150 132 245 132 222 80';
    var loop2 = 'M334 80 C310 132 410 132 386 80';
    svg.appendChild(grp([rct(8, 40, 96, 40), txt(14, 57, 'tools/call'), txt(14, 72, 'client sends', MUTE)]));
    svg.appendChild(box(140, 40, 112, 40, 'scope check', '403 if short'));
    svg.appendChild(box(304, 40, 112, 40, 'consent check', 'input_required'));
    svg.appendChild(pth(loop1, MUTE, DASH));
    svg.appendChild(pth(loop2, MUTE, DASH));
    svg.appendChild(send([[104, 60], [138, 60]], D, 0.03, 0.11, BP));
    svg.appendChild(spot(140, 40, 112, 40, D, 0.13, 0.2, BP));
    svg.appendChild(show(txt(137, 150, '403: union + retry', SOFT), D, 0.22));
    svg.appendChild(packet(loop1, D, 0.22, 0.34, MUTE));
    svg.appendChild(send([[252, 60], [302, 60]], D, 0.37, 0.45, BP));
    svg.appendChild(show(txt(278, 32, 'scope ok', SOFT, { 'text-anchor': 'middle' }), D, 0.37));
    svg.appendChild(spot(304, 40, 112, 40, D, 0.47, 0.54, BP));
    svg.appendChild(show(txt(273, 150, 'no consent: elicit, retry', SOFT), D, 0.57));
    svg.appendChild(packet(loop2, D, 0.57, 0.69, MUTE));
    svg.appendChild(send([[416, 60], [438, 60]], D, 0.71, 0.79, BP));
    svg.appendChild(show(txt(428, 32, 'consent ok', SOFT, { 'text-anchor': 'middle' }), D, 0.71));
    svg.appendChild(pop([box(440, 40, 104, 40, 'tool runs', 'isError: false')], 492, 60, D, 0.8));
    card(host, D, svg, 'Consent and Least Privilege', 'one tools/call, two independent gates before it runs',
      'A client tools/call first meets a scope check. Insufficient scope returns HTTP 403 and the client retries with the union of its old and challenged scopes. Once scope is sufficient the call meets a consent check. If consent is required the server returns input_required and the client retries after an elicitation round trip. Only then does the tool run.',
      'A tools/call meets the scope gate first: insufficient scope comes back as HTTP 403, and the client retries with the union of its old and newly challenged scopes, capped at a few attempts. Only once scope clears does the call meet the consent gate: a tool needing approval comes back input_required, and the client retries after an elicitation round trip. Either gate can turn a call away on its own.');
  }

  function attackSurfaceFigure(host) {
    var D = 8;
    var svg = stage(560, 300);
    var threats = ['poisoned description', 'rug pull', 'tool shadowing', 'token passthrough', 'requestState tamper', 'network $ref (SSRF)', 'DNS rebinding', 'supply chain drift'];
    var cx = 280, cy = 150, r = 128;
    var spokes = threats.map(function (label, i) {
      var angle = (Math.PI * 2 * i) / threats.length - Math.PI / 2;
      var p = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
      svg.appendChild(ln(cx, cy, p[0], p[1], MUTE, { 'stroke-width': 1 }));
      return p;
    });
    var ring = svgEl('circle', { cx: cx, cy: cy, r: 62, fill: 'none', stroke: BP, 'stroke-width': 2 });
    ring.appendChild(anim('opacity', '0.15;0.45;0.15', D));
    svg.appendChild(ring);
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 56, fill: BG, stroke: BP, 'stroke-width': 1.6 }));
    svg.appendChild(txt(cx, cy - 4, 'gateway', INK, { 'text-anchor': 'middle', 'font-weight': 600 }));
    svg.appendChild(txt(cx, cy + 12, 'pin . scan . limit', SOFT, { 'text-anchor': 'middle', 'font-size': 10 }));
    threats.forEach(function (label, i) {
      var p = spokes[i];
      var a = 0.04 + i * 0.075;
      svg.appendChild(packet(route([p, [cx + 56 * (p[0] - cx) / r, cy + 56 * (p[1] - cy) / r]]), D, a + 0.05, a + 0.13, MUTE));
      svg.appendChild(pop([rct(p[0] - 70, p[1] - 12, 140, 24, RULE, SURF, { rx: 3 }), txt(p[0] - 60, p[1] + 4, label, INK, { 'font-size': 10 })], p[0], p[1], D, a));
    });
    svg.appendChild(spot(cx - 64, cy - 64, 128, 128, D, 0.68, 0.78, BP, { rx: 64 }));
    card(host, D, svg, 'Attack Surface Around a Tool Call', 'eight threats a gateway still faces after consent and OAuth are both correct',
      'A central gateway node surrounded by eight labeled threats: poisoned description, rug pull, tool shadowing, token passthrough, requestState tamper, network dollar-ref SSRF, DNS rebinding, and supply chain drift, each connected to the gateway by a spoke.',
      'Each spoke names one threat this lesson covers. The gateway at the center holds the controls that answer them: definition pinning and quarantine for rug pulls, an injection scanner for poisoned descriptions, server-qualified names against shadowing, audience validation against passthrough, integrity-protected state, a refusal to auto-dereference network references, and admission pinning against supply chain drift, so no single control has to catch everything alone.');
  }

  function tracePropagationFigure(host) {
    var D = 7;
    var svg = stage(560, 170);
    [[8, 'client'], [234, 'ops-desk'], [460, 'cred-vault']].forEach(function (b) {
      svg.appendChild(grp([rct(b[0], 20, 92, 34), txt(b[0] + 46, 41, b[1], INK, MID)]));
    });
    svg.appendChild(txt(280, 104, 'own audit log', MUTE, MID));
    svg.appendChild(txt(506, 104, 'own audit log', MUTE, MID));
    svg.appendChild(send([[100, 37], [234, 37]], D, 0.03, 0.12, BP));
    svg.appendChild(show(txt(167, 64, 'trace a1e4c9d0', MUTE, MID), D, 0.14));
    svg.appendChild(show(txt(167, 78, 'span 5f2b8e13', MUTE, MID), D, 0.14));
    svg.appendChild(send([[326, 37], [460, 37]], D, 0.24, 0.33, BP));
    svg.appendChild(show(txt(393, 64, 'trace a1e4c9d0', MUTE, MID), D, 0.35));
    svg.appendChild(show(txt(393, 78, 'span d40a7c66', MUTE, MID), D, 0.35));
    var chainX = [[245, 471], [273, 499], [301, 527]];
    chainX.forEach(function (pair, k) {
      var a = 0.48 + k * 0.08;
      svg.appendChild(pop([rct(pair[0], 112, 14, 14, BP, SURF, { rx: 2 })], pair[0] + 7, 119, D, a));
      svg.appendChild(pop([rct(pair[1], 112, 14, 14, BP, SURF, { rx: 2 })], pair[1] + 7, 119, D, a));
      if (k > 0) {
        svg.appendChild(show(ln(chainX[k - 1][0] + 14, 119, pair[0], 119, BP), D, a));
        svg.appendChild(show(ln(chainX[k - 1][1] + 14, 119, pair[1], 119, BP), D, a));
      }
    });
    svg.appendChild(show(txt(393, 152, 'same trace id above, its own hash chain below', MUTE, MID), D, 0.74));
    card(host, D, svg, 'Trace Propagation and the Audit Chain', 'one trace id, three programs, two independent logs',
      'A client calls ops-desk, which calls credential-vault. Both arrows carry the same trace id and a different span id per hop. Below ops-desk and credential-vault, two separate three-entry hash chains represent each server keeping its own independent audit log.',
      'The trace id stays constant across both hops while each arrow mints its own span id. ops-desk and credential-vault each keep an independent, hash-chained audit log: neither log reads or writes the other’s entries, so the only thing that ties one server’s entry to the other’s is a shared trace id, never a shared request id.');
  }

  function rolesMapFigure(host) {
    var D = 7;
    var svg = stage(560, 200);
    var panels = [
      ['stdio', 8, [['author: discover', false], ['operator: env creds', true], ['user: can deny call', false]]],
      ['http, no gateway', 196, [['author: PRM, origin', true], ['client: RFC 8707', false], ['governance: tokens', false]]],
      ['gateway-fronted', 384, [['operator: origin', true], ['author: keeps PRM', false], ['governance: tokens', false]]]
    ];
    var pw = 168, hh = 26, rh = 34, top = 30, bh = hh + 3 * rh + 10;
    var pulses = [];
    panels.forEach(function (panel, i) {
      var x = panel[1];
      var kids = [rct(x, top, pw, bh), rct(x, top, pw, hh, RULE, 'none'), txt(x + 9, top + 17, panel[0], INK, BOLD)];
      panel[2].forEach(function (row, j) {
        var ry = top + hh + 14 + j * rh;
        var col = row[1] ? ERR : BP;
        kids.push(svgEl('circle', { cx: x + 13, cy: ry, r: 6, fill: col }));
        if (row[1]) kids.push(txt(x + 13, ry + 4, '!', '#fff', { 'font-size': 9, 'font-weight': 700, 'text-anchor': 'middle' }));
        kids.push(txt(x + 26, ry + 4, row[0], MUTE));
        if (row[1] && i > 0) pulses.push([x + 4, ry - 14, pw - 8, 28]);
      });
      svg.appendChild(pop(kids, x + pw / 2, top + bh / 2, D, 0.04 + i * 0.12));
    });
    pulses.forEach(function (p, i) {
      svg.appendChild(spot(p[0], p[1], p[2], p[3], D, 0.4 + i * 0.14, 0.5 + i * 0.14, ERR));
    });
    svg.appendChild(show(txt(8, 188, 'circle marks the owner; the flagged row is the requirement that changes owner', SOFT), D, 0.76));
    card(host, D, svg, 'Roles Map', 'the same MUST, three deployments, two different owners',
      'Three panels: stdio, plain HTTP with no gateway, and a gateway-fronted deployment. Each panel names which role owns a sample of that shape\'s MUST and SHOULD requirements. The origin validation requirement is flagged in both HTTP panels: the server author owns it under plain HTTP, but ownership moves to the platform or gateway operator once a gateway sits in front of the server.',
      'Adoption changes who signs up for a MUST, not whether it still applies. Origin validation is a server MUST in every HTTP-reachable deployment; plain HTTP leaves it with the server author, and a gateway-fronted deployment moves it to the platform or gateway operator who terminates the connection first.');
  }

  function useCaseMatrixFigure(host) {
    var D = 7;
    var svg = stage(560, 254);
    var header = ['use case', 'primitive', 'transport', 'extension'];
    var rows = [
      ['developer tools', 'tool', 'stdio', 'none'],
      ['data access', 'resource', 'http', 'none'],
      ['long job', 'tool', 'http', 'tasks'],
      ['interactive UI', 'tool', 'http', 'ui'],
      ['reusable flow', 'prompt', 'http', 'skills'],
      ['M2M sync', 'tool', 'http', 'auth-cc']
    ];
    var colX = [8, 168, 296, 424];
    var rowH = 28, headerH = 28, top = 20;
    var gridH = headerH + rows.length * rowH;
    svg.appendChild(rct(8, top, 544, gridH));
    svg.appendChild(rct(8, top, 544, headerH, 'none', BP, { 'fill-opacity': 0.12 }));
    header.forEach(function (h, c) { svg.appendChild(txt(colX[c] + 8, top + 18, h, INK, BOLD)); });
    colX.forEach(function (x, c) { if (c) svg.appendChild(ln(x, top, x, top + gridH, RULE)); });
    rows.forEach(function (row, i) {
      var rowY = top + headerH + i * rowH;
      var a = 0.06 + i * 0.12;
      svg.appendChild(spot(8, rowY, 544, rowH, D, a, a + 0.1));
      var kids = [];
      if (i % 2 === 1) kids.push(rct(8, rowY, 544, rowH, 'none', SOFT, { 'fill-opacity': 0.06 }));
      row.forEach(function (cell, c) { kids.push(txt(colX[c] + 8, rowY + 19, cell, c === 0 ? INK : MUTE)); });
      svg.appendChild(show(grp(kids), D, a));
    });
    svg.appendChild(show(grp([txt(8, 234, 'http stands for streamable-http;', SOFT), txt(8, 248, 'auth-cc stands for the OAuth client credentials extension', SOFT)]), D, 0.82));
    card(host, D, svg, 'Operational Use Case Matrix', 'six scenarios, four questions each',
      'A table of six operational use cases (developer tools, data access, long job, interactive UI, reusable flow, machine to machine sync) against the MCP primitive, transport, and extension each one recommends. Developer tools takes a tool over stdio with no extension. Data access takes a resource over HTTP. A long job takes a tool with the tasks extension. An interactive UI takes a tool with the MCP Apps ui extension. A reusable flow takes a prompt with the skills extension. Machine to machine sync takes a tool with the OAuth client credentials extension.',
      'Four questions, who initiates the call, how sensitive is the data, how long does it run, and does it need an interactive surface, pick the primitive, the transport, the auth path, and the extension for each use case in this lesson\'s catalog.');
  }

  function extensionNegotiationFigure(host) {
    var D = 8;
    var svg = stage(560, 248);
    svg.appendChild(txt(16, 26, 'client _meta declares', INK, { 'font-size': 12, 'font-weight': 700 }));
    svg.appendChild(txt(304, 26, 'server capabilities declares', INK, { 'font-size': 12, 'font-weight': 700 }));
    svg.appendChild(rct(16, 34, 240, 70, RULE, 'none'));
    svg.appendChild(rct(304, 34, 240, 70, RULE, 'none'));
    var chips = [
      [26, 44, 'io.modelcontextprotocol/ui'],
      [26, 70, 'com.example/priority-routing'],
      [314, 44, 'com.example/priority-routing'],
      [314, 70, 'io.modelcontextprotocol/tasks']
    ];
    chips.forEach(function (ch, i) {
      var kids = [rct(ch[0], ch[1], 220, 20, RULE, SURF, { rx: 3 }), txt(ch[0] + 6, ch[1] + 14, ch[2])];
      svg.appendChild(pop(kids, ch[0] + 110, ch[1] + 10, D, 0.03 + i * 0.045));
    });
    svg.appendChild(spot(24, 68, 224, 24, D, 0.24, 0.34));
    svg.appendChild(spot(312, 42, 224, 24, D, 0.27, 0.37));
    svg.appendChild(send([[136, 104], [270, 132]], D, 0.4, 0.5));
    svg.appendChild(send([[424, 104], [290, 132]], D, 0.44, 0.54));
    svg.appendChild(pop([rct(150, 132, 260, 28, BP, SURF, { 'stroke-width': 1.4 }), txt(160, 150, 'active: com.example/priority-routing')], 280, 146, D, 0.56));
    svg.appendChild(send([[136, 64], [96, 118]], D, 0.65, 0.69, MUTE, DASH, null));
    svg.appendChild(send([[424, 90], [464, 118]], D, 0.68, 0.72, MUTE, DASH, null));
    var legend = [
      [BP, 'none', null, 176, 'both sides declare an optional extension: it activates, response is enhanced'],
      [SURF, MUTE, DASH, 198, 'only one side declares it: the call falls back to core behavior'],
      [INK, 'none', null, 220, 'required but not mutually active: the call is rejected, -32021']
    ];
    legend.forEach(function (le, i) {
      var sw = rct(16, le[3], 12, 12, le[1], le[0], le[2]);
      svg.appendChild(show(grp([sw, txt(36, le[3] + 10, le[4], SOFT)]), D, 0.73 + i * 0.03));
    });
    card(host, D, svg, 'The Extensions Framework', 'per-request negotiation, then activate, fall back, or reject',
      'Two boxes show what the client declares in its per-request clientCapabilities.extensions and what the server declares in its server/discover capabilities.extensions. A solid line converges the identifier present in both into an active box; dashed lines show identifiers only one side declared. Below, three outcomes: both sides declaring an optional extension gives an enhanced response, only one side declaring it gives a core fallback, and a required extension that is not mutually active is rejected with -32021.',
      'The client declares extensions in _meta[\'io.modelcontextprotocol/clientCapabilities\'].extensions on every request; the server declares its own in server/discover capabilities.extensions. Only an identifier both sides name becomes active. An unmatched optional extension falls back to core behavior; an unmatched mandatory extension gets MissingRequiredClientCapability, -32021, naming what was needed.');
  }

  function appSandboxFigure(host) {
    var D = 9;
    var svg = stage(560, 260);
    svg.appendChild(txt(10, 16, 'negotiate the ui extension per request, then review before rendering', MUTE));
    svg.appendChild(box(8, 92, 84, 56, 'server', 'tool + ui'));
    svg.appendChild(box(126, 92, 104, 56, 'review', 'mime + csp'));
    svg.appendChild(box(426, 92, 110, 56, 'consent', 'tool call'));
    svg.appendChild(send([[92, 120], [126, 120]], D, 0.03, 0.11));
    svg.appendChild(show(txt(40, 84, 'resources/read', MUTE), D, 0.03));
    svg.appendChild(spot(124, 90, 108, 60, D, 0.11, 0.18));
    svg.appendChild(send([[230, 120], [270, 120]], D, 0.2, 0.28));
    svg.appendChild(show(txt(200, 84, 'review passes', MUTE), D, 0.2));
    svg.appendChild(pop([box(270, 92, 120, 56, 'app view', 'in sandbox')], 330, 120, D, 0.28));
    svg.appendChild(send([[390, 120], [426, 120]], D, 0.37, 0.45));
    svg.appendChild(show(txt(355, 84, 'app requests call', MUTE), D, 0.37));
    svg.appendChild(spot(424, 90, 114, 60, D, 0.45, 0.52));
    svg.appendChild(send([[481, 148], [481, 240], [50, 240], [50, 148]], D, 0.55, 0.66));
    svg.appendChild(show(txt(250, 232, 'tools/call, new id', MUTE), D, 0.55));
    svg.appendChild(send([[178, 148], [178, 190]], D, 0.69, 0.76, MUTE));
    svg.appendChild(show(txt(186, 172, 'reject', MUTE), D, 0.69));
    svg.appendChild(pop([rct(128, 190, 100, 38, BP, SURF, DASH), txt(136, 206, 'fallback'), txt(136, 220, 'no ui ext', MUTE)], 178, 209, D, 0.76));
    card(host, D, svg, 'Rendering an Interactive Interface', 'negotiate, review, then render or fall back',
      'A tool\'s ui resource flows from the server through a host review of its mime type and CSP origins, either rendering inside a sandboxed iframe that requests further tool calls through a consent gate back to the server, or falling back to plain text when the extension is not declared or the review fails.',
      'A tool\'s ui:// resource only becomes a sandboxed app after the host checks its mime type and CSP origins against its own allowlist; failing either check, or never declaring the extension at all, routes to the same text fallback every tool already returns. An app-initiated tool call still crosses the host\'s consent gate before it reaches the server as an ordinary tools/call.');
  }

  function registryGatewayFigure(host) {
    var D = 8;
    var svg = stage(560, 320);
    function stat(b) { svg.appendChild(box(b[0], b[1], b[2], b[3], b[4], b[5], BP, SURF)); }
    [[30, 20, 120, 44, 'Publisher', 'proves owner'], [200, 20, 150, 44, 'Registry', 'server.json'], [420, 20, 120, 44, 'Aggregator', 'polls hourly'],
      [30, 104, 110, 44, 'Client', 'the caller'], [190, 104, 170, 44, 'Gateway', 'header = body?'], [410, 104, 120, 44, 'Backend', 'Tier 1 SDK']].forEach(stat);
    svg.appendChild(txt(30, 78, 'public listings only; the registry is a preview', SOFT));
    svg.appendChild(txt(30, 246, 'SDK conformance tiers, checked continuously', SOFT));
    svg.appendChild(send([[150, 42], [200, 42]], D, 0.03, 0.09, MUTE));
    svg.appendChild(show(txt(148, 14, 'verified', SOFT), D, 0.03));
    svg.appendChild(send([[350, 42], [420, 42]], D, 0.11, 0.17, MUTE));
    svg.appendChild(show(txt(358, 14, 'polled', SOFT), D, 0.11));
    svg.appendChild(send([[140, 126], [190, 126]], D, 0.22, 0.28, MUTE));
    svg.appendChild(spot(188, 102, 174, 48, D, 0.28, 0.34));
    svg.appendChild(send([[360, 126], [410, 126]], D, 0.36, 0.42));
    svg.appendChild(show(txt(370, 118, 'match', SOFT), D, 0.36));
    svg.appendChild(send([[140, 126], [190, 126]], D, 0.47, 0.53, MUTE));
    svg.appendChild(send([[275, 148], [275, 180]], D, 0.55, 0.61, ERR));
    svg.appendChild(show(txt(283, 172, 'mismatch', SOFT), D, 0.55));
    svg.appendChild(pop([rct(190, 180, 170, 40, MUTE, SURF, DASH), txt(200, 198, '-32020', INK, BOLD), txt(200, 214, 'header != body', MUTE)], 275, 200, D, 0.61));
    [[30, 'Tier 1', '100% conformance'], [210, 'Tier 2', '80% conformance'], [390, 'Tier 3', 'experimental']].forEach(function (t, i) {
      svg.appendChild(pop([rct(t[0], 256, 160, 46), txt(t[0] + 10, 274, t[1], BP, BOLD), txt(t[0] + 10, 290, t[2], MUTE)], t[0] + 80, 279, D, 0.68 + i * 0.05));
    });
    card(host, D, svg, 'Finding, Routing To, and Trusting a Server', 'registry admission, gateway header checks, and SDK tiers as three separate gates',
      'A publisher proves namespace ownership before the registry admits a server.json entry, which an aggregator polls on its own schedule. Separately, a client request to a gateway is routed only after its Mcp-Method and Mcp-Name headers are checked against the request body: a match reaches a Tier 1 backend, a mismatch is rejected as error -32020 before any backend is touched. Below, three SDK conformance tier badges show the pass rate each tier requires, checked continuously rather than once.',
      'A verified namespace gets a server.json into the registry, where only an aggregator reads it on its own schedule. That is unrelated to whether any one request later reaches a backend: a gateway checks Mcp-Method and Mcp-Name against the request body first, routes a match to the backend, and rejects a mismatch as -32020 before it goes further. An SDK tier badge is a third, independent fact, re-measured continuously rather than granted once.');
  }

  function capstoneFlowFigure(host) {
    var D = 8;
    var svg = stage(560, 176);
    var stages = [[4, 84, 'discover'], [96, 108, 'schema check'], [212, 116, 'MRTR consent'], [336, 92, 'task poll'], [436, 120, 'audited result']];
    svg.appendChild(txt(4, 84, 'traceparent: one trace id end to end', MUTE));
    svg.appendChild(pth('M4 90L556 90', MUTE, DASH));
    svg.appendChild(packet(route([[4, 50], [556, 50]]), D, 0.03, 0.4));
    var arrivals = [0.058, 0.128, 0.208, 0.283, 0.36];
    stages.forEach(function (s, i) {
      svg.appendChild(rct(s[0], 28, s[1], 44));
      svg.appendChild(txt(s[0] + 8, 54, s[2]));
      if (i) svg.appendChild(arrow([[stages[i - 1][0] + stages[i - 1][1], 50], [s[0], 50]]));
      var cx = s[0] + s[1] / 2;
      svg.appendChild(spot(s[0] - 2, 26, s[1] + 4, 48, D, arrivals[i], arrivals[i] + 0.06));
      svg.appendChild(pop([svgEl('circle', { cx: cx, cy: 90, r: 3, fill: BP })], cx, 90, D, arrivals[i]));
    });
    svg.appendChild(txt(4, 153, 'audit log:', MUTE));
    var entries = [76, 118, 160, 202];
    entries.forEach(function (e, i) {
      if (i) svg.appendChild(show(arrow([[entries[i - 1] + 30, 149], [e, 149]]), D, 0.44 + i * 0.07));
      svg.appendChild(pop([rct(e, 134, 30, 30, BP, SURF, { rx: 3 }), txt(e + 8, 153, 'e' + (i + 1))], e + 15, 149, D, 0.44 + i * 0.07, 0.44 + i * 0.07 + 0.06));
    });
    svg.appendChild(show(txt(240, 153, 'verify: ok', MUTE), D, 0.72));
    svg.appendChild(pop([rct(330, 134, 226, 30, MUTE, 'none', DASH), txt(338, 153, 'OAuth: audience checked')], 443, 149, D, 0.78));
    card(host, D, svg, 'Capstone Exchange', 'discovery through consent, a task, and an audited result',
      'A capstone exchange: server discover feeds a schema check, an MRTR consent round trip, a task that is polled to completion, and an audited result. A dashed line beneath the pipeline shows one trace id propagated across every stage. Below that, a four entry hash chained audit log verifies, and a separate OAuth audience check gates one HTTP call.',
      'One incident response exchange touches every domain at once: discovery with cache hints, a schema check that returns isError before it ever asks for consent, an MRTR round trip protected by an HMAC signed requestState, a task polled to completion, and a result. The same trace id threads every hop, an OAuth audience check gates the one HTTP call, and a hash chained audit log records the outcome of each step and still verifies at the end.');
  }

  LF.register({
    'mcpa-00-blueprint-weights': blueprintWeightsFigure,
    'mcpa-01-spec-map': specMapFigure,
    'mcpa-02-n-by-m': nByMFigure,
    'mcpa-03-envelope': envelopeFigure,
    'mcpa-04-stateless-requests': statelessRequestsFigure,
    'mcpa-05-era-matrix': eraMatrixFigure,
    'mcpa-06-topology': topologyFigure,
    'mcpa-07-discover': discoverCapabilityFigure,
    'mcpa-08-schema-contract': schemaContractFigure,
    'mcpa-09-manifest-anatomy': manifestAnatomyFigure,
    'mcpa-10-interaction-flow': modelInteractionFlowFigure,
    'mcpa-11-tool-call': toolCallFigure,
    'mcpa-12-resource-read': resourceReadFigure,
    'mcpa-13-prompt-template': promptTemplateFigure,
    'mcpa-14-mrtr': mrtrFigure,
    'mcpa-15-deprecation-timeline': deprecationTimelineFigure,
    'mcpa-16-subscription-stream': subscriptionStreamFigure,
    'mcpa-17-lifecycle': toolLifecycleFigure,
    'mcpa-18-error-taxonomy': errorTaxonomyFigure,
    'mcpa-19-transports': transportsFigure,
    'mcpa-20-cache-freshness': cacheFreshnessFigure,
    'mcpa-21-task-states': taskStateLifecycleFigure,
    'mcpa-22-trust-zones': trustZonesFigure,
    'mcpa-23-oauth-flow': oauthFlowFigure,
    'mcpa-24-registration-paths': registrationPathsFigure,
    'mcpa-25-consent-gates': consentGatesFigure,
    'mcpa-26-attack-surface': attackSurfaceFigure,
    'mcpa-27-trace-propagation': tracePropagationFigure,
    'mcpa-28-roles-map': rolesMapFigure,
    'mcpa-29-use-case-matrix': useCaseMatrixFigure,
    'mcpa-30-extension-negotiation': extensionNegotiationFigure,
    'mcpa-31-app-sandbox': appSandboxFigure,
    'mcpa-32-registry-flow': registryGatewayFigure,
    'mcpa-33-capstone-flow': capstoneFlowFigure
  });
})();
