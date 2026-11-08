/* figures-re-34.js - lesson 34 (lifting to pseudocode). One function,
   percent_change from ledger.c at -O1, moves through five stages: bytes,
   instructions, IR, SSA, structured C. The reader picks a stage and sees
   which items come from one source line. ES5 only, theme via CSS variables,
   registers through window.LF. */
(function () {
  'use strict';
  var LF = window.LF;
  if (!LF) { return; }
  var el = LF.el, svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)', MUTE = 'var(--ink-mute,#7a7a78)';
  var BP = 'var(--blueprint,#3553ff)', TINT = 'var(--blueprint-tint,rgba(53,83,255,.1))';
  var SURF = 'var(--bg-surface,#f3f1e8)', RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';
  var MONO = 'var(--font-mono,monospace)';
  var GUARD = 'if (before == 0) return 0;';
  var FOCUS = 'return (after - before) * 100 / before;';

  var BYTES = [
    ['85', 2], ['ff', 2], ['74', 2], ['09', 2], ['29', 3], ['fe', 3], ['6b', 3], ['c6', 3],
    ['64', 3], ['99', 3], ['f7', 3], ['ff', 3], ['c3', 3], ['31', 2], ['c0', 2], ['c3', 2]
  ];
  var STAGES = {
    bytes: { order: 1, label: 'bytes of .text at 0x0', unit: 'bytes', rows: null },
    insns: {
      order: 2, label: 'decoded instructions', unit: 'instructions', rows: [
        ['0x0  testl  %edi, %edi', 2],
        ['0x2  je     0xd', 2],
        ['0x4  subl   %edi, %esi', 3],
        ['0x6  imull  $0x64, %esi, %eax', 3],
        ['0x9  cltd', 3],
        ['0xa  idivl  %edi', 3],
        ['0xc  retq', 3],
        ['0xd  xorl   %eax, %eax', 2],
        ['0xf  retq', 2]
      ]
    },
    ir: {
      order: 3, label: 'IR statements before SSA', unit: 'statements', rows: [
        ['block 0x0 -> 0xd, 0x4', 0],
        ['  flags = test(edi, edi)', 2],
        ['  if je(flags) goto 0xd else goto 0x4', 2],
        ['block 0x4 -> exit', 0],
        ['  flags = cmp(esi, edi)', 3],
        ['  esi = esi - edi', 3],
        ['  eax = esi * 100', 3],
        ['  edx = signfill(eax)', 3],
        ['  dividend = edx:eax', 3],
        ['  eax = dividend / edi', 3],
        ['  edx = dividend % edi', 3],
        ['  return rax', 3],
        ['block 0xd -> exit', 0],
        ['  eax = 0', 2],
        ['  return rax', 2]
      ]
    },
    ssa: {
      order: 4, label: 'SSA, one version per definition', unit: 'statements', rows: [
        ['block 0x0 -> 0xd, 0x4', 0],
        ['  flags_1 = test(edi_0, edi_0)', 2],
        ['  if je(flags_1) goto 0xd else goto 0x4', 2],
        ['block 0x4 -> exit', 0],
        ['  flags_2 = cmp(esi_0, edi_0)', 3],
        ['  esi_1 = esi_0 - edi_0', 3],
        ['  eax_1 = esi_1 * 100', 3],
        ['  edx_1 = signfill(eax_1)', 3],
        ['  dividend_1 = edx_1:eax_1', 3],
        ['  eax_2 = dividend_1 / edi_0', 3],
        ['  edx_2 = dividend_1 % edi_0', 3],
        ['  return eax_2', 3],
        ['block 0xd -> exit', 0],
        ['  eax_3 = 0', 2],
        ['  return eax_3', 2]
      ]
    },
    c: {
      order: 5, label: 'structured C after substitution and dead code removal', unit: 'lines', rows: [
        ['int percent_change(int param_1, int param_2)', 0],
        ['{', 0],
        ['  if (param_1 == 0) {', 2],
        ['    return 0;', 2],
        ['  }', 2],
        ['  return (param_2 - param_1) * 100 / param_1;', 3],
        ['}', 0]
      ]
    }
  };

  function keepIndent(s) {
    return s.replace(/^ +/, function (spaces) { return new Array(spaces.length + 1).join(' '); });
  }

  function text(x, y, s, fill, size, anchor) {
    return svgEl('text', {
      x: x, y: y, fill: fill, 'font-family': MONO, 'font-size': size || '12.5',
      'text-anchor': anchor || 'start'
    }, [document.createTextNode(keepIndent(s))]);
  }

  function liftingStages(host) {
    var state = { stage: 'bytes' };
    var W = 520;
    var titleId = LF.uid('lf-re34-title');
    var descId = LF.uid('lf-re34-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' 240', role: 'img', 'aria-labelledby': titleId + ' ' + descId, style: 'min-width:500px' });
    var scroller = el('div', { style: 'overflow-x:auto;-webkit-overflow-scrolling:touch' }, [svg]);
    var num = el('span', { class: 'lf-num' });
    var meta = el('div', { class: 'lf-meta' });
    var formula = el('div', { class: 'lf-formula' });

    function header() {
      svg.appendChild(svgEl('rect', { x: 20, y: 14, width: 8, height: 8, fill: INK }));
      svg.appendChild(text(34, 22, 'line 2  ' + GUARD, INK));
      svg.appendChild(svgEl('rect', { x: 20, y: 32, width: 8, height: 8, fill: BP }));
      svg.appendChild(text(34, 40, 'line 3  ' + FOCUS, BP));
      svg.appendChild(svgEl('path', { d: 'M20 52 H500', stroke: RULE, 'stroke-width': '1', fill: 'none' }));
    }

    function drawBytes() {
      var i, col, row, x, y, focus;
      for (i = 0; i < BYTES.length; i++) {
        col = i % 8;
        row = Math.floor(i / 8);
        x = 56 + col * 56;
        y = 66 + row * 34;
        focus = BYTES[i][1] === 3;
        svg.appendChild(svgEl('rect', {
          x: x, y: y, width: 48, height: 26, rx: 3,
          fill: focus ? TINT : SURF, stroke: focus ? BP : RULE, 'stroke-width': '1.2'
        }));
        svg.appendChild(text(x + 24, y + 18, BYTES[i][0], focus ? BP : INK, '13', 'middle'));
      }
      svg.appendChild(text(20, 84, '0x0', MUTE, '12'));
      svg.appendChild(text(20, 118, '0x8', MUTE, '12'));
      return 66 + 2 * 34 + 10;
    }

    function drawRows(rows) {
      var i, y, origin, fill;
      for (i = 0; i < rows.length; i++) {
        y = 72 + i * 17;
        origin = rows[i][1];
        if (origin === 3) {
          svg.appendChild(svgEl('rect', { x: 16, y: y - 12.5, width: 488, height: 17, fill: TINT }));
        }
        fill = MUTE;
        if (origin === 3) {
          fill = BP;
        } else if (origin === 2) {
          fill = INK;
        }
        svg.appendChild(text(24, y, rows[i][0], fill));
      }
      return 72 + rows.length * 17 + 4;
    }

    state._render = function () {
      var spec = STAGES[state.stage] || STAGES.bytes;
      var rows = spec.rows || BYTES;
      var total = 0, focus = 0, i, height;
      for (i = 0; i < rows.length; i++) {
        if (rows[i][1] !== 0) { total += 1; }
        if (rows[i][1] === 3) { focus += 1; }
      }
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('percent_change through five lifting stages')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(
        'Stage ' + spec.order + ' of 5, ' + spec.label + '. ' + focus + ' of ' + total + ' ' + spec.unit +
        ' come from source line 3, the division. The rest come from the zero guard on line 2.'
      )]));
      header();
      height = spec.rows ? drawRows(spec.rows) : drawBytes();
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + height);
      num.innerHTML = focus + ' <small>of ' + total + ' ' + spec.unit + ' come from line 3</small>';
      meta.textContent = 'stage ' + spec.order + ' of 5: ' + spec.label;
      formula.textContent = 'share of line 3 = ' + focus + ' / ' + total + ' = ' + Math.round(focus / total * 100) + '%';
    };

    var controls = el('div', { class: 'lf-grid' }, [
      LF.select(state, 'stage', 'stage', [
        ['1 bytes', 'bytes'],
        ['2 instructions', 'insns'],
        ['3 IR', 'ir'],
        ['4 SSA', 'ssa'],
        ['5 structured C', 'c']
      ])
    ]);
    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['LIFTING STAGES']), el('span', {}, ['pick a stage'])]),
      el('div', { class: 'lf-body' }, [controls, el('div', { class: 'lf-out' }, [scroller, el('div', { style: 'margin-top:10px' }, [num]), meta, formula])]),
      el('div', { class: 'lf-cap' }, [
        'Blue marks the bytes, instructions, IR statements, SSA values, and C lines that come from source line 3 of ledger.c, the division. ' +
        'Black marks the zero guard from line 2. Grey marks block labels, braces, and the signature, which have no source line. ' +
        'The count under the panel is computed from the rows on screen. Nine of sixteen bytes become one line of C.'
      ])
    ]));
    state._render();
  }

  LF.register({ 'lifting-stages-percent-change': liftingStages });
})();
