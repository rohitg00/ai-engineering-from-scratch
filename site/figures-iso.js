(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var AX = 0.8660254;
  var AY = 0.5;
  var SHINE = 0.45;
  var SHADE = 0.16;
  var SCALE = 1.5;
  var ROW_SPREAD = 1.6;

  var MACHINES = {
    'self-attention': {
      title: 'Self-attention, part by part',
      parts: [
        { id: 'x', label: 'X', note: 'token embeddings', col: 40, row: 0, size: 34, h: 26, kind: 'stack' },
        { id: 'wq', label: 'Wq', note: 'query projection', col: 150, row: -52, size: 26, h: 10 },
        { id: 'wk', label: 'Wk', note: 'key projection', col: 150, row: 0, size: 26, h: 10 },
        { id: 'wv', label: 'Wv', note: 'value projection', col: 150, row: 52, size: 26, h: 10 },
        { id: 'scores', label: 'Q·Kᵀ/√d', note: 'scaled scores', col: 270, row: -26, size: 36, h: 14 },
        { id: 'softmax', label: 'softmax', note: 'rows sum to 1', col: 375, row: -26, size: 15, h: 22, kind: 'drum' },
        { id: 'mix', label: 'weights·V', note: 'weighted values', col: 470, row: 26, size: 32, h: 20 },
        { id: 'out', label: 'output', note: 'one vector per token', col: 565, row: 26, size: 28, h: 26, kind: 'stack' }
      ],
      flows: [
        { id: 'x-wq', from: 'x', to: 'wq' }, { id: 'x-wk', from: 'x', to: 'wk' }, { id: 'x-wv', from: 'x', to: 'wv' },
        { id: 'wq-scores', from: 'wq', to: 'scores' }, { id: 'wk-scores', from: 'wk', to: 'scores' },
        { id: 'scores-softmax', from: 'scores', to: 'softmax' }, { id: 'softmax-mix', from: 'softmax', to: 'mix' },
        { id: 'wv-mix', from: 'wv', to: 'mix' }, { id: 'mix-out', from: 'mix', to: 'out' }
      ],
      intro: 'Eight parts. Scroll the Build It steps and the part each step builds lights up.',
      steps: [
        { focus: ['softmax'], flows: [], caption: 'softmax: subtract the row max, exponentiate, divide by the sum' },
        { focus: ['scores', 'softmax', 'mix'], flows: ['wq-scores', 'wk-scores', 'scores-softmax', 'softmax-mix', 'wv-mix'], caption: 'scores = Q·Kᵀ / √d, softmax per row, then weights · V' },
        { focus: ['wq', 'wk', 'wv'], flows: ['x-wq', 'x-wk', 'x-wv'], caption: 'learned matrices Wq, Wk, Wv turn X into Q, K and V' },
        { focus: ['x', 'wq', 'wk', 'wv', 'scores', 'softmax', 'mix', 'out'], flows: 'all', caption: 'one forward pass over a real sentence' },
        { focus: ['softmax', 'out'], flows: ['scores-softmax'], caption: 'read the weight matrix: which token attends to which' }
      ]
    },
    'mini-gpt': {
      title: 'A mini GPT, part by part',
      parts: [
        { id: 'tokens', label: 'ids', note: 'token ids', col: 30, row: 0, size: 26, h: 12, kind: 'stack' },
        { id: 'tok', label: 'wte', note: 'token embedding', col: 115, row: -30, size: 26, h: 18 },
        { id: 'pos', label: 'wpe', note: 'position embedding', col: 115, row: 30, size: 26, h: 18 },
        { id: 'attn', label: 'mask', note: 'causal self-attention', col: 215, row: 0, size: 30, h: 22 },
        { id: 'heads', label: '12 heads', note: 'multi-head attention', col: 305, row: 0, size: 30, h: 22, kind: 'stack' },
        { id: 'block', label: 'block', note: 'LayerNorm, attention, MLP, residuals', col: 395, row: 0, size: 32, h: 34, kind: 'stack' },
        { id: 'head', label: 'lm_head', note: 'logits over the vocabulary', col: 480, row: 0, size: 26, h: 16 },
        { id: 'loss', label: 'loss', note: 'cross-entropy on the next token', col: 570, row: -34, size: 14, h: 18, kind: 'drum' },
        { id: 'sample', label: 'sample', note: 'pick the next token', col: 570, row: 34, size: 14, h: 18, kind: 'drum' }
      ],
      flows: [
        { id: 'tokens-tok', from: 'tokens', to: 'tok' }, { id: 'tokens-pos', from: 'tokens', to: 'pos' },
        { id: 'tok-attn', from: 'tok', to: 'attn' }, { id: 'pos-attn', from: 'pos', to: 'attn' },
        { id: 'attn-heads', from: 'attn', to: 'heads' }, { id: 'heads-block', from: 'heads', to: 'block' },
        { id: 'block-head', from: 'block', to: 'head' }, { id: 'head-loss', from: 'head', to: 'loss' },
        { id: 'head-sample', from: 'head', to: 'sample' }
      ],
      intro: 'Nine parts, from token ids to the next token. Each step below builds one of them.',
      steps: [
        { focus: ['tokens', 'tok', 'pos'], flows: ['tokens-tok', 'tokens-pos'], caption: 'token and position embeddings, summed' },
        { focus: ['attn'], flows: ['tok-attn', 'pos-attn'], caption: 'one head; future positions masked to -inf before softmax' },
        { focus: ['heads'], flows: ['attn-heads'], caption: '768 dims split into 12 heads of 64, then concatenated' },
        { focus: ['block'], flows: ['heads-block'], caption: 'LayerNorm, attention, residual, LayerNorm, MLP, residual' },
        { focus: ['tokens', 'tok', 'pos', 'attn', 'heads', 'block', 'head'], flows: ['tokens-tok', 'tokens-pos', 'tok-attn', 'pos-attn', 'attn-heads', 'heads-block', 'block-head'], caption: 'stack the blocks, add the output projection' },
        { focus: ['head', 'loss'], flows: ['head-loss'], caption: 'training: next-token cross-entropy, then a gradient step' },
        { focus: ['head', 'sample'], flows: ['head-sample'], caption: 'generation: sample one token, append it, run again' }
      ]
    },
    'kv-cache': {
      title: 'Decoding with a KV cache',
      parts: [
        { id: 'token', label: 'x_t', note: 'the newest token', col: 40, row: 0, size: 22, h: 12 },
        { id: 'proj', label: 'q k v', note: 'project only the new token', col: 145, row: 0, size: 30, h: 18 },
        { id: 'kc', label: 'K cache', note: 'keys of every past token', col: 265, row: -40, size: 17, h: 30, kind: 'drum' },
        { id: 'vc', label: 'V cache', note: 'values of every past token', col: 265, row: 40, size: 17, h: 30, kind: 'drum' },
        { id: 'attn', label: 'attend', note: 'one query against all keys', col: 380, row: 0, size: 32, h: 18 },
        { id: 'tiles', label: 'tiles', note: 'softmax one block at a time', col: 480, row: 0, size: 30, h: 10, kind: 'stack' },
        { id: 'out', label: 'out', note: 'context for the next token', col: 570, row: 0, size: 24, h: 18 }
      ],
      flows: [
        { id: 'token-proj', from: 'token', to: 'proj' }, { id: 'proj-kc', from: 'proj', to: 'kc' }, { id: 'proj-vc', from: 'proj', to: 'vc' },
        { id: 'proj-attn', from: 'proj', to: 'attn' }, { id: 'kc-attn', from: 'kc', to: 'attn' }, { id: 'vc-attn', from: 'vc', to: 'attn' },
        { id: 'attn-tiles', from: 'attn', to: 'tiles' }, { id: 'tiles-out', from: 'tiles', to: 'out' }
      ],
      intro: 'Seven parts. The caches grow by one row per token instead of recomputing the past.',
      steps: [
        { focus: ['token', 'proj', 'kc', 'vc', 'attn'], flows: ['token-proj', 'proj-kc', 'proj-vc', 'proj-attn', 'kc-attn', 'vc-attn'], caption: 'append the new k and v; attend with one query' },
        { focus: ['attn', 'tiles'], flows: ['attn-tiles'], caption: 'online softmax: running max and sum, no full N×N matrix' },
        { focus: ['token', 'proj', 'kc', 'vc', 'attn', 'tiles', 'out'], flows: 'all', caption: '100 tokens: 5,050 attention ops naive, 100 with the cache' }
      ]
    }
  };

  function ensureStyles() {
    if (document.getElementById('lf-iso-styles')) return;
    var style = document.createElement('style');
    style.id = 'lf-iso-styles';
    style.textContent = [
      '.lf-iso{--iso-shine:#ffffff;--iso-shade:#1a1a1a}',
      '[data-theme="dark"] .lf-iso{--iso-shine:#3a4266;--iso-shade:#000000}',
      '.lesson-figure.lf-animated:has(> .lf-iso){border:0;padding:0;background:none}',
      '.lf-iso{margin:0}',
      '.lf-iso .lf-body{padding:12px 16px 16px}',
      '.iso-caption{min-height:2.6em;margin:0 0 8px;font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.5;color:var(--ink-soft,#4a4a4a)}',
      '.iso-caption b{color:var(--blueprint,#3553ff);font-weight:500;letter-spacing:.08em;margin-right:8px}',
      '.iso-stage{overflow-x:auto;overscroll-behavior-x:contain}',
      '.iso-stage svg{display:block;width:100%;min-width:500px;height:auto}',
      '.iso-part{transition:opacity 220ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.iso-part .iso-ink{stroke:var(--ink-soft,#4a4a4a);stroke-width:1.2;fill:none;stroke-linejoin:round;transition:stroke 220ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.iso-part .iso-edge{stroke:var(--ink-soft,#4a4a4a);stroke-opacity:.45;stroke-width:.8;fill:none}',
      '.iso-part .iso-face{fill:var(--bg-surface,#f3f1e8)}',
      '.iso-part .iso-base{fill:var(--bg,#fafaf5)}',
      '.iso-part .iso-shine{fill:var(--iso-shine);fill-opacity:' + SHINE + '}',
      '.iso-part .iso-shade{fill:var(--iso-shade);fill-opacity:' + SHADE + '}',
      '.iso-part .iso-tint{fill:var(--blueprint,#3553ff);fill-opacity:0;transition:fill-opacity 220ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.iso-part .iso-shadow{fill:var(--blueprint,#3553ff);fill-opacity:.1}',
      '.iso-part .iso-num{fill:var(--bg,#fafaf5);stroke:var(--ink-soft,#4a4a4a);stroke-width:1}',
      '.iso-part .iso-num-text{font-family:var(--font-mono,monospace);font-size:14px;fill:var(--ink,#1a1a1a);text-anchor:middle}',
      '.iso-part.is-on .iso-ink{stroke:var(--blueprint,#3553ff);stroke-width:1.8}',
      '.iso-part.is-on .iso-tint{fill-opacity:.2}',
      '.iso-part.is-on .iso-num{stroke:var(--blueprint,#3553ff);fill:var(--blueprint,#3553ff)}',
      '.iso-part.is-on .iso-num-text{fill:var(--bg,#fafaf5)}',
      '.lf-iso.has-step .iso-part:not(.is-on){opacity:.42}',
      '.iso-flow{fill:none;stroke:var(--ink-mute,#7a7a78);stroke-width:1;stroke-dasharray:3 3;transition:opacity 220ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.lf-iso.has-step .iso-flow:not(.is-on){opacity:.3}',
      '.iso-flow.is-on{stroke:var(--blueprint,#3553ff);stroke-width:1.8;stroke-dasharray:none;animation:iso-draw 420ms var(--ease-out,cubic-bezier(.23,1,.32,1)) both}',
      '.iso-head{fill:var(--ink-mute,#7a7a78)}',
      '.iso-head.is-on{fill:var(--blueprint,#3553ff)}',
      '@keyframes iso-draw{from{stroke-dasharray:var(--iso-len,200);stroke-dashoffset:var(--iso-len,200)}to{stroke-dasharray:var(--iso-len,200);stroke-dashoffset:0}}',
      '.iso-steps{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}',
      '.iso-steps button{min-width:40px;min-height:32px;padding:4px 8px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink-soft,#4a4a4a);font-family:var(--font-mono,monospace);font-size:.72rem;cursor:pointer;transition:transform 160ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.iso-steps button:active{transform:scale(.96)}',
      '.iso-steps button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.iso-key{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px 16px;font-family:var(--font-mono,monospace);font-size:.74rem;line-height:1.45;color:var(--ink-mute,#7a7a78)}',
      '.iso-key li{display:flex;gap:8px;transition:color 220ms var(--ease-out,cubic-bezier(.23,1,.32,1))}',
      '.iso-key .iso-key-n{color:var(--ink-mute,#7a7a78);min-width:2ch}',
      '.iso-key .iso-key-label{color:var(--ink,#1a1a1a)}',
      '.iso-key li.is-on .iso-key-n,.iso-key li.is-on .iso-key-label{color:var(--blueprint,#3553ff)}',
      '@media (prefers-reduced-motion: reduce){.iso-part,.iso-part *,.iso-flow,.iso-key li{transition:none!important}.iso-flow.is-on{animation:none}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function view(ox, oy) {
    function P(x, y, z) { return [ox + (x - y) * AX, oy + (x + y) * AY - (z || 0)]; }
    function at(sx, c) {
      var diff = (sx - ox) / AX;
      return [(diff + c) / 2, (c - diff) / 2];
    }
    return { P: P, at: at };
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function centerOf(v, part) { return v.at(part.col, part.row * ROW_SPREAD); }

  function pts(list) {
    return list.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  }

  function poly(cls, list) { return svgEl('polygon', { 'class': cls, points: pts(list) }); }

  function hull(points) {
    var sorted = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    function half(list) {
      var out = [];
      list.forEach(function (p) {
        while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
        out.push(p);
      });
      out.pop();
      return out;
    }
    return half(sorted).concat(half(sorted.slice().reverse()));
  }

  function shadow(g, v, x, y, w, d, h, z) {
    var reach = Math.min(h * 0.6, 18);
    var corners = [];
    [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].forEach(function (c) {
      corners.push(v.P(c[0], c[1], z), v.P(c[0] + reach, c[1] - reach * 0.35, z));
    });
    g.appendChild(poly('iso-shadow', hull(corners)));
  }

  function box(g, v, x, y, z, w, d, h) {
    var x1 = x + w, y1 = y + d, z1 = z + h;
    var P = v.P;
    var top = [P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)];
    var end = [P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)];
    var front = [P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)];
    var outline = [P(x, y, z1), P(x1, y, z1), P(x1, y, z), P(x1, y1, z), P(x, y1, z), P(x, y1, z1)];
    g.appendChild(poly('iso-base', outline));
    [[top, 'iso-shine'], [front, ''], [end, 'iso-shade']].forEach(function (pair) {
      g.appendChild(poly('iso-face', pair[0]));
      if (pair[1]) g.appendChild(poly(pair[1], pair[0]));
      g.appendChild(poly('iso-tint', pair[0]));
    });
    var near = P(x1, y1, z1);
    [P(x1, y, z1), P(x, y1, z1), P(x1, y1, z)].forEach(function (far) {
      g.appendChild(svgEl('polyline', { 'class': 'iso-edge', points: pts([near, far]) }));
    });
    g.appendChild(poly('iso-ink', outline));
  }

  function drum(g, v, cx, cy, z, r, h) {
    var rx = r * Math.SQRT2 * AX;
    var ry = r * Math.SQRT2 * AY;
    var t = v.P(cx, cy, z + h);
    var b = v.P(cx, cy, z);
    var side = [[t[0] - rx, t[1]]];
    for (var i = 0; i <= 16; i++) {
      var a = Math.PI - (Math.PI * i) / 16;
      side.push([b[0] + rx * Math.cos(a), b[1] + ry * Math.sin(a)]);
    }
    side.push([t[0] + rx, t[1]]);
    g.appendChild(poly('iso-base', side));
    g.appendChild(poly('iso-face', side));
    g.appendChild(poly('iso-shade', side));
    g.appendChild(poly('iso-tint', side));
    g.appendChild(poly('iso-ink', side));
    var attrsTop = { cx: t[0].toFixed(1), cy: t[1].toFixed(1), rx: rx.toFixed(1), ry: ry.toFixed(1) };
    ['iso-face', 'iso-shine', 'iso-tint', 'iso-ink'].forEach(function (cls) {
      var e = svgEl('ellipse', attrsTop);
      e.setAttribute('class', cls);
      g.appendChild(e);
    });
    var mid = v.P(cx, cy, z + h / 2);
    return { top: t, left: mid[0] - rx, right: mid[0] + rx, mid: mid[1] };
  }

  function drawPart(svg, v, part, index) {
    var g = svgEl('g', { 'class': 'iso-part', 'data-part': part.id });
    var c = centerOf(v, part);
    var s = part.size * SCALE;
    var ph = part.h * SCALE;
    var anchor;
    if (part.kind === 'drum') {
      shadow(g, v, c[0] - s, c[1] - s, s * 2, s * 2, ph, 0);
      var dr = drum(g, v, c[0], c[1], 0, s, ph);
      anchor = { top: dr.top, left: [dr.left, dr.mid], right: [dr.right, dr.mid] };
    } else {
      var x = c[0] - s / 2, y = c[1] - s / 2;
      shadow(g, v, x, y, s, s, ph, 0);
      if (part.kind === 'stack') {
        var layer = ph / 3;
        for (var k = 0; k < 3; k++) box(g, v, x, y, k * layer, s, s, layer - 2);
      } else {
        box(g, v, x, y, 0, s, s, ph);
      }
      anchor = { top: v.P(x + s / 2, y + s / 2, ph), left: v.P(x, y + s, ph / 2), right: v.P(x + s, y, ph / 2) };
    }
    g.appendChild(svgEl('circle', { 'class': 'iso-num', cx: anchor.top[0].toFixed(1), cy: (anchor.top[1] - 3).toFixed(1), r: 12 }));
    var label = svgEl('text', { 'class': 'iso-num-text', x: anchor.top[0].toFixed(1), y: (anchor.top[1] + 2).toFixed(1) });
    label.textContent = pad2(index + 1);
    g.appendChild(label);
    svg.appendChild(g);
    return anchor;
  }

  function drawFlow(layer, a, b, id) {
    var from = a.right, to = b.left;
    var dx = to[0] - from[0], dy = to[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var start = [from[0] + ux * 3, from[1] + uy * 3];
    var end = [to[0] - ux * 7, to[1] - uy * 7];
    var path = svgEl('path', { 'class': 'iso-flow', 'data-flow': id, d: 'M' + start[0].toFixed(1) + ' ' + start[1].toFixed(1) + ' L' + end[0].toFixed(1) + ' ' + end[1].toFixed(1) });
    path.style.setProperty('--iso-len', Math.round(len));
    var tip = [to[0] - ux * 2, to[1] - uy * 2];
    var px = -uy * 3.5, py = ux * 3.5;
    var head = svgEl('polygon', { 'class': 'iso-head', 'data-flow': id, points: pts([tip, [end[0] + px, end[1] + py], [end[0] - px, end[1] - py]]) });
    layer.appendChild(path);
    layer.appendChild(head);
  }

  function bounds(svg) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    Array.prototype.forEach.call(svg.querySelectorAll('polygon, polyline'), function (node) {
      node.getAttribute('points').split(' ').forEach(function (pair) {
        var p = pair.split(',');
        var x = +p[0], y = +p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
    });
    return [Math.floor(minX - 14), Math.floor(minY - 16), Math.ceil(maxX - minX + 28), Math.ceil(maxY - minY + 30)];
  }

  function isoMachine(host, cfg) {
    ensureStyles();
    var spec = MACHINES[(cfg && cfg.machine) || ''];
    if (!spec) throw new Error('unknown iso machine ' + (cfg && cfg.machine));
    var root = el('div', { 'class': 'lf lf-iso' });
    var head = el('div', { 'class': 'lf-head' }, [el('span', { 'class': 'lf-label' }, [spec.title]), el('span', {}, ['isometric · follows the steps'])]);
    var body = el('div', { 'class': 'lf-body' });
    var caption = el('p', { 'class': 'iso-caption', 'aria-live': 'polite' });
    var stage = el('div', { 'class': 'iso-stage' });
    var svg = svgEl('svg', { role: 'img', 'aria-label': spec.title + ': ' + spec.parts.map(function (p) { return p.label + ' (' + p.note + ')'; }).join(', ') });
    var v = view(0, 140);
    var flowLayer = svgEl('g', {});
    svg.appendChild(flowLayer);
    var anchors = {};
    var order = spec.parts.map(function (p, i) { return { part: p, index: i }; });
    order.sort(function (a, b) {
      var ca = centerOf(v, a.part), cb = centerOf(v, b.part);
      return (ca[0] + ca[1]) - (cb[0] + cb[1]);
    });
    order.forEach(function (item) { anchors[item.part.id] = drawPart(svg, v, item.part, item.index); });
    spec.flows.forEach(function (flow) { drawFlow(flowLayer, anchors[flow.from], anchors[flow.to], flow.id); });
    stage.appendChild(svg);
    var key = el('ol', { 'class': 'iso-key' });
    spec.parts.forEach(function (p, i) {
      key.appendChild(el('li', { 'data-part': p.id }, [
        el('span', { 'class': 'iso-key-n' }, [pad2(i + 1)]),
        el('span', {}, [el('span', { 'class': 'iso-key-label' }, [p.label]), ' ' + p.note])
      ]));
    });
    var stepRow = el('div', { 'class': 'iso-steps', role: 'group', 'aria-label': 'Steps' });
    var buttons = spec.steps.map(function (step, i) {
      var b = el('button', { type: 'button', 'aria-pressed': 'false', title: step.caption }, ['Step ' + (i + 1)]);
      b.addEventListener('click', function () {
        var next = state === i ? -1 : i;
        set(next);
        host.dispatchEvent(new CustomEvent('lf:step-request', { bubbles: true, detail: { index: next } }));
      });
      stepRow.appendChild(b);
      return b;
    });
    body.appendChild(caption);
    body.appendChild(stage);
    body.appendChild(stepRow);
    body.appendChild(key);
    root.appendChild(head);
    root.appendChild(body);
    host.appendChild(root);
    svg.setAttribute('viewBox', bounds(svg).join(' '));

    var state = -2;
    function set(i) {
      if (i === state) return;
      state = i;
      var step = spec.steps[i];
      root.classList.toggle('has-step', !!step);
      var focus = step ? step.focus : [];
      var flows = step ? (step.flows === 'all' ? spec.flows.map(function (f) { return f.id; }) : step.flows) : [];
      Array.prototype.forEach.call(root.querySelectorAll('[data-part]'), function (node) {
        node.classList.toggle('is-on', focus.indexOf(node.getAttribute('data-part')) !== -1);
      });
      Array.prototype.forEach.call(root.querySelectorAll('[data-flow]'), function (node) {
        node.classList.toggle('is-on', flows.indexOf(node.getAttribute('data-flow')) !== -1);
      });
      buttons.forEach(function (b, n) { b.setAttribute('aria-pressed', String(n === i)); });
      caption.innerHTML = '';
      if (step) {
        caption.appendChild(el('b', {}, ['STEP ' + (i + 1) + ' / ' + spec.steps.length]));
        caption.appendChild(document.createTextNode(step.caption));
      } else {
        caption.appendChild(document.createTextNode(spec.intro));
      }
    }
    set(-1);

    function onStep(e) { set(e.detail && typeof e.detail.index === 'number' ? e.detail.index : -1); }
    host.addEventListener('lf:step', onStep);
    host.setAttribute('data-sync', 'steps');
    host.setAttribute('data-step-count', String(spec.steps.length));
    setTimeout(function () {
      host.dispatchEvent(new CustomEvent('lf:sync-ready', { bubbles: true, detail: { steps: spec.steps.length } }));
    }, 0);
    return function () { host.removeEventListener('lf:step', onStep); };
  }

  window.AIFS_ISO_MACHINES = MACHINES;
  LF.register({ 'iso-machine': isoMachine });
})();
