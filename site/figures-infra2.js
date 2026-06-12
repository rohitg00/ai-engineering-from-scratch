/* figures-infra2.js: animated lesson figures for Phase 17 (Infrastructure and
   Production) — serving, routing, caching, autoscaling. Loads after
   lesson-figures.js and registers through window.LF.register. Vanilla ES5, no
   deps, theme via CSS vars. Animation is SMIL only (animate / animateMotion /
   animateTransform). Authoring is the same fenced block:
       ```figure
       cache-aware-router
       ``` */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl, select = LF.select;

  var BP = 'var(--blueprint,#3553ff)';
  var SOFT = 'var(--rule-soft,#ccc)';
  var MUTE = 'var(--ink-mute,#999)';
  var WARN = 'var(--warn,#b8870f)';
  var INK = 'var(--ink,#1a1a1a)';
  var BG = 'var(--bg,#fafaf5)';

  function shell(host, label, sub, svg, cap) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [sub])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [cap])
    ]));
  }
  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function motion(path, dur, begin) {
    return svgEl('animateMotion', { path: path, dur: dur, begin: begin || '0s', repeatCount: 'indefinite' });
  }
  function box(x, y, w, h, fill, stroke) {
    return svgEl('rect', { x: x, y: y, width: w, height: h, rx: 4, fill: fill || 'none', stroke: stroke || SOFT, 'stroke-width': 1.4 });
  }
  function txt(x, y, s, size, fill, anchor) {
    return svgEl('text', { x: x, y: y, 'font-family': 'var(--font-mono,monospace)', 'font-size': size || 11, fill: fill || MUTE, 'text-anchor': anchor || 'middle' }, [document.createTextNode(s)]);
  }

  // ── cache-aware-router: round-robin scatter vs prefix-hash routing ─────────
  // 11-multi-region-kv-locality
  function cacheAwareRouter(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var src = { x: 60, y: 120 };
    var reps = [{ x: 430, y: 50 }, { x: 430, y: 120 }, { x: 430, y: 190 }];
    svg.appendChild(box(30, 100, 60, 40, BG, INK));
    svg.appendChild(txt(60, 124, 'router', 10, INK));
    reps.forEach(function (r, i) {
      svg.appendChild(box(r.x - 38, r.y - 18, 76, 36, BG, i === 1 ? BP : SOFT));
      svg.appendChild(txt(r.x, r.y - 2, 'replica ' + (i + 1), 9, i === 1 ? BP : MUTE));
      svg.appendChild(txt(r.x, r.y + 11, i === 1 ? 'cache: P' : 'cold', 8, MUTE));
    });
    // hot path to replica 2 (holds prefix P) — dashed active link
    var hot = svgEl('path', { d: 'M90 120 L392 120', fill: 'none', stroke: BP, 'stroke-width': 2, 'stroke-dasharray': '6 5' });
    hot.appendChild(anim('stroke-dashoffset', '22;0', '0.9s'));
    svg.appendChild(hot);
    svg.appendChild(svgEl('path', { d: 'M90 110 L392 60', fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
    svg.appendChild(svgEl('path', { d: 'M90 130 L392 188', fill: 'none', stroke: SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
    // requests carrying prefix P flow in and get routed to the hot replica
    var i;
    for (i = 0; i < 3; i++) {
      var g = svgEl('g', {}, [
        svgEl('circle', { cx: 0, cy: 0, r: 6, fill: BP }),
        txt(0, 3, 'P', 8, BG)
      ]);
      g.appendChild(motion('M-30 120 L60 120 L430 120', '2.4s', (i * 0.8) + 's'));
      svg.appendChild(g);
    }
    svg.appendChild(txt(60, 175, 'route on prefix-hash', 9, MUTE));
    svg.appendChild(txt(430, 225, 'P-requests reuse the warm cache', 9, BP));
    shell(host, 'CACHE-AWARE ROUTER', 'requests routed to the replica holding their prefix', svg,
      'Round-robin scatters requests blind, so most miss the cache and pay full prefill. A cache-aware router hashes the prompt prefix and sends every matching request to the replica that already holds those KV blocks — the warm path stays warm and TTFT collapses from prefill-bound to a cache hit.');
  }

  // ── cold-start-layers: weights stream NVMe→DRAM→HBM, replica goes warm ─────
  // 10-cold-start-mitigation
  function coldStartLayers(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var tiers = [
      { x: 30, t: 'NVMe', s: 'weights at rest' },
      { x: 180, t: 'DRAM', s: 'staged' },
      { x: 330, t: 'HBM', s: 'on GPU' }
    ];
    tiers.forEach(function (ti) {
      svg.appendChild(box(ti.x, 70, 100, 90, BG, MUTE));
      svg.appendChild(txt(ti.x + 50, 60, ti.t, 9, MUTE));
      svg.appendChild(txt(ti.x + 50, 175, ti.s, 8, MUTE));
    });
    // the cold→warm replica on the far right
    svg.appendChild(box(450, 90, 60, 50, BG, SOFT));
    var lamp = svgEl('circle', { cx: 480, cy: 115, r: 9, fill: SOFT });
    lamp.appendChild(anim('fill', SOFT + ';' + SOFT + ';' + BP + ';' + BP, '5s'));
    svg.appendChild(lamp);
    var lampTxt = txt(480, 160, 'cold', 8, MUTE);
    svg.appendChild(lampTxt);
    var warmTxt = txt(480, 75, 'serving', 8, BP);
    warmTxt.appendChild(anim('opacity', '0;0;0;1;1', '5s'));
    svg.appendChild(warmTxt);
    // links between tiers, active dashes
    [[130, 180], [280, 330], [430, 450]].forEach(function (seg) {
      var p = svgEl('path', { d: 'M' + seg[0] + ' 115 L' + seg[1] + ' 115', fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' });
      p.appendChild(anim('stroke-dashoffset', '16;0', '0.7s'));
      svg.appendChild(p);
    });
    // weight blocks streaming through the tiered pipeline
    var i;
    for (i = 0; i < 4; i++) {
      var blk = svgEl('rect', { x: -9, y: -7, width: 18, height: 14, rx: 2, fill: BP, opacity: 0.85 });
      blk.appendChild(motion('M80 115 L130 115 L180 115 L280 115 L330 115 L430 115 L480 115', '5s', (i * 1.0) + 's'));
      svg.appendChild(blk);
    }
    svg.appendChild(txt(255, 215, 'tiered load: NVMe → DRAM → HBM, then the replica serves', 9, MUTE));
    shell(host, 'COLD-START PIPELINE', 'weights stream through tiers until a cold replica goes warm', svg,
      'A scaled-to-zero replica cannot answer until its weights are resident in HBM. The cold-start budget is the sum of node provision, weights download, load into HBM, and engine init — minutes for a 70B model against a two-second SLA. Tiered loading streams weights NVMe→DRAM→HBM and warm pools keep min_workers>0, trading idle GPU cost for a vanished cold-start tail.');
  }

  // ── model-cascade-router: cheap-first, escalate on low confidence ──────────
  // 16-model-routing
  function modelCascadeRouter(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(30, 95, 56, 40, BG, INK));
    svg.appendChild(txt(58, 112, 'broker', 9, INK));
    svg.appendChild(txt(58, 125, 'conf?', 8, MUTE));
    // cheap model (top, most traffic) and frontier (bottom, escalations)
    svg.appendChild(box(380, 40, 110, 44, BG, BP));
    svg.appendChild(txt(435, 58, 'cheap model', 9, BP));
    svg.appendChild(txt(435, 72, '70% · $0.25/M', 8, MUTE));
    svg.appendChild(box(380, 150, 110, 44, BG, WARN));
    svg.appendChild(txt(435, 168, 'frontier model', 9, WARN));
    svg.appendChild(txt(435, 182, '30% · $10/M', 8, MUTE));
    svg.appendChild(svgEl('path', { d: 'M86 110 L376 62', fill: 'none', stroke: BP, 'stroke-width': 1.6 }));
    var esc = svgEl('path', { d: 'M86 120 L376 172', fill: 'none', stroke: WARN, 'stroke-width': 1.4, 'stroke-dasharray': '5 4' });
    esc.appendChild(anim('stroke-dashoffset', '18;0', '1s'));
    svg.appendChild(esc);
    // 7 requests in, most go cheap (blue), some escalate (warn)
    var i;
    for (i = 0; i < 7; i++) {
      var esc2 = i % 3 === 0;
      var g = svgEl('g', {}, [svgEl('circle', { cx: 0, cy: 0, r: 5, fill: esc2 ? WARN : BP })]);
      var path = esc2 ? 'M-20 115 L58 115 L435 172' : 'M-20 115 L58 115 L435 62';
      g.appendChild(motion(path, '2.6s', (i * 0.34) + 's'));
      svg.appendChild(g);
    }
    svg.appendChild(txt(260, 220, 'blended cost ≈ 0.7·cheap + 0.3·frontier', 9, MUTE));
    shell(host, 'MODEL CASCADE ROUTER', 'cheap-first, escalate the hard ones', svg,
      'A broker scores each request — task type, length, confidence — and sends the easy majority to a cheap model. Only low-confidence requests escalate down the dashed lane to the frontier model. Most traffic costs cents; the blended bill drops 20-60% at iso-quality. The hazard is silent cheap-model drift, caught only by an online quality gate.');
  }

  // ── prefill-decode-split: two pools, KV cache handed off via NIXL ──────────
  // 17-disaggregated-prefill-decode
  function prefillDecodeSplit(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(60, 50, 130, 130, BG, BP));
    svg.appendChild(txt(125, 40, 'PREFILL POOL', 9, BP));
    svg.appendChild(txt(125, 70, 'compute-bound', 8, MUTE));
    svg.appendChild(box(330, 50, 130, 130, BG, WARN));
    svg.appendChild(txt(395, 40, 'DECODE POOL', 9, WARN));
    svg.appendChild(txt(395, 70, 'memory-bound', 8, MUTE));
    // prefill GPUs grinding (pulsing fill), decode GPUs streaming
    var i, gx, gy;
    for (i = 0; i < 4; i++) {
      gx = 80 + (i % 2) * 55; gy = 95 + Math.floor(i / 2) * 45;
      var pg = svgEl('rect', { x: gx, y: gy, width: 40, height: 30, rx: 3, fill: BP, opacity: 0.25 });
      pg.appendChild(anim('opacity', '0.2;0.7;0.2', '1.3s', { begin: (i * 0.2) + 's' }));
      svg.appendChild(pg);
    }
    for (i = 0; i < 4; i++) {
      gx = 350 + (i % 2) * 55; gy = 95 + Math.floor(i / 2) * 45;
      svg.appendChild(svgEl('rect', { x: gx, y: gy, width: 40, height: 30, rx: 3, fill: WARN, opacity: 0.22 }));
    }
    // KV cache block transfers over NIXL link
    var link = svgEl('path', { d: 'M190 115 L330 115', fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' });
    link.appendChild(anim('stroke-dashoffset', '16;0', '0.7s'));
    svg.appendChild(link);
    svg.appendChild(txt(260, 108, 'NIXL', 8, INK));
    for (i = 0; i < 3; i++) {
      var kv = svgEl('rect', { x: -10, y: -7, width: 16, height: 14, rx: 2, fill: INK });
      kv.appendChild(motion('M190 115 L330 115', '1.6s', (i * 0.55) + 's'));
      svg.appendChild(kv);
    }
    svg.appendChild(txt(260, 200, 'KV cache transfers prefill → decode', 9, INK));
    svg.appendChild(txt(260, 216, 'each pool sized for its own bottleneck', 9, MUTE));
    shell(host, 'PREFILL / DECODE SPLIT', 'two pools, KV cache handed off between them', svg,
      'Prefill is compute-bound; decode is memory-bound. Colocating both on one GPU wastes whichever resource the current phase is not using. Disaggregation runs separate pools sized for each bottleneck and ships the KV cache across a high-bandwidth NIXL link. It pays off on long prompts; short prompts do not justify the transfer cost.');
  }

  // ── batch-lane-triage: workloads sorted into lanes, batch drains overnight ──
  // 15-batch-apis
  function batchLaneTriage(host) {
    var W = 520, H = 240;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var lanes = [
      { y: 45, t: 'interactive', s: 'sync · full price', c: WARN },
      { y: 110, t: 'semi', s: 'async queue', c: MUTE },
      { y: 175, t: 'batch', s: '50% off · ~24h', c: BP }
    ];
    lanes.forEach(function (ln) {
      svg.appendChild(svgEl('line', { x1: 150, y1: ln.y, x2: 470, y2: ln.y, stroke: ln.c, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.6 }));
      svg.appendChild(txt(95, ln.y - 4, ln.t, 9, ln.c));
      svg.appendChild(txt(95, ln.y + 9, ln.s, 7, MUTE));
    });
    svg.appendChild(box(140, 100, 30, 50, BG, INK));
    svg.appendChild(txt(155, 90, 'triage', 8, INK));
    // jobs enter, most fall into the batch lane (blue), few interactive (warn)
    var spec = [
      { c: WARN, y: 45, b: '0s' }, { c: BP, y: 175, b: '0.5s' }, { c: BP, y: 175, b: '1.0s' },
      { c: MUTE, y: 110, b: '1.5s' }, { c: BP, y: 175, b: '2.0s' }, { c: BP, y: 175, b: '2.6s' }
    ];
    spec.forEach(function (s) {
      var g = svgEl('g', {}, [svgEl('rect', { x: -6, y: -6, width: 12, height: 12, rx: 2, fill: s.c })]);
      g.appendChild(motion('M-20 115 L155 115 L155 ' + s.y + ' L460 ' + s.y, '3.4s', s.b));
      svg.appendChild(g);
    });
    // batch lane drains overnight: a fill bar sweeping right then resetting
    var drain = svgEl('rect', { x: 150, y: 188, width: 0, height: 4, fill: BP, opacity: 0.5 });
    drain.appendChild(anim('width', '0;320;320;0', '5s'));
    svg.appendChild(drain);
    svg.appendChild(txt(310, 215, 'if it is not interactive, it belongs on batch', 9, BP));
    shell(host, 'BATCH LANE TRIAGE', 'workloads sorted into lanes; the batch lane drains overnight', svg,
      'Every new LLM workload triages into three lanes. Interactive stays synchronous at full price; semi-interactive goes on an async queue; everything tolerant of 24-hour latency drops into the batch lane at a 50% discount, stacked with cached input toward ~10% of synchronous cost. Most jobs that pretend to be real-time actually just need an answer by morning.');
  }

  // ── semantic-cache-hit: similar prompts served from cache vs cold LLM ───────
  // 14-prompt-semantic-caching
  function semanticCacheHit(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    svg.appendChild(box(150, 95, 70, 44, BG, INK));
    svg.appendChild(txt(185, 113, 'cache', 9, INK));
    svg.appendChild(txt(185, 127, 'embeds', 8, MUTE));
    svg.appendChild(box(390, 40, 100, 40, BG, WARN));
    svg.appendChild(txt(440, 58, 'LLM (cold)', 9, WARN));
    svg.appendChild(txt(440, 72, 'slow · $$$', 8, MUTE));
    svg.appendChild(box(390, 150, 100, 40, BG, BP));
    svg.appendChild(txt(440, 168, 'cache hit', 9, BP));
    svg.appendChild(txt(440, 182, 'fast · ~$0', 8, MUTE));
    // hit path (near, fast) vs miss path (far, to LLM)
    var hit = svgEl('path', { d: 'M220 120 L388 170', fill: 'none', stroke: BP, 'stroke-width': 2, 'stroke-dasharray': '6 4' });
    hit.appendChild(anim('stroke-dashoffset', '20;0', '0.6s'));
    svg.appendChild(hit);
    svg.appendChild(svgEl('path', { d: 'M220 110 L388 60', fill: 'none', stroke: SOFT, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }));
    // queries flow in; similar ones (blue) hit, novel one (warn) misses to LLM
    var spec = [{ c: BP, p: 'M-20 117 L185 117 L440 170', b: '0s' }, { c: BP, p: 'M-20 117 L185 117 L440 170', b: '0.9s' }, { c: WARN, p: 'M-20 117 L185 117 L440 60', b: '1.8s' }, { c: BP, p: 'M-20 117 L185 117 L440 170', b: '2.7s' }];
    spec.forEach(function (s) {
      var g = svgEl('g', {}, [svgEl('circle', { cx: 0, cy: 0, r: 5, fill: s.c })]);
      g.appendChild(motion(s.p, '3.6s', s.b));
      svg.appendChild(g);
    });
    svg.appendChild(txt(260, 215, 'similarity ≥ threshold → serve from cache, skip the LLM', 9, MUTE));
    shell(host, 'SEMANTIC CACHE', 'similar prompts served from cache, novel ones reach the LLM', svg,
      'L1 semantic caching embeds each prompt and checks similarity against past entries. A near-duplicate query (blue) is served straight from the cache — fast and nearly free. Only a genuinely novel prompt (orange) misses through to the cold LLM. Hit rates run 10% on open chat up to 70% on structured FAQ; dynamic text in the prefix collapses them to near zero.');
  }

  // ── edge-bandwidth-pipe: tokens through a narrow mobile pipe vs wide HBM ────
  // 12-edge-inference
  function edgeBandwidthPipe(host) {
    var W = 520, H = 230;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    // datacenter: wide pipe, many tokens
    svg.appendChild(txt(120, 36, 'datacenter HBM3 · ~3 TB/s', 9, BP));
    svg.appendChild(svgEl('rect', { x: 40, y: 50, width: 160, height: 44, rx: 4, fill: 'none', stroke: BP, 'stroke-width': 2 }));
    svg.appendChild(txt(245, 75, '→ ~830 tok/s', 9, BP, 'start'));
    var i;
    for (i = 0; i < 8; i++) {
      var d = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: BP });
      d.appendChild(motion('M40 72 L200 72', '0.9s', (i * 0.11) + 's'));
      svg.appendChild(d);
    }
    // edge: narrow pipe, few tokens trickle
    svg.appendChild(txt(120, 130, 'mobile DRAM · ~50-90 GB/s', 9, WARN));
    svg.appendChild(svgEl('rect', { x: 90, y: 150, width: 60, height: 14, rx: 3, fill: 'none', stroke: WARN, 'stroke-width': 2 }));
    svg.appendChild(txt(245, 162, '→ ~14-25 tok/s', 9, WARN, 'start'));
    for (i = 0; i < 3; i++) {
      var s = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: WARN });
      s.appendChild(motion('M90 157 L150 157', '1.6s', (i * 0.6) + 's'));
      svg.appendChild(s);
    }
    svg.appendChild(txt(260, 205, 'decode reads every weight per token — bandwidth sets the ceiling', 9, MUTE));
    svg.appendChild(txt(260, 221, 'compute is secondary; the pipe width decides tok/s', 9, MUTE));
    shell(host, 'EDGE BANDWIDTH CEILING', 'tokens stream through a wide datacenter pipe vs a narrow mobile one', svg,
      'Decode reads the full set of weights for every token, so memory bandwidth — not compute — is the ceiling. Datacenter HBM3 near 3 TB/s flushes the weights in around a millisecond, clearing hundreds of tokens per second. Mobile DRAM at 50-90 GB/s is a 30-50x narrower pipe, so the same model trickles out at 14-25 tok/s no matter how much NPU compute sits idle.');
  }

  // ── load-pattern-waves: steady / ramp / spike / soak request waves ─────────
  // 22-load-testing-llm-apis
  function loadPatternWaves(host) {
    var state = { pat: 'spike' };
    var W = 520, H = 230, PAD = 36;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H });
    var dur = 6;
    function shape(pat) {
      // values for bar height (0..1) sampled across the cycle, and a server label
      if (pat === 'steady') return { h: '0.55;0.55;0.55;0.55;0.55', note: 'constant rate — baseline throughput' };
      if (pat === 'ramp') return { h: '0.1;0.35;0.6;0.85;1', note: 'climbing load — finds the breaking point' };
      if (pat === 'spike') return { h: '0.2;0.2;1;1;0.2', note: 'sudden surge — tests autoscaling reaction' };
      return { h: '0.6;0.6;0.6;0.6;0.6', note: 'sustained hours — surfaces memory leaks (soak)' };
    }
    var note = txt(260, 215, '', 9, MUTE);
    var bars = svgEl('g', {});
    var sat = txt(260, 36, '', 10, BP);
    function build() {
      while (bars.firstChild) bars.removeChild(bars.firstChild);
      var sp = shape(state.pat);
      var hv = sp.h.split(';');
      var n = 14, i;
      for (i = 0; i < n; i++) {
        var bx = PAD + i * ((W - 2 * PAD) / n) + 3;
        var bw = (W - 2 * PAD) / n - 6;
        // per-bar phase offset so the wave travels left to right
        var off = (i / n) * dur;
        var b = svgEl('rect', { x: bx, y: H - PAD, width: bw, height: 4, fill: i % 2 ? BP : MUTE, opacity: 0.85 });
        // scale heights to pixels (max ~140)
        var hpx = hv.map(function (v) { return (Number(v) * 140).toFixed(0); }).join(';');
        var ypx = hv.map(function (v) { return (H - PAD - Number(v) * 140).toFixed(0); }).join(';');
        b.appendChild(svgEl('animate', { attributeName: 'height', values: hpx, dur: dur + 's', repeatCount: 'indefinite', begin: (-off) + 's' }));
        b.appendChild(svgEl('animate', { attributeName: 'y', values: ypx, dur: dur + 's', repeatCount: 'indefinite', begin: (-off) + 's' }));
        bars.appendChild(b);
      }
      note.textContent = sp.note;
      sat.textContent = state.pat.toUpperCase() + ' pattern';
    }
    svg.appendChild(svgEl('line', { x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD, stroke: SOFT, 'stroke-width': 1 }));
    svg.appendChild(bars);
    svg.appendChild(sat);
    svg.appendChild(note);
    state._render = build;
    var ctrl = select(state, 'pat', 'load pattern', [['spike', 'spike'], ['steady-state', 'steady'], ['ramp', 'ramp'], ['soak', 'soak']]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LOAD PATTERNS']), el('span', {}, ['pick a pattern'])]),
      el('div', { class: 'lf-body' }, [el('div', {}, [ctrl]), el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, ['Four load shapes catch four failures. Steady-state measures baseline throughput; ramp climbs until the breaking point; spike surges suddenly to test how fast autoscaling reacts; soak holds load for hours to surface memory leaks. Generic testers also lie when every request is identical — real traffic needs variable input length and diverse prefixes.'])
    ]));
    build();
  }

  LF.register({
    'cache-aware-router': cacheAwareRouter,
    'cold-start-pipeline': coldStartLayers,
    'model-cascade-router': modelCascadeRouter,
    'prefill-decode-split': prefillDecodeSplit,
    'batch-lane-triage': batchLaneTriage,
    'semantic-cache-hit': semanticCacheHit,
    'edge-bandwidth-pipe': edgeBandwidthPipe,
    'load-pattern-waves': loadPatternWaves
  });
})();
