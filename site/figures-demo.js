/* figures-demo.js - interactive lesson figure for Phase 17 lesson 29 (model
   demo interfaces): a per-client token bucket in front of a public demo.
   Loads after lesson-figures.js, registers through window.LF. Vanilla ES5,
   no deps, theme via CSS vars. Authoring is the same fenced block:
       ```figure
       demo-token-bucket
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider;

  var BP = 'var(--blueprint,#3553ff)';
  var WARN = 'var(--warn,#b8870f)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var MUTE = 'var(--ink-mute,#777)';
  var INKS = 'var(--ink-soft,#555)';

  var W = 520, H = 220, X0 = 60, X1 = 500, SECONDS = 12;
  var LEVEL_TOP = 28, LEVEL_BOTTOM = 118, LEVEL_MAX = 10;
  var TICK_BASE = 172, TICK_FULL = 22, TICK_SHORT = 10;

  function arrivals() {
    var out = [], i;
    for (i = 0; i < 8; i++) { out.push({ t: i * 0.15, group: 0 }); }
    for (i = 0; i < 8; i++) { out.push({ t: 2 + i, group: 1 }); }
    for (i = 0; i < 8; i++) { out.push({ t: 10 + i * 0.15, group: 2 }); }
    return out;
  }
  var TRAFFIC = arrivals();

  function simulate(capacity, refill) {
    var tokens = capacity, last = 0, points = [[0, capacity]], decisions = [], i;
    function refillTo(t) {
      var full = tokens + (t - last) * refill;
      if (full > capacity && tokens < capacity) {
        points.push([last + (capacity - tokens) / refill, capacity]);
      }
      tokens = Math.min(capacity, full);
      last = t;
      points.push([t, tokens]);
    }
    for (i = 0; i < TRAFFIC.length; i++) {
      refillTo(TRAFFIC[i].t);
      var ok = tokens >= 1;
      if (ok) { tokens -= 1; points.push([TRAFFIC[i].t, tokens]); }
      decisions.push(ok);
    }
    refillTo(SECONDS);
    return { points: points, decisions: decisions };
  }

  function px(t) { return X0 + (X1 - X0) * t / SECONDS; }
  function py(level) { return LEVEL_BOTTOM - (LEVEL_BOTTOM - LEVEL_TOP) * level / LEVEL_MAX; }

  function txt(x, y, s, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '9', fill: fill || INKS });
    t.appendChild(document.createTextNode(s));
    return t;
  }

  function tokenBucket(host) {
    var state = { capacity: 4, refill: 1 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    state._render = function () {
      var run = simulate(state.capacity, state.refill);
      var i, accepted = 0, perGroup = [0, 0, 0];
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }

      svg.appendChild(txt(X0 - 8, LEVEL_TOP - 12, 'tokens', MUTE, 'end'));
      svg.appendChild(svgEl('line', { x1: X0, y1: LEVEL_BOTTOM, x2: X1, y2: LEVEL_BOTTOM, stroke: SOFT, 'stroke-width': '1' }));
      var capY = py(state.capacity).toFixed(1);
      svg.appendChild(svgEl('line', { x1: X0, y1: capY, x2: X1, y2: capY, stroke: MUTE, 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(txt(X0 - 8, Number(capY) + 3, 'cap ' + state.capacity, MUTE, 'end'));
      var d = '';
      for (i = 0; i < run.points.length; i++) {
        d += (i ? ' L' : 'M') + px(run.points[i][0]).toFixed(1) + ' ' + py(run.points[i][1]).toFixed(1);
      }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: BP, 'stroke-width': '1.6', 'stroke-linejoin': 'round' }));

      svg.appendChild(txt(X0 - 8, TICK_BASE - 8, 'requests', MUTE, 'end'));
      svg.appendChild(svgEl('line', { x1: X0, y1: TICK_BASE, x2: X1, y2: TICK_BASE, stroke: SOFT, 'stroke-width': '1' }));
      for (i = 0; i < TRAFFIC.length; i++) {
        var ok = run.decisions[i];
        var h = ok ? TICK_FULL : TICK_SHORT;
        if (ok) { accepted += 1; perGroup[TRAFFIC[i].group] += 1; }
        svg.appendChild(svgEl('rect', { x: (px(TRAFFIC[i].t) - 2).toFixed(1), y: TICK_BASE - h, width: '4', height: h, fill: ok ? BP : WARN, opacity: ok ? '0.9' : '0.75' }));
      }
      svg.appendChild(txt(px(0), TICK_BASE + 14, '0 s', MUTE));
      svg.appendChild(txt(px(6), TICK_BASE + 14, '6 s', MUTE));
      svg.appendChild(txt(px(12), TICK_BASE + 14, '12 s', MUTE));

      svg.appendChild(svgEl('rect', { x: X0, y: H - 18, width: '4', height: '12', fill: BP }));
      svg.appendChild(txt(X0 + 10, H - 8, 'accepted: model runs', INKS, 'start'));
      svg.appendChild(svgEl('rect', { x: X0 + 190, y: H - 12, width: '4', height: '6', fill: WARN }));
      svg.appendChild(txt(X0 + 200, H - 8, 'rejected: 429 + Retry-After', INKS, 'start'));

      var rejected = TRAFFIC.length - accepted;
      num.innerHTML = accepted + ' <small>of ' + TRAFFIC.length + ' requests accepted</small>';
      meta.textContent = rejected + ' rejected  ·  first burst ' + perGroup[0] + '/8  ·  steady ' + perGroup[1] + '/8  ·  last burst ' + perGroup[2] + '/8';
      formula.textContent = 'tokens = min(' + state.capacity + ', tokens + ' + state.refill + ' x seconds since last request)  ·  accept when tokens >= 1, then take 1';
    };

    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'capacity', 'bucket capacity (burst size)', 1, 10, 1),
      slider(state, 'refill', 'refill rate (tokens per second)', 0.5, 4, 0.5)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TOKEN BUCKET']), el('span', {}, ['one client, 24 requests in 12 seconds'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Each request takes one token from the bucket of its client. The bucket refills at a fixed rate and never holds more than its capacity. The capacity sets the largest burst that the demo accepts. The refill rate sets the steady request rate. A rejected request gets HTTP 429 with a Retry-After header, and the model does not run.'])
    ]));
    state._render();
  }

  LF.register({
    'demo-token-bucket': tokenBucket
  });
})();
