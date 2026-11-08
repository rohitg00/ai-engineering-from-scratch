/* figures-re-36.js - lesson 36: pick a candidate rebuild of percent_change or grade from
   ledger.c, run it beside the original over an input grid with C integer semantics, and
   compare its compiled bytes with the original after relocation masking. Every byte,
   mnemonic, and table entry comes from objects built with
   clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var INT_MIN = -2147483648;
  var INT_MAX = 2147483647;
  var TRAP = 'trap';
  var BEFORE = [0, 1, -1, 3, 100, INT_MAX];
  var AFTER = [0, 5, 105, 536870911, INT_MAX, INT_MIN];
  var SCORES = [-10, -9, 0, 59, 60, 69, 70, 89, 90, 100, 109, 110];

  function trunc(x) { return x < 0 ? Math.ceil(x) : Math.floor(x); }

  function percentOriginal(before, after) {
    if (before === 0) return 0;
    var difference = (after - before) | 0;
    var product = (difference * 100) | 0;
    if (product === INT_MIN && before === -1) return TRAP;
    return trunc(product / before);
  }
  function percentWide(before, after) {
    if (before === 0) return 0;
    var product = (after - before) * 100;
    return trunc(product / before) | 0;
  }
  function percentDivFirst(before, after) {
    if (before === 0) return 0;
    var difference = (after - before) | 0;
    if (difference === INT_MIN && before === -1) return TRAP;
    return (trunc(difference / before) * 100) | 0;
  }
  function gradeOriginal(score) {
    var tens = trunc(score / 10);
    if (tens === 10 || tens === 9) return 4;
    if (tens === 8) return 3;
    if (tens === 7) return 2;
    if (tens === 6) return 1;
    return 0;
  }
  function gradeThresholds(score) {
    if (score >= 90) return 4;
    if (score >= 80) return 3;
    if (score >= 70) return 2;
    if (score >= 60) return 1;
    return 0;
  }
  function gradeCase10Wrong(score) {
    var tens = trunc(score / 10);
    if (tens === 10) return 3;
    return gradeOriginal(score);
  }

  var PC_INSNS = [['85ff', 'testl %edi,%edi'], ['7409', 'je +9'], ['29fe', 'subl %edi,%esi'], ['6bc664', 'imull $100,%esi,%eax'], ['99', 'cltd'], ['f7ff', 'idivl %edi'], ['c3', 'retq'], ['31c0', 'xorl %eax,%eax'], ['c3', 'retq']];
  var PC_WIDE_INSNS = [['85ff', 'testl %edi,%edi'], ['7413', 'je +19'], ['4863c6', 'movslq %esi,%rax'], ['4863cf', 'movslq %edi,%rcx'], ['4829c8', 'subq %rcx,%rax'], ['486bc064', 'imulq $100,%rax,%rax'], ['4899', 'cqto'], ['48f7f9', 'idivq %rcx'], ['c3', 'retq'], ['31c0', 'xorl %eax,%eax'], ['c3', 'retq']];
  var PC_DIV_INSNS = [['85ff', 'testl %edi,%edi'], ['740b', 'je +11'], ['29fe', 'subl %edi,%esi'], ['89f0', 'movl %esi,%eax'], ['99', 'cltd'], ['f7ff', 'idivl %edi'], ['6bc064', 'imull $100,%eax,%eax'], ['c3', 'retq'], ['31c0', 'xorl %eax,%eax'], ['c3', 'retq']];
  var GRADE_INSNS = [['4863c7', 'movslq %edi,%rax'], ['4869c067666666', 'imulq $0x66666667,%rax,%rax'], ['4889c1', 'movq %rax,%rcx'], ['48c1f922', 'sarq $34,%rcx'], ['48c1e83f', 'shrq $63,%rax'], ['01c1', 'addl %eax,%ecx'], ['83c1fa', 'addl $-6,%ecx'], ['31c0', 'xorl %eax,%eax'], ['83f904', 'cmpl $4,%ecx'], ['770c', 'ja +12'], ['89c8', 'movl %ecx,%eax'], ['488d0d00000000', 'leaq table(%rip),%rcx'], ['8b0481', 'movl (%rcx,%rax,4),%eax'], ['c3', 'retq']];
  var GRADE_THRESH_INSNS = [['b804000000', 'movl $4,%eax'], ['83ff59', 'cmpl $89,%edi'], ['7f1c', 'jg +28'], ['b803000000', 'movl $3,%eax'], ['83ff4f', 'cmpl $79,%edi'], ['7f12', 'jg +18'], ['b802000000', 'movl $2,%eax'], ['83ff45', 'cmpl $69,%edi'], ['7f08', 'jg +8'], ['31c0', 'xorl %eax,%eax'], ['83ff3c', 'cmpl $60,%edi'], ['0f9dc0', 'setge %al'], ['c3', 'retq']];

  var ORIGINAL = {
    percent_change: { run: percentOriginal, insns: PC_INSNS, relocs: [], table: null },
    grade: { run: gradeOriginal, insns: GRADE_INSNS, relocs: [{ offset: 38, width: 4, type: 'R_X86_64_PC32', target: '.rodata+0x10' }], table: [1, 2, 3, 4, 4] }
  };

  var CANDIDATES = [
    { id: 'mul_first', fn: 'percent_change', file: 'percent_change_mul_first.c', label: 'return 100 * (after - before) / before;', run: percentOriginal, insns: PC_INSNS, relocs: [], table: null },
    { id: 'wide', fn: 'percent_change', file: 'percent_change_wide.c', label: 'return (int)(((long)after - before) * 100 / before);', run: percentWide, insns: PC_WIDE_INSNS, relocs: [], table: null },
    { id: 'div_first', fn: 'percent_change', file: 'percent_change_div_first.c', label: 'return (after - before) / before * 100;', run: percentDivFirst, insns: PC_DIV_INSNS, relocs: [], table: null },
    { id: 'switch', fn: 'grade', file: 'grade_switch.c', label: 'switch (score / 10) { case 10: case 9: return 4; case 8: return 3; ... }', run: gradeOriginal, insns: GRADE_INSNS, relocs: [{ offset: 38, width: 4, type: 'R_X86_64_PC32', target: '.rodata-0x4' }], table: [1, 2, 3, 4, 4] },
    { id: 'thresholds', fn: 'grade', file: 'grade_thresholds.c', label: 'if (score >= 90) return 4; if (score >= 80) return 3; ...', run: gradeThresholds, insns: GRADE_THRESH_INSNS, relocs: [], table: null },
    { id: 'case10_wrong', fn: 'grade', file: 'grade_case10_wrong.c', label: 'switch (score / 10) { case 10: return 3; case 9: return 4; ... }', run: gradeCase10Wrong, insns: GRADE_INSNS, relocs: [{ offset: 38, width: 4, type: 'R_X86_64_PC32', target: '.rodata-0x4' }], table: [1, 2, 3, 4, 3] }
  ];

  function ensureStyles() {
    if (document.getElementById('re36-styles')) return;
    var style = document.createElement('style');
    style.id = 're36-styles';
    style.textContent = [
      '.re36 *{box-sizing:border-box}',
      '.re36__body{display:grid;gap:14px}',
      '.re36__prompt{margin:0;font-family:var(--font-body,serif);font-size:.95rem;line-height:1.5;color:var(--ink-soft,#4a4a4a)}',
      '.re36__label{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#7a7a78)}',
      '.re36__choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.re36 button{min-height:40px;padding:8px 10px;border:1px solid var(--rule-soft,rgba(26,26,26,.16));background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.74rem;line-height:1.4;text-align:left;cursor:pointer;transition:transform 140ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re36 button small{display:block;font-size:.66rem;color:var(--ink-mute,#7a7a78)}',
      '.re36 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re36 button[aria-pressed="true"] small{color:var(--blueprint,#3553ff)}',
      '.re36 button:active{transform:scale(.96)}',
      '.re36 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '@media(hover:hover) and (pointer:fine){.re36 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '.re36__panels{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}',
      '.re36__panel{min-width:0;border:1px solid var(--rule-soft,rgba(26,26,26,.16));background:var(--bg-surface,#f3f1e8);padding:10px}',
      '.re36__panel-title{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--blueprint,#3553ff);margin-bottom:8px}',
      '.re36__grid{display:grid;gap:3px;font-family:var(--font-mono,monospace);font-size:.72rem}',
      '.re36__grid--pc{grid-template-columns:minmax(44px,auto) repeat(6,minmax(0,1fr))}',
      '.re36__grid--grade{grid-template-columns:repeat(6,minmax(0,1fr))}',
      '.re36__hdr{padding:4px 2px;color:var(--ink-mute,#7a7a78);text-align:center;white-space:nowrap;font-size:.68rem}',
      '.re36__hdr--row{text-align:right;padding-right:6px}',
      '.re36__cell{min-height:30px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid var(--rule-soft,rgba(26,26,26,.16));background:var(--blueprint-tint,rgba(53,83,255,.08));color:var(--ink,#1a1a1a);transition:opacity 220ms cubic-bezier(.23,1,.32,1),background-color 180ms ease,border-color 180ms ease}',
      '.re36__cell.is-diff{background:color-mix(in srgb,var(--warn,#b8870f) 18%,var(--bg,#fafaf5));border-color:var(--warn,#b8870f);color:var(--warn,#b8870f)}',
      '.re36__cell b{font-weight:600;font-size:.82rem}',
      '.re36__cell span{font-size:.66rem;color:var(--ink-mute,#7a7a78)}',
      '.re36__detail{margin-top:8px;font-family:var(--font-mono,monospace);font-size:.72rem;line-height:1.5;color:var(--ink-soft,#4a4a4a);word-break:break-word}',
      '.re36__detail.is-diff{color:var(--warn,#b8870f)}',
      '.re36__bytes{display:flex;flex-wrap:wrap;gap:2px}',
      '.re36__col{display:grid;gap:2px;width:22px}',
      '.re36__byte{height:20px;line-height:20px;text-align:center;font-family:var(--font-mono,monospace);font-size:.66rem;border:1px solid var(--rule-soft,rgba(26,26,26,.16));background:var(--blueprint-tint,rgba(53,83,255,.08));color:var(--ink,#1a1a1a)}',
      '.re36__col.is-diff .re36__byte{background:color-mix(in srgb,var(--warn,#b8870f) 18%,var(--bg,#fafaf5));border-color:var(--warn,#b8870f);color:var(--warn,#b8870f)}',
      '.re36__col.is-masked .re36__byte{border-style:dashed;border-color:var(--blueprint,#3553ff);background:var(--bg,#fafaf5);color:var(--ink-mute,#7a7a78)}',
      '.re36__byte.is-missing{background:transparent;border-style:dotted;color:var(--ink-mute,#7a7a78)}',
      '.re36__rowname{font-family:var(--font-mono,monospace);font-size:.66rem;color:var(--ink-mute,#7a7a78);margin:6px 0 2px}',
      '.re36__insns{font-family:var(--font-mono,monospace);font-size:.68rem;line-height:1.6;color:var(--ink-soft,#4a4a4a);word-break:break-word}',
      '.re36__table{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}',
      '.re36__table .re36__byte{width:44px}',
      '.re36__verdict{padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.55;color:var(--ink,#1a1a1a);background:var(--bg,#fafaf5)}',
      '.re36__verdict.is-fail{border-color:var(--warn,#b8870f)}',
      '@media(max-width:600px){.re36__choices{grid-template-columns:1fr}.re36__panels{grid-template-columns:1fr}.re36__grid--pc{grid-template-columns:minmax(40px,auto) repeat(6,minmax(0,1fr))}.re36__col{width:20px}}',
      '@media(prefers-reduced-motion:reduce){.re36 button,.re36__cell{transition:none!important}.re36 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function short(n) {
    if (n === INT_MAX) return 'MAX';
    if (n === INT_MIN) return 'MIN';
    if (n === 536870911) return '2^29-1';
    return String(n);
  }
  function text(tag, cls, s) { return el(tag, { class: cls }, [s]); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function cellNode(cell, fn, children) {
    return el('div', { class: 're36__cell' + (cell.match ? '' : ' is-diff'), title: describe(cell, fn), 'aria-label': describe(cell, fn) }, [el('b', {}, [cell.match ? '=' : '≠'])].concat(children));
  }
  function byteNode(value, missingText) {
    var missing = value === undefined;
    return el('div', { class: 're36__byte' + (missing ? ' is-missing' : '') }, [missing ? missingText : String(value)]);
  }

  function cellsFor(candidate) {
    var cells = [];
    var i;
    var j;
    if (candidate.fn === 'percent_change') {
      for (i = 0; i < BEFORE.length; i++) {
        for (j = 0; j < AFTER.length; j++) {
          cells.push({ args: [BEFORE[i], AFTER[j]], original: percentOriginal(BEFORE[i], AFTER[j]), candidate: candidate.run(BEFORE[i], AFTER[j]) });
        }
      }
    } else {
      for (i = 0; i < SCORES.length; i++) {
        cells.push({ args: [SCORES[i]], original: gradeOriginal(SCORES[i]), candidate: candidate.run(SCORES[i]) });
      }
    }
    for (i = 0; i < cells.length; i++) cells[i].match = cells[i].original === cells[i].candidate;
    return cells;
  }

  function describe(cell, fn) {
    var inputs = fn === 'percent_change' ? 'before ' + cell.args[0] + ', after ' + cell.args[1] : 'score ' + cell.args[0];
    return inputs + ': original ' + cell.original + ', rebuild ' + cell.candidate;
  }

  function renderGrid(panel, candidate, cells) {
    var grid;
    var i;
    var j;
    var k = 0;
    if (candidate.fn === 'percent_change') {
      grid = el('div', { class: 're36__grid re36__grid--pc', role: 'table', 'aria-label': 'percent_change over 36 inputs' });
      grid.appendChild(text('div', 're36__hdr re36__hdr--row', 'b \\ a'));
      for (j = 0; j < AFTER.length; j++) grid.appendChild(text('div', 're36__hdr', short(AFTER[j])));
      for (i = 0; i < BEFORE.length; i++) {
        grid.appendChild(text('div', 're36__hdr re36__hdr--row', short(BEFORE[i])));
        for (j = 0; j < AFTER.length; j++) {
          grid.appendChild(cellNode(cells[k++], candidate.fn, []));
        }
      }
    } else {
      grid = el('div', { class: 're36__grid re36__grid--grade', role: 'table', 'aria-label': 'grade over 12 scores' });
      for (i = 0; i < cells.length; i++) {
        grid.appendChild(cellNode(cells[i], 'grade', [el('span', {}, [short(cells[i].args[0])])]));
      }
    }
    panel.appendChild(grid);
    var misses = [];
    for (i = 0; i < cells.length; i++) if (!cells[i].match) misses.push(cells[i]);
    var detail = el('div', { class: 're36__detail' + (misses.length ? ' is-diff' : '') });
    if (!misses.length) detail.textContent = 'every cell agrees, including zero guard, negative, rounding, and overflow inputs';
    else detail.textContent = 'first differing cell: ' + describe(misses[0], candidate.fn) + (misses.length > 1 ? ' (' + (misses.length - 1) + ' more)' : '');
    panel.appendChild(detail);
    return misses.length;
  }

  function bytesOf(insns) {
    var out = [];
    var i;
    var j;
    for (i = 0; i < insns.length; i++) for (j = 0; j < insns[i][0].length; j += 2) out.push(insns[i][0].substr(j, 2));
    return out;
  }
  function masked(index, relocs) {
    var i;
    for (i = 0; i < relocs.length; i++) if (index >= relocs[i].offset && index < relocs[i].offset + relocs[i].width) return true;
    return false;
  }
  function insnText(insns) {
    var parts = [];
    var i;
    var offset = 0;
    for (i = 0; i < insns.length; i++) {
      parts.push('0x' + offset.toString(16) + ' ' + insns[i][1]);
      offset += insns[i][0].length / 2;
    }
    return parts.join(' · ');
  }

  function renderBytes(panel, candidate) {
    var original = ORIGINAL[candidate.fn];
    var left = bytesOf(original.insns);
    var right = bytesOf(candidate.insns);
    var strip = el('div', { class: 're36__bytes', role: 'img', 'aria-label': 'original bytes above rebuild bytes' });
    var count = Math.max(left.length, right.length);
    var diffs = 0;
    var maskedCount = 0;
    var i;
    for (i = 0; i < count; i++) {
      var isMasked = masked(i, original.relocs) && masked(i, candidate.relocs);
      var isDiff = !isMasked && left[i] !== right[i];
      if (isMasked) maskedCount++;
      if (isDiff) diffs++;
      strip.appendChild(el('div', { class: 're36__col' + (isDiff ? ' is-diff' : '') + (isMasked ? ' is-masked' : '') }, [
        byteNode(left[i], '··'),
        byteNode(right[i], '··')
      ]));
    }
    panel.appendChild(text('div', 're36__rowname', 'original ' + left.length + ' bytes (top), rebuild ' + right.length + ' bytes (bottom)'));
    panel.appendChild(strip);
    if (original.relocs.length) {
      panel.appendChild(text('div', 're36__detail', 'dashed column: offset 0x' + original.relocs[0].offset.toString(16) + ' ' + original.relocs[0].type + ' field, original ' + original.relocs[0].target + ', rebuild ' + (candidate.relocs.length ? candidate.relocs[0].target : 'no relocation') + ', masked before the compare'));
    }
    panel.appendChild(text('div', 're36__rowname', 'original listing'));
    panel.appendChild(text('div', 're36__insns', insnText(original.insns)));
    panel.appendChild(text('div', 're36__rowname', 'rebuild listing'));
    panel.appendChild(text('div', 're36__insns', insnText(candidate.insns)));
    var tableDiffs = 0;
    if (original.table) {
      panel.appendChild(text('div', 're36__rowname', 'constants the relocation points at (.rodata, five 4-byte entries)'));
      var row = el('div', { class: 're36__table' });
      for (i = 0; i < original.table.length; i++) {
        var candidateEntry = candidate.table ? candidate.table[i] : undefined;
        var same = candidateEntry === original.table[i];
        if (!same) tableDiffs++;
        row.appendChild(el('div', { class: 're36__col' + (same ? '' : ' is-diff') }, [
          el('div', { class: 're36__byte' }, [String(original.table[i])]),
          byteNode(candidateEntry, 'none')
        ]));
      }
      panel.appendChild(row);
    }
    return { sizeLeft: left.length, sizeRight: right.length, diffs: diffs, maskedCount: maskedCount, tableDiffs: tableDiffs, relocMatch: original.relocs.length === candidate.relocs.length };
  }

  function verdictText(candidate, misses, cellCount, bytes) {
    var one = 'Leg one: ' + (cellCount - misses) + ' of ' + cellCount + ' cells match.';
    var two;
    var equalBytes = bytes.sizeLeft === bytes.sizeRight && bytes.diffs === 0 && bytes.relocMatch;
    if (bytes.sizeLeft !== bytes.sizeRight) two = 'Leg two: size ' + bytes.sizeRight + ' vs ' + bytes.sizeLeft + ' bytes, so no byte match.';
    else two = 'Leg two: ' + (bytes.sizeLeft - bytes.maskedCount - bytes.diffs) + ' of ' + (bytes.sizeLeft - bytes.maskedCount) + ' unmasked bytes match, ' + bytes.maskedCount + ' masked' + (ORIGINAL[candidate.fn].table ? ', table entries that differ: ' + bytes.tableDiffs + ' of 5' : '') + '.';
    var pass = misses === 0 && equalBytes && bytes.tableDiffs === 0;
    var why = '';
    if (misses === 0 && equalBytes && bytes.tableDiffs > 0) why = ' The masked byte compare alone would have passed it.';
    if (misses > 0 && candidate.id === 'wide') why = ' Every differing cell is a 32-bit overflow the 64-bit intermediate skips.';
    if (misses > 0 && candidate.id === 'thresholds') why = ' Scores of 110 and above fall through the original switch to 0.';
    return one + ' ' + two + ' Verdict: ' + (pass ? 'equal on this grid and byte for byte.' : 'not equal.') + why;
  }

  function proveEqual(host) {
    ensureStyles();
    var selected = 'wide';
    var buttons = [];
    var choices = el('div', { class: 're36__choices', role: 'group', 'aria-label': 'Candidate rebuild' });
    var gridPanel = el('div', { class: 're36__panel' });
    var bytePanel = el('div', { class: 're36__panel' });
    var verdict = el('div', { class: 're36__verdict', role: 'status' });

    function render() {
      var candidate = null;
      var i;
      for (i = 0; i < CANDIDATES.length; i++) if (CANDIDATES[i].id === selected) candidate = CANDIDATES[i];
      for (i = 0; i < buttons.length; i++) buttons[i].button.setAttribute('aria-pressed', buttons[i].id === selected ? 'true' : 'false');
      clear(gridPanel);
      clear(bytePanel);
      gridPanel.appendChild(text('div', 're36__panel-title', 'leg one · execute and compare · ' + candidate.fn));
      bytePanel.appendChild(text('div', 're36__panel-title', 'leg two · recompile and compare · ' + candidate.file));
      var cells = cellsFor(candidate);
      var misses = renderGrid(gridPanel, candidate, cells);
      var bytes = renderBytes(bytePanel, candidate);
      var textOut = verdictText(candidate, misses, cells.length, bytes);
      verdict.textContent = textOut;
      verdict.className = 're36__verdict' + (textOut.indexOf('Verdict: equal') === -1 ? ' is-fail' : '');
    }

    CANDIDATES.forEach(function (candidate) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [
        el('small', {}, [candidate.fn + ' · ' + candidate.file]),
        candidate.label
      ]);
      button.addEventListener('click', function () { selected = candidate.id; render(); });
      buttons.push({ id: candidate.id, button: button });
      choices.appendChild(button);
    });

    host.appendChild(el('div', { class: 'lf re36' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['REBUILD PROOF']), el('span', {}, ['pick a candidate rebuild'])]),
      el('div', { class: 'lf-body re36__body' }, [
        el('p', { class: 're36__prompt' }, ['Pick one rebuild. The grid runs it beside the original over the inputs in the headers, with 32-bit wrap and truncating division. The byte strip compares its compiled bytes with the original after masking the relocation field.']),
        el('div', {}, [text('div', 're36__label', 'Candidate rebuild'), choices]),
        el('div', { class: 're36__panels' }, [gridPanel, bytePanel]),
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Blue cells and bytes agree with the original. Amber marks a cell or a byte that differs. The dashed column is the relocation field, set to zero on both sides before the compare. The constants row holds the five table entries the relocation points at. The verdict counts cells, unmasked bytes, and table entries.'])
    ]));
    render();
  }

  LF.register({ 're-36-prove-equal': proveEqual });
}());
