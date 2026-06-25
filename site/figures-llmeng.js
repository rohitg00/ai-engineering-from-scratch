/* figures-llmeng.js: interactive lesson figures for Phase 11 (LLM engineering)
   and Phase 13 (tools & protocols). Loads after lesson-figures.js and registers
   through window.LF.register. Vanilla ES5, no deps, theme via CSS vars. Authoring
   is the same fenced block:
       ```figure
       few-shot-curve
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, slider = LF.slider, clamp = LF.clamp;

  // ── few-shot-curve: accuracy vs number of in-context examples k ─────────────
  function fewShotCurve(host) {
    var state = { k: 4 };
    var W = 520, H = 220, PAD = 32, KMAX = 16;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var A0 = 0.42, AMAX = 0.92;
    function acc(k) { return A0 + (AMAX - A0) * (1 - Math.exp(-k / 3.5)); }
    function px(k) { return PAD + k / KMAX * (W - 2 * PAD); }
    function py(a) { return H - PAD - (a - 0.3) / 0.7 * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('line', { x1: PAD, y1: py(AMAX), x2: W - PAD, y2: py(AMAX), stroke: 'var(--rule-soft,#ddd)', 'stroke-width': '1', 'stroke-dasharray': '3 3' }));
      var d = '', i;
      for (i = 0; i <= 120; i++) { var k = KMAX * i / 120; d += (i ? 'L' : 'M') + px(k).toFixed(1) + ' ' + py(acc(k)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('circle', { cx: px(0), cy: py(acc(0)), r: '3.5', fill: 'var(--ink-mute,#777)' }));
      svg.appendChild(svgEl('circle', { cx: px(state.k), cy: py(acc(state.k)), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      var a = acc(state.k), gap = a - acc(0);
      num.innerHTML = (a * 100).toFixed(1) + ' <small>% accuracy</small>';
      meta.textContent = (state.k === 0 ? 'zero-shot baseline' : state.k + '-shot') + '  ·  +' + (gap * 100).toFixed(1) + ' pts over zero-shot  ·  ' + (state.k >= 8 ? 'plateau: more examples barely help' : 'still climbing');
      formula.textContent = 'accuracy(k) = ' + (A0 * 100).toFixed(0) + '% + (' + ((AMAX - A0) * 100).toFixed(0) + ' pts)(1 − e^(−k/3.5))  ·  diminishing returns';
    };
    var grid = el('div', {}, [slider(state, 'k', 'in-context examples k', 0, KMAX, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['FEW-SHOT CURVE']), el('span', {}, ['drag the example count'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Adding labeled examples to the prompt lifts accuracy fast at first, then flattens. The grey dot is zero-shot; the first few demonstrations close most of the gap, and beyond a handful each new example earns almost nothing while still costing tokens. The skill is picking the smallest set that reaches the plateau.'])
    ]));
    state._render();
  }

  // ── cot-decomposition: a hard problem split into reasoning steps, CoT lift ──
  function cotDecomposition(host) {
    var state = { cot: 'on' };
    var W = 520, H = 220, PAD = 18;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    var STEPS = ['read', 'find rate', 'multiply', 'add tax', 'answer'];
    function box(x, y, w, h, label, fill, tcol) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, rx: '4', fill: fill, stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.2' }));
      var t = svgEl('text', { x: (x + w / 2).toFixed(1), y: (y + h / 2 + 4).toFixed(1), 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '11', fill: tcol });
      t.appendChild(document.createTextNode(label));
      g.appendChild(t);
      return g;
    }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var on = state.cot === 'on';
      var qY = 24, aY = H - 56, bh = 34;
      svg.appendChild(box(PAD, qY, 150, bh, 'question', 'var(--bg,#fafaf5)', 'var(--ink,#1a1a1a)'));
      svg.appendChild(box(W - PAD - 150, aY, 150, bh, 'answer', 'var(--blueprint,#3553ff)', 'var(--bg,#fafaf5)'));
      if (on) {
        var n = STEPS.length, midY = (qY + aY) / 2, bw = (W - 2 * PAD) / n - 8, sh = 28;
        var i, prevX = PAD + 75, prevY = qY + bh;
        for (i = 0; i < n; i++) {
          var x = PAD + i * ((W - 2 * PAD) / n) + 4, cx = x + bw / 2;
          svg.appendChild(svgEl('line', { x1: prevX, y1: prevY, x2: cx, y2: midY, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', opacity: '0.6' }));
          svg.appendChild(box(x, midY - sh / 2, bw, sh, String(i + 1), 'var(--bg-surface,#eee)', 'var(--ink,#1a1a1a)'));
          prevX = cx; prevY = midY + sh / 2;
        }
        svg.appendChild(svgEl('line', { x1: prevX, y1: prevY, x2: W - PAD - 75, y2: aY, stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.4', opacity: '0.6' }));
      } else {
        svg.appendChild(svgEl('line', { x1: PAD + 75, y1: qY + bh, x2: W - PAD - 75, y2: aY, stroke: 'var(--rule-soft,#ccc)', 'stroke-width': '1.4', 'stroke-dasharray': '4 3' }));
        var qm = svgEl('text', { x: (W / 2).toFixed(1), y: ((qY + aY) / 2 + 4).toFixed(1), 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '13', fill: 'var(--ink-mute,#777)' });
        qm.appendChild(document.createTextNode('(no shown work)'));
        svg.appendChild(qm);
      }
      var accDirect = 0.38, accCoT = 0.71;
      var a = on ? accCoT : accDirect;
      num.innerHTML = (a * 100).toFixed(0) + ' <small>% solved</small>';
      meta.textContent = on ? 'chain-of-thought: 5 intermediate steps make each substep checkable  ·  +' + ((accCoT - accDirect) * 100).toFixed(0) + ' pts' : 'direct answer: the model must do every step at once, in one jump';
      formula.textContent = on ? 'prompt += "let us reason step by step" → expose intermediate states' : 'answer = f(question) in a single forward pass';
    };
    var grid = el('div', {}, [LF.select(state, 'cot', 'reasoning', [['chain-of-thought on', 'on'], ['direct answer (off)', 'off']])]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CHAIN OF THOUGHT']), el('span', {}, ['toggle showing the work'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A hard problem asked for a direct answer forces the model to compress every step into one jump, and it often slips. Chain-of-thought asks it to write the intermediate steps, turning one large leap into a chain of small, individually easy ones. Each visible substep is also a place the model can catch its own mistake.'])
    ]));
    state._render();
  }

  // ── constrained-decoding: a grammar mask greys out schema-invalid tokens ────
  function constrainedDecoding(host) {
    var state = { step: 1 };
    var rows = el('div', {});
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // candidate next tokens at each grammar state; valid = allowed by JSON schema
    var STATES = [
      { ctx: '', valid: ['{'], cands: ['{', 'hello', '42', '[', 'true'] },
      { ctx: '{', valid: ['"'], cands: ['"', '{', '42', 'name', ':'] },
      { ctx: '{ "', valid: ['name', 'age'], cands: ['name', 'age', '}', '123', ','] },
      { ctx: '{ "name"', valid: [':'], cands: [':', '"', '}', 'foo', '42'] },
      { ctx: '{ "name":', valid: ['"'], cands: ['"', '{', 'true', '42', ']'] }
    ];
    state._render = function () {
      var st = STATES[state.step];
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var allowed = 0;
      st.cands.forEach(function (tok) {
        var ok = st.valid.indexOf(tok) >= 0;
        if (ok) allowed++;
        var bar = el('i'); bar.style.width = ok ? '100%' : '12%';
        if (!ok) bar.style.background = 'var(--rule-soft,#ccc)';
        var lab = el('label', {}, ['"' + tok + '"', el('b', {}, [ok ? 'allowed' : 'masked'])]);
        if (!ok) lab.style.opacity = '0.4';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [lab, el('div', { class: 'lf-bar' }, [bar])]));
      });
      num.innerHTML = allowed + ' <small>of ' + st.cands.length + ' tokens valid</small>';
      meta.textContent = 'so far: ' + (st.ctx || '(empty)') + '  ·  the grammar only permits tokens that keep the output schema-valid';
      formula.textContent = 'logits[invalid] = −∞ before softmax → the model can only sample a token the schema allows next';
    };
    var grid = el('div', {}, [slider(state, 'step', 'decoding position', 0, STATES.length - 1, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['CONSTRAINED DECODING']), el('span', {}, ['drag through the JSON'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['Structured output enforces a grammar at decode time. At each position the schema computes which next tokens are legal, and every other token has its logit driven to negative infinity before sampling. The model still chooses, but only from the allowed set, so the result is always parseable JSON rather than free text that happens to look like JSON.'])
    ]));
    state._render();
  }

  // ── prompt-cache-hit: shared-prefix length and hit rate cut latency and cost ─
  function promptCacheHit(host) {
    var state = { prefix: 70, hit: 80 };
    var W = 520, H = 120, PAD = 20;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var bar = el('i');
    var barWrap = el('div', { class: 'lf-bar' }, [bar]);
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    state._render = function () {
      var pf = state.prefix / 100, hr = state.hit / 100;
      var saved = hr * pf;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var inX = PAD, inW = W - 2 * PAD, y = 40, h = 40;
      var pw = inW * pf;
      svg.appendChild(svgEl('rect', { x: inX, y: y, width: pw.toFixed(1), height: h, rx: '3', fill: 'var(--bg-surface,#eee)', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '1.2', 'stroke-dasharray': '4 3' }));
      svg.appendChild(svgEl('rect', { x: (inX + pw).toFixed(1), y: y, width: (inW - pw).toFixed(1), height: h, rx: '3', fill: 'var(--blueprint,#3553ff)', opacity: '0.85' }));
      var t1 = svgEl('text', { x: (inX + pw / 2).toFixed(1), y: (y + h + 16).toFixed(1), 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink-mute,#777)' });
      t1.appendChild(document.createTextNode('cached prefix ' + state.prefix + '%'));
      svg.appendChild(t1);
      var t2 = svgEl('text', { x: (inX + pw + (inW - pw) / 2).toFixed(1), y: (y + h + 16).toFixed(1), 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink-soft,#555)' });
      t2.appendChild(document.createTextNode('new ' + (100 - state.prefix) + '%'));
      svg.appendChild(t2);
      num.innerHTML = (saved * 100).toFixed(1) + ' <small>% prefill saved</small>';
      bar.style.width = (saved * 100).toFixed(1) + '%';
      barWrap.classList.toggle('over', saved > 0.6);
      meta.textContent = 'hit rate ' + state.hit + '%  ·  cached prefix skips recompute  ·  cost and time-to-first-token both drop by ~' + (saved * 100).toFixed(0) + '%';
      formula.textContent = 'saved = hit_rate × prefix_fraction = ' + hr.toFixed(2) + ' × ' + pf.toFixed(2) + ' = ' + saved.toFixed(2);
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'prefix', 'shared prefix (% of prompt)', 0, 100, 1),
      slider(state, 'hit', 'cache hit rate (%)', 0, 100, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['PROMPT CACHE HIT']), el('span', {}, ['drag prefix and hit rate'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, barWrap, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A long system prompt or document that repeats across calls can be prefilled once and reused. The cached prefix (dashed) skips recomputation, so only the new suffix (solid) is processed. The saving is the hit rate times the prefix fraction: a big shared prefix that is hit often is where caching pays off most.'])
    ]));
    state._render();
  }

  // ── semantic-cache: similarity threshold trades hit rate against safety ──────
  function semanticCache(host) {
    var state = { thr: 0.85 };
    var W = 520, H = 200, PAD = 26;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // deterministic incoming queries: cosine similarity to nearest cached entry,
    // and whether the cached answer is actually correct for that query
    var Q = [
      { sim: 0.97, ok: true }, { sim: 0.93, ok: true }, { sim: 0.90, ok: true },
      { sim: 0.88, ok: true }, { sim: 0.84, ok: false }, { sim: 0.80, ok: true },
      { sim: 0.76, ok: false }, { sim: 0.71, ok: false }, { sim: 0.62, ok: true },
      { sim: 0.50, ok: false }
    ];
    function px(s) { return PAD + (s - 0.4) / 0.6 * (W - 2 * PAD); }
    state._render = function () {
      var thr = state.thr;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var tx = px(thr);
      svg.appendChild(svgEl('rect', { x: tx.toFixed(1), y: PAD, width: (W - PAD - tx).toFixed(1), height: (H - 2 * PAD).toFixed(1), fill: 'var(--blueprint,#3553ff)', opacity: '0.06' }));
      svg.appendChild(svgEl('line', { x1: tx, y1: PAD - 4, x2: tx, y2: H - PAD, stroke: 'var(--warn,#b8870f)', 'stroke-width': '1.5' }));
      var hits = 0, wrong = 0;
      Q.forEach(function (q, i) {
        var hit = q.sim >= thr;
        if (hit) { hits++; if (!q.ok) wrong++; }
        var cy = PAD + (i + 0.5) / Q.length * (H - 2 * PAD);
        var col = !hit ? 'var(--rule-soft,#ccc)' : (q.ok ? 'var(--blueprint,#3553ff)' : 'var(--warn,#b8870f)');
        svg.appendChild(svgEl('circle', { cx: px(q.sim), cy: cy.toFixed(1), r: hit ? '5' : '3.5', fill: col }));
      });
      num.innerHTML = hits + ' <small>of ' + Q.length + ' served from cache</small>';
      meta.textContent = 'threshold ' + thr.toFixed(2) + '  ·  ' + wrong + ' of those hits return a wrong answer  ·  ' + (thr >= 0.9 ? 'high: few hits, safe' : thr <= 0.7 ? 'low: many hits, risky' : 'balanced');
      formula.textContent = 'serve cached answer when cos(query, cached) ≥ ' + thr.toFixed(2) + '  ·  lower threshold = more hits, more risk';
    };
    var grid = el('div', {}, [slider(state, 'thr', 'similarity threshold', 0.5, 0.99, 0.01)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SEMANTIC CACHE']), el('span', {}, ['drag the threshold'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['A semantic cache answers a new query from a stored answer when their embeddings are close enough. Each dot is an incoming query placed by its cosine similarity to the nearest cached entry; the shaded zone past the orange line is served from cache. Raise the threshold and you get fewer hits but rarely serve a wrong answer; lower it and you cache more but risk returning a stale or mismatched reply (orange dots).'])
    ]));
    state._render();
  }

  // ── function-call-args: model picks a tool then fills typed JSON slots ───────
  function functionCallArgs(host) {
    var state = { step: 2 };
    var W = 520, H = 200, PAD = 18;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var code = el('div', { class: 'lf-formula' });
    var meta = el('div', { class: 'lf-meta' });
    // schema slots filled progressively from the user request
    var SLOTS = [
      { name: 'tool', type: 'enum', val: 'book_flight' },
      { name: 'from', type: 'string', val: '"BOM"' },
      { name: 'to', type: 'string', val: '"SFO"' },
      { name: 'date', type: 'date', val: '"2026-07-01"' },
      { name: 'pax', type: 'int', val: '2' }
    ];
    var REQUEST = 'book 2 seats Mumbai to San Francisco on Jul 1';
    function box(x, y, w, h, label, active) {
      var g = svgEl('g', {});
      g.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, rx: '3', fill: active ? 'var(--blueprint,#3553ff)' : 'var(--bg-surface,#eee)', stroke: 'var(--ink-soft,#555)', 'stroke-width': '1.1' }));
      var t = svgEl('text', { x: (x + 8).toFixed(1), y: (y + h / 2 + 4).toFixed(1), 'font-family': 'monospace', 'font-size': '10.5', fill: active ? 'var(--bg,#fafaf5)' : 'var(--ink,#1a1a1a)' });
      t.appendChild(document.createTextNode(label));
      g.appendChild(t);
      return g;
    }
    state._render = function () {
      var s = state.step;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var rq = svgEl('text', { x: PAD, y: 22, 'font-family': 'monospace', 'font-size': '10.5', fill: 'var(--ink-soft,#555)' });
      rq.appendChild(document.createTextNode('request: ' + REQUEST));
      svg.appendChild(rq);
      var y0 = 36, rh = 28, w = W - 2 * PAD;
      SLOTS.forEach(function (slot, i) {
        var filled = i <= s;
        var y = y0 + i * (rh + 2);
        var label = slot.name + ' : ' + slot.type + (filled ? '  =  ' + slot.val : '  =  ?');
        svg.appendChild(box(PAD, y, w, rh, label, filled));
      });
      code.textContent = '{ ' + SLOTS.slice(0, s + 1).map(function (sl) { return '"' + sl.name + '": ' + sl.val; }).join(', ') + (s < SLOTS.length - 1 ? ', ... ' : ' ') + '}';
      meta.textContent = (s + 1) + ' of ' + SLOTS.length + ' slots filled  ·  the model selects the tool, then extracts each typed argument from the request';
    };
    var grid = el('div', {}, [slider(state, 'step', 'arguments filled', 0, SLOTS.length - 1, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['FUNCTION CALL ARGS']), el('span', {}, ['drag to fill the schema'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, code, meta])]),
      el('div', { class: 'lf-cap' }, ['Function calling is two jobs in one. First the model selects which tool to invoke from the available set, then it populates that tool\'s typed argument schema by extracting values from the user request. The output is not prose but a structured call: a tool name plus a JSON object whose fields match the declared types, ready to execute.'])
    ]));
    state._render();
  }

  // ── llm-judge-rubric: weighted rubric score, LLM-as-judge aggregation ───────
  function llmJudgeRubric(host) {
    var state = { wHelp: 40, wCorr: 40, wSafe: 20 };
    var rows = el('div', {});
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // judge's per-criterion scores for one response, on a 0..1 scale
    var CRIT = [
      { key: 'wHelp', label: 'helpfulness', score: 0.85 },
      { key: 'wCorr', label: 'correctness', score: 0.60 },
      { key: 'wSafe', label: 'safety', score: 0.95 }
    ];
    state._render = function () {
      var wsum = state.wHelp + state.wCorr + state.wSafe;
      if (wsum <= 0) wsum = 1;
      while (rows.firstChild) rows.removeChild(rows.firstChild);
      var total = 0;
      CRIT.forEach(function (c) {
        var w = state[c.key] / wsum;
        total += w * c.score;
        var bar = el('i'); bar.style.width = (c.score * 100).toFixed(0) + '%';
        rows.appendChild(el('div', { class: 'lf-ctrl' }, [
          el('label', {}, [c.label + ' (w ' + (w * 100).toFixed(0) + '%)', el('b', {}, [c.score.toFixed(2)])]),
          el('div', { class: 'lf-bar' }, [bar])
        ]));
      });
      num.innerHTML = total.toFixed(3) + ' <small>weighted score</small>';
      meta.textContent = 'weights normalized to sum 1  ·  shift weight onto correctness and this response drops, since it scored lowest there';
      formula.textContent = 'score = Σ (wᵢ / Σw) · sᵢ  ·  s = [0.85, 0.60, 0.95]  ·  the judge rates each criterion, the rubric aggregates';
    };
    var grid = el('div', { class: 'lf-grid' }, [
      slider(state, 'wHelp', 'helpfulness weight', 0, 100, 1),
      slider(state, 'wCorr', 'correctness weight', 0, 100, 1),
      slider(state, 'wSafe', 'safety weight', 0, 100, 1)
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LLM-AS-JUDGE RUBRIC']), el('span', {}, ['drag the rubric weights'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [rows, num, meta, formula])]),
      el('div', { class: 'lf-cap' }, ['An LLM judge rates a response on several criteria, here helpfulness, correctness, and safety. The final score is a weighted average, and the weights encode what you actually care about. This response is strong on safety but weak on correctness, so leaning the rubric toward correctness pulls its score down. The weights, not the model, decide what good means.'])
    ]));
    state._render();
  }

  // ── lost-in-the-middle: retrieval accuracy is U-shaped over fact position ────
  function lostInTheMiddle(host) {
    var state = { pos: 50 };
    var W = 520, H = 220, PAD = 32;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });
    // U-shape: high at the ends (recency + primacy), dips in the middle
    function acc(p) { var x = p / 100; var u = 0.40 + 0.55 * Math.pow(2 * x - 1, 2); return clamp(u, 0, 1); }
    function px(p) { return PAD + p / 100 * (W - 2 * PAD); }
    function py(a) { return H - PAD - (a - 0.3) / 0.7 * (H - 2 * PAD); }
    state._render = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var d = '', i;
      for (i = 0; i <= 120; i++) { var p = 100 * i / 120; d += (i ? 'L' : 'M') + px(p).toFixed(1) + ' ' + py(acc(p)).toFixed(1) + ' '; }
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--blueprint,#3553ff)', 'stroke-width': '2' }));
      var s = svgEl('text', { x: PAD, y: H - 8, 'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink-mute,#777)' });
      s.appendChild(document.createTextNode('start of context'));
      svg.appendChild(s);
      var e = svgEl('text', { x: (W - PAD).toFixed(1), y: H - 8, 'text-anchor': 'end', 'font-family': 'monospace', 'font-size': '10', fill: 'var(--ink-mute,#777)' });
      e.appendChild(document.createTextNode('end of context'));
      svg.appendChild(e);
      svg.appendChild(svgEl('circle', { cx: px(state.pos), cy: py(acc(state.pos)), r: '5', fill: 'var(--blueprint,#3553ff)' }));
      var a = acc(state.pos);
      num.innerHTML = (a * 100).toFixed(0) + ' <small>% retrieval accuracy</small>';
      meta.textContent = 'fact at ' + state.pos + '% of context  ·  ' + (state.pos < 20 || state.pos > 80 ? 'near an edge: easy to recall' : 'buried in the middle: easy to miss');
      formula.textContent = 'accuracy(pos) ≈ 0.40 + 0.55·(2·pos − 1)²  ·  U-shaped: primacy + recency, dip in the middle';
    };
    var grid = el('div', {}, [slider(state, 'pos', 'key fact position (% of context)', 0, 100, 1)]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LOST IN THE MIDDLE']), el('span', {}, ['drag the fact position'])]),
      el('div', { class: 'lf-body' }, [grid, el('div', { class: 'lf-out' }, [svg, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, ['When a single relevant fact is buried in a long context, the model recalls it well if it sits near the start or the end, and far worse if it lands in the middle. Accuracy is U-shaped over position. This is why context engineering puts the most important material at the top or bottom of the prompt and never relies on a long unstructured dump.'])
    ]));
    state._render();
  }

  LF.register({
    'few-shot-curve': fewShotCurve,
    'cot-decomposition': cotDecomposition,
    'constrained-decoding': constrainedDecoding,
    'prompt-cache-hit': promptCacheHit,
    'semantic-cache': semanticCache,
    'function-call-args': functionCallArgs,
    'llm-judge-rubric': llmJudgeRubric,
    'lost-in-the-middle': lostInTheMiddle
  });
})();
