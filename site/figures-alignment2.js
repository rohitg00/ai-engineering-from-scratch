/* figures-alignment2.js — interactive lesson figures for Phase 18 (ethics,
   safety, alignment) and Phase 9 (reinforcement learning). Loads after
   lesson-figures.js and registers through window.LF. No deps, ES5 only,
   theme via CSS vars. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, select = LF.select;
  var clamp = LF.clamp, fmtInt = LF.fmtInt;

  function frame(host, label, hint, grid, outKids, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, outKids)]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }

  // ── ppo-clip: the clipped surrogate flattens updates outside [1-eps, 1+eps] ─
  function ppoClip(host) {
    var W = 520, H = 230, PAD = 34;
    var state = { adv: 1, eps: 0.2 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var RMIN = 0, RMAX = 2;
    function clipped(r, A, eps) {
      var lo = 1 - eps, hi = 1 + eps;
      var rc = r < lo ? lo : r > hi ? hi : r;
      return A >= 0 ? Math.min(r * A, rc * A) : Math.max(r * A, rc * A);
    }
    function px(r) { return PAD + (r - RMIN) / (RMAX - RMIN) * (W - 2 * PAD); }
    function py(v, span) { return H / 2 - v / span * (H / 2 - PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var A = state.adv, eps = state.eps, span = Math.max(0.6, Math.abs(A) * (1 + eps));
      svg.appendChild(svgEl('line', { x1: PAD, y1: H / 2, x2: W - PAD, y2: H / 2, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var rx = px(1);
      svg.appendChild(svgEl('line', { x1: rx, y1: PAD, x2: rx, y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var lx = px(1 - eps), hx = px(1 + eps);
      svg.appendChild(svgEl('line', { x1: lx, y1: PAD, x2: lx, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '4 3' }));
      svg.appendChild(svgEl('line', { x1: hx, y1: PAD, x2: hx, y2: H - PAD, stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '4 3' }));
      var i, r, du = '', dc = '';
      for (i = 0; i <= 120; i++) { r = RMIN + (RMAX - RMIN) * i / 120; du += (i ? 'L' : 'M') + px(r).toFixed(1) + ' ' + py(r * A, span).toFixed(1) + ' '; }
      for (i = 0; i <= 120; i++) { r = RMIN + (RMAX - RMIN) * i / 120; dc += (i ? 'L' : 'M') + px(r).toFixed(1) + ' ' + py(clipped(r, A, eps), span).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: du, fill: 'none', stroke: 'var(--ink-mute,#999)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }));
      svg.appendChild(svgEl('path', { d: dc, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2.2' }));
      var rNow = 1 + eps + (A >= 0 ? 0.35 : -0.35);
      rNow = rNow < RMIN ? RMIN : rNow > RMAX ? RMAX : rNow;
      svg.appendChild(svgEl('circle', { cx: px(rNow), cy: py(clipped(rNow, A, eps), span), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      var sign = A >= 0 ? 'positive' : 'negative';
      status.innerHTML = 'advantage ' + sign;
      meta.textContent = 'clip range [' + (1 - eps).toFixed(2) + ', ' + (1 + eps).toFixed(2) + ']  ·  ' + (A >= 0 ? 'reward good action but stop once r > 1+eps' : 'penalize bad action but stop once r < 1-eps');
      formula.textContent = 'L = min( r·A,  clip(r, 1-eps, 1+eps)·A )   ·   eps = ' + eps.toFixed(2) + ', A = ' + A.toFixed(1);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'adv', 'advantage A', -2, 2, 0.1),
      slider(state, 'eps', 'clip epsilon', 0.05, 0.4, 0.01)
    ]);
    frame(host, 'PPO CLIP', 'drag advantage and epsilon',
      grid, [svg, el('div', { style: 'margin-top:12px' }, [status]), meta, formula],
      'PPO multiplies the advantage by the probability ratio r between the new and old policy. Grey is the raw product r·A; blue is the clipped surrogate. Once the ratio leaves the band 1-eps to 1+eps in the helpful direction, the clip flattens the objective so its gradient vanishes, keeping each update from moving the policy too far from the one that collected the data.');
    state._render();
  }

  // ── reward-model: Bradley-Terry preference, chosen scored above rejected ────
  function rewardModel(host) {
    var state = { gap: 1.2 };
    var W = 520, H = 150, PAD = 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    function px(s) { return PAD + (s + 4) / 8 * (W - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var sChosen = state.gap / 2, sRejected = -state.gap / 2;
      var pPrefer = 1 / (1 + Math.exp(-(sChosen - sRejected)));
      var loss = -Math.log(Math.max(1e-6, pPrefer));
      svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      var rx = px(sRejected), cx = px(sChosen), y = H - PAD;
      svg.appendChild(svgEl('line', { x1: rx, y1: y, x2: rx, y2: PAD, stroke: 'var(--ink-mute,#999)', 'stroke-width': '8' }));
      svg.appendChild(svgEl('text', { x: rx, y: PAD - 6, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--ink-mute,#777)', 'font-family': 'monospace' }, [document.createTextNode('rejected ' + sRejected.toFixed(2))]));
      svg.appendChild(svgEl('line', { x1: cx, y1: y, x2: cx, y2: PAD, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '8' }));
      svg.appendChild(svgEl('text', { x: cx, y: PAD - 6, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--blueprint,#3553ff)', 'font-family': 'monospace' }, [document.createTextNode('chosen ' + sChosen.toFixed(2))]));
      num.innerHTML = (pPrefer * 100).toFixed(1) + ' <small>% P(chosen ≻ rejected)</small>';
      meta.textContent = 'score gap ' + state.gap.toFixed(2) + '  ·  preference loss ' + loss.toFixed(3) + '  ·  ' + (state.gap < 0.4 ? 'unsure: scores nearly tied' : state.gap > 2.5 ? 'confident: chosen clearly above' : 'learning the ranking');
      formula.textContent = 'P(chosen ≻ rejected) = sigmoid( r(chosen) − r(rejected) )   ·   loss = −log P';
    };
    var grid = el('div', {}, [slider(state, 'gap', 'score gap  r(chosen) − r(rejected)', 0, 4, 0.05)]);
    frame(host, 'REWARD MODEL', 'drag the score gap',
      grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'A reward model turns human preferences into a scalar score. For each pair a human marked chosen over rejected, the Bradley-Terry objective trains the model so the chosen response scores higher. The wider the score gap, the higher the modeled probability that a human prefers the chosen answer, and the smaller the preference loss.');
    state._render();
  }

  // ── constitutional-ai: principles flag and revise a harmful response ────────
  function constitutionalAI(host) {
    var principles = [
      { name: 'harmlessness', flags: 'requests for harm', sev: 0.9 },
      { name: 'honesty', flags: 'fabricated claims', sev: 0.5 },
      { name: 'privacy', flags: 'personal data leakage', sev: 0.7 },
      { name: 'non-deception', flags: 'manipulative framing', sev: 0.4 }
    ];
    var state = { which: 0 };
    var rows = el('div', {});
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var which = Number(state.which);
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var p = principles[which];
      principles.forEach(function (pr, i) {
        var on = i === which;
        var bar = el('i'); bar.style.width = (pr.sev * 100).toFixed(0) + '%';
        if (!on) bar.style.background = 'var(--rule-soft,#ccc)';
        var lab = el('label', {}, [pr.name, el('b', {}, [on ? 'TRIGGERED' : 'pass'])]);
        if (!on) lab.style.opacity = '0.5';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' }, [bar])]));
      });
      status.innerHTML = 'revise: ' + p.flags;
      meta.textContent = 'principle "' + p.name + '" flags the draft (severity ' + p.sev.toFixed(2) + ')  ·  model critiques, then rewrites to comply';
      formula.textContent = 'response → critique against principle → revised response   ·   no human label, the constitution is the signal';
    };
    var grid = el('div', {}, [select(state, 'which', 'principle that triggers',
      principles.map(function (pr, i) { return [pr.name, String(i)]; }))]);
    frame(host, 'CONSTITUTIONAL AI', 'pick the principle',
      grid, [rows, el('div', { style: 'margin-top:12px' }, [status]), meta, formula],
      'Constitutional AI replaces a human labeller with a written set of principles. The draft response is passed through each principle; the one you select flags a violation, the model writes a critique of its own answer against that principle, then revises to comply. The revised answers become the training signal, so harmlessness is taught from rules rather than per-example human feedback.');
    state._render();
  }

  // ── actor-critic: advantage A = Q - V from the TD error drives the update ───
  function actorCritic(host) {
    var W = 520, H = 200, PAD = 32;
    var state = { td: 0.6, value: 1.0 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var SPAN = 2.5;
    function py(v) { return H / 2 - v / SPAN * (H / 2 - PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var V = state.value, Q = V + state.td, A = Q - V;
      var baseX = PAD + 40, qX = W - PAD - 40;
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0), x2: W - PAD, y2: py(0), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      // critic baseline V
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(V), x2: W - PAD, y2: py(V), stroke: 'var(--ink-mute,#999)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }));
      svg.appendChild(svgEl('text', { x: PAD + 4, y: py(V) - 6, 'font-size': '10', fill: 'var(--ink-mute,#777)', 'font-family': 'monospace' }, [document.createTextNode('V (critic) = ' + V.toFixed(2))]));
      // realized return Q
      svg.appendChild(svgEl('circle', { cx: qX, cy: py(Q), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      svg.appendChild(svgEl('text', { x: qX, y: py(Q) - 10, 'text-anchor': 'end', 'font-size': '10', fill: 'var(--blueprint,#3553ff)', 'font-family': 'monospace' }, [document.createTextNode('Q = V + delta = ' + Q.toFixed(2))]));
      // advantage bar from V to Q
      var col = A >= 0 ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)';
      svg.appendChild(svgEl('line', { x1: qX, y1: py(V), x2: qX, y2: py(Q), stroke: col, 'stroke-width': '6' }));
      status.innerHTML = 'advantage A = ' + A.toFixed(2);
      meta.textContent = 'TD error delta = ' + state.td.toFixed(2) + '  ·  ' + (A > 0.05 ? 'better than expected: push the actor toward this action' : A < -0.05 ? 'worse than expected: push the actor away' : 'as expected: little update');
      formula.textContent = 'delta = r + gamma·V(s\') − V(s)   ·   A = Q − V = delta   ·   actor update ∝ A · grad log pi';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'td', 'TD error  delta', -2, 2, 0.05),
      slider(state, 'value', 'critic baseline  V', -1.5, 1.5, 0.05)
    ]);
    frame(host, 'ACTOR-CRITIC', 'drag the TD error',
      grid, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula],
      'The critic estimates the value V of a state (grey baseline); the actor proposes the action that produced the return Q (blue dot). The advantage A = Q - V, which equals the one-step TD error, measures whether the action did better or worse than the critic expected. A positive advantage pushes the actor toward that action, a negative one pushes it away, and the critic moves its baseline toward the observed return.');
    state._render();
  }

  // ── interpretability-probe: probe accuracy rising through the layers ────────
  function interpretabilityProbe(host) {
    var W = 520, H = 210, PAD = 36, NL = 24;
    var state = { layer: 12, depth: 0.5 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // probe accuracy: rises with a logistic in layer index; midpoint set by depth
    function acc(layer) {
      var mid = NL * (0.2 + 0.6 * state.depth);
      var a = 0.5 + 0.48 / (1 + Math.exp(-(layer - mid) / 2.2));
      return a;
    }
    function px(l) { return PAD + l / (NL - 1) * (W - 2 * PAD); }
    function py(a) { return H - PAD - (a - 0.5) / 0.5 * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0.5), x2: W - PAD, y2: py(0.5), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('text', { x: PAD - 4, y: py(0.5) + 3, 'text-anchor': 'end', 'font-size': '9', fill: 'var(--ink-mute,#777)', 'font-family': 'monospace' }, [document.createTextNode('chance')]));
      var d = '', l;
      for (l = 0; l < NL; l++) { d += (l ? 'L' : 'M') + px(l).toFixed(1) + ' ' + py(acc(l)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var L = state.layer, a = acc(L);
      svg.appendChild(svgEl('line', { x1: px(L), y1: PAD, x2: px(L), y2: H - PAD, stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(svgEl('circle', { cx: px(L), cy: py(a), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      num.innerHTML = (a * 100).toFixed(1) + ' <small>% probe accuracy</small>';
      meta.textContent = 'layer ' + L + ' of ' + (NL - 1) + '  ·  ' + (a < 0.62 ? 'concept not yet linearly decodable' : a > 0.9 ? 'concept clearly present in this layer' : 'concept emerging');
      formula.textContent = 'train a linear classifier on layer activations  ·  high accuracy ⇒ the concept is linearly readable at that depth';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'layer', 'layer index', 0, NL - 1, 1),
      slider(state, 'depth', 'where the concept forms (early ↔ late)', 0, 1, 0.05)
    ]);
    frame(host, 'INTERPRETABILITY PROBE', 'drag the layer',
      grid, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula],
      'A linear probe is a simple classifier trained to read a concept off a layer\'s activations. Probe accuracy near chance means the concept is not linearly decodable there; high accuracy means it is. Walking the probe deeper into the network shows the concept becoming linearly readable, which is how interpretability researchers locate where a feature like a deceptive intent first appears.');
    state._render();
  }

  // ── sae-features: dense activation decomposed into sparse features ──────────
  function saeFeatures(host) {
    var state = { l1: 1.0 };
    var feats = [0.95, 0.82, 0.74, 0.61, 0.52, 0.44, 0.36, 0.29, 0.21, 0.14, 0.09, 0.05];
    var rows = el('div', {});
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var thr = state.l1 * 0.18; // higher L1 -> higher activation threshold -> fewer survive
      var active = 0, recon = 0, total = 0;
      feats.forEach(function (f) { total += f; });
      feats.forEach(function (f, i) {
        var on = f >= thr;
        var val = on ? f : 0;
        if (on) { active++; recon += f; }
        var bar = el('i'); bar.style.width = (val / 0.95 * 100).toFixed(0) + '%';
        if (!on) bar.style.background = 'var(--rule-soft,#ccc)';
        var lab = el('label', {}, ['f' + (i + 1) + (on ? '' : ' ·'), el('b', {}, [on ? val.toFixed(2) : 'off'])]);
        if (!on) lab.style.opacity = '0.4';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' }, [bar])]));
      });
      var reconPct = recon / total * 100;
      num.innerHTML = active + ' <small>of ' + feats.length + ' features active</small>';
      meta.textContent = 'reconstruction ' + reconPct.toFixed(0) + '% of the dense vector  ·  ' + (state.l1 < 0.5 ? 'low L1: dense, polysemantic features' : state.l1 > 1.8 ? 'high L1: very sparse, may lose signal' : 'sparse and monosemantic');
      formula.textContent = 'minimize  ‖x − decode(f)‖² + lambda·‖f‖₁   ·   lambda = ' + state.l1.toFixed(2) + '   ·   higher lambda ⇒ fewer active features';
    };
    var grid = el('div', {}, [slider(state, 'l1', 'sparsity coefficient  lambda (L1)', 0.1, 2.5, 0.05)]);
    frame(host, 'SPARSE AUTOENCODER', 'drag the L1 coefficient',
      grid, [rows, el('div', { style: 'margin-top:12px' }, [num]), meta, formula],
      'A sparse autoencoder decomposes a dense activation into a much larger set of features, most of which stay off. The L1 penalty on the feature activations sets how sparse the code is. Too little and the features stay dense and polysemantic; too much and a few features carry everything but reconstruction suffers. The sweet spot gives few active, monosemantic features that each stand for one human-readable concept.');
    state._render();
  }

  // ── jailbreak-defense: attack success falls but over-refusal rises ─────────
  function jailbreakDefense(host) {
    var W = 520, H = 210, PAD = 36;
    var state = { strength: 0.5 };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // attack success rate falls with defense; over-refusal on benign prompts rises
    function asr(s) { return 0.85 * Math.exp(-2.6 * s); }
    function refuse(s) { return 0.02 + 0.6 * Math.pow(s, 2.2); }
    function px(s) { return PAD + s * (W - 2 * PAD); }
    function py(v) { return H - PAD - clamp(v, 0, 1) * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      function curve(fn, st) { var d = '', i, s; for (i = 0; i <= 100; i++) { s = i / 100; d += (i ? 'L' : 'M') + px(s).toFixed(1) + ' ' + py(fn(s)).toFixed(1) + ' '; } svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: st, 'stroke-width': '2' })); }
      curve(asr, 'var(--warn,#b8870f)');
      curve(refuse, 'var(--blueprint,#3553ff)');
      var s = state.strength, a = asr(s), r = refuse(s);
      var mx = px(s);
      svg.appendChild(svgEl('line', { x1: mx, y1: PAD, x2: mx, y2: H - PAD, stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(svgEl('circle', { cx: mx, cy: py(a), r: '4.5', fill: 'var(--warn,#b8870f)' }));
      svg.appendChild(svgEl('circle', { cx: mx, cy: py(r), r: '4.5', fill: 'var(--blueprint,#3553ff)' }));
      status.innerHTML = 'attack success ' + (a * 100).toFixed(0) + '%';
      meta.textContent = 'amber: jailbreak success ' + (a * 100).toFixed(0) + '%  ·  blue: over-refusal on benign prompts ' + (r * 100).toFixed(0) + '%  ·  ' + (s < 0.3 ? 'too permissive' : s > 0.8 ? 'too restrictive' : 'balanced');
      formula.textContent = 'stronger filter ⇒ lower attack success, higher false refusals   ·   tune for the knee of both curves';
    };
    var grid = el('div', {}, [slider(state, 'strength', 'defense strength', 0, 1, 0.02)]);
    frame(host, 'JAILBREAK DEFENSE', 'drag the defense strength',
      grid, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula],
      'A safety filter that blocks adversarial prompts also risks refusing harmless ones. As you turn defense strength up, the amber attack-success curve falls but the blue over-refusal curve climbs as benign requests get caught. There is no free lunch: the operating point is chosen at the knee where most jailbreaks are stopped without refusing too many legitimate users.');
    state._render();
  }

  // ── scalable-oversight: weak judge supervising strong agents via debate ─────
  function scalableOversight(host) {
    var W = 520, H = 210, PAD = 36;
    var state = { difficulty: 0.5, mode: 'debate' };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var status = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // unaided weak judge accuracy decays fast with difficulty; oversight protocols decay slower
    function direct(x) { return 0.5 + 0.45 * Math.exp(-3.2 * x); }
    function debate(x) { return 0.5 + 0.45 * Math.exp(-1.3 * x); }
    function recurse(x) { return 0.5 + 0.45 * Math.exp(-1.0 * x); }
    function aided(x) { return state.mode === 'recursion' ? recurse(x) : debate(x); }
    function px(x) { return PAD + x * (W - 2 * PAD); }
    function py(v) { return H - PAD - (v - 0.5) / 0.5 * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(0.5), x2: W - PAD, y2: py(0.5), stroke: 'var(--rule-soft,#eee)', 'stroke-width': '1' }));
      svg.appendChild(svgEl('text', { x: PAD - 4, y: py(0.5) + 3, 'text-anchor': 'end', 'font-size': '9', fill: 'var(--ink-mute,#777)', 'font-family': 'monospace' }, [document.createTextNode('chance')]));
      function curve(fn, st, dash) { var d = '', i, x; for (i = 0; i <= 100; i++) { x = i / 100; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(fn(x)).toFixed(1) + ' '; } var a = { d: d, fill: 'none', stroke: st, 'stroke-width': '2' }; if (dash) a['stroke-dasharray'] = '4 3'; svg.appendChild(svgEl('path', a)); }
      curve(direct, 'var(--ink-mute,#999)', true);
      curve(aided, 'var(--blueprint,#3553ff)', false);
      var x = state.difficulty, vu = direct(x), va = aided(x), mx = px(x);
      svg.appendChild(svgEl('line', { x1: mx, y1: PAD, x2: mx, y2: H - PAD, stroke: 'var(--ink-mute,#999)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      svg.appendChild(svgEl('circle', { cx: mx, cy: py(vu), r: '4', fill: 'var(--ink-mute,#999)' }));
      svg.appendChild(svgEl('circle', { cx: mx, cy: py(va), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      status.innerHTML = 'oversight accuracy ' + (va * 100).toFixed(0) + '%';
      meta.textContent = 'grey: judge alone ' + (vu * 100).toFixed(0) + '%  ·  blue: judge + ' + state.mode + ' ' + (va * 100).toFixed(0) + '%  ·  gain ' + ((va - vu) * 100).toFixed(0) + ' points';
      formula.textContent = state.mode === 'debate'
        ? 'two strong agents argue; the weak judge picks the more defensible answer'
        : 'task split into checkable subtasks; the weak judge verifies each piece';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'difficulty', 'task difficulty', 0, 1, 0.02),
      select(state, 'mode', 'oversight protocol', [['debate', 'debate'], ['recursion', 'recursion']])
    ]);
    frame(host, 'SCALABLE OVERSIGHT', 'drag the task difficulty',
      grid, [svg, el('div', { style: 'margin-top:10px' }, [status]), meta, formula],
      'A weak judge cannot directly check a strong agent on hard tasks: the grey curve falls toward chance as difficulty rises. Oversight protocols help the judge keep up. In debate, two strong agents argue and the judge picks the more defensible side; in recursion, the task is decomposed into pieces the judge can verify. Either way the blue curve decays more slowly, so the judge stays above chance on tasks it could never solve alone.');
    state._render();
  }

  LF.register({
    'ppo-clip': ppoClip,
    'reward-model': rewardModel,
    'constitutional-ai': constitutionalAI,
    'actor-critic': actorCritic,
    'interpretability-probe': interpretabilityProbe,
    'sae-features': saeFeatures,
    'jailbreak-defense': jailbreakDefense,
    'scalable-oversight': scalableOversight
  });
})();
