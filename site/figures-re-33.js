/* figures-re-33.js - lesson 33: linear sweep versus recursive descent over grade.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every address, byte, block, and edge below comes from the decoder in that lesson
   run over ledger-x86_64-O0.o. The test suite checks that this copy matches. */
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

  var DATA = {"function":"grade","start":48,"end":166,"gapEnd":176,"instructions":[{"a":48,"n":1,"b":"55","t":"pushq %rbp","f":"next","g":null},{"a":49,"n":3,"b":"48 89 e5","t":"movq %rsp, %rbp","f":"next","g":null},{"a":52,"n":3,"b":"89 7d f8","t":"movl %edi, -0x8(%rbp)","f":"next","g":null},{"a":55,"n":4,"b":"48 63 45 f8","t":"movslq -0x8(%rbp), %rax","f":"next","g":null},{"a":59,"n":7,"b":"48 69 c0 67 66 66 66","t":"imulq $0x66666667, %rax, %rax","f":"next","g":null},{"a":66,"n":3,"b":"48 89 c1","t":"movq %rax, %rcx","f":"next","g":null},{"a":69,"n":4,"b":"48 c1 f9 22","t":"sarq $0x22, %rcx","f":"next","g":null},{"a":73,"n":2,"b":"89 ca","t":"movl %ecx, %edx","f":"next","g":null},{"a":75,"n":4,"b":"48 c1 e8 3f","t":"shrq $0x3f, %rax","f":"next","g":null},{"a":79,"n":2,"b":"89 c1","t":"movl %eax, %ecx","f":"next","g":null},{"a":81,"n":2,"b":"89 d0","t":"movl %edx, %eax","f":"next","g":null},{"a":83,"n":4,"b":"8d 44 08 fa","t":"leal -0x6(%rax,%rcx), %eax","f":"next","g":null},{"a":87,"n":2,"b":"89 c1","t":"movl %eax, %ecx","f":"next","g":null},{"a":89,"n":4,"b":"48 89 4d f0","t":"movq %rcx, -0x10(%rbp)","f":"next","g":null},{"a":93,"n":3,"b":"83 e8 04","t":"subl $0x4, %eax","f":"next","g":null},{"a":96,"n":2,"b":"77 38","t":"ja 0x9a","f":"branch","g":154},{"a":98,"n":4,"b":"48 8b 45 f0","t":"movq -0x10(%rbp), %rax","f":"next","g":null},{"a":102,"n":7,"b":"48 8d 0d 00 00 00 00","t":"leaq (%rip), %rcx","f":"next","g":null},{"a":109,"n":4,"b":"48 63 04 81","t":"movslq (%rcx,%rax,4), %rax","f":"next","g":null},{"a":113,"n":3,"b":"48 01 c8","t":"addq %rcx, %rax","f":"next","g":null},{"a":116,"n":2,"b":"ff e0","t":"jmpq *%rax","f":"indirect-jump","g":null},{"a":118,"n":7,"b":"c7 45 fc 04 00 00 00","t":"movl $0x4, -0x4(%rbp)","f":"next","g":null},{"a":125,"n":2,"b":"eb 22","t":"jmp 0xa1","f":"jump","g":161},{"a":127,"n":7,"b":"c7 45 fc 03 00 00 00","t":"movl $0x3, -0x4(%rbp)","f":"next","g":null},{"a":134,"n":2,"b":"eb 19","t":"jmp 0xa1","f":"jump","g":161},{"a":136,"n":7,"b":"c7 45 fc 02 00 00 00","t":"movl $0x2, -0x4(%rbp)","f":"next","g":null},{"a":143,"n":2,"b":"eb 10","t":"jmp 0xa1","f":"jump","g":161},{"a":145,"n":7,"b":"c7 45 fc 01 00 00 00","t":"movl $0x1, -0x4(%rbp)","f":"next","g":null},{"a":152,"n":2,"b":"eb 07","t":"jmp 0xa1","f":"jump","g":161},{"a":154,"n":7,"b":"c7 45 fc 00 00 00 00","t":"movl $0x0, -0x4(%rbp)","f":"next","g":null},{"a":161,"n":3,"b":"8b 45 fc","t":"movl -0x4(%rbp), %eax","f":"next","g":null},{"a":164,"n":1,"b":"5d","t":"popq %rbp","f":"next","g":null},{"a":165,"n":1,"b":"c3","t":"retq","f":"return","g":null},{"a":166,"n":10,"b":"66 2e 0f 1f 84 00 00 00 00 00","t":"nopw %cs:(%rax,%rax)","f":"next","g":null}],"layers":{"48":0,"98":1,"145":2,"136":2,"127":2,"118":2,"154":1,"161":3,"166":4},"table":{"at":".rodata+0x0","count":5,"targets":[118,127,136,145],"jump":116},"methods":{"linear":{"order":[48,49,52,55,59,66,69,73,75,79,81,83,87,89,93,96,98,102,109,113,116,118,125,127,134,136,143,145,152,154,161,164,165,166],"blocks":[{"s":48,"e":98,"n":16},{"s":98,"e":118,"n":5},{"s":118,"e":127,"n":2},{"s":127,"e":136,"n":2},{"s":136,"e":145,"n":2},{"s":145,"e":154,"n":2},{"s":154,"e":161,"n":1},{"s":161,"e":166,"n":3},{"s":166,"e":176,"n":1}],"edges":[{"f":48,"t":154,"k":"taken"},{"f":48,"t":98,"k":"fallthrough"},{"f":118,"t":161,"k":"jump"},{"f":127,"t":161,"k":"jump"},{"f":136,"t":161,"k":"jump"},{"f":145,"t":161,"k":"jump"},{"f":154,"t":161,"k":"fallthrough"}]},"descent":{"order":[48,49,52,55,59,66,69,73,75,79,81,83,87,89,93,96,98,102,109,113,116,154,161,164,165],"blocks":[{"s":48,"e":98,"n":16},{"s":98,"e":118,"n":5},{"s":154,"e":166,"n":4}],"edges":[{"f":48,"t":154,"k":"taken"},{"f":48,"t":98,"k":"fallthrough"}],"unresolved":[116]},"table":{"order":[48,49,52,55,59,66,69,73,75,79,81,83,87,89,93,96,98,102,109,113,116,118,125,161,164,165,127,134,136,143,145,152,154],"blocks":[{"s":48,"e":98,"n":16},{"s":98,"e":118,"n":5},{"s":118,"e":127,"n":2},{"s":127,"e":136,"n":2},{"s":136,"e":145,"n":2},{"s":145,"e":154,"n":2},{"s":154,"e":161,"n":1},{"s":161,"e":166,"n":3}],"edges":[{"f":48,"t":154,"k":"taken"},{"f":48,"t":98,"k":"fallthrough"},{"f":98,"t":118,"k":"table"},{"f":98,"t":127,"k":"table"},{"f":98,"t":136,"k":"table"},{"f":98,"t":145,"k":"table"},{"f":118,"t":161,"k":"jump"},{"f":127,"t":161,"k":"jump"},{"f":136,"t":161,"k":"jump"},{"f":145,"t":161,"k":"jump"},{"f":154,"t":161,"k":"fallthrough"}],"unresolved":[]}}};

  var METHODS = [
    { id: 'linear', label: 'linear sweep', verdict: 'linear sweep' },
    { id: 'descent', label: 'recursive descent', verdict: 'recursive descent' },
    { id: 'table', label: 'descent + jump table', verdict: 'descent with the jump table' }
  ];

  var W = 520;
  var STRIP_X = 40;
  var STRIP_Y = 18;
  var CELL = 13;
  var PITCH = 15;
  var PER_ROW = 32;
  var CFG_Y = 104;
  var ROW_PITCH = 72;
  var BOX_H = 46;
  var MARGIN_X = 18;
  var GAP = 12;

  function ensureStyles() {
    if (document.getElementById('re33-styles')) return;
    var style = document.createElement('style');
    style.id = 're33-styles';
    style.textContent = [
      '.re33 *{box-sizing:border-box}',
      '.re33__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re33__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re33__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re33__row{display:flex;flex-wrap:wrap;gap:8px}',
      '.re33 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re33 button:active{transform:scale(.96)}',
      '.re33 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re33 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re33 button[disabled]{opacity:.45;cursor:default}',
      '.re33__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re33__scroll svg{display:block;min-width:500px;width:100%;height:auto}',
      '.re33__current{margin-top:10px;font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.5;color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word}',
      '.re33__verdict{margin-top:8px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re33__verdict[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '.re33 .re33__cell{transition:fill 150ms ease}',
      '@media (hover:hover) and (pointer:fine){.re33 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re33__row--methods{display:grid;grid-template-columns:1fr}.re33 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re33 button,.re33 .re33__cell{transition:none!important}.re33 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function hex(n) { return '0x' + n.toString(16); }

  function text(x, y, s, fill, anchor, size) {
    return svgEl('text', {
      x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO,
      'font-size': String(size || 12), fill: fill || INK
    }, [document.createTextNode(s)]);
  }

  function indexInstructions() {
    var byAddress = {};
    var i;
    for (i = 0; i < DATA.instructions.length; i++) byAddress[DATA.instructions[i].a] = DATA.instructions[i];
    return byAddress;
  }

  var INSN = indexInstructions();

  function lastInstruction(block) {
    var i;
    for (i = 0; i < DATA.instructions.length; i++) {
      var insn = DATA.instructions[i];
      if (insn.a >= block.s && insn.a + insn.n === block.e) return insn;
    }
    return null;
  }

  function allBlockSlots() {
    var slots = {};
    var ids = ['table', 'linear', 'descent'];
    var i, j;
    for (i = 0; i < ids.length; i++) {
      var blocks = DATA.methods[ids[i]].blocks;
      for (j = 0; j < blocks.length; j++) {
        if (!slots[blocks[j].s]) slots[blocks[j].s] = blocks[j];
      }
    }
    return slots;
  }

  var SLOTS = allBlockSlots();

  function layoutBoxes() {
    var rows = {};
    var starts = Object.keys(SLOTS).map(Number).sort(function (a, b) { return a - b; });
    var i;
    for (i = 0; i < starts.length; i++) {
      var layer = DATA.layers[String(starts[i])];
      if (layer === undefined) layer = 0;
      if (!rows[layer]) rows[layer] = [];
      rows[layer].push(starts[i]);
    }
    var boxes = {};
    var layers = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    var maxLayer = layers.length ? layers[layers.length - 1] : 0;
    for (i = 0; i < layers.length; i++) {
      var members = rows[layers[i]];
      var count = members.length;
      var width = Math.min(112, Math.floor((W - 2 * MARGIN_X - GAP * (count - 1)) / count));
      var total = width * count + GAP * (count - 1);
      var left = Math.round((W - total) / 2);
      var j;
      for (j = 0; j < count; j++) {
        boxes[members[j]] = { x: left + j * (width + GAP), y: CFG_Y + layers[i] * ROW_PITCH, w: width, h: BOX_H, layer: layers[i] };
      }
    }
    return { boxes: boxes, height: CFG_Y + (maxLayer + 1) * ROW_PITCH - (ROW_PITCH - BOX_H) + 14 };
  }

  var LAYOUT = layoutBoxes();

  function claimedSet(method, step) {
    var order = DATA.methods[method].order;
    var claimed = {};
    var i;
    for (i = 0; i < step && i < order.length; i++) claimed[order[i]] = true;
    return claimed;
  }

  function byteOwner(claimed) {
    var owner = {};
    var address;
    for (address in claimed) {
      if (!Object.prototype.hasOwnProperty.call(claimed, address)) continue;
      var insn = INSN[address];
      var k;
      for (k = 0; k < insn.n; k++) owner[insn.a + k] = insn.a;
    }
    return owner;
  }

  function foundBlocks(method, claimed) {
    var blocks = DATA.methods[method].blocks;
    var found = [];
    var i;
    for (i = 0; i < blocks.length; i++) if (claimed[blocks[i].s]) found.push(blocks[i]);
    return found;
  }

  function foundEdges(method, claimed) {
    var data = DATA.methods[method];
    var ends = {};
    var i;
    for (i = 0; i < data.blocks.length; i++) {
      var last = lastInstruction(data.blocks[i]);
      if (last) ends[data.blocks[i].s] = last.a;
    }
    var edges = [];
    for (i = 0; i < data.edges.length; i++) {
      var edge = data.edges[i];
      if (ends[edge.f] !== undefined && claimed[ends[edge.f]]) edges.push(edge);
    }
    return edges;
  }

  function summarize(method, step) {
    var claimed = claimedSet(method, step);
    var order = DATA.methods[method].order;
    var codeBytes = 0;
    var padBytes = 0;
    var address;
    for (address in claimed) {
      if (!Object.prototype.hasOwnProperty.call(claimed, address)) continue;
      var insn = INSN[address];
      if (insn.a >= DATA.end) padBytes += insn.n; else codeBytes += insn.n;
    }
    var jump = DATA.table ? DATA.table.jump : null;
    return {
      claimed: claimed,
      step: Math.min(step, order.length),
      total: order.length,
      done: step >= order.length,
      codeBytes: codeBytes,
      codeTotal: DATA.end - DATA.start,
      padBytes: padBytes,
      padTotal: DATA.gapEnd - DATA.end,
      blocks: foundBlocks(method, claimed),
      edges: foundEdges(method, claimed),
      jumpClaimed: jump !== null && !!claimed[jump],
      current: step > 0 ? INSN[order[Math.min(step, order.length) - 1]] : null
    };
  }

  function setDisabled(button, disabled) {
    if (disabled) button.setAttribute('disabled', 'disabled'); else button.removeAttribute('disabled');
  }

  function verdictText(method, summary) {
    var name = METHODS[methodIndex(method)].verdict;
    var parts = [summary.blocks.length + (summary.blocks.length === 1 ? ' block' : ' blocks'), summary.edges.length + (summary.edges.length === 1 ? ' edge' : ' edges')];
    parts.push(summary.codeBytes + ' of ' + summary.codeTotal + ' code bytes');
    if (summary.padBytes > 0) parts.push(summary.padBytes + ' padding bytes decoded as code');
    if (summary.done && summary.codeBytes < summary.codeTotal) parts.push((summary.codeTotal - summary.codeBytes) + ' code bytes never reached');
    if (summary.jumpClaimed && DATA.table) {
      if (method === 'table') parts.push(DATA.table.targets.length + ' targets read from ' + DATA.table.at);
      else parts.push('jmpq *%rax at ' + hex(DATA.table.jump) + ' unresolved');
    }
    var head = summary.done ? name + ', finished: ' : name + ', step ' + summary.step + ' of ' + summary.total + ': ';
    return head + parts.join(', ') + '.';
  }

  function methodIndex(id) {
    var i;
    for (i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return i;
    return 0;
  }

  function drawStrip(svg, summary) {
    var owner = byteOwner(summary.claimed);
    var current = summary.current;
    var total = DATA.gapEnd - DATA.start;
    var i;
    for (i = 0; i < total; i++) {
      var address = DATA.start + i;
      var row = Math.floor(i / PER_ROW);
      var col = i % PER_ROW;
      if (col === 0) svg.appendChild(text(STRIP_X - 5, STRIP_Y + row * PITCH + 11, hex(address), MUTE, 'end', 11.5));
      var pad = address >= DATA.end;
      var fill = pad ? RULE : SURF;
      var stroke = RULE;
      if (owner[address] !== undefined) fill = pad ? WARN : BP;
      if (current && address >= current.a && address < current.a + current.n) stroke = INK;
      svg.appendChild(svgEl('rect', {
        class: 're33__cell', x: STRIP_X + col * PITCH, y: STRIP_Y + row * PITCH, width: CELL, height: CELL,
        fill: fill, stroke: stroke, 'stroke-width': stroke === INK ? '1.5' : '1'
      }));
    }
    svg.appendChild(text(STRIP_X, STRIP_Y + 4 * PITCH + 14, 'bytes ' + hex(DATA.start) + ' to ' + hex(DATA.gapEnd) + ', code ends at ' + hex(DATA.end), MUTE, 'start', 11.5));
  }

  function blockLines(block) {
    var last = lastInstruction(block);
    var count = block.n;
    var lines = [hex(block.s) + '-' + hex(block.e), count + ' insn, ' + (block.e - block.s) + ' B'];
    if (block.s >= DATA.end) lines.push('padding');
    else if (last && (last.f === 'jump' || last.f === 'branch' || last.f === 'return' || last.f === 'indirect-jump')) lines.push(last.t.length > 16 ? last.t.split(' ')[0] : last.t);
    else lines.push('falls to ' + hex(block.e));
    return lines;
  }

  function drawBoxes(svg, summary) {
    var found = {};
    var i;
    for (i = 0; i < summary.blocks.length; i++) found[summary.blocks[i].s] = summary.blocks[i];
    var starts = Object.keys(LAYOUT.boxes).map(Number);
    for (i = 0; i < starts.length; i++) {
      var start = starts[i];
      var box = LAYOUT.boxes[start];
      var block = found[start] || SLOTS[start];
      var isFound = !!found[start];
      var isPad = start >= DATA.end;
      var stroke = isFound ? (isPad ? WARN : BP) : RULE;
      var g = svgEl('g', { opacity: isFound ? '1' : '0.75' });
      g.appendChild(svgEl('rect', {
        x: box.x, y: box.y, width: box.w, height: box.h, rx: 3,
        fill: isFound ? SURF : BG, stroke: stroke, 'stroke-width': isFound ? '1.5' : '1',
        'stroke-dasharray': isFound ? 'none' : '4 3'
      }));
      var lines = blockLines(block);
      var color = isFound ? INK : MUTE;
      g.appendChild(text(box.x + 6, box.y + 15, lines[0], isFound ? (isPad ? WARN : BP) : MUTE));
      g.appendChild(text(box.x + 6, box.y + 28, lines[1], color));
      g.appendChild(text(box.x + 6, box.y + 41, lines[2], color));
      svg.appendChild(g);
    }
  }

  function drawEdges(svg, summary, markerId) {
    var incoming = {};
    var i;
    for (i = 0; i < summary.edges.length; i++) {
      var t = summary.edges[i].t;
      if (!incoming[t]) incoming[t] = [];
      incoming[t].push(summary.edges[i].f);
    }
    for (i = 0; i < summary.edges.length; i++) {
      var edge = summary.edges[i];
      var from = LAYOUT.boxes[edge.f];
      var to = LAYOUT.boxes[edge.t];
      if (!from || !to) continue;
      var into = incoming[edge.t];
      var slot = into.indexOf(edge.f);
      var spread = (slot - (into.length - 1) / 2) * 12;
      var attrs = { fill: 'none', stroke: BP, 'stroke-width': '1.5', 'marker-end': 'url(#' + markerId + ')' };
      if (edge.k === 'table') attrs['stroke-dasharray'] = '5 3';
      var sx = from.x + from.w / 2;
      var sy = from.y + from.h;
      var tx = to.x + to.w / 2 + spread;
      var ty = to.y;
      var points;
      if (edge.f === edge.t) {
        points = [[from.x, from.y + from.h - 8], [from.x - 10, from.y + from.h - 8], [from.x - 10, from.y + 8], [from.x, from.y + 8]];
      } else if (to.layer === from.layer + 1) {
        points = [[sx, sy], [tx, ty - 2]];
      } else if (to.layer > from.layer + 1) {
        var marginX = sx >= W / 2 ? W - 6 : 6;
        var midY = sy + 12;
        points = [[sx, sy], [sx, midY], [marginX, midY], [marginX, to.y + to.h / 2], [marginX > W / 2 ? to.x + to.w + 2 : to.x - 2, to.y + to.h / 2]];
      } else {
        points = [[from.x, from.y + from.h / 2], [6, from.y + from.h / 2], [6, to.y + to.h / 2], [to.x - 2, to.y + to.h / 2]];
      }
      var d = '';
      var p;
      for (p = 0; p < points.length; p++) d += (p === 0 ? 'M' : 'L') + points[p][0].toFixed(1) + ' ' + points[p][1].toFixed(1);
      attrs.d = d;
      svg.appendChild(svgEl('path', attrs));
    }
  }

  function sweepVersusDescent(host) {
    ensureStyles();
    var state = { method: 'linear', step: DATA.methods.linear.order.length };
    var titleId = LF.uid('lf-re33-title');
    var descId = LF.uid('lf-re33-desc');
    var markerId = LF.uid('lf-re33-arrow');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + LAYOUT.height, role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var current = el('div', { class: 're33__current' });
    var verdict = el('div', { class: 're33__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var methodButtons = [];
    var stepButton = el('button', { type: 'button' }, ['step']);
    var runButton = el('button', { type: 'button' }, ['run to end']);
    var resetButton = el('button', { type: 'button' }, ['reset']);

    function render() {
      var summary = summarize(state.method, state.step);
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Bytes claimed and control-flow graph of grade under one disassembly method')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(verdictText(state.method, summary))]));
      var defs = svgEl('defs');
      var marker = svgEl('marker', { id: markerId, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
      marker.appendChild(svgEl('path', { d: 'M0 0L10 5L0 10z', fill: BP }));
      defs.appendChild(marker);
      svg.appendChild(defs);
      drawStrip(svg, summary);
      drawEdges(svg, summary, markerId);
      drawBoxes(svg, summary);
      for (i = 0; i < methodButtons.length; i++) methodButtons[i].button.setAttribute('aria-pressed', methodButtons[i].id === state.method ? 'true' : 'false');
      setDisabled(stepButton, summary.done);
      setDisabled(runButton, summary.done);
      setDisabled(resetButton, state.step === 0);
      if (summary.current) {
        current.textContent = 'step ' + summary.step + ' of ' + summary.total + ': ' + hex(summary.current.a) + '  ' + summary.current.b + '  ' + summary.current.t;
      } else {
        current.textContent = 'step 0 of ' + summary.total + ': nothing decoded yet, press step';
      }
      verdict.textContent = verdictText(state.method, summary);
      verdict.setAttribute('data-tone', (summary.padBytes > 0 || (summary.done && summary.codeBytes < summary.codeTotal)) ? 'warn' : 'pass');
    }

    var methodRow = el('div', { class: 're33__row re33__row--methods', role: 'group', 'aria-label': 'Disassembly method' });
    METHODS.forEach(function (method) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [method.label]);
      button.addEventListener('click', function () {
        state.method = method.id;
        state.step = DATA.methods[method.id].order.length;
        render();
      });
      methodButtons.push({ id: method.id, button: button });
      methodRow.appendChild(button);
    });
    stepButton.addEventListener('click', function () { state.step = Math.min(state.step + 1, DATA.methods[state.method].order.length); render(); });
    runButton.addEventListener('click', function () { state.step = DATA.methods[state.method].order.length; render(); });
    resetButton.addEventListener('click', function () { state.step = 0; render(); });

    var controls = el('div', { class: 're33__controls' }, [
      el('div', {}, [el('div', { class: 're33__group-label' }, ['method']), methodRow]),
      el('div', {}, [el('div', { class: 're33__group-label' }, ['stepper']), el('div', { class: 're33__row' }, [stepButton, runButton, resetButton])])
    ]);

    host.appendChild(el('div', { class: 'lf re33' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['SWEEP VS DESCENT']), el('span', {}, ['grade at -O0, 128 bytes'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're33__note' }, ['Pick a method, press reset, then step. Each step decodes one instruction of grade from ledger-x86_64-O0.o. The strip shows which bytes the method has claimed, the graph shows the blocks and edges it has found so far.']),
        controls,
        el('div', { class: 're33__scroll' }, [svg]),
        current,
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Blue cells are bytes the method decoded as instructions. Amber cells are padding bytes after the last retq that a method decoded as code. Grey cells are bytes nothing has claimed. A solid box is a basic block the method found, a dashed box is a block it has not found. Arrows are the edges the method knows, dashed arrows come from the jump table in .rodata.'])
    ]));
    render();
  }

  LF.register({ 're-33-sweep-vs-descent': sweepVersusDescent });
})();
