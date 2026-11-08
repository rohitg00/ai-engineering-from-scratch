/* figures-re-43.js - lesson 43: the grade function in five containers.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every offset, byte, mnemonic, and fact below comes from the readers in that lesson
   run over the committed fixtures. The test suite checks that this copy matches. */
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

  var DATA = {"function":"grade","panels":[{"id":"native","label":"x86-64 object","container":"ELF relocatable object, x86-64, clang -O0","name":"grade","params":[],"paramTypes":null,"returnType":null,"locals":[],"lines":false,"bodyBytes":118,"structure":{"instructions":33,"jumps":5,"indirectJumps":1,"returns":1,"structured":0},"rows":[{"o":48,"b":"55","t":"pushq %rbp","k":""},{"o":49,"b":"48 89 e5","t":"movq %rsp, %rbp","k":""},{"o":52,"b":"89 7d f8","t":"movl %edi, -0x8(%rbp)","k":""},{"o":55,"b":"48 63 45 f8","t":"movslq -0x8(%rbp), %rax","k":""},{"o":59,"b":"48 69 c0 67 66 66 66","t":"imulq $0x66666667, %rax, %rax","k":""},{"o":66,"b":"48 89 c1","t":"movq %rax, %rcx","k":""},{"o":69,"b":"48 c1 f9 22","t":"sarq $0x22, %rcx","k":""},{"o":73,"b":"89 ca","t":"movl %ecx, %edx","k":""},{"o":75,"b":"48 c1 e8 3f","t":"shrq $0x3f, %rax","k":""},{"o":79,"b":"89 c1","t":"movl %eax, %ecx","k":""},{"o":81,"b":"89 d0","t":"movl %edx, %eax","k":""},{"o":83,"b":"8d 44 08 fa","t":"leal -0x6(%rax,%rcx), %eax","k":""},{"o":87,"b":"89 c1","t":"movl %eax, %ecx","k":""},{"o":89,"b":"48 89 4d f0","t":"movq %rcx, -0x10(%rbp)","k":""},{"o":93,"b":"83 e8 04","t":"subl $0x4, %eax","k":""},{"o":96,"b":"77 38","t":"ja 0x9a <grade+0x6a>","k":"jump"},{"o":98,"b":"48 8b 45 f0","t":"movq -0x10(%rbp), %rax","k":""},{"o":102,"b":"48 8d 0d 00 00 00 00","t":"leaq (%rip), %rcx","k":""},{"o":109,"b":"48 63 04 81","t":"movslq (%rcx,%rax,4), %rax","k":""},{"o":113,"b":"48 01 c8","t":"addq %rcx, %rax","k":""},{"o":116,"b":"ff e0","t":"jmpq *%rax","k":"jump"},{"o":118,"b":"c7 45 fc 04 00 00 00","t":"movl $0x4, -0x4(%rbp)","k":""},{"o":125,"b":"eb 22","t":"jmp 0xa1 <grade+0x71>","k":"jump"},{"o":127,"b":"c7 45 fc 03 00 00 00","t":"movl $0x3, -0x4(%rbp)","k":""},{"o":134,"b":"eb 19","t":"jmp 0xa1 <grade+0x71>","k":"jump"},{"o":136,"b":"c7 45 fc 02 00 00 00","t":"movl $0x2, -0x4(%rbp)","k":""},{"o":143,"b":"eb 10","t":"jmp 0xa1 <grade+0x71>","k":"jump"},{"o":145,"b":"c7 45 fc 01 00 00 00","t":"movl $0x1, -0x4(%rbp)","k":""},{"o":152,"b":"eb 07","t":"jmp 0xa1 <grade+0x71>","k":"jump"},{"o":154,"b":"c7 45 fc 00 00 00 00","t":"movl $0x0, -0x4(%rbp)","k":""},{"o":161,"b":"8b 45 fc","t":"movl -0x4(%rbp), %eax","k":""},{"o":164,"b":"5d","t":"popq %rbp","k":""},{"o":165,"b":"c3","t":"retq","k":""}]},{"id":"python","label":"CPython 3.14 pyc","container":"CPython 3.14 pyc, magic 3627","name":"grade","params":["score"],"paramTypes":null,"returnType":null,"locals":["bucket"],"lines":true,"bodyBytes":96,"structure":{"instructions":35,"jumps":4,"compares":4,"returns":5,"caches":13,"structured":0},"rows":[{"o":0,"b":"80 00","t":"RESUME 0","k":""},{"o":2,"b":"56 00","t":"LOAD_FAST_BORROW 0 (score)","k":"name"},{"o":4,"b":"5e 0a","t":"LOAD_SMALL_INT 10","k":""},{"o":6,"b":"2c 02","t":"BINARY_OP 2 (//)","k":""},{"o":18,"b":"70 01","t":"STORE_FAST 1 (bucket)","k":"name"},{"o":20,"b":"56 01","t":"LOAD_FAST_BORROW 1 (bucket)","k":"name"},{"o":22,"b":"5e 09","t":"LOAD_SMALL_INT 9","k":""},{"o":24,"b":"38 bc","t":"COMPARE_OP 188 (bool(>=))","k":""},{"o":28,"b":"64 03","t":"POP_JUMP_IF_FALSE 3 (to L1)","k":"jump"},{"o":32,"b":"1c 00","t":"NOT_TAKEN","k":""},{"o":34,"b":"5e 04","t":"LOAD_SMALL_INT 4","k":""},{"o":36,"b":"23 00","t":"RETURN_VALUE","k":""},{"o":38,"b":"56 01","t":"LOAD_FAST_BORROW 1 (bucket)","k":"name"},{"o":40,"b":"5e 08","t":"LOAD_SMALL_INT 8","k":""},{"o":42,"b":"38 58","t":"COMPARE_OP 88 (bool(==))","k":""},{"o":46,"b":"64 03","t":"POP_JUMP_IF_FALSE 3 (to L2)","k":"jump"},{"o":50,"b":"1c 00","t":"NOT_TAKEN","k":""},{"o":52,"b":"5e 03","t":"LOAD_SMALL_INT 3","k":""},{"o":54,"b":"23 00","t":"RETURN_VALUE","k":""},{"o":56,"b":"56 01","t":"LOAD_FAST_BORROW 1 (bucket)","k":"name"},{"o":58,"b":"5e 07","t":"LOAD_SMALL_INT 7","k":""},{"o":60,"b":"38 58","t":"COMPARE_OP 88 (bool(==))","k":""},{"o":64,"b":"64 03","t":"POP_JUMP_IF_FALSE 3 (to L3)","k":"jump"},{"o":68,"b":"1c 00","t":"NOT_TAKEN","k":""},{"o":70,"b":"5e 02","t":"LOAD_SMALL_INT 2","k":""},{"o":72,"b":"23 00","t":"RETURN_VALUE","k":""},{"o":74,"b":"56 01","t":"LOAD_FAST_BORROW 1 (bucket)","k":"name"},{"o":76,"b":"5e 06","t":"LOAD_SMALL_INT 6","k":""},{"o":78,"b":"38 58","t":"COMPARE_OP 88 (bool(==))","k":""},{"o":82,"b":"64 03","t":"POP_JUMP_IF_FALSE 3 (to L4)","k":"jump"},{"o":86,"b":"1c 00","t":"NOT_TAKEN","k":""},{"o":88,"b":"5e 01","t":"LOAD_SMALL_INT 1","k":""},{"o":90,"b":"23 00","t":"RETURN_VALUE","k":""},{"o":92,"b":"5e 00","t":"LOAD_SMALL_INT 0","k":""},{"o":94,"b":"23 00","t":"RETURN_VALUE","k":""}]},{"id":"jvm","label":"JVM class","container":"JVM class file, major 65, javac -g","name":"grade","params":["score"],"paramTypes":"I","returnType":"I","locals":[],"lines":true,"bodyBytes":50,"structure":{"instructions":14,"jumps":0,"switches":1,"returns":5,"structured":0},"rows":[{"o":0,"b":"1a","t":"iload_0","k":""},{"o":1,"b":"10 0a","t":"bipush 10","k":""},{"o":3,"b":"6c","t":"idiv","k":""},{"o":4,"b":"aa 00 00 00 00 00 00 2c 00 00 00 06 00 00 00 0a 00 00 00 2a 00 00 00 28 00 00 00 26 00 00 00 24 00 00 00 24","t":"tableswitch { 6 to 10, default 48 }","k":"switch"},{"o":40,"b":"07","t":"iconst_4","k":""},{"o":41,"b":"ac","t":"ireturn","k":""},{"o":42,"b":"06","t":"iconst_3","k":""},{"o":43,"b":"ac","t":"ireturn","k":""},{"o":44,"b":"05","t":"iconst_2","k":""},{"o":45,"b":"ac","t":"ireturn","k":""},{"o":46,"b":"04","t":"iconst_1","k":""},{"o":47,"b":"ac","t":"ireturn","k":""},{"o":48,"b":"03","t":"iconst_0","k":""},{"o":49,"b":"ac","t":"ireturn","k":""}]},{"id":"wasm","label":"WebAssembly","container":"WebAssembly binary version 1, wat2wasm","name":"grade","params":["score"],"paramTypes":"i32","returnType":"i32","locals":["bucket"],"lines":false,"bodyBytes":63,"structure":{"instructions":28,"structured":6,"branches":5,"tables":1,"jumps":0},"rows":[{"o":142,"b":"20 00","t":"local.get 0","k":"","d":0},{"o":144,"b":"41 0a","t":"i32.const 10","k":"","d":0},{"o":146,"b":"6d","t":"i32.div_s","k":"","d":0},{"o":147,"b":"21 01","t":"local.set 1","k":"","d":0},{"o":149,"b":"02 7f","t":"block i32","k":"structure","d":0},{"o":151,"b":"02 40","t":"block","k":"structure","d":1},{"o":153,"b":"02 40","t":"block","k":"structure","d":2},{"o":155,"b":"02 40","t":"block","k":"structure","d":3},{"o":157,"b":"02 40","t":"block","k":"structure","d":4},{"o":159,"b":"02 40","t":"block","k":"structure","d":5},{"o":161,"b":"20 01","t":"local.get 1","k":"","d":6},{"o":163,"b":"0e 0b 04 04 04 04 04 04 03 02 01 00 00 04","t":"br_table 4 4 4 4 4 4 3 2 1 0 0 4","k":"structure","d":6},{"o":177,"b":"0b","t":"end","k":"structure","d":5},{"o":178,"b":"41 04","t":"i32.const 4","k":"","d":5},{"o":180,"b":"0c 04","t":"br 4","k":"","d":5},{"o":182,"b":"0b","t":"end","k":"structure","d":4},{"o":183,"b":"41 03","t":"i32.const 3","k":"","d":4},{"o":185,"b":"0c 03","t":"br 3","k":"","d":4},{"o":187,"b":"0b","t":"end","k":"structure","d":3},{"o":188,"b":"41 02","t":"i32.const 2","k":"","d":3},{"o":190,"b":"0c 02","t":"br 2","k":"","d":3},{"o":192,"b":"0b","t":"end","k":"structure","d":2},{"o":193,"b":"41 01","t":"i32.const 1","k":"","d":2},{"o":195,"b":"0c 01","t":"br 1","k":"","d":2},{"o":197,"b":"0b","t":"end","k":"structure","d":1},{"o":198,"b":"41 00","t":"i32.const 0","k":"","d":1},{"o":200,"b":"0b","t":"end","k":"structure","d":0},{"o":201,"b":"0b","t":"end","k":"structure","d":0}]},{"id":"dotnet","label":".NET assembly","container":"ECMA-335 assembly, runtime 2.5, v4.0.30319","name":"Grade","params":["score"],"paramTypes":"static int32(int32)","returnType":"int32","locals":[],"lines":false,"bodyBytes":45,"structure":{"instructions":19,"jumps":1,"switches":1,"returns":5,"structured":0},"rows":[{"o":0,"b":"02","t":"ldarg.0","k":""},{"o":1,"b":"1f 0a","t":"ldc.i4.s 10","k":""},{"o":3,"b":"5b","t":"div","k":""},{"o":4,"b":"0a","t":"stloc.0","k":""},{"o":5,"b":"06","t":"ldloc.0","k":""},{"o":6,"b":"1c","t":"ldc.i4.6","k":""},{"o":7,"b":"59","t":"sub","k":""},{"o":8,"b":"45 05 00 00 00 08 00 00 00 06 00 00 00 04 00 00 00 02 00 00 00 02 00 00 00","t":"switch (IL_0029, IL_0027, IL_0025, IL_0023, IL_0023)","k":"switch"},{"o":33,"b":"2b 08","t":"br.s IL_002b","k":"jump"},{"o":35,"b":"1a","t":"ldc.i4.4","k":""},{"o":36,"b":"2a","t":"ret","k":""},{"o":37,"b":"19","t":"ldc.i4.3","k":""},{"o":38,"b":"2a","t":"ret","k":""},{"o":39,"b":"18","t":"ldc.i4.2","k":""},{"o":40,"b":"2a","t":"ret","k":""},{"o":41,"b":"17","t":"ldc.i4.1","k":""},{"o":42,"b":"2a","t":"ret","k":""},{"o":43,"b":"16","t":"ldc.i4.0","k":""},{"o":44,"b":"2a","t":"ret","k":""}]}]};

  var W = 600;
  var FACT_Y = 16;
  var FACT_ROW = 17;
  var LIST_X = 8;
  var ROW_H = 15;
  var BYTES_X = 56;
  var TEXT_X = 196;
  var MAX_BYTES = 6;
  var FACTS = [
    { key: 'name', label: 'function name' },
    { key: 'params', label: 'parameter names' },
    { key: 'paramTypes', label: 'parameter types' },
    { key: 'returnType', label: 'return type' },
    { key: 'locals', label: 'local names' },
    { key: 'lines', label: 'line numbers' }
  ];

  function ensureStyles() {
    if (document.getElementById('re43-styles')) return;
    var style = document.createElement('style');
    style.id = 're43-styles';
    style.textContent = [
      '.re43 *{box-sizing:border-box}',
      '.re43__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re43__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re43__row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}',
      '.re43 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re43 button:active{transform:scale(.96)}',
      '.re43 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re43 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re43__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re43__scroll svg{display:block;min-width:600px;width:100%;height:auto}',
      '.re43__verdict{margin-top:10px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re43__verdict[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '@media (hover:hover) and (pointer:fine){.re43 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re43__row--formats{display:grid;grid-template-columns:1fr 1fr}.re43 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re43 button{transition:none!important}.re43 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function text(x, y, s, fill, anchor, size, weight) {
    var attrs = {
      x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO,
      'font-size': String(size || 12), fill: fill || INK
    };
    if (weight) attrs['font-weight'] = weight;
    return svgEl('text', attrs, [document.createTextNode(s)]);
  }

  function panelById(id) {
    var i;
    for (i = 0; i < DATA.panels.length; i++) if (DATA.panels[i].id === id) return DATA.panels[i];
    return DATA.panels[0];
  }

  function factValue(panel, key) {
    var value = panel[key];
    if (key === 'lines') return value ? 'kept' : 'none';
    if (value === null || value === undefined) return 'none';
    if (Object.prototype.toString.call(value) === '[object Array]') return value.length ? value.join(', ') : 'none';
    return String(value);
  }

  function factKept(panel, key) {
    var value = panel[key];
    if (key === 'lines') return !!value;
    if (value === null || value === undefined) return false;
    if (Object.prototype.toString.call(value) === '[object Array]') return value.length > 0;
    return String(value).length > 0;
  }

  function keptCount(panel) {
    var n = 0;
    var i;
    for (i = 0; i < FACTS.length; i++) if (factKept(panel, FACTS[i].key)) n++;
    return n;
  }

  function offsetText(panel, row) {
    if (panel.id === 'dotnet') return 'IL_' + ('0000' + row.o.toString(16)).slice(-4);
    if (panel.id === 'wasm') return '0x' + row.o.toString(16);
    if (panel.id === 'native') return '0x' + row.o.toString(16);
    return String(row.o);
  }

  function bytesText(row) {
    var parts = row.b.split(' ');
    if (parts.length <= MAX_BYTES) return row.b;
    return parts.slice(0, MAX_BYTES).join(' ') + ' +' + (parts.length - MAX_BYTES) + ' B';
  }

  function structureText(panel) {
    var s = panel.structure;
    var parts = [];
    if (s.structured) parts.push(s.structured + ' nested blocks');
    if (s.tables) parts.push(s.tables + ' br_table');
    if (s.switches) parts.push(s.switches + (s.switches === 1 ? ' switch instruction' : ' switch instructions'));
    if (s.jumps) parts.push(s.jumps + (s.jumps === 1 ? ' conditional jump' : ' jumps'));
    if (s.indirectJumps) parts.push(s.indirectJumps + ' indirect jump through a table');
    if (s.compares) parts.push(s.compares + ' compares');
    if (s.caches) parts.push(s.caches + ' inline cache entries hidden');
    if (!parts.length) parts.push('no branches');
    return parts.join(', ');
  }

  function verdictText(panel) {
    var kept = keptCount(panel);
    var marked = 0;
    var i;
    for (i = 0; i < panel.rows.length; i++) if (panel.rows[i].k && panel.rows[i].k !== 'name') marked++;
    return panel.label + ' keeps ' + kept + ' of ' + FACTS.length + ' facts about grade. Body ' + panel.bodyBytes + ' bytes, ' + panel.structure.instructions + ' instructions, ' + marked + ' control-flow rows marked: ' + structureText(panel) + '.';
  }

  function panelHeight(panel) {
    return FACT_Y + FACTS.length * FACT_ROW + 30 + panel.rows.length * ROW_H + 14;
  }

  function drawFacts(svg, panel) {
    var i;
    svg.appendChild(text(LIST_X, FACT_Y, panel.container, MUTE, 'start', 11.5));
    for (i = 0; i < FACTS.length; i++) {
      var y = FACT_Y + 14 + i * FACT_ROW;
      var kept = factKept(panel, FACTS[i].key);
      svg.appendChild(svgEl('rect', { x: LIST_X, y: y - 9, width: 9, height: 9, fill: kept ? BP : BG, stroke: kept ? BP : RULE, 'stroke-width': '1' }));
      svg.appendChild(text(LIST_X + 16, y, FACTS[i].label, kept ? INK : MUTE));
      svg.appendChild(text(TEXT_X, y, factValue(panel, FACTS[i].key), kept ? BP : MUTE));
    }
  }

  function drawRows(svg, panel) {
    var top = FACT_Y + FACTS.length * FACT_ROW + 26;
    var i;
    svg.appendChild(svgEl('line', { x1: LIST_X, y1: top - 12, x2: W - LIST_X, y2: top - 12, stroke: RULE, 'stroke-width': '1' }));
    svg.appendChild(text(LIST_X, top - 16, 'offset', MUTE, 'start', 11.5));
    svg.appendChild(text(BYTES_X, top - 16, 'bytes', MUTE, 'start', 11.5));
    svg.appendChild(text(TEXT_X, top - 16, 'instruction', MUTE, 'start', 11.5));
    for (i = 0; i < panel.rows.length; i++) {
      var row = panel.rows[i];
      var y = top + i * ROW_H;
      var kind = row.k || '';
      var color = INK;
      if (kind === 'jump' || kind === 'switch' || kind === 'structure') {
        svg.appendChild(svgEl('rect', { x: LIST_X - 4, y: y - ROW_H + 4, width: 3, height: ROW_H - 2, fill: BP }));
        color = BP;
      } else if (kind === 'name') {
        svg.appendChild(svgEl('rect', { x: LIST_X - 4, y: y - ROW_H + 4, width: 3, height: ROW_H - 2, fill: WARN }));
      }
      svg.appendChild(text(LIST_X, y, offsetText(panel, row), MUTE));
      svg.appendChild(text(BYTES_X, y, bytesText(row), MUTE));
      var indent = row.d ? row.d * 8 : 0;
      svg.appendChild(text(TEXT_X + indent, y, row.t, color));
    }
  }

  function fiveContainers(host) {
    ensureStyles();
    var state = { id: 'native' };
    var titleId = LF.uid('lf-re43-title');
    var descId = LF.uid('lf-re43-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' 100', role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var verdict = el('div', { class: 're43__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var buttons = [];

    function render() {
      var panel = panelById(state.id);
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + panelHeight(panel));
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('The grade function as stored in one container, with the facts the container keeps')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(verdictText(panel))]));
      drawFacts(svg, panel);
      drawRows(svg, panel);
      for (i = 0; i < buttons.length; i++) buttons[i].button.setAttribute('aria-pressed', buttons[i].id === state.id ? 'true' : 'false');
      verdict.textContent = verdictText(panel);
      verdict.setAttribute('data-tone', keptCount(panel) >= 4 ? 'pass' : 'warn');
    }

    var formatRow = el('div', { class: 're43__row re43__row--formats', role: 'group', 'aria-label': 'Container format' });
    DATA.panels.forEach(function (panel) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [panel.label]);
      button.addEventListener('click', function () {
        state.id = panel.id;
        render();
      });
      buttons.push({ id: panel.id, button: button });
      formatRow.appendChild(button);
    });

    host.appendChild(el('div', { class: 'lf re43' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['ONE FUNCTION, FIVE CONTAINERS']), el('span', {}, ['grade from ledger'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're43__note' }, ['Pick a container. The six facts at the top say what that file stores about grade beside its instructions. The listing below is the body of grade as the lesson reader decodes it from the committed fixture.']),
        el('div', {}, [el('div', { class: 're43__group-label' }, ['container']), formatRow]),
        el('div', { class: 're43__scroll' }, [svg]),
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['A filled blue square is a fact the container stores, a hollow square is a fact it has lost. Blue rows are control-flow instructions: jumps and a table in native code and CIL, compare-and-jump pairs in CPython, tableswitch in the JVM, nested blocks and br_table in WebAssembly. Amber rows carry a variable name inside the instruction itself, which only the CPython listing does.'])
    ]));
    render();
  }

  LF.register({ 're-43-five-containers': fiveContainers });
})();
