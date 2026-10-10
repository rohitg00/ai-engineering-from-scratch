/* figures-mlprod.js - interactive lesson figures for the Phase 2 lessons on
   classical ML in production: system design, drift monitoring, and feature
   stores. Loads after lesson-figures.js and registers widgets through
   window.LF. Vanilla ES5, no deps, theme via CSS vars. Authoring:
       ```figure
       mlprod-drift-psi
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, clamp = LF.clamp;
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)', RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';

  function shell(label, hint, grid, outKids, caption) {
    return el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, outKids)]),
      el('div', { class: 'lf-cap' }, [caption])
    ]);
  }
  function txt(x, y, s, size, fill, anchor) {
    return svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '10', fill: fill || INK }, [document.createTextNode(s)]);
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function money(x) { return '$' + (x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(2)); }
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

  // -- mlprod-serving-cost: batch versus online cost as freshness tightens ----
  function servingCost(host) {
    var ENTITIES = 2e6, BATCH_PER_M = 0.40, JOB_H = 1, LOOKUP_PER_M = 0.25;
    var REPLICA_H = 0.50, REPLICA_QPS = 200, MIN_REPLICAS = 2, PEAK_FACTOR = 3;
    var W = 520, H = 230, L = 58, R = 500, T = 18, B = 190, XMAX = 48;
    var state = { rpd: 0.3, stale: 24 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(h) { return L + h / XMAX * (R - L); }
    function py(d) { return B - (Math.log(clamp(d, 0.1, 1000)) / Math.LN10 + 1) / 4 * (B - T); }
    function batchCost(h, rpd) { return h <= JOB_H ? Infinity : ENTITIES * 24 / (h - JOB_H) * BATCH_PER_M / 1e6 + rpd * 1e6 * LOOKUP_PER_M / 1e6; }
    function replicas(rpd) { return Math.max(MIN_REPLICAS, Math.ceil(rpd * 1e6 / 86400 * PEAK_FACTOR / REPLICA_QPS)); }
    state._render = function () {
      clear(svg);
      var online = replicas(state.rpd) * REPLICA_H * 24;
      var batch = batchCost(state.stale, state.rpd);
      var d = '', i, h, first = true;
      svg.appendChild(svgEl('rect', { x: px(0), y: T, width: px(JOB_H) - px(0), height: B - T, fill: RULE, opacity: '0.7' }));
      [1, 10, 100].forEach(function (v) {
        svg.appendChild(svgEl('line', { x1: L, y1: py(v), x2: R, y2: py(v), stroke: RULE, 'stroke-width': '1' }));
        svg.appendChild(txt(L - 6, py(v) + 3, '$' + v, '9', MUTE, 'end'));
      });
      svg.appendChild(svgEl('line', { x1: L, y1: B, x2: R, y2: B, stroke: SOFT, 'stroke-width': '1' }));
      for (i = 0; i <= 120; i++) {
        h = JOB_H + 0.02 + (XMAX - JOB_H - 0.02) * Math.pow(i / 120, 1.6);
        d += (first ? 'M' : 'L') + px(h).toFixed(1) + ' ' + py(batchCost(h, state.rpd)).toFixed(1) + ' ';
        first = false;
      }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: BP, 'stroke-width': '2' }));
      svg.appendChild(svgEl('line', { x1: L, y1: py(online), x2: R, y2: py(online), stroke: WARN, 'stroke-width': '2' }));
      svg.appendChild(svgEl('line', { x1: px(state.stale), y1: T, x2: px(state.stale), y2: B, stroke: INK, 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      if (isFinite(batch)) svg.appendChild(svgEl('circle', { cx: px(state.stale), cy: py(batch), r: '4.5', fill: BP }));
      svg.appendChild(svgEl('circle', { cx: px(state.stale), cy: py(online), r: '4.5', fill: WARN }));
      svg.appendChild(txt(R, py(online) - 6, 'online', '10', WARN, 'end'));
      svg.appendChild(txt(R, py(batchCost(XMAX, state.rpd)) + 14, 'batch', '10', BP, 'end'));
      svg.appendChild(txt(px(JOB_H) + 4, T + 12, 'batch impossible', '9', MUTE, 'start'));
      svg.appendChild(txt((L + R) / 2, B + 26, 'max staleness allowed (hours)  ·  cost per day on a log scale', '9', MUTE));
      [0, 12, 24, 36, 48].forEach(function (v) { svg.appendChild(txt(px(v), B + 12, String(v), '9', MUTE)); });
      var pick = !isFinite(batch) || online < batch ? 'online' : 'batch';
      num.innerHTML = pick + ' <small>is cheaper at these budgets</small>';
      meta.textContent = 'batch ' + (isFinite(batch) ? money(batch) + '/day, ' + (24 / (state.stale - JOB_H)).toFixed(1) + ' runs/day' : 'cannot meet the limit') +
        '  ·  online ' + money(online) + '/day, ' + replicas(state.rpd) + ' replicas';
      formula.textContent = 'batch = 2M users × 24/(staleness − 1 h job) × $0.40/M + lookups  ·  online = replicas for peak QPS (3 × average) × $0.50/h × 24';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'rpd', 'requests per day (millions)', 0.1, 50, 0.1),
      slider(state, 'stale', 'max staleness (hours)', 0.5, 48, 0.5)
    ]);
    host.appendChild(shell('BATCH VS ONLINE', 'drag traffic and freshness',
      grid, [svg, num, meta, formula],
      'Batch scoring computes a score for every user on each run, so its cost grows as the freshness limit gets shorter. Online serving pays for replicas sized for peak traffic, so its cost follows requests and ignores freshness. Below one hour, a one-hour batch job cannot meet the limit at all. The prices are round numbers for the exercise.'));
    state._render();
  }

  // -- mlprod-drift-psi: reference deciles versus a shifted current window ----
  function driftPsi(host) {
    var EDGES = [-1.2816, -0.8416, -0.5244, -0.2533, 0, 0.2533, 0.5244, 0.8416, 1.2816];
    var W = 520, H = 210, L = 30, R = 500, T = 16, B = 170, YMAX = 0.8;
    var state = { shift: 0.5, spread: 1 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function py(f) { return B - Math.min(f, YMAX) / YMAX * (B - T); }
    function fractions(mu, sd) {
      var out = [], prev = 0, i, c;
      for (i = 0; i < EDGES.length; i++) { c = phi((EDGES[i] - mu) / sd); out.push(c - prev); prev = c; }
      out.push(1 - prev);
      return out;
    }
    state._render = function () {
      clear(svg);
      var cur = fractions(state.shift, state.spread), psi = 0, ks = 0, i, x, a, slot = (R - L) / 10;
      for (i = 0; i < 10; i++) { a = Math.max(cur[i], 1e-4); psi += (a - 0.1) * Math.log(a / 0.1); }
      for (i = 0; i <= 200; i++) { x = -5 + i * 0.05; ks = Math.max(ks, Math.abs(phi(x) - phi((x - state.shift) / state.spread))); }
      var worst = 0;
      for (i = 0; i < 10; i++) {
        x = L + i * slot;
        svg.appendChild(svgEl('rect', { x: x + 4, y: py(0.1), width: slot / 2 - 5, height: B - py(0.1), fill: RULE }));
        svg.appendChild(svgEl('rect', { x: x + slot / 2, y: py(cur[i]), width: slot / 2 - 5, height: B - py(cur[i]), fill: BP, opacity: '0.85' }));
        if (Math.abs(cur[i] - 0.1) > Math.abs(cur[worst] - 0.1)) worst = i;
      }
      svg.appendChild(svgEl('line', { x1: L, y1: B, x2: R, y2: B, stroke: SOFT, 'stroke-width': '1' }));
      svg.appendChild(svgEl('line', { x1: L, y1: py(0.1), x2: R, y2: py(0.1), stroke: MUTE, 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(txt(L, py(0.1) - 4, '10% per bin in the reference', '9', MUTE, 'start'));
      svg.appendChild(txt(L + 5 * slot, B + 16, 'bins = deciles of the reference window  ·  grey reference, blue current', '9', MUTE));
      svg.appendChild(txt(R, T + 4, 'bars above 80% are clipped', '8', MUTE, 'end'));
      var band = psi < 0.1 ? 'stable, below 0.1' : psi < 0.25 ? 'moderate, 0.1 to 0.25' : 'significant, above 0.25';
      num.innerHTML = psi.toFixed(3) + ' <small>PSI · ' + band + '</small>';
      meta.textContent = 'KS D = ' + ks.toFixed(3) + '  ·  largest change in bin ' + (worst + 1) + ': 10% → ' + (cur[worst] * 100).toFixed(1) + '%';
      formula.textContent = 'PSI = Σ (current − reference) × ln(current / reference), summed over the 10 bins';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'shift', 'mean shift (reference std units)', -2, 2, 0.05),
      slider(state, 'spread', 'spread ratio (current std / reference std)', 0.5, 2, 0.05)
    ]);
    host.appendChild(shell('POPULATION STABILITY INDEX', 'drag the drift',
      grid, [svg, num, meta, formula],
      'The reference window is cut into ten bins that each hold 10 percent of its values. Move the current window and the share in each bin changes. PSI adds up those changes, weighted by the log ratio. A bin that grows from 10 to 30 percent adds much more than one that grows to 12. The 0.1 and 0.25 bands are a credit-scoring rule of thumb, not a statistical test.'));
    state._render();
  }

  // -- mlprod-pit-join: which feature rows a label at day t can see ---------
  function pitJoin(host) {
    var ROWS = [[2, 3], [6, 4], [11, 4], [17, 6], [24, 5], [31, 2], [36, 1]];
    var W = 520, H = 190, L = 30, R = 500, AXIS = 112, DMAX = 40;
    var state = { label: 20, ttl: 7 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(day) { return L + day / DMAX * (R - L); }
    state._render = function () {
      clear(svg);
      var lo = state.label - state.ttl, chosen = -1, i, day, kind, fill, stroke;
      for (i = 0; i < ROWS.length; i++) if (ROWS[i][0] <= state.label && ROWS[i][0] >= lo) chosen = i;
      svg.appendChild(svgEl('rect', { x: px(Math.max(0, lo)), y: AXIS - 46, width: px(state.label) - px(Math.max(0, lo)), height: 70, fill: BP, opacity: '0.10' }));
      svg.appendChild(svgEl('line', { x1: L, y1: AXIS, x2: R, y2: AXIS, stroke: SOFT, 'stroke-width': '1' }));
      for (i = 0; i < ROWS.length; i++) {
        day = ROWS[i][0];
        kind = day > state.label ? 'future' : day < lo ? 'expired' : 'visible';
        fill = kind === 'visible' ? BP : kind === 'expired' ? RULE : 'none';
        stroke = kind === 'future' ? WARN : kind === 'visible' ? BP : MUTE;
        svg.appendChild(svgEl('circle', { cx: px(day), cy: AXIS, r: '6', fill: fill, stroke: stroke, 'stroke-width': '1.6', 'stroke-dasharray': kind === 'future' ? '2 2' : 'none' }));
        svg.appendChild(txt(px(day), AXIS - 14, String(ROWS[i][1]), '11', kind === 'future' ? WARN : INK));
        svg.appendChild(txt(px(day), AXIS + 22, 'd' + day, '9', MUTE));
      }
      if (chosen >= 0) svg.appendChild(svgEl('circle', { cx: px(ROWS[chosen][0]), cy: AXIS, r: '11', fill: 'none', stroke: BP, 'stroke-width': '2' }));
      svg.appendChild(svgEl('line', { x1: px(state.label), y1: AXIS - 62, x2: px(state.label), y2: AXIS + 34, stroke: INK, 'stroke-width': '1.6' }));
      svg.appendChild(txt(px(state.label), AXIS - 66, 'label day ' + state.label, '10', INK));
      svg.appendChild(txt(px(36), AXIS + 44, 'naive join reads d36', '9', WARN, 'end'));
      svg.appendChild(txt(L, 16, 'feature rows for one user: value above, event day below  ·  blue band = TTL window', '9', MUTE, 'start'));
      var future = 0;
      for (i = 0; i < ROWS.length; i++) if (ROWS[i][0] > state.label) future++;
      if (chosen >= 0) {
        num.innerHTML = ROWS[chosen][1] + ' <small>joined from day ' + ROWS[chosen][0] + ', ' + (state.label - ROWS[chosen][0]) + ' days old</small>';
      } else {
        num.innerHTML = 'none <small>no row inside the TTL, so the default value is used</small>';
      }
      meta.textContent = future + ' future row' + (future === 1 ? '' : 's') + ' hidden from this label  ·  naive latest join returns ' + ROWS[ROWS.length - 1][1] + ' from day 36' + (state.label < 36 ? ', which leaks the future' : '');
      formula.textContent = 'join a row when row.day ≤ label.day and label.day − row.day ≤ TTL, then take the latest one';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'label', 'label day', 0, 40, 1),
      slider(state, 'ttl', 'TTL (days)', 1, 20, 1)
    ]);
    host.appendChild(shell('POINT-IN-TIME JOIN', 'drag the label day',
      grid, [svg, num, meta, formula],
      'A training row for a label at day t can only use feature values that existed at day t. The point-in-time join takes the latest row on or before the label day, and drops it if it is older than the TTL. A naive join on the user ID takes the newest row in the table. That row often comes from after the label and copies the future into training.'));
    state._render();
  }

  LF.register({
    'mlprod-serving-cost': servingCost,
    'mlprod-drift-psi': driftPsi,
    'mlprod-pit-join': pitJoin
  });
})();
