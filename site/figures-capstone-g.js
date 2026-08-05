(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }

  var el = LF.el, svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)', SOFT = 'var(--ink-soft,#555)', MUTE = 'var(--ink-mute,#777)';
  var BP = 'var(--blueprint,#3553ff)', BG = 'var(--bg,#fafaf5)', SURF = 'var(--bg-surface,#eee)';
  var RULE = 'var(--rule-soft,#ddd)', WARN = 'var(--warn,#b8870f)';
  var SPL = '0.23 1 0.32 1';
  var SPL3 = SPL + ';' + SPL + ';' + SPL;

  function anim(attr, vals, dur, extra) {
    var a = { attributeName: attr, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animate', a);
  }
  function animT(type, vals, dur, extra) {
    var a = { attributeName: 'transform', type: type, values: vals, dur: dur, repeatCount: 'indefinite' };
    if (extra) for (var k in extra) a[k] = extra[k];
    return svgEl('animateTransform', a);
  }
  function card(host, label, hint, svg, caption) {
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, [label]), el('span', {}, [hint])]),
      el('div', { class: 'lf-body' }, [el('div', { class: 'lf-out' }, [svg])]),
      el('div', { class: 'lf-cap' }, [caption])
    ]));
  }
  function txt(x, y, s, fill, size, anchor) {
    return svgEl('text', {
      x: x, y: y, fill: fill || SOFT, 'font-size': size || 11,
      'font-family': 'var(--font-mono,monospace)', 'text-anchor': anchor || 'middle'
    }, [svgEl('tspan', {}, [document.createTextNode(s)])]);
  }
  // entry that fades in from opacity 0 and grows from 95% around (cx, cy)
  function pop(cx, cy, dur, kt, kids) {
    var inner = svgEl('g', {}, kids);
    inner.appendChild(animT('scale', '0.95;0.95;1;1', dur, { keyTimes: kt, calcMode: 'spline', keySplines: SPL3 }));
    inner.appendChild(anim('opacity', '0;0;1;1', dur, { keyTimes: kt }));
    return svgEl('g', { transform: 'translate(' + cx + ' ' + cy + ')' }, [inner]);
  }

  // ── 24: plan-execute-replan — a failed step hands the cursor back ──────────
  function planReplan(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '5s';
    svg.appendChild(txt(260, 16, 'plan is data · the executor walks it', MUTE, 10));
    svg.appendChild(svgEl('rect', { x: 30, y: 44, width: 104, height: 44, rx: 5, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(82, 62, 'planner', BP, 10));
    svg.appendChild(txt(82, 76, 'replan(cursor, err)', MUTE, 7));
    var steps = ['1 read file', '2 run tests', '3 apply patch', '4 rerun tests', '5 report'];
    var sx = 200, sw = 128, i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(svgEl('rect', { x: sx, y: 36 + i * 36, width: sw, height: 26, rx: 4, fill: BG, stroke: RULE, 'stroke-width': '1.4' }));
      svg.appendChild(txt(sx + sw / 2, 53 + i * 36, steps[i], SOFT, 9));
    }
    var stale = svgEl('g', {});
    for (i = 3; i < 5; i++) {
      stale.appendChild(svgEl('rect', { x: sx, y: 36 + i * 36, width: sw, height: 26, rx: 4, fill: BG, stroke: RULE, 'stroke-width': '1.4' }));
      stale.appendChild(txt(sx + sw / 2, 53 + i * 36, steps[i], SOFT, 9));
    }
    stale.appendChild(anim('opacity', '1;1;0.25;0.25', D, { keyTimes: '0;0.28;0.4;1' }));
    svg.appendChild(stale);
    var fail = txt(336, 125, '✗ import error', WARN, 8, 'start');
    fail.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.24;0.3;1' }));
    svg.appendChild(fail);
    var arc = svgEl('path', { d: 'M200 121 C 158 121, 158 66, 134 66', fill: 'none', stroke: WARN, 'stroke-width': '1.8', 'stroke-dasharray': '6 5' });
    arc.appendChild(anim('stroke-dashoffset', '80;80;0;0', D, { keyTimes: '0;0.3;0.44;1', calcMode: 'spline', keySplines: SPL3 }));
    arc.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.28;0.32;1' }));
    svg.appendChild(arc);
    svg.appendChild(pop(432, 132, D, '0;0.5;0.62;1', [
      svgEl('rect', { x: -64, y: -24, width: sw, height: 26, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.6', 'stroke-dasharray': '5 4' }),
      txt(0, -7, "3' fix import", BP, 9),
      svgEl('rect', { x: -64, y: 12, width: sw, height: 26, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.6', 'stroke-dasharray': '5 4' }),
      txt(0, 29, "4' rerun tests", BP, 9),
      txt(0, -34, 'diff +2 −2', BP, 8)
    ]));
    var cur = svgEl('circle', { r: 5, fill: WARN });
    cur.appendChild(anim('cx', '188;188;188;188;356;356;356;356', D, { keyTimes: '0;0.12;0.24;0.55;0.62;0.78;0.9;1' }));
    cur.appendChild(anim('cy', '49;85;121;121;121;157;157;157', D, { keyTimes: '0;0.12;0.24;0.55;0.62;0.78;0.9;1' }));
    svg.appendChild(cur);
    svg.appendChild(txt(260, 240, 'budgets: steps 7/8 · replans 1/2 · abort past either ceiling', MUTE, 8));
    card(host, 'PLAN / EXECUTE / REPLAN', 'fail hands back to planner',
      svg,
      'The plan is an ordered list of typed steps the executor can walk, not prose the loop has to parse. When step 3 fails, the executor does not improvise: it hands the cursor and the error back to the planner, which returns a fresh tail from that position. The revision arrives as a diff a tracer can display, and two hard ceilings, one on steps and one on replans, keep the loop from planning forever.');
  }

  // ── 25: verification gate chain — first DENY wins, ledger meters the rest ──
  function gateChain(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '5.5s';
    svg.appendChild(txt(260, 16, 'every tool call walks the chain · first DENY wins', MUTE, 10));
    var names = ['budget', 'recency', 'whitelist', 'regex'];
    var subs = ['tokens left?', 'stale reads?', 'tool known?', 'argv clean?'];
    var gx = [64, 172, 280, 388], gy = 56, gw = 92, gh = 40, i;
    svg.appendChild(svgEl('line', { x1: 24, y1: gy + gh / 2, x2: 504, y2: gy + gh / 2, stroke: RULE, 'stroke-width': '1.2', 'stroke-dasharray': '3 4' }));
    for (i = 0; i < 4; i++) {
      var r = svgEl('rect', { x: gx[i], y: gy, width: gw, height: gh, rx: 5, fill: BG, stroke: BP, 'stroke-width': '1.6', opacity: '0.55' });
      r.appendChild(anim('opacity', '0.55;1;0.55', D, { begin: (0.3 + i * 0.25) + 's' }));
      svg.appendChild(r);
      svg.appendChild(txt(gx[i] + gw / 2, gy + 17, names[i], BP, 10));
      svg.appendChild(txt(gx[i] + gw / 2, gy + 31, subs[i], MUTE, 7));
    }
    svg.appendChild(txt(24, gy - 10, 'call: read_file', SOFT, 8, 'start'));
    svg.appendChild(txt(504, gy - 10, 'ALLOW', BP, 9, 'end'));
    var pa = svgEl('rect', { x: 24, y: gy + gh / 2 - 6, width: 16, height: 12, rx: 2, fill: BP });
    pa.appendChild(anim('x', '24;110;218;326;434;488;488', D, { keyTimes: '0;0.09;0.18;0.27;0.36;0.44;1', calcMode: 'spline', keySplines: SPL + ';' + SPL + ';' + SPL + ';' + SPL + ';' + SPL + ';' + SPL }));
    pa.appendChild(anim('opacity', '1;1;1;1;1;1;0;0', D, { keyTimes: '0;0.09;0.18;0.27;0.36;0.5;0.56;1' }));
    svg.appendChild(pa);
    var pb = svgEl('rect', { x: 24, y: gy + gh / 2 - 6, width: 16, height: 12, rx: 2, fill: WARN });
    pb.appendChild(anim('x', '24;24;110;218;326;326;326', D, { keyTimes: '0;0.5;0.58;0.66;0.74;0.8;1', calcMode: 'spline', keySplines: SPL + ';' + SPL + ';' + SPL + ';' + SPL + ';' + SPL + ';' + SPL }));
    pb.appendChild(anim('y', '70;70;70;138;138', D, { keyTimes: '0;0.76;0.8;0.9;1' }));
    pb.appendChild(anim('opacity', '0;0;1;1;1;0;0', D, { keyTimes: '0;0.48;0.52;0.85;0.9;0.97;1' }));
    svg.appendChild(pb);
    var deny = txt(326, 168, '✗ DENY unknown tool "shell"', WARN, 8);
    deny.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.78;0.84;0.94;0.98;1' }));
    svg.appendChild(deny);
    var route = svgEl('path', { d: 'M488 76 V 150 H 384 V 186', fill: 'none', stroke: BP, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    route.appendChild(anim('stroke-dashoffset', '60;60;0;0', D, { keyTimes: '0;0.42;0.52;1', calcMode: 'spline', keySplines: SPL3 }));
    route.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.4;0.44;1' }));
    svg.appendChild(route);
    var ly = 192;
    svg.appendChild(txt(140, ly - 8, 'observation ledger', MUTE, 8, 'start'));
    svg.appendChild(svgEl('rect', { x: 140, y: ly, width: 240, height: 14, rx: 2, fill: 'none', stroke: MUTE, 'stroke-width': '1.4' }));
    var lfill = svgEl('rect', { x: 141, y: ly + 1, width: 96, height: 12, rx: 2, fill: BP, opacity: '0.5' });
    lfill.appendChild(anim('width', '96;96;150;150', D, { keyTimes: '0;0.44;0.54;1', calcMode: 'spline', keySplines: SPL3 }));
    svg.appendChild(lfill);
    svg.appendChild(txt(388, ly + 11, '5.1K / 8K tokens shown', SOFT, 8, 'start'));
    card(host, 'GATE CHAIN + LEDGER', 'deny fast · meter the rest',
      svg,
      'The chain is four deterministic gates with short-circuit semantics: the first DENY ends the walk and the reason is logged for the model to read. An allowed call is not free either. Its output is metered into the observation ledger, and once the cumulative tokens shown to the model would cross the budget, the budget gate at the front of the chain starts refusing calls on its own.');
  }

  // ── 26: sandbox path jail — traversal bounces off the root fence ───────────
  function pathJail(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 240' });
    var D = '5s';
    svg.appendChild(txt(260, 16, 'realpath every argument · assert the prefix', MUTE, 10));
    svg.appendChild(svgEl('rect', { x: 28, y: 64, width: 104, height: 44, rx: 5, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(80, 82, 'sandbox', BP, 10));
    svg.appendChild(txt(80, 96, 'subprocess.run', MUTE, 7));
    svg.appendChild(svgEl('rect', { x: 250, y: 40, width: 180, height: 110, rx: 6, fill: 'none', stroke: BP, 'stroke-width': '1.8', 'stroke-dasharray': '7 5' }));
    svg.appendChild(txt(340, 32, 'project root jail', BP, 9));
    svg.appendChild(svgEl('rect', { x: 268, y: 56, width: 78, height: 20, rx: 3, fill: SURF, stroke: RULE, 'stroke-width': '1' }));
    svg.appendChild(txt(307, 69, 'src/main.py', SOFT, 8));
    svg.appendChild(svgEl('rect', { x: 268, y: 118, width: 78, height: 20, rx: 3, fill: SURF, stroke: RULE, 'stroke-width': '1' }));
    svg.appendChild(txt(307, 131, 'tests/', SOFT, 8));
    var okp = svgEl('path', { d: 'M132 78 C 190 78, 210 66, 264 66', fill: 'none', stroke: BP, 'stroke-width': '1.8', 'stroke-dasharray': '6 5' });
    okp.appendChild(anim('stroke-dashoffset', '80;80;0;0', D, { keyTimes: '0;0.06;0.22;1', calcMode: 'spline', keySplines: SPL3 }));
    okp.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.05;0.1;1' }));
    svg.appendChild(okp);
    var ok = txt(352, 69, '✓ inside root', BP, 8, 'start');
    ok.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.2;0.28;1' }));
    svg.appendChild(ok);
    var esc = svgEl('circle', { r: 5, fill: WARN });
    var mo = svgEl('animateMotion', {
      dur: D, repeatCount: 'indefinite', path: 'M132 100 L 430 100',
      keyPoints: '0;0;1;0.55;0.55', keyTimes: '0;0.3;0.55;0.8;1', calcMode: 'linear'
    });
    esc.appendChild(mo);
    svg.appendChild(esc);
    svg.appendChild(txt(180, 118, '../../etc/passwd', WARN, 8));
    var flash = svgEl('line', { x1: 430, y1: 84, x2: 430, y2: 120, stroke: WARN, 'stroke-width': '2.5' });
    flash.appendChild(anim('opacity', '0;0;1;0;0', D, { keyTimes: '0;0.52;0.56;0.68;1' }));
    svg.appendChild(flash);
    var no = txt(444, 104, '✗ escapes root', WARN, 8, 'start');
    no.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.54;0.6;1' }));
    svg.appendChild(no);
    var chips = ['sudo', 'rm -rf', 'python3 -c'], cx = [116, 216, 316], i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(pop(cx[i] + 40, 197, D, '0;' + (0.6 + i * 0.08).toFixed(2) + ';' + (0.7 + i * 0.08).toFixed(2) + ';1', [
        svgEl('rect', { x: -40, y: -11, width: 80, height: 22, rx: 4, fill: BG, stroke: RULE, 'stroke-width': '1.4' }),
        txt(0, 4, chips[i], SOFT, 9),
        svgEl('line', { x1: -34, y1: 0, x2: 34, y2: 0, stroke: WARN, 'stroke-width': '1.8' })
      ]));
    }
    svg.appendChild(txt(104, 200, 'denylist', MUTE, 8, 'end'));
    svg.appendChild(txt(444, 200, 'by name and argv shape', MUTE, 8, 'start'));
    card(host, 'PATH JAIL + DENYLIST', 'refuse by prefix, name, shape',
      svg,
      'Two refusal surfaces sit between the model and the operating system. Every path argument resolves through realpath and must keep the project root as a prefix, so a ../../ traversal bounces off the jail wall instead of reaching /etc. Alongside it, a denylist refuses executables by name and an argv inspector catches interpreters smuggling shell through -c flags. Output is truncated and a wall-clock timeout kills whatever runs away.');
  }

  // ── 29: end-to-end harness — one run token weaving through four strata ─────
  function harnessWeave(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 260' });
    var D = '5.5s';
    var bands = ['gate chain', 'sandbox', 'otel span', 'eval harness'], i;
    for (i = 0; i < 4; i++) {
      var b = svgEl('rect', { x: 30, y: 40 + i * 44, width: 380, height: 34, rx: 4, fill: SURF, stroke: RULE, 'stroke-width': '1', opacity: '0.5' });
      b.appendChild(anim('opacity', '0.5;0.9;0.5', D, { begin: (i * 0.22) + 's' }));
      svg.appendChild(b);
      svg.appendChild(txt(38, 61 + i * 44, bands[i], SOFT, 9, 'start'));
    }
    var labels = ['read', 'tests', 'write', 'tests'], lx = [130, 210, 290, 370];
    for (i = 0; i < 4; i++) {
      var t = txt(lx[i], 30, labels[i], BP, 9);
      t.appendChild(anim('opacity', '0.3;1;0.3', D, { begin: (i * 1.3) + 's' }));
      svg.appendChild(t);
    }
    var dot = svgEl('circle', { r: 5, fill: WARN });
    dot.appendChild(svgEl('animateMotion', {
      dur: D, repeatCount: 'indefinite',
      path: 'M130 44 V 206 L 210 44 V 206 L 290 44 V 206 L 370 44 V 206'
    }));
    svg.appendChild(dot);
    svg.appendChild(pop(462, 130, D, '0;0.78;0.9;1', [
      svgEl('rect', { x: -40, y: -36, width: 80, height: 72, rx: 5, fill: BG, stroke: BP, 'stroke-width': '2' }),
      txt(0, -16, 'run report', BP, 9),
      txt(0, 6, 'PASS', INK, 13),
      txt(0, 24, '9 steps · 0 trips', MUTE, 7)
    ]));
    svg.appendChild(txt(220, 246, 'global budgets: 12 steps · 8K observation tokens', MUTE, 8));
    card(host, 'HARNESS END TO END', 'every step crosses four layers',
      svg,
      'The end-to-end run is one token weaving through four strata on every step: the gate chain rules on the call, the sandbox executes it, a span wraps the whole exchange, and the eval harness scores the finished trajectory. The components stop disagreeing because the budgets live in one place and every layer reads the same ledger. The fixture bug falls in nine steps, under the twelve-step ceiling, with zero gate trips on legal tools.');
  }

  // ── 41: eval pipeline — four gauges fold into one report ───────────────────
  function evalQuadrant(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 260' });
    var D = '4.5s';
    svg.appendChild(txt(196, 16, 'four evals · four blind spots covered', MUTE, 10));
    var tiles = [
      ['perplexity', 'held-out LM', '31.4', 0.55],
      ['exact match', 'short factual', '0.45', 0.45],
      ['token F1', 'open form', '0.62', 0.62],
      ['judge (mock)', '1-5 rubric', '3.8 / 5', 0.76]
    ];
    var px = [36, 206, 36, 206], py = [36, 36, 148, 148], w = 150, h = 92, i;
    for (i = 0; i < 4; i++) {
      var x = px[i], y = py[i];
      svg.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, rx: 5, fill: BG, stroke: RULE, 'stroke-width': '1.4' }));
      svg.appendChild(txt(x + w / 2, y + 18, tiles[i][0], BP, 10));
      svg.appendChild(txt(x + w / 2, y + 31, tiles[i][1], MUTE, 7));
      svg.appendChild(txt(x + w / 2, y + 56, tiles[i][2], INK, 13));
      svg.appendChild(svgEl('rect', { x: x + 14, y: y + 68, width: w - 28, height: 8, rx: 2, fill: 'none', stroke: RULE, 'stroke-width': '1' }));
      var fw = Math.round(tiles[i][3] * (w - 30));
      var f = svgEl('rect', { x: x + 15, y: y + 69, width: 0, height: 6, rx: 2, fill: BP, opacity: '0.6' });
      f.appendChild(anim('width', '0;0;' + fw + ';' + fw, D, {
        keyTimes: '0;' + (0.08 + i * 0.06).toFixed(2) + ';' + (0.34 + i * 0.06).toFixed(2) + ';1',
        calcMode: 'spline', keySplines: SPL3
      }));
      svg.appendChild(f);
      var a = svgEl('path', { d: 'M' + (x + w) + ' ' + (y + h / 2) + ' C 372 ' + (y + h / 2) + ', 372 130, 392 130', fill: 'none', stroke: BP, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
      a.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;' + (0.4 + i * 0.04).toFixed(2) + ';' + (0.48 + i * 0.04).toFixed(2) + ';1' }));
      svg.appendChild(a);
    }
    svg.appendChild(pop(452, 130, D, '0;0.58;0.72;1', [
      svgEl('rect', { x: -56, y: -60, width: 112, height: 120, rx: 6, fill: BG, stroke: BP, 'stroke-width': '2' }),
      txt(0, -40, 'report', BP, 10),
      txt(0, -18, 'ppl 31.4', SOFT, 8),
      txt(0, -4, 'em 0.45', SOFT, 8),
      txt(0, 10, 'f1 0.62', SOFT, 8),
      txt(0, 24, 'judge 3.8', SOFT, 8),
      txt(0, 46, 'agg 0.61', INK, 11)
    ]));
    card(host, 'EVAL PIPELINE', 'ppl · em · f1 · judge',
      svg,
      'Perplexity tracks fit to the language distribution but never asks a question. Exact match scores facts and punishes paraphrase; token F1 forgives paraphrase and is fooled by overlap; the mock judge scores open answers on a rubric without a network call. No single number describes a language model, so the pipeline runs all four on shaped held-out subsets and folds them into one weighted report a reviewer can read at a glance.');
  }

  // ── 48: DDP collectives — gradients meet in the middle, mean returns ───────
  function allreduceRing(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '5s';
    svg.appendChild(txt(260, 16, 'broadcast once · all-reduce every step', MUTE, 10));
    var rx = [40, 164, 288, 412], i;
    for (i = 0; i < 4; i++) {
      svg.appendChild(svgEl('rect', { x: rx[i], y: 44, width: 96, height: 40, rx: 5, fill: BG, stroke: i === 0 ? BP : RULE, 'stroke-width': i === 0 ? '2' : '1.4' }));
      svg.appendChild(txt(rx[i] + 48, 61, 'rank ' + i, i === 0 ? BP : SOFT, 10));
      svg.appendChild(txt(rx[i] + 48, 75, i === 0 ? 'seed model' : 'replica', MUTE, 7));
    }
    for (i = 1; i < 4; i++) {
      var bc = svgEl('path', { d: 'M96 44 C ' + (96 + (rx[i] - 48)) / 2 + ' 24, ' + (96 + (rx[i] - 48)) / 2 + ' 24, ' + (rx[i] + 40) + ' 44', fill: 'none', stroke: BP, 'stroke-width': '1.6', 'stroke-dasharray': '6 5' });
      bc.appendChild(anim('opacity', '0;1;1;0;0', D, { begin: (i * 0.1) + 's', keyTimes: '0;0.06;0.2;0.26;1' }));
      svg.appendChild(bc);
    }
    var bl = txt(260, 30, 'broadcast θ from rank 0', BP, 8);
    bl.appendChild(anim('opacity', '0;1;1;0;0', D, { keyTimes: '0;0.06;0.2;0.26;1' }));
    svg.appendChild(bl);
    svg.appendChild(svgEl('circle', { cx: 260, cy: 160, r: 22, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    var sum = txt(260, 164, 'Σ/N', BP, 10);
    svg.appendChild(sum);
    for (i = 0; i < 4; i++) {
      var g = svgEl('rect', { x: -6, y: -5, width: 12, height: 10, rx: 2, fill: WARN });
      g.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;' + (0.3 + i * 0.04).toFixed(2) + ';' + (0.38 + i * 0.04).toFixed(2) + ';0.58;0.64;1' }));
      g.appendChild(svgEl('animateMotion', {
        dur: D, repeatCount: 'indefinite', path: 'M' + (rx[i] + 48) + ' 100 L 260 160',
        keyPoints: '0;0;1;1', keyTimes: '0;' + (0.42 + i * 0.04).toFixed(2) + ';' + (0.58 + i * 0.04).toFixed(2) + ';1', calcMode: 'linear'
      }));
      svg.appendChild(g);
      var m = svgEl('rect', { x: -6, y: -5, width: 12, height: 10, rx: 2, fill: BP });
      m.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.7;0.74;0.9;0.96;1' }));
      m.appendChild(svgEl('animateMotion', {
        dur: D, repeatCount: 'indefinite', path: 'M260 160 L ' + (rx[i] + 48) + ' 100',
        keyPoints: '0;0;1;1', keyTimes: '0;0.72;0.88;1', calcMode: 'linear'
      }));
      svg.appendChild(m);
    }
    svg.appendChild(txt(352, 152, 'all-reduce mean', MUTE, 8, 'start'));
    svg.appendChild(txt(260, 232, 'every rank steps with the same averaged gradient · step 42 everywhere', MUTE, 8));
    card(host, 'DDP COLLECTIVES', 'grads meet · mean returns',
      svg,
      'Data parallel is two collectives and a rule. Parameters broadcast from rank 0 once at construction so every replica starts identical. After each backward pass the per-rank gradients meet in an all-reduce and every rank receives the same mean, so the optimizer steps can never disagree. FSDP extends the same discipline to memory: each rank keeps only a shard of every parameter and gathers the full tensor just long enough for the layer that needs it.');
  }

  // ── 50: hypothesis generator — ramp the temperature, reject the cluster ────
  function noveltyRamp(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '5s';
    svg.appendChild(txt(260, 16, 'raise T each pass · reject inside the cluster', MUTE, 10));
    var th = [22, 44, 66], tt = ['0.7', '1.0', '1.3'], i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(svgEl('rect', { x: 36 + i * 48, y: 190 - th[i], width: 44, height: th[i], rx: 2, fill: BP, opacity: (0.18 + i * 0.14).toFixed(2) }));
      svg.appendChild(txt(58 + i * 48, 204, 'T ' + tt[i], MUTE, 8));
    }
    var mk = svgEl('circle', { r: 5, fill: WARN });
    mk.appendChild(anim('cx', '58;58;106;106;154;154', D, { keyTimes: '0;0.3;0.36;0.62;0.68;1' }));
    mk.appendChild(anim('cy', '162;162;140;140;118;118', D, { keyTimes: '0;0.3;0.36;0.62;0.68;1' }));
    svg.appendChild(mk);
    svg.appendChild(txt(104, 224, 'temperature ramp', MUTE, 8));
    var ring = svgEl('circle', { cx: 300, cy: 110, r: 34, fill: 'none', stroke: RULE, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    ring.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.1;0.16;1' }));
    svg.appendChild(ring);
    svg.appendChild(txt(300, 62, 'cosine radius', MUTE, 7));
    svg.appendChild(pop(300, 110, D, '0;0.06;0.14;1', [svgEl('circle', { r: 6, fill: BP })]));
    var dup = svgEl('circle', { cx: 322, cy: 122, r: 6, fill: WARN });
    dup.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.38;0.44;0.52;0.58;1' }));
    svg.appendChild(dup);
    var dx = txt(338, 126, '✗ near-dup', WARN, 8, 'start');
    dx.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.4;0.46;0.54;0.6;1' }));
    svg.appendChild(dx);
    svg.appendChild(pop(396, 88, D, '0;0.62;0.72;1', [svgEl('circle', { r: 6, fill: BP })]));
    svg.appendChild(pop(444, 152, D, '0;0.8;0.9;1', [svgEl('circle', { r: 6, fill: BP })]));
    var qx = [300, 360, 420], ql = ['h1 .91', 'h2 .84', 'h3 .77'], qk = ['0;0.16;0.26;1', '0;0.72;0.82;1', '0;0.9;0.98;1'];
    for (i = 0; i < 3; i++) {
      svg.appendChild(pop(qx[i], 216, D, qk[i], [
        svgEl('rect', { x: -26, y: -10, width: 52, height: 20, rx: 3, fill: BG, stroke: BP, 'stroke-width': '1.4' }),
        txt(0, 4, ql[i], BP, 8)
      ]));
    }
    svg.appendChild(txt(262, 220, 'queue', MUTE, 8, 'end'));
    card(host, 'HYPOTHESIS GENERATOR', 'ramp · filter · rank',
      svg,
      'One pass through the sampler yields one hypothesis; the loop wants a ranked queue with depth. Each pass raises the temperature a notch so the next draft wanders further from the last, and an embedding filter rejects anything that lands inside the cosine radius of a survivor. What remains is scored on novelty, specificity, and testability, and because every step is seeded, the same seed always rebuilds the same queue.');
  }

  // ── 51: literature retrieval — lexical hits plus citation hops, one union ──
  function citationHops(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 260' });
    var D = '5s';
    svg.appendChild(txt(260, 16, 'lexical pass + graph pass · union deduped by id', MUTE, 10));
    svg.appendChild(svgEl('rect', { x: 32, y: 30, width: 130, height: 26, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(97, 47, '"sparse attention"', BP, 8));
    svg.appendChild(txt(32, 74, 'BM25 over abstracts', MUTE, 8, 'start'));
    var hits = ['p003 · 0.81', 'p007 · 0.66', 'p011 · 0.54'], i;
    for (i = 0; i < 3; i++) {
      svg.appendChild(pop(97, 95 + i * 32, D, '0;' + (0.08 + i * 0.07).toFixed(2) + ';' + (0.2 + i * 0.07).toFixed(2) + ';1', [
        svgEl('rect', { x: -65, y: -12, width: 130, height: 24, rx: 3, fill: SURF, stroke: RULE, 'stroke-width': '1.2' }),
        txt(0, 4, hits[i], SOFT, 8)
      ]));
    }
    svg.appendChild(txt(390, 40, 'seed from known anchor', MUTE, 8));
    var nodes = [[350, 74, 'p007', BP], [296, 132, 'p015', SOFT], [412, 126, 'p019', SOFT], [452, 180, 'p021', SOFT]];
    var edges = [[350, 74, 296, 132, 0.3], [350, 74, 412, 126, 0.36], [412, 126, 452, 180, 0.48]];
    for (i = 0; i < 3; i++) {
      var e = svgEl('line', { x1: edges[i][0], y1: edges[i][1], x2: edges[i][2], y2: edges[i][3], stroke: BP, 'stroke-width': '1.4', 'stroke-dasharray': '4 4' });
      e.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;' + edges[i][4] + ';' + (edges[i][4] + 0.08).toFixed(2) + ';1' }));
      svg.appendChild(e);
    }
    for (i = 0; i < 4; i++) {
      var kt = i === 0 ? '0;0.22;0.32;1' : '0;' + (0.3 + i * 0.09).toFixed(2) + ';' + (0.42 + i * 0.09).toFixed(2) + ';1';
      svg.appendChild(pop(nodes[i][0], nodes[i][1], D, kt, [
        svgEl('circle', { r: 15, fill: BG, stroke: nodes[i][3] === BP ? BP : RULE, 'stroke-width': nodes[i][3] === BP ? '2' : '1.4' }),
        txt(0, 3, nodes[i][2], nodes[i][3], 8)
      ]));
    }
    svg.appendChild(txt(268, 152, 'hop 1', MUTE, 7));
    svg.appendChild(txt(448, 150, 'hop 2', MUTE, 7));
    var f1 = svgEl('path', { d: 'M97 200 V 216 H 180', fill: 'none', stroke: RULE, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    f1.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.56;0.62;1' }));
    svg.appendChild(f1);
    var f2 = svgEl('path', { d: 'M390 200 V 216 H 344', fill: 'none', stroke: RULE, 'stroke-width': '1.4', 'stroke-dasharray': '5 4' });
    f2.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.56;0.62;1' }));
    svg.appendChild(f2);
    svg.appendChild(pop(262, 227, D, '0;0.64;0.76;1', [
      svgEl('rect', { x: -110, y: -13, width: 220, height: 26, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.8' }),
      txt(0, 4, 'ranked: p007 p003 p019 p015 p011 p021', BP, 7)
    ]));
    var dd = txt(384, 231, 'p007 kept once', SOFT, 8, 'start');
    dd.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: '0;0.78;0.86;1' }));
    svg.appendChild(dd);
    card(host, 'LITERATURE RETRIEVAL', 'BM25 + citation walk',
      svg,
      'BM25 over abstracts returns the papers that share vocabulary with the query, and misses the foundational work that named the idea differently. The second pass starts from a known anchor and walks the citation graph a hop or two in each direction, surfacing follow-ups no keyword would catch. The two hit sets union, deduplicate on stable paper id, and rank, so the anchor that appeared in both passes is counted once.');
  }

  // ── 52: experiment runner — two meters on the child, one kill path ─────────
  function runnerLimits(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '6s';
    svg.appendChild(txt(260, 16, 'run A completes · run B trips the cap', MUTE, 10));
    var spec = svgEl('g', {});
    spec.appendChild(svgEl('rect', { x: 28, y: 96, width: 100, height: 40, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    spec.appendChild(txt(78, 112, 'ExperimentSpec', BP, 8));
    spec.appendChild(txt(78, 126, 'seed 1234', MUTE, 7));
    spec.appendChild(animT('translate', '-24 0;0 0;0 0', D, { keyTimes: '0;0.08;1', calcMode: 'spline', keySplines: SPL + ';' + SPL }));
    spec.appendChild(anim('opacity', '0;1;1', D, { keyTimes: '0;0.08;1' }));
    svg.appendChild(spec);
    svg.appendChild(svgEl('rect', { x: 190, y: 80, width: 150, height: 80, rx: 6, fill: BG, stroke: BP, 'stroke-width': '1.8' }));
    svg.appendChild(txt(265, 108, 'subprocess', BP, 10));
    svg.appendChild(txt(265, 122, 'own address space', MUTE, 7));
    svg.appendChild(txt(190, 54, 'wall clock', MUTE, 7, 'start'));
    svg.appendChild(svgEl('rect', { x: 190, y: 60, width: 150, height: 10, rx: 2, fill: 'none', stroke: MUTE, 'stroke-width': '1.2' }));
    var clk = svgEl('rect', { x: 191, y: 61, width: 0, height: 8, rx: 2, fill: BP, opacity: '0.6' });
    clk.appendChild(anim('width', '0;0;100;100;0;0;120;120', D, { keyTimes: '0;0.06;0.36;0.44;0.5;0.52;0.82;1' }));
    svg.appendChild(clk);
    svg.appendChild(svgEl('rect', { x: 352, y: 80, width: 12, height: 80, rx: 2, fill: 'none', stroke: MUTE, 'stroke-width': '1.2' }));
    var mem = svgEl('rect', { x: 353, y: 160, width: 10, height: 0, fill: WARN, opacity: '0.55' });
    mem.appendChild(anim('height', '0;0;24;24;0;0;76;76', D, { keyTimes: '0;0.06;0.36;0.44;0.5;0.52;0.82;1' }));
    mem.appendChild(anim('y', '160;160;136;136;160;160;84;84', D, { keyTimes: '0;0.06;0.36;0.44;0.5;0.52;0.82;1' }));
    svg.appendChild(mem);
    svg.appendChild(svgEl('line', { x1: 348, y1: 104, x2: 370, y2: 104, stroke: WARN, 'stroke-width': '1.6', 'stroke-dasharray': '3 3' }));
    svg.appendChild(txt(374, 107, 'mem cap', MUTE, 7, 'start'));
    var kill = txt(265, 144, 'SIGKILL · mem cap', WARN, 9);
    kill.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.8;0.84;0.94;0.98;1' }));
    svg.appendChild(kill);
    var blob = svgEl('g', { transform: 'translate(432 100)' });
    var bi = svgEl('g', {}, [
      svgEl('rect', { x: -44, y: -16, width: 88, height: 32, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.6', 'stroke-dasharray': '5 4' }),
      txt(0, -2, 'metrics blob', BP, 8),
      txt(0, 11, '{"ppl": 31.4}', SOFT, 7)
    ]);
    bi.appendChild(anim('opacity', '0;0;1;1;0;0', D, { keyTimes: '0;0.36;0.44;0.52;0.58;1' }));
    bi.appendChild(animT('scale', '0.95;0.95;1;1;1;1', D, { keyTimes: '0;0.36;0.44;0.52;0.58;1', calcMode: 'spline', keySplines: SPL3 + ';' + SPL + ';' + SPL }));
    blob.appendChild(bi);
    svg.appendChild(blob);
    svg.appendChild(pop(212, 209, D, '0;0.4;0.5;1', [
      svgEl('rect', { x: -62, y: -13, width: 124, height: 26, rx: 4, fill: BG, stroke: BP, 'stroke-width': '1.6' }),
      txt(0, 4, 'exp_001 · ok · 3.1s', BP, 8)
    ]));
    svg.appendChild(pop(360, 209, D, '0;0.86;0.96;1', [
      svgEl('rect', { x: -62, y: -13, width: 124, height: 26, rx: 4, fill: BG, stroke: WARN, 'stroke-width': '1.6' }),
      txt(0, 4, 'exp_002 · oom-kill', WARN, 8)
    ]));
    svg.appendChild(txt(142, 213, 'results', MUTE, 8, 'end'));
    card(host, 'EXPERIMENT RUNNER', 'timeout · mem cap · blob',
      svg,
      'The runner serialises the spec to a child process and watches two meters: a hard wall-clock timeout and a polled memory cap. Run A stays under both, exits cleanly, and its stdout carries a structured metrics blob into the result record. Run B grows past the cap and takes the kill path; the record says oom instead of pretending a number exists. Same seed, same spec, same numbers on every rerun.');
  }

  // ── 53: result evaluator — per-seed differences carry the verdict ──────────
  function pairedVerdict(host) {
    var svg = svgEl('svg', { viewBox: '0 0 520 250' });
    var D = '5s';
    svg.appendChild(txt(260, 16, 'pair each seed with itself · test the differences', MUTE, 10));
    var baseH = [64, 58, 70, 61], candH = [52, 49, 60, 50], i;
    for (i = 0; i < 4; i++) {
      var x = 44 + i * 58, kt = '0;' + (0.06 + i * 0.05).toFixed(2) + ';' + (0.22 + i * 0.05).toFixed(2) + ';1';
      var b = svgEl('rect', { x: x, y: 170, width: 14, height: 0, fill: MUTE, opacity: '0.55' });
      b.appendChild(anim('height', '0;0;' + baseH[i] + ';' + baseH[i], D, { keyTimes: kt, calcMode: 'spline', keySplines: SPL3 }));
      b.appendChild(anim('y', '170;170;' + (170 - baseH[i]) + ';' + (170 - baseH[i]), D, { keyTimes: kt, calcMode: 'spline', keySplines: SPL3 }));
      svg.appendChild(b);
      var c = svgEl('rect', { x: x + 17, y: 170, width: 14, height: 0, fill: BP, opacity: '0.75' });
      c.appendChild(anim('height', '0;0;' + candH[i] + ';' + candH[i], D, { keyTimes: kt, calcMode: 'spline', keySplines: SPL3 }));
      c.appendChild(anim('y', '170;170;' + (170 - candH[i]) + ';' + (170 - candH[i]), D, { keyTimes: kt, calcMode: 'spline', keySplines: SPL3 }));
      svg.appendChild(c);
      svg.appendChild(txt(x + 15, 184, 's' + i, MUTE, 8));
    }
    svg.appendChild(txt(60, 200, 'grey base · blue candidate ppl', MUTE, 7, 'start'));
    svg.appendChild(svgEl('line', { x1: 300, y1: 150, x2: 494, y2: 150, stroke: SOFT, 'stroke-width': '1.4' }));
    svg.appendChild(svgEl('line', { x1: 330, y1: 144, x2: 330, y2: 156, stroke: SOFT, 'stroke-width': '1.4' }));
    svg.appendChild(txt(330, 168, '0', MUTE, 8));
    svg.appendChild(txt(494, 168, 'Δ ppl', MUTE, 7, 'end'));
    var band = svgEl('rect', { x: 316, y: 122, width: 28, height: 44, fill: WARN });
    band.appendChild(anim('opacity', '0;0;0.15;0.15', D, { keyTimes: '0;0.58;0.68;1' }));
    svg.appendChild(band);
    svg.appendChild(txt(330, 116, 'noise floor', MUTE, 7));
    var dxv = [426, 402, 410, 418], dyv = [144, 136, 140, 132];
    for (i = 0; i < 4; i++) {
      var dot = svgEl('circle', { r: 4, fill: BP });
      var kt2 = '0;' + (0.3 + i * 0.06).toFixed(2) + ';' + (0.45 + i * 0.06).toFixed(2) + ';1';
      dot.appendChild(anim('cx', (61 + i * 58) + ';' + (61 + i * 58) + ';' + dxv[i] + ';' + dxv[i], D, { keyTimes: kt2, calcMode: 'spline', keySplines: SPL3 }));
      dot.appendChild(anim('cy', (166 - candH[i]) + ';' + (166 - candH[i]) + ';' + dyv[i] + ';' + dyv[i], D, { keyTimes: kt2, calcMode: 'spline', keySplines: SPL3 }));
      dot.appendChild(anim('opacity', '0;0;1;1', D, { keyTimes: kt2 }));
      svg.appendChild(dot);
    }
    svg.appendChild(pop(414, 122, D, '0;0.68;0.78;1', [
      svgEl('polygon', { points: '0,-6 6,0 0,6 -6,0', fill: BP }),
      txt(0, -12, 'mean Δ', BP, 8)
    ]));
    svg.appendChild(pop(396, 216, D, '0;0.8;0.9;1', [
      svgEl('rect', { x: -100, y: -15, width: 200, height: 30, rx: 5, fill: BG, stroke: BP, 'stroke-width': '2' }),
      txt(0, 4, 'improvement · t 5.9 · p < 0.01', BP, 9)
    ]));
    card(host, 'RESULT EVALUATOR', 'paired diffs · t test · verdict',
      svg,
      'One run per configuration proves nothing; the same spec with a new seed lands on a different number. The evaluator pairs each seed with itself, candidate against baseline, and lets the per-seed differences testify. Their mean is the effect, their spread is the noise floor, and a from-scratch paired t test says whether the mean stands clear of it. The verdict attaches back to the hypothesis queue, and identical inputs always produce the identical verdict.');
  }

  LF.register({
    'cg-plan-replan': planReplan,
    'cg-gate-chain': gateChain,
    'cg-path-jail': pathJail,
    'cg-harness-weave': harnessWeave,
    'cg-eval-quadrant': evalQuadrant,
    'cg-allreduce-ring': allreduceRing,
    'cg-novelty-ramp': noveltyRamp,
    'cg-citation-hops': citationHops,
    'cg-runner-limits': runnerLimits,
    'cg-paired-verdict': pairedVerdict
  });
})();
