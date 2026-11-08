/* figures-re-32.js - lesson 32: a byte map of ledger-x86_64-O1.o.
   The module carries the real 1,768 bytes of the object, parses the ELF
   structures in the browser, and shows the offset, size, and bytes of the
   region or symbol the reader picks. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var BP = 'var(--blueprint,#3553ff)';
  var SURF = 'var(--bg-surface,#f3f1e8)';
  var RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';
  var TINT = 'var(--blueprint-tint-strong,rgba(53,83,255,0.18))';

  var HEX = [
    '7f454c4602010100000000000000000001003e00010000000000000000000000',
    '000000000000000028040000000000000000000040000000000040000b000100',
    '85ff740929fe6bc66499f7ffc331c0c34863c74869c0676666664889c148c1f9',
    '2248c1e83f01c183c1fa31c083f904770c89c8488d0d000000008b0481c36690',
    '85f67e1889f131d231c0660f1f44000003049748ffc24839d175f5c331c0c390',
    '4863c74869c0676666664889c148c1f92248c1e83f01c883c0fa83f804770f89',
    'c0488d0d00000000488b04c1eb0231c0488d0d00000000486304814801c8c300',
    '0000000000000000000000000000000000000000010000000200000003000000',
    '0400000004000000010000000000000002000000000000000300000000000000',
    '0400000000000000040000000000000046004400430042004100004170706c65',
    '20636c616e672076657273696f6e2031372e302e302028636c616e672d313730',
    '302e362e332e3229000000000000000000000000000000000000000000000000',
    '0000000000000000650000000400f1ff00000000000000000000000000000000',
    '1500000001000400000000000000000014000000000000000000000003000400',
    '00000000000000000000000000000000a6000000010006000200000000000000',
    '02000000000000009d0000000100060004000000000000000200000000000000',
    '9400000001000600060000000000000002000000000000008b00000001000600',
    '0800000000000000020000000000000000000000030006000000000000000000',
    '0000000000000000500000001200020000000000000000001000000000000000',
    '5f0000001200020010000000000000002e000000000000002c00000012000200',
    '40000000000000001f0000000000000020000000120002006000000000000000',
    '3f00000000000000360000000000000002000000030000001000000000000000',
    '8400000000000000020000000300000024000000000000009300000000000000',
    '0200000003000000fcffffffffffffff00000000000000000200000008000000',
    '0000000000000000040000000000000002000000040000000400000000000000',
    '0800000000000000020000000500000008000000000000000c00000000000000',
    '02000000060000000c0000000000000010000000000000000200000007000000',
    '1000000000000000002e72656c612e74657874002e636f6d6d656e74006c6162',
    '656c732e72656c0067726164655f6c6162656c00746f74616c002e6e6f74652e',
    '474e552d737461636b002e6c6c766d5f616464727369670070657263656e745f',
    '6368616e6765006772616465006c65646765722e63002e737472746162002e73',
    '796d746162002e72656c612e726f64617461002e4c2e7374722e34002e4c2e73',
    '74722e33002e4c2e7374722e32002e4c2e7374722e31002e726f646174612e73',
    '7472312e31000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '00000000000000006e0000000300000000000000000000000000000000000000',
    '6803000000000000be0000000000000000000000000000000100000000000000',
    '0000000000000000060000000100000006000000000000000000000000000000',
    '40000000000000009f0000000000000000000000000000001000000000000000',
    '0000000000000000010000000400000040000000000000000000000000000000',
    'a80200000000000048000000000000000a000000020000000800000000000000',
    '1800000000000000830000000100000002000000000000000000000000000000',
    'e000000000000000500000000000000000000000000000000800000000000000',
    '00000000000000007e0000000400000040000000000000000000000000000000',
    'f00200000000000078000000000000000a000000040000000800000000000000',
    '1800000000000000af0000000100000032000000000000000000000000000000',
    '30010000000000000a0000000000000000000000000000000100000000000000',
    '01000000000000000c0000000100000030000000000000000000000000000000',
    '3a010000000000002f0000000000000000000000000000000100000000000000',
    '0100000000000000320000000100000000000000000000000000000000000000',
    '6901000000000000000000000000000000000000000000000100000000000000',
    '000000000000000042000000034cff6f00000080000000000000000000000000',
    '680300000000000000000000000000000a000000000000000100000000000000',
    '0000000000000000760000000200000000000000000000000000000000000000',
    '7001000000000000380100000000000001000000090000000800000000000000',
    '1800000000000000'
  ].join('');

  var SHT_NAMES = { 0: 'NULL', 1: 'PROGBITS', 2: 'SYMTAB', 3: 'STRTAB', 4: 'RELA', 7: 'NOTE', 8: 'NOBITS', 1879002115: 'LLVM_ADDRSIG' };
  var STT_NAMES = { 0: 'NOTYPE', 1: 'OBJECT', 2: 'FUNC', 3: 'SECTION', 4: 'FILE' };
  var STB_NAMES = { 0: 'LOCAL', 1: 'GLOBAL', 2: 'WEAK' };
  var SHDR_SIZE = 64;
  var SYM_SIZE = 24;

  function ensureStyles() {
    if (document.getElementById('re32-styles')) return;
    var style = document.createElement('style');
    style.id = 're32-styles';
    style.textContent = [
      '.re32__body{display:grid;gap:14px}',
      '.re32__note{margin:0;color:var(--ink-soft,#4a4a4a);font-family:var(--font-body,serif);font-size:.95rem;line-height:1.5}',
      '.re32__group{display:grid;gap:8px}',
      '.re32__label{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#7a7a78)}',
      '.re32__buttons{display:flex;flex-wrap:wrap;gap:8px}',
      '.re32__btn{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;text-align:left;cursor:pointer;transition:transform 160ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease,color 180ms ease}',
      '.re32__btn:active{transform:scale(.97)}',
      '.re32__btn:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re32__btn[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '@media (hover:hover) and (pointer:fine){.re32__btn:hover{border-color:var(--blueprint,#3553ff);background:var(--blueprint-tint,rgba(53,83,255,.08))}.re32__btn[aria-pressed="true"]:hover{background:var(--blueprint,#3553ff)}}',
      '.re32__ticks{display:flex;justify-content:space-between;font-family:var(--font-mono,monospace);font-size:.72rem;color:var(--ink-mute,#7a7a78)}',
      '.re32__strip{display:block;width:100%;height:auto}',
      '.re32__strip rect{cursor:pointer;transition:opacity 180ms cubic-bezier(.23,1,.32,1)}',
      '.re32__hex{max-width:100%;max-height:300px;margin:0!important;padding:12px!important;border:1px solid var(--rule-soft,#ddd)!important;background:var(--code-bg,#f6f6f0)!important;color:var(--ink,#1a1a1a)!important;font-family:var(--font-mono,monospace)!important;font-size:.76rem!important;line-height:1.55!important;white-space:pre;overflow:auto!important}',
      '.re32__verdict{padding:12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.55;color:var(--ink,#1a1a1a)}',
      '.re32__verdict b{color:var(--blueprint,#3553ff);font-weight:600}',
      '.re32__coverage{font-family:var(--font-mono,monospace);font-size:.72rem;color:var(--ink-mute,#7a7a78)}',
      '@media (max-width:640px){.re32__buttons{display:grid;grid-template-columns:1fr 1fr}.re32__btn{width:100%}}',
      '@media (max-width:360px){.re32__buttons{grid-template-columns:1fr}}',
      '@media (prefers-reduced-motion:reduce){.re32__btn,.re32__strip rect{transition:none!important}.re32__btn:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function bytesFromHex(hex) {
    var out = [];
    var i;
    for (i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
    return out;
  }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }
  function u64(b, o) { return u32(b, o) + u32(b, o + 4) * 4294967296; }
  function cstr(b, o) {
    var s = '';
    while (o < b.length && b[o] !== 0) { s += String.fromCharCode(b[o]); o += 1; }
    return s;
  }
  function hex(n, width) {
    var s = n.toString(16);
    while (width && s.length < width) s = '0' + s;
    return '0x' + s;
  }
  function pad2(n) { return (n < 16 ? '0' : '') + n.toString(16); }
  function flagsText(f) {
    var out = '';
    if (f & 1) out += 'W';
    if (f & 2) out += 'A';
    if (f & 4) out += 'X';
    if (f & 16) out += 'M';
    if (f & 32) out += 'S';
    if (f & 64) out += 'I';
    if (f >= 2147483648) out += 'E';
    return out;
  }
  function withCommas(n) { return LF.fmtInt ? LF.fmtInt(n) : String(n); }

  function parseElf(b) {
    var shoff = u64(b, 0x28);
    var shnum = u16(b, 0x3c);
    var shstrndx = u16(b, 0x3e);
    var sections = [];
    var symbols = [];
    var symtab = null;
    var i, o, info, shstr, strtab;
    for (i = 0; i < shnum; i += 1) {
      o = shoff + i * SHDR_SIZE;
      sections.push({
        index: i, nameOff: u32(b, o), type: u32(b, o + 4), flags: u64(b, o + 8), addr: u64(b, o + 16),
        offset: u64(b, o + 24), size: u64(b, o + 32), link: u32(b, o + 40), info: u32(b, o + 44), align: u64(b, o + 48)
      });
    }
    shstr = sections[shstrndx];
    for (i = 0; i < shnum; i += 1) {
      sections[i].name = cstr(b, shstr.offset + sections[i].nameOff);
      if (sections[i].type === 2) symtab = sections[i];
    }
    if (symtab) {
      strtab = sections[symtab.link];
      for (i = 0; i < Math.floor(symtab.size / SYM_SIZE); i += 1) {
        o = symtab.offset + i * SYM_SIZE;
        info = b[o + 4];
        symbols.push({
          index: i, name: cstr(b, strtab.offset + u32(b, o)), bind: STB_NAMES[info >> 4] || String(info >> 4),
          type: STT_NAMES[info & 15] || String(info & 15), shndx: u16(b, o + 6), value: u64(b, o + 8), size: u64(b, o + 16)
        });
      }
    }
    return { bytes: b, size: b.length, shoff: shoff, shnum: shnum, shstrndx: shstrndx, sections: sections, symbols: symbols, symtab: symtab };
  }

  function regionsOf(elf) {
    var out = [{ id: 'header', kind: 'header', name: 'ELF header', offset: 0, size: 64 }];
    var i, s;
    for (i = 1; i < elf.sections.length; i += 1) {
      s = elf.sections[i];
      if (s.size === 0 || s.type === 8) continue;
      out.push({ id: 'section-' + i, kind: 'section', name: s.name, offset: s.offset, size: s.size, section: s });
    }
    out.push({ id: 'table', kind: 'table', name: 'section header table', offset: elf.shoff, size: elf.shnum * SHDR_SIZE });
    out.sort(function (a, b) { return a.offset - b.offset; });
    return out;
  }

  function symbolsOf(elf) {
    var out = [];
    var i, sym, section;
    for (i = 0; i < elf.symbols.length; i += 1) {
      sym = elf.symbols[i];
      if (sym.size === 0 || sym.shndx === 0 || sym.shndx >= elf.sections.length) continue;
      if (sym.name.indexOf('.L') === 0) continue;
      if (sym.type !== 'FUNC' && sym.type !== 'OBJECT') continue;
      section = elf.sections[sym.shndx];
      out.push({ id: 'symbol-' + i, kind: 'symbol', name: sym.name, offset: section.offset + sym.value - section.addr, size: sym.size, symbol: sym, section: section });
    }
    return out;
  }

  function hexRows(bytes, offset, size, perRow, maxRows, ascii) {
    var rows = [];
    var row, text, i, j, v;
    for (i = 0; i < size && rows.length < maxRows; i += perRow) {
      row = hex(offset + i, 4).slice(2) + '  ';
      text = '';
      for (j = 0; j < perRow; j += 1) {
        if (i + j < size) {
          v = bytes[offset + i + j];
          row += pad2(v) + ' ';
          text += (v >= 32 && v < 127) ? String.fromCharCode(v) : '.';
        } else {
          row += '   ';
          text += ' ';
        }
      }
      rows.push(ascii ? row + ' |' + text + '|' : row);
    }
    if (size > maxRows * perRow) rows.push('+ ' + (size - maxRows * perRow) + ' more bytes, ' + size + ' in all');
    if (size === 0) rows.push('(no bytes in the file)');
    return rows.join('\n');
  }

  function verdictFor(elf, item) {
    var s, sym, extra;
    if (item.kind === 'header') {
      return 'ELF header: 64 bytes at file offset 0x0. ' +
        'e_shoff = ' + hex(elf.shoff) + ', e_shnum = ' + elf.shnum + ', e_shstrndx = ' + elf.shstrndx + ' (' + elf.sections[elf.shstrndx].name + ').';
    }
    if (item.kind === 'table') {
      return 'section header table: ' + elf.shnum + ' x ' + SHDR_SIZE + ' = ' + item.size + ' bytes at file offset ' + hex(item.offset) + '.';
    }
    if (item.kind === 'section') {
      s = item.section;
      extra = '';
      if (s.type === 4) extra = ' Patches ' + elf.sections[s.info].name + ', symbols from ' + elf.sections[s.link].name + '.';
      if (s.type === 2) extra = ' Names from ' + elf.sections[s.link].name + ', first non-local symbol at index ' + s.info + '.';
      return s.name + ': ' + s.size + ' bytes at file offset ' + hex(s.offset) + '. Section ' + s.index + ', ' + (SHT_NAMES[s.type] || hex(s.type)) + ', flags ' + (flagsText(s.flags) || 'none') + ', align ' + s.align + '.' + extra;
    }
    sym = item.symbol;
    return sym.name + ': ' + sym.size + ' bytes at file offset ' + hex(item.offset) + ' (' + item.section.name + ' + ' + hex(sym.value) + '), ' + sym.bind + ' ' + sym.type + '.';
  }

  function elfByteMap(host) {
    ensureStyles();
    var elf = parseElf(bytesFromHex(HEX));
    var regions = regionsOf(elf);
    var symbols = symbolsOf(elf);
    var W = 520;
    var X0 = 10;
    var BAR = 500;
    var titleId = LF.uid('lf-elf-byte-map-title');
    var descId = LF.uid('lf-elf-byte-map-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' 56', class: 're32__strip', role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var hexPanel = el('pre', { class: 're32__hex', tabindex: '0' });
    var verdict = el('div', { class: 're32__verdict' });
    var coverage = el('div', { class: 're32__coverage' });
    var buttons = {};
    var selected = null;
    var mapped = 0;
    var narrowQuery = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
    var i;
    for (i = 0; i < regions.length; i += 1) mapped += regions[i].size;
    function onNarrowChange() { render(); }
    if (narrowQuery && narrowQuery.addEventListener) {
      narrowQuery.addEventListener('change', onNarrowChange);
      if (LF.registerDisposer) LF.registerDisposer(host, function () { narrowQuery.removeEventListener('change', onNarrowChange); });
    }

    function x(offset) { return X0 + offset / elf.size * BAR; }
    function width(size) { return Math.max(size / elf.size * BAR, 1.5); }

    function select(item) {
      selected = item;
      render();
    }

    function rect(item, fill, y, h) {
      var r = svgEl('rect', { x: x(item.offset).toFixed(2), y: y, width: width(item.size).toFixed(2), height: h, fill: fill, stroke: RULE, 'stroke-width': '1' });
      r.appendChild(svgEl('title', {}, [document.createTextNode(item.name + ' ' + hex(item.offset) + ' +' + item.size)]));
      r.addEventListener('click', function () { select(item); });
      return r;
    }

    function render() {
      var id;
      var textSection = selected.kind === 'symbol' ? selected.section : null;
      var item;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Byte map of ledger-x86_64-O1.o')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode('The ' + elf.size + ' bytes of the object file drawn to scale. Selected: ' + selected.name + ', ' + selected.size + ' bytes at offset ' + hex(selected.offset) + '.')]));
      svg.appendChild(svgEl('rect', { x: X0, y: 12, width: BAR, height: 32, fill: 'none', stroke: RULE, 'stroke-width': '1' }));
      for (i = 0; i < regions.length; i += 1) {
        item = regions[i];
        var fill = SURF;
        if (item === selected) fill = BP;
        else if (textSection && item.section === textSection) fill = TINT;
        svg.appendChild(rect(item, fill, 12, 32));
      }
      if (selected.kind === 'symbol') svg.appendChild(rect(selected, BP, 12, 32));
      for (id in buttons) {
        if (Object.prototype.hasOwnProperty.call(buttons, id)) buttons[id].setAttribute('aria-pressed', id === selected.id ? 'true' : 'false');
      }
      var narrow = narrowQuery ? narrowQuery.matches : false;
      hexPanel.textContent = narrow
        ? hexRows(elf.bytes, selected.offset, selected.size, 8, 16, false)
        : hexRows(elf.bytes, selected.offset, selected.size, 16, 8, true);
      verdict.innerHTML = '';
      verdict.appendChild(el('b', {}, [selected.name]));
      verdict.appendChild(document.createTextNode(verdictFor(elf, selected).slice(selected.name.length)));
      coverage.textContent = 'structures own ' + withCommas(mapped) + ' of ' + withCommas(elf.size) + ' bytes, ' + (elf.size - mapped) + ' bytes are inactive space between them';
    }

    function button(item) {
      var b = el('button', { type: 'button', class: 're32__btn', 'aria-pressed': 'false' }, [item.name + ' ' + (item.kind === 'symbol' ? item.size + ' B' : hex(item.offset))]);
      b.addEventListener('click', function () { select(item); });
      buttons[item.id] = b;
      return b;
    }

    var structureButtons = regions.map(button);
    var symbolButtons = symbols.map(button);

    selected = symbols[0] || regions[0];
    for (i = 0; i < symbols.length; i += 1) if (symbols[i].name === 'percent_change') selected = symbols[i];

    host.appendChild(el('div', { class: 'lf' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['BYTE MAP']), el('span', {}, ['click a structure or a symbol'])]),
      el('div', { class: 'lf-body re32__body' }, [
        el('p', { class: 're32__note' }, ['The strip is ledger-x86_64-O1.o, ' + withCommas(elf.size) + ' bytes, parsed in this page the same way the lesson reader parses it. Pick a structure to see where its bytes are. Pick a symbol to see the bytes of one function.']),
        el('div', { class: 're32__group' }, [el('div', { class: 're32__label' }, ['file structures, in file order']), el('div', { class: 're32__buttons' }, structureButtons)]),
        el('div', { class: 're32__group' }, [el('div', { class: 're32__label' }, ['symbols with bytes']), el('div', { class: 're32__buttons' }, symbolButtons)]),
        el('div', { class: 're32__group' }, [
          el('div', { class: 're32__ticks' }, [el('span', {}, ['offset 0x0']), el('span', {}, ['end ' + hex(elf.size)])]),
          svg
        ]),
        hexPanel,
        verdict,
        coverage
      ]),
      el('div', { class: 'lf-cap' }, ['The strip draws the whole object file to scale from offset 0x0 on the left to the last byte on the right. Blue is the selected structure or function, light blue is the section that holds a selected function, grey boxes are the other structures, and the unfilled gaps are inactive space. The rows under the strip are the real bytes of the selection, 16 per row, with the file offset at the left.'])
    ]));
    render();
  }

  LF.register({ 'elf-byte-map': elfByteMap });
})();
