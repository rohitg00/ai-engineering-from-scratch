/* figures-re-42.js - lesson 42: one debugger run as a timeline of stops, and the static claim each stop confirms or refutes.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every stop, register, memory word, and verdict below comes from the lldb transcripts
   captured over account-O0 and account-O2. The test suite checks that this copy matches. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)';
  var MUTE = 'var(--ink-mute,#7a7a78)';
  var BP = 'var(--blueprint,#3553ff)';
  var SURF = 'var(--bg-surface,#f3f1e8)';
  var RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';
  var WARN = 'var(--warn,#b8870f)';
  var BAD = 'var(--danger,#b42318)';
  var BG = 'var(--bg,#fafaf5)';
  var MONO = 'var(--font-mono,monospace)';

  var DATA = {"program":"account.c","struct":{"name":"account","size":32,"offsets":{"kind":0,"balance":4,"code":8,"rate":16,"label":24}},"claimOrder":["arg-registers","field-offsets","branch-1","branch-2","calls","store-once","stride","output"],"variants":{"O0":{"binary":"account-O0","stops":[{"i":0,"pc":"0x1000004bc","fn":"bump","line":13,"kind":"entry","reason":"breakpoint 1.1","regs":{"x0":"0x16fdfe008","x1":"0x5"},"words":["00000073","000000fa","00000009","00000000","00000000","3ff40000","00000719","00000001"],"args":{"a":"0x000000016fdfe008","by":"5"},"balance":250,"watch":null,"claims":{"arg-registers":"confirmed","field-offsets":"confirmed"}},{"i":1,"pc":"0x1000004d0","fn":"bump","line":14,"kind":"watchpoint","reason":"watchpoint 1","regs":{"x0":"0x16fdfe008","x1":"0x5"},"words":["00000073","000000ff","00000009","00000000","00000000","3ff40000","00000719","00000001"],"args":{"a":"0x000000016fdfe008","by":"5"},"balance":255,"watch":[250,255],"claims":{"field-offsets":"confirmed","store-once":"confirmed"}},{"i":2,"pc":"0x1000004e8","fn":"classify","line":18,"kind":"entry","reason":"breakpoint 2.1","regs":{"x0":"0x16fdfdfe8","x1":"0x5"},"words":["00000063","00000064","00000007","00000000","00000000","3fe00000","00000714","00000001"],"args":{"a":"0x000000016fdfdfe8"},"balance":100,"watch":null,"claims":{"arg-registers":"confirmed","field-offsets":"confirmed"}},{"i":3,"pc":"0x100000504","fn":"classify","line":19,"kind":"edge","reason":"breakpoint 4.1","regs":{"x0":"0x16fdfdfe8","x1":"0x5"},"words":["00000063","00000064","00000007","00000000","00000000","3fe00000","00000714","00000001"],"args":{"a":"0x000000016fdfdfe8"},"balance":100,"watch":null,"claims":{"field-offsets":"confirmed","branch-1":"confirmed"}},{"i":4,"pc":"0x100000524","fn":"classify","line":20,"kind":"edge","reason":"breakpoint 6.1","regs":{"x0":"0x16fdfdfe8","x1":"0x5"},"words":["00000063","00000064","00000007","00000000","00000000","3fe00000","00000714","00000001"],"args":{"a":"0x000000016fdfdfe8"},"balance":100,"watch":null,"claims":{"field-offsets":"confirmed","branch-2":"confirmed"}},{"i":5,"pc":"0x1000004e8","fn":"classify","line":18,"kind":"entry","reason":"breakpoint 2.1","regs":{"x0":"0x16fdfe008","x1":"0x5"},"words":["00000073","000000ff","00000009","00000000","00000000","3ff40000","00000719","00000001"],"args":{"a":"0x000000016fdfe008"},"balance":255,"watch":null,"claims":{"arg-registers":"confirmed","field-offsets":"confirmed"}},{"i":6,"pc":"0x100000504","fn":"classify","line":19,"kind":"edge","reason":"breakpoint 4.1","regs":{"x0":"0x16fdfe008","x1":"0x5"},"words":["00000073","000000ff","00000009","00000000","00000000","3ff40000","00000719","00000001"],"args":{"a":"0x000000016fdfe008"},"balance":255,"watch":null,"claims":{"field-offsets":"confirmed","branch-1":"confirmed"}},{"i":7,"pc":"0x100000514","fn":"classify","line":19,"kind":"edge","reason":"breakpoint 7.1","regs":{"x0":"0x16fdfe008","x1":"0x5"},"words":["00000073","000000ff","00000009","00000000","00000000","3ff40000","00000719","00000001"],"args":{"a":"0x000000016fdfe008"},"balance":255,"watch":null,"claims":{"field-offsets":"confirmed","branch-2":"confirmed"}},{"i":8,"pc":"0x1000004e8","fn":"classify","line":18,"kind":"entry","reason":"breakpoint 2.1","regs":{"x0":"0x16fdfe028","x1":"0x5"},"words":["0000006c","ffffffd8","00000003","00000000","00000000","40000000","00000721","00000001"],"args":{"a":"0x000000016fdfe028"},"balance":-40,"watch":null,"claims":{"arg-registers":"confirmed","field-offsets":"confirmed"}},{"i":9,"pc":"0x1000004f4","fn":"classify","line":18,"kind":"edge","reason":"breakpoint 5.1","regs":{"x0":"0x16fdfe028","x1":"0x5"},"words":["0000006c","ffffffd8","00000003","00000000","00000000","40000000","00000721","00000001"],"args":{"a":"0x000000016fdfe028"},"balance":-40,"watch":null,"claims":{"field-offsets":"confirmed","branch-1":"confirmed"}},{"i":10,"pc":"0x100000544","fn":"sum_balances","line":24,"kind":"entry","reason":"breakpoint 3.1","regs":{"x0":"0x16fdfdfe8","x1":"0x3"},"words":["00000063","00000064","00000007","00000000","00000000","3fe00000","00000714","00000001"],"args":{"list":"0x000000016fdfdfe8","count":"3"},"balance":100,"watch":null,"claims":{"arg-registers":"confirmed","field-offsets":"confirmed","stride":"confirmed"}}],"exit":0,"hits":[{"bp":1,"spec":"name=bump","hits":1},{"bp":2,"spec":"name=classify","hits":3},{"bp":3,"spec":"name=sum_balances","hits":1},{"bp":4,"spec":"address=0x0000000100000504","hits":2},{"bp":5,"spec":"address=0x00000001000004f4","hits":1},{"bp":6,"spec":"address=0x0000000100000524","hits":1},{"bp":7,"spec":"address=0x0000000100000514","hits":1}],"claims":[{"id":"arg-registers","kind":"argument-register","statement":"At every function entry the first arguments arrive in x0 and x1 (AAPCS64 section 6.4.2).","confirmed":5,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"field-offsets","kind":"field-offset","statement":"struct account is 32 bytes with kind at 0, balance at 4, code at 8, rate at 16, label at 24 (DW_AT_data_member_location).","confirmed":11,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"branch-1","kind":"branch-taken","statement":"In classify the branch tbz w8, #0x1f, 0x100000504 at 0x1000004f0 goes to 0x100000504 when a->balance >= 0, otherwise to 0x1000004f4.","confirmed":3,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"branch-2","kind":"branch-taken","statement":"In classify the branch b.le 0x100000524 at 0x100000510 goes to 0x100000524 when a->balance <= 200, otherwise to 0x100000514.","confirmed":2,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"calls","kind":"call-edge","statement":"main calls bump 1 time, classify 3 times, sum_balances 1 time, as the source says and the symbol table lists.","confirmed":1,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"store-once","kind":"store","statement":"bump writes a->balance exactly once and the new value is the old value plus by.","confirmed":1,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"stride","kind":"struct-stride","statement":"sizeof(struct account) is 32, so list[i].balance sits at list + 32*i + 4.","confirmed":1,"refuted":0,"not-observed":0,"verdict":"confirmed"},{"id":"output","kind":"behaviour","statement":"The program prints class 0 1 -1 / sum 315.","confirmed":1,"refuted":0,"not-observed":0,"verdict":"confirmed"}],"runLevel":[{"claim":"calls","verdict":"confirmed","stop":null,"observation":"entry stops bump 1 (hit count 1), classify 3 (hit count 3), sum_balances 1 (hit count 1)"},{"claim":"output","verdict":"confirmed","stop":null,"observation":"stdout ['sizeof 32 align 8', 'offsets 0 4 8 16 24', 'class 0 1 -1', 'sum 315'], exit status 0"}],"output":["sizeof 32 align 8","offsets 0 4 8 16 24","class 0 1 -1","sum 315"]},"O2":{"binary":"account-O2","stops":[],"exit":0,"hits":[{"bp":1,"spec":"name=bump","hits":0},{"bp":2,"spec":"name=classify","hits":0},{"bp":3,"spec":"name=sum_balances","hits":0}],"claims":[{"id":"arg-registers","kind":"argument-register","statement":"At every function entry the first arguments arrive in x0 and x1 (AAPCS64 section 6.4.2).","confirmed":0,"refuted":0,"not-observed":1,"verdict":"not-observed"},{"id":"field-offsets","kind":"field-offset","statement":"struct account is 32 bytes with kind at 0, balance at 4, code at 8, rate at 16, label at 24 (DW_AT_data_member_location).","confirmed":0,"refuted":0,"not-observed":1,"verdict":"not-observed"},{"id":"calls","kind":"call-edge","statement":"main calls bump 1 time, classify 3 times, sum_balances 1 time, as the source says and the symbol table lists.","confirmed":0,"refuted":1,"not-observed":0,"verdict":"refuted"},{"id":"store-once","kind":"store","statement":"bump writes a->balance exactly once and the new value is the old value plus by.","confirmed":0,"refuted":0,"not-observed":1,"verdict":"not-observed"},{"id":"stride","kind":"struct-stride","statement":"sizeof(struct account) is 32, so list[i].balance sits at list + 32*i + 4.","confirmed":0,"refuted":0,"not-observed":1,"verdict":"not-observed"},{"id":"output","kind":"behaviour","statement":"The program prints class 0 1 -1 / sum 315.","confirmed":1,"refuted":0,"not-observed":0,"verdict":"confirmed"}],"runLevel":[{"claim":"calls","verdict":"refuted","stop":null,"observation":"after a full run with exit status 0: entry stops bump 0 (hit count 0), classify 0 (hit count 0), sum_balances 0 (hit count 0)"},{"claim":"store-once","verdict":"not-observed","stop":null,"observation":"no stop in bump, so the watchpoint was never set; watchpoint set failed: Command requires a process which is currently stopped."},{"claim":"stride","verdict":"not-observed","stop":null,"observation":"no stop in sum_balances"},{"claim":"output","verdict":"confirmed","stop":null,"observation":"stdout ['sizeof 32 align 8', 'offsets 0 4 8 16 24', 'class 0 1 -1', 'sum 315'], exit status 0"},{"claim":"arg-registers","verdict":"not-observed","stop":null,"observation":"no stop tested it; breakpoint hit counts {'bump': 0, 'classify': 0, 'sum_balances': 0}"},{"claim":"field-offsets","verdict":"not-observed","stop":null,"observation":"no stop tested it; breakpoint hit counts {'bump': 0, 'classify': 0, 'sum_balances': 0}"}],"output":["sizeof 32 align 8","offsets 0 4 8 16 24","class 0 1 -1","sum 315"]}}};

  var BUILDS = [
    { id: 'O0', label: 'account-O0 (clang -g -O0)' },
    { id: 'O2', label: 'account-O2 (clang -g -O2)' }
  ];

  var W = 600;
  var LABEL_W = 112;
  var VERDICT_W = 124;
  var TOP = 18;
  var LINE_Y = 72;
  var GRID_Y = 118;
  var ROW_H = 22;
  var MIN_COL = 30;
  var MAX_COL = 44;

  function ensureStyles() {
    if (document.getElementById('re42-styles')) return;
    var style = document.createElement('style');
    style.id = 're42-styles';
    style.textContent = [
      '.re42 *{box-sizing:border-box}',
      '.re42__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re42__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re42__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re42__row{display:flex;flex-wrap:wrap;gap:8px}',
      '.re42 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re42 button:active{transform:scale(.96)}',
      '.re42 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re42 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re42 button[disabled]{opacity:.45;cursor:default}',
      '.re42__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re42__scroll svg{display:block;min-width:540px;width:100%;height:auto}',
      '.re42__detail{margin-top:10px;font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.5;color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word}',
      '.re42__verdict{margin-top:8px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re42__verdict[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '.re42__verdict[data-tone="bad"]{border-color:var(--danger,#b42318)}',
      '@media (hover:hover) and (pointer:fine){.re42 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re42__row--builds{display:grid;grid-template-columns:1fr}.re42 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re42 button{transition:none!important}.re42 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function text(x, y, s, fill, anchor, size, weight) {
    var attrs = {
      x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO,
      'font-size': String(size || 11.5), fill: fill || INK
    };
    if (weight) attrs['font-weight'] = weight;
    return svgEl('text', attrs, [document.createTextNode(s)]);
  }

  function variant(id) { return DATA.variants[id]; }

  function columns(id) {
    var stops = variant(id).stops;
    var cols = [];
    var i;
    for (i = 0; i < stops.length; i++) cols.push({ kind: stops[i].kind, stop: stops[i], label: String(i) });
    cols.push({ kind: 'exit', stop: null, label: 'exit' });
    return cols;
  }

  function runLevel(id) {
    var records = variant(id).runLevel;
    var map = {};
    var i;
    for (i = 0; i < records.length; i++) map[records[i].claim] = records[i].verdict;
    return map;
  }

  function cellVerdict(id, column, claim) {
    if (column.kind === 'exit') return runLevel(id)[claim] || null;
    return column.stop.claims[claim] || null;
  }

  function summarize(id, step) {
    var cols = columns(id);
    var shown = cols.slice(0, step);
    var order = DATA.claimOrder;
    var byClaim = {};
    var i, j, c;
    for (i = 0; i < order.length; i++) byClaim[order[i]] = { confirmed: 0, refuted: 0, notObserved: 0, present: false };
    var present = variant(id).claims;
    for (i = 0; i < present.length; i++) byClaim[present[i].id].present = true;
    for (j = 0; j < shown.length; j++) {
      for (i = 0; i < order.length; i++) {
        c = cellVerdict(id, shown[j], order[i]);
        if (c === 'confirmed') byClaim[order[i]].confirmed++;
        else if (c === 'refuted') byClaim[order[i]].refuted++;
        else if (c === 'not-observed') byClaim[order[i]].notObserved++;
      }
    }
    var atExit = step >= cols.length;
    var totals = { confirmed: 0, refuted: 0, notObserved: 0, pending: 0, absent: 0 };
    for (i = 0; i < order.length; i++) {
      var entry = byClaim[order[i]];
      if (!entry.present) { entry.verdict = 'absent'; totals.absent++; }
      else if (entry.refuted) { entry.verdict = 'refuted'; totals.refuted++; }
      else if (entry.confirmed) { entry.verdict = 'confirmed'; totals.confirmed++; }
      else if (atExit) { entry.verdict = 'not-observed'; totals.notObserved++; }
      else { entry.verdict = 'pending'; totals.pending++; }
    }
    return { columns: cols, shown: shown, step: Math.min(step, cols.length), total: cols.length, atExit: atExit, byClaim: byClaim, totals: totals, current: step > 0 ? cols[Math.min(step, cols.length) - 1] : null };
  }

  function layout(id) {
    var count = columns(id).length;
    var col = Math.max(MIN_COL, Math.min(MAX_COL, Math.floor((W - LABEL_W - VERDICT_W - 16) / count)));
    return { col: col, x0: LABEL_W + 8, height: GRID_Y + DATA.claimOrder.length * ROW_H + 44 };
  }

  function markerFor(kind, cx, cy, active) {
    var fill = active ? (kind === 'watchpoint' ? WARN : BP) : BG;
    var stroke = kind === 'watchpoint' ? WARN : BP;
    if (kind === 'exit') return svgEl('circle', { cx: cx, cy: cy, r: 6, fill: active ? SURF : BG, stroke: active ? INK : RULE, 'stroke-width': '1.5' });
    if (kind === 'watchpoint') return svgEl('rect', { x: cx - 5.5, y: cy - 5.5, width: 11, height: 11, fill: fill, stroke: stroke, 'stroke-width': '1.5' });
    if (kind === 'edge') return svgEl('path', { d: 'M' + cx + ' ' + (cy - 7) + 'L' + (cx + 7) + ' ' + cy + 'L' + cx + ' ' + (cy + 7) + 'L' + (cx - 7) + ' ' + cy + 'Z', fill: fill, stroke: stroke, 'stroke-width': '1.5' });
    return svgEl('circle', { cx: cx, cy: cy, r: 6.5, fill: fill, stroke: stroke, 'stroke-width': '1.5' });
  }

  function drawTimeline(svg, id, summary, lay) {
    var cols = summary.columns;
    var i;
    var left = lay.x0;
    var right = lay.x0 + (cols.length - 1) * lay.col;
    svg.appendChild(text(8, TOP, 'run of ' + variant(id).binary, INK, 'start', 12, '600'));
    svg.appendChild(text(8, LINE_Y + 4, 'launch', MUTE, 'start', 11));
    svg.appendChild(svgEl('line', { x1: left - 18, y1: LINE_Y, x2: right + 10, y2: LINE_Y, stroke: RULE, 'stroke-width': '1.5' }));
    if (summary.step > 0) {
      var reachX = summary.step >= cols.length ? right : lay.x0 + (summary.step - 1) * lay.col;
      svg.appendChild(svgEl('line', { x1: left - 18, y1: LINE_Y, x2: reachX, y2: LINE_Y, stroke: BP, 'stroke-width': '2' }));
    }
    var groups = [];
    for (i = 0; i < cols.length; i++) {
      var fn = cols[i].stop ? cols[i].stop.fn : 'exit ' + variant(id).exit;
      if (!groups.length || groups[groups.length - 1].fn !== fn) groups.push({ fn: fn, from: i, to: i });
      else groups[groups.length - 1].to = i;
    }
    for (i = 0; i < groups.length; i++) {
      var gx1 = lay.x0 + groups[i].from * lay.col - lay.col / 2 + 4;
      var gx2 = lay.x0 + groups[i].to * lay.col + lay.col / 2 - 4;
      var mid = (gx1 + gx2) / 2;
      var active = summary.step > groups[i].from;
      var lift = (i % 2) * 16;
      svg.appendChild(svgEl('path', { d: 'M' + gx1.toFixed(1) + ' ' + (LINE_Y - 22 - lift) + 'V' + (LINE_Y - 26 - lift) + 'H' + gx2.toFixed(1) + 'V' + (LINE_Y - 22 - lift), fill: 'none', stroke: active ? INK : RULE, 'stroke-width': '1' }));
      svg.appendChild(text(mid, LINE_Y - 30 - lift, groups[i].fn, active ? INK : MUTE, 'middle', 10.5));
    }
    for (i = 0; i < cols.length; i++) {
      var cx = lay.x0 + i * lay.col;
      var isShown = i < summary.step;
      var isCurrent = summary.current && summary.step - 1 === i;
      svg.appendChild(markerFor(cols[i].kind, cx, LINE_Y, isShown));
      if (isCurrent) svg.appendChild(svgEl('circle', { cx: cx, cy: LINE_Y, r: 11, fill: 'none', stroke: INK, 'stroke-width': '1', 'stroke-dasharray': '2 2' }));
      svg.appendChild(text(cx, LINE_Y + 22, cols[i].label, isShown ? INK : MUTE, 'middle', 10.5));
    }
  }

  function glyphFor(verdict) {
    if (verdict === 'confirmed') return { s: '✓', c: BP };
    if (verdict === 'refuted') return { s: '✗', c: BAD };
    if (verdict === 'not-observed') return { s: '?', c: WARN };
    return null;
  }

  function drawGrid(svg, id, summary, lay) {
    var order = DATA.claimOrder;
    var cols = summary.columns;
    var i, j;
    svg.appendChild(text(8, GRID_Y - 8, 'claim', MUTE, 'start', 10.5));
    svg.appendChild(text(lay.x0, GRID_Y - 8, 'stop', MUTE, 'middle', 10.5));
    svg.appendChild(text(W - 8, GRID_Y - 8, 'verdict so far', MUTE, 'end', 10.5));
    for (i = 0; i < order.length; i++) {
      var y = GRID_Y + i * ROW_H;
      var entry = summary.byClaim[order[i]];
      var rowColor = entry.present ? INK : MUTE;
      svg.appendChild(svgEl('line', { x1: 8, y1: y + ROW_H - 4, x2: W - 8, y2: y + ROW_H - 4, stroke: RULE, 'stroke-width': '0.6' }));
      svg.appendChild(text(8, y + 12, order[i], rowColor, 'start', 11));
      for (j = 0; j < cols.length; j++) {
        var cx = lay.x0 + j * lay.col;
        var shown = j < summary.step;
        var verdict = shown ? cellVerdict(id, cols[j], order[i]) : null;
        var glyph = glyphFor(verdict);
        if (glyph) svg.appendChild(text(cx, y + 13, glyph.s, glyph.c, 'middle', 13, '600'));
        else svg.appendChild(svgEl('circle', { cx: cx, cy: y + 9, r: 1.2, fill: shown ? RULE : 'none', stroke: shown ? 'none' : RULE, 'stroke-width': '0.6' }));
      }
      var verdictText;
      var verdictColor = MUTE;
      if (!entry.present) verdictText = 'no edge in this build';
      else if (entry.verdict === 'pending') verdictText = 'pending';
      else {
        verdictText = entry.verdict;
        if (entry.confirmed || entry.refuted) verdictText += ' (' + entry.confirmed + '/' + entry.refuted + ')';
        verdictColor = entry.verdict === 'refuted' ? BAD : entry.verdict === 'confirmed' ? BP : WARN;
      }
      svg.appendChild(text(W - 8, y + 12, verdictText, verdictColor, 'end', 10.5));
    }
    var legendY = GRID_Y + order.length * ROW_H + 14;
    svg.appendChild(text(8, legendY, '✓ confirmed here   ✗ refuted here   ? never observed by the finished run   · not tested at this stop', MUTE, 'start', 9.5));
    svg.appendChild(text(8, legendY + 14, 'circle: entry breakpoint   diamond: branch successor   square: watchpoint   open circle: exit', MUTE, 'start', 9.5));
  }

  function detailText(id, summary) {
    var current = summary.current;
    if (!current) return 'step 0 of ' + summary.total + ': press step to run to the first stop';
    if (current.kind === 'exit') {
      var v = variant(id);
      var lines = ['exit: status ' + v.exit + ', stdout: ' + v.output.join(' | ')];
      var hits = v.hits.map(function (h) { return h.spec.replace('name=', '').replace('address=0x00000001', '0x1') + ' hit ' + h.hits; });
      lines.push('breakpoint hit counts: ' + hits.join(', '));
      var i;
      for (i = 0; i < v.runLevel.length; i++) lines.push(v.runLevel[i].claim + ': ' + v.runLevel[i].verdict + ', ' + v.runLevel[i].observation);
      return lines.join('\n');
    }
    var s = current.stop;
    var out = ['stop ' + s.i + ': ' + s.pc + ' ' + s.fn + ' line ' + s.line + ', ' + s.reason + ' (' + s.kind + ')'];
    var regs = [];
    var k;
    for (k in s.regs) if (Object.prototype.hasOwnProperty.call(s.regs, k)) regs.push(k + ' = ' + s.regs[k]);
    var args = [];
    for (k in s.args) if (Object.prototype.hasOwnProperty.call(s.args, k)) args.push(k + ' = ' + s.args[k]);
    out.push('registers: ' + regs.join(', ') + '   arguments: ' + args.join(', '));
    out.push('words at ' + (s.regs.x0 || '?') + ': ' + s.words.join(' '));
    if (s.balance !== null) out.push('a->balance = ' + s.balance);
    if (s.watch) out.push('watchpoint: old ' + s.watch[0] + ', new ' + s.watch[1]);
    var claims = [];
    for (k in s.claims) if (Object.prototype.hasOwnProperty.call(s.claims, k)) claims.push(k + ' ' + s.claims[k]);
    out.push('claims at this stop: ' + (claims.length ? claims.join(', ') : 'none'));
    return out.join('\n');
  }

  function verdictText(id, summary) {
    var t = summary.totals;
    var head = variant(id).binary + ', ' + (summary.atExit ? 'run finished' : 'after stop ' + summary.step + ' of ' + (summary.total - 1)) + ': ';
    var parts = [t.confirmed + ' confirmed', t.refuted + ' refuted'];
    if (summary.atExit) parts.push(t.notObserved + ' not observed'); else parts.push(t.pending + ' pending');
    if (t.absent) parts.push(t.absent + ' with no edge in this build');
    return head + parts.join(', ') + '.';
  }

  function runTimeline(host) {
    ensureStyles();
    var state = { build: 'O0', step: columns('O0').length };
    var titleId = LF.uid('lf-re42-title');
    var descId = LF.uid('lf-re42-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + layout('O0').height, role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var detail = el('div', { class: 're42__detail' });
    var verdict = el('div', { class: 're42__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var buildButtons = [];
    var stepButton = el('button', { type: 'button' }, ['step']);
    var runButton = el('button', { type: 'button' }, ['run to exit']);
    var resetButton = el('button', { type: 'button' }, ['reset']);

    function setDisabled(button, disabled) {
      if (disabled) button.setAttribute('disabled', 'disabled'); else button.removeAttribute('disabled');
    }

    function render() {
      var summary = summarize(state.build, state.step);
      var lay = layout(state.build);
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + lay.height);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Timeline of one lldb run with the static claim each stop confirms or refutes')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(verdictText(state.build, summary))]));
      drawTimeline(svg, state.build, summary, lay);
      drawGrid(svg, state.build, summary, lay);
      for (i = 0; i < buildButtons.length; i++) buildButtons[i].button.setAttribute('aria-pressed', buildButtons[i].id === state.build ? 'true' : 'false');
      setDisabled(stepButton, summary.atExit);
      setDisabled(runButton, summary.atExit);
      setDisabled(resetButton, state.step === 0);
      detail.textContent = detailText(state.build, summary);
      verdict.textContent = verdictText(state.build, summary);
      verdict.setAttribute('data-tone', summary.totals.refuted ? 'bad' : (summary.atExit && summary.totals.notObserved ? 'warn' : 'pass'));
    }

    var buildRow = el('div', { class: 're42__row re42__row--builds', role: 'group', 'aria-label': 'Build under the debugger' });
    BUILDS.forEach(function (build) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [build.label]);
      button.addEventListener('click', function () {
        state.build = build.id;
        state.step = columns(build.id).length;
        render();
      });
      buildButtons.push({ id: build.id, button: button });
      buildRow.appendChild(button);
    });
    stepButton.addEventListener('click', function () { state.step = Math.min(state.step + 1, columns(state.build).length); render(); });
    runButton.addEventListener('click', function () { state.step = columns(state.build).length; render(); });
    resetButton.addEventListener('click', function () { state.step = 0; render(); });

    var controls = el('div', { class: 're42__controls' }, [
      el('div', {}, [el('div', { class: 're42__group-label' }, ['build']), buildRow]),
      el('div', {}, [el('div', { class: 're42__group-label' }, ['stepper']), el('div', { class: 're42__row' }, [stepButton, runButton, resetButton])])
    ]);

    host.appendChild(el('div', { class: 'lf re42' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['RUN TIMELINE']), el('span', {}, ['account.c under lldb, ' + DATA.claimOrder.length + ' static claims'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're42__note' }, ['Pick a build, press reset, then step. Each step is one stop of the saved lldb session: a function entry, a branch successor, or the watchpoint. The grid marks the static claims that stop confirmed or refuted, and the exit column holds the verdicts that need the whole run.']),
        controls,
        el('div', { class: 're42__scroll' }, [svg]),
        detail,
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Circles are function-entry breakpoints, diamonds are breakpoints on a branch successor, the square is the hardware watchpoint on a->balance. A check is a claim confirmed at that stop, a cross is a refutation, a question mark is a claim the finished run never observed. The -O2 build runs to exit with no stop at all, so its only verdicts come from the exit column.'])
    ]));
    render();
  }

  LF.register({ 're-42-run-timeline': runTimeline });
})();
