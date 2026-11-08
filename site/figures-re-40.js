/* figures-re-40.js - lesson 40: one call to puts traced through the ELF PLT and GOT, the PE import
   address table, and the Mach-O stub and chained fixup, plus which methods find the functions of a
   stripped build. DATA is the output of python3 code/main.py figure-data in the lesson folder. Every
   address, byte, and word below comes from the fixtures of that lesson. The test suite checks this copy. */
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
  var MONO = 'var(--font-mono,monospace)';

  var DATA = {"elf":{"file":"tiny-dyn-x86_64","symbol":"puts","call":{"address":551,"bytes":"e8 d4 ff ff ff","text":"callq 0x200 <puts@plt>","target":512},"stub":{"label":"puts@plt","address":512,"bytes":"ff 25 d2 0e 00 00 68 00 00 00 00 e9 e0 ff ff ff","lines":["jmpq *0xed2(%rip)   -> GOT slot 0x10d8","pushq $0x0   (index into DT_JMPREL)","jmp 0x1f0 <.plt>   (PLT0, into the dynamic linker)"],"slot":4312},"plt0":{"address":496,"bytes":"ff 35 d2 0e 00 00 ff 25 d4 0e 00 00 0f 1f 40 00","lines":["pushq 0x10c8(%rip)   (GOT[1], the link_map)","jmpq *0x10d0(%rip)   (GOT[2], the resolver)","nopl (%rax)"]},"slot":{"label":".got.plt","address":4312,"initial":"0x206","initialMeaning":"0x206 = the pushq inside puts@plt, so the first call falls into PLT0","relocation":"R_X86_64_JUMP_SLOT puts","after":"ld.so writes the address of puts from libc.so.6 here on the first call, or at startup with DF_BIND_NOW"},"dynamic":[["DT_NEEDED","libc.so.6"],["DT_PLTGOT","0x10c0"],["DT_PLTRELSZ","0x30"],["DT_PLTREL","RELA"],["DT_JMPREL","0x1b8"],["DT_FLAGS_1","DF_1_PIE"]]},"pe":{"file":"tiny-x86_64.exe","symbol":"puts","call":{"address":4107,"bytes":"ff 15 2f 10 00 00","text":"call qword ptr [rip + 0x102f]","target":8256},"slot":{"label":"IAT","address":8256,"initial":"0x2058","initialMeaning":"0x2058 = RVA of the hint/name entry: hint 0, name puts","relocation":"import descriptor at 0x2000: msvcrt.dll","after":"the Windows loader writes the address of puts from msvcrt.dll here before the entry point runs"},"descriptor":{"address":8192,"lookup":8232,"name":8296,"iat":8256,"dll":"msvcrt.dll"}},"macho":{"file":"ledger_main","symbol":"_puts","call":{"address":4294968736,"bytes":"3d 00 00 94","text":"bl 0x100000694","target":4294968980},"stub":{"label":"__stubs","address":4294968980,"bytes":"30 00 00 90 10 1e 40 f9 00 02 1f d6","lines":["adrp x16, 0x100004000","ldr x16, [x16, #0x38]   -> slot 0x100004038","br x16"],"slot":4294983736},"slot":{"label":"__got","address":4294983736,"initial":"0x8010000000000007","initialMeaning":"0x8010000000000007 is not an address: bit 63 = bind, next = 2 (x4 bytes), ordinal = 7","relocation":"chained import 7: _puts (from libSystem)","after":"dyld writes the address of _puts from libSystem here while it walks the chain, before main runs"},"imports":[[0,"_grade","libledger"],[1,"_grade_label","libledger"],[2,"_percent_change","libledger"],[3,"_total","libledger"],[4,"___stack_chk_fail","libSystem"],[5,"___stack_chk_guard","libSystem"],[6,"_printf","libSystem"],[7,"_puts","libSystem"]]},"stripped":{"file":"static-arm64-O2.stripped","textStart":4294968576,"textEnd":4294969224,"truth":[{"name":"_main","start":4294968576,"end":4294968820},{"name":"_percent_change","start":4294968820,"end":4294968844},{"name":"_grade","start":4294968844,"end":4294968904},{"name":"_total","start":4294968904,"end":4294969152},{"name":"_grade_label","start":4294969152,"end":4294969224}],"methods":[{"id":"functionStarts","label":"LC_FUNCTION_STARTS","found":[4294968576,4294968820,4294968844,4294968904,4294969152]},{"id":"prologueSub","label":"prologue scan: sub sp, sp, #imm","found":[4294968576]},{"id":"prologueStp","label":"prologue scan: stp x29, x30, [sp, #-0x10]!","found":[]},{"id":"callTargets","label":"bl targets + LC_MAIN entry","found":[4294968576,4294968820,4294968844,4294968904,4294969152]},{"id":"signatures","label":"signatures from our objects","found":[4294968576,4294968820,4294968844,4294968904,4294969152],"names":{"0x100000500":"_main","0x1000005f4":"_percent_change","0x10000060c":"_grade","0x100000648":"_total","0x100000740":"_grade_label"}}],"collisions":[{"address":"0x10000060c","candidates":["_grade","_grade_label"],"resolvedBy":{"tailOffset":44,"bytes":{"_grade":"20","_grade_label":"28"},"lengths":{"_grade":60,"_grade_label":72}},"winner":"_grade"},{"address":"0x100000740","candidates":["_grade","_grade_label"],"resolvedBy":{"tailOffset":44,"bytes":{"_grade":"20","_grade_label":"28"},"lengths":{"_grade":60,"_grade_label":72}},"winner":"_grade_label"}]}};

  var FORMATS = [
    { id: 'elf', label: 'ELF: PLT and GOT', loader: 'ld.so', stubName: 'puts@plt in .plt', slotName: '.got.plt slot' },
    { id: 'pe', label: 'PE: import address table', loader: 'the Windows loader', stubName: null, slotName: 'IAT slot in .rdata' },
    { id: 'macho', label: 'Mach-O: stub and chained fixup', loader: 'dyld', stubName: 'stub in __TEXT,__stubs', slotName: '__DATA_CONST,__got slot' }
  ];

  var STAGES = ['call site', 'stub', 'slot in the file', 'slot after the loader'];

  var W = 560;
  var BOX_X = 150;
  var BOX_W = 392;
  var BOX_H = 66;
  var BOX_PITCH = 80;
  var CHAIN_Y = 22;
  var GRID_Y = CHAIN_Y + 4 * BOX_PITCH + 10;
  var ROW_H = 20;
  var CELL_W = 58;
  var GRID_X = 150;

  function ensureStyles() {
    if (document.getElementById('re40-styles')) return;
    var style = document.createElement('style');
    style.id = 're40-styles';
    style.textContent = [
      '.re40 *{box-sizing:border-box}',
      '.re40__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re40__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re40__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re40__row{display:flex;flex-wrap:wrap;gap:8px}',
      '.re40 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re40 button:active{transform:scale(.96)}',
      '.re40 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re40 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re40 button[disabled]{opacity:.45;cursor:default}',
      '.re40__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re40__scroll svg{display:block;min-width:540px;width:100%;height:auto}',
      '.re40__current{margin-top:10px;font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.5;color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word}',
      '.re40__verdict{margin-top:8px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re40__verdict[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '.re40 .re40__cell{transition:fill 150ms ease}',
      '@media (hover:hover) and (pointer:fine){.re40 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re40__row--formats{display:grid;grid-template-columns:1fr}.re40 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re40 button,.re40 .re40__cell{transition:none!important}.re40 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function hex(n) { return '0x' + n.toString(16); }

  function text(x, y, s, fill, anchor, size) {
    return svgEl('text', {
      x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO,
      'font-size': String(size || 11.5), fill: fill || INK
    }, [document.createTextNode(s)]);
  }

  function formatIndex(id) {
    var i;
    for (i = 0; i < FORMATS.length; i++) if (FORMATS[i].id === id) return i;
    return 0;
  }

  function stageBoxes(format) {
    var d = DATA[format.id];
    var boxes = [];
    boxes.push({
      title: 'call site in main, ' + hex(d.call.address),
      lines: [d.call.bytes, d.call.text],
      note: format.id === 'pe' ? 'ff 15 is call qword ptr [rip+disp32]; the target is a data slot that holds an address' : 'the call goes to a small piece of code the link editor made, and that code jumps to puts'
    });
    if (d.stub) {
      boxes.push({
        title: format.stubName + ', ' + hex(d.stub.address),
        lines: d.stub.lines.slice(0, 3),
        note: d.stub.bytes
      });
    } else {
      boxes.push({
        title: 'no stub: PE code reaches the slot directly',
        lines: ['rip after the call = ' + hex(d.call.address + 6), '+ disp32 = ' + hex(d.call.target)],
        note: 'the IAT slot is the operand of the call itself'
      });
    }
    boxes.push({
      title: format.slotName + ', ' + hex(d.slot.address),
      lines: ['word in the file: ' + d.slot.initial, d.slot.relocation],
      note: d.slot.initialMeaning
    });
    boxes.push({
      title: 'after ' + format.loader + ' runs',
      lines: ['slot = address of puts in the shared library'],
      note: d.slot.after
    });
    return boxes;
  }

  function wrap(s, max) {
    var words = s.split(' ');
    var lines = [];
    var current = '';
    var i;
    for (i = 0; i < words.length; i++) {
      var next = current ? current + ' ' + words[i] : words[i];
      if (next.length > max && current) {
        lines.push(current);
        current = words[i];
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawChain(svg, format, stage, markerId) {
    var boxes = stageBoxes(format);
    var i;
    for (i = 0; i < boxes.length; i++) {
      var y = CHAIN_Y + i * BOX_PITCH;
      var active = i === stage;
      var reached = i <= stage;
      svg.appendChild(text(BOX_X - 8, y + 14, STAGES[i], reached ? INK : MUTE, 'end', 11));
      svg.appendChild(svgEl('rect', {
        x: BOX_X, y: y, width: BOX_W, height: BOX_H, rx: 3,
        fill: reached ? SURF : BG, stroke: active ? BP : (reached ? INK : RULE), 'stroke-width': active ? '2' : '1',
        'stroke-dasharray': reached ? 'none' : '4 3'
      }));
      var color = reached ? INK : MUTE;
      svg.appendChild(text(BOX_X + 8, y + 15, boxes[i].title, reached ? BP : MUTE, 'start', 11));
      var j;
      for (j = 0; j < boxes[i].lines.length && j < 2; j++) {
        svg.appendChild(text(BOX_X + 8, y + 31 + 14 * j, boxes[i].lines[j], color, 'start', 11));
      }
      if (boxes[i].lines.length > 2) svg.appendChild(text(BOX_X + 8, y + 59, boxes[i].lines[2], color, 'start', 11));
      if (i + 1 < boxes.length) {
        svg.appendChild(svgEl('path', {
          d: 'M' + (BOX_X + BOX_W / 2) + ' ' + (y + BOX_H) + 'L' + (BOX_X + BOX_W / 2) + ' ' + (y + BOX_PITCH - 2),
          fill: 'none', stroke: i < stage ? BP : RULE, 'stroke-width': '1.5', 'marker-end': 'url(#' + markerId + ')'
        }));
      }
    }
  }

  function drawGrid(svg) {
    var s = DATA.stripped;
    var methods = s.methods;
    var i, j;
    svg.appendChild(text(GRID_X - 8, GRID_Y + 12, 'stripped build', MUTE, 'end', 11));
    svg.appendChild(text(GRID_X - 8, GRID_Y + 26, s.file, MUTE, 'end', 9.5));
    var heads = ['starts', 'sub sp', 'stp fp', 'bl+entry', 'signature'];
    for (j = 0; j < methods.length; j++) {
      svg.appendChild(text(GRID_X + j * CELL_W + CELL_W / 2, GRID_Y + 12, heads[j], INK, 'middle', 10.5));
    }
    for (i = 0; i < s.truth.length; i++) {
      var y = GRID_Y + 22 + i * ROW_H;
      var fn = s.truth[i];
      svg.appendChild(text(GRID_X + methods.length * CELL_W + 8, y + 14, fn.name + ' ' + hex(fn.start), INK, 'start', 10.5));
      for (j = 0; j < methods.length; j++) {
        var found = methods[j].found.indexOf(fn.start) >= 0;
        var named = methods[j].id === 'signatures' && methods[j].names && methods[j].names[hex(fn.start)] === fn.name;
        svg.appendChild(svgEl('rect', {
          class: 're40__cell', x: GRID_X + j * CELL_W + 4, y: y + 2, width: CELL_W - 8, height: ROW_H - 4,
          fill: found ? (methods[j].id === 'signatures' && !named ? WARN : BP) : SURF, stroke: RULE
        }));
        svg.appendChild(text(GRID_X + j * CELL_W + CELL_W / 2, y + 15, found ? (methods[j].id === 'signatures' ? 'named' : 'found') : 'missed', found ? BG : MUTE, 'middle', 9.5));
      }
    }
    var totals = [];
    for (j = 0; j < methods.length; j++) {
      var count = 0;
      for (i = 0; i < s.truth.length; i++) if (methods[j].found.indexOf(s.truth[i].start) >= 0) count++;
      totals.push(heads[j] + ' ' + count + '/' + s.truth.length);
    }
    svg.appendChild(text(GRID_X, GRID_Y + 22 + s.truth.length * ROW_H + 16, totals.join('   '), MUTE, 'start', 10.5));
  }

  function verdictText(format, stage) {
    var d = DATA[format.id];
    var boxes = stageBoxes(format);
    var head = format.label + ', stage ' + (stage + 1) + ' of 4, ' + STAGES[stage] + ': ';
    var body = boxes[stage].note;
    if (stage === 2 && format.id === 'elf') body += '. ' + d.dynamic.map(function (pair) { return pair[0] + ' ' + pair[1]; }).join(', ');
    if (stage === 2 && format.id === 'macho') body += '. Import ' + d.imports.length + ' entries, ordinal 7 is ' + d.imports[7][1] + ' from ' + d.imports[7][2];
    return head + body + '.';
  }

  function setDisabled(button, disabled) {
    if (disabled) button.setAttribute('disabled', 'disabled'); else button.removeAttribute('disabled');
  }

  function callThroughThreeFormats(host) {
    ensureStyles();
    var state = { format: 'macho', stage: 3 };
    var titleId = LF.uid('lf-re40-title');
    var descId = LF.uid('lf-re40-desc');
    var markerId = LF.uid('lf-re40-arrow');
    var height = GRID_Y + 22 + DATA.stripped.truth.length * ROW_H + 30;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + height, role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var current = el('div', { class: 're40__current' });
    var verdict = el('div', { class: 're40__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var formatButtons = [];
    var stepButton = el('button', { type: 'button' }, ['next stage']);
    var resetButton = el('button', { type: 'button' }, ['back to the call']);

    function render() {
      var format = FORMATS[formatIndex(state.format)];
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('One call to puts traced from the call site to the loader-written slot, and the function finders of a stripped build')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(verdictText(format, state.stage))]));
      var defs = svgEl('defs');
      var marker = svgEl('marker', { id: markerId, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
      marker.appendChild(svgEl('path', { d: 'M0 0L10 5L0 10z', fill: BP }));
      defs.appendChild(marker);
      svg.appendChild(defs);
      drawChain(svg, format, state.stage, markerId);
      drawGrid(svg);
      for (i = 0; i < formatButtons.length; i++) formatButtons[i].button.setAttribute('aria-pressed', formatButtons[i].id === state.format ? 'true' : 'false');
      setDisabled(stepButton, state.stage >= 3);
      setDisabled(resetButton, state.stage === 0);
      var d = DATA[format.id];
      current.textContent = d.file + ': ' + d.call.text + ' at ' + hex(d.call.address) + ', slot ' + hex(d.slot.address) + ' holds ' + d.slot.initial + ' in the file';
      verdict.textContent = verdictText(format, state.stage);
      verdict.setAttribute('data-tone', state.stage === 2 ? 'warn' : 'pass');
    }

    var formatRow = el('div', { class: 're40__row re40__row--formats', role: 'group', 'aria-label': 'Object format' });
    FORMATS.forEach(function (format) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [format.label]);
      button.addEventListener('click', function () {
        state.format = format.id;
        state.stage = 0;
        render();
      });
      formatButtons.push({ id: format.id, button: button });
      formatRow.appendChild(button);
    });
    stepButton.addEventListener('click', function () { state.stage = Math.min(state.stage + 1, 3); render(); });
    resetButton.addEventListener('click', function () { state.stage = 0; render(); });

    var controls = el('div', { class: 're40__controls' }, [
      el('div', {}, [el('div', { class: 're40__group-label' }, ['format']), formatRow]),
      el('div', {}, [el('div', { class: 're40__group-label' }, ['stage']), el('div', { class: 're40__row' }, [stepButton, resetButton])])
    ]);

    host.appendChild(el('div', { class: 'lf re40' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ONE CALL, THREE LOADERS']), el('span', {}, ['main calls puts'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're40__note' }, ['Pick a format, then step from the call in main to the slot the loader fills. The bytes are from the lesson fixtures: the hand-built tiny-dyn-x86_64 and tiny-x86_64.exe, and the linked ledger_main. The grid below shows which function finders recover the five functions of static-arm64-O2.stripped.']),
        controls,
        el('div', { class: 're40__scroll' }, [svg]),
        current,
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Solid boxes are stages already reached, the blue outline is the current stage, dashed boxes are stages still ahead. In the grid a blue cell means the method found or named that function start, a grey cell means it missed it, and an amber cell would mean a signature matched the wrong name.'])
    ]));
    render();
  }

  LF.register({ 're-40-call-through-three-formats': callThroughThreeFormats });
})();
