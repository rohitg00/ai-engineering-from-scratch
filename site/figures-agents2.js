/* figures-agents2.js - interactive lesson figures for advanced agent
   engineering and multi-agent coordination. Loads after lesson-figures.js
   and registers through window.LF. No deps, ES5, theme via CSS vars.
   Authoring: a ```figure block naming one of the widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function arrowDefs() {
    var marker = svgEl('marker', { id: 'lf-a2-arrow', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, [
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
    return svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'marker-end': 'url(#lf-a2-arrow)', 'stroke-dasharray': dash || '' });
  }
  function label(x, y, txt, fill, size) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '10', fill: fill || 'var(--ink-mute,#777)' });
    t.appendChild(document.createTextNode(txt));
    return t;
  }

  // -- rewoo-plan: plan all tool calls up front, then execute, vs ReAct -------
  function rewooPlan(host) {
    var state = { steps: 4 };
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var n = state.steps;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      var i;
      // ReWOO row: one planner, then a worker runs the whole plan
      svg.appendChild(label(W / 2, 16, 'ReWOO: plan once, then execute', 'var(--blueprint,#3553ff)', '11'));
      svg.appendChild(box(18, 30, 90, 34, 'PLANNER', true));
      var plX = 130;
      for (i = 0; i < n; i++) {
        var bx = plX + i * ((W - plX - 18) / n);
        svg.appendChild(box(bx, 30, (W - plX - 18) / n - 8, 34, 'call ' + (i + 1), false));
        if (i === 0) { svg.appendChild(arrow(108, 47, bx, 47)); }
        else { svg.appendChild(arrow(bx - 8, 47, bx, 47)); }
      }
      // ReAct row: interleaved think/act/observe, one LLM call per action
      svg.appendChild(label(W / 2, 120, 'ReAct: interleave a model call per step', 'var(--warn,#b8870f)', '11'));
      var rx = 18, ry = 134;
      for (i = 0; i < n; i++) {
        svg.appendChild(box(rx, ry, 58, 30, 'LLM', false));
        svg.appendChild(arrow(rx + 58, ry + 15, rx + 78, ry + 15));
        svg.appendChild(box(rx + 78, ry, 42, 30, 'act', false));
        if (i < n - 1) { svg.appendChild(arrow(rx + 120, ry + 15, rx + 138, ry + 15)); }
        rx += 138;
        if (rx > W - 120) { rx = 18; ry += 40; }
      }
      var rewooCalls = 1;
      var reactCalls = n;
      meta.textContent = 'ReWOO uses ' + rewooCalls + ' planning call for ' + n + ' tools; ReAct uses ' + reactCalls + ' model calls, one before each tool';
      formula.textContent = 'ReWOO model calls = 1 + (1 solve)  vs  ReAct model calls = ' + n + '  ->  ' + (n + 1) + ' total vs ' + n + ', but ReWOO front-loads the context once';
    };
    var grid = el('div', {}, [LF.slider(state, 'steps', 'tool calls in the plan', 2, 6, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['REWOO PLAN-EXECUTE']), el('span', {}, ['drag the plan size'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['ReWOO separates reasoning from observation. A planner writes the full chain of tool calls in one pass, then a worker executes them without calling the model again between steps. ReAct instead invokes the model before every action, re-reading the whole growing trajectory each time, which costs more tokens as the run gets longer.'])
    ]));
    state._render();
  }

  // -- tree-of-thoughts: branching reasoning tree, beam keeps the best path ---
  function treeOfThoughts(host) {
    var state = { breadth: 3, depth: 3, beam: 2 };
    var W = 520, H = 250, PAD = 22;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // deterministic pseudo-score from level and index
    function score(level, idx) {
      var v = Math.sin((level + 1) * 12.9898 + (idx + 1) * 78.233) * 43758.5453;
      return v - Math.floor(v);
    }
    state._render = function () {
      var b = state.breadth, depth = state.depth, beam = Math.min(state.beam, b);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var rowH = (H - 2 * PAD) / depth;
      var level, kept = [{ x: W / 2, idx: 0 }];
      svg.appendChild(svgEl('circle', { cx: W / 2, cy: PAD, r: '6', fill: 'var(--blueprint,#3553ff)' }));
      var lastBest = null, totalNodes = 1;
      for (level = 1; level <= depth; level++) {
        var children = [], parentRow = kept, y = PAD + rowH * level;
        var slot = 0, totalSlots = parentRow.length * b;
        parentRow.forEach(function (p, pi) {
          var k;
          for (k = 0; k < b; k++) {
            var x = (W) * (slot + 1) / (totalSlots + 1);
            var s = score(level, slot);
            children.push({ x: x, y: y, idx: slot, s: s, px: p.x });
            slot++;
            totalNodes++;
          }
        });
        // pick beam best children by score
        var ranked = children.slice().sort(function (a, c) { return c.s - a.s; });
        var keepSet = {};
        var m; for (m = 0; m < beam && m < ranked.length; m++) { keepSet[ranked[m].idx] = true; }
        children.forEach(function (c) {
          var on = !!keepSet[c.idx];
          svg.appendChild(svgEl('line', { x1: c.px, y1: PAD + rowH * (level - 1) + 6, x2: c.x, y2: c.y - 6, stroke: on ? 'var(--blueprint,#3553ff)' : 'var(--rule-soft,#ddd)', 'stroke-width': on ? '1.4' : '0.8', opacity: on ? '0.9' : '0.5' }));
          svg.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: on ? '6' : '4', fill: on ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1' }));
        });
        kept = children.filter(function (c) { return keepSet[c.idx]; }).map(function (c) { return { x: c.x, idx: c.idx }; });
        lastBest = ranked[0];
      }
      var explored = totalNodes - 1;
      meta.textContent = explored + ' thoughts explored across ' + depth + ' levels  ·  beam keeps the top ' + Math.min(state.beam, b) + ' per level (blue), prunes the rest';
      formula.textContent = 'breadth ' + b + ' x depth ' + depth + ' = up to ' + Math.pow(b, depth) + ' leaves; beam search caps the frontier at ' + Math.min(state.beam, b) + ' to stay tractable';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'breadth', 'breadth (thoughts per node)', 2, 4, 1),
      LF.slider(state, 'depth', 'depth (reasoning steps)', 1, 4, 1),
      LF.slider(state, 'beam', 'beam width kept', 1, 4, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TREE OF THOUGHTS']), el('span', {}, ['drag breadth and depth'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Tree of Thoughts turns a single chain into a search. At each step the model proposes several candidate thoughts; a scorer ranks them and a beam keeps only the best few to expand. Pruning the weak branches is what makes the exponential tree affordable while still letting the agent backtrack from a bad line of reasoning.'])
    ]));
    state._render();
  }

  // -- self-refine: critique-and-revise loop, quality climbs then plateaus ----
  function selfRefine(host) {
    var state = { iters: 3 };
    var W = 520, H = 210, PAD = 34, IMAX = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // quality(0)=52, gains shrink geometrically toward a ceiling of 94
    function quality(k) { return 94 - 42 * Math.pow(0.62, k); }
    function px(k) { return PAD + k / IMAX * (W - 2 * PAD); }
    function py(q) { return H - PAD - (q - 40) / 60 * (H - 2 * PAD); }
    state._render = function () {
      var n = state.iters;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(94), x2: W - PAD, y2: py(94), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(label(W - PAD - 30, py(94) - 6, 'ceiling', 'var(--ink-mute,#777)', '9'));
      var d = '', k;
      for (k = 0; k <= IMAX; k++) { d += (k ? 'L' : 'M') + px(k).toFixed(1) + ' ' + py(quality(k)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }));
      for (k = 0; k <= n; k++) {
        svg.appendChild(svgEl('circle', { cx: px(k), cy: py(quality(k)), r: k === n ? '5' : '3.5', fill: 'var(--blueprint,#3553ff)' }));
      }
      var q = quality(n), gain = quality(n) - quality(n - 1 < 0 ? 0 : n - 1);
      num.innerHTML = q.toFixed(1) + ' <small>/ 100 quality</small>';
      meta.textContent = n === 0 ? 'first draft, no self-critique yet'
        : 'iteration ' + n + ' gained +' + (n >= 1 ? (quality(n) - quality(n - 1)).toFixed(1) : '0') + ' points  ·  ' + (n >= 4 ? 'returns have flattened, stop refining' : 'still improving');
      formula.textContent = 'each pass: critique own output -> revise.  gain_k = ceiling - draft shrinks geometrically, so quality plateaus';
    };
    var grid = el('div', {}, [LF.slider(state, 'iters', 'refinement iterations', 0, IMAX, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SELF-REFINE']), el('span', {}, ['drag the iterations'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Self-Refine has one model write an answer, critique its own work, and revise, looping the output back as input. The first few passes catch the obvious flaws and gain the most; later passes find less to fix, so quality climbs toward a ceiling and flattens. The skill is knowing when extra iterations stop paying for their tokens.'])
    ]));
    state._render();
  }

  // -- memory-blocks: fixed core memory + unbounded archival, paging in/out ---
  function memoryBlocks(host) {
    var state = { paged: 3 };
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var CORE = 4; // fixed core slots
    var archival = ['proj specs', 'api keys note', 'user prefs', 'past bug', 'design doc', 'meeting log', 'schema v2', 'todo list'];
    state._render = function () {
      var paged = state.paged;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      // context window column (core memory, fixed)
      svg.appendChild(label(110, 18, 'context window', 'var(--blueprint,#3553ff)', '11'));
      var cy = 30, slot;
      for (slot = 0; slot < CORE; slot++) {
        var filled = slot < paged;
        svg.appendChild(box(40, cy, 140, 38, filled ? archival[slot] : 'free slot', filled));
        cy += 46;
      }
      // archival store (unbounded)
      svg.appendChild(label(400, 18, 'archival store (unbounded)', 'var(--ink-mute,#777)', '11'));
      var ax = 320, ay = 30, j;
      for (j = 0; j < archival.length; j++) {
        var inCtx = j < paged;
        var col = j % 2, row = Math.floor(j / 2);
        svg.appendChild(box(ax + col * 100, ay + row * 46, 92, 38, archival[j].split(' ')[0], false));
        if (inCtx) {
          svg.appendChild(svgEl('rect', { x: ax + col * 100, y: ay + row * 46, width: 92, height: 38, rx: '4', fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.5', 'stroke-dasharray': '3 2' }));
        }
      }
      svg.appendChild(arrow(186, 120, 314, 120, '5 4'));
      svg.appendChild(label(250, 112, 'page in / out', 'var(--ink-soft,#555)', '9'));
      meta.textContent = paged + ' of ' + CORE + ' core slots filled  ·  ' + (archival.length - paged) + ' items stay in archival until retrieved (outlined = currently paged in)';
      formula.textContent = 'core memory is fixed and always in context; archival is unbounded on disk.  agent pages relevant items in and evicts stale ones to respect the window';
    };
    var grid = el('div', {}, [LF.slider(state, 'paged', 'items paged into core', 0, 4, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['MEMORY BLOCKS']), el('span', {}, ['drag what is paged in'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Structured agent memory splits a fixed core block that always sits in the context window from an unbounded archival store on disk. The agent reads and writes its own memory: when core fills, it summarizes or evicts the least relevant items into archival and pages others back in on demand. This is how an agent keeps an effectively limitless history inside a finite window.'])
    ]));
    state._render();
  }

  // -- voyager-skills: skill library grows, later tasks compose old skills ----
  function voyagerSkills(host) {
    var state = { episodes: 4 };
    var W = 520, H = 230, PAD = 22;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // each episode adds skills; later episodes reuse some prior skills
    var newPerEp = [2, 2, 1, 2, 1, 1, 1, 1];
    var reusePerEp = [0, 1, 2, 2, 3, 3, 4, 4];
    state._render = function () {
      var ep = state.episodes;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var libSize = 0, reusedTotal = 0, i;
      for (i = 0; i < ep; i++) { libSize += newPerEp[i]; reusedTotal += reusePerEp[i]; }
      // growth bars: library size after each episode
      var maxLib = 0, cum = 0, sizes = [];
      for (i = 0; i < 8; i++) { cum += newPerEp[i]; sizes.push(cum); if (cum > maxLib) maxLib = cum; }
      var bw = (W - 2 * PAD) / 8;
      for (i = 0; i < 8; i++) {
        var active = i < ep;
        var h = sizes[i] / maxLib * (H - 2 * PAD - 30);
        svg.appendChild(svgEl('rect', { x: PAD + i * bw + 4, y: H - PAD - h, width: bw - 8, height: h, fill: active ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
        if (active) { svg.appendChild(label(PAD + i * bw + bw / 2, H - PAD - h - 5, String(sizes[i]), 'var(--blueprint,#3553ff)', '10')); }
        svg.appendChild(label(PAD + i * bw + bw / 2, H - PAD + 14, 'ep' + (i + 1), 'var(--ink-mute,#777)', '9'));
      }
      svg.appendChild(label(W / 2, 16, 'skills in the library after each episode', 'var(--ink-soft,#555)', '11'));
      meta.textContent = 'episode ' + ep + ': library holds ' + libSize + ' reusable skills  ·  this run reused ' + reusePerEp[ep - 1] + ' existing skills before writing new ones';
      formula.textContent = 'each solved task is distilled into a named, reusable skill.  later tasks are solved by composing skills already in the library, so the curve compounds';
    };
    var grid = el('div', {}, [LF.slider(state, 'episodes', 'episodes completed', 1, 8, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['VOYAGER SKILL LIBRARY']), el('span', {}, ['drag the episodes'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A lifelong agent turns each solved task into a named, reusable skill and stores it. As episodes accumulate, the library grows, and later tasks are solved faster by composing skills already on the shelf instead of starting from scratch. The capability compounds: every success makes the next problem cheaper.'])
    ]));
    state._render();
  }

  // -- langgraph-state: state machine of nodes, conditional edges, step through
  function langgraphState(host) {
    var state = { step: 0 };
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var stateOut = el('div', { class: 'lf-formula' });
    // nodes laid out; a deterministic walk visits them, updating a state object
    var nodes = [
      { x: 210, y: 24, w: 100, label: 'START' },
      { x: 70, y: 96, w: 110, label: 'retrieve' },
      { x: 340, y: 96, w: 110, label: 'generate' },
      { x: 210, y: 168, w: 120, label: 'grade' },
      { x: 40, y: 168, w: 90, label: 'rewrite' }
    ];
    // walk: START -> retrieve -> generate -> grade -> (rewrite) -> generate -> grade -> END
    var walk = [0, 1, 2, 3, 4, 2, 3];
    var updates = [
      { key: 'query', val: '"how to deploy"' },
      { key: 'docs', val: '[d1, d2, d3]' },
      { key: 'draft', val: '"run iii ..."' },
      { key: 'grade', val: 'fail (off-topic)' },
      { key: 'query', val: '"deploy iii engine"' },
      { key: 'draft', val: '"iii cloud deploy"' },
      { key: 'grade', val: 'pass' }
    ];
    state._render = function () {
      var s = Math.min(state.step, walk.length - 1);
      var cur = walk[s];
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      // static edges
      function center(i) { return { x: nodes[i].x + nodes[i].w / 2, y: nodes[i].y + 22 }; }
      var edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 2]];
      edges.forEach(function (e) {
        var a = center(e[0]), b = center(e[1]);
        svg.appendChild(arrow(a.x, a.y + 18, b.x, b.y - 18, e[0] === 3 ? '4 3' : ''));
      });
      var i;
      for (i = 0; i < nodes.length; i++) {
        svg.appendChild(box(nodes[i].x, nodes[i].y, nodes[i].w, 44, nodes[i].label, i === cur));
      }
      svg.appendChild(label(120, 168 - 8, 'grade=fail', 'var(--warn,#b8870f)', '9'));
      // render the state object accumulated so far
      var st = {}, j;
      for (j = 0; j <= s; j++) { st[updates[j].key] = updates[j].val; }
      while (stateOut.firstChild) stateOut.removeChild(stateOut.firstChild);
      var keys = ['query', 'docs', 'draft', 'grade'], lines = [];
      keys.forEach(function (k) { if (st[k] !== undefined) lines.push(k + ': ' + st[k]); });
      stateOut.appendChild(document.createTextNode('state = { ' + lines.join(',  ') + ' }'));
      meta.textContent = 'step ' + (s + 1) + ' of ' + walk.length + ': node "' + nodes[cur].label + '" ran  ·  ' + (walk[s] === 4 ? 'grade failed, conditional edge loops back to rewrite' : nodes[cur].label === 'grade' ? 'a conditional edge branches on the grade' : 'state object updated and passed to the next node');
    };
    var grid = el('div', {}, [LF.slider(state, 'step', 'step through the graph', 0, 6, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['STATEFUL GRAPH']), el('span', {}, ['drag to step through'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [stateOut]), meta])]),
      el('div', { class: 'lf-cap' }, ['A stateful graph models an agent as nodes connected by edges, threading one shared state object through every node. Each node reads the state, does its work, and writes back. Conditional edges branch on the state, so a failed grade can loop back to rewrite instead of finishing. The graph makes control flow explicit and the state inspectable at every step.'])
    ]));
    state._render();
  }

  // -- multi-agent-debate: two agents converge over rounds, accuracy vs rounds
  function multiAgentDebate(host) {
    var state = { rounds: 3 };
    var W = 520, H = 240, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var RMAX = 6;
    // two answer estimates start apart and pull toward a shared answer (0.5)
    var TRUTH = 0.5;
    function posA(r) { return TRUTH + (0.28) * Math.pow(0.55, r); }
    function posB(r) { return TRUTH - (0.34) * Math.pow(0.55, r); }
    // accuracy rises as the gap closes, with diminishing returns
    function acc(r) { return 62 + 32 * (1 - Math.pow(0.55, r)); }
    function px(r) { return PAD + r / RMAX * (W - 2 * PAD - 40); }
    function py(p) { return PAD + (1 - p) * (H - 2 * PAD); }
    state._render = function () {
      var n = state.rounds;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // shared-answer line
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(TRUTH), x2: W - PAD - 40, y2: py(TRUTH), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(label(W - PAD - 18, py(TRUTH) + 3, 'answer', 'var(--ink-mute,#777)', '9'));
      function track(fn, st) {
        var d = '', r; for (r = 0; r <= RMAX; r++) { d += (r ? 'L' : 'M') + px(r).toFixed(1) + ' ' + py(fn(r)).toFixed(1) + ' '; }
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: st, 'stroke-width': '1.4', 'stroke-dasharray': '4 3', opacity: '0.5' }));
      }
      track(posA, 'var(--blueprint,#3553ff)');
      track(posB, 'var(--warn,#b8870f)');
      var r;
      for (r = 0; r <= n; r++) {
        svg.appendChild(svgEl('circle', { cx: px(r), cy: py(posA(r)), r: r === n ? '5' : '3', fill: 'var(--blueprint,#3553ff)' }));
        svg.appendChild(svgEl('circle', { cx: px(r), cy: py(posB(r)), r: r === n ? '5' : '3', fill: 'var(--warn,#b8870f)' }));
      }
      svg.appendChild(label(PAD + 20, py(posA(0)) - 8, 'agent A', 'var(--blueprint,#3553ff)', '9'));
      svg.appendChild(label(PAD + 20, py(posB(0)) + 14, 'agent B', 'var(--warn,#b8870f)', '9'));
      var gap = Math.abs(posA(n) - posB(n));
      num.innerHTML = acc(n).toFixed(0) + ' <small>% accuracy</small>';
      meta.textContent = 'round ' + n + ': positions differ by ' + (gap * 100).toFixed(0) + ' points  ·  ' + (gap < 0.06 ? 'agents have converged' : n >= 4 ? 'gains have flattened, extra rounds rarely help' : 'still converging');
      formula.textContent = 'each round, agents read the other transcript and update.  convergence is geometric, so accuracy rises with diminishing returns';
    };
    var grid = el('div', {}, [LF.slider(state, 'rounds', 'debate rounds', 0, RMAX, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['MULTI-AGENT DEBATE']), el('span', {}, ['drag the rounds'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['In debate, several agents answer independently, then read each other transcripts and revise across rounds. Disagreement forces each to defend or correct its reasoning, and the positions usually converge toward a better shared answer. The first one or two rounds capture most of the accuracy gain; beyond that the agents agree and extra rounds mostly burn tokens.'])
    ]));
    state._render();
  }

  // -- orchestration-pattern: supervisor | swarm | hierarchical topologies ----
  function orchestrationPattern(host) {
    var state = { pat: 'supervisor' };
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var N = 5;
    function dot(x, y, on) { return svgEl('circle', { cx: x, cy: y, r: on ? '10' : '8', fill: on ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2' }); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var edges = 0, i, j;
      if (state.pat === 'supervisor') {
        var sx = W / 2, sy = 40;
        var workers = [], k;
        for (k = 0; k < N; k++) { workers.push({ x: (W) * (k + 1) / (N + 1), y: 170 }); }
        for (k = 0; k < N; k++) {
          svg.appendChild(svgEl('line', { x1: sx, y1: sy + 10, x2: workers[k].x, y2: workers[k].y - 10, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2' }));
          edges++;
        }
        svg.appendChild(dot(sx, sy, true));
        for (k = 0; k < N; k++) { svg.appendChild(dot(workers[k].x, workers[k].y, false)); }
        svg.appendChild(label(sx, sy - 16, 'supervisor', 'var(--blueprint,#3553ff)', '10'));
        formula.textContent = 'one supervisor routes to N workers: ' + N + ' edges, O(N).  central planning, single point of control and failure';
      } else if (state.pat === 'swarm') {
        var pts = [], a;
        for (i = 0; i < N; i++) { a = -Math.PI / 2 + 2 * Math.PI * i / N; pts.push({ x: W / 2 + 80 * Math.cos(a), y: 110 + 70 * Math.sin(a) }); }
        for (i = 0; i < N; i++) { for (j = i + 1; j < N; j++) {
          svg.appendChild(svgEl('line', { x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, stroke: 'var(--warn,#b8870f)', 'stroke-width': '0.8', opacity: '0.55' }));
          edges++;
        } }
        for (i = 0; i < N; i++) { svg.appendChild(dot(pts[i].x, pts[i].y, false)); }
        formula.textContent = 'peers hand off directly: ' + edges + ' edges, O(N^2).  no central bottleneck, but coordination cost grows fast';
      } else {
        // hierarchical: root -> 2 mids -> leaves
        var rootX = W / 2, rootY = 30;
        var mids = [{ x: W / 3, y: 110 }, { x: 2 * W / 3, y: 110 }];
        svg.appendChild(dot(rootX, rootY, true));
        mids.forEach(function (m, mi) {
          svg.appendChild(svgEl('line', { x1: rootX, y1: rootY + 10, x2: m.x, y2: m.y - 10, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2' }));
          edges++;
          var li;
          for (li = 0; li < 2; li++) {
            var lx = m.x - 40 + li * 80, ly = 190;
            svg.appendChild(svgEl('line', { x1: m.x, y1: m.y + 10, x2: lx, y2: ly - 10, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1' }));
            edges++;
            svg.appendChild(dot(lx, ly, false));
          }
          svg.appendChild(dot(m.x, m.y, false));
        });
        svg.appendChild(label(rootX, rootY - 14, 'root', 'var(--blueprint,#3553ff)', '10'));
        formula.textContent = 'tree of supervisors: ' + edges + ' edges, depth-limited fan-out.  delegation scales but adds latency per layer';
      }
      meta.textContent = 'pattern "' + state.pat + '"  ·  ' + edges + ' coordination edges among ' + (state.pat === 'hierarchical' ? '7' : N) + ' agents';
    };
    var grid = el('div', {}, [LF.select(state, 'pat', 'orchestration pattern', [
      ['supervisor', 'supervisor'], ['swarm (peer-to-peer)', 'swarm'], ['hierarchical', 'hierarchical']
    ])]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ORCHESTRATION PATTERN']), el('span', {}, ['pick a topology'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['The three common multi-agent topologies trade control for resilience. A supervisor centralizes routing in O(N) edges but is a single point of failure. A peer-to-peer swarm has no bottleneck yet pays O(N squared) coordination cost. A hierarchy delegates through layers of supervisors, scaling fan-out at the price of added latency per level. The right choice depends on how much the agents must talk to each other.'])
    ]));
    state._render();
  }

  LF.register({
    'rewoo-plan': rewooPlan,
    'tree-of-thoughts': treeOfThoughts,
    'self-refine': selfRefine,
    'memory-blocks': memoryBlocks,
    'voyager-skills': voyagerSkills,
    'langgraph-state': langgraphState,
    'multi-agent-debate': multiAgentDebate,
    'orchestration-pattern': orchestrationPattern
  });
})();
