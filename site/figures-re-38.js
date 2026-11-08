/* figures-re-38.js - lesson 38: the same call under three ABIs, as three stack frames side by side.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every offset, register, and prologue byte below comes from the analyzer in that lesson
   run over the convention-*.o fixtures. The test suite checks that this copy matches. */
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
  var BG = 'var(--bg,#fafaf5)';
  var TINT = 'var(--blueprint-tint,rgba(53,83,255,.08))';
  var MONO = 'var(--font-mono,monospace)';

  var DATA = {"functions":["eight_args","keeps"],"signatures":{"eight_args":"i64 eight_args(i64, i64, i64, i64, i64, i64, i64, i64)","keeps":"int keeps(int)"},"abis":[{"id":"sysv","label":"System V AMD64","short":"SysV"},{"id":"win64","label":"Microsoft x64","short":"Win64"},{"id":"aapcs64","label":"AArch64 AAPCS64","short":"AArch64"}],"frames":{"eight_args":{"O0":{"sysv":{"frame":8,"fp":-8,"cells":[{"lo":16,"hi":24,"label":"argument h (caller's frame)","kind":"arg"},{"lo":8,"hi":16,"label":"argument g (caller's frame)","kind":"arg"},{"lo":0,"hi":8,"label":"return address","kind":"ret"},{"lo":-8,"hi":0,"label":"saved rbp","kind":"fp"},{"lo":-16,"hi":-8,"label":"spill of rdi (argument a)","kind":"spill"},{"lo":-24,"hi":-16,"label":"spill of rsi (argument b)","kind":"spill"},{"lo":-32,"hi":-24,"label":"spill of rdx (argument c)","kind":"spill"},{"lo":-40,"hi":-32,"label":"spill of rcx (argument d)","kind":"spill"},{"lo":-48,"hi":-40,"label":"spill of r8 (argument e)","kind":"spill"},{"lo":-56,"hi":-48,"label":"spill of r9 (argument f)","kind":"spill"},{"lo":-56,"hi":-8,"label":"red zone, 48 bytes used","kind":"redzone"}],"regs":[{"p":"a","r":"rdi"},{"p":"b","r":"rsi"},{"p":"c","r":"rdx"},{"p":"d","r":"rcx"},{"p":"e","r":"r8"},{"p":"f","r":"r9"}],"ret":["rax"],"prologue":["55  pushq %rbp","48 89 e5  movq %rsp, %rbp"],"epilogue":["5d  popq %rbp","c3  retq"],"calls":[],"agree":7,"checks":7},"win64":{"frame":32,"fp":null,"cells":[{"lo":64,"hi":72,"label":"argument h (caller's frame)","kind":"arg"},{"lo":56,"hi":64,"label":"argument g (caller's frame)","kind":"arg"},{"lo":48,"hi":56,"label":"argument f (caller's frame)","kind":"arg"},{"lo":40,"hi":48,"label":"argument e (caller's frame)","kind":"arg"},{"lo":32,"hi":40,"label":"shadow slot for r9","kind":"shadow"},{"lo":24,"hi":32,"label":"shadow slot for r8","kind":"shadow"},{"lo":16,"hi":24,"label":"shadow slot for rdx","kind":"shadow"},{"lo":8,"hi":16,"label":"shadow slot for rcx","kind":"shadow"},{"lo":0,"hi":8,"label":"return address","kind":"ret"},{"lo":-8,"hi":0,"label":"spill of r9 (argument d)","kind":"spill"},{"lo":-16,"hi":-8,"label":"spill of r8 (argument c)","kind":"spill"},{"lo":-24,"hi":-16,"label":"spill of rdx (argument b)","kind":"spill"},{"lo":-32,"hi":-24,"label":"spill of rcx (argument a)","kind":"spill"}],"regs":[{"p":"a","r":"rcx"},{"p":"b","r":"rdx"},{"p":"c","r":"r8"},{"p":"d","r":"r9"}],"ret":["rax"],"prologue":["48 83 ec 20  subq $0x20, %rsp"],"epilogue":["48 83 c4 20  addq $0x20, %rsp","c3  retq"],"calls":[],"agree":6,"checks":6},"aapcs64":{"frame":64,"fp":null,"cells":[{"lo":-8,"hi":0,"label":"spill of x0 (argument a)","kind":"spill"},{"lo":-16,"hi":-8,"label":"spill of x1 (argument b)","kind":"spill"},{"lo":-24,"hi":-16,"label":"spill of x2 (argument c)","kind":"spill"},{"lo":-32,"hi":-24,"label":"spill of x3 (argument d)","kind":"spill"},{"lo":-40,"hi":-32,"label":"spill of x4 (argument e)","kind":"spill"},{"lo":-48,"hi":-40,"label":"spill of x5 (argument f)","kind":"spill"},{"lo":-56,"hi":-48,"label":"spill of x6 (argument g)","kind":"spill"},{"lo":-64,"hi":-56,"label":"spill of x7 (argument h)","kind":"spill"}],"regs":[{"p":"a","r":"x0"},{"p":"b","r":"x1"},{"p":"c","r":"x2"},{"p":"d","r":"x3"},{"p":"e","r":"x4"},{"p":"f","r":"x5"},{"p":"g","r":"x6"},{"p":"h","r":"x7"}],"ret":["x0"],"prologue":["d10103ff  sub sp, sp, #0x40"],"epilogue":["910103ff  add sp, sp, #0x40","d65f03c0  ret"],"calls":[],"agree":5,"checks":5}},"O2":{"sysv":{"frame":0,"fp":null,"cells":[{"lo":16,"hi":24,"label":"argument h (caller's frame)","kind":"arg"},{"lo":8,"hi":16,"label":"argument g (caller's frame)","kind":"arg"},{"lo":0,"hi":8,"label":"return address","kind":"ret"}],"regs":[{"p":"a","r":"rdi"},{"p":"b","r":"rsi"},{"p":"c","r":"rdx"},{"p":"d","r":"rcx"},{"p":"e","r":"r8"},{"p":"f","r":"r9"}],"ret":["rax"],"prologue":[],"epilogue":["c3  retq"],"calls":[],"agree":5,"checks":5},"win64":{"frame":0,"fp":null,"cells":[{"lo":64,"hi":72,"label":"argument h (caller's frame)","kind":"arg"},{"lo":56,"hi":64,"label":"argument g (caller's frame)","kind":"arg"},{"lo":48,"hi":56,"label":"argument f (caller's frame)","kind":"arg"},{"lo":40,"hi":48,"label":"argument e (caller's frame)","kind":"arg"},{"lo":32,"hi":40,"label":"shadow slot for r9","kind":"shadow"},{"lo":24,"hi":32,"label":"shadow slot for r8","kind":"shadow"},{"lo":16,"hi":24,"label":"shadow slot for rdx","kind":"shadow"},{"lo":8,"hi":16,"label":"shadow slot for rcx","kind":"shadow"},{"lo":0,"hi":8,"label":"return address","kind":"ret"}],"regs":[{"p":"a","r":"rcx"},{"p":"b","r":"rdx"},{"p":"c","r":"r8"},{"p":"d","r":"r9"}],"ret":["rax"],"prologue":[],"epilogue":["c3  retq"],"calls":[],"agree":6,"checks":6},"aapcs64":{"frame":0,"fp":null,"cells":[],"regs":[{"p":"a","r":"x0"},{"p":"b","r":"x1"},{"p":"c","r":"x2"},{"p":"d","r":"x3"},{"p":"e","r":"x4"},{"p":"f","r":"x5"},{"p":"g","r":"x6"},{"p":"h","r":"x7"}],"ret":["x0"],"prologue":[],"epilogue":["d65f03c0  ret"],"calls":[],"agree":5,"checks":5}}},"keeps":{"O0":{"sysv":{"frame":24,"fp":-8,"cells":[{"lo":0,"hi":8,"label":"return address","kind":"ret"},{"lo":-8,"hi":0,"label":"saved rbp","kind":"fp"},{"lo":-12,"hi":-8,"label":"spill of rdi (argument n)","kind":"spill"},{"lo":-24,"hi":-16,"label":"locals or alignment","kind":"local"}],"regs":[{"p":"n","r":"rdi"}],"ret":["rax"],"prologue":["55  pushq %rbp","48 89 e5  movq %rsp, %rbp","48 83 ec 10  subq $0x10, %rsp"],"epilogue":["48 83 c4 10  addq $0x10, %rsp","5d  popq %rbp","c3  retq"],"calls":[24],"agree":6,"checks":6},"win64":{"frame":56,"fp":null,"cells":[{"lo":32,"hi":40,"label":"shadow slot for r9","kind":"shadow"},{"lo":24,"hi":32,"label":"shadow slot for r8","kind":"shadow"},{"lo":16,"hi":24,"label":"shadow slot for rdx","kind":"shadow"},{"lo":8,"hi":16,"label":"shadow slot for rcx","kind":"shadow"},{"lo":0,"hi":8,"label":"return address","kind":"ret"},{"lo":-4,"hi":0,"label":"spill of rcx (argument n)","kind":"spill"},{"lo":-16,"hi":-8,"label":"locals or alignment","kind":"local"},{"lo":-24,"hi":-16,"label":"locals or alignment","kind":"local"},{"lo":-32,"hi":-24,"label":"shadow space for the callees","kind":"shadow"},{"lo":-40,"hi":-32,"label":"shadow space for the callees","kind":"shadow"},{"lo":-48,"hi":-40,"label":"shadow space for the callees","kind":"shadow"},{"lo":-56,"hi":-48,"label":"shadow space for the callees","kind":"shadow"}],"regs":[{"p":"n","r":"rcx"}],"ret":["rax"],"prologue":["48 83 ec 38  subq $0x38, %rsp"],"epilogue":["48 83 c4 38  addq $0x38, %rsp","c3  retq"],"calls":[56],"agree":7,"checks":7},"aapcs64":{"frame":32,"fp":-16,"cells":[{"lo":-8,"hi":0,"label":"frame record: saved x30 (LR)","kind":"fp"},{"lo":-16,"hi":-8,"label":"frame record: saved x29","kind":"fp"},{"lo":-20,"hi":-16,"label":"spill of x0 (argument n)","kind":"spill"},{"lo":-32,"hi":-24,"label":"locals or alignment","kind":"local"}],"regs":[{"p":"n","r":"x0"}],"ret":["x0"],"prologue":["d10083ff  sub sp, sp, #0x20","a9017bfd  stp x29, x30, [sp, #0x10]","910043fd  add x29, sp, #0x10"],"epilogue":["b9400be0  ldr w0, [sp, #0x8]","a9417bfd  ldp x29, x30, [sp, #0x10]","910083ff  add sp, sp, #0x20","d65f03c0  ret"],"calls":[32],"agree":7,"checks":7}},"O2":{"sysv":{"frame":24,"fp":null,"cells":[{"lo":0,"hi":8,"label":"return address","kind":"ret"},{"lo":-8,"hi":0,"label":"saved rbp","kind":"save"},{"lo":-16,"hi":-8,"label":"saved r14","kind":"save"},{"lo":-24,"hi":-16,"label":"saved rbx","kind":"save"}],"regs":[{"p":"n","r":"rdi"}],"ret":["rax"],"prologue":["55  pushq %rbp","41 56  pushq %r14","53  pushq %rbx"],"epilogue":["5b  popq %rbx","41 5e  popq %r14","5d  popq %rbp","c3  retq"],"calls":[24],"agree":5,"checks":5},"win64":{"frame":56,"fp":null,"cells":[{"lo":32,"hi":40,"label":"shadow slot for r9","kind":"shadow"},{"lo":24,"hi":32,"label":"shadow slot for r8","kind":"shadow"},{"lo":16,"hi":24,"label":"shadow slot for rdx","kind":"shadow"},{"lo":8,"hi":16,"label":"shadow slot for rcx","kind":"shadow"},{"lo":0,"hi":8,"label":"return address","kind":"ret"},{"lo":-8,"hi":0,"label":"saved rsi","kind":"save"},{"lo":-16,"hi":-8,"label":"saved rdi","kind":"save"},{"lo":-24,"hi":-16,"label":"saved rbx","kind":"save"},{"lo":-32,"hi":-24,"label":"shadow space for the callees","kind":"shadow"},{"lo":-40,"hi":-32,"label":"shadow space for the callees","kind":"shadow"},{"lo":-48,"hi":-40,"label":"shadow space for the callees","kind":"shadow"},{"lo":-56,"hi":-48,"label":"shadow space for the callees","kind":"shadow"}],"regs":[{"p":"n","r":"rcx"}],"ret":["rax"],"prologue":["56  pushq %rsi","57  pushq %rdi","53  pushq %rbx","48 83 ec 20  subq $0x20, %rsp"],"epilogue":["48 83 c4 20  addq $0x20, %rsp","5b  popq %rbx","5f  popq %rdi","5e  popq %rsi","c3  retq"],"calls":[56],"agree":7,"checks":7},"aapcs64":{"frame":48,"fp":-48,"cells":[{"lo":-8,"hi":0,"label":"saved x19","kind":"save"},{"lo":-16,"hi":-8,"label":"saved x20","kind":"save"},{"lo":-24,"hi":-16,"label":"locals or alignment","kind":"local"},{"lo":-32,"hi":-24,"label":"saved x21","kind":"save"},{"lo":-40,"hi":-32,"label":"frame record: saved x30 (LR)","kind":"fp"},{"lo":-48,"hi":-40,"label":"frame record: saved x29","kind":"fp"}],"regs":[{"p":"n","r":"x0"}],"ret":["x0"],"prologue":["a9bd7bfd  stp x29, x30, [sp, #-0x30]!","f9000bf5  str x21, [sp, #0x10]","910003fd  mov x29, sp","a9024ff4  stp x20, x19, [sp, #0x20]"],"epilogue":["a9424ff4  ldp x20, x19, [sp, #0x20]","f9400bf5  ldr x21, [sp, #0x10]","a8c37bfd  ldp x29, x30, [sp], #0x30","d65f03c0  ret"],"calls":[48],"agree":7,"checks":7}}}}};

  var W = 720;
  var COL_W = 220;
  var COL_GAP = 20;
  var LEFT = 20;
  var TOP = 58;
  var ROW = 18;
  var LABEL_W = 44;
  var FOOT = 92;

  var KIND_STYLE = {
    arg: { fill: SURF, stroke: BP, dash: 'none', text: INK },
    shadow: { fill: BG, stroke: BP, dash: '3 3', text: MUTE },
    ret: { fill: INK, stroke: INK, dash: 'none', text: BG },
    fp: { fill: BP, stroke: BP, dash: 'none', text: BG },
    save: { fill: TINT, stroke: BP, dash: 'none', text: INK },
    spill: { fill: SURF, stroke: RULE, dash: 'none', text: INK },
    local: { fill: BG, stroke: RULE, dash: '2 3', text: MUTE },
    pad: { fill: BG, stroke: RULE, dash: '2 3', text: MUTE },
    redzone: { fill: 'none', stroke: WARN, dash: '5 3', text: WARN }
  };

  function ensureStyles() {
    if (document.getElementById('re38-styles')) return;
    var style = document.createElement('style');
    style.id = 're38-styles';
    style.textContent = [
      '.re38 *{box-sizing:border-box}',
      '.re38__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re38__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re38__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re38__row{display:flex;flex-wrap:wrap;gap:8px}',
      '.re38 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re38 button:active{transform:scale(.96)}',
      '.re38 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re38 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re38__signature{margin:0 0 10px;font-family:var(--font-mono,monospace);font-size:.8rem;color:var(--ink,#1a1a1a)}',
      '.re38__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re38__scroll svg{display:block;min-width:700px;width:100%;height:auto}',
      '.re38__prologues{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}',
      '.re38__prologue{font-family:var(--font-mono,monospace);font-size:.74rem;line-height:1.5;color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word;border-top:1px solid var(--rule-soft,#ddd);padding-top:6px}',
      '.re38__prologue b{color:var(--ink,#1a1a1a);font-weight:600}',
      '.re38__verdict{margin-top:8px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '@media (hover:hover) and (pointer:fine){.re38 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re38__prologues{grid-template-columns:1fr}.re38 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re38 button{transition:none!important}.re38 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function signed(n) { return (n >= 0 ? '+' : '') + n; }

  function text(x, y, s, fill, anchor, size, weight) {
    var attrs = { x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO, 'font-size': String(size || 11), fill: fill || INK };
    if (weight) attrs['font-weight'] = weight;
    return svgEl('text', attrs, [document.createTextNode(s)]);
  }

  function frameOf(state, abiId) {
    return DATA.frames[state.fn][state.level][abiId];
  }

  function range(state) {
    var top = 8;
    var bottom = 0;
    var i, j;
    for (i = 0; i < DATA.abis.length; i++) {
      var frame = frameOf(state, DATA.abis[i].id);
      if (-frame.frame < bottom) bottom = -frame.frame;
      for (j = 0; j < frame.cells.length; j++) {
        if (frame.cells[j].hi > top) top = frame.cells[j].hi;
        if (frame.cells[j].lo < bottom) bottom = frame.cells[j].lo;
      }
    }
    return { top: top, bottom: bottom };
  }

  function yFor(offset, rng) {
    return TOP + (rng.top - offset) / 8 * ROW;
  }

  function countKinds(frame) {
    var counts = {};
    var i;
    for (i = 0; i < frame.cells.length; i++) {
      var kind = frame.cells[i].kind;
      counts[kind] = (counts[kind] || 0) + 1;
    }
    return counts;
  }

  function columnSummary(abi, frame) {
    var counts = countKinds(frame);
    var parts = [];
    parts.push(frame.regs.length + (frame.regs.length === 1 ? ' register argument' : ' register arguments'));
    if (counts.arg) parts.push(counts.arg + ' stack ' + (counts.arg === 1 ? 'argument' : 'arguments'));
    if (counts.shadow) parts.push('32-byte shadow space');
    if (counts.save || counts.fp) parts.push(((counts.save || 0) + (counts.fp || 0)) + ' saved ' + (((counts.save || 0) + (counts.fp || 0)) === 1 ? 'register' : 'registers'));
    if (counts.redzone) parts.push('red zone in use');
    parts.push(frame.frame + ' frame bytes');
    return abi.short + ': ' + parts.join(', ');
  }

  function verdictText(state) {
    var lines = [];
    var i;
    for (i = 0; i < DATA.abis.length; i++) lines.push(columnSummary(DATA.abis[i], frameOf(state, DATA.abis[i].id)));
    return state.fn + ' at -' + state.level + '. ' + lines.join('. ') + '.';
  }

  function drawColumn(svg, state, abi, index, rng) {
    var frame = frameOf(state, abi.id);
    var x = LEFT + index * (COL_W + COL_GAP);
    var cellX = x + LABEL_W;
    var cellW = COL_W - LABEL_W;
    var i;
    svg.appendChild(text(x, 20, abi.label, INK, 'start', 12, '600'));
    var fpText = frame.fp === null ? 'no frame pointer' : 'frame pointer at ' + signed(frame.fp);
    svg.appendChild(text(x, 36, frame.frame + ' frame bytes, ' + fpText, MUTE, 'start', 10.5));
    var entryY = yFor(0, rng);
    svg.appendChild(svgEl('line', { x1: x, y1: entryY, x2: x + COL_W, y2: entryY, stroke: INK, 'stroke-width': '1.5' }));
    svg.appendChild(text(x + COL_W, entryY - 3, 'entry sp', INK, 'end', 9.5));
    if (frame.frame > 0) {
      var spY = yFor(-frame.frame, rng);
      svg.appendChild(svgEl('line', { x1: x, y1: spY, x2: x + COL_W, y2: spY, stroke: BP, 'stroke-width': '1.5' }));
      svg.appendChild(text(x + COL_W, spY + 11, 'sp after prologue', BP, 'end', 9.5));
    }
    for (i = 0; i < frame.cells.length; i++) {
      var cell = frame.cells[i];
      var style = KIND_STYLE[cell.kind] || KIND_STYLE.local;
      var y0 = yFor(cell.hi, rng);
      var y1 = yFor(cell.lo, rng);
      var inset = cell.kind === 'redzone' ? 3 : 0;
      svg.appendChild(svgEl('rect', {
        x: cellX + inset, y: y0 + inset, width: cellW - 2 * inset, height: Math.max(2, y1 - y0 - 2 * inset),
        fill: style.fill, stroke: style.stroke, 'stroke-width': cell.kind === 'redzone' ? '1.5' : '1', 'stroke-dasharray': style.dash
      }));
      if (cell.kind !== 'redzone') {
        svg.appendChild(text(cellX - 4, y0 + Math.min(13, (y1 - y0) / 2 + 4), signed(cell.lo), MUTE, 'end', 9.5));
        if (y1 - y0 >= 12) svg.appendChild(text(cellX + 5, y0 + Math.min(13, (y1 - y0) / 2 + 4), cell.label, style.text, 'start', 9.5));
      } else {
        svg.appendChild(text(cellX + cellW - 6, y1 - 5, cell.label, WARN, 'end', 9.5));
      }
    }
    var footY = yFor(rng.bottom, rng) + 20;
    var regs = [];
    for (i = 0; i < frame.regs.length; i++) regs.push(frame.regs[i].p + ' in ' + frame.regs[i].r);
    svg.appendChild(text(x, footY, 'registers: ' + (regs.length ? regs.join(', ') : 'none'), INK, 'start', 9.5));
    svg.appendChild(text(x, footY + 14, 'result in ' + frame.ret.join(', '), INK, 'start', 9.5));
    svg.appendChild(text(x, footY + 28, frame.agree + ' of ' + frame.checks + ' checks agree with the rule', BP, 'start', 9.5));
  }

  function prologueBlock(abi, frame) {
    var lines = frame.prologue.length ? frame.prologue.join('\n') : '(no prologue: leaf function without a frame)';
    var block = el('div', { class: 're38__prologue' });
    block.appendChild(el('b', {}, [abi.short + ' prologue']));
    block.appendChild(document.createTextNode('\n' + lines));
    return block;
  }

  function threeFrames(host) {
    ensureStyles();
    var state = { fn: DATA.functions[0], level: 'O2' };
    var titleId = LF.uid('lf-re38-title');
    var descId = LF.uid('lf-re38-desc');
    var svg = svgEl('svg', { role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var signature = el('p', { class: 're38__signature' });
    var prologues = el('div', { class: 're38__prologues' });
    var verdict = el('div', { class: 're38__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var fnButtons = [];
    var levelButtons = [];

    function render() {
      var rng = range(state);
      var height = yFor(rng.bottom, rng) + FOOT;
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + height);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Stack frame of ' + state.fn + ' under three ABIs at -' + state.level)]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(verdictText(state))]));
      for (i = 0; i < DATA.abis.length; i++) drawColumn(svg, state, DATA.abis[i], i, rng);
      signature.textContent = DATA.signatures[state.fn] + '   compiled at -' + state.level;
      while (prologues.firstChild) prologues.removeChild(prologues.firstChild);
      for (i = 0; i < DATA.abis.length; i++) prologues.appendChild(prologueBlock(DATA.abis[i], frameOf(state, DATA.abis[i].id)));
      for (i = 0; i < fnButtons.length; i++) fnButtons[i].button.setAttribute('aria-pressed', fnButtons[i].id === state.fn ? 'true' : 'false');
      for (i = 0; i < levelButtons.length; i++) levelButtons[i].button.setAttribute('aria-pressed', levelButtons[i].id === state.level ? 'true' : 'false');
      verdict.textContent = verdictText(state);
    }

    var fnRow = el('div', { class: 're38__row', role: 'group', 'aria-label': 'Function' });
    DATA.functions.forEach(function (name) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [name]);
      button.addEventListener('click', function () { state.fn = name; render(); });
      fnButtons.push({ id: name, button: button });
      fnRow.appendChild(button);
    });
    var levelRow = el('div', { class: 're38__row', role: 'group', 'aria-label': 'Optimization level' });
    ['O0', 'O2'].forEach(function (level) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, ['-' + level]);
      button.addEventListener('click', function () { state.level = level; render(); });
      levelButtons.push({ id: level, button: button });
      levelRow.appendChild(button);
    });

    var controls = el('div', { class: 're38__controls' }, [
      el('div', {}, [el('div', { class: 're38__group-label' }, ['function']), fnRow]),
      el('div', {}, [el('div', { class: 're38__group-label' }, ['optimization']), levelRow])
    ]);

    host.appendChild(el('div', { class: 'lf re38' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['THREE FRAMES']), el('span', {}, ['one C function, three ABIs'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're38__note' }, ['Pick a function and an optimization level. Each column is the stack frame that Apple clang 17.0.0 built for that ABI, read back from the object file by the analyzer in this lesson. Offsets are bytes from the stack pointer at entry. Higher addresses are at the top.']),
        controls,
        signature,
        el('div', { class: 're38__scroll' }, [svg]),
        prologues,
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['The black line is the stack pointer at entry. On x86-64 the return address sits just above it. Cells above the line belong to the caller: stack arguments and, on Microsoft x64, the 32-byte shadow space. Cells below the line are the callee\'s frame: saved registers, the frame record on AArch64, spilled argument registers at -O0, and the amber dashed box is the System V red zone when the function uses it.'])
    ]));
    render();
  }

  LF.register({ 're-38-three-frames': threeFrames });
})();
