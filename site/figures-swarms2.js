/* figures-swarms2.js - animated, theme-aware figures for Phase 16
   (multi-agent and swarms). Loads after lesson-figures.js, registers through
   window.LF. No deps, ES5 only, SMIL animation, theme via CSS vars.
   Authoring: a ```figure block naming one of the widgets below. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;

  function shell(host, label, hint, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function txt(x, y, s, size, fill, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'var(--font-mono,monospace)', 'font-size': size || '10', fill: fill || 'var(--ink-mute,#777)' });
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function anim(attr, vals, dur, opts) {
    var a = { attributeName: attr, values: vals, dur: dur + 's', repeatCount: 'indefinite' };
    if (opts) for (var k in opts) a[k] = opts[k];
    return svgEl('animate', a);
  }

  var BP = 'var(--blueprint,#3553ff)';
  var WARN = 'var(--warn,#b8870f)';
  var SOFT = 'var(--rule-soft,#ddd)';
  var SURF = 'var(--bg-surface,#eee)';
  var BG = 'var(--bg,#fafaf5)';
  var MUTE = 'var(--ink-mute,#777)';

  // ── swarm-consensus-wave: a ring of agents flips to one shared color in a
  //    wave; one byzantine node stays off-color and never converges ──────────
  function consensusWave(host) {
    var W = 520, H = 250, CX = 260, CY = 120, R = 90, N = 8;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var byz = 5, period = 8, i;
    var px = [], py = [];
    for (i = 0; i < N; i++) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / N;
      px.push(CX + R * Math.cos(ang)); py.push(CY + R * Math.sin(ang));
    }
    for (i = 0; i < N; i++) {
      svg.appendChild(svgEl('line', { x1: px[i], y1: py[i], x2: px[(i + 1) % N], y2: py[(i + 1) % N], stroke: SOFT, 'stroke-width': '1.2' }));
    }
    for (i = 0; i < N; i++) {
      var isByz = (i === byz);
      var g = svgEl('g', {});
      var c = svgEl('circle', { cx: px[i], cy: py[i], r: '15', stroke: isByz ? WARN : BP, 'stroke-width': '2', fill: SURF });
      if (isByz) {
        c.setAttribute('fill', WARN);
      } else {
        // flip to consensus color in a staggered wave, then hold
        var begin = (i * (period / N)).toFixed(2);
        c.appendChild(svgEl('animate', { attributeName: 'fill', values: SURF + ';' + SURF + ';' + BP + ';' + BP, keyTimes: '0;0.12;0.2;1', dur: period + 's', begin: begin + 's', repeatCount: 'indefinite' }));
      }
      g.appendChild(c);
      g.appendChild(txt(px[i], py[i] + 4, isByz ? 'X' : String(i), '11', isByz ? BG : BP));
      svg.appendChild(g);
    }
    svg.appendChild(txt(CX, CY + 4, 'agree?', '11', MUTE));
    svg.appendChild(txt(CX, H - 16, 'wave of agreement spreads around the ring  ·  node X (byzantine) never joins', '10', MUTE));
    shell(host, 'CONSENSUS WAVE', 'one value spreads', svg,
      'Honest agents converge on a shared value as the decision ripples around the ring. A single byzantine node (X) refuses to flip, so naive majority can still be captured. Classical BFT tolerates f < n/3 such nodes; the open question for LLM agents is correlated faults, not arbitrary ones.');
  }

  // ── swarm-auction: bidders raise bars over time; the winner is highlighted,
  //    paying the second-highest price (Vickrey) ──────────────────────────────
  function auction(host) {
    var W = 520, H = 250, N = 5, base = 60, bw = 54, gap = 36, x0 = 70, period = 7;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var bids = [42, 88, 61, 30, 73];
    var winner = 1, second = 4; // index of highest and second-highest
    var floorY = H - 50, maxH = 130, maxBid = 100, i;
    svg.appendChild(svgEl('line', { x1: 40, y1: floorY, x2: W - 30, y2: floorY, stroke: SOFT, 'stroke-width': '1.4' }));
    for (i = 0; i < N; i++) {
      var x = x0 + i * (bw + gap);
      var h = bids[i] / maxBid * maxH;
      var isWin = (i === winner);
      var bar = svgEl('rect', { x: x, y: floorY, width: bw, height: 0, fill: isWin ? BP : SURF, stroke: isWin ? BP : SOFT, 'stroke-width': '1.5' });
      var beg = (i * 0.5).toFixed(2);
      // grow from floor to final height, then hold
      bar.appendChild(svgEl('animate', { attributeName: 'height', values: '0;' + h.toFixed(0) + ';' + h.toFixed(0), keyTimes: '0;0.45;1', dur: period + 's', begin: beg + 's', repeatCount: 'indefinite' }));
      bar.appendChild(svgEl('animate', { attributeName: 'y', values: floorY + ';' + (floorY - h).toFixed(0) + ';' + (floorY - h).toFixed(0), keyTimes: '0;0.45;1', dur: period + 's', begin: beg + 's', repeatCount: 'indefinite' }));
      svg.appendChild(bar);
      svg.appendChild(txt(x + bw / 2, floorY + 18, 'a' + i, '10', isWin ? BP : MUTE));
      svg.appendChild(txt(x + bw / 2, floorY - h - 8, '$' + bids[i], '11', isWin ? BP : MUTE));
      if (i === second) {
        // settlement line: winner pays the second-highest bid
        var sy = floorY - bids[second] / maxBid * maxH;
        var pay = svgEl('line', { x1: 40, y1: sy, x2: W - 30, y2: sy, stroke: WARN, 'stroke-width': '1.4', 'stroke-dasharray': '5 4', opacity: '0' });
        pay.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0;0.9;0.9', keyTimes: '0;0.55;0.7;1', dur: period + 's', repeatCount: 'indefinite' }));
        svg.appendChild(pay);
        svg.appendChild(txt(W - 36, sy - 6, 'pays 2nd price', '10', WARN, 'end'));
      }
    }
    svg.appendChild(txt(W / 2, 28, 'second-price (Vickrey) auction', '11', MUTE));
    shell(host, 'TOKEN AUCTION', 'highest bid wins', svg,
      'Agents bid for a task; bids rise as the round runs. The highest bidder (a1) wins but pays the second-highest price — the dashed line. Truthful bidding is the dominant strategy under second-price, which is why mechanism design favors it for allocating work and tokens across agents.');
  }

  // ── swarm-stigmergy: ants leave pheromone on edges between nest and food;
  //    the shortest edge brightens as traffic concentrates, others fade ───────
  function stigmergy(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var nest = { x: 60, y: 125 }, food = { x: 460, y: 125 };
    // three routes: a short direct one and two long detours
    var paths = [
      'M60 125 L260 125 L460 125',          // short, strong
      'M60 125 Q260 40 460 125',            // medium
      'M60 125 Q260 215 460 125'            // long, weak
    ];
    var strength = [1, 0.45, 0.2], dur = [2.0, 2.9, 3.6];
    var i;
    for (i = 0; i < paths.length; i++) {
      // base trail: opacity oscillates to show deposit + evaporation
      var base = svgEl('path', { id: 'lf-st-p' + i, d: paths[i], fill: 'none', stroke: BP, 'stroke-width': (1 + strength[i] * 3).toFixed(1), 'stroke-linecap': 'round' });
      base.appendChild(anim('opacity', (0.15 * strength[i]).toFixed(2) + ';' + (0.9 * strength[i] + 0.1).toFixed(2) + ';' + (0.15 * strength[i]).toFixed(2), 3 + i, {}));
      svg.appendChild(base);
      // ants riding the trail via animateMotion
      var nAnts = i === 0 ? 4 : 2, j;
      for (j = 0; j < nAnts; j++) {
        var ant = svgEl('circle', { r: '4', fill: i === 0 ? BP : MUTE });
        var mp = svgEl('animateMotion', { dur: dur[i] + 's', repeatCount: 'indefinite', begin: (j * dur[i] / nAnts).toFixed(2) + 's', rotate: 'auto' });
        mp.appendChild(svgEl('mpath', { href: '#lf-st-p' + i }));
        ant.appendChild(mp);
        svg.appendChild(ant);
      }
    }
    [[nest, 'nest'], [food, 'food']].forEach(function (n) {
      svg.appendChild(svgEl('circle', { cx: n[0].x, cy: n[0].y, r: '16', fill: SURF, stroke: BP, 'stroke-width': '2' }));
      svg.appendChild(txt(n[0].x, n[0].y + 4, n[1] === 'nest' ? 'N' : 'F', '11', BP));
      svg.appendChild(txt(n[0].x, n[0].y + 30, n[1], '10', MUTE));
    });
    svg.appendChild(txt(W / 2, H - 14, 'pheromone concentrates on the short route  ·  weak trails evaporate', '10', MUTE));
    shell(host, 'STIGMERGY', 'ants reinforce trails', svg,
      'No agent plans the route. Each deposits pheromone as it travels and prefers stronger trails, so the shortest path accumulates traffic while detours evaporate. ACO turns this into agent routing: the trail records which agent handled which task-type, decay lets better routes be rediscovered.');
  }

  // ── swarm-hierarchy-token: a delegation token flows down a tree of managers
  //    to workers, then results bubble back up the same edges ──────────────────
  function hierarchyToken(host) {
    var W = 520, H = 260, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var mgr = { x: 260, y: 36, l: 'MGR' };
    var sub = [{ x: 150, y: 120, l: 'A' }, { x: 370, y: 120, l: 'B' }];
    var wrk = [{ x: 90, y: 210 }, { x: 210, y: 210 }, { x: 330, y: 210 }, { x: 430, y: 210 }];
    var edges = [
      'M260 50 L150 106', 'M260 50 L370 106',
      'M150 134 L90 196', 'M150 134 L210 196',
      'M370 134 L330 196', 'M370 134 L430 196'
    ];
    var i, period = 6;
    for (i = 0; i < edges.length; i++) {
      svg.appendChild(svgEl('path', { id: 'lf-hi-e' + i, d: edges[i], fill: 'none', stroke: SOFT, 'stroke-width': '1.4' }));
    }
    // delegation token: travels down (first half), result bubbles up (second half)
    for (i = 0; i < edges.length; i++) {
      var down = svgEl('circle', { r: '5', fill: BP });
      var dm = svgEl('animateMotion', { dur: period + 's', repeatCount: 'indefinite', begin: (i < 2 ? 0 : 0.9) + 's', keyPoints: '0;1;1;1', keyTimes: '0;0.3;0.5;1', calcMode: 'linear' });
      dm.appendChild(svgEl('mpath', { href: '#lf-hi-e' + i }));
      down.appendChild(dm);
      down.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0;0', keyTimes: '0;0.3;0.31;1', dur: period + 's', begin: (i < 2 ? 0 : 0.9) + 's', repeatCount: 'indefinite' }));
      svg.appendChild(down);
      var up = svgEl('circle', { r: '5', fill: WARN });
      var um = svgEl('animateMotion', { dur: period + 's', repeatCount: 'indefinite', begin: (i < 2 ? 2.4 : 1.5) + 's', keyPoints: '1;0;0;0', keyTimes: '0;0.3;0.5;1', calcMode: 'linear' });
      um.appendChild(svgEl('mpath', { href: '#lf-hi-e' + i }));
      up.appendChild(um);
      up.appendChild(svgEl('animate', { attributeName: 'opacity', values: '1;1;0;0', keyTimes: '0;0.3;0.31;1', dur: period + 's', begin: (i < 2 ? 2.4 : 1.5) + 's', repeatCount: 'indefinite' }));
      svg.appendChild(up);
    }
    function node(n, on) {
      svg.appendChild(svgEl('rect', { x: n.x - 28, y: n.y, width: 56, height: 28, rx: '4', fill: on ? BP : SURF, stroke: on ? BP : SOFT, 'stroke-width': '1.5' }));
      svg.appendChild(txt(n.x, n.y + 18, n.l, '11', on ? BG : BP));
    }
    node(mgr, true);
    sub.forEach(function (s) { node(s, false); });
    wrk.forEach(function (w, k) { node({ x: w.x, y: w.y, l: 'w' + k }, false); });
    svg.appendChild(txt(W / 2, H - 6, 'blue = delegation down  ·  gold = results bubbling up', '10', MUTE));
    shell(host, 'HIERARCHY', 'delegate down, return up', svg,
      'A manager splits the goal and delegates down through sub-managers to workers; results return along the same edges. The risk: an LLM manager re-reasons the whole tree each turn, so small context drift misallocates work and the structure loops. Often a flat sequence beats it.');
  }

  // ── swarm-message-bus: typed packets travel along a shared spine; MCP and
  //    A2A lanes carry different message kinds via animateMotion ──────────────
  function messageBus(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var lanes = [
      { y: 80, l: 'MCP · tool call', d: 'M70 80 L450 80', col: BP },
      { y: 130, l: 'A2A · task', d: 'M70 130 L450 130', col: WARN },
      { y: 180, l: 'ANP · identity', d: 'M70 180 L450 180', col: MUTE }
    ];
    var i, j;
    // endpoints
    [70, 450].forEach(function (x, e) {
      svg.appendChild(svgEl('rect', { x: x - 26, y: 60, width: 52, height: 140, rx: '5', fill: SURF, stroke: SOFT, 'stroke-width': '1.5' }));
      svg.appendChild(txt(x, 52, e === 0 ? 'agent A' : 'agent B', '10', MUTE));
    });
    for (i = 0; i < lanes.length; i++) {
      var ln = lanes[i];
      svg.appendChild(svgEl('path', { id: 'lf-bus-l' + i, d: ln.d, fill: 'none', stroke: SOFT, 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
      svg.appendChild(txt(W - 60, ln.y - 8, ln.l, '9', ln.col, 'end'));
      var nP = 3, dur = 3 + i * 0.6;
      for (j = 0; j < nP; j++) {
        var dir = (i === 1) ? 1 : 0; // A2A travels back B->A occasionally
        var pkt = svgEl('rect', { x: -5, y: -5, width: 10, height: 10, rx: '2', fill: ln.col });
        var mm = svgEl('animateMotion', { dur: dur + 's', repeatCount: 'indefinite', begin: (j * dur / nP).toFixed(2) + 's', rotate: '0' });
        if (dir) { mm.setAttribute('keyPoints', '1;0'); mm.setAttribute('keyTimes', '0;1'); }
        mm.appendChild(svgEl('mpath', { href: '#lf-bus-l' + i }));
        pkt.appendChild(mm);
        svg.appendChild(pkt);
      }
    }
    svg.appendChild(txt(W / 2, H - 14, 'one shared spine, typed lanes  ·  each protocol carries its own message kind', '10', MUTE));
    shell(host, 'MESSAGE BUS', 'packets on a shared spine', svg,
      'Agents stop passing raw strings and speak typed protocols over a shared bus. MCP carries tool calls, A2A carries delegated tasks (and replies), ANP carries identity. Separating the lanes is what makes a multi-agent system auditable and lets agents built by different teams interoperate.');
  }

  // ── swarm-roles: agents take distinct shapes/roles and an artifact passes
  //    through plan → execute → critique → verify, looping back on reject ──────
  function roles(host) {
    var W = 520, H = 250, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var R = [
      { x: 70, l: 'PLAN', shape: 'rect' },
      { x: 200, l: 'EXEC', shape: 'circle' },
      { x: 330, l: 'CRITIC', shape: 'diamond' },
      { x: 450, l: 'VERIFY', shape: 'hex' }
    ];
    var y = 110, i;
    // connecting spine
    var spine = 'M' + R[0].x + ' ' + y;
    for (i = 1; i < R.length; i++) spine += ' L' + R[i].x + ' ' + y;
    svg.appendChild(svgEl('path', { id: 'lf-rl-spine', d: spine, fill: 'none', stroke: SOFT, 'stroke-width': '1.4' }));
    // reject loop critic -> plan
    svg.appendChild(svgEl('path', { d: 'M330 ' + (y + 24) + ' Q200 ' + (y + 90) + ' 70 ' + (y + 24), fill: 'none', stroke: WARN, 'stroke-width': '1.3', 'stroke-dasharray': '5 4' }));
    svg.appendChild(txt(200, y + 86, 'reject → re-plan', '10', WARN));
    function drawRole(r, idx) {
      var on = (idx === 1);
      if (r.shape === 'rect') svg.appendChild(svgEl('rect', { x: r.x - 26, y: y - 20, width: 52, height: 40, rx: '4', fill: SURF, stroke: BP, 'stroke-width': '1.8' }));
      else if (r.shape === 'circle') svg.appendChild(svgEl('circle', { cx: r.x, cy: y, r: '23', fill: SURF, stroke: BP, 'stroke-width': '1.8' }));
      else if (r.shape === 'diamond') svg.appendChild(svgEl('polygon', { points: r.x + ',' + (y - 26) + ' ' + (r.x + 26) + ',' + y + ' ' + r.x + ',' + (y + 26) + ' ' + (r.x - 26) + ',' + y, fill: SURF, stroke: WARN, 'stroke-width': '1.8' }));
      else svg.appendChild(svgEl('polygon', { points: (r.x - 14) + ',' + (y - 22) + ' ' + (r.x + 14) + ',' + (y - 22) + ' ' + (r.x + 26) + ',' + y + ' ' + (r.x + 14) + ',' + (y + 22) + ' ' + (r.x - 14) + ',' + (y + 22) + ' ' + (r.x - 26) + ',' + y, fill: SURF, stroke: BP, 'stroke-width': '1.8' }));
      svg.appendChild(txt(r.x, y + 4, r.l, '9', BP));
    }
    R.forEach(drawRole);
    // artifact token travels along the spine, pulsing as it lands on each role
    var art = svgEl('circle', { r: '6', fill: BP });
    var am = svgEl('animateMotion', { dur: '6s', repeatCount: 'indefinite', keyPoints: '0;0.33;0.66;1;1', keyTimes: '0;0.3;0.6;0.85;1', calcMode: 'linear' });
    am.appendChild(svgEl('mpath', { href: '#lf-rl-spine' }));
    art.appendChild(am);
    art.appendChild(anim('r', '6;9;6', 1.2, {}));
    svg.appendChild(art);
    svg.appendChild(txt(W / 2, 40, 'the artifact flows through distinct roles', '11', MUTE));
    svg.appendChild(txt(W / 2, H - 14, 'planner (□) · executor (○) · critic (◇, subjective) · verifier (⬡, deterministic)', '10', MUTE));
    shell(host, 'ROLE SPECIALIZATION', 'one artifact, four roles', svg,
      'More agents do not help; different agents do. The plan, the artifact, a subjective critique, and a deterministic check are separate roles with separate tools. The verifier is load-bearing: MAST traces nearly every multi-agent failure to missing or broken verification. A reject sends the artifact back to re-plan.');
  }

  // ── swarm-blackboard: writers post to a central board, readers subscribe;
  //    one poisoned fact spreads outward to readers (gossip ripple) ────────────
  function blackboard(host) {
    var W = 520, H = 260, CX = 260, CY = 130, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    // central board
    svg.appendChild(svgEl('rect', { x: CX - 70, y: CY - 38, width: 140, height: 76, rx: '6', fill: SURF, stroke: BP, 'stroke-width': '2' }));
    svg.appendChild(txt(CX, CY - 14, 'BLACKBOARD', '10', BP));
    // a fact entry that turns from blue (verified) to gold (poisoned) and back
    var fact = svgEl('rect', { x: CX - 54, y: CY, width: 108, height: 16, rx: '3', fill: BP });
    fact.appendChild(anim('fill', BP + ';' + BP + ';' + WARN + ';' + WARN + ';' + BP, 8, { keyTimes: '0;0.25;0.35;0.8;1' }));
    svg.appendChild(fact);
    var agents = [
      { x: 70, y: 50, w: 1 }, { x: 70, y: 210, w: 1 },
      { x: 160, y: 30, w: 0 }, { x: 360, y: 30, w: 0 },
      { x: 450, y: 50, w: 0 }, { x: 450, y: 210, w: 0 }, { x: 160, y: 230, w: 0 }
    ];
    var i, poisonReader = 4;
    for (i = 0; i < agents.length; i++) {
      var a = agents[i];
      var isW = a.w === 1;
      // edge between agent and board
      var ex = CX + (a.x < CX ? -70 : 70), ey = CY;
      svg.appendChild(svgEl('path', { id: 'lf-bb-e' + i, d: 'M' + a.x + ' ' + a.y + ' L' + ex + ' ' + ey, fill: 'none', stroke: SOFT, 'stroke-width': '1.2' }));
      svg.appendChild(svgEl('circle', { cx: a.x, cy: a.y, r: '14', fill: SURF, stroke: isW ? WARN : BP, 'stroke-width': '1.8' }));
      svg.appendChild(txt(a.x, a.y + 4, isW ? 'W' : 'R', '10', isW ? WARN : BP));
      // packet: writers push to board; readers pull from board
      var pkt = svgEl('circle', { r: '4', fill: isW ? WARN : BP });
      var rev = !isW; // readers travel board -> agent
      var mm = svgEl('animateMotion', { dur: (isW ? 4 : 4.5) + 's', repeatCount: 'indefinite', begin: (i * 0.4).toFixed(2) + 's' });
      if (rev) { mm.setAttribute('keyPoints', '1;0'); mm.setAttribute('keyTimes', '0;1'); }
      mm.appendChild(svgEl('mpath', { href: '#lf-bb-e' + i }));
      pkt.appendChild(mm);
      // the poisoned reader's packet flashes gold to show adoption
      if (i === poisonReader) pkt.appendChild(anim('fill', BP + ';' + WARN + ';' + WARN + ';' + BP, 4.5, { keyTimes: '0;0.4;0.7;1' }));
      svg.appendChild(pkt);
    }
    svg.appendChild(txt(W / 2, H - 12, 'W writes, R reads  ·  a poisoned fact (gold) propagates to every reader', '10', MUTE));
    shell(host, 'BLACKBOARD', 'shared state, shared risk', svg,
      'Agents share facts through a central board instead of copying messages. The danger is memory poisoning: one agent writes a hallucination, every reader downstream adopts it as verified, and accuracy decays silently. Provenance, an unwritable verifier, and per-agent views are the mitigations that hold.');
  }

  // ── swarm-speaker: a selector token hops between chat agents around a pool,
  //    settling on the next speaker (leader-election style) ───────────────────
  function speaker(host) {
    var W = 520, H = 260, CX = 260, CY = 135, R = 88, N = 5, svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var px = [], py = [], i;
    for (i = 0; i < N; i++) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / N;
      px.push(CX + R * Math.cos(ang)); py.push(CY + R * Math.sin(ang));
    }
    // central shared pool
    svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: '30', fill: SURF, stroke: SOFT, 'stroke-width': '1.4' }));
    svg.appendChild(txt(CX, CY - 2, 'shared', '9', MUTE));
    svg.appendChild(txt(CX, CY + 10, 'pool', '9', MUTE));
    // spokes from pool to each agent
    for (i = 0; i < N; i++) {
      svg.appendChild(svgEl('line', { x1: CX, y1: CY, x2: px[i], y2: py[i], stroke: SOFT, 'stroke-width': '1' }));
    }
    var period = 7.5, settle = N; // hop through all, then settle on one
    for (i = 0; i < N; i++) {
      var on = svgEl('circle', { cx: px[i], cy: py[i], r: '17', fill: SURF, stroke: BP, 'stroke-width': '2' });
      // each agent lights up in turn as the token visits, last one (index 2) holds
      var lit = (i === 2);
      var k0 = (i / N).toFixed(3), k1 = ((i + 0.5) / N).toFixed(3);
      var vals = lit
        ? SURF + ';' + SURF + ';' + BP + ';' + BP
        : SURF + ';' + SURF + ';' + BP + ';' + SURF + ';' + SURF;
      var kt = lit ? ('0;' + k0 + ';' + k1 + ';1') : ('0;' + k0 + ';' + k1 + ';' + ((i + 1) / N).toFixed(3) + ';1');
      on.appendChild(svgEl('animate', { attributeName: 'fill', values: vals, keyTimes: kt, dur: period + 's', repeatCount: 'indefinite' }));
      svg.appendChild(on);
      svg.appendChild(txt(px[i], py[i] + 4, String.fromCharCode(65 + i), '11', BP));
    }
    // selector token hops between agents then rests on the chosen one (index 2)
    var order = [0, 1, 2, 3, 4, 2], motVals = '', j;
    for (j = 0; j < order.length; j++) {
      motVals += px[order[j]] + ',' + (py[order[j]] - 26) + (j < order.length - 1 ? ';' : '');
    }
    var crownG = svgEl('g', {}, [svgEl('polygon', { points: '-8,4 -8,-4 -3,0 0,-7 3,0 8,-4 8,4', fill: WARN })]);
    crownG.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'translate', values: motVals, dur: period + 's', repeatCount: 'indefinite', calcMode: 'discrete' }));
    svg.appendChild(crownG);
    svg.appendChild(txt(W / 2, 30, 'selector picks the next speaker', '11', MUTE));
    svg.appendChild(txt(W / 2, H - 12, 'the token hops A→B→C→D→E and settles on the chosen speaker', '10', MUTE));
    shell(host, 'SPEAKER SELECTION', 'who talks next', svg,
      'Agents react to one shared pool instead of a fixed graph. A selector — round-robin, an LLM, or a custom rule — picks who speaks next, so the token hops between candidates and settles on one. This avoids the edge explosion of hardcoding every possible handoff between N agents.');
  }

  LF.register({
    'swarm-consensus-wave': consensusWave,
    'swarm-auction': auction,
    'swarm-stigmergy': stigmergy,
    'swarm-hierarchy-token': hierarchyToken,
    'swarm-message-bus': messageBus,
    'swarm-roles': roles,
    'swarm-blackboard': blackboard,
    'swarm-speaker': speaker
  });
})();
