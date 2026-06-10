/* figures-frontier.js - interactive lesson figures for autonomous systems
   (Phase 15) and the capstone projects (Phase 19). Loads after
   lesson-figures.js and registers through window.LF. No deps, ES5, theme via
   CSS vars. Authoring: a ```figure block naming one of the widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function arrowDefs() {
    var marker = svgEl('marker', { id: 'lf-fr-arrow', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, [
      svgEl('path', { d: 'M0 0 L8 4 L0 8 z', fill: 'var(--ink-soft,#555)' })
    ]);
    return svgEl('defs', {}, [marker]);
  }
  function box(x, y, w, h, label, on) {
    var r = svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: on ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: on ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', 'stroke-width': '1.5' });
    var t = svgEl('text', { x: x + w / 2, y: y + h / 2 + 4, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '11', fill: on ? 'var(--bg,#fafaf5)' : 'var(--ink,#1a1a1a)' });
    t.appendChild(document.createTextNode(label));
    return svgEl('g', {}, [r, t]);
  }
  function arrow(x1, y1, x2, y2, dash) {
    return svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'marker-end': 'url(#lf-fr-arrow)', 'stroke-dasharray': dash || '' });
  }
  function label(x, y, txt, fill) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '10', fill: fill || 'var(--ink-mute,#777)' });
    t.appendChild(document.createTextNode(txt));
    return t;
  }

  // ── task-decomposition: a goal fans out into sub-tasks (a planning tree) ────
  function taskDecomposition(host) {
    var state = { branch: 3, depth: 2 };
    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var b = state.branch, depth = state.depth;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var top = 30, rowH = (H - 70) / Math.max(1, depth);
      var prev = [{ x: W / 2 }];
      svg.appendChild(box(W / 2 - 32, top - 14, 64, 28, 'GOAL', true));
      var lv;
      for (lv = 1; lv <= depth; lv++) {
        var count = Math.pow(b, lv);
        if (count > 27) { count = 27; }
        var y = top + rowH * lv;
        var cur = [], k;
        for (k = 0; k < count; k++) {
          var x = W * (k + 1) / (count + 1);
          cur.push({ x: x });
          var parent = prev[Math.floor(k / b) % prev.length] || prev[0];
          svg.appendChild(svgEl('line', { x1: parent.x, y1: top + rowH * (lv - 1) + 14, x2: x, y2: y - 7, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
          var leaf = lv === depth;
          svg.appendChild(svgEl('circle', { cx: x, cy: y, r: leaf ? '6' : '8', fill: leaf ? 'var(--bg-surface,#eee)' : 'var(--blueprint,#3553ff)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1' }));
        }
        prev = cur;
      }
      var total = 0;
      for (lv = 0; lv <= depth; lv++) { total += Math.pow(b, lv); }
      var leaves = Math.pow(b, depth);
      meta.textContent = 'branching ' + b + ', depth ' + depth + '  ->  ' + leaves + ' leaf sub-tasks, ' + total + ' nodes total (leaves are the executable steps)';
      formula.textContent = 'leaves = b^depth ;  total nodes = (b^(depth+1) - 1) / (b - 1)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'branch', 'branching (sub-tasks per node)', 1, 4, 1),
      LF.slider(state, 'depth', 'planning depth', 1, 3, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TASK DECOMPOSITION']), el('span', {}, ['drag branching and depth'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A long-horizon agent does not attack a complex objective head-on. It decomposes the goal into sub-tasks, then decomposes those again, until the leaves are steps it can execute directly. Wider branching and deeper trees plan more thoroughly but multiply the work to track, which is why useful plans stay shallow.'])
    ]));
    state._render();
  }

  // ── reflection-loop: act -> evaluate -> critique -> revise, quality climbs ──
  function reflectionLoop(host) {
    var state = { iter: 3 };
    var stages = ['ACT', 'EVALUATE', 'CRITIQUE', 'REVISE'];
    var W = 520, H = 170;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    function quality(n) { return 100 * (1 - 0.7 * Math.pow(0.6, n)); }
    state._render = function () {
      var n = state.iter;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      var bw = 104, gap = 14, x0 = 18, y = 60, h = 44, active = (n - 1) % 4;
      var x = x0, i;
      for (i = 0; i < 4; i++) {
        svg.appendChild(box(x, y, bw, h, stages[i], i === active));
        if (i < 3) { svg.appendChild(arrow(x + bw, y + h / 2, x + bw + gap, y + h / 2)); }
        x += bw + gap;
      }
      svg.appendChild(arrow(x0 + bw / 2, y + h, x0 + bw / 2, y + h + 18, '4 4'));
      svg.appendChild(svgEl('path', { d: 'M ' + (x0 + bw / 2) + ' ' + (y + h + 18) + ' L ' + (x - gap - bw / 2) + ' ' + (y + h + 18) + ' L ' + (x - gap - bw / 2) + ' ' + (y + h + 6), fill: 'none', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'stroke-dasharray': '4 4', 'marker-end': 'url(#lf-fr-arrow)' }));
      svg.appendChild(label(W / 2, y + h + 34, 'revise feeds the next attempt'));
      var q = quality(n);
      status.innerHTML = q.toFixed(1) + ' <small>quality</small>';
      bar.style.width = q.toFixed(1) + '%';
      var gain = quality(n) - quality(n - 1);
      meta.textContent = 'iteration ' + n + '  ·  gain this pass +' + gain.toFixed(1) + '  ·  ' + (gain < 2 ? 'returns have flattened: stop reflecting' : 'still improving');
    };
    var grid = el('div', {}, [LF.slider(state, 'iter', 'reflection iterations', 1, 8, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['REFLECTION LOOP']), el('span', {}, ['drag the iterations'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:12px' }, [status]), barWrap, meta])]),
      el('div', { class: 'lf-cap' }, ['A self-improvement loop acts, evaluates the result, critiques what went wrong, and revises before the next attempt. Each pass raises quality, but the gain shrinks geometrically and soon flattens. The skill is knowing when reflection has stopped paying for itself.'])
    ]));
    state._render();
  }

  // ── memory-consolidation: episodic events compress into a semantic summary ──
  function memoryConsolidation(host) {
    var state = { events: 24, threshold: 8 };
    var W = 520, H = 150;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var n = state.events, thr = state.threshold;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      var consolidated = n > thr ? n - thr : 0;
      var recent = n - consolidated;
      var dotW = Math.min(11, (W - 200) / Math.max(1, n));
      var x = 14, i;
      for (i = 0; i < n; i++) {
        var old = i < consolidated;
        svg.appendChild(svgEl('rect', { x: x, y: 26, width: Math.max(2, dotW - 2), height: 22, rx: '2', fill: old ? 'var(--rule-soft,#ddd)' : 'var(--blueprint,#3553ff)', opacity: old ? '0.5' : '1' }));
        x += dotW;
      }
      svg.appendChild(label(x / 2 + 7, 18, 'episodic events (recent in blue)'));
      var summaryX = W - 150, summaryY = 80;
      svg.appendChild(box(summaryX, summaryY, 132, 40, 'semantic memory', consolidated > 0));
      svg.appendChild(arrow(consolidated > 0 ? (14 + consolidated * dotW / 2) : 14, 50, summaryX + 4, summaryY + 6, '4 4'));
      svg.appendChild(label(summaryX + 66, summaryY - 8, consolidated + ' events -> 1 summary'));
      meta.textContent = recent + ' recent events kept verbatim  ·  ' + consolidated + ' older events compressed into long-term memory';
      formula.textContent = 'keep newest ' + thr + ' episodic; consolidate the rest into a semantic summary as the buffer overflows';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'events', 'episodic events', 4, 40, 1),
      LF.slider(state, 'threshold', 'consolidation threshold', 2, 20, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['MEMORY CONSOLIDATION']), el('span', {}, ['drag the threshold'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Recent steps live as detailed episodic records. Once the buffer crosses a threshold, the oldest episodes are compressed into a compact semantic summary that preserves the gist while freeing the window. A long-running agent survives by consolidating instead of remembering every token forever.'])
    ]));
    state._render();
  }

  // ── world-model-rollout: imagine future states with a learned model ────────
  function worldModelRollout(host) {
    var state = { rollout: 2, branch: 2 };
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var depth = state.rollout, b = state.branch;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var top = 28, rowH = (H - 66) / Math.max(1, depth);
      var prev = [{ x: W / 2 }];
      svg.appendChild(svgEl('circle', { cx: W / 2, cy: top, r: '9', fill: 'var(--blueprint,#3553ff)' }));
      svg.appendChild(label(W / 2, top - 14, 'now'));
      var lv;
      for (lv = 1; lv <= depth; lv++) {
        var count = Math.pow(b, lv);
        if (count > 32) { count = 32; }
        var y = top + rowH * lv;
        var cur = [], k;
        for (k = 0; k < count; k++) {
          var x = W * (k + 1) / (count + 1);
          cur.push({ x: x });
          var parent = prev[Math.floor(k / b) % prev.length] || prev[0];
          svg.appendChild(svgEl('line', { x1: parent.x, y1: top + rowH * (lv - 1) + 9, x2: x, y2: y - 6, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
          svg.appendChild(svgEl('circle', { cx: x, cy: y, r: '6', fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1' }));
        }
        prev = cur;
      }
      var imagined = 0;
      for (lv = 1; lv <= depth; lv++) { imagined += Math.pow(b, lv); }
      meta.textContent = 'looking ' + depth + ' step' + (depth > 1 ? 's' : '') + ' ahead, ' + b + ' actions per state  ->  ' + imagined + ' imagined futures simulated before one real action';
      formula.textContent = 'imagined states = sum b^k for k=1..depth  ·  cost grows exponentially with rollout depth';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'rollout', 'rollout depth (steps ahead)', 1, 3, 1),
      LF.slider(state, 'branch', 'actions per state', 1, 4, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['WORLD-MODEL ROLLOUT']), el('span', {}, ['drag depth and branching'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Model-based planning simulates the future before touching the world. From the current state the agent imagines the states each candidate action would lead to, rolls those forward with a learned model, and only then commits to the best first move. Deeper rollouts plan better but the imagined tree grows exponentially.'])
    ]));
    state._render();
  }

  // ── autonomy-oversight: a risk dial routes actions to auto or a human gate ──
  function autonomyOversight(host) {
    var state = { autonomy: 50 };
    var actions = [
      { name: 'read a file', risk: 10 },
      { name: 'run a query', risk: 30 },
      { name: 'write a file', risk: 55 },
      { name: 'run a shell command', risk: 75 },
      { name: 'deploy to production', risk: 92 }
    ];
    var rows = el('div', {});
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    state._render = function () {
      var allow = state.autonomy;
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var auto = 0;
      actions.forEach(function (a) {
        var ok = a.risk <= allow;
        if (ok) { auto++; }
        var bar = el('i'); bar.style.width = a.risk + '%';
        if (!ok) { bar.style.background = 'var(--warn,#b8870f)'; }
        var lab = el('label', {}, [a.name + ' (risk ' + a.risk + ')', el('b', {}, [ok ? 'auto-approved' : 'escalate ->'])]);
        if (!ok) { lab.style.color = 'var(--warn,#b8870f)'; }
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' + (ok ? '' : ' over') }, [bar])]));
      });
      status.innerHTML = auto + ' / ' + actions.length + ' <small>auto-approved</small>';
      meta.textContent = 'autonomy ' + allow + ': actions at or below the dial run unattended; anything riskier escalates to a human gate';
    };
    var grid = el('div', {}, [LF.slider(state, 'autonomy', 'autonomy / risk dial', 0, 100, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['AUTONOMY OVERSIGHT']), el('span', {}, ['drag the dial'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, el('div', { style: 'margin-top:12px' }, [status]), meta])]),
      el('div', { class: 'lf-cap' }, ['Human-in-the-loop is a dial, not a switch. A single autonomy threshold lets low-risk actions run unattended while anything above it stops for human approval. Raise the dial for speed, lower it for control. Deploying to production should sit near the top no matter where the dial rests.'])
    ]));
    state._render();
  }

  // ── pass-at-k: pass@k = 1 - (1-p)^k rises toward 1 as k grows ───────────────
  function passAtK(host) {
    var state = { p: 0.3, k: 5 };
    var W = 520, H = 210, PAD = 34, KMAX = 20;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function passK(p, k) { return 1 - Math.pow(1 - p, k); }
    function px(k) { return PAD + (k - 1) / (KMAX - 1) * (W - 2 * PAD); }
    function py(v) { return H - PAD - v * (H - 2 * PAD); }
    state._render = function () {
      var p = state.p, k = state.k;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(1), x2: W - PAD, y2: py(1), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var d = '', kk;
      for (kk = 1; kk <= KMAX; kk++) { d += (kk === 1 ? 'M' : 'L') + px(kk).toFixed(1) + ' ' + py(passK(p, kk)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('circle', { cx: px(k), cy: py(passK(p, k)), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      var v = passK(p, k);
      num.innerHTML = (v * 100).toFixed(1) + ' <small>% pass@' + k + '</small>';
      meta.textContent = 'one sample succeeds ' + (p * 100).toFixed(0) + '% of the time  ·  ' + k + ' tries lift it to ' + (v * 100).toFixed(1) + '%';
      formula.textContent = 'pass@k = 1 - (1 - p)^k,  p = ' + p.toFixed(2) + ', k = ' + k + '   ·   k -> infinity drives it toward 1';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'p', 'per-sample success p', 0.02, 0.95, 0.01),
      LF.slider(state, 'k', 'samples k', 1, KMAX, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['PASS @ K']), el('span', {}, ['drag p and k'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Pass@k asks whether at least one of k independent samples solves the task. If each try succeeds with probability p, all k fail with probability (1-p)^k, so pass@k is one minus that. Even a weak model climbs steeply with more samples, which is why best-of-k is such a cheap lever and why pass@1 and pass@k tell different stories.'])
    ]));
    state._render();
  }

  // ── eval-harness-matrix: tasks x variants grid, aggregate per variant ──────
  function evalHarnessMatrix(host) {
    var state = { variant: '0' };
    var tasks = ['parse-json', 'sort-list', 'sql-join', 'regex-extract', 'recursion', 'edge-cases'];
    // deterministic pass(1)/fail(0) per [variant][task]
    var grids = [
      [1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 0]
    ];
    var names = ['baseline', 'tuned', 'ablation'];
    var W = 520, H = 200;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    state._render = function () {
      var sel = Number(state.variant);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var x0 = 110, y0 = 24, cw = (W - x0 - 20) / tasks.length, ch = 30;
      var v, t;
      tasks.forEach(function (tn, ti) {
        var lx = x0 + cw * ti + cw / 2;
        var t1 = svgEl('text', { x: lx, y: y0 - 6, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '8.5', fill: 'var(--ink-mute,#777)', transform: 'rotate(-18 ' + lx + ' ' + (y0 - 6) + ')' });
        t1.appendChild(document.createTextNode(tn)); svg.appendChild(t1);
      });
      for (v = 0; v < grids.length; v++) {
        var ry = y0 + 8 + v * (ch + 8);
        var on = v === sel;
        var nt = svgEl('text', { x: x0 - 10, y: ry + ch / 2 + 4, 'text-anchor': 'end', 'font-family': 'var(--font-mono,monospace)', 'font-size': '11', fill: on ? 'var(--blueprint,#3553ff)' : 'var(--ink-soft,#555)' });
        nt.appendChild(document.createTextNode(names[v])); svg.appendChild(nt);
        for (t = 0; t < tasks.length; t++) {
          var pass = grids[v][t] === 1;
          var cx = x0 + cw * t + 2;
          svg.appendChild(svgEl('rect', { x: cx, y: ry, width: cw - 4, height: ch, rx: '3', fill: pass ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: pass ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)', 'stroke-width': pass ? '0' : '1.4', opacity: on ? '1' : '0.4' }));
          var mark = svgEl('text', { x: cx + (cw - 4) / 2, y: ry + ch / 2 + 4, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '11', fill: pass ? 'var(--bg,#fafaf5)' : 'var(--warn,#b8870f)', opacity: on ? '1' : '0.4' });
          mark.appendChild(document.createTextNode(pass ? 'P' : 'F')); svg.appendChild(mark);
        }
      }
      var passed = 0; for (t = 0; t < tasks.length; t++) { if (grids[sel][t] === 1) { passed++; } }
      status.innerHTML = passed + ' / ' + tasks.length + ' <small>' + names[sel] + '</small>';
      meta.textContent = 'aggregate score for ' + names[sel] + ' = ' + (passed / tasks.length * 100).toFixed(0) + '%  ·  P = pass, F = fail per fixture task';
    };
    var grid = el('div', {}, [LF.select(state, 'variant', 'model variant', [
      ['baseline', '0'], ['tuned', '1'], ['ablation', '2']
    ])]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['EVAL HARNESS MATRIX']), el('span', {}, ['pick a variant'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta])]),
      el('div', { class: 'lf-cap' }, ['An eval harness runs every task against every model variant and records pass or fail in a grid. Reading down a column shows which tasks are hard; reading across a row gives one variant its aggregate score. The matrix is what turns a vague hunch into a number you can regression-test against.'])
    ]));
    state._render();
  }

  // ── canary-rollout: traffic split, error rate, rollback trigger ────────────
  function canaryRollout(host) {
    var state = { canary: 10 };
    var stableErr = 0.4, canaryErr = 2.6, sla = 1.5;
    var W = 520, H = 120;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var c = state.canary, s = 100 - c;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var x0 = 14, y = 30, h = 44, fullW = W - 28;
      var sw = fullW * s / 100;
      svg.appendChild(svgEl('rect', { x: x0, y: y, width: Math.max(0, sw), height: h, fill: 'var(--blueprint,#3553ff)' }));
      svg.appendChild(svgEl('rect', { x: x0 + sw, y: y, width: Math.max(0, fullW - sw), height: h, fill: 'var(--warn,#b8870f)' }));
      if (s > 6) { svg.appendChild(label(x0 + sw / 2, y + h / 2 + 4, 'stable ' + s + '%', 'var(--bg,#fafaf5)')); }
      if (c > 6) { svg.appendChild(label(x0 + sw + (fullW - sw) / 2, y + h / 2 + 4, 'canary ' + c + '%', 'var(--bg,#fafaf5)')); }
      var blended = (s * stableErr + c * canaryErr) / 100;
      var rollback = canaryErr > sla;
      svg.appendChild(label(W / 2, y + h + 22, 'canary error ' + canaryErr.toFixed(1) + '% vs SLA ' + sla.toFixed(1) + '%' + (rollback ? '  ROLLBACK TRIGGERED' : ''), rollback ? 'var(--warn,#b8870f)' : 'var(--ink-mute,#777)'));
      status.innerHTML = blended.toFixed(2) + ' <small>% blended error</small>';
      meta.textContent = rollback ? 'canary breaches the SLA: drain its traffic back to the stable version' : 'canary within SLA: safe to widen the rollout';
      formula.textContent = 'blended error = (stable% · ' + stableErr + ' + canary% · ' + canaryErr + ') / 100  ·  trip rollback when canary error > SLA';
    };
    var grid = el('div', {}, [LF.slider(state, 'canary', 'canary traffic %', 0, 100, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CANARY ROLLOUT']), el('span', {}, ['drag the canary %'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A canary release routes a small slice of traffic to the new version while the rest stays on the proven one. Error rate on the canary is watched against an SLA; the moment it breaches, traffic drains back to stable. Here the canary runs hot, so widening the split raises the blended error and keeps the rollback armed.'])
    ]));
    state._render();
  }

  // ── trace-spans: nested spans on a timeline, expand one to see children ────
  function traceSpans(host) {
    // each span: name, start, dur (ms), depth
    var spans = [
      { name: 'handle_request', start: 0, dur: 1200, depth: 0 },
      { name: 'llm_call (plan)', start: 40, dur: 420, depth: 1 },
      { name: 'retrieval', start: 480, dur: 260, depth: 1 },
      { name: 'vector_search', start: 510, dur: 150, depth: 2 },
      { name: 'rerank', start: 670, dur: 60, depth: 2 },
      { name: 'tool_call (db)', start: 760, dur: 180, depth: 1 },
      { name: 'llm_call (answer)', start: 960, dur: 230, depth: 1 }
    ];
    var state = { expand: 1 };
    var W = 520, total = 1200;
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    state._render = function () {
      var pad = 14, x0 = 150, rowH = 24, axW = W - x0 - 18;
      var H = pad * 2 + spans.length * rowH + 10;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
      function px(ms) { return x0 + ms / total * axW; }
      var sel = LF.clamp(state.expand, 0, spans.length - 1);
      var i;
      for (i = 0; i <= 4; i++) {
        var gx = px(total * i / 4);
        svg.appendChild(svgEl('line', { x1: gx, y1: pad, x2: gx, y2: H - pad, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '2 4' }));
        svg.appendChild(label(gx, H - 2, (total * i / 4) + 'ms'));
      }
      spans.forEach(function (sp, idx) {
        var y = pad + idx * rowH;
        var on = idx === sel;
        var nt = svgEl('text', { x: 8 + sp.depth * 12, y: y + rowH / 2 + 4, 'font-family': 'var(--font-mono,monospace)', 'font-size': '9.5', fill: on ? 'var(--blueprint,#3553ff)' : 'var(--ink-soft,#555)' });
        nt.appendChild(document.createTextNode(sp.name)); svg.appendChild(nt);
        svg.appendChild(svgEl('rect', { x: px(sp.start), y: y + 4, width: Math.max(2, axW * sp.dur / total), height: rowH - 10, rx: '2', fill: on ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: on ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
        if (on) { svg.appendChild(label(px(sp.start) + Math.max(2, axW * sp.dur / total) + 22, y + rowH / 2 + 4, sp.dur + 'ms', 'var(--blueprint,#3553ff)')); }
      });
      while (out.firstChild) { out.removeChild(out.firstChild); }
      out.appendChild(svg);
      out.appendChild(el('div', { style: 'margin-top:10px' }, [status]));
      out.appendChild(meta);
      var s = spans[sel];
      status.innerHTML = s.dur + ' <small>ms · ' + s.name + '</small>';
      meta.textContent = 'span starts at ' + s.start + 'ms, runs ' + s.dur + 'ms, depth ' + s.depth + '  ·  total trace ' + total + 'ms (one root span, its children nested by indent)';
    };
    var out = el('div', { class: 'lf-out' });
    var grid = el('div', {}, [LF.slider(state, 'expand', 'inspect span', 0, spans.length - 1, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TRACE SPANS']), el('span', {}, ['drag to inspect'])]),
      el('div', { class: 'lf-body' }, [grid, out]),
      el('div', { class: 'lf-cap' }, ['A distributed trace is a tree of spans laid out on a timeline. The root span covers the whole request; child spans for each LLM call, retrieval, and tool call nest inside it by start time and duration. Reading the gantt shows where the latency actually went, which is the first question every production incident asks.'])
    ]));
    state._render();
  }

  LF.register({
    'task-decomposition': taskDecomposition,
    'reflection-loop': reflectionLoop,
    'memory-consolidation': memoryConsolidation,
    'world-model-rollout': worldModelRollout,
    'autonomy-oversight': autonomyOversight,
    'pass-at-k': passAtK,
    'eval-harness-matrix': evalHarnessMatrix,
    'canary-rollout': canaryRollout,
    'trace-spans': traceSpans
  });
})();
