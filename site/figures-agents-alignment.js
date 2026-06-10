/* figures-agents-alignment.js - interactive lesson figures for agent
   engineering, multi-agent swarms, and alignment. Loads after
   lesson-figures.js and registers through window.LF. No deps, ES5, theme via
   CSS vars. Authoring: a ```figure block naming one of the widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function arrowDefs() {
    var marker = svgEl('marker', { id: 'lf-aa-arrow', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, [
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
    return svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.4', 'marker-end': 'url(#lf-aa-arrow)', 'stroke-dasharray': dash || '' });
  }

  // ── agent-loop: think → act → observe cycle, current node highlighted ──────
  function agentLoop(host) {
    var state = { step: 0 };
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var nodes = [
      { x: 210, y: 28, label: 'THINK' },
      { x: 360, y: 150, label: 'ACT' },
      { x: 60, y: 150, label: 'OBSERVE' }
    ];
    var notes = ['plan the next action from goal + history', 'call a tool with the chosen arguments', 'read the result, append to the trajectory'];
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      var cur = state.step % 3;
      var cx = [285, 210, 135], cy = [108, 192, 108];
      var i;
      for (i = 0; i < 3; i++) {
        var a = nodes[i], b = nodes[(i + 1) % 3];
        svg.appendChild(arrow(a.x + 75, a.y + 22 + 6 * (i === 0 ? 1 : -0), b.x + (i === 2 ? 75 : 0), b.y + 22));
      }
      svg.appendChild(arrow(135, 128, 240, 60, '4 4'));
      svg.appendChild(arrow(290, 60, 380, 128, '4 4'));
      svg.appendChild(arrow(360, 196, 100, 196, '4 4'));
      for (i = 0; i < 3; i++) {
        svg.appendChild(box(nodes[i].x, nodes[i].y, 100, 44, nodes[i].label, i === cur));
      }
      svg.appendChild((function () {
        var t = svgEl('text', { x: 260, y: 132, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '10', fill: 'var(--ink-mute,#777)' });
        t.appendChild(document.createTextNode('step ' + (state.step + 1)));
        return t;
      })());
      meta.textContent = nodes[cur].label.toLowerCase() + ': ' + notes[cur] + '  ·  loop ends when the goal is met or a step budget runs out';
    };
    var grid = el('div', {}, [LF.slider(state, 'step', 'step', 0, 11, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['AGENT LOOP']), el('span', {}, ['drag the step'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta])]),
      el('div', { class: 'lf-cap' }, ['An agent is a loop, not a single call. It thinks about the next move, acts by calling a function, observes the result, and feeds that observation back into the next thought. The cycle repeats until the goal is reached or a step budget is exhausted.'])
    ]));
    state._render();
  }

  // ── react-trace: Thought / Action / Observation rows unfold by step ────────
  function reactTrace(host) {
    var state = { step: 1 };
    var trace = [
      ['Thought', 'I need the current population of Tokyo.'],
      ['Action', 'search("Tokyo population 2026")'],
      ['Observation', '"Tokyo metro: about 37 million."'],
      ['Thought', 'The question asks for the city proper, not metro.'],
      ['Action', 'search("Tokyo city proper population")'],
      ['Observation', '"Tokyo (23 wards): about 14 million."'],
      ['Thought', 'I now have the figure to answer.'],
      ['Action', 'finish("About 14 million in the 23 wards.")']
    ];
    var rows = el('div', {});
    var meta = el('div', { class: 'lf-meta' });
    function color(kind) { return kind === 'Thought' ? 'var(--warn,#b8870f)' : kind === 'Action' ? 'var(--blueprint,#3553ff)' : 'var(--ink-soft,#555)'; }
    state._render = function () {
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var n = state.step, i;
      for (i = 0; i < n; i++) {
        var k = trace[i][0], v = trace[i][1];
        var tag = el('b', { style: 'color:' + color(k) + ';min-width:90px;display:inline-block' }, [k]);
        rows.appendChild(el('div', {
          class: 'lf-formula',
          style: 'padding:5px 8px;border-left:2px solid ' + color(k) + ';margin-top:4px;background:var(--bg-surface,#eee)'
        }, [tag, document.createTextNode(' ' + v)]));
      }
      var last = trace[n - 1][0];
      meta.textContent = n + ' of ' + trace.length + ' rows  ·  ' + (last === 'Observation' ? 'tool result returned, agent will reason next' : last === 'Action' && trace[n - 1][1].indexOf('finish') === 0 ? 'agent has produced the final answer' : last === 'Action' ? 'awaiting the tool result' : 'reasoning before the next action');
    };
    var grid = el('div', {}, [LF.slider(state, 'step', 'reveal up to step', 1, 8, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['REACT TRACE']), el('span', {}, ['drag to unfold'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, meta])]),
      el('div', { class: 'lf-cap' }, ['ReAct interleaves reasoning with acting. Each Thought decides what to do, each Action calls a tool, each Observation feeds the result back. Making the reasoning explicit lets the agent recover from a wrong turn instead of committing to it.'])
    ]));
    state._render();
  }

  // ── tool-routing: a query maps to one registered tool by description match ─
  function toolRouting(host) {
    var tools = [
      { name: 'search_web', desc: 'find facts and current events' },
      { name: 'run_python', desc: 'compute, parse, transform data' },
      { name: 'send_email', desc: 'compose and send a message' },
      { name: 'query_db', desc: 'look up rows in the database' }
    ];
    var queries = [
      { text: 'what is the GDP of France', sim: [0.91, 0.18, 0.05, 0.31] },
      { text: 'add up these expenses', sim: [0.12, 0.88, 0.09, 0.27] },
      { text: 'tell the team we shipped', sim: [0.10, 0.07, 0.93, 0.06] },
      { text: 'how many users signed up', sim: [0.34, 0.30, 0.05, 0.86] }
    ];
    var state = { q: '0' };
    var rows = el('div', {});
    var meta = el('div', { class: 'lf-meta' });
    state._render = function () {
      var q = queries[Number(state.q)];
      var best = 0, bi = 0, i;
      for (i = 0; i < q.sim.length; i++) { if (q.sim[i] > best) { best = q.sim[i]; bi = i; } }
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      tools.forEach(function (t, idx) {
        var on = idx === bi;
        var bar = el('i'); bar.style.width = (q.sim[idx] * 100).toFixed(0) + '%';
        if (!on) bar.style.background = 'var(--rule-soft,#ccc)';
        var lab = el('label', {}, [t.name + '  (' + t.desc + ')', el('b', {}, [on ? 'routed →' : q.sim[idx].toFixed(2)])]);
        if (!on) lab.style.opacity = '0.5';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' }, [bar])]));
      });
      meta.textContent = 'query "' + q.text + '"  →  ' + tools[bi].name + '  (similarity ' + best.toFixed(2) + ' to its description)';
    };
    var grid = el('div', {}, [LF.select(state, 'q', 'query', [
      ['what is the GDP of France', '0'], ['add up these expenses', '1'], ['tell the team we shipped', '2'], ['how many users signed up', '3']
    ])]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['TOOL ROUTING']), el('span', {}, ['pick a query'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, meta])]),
      el('div', { class: 'lf-cap' }, ['A router scores the query against each registered tool description and picks the closest match. Good function names and descriptions are not cosmetic: they are the signal the router uses to decide which tool to call.'])
    ]));
    state._render();
  }

  // ── swarm-messages: all-to-all O(N^2) vs hub/supervisor O(N) ───────────────
  function swarmMessages(host) {
    var state = { n: 6 };
    var W = 520, H = 240, R = 78;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function ring(cx, cy, n, drawHub) {
      var pts = [], i;
      for (i = 0; i < n; i++) {
        var a = -Math.PI / 2 + 2 * Math.PI * i / n;
        pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
      }
      var g = svgEl('g', {});
      if (drawHub) {
        for (i = 0; i < n; i++) {
          g.appendChild(svgEl('line', { x1: cx, y1: cy, x2: pts[i].x, y2: pts[i].y, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1', opacity: '0.8' }));
        }
        g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: '11', fill: 'var(--blueprint,#3553ff)' }));
      } else {
        for (i = 0; i < n; i++) {
          for (var j = i + 1; j < n; j++) {
            g.appendChild(svgEl('line', { x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, stroke: 'var(--warn,#b8870f)', 'stroke-width': '0.8', opacity: '0.5' }));
          }
        }
      }
      for (i = 0; i < n; i++) {
        g.appendChild(svgEl('circle', { cx: pts[i].x, cy: pts[i].y, r: '7', fill: 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2' }));
      }
      return g;
    }
    state._render = function () {
      var n = state.n;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(ring(140, 120, n, false));
      svg.appendChild(ring(390, 120, n, true));
      [['all-to-all', 140], ['hub / supervisor', 390]].forEach(function (p) {
        var t = svgEl('text', { x: p[1], y: 224, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '11', fill: 'var(--ink-mute,#777)' });
        t.appendChild(document.createTextNode(p[0])); svg.appendChild(t);
      });
      var mesh = n * (n - 1);
      meta.textContent = 'all-to-all: ' + mesh + ' directed messages (N·(N−1))  ·  hub: ' + (2 * n) + ' edges (O(N))';
      formula.textContent = 'broadcast cost grows as O(N²); a supervisor funnels traffic through one node for O(N)';
    };
    var grid = el('div', {}, [LF.slider(state, 'n', 'agents N', 2, 12, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SWARM MESSAGES']), el('span', {}, ['drag N'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['If every agent talks to every other agent, message count grows as N·(N−1), so naive broadcast scales quadratically. Routing all traffic through a supervisor cuts it to a linear number of edges, which is why large systems centralize coordination.'])
    ]));
    state._render();
  }

  // ── supervisor-hierarchy: branching factor and depth → total agents ────────
  function supervisorHierarchy(host) {
    var state = { b: 3, depth: 2 };
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var b = state.b, depth = state.depth;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      var total = 0, level, levelTop = 28, rowH = (H - 56) / Math.max(1, depth);
      var prev = [{ x: W / 2 }];
      total += 1;
      svg.appendChild(svgEl('circle', { cx: W / 2, cy: levelTop, r: '10', fill: 'var(--blueprint,#3553ff)' }));
      for (level = 1; level <= depth; level++) {
        var count = Math.pow(b, level);
        if (count > 64) { count = 64; }
        total += count;
        var y = levelTop + rowH * level;
        var cur = [];
        var k;
        for (k = 0; k < count; k++) {
          var x = (W) * (k + 1) / (count + 1);
          cur.push({ x: x });
          var parent = prev[Math.floor(k / b) % prev.length] || prev[0];
          svg.appendChild(svgEl('line', { x1: parent.x, y1: levelTop + rowH * (level - 1) + 8, x2: x, y2: y - 7, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1' }));
          svg.appendChild(svgEl('circle', { cx: x, cy: y, r: level === depth ? '6' : '8', fill: level === depth ? 'var(--bg-surface,#eee)' : 'var(--blueprint,#3553ff)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1' }));
        }
        prev = cur;
      }
      var exact = 0, lv; for (lv = 0; lv <= depth; lv++) { exact += Math.pow(b, lv); }
      meta.textContent = 'branching ' + b + ', depth ' + depth + '  →  ' + exact + ' agents total (leaves do the work, internal nodes delegate)';
      formula.textContent = 'total = Σ b^level for level 0..depth = (b^(depth+1) − 1) / (b − 1)';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'b', 'branching factor b', 1, 5, 1),
      LF.slider(state, 'depth', 'depth', 1, 3, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SUPERVISOR HIERARCHY']), el('span', {}, ['drag branching and depth'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A supervisor splits a task across worker agents, which may themselves supervise. Total agents is the geometric sum of the branching factor over the depth, so even a small fan-out explodes the head count quickly. Keep the tree shallow.'])
    ]));
    state._render();
  }

  // ── rlhf-reward-kl: reward − beta·KL; small beta lets the policy drift ─────
  function rlhfRewardKL(host) {
    var state = { beta: 0.2 };
    var W = 520, H = 220, PAD = 34, SMAX = 200;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(s) { return PAD + s / SMAX * (W - 2 * PAD); }
    var YMAX = 1.15;
    function py(v) { return H - PAD - (v / YMAX) * (H - 2 * PAD); }
    function rawReward(s) { return 1 - Math.exp(-s / 40); }
    function kl(s) { return Math.pow(s / SMAX, 2) * 1.6; }
    state._render = function () {
      var beta = state.beta;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0), x2: W - PAD, y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      function curve(fn, st, dash) {
        var d = '', i; for (i = 0; i <= 120; i++) { var s = SMAX * i / 120; d += (i ? 'L' : 'M') + px(s).toFixed(1) + ' ' + py(fn(s)).toFixed(1) + ' '; }
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: st, 'stroke-width': '1.8', 'stroke-dasharray': dash || '' }));
      }
      curve(rawReward, 'var(--ink-mute,#999)', '4 3');
      curve(function (s) { return beta * kl(s); }, 'var(--warn,#b8870f)', '2 3');
      var obj = function (s) { return rawReward(s) - beta * kl(s); };
      curve(obj, 'var(--blueprint,#3553ff)');
      var best = 0, bv = -1e9, peakDrift, sStep;
      for (sStep = 0; sStep <= SMAX; sStep += 2) { var v = obj(sStep); if (v > bv) { bv = v; best = sStep; } }
      svg.appendChild(svgEl('circle', { cx: px(best), cy: py(obj(best)), r: '4.5', fill: 'var(--blueprint,#3553ff)' }));
      peakDrift = kl(best);
      var hacking = best >= SMAX - 4 && beta < 0.15;
      status.innerHTML = hacking ? 'reward hacking' : 'peak at step ' + best;
      meta.textContent = hacking ? 'beta too small: nothing pulls the policy back, it over-optimizes the proxy reward and drifts from the reference'
        : 'KL penalty caps the drift at ' + peakDrift.toFixed(2) + '; the objective peaks then declines';
      formula.textContent = 'objective = reward − β·KL(π ‖ π_ref),  β = ' + beta.toFixed(2) + '   (grey reward, gold β·KL, blue objective)';
    };
    var grid = el('div', {}, [LF.slider(state, 'beta', 'KL penalty β', 0.02, 1.0, 0.02)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['RLHF: REWARD − β·KL']), el('span', {}, ['drag β'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['RLHF maximizes reward minus a KL penalty that keeps the policy near the reference model. When β is too small the penalty barely bites, so the policy chases the proxy reward and drifts off, exploiting flaws in the reward model. The KL term is the leash against reward hacking.'])
    ]));
    state._render();
  }

  // ── dpo-margin: chosen vs rejected log-probs and the DPO loss curve ────────
  function dpoMargin(host) {
    var state = { margin: 1.0, beta: 1.0 };
    var W = 520, H = 200, PAD = 34, MMAX = 6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
    function loss(m, beta) { return -Math.log(sigmoid(beta * m)); }
    function px(m) { return PAD + (m + MMAX) / (2 * MMAX) * (W - 2 * PAD); }
    var LMAX = loss(-MMAX, 1.0);
    function py(l) { return H - PAD - Math.min(l, LMAX) / LMAX * (H - 2 * PAD); }
    state._render = function () {
      var m = state.margin, beta = state.beta;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: px(0), y1: PAD, x2: px(0), y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var d = '', i; for (i = 0; i <= 120; i++) { var mm = -MMAX + 2 * MMAX * i / 120; d += (i ? 'L' : 'M') + px(mm).toFixed(1) + ' ' + py(loss(mm, beta)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('circle', { cx: px(m), cy: py(loss(m, beta)), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      num.innerHTML = loss(m, beta).toFixed(3) + ' <small>DPO loss</small>';
      meta.textContent = (m > 0 ? 'chosen ranked above rejected by ' + m.toFixed(2) : m < 0 ? 'rejected wrongly ranked above chosen' : 'tie') + '  ·  P(prefer chosen) = ' + sigmoid(beta * m).toFixed(2);
      formula.textContent = 'loss = −log σ(β·(r_chosen − r_rejected)),  margin = ' + m.toFixed(2) + ', β = ' + beta.toFixed(1) + '   ·   larger margin → lower loss';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'margin', 'reward margin (chosen − rejected)', -4, 4, 0.1),
      LF.slider(state, 'beta', 'β', 0.2, 3.0, 0.1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['DPO MARGIN']), el('span', {}, ['drag the margin'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['DPO trains directly on preference pairs with no separate reward model. The loss is −log σ of β times the implicit reward margin between the chosen and rejected response. A larger positive margin drives the loss toward zero; a negative margin (rejected ranked higher) is heavily penalized.'])
    ]));
    state._render();
  }

  // ── context-budget: tokens/turn × turns filling a fixed window ─────────────
  function contextBudget(host) {
    var state = { perTurn: 1200, turns: 14, windowK: 32 };
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var win = state.windowK * 1024;
      var used = state.perTurn * state.turns;
      var pct = used / win * 100;
      num.innerHTML = LF.fmtInt(used) + ' <small>/ ' + LF.fmtInt(win) + ' tokens</small>';
      bar.style.width = Math.min(100, pct) + '%';
      barWrap.classList.toggle('over', used > win);
      var turnsToFull = Math.ceil(win / state.perTurn);
      meta.textContent = (used > win ? '⚠ window overflowed: ' : Math.round(pct) + '% full: ')
        + (used > win ? 'older turns must be compacted or handed off' : 'compaction triggers near the top, at about turn ' + turnsToFull);
      formula.textContent = state.perTurn + ' tokens/turn × ' + state.turns + ' turns = ' + LF.fmtInt(used) + '  ·  window ' + state.windowK + 'K = ' + LF.fmtInt(win);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      LF.slider(state, 'perTurn', 'tokens per turn', 200, 4000, 100),
      LF.slider(state, 'turns', 'turns', 1, 60, 1),
      LF.slider(state, 'windowK', 'context window (K)', 8, 200, 8)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CONTEXT BUDGET']), el('span', {}, ['drag turns and window'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Every turn appends tokens to a fixed window. The running total climbs until it nears the limit, where the agent must compact old turns into a summary or hand off to a fresh context. Long sessions live or die on managing this budget.'])
    ]));
    state._render();
  }

  // ── guardrail-gates: ordered safety gates, one trips → blocked ─────────────
  function guardrailGates(host) {
    var state = { trip: '0' };
    var W = 520, H = 150;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var gates = ['input filter', 'policy check', 'output filter'];
    var notes = ['blocked: malicious or off-policy prompt rejected before the model runs',
      'blocked: model output violates a usage policy',
      'blocked: unsafe content scrubbed from the response'];
    state._render = function () {
      var trip = Number(state.trip);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(arrowDefs());
      var allowed = trip === 0;
      var bw = 110, gap = 22, x0 = 18, y = 44, h = 46;
      svg.appendChild(box(x0, y, 70, h, 'request', false));
      var prevX = x0 + 70, i;
      for (i = 0; i < 3; i++) {
        var gx = prevX + gap;
        var tripped = trip === i + 1;
        svg.appendChild(arrow(prevX, y + h / 2, gx, y + h / 2));
        svg.appendChild(box(gx, y, bw, h, gates[i], tripped));
        if (tripped) {
          var blockT = svgEl('text', { x: gx + bw / 2, y: y - 8, 'text-anchor': 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': '11', fill: 'var(--warn,#b8870f)' });
          blockT.appendChild(document.createTextNode('BLOCK'));
          svg.appendChild(blockT);
        }
        prevX = gx + bw;
        if (tripped) { break; }
      }
      if (allowed) { svg.appendChild(arrow(prevX, y + h / 2, prevX + gap, y + h / 2)); svg.appendChild(box(prevX + gap, y, 80, h, 'allowed', false)); }
      status.innerHTML = allowed ? 'allowed' : 'blocked';
      meta.textContent = allowed ? 'all gates pass: the response is returned to the user' : notes[trip - 1];
    };
    var grid = el('div', {}, [LF.select(state, 'trip', 'which gate trips', [
      ['none / all pass', '0'], ['input filter', '1'], ['policy check', '2'], ['output filter', '3']
    ])]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['GUARDRAIL GATES']), el('span', {}, ['pick a gate'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta])]),
      el('div', { class: 'lf-cap' }, ['Safety runs as ordered gates: an input filter before the model, a policy check on the request, and an output filter on the response. The first gate that trips blocks the request, so unsafe prompts never reach the model and unsafe outputs never reach the user.'])
    ]));
    state._render();
  }

  LF.register({
    'agent-loop': agentLoop,
    'react-trace': reactTrace,
    'tool-routing': toolRouting,
    'swarm-messages': swarmMessages,
    'supervisor-hierarchy': supervisorHierarchy,
    'rlhf-reward-kl': rlhfRewardKL,
    'dpo-margin': dpoMargin,
    'context-budget': contextBudget,
    'guardrail-gates': guardrailGates
  });
})();
