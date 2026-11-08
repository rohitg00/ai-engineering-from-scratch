/* figures-re-37.js - lesson 37: the reverse engineering field map.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   The timeline rows, the stage names, the per-tool terms, and the evidence numbers
   below come from that command; the test suite checks that this copy matches. */
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
  var MONO = 'var(--font-mono,monospace)';

  var DATA = {"timeline":[{"year":1973,"label":"Hollander (Stanford) and Housel (Purdue) write the first decompilation theses","family":"research","tool":null},{"year":1977,"label":"adb tutorial at Bell Labs; the debugger ships with UNIX V7 in 1979","family":"debugger","tool":null},{"year":1981,"label":"DEBUG with an 8086 disassembler ships in PC-DOS 1.00","family":"debugger","tool":null},{"year":1986,"label":"GDB enters distribution","family":"debugger","tool":null},{"year":1988,"label":"Sourcer commenting disassembler; first GNU binutils snapshots","family":"disassembler","tool":null},{"year":1991,"label":"IDA 0.1 released as shareware on 20 May","family":"disassembler","tool":"ida"},{"year":1994,"label":"Cifuentes, Reverse Compilation Techniques; the dcc decompiler","family":"decompiler","tool":null},{"year":1997,"label":"REC, Reverse Engineering Compiler 1.1","family":"decompiler","tool":null},{"year":2002,"label":"Boomerang open-source decompiler, first code","family":"decompiler","tool":null},{"year":2004,"label":"Flake, Structural Comparison of Executable Objects; BinDiff goes on sale","family":"diffing","tool":null},{"year":2006,"label":"radare starts as a forensic hex editor","family":"disassembler","tool":"radare2"},{"year":2007,"label":"Hex-Rays Decompiler 1.0; Van Emmerik, SSA for decompilation","family":"decompiler","tool":"ida"},{"year":2009,"label":"radare2 r2-0.1, the modular rewrite, LGPL-3.0","family":"framework","tool":"radare2"},{"year":2010,"label":"LLDB announced as an LLVM subproject","family":"debugger","tool":null},{"year":2011,"label":"BAP (CAV); Google acquires zynamics; Hopper appears","family":"framework","tool":null},{"year":2012,"label":"Compiler Explorer starts","family":"compiler-side","tool":null},{"year":2013,"label":"angr first line of code; Phoenix decompiler (USENIX Security)","family":"framework","tool":"angr"},{"year":2015,"label":"DREAM, No More Gotos (NDSS)","family":"research","tool":null},{"year":2015,"label":"Vector 35 founded; Binary Ninja prototype","family":"disassembler","tool":"binja"},{"year":2015,"label":"angr released publicly under BSD-2-Clause","family":"framework","tool":"angr"},{"year":2016,"label":"Binary Ninja on sale with LLIL and a Python API","family":"disassembler","tool":"binja"},{"year":2016,"label":"BinDiff free of charge; angr SoK paper (IEEE S&P)","family":"diffing","tool":null},{"year":2017,"label":"Cutter 1.0, a Qt GUI for radare2","family":"disassembler","tool":"radare2"},{"year":2017,"label":"IDA 7.0 native 64-bit; Binary Ninja MLIL","family":"disassembler","tool":"ida"},{"year":2018,"label":"Guilfanov, Decompiler internals: microcode (Recon)","family":"decompiler","tool":"ida"},{"year":2019,"label":"Ghidra 9.0 released by NSA under Apache-2.0","family":"decompiler","tool":"ghidra"},{"year":2019,"label":"angr 8.19.2.4 adds a preliminary decompiler","family":"decompiler","tool":"angr"},{"year":2020,"label":"Binary Ninja 2.0 with the HLIL decompiler","family":"decompiler","tool":"binja"},{"year":2020,"label":"Rizin announced as a fork of radare2; the Cutter team joins","family":"framework","tool":"rizin"},{"year":2021,"label":"IDA Freeware 7.6 with a cloud x64 decompiler","family":"decompiler","tool":"ida"},{"year":2021,"label":"Cutter 2.0 on rizin; iaito continues for radare2","family":"disassembler","tool":"rizin"},{"year":2023,"label":"BinDiff 8 open-sourced under Apache-2.0","family":"diffing","tool":null},{"year":2024,"label":"SAILR becomes the default angr structurer (USENIX Security)","family":"research","tool":"angr"},{"year":2024,"label":"Binary Ninja 4.0 with the Free edition; IDA 9.0 with idalib","family":"disassembler","tool":"binja"},{"year":2025,"label":"Ghidra 12.0","family":"decompiler","tool":"ghidra"},{"year":2025,"label":"Binary Ninja 5.0; DecompileBench (ACL Findings)","family":"research","tool":"binja"},{"year":2026,"label":"Ghidra 12.1.4 (21 Sep)","family":"decompiler","tool":"ghidra"},{"year":2026,"label":"radare2 6.2.4 (5 Oct)","family":"framework","tool":"radare2"},{"year":2026,"label":"rizin 0.9.1 and Cutter 2.5.0 (June)","family":"framework","tool":"rizin"},{"year":2026,"label":"Binary Ninja 6.0 Krypton (3 Sep)","family":"disassembler","tool":"binja"},{"year":2026,"label":"IDA 9.4 (13 Jul)","family":"disassembler","tool":"ida"},{"year":2026,"label":"angr 10.0.3 (10 Oct)","family":"framework","tool":"angr"},{"year":2026,"label":"LLM decompiler studies: readability metrics; recompile more, preserve less","family":"research","tool":null}],"stages":[{"id":"loader","label":"Loader","what":"Parse the container, map sections, read symbols and relocations."},{"id":"disassembly","label":"Disassembly","what":"Decode bytes into instructions and decide where code starts."},{"id":"cfg","label":"CFG recovery","what":"Cut instructions into basic blocks and add the edges."},{"id":"lifting","label":"Lifting","what":"Translate each instruction into a machine-independent form."},{"id":"ssa","label":"SSA","what":"Give every definition one name so each use points at one definition."},{"id":"dataflow","label":"Data flow and types","what":"Propagate constants, remove dead code, recover arguments, variables, and types."},{"id":"structuring","label":"Structuring","what":"Turn the graph back into if, while, and switch, with goto for the rest."},{"id":"emission","label":"Emission","what":"Print the result as C-like text with names and casts."}],"tools":[{"id":"ghidra","label":"Ghidra","maker":"NSA","version":"12.1.4","licence":"Apache-2.0","ran":true},{"id":"binja","label":"Binary Ninja","maker":"Vector 35","version":"6.0","licence":"commercial, Free edition","ran":false},{"id":"ida","label":"IDA / Hex-Rays","maker":"Hex-Rays","version":"9.4","licence":"commercial, IDA Free","ran":false},{"id":"radare2","label":"radare2","maker":"radareorg","version":"6.2.4","licence":"LGPL-3.0","ran":true},{"id":"rizin","label":"rizin","maker":"rizinorg","version":"0.9.1","licence":"LGPL-3.0","ran":true},{"id":"angr","label":"angr","maker":"UCSB SecLab, ASU SEFCOM","version":"10.0.3","licence":"BSD-2-Clause","ran":true}],"terms":{"loader":{"ghidra":"ElfLoader, MachoLoader, PeLoader; .ldefs picks the language","binja":"BinaryView, BinaryViewType","ida":"Loader module (LDSC)","radare2":"RBin (rabin2)","rizin":"RzBin (rz-bin)","angr":"CLE (cle.Loader, main_object)"},"disassembly":{"ghidra":"Disassembler; SLEIGH .slaspec to .sla; Disassemble Entry Points, Function Start Search","binja":"Architecture plugin; Recursive Descent, then linear sweep phases","ida":"Processor module (ana.cpp, emu.cpp, out.cpp); autoanalysis queues; FLIRT","radare2":"RArch plugin to RAnalOp; aa, aaa, af","rizin":"RzAnalysis plugin; aa, aaa, af","angr":"Capstone blocks; CFGFast function start search"},"cfg":{"ghidra":"Generate Basic Blocks and the CFG; BlockGraph; Decompiler Switch Analysis","binja":"Function, BasicBlock; CFG Analysis phase","ida":"mbl_graph_t, ready at MMAT_LOCOPT","radare2":"afb, agf, aab","rizin":"afb, agf, aab (Nucleus)","angr":"CFGFast, CFGEmulated; kb.functions; IRSB"},"lifting":{"ghidra":"Generate Raw P-code; Varnodes in ram, register, const, unique","binja":"Lifted IL to LLIL to Mapped MLIL to MLIL","ida":"microcode (minsn_t, mop_t); MMAT_GENERATED","radare2":"ESIL (asm.esil, ae)","rizin":"RzIL (aoi, aez)","angr":"VEX (pyvex.lift, IRSB), then AIL"},"ssa":{"ghidra":"Heritage, ActionHeritage; MULTIEQUAL, INDIRECT","binja":"LLIL SSA, MLIL SSA, HLIL SSA; HLIL_VAR_PHI","ida":"no named SSA; use-def data flow in MMAT_GLBOPT1 to 3","radare2":"none; ESIL is built for emulation","rizin":"none; RzIL is built for emulation","angr":"_stage_transform_to_ssa_level0 and level1; SeqNodeDephication"},"dataflow":{"ghidra":"ActionDeadCode, ActionInferTypes, Rule pool; prototype from .cspec","binja":"MLIL constant propagation, variables and types; analyzeReturns","ida":"Transform microcode; MMAT_CALLS, MMAT_GLBOPT, MMAT_LVARS; TIL","radare2":"afv, afc, aaft; ESIL emulation","rizin":"afv, afc, aft","angr":"CallingConventionAnalysis, VariableRecoveryFast, Typehoon"},"structuring":{"ghidra":"CollapseStructure; BlockIf, BlockWhileDo, BlockSwitch, BlockGoto","binja":"HLIL_IF, HLIL_WHILE, HLIL_SWITCH; AST at root","ida":"Generate ctree; structural analysis; goto regions","radare2":"pdc (ESIL plus pseudo); pdd (r2dec); pdg (r2ghidra)","rizin":"pdg (rz-ghidra); jsdec","angr":"RegionIdentifier; RecursiveStructurer with SAILRStructurer"},"emission":{"ghidra":"Emit Final C Tokens; PrintC, ActionNameVars, ActionSetCasts","binja":"HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python","ida":"Beautify ctree; Print ctree; cfunc_t","radare2":"text of pdc, pdd, pdg","rizin":"pdg text","angr":"CStructuredCodeGenerator; codegen.text"}},"evidence":{"radare2":{"o1Blocks":[3,3,5,4],"o0GradeBlocks":3,"o0GradeEdges":2,"trapLookupInstructions":6,"inventedFunctions":0},"rizin":{"o1Blocks":[3,3,5,4],"o0GradeBlocks":8,"o0GradeEdges":11,"trapLookupInstructions":6,"inventedFunctions":0},"angr":{"o1Blocks":[3,3,5,4],"o0GradeBlocks":8,"o0GradeEdges":7,"trapLookupInstructions":8,"inventedFunctions":9},"ghidra":{"o1Blocks":[3,3,5,4],"o0GradeBlocks":9,"o0GradeEdges":12,"trapLookupInstructions":6,"inventedFunctions":0}}};

  var W = 520;
  var AXIS_Y = 118;
  var LEFT = 22;
  var RIGHT = 14;
  var YEAR_MIN = 1970;
  var YEAR_MAX = 2030;
  var DOT = 5;
  var STACK = 12;
  var FAMILY_GLYPH = {
    research: 'circle',
    debugger: 'square',
    disassembler: 'square',
    decompiler: 'diamond',
    framework: 'triangle',
    diffing: 'circle',
    'compiler-side': 'circle'
  };

  function ensureStyles() {
    if (document.getElementById('re37-styles')) return;
    var style = document.createElement('style');
    style.id = 're37-styles';
    style.textContent = [
      '.re37 *{box-sizing:border-box}',
      '.re37__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re37__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin:12px 0 6px}',
      '.re37__row{display:flex;flex-wrap:wrap;gap:8px}',
      '.re37 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re37 button:active{transform:scale(.96)}',
      '.re37 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re37 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re37 button[data-ran="false"]{border-style:dashed}',
      '.re37__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re37__scroll svg{display:block;min-width:500px;width:100%;height:auto}',
      '.re37__current{margin-top:10px;min-height:2.6em;font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.5;color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word}',
      '.re37__verdict{margin-top:8px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re37__verdict[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '.re37__grid-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re37__grid{border-collapse:collapse;width:100%;min-width:760px;font-family:var(--font-mono,monospace);font-size:.72rem;line-height:1.4}',
      '.re37__grid th,.re37__grid td{border:1px solid var(--rule-soft,#ddd);padding:6px 7px;text-align:left;vertical-align:top;color:var(--ink,#1a1a1a)}',
      '.re37__grid th{background:var(--bg-surface,#f3f1e8);font-weight:600}',
      '.re37__grid th button{min-height:0;padding:4px 6px;width:100%;text-align:left;border-color:transparent;background:transparent}',
      '.re37__grid th button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff)}',
      '.re37__stage{width:150px;background:var(--bg-surface,#f3f1e8);position:relative}',
      '.re37__stage small{display:block;color:var(--ink-mute,#777);font-weight:400;margin-top:3px}',
      '.re37__stage .re37__step{display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:50%;background:var(--ink,#1a1a1a);color:var(--bg,#fafaf5);font-size:.66rem;margin-right:6px}',
      '.re37__grid td.re37__cell{cursor:pointer;color:var(--ink-soft,#555)}',
      '.re37__grid td.re37__cell:hover,.re37__grid td.re37__cell:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:-2px}',
      '.re37__grid .is-selected{background:var(--blueprint-tint,rgba(53,83,255,.08));color:var(--ink,#1a1a1a)}',
      '.re37__grid th.is-selected{background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re37__grid th.is-selected button{color:var(--bg,#fafaf5)}',
      '.re37__grid .is-dim{opacity:.55}',
      '.re37 .re37__dot{cursor:pointer;transition:fill 150ms ease,stroke 150ms ease}',
      '.re37 .re37__dot:focus{outline:none}',
      '.re37 .re37__dot:focus-visible circle,.re37 .re37__dot:focus-visible rect,.re37 .re37__dot:focus-visible path{stroke:var(--ink,#1a1a1a);stroke-width:2}',
      '@media (hover:hover) and (pointer:fine){.re37 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re37__row--tools{display:grid;grid-template-columns:1fr 1fr}.re37 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re37 button,.re37 .re37__dot{transition:none!important}.re37 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function text(x, y, s, fill, anchor, size) {
    return svgEl('text', {
      x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO,
      'font-size': String(size || 11.5), fill: fill || INK
    }, [document.createTextNode(s)]);
  }

  function yearX(year) {
    return LEFT + (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN) * (W - LEFT - RIGHT);
  }

  function toolById(id) {
    var i;
    for (i = 0; i < DATA.tools.length; i++) if (DATA.tools[i].id === id) return DATA.tools[i];
    return null;
  }

  function stackTimeline() {
    var perYear = {};
    var placed = [];
    var i;
    for (i = 0; i < DATA.timeline.length; i++) {
      var entry = DATA.timeline[i];
      var level = perYear[entry.year] || 0;
      perYear[entry.year] = level + 1;
      placed.push({ entry: entry, index: i, level: level });
    }
    var maxLevel = 0;
    var year;
    for (year in perYear) if (Object.prototype.hasOwnProperty.call(perYear, year) && perYear[year] - 1 > maxLevel) maxLevel = perYear[year] - 1;
    return { placed: placed, maxLevel: maxLevel };
  }

  var STACKED = stackTimeline();
  var SVG_H = AXIS_Y + 34;

  function glyph(kind, cx, cy, fill, stroke) {
    var attrs = { fill: fill, stroke: stroke, 'stroke-width': '1' };
    if (kind === 'square') {
      attrs.x = cx - DOT; attrs.y = cy - DOT; attrs.width = DOT * 2; attrs.height = DOT * 2;
      return svgEl('rect', attrs);
    }
    if (kind === 'diamond') {
      attrs.d = 'M' + cx + ' ' + (cy - DOT - 1) + 'L' + (cx + DOT + 1) + ' ' + cy + 'L' + cx + ' ' + (cy + DOT + 1) + 'L' + (cx - DOT - 1) + ' ' + cy + 'z';
      return svgEl('path', attrs);
    }
    if (kind === 'triangle') {
      attrs.d = 'M' + cx + ' ' + (cy - DOT - 1) + 'L' + (cx + DOT + 1) + ' ' + (cy + DOT) + 'L' + (cx - DOT - 1) + ' ' + (cy + DOT) + 'z';
      return svgEl('path', attrs);
    }
    attrs.cx = cx; attrs.cy = cy; attrs.r = DOT;
    return svgEl('circle', attrs);
  }

  function fieldMap(host) {
    ensureStyles();
    var state = { tool: null, event: null, stage: null };
    var titleId = LF.uid('lf-re37-title');
    var descId = LF.uid('lf-re37-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + SVG_H, role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var current = el('div', { class: 're37__current' });
    var verdict = el('div', { class: 're37__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var toolButtons = [];
    var headerCells = {};
    var bodyCells = [];
    var table = el('table', { class: 're37__grid' });

    function selectTool(id) {
      state.tool = state.tool === id ? null : id;
      state.event = null;
      render();
    }

    function eventText(entry) {
      var tool = entry.tool ? toolById(entry.tool) : null;
      return entry.year + '  ' + entry.label + '  [' + entry.family + (tool ? ', ' + tool.label : '') + ']';
    }

    function drawTimeline() {
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Timeline of reverse engineering tools and papers from 1973 to 2026')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(DATA.timeline.length + ' dated events. Squares are disassemblers and debuggers, diamonds are decompilers, triangles are frameworks, circles are research, diffing, and compiler-side tools.')]));
      svg.appendChild(svgEl('line', { x1: LEFT, y1: AXIS_Y, x2: W - RIGHT, y2: AXIS_Y, stroke: INK, 'stroke-width': '1' }));
      var year;
      for (year = YEAR_MIN; year <= YEAR_MAX; year += 10) {
        var x = yearX(year);
        svg.appendChild(svgEl('line', { x1: x, y1: AXIS_Y - 4, x2: x, y2: AXIS_Y + 4, stroke: INK, 'stroke-width': '1' }));
        svg.appendChild(text(x, AXIS_Y + 18, String(year), MUTE, 'middle', 11));
      }
      for (year = YEAR_MIN; year <= YEAR_MAX; year += 1) {
        if (year % 10 === 0) continue;
        svg.appendChild(svgEl('line', { x1: yearX(year), y1: AXIS_Y - 2, x2: yearX(year), y2: AXIS_Y + 2, stroke: RULE, 'stroke-width': '1' }));
      }
      for (i = 0; i < STACKED.placed.length; i++) {
        var item = STACKED.placed[i];
        var entry = item.entry;
        var cx = yearX(entry.year);
        var cy = AXIS_Y - 10 - item.level * STACK;
        var selectedTool = state.tool !== null && entry.tool === state.tool;
        var selectedEvent = state.event === item.index;
        var fill = SURF;
        var stroke = MUTE;
        if (selectedTool) { fill = BP; stroke = BP; }
        if (selectedEvent) { fill = selectedTool ? BP : INK; stroke = INK; }
        if (state.tool !== null && !selectedTool && !selectedEvent) { fill = SURF; stroke = RULE; }
        var g = svgEl('g', { class: 're37__dot', role: 'button', tabindex: '0', 'aria-label': eventText(entry), 'data-index': String(item.index) });
        g.appendChild(glyph(FAMILY_GLYPH[entry.family] || 'circle', cx, cy, fill, stroke));
        g.appendChild(svgEl('title', {}, [document.createTextNode(eventText(entry))]));
        g.addEventListener('click', onDot);
        g.addEventListener('keydown', onDotKey);
        svg.appendChild(g);
      }
      svg.appendChild(text(LEFT, 12, 'one mark per dated event, stacked when a year has several', MUTE, 'start', 11));
    }

    function onDot(event) {
      var index = Number(event.currentTarget.getAttribute('data-index'));
      state.event = state.event === index ? null : index;
      state.stage = null;
      render();
    }

    function onDotKey(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onDot(event);
      }
    }

    function buildTable() {
      var head = el('thead');
      var headRow = el('tr');
      headRow.appendChild(el('th', { class: 're37__stage', scope: 'col' }, ['stage']));
      DATA.tools.forEach(function (tool) {
        var button = el('button', { type: 'button', 'aria-pressed': 'false', 'data-ran': tool.ran ? 'true' : 'false' }, [tool.label]);
        button.addEventListener('click', function () { selectTool(tool.id); });
        var th = el('th', { scope: 'col' }, [button]);
        headerCells[tool.id] = { th: th, button: button };
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = el('tbody');
      DATA.stages.forEach(function (stage, position) {
        var row = el('tr');
        var stageCell = el('th', { class: 're37__stage', scope: 'row' }, [
          el('span', { class: 're37__step' }, [String(position + 1)]),
          stage.label,
          el('small', {}, [stage.what])
        ]);
        row.appendChild(stageCell);
        DATA.tools.forEach(function (tool) {
          var cell = el('td', { class: 're37__cell', tabindex: '0', 'data-tool': tool.id, 'data-stage': stage.id }, [DATA.terms[stage.id][tool.id]]);
          cell.addEventListener('click', function () { state.tool = tool.id; state.stage = stage.id; state.event = null; render(); });
          cell.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.tool = tool.id; state.stage = stage.id; state.event = null; render(); }
          });
          bodyCells.push({ cell: cell, tool: tool.id, stage: stage.id });
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
      table.appendChild(body);
    }

    function evidenceText(tool) {
      var e = DATA.evidence[tool.id];
      if (!tool.ran || !e) return tool.label + ' ' + tool.version + ', ' + tool.licence + '. Not run for this lesson; the terms come from its documentation.';
      var parts = [tool.label + ' ' + tool.version + ', ' + tool.licence + ', run on the fixtures'];
      parts.push('blocks on ledger -O1: ' + e.o1Blocks.join('/'));
      parts.push('grade at -O0: ' + e.o0GradeBlocks + ' blocks, ' + e.o0GradeEdges + ' edges');
      parts.push('lookup in sweep-trap: ' + e.trapLookupInstructions + ' instructions');
      parts.push('functions invented with no symbol: ' + e.inventedFunctions);
      return parts.join('. ') + '.';
    }

    function render() {
      var i;
      drawTimeline();
      for (i = 0; i < toolButtons.length; i++) toolButtons[i].button.setAttribute('aria-pressed', toolButtons[i].id === state.tool ? 'true' : 'false');
      var id;
      for (id in headerCells) {
        if (!Object.prototype.hasOwnProperty.call(headerCells, id)) continue;
        headerCells[id].button.setAttribute('aria-pressed', id === state.tool ? 'true' : 'false');
        headerCells[id].th.className = id === state.tool ? 'is-selected' : (state.tool !== null ? 'is-dim' : '');
      }
      for (i = 0; i < bodyCells.length; i++) {
        var item = bodyCells[i];
        var cls = 're37__cell';
        if (state.tool !== null && item.tool === state.tool) cls += ' is-selected';
        else if (state.tool !== null) cls += ' is-dim';
        item.cell.className = cls;
      }
      if (state.event !== null) {
        current.textContent = eventText(DATA.timeline[state.event]);
      } else if (state.tool !== null && state.stage !== null) {
        var stage = null;
        for (i = 0; i < DATA.stages.length; i++) if (DATA.stages[i].id === state.stage) stage = DATA.stages[i];
        current.textContent = stage.label + ': ' + stage.what + '\n' + toolById(state.tool).label + ' calls it: ' + DATA.terms[state.stage][state.tool];
      } else if (state.tool !== null) {
        var count = 0;
        for (i = 0; i < DATA.timeline.length; i++) if (DATA.timeline[i].tool === state.tool) count++;
        current.textContent = toolById(state.tool).label + ': ' + count + ' dated events on the timeline, one column in the pipeline. Click a cell for the stage and the term.';
      } else {
        current.textContent = 'Click a tool to light its column and its timeline marks. Click a mark for the event. Click a cell for the term a tool uses at that stage.';
      }
      var tool = state.tool !== null ? toolById(state.tool) : null;
      if (tool) {
        verdict.textContent = evidenceText(tool);
        verdict.setAttribute('data-tone', tool.ran ? 'pass' : 'warn');
      } else {
        var ran = 0;
        for (i = 0; i < DATA.tools.length; i++) if (DATA.tools[i].ran) ran++;
        verdict.textContent = DATA.timeline.length + ' dated events, ' + DATA.stages.length + ' pipeline stages, ' + DATA.tools.length + ' tools. ' + ran + ' of the tools ran on the lesson fixtures; the other ' + (DATA.tools.length - ran) + ' are described from their documentation.';
        verdict.setAttribute('data-tone', 'pass');
      }
    }

    var toolRow = el('div', { class: 're37__row re37__row--tools', role: 'group', 'aria-label': 'Tool' });
    DATA.tools.forEach(function (tool) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false', 'data-ran': tool.ran ? 'true' : 'false' }, [tool.label + (tool.ran ? '' : ' (docs only)')]);
      button.addEventListener('click', function () { selectTool(tool.id); });
      toolButtons.push({ id: tool.id, button: button });
      toolRow.appendChild(button);
    });
    var clearButton = el('button', { type: 'button' }, ['clear']);
    clearButton.addEventListener('click', function () { state.tool = null; state.event = null; state.stage = null; render(); });
    toolRow.appendChild(clearButton);

    buildTable();

    host.appendChild(el('div', { class: 'lf re37' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['THE FIELD MAP']), el('span', {}, ['1973 to 2026, eight stages, six tools'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're37__note' }, ['The top strip is the history of the field, one mark per dated event. The table below is the decompiler pipeline from loader to emitted C. Each row is one stage, each column is one tool, and each cell is the name that tool gives the stage. Pick a tool to light its column and its marks.']),
        el('div', { class: 're37__group-label' }, ['tool']),
        toolRow,
        el('div', { class: 're37__group-label' }, ['timeline']),
        el('div', { class: 're37__scroll' }, [svg]),
        el('div', { class: 're37__group-label' }, ['pipeline']),
        el('div', { class: 're37__grid-wrap' }, [table]),
        current,
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Blue marks and the blue column belong to the selected tool. Dashed buttons mark tools that were not run for this lesson. The evidence line reports what the harness in code/main.py measured for the selected tool on the lesson fixtures: block counts on ledger at -O1, the jump table in grade at -O0, the data bytes in sweep-trap, and functions invented with no symbol.'])
    ]));
    render();
  }

  LF.register({ 're-37-field-map': fieldMap });
})();
